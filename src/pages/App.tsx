import { GuideTourHost } from "../ui/GuideTour";
import { useEffect, useMemo, useState } from "react";
import { session as sess, device, watchIdle, type Session } from "../lib/auth";
import { GitHubRepo, MemoryRepo, type Repo } from "../lib/repo";
import { Gate } from "../ui/gate";
import { useToast } from "../ui/kit";
import { Workspace } from "./Workspace";
import { ThemesPage } from "./ThemesPage";
import { DesignPage } from "./DesignPage";
import { StudioPageLinks, StudioPageView } from "./StudioPage";
import { ReviewPage } from "./ReviewPage";
import { setBrand, useBrand } from "../lib/brand";
import { publicBrand } from "../lib/designapi";
import { writeDesignSettings } from "../lib/designs";
import { deviceSecret, loadHostConfig, type StudioHostCfg } from "../lib/studiohost";
import { backendOf, isHosted } from "../lib/backend";
import { StudioGate, sharedSource } from "../ui/StudioGate";
import { StepLoader } from "../ui/kit";
import { HelperLanding } from "./HelperBox";
import { helperHandoff } from "../lib/relay";
import { ghPublish } from "../lib/ghpublish";
import { ghRoute } from "../lib/repo";
import { cfDeployInfo, dbGitHub } from "../lib/cfdb";

export const NS = "site-studio";

/** ?data=github (remembered for this tab) opens the GitHub data on a Studio that shares the moved Studio's database. */
function githubData() {
  try {
    const q = new URLSearchParams(location.search).get("data");
    if (q === "github") sessionStorage.setItem("site-studio:data", "github"); else if (q === "shared") sessionStorage.removeItem("site-studio:data");
    return sessionStorage.getItem("site-studio:data") === "github";
  } catch { return false; }
}

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
  // GitHub Pages can share the moved Studio's database (studio.share.json); ?data=github opens the older GitHub data.
  useEffect(() => { loadHostConfig().then((c) => setHost(c && sharedSource(c) && githubData() ? null : c)); }, []);
  // Signed out on a Studio kept in Cloudflare: its own name, logo and colours (and whether Design yourself is on) come from its database, so the sign-in and public pages look like the Studio even on a browser that has never been signed in.
  // Until it has answered, the plain address shows a loader, not the sign-in: on the Design yourself or theme gallery address the answer sends the visitor straight to that page, and the sign-in would flash first.
  const [brandDone, setBrandDone] = useState(false);
  useEffect(() => {
    if (!host || host.kind !== "cloudflare" || session) return;
    let live = true;
    const cap = setTimeout(() => { if (live) setBrandDone(true); }, 4000);
    publicBrand({ api: host.api, studio: host.studio }).then((b) => {
      if (!live || !b) return;
      setBrand({ name: b.name, logo: b.logo, v: b.v, tint: b.tint, mode: b.mode, anim: b.anim, layout: b.layout });
      writeDesignSettings(b.design);
      // The Design yourself page's own address opens straight on that page.
      const dom = b.design?.domain, here = location.hostname.toLowerCase().replace(/^www\./, "");
      if (dom && here === dom && !/^#\/design/.test(location.hash)) location.hash = "#/design";
      if (b.design?.gallery?.domain && here === b.design.gallery.domain && !/^#\/themes/.test(location.hash)) location.hash = "#/themes";
      setHash(location.hash);
    }).catch(() => {}).finally(() => { clearTimeout(cap); if (live) setBrandDone(true); });
    return () => { live = false; clearTimeout(cap); };
  }, [host?.kind, !!session]);
  // A Studio that signs in by email reaches its GitHub sites through its database, when that keeps a GitHub token.
  useEffect(() => {
    if (host?.kind !== "cloudflare") return;
    const check = () => cfDeployInfo(host.api).then((i) => { ghRoute.via = i.gh ? dbGitHub(host.api, "studio:" + host.studio) : undefined; });
    check();
    // Turned on from another Studio or tab: noticed when you come back to this one.
    addEventListener("focus", check); return () => removeEventListener("focus", check);
  }, [host]);
  // A GitHub sign-in from before this Studio shared the moved Studio's database: sign in again by email.
  // …and the other way round: an email sign-in, when this tab now opens the GitHub data (?data=github).
  useEffect(() => { if (host !== undefined && session && isHosted(session) !== !!host) { sess.clear(NS); setSession(null); } }, [host, session]);
  ghPublish.setLoginIsGitHub(!(session && isHosted(session)));
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

  // Is someone already signed in here (without a saved tab session)? Asked once, quietly, for the public pages.
  const [probed, setProbed] = useState<"idle" | "done">("idle");
  useEffect(() => {
    if (!host || session || probed === "done") return;
    if (!/^#\/(design|themes)(\?|$)/.test(hash)) return;
    let live = true;
    (async () => {
      try {
        const be = backendOf(host), who = await be.signedIn(), role = who ? await be.role() : null;
        if (live && who && role) { const s: Session = { cfg: { owner: host.kind, repo: host.studio, branch: "main" }, token: deviceSecret(host.studio), username: who }; sess.save(NS, s); setSession(s); }
      } catch { /* signed out */ }
      if (live) setProbed("done");
    })();
    return () => { live = false; };
  }, [host, session, hash]);

  // The helper's page hands its address back here (#helper=…): confirm it, then the Studio tab connects it.
  const handed = helperHandoff.fromHash(hash);
  if (handed) return <HelperLanding url={handed} />;

  // Themes and Design yourself are public pages, but someone already signed in (on this browser) should see them as signed in: wait for that check, with a progress bar, instead of showing the signed-out page first.
  const publicHash = /^#\/(design|themes)(\?|$)/.test(hash);
  if (publicHash && !repo && host !== undefined && probed !== "done" && host) return <div className="grid min-h-screen place-items-center bg-ink-950"><StepLoader title="Checking your sign-in" at={0} steps={["Checking your sign-in"]} /></div>;
  if (publicHash && !repo && host === undefined) return <div className="grid min-h-screen place-items-center bg-ink-950"><StepLoader title="Starting the Studio" at={0} steps={["Finding where this Studio keeps its files", "Checking your sign-in"]} /></div>;

  // The theme gallery is public: anyone with the link can browse it without signing in.
  // Design yourself: a chat that builds a preview site. Signed in, the Studio shows it (and keeps the previews).
  if (/^#\/design(\?|$)/.test(hash) && !repo) return <DesignPage />;
  if (/^#\/themes(\?|$)/.test(hash)) return <ThemesPage signedIn={!!repo} />;

  // The Studio's own pages (privacy, terms…) are public too: #/pages/<name>.
  const pg = /^#\/pages\/([^?]+)/.exec(hash);
  if (pg && host !== undefined) return <StudioPageView slug={decodeURIComponent(pg[1])} host={host} repo={repo} />;

  // A client's review link (#/review/<token>) is public too: the link is the key.
  const rvw = /^#\/review\/([a-f0-9]{32})/.exec(hash);
  if (rvw && host !== undefined) return <ReviewPage token={rvw[1]} host={host} />;

  if (host === undefined) return <div className="grid min-h-screen place-items-center"><StepLoader title="Starting the Studio" at={0} steps={["Finding where this Studio keeps its files", "Signing in"]} /></div>;
  if (host?.kind === "cloudflare" && !repo && !brandDone && (hash === "" || hash === "#" || hash === "#/")) return <div className="grid min-h-screen place-items-center bg-ink-950"><StepLoader title="Starting the Studio" at={0} steps={["Finding where this Studio keeps its files", "Opening the page"]} /></div>;
  if (host && !repo) return <StudioGate links={<StudioPageLinks host={host} where="gate" />} cfg={host} brand={brandName} onIn={(email) => { const s: Session = { cfg: { owner: host.kind, repo: host.studio, branch: "main" }, token: deviceSecret(host.studio), username: email }; sess.save(NS, s); setSession(s); }} />;
  if (!repo) {
    return (
      <Gate ns={NS} brand={brandName} repoNoun="Studio's data repository" defaultRepo="studio-data"
        tokenHint="A fine-grained token with Contents: Read and write on the data repository, plus any site repositories you'll publish to."
        onAuthed={setSession} onDemo={() => setDemo(true)} footer={<StudioPageLinks host={host} where="gate" />} />
    );
  }

  return (<>
    <Workspace
      repo={repo}
      session={demo ? { cfg: repo.cfg, token: "", username: "demo" } : session!}
      onSession={setSession}
      onSignOut={signOut}
      onForget={() => { device.clear(NS); signOut(); }}
    />
    <GuideTourHost />
  </>);
}
