import { useEffect, useRef, useState } from "react";
import { generateImages } from "../lib/pictures";
import { readDesignSettings } from "../lib/designs";

/** Whether pictures may be drawn by the free AI generator in the site editor (on unless turned off in Settings → Design). */
export const aiDrawInEditor = () => readDesignSettings().adminAi !== false;

/** "Describe it and we'll draw it": a few words give small choices from the free AI Horde generator; tapping one hands it over as an image file. */
export function AiDraw({ logo = false, count = 2, onUse, disabled, initial = "", placeholder, label = "Or describe it and we'll draw it" }: { logo?: boolean; count?: number; onUse: (f: File) => void | Promise<void>; disabled?: boolean; initial?: string; placeholder?: string; label?: string }) {
  const [what, setWhat] = useState(initial), [busy, setBusy] = useState(""), [err, setErr] = useState(""), [got, setGot] = useState<{ f: File; u: string }[]>([]);
  const stop = useRef<AbortController | null>(null);
  useEffect(() => () => stop.current?.abort(), []);
  useEffect(() => () => got.forEach((g) => URL.revokeObjectURL(g.u)), [got]);
  const go = async () => {
    stop.current?.abort(); const ac = (stop.current = new AbortController()); setErr(""); setBusy("Sending…"); setGot([]);
    try {
      const bl = await generateImages(what, { style: readDesignSettings().images?.style, source: readDesignSettings().images?.source, kind: logo ? "logo" : "photo", n: count, signal: ac.signal, status: setBusy });
      setGot(bl.map((b, i) => ({ f: new File([b], `drawn-${i + 1}.webp`, { type: b.type || "image/webp" }), u: URL.createObjectURL(b) })));
    } catch (e: any) { if (!ac.signal.aborted) setErr(e?.message || "Couldn't draw that. Please try again."); }
    setBusy("");
  };
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-ink-700 p-3">
      <label className="flex flex-col gap-1 text-xs text-ink-400">{label}
        <span className="flex flex-wrap gap-2">
          <input className="input min-w-0 flex-1 basis-[14rem]" maxLength={300} disabled={disabled || !!busy} placeholder={placeholder || (logo ? "e.g. a green leaf inside a circle, modern and simple" : "e.g. a sunny café interior with wooden tables")} value={what} onChange={(e) => setWhat(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (what.trim() && !busy) go(); } }} />
          <button type="button" className="btn btn-sm" disabled={disabled || !!busy || !what.trim()} onClick={go}>{busy ? "Drawing…" : got.length ? "Draw again" : "Draw it"}</button>
        </span>
      </label>
      {busy && <p className="m-0 text-xs text-ink-400" role="status">{busy} <button type="button" className="underline" onClick={() => { stop.current?.abort(); setBusy(""); }}>Cancel</button></p>}
      {err && <p className="m-0 text-xs text-red-400" role="alert">{err}</p>}
      {!!got.length && <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Drawn pictures">
        {got.map((g, i) => <button key={g.u} type="button" aria-label={`Use drawn picture ${i + 1}`} disabled={disabled} onClick={() => onUse(g.f)} className="aspect-[4/3] overflow-hidden rounded-xl border border-ink-700 bg-white hover:border-brand-400"><img src={g.u} alt="" className={`h-full w-full ${logo ? "object-contain" : "object-cover"}`} /></button>)}
      </div>}
      <p className="m-0 text-[11px] text-ink-500">Drawn by AI (the Studio's own engine, or the free AI Horde on volunteers' computers, which can queue for a short while). Don't type private details, and check the picture before using it on a live site; the result may not be yours exclusively.</p>
    </div>
  );
}
