// A short guided tour for the site admin: small pop-ups that point at the menu, the editing area, the preview and
// the Save buttons, shown when someone signs in. Skip or Done turns it off for good (on this device); Settings → Help
// turns it back on or plays it again. Steps whose target isn't on screen (a phone shows one pane at a time) are left out.
import { useCallback, useEffect, useLayoutEffect, useState } from "react";

const KEY = "site-admin-tour", EVENT = "site-admin:tour";
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

export type TourStep = { sel?: string; title: string; text: string };
type Box = { top: number; left: number; w: number; h: number };
const visible = (sel?: string): Element | null => { if (!sel) return null; const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4 ? e : null; };

export function TourHost({ steps, delay = 1200 }: { steps: TourStep[]; delay?: number }) {
  const [live, setLive] = useState<TourStep[] | null>(null), [i, setI] = useState(0), [box, setBox] = useState<Box | null>(null);
  const start = useCallback(() => { const s = steps.filter((x) => !x.sel || visible(x.sel)); if (s.length) { setLive(s); setI(0); } }, [steps]);
  // On sign-in (when this screen opens): the tour, unless it was turned off. And whenever Settings → Help plays it.
  useEffect(() => { if (!tourPref.on()) return; const t = setTimeout(start, delay); return () => clearTimeout(t); }, []);
  useEffect(() => { const f = (e: Event) => { const d = (e as CustomEvent).detail || {}; if (d.play) start(); else if (d.on === false) setLive(null); }; addEventListener(EVENT, f); return () => removeEventListener(EVENT, f); }, [start]);
  const step = live ? live[i] : null;
  const place = useCallback(() => { const e = visible(step?.sel); if (!e) return setBox(null); const r = e.getBoundingClientRect(); setBox({ top: r.top, left: r.left, w: r.width, h: r.height }); }, [step]);
  useLayoutEffect(() => { if (!step) return; const e = visible(step.sel); try { e?.scrollIntoView({ block: "nearest", inline: "nearest" }); } catch { /* old browser */ } place(); }, [step, place]);
  useEffect(() => { if (!step) return; addEventListener("resize", place); addEventListener("scroll", place, true); const t = setInterval(place, 400); return () => { removeEventListener("resize", place); removeEventListener("scroll", place, true); clearInterval(t); }; }, [step, place]);
  useEffect(() => { if (!live) return; const k = (e: KeyboardEvent) => { if (e.key === "Escape") end(); else if (e.key === "ArrowRight" || e.key === "Enter") next(); else if (e.key === "ArrowLeft") setI((n) => Math.max(0, n - 1)); }; addEventListener("keydown", k); return () => removeEventListener("keydown", k); });
  if (!live || !step) return null;
  /** Skip and Done are the same: the tour is finished and stays off until it is turned on in Settings → Help. */
  function end() { setLive(null); tourPref.set(false); }
  function next() { if (i >= live!.length - 1) end(); else setI(i + 1); }
  const last = i === live.length - 1, W = Math.min(340, innerWidth - 24);
  let top = innerHeight / 2 - 90, left = innerWidth / 2 - W / 2;
  if (box) { const below = box.top + box.h + 12, room = innerHeight - below; top = room > 190 ? below : Math.max(12, box.top - 12 - 170); left = Math.min(Math.max(12, box.left + Math.min(box.w, 40)), innerWidth - W - 12); if (box.w > innerWidth * 0.5 && box.h > innerHeight * 0.5) { top = box.top + 24; left = Math.max(12, box.left + 24); } }
  return (
    <div className="fixed inset-0 z-[200]" role="dialog" aria-modal="false" aria-label="Quick tour">
      <div className="absolute inset-0" onClick={end} aria-hidden style={{ background: box ? "transparent" : "rgba(0,0,0,.45)" }} />
      {box && <div aria-hidden className="pointer-events-none absolute rounded-xl border-2 border-brand-400" style={{ top: box.top - 4, left: box.left - 4, width: box.w + 8, height: box.h + 8, boxShadow: "0 0 0 9999px rgba(0,0,0,.45)" }} />}
      <div className="absolute flex flex-col gap-2 rounded-xl border border-ink-600 bg-ink-900 p-4 text-ink-100 shadow-2xl" style={{ top, left, width: W }}>
        <p className="text-[11px] font-bold uppercase tracking-widest text-ink-400">Step {i + 1} of {live.length}</p>
        <h2 className="text-[15px] font-extrabold">{step.title}</h2>
        <p className="text-[13.5px] leading-relaxed text-ink-200">{step.text}</p>
        <div className="mt-1 flex items-center gap-2">
          <button type="button" className="btn btn-sm" onClick={end}>{last ? "Close" : "Skip tour"}</button>
          <span className="flex-1" />
          {i > 0 && <button type="button" className="btn btn-sm" onClick={() => setI(i - 1)}>Back</button>}
          <button type="button" className="btn btn-pri btn-sm" autoFocus onClick={next}>{last ? "Done" : "Next"}</button>
        </div>
        <p className="text-[11px] text-ink-400">Turn the tour on again any time in Settings → Help.</p>
      </div>
    </div>
  );
}
