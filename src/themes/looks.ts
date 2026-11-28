// Page styles (content.theme.look, drawn by assets/looks.js): Neumorphism and Spatial UI, over any theme of the business,
// events, restaurant and shop templates. The portfolio has them as whole page layouts instead (assets/layouts.js).
// Also: the ready-made Neumorphism and Spatial UI themes each catalogue adds, one pair per kind of business / event /
// restaurant, built from that kind's own theme so the accent colours and fonts still suit it.
import type { Axis, Theme } from "./catalog";

export const LOOK_AXIS: Axis = {
  key: "look", label: "Page style",
  hint: "A whole-page look over the theme. Neumorphism presses everything out of one soft surface; Spatial UI floats each section as a glass window in a lit room, and the hero window turns toward the pointer.",
  options: [["classic", "Classic"], ["neu", "Neumorphism"], ["spatial", "Spatial UI"]],
};
export const LOOK_TAGS = ["Neumorphism", "Spatial UI"];
export const lookOk = (v: unknown) => (v === "neu" || v === "spatial" ? v : "classic");
export const lookName = (l: string) => (l === "neu" ? "Neumorphism" : "Spatial UI");

const hex = (h: string) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
/** a mixed with b: t of b. */
const mix = (a: string, b: string, t: number) => "#" + hex(a).map((x, i) => Math.round(x + (hex(b)[i] - x) * t).toString(16).padStart(2, "0")).join("").toUpperCase();
const lum = (h: string) => { const [r, g, b] = hex(h).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
/** An accent dark or light enough to read on bg (pushed toward black or white until it does). */
const readable = (c: string, bg: string) => {
  const ratio = (a: string, b: string) => { const x = lum(a) + 0.05, y = lum(b) + 0.05; return x > y ? x / y : y / x; };
  const to = lum(bg) > 0.4 ? "#000000" : "#FFFFFF";
  let out = c; for (let t = 0.1; ratio(out, bg) < 3.2 && t <= 0.8; t += 0.1) out = mix(c, to, t);
  return out;
};

/** The colours of a page style, tinted by the base theme's accent. Neumorphism needs one surface (bg = surface). */
export function lookColors(look: "neu" | "spatial", c: Theme["colors"], dark: boolean): Theme["colors"] {
  const a = c.c1;
  if (look === "neu") {
    const bg = dark ? mix("#272C35", a, 0.05) : mix("#E4E8EE", a, 0.03);
    return { bg, surface: bg, deep: dark ? mix("#14171D", a, 0.08) : mix("#2A3242", a, 0.12), text: dark ? "#E7EAF0" : "#2B3242", soft: dark ? "#A2A9B7" : "#687083", line: mix(bg, dark ? "#FFFFFF" : "#000000", 0.08), c1: readable(a, bg), c2: readable(c.c2, bg), c3: c.c3 };
  }
  const bg = dark ? mix("#090D1A", a, 0.1) : mix("#EDF0F7", a, 0.07);
  return { bg, surface: dark ? mix("#1C2337", a, 0.1) : "#FFFFFF", deep: dark ? "#04060C" : mix("#141A2E", a, 0.1), text: dark ? "#F3F5FB" : "#131A2C", soft: dark ? "#AAB2C8" : "#59627A", line: dark ? mix("#2A3352", a, 0.1) : "#D8DDEA", c1: readable(a, bg), c2: readable(c.c2, bg), c3: c.c3 };
}

/** The fixed parts of each page style's own layout: the hero, menu, cards and buttons it is built around. */
export const LOOK_BUILD = {
  neu: { layout: "split", heroArt: "default", nav: "bar", cards: "elevated", buttons: "pill", shead: "center", pattern: "none", width: "normal", bands: "none", radius: 24, fx: ["none", "fade", "none", "lift", "none", "none"] },
  spatial: { layout: "center", heroArt: "default", nav: "float", cards: "glass", buttons: "pill", shead: "label", pattern: "none", width: "wide", bands: "none", radius: 28, fx: ["spotlight", "fade", "words", "tilt", "reveal", "none"] },
} as const;

/** A Neumorphism or Spatial UI theme built on base: base's accent colours, fonts and extras, the page style's layout. */
export function lookTheme<T extends Theme>(base: T, look: "neu" | "spatial", id: string, name: string, tags: string[], dark = base.dark): T & { look: string } {
  const b = LOOK_BUILD[look], colors = lookColors(look, base.colors, dark);
  const t = base as any;
  return {
    ...base, id, name, tags: [...new Set([...tags, lookName(look), "Modern", dark ? "Dark" : "Light"])], dark, look, signature: undefined,
    blurb: look === "neu" ? `${name.split(" · ")[0]}: soft raised panels pressed out of one surface, a capsule menu and round stat dials.` : `${name.split(" · ")[0]}: glass windows floating in a lit room, a hero that turns toward the pointer.`,
    colors, radius: b.radius,
    style: { ...base.style, layout: b.layout, heroArt: b.heroArt, nav: b.nav, cards: b.cards, buttons: b.buttons, shead: b.shead, pattern: b.pattern, width: b.width, motionStyle: "rise" },
    fx: { cursor: b.fx[0], loader: b.fx[1], textfx: b.fx[2], hoverfx: b.fx[3], scrollfx: b.fx[4], overlay: b.fx[5] },
    ...(t.biz ? { biz: { ...t.biz, bands: b.bands } } : {}),
    ...(t.rest ? { rest: { ...t.rest, bands: b.bands } } : {}),
  } as T & { look: string };
}
