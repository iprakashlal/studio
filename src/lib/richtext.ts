// The light text marks the sites' pages are written in (## heading, - list, | table |, **bold**, ==highlight==,
// {accent:words}…), turned into HTML for the visual editor and back again. mdToHtml draws what the site draws
// (public/templates/*/assets/pages.js); htmlToMd writes what the editor shows (and what is pasted from Word or a web page).

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function inline(s: string): string {
  const keep: string[] = [], put = (h: string) => { keep.push(h); return "\u0000" + (keep.length - 1) + "\u0000"; };
  s = s.replace(/\[([^\]\n]+)\]\(((?:https?:\/\/|mailto:|tel:|\/|\.\/|#|[\w-]+\.html)[^\s)]*)\)/g, (_, t, u) => put(`<a href="${u}">${t}</a>`));
  for (let i = 0; i < 3; i++) s = s.replace(/\{(accent|big|small|muted):([^{}\n]+)\}/g, '<span class="sp-$1">$2</span>');
  s = s.replace(/==(?=\S)([^=\n]*?\S)==/g, "<mark>$1</mark>").replace(/~~(?=\S)([^~\n]*?\S)~~/g, "<s>$1</s>").replace(/(^|[^\w])__(?=\S)([^_\n]*?\S)__(?!\w)/g, "$1<u>$2</u>");
  s = s.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*\w])\*(?=\S)([^*\n]*?\S)\*(?!\w)/g, "$1<em>$2</em>").replace(/(^|[^\w])_(?=\S)([^_\n]*?\S)_(?!\w)/g, "$1<em>$2</em>");
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => keep[+i]);
}

/** The marks as HTML for the editor (the same blocks the site draws). */
export function mdToHtml(text: string): string {
  const out: string[] = []; let para: string[] = [], list: { tag: string; items: string[] } | null = null, quote: string[] = [], table: string[] = [];
  const flushP = () => { if (para.length) { out.push("<p>" + para.map((l) => inline(esc(l))).join("<br>") + "</p>"); para = []; } };
  const flushL = () => { if (list) { out.push(`<${list.tag}>` + list.items.map((i) => "<li>" + inline(esc(i)) + "</li>").join("") + `</${list.tag}>`); list = null; } };
  const flushQ = () => { if (quote.length) { out.push("<blockquote>" + quote.map((l) => inline(esc(l))).join("<br>") + "</blockquote>"); quote = []; } };
  const cells = (l: string) => l.replace(/^\|/, "").replace(/\|\s*$/, "").split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, "|").trim());
  const flushT = () => {
    if (!table.length) return;
    let rows = table.map(cells), al: string[] = [], head: string[] | null = null;
    if (rows.length > 1 && rows[1].every((c) => /^:?-{2,}:?$/.test(c))) { al = rows[1].map((c) => (/^:.*:$/.test(c) ? "center" : /:$/.test(c) ? "right" : "")); head = rows[0]; rows = rows.slice(2); }
    const n = Math.max(...rows.concat(head ? [head] : []).map((x) => x.length));
    const row = (x: string[], tag: string) => "<tr>" + Array.from({ length: n }, (_, i) => `<${tag}${al[i] ? ` style="text-align:${al[i]}"` : ""}>${inline(esc(x[i] || "")) || "<br>"}</${tag}>`).join("") + "</tr>";
    out.push("<table>" + (head ? "<thead>" + row(head, "th") + "</thead>" : "") + "<tbody>" + rows.map((x) => row(x, "td")).join("") + "</tbody></table>");
    table = [];
  };
  const flush = () => { flushP(); flushL(); flushQ(); flushT(); };
  for (const raw of String(text || "").replace(/\r\n?/g, "\n").split("\n")) {
    const l = raw.replace(/\s+$/, ""), t = l.trim(); let m: RegExpExecArray | null;
    if (!t) { flush(); continue; }
    if (/^\|.*\|/.test(t) || (table.length && /^\|/.test(t))) { flushP(); flushL(); flushQ(); table.push(t); continue; }
    flushT();
    if ((m = /^!>\s?(.+)$/.exec(t))) { flush(); out.push('<p class="sp-note">' + inline(esc(m[1])) + "</p>"); continue; }
    if ((m = /^->\s?(.+?)(\s*<-)?$/.exec(t))) { flush(); out.push('<p class="sp-center">' + inline(esc(m[1])) + "</p>"); continue; }
    if ((m = /^(#{1,3})\s+(.+)$/.exec(t))) { flush(); const lv = m[1].length === 3 ? 3 : 2; out.push(`<h${lv}>${inline(esc(m[2].replace(/\s*#+$/, "")))}</h${lv}>`); continue; }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) { flush(); out.push("<hr>"); continue; }
    if ((m = /^>\s?(.*)$/.exec(t))) { flushP(); flushL(); quote.push(m[1]); continue; }
    if ((m = /^[-*•]\s+(.+)$/.exec(t))) { flushP(); flushQ(); if (!list || list.tag !== "ul") { flushL(); list = { tag: "ul", items: [] }; } list.items.push(m[1]); continue; }
    if ((m = /^\d{1,3}[.)]\s+(.+)$/.exec(t))) { flushP(); flushQ(); if (!list || list.tag !== "ol") { flushL(); list = { tag: "ol", items: [] }; } list.items.push(m[1]); continue; }
    if (list && /^\s{2,}\S/.test(l)) { list.items[list.items.length - 1] += " " + t; continue; }
    flushL(); flushQ(); para.push(t);
  }
  flush();
  return out.join("") || "<p><br></p>";
}

// ---- HTML (the editor, or something pasted) back to marks
const BLOCK = /^(P|DIV|H1|H2|H3|H4|H5|H6|UL|OL|LI|BLOCKQUOTE|TABLE|THEAD|TBODY|TFOOT|TR|TD|TH|HR|PRE|SECTION|ARTICLE|HEADER|FOOTER|MAIN|ASIDE|NAV|FIGURE|DL|DT|DD|CENTER|ADDRESS)$/;
const styleOf = (el: HTMLElement) => (el.getAttribute("style") || "").toLowerCase();
/** One line of inline content as marks. */
function inl(node: Node): string {
  let s = "";
  node.childNodes.forEach((n) => {
    if (n.nodeType === 3) { s += (n.textContent || "").replace(/[ \s]+/g, " "); return; }
    if (n.nodeType !== 1) return;
    const el = n as HTMLElement, tag = el.tagName, st = styleOf(el);
    if (tag === "BR") { s += "\n"; return; }
    if (/^(SCRIPT|STYLE|TEMPLATE|META|LINK|O:P)$/.test(tag)) return;
    if (tag === "IMG") return;
    let inner = inl(el);
    if (!inner.trim()) { s += inner; return; }
    const lead = inner.match(/^\s*/)![0], trail = inner.match(/\s*$/)![0]; inner = inner.trim();
    const wrap = (a: string, b = a) => { inner = a + inner + b; };
    if (tag === "A") { const h = el.getAttribute("href") || ""; if (/^(https?:|mailto:|tel:|\/|#)/.test(h) && h.replace(/^mailto:/, "") !== inner) inner = `[${inner.replace(/[[\]]/g, "")}](${h})`; }
    else {
      if (el.classList.contains("sp-accent")) wrap("{accent:", "}"); else if (el.classList.contains("sp-big")) wrap("{big:", "}"); else if (el.classList.contains("sp-small")) wrap("{small:", "}"); else if (el.classList.contains("sp-muted")) wrap("{muted:", "}");
      if (tag === "MARK" || /background(-color)?:\s*(yellow|#ff0|#ffff00|rgb\(255,\s*255,\s*0\))/.test(st)) wrap("==");
      if (tag === "S" || tag === "STRIKE" || tag === "DEL" || /line-through/.test(st)) wrap("~~");
      if (tag === "U" || tag === "INS" || /underline/.test(st)) wrap("__");
      if (tag === "EM" || tag === "I" || /font-style:\s*italic/.test(st)) wrap("*");
      if (tag === "STRONG" || tag === "B" || /font-weight:\s*(bold|[6-9]00)/.test(st)) wrap("**");
    }
    s += lead + inner + trail;
  });
  return s;
}
const oneLine = (s: string) => s.replace(/\s*\n\s*/g, " ").replace(/[ \t]+/g, " ").trim();
const lines = (s: string) => s.split("\n").map((l) => l.replace(/[ \t]+/g, " ").trim()).filter(Boolean);
const cellText = (el: Element) => { const parts: string[] = []; el.childNodes.forEach((c) => { const t = c.nodeType === 1 && BLOCK.test((c as Element).tagName) ? inl(c) : inl({ childNodes: [c] } as any); if (t.trim()) parts.push(oneLine(t)); }); return parts.join(" ").replace(/\|/g, "\\|"); };

function blocks(node: Node, out: string[]) {
  let run = document.createElement("span"); let has = false;
  const flushRun = () => { if (has) { const ls = lines(inl(run)); if (ls.length) out.push(ls.join("\n")); } run = document.createElement("span"); has = false; };
  node.childNodes.forEach((n) => {
    if (n.nodeType === 1 && BLOCK.test((n as Element).tagName)) { flushRun(); block(n as HTMLElement, out); return; }
    if (n.nodeType === 1 && /^(SCRIPT|STYLE|META|LINK|TITLE)$/.test((n as Element).tagName)) return;
    run.appendChild(n.cloneNode(true)); has = true;
  });
  flushRun();
}
function block(el: HTMLElement, out: string[]) {
  const tag = el.tagName, st = styleOf(el);
  if (tag === "HR") { out.push("---"); return; }
  if (/^H[1-6]$/.test(tag)) { const t = oneLine(inl(el)).replace(/^\*\*(.*)\*\*$/, "$1"); if (t) out.push((tag === "H1" || tag === "H2" ? "## " : "### ") + t); return; }
  if (tag === "UL" || tag === "OL") {
    let n = 0; const items: string[] = [];
    const walk = (list: Element) => list.childNodes.forEach((c) => {
      if (c.nodeType !== 1) return; const li = c as HTMLElement;
      if (li.tagName === "UL" || li.tagName === "OL") { walk(li); return; }
      const sub = Array.from(li.children).filter((x) => x.tagName === "UL" || x.tagName === "OL"), clone = li.cloneNode(true) as HTMLElement;
      clone.querySelectorAll("ul,ol").forEach((x) => x.remove());
      const t = oneLine(inl(clone)); if (t) items.push((tag === "OL" ? ++n + ". " : "- ") + t);
      sub.forEach(walk);
    });
    walk(el); if (items.length) out.push(items.join("\n")); return;
  }
  if (tag === "BLOCKQUOTE") { const inner: string[] = []; blocks(el, inner); const t = inner.join("\n").split("\n").map((l) => l.replace(/^(#{1,3}|[-*•]|\d{1,3}[.)])\s+/, "")).filter(Boolean); if (t.length) out.push(t.map((l) => "> " + l).join("\n")); return; }
  if (tag === "TABLE") {
    const rows = Array.from(el.querySelectorAll("tr")).filter((r) => r.closest("table") === el);
    if (!rows.length) return;
    const grid = rows.map((r) => Array.from(r.children).filter((c) => c.tagName === "TD" || c.tagName === "TH").map(cellText));
    const n = Math.max(...grid.map((r) => r.length)); if (!n) return;
    // The first row is the heading row (as tables from Word usually are), so the page shows it as one.
    const first = rows[0];
    const al = Array.from(first.children).map((c) => { const a = ((c as HTMLElement).style?.textAlign || c.getAttribute("align") || "").toLowerCase(); return a === "center" ? ":---:" : a === "right" ? "---:" : "---"; });
    const line = (r: string[]) => "| " + Array.from({ length: n }, (_, i) => r[i] || " ").join(" | ") + " |";
    const sep = "|" + Array.from({ length: n }, (_, i) => al[i] || "---").join("|") + "|";
    const body = grid.slice(1), head = grid[0];
    out.push([line(head), sep, ...body.map(line)].join("\n")); return;
  }
  if (tag === "TR" || tag === "TD" || tag === "TH" || tag === "THEAD" || tag === "TBODY" || tag === "TFOOT") { blocks(el, out); return; }
  // A block holding other blocks (a div around paragraphs): look inside.
  if (Array.from(el.children).some((c) => BLOCK.test(c.tagName))) { blocks(el, out); return; }
  const ls = lines(inl(el)); if (!ls.length) return;
  if (el.classList.contains("sp-note")) { out.push("!> " + ls.join(" ")); return; }
  if (el.classList.contains("sp-center") || tag === "CENTER" || /text-align:\s*center/.test(st) || el.getAttribute("align") === "center") { out.push("-> " + ls.join(" ")); return; }
  // A paragraph whose line starts like a mark would turn into one: keep it as words.
  out.push(ls.map((l) => l.replace(/^(#{1,3}\s|[-*•]\s|\d{1,3}[.)]\s|>|!>|->|\|)/, (m) => "​" + m)).join("\n"));
}
/** The editor's (or pasted) HTML as marks. */
export function htmlToMd(root: Node): string {
  const out: string[] = []; blocks(root, out);
  return out.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}
/** Pasted HTML (from Word, Google Docs or a web page), cleaned into what the editor can keep. */
export function cleanPaste(html: string): string {
  const d = new DOMParser().parseFromString(html, "text/html");
  return mdToHtml(htmlToMd(d.body));
}
