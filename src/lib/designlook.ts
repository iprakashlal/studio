// "Design yourself": the looks a visitor can change (layout dropdowns and a colour palette) and how the Studio's owner
// sets them up in Settings → Design yourself. Everything the owner chooses is stored as little as possible: only what
// differs from the theme's own look is kept.
import { AXES, KIT_AXIS, PORTFOLIO_AXES, STORE_AXES, type Axis } from "../themes/catalog";
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
  /** Per type, per layout choice. */
  look?: Partial<Record<Kind, Record<string, LookRule>>>;
};

const AX = (a: Axis, forAnswer: string): [Axis, string] => [a, forAnswer];
/** The layout choices of each type, and the answer each one shapes. */
export const LOOK_AXES: Record<Kind, [Axis, string][]> = {
  business: [
    AX(BIZ_AXES.layout, "Your name and what you do"), AX(BIZ_AXES.heroArt, "Your logo and picture"), AX(BIZ_AXES.nav, "Pages and menu"), AX(BIZ_AXES.width, "Page width"),
    AX(BIZ_AXES.bands, "What you offer and highlights"), AX(BIZ_AXES.cards, "What you offer"), AX(BIZ_AXES.heading, "Your name and headings"), AX(BIZ_AXES.shead, "Section titles"),
    AX(BIZ_AXES.buttons, "What you want visitors to do"), AX(BIZ_AXES.pattern, "Feel"), AX(BIZ_AXES.motionStyle, "Feel"),
  ],
  restaurant: [
    AX(REST_AXES.layout, "Your name and what you serve"), AX(REST_AXES.heroArt, "Your logo and picture"), AX(REST_AXES.nav, "Pages and menu bar"), AX(REST_AXES.menuStyle, "Your food menu"),
    AX(REST_AXES.gallery, "Photos"), AX(REST_AXES.cards, "Highlights"), AX(REST_AXES.buttons, "What you want visitors to do"), AX(REST_AXES.heading, "Your name and headings"),
    AX(REST_AXES.shead, "Section titles"), AX(REST_AXES.ornament, "Feel"), AX(REST_AXES.divider, "Feel"), AX(REST_AXES.pattern, "Feel"), AX(REST_AXES.bands, "Sections"), AX(REST_AXES.width, "Page width"),
  ],
  portfolio: [
    AX({ ...AXES.layout, options: [...AXES.layout.options, ["velocity", "★ Velocity: signature layout"]] }, "Your name and what you do"), AX(KIT_AXIS, "Page layout"), AX(AXES.heroArt, "Your logo and picture"), AX(AXES.nav, "Pages and menu"),
    AX(PORTFOLIO_AXES.about, "Your story"), AX(PORTFOLIO_AXES.skills, "What you do (offerings)"), AX(PORTFOLIO_AXES.work, "Your work"), AX(AXES.cards, "Highlights"),
    AX(AXES.buttons, "What you want visitors to do"), AX(AXES.heading, "Your name and headings"), AX(AXES.shead, "Section titles"), AX(AXES.motionStyle, "Feel"), AX(AXES.pattern, "Feel"), AX(AXES.ornament, "Feel"), AX(AXES.width, "Page width"),
  ],
  store: [
    AX(AXES.layout, "Your name and what you sell"), AX(STORE_AXES.grid, "Your products"), AX(STORE_AXES.product, "Your products"), AX(AXES.heroArt, "Your logo and picture"), AX(AXES.nav, "Pages and menu"),
    AX(AXES.cards, "Highlights"), AX(AXES.buttons, "What you want visitors to do"), AX(AXES.heading, "Your name and headings"), AX(AXES.shead, "Section titles"), AX(AXES.motionStyle, "Feel"), AX(AXES.pattern, "Feel"), AX(AXES.width, "Page width"),
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
export function cleanLook(x: any): NonNullable<DesignSettings["look"]> {
  const out: NonNullable<DesignSettings["look"]> = {}; if (!x || typeof x !== "object") return out;
  for (const k of KINDS) {
    const src = x[k]; if (!src || typeof src !== "object") continue;
    const known = new Map(LOOK_AXES[k].map(([a]) => [a.key, a]));
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
export function visibleAxes(kind: Kind, s: DesignSettings): { axis: Axis; forAnswer: string; def: string }[] {
  const rules = s.look?.[kind] || {};
  return (LOOK_AXES[kind] || []).filter(([a]) => !rules[a.key]?.h).map(([a, forAnswer]) => {
    const allow = rules[a.key]?.a;
    return { axis: allow ? { ...a, options: a.options.filter(([v]) => allow.includes(v)) } : a, forAnswer, def: rules[a.key]?.d || "" };
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
