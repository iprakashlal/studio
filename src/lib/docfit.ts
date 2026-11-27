// Does an uploaded document belong to the kind of website the person chose? Each kind has a few things its document
// should show; one of them is enough. Rule-based: headings, labelled details and lists the reader already found.
import type { DocRead } from "./docread";
import { readSections } from "./docsections";

export type DocFit = { ok: boolean; /** What was looked for, in plain words. */ wanted: string[]; found: string[]; missing: string[] };

const DATE = /\b\d{1,2}(st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(,?\s+\d{4})?\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(st|nd|rd|th)?(,?\s+\d{4})?\b|\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b/i;
const CLOCK = /\b\d{1,2}([:.]\d\d)?\s*(am|pm)\b|\b\d{1,2}:\d\d\s*(?:[-–—]|to)\s*\d{1,2}:\d\d\b/i;

export function docFits(kind: string, text: string, rd: DocRead): DocFit {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  // A heading or a label: a short line, or the part of a line before its colon.
  const heads = lines.map((l) => (l.length <= 60 ? l : /^([^:：]{2,40})[:：]/.exec(l)?.[1] || "")).filter(Boolean).map((l) => l.toLowerCase().replace(/^[-–•*]\s*/, "").replace(/^\d{1,2}[.)]\s*/, "").replace(/[:：]\s*$/, "").trim());
  const head = (re: RegExp) => heads.some((h) => re.test(h)), secs = readSections(text) as Record<string, any>, has = (k: string) => { const v = secs[k]; return Array.isArray(v) ? v.length > 0 : !!v; };
  const priced = rd.items.filter((i) => i.price || i.sizes?.length).length, food = /\b(menu|dishes|cuisine|chef|thali|starters|beverages|desserts|veg)\b/i.test(text), f = rd.fields;
  const days = /\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\b|\bdaily\b|every ?day|weekdays?|weekends?/i.test(text), sign = !!rd.money;
  const checks: Record<string, [string, boolean][]> = {
    portfolio: [["a bio (About me, Summary, Profile)", head(/^(about me|about|bio|biography|profile|personal profile|(professional |career )?(summary|objective)|introduction)$/)], ["work experience", has("experience") || head(/^(work |professional )?(experience|employment|work history|career history)\b/)], ["hobbies or interests", head(/^(my )?(hobbies|interests|hobbies (and|&) interests)\b/)]],
    business: [["services", head(/\bservices\b|what we (do|offer)|solutions|capabilities|practice areas?|our expertise|offerings/)], ["a case study or past work", !!rd.sections?.work?.length || head(/case stud|^(our |selected |recent |featured )?(work|projects)$|success stor|^(our |key )?clients$/)], ["the team", head(/^(our |the |meet (the|our) |leadership |management )?(team|leadership|founders?|people|management)$/)]],
    store: [["products with prices", head(/^(our |all |featured |new )?(products?|product (list|catalogu?e|range|inventory)|catalogu?e|collections?|price list|inventory)$/) || (sign && priced >= 2 && !food)], ["best sellers", head(/best.?sell|top sell|most popular|featured products/)], ["delivery or shipping details", !!(f.ship || f.freeship || f.dtime || f.returns) || head(/\b(delivery|shipping|dispatch|returns)\b/)]],
    restaurant: [["a menu (dishes with prices)", head(/\bmenu\b|\bdishes\b|starters|main course|beverages|desserts/) || (sign && priced >= 2 && !head(/shipping|catalogu?e|\bsku\b|^products?$/))], ["opening times", !!f.hours || head(/hours|timings|open (daily|from|all)/) || (CLOCK.test(text) && days)]],
    events: [["a schedule or agenda", head(/^(event |the |our |full )?(schedule|agenda|programme|program|itinerary|timeline|line-?up|sessions)$/)], ["a date", !!f.edate || DATE.test(text)]],
  };
  const list = checks[kind]; if (!list) return { ok: true, wanted: [], found: [], missing: [] };
  const found = list.filter((x) => x[1]).map((x) => x[0]), missing = list.filter((x) => !x[1]).map((x) => x[0]);
  return { ok: found.length > 0, wanted: list.map((x) => x[0]), found, missing };
}
