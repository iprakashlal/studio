// Project defaults (Settings → Project defaults): wording and setup the Studio gives every project of a website type —
// email templates, the cookie banner's wording, the privacy policy and terms, payment methods — and, kept encrypted on
// the Studio's database, the Resend, WhatsApp/SMS and payment gateway connections those sites use.
//
// How it reaches a site: when a project is opened in the Studio, published, or rebuilt by Push updates, the sections the
// Studio switched on are written into the site's content (the fields those sections own), together with a copy of the
// defaults (content.studioDefaults) so the site's own admin page can switch a section back on after editing its own.
// A section the site's admin switched off (content.defaultsOff[section] = true) is left as the site has it.
// The connections are read by the database itself: a site that follows the section uses the Studio's connection.

import { TEMPLATES } from "../schema";
import type { Card, Field } from "../schema/types";
import { LEGAL_PAGES, identity, privacyText, termsText, type LegalKind } from "./legal";
import { staticPageDefault } from "../schema/common";
import { clone, getP, setP } from "./util";

export type PdId = "emails" | "mail" | "msg" | "privacy" | "terms" | "consent" | "pay" | "policies" | "formprivacy" | "footer" | "gst" | "checkout";
export type PdSec = { on?: boolean; /** Content sections: the values (a part of a site's content; privacy/terms: { text }). */ v?: any };
export type PdKind = Partial<Record<PdId, PdSec>>;
export type ProjectDefaults = Record<string, PdKind>;

export const PD_KINDS = ["portfolio", "business", "store", "restaurant", "events"] as const;
export const PD_SECTIONS: { id: PdId; label: string; desc: string; conn?: boolean }[] = [
  { id: "emails", label: "Email templates", desc: "The wording of the emails sites send: enquiry copies, thank-you notes and order emails." },
  { id: "mail", label: "Email (Resend)", desc: "The Resend account and sender every site's emails go out through.", conn: true },
  { id: "msg", label: "WhatsApp & SMS", desc: "The WhatsApp Business and SMS accounts that send codes and order messages.", conn: true },
  { id: "privacy", label: "Privacy policy", desc: "The text of the Privacy policy page." },
  { id: "terms", label: "Terms of use", desc: "The text of the Terms of use page." },
  { id: "consent", label: "Cookie consent", desc: "What the cookie banner says to visitors in India and to international visitors." },
  { id: "pay", label: "Payment config", desc: "Which ways to pay are on, their labels, the UPI ID, and the gateway keys." },
  { id: "policies", label: "Shop policies", desc: "Shipping, returns, refunds and cancellation pages, linked at the bottom of the shop." },
  { id: "formprivacy", label: "Form consent & spam", desc: "The tick box on forms and checkout, what waits for consent (Google Fonts and Maps), and spam protection." },
  { id: "footer", label: "Footer credit", desc: "The legal or credit line at the bottom of every page, and whether the “Powered by” badge shows. {name} becomes the site's name; {year} the current year." },
  { id: "gst", label: "GST invoices & tax", desc: "Tax on prices, GST invoice settings, and the invoice's look and wording. Each business's own GSTIN, name, address, PAN, logo, signature and bank details stay its own." },
  { id: "checkout", label: "Checkout rules", desc: "What checkout asks, verification of the phone or email, the message after ordering, and abandoned-cart reminders." },
];
export const PD_LABEL = Object.fromEntries(PD_SECTIONS.map((s) => [s.id, s.label])) as Record<PdId, string>;
/** The connections each section brings (names of the database's settings). */
export const PD_CONN: Partial<Record<PdId, string[]>> = { mail: ["mail"], msg: ["wa", "sms"], pay: ["rz", "cf", "pe", "st", "pp"] };
const CONSENT_CARDS = ["Wording for visitors in India", "Wording for international visitors"];

/** Fields of a section that stay each site's own (its identity, its bank, its own links). */
const SKIP: Partial<Record<PdId, string[]>> = {
  gst: ["gst.legalName", "gst.gstin", "gst.address", "gst.state", "gst.pan", "gst.sign", "invoice.logo", "invoice.bank", "invoice.sign"],
  checkout: ["recovery.url", "recovery.offer"],
};
/** The footer: only its legal or credit line (the description and links are each site's own) and the badge switch. */
const FOOTER = ["footer.legal", "contact.footerLeft", "contact.footerRight", "poweredBy.show"];

/** The cards of a template's own editor that a section stands for (what the Studio edits, and what a site's admin locks). */
export function pdCards(kind: string, sec: PdId): Card[] {
  const S = TEMPLATES[kind]?.schema || [], cat = (id: string) => S.find((c) => c.id === id), cards = (id: string, titles?: string[]) => (cat(id)?.cards || []).filter((c) => !titles || titles.includes(c.title));
  if (sec === "emails") return cards("emails").filter((c) => c.title !== "How templates work");
  if (sec === "consent") return cards("consent", CONSENT_CARDS);
  if (sec === "pay") return cards("payments");
  if (sec === "policies") return kind === "store" ? cards("contact", ["Policies"]) : [];
  if (sec === "formprivacy") return cards("legal", ["Consent on forms", "Before consent", "Spam protection"]);
  if (sec === "footer") return [...cards("footer", ["Footer"]), ...(kind === "store" || kind === "portfolio" ? cards("contact", ["Footer"]) : []), ...cards("features", ["“Powered by” badge"])];
  if (sec === "gst") return [...cards("pricing", ["Tax"]).filter(() => kind === "store"), ...cards("gst"), ...(kind === "restaurant" ? cards("checkout", ["GST invoice", "Invoice style & layout", "Invoice contents & wording"]) : [])];
  if (sec === "checkout") return kind === "store" ? cards("checkout") : kind === "restaurant" ? cards("checkout", ["Cart extras", "Contact details before checkout", "Abandoned carts"]) : [];
  return [];
}
/** Which sections a website type has. */
export function pdSections(kind: string): PdId[] {
  const S = TEMPLATES[kind]?.schema || [], has = (id: string) => S.some((c) => c.id === id);
  return PD_SECTIONS.map((s) => s.id).filter((id) => {
    if (id === "privacy" || id === "terms") return has("legal");
    if (id === "msg") return kind !== "portfolio";
    if (id === "mail") return true;
    return pdPaths(kind, id).length > 0;
  });
}

/** The content paths inside some fields (a list is one value; "when" and grids are looked into). */
export function fieldPaths(fields: Field[] | undefined, out: string[] = [], conns?: string[]): string[] {
  for (const f of fields || []) {
    const x = f as any; if (!x) continue;
    if (x.t === "grid" || x.t === "when") { if (x.t === "when" && x.path) out.push(x.path); fieldPaths(x.fields, out, conns); }
    else if (x.t === "connection") conns?.push(x.kind);
    else if (x.t === "legalPages") out.push("@legal");
    else if (x.t === "mailtpl") out.push(`emails.${x.kind}.tpl`);
    else if (x.path) out.push(x.path);
  }
  return out;
}
const uniq = <T,>(l: T[]) => [...new Set(l)];
export function pdPaths(kind: string, sec: PdId): string[] {
  const skip = SKIP[sec] || [];
  return uniq(pdCards(kind, sec).flatMap((c) => fieldPaths(c.fields))).filter((p) => p !== "@legal" && !skip.includes(p) && (sec !== "footer" || FOOTER.includes(p) || (kind === "store" && p === "footer.text")));
}

/** A field's own path(s), without what is inside a "when" (that is judged field by field). */
function ownPaths(f: any): string[] { return f?.t === "grid" ? fieldPaths(f.fields) : f?.t === "when" ? [f.path] : f?.t === "legalPages" ? ["@legal"] : f?.t === "connection" ? ["@conn:" + f.kind] : f?.t === "mailtpl" ? [`emails.${f.kind}.tpl`] : f?.path ? [f.path] : []; }
/** Splits fields into those a set of paths owns and the rest, keeping their order; grids and "when" blocks are split inside. */
export function splitFields(fields: Field[], owns: (path: string) => boolean): { f: Field; own: boolean }[] {
  const out: { f: Field; own: boolean }[] = [];
  for (const f of fields || []) {
    const x = f as any; if (!x) continue;
    if (x.t === "note") { out.push({ f, own: false }); continue; }
    if (x.t === "grid" || x.t === "when") {
      const inner = splitFields(x.fields, owns), mine = inner.filter((i) => i.own).map((i) => i.f), rest = inner.filter((i) => !i.own && (i.f as any).t !== "note").map((i) => i.f);
      const head = x.t === "when" && owns(x.path);
      if (!rest.length && (mine.length || head)) { out.push({ f, own: true }); continue; }
      if (!mine.length && !head) { out.push({ f, own: false }); continue; }
      if (x.t === "grid") { out.push({ f: { ...x, fields: mine }, own: true }); out.push({ f: { ...x, fields: rest }, own: false }); }
      else { if (mine.length) out.push({ f: { ...x, fields: mine }, own: true }); out.push({ f: { ...x, fields: inner.filter((i) => !i.own).map((i) => i.f) }, own: false }); }
      continue;
    }
    const ps = ownPaths(x); out.push({ f, own: ps.length > 0 && ps.every(owns) });
  }
  return out;
}
/** What a section owns, as a test of one path (or "@legal" / "@conn:<kind>"). */
export function ownsOf(kind: string, secs: PdId[], catId?: string): (p: string) => boolean {
  const set = new Set<string>();
  for (const s of secs) {
    if (s === "privacy" || s === "terms") set.add("@legal");
    for (const k of PD_CONN[s] || []) set.add("@conn:" + k);
    if (s === "pay" && catId === "payments") return () => true;
    for (const p of pdPaths(kind, s)) set.add(p);
  }
  return (p) => set.has(p);
}

/** What the Studio's Settings show first when a section is switched on: the template's own standard values. */
export function pdSeed(kind: string, sec: PdId, base: any): any {
  if (sec === "privacy" || sec === "terms") return { text: legalTemplate(kind, sec) };
  const v: any = {};
  for (const p of pdPaths(kind, sec)) { const x = getP(base, p); if (x !== undefined) setP(v, p, clone(x)); }
  if (sec === "footer") {
    // The sample's own name and year become placeholders; a shop's footer line starts as the copyright line.
    const nm = identity(base).name, gen = (t: string) => (nm ? t.split(nm).join("{name}") : t).replace(/\b20\d\d\b/g, "{year}");
    for (const p of pdPaths(kind, sec)) { const x = getP(v, p); if (typeof x === "string") setP(v, p, gen(x)); }
    if (kind === "store") setP(v, "footer.text", "© {year} {name}");
  }
  return v;
}

// ---- privacy policy and terms: written once with placeholders, filled from each site's own business details
const PH = { name: "{name}", address: "{address}", phone: "{phone}", email: "{email}", gstin: "{gstin}", cin: "{cin}" };
/** The standard text of the page for this website type, with {name}, {address}, {phone}, {email}, {gstin} and {cin} in it. */
export function legalTemplate(kind: string, which: LegalKind): string {
  const c = { legal: PH, brand: {}, contact: {}, consent: { on: true } };
  return (which === "privacy" ? privacyText(kind, c) : termsText(kind, c)).replace(/Last updated: .*$/m, "Last updated: {date}");
}
export const LEGAL_PH = ["{name}", "{address}", "{phone}", "{email}", "{gstin}", "{cin}", "{date}"];
/** The page's text for one site: its details in the place of the placeholders; a line left with nothing after its label goes. */
export function fillLegal(text: string, c: any): string {
  const I = identity(c), one = (v: string) => v.replace(/\s*\n\s*/g, ", ");
  const map: Record<string, string> = { name: I.name || "this website's owner", address: one(I.address), phone: I.phone, email: I.email, gstin: I.gstin, cin: I.cin, date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) };
  return String(text || "").replace(/\{(name|address|phone|email|gstin|cin|date)\}/g, (_, k) => map[k] || "")
    .split("\n").filter((l) => !/^\s*(Phone|Email|GSTIN|CIN|Address):\s*$/i.test(l)).join("\n").replace(/, ,/g, ",").replace(/\n{3,}/g, "\n\n").trim();
}

// ---- the Studio's defaults, for the code that publishes (set by the Studio screen when its data loads)
let current: ProjectDefaults = {}, ready: Promise<void> = Promise.resolve(), gen = 0;
export const currentPdefs = () => current;
/** Every section is on unless the Studio switched it off; a section with no values saved yet uses the template's standard ones. */
export const secOn = (x: PdSec | undefined) => x?.on !== false;
export const setCurrentPdefs = (d: any) => { const me = ++gen; const c = cleanPdefs(d); current = c; ready = withSeeds(c).then((f) => { if (me === gen) current = f; }).catch(() => {}); };
/** Resolves once the standard values of the sections the Studio hasn't written yet are loaded (publishing waits for it). */
export const pdReady = () => ready;
const seedCache: Record<string, any> = {};
/** The template's standard content (with what its editor prepares), for seeding. */
export async function pdBase(kind: string): Promise<any> {
  if (!seedCache[kind]) { const { loadMergeBase } = await import("./exporter"); const b = await loadMergeBase(kind); TEMPLATES[kind]?.prepare?.(b); seedCache[kind] = b; }
  return clone(seedCache[kind]);
}
/** The defaults with every switched-on section given values (the template's standard ones where none were saved). */
export async function withSeeds(d: ProjectDefaults): Promise<ProjectDefaults> {
  const out: ProjectDefaults = clone(d);
  for (const k of PD_KINDS) for (const s of pdSections(k)) {
    if (PD_CONN[s] && s !== "pay") continue;
    const x = ((out[k] ||= {})[s] ||= {});
    if (!secOn(x) || x.v != null) continue;
    x.v = pdSeed(k, s, s === "privacy" || s === "terms" ? {} : await pdBase(k));
  }
  return out;
}
export function cleanPdefs(d: any): ProjectDefaults {
  const out: ProjectDefaults = {};
  for (const k of PD_KINDS) {
    const K = d?.[k]; if (!K || typeof K !== "object") continue; const o: PdKind = {};
    for (const s of pdSections(k)) { const x = K[s]; if (!x || typeof x !== "object") continue; o[s] = { ...(x.on === false ? { on: false } : {}), ...(x.v && typeof x.v === "object" ? { v: clone(x.v) } : {}) }; }
    if (Object.keys(o).length) out[k] = o;
  }
  return out;
}
/** The sections the Studio gives this website type. */
export const pdOn = (kind: string, d: ProjectDefaults = current): PdId[] => pdSections(kind).filter((s) => secOn(d[kind]?.[s]));
/** A short fingerprint of what this website type gets, kept in cms/site.json so Push updates can tell it changed. */
export function pdVersion(kind: string, d: ProjectDefaults = current): string {
  const on = pdOn(kind, d); if (!on.length) return "";
  const s = JSON.stringify(on.map((x) => [x, d[kind]?.[x]?.v ?? null])); let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}

// ---- on a site's content
/** The sections this site follows now: given by the Studio and not switched off in its own admin page. */
export const following = (c: any): PdId[] => (Array.isArray(c?.studioDefaults?.on) ? c.studioDefaults.on : []).filter((s: PdId) => c?.defaultsOff?.[s] !== true);
export const followsSec = (c: any, s: PdId) => following(c).includes(s);

/** Writes one section's values (from the copy the site holds) into its content. */
export function applySection(c: any, sec: PdId): void {
  const D = c?.studioDefaults, kind = D?.kind, v = D?.v?.[sec];
  if (!kind || v == null) return;
  if (sec === "privacy" || sec === "terms") {
    if (!String(v.text || "").trim()) return;
    const meta = LEGAL_PAGES[sec];
    c.staticPages = Array.isArray(c.staticPages) ? c.staticPages : [];
    let p = c.staticPages.find((x: any) => x && (x.id === meta.id || x.legal === sec));
    if (!p) { p = { ...staticPageDefault(meta.title), id: meta.id, slug: meta.slug, legal: sec, inFooter: true }; c.staticPages.push(p); }
    const body = fillLegal(v.text, c);
    if (p.body !== body) { p.body = body; p.updated = new Date().toISOString().slice(0, 10); }
    p.show = true;
    if (sec === "privacy") { c.consent = c.consent || {}; if (!String(c.consent.policyUrl || "").trim()) c.consent.policyPage = meta.id; }
    return;
  }
  const name = identity(c).name, year = String(new Date().getFullYear());
  for (const p of pdPaths(kind, sec)) { let x = getP(v, p); if (sec === "footer" && typeof x === "string") { x = x.replace(/\{name\}/g, name); if (p !== "footer.legal") x = x.replace(/\{year\}/g, year); } if (x === undefined) { const at = p.split("."), last = at.pop()!, o = getP(c, at.join(".")); if (o && typeof o === "object") delete o[last]; } else setP(c, p, clone(x)); }
}

/** Puts the Studio's defaults for this website type into a site's content. Says whether anything changed. */
export function applyDefaults(c: any, kind: string, d: ProjectDefaults = current): boolean {
  if (!c || typeof c !== "object") return false;
  const before = JSON.stringify(c);
  const on = pdOn(kind, d);
  if (!on.length) { if (c.studioDefaults) delete c.studioDefaults; }
  else {
    const v: any = {}; for (const s of on) if (d[kind]?.[s]?.v != null) v[s] = clone(d[kind]![s]!.v);
    c.studioDefaults = { kind, on, v };
    for (const s of on) if (c.defaultsOff?.[s] !== true) applySection(c, s);
  }
  return before !== JSON.stringify(c);
}

/** The site's admin switches a section between the Studio's default and its own. */
export function setFollow(c: any, sec: PdId, use: boolean): void {
  if (use) { if (c.defaultsOff) { delete c.defaultsOff[sec]; if (!Object.keys(c.defaultsOff).length) delete c.defaultsOff; } applySection(c, sec); }
  else c.defaultsOff = { ...(c.defaultsOff || {}), [sec]: true };
}

/** Which of the sections the Studio gives a card of the editor belongs to (followed: its fields are then the Studio's). */
export function cardSections(c: any, catId: string, card: Card): PdId[] {
  const f: PdId[] = Array.isArray(c?.studioDefaults?.on) ? c.studioDefaults.on : []; if (!f.length) return [];
  const kind = c.studioDefaults.kind;
  return f.filter((s) => splitFields(card.fields, ownsOf(kind, [s], catId)).some((x) => x.own));
}
