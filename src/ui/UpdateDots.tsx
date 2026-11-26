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
  const stStep = su.step && su.step !== "Checking" ? su.step : "Checking for a newer version";
  const tipSide = corner === "left" ? "left-0" : "right-0";
  /** The details, shown on hover or keyboard focus: what is happening now, how far along it is, and what it means. */
  const Tip = ({ head, tone, line, pct, note }: { head: string; tone: Dot | "busy"; line: string; pct?: number; note: string }) => (
    <span role="tooltip" className={`pointer-events-none invisible absolute bottom-full ${tipSide} z-10 mb-3 flex w-72 translate-y-1 flex-col gap-2 rounded-xl border border-ink-700 bg-ink-900/95 p-3.5 text-left text-[12.5px] font-normal leading-snug text-ink-300 opacity-0 shadow-2xl backdrop-blur transition duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100`}>
      <span className="flex items-center gap-2 text-[13px] font-bold text-ink-100"><i className={`h-2 w-2 rounded-full ${tone === "busy" ? "animate-pulse bg-brand-400" : tone === "pending" ? "bg-amber-400" : tone === "current" ? "bg-emerald-400" : "bg-ink-500"}`} />{head}{pct !== undefined && <span className="ml-auto tabular-nums text-brand-300">{pct}%</span>}</span>
      <span className="text-ink-100">{line}</span>
      {pct !== undefined && <span className="h-1.5 overflow-hidden rounded-full bg-ink-700"><i className="block h-full rounded-full bg-brand-500 transition-[width] duration-300" style={{ width: `${pct}%` }} /></span>}
      <span className="text-ink-400">{note}</span>
    </span>
  );
  const dWait = !s.dbBusy && sBusy && s.db !== "current";
  return (
    <nav aria-label="Update status" className={`fixed bottom-4 ${side} z-40 flex gap-2`}>
      {s.studio !== "na" && <span className="group relative">
        <a href="#/settings/update" aria-label={sBusy ? `Studio Update: updating, ${sPct} percent. Open Updates` : `Studio Update: ${SAY[s.studio]}. Open Updates`} className={`relative ${base} ${sBusy ? BUSY : `text-[15px] ${TONE[s.studio]}`}`}>{sBusy ? <><Ring pct={sPct} />{sPct}%</> : "S"}</a>
        {sBusy ? <Tip head="Updating the Studio" tone="busy" pct={sPct} line={stStep + "…"} note="The database is updated right after. It carries on if you move to another screen or browser tab. Your projects aren't touched." />
          : <Tip head="Studio" tone={s.studio} line={s.studio === "pending" ? "A newer version is waiting." : s.studio === "current" ? "Up to date." : "Not checked yet."} note={s.studio === "pending" ? "Click to open Updates and install it." : "Click to open Updates."} />}
      </span>}
      {s.db !== "na" && <span className="group relative">
        <a href="#/settings/hostings" aria-label={s.dbBusy ? `Database Update: updating, ${dPct} percent. Open Hostings` : `Database Update: ${SAY[s.db]}. Open Hostings`} className={`relative ${base} ${s.dbBusy ? BUSY : `text-[15px] ${TONE[s.db]}`}`}>{s.dbBusy ? <><Ring pct={dPct} />{dPct}%</> : "D"}</a>
        {s.dbBusy ? <Tip head="Updating the database" tone="busy" pct={dPct} line={(s.dbStep || "Checking the database") + "…"} note="Your Studio and its sites keep working while this runs." />
          : <Tip head="Database" tone={dWait ? "pending" : s.db} line={dWait ? "Waiting for the Studio to finish; it is updated right after." : s.db === "pending" ? "An update is waiting." : s.db === "current" ? "Up to date." : "Not checked yet."} note="Click to open Hostings." />}
      </span>}
    </nav>
  );
}
