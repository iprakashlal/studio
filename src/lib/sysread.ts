// The Picaffectz system's reader: turns a pamphlet, price list, sheet or menu into catalogue entries on this device,
// by rules, with no AI service. Pictures of pages are read with the bundled text reader (lib/ocr.ts).
// It only ever uses what is printed: names, prices and lines are copied, nothing is made up. The owner reviews the
// result before it goes in, as with the Cloudflare reader.
import type { PamphletProduct } from "./cfdb";
import type { Pamphlet } from "./pamphlet";
import { readPicture } from "./ocr";

const clean = (s: string) => s.replace(/[•●■‣◦•●■◦]/g, " ").replace(/\s+/g, " ").trim();
const CUR = "(?:₹|Rs\\.?|INR|Rs|rs\\.?|\\$|€|£)";
const NUM = "\\d{1,3}(?:,\\d{2,3})*(?:\\.\\d{1,2})?|\\d{2,6}(?:\\.\\d{1,2})?";
const ONE = `(?:${CUR}\\s?)?(?:${NUM})(?:\\s?\\/-)?`;
/** "Paneer tikka ........ ₹320", "Tandoori chicken 360 / 620", "Dal - Rs. 240/-". */
const PRICED = new RegExp(`^(.{2,90}?)[\\s.\\-–—·…:_|]*?\\s((?:${ONE})(?:\\s*[\\/|,]\\s*(?:${ONE})){0,3})\\s*$`);
const ONLY_PRICE = new RegExp(`^(?:${ONE})(?:\\s*[\\/|]\\s*(?:${ONE})){0,3}$`);
const NOT_A_NAME = /(@|www\.|https?:|\+91|phone|mobile|\bcall\b|\d{3,}[\s-]\d{3,}|gstin|fssai|pin ?code|page \d|est\.?\s*\d{4}|since \d{4}|\bno\.\s*\d)/i;
const titleCase = (s: string) => (s === s.toUpperCase() && /[A-Z]/.test(s) ? s.toLowerCase().replace(/(^|[\s&/-])([a-z])/g, (_, a, b) => a + b.toUpperCase()).replace(/\b(And|Or|Of|The|With|In|On)\b/g, (w, i) => (i ? w.toLowerCase() : w)) : s);
const tidyPrice = (p: string) => clean(p).replace(/\s?\/-/g, "").replace(/\s*[\/|]\s*/g, " / ").replace(/(^|\/ )(Rs|rs|INR)\.?\s?/g, "$1₹").replace(/₹\s+/g, "₹");
/** Lines that end in a number but aren't a priced item: timings, addresses, seats. */
const NOT_PRICED = /\b(open|opens|closed?|closes|till|until|timings?|hours|a\.?m\.?|p\.?m\.?|serves?|seats?|table for|floor|road|street|lane|sector|plot|shop no|near|opp\.?|tel|ph|fax|since|est)\b/i;
const letters = (s: string) => (s.match(/\p{L}/gu) || []).length;

type Line = { t: string; page: number };
const linesOf = (text: string): Line[] => {
  const out: Line[] = []; let page = 1;
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const m = /^--- PAGE (\d+) ---$/.exec(raw.trim()); if (m) { page = +m[1]; continue; }
    const t = clean(raw.replace(/^[-–*#>\s]+/, "").replace(/\*\*/g, "")); if (t) out.push({ t, page });
  }
  return out;
};
const priced = (t: string): { name: string; price: string } | null => {
  const m = PRICED.exec(t); if (!m) return null;
  const name = clean(m[1].replace(/[\s.\-–—·…:_|]+$/, ""));
  if (letters(name) < 2 || NOT_A_NAME.test(t) || /^\d/.test(name) && letters(name) < 4) return null;
  // A bare number of six digits or more is a phone number or a code, not a price.
  if (/\d{6,}/.test(m[2].replace(/,/g, ""))) return null;
  // Without a currency sign or a dotted line to it, a small number or a line about timings or an address isn't a price.
  const money = new RegExp(CUR).test(m[2]) || /\/-/.test(m[2]), led = /[.·…_-]{3,}\s*$/.test(t.slice(0, t.length - m[2].length).trimEnd() + " ") || /[.·…_]{3,}/.test(t);
  if (!money && !led && (NOT_PRICED.test(name) || !/\d{2,}/.test(m[2]))) return null;
  return { name, price: tidyPrice(m[2]) };
};
/** A short line that names a group of the lines after it: "STARTERS", "Main Course:", "From the Tandoor". */
const heading = (L: Line[], i: number): boolean => {
  const t = L[i].t;
  if (t.length > 44 || t.split(" ").length > 6 || /\d/.test(t) || letters(t) < 3 || NOT_A_NAME.test(t) || /[.!?]$/.test(t)) return false;
  const shout = t === t.toUpperCase(), colon = /:$/.test(t), title = t.split(" ").every((w) => /^[A-Z&]/.test(w) || /^(and|or|of|the|with|in|on|from|&)$/i.test(w));
  if (!shout && !colon && !title) return false;
  // A name with its price on the next line is an item, not a heading.
  if (L[i + 1] && ONLY_PRICE.test(L[i + 1].t)) return false;
  // It is a heading only when priced lines follow it soon.
  for (let k = i + 1; k < Math.min(L.length, i + 5); k++) { if (priced(L[k].t) || ONLY_PRICE.test(L[k].t)) return true; if (heading(L, k)) return false; }
  return false;
};
const blank = (name: string, page: number): PamphletProduct => ({ name, category: "", summary: "", price: "", features: [], details: "", specs: [], page });

/** A menu or price list: one entry for each priced line, under the heading it is printed below. */
export function readList(text: string): PamphletProduct[] {
  const L = linesOf(text), out: PamphletProduct[] = [];
  let cat = "", last: PamphletProduct | null = null, waiting: Line | null = null;
  for (let i = 0; i < L.length; i++) {
    const { t, page } = L[i], p = priced(t);
    if (p) { last = { ...blank(p.name.slice(0, 120), page), category: cat, price: p.price }; out.push(last); waiting = null; continue; }
    // The price printed on its own line, under or beside the name (two columns read as two lines).
    if (ONLY_PRICE.test(t) && waiting && !/\d{6,}/.test(t)) { last = { ...blank(waiting.t.slice(0, 120), waiting.page), category: cat, price: tidyPrice(t) }; out.push(last); waiting = null; continue; }
    if (heading(L, i)) { cat = /^(price list|rate card|rate list|menu|our menu|catalogue|products?)$/i.test(t.replace(/:$/, "")) ? "" : titleCase(t.replace(/:$/, "")).slice(0, 60); last = null; waiting = null; continue; }
    // A sentence right under a dish is its description.
    if (last && !last.summary && t.length >= 12 && /[a-z]/.test(t) && !NOT_A_NAME.test(t) && letters(t) > t.length * 0.6) { last.summary = t.slice(0, 400); waiting = null; continue; }
    waiting = letters(t) >= 3 && t.length <= 70 && !NOT_A_NAME.test(t) ? L[i] : null;
  }
  return out;
}

const HEADS: [keyof PamphletProduct | "skip", RegExp][] = [
  ["name", /^(name|product|item|dish|title|model|product name|item name|description of goods)$/i], ["category", /^(category|group|type|section|range|series|course)$/i],
  ["price", /^(price|mrp|rate|cost|amount|selling price|price \(.*\)|rate \(.*\))$/i], ["summary", /^(summary|short description|description|about|tagline)$/i],
  ["details", /^(details|long description|full description|notes?)$/i], ["features", /^(features?|key features|highlights|points)$/i], ["skip", /^(s\.?\s?no\.?|sr\.?\s?no\.?|#|sl\.?\s?no\.?|serial)$/i],
];
/** A sheet: every row is one product; columns are matched by their headings, the rest become specifications. */
export function readRows(pages: { n: number; text: string }[]): PamphletProduct[] {
  const out: PamphletProduct[] = [];
  for (const pg of pages) {
    const p = blank("", pg.n);
    for (const cell of pg.text.split(" | ")) {
      const k = cell.indexOf(": "); if (k < 1) continue;
      const head = clean(cell.slice(0, k)), val = clean(cell.slice(k + 2)); if (!val) continue;
      const hit = HEADS.find(([, re]) => re.test(head))?.[0];
      if (hit === "skip") continue;
      if (hit === "features") p.features = val.split(/\s*[;•\n]\s*|\s*,\s+(?=[A-Z])/).map(clean).filter(Boolean).slice(0, 12);
      else if (hit && hit !== "specs" && hit !== "page" && !p[hit]) (p as any)[hit] = hit === "price" ? tidyPrice(val) : val;
      else p.specs.push({ label: head.slice(0, 80), value: val.slice(0, 200) });
    }
    // No "name" column: the first column that isn't a number names the row.
    if (!p.name) { const i = p.specs.findIndex((s) => letters(s.value) >= 2); if (i >= 0) p.name = p.specs.splice(i, 1)[0].value; }
    if (p.name) out.push({ ...p, name: p.name.slice(0, 120), specs: p.specs.slice(0, 30) });
  }
  return out;
}

const MODEL = /\b[A-Z]{1,6}[- ]?\d{2,5}[A-Z]?\b/;
/** One product described on a page: its name, the paragraph about it, "label: value" lines and the points under Features. */
function readOne(L: Line[], page: number): PamphletProduct | null {
  const lines = L.map((x) => x.t);
  let name = "", at = -1;
  for (let i = 0; i < lines.length && !name; i++) {
    const l = lines[i]; if (l.length > 60 || !MODEL.test(l) || /:|\|/.test(l)) continue; at = i;
    const prev = lines[i - 1] || ""; name = (/^[A-Z][A-Z0-9&.\- ]{1,24}$/.test(prev) && !MODEL.test(prev) && !l.toUpperCase().includes(prev.toUpperCase()) ? prev + " " : "") + l;
  }
  if (!name) { at = lines.findIndex((l) => l.length >= 3 && l.length <= 50 && /^[A-Z0-9][A-Z0-9&.\- ]+$/.test(l) && !NOT_A_NAME.test(l)); name = at >= 0 ? lines[at] : ""; }
  if (!name) { at = lines.findIndex((l) => l.length >= 3 && l.length <= 60 && letters(l) >= 3 && !/[.:|]/.test(l) && !NOT_A_NAME.test(l)); name = at >= 0 ? lines[at] : ""; }
  if (!name) return null;
  const p = blank(name.replace(/\s+/g, " "), page);
  for (const l of lines) {
    const m = /^([A-Za-z][^:|]{1,60}?)\s*[:|]\s*([^|]{1,160}?)\s*\|?$/.exec(l); if (!m || /https?$/i.test(m[1]) || /phone|email|call|www|website|address|contact|mobile|fax/i.test(m[1])) continue;
    if (/^(price|mrp|rate|cost)\b/i.test(m[1])) { if (!p.price) p.price = tidyPrice(m[2]); } else p.specs.push({ label: m[1].trim(), value: m[2].trim() });
  }
  p.summary = (lines.filter((l) => l.length > 60 && /[a-z]/.test(l) && !/:/.test(l) && !NOT_A_NAME.test(l)).sort((a, b) => b.length - a.length)[0] || "").slice(0, 400);
  const fi = lines.findIndex((l) => /^key\s*features|^features|^highlights/i.test(l));
  if (fi >= 0) for (const l of lines.slice(fi + 1)) { if (/:|\|/.test(l) || l.length > 90 || !/[a-z]/.test(l) || p.features.length >= 8) break; if (l.length > 3) p.features.push(l); }
  const next = lines[at + 1] || "";
  if (at >= 0 && next && next.length < 50 && !/[:.]/.test(next) && /^[A-Z]/.test(next) && next.split(" ").length >= 2 && next !== p.summary) p.category = titleCase(next);
  if (!p.price) { const m = lines.map((l) => new RegExp(`(?:price|mrp|rate)\\D{0,12}(${ONE})`, "i").exec(l)).find(Boolean); if (m) p.price = tidyPrice(m[1]); }
  p.specs = p.specs.slice(0, 30);
  return p;
}
/** A pamphlet: a page that is a price list gives one entry per line; a page about one product gives that product. */
export function readPages(text: string): PamphletProduct[] {
  const L = linesOf(text), byPage = new Map<number, Line[]>();
  for (const l of L) byPage.set(l.page, [...(byPage.get(l.page) || []), l]);
  const out: PamphletProduct[] = [];
  for (const [page, lines] of byPage) {
    const rows = readList(lines.map((l) => `--- PAGE ${page} ---\n${l.t}`).join("\n"));
    if (rows.length >= 3) { out.push(...rows); continue; }
    const one = readOne(lines, page); if (one) out.push(one);
  }
  // The same product on two pages is one entry: the later page fills what the first lacks.
  const seen = new Map<string, PamphletProduct>();
  for (const p of out) {
    const k = p.name.toLowerCase(), old = seen.get(k);
    if (!old) { seen.set(k, p); continue; }
    for (const f of ["category", "summary", "price", "details"] as const) if (!old[f] && p[f]) old[f] = p[f];
    if (!old.features.length) old.features = p.features; if (!old.specs.length) old.specs = p.specs;
  }
  return [...seen.values()];
}

export type SystemRead = PamphletProduct[] & { guessed?: boolean; system?: boolean; /** Pages that were pictures, and how sure the reader was (0–100). */ pictures?: number; sure?: number };
/** Reads the opened pamphlet on this device. `menu`: a restaurant's menu (every priced line is a dish). */
export async function systemProducts(doc: Pamphlet, o: { menu?: boolean; step?: (s: string) => void } = {}): Promise<SystemRead> {
  let text = doc.pages.filter((x) => x.text).map((x) => `--- PAGE ${x.n} ---\n${x.text}`).join("\n\n");
  const pics = doc.pages.filter((x) => x.image); let sure = 0;
  for (const [i, pg] of pics.entries()) {
    o.step?.(`Reading page picture ${i + 1} of ${pics.length} on this device`);
    const r = await readPicture(pg.image!, (s) => o.step?.(pics.length > 1 ? `Picture ${i + 1} of ${pics.length}: ${s}` : s));
    sure += r.sure; if (r.text) text += `\n\n--- PAGE ${pg.n} ---\n${r.text}`;
  }
  if (letters(text) < 20) throw new Error(pics.length ? "The on-device reader couldn't find readable text in those pictures. Use a sharper, straighter photo or the original PDF, or switch to Cloudflare AI for this file." : "Couldn't find any text in that file.");
  o.step?.(o.menu ? "Finding the dishes" : "Finding the products");
  const list: SystemRead = doc.kind === "sheet" ? readRows(doc.pages) : o.menu ? readList(text) : readPages(text);
  if (!list.length) throw new Error(o.menu ? "No lines with a price were found. The on-device reader looks for a dish followed by its price on the same line (or the line below)." : "No products could be picked out of that file by rules alone. A sheet with one product per row reads best, or switch to Cloudflare AI for this file.");
  list.system = true; list.pictures = pics.length; list.sure = pics.length ? Math.round(sure / pics.length) : 100;
  return Object.assign(list.slice(0, 200), { system: true, pictures: list.pictures, sure: list.sure }) as SystemRead;
}
