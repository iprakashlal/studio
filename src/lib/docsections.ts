// Reading the sections of a person's own document (a PDF or a web page's text): "Team", "FAQ", "Pricing", "Testimonials"…
// Only what is written in the text is taken (nothing is made up). Each section becomes a small list the website's matching section can show.

export type Entry = { title: string; body?: string; bullets?: string[] };
export type DocSections = {
  services?: Entry[]; team?: { name: string; role: string; bio: string }[]; testimonials?: { quote: string; name: string; role: string; company: string }[];
  faq?: { q: string; a: string }[]; pricing?: { name: string; price: string; period: string; blurb: string; features: string[] }[];
  process?: Entry[]; stats?: { value: string; label: string }[]; clients?: string[]; work?: { title: string; summary: string; client: string; result: string }[];
  highlights?: Entry[]; offers?: { title: string; body: string; when: string; price: string }[]; events?: Entry[];
  experience?: { period: string; title: string; org: string; bullets: string[] }[]; education?: { period: string; title: string; sub: string }[];
  skills?: Entry[]; languages?: string[]; mission?: string; vision?: string; values?: Entry[];
};
export const SECTION_LIST: (keyof DocSections)[] = ["services", "team", "testimonials", "faq", "pricing", "process", "stats", "clients", "work", "highlights", "offers", "events", "experience", "education", "skills", "languages", "mission", "vision", "values"];

/** What each heading in a document is called, and the section it belongs to. */
const HEADINGS: [keyof DocSections, RegExp][] = [
  ["services", /^(our |my |what we |what i )?(services?|do|offer|offerings|solutions|capabilities|what we offer|what i offer|expertise|specialities|specialties|practice areas|products?)$/],
  ["team", /^(our |the |meet the |meet our |leadership |management )?(team|people|leadership|founders?|partners|staff|chefs?|kitchen team|who.?s in the kitchen|management team)$/],
  ["testimonials", /^(client |customer |guest )?(testimonials?|reviews?|feedback|what (clients|customers|guests|people) say|client stories|kind words)$/],
  ["faq", /^(faqs?|frequently asked questions|questions|good to know|common questions)$/],
  ["pricing", /^(our |my )?(pricing|prices|plans|packages|rates|engagements|ways to work with us|fees)$/],
  ["process", /^(our |my )?(process|how (we|i) work|approach|methodology|how it works|steps|workflow)$/],
  ["stats", /^(key |our )?(numbers|stats|statistics|at a glance|achievements|highlights in numbers|by the numbers|facts|quick facts|impact)$/],
  ["clients", /^(our |key )?(clients|customers|trusted by|partners|brands|worked with|as featured in|press|featured in|media)$/],
  ["work", /^(our |my |selected |recent )?(work|case studies|projects|portfolio|selected work|past work)$/],
  ["highlights", /^(why (us|choose us|we.?re different)|highlights|what makes us special|why choose us|our strengths|specials?|signature dishes)$/],
  ["offers", /^(offers|deals|this month|promotions|discounts|combos?)$/],
  ["events", /^(events|catering|events (and|&) catering|private dining|parties|celebrations)$/],
  ["experience", /^(work |professional |employment )?(experience|history|career)$/],
  ["education", /^(education|certifications?|qualifications?|education (and|&) certifications?|training)$/],
  ["skills", /^(skills|technical skills|core skills|tools|technologies)$/],
  ["languages", /^(languages?|speaks)$/],
  ["mission", /^(our |my )?mission$/],
  ["vision", /^(our |my )?vision$/],
  ["values", /^(our |my )?(values|principles|beliefs)$/],
];
const STOP = /^(about( us| me)?|contact( us)?|get in touch|address|visit us|find us|hours|opening hours|menu|our story|story|introduction|summary|profile|overview)$/;

const norm = (l: string) => l.toLowerCase().replace(/[^a-z&' ]+/g, " ").replace(/\s+/g, " ").trim();
const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const BUL = /^\s*(?:[•●▪◦·*▶►✓✔→-]|[–—]\s|\d{1,2}[.)]\s)\s*/;
const isBullet = (l: string) => BUL.test(l) && l.replace(BUL, "").length > 0;
const unbullet = (l: string) => clean(l.replace(BUL, ""));
const PRICE = /(?:₹|rs\.?\s?|inr\s?|\$|usd\s?|€|£)\s?\d[\d,.]*\s*(?:[kKlL]|lakhs?|lacs?)?(?:\s*\+)?|\d[\d,.]*\s*(?:\/-|rs\b|inr\b)/i;

/** The heading a line is, when it is one: short, no full stop, either in capitals or a known heading. */
function headingOf(line: string): keyof DocSections | "stop" | null {
  const l = clean(line); if (l.length < 3 || l.length > 48 || /[.!?,;]$/.test(l) || isBullet(l)) return null;
  const n = norm(l); if (!n) return null;
  if (STOP.test(n)) return "stop";
  for (const [k, re] of HEADINGS) if (re.test(n)) return k;
  return null;
}

/** Items from a block of lines: "Title: text", "Title – text", a short title line followed by its text, or bullets. */
function entries(ls: string[], bulletsAreItems = true): Entry[] {
  const out: Entry[] = []; let cur: Entry | null = null;
  const sep = /^(.{2,60}?)\s*(?::|\s[-–—]\s)\s*(.{3,})$/;
  const titleLike = (l: string) => l.length >= 2 && l.length <= 60 && !/[.!?]$/.test(l) && l.split(/\s+/).length <= 8;
  for (const raw of ls) {
    const bullet = isBullet(raw), l = unbullet(raw); if (!l) continue;
    const m = sep.exec(l);
    if (bullet && !bulletsAreItems && cur) { (cur.bullets ||= []).push(l); continue; }
    if (m && (bullet || !cur || titleLike(m[1]))) { cur = { title: clean(m[1]), body: clean(m[2]) }; out.push(cur); continue; }
    if (bullet || (titleLike(l) && (!cur || cur.body || cur.bullets?.length || !titleLike(cur.title)))) { cur = { title: l }; out.push(cur); continue; }
    if (cur) cur.body = clean((cur.body ? cur.body + " " : "") + l); else { cur = { title: l.slice(0, 60), body: l.length > 60 ? l : "" }; out.push(cur); }
  }
  return out.slice(0, 12);
}
const cut = (s: string | undefined, n: number) => { const t = clean(s || ""); return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, "") + "…" : t; };

function parse(key: keyof DocSections, ls: string[]): any {
  switch (key) {
    case "services": case "process": case "highlights": case "events": case "skills": case "values":
      return entries(ls).map((e) => ({ title: cut(e.title, 60), body: cut(e.body, 220), bullets: (e.bullets || []).slice(0, 5) })).slice(0, key === "skills" ? 6 : 8);
    case "team": return entries(ls.map((l) => { const m = /^(\p{Lu}[\p{L}.'-]+(?:\s+\p{Lu}[\p{L}.'-]+){0,3})\s*,\s*(.{3,50})$/u.exec(l); return m ? `${m[1]} – ${m[2]}` : l; })).map((e) => {
      const b = e.body || "", short = b.length <= 60 && !/[.!?]$/.test(b);
      return { name: cut(e.title, 50), role: short ? b : "", bio: short ? "" : cut(b, 240) };
    }).filter((x) => x.name.split(/\s+/).length <= 5).slice(0, 8);
    case "testimonials": {
      const out: { quote: string; name: string; role: string; company: string }[] = [];
      for (const raw of ls) {
        const l = clean(raw);
        const at = /^(?:[—–~-]{1,2}\s*)(.{2,80})$/.exec(l);
        if (at && out.length && !out[out.length - 1].name) { const [name, ...rest] = at[1].split(/\s*,\s*|\s+\|\s+/); const role = rest.join(", "), co = /\bat\s+(.+)$/i.exec(role); out[out.length - 1].name = cut(name, 50); out[out.length - 1].role = cut(co ? role.replace(co[0], "").trim() : role, 60); out[out.length - 1].company = cut(co?.[1], 60); continue; }
        if (l.length >= 25) out.push({ quote: cut(l.replace(/^[“"'‘]+|[”"'’]+$/g, ""), 300), name: "", role: "", company: "" });
      }
      return out.filter((x) => x.quote && x.name).slice(0, 6);
    }
    case "faq": {
      const out: { q: string; a: string }[] = []; let cur: { q: string; a: string } | null = null;
      for (const raw of ls) {
        const l = unbullet(raw).replace(/^q\s*[:.)]\s*/i, "");
        if (/\?$/.test(l) || /^q\s*[:.)]/i.test(raw)) { cur = { q: cut(l, 140), a: "" }; out.push(cur); }
        else if (cur) cur.a = cut((cur.a ? cur.a + " " : "") + l.replace(/^a\s*[:.)]\s*/i, ""), 400);
      }
      return out.filter((x) => x.a).slice(0, 8);
    }
    case "pricing": return entries(ls, false).map((e) => {
      const all = [e.title, e.body || ""].join(" "), pm = PRICE.exec(all), price = pm ? clean(pm[0]) : "";
      const name = clean(e.title.replace(PRICE, "").replace(/[-–—:|·]+\s*$/, "").replace(/^[-–—:|·]+\s*/, ""));
      const PER = /\b(per (month|year|hour|day|person|project)|\/(mo|month|yr|year|hr|hour)|monthly|yearly|one.?time|fixed[^,.]*)\b/i;
      const per = PER.exec(all)?.[0] || "";
      const rest = clean((e.body || "").replace(PRICE, "").replace(PER, "").replace(/^[-–—:|·/\s]+|[-–—:|·/\s]+$/g, ""));
      return { name: cut(name, 40), price: cut(price, 20), period: cut(per, 30), blurb: cut(rest, 160), features: (e.bullets || []).map((x) => cut(x, 80)).slice(0, 7) };
    }).filter((x) => x.name && (x.price || x.features.length || x.blurb)).slice(0, 4);
    case "stats": {
      const out: { value: string; label: string }[] = [];
      for (const raw of ls) {
        const l = unbullet(raw);
        let m = /^(\d[\d,.]*\s?[%+kKxX×]?\+?)\s+(.{3,40})$/.exec(l); if (m) { out.push({ value: clean(m[1]), label: cut(m[2], 40) }); continue; }
        m = /^(.{3,40}?)\s*[:\-–—]\s*(\d[\d,.]*\s?[%+kKxX×]?\+?)$/.exec(l); if (m) out.push({ value: clean(m[2]), label: cut(m[1], 40) });
      }
      return out.slice(0, 6);
    }
    case "clients": return ls.flatMap((l) => unbullet(l).split(/\s*[,·|]\s*/)).map((x) => cut(x, 40)).filter((x) => x.length >= 2 && x.length <= 40 && !/[.!?]$/.test(x)).slice(0, 12);
    case "work": return entries(ls).map((e) => {
      const rm = /\b(\d[\d,.]*\s?[%×x+]?[^.]{0,60}(?:increase|reduction|growth|faster|more|less|saved|cut|up|down)[^.]*)/i.exec(e.body || "");
      return { title: cut(e.title, 70), summary: cut(e.body, 220), client: "", result: cut(rm?.[1], 80) };
    }).slice(0, 6);
    case "offers": return entries(ls).map((e) => { const all = [e.title, e.body || ""].join(" "), pm = PRICE.exec(all); return { title: cut(e.title.replace(PRICE, "").replace(/[-–—:|]+\s*$/, ""), 60), body: cut((e.body || "").replace(PRICE, ""), 160), when: cut(/\b(mon|tue|wed|thu|fri|sat|sun|daily|weekdays?|weekends?)[^.]{0,40}/i.exec(all)?.[0], 40), price: pm ? clean(pm[0]) : "" }; }).filter((x) => x.title).slice(0, 6);
    case "experience": {
      const out: { period: string; title: string; org: string; bullets: string[] }[] = []; let cur: any = null;
      const per = /((?:19|20)\d{2}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(?:19|20)\d{2})\s*(?:[-–—]|to)\s*(present|now|current|(?:19|20)\d{2}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(?:19|20)\d{2})/i;
      for (const raw of ls) {
        const l = clean(raw), pm = per.exec(l);
        if (pm && !isBullet(raw)) {
          const rest = clean(l.replace(pm[0], "").replace(/^[|,·–—-]+\s*|\s*[|,·–—-]+$/g, "")), [t, ...o] = rest.split(/\s+(?:at|@)\s+|\s*[|,·–—]\s+/);
          cur = { period: clean(pm[0]).replace(/\s*[-–—]\s*/, " – "), title: cut(t, 60), org: cut(o.join(", ").replace(/[\s|,·–—-]+$/, ""), 60), bullets: [] }; out.push(cur);
        } else if (cur) {
          if (isBullet(raw)) cur.bullets.push(cut(unbullet(raw), 160));
          else if (!cur.title) cur.title = cut(l, 60); else if (!cur.org && l.length <= 60) cur.org = l;
        } else if (!isBullet(raw) && l.length <= 60) { cur = { period: "", title: cut(l, 60), org: "", bullets: [] }; out.push(cur); }
      }
      return out.filter((x) => x.title).map((x) => ({ ...x, bullets: x.bullets.slice(0, 4) })).slice(0, 6);
    }
    case "education": {
      const out: { period: string; title: string; sub: string }[] = [];
      for (const raw of ls) {
        const l = unbullet(raw), yr = /((?:19|20)\d{2}(?:\s*[-–—]\s*(?:(?:19|20)\d{2}|present))?)/.exec(l), rest = clean(l.replace(yr?.[0] || "", "").replace(/^[|,·–—:-]+\s*|\s*[|,·–—:-]+$/g, "")), [t, ...s] = rest.split(/\s*[|,·–—]\s+|\s+(?:from|at)\s+/);
        if (t && t.length >= 3) out.push({ period: yr ? clean(yr[1]).replace(/\s*[-–—]\s*/, " – ") : "", title: cut(t, 70), sub: cut(s.join(", "), 70) });
      }
      return out.slice(0, 6);
    }
    case "languages": return ls.flatMap((l) => unbullet(l).split(/\s*[,·|/]\s*|\s+and\s+/)).map((x) => cut(x.replace(/\s*\(.*\)$/, ""), 20)).filter((x) => /^[A-Za-z ]{3,20}$/.test(x)).slice(0, 6);
    case "mission": case "vision": return cut(ls.map(unbullet).join(" "), 220);
  }
}

/** Every section the document has, as lists. A heading starts a section; the next heading ends it. */
export function readSections(text: string): DocSections {
  const ls = text.replace(/\r/g, "").split("\n").map((l) => l.trim()).filter(Boolean), out: any = {};
  let key: keyof DocSections | "stop" | null = null, buf: string[] = [];
  const flush = () => { if (key && key !== "stop" && buf.length && !out[key]) { try { const v = parse(key, buf); if (Array.isArray(v) ? v.length : v) out[key] = v; } catch { /* a section that can't be read is left out */ } } buf = []; };
  for (const l of ls) { const h = /^(our |my )?(mission|vision)\s*[:–—-]/i.test(l) ? "stop" : headingOf(l); if (h) { flush(); key = h; } else if (key) buf.push(l); }
  flush();
  // "Mission: …" / "Vision: …" written on one line
  for (const k of ["mission", "vision"] as const) if (!out[k]) { const m = new RegExp("^(?:our |my )?" + k + "\\s*[:–—-]\\s*(.{20,})$", "im").exec(text); if (m) out[k] = cut(m[1], 220); }
  return out;
}

/** The section names found (for a short message). */
export const NAMES: Record<string, string> = { services: "services", team: "team", testimonials: "testimonials", faq: "questions", pricing: "pricing", process: "how you work", stats: "numbers", clients: "clients", work: "work", highlights: "highlights", offers: "offers", events: "events", experience: "experience", education: "education", skills: "skills", languages: "languages", mission: "mission", vision: "vision", values: "values" };
export const sectionNames = (s: DocSections) => SECTION_LIST.filter((k) => { const v = (s as any)[k]; return Array.isArray(v) ? v.length : !!v; }).map((k) => NAMES[k]);

/** Kept with the answers as a small text (only the lists, trimmed). */
export const packSections = (s: DocSections): string => { let j = JSON.stringify(s); if (j.length > 9000) { const t: any = { ...s }; for (const k of ["work", "events", "highlights", "clients"]) { delete t[k]; j = JSON.stringify(t); if (j.length <= 9000) break; } } return j.length <= 9000 ? j : ""; };
export const unpackSections = (s: string | undefined): DocSections => { try { const o = JSON.parse(s || "{}"); return o && typeof o === "object" ? o : {}; } catch { return {}; } };

/** The lines that belong to no section of the document (its opening and "about" parts): the place to look for the person's own story. */
export function outsideLines(text: string): string[] {
  const out: string[] = []; let inSec = false;
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const l = raw.trim(); if (!l) continue;
    const h = /^(our |my )?(mission|vision)\s*[:–—-]/i.test(l) ? "stop" : headingOf(l);
    if (h) { inSec = h !== "stop"; continue; }
    if (!inSec) out.push(l);
  }
  return out;
}
