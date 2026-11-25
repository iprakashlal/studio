import { useEffect, useState } from "react";
import { MARK_URI } from "./logo";
import { useUpdateStatus, type Dot } from "../lib/autodb";
import { EXPLORER_EVENT, explorerPrefs } from "../lib/explorer";

const TONE: Record<Dot, string> = { pending: "bg-amber-400 text-ink-950", current: "bg-emerald-500 text-white", unknown: "bg-ink-600 text-ink-100", na: "" };
const SAY: Record<Dot, string> = { pending: "an update is waiting", current: "up to date", unknown: "not checked yet", na: "" };

/** Two round status icons, bottom right: the Studio (PA) and its database (D). Yellow: an update is waiting. Green: up to date. Each opens its settings. */
export function UpdateDots() {
  const s = useUpdateStatus();
  const [corner, setCorner] = useState(explorerPrefs.get().corner);
  useEffect(() => { const f = () => setCorner(explorerPrefs.get().corner); addEventListener(EXPLORER_EVENT, f); return () => removeEventListener(EXPLORER_EVENT, f); }, []);
  if (s.studio === "na" && s.db === "na") return null;
  // Beside the Explorer button, never on it.
  const side = corner === "left" ? "left-[4.75rem]" : "right-[4.75rem]";
  const base = "grid h-11 w-11 place-items-center rounded-full border border-black/10 text-[15px] font-extrabold shadow-xl transition hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400";
  return (
    <nav aria-label="Update status" className={`fixed bottom-4 ${side} z-40 flex gap-2`}>
      {s.studio !== "na" && <a href="#/settings/update" title={`Studio: ${SAY[s.studio]}`} aria-label={`Studio: ${SAY[s.studio]}. Open Updates`} className={`${base} ${TONE[s.studio]}`}><img src={MARK_URI} alt="" className="block h-6 w-auto rounded-sm bg-white/90 p-0.5" /></a>}
      {s.db !== "na" && <a href="#/settings/hostings" title={s.dbBusy ? "Database: updating…" : `Database: ${SAY[s.db]}`} aria-label={`Database: ${s.dbBusy ? "updating" : SAY[s.db]}. Open Hostings`} className={`${base} ${TONE[s.db]} ${s.dbBusy ? "animate-pulse" : ""}`}>D</a>}
    </nav>
  );
}
