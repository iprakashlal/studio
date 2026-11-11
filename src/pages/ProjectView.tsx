import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TEMPLATES } from "../schema";
import type { Session } from "../lib/auth";
import { GitHubRepo, explain } from "../lib/repo";
import type { ProjectMeta, PublishTarget, Studio, StudioIndex, ExportRec } from "../lib/studio";
import { buildSite, downloadBlob, loadDefaults, publishSite, zipName, zipSite } from "../lib/exporter";
import { adminFile } from "../schema/common";
import { clone, fmtDate, merge, slugify, timeAgo } from "../lib/util";
import { Editor } from "../editor/Editor";
import { Preview } from "../editor/Preview";
import { BackupPanel } from "../editor/BackupPanel";
import { useAssetMap } from "../editor/useAssets";
import { Field, Modal, Spinner, Toggle, useConfirm, useToast } from "../ui/kit";

export function ProjectView({ studio, index, project, session, onIndex }: { studio: Studio; index: StudioIndex; project: ProjectMeta; session: Session; onIndex: (i: StudioIndex) => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const tpl = TEMPLATES[project.template];
  const [draft, setDraft] = useState<any>(null);
  const [err, setErr] = useState("");
  const [v, setV] = useState(0);
  const [savedV, setSavedV] = useState(0);
  const [saving, setSaving] = useState(false);
  const [pane, setPane] = useState<"edit" | "preview">("edit");
  const [modal, setModal] = useState<"" | "export" | "publish" | "history" | "details">("");
  const defaults = useRef<any>(null);
  const [conflict, setConflict] = useState<{ siteAt: string | null } | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);
  const site = useMemo(() => (project.publish && !studio.repo.demo ? new GitHubRepo(project.publish, session.token) : null), [project.publish?.owner, project.publish?.repo, project.publish?.branch, session.token]);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        defaults.current = await loadDefaults(project.template);
        const c = await studio.loadContent(project.id);
        if (live) setDraft(merge(defaults.current, c || {}));
      } catch (e) {
        if (live) setErr(explain(e));
        return;
      }
      // Central control: if the site's own CMS changed the content, bring it in (or ask when both sides changed).
      if (!site) return;
      try {
        const st = await studio.siteState(project, site);
        if (!live) return;
        if (st.kind === "pull") {
          const r = await studio.importFromSite(project.id, site);
          if (!live) return;
          onIndex(r.index);
          setDraft(merge(defaults.current, clone(r.content)));
          setV(0); setSavedV(0);
          toast(`Updated from the live site: edits made in its own CMS${st.siteAt ? " " + timeAgo(st.siteAt) : ""}.${r.missing.length ? ` ${r.missing.length} image(s) weren't found.` : ""}`);
        } else if (st.kind === "conflict") setConflict({ siteAt: st.siteAt });
      } catch { /* offline or no access: keep working on the Studio copy */ }
    })();
    return () => { live = false; };
  }, [project.id]);

  const useSiteVersion = async () => {
    if (!site) return;
    if (dirty && !(await confirm("Replace your unsaved edits?", "The editor switches to the live site's content.", "Use the site's version", true))) return;
    setSyncBusy(true);
    try {
      const r = await studio.importFromSite(project.id, site);
      onIndex(r.index);
      setDraft(merge(defaults.current || {}, clone(r.content)));
      setV(0); setSavedV(0); setConflict(null);
      toast("Now editing the live site's content.");
    } catch (e) { toast(explain(e), "bad"); }
    setSyncBusy(false);
  };
  const keepStudioVersion = async () => {
    if (!site) return;
    setSyncBusy(true);
    try {
      const f = await site.getText("content.json");
      if (f) onIndex(await studio.markSynced(project.id, f.sha));
      setConflict(null);
      toast("Keeping the Studio's version. Publish with content to replace the live site's.");
    } catch (e) { toast(explain(e), "bad"); }
    setSyncBusy(false);
  };

  const dirty = v !== savedV;
  useEffect(() => {
    const on = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    addEventListener("beforeunload", on);
    return () => removeEventListener("beforeunload", on);
  }, [dirty]);

  const bump = useCallback(() => setV((n) => n + 1), []);
  const getBlob = useCallback((p: string) => studio.assetBlob(project.id, p), [studio, project.id]);
  const assets = useAssetMap(getBlob, draft, v);
  const upload = useCallback(async (file: File) => {
    const r = await studio.uploadAsset(project.id, file);
    assets.add(r.path, file);
    return r;
  }, [studio, project.id, assets.add]);
  const img = useCallback((val: any) => (val?.path ? assets.map[val.path] || "" : ""), [assets.map]);

  const save = async (quiet = false): Promise<boolean> => {
    if (!draft) return false;
    setSaving(true);
    const at = v;
    try {
      onIndex(await studio.saveContent(project.id, draft, tpl.summary(draft)));
      setSavedV(at);
      if (!quiet) toast("Saved to the Studio repository");
      setSaving(false);
      return true;
    } catch (e) {
      toast("Couldn't save: " + explain(e), "bad");
      setSaving(false);
      return false;
    }
  };

  const replaceDraft = (c: any) => { setDraft(merge(defaults.current || {}, clone(c))); setV((n) => n + 1); };

  const extras = useMemo(() => [{
    id: "backup", label: "Backup & reset", group: "Project", desc: "Copy, restore or reset this project's content.",
    render: () => <BackupPanel draft={draft} onReplace={replaceDraft} loadDefaults={() => loadDefaults(project.template)} />,
  }], [draft, project.template]);

  // The confirm is async, so stop the link first and navigate ourselves.
  const onBack = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (dirty && !(await confirm("Leave without saving?", "You have unsaved changes in this project.", "Leave", true))) return;
    location.hash = "#/";
  };

  if (!tpl) return <main className="p-10 text-center text-ink-300">This project uses a template this Studio doesn't have ({project.template}).</main>;
  if (err) return <main className="mx-auto max-w-xl px-4 py-16"><div className="card p-6"><h1 className="text-xl font-extrabold">Couldn't open the project</h1><p className="mt-2 text-sm text-ink-300">{err}</p></div></main>;
  if (!draft) return <main className="grid min-h-screen place-items-center"><Spinner label="Opening project…" /></main>;

  const cat = index.categories.find((c) => c.id === project.category);

  return (
    <div className="flex h-[100dvh] flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b border-ink-700 bg-ink-900 px-3 py-2.5 pt-[max(10px,env(safe-area-inset-top))] sm:px-4">
        <a href="#/" onClick={onBack} className="btn btn-ghost btn-sm" aria-label="Back to projects">← Projects</a>
        <div className="flex min-w-0 flex-col">
          <button type="button" className="truncate text-left font-extrabold hover:underline" onClick={() => setModal("details")} title="Edit project details">{project.name}</button>
          <span className="truncate text-xs text-ink-400">{tpl.name} · {tpl.kind}{cat ? ` · ${cat.name}` : ""}{project.client ? ` · ${project.client}` : ""} · v{project.version}</span>
        </div>
        <span className={`ml-1 flex items-center gap-1.5 text-xs ${dirty ? "text-amber-300" : "text-ink-400"}`}><span className={`h-2 w-2 rounded-full ${dirty ? "bg-amber-400" : "bg-emerald-400"}`} />{saving ? "Saving…" : dirty ? "Unsaved changes" : "Saved"}</span>
        <div className="ml-auto flex flex-wrap gap-1.5">
          <div className="flex rounded-lg border border-ink-600 lg:hidden" role="group" aria-label="Show">
            <button type="button" aria-pressed={pane === "edit"} className={`btn btn-sm border-0 ${pane === "edit" ? "bg-ink-700" : "bg-transparent"}`} onClick={() => setPane("edit")}>Edit</button>
            <button type="button" aria-pressed={pane === "preview"} className={`btn btn-sm border-0 ${pane === "preview" ? "bg-ink-700" : "bg-transparent"}`} onClick={() => setPane("preview")}>Preview</button>
          </div>
          <button type="button" className="btn btn-sm" onClick={() => setModal("history")}>History{project.exports.length ? ` (${project.exports.length})` : ""}</button>
          <button type="button" className="btn btn-sm" onClick={() => setModal("export")}>Export ZIP</button>
          <button type="button" className="btn btn-sm" onClick={() => setModal("publish")}>Publish to GitHub</button>
          <button type="button" className="btn btn-pri btn-sm" disabled={!dirty || saving} onClick={() => save()}>Save</button>
        </div>
      </header>
      {conflict && (
        <div className="flex flex-wrap items-center gap-2 border-b border-amber-400/40 bg-amber-400/10 px-4 py-2.5 text-[13px] text-amber-100" role="status">
          <span><b>The live site was edited in its own CMS{conflict.siteAt ? ` ${timeAgo(conflict.siteAt)}` : ""}</b>, and this project also changed since they were last in step.</span>
          <span className="ml-auto flex gap-2">
            <button type="button" className="btn btn-sm" disabled={syncBusy} onClick={useSiteVersion}>Use the site's version</button>
            <button type="button" className="btn btn-sm" disabled={syncBusy} onClick={keepStudioVersion}>Keep the Studio's version</button>
          </span>
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <div className={`min-h-0 min-w-0 flex-1 flex-col lg:flex ${pane === "edit" ? "flex" : "hidden"}`}>
          <Editor tpl={tpl} draft={draft} version={v} onChange={bump} upload={upload} img={img} extras={extras} />
        </div>
        <div className={`min-h-0 flex-col border-l border-ink-700 lg:flex lg:w-[46%] ${pane === "preview" ? "flex flex-1" : "hidden"}`}>
          <Preview tpl={tpl} base={`templates/${tpl.id}/`} content={draft} version={v} assets={assets.map} />
        </div>
      </div>

      {modal === "export" && <ExportDialog {...{ studio, project, tpl, draft, dirty, save, onIndex, getBlob }} onClose={() => setModal("")} />}
      {modal === "publish" && <PublishDialog {...{ studio, project, tpl, draft, dirty, save, onIndex, getBlob, session }} onClose={() => setModal("")} />}
      {modal === "history" && <HistoryDialog {...{ studio, project, tpl, getBlob }} onLoad={(c) => { replaceDraft(c); setModal(""); toast("Loaded into the editor. Save to keep it."); }} onClose={() => setModal("")} />}
      {modal === "details" && <DetailsDialog {...{ studio, index, project, session, onIndex }} onImported={(c) => { replaceDraft(c); setSavedV(v + 1); }} onClose={() => setModal("")} />}
    </div>
  );
}

type Common = { studio: Studio; project: ProjectMeta; tpl: (typeof TEMPLATES)[string]; draft: any; dirty: boolean; save: (quiet?: boolean) => Promise<boolean>; onIndex: (i: StudioIndex) => void; getBlob: (p: string) => Promise<Blob | null>; onClose: () => void };

function Checks({ list }: { list: string[] }) {
  if (!list.length) return <p className="rounded-lg border border-emerald-400/30 bg-emerald-400/5 px-3 py-2.5 text-[13px] text-emerald-100">Everything needed for this template is filled in.</p>;
  return (
    <div className="rounded-lg border border-amber-400/40 bg-amber-400/5 px-3 py-2.5 text-[13px] text-amber-100">
      <b>Check before you send this to anyone:</b>
      <ul className="mt-1 list-disc pl-5">{list.map((w) => <li key={w}>{w}</li>)}</ul>
    </div>
  );
}

function ExportDialog({ studio, project, tpl, draft, dirty, save, onIndex, getBlob, onClose }: Common) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const checks = tpl.checks?.(draft) || [];
  const go = async () => {
    setBusy(true);
    try {
      if (dirty && !(await save(true))) { setBusy(false); return; }
      const next = project.version + 1;
      const { files, warnings } = await buildSite({ template: tpl, content: draft, name: project.name, version: next, includeContent: true, getAsset: getBlob });
      const blob = await zipSite(files);
      downloadBlob(blob, zipName(project.name, next));
      const { index } = await studio.recordExport(project.id, { kind: "zip", note: note.trim() }, draft, "exported");
      onIndex(index);
      toast(warnings.length ? `ZIP downloaded with ${warnings.length} missing image(s).` : `v${next} downloaded`, warnings.length ? "bad" : "ok");
      onClose();
    } catch (e) {
      toast(explain(e), "bad");
      setBusy(false);
    }
  };
  return (
    <Modal title="Export as ZIP" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-pri" disabled={busy} onClick={go}>{busy ? "Building…" : `Download v${project.version + 1}`}</button></>}>
      <p className="text-sm text-ink-300">The ZIP is a complete website: every page, your content and images, and the site's own CMS at <code className="font-mono text-xs">{adminFile(draft)}</code>. Upload it to any GitHub repository to put it online.</p>
      <Checks list={checks} />
      <Field label="Version note (optional)" htmlFor="ex-note"><input id="ex-note" className="input" placeholder="e.g. Sent to client for review" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      {dirty && <p className="hint">Your unsaved changes are saved first.</p>}
    </Modal>
  );
}

function PublishDialog({ studio, project, tpl, draft, dirty, save, onIndex, getBlob, session, onClose }: Common & { session: Session }) {
  const toast = useToast();
  const [t, setT] = useState<PublishTarget>(project.publish || { owner: session.cfg.owner, repo: slugify(project.name), branch: "main" });
  const [withContent, setWithContent] = useState(!project.publish);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<PublishTarget | null>(null);
  const [admin, setAdmin] = useState("admin.html");
  const demo = studio.repo.demo;
  const checks = tpl.checks?.(draft) || [];
  const go = async () => {
    if (!t.owner.trim() || !t.repo.trim()) return toast("Fill in the GitHub owner and repository.", "bad");
    setBusy(true);
    try {
      if (dirty && !(await save(true))) { setBusy(false); return; }
      const target = { owner: t.owner.trim(), repo: t.repo.trim(), branch: t.branch.trim() || "main" };
      const repo = new GitHubRepo(target, session.token);
      await repo.check();
      const next = project.version + 1;
      // Keeping the site's own content keeps its own admin page name too.
      const live = withContent ? null : await repo.getJSON("content.json").catch(() => null);
      // Photos already in the repository stay put: only new ones are uploaded, so publishing a shop full of photos is quick.
      const keep = withContent ? new Set(await repo.list("assets/").catch(() => [] as string[])) : undefined;
      const { files, warnings, admin } = await buildSite({ template: tpl, content: draft, name: project.name, version: next, includeContent: withContent, getAsset: getBlob, admin: live ? adminFile(live.data) : undefined, bg: (live?.data as any)?.theme?.bg, keep });
      await publishSite(repo, files, `Publish v${next} from Site Studio${note.trim() ? `: ${note.trim()}` : ""}`, admin);
      setAdmin(admin);
      // Remember what the site holds now, so later edits in the site's own CMS are recognised and pulled back in.
      const siteSha = withContent ? (await repo.getText("content.json").catch(() => null))?.sha : undefined;
      const { index } = await studio.recordExport(project.id, { kind: "github", note: note.trim(), target: `${target.owner}/${target.repo}` }, draft, "published", target, siteSha);
      onIndex(index);
      if (warnings.length) toast(`Published with ${warnings.length} missing image(s).`, "bad");
      setDone(target);
    } catch (e) {
      toast(explain(e), "bad");
    }
    setBusy(false);
  };
  if (done) {
    const url = `https://${done.owner}.github.io/${done.repo === `${done.owner}.github.io` ? "" : done.repo + "/"}`;
    return (
      <Modal title="Published" onClose={onClose} footer={<button className="btn btn-pri" onClick={onClose}>Done</button>}>
        <p className="text-sm text-ink-300">v{project.version} is committed to <b className="text-ink-100">{done.owner}/{done.repo}</b>.</p>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-ink-200">
          <li>First time only: in that repository open <b>Settings → Pages</b>, choose <b>Deploy from a branch → {done.branch} / (root)</b> and save.</li>
          <li>The site goes live about a minute after each publish at <a className="font-semibold text-brand-300 underline" href={url} target="_blank" rel="noopener">{url}</a>.</li>
          <li>The site's own CMS is at <a className="font-semibold text-brand-300 underline" href={url + admin} target="_blank" rel="noopener">{url}{admin}</a>. Give the owner a token for that repository only.</li>
        </ol>
      </Modal>
    );
  }
  return (
    <Modal title="Publish to GitHub" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-pri" disabled={busy || demo} onClick={go}>{busy ? "Publishing…" : `Publish v${project.version + 1}`}</button></>}>
      {demo ? <p className="rounded-lg border border-amber-400/40 bg-amber-400/5 px-3 py-2.5 text-[13px] text-amber-100">Publishing needs a real GitHub login. Exit the demo and connect your repository to use it.</p>
        : <p className="text-sm text-ink-300">Commits the whole site to a repository in one go. Create the repository on GitHub first (it can be empty) and make sure your token can write to it.</p>}
      <Checks list={checks} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Owner" htmlFor="pb-o"><input id="pb-o" className="input" value={t.owner} onChange={(e) => setT({ ...t, owner: e.target.value })} /></Field>
        <Field label="Repository" htmlFor="pb-r"><input id="pb-r" className="input" value={t.repo} onChange={(e) => setT({ ...t, repo: e.target.value })} /></Field>
        <Field label="Branch" htmlFor="pb-b"><input id="pb-b" className="input" value={t.branch} onChange={(e) => setT({ ...t, branch: e.target.value })} /></Field>
      </div>
      <Toggle id="pb-content" label="Replace the site's content with this version" checked={withContent} onChange={setWithContent} />
      <p className="hint">{withContent ? "Overwrites content.json and images on the site, including any edits made in the site's own CMS." : "Updates pages, design code and the CMS only. Content edited in the site's own CMS is kept. Use Details → Import from site to bring those edits here."}</p>
      <Field label="Version note (optional)" htmlFor="pb-note"><input id="pb-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
    </Modal>
  );
}

function HistoryDialog({ studio, project, tpl, getBlob, onLoad, onClose }: Omit<Common, "draft" | "dirty" | "save" | "onIndex"> & { onLoad: (c: any) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(0);
  const act = async (e: ExportRec, kind: "load" | "zip") => {
    setBusy(e.version);
    try {
      const c = await studio.loadSnapshot(project.id, e.version);
      if (!c) throw new Error("That version's snapshot is missing.");
      if (kind === "load") onLoad(c);
      else {
        const { files } = await buildSite({ template: tpl, content: c, name: project.name, version: e.version, includeContent: true, getAsset: getBlob });
        downloadBlob(await zipSite(files), zipName(project.name, e.version));
      }
    } catch (x) {
      toast(explain(x), "bad");
    }
    setBusy(0);
  };
  return (
    <Modal title="Export history" wide onClose={onClose}>
      {!project.exports.length ? <p className="text-sm text-ink-300">Nothing exported yet. Each export saves a snapshot of the content, so you can download or re-edit any version later.</p> : (
        <ol className="flex flex-col gap-2">
          {project.exports.map((e) => (
            <li key={e.version + e.at} className="flex flex-wrap items-center gap-3 rounded-xl border border-ink-700 bg-ink-950 px-4 py-3">
              <span className="font-display text-lg font-extrabold tabular-nums">v{e.version}</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{e.kind === "github" ? `Published to ${e.target}` : "ZIP download"}{e.note ? ` · ${e.note}` : ""}</div>
                <div className="text-xs text-ink-400" title={fmtDate(e.at)}>{fmtDate(e.at)} · {timeAgo(e.at)}</div>
              </div>
              <button className="btn btn-sm" disabled={!!busy} onClick={() => act(e, "zip")}>{busy === e.version ? "Working…" : "Download"}</button>
              <button className="btn btn-sm" disabled={!!busy} onClick={() => act(e, "load")}>Load into editor</button>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}

function DetailsDialog({ studio, index, project, session, onIndex, onImported, onClose }: { studio: Studio; index: StudioIndex; project: ProjectMeta; session: Session; onIndex: (i: StudioIndex) => void; onImported: (c: any) => void; onClose: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [f, setF] = useState({ name: project.name, client: project.client, category: project.category, notes: project.notes, status: project.status });
  const [busy, setBusy] = useState("");
  const saveMeta = async () => {
    if (!f.name.trim()) return toast("The project needs a name.", "bad");
    setBusy("save");
    try { onIndex(await studio.updateMeta(project.id, { ...f, name: f.name.trim() })); toast("Details saved"); onClose(); } catch (e) { toast(explain(e), "bad"); setBusy(""); }
  };
  const [link, setLink] = useState<PublishTarget>({ owner: session.cfg.owner, repo: "", branch: "main" });
  const linkSite = async () => {
    const t = { owner: link.owner.trim(), repo: link.repo.trim().replace(/^.*github\.com\/[^/]+\//, "").replace(/\.git$|\/$/g, ""), branch: link.branch.trim() || "main" };
    if (!t.owner || !t.repo) return toast("Fill in the owner and repository.", "bad");
    setBusy("link");
    try {
      const site = new GitHubRepo(t, session.token);
      const f = await site.getJSON("content.json");
      if (!f) throw new Error(`${t.owner}/${t.repo} has no content.json. Is it a site exported from Site Studio?`);
      const info = await site.getJSON<{ template?: string }>("cms/site.json").catch(() => null);
      if (info?.data?.template && info.data.template !== project.template) throw new Error(`That site uses the ${info.data.template} template, and this project is a ${project.template}.`);
      onIndex(await studio.updateMeta(project.id, { publish: t, status: "published" }, `Link ${t.owner}/${t.repo}`));
      const r = await studio.importFromSite(project.id, site);
      onIndex(r.index);
      onImported(r.content);
      toast(`Linked to ${t.owner}/${t.repo} and loaded its live content.`);
      onClose();
    } catch (e) { toast(explain(e), "bad"); setBusy(""); }
  };
  const importSite = async () => {
    if (!project.publish) return;
    if (!(await confirm("Pull content from the live site?", "This replaces the Studio's copy of the content with what's live on the site now, including edits made in the site's own CMS.", "Pull"))) return;
    setBusy("import");
    try {
      const r = await studio.importFromSite(project.id, new GitHubRepo(project.publish, session.token));
      onIndex(r.index);
      onImported(r.content);
      toast(r.missing.length ? `Imported. ${r.missing.length} image(s) weren't found on the site.` : "Imported from the site");
      onClose();
    } catch (e) { toast(explain(e), "bad"); setBusy(""); }
  };
  return (
    <Modal title="Project details" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-pri" disabled={!!busy} onClick={saveMeta}>{busy === "save" ? "Saving…" : "Save details"}</button></>}>
      <Field label="Name" htmlFor="d-name"><input id="d-name" className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Client" htmlFor="d-client"><input id="d-client" className="input" value={f.client} onChange={(e) => setF({ ...f, client: e.target.value })} /></Field>
        <Field label="Category" htmlFor="d-cat"><select id="d-cat" className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}><option value="">No category</option>{index.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      </div>
      <Field label="Status" htmlFor="d-status"><select id="d-status" className="input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as ProjectMeta["status"] })}><option value="draft">Draft</option><option value="exported">Exported</option><option value="published">Published</option></select></Field>
      <Field label="Notes" htmlFor="d-notes"><textarea id="d-notes" className="input min-h-[80px]" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      <div className="rounded-xl border border-ink-700 bg-ink-950 p-4 text-sm">
        <div className="font-bold">Published site</div>
        {project.publish ? (
          <>
            <p className="mt-1 text-ink-300">{project.publish.owner}/{project.publish.repo} on {project.publish.branch}</p>
            <p className="hint mt-2">Kept in step automatically: edits published from the site's own CMS come into this project when you open the Studio or this project{project.syncedAt ? ` (last in step ${timeAgo(project.syncedAt)})` : ""}. If both sides changed, you choose which to keep.</p>
            <button type="button" className="btn btn-sm mt-3" disabled={!!busy || studio.repo.demo} onClick={importSite}>{busy === "import" ? "Importing…" : "Pull from the live site now"}</button>
          </>
        ) : (
          <>
            <p className="mt-1 text-ink-400">Not linked yet. Publish to GitHub links it, or link a site that's already live (for example one you uploaded from a ZIP) to keep it in step from here on.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <Field label="Owner" htmlFor="ln-o"><input id="ln-o" className="input" value={link.owner} onChange={(e) => setLink({ ...link, owner: e.target.value })} /></Field>
              <Field label="Repository" htmlFor="ln-r"><input id="ln-r" className="input" placeholder="kasa-katha" value={link.repo} onChange={(e) => setLink({ ...link, repo: e.target.value })} /></Field>
              <Field label="Branch" htmlFor="ln-b"><input id="ln-b" className="input" value={link.branch} onChange={(e) => setLink({ ...link, branch: e.target.value })} /></Field>
            </div>
            <button type="button" className="btn btn-sm mt-3" disabled={!!busy || studio.repo.demo} onClick={linkSite}>{busy === "link" ? "Linking…" : "Link and load its live content"}</button>
          </>
        )}
      </div>
      <p className="hint">Created {fmtDate(project.createdAt)} · last edited {timeAgo(project.updatedAt)}</p>
    </Modal>
  );
}
