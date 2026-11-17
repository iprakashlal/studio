// Languages → Translations: every piece of the site's text beside its translation, one language at a time. "Translate
// what's missing" fills the gaps with Workers AI on the database; every translation stays editable by hand.
import { useEffect, useState } from "react";
import { siteTexts, LANG_NAMES } from "../schema/common";
import { cfTranslate, signedInApi } from "../lib/cfdb";

const norm = (s: string) => String(s).replace(/\s+/g, " ").trim();
/** The page's fixed wording (buttons, labels the template writes itself): text in the preview that isn't content. */
function harvest(known: Set<string>): string[] {
  const doc = (document.querySelector('iframe[name="cms-preview"]') as HTMLIFrameElement | null)?.contentDocument; if (!doc?.body) return [];
  const out = new Set<string>(), take = (s: string | null) => { const t = norm(s || ""); if (t.length >= 2 && t.length <= 90 && /\p{L}{2}/u.test(t) && !/^https?:|@\w+\.\w|^[\d\s.,:+₹$%-]+$/.test(t) && !known.has(t)) out.add(t); };
  const w = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT); let n: Node | null;
  while ((n = w.nextNode())) { const p = n.parentElement; if (!p || /^(SCRIPT|STYLE|NOSCRIPT|OPTION|TEXTAREA)$/.test(p.nodeName) || p.closest(".sl-sw,#site-consent,#site-maint,[data-no-translate],.sm-flag,.sc-flag")) continue; take(n.nodeValue); }
  doc.querySelectorAll("[placeholder],[aria-label]").forEach((el) => { if (!el.closest(".sl-sw,#site-consent")) { take(el.getAttribute("placeholder")); take(el.getAttribute("aria-label")); } });
  return [...out].slice(0, 400);
}

export function Translations({ root, bump }: { root: any; bump: () => void }) {
  const n = root.i18n || {}, langs: { code: string; name: string }[] = (n.langs || []).filter((l: any) => l && l.on !== false);
  const [lang, setLangState] = useState<string>(() => (langs.some((l) => l.code === n.preview) ? n.preview : langs[0]?.code || ""));
  const [only, setOnly] = useState<"all" | "missing">("all"), [find, setFind] = useState(""), [shown, setShown] = useState(40);
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(""), [msg, setMsg] = useState<{ bad?: boolean; text: string } | null>(null);
  useEffect(() => { if (!langs.some((l) => l.code === lang)) setLangState(langs[0]?.code || ""); }, [langs.map((l) => l.code).join(",")]);
  // The preview shows the language being worked on, and goes back to the site's own when this section closes.
  useEffect(() => { if (root.i18n && lang && root.i18n.preview !== lang) { root.i18n.preview = lang; bump(); } }, [lang, root]);
  useEffect(() => () => { if (root.i18n?.preview) { root.i18n.preview = ""; bump(); } }, [root]);
  const all = (() => { const seen = new Set<string>(), out: string[] = []; for (const s of [...siteTexts(root), ...((n.ui as string[]) || [])]) { const k = norm(s); if (k && !seen.has(k)) { seen.add(k); out.push(s); } } return out; })();
  if (!langs.length) return <p className="rounded-lg border border-ink-700 bg-ink-850 px-3 py-2.5 text-[13px] text-ink-300">Switch on at least one language above to translate the site.</p>;
  const dict: Record<string, string> = ((root.i18n.t ||= {})[lang] ||= {});
  const get = (s: string) => dict[s] ?? dict[norm(s)] ?? "";
  const put = (s: string, v: string) => { if (v.trim()) dict[s] = v; else { delete dict[s]; delete dict[norm(s)]; } bump(); };
  const missing = all.filter((s) => !get(s).trim());
  const setLang = (c: string) => { setLangState(c); root.i18n.preview = c; bump(); };
  const list = all.filter((s) => (only === "all" || !get(s).trim()) && (!find.trim() || (s + " " + get(s)).toLowerCase().includes(find.trim().toLowerCase())));
  const name = LANG_NAMES[lang]?.[1] || lang;

  const translate = async (again: boolean) => {
    setMsg(null); setBusy("Reading the page's wording");
    try {
      // The page's own buttons and labels are read from the preview, shown in the site's own language for a moment.
      const was = root.i18n.preview; root.i18n.preview = ""; bump(); await new Promise((r) => setTimeout(r, 900));
      const known = new Set(siteTexts(root).map(norm)), extra = harvest(known);
      if (extra.length) root.i18n.ui = [...new Set([...((root.i18n.ui as string[]) || []), ...extra])].slice(0, 600);
      root.i18n.preview = was || lang; bump();
      const api = await signedInApi();
      if (!api) throw new Error("Translating is done by your Cloudflare database, and this device isn't signed in to one. You can still type each translation below.");
      const d: Record<string, string> = ((root.i18n.t ||= {})[lang] ||= {});
      const todo = [...new Set([...siteTexts(root), ...((root.i18n.ui as string[]) || [])])].filter((s) => norm(s) && /\p{L}/u.test(s) && (again || !(d[s] ?? d[norm(s)] ?? "").trim()));
      if (!todo.length) { setMsg({ text: `Everything is already translated into ${name}.` }); setBusy(""); return; }
      let done = 0, failed = 0;
      for (let i = 0; i < todo.length; i += 20) {
        setBusy(`Translating into ${name}: ${Math.min(i + 20, todo.length)} of ${todo.length}`);
        const part = todo.slice(i, i + 20), out = await cfTranslate(api, { to: name, from: root.i18n.base?.name || "English", texts: part });
        part.forEach((s, k) => { const v = out[k]; if (v && v.trim()) { d[s] = v; done++; } else failed++; });
        bump();
      }
      setMsg({ text: `${done} text${done === 1 ? "" : "s"} translated into ${name}.${failed ? ` ${failed} couldn't be translated: press the button again, or type them in.` : ""} Read them through: a machine translation is a first draft.` });
    } catch (e: any) { setMsg({ bad: true, text: /Unknown scope|Not found/i.test(e?.message || "") ? "Translating needs the database updated once (Settings → Hostings → Update the database). You can still type each translation below." : e?.message || "Translating didn't work. Try again." }); }
    setBusy("");
  };

  return (
    <div className="flex flex-col gap-3" aria-label="Translations">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1"><span className="label">Language</span>
          <select className="input py-1.5" aria-label="Language to translate" value={lang} onChange={(e) => setLang(e.target.value)}>{langs.map((l) => <option key={l.code} value={l.code}>{l.name} ({LANG_NAMES[l.code]?.[1] || l.code})</option>)}</select></label>
        <button type="button" className="btn btn-pri" disabled={!!busy} onClick={() => translate(false)}>{busy ? "Working…" : `Translate what's missing (${missing.length})`}</button>
        {all.length > missing.length && <button type="button" className="btn" disabled={!!busy} onClick={() => { if (sure) { setSure(false); translate(true); } else setSure(true); }} onBlur={() => setSure(false)}>{sure ? "Replace my edits in this language? Press again" : "Translate all again"}</button>}
      </div>
      {busy && <p role="status" className="text-[13px] text-ink-300">{busy}…</p>}
      {msg && <p role={msg.bad ? "alert" : "status"} className={`rounded-lg border px-3 py-2 text-[13px] ${msg.bad ? "border-red-400/40 bg-red-400/5 text-red-200" : "border-emerald-400/30 bg-emerald-400/5 text-emerald-100"}`}>{msg.text}</p>}
      <p className="text-[13px] text-ink-400">{all.length - missing.length} of {all.length} texts are in {name}. A text without a translation shows in the site's own language. The preview shows {name} while you work here.</p>
      <div className="flex flex-wrap items-center gap-2">
        <input className="input min-w-0 flex-1 py-1.5" type="search" aria-label="Find a text" placeholder="Find a text…" value={find} onChange={(e) => { setFind(e.target.value); setShown(40); }} />
        <div className="flex overflow-hidden rounded-lg border border-ink-600 text-[13px]" role="group" aria-label="Which texts">
          {(["all", "missing"] as const).map((k) => <button key={k} type="button" aria-pressed={only === k} className={`px-3 py-1.5 ${only === k ? "bg-ink-700 text-ink-100" : "text-ink-300"}`} onClick={() => { setOnly(k); setShown(40); }}>{k === "all" ? `All (${all.length})` : `Not translated (${missing.length})`}</button>)}
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
