// Reads a designed menu (a PDF made in Canva, Word, InDesign…) from WHERE things are on the page, not only from its words:
// every piece of text and every picture comes with its box, and a dish is the photo, the name under it, its description and its
// price or its priced choices. No AI is involved. The rule-based list reader (lib/sysread) remains for plain price lists.
import type { PamphletProduct } from "./cfdb";

/** A piece of text and where it sits (pixels from the page's top-left corner; `h` is the size of its letters). */
export type LItem = { s: string; x: number; y: number; w: number; h: number };
/** A picture's box, and its number among the document's pictures. */
export type LPic = { x: number; y: number; w: number; h: number; i: number };
export type LPage = { n: number; w: number; h: number; items: LItem[]; pics: LPic[] };
export type LaidProduct = PamphletProduct & { /** the document picture that shows it, or -1 */ pic: number };
export type MenuLayout = { products: LaidProduct[]; /** lines that apply to the whole menu (tax, packaging) */ notes: string[]; /** pages that were read by their layout */ pages: number };

type Line = { t: string; x: number; y: number; w: number; h: number; right: number; /** its last piece stands apart, to the right */ gap: boolean; /** letter size of its first piece, and of its last */ h0: number; h1: number; /** the text before that last piece */ lead: string };
const CUR = "(?:₹|Rs\\.?|INR|rs\\.?)";
const AMT = "\\d{1,3}(?:,\\d{2,3})*(?:\\.\\d{1,2})?|\\d{1,6}(?:\\.\\d{1,2})?";
const ONE = `(?:${CUR}\\s?)?(?:${AMT})(?:\\s?\\/-)?`;
const WITH_CUR = new RegExp(`^(.*?)[\\s.·…_:\\-–—]*((?:${CUR})\\s?(?:${AMT})(?:\\s?\\/-)?(?:\\s*\\/\\s*${ONE}){0,5}|(?:${AMT})\\s?\\/-)\\s*$`);
const BARE = new RegExp(`^(.*?)[\\s.·…_:\\-–—]*\\b(\\d{2,5}(?:\\.\\d{1,2})?)\\s*$`);
const PAIR = new RegExp(`([^\\/]{1,40}?)\\s*[–—\\-:]\\s*(?:${CUR})\\s?(${AMT})`, "g");
const letters = (t: string) => (t.match(/\p{L}/gu) || []).length;
const num = (p: string) => (p.replace(/,/g, "").match(/\d+(?:\.\d{1,2})?/g) || [""]).map((x) => x.replace(/^0+(?=\d)/, "")).join(" / ");
/** "Oil – Rs. 109 / Butter – Rs. 129 / Cheese – Rs. 139": each choice with its price, when the whole line is made of them. */
function pairsOf(t: string): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = []; let rest = t;
  for (const m of t.matchAll(PAIR)) { out.push({ label: m[1].replace(/^[\s\/]+/, "").trim(), value: num(m[2]) }); rest = rest.replace(m[0], ""); }
  return out.length >= 2 && letters(rest) === 0 && out.every((x) => x.label) ? out : [];
}
const NOTE = /\b(gst|tax(es)?|vat|service charge|packaging|packing|parcel|delivery charge|extra)\b/i;

/** A line's name and price: "Thepla Jam Roll   Rs. 49". A number with no currency sign counts only when it stands apart at the end. */
function priceOf(l: Line): { name: string; price: string } | null {
  let m = WITH_CUR.exec(l.t); if (m) return { name: m[1].trim(), price: num(m[2]) };
  if (l.gap && (m = BARE.exec(l.t)) && letters(m[1]) >= 2) return { name: m[1].trim(), price: num(m[2]) };
  return null;
}
/** Text pieces on the same baseline, left to right, become one line. */
function linesOf(items: LItem[]): Line[] {
  const its = items.filter((i) => i.s.trim()).sort((a, b) => a.y + a.h - (b.y + b.h) || a.x - b.x), out: Line[] = [];
  let row: LItem[] = [];
  const flush = () => {
    if (!row.length) return; row.sort((a, b) => a.x - b.x);
    let t = "", gap = false; const h = Math.max(...row.map((r) => r.h));
    row.forEach((r, k) => { if (k) { const d = r.x - (row[k - 1].x + row[k - 1].w); if (d > h * 0.15 || !/\s$/.test(t)) t += d > h * 0.15 ? " " : ""; if (k === row.length - 1 && d > h * 1.2) gap = true; } t += r.s; });
    const x = row[0].x, right = Math.max(...row.map((r) => r.x + r.w)), y = Math.min(...row.map((r) => r.y));
    const lead = gap ? row.slice(0, -1).map((r) => r.s).join(" ").replace(/\s+/g, " ").trim() : "";
    out.push({ t: t.replace(/\s+/g, " ").replace(/^[•·▪■◦*\-–]\s+/, "").trim(), x, y, w: right - x, h, right, gap, h0: row[0].h, h1: row[row.length - 1].h, lead }); row = [];
  };
  for (const it of its) { const last = row[row.length - 1]; if (last && Math.abs(it.y + it.h - (last.y + last.h)) > Math.max(it.h, last.h) * 0.45) flush(); row.push(it); }
  flush();
  return out.filter((l) => l.t).sort((a, b) => a.y - b.y || a.x - b.x);
}
const blank = (name: string, page: number): LaidProduct => ({ name, category: "", summary: "", price: "", features: [], details: "", specs: [], page, pic: -1 });

/** Where the page's columns part: between groups of photos that stand side by side, or (with no photos) down an empty strip of the page. */
function columnEdges(pg: LPage, pics: LPic[], body: LItem[]): number[] {
  if (pics.length) {
    const cx = pics.map((p) => ({ c: p.x + p.w / 2, l: p.x, r: p.x + p.w })).sort((a, b) => a.c - b.c), groups: { l: number; r: number; c: number }[] = [];
    for (const p of cx) { const g = groups[groups.length - 1]; if (g && p.c - g.c < pg.w * 0.12) { g.l = Math.min(g.l, p.l); g.r = Math.max(g.r, p.r); } else groups.push({ ...p }); }
    return groups.slice(1).map((g, k) => (groups[k].r + g.l) / 2);
  }
  // no photos: an empty vertical strip near the middle of the text, at least 3% of the page wide
  const N = 200, used = new Array(N).fill(0);
  for (const it of body) for (let k = Math.max(0, Math.floor((it.x / pg.w) * N)); k <= Math.min(N - 1, Math.floor(((it.x + it.w) / pg.w) * N)); k++) used[k]++;
  const edges: number[] = []; let s = -1;
  for (let k = Math.floor(N * 0.25); k <= Math.floor(N * 0.75); k++) { if (!used[k]) { if (s < 0) s = k; } else if (s >= 0) { if (k - s >= N * 0.03) edges.push(((s + k) / 2 / N) * pg.w); s = -1; } }
  return edges;
}

const ONLY_PRICE = new RegExp(`^\\s*(?:${CUR})?\\s?((?:${AMT})(?:\\s*\\/\\s*${ONE}){0,5})\\s*(?:\\/-)?\\s*$`);
const stripBr = (t: string) => t.replace(/\s*[\[(][^\])]*[\])]\s*/g, " ").replace(/\s+/g, " ").trim();
/** "Dry Sabji [150ml / 250ml]" at "59 / 99": the bracket names each price. */
function sizedBy(name: string, price: string): { name: string; specs: { label: string; value: string }[] } {
  const ps = price.split(" / "); if (ps.length < 2) return { name, specs: [] };
  const m = /[\[(]([^()\[\]]*\/[^()\[\]]*)[\])]/.exec(name), ls = m ? m[1].split("/").map((x) => x.trim()).filter(Boolean) : [];
  return m && ls.length === ps.length ? { name: name.replace(m[0], " ").replace(/\s+/g, " ").trim(), specs: ls.map((l, k) => ({ label: l.slice(0, 40), value: ps[k] })) } : { name, specs: ps.map((v, k) => ({ label: "Choice " + (k + 1), value: v })) };
}

export function menuFromLayout(pages: LPage[]): MenuLayout {
  // Ornaments (a corner flourish, a divider) are pictures too: one that sits in exactly the same place on many pages is not a dish.
  const seen = new Map<string, number>(), key = (pg: LPage, p: LPic) => [p.x / pg.w, p.y / pg.h, p.w / pg.w, p.h / pg.h].map((v) => Math.round(v * 200)).join(",");
  for (const pg of pages) for (const k of new Set(pg.pics.map((p) => key(pg, p)))) seen.set(k, (seen.get(k) || 0) + 1);
  const often = Math.max(3, Math.ceil(pages.length * 0.4));
  const products: LaidProduct[] = [], notes: string[] = []; let category = "", read = 0;
  const note = (t: string) => { t = t.replace(/[\s,;]+$/, "").trim(); if (t && !notes.includes(t)) notes.push(t); };

  for (const pg of pages) {
    const area = pg.w * pg.h;
    const pics = pg.pics.filter((p) => (seen.get(key(pg, p)) || 0) < often && p.w * p.h > area * 0.008 && p.w * p.h < area * 0.6 && p.w < pg.w * 0.85 && p.w / p.h < 5 && p.h / p.w < 5).sort((a, b) => a.y - b.y || a.x - b.x);
    const all = linesOf(pg.items); if (!all.length) continue;
    const isPriced = (l: Line) => !!priceOf(l) || ONLY_PRICE.test(l.t) || pairsOf(l.t).length > 0;
    if (!all.some(isPriced)) continue;                                   // a cover, an "about us" or an address page
    // The page's title (the section of the menu): the biggest line above the first photo and the first price, clearly bigger than
    // the usual text. Smaller lines beside it ("11.30 AM onwards") are its note.
    const firstPic = pics.length ? Math.min(...pics.map((p) => p.y)) : Infinity, firstPrice = Math.min(...all.filter(isPriced).map((l) => l.y));
    const hs = all.map((l) => l.h).sort((a, b) => a - b), usual = hs[Math.floor(hs.length / 2)];
    const heads = all.filter((l) => l.y + l.h * 0.5 < Math.min(firstPic, firstPrice) && !isPriced(l));
    const big = heads.length ? Math.max(...heads.map((l) => l.h)) : 0, hasTitle = big >= usual * 1.3;
    const title = hasTitle ? heads.filter((l) => l.h >= big * 0.92) : [];
    const titleEnd = title.length ? Math.max(...title.map((l) => l.y + l.h)) : -1;
    const sub = hasTitle ? heads.filter((l) => !title.includes(l) && l.y < titleEnd + big * 0.9 && l.y >= titleEnd - big * 0.3 && Math.abs(l.x + l.w / 2 - (title[0].x + title[0].w / 2)) < pg.w * 0.08) : [];
    if (hasTitle) { category = title.map((l) => l.t).join(" ").slice(0, 60); for (const l of sub) note(`${category}: ${l.t.replace(/^[(\[]|[)\]]$/g, "")}`); }
    read++;
    const gone = new Set([...title, ...sub]);
    const inGone = (i: LItem) => [...gone].some((l) => i.y + i.h / 2 >= l.y && i.y + i.h / 2 <= l.y + l.h && i.x >= l.x - 2 && i.x + i.w <= l.right + 2);
    const bodyItems = pg.items.filter((i) => i.s.trim() && !inGone(i));
    const edges = columnEdges(pg, pics, bodyItems), colOf = (x: number) => edges.filter((e) => x > e).length;
    // Lines are built again inside each column, so a name and its price join but the neighbouring column's text does not.
    const spans = (i: LItem) => edges.some((e) => i.x < e - i.w * 0.15 && i.x + i.w > e + i.w * 0.15);
    for (const l of linesOf(bodyItems.filter(spans))) if (NOTE.test(l.t)) note(l.t);

    type Dish = { p: LaidProduct; head: boolean; open: boolean; vars: { label: string; value: string }[]; y0: number; y1: number; x0: number; x1: number; last: Line | null };
    const dishes: Dish[] = [], usedPics = new Set<number>();
    for (let c = 0; c <= edges.length; c++) {
      const lines = linesOf(bodyItems.filter((i) => !spans(i) && colOf(i.x + i.w / 2) === c)), cp = pics.filter((p) => colOf(p.x + p.w / 2) === c);
      // Blocks: each photo with the text that belongs to it (under or beside it; or over it, when the menu puts names above photos).
      let blocks: { pic: number; lines: Line[] }[] = [];
      if (!cp.length) blocks = [{ pic: -1, lines }];
      else {
        const above = lines.filter((l) => l.y + l.h < cp[0].y), below = lines.filter((l) => l.y >= cp[cp.length - 1].y + cp[cp.length - 1].h);
        const over = above.some(isPriced) && !below.some(isPriced) && !lines.some((l) => l.y >= cp[0].y && l.y < cp[0].y + cp[0].h && isPriced(l));
        blocks = cp.map((p, k) => ({ pic: p.i, lines: lines.filter((l) => (over ? l.y < p.y && (k === 0 || l.y >= cp[k - 1].y) : l.y >= p.y - l.h && (k === cp.length - 1 || l.y < cp[k + 1].y - l.h))) }));
        const stray = lines.filter((l) => !blocks.some((b) => b.lines.includes(l))); if (stray.length) blocks.unshift({ pic: -1, lines: stray });
      }
      for (const b of blocks) {
        // a line that ends with "/" runs on into the next one ("Oil – Rs. 109 / Butter – Rs. 129 /" + "Cheese – Rs. 139")
        const ls: Line[] = [];
        for (const l of b.lines.sort((x, y) => x.y - y.y)) { const pv = ls[ls.length - 1]; if (pv && /\/\s*$/.test(pv.t) && Math.abs(pv.h - l.h) < pv.h * 0.15) { pv.t += " " + l.t; pv.w = Math.max(pv.right, l.right) - Math.min(pv.x, l.x); pv.gap = false; } else ls.push({ ...l }); }
        if (!ls.length) continue;
        const plain = ls.filter((l) => !isPriced(l) || (l.gap && l.h0 < l.h1 * 0.85)), H = plain.length ? Math.max(...plain.map((l) => (isPriced(l) ? l.h0 : l.h))) : 0;
        let cur: Dish | null = null, first = true, group = "";
        const start = (name: string, head: boolean, l: Line): Dish => { const d: Dish = { p: { ...blank(name, pg.n), category: group || category, pic: first ? b.pic : -1 }, head, open: head, vars: [], y0: l.y, y1: l.y + l.h, x0: l.x, x1: l.right, last: null }; first = false; dishes.push(d); cur = d; return d; };
        const grow = (d: Dish, l: Line) => { d.y1 = Math.max(d.y1, l.y + l.h); d.x0 = Math.min(d.x0, l.x); d.x1 = Math.max(d.x1, l.right); };
        for (const l of ls) {
          const d = cur as Dish | null, pairs = pairsOf(l.t), only = ONLY_PRICE.exec(l.t);
          if (pairs.length) { if (d) { d.vars.push(...pairs); d.open = false; grow(d, l); } continue; }
          if (only) { if (d && !d.p.price && !d.vars.length) { d.p.price = num(only[1]); grow(d, l); } if (d) d.open = false; continue; }
          // a description with the price standing far to its right ("…for a quick ghar jaman.      Rs. 99")
          if (l.gap && l.h0 < l.h1 * 0.85 && d && !d.p.price && !d.vars.length) { const pr0 = priceOf(l); if (pr0) { d.p.price = pr0.price; d.p.summary = (d.p.summary ? d.p.summary + " " : "") + l.lead; d.open = false; grow(d, l); continue; } }
          if (/\s(MRP|M\.R\.P\.?)\s*$/i.test(l.t) && l.gap) { note(`${l.lead || l.t.replace(/\s+\S+$/, "")}: sold at MRP (not added, it has no price)`); continue; }
          const pr = priceOf(l);
          if (pr && letters(pr.name) >= 2) {
            const nm = pr.name.replace(/\s+(at|@|for|only)$/i, "").trim();
            if (d && d.head && !d.p.price) { d.vars.push({ label: nm, value: pr.price }); d.open = false; grow(d, l); }
            else {
              // priced lines after a dish that already has its price are dishes of their own; a short line just before them names the group
              if (d && d.head && d.p.price && d.last && d.last.t.split(" ").length <= 4 && !/[.,;]$/.test(d.last.t) && d.p.summary.endsWith(d.last.t)) { group = d.last.t.replace(/[:\s]+$/, ""); d.p.summary = d.p.summary.slice(0, -d.last.t.length).trim(); d.last = null; }
              const z = sizedBy(nm, pr.price), nd = start(z.name, false, l); if (group) nd.p.category = group;
              if (z.specs.length) { nd.p.specs = z.specs; nd.p.price = z.specs.map((x) => x.value).join(" / "); } else nd.p.price = pr.price;
            }
            continue;
          }
          if (NOTE.test(l.t) && l.h < H * 0.92 && /\b(will be|applied|applicable|charges?)\b/i.test(l.t)) { note(l.t); continue; }
          if (l.h >= H * 0.92 && letters(l.t) >= 2) { if (d && d.head && d.open) { d.p.name += " " + l.t; grow(d, l); } else start(l.t, true, l); }
          else if (d) { d.p.summary = (d.p.summary ? d.p.summary + " " : "") + l.t; d.last = l; if (d.head) d.open = false; grow(d, l); }
        }
      }
    }
    // A photo that got no dish (it stands beside its text, in the next column) goes to the dish without one that it stands level with.
    for (const d of dishes) if (d.p.pic >= 0) usedPics.add(d.p.pic);
    for (const pc of pics) {
      if (usedPics.has(pc.i)) continue;
      const cand = dishes.filter((d) => d.p.pic < 0 && (d.p.price || d.vars.length)).map((d) => ({ d, ov: Math.min(d.y1, pc.y + pc.h) - Math.max(d.y0, pc.y) })).filter((x) => x.ov > 0 && x.ov >= (x.d.y1 - x.d.y0) * 0.5).sort((a, b) => b.ov - a.ov)[0];
      if (cand) { cand.d.p.pic = pc.i; usedPics.add(pc.i); }
    }
    for (const d of dishes) {
      const q = d.p, bare = stripBr(q.name).toLowerCase();
      if (d.vars.length === 1 && !q.price) q.price = d.vars[0].value;
      else if (d.vars.length > 1) {
        // "Regular Khakhra Chaat [2pc]" under "Khakhra Chaat [2pc]" is the choice "Regular".
        const short = (v: string) => { const low = v.toLowerCase(); for (const h of [q.name.toLowerCase(), bare]) { const at = h ? low.indexOf(h) : -1; if (at >= 0) { const r = stripBr(v.slice(0, at) + " " + v.slice(at + h.length)); if (letters(r) >= 2) return r; } } return v; };
        // …but only when every choice can be shortened that way; otherwise they all keep their full names.
        const cut = d.vars.map((v) => short(v.label)), allCut = cut.every((c, k) => c !== d.vars[k].label);
        q.specs = d.vars.map((v, k) => ({ label: (allCut ? cut[k] : v.label).slice(0, 60), value: v.value })); q.price = q.specs.map((x) => x.value).join(" / ");
      }
      q.name = q.name.replace(/\s+/g, " ").trim().slice(0, 90); q.summary = q.summary.replace(/\s+/g, " ").trim().slice(0, 400);
      if (q.price && letters(q.name) >= 2) products.push(q);
    }
  }
  return { products, notes, pages: read };
}
