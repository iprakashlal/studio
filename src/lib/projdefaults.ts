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

export type PdId = "emails" | "mail" | "msg" | "privacy" | "terms" | "consent" | "pay";
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
];
export const PD_LABEL = Object.fromEntries(PD_SECTIONS.map((s) => [s.id, s.label])) as Record<PdId, string>;
/** The connections each section brings (names of the database's settings). */
export const PD_CONN: Partial<Record<PdId, string[]>> = { mail: ["mail"], msg: ["wa", "sms"], pay: ["rz", "cf", "pe", "st", "pp"] };
const CONSENT_CARDS = ["Wording for visitors in India", "Wording for international visitors"];

/** The cards of a template's own editor that a section stands for (what the Studio edits, and what a site's admin locks). */
export function pdCards(kind: string, sec: PdId): Card[] {
  const S = TEMPLATES[kind]?.schema || [], cat = (id: string) => S.find((c) => c.id === id);
  if (sec === "emails") return (cat("emails")?.cards || []).filter((c) => c.title !== "How templates work");
  if (sec === "consent") return (cat("consent")?.cards || []).filter((c) => CONSENT_CARDS.includes(c.title));
  if (sec === "pay") return cat("payments")?.cards || [];
  return [];
}
/** Which sections a website type has. */
export function pdSections(kind: string): PdId[] {
  const S = TEMPLATES[kind]?.schema || [], has = (id: string) => S.some((c) => c.id === id);
  return PD_SECTIONS.map((s) => s.id).filter((id) => {
    if (id === "emails") return has("emails");
    if (id === "consent") return has("consent");
    if (id === "privacy" || id === "terms") return has("legal");
    if (id === "pay") return has("payments");
    if (id === "msg") return kind !== "portfolio";
    return true;
  });
}

/** The content paths inside some fields (a list is one value; "when" and grids are looked into). */
export function fieldPaths(fields: Field[] | undefined, out: string[] = [], conns?: string[]): string[] {
  for (const f of fields || []) {
    const x = f as any; if (!x) continue;
    if (x.t === "grid" || x.t === "when") { if (x.t === "when" && x.path) out.push(x.path); fieldPaths(x.fields, out, conns); }
    else if (x.t === "connection") conns?.push(x.kind);
    else if (x.t === "legalPages") out.push("@legal");
    else if (x.path) out.push(x.path);
  }
  return out;
}
const uniq = <T,>(l: T[]) => [...new Set(l)];
export function pdPaths(kind: string, sec: PdId): string[] { return uniq(pdCards(kind, sec).flatMap((c) => fieldPaths(c.fields))).filter((p) => p !== "@legal"); }

/** What the Studio's Settings show first when a section is switched on: the template's own standard values. */
export function pdSeed(kind: string, sec: PdId, base: any): any {
  if (sec === "privacy" || sec === "terms") return { text: legalTemplate(kind, sec) };
  const v: any = {};
  for (const p of pdPaths(kind, sec)) { const x = getP(base, p); if (x !== undefined) setP(v, p, clone(x)); }
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
let current: ProjectDefaults = {};
export const currentPdefs = () => current;
export const setCurrentPdefs = (d: any) => { current = cleanPdefs(d); };
export function cleanPdefs(d: any): ProjectDefaults {
  const out: ProjectDefaults = {};
  for (const k of PD_KINDS) {
    const K = d?.[k]; if (!K || typeof K !== "object") continue; const o: PdKind = {};
    for (const s of pdSections(k)) { const x = K[s]; if (!x || typeof x !== "object") continue; o[s] = { ...(x.on ? { on: true } : {}), ...(x.v && typeof x.v === "object" ? { v: clone(x.v) } : {}) }; }
    if (Object.keys(o).length) out[k] = o;
  }
  return out;
}
/** The sections the Studio gives this website type. */
export const pdOn = (kind: string, d: ProjectDefaults = current): PdId[] => pdSections(kind).filter((s) => d[kind]?.[s]?.on);
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
  for (const p of pdPaths(kind, sec)) { const x = getP(v, p); if (x === undefined) { const at = p.split("."), last = at.pop()!, o = getP(c, at.join(".")); if (o && typeof o === "object") delete o[last]; } else setP(c, p, clone(x)); }
}

/** Puts the Studio's defaults for this website type into a site's content. Says whether anything changed. */
export function applyDefaults(c: any, kind: string, d: ProjectDefaults = current): boolean {
  if (!c || typeof c !== "object") return false;
  const before = JSON.stringify({ a: c.studioDefaults || null, e: c.emails, n: c.contact?.form?.notifySubject, co: c.consent, p: c.payments, o: c.ordering?.pay, s: c.staticPages });
  const on = pdOn(kind, d);
  if (!on.length) { if (c.studioDefaults) delete c.studioDefaults; }
  else {
    const v: any = {}; for (const s of on) if (d[kind]?.[s]?.v != null) v[s] = clone(d[kind]![s]!.v);
    c.studioDefaults = { kind, on, v };
    for (const s of on) if (c.defaultsOff?.[s] !== true) applySection(c, s);
  }
  return before !== JSON.stringify({ a: c.studioDefaults || null, e: c.emails, n: c.contact?.form?.notifySubject, co: c.consent, p: c.payments, o: c.ordering?.pay, s: c.staticPages });
}

/** The site's admin switches a section between the Studio's default and its own. */
export function setFollow(c: any, sec: PdId, use: boolean): void {
  if (use) { if (c.defaultsOff) { delete c.defaultsOff[sec]; if (!Object.keys(c.defaultsOff).length) delete c.defaultsOff; } applySection(c, sec); }
  else c.defaultsOff = { ...(c.defaultsOff || {}), [sec]: true };
}

/** Which of the sections the Studio gives a card of the editor belongs to (followed: its fields are then the Studio's). */
export function cardSections(c: any, catId: string, card: Card): PdId[] {
  const f: PdId[] = Array.isArray(c?.studioDefaults?.on) ? c.studioDefaults.on : []; if (!f.length) return [];
  const conns: string[] = [], paths = fieldPaths(card.fields, [], conns), out: PdId[] = [];
  if (paths.includes("@legal")) for (const s of ["privacy", "terms"] as PdId[]) if (f.includes(s)) out.push(s);
  for (const s of f) {
    if (s === "privacy" || s === "terms") continue;
    const own = pdPaths(c.studioDefaults.kind, s);
    if ((s === "pay" && catId === "payments") || paths.some((p) => own.includes(p)) || conns.some((k) => PD_CONN[s]?.includes(k))) out.push(s);
  }
  return uniq(out);
}
