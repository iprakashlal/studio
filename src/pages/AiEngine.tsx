// Choosing the engine behind the Studio's AI helpers: Cloudflare AI or the Picaffectz system (on this device).
// The Settings card saves the Studio's choice; EnginePick is the small switch inside each helper's dialog.
import { useEffect, useState, useSyncExternalStore } from "react";
import { AI_ENGINES, aiEngine, onAiEngine, setAiEngine, type AiEngine } from "../lib/ai";
import type { Studio, StudioIndex } from "../lib/studio";
import { browserCan, browserHasTranslator, PHRASES } from "../lib/systranslate";
import { useToast } from "../ui/kit";
import { AiApiForm, SmsForm, WhatsAppForm, useStudioWhere, InstagramForm } from "./Connections";

export const useAiEngine = () => useSyncExternalStore(onAiEngine, aiEngine);

/** "Read with: Cloudflare AI | Picaffectz system", for one use of a helper (the Studio's setting stays as it is). */
export function EnginePick({ label, value, onChange, note }: { label: string; value: AiEngine; onChange: (e: AiEngine) => void; note?: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-ink-700 p-3">
      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label={label}>
        <span className="label">{label}</span>
        {AI_ENGINES.map((e) => <button key={e.id} type="button" role="radio" aria-checked={value === e.id} className={`btn btn-sm ${value === e.id ? "btn-pri" : ""}`} onClick={() => onChange(e.id)}>{e.name}</button>)}
      </div>
      <p className="text-[12.5px] text-ink-400">{note || AI_ENGINES.find((e) => e.id === value)!.line}</p>
    </div>
  );
}

const TRY: [string, string][] = [["hi", "Hindi"], ["mr", "Marathi"], ["bn", "Bengali"], ["ta", "Tamil"], ["te", "Telugu"], ["kn", "Kannada"], ["gu", "Gujarati"], ["pa", "Punjabi"], ["ml", "Malayalam"], ["or", "Odia"], ["as", "Assamese"]];
/** Settings → AI: the Studio's engine, with what each one does and what this device can do. */
export function AiEngineCard({ studio, index, onIndex }: { studio: Studio; index: StudioIndex; onIndex: (i: StudioIndex) => void }) {
  const toast = useToast(), cur = useAiEngine();
  const [busy, setBusy] = useState(false);
  const where = useStudioWhere();
  const [langs, setLangs] = useState<string[] | null>(null);
  useEffect(() => { let on = true; (async () => { const can = browserHasTranslator() ? await Promise.all(TRY.map(([c]) => browserCan("en", c))) : []; if (on) setLangs(TRY.filter((_, i) => can[i] && can[i] !== "no").map(([, n]) => n)); })(); return () => { on = false; }; }, []);
  const choose = async (e: AiEngine) => {
    if (e === cur || busy) return; setBusy(true);
    try { onIndex(await studio.saveAi(e)); setAiEngine(e); toast(`AI helpers now use ${AI_ENGINES.find((x) => x.id === e)!.name}.`); } catch (x: any) { toast(x?.message || "Couldn't save that.", "bad"); }
    setBusy(false);
  };
  const rows: [string, string, string][] = [
    ["Translate a site (Languages)", "Every text, in all eleven languages. Best quality.", `The words every site shares come from the Studio's phrase book (${PHRASES} phrases, eleven languages). The rest is done by this browser's own translator, where it has the language.`],
    ["Fill in products or a menu from a file", "Reads text and photos, and understands loose layouts.", "Reads PDFs and sheets by rules; photos are read on this device (clear English print). Best with price lists, menus and sheets."],
    ["Write text from a site or PDF", "Writes fresh text shaped by the reference.", "Composes text from the Studio's own phrase bank for your kind of business, using your notes. Works with a PDF, pasted text or no reference at all."],
  ];
  return (
    <section className="card flex flex-col gap-3 p-5" aria-label="AI engine">
      <h3 className="text-[15px] font-extrabold">AI engine</h3>
      <p className="text-sm text-ink-300">Translating, reading a pamphlet or menu, and writing text can run on Cloudflare's AI, on the Studio's own built-in system, or on an AI API of your own. Choose the one the Studio uses; each helper also lets you switch for a single use.</p>
      <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="AI engine choice">
        {AI_ENGINES.map((e) => (
          <button key={e.id} type="button" role="radio" aria-checked={cur === e.id} disabled={busy} onClick={() => choose(e.id)} className={`flex flex-col gap-1 rounded-xl border p-4 text-left ${cur === e.id ? "border-brand-500 bg-brand-500/10" : "border-ink-600 bg-ink-950 hover:border-ink-400"}`}>
            <b className="flex items-center gap-2 text-ink-100">{e.name}{cur === e.id && <span className="chip border-brand-400/60 text-brand-200">In use</span>}</b>
            <span className="text-[13px] text-ink-300">{e.line}</span>
          </button>
        ))}
      </div>
      {(cur === "custom" || where) && <AiApiForm where={where} />}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-[13px]">
          <thead><tr className="text-ink-400"><th className="py-1.5 pr-3 font-semibold">Helper</th><th className="py-1.5 pr-3 font-semibold">Cloudflare AI</th><th className="py-1.5 font-semibold">Picaffectz system</th></tr></thead>
          <tbody>{rows.map(([a, b, c]) => <tr key={a} className="border-t border-ink-700 align-top"><td className="py-2 pr-3 font-semibold text-ink-200">{a}</td><td className="py-2 pr-3 text-ink-300">{b}</td><td className="py-2 text-ink-300">{c}</td></tr>)}</tbody>
        </table>
      </div>
      <p className="text-[13px] text-ink-300" aria-label="This device">
        <b className="text-ink-100">On this device: </b>
        {langs === null ? "checking this browser's translator…" : langs.length ? <>this browser can translate into {langs.join(", ")} by itself (it fetches each language once, then works offline).</> : browserHasTranslator() ? "this browser has a translator, but none of the Studio's languages." : "this browser has no built-in translator, so on-device translating is limited to the phrase book. Chrome and Edge on a computer have one."}
        {" "}The reader for photos is part of the Studio.
      </p>
      <p className="text-[12.5px] text-ink-400">When Cloudflare says today's free allowance is used up, translating carries on with the Picaffectz system by itself, and the other helpers offer it with one click. A site's own admin page chooses under Languages → Translate with.</p>
    </section>
  );
}

/** Settings → General: WhatsApp for the Studio's own sign-in codes (optional). */
export function StudioWhatsAppCard() { const where = useStudioWhere(); return <><WhatsAppForm where={where} kind="studio" /><SmsForm where={where} kind="studio" /></>; }
/** Settings → General → Social setup: the one Instagram token every site's photo wall can use. */
export function StudioInstagramCard() { const where = useStudioWhere(); return <InstagramForm where={where} kind="studio" />; }
