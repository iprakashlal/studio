import { useEffect, useMemo, useState } from "react";
import { session as sess, device, watchIdle, type Session } from "../lib/auth";
import { GitHubRepo, MemoryRepo, type Repo } from "../lib/repo";
import { Gate } from "../ui/gate";
import { useToast } from "../ui/kit";
import { Workspace } from "./Workspace";

export const NS = "site-studio";

export function App() {
  const toast = useToast();
  const [session, setSession] = useState<Session | null>(() => sess.load(NS));
  const [demo, setDemo] = useState(false);

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

  if (!repo) {
    return (
      <Gate ns={NS} brand="Site Studio" repoNoun="Studio's data repository" defaultRepo="studio-data"
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
