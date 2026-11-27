// A project's own document into its website: what the document says (see docread.ts) is put where the website shows it.
// Only what the document gives is changed; everything else in the site stays as it is. Unlike "write new text", the
// words are the document's own, so this is for the owner's own material.
import type { DocRead, DocItem } from "./docread";
import { oneLine } from "./docread";
import { readSections, sectionNames, type DocSections } from "./docsections";
import { applySections } from "./designer";

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const digits = (p: string) => p.replace(/\D/g, "");
const first = (t: string, max: number) => { const m = /^.{20,}?[.!?](?=\s|$)/.exec(t); return m && m[0].length <= max ? m[0] : t.length <= max ? t : t.slice(0, max).replace(/\s+\S*$/, "") + "…"; };
const slug = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
function put(c: any, path: string, v: any) { const ks = path.split("."); let o = c; for (let i = 0; i < ks.length - 1; i++) { if (!o[ks[i]] || typeof o[ks[i]] !== "object") o[ks[i]] = {}; o = o[ks[i]]; } o[ks[ks.length - 1]] = v; }
const show = (c: any, ...ids: string[]) => { for (const x of c.sections || []) if (ids.includes(x.id)) { if ("visible" in x) x.visible = true; else x.show = true; } };

/** content: the site as it is. pics: a picture for each item (same order as rd.items; null where it has none). top: a picture for the top of the site.
 *  Returns the changed site and, in plain words, what was filled in. */
export function fillFromDoc(template: string, content: any, rd: DocRead, pics: ({ path: string } | { url: string } | null)[] = [], top: { path: string } | { url: string } | null = null, text = ""): { content: any; did: string[] } {
  const c = clone(content), f = rd.fields, did: string[] = [], items = rd.items, about = f.about ? oneLine(f.about) : "";
  const say = (x: string) => { if (!did.includes(x)) did.push(x); };
  const social = f.social ? (f.social.startsWith("@") ? "https://instagram.com/" + f.social.slice(1) : f.social) : "";
  const pic = (i: number) => pics[i] || null;
  if (f.domain) { put(c, "seo.siteUrl", /^https?:\/\//i.test(f.domain) ? f.domain : "https://" + f.domain); say("website address"); }
  if (template === "restaurant") {
    if (f.name) { put(c, "brand.name", f.name); put(c, "hero.title", f.name); say("name"); }
    if (f.tagline || about) { put(c, "brand.tagline", f.tagline || about); say("tagline"); }
    if (about) put(c, "hero.eyebrow", about + (f.city ? " · " + f.city : "")); else if (f.city && f.name) put(c, "hero.eyebrow", f.city);
    if (f.tagline || f.about) put(c, "hero.lede", [f.tagline, f.about].filter(Boolean).join(". ").replace(/\.\.+/g, ".").replace(/([^.!?])$/, "$1."));
    if (f.story) { put(c, "about.body", f.story); show(c, "about"); say("your story"); }
    if (f.usp) { put(c, "hero.badges", f.usp.split("\n").slice(0, 4)); say("highlights"); }
    if (f.hours) { put(c, "hours.note", f.hours); put(c, "hours.days", []); put(c, "hours.showStatus", false); put(c, "hero.showStatus", false); show(c, "hours"); say("opening hours"); }
    if (items.length) {
      const base = c.specials?.items?.[0] || {}, groups: Record<string, any[]> = {};
      items.forEach((it, i) => { const sizes = (it.sizes || []).slice(0, 6).map((z) => ({ label: z.label, price: z.price })); (groups[it.cat || "Our menu"] ||= []).push({ name: it.name, desc: it.desc, price: sizes.length ? "" : it.price, diet: it.diet || "", spice: "", tag: "", allergens: "", image: pic(i), variants: sizes, soldOut: false }); });
      put(c, "food.categories", Object.entries(groups).map(([name, list]) => ({ name, note: rd.groupNotes?.[name] || "", image: null, items: list })));
      put(c, "specials.items", items.slice(0, 8).map((it, i) => ({ ...base, name: it.name, desc: it.desc ? first(it.desc, 150) : "", price: it.price, tag: "", diet: it.diet || "", image: pic(i) })));
      if (rd.money) { put(c, "food.currency", rd.money); if (rd.money !== "₹") put(c, "food.note", ""); }
      if (f.note) put(c, "food.note", f.note);
      show(c, "food", "specials"); say(`${items.length} menu ${items.length === 1 ? "item" : "items"}${items.some((x) => x.desc) ? " with descriptions" : ""}${items.some((x) => x.price) ? " and prices" : ""}`);
    }
    if (top) put(c, "hero.image", top);
    // More than one outlet: the first is the main address, the others are listed under it.
    const outlets = (f.places || "").split("\n").map((l) => /^(.{2,40}?):\s+(.{8,})$/.exec(l.trim())).filter(Boolean) as RegExpExecArray[];
    if (outlets.length >= 2) { put(c, "contact.placeTitle", outlets[0][1]); if (f.city) put(c, "contact.placeGroup", f.city); put(c, "contact.places", outlets.slice(1).map((m, i) => ({ id: "pl-doc" + (i + 1), on: true, title: m[1], group: f.city || "", address: m[2], phone: "", note: "", mapFrom: "", mapQ: "", mapUrl: "" }))); say(`${outlets.length} locations`); }
  } else if (template === "store") {
    if (f.name) { put(c, "brand.name", f.name); put(c, "home.hero.title", `Welcome to\n${f.name}`); say("name"); }
    if (f.tagline || about) { put(c, "brand.tagline", f.tagline || about); say("tagline"); }
    if (f.about || f.story) put(c, "home.hero.text", first(f.about || f.story, 200));
    if (f.story) { put(c, "portfolio.intro", f.story); say("your story"); }
    if (items.length) {
      const base = c.products?.[0] || {}, cat0 = c.categories?.[0] || {}, groups = [...new Set(items.map((x) => x.cat).filter(Boolean))], many = groups.length >= 2;
      c.categories = many ? groups.map((g) => ({ ...cat0, id: slug(g) || "all", name: g, description: "", image: null })) : [{ ...cat0, id: "all", name: "Our range", description: about, image: null }];
      c.products = items.map((it: DocItem, i) => ({ ...base, id: "p" + (i + 1), slug: slug(it.name) || "item-" + (i + 1), name: it.name, category: many ? slug(it.cat || groups[0]) : "all", price: it.price ? +it.price : 0, compareAt: 0, images: pic(i) ? [pic(i)] : [], short: it.desc ? first(it.desc, 90) : "", description: it.desc, features: [], options: [], optionName: "", badge: "", featured: i < 4, sample: false, ...(it.sizes?.length ? { optionName: "Choose", options: it.sizes.map((z) => z.label).slice(0, 8) } : {}) }));
      const cur = ({ "₹": "INR", "$": "USD", "€": "EUR", "£": "GBP", AED: "AED" } as Record<string, string>)[rd.money]; if (cur) put(c, "settings.currency", cur);
      say(`${items.length} ${items.length === 1 ? "product" : "products"}${many ? ` in ${groups.length} categories` : ""}`);
    }
    if (top) put(c, "home.hero.image", top);
    if (social) put(c, "contact.instagram", social);
  } else if (template === "business" || template === "events") {
    if (f.name) { put(c, "brand.name", f.name); say("name"); }
    if (f.tagline || about) { put(c, "brand.tagline", f.tagline || about); put(c, "hero.title", (f.tagline || about).replace(/[.]+$/, "") + "."); say("tagline"); }
    if (f.about) put(c, "hero.lede", f.about);
    if (f.story) { put(c, "about.body", f.story); show(c, "about"); say("your story"); }
    if (f.mission) put(c, "about.mission", f.mission);
    if (f.usp) { put(c, "hero.badges", f.usp.split("\n").slice(0, 4)); say("highlights"); }
    if (f.hours) { put(c, "contact.hours", f.hours); say("hours"); }
    if (template === "business" && items.length) {
      const base = c.services?.items || [{}];
      put(c, "services.items", items.slice(0, 9).map((it, i) => ({ ...base[i % base.length], title: it.name, body: it.desc || (it.price ? `From ${rd.money}${it.price}` : ""), points: it.points?.length ? it.points : it.desc && it.price ? [`From ${rd.money}${it.price}`] : [] })));
      show(c, "services"); say(`${Math.min(items.length, 9)} services`);
    }
    if (top) put(c, "hero.image", top);
  } else {   // a personal portfolio
    if (f.name) { put(c, "brand.logoText", f.name); const p = f.name.split(/\s+/); put(c, "hero.firstName", p[0] || f.name); put(c, "hero.lastName", p.slice(1).join(" ")); put(c, "contact.footerLeft", `© ${new Date().getFullYear()} ${f.name}`); say("name"); }
    if (about) { put(c, "hero.eyebrow", about + (f.city ? " · " + f.city : "")); say("role"); }
    if (f.tagline) put(c, "hero.role", f.tagline);
    if (f.story) { put(c, "about.story", f.story); say("your story"); }
    if (top) put(c, "hero.photo", top);
  }
  // The document's other sections (case studies, how you work, why you, team, questions…), where this kind of site shows them.
  { const secs: DocSections = { ...(text ? readSections(text) : {}), ...(rd.sections || {}) } as DocSections; if (items.length) delete secs.services;
    if (template === "business" || template === "restaurant" || template === "portfolio") { const before = JSON.stringify(c); applySections(template as any, c, secs, (...ids) => show(c, ...ids)); if (JSON.stringify(c) !== before) for (const n of sectionNames(secs)) say(n); } }
  // Contact details, where every kind of site keeps them.
  if (f.phone) { put(c, "contact.phone", f.phone); if (template !== "portfolio") put(c, "contact.whatsapp", digits(f.phone)); if (template === "store") put(c, "orders.whatsapp", digits(f.phone)); say("phone"); }
  if (f.email) { put(c, "contact.email", f.email); if (template === "store") put(c, "orders.email", f.email); say("email"); }
  if (f.address && template !== "portfolio") { put(c, "contact.address", f.address); say("address"); }
  if (social && template !== "store") { if (template === "restaurant" || template === "business" || template === "events") c.footer = { ...(c.footer || {}), links: [{ label: /instagram/.test(social) ? "Instagram" : "Find us online", url: social }, ...((c.footer?.links || []).filter((l: any) => l?.url !== social))] }; say("Instagram"); }
  return { content: c, did };
}
