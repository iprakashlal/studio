// A short help tour for a public page (Design yourself): a few pop-ups, each pointing at one thing on screen with a line
// or two about it. Steps whose target isn't on screen are left out. Esc, Skip or a click outside closes it.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export type MiniStep = { /** What it points at (none: shown in the middle). */ sel?: string; title: string; text: string };
type Box = { top: number; left: number; w: number; h: number };
const found = (sel?: string): Element | null => {
  if (!sel) return null;
  for (const e of Array.from(document.querySelectorAll(sel))) { const r = e.getBoundingClientRect(); if (r.width > 4 && r.height > 4) return e; }
  return null;
};

export function MiniTour({ steps, onEnd, label = "Help" }: { steps: MiniStep[]; onEnd: () => void; label?: string }) {
  // Only the steps whose target is on screen now (the others belong to a moment that hasn't come).
  const [list] = useState(() => steps.filter((s) => !s.sel || found(s.sel)));
  const [i, setI] = useState(0), [box, setBox] = useState<Box | null>(null), [pos, setPos] = useState<{ top: number; left: number; side: string; ax: number } | null>(null);
  const pop = useRef<HTMLDivElement>(null);
  const step = list[i];
  const measure = useCallback(() => {
    if (!step) return;
    const W = Math.min(330, innerWidth - 24), H = pop.current?.offsetHeight || 170, G = 14, M = 12, e = found(step.sel), r = e?.getBoundingClientRect();
    const b = r ? { top: r.top, left: r.left, w: r.width, h: r.height } : null; setBox(b);
    if (!b) { setPos({ top: Math.max(M, innerHeight / 2 - H / 2), left: innerWidth / 2 - W / 2, side: "in", ax: 0 }); return; }
    const cx = b.left + b.w / 2, l = Math.min(Math.max(M, cx - W / 2), innerWidth - W - M), ax = Math.min(Math.max(18, cx - l), W - 18);
    if (innerHeight - (b.top + b.h) - G - M >= H) setPos({ top: b.top + b.h + G, left: l, side: "bottom", ax });
    else if (b.top - G - M >= H) setPos({ top: b.top - G - H, left: l, side: "top", ax });
    else setPos({ top: Math.min(Math.max(M, b.top + 16), innerHeight - H - M), left: l, side: "in", ax: 0 });
  }, [step]);
  useLayoutEffect(() => { if (!step) return; try { found(step.sel)?.scrollIntoView({ block: "nearest", inline: "nearest" }); } catch { /* old browser */ } measure(); }, [step, measure]);
  useEffect(() => { if (!step) return; addEventListener("resize", measure); addEventListener("scroll", measure, true); const t = setInterval(measure, 400); return () => { removeEventListener("resize", measure); removeEventListener("scroll", measure, true); clearInterval(t); }; }, [step, measure]);
  const next = () => (i >= list.length - 1 ? onEnd() : setI(i + 1));
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onEnd(); } else if (e.key === "ArrowRight") next(); else if (e.key === "ArrowLeft") setI((n) => Math.max(0, n - 1)); };
    addEventListener("keydown", k, true); return () => removeEventListener("keydown", k, true);
  });
  if (!step) { setTimeout(onEnd, 0); return null; }
  const last = i === list.length - 1, W = Math.min(330, innerWidth - 24);
  return (
    <div className="fixed inset-0 z-[210]" role="dialog" aria-modal="true" aria-label={label}>
      <div className="absolute inset-0" onClick={onEnd} aria-hidden style={{ background: box ? "transparent" : "rgba(0,0,0,.5)" }} />
      {box && <div aria-hidden className="pointer-events-none absolute rounded-xl border-2 border-brand-400 transition-all duration-200" style={{ top: box.top - 5, left: box.left - 5, width: box.w + 10, height: box.h + 10, boxShadow: "0 0 0 9999px rgba(0,0,0,.5)" }} />}
      <div ref={pop} className="absolute flex flex-col gap-1.5 rounded-2xl border border-ink-600 bg-ink-900 p-4 text-ink-100 shadow-2xl transition-[top,left] duration-200" style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, width: W, visibility: pos ? "visible" : "hidden" }}>
        {pos && pos.side !== "in" && <span aria-hidden className="absolute h-3 w-3 rotate-45 border-ink-600 bg-ink-900" style={{ left: pos.ax - 6, ...(pos.side === "bottom" ? { top: -7, borderWidth: "1px 0 0 1px" } : { bottom: -7, borderWidth: "0 1px 1px 0" }) }} />}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-widest text-brand-400">{label}</span>
          <span className="ml-auto flex gap-1" aria-hidden>{list.map((_, k) => <i key={k} className={`h-1.5 rounded-full transition-all ${k === i ? "w-4 bg-brand-400" : "w-1.5 bg-ink-600"}`} />)}</span>
        </div>
        <h2 className="text-[15px] font-extrabold">{step.title}</h2>
        <p className="text-[13.5px] leading-relaxed text-ink-200">{step.text}</p>
        <div className="mt-1.5 flex items-center gap-2">
          {!last && <button type="button" className="btn btn-ghost btn-sm" onClick={onEnd}>Skip</button>}
          <span className="flex-1" />
          {i > 0 && <button type="button" className="btn btn-sm" onClick={() => setI(i - 1)}>Back</button>}
          <button type="button" className="btn btn-pri btn-sm" autoFocus onClick={next}>{last ? "Got it" : `Next (${i + 1}/${list.length})`}</button>
        </div>
      </div>
    </div>
  );
}
