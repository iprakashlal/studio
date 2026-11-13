// Hosting → Supabase, set up for you: one access token, then the Studio picks or creates the project, fills in
// its address and public key, runs the setup SQL and switches sign-in emails to 6-digit codes.
import { SbTokenHelp } from "./SbTokenHelp";
import { useEffect, useState } from "react";
import { RELAY_VERSION, relayVault, setupRelay, type Relay } from "../lib/relay";
import { Netlify } from "../lib/netlify";
import { setupSql } from "../lib/supa";
import { SB_TOKENS_PAGE, SupaMgmt, refOf, sbMgmtVault, type SbOrg, type SbProject } from "../lib/supamgmt";

type Props = { nf: Netlify | null; studioToken: string; site: string; email: string; defaultOpen?: boolean; onFill: (url: string, key: string) => void };

export function SupabaseAuto({ nf, studioToken, site, email, defaultOpen = false, onFill }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [tok, setTok] = useState(""), [saved, setSaved] = useState(false);
  const [projects, setProjects] = useState<SbProject[] | null>(null), [orgs, setOrgs] = useState<SbOrg[]>([]);
  const [pick, setPick] = useState(""), [org, setOrg] = useState(""), [region, setRegion] = useState<"apac" | "emea" | "americas">("apac"), [name, setName] = useState("studio-sites");
  const [busy, setBusy] = useState(""), [err, setErr] = useState(""), [done, setDone] = useState<string[]>([]);
  useEffect(() => { sbMgmtVault.load(studioToken).then((v) => { if (v?.token) { setTok(v.token); setSaved(true); } }); }, [studioToken]);

  const helper = async (): Promise<Relay> => {
    const r = await relayVault.load(studioToken);
    if (r && r.v === RELAY_VERSION) return r;
    if (!nf) throw new Error("Connect Netlify above first: the Studio's helper on your Netlify talks to Supabase for you.");
    return setupRelay(nf, studioToken, r, (s) => setBusy(s));
  };
  const connect = async () => {
    setErr(""); setBusy("Connecting");
    try {
      const m = new SupaMgmt(await helper(), tok.trim());
      setBusy("Reading your projects");
      const [ps, os] = await Promise.all([m.projects(), m.orgs()]);
      setProjects(ps); setOrgs(os); setOrg(os[0]?.id || "");
      setPick(ps.find((p) => p.status === "ACTIVE_HEALTHY") ? refOf(ps.find((p) => p.status === "ACTIVE_HEALTHY")!) : "new");
      await sbMgmtVault.save({ token: tok.trim() }, studioToken); setSaved(true);
    } catch (e: any) { setErr(e?.message || "Couldn't reach Supabase."); }
    setBusy("");
  };
  useEffect(() => { if (open && saved && tok && !projects && !busy) connect(); }, [open, saved]);

  const run = async () => {
    setErr(""); setDone([]);
    const did: string[] = [];
    try {
      const m = new SupaMgmt(await helper(), tok.trim());
      let ref = pick;
      if (pick === "new") {
        const o = orgs.find((x) => x.id === org); if (!o) throw new Error("Choose the Supabase organisation for the new project.");
        setBusy("Creating the project"); const p = await m.createProject(name.trim() || "studio-sites", o, region); ref = refOf(p);
        did.push(`Created the free project “${p.name}”.`);
      }
      setBusy("Waiting for the project"); await m.waitReady(ref, setBusy);
      setBusy("Reading its public key"); const key = await m.publicKey(ref);
      onFill(`https://${ref}.supabase.co`, key); did.push("Filled in the Project URL and public key.");
      setBusy("Running the setup SQL"); await m.sql(ref, setupSql(site, email)); did.push(`Ran the setup SQL for site “${site}” with ${email} as its editor.`);
      setBusy("Turning on 6-digit sign-in codes"); await m.codeEmails(ref); did.push("Sign-in emails now carry a 6-digit code.");
      setDone(did);
    } catch (e: any) { setErr(e?.message || "Something went wrong."); setDone(did); }
    setBusy("");
  };

  const ready = !!projects && (pick !== "new" || !!org) && /^[a-z0-9-]{2,}$/.test(site) && email.includes("@");
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-brand-400/40 bg-brand-400/5 p-3 text-[13px] text-ink-200" aria-label="Set up Supabase for me">
      <div className="flex flex-wrap items-center gap-2">
        <b className="text-ink-100">Set it all up for me</b>
        <span className="text-ink-400">One access token: the Studio picks or creates the project, fills in its address and key, runs the setup SQL and turns on sign-in codes.</span>
        <button type="button" className="btn btn-sm ml-auto" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "Hide" : "Set up automatically"}</button>
      </div>
      {open && (
        <div className="flex flex-col gap-2.5">
          <p><a className="btn btn-sm btn-pri" href={SB_TOKENS_PAGE} target="_blank" rel="noopener noreferrer">Open Supabase → Access tokens ↗</a> <span className="text-ink-400">Press <b>Generate new token</b>, name it “Site Studio”, copy it and paste it here. It's kept encrypted on this device only.</span></p>
          <SbTokenHelp />
          <div className="flex gap-2">
            <input aria-label="Supabase access token" className="input min-w-0 flex-1 font-mono text-xs" type="password" autoComplete="off" placeholder="sbp_…" value={tok} onChange={(e) => { setTok(e.target.value); setSaved(false); setProjects(null); }} />
            <button type="button" className="btn btn-sm" disabled={!tok.trim() || !!busy} onClick={connect}>{busy && !projects ? busy + "…" : "Connect"}</button>
          </div>
          {projects && (
            <div className="flex flex-col gap-2">
              <label className="flex flex-col gap-1"><span className="label">Project</span>
                <select className="input" aria-label="Supabase project" value={pick} onChange={(e) => setPick(e.target.value)}>
                  {projects.map((p) => <option key={refOf(p)} value={refOf(p)}>{p.name} · {refOf(p)}{p.status !== "ACTIVE_HEALTHY" ? ` (${p.status.toLowerCase().replace(/_/g, " ")})` : ""}</option>)}
                  <option value="new">＋ Create a new free project</option>
                </select>
              </label>
              {pick === "new" && (
                <div className="grid gap-2 sm:grid-cols-3">
                  <label className="flex flex-col gap-1"><span className="label">Name</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></label>
                  <label className="flex flex-col gap-1"><span className="label">Organisation</span><select className="input" value={org} onChange={(e) => setOrg(e.target.value)}>{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
                  <label className="flex flex-col gap-1"><span className="label">Region</span><select className="input" value={region} onChange={(e) => setRegion(e.target.value as any)}><option value="apac">Asia-Pacific</option><option value="emea">Europe</option><option value="americas">Americas</option></select></label>
                  <p className="text-ink-400 sm:col-span-3">The free plan allows two active projects. One project can hold all your sites. Its database password is random; reset it in Supabase if you ever need it.</p>
                </div>
              )}
              {!email.includes("@") && <p className="text-amber-200">Type your email above first: it becomes the site's editor.</p>}
              <button type="button" className="btn btn-pri btn-sm self-start" disabled={!ready || !!busy} onClick={run}>{busy && projects ? busy + "…" : "Set up Supabase"}</button>
            </div>
          )}
          {err && <p role="alert" className="text-red-300">{err}</p>}
          {done.length > 0 && <ul className="flex flex-col gap-0.5 text-emerald-200" aria-label="Done">{done.map((d) => <li key={d}>✓ {d}</li>)}</ul>}
          {done.length >= 4 && <p className="text-ink-300">Next: press <b>Email me a sign-in code</b> below to sign in, then publish.</p>}
        </div>
      )}
    </div>
  );
}
