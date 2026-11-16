// "Theme from a reference": turns an image, a PDF, an HTML file or a link into a theme for any template. The
// reference is only measured (its colours, fonts, corner size, first-screen layout and interaction libraries); its
// text, pictures and logo are not copied. The nearest theme in the Studio gives the parts a reference can't tell
// (card style, section layouts, patterns), and the measured parts are laid over it.
import type { TemplateDef } from "../schema/types";
import { AXES, BODY_FONTS, DISPLAY_FONTS, FX_KEYS, THEMES, type Fx, type Theme } from "../themes/catalog";
import { digestPage, type Digest } from "./lookdigest";

export type Look = {
  source: "image" | "pdf" | "page";
  bg: string; text: string; accents: string[];
  /** Fonts named by the reference (a page), or its style when only that can be told. */
  headFont?: string; bodyFont?: string; fontKind?: "serif" | "sans" | "mono";
  radius?: number;
  hero?: "split" | "reverse" | "center" | "minimal" | "stacked";
  libs: string[]; uppercase?: boolean;
};
export type Made = { base: Theme; theme: Theme; values: Record<string, unknown>; notes: string[] };

// ---------------------------------------------------------------- colour maths
type RGB = [number, number, number];
const rgb = (h: string): RGB => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const hex = ([r, g, b]: RGB) => "#" + [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0")).join("").toUpperCase();
const lum = (c: RGB) => { const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const contrast = (a: RGB, b: RGB) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const dist = (a: RGB, b: RGB) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
function hsl(c: RGB): [number, number, number] {
  const r = c[0] / 255, g = c[1] / 255, b = c[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1)), h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function fromHsl(h: number, s: number, l: number): RGB {
  h = ((h % 360) + 360) % 360; const k = (n: number) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}
const hueGap = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
/** Lightens or darkens a colour until it reads against the background. */
function readable(c: RGB, bg: RGB, min: number): RGB {
  let [h, s, l] = hsl(c); const up = lum(bg) < 0.4;
  for (let i = 0; i < 24 && contrast(fromHsl(h, s, l), bg) < min; i++) l = Math.max(0.04, Math.min(0.96, l + (up ? 0.035 : -0.035)));
  return fromHsl(h, s, l);
}

/** Up to three accent colours: the colourful colours grouped by hue (so a gradient or a photo doesn't outvote a
 *  small, strong button colour), each group weighed by how much there is of it and how saturated it is. */
function pickAccents(list: { c: RGB; n: number }[]): RGB[] {
  const bins = new Map<number, { score: number; best: RGB; top: number }>();
  for (const x of list) {
    const [h, s, l] = hsl(x.c); if (s < 0.3 || l < 0.14 || l > 0.9) continue;
    const w = x.n * s * s, k = Math.round(h / 30) % 12, b = bins.get(k);
    if (!b) bins.set(k, { score: w, best: x.c, top: w }); else { b.score += w; if (w > b.top) { b.top = w; b.best = x.c; } }
  }
  const out: RGB[] = [];
  for (const b of [...bins.values()].sort((a, c) => c.score - a.score)) { if (out.every((a) => hueGap(hsl(a)[0], hsl(b.best)[0]) > 28)) out.push(b.best); if (out.length === 3) break; }
  return out;
}

// ---------------------------------------------------------------- reading a reference
/** Colours and first-screen layout of a picture (a screenshot, a mockup, a PDF page). */
export function lookFromPixels(data: Uint8ClampedArray, w: number, h: number, source: "image" | "pdf" = "image"): Look {
  const key = (r: number, g: number, b: number) => ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
  const all = new Map<number, { n: number; r: number; g: number; b: number }>(), edge = new Map<number, number>();
  const put = (i: number, border: boolean) => {
    const r = data[i], g = data[i + 1], b = data[i + 2], k = key(r, g, b), e = all.get(k);
    if (e) { e.n++; e.r += r; e.g += g; e.b += b; } else all.set(k, { n: 1, r, g, b });
    if (border) edge.set(k, (edge.get(k) || 0) + 1);
  };
  const m = Math.max(2, Math.round(w * 0.04));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { if (data[(y * w + x) * 4 + 3] < 128) continue; put((y * w + x) * 4, x < m || x >= w - m || y < m); }
  const avg = (k: number): RGB => { const e = all.get(k)!; return [e.r / e.n, e.g / e.n, e.b / e.n]; };
  const total = [...all.values()].reduce((s, e) => s + e.n, 0) || 1;
  // Background: the colour that fills the edges, weighted by how much of the whole picture it covers.
  const bgKey = [...edge.entries()].sort((a, b) => b[1] * (all.get(b[0])!.n / total + 0.2) - a[1] * (all.get(a[0])!.n / total + 0.2))[0]?.[0] ?? [...all.entries()].sort((a, b) => b[1].n - a[1].n)[0][0];
  const bg = avg(bgKey);
  const rest = [...all.entries()].filter(([k]) => k !== bgKey).map(([k, e]) => ({ c: avg(k), n: e.n })).filter((x) => dist(x.c, bg) > 40);
  // Text: the most used colour that reads clearly on the background and isn't colourful.
  const textPick = rest.filter((x) => contrast(x.c, bg) >= 4.5 && hsl(x.c)[1] < 0.35).sort((a, b) => b.n * contrast(b.c, bg) ** 3 * (1.2 - hsl(b.c)[1]) - a.n * contrast(a.c, bg) ** 3 * (1.2 - hsl(a.c)[1]))[0];
  const text = textPick ? textPick.c : (lum(bg) < 0.4 ? [240, 242, 246] : [20, 22, 28]) as RGB;
  // Accents: the most used colourful colours, of clearly different hues.
  const accents = pickAccents(rest.filter((x) => x.n / total > 0.0008));
  // First screen: where the content sits. Rows of the top part, split into left, middle and right thirds.
  const top = Math.min(h, Math.round(w * 0.62)), from = Math.round(top * 0.14); let L = 0, C = 0, R = 0, colourL = 0, colourR = 0;
  for (let y = from; y < top; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, c: RGB = [data[i], data[i + 1], data[i + 2]]; if (dist(c, bg) < 48) continue;
    const third = x < w / 3 ? 0 : x < (2 * w) / 3 ? 1 : 2; if (third === 0) L++; else if (third === 1) C++; else R++;
    if (hsl(c)[1] > 0.25) { if (x < w / 2) colourL++; else colourR++; }
  }
  const ink = L + C + R, area = (top - from) * w || 1, sides = L + R || 1;
  let hero: Look["hero"];
  if (ink / area < 0.035) hero = "minimal";
  else if (Math.abs(L - R) / sides < 0.22) hero = C > (L + R) * 0.55 ? "center" : "stacked";
  else {
    // The busier, more colourful side is the picture; the text sits on the other.
    const artRight = colourL + colourR > ink * 0.08 ? colourR > colourL : R > L;
    hero = artRight ? "split" : "reverse";
  }
  return { source, bg: hex(bg), text: hex(text), accents: accents.map(hex), hero, libs: [] };
}
/** A picture file (PNG, JPG, WebP, SVG…) → its look. */
export async function lookFromImage(file: Blob): Promise<Look> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error("That file isn't a picture the browser can open. Use a PNG, JPG or WebP.")); i.src = url; });
    return lookFromCanvas(img, img.naturalWidth || img.width, img.naturalHeight || img.height, "image");
  } finally { URL.revokeObjectURL(url); }
}
function lookFromCanvas(src: CanvasImageSource, sw: number, sh: number, source: "image" | "pdf"): Look {
  if (!sw || !sh) throw new Error("That picture is empty.");
  // Only the top of a long page matters (its first screens): at most 2.4 times as tall as wide.
  const w = 220, cut = Math.min(sh, sw * 2.4), h = Math.max(1, Math.round((cut / sw) * w));
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  const cx = cv.getContext("2d", { willReadFrequently: true })!; cx.fillStyle = "#fff"; cx.fillRect(0, 0, w, h);
  cx.drawImage(src, 0, 0, sw, cut, 0, 0, w, h);
  return lookFromPixels(cx.getImageData(0, 0, w, h).data, w, h, source);
}
/** A PDF's first page, drawn and measured like a picture; its fonts say serif, sans or mono. */
export async function lookFromPdf(file: Blob, base: string): Promise<Look> {
  const load = new Function("u", "return import(u)") as (u: string) => Promise<any>;
  let pdfjs: any; try { pdfjs = await load(new URL("pdf.min.js", base).href); } catch { throw new Error("The PDF reader didn't load. Check your connection and try again."); }
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdf.worker.min.js", base).href;
  let doc: any; try { doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise; } catch { throw new Error("This file isn't a readable PDF (or it is password-protected)."); }
  const page = await doc.getPage(1), vp0 = page.getViewport({ scale: 1 }), vp = page.getViewport({ scale: Math.min(2, 900 / vp0.width) });
  const cv = document.createElement("canvas"); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
  const cx = cv.getContext("2d")!; cx.fillStyle = "#fff"; cx.fillRect(0, 0, cv.width, cv.height);
  await page.render({ canvasContext: cx, viewport: vp }).promise;
  const look = lookFromCanvas(cv, cv.width, cv.height, "pdf");
  try {
    const tc = await page.getTextContent(); await page.getOperatorList();
    const names: string[] = []; for (const k of Object.keys(tc.styles || {})) { try { names.push(String(page.commonObjs.get(k)?.name || tc.styles[k]?.fontFamily || "")); } catch { names.push(String(tc.styles[k]?.fontFamily || "")); } }
    const kind = fontKind(names.join(" ")); if (kind) look.fontKind = kind;
  } catch { /* colours and layout are enough */ }
  return look;
}
/** A page's design facts (from an HTML file, or a link read by the database) → its look. */
export function lookFromDigest(d: Digest): Look {
  const cols = d.colors.map(([c, n]) => ({ c: rgb(c), n }));
  const usable = (x?: string) => (x && /^#[0-9a-f]{6}$/i.test(x) ? rgb(x) : null);
  // Background: what the page says, else the most used near-white or near-black.
  let bg = usable(d.bg) || cols.filter((x) => hsl(x.c)[1] < 0.25 && (lum(x.c) > 0.8 || lum(x.c) < 0.06)).sort((a, b) => b.n - a.n)[0]?.c || ([255, 255, 255] as RGB);
  let text = usable(d.text) || cols.filter((x) => contrast(x.c, bg) >= 7 && hsl(x.c)[1] < 0.4).sort((a, b) => b.n - a.n)[0]?.c || ((lum(bg) < 0.4 ? [240, 242, 246] : [20, 22, 28]) as RGB);
  if (contrast(text, bg) < 3) text = (lum(bg) < 0.4 ? [240, 242, 246] : [20, 22, 28]) as RGB;
  const accents = pickAccents(cols);
  const names = d.fonts.map(([f]) => f), head = d.headFont || names.find((f) => f !== d.bodyFont) || names[0], body = d.bodyFont || names.find((f) => f !== head) || names[0];
  return { source: "page", bg: hex(bg), text: hex(text), accents: accents.map(hex), ...(head ? { headFont: head } : {}), ...(body ? { bodyFont: body } : {}), fontKind: fontKind(head || body || "") || undefined,
    ...(d.radii.length ? { radius: d.radii.filter((r) => r <= 40)[0] ?? d.radii[0] } : {}), hero: d.centered ? "center" : d.heroImage ? "split" : "minimal", libs: d.libs, uppercase: d.uppercase };
}
export const lookFromHtml = (html: string): Look => lookFromDigest(digestPage(html, ""));

// ---------------------------------------------------------------- fonts
const SERIF = /serif|garamond|playfair|times|georgia|baskerville|didot|bodoni|merriweather|lora|fraunces|cormorant|caslon|minion|palatino|abril|tiempos|canela|recoleta|freight/i;
const MONO = /mono|courier|consolas|menlo|code|typewriter/i;
function fontKind(name: string): Look["fontKind"] | undefined {
  if (!name.trim()) return undefined;
  if (/sans/i.test(name) && !/sans.?serif.*serif/i.test(name)) return MONO.test(name) ? "mono" : "sans";
  return MONO.test(name) ? "mono" : SERIF.test(name) ? "serif" : "sans";
}
const own = (list: string[], name?: string) => (name ? list.find((f) => f.toLowerCase() === name.trim().toLowerCase()) : undefined);
const kindOf = (f: string): NonNullable<Look["fontKind"]> => (/Mono|Silkscreen/.test(f) ? "mono" : /Serif|Fraunces|Playfair|Cormorant|Baskerville|Abril|Lora|Slab/.test(f) ? "serif" : "sans");
const PAIRS: Record<NonNullable<Look["fontKind"]>, [string, string]> = { serif: ["Fraunces", "Source Serif 4"], sans: ["Sora", "Inter"], mono: ["Space Grotesk", "JetBrains Mono"] };

// ---------------------------------------------------------------- the theme
/** Interactions decided from what the reference does (a page's libraries), else from its mood. */
function interactions(look: Look, mood: { dark: boolean; vivid: boolean; playful: boolean; kind: NonNullable<Look["fontKind"]> }): { fx: Fx; motion?: string; why: string } {
  const fx = Object.fromEntries(FX_KEYS.map((k) => [k, "none"])) as Fx, L = new Set(look.libs);
  if (L.size) {
    if (L.has("smooth")) fx.scrollfx = "smooth"; else if (L.has("parallax")) fx.scrollfx = "progress";
    if (L.has("reveal")) fx.textfx = mood.kind === "mono" ? "scramble" : "lines";
    if (L.has("cursor")) fx.cursor = mood.dark ? "blend" : "dot";
    if (L.has("tilt") || L.has("3d")) fx.hoverfx = "tilt"; else if (L.has("reveal")) fx.hoverfx = "magnetic";
    if (L.has("loader")) fx.loader = "curtain";
    const said = [L.has("smooth") && "smooth scrolling", L.has("reveal") && "scroll reveals", L.has("cursor") && "a custom cursor", (L.has("tilt") || L.has("3d")) && "3D hover", L.has("loader") && "an intro screen"].filter(Boolean);
    if (said.length) return { fx, motion: L.has("reveal") ? "rise" : undefined, why: "The page uses " + said.join(", ") + ", so the theme does too." };
  }
  if (mood.kind === "mono") return { fx: { ...fx, textfx: "scramble", cursor: "dot", overlay: mood.dark ? "scanlines" : "none" }, motion: "fade", why: "Monospace type reads as technical: decoding headings and a dot cursor." };
  if (mood.dark && mood.vivid) return { fx: { ...fx, cursor: "ring", textfx: "lines", hoverfx: "magnetic", scrollfx: "progress", overlay: "grain" }, motion: "rise", why: "Dark with strong colour reads as bold: line reveals, magnetic buttons, a ring cursor and film grain." };
  if (mood.dark) return { fx: { ...fx, textfx: "words", hoverfx: "lift", overlay: "vignette" }, motion: "fade", why: "Dark and restrained: soft word reveals and a lift on hover." };
  if (mood.kind === "serif") return { fx: { ...fx, textfx: "lines", hoverfx: "shine", overlay: "paper" }, motion: "fade", why: "Serif type on a light page reads as editorial: line reveals and a paper texture." };
  if (mood.playful) return { fx: { ...fx, textfx: "letters", hoverfx: "tilt" }, motion: "zoom", why: "Several bright colours read as playful: letter cascades and tilting cards." };
  if (mood.vivid) return { fx: { ...fx, textfx: "words", hoverfx: "lift", scrollfx: "progress" }, motion: "rise", why: "Light with a strong accent: word reveals, lifting cards and a progress bar." };
  return { fx: { ...fx, hoverfx: "lift" }, motion: "fade", why: "Light and quiet: a gentle fade and a lift on hover, nothing more." };
}

/** Builds the theme for this template from a reference's look. */
export function themeFromLook(look: Look, tpl: TemplateDef): Made {
  const notes: string[] = [];
  const bg = rgb(look.bg), dark = lum(bg) < 0.4;
  let text = rgb(look.text); if (contrast(text, bg) < 7) text = readable(text, bg, 7);
  // Three accents of different hues: the reference's own, then companions turned from the first.
  let acc = look.accents.map(rgb);
  if (!acc.length) { acc = [readable(mix(text, dark ? [120, 150, 255] : [40, 80, 220], 0.75), bg, 3)]; notes.push("The reference has no clear accent colour, so a blue was chosen. Change it under Colours."); }
  const [h0, s0, l0] = hsl(acc[0]);
  if (acc.length < 2) acc.push(fromHsl(h0 + 150, Math.min(0.85, s0 * 0.9), dark ? 0.62 : 0.5));
  if (acc.length < 3) acc.push(fromHsl(h0 + 40, Math.min(0.9, s0), dark ? 0.7 : Math.min(0.6, l0 + 0.12)));
  acc = acc.map((a) => readable(a, bg, 3));
  const colors = { bg: hex(bg), surface: hex(mix(bg, dark ? [255, 255, 255] : acc[0], dark ? 0.06 : 0.035)), deep: hex(dark ? mix(bg, [0, 0, 0], 0.45) : mix(text, acc[0], 0.12)),
    text: hex(text), soft: hex(mix(text, bg, 0.38)), line: hex(mix(bg, text, dark ? 0.2 : 0.14)), c1: hex(acc[0]), c2: hex(acc[1]), c3: hex(acc[2]) };

  // Fonts: the reference's own when the Studio has them, else the nearest of the same kind.
  const kind = look.fontKind || "sans";
  const display = own(DISPLAY_FONTS, look.headFont) || own(DISPLAY_FONTS, look.bodyFont), body = own(BODY_FONTS, look.bodyFont) || own(BODY_FONTS, look.headFont);
  if (look.headFont && !display) notes.push(`The reference's heading font (${look.headFont}) isn't in the Studio's list, so the nearest ${kind === "serif" ? "serif" : kind === "mono" ? "monospace" : "sans-serif"} was used.`);

  // The nearest Studio theme supplies everything a reference can't tell.
  const pool = (tpl.themes || THEMES).filter((t) => !t.signature);
  const layoutOk = (v?: string) => !!v && AXES.layout.options.some(([o]) => o === v);
  const score = (t: Theme) => (t.dark === dark ? 0 : 400) + dist(rgb(t.colors.bg), bg) * 0.6 + hueGap(hsl(rgb(t.colors.c1))[0], h0) * 0.7 + Math.abs(hsl(rgb(t.colors.c1))[1] - s0) * 60
    + (kindOf(t.display) === kind ? 0 : 45) + (look.hero && t.style.layout === look.hero ? -25 : 0) + (look.radius != null ? Math.abs(t.radius - look.radius) * 1.2 : 0);
  const base = [...pool].sort((a, b) => score(a) - score(b))[0];
  const pair = kindOf(base.display) === kind ? [base.display, base.body] : PAIRS[kind];
  const radius = Math.max(0, Math.min(32, Math.round(look.radius ?? base.radius)));
  const vividness = Math.max(...acc.map((a) => hsl(a)[1])), playful = look.accents.length >= 3 && radius >= 14 && !dark;
  const it = interactions(look, { dark, vivid: vividness > 0.6, playful, kind });
  const style = { ...base.style };
  if (layoutOk(look.hero)) style.layout = look.hero!;
  style.buttons = radius >= 20 ? "pill" : radius <= 2 ? "sharp" : style.buttons === "pill" || style.buttons === "sharp" ? "rounded" : style.buttons;
  if (look.uppercase) style.heading = "upper";
  if (it.motion) style.motionStyle = it.motion;
  const theme: Theme = { ...base, name: "From your reference", dark, colors, display: display || pair[0], body: body || pair[1], radius, style, fx: it.fx };
  const values = { ...tpl.themeValues(theme), ...it.fx };
  notes.unshift(it.why);
  notes.unshift(`Built on ${base.name}, the nearest of the Studio's themes, for the parts a reference can't show (cards, section layouts, patterns).`);
  if (look.source !== "page") notes.push("A picture can't tell which fonts were used" + (look.fontKind ? ` beyond their style (${look.fontKind})` : "") + ". Pick the exact ones under Fonts.");
  return { base, theme, values, notes };
}
