// Settings → Project defaults → Studio: the emails the Studio itself sends (its sign-in code, Design yourself's email
// code, a new website request, an answer on a design shared for approval). Kept in the Studio's public/emails.json, which
// its Cloudflare database reads when it sends each one. Each has its subject and, if wanted, a whole template written
// in the same editor the sites' emails use.
import { useEffect, useState } from "react";
import type { Repo } from "../lib/repo";
import { explain } from "../lib/repo";
import { textToB64 } from "../lib/util";
import { MAIL_KINDS, STUDIO_MAILS } from "../lib/mailtpl";
import { MailTemplateEditor } from "../editor/MailTemplate";
import { useBrand } from "../lib/brand";
import { SkelLines, useToast } from "../ui/kit";

export const EMAILS_FILE = "public/emails.json";
type Mails = Record<string, any>;

export function StudioEmails({ repo, demo }: { repo: Repo; demo?: boolean }) {
  const toast = useToast(), b = useBrand();
  const [E, setE] = useState<Mails | null>(null), [sha, setSha] = useState<string | null>(null), [saved, setSaved] = useState("");
  const [pick, setPick] = useState(STUDIO_MAILS[0].key), [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
  useEffect(() => {
    repo.getText(EMAILS_FILE).then((f) => {
      let o: Mails = {}; try { o = f ? JSON.parse(f.text) || {} : {}; } catch { /* start empty */ }
      setE(o); setSha(f?.sha || null); setSaved(JSON.stringify(o));
    }).catch((e) => { setE({}); toast(explain(e), "bad"); });
  }, [repo]);
  const M = STUDIO_MAILS.find((x) => x.key === pick)!, K = MAIL_KINDS[M.kind];
  const T = (E?.[pick] && typeof E[pick] === "object" ? E[pick] : {}) as Record<string, string>;
  const put = (k: string, v: string) => setE((x) => { const n = { ...(x || {}) }, t = { ...(n[pick] || {}) }; if (v) t[k] = v; else delete t[k]; if (Object.keys(t).length) n[pick] = t; else delete n[pick]; return n; });
  const dirty = E !== null && JSON.stringify(E) !== saved;
  const save = async () => {
    if (!E) return; setBusy(true);
    try { const body = { ...E, name: b.name }; setSha(await repo.putFile(EMAILS_FILE, textToB64(JSON.stringify(body, null, 2)), "Update the Studio's emails", sha)); setE(body); setSaved(JSON.stringify(body)); toast("Saved. The next email of each kind uses it."); }
    catch (e) { toast("Not saved: " + explain(e), "bad"); }
    setBusy(false);
  };
  const vars = K.vars.map(([v]) => "{" + v + "}").join(" ");
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
        <nav className="card flex flex-row gap-1 overflow-x-auto p-2 lg:sticky lg:top-32 lg:flex-col" aria-label="Studio emails">
          {STUDIO_MAILS.map((x) => { const has = !!(E?.[x.key]?.tpl || E?.[x.key]?.subject || E?.[x.key]?.intro || E?.[x.key]?.footer); return (
            <button key={x.key} type="button" aria-current={pick === x.key ? "true" : undefined} onClick={() => setPick(x.key)}
              className={`flex flex-none items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] font-semibold transition ${pick === x.key ? "bg-ink-800 text-ink-100" : "text-ink-300 hover:bg-ink-800/60"}`}>
              <span aria-hidden className={`h-2 w-2 flex-none rounded-full ${has ? "bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400/60" : "bg-ink-600"}`} />
              <span className="flex-1 whitespace-nowrap lg:whitespace-normal">{MAIL_KINDS[x.kind].label}</span><span className="sr-only">{has ? "(your own wording)" : "(standard)"}</span>
            </button>); })}
        </nav>
        <section className="card flex min-w-0 flex-col gap-4 p-5" aria-label={K.label}>
          <div><h3 className="text-[16px] font-extrabold">{K.label} <span className="font-semibold text-ink-400">· Studio</span></h3><p className="mt-0.5 text-sm text-ink-400">{M.note}</p></div>
          {!E ? <SkelLines n={5} /> : <>
            <label className="flex flex-col gap-1.5"><span className="label">Subject</span>
              <input className="input" value={T.subject || ""} placeholder={K.subject} maxLength={150} onChange={(e) => put("subject", e.target.value)} /></label>
            {pick === "signin" && <div className="grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1.5"><span className="label">Line above the code</span><textarea className="input" rows={3} value={T.intro || ""} placeholder={`Enter this code to sign in to ${b.name}:`} maxLength={600} onChange={(e) => put("intro", e.target.value)} /></label>
              <label className="flex flex-col gap-1.5"><span className="label">Line below the code</span><textarea className="input" rows={3} value={T.footer || ""} placeholder="It works for 10 minutes. If you didn't ask for it, ignore this email." maxLength={600} onChange={(e) => put("footer", e.target.value)} /></label>
            </div>}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-ink-700 bg-ink-950/40 px-3 py-2.5">
              <button type="button" className="btn btn-sm" onClick={() => setOpen(true)}>Edit template</button>
              <span className="text-[12.5px] text-ink-400">{T.tpl ? "A template is in use: it is the whole email (the subject above still sets the subject)." : "Write the whole email yourself, with a live preview, or paste an HTML email."}</span>
            </div>
            <p className="hint">Words in curly brackets are filled in when it is sent: <span className="font-mono">{vars}</span>{K.blocks.length ? <> · on a line of its own: <span className="font-mono">{K.blocks.map(([x]) => "{" + x + "}").join(" ")}</span></> : null}. Leave a box empty for the standard wording shown in grey.</p>
          </>}
        </section>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" className="btn btn-pri" disabled={!dirty || busy || demo} onClick={save}>{busy ? "Saving…" : "Save Studio emails"}</button>
        <span className="text-[12.5px] text-ink-400">{demo ? "Not saved in the demo." : dirty ? "Unsaved changes" : "All changes saved"} · Used straight away, no publishing needed. Needs the Studio on Cloudflare, which sends them.</span>
      </div>
      {open && E && <MailTemplateEditor kind={M.kind} value={T.tpl || ""} subject={T.subject || K.subject} siteName={b.name} cf={null} onClose={() => setOpen(false)} onSave={(t) => put("tpl", t)} />}
    </div>
  );
}
