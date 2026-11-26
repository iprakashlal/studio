// "Edit template": a notepad for one email, written in the Studio's own light markup (src/lib/mailtpl.ts).
// Built in house: a tool bar, keyboard shortcuts, line numbers, the words in curly brackets one click away, a live
// preview drawn by the same code the email is sent with, and a test email to the person signed in.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MAIL_KINDS, MAIL_TPL_MAX, mailMarkup, sampleBlocks } from "../lib/mailtpl";
import { cfCall } from "../lib/cfdb";
import { SiteDbSignIn, useSiteDbSigned } from "../pages/Connections";

type Props = { kind: string; value: string; subject: string; siteName: string; cf?: { api: string; site: string } | null; onSave: (tpl: string) => void; onClose: () => void };
const KEYS: [string, string][] = [["Ctrl B", "Bold"], ["Ctrl I", "Italic"], ["Ctrl U", "Underline"], ["Ctrl Shift X", "Strike through"], ["Ctrl E", "Code"], ["Ctrl K", "Link"], ["Ctrl Alt 1 / 2", "Heading / smaller heading"], ["Ctrl Shift 8", "List"], ["Ctrl Shift 9", "Quote"], ["Tab / Shift Tab", "Indent / outdent"], ["Ctrl D", "Duplicate the line"], ["Alt ↑ / ↓", "Move the line up / down"], ["Ctrl /", "Small grey text"], ["Ctrl S", "Save"], ["Ctrl Enter", "Send a test email"], ["Ctrl Z / Ctrl Y", "Undo / redo"]];

export function MailTemplateEditor({ kind, value, subject, siteName, cf, onSave, onClose }: Props) {
  const K = MAIL_KINDS[kind];
  const [text, setText] = useState(value || K.std), [wrap, setWrap] = useState(true), [keys, setKeys] = useState(false), [pos, setPos] = useState({ ln: 1, col: 1 }), [dark, setDark] = useState(false);
  const [test, setTest] = useState<{ busy?: boolean; ok?: string; err?: string }>({});
  const ta = useRef<HTMLTextAreaElement>(null), gut = useRef<HTMLDivElement>(null);
  const signed = useSiteDbSigned(cf);
  const dirty = text !== (value || K.std);
  const vars = useMemo(() => ({ ...K.sample, site: siteName || K.sample.site }), [K, siteName]);
  const html = useMemo(() => mailMarkup(text, vars, sampleBlocks(kind)), [text, vars, kind]);
  const lines = useMemo(() => text.split("\n").length, [text]);
  const missingCode = kind === "signin" && !/\{code\}/.test(text);
  const tooLong = text.length > MAIL_TPL_MAX;

  // Every change goes through the browser's own editing, so Ctrl Z and Ctrl Y undo it like typing.
  const edit = (from: number, to: number, put: string, selA?: number, selB?: number) => {
    const el = ta.current; if (!el) return; el.focus(); el.setSelectionRange(from, to);
    const before = el.value; let ok = false;
    try { ok = put ? document.execCommand("insertText", false, put) : from === to || document.execCommand("delete"); } catch { /* older browsers */ }
    if (!ok || (el.value === before && (put || from !== to))) { el.setRangeText(put, from, to, "end"); setText(el.value); }
    if (selA !== undefined) el.setSelectionRange(selA, selB ?? selA); else if (!put) el.setSelectionRange(from, from);
    where();
  };
  const sel = (): [number, number, string] => { const el = ta.current!; return [el.selectionStart, el.selectionEnd, el.value]; };
  const around = (a: string, b: string, words: string) => { const [s, e, v] = sel(); const mid = v.slice(s, e) || words; edit(s, e, a + mid + b, s + a.length, s + a.length + mid.length); };
  /** The whole lines the selection touches. */
  const span = (): [number, number, string[]] => { const [s, e, v] = sel(); const a = v.lastIndexOf("\n", s - 1) + 1; let b = v.indexOf("\n", Math.max(s, e - (e > s && v[e - 1] === "\n" ? 1 : 0))); if (b < 0) b = v.length; return [a, b, v.slice(a, b).split("\n")]; };
  const eachLine = (f: (l: string) => string) => { const [a, b, ls] = span(); const out = ls.map(f).join("\n"); edit(a, b, out, a, a + out.length); };
  const prefix = (p: string) => eachLine((l) => (l.startsWith(p) ? l.slice(p.length) : p + l.replace(/^(#{1,3} |- |> )/, "")));
  const insert = (t: string, own = false) => { const [s, e, v] = sel(); const put = own ? (s > 0 && v[s - 1] !== "\n" ? "\n\n" : "") + t + (v[e] === "\n" ? "" : "\n") : t; edit(s, e, put); };
  const link = (button = false) => { const [s, e, v] = sel(); const w = v.slice(s, e) || (button ? "Button words" : "link words"); const out = button ? `[[${w}]](https://)` : `[${w}](https://)`; edit(s, e, out, s + out.length - 1); };
  const dup = () => { const [a, b, ls] = span(); edit(b, b, "\n" + ls.join("\n"), b + 1 + (sel()[0] - a)); };
  const move = (d: -1 | 1) => {
    const [a, b, ls] = span(), v = sel()[2];
    if (d < 0) { if (a === 0) return; const pa = v.lastIndexOf("\n", a - 2) + 1, prev = v.slice(pa, a - 1); edit(pa, b, ls.join("\n") + "\n" + prev, pa, pa + ls.join("\n").length); }
    else { if (b >= v.length) return; let nb = v.indexOf("\n", b + 1); if (nb < 0) nb = v.length; const next = v.slice(b + 1, nb), at = a + next.length + 1; edit(a, nb, next + "\n" + ls.join("\n"), at, at + ls.join("\n").length); }
  };
  const where = () => { const el = ta.current; if (!el) return; const up = el.value.slice(0, el.selectionStart).split("\n"); setPos({ ln: up.length, col: up[up.length - 1].length + 1 }); };
  const save = () => { if (missingCode || tooLong) return; onSave(text.trim() === K.std.trim() && !value ? "" : text); onClose(); };
  const send = async () => {
    if (!cf || !signed || test.busy || tooLong) return; setTest({ busy: true });
    try { const r = await cfCall<any>(cf.api, "/mail/test?scope=" + encodeURIComponent("site:" + cf.site), { method: "POST", body: JSON.stringify({ kind, tpl: text, subject }) }); setTest({ ok: `Sent to ${r.to}. Its subject starts with [Test].` }); }
    catch (e: any) { setTest({ err: /Not found|404/.test(String(e?.message)) ? "This site's database is older than this feature. Update the database once (Settings → Hostings), then try again." : String(e?.message || e) }); }
  };
  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const c = e.ctrlKey || e.metaKey, k = e.key.toLowerCase(), stop = () => { e.preventDefault(); e.stopPropagation(); };
    if (e.key === "Tab") { stop(); const [s, en] = sel(); if (s === en && !e.shiftKey) edit(s, en, "  "); else eachLine((l) => (e.shiftKey ? l.replace(/^ {1,2}/, "") : "  " + l)); return; }
    if (e.altKey && !c && (e.key === "ArrowUp" || e.key === "ArrowDown")) { stop(); move(e.key === "ArrowUp" ? -1 : 1); return; }
    if (e.key === "Enter" && !c && !e.shiftKey) { // a list or quote carries on to the next line; an empty one ends it
      const [s, en, v] = sel(); if (s !== en) return; const a = v.lastIndexOf("\n", s - 1) + 1, line = v.slice(a, s), m = /^(- |> )(.*)$/.exec(line);
      if (m) { stop(); if (!m[2].trim()) edit(a, s, ""); else edit(s, s, "\n" + m[1]); }
      return;
    }
    if (!c) return;
    if (e.altKey && (k === "1" || k === "2")) { stop(); prefix(k === "1" ? "# " : "## "); return; }
    if (e.shiftKey && (k === "8" || k === "*")) { stop(); prefix("- "); return; }
    if (e.shiftKey && (k === "9" || k === "(")) { stop(); prefix("> "); return; }
    if (e.shiftKey && k === "x") { stop(); around("~~", "~~", "struck words"); return; }
    if (e.key === "Enter") { stop(); send(); return; }
    if (e.shiftKey || e.altKey) return;
    if (k === "b") { stop(); around("**", "**", "bold words"); } else if (k === "i") { stop(); around("*", "*", "italic words"); } else if (k === "u") { stop(); around("__", "__", "underlined words"); }
    else if (k === "e") { stop(); around("`", "`", "code"); } else if (k === "k") { stop(); link(); } else if (k === "d") { stop(); dup(); } else if (k === "/") { stop(); around("{muted:", "}", "small grey words"); } else if (k === "s") { stop(); save(); }
  };
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); if (!dirty || confirm("Close without saving the template?")) onClose(); } }; addEventListener("keydown", k, true); return () => removeEventListener("keydown", k, true); }, [dirty, onClose]);
  useLayoutEffect(() => { ta.current?.focus(); }, []);
  const B = ({ label, title, on, cls = "" }: { label: string; title: string; on: () => void; cls?: string }) => <button type="button" title={title} aria-label={title} onMouseDown={(e) => e.preventDefault()} onClick={on} className={`h-7 min-w-7 rounded-md border border-ink-700 bg-ink-900 px-2 text-[12.5px] leading-none text-ink-100 hover:border-ink-500 ${cls}`}>{label}</button>;
  const Sep = () => <span className="mx-0.5 h-4 w-px bg-ink-700" aria-hidden />;
  const close = () => { if (!dirty || confirm("Close without saving the template?")) onClose(); };

  return createPortal(
    <div className="fixed inset-0 z-[210] grid place-items-center bg-black/70 p-3 backdrop-blur-sm sm:p-5" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div role="dialog" aria-modal="true" aria-label={`Edit template: ${K.label}`} className="card flex h-full max-h-[900px] w-full max-w-[1400px] flex-col overflow-hidden rounded-2xl shadow-2xl">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-ink-700 px-4 py-2.5">
          <h2 className="text-[15px] font-extrabold">Edit template</h2><span className="text-[13px] text-ink-400">{K.label}</span>
          <span className="ml-auto flex items-center gap-2">
            <button type="button" className="btn btn-ghost btn-sm" aria-expanded={keys} onClick={() => setKeys((v) => !v)}>Shortcuts</button>
            <button className="icon-btn" onClick={close} aria-label="Close">✕</button>
          </span>
        </div>
        <div className="grid min-h-0 flex-1 lg:grid-cols-2">
          <div className="flex min-h-0 flex-col border-ink-700 lg:border-r">
            <div role="toolbar" aria-label="Text tools" className="flex flex-wrap items-center gap-1 border-b border-ink-800 bg-ink-850 px-3 py-2">
              <B label="B" title="Bold (Ctrl B)" cls="font-extrabold" on={() => around("**", "**", "bold words")} />
              <B label="I" title="Italic (Ctrl I)" cls="italic" on={() => around("*", "*", "italic words")} />
              <B label="U" title="Underline (Ctrl U)" cls="underline" on={() => around("__", "__", "underlined words")} />
              <B label="S" title="Strike through (Ctrl Shift X)" cls="line-through" on={() => around("~~", "~~", "struck words")} />
              <B label="Mark" title="Highlight" on={() => around("==", "==", "highlighted words")} />
              <B label="</>" title="Code (Ctrl E)" cls="font-mono" on={() => around("`", "`", "code")} />
              <Sep />
              <B label="H1" title="Heading (Ctrl Alt 1)" cls="font-bold" on={() => prefix("# ")} />
              <B label="H2" title="Smaller heading (Ctrl Alt 2)" cls="font-bold" on={() => prefix("## ")} />
              <B label="• List" title="List (Ctrl Shift 8)" on={() => prefix("- ")} />
              <B label="❝ Quote" title="Quote (Ctrl Shift 9)" on={() => prefix("> ")} />
              <B label="― Line" title="A line across" on={() => insert("---", true)} />
              <Sep />
              <B label="Link" title="Link (Ctrl K)" on={() => link()} />
              <B label="Button" title="A button that opens a link" on={() => link(true)} />
              <Sep />
              <B label="Big" title="Bigger words" on={() => around("{big:", "}", "big words")} />
              <B label="Small" title="Smaller words" on={() => around("{small:", "}", "small words")} />
              <B label="Grey" title="Small grey words (Ctrl /)" on={() => around("{muted:", "}", "small grey words")} />
              <Sep />
              <B label="↶" title="Undo (Ctrl Z)" on={() => { ta.current?.focus(); document.execCommand("undo"); }} />
              <B label="↷" title="Redo (Ctrl Y)" on={() => { ta.current?.focus(); document.execCommand("redo"); }} />
              <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-[12px] text-ink-300"><input type="checkbox" checked={wrap} onChange={(e) => setWrap(e.target.checked)} />Wrap long lines</label>
            </div>
            <div className="flex flex-wrap items-center gap-1 border-b border-ink-800 px-3 py-2 text-[12px]">
              <span className="mr-1 text-ink-400">Insert:</span>
              {K.vars.map(([v, d]) => <button key={v} type="button" title={d} onMouseDown={(e) => e.preventDefault()} onClick={() => insert(`{${v}}`)} className="rounded-full border border-ink-700 bg-ink-900 px-2 py-0.5 font-mono text-ink-100 hover:border-brand-400">{`{${v}}`}</button>)}
              {K.blocks.map(([v, d]) => <button key={"b" + v} type="button" title={`${d} (goes on a line of its own)`} onMouseDown={(e) => e.preventDefault()} onClick={() => insert(`{${v}}`, true)} className="rounded-full border border-brand-500/50 bg-brand-500/10 px-2 py-0.5 font-mono text-ink-100 hover:border-brand-400">{`{${v}}`} ▤</button>)}
            </div>
            {keys && <div className="grid max-h-44 grid-cols-2 gap-x-6 gap-y-1 overflow-y-auto border-b border-ink-800 bg-ink-900 px-4 py-3 text-[12px] text-ink-300 sm:grid-cols-3">{KEYS.map(([a, b]) => <span key={a} className="flex justify-between gap-2"><span>{b}</span><kbd className="font-mono text-ink-100">{a}</kbd></span>)}</div>}
            <div className="flex min-h-0 flex-1 bg-ink-950 font-mono text-[13px] leading-[1.6]">
              {!wrap && <div ref={gut} aria-hidden className="select-none overflow-hidden border-r border-ink-800 px-2.5 py-3 text-right text-ink-500">{Array.from({ length: lines }, (_, i) => <div key={i} className={i + 1 === pos.ln ? "text-ink-100" : ""}>{i + 1}</div>)}</div>}
              <textarea ref={ta} aria-label="Template" spellCheck={false} wrap={wrap ? "soft" : "off"} value={text} onChange={(e) => { setText(e.target.value); setTest({}); }} onKeyDown={onKey} onKeyUp={where} onClick={where} onSelect={where} onScroll={(e) => { if (gut.current) gut.current.scrollTop = e.currentTarget.scrollTop; }}
                className="min-h-[260px] flex-1 resize-none bg-transparent px-3 py-3 text-ink-100 outline-none" style={{ tabSize: 2 }} />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-ink-800 bg-ink-850 px-3 py-1.5 font-mono text-[11.5px] text-ink-400">
              <span>Ln {pos.ln}, Col {pos.col}</span><span>{lines} {lines === 1 ? "line" : "lines"}</span><span className={tooLong ? "text-red-300" : ""}>{text.length.toLocaleString()} / {MAIL_TPL_MAX.toLocaleString()} characters</span>{dirty && <span className="text-amber-300">not saved</span>}
            </div>
          </div>
          <div className="flex min-h-0 flex-col max-lg:border-t max-lg:border-ink-700">
            <div className="flex flex-wrap items-center gap-2 border-b border-ink-800 bg-ink-850 px-3 py-2 text-[12.5px] text-ink-300">
              <b className="text-ink-100">Preview</b><span>with made-up details</span>
              <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-[12px]"><input type="checkbox" checked={dark} onChange={(e) => setDark(e.target.checked)} />Dark inbox</label>
            </div>
            <div className={`min-h-[220px] flex-1 overflow-auto p-4 ${dark ? "bg-[#1b1c1f]" : "bg-[#eef0f4]"}`}>
              <div className="mx-auto max-w-[600px] rounded-lg bg-white p-5 shadow" style={dark ? { filter: "invert(1) hue-rotate(180deg)" } : undefined}>
                <p style={{ margin: "0 0 14px", paddingBottom: 10, borderBottom: "1px solid #e3e6ec", font: "600 14px system-ui,Segoe UI,Arial,sans-serif", color: "#111" }}><span style={{ color: "#778", fontWeight: 400 }}>Subject: </span>{(subject || K.subject).replace(/\{(\w+)\}/g, (m, k) => (vars as any)[k] ?? m)}</p>
                <div style={{ font: "15px/1.55 system-ui,Segoe UI,Arial,sans-serif", color: "#111", maxWidth: 560 }} dangerouslySetInnerHTML={{ __html: html }} />
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 border-t border-ink-700 px-4 py-3">
          {missingCode && <p role="alert" className="text-[13px] text-red-300">The template must contain {"{code}"}, or nobody could sign in. Add it on a line of its own.</p>}
          {tooLong && <p role="alert" className="text-[13px] text-red-300">The template is too long. Shorten it to {MAIL_TPL_MAX.toLocaleString()} characters.</p>}
          {test.ok && <p role="status" className="text-[13px] text-emerald-300">{test.ok}</p>}
          {test.err && <p role="alert" className="text-[13px] text-red-300">Not sent: {test.err}</p>}
          {cf && !signed && <SiteDbSignIn cf={cf} small what="send yourself a test email" />}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-pri" disabled={missingCode || tooLong} onClick={save}>Save template</button>
            <button type="button" className="btn" disabled={!cf || !signed || !!test.busy || tooLong} title={!cf ? "Test emails need the site hosted on the Cloudflare database (it sends the emails)." : !signed ? "Sign in to the site's database first (below)." : "Sends this draft, with made-up details, to the address you are signed in with (Ctrl Enter)"} onClick={send}>{test.busy ? "Sending…" : "Test template"}</button>
            <button type="button" className="btn btn-ghost" onClick={() => { if (text.trim() === K.std.trim() || confirm("Replace what is written with the standard email?")) edit(0, sel()[2].length, K.std, 0); }}>Start from the standard email</button>
            {value && <button type="button" className="btn btn-ghost text-red-300" onClick={() => { if (confirm("Remove this template? The email goes back to the wording boxes.")) { onSave(""); onClose(); } }}>Remove template</button>}
            <button type="button" className="btn btn-ghost ml-auto" onClick={close}>Cancel</button>
          </div>
          <p className="text-[12px] text-ink-400">{!cf ? "Test emails need the site hosted on the Cloudflare database, which is what sends them. " : ""}While a template is saved it replaces this email's heading, message and closing-line boxes; the subject box still sets the subject. It reaches the live site the next time the site is published.</p>
        </div>
      </div>
    </div>, document.body);
}
