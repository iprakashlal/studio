// Picaffectz Explorer: the floating helper. It answers from what lib/explorer.ts reads in this Studio (no AI),
// and takes you to the place. It can be minimised, moved to the other corner, or switched off in
// Settings → Customize → Picaffectz Explorer.
import { useEffect, useMemo, useRef, useState } from "react";
import type { Studio, StudioIndex } from "../lib/studio";
import { EXPLORER_EVENT, answer, buildIndex, explorerPrefs, readContent, readProjects, readScreens, readSettings, whereLine, type Answer, type Entry, type ExplorerPrefs } from "../lib/explorer";
import { Toggle } from "./kit";

const GOTO = "studio:goto";
const Glass = ({ size = 18 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /><path d="M11 8.2v5.6M8.2 11h5.6" strokeWidth="1.6" /></svg>;
const ASKS = ["Where do I change the logo?", "How many projects do I have?", "Add an animated background", "Where are opening hours?", "Turn on Sign in with Google"];
type Turn = { q: string; a: Answer };
/** Kept outside the component: the Studio's screens are separate trees, and the panel must survive going from one to another. */
const mem: { open: boolean | null; turns: Turn[]; content: Entry[]; read: boolean } = { open: null, turns: [], content: [], read: false };

export function Explorer({ studio, index, route, hosted }: { studio: Studio; index: StudioIndex | null; route: string; hosted?: boolean }) {
  const [prefs, setPrefs] = useState<ExplorerPrefs>(explorerPrefs.get);
  useEffect(() => { const on = (e: Event) => setPrefs((e as CustomEvent).detail || explorerPrefs.get()); addEventListener(EXPLORER_EVENT, on); return () => removeEventListener(EXPLORER_EVENT, on); }, []);
  const [open, setOpen] = useState(() => mem.open ?? !explorerPrefs.get().min);
  const [q, setQ] = useState(""), [turns, setTurns] = useState<Turn[]>(mem.turns), [contentRead, setContentRead] = useState<Entry[]>(mem.content), [reading, setReading] = useState(false);
  useEffect(() => { mem.open = open; mem.turns = turns; mem.content = contentRead; }, [open, turns, contentRead]);
  const input = useRef<HTMLInputElement>(null), list = useRef<HTMLDivElement>(null);
  const projectId = route.startsWith("p/") ? route.slice(2).split("/")[0] : "", here = index?.projects.find((p) => p.id === projectId);
  const fixed = useMemo(() => [...readSettings(), ...readScreens({ hosted })], [hosted]);
  const projects = useMemo(() => readProjects(index), [index?.projects.map((p) => p.id + p.name + p.status + p.updatedAt).join("|")]);
  const ix = useMemo(() => buildIndex([...fixed, ...projects, ...(prefs.content ? contentRead : [])]), [fixed, projects, contentRead, prefs.content]);
  // The projects' own words are read once, the first time the Explorer is opened (and only if allowed).
  useEffect(() => {
    if (!open || !prefs.content || mem.read || !index?.projects.length) return;
    mem.read = true; setReading(true);
    (async () => { const all: Entry[] = []; for (const p of index.projects.slice(0, 40)) { try { const c = await studio.loadContent(p.id); if (c) all.push(...readContent(p, c)); } catch { /* that project is skipped */ } } mem.content = all; setContentRead(all); setReading(false); })();
  }, [open, prefs.content, !!index?.projects.length]);
  useEffect(() => { if (open) setTimeout(() => input.current?.focus(), 50); }, [open]);
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" }); }, [turns.length]);
  useEffect(() => {
    if (!prefs.on || !prefs.keys) return;
    const on = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); } else if (e.key === "Escape" && open && document.activeElement === input.current) setOpen(false); };
    addEventListener("keydown", on); return () => removeEventListener("keydown", on);
  }, [prefs.on, prefs.keys, open]);
  if (!prefs.on) return null;

  const ask = (text: string) => { const t = text.trim(); if (!t) return; setTurns((x) => [...x.slice(-11), { q: t, a: answer(ix, index, t, { tpl: here?.template, project: here?.id }) }]); setQ(""); };
  /** The editor needs a moment after a project opens: the jump is sent until the editor has taken it. */
  const jump = (detail: { path?: string; cat?: string }, tries = 14) => { const fire = (n: number) => { if (document.querySelector('nav[aria-label="Content categories"]')) dispatchEvent(new CustomEvent(GOTO, { detail })); else if (n > 0) setTimeout(() => fire(n - 1), 400); }; fire(tries); };
  const go = (e: Entry) => {
    if (e.kind === "screen") { if (e.route != null && (e.route !== "" || e.title === "Projects")) location.hash = "#/" + e.route; return; }
    if (e.kind === "project") { location.hash = "#/" + e.route; return; }
    // A setting or section: in the open project when it is the same kind of site, else in the newest project of that kind.
    const target = e.project ? index?.projects.find((p) => p.id === e.project) : here && here.template === e.tpl ? here : [...(index?.projects || [])].filter((p) => p.template === e.tpl).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
    if (!target) return;
    const detail = e.path ? { path: e.path } : { cat: e.cat };
    if (target.id !== projectId) { location.hash = "#/p/" + target.id; setTimeout(() => jump(detail), 500); } else jump(detail, 2);
    if (matchMedia("(max-width: 640px)").matches) setOpen(false);
  };
  const canGo = (e: Entry) => e.kind === "project" || (e.kind === "screen" ? e.route !== "" || e.title === "Projects" : e.project ? true : !!index?.projects.some((p) => p.template === e.tpl));
  const goLabel = (e: Entry) => e.kind === "project" ? "Open" : e.kind === "screen" ? "Open" : e.project || (here && here.template === e.tpl) ? "Take me there" : `Open in ${[...(index?.projects || [])].filter((p) => p.template === e.tpl).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0]?.name || "a project"}`;
  const side = prefs.corner === "left" ? "left-4" : "right-4";

  if (!open) return (
    <button type="button" aria-label="Open Picaffectz Explorer" title={`Picaffectz Explorer${prefs.keys ? " (Ctrl or ⌘ + K)" : ""}`} onClick={() => setOpen(true)}
      className={`fixed bottom-4 ${side} z-40 grid h-12 w-12 place-items-center rounded-full border border-brand-500/50 bg-ink-900 text-brand-300 shadow-xl transition hover:scale-105 hover:bg-ink-800 print:hidden`}><Glass size={20} /></button>
  );
  return (
    <section aria-label="Picaffectz Explorer" className={`fixed bottom-4 ${side} z-40 flex max-h-[min(34rem,calc(100vh-2rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-ink-600 bg-ink-900 shadow-2xl print:hidden`}>
      <header className="flex items-center gap-2 border-b border-ink-700 px-3 py-2.5">
        <span className="text-brand-300"><Glass /></span><b className="text-sm">Picaffectz Explorer</b><span className="rounded-md border border-ink-600 px-1.5 text-[11px] text-ink-400" title="It reads this Studio on this device. Nothing is sent anywhere.">No AI</span>
        <a href="#/settings/customize" className="ml-auto text-[12px] text-ink-400 underline hover:text-ink-100" title="Switch it off, move it, or choose what it reads">Settings</a>
        <button type="button" aria-label="Minimise the Explorer" title="Minimise" className="grid h-7 w-7 place-items-center rounded-md text-ink-300 hover:bg-ink-800" onClick={() => setOpen(false)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M5 12h14" /></svg></button>
      </header>
      <div ref={list} className="flex min-h-[9rem] flex-1 flex-col gap-3 overflow-y-auto px-3 py-3 text-[13px]" aria-live="polite">
        {!turns.length && <>
          <p className="text-ink-300">Ask where something is, what a setting does, or about your projects. I read this Studio from end to end{here ? <> and start with <b className="text-ink-100">{here.name}</b></> : ""}.</p>
          <div className="flex flex-wrap gap-1.5">{ASKS.map((t) => <button key={t} type="button" className="rounded-full border border-ink-600 px-2.5 py-1 text-left text-[12.5px] text-ink-200 hover:bg-ink-800" onClick={() => ask(t)}>{t}</button>)}</div>
          <p className="text-[12px] text-ink-400">{fixed.length.toLocaleString()} settings and screens read{index ? `, ${index.projects.length} project${index.projects.length === 1 ? "" : "s"}` : ""}{prefs.content ? (reading ? ", reading your projects' text…" : contentRead.length ? `, ${contentRead.length.toLocaleString()} lines of your own text` : "") : ""}.</p>
        </>}
        {turns.map((t, i) => (
          <div key={i} className="flex flex-col gap-2">
            <p className="self-end rounded-2xl rounded-br-md bg-brand-500/20 px-3 py-1.5 text-ink-100">{t.q}</p>
            <div className="flex flex-col gap-2 rounded-2xl rounded-bl-md border border-ink-700 bg-ink-950 px-3 py-2.5" data-answer={t.a.kind}>
              <p className="font-semibold text-ink-100">{t.a.say}</p>
              {t.a.detail && <p className="text-ink-300">{t.a.detail}</p>}
              {t.a.items.length > 0 && <ul className="flex flex-col gap-1.5">{t.a.items.map((e, k) => (
                <li key={k} className={`flex items-start gap-2 rounded-lg px-2 py-1.5 ${k === 0 && t.a.kind === "where" ? "bg-brand-500/10" : "bg-ink-900"}`}>
                  <span className="min-w-0 flex-1"><b className="block truncate text-ink-100">{e.kind === "content" ? "“" + e.title + "”" : e.title}</b><span className="block text-[12px] text-ink-400">{e.kind === "project" ? e.text : e.kind === "content" ? e.trail.join(" › ") : whereLine({ ...e, trail: e.trail }).replace(/ › [^›]*$/, "")}</span></span>
                  {canGo(e) && <button type="button" className="btn btn-sm flex-none" onClick={() => go(e)}>{goLabel(e)}</button>}
                </li>))}</ul>}
            </div>
          </div>))}
      </div>
      <form className="flex gap-2 border-t border-ink-700 p-2.5" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
        <input ref={input} aria-label="Ask the Explorer" className="input min-w-0 flex-1" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Where do I change…?" autoComplete="off" />
        <button className="btn btn-pri" disabled={!q.trim()}>Ask</button>
      </form>
    </section>
  );
}

/** Settings → Customize → Picaffectz Explorer. Kept on this device. */
export function ExplorerCard() {
  const [p, setP] = useState<ExplorerPrefs>(explorerPrefs.get);
  useEffect(() => { const on = (e: Event) => setP((e as CustomEvent).detail || explorerPrefs.get()); addEventListener(EXPLORER_EVENT, on); return () => removeEventListener(EXPLORER_EVENT, on); }, []);
  const n = useMemo(() => readSettings().length + readScreens().length, []);
  const set = (x: Partial<ExplorerPrefs>) => setP(explorerPrefs.set(x));
  return (
    <section className="card flex flex-col gap-3 p-5" aria-label="Picaffectz Explorer settings">
      <h3 className="flex items-center gap-2 text-[15px] font-extrabold">Picaffectz Explorer<span className={`chip ${p.on ? "border-emerald-400/50 text-emerald-200" : "border-ink-600 text-ink-400"}`}>{p.on ? "On" : "Off"}</span></h3>
      <p className="text-sm text-ink-300">A small helper that floats in a corner of the Studio. Ask it where a setting is, what something does, or about your projects, and it takes you there. It uses <b className="text-ink-100">no AI</b>: it reads this Studio itself ({n.toLocaleString()} settings and screens, plus your projects) on this device, and sends nothing anywhere.</p>
      <Toggle id="ex-on" label="Show the Explorer" checked={p.on} onChange={(v) => set({ on: v })} />
      {p.on && <>
        <Toggle id="ex-min" label="Start minimised (a round button until you press it)" checked={p.min} onChange={(v) => set({ min: v })} />
        <Toggle id="ex-content" label="Also read the words in my projects (to find where something is written)" checked={p.content} onChange={(v) => set({ content: v })} />
        <Toggle id="ex-keys" label="Open and close it with Ctrl + K (⌘ + K on a Mac)" checked={p.keys} onChange={(v) => set({ keys: v })} />
        <div className="flex flex-col gap-1.5"><span className="label">Corner</span>
          <div className="flex self-start rounded-lg border border-ink-600" role="radiogroup" aria-label="Explorer corner">{(["right", "left"] as const).map((k) => <button key={k} type="button" role="radio" aria-checked={p.corner === k} onClick={() => set({ corner: k })} className={`btn btn-sm border-0 ${p.corner === k ? "bg-ink-700" : "bg-transparent"}`}>{k === "right" ? "Bottom right" : "Bottom left"}</button>)}</div>
        </div>
      </>}
      <p className="hint">These choices are kept on this device. What it can answer: where a setting or screen is (for all four site types), what a setting does (in the Studio's own words), how many projects you have and which, and where a piece of text is written. It can't write for you or judge anything; for that the Studio's AI tools are separate.</p>
    </section>
  );
}
