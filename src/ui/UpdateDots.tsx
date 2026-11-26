import { useEffect, useState } from "react";
import { useUpdateStatus, type Dot } from "../lib/autodb";
import { EXPLORER_EVENT, explorerPrefs } from "../lib/explorer";
import { useStudioUpdate } from "../lib/studioupdate";
import { partOf } from "./kit";

/** How far the Studio's own update is (0–100), from the step it reports. */
const studioPct = (t: string) => /^Reading the Studio/.test(t) ? 8 : /^Creating the Studio/.test(t) ? 15 : /^Uploading the Studio/.test(t) ? partOf(t, 20, 98) : /^Updated/.test(t) ? 100 : 3;
/** While an update runs: a blue ring round the icon that fills as it goes, with the percentage inside in place of the letter. */
function Ring({ pct }: { pct: number }) {
  const r = 20.5, c = 2 * Math.PI * r, p = Math.max(0, Math.min(100, pct));
  return <svg aria-hidden viewBox="0 0 44 44" className="pointer-events-none absolute inset-0 h-full w-full -rotate-90"><circle cx="22" cy="22" r={r} fill="none" strokeWidth="3" className="stroke-ink-700" /><circle cx="22" cy="22" r={r} fill="none" strokeWidth="3" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - p / 100)} className="stroke-brand-400 transition-[stroke-dashoffset] duration-500" /></svg>;
}
const BUSY = "bg-ink-900 text-ink-100 text-[11px] font-bold tabular-nums";

const TONE: Record<Dot, string> = { pending: "bg-amber-400 text-ink-950", current: "bg-emerald-500 text-white", unknown: "bg-ink-600 text-ink-100", na: "" };
const SAY: Record<Dot, string> = { pending: "an update is waiting", current: "up to date", unknown: "not checked yet", na: "" };

/** Two round status icons, bottom right: the Studio (S) and its database (D). Yellow: an update is waiting. Green: up to date. Each opens its settings. */
export function UpdateDots() {
  const s = useUpdateStatus(), su = useStudioUpdate();
  const sBusy = su.running && !!su.step, sPct = Math.round(studioPct(su.step || "")), dPct = Math.round(s.dbPct);
  const [corner, setCorner] = useState(explorerPrefs.get().corner);
  useEffect(() => { const f = () => setCorner(explorerPrefs.get().corner); addEventListener(EXPLORER_EVENT, f); return () => removeEventListener(EXPLORER_EVENT, f); }, []);
  if (s.studio === "na" && s.db === "na") return null;
  // Beside the Explorer button, never on it.
  const side = corner === "left" ? "left-[4.75rem]" : "right-[4.75rem]";
  const base = "grid h-11 w-11 place-items-center rounded-full border border-black/10 font-extrabold shadow-xl transition hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400";
  return (
    <nav aria-label="Update status" className={`fixed bottom-4 ${side} z-40 flex gap-2`}>
      {s.studio !== "na" && <a href="#/settings/update" title={sBusy ? `Studio Update: updating, ${sPct}%` : `Studio Update: ${SAY[s.studio]}`} aria-label={sBusy ? `Studio Update: updating, ${sPct} percent. Open Updates` : `Studio Update: ${SAY[s.studio]}. Open Updates`} className={`relative ${base} ${sBusy ? BUSY : `text-[15px] ${TONE[s.studio]}`}`}>{sBusy ? <><Ring pct={sPct} />{sPct}%</> : "S"}</a>}
      {s.db !== "na" && <a href="#/settings/hostings" title={s.dbBusy ? `Database Update: updating, ${dPct}%` : `Database Update: ${SAY[s.db]}`} aria-label={s.dbBusy ? `Database Update: updating, ${dPct} percent. Open Hostings` : `Database Update: ${SAY[s.db]}. Open Hostings`} className={`relative ${base} ${s.dbBusy ? BUSY : `text-[15px] ${TONE[s.db]}`}`}>{s.dbBusy ? <><Ring pct={dPct} />{dPct}%</> : "D"}</a>}
    </nav>
  );
}
