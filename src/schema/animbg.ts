// Moving backgrounds and patterns (drawn by fx.js): their names, and the Theme & layout settings.
import type { Field } from "./types";

/** The moving backgrounds drawn by the site's own script (fx.js), with no library. */
export const ANIM_BGS: [string, string][] = [["motion", "Motion graphic (drifting shapes)"], ["sand", "Sand shimmer"], ["dunes", "Sand dunes shimmer"], ["sandlogo", "Sand logo (PA mark forms and scatters)"], ["synth", "Synthwave horizon"], ["liquid", "Liquid"], ["terrain", "Terrain"], ["aurora", "Aurora ribbons"], ["stars", "Stars and links"], ["flow", "Flow field (follows the pointer)"], ["silk", "Silk waves"], ["bubbles", "Rising bubbles"], ["rain", "Digital rain"], ["fireflies", "Fireflies"], ["ripple", "Ripples on water"], ["petals", "Falling petals"], ["hex", "Honeycomb pulse"], ["orbit", "Orbits"], ["warp", "Warp speed"]];
/** The still patterns a section can take, in the theme's colour. */
export const BG_PATTERNS: [string, string][] = [["dots", "Dots"], ["grid", "Fine grid"], ["lines", "Horizontal lines"], ["columns", "Column lines"], ["diagonal", "Diagonal stripes"], ["cross", "Crosses"], ["waves", "Waves"], ["rings", "Rings"], ["topo", "Contour lines"], ["gingham", "Gingham check"], ["stripes", "Awning stripes"], ["mesh", "Colour mesh glow"], ["grain", "Paper grain"]];
export const ANIM_SPEEDS = [{ value: "slow", label: "Slow" }, { value: "", label: "Calm" }, { value: "lively", label: "Lively" }];
/** Theme & layout → Style: a moving background for the hero or the whole page (content.theme.animBg…). */
export const ANIM_BG_FIELDS: Field[] = [
  { t: "select", path: "theme.animBg", label: "Animated background", options: [{ value: "", label: "None" }, ...ANIM_BGS.map(([value, label]) => ({ value, label }))] },
  { t: "when", path: "theme.animBg", not: "", fields: [
    { t: "grid", cols: 2, fields: [{ t: "select", path: "theme.animBgWhere", label: "Where it shows", options: [{ value: "", label: "In the hero (top of the home page)" }, { value: "page", label: "Behind the whole page" }] }, { t: "select", path: "theme.animBgSpeed", label: "Speed", options: ANIM_SPEEDS }] },
    { t: "range", path: "theme.animBgStrength", label: "Strength", min: 20, max: 100, step: 5, unit: "%" },
    { t: "note", text: "Drawn by the site itself in your theme's colours, with nothing loaded from elsewhere. Several answer to the pointer (flow field, silk, fireflies, ripples, honeycomb, warp speed). It pauses when it is out of sight and stays still for visitors who ask their device for less motion. “Behind the whole page” shows through sections that have no colour of their own; coloured bands cover it. Any section can also have its own under “Background & text”." },
  ] },
];
