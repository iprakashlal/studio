// A word-processor style editor for page text: what you see is what the page shows. Bold, italic, underline, strike,
// highlight, colour and size; headings, lists, quotes, note boxes, centred lines, links, dividing lines and tables
// (with rows and columns added or taken away where the cursor is). Paste from Word or Google Docs keeps the formatting
// it can. It is saved as the light text marks the sites already read (lib/richtext.ts), so nothing changes on the sites.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cleanPaste, htmlToMd, mdToHtml } from "../lib/richtext";

type Props = { id?: string; value: string; onChange: (v: string) => void; label?: string; minRows?: number; disabled?: boolean };

const exec = (cmd: string, arg?: string) => { try { document.execCommand(cmd, false, arg); } catch { /* old browser */ } };

export function RichEditor({ id, value, onChange, label = "Text", minRows = 14, disabled }: Props) {
  const box = useRef<HTMLDivElement>(null), last = useRef<string | null>(null);
  const [tbl, setTbl] = useState(false), [cols, setCols] = useState(3), [rows, setRows] = useState(3), [inTable, setInTable] = useState(false), [asText, setAsText] = useState(false);
  const [state, setState] = useState<Record<string, boolean>>({});
  // The text from outside (first load, "Start again", another person's change) is drawn; what was typed here is not redrawn.
  useLayoutEffect(() => { if (asText) return; const el = box.current; if (!el) return; if (value !== last.current) { el.innerHTML = mdToHtml(value); last.current = value; } }, [value, asText]);
  const emit = () => { const el = box.current; if (!el) return; const md = htmlToMd(el); last.current = md; if (md !== value) onChange(md); };
  const refresh = () => {
    const s = getSelection(), n = s?.anchorNode, el = box.current; if (!el || !n || !el.contains(n)) return;
    const q = (c: string) => { try { return document.queryCommandState(c); } catch { return false; } };
    setState({ b: q("bold"), i: q("italic"), u: q("underline"), s: q("strikeThrough"), ul: q("insertUnorderedList"), ol: q("insertOrderedList") });
    setInTable(!!(n.nodeType === 1 ? (n as Element) : n.parentElement)?.closest("td,th"));
  };
  // Where the cursor was in the text, so a tool that takes the focus (the table's boxes, a menu, the link question) puts things there.
  const saved = useRef<Range | null>(null);
  useEffect(() => { const f = () => { const sel = getSelection(), el = box.current; if (el && sel && sel.rangeCount && el.contains(sel.anchorNode)) saved.current = sel.getRangeAt(0).cloneRange(); refresh(); }; document.addEventListener("selectionchange", f); return () => document.removeEventListener("selectionchange", f); }, []);
  const focus = () => {
    const el = box.current; if (!el) return; el.focus();
    const sel = getSelection(); if (!sel) return;
    if (saved.current && el.contains(saved.current.startContainer)) { sel.removeAllRanges(); sel.addRange(saved.current); }
    else if (!sel.rangeCount || !el.contains(sel.anchorNode)) { const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); sel.removeAllRanges(); sel.addRange(r); }
  };
  const run = (fn: () => void) => () => { focus(); fn(); emit(); refresh(); };
  /** Wraps the selected words in an element (highlight, colour, size); pressed again inside one, takes it off. */
  const wrapSel = (make: () => HTMLElement, match: (e: Element) => boolean) => {
    const s = getSelection(); if (!s || !s.rangeCount) return; const r = s.getRangeAt(0);
    const at = (r.commonAncestorContainer.nodeType === 1 ? (r.commonAncestorContainer as Element) : r.commonAncestorContainer.parentElement)?.closest("*");
    let hit: Element | null = at || null; while (hit && hit !== box.current && !match(hit)) hit = hit.parentElement;
    if (hit && hit !== box.current) { const p = hit.parentNode!; while (hit.firstChild) p.insertBefore(hit.firstChild, hit); p.removeChild(hit); return; }
    if (r.collapsed) return;
    const w = make(); try { w.appendChild(r.extractContents()); r.insertNode(w); s.removeAllRanges(); const nr = document.createRange(); nr.selectNodeContents(w); s.addRange(nr); } catch { /* across blocks */ }
  };
  const blockAt = (): HTMLElement | null => { const s = getSelection(); let n: Node | null = s?.anchorNode || null; while (n && n !== box.current) { if (n.nodeType === 1 && /^(P|H2|H3|BLOCKQUOTE|DIV|LI)$/.test((n as Element).tagName) && n.parentNode === box.current) return n as HTMLElement; n = n.parentNode; } return null; };
  const blockClass = (c: string) => { exec("formatBlock", "P"); const b = blockAt(); if (b && b.tagName === "P") { const on = b.classList.contains(c); b.className = on ? "" : c; } };
  const insertTable = () => {
    const c = Math.min(8, Math.max(1, cols)), r = Math.min(40, Math.max(1, rows));
    const row = (tag: string, txt: (i: number) => string) => "<tr>" + Array.from({ length: c }, (_, i) => `<${tag}>${txt(i)}</${tag}>`).join("") + "</tr>";
    focus(); exec("insertHTML", "<table><thead>" + row("th", (i) => "Heading " + (i + 1)) + "</thead><tbody>" + Array.from({ length: r }, () => row("td", () => "<br>")).join("") + "</tbody></table><p><br></p>");
    setTbl(false); emit();
  };
  const cell = () => { const n = getSelection()?.anchorNode; return (n && (n.nodeType === 1 ? (n as Element) : n.parentElement)?.closest("td,th")) as HTMLTableCellElement | null; };
  const tableOp = (op: "rowAbove" | "rowBelow" | "colLeft" | "colRight" | "delRow" | "delCol" | "delTable") => {
    const td = cell(); if (!td) return; const tr = td.parentElement as HTMLTableRowElement, table = td.closest("table")!, ci = td.cellIndex;
    const all = Array.from(table.querySelectorAll("tr"));
    if (op === "rowAbove" || op === "rowBelow") { const nr = document.createElement("tr"); for (let i = 0; i < tr.cells.length; i++) { const x = document.createElement("td"); x.innerHTML = "<br>"; nr.appendChild(x); } if (tr.parentElement?.tagName === "THEAD") table.tBodies[0]?.prepend(nr); else tr.parentElement!.insertBefore(nr, op === "rowAbove" ? tr : tr.nextSibling); }
    if (op === "colLeft" || op === "colRight") all.forEach((r) => { const ref = r.children[ci]; const x = document.createElement(r.parentElement?.tagName === "THEAD" ? "th" : "td"); x.innerHTML = r.parentElement?.tagName === "THEAD" ? "Heading" : "<br>"; r.insertBefore(x, op === "colLeft" ? ref : ref?.nextSibling || null); });
    if (op === "delRow") { if (tr.parentElement?.tagName === "THEAD") return; tr.remove(); }
    if (op === "delCol") { if (tr.cells.length <= 1) table.remove(); else all.forEach((r) => r.children[ci]?.remove()); }
    if (op === "delTable") table.remove();
    emit(); refresh();
  };
  const link = () => {
    focus(); const s = getSelection(); const had = s && !s.isCollapsed;
    const u = prompt("Link address (https://…, an email address, or a phone number)", "https://"); if (!u || u === "https://") return;
    const href = /^[\w.+-]+@[\w-]+(\.[\w-]+)+$/.test(u) ? "mailto:" + u : /^\+?[\d\s-]{7,}$/.test(u) ? "tel:" + u.replace(/[\s-]/g, "") : /^(https?:|mailto:|tel:|\/|#)/.test(u) ? u : "https://" + u;
    focus(); if (had) exec("createLink", href); else exec("insertHTML", `<a href="${href.replace(/"/g, "")}">${u.replace(/[<>&]/g, "")}</a>`); emit();
  };
  const onPaste = (e: React.ClipboardEvent) => {
    const html = e.clipboardData.getData("text/html"), text = e.clipboardData.getData("text/plain");
    e.preventDefault();
    if (html) exec("insertHTML", cleanPaste(html));
    else exec("insertHTML", mdToHtml(text).replace(/^<p>([\s\S]*)<\/p>$/, "$1"));
    emit();
  };
  const onKey = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey) { const k = e.key.toLowerCase(); if (k === "k") { e.preventDefault(); link(); } }
    // Tab moves between table cells.
    if (e.key === "Tab") { const td = cell(); if (td) { e.preventDefault(); const cells = Array.from(td.closest("table")!.querySelectorAll("td,th")); let i = cells.indexOf(td) + (e.shiftKey ? -1 : 1); if (i >= cells.length) { tableOp("rowBelow"); i = cells.length; } const to = Array.from(td.closest("table")!.querySelectorAll("td,th"))[Math.max(0, i)]; if (to) { const r = document.createRange(); r.selectNodeContents(to); r.collapse(false); const s = getSelection()!; s.removeAllRanges(); s.addRange(r); } } }
  };
  const Btn = ({ t, label: l, on, act, cls = "" }: { t: string; label: string; on?: boolean; act: () => void; cls?: string }) => (
    <button type="button" title={t} aria-label={t} aria-pressed={on} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={act}
      className={`h-8 min-w-8 rounded-md px-2 text-[13px] leading-none transition ${on ? "bg-brand-500/25 text-ink-100" : "text-ink-200 hover:bg-ink-800"} disabled:opacity-40 ${cls}`}>{l}</button>
  );
  const Sep = () => <span className="mx-1 h-5 w-px bg-ink-700" aria-hidden />;

  if (asText) return (
    <div className="flex flex-col gap-1.5">
      <textarea id={id} className="input min-h-[22rem] font-mono text-[13px] leading-relaxed" aria-label={label} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
      <button type="button" className="self-start text-[12px] text-ink-400 underline underline-offset-2 hover:text-ink-200" onClick={() => { last.current = null; setAsText(false); }}>Back to the editor</button>
    </div>
  );
  return (
    <div className="rte flex flex-col overflow-hidden rounded-xl border border-ink-600 bg-ink-950 focus-within:border-brand-400">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b border-ink-700 bg-ink-900 px-1.5 py-1" role="toolbar" aria-label="Formatting">
        <select aria-label="Paragraph style" disabled={disabled} className="mr-1 h-8 rounded-md border border-ink-700 bg-ink-950 px-1.5 text-[13px] text-ink-100" value="" onMouseDown={() => { /* keep selection */ }}
          onChange={(e) => { const v = e.target.value; e.target.value = ""; focus(); if (v === "p") exec("formatBlock", "P"); else if (v === "h2") exec("formatBlock", "H2"); else if (v === "h3") exec("formatBlock", "H3"); else if (v === "quote") exec("formatBlock", "BLOCKQUOTE"); else if (v === "note") blockClass("sp-note"); else if (v === "center") blockClass("sp-center"); emit(); }}>
          <option value="">Style</option><option value="p">Normal text</option><option value="h2">Heading</option><option value="h3">Sub-heading</option><option value="quote">Quote</option><option value="note">Note box</option><option value="center">Centred</option>
        </select>
        <Btn t="Bold (Ctrl B)" label="B" cls="font-extrabold" on={state.b} act={run(() => exec("bold"))} />
        <Btn t="Italic (Ctrl I)" label="I" cls="italic" on={state.i} act={run(() => exec("italic"))} />
        <Btn t="Underline (Ctrl U)" label="U" cls="underline" on={state.u} act={run(() => exec("underline"))} />
        <Btn t="Strike through" label="S" cls="line-through" on={state.s} act={run(() => exec("strikeThrough"))} />
        <Btn t="Highlight" label="▍Highlight" act={run(() => wrapSel(() => document.createElement("mark"), (e) => e.tagName === "MARK"))} />
        <select aria-label="Colour and size" disabled={disabled} className="h-8 rounded-md border border-ink-700 bg-ink-950 px-1.5 text-[13px] text-ink-100" value=""
          onChange={(e) => { const c = e.target.value; e.target.value = ""; if (!c) return; focus(); wrapSel(() => { const s = document.createElement("span"); s.className = "sp-" + c; return s; }, (x) => x.classList?.contains("sp-" + c)); emit(); }}>
          <option value="">Colour & size</option><option value="accent">Accent colour</option><option value="muted">Grey</option><option value="big">Bigger</option><option value="small">Smaller</option>
        </select>
        <Sep />
        <Btn t="Bulleted list" label="• List" on={state.ul} act={run(() => exec("insertUnorderedList"))} />
        <Btn t="Numbered list" label="1. List" on={state.ol} act={run(() => exec("insertOrderedList"))} />
        <Btn t="Link (Ctrl K)" label="🔗 Link" act={link} />
        <Btn t="Remove link" label="Unlink" act={run(() => exec("unlink"))} />
        <Btn t="Dividing line" label="— Line" act={run(() => exec("insertHorizontalRule"))} />
        <Btn t="Insert a table" label="▦ Table" on={tbl} act={() => setTbl((x) => !x)} />
        <Sep />
        <Btn t="Clear formatting" label="Clear" act={run(() => { exec("removeFormat"); exec("formatBlock", "P"); })} />
        <Btn t="Undo (Ctrl Z)" label="↶" act={run(() => exec("undo"))} />
        <Btn t="Redo (Ctrl Y)" label="↷" act={run(() => exec("redo"))} />
      </div>
      {tbl && (
        <div className="flex flex-wrap items-end gap-2 border-b border-ink-700 bg-ink-900/70 px-3 py-2 text-[12.5px]">
          <label className="flex flex-col gap-1">Columns<input type="number" min={1} max={8} className="input w-20 py-1" value={cols} onChange={(e) => setCols(+e.target.value || 1)} /></label>
          <label className="flex flex-col gap-1">Rows<input type="number" min={1} max={40} className="input w-20 py-1" value={rows} onChange={(e) => setRows(+e.target.value || 1)} /></label>
          <button type="button" className="btn btn-sm btn-pri" onMouseDown={(e) => e.preventDefault()} onClick={insertTable}>Insert table</button>
          <span className="hint">The first row is the heading row. Tab moves to the next cell (and adds a row at the end).</span>
        </div>
      )}
      {inTable && !disabled && (
        <div className="flex flex-wrap items-center gap-0.5 border-b border-ink-700 bg-brand-500/10 px-1.5 py-1 text-[12.5px]" role="toolbar" aria-label="Table">
          <span className="px-2 font-semibold text-ink-300">Table:</span>
          <Btn t="Insert a row above" label="+ Row above" act={() => tableOp("rowAbove")} />
          <Btn t="Insert a row below" label="+ Row below" act={() => tableOp("rowBelow")} />
          <Btn t="Insert a column to the left" label="+ Column left" act={() => tableOp("colLeft")} />
          <Btn t="Insert a column to the right" label="+ Column right" act={() => tableOp("colRight")} />
          <Sep />
          <Btn t="Delete this row" label="Delete row" act={() => tableOp("delRow")} />
          <Btn t="Delete this column" label="Delete column" act={() => tableOp("delCol")} />
          <Btn t="Delete the table" label="Delete table" act={() => tableOp("delTable")} />
        </div>
      )}
      <div ref={box} id={id} role="textbox" aria-multiline="true" aria-label={label} contentEditable={!disabled} suppressContentEditableWarning spellCheck
        className="rte-body scroll-thin overflow-y-auto px-4 py-3 text-[15px] leading-relaxed text-ink-100 outline-none" style={{ minHeight: `${minRows * 1.6}em`, maxHeight: "70vh" }}
        onInput={emit} onBlur={emit} onPaste={onPaste} onKeyDown={onKey} onKeyUp={refresh} onMouseUp={refresh} />
      <div className="flex items-center gap-3 border-t border-ink-700 px-3 py-1.5 text-[11.5px] text-ink-500">
        <span className="flex-1">Paste from Word or Google Docs keeps headings, lists, tables and text styles.</span>
        <button type="button" className="underline underline-offset-2 hover:text-ink-200" onClick={() => setAsText(true)}>Edit as plain text</button>
      </div>
    </div>
  );
}
