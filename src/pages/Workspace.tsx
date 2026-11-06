import { useEffect, useMemo, useState } from "react";
import type { Session } from "../lib/auth";
import { explain, type Repo } from "../lib/repo";
import { Studio, type StudioIndex } from "../lib/studio";
import { AccountPanel } from "../ui/gate";
import { Logo, Spinner } from "../ui/kit";
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
  const studio = useMemo(() => new Studio(repo), [repo]);
  const [index, setIndex] = useState<StudioIndex | null>(null);
  const [err, setErr] = useState("");
  const hash = useHash();

  const load = () => {
    setErr("");
    studio.loadIndex().then(setIndex).catch((e) => setErr(explain(e)));
  };
  useEffect(load, [studio]);

  const route = hash.replace(/^#\/?/, "");
  const projectId = route.startsWith("p/") ? route.slice(2) : null;
  const project = projectId && index ? index.projects.find((p) => p.id === projectId) : null;

  const header = (
    <header className="sticky top-0 z-40 border-b border-ink-700 bg-ink-950/90 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <a href="#/" className="flex items-center gap-2.5 font-extrabold"><Logo />Site Studio</a>
        {repo.demo && <span className="chip border-amber-400/50 text-amber-200">Demo · nothing is saved</span>}
        <nav className="ml-auto flex items-center gap-1" aria-label="Studio">
          <a href="#/" className={`btn btn-ghost btn-sm ${!route || route === "/" ? "text-ink-100" : "text-ink-400"}`}>Projects</a>
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
          <AccountPanel ns={NS} session={session} onUpdated={onSession} onSignOut={onSignOut} onForget={onForget} />
        </main>
      </>
    );
  }

  return <>{header}<Dashboard studio={studio} index={index} onIndex={setIndex} /></>;
}
