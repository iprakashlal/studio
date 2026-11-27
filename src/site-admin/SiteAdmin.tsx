import { useCallback, useEffect, useMemo, useState } from "react";
import { HelpPanel } from "../editor/HelpPanel";
import { TourHost, type TourStep } from "../ui/Tour";
import { brand } from "../lib/brand";
import { accentFromImage, applyTint, isHex } from "../lib/tint";
import { CfAccount, CfGate } from "./CfGate";
import { CfRepo, cfCall, cfSession, dbGitHub } from "../lib/cfdb";
import { applyPrefs, cleanPrefs, mergePrefs, prefSync, type SyncedPrefs } from "../lib/prefs";
import { cleanMenu } from "../lib/menus";
import { EnquiriesPanel, enquiriesCfg } from "./EnquiriesPanel";
import { CustomerPanel } from "./CustomerPanel";
import { SiteConnections } from "../pages/Connections";
import { InventoryPanel } from "./InventoryPanel";
import { RecoveryPanel } from "./RecoveryPanel";
import { ReviewsPanel } from "./ReviewsPanel";
import { PeoplePanel } from "./PeoplePanel";
import { WarrantyPanel } from "./WarrantyPanel";
import { GOTO_EVENT } from "../editor/Editor";
import { TEMPLATES } from "../schema";
import { device, session as sess, watchIdle, type Session } from "../lib/auth";
import { GitHubRepo, explain, ghRoute, jsonB64, bytesB64, type Repo } from "../lib/repo";
import { SupabaseRepo, assetBase, cfAssetBase, type CfSiteCfg, type SbCfg } from "../lib/supa";
import { SbGate, SbAccount, sbSignOut } from "./SbGate";
import { blobToBytes, clone, safeFileName, textToB64 } from "../lib/util";
import { adminFile } from "../schema/common";
import { pagesViaDb } from "../lib/pages";
import { bakeHead, headChanged, pageLabel } from "../lib/head";
import { Editor } from "../editor/Editor";
import { Preview } from "../editor/Preview";
import { BackupPanel } from "../editor/BackupPanel";
import { AccountPanel, Gate } from "../ui/gate";
import { Logo, SkelEditor, useConfirm, useToast } from "../ui/kit";

const NS = "site-cms";
/** host: set when the site is hosted outside GitHub, with its content in Supabase. */
type SiteInfo = { menu?: unknown; template: string; name: string; version?: number; admin?: string; worker?: string; files?: string[]; exportedAt?: string; generator?: string; host?: { kind: "supabase"; url: string; key: string; site: string } | { kind: "cloudflare"; api: string; site: string }; /** A GitHub Pages site whose admin page signs in by email through the Studio's database, which saves to the repository. */ signin?: { api: string; site: string; owner: string; repo: string; branch: string } };
/** Saved-but-not-published edits live here. The live site never reads this file. */
const DRAFT = "cms/draft.json";
/** This CMS page's own file name: from cms/site.json, else the address it was opened at. */
/** A site on Cloudflare moves its own admin page: the files it was published with are read back from the live site
 *  and deployed again under the new name, through the database's kept Cloudflare token (Publish from any device).
 *  Returns the new address. */
async function moveHostedAdmin(cf: CfSiteCfg, info: SiteInfo, oldAdmin: string, newAdmin: string, content: any, step: (s: string) => void): Promise<string> {
  if (!info.worker || !info.files?.length) throw new Error("The new admin page address is saved. It takes effect after the site is next published from Site Studio (sites published before this update don't list their files yet).");
  const pages = await pagesViaDb(cf.api, "site:" + cf.site);
  if (!pages) throw new Error("The new admin page address is saved. To move the page from here, turn on Publish from any device in Site Studio (Settings → Accounts). Or publish the site from Site Studio.");
  const base = new URL("./", location.href);
  const files: { path: string; data: Uint8Array }[] = [];
  let n = 0;
  for (const p of info.files) {
    if (p === "cms/site.json") continue;
    if (++n % 10 === 0) step(`Moving the admin page: reading the site (${n} of ${info.files.length})`);
    if (p === "content.json") { files.push({ path: p, data: new TextEncoder().encode(JSON.stringify(content, null, 2)) }); continue; }
    const r = await fetch(new URL(p, base).href, { cache: "no-store" });
    if (!r.ok) throw new Error(`Couldn't read ${p} from the live site (${r.status}). The new address is saved; publish the site from Site Studio to apply it.`);
    files.push({ path: p === oldAdmin ? newAdmin : p, data: new Uint8Array(await r.arrayBuffer()) });
  }
  if (!files.some((f) => f.path === newAdmin)) throw new Error(`Couldn't find ${oldAdmin} on the live site. Publish the site from Site Studio to apply the new address.`);
  const list = info.files.map((p) => (p === oldAdmin ? newAdmin : p));
  files.push({ path: "cms/site.json", data: new TextEncoder().encode(JSON.stringify({ ...info, admin: newAdmin, files: list }, null, 2)) });
  step("Moving the admin page: publishing");
  await pages.deploy(info.worker, files, `Move the admin page to ${newAdmin}`);
  await new CfRepo(cf.api, "site:" + cf.site).putFile("cms/site.json", bytesB64(files[files.length - 1].data), "Site info").catch(() => {});
  return new URL(newAdmin, base).href;
}

/** The browser tab of the admin page: "<Company> | Control Panel" and the site's own logo as its icon (else its
 *  initials on the theme colour), read from the site's published content. */
function useAdminTab(info: SiteInfo | null) {
  useEffect(() => {
    if (!info) return;
    let on = true;
    const h = info.host, cfBase = h?.kind === "cloudflare" ? h.api.replace(/\/+$/, "") + "/p/" + encodeURIComponent(h.site) + "/" : "";
    const title = (name: string) => { document.title = `${name.replace(/\s+/g, " ").trim() || "Site"} | Control Panel`; };
    const icon = (href: string, type?: string) => {
      let l = document.querySelector<HTMLLinkElement>("link[rel=icon]"); if (!l) { l = document.createElement("link"); l.rel = "icon"; document.head.appendChild(l); }
      if (type) l.type = type; else l.removeAttribute("type"); l.href = href;
    };
    title(info.name || "");
    (cfBase ? fetch(cfBase + "content.json", { cache: "no-store" }).then((r) => (r.ok ? r.json() : Promise.reject())).catch(() => fetch("content.json", { cache: "no-store" }).then((r) => r.json())) : fetch("content.json", { cache: "no-store" }).then((r) => r.json()))
      .then((c: any) => {
        if (!on || !c || typeof c !== "object") return;
        const B = c.brand || {}, name = String(B.name || B.logoText || c.profile?.name || info.name || "");
        title(name);
        const img = B.icon || B.logo, path = String(img?.path || ""), url = String(img?.url || "");
        const src = path ? (cfBase && /^assets\/uploads\//.test(path) ? cfBase + path.split("/").map(encodeURIComponent).join("/") : path) : /^(https?:|data:image\/)/i.test(url) ? url : "";
        if (src) return icon(src);
        const col = /^#[0-9a-f]{3,8}$/i.test(String(c.theme?.c1 || c.theme?.accent || "")) ? String(c.theme.c1 || c.theme.accent) : "#3b5bdb";
        const ini = name.split(/\s+/).map((w) => w[0] || "").join("").slice(0, 2).toUpperCase() || "•";
        icon("data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${col}"/><text x="32" y="34" dominant-baseline="middle" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="${ini.length > 1 ? 26 : 34}" fill="#fff">${ini.replace(/[<&>]/g, "")}</text></svg>`), "image/svg+xml");
      }).catch(() => {});
    return () => { on = false; };
  }, [info]);
}

function currentAdmin(info: SiteInfo): string {
  if (info.admin) return info.admin;
  const here = decodeURIComponent(location.pathname.split("/").pop() || "");
  return /^[a-z0-9-]+(\.html)?$/i.test(here) && here ? (here.endsWith(".html") ? here : here + ".html") : "admin.html";
}

import { markSiteAdmin } from "../lib/ai";
// This bundle is a site's own admin page: engines kept for the Studio are offered here only where the Studio allowed them.
markSiteAdmin();

/** The quick tour shown after signing in (it can be turned off, and played again, in Settings → Help). */
const TOUR_INTRO: TourStep[] = [
  { title: "Welcome to your site's admin", text: "A look around: where things are, how to change them, then every section of the menu in a line or two, and how to put your changes on the site. Skip any time." },
  { sel: 'nav[aria-label="Content categories"]', title: "The menu", text: "Every part of your site is a section in this list. Pick one and its settings open in the middle." },
  { sel: "#menu-search", title: "Looking for something?", text: "Type a word, like “phone”, “logo” or “hours”, and the menu shows where that setting is." },
  { sel: '[data-tour="edit"]', title: "Change things here", text: "Edit the words, photos and choices. Nothing goes live yet: you only change a draft of the site." },
  { sel: '[data-tour="preview"]', title: "See it as you type", text: "The preview shows your site with your changes straight away. On a phone, switch between Edit and Preview at the top." },
];
const TOUR_OUTRO: TourStep[] = [
  { sel: '[data-tour="save"]', title: "Save a draft", text: "Keeps your work safely without changing the live site, so you can carry on later or on another device." },
  { sel: '[data-tour="publish"]', title: "Save & publish", text: "Makes your changes live. Visitors see them in about a minute." },
  { sel: '[data-tour="view"]', title: "View your site", text: "Opens the live site in a new tab, so you can check what visitors see." },
  { title: "That's it", text: "You can play this tour again, or turn it off, in Settings → Help." },
];
export function SiteAdmin() {
  const toast = useToast();
  const [info, setInfo] = useState<SiteInfo | null>(null);
  const [infoErr, setInfoErr] = useState("");
  const [session, setSession] = useState<Session | null>(() => sess.load(NS));
  const [sbIn, setSbIn] = useState(false);

  useEffect(() => {
    fetch("cms/site.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j: SiteInfo) => (TEMPLATES[j.template] ? setInfo(j) : setInfoErr(`This CMS doesn't know the "${j.template}" template.`)))
      .catch(() => setInfoErr("cms/site.json is missing, so the CMS can't tell which template this site uses. Re-export the site from Site Studio."));
  }, []);

  useAdminTab(info);
  useEffect(() => {
    if (!sbIn || !info?.host) return;
    const h = info.host;
    return watchIdle(NS, () => { (h.kind === "cloudflare" ? Promise.resolve(cfSession.clear(h.api)) : sbSignOut(h)).finally(() => setSbIn(false)); toast("Signed out after 30 minutes without activity"); });
  }, [sbIn]);
  const [tokenWay, setTokenWay] = useState(false);
  useEffect(() => {
    if (!sbIn || !info?.signin || info.host) return;
    const api = info.signin.api;
    return watchIdle(NS, () => { cfSession.clear(api); setSbIn(false); toast("Signed out after 30 minutes without activity"); });
  }, [sbIn]);
  useEffect(() => {
    if (!session) return;
    return watchIdle(NS, () => { sess.clear(NS); setSession(null); toast("Signed out after 30 minutes without activity"); });
  }, [session]);

  if (infoErr) return <div className="grid min-h-screen place-items-center px-4"><div className="card max-w-md p-6"><h1 className="text-lg font-extrabold">Site CMS can't start</h1><p className="mt-2 text-sm text-ink-300">{infoErr}</p></div></div>;
  if (!info) return <SkelEditor note="Reading the site's settings" />;
  if (info.host?.kind === "cloudflare") {
    const cf: CfSiteCfg = { api: info.host.api, site: info.host.site };
    if (!sbIn) return <CfGate cf={cf} brand={`${info.name} · CMS`} onIn={() => setSbIn(true)} />;
    return <CfWorkspace info={info} onInfo={setInfo} cf={cf} onSignOut={() => setSbIn(false)} />;
  }
  if (info.host?.kind === "supabase") {
    const sb: SbCfg = { url: info.host.url, key: info.host.key, site: info.host.site };
    if (!sbIn) return <SbGate sb={sb} brand={`${info.name} · CMS`} onIn={() => setSbIn(true)} />;
    return <HostedWorkspace info={info} onInfo={setInfo} sb={sb} onSignOut={() => setSbIn(false)} />;
  }
  // A GitHub Pages site set up for email sign-in: an email and a code on any device, and the Studio's database saves to the repository.
  // A device that already has its own GitHub login keeps using it; "Use a GitHub token instead" is always there.
  const si = info.signin && typeof info.signin.api === "string" && !info.host ? info.signin : null;
  if (si && !session && !tokenWay && !device.load(NS)) {
    const cf: CfSiteCfg = { api: si.api, site: si.site };
    if (!sbIn) return <CfGate cf={cf} brand={`${info.name} · CMS`} onIn={() => setSbIn(true)} footer={<button type="button" className="self-start text-[12.5px] text-ink-400 underline hover:text-ink-100" onClick={() => setTokenWay(true)}>Use a GitHub token instead</button>} />;
    return <MailGitHubWorkspace info={info} onInfo={setInfo} si={si} onSignOut={() => setSbIn(false)} />;
  }
  if (!session) {
    return <Gate ns={NS} brand={`${info.name} · CMS`} repoNoun="website's repository"
      tokenHint="A fine-grained token for this website's repository only, with Contents: Read and write."
      onAuthed={setSession}
      footer={<a href="./" className="text-sm text-ink-400 hover:text-ink-100">← Back to the website</a>} />;
  }
  const signOut = () => { sess.clear(NS); setSession(null); };
  return <GitHubWorkspace info={info} onInfo={setInfo} session={session} onSession={setSession} onSignOut={signOut} onForget={() => { device.clear(NS); sess.clear(NS); setSession(null); }} />;
}

function GitHubWorkspace({ info, onInfo, session, onSession, onSignOut, onForget }: { info: SiteInfo; onInfo: (i: SiteInfo) => void; session: Session; onSession: (s: Session) => void; onSignOut: () => void; onForget: () => void }) {
  const repo = useMemo(() => new GitHubRepo(session.cfg, session.token), [session]);
  return <Workspace info={info} onInfo={onInfo} repo={repo} onSignOut={onSignOut} ghToken={session.token}
    account={<AccountPanel ns={NS} session={session} onUpdated={onSession} onSignOut={onSignOut} onForget={onForget} />} />;
}

/** A GitHub Pages site, signed in by email: the content is in the repository as always; every change goes through the Studio's database, which holds the GitHub token. */
function MailGitHubWorkspace({ info, onInfo, si, onSignOut }: { info: SiteInfo; onInfo: (i: SiteInfo) => void; si: NonNullable<SiteInfo["signin"]>; onSignOut: () => void }) {
  const cf: CfSiteCfg = { api: si.api, site: si.site };
  const repo = useMemo(() => { ghRoute.via = dbGitHub(si.api, "site:" + si.site); return new GitHubRepo({ owner: si.owner, repo: si.repo, branch: si.branch }, ""); }, [si.api, si.site, si.owner, si.repo, si.branch]);
  return <Workspace info={info} onInfo={onInfo} repo={repo} people={cf} onSignOut={() => { cfSession.clear(si.api); onSignOut(); }}
    account={<CfAccount cf={cf} onSignOut={onSignOut} />} />;
}

function HostedWorkspace({ info, onInfo, sb, onSignOut }: { info: SiteInfo; onInfo: (i: SiteInfo) => void; sb: SbCfg; onSignOut: () => void }) {
  const repo = useMemo(() => new SupabaseRepo(sb), [sb.url, sb.key, sb.site]);
  return <Workspace info={info} onInfo={onInfo} repo={repo} hosted={sb} onSignOut={() => { sbSignOut(sb).finally(onSignOut); }}
    account={<SbAccount sb={sb} onSignOut={onSignOut} />} />;
}

function CfWorkspace({ info, onInfo, cf, onSignOut }: { info: SiteInfo; onInfo: (i: SiteInfo) => void; cf: CfSiteCfg; onSignOut: () => void }) {
  const repo = useMemo(() => new CfRepo(cf.api, "site:" + cf.site), [cf.api, cf.site]);
  // This site's own choices (tour, click-to-edit, menu layout...) are kept in its database (owners), so they follow its people to any device.
  useEffect(() => {
    let on = true, known: SyncedPrefs = {}; const q = `/set?scope=${encodeURIComponent("site:" + cf.site)}`;
    cfCall<any>(cf.api, q).then((s) => { try { known = cleanPrefs(JSON.parse(s?.prefs?.json || "{}")); } catch { /* none yet */ } if (on) applyPrefs(known); }).catch(() => { /* only an owner can read it */ });
    prefSync.attach(async (patch) => { known = cleanPrefs(mergePrefs(known, patch)); await cfCall(cf.api, q, { method: "POST", body: JSON.stringify({ name: "prefs", value: { json: JSON.stringify(known) } }) }); });
    return () => { on = false; prefSync.attach(null); };
  }, [cf.api, cf.site]);
  return <Workspace info={info} onInfo={onInfo} repo={repo} hosted={cf} onSignOut={() => { cfSession.clear(cf.api); onSignOut(); }}
    account={<CfAccount cf={cf} onSignOut={onSignOut} />} />;
}

/** hosted: the site is on Cloudflare or Netlify with content and photos in Supabase or the Cloudflare database (pages change only when the Studio publishes). */
function Workspace({ info, onInfo, repo, account, onSignOut, hosted, ghToken, people }: { info: SiteInfo; onInfo: (i: SiteInfo) => void; repo: Repo; account: React.ReactNode; onSignOut: () => void; hosted?: SbCfg | CfSiteCfg; ghToken?: string; /** A GitHub Pages site signed in by email: where its people and roles are kept. */ people?: CfSiteCfg }) {
  const toast = useToast();
  const confirm = useConfirm();
  const tpl = TEMPLATES[info.template];
  /** saved: what's live (content.json). base: the last saved state, a draft or the live content. */
  const [saved, setSaved] = useState<any>(null);
  const [base, setBase] = useState<any>(null);
  const [draft, setDraft] = useState<any>(null);
  const [sha, setSha] = useState<string | null>(null);
  const [draftSha, setDraftSha] = useState<string | null>(null);
  const [draftAt, setDraftAt] = useState("");
  const [moved, setMoved] = useState("");
  const [err, setErr] = useState("");
  const [v, setV] = useState(0);
  const [savedV, setSavedV] = useState(0);
  const [saving, setSaving] = useState(false);
  const [pane, setPane] = useState<"edit" | "preview">("edit");
  // Click-to-edit from the preview: on small screens, switch to the editor to show the field.
  useEffect(() => { const on = () => setPane("edit"); addEventListener(GOTO_EVENT, on); return () => removeEventListener(GOTO_EVENT, on); }, []);
  const [assets, setAssets] = useState<Record<string, string>>({});
  const [, setCat] = useState("");
  const wide = false;

  const load = useCallback(async () => {
    setErr("");
    try {
      const f = await repo.getJSON("content.json");
      if (!f) throw new Error("content.json wasn't found in the repository.");
      const d = await repo.getJSON<{ savedAt?: string; content?: any }>(DRAFT).catch(() => null);
      const dc = d?.data?.content && typeof d.data.content === "object" ? d.data.content : null;
      setSaved(f.data);
      setBase(clone(dc || f.data));
      setDraft(clone(dc || f.data));
      setSha(f.sha);
      setDraftSha(dc ? d!.sha : null);
      setDraftAt(dc ? d!.data.savedAt || "" : "");
      setV(0);
      setSavedV(0);
    } catch (e) {
      setErr(explain(e));
    }
  }, [repo]);
  useEffect(() => { load(); }, [load]);

  const dirty = v !== savedV;
  useEffect(() => {
    const on = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    addEventListener("beforeunload", on);
    return () => removeEventListener("beforeunload", on);
  }, [dirty]);

  const bump = useCallback(() => setV((n) => n + 1), []);
  const upload = useCallback(async (file: File) => {
    const path = `assets/uploads/${Date.now()}-${safeFileName(file.name)}`;
    await repo.putFile(path, bytesB64(await blobToBytes(file)), `Upload ${file.name}`);
    setAssets((m) => ({ ...m, [path]: URL.createObjectURL(file) }));
    return { path };
  }, [repo]);
  const photoBase = hosted ? ("api" in hosted ? cfAssetBase(hosted) : assetBase(hosted)) : "";
  // "Colour this site's admin page from its logo" (Admin page → Admin page colours): follows the draft, so it shows at once.
  const tintOn = !!draft?.cms?.tint, tintLogo = tintOn ? draft?.brand?.icon || draft?.brand?.logo : null;
  const tintSrc = tintLogo?.path ? assets[tintLogo.path] || (photoBase && String(tintLogo.path).startsWith("assets/uploads/") ? photoBase + String(tintLogo.path).split("/").map(encodeURIComponent).join("/") : tintLogo.path) : /^(https:|data:image\/)/i.test(String(tintLogo?.url || "")) ? String(tintLogo.url) : "";
  const tintFallback = String([draft?.theme?.c1, draft?.theme?.accent].find(isHex) || "");
  const tintColor = isHex(draft?.cms?.tintColor) ? String(draft.cms.tintColor) : "", tintMode = draft?.cms?.tintMode === "light" || draft?.cms?.tintMode === "dark" ? (draft.cms.tintMode as "light" | "dark") : "";
  useEffect(() => {
    // Off: the Studio's own look (its colour and dark or light), not the bare standard one.
    const base = brand();
    if (!tintOn) { applyTint(base.tint || null, base.mode); return; }
    const mode = tintMode || (base.mode === "light" ? "light" : "dark");
    if (tintColor) { applyTint(tintColor, mode); return; }
    let on = true;
    // Until the logo is read, the site's accent (or the Studio's colour) in the chosen look: no flash of another look.
    applyTint(tintFallback || base.tint || null, mode);
    (tintSrc ? accentFromImage(tintSrc) : Promise.resolve(null)).then((a) => { if (on) applyTint(a || tintFallback || base.tint || null, mode); });
    return () => { on = false; };
  }, [tintOn, tintSrc, tintFallback, tintColor, tintMode]);
  useEffect(() => () => { const base = brand(); applyTint(base.tint || null, base.mode); }, []);
  const img = useCallback((val: any) => (val?.path ? assets[val.path] || (photoBase && val.path.startsWith("assets/uploads/") ? photoBase + val.path.split("/").map(encodeURIComponent).join("/") : val.path) : ""), [assets, photoBase]);

  const conflict = async (e: any, path: string, setter: (x: string | null) => void) => {
    if (e?.status === 409 || e?.status === 422) {
      const f = await repo.getJSON(path).catch(() => null);
      setter(f ? f.sha : null);
      toast(`This changed ${hosted ? "on the site" : "on GitHub"} since you opened it (maybe from another device). Press the button again to replace it with your version.`, "bad");
    } else toast("Couldn't save: " + explain(e), "bad");
  };

  /** Save: keeps the edits in the repository as a draft. The live site doesn't change. */
  const saveDraft = async () => {
    setSaving(true);
    const at = v;
    try {
      const when = new Date().toISOString();
      const next = await repo.putFile(DRAFT, jsonB64({ savedAt: when, note: "Draft from the site CMS. Not live until you press Save & publish.", content: draft }), "Save draft (not published)", draftSha);
      setDraftSha(next);
      setDraftAt(when);
      setBase(clone(draft));
      setSavedV(at);
      toast("Draft saved. The live site hasn't changed. Press Save & publish when it's ready.");
    } catch (e) {
      await conflict(e, DRAFT, setDraftSha);
    }
    setSaving(false);
  };

  /** Save & publish: writes content.json (the live site), clears the draft, and moves the CMS page if its name changed. */
  const save = async () => {
    setSaving(true);
    const at = v;
    const oldAdmin = currentAdmin(info);
    const newAdmin = adminFile(draft);
    // Titles, metadata and the background live in each page's <head> too (for search engines and link previews).
    const bake = headChanged(saved, draft);
    try {
      if (hosted) {
        // The pages are on Cloudflare or Netlify: content goes live from the database at once. Titles in the pages' <head> and the
        // CMS address change the next time the site is published from the Studio.
        const next = await repo.putFile("content.json", jsonB64(draft), "Update site content", sha);
        setSha(next);
        if (draftSha) await repo.pushFiles([], "Delete the CMS draft", [DRAFT]).catch(() => {});
        setSaved(clone(draft)); setBase(clone(draft)); setDraftSha(null); setDraftAt(""); setSavedV(at);
        let movedTo = "";
        if (oldAdmin !== newAdmin && "api" in hosted) {
          try { movedTo = await moveHostedAdmin(hosted, info, oldAdmin, newAdmin, draft, (s) => toast(s)); onInfo({ ...info, admin: newAdmin }); setMoved(new URL(newAdmin, location.href).href); }
          catch (e: any) { toast("Published. " + (e?.message || "Couldn't move the admin page."), "bad"); setSaving(false); return; }
        }
        toast(movedTo ? "Published, and the admin page moved: see the note at the top."
          : bake || oldAdmin !== newAdmin ? "Published. The new title, metadata or admin page address take effect after the site is next published from Site Studio."
          : "Published. Refresh the site to see it.");
        setSaving(false);
        return;
      }
      if (!draftSha && oldAdmin === newAdmin && !bake) {
        const next = await repo.putFile("content.json", jsonB64(draft), "Update site content", sha);
        setSha(next);
      } else {
        // One commit for everything. Check first that nobody published from elsewhere since this page loaded.
        const cur = await repo.getJSON("content.json");
        if (cur && sha && cur.sha !== sha) throw Object.assign(new Error("changed"), { status: 409 });
        const files = [{ path: "content.json", base64: jsonB64(draft) }];
        const remove = draftSha ? [DRAFT] : [];
        if (bake) {
          const base = new URL("./", location.href).href;
          const pages = (await repo.list("")).filter((f) => /^[a-z0-9-]+\.html$/.test(f) && f !== oldAdmin && f !== newAdmin && f !== "404.html");
          for (const f of pages) {
            const page = await repo.getText(f);
            if (page) files.push({ path: f, base64: textToB64(bakeHead(page.text, draft, { file: f, label: pageLabel(tpl.id, f, draft), base, bg: draft?.theme?.bg })) });
          }
        }
        if (oldAdmin !== newAdmin) {
          const page = await repo.getText(oldAdmin);
          if (!page) throw new Error(`Couldn't find ${oldAdmin} in the repository to move it. Change the admin page name back, or publish again from Site Studio.`);
          files.push({ path: newAdmin, base64: textToB64(page.text) });
          files.push({ path: "cms/site.json", base64: jsonB64({ ...info, admin: newAdmin }) });
          remove.push(oldAdmin);
        }
        await repo.pushFiles(files, oldAdmin !== newAdmin ? `Update site content; move the CMS to ${newAdmin}` : bake ? "Update site content, titles and metadata" : "Update site content", remove);
        const f = await repo.getJSON("content.json").catch(() => null);
        setSha(f ? f.sha : null);
        if (oldAdmin !== newAdmin) { onInfo({ ...info, admin: newAdmin }); setMoved(new URL(newAdmin, location.href).href); }
      }
      setSaved(clone(draft));
      setBase(clone(draft));
      setDraftSha(null);
      setDraftAt("");
      setSavedV(at);
      toast(oldAdmin !== newAdmin ? "Published. The editor's address has changed: see the note at the top." : "Published. The live site updates in about a minute.");
    } catch (e: any) {
      await conflict(e, "content.json", setSha);
    }
    setSaving(false);
  };

  /** Throws the saved draft away and goes back to what's live. */
  const dropDraft = async () => {
    if (!(await confirm("Delete the saved draft?", "The editor goes back to what's live on the site. The draft's changes are lost.", "Delete draft", true))) return;
    setSaving(true);
    try {
      await repo.pushFiles([], "Delete the CMS draft", [DRAFT]);
      setDraftSha(null);
      setDraftAt("");
      setBase(clone(saved));
      setDraft(clone(saved));
      setV(0);
      setSavedV(0);
      toast("Draft deleted. You're editing what's live.");
    } catch (e) {
      toast("Couldn't delete the draft: " + explain(e), "bad");
    }
    setSaving(false);
  };

  const extrasAll = useMemo(() => [
    ...(tpl.id === "business" || tpl.id === "restaurant" || tpl.id === "events" ? [
      { id: "enquiries", label: tpl.id === "events" ? "Registrations & messages" : "Enquiries", group: "Forms & records", desc: tpl.id === "events" ? "Every registration for the event (with its number, what was chosen and the total), and the messages sent through the contact form." : tpl.id === "restaurant" ? "Table-booking and event requests sent through your website's form." : "Messages sent through your website's enquiry form.", render: () => <EnquiriesPanel cfg={hosted && "api" in hosted ? null : enquiriesCfg(saved, hosted)} cf={hosted && "api" in hosted ? hosted : undefined} hosted={!!hosted} email={saved?.contact?.email} form={saved?.contact?.form} ghToken={ghToken} only="enquiries" /> },
    ] : []),
    ...(tpl.id !== "portfolio" ? [
      { id: "connections", label: tpl.id === "restaurant" ? "Restaurant backend" : tpl.id === "store" ? "Couriers, WhatsApp & SMS" : "WhatsApp & SMS", group: "Advanced setup", desc: tpl.id === "restaurant" ? "What runs the Order now page behind the scenes, on your own Cloudflare database: Petpooja, and WhatsApp for alerts and codes. Payment gateway keys are under Payments." : "Optional: WhatsApp alerts when an enquiry or order arrives, and codes on WhatsApp or by SMS.", render: () => <SiteConnections cf={hosted && "api" in hosted ? hosted : null} template={tpl.id} cms={saved?.cms} root={draft} onChange={bump} site /> },
    ] : []),
    ...(tpl.id === "portfolio" ? [
      { id: "connections", label: "Email (Resend)", group: "Advanced setup", desc: "Which Resend sends this site's sign-in codes and enquiry emails: the Studio's, or this site's own.", render: () => <SiteConnections cf={hosted && "api" in hosted ? hosted : null} template={tpl.id} cms={saved?.cms} root={draft} onChange={bump} site only="mail" /> },
    ] : []),
    ...((tpl.id === "restaurant" || tpl.id === "store") ? [
      { id: "purchased", label: "Purchased orders", group: "Selling", desc: "Every order placed on your website: what was bought, by whom, how it is paid, and where it has got to.", render: () => <EnquiriesPanel only="orders" cfg={hosted && "api" in hosted ? null : enquiriesCfg(saved, hosted)} cf={hosted && "api" in hosted ? hosted : undefined} hosted={!!hosted} email={saved?.contact?.email} form={saved?.contact?.form} ghToken={ghToken} /> },
    ] : []),
    ...((tpl.id === "restaurant" || tpl.id === "store") ? [
      { id: "inventory", label: "Inventory", group: "Forms & records", desc: tpl.id === "restaurant" ? "How many of each dish are left: orders take from it, and a dish sells out by itself." : "How many of each product are left: orders take from it, and a product sells out by itself.", render: () => <InventoryPanel cf={hosted && "api" in hosted ? hosted : undefined} kind={tpl.id === "restaurant" ? "restaurant" : "store"} on={!!saved?.inventory?.on} /> },
      { id: "recovery", label: "Abandoned carts", group: "Selling", desc: "Shoppers who typed their email at checkout and left: remind them, and see who came back.", render: () => <RecoveryPanel cf={hosted && "api" in hosted ? hosted : undefined} kind={tpl.id === "restaurant" ? "restaurant" : "store"} on={!!saved?.recovery?.on} /> },
      { id: "reviews", label: "Reviews", group: "Forms & records", desc: "What customers wrote about your " + (tpl.id === "restaurant" ? "dishes" : "products") + ": approve, hide, reply.", render: () => <ReviewsPanel cf={hosted && "api" in hosted ? hosted : undefined} kind={tpl.id === "restaurant" ? "restaurant" : "store"} on={!!saved?.reviews?.on} /> },
      { id: "customer-data", label: "Customer Data", group: "Forms & records", desc: "Everyone who has ordered: their details, orders, what they spent and their points.", render: () => <CustomerPanel cf={hosted && "api" in hosted ? hosted : undefined} currency={saved?.food?.currency || saved?.settings?.currency || "₹"} points={!!saved?.loyalty?.on} /> },
    ] : []),
    ...(tpl.id === "store" || tpl.id === "business" ? [
      { id: "warranty-records", label: "Warranty records", group: "Forms & records", desc: "Products' numbers, warranty and service status, for the site's warranty & status check.", render: () => <WarrantyPanel repo={repo} cfg={draft?.warranty} /> },
    ] : []),
    ...((hosted && "api" in hosted) || people ? [{ id: "people", label: "Role Management", group: "Settings", desc: "Who can sign in to this admin page, each person's role, and what each role may do.", render: () => <PeoplePanel cf={(hosted && "api" in hosted ? hosted : people)!} /> }] : []),
    { id: "backup", label: "Backup & reset", group: "Settings", desc: "Copy, restore or reset the site's content.", render: () => <BackupPanel draft={draft} onReplace={(c) => { setDraft(clone(c)); bump(); }} loadDefaults={async () => clone(saved)} hosted={!!hosted} /> },
    { id: "help", label: "Help", group: "Settings", desc: "A quick tour of the admin, and how to turn it on or off.", render: () => <HelpPanel /> },
    { id: "account", label: "Account", group: "Settings", desc: "Your login on this device.", render: () => account },
  ], [draft, saved, account, tpl.id, hosted, ghToken, repo]);

  // Role Management: what this person's role may do on this site (a site on the Cloudflare database; otherwise everything, as before).
  const [sitePrivs, setSitePrivs] = useState<Record<string, boolean> | null>(null);
  const cfApi = hosted && "api" in hosted ? hosted.api : people?.api || "", cfSite = hosted && "api" in hosted ? hosted.site : people?.site || "";
  useEffect(() => { if (!cfApi) return; cfCall<any>(cfApi, "/roles?scope=" + encodeURIComponent("site:" + cfSite)).then((r) => { if (r?.ready && r.me?.role !== "owner" && r.me?.role !== "partner") setSitePrivs(r.me.privs); }).catch(() => { /* an older database: no roles */ }); }, [cfApi, cfSite]);
  const RECORDS = ["enquiries", "purchased", "inventory", "recovery", "reviews", "customer-data", "warranty-records"];
  const extras = useMemo(() => !sitePrivs ? extrasAll : extrasAll.filter((x: any) => (sitePrivs.orders || !RECORDS.includes(x.id)) && (sitePrivs.settings || !["Settings", "Advanced setup"].includes(x.group) || ["help", "account", "people"].includes(x.id))), [extrasAll, sitePrivs]);
  const mayEdit = !sitePrivs || !!sitePrivs.edit;

  if (err) return <div className="grid min-h-screen place-items-center px-4"><div className="card flex max-w-md flex-col gap-3 p-6"><h1 className="text-lg font-extrabold">Couldn't load the site's content</h1><p className="text-sm text-ink-300">{err}</p><div className="flex gap-2"><button className="btn btn-pri" onClick={load}>Try again</button><button className="btn" onClick={onSignOut}>Sign out</button></div></div></div>;
  if (!draft) return <SkelEditor note="Loading the content" />;

  return (
    <div className="flex h-[100dvh] flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b border-ink-700 bg-ink-900 px-3 py-2.5 pt-[max(10px,env(safe-area-inset-top))] sm:px-4">
        <span className="flex items-center gap-2.5 font-extrabold"><Logo />{info.name}</span>
        <span className="text-xs text-ink-400">{tpl.name} · CMS</span>
        <span className={`ml-1 flex items-center gap-1.5 text-xs ${dirty ? "text-amber-300" : draftSha ? "text-sky-300" : "text-ink-400"}`}><span className={`h-2 w-2 rounded-full ${dirty ? "bg-amber-400" : draftSha ? "bg-sky-400" : "bg-emerald-400"}`} />{saving ? "Saving…" : dirty ? "Unsaved changes" : draftSha ? "Draft saved, not published" : "Published, all saved"}</span>
        <div className="ml-auto flex flex-wrap gap-1.5">
          <div className={`flex rounded-lg border border-ink-600 lg:hidden ${wide ? "hidden" : ""}`} role="group" aria-label="Show">
            <button type="button" aria-pressed={pane === "edit"} className={`btn btn-sm border-0 ${pane === "edit" ? "bg-ink-700" : "bg-transparent"}`} onClick={() => setPane("edit")}>Edit</button>
            <button type="button" aria-pressed={pane === "preview"} className={`btn btn-sm border-0 ${pane === "preview" ? "bg-ink-700" : "bg-transparent"}`} onClick={() => setPane("preview")}>Preview</button>
          </div>
          <a className="btn btn-sm" data-tour="view" href="./" target="_blank" rel="noopener">View site ↗</a>
          <button type="button" role="switch" aria-checked={!!draft.maintenance?.on} className={`btn btn-sm ${draft.maintenance?.on ? "border-amber-400/60 text-amber-200" : ""}`} title="Shows a maintenance page to visitors instead of the site. Takes effect when you publish. Its text is under Publish & admin." onClick={() => { draft.maintenance = { ...(draft.maintenance || {}), on: !draft.maintenance?.on }; bump(); }}>Maintenance: {draft.maintenance?.on ? "On" : "Off"}</button>
          {dirty || !draftSha
            ? <button type="button" className="btn btn-sm" disabled={!dirty} onClick={async () => { if (await confirm("Discard unsaved changes?", draftSha ? "The editor goes back to your last saved draft." : "Your edits since the last save will be lost.", "Discard", true)) { setDraft(clone(base)); setV(0); setSavedV(0); } }}>Discard</button>
            : <button type="button" className="btn btn-sm" disabled={saving} onClick={dropDraft}>Delete draft</button>}
          <button type="button" className="btn btn-sm" data-tour="save" disabled={!dirty || saving} onClick={saveDraft} title="Saves a draft in the site's repository. The live site doesn't change.">Save</button>
          <button type="button" className="btn btn-pri btn-sm" data-tour="publish" disabled={(!dirty && !draftSha) || saving || !mayEdit} onClick={save} title={mayEdit ? "Makes your changes live." : "Your role can't save changes to this site. Ask its Administrator (Role Management)."}>Save &amp; publish</button>
        </div>
      </header>
      {moved && (
        <div className="flex flex-wrap items-center gap-2 border-b border-amber-400/40 bg-amber-400/10 px-4 py-2.5 text-[13px] text-amber-100" role="status">
          <b>The editor has a new address:</b>
          <a className="font-mono font-semibold underline" href={moved}>{moved}</a>
          <span>It works in about a minute. Bookmark it: this address stops working.</span>
          <button type="button" className="btn btn-sm ml-auto" onClick={() => { try { navigator.clipboard.writeText(moved); toast("Copied"); } catch { toast(moved); } }}>Copy</button>
        </div>
      )}
      {draft.maintenance?.on && (
        <div className="border-b border-amber-400/40 bg-amber-400/10 px-4 py-2 text-[13px] text-amber-100" role="status">
          <b>Maintenance mode is on{dirty || draftSha ? " in this draft" : ""}.</b> {dirty || draftSha ? "After you publish, visitors" : "Visitors"} see the maintenance page instead of the site. Switch it off and publish to bring the site back. “View site” shows what visitors see; <a className="underline" href="./?peek" target="_blank" rel="noopener">peek at the real site ↗</a>.
        </div>
      )}
      {!moved && draftSha && !dirty && (
        <div className="border-b border-sky-400/30 bg-sky-400/5 px-4 py-2 text-[13px] text-sky-100" role="status">
          You're editing a saved draft{draftAt ? ` from ${new Date(draftAt).toLocaleString()}` : ""}. Visitors still see the published version until you press <b>Save &amp; publish</b>.
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <div data-tour="edit" className={`min-h-0 min-w-0 flex-1 flex-col lg:flex ${pane === "edit" || wide ? "flex" : "hidden"}`}>
          <Editor site menu={cleanMenu(info.menu)} tpl={tpl} draft={draft} version={v} onChange={bump} upload={upload} img={img} cf={hosted && "api" in hosted ? hosted : null} extras={extras} onCategory={setCat} />
        </div>
        <div data-tour="preview" className={`min-h-0 flex-col border-l border-ink-700 lg:w-[46%] ${wide ? "lg:hidden" : "lg:flex"} ${pane === "preview" && !wide ? "flex flex-1" : "hidden"}`}>
          <Preview tpl={tpl} base="" content={draft} version={v} assets={assets} />
        </div>
      </div>
      <TourHost intro={TOUR_INTRO} outro={TOUR_OUTRO} />
    </div>
  );
}
