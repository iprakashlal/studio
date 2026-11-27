// What a document says, whatever its order: the details a website needs (name, tagline, contact, hours, story) and the
// things on offer (dishes, products, services) with their descriptions, prices and groups. Rule-based, no imports:
// it reads rows of cells (a table row is several cells; plain text is one), so a PDF table, a Word table and an Excel
// sheet all read the same way.

/** One line of the document. cells: what was side by side on it. page / y: where it was (a PDF), to pair pictures with items. */
export type DocRow = { cells: string[]; page?: number; y?: number };
export type DocItem = { name: string; desc: string; price: string; cat: string; diet?: string; page?: number; y?: number };
export type DocRead = { fields: Record<string, string>; items: DocItem[]; /** The money sign the prices carry ("$", "₹"…). */ money: string };

/** Plain text → rows (a tab separates cells). */
export const rowsOf = (text: string): DocRow[] => String(text || "").replace(/\r/g, "").split("\n").map((l) => ({ cells: l.split("\t").map((c) => c.replace(/\s+/g, " ").trim()).filter(Boolean) })).filter((r) => r.cells.length);
/** Rows → plain text, for the parts of the Studio that read a document as text: a row of two cells reads "Label: value", a longer one is joined with " | ". */
export const textOf = (rows: DocRow[]) => rows.map((r) => (r.cells.length === 2 && !/[:：]$/.test(r.cells[0]) ? `${r.cells[0]}: ${r.cells[1]}` : r.cells.join(" | "))).join("\n");
/** A one-line description: a long sentence is cut at its first natural break ("... serving", a comma), never mid-phrase. */
export function oneLine(v: string, max = 80): string {
  const t = v.replace(/\s+/g, " ").trim(); if (t.length <= max) return t.replace(/[.]+$/, "");
  const m = /^(.{18,}?)(?:,| serving\b| offering\b| providing\b| speciali[sz]ing\b| with\b| that\b| which\b| for\b| – | - )/.exec(t);
  const cut = m && m[1].length <= max ? m[1] : t.slice(0, max).replace(/\s+\S*$/, "");
  return cut.replace(/[,;]?\s+(and|or|with|&|the|a|an|of|in|for)$/i, "").trim();
}
const LIST = /^(our |main |key )?(services|products|menu|dishes|offerings|skills|what we offer|solutions|packages|items|specialit(y|ies)|treatments|courses|classes)$/;

const MONEY = "(?:₹|rs\\.?|inr|\\$|usd|€|eur|£|gbp|aed)";
const PRICE = new RegExp(`^${MONEY}?\\s*(\\d{1,3}(?:,\\d{3})+|\\d{1,7})(?:\\.(\\d{1,2}))?\\s*(?:/-|${MONEY})?$`, "i");
const TAIL_PRICE = new RegExp(`^(.{2,80}?)\\s*(?:[-–—:]|\\.{2,}|…)\\s*(${MONEY}?\\s*\\d[\\d,]*(?:\\.\\d{1,2})?)\\s*(?:/-)?$`, "i");
const DAYS = /\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\b|\b(daily|every ?day|weekdays?|weekends?)\b/i;
const sym = (p: string) => (/₹|rs|inr/i.test(p) ? "₹" : /\$|usd/i.test(p) ? "$" : /€|eur/i.test(p) ? "€" : /£|gbp/i.test(p) ? "£" : /aed/i.test(p) ? "AED" : "");
const num = (p: string) => { const m = /(\d[\d,]*)(?:\.(\d{1,2}))?/.exec(p); return m ? m[1].replace(/,/g, "") + (m[2] ? "." + m[2].padEnd(2, "0") : "") : ""; };
const caps = (s: string) => { const L = s.replace(/[^A-Za-z]/g, ""); return L.length >= 3 && L === L.toUpperCase(); };
const title = (s: string) => s.toLowerCase().replace(/(^|[\s(/&-])([a-z])/g, (_m, a, b) => a + b.toUpperCase()).replace(/\b(And|Or|Of|The|For|With|In|On|A|An)\b/g, (w, _a, i) => (i ? w.toLowerCase() : w));

/** Which answer a label is for. Tried in order: the first that fits wins. */
const LABELS: [RegExp, string][] = [
  [/^((brand|business|company|caf[eé]|restaurant|store|shop|event|firm|studio|trade|legal|full|your|product|organi[sz]ation) )?name$|^brand$/, "name"],
  [/tagline|slogan|motto|hero headline|main headline|^headline$|^title line$/, "tagline"],
  [/sub-?headline|short description|what we do|what (you|we|i) (sell|do)|^description$|one-?liner|^cuisines?$|^industry$|^role$|^job title$|^profession$|^speciali[sz]ation$|business type|^about$|^summary$/, "about"],
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
  [/amenities|features|highlights|why (choose|us)|usp|specialt(y|ies)|tags$/, "usp"],
  [/cost for two/, "cost"], [/gst/, "gstin"], [/mission|vision/, "mission"],
  [/^(event )?date$|^when$/, "edate"], [/^(start )?time$/, "etime"],
  [/our story|about (us|the (company|store|caf[eé]|restaurant|brand))|^story$|who we are|^bio$|^biography$/, "story"],
];
/** What a heading is about. */
function headKind(t: string): "hours" | "items" | "facts" | "about" | "other" {
  const x = t.toLowerCase();
  if (/hours|timings|opening|service schedule/.test(x)) return "hours";
  if (/\bmenu\b|products?|catalogu?e|price list|pricing|\bitems\b|dishes|services|offerings|packages|rate card|collection|what we (offer|sell|do)|tickets/.test(x) && !/policy|polic|footer/.test(x)) return "items";
  if (/contact|profile|details|information|basics|at a glance|business info|overview/.test(x)) return "facts";
  if (/about|story|who we are|introduction|bio\b/.test(x)) return "about";
  return "other";
}
const isHead = (r: DocRow) => { const t = r.cells.join(" "); return t.length <= 90 && (/^\d{1,2}[.)]\s+\S/.test(t) || (r.cells.length === 1 && caps(t) && t.split(/\s+/).length >= 2 && !PRICE.test(t))); };

export function readDoc(rows0: DocRow[]): DocRead {
  // A heading that wraps onto a second line ("... PRICING &" / "DESCRIPTIONS)") is one heading.
  const rows: DocRow[] = [];
  for (const r of rows0) {
    const p = rows[rows.length - 1], t = r.cells.join(" ");
    if (p && r.cells.length === 1 && /^\d{1,2}[.)]\s/.test(p.cells[0]) && p.cells.length === 1 && caps(t) && ((p.cells[0].match(/\(/g) || []).length > (p.cells[0].match(/\)/g) || []).length || /(&|and|,)$/i.test(p.cells[0]))) { p.cells[0] += " " + t; continue; }
    rows.push({ ...r, cells: [...r.cells] });
  }
  const fields: Record<string, string> = {}, items: DocItem[] = []; let money = "";
  const put = (k: string, v: string) => { v = v.replace(/[^\S\n]+/g, " ").replace(/ *\n */g, k === "usp" ? "\n" : " ").trim(); if (v && !fields[k]) fields[k] = v; };
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
  let sec: ReturnType<typeof headKind> | "" = "", cat = "", cur: DocItem | null = null, noted: DocItem | null = null, listing = false; const story: string[] = [], hours: string[] = [];
  const anyItemsHead = rows.some((r) => isHead(r) && headKind(r.cells.join(" ")) === "items");
  for (const r of rows) {
    const c = r.cells, one = c.join(" ");
    if (/^page \d+( of \d+)?$/i.test(c[c.length - 1]) || /^\d+$/.test(one)) continue;   // a page number (a running footer ends in one)
    if (isHead(r) && !(sec === "items" && c.length === 1 && caps(one) && !/^\d{1,2}[.)]\s/.test(one))) { sec = headKind(one); cur = null; cat = ""; continue; }
    // Opening hours, wherever they are: a row that starts with days and holds a time.
    if (DAYS.test(one.slice(0, 30)) && (sec === "hours" || c.length >= 2)) {
      const t = /\d{1,2}(?::\d\d)?\s*(?:am|pm)?\s*(?:[-–—]|to)\s*\d{1,2}(?::\d\d)?\s*(?:am|pm)/i.exec(one), days = one.slice(0, t ? t.index : 0).replace(/[:\s]+$/, "").trim();
      if (t && days && days.length <= 40) { hours.push(`${days}: ${t[0].replace(/\s+/g, " ")}`); cur = null; continue; }
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
    if (sec === "about") { if (c.length === 1 && (one.length >= 25 || story.length)) story.push(one); continue; }
    // Things on offer: a name with a price at the end of its row; the lines under it describe it; a line in capitals groups what follows.
    if (sec === "items" || (!anyItemsHead && sec !== "facts")) {
      const last = c[c.length - 1], tail = c.length === 1 ? TAIL_PRICE.exec(one) : null;
      if (c.length >= 2 && PRICE.test(last) && !/price|amount|cost|rate/i.test(c.slice(0, -1).join(" ")) && c.slice(0, -1).join(" ").replace(/[^A-Za-z]/g, "").length >= 2) {
        if (!money) money = sym(last);
        const body = c.slice(0, -1); cur = { name: body[0].slice(0, 80), desc: body.slice(1).join(" "), price: num(last), cat, page: r.page, y: r.y }; items.push(cur); continue;
      }
      if (tail && !DAYS.test(tail[1]) && !/^(phone|tel|call|year|since|pin|zip)/i.test(tail[1])) { if (!money) money = sym(tail[2]); cur = { name: tail[1].trim(), desc: "", price: num(tail[2]), cat, page: r.page, y: r.y }; items.push(cur); continue; }
      if (sec === "items" && c.length === 1 && caps(one) && one.length <= 60) { cat = title(one); cur = null; continue; }
      if (sec === "items" && /\bprice\b/i.test(one) && !/\d/.test(one)) continue;   // the table's own header row
      if (cur && c.length === 1) {
        if (/^(dietary|diet|contains|allergens?|milk options?|add-?ons?|served|size|sizes|options?)\b\s*[:：]/i.test(one)) { if (!cur.diet && /^diet/i.test(one)) cur.diet = /vegan|vegetarian|\bveg\b/i.test(one) && !/non-?veg/i.test(one) ? "veg" : /non-?veg|chicken|meat|fish|egg/i.test(one) ? "nonveg" : ""; noted = cur; continue; }
        if (noted === cur) continue;   // the rest of a note that ran onto a second line
        if (cur.desc.length < 320) cur.desc = (cur.desc + (cur.desc.endsWith("-") ? "" : " ") + one).trim();
        continue;
      }
    }
  }
  if (hours.length) put("hours", hours.slice(0, 4).join("; "));
  if (story.length && !fields.story) { const all = story.join(" ").replace(/(\w)- (\w)/g, "$1-$2"); put("story", all.length <= 900 ? all : (/^[\s\S]{200,900}[.!?](?=\s)/.exec(all)?.[0] || all.slice(0, 900))); }
  // A name nobody labelled: the document's first short line that isn't a heading, a fact or a note.
  if (!fields.name) { const r = rows.slice(0, 6).find((x) => !isHead(x) && x.cells.join(" ").length >= 2 && x.cells.join(" ").length <= 45 && !/[@:]|https?:|\d{4,}/.test(x.cells.join(" "))); if (r) put("name", r.cells.join(" ")); }
  if (fields.address && !fields.city) { const m = /,\s*([A-Za-z .'-]{3,30}),\s*[A-Z]{2}\s*\d{5}/.exec(fields.address) || /,\s*([A-Za-z .'-]{3,30})\s*[-,]?\s*\d{6}\b/.exec(fields.address); if (m) put("city", m[1]); }
  for (const it of items) it.desc = it.desc.replace(/(\w)- (\w)/g, "$1-$2").trim();
  return { fields, items: items.slice(0, 60), money };
}
