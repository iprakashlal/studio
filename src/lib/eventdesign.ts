// Design yourself, for an event: the answers (kind of event, date, place, tickets, line-up, schedule) laid over the
// sample page of that kind of event. Nothing is made up: a part the person said nothing about is hidden.
import { EVT_TYPES, EVT_TYPE_INFO, REG_KINDS, eventTypeOf, type EvtTheme } from "../themes/events";
import { eventSample } from "./eventcopy";
import type { Theme } from "../themes/catalog";

type A = Record<string, string>;
const lines = (v?: string) => String(v || "").split(/\n+/).map((x) => x.trim()).filter(Boolean);
const two = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y > 2000 && y < 2100 ? `${y}-${two(m)}-${two(d)}` : "");
const MON = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
/** A date with no year means the next time that day comes round. */
const yearFor = (m: number, d: number) => { const now = new Date(), y = now.getFullYear(); return new Date(y, m - 1, d, 23, 59) < now ? y + 1 : y; };
/** "12 March 2027", "March 12", "12/03/2027" (day first) or "2027-03-12" as 2027-03-12; "" when it isn't a date. */
export function parseDay(v: string): string {
  const s = String(v || "").trim(); if (!s) return "";
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s); if (m) return iso(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/.exec(s); if (m) return iso(m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : yearFor(+m[2], +m[1]), +m[2], +m[1]);
  m = /(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([a-z]{3,9})\.?,?\s*(\d{4})?/i.exec(s);
  if (m) { const mo = MON.indexOf(m[2].slice(0, 3).toLowerCase()) + 1; if (mo) return iso(m[3] ? +m[3] : yearFor(mo, +m[1]), mo, +m[1]); }
  m = /([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})?/i.exec(s);
  if (m) { const mo = MON.indexOf(m[1].slice(0, 3).toLowerCase()) + 1; if (mo) return iso(m[3] ? +m[3] : yearFor(mo, +m[2]), mo, +m[2]); }
  return "";
}
/** "9:30 am", "6pm", "18:00" as 09:30, 18:00; "" when it isn't a time. */
export function parseTime(v: string): string {
  const m = /^\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/i.exec(String(v || "")); if (!m) return "";
  let h = +m[1]; const mi = +(m[2] || 0), ap = (m[3] || "").toLowerCase().replace(/\./g, "");
  if (ap === "pm" && h < 12) h += 12; if (ap === "am" && h === 12) h = 0;
  return h < 24 && mi < 60 ? `${two(h)}:${two(mi)}` : "";
}
/** The kind of event the answers describe: the one chosen, or the closest to the words used, or a conference. */
export const eventTypeFor = (a: A): string => (EVT_TYPES.includes(a.etype) ? a.etype : eventTypeOf(`${a.etype || ""} ${a.name || ""} ${a.eabout || ""}`) || "Conference");
/** The registration the answers ask for: the one chosen, or the theme's own when it suits this kind of event, or the kind's first. */
export function regKindFor(a: A, theme?: Theme): string {
  const info = EVT_TYPE_INFO[eventTypeFor(a)], th = (theme as Partial<EvtTheme> | undefined)?.evt?.regKind || "";
  return REG_KINDS.some(([k]) => k === a.ereg) ? a.ereg : info.kinds.includes(th) ? th : info.kinds[0];
}
/** Kinds of registration that are priced by a list of tickets, passes or categories. */
export const REG_HAS_TICKETS = ["tickets", "delegate", "seat", "enrol", "team", "stall", "entry"];
const ONE: Record<string, string> = { tickets: "General entry", delegate: "Delegate pass", seat: "Seat", enrol: "Standard batch", team: "Team entry", stall: "Standard stall", entry: "Open category" };
const LOREM = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.";

export function eventDesign(a: A, c0: any, o: { theme?: Theme; name: string; city: string; phone: string; email: string; address: string; social: string }): any {
  const type = eventTypeFor(a), info = EVT_TYPE_INFO[type], kind = regKindFor(a, o.theme), c = eventSample(c0, type, kind), { name, city } = o;
  const put = (path: string, v: any) => { const ks = path.split("."); let t = c; for (const x of ks.slice(0, -1)) { if (!t[x] || typeof t[x] !== "object") t[x] = {}; t = t[x]; } t[ks[ks.length - 1]] = v; };
  const set = (on: boolean, ...ids: string[]) => { for (const s of c.sections || []) if (ids.includes(s.id)) s.show = on; };
  c.register.kind = kind; // kept when another theme is tried in the preview
  // Who and what
  if (name) { put("brand.name", name); put("hero.title", name); put("footer.legal", `© {year} ${name}. All rights reserved.`); put("seo.title", city ? `${name} · ${city}` : name); }
  const tag = (a.tagline || "").trim(), about = (a.eabout || "").trim();
  if (tag) put("brand.tagline", tag);
  put("hero.lede", tag || (about ? about.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ").slice(0, 220) : c.hero.lede)); put("hero.badges", []);
  put("footer.text", tag || (name ? `${name}${city ? ", " + city : ""}.` : c.footer.text));
  // When and where
  const day = parseDay(a.edate || ""), said = (a.edate || "").trim();
  put("event.date", day); put("event.endDate", ""); put("event.dateText", day ? "" : said || "Date to be announced"); put("event.time", parseTime(a.etime || "")); put("event.endTime", "");
  put("hero.eyebrow", `${type}${day ? " · " + day.slice(0, 4) : ""}`);
  const venue = (a.evenue || "").trim(), online = /\b(online|virtual|zoom|google meet|teams|webinar)\b/i.test(venue) || (!venue && type === "Webinar");
  put("event.venue", online ? "" : venue); put("event.city", online ? "" : city); put("event.mode", online ? "online" : "inperson");
  put("venue.name", online ? "" : venue); put("venue.address", online ? "" : o.address || city); put("venue.points", []); put("venue.mapUrl", "");
  set(!online && !!(venue || o.address || city), "venue");
  // About (their words, or a note that opens the question)
  put("about.title", name ? `About ${name}` : "About the event"); put("about.values", []);
  put("about.body", about || `${LOREM} (Edit:eabout)`); set(true, "about");
  // The parts that only show when they said something
  const high = lines(a.ehigh);
  if (high.length) { const base = c.services.items; put("services.items", high.slice(0, 8).map((l, i) => { const m = /^(.{2,60}?)\s*(?::|\s[-–—]\s)\s*(.{3,})$/.exec(l); return { icon: base[i % base.length]?.icon || "spark", title: (m ? m[1] : l).trim(), body: m ? m[2].trim() : "", points: [] }; })); put("services.lede", ""); }
  set(high.length > 0, "services");
  const ppl = lines(a.elineup);
  if (ppl.length) { put("team.members", ppl.slice(0, 40).map((l) => { const m = /^(.{2,60}?)\s*(?:\s[-–—]\s|:|,)\s*(.{2,})$/.exec(l); return { name: (m ? m[1] : l).trim(), role: m ? m[2].trim() : "", topic: "", photo: null, bio: "", linkedin: "" }; })); put("team.lede", ""); put("team.title", info.stage); }
  set(ppl.length > 0, "team");
  const plan = lines(a.eschedule);
  if (plan.length) { put("schedule.days", [{ label: "Programme", date: "", items: plan.slice(0, 60).map((l) => { const m = /^(\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)?)\s*(?:[-–—:]\s*|\s+)(.{2,})$/i.exec(l); return { time: m ? parseTime(m[1]) || m[1].trim() : "", title: (m ? m[2] : l).trim(), who: "", place: "", body: "", tag: "" }; }) }]); put("schedule.lede", ""); }
  set(plan.length > 0, "schedule");
  // Tickets: theirs, or one free place so registration works
  if (REG_HAS_TICKETS.includes(kind)) {
    const T = lines(a.etickets).slice(0, 12).map((l, i) => { const free = /\bfree\b/i.test(l), m = /^(.*?)[\s:–—-]*(?:₹|rs\.?|inr|\$|€|£)?\s*([\d,]+(?:\.\d{1,2})?)\s*(?:\/-|only)?\s*$/i.exec(l), nm = (m ? m[1] : l).replace(/[\s:–—-]*\bfree\b.*$/i, "").trim(); return { name: nm || `Option ${i + 1}`, price: free || !m ? 0 : +m[2].replace(/,/g, "") || 0, blurb: "", features: [], limit: 0, featured: false, soldOut: false }; });
    put("register.tickets", T.length ? T : [{ name: ONE[kind] || "Entry", price: 0, blurb: "", features: [], limit: 0, featured: false, soldOut: false }]);
    put("tickets.lede", ""); put("tickets.note", ""); set(T.length > 0, "tickets");
  } else { put("register.tickets", []); set(false, "tickets"); }
  // Made-up parts of the sample are not theirs
  put("stats.items", []); put("testimonials.items", []); put("faq.items", []); put("clients.logos", []); put("gallery.images", []);
  set(false, "clients", "stats", "testimonials", "faq", "work", "process", "gallery");
  put("hero.ctaSecondary", plan.length ? "See the programme" : ""); put("hero.ctaSecondaryTarget", plan.length ? "schedule" : "");
  // Contact
  put("contact.email", o.email); put("contact.phone", o.phone); put("contact.whatsapp", o.phone.replace(/\D/g, "")); put("contact.address", online ? "" : [venue, o.address || city].filter(Boolean).join("\n")); put("contact.hours", ""); put("contact.linkedin", "");
  put("contact.title", "Questions? Write to us"); put("contact.lede", "");
  set(!!(o.email || o.phone), "contact");
  if (o.social) c.footer.links = [{ label: /instagram/.test(o.social) ? "Instagram" : "Find us online", url: o.social }, ...(c.footer.links || [])];
  // The menu follows what is shown
  if (Array.isArray(c.sections)) for (const s of c.sections) if (s && s.show === false) s.inNav = false;
  if (c.menu && Array.isArray(c.menu.items)) c.menu.items = c.menu.items.filter((m: any) => !m || !c.sections.some((s: any) => s.id === m.to && s.show === false));
  return c;
}
