import { useState } from "react";
import type { Studio, StudioIndex } from "../lib/studio";
import { cleanNavLinks, navLinkOk } from "../lib/prefs";
import { useToast } from "../ui/kit";

/** Settings → General: own links (a name and an address) that show in the Studio's header after the standard ones. */
export function NavLinksCard({ studio, index, onIndex }: { studio: Studio; index: StudioIndex; onIndex: (i: StudioIndex) => void }) {
  const toast = useToast(), saved = index.prefs?.links || [];
  const [rows, setRows] = useState<{ label: string; url: string }[]>(saved.length ? saved : []), [busy, setBusy] = useState(false);
  const bad = rows.some((r) => (r.label.trim() || r.url.trim()) && (!r.label.trim() || !navLinkOk(r.url.trim())));
  const dirty = JSON.stringify(cleanNavLinks(rows)) !== JSON.stringify(saved);
  const save = async () => {
    setBusy(true);
    try {
      const links = cleanNavLinks(rows);
      onIndex(await studio.updateIndex((i) => { const p = { ...(i.prefs || {}) }; if (links.length) p.links = links; else delete p.links; i.prefs = p; }, "Studio header links"));
      setRows(links); toast("Saved. The links show in the header now.");
    } catch (e: any) { toast(e?.message || "Couldn't save the links.", "bad"); }
    setBusy(false);
  };
  const set = (i: number, k: "label" | "url", v: string) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  return (
    <section className="card flex flex-col gap-3 p-5" aria-label="Header links">
      <h3 className="text-[15px] font-extrabold">Header links</h3>
      <p className="text-sm text-ink-300">Add your own links (up to 5) to the Studio's header, beside Projects and Settings: for example <b className="text-ink-100">Themes</b> → <code>#/themes</code> or <b className="text-ink-100">Design yourself</b> → <code>#/design</code>, or any web address starting with https://.</p>
      {rows.map((r, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-[12rem_1fr_auto] sm:items-end">
          <label className="flex flex-col gap-1 text-xs text-ink-400">Name<input className="input" maxLength={24} placeholder="Themes" value={r.label} onChange={(e) => set(i, "label", e.target.value)} /></label>
          <label className="flex flex-col gap-1 text-xs text-ink-400">Link<input className="input" placeholder="#/themes or https://…" value={r.url} onChange={(e) => set(i, "url", e.target.value)} aria-invalid={!!r.url.trim() && !navLinkOk(r.url.trim())} /></label>
          <button type="button" className="btn btn-sm btn-danger" onClick={() => setRows((x) => x.filter((_, j) => j !== i))} aria-label={`Remove link ${r.label || i + 1}`}>Remove</button>
        </div>
      ))}
      {bad && <p className="m-0 text-xs text-amber-300" role="alert">Each link needs a name and an address that starts with https://, mailto: or #/ (a page of this Studio).</p>}
      <div className="flex flex-wrap gap-2">
        {rows.length < 5 && <button type="button" className="btn btn-sm" onClick={() => setRows((x) => [...x, { label: "", url: "" }])}>+ Add a link</button>}
        <button type="button" className="btn btn-pri btn-sm" disabled={busy || bad || !dirty} onClick={save}>{busy ? "Saving…" : "Save links"}</button>
      </div>
    </section>
  );
}
