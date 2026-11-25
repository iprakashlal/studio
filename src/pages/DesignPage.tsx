import { StudioPageLinksHere } from "./StudioPage";
import { DevtoolsGuard, LoadVeil } from "../ui/PageGuard";
import { themeCode } from "../themes/codes";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Theme } from "../themes/catalog";
import { BrandMark, useBrand } from "../lib/brand";
import { TEMPLATES } from "../schema";
import { Preview } from "../editor/Preview";
import { Logo, Spinner, useToast } from "../ui/kit";
import { packSections, sectionNames, unpackSections } from "../lib/docsections";
import { relatedThemes } from "../lib/designer";
import { COLOUR_DOT, STEPS, STEP_LABEL, buildDesign, fromDoc, isOptional, nextStep, rowsFmt, requestText, stepAt, sayAnswer, themeOf, themesFor, tweakTheme, writeCopy, type Answers, type Design, type DesignFiles, type Step } from "../lib/designer";
import { newDesignId, readDesignSettings, readLocalDesigns, writeLocalDesigns, type Copy, type DesignRec } from "../lib/designs";
import { COLOUR_SLOTS, GROUPS, pagesChoice, readColsAnswer, readLookAnswer, resolvedLook, visibleAxes, type Kind as LookKind } from "../lib/designlook";
import { designHost, otpCheck, otpSend, passLive, readPage, readPass, saveDraft, submitQuery, understandText, writePass, type DesignHost, type Pass } from "../lib/designapi";
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
/** A photo made small enough to keep with the request: at most ~1000 px across, as a JPEG under ~150 KB. */
async function fitPhoto(file: File): Promise<string> {
  const bmp = await createImageBitmap(file); let max = 1000, q = 0.8, u = "";
  for (let i = 0; i < 8; i++) {
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height)), c = document.createElement("canvas"); c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
    const g = c.getContext("2d")!; g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height);
    u = c.toDataURL("image/jpeg", q); if (u.length <= 150_000) break; if (q > 0.55) q -= 0.1; else max = Math.round(max * 0.8);
  }
  bmp.close?.(); if (u.length > 190_000) throw new Error("That picture is too detailed. Please use a smaller one.");
  return u;
}
const PIC_STEPS = ["photo", "banner", "bimage", "photos"];
const toB64 = (buf: ArrayBuffer) => { const b = new Uint8Array(buf); let s = ""; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192)); return btoa(s); };

/** A list question asked as rows of sub-fields. Each row becomes one line of the answer (so it reads the same as typing it). */
function RowsField({ step, value, onChange, label }: { step: Step; value: string; onChange: (v: string) => void; label: string }) {
  const cols = step.cols!, n = cols.length;
  const [rows, setRows] = useState<string[][]>(() => {
    const init = value.split("\n").filter(Boolean).map((l) => { const parts = l.replace(/^["“]|["”]$/g, "").split(/\s[–-]\s|,\s*|\s(?=\d)/).map((x) => x.trim()); return Array.from({ length: n }, (_, i) => parts[i] || ""); });
    return init.length ? init : [Array(n).fill("")];
  });
  const text = (r: string[][]) => r.map((x) => rowsFmt(step, x)).filter(Boolean).join("\n");
  const set = (next: string[][]) => { setRows(next); onChange(text(next)); };
  // The page clears its answer box when a step changes or text is being written: the rows say what they hold again.
  useEffect(() => { const t = text(rows); if (t !== value) onChange(t); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="flex flex-col gap-3" role="group" aria-label={label}>
      {rows.map((r, i) => (
        <div key={i} className="rounded-2xl border border-ink-700 p-3">
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(auto-fit,minmax(${n > 2 ? 9 : 11}rem,1fr))` }}>
            {cols.map((c, j) => (
              <label key={j} className="flex min-w-0 flex-col gap-1 text-xs text-ink-400">{c.label}
                <input className="input" value={r[j]} placeholder={c.ph} onChange={(e) => set(rows.map((x, k) => (k === i ? x.map((y, m) => (m === j ? e.target.value : y)) : x)))} />
              </label>
            ))}
          </div>
          {rows.length > 1 && <button type="button" className="btn btn-ghost btn-sm mt-2" onClick={() => set(rows.filter((_, k) => k !== i))}>Remove</button>}
        </div>
      ))}
      {rows.length < 8 && <button type="button" className="btn btn-sm self-start" onClick={() => set([...rows, Array(n).fill("")])}>+ {step.addLabel || "Add another"}</button>}
    </div>
  );
}

export function DesignPage({ studio, index, onIndex }: { studio?: Studio; index?: StudioIndex | null; onIndex?: (i: StudioIndex) => void }) {
  const toast = useToast();
  const brand = useBrand();
  const [phone, setPhone] = useState(() => typeof matchMedia === "function" && matchMedia("(max-width: 767px)").matches);
  useEffect(() => { if (typeof matchMedia !== "function") return; const m = matchMedia("(max-width: 767px)"), f = () => setPhone(m.matches); m.addEventListener("change", f); return () => m.removeEventListener("change", f); }, []);
  const first = useMemo(readDraft, []);
  const [a, setA] = useState<Answers>(first.a);
  const [copy, setCopy] = useState<Copy | null>(first.copy);
  const [files, setFiles] = useState<DesignFiles>({});
  const [host, setHost] = useState<DesignHost | null>(null);
  const [design, setDesign] = useState<Design | null>(null);
  const [ver, setVer] = useState(1);
  const [setsVer, setSetsVer] = useState(0);
  useEffect(() => { const f = () => setSetsVer((v) => v + 1); addEventListener("studio:design-page", f); return () => removeEventListener("studio:design-page", f); }, []);
  const [writing, setWriting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [jump, setJump] = useState<{ id: string; n: number } | null>(null);
  const [connect, setConnect] = useState(false), [connectFrom, setConnectFrom] = useState<DOMRect | null>(null);
  const openConnect = (r?: DOMRect) => { setConnectFrom(r || null); setConnect(true); };
  const [text, setText] = useState("");
  const [many, setMany] = useState<string[]>([]);
  const [savedId, setSavedId] = useState(first.id || newDesignId());
  // The visitor's confirmed email (asked first, with a code). A signed-in owner needs none.
  const [pass, setPass] = useState<Pass | null>(readPass);
  const ownPass = (p: Pass | null) => { setPass(p); writePass(p); };
  const [sent, setSent] = useState(first.sent);
  const [warn, setWarn] = useState(false);
  const [reading, setReading] = useState(false);
  const resetRef = useRef<() => void>(() => {});
  const endRef = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const pick = useRef<HTMLInputElement>(null);
  const cur = nextStep(a);
  const curRef = useRef(cur); curRef.current = cur;
  /** Leaves out every remaining optional question (stops at one that is needed). */
  const skipRest = () => setA((o) => { const n = { ...o }; let s: Step | null; while ((s = nextStep(n)) && isOptional(s, n)) n[s.id] = ""; return n; });
  const answered = STEPS.filter((s) => s.id in a && (s.when ? s.when(a) : true));
  const started = answered.length > 0;
  const total = STEPS.filter((x) => (x.when ? x.when(a) : true)).length;

  useEffect(() => { document.title = "Design yourself · " + brand.name; }, [brand.name]);
  const [hostDone, setHostDone] = useState(false), [fontsOk, setFontsOk] = useState(false);
  const needMail = !studio && hostDone && !!host && !passLive(pass);
  useEffect(() => { designHost().then(setHost).catch(() => {}).finally(() => setHostDone(true)); const f = (document as any).fonts?.ready; (f ? Promise.race([f, new Promise((r) => setTimeout(r, 4000))]) : Promise.resolve()).finally(() => setFontsOk(true)); }, []);
  useEffect(() => { try { sessionStorage.setItem(DRAFT, JSON.stringify({ a, copy, id: savedId, sent })); } catch { /* private mode */ } }, [a, copy, savedId, sent]);
  useEffect(() => { setText(""); setMany([]); setTimeout(() => field.current?.focus(), 50); window.scrollTo({ top: 0, behavior: "smooth" }); }, [cur?.id, answered.length, writing]);

  // The site is rebuilt as each answer arrives.
  useEffect(() => {
    let live = true;
    if (!a.kind) { setDesign(null); return; }
    buildDesign(a, copy, files).then((d) => { if (live && d) { setDesign(d); setVer((v) => v + 1); } }).catch(() => {});
    return () => { live = false; };
  }, [a, copy, files, setsVer]);

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

  // Once the email is confirmed, the progress is kept in the Studio's database as they answer (Projects → Design previews); sending it moves it to DIY Submissions.
  useEffect(() => {
    if (studio || !host || !passLive(pass) || sent || !a.kind) return;
    const t = setTimeout(() => {
      const logo = files.logo && files.logo.length < 60000 ? files.logo : "";
      saveDraft(host, pass, { id: savedId, name: a.name || "Untitled", kind: a.kind || "", themeId: design?.themeId || "", themeName: design?.themeName || "", summary: design?.summary || "", answers: a, ...(copy ? { copy } : {}), ...(logo ? { logo } : {}) }).catch((e: any) => { if (/confirm your email/i.test(e?.message || "")) ownPass(null); });
    }, 1500);
    return () => clearTimeout(t);
  }, [a, copy, design?.themeId, files.logo, pass, host, sent, savedId]);

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
    const fill = fromDoc(text, a, meta), got = Object.keys(fill).filter((x) => x !== "docsec"), secs = sectionNames(unpackSections(fill.docsec));
    setA((o) => ({ ...o, doc: label, ...(link ? { doclink: link } : {}), ...(text ? { doctext: text } : {}), ...fromDoc(text, o, meta), ...(got.length ? { docfrom: got.join(",") } : {}) }));
    const found = [...got.map((x) => (STEP_LABEL[x] || x).toLowerCase()), ...secs.filter((x) => !got.includes(x))];
    toast(found.length ? `Found ${found.join(", ")}. You can change any answer.` : "Read it. It will help us write your text.");
    // The Studio's AI (when it is the chosen engine) reads it more closely: what it finds replaces the rule-based guesses, never what the person typed.
    if (host && text.length >= 30) void understandText(host, a.kind || "", text).then((u) => {
      const f = u.fields; if (!f || u.engine === "system") return;
      setA((o) => {
        const typed = new Set((o.docfrom || "").split(",").filter(Boolean)), n: Answers = {}, put = (k: string, v: any) => { if (k === curRef.current?.id) return; /* (the question they are answering now is theirs: it never fills in under their hands) */ if (typeof v === "string" && v.trim() && (!o[k] || typed.has(k))) n[k] = v.trim(); };
        for (const k of ["name", "about", "city", "story", "usp", "phone", "email", "hours", "address", "social"]) { if (k === "address" || k === "hours" || k === "social") { if (!o[k]) put(k, f[k]); } else put(k, f[k]); }
        if (Array.isArray(f.items) && f.items.length && curRef.current?.id !== "items" && (!o.items || typed.has("items"))) n.items = f.items.filter((x: any) => typeof x === "string" && x.trim()).join("\n");
        if (f.sections && typeof f.sections === "object") { const pk = packSections({ ...unpackSections(o.docsec), ...f.sections }); if (pk) n.docsec = pk; }
        const keys = Object.keys(n).filter((x) => x !== "docsec"); if (!keys.length && !n.docsec) return o;
        return { ...o, ...n, docfrom: [...new Set([...typed, ...keys])].join(",") };
      });
    });
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
  const choose = async (s: Step, f: File | undefined, extra: File[] = []) => {
    if (!f) return;
    try {
      if (f.size > (s.maxKB || 1000) * 1024) throw new Error(`That file is over ${s.maxKB === 20480 ? 20 : Math.round((s.maxKB || 1000) / 1000)} MB. Please choose a smaller one.`);
      if (PIC_STEPS.includes(s.id)) {
        const list = [f, ...extra].filter((x) => /^image\//.test(x.type)).slice(0, s.id === "photos" ? 4 : s.id === "banner" ? 2 : 1);
        if (!list.length) throw new Error("Please choose a picture (PNG, JPG or WebP).");
        const urls = await Promise.all(list.map(fitPhoto));
        setFiles((o) => ({ ...o, pics: { ...(o.pics || {}), [s.id]: urls } })); answer(s, `${urls.length} picture${urls.length > 1 ? "s" : ""} added`);
      } else if (s.id === "logo") { const u = await fitImage(f); setFiles((o) => ({ ...o, logo: u })); answer(s, "added"); }
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
    const at = stepAt(id, a);
    const docAt = stepAt("doc", a), look = ["theme", "accent", "mode", "corners"];
    const keep = Object.fromEntries(Object.entries(a).filter(([key]) => !look.includes(key) && !((key === "doctext" || key === "docfrom" || key === "docsec") && at <= docAt) && stepAt(key, a) < at));
    const old = a[id]; setA(keep); setCopy(null); if (STEPS[at].type === "text" || STEPS[at].type === "long") setTimeout(() => setText(old || ""), 60);
    lastSaved.current = ""; setShowPreview(false);
  };
  resetRef.current = () => { restart(); ownPass(null); try { writeLocalDesigns([]); } catch { /* none */ } setShowPreview(false); setConnect(false); };
  // Developer tools opened on this page (not for a signed-in owner): everything made here is cleared and a warning is shown.
  useEffect(() => { if (studio) return; return watchDevtools(() => { resetRef.current(); setWarn(true); }); }, [studio]);
  const tweak = (p: Answers) => setA((o) => { const n = { ...o, ...p }; for (const key of Object.keys(p)) if (p[key] === "") delete n[key]; return n; });
  // Developer tools opened (see PageGuard): the preview (and its frame) goes and the questions start over.
  useEffect(() => { const f = () => { restart(); setPass(null); setShowPreview(false); setConnect(false); setReviewOpen(false); }; addEventListener("studio:guard", f); return () => removeEventListener("studio:guard", f); }, []);
  function restart() { setA({}); setCopy(null); setFiles({}); setDesign(null); setSavedId(newDesignId()); setSent(false); lastSaved.current = ""; try { sessionStorage.removeItem(DRAFT); } catch { /* none */ } }

  const field$ = cur && (cur.type === "text" || cur.type === "long" || cur.id === "kind" || cur.id === "doc");
  const bar = (
    <form className="mx-auto flex w-full max-w-2xl flex-col gap-2" onSubmit={(e) => { e.preventDefault(); submit(); }} aria-label="Your answer">
      <div className={`flex flex-wrap items-end gap-2 rounded-3xl border bg-ink-900 p-2 pl-4 shadow-xl transition focus-within:border-brand-400 ${field$ || cur?.type === "file" ? "border-ink-600" : "border-ink-700 opacity-80"}`}>
        {cur?.type === "long"
          ? <textarea ref={field} aria-label={cur.ask(a)} rows={3} className="min-h-[3.5rem] min-w-0 flex-1 basis-[12rem] resize-none bg-transparent py-2 text-[15px] text-ink-100 outline-none placeholder:text-ink-500" placeholder={cur.ph?.(a)} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); } }} />
          : <input ref={field} aria-label={cur ? cur.ask(a) : "Your answer"} className="min-w-0 flex-1 basis-[12rem] bg-transparent py-2.5 text-[15px] text-ink-100 outline-none placeholder:text-ink-500" disabled={!field$ || reading} placeholder={reading ? "Reading…" : writing ? "Writing your text…" : !cur ? "All done. Your preview is ready." : cur.id === "kind" ? "Tell me what you want, e.g. an online shop for my candles" : field$ ? cur.ph?.(a) : cur.type === "many" ? "Tap what applies above, then press Done" : cur.type === "file" ? "Choose a file, or skip" : "Pick one of the choices above"} value={field$ ? text : ""} onChange={(e) => setText(e.target.value)} />}
        {cur?.type === "file" && <>
          <input ref={pick} type="file" accept={cur.accept} multiple={cur.id === "photos" || cur.id === "banner"} className="sr-only" aria-label={cur.ask(a)} onChange={(e) => choose(cur, e.target.files?.[0], Array.from(e.target.files || []).slice(1))} />
          <button type="button" className="btn btn-pri btn-sm rounded-full" onClick={() => pick.current?.click()}>{PIC_STEPS.includes(cur.id) ? (cur.id === "photos" || cur.id === "banner" ? "Choose pictures" : "Choose a picture") : cur.id === "logo" ? "Choose logo" : cur.id === "doc" ? "Choose document (PDF)" : "Choose PDF"}</button>
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
      {cur.type === "long" && cur.cols
        ? <RowsField key={cur.id + (a.kind || "")} step={cur} value={text} onChange={setText} label={cur.ask(a)} />
        : cur.type === "long"
        ? <textarea ref={field} aria-label={cur.ask(a)} rows={4} className="input min-h-[7rem] resize-y" placeholder={cur.ph?.(a)} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); } }} />
        : field$ ? <input ref={field} aria-label={cur.ask(a)} className="input" disabled={reading} placeholder={reading ? "Reading…" : cur.ph?.(a)} value={text} onChange={(e) => setText(e.target.value)} /> : null}
      {cur.id === "doc" && a.kind === "portfolio" && (
        <label className="flex flex-col gap-1 text-xs text-ink-400">Your LinkedIn profile URL (optional)
          <input className="input" inputMode="url" autoComplete="url" placeholder="e.g. linkedin.com/in/yourname" value={a.linkedin || ""} onChange={(e) => setA((o) => ({ ...o, linkedin: e.target.value.slice(0, 200) }))} />
        </label>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {cur.type === "long" && !cur.cols && <span className="mr-auto text-xs text-ink-500">Enter = new line · Ctrl + Enter = send</span>}
        {(cur.type !== "long" || cur.cols) && <span className="mr-auto" />}
        {isOptional(cur, a) && <button type="button" className="btn btn-ghost" disabled={reading} onClick={() => answer(cur, "")}>Skip</button>}
        {cur.type === "file" && <>
          <input ref={pick} type="file" accept={cur.accept} multiple={cur.id === "photos" || cur.id === "banner"} className="sr-only" aria-label={cur.ask(a)} onChange={(e) => choose(cur, e.target.files?.[0], Array.from(e.target.files || []).slice(1))} />
          <button type="button" className={`btn ${field$ ? "" : "btn-pri"}`} disabled={reading} onClick={() => pick.current?.click()}>{PIC_STEPS.includes(cur.id) ? (cur.id === "photos" || cur.id === "banner" ? "Choose pictures" : "Choose a picture") : cur.id === "logo" ? "Choose logo" : cur.id === "doc" ? "Add a PDF" : "Choose PDF"}</button>
        </>}
        {cur.type === "many" && <button type="submit" className="btn btn-pri" disabled={!many.length}>Done</button>}
        {field$ && <button type="submit" className="btn btn-pri" disabled={!text.trim() || reading}>{cur.id === "doc" ? "Read my link" : "Next"}</button>}
      </div>
      {answered.length >= 6 && isOptional(cur, a) && !reading && <button type="button" className="self-start text-xs text-ink-400 underline underline-offset-2 hover:text-ink-200" onClick={skipRest}>Skip the remaining optional questions and see my preview</button>}
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
        {s.type === "choice" && isOptional(s, a) && <button type="button" className="inline-flex items-center rounded-full border border-dashed border-ink-600 px-4 py-2 text-sm font-semibold text-ink-400 transition hover:border-brand-400" onClick={() => answer(s, "")}>Skip</button>}
      </div>
    );
  };

  const ready = finished && !!copy && !writing;
  const wasReady = useRef(false);
  useEffect(() => { if (ready && !wasReady.current) { wasReady.current = true; setReviewOpen(true); } if (!finished) wasReady.current = false; }, [ready, finished]);

  if (phone && !studio) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ink-950 px-6 text-center text-ink-100">
      <div className="max-w-md rounded-3xl border border-ink-700 bg-ink-900 p-7 shadow-xl">
        <h1 className="m-0 text-xl font-bold">Design yourself is not available on mobile</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-300">Website design and editing are available only on a desktop, laptop or tablet display. Please open this page on one of those devices to continue.</p>
        <a href="#/themes" className="btn mt-5 inline-flex">← Back to themes</a>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-ink-950 text-ink-100">
      <DevtoolsGuard /><LoadVeil title="Loading Design yourself" steps={["Loading the designer", "Reading the Studio's settings"]} done={(fontsOk ? 1 : 0) + (hostDone ? 1 : 0)} />
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
        {needMail && <EmailGate host={host!} onPass={(p) => { ownPass(p); setA((o) => (o.email ? o : { ...o, email: p.email })); }} />}
        {!needMail && !started && (
          <div className="text-center">
            <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">Design your own website</h1>
            <p className="mx-auto mt-3 max-w-xl text-ink-300">Answer a few simple questions and watch your website take shape. It's a preview; we finish it together.</p>
          </div>
        )}
        {!needMail && !started && cur && <>{bar}<p className="text-center text-sm text-ink-400">or tap one:</p>{chips(cur)}</>}
        {!needMail && started && (
          <>
            <div className="flex items-center gap-3" aria-label={`Step ${Math.min(answered.length + 1, total)} of ${total}`}>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-800" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={answered.length}><div className="h-full rounded-full bg-brand-500 transition-all duration-300" style={{ width: `${Math.round((answered.length / total) * 100)}%` }} /></div>
              <span className="w-12 text-right text-xs tabular-nums text-ink-400">{Math.min(answered.length + 1, total)} / {total}</span>
            </div>
            {cur && (
              <section className="card flex flex-col gap-5 p-5 sm:p-8" aria-live="polite">
                <div className="flex flex-col gap-2">
                  <h2 className="font-display text-2xl font-extrabold leading-snug tracking-tight sm:text-[28px]">{cur.ask(a)}</h2>
                  {cur.help && cur.help(a) && <p className="text-sm leading-relaxed text-ink-400">{cur.help(a)}</p>}
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
                  <p className="text-sm leading-relaxed text-ink-300">{design ? <>A <b className="text-ink-100">{TEMPLATES[design.kind].name}</b> in the <b className="text-ink-100">{design.themeName}</b> look (theme ID <b className="font-mono text-ink-100">{themeCode({ id: design.themeId })}</b>). </> : ""}It isn't published. Connect with us to finish it together: your own photos, your address on the web, payment and any extra features.</p>
                </div>
                <div className="grid gap-2 sm:flex sm:flex-wrap">
                  <button type="button" className="btn btn-pri justify-center" onClick={() => setShowPreview(true)}>View my preview</button>
                  <button type="button" className="btn justify-center" onClick={(e) => openConnect(e.currentTarget.getBoundingClientRect())}>{sent ? "Request sent ✓" : "Connect with Picaffectz"}</button>
                  <button type="button" className="btn btn-ghost justify-center" onClick={restart}>Design another</button>
                </div>
                <p className="text-xs text-ink-500">Preview only. Nothing is published or charged.</p>
              </section>
            )}
            <AnswersReview rows={answered} a={a} jump={jump} open={reviewOpen} onOpen={setReviewOpen} onRewind={rewind}
              onSave={(id, v) => { setA((o) => { const n: Answers = { ...o, [id]: v, docfrom: (o.docfrom || "").split(",").filter((x) => x && x !== id).join(",") }; if (id === "kind" && o.kind !== v) for (const k of ["theme", "accent", "mode", "corners"]) delete n[k]; /* (a look belongs to one type; everything else they said stays) */ return n; }); setCopy(null); lastSaved.current = ""; toast("Updated. Your preview follows."); }} />
            <div ref={endRef} />
          </>
        )}
      </main>
      <StudioPageLinksHere where="design" />

      {showPreview && design && <PreviewPopup design={design} ver={ver} a={a} build={(id) => buildDesign({ ...a, theme: id }, copy, files)} onClose={() => setShowPreview(false)} onEditLink={(id) => { setShowPreview(false); if (cur && id === cur.id && !(id in a)) { /* the question being asked now: answer it in the box above, nothing is filled in or skipped */ window.scrollTo({ top: 0, behavior: "smooth" }); setTimeout(() => field.current?.focus(), 150); return; } setReviewOpen(true); if (!(id in a)) setA((o) => ({ ...o, [id]: "" })); setTimeout(() => setJump({ id, n: Date.now() }), 60); }} onEdit={() => { setShowPreview(false); setReviewOpen(true); setTimeout(() => document.getElementById("design-answers")?.scrollIntoView({ block: "start", behavior: "smooth" }), 80); }} onConnect={openConnect} done={ready} onTweak={ready ? tweak : undefined} />}
      {warn && (
        <div role="alertdialog" aria-modal="true" aria-label="Developer tools detected" className="fixed inset-0 z-[100] grid place-items-center bg-black/85 p-4">
          <div className="card flex w-full max-w-md flex-col gap-3 p-6">
            <h2 className="font-display text-2xl font-extrabold text-amber-200">Developer tools detected</h2>
            <p className="text-sm text-ink-200">This page doesn't allow developer tools while you design. To protect the design and its data, everything has been reset. Please close developer tools and start again.</p>
            <button type="button" className="btn btn-pri self-start" autoFocus onClick={() => setWarn(false)}>OK, start again</button>
          </div>
        </div>
      )}
      {connect && <ConnectPopup from={connectFrom} pass={pass} draft={savedId} a={a} design={design} copy={copy} files={files} host={host} sent={sent} onSent={() => setSent(true)} onClose={() => setConnect(false)} />}
    </div>
  );
}

/** Every answer so far, each one changeable in place (the later answers stay). Questions that shape everything after them (the type, the starting document or link, a file) go back to that question instead. */
function AnswersReview({ rows, a, jump, open, onOpen, onRewind, onSave }: { rows: Step[]; a: Answers; jump: { id: string; n: number } | null; open: boolean; onOpen: (v: boolean) => void; onRewind: (id: string) => void; onSave: (id: string, v: string) => void }) {
  const [edit, setEdit] = useState<string | null>(null), [draft, setDraft] = useState(""), [pick, setPick] = useState<string[]>([]);
  const start = (s: Step) => {
    if (s.type === "file") { onRewind(s.id); return; }
    setEdit(s.id); setDraft(a[s.id] || ""); setPick((a[s.id] || "").split(",").filter(Boolean));
  };
  const save = (s: Step, v: string) => { onSave(s.id, v.trim()); setEdit(null); };
  // An (Edit) link in the preview: open that answer, ready to type.
  useEffect(() => {
    if (!jump) return; const s = rows.find((x) => x.id === jump.id); if (!s) return;
    if (s.type === "file") { setTimeout(() => document.getElementById("answer-" + s.id)?.scrollIntoView({ block: "center", behavior: "smooth" }), 120); return; }
    setEdit(s.id); setDraft(a[s.id] || ""); setPick((a[s.id] || "").split(",").filter(Boolean));
    setTimeout(() => document.getElementById("answer-" + s.id)?.scrollIntoView({ block: "center", behavior: "smooth" }), 120);
  }, [jump?.n]);
  const req = (s: Step) => !(typeof s.optional === "function" ? s.optional(a) : s.optional);
  return (
    <details id="design-answers" open={open} onToggle={(e) => onOpen((e.currentTarget as HTMLDetailsElement).open)} className="group rounded-2xl border border-ink-800 bg-ink-900/50">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-ink-200 marker:hidden [&::-webkit-details-marker]:hidden">
        <span>Your answers</span><span className="chip">{rows.filter((x) => a[x.id]).length}</span>
        <span className="ml-auto text-xs font-normal text-ink-500 group-open:hidden">Review or change</span>
        <span aria-hidden className="text-ink-500 transition group-open:rotate-180">⌄</span>
      </summary>
      <ul className="divide-y divide-ink-800 border-t border-ink-800" aria-label="Your answers so far">
        {rows.map((s) => {
          const on = edit === s.id, opts = s.options?.(a) || [];
          return (
            <li key={s.id} id={"answer-" + s.id} className="flex flex-col gap-2 px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-ink-500">{STEP_LABEL[s.id] || s.id}{(a.docfrom || "").split(",").includes(s.id) && <span className="ml-1.5 text-brand-300" title="Found in your document">✦ from your document</span>}</div>
                  {!on && <div className={`mt-0.5 break-words text-sm ${a[s.id] ? "font-semibold text-ink-100" : "text-ink-500"}`}>{a[s.id] ? sayAnswer(s, a).replace(/\s*\(from your document\)$/, "") : "Skipped"}</div>}
                </div>
                {!on && <button type="button" className="btn btn-sm shrink-0" onClick={() => start(s)} aria-label={`Change your answer to: ${s.ask(a)}`}>{a[s.id] ? "Edit" : "Add"}</button>}
              </div>
              {on && (
                <div className="flex flex-col gap-2">
                  <p className="text-[13px] text-ink-400">{s.ask(a)}</p>
                  {s.type === "choice" && <div className="flex flex-wrap gap-2" role="radiogroup">{opts.map((o) => <button key={o.v} type="button" role="radio" aria-checked={a[s.id] === o.v} onClick={() => save(s, o.v)} className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${a[s.id] === o.v ? "border-brand-400 bg-brand-500/15 text-ink-100" : "border-ink-700 text-ink-300 hover:border-brand-400"}`}>{o.label}</button>)}</div>}
                  {s.type === "many" && <><div className="flex flex-wrap gap-2" role="group">{opts.map((o) => { const sel = pick.includes(o.v); return <button key={o.v} type="button" aria-pressed={sel} onClick={() => setPick((m) => (sel ? m.filter((x) => x !== o.v) : [...m, o.v]))} className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${sel ? "border-brand-400 bg-brand-500/15 text-ink-100" : "border-ink-700 text-ink-300 hover:border-brand-400"}`}>{o.label}</button>; })}</div>
                    <div className="flex gap-2"><button type="button" className="btn btn-pri btn-sm" disabled={!pick.length && req(s)} onClick={() => save(s, pick.join(","))}>Save</button><button type="button" className="btn btn-sm" onClick={() => setEdit(null)}>Cancel</button></div></>}
                  {(s.type === "text" || s.type === "long") && <>
                    {s.type === "long" ? <textarea autoFocus rows={4} className="input text-[14px]" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={s.ph?.(a) || ""} />
                      : <input autoFocus className="input h-10 py-0 text-[14px]" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (draft.trim() || !req(s))) save(s, draft); }} placeholder={s.ph?.(a) || ""} />}
                    {s.type === "long" && <p className="text-xs text-ink-500">One item per line.</p>}
                    <div className="flex gap-2"><button type="button" className="btn btn-pri btn-sm" disabled={!draft.trim() && req(s)} onClick={() => save(s, draft)}>Save</button><button type="button" className="btn btn-sm" onClick={() => setEdit(null)}>Cancel</button></div></>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </details>
  );
}

/** The preview, over the whole screen. */
/** The answers whose words show on the page, so hovering them can offer a pencil that opens the answer. */
const answerHints = (a: Answers, logo = ""): { id: string; text?: string; img?: string }[] => {
  const out: { id: string; text?: string; img?: string }[] = [];
  if (logo && a.logo) out.push({ id: "logo", img: logo });
  for (const id of ["name", "about", "city", "phone", "email", "address", "hours", "social"]) if ((a[id] || "").trim()) out.push({ id, text: a[id].trim() });
  if ((a.story || "").trim()) out.push({ id: "story", text: a.story.trim().slice(0, 90) });
  for (const id of ["items", "usp", "work"]) for (const l of (a[id] || "").split("\n")) { const t = l.split(/\s*(?::|\s[-–—]\s)/)[0].trim(); if (t.length >= 3) out.push({ id, text: t }); }
  return out;
};
export function PreviewPopup({ design, ver, a, onClose, onEdit, onEditLink, onConnect, done, onTweak, build }: { design: Design; ver: number; a: Answers; onClose: () => void; onEdit?: () => void; onEditLink?: (id: string) => void; onConnect?: (from?: DOMRect) => void; done: boolean; onTweak?: (p: Answers) => void; /** The same website in another theme (builds the cards of the carousel). */ build?: (themeId: string) => Promise<Design | null> }) {
  const hints = useMemo(() => answerHints(a, design.content?.brand?.logo?.url || ""), [a, design]);
  const [play, setPlay] = useState(false);
  // Finished: the whole preview is a carousel of the themes that suit the website (the one in use first, at the left); each card is the person's own site in that theme.
  const flow = !!(done && onTweak && build);
  // A phone can't hold several live websites at once (its browser gives up and reloads the page): there only the card in focus is live; its neighbours are light colour cards.
  const lite = useMemo(() => { try { return matchMedia("(max-width: 767px), (pointer: coarse)").matches; } catch { return false; } }, []);
  const first = useRef(design.themeId);
  const akey = JSON.stringify({ ...a, theme: "" });
  const list = useMemo<Theme[]>(() => {
    if (!flow) return [];
    const l = relatedThemes(a), i = l.findIndex((t) => t.id === first.current);
    if (i > 0) return [l[i], ...l.slice(0, i), ...l.slice(i + 1)];
    if (i < 0) { const cur = themeOf(design.kind as LookKind, first.current); if (cur) return [cur, ...l]; }
    return l;
  }, [flow, akey]);
  const [at, setAt] = useState(0);
  const [built, setBuilt] = useState<Record<string, Design>>({});
  const seen = useRef(new Set<string>());
  useEffect(() => { if (!a.theme) { const i = list.findIndex((t) => t.id === design.themeId); if (i >= 0) setAt(i); } }, [a.theme]);
  useEffect(() => {
    if (!flow || !build) return;
    for (const d of lite ? [0] : [0, 1, -1]) {
      const t = list[at + d], key = t ? akey + t.id : ""; if (!t || seen.current.has(key)) continue;
      seen.current.add(key);
      build(t.id).then((x) => { if (x) setBuilt((b) => ({ ...b, [key]: x })); else seen.current.delete(key); }).catch(() => seen.current.delete(key));
    }
  }, [flow, at, akey, list]);
  // On a phone the old live page is let go before the next one starts, so two never sit in memory together.
  const [settled, setSettled] = useState(true);
  useEffect(() => { if (!lite) return; setSettled(false); const t = setTimeout(() => setSettled(true), 350); return () => clearTimeout(t); }, [at, lite]);
  const go = (n: number) => { const i = Math.max(0, Math.min(list.length - 1, n)); if (i === at || !list[i]) return; setAt(i); onTweak?.({ theme: list[i].id }); };
  useEffect(() => {
    if (!flow) return;
    const k = (e: KeyboardEvent) => { if ((e.target as HTMLElement)?.closest?.("input,textarea,select")) return; if (e.key === "ArrowRight") go(at + 1); else if (e.key === "ArrowLeft") go(at - 1); };
    addEventListener("keydown", k); return () => removeEventListener("keydown", k);
  }, [flow, at, list]);
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
          {onTweak && <button type="button" className={`btn btn-sm play-btn !border-0 ${play ? "ring-2 ring-white/70" : ""}`} aria-pressed={play} onClick={() => setPlay((v) => !v)}><span className="max-sm:hidden">Play with your design</span><span className="sm:hidden">Customise</span></button>}
          {onEdit && <button type="button" className="btn btn-sm" onClick={onEdit}>Edit answers</button>}
          <button type="button" className="btn btn-sm" onClick={onClose} autoFocus>{done ? "Close" : "Back"}</button>
        </span>
      </div>
      <div className="relative flex min-h-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {flow && list.length > 1 ? (<>
            <div className="relative min-h-0 flex-1 overflow-hidden" role="group" aria-roledescription="carousel" aria-label="Themes that suit your website">
              {list.map((t, i) => {
                const d = i - at; if (Math.abs(d) > 1) return null;
                const dd = built[akey + t.id] || (t.id === design.themeId ? design : null);
                return (
                  <div key={t.id} role="group" aria-roledescription="slide" aria-label={`${t.name}, ${i + 1} of ${list.length}`} className="absolute bottom-2 top-2 flex flex-col overflow-hidden rounded-2xl border border-ink-600 bg-ink-950 shadow-2xl transition-all duration-300 ease-out"
                    style={{ left: "50%", width: "min(78%, 1180px)", transform: `translateX(calc(-50% + ${d * 42}%)) scale(${d ? 0.86 : 1})`, zIndex: d ? 1 : 2, filter: d ? "brightness(.6)" : undefined }}>
                    {d !== 0 && lite ? <div className="flex min-h-0 flex-1 flex-col gap-3 p-4" style={{ background: t.colors.bg, color: t.colors.text }} aria-hidden><span className="h-3 w-1/3 rounded-full" style={{ background: t.colors.c1 }} /><span className="h-6 w-4/5 rounded-full" style={{ background: t.colors.text }} /><span className="h-6 w-3/5 rounded-full" style={{ background: t.colors.text }} /><span className="mt-2 h-8 w-28 rounded-full" style={{ background: t.colors.c1 }} /><b className="mt-auto text-sm">{t.name}</b></div> : dd && settled ? <Preview key={t.id} lite={lite} tpl={TEMPLATES[design.kind]} base={`templates/${design.kind}/`} content={dd.content} version={ver} assets={{}} editable={false} hidePages onEditLink={d ? undefined : onEditLink} hints={hints} /> : <div className="grid min-h-0 flex-1 place-items-center"><Spinner /></div>}
                    {d !== 0 && <button type="button" aria-label={`Show ${t.name}`} className="absolute inset-0 z-10 cursor-pointer" onClick={() => go(i)} />}
                  </div>
                );
              })}
              {onConnect && <button type="button" onClick={(e) => onConnect(e.currentTarget.getBoundingClientRect())} className="btn btn-pri absolute bottom-6 left-1/2 z-[5] -translate-x-1/2 whitespace-nowrap rounded-full px-10 py-4 text-base font-extrabold shadow-2xl shadow-black/50 ring-4 ring-brand-400/25">Connect with Picaffectz</button>}
            </div>
            <div className="flex flex-none items-center justify-center gap-3 border-t border-ink-700 bg-ink-900 px-3 py-2 text-[13px]">
              <button type="button" className="btn btn-sm" aria-label="Previous theme" disabled={at === 0} onClick={() => go(at - 1)}>‹</button>
              <span className="flex min-w-0 items-center gap-2"><b className="truncate">{list[at]?.name}</b><span className="font-mono text-ink-400">{list[at] ? themeCode(list[at]) : ""}</span><span className="rounded border border-ink-600 px-1.5 py-px text-[11px] text-ink-300">{list[at]?.dark ? "Dark" : "Light"}</span><span className="text-ink-500">{at + 1} of {list.length}</span></span>
              <button type="button" className="btn btn-sm" aria-label="Next theme" disabled={at >= list.length - 1} onClick={() => go(at + 1)}>›</button>
            </div>
          </>) : (
            <div className="relative flex min-h-0 flex-1 flex-col"><Preview key={design.kind} tpl={TEMPLATES[design.kind]} base={`templates/${design.kind}/`} content={design.content} version={ver} assets={{}} editable={false} note="Please note that this is just a preview to help you select a theme. Both the theme and the actual development can be customized to fit your specific requirements." hidePages onEditLink={onEditLink} hints={hints} />
              {onConnect && <button type="button" onClick={(e) => onConnect(e.currentTarget.getBoundingClientRect())} className="btn btn-pri absolute bottom-6 left-1/2 z-[5] -translate-x-1/2 whitespace-nowrap rounded-full px-10 py-4 text-base font-extrabold shadow-2xl shadow-black/50 ring-4 ring-brand-400/25">Connect with Picaffectz</button>}
            </div>
          )}
        </div>
        {play && onTweak && <Tweaks a={a} design={design} onTweak={onTweak} onClose={() => setPlay(false)} />}
      </div>
    </div>
  );
}

/** A foldable group of controls in the customise panel. */
function Group({ title, note, open, children }: { title: string; note?: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details open={open} className="group rounded-2xl border border-ink-700 bg-ink-800/40">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-[13px] font-bold tracking-wide text-ink-100 [&::-webkit-details-marker]:hidden">
        {title}<span aria-hidden className="ml-auto text-ink-500 transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="flex flex-col gap-3.5 border-t border-ink-700/70 px-4 pb-4 pt-3.5">{note && <p className="text-[12px] leading-snug text-ink-400">{note}</p>}{children}</div>
    </details>
  );
}
const fieldLabel = "text-[12px] font-semibold text-ink-300";

/** "Play with your design": the colours, layouts, style and interactions of the chosen type, changed live. What is offered here is set in the Studio's Settings → Design yourself. */
function Tweaks({ a, design, onTweak, onClose }: { a: Answers; design: Design; onTweak: (p: Answers) => void; onClose: () => void }) {
  const kind = design.kind as LookKind;
  const settings = useMemo(readDesignSettings, [a.kind]);
  const axes = visibleAxes(kind, settings);
  const picks = readLookAnswer(a.look), own = readColsAnswer(a.cols);
  const baseTheme = themeOf(kind, design.themeId) || themesFor(design.kind)[0];
  const shown = tweakTheme(baseTheme, a).colors as Record<string, string>;
  const setCols = (c: Record<string, string>) => onTweak({ cols: Object.keys(c).length ? JSON.stringify(c) : "" });
  const changed = ["theme", "cols", "look"].some((x) => a[x]);
  const pagesAxis = axes.find((x) => x.axis.key === "pages");
  const grouped = GROUPS.map((g) => ({ g, rows: axes.filter((x) => x.group === g) })).filter((x) => x.rows.length);
  const pick = (axis: (typeof axes)[number]) => {
    const cur = picks[axis.axis.key] ?? axis.def ?? "";
    return (
      <label key={axis.axis.key} className="flex flex-col gap-1.5" title={"Shapes: " + axis.forAnswer}><span className={fieldLabel}>{axis.axis.label}</span>
        <select className="input h-10 py-0 text-[13px]" value={cur || "-"} onChange={(e) => onTweak({ look: JSON.stringify({ ...picks, [axis.axis.key]: e.target.value }) })}>
          <option value="-">Theme's own</option>
          {axis.axis.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
    );
  };
  return (
    <aside aria-label="Play with your design" className="z-10 flex flex-col gap-3 overflow-y-auto border-ink-700 bg-ink-900 p-4 max-md:absolute max-md:inset-x-0 max-md:bottom-0 max-md:max-h-[62%] max-md:border-t md:w-[360px] md:flex-none md:border-l">
      <div className="flex items-start gap-2"><div className="min-w-0"><b className="text-[16px]">Play with your design</b><p className="mt-0.5 text-[12px] leading-snug text-ink-400">Try other looks for your {TEMPLATES[design.kind].name.toLowerCase()}. The preview changes as you tap.</p></div><button type="button" className="btn btn-ghost btn-sm ml-auto shrink-0" onClick={onClose} aria-label="Close this panel">✕</button></div>

      <Group title="Colours" open>
        {settings.pick !== false && <div className="flex flex-col gap-2"><span className={fieldLabel}>Each colour</span>
          <div className="grid grid-cols-3 gap-x-2.5 gap-y-3">
            {COLOUR_SLOTS.map(([k, label]) => (
              <label key={k} className="flex flex-col gap-1.5 text-[11px] leading-tight text-ink-400"><span className="min-h-[2.4em]">{label}</span>
                <input type="color" aria-label={label} className="h-9 w-full cursor-pointer rounded-lg border border-ink-600 bg-transparent p-0.5" value={/^#[0-9a-f]{6}$/i.test(shown[k] || "") ? shown[k] : "#888888"} onChange={(e) => setCols({ ...own, [k]: e.target.value })} />
              </label>
            ))}
          </div></div>}
        {Object.keys(own).length > 0 && <button type="button" className="btn btn-sm self-start" onClick={() => onTweak({ cols: "" })}>Back to the theme's colours</button>}
      </Group>

      {grouped.map(({ g, rows }, i) => (
        <Group key={g} title={g === "Layout" ? "Navigation style" : g} open={g === "Layout"} note={g === "Intro screen" ? "Shown while the site opens, when an intro is switched on." : undefined}>
          {g === "Layout" && pagesAxis && (
            <div className="flex flex-col gap-1.5"><span className={fieldLabel}>Pages</span>
              <div className="grid grid-cols-2 gap-1 rounded-xl border border-ink-600 p-1" role="radiogroup" aria-label="Pages">
                {([["single", "One page"], ["multi", "Separate pages"]] as const).filter(([v]) => pagesAxis.axis.options.some(([o]) => o === v)).map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={pagesChoice(kind, a.pages, settings) === v} onClick={() => onTweak({ pages: v })} className={`h-8 rounded-lg text-[13px] font-semibold ${(a.pages || "single") === v ? "bg-ink-700 text-ink-100" : "text-ink-400 hover:text-ink-100"}`}>{l}</button>)}
              </div>
            </div>
          )}
          {rows.filter((x) => x.axis.key !== "pages").map(pick)}
        </Group>
      ))}


      <div className="flex flex-wrap items-center gap-2 pb-1">
        {changed && <button type="button" className="btn btn-sm" onClick={() => onTweak({ theme: "", cols: "", look: "" })}>Back to my first design</button>}
        <p className="text-[12px] text-ink-500">Your changes are kept with your request when you connect with us.</p>
      </div>
    </aside>
  );
}

/** Send the request: it is saved in the Studio's own database and emailed to its owners. */
export function ConnectPopup({ a, design, copy, files, host, sent, onSent, onClose, from, pass: given, draft }: { /** The email already confirmed on this page: nothing more to confirm here. */ pass?: Pass | null; draft?: string; a: Answers; design: Design | null; copy: Copy | null; files: DesignFiles; host: DesignHost | null; sent: boolean; onSent: () => void; onClose: () => void; /** Where the Connect button was: the form grows out of it. */ from?: DOMRect | null }) {
  const toast = useToast();
  const [f, setF] = useState({ person: "", phone: a.phone || "", email: given?.email || a.email || "", note: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(sent);
  // Email: confirmed with a code sent to it. `pass` is what the request carries once that is done.
  const [pass, setPass] = useState<{ email: string; otp?: string; skip?: string } | null>(passLive(given ?? null) ? given! : null), [asked, setAsked] = useState(false), [code, setCode] = useState(""), [wait, setWait] = useState(0), [okMail, setOkMail] = useState(true);
  const mail = f.email.trim().toLowerCase(), verified = !!pass && pass.email === mail;
  useEffect(() => { if (wait <= 0) return; const t = setTimeout(() => setWait((w) => w - 1), 1000); return () => clearTimeout(t); }, [wait]);
  const msg = useMemo(() => requestText(a, design), [a, design]);
  // The form grows out of the Connect button: it starts where the button is, the same size and shape, and expands to its place.
  const card = useRef<HTMLDivElement>(null), [grown, setGrown] = useState(!from || matchMedia("(prefers-reduced-motion: reduce)").matches);
  useLayoutEffect(() => {
    const el = card.current; if (!el || grown || !from) return;
    const r = el.getBoundingClientRect();
    el.style.transformOrigin = "top left"; el.style.transition = "none"; el.style.borderRadius = "9999px"; el.style.overflow = "hidden";
    el.style.transform = `translate(${from.left - r.left}px, ${from.top - r.top}px) scale(${Math.max(0.05, from.width / r.width)}, ${Math.max(0.05, from.height / r.height)})`;
    el.getBoundingClientRect();
    requestAnimationFrame(() => { el.style.transition = "transform .55s cubic-bezier(.2,.8,.2,1), border-radius .55s ease, opacity .3s"; el.style.transform = "none"; el.style.borderRadius = ""; setGrown(true); setTimeout(() => { el.style.overflow = ""; el.style.transition = ""; }, 600); });
  }, []);
  const askCode = async () => {
    if (!host) return; if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return toast("Enter a valid email address.", "bad");
    setBusy(true);
    try {
      const r = await otpSend(host, mail);
      if (r.skip) { setPass({ email: mail, skip: r.skip }); setOkMail(false); toast("We couldn't email a code from here, so your email is accepted without one."); }
      else { setAsked(true); setWait(45); toast("Code sent. Check your email (and spam)."); }
    } catch (e: any) { toast(e?.message || "Couldn't send the code.", "bad"); }
    setBusy(false);
  };
  const checkCode = async () => {
    if (!host || code.trim().length < 6) return; setBusy(true);
    try { const r = await otpCheck(host, mail, code.trim()); setPass({ email: mail, otp: r.token }); setOkMail(true); }
    catch (e: any) { toast(e?.message || "That code isn't right.", "bad"); }
    setBusy(false);
  };
  const send = async () => {
    if (!host) return;
    if (!f.person.trim()) return toast("Please tell us your name.", "bad");
    if (!mail) return toast("Please give your email address.", "bad");
    if (!verified || !pass) return toast("Please confirm your email with the code we send you.", "bad");
    setBusy(true);
    try {
      await submitQuery(host, { ...(draft ? { draft } : {}), ...(pass.otp ? { otp: pass.otp } : { skip: pass.skip }), kind: a.kind, name: a.name || "Untitled", person: f.person.trim(), phone: f.phone.trim(), email: f.email.trim(), note: f.note.trim(), answers: { ...a, ...(design?.themeId ? { themeid: design.themeId } : {}), ...(a.kind ? { look: resolvedLook(a.kind as LookKind, a.look, readDesignSettings()) } : {}) }, ...(copy ? { copy } : {}), ...(files.logo ? { logo: files.logo } : {}), ...(files.menu ? { pdf: files.menu } : {}), ...(files.pics && Object.keys(files.pics).length ? { pics: files.pics } : {}) });
      setDone(true); onSent();
    } catch (e: any) { toast(e?.message || "Couldn't send. Please try again.", "bad"); }
    setBusy(false);
  };
  const copyIt = async () => { try { await navigator.clipboard.writeText(msg); toast("Details copied"); } catch { prompt("Copy these details:", msg); } };
  return (
    <div role="dialog" aria-modal="true" aria-label="Connect with Picaffectz" className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4" onClick={onClose}>
      <div ref={card} className="card flex max-h-[90vh] w-full max-w-lg flex-col gap-4 overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
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
              <label className="flex flex-col gap-1.5"><span className="label">Phone or WhatsApp (optional)</span><input className="input" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
              <div className="flex flex-col gap-1.5"><label className="label" htmlFor="cp-email">Email (required)</label>
                <div className="flex gap-2"><input id="cp-email" className="input min-w-0 flex-1" type="email" autoComplete="email" required readOnly={!!given} value={f.email} onChange={(e) => { setF({ ...f, email: e.target.value }); setAsked(false); setCode(""); }} />
                  {verified ? <span className="chip shrink-0 self-center border-emerald-400/60 text-emerald-200">{okMail ? "Verified ✓" : "Accepted ✓"}</span> : <button type="button" className="btn btn-sm shrink-0 self-center" disabled={busy || (asked && wait > 0) || !mail} onClick={askCode}>{asked ? (wait > 0 ? `Resend (${wait})` : "Resend code") : "Send code"}</button>}</div>
              </div>
              {asked && !verified && <div className="flex flex-col gap-1.5 sm:col-span-2"><label className="label" htmlFor="cp-code">The 6-digit code we emailed you</label>
                <div className="flex gap-2"><input id="cp-code" className="input max-w-[11rem] font-mono text-lg tracking-widest" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} onKeyDown={(e) => { if (e.key === "Enter") checkCode(); }} />
                  <button type="button" className="btn btn-pri btn-sm" disabled={busy || code.length < 6} onClick={checkCode}>Verify</button></div></div>}
              <label className="flex flex-col gap-1.5 sm:col-span-2"><span className="label">Anything else we should know? (optional)</span><textarea className="input min-h-[70px]" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
            </div>
            <div className="flex flex-wrap gap-2"><button type="button" className="btn btn-pri" disabled={busy || !verified} onClick={send} title={verified ? "" : "Confirm your email first"}>{busy ? "Working…" : "Send to Picaffectz"}</button><button type="button" className="btn btn-ghost" onClick={onClose}>Not now</button></div>
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

/** Design yourself starts here: the visitor's email, confirmed with a code, before any question. */
function EmailGate({ host, onPass }: { host: DesignHost; onPass: (p: Pass) => void }) {
  const toast = useToast();
  const [email, setEmail] = useState(""), [code, setCode] = useState(""), [asked, setAsked] = useState(false), [wait, setWait] = useState(0), [busy, setBusy] = useState(false);
  const mail = email.trim().toLowerCase();
  useEffect(() => { if (wait <= 0) return; const t = setTimeout(() => setWait((w) => w - 1), 1000); return () => clearTimeout(t); }, [wait]);
  const ask = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return toast("Enter a valid email address.", "bad");
    setBusy(true);
    try {
      const r = await otpSend(host, mail);
      if (r.skip) { onPass({ email: mail, skip: r.skip }); toast("We couldn't email a code from here, so your email is accepted without one."); }
      else { setAsked(true); setWait(45); toast("Code sent. Check your email (and spam)."); }
    } catch (x: any) { toast(x?.message || "Couldn't send the code.", "bad"); }
    setBusy(false);
  };
  const check = async (e?: React.FormEvent) => {
    e?.preventDefault(); if (code.trim().length < 6) return; setBusy(true);
    try { const r = await otpCheck(host, mail, code.trim()); onPass({ email: mail, otp: r.token }); }
    catch (x: any) { toast(x?.message || "That code isn't right.", "bad"); }
    setBusy(false);
  };
  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-5 text-center" aria-live="polite">
      <div>
        <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">Design your own website</h1>
        <p className="mx-auto mt-3 max-w-xl text-ink-300">First, your email: we send a code to confirm it. Then answer a few simple questions and watch your website take shape.</p>
      </div>
      <form className="card flex flex-col gap-3 p-5 text-left" onSubmit={asked ? check : ask}>
        <label className="label" htmlFor="eg-email">Your email</label>
        <input id="eg-email" className="input" type="email" autoComplete="email" autoFocus required readOnly={asked} value={email} onChange={(e) => setEmail(e.target.value)} />
        {asked && <>
          <label className="label" htmlFor="eg-code">The 6-digit code we emailed you</label>
          <input id="eg-code" className="input font-mono text-lg tracking-widest" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
        </>}
        <div className="flex flex-wrap gap-2">
          {asked
            ? <><button type="submit" className="btn btn-pri" disabled={busy || code.length < 6}>{busy ? "Checking…" : "Verify and start"}</button>
              <button type="button" className="btn btn-ghost" disabled={busy || wait > 0} onClick={() => ask()}>{wait > 0 ? `Resend (${wait})` : "Resend code"}</button>
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => { setAsked(false); setCode(""); }}>Use another email</button></>
            : <button type="submit" className="btn btn-pri" disabled={busy || !mail}>{busy ? "Sending…" : "Send code"}</button>}
        </div>
        <p className="text-xs text-ink-500">We use it only to keep your design and to get back to you.</p>
      </form>
    </section>
  );
}
