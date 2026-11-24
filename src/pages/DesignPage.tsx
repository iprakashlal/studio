import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrandMark, useBrand } from "../lib/brand";
import { TEMPLATES } from "../schema";
import { Preview } from "../editor/Preview";
import { Logo, Spinner, useToast } from "../ui/kit";
import { COLOUR_DOT, STEPS, STEP_LABEL, buildDesign, fromDoc, isOptional, nextStep, requestText, sayAnswer, themesFor, writeCopy, type Answers, type Design, type DesignFiles, type Step } from "../lib/designer";
import { newDesignId, readLocalDesigns, writeLocalDesigns, type Copy, type DesignRec } from "../lib/designs";
import { designHost, readPage, submitQuery, type DesignHost } from "../lib/designapi";
import { pdfLines } from "../lib/pdftext";
import { watchDevtools } from "../lib/devtools";
import type { Studio, StudioIndex } from "../lib/studio";

// #/design: a chat that asks plain questions and builds a preview website from the answers.
// It never publishes: the person is asked to connect with the Studio's owners, which saves the request in the
// Studio's own database and emails it to them. Everything it uses is the Studio's own (its look, its AI engine, its database).

const DRAFT = "site-studio:design-draft";
type Draft = { a: Answers; copy: Copy | null; id: string; sent: boolean };
const readDraft = (): Draft => { try { const d = JSON.parse(sessionStorage.getItem(DRAFT) || "{}"); return { a: d.a && typeof d.a === "object" ? d.a : {}, copy: d.copy || null, id: typeof d.id === "string" ? d.id : "", sent: !!d.sent }; } catch { return { a: {}, copy: null, id: "", sent: false }; } };

/** What kind of website a few free words describe (null when unclear). */
function guessKind(t: string): string | null {
  const x = t.toLowerCase();
  if (/restaurant|caf[eé]|cafe|food|menu|kitchen|bakery|dhaba|hotel|tiffin|bar\b|biryani|coffee/.test(x)) return "restaurant";
  if (/shop|store|sell|selling|products?|ecommerce|e-commerce|boutique|cart|candles?|gifts?/.test(x)) return "store";
  if (/portfolio|about me|myself|personal|photograph|designer|developer|freelanc|artist|resume|cv\b|creator|writer|model/.test(x)) return "portfolio";
  if (/business|company|service|firm|agency|clinic|consult|repair|salon|school|studio|office|shop for services/.test(x)) return "business";
  return null;
}

/** A picture made at most `max` pixels across (keeps its shape), as a small data URL. */
async function fitImage(file: File, max = 320): Promise<string> {
  const bmp = await createImageBitmap(file), k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height); bmp.close?.();
  let u = c.toDataURL("image/png"); if (u.length > 120_000) u = c.toDataURL("image/jpeg", 0.85);
  if (u.length > 150_000) throw new Error("That picture is too detailed. Please use a simpler or smaller one.");
  return u;
}
const toB64 = (buf: ArrayBuffer) => { const b = new Uint8Array(buf); let s = ""; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192)); return btoa(s); };

export function DesignPage({ studio, index, onIndex }: { studio?: Studio; index?: StudioIndex | null; onIndex?: (i: StudioIndex) => void }) {
  const toast = useToast();
  const brand = useBrand();
  const first = useMemo(readDraft, []);
  const [a, setA] = useState<Answers>(first.a);
  const [copy, setCopy] = useState<Copy | null>(first.copy);
  const [files, setFiles] = useState<DesignFiles>({});
  const [host, setHost] = useState<DesignHost | null>(null);
  const [design, setDesign] = useState<Design | null>(null);
  const [ver, setVer] = useState(1);
  const [writing, setWriting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [connect, setConnect] = useState(false);
  const [text, setText] = useState("");
  const [many, setMany] = useState<string[]>([]);
  const [savedId, setSavedId] = useState(first.id);
  const [sent, setSent] = useState(first.sent);
  const [warn, setWarn] = useState(false);
  const [reading, setReading] = useState(false);
  const resetRef = useRef<() => void>(() => {});
  const endRef = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const pick = useRef<HTMLInputElement>(null);
  const cur = nextStep(a);
  const answered = STEPS.filter((s) => s.id in a && (s.when ? s.when(a) : true));
  const started = answered.length > 0;
  const total = STEPS.filter((x) => (x.when ? x.when(a) : true)).length;

  useEffect(() => { document.title = "Design yourself · " + brand.name; }, [brand.name]);
  useEffect(() => { designHost().then(setHost); }, []);
  useEffect(() => { try { sessionStorage.setItem(DRAFT, JSON.stringify({ a, copy, id: savedId, sent })); } catch { /* private mode */ } }, [a, copy, savedId, sent]);
  useEffect(() => { setText(""); setMany([]); setTimeout(() => field.current?.focus(), 50); window.scrollTo({ top: 0, behavior: "smooth" }); }, [cur?.id, answered.length, writing]);

  // The site is rebuilt as each answer arrives.
  useEffect(() => {
    let live = true;
    if (!a.kind) { setDesign(null); return; }
    buildDesign(a, copy, files).then((d) => { if (live && d) { setDesign(d); setVer((v) => v + 1); } }).catch(() => {});
    return () => { live = false; };
  }, [a, copy, files]);

  // The last question is answered: the text for each topic is written (by the Studio's AI engine, else the Picaffectz system), then the site is shown.
  const finished = !cur && !!a.kind;
  useEffect(() => {
    if (!finished || copy || writing) return;
    setWriting(true);
    writeCopy(a, host).then((r) => setCopy(r.copy)).catch(() => setCopy({})).finally(() => setWriting(false));
  }, [finished, copy, host]);

  // Then it is kept (in the Studio when signed in, else on this device) and shown full screen.
  const doneKey = finished && copy && design ? JSON.stringify([a, copy]) : "";
  const lastSaved = useRef("");
  useEffect(() => {
    if (!doneKey || !design || lastSaved.current === doneKey) return;
    lastSaved.current = doneKey;
    const id = savedId || newDesignId();
    const rec: DesignRec = { id, name: a.name || "Untitled", kind: design.kind, themeId: design.themeId, themeName: design.themeName, answers: Object.fromEntries(Object.entries(a).filter(([key]) => key !== "doctext")), createdAt: new Date().toISOString(), summary: design.summary, ...(copy ? { copy } : {}), ...(files.logo && files.logo.length < 60000 ? { logo: files.logo } : {}) };
    (async () => {
      try {
        if (studio) {
          const i = await studio.updateIndex((x) => { const l = x.designs || []; const at = l.findIndex((d) => d.id === id); if (at >= 0) l[at] = { ...rec, createdAt: l[at].createdAt }; else l.unshift(rec); x.designs = l.slice(0, 200); }, "Save a design preview");
          onIndex?.(i);
        } else { const l = readLocalDesigns(), at = l.findIndex((d) => d.id === id); if (at >= 0) l[at] = { ...rec, createdAt: l[at].createdAt }; else l.unshift(rec); writeLocalDesigns(l.slice(0, 50)); }
        setSavedId(id);
      } catch { toast("Couldn't keep this preview. You can still view it.", "bad"); }
    })();
    setShowPreview(true);
  }, [doneKey]);

  const answer = useCallback((s: Step, v: string) => { setA((o) => ({ ...o, [s.id]: v.trim() })); }, []);
  const submit = () => {
    if (!cur) return;
    if (cur.type === "many") { if (many.length) answer(cur, many.join(",")); return; }
    if (!text.trim()) return;
    if (cur.id === "doc") { readLink(text); return; }
    if (cur.id === "kind") { const g = guessKind(text); if (g) answer(cur, g); else toast("I'm not sure which one that is. Please tap one of the four choices.", "bad"); return; }
    answer(cur, text);
  };
  /** What a document or page says fills in the answers it can (the questions it covers are then not asked). */
  const applyDoc = (label: string, text: string, link: string, meta?: { name?: string; about?: string }) => {
    const fill = fromDoc(text, a, meta), got = Object.keys(fill);
    setA((o) => ({ ...o, doc: label, ...(link ? { doclink: link } : {}), ...(text ? { doctext: text } : {}), ...fromDoc(text, o, meta), ...(got.length ? { docfrom: got.join(",") } : {}) }));
    toast(got.length ? `Found ${got.map((x) => (STEP_LABEL[x] || x).toLowerCase()).join(", ")}. You can change any answer.` : "Read it. It will help us write your text.");
  };
  /** A link pasted for the starting point: the Studio's database reads the page; if it can't, the link goes to the team. */
  const readLink = async (raw: string) => {
    let url = raw.trim(); if (!/^https?:\/\//i.test(url)) url = "https://" + url.replace(/^\/+/, "");
    let host$ = ""; try { host$ = new URL(url).hostname.replace(/^www\./, ""); } catch { toast("That doesn't look like a web address.", "bad"); return; }
    setReading(true);
    const r = host ? await readPage(host, url) : { error: "no database" };
    if (r.text || r.title) applyDoc(host$, [r.site || r.title || "", r.description || "", r.text || ""].filter(Boolean).join("\n"), url, { name: (r.site || (r.title || "").split(/\s+[-–|·:]\s+/)[0] || "").trim(), about: r.description });
    else { setA((o) => ({ ...o, doc: host$, doclink: url })); toast((r.error ? r.error + " " : "") + "We'll pass the link to our team instead.", "bad"); }
    setReading(false);
  };
  /** A picture or PDF chosen for a file question. */
  const choose = async (s: Step, f: File | undefined) => {
    if (!f) return;
    try {
      if (f.size > (s.maxKB || 1000) * 1024) throw new Error(`That file is over ${Math.round((s.maxKB || 1000) / 1000)} MB. Please choose a smaller one.`);
      if (s.id === "logo") { const u = await fitImage(f); setFiles((o) => ({ ...o, logo: u })); answer(s, "added"); }
      else if (s.id === "doc") {
        setReading(true);
        const text = (await pdfLines(f)).join("\n").slice(0, 12000);
        if (text.length < 30) throw new Error("We couldn't find any text in that PDF (it may be a scan). Try another one, or skip.");
        applyDoc(f.name.slice(0, 100), text, "");
      }
      else { const buf = await f.arrayBuffer(); if (new TextDecoder().decode(new Uint8Array(buf).slice(0, 4)) !== "%PDF") throw new Error("That doesn't look like a PDF."); setFiles((o) => ({ ...o, menu: { name: f.name.slice(0, 100), b64: toB64(buf) } })); answer(s, f.name.slice(0, 100)); }
    } catch (e: any) { toast(e?.message || "Couldn't read that file.", "bad"); }
    setReading(false);
    if (pick.current) pick.current.value = "";
  };
  /** Go back to a question: it and every later answer are cleared. */
  const rewind = (id: string) => {
    const at = STEPS.findIndex((s) => s.id === id);
    const docAt = STEPS.findIndex((s) => s.id === "doc"), look = ["theme", "accent", "mode", "corners"];
    const keep = Object.fromEntries(Object.entries(a).filter(([key]) => !look.includes(key) && !((key === "doctext" || key === "docfrom") && at <= docAt) && STEPS.findIndex((s) => s.id === key) < at));
    const old = a[id]; setA(keep); setCopy(null); if (STEPS[at].type === "text" || STEPS[at].type === "long") setTimeout(() => setText(old || ""), 60);
    lastSaved.current = ""; setShowPreview(false);
  };
  resetRef.current = () => { restart(); try { writeLocalDesigns([]); } catch { /* none */ } setShowPreview(false); setConnect(false); };
  // Developer tools opened on this page (not for a signed-in owner): everything made here is cleared and a warning is shown.
  useEffect(() => { if (studio) return; return watchDevtools(() => { resetRef.current(); setWarn(true); }); }, [studio]);
  const tweak = (p: Answers) => setA((o) => { const n = { ...o, ...p }; for (const key of Object.keys(p)) if (p[key] === "") delete n[key]; return n; });
  function restart() { setA({}); setCopy(null); setFiles({}); setDesign(null); setSavedId(""); setSent(false); lastSaved.current = ""; try { sessionStorage.removeItem(DRAFT); } catch { /* none */ } }

  const field$ = cur && (cur.type === "text" || cur.type === "long" || cur.id === "kind" || cur.id === "doc");
  const bar = (
    <form className="mx-auto flex w-full max-w-2xl flex-col gap-2" onSubmit={(e) => { e.preventDefault(); submit(); }} aria-label="Your answer">
      <div className={`flex flex-wrap items-end gap-2 rounded-3xl border bg-ink-900 p-2 pl-4 shadow-xl transition focus-within:border-brand-400 ${field$ || cur?.type === "file" ? "border-ink-600" : "border-ink-700 opacity-80"}`}>
        {cur?.type === "long"
          ? <textarea ref={field} aria-label={cur.ask(a)} rows={3} className="min-h-[3.5rem] min-w-0 flex-1 basis-[12rem] resize-none bg-transparent py-2 text-[15px] text-ink-100 outline-none placeholder:text-ink-500" placeholder={cur.ph?.(a)} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); } }} />
          : <input ref={field} aria-label={cur ? cur.ask(a) : "Your answer"} className="min-w-0 flex-1 basis-[12rem] bg-transparent py-2.5 text-[15px] text-ink-100 outline-none placeholder:text-ink-500" disabled={!field$ || reading} placeholder={reading ? "Reading…" : writing ? "Writing your text…" : !cur ? "All done. Your preview is ready." : cur.id === "kind" ? "Tell me what you want, e.g. an online shop for my candles" : field$ ? cur.ph?.(a) : cur.type === "many" ? "Tap what applies above, then press Done" : cur.type === "file" ? "Choose a file, or skip" : "Pick one of the choices above"} value={field$ ? text : ""} onChange={(e) => setText(e.target.value)} />}
        {cur?.type === "file" && <>
          <input ref={pick} type="file" accept={cur.accept} className="sr-only" aria-label={cur.ask(a)} onChange={(e) => choose(cur, e.target.files?.[0])} />
          <button type="button" className="btn btn-pri btn-sm rounded-full" onClick={() => pick.current?.click()}>{cur.id === "logo" ? "Choose logo" : cur.id === "doc" ? "Choose document (PDF)" : "Choose PDF"}</button>
        </>}
        {cur && isOptional(cur, a) && (field$ || cur.type === "file") && <button type="button" className="btn btn-ghost btn-sm" onClick={() => answer(cur, "")}>Skip</button>}
        {cur?.type === "many" && <button type="submit" className="btn btn-pri btn-sm rounded-full" disabled={!many.length}>Done</button>}
        {field$ && <button type="submit" className="btn btn-pri btn-sm rounded-full" disabled={!text.trim()} aria-label="Send">Send ↵</button>}
      </div>
      {cur?.type === "long" && <p className="px-3 text-xs text-ink-500">Press Enter for a new line. Ctrl + Enter sends.</p>}
    </form>
  );

  /** The answer controls inside the question card: a plain field and one row of buttons (nothing for a tap-one question). */
  const cardBar = !cur || cur.type === "choice" ? null : (
    <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); submit(); }} aria-label="Your answer">
      {cur.type === "long"
        ? <textarea ref={field} aria-label={cur.ask(a)} rows={4} className="input min-h-[7rem] resize-y" placeholder={cur.ph?.(a)} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); } }} />
        : field$ ? <input ref={field} aria-label={cur.ask(a)} className="input" disabled={reading} placeholder={reading ? "Reading…" : cur.ph?.(a)} value={text} onChange={(e) => setText(e.target.value)} /> : null}
      <div className="flex flex-wrap items-center gap-2">
        {cur.type === "long" && <span className="mr-auto text-xs text-ink-500">Enter = new line · Ctrl + Enter = send</span>}
        {cur.type !== "long" && <span className="mr-auto" />}
        {isOptional(cur, a) && <button type="button" className="btn btn-ghost" disabled={reading} onClick={() => answer(cur, "")}>Skip</button>}
        {cur.type === "file" && <>
          <input ref={pick} type="file" accept={cur.accept} className="sr-only" aria-label={cur.ask(a)} onChange={(e) => choose(cur, e.target.files?.[0])} />
          <button type="button" className={`btn ${field$ ? "" : "btn-pri"}`} disabled={reading} onClick={() => pick.current?.click()}>{cur.id === "logo" ? "Choose logo" : cur.id === "doc" ? "Add a PDF" : "Choose PDF"}</button>
        </>}
        {cur.type === "many" && <button type="submit" className="btn btn-pri" disabled={!many.length}>Done</button>}
        {field$ && <button type="submit" className="btn btn-pri" disabled={!text.trim() || reading}>{cur.id === "doc" ? "Read my link" : "Next"}</button>}
      </div>
    </form>
  );

  const chips = (s: Step) => {
    const opts = s.options?.(a) || [];
    if (s.id === "kind") return (
      <div className="grid gap-2 sm:grid-cols-2">{opts.map((o) => <button key={o.v} type="button" className="card flex flex-col items-start gap-1 rounded-2xl p-4 text-left transition hover:-translate-y-0.5 hover:border-brand-400" onClick={() => answer(s, o.v)}><b className="text-[15px] text-ink-100">{o.label}</b><span className="text-[13px] text-ink-400">{o.hint}</span></button>)}</div>
    );
    if (s.id === "pages") return (
      <div className="grid gap-2 sm:grid-cols-2">{opts.map((o) => <button key={o.v} type="button" className="card flex flex-col items-start gap-1 rounded-2xl p-4 text-left transition hover:-translate-y-0.5 hover:border-brand-400" onClick={() => answer(s, o.v)}><b className="text-[15px] text-ink-100">{o.label}</b><span className="text-[13px] text-ink-400">{o.hint}</span></button>)}</div>
    );
    return (
      <div className="flex flex-wrap gap-2" role={s.type === "many" ? "group" : undefined}>
        {opts.map((o) => {
          const on = many.includes(o.v);
          return (
            <button key={o.v} type="button" aria-pressed={s.type === "many" ? on : undefined} className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${on ? "border-brand-400 bg-brand-500/20 text-ink-100" : "border-ink-600 bg-ink-900 text-ink-200 hover:border-brand-400"}`}
              onClick={() => (s.type === "many" ? setMany((m) => (m.includes(o.v) ? m.filter((x) => x !== o.v) : [...m, o.v])) : answer(s, o.v))}>
              {s.id === "colour" && <span aria-hidden className="h-4 w-4 rounded-full border border-white/20" style={{ background: COLOUR_DOT[o.v] }} />}
              {o.label}
            </button>
          );
        })}
      </div>
    );
  };

  const ready = finished && !!copy && !writing;

  return (
    <div className="flex min-h-screen flex-col bg-ink-950 text-ink-100">
      <header className="mx-auto flex w-full max-w-5xl items-center gap-2 px-4 py-3 sm:px-6">
        <a href="#/themes" className="btn btn-ghost btn-sm shrink-0">← Themes</a>
        {/* The Studio's name is a link only for someone signed in: it goes to their projects. */}
        {studio
          ? <a href="#/" className="flex min-w-0 items-center gap-2 font-extrabold"><BrandMark fallback={<Logo />} /><span className="truncate max-sm:hidden">{brand.name}</span></a>
          : <span className="flex min-w-0 items-center gap-2 font-extrabold"><BrandMark fallback={<Logo />} /><span className="truncate max-sm:hidden">{brand.name}</span></span>}
        <span className="ml-auto flex shrink-0 items-center gap-2">
          {design && a.name && <button type="button" className="btn btn-sm" onClick={() => setShowPreview(true)}>Preview</button>}
          {started && <button type="button" className="btn btn-ghost btn-sm" onClick={restart}>Start again</button>}
        </span>
      </header>

      <main className={`mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 pb-12 sm:px-6 ${started ? "pt-4" : "justify-center pb-24"}`}>
        {!started && (
          <div className="text-center">
            <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">Design your own website</h1>
            <p className="mx-auto mt-3 max-w-xl text-ink-300">Answer a few simple questions and watch your website take shape. It's a preview; we finish it together.</p>
          </div>
        )}
        {!started && cur && <>{bar}<p className="text-center text-sm text-ink-400">or tap one:</p>{chips(cur)}</>}
        {started && (
          <>
            <div className="flex items-center gap-3" aria-label={`Step ${Math.min(answered.length + 1, total)} of ${total}`}>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-800" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={answered.length}><div className="h-full rounded-full bg-brand-500 transition-all duration-300" style={{ width: `${Math.round((answered.length / total) * 100)}%` }} /></div>
              <span className="w-12 text-right text-xs tabular-nums text-ink-400">{Math.min(answered.length + 1, total)} / {total}</span>
            </div>
            {cur && (
              <section className="card flex flex-col gap-5 p-5 sm:p-8" aria-live="polite">
                <div className="flex flex-col gap-2">
                  <h2 className="font-display text-2xl font-extrabold leading-snug tracking-tight sm:text-[28px]">{cur.ask(a)}</h2>
                  {cur.help && <p className="text-sm leading-relaxed text-ink-400">{cur.help(a)}</p>}
                </div>
                {(cur.type === "choice" || cur.type === "many") && chips(cur)}
                {cardBar}
                {reading && <p className="inline-flex items-center gap-2 text-sm text-ink-300"><Spinner />Reading it…</p>}
              </section>
            )}
            {finished && writing && <section className="card flex items-center gap-3 p-5 sm:p-6" aria-live="polite"><Spinner /><span className="text-sm">Writing a short line about each of your topics…</span></section>}
            {ready && (
              <section className="card flex flex-col gap-5 p-5 sm:p-8" aria-live="polite">
                <div className="flex flex-col gap-2">
                  <h2 className="font-display text-2xl font-extrabold tracking-tight sm:text-[28px]">Your preview is ready</h2>
                  <p className="text-sm leading-relaxed text-ink-300">{design ? <>A <b className="text-ink-100">{TEMPLATES[design.kind].name}</b> in the <b className="text-ink-100">{design.themeName}</b> look. </> : ""}It isn't published. Connect with us to finish it together: your own photos, your address on the web, payment and any extra features.</p>
                </div>
                <div className="grid gap-2 sm:flex sm:flex-wrap">
                  <button type="button" className="btn btn-pri justify-center" onClick={() => setShowPreview(true)}>View my preview</button>
                  <button type="button" className="btn justify-center" onClick={() => setConnect(true)}>{sent ? "Request sent ✓" : "Connect with Picaffectz"}</button>
                  <button type="button" className="btn btn-ghost justify-center" onClick={restart}>Design another</button>
                </div>
                <p className="text-xs text-ink-500">Preview only. Nothing is published or charged.</p>
              </section>
            )}
            <details className="group rounded-2xl border border-ink-800 bg-ink-900/50">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-ink-200 marker:hidden [&::-webkit-details-marker]:hidden">
                <span>Your answers</span><span className="chip">{answered.filter((x) => a[x.id]).length}</span>
                <span className="ml-auto text-xs font-normal text-ink-500 group-open:hidden">Tap to review or change</span>
                <span aria-hidden className="text-ink-500 transition group-open:rotate-180">⌄</span>
              </summary>
              <div className="flex flex-wrap gap-1.5 border-t border-ink-800 p-4" aria-label="Your answers so far">
                {answered.map((s) => (
                  <button key={s.id} type="button" onClick={() => rewind(s.id)} title={`Change: ${s.ask(a)}`} aria-label={`Change your answer to: ${s.ask(a)}`} className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition hover:border-brand-400 ${a[s.id] ? "border-ink-700 bg-ink-900 text-ink-300" : "border-ink-800 text-ink-500"}`}>
                    <span className="text-ink-500">{STEP_LABEL[s.id] || s.id}</span>
                    <span className={`max-w-[12rem] truncate font-semibold ${a[s.id] ? "text-ink-100" : "font-normal"}`}>{a[s.id] ? sayAnswer(s, a).replace(/\s*\(from your document\)$/, "") : "Skipped"}</span>
                    {(a.docfrom || "").split(",").includes(s.id) && <span className="text-brand-300" title="Found in your document">✦</span>}
                    <span aria-hidden className="text-ink-500">✎</span>
                  </button>
                ))}
              </div>
            </details>
            <div ref={endRef} />
          </>
        )}
      </main>

      {showPreview && design && <PreviewPopup design={design} ver={ver} a={a} onClose={() => setShowPreview(false)} onConnect={() => setConnect(true)} done={ready} onTweak={ready ? tweak : undefined} />}
      {warn && (
        <div role="alertdialog" aria-modal="true" aria-label="Developer tools detected" className="fixed inset-0 z-[100] grid place-items-center bg-black/85 p-4">
          <div className="card flex w-full max-w-md flex-col gap-3 p-6">
            <h2 className="font-display text-2xl font-extrabold text-amber-200">Developer tools detected</h2>
            <p className="text-sm text-ink-200">This page doesn't allow developer tools while you design. To protect the design and its data, everything has been reset. Please close developer tools and start again.</p>
            <button type="button" className="btn btn-pri self-start" autoFocus onClick={() => setWarn(false)}>OK, start again</button>
          </div>
        </div>
      )}
      {connect && <ConnectPopup a={a} design={design} copy={copy} files={files} host={host} sent={sent} onSent={() => setSent(true)} onClose={() => setConnect(false)} />}
    </div>
  );
}

/** The preview, over the whole screen. */
export function PreviewPopup({ design, ver, a, onClose, onConnect, done, onTweak }: { design: Design; ver: number; a: Answers; onClose: () => void; onConnect?: () => void; done: boolean; onTweak?: (p: Answers) => void }) {
  const [play, setPlay] = useState(false);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    addEventListener("keydown", k); const o = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { removeEventListener("keydown", k); document.body.style.overflow = o; };
  }, []);
  return (
    <div role="dialog" aria-modal="true" aria-label="Your website preview" className="fixed inset-0 z-[70] flex flex-col bg-ink-950">
      <div className="flex items-center gap-2 border-b border-ink-700 bg-ink-900 px-3 py-2 sm:px-4">
        <b className="min-w-0 truncate text-sm">{a.name || "Your website"}</b>
        <span className="chip shrink-0 border-amber-400/50 text-amber-200 max-sm:hidden">{done ? "Preview · not published" : "Preview so far"}</span>
        <span className="ml-auto flex shrink-0 items-center gap-2">
          {onTweak && <button type="button" className={`btn btn-sm ${play ? "border-brand-400" : ""}`} aria-pressed={play} onClick={() => setPlay((v) => !v)}><span className="max-sm:hidden">Play with your design</span><span className="sm:hidden">Customise</span></button>}
          {onConnect && <button type="button" className="btn btn-pri btn-sm" onClick={onConnect}><span className="max-sm:hidden">Connect with Picaffectz</span><span className="sm:hidden">Connect</span></button>}
          <button type="button" className="btn btn-sm" onClick={onClose} autoFocus>{done ? "Close" : "Back"}</button>
        </span>
      </div>
      <div className="relative flex min-h-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col"><Preview key={design.kind} tpl={TEMPLATES[design.kind]} base={`templates/${design.kind}/`} content={design.content} version={ver} assets={{}} editable={false} /></div>
        {play && onTweak && <Tweaks a={a} design={design} onTweak={onTweak} onClose={() => setPlay(false)} />}
      </div>
    </div>
  );
}

const ACCENTS = ["blue", "green", "red", "orange", "purple", "pink", "gold", "mono"] as const;
const CORNERS: [string, string][] = [["0", "Sharp"], ["8", "Soft"], ["16", "Round"], ["28", "Pill"]];
/** "Play with your design": the colours and look of the chosen type, changed live. */
function Tweaks({ a, design, onTweak, onClose }: { a: Answers; design: Design; onTweak: (p: Answers) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const all = useMemo(() => themesFor(design.kind), [design.kind]);
  const list = all.filter((t) => !q.trim() || (t.name + " " + t.tags.join(" ")).toLowerCase().includes(q.trim().toLowerCase()));
  const seg = (label: string, key: string, opts: [string, string][], own = true) => (
    <div className="flex flex-col gap-1.5"><span className="label">{label}</span>
      <div className="flex flex-wrap rounded-lg border border-ink-600" role="radiogroup" aria-label={label}>
        {[...(own ? [["", "Theme's own"] as [string, string]] : []), ...opts].map(([v, l]) => <button key={v || "own"} type="button" role="radio" aria-checked={(a[key] || "") === v} onClick={() => onTweak({ [key]: v })} className={`btn btn-sm border-0 ${(a[key] || "") === v ? "bg-ink-700" : "bg-transparent"}`}>{l}</button>)}
      </div>
    </div>
  );
  const changed = ["theme", "accent", "mode", "corners"].some((x) => a[x]);
  return (
    <aside aria-label="Play with your design" className="z-10 flex flex-col gap-4 overflow-y-auto border-ink-700 bg-ink-900 p-4 max-md:absolute max-md:inset-x-0 max-md:bottom-0 max-md:max-h-[58%] max-md:border-t md:w-[330px] md:flex-none md:border-l">
      <div className="flex items-center gap-2"><b className="text-[15px]">Play with your design</b><button type="button" className="btn btn-ghost btn-sm ml-auto" onClick={onClose} aria-label="Close this panel">✕</button></div>
      <p className="text-[13px] text-ink-400">Try other looks and colours for your {TEMPLATES[design.kind].name.toLowerCase()}. The preview changes as you tap.</p>
      <div className="flex flex-col gap-1.5"><span className="label">Accent colour</span>
        <div className="flex flex-wrap items-center gap-2">
          {ACCENTS.map((c) => <button key={c} type="button" title={c} aria-label={c} aria-pressed={a.accent?.toLowerCase() === COLOUR_DOT[c].toLowerCase()} onClick={() => onTweak({ accent: COLOUR_DOT[c] })} className={`h-8 w-8 rounded-full border-2 ${a.accent?.toLowerCase() === COLOUR_DOT[c].toLowerCase() ? "border-white" : "border-white/20"}`} style={{ background: COLOUR_DOT[c] }} />)}
          <input type="color" aria-label="Pick your own colour" className="h-8 w-10 cursor-pointer rounded border border-ink-600 bg-transparent" value={/^#[0-9a-f]{6}$/i.test(a.accent || "") ? a.accent : "#3b82f6"} onChange={(e) => onTweak({ accent: e.target.value })} />
          {a.accent && <button type="button" className="btn btn-ghost btn-sm" onClick={() => onTweak({ accent: "" })}>Theme's own</button>}
        </div>
      </div>
      {seg("Light or dark", "mode", [["light", "Light"], ["dark", "Dark"]])}
      {seg("Corners", "corners", CORNERS)}
      {(design.kind === "business" || design.kind === "restaurant") && seg("Pages", "pages", [["single", "One page"], ["multi", "Separate pages"]], false)}
      <div className="flex flex-col gap-1.5"><span className="label">Look ({all.length})</span>
        <input className="input" type="search" placeholder="Search, e.g. dark, warm, bold" aria-label="Search looks" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="grid max-h-72 grid-cols-1 gap-1.5 overflow-y-auto pr-1">
          {list.map((t) => (
            <button key={t.id} type="button" aria-pressed={design.themeId === t.id} onClick={() => onTweak({ theme: t.id })} className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-[13px] ${design.themeId === t.id ? "border-brand-400 bg-brand-500/15" : "border-ink-700 hover:border-ink-500"}`}>
              <span className="flex flex-none overflow-hidden rounded-full border border-white/20" aria-hidden>{[t.colors.bg, t.colors.c1, t.colors.c2].map((c, i) => <span key={i} className="h-5 w-4" style={{ background: c }} />)}</span>
              <span className="min-w-0 flex-1 truncate font-semibold text-ink-100">{t.name}</span><span className="text-[11px] text-ink-500">{t.dark ? "Dark" : "Light"}</span>
            </button>
          ))}
          {!list.length && <p className="text-[13px] text-ink-400">No look matches that.</p>}
        </div>
      </div>
      {changed && <button type="button" className="btn btn-sm self-start" onClick={() => onTweak({ theme: "", accent: "", mode: "", corners: "" })}>Back to my first design</button>}
      <p className="text-[12px] text-ink-500">Your changes are kept with your request when you connect with us.</p>
    </aside>
  );
}

/** Send the request: it is saved in the Studio's own database and emailed to its owners. */
export function ConnectPopup({ a, design, copy, files, host, sent, onSent, onClose }: { a: Answers; design: Design | null; copy: Copy | null; files: DesignFiles; host: DesignHost | null; sent: boolean; onSent: () => void; onClose: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ person: "", phone: a.phone || "", email: a.email || "", note: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(sent);
  const msg = useMemo(() => requestText(a, design), [a, design]);
  const send = async () => {
    if (!host) return;
    if (!f.person.trim()) return toast("Please tell us your name.", "bad");
    if (!f.phone.trim() && !f.email.trim()) return toast("Please give a phone number or an email address.", "bad");
    setBusy(true);
    try {
      await submitQuery(host, { kind: a.kind, name: a.name || "Untitled", person: f.person.trim(), phone: f.phone.trim(), email: f.email.trim(), note: f.note.trim(), answers: a, ...(copy ? { copy } : {}), ...(files.logo ? { logo: files.logo } : {}), ...(files.menu ? { pdf: files.menu } : {}) });
      setDone(true); onSent();
    } catch (e: any) { toast(e?.message || "Couldn't send. Please try again.", "bad"); }
    setBusy(false);
  };
  const copyIt = async () => { try { await navigator.clipboard.writeText(msg); toast("Details copied"); } catch { prompt("Copy these details:", msg); } };
  return (
    <div role="dialog" aria-modal="true" aria-label="Connect with Picaffectz" className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4" onClick={onClose}>
      <div className="card flex max-h-[90vh] w-full max-w-lg flex-col gap-4 overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        {done ? <>
          <h2 className="font-display text-2xl font-extrabold">Thank you! Your request is sent.</h2>
          <p className="text-sm text-ink-300">We have your design and your details. We'll get in touch to finish your website together: photos, your address on the web, payment and any extras.</p>
          <button type="button" className="btn btn-pri self-start" onClick={onClose}>Close</button>
        </> : <>
          <h2 className="font-display text-2xl font-extrabold">Let's finish your website</h2>
          <p className="text-sm text-ink-300">This preview isn't published. Send us your design and we'll get back to you about the final website, the price and anything extra you'd like.</p>
          {host ? <>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 sm:col-span-2"><span className="label">Your name</span><input className="input" autoFocus value={f.person} onChange={(e) => setF({ ...f, person: e.target.value })} /></label>
              <label className="flex flex-col gap-1.5"><span className="label">Phone or WhatsApp</span><input className="input" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
              <label className="flex flex-col gap-1.5"><span className="label">Email</span><input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
              <label className="flex flex-col gap-1.5 sm:col-span-2"><span className="label">Anything else we should know? (optional)</span><textarea className="input min-h-[70px]" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
            </div>
            <div className="flex flex-wrap gap-2"><button type="button" className="btn btn-pri" disabled={busy} onClick={send}>{busy ? "Sending…" : "Send to Picaffectz"}</button><button type="button" className="btn btn-ghost" onClick={onClose}>Not now</button></div>
          </> : <>
            <p className="rounded-lg border border-amber-400/40 bg-amber-400/5 px-3 py-2 text-[13px] text-amber-100">This Studio can't receive requests from this page yet. Copy your details and send them to us directly.</p>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-xl border border-ink-700 bg-ink-950 p-3 text-xs text-ink-300">{msg}</pre>
            <div className="flex flex-wrap gap-2"><button type="button" className="btn btn-pri" onClick={copyIt}>Copy details</button><button type="button" className="btn btn-ghost" onClick={onClose}>Close</button></div>
          </>}
        </>}
      </div>
    </div>
  );
}
