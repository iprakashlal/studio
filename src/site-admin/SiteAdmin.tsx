import { useCallback, useEffect, useMemo, useState } from "react";
import { EnquiriesPanel, enquiriesCfg } from "./EnquiriesPanel";
import { GOTO_EVENT } from "../editor/Editor";
import { TEMPLATES } from "../schema";
import { device, session as sess, watchIdle, type Session } from "../lib/auth";
import { GitHubRepo, explain, jsonB64, bytesB64, type Repo } from "../lib/repo";
import { SupabaseRepo, assetBase, type SbCfg } from "../lib/supa";
import { SbGate, SbAccount, sbSignOut } from "./SbGate";
import { blobToBytes, clone, safeFileName, textToB64 } from "../lib/util";
import { adminFile } from "../schema/common";
import { bakeHead, headChanged, pageLabel } from "../lib/head";
import ACCOUNT_HTML from "../../public/templates/store/account.html?raw";
import { Editor } from "../editor/Editor";
import { Preview } from "../editor/Preview";
import { BackupPanel } from "../editor/BackupPanel";
import { AccountPanel, Gate } from "../ui/gate";
import { Logo, StepLoader, useConfirm, useToast } from "../ui/kit";
import { CustomersPanel, OrdersPanel } from "./ShopPanels";

const NS = "site-cms";
/** host: set when the site is hosted outside GitHub, with its content in Supabase. */
type SiteInfo = { template: string; name: string; version?: number; admin?: string; exportedAt?: string; generator?: string; host?: { kind: "supabase"; url: string; key: string; site: string } };
/** Saved-but-not-published edits live here. The live site never reads this file. */
const DRAFT = "cms/draft.json";
/** This CMS page's own file name: from cms/site.json, else the address it was opened at. */
function currentAdmin(info: SiteInfo): string {
  if (info.admin) return info.admin;
  const here = decodeURIComponent(location.pathname.split("/").pop() || "");
  return /^[a-z0-9-]+(\.html)?$/i.test(here) && here ? (here.endsWith(".html") ? here : here + ".html") : "admin.html";
}

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

  useEffect(() => {
    if (!sbIn || !info?.host) return;
    const h = info.host;
    return watchIdle(NS, () => { sbSignOut(h).finally(() => setSbIn(false)); toast("Signed out after 30 minutes without activity"); });
  }, [sbIn]);
  useEffect(() => {
    if (!session) return;
    return watchIdle(NS, () => { sess.clear(NS); setSession(null); toast("Signed out after 30 minutes without activity"); });
  }, [session]);

  if (infoErr) return <div className="grid min-h-screen place-items-center px-4"><div className="card max-w-md p-6"><h1 className="text-lg font-extrabold">Site CMS can't start</h1><p className="mt-2 text-sm text-ink-300">{infoErr}</p></div></div>;
  if (!info) return <div className="grid min-h-screen place-items-center"><StepLoader title="Opening the admin page" at={0} steps={["Reading the site's settings (cms/site.json)", "Signing in", "Loading the content"]} /></div>;
  if (info.host?.kind === "supabase") {
    const sb: SbCfg = { url: info.host.url, key: info.host.key, site: info.host.site };
    if (!sbIn) return <SbGate sb={sb} brand={`${info.name} · CMS`} onIn={() => setSbIn(true)} />;
    return <HostedWorkspace info={info} onInfo={setInfo} sb={sb} onSignOut={() => setSbIn(false)} />;
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

function HostedWorkspace({ info, onInfo, sb, onSignOut }: { info: SiteInfo; onInfo: (i: SiteInfo) => void; sb: SbCfg; onSignOut: () => void }) {
  const repo = useMemo(() => new SupabaseRepo(sb), [sb.url, sb.key, sb.site]);
  return <Workspace info={info} onInfo={onInfo} repo={repo} hosted={sb} onSignOut={() => { sbSignOut(sb).finally(onSignOut); }}
    account={<SbAccount sb={sb} onSignOut={onSignOut} />} />;
}

/** hosted: the site is on Netlify with content and photos in Supabase (pages change only when the Studio publishes). */
function Workspace({ info, onInfo, repo, account, onSignOut, hosted, ghToken }: { info: SiteInfo; onInfo: (i: SiteInfo) => void; repo: Repo; account: React.ReactNode; onSignOut: () => void; hosted?: SbCfg; ghToken?: string }) {
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
  const [cat, setCat] = useState("");
  const wide = cat === "shop-orders" || cat === "shop-customers";

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
  const photoBase = hosted ? assetBase(hosted) : "";
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
        // The pages are on Netlify: content goes live from Supabase at once. Titles in the pages' <head> and the
        // CMS address change the next time the site is published from the Studio.
        const next = await repo.putFile("content.json", jsonB64(draft), "Update site content", sha);
        setSha(next);
        if (draftSha) await repo.pushFiles([], "Delete the CMS draft", [DRAFT]).catch(() => {});
        setSaved(clone(draft)); setBase(clone(draft)); setDraftSha(null); setDraftAt(""); setSavedV(at);
        toast(bake || oldAdmin !== newAdmin
          ? "Published. The new title, metadata or CMS address show in search results and links after the site is next published from Site Studio."
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
      // Turning customer accounts on later adds the Account page the export left out.
      if (tpl.id === "store" && draft.backend?.enabled && draft.backend?.accounts && !(await repo.getText("account.html"))) {
        await repo.putFile("account.html", textToB64(ACCOUNT_HTML), "Add customer account page");
      }
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

  const extras = useMemo(() => [
    ...(tpl.id === "store" ? [
      { id: "shop-orders", label: "Orders", group: "Shop", desc: "Every order from checkout. Update status, confirm UPI payments and message customers.", render: () => <OrdersPanel content={saved} /> },
      { id: "shop-customers", label: "Customers", group: "Shop", desc: "Signed-up customers by account number and email, with their orders.", render: () => <CustomersPanel content={saved} /> },
    ] : []),
    ...(tpl.id === "business" ? [
      { id: "enquiries", label: "Enquiries", group: "Content", desc: "Messages sent through your website's enquiry form.", render: () => <EnquiriesPanel cfg={enquiriesCfg(saved, hosted)} hosted={!!hosted} email={saved?.contact?.email} form={saved?.contact?.form} ghToken={ghToken} /> },
    ] : []),
    { id: "backup", label: "Backup & reset", group: "Settings", desc: "Copy, restore or reset the site's content.", render: () => <BackupPanel draft={draft} onReplace={(c) => { setDraft(clone(c)); bump(); }} loadDefaults={async () => clone(saved)} hosted={!!hosted} /> },
    { id: "account", label: "Account", group: "Settings", desc: "Your login on this device.", render: () => account },
  ], [draft, saved, account, tpl.id, hosted, ghToken]);

  if (err) return <div className="grid min-h-screen place-items-center px-4"><div className="card flex max-w-md flex-col gap-3 p-6"><h1 className="text-lg font-extrabold">Couldn't load the site's content</h1><p className="text-sm text-ink-300">{err}</p><div className="flex gap-2"><button className="btn btn-pri" onClick={load}>Try again</button><button className="btn" onClick={onSignOut}>Sign out</button></div></div></div>;
  if (!draft) return <div className="grid min-h-screen place-items-center"><StepLoader title="Opening the admin page" at={2} steps={["Reading the site's settings (cms/site.json)", "Signing in", hosted ? "Loading the latest content" : "Loading the latest content from GitHub"]} /></div>;

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
          <a className="btn btn-sm" href="./" target="_blank" rel="noopener">View site ↗</a>
          {dirty || !draftSha
            ? <button type="button" className="btn btn-sm" disabled={!dirty} onClick={async () => { if (await confirm("Discard unsaved changes?", draftSha ? "The editor goes back to your last saved draft." : "Your edits since the last save will be lost.", "Discard", true)) { setDraft(clone(base)); setV(0); setSavedV(0); } }}>Discard</button>
            : <button type="button" className="btn btn-sm" disabled={saving} onClick={dropDraft}>Delete draft</button>}
          <button type="button" className="btn btn-sm" disabled={!dirty || saving} onClick={saveDraft} title="Saves a draft in the site's repository. The live site doesn't change.">Save</button>
          <button type="button" className="btn btn-pri btn-sm" disabled={(!dirty && !draftSha) || saving} onClick={save} title="Makes your changes live.">Save &amp; publish</button>
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
      {!moved && draftSha && !dirty && (
        <div className="border-b border-sky-400/30 bg-sky-400/5 px-4 py-2 text-[13px] text-sky-100" role="status">
          You're editing a saved draft{draftAt ? ` from ${new Date(draftAt).toLocaleString()}` : ""}. Visitors still see the published version until you press <b>Save &amp; publish</b>.
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <div className={`min-h-0 min-w-0 flex-1 flex-col lg:flex ${pane === "edit" || wide ? "flex" : "hidden"}`}>
          <Editor site tpl={tpl} draft={draft} version={v} onChange={bump} upload={upload} img={img} extras={extras} onCategory={setCat} />
        </div>
        <div className={`min-h-0 flex-col border-l border-ink-700 lg:w-[46%] ${wide ? "lg:hidden" : "lg:flex"} ${pane === "preview" && !wide ? "flex flex-1" : "hidden"}`}>
          <Preview tpl={tpl} base="" content={draft} version={v} assets={assets} />
        </div>
      </div>
    </div>
  );
}
