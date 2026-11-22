// A guided tour for the site admin: small pop-ups with an arrow that point at the menu, the editing area, the preview and
// the Save buttons, then one pop-up for every section of the menu (each is opened for you and explained in a line or two).
// It is shown when someone signs in. Skip or Done turns it off for good (on this device); Settings → Help turns it back on
// or plays it again. Steps whose target isn't on screen (a phone shows one pane at a time) are left out.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const KEY = "site-admin-tour", EVENT = "site-admin:tour", GOTO = "studio:goto";
export const tourPref = {
  on(): boolean { try { return localStorage.getItem(KEY) !== "off"; } catch { return true; } },
  set(v: boolean) { try { localStorage.setItem(KEY, v ? "on" : "off"); } catch { /* private mode */ } dispatchEvent(new CustomEvent(EVENT, { detail: { on: v } })); },
  /** Play the tour now, whatever the setting says. */
  replay() { dispatchEvent(new CustomEvent(EVENT, { detail: { play: true } })); },
};
/** The setting as a React value (follows Settings → Help). */
export function useTourPref(): boolean {
  const [on, setOn] = useState(tourPref.on);
  useEffect(() => { const f = () => setOn(tourPref.on()); addEventListener(EVENT, f); return () => removeEventListener(EVENT, f); }, []);
  return on;
}
/** The menu's sections, kept up to date by the editor, so the tour can walk through every one. */
export const tourSections: { list: { id: string; label: string; group: string; desc: string; cards: string[] }[] } = { list: [] };

export type TourStep = { sel?: string; title: string; text: string; /** Open this section (by id) before showing the step. */ open?: string; /** The first step after the sections. */ after?: boolean; /** Shown in the step's header, e.g. the section's group. */ tag?: string };
type Box = { top: number; left: number; w: number; h: number };
const visible = (sel?: string): Element | null => { if (!sel) return null; const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4 ? e : null; };

/** What a section says about itself: its purpose, then the cards inside it. */
const sectionStep = (s: (typeof tourSections.list)[number], n: number, of: number): TourStep => ({
  sel: '[data-tour="section-head"]', open: s.id, tag: `Section ${n} of ${of} · ${s.group}`, title: s.label,
  text: (s.desc || "Settings for this part of your site.") + (s.cards.length ? ` Inside: ${s.cards.slice(0, 6).join(", ")}${s.cards.length > 6 ? ` and ${s.cards.length - 6} more` : ""}.` : ""),
});

export function TourHost({ intro, outro, delay = 1200 }: { intro: TourStep[]; outro: TourStep[]; delay?: number }) {
  const [live, setLive] = useState<TourStep[] | null>(null), [i, setI] = useState(0);
  type View = { box: Box | null; top: number; left: number; side: "top" | "bottom" | "left" | "right" | "in"; ax: number; ay: number };
  const [view, setView] = useState<View | null>(null);
  const pop = useRef<HTMLDivElement>(null);
  const start = useCallback(() => {
    const secs = tourSections.list.filter((s) => s.id !== "help");
    const s = [...intro.filter((x) => !x.sel || visible(x.sel)), ...secs.map((x, k) => sectionStep(x, k + 1, secs.length)), ...outro.filter((x) => !x.sel || visible(x.sel))];
    if (s.length) { setLive(s); setI(0); setView(null); }
  }, [intro, outro]);
  // On sign-in (when this screen opens): the tour, unless it was turned off. And whenever Settings → Help plays it.
  useEffect(() => { if (!tourPref.on()) return; const t = setTimeout(start, delay); return () => clearTimeout(t); }, []);
  useEffect(() => { const f = (e: Event) => { const d = (e as CustomEvent).detail || {}; if (d.play) start(); else if (d.on === false) setLive(null); }; addEventListener(EVENT, f); return () => removeEventListener(EVENT, f); }, [start]);
  const step = live ? live[i] : null;
  // Opening a section: the editor moves to it, then the highlight follows.
  useEffect(() => { if (step?.open) dispatchEvent(new CustomEvent(GOTO, { detail: { cat: step.open } })); }, [step]);
  /** Where the target is now, and where the pop-up goes: beside it (below, above, right or left: the first with room), its arrow touching it. One state, only changed when something moved. */
  const measure = useCallback(() => {
    if (!step) return;
    const W = Math.min(340, innerWidth - 24), H = pop.current?.offsetHeight || 190, G = 14, M = 12, e = visible(step.sel), r = e ? e.getBoundingClientRect() : null;
    const box: Box | null = r ? { top: r.top, left: r.left, w: r.width, h: r.height } : null;
    let v: View;
    if (!box) v = { box, top: Math.max(M, innerHeight / 2 - H / 2), left: innerWidth / 2 - W / 2, side: "in", ax: 0, ay: 0 };
    else {
      const cx = box.left + box.w / 2, cy = box.top + box.h / 2, clampX = (x: number) => Math.min(Math.max(M, x), innerWidth - W - M), clampY = (y: number) => Math.min(Math.max(M, y), innerHeight - H - M), lim = (n: number, hi: number) => Math.min(Math.max(18, n), hi - 18);
      const below = innerHeight - (box.top + box.h) - G - M >= H, above = box.top - G - M >= H, right = innerWidth - (box.left + box.w) - G - M >= W, left = box.left - G - M >= W;
      if (below) { const l = clampX(cx - W / 2); v = { box, top: box.top + box.h + G, left: l, side: "bottom", ax: lim(cx - l, W), ay: 0 }; }
      else if (above) { const l = clampX(cx - W / 2); v = { box, top: box.top - G - H, left: l, side: "top", ax: lim(cx - l, W), ay: 0 }; }
      else if (right) { const t = clampY(cy - H / 2); v = { box, top: t, left: box.left + box.w + G, side: "right", ax: 0, ay: lim(cy - t, H) }; }
      else if (left) { const t = clampY(cy - H / 2); v = { box, top: t, left: box.left - G - W, side: "left", ax: 0, ay: lim(cy - t, H) }; }
      else v = { box, top: clampY(box.top + 20), left: clampX(box.left + 20), side: "in", ax: 0, ay: 0 };
    }
    const q = (n: number) => Math.round(n);
    setView((o) => (o && o.side === v.side && q(o.top) === q(v.top) && q(o.left) === q(v.left) && q(o.ax) === q(v.ax) && q(o.ay) === q(v.ay) && !!o.box === !!v.box && (!o.box || !v.box || (q(o.box.top) === q(v.box.top) && q(o.box.left) === q(v.box.left) && q(o.box.w) === q(v.box.w) && q(o.box.h) === q(v.box.h))) ? o : v));
  }, [step]);
  useLayoutEffect(() => { if (!step) return; try { visible(step.sel)?.scrollIntoView({ block: "nearest", inline: "nearest" }); } catch { /* old browser */ } measure(); }, [step, measure]);
  useEffect(() => { if (!step) return; addEventListener("resize", measure); addEventListener("scroll", measure, true); const t = setInterval(measure, 300); return () => { removeEventListener("resize", measure); removeEventListener("scroll", measure, true); clearInterval(t); }; }, [step, measure]);
  const box = view?.box || null, pos = view;
  useEffect(() => { if (!live) return; const k = (e: KeyboardEvent) => { if (e.key === "Escape") end(); else if (e.key === "ArrowRight" || e.key === "Enter") next(); else if (e.key === "ArrowLeft") setI((n) => Math.max(0, n - 1)); }; addEventListener("keydown", k); return () => removeEventListener("keydown", k); });
  if (!live || !step) return null;
  /** Skip and Done are the same: the tour is finished and stays off until it is turned on in Settings → Help. */
  function end() { setLive(null); tourPref.set(false); }
  function next() { if (i >= live!.length - 1) end(); else setI(i + 1); }
  const last = i === live.length - 1, W = Math.min(340, innerWidth - 24), inSections = !!step.open, afterAt = live.findIndex((x) => !x.open && live.indexOf(x) > i);
  const arrow = pos && pos.side !== "in" ? ({ bottom: { top: -7, left: pos.ax - 6 }, top: { bottom: -7, left: pos.ax - 6 }, right: { left: -7, top: pos.ay - 6 }, left: { right: -7, top: pos.ay - 6 } } as const)[pos.side] : null;
  return (
    <div className="fixed inset-0 z-[200]" role="dialog" aria-modal="false" aria-label="Quick tour">
      <div className="absolute inset-0" onClick={end} aria-hidden style={{ background: box ? "transparent" : "rgba(0,0,0,.45)" }} />
      {box && <div aria-hidden className="pointer-events-none absolute rounded-xl border-2 border-brand-400 transition-all duration-200" style={{ top: box.top - 4, left: box.left - 4, width: box.w + 8, height: box.h + 8, boxShadow: "0 0 0 9999px rgba(0,0,0,.45)" }} />}
      <div ref={pop} data-side={pos?.side} className="absolute flex flex-col gap-2 rounded-xl border border-ink-600 bg-ink-900 p-4 text-ink-100 shadow-2xl transition-[top,left] duration-200" style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, width: W, visibility: pos ? "visible" : "hidden" }}>
        {arrow && <span aria-hidden className="absolute h-3 w-3 rotate-45 border-ink-600 bg-ink-900" style={{ ...arrow, borderWidth: pos!.side === "bottom" ? "1px 0 0 1px" : pos!.side === "top" ? "0 1px 1px 0" : pos!.side === "right" ? "0 0 1px 1px" : "1px 1px 0 0", borderStyle: "solid" }} />}
        <p className="text-[11px] font-bold uppercase tracking-widest text-ink-400">{step.tag || `Step ${i + 1} of ${live.length}`}</p>
        <h2 className="text-[15px] font-extrabold">{step.title}</h2>
        <p className="text-[13.5px] leading-relaxed text-ink-200">{step.text}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-sm" onClick={end}>{last ? "Close" : "Skip tour"}</button>
          {inSections && afterAt > 0 && <button type="button" className="btn btn-sm" onClick={() => setI(afterAt)}>Skip sections</button>}
          <span className="flex-1" />
          {i > 0 && <button type="button" className="btn btn-sm" onClick={() => setI(i - 1)}>Back</button>}
          <button type="button" className="btn btn-pri btn-sm" autoFocus onClick={next}>{last ? "Done" : "Next"}</button>
        </div>
        <p className="text-[11px] text-ink-400">Step {i + 1} of {live.length} · turn the tour on again in Settings → Help.</p>
      </div>
    </div>
  );
}
