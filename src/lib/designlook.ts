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
/** A palette the owner offers: a name and any of the colours above. */
export type ColourSet = { name: string; colours: Colours };

/** One layout choice in the owner's settings: the default it fills in, the options offered, or hidden. */
export type LookRule = { /** default option ("" = the theme's own) */ d?: string; /** options offered (empty = all) */ a?: string[]; /** not shown to visitors */ h?: boolean };
export type DesignSettings = {
  on?: boolean;
  /** Palettes offered on the Colours panel. */
  sets?: ColourSet[];
  /** Visitors may change each colour (default on). */
  pick?: boolean;
  /** Background colours offered, light to dark (the text colour follows). */
  backgrounds?: string[];
  /** Accent colours offered on the Colours panel (the theme's own is always there). */
  accents?: string[];
  /** Per type: the themes visitors are offered (none listed = all of them). */
  themes?: Partial<Record<Kind, string[]>>;
  /** Per type, per layout / style / interaction / intro choice. */
  look?: Partial<Record<Kind, Record<string, LookRule>>>;
};

export type Group = "Layout" | "Style" | "Interactions" | "Intro screen";
export const GROUPS: Group[] = ["Layout", "Style", "Interactions", "Intro screen"];
const AX = (a: Axis, forAnswer: string, group: Group = "Layout"): [Axis, string, Group] => [a, forAnswer, group];
const ST = (a: Axis, f: string) => AX(a, f, "Style");
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
    AX(BIZ_AXES.layout, "Your name and what you do"), AX(BIZ_AXES.heroArt, "Your logo and picture"), AX(BIZ_AXES.nav, "Pages and menu"), AX(NAV_MODE, "Pages and menu"), AX(BIZ_AXES.width, "Page width"), AX(BIZ_AXES.bands, "What you offer and highlights"),
    ST(BIZ_AXES.heading, "Your name and headings"), ST(BIZ_AXES.shead, "Section titles"), ST(BIZ_AXES.cards, "What you offer"), ST(BIZ_AXES.buttons, "What you want visitors to do"), ST(BIZ_AXES.pattern, "Feel"), ST(BIZ_AXES.motionStyle, "Feel"), ...FX(),
  ],
  restaurant: [
    AX(REST_AXES.layout, "Your name and what you serve"), AX(REST_AXES.heroArt, "Your logo and picture"), AX(REST_AXES.nav, "Pages and menu bar"), AX(NAV_MODE, "Pages and menu bar"), AX(REST_AXES.menuStyle, "Your food menu"), AX(REST_AXES.gallery, "Photos"), AX(REST_AXES.width, "Page width"), AX(REST_AXES.bands, "Sections"),
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
const clip = (s: any, n: number) => (typeof s === "string" ? s.trim().slice(0, n) : "");
export function cleanColours(x: any): Colours {
  const o: Colours = {}; if (!x || typeof x !== "object") return o;
  for (const k of Object.keys(x)) if (SLOT.has(k) && typeof x[k] === "string" && HEX.test(x[k])) o[k] = x[k].toLowerCase();
  return o;
}
export function cleanSets(x: any): ColourSet[] {
  return (Array.isArray(x) ? x : []).slice(0, 12).map((s) => ({ name: clip(s?.name, 30), colours: cleanColours(s?.colours) })).filter((s) => s.name && Object.keys(s.colours).length);
}
export const DEFAULT_BACKGROUNDS = ["#ffffff", "#f5f1e8", "#e6ebf2", "#3a4558", "#1c2230", "#0b0f17"];
export const cleanAccents = (x: any): string[] => (Array.isArray(x) ? x.filter((c) => typeof c === "string" && HEX.test(c)).map((c) => c.toLowerCase()).slice(0, 16) : []);
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
    const v = own[a.key] ?? rules[a.key]?.d ?? "";
    if (v && v !== "-" && a.options.some(([o]) => o === v)) out[a.key] = v;
  }
  return out;
}

/** Everything the visitor and the owner's defaults decide, as one answer to keep with a request (so it looks the same later). */
export const resolvedLook = (kind: Kind, answer: string | undefined, s: DesignSettings): string => JSON.stringify(lookValues(kind, answer, s));

/** The palettes offered: the owner's, or (when none) one made from the Studio's own colour. */
export function setsOf(s: DesignSettings, studioTint?: string): ColourSet[] {
  if (s.sets?.length) return s.sets;
  return studioTint && HEX.test(studioTint) ? [{ name: "Studio colour", colours: { c1: studioTint, c2: studioTint } }] : [];
}
