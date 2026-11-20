// Enquiries from the business template's contact form, kept in Supabase (site_enquiries). Shown in the site's
// own admin page and in the Studio. Only emails listed in site_admins for the site can read them.
import { Fragment, createContext, useContext, useEffect, useMemo, useState } from "react";
import { enquiriesSql, isAdmin, sbClient, sendCode, setupSql, signedInEmail, verifyCode, type SbCfg } from "../lib/supa";
import { Field, Spinner, useConfirm, useToast, SkelRows } from "../ui/kit";
import { inboxCall, type InboxEnquiry } from "../lib/inbox";
import { cfSignedIn, siteEnquiries, resendTestOnly } from "../lib/cfdb";
import type { CfSiteCfg } from "../lib/supa";

type Enquiry = { id: number; site: string; data: Record<string, string>; page: string; status: string; created_at: string };
const STATUS: [string, string][] = [["new", "New"], ["read", "Read"], ["replied", "Replied"], ["archived", "Archived"]];
/** An order from the Order now page moves through its own steps; the guest's order page follows them. */
const ORDER_STATUS: [string, string][] = [["new", "New"], ["read", "Seen"], ["accepted", "Confirmed"], ["preparing", "Being prepared"], ["ready", "Ready for pickup"], ["out", "Out for delivery"], ["done", "Completed"], ["cancelled", "Cancelled"], ["archived", "Archived"]];
const isOrder = (d: any) => !!(d && d.order_no);
/** The next step of an order, for the one-tap button. */
export const orderNext = (d: any, status: string): [string, string] | null => {
  const m = String(d?.mode || "").toLowerCase(), last = /pick/.test(m) ? "ready" : /deliver/.test(m) ? "out" : "";
  const flow = ["accepted", "preparing", ...(last ? [last] : []), "done"], i = flow.indexOf(status);
  if (status === "cancelled" || status === "archived" || status === "done") return null;
  const nx = flow[i + 1] || flow[0], l = ORDER_STATUS.find(([k]) => k === nx)![1];
  return [nx, i < 0 ? "Confirm the order" : "Mark: " + l];
};
const pill = (s: string) => ({ new: "border-brand-400/60 text-brand-200", read: "border-ink-500 text-ink-300", replied: "border-emerald-400/50 text-emerald-200", archived: "border-ink-600 text-ink-500", accepted: "border-emerald-400/50 text-emerald-200", preparing: "border-amber-400/50 text-amber-200", ready: "border-sky-400/50 text-sky-200", out: "border-sky-400/50 text-sky-200", done: "border-ink-500 text-ink-300", cancelled: "border-rose-400/50 text-rose-200" } as Record<string, string>)[s] || "border-ink-500 text-ink-300";
const LABELS: Record<string, string> = { name: "Name", email: "Email", phone: "Phone", company: "Company", service: "Interested in", budget: "Budget", message: "Message", consent: "Agreed to be contacted", type: "Request", date: "Date", time: "Time", guests: "Guests", occasion: "Occasion", order_no: "Order number", mode: "Order type", when: "For", address: "Address", table: "Table", items: "Items", total: "To pay", payment: "Payment" };
const HIDE = new Set(["okey", "pay_state", "rz_order", "rz_payment"]);
/** A booking request in one line: "Fri 20 Nov · 20:00 · 6 guests · Anniversary" (empty for an ordinary enquiry). */
export const bookingLine = (d: any): string => {
  if (!d || !(d.date || d.time || d.guests)) return "";
  let day = String(d.date || "");
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day); if (m) { const x = new Date(+m[1], +m[2] - 1, +m[3]); if (!isNaN(+x)) day = x.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }); }
  return [day, d.time, d.guests && (/^\d+$/.test(String(d.guests)) ? `${d.guests} guest${String(d.guests) === "1" ? "" : "s"}` : String(d.guests)), d.occasion].filter(Boolean).join(" · ");
};
const when = (iso: string) => { try { return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }); } catch { return iso; } };

/** Where a business site's enquiries are: its hosted Supabase, else the form's own Supabase settings. */
export function enquiriesCfg(content: any, hosted?: SbCfg | null): SbCfg | null {
  if (hosted) return hosted;
  const F = content?.contact?.form || {};
  return /^https:\/\//.test(F.sbUrl || "") && F.sbKey && F.site ? { url: String(F.sbUrl).replace(/\/+$/, ""), key: F.sbKey, site: F.site } : null;
}

/** What the database noted about an enquiry's email, with the fix for Resend's two usual refusals. */
function mailSaid(m: string): string {
  const own = resendTestOnly(m);
  if (own) return `Not emailed: your Resend account is still in test mode, which only delivers to ${own}. Verify your domain at resend.com/domains and use a sender address on it (Publish to Cloudflare → Email settings), or set “Send to” to ${own}.`;
  if (/domain is not verified|not verified/i.test(m)) return "Not emailed: the sender address's domain isn't verified in Resend yet. Finish the DNS records at resend.com/domains, or use the sender address Resend gave you.";
  return m;
}

/** `only`: "orders" lists what was bought (Purchased orders); "enquiries" leaves orders out of the inbox. */
type Only = "orders" | "enquiries" | undefined;
const OnlyCtx = createContext<Only>(undefined);
export function EnquiriesPanel(props: { cfg: SbCfg | null; cf?: CfSiteCfg; account?: string; hosted?: boolean; email?: string; form?: any; ghToken?: string; inStudio?: boolean; only?: Only }) {
  return <OnlyCtx.Provider value={props.only}><EnquiriesPanelIn {...props} /></OnlyCtx.Provider>;
}
function EnquiriesPanelIn({ cfg, cf, account, hosted, email: contactEmail, form, ghToken, inStudio }: { cfg: SbCfg | null; cf?: CfSiteCfg; account?: string; hosted?: boolean; email?: string; form?: any; ghToken?: string; inStudio?: boolean }) {
  if (cf && form?.saveTo !== "file") return <CfInbox key={cf.api + cf.site} cf={cf} account={account} />;
  if (form?.saveTo === "file") {
    if (!/^https:\/\//.test(form.fileUrl || "")) return (
      <section className="card flex max-w-2xl flex-col gap-3 p-5 text-sm text-ink-300">
        <h3 className="text-[15px] font-extrabold text-ink-100">The enquiry inbox isn't set up yet</h3>
        <p>{inStudio ? <>Press <b className="text-ink-100">Enquiry inbox</b> at the top of the project to set it up, then publish.</> : "Ask the site's designer to set up the enquiry inbox in Site Studio."} Until then, enquiries can't be saved.</p>
      </section>
    );
    if (!ghToken) return (
      <section className="card flex max-w-2xl flex-col gap-3 p-5 text-sm text-ink-300">
        <h3 className="text-[15px] font-extrabold text-ink-100">Enquiries are saved as JSON files in a private GitHub repository</h3>
        <p>Reading them needs a GitHub sign-in that can edit this site. Open <b className="text-ink-100">Enquiries</b> in Site Studio to read them.</p>
      </section>
    );
    return <FileInbox key={form.fileUrl} url={form.fileUrl} token={ghToken} />;
  }
  if (!cfg) return (
    <section className="card flex max-w-2xl flex-col gap-3 p-5 text-sm text-ink-300">
      <h3 className="text-[15px] font-extrabold text-ink-100">Enquiries aren't being saved yet</h3>
      <p>Right now the form opens the visitor's email app, addressed to <b className="text-ink-100">{contactEmail || "your contact email"}</b>, so enquiries arrive in your inbox.</p>
      <p>To collect them here instead:</p>
      <ul className="list-disc space-y-1 pl-5">
        <li><b className="text-ink-100">Hosted on external services</b> (Cloudflare or Netlify, from the Studio): nothing else to add. With Supabase, re-run the setup SQL once so the enquiries table exists.</li>
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
  return <EnquiryList rows={rows || []} setStatus={setStatus} remove={remove} load={load} name={cfg.site} who={<>Signed in as {me} · {rows?.length || 0} enquir{rows?.length === 1 ? "y" : "ies"} for <b className="text-ink-200">{cfg.site}</b></>} />;
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

type Row = { id: string | number; data: Record<string, string>; page?: string; status: string; created_at: string };

/** The list of enquiries with filters, search, status, reply, delete and CSV, for either store. */
function EnquiryList<R extends Row>({ rows: every, setStatus, remove, load, name, who, orders, setPaid }: { rows: R[]; setStatus: (r: R, s: string) => void; remove: (r: R) => void; load: () => void; name: string; who: React.ReactNode; /** This inbox keeps an order's steps (the Cloudflare database does). */ orders?: boolean; setPaid?: (r: R, paid: boolean) => void }) {
  const only = useContext(OnlyCtx);
  const rows = useMemo(() => (only === "orders" ? every.filter((r) => isOrder(r.data)) : only === "enquiries" ? every.filter((r) => !isOrder(r.data)) : every), [every, only]);
  const [filter, setFilter] = useState("open");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | number | null>(null);
  const list = useMemo(() => rows.filter((r) => (filter === "open" ? r.status !== "archived" : filter === "orders" ? isOrder(r.data) && !["done", "cancelled", "archived"].includes(r.status) : filter === "all" ? true : r.status === filter) && (!q || JSON.stringify(r.data).toLowerCase().includes(q.toLowerCase()))), [rows, filter, q]);
  const counts = useMemo(() => ({ new: rows.filter((r) => r.status === "new").length, orders: rows.filter((r) => isOrder(r.data) && !["done", "cancelled", "archived"].includes(r.status)).length, anyOrder: rows.some((r) => isOrder(r.data)) }), [rows]);
  const csv = () => {
    const keys = only === "orders" ? ["created_at", "status", "order_no", "name", "phone", "email", "mode", "when", "address", "items", "total", "payment", "utr", "_paid"] : ["created_at", "status", "name", "email", "phone", "company", "service", "budget", "message"];
    const cell = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const text = [keys.join(","), ...list.map((r) => keys.map((k) => cell(k === "created_at" || k === "status" ? (r as any)[k] : r.data[k])).join(","))].join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" })); a.download = `${only === "orders" ? "orders" : "enquiries"}-${name}.csv`; a.click();
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-ink-600" role="group" aria-label="Show">
          {[["open", "Inbox"], ["new", `New${counts.new ? ` (${counts.new})` : ""}`], ...(counts.anyOrder ? [["orders", `Orders to do${counts.orders ? ` (${counts.orders})` : ""}`]] : []), ["replied", "Replied"], ["archived", "Archived"], ["all", "All"]].map(([k, l]) => (
            <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} className={`btn btn-sm border-0 ${filter === k ? "bg-ink-700" : "bg-transparent"}`}>{l}</button>
          ))}
        </div>
        <input className="input w-48 py-1.5 text-sm" placeholder="Search" aria-label="Search enquiries" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="ml-auto flex gap-2"><button className="btn btn-sm" onClick={load}>↻ Refresh</button><button className="btn btn-sm" disabled={!list.length} onClick={csv}>Download CSV</button></span>
      </div>
      <p className="text-[13px] text-ink-400">{who}</p>
      {!list.length && <p className="card p-5 text-sm text-ink-400">{rows.length ? "Nothing here with this filter." : only === "orders" ? "No orders yet. When a customer places an order on your site, it appears here." : "No enquiries yet. When someone sends the form on your site, it appears here."}</p>}
      {/^Not emailed/.test(String(rows[0]?.data?._mail || "")) && <p role="status" className="rounded-lg border border-amber-400/40 bg-amber-400/5 px-3 py-2 text-[13px] text-amber-100"><b>The latest enquiry wasn't emailed to you.</b> {mailSaid(rows[0].data._mail)} It is saved here all the same.</p>}
      <ul className="flex flex-col gap-2" aria-label="Enquiries">
        {list.map((r) => {
          const d = r.data || {}, isOpen = open === r.id, ord = isOrder(d), SL = ord && orders ? ORDER_STATUS : STATUS, nx = ord && orders ? orderNext(d, r.status) : null;
          return (
            <li key={r.id} className={`overflow-hidden rounded-xl border bg-ink-950 ${r.status === "new" ? "border-brand-500/50" : "border-ink-600"}`}>
              <button type="button" aria-expanded={isOpen} onClick={() => { setOpen(isOpen ? null : r.id); if (!isOpen && r.status === "new") setStatus(r, "read"); }} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left">
                {r.status === "new" && <span className="h-2 w-2 rounded-full bg-brand-400" aria-label="New" />}
                <b className="text-sm">{d.name || "No name"}</b>
                <span className="text-[13px] text-ink-400">{[d.company, d.service, d.type && bookingLine(d) ? d.type : ""].filter(Boolean).join(" · ")}</span>
                {bookingLine(d) && <span className="chip border-brand-400/50 text-brand-200" data-booking>{bookingLine(d)}</span>}
                {ord && (d.utr || d._paid) && <span className={`chip ${d._paid ? "border-emerald-400/50 text-emerald-200" : "border-amber-400/60 text-amber-200"}`} data-pay>{d._paid ? "Paid" : "Payment to check"}</span>}
                {ord && <span className="chip border-brand-400/50 text-brand-200" data-order>{[`Order ${d.order_no}`, d.mode, d.when, d.total].filter(Boolean).join(" · ")}</span>}
                <span className="ml-auto text-xs text-ink-500">{when(r.created_at)}</span>
                <span className={`chip ${pill(r.status)}`}>{(ord ? ORDER_STATUS : STATUS).find(([k]) => k === r.status)?.[1] || r.status}</span>
                <span className="w-full truncate text-[13px] text-ink-300">{ord ? String(d.items || "").replace(/\n/g, " · ") : d.message}</span>
              </button>
              {isOpen && (
                <div className="flex flex-col gap-3 border-t border-ink-700 px-4 py-3">
                  <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
                    {Object.keys(LABELS).filter((k) => d[k] && !(ord && k === "message")).map((k) => (<Fragment key={k}><dt className="text-ink-400">{LABELS[k]}</dt><dd className="whitespace-pre-wrap text-ink-100">{k === "email" ? <a className="text-brand-300 underline" href={`mailto:${d.email}`}>{d.email}</a> : k === "phone" ? <a className="text-brand-300 underline" href={`tel:${d.phone}`}>{d.phone}</a> : k === "consent" ? "Yes" : d[k]}</dd></Fragment>))}
                    {Object.keys(d).filter((k) => !LABELS[k] && d[k] && !k.startsWith("_") && !HIDE.has(k)).map((k) => (<Fragment key={k}><dt className="text-ink-400">{k}</dt><dd className="whitespace-pre-wrap">{d[k]}</dd></Fragment>))}
                    {r.page && <><dt className="text-ink-400">Sent from</dt><dd className="font-mono text-xs text-ink-400">{r.page}</dd></>}
                    {d._phone && <><dt className="text-ink-400">Mobile number</dt><dd className="text-emerald-200">{d._phone}</dd></>}
                    {d._email && <><dt className="text-ink-400">Email address</dt><dd className={/^Verified/.test(d._email) ? "text-emerald-200" : "text-amber-200"}>{d._email}</dd></>}
                    {d._wa && <><dt className="text-ink-400">WhatsApp to you</dt><dd className={/^Not sent/.test(d._wa) ? "text-amber-200" : "text-ink-300"}>{d._wa}</dd></>}
                    {d._mail && <><dt className="text-ink-400">Email to you</dt><dd className={/^Not emailed/.test(d._mail) ? "text-amber-200" : "text-ink-300"}>{mailSaid(d._mail)}</dd></>}
                  </dl>
                  {ord && d._paid && !d.utr && <p className="rounded-lg border border-emerald-400/40 px-3 py-2 text-[13px] text-emerald-100" data-payline><b>Paid online.</b> {d._paid_by || ""} Confirmed by the payment gateway; nothing to check.</p>}
                  {ord && d._points && <p className="rounded-lg border border-ink-600 px-3 py-2 text-[13px] text-ink-200" data-pointsline>Points: {d._points}.</p>}
                  {ord && d._pos && <p className={`rounded-lg border px-3 py-2 text-[13px] ${/^Not sent/.test(d._pos) ? "border-amber-400/40 text-amber-100" : "border-ink-600 text-ink-200"}`} data-posline>{d._pos}{d._pos_prep ? ` Ready in about ${d._pos_prep} min.` : ""}</p>}
                  {ord && d.utr && <p className={`rounded-lg border px-3 py-2 text-[13px] ${d._paid ? "border-emerald-400/40 text-emerald-100" : "border-amber-400/40 bg-amber-400/5 text-amber-100"}`} data-payline>
                    {d._paid ? <><b>Payment received.</b> UPI reference {d.utr}.</> : <><b>The guest says they paid {d.total} by UPI, reference {d.utr}.</b> Find that reference and amount in your UPI app or bank statement before you send the order out.</>}
                    {setPaid && <button type="button" className={`btn btn-sm ml-2 ${d._paid ? "" : "btn-pri"}`} onClick={() => setPaid(r, !d._paid)}>{d._paid ? "Not received after all" : "Payment received"}</button>}
                  </p>}
                  <div className="flex flex-wrap items-center gap-2">
                    {nx && <button type="button" className="btn btn-sm btn-pri" onClick={() => setStatus(r, nx[0])}>{nx[1]}</button>}
                    {d.email && !ord && <a className="btn btn-sm btn-pri" href={`mailto:${d.email}?subject=${encodeURIComponent("Re: your enquiry")}`} onClick={() => setStatus(r, "replied")}>Reply by email</a>}
                    {d.phone && <a className={`btn btn-sm ${d.email || nx ? "" : "btn-pri"}`} href={`tel:${String(d.phone).replace(/[^\d+]/g, "")}`}>Call</a>}
                    {d.phone && <a className="btn btn-sm" href={`https://wa.me/${d.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener">WhatsApp</a>}
                    <select aria-label="Status" className="input w-auto py-1.5 text-sm" value={r.status} onChange={(e) => setStatus(r, e.target.value)}>{SL.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                    {nx && r.status !== "cancelled" && <button type="button" className="btn btn-sm" onClick={() => setStatus(r, "cancelled")}>Cancel the order</button>}
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


function FileInbox({ url, token }: { url: string; token: string }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState<(InboxEnquiry & { id: string })[] | null>(null);
  const [err, setErr] = useState(""), [more, setMore] = useState(false);
  const load = async () => {
    setErr("");
    try { const j = await inboxCall<{ items: InboxEnquiry[]; more?: boolean }>(url, token, { action: "list" }); setRows(j.items.map((x) => ({ ...x, id: x.path }))); setMore(!!j.more); }
    catch (e: any) { setErr(e?.message || "Couldn't load enquiries."); }
  };
  useEffect(() => { load(); }, [url, token]);
  const setStatus = async (r: InboxEnquiry, status: string) => {
    setRows((x) => (x || []).map((y) => (y.path === r.path ? { ...y, status } : y)));
    try { await inboxCall(url, token, { action: "status", path: r.path, status }); } catch (e: any) { toast(e?.message || "Couldn't update it.", "bad"); load(); }
  };
  const remove = async (r: InboxEnquiry) => {
    if (!(await confirm("Delete this enquiry?", `From ${r.data.name || r.data.email || "a visitor"}. Its file is deleted from the repository.`, "Delete", true))) return;
    try { await inboxCall(url, token, { action: "delete", path: r.path }); setRows((x) => (x || []).filter((y) => y.path !== r.path)); toast("Deleted"); }
    catch (e: any) { toast(e?.message || "Couldn't delete it.", "bad"); }
  };
  if (err) return <section className="card flex max-w-xl flex-col gap-3 p-5"><p className="text-sm text-red-300">{err}</p><button className="btn self-start" onClick={load}>Try again</button></section>;
  if (!rows) return <SkelRows n={5} label="Loading enquiries" />;
  return <EnquiryList rows={rows} setStatus={setStatus} remove={remove} load={load} name="site" who={<>{rows.length} enquir{rows.length === 1 ? "y" : "ies"}, saved as JSON files in a private GitHub repository{more ? " (showing the newest 300)" : ""}.</>} />;
}

/** Enquiries kept in the Studio's Cloudflare database (sites hosted there). */
function CfInbox({ cf, account }: { cf: CfSiteCfg; account?: string }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState<Row[] | null>(null), [err, setErr] = useState(""), [who, setWho] = useState("");
  const load = async () => {
    setErr("");
    try { const e = await siteEnquiries(cf, account); setWho((await cfSignedIn(cf.api)) || (e.bridged ? "your Studio (its database reaches this site)" : "")); setRows((await e.list()).map((r) => ({ ...r, id: r.id }))); }
    catch (e: any) { setErr(e?.status === 401 ? "Sign in to this site's admin page (or the Studio's hosting dialog) on this device to read enquiries." : e?.message || "Couldn't load enquiries."); }
  };
  useEffect(() => { load(); }, [cf.api, cf.site]);
  const setStatus = async (r: Row, status: string) => {
    setRows((x) => (x || []).map((y) => (y.id === r.id ? { ...y, status } : y)));
    try { await (await siteEnquiries(cf, account)).status(Number(r.id), status); } catch (e: any) { toast(e?.message || "Couldn't update it.", "bad"); load(); }
  };
  const remove = async (r: Row) => {
    if (!(await confirm("Delete this enquiry?", `From ${r.data.name || r.data.email || "a visitor"}. This can't be undone.`, "Delete", true))) return;
    try { await (await siteEnquiries(cf, account)).remove(Number(r.id)); setRows((x) => (x || []).filter((y) => y.id !== r.id)); toast("Deleted"); }
    catch (e: any) { toast(e?.message || "Couldn't delete it.", "bad"); }
  };
  if (err) return <section className="card flex max-w-xl flex-col gap-3 p-5"><p className="text-sm text-red-300">{err}</p><button className="btn self-start" onClick={load}>Try again</button></section>;
  if (!rows) return <SkelRows n={5} label="Loading enquiries" />;
  const setPaid = async (r: Row, paid: boolean) => {
    setRows((x) => (x || []).map((y) => (y.id === r.id ? { ...y, data: { ...y.data, _paid: paid ? "yes" : "" } } : y)));
    try { await (await siteEnquiries(cf, account)).paid(Number(r.id), paid); toast(paid ? "Marked as paid. The guest's order page shows it." : "Marked as not received."); } catch (e: any) { toast(e?.message || "Couldn't update it.", "bad"); load(); }
  };
  return <EnquiryList rows={rows} setStatus={setStatus} setPaid={setPaid} remove={remove} load={load} orders name={cf.site} who={<>Signed in as {who} · {rows.length} enquir{rows.length === 1 ? "y" : "ies"} for <b className="text-ink-200">{cf.site}</b></>} />;
}
