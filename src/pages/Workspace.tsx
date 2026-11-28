import { GUIDES, guide } from "../lib/guides";
import { Explorer, ExplorerCard } from "../ui/Explorer";
import { prefSync, applyPrefs } from "../lib/prefs";
import { StudioGoogleCard } from "./StudioGoogle";
import { StudioPeopleCard } from "./StudioPeople";
import { SitesHostingCard } from "./SitesHostingCard";
import { AiEngineCard, StudioInstagramCard, StudioWhatsAppCard } from "./AiEngine";
import { setAiEngine } from "../lib/ai";
import { hides, limitsOf, setStudioHidden, useClientStudio } from "../lib/features";
import { loadMyRole, myRole, roleHides, useMyRole } from "../lib/myrole";
import { roleLabel, userRoot } from "../lib/roles";
import { RoleManagement } from "../ui/RoleManagement";
import { PinCard } from "../ui/PinSignIn";
import { cfCall } from "../lib/cfdb";
import { setThemeAllow, setThemeLimit } from "../themes/limit";
import { DASH_DEFAULT, DASH_STATS } from "../lib/dashstats";
import { TEMPLATES } from "../schema";
import { StudioEmailCard, StudioPageLinks, StudioPagesCard } from "./StudioPage";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { isHosted } from "../lib/backend";
import type { Session } from "../lib/auth";
import { explain, type Repo } from "../lib/repo";
import { Studio, type StudioIndex } from "../lib/studio";
import { siteRepoFor } from "../lib/hosting";
import { AccountPanel } from "../ui/gate";
import { NetlifyAccount } from "./HostDialog";
import { GitHubPublishAccount } from "./GitHubAccount";
import { HostFold, SetupAccounts } from "./SetupAccounts";
import { ghPublish } from "../lib/ghpublish";
import { Field, Logo, Skel, SkelDashboard, SkelRows, useToast, Dock } from "../ui/kit";
import { accentFromImage, SCHEMES, tintPalette } from "../lib/tint";
import { setCurrentMenus } from "../lib/menus";
import { setCurrentPdefs } from "../lib/projdefaults";
import { ProjectDefaultsTab } from "./ProjectDefaults";
import { MenusCard } from "./MenusCard";
import { MigrationTab } from "./MigrationTab";
import { PartnersTab } from "./PartnersTab";
import { BADGE_DEFAULT, cleanBadge, resolveBadge, setCurrentBadge, studioLook, type BadgeCfg } from "../lib/badge";
import { MARK_URI } from "../ui/logo";
import { FoldAll, FoldCards } from "../ui/fold";
import { LOGO_ANIMS, UI_LAYOUTS, BrandMark, DEFAULT_NAME, brand as currentBrand, setBrand, shrinkImage, useBrand } from "../lib/brand";
import { PushUpdatesCard, PushUpdatesHost, UpdateAllCard, openPushUpdates } from "./PushUpdates";
import { Dashboard } from "./Dashboard";
import { DesignPage } from "./DesignPage";
import { UpdateDots } from "../ui/UpdateDots";
import { allOn, allSet, chainSet, refreshStatus, syncDatabases, updateStatusNow } from "../lib/autodb";
import { DesignLookTab, DesignPageCard, ThemesSettingsTab } from "./DesignSettings";
import { NavLinksCard } from "./NavLinksCard";
import { useDesignSettings } from "../lib/designs";
import { ProjectView } from "./ProjectView";
import { NS } from "./App";
import { autoUpdateStudio } from "../lib/autoupdate";
import { reloadToProjects, studioUpdate, useStudioUpdate } from "../lib/studioupdate";

function useHash() {
  const [h, setH] = useState(location.hash);
  useEffect(() => {
    const on = () => setH(location.hash);
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);
  return h;
}

const olderData = () => { try { return sessionStorage.getItem("site-studio:data") === "github"; } catch { return false; } };

export function Workspace({ repo, session, onSession, onSignOut, onForget }: { repo: Repo; session: Session; onSession: (s: Session) => void; onSignOut: () => void; onForget: () => void }) {
  const toast = useToast();
  const studio = useMemo(() => {
    const st = new Studio(repo);
    if (!repo.demo) st.siteRepo = (p) => siteRepoFor(p, session.token);
    return st;
  }, [repo, session.token]);
  const [index, setIndex] = useState<StudioIndex | null>(null);
  // A client Studio (set up by a Studio Partner) hides what the partner chose, and never offers Migration or Studio Partners.
  const client = useClientStudio();
  // Role Management: what this person's role hides, on top of what a client Studio hides. An Administrator can look at someone else's projects.
  const role = useMyRole();
  const [viewAs, setViewAs] = useState("");
  const hid = useMemo(() => { const a = hides(client, index), b = roleHides(role, !!viewAs); return (k: string) => a(k) || b(k); }, [client, index, role, viewAs]);
  // A client Studio's limits: how many themes it offers and how many sites of each type it may have.
  const limits = useMemo(() => limitsOf(client, index), [client, index]);
  useEffect(() => { if (index) setAiEngine(index.ai?.engine); }, [index?.ai?.engine]);
  useEffect(() => { if (client !== undefined && index) { setThemeLimit(limits.themes); setThemeAllow(limits.themeList); } }, [client, index, limits.themes, JSON.stringify(limits.themeList)]);
  useEffect(() => { setStudioHidden(hid("festival") ? ["festival"] : []); }, [hid]);
  const [err, setErr] = useState("");
  const [bootAt, setBootAt] = useState(0);
  const hash = useHash();

  const load = () => {
    setErr(""); setBootAt(1);
    loadMyRole(repo.demo).then((r) => {
      // Someone who isn't an Administrator works in their own space; an Administrator in the Studio's list, or in the space of the person they chose to look at.
      const other = r.managed && r.admin ? viewAs : "";
      studio.space = r.managed && !r.admin ? userRoot(r.email) : other ? userRoot(other) : ""; studio.viewing = !!other;
      return studio.loadIndex();
    }).then((i) => { setBootAt(2); setIndex(i); }).catch((e) => setErr(explain(e)));
  };
  const lookAt = (email: string) => { setViewAs(email); setIndex(null); };
  // The sign-in is shared by every tab of this browser. If another tab signed in as someone else (or an Administrator changed this
  // person's role), this tab would still show the earlier person's screen: on coming back to the tab the role is asked again, and the
  // page starts afresh when it is no longer the same person or role.
  useEffect(() => {
    if (repo.demo) return;
    const check = () => { if (document.visibilityState !== "visible") return; const was = myRole(); if (!was.managed) return; loadMyRole().then((now) => { if (now.email !== was.email || now.role !== was.role) location.reload(); }).catch(() => {}); };
    document.addEventListener("visibilitychange", check); addEventListener("focus", check);
    return () => { document.removeEventListener("visibilitychange", check); removeEventListener("focus", check); };
  }, [repo.demo]);
  useEffect(() => { if (!index && bootAt) load(); }, [viewAs]);
  // The publishing token (if any) is unlocked first, so live-site checks can read the sites' repositories.
  useEffect(() => { let on = true; (repo.demo ? Promise.resolve(null) : ghPublish.load(session.token)).finally(() => { if (on) load(); }); return () => { on = false; }; }, [studio]);
  const b = useBrand();
  useEffect(() => { document.title = b.name; }, [b.name]);
  // The "Powered by" badge's look, used when building sites and in previews.
  useEffect(() => { setCurrentBadge(index?.badge); }, [index?.badge]);
  useEffect(() => { setCurrentMenus(index?.menus); }, [index?.menus]);
  useEffect(() => { setCurrentPdefs(index?.pdefs); }, [index?.pdefs]);
  // A moved Studio updates itself to the latest build when it opens (projects aren't touched).
  const upd = useStudioUpdate();
  const hostedId = index?.hosted?.siteId;
  useEffect(() => {
    if (!index || repo.demo || !isHosted(session)) return;
    studioUpdate.start(async (step) => (await autoUpdateStudio(session, index, step)) === "updated", { quietErrors: true });
  }, [hostedId]);
  // The two status icons, and the database update that follows a Studio update: once this build is running, any database still on an older build is updated by itself.
  const hostedOn = !!index?.hosted?.siteId || !!index?.projects.some((p) => p.host?.cf?.api);
  useEffect(() => {
    if (!index || repo.demo || !isHosted(session)) { chainSet(false); return; }
    const stuck = setTimeout(() => chainSet(false), 120_000); // never leaves the bar up if the check can't run
    syncDatabases(session, index, toast).catch(() => {}).finally(() => {
      clearTimeout(stuck);
      // "Update everything" was pressed before the Studio updated itself and reloaded: with the Studio and its databases done, the live sites follow.
      if (allOn() && !updateStatusNow().dbBusy && updateStatusNow().studio !== "pending" && !studioUpdate.get().running) { allSet(false); openPushUpdates(true); }
    });
    const again = () => refreshStatus(index).catch(() => {});
    addEventListener("focus", again); const t = setInterval(again, 10 * 60_000);
    return () => { removeEventListener("focus", again); clearInterval(t); };
  }, [hostedId, hostedOn, upd.running]);
  // Choices kept in the Studio (lib/prefs.ts): saved there when changed, applied here when the Studio loads.
  useEffect(() => {
    if (repo.demo) return;
    prefSync.attach((patch) => studio.updateIndex((i) => { const o = i.prefs || {}; i.prefs = { ...o, ...patch, ...(patch.explorer ? { explorer: { ...o.explorer, ...patch.explorer } } : {}), ...(patch.nav ? { nav: { ...o.nav, ...patch.nav } } : {}) }; }, "Save the Studio's preferences").then((i) => { setIndex(i); }));
    return () => prefSync.attach(null);
  }, [studio]);
  const prefsKey = JSON.stringify(index?.prefs || null);
  useEffect(() => { if (index?.prefs && !repo.demo) applyPrefs(index.prefs); }, [prefsKey]);
  // Name and logo come from studio.json, so every signed-in device shows the same.
  useEffect(() => {
    const sb = index?.brand;
    if (!sb || repo.demo) return;
    const cur = currentBrand();
    if (sb.v && sb.v === cur.v) return;
    (async () => {
      let logo = "";
      if (sb.logo) { const blob = await repo.getRaw(sb.logo).catch(() => null); if (blob) logo = await new Promise<string>((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result || "")); r.onerror = () => ok(""); r.readAsDataURL(new Blob([blob], { type: "image/png" })); }); }
      setBrand({ name: sb.name, logo, v: sb.v, tint: sb.tint || "", mode: sb.mode === "light" ? "light" : "dark", anim: sb.anim || "", layout: sb.layout || "" });
    })();
  }, [index?.brand?.v]);

  const route = hash.replace(/^#\/?/, "");
  const projectId = route.startsWith("p/") ? route.slice(2) : null;
  const project = projectId && index ? index.projects.find((p) => p.id === projectId) : null;

  // Shown on every Studio screen while the Studio updates itself (it carries on whichever screen or browser tab is open).
  const updNote = upd.ready ? <div role="status" aria-label="Studio update" className="flex w-full flex-col gap-2 rounded-lg border border-brand-500/40 bg-ink-900 px-4 py-3 text-[13px] text-ink-100 shadow-xl"><span><b>The Studio is updated.</b> You have unsaved changes open, so it hasn't reloaded. Save them, then reload to use the new version.</span><button type="button" className="btn btn-pri btn-sm self-start" onClick={reloadToProjects}>Reload to Projects</button></div>
    : null;   // while an update runs, its progress is on the S and D icons (a ring with the percentage; hover for the details)
  // The live-sites update is mounted once here, so it carries on (minimised) on every Studio screen.
  const updBanner = <><Dock>{updNote}</Dock><PushUpdatesHost studio={studio} index={index} token={session.token} />{!repo.demo && <Explorer studio={studio} index={index} route={route} hosted={isHosted(session)} />}</>;
  const gal = useDesignSettings().gallery || {};
  const header = (<>{updBanner}{!repo.demo && <UpdateDots />}
    <header className="sticky top-0 z-40 border-b border-ink-700 bg-ink-950/90 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className={`mx-auto flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6 ${route.startsWith("settings") ? "max-w-[1680px]" : "max-w-[1400px]"}`}>
        <a href="#/" className="flex items-center gap-2.5 font-extrabold"><BrandMark fallback={<Logo />} />{b.name}</a>
        {repo.demo && <span className="chip border-amber-400/50 text-amber-200">Demo · nothing is saved</span>}
        {!repo.demo && !isHosted(session) && olderData() && <a href="?data=shared" className="chip border-amber-400/50 text-amber-200" title="This tab shows the GitHub data from before the Studio moved. Press to go back to the shared projects.">Older GitHub data · switch back</a>}
        <nav className="ml-auto flex items-center gap-1" aria-label="Studio">
          <a href="#/" className={`btn btn-ghost btn-sm ${!route || route === "/" || route.startsWith("type/") ? "text-ink-100" : "text-ink-400"}`}>Projects</a>
          {!hid("themes") && <a href={gal.domain ? `https://${gal.domain}/` : "#/themes"} className="btn btn-ghost btn-sm text-ink-400">{gal.link || "Themes"}</a>}
          {(index?.prefs?.links || []).map((l) => <a key={l.label + l.url} href={l.url} {...(l.url.startsWith("https://") ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="btn btn-ghost btn-sm text-ink-400">{l.label}</a>)}
          {!repo.demo && client === false && <a href="#/partners" className={`btn btn-ghost btn-sm ${route.startsWith("partners") ? "text-ink-100" : "text-ink-400"}`}>Partners</a>}
          {!repo.demo && <a href="#/settings" className={`btn btn-ghost btn-sm ${route.startsWith("settings") ? "text-ink-100" : "text-ink-400"}`}>Settings</a>}
          <span className="hidden px-2 text-sm text-ink-400 sm:inline">{session.username}</span>
          <button type="button" className="btn btn-sm" onClick={onSignOut}>{repo.demo ? "Exit demo" : "Sign out"}</button>
        </nav>
      </div>
    </header></>
  );

  if (err) return <>{header}<main className="mx-auto max-w-xl px-4 py-16"><div className="card flex flex-col gap-4 p-6"><h1 className="text-xl font-extrabold">Couldn't load your projects</h1><p className="text-sm text-ink-300">{err}</p><button className="btn btn-pri self-start" onClick={load}>Try again</button></div></main></>;
  if (!index) return <>{header}<SkelDashboard note={[repo.demo ? "Starting the demo" : "Unlocking your publishing token on this device", repo.demo ? "Loading the sample projects" : "Reading your projects", "Preparing the dashboard"][Math.min(2, bootAt)]} /></>;

  if (projectId) {
    if (!project) return <>{header}<main className="mx-auto max-w-xl px-4 py-16"><div className="card flex flex-col gap-4 p-6"><h1 className="text-xl font-extrabold">Project not found</h1><p className="text-sm text-ink-300">It may have been deleted on another device.</p><a className="btn btn-pri self-start" href="#/">Back to projects</a></div></main></>;
    return <>{updBanner}<ProjectView key={project.id} studio={studio} index={index} project={project} session={session} onIndex={setIndex} /></>;
  }

  // Design yourself: the chat that builds a preview (signed in, its previews are kept in the Studio).
  if (/^design(\?|$)/.test(route) && !hid("design")) return <DesignPage studio={studio} index={index} onIndex={setIndex} />;

  // Studio Partners: its own page (it used to be a tab of Settings; the old address still lands here).
  if ((route.startsWith("partners") || route === "settings/partners") && !repo.demo) {
    if (client === undefined) return <>{header}<main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-8 sm:px-6"><Skel className="h-9 w-56" /><SkelRows n={3} label="Loading Studio Partners" /></main></>;
    if (!client) return <>{header}<main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-8 sm:px-6"><h1 className="font-display text-3xl font-extrabold">Studio Partners</h1><p className="text-sm text-ink-300">Client Studios you set up and look after: what each one shows, its limits, sharing sites with it, and updating or moving it.</p><FoldAll /><FoldCards scope="partners"><PartnersTab studio={studio} index={index} session={session} onIndex={setIndex} /></FoldCards></main></>;
  }
  if (route.startsWith("settings") && !repo.demo) {
    // Customize: the Studio's name, badge, pages and admin menus. Hostings: accounts and where each site is hosted.
    const showCustomize = ["brand", "badge", "pages", "menus"].some((k) => !hid(k)), showHostings = !hid("hosting");
    const want = route.split("/")[1] || "general";
    const sharedOk = !role.managed || role.admin || !!role.privs.shared;
    const showDesign = !hid("design") && sharedOk, showThemes = !hid("themes") && sharedOk;
    const tab = (want === "customize" && !showCustomize) || (want === "hostings" && !showHostings) || (want === "design" && !showDesign) || (want === "themes" && !showThemes) ? "general" : want;
    // "social" and "login" are parts of General: they are listed under it, set in a little
    const adminTab = (k: string) => !role.managed || role.admin || !["social", "login", "hostings", "update", "migration", "roles", "pdefs"].includes(k);
    const tabList = ([["general", "General"], ["social", "Social setup"], ["login", "Studio login setup"], ...(role.api ? [["roles", "Role Management"]] : []), ["ai", "AI"], ...(showCustomize ? [["customize", "Customize"]] : []), ...(showHostings ? [["hostings", "Hostings"]] : []), ...(showDesign ? [["design", "Design yourself"]] : []), ...(showThemes ? [["themes", "Themes"]] : []), ["pdefs", "Project defaults"], ["update", "Updates"], ...(client ? [] : [["migration", "Migration"]]), ["help", "Help"]] as [string, string][]).filter(([k]) => adminTab(k));
    const here = tabList.some(([k]) => k === tab) ? tab : "general";
    /** The settings screen: its sections down the left on a wide screen (a row of tabs on a narrower one, a menu on a phone),
     *  and the chosen section using the rest of the width. */
    const shell = (body: ReactNode) => <>{header}
      <main className="mx-auto w-full max-w-[1680px] px-4 pb-20 pt-8 sm:px-6 lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start lg:gap-8">
        <aside className="flex flex-col gap-4 lg:card lg:sticky lg:top-20 lg:p-4">
          <h1 className="font-display text-3xl font-extrabold lg:px-1 lg:text-2xl">Settings</h1>
          {/* Phones: one dropdown, so the tabs never wrap onto a second row. */}
          <label className="flex flex-col gap-1.5 sm:hidden"><span className="label">Settings section</span>
            <select className="input" aria-label="Settings section" value={here} onChange={(e) => { location.hash = "#/settings" + (e.target.value === "general" ? "" : "/" + e.target.value); }}>{tabList.map(([k, l]) => <option key={k} value={k}>{SUB_TABS.includes(k) ? "General › " + l : l}</option>)}</select>
          </label>
          <nav className="hidden flex-wrap gap-1 border-b border-ink-700 sm:flex lg:flex-col lg:flex-nowrap lg:gap-0.5 lg:border-b-0" role="tablist" aria-label="Settings" aria-orientation="vertical">
            {tabList.map(([k, l]) => <a key={k} href={`#/settings${k === "general" ? "" : "/" + k}`} role="tab" aria-selected={tab === k}
              className={`-mb-px flex items-center gap-2.5 border-b-2 px-3 py-2 text-sm font-semibold transition lg:mb-0 lg:rounded-xl lg:border-b-0 lg:py-2.5 ${tab === k ? "border-brand-400 text-ink-100 lg:bg-brand-500/15" : "border-transparent text-ink-400 hover:text-ink-100 lg:hover:bg-ink-800"}`}>
              <SetIcon k={k} on={tab === k} />{l}</a>)}
          </nav>
          <SettingsFind tab={tab} tabs={tabList} />
        </aside>
        <div className="mt-4 flex min-w-0 flex-col gap-4 lg:mt-0" data-settings-body>{body}</div>
      </main></>;
    if (client === undefined && tab !== "general") return shell(<SkelRows n={3} label="Loading settings" />);
    // AI: the Studio's engine and (when Design yourself is offered) the AI choices of Design yourself, kept in this one place.
    if (tab === "ai") return shell(<><FoldAll /><FoldCards scope="ai">{showDesign
      ? <DesignLookTab session={session} studio={studio} index={index} onIndex={setIndex} part="ai" lead={<AiEngineCard studio={studio} index={index} onIndex={setIndex} />} />
      : <AiEngineCard studio={studio} index={index} onIndex={setIndex} />}</FoldCards></>);
    // General → Social setup: what connects the Studio to social networks (Instagram for the photo walls, Google for signing in).
    if (tab === "social") return shell(<><FoldAll /><FoldCards scope="social" className="set-cols">
      <p className="text-sm text-ink-300">How your Studio connects to social networks: Instagram for every site's photo wall, and Google for signing in.</p>
      <StudioInstagramCard />
      {session.cfg.owner === "cloudflare" ? <StudioGoogleCard /> : <section className="card flex flex-col gap-2 p-5" aria-label="Sign in with Google"><h3 className="text-[15px] font-extrabold">Sign in with Google</h3><p className="text-sm text-ink-300">Signing in with Google is for a Studio hosted on Cloudflare (Settings → Hostings).</p></section>}
    </FoldCards></>);
    // General → Studio login setup: how people sign in to this Studio, and who may.
    if (tab === "login") return shell(<><FoldAll /><FoldCards scope="login" className="set-cols">
      <p className="text-sm text-ink-300">How people sign in to this Studio, and who may: the email that carries the sign-in code, signing in with a PIN, and the list of people.</p>
      <StudioEmailCard repo={repo} />
      {session.cfg.owner === "cloudflare" ? <StudioPeopleCard /> : <section className="card flex flex-col gap-2 p-5" aria-label="People and PIN"><h3 className="text-[15px] font-extrabold">Sign in with a PIN, and who can sign in</h3><p className="text-sm text-ink-300">These are for a Studio hosted on Cloudflare (Settings → Hostings). This Studio signs in with its GitHub account.</p></section>}
    </FoldCards></>);
    // Role Management: people, their roles, and what each role can do (kept in the Studio's database).
    if (here === "roles") return shell(<div className="flex max-w-5xl flex-col gap-4"><p className="text-sm text-ink-300">Who can sign in to this Studio, the role each person has, and what each role is allowed to do. Each person has their own projects and their own choices; Administrators see everyone's.</p><RoleManagement api={role.api} scopeName={role.scope} where="studio" onView={(email) => { lookAt(email); location.hash = "#/"; }} /><PinCard api={role.api} /></div>);
    if (tab === "design") return shell(<DesignLookTab session={session} studio={studio} index={index} onIndex={setIndex} />);
    if (tab === "pdefs") return shell(<ProjectDefaultsTab studio={studio} index={index} onIndex={setIndex} demo={repo.demo} repo={repo} badge={hid("badge") ? undefined : <BadgeCard studio={studio} saved={index.badge} onIndex={setIndex} />} pages={hid("pages") ? undefined : <StudioPagesCard repo={repo} />} />);
    if (tab === "themes") return shell(<ThemesSettingsTab session={session} studio={studio} index={index} onIndex={setIndex} />);
    if (tab === "help") return shell(<div className="max-w-3xl"><StudioHelp /></div>);
    // Updates: this Studio build onto live sites, and (a hosted Studio) the Studio's own update.
    if (tab === "update" && !(isHosted(session) && !client)) return shell(<div className="flex max-w-4xl flex-col gap-4"><UpdateAllCard session={session} index={index} demo={repo.demo} /><PushUpdatesCard index={index} demo={repo.demo} /></div>);
    if ((tab === "migration" && !client) || tab === "update") return shell(<>{tab === "update" && <UpdateAllCard session={session} index={index} demo={repo.demo} />}{tab === "update" && <PushUpdatesCard index={index} demo={repo.demo} />}<FoldAll /><FoldCards scope={tab} className="set-cols"><MigrationTab key={tab} studio={studio} index={index} session={session} onIndex={setIndex} mode={tab === "update" ? "update" : "move"} /></FoldCards></>);
    return shell(<>
          <FoldAll />
          <FoldCards scope={tab === "customize" || tab === "hostings" ? tab : "general"} className="set-cols">
          {tab === "customize" ? <>
            <p className="text-sm text-ink-300">How your Studio and its sites' admin pages look: the Studio's name and logo, the Explorer helper and the admin menus. The “Powered by” badge and the Studio's own pages are in Project defaults → Studio.</p>
            {!hid("brand") && <BrandCard studio={studio} onIndex={setIndex} />}
            <ExplorerCard />
            {!hid("menus") && <MenusCard studio={studio} menus={index.menus || {}} onIndex={setIndex} />}
          </> : tab === "hostings" ? <>
            <section className="card flex flex-col gap-3 p-5" aria-label="Hosting accounts">
            <h3 className="text-[15px] font-extrabold">Hosting accounts</h3>
            <p className="text-sm text-ink-300">GitHub publishing creates each site's repository and turns on GitHub Pages; Cloudflare (free, no traffic limit) or Netlify hosts sites outside GitHub. Tokens stay on this device, encrypted. Each site's database details are kept with its project.</p>
            <HostFold id="github" title="GitHub (publishing)"><GitHubPublishAccount session={session} /></HostFold>
            <HostFold id="netlify" title="Netlify"><NetlifyAccount session={session} /></HostFold>
            <SetupAccounts session={session} index={index} />
          </section>
          <SitesHostingCard session={session} studio={studio} index={index} onIndex={setIndex} />
          </> : <>
          <p className="text-sm text-ink-300">Your Studio keeps everything as files in <b className="text-ink-100">{isHosted(session) ? `${session.cfg.owner === "cloudflare" ? "Cloudflare" : "Supabase"} (Studio “${session.cfg.repo}”)` : `${session.cfg.owner}/${session.cfg.repo}`}</b>: <code className="font-mono text-xs">studio.json</code> for the project list and <code className="font-mono text-xs">projects/</code> for each site's content, images and export snapshots.</p>
          <StudioWhatsAppCard />
          <NavLinksCard studio={studio} index={index} onIndex={setIndex} />
          {!hid("design") && <DesignPageCard />}
          <DashNumbersCard studio={studio} index={index} onIndex={setIndex} />
          {isHosted(session)
            ? <section className="card flex flex-col gap-3 p-5" aria-label="Account"><h3 className="text-[15px] font-extrabold">Account</h3><p className="text-sm text-ink-300">Signed in as <b className="text-ink-100">{session.username}</b> with an email code.</p><button type="button" className="btn self-start" onClick={onSignOut}>Sign out</button></section>
            : <AccountPanel ns={NS} session={session} onUpdated={onSession} onSignOut={onSignOut} onForget={onForget} />}
          </>}
          </FoldCards>
    </>);
  }

  const only = /^type\/([a-z]+)$/.exec(route)?.[1];
  return <>{header}<Dashboard under={role.managed ? <WhoseProjects role={role} viewAs={viewAs} onPick={lookAt} /> : undefined} key={(only || "all") + (route === "designs" ? "-d" : route === "design-queries" ? "-q" : "")} designsTab={hid("design") ? "" : route === "designs" ? "previews" : route === "design-queries" ? "queries" : ""} studio={studio} index={index} onIndex={setIndex} token={session.token} hid={hid} max={limits.max} only={only && TEMPLATES[only] ? only : undefined} /><footer className="py-6"><StudioPageLinks host={null} repo={repo} where="footer" /></footer></>;
}

/** Under "New project": whose projects are shown. An Administrator can view as anyone; everyone else sees their role. */
function WhoseProjects({ role, viewAs, onPick }: { role: ReturnType<typeof useMyRole>; viewAs: string; onPick: (email: string) => void }) {
  const [people, setPeople] = useState<{ email: string; role: string }[]>([]), [open, setOpen] = useState(false), [at, setAt] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { if (role.admin && role.api) cfCall<any>(role.api, "/roles?scope=" + encodeURIComponent(role.scope)).then((r) => setPeople((r.members || []).filter((m: any) => m.role !== "owner" && m.role !== "partner"))).catch(() => {}); }, [role.admin, role.api, role.scope]);
  useEffect(() => { if (!open) return; const out = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); }; addEventListener("mousedown", out); return () => removeEventListener("mousedown", out); }, [open]);
  if (!role.admin) return <p className="rounded-full border border-ink-700 bg-ink-900 px-3 py-1.5 text-[12.5px] text-ink-300" title="These are your own projects; only you and the Administrators see them.">Signed in as <b className="text-ink-100">{roleLabel(role.role)}</b></p>;
  if (!people.length) return null;
  const opts = [{ email: "", name: "Me and the Administrators", sub: "The Studio's main projects" }, ...people.map((m) => ({ email: m.email, name: m.email, sub: roleLabel(m.role) }))];
  const cur = opts.find((o) => o.email === viewAs) || opts[0];
  const pick = (email: string) => { setOpen(false); if (email !== viewAs) onPick(email); };
  const Face = ({ o }: { o: (typeof opts)[number] }) => <span aria-hidden className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-extrabold ${o.email ? "bg-brand-500/20 text-brand-200" : "bg-emerald-500/20 text-emerald-200"}`}>{o.email ? o.email[0].toUpperCase() : "★"}</span>;
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { setOpen(false); return; }
    if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) { e.preventDefault(); setAt(Math.max(0, opts.indexOf(cur))); setOpen(true); return; }
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setAt((n) => (n + 1) % opts.length); } else if (e.key === "ArrowUp") { e.preventDefault(); setAt((n) => (n - 1 + opts.length) % opts.length); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(opts[at].email); }
  };
  return (
    <div ref={box} className="relative flex items-center gap-2.5" onKeyDown={onKey}>
      <span id="viewas-l" className="text-[12.5px] font-semibold text-ink-300">View as</span>
      <button type="button" aria-haspopup="listbox" aria-expanded={open} aria-labelledby="viewas-l" onClick={() => { setAt(Math.max(0, opts.indexOf(cur))); setOpen((v) => !v); }}
        className={`flex min-w-[15rem] max-w-[20rem] items-center gap-2.5 rounded-full border bg-ink-900 py-1 pl-1 pr-3 text-left text-[13px] shadow-sm transition hover:border-ink-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400 ${open ? "border-brand-400" : viewAs ? "border-brand-500/60" : "border-ink-700"}`}>
        <Face o={cur} /><span className="min-w-0 flex-1 truncate font-semibold text-ink-100">{cur.name}</span>
        <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 text-ink-400 transition ${open ? "rotate-180" : ""}`}><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && <ul role="listbox" aria-labelledby="viewas-l" className="absolute right-0 top-full z-30 mt-2 max-h-80 w-[20rem] overflow-y-auto rounded-2xl border border-ink-700 bg-ink-900/95 p-1.5 shadow-2xl backdrop-blur">
        {opts.map((o, i) => (
          <li key={o.email || "me"} role="option" aria-selected={o.email === viewAs} onMouseEnter={() => setAt(i)} onClick={() => pick(o.email)}
            className={`flex cursor-pointer items-center gap-2.5 rounded-xl px-2 py-2 text-[13px] ${i === at ? "bg-ink-800" : ""}`}>
            <Face o={o} /><span className="min-w-0 flex-1"><span className="block truncate font-semibold text-ink-100">{o.name}</span><span className="block truncate text-[11.5px] text-ink-400">{o.sub}</span></span>
            {o.email === viewAs && <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-brand-300"><path d="M20 6 9 17l-5-5" /></svg>}
          </li>
        ))}
        {viewAs && <li className="mt-1 border-t border-ink-800 px-2.5 pb-1 pt-2 text-[11.5px] text-ink-400">You can open, edit and delete these. New projects are made in your own list.</li>}
      </ul>}
    </div>
  );
}
/** Settings → Help: guided tours of the Studio, end to end. */
/** Parts of General, listed under it in the settings menu. */
const SUB_TABS = ["social", "login"];
/** A small line icon for each settings section. */
const SET_ICONS: Record<string, string> = {
  pdefs: "M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  roles: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  social: "M7 3h10a4 4 0 014 4v10a4 4 0 01-4 4H7a4 4 0 01-4-4V7a4 4 0 014-4zM12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM17.2 6.8h.01",
  login: "M12 3a4 4 0 00-4 4v3H6.5A1.5 1.5 0 005 11.5v8A1.5 1.5 0 006.5 21h11a1.5 1.5 0 001.5-1.5v-8a1.5 1.5 0 00-1.5-1.5H16V7a4 4 0 00-4-4zM10 10V7a2 2 0 014 0v3M12 14v3",
  ai: "M9 4h6a3 3 0 013 3v6a3 3 0 01-3 3H9a3 3 0 01-3-3V7a3 3 0 013-3zM9.5 9.5h.01M14.5 9.5h.01M9.5 12.5c.8.7 1.6 1 2.5 1s1.7-.3 2.5-1M12 4V2M8 16v3M16 16v3M6 10H4M20 10h-2",
  general: "M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM19 12a7 7 0 00-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 00-2-1.2L14.2 3h-4.4l-.4 2.6a7 7 0 00-2 1.2l-2.3-.9-2 3.4 2 1.5a7 7 0 000 2.4l-2 1.5 2 3.4 2.3-.9a7 7 0 002 1.2l.4 2.6h4.4l.4-2.6a7 7 0 002-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z",
  customize: "M4 20l4-1 11-11-3-3L5 16l-1 4zM14 6l3 3",
  hostings: "M4 5h16v6H4zM4 13h16v6H4zM7.5 8h.01M7.5 16h.01",
  design: "M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3zM18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z",
  themes: "M4 5h7v7H4zM13 5h7v4h-7zM13 11h7v8h-7zM4 14h7v5H4z",
  update: "M20 12a8 8 0 01-14.3 4.9M4 12a8 8 0 0114.3-4.9M18.5 3.5v4h-4M5.5 20.5v-4h4",
  migration: "M4 8h13l-3-3M20 16H7l3 3",
  help: "M12 21a9 9 0 100-18 9 9 0 000 18zM9.6 9.3a2.5 2.5 0 114 2c-.9.6-1.6 1.2-1.6 2.3M12 17h.01",
};
function SetIcon({ k, on }: { k: string; on: boolean }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={`hidden shrink-0 lg:block ${on ? "text-brand-400" : "text-ink-500"}`}><path d={SET_ICONS[k] || SET_ICONS.general} /></svg>;
}
/** Every settings section, for the find box: its tab, its title, other words people look for it by, and (when the title alone
 *  is not what the card says) the word that picks its card out on that tab. */
const SET_INDEX: [tab: string, title: string, words: string, find?: string][] = [
  ["pdefs", "Project defaults", "defaults every project email templates resend whatsapp sms privacy policy terms of use cookie consent wording india international payment upi razorpay gateway shipping returns refunds cancellation shop policies form consent spam footer credit powered by gst invoice tax checkout abandoned cart"],
  ["ai", "AI engine", "ai openai gemini groq openrouter cloudflare api key model translate write provider chatgpt"],
  ["ai", "AI for Design yourself", "diy ai writes text reads pdf engine"],
  ["ai", "Pictures drawn by AI", "diy draw logo banner images picture style unsplash photos"],
  ["general", "WhatsApp", "meta messages otp business phone"],
  ["social", "Instagram photos", "instagram token social wall handle meta feed posts"],
  ["social", "Sign in with Google", "google login client id oauth", "Google"],
  ["general", "SMS", "text messages codes otp"],
  ["general", "Header links", "menu navigation top links"],
  ["general", "Design yourself page", "diy show hide themes page submissions", "Design yourself"],
  ["general", "Dashboard numbers", "stats counts projects published"],
  ["general", "Account and sign-in", "login password username sign out session device token", "Sign"],
  ["customize", "Studio name & logo", "brand colours colors layout glass classic soft sharp dark light icon animation", "Studio name"],
  ["pdefs", "“Powered by” badge", "badge footer credit studio"],
  ["pdefs", "Additional pages", "studio pages public about terms privacy"],
  ["login", "Sign-in email", "email template code mail"],
  ["login", "Sign in with a PIN", "pin code digits login"],
  ["login", "Who can sign in to this Studio", "owners members team people access"],
  ["customize", "Picaffectz Explorer", "helper assistant search ctrl k", "Explorer"],
  ["customize", "Admin menus", "site admin menu sections rename order headings"],
  ["hostings", "Hosting accounts", "github netlify cloudflare token publishing pages"],
  ["hostings", "Sites and hosting accounts", "database domain worker sites d1 update"],
  ["design", "Design yourself: its own web address", "diy domain address", "web address"],
  ["design", "Design yourself: questions", "diy questions wording hide ask", "Questions"],
  ["design", "Design yourself: page look", "diy chat colours colors bubbles shape header top bar buttons accent fonts logo name light dark", "Page look"],
  ["design", "Design yourself: background and text", "diy background picture video slideshow animated pattern text colour", "Background and text"],
  ["design", "Design yourself: notice bar", "diy notice strip message preview", "Notice bar"],
  ["design", "Design yourself: themes", "diy themes shown preview tick", "Themes ·"],
  ["design", "Design yourself: layout, style and interactions", "diy layout style interactions effects", "Layout, style"],
  ["design", "Design yourself: colours", "diy colours colors palette brand", "Colours"],
  ["themes", "Theme gallery: its own web address", "themes domain address gallery", "web address"],
  ["themes", "Theme gallery: what it says", "themes title heading text words", "What it says"],
  ["themes", "Theme gallery: what it shows", "themes types limit filter how many", "What it shows"],
  ["update", "Update everything", "update all one press studio database sites live code worker latest", "Update everything"],
  ["update", "Studio updates", "update version push live sites database worker latest", "update"],
  ["migration", "Move the Studio", "migration migrate move github cloudflare supabase files where runs", "Studio"],
  ["help", "Guided tours", "help tour guide walkthrough how"],
];
/** Finds a setting. While something is typed it lists the matching sections from every tab (press one to go there), and on the
 *  open tab it puts away the cards that don't mention the words. */
function SettingsFind({ tab, tabs }: { tab: string; tabs: [string, string][] }) {
  const [q, setQ] = useState(""), [note, setNote] = useState(""), jump = useRef(false);
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const label = (k: string) => tabs.find((t) => t[0] === k)?.[1] || "";
  const hits = !words.length ? [] : SET_INDEX.filter(([t, title, extra]) => label(t) && words.every((w) => `${title} ${extra} ${label(t)}`.toLowerCase().includes(w))).slice(0, 8);
  useEffect(() => {
    const cards = () => [...document.querySelectorAll<HTMLElement>("[data-settings-body] .card")].filter((c) => !c.parentElement?.closest(".card") && !c.classList.contains("sticky"));
    const clear = () => cards().forEach((c) => c.removeAttribute("data-find-hide"));
    const w = q.toLowerCase().split(/\s+/).filter(Boolean);
    const apply = () => {
      const all = cards(); if (!w.length) { clear(); setNote(""); return; }
      const on = all.filter((c) => w.every((x) => (c.textContent || "").toLowerCase().includes(x)));
      // nothing on this tab mentions it: the tab is left whole (the list above says where it is)
      all.forEach((c) => c.toggleAttribute("data-find-hide", !!on.length && !on.includes(c)));
      setNote(on.length ? `Showing ${on.length} of ${all.length} sections on this tab.` : all.length ? "Not on this tab." : "");
      if (jump.current && on.length) { jump.current = false; on.forEach((c) => { (c as any).__fold?.(false); if (c instanceof HTMLDetailsElement) c.open = true; }); on[0].scrollIntoView({ block: "start", behavior: "smooth" }); }
    };
    // the tab's cards can arrive a moment after the tab opens
    const t = [0, 250, 900].map((ms) => setTimeout(apply, ms));
    // ...and a card that is drawn again later is put away again
    let later = 0; const body = document.querySelector("[data-settings-body]"), mo = new MutationObserver(() => { clearTimeout(later); later = window.setTimeout(apply, 120); });
    if (body && w.length) mo.observe(body, { childList: true, subtree: true });
    return () => { t.forEach(clearTimeout); clearTimeout(later); mo.disconnect(); clear(); };
  }, [q, tab]);
  const go = (t: string, find: string) => { jump.current = true; setQ(find); if (t !== tab) location.hash = "#/settings" + (t === "general" ? "" : "/" + t); };
  return (
    <div className="hidden flex-col gap-1.5 lg:flex">
      <label className="flex flex-col gap-1.5"><span className="label">Find a setting</span>
        <span className="relative flex">
          <input type="text" inputMode="search" autoComplete="off" className="input py-2 pr-8 text-sm" placeholder="e.g. WhatsApp, badge" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") setQ(""); if (e.key === "Enter" && hits[0]) { e.preventDefault(); go(hits[0][0], hits[0][3] || hits[0][1]); } }} />
          {q && <button type="button" aria-label="Clear the search" className="absolute right-1.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-ink-400 hover:bg-ink-800 hover:text-ink-100" onClick={() => setQ("")}>×</button>}
        </span>
      </label>
      {words.length > 0 && <div className="flex flex-col gap-0.5" role="list" aria-label="Matching settings">
        {hits.map(([t, title, , find]) => <button key={t + title} type="button" role="listitem" onClick={() => go(t, find || title)} className="flex flex-col rounded-lg px-2 py-1.5 text-left transition hover:bg-ink-800">
          <span className="text-[13px] font-semibold text-ink-100">{title}</span><span className="text-[11px] text-ink-400">{label(t)}{t === tab ? " · this tab" : ""}</span></button>)}
        {!hits.length && <span className="hint px-2">No section is listed under those words.</span>}
      </div>}
      <span className="hint min-h-[1rem] px-2" role="status">{note}</span>
    </div>
  );
}
function StudioHelp() {
  return (
    <section className="card flex flex-col gap-3 p-5" aria-label="Guided tours">
      <h3 className="text-[15px] font-extrabold">Guided tours</h3>
      <p className="text-sm text-ink-300">Pop-ups that point at the real buttons and move between screens for you. Press Next, or use the arrow keys; Escape stops.</p>
      <div className="flex flex-col gap-2">
        {GUIDES.map((g) => (
          <div key={g.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-ink-700 p-3">
            <div className="min-w-0 flex-1"><b className="block text-ink-100">{g.title}</b><span className="text-[13px] text-ink-400">{g.blurb} · {g.steps.length} steps</span></div>
            <button type="button" className="btn btn-pri btn-sm" onClick={() => guide.play(g.id)}>Start tour</button>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Settings → General → which numbers the dashboard shows at the top. */
function DashNumbersCard({ studio, index, onIndex }: { studio: Studio; index: StudioIndex; onIndex: (i: StudioIndex) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const chosen = index.dash?.stats?.length ? index.dash.stats : DASH_DEFAULT;
  const toggle = async (key: string) => {
    const next = chosen.includes(key) ? chosen.filter((k) => k !== key) : [...chosen, key];
    if (!next.length) return toast("Keep at least one number, or they all hide.", "bad");
    setBusy(true);
    try { onIndex(await studio.updateIndex((i) => { i.dash = { stats: DASH_STATS.map((d) => d.key).filter((k) => next.includes(k)) }; }, "Choose the dashboard's numbers")); }
    catch (e) { toast(explain(e), "bad"); }
    setBusy(false);
  };
  return (
    <section className="card flex flex-col gap-3 p-5" aria-label="Dashboard numbers">
      <h3 className="text-[15px] font-extrabold">Dashboard numbers</h3>
      <p className="text-sm text-ink-300">Tick the numbers to show at the top of the Projects page. Each shows today's count from your projects.</p>
      <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
        {DASH_STATS.map((d) => <label key={d.key} className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-brand-500" checked={chosen.includes(d.key)} disabled={busy} onChange={() => toggle(d.key)} /><span className="flex-1">{d.label}</span><span className="font-display text-base font-extrabold tabular-nums text-ink-200">{d.count(index.projects)}</span></label>)}
      </div>
    </section>
  );
}

/** Settings → the Studio's own name and logo (saved in studio.json, so every device shows them). */
// Ready-made colour schemes for the Studio. Each is one accent colour; the buttons, links and backgrounds follow it.
function BrandCard({ studio, onIndex }: { studio: Studio; onIndex: (i: StudioIndex) => void }) {
  const toast = useToast();
  const b = useBrand();
  const [name, setName] = useState(b.name);
  const [logo, setLogo] = useState<string | null>(null); // null: unchanged, "": remove
  const [busy, setBusy] = useState(false);
  const shown = logo === null ? b.logo : logo;
  // The Studio's colours: the standard ones, the logo's main colour (read here), a ready-made scheme or any colour.
  // Whichever is chosen is saved as one colour with the name, so every device gets it.
  const [pick, setPick] = useState<string>(() => !b.tint ? "standard" : SCHEMES.find((x) => x.hex.toLowerCase() === b.tint!.toLowerCase())?.id || "logo");
  const [custom, setCustom] = useState(b.tint || "#4A67F0");
  const [accent, setAccent] = useState<string | null | undefined>(undefined); // undefined: reading
  useEffect(() => { let on = true; setAccent(undefined); (shown ? accentFromImage(shown) : Promise.resolve(null)).then((a) => { if (on) setAccent(a); }); return () => { on = false; }; }, [shown]);
  // A saved colour that is neither a scheme nor this logo's colour was picked by hand.
  useEffect(() => { if (pick === "logo" && logo === null && b.tint && accent !== undefined && (accent || "").toLowerCase() !== b.tint.toLowerCase()) setPick("custom"); }, [accent]); // eslint-disable-line react-hooks/exhaustive-deps
  const chosen = pick === "standard" ? "" : pick === "logo" ? (shown && accent) || "" : pick === "custom" ? custom : SCHEMES.find((x) => x.id === pick)?.hex || "";
  const tint = chosen, waiting = pick === "logo" && !!shown && accent === undefined;
  const [mode, setMode] = useState<"dark" | "light">(b.mode === "light" ? "light" : "dark");
  const pal = chosen ? tintPalette(chosen, mode) : null;
  const [anim, setAnim] = useState(b.anim || "");
  const [layout, setLayout] = useState(b.layout || "classic");
  const same = tint.toLowerCase() === (b.tint || "").toLowerCase() && mode === (b.mode || "dark") && anim === (b.anim || "") && (layout === "classic" ? "" : layout) === (b.layout || "");
  const save = async () => {
    setBusy(true);
    try {
      const i = await studio.saveBrand(name.trim() || DEFAULT_NAME, logo, tint, mode, anim, layout === "classic" ? "" : layout);
      onIndex(i);
      setBrand({ name: name.trim() || DEFAULT_NAME, logo: shown, v: i.brand?.v, tint, mode, anim, layout: layout === "classic" ? "" : layout });
      setLogo(null);
      toast(tint ? `Saved. The Studio now wears ${pick === "logo" ? "the logo's colours" : "the new colours"}${mode === "light" ? " in light mode" : ""} on every device you sign in on.` : "Saved. Every device you sign in on shows the new name and logo.");
    } catch (e) { toast(explain(e), "bad"); }
    setBusy(false);
  };
  return (
    <section className="card flex flex-col gap-4 p-5">
      <h3 className="text-[15px] font-extrabold">Studio name & logo</h3>
      <Field label="Studio name" htmlFor="b-name" hint="Shown in the header, the browser tab, the sign-in screen and the shareable theme gallery."><input id="b-name" className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} /></Field>
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid h-16 w-16 place-items-center rounded-xl border border-ink-600 bg-ink-950"><span data-logo-anim={anim || undefined} className="grid h-full w-full place-items-center overflow-hidden rounded-xl">{shown ? <img src={shown} alt="Studio logo" className="h-full w-full object-cover" /> : <Logo size={10} />}</span></div>
        <label className="btn btn-sm relative cursor-pointer">Upload logo / icon<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; try { setLogo(await shrinkImage(f)); } catch (x) { toast(explain(x), "bad"); } }} /></label>
        {shown && <button type="button" className="btn btn-sm" onClick={() => setLogo("")}>Remove</button>}
        <span className="hint">A square image works best. It's also the browser-tab icon.</span>
      </div>
      <div className="flex flex-col gap-1.5"><span className="label">Studio look</span>
        <div className="flex self-start rounded-lg border border-ink-600" role="radiogroup" aria-label="Studio look">
          {([["dark", "Dark"], ["light", "Light"]] as const).map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={mode === k} onClick={() => setMode(k)} className={`btn btn-sm border-0 ${mode === k ? "bg-ink-700" : "bg-transparent"}`}>{l}</button>)}
        </div>
        <span className="hint">Works with any of the colours below.</span>
      </div>
      <div className="flex flex-col gap-2" role="radiogroup" aria-label="Studio layout">
        <span className="label">Studio layout</span>
        <div className="grid gap-2 sm:grid-cols-2">
          {UI_LAYOUTS.map(([k, l, d]) => <button key={k} type="button" role="radio" aria-checked={layout === k} onClick={() => { setLayout(k); if (k === "classic") delete document.documentElement.dataset.layout; else document.documentElement.dataset.layout = k; }} className={`rounded-xl border p-3 text-left ${layout === k ? "border-brand-400 bg-ink-700" : "border-ink-600 hover:bg-ink-800"}`}><b className="block text-sm">{l}</b><span className="hint">{d}</span></button>)}
        </div>
        <span className="hint">Changes how every Studio screen looks, on every device you sign in on. Shown live here; Save to keep it.</span>
      </div>
      <div className="flex flex-col gap-3 rounded-xl border border-ink-700 p-3" role="radiogroup" aria-label="Studio colours">
        <span className="label">Studio colours</span>
        <div className="flex flex-wrap gap-2">
          <button type="button" role="radio" aria-checked={pick === "standard"} onClick={() => setPick("standard")} className={`btn btn-sm ${pick === "standard" ? "border-brand-400 bg-ink-700" : ""}`}>Standard</button>
          <button type="button" role="radio" aria-checked={pick === "logo"} disabled={!shown} title={shown ? "" : "Upload a logo first"} onClick={() => setPick("logo")} className={`btn btn-sm ${pick === "logo" ? "border-brand-400 bg-ink-700" : ""}`}>From the logo</button>
          <label className={`btn btn-sm relative cursor-pointer ${pick === "custom" ? "border-brand-400 bg-ink-700" : ""}`}><span aria-hidden className="h-4 w-4 rounded border border-white/20" style={{ background: custom }} />Your own colour<input type="color" className="sr-only" aria-label="Your own colour" value={custom} onChange={(e) => { setCustom(e.target.value); setPick("custom"); }} onClick={() => setPick("custom")} /></label>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Colour schemes">
          {SCHEMES.map((x) => <button key={x.id} type="button" role="radio" aria-checked={pick === x.id} aria-label={x.name} title={x.name} onClick={() => setPick(x.id)} className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[13px] ${pick === x.id ? "border-brand-400 bg-ink-700 text-ink-100" : "border-ink-600 text-ink-300 hover:bg-ink-800"}`}><i aria-hidden className="h-4 w-4 rounded-full border border-white/20" style={{ background: tintPalette(x.hex, mode)["brand-500"] }} />{x.name}</button>)}
        </div>
        {pick === "logo" && !shown ? <p className="hint">Upload a logo first. Its main colour becomes the Studio's accent, and the background leans toward it.</p>
          : waiting ? <p className="hint">Reading the logo's colours…</p>
          : pick === "logo" && !accent ? <p className="text-[13px] text-amber-200">This logo is black, white or grey, so there's no colour to take from it. Choose a scheme or your own colour instead.</p>
          : pick === "standard" || !pal ? <p className="hint">{same ? "The Studio's standard colours are in use." : "Save to go back to the Studio's standard colours."}</p>
          : <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-300" aria-label="Colour preview">
              <span>{pick === "logo" ? "From this logo:" : "Preview:"}</span>
              {["brand-600", "brand-500", "brand-400", "brand-300", "ink-800", "ink-950"].map((k) => <span key={k} title={pal[k]} className="h-6 w-6 rounded-md border border-white/15" style={{ background: pal[k] }} />)}
              <span className="rounded-lg px-3 py-1.5 text-[13px] font-bold text-white" style={{ background: pal["brand-500"] }}>Button</span>
              <span className="hint">{same ? "In use." : "Save to use it on every device."}</span>
            </div>}
      </div>
      <Field label="Logo animation" htmlFor="b-anim" hint="A quiet movement on the Studio's logo in the header and on the sign-in screen. The little preview above shows it. Still for anyone who asks their device for less motion."><select id="b-anim" className="input" value={anim} onChange={(e) => setAnim(e.target.value)}>{LOGO_ANIMS.map(([k, l]) => <option key={k || "none"} value={k}>{l}</option>)}</select></Field>
      <button type="button" className="btn btn-pri self-start" disabled={busy || waiting || (name.trim() === b.name && logo === null && same)} onClick={save}>{busy ? "Saving…" : "Save name & look"}</button>
    </section>
  );
}

/** Settings → the "Powered by" badge every site shows: one look for all sites. Each project only shows or hides it. */
function BadgeCard({ studio, saved, onIndex }: { studio: Studio; saved?: BadgeCfg; onIndex: (i: StudioIndex) => void }) {
  const toast = useToast();
  const start = cleanBadge(saved || BADGE_DEFAULT);
  const [b, setB] = useState<BadgeCfg>(start);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(cleanBadge(b)) !== JSON.stringify(start);
  const set = (o: Partial<BadgeCfg>) => setB((x) => ({ ...x, ...o }));
  const save = async () => {
    if (b.url && !/^https?:\/\//i.test(b.url)) return toast("The link must start with https://", "bad");
    setBusy(true);
    try { onIndex(await studio.saveBadge(b)); toast("Saved. Publish a site or use Settings → Updates → Push Studio updates to live sites to show it there."); }
    catch (e) { toast(explain(e), "bad"); }
    setBusy(false);
  };
  return (
    <section className="card flex flex-col gap-4 p-5" aria-label="Powered by badge">
      <h3 className="text-[15px] font-extrabold">“Powered by” badge</h3>
      <p className="text-sm text-ink-300">The small link in the bottom-right corner of every site. Set its look once here; show or hide it per site in each project under <b className="text-ink-100">Admin page → “Powered by” badge</b>.</p>
      <div className="grid place-items-end rounded-xl border border-ink-700 bg-[repeating-linear-gradient(45deg,#1a2030_0_10px,#151a26_10px_20px)] p-4" aria-label="Badge preview"><BadgePreview b={resolveBadge(b)} /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Text" htmlFor="bd-text"><input id="bd-text" className="input" maxLength={60} value={b.text} onChange={(e) => set({ text: e.target.value })} placeholder={BADGE_DEFAULT.text} /></Field>
        <Field label="Link" htmlFor="bd-url" hint="Leave empty to open this Studio's own Themes page. Opens in a new tab."><input id="bd-url" className="input" value={b.url} onChange={(e) => set({ url: e.target.value.trim() })} placeholder={studioLook().url} /></Field>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5"><span className="label">Size</span>
          <div className="flex rounded-lg border border-ink-600" role="radiogroup" aria-label="Badge size">
            {([["s", "Small"], ["m", "Medium"], ["l", "Large"]] as const).map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={b.size === k} onClick={() => set({ size: k })} className={`btn btn-sm border-0 ${b.size === k ? "bg-ink-700" : "bg-transparent"}`}>{l}</button>)}
          </div>
        </div>
        <label className="flex items-center gap-2 self-center text-sm"><input type="checkbox" checked={!b.bg} onChange={(e) => set(e.target.checked ? { bg: "", fg: "" } : { bg: resolveBadge(b).bg, fg: resolveBadge(b).fg })} />Use the Studio's colour</label>
        <label className="flex flex-col gap-1.5"><span className="label">Background</span><span className="flex items-center gap-2"><input type="color" aria-label="Badge background colour" disabled={!b.bg} className="h-9 w-12 cursor-pointer rounded border border-ink-600 bg-transparent disabled:opacity-40" value={resolveBadge(b).bg} onChange={(e) => set({ bg: e.target.value.toUpperCase(), fg: b.fg || resolveBadge({ ...b, bg: e.target.value }).fg })} /><code className="font-mono text-xs text-ink-400">{resolveBadge(b).bg}</code></span></label>
        <label className="flex flex-col gap-1.5"><span className="label">Text colour</span><span className="flex items-center gap-2"><input type="color" aria-label="Badge text colour" disabled={!b.bg} className="h-9 w-12 cursor-pointer rounded border border-ink-600 bg-transparent disabled:opacity-40" value={resolveBadge(b).fg} onChange={(e) => set({ fg: e.target.value.toUpperCase() })} /><code className="font-mono text-xs text-ink-400">{resolveBadge(b).fg}</code></span></label>
      </div>
      <div className="flex flex-col gap-1.5"><span className="label">Icon</span>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-ink-600" role="radiogroup" aria-label="Badge icon">
            {([["mark", "Picaffectz mark"], ["custom", "My icon"], ["none", "No icon"]] as const).map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={b.icon === k} disabled={k === "custom" && !b.iconData} onClick={() => set({ icon: k })} className={`btn btn-sm border-0 ${b.icon === k ? "bg-ink-700" : "bg-transparent"}`}>{l}</button>)}
          </div>
          <label className="btn btn-sm relative cursor-pointer">{b.iconData ? "Replace icon" : "Upload icon"}<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; try { set({ iconData: await shrinkImage(f, 64), icon: "custom" }); } catch (x) { toast(explain(x), "bad"); } }} /></label>
          <span className="hint">A square image works best; it's shrunk to a small icon.</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-pri" disabled={busy || !dirty} onClick={save}>{busy ? "Saving…" : "Save badge"}</button>
        <button type="button" className="btn" disabled={busy} onClick={() => setB({ ...BADGE_DEFAULT })}>Reset to default</button>
      </div>
    </section>
  );
}

/** The badge as sites draw it (fx.js), for the Settings preview. */
function BadgePreview({ b }: { b: BadgeCfg }) {
  const z = ({ s: [10, 4, 9, 11], m: [11, 5, 11, 14], l: [13, 7, 14, 18] } as const)[b.size];
  return (
    <span className="inline-flex items-center rounded-full border border-white/15 font-semibold shadow-lg" style={{ background: b.bg, color: b.fg, fontSize: z[0], padding: `${z[1]}px ${z[2] + 2}px ${z[1]}px ${z[2]}px`, gap: Math.round(z[3] / 2), lineHeight: 1.25, fontFamily: "system-ui,-apple-system,'Segoe UI',Roboto,sans-serif" }}>
      {b.icon === "mark" && <span className="inline-grid flex-none place-items-center rounded-[3px] bg-white" style={{ width: z[3], height: z[3] }} aria-hidden><img src={MARK_URI} alt="" style={{ height: Math.round(z[3] * 0.8), width: "auto" }} /></span>}
      {b.icon === "custom" && b.iconData && <img src={b.iconData} alt="" className="block rounded-[3px] object-cover" style={{ width: z[3], height: z[3] }} />}
      {b.text || BADGE_DEFAULT.text}
    </span>
  );
}
