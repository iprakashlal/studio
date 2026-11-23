// Studio Partners (its own page, #/partners): set up Studios for clients (on your accounts or theirs), share sites with them and
// keep those sites in step both ways. Each client Studio shows as a card with its shared sites and their status.
import { isHosted } from "../lib/backend";
import { useEffect, useRef, useState } from "react";
import type { Session } from "../lib/auth";
import { netlifyToken } from "../lib/hosting";
import { Netlify } from "../lib/netlify";
import { backendOf } from "../lib/backend";
import { cfAddMembers, cfDeployInfo, cfSignedIn, cfxSite, cfxPut, cfTokenPageFor, dbCloudflare } from "../lib/cfdb";
import { Cloudflare } from "../lib/cloudflare";
import { getHelper } from "../lib/relay";
import { CfDomainCard } from "./HostDialog";
import type { HostCfg } from "../lib/supa";
import type { StudioHostCfg } from "../lib/studiohost";
import { useCfAccount, useCloudflarePicker } from "./CfPicker";
import { cfLocalClient, loadPages, pagesViaDb, PAGES_LABEL, type PagesKind } from "../lib/pages";
const hostFields = (t: StudioHostCfg) => (t.kind === "cloudflare" ? { backend: "cloudflare" as const, api: t.api } : { backend: "supabase" as const, sbUrl: t.url, sbKey: t.key });
import { useBrand } from "../lib/brand";
import { appBase, appFiles } from "../lib/migrate";
import { loadHostConfig } from "../lib/studiohost";
import { deployClientApp, getClientFeatures, hostOf, partnerSignedIn, prepareClientSupabase, pullSite, remoteRepo, seedClientStudio, sendSite, setClientFeatures, siteSync, type PartnerRec, type SharedSite, type SiteSync } from "../lib/partners";
import { CLIENT_FEATURES, cleanThemeList } from "../lib/features";
import { PayNote } from "./PayNote";
import { cleanPay } from "../lib/studio";
import { THEMES, type Theme } from "../themes/catalog";
import { BIZ_THEMES } from "../themes/business";
import { REST_THEMES } from "../themes/restaurant";
import { themeCode } from "../themes/codes";
import { partnerPlan, teardownPartner } from "../lib/teardown";
import { TeardownDialog } from "./TeardownDialog";
import { transferFiles } from "../lib/migrate";
import type { Studio, StudioIndex } from "../lib/studio";
import { timeAgo, uid } from "../lib/util";
import { Field, Spinner, useConfirm, useToast } from "../ui/kit";
import { NetlifyAccount } from "./HostDialog";
import { pagesFrom, useSupabasePicker } from "./MigrationTab";

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
      {(index.partners || []).map((p) => <PartnerCard key={p.id} p={p} studio={studio} index={index} nf={nf} setNf={setNf} session={session} myEmail={myEmail} studioToken={session.token} partner={partner}
        onChange={(fn, msg) => save((l) => l.map((x) => (x.id === p.id ? fn(x) : x)), msg)} onRemove={() => save((l) => l.filter((x) => x.id !== p.id), `Remove client Studio ${p.name}`)} />)}
    </div>
  );
}

// The themes of each type of site (the shop and the portfolio share one catalogue).
const THEME_KINDS: { id: "portfolio" | "store" | "business" | "restaurant"; label: string; pool: Theme[] }[] = [{ id: "portfolio", label: "Portfolio sites", pool: THEMES }, { id: "store", label: "Online shops", pool: THEMES }, { id: "business", label: "Business sites", pool: BIZ_THEMES as unknown as Theme[] }, { id: "restaurant", label: "Restaurant sites", pool: REST_THEMES as unknown as Theme[] }];
/** Choosing the themes a client Studio may use for one type of site: all of them, or the ticked ones. */
function ThemePick({ label, pool, value, onChange }: { label: string; pool: Theme[]; value: string[]; onChange: (ids: string[]) => void }) {
  const [open, setOpen] = useState(false), [find, setFind] = useState("");
  const all = value.length === 0, on = new Set(value);
  const q = find.trim().toLowerCase(), shown = pool.filter((t) => !q || (themeCode(t) + " " + t.name + " " + (t.tags || []).join(" ")).toLowerCase().includes(q));
  const toggle = (id: string) => { const n = new Set(on); n.has(id) ? n.delete(id) : n.add(id); onChange(pool.filter((t) => n.has(t.id)).map((t) => t.id)); };
  return (
    <div className="rounded-lg border border-ink-700" aria-label={`Themes for ${label}`}>
      <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="font-semibold text-ink-200">{label}</span>
        <span className="text-ink-400">· {all ? `all ${pool.length} themes` : `${value.length} of ${pool.length} themes`}</span>
        <span className="ml-auto text-ink-400">{open ? "Close" : "Choose"}</span>
      </button>
      {open && <div className="flex flex-col gap-2 border-t border-ink-700 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <input className="input min-w-0 flex-1 py-1.5" type="search" placeholder="Find a theme by name, code or style…" aria-label={`Find a theme for ${label}`} value={find} onChange={(e) => setFind(e.target.value)} />
          <button type="button" className="btn btn-sm" onClick={() => onChange([])}>All themes</button>
          <button type="button" className="btn btn-sm" onClick={() => onChange([...new Set([...value, ...shown.map((t) => t.id)])])}>Tick {q ? "these" : "all"}</button>
          <button type="button" className="btn btn-sm" disabled={all} onClick={() => onChange(value.filter((id) => !shown.some((t) => t.id === id)))}>Untick {q ? "these" : "all"}</button>
        </div>
        {all && <span className="text-ink-400">Every theme is allowed. Tick the ones to keep, and only those are offered.</span>}
        <ul className="grid max-h-72 gap-x-3 gap-y-1 overflow-y-auto pr-1 sm:grid-cols-2">
          {shown.map((t) => <li key={t.id}><label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 hover:bg-ink-800">
            <input type="checkbox" className="accent-brand-500" checked={on.has(t.id)} onChange={() => toggle(t.id)} />
            <span aria-hidden className="flex h-5 w-9 flex-none overflow-hidden rounded border border-white/15">{[t.colors.bg, t.colors.c1, t.colors.c2].map((c, i) => <i key={i} className="flex-1" style={{ background: c }} />)}</span>
            <span className="truncate"><span className="font-mono text-[12px] text-ink-400">{themeCode(t)}</span> {t.name}</span>
          </label></li>)}
          {!shown.length && <li className="text-ink-400">No theme matches.</li>}
        </ul>
      </div>}
    </div>
  );
}

function AddPartner({ nf, setNf, session, index, partner, myEmail, onDone, onCancel, from }: { nf: Netlify | null; setNf: (n: Netlify | null) => void; session: Session; index: StudioIndex; partner: { name: string; url?: string }; myEmail: string; onDone: (p: PartnerRec) => Promise<void>; onCancel: () => void; /** Moving this client's Studio: its files are copied to the new place and its card is updated. */ from?: PartnerRec }) {
  const toast = useToast();
  const [name, setName] = useState(from?.name || ""), [clients, setClients] = useState(from?.clientEmails.join(", ") || ""), [id, setId] = useState(from?.studio || ""), [site, setSite] = useState(from ? slug(from.name) + "-studio" : ""), [mine, setMine] = useState(from?.partnerEmail || myEmail);
  const [accounts, setAccounts] = useState<"mine" | "client">(from ? (from.accounts === "mine" ? "client" : "mine") : "mine");
  const [clientNfTok, setClientNfTok] = useState("");
  const clientNf = accounts === "client" && clientNfTok.trim().length > 20 ? new Netlify(clientNfTok.trim()) : null;
  const [kind, setKind] = useState<"cloudflare" | "supabase">("cloudflare");
  const [pagesKind, setPagesKind] = useState<PagesKind>("cloudflare");
  const sb = useSupabasePicker(session.token, nf, accounts === "mine");
  // One Cloudflare account (yours, or the client's used once) for both the app and the database.
  const cfAcc = useCfAccount(session.token, nf, accounts === "mine");
  const cf = useCloudflarePicker(session.token, nf, accounts === "mine", partner.name, cfAcc);
  const [phase, setPhase] = useState<"form" | "code" | "busy" | "done">("form"), [step, setStep] = useState(""), [err, setErr] = useState(""), [code, setCode] = useState("");
  const [target, setTarget] = useState<StudioHostCfg | null>(null), [made, setMade] = useState<PartnerRec | null>(null);
  useEffect(() => { const s = slug(name); sb.setName(s ? s + "-studio" : "studio"); if (from && name === from.name) return; setId(s ? s + "-studio" : ""); setSite(s ? s + "-studio" : ""); }, [name]);
  const list = emails(clients);
  const deployNf = accounts === "mine" ? nf : clientNf;
  const pagesOk = pagesKind === "netlify" ? !!deployNf : cfAcc.ready;
  const ok = pagesOk && (kind === "cloudflare" ? cf.ready : sb.ready) && name.trim().length > 1 && list.length > 0 && /^[a-z0-9][a-z0-9-]{1,29}$/.test(id) && /^[a-z0-9][a-z0-9-]{1,40}$/.test(site) && /@/.test(mine);

  const finish = async (t: StudioHostCfg) => {
    setPhase("busy");
    const rec: PartnerRec = { id: from?.id || uid(), name: name.trim(), url: "", studio: id, backend: t.kind, ...(t.kind === "cloudflare" ? { api: t.api } : { sbUrl: t.url, sbKey: t.key }), accounts, clientEmails: list, partnerEmail: mine.trim().toLowerCase(), at: new Date().toISOString(), shared: from?.shared || [] };
    if (from) {
      if (!(await partnerSignedIn(from))) throw new Error(`Sign in to ${from.name}'s Studio on its card first (Email me a code), so its files can be copied.`);
      await transferFiles(remoteRepo(from), remoteRepo(rec), (done, total) => setStep(`Copying the Studio's files (${done} of ${total})`));
    }
    setStep("Setting up the client's Studio"); await seedClientStudio(remoteRepo(rec), { name: rec.name, badge: index.badge, menus: index.menus });
    const app = await deployClientApp(await pagesFrom(pagesKind, deployNf, cfAcc, undefined, setStep), rec, site, await source(), partner, setStep);
    const done: PartnerRec = { ...rec, url: app.url, pages: app.kind, ...(accounts === "mine" ? { siteId: app.siteId, ...(app.account ? { pagesAccount: app.account } : {}) } : {}) };
    await onDone(done); setMade(done); setPhase("done"); toast(from ? `${rec.name}'s Studio has moved` : `${rec.name}'s Studio is ready`);
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
      if (from && t.kind === (from.backend || "supabase") && (t.kind === "cloudflare" ? t.api === from.api : t.url === from.sbUrl) && id === from.studio) throw new Error("That is where this Studio already is. Pick another account, or change the Studio ID.");
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
      <h3 className="text-[15px] font-extrabold text-emerald-200">✓ {made.name}'s Studio {from ? "has moved" : "is ready"}</h3>
      {from && <p className="text-sm text-ink-300">Its projects, photos and settings were copied. The old Studio at <span className="font-mono text-[12.5px]">{from.url.replace(/^https:\/\//, "")}</span> still works until you delete it from the account it runs on; tell the client to use the new address from now on.</p>}
      <p className="text-sm text-ink-300">Send them the address. They sign in with {made.clientEmails.join(", ")} and the code they get by email. Share sites with them from the card below.</p>
      <div className="flex gap-2"><a className="btn btn-pri" href={made.url} target="_blank" rel="noopener noreferrer">Open it ↗</a><button type="button" className="btn" onClick={() => navigator.clipboard?.writeText(made.url).then(() => toast("Address copied"))}>Copy address</button></div>
    </section>
  );
  return (
    <section className="card flex flex-col gap-4 p-5" aria-label="Add a client Studio">
      <div className="flex items-center"><h3 className="text-[15px] font-extrabold">{from ? `Move ${from.name}'s Studio` : "Add a client Studio"}</h3><button type="button" className="btn btn-ghost btn-sm ml-auto" onClick={onCancel}>Cancel</button></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Client or company name" htmlFor="pt-name"><input id="pt-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Advisory" /></Field>
        <Field label="Client emails (they sign in with these)" htmlFor="pt-emails" hint="Comma-separated. Each becomes an owner of their Studio."><input id="pt-emails" className="input" value={clients} onChange={(e) => setClients(e.target.value)} placeholder="owner@acme.com" /></Field>
        <Field label="Studio ID" htmlFor="pt-id"><input id="pt-id" className="input font-mono" value={id} onChange={(e) => setId(slug(e.target.value))} /></Field>
        <Field label="Address" htmlFor="pt-site" hint={site ? (pagesKind === "netlify" ? `${site}.netlify.app` : `${site}.<account>.workers.dev`) : ""}><input id="pt-site" className="input font-mono" value={site} onChange={(e) => setSite(slug(e.target.value))} /></Field>
        <Field label="Your email (partner access)" htmlFor="pt-me" hint="You keep access to their Studio with it, to share and sync sites."><input id="pt-me" className="input" type="email" value={mine} onChange={(e) => setMine(e.target.value)} /></Field>
      </div>
      <div className="flex flex-col gap-1.5"><span className="label">Runs on</span>
        <div className="flex flex-wrap rounded-lg border border-ink-600 self-start" role="radiogroup" aria-label="Runs on">
          {([["mine", "My accounts"], ["client", "The client's accounts"]] as const).map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={accounts === k} onClick={() => setAccounts(k)} className={`btn btn-sm border-0 ${accounts === k ? "bg-ink-700" : "bg-transparent"}`}>{l}</button>)}
        </div>
        <p className="hint">{accounts === "mine" ? "You host and pay for it; one Cloudflare database (or Supabase project) can hold all your client Studios." : "The client owns the accounts: paste their Cloudflare (or Netlify) token and database token here (used once, not kept). They update their Studio themselves from its Settings → Migration."}</p>
      </div>
      <section aria-label="Hosting" className="flex flex-col gap-2">
        <b className="text-sm">Where their Studio runs {accounts === "mine" ? "(your account)" : "(the client's account)"}</b>
        <div className="flex flex-wrap rounded-lg border border-ink-600 self-start" role="radiogroup" aria-label="Client Studio host">
          {([["cloudflare", "Cloudflare (free)"], ["netlify", "Netlify"]] as const).map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={pagesKind === k} onClick={() => setPagesKind(k)} className={`btn btn-sm border-0 ${pagesKind === k ? "bg-ink-700" : "bg-transparent"}`}>{l}</button>)}
        </div>
        {pagesKind === "netlify" ? <>
          {nf ? <p className="text-[13px] text-emerald-300">Your Netlify is connected{accounts === "client" ? " (it runs the Studio's helper)" : ""}.</p> : <NetlifyAccount session={session} onToken={(t) => setNf(t ? new Netlify(t) : null)} />}
          {accounts === "client" && <Field label="The client's Netlify personal access token" htmlFor="pt-cnf"><input id="pt-cnf" className="input font-mono text-xs" type="password" autoComplete="off" value={clientNfTok} onChange={(e) => setClientNfTok(e.target.value)} /></Field>}
        </> : <>{accounts === "client" && <p className="text-[13px] text-ink-400">Paste the <b>client's</b> Cloudflare token below (made from the same link while signed in to their Cloudflare). It goes through your Studio's helper and isn't kept.</p>}{cfAcc.ui}</>}
      </section>
      <section aria-label="Database" className="flex flex-col gap-2"><b className="text-sm">Where their Studio keeps its files {accounts === "mine" ? "(your account)" : "(the client's account)"}</b>
        <div className="flex flex-wrap rounded-lg border border-ink-600 self-start" role="radiogroup" aria-label="Client database">
          {([["cloudflare", "Cloudflare"], ["supabase", "Supabase"]] as const).map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={`btn btn-sm border-0 ${kind === k ? "bg-ink-700" : "bg-transparent"}`}>{l}</button>)}
        </div>
        <section aria-label={kind === "cloudflare" ? "Cloudflare" : "Supabase"}>{kind === "cloudflare" ? <>{pagesKind !== "cloudflare" && cfAcc.ui}{cf.ui}</> : sb.ui}</section>
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

/** Updating a client Studio's app with no Cloudflare token on this device: through the client's database (its kept
 *  token), else through your own Studio's database, which keeps your Cloudflare tokens for every device (the app's
 *  Worker is registered to your Studio there first, so you can publish it). null when neither keeps a token for it. */
async function clientAppViaDb(p: PartnerRec, myDb: { api: string; studio: string } | null) {
  if (!p.siteId) return null;
  if (p.backend === "cloudflare" && p.api) { const v = await pagesViaDb(p.api, "studio:" + p.studio, p.pagesAccount).catch(() => null); if (v) return v; }
  if (!myDb || !(await cfSignedIn(myDb.api).catch(() => false))) return null;
  const info = await cfDeployInfo(myDb.api);
  const acc = p.pagesAccount || info.account;
  if (!acc) return null;
  // Same database and its main account: the client's scope above is the way; registering here would move it.
  if (myDb.api === p.api && acc === info.account) return null;
  try { await cfxSite(myDb.api, myDb.studio, acc, p.siteId); } catch { return null; } // that account's token isn't kept there
  return pagesViaDb(myDb.api, "studio:" + myDb.studio, acc).catch(() => null);
}

/** A Cloudflare connection for the account a client Studio's app lives on, through a database that keeps its token (same routes as above). */
async function clientCfViaDb(p: PartnerRec, myDb: { api: string; studio: string } | null, only?: string): Promise<{ cf: Cloudflare; account: string } | null> {
  if (!p.siteId) return null;
  if (p.backend === "cloudflare" && p.api && (await cfSignedIn(p.api).catch(() => false))) {
    const info = await cfDeployInfo(p.api), acc = only || p.pagesAccount || info.account;
    if (acc && ((info.deploy && info.account === acc) || info.more)) return { cf: dbCloudflare(p.api, "studio:" + p.studio), account: acc };
  }
  if (!myDb || !(await cfSignedIn(myDb.api).catch(() => false))) return null;
  const info = await cfDeployInfo(myDb.api), acc = only || p.pagesAccount || info.account;
  if (!acc) return null;
  if (!(info.deploy && info.account === acc)) { try { await cfxSite(myDb.api, myDb.studio, acc, p.siteId); } catch { return null; } }
  return { cf: dbCloudflare(myDb.api, "studio:" + myDb.studio), account: acc };
}

const STATE: Record<SiteSync, [string, string]> = {
  same: ["In step", "border-emerald-400/60 text-emerald-200"], mine: ["You changed it", "border-brand-400/60 text-brand-200"],
  theirs: ["Client changed it", "border-amber-400/60 text-amber-200"], both: ["Both changed", "border-rose-400/60 text-rose-200"], gone: ["Missing on one side", "border-ink-500 text-ink-300"],
};

function PartnerCard({ p, studio, index, nf, setNf, session, myEmail, studioToken, partner, onChange, onRemove }: { p: PartnerRec; studio: Studio; index: StudioIndex; nf: Netlify | null; setNf: (n: Netlify | null) => void; session: Session; myEmail: string; studioToken: string; partner: { name: string; url?: string }; onChange: (fn: (p: PartnerRec) => PartnerRec, msg: string) => Promise<void>; onRemove: () => Promise<void> }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [signed, setSigned] = useState<boolean | null>(null), [code, setCode] = useState(""), [sent, setSent] = useState(false);
  const [states, setStates] = useState<Record<string, SiteSync | "checking">>({});
  const [busy, setBusy] = useState(""), [pick, setPick] = useState(""), [latest, setLatest] = useState<string | null>(null);
  // What their Studio shows (kept in their studio.json), and moving their Studio to other accounts.
  const tearOk = useRef(false); // the card goes when the result is closed, so the result can be read first
  const [hide, setHide] = useState<string[] | null>(null), [moving, setMoving] = useState(false), [tear, setTear] = useState(false);
  const [myDb, setMyDb] = useState<{ api: string; studio: string } | null>(null);
  // The Cloudflare token for their account, kept on a database so updates work from any device (opens when an update finds none).
  const [tokOpen, setTokOpen] = useState(false), [tok, setTok] = useState("");
  useEffect(() => { loadHostConfig().then((c) => setMyDb(c?.kind === "cloudflare" ? { api: c.api, studio: c.studio } : null)).catch(() => {}); }, []);
  // Limits: how many themes they can choose from and how many sites of each type they can have ("" = no limit).
  const [lim, setLim] = useState<{ themes: string; portfolio: string; store: string; business: string; restaurant: string; list: Record<string, string[]> }>({ themes: "", portfolio: "", store: "", business: "", restaurant: "", list: {} }), [limSaved, setLimSaved] = useState("");
  useEffect(() => { if (signed) getClientFeatures(remoteRepo(p)).then((f) => { setHide(f.hide); const l = { list: cleanThemeList(f.themeList), themes: f.themes ? String(f.themes) : "", portfolio: f.max?.portfolio != null ? String(f.max.portfolio) : "", store: f.max?.store != null ? String(f.max.store) : "", business: f.max?.business != null ? String(f.max.business) : "", restaurant: f.max?.restaurant != null ? String(f.max.restaurant) : "" }; setLim(l); setLimSaved(JSON.stringify(l)); }).catch(() => setHide([])); }, [signed, p.studio, p.api, p.sbUrl]);
  const featuresNow = (h: string[], l = lim) => { const max: Record<string, number> = {}; for (const k of ["portfolio", "store", "business", "restaurant"] as const) if (l[k].trim() !== "" && +l[k] >= 0) max[k] = Math.floor(+l[k]); const themeList = cleanThemeList(l.list); return { hide: h, ...(+l.themes > 0 ? { themes: Math.floor(+l.themes) } : {}), ...(Object.keys(themeList).length ? { themeList } : {}), ...(Object.keys(max).length ? { max } : {}) }; };
  const toggleFeature = (key: string) => run("feat", async () => { const next = (hide || []).includes(key) ? (hide || []).filter((k) => k !== key) : [...(hide || []), key]; await setClientFeatures(remoteRepo(p), featuresNow(next, JSON.parse(limSaved || JSON.stringify(lim)))); setHide(next); });
  const saveLimits = () => run("lim", async () => { await setClientFeatures(remoteRepo(p), featuresNow(hide || [])); setLimSaved(JSON.stringify(lim)); toast("Limits saved. They apply the next time they open their Studio."); });
  const check = async () => {
    const ok = await partnerSignedIn(p); setSigned(ok); if (!ok) return;
    setStates(Object.fromEntries(p.shared.map((s) => [s.project, "checking"])));
    for (const s of p.shared) { const v = await siteSync(studio, p, s).catch(() => "gone" as const); setStates((m) => ({ ...m, [s.project]: v })); }
  };
  useEffect(() => { check(); source().then(appFiles).then((m) => setLatest(m.build)).catch(() => {}); }, [p.shared.length, p.sbUrl, p.api, p.studio]);
  const run = async (k: string, fn: () => Promise<void>, tokenHelp = false) => { setBusy(k); try { await fn(); } catch (e: any) { if (tokenHelp && (e?.status === 501 || /no Cloudflare token|reaches their Studio/i.test(String(e?.message || "")))) setTokOpen(true); toast(e?.message || "Something went wrong.", "bad"); } setBusy(""); };
  // After a share, send or pull both sides hold the same content.
  const setShared = async (s: SharedSite, msg: string) => { await onChange((x) => ({ ...x, shared: [...x.shared.filter((y) => y.project !== s.project), s] }), msg); setStates((m) => ({ ...m, [s.project]: "same" })); };
  const share = () => run("share", async () => { const m = index.projects.find((x) => x.id === pick); if (!m) return; await setShared(await sendSite(studio, p, m, partner, setBusy), `Share ${m.name} with ${p.name}`); setPick(""); toast(`${m.name} is in ${p.name}'s Studio`); });
  const send = (s: SharedSite) => run(s.project, async () => { const m = index.projects.find((x) => x.id === s.project)!; await setShared(await sendSite(studio, p, m, partner, setBusy), `Send ${m.name} to ${p.name}`); toast("Sent"); });
  const pull = (s: SharedSite) => run(s.project, async () => { const r = await pullSite(studio, p, s.project, setBusy); await setShared(r.shared, `Bring in ${p.name}'s changes`); toast("Brought in the client's version"); });
  const unshare = (s: SharedSite) => run(s.project, async () => { if (!(await confirm("Stop syncing this site?", "It stays in both Studios; changes just aren't kept in step any more.", "Stop syncing"))) return; await onChange((x) => ({ ...x, shared: x.shared.filter((y) => y.project !== s.project) }), "Stop syncing a site"); });
  const updateApp = () => run("app", async () => {
    if (!p.siteId) return;
    const first = await loadPages(p.pages || "netlify", studioToken, p.pagesAccount).catch(() => null);
    const pages = first || (p.pages === "cloudflare" ? await clientAppViaDb(p, myDb) : null);
    if (!pages) throw new Error(p.pages === "cloudflare" ? "No Cloudflare token reaches their Studio's account from this device. On a device that has the token: Settings → Hostings → Hosting accounts → turn on Publish from any device (and add the client's Cloudflare account under Other accounts if it's a different one). Then this works from every device you're signed in on." : `Connect ${PAGES_LABEL[p.pages || "netlify"]} in Settings → Hostings → Hosting accounts first.`);
    try { await deployClientApp(pages, p, "", await source(), partner, setBusy); }
    catch (e: any) {
      // This device's route has no token kept for their account: try the other routes before giving up.
      const alt = first && p.pages === "cloudflare" && (e?.status === 501 || /no Cloudflare token/i.test(String(e?.message || ""))) ? await clientAppViaDb(p, myDb) : null;
      if (!alt) throw e;
      await deployClientApp(alt, p, "", await source(), partner, setBusy);
    }
    toast(`${p.name}'s Studio is updated`);
  }, true);
  /** Keeps the pasted token for their account on their database (or yours), then updates their Studio with it. */
  const saveTokenAndUpdate = () => run("app", async () => {
    const t = tok.trim(); if (!/^[\w-]{20,200}$/.test(t)) throw new Error("Paste the Cloudflare API token for their account (the “Edit Cloudflare Workers” template).");
    if (!p.siteId) return;
    // Try each database that could keep it (theirs, then yours); update through the one that kept it, not just any.
    const dbs = [p.backend === "cloudflare" && p.api ? { api: p.api, studio: p.studio, mine: false } : null, myDb && myDb.api !== p.api ? { ...myDb, mine: true } : null, myDb && myDb.api === p.api ? { ...myDb, mine: true } : null].filter(Boolean) as { api: string; studio: string; mine: boolean }[];
    let last = "";
    const seen = new Set<string>();
    for (const d of dbs) {
      if (seen.has(d.api + "|" + d.studio)) continue; seen.add(d.api + "|" + d.studio);
      try {
        let acc = p.pagesAccount || "";
        try { const r = await cfxPut(d.api, d.studio, t); if (!acc) acc = r.accounts.length === 1 ? r.accounts[0].id : ""; if (!acc && r.accounts.length) acc = r.accounts[0].id; }
        catch (e: any) { if (!/own Cloudflare account/i.test(String(e?.message || ""))) throw e; /* its main token: nothing to keep */ }
        if (!d.mine || !acc) { /* theirs, or this database's main account */ } else await cfxSite(d.api, d.studio, acc, p.siteId);
        const pages = await pagesViaDb(d.api, "studio:" + d.studio, acc || undefined);
        if (!pages) throw new Error("That database can't publish with the token.");
        await deployClientApp(pages, p, "", await source(), partner, setBusy);
        setTok(""); setTokOpen(false); toast(`${p.name}'s Studio is updated`); return;
      } catch (e: any) { last = e?.message || last; }
    }
    throw new Error((last || "Couldn't update.") + " Check that the token was created while signed in to the account their Studio lives on, and that Publish from any device is on for the database (Settings → Hostings).");
  });
  /** Set once a new token is kept on a database: the domain box then works through it (the device's own token lacked the rights). */
  const domForce = useRef("");
  /** The domain box asked for a token that can add domains: kept on their database (or yours) for every device; else used just now. */
  const newDomToken = async (t0: string) => {
    const t = t0.trim(); if (!/^[\w-]{20,200}$/.test(t)) throw new Error("Paste the Cloudflare API token for their account.");
    const dbs = [p.backend === "cloudflare" && p.api ? { api: p.api, studio: p.studio, mine: false } : null, myDb ? { ...myDb, mine: true } : null].filter(Boolean) as { api: string; studio: string; mine: boolean }[];
    for (const d of dbs) {
      try {
        let acc = p.pagesAccount || domCf?.account || "";
        const r = await cfxPut(d.api, d.studio, t); if (r.accounts.length && !r.accounts.some((a) => a.id === acc)) acc = r.accounts[0].id;
        if (d.mine && acc) await cfxSite(d.api, d.studio, acc, p.siteId!).catch(() => null);
        const via = await clientCfViaDb(p, myDb, acc); if (!via) continue;
        domForce.current = acc; setDomCf(via); return;
      } catch { /* try the next database, then this device */ }
    }
    const relay = await getHelper(studioToken, nf).catch(() => null);
    if (relay && domCf) { setDomCf({ cf: new Cloudflare(relay, t), account: domCf.account }); toast("Using that token for the domain now (it isn't kept: it couldn't be saved on a database)."); return; }
    throw new Error("That token couldn't be kept on a database, and this device has no helper to use it directly. If their Studio is on your main Cloudflare account, replace the main token under Settings → Hostings.");
  };
  const [domCf, setDomCf] = useState<{ cf: Cloudflare; account: string } | null | undefined>(undefined);
  useEffect(() => { if (p.accounts === "mine" && p.pages === "cloudflare" && p.siteId) (domForce.current ? clientCfViaDb(p, myDb, domForce.current) : cfLocalClient(studioToken, p.pagesAccount).catch(() => null).then((l) => l || clientCfViaDb(p, myDb))).then(setDomCf).catch(() => setDomCf(null)); }, [p.siteId, p.api, p.pagesAccount, myDb?.api]);
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
      <PayNote id={"partner:" + p.id} pay={p.pay} onSave={(pay) => onChange((x) => { const { pay: _old, ...rest } = x; void _old; const c = cleanPay(pay); return c ? { ...rest, pay: c } : rest; }, `Payment note for ${p.name}`)} />
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
      {signed && hide && (
        <details className="rounded-xl border border-ink-700 px-3 py-2.5 text-[13px]" aria-label={`Features in ${p.name}'s Studio`}>
          <summary className="cursor-pointer select-none font-semibold text-ink-200">Features in their Studio <span className="font-normal text-ink-400">· {hide.length ? `${hide.length} hidden` : "all shown"}</span></summary>
          <p className="mt-2 text-ink-400">Untick what {p.name} shouldn't see. It applies the next time they open their Studio. Migration, Update and Studio Partners are never shown in a client's Studio: you update and move it from this card.</p>
          <div className="mt-2 grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
            {CLIENT_FEATURES.map((f) => <label key={f.key} className="flex items-center gap-2"><input type="checkbox" className="accent-brand-500" checked={!hide.includes(f.key)} disabled={busy === "feat"} onChange={() => toggleFeature(f.key)} /><span>{f.label}{f.hint ? <span className="text-ink-500"> · {f.hint}</span> : null}</span></label>)}
          </div>
          <div className="mt-3 border-t border-ink-700 pt-3" aria-label="Limits">
            <b className="text-ink-200">Limits</b> <span className="text-ink-400">(leave a box empty for no limit)</span>
            <div className="mt-2 grid gap-2 sm:grid-cols-4">
              {([["portfolio", "Portfolio sites"], ["store", "Online shops"], ["business", "Business sites"], ["restaurant", "Restaurant sites"]] as const).map(([k, l]) => (
                <label key={k} className="flex flex-col gap-1"><span className="text-ink-400">{l}</span><input className="input py-1.5" type="number" min={0} max={999} inputMode="numeric" aria-label={l} value={lim[k]} placeholder="no limit" onChange={(e) => setLim({ ...lim, [k]: e.target.value })} /></label>
              ))}
            </div>
            <div className="mt-3 flex flex-col gap-2" aria-label="Themes they can use">
              <b className="text-ink-200">Themes they can use</b>
              <span className="text-ink-400">Choose the themes for each type of site. A type left on “All themes” has no limit. A site already on another theme keeps it.</span>
              {THEME_KINDS.map(({ id, label, pool }) => <ThemePick key={id} label={label} pool={pool} value={lim.list[id] || []} onChange={(ids) => setLim({ ...lim, themes: "", list: { ...lim.list, [id]: ids } })} />)}
              {+lim.themes > 0 && <span className="text-amber-200">This Studio still has the older limit “the first {lim.themes} themes of each type”. Choosing themes above replaces it.</span>}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2"><button type="button" className="btn btn-sm" disabled={busy === "lim" || JSON.stringify(lim) === limSaved} onClick={saveLimits}>{busy === "lim" ? "Saving…" : "Save limits"}</button><span className="text-ink-400">Sites: once they reach the number, that type isn't offered under New project.</span></div>
          </div>
        </details>
      )}
      {tear && <TeardownDialog title={`Remove & delete ${p.name}'s Studio`} name={p.name} plan={partnerPlan(p)}
        keeps="Your own Studio, your projects and your other clients are not touched."
        run={(step) => teardownPartner(p, { studioToken, db: myDb, step })}
        onDone={(r) => { tearOk.current = !r.failed.length; }} onClose={() => { setTear(false); if (tearOk.current) onRemove(); }} />}
      {moving && <AddPartner from={p} nf={nf} setNf={setNf} session={session} index={index} partner={partner} myEmail={myEmail} onCancel={() => setMoving(false)} onDone={async (rec) => { await onChange(() => rec, `Move client Studio ${rec.name}`); }} />}
      {p.accounts === "mine" && p.pages === "cloudflare" && p.siteId && (domCf === undefined ? null : domCf
        ? <CfDomainCard plain={`${p.name}'s Studio address`}
            acc={{ ready: true, account: { id: domCf.account }, client: async () => ({ cf: domCf.cf }), replaceToken: newDomToken }}
            host={{ kind: "cloudflare", siteId: p.siteId, siteName: p.name, url: p.url, account: domCf.account, domain: p.domain, subdomain: p.subdomain, domainSetup: p.domainSetup } as HostCfg}
            onHost={(h) => onChange((x) => ({ ...x, domain: h.domain, subdomain: h.subdomain, domainSetup: h.domainSetup }), h.domain ? `${p.name}'s Studio address: ${h.domain}` : `${p.name}'s Studio address removed`)} />
        : <p className="text-[12.5px] text-ink-400">To give their Studio its own domain, no Cloudflare token reaches its account from this device yet: turn on Publish from any device (Settings → Hostings) or use “Update the Cloudflare token for their account…” below.</p>)}
      {p.accounts === "mine" && p.siteId && (tokOpen
        ? <div className="flex flex-col gap-2 rounded-xl border border-amber-400/40 bg-amber-400/5 p-3 text-[13px]" role="group" aria-label={`Cloudflare token for ${p.name}`}>
            <b>Cloudflare token for {p.name}'s account</b>
            <span className="text-ink-300">Updating their Studio needs a Cloudflare API token for the account it lives on, kept on a database so it works from any device. Press the button, sign in to <b>that</b> account, then Continue → Create Token, and paste the token it shows once.</span>
            <a className="btn btn-sm self-start" href={cfTokenPageFor(p.name)} target="_blank" rel="noopener noreferrer">Create the token on Cloudflare (permissions pre-filled) ↗</a>
            <div className="flex flex-wrap gap-2"><input type="password" autoComplete="off" aria-label="Cloudflare API token" className="input min-w-0 flex-1 font-mono" placeholder="Cloudflare API token" value={tok} onChange={(e) => setTok(e.target.value)} /><button type="button" className="btn btn-pri btn-sm" disabled={!!busy || !tok.trim()} onClick={saveTokenAndUpdate}>{busy === "app" ? "Working…" : "Save token & update"}</button><button type="button" className="btn btn-ghost btn-sm" onClick={() => { setTokOpen(false); setTok(""); }}>Cancel</button></div>
          </div>
        : <button type="button" className="self-start text-[12.5px] text-brand-300 underline" onClick={() => setTokOpen(true)}>Update the Cloudflare token for their account…</button>)}
      <div className="flex flex-wrap items-center gap-2 border-t border-ink-700 pt-3 text-[13px] text-ink-400">
        {!moving && <button type="button" className="btn btn-sm" disabled={!!busy} title="Copies their Studio (projects, photos, settings) to another account, yours or the client's own, and updates this card." onClick={() => setMoving(true)}>Move their Studio…</button>}
        {p.accounts === "mine" && p.siteId ? <button type="button" className="btn btn-sm" disabled={!!busy} onClick={updateApp}>{busy === "app" ? "Updating…" : `Update their Studio${latest ? ` to ${latest}` : ""}`}</button> : <span>The client updates their Studio from its Settings → Migration.</span>}
        {busy && !["app", "share", "in", "refresh"].includes(busy) && !p.shared.some((s) => s.project === busy) && <span>{busy}…</span>}
        <button type="button" className="btn btn-ghost btn-sm ml-auto" onClick={() => confirm(`Remove ${p.name} from Studio Partners?`, "Their Studio keeps working; this only removes the card here.", "Remove", true).then((y) => { if (y) onRemove(); })}>Remove card</button>
        <button type="button" className="btn btn-danger btn-sm" disabled={!!busy || !signed} title={signed ? "Deletes their Studio everywhere: its app, its projects and its sign-ins." : "Sign in to their Studio above first, so its data can be deleted."} onClick={() => setTear(true)}>Remove &amp; delete</button>
      </div>
    </section>
  );
}
