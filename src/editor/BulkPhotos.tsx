// Photos in bulk: choose many pictures at once, then say which dish (restaurant) or product (shop) each belongs to.
// A file named after its dish or product is matched by itself. Nothing is uploaded until "Add" is pressed.

import { useContext, useEffect, useRef, useState } from "react";
import { Ctx } from "./fields";
import { ProgressBar, useToast } from "../ui/kit";

type Pick = { file: File; url: string; to: string; auto: boolean };
type Opt = { key: string; label: string; group: string; has: number; put: (img: { path: string }) => void };
const words = (v: string) => v.toLowerCase().replace(/\.[a-z0-9]+$/i, "").replace(/[^a-z0-9ऀ-ॿ]+/g, " ").trim().split(" ").filter(Boolean);
const MAX = 80, BIG = 20 * 1024 * 1024;

export function BulkPhotos({ kind }: { kind: "dish" | "product" }) {
  const { root, upload, bump } = useContext(Ctx)!, toast = useToast();
  const [picks, setPicks] = useState<Pick[] | null>(null), [busy, setBusy] = useState<number | null>(null), input = useRef<HTMLInputElement>(null);
  const one = kind === "dish" ? "dish" : "product";
  // every dish or product a photo can go to
  const opts = ((): Opt[] => {
    const out: Opt[] = [];
    if (kind === "dish") (root.food?.categories || []).forEach((k: any, ki: number) => (k?.items || []).forEach((d: any, di: number) => { const n = String(d?.name || "").trim(); if (n) out.push({ key: ki + ":" + di, label: n, group: String(k?.name || "Menu").trim() || "Menu", has: d.image?.path ? 1 : 0, put: (img) => { d.image = img; root.food.photos = true; } }); }));
    else (root.products || []).forEach((p: any, i: number) => { const n = String(p?.name || "").trim(); if (n) out.push({ key: String(i), label: n, group: String(p?.category || "").trim(), has: Array.isArray(p.images) ? p.images.length : 0, put: (img) => { (p.images = Array.isArray(p.images) ? p.images : []).push(img); } }); });
    return out;
  })();
  const groups = (() => { const g: { name: string; items: Opt[] }[] = []; for (const o of opts) { let x = g.find((y) => y.name === o.group); if (!x) g.push((x = { name: o.group, items: [] })); x.items.push(o); } return g; })();
  useEffect(() => () => { (picks || []).forEach((p) => URL.revokeObjectURL(p.url)); }, [picks]);

  /** The dish or product a file is named after: every word of its name is in the file's name (the longest name wins). */
  const match = (name: string): string => {
    const w = new Set(words(name)); let best = "", n = 0;
    for (const o of opts) { const ow = words(o.label); if (ow.length && ow.every((x) => w.has(x)) && ow.join(" ").length > n) { best = o.key; n = ow.join(" ").length; } }
    return best;
  };
  const choose = (list: FileList | null) => {
    const files = Array.from(list || []), ok: Pick[] = []; let bad = 0;
    for (const f of files) { if (!/^image\/(png|jpe?g|webp|gif)$/.test(f.type) || f.size > BIG) { bad++; continue; } if (ok.length >= MAX) break; const to = match(f.name); ok.push({ file: f, url: URL.createObjectURL(f), to, auto: !!to }); }
    if (bad) toast(`${bad} file${bad === 1 ? " was" : "s were"} left out: use JPG, PNG, WebP or GIF, up to 20 MB each.`, "bad");
    if (files.length - bad > MAX) toast(`Only the first ${MAX} photos were taken. Add the rest in another round.`, "bad");
    if (ok.length) setPicks(ok); if (input.current) input.current.value = "";
  };
  const set = (i: number, to: string) => setPicks((p) => p && p.map((x, j) => (j === i ? { ...x, to, auto: false } : x)));
  const drop = (i: number) => setPicks((p) => { const n = (p || []).filter((_, j) => j !== i); return n.length ? n : null; });
  const going = (picks || []).filter((p) => p.to), by = new Map(opts.map((o) => [o.key, o]));
  // a dish shows one photo: of several sent to the same dish, the last is kept
  const lastFor = new Map<string, number>(); (picks || []).forEach((p, i) => { if (p.to) lastFor.set(p.to, i); });
  const add = async () => {
    if (!picks) return; let done = 0, failed = 0; setBusy(0);
    const todo = picks.map((p, i) => ({ p, i })).filter(({ p, i }) => p.to && by.get(p.to) && (kind === "product" || lastFor.get(p.to) === i));
    for (const { p } of todo) {
      try { by.get(p.to)!.put(await upload(p.file)); } catch { failed++; }
      setBusy(++done / todo.length);
    }
    bump(); setBusy(null); setPicks(null);
    toast(failed ? `${done - failed} of ${todo.length} photos added; ${failed} couldn't be uploaded. Try those again.` : `${done} photo${done === 1 ? "" : "s"} added to ${kind === "dish" ? "the menu" : "your products"}. Save to keep them.`, failed ? "bad" : undefined);
  };

  if (!opts.length) return <p className="text-sm text-ink-400">Add your {one === "dish" ? "dishes" : "products"} first (below), then come back to give them photos in one go.</p>;
  return (
    <div className="flex flex-col gap-3" aria-label="Photos in bulk">
      <p className="text-sm text-ink-300">Choose many photos at once, then say which {one} each one belongs to. A photo named after its {one} (for example “{opts[0].label.toLowerCase().replace(/\s+/g, "-")}.jpg”) is matched by itself. {kind === "dish" ? "A dish shows one photo; a new one replaces the old." : "A product can have several photos; new ones are added after the ones it has."}</p>
      <div><label className={`btn relative cursor-pointer ${busy !== null ? "pointer-events-none opacity-50" : ""}`}>{picks ? "Choose other photos" : "Choose photos"}<input ref={input} type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={(e) => choose(e.target.files)} /></label></div>
      {picks && (
        <>
          <p className="text-[13px] text-ink-300" role="status"><b className="text-ink-100">{picks.length} photo{picks.length === 1 ? "" : "s"}</b> · {picks.filter((p) => p.auto).length} matched by file name · {picks.filter((p) => !p.to).length} still to choose</p>
          <ul className="flex flex-col gap-2">
            {picks.map((p, i) => { const o = by.get(p.to), dup = kind === "dish" && p.to && lastFor.get(p.to) !== i; return (
              <li key={p.url} className="flex flex-wrap items-center gap-3 rounded-lg border border-ink-700 p-2">
                <img src={p.url} alt="" className="h-14 w-14 flex-none rounded-md object-cover" />
                <div className="min-w-0 flex-1 basis-40">
                  <div className="truncate text-[13px] font-semibold text-ink-100">{p.file.name}</div>
                  <div className="text-[12px] text-ink-400">{dup ? <span className="text-amber-200">Another photo below goes to this dish, so this one is left out.</span> : !p.to ? "Not used unless you choose where it goes." : p.auto ? "Matched by its file name." : ""}{!dup && o && kind === "dish" && o.has ? " Replaces the dish's current photo." : ""}{!dup && o && kind === "product" && o.has ? ` Added after its ${o.has} photo${o.has === 1 ? "" : "s"}.` : ""}</div>
                </div>
                <select className="input w-full py-1.5 text-[13px] sm:w-64" aria-label={`Where ${p.file.name} goes`} value={p.to} disabled={busy !== null} onChange={(e) => set(i, e.target.value)}>
                  <option value="">Don't use this photo</option>
                  {groups.map((g) => g.name ? <optgroup key={g.name} label={g.name}>{g.items.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</optgroup> : g.items.map((x) => <option key={x.key} value={x.key}>{x.label}</option>))}
                </select>
                <button type="button" className="btn btn-ghost btn-sm" aria-label={`Remove ${p.file.name}`} disabled={busy !== null} onClick={() => drop(i)}>✕</button>
              </li>
            ); })}
          </ul>
          {busy !== null && <ProgressBar value={busy} label="Uploading photos…" />}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-pri" disabled={busy !== null || !going.length} onClick={add}>{busy !== null ? "Adding…" : `Add ${going.length} photo${going.length === 1 ? "" : "s"}`}</button>
            <button type="button" className="btn btn-ghost" disabled={busy !== null} onClick={() => setPicks(null)}>Cancel</button>
          </div>
        </>
      )}
    </div>
  );
}
