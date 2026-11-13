import { useEffect, useMemo, useState } from "react";
import { session as sess, device, watchIdle, type Session } from "../lib/auth";
import { GitHubRepo, MemoryRepo, type Repo } from "../lib/repo";
import { Gate } from "../ui/gate";
import { useToast } from "../ui/kit";
import { Workspace } from "./Workspace";
import { ThemesPage } from "./ThemesPage";
import { useBrand } from "../lib/brand";
import { deviceSecret, loadHostConfig, type StudioHostCfg } from "../lib/studiohost";
import { backendOf, isHosted } from "../lib/backend";
import { StudioGate } from "../ui/StudioGate";
import { StepLoader } from "../ui/kit";
import { HelperLanding } from "./HelperBox";
import { helperHandoff } from "../lib/relay";

export const NS = "site-studio";

export function App() {
  const toast = useToast();
  const brandName = useBrand().name;
  useEffect(() => { document.title = brandName; }, [brandName]);
  const [session, setSession] = useState<Session | null>(() => sess.load(NS));
  const [demo, setDemo] = useState(false);
  const [hash, setHash] = useState(location.hash);
  useEffect(() => { const on = () => setHash(location.hash); addEventListener("hashchange", on); return () => removeEventListener("hashchange", on); }, []);

  // A Studio moved to Netlify + Supabase finds its Supabase in studio.config.json (none on GitHub Pages).
  const [host, setHost] = useState<StudioHostCfg | null | undefined>(undefined);
  useEffect(() => { loadHostConfig().then(setHost); }, []);
  const repo = useMemo<Repo | null>(() => (demo ? new MemoryRepo() : session ? (isHosted(session) && host ? backendOf(host).repo() : new GitHubRepo(session.cfg, session.token)) : null), [demo, session, host]);

  const signOut = () => {
    if (host) backendOf(host).signOut().catch(() => {});
    sess.clear(NS);
    setSession(null);
    setDemo(false);
    location.hash = "";
  };

  useEffect(() => {
    if (!session) return;
    return watchIdle(NS, () => {
      signOut();
      toast("Signed out after 30 minutes without activity");
    });
  }, [session]);

  // The helper's page hands its address back here (#helper=…): confirm it, then the Studio tab connects it.
  const handed = helperHandoff.fromHash(hash);
  if (handed) return <HelperLanding url={handed} />;

  // The theme gallery is public: anyone with the link can browse it without signing in.
  if (/^#\/themes(\?|$)/.test(hash)) return <ThemesPage signedIn={!!repo} />;

  if (host === undefined) return <div className="grid min-h-screen place-items-center"><StepLoader title="Starting the Studio" at={0} steps={["Finding where this Studio keeps its files", "Signing in"]} /></div>;
  if (host && !repo) return <StudioGate cfg={host} brand={brandName} onIn={(email) => { const s: Session = { cfg: { owner: host.kind, repo: host.studio, branch: "main" }, token: deviceSecret(host.studio), username: email }; sess.save(NS, s); setSession(s); }} />;
  if (!repo) {
    return (
      <Gate ns={NS} brand={brandName} repoNoun="Studio's data repository" defaultRepo="studio-data"
        tokenHint="A fine-grained token with Contents: Read and write on the data repository, plus any site repositories you'll publish to."
        onAuthed={setSession} onDemo={() => setDemo(true)} />
    );
  }

  return (
    <Workspace
      repo={repo}
      session={demo ? { cfg: repo.cfg, token: "", username: "demo" } : session!}
      onSession={setSession}
      onSignOut={signOut}
      onForget={() => { device.clear(NS); signOut(); }}
    />
  );
}
