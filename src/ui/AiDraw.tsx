import { useEffect, useRef, useState } from "react";
import { generateImages, type PhotoBlob } from "../lib/pictures";
import { readDesignSettings } from "../lib/designs";

/** Whether pictures may be drawn by the free AI generator in the site editor (on unless turned off in Settings → Design). */
export const aiDrawInEditor = () => readDesignSettings().adminAi !== false;

/** "Describe it and we'll draw it": a few words give small choices from the free AI Horde generator; tapping one hands it over as an image file. */
export function AiDraw({ logo = false, count = 2, onUse, disabled, initial = "", placeholder, label = "Or describe it and we'll draw it" }: { logo?: boolean; count?: number; onUse: (f: File) => void | Promise<void>; disabled?: boolean; initial?: string; placeholder?: string; label?: string }) {
  const [what, setWhat] = useState(initial), [busy, setBusy] = useState(""), [err, setErr] = useState(""), [got, setGot] = useState<{ f: File; u: string; b: PhotoBlob }[]>([]);
  // Photos from Unsplash in the place of drawing (Settings → AI): the wording says "find" instead of "draw". A logo is always drawn.
  const stock = !logo && readDesignSettings().images?.source === "unsplash";
  const stop = useRef<AbortController | null>(null);
  useEffect(() => () => stop.current?.abort(), []);
  useEffect(() => () => got.forEach((g) => URL.revokeObjectURL(g.u)), [got]);
  const go = async () => {
    stop.current?.abort(); const ac = (stop.current = new AbortController()); setErr(""); setBusy("Sending…"); setGot([]);
    try {
      const bl = await generateImages(what, { style: readDesignSettings().images?.style, source: readDesignSettings().images?.source, kind: logo ? "logo" : "photo", n: count, signal: ac.signal, status: setBusy });
      setGot((bl as PhotoBlob[]).map((b, i) => ({ b, f: new File([b], b.credit ? `unsplash-${i + 1}.jpg` : `drawn-${i + 1}.webp`, { type: b.type || (b.credit ? "image/jpeg" : "image/webp") }), u: URL.createObjectURL(b) })));
    } catch (e: any) { if (!ac.signal.aborted) setErr(e?.message || (stock ? "Couldn't find photos. Please try again." : "Couldn't draw that. Please try again.")); }
    setBusy("");
  };
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-ink-700 p-3">
      <label className="flex flex-col gap-1 text-xs text-ink-400">{stock ? label.replace("and we'll draw it", "and we'll find a photo") : label}
        <span className="flex flex-wrap gap-2">
          <input className="input min-w-0 flex-1 basis-[14rem]" maxLength={300} disabled={disabled || !!busy} placeholder={placeholder || (logo ? "e.g. a green leaf inside a circle, modern and simple" : "e.g. a sunny café interior with wooden tables")} value={what} onChange={(e) => setWhat(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (what.trim() && !busy) go(); } }} />
          <button type="button" className="btn btn-sm" disabled={disabled || !!busy || !what.trim()} onClick={go}>{stock ? (busy ? "Looking…" : got.length ? "Find others" : "Find photos") : busy ? "Drawing…" : got.length ? "Draw again" : "Draw it"}</button>
        </span>
      </label>
      {busy && <p className="m-0 text-xs text-ink-400" role="status">{busy} <button type="button" className="underline" onClick={() => { stop.current?.abort(); setBusy(""); }}>Cancel</button></p>}
      {err && <p className="m-0 text-xs text-red-400" role="alert">{err}</p>}
      {!!got.length && <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label={stock ? "Photos found" : "Drawn pictures"}>
        {got.map((g, i) => <div key={g.u} className="flex min-w-0 flex-col gap-1">
          <button type="button" aria-label={g.b.credit ? `Use photo ${i + 1}${g.b.credit.by ? ", by " + g.b.credit.by : ""}` : `Use drawn picture ${i + 1}`} disabled={disabled} onClick={() => { g.b.used?.(); onUse(g.f); }} className="aspect-[4/3] overflow-hidden rounded-xl border border-ink-700 bg-white hover:border-brand-400"><img src={g.u} alt="" className={`h-full w-full ${logo ? "object-contain" : "object-cover"}`} /></button>
          {g.b.credit && <span className="truncate text-[10.5px] text-ink-500">Photo by <a className="underline" href={`${g.b.credit.link || g.b.credit.page}?utm_source=picaffectz_studio&utm_medium=referral`} target="_blank" rel="noopener noreferrer">{g.b.credit.by || "a photographer"}</a> on <a className="underline" href="https://unsplash.com/?utm_source=picaffectz_studio&utm_medium=referral" target="_blank" rel="noopener noreferrer">Unsplash</a></span>}
        </div>)}
      </div>}
      {stock ? <p className="m-0 text-[11px] text-ink-500">Real photos from Unsplash, free to use under the Unsplash licence. Crediting the photographer is appreciated. Don't type private details: the words are sent to Unsplash.</p> :
      <p className="m-0 text-[11px] text-ink-500">Drawn by AI (the Studio's own engine, or the free AI Horde on volunteers' computers, which can queue for a short while). Don't type private details, and check the picture before using it on a live site; the result may not be yours exclusively.</p>}
    </div>
  );
}
