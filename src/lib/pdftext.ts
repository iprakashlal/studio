// "Fill from a PDF" for long text boxes (static pages): reads a PDF's text with pdf.js and turns it into the simple
// marks those boxes use: ## headings (larger or bold short lines), - bullets, 1. numbers, paragraphs from line gaps.
// Page numbers and the header/footer lines repeated on most pages are left out.
import { readPdf, type PdfItem } from "./linkedin";

// Where pdf.js lives: next to the site's admin.js (cms/), or in the Studio's runtime/ folder.
const SCRIPT = typeof document !== "undefined" ? (document.currentScript as HTMLScriptElement | null)?.src : undefined;
export const pdfBase = () => (SCRIPT ? new URL("./", SCRIPT).href : new URL("runtime/", location.href).href);

type Line = { page: number; x: number; end: number; y: number; size: number; bold: boolean; text: string; mark?: "li" | "ol"; num?: string };
const BULLET = /^[•●▪◦▸►‣∙·○■□–—*-]\s*/;
const NUMBER = /^(\(?\d{1,3}[.)]|\(?[a-z][.)]|\(?[ivx]{1,4}[.)])\s+/i;
const MARK = /^([•●▪◦▸►‣∙·○■□–—*-]|\(?\d{1,3}[.)]?|\(?[a-z][.)])$/i;

/** Text runs → lines: runs at the same height on a page, read left to right. A lone bullet or number at the start
 *  of a line (drawn as its own run) marks a list item. */
function lines(items: PdfItem[]): Line[] {
  const groups: PdfItem[][] = [];
  const sorted = [...items].sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);
  for (const it of sorted) {
    const g = groups[groups.length - 1];
    if (g && g[0].page === it.page && Math.abs(g[0].y - it.y) <= Math.max(2, Math.min(g[0].size, it.size) * 0.45)) g.push(it); else groups.push([it]);
  }
  const out: Line[] = [];
  for (const g0 of groups) {
    const g = g0.sort((a, b) => a.x - b.x);
    let mark: Line["mark"], num: string | undefined;
    if (g.length > 1 && MARK.test(g[0].text.trim())) {
      const m = g[0].text.trim(); mark = /^\(?\d/.test(m) ? "ol" : /^\(?[a-z][.)]$/i.test(m) ? "ol" : "li"; num = m.replace(/[^\da-z]/gi, ""); g.shift();
    }
    let text = "", end = -1e9;
    for (const it of g) {
      const gap = it.x - end;
      text += (text && gap > it.size * 0.15 && !/\s$/.test(text) && !/^\s/.test(it.text) ? " " : "") + it.text;
      end = it.x + (it.w || it.text.length * it.size * 0.5);
    }
    const main = g.reduce((a, b) => (b.text.trim().length > a.text.trim().length ? b : a), g[0]);
    const words = g.filter((x) => x.text.trim().length > 1);
    text = text.replace(/\s+/g, " ").trim();
    if (text) out.push({ page: main.page, x: g[0].x, end, y: main.y, size: main.size, bold: words.length > 0 && words.every((x) => !!x.bold), text, mark, num });
  }
  return out;
}

/** The PDF as plain text with marks, and its title when the first line stands out. */
export function pdfItemsToText(items: PdfItem[]): { title: string; text: string } {
  let ls = lines(items);
  if (!ls.length) throw new Error("This PDF has no text to copy. It may be a scan or a picture: paste the text instead.");
  const pages = new Set(ls.map((l) => l.page)).size;
  // Page numbers, and header/footer lines repeated on most pages
  const norm = (t: string) => t.toLowerCase().replace(/\d+/g, "#");
  const count = new Map<string, number>();
  if (pages >= 3) for (const k of new Set(ls.map((l) => l.page + "|" + norm(l.text)))) { const n = k.split("|").slice(1).join("|"); count.set(n, (count.get(n) || 0) + 1); }
  ls = ls.filter((l) => !/^(page\s*)?\d{1,4}(\s*(of|\/)\s*\d{1,4})?$/i.test(l.text) && !(pages >= 3 && (count.get(norm(l.text)) || 0) >= Math.max(3, pages * 0.6)));
  if (!ls.length) throw new Error("This PDF has no text to copy.");
  // The body text size: the size most of the words are in
  const weight = new Map<number, number>();
  for (const l of ls) weight.set(l.size, (weight.get(l.size) || 0) + l.text.length);
  const body = [...weight.entries()].sort((a, b) => b[1] - a[1])[0][0];
  // Tiny print (running headers and footers, footnote marks) is left out
  ls = ls.filter((l) => l.size > body * 0.68);
  // The text's left margin and right edge: lines set in from the margin with no bullet glyph are list items whose
  // bullets were drawn as shapes (PDFs printed from a browser or a word processor).
  const bodyLs = ls.filter((l) => Math.abs(l.size - body) < 0.6 && !l.mark);
  const xs = new Map<number, number>();
  for (const l of bodyLs) { const k = Math.round(l.x); xs.set(k, (xs.get(k) || 0) + l.text.length); }
  const margin = xs.size ? [...xs.entries()].sort((a, b) => b[1] - a[1])[0][0] : 0;
  const right = Math.max(0, ...bodyLs.map((l) => l.end));
  const inset = (l: Line) => !l.mark && l.x > margin + body * 0.9 && l.x < margin + body * 8 && Math.abs(l.size - body) < 0.6;
  let prevIn: Line | null = null;
  for (const l of ls) {
    if (!inset(l) || BULLET.test(l.text) || NUMBER.test(l.text)) { prevIn = null; continue; }
    // a wrapped line continues the item: same indent, the line above ran to the right edge and didn't end a sentence
    const wraps = prevIn && prevIn.page === l.page && Math.abs(prevIn.x - l.x) < 1.5 && prevIn.end > right - body * 4 && !/[.;:!?]$/.test(prevIn.text);
    if (!wraps) l.mark = "li";
    prevIn = l;
  }
  // Usual distance between lines of a paragraph
  const gaps: number[] = [];
  for (let i = 1; i < ls.length; i++) if (ls[i].page === ls[i - 1].page) { const g = ls[i].y - ls[i - 1].y; if (g > 0) gaps.push(g); }
  gaps.sort((a, b) => a - b);
  const lineGap = gaps.length ? gaps[Math.floor(gaps.length * 0.4)] : body * 1.4;

  const kind = (l: Line) => {
    const short = l.text.length <= 90 && !/[.,;:]$/.test(l.text);
    if (l.size >= body * 1.12 && l.text.length <= 140) return "h2";
    if (l.size >= body * 1.03 && short && l.bold) return "h3";
    if (l.bold && short && l.text.length <= 70 && !BULLET.test(l.text)) return "h3";
    if (l.mark) return l.mark;
    if (BULLET.test(l.text) && !/^-\d/.test(l.text)) return "li";
    if (NUMBER.test(l.text)) return "ol";
    return "p";
  };
  let title = "";
  const first = ls[0];
  if (first && first.size >= body * 1.3 && first.text.length <= 120) { title = first.text; ls = ls.slice(1); }

  const blocks: string[] = [];
  let cur: { k: string; text: string; last: Line } | null = null;
  const flush = () => { if (cur) blocks.push(cur.k === "h2" ? "## " + cur.text : cur.k === "h3" ? "### " + cur.text : cur.text); cur = null; };
  const join = (a: string, b: string) => (/[A-Za-z]-$/.test(a) && /^[a-z]/.test(b) ? a.slice(0, -1) + b : a + " " + b);
  for (const l of ls) {
    const k = kind(l);
    const gap = cur && cur.last.page === l.page ? l.y - cur.last.y : cur ? lineGap : 0;
    const sameBlock = cur && gap <= lineGap * 1.35 + 0.5;
    if (k === "li" || k === "ol") {
      flush();
      const t = k === "li" ? "- " + (l.mark ? l.text : l.text.replace(BULLET, "")) : l.mark ? (/^\d+$/.test(l.num || "") ? l.num : "1") + ". " + l.text : l.text.replace(/^\(?(\d{1,3})[.)]\s+/, "$1. ");
      cur = { k: "item", text: t, last: l }; continue;
    }
    if (k === "h2" || k === "h3") {
      if (cur && cur.k === k && sameBlock && Math.abs(cur.last.size - l.size) < 0.6) { cur.text = join(cur.text, l.text); cur.last = l; continue; }
      flush(); cur = { k, text: l.text, last: l }; continue;
    }
    // body text: continues a paragraph or a list item's wrapped line, else starts a new paragraph
    // (a list item's wrapped line is indented like the item's words; text back at the margin is a new paragraph)
    if (cur && (cur.k === "p" || (cur.k === "item" && l.x >= cur.last.x - 2)) && sameBlock) { cur.text = join(cur.text, l.text); cur.last = l; continue; }
    flush(); cur = { k: "p", text: l.text, last: l };
  }
  flush();
  // Bullets and numbers that follow each other stay together (one line each); everything else gets a blank line
  let text = "";
  blocks.forEach((b, i) => {
    const kindOf = (x: string) => (x.startsWith("- ") ? "ul" : /^\d{1,3}\. /.test(x) ? "ol" : "");
    const item = kindOf(b), prevItem = i > 0 ? kindOf(blocks[i - 1]) : "";
    text += (i === 0 ? "" : item && item === prevItem ? "\n" : "\n\n") + b;
  });
  return { title, text: text.trim() };
}

export async function pdfToText(file: File): Promise<{ title: string; text: string }> {
  if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") throw new Error("Choose a PDF file.");
  if (file.size > 25 * 1024 * 1024) throw new Error("This PDF is larger than 25 MB.");
  let items: PdfItem[];
  try { items = await readPdf(await file.arrayBuffer(), pdfBase(), 80, true); }
  catch (e: any) { throw new Error(/didn't load/.test(e?.message || "") ? "The PDF reader didn't load. Check your connection; on a site's admin page, publish the site once from the Studio to add it." : /password/i.test(e?.message || "") ? "This PDF is password-protected. Save it without a password and try again." : "This file isn't a readable PDF."); }
  return pdfItemsToText(items);
}
