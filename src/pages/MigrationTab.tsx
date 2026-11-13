// Settings → Migration: move the whole Studio to Netlify + Supabase in a few clicks, from the Studio itself.
// On a moved Studio, the same tab shows where it runs and updates it to the latest Studio build.
import { SbTokenHelp } from "./SbTokenHelp";
import { useEffect, useState } from "react";
import type { Session } from "../lib/auth";
import { netlifyToken } from "../lib/hosting";
import { Netlify } from "../lib/netlify";
import { RELAY_VERSION, relayVault, setupRelay, type Relay } from "../lib/relay";
import { SB_TOKENS_PAGE, SupaMgmt, refOf, sbMgmtVault, type SbOrg, type SbProject } from "../lib/supamgmt";
import { sendCode, verifyCode, sbClient } from "../lib/supa";
import { StudioSbRepo, loadHostConfig, type HostedStudio, type StudioHostCfg } from "../lib/studiohost";
import { appBase, appFiles, deployStudioApp, prepareSupabase, transferFiles } from "../lib/migrate";
import type { Studio, StudioIndex } from "../lib/studio";
import { jsonB64 } from "../lib/repo";
import { useBrand } from "../lib/brand";
import { STUDIO_BUILD } from "../build-info";
import { Field, Spinner, useToast } from "../ui/kit";
import { NetlifyAccount } from "./HostDialog";

const slug = (s: string) => String(s || "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);
type Phase = "setup" | "code" | "moving" | "done";

/** The Supabase access token and project choice, shared by Migration and Studio Partners. */
export function useSupabasePicker(studioToken: string, nf: Netlify | null, persist = true) {
  const [tok, setTok] = useState(""), [saved, setSaved] = useState(false);
  const [projects, setProjects] = useState<SbProject[] | null>(null), [orgs, setOrgs] = useState<SbOrg[]>([]);
  const [pick, setPick] = useState(""), [org, setOrg] = useState(""), [region, setRegion] = useState<"apac" | "emea" | "americas">("apac"), [name, setName] = useState("studio");
  const [busy, setBusy] = useState(""), [err, setErr] = useState("");
  useEffect(() => { if (!persist) { setTok(""); setSaved(false); setProjects(null); return; } sbMgmtVault.load(studioToken).then((v) => { if (v?.token) { setTok(v.token); setSaved(true); } }); }, [studioToken, persist]);
  const helper = async (): Promise<Relay> => {
    const r = await relayVault.load(studioToken);
    if (r && r.v === RELAY_VERSION) return r;
    if (!nf) throw new Error("Connect Netlify first: the Studio's helper on your Netlify talks to Supabase for you.");
    return setupRelay(nf, studioToken, r, setBusy);
  };
  const mgmt = async () => new SupaMgmt(await helper(), tok.trim());
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
  useEffect(() => { if (saved && tok && nf && !projects && !busy) connect(); }, [saved, nf]);
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
      <div className="flex gap-2">
        <input aria-label="Supabase access token" className="input min-w-0 flex-1 font-mono text-xs" type="password" autoComplete="off" placeholder="sbp_…" value={tok} onChange={(e) => { setTok(e.target.value); setSaved(false); setProjects(null); }} />
        <button type="button" className="btn btn-sm" disabled={!tok.trim() || !!busy || !nf} onClick={connect}>{busy && !projects ? busy + "…" : "Connect"}</button>
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

export function MigrationTab({ studio, index, session, onIndex }: { studio: Studio; index: StudioIndex; session: Session; onIndex: (i: StudioIndex) => void }) {
  const hostedHere = session.cfg.owner === "supabase";
  const [nf, setNf] = useState<Netlify | null | undefined>(undefined);
  useEffect(() => { netlifyToken.load(session.token).then((t) => setNf(t ? new Netlify(t.token) : null)); }, [session.token]);
  if (nf === undefined) return <Spinner label="Checking Netlify…" />;
  return hostedHere ? <HostedHere session={session} nf={nf} setNf={setNf} index={index} /> : <MoveStudio studio={studio} index={index} session={session} nf={nf} setNf={setNf} onIndex={onIndex} />;
}

function MoveStudio({ studio, index, session, nf, setNf, onIndex }: { studio: Studio; index: StudioIndex; session: Session; nf: Netlify | null; setNf: (n: Netlify | null) => void; onIndex: (i: StudioIndex) => void }) {
  const toast = useToast();
  const brand = useBrand();
  const sb = useSupabasePicker(session.token, nf);
  const prev = index.hosted;
  const [id, setId] = useState(prev?.studio || slug(brand.name) || "studio");
  const [siteName, setSiteName] = useState(prev?.siteName || (/studio$/.test(slug(brand.name)) ? slug(brand.name) : `${slug(brand.name) || "my"}-studio`));
  const [email, setEmail] = useState(() => prev?.owner || (() => { try { return localStorage.getItem("site-studio:host-email") || ""; } catch { return ""; } })());
  const [withData, setWithData] = useState(true);
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => { studio.repo.list("").then((l) => setCount(l.filter((p) => !p.startsWith(".")).length)).catch(() => setCount(null)); }, []);
  const [phase, setPhase] = useState<Phase>("setup"), [step, setStep] = useState(""), [err, setErr] = useState("");
  const [target, setTarget] = useState<{ url: string; key: string } | null>(null), [code, setCode] = useState("");
  const [result, setResult] = useState<HostedStudio | null>(null);
  useEffect(() => { sb.setName(`${id}-studio`); }, [id]);
  const ok = !!nf && sb.ready && /^[a-z0-9][a-z0-9-]{1,29}$/.test(id) && /^[a-z0-9][a-z0-9-]{1,40}$/.test(siteName) && /@/.test(email);

  // 1: Supabase ready and a sign-in code on its way.
  const start = async () => {
    setErr(""); setPhase("setup");
    try {
      const { m, ref } = await sb.ensure(setStep);
      const t = await prepareSupabase(m, ref, id, email.trim().toLowerCase(), setStep);
      setTarget(t);
      setStep("Sending you a sign-in code"); await sendCode(t, email.trim());
      setPhase("code");
    } catch (e: any) { setErr(e?.message || "Something went wrong."); }
    setStep("");
  };
  // 2: signed in to the new Studio: move the files, put the app on Netlify.
  const finish = async () => {
    if (!target || !nf) return;
    setErr(""); setPhase("moving");
    try {
      setStep("Checking the code"); await verifyCode(target, email.trim(), code);
      const dest = new StudioSbRepo(target, id, sbClient(target));
      if (withData) await transferFiles(studio.repo, dest, (d, t, p) => setStep(`Moving your Studio's files (${d} of ${t})${p ? " · " + p : ""}`));
      const cfg: StudioHostCfg = { kind: "supabase", url: target.url, key: target.key, studio: id, name: brand.name };
      const app = await deployStudioApp(nf, { siteId: prev?.siteId, siteName, source: appBase(), config: cfg }, setStep);
      const rec: HostedStudio = { url: app.url, siteId: app.siteId, siteName, sbUrl: target.url, studio: id, owner: email.trim().toLowerCase(), build: app.build, at: new Date().toISOString() };
      setStep("Recording where the Studio moved");
      const cur = await dest.getJSON<any>("studio.json").catch(() => null);
      await dest.putFile("studio.json", jsonB64({ ...(cur?.data || { version: 1, categories: [], projects: [] }), hosted: rec }), "Moved", cur?.sha);
      onIndex(await studio.updateIndex((i) => { i.hosted = rec; }, "Moved the Studio to Netlify + Supabase"));
      setResult(rec); setPhase("done"); toast("Your Studio is on Netlify");
    } catch (e: any) { setErr(e?.message || "Something went wrong."); setPhase("code"); }
    setStep("");
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="card flex flex-col gap-2 p-5">
        <h2 className="text-lg font-extrabold">Move the Studio outside GitHub</h2>
        <p className="text-sm text-ink-300">Puts this whole Studio on <b className="text-ink-100">your Netlify</b>, with its projects, content and photos in <b className="text-ink-100">your Supabase</b>. You sign in there with a 6-digit code sent to your email, no GitHub token needed. This Studio keeps working until you stop using it.</p>
        <p className="text-[13px] text-ink-400">Setting up Studios for clients (B2B)? Each client gets their own Studio, on your accounts or theirs, with the sites you share kept in step: <a className="text-brand-300 underline" href="#/settings/partners">Studio Partners →</a></p>
        {prev && phase !== "done" && <p className="rounded-lg border border-emerald-400/30 bg-emerald-400/5 px-3 py-2.5 text-[13px] text-emerald-100">Moved before to <a className="underline" href={prev.url} target="_blank" rel="noopener noreferrer">{prev.url}</a>. Running it again updates that Studio to this build{withData ? " and copies your files again" : ""}.</p>}
      </section>
      <section className="card flex flex-col gap-3 p-5" aria-label="Netlify">
        <h3 className="text-[15px] font-extrabold">1 · Netlify (where the Studio runs)</h3>
        {nf ? <p className="text-sm text-emerald-300">Connected.</p> : <NetlifyAccount session={session} onToken={(t) => setNf(t ? new Netlify(t) : null)} />}
      </section>
      <section className="card flex flex-col gap-3 p-5" aria-label="Supabase">
        <h3 className="text-[15px] font-extrabold">2 · Supabase (where its files live)</h3>
        {sb.ui}
      </section>
      <section className="card flex flex-col gap-3 p-5" aria-label="Your Studio">
        <h3 className="text-[15px] font-extrabold">3 · Your Studio</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Studio ID" htmlFor="mg-id" hint="Names this Studio's files in Supabase."><input id="mg-id" className="input font-mono" value={id} disabled={!!prev} onChange={(e) => setId(slug(e.target.value))} /></Field>
          <Field label="Address" htmlFor="mg-site" hint={`${siteName}.netlify.app (add your own domain in Netlify later)`}><input id="mg-site" className="input font-mono" value={siteName} disabled={!!prev} onChange={(e) => setSiteName(slug(e.target.value))} /></Field>
          <Field label="Your email" htmlFor="mg-email" hint="You sign in with it; it becomes the Studio's owner."><input id="mg-email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        </div>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 accent-brand-400" checked={withData} onChange={(e) => setWithData(e.target.checked)} />
          <span><b>Transfer my Studio data</b> <span className="text-ink-400">— projects, content, photos, export history and settings{count != null ? ` (${count} files)` : ""}. Untick to start the new Studio empty.</span></span></label>
      </section>

      {phase === "setup" && <button type="button" className="btn btn-pri self-start" disabled={!ok || !!step || !!sb.busy} onClick={start}>{step ? step + "…" : prev ? "Update the moved Studio" : "Move my Studio"}</button>}
      {(phase === "code" || phase === "moving") && (
        <section className="card flex flex-col gap-3 p-5" aria-label="Confirm your email">
          <p className="text-sm text-ink-300">Supabase is ready. Enter the 6-digit code sent to <b className="text-ink-100">{email}</b> (check spam too), then the Studio moves.</p>
          <div className="flex flex-wrap gap-2">
            <input aria-label="Code from the email" className="input w-36 font-mono text-lg tracking-widest" inputMode="numeric" maxLength={10} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
            <button type="button" className="btn btn-pri" disabled={code.length < 6 || phase === "moving"} onClick={finish}>{phase === "moving" ? step + "…" : "Finish moving"}</button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={phase === "moving"} onClick={() => target && sendCode(target, email.trim()).then(() => toast("New code sent"))}>Send a new code</button>
          </div>
        </section>
      )}
      {step && phase === "setup" && <p className="text-[13px] text-ink-400" role="status">{step}…</p>}
      {err && <p role="alert" className="text-sm text-red-300">{err}</p>}
      {phase === "done" && result && (
        <section className="card flex flex-col gap-2 border-emerald-400/40 p-5" aria-label="Moved">
          <h3 className="text-[15px] font-extrabold text-emerald-200">✓ Your Studio is on Netlify + Supabase</h3>
          <p className="text-sm text-ink-300">Open it, sign in with <b className="text-ink-100">{result.owner}</b> and the code you'll get by email. Add your own domain in Netlify → Domain management whenever you like.</p>
          <a className="btn btn-pri self-start" href={result.url} target="_blank" rel="noopener noreferrer">Open your new Studio ↗</a>
          <p className="hint">Your hosting tokens (GitHub publishing, Netlify, Cloudflare…) stay on each device, so add them once in the new Studio's Settings → Hosting accounts.</p>
        </section>
      )}
    </div>
  );
}

function HostedHere({ session, nf, setNf, index }: { session: Session; nf: Netlify | null; setNf: (n: Netlify | null) => void; index: StudioIndex }) {
  const toast = useToast();
  const [cfg, setCfg] = useState<StudioHostCfg | null>(null), [latest, setLatest] = useState<string | null>(null), [mine, setMine] = useState<string | null>(null);
  const [step, setStep] = useState(""), [err, setErr] = useState("");
  useEffect(() => { loadHostConfig().then((c) => { setCfg(c); if (c?.source) appFiles(c.source).then((m) => setLatest(m.build)).catch(() => setLatest(null)); }); appFiles(appBase()).then((m) => setMine(m.build)).catch(() => setMine(STUDIO_BUILD.id)); }, []);
  const update = async () => {
    if (!nf || !cfg?.source) return;
    setErr("");
    try {
      const siteId = index.hosted?.siteId;
      if (!siteId) throw new Error("Couldn't find this Studio's site on the connected Netlify account.");
      await deployStudioApp(nf, { siteId, siteName: "", source: cfg.source, config: cfg }, setStep);
      toast("Updated. Reloading…"); setTimeout(() => location.reload(), 1200);
    } catch (e: any) { setErr(e?.message || "Couldn't update."); }
    setStep("");
  };
  return (
    <div className="flex flex-col gap-4">
      <section className="card flex flex-col gap-2 p-5">
        <h2 className="text-lg font-extrabold">This Studio runs on Netlify + Supabase</h2>
        <p className="text-sm text-ink-300">Studio <b className="text-ink-100">{cfg?.studio}</b> · files in <code className="font-mono text-xs">{cfg?.url}</code> · signed in as <b className="text-ink-100">{session.username}</b>.</p>
      </section>
      <section className="card flex flex-col gap-3 p-5" aria-label="Update">
        <h3 className="text-[15px] font-extrabold">Studio updates</h3>
        <p className="text-sm text-ink-300">This Studio: build <code className="font-mono text-xs">{mine || "…"}</code>. Latest: <code className="font-mono text-xs">{latest || "…"}</code>{latest && mine && latest === mine ? " · up to date" : ""}.</p>
        {!nf && <NetlifyAccount session={session} onToken={(t) => setNf(t ? new Netlify(t) : null)} />}
        <button type="button" className="btn btn-pri self-start" disabled={!nf || !cfg?.source || !!step || (!!latest && latest === mine)} onClick={update}>{step ? step + "…" : "Update to the latest Studio"}</button>
        {err && <p role="alert" className="text-sm text-red-300">{err}</p>}
      </section>
    </div>
  );
}
