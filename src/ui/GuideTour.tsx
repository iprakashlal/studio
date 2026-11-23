// Plays a guide from Settings → Help (see lib/guides.ts): a pop-up with an arrow beside the real button or card, moving
// between screens by itself. Back, Next, Skip, and the arrow keys and Escape work. Nothing is saved when it ends.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { GUIDES, guide, type Guide } from "../lib/guides";

type Box = { top: number; left: number; w: number; h: number };
function find(sel?: string): Element | null {
  if (!sel) return null;
  // "a || b": the first of these that is on screen.
  if (sel.includes(" || ")) { for (const x of sel.split(" || ")) { const e = find(x); if (e && e.getBoundingClientRect().width > 4) return e; } return null; }
  try {
    if (sel.startsWith("h:")) { const t = sel.slice(2).trim().toLowerCase(); const h = [...document.querySelectorAll("h1,h2,h3,h4")].find((x) => (x.textContent || "").trim().toLowerCase().startsWith(t)); return h ? h.closest("section, .card") || h : null; }
    if (sel.startsWith("b:")) { const t = sel.slice(2).trim().toLowerCase(); return [...document.querySelectorAll("button, a")].find((x) => (x.textContent || "").trim().toLowerCase().includes(t)) || null; }
    return document.querySelector(sel);
  } catch { return null; }
}
const shown = (sel?: string): Element | null => { const e = find(sel); if (!e) return null; const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4 ? e : null; };

export function GuideTourHost() {
  const [g, setG] = useState<Guide | null>(null), [i, setI] = useState(0), [box, setBox] = useState<Box | null>(null);
  const pop = useRef<HTMLDivElement>(null), [at, setAt] = useState<{ top: number; left: number; side: "top" | "bottom" | "in" }>({ top: 80, left: 20, side: "in" });
  useEffect(() => { const f = (e: Event) => { const x = GUIDES.find((y) => y.id === (e as CustomEvent).detail?.id); if (x) { setG(x); setI(0); setBox(null); } }; addEventListener(guide.EVENT, f); return () => removeEventListener(guide.EVENT, f); }, []);
  const step = g ? g.steps[i] : null;
  // Entering a step: go to its screen, press its button, then follow the target.
  useEffect(() => {
    if (!step) return;
    if (step.go && location.hash !== step.go && !(step.go === "#/" && (location.hash === "" || location.hash === "#"))) location.hash = step.go;
    if (step.click) { const t = setTimeout(() => { try { (find(step.click) as HTMLElement | null)?.click(); } catch { /* gone */ } }, 350); return () => clearTimeout(t); }
  }, [step]);
  const measure = () => {
    if (!step) return;
    const e = shown(step.sel), W = Math.min(340, innerWidth - 24), H = pop.current?.offsetHeight || 190, M = 12, G = 14;
    if (!e) { setBox(null); setAt({ top: Math.max(M, innerHeight / 2 - H / 2), left: innerWidth / 2 - W / 2, side: "in" }); return; }
    const r = e.getBoundingClientRect(), b = { top: r.top, left: r.left, w: r.width, h: r.height };
    const left = Math.min(Math.max(M, b.left + b.w / 2 - W / 2), innerWidth - W - M);
    const below = innerHeight - (b.top + b.h) - G - M >= H, above = b.top - G - M >= H;
    setBox(b);
    setAt(below ? { top: b.top + b.h + G, left, side: "bottom" } : above ? { top: b.top - G - H, left, side: "top" } : { top: Math.min(Math.max(M, b.top + 20), innerHeight - H - M), left: Math.min(Math.max(M, b.left + 20), innerWidth - W - M), side: "in" });
  };
  useLayoutEffect(() => { if (!step) return; try { shown(step.sel)?.scrollIntoView({ block: "nearest" }); } catch { /* old browser */ } measure(); }, [step]);
  useEffect(() => { if (!step) return; const t = setInterval(measure, 300); addEventListener("resize", measure); addEventListener("scroll", measure, true); return () => { clearInterval(t); removeEventListener("resize", measure); removeEventListener("scroll", measure, true); }; }, [step]);
  useEffect(() => {
    if (!g) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setG(null); else if (e.key === "ArrowRight" || e.key === "Enter") setI((n) => (n >= g.steps.length - 1 ? (setG(null), n) : n + 1)); else if (e.key === "ArrowLeft") setI((n) => Math.max(0, n - 1)); };
    addEventListener("keydown", k); return () => removeEventListener("keydown", k);
  }, [g]);
  if (!g || !step) return null;
  const last = i === g.steps.length - 1, W = Math.min(340, innerWidth - 24);
  return (
    <div className="fixed inset-0 z-[300]" role="dialog" aria-modal="false" aria-label={g.title}>
      <div className="absolute inset-0" onClick={() => setG(null)} aria-hidden style={{ background: box ? "transparent" : "rgba(0,0,0,.45)" }} />
      {box && <div aria-hidden className="pointer-events-none absolute rounded-xl border-2 border-brand-400 transition-all duration-200" style={{ top: box.top - 4, left: box.left - 4, width: box.w + 8, height: box.h + 8, boxShadow: "0 0 0 9999px rgba(0,0,0,.45)" }} />}
      <div ref={pop} className="absolute flex flex-col gap-2 rounded-xl border border-ink-600 bg-ink-900 p-4 text-ink-100 shadow-2xl transition-[top,left] duration-200" style={{ top: at.top, left: at.left, width: W }}>
        {box && at.side !== "in" && <span aria-hidden className="absolute h-3 w-3 rotate-45 border-ink-600 bg-ink-900" style={{ left: Math.min(Math.max(14, box.left + box.w / 2 - at.left - 6), W - 26), ...(at.side === "bottom" ? { top: -7, borderWidth: "1px 0 0 1px" } : { bottom: -7, borderWidth: "0 1px 1px 0" }) }} />}
        <p className="text-[11px] font-bold uppercase tracking-widest text-ink-400">{g.title}</p>
        <h2 className="text-[15px] font-extrabold">{step.title}</h2>
        <p className="text-[13.5px] leading-relaxed text-ink-200">{step.text}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-sm" onClick={() => setG(null)}>{last ? "Close" : "Skip"}</button>
          <span className="flex-1" />
          {i > 0 && <button type="button" className="btn btn-sm" onClick={() => setI(i - 1)}>Back</button>}
          <button type="button" className="btn btn-pri btn-sm" autoFocus onClick={() => (last ? setG(null) : setI(i + 1))}>{last ? "Done" : "Next"}</button>
        </div>
        <p className="text-[11px] text-ink-400">Step {i + 1} of {g.steps.length} · replay from Settings → Help.</p>
      </div>
    </div>
  );
}
