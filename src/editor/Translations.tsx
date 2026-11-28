// Languages → Translations: every piece of the site's text beside its translation, one language at a time. "Translate
// what's missing" fills the gaps with Workers AI on the database; every translation stays editable by hand.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { siteTexts, LANG_NAMES } from "../schema/common";
import { jobState, onJob, pending, translateInBackground, untouched } from "../lib/translatejob";
import { ProgressBar } from "../ui/kit";

const norm = (s: string) => String(s).replace(/\s+/g, " ").trim();
/** The parts a text is drawn in when it carries *emphasis* marks or line breaks: "I build *useful things* daily" is
 *  three text nodes on the page. They belong to that text, not to the page's fixed wording. */
function piecesOf(known: Set<string>): Set<string> {
  const out = new Set<string>();
  for (const k of known) { if (!/[*_`\n]/.test(k)) continue; for (const part of k.split(/\*+|_+|`+|\n+/)) { const t = norm(part); if (t && t !== k) out.add(t); } }
  return out;
}
/** The page's fixed wording (buttons, labels the template writes itself): text in the preview that isn't content. */
export function harvest(known: Set<string>): string[] {
  const doc = (document.querySelector('iframe[name="cms-preview"]') as HTMLIFrameElement | null)?.contentDocument; if (!doc?.body) return [];
  // A piece of one of the site's own texts (the words inside *emphasis*, one line of a heading) isn't fixed wording:
  // translating it on its own would mix two languages in one sentence.
  const pieces = piecesOf(known);
  const out = new Set<string>(), take = (s: string | null) => { const t = norm(s || ""); if (t.length >= 2 && t.length <= 90 && /\p{L}{2}/u.test(t) && !/^https?:|@\w+\.\w|^[\d\s.,:+₹$%-]+$/.test(t) && !known.has(t) && !pieces.has(t)) out.add(t); };
  const w = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT); let n: Node | null;
  while ((n = w.nextNode())) { const p = n.parentElement; if (!p || /^(SCRIPT|STYLE|NOSCRIPT|OPTION|TEXTAREA)$/.test(p.nodeName) || p.closest(".sl-sw,#site-consent,#site-maint,[data-no-translate],.sm-flag,.sc-flag")) continue; take(n.nodeValue); }
  doc.querySelectorAll("[placeholder],[aria-label]").forEach((el) => { if (!el.closest(".sl-sw,#site-consent")) { take(el.getAttribute("placeholder")); take(el.getAttribute("aria-label")); } });
  return [...out].slice(0, 400);
}

export function Translations({ root, bump }: { root: any; bump: () => void }) {
  const n = root.i18n || {}, langs: { code: string; name: string }[] = (n.langs || []).filter((l: any) => l && l.on !== false);
  const [lang, setLangState] = useState<string>(() => (langs.some((l) => l.code === n.preview) ? n.preview : langs[0]?.code || ""));
  const [only, setOnly] = useState<"all" | "missing" | "kept">("all"), [find, setFind] = useState(""), [shown, setShown] = useState(40);
  const [sure, setSure] = useState(false);
  const [reading, setReading] = useState(false);
  // A language that was just switched on becomes the one being worked on.
  const codes = langs.map((l) => l.code).join(","), before = useRef(codes);
  useEffect(() => {
    const was = before.current ? before.current.split(",") : [], fresh = langs.find((l) => !was.includes(l.code)); before.current = codes;
    if (fresh) setLangState(fresh.code); else if (!langs.some((l) => l.code === lang)) setLangState(langs[0]?.code || "");
  }, [codes]);
  // The preview shows the language being worked on, and goes back to the site's own when this section closes.
  useEffect(() => { if (root.i18n && lang && root.i18n.preview !== lang) { root.i18n.preview = lang; bump(); } }, [lang, root]);
  useEffect(() => () => { if (root.i18n?.preview) { root.i18n.preview = ""; bump(); } }, [root]);
  // A language with nothing translated yet is translated straight away (once), so switching one on is all it takes.
  // (These hooks sit above the "no language yet" return, so the number of hooks never changes.)
  const auto = useRef(new Set<string>()), go = useRef<null | ((again: boolean) => void)>(null);
  useEffect(() => {
    if (!lang || auto.current.has(lang)) return;
    auto.current.add(lang);
    if (Object.keys(root.i18n?.t?.[lang] || {}).length) return;
    const t = setTimeout(() => { go.current?.(false); }, 600); const timer: any = 0; // after the preview has drawn, so its buttons and labels are read too
    return () => { clearTimeout(t); clearTimeout(timer); auto.current.delete(lang); };
  }, [lang]);
  const all = (() => { const seen = new Set<string>(), out: string[] = []; for (const s of [...siteTexts(root), ...((n.ui as string[]) || [])]) { const k = norm(s); if (k && !seen.has(k)) { seen.add(k); out.push(s); } } return out; })();
  const dict: Record<string, string> = lang && root.i18n ? ((root.i18n.t ||= {})[lang] ||= {}) : {};
  const get = (s: string) => dict[s] ?? dict[norm(s)] ?? "";
  const put = (s: string, v: string) => { if (v.trim()) dict[s] = v; else { delete dict[s]; delete dict[norm(s)]; } bump(); };
  const missing = all.filter((s) => !get(s).trim());
  const setLang = (c: string) => { setLangState(c); root.i18n.preview = c; bump(); };
  const kept = all.filter((s) => get(s).trim() && untouched(s, get(s), lang));
  const list = all.filter((s) => (only === "all" || (only === "kept" ? kept.includes(s) : !get(s).trim())) && (!find.trim() || (s + " " + get(s)).toLowerCase().includes(find.trim().toLowerCase())));
  const name = LANG_NAMES[lang]?.[1] || lang;
  // A language reaches visitors once everything is translated (ready). It then stays, so text added later shows as
  // "Not translated" here without taking the language off the site.
  const texts = all.filter((x) => norm(x) && /\p{L}/u.test(x));
  const left = (code: string) => { const d2 = root.i18n?.t?.[code] || {}; return texts.filter((x) => !(d2[x] ?? d2[norm(x)] ?? "").trim()).length; };
  const entry = (root.i18n?.langs || []).find((l: any) => l && l.code === lang), ready = entry?.ready !== false;
  useEffect(() => {
    let changed = false;
    for (const l of (root.i18n?.langs || []) as any[]) {
      if (!l || l.on === false || l.ready === true) continue;
      const now = texts.length > 0 && left(l.code) === 0;
      if (l.ready !== now) { l.ready = now; changed = true; }
    }
    if (changed) bump();
  });

  // The job itself runs in the background (src/lib/translatejob.ts): it carries on when this section is closed.
  const job = useSyncExternalStore(onJob, jobState);
  const mine = job.running && job.lang === lang, queued = job.queue.includes(lang), busy = reading || mine || queued;
  const translate = async (again: boolean) => {
    if (reading || mine || queued) return;
    setReading(true);
    try {
      // The page's own buttons and labels are read from the preview, shown in the site's own language for a moment.
      const was = root.i18n.preview; root.i18n.preview = ""; bump(); await new Promise((r) => setTimeout(r, 900));
      const known = new Set(siteTexts(root).map(norm)), extra = harvest(known);
      // Pieces of the site's own texts that an earlier pass listed as wording are dropped (see harvest).
      const pieces = piecesOf(known), keep = ((root.i18n.ui as string[]) || []).filter((u) => !pieces.has(norm(u)));
      root.i18n.ui = [...new Set([...keep, ...extra])].slice(0, 600);
      for (const t of Object.values(root.i18n.t || {}) as Record<string, string>[]) for (const k of Object.keys(t || {})) if (!known.has(norm(k)) && pieces.has(norm(k))) delete t[k];
      root.i18n.preview = was || lang; bump();
    } finally { setReading(false); }
    translateInBackground({ root, lang, name, from: root.i18n.base?.name || "English", again, bump, texts: () => [...siteTexts(root), ...((root.i18n.ui as string[]) || [])] });
  };
  const result = job.last[lang], toDo = pending(root, lang, all, false).length;

  go.current = translate;

  if (!langs.length) return <p className="rounded-lg border border-ink-700 bg-ink-850 px-3 py-2.5 text-[13px] text-ink-300">Switch on at least one language above to translate the site.</p>;
  return (
    <div className="flex flex-col gap-3" aria-label="Translations">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1"><span className="label">Language</span>
          <select className="input py-1.5" aria-label="Language to translate" value={lang} onChange={(e) => setLang(e.target.value)}>{langs.map((l) => <option key={l.code} value={l.code}>{l.name} ({LANG_NAMES[l.code]?.[1] || l.code})</option>)}</select></label>
        <button type="button" className="btn btn-pri" disabled={busy || !toDo} onClick={() => translate(false)}>{mine || reading ? "Working…" : queued ? "Waiting its turn…" : `Translate what's missing (${toDo})`}</button>
        {all.length > missing.length && <button type="button" className="btn" disabled={busy} onClick={() => { if (sure) { setSure(false); translate(true); } else setSure(true); }} onBlur={() => setSure(false)}>{sure ? "Replace my edits in this language? Press again" : "Translate all again"}</button>}
      </div>
      {reading && <ProgressBar value={null} label={`Translating into ${name}`} detail="Reading the page's wording…" />}
      {job.running && <ProgressBar value={job.total ? (job.done / job.total) * 100 : null} label={`Translating into ${job.name}`} detail={`${job.phase}${job.total ? `: ${job.done} of ${job.total}` : ""}…${job.queue.length ? ` Then: ${job.queue.map((c) => LANG_NAMES[c]?.[1] || c).join(", ")}.` : ""}`} />}
      {job.running && <p className="text-[13px] text-ink-400">This carries on in the background: you can keep editing other sections, and come back here to see how far it is.</p>}
      {!mine && result && <p role={result.ok ? "status" : "alert"} className={`rounded-lg border px-3 py-2 text-[13px] ${result.ok ? "border-emerald-400/30 bg-emerald-400/5 text-emerald-100" : "border-red-400/40 bg-red-400/5 text-red-200"}`}>{result.text}</p>}
      {!mine && <div aria-label="Language status" className={`rounded-lg border px-3 py-2 text-[13px] ${ready ? "border-emerald-400/30 bg-emerald-400/5 text-emerald-100" : "border-amber-400/40 bg-amber-400/5 text-amber-100"}`}>
        {ready ? <>{name} is fully translated and shows in the site's language switcher{missing.length ? `. ${missing.length} newer text${missing.length === 1 ? " is" : "s are"} not translated yet and show in the site's own language.` : "."}</>
          : <>{name} is not shown to visitors yet: {left(lang)} text{left(lang) === 1 ? "" : "s"} still to translate. It appears in the site's switcher by itself once everything is translated.</>}
        {!ready && <span className="mt-1.5 block"><ProgressBar value={texts.length ? ((texts.length - left(lang)) / texts.length) * 100 : 0} label={`${name} translated`} /></span>}
      </div>}
      <p className="text-[13px] text-ink-400">{all.length - missing.length} of {all.length} texts are in {name}. A text without a translation shows in the site's own language. The preview shows {name} while you work here.</p>
      <div className="flex flex-wrap items-center gap-2">
        <input className="input min-w-0 flex-1 py-1.5" type="search" aria-label="Find a text" placeholder="Find a text…" value={find} onChange={(e) => { setFind(e.target.value); setShown(40); }} />
        <div className="flex overflow-hidden rounded-lg border border-ink-600 text-[13px]" role="group" aria-label="Which texts">
          {(["all", "missing", ...(kept.length ? ["kept" as const] : [])] as const).map((k) => <button key={k} type="button" aria-pressed={only === k} className={`px-3 py-1.5 ${only === k ? "bg-ink-700 text-ink-100" : "text-ink-300"}`} onClick={() => { setOnly(k); setShown(40); }}>{k === "all" ? `All (${all.length})` : k === "kept" ? `Still in ${root.i18n?.base?.name || "English"} (${kept.length})` : `Not translated (${missing.length})`}</button>)}
        </div>
      </div>
      <ul className="flex flex-col divide-y divide-ink-700 rounded-lg border border-ink-700">
        {list.slice(0, shown).map((s) => (
          <li key={s} className="grid gap-2 p-2.5 sm:grid-cols-2">
            <p className="whitespace-pre-wrap break-words text-[13px] text-ink-300">{s}</p>
            <textarea className="input min-h-[38px] py-1.5 text-[13.5px]" lang={lang} rows={Math.min(6, Math.max(1, Math.ceil(s.length / 46)))} aria-label={`${name} for: ${s.slice(0, 60)}`} placeholder={`In ${name}`} value={get(s)} onChange={(e) => put(s, e.target.value)} />
          </li>
        ))}
        {!list.length && <li className="p-3 text-[13px] text-ink-400">{find.trim() ? "No text matches." : "Nothing left to translate."}</li>}
      </ul>
      {list.length > shown && <button type="button" className="btn btn-sm self-start" onClick={() => setShown(shown + 60)}>Show more ({list.length - shown} left)</button>}
    </div>
  );
}

/** Languages → Fixed words: the words the page writes itself (buttons, small headings, messages) in the owner's own
 *  words. Read from the preview; a word that only shows later (a form's thank-you or error line) can be typed in. */
export function SiteWords({ root, bump }: { root: any; bump: () => void }) {
  const [busy, setBusy] = useState(false), [find, setFind] = useState(""), [add, setAdd] = useState(""), [shown, setShown] = useState(40);
  const words: Record<string, string> = root.words && typeof root.words === "object" ? root.words : {};
  const list: string[] = Array.isArray(root.wordsList) ? root.wordsList : [];
  const all = [...new Set([...list, ...Object.keys(words)])];
  const rows = all.filter((s) => !find.trim() || (s + " " + (words[s] || "")).toLowerCase().includes(find.trim().toLowerCase()));
  const put = (s: string, v: string) => { root.words = { ...(root.words || {}) }; if (v.trim()) root.words[s] = v; else delete root.words[s]; if (!Object.keys(root.words).length) delete root.words; bump(); };
  const read = async () => {
    setBusy(true);
    try {
      const was = root.i18n?.preview; if (root.i18n) { root.i18n.preview = ""; bump(); }
      // The page shows its standard words while they are read (the owner's own are put back after).
      const keep = root.words; delete root.words; bump(); await new Promise((r) => setTimeout(r, 1000));
      // Initials on avatars and lines built from the owner's own text (a client's name with its industry) are content, not fixed words.
      const known = new Set(siteTexts(root).map(norm)), long = [...known].filter((k) => k.length >= 4);
      const found = harvest(known).filter((t) => !/^[A-Z]{1,3}$/.test(t) && !long.some((k) => t.includes(k)));
      if (keep) root.words = keep; if (root.i18n && was) root.i18n.preview = was;
      root.wordsList = [...new Set([...list.filter((x) => !known.has(norm(x))), ...found])].slice(0, 500); bump();
    } finally { setBusy(false); }
  };
  const addOne = () => { const t = norm(add); if (!t) return; root.wordsList = [...new Set([...list, t])]; setAdd(""); bump(); };
  return (
    <div className="flex flex-col gap-3" aria-label="Fixed words">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-pri" disabled={busy} onClick={read}>{busy ? "Reading the page…" : list.length ? "Read the page again" : "Find the page's fixed words"}</button>
        <span className="text-[12.5px] text-ink-400">{all.length ? `${all.length} words and lines · ${Object.keys(words).length} changed` : "Reads the words on the page shown in the preview. Open another page in the preview and read again to add its words."}</span>
      </div>
      {all.length > 0 && <input className="input py-1.5" type="search" aria-label="Find a word" placeholder="Find a word…" value={find} onChange={(e) => { setFind(e.target.value); setShown(40); }} />}
      {rows.length > 0 && <ul className="flex flex-col divide-y divide-ink-700 rounded-lg border border-ink-700">
        {rows.slice(0, shown).map((s) => (
          <li key={s} className="grid items-center gap-2 p-2.5 sm:grid-cols-2">
            <p className="break-words text-[13px] text-ink-300">{s}</p>
            <input className="input py-1.5 text-[13.5px]" aria-label={`Your words for: ${s.slice(0, 60)}`} placeholder={s} value={words[s] || ""} onChange={(e) => put(s, e.target.value)} />
          </li>))}
      </ul>}
      {rows.length > shown && <button type="button" className="btn btn-sm self-start" onClick={() => setShown(shown + 60)}>Show more</button>}
      <div className="flex flex-wrap items-center gap-2">
        <input className="input min-w-0 flex-1 py-1.5" aria-label="A fixed word to change" placeholder="A word that shows only sometimes, exactly as on the page (e.g. Please fill in the required fields.)" value={add} onChange={(e) => setAdd(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOne(); } }} />
        <button type="button" className="btn btn-sm" disabled={!norm(add)} onClick={addOne}>Add</button>
      </div>
      <p className="hint">Leave a box empty to keep the page's own word. Your words show in every language, unless that language has its own translation of the original (Translations above).</p>
    </div>
  );
}
