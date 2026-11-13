// Settings → Studio Partners: set up Studios for clients (on your accounts or theirs), share sites with them and
// keep those sites in step both ways. Each client Studio shows as a card with its shared sites and their status.
import { isHosted } from "../lib/backend";
import { useEffect, useState } from "react";
import type { Session } from "../lib/auth";
import { netlifyToken } from "../lib/hosting";
import { Netlify } from "../lib/netlify";
import { backendOf } from "../lib/backend";
import { cfAddMembers } from "../lib/cfdb";
import type { StudioHostCfg } from "../lib/studiohost";
import { useCloudflarePicker } from "./CfPicker";
const hostFields = (t: StudioHostCfg) => (t.kind === "cloudflare" ? { backend: "cloudflare" as const, api: t.api } : { backend: "supabase" as const, sbUrl: t.url, sbKey: t.key });
import { useBrand } from "../lib/brand";
import { appBase, appFiles } from "../lib/migrate";
import { loadHostConfig } from "../lib/studiohost";
import { deployClientApp, hostOf, partnerSignedIn, prepareClientSupabase, pullSite, remoteRepo, seedClientStudio, sendSite, siteSync, type PartnerRec, type SharedSite, type SiteSync } from "../lib/partners";
import type { Studio, StudioIndex } from "../lib/studio";
import { timeAgo, uid } from "../lib/util";
import { Field, Spinner, useConfirm, useToast } from "../ui/kit";
import { NetlifyAccount } from "./HostDialog";
import { useSupabasePicker } from "./MigrationTab";

const slug = (s: string) => String(s || "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);
const emails = (s: string) => [...new Set(s.split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter((x) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)))];

/** Where the Studio app files come from: this Studio (or, for a moved Studio, its original). */
async function source() { const c = await loadHostConfig(); return c?.source || appBase(); }

export function PartnersTab({ studio, index, session, onIndex }: { studio: Studio; index: StudioIndex; session: Session; onIndex: (i: StudioIndex) => void }) {
  const [nf, setNf] = useState<Netlify | null | undefined>(undefined);
  useEffect(() => { netlifyToken.load(session.token).then((t) => setNf(t ? new Netlify(t.token) : null)); }, [session.token]);
  const [adding, setAdding] = useState(!(index.partners || []).length);
  const brand = useBrand();
  const partner = { name: brand.name, url: index.hosted?.url || (isHosted(session) ? appBase() : undefined) };
  const myEmail = isHosted(session) ? session.username : (() => { try { return localStorage.getItem("site-studio:host-email") || ""; } catch { return ""; } })();
  const save = async (fn: (list: PartnerRec[]) => PartnerRec[], msg: string) => onIndex(await studio.updateIndex((i) => { i.partners = fn(i.partners || []); }, msg));
  if (nf === undefined) return <Spinner label="Checking Netlify…" />;
  return (
    <div className="flex flex-col gap-4">
      <section className="card flex flex-col gap-2 p-5">
        <h2 className="text-lg font-extrabold">Studio Partners</h2>
        <p className="text-sm text-ink-300">Give each client their own Studio, branded as set up by <b className="text-ink-100">{brand.name}</b>. Clients sign in with an email code and can edit and publish the sites you share, and make new ones. Shared sites stay in step both ways: each card shows who changed what, and you choose what to keep.</p>
        {!adding && <button type="button" className="btn btn-pri self-start" onClick={() => setAdding(true)}>＋ Add a client Studio</button>}
      </section>
      {adding && <AddPartner nf={nf} setNf={setNf} session={session} index={index} partner={partner} myEmail={myEmail} onCancel={() => setAdding(false)}
        onDone={async (rec) => { await save((l) => [...l.filter((x) => x.id !== rec.id), rec], `Add client Studio ${rec.name}`); setAdding(false); }} />}
      {(index.partners || []).map((p) => <PartnerCard key={p.id} p={p} studio={studio} index={index} nf={nf} partner={partner}
        onChange={(fn, msg) => save((l) => l.map((x) => (x.id === p.id ? fn(x) : x)), msg)} onRemove={() => save((l) => l.filter((x) => x.id !== p.id), `Remove client Studio ${p.name}`)} />)}
    </div>
  );
}

function AddPartner({ nf, setNf, session, index, partner, myEmail, onDone, onCancel }: { nf: Netlify | null; setNf: (n: Netlify | null) => void; session: Session; index: StudioIndex; partner: { name: string; url?: string }; myEmail: string; onDone: (p: PartnerRec) => Promise<void>; onCancel: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(""), [clients, setClients] = useState(""), [id, setId] = useState(""), [site, setSite] = useState(""), [mine, setMine] = useState(myEmail);
  const [accounts, setAccounts] = useState<"mine" | "client">("mine");
  const [clientNfTok, setClientNfTok] = useState("");
  const clientNf = accounts === "client" && clientNfTok.trim().length > 20 ? new Netlify(clientNfTok.trim()) : null;
  const [kind, setKind] = useState<"cloudflare" | "supabase">("cloudflare");
  const sb = useSupabasePicker(session.token, nf, accounts === "mine");
  const cf = useCloudflarePicker(session.token, nf, accounts === "mine", partner.name);
  const [phase, setPhase] = useState<"form" | "code" | "busy" | "done">("form"), [step, setStep] = useState(""), [err, setErr] = useState(""), [code, setCode] = useState("");
  const [target, setTarget] = useState<StudioHostCfg | null>(null), [made, setMade] = useState<PartnerRec | null>(null);
  useEffect(() => { const s = slug(name); setId(s ? s + "-studio" : ""); setSite(s ? s + "-studio" : ""); sb.setName(s ? s + "-studio" : "studio"); }, [name]);
  const list = emails(clients);
  const deployNf = accounts === "mine" ? nf : clientNf;
  const ok = !!nf && !!deployNf && (kind === "cloudflare" ? cf.ready : sb.ready) && name.trim().length > 1 && list.length > 0 && /^[a-z0-9][a-z0-9-]{1,29}$/.test(id) && /^[a-z0-9][a-z0-9-]{1,40}$/.test(site) && /@/.test(mine);

  const finish = async (t: StudioHostCfg) => {
    setPhase("busy");
    const rec: PartnerRec = { id: uid(), name: name.trim(), url: "", studio: id, backend: t.kind, ...(t.kind === "cloudflare" ? { api: t.api } : { sbUrl: t.url, sbKey: t.key }), accounts, clientEmails: list, partnerEmail: mine.trim().toLowerCase(), at: new Date().toISOString(), shared: [] };
    setStep("Setting up the client's Studio"); await seedClientStudio(remoteRepo(rec), { name: rec.name, badge: index.badge, menus: index.menus });
    const app = await deployClientApp(deployNf!, rec, site, await source(), partner, setStep);
    const done = { ...rec, url: app.url, siteId: accounts === "mine" ? app.siteId : undefined };
    await onDone(done); setMade(done); setPhase("done"); toast(`${rec.name}'s Studio is ready`);
  };
  const start = async () => {
    setErr("");
    try {
      setPhase("busy");
      let t: StudioHostCfg;
      if (kind === "cloudflare") {
        const { setup, relay, token } = await cf.ensure(setStep);
        setStep("Adding the client's owners and you as partner");
        await cfAddMembers(relay, token, setup, "studio:" + id, [...list.map((email) => ({ email, role: "owner" as const })), { email: mine.trim().toLowerCase(), role: "partner" as const }]);
        t = { kind: "cloudflare", api: setup.api, studio: id, name: name.trim() };
      } else {
        const { m, ref } = await sb.ensure(setStep);
        const s = await prepareClientSupabase(m, ref, { studio: id, clientEmails: list, partnerEmail: mine.trim().toLowerCase() }, setStep);
        t = { kind: "supabase", url: s.url, key: s.key, studio: id, name: name.trim() };
      }
      setTarget(t);
      if (await partnerSignedIn({ ...hostFields(t), studio: id, name: name.trim(), partnerEmail: mine })) await finish(t);
      else { setStep("Sending you a sign-in code"); await backendOf(t).sendCode(mine.trim()); setPhase("code"); }
    } catch (e: any) { setErr(e?.message || "Something went wrong."); setPhase(target ? "code" : "form"); }
    setStep("");
  };
  const verify = async () => {
    if (!target) return;
    setErr("");
    try { setPhase("busy"); setStep("Checking the code"); await backendOf(target).verifyCode(mine.trim(), code); await finish(target); }
    catch (e: any) { setErr(e?.message || "Something went wrong."); setPhase("code"); }
    setStep("");
  };

  if (phase === "done" && made) return (
    <section className="card flex flex-col gap-2 border-emerald-400/40 p-5" aria-label="Client Studio ready">
      <h3 className="text-[15px] font-extrabold text-emerald-200">✓ {made.name}'s Studio is ready</h3>
      <p className="text-sm text-ink-300">Send them the address. They sign in with {made.clientEmails.join(", ")} and the code they get by email. Share sites with them from the card below.</p>
      <div className="flex gap-2"><a className="btn btn-pri" href={made.url} target="_blank" rel="noopener noreferrer">Open it ↗</a><button type="button" className="btn" onClick={() => navigator.clipboard?.writeText(made.url).then(() => toast("Address copied"))}>Copy address</button></div>
    </section>
  );
  return (
    <section className="card flex flex-col gap-4 p-5" aria-label="Add a client Studio">
      <div className="flex items-center"><h3 className="text-[15px] font-extrabold">Add a client Studio</h3><button type="button" className="btn btn-ghost btn-sm ml-auto" onClick={onCancel}>Cancel</button></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Client or company name" htmlFor="pt-name"><input id="pt-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Advisory" /></Field>
        <Field label="Client emails (they sign in with these)" htmlFor="pt-emails" hint="Comma-separated. Each becomes an owner of their Studio."><input id="pt-emails" className="input" value={clients} onChange={(e) => setClients(e.target.value)} placeholder="owner@acme.com" /></Field>
        <Field label="Studio ID" htmlFor="pt-id"><input id="pt-id" className="input font-mono" value={id} onChange={(e) => setId(slug(e.target.value))} /></Field>
        <Field label="Address" htmlFor="pt-site" hint={site ? `${site}.netlify.app` : ""}><input id="pt-site" className="input font-mono" value={site} onChange={(e) => setSite(slug(e.target.value))} /></Field>
        <Field label="Your email (partner access)" htmlFor="pt-me" hint="You keep access to their Studio with it, to share and sync sites."><input id="pt-me" className="input" type="email" value={mine} onChange={(e) => setMine(e.target.value)} /></Field>
      </div>
      <div className="flex flex-col gap-1.5"><span className="label">Runs on</span>
        <div className="flex flex-wrap rounded-lg border border-ink-600 self-start" role="radiogroup" aria-label="Runs on">
          {([["mine", "My Netlify + Supabase"], ["client", "The client's Netlify + Supabase"]] as const).map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={accounts === k} onClick={() => setAccounts(k)} className={`btn btn-sm border-0 ${accounts === k ? "bg-ink-700" : "bg-transparent"}`}>{l}</button>)}
        </div>
        <p className="hint">{accounts === "mine" ? "You host and pay for it; one Supabase project can hold all your client Studios." : "The client owns the accounts: paste their Netlify token and Supabase access token here (used once, not kept). They update their Studio themselves from its Settings → Migration."}</p>
      </div>
      <section aria-label="Netlify" className="flex flex-col gap-2">
        <b className="text-sm">Netlify</b>
        {nf ? <p className="text-[13px] text-emerald-300">Your Netlify is connected{accounts === "client" ? " (it runs the Studio's helper)" : ""}.</p> : <NetlifyAccount session={session} onToken={(t) => setNf(t ? new Netlify(t) : null)} />}
        {accounts === "client" && <Field label="The client's Netlify personal access token" htmlFor="pt-cnf"><input id="pt-cnf" className="input font-mono text-xs" type="password" autoComplete="off" value={clientNfTok} onChange={(e) => setClientNfTok(e.target.value)} /></Field>}
      </section>
      <section aria-label="Database" className="flex flex-col gap-2"><b className="text-sm">Where their Studio keeps its files {accounts === "mine" ? "(your account)" : "(the client's account)"}</b>
        <div className="flex flex-wrap rounded-lg border border-ink-600 self-start" role="radiogroup" aria-label="Client database">
          {([["cloudflare", "Cloudflare"], ["supabase", "Supabase"]] as const).map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={`btn btn-sm border-0 ${kind === k ? "bg-ink-700" : "bg-transparent"}`}>{l}</button>)}
        </div>
        <section aria-label={kind === "cloudflare" ? "Cloudflare" : "Supabase"}>{kind === "cloudflare" ? cf.ui : sb.ui}</section>
      </section>
      {phase !== "code" && <button type="button" className="btn btn-pri self-start" disabled={!ok || phase === "busy"} onClick={start}>{phase === "busy" ? step + "…" : "Create the client Studio"}</button>}
      {phase === "code" && (
        <div className="flex flex-col gap-2" aria-label="Confirm your email">
          <p className="text-sm text-ink-300">Enter the code sent to <b className="text-ink-100">{mine}</b>: it gives you partner access to the client's Studio.</p>
          <div className="flex gap-2"><input aria-label="Code from the email" className="input w-36 font-mono text-lg tracking-widest" inputMode="numeric" maxLength={10} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
            <button type="button" className="btn btn-pri" disabled={code.length < 6} onClick={verify}>Finish</button></div>
        </div>
      )}
      {err && <p role="alert" className="text-sm text-red-300">{err}</p>}
    </section>
  );
}

const STATE: Record<SiteSync, [string, string]> = {
  same: ["In step", "border-emerald-400/60 text-emerald-200"], mine: ["You changed it", "border-brand-400/60 text-brand-200"],
  theirs: ["Client changed it", "border-amber-400/60 text-amber-200"], both: ["Both changed", "border-rose-400/60 text-rose-200"], gone: ["Missing on one side", "border-ink-500 text-ink-300"],
};

function PartnerCard({ p, studio, index, nf, partner, onChange, onRemove }: { p: PartnerRec; studio: Studio; index: StudioIndex; nf: Netlify | null; partner: { name: string; url?: string }; onChange: (fn: (p: PartnerRec) => PartnerRec, msg: string) => Promise<void>; onRemove: () => Promise<void> }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [signed, setSigned] = useState<boolean | null>(null), [code, setCode] = useState(""), [sent, setSent] = useState(false);
  const [states, setStates] = useState<Record<string, SiteSync | "checking">>({});
  const [busy, setBusy] = useState(""), [pick, setPick] = useState(""), [latest, setLatest] = useState<string | null>(null);
  const check = async () => {
    const ok = await partnerSignedIn(p); setSigned(ok); if (!ok) return;
    setStates(Object.fromEntries(p.shared.map((s) => [s.project, "checking"])));
    for (const s of p.shared) { const v = await siteSync(studio, p, s).catch(() => "gone" as const); setStates((m) => ({ ...m, [s.project]: v })); }
  };
  useEffect(() => { check(); source().then(appFiles).then((m) => setLatest(m.build)).catch(() => {}); }, [p.shared.length, p.sbUrl]);
  const run = async (k: string, fn: () => Promise<void>) => { setBusy(k); try { await fn(); } catch (e: any) { toast(e?.message || "Something went wrong.", "bad"); } setBusy(""); };
  // After a share, send or pull both sides hold the same content.
  const setShared = async (s: SharedSite, msg: string) => { await onChange((x) => ({ ...x, shared: [...x.shared.filter((y) => y.project !== s.project), s] }), msg); setStates((m) => ({ ...m, [s.project]: "same" })); };
  const share = () => run("share", async () => { const m = index.projects.find((x) => x.id === pick); if (!m) return; await setShared(await sendSite(studio, p, m, partner, setBusy), `Share ${m.name} with ${p.name}`); setPick(""); toast(`${m.name} is in ${p.name}'s Studio`); });
  const send = (s: SharedSite) => run(s.project, async () => { const m = index.projects.find((x) => x.id === s.project)!; await setShared(await sendSite(studio, p, m, partner, setBusy), `Send ${m.name} to ${p.name}`); toast("Sent"); });
  const pull = (s: SharedSite) => run(s.project, async () => { const r = await pullSite(studio, p, s.project, setBusy); await setShared(r.shared, `Bring in ${p.name}'s changes`); toast("Brought in the client's version"); });
  const unshare = (s: SharedSite) => run(s.project, async () => { if (!(await confirm("Stop syncing this site?", "It stays in both Studios; changes just aren't kept in step any more.", "Stop syncing"))) return; await onChange((x) => ({ ...x, shared: x.shared.filter((y) => y.project !== s.project) }), "Stop syncing a site"); });
  const updateApp = () => run("app", async () => { if (!nf || !p.siteId) return; await deployClientApp(nf, p, "", await source(), partner, setBusy); toast(`${p.name}'s Studio is updated`); });
  const notShared = index.projects.filter((m) => !p.shared.some((s) => s.project === m.id) && !m.partner);

  return (
    <section className="card flex flex-col gap-3 p-5" aria-label={`Client Studio ${p.name}`}>
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-extrabold">{p.name}</h3>
          <p className="truncate text-[13px] text-ink-400"><a className="text-brand-300 underline" href={p.url} target="_blank" rel="noopener noreferrer">{p.url.replace(/^https:\/\//, "")}</a> · {p.clientEmails.join(", ")}</p>
        </div>
        <span className="chip">{p.accounts === "mine" ? "On my accounts" : "On the client's accounts"}</span>
        <span className="chip">{p.shared.length} site{p.shared.length === 1 ? "" : "s"}</span>
      </div>
      {signed === false && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-400/5 p-3 text-[13px] text-amber-100">
          <span>Sign in to {p.name}'s Studio as <b>{p.partnerEmail}</b> on this device to share and sync.</span>
          {!sent ? <button type="button" className="btn btn-sm ml-auto" onClick={() => run("in", async () => { await backendOf(hostOf(p)).sendCode(p.partnerEmail); setSent(true); })}>Email me a code</button>
            : <span className="ml-auto flex gap-2"><input aria-label={`Code for ${p.name}`} className="input w-28 py-1 font-mono" value={code} maxLength={10} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} /><button type="button" className="btn btn-sm btn-pri" disabled={code.length < 6} onClick={() => run("in", async () => { await backendOf(hostOf(p)).verifyCode(p.partnerEmail, code); await check(); })}>Sign in</button></span>}
        </div>
      )}
      {p.shared.length > 0 && (
        <ul className="flex flex-col divide-y divide-ink-700 rounded-xl border border-ink-700" aria-label="Shared sites">
          {p.shared.map((s) => {
            const m = index.projects.find((x) => x.id === s.project), st = states[s.project];
            const [label, cls] = st && st !== "checking" ? STATE[st] : ["Checking…", "border-ink-500 text-ink-300"];
            return (
              <li key={s.project} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                <span className="min-w-0 flex-1"><b className="block truncate text-sm">{m?.name || s.project}</b><span className="text-[12px] text-ink-400">Last synced {timeAgo(s.at)}</span></span>
                <span className={`chip ${cls}`}>{label}</span>
                {busy === s.project ? <Spinner /> : signed && <>
                  {(st === "mine" || st === "both") && <button type="button" className="btn btn-sm" onClick={() => send(s)}>{st === "both" ? "Keep mine" : "Send to client"}</button>}
                  {(st === "theirs" || st === "both") && <button type="button" className="btn btn-sm" onClick={() => pull(s)}>{st === "both" ? "Keep theirs" : "Bring in their changes"}</button>}
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => unshare(s)}>Stop syncing</button>
                </>}
              </li>
            );
          })}
        </ul>
      )}
      {signed && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1"><span className="label">Share a site with {p.name}</span>
            <select className="input w-64" aria-label={`Site to share with ${p.name}`} value={pick} onChange={(e) => setPick(e.target.value)}><option value="">Choose a project…</option>{notShared.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
          <button type="button" className="btn btn-sm btn-pri" disabled={!pick || !!busy} onClick={share}>{busy === "share" ? "Sharing…" : "Share"}</button>
          <button type="button" className="btn btn-sm ml-auto" disabled={!!busy} onClick={() => run("refresh", check)}>↻ Check sync</button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 border-t border-ink-700 pt-3 text-[13px] text-ink-400">
        {p.accounts === "mine" && p.siteId ? <button type="button" className="btn btn-sm" disabled={!nf || !!busy} onClick={updateApp}>{busy === "app" ? "Updating…" : `Update their Studio${latest ? ` to ${latest}` : ""}`}</button> : <span>The client updates their Studio from its Settings → Migration.</span>}
        {busy && !["app", "share", "in", "refresh"].includes(busy) && !p.shared.some((s) => s.project === busy) && <span>{busy}…</span>}
        <button type="button" className="btn btn-ghost btn-sm ml-auto text-rose-300" onClick={() => confirm(`Remove ${p.name} from Studio Partners?`, "Their Studio keeps working; this only removes the card here.", "Remove", true).then((y) => { if (y) onRemove(); })}>Remove card</button>
      </div>
    </section>
  );
}
