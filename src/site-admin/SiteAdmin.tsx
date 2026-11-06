import { useCallback, useEffect, useMemo, useState } from "react";
import { TEMPLATES } from "../schema";
import { device, session as sess, watchIdle, type Session } from "../lib/auth";
import { GitHubRepo, explain, jsonB64, bytesB64 } from "../lib/repo";
import { blobToBytes, clone, safeFileName, textToB64 } from "../lib/util";
import ACCOUNT_HTML from "../../public/templates/store/account.html?raw";
import { Editor } from "../editor/Editor";
import { Preview } from "../editor/Preview";
import { BackupPanel } from "../editor/BackupPanel";
import { AccountPanel, Gate } from "../ui/gate";
import { Logo, Spinner, useConfirm, useToast } from "../ui/kit";
import { CustomersPanel, OrdersPanel } from "./ShopPanels";

const NS = "site-cms";
type SiteInfo = { template: string; name: string; version?: number };

export function SiteAdmin() {
  const toast = useToast();
  const [info, setInfo] = useState<SiteInfo | null>(null);
  const [infoErr, setInfoErr] = useState("");
  const [session, setSession] = useState<Session | null>(() => sess.load(NS));

  useEffect(() => {
    fetch("cms/site.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j: SiteInfo) => (TEMPLATES[j.template] ? setInfo(j) : setInfoErr(`This CMS doesn't know the "${j.template}" template.`)))
      .catch(() => setInfoErr("cms/site.json is missing, so the CMS can't tell which template this site uses. Re-export the site from Site Studio."));
  }, []);

  useEffect(() => {
    if (!session) return;
    return watchIdle(NS, () => { sess.clear(NS); setSession(null); toast("Signed out after 30 minutes without activity"); });
  }, [session]);

  if (infoErr) return <div className="grid min-h-screen place-items-center px-4"><div className="card max-w-md p-6"><h1 className="text-lg font-extrabold">Site CMS can't start</h1><p className="mt-2 text-sm text-ink-300">{infoErr}</p></div></div>;
  if (!info) return <div className="grid min-h-screen place-items-center"><Spinner label="Loading…" /></div>;
  if (!session) {
    return <Gate ns={NS} brand={`${info.name} · CMS`} repoNoun="website's repository"
      tokenHint="A fine-grained token for this website's repository only, with Contents: Read and write."
      onAuthed={setSession}
      footer={<a href="./" className="text-sm text-ink-400 hover:text-ink-100">← Back to the website</a>} />;
  }
  return <Workspace info={info} session={session} onSession={setSession} onSignOut={() => { sess.clear(NS); setSession(null); }} onForget={() => { device.clear(NS); sess.clear(NS); setSession(null); }} />;
}

function Workspace({ info, session, onSession, onSignOut, onForget }: { info: SiteInfo; session: Session; onSession: (s: Session) => void; onSignOut: () => void; onForget: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const tpl = TEMPLATES[info.template];
  const repo = useMemo(() => new GitHubRepo(session.cfg, session.token), [session]);
  const [saved, setSaved] = useState<any>(null);
  const [draft, setDraft] = useState<any>(null);
  const [sha, setSha] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [v, setV] = useState(0);
  const [savedV, setSavedV] = useState(0);
  const [saving, setSaving] = useState(false);
  const [pane, setPane] = useState<"edit" | "preview">("edit");
  const [assets, setAssets] = useState<Record<string, string>>({});
  const [cat, setCat] = useState("");
  const wide = cat === "shop-orders" || cat === "shop-customers";

  const load = useCallback(async () => {
    setErr("");
    try {
      const f = await repo.getJSON("content.json");
      if (!f) throw new Error("content.json wasn't found in the repository.");
      setSaved(f.data);
      setDraft(clone(f.data));
      setSha(f.sha);
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
  const img = useCallback((val: any) => (val?.path ? assets[val.path] || val.path : ""), [assets]);

  const save = async () => {
    setSaving(true);
    const at = v;
    try {
      const next = await repo.putFile("content.json", jsonB64(draft), "Update site content", sha);
      setSha(next);
      setSaved(clone(draft));
      setSavedV(at);
      // Turning customer accounts on later adds the Account page the export left out.
      if (tpl.id === "store" && draft.backend?.enabled && draft.backend?.accounts && !(await repo.getText("account.html"))) {
        await repo.putFile("account.html", textToB64(ACCOUNT_HTML), "Add customer account page");
      }
      toast("Saved. The live site updates in about a minute.");
    } catch (e: any) {
      if (e?.status === 409 || e?.status === 422) {
        const f = await repo.getJSON("content.json").catch(() => null);
        if (f) setSha(f.sha);
        toast("The content changed on GitHub since you opened it. Press Save again to replace it with yours.", "bad");
      } else toast("Couldn't save: " + explain(e), "bad");
    }
    setSaving(false);
  };

  const extras = useMemo(() => [
    ...(tpl.id === "store" ? [
      { id: "shop-orders", label: "Orders", group: "Shop", desc: "Every order from checkout. Update status, confirm UPI payments and message customers.", render: () => <OrdersPanel content={saved} /> },
      { id: "shop-customers", label: "Customers", group: "Shop", desc: "Signed-up customers by account number and email, with their orders.", render: () => <CustomersPanel content={saved} /> },
    ] : []),
    { id: "backup", label: "Backup & reset", group: "Settings", desc: "Copy, restore or reset the site's content.", render: () => <BackupPanel draft={draft} onReplace={(c) => { setDraft(clone(c)); bump(); }} loadDefaults={async () => clone(saved)} /> },
    { id: "account", label: "Account", group: "Settings", desc: "Your login on this device.", render: () => <AccountPanel ns={NS} session={session} onUpdated={onSession} onSignOut={onSignOut} onForget={onForget} /> },
  ], [draft, saved, session, tpl.id]);

  if (err) return <div className="grid min-h-screen place-items-center px-4"><div className="card flex max-w-md flex-col gap-3 p-6"><h1 className="text-lg font-extrabold">Couldn't load the site's content</h1><p className="text-sm text-ink-300">{err}</p><div className="flex gap-2"><button className="btn btn-pri" onClick={load}>Try again</button><button className="btn" onClick={onSignOut}>Sign out</button></div></div></div>;
  if (!draft) return <div className="grid min-h-screen place-items-center"><Spinner label="Loading the latest content from GitHub…" /></div>;

  return (
    <div className="flex h-[100dvh] flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b border-ink-700 bg-ink-900 px-3 py-2.5 pt-[max(10px,env(safe-area-inset-top))] sm:px-4">
        <span className="flex items-center gap-2.5 font-extrabold"><Logo />{info.name}</span>
        <span className="text-xs text-ink-400">{tpl.name} · CMS</span>
        <span className={`ml-1 flex items-center gap-1.5 text-xs ${dirty ? "text-amber-300" : "text-ink-400"}`}><span className={`h-2 w-2 rounded-full ${dirty ? "bg-amber-400" : "bg-emerald-400"}`} />{saving ? "Saving…" : dirty ? "Unsaved changes" : "All changes saved"}</span>
        <div className="ml-auto flex flex-wrap gap-1.5">
          <div className={`flex rounded-lg border border-ink-600 lg:hidden ${wide ? "hidden" : ""}`} role="group" aria-label="Show">
            <button type="button" aria-pressed={pane === "edit"} className={`btn btn-sm border-0 ${pane === "edit" ? "bg-ink-700" : "bg-transparent"}`} onClick={() => setPane("edit")}>Edit</button>
            <button type="button" aria-pressed={pane === "preview"} className={`btn btn-sm border-0 ${pane === "preview" ? "bg-ink-700" : "bg-transparent"}`} onClick={() => setPane("preview")}>Preview</button>
          </div>
          <a className="btn btn-sm" href="./" target="_blank" rel="noopener">View site ↗</a>
          <button type="button" className="btn btn-sm" disabled={!dirty} onClick={async () => { if (await confirm("Discard unsaved changes?", "Your edits since the last save will be lost.", "Discard", true)) { setDraft(clone(saved)); setV(0); setSavedV(0); } }}>Discard</button>
          <button type="button" className="btn btn-pri btn-sm" disabled={!dirty || saving} onClick={save}>Save &amp; publish</button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <div className={`min-h-0 min-w-0 flex-1 flex-col lg:flex ${pane === "edit" || wide ? "flex" : "hidden"}`}>
          <Editor tpl={tpl} draft={draft} version={v} onChange={bump} upload={upload} img={img} extras={extras} onCategory={setCat} />
        </div>
        <div className={`min-h-0 flex-col border-l border-ink-700 lg:w-[46%] ${wide ? "lg:hidden" : "lg:flex"} ${pane === "preview" && !wide ? "flex flex-1" : "hidden"}`}>
          <Preview tpl={tpl} base="" content={draft} version={v} assets={assets} />
        </div>
      </div>
    </div>
  );
}
