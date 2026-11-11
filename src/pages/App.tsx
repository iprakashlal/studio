import { useEffect, useMemo, useState } from "react";
import { session as sess, device, watchIdle, type Session } from "../lib/auth";
import { GitHubRepo, MemoryRepo, type Repo } from "../lib/repo";
import { Gate } from "../ui/gate";
import { useToast } from "../ui/kit";
import { Workspace } from "./Workspace";
import { ThemesPage } from "./ThemesPage";
import { useBrand } from "../lib/brand";

export const NS = "site-studio";

export function App() {
  const toast = useToast();
  const brandName = useBrand().name;
  useEffect(() => { document.title = brandName; }, [brandName]);
  const [session, setSession] = useState<Session | null>(() => sess.load(NS));
  const [demo, setDemo] = useState(false);
  const [hash, setHash] = useState(location.hash);
  useEffect(() => { const on = () => setHash(location.hash); addEventListener("hashchange", on); return () => removeEventListener("hashchange", on); }, []);

  const repo = useMemo<Repo | null>(() => (demo ? new MemoryRepo() : session ? new GitHubRepo(session.cfg, session.token) : null), [demo, session]);

  const signOut = () => {
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

  // The theme gallery is public: anyone with the link can browse it without signing in.
  if (/^#\/themes(\?|$)/.test(hash)) return <ThemesPage signedIn={!!repo} />;

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
