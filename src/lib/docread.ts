// What a document says, whatever its order: the details a website needs (name, tagline, contact, hours, story) and the
// things on offer (dishes, products, services) with their descriptions, prices and groups. Rule-based, no imports:
// it reads rows of cells (a table row is several cells; plain text is one), so a PDF table, a Word table and an Excel
// sheet all read the same way.

/** One line of the document. cells: what was side by side on it. page / y: where it was (a PDF), to pair pictures with items. */
export type DocRow = { cells: string[]; page?: number; y?: number; /** A PDF: where the row starts, where each cell starts, the size of its letters, and its column on a page laid out in two columns. */ x?: number; xe?: number; xs?: number[]; size?: number; col?: number;
  /** Set while reading a laid-out document: a heading told by its size, a group of things on offer, a thing on offer already read. */ head?: boolean; group?: string; item?: DocItem };
export type DocItem = { name: string; desc: string; price: string; cat: string; diet?: string; /** A picture the document gives as a link ("Photo: https://…"). */ img?: string; page?: number; y?: number; col?: number; /** The middle of its name across the page (a PDF). */ cx?: number;
  /** Kinds or sizes with their own prices ("Butter – Rs. 129"). */ sizes?: { label: string; price: string }[]; /** A third column of short points ("Key deliverables"). */ points?: string[]; /** Laid out as a card: its picture sits above its name. */ card?: boolean };
export type DocEntry = { title: string; body?: string; bullets?: string[] };
export type DocRead = { fields: Record<string, string>; items: DocItem[]; /** The money sign the prices carry ("$", "₹"…). */ money: string;
  /** A note under a group's heading ("11.30 AM onwards"), by group. */ groupNotes?: Record<string, string>;
  /** Other sections the document has, read from its headings and tables. */ sections?: { work?: { title: string; summary: string; client: string; result: string }[]; process?: DocEntry[]; highlights?: DocEntry[] } };

/** One piece of text on a PDF page, and a page of them. */
export type DocRun = { x: number; end: number; y: number; size: number; text: string };
export type DocPage = { width: number; height: number; runs: DocRun[] };

/** Plain text → rows (a tab separates cells). */
export const rowsOf = (text: string): DocRow[] => String(text || "").replace(/\r/g, "").split("\n").map((l) => ({ cells: l.split("\t").map((c) => c.replace(/\s+/g, " ").trim()).filter(Boolean) })).filter((r) => r.cells.length);
/** Rows → plain text, for the parts of the Studio that read a document as text: a row of two cells reads "Label: value", a longer one is joined with " | ". */
export const textOf = (rows: DocRow[]) => rows.map((r) => (r.cells.length === 2 && !/[:：]$/.test(r.cells[0]) ? `${r.cells[0]}: ${r.cells[1]}` : r.cells.join(" | "))).join("\n");
/** A one-line description: a long sentence is cut at its first natural break ("... serving", a comma), never mid-phrase. */
export function oneLine(v: string, max = 80): string {
  const t = v.replace(/\s+/g, " ").trim(); if (t.length <= max) return t.replace(/[.]+$/, "");
  const m = /^(.{18,}?)(?:,| serving\b| offering\b| providing\b| speciali[sz]ing\b| with\b| that\b| which\b| for\b| – | — | - )/.exec(t);
  const cut = m && m[1].length <= max ? m[1] : t.slice(0, max).replace(/\s+\S*$/, "");
  return cut.replace(/[,;]?\s+(and|or|with|&|the|a|an|of|in|for)$/i, "").trim();
}
const LIST = /^(our |main |key )?(services|products|menu|dishes|offerings|skills|what we offer|solutions|packages|items|specialit(y|ies)|treatments|courses|classes)$/;

const MONEY = "(?:₹|rs\\.?|inr|\\$|usd|€|eur|£|gbp|aed)";
const PRICE = new RegExp(`^${MONEY}?\\s*(\\d{1,3}(?:,\\d{3})+|\\d{1,7})(?:\\.(\\d{1,2}))?\\s*(?:/-|${MONEY})?$`, "i");
const TAIL_PRICE = new RegExp(`^(.{2,80}?)\\s*(?:[-–—:]|\\.{2,}|…)\\s*(${MONEY}?\\s*\\d[\\d,]*(?:\\.\\d{1,2})?)\\s*(?:/-)?$`, "i");
const MULTI = new RegExp(`^${MONEY}?\\s*\\d[\\d,.]*(?:\\s*/\\s*${MONEY}?\\s*\\d[\\d,.]*)+$`, "i");
/** No figure, but a price all the same ("MRP", "Seasonal"). */
const WORD_PRICE = /^(mrp|m\.r\.p\.?|market price|seasonal( price)?|as per (size|season|weight)|on request|price on request)$/i;
/** A name and its price with nothing but a space between ("Masala Dosa Rs. 80", "Rice Bowl at Rs. 159"): the money sign is what tells them apart. */
const SPACE_PRICE = new RegExp(`^(.{2,80}?)\\s+(?:(?:at|@|for|only)\\s+)?(${MONEY}\\s*\\d[\\d,]*(?:\\.\\d{1,2})?)\\s*(?:/-)?$`, "i");
const PAIR = `([^/|,;]{1,40}?)\\s*[-–—:]\\s*(${MONEY}\\s*\\d[\\d,]*(?:\\.\\d{1,2})?)`;
/** "Oil – Rs. 109 / Butter – Rs. 129 /": each kind with its own price. Null when the line is anything else. */
function pairsOf(t: string): { label: string; price: string }[] | null {
  const out: { label: string; price: string }[] = [], rest = t.replace(new RegExp(PAIR, "gi"), (_m, a, b) => { out.push({ label: String(a).trim(), price: num(b) }); return ""; });
  return out.length && !rest.replace(/[\s/|,;]+/g, "") ? out : null;
}
const STARTS_PRICE = new RegExp(`^${MONEY}\\s*(\\d|$)`, "i");
const TIME = /\d{1,2}(?::\d\d)?\s*(?:am|pm)?\s*(?:[-–—]|to)\s*\d{1,2}(?::\d\d)?\s*(?:am|pm)/i;
const DAYS = /\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\b|\b(daily|every ?day|weekdays?|weekends?)\b/i;
const sym = (p: string) => (/₹|rs|inr/i.test(p) ? "₹" : /\$|usd/i.test(p) ? "$" : /€|eur/i.test(p) ? "€" : /£|gbp/i.test(p) ? "£" : /aed/i.test(p) ? "AED" : "");
const num = (p: string) => { const m = /(\d[\d,]*)(?:\.(\d{1,2}))?/.exec(p); return m ? (m[1].replace(/,/g, "").replace(/^0+(?=\d)/, "")) + (m[2] ? "." + m[2].padEnd(2, "0") : "") : ""; };
const caps = (s: string) => { const L = s.replace(/[^A-Za-z]/g, ""); return L.length >= 3 && L === L.toUpperCase(); };
const title = (s: string) => s.toLowerCase().replace(/(^|[\s(/&-])([a-z])/g, (_m, a, b) => a + b.toUpperCase()).replace(/\b(And|Or|Of|The|For|With|In|On|A|An)\b/g, (w, _a, i) => (i ? w.toLowerCase() : w));

/** Which answer a label is for. Tried in order: the first that fits wins. */
const LABELS: [RegExp, string][] = [
  [/^((brand|business|company|caf[eé]|restaurant|store|shop|event|firm|studio|trade|legal|full|your|product|organi[sz]ation) )?name$|^brand$/, "name"],
  [/tagline|slogan|motto|hero headline|main headline|^headline$|^title line$/, "tagline"],
  [/hero (text|copy|line)|^intro(duction)?$|sub-?headline|short description|what we do|what (you|we|i) (sell|do)|^description$|one-?liner|^cuisines?$|^industry$|^role$|^job title$|^profession$|^speciali[sz]ation$|business type|^about$|^summary$/, "about"],
  [/minimum order/, "minorder"], [/free (shipping|delivery)/, "freeship"], [/delivery time|dispatch/, "dtime"], [/shipping (fee|charge|cost)|flat shipping/, "ship"], [/returns?( policy)?$|refund/, "returns"],
  [/address|^location$|^venue$|where (to find|we are)/, "address"],
  [/e-?mail/, "email"],
  [/phone|mobile|whatsapp|contact (no|number)|^call|^tel\b|helpline/, "phone"],
  [/website|domain|^url$|^web$/, "domain"],
  [/instagram|social/, "social"],
  [/hours|timings?$|open(ing)? times?/, "hours"],
  [/^city$|^town$/, "city"],
  [/founded|established|^since$|year (started|founded)/, "founded"],
  [/team size|employees|staff/, "teamsize"],
  [/amenities|features|highlights|why (choose|us)|usp|specialt(y|ies)|tags$|^extras$|perks|facilities/, "usp"],
  [/cost for two/, "cost"], [/gst/, "gstin"], [/mission|vision/, "mission"],
  [/^(event )?date$|^when$/, "edate"], [/^(start )?time$/, "etime"],
  [/our story|about (us|the (company|store|caf[eé]|restaurant|brand))|^story$|who we are|^bio$|^biography$/, "story"],
];
/** What a heading is about. */
function headKind(t: string): "hours" | "items" | "facts" | "about" | "places" | "other" {
  const x = t.toLowerCase();
  if (/hours|timings|opening|service schedule/.test(x)) return "hours";
  if (/\b(our )?(locations|outlets|branches|stores|addresses)\b|find us|visit us|where to find/.test(x) && x.length <= 40) return "places";
  if (/mission|company overview|about (us|me)\b|our story|who we are/.test(x) && !/menu|products|services/.test(x)) return "about";
  if (/\bmenu\b|products?|catalogu?e|price list|pricing|\bitems\b|dishes|services|offerings|packages|rate card|collection|what we (offer|sell|do)|tickets/.test(x) && !/policy|polic|footer/.test(x)) return "items";
  if (/contact|profile|details|information|basics|at a glance|business info|overview/.test(x)) return "facts";
  if (/about|story|who we are|introduction|bio\b/.test(x)) return "about";
  return "other";
}
const NUMBERED = /^\d{1,2}[.)]\s+(?=\S)/;
/** A heading that names one of the other sections a website can show. */
function topicOf(t: string): "work" | "process" | "highlights" | "" {
  const x = t.toLowerCase();
  if (/case stud|success stor|(our|selected|recent|featured) (work|projects)|featured client|^(\d+[.)]\s*)?(projects|portfolio|our work)$/.test(x)) return "work";
  if (/process|how (we|i|it) works?|our approach|methodology|engagement model|how to order/.test(x)) return "process";
  if (/why (partner|choose|us|work|we|people)|what sets us|what makes us|our (strengths|difference|promise)|^(\d+[.)]\s*)?highlights$/.test(x)) return "highlights";
  return "";
}
const unbracket = (v: string) => v.replace(/^\[\s*([^\[\]]*?)\s*\]([.,;:]?)$/, "$1");
const isHead = (r: DocRow, inItems = false) => { if (r.head) return true; const t = r.cells.join(" "); if (t.length > 90) return false; if (NUMBERED.test(t)) return caps(t) || (!inItems && !TAIL_PRICE.test(t) && !(r.cells.length >= 2 && PRICE.test(r.cells[r.cells.length - 1]))); return r.cells.length === 1 && caps(t) && t.split(/\s+/).length >= 2 && !PRICE.test(t); };

/** A section's rows as a list: a row of two cells is a title and its text; so is "Title: text"; other lines continue the one above. */
function entriesOf(rows: DocRow[]): DocEntry[] {
  const out: DocEntry[] = []; let cur: DocEntry | null = null;
  const name = (t: string) => unbracket(t).replace(/^\d{1,2}[.)]\s*/, "").replace(/^(step|phase|stage)\s*\d+\s*[:.–—-]\s*/i, "").trim();
  rows.forEach((r, i) => {
    const c = r.cells;
    if (c.length >= 2) { if (!i && c.every((x) => x.length <= 40 && !/[.!?]$/.test(x))) return; cur = { title: name(c[0]).slice(0, 70), body: c.slice(1).join(" ") }; out.push(cur); return; }
    const m = /^(.{2,60}?)\s*(?:[:：]|\s[–—-])\s+(.{3,})$/.exec(c[0]);
    if (m && m[1].split(/\s+/).length <= 8) { cur = { title: name(m[1]).slice(0, 70), body: m[2] }; out.push(cur); }
    else if (cur) cur.body = ((cur.body || "") + " " + c[0]).trim();
    else if (c[0].length <= 60 && !/[.!?]$/.test(c[0])) { cur = { title: name(c[0]), body: "" }; out.push(cur); }
  });
  return out.filter((e) => e.title && !/^(start a conversation|contact( us)?|get in touch|let.?s talk|ready to|next steps?)\b/i.test(e.title)).map((e) => ({ ...e, body: (e.body || "").slice(0, 400) })).slice(0, 8);
}
/** Case studies: each starts at "Case Study 1: …" (or a short title); "Challenge:", "Solution:", "Result:" lines are its text. */
function workOf(rows: DocRow[]): { title: string; summary: string; client: string; result: string }[] {
  const out: { title: string; summary: string; client: string; result: string }[] = []; const st: { cur: (typeof out)[number] | null } = { cur: null };
  const start = (t0: string) => { const t = unbracket(t0.trim()), [a, ...b] = t.split(/\s+[–—-]\s+/); st.cur = b.length ? { title: unbracket(b.join(" – ")).replace(/^e\.g\.,?\s*/i, ""), client: unbracket(a), summary: "", result: "" } : { title: unbracket(t), client: "", summary: "", result: "" }; out.push(st.cur); };
  for (const r of rows) {
    const cur = st.cur;
    const t = r.cells.length === 2 ? `${r.cells[0]}: ${r.cells[1]}` : r.cells.join(" "), cs = /^(?:case study|project|client story|case|client)\s*#?\d*\s*[:：.–—-]\s*(.{3,})$/i.exec(t), part = /^(challenge|problem|situation|background|brief|solution|outcome|results?|approach|impact|what we did)[^:：]{0,24}[:：]\s*(.+)$/i.exec(t);
    if (cs) start(cs[1]);
    else if (part && cur) { if (/^(outcome|results?|impact)/i.test(part[1])) cur.result = part[2].length <= 90 ? part[2] : ""; cur.summary = (cur.summary + " " + part[2]).trim(); }
    else if (cur && (cur.summary || t.length > 70)) cur.summary = (cur.summary + " " + t).trim();
    else if (t.length <= 70 && !/[.!?]$/.test(t)) start(t);
  }
  return out.filter((w) => w.title && w.summary).map((w) => ({ title: w.title.slice(0, 80), client: w.client.slice(0, 50), summary: w.summary.length <= 420 ? w.summary : (/^[\s\S]{120,420}[.!?](?=\s)/.exec(w.summary)?.[0] || w.summary.slice(0, 420)), result: w.result.slice(0, 90) })).slice(0, 6);
}
const pricedRow = (r: DocRow) => { const l = r.cells[r.cells.length - 1]; return r.cells.length >= 2 && (PRICE.test(l) || WORD_PRICE.test(l) || MULTI.test(l)); };
/** A document laid out by a designer (a PDF menu, a brochure) says what is what by the size of its letters and where things sit, not with labels.
 *  This finds, by size: headings; a card (a name, smaller lines describing it, then its price or its kinds with their prices); and a line printed on
 *  every page (a footer). Cards become things on offer; a heading with things on offer under it becomes their group. */
function layout(rows0: DocRow[]): { rows: DocRow[]; note: string; title: string; intro: string; groupNotes: Record<string, string> } {
  const groupNotes: Record<string, string> = {}; let note = "", title = "", intro = "";
  if (!rows0.some((r) => r.size)) return { rows: rows0, note, title, intro, groupNotes };
  // A line on three or more pages is a footer: it is read once, as a note.
  const pagesOf = new Map<string, Set<number>>(); for (const r of rows0) { const t = r.cells.join(" "); if (t.length >= 8) (pagesOf.get(t) || pagesOf.set(t, new Set()).get(t)!).add(r.page || 0); }
  const footer = (r: DocRow) => (pagesOf.get(r.cells.join(" "))?.size || 0) >= 3;
  note = rows0.filter(footer).map((r) => r.cells.join(" ")).find((t) => /gst|tax|charges?|packag|service/i.test(t))?.replace(/[,;]\s*$/, ".") || "";
  const rows = rows0.filter((r) => !footer(r)), sz = (r: DocRow) => r.size || 0, single = (r: DocRow) => r.cells.length === 1;
  const mate = (a: DocRow, b: DocRow | undefined) => !!b && a.page === b.page && (a.col === undefined || a.col === b.col);
  // The size most of the words are in: a short line far bigger than that is a heading wherever it stands.
  const bySize = new Map<number, number>(); for (const r of rows) bySize.set(Math.round(sz(r)), (bySize.get(Math.round(sz(r))) || 0) + r.cells.join("").length);
  const body = [...bySize.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 10;
  const big = (i: number) => { const r = rows[i], n = rows[i + 1], t = r.cells[0]; return single(r) && t.length <= 70 && !/[:：]$/.test(t) && !/^\(.*\)$/.test(t) && !PRICE.test(t) && !SPACE_PRICE.test(t) && !pairsOf(t) && ((mate(r, n) && sz(r) >= sz(n) * 1.15) || (t.length <= 45 && sz(r) >= body * 1.7)); };
  const out: DocRow[] = [], bigTop = Math.max(0, ...rows.filter((r) => r.page === 1).map(sz));
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!big(i)) { out.push(r); continue; }
    // A card: smaller lines under the name, then what it costs.
    let j = i + 1; const desc: string[] = [];
    while (j < rows.length && mate(r, rows[j]) && single(rows[j]) && sz(rows[j]) <= sz(r) * 0.85 && !big(j) && !isHead(rows[j]) && !PRICE.test(rows[j].cells[0]) && !/^\(.*\)$/.test(rows[j].cells[0]) && !pairsOf(rows[j].cells[0]) && desc.length < 8) desc.push(rows[j++].cells[0]);
    const c = rows[j], it: DocItem = { name: r.cells[0], desc: desc.join(" "), price: "", cat: "", page: r.page, y: r.y, col: r.col, cx: r.x !== undefined && r.xe !== undefined ? (r.x + r.xe) / 2 : undefined, card: true }; let got = false, sign = "";
    if (c && mate(r, c)) {
      if (single(c) && PRICE.test(c.cells[0])) { it.price = num(c.cells[0]); sign = c.cells[0]; got = true; j++; }
      else if (single(c) && pairsOf(c.cells[0])) { it.sizes = []; while (rows[j] && mate(r, rows[j]) && single(rows[j]) && pairsOf(rows[j].cells[0])) { it.sizes.push(...pairsOf(rows[j].cells[0])!); sign = rows[j].cells[0]; j++; } got = true; }
      else if (desc.length && c.cells.length === 2 && PRICE.test(c.cells[1]) && sz(c) <= sz(r) * 0.85) { it.desc = (it.desc + " " + c.cells[0]).trim(); it.price = num(c.cells[1]); sign = c.cells[1]; got = true; j++; }
      else if (desc.length && c.cells.length === 2 && PRICE.test(c.cells[1]) && sz(r) <= sz(c) * 1.25) { it.sizes = []; while (rows[j] && mate(r, rows[j]) && rows[j].cells.length === 2 && PRICE.test(rows[j].cells[1])) { it.sizes.push({ label: rows[j].cells[0], price: num(rows[j].cells[1]) }); sign = rows[j].cells[1]; j++; } got = true; }
    }
    if (got) { if (it.sizes?.length) it.price = it.sizes[0].price; out.push({ cells: [it.name, sign], page: r.page, y: r.y, item: it }); i = j - 1; continue; }
    // Otherwise a heading; one that ran onto two lines is put back together.
    let text = r.cells[0]; while (out.length && single(out[out.length - 1]) && mate(r, out[out.length - 1]) && Math.abs(sz(out[out.length - 1]) - sz(r)) < 0.6 && !out[out.length - 1].item && (r.y || 0) - (out[out.length - 1].y || 0) <= sz(r) * 2.2 && out[out.length - 1].cells[0].length <= 70) text = out.pop()!.cells[0] + " " + text;
    out.push({ ...r, cells: [text], head: true });
  }
  // A heading with things on offer under it names their group; the document's own title is the biggest heading on its first page.
  for (let i = 0; i < out.length; i++) {
    const r = out[i]; if (!r.head) continue; const t = r.cells[0];
    if (headKind(t) !== "other" || topicOf(t)) continue;
    let k = i + 1, offers = false; for (; k < out.length && !out[k].head; k++) if (out[k].item || pricedRow(out[k])) offers = true;
    if (offers) { r.group = t; r.head = false; const n = out[i + 1]; if (n && n.cells.length === 1 && /^\(.{3,60}\)$/.test(n.cells[0])) { groupNotes[t] = n.cells[0].slice(1, -1).trim(); out.splice(i + 1, 1); } }
    else if (!title && r.page === 1 && sz(r) >= bigTop - 0.5 && !/^(menu|our menu|catalogu?e|brochure|price list|portfolio|welcome|profile)$/i.test(t.trim())) {
      title = t; const more: string[] = []; for (let m = i + 1; m < out.length && m <= i + 3 && !out[m].head && out[m].cells.length === 1 && !/^[^:：]{2,45}[:：]\s/.test(out[m].cells[0]) && !isHead(out[m]); m++) more.push(out[m].cells[0]);
      intro = unbracket(more.join(" ")).slice(0, 320);
    }
  }
  return { rows: out, note, title, intro, groupNotes };
}

export function readDoc(rows0: DocRow[]): DocRead {
  // A heading that wraps onto a second line ("... PRICING &" / "DESCRIPTIONS)") is one heading.
  const rows: DocRow[] = [];
  for (const r of rows0) {
    const p = rows[rows.length - 1], t = r.cells.join(" ");
    if (p && r.cells.length === 1 && /^\d{1,2}[.)]\s/.test(p.cells[0]) && p.cells.length === 1 && caps(t) && ((p.cells[0].match(/\(/g) || []).length > (p.cells[0].match(/\)/g) || []).length || /(&|and|,)$/i.test(p.cells[0]))) { p.cells[0] += " " + t; continue; }
    rows.push({ ...r, cells: [...r.cells] });
  }
  const lay = layout(rows); rows.splice(0, rows.length, ...lay.rows);
  const fields: Record<string, string> = {}, items: DocItem[] = []; let money = "";
  const put = (k: string, v: string) => { v = unbracket(v.trim()).replace(/[^\S\n]+/g, " ").replace(/ *\n */g, k === "usp" || k === "places" ? "\n" : " ").trim(); if (v && !fields[k]) fields[k] = v; };
  const fact = (label: string, value: string) => {
    const l = label.toLowerCase().replace(/[^a-z0-9&/ é-]/g, "").replace(/\s+/g, " ").trim(); if (!l || l.length > 40 || !value) return false;
    // A label can name two things ("Email & Domain", "Phone & Reservations"): each part is looked up.
    let hit = false;
    for (const part of [l, ...l.split(/\s*(?:&|\/| and )\s*/)].filter((x, i, a) => x && a.indexOf(x) === i)) {
      const k = LABELS.find(([re]) => re.test(part))?.[1]; if (!k) continue; hit = true;
      if (k === "email") { const m = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/.exec(value); if (m) put("email", m[0]); }
      else if (k === "phone") { const m = /(?:\+\d{1,3}[\s-]?)?(?:\(?\d{2,5}\)?[\s.-]?)?\d{3,5}[\s.-]?\d{3,5}/.exec(value); if (m && m[0].replace(/\D/g, "").length >= 7) put("phone", m[0]); }
      else if (k === "domain") { const m = /(?:https?:\/\/)?(?:www\.)?[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)+(?:\/\S*)?/i.exec(value.replace(/[\w.+-]+@[\w.-]+/g, " ")); if (m) put("domain", m[0].replace(/^https?:\/\//i, "")); }
      else if (k === "social") { const m = /instagram(?:\.com\/|\s*[:\-–]?\s*@?)([\w.]{2,30})/i.exec(value) || /@([\w.]{2,30})/.exec(value); if (m) put("social", "@" + m[1].replace(/^@/, "")); }
      else if (k === "usp") put("usp", value.split(/\s*[,;•|]\s*/).filter((x) => x.length >= 3 && x.length <= 60).slice(0, 6).join("\n"));
      else if (k === "founded") { const m = /\b(18|19|20)\d{2}\b/.exec(value); put("founded", m ? m[0] : value.slice(0, 20)); }
      else put(k, k === "name" ? value.slice(0, 60) : k === "tagline" ? value.slice(0, 120) : value);
    }
    return hit;
  };
  let sec: ReturnType<typeof headKind> | "" = "", cat = "", cur: DocItem | null = null, noted: DocItem | null = null, listing = false, wait = "", days = "", lead = "", table = false, topic: ReturnType<typeof topicOf> = "", fresh = false, flat: DocItem | null = null, flatPrice = "";
  const story: string[] = [], hours: string[] = [], places: { name: string; lines: string[]; x: number }[] = [], topics: Record<string, DocRow[]> = {};
  const anyItemsHead = rows.some((r) => isHead(r) && headKind(r.cells.join(" ")) === "items");
  let group: { name: string; lines: string[]; x: number }[] = [];
  const dayName = (d: string) => ({ mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" } as Record<string, string>)[d.slice(0, 3).toLowerCase()] || d;
  for (let ri = 0; ri < rows.length; ri++) {
    const r = rows[ri], next = rows[ri + 1], first = fresh; fresh = false;
    // Read already, by its layout: a thing on offer, or the heading of a group of them.
    if (r.item) { cur = { ...r.item, cat }; if (!money) money = sym(r.cells[1] || ""); items.push(cur); sec = "items"; noted = null; continue; }
    if (r.group !== undefined) { cat = r.group; cur = null; sec = "items"; flat = null; topic = ""; continue; }
    // A list mark ("- ", "• ") and, among things on offer, a number ("3. ") are only marks.
    const c = r.cells.map((x, i) => (i ? x : x.replace(/^[-–•●▪*]\s+/, ""))), listed = c[0] !== r.cells[0];
    if (sec === "items" && NUMBERED.test(c[0]) && !caps(c.join(" "))) c[0] = c[0].replace(NUMBERED, "");
    const one = c.join(" ");
    if (/^page \d+( of \d+)?$/i.test(c[c.length - 1]) || /^\d+$/.test(one)) continue;   // a page number (a running footer ends in one)
    if (isHead(r, sec === "items") && !(sec === "items" && c.length === 1 && caps(one) && !NUMBERED.test(one))) { sec = headKind(one); topic = sec === "other" ? topicOf(one) : ""; fresh = true; table = false; cur = null; cat = ""; wait = ""; days = ""; flat = null; continue; }
    // A line that is only a label ("About Us:", "Hours:", "Drinks:", "Website Hero Text:"): what it starts depends on what it names.
    const lone = c.length === 1 && !listed ? /^([A-Za-z][A-Za-z &/'’-]{1,44})\s*[:：]$/.exec(one) : null;
    if (lone) {
      const L = lone[1].trim(), hk = headKind(L), key = LABELS.find(([re]) => re.test(L.toLowerCase()))?.[1];
      if (DAYS.test(L) && L.length <= 40) { days = L; continue; }
      if (sec === "items" && hk !== "hours" && hk !== "facts" && !/notes?$|footer|polic/i.test(L) && L.split(/\s+/).length <= 5 && !/items?$|menu$/i.test(L)) { cat = L; cur = null; continue; }
      cur = null; cat = ""; days = "";
      if (hk === "hours" || hk === "items" || hk === "facts" || hk === "places") { sec = hk; wait = ""; fresh = true; continue; }
      if (key === "story" || hk === "about") { sec = "about"; wait = ""; continue; }
      if (key) { wait = L; continue; }   // its value is the next line
      sec = "other"; topic = topicOf(L); wait = ""; continue;
    }
    // Several details on one line ("Website: … | Email: … | Phone: …").
    if (c.length === 1 && /\s\|\s/.test(one)) { const parts = one.split(/\s*\|\s*/).map((x) => /^([A-Za-z][A-Za-z ]{1,24})\s*[:：]\s*(.+)$/.exec(x)).filter(Boolean) as RegExpExecArray[]; if (parts.length >= 2) { for (const m of parts) fact(m[1], m[2]); continue; } }
    // "About Acme: Founded in…" names the business and starts its story.
    { const am = c.length === 1 ? /^about\s+\[?([^:\[\]]{2,40})\]?\s*[:：]\s*(.{20,})$/i.exec(one) : null; if (am && !/^(us|me|the (company|team|brand))$/i.test(am[1].trim())) { put("name", am[1]); story.push(am[2]); sec = "about"; continue; } }
    // Another section (case studies, how you work, why you): its rows are kept and read at the end.
    if (sec === "other" && topic) { const lm = c.length === 1 ? /^([A-Za-z][A-Za-z &/'-]{1,38})\s*[:：]\s*(.{2,})$/.exec(one) : null; if (!(lm && fact(lm[1], lm[2]))) (topics[topic] ||= []).push({ ...r, cells: c }); continue; }
    // Where to find you: each place's name with its address under it (side by side in a PDF: each column is a place).
    if (sec === "places") {
      const titled = r.size ? !!next && (next.size || 0) < r.size * 0.92 && c.every((x) => x.length <= 40) : c.length === 1 && one.length <= 40 && !/\d{3}/.test(one) && (!group.length || group[group.length - 1].lines.length > 0);
      const nv = c.length === 1 ? /^(.{2,40}?)\s*(?:[:：]|\s[–—-])\s+(.{10,})$/.exec(one) : null;
      if (nv && !r.size) { group = [{ name: nv[1], lines: [nv[2]], x: 0 }]; places.push(...group); continue; }
      if (titled || !group.length) { group = c.map((x, i) => ({ name: x, lines: [], x: r.xs?.[i] ?? 0 })); places.push(...group); continue; }
      c.forEach((x, i) => { const cx = r.xs?.[i]; let k = group.length - 1; if (cx !== undefined && group.length > 1) { k = 0; for (let q = 1; q < group.length; q++) if (cx >= (group[q - 1].x + group[q].x) / 2) k = q; } group[k].lines.push(x); });
      continue;
    }
    if (wait) { const L = wait; wait = ""; if (c.length === 1 && fact(L, one)) continue; }
    // Hours given as a day line and the times under it ("Tuesday to Friday:" / "- Bar: 7:00 AM - 5:30 PM"): the first time is the main one.
    if (days) { const t = TIME.exec(one); if (t) { hours.push(`${days}: ${t[0].replace(/\s+/g, " ")}`); days = ""; continue; } if (!listed) days = ""; else continue; }
    else if (sec === "hours" && listed && TIME.test(one) && !DAYS.test(one.slice(0, 30))) continue;   // a second counter's times for the same days
    if (sec === "hours" && DAYS.test(one.slice(0, 30)) && /closed/i.test(one) && !TIME.test(one)) { hours.push(`${one.split(/[:：]/)[0].trim()}: Closed`); continue; }
    // Opening hours, wherever they are: a row that starts with days and holds a time.
    if (DAYS.test(one.slice(0, 30)) && (sec === "hours" || c.length >= 2)) {
      const t = TIME.exec(one), dd = one.slice(0, t ? t.index : 0).replace(/[:\s]+$/, "").trim();
      if (t && dd && dd.length <= 40) { hours.push(`${dd}: ${t[0].replace(/\s+/g, " ")}`); cur = null; continue; }
    }
    if (sec === "hours") continue;
    // Label and value: two cells, or "Label: value".
    // A labelled list ("Services | Kitchens", then more names under it in the same column): each is one thing on offer.
    if (c.length === 2 && LIST.test(c[0].toLowerCase().replace(/[^a-z ]/g, "").trim())) { listing = true; cur = { name: c[1].slice(0, 80), desc: "", price: "", cat: "", page: r.page, y: r.y }; items.push(cur); continue; }
    { const lm = c.length === 1 ? /^([A-Za-z ]{3,24})\s*[:：]\s*(.{2,80})$/.exec(one) : null;
      if (lm && LIST.test(lm[1].toLowerCase().trim())) { const t = TAIL_PRICE.exec(lm[2]); listing = true; cur = { name: (t ? t[1] : lm[2]).trim(), desc: "", price: t ? num(t[2]) : "", cat: "", page: r.page, y: r.y }; if (t && !money) money = sym(t[2]); items.push(cur); continue; } }
    if (listing && c.length === 1 && one.length <= 80 && !caps(one)) { const t = TAIL_PRICE.exec(one); cur = t ? { name: t[1].trim(), desc: "", price: num(t[2]), cat: "", page: r.page, y: r.y } : { name: one, desc: "", price: "", cat: "", page: r.page, y: r.y }; if (t && !money) money = sym(t[2]); items.push(cur); continue; }
    listing = false;
    if (sec !== "items") {
      if (c.length === 2 && fact(c[0], c[1])) continue;
      const m = c.length === 1 ? /^([A-Za-z][A-Za-z &/'-]{1,38})\s*[:：]\s*(.{2,})$/.exec(one) : null;
      if (m && fact(m[1], m[2])) continue;
    }
    if (sec === "about") {
      // A short line of its own above the story is the line the business goes by.
      if (c.length === 1 && r.size && !story.length && !lead && one.length <= 60 && next && next.cells.length === 1 && next.cells[0].length >= one.length * 1.4) { lead = one; continue; }
      if (c.length === 1 && (one.length >= 25 || story.length)) story.push(one); continue;
    }
    // Things on offer: a name with a price at the end of its row; the lines under it describe it; a line in capitals groups what follows.
    if (sec === "items" || (!anyItemsHead && sec !== "facts")) {
      const last = c[c.length - 1], tail = c.length === 1 ? TAIL_PRICE.exec(one) : null;
      if (c.length >= 2 && PRICE.test(last) && !/price|amount|cost|rate/i.test(c.slice(0, -1).join(" ")) && c.slice(0, -1).join(" ").replace(/[^A-Za-z]/g, "").length >= 2) {
        if (!money) money = sym(last);
        const body = c.slice(0, -1); cur = { name: body[0].slice(0, 80), desc: body.slice(1).join(" "), price: num(last), cat, page: r.page, y: r.y, col: r.col }; items.push(cur); continue;
      }
      // A price in words ("MRP"), or one for each size ("Rs. 59 / 99" beside "[150ml / 250ml]").
      if (c.length >= 2 && WORD_PRICE.test(last)) { cur = { name: c[0].slice(0, 80), desc: last, price: "", cat, page: r.page, y: r.y, col: r.col }; items.push(cur); continue; }
      if (c.length >= 2 && MULTI.test(last)) {
        if (!money) money = sym(last);
        const prices = (last.match(/\d[\d,]*(?:\.\d{1,2})?/g) || []).map(num), br = /\s*[\[(]([^\])]*\/[^\])]*)[\])]\s*$/.exec(c[0]), labels = br ? br[1].split(/\s*\/\s*/) : [];
        cur = labels.length === prices.length ? { name: c[0].slice(0, br!.index).trim().slice(0, 80), desc: "", price: prices[0], cat, sizes: labels.map((l, i) => ({ label: l.trim(), price: prices[i] })), page: r.page, y: r.y, col: r.col } : { name: c[0].slice(0, 80), desc: last, price: prices[0], cat, page: r.page, y: r.y, col: r.col };
        items.push(cur); continue;
      }
      // One price for a different dish each day ("Today's special at Rs. 159", then "MON | …", "TUE | …").
      if (c.length === 2 && /^(mon|tue|wed|thu|fri|sat|sun)[a-z]*$/i.test(c[0]) && flat) {
        if (items[items.length - 1] === flat) { items.pop(); cat = flat.name; flatPrice = flat.price; }
        cur = { name: c[1].slice(0, 80), desc: dayName(c[0]) + ":", price: flatPrice, cat, page: r.page, y: r.y, col: r.col }; items.push(cur); continue;
      }
      // A table of things on offer without prices (a service, what it covers, what you get): its first row names the columns.
      if (sec === "items" && c.length >= 2) {
        if (/\bprice\b/i.test(one) && !/\d/.test(one)) continue;   // the table's own header row
        if (first && c.every((x) => x.length <= 34 && !/[.!?]$/.test(x))) { table = true; continue; }
        if ((c.length >= 3 || table) && c[0].length <= 80 && c[1].length >= 12) {
          const name = unbracket(c[0]).replace(/^(service|product|item|package|plan|offering)\s*\d+\s*[:.–—-]\s*/i, "").trim();
          cur = { name: name.slice(0, 80), desc: c[1], price: "", cat, points: c[2] ? c[2].split(/\s*[,;•]\s*/).map((x) => x.trim()).filter((x) => x.length >= 2 && x.length <= 60).slice(0, 6) : [], page: r.page, y: r.y, col: r.col }; items.push(cur); continue;
        }
      }
      if (tail && !DAYS.test(tail[1]) && !/^(phone|tel|call|year|since|pin|zip)/i.test(tail[1])) { if (!money) money = sym(tail[2]); cur = { name: tail[1].trim(), desc: "", price: num(tail[2]), cat, page: r.page, y: r.y }; items.push(cur); continue; }
      { const sp = c.length === 1 && !tail ? SPACE_PRICE.exec(one) : null;
        if (sp && !DAYS.test(sp[1]) && !/minimum|deliver|above|below|\border\b|charges?|deposit|\bfees?\b|^(phone|tel|call|year|since|pin|zip)/i.test(sp[1])) { if (!money) money = sym(sp[2]); cur = { name: sp[1].trim(), desc: "", price: num(sp[2]), cat, page: r.page, y: r.y, col: r.col }; items.push(cur); flat = cur; continue; } }
      if (sec === "items" && c.length === 1 && caps(one) && one.length <= 60) { cat = title(one); cur = null; continue; }
      // A short line set apart above priced lines ("Extras") names their group.
      if (r.size && c.length === 1 && one.length <= 30 && !/[.,:!?]$/.test(one) && next && pricedRow(next) && next.page === r.page && ((next.x || 0) - (r.x || 0) >= 8 || r.size > (next.size || 0) * 1.08)) { cat = one; cur = null; continue; }
      if (sec === "items" && /\bprice\b/i.test(one) && !/\d/.test(one)) continue;   // the table's own header row
      if (cur && c.length === 1) {
        const ph = /^(?:photo|image|picture|img)\s*[:：]\s*(https?:\/\/\S+)$/i.exec(one); if (ph) { if (!cur.img) cur.img = ph[1]; continue; }
        if (/^(dietary|diet|contains|allergens?|milk options?|add-?ons?|served|size|sizes|options?)\b\s*[:：]/i.test(one)) { if (!cur.diet && /^diet/i.test(one)) cur.diet = /vegan|vegetarian|\bveg\b/i.test(one) && !/non-?veg/i.test(one) ? "veg" : /non-?veg|chicken|meat|fish|egg/i.test(one) ? "nonveg" : ""; noted = cur; continue; }
        if (noted === cur) continue;   // the rest of a note that ran onto a second line
        if (cur.desc.length < 320) cur.desc = (cur.desc + (cur.desc.endsWith("-") ? "" : " ") + one).trim();
        continue;
      }
    }
  }
  if (hours.length) put("hours", hours.slice(0, 4).join("; "));
  if (lay.note) put("note", lay.note);
  { const at = places.filter((x) => x.lines.length).map((x) => ({ name: x.name, address: x.lines.join(" ").replace(/\s+/g, " ") }));
    if (at.length) { put("address", at[0].address); if (at.length >= 2) put("places", at.slice(0, 6).map((x) => `${x.name}: ${x.address}`).join("\n")); } }
  if (lead) put("tagline", lead);
  if (story.length && !fields.story) { const all = story.join(" ").replace(/(\w)- (\w)/g, "$1-$2"); put("story", all.length <= 900 ? all : (/^[\s\S]{200,900}[.!?](?=\s)/.exec(all)?.[0] || all.slice(0, 900))); }
  // A name nobody labelled: the document's own title, or the name its story opens with ("Rasodu was born…", "At Rasodu, …").
  if (lay.title) { if (!fields.name && lay.title.length <= 45) put("name", lay.title); else if (!fields.tagline && lay.title !== fields.name) put("tagline", lay.title.slice(0, 120)); if (lay.intro && !fields.about) put("about", lay.intro); }
  if (!fields.name && fields.story) { const m = /^((?:[A-Z][\w&'’.-]*)(?:\s(?:[A-Z&][\w&'’.-]*)){0,3})\s+(?:was|is|began|started|opened|brings|has been)\b/.exec(fields.story) || /\b(?:At|Welcome to)\s+((?:[A-Z][\w&'’-]*)(?:\s(?:[A-Z&][\w&'’-]*)){0,3})[,.]/.exec(fields.story); if (m && !/^(The|We|Our|It|This|Founded|Opened|Since)$/.test(m[1])) put("name", m[1]); }
  if (!fields.name) { const r = rows.slice(0, 6).find((x) => !isHead(x) && x.cells.join(" ").length >= 2 && x.cells.join(" ").length <= 45 && x.cells.join(" ") !== lead && !x.item && x.group === undefined && !/[@:]|https?:|\d{4,}/.test(x.cells.join(" "))); if (r) put("name", r.cells.join(" ")); }
  if (fields.address && !fields.city) { const m = /,\s*([A-Za-z .'-]{3,30}),\s*[A-Z]{2}\s*\d{5}/.exec(fields.address) || /,\s*([A-Za-z .'-]{3,30}),\s*[A-Za-z ]{3,24}\s*[-,]?\s*\d{6}\b/.exec(fields.address) || /,\s*([A-Za-z .'-]{3,30})\s*[-,]?\s*\d{6}\b/.exec(fields.address); if (m) put("city", m[1]); }
  for (const it of items) {
    it.desc = it.desc.replace(/(\w)- (\w)/g, "$1-$2").trim();
    // A closing note in brackets ("(Vegan, Gluten-Free, 14 oz)") says what it suits; it isn't part of the description.
    const note = /\s*\(([^()]{3,140})\)\s*$/.exec(it.desc);
    if (note && /vegan|vegetarian|\bveg\b|gluten|dairy|nuts?|halal|jain|spicy|\boz\b|\bml\b|serves/i.test(note[1])) { if (!it.diet) it.diet = /vegan|vegetarian|\bveg\b/i.test(note[1]) && !/non-?veg/i.test(note[1]) ? "veg" : /non-?veg/i.test(note[1]) ? "nonveg" : ""; it.desc = it.desc.slice(0, note.index).trim(); }
  }
  const sections: NonNullable<DocRead["sections"]> = {};
  if (topics.work) { const w = workOf(topics.work); if (w.length) sections.work = w; }
  for (const k of ["process", "highlights"] as const) if (topics[k]) { const e = entriesOf(topics[k]); if (e.length) sections[k] = e; }
  return { fields, items: items.slice(0, 120), money, groupNotes: lay.groupNotes, sections };
}

// ---------------------------------------------------------------- a PDF page's pieces of text → rows of cells
const lettersOf = (rs: DocRun[]) => rs.reduce((n, r) => n + r.text.replace(/[^A-Za-z]/g, "").length, 0);
function lineUp(runs: DocRun[]): DocRun[][] {
  const rs = [...runs].sort((a, b) => a.y - b.y || a.x - b.x), lines: DocRun[][] = [];
  for (const r of rs) { const l = lines[lines.length - 1]; if (l && Math.abs(l[0].y - r.y) <= Math.max(2, Math.min(l[0].size, r.size) * 0.45)) l.push(r); else lines.push([r]); }
  return lines.map((l) => l.sort((a, b) => a.x - b.x));
}
/** Where a page laid out as two columns of cards divides (a menu, a brochure); null for an ordinary page or a table.
 *  Two columns: an empty strip down the middle that nearly every line respects, with full text on both sides whose lines start at different places
 *  (centred cards). A table's columns start at one place each, so a table is left as rows. */
function gutterOf(width: number, runs: DocRun[]): number | null {
  const lo = Math.round(width * 0.38), hi = Math.round(width * 0.62), cov = new Array(hi - lo + 1).fill(0);
  for (const r of runs) for (let x = Math.max(lo, Math.ceil(r.x)); x <= Math.min(hi, Math.floor(r.end)); x++) cov[x - lo]++;
  const c0 = Math.min(...cov); let best = [0, -1], s = -1;
  for (let i = 0; i <= cov.length; i++) { if (i < cov.length && cov[i] === c0) { if (s < 0) s = i; } else if (s >= 0) { if (i - 1 - s > best[1] - best[0]) best = [s, i - 1]; s = -1; } }
  if (best[1] - best[0] < 7) return null;
  const g = lo + (best[0] + best[1]) / 2, lines = lineUp(runs); let cross = 0, both = 0; const ls = new Set<number>(), rs = new Set<number>(); let lw = [1e9, 0], rw = [1e9, 0];
  for (const l of lines) {
    if (l.some((r) => r.x < g - 2 && r.end > g + 2)) { cross++; continue; }
    const L = l.filter((r) => (r.x + r.end) / 2 < g), R = l.filter((r) => (r.x + r.end) / 2 >= g);
    if (L.length) { ls.add(Math.round(L[0].x / 6)); lw = [Math.min(lw[0], L[0].x), Math.max(lw[1], L[L.length - 1].end)]; }
    if (R.length) { rs.add(Math.round(R[0].x / 6)); rw = [Math.min(rw[0], R[0].x), Math.max(rw[1], R[R.length - 1].end)]; }
    if (lettersOf(L) >= 10 && lettersOf(R) >= 10) both++;
  }
  return both >= 3 && cross <= Math.max(3, lines.length * 0.2) && lw[1] - lw[0] >= width * 0.25 && rw[1] - rw[0] >= width * 0.25 && ls.size >= 3 && rs.size >= 3 ? g : null;
}
/** PDF pages → rows of cells, in reading order. A wide gap starts a new cell (table columns stay apart); a cell that wraps onto more lines is
 *  put back together; on a two-column page the left column is read before the right one, between the lines that span both. */
export function rowsFromRuns(pages: DocPage[]): { rows: DocRow[]; gutters: (number | null)[] } {
  const rows: DocRow[] = [], gutters: (number | null)[] = [];
  const near = (a: number, b: number) => Math.abs(a - b) <= 3;
  pages.forEach((pg, pi) => {
    const p = pi + 1, runs = pg.runs.filter((r) => r.text.trim()), g = gutterOf(pg.width, runs); gutters.push(g);
    const emit = (lines: DocRun[][], col?: number) => {
      const L = lines.map((l) => {
        const cells: { x: number; t: string; size: number; end: number }[] = [];
        for (let i = 0; i < l.length; i++) {
          const gap = i ? l[i].x - l[i - 1].end : 0, c = cells[cells.length - 1];
          // A new cell: a wide gap; a price set apart from its name; a change of letter size across a gap ("MON  Curry rice bowl").
          if (!i || gap > Math.max(14, l[i].size * 1.4) || (gap > l[i].size * 0.4 && (STARTS_PRICE.test(l[i].text.trim()) || Math.abs(l[i].size - l[i - 1].size) > 1.5))) cells.push({ x: l[i].x, t: l[i].text, size: l[i].size, end: l[i].end });
          else { c.t += (gap > l[i].size * 0.18 && !/\s$/.test(c.t) && !/^\s/.test(l[i].text) ? " " : "") + l[i].text; c.size = Math.max(c.size, l[i].size); c.end = l[i].end; }
        }
        return { y: l[0].y, cells: cells.map((c) => ({ ...c, t: c.t.replace(/\s+/g, " ").trim() })).filter((c) => c.t) };
      }).filter((l) => l.cells.length);
      const within = (xs: number[], cols: number[]) => xs.every((x) => cols.some((z) => near(z, x)));
      const money = (t: string) => PRICE.test(t) || MULTI.test(t);
      let last: { row: DocRow; xs: number[]; sizes: number[]; y: number } | null = null;
      for (let i = 0; i < L.length; i++) {
        const ln = L[i], xs = ln.cells.map((c) => c.x), size = ln.cells[0].size;
        if (last && last.xs.length >= 2 && within(xs, last.xs) && ln.cells.every((c) => Math.abs(c.size - last!.sizes[last!.xs.findIndex((z) => near(z, c.x))]) <= 1.5)) {
          const dy = ln.y - last.y, first = near(xs[0], last.xs[0]); let join = false;
          // A cell that wraps: text under the later columns only continues the row above.
          if (!first) join = dy <= size * 2.6;
          // Every column wraps at once: the lines of one row sit closer together than the rows do.
          else if (xs.length === last.xs.length && dy <= size * 1.7 && !money(ln.cells[ln.cells.length - 1].t) && !money(last.row.cells[last.row.cells.length - 1])) {
            let a = i, b = i, G = 0; while (a > 0 && within(L[a - 1].cells.map((c) => c.x), last.xs)) a--; while (b < L.length - 1 && within(L[b + 1].cells.map((c) => c.x), last.xs)) b++;
            for (let k = a + 1; k <= b; k++) G = Math.max(G, L[k].y - L[k - 1].y);
            join = dy <= G * 0.75;
          }
          if (join) { for (const c of ln.cells) { const k = last.xs.findIndex((z) => near(z, c.x)), lc = last.row.cells; lc[k] += (lc[k].endsWith("-") ? "" : " ") + c.t; } last.y = ln.y; continue; }
        }
        const row: DocRow = { cells: ln.cells.map((c) => c.t), page: p, y: ln.y, x: xs[0], xe: ln.cells[ln.cells.length - 1].end, xs, size, ...(col === undefined ? {} : { col }) };
        rows.push(row); last = { row, xs, sizes: ln.cells.map((c) => c.size), y: ln.y };
      }
    };
    if (g === null) { emit(lineUp(runs)); return; }
    const span = runs.filter((r) => r.x < g - 2 && r.end > g + 2), rest = runs.filter((r) => !span.includes(r)), sl = lineUp(span); let from = -1e9;
    for (let k = 0; k <= sl.length; k++) {
      const to = k < sl.length ? sl[k][0].y - 1 : 1e9, band = rest.filter((r) => r.y >= from && r.y < to);
      emit(lineUp(band.filter((r) => (r.x + r.end) / 2 < g)), 0); emit(lineUp(band.filter((r) => (r.x + r.end) / 2 >= g)), 1);
      if (k < sl.length) { emit([sl[k]]); from = to; }
    }
  });
  return { rows, gutters };
}
