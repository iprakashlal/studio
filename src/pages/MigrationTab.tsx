// Settings → Migration: move the whole Studio to Cloudflare or Netlify, with its files in Cloudflare or Supabase,
// in a few clicks, from the Studio itself.
// On a moved Studio, the same tab shows where it runs and updates it to the latest Studio build.
import { backendOf, isHosted } from "../lib/backend";
import { cfAddMembers, cfCall } from "../lib/cfdb";
import { useCfAccount, useCloudflarePicker, type CfAccountHook } from "./CfPicker";
import { cloudflarePages, netlifyPages, pagesViaDb, PAGES_LABEL, type Pages, type PagesKind } from "../lib/pages";
import { SbTokenHelp } from "./SbTokenHelp";
import { useEffect, useState } from "react";
import type { Session } from "../lib/auth";
import { netlifyToken } from "../lib/hosting";
import { Netlify } from "../lib/netlify";
import { useHelper } from "./HelperBox";
import { SB_TOKENS_PAGE, SupaMgmt, refOf, sbMgmtVault, type SbOrg, type SbProject } from "../lib/supamgmt";
import { loadHostConfig, type HostedStudio, type StudioHostCfg } from "../lib/studiohost";
import { appBase, appFiles, deployStudioApp, prepareSupabase, transferFiles } from "../lib/migrate";
import type { Studio, StudioIndex } from "../lib/studio";
import { jsonB64 } from "../lib/repo";
import { useBrand } from "../lib/brand";
import { STUDIO_BUILD } from "../build-info";
import { Field, Spinner, useToast } from "../ui/kit";
import { NetlifyAccount } from "./HostDialog";
import { BringAcross } from "./BringAcross";
import { autoUpdatePref } from "../lib/autoupdate";

const slug = (s: string) => String(s || "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);
type Phase = "setup" | "code" | "moving" | "done";

/** The Supabase access token and project choice, shared by Migration and Studio Partners. */
export function useSupabasePicker(studioToken: string, nf: Netlify | null, persist = true) {
  const [tok, setTok] = useState(""), [saved, setSaved] = useState(false);
  const [projects, setProjects] = useState<SbProject[] | null>(null), [orgs, setOrgs] = useState<SbOrg[]>([]);
  const [pick, setPick] = useState(""), [org, setOrg] = useState(""), [region, setRegion] = useState<"apac" | "emea" | "americas">("apac"), [name, setName] = useState("studio");
  const [busy, setBusy] = useState(""), [err, setErr] = useState("");
  useEffect(() => { if (!persist) { setTok(""); setSaved(false); setProjects(null); return; } sbMgmtVault.load(studioToken).then((v) => { if (v?.token) { setTok(v.token); setSaved(true); } }); }, [studioToken, persist]);
  const h = useHelper(studioToken, nf, "Supabase");
  const mgmt = async () => new SupaMgmt(await h.get(setBusy), tok.trim());
  const connect = async () => {
    setErr(""); setBusy("Connecting");
    try {
      const m = await mgmt(); setBusy("Reading your projects");
      const [ps, os] = await Promise.all([m.projects(), m.orgs()]);
      setProjects(ps); setOrgs(os); setOrg(os[0]?.id || "");
      const ok = ps.find((p) => p.status === "ACTIVE_HEALTHY"); setPick(ok ? refOf(ok) : "new");
      if (persist) { await sbMgmtVault.save({ token: tok.trim() }, studioToken); setSaved(true); }
    } catch (e: any) { setErr(e?.message || "Couldn't reach Supabase."); }
    setBusy("");
  };
  useEffect(() => { if (saved && tok && h.ready && !projects && !busy) connect(); }, [saved, h.ready]);
  /** The chosen project's ref, creating the project first when "new" is chosen. */
  const ensure = async (step: (s: string) => void): Promise<{ m: SupaMgmt; ref: string }> => {
    const m = await mgmt();
    if (pick !== "new") return { m, ref: pick };
    const o = orgs.find((x) => x.id === org); if (!o) throw new Error("Choose the Supabase organisation for the new project.");
    step("Creating the Supabase project"); const p = await m.createProject(name.trim() || "studio", o, region);
    return { m, ref: refOf(p) };
  };
  const ui = (
    <div className="flex flex-col gap-2.5 text-[13px]">
      <p><a className="btn btn-sm btn-pri" href={SB_TOKENS_PAGE} target="_blank" rel="noopener noreferrer">Open Supabase → Access tokens ↗</a> <span className="text-ink-400">Press <b>Generate new token</b>, copy it and paste it here. {persist ? "It's kept encrypted on this device only." : "Used now only, not kept."}</span></p>
          <SbTokenHelp />
      {h.ui}
      <div className="flex gap-2">
        <input aria-label="Supabase access token" className="input min-w-0 flex-1 font-mono text-xs" type="password" autoComplete="off" placeholder="sbp_…" value={tok} onChange={(e) => { setTok(e.target.value); setSaved(false); setProjects(null); }} />
        <button type="button" className="btn btn-sm" disabled={!tok.trim() || !!busy || !h.ready} onClick={connect}>{busy && !projects ? busy + "…" : "Connect"}</button>
      </div>
      {projects && (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1 sm:col-span-2"><span className="label">Supabase project</span>
            <select className="input" aria-label="Supabase project" value={pick} onChange={(e) => setPick(e.target.value)}>
              {projects.map((p) => <option key={refOf(p)} value={refOf(p)}>{p.name} · {refOf(p)}{p.status !== "ACTIVE_HEALTHY" ? ` (${p.status.toLowerCase().replace(/_/g, " ")})` : ""}</option>)}
              <option value="new">＋ Create a new free project</option>
            </select>
          </label>
          {pick === "new" && <>
            <label className="flex flex-col gap-1"><span className="label">Organisation</span><select className="input" value={org} onChange={(e) => setOrg(e.target.value)}>{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
            <label className="flex flex-col gap-1"><span className="label">Region</span><select className="input" value={region} onChange={(e) => setRegion(e.target.value as any)}><option value="apac">Asia-Pacific</option><option value="emea">Europe</option><option value="americas">Americas</option></select></label>
            <label className="flex flex-col gap-1 sm:col-span-2"><span className="label">Project name</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></label>
          </>}
        </div>
      )}
      {err && <p role="alert" className="text-red-300">{err}</p>}
    </div>
  );
  return { ui, ready: !!projects && (pick !== "new" || !!org), ensure, setName, busy };
}

/** `update`: a moved Studio's own updates. `move` (Migration): put this Studio, its app and its projects, on
 *  another service; from GitHub, or from a Studio already on Cloudflare or Netlify (to another database or host). */
export function MigrationTab({ studio, index, session, onIndex, mode = "move" }: { studio: Studio; index: StudioIndex; session: Session; onIndex: (i: StudioIndex) => void; mode?: "update" | "move" }) {
  const hostedHere = isHosted(session);
  const [nf, setNf] = useState<Netlify | null | undefined>(undefined);
  useEffect(() => { netlifyToken.load(session.token).then((t) => setNf(t ? new Netlify(t.token) : null)); }, [session.token]);
  if (nf === undefined) return <Spinner label="Checking Netlify…" />;
  return hostedHere && mode === "update" ? <HostedHere session={session} nf={nf} setNf={setNf} index={index} /> : <MoveStudio studio={studio} index={index} session={session} nf={nf} setNf={setNf} onIndex={onIndex} hosted={hostedHere} />;
}

function MoveStudio({ studio, index, session, nf, setNf, onIndex, hosted = false }: { studio: Studio; index: StudioIndex; session: Session; nf: Netlify | null; setNf: (n: Netlify | null) => void; onIndex: (i: StudioIndex) => void; hosted?: boolean }) {
  const toast = useToast();
  const brand = useBrand();
  const sb = useSupabasePicker(session.token, nf);
  // From a moved Studio, `here` is where it runs now; a move goes somewhere new (prev is only the GitHub Studio's earlier move).
  const here = hosted ? index.hosted : undefined;
  const prev = hosted ? undefined : index.hosted;
  const [srcCfg, setSrcCfg] = useState<StudioHostCfg | null>(null);
  useEffect(() => { if (hosted) loadHostConfig().then((c) => { setSrcCfg(c); if (c?.studio) setId(c.studio); }); }, [hosted]);
  const [keepAddress, setKeepAddress] = useState(true);
  const [kind, setKind] = useState<"supabase" | "cloudflare">(prev?.backend || "cloudflare");
  const [pagesKind, setPagesKind] = useState<PagesKind>(prev ? prev.pages || "netlify" : "cloudflare");
  const cfAcc = useCfAccount(session.token, nf, true);
  const cf = useCloudflarePicker(session.token, nf, true, brand.name, cfAcc);
  const pagesOk = pagesKind === "netlify" ? !!nf : cfAcc.ready;
  const getPages = () => pagesFrom(pagesKind, nf, cfAcc, prev?.pages === pagesKind ? prev?.account : undefined, setStep);
  const [id, setId] = useState(prev?.studio || slug(brand.name) || "studio");
  const [siteName, setSiteName] = useState(prev?.siteName || here?.siteName || (/studio$/.test(slug(brand.name)) ? slug(brand.name) : `${slug(brand.name) || "my"}-studio`));
  const [email, setEmail] = useState(() => prev?.owner || (hosted ? session.username : "") || (() => { try { return localStorage.getItem("site-studio:host-email") || ""; } catch { return ""; } })());
  // Updating an existing moved Studio never copies data by default: its projects may be newer than these.
  const [withData, setWithData] = useState(!prev);
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => { studio.repo.list("").then((l) => setCount(l.filter((p) => !p.startsWith(".")).length)).catch(() => setCount(null)); }, []);
  const [phase, setPhase] = useState<Phase>("setup"), [step, setStep] = useState(""), [err, setErr] = useState("");
  const [target, setTarget] = useState<StudioHostCfg | null>(null), [code, setCode] = useState("");
  const [result, setResult] = useState<HostedStudio | null>(null);
  useEffect(() => { sb.setName(`${id}-studio`); }, [id]);
  const ok = pagesOk && (kind === "cloudflare" ? cf.ready : sb.ready) && /^[a-z0-9][a-z0-9-]{1,29}$/.test(id) && /^[a-z0-9][a-z0-9-]{1,40}$/.test(siteName) && /@/.test(email);

  // 1: Supabase ready and a sign-in code on its way.
  const start = async () => {
    setErr(""); setPhase("setup");
    try {
      let t: StudioHostCfg;
      if (kind === "cloudflare") {
        const { setup, relay, token } = await cf.ensure(setStep);
        if (hosted && srcCfg?.kind === "cloudflare" && srcCfg.api.replace(/\/+$/, "") === setup.api.replace(/\/+$/, "") && srcCfg.studio === id) throw new Error("That's the database this Studio already uses. Pick another Cloudflare account, or change the Studio ID to make a separate copy.");
        // The people who can sign in here come along too (from a Studio on the Cloudflare database).
        const people: { email: string; role: "owner" | "member" | "partner" }[] = [];
        if (hosted && srcCfg?.kind === "cloudflare") { setStep("Reading who can sign in to this Studio"); for (const m of await cfCall<any[]>(srcCfg.api, "/m?scope=" + encodeURIComponent("studio:" + srcCfg.studio)).catch(() => [])) if (m?.email) people.push({ email: String(m.email), role: ["owner", "member", "partner"].includes(m.role) ? m.role : "member" }); }
        setStep("Making you the Studio's owner"); await cfAddMembers(relay, token, setup, "studio:" + id, [...people.filter((m) => m.email !== email.trim().toLowerCase()), { email: email.trim().toLowerCase(), role: "owner" }]);
        t = { kind: "cloudflare", api: setup.api, studio: id, name: brand.name };
      } else {
        const { m, ref } = await sb.ensure(setStep);
        const s = await prepareSupabase(m, ref, id, email.trim().toLowerCase(), setStep);
        t = { kind: "supabase", url: s.url, key: s.key, studio: id, name: brand.name };
      }
      setTarget(t);
      setStep("Sending you a sign-in code"); await backendOf(t).sendCode(email.trim());
      setPhase("code");
    } catch (e: any) { setErr(e?.message || "Something went wrong."); }
    setStep("");
  };
  // 2: signed in to the new Studio: move the files, put the app on Netlify.
  const finish = async () => {
    if (!target || !pagesOk) return;
    setErr(""); setPhase("moving");
    try {
      const be = backendOf(target);
      setStep("Checking the code"); await be.verifyCode(email.trim(), code);
      const dest = be.repo(id);
      if (withData) {
        const n = await transferFiles(studio.repo, dest, (d, t, p) => setStep(`Copying your Studio's files (${d} of ${t})${p ? " · " + p : ""}`));
        // Check every file arrived before pointing the app at the new place.
        setStep("Checking the copy"); const got = new Set(await dest.list("")); const missing = (await studio.repo.list("")).filter((p) => !p.startsWith(".") && !got.has(p));
        if (missing.length) throw new Error(`${missing.length} of ${n} files didn't arrive (for example ${missing[0]}). Nothing was switched; press Finish moving to try again.`);
      }
      const reuse = hosted ? (keepAddress && here && (here.pages || "netlify") === pagesKind ? here.siteId : undefined) : prev && (prev.pages || "netlify") === pagesKind ? prev.siteId : undefined;
      const source = hosted ? srcCfg?.source || appBase() : appBase();
      const app = await deployStudioApp(await getPages(), { siteId: reuse, siteName, source, config: target }, setStep);
      const rec: HostedStudio = { url: app.url, siteId: app.siteId, siteName, pages: app.kind, ...(app.account ? { account: app.account } : {}), backend: target.kind, ...(target.kind === "cloudflare" ? { api: target.api } : { sbUrl: target.url }), studio: id, owner: email.trim().toLowerCase(), build: app.build, at: new Date().toISOString() };
      setStep("Recording where the Studio moved");
      const cur = await dest.getJSON<any>("studio.json").catch(() => null);
      await dest.putFile("studio.json", jsonB64({ ...(cur?.data || { version: 1, categories: [], projects: [] }), hosted: rec }), "Moved", cur?.sha);
      onIndex(await studio.updateIndex((i) => { i.hosted = rec; }, `Moved the Studio to ${PAGES_LABEL[app.kind]} + ${be.label}`));
      setResult(rec); setPhase("done"); toast(`Your Studio is on ${PAGES_LABEL[app.kind]}`);
    } catch (e: any) { setErr(e?.message || "Something went wrong."); setPhase("code"); }
    setStep("");
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="card flex flex-col gap-2 p-5">
        <h2 className="text-lg font-extrabold">{hosted ? "Move this Studio to another service" : "Move the Studio outside GitHub"}</h2>
        {hosted && here && <p className="rounded-lg border border-sky-400/30 bg-sky-400/5 px-3 py-2.5 text-[13px] text-sky-100">This Studio runs at <a className="underline" href={here.url} target="_blank" rel="noopener noreferrer">{here.url}</a> with its projects in {here.backend === "cloudflare" ? "your Cloudflare database" : "Supabase"}. Moving copies the app, your projects, photos, settings and the people who can sign in to the new place and checks the copy, then switches the app over. The current database is left as it is, so you can go back.</p>}
        <p className="text-sm text-ink-300">Puts this whole Studio on <b className="text-ink-100">your Cloudflare</b> (free, no traffic limit) or <b className="text-ink-100">your Netlify</b>, with its projects, content and photos in <b className="text-ink-100">your Cloudflare</b> (a free D1 database) or <b className="text-ink-100">your Supabase</b>. You sign in there with a 6-digit code sent to your email, no GitHub token needed. This Studio keeps working until you stop using it.</p>
        <p className="text-[13px] text-ink-400">Setting up Studios for clients (B2B)? Each client gets their own Studio, on your accounts or theirs, with the sites you share kept in step: <a className="text-brand-300 underline" href="#/settings/partners">Studio Partners →</a></p>
        {prev && phase !== "done" && <p className="rounded-lg border border-emerald-400/30 bg-emerald-400/5 px-3 py-2.5 text-[13px] text-emerald-100">Moved before to <a className="underline" href={prev.url} target="_blank" rel="noopener noreferrer">{prev.url}</a>. Running it again updates that Studio to this build{withData ? " and copies your files again" : ""}.</p>}
      </section>
      <section className="card flex flex-col gap-3 p-5" aria-label="Hosting">
        <h3 className="text-[15px] font-extrabold">1 · Where the Studio runs</h3>
        <div className="flex flex-wrap rounded-lg border border-ink-600 self-start" role="radiogroup" aria-label="Studio host">
          {([["cloudflare", "Cloudflare (free, unlimited traffic)"], ["netlify", "Netlify"]] as const).map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={pagesKind === k} disabled={phase !== "setup"} onClick={() => setPagesKind(k)} className={`btn btn-sm border-0 ${pagesKind === k ? "bg-ink-700" : "bg-transparent"}`}>{l}</button>)}
        </div>
        {pagesKind === "netlify" ? (nf ? <p className="text-sm text-emerald-300">Netlify connected.</p> : <NetlifyAccount session={session} onToken={(t) => setNf(t ? new Netlify(t) : null)} />)
          : cfAcc.ui}
      </section>
      <section className="card flex flex-col gap-3 p-5" aria-label="Database">
        <h3 className="text-[15px] font-extrabold">2 · Where its files live</h3>
        <div className="flex flex-wrap rounded-lg border border-ink-600 self-start" role="radiogroup" aria-label="Database">
          {([["cloudflare", "Cloudflare (free, then ₹470/month)"], ["supabase", "Supabase (free, then ₹2,360/month)"]] as const).map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={kind === k} disabled={!!prev && phase !== "setup"} onClick={() => setKind(k)} className={`btn btn-sm border-0 ${kind === k ? "bg-ink-700" : "bg-transparent"}`}>{l}</button>)}
        </div>
        <p className="hint">{kind === "cloudflare" ? "A D1 database and a Worker on your Cloudflare. Never pauses; sign-in codes are emailed through Resend." : "A Supabase project. Free projects pause after a week without use."}</p>
        <section aria-label={kind === "cloudflare" ? "Cloudflare" : "Supabase"}>{kind === "cloudflare" ? <>{pagesKind !== "cloudflare" && cfAcc.ui}{cf.ui}</> : sb.ui}</section>
      </section>
      <section className="card flex flex-col gap-3 p-5" aria-label="Your Studio">
        <h3 className="text-[15px] font-extrabold">3 · Your Studio</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Studio ID" htmlFor="mg-id" hint="Names this Studio's files in its database."><input id="mg-id" className="input font-mono" value={id} disabled={!!prev} onChange={(e) => setId(slug(e.target.value))} /></Field>
          <Field label="Address" htmlFor="mg-site" hint={pagesKind === "netlify" ? `${siteName}.netlify.app (add your own domain in Netlify later)` : `${siteName}.<you>.workers.dev (add your own domain in Cloudflare later)`}><input id="mg-site" className="input font-mono" value={siteName} disabled={!!prev} onChange={(e) => setSiteName(slug(e.target.value))} /></Field>
          <Field label="Your email" htmlFor="mg-email" hint="You sign in with it; it becomes the Studio's owner."><input id="mg-email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        </div>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 accent-brand-400" checked={withData} onChange={(e) => setWithData(e.target.checked)} />
          <span><b>Transfer my Studio data</b> <span className="text-ink-400">— projects, content, photos, export history and settings{count != null ? ` (${count} files)` : ""}. Untick to start the new Studio empty.</span>{prev && withData && <span className="mt-1 block rounded-md border border-amber-400/40 bg-amber-400/10 px-2 py-1.5 text-amber-100">This replaces the moved Studio's projects with this Studio's copies, including any newer changes made there. To bring over only what's missing, use <b>Projects in both Studios</b> below instead.</span>}</span></label>
      </section>

      {!hosted && prev?.backend === "cloudflare" && prev.api && phase === "setup" && <BringAcross here={studio} prev={prev} />}
      {hosted && here && phase === "setup" && (here.pages || "netlify") === pagesKind && (
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 accent-brand-400" checked={keepAddress} onChange={(e) => setKeepAddress(e.target.checked)} />
          <span><b>Keep this Studio's address</b> <span className="text-ink-400">— {here.url.replace(/^https:\/\//, "")} and your own domain stay the same; only where the projects live changes. Untick to put the Studio on a new address too.</span></span></label>
      )}
      {phase === "setup" && <button type="button" className="btn btn-pri self-start" disabled={!ok || !!step || !!sb.busy || !!cf.busy} onClick={start}>{step ? step + "…" : prev ? "Update the moved Studio" : "Move my Studio"}</button>}
      {(phase === "code" || phase === "moving") && (
        <section className="card flex flex-col gap-3 p-5" aria-label="Confirm your email">
          <p className="text-sm text-ink-300">{kind === "cloudflare" ? "Cloudflare" : "Supabase"} is ready. Enter the 6-digit code sent to <b className="text-ink-100">{email}</b> (check spam too), then the Studio moves.</p>
          <div className="flex flex-wrap gap-2">
            <input aria-label="Code from the email" className="input w-36 font-mono text-lg tracking-widest" inputMode="numeric" maxLength={10} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
            <button type="button" className="btn btn-pri" disabled={code.length < 6 || phase === "moving"} onClick={finish}>{phase === "moving" ? step + "…" : "Finish moving"}</button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={phase === "moving"} onClick={() => target && backendOf(target).sendCode(email.trim()).then(() => toast("New code sent")).catch((e: any) => toast(e?.message || "Couldn't send", "bad"))}>Send a new code</button>
          </div>
        </section>
      )}
      {step && phase === "setup" && <p className="text-[13px] text-ink-400" role="status">{step}…</p>}
      {err && <p role="alert" className="text-sm text-red-300">{err}</p>}
      {phase === "done" && result && (
        <section className="card flex flex-col gap-2 border-emerald-400/40 p-5" aria-label="Moved">
          <h3 className="text-[15px] font-extrabold text-emerald-200">✓ Your Studio is on {PAGES_LABEL[result.pages || "netlify"]} + {result.backend === "cloudflare" ? "Cloudflare" : "Supabase"}</h3>
          <p className="text-sm text-ink-300">Open it, sign in with <b className="text-ink-100">{result.owner}</b> and the code you'll get by email. Add your own domain whenever you like ({result.pages === "cloudflare" ? "Cloudflare → the Worker → Settings → Domains & Routes" : "Netlify → Domain management"}).</p>
          <a className="btn btn-pri self-start" href={result.url} target="_blank" rel="noopener noreferrer">Open your new Studio ↗</a>
          <p className="hint">Your hosting tokens (GitHub publishing, Netlify, Cloudflare…) stay on each device, so add them once in the new Studio's Settings → Hosting accounts.</p>
        </section>
      )}
    </div>
  );
}

function HostedHere({ session, nf, setNf, index }: { session: Session; nf: Netlify | null; setNf: (n: Netlify | null) => void; index: StudioIndex }) {
  const toast = useToast();
  const where: PagesKind = index.hosted?.pages || "netlify";
  const cfAcc = useCfAccount(session.token, nf, true);
  const [viaDb, setViaDb] = useState<Pages | null>(null);
  const pagesOk = where === "netlify" ? !!nf : cfAcc.ready || !!viaDb;
  const [cfg, setCfg] = useState<StudioHostCfg | null>(null), [latest, setLatest] = useState<string | null>(null), [mine, setMine] = useState<string | null>(null);
  const [step, setStep] = useState(""), [err, setErr] = useState("");
  const [auto, setAuto] = useState(autoUpdatePref.on);
  useEffect(() => { loadHostConfig().then((c) => { setCfg(c); if (c?.source) appFiles(c.source).then((m) => setLatest(m.build)).catch(() => setLatest(null)); }); appFiles(appBase()).then((m) => setMine(m.build)).catch(() => setMine(STUDIO_BUILD.id)); }, []);
  // Without the token here, the Studio updates itself through its own database (Publish from any device).
  useEffect(() => { if (where === "cloudflare" && !cfAcc.ready && cfg?.kind === "cloudflare") pagesViaDb(cfg.api, "studio:" + cfg.studio).then(setViaDb).catch(() => setViaDb(null)); }, [where, cfAcc.ready, cfg?.kind]);
  const update = async () => {
    if (!pagesOk || !cfg?.source) return;
    setErr("");
    try {
      const siteId = index.hosted?.siteId;
      if (!siteId) throw new Error(`Couldn't find this Studio's site on the connected ${PAGES_LABEL[where]} account.`);
      await deployStudioApp(!cfAcc.ready && viaDb ? viaDb : await pagesFrom(where, nf, cfAcc, index.hosted?.account, setStep), { siteId, siteName: "", source: cfg.source, config: cfg }, setStep);
      toast("Updated. Reloading…"); setTimeout(() => location.reload(), 1200);
    } catch (e: any) { setErr(e?.message || "Couldn't update."); }
    setStep("");
  };
  return (
    <div className="flex flex-col gap-4">
      <section className="card flex flex-col gap-2 p-5">
        <h2 className="text-lg font-extrabold">This Studio runs on {PAGES_LABEL[where]} + {cfg?.kind === "cloudflare" ? "Cloudflare" : "Supabase"}</h2>
        <p className="text-sm text-ink-300">Studio <b className="text-ink-100">{cfg?.studio}</b> · files in <code className="font-mono text-xs">{cfg ? (cfg.kind === "cloudflare" ? cfg.api : cfg.url) : ""}</code> · signed in as <b className="text-ink-100">{session.username}</b>.</p>
      </section>
      <section className="card flex flex-col gap-3 p-5" aria-label="Update">
        <h3 className="text-[15px] font-extrabold">Studio updates</h3>
        <p className="text-sm text-ink-300">This Studio: build <code className="font-mono text-xs">{mine || "…"}</code>. Latest: <code className="font-mono text-xs">{latest || "…"}</code>{latest && mine && latest === mine ? " · up to date" : ""}.</p>
        {where === "netlify" ? !nf && <NetlifyAccount session={session} onToken={(t) => setNf(t ? new Netlify(t) : null)} /> : !cfAcc.ready && (viaDb ? <p className="text-sm text-emerald-300">Updates go through your Cloudflare database: no token needed on this device.</p> : cfAcc.ui)}
        <button type="button" className="btn btn-pri self-start" disabled={!pagesOk || !cfg?.source || !!step || (!!latest && latest === mine)} onClick={update}>{step ? step + "…" : "Update to the latest Studio"}</button>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 accent-brand-400" checked={auto} onChange={(e) => { autoUpdatePref.set(e.target.checked); setAuto(e.target.checked); }} />
          <span><b>Update automatically</b> <span className="text-ink-400">— when this Studio opens on this device and a newer build is out, it updates itself (your projects aren't touched). Needs the Cloudflare token on this device, or Publish from any device turned on.</span></span></label>
        {err && <p role="alert" className="text-sm text-red-300">{err}</p>}
      </section>
    </div>
  );
}

/** The chosen host, ready to deploy to (Cloudflare through the Studio's helper). */
export async function pagesFrom(kind: PagesKind, nf: Netlify | null, acc: CfAccountHook, account?: string, step?: (s: string) => void): Promise<Pages> {
  if (kind === "netlify") { if (!nf) throw new Error("Connect Netlify first."); return netlifyPages(nf); }
  const c = await acc.client(step);
  return cloudflarePages(c.cf, account || c.account.id, c.account.name);
}
