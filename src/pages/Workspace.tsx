import { useEffect, useMemo, useState } from "react";
import { isHosted } from "../lib/backend";
import type { Session } from "../lib/auth";
import { explain, type Repo } from "../lib/repo";
import { Studio, type StudioIndex } from "../lib/studio";
import { siteRepoFor } from "../lib/hosting";
import { AccountPanel } from "../ui/gate";
import { NetlifyAccount } from "./HostDialog";
import { GitHubPublishAccount } from "./GitHubAccount";
import { SetupAccounts } from "./SetupAccounts";
import { ghPublish } from "../lib/ghpublish";
import { Field, Logo, StepLoader, useToast } from "../ui/kit";
import { setCurrentMenus } from "../lib/menus";
import { MenusCard } from "./MenusCard";
import { MigrationTab } from "./MigrationTab";
import { PartnersTab } from "./PartnersTab";
import { BADGE_DEFAULT, cleanBadge, setCurrentBadge, type BadgeCfg } from "../lib/badge";
import { MARK_URI } from "../ui/logo";
import { FoldAll, FoldCards } from "../ui/fold";
import { BrandMark, DEFAULT_NAME, brand as currentBrand, setBrand, shrinkImage, useBrand } from "../lib/brand";
import { Dashboard } from "./Dashboard";
import { ProjectView } from "./ProjectView";
import { NS } from "./App";
import { autoUpdateStudio } from "../lib/autoupdate";

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
  const studio = useMemo(() => {
    const st = new Studio(repo);
    if (!repo.demo) st.siteRepo = (p) => siteRepoFor(p, session.token);
    return st;
  }, [repo, session.token]);
  const [index, setIndex] = useState<StudioIndex | null>(null);
  const [err, setErr] = useState("");
  const [bootAt, setBootAt] = useState(0);
  const hash = useHash();

  const load = () => {
    setErr(""); setBootAt(1);
    studio.loadIndex().then((i) => { setBootAt(2); setIndex(i); }).catch((e) => setErr(explain(e)));
  };
  // The publishing token (if any) is unlocked first, so live-site checks can read the sites' repositories.
  useEffect(() => { let on = true; (repo.demo ? Promise.resolve(null) : ghPublish.load(session.token)).finally(() => { if (on) load(); }); return () => { on = false; }; }, [studio]);
  const b = useBrand();
  useEffect(() => { document.title = b.name; }, [b.name]);
  // The "Powered by" badge's look, used when building sites and in previews.
  useEffect(() => { setCurrentBadge(index?.badge); }, [index?.badge]);
  useEffect(() => { setCurrentMenus(index?.menus); }, [index?.menus]);
  // A moved Studio updates itself to the latest build when it opens (projects aren't touched).
  const [updating, setUpdating] = useState("");
  const hostedId = index?.hosted?.siteId;
  useEffect(() => {
    if (!index || repo.demo || !isHosted(session)) return;
    autoUpdateStudio(session, index, setUpdating).then((r) => { if (r === "updated") { setUpdating("Updated. Reloading"); setTimeout(() => location.reload(), 900); } else setUpdating(""); })
      .catch((e) => { console.warn("Studio update:", e?.message || e); setUpdating(""); });
  }, [hostedId]);
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

  const updBanner = updating ? <div role="status" className="fixed bottom-4 left-4 z-50 max-w-sm rounded-lg border border-brand-500/40 bg-ink-900 px-4 py-2.5 text-[13px] text-ink-100 shadow-xl">Updating the Studio to the latest version: {updating}…<br /><span className="text-ink-400">Your projects aren't touched.</span></div> : null;
  const header = (<>{updBanner}
    <header className="sticky top-0 z-40 border-b border-ink-700 bg-ink-950/90 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <a href="#/" className="flex items-center gap-2.5 font-extrabold"><BrandMark fallback={<Logo />} />{b.name}</a>
        {repo.demo && <span className="chip border-amber-400/50 text-amber-200">Demo · nothing is saved</span>}
        {!repo.demo && !isHosted(session) && olderData() && <a href="?data=shared" className="chip border-amber-400/50 text-amber-200" title="This tab shows the GitHub data from before the Studio moved. Press to go back to the shared projects.">Older GitHub data · switch back</a>}
        <nav className="ml-auto flex items-center gap-1" aria-label="Studio">
          <a href="#/" className={`btn btn-ghost btn-sm ${!route || route === "/" ? "text-ink-100" : "text-ink-400"}`}>Projects</a>
          <a href="#/themes" className="btn btn-ghost btn-sm text-ink-400">Themes</a>
          {!repo.demo && <a href="#/settings" className={`btn btn-ghost btn-sm ${route.startsWith("settings") ? "text-ink-100" : "text-ink-400"}`}>Settings</a>}
          <span className="hidden px-2 text-sm text-ink-400 sm:inline">{session.username}</span>
          <button type="button" className="btn btn-sm" onClick={onSignOut}>{repo.demo ? "Exit demo" : "Sign out"}</button>
        </nav>
      </div>
    </header></>
  );

  if (err) return <>{header}<main className="mx-auto max-w-xl px-4 py-16"><div className="card flex flex-col gap-4 p-6"><h1 className="text-xl font-extrabold">Couldn't load your projects</h1><p className="text-sm text-ink-300">{err}</p><button className="btn btn-pri self-start" onClick={load}>Try again</button></div></main></>;
  if (!index) return <>{header}<main className="grid place-items-center py-24"><StepLoader title="Loading the Studio" at={bootAt} steps={[repo.demo ? "Starting the demo" : "Unlocking your publishing token on this device", repo.demo ? "Loading the sample projects" : `Reading your projects from ${session.cfg.owner}/${session.cfg.repo}`, "Preparing the dashboard"]} /></main></>;

  if (projectId) {
    if (!project) return <>{header}<main className="mx-auto max-w-xl px-4 py-16"><div className="card flex flex-col gap-4 p-6"><h1 className="text-xl font-extrabold">Project not found</h1><p className="text-sm text-ink-300">It may have been deleted on another device.</p><a className="btn btn-pri self-start" href="#/">Back to projects</a></div></main></>;
    return <>{updBanner}<ProjectView key={project.id} studio={studio} index={index} project={project} session={session} onIndex={setIndex} /></>;
  }

  if (route.startsWith("settings") && !repo.demo) {
    const tab = route.split("/")[1] || "general";
    const tabs = <div className="flex flex-wrap gap-1 border-b border-ink-700" role="tablist" aria-label="Settings">
      {[["general", "General"], ["migration", "Migration"], ["partners", "Studio Partners"]].map(([k, l]) => <a key={k} href={`#/settings${k === "general" ? "" : "/" + k}`} role="tab" aria-selected={tab === k} className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${tab === k ? "border-brand-400 text-ink-100" : "border-transparent text-ink-400 hover:text-ink-100"}`}>{l}</a>)}
    </div>;
    if (tab === "partners") return <>{header}<main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-8 sm:px-6"><h1 className="font-display text-3xl font-extrabold">Settings</h1>{tabs}<FoldAll /><FoldCards scope="partners"><PartnersTab studio={studio} index={index} session={session} onIndex={setIndex} /></FoldCards></main></>;
    if (tab === "migration") return <>{header}<main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-8 sm:px-6"><h1 className="font-display text-3xl font-extrabold">Settings</h1>{tabs}<FoldAll /><FoldCards scope="migration"><MigrationTab studio={studio} index={index} session={session} onIndex={setIndex} /></FoldCards></main></>;
    return (
      <>{header}
        <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-8 sm:px-6">
          <h1 className="font-display text-3xl font-extrabold">Settings</h1>
          {tabs}
          <FoldAll />
          <FoldCards scope="general">
          <p className="text-sm text-ink-300">Your Studio keeps everything as files in <b className="text-ink-100">{isHosted(session) ? `${session.cfg.owner === "cloudflare" ? "Cloudflare" : "Supabase"} (Studio “${session.cfg.repo}”)` : `${session.cfg.owner}/${session.cfg.repo}`}</b>: <code className="font-mono text-xs">studio.json</code> for the project list and <code className="font-mono text-xs">projects/</code> for each site's content, images and export snapshots.</p>
          <BrandCard studio={studio} onIndex={setIndex} />
          <BadgeCard studio={studio} saved={index.badge} onIndex={setIndex} />
          <MenusCard studio={studio} menus={index.menus || {}} onIndex={setIndex} />
          <section className="card flex flex-col gap-3 p-5" aria-label="Hosting accounts">
            <h3 className="text-[15px] font-extrabold">Hosting accounts</h3>
            <p className="text-sm text-ink-300">GitHub publishing creates each site's repository and turns on GitHub Pages; Cloudflare (free, no traffic limit) or Netlify hosts sites outside GitHub. Tokens stay on this device, encrypted. Each site's database details are kept with its project.</p>
            <h3 className="mt-2 text-sm font-bold">GitHub (publishing)</h3>
            <GitHubPublishAccount session={session} />
            <h3 className="mt-2 text-sm font-bold">Netlify</h3>
            <NetlifyAccount session={session} />
            <SetupAccounts session={session} index={index} />
          </section>
          {isHosted(session)
            ? <section className="card flex flex-col gap-3 p-5" aria-label="Account"><h3 className="text-[15px] font-extrabold">Account</h3><p className="text-sm text-ink-300">Signed in as <b className="text-ink-100">{session.username}</b> with an email code.</p><button type="button" className="btn self-start" onClick={onSignOut}>Sign out</button></section>
            : <AccountPanel ns={NS} session={session} onUpdated={onSession} onSignOut={onSignOut} onForget={onForget} />}
          </FoldCards>
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
        <label className="btn btn-sm relative cursor-pointer">Upload logo / icon<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; try { setLogo(await shrinkImage(f)); } catch (x) { toast(explain(x), "bad"); } }} /></label>
        {shown && <button type="button" className="btn btn-sm" onClick={() => setLogo("")}>Remove</button>}
        <span className="hint">A square image works best. It's also the browser-tab icon.</span>
      </div>
      <button type="button" className="btn btn-pri self-start" disabled={busy || (name.trim() === b.name && logo === null)} onClick={save}>{busy ? "Saving…" : "Save name & logo"}</button>
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
    if (!/^https?:\/\//i.test(b.url)) return toast("The link must start with https://", "bad");
    setBusy(true);
    try { onIndex(await studio.saveBadge(b)); toast("Saved. Publish a site or use Push updates to live sites to show it there."); }
    catch (e) { toast(explain(e), "bad"); }
    setBusy(false);
  };
  return (
    <section className="card flex flex-col gap-4 p-5" aria-label="Powered by badge">
      <h3 className="text-[15px] font-extrabold">“Powered by” badge</h3>
      <p className="text-sm text-ink-300">The small link in the bottom-right corner of every site. Set its look once here; show or hide it per site in each project under <b className="text-ink-100">Admin page → “Powered by” badge</b>.</p>
      <div className="grid place-items-end rounded-xl border border-ink-700 bg-[repeating-linear-gradient(45deg,#1a2030_0_10px,#151a26_10px_20px)] p-4" aria-label="Badge preview"><BadgePreview b={b} /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Text" htmlFor="bd-text"><input id="bd-text" className="input" maxLength={60} value={b.text} onChange={(e) => set({ text: e.target.value })} placeholder={BADGE_DEFAULT.text} /></Field>
        <Field label="Link" htmlFor="bd-url" hint="Opens in a new tab."><input id="bd-url" className="input" value={b.url} onChange={(e) => set({ url: e.target.value.trim() })} placeholder="https://…" /></Field>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5"><span className="label">Size</span>
          <div className="flex rounded-lg border border-ink-600" role="radiogroup" aria-label="Badge size">
            {([["s", "Small"], ["m", "Medium"], ["l", "Large"]] as const).map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={b.size === k} onClick={() => set({ size: k })} className={`btn btn-sm border-0 ${b.size === k ? "bg-ink-700" : "bg-transparent"}`}>{l}</button>)}
          </div>
        </div>
        <label className="flex flex-col gap-1.5"><span className="label">Background</span><span className="flex items-center gap-2"><input type="color" aria-label="Badge background colour" className="h-9 w-12 cursor-pointer rounded border border-ink-600 bg-transparent" value={b.bg} onChange={(e) => set({ bg: e.target.value.toUpperCase() })} /><code className="font-mono text-xs text-ink-400">{b.bg}</code></span></label>
        <label className="flex flex-col gap-1.5"><span className="label">Text colour</span><span className="flex items-center gap-2"><input type="color" aria-label="Badge text colour" className="h-9 w-12 cursor-pointer rounded border border-ink-600 bg-transparent" value={b.fg} onChange={(e) => set({ fg: e.target.value.toUpperCase() })} /><code className="font-mono text-xs text-ink-400">{b.fg}</code></span></label>
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
