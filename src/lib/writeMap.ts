// Puts newly written text (a Brief from the database's writer) into a project's content, per template. Only text
// sections: testimonials, numbers, team, clients, prices and products are left for the owner to fill in truthfully.
import type { Brief } from "./cfdb";

export type WriteGroup = { id: string; label: string; preview: string[] };
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const okList = <T,>(v: unknown, f: (x: any) => T | null) => (Array.isArray(v) ? v.map(f).filter((x): x is T => !!x) : []);

/** The brief without the fields the copy check flagged (paths like "services.2.text"). */
export function dropFlagged(b: Brief, flagged: string[]): Brief {
  const c: any = JSON.parse(JSON.stringify(b || {}));
  for (const p of flagged) {
    const ks = p.split("."); let o = c;
    for (let i = 0; i < ks.length - 1 && o; i++) o = o[ks[i]];
    if (o && ks.length) { const last = ks[ks.length - 1]; if (Array.isArray(o)) o[+last] = null; else delete o[last]; }
  }
  for (const k of Object.keys(c)) if (Array.isArray(c[k])) c[k] = c[k].filter((x: any) => x && typeof x === "object");
  return c;
}

/** What each group would change, for the review list. */
export function groupsOf(kind: string, b: Brief): WriteGroup[] {
  const svc = okList(b.services, (x) => (str(x?.title) ? `${str(x.title)}: ${str(x.text)}` : null));
  const g: WriteGroup[] = [
    { id: "hero", label: "First screen (hero)", preview: [b.hero_eyebrow, b.hero_title, b.hero_text, b.hero_cta].map(str).filter(Boolean) },
    { id: "about", label: kind === "store" ? "Our story" : "About", preview: [b.about_title, b.about_text, b.mission, b.vision].map(str).filter(Boolean) },
    { id: "services", label: kind === "portfolio" ? "Skills" : kind === "store" ? "Shop intro" : "Services", preview: kind === "store" ? [str(b.services_intro)].filter(Boolean) : [str(b.services_title), ...svc].filter(Boolean) },
  ];
  if (kind === "business") g.push(
    { id: "values", label: "Values", preview: okList(b.values, (x) => (str(x?.title) ? `${str(x.title)}: ${str(x.text)}` : null)) },
    { id: "process", label: "How we work", preview: okList(b.process, (x) => (str(x?.title) ? `${str(x.title)}: ${str(x.text)}` : null)) },
    { id: "faq", label: "FAQ", preview: okList(b.faq, (x) => (str(x?.q) ? `${str(x.q)} ${str(x.a)}` : null)) },
  );
  if (kind === "store") g.push({ id: "banner", label: "Home banner", preview: [b.banner_title, b.banner_text].map(str).filter(Boolean) });
  g.push(
    { id: "cta", label: kind === "portfolio" ? "Contact" : "Call to action", preview: [b.cta_title, b.cta_text].map(str).filter(Boolean) },
    { id: "seo", label: "Tagline, search listing and footer", preview: [b.brand_tagline, b.seo_title, b.seo_description, b.footer_text].map(str).filter(Boolean) },
  );
  return g.filter((x) => x.preview.length);
}

const set = (o: any, path: string, v: unknown) => { if (v === "" || v == null) return; const ks = path.split("."); let x = o; for (const k of ks.slice(0, -1)) x = x[k] ||= {}; x[ks[ks.length - 1]] = v; };
/** Replaces the old brand name everywhere in the content's text. */
function rename(o: any, from: string, to: string): any {
  if (!from || !to || from === to) return o;
  const re = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
  const walk = (v: any): any => typeof v === "string" ? v.replace(re, to) : Array.isArray(v) ? v.map(walk) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === "image" || k === "logo" || k === "photo" ? x : walk(x)])) : v;
  return walk(o);
}

/** The new content: `draft` with the chosen groups written in and the brand name set. */
export function applyBrief(kind: string, draft: any, b: Brief, brand: string, groups: Set<string>): any {
  const c = JSON.parse(JSON.stringify(draft));
  const oldBrand = kind === "portfolio" ? str(c.brand?.logoText) : str(c.brand?.name);
  const on = (g: string) => groups.has(g);
  const pairs = (v: unknown) => okList(v, (x) => (str(x?.title) ? { title: str(x.title), text: str(x.text) } : null));
  if (kind === "business") {
    if (on("hero")) { set(c, "hero.eyebrow", str(b.hero_eyebrow)); set(c, "hero.title", str(b.hero_title)); set(c, "hero.lede", str(b.hero_text)); set(c, "hero.ctaPrimary", str(b.hero_cta)); }
    if (on("services")) {
      set(c, "services.title", str(b.services_title)); set(c, "services.lede", str(b.services_intro));
      const it = pairs(b.services); const old = c.services?.items || [];
      if (it.length) c.services.items = it.slice(0, 8).map((x, i) => ({ ...(old[i] || old[0] || {}), title: x.title, body: x.text, points: [] }));
    }
    if (on("about")) { set(c, "about.title", str(b.about_title)); set(c, "about.body", str(b.about_text)); set(c, "about.mission", str(b.mission)); set(c, "about.vision", str(b.vision)); }
    if (on("values")) { const v = pairs(b.values); if (v.length) set(c, "about.values", v.slice(0, 6).map((x) => ({ title: x.title, body: x.text }))); }
    if (on("process")) { const v = pairs(b.process); if (v.length) set(c, "process.steps", v.slice(0, 6).map((x) => ({ title: x.title, body: x.text }))); }
    if (on("faq")) { const v = okList(b.faq, (x) => (str(x?.q) && str(x?.a) ? { q: str(x.q), a: str(x.a) } : null)); if (v.length) set(c, "faq.items", v.slice(0, 8)); }
    if (on("cta")) { set(c, "cta.title", str(b.cta_title)); set(c, "cta.body", str(b.cta_text)); }
    if (on("seo")) { set(c, "brand.tagline", str(b.brand_tagline)); set(c, "seo.title", str(b.seo_title)); set(c, "seo.description", str(b.seo_description)); set(c, "footer.text", str(b.footer_text)); }
    const r = rename(c, oldBrand, brand); r.brand = { ...(r.brand || {}), name: brand }; return r;
  }
  if (kind === "store") {
    if (on("hero")) { set(c, "home.hero.eyebrow", str(b.hero_eyebrow)); set(c, "home.hero.title", str(b.hero_title)); set(c, "home.hero.text", str(b.hero_text)); set(c, "home.hero.cta", str(b.hero_cta)); }
    if (on("banner")) { set(c, "home.banner.title", str(b.banner_title)); set(c, "home.banner.text", str(b.banner_text)); }
    if (on("about")) {
      set(c, "portfolio.title", str(b.about_title)); set(c, "portfolio.intro", str(b.about_text));
      const steps = pairs(b.process); if (steps.length) set(c, "portfolio.story", steps.map((x) => `${x.title}. ${x.text}`).join("\n\n"));
    }
    if (on("services")) set(c, "shop.intro", str(b.services_intro));
    if (on("cta")) { set(c, "portfolio.ctaTitle", str(b.cta_title)); set(c, "portfolio.ctaText", str(b.cta_text)); }
    if (on("seo")) { set(c, "brand.tagline", str(b.brand_tagline)); set(c, "seo.title", str(b.seo_title)); set(c, "seo.description", str(b.seo_description)); set(c, "footer.text", str(b.footer_text)); }
    const r = rename(c, oldBrand, brand); r.brand = { ...(r.brand || {}), name: brand }; return r;
  }
  // portfolio (a person)
  if (on("hero")) { set(c, "hero.eyebrow", str(b.hero_eyebrow)); set(c, "hero.role", str(b.hero_text)); }
  if (on("about")) { set(c, "about.title", str(b.about_title)); set(c, "about.story", str(b.about_text)); }
  if (on("services")) {
    set(c, "skills.title", str(b.services_title)); set(c, "skills.lede", str(b.services_intro));
    const it = pairs(b.services); const old = c.skills?.items || [];
    if (it.length) c.skills.items = it.slice(0, 6).map((x, i) => ({ ...(old[i] || old[0] || {}), title: x.title, body: x.text, detail: "" }));
  }
  if (on("cta")) { set(c, "contact.title", str(b.cta_title)); set(c, "contact.body", str(b.cta_text)); }
  if (on("seo")) { set(c, "about.lede", str(b.brand_tagline)); set(c, "seo.title", str(b.seo_title)); set(c, "seo.description", str(b.seo_description)); }
  const r = rename(c, oldBrand, brand); r.brand = { ...(r.brand || {}), logoText: brand }; return r;
}
