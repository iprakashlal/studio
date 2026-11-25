// "Design yourself": the looks a visitor can change (layout dropdowns and a colour palette) and how the Studio's owner
// sets them up in Settings → Design yourself. Everything the owner chooses is stored as little as possible: only what
// differs from the theme's own look is kept.
import { AXES, FX_AXES, HERO_FX_AXIS, KIT_AXIS, LOADER_ON_AXIS, MOTIF_AXIS, PORTFOLIO_AXES, STORE_AXES, type Axis } from "../themes/catalog";
import { BIZ_AXES } from "../themes/business";
import { REST_AXES } from "../themes/restaurant";

export type Kind = "portfolio" | "store" | "business" | "restaurant";
export const KINDS: Kind[] = ["business", "restaurant", "portfolio", "store"];

/** The colours of the Brand & theme → Colours editor, in its order. */
export const COLOUR_SLOTS: [string, string][] = [["bg", "Background"], ["surface", "Cards"], ["text", "Text"], ["soft", "Secondary text"], ["line", "Borders"], ["deep", "Dark panels & footer"], ["c1", "Primary (buttons, links)"], ["c2", "Secondary"], ["c3", "Highlight"]];
export type Colours = Record<string, string>;

/** One layout choice in the owner's settings: the default it fills in, the options offered, or hidden. */
export type LookRule = { /** default option ("" = the theme's own) */ d?: string; /** options offered (empty = all) */ a?: string[]; /** not shown to visitors */ h?: boolean };
export type Gallery = {
  /** Its own web address: it opens straight on the gallery. */
  domain?: string;
  /** The text of the Studio's link to it (default "Themes"). */
  link?: string;
  /** The count line: "found" = "12 of 48 themes" (default), "total" = "48 themes", "off" = none. */
  count?: "found" | "total" | "off";
  /** The types of site shown (none listed = all four). */
  types?: Kind[];
  /** Show the tag filters (default on). */
  tags?: boolean;
  /** The page's heading and the line under it (default text when empty). */
  title?: string; intro?: string;
};
export const NOTICE_TEXT = "Please note that this is just a preview to help you select a theme. Both the theme and the actual development can be customized to fit your specific requirements.";
export type DesignSettings = {
  on?: boolean;
  /** Visitors may change each colour (default on). */
  pick?: boolean;
  /** Which AI reads a visitor's document or link and writes their text: "" = the engine chosen in Settings → General. */
  ai?: "cloudflare" | "system" | "custom";
  /** The page's own web address (a domain connected in Settings → Design yourself): it opens straight on Design yourself. */
  domain?: string;
  /** The public theme gallery (Settings → Themes): its own address, the Studio's link to it, what it shows and says. */
  gallery?: Gallery;
  /** Per type: the themes visitors are offered (none listed = all of them). */
  themes?: Partial<Record<Kind, string[]>>;
  /** Per type: what the carousel on a visitor's finished preview shows: "answers" (default) = the themes that match what they said (business type, genre); "custom" = the themes the owner ticked above. */
  carousel?: Partial<Record<Kind, "answers" | "custom">>;
  /** Visitors can describe a logo or banner and the free AI Horde draws it (style is added to the words). */
  images?: { on?: boolean; style?: "photo" | "illustration" | "3d" | "flat"; /** Who draws: the free AI Horde (default) or the Studio's own AI engine (Cloudflare's, when that is the engine selected). */ source?: "horde" | "engine" };
  /** How the Design yourself chat looks: bubble colours, page colour, and a background picture (dimmed by `dim` %). */
  chat?: { you?: string; bot?: string; page?: string; image?: string; dim?: number };
  /** false: the site editor has no "Draw with AI" button (on unless turned off). */
  adminAi?: boolean;
  /** The yellow notice bar at the top of "Design yourself": hidden when on === false, own words in text. */
  notice?: { on?: boolean; text?: string };
  /** The questions Design yourself asks: per group ("basics" or a type), per question: hidden (h), own wording (t), own help line (p). */
  questions?: Record<string, Record<string, { h?: boolean; t?: string; p?: string }>>;
  /** Per type, per layout / style / interaction / intro choice. */
  look?: Partial<Record<Kind, Record<string, LookRule>>>;
};

export type Group = "Layout" | "Style" | "Interactions" | "Intro screen";
export const GROUPS: Group[] = ["Layout", "Style", "Interactions", "Intro screen"];
const AX = (a: Axis, forAnswer: string, group: Group = "Layout"): [Axis, string, Group] => [a, forAnswer, group];
const ST = (a: Axis, f: string) => AX(a, f, "Style");
/** One long page or separate pages (business and restaurant sites). Not a theme value: it sets the site's page mode. */
export const PAGES_AXIS: Axis = { key: "pages", label: "Site pages", options: [["single", "One page (everything scrolls)"], ["multi", "Separate pages (Home, About, Contact…)"]] };
const NAV_MODE: Axis = { key: "navMode", label: "Menu when scrolling", options: [["fixed", "Always visible (fixed at the top)"], ["hide", "Hide on scroll down, show on scroll up"], ["scroll", "Scrolls away with the page"]] };
const INTRO_FONT: Axis = { key: "introFont", label: "Intro font", options: [["display", "Same as the headline (headings font)"], ["body", "Body text font"]] };
const INTRO_CASE: Axis = { key: "introCase", label: "Intro letters", options: [["upper", "CAPITALS"], ["asis", "As typed"]] };
/** Interactions and the intro screen, as in the site admin's Theme & layout (every type has them). */
const FX = (): [Axis, string, Group][] => [
  ...(["cursor", "loader", "textfx", "hoverfx", "scrollfx", "overlay"] as const).map((k) => AX(FX_AXES[k], "Feel", "Interactions")),
  AX(LOADER_ON_AXIS, "Feel", "Interactions"), AX(HERO_FX_AXIS, "Your logo and picture", "Interactions"),
  AX(INTRO_FONT, "Your name", "Intro screen"), AX(INTRO_CASE, "Your name", "Intro screen"),
];
/** The choices of each type, the answer each one shapes, and the group it belongs to (the cards of Theme & layout). */
export const LOOK_AXES: Record<Kind, [Axis, string, Group][]> = {
  business: [
    AX(PAGES_AXIS, "One page or separate pages"), AX(BIZ_AXES.layout, "Your name and what you do"), AX(BIZ_AXES.heroArt, "Your logo and picture"), AX(BIZ_AXES.nav, "Pages and menu"), AX(NAV_MODE, "Pages and menu"), AX(BIZ_AXES.width, "Page width"), AX(BIZ_AXES.bands, "What you offer and highlights"),
    ST(BIZ_AXES.heading, "Your name and headings"), ST(BIZ_AXES.shead, "Section titles"), ST(BIZ_AXES.cards, "What you offer"), ST(BIZ_AXES.buttons, "What you want visitors to do"), ST(BIZ_AXES.pattern, "Feel"), ST(BIZ_AXES.motionStyle, "Feel"), ...FX(),
  ],
  restaurant: [
    AX(PAGES_AXIS, "One page or separate pages"), AX(REST_AXES.layout, "Your name and what you serve"), AX(REST_AXES.heroArt, "Your logo and picture"), AX(REST_AXES.nav, "Pages and menu bar"), AX(NAV_MODE, "Pages and menu bar"), AX(REST_AXES.menuStyle, "Your food menu"), AX(REST_AXES.gallery, "Photos"), AX(REST_AXES.width, "Page width"), AX(REST_AXES.bands, "Sections"),
    ST(REST_AXES.heading, "Your name and headings"), ST(REST_AXES.shead, "Section titles"), ST(REST_AXES.cards, "Highlights"), ST(REST_AXES.buttons, "What you want visitors to do"), ST(REST_AXES.ornament, "Feel"), ST(REST_AXES.divider, "Feel"), ST(REST_AXES.pattern, "Feel"), ST(REST_AXES.motionStyle, "Feel"), ST(MOTIF_AXIS, "Feel"), ...FX(),
  ],
  portfolio: [
    AX({ ...AXES.layout, options: [...AXES.layout.options, ["velocity", "★ Velocity: signature layout"]] }, "Your name and what you do"), AX(KIT_AXIS, "Page layout"), AX(AXES.nav, "Pages and menu"), AX(NAV_MODE, "Pages and menu"), AX(AXES.width, "Page width"),
    AX(PORTFOLIO_AXES.about, "Your story"), AX(PORTFOLIO_AXES.skills, "What you do (offerings)"), AX(PORTFOLIO_AXES.work, "Your work"),
    ST(AXES.heading, "Your name and headings"), ST(AXES.shead, "Section titles"), ST(AXES.cards, "Highlights"), ST(AXES.buttons, "What you want visitors to do"), ST(AXES.motionStyle, "Feel"), ST(AXES.pattern, "Feel"), ST(AXES.ornament, "Feel"), ST(MOTIF_AXIS, "Feel"), ...FX(),
  ],
  store: [
    AX(AXES.layout, "Your name and what you sell"), AX(STORE_AXES.grid, "Your products"), AX(STORE_AXES.product, "Your products"), AX(AXES.nav, "Pages and menu"), AX(NAV_MODE, "Pages and menu"), AX(AXES.width, "Page width"),
    ST(AXES.heading, "Your name and headings"), ST(AXES.shead, "Section titles"), ST(AXES.cards, "Highlights"), ST(AXES.buttons, "What you want visitors to do"), ST(AXES.motionStyle, "Feel"), ST(AXES.pattern, "Feel"), ST(AXES.ornament, "Feel"), ST(MOTIF_AXIS, "Feel"), ...FX(),
  ],
};

const HEX = /^#[0-9a-f]{6}$/i;
const SLOT = new Set(COLOUR_SLOTS.map(([k]) => k));
export function cleanColours(x: any): Colours {
  const o: Colours = {}; if (!x || typeof x !== "object") return o;
  for (const k of Object.keys(x)) if (SLOT.has(k) && typeof x[k] === "string" && HEX.test(x[k])) o[k] = x[k].toLowerCase();
  return o;
}
export const cleanDomain = (v: unknown): string | undefined => (typeof v === "string" && /^(?=.{4,100}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(v.trim().toLowerCase()) ? v.trim().toLowerCase() : undefined);
export function cleanGallery(x: any): Gallery | undefined {
  if (!x || typeof x !== "object") return undefined;
  const o: Gallery = {}, t = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/[<>]/g, "").trim().slice(0, n) : "");
  const dm = cleanDomain(x.domain); if (dm) o.domain = dm;
  if (t(x.link, 24)) o.link = t(x.link, 24);
  if (x.count === "total" || x.count === "off") o.count = x.count;
  if (Array.isArray(x.types)) { const l = KINDS.filter((k) => x.types.includes(k)); if (l.length && l.length < KINDS.length) o.types = l; }
  if (x.tags === false) o.tags = false;
  if (t(x.title, 80)) o.title = t(x.title, 80);
  if (t(x.intro, 400)) o.intro = t(x.intro, 400);
  return Object.keys(o).length ? o : undefined;
}
export const cleanAi = (v: unknown): DesignSettings["ai"] => (v === "cloudflare" || v === "system" || v === "custom" ? v : undefined);
export function cleanThemes(x: any): NonNullable<DesignSettings["themes"]> {
  const o: NonNullable<DesignSettings["themes"]> = {}; if (!x || typeof x !== "object") return o;
  for (const k of KINDS) if (Array.isArray(x[k])) { const l = x[k].filter((v: any) => typeof v === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(v)).slice(0, 400); if (l.length) o[k] = l; }
  return o;
}
export function cleanLook(x: any): NonNullable<DesignSettings["look"]> {
  const out: NonNullable<DesignSettings["look"]> = {}; if (!x || typeof x !== "object") return out;
  for (const k of KINDS) {
    const src = x[k]; if (!src || typeof src !== "object") continue;
    const known = new Map(LOOK_AXES[k].map(([a]) => [a.key, a] as const));
    const rules: Record<string, LookRule> = {};
    for (const key of Object.keys(src)) {
      const ax = known.get(key), r = src[key]; if (!ax || !r || typeof r !== "object") continue;
      const vals = new Set(ax.options.map(([v]) => v)), o: LookRule = {};
      if (typeof r.d === "string" && vals.has(r.d)) o.d = r.d;
      if (Array.isArray(r.a)) { const a = r.a.filter((v: any) => typeof v === "string" && vals.has(v)); if (a.length && a.length < vals.size) o.a = a; }
      if (r.h === true) o.h = true;
      if (Object.keys(o).length) rules[key] = o;
    }
    if (Object.keys(rules).length) out[k] = rules;
  }
  return out;
}

/** What a visitor has chosen so far, kept in the answers as one small text: option per layout choice ("-" = the theme's own). */
export const readLookAnswer = (s: string | undefined): Record<string, string> => {
  try { const o = JSON.parse(s || "{}"); return Object.fromEntries(Object.entries(o).filter(([k, v]) => /^[A-Za-z]{1,20}$/.test(k) && typeof v === "string").map(([k, v]) => [k, (v as string).slice(0, 30)])); } catch { return {}; }
};
export const readColsAnswer = (s: string | undefined): Colours => { try { return cleanColours(JSON.parse(s || "{}")); } catch { return {}; } };

/** The layout choices a visitor is offered for a type (hidden ones left out, options narrowed to what the owner allows). */
export function visibleAxes(kind: Kind, s: DesignSettings): { axis: Axis; forAnswer: string; group: Group; def: string }[] {
  const rules = s.look?.[kind] || {};
  return (LOOK_AXES[kind] || []).filter(([a]) => !rules[a.key]?.h).map(([a, forAnswer, group]) => {
    const allow = rules[a.key]?.a;
    return { axis: allow ? { ...a, options: a.options.filter(([v]) => allow.includes(v)) } : a, forAnswer, group, def: rules[a.key]?.d || "" };
  });
}

/** The theme values to lay over a theme: the owner's defaults, then the visitor's own picks ("-" = the theme's own). */
export function lookValues(kind: Kind, answer: string | undefined, s: DesignSettings): Record<string, string> {
  const own = readLookAnswer(answer), out: Record<string, string> = {}, rules = s.look?.[kind] || {};
  for (const [a] of LOOK_AXES[kind] || []) {
    if (a.key === "pages") continue;
    const v = own[a.key] ?? rules[a.key]?.d ?? "";
    if (v && v !== "-" && a.options.some(([o]) => o === v)) out[a.key] = v;
  }
  return out;
}

/** Everything the visitor and the owner's defaults decide, as one answer to keep with a request (so it looks the same later). */
export const resolvedLook = (kind: Kind, answer: string | undefined, s: DesignSettings): string => JSON.stringify(lookValues(kind, answer, s));


/** One page or separate pages: what the visitor chose, else the owner's starting choice, else one page. */
export const pagesChoice = (kind: Kind, own: string | undefined, s: DesignSettings): "single" | "multi" => {
  const r = s.look?.[kind]?.pages, ok = (v?: string) => (v === "single" || v === "multi") && (!r?.a?.length || r.a.includes(v));
  return ok(own) ? (own as "single" | "multi") : ok(r?.d) ? (r!.d as "single" | "multi") : r?.a?.length === 1 && ok(r.a[0]) ? (r.a[0] as "single" | "multi") : "single";
};
