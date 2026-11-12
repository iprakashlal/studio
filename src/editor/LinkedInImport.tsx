import { useRef, useState } from "react";
import { Field, Spinner, Toggle, useToast } from "../ui/kit";
import { clone } from "../lib/util";
import { PART_LABELS, applyLinkedIn, available, profileUrl, readFiles, type ApplyParts, type LinkedInData } from "../lib/linkedin";

// Where pdf.js lives: next to the site's admin.js (cms/), or in the Studio's runtime/ folder.
const SCRIPT = typeof document !== "undefined" ? (document.currentScript as HTMLScriptElement | null)?.src : undefined;
const pdfBase = () => (SCRIPT ? new URL("./", SCRIPT).href : new URL("runtime/", location.href).href);
const EXPORT_PAGE = "https://www.linkedin.com/mypreferences/d/download-my-data";
// The content before the last import, kept while the editor is open so Undo survives switching sections.
const undoStore = new WeakMap<object, any>();
const linkStore = new WeakMap<object, string>();

export function LinkedInImport({ root, bump }: { root: any; bump: () => void }) {
  const toast = useToast();
  const existing = (root.contact?.links || []).find((l: any) => /linkedin\.com\/in\//i.test(l.url))?.url || "";
  const [link, setLinkState] = useState<string>(() => linkStore.get(root) ?? existing);
  const setLink = (v: string) => { linkStore.set(root, v); setLinkState(v); };
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [data, setData] = useState<LinkedInData | null>(null);
  const [parts, setParts] = useState<ApplyParts>({ profile: true, about: true, work: true, learning: true, skills: true, projects: true, contact: true });
  const [undo, setUndoState] = useState<any>(() => undoStore.get(root) || null);
  const setUndo = (v: any) => { if (v) undoStore.set(root, v); else undoStore.delete(root); setUndoState(v); };
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const url = profileUrl(link);
  const linkWarn = link.trim() && !url ? "Use your profile address, like linkedin.com/in/your-name." : undefined;

  async function read(files: File[]) {
    if (!files.length) return;
    setErr(""); setBusy(true); setData(null);
    try {
      const d = await readFiles(files, pdfBase());
      if (!url && d.profileUrl) setLink(d.profileUrl);
      setData(d);
    } catch (e: any) {
      setErr(e?.message || "Couldn't read that file.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  function apply() {
    if (!data) return;
    const before = clone(root);
    applyLinkedIn(root, data, parts, url || undefined);
    bump();
    setUndo(before);
    setData(null);
    toast("Imported from LinkedIn. Check each section, then save.");
  }

  function revert() {
    if (!undo) return;
    for (const k of Object.keys(root)) delete root[k];
    Object.assign(root, undo);
    bump();
    setUndo(null);
    toast("Import undone.");
  }

  const avail = data ? available(data) : {};
  const keys = Object.keys(avail) as (keyof ApplyParts)[];
  const replacing = keys.filter((k) => parts[k] && ["work", "learning", "projects"].includes(k));

  return (
    <div className="flex flex-col gap-4">
      <Field label="Your LinkedIn profile link" htmlFor="li-url" warn={linkWarn} hint={url ? "Saved to your Contact links when you import." : "For example linkedin.com/in/your-name"}>
        <div className="flex flex-wrap gap-2">
          <input id="li-url" className="input min-w-0 flex-1" inputMode="url" placeholder="https://www.linkedin.com/in/your-name" value={link} onChange={(e) => setLink(e.target.value)} />
          <a className={`btn btn-sm ${url ? "" : "pointer-events-none opacity-50"}`} href={url || undefined} target="_blank" rel="noopener noreferrer">Open profile ↗</a>
        </div>
      </Field>

      <p className="rounded-lg border border-ink-700 bg-ink-850 px-3 py-2.5 text-[13px] text-ink-300">
        LinkedIn doesn't let other websites read a profile from its link, so bring your details over with one of these files. Nothing is sent anywhere: the file is read in this browser.
      </p>

      <div className="grid gap-2.5 sm:grid-cols-2">
        <div className="rounded-xl border border-ink-600 bg-ink-950 p-3 text-[13px]">
          <b className="block text-sm">Quick: profile PDF</b>
          <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-ink-300">
            <li>Open your profile on a computer.</li>
            <li>Click <b>Resources</b> (or <b>More</b>) → <b>Save to PDF</b>.</li>
            <li>Upload that PDF here.</li>
          </ol>
          <span className="mt-2 block text-ink-400">Has your headline, about, experience, education and top skills.</span>
        </div>
        <div className="rounded-xl border border-ink-600 bg-ink-950 p-3 text-[13px]">
          <b className="block text-sm">Complete: data export</b>
          <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-ink-300">
            <li><a className="text-brand-300 underline" href={EXPORT_PAGE} target="_blank" rel="noopener noreferrer">Get a copy of your data ↗</a></li>
            <li>Pick the files you want (Profile, Positions, Education, Skills…) and request the archive.</li>
            <li>LinkedIn emails a ZIP, usually within an hour. Upload it here.</li>
          </ol>
          <span className="mt-2 block text-ink-400">Adds all skills, certifications, languages and projects.</span>
        </div>
      </div>

      <label htmlFor="li-file" onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); read([...e.dataTransfer.files]); }}
        className={`flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed px-4 py-6 text-center text-sm transition ${drag ? "border-brand-400 bg-brand-500/10" : "border-ink-600 hover:border-brand-500"}`}>
        <b>Upload your LinkedIn PDF or data export</b>
        <span className="text-[13px] text-ink-400">Drop a .pdf, a .zip, or the .csv files here, or click to choose</span>
        <input id="li-file" ref={input} type="file" multiple accept=".pdf,.zip,.csv,application/pdf,application/zip,text/csv" className="sr-only" onChange={(e) => read([...(e.target.files || [])])} />
      </label>

      {busy && <Spinner label="Reading your LinkedIn file…" />}
      {err && <p role="alert" className="rounded-lg border border-amber-400/40 bg-amber-400/5 px-3 py-2.5 text-[13px] text-amber-100">{err}</p>}

      {data && (
        <div className="flex flex-col gap-2.5 rounded-xl border border-brand-500/50 bg-ink-950 p-3" aria-label="Choose what to import">
          <b className="text-sm">Found in your {data.source === "pdf" ? "profile PDF" : "data export"}. Choose what to bring in:</b>
          {keys.length === 0 && <span className="text-[13px] text-ink-300">Nothing we can use was found in this file.</span>}
          {keys.map((k) => (
            <div key={k} className="flex flex-col gap-1">
              <Toggle id={`li-${k}`} label={PART_LABELS[k]} checked={parts[k]} onChange={(v) => setParts({ ...parts, [k]: v })} />
              <span className="px-1 text-xs text-ink-400">{avail[k]}</span>
            </div>
          ))}
          {replacing.length > 0 && (
            <p className="rounded-lg border border-amber-400/40 bg-amber-400/5 px-3 py-2 text-[13px] text-amber-100">
              This replaces the current {replacing.map((k) => ({ work: "roles", learning: "learning entries", projects: "projects" } as any)[k]).join(", ")}. Colours, shapes and the design stay as they are. You can undo it right after.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-pri" disabled={!keys.some((k) => parts[k])} onClick={apply}>Import into my portfolio</button>
            <button type="button" className="btn" onClick={() => setData(null)}>Cancel</button>
          </div>
        </div>
      )}

      {undo && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-ink-600 bg-ink-950 p-3 text-[13px]">
          <span className="flex-1 text-ink-300">Imported. Check Hero, About, Work deck, Learning and Contact, add photos, then <b>Save</b>.</span>
          <button type="button" className="btn btn-sm" onClick={revert}>Undo import</button>
        </div>
      )}
    </div>
  );
}
