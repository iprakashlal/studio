// Enquiries from the business template's contact form, kept in Supabase (site_enquiries). Shown in the site's
// own admin page and in the Studio. Only emails listed in site_admins for the site can read them.
import { Fragment, useEffect, useMemo, useState } from "react";
import { enquiriesSql, isAdmin, sbClient, sendCode, setupSql, signedInEmail, verifyCode, type SbCfg } from "../lib/supa";
import { Field, Spinner, useConfirm, useToast } from "../ui/kit";

type Enquiry = { id: number; site: string; data: Record<string, string>; page: string; status: string; created_at: string };
const STATUS: [string, string][] = [["new", "New"], ["read", "Read"], ["replied", "Replied"], ["archived", "Archived"]];
const pill = (s: string) => ({ new: "border-brand-400/60 text-brand-200", read: "border-ink-500 text-ink-300", replied: "border-emerald-400/50 text-emerald-200", archived: "border-ink-600 text-ink-500" } as Record<string, string>)[s] || "border-ink-500 text-ink-300";
const LABELS: Record<string, string> = { name: "Name", email: "Email", phone: "Phone", company: "Company", service: "Interested in", budget: "Budget", message: "Message", consent: "Agreed to be contacted" };
const when = (iso: string) => { try { return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }); } catch { return iso; } };

/** Where a business site's enquiries are: its hosted Supabase, else the form's own Supabase settings. */
export function enquiriesCfg(content: any, hosted?: SbCfg | null): SbCfg | null {
  if (hosted) return hosted;
  const F = content?.contact?.form || {};
  return /^https:\/\//.test(F.sbUrl || "") && F.sbKey && F.site ? { url: String(F.sbUrl).replace(/\/+$/, ""), key: F.sbKey, site: F.site } : null;
}

export function EnquiriesPanel({ cfg, hosted, email: contactEmail }: { cfg: SbCfg | null; hosted?: boolean; email?: string }) {
  if (!cfg) return (
    <section className="card flex max-w-2xl flex-col gap-3 p-5 text-sm text-ink-300">
      <h3 className="text-[15px] font-extrabold text-ink-100">Enquiries aren't being saved yet</h3>
      <p>Right now the form opens the visitor's email app, addressed to <b className="text-ink-100">{contactEmail || "your contact email"}</b>, so enquiries arrive in your inbox.</p>
      <p>To collect them here instead:</p>
      <ul className="list-disc space-y-1 pl-5">
        <li><b className="text-ink-100">Hosted on Netlify with Supabase</b> (Host outside GitHub in the Studio): nothing else to add. Re-run the setup SQL once so the enquiries table exists.</li>
        <li><b className="text-ink-100">On GitHub Pages</b>: create a free Supabase project, run <code className="font-mono text-xs">supabase/enquiries.sql</code> from your site's files (or the SQL shown here once connected), then add the Project URL, public key and a Site ID under <b className="text-ink-100">Contact &amp; form → Enquiry form</b> and publish.</li>
      </ul>
    </section>
  );
  return <Connected key={cfg.url + cfg.site} cfg={cfg} hosted={!!hosted} />;
}

function Connected({ cfg, hosted }: { cfg: SbCfg; hosted: boolean }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [me, setMe] = useState<string | null | undefined>(undefined);
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Enquiry[] | null>(null);
  const [err, setErr] = useState("");
  const [missing, setMissing] = useState(false);
  const [filter, setFilter] = useState("open");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const db = sbClient(cfg);

  useEffect(() => { signedInEmail(cfg).then(setMe).catch(() => setMe(null)); }, [cfg.url, cfg.key]);
  const load = async () => {
    setErr("");
    try {
      const ok = await isAdmin(cfg); setAdmin(ok);
      if (!ok) return;
      const { data, error } = await db.from("site_enquiries").select("*").eq("site", cfg.site).order("created_at", { ascending: false }).limit(500);
      if (error) { if (/site_enquiries|does not exist|schema cache/i.test(error.message)) { setMissing(true); setRows([]); return; } throw error; }
      setMissing(false); setRows(data as Enquiry[]);
    } catch (e: any) { setErr(e?.message || "Couldn't load enquiries."); }
  };
  useEffect(() => { if (me) load(); }, [me]);

  const list = useMemo(() => (rows || []).filter((r) => (filter === "open" ? r.status !== "archived" : filter === "all" ? true : r.status === filter) && (!q || JSON.stringify(r.data).toLowerCase().includes(q.toLowerCase()))), [rows, filter, q]);
  const counts = useMemo(() => ({ new: (rows || []).filter((r) => r.status === "new").length }), [rows]);

  const setStatus = async (r: Enquiry, status: string) => {
    const { error } = await db.from("site_enquiries").update({ status }).eq("id", r.id);
    if (error) return toast(error.message, "bad");
    setRows((x) => (x || []).map((y) => (y.id === r.id ? { ...y, status } : y)));
  };
  const remove = async (r: Enquiry) => {
    if (!(await confirm("Delete this enquiry?", `From ${r.data.name || r.data.email || "a visitor"}. This can't be undone.`, "Delete", true))) return;
    const { error } = await db.from("site_enquiries").delete().eq("id", r.id);
    if (error) return toast(error.message, "bad");
    setRows((x) => (x || []).filter((y) => y.id !== r.id)); toast("Deleted");
  };
  const csv = () => {
    const keys = ["created_at", "status", "name", "email", "phone", "company", "service", "budget", "message"];
    const cell = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const text = [keys.join(","), ...list.map((r) => keys.map((k) => cell(k === "created_at" || k === "status" ? (r as any)[k] : r.data[k])).join(","))].join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" })); a.download = `enquiries-${cfg.site}.csv`; a.click();
  };

  if (me === undefined) return <Spinner label="Connecting to Supabase…" />;
  if (!me) return <SignIn cfg={cfg} onIn={setMe} />;
  if (admin === null && !err) return <Spinner label="Checking your access…" />;
  if (err) return <section className="card flex max-w-xl flex-col gap-3 p-5"><p className="text-sm text-red-300">{err}</p><button className="btn self-start" onClick={load}>Try again</button></section>;
  if (!admin) return (
    <section className="card flex max-w-xl flex-col gap-3 p-5 text-sm text-ink-300">
      <h3 className="text-[15px] font-extrabold text-ink-100">{me} can't read this site's enquiries</h3>
      <p>In Supabase → SQL Editor, run this line, then press Check again:</p>
      <code className="block overflow-x-auto rounded-lg bg-ink-950 p-3 font-mono text-xs">insert into public.site_admins (site, email) values ('{cfg.site}', '{me}') on conflict do nothing;</code>
      <div className="flex gap-2"><button className="btn" onClick={load}>Check again</button><button className="btn btn-ghost" onClick={async () => { await db.auth.signOut(); setMe(null); }}>Use another email</button></div>
    </section>
  );
  if (missing) return (
    <section className="card flex max-w-3xl flex-col gap-3 p-5 text-sm text-ink-300">
      <h3 className="text-[15px] font-extrabold text-ink-100">One more step: create the enquiries table</h3>
      <p>Copy this into Supabase → SQL Editor and press Run (it's safe to run again), then press Check again.</p>
      <textarea readOnly className="input h-56 font-mono text-[11.5px]" value={hosted ? setupSql(cfg.site, me) : enquiriesSql(cfg.site, me)} onFocus={(e) => e.currentTarget.select()} />
      <div className="flex gap-2"><button className="btn" onClick={() => { navigator.clipboard?.writeText(hosted ? setupSql(cfg.site, me) : enquiriesSql(cfg.site, me)); toast("SQL copied"); }}>Copy SQL</button><button className="btn btn-pri" onClick={load}>Check again</button></div>
    </section>
  );
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-ink-600" role="group" aria-label="Show">
          {[["open", "Inbox"], ["new", `New${counts.new ? ` (${counts.new})` : ""}`], ["replied", "Replied"], ["archived", "Archived"], ["all", "All"]].map(([k, l]) => (
            <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} className={`btn btn-sm border-0 ${filter === k ? "bg-ink-700" : "bg-transparent"}`}>{l}</button>
          ))}
        </div>
        <input className="input w-48 py-1.5 text-sm" placeholder="Search" aria-label="Search enquiries" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="ml-auto flex gap-2"><button className="btn btn-sm" onClick={load}>↻ Refresh</button><button className="btn btn-sm" disabled={!list.length} onClick={csv}>Download CSV</button></span>
      </div>
      <p className="text-[13px] text-ink-400">Signed in as {me} · {rows?.length || 0} enquir{rows?.length === 1 ? "y" : "ies"} for <b className="text-ink-200">{cfg.site}</b></p>
      {!list.length && <p className="card p-5 text-sm text-ink-400">{rows?.length ? "Nothing here with this filter." : "No enquiries yet. When someone sends the form on your site, it appears here."}</p>}
      <ul className="flex flex-col gap-2" aria-label="Enquiries">
        {list.map((r) => {
          const d = r.data || {}, isOpen = open === r.id;
          return (
            <li key={r.id} className={`overflow-hidden rounded-xl border bg-ink-950 ${r.status === "new" ? "border-brand-500/50" : "border-ink-600"}`}>
              <button type="button" aria-expanded={isOpen} onClick={() => { setOpen(isOpen ? null : r.id); if (!isOpen && r.status === "new") setStatus(r, "read"); }} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left">
                {r.status === "new" && <span className="h-2 w-2 rounded-full bg-brand-400" aria-label="New" />}
                <b className="text-sm">{d.name || "No name"}</b>
                <span className="text-[13px] text-ink-400">{[d.company, d.service].filter(Boolean).join(" · ")}</span>
                <span className="ml-auto text-xs text-ink-500">{when(r.created_at)}</span>
                <span className={`chip ${pill(r.status)}`}>{STATUS.find(([k]) => k === r.status)?.[1] || r.status}</span>
                <span className="w-full truncate text-[13px] text-ink-300">{d.message}</span>
              </button>
              {isOpen && (
                <div className="flex flex-col gap-3 border-t border-ink-700 px-4 py-3">
                  <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
                    {Object.keys(LABELS).filter((k) => d[k]).map((k) => (<Fragment key={k}><dt className="text-ink-400">{LABELS[k]}</dt><dd className="whitespace-pre-wrap text-ink-100">{k === "email" ? <a className="text-brand-300 underline" href={`mailto:${d.email}`}>{d.email}</a> : k === "phone" ? <a className="text-brand-300 underline" href={`tel:${d.phone}`}>{d.phone}</a> : k === "consent" ? "Yes" : d[k]}</dd></Fragment>))}
                    {Object.keys(d).filter((k) => !LABELS[k] && d[k]).map((k) => (<Fragment key={k}><dt className="text-ink-400">{k}</dt><dd className="whitespace-pre-wrap">{d[k]}</dd></Fragment>))}
                    {r.page && <><dt className="text-ink-400">Sent from</dt><dd className="font-mono text-xs text-ink-400">{r.page}</dd></>}
                  </dl>
                  <div className="flex flex-wrap items-center gap-2">
                    {d.email && <a className="btn btn-sm btn-pri" href={`mailto:${d.email}?subject=${encodeURIComponent("Re: your enquiry")}`} onClick={() => setStatus(r, "replied")}>Reply by email</a>}
                    {d.phone && <a className="btn btn-sm" href={`https://wa.me/${d.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener">WhatsApp</a>}
                    <select aria-label="Status" className="input w-auto py-1.5 text-sm" value={r.status} onChange={(e) => setStatus(r, e.target.value)}>{STATUS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                    <button className="btn btn-sm btn-danger ml-auto" onClick={() => remove(r)}>Delete</button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SignIn({ cfg, onIn }: { cfg: SbCfg; onIn: (email: string) => void }) {
  const [email, setEmail] = useState(""), [code, setCode] = useState(""), [step, setStep] = useState<"email" | "code">("email"), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  return (
    <section className="card flex max-w-lg flex-col gap-4 p-5">
      <h3 className="text-[15px] font-extrabold">Sign in to read enquiries</h3>
      <p className="text-sm text-ink-300">{step === "email" ? "Use an email listed for this site in Supabase (site_admins). We'll send a 6-digit code." : <>Enter the code sent to <b className="text-ink-100">{email}</b>.</>}</p>
      <form className="flex flex-col gap-3" onSubmit={async (e) => {
        e.preventDefault(); setErr(""); setBusy(true);
        try { if (step === "email") { await sendCode(cfg, email); setStep("code"); } else { await verifyCode(cfg, email, code); onIn(email.trim().toLowerCase()); } } catch (x: any) { setErr(x.message); }
        setBusy(false);
      }}>
        {step === "email"
          ? <Field label="Email" htmlFor="enq-email"><input id="enq-email" className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          : <Field label="6-digit code" htmlFor="enq-code"><input id="enq-code" className="input font-mono tracking-[.3em]" inputMode="numeric" maxLength={6} required autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} /></Field>}
        <p role="alert" className="text-sm text-red-300">{err}</p>
        <div className="flex gap-2"><button className="btn btn-pri" disabled={busy}>{busy ? "Working…" : step === "email" ? "Send code" : "Sign in"}</button>{step === "code" && <button type="button" className="btn btn-ghost" onClick={() => { setStep("email"); setCode(""); }}>Use a different email</button>}</div>
      </form>
    </section>
  );
}
