import { useEffect, useMemo, useState } from "react";
import type { Session } from "../lib/auth";
import { GitHubRepo, explain, type Repo } from "../lib/repo";
import { Studio, type StudioIndex } from "../lib/studio";
import { AccountPanel } from "../ui/gate";
import { Field, Logo, Spinner, useToast } from "../ui/kit";
import { BrandMark, DEFAULT_NAME, brand as currentBrand, setBrand, shrinkImage, useBrand } from "../lib/brand";
import { Dashboard } from "./Dashboard";
import { ProjectView } from "./ProjectView";
import { NS } from "./App";

function useHash() {
  const [h, setH] = useState(location.hash);
  useEffect(() => {
    const on = () => setH(location.hash);
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);
  return h;
}

export function Workspace({ repo, session, onSession, onSignOut, onForget }: { repo: Repo; session: Session; onSession: (s: Session) => void; onSignOut: () => void; onForget: () => void }) {
  const studio = useMemo(() => {
    const st = new Studio(repo);
    if (!repo.demo) st.siteRepo = (t) => new GitHubRepo(t, session.token);
    return st;
  }, [repo, session.token]);
  const [index, setIndex] = useState<StudioIndex | null>(null);
  const [err, setErr] = useState("");
  const hash = useHash();

  const load = () => {
    setErr("");
    studio.loadIndex().then(setIndex).catch((e) => setErr(explain(e)));
  };
  useEffect(load, [studio]);
  const b = useBrand();
  useEffect(() => { document.title = b.name; }, [b.name]);
  // Name and logo come from studio.json, so every signed-in device shows the same.
  useEffect(() => {
    const sb = index?.brand;
    if (!sb || repo.demo) return;
    const cur = currentBrand();
    if (sb.v && sb.v === cur.v) return;
    (async () => {
      let logo = "";
      if (sb.logo) { const blob = await repo.getRaw(sb.logo).catch(() => null); if (blob) logo = await new Promise<string>((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result || "")); r.onerror = () => ok(""); r.readAsDataURL(new Blob([blob], { type: "image/png" })); }); }
      setBrand({ name: sb.name, logo, v: sb.v });
    })();
  }, [index?.brand?.v]);

  const route = hash.replace(/^#\/?/, "");
  const projectId = route.startsWith("p/") ? route.slice(2) : null;
  const project = projectId && index ? index.projects.find((p) => p.id === projectId) : null;

  const header = (
    <header className="sticky top-0 z-40 border-b border-ink-700 bg-ink-950/90 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <a href="#/" className="flex items-center gap-2.5 font-extrabold"><BrandMark fallback={<Logo />} />{b.name}</a>
        {repo.demo && <span className="chip border-amber-400/50 text-amber-200">Demo · nothing is saved</span>}
        <nav className="ml-auto flex items-center gap-1" aria-label="Studio">
          <a href="#/" className={`btn btn-ghost btn-sm ${!route || route === "/" ? "text-ink-100" : "text-ink-400"}`}>Projects</a>
          <a href="#/themes" className="btn btn-ghost btn-sm text-ink-400">Themes</a>
          {!repo.demo && <a href="#/settings" className={`btn btn-ghost btn-sm ${route === "settings" ? "text-ink-100" : "text-ink-400"}`}>Settings</a>}
          <span className="hidden px-2 text-sm text-ink-400 sm:inline">{session.username}</span>
          <button type="button" className="btn btn-sm" onClick={onSignOut}>{repo.demo ? "Exit demo" : "Sign out"}</button>
        </nav>
      </div>
    </header>
  );

  if (err) return <>{header}<main className="mx-auto max-w-xl px-4 py-16"><div className="card flex flex-col gap-4 p-6"><h1 className="text-xl font-extrabold">Couldn't load your projects</h1><p className="text-sm text-ink-300">{err}</p><button className="btn btn-pri self-start" onClick={load}>Try again</button></div></main></>;
  if (!index) return <>{header}<main className="grid place-items-center py-24"><Spinner label="Loading projects…" /></main></>;

  if (projectId) {
    if (!project) return <>{header}<main className="mx-auto max-w-xl px-4 py-16"><div className="card flex flex-col gap-4 p-6"><h1 className="text-xl font-extrabold">Project not found</h1><p className="text-sm text-ink-300">It may have been deleted on another device.</p><a className="btn btn-pri self-start" href="#/">Back to projects</a></div></main></>;
    return <ProjectView key={project.id} studio={studio} index={index} project={project} session={session} onIndex={setIndex} />;
  }

  if (route === "settings" && !repo.demo) {
    return (
      <>{header}
        <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-8 sm:px-6">
          <h1 className="font-display text-3xl font-extrabold">Settings</h1>
          <p className="text-sm text-ink-300">Your Studio keeps everything as files in <b className="text-ink-100">{session.cfg.owner}/{session.cfg.repo}</b>: <code className="font-mono text-xs">studio.json</code> for the project list and <code className="font-mono text-xs">projects/</code> for each site's content, images and export snapshots.</p>
          <BrandCard studio={studio} onIndex={setIndex} />
          <AccountPanel ns={NS} session={session} onUpdated={onSession} onSignOut={onSignOut} onForget={onForget} />
        </main>
      </>
    );
  }

  return <>{header}<Dashboard studio={studio} index={index} onIndex={setIndex} token={session.token} /></>;
}

/** Settings → the Studio's own name and logo (saved in studio.json, so every device shows them). */
function BrandCard({ studio, onIndex }: { studio: Studio; onIndex: (i: StudioIndex) => void }) {
  const toast = useToast();
  const b = useBrand();
  const [name, setName] = useState(b.name);
  const [logo, setLogo] = useState<string | null>(null); // null: unchanged, "": remove
  const [busy, setBusy] = useState(false);
  const shown = logo === null ? b.logo : logo;
  const save = async () => {
    setBusy(true);
    try {
      const i = await studio.saveBrand(name.trim() || DEFAULT_NAME, logo);
      onIndex(i);
      setBrand({ name: name.trim() || DEFAULT_NAME, logo: shown, v: i.brand?.v });
      setLogo(null);
      toast("Saved. Every device you sign in on shows the new name and logo.");
    } catch (e) { toast(explain(e), "bad"); }
    setBusy(false);
  };
  return (
    <section className="card flex flex-col gap-4 p-5">
      <h3 className="text-[15px] font-extrabold">Studio name & logo</h3>
      <Field label="Studio name" htmlFor="b-name" hint="Shown in the header, the browser tab, the sign-in screen and the shareable theme gallery."><input id="b-name" className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} /></Field>
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-xl border border-ink-600 bg-ink-950">{shown ? <img src={shown} alt="Studio logo" className="h-full w-full object-cover" /> : <Logo size={10} />}</div>
        <label className="btn btn-sm cursor-pointer">Upload logo / icon<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; try { setLogo(await shrinkImage(f)); } catch (x) { toast(explain(x), "bad"); } }} /></label>
        {shown && <button type="button" className="btn btn-sm" onClick={() => setLogo("")}>Remove</button>}
        <span className="hint">A square image works best. It's also the browser-tab icon.</span>
      </div>
      <button type="button" className="btn btn-pri self-start" disabled={busy || (name.trim() === b.name && logo === null)} onClick={save}>{busy ? "Saving…" : "Save name & logo"}</button>
    </section>
  );
}
