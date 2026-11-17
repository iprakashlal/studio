// Colouring the Studio's (or a site admin page's) own interface from a logo. The interface's two colour families,
// the brand accent and the ink neutrals, are CSS variables (tailwind.config.js), so a tint only sets those:
// the accent takes the logo's main colour, made bright enough for the dark workbench and dark enough for white
// button text; the neutrals keep their own lightness and lean toward the same hue.
type RGB = [number, number, number];
const INK: Record<string, string> = { 950: "#0B0F17", 900: "#0F141D", 850: "#131A25", 800: "#18202D", 700: "#222C3B", 600: "#2E3A4C", 500: "#4A5870", 400: "#7D8AA0", 300: "#A9B3C4", 200: "#D3D9E3", 100: "#EEF1F6" };

const rgb = (h: string): RGB => { const x = h.replace("#", ""), f = x.length === 3 ? x.split("").map((c) => c + c).join("") : x.slice(0, 6); return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16)) as RGB; };
const hex = (c: RGB) => "#" + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
function hsl([r, g, b]: RGB): [number, number, number] {
  r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1)), h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function fromHsl(h: number, s: number, l: number): RGB {
  const a = s * Math.min(l, 1 - l), f = (n: number) => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1))); };
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}
const lum = (c: RGB) => { const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const contrast = (a: RGB, b: RGB) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
export const isHex = (v: unknown): v is string => typeof v === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v);

/** The main colour of a picture's pixels (RGBA), or null when it has no real colour (black, white or grey logos).
 *  See-through pixels are skipped; colours are grouped by hue and weighed by how much there is and how vivid it is. */
export function accentFromPixels(data: Uint8ClampedArray | number[]): string | null {
  const bins = new Map<number, { score: number; r: number; g: number; b: number; w: number }>(); let seen = 0;
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] < 128) continue; seen++;
    const c: RGB = [data[i], data[i + 1], data[i + 2]], [h, s, l] = hsl(c);
    if (s < 0.28 || l < 0.12 || l > 0.92) continue;
    const w = s * s * (1 - Math.abs(l - 0.5)), k = Math.round(h / 24) % 15, b = bins.get(k);
    if (b) { b.score += w; b.r += c[0] * w; b.g += c[1] * w; b.b += c[2] * w; b.w += w; } else bins.set(k, { score: w, r: c[0] * w, g: c[1] * w, b: c[2] * w, w });
  }
  const top = [...bins.values()].sort((a, b) => b.score - a.score)[0];
  // A few stray coloured pixels (JPEG fringes on a black logo) aren't a colour.
  if (!top || !seen || top.w / seen < 0.004) return null;
  return hex([top.r / top.w, top.g / top.w, top.b / top.w]);
}
/** The main colour of a picture (a data: address, or one this page may read), or null. */
export async function accentFromImage(src: string): Promise<string | null> {
  if (!src) return null;
  let url = src, made = false;
  try {
    if (!/^data:/i.test(src)) { const r = await fetch(src, { cache: "force-cache" }); if (!r.ok) return null; url = URL.createObjectURL(await r.blob()); made = true; }
    const img = await new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error("unreadable")); i.src = url; });
    const w = 96, h = Math.max(1, Math.min(192, Math.round(((img.naturalHeight || img.height || w) / (img.naturalWidth || img.width || w)) * w)));
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    const cx = cv.getContext("2d", { willReadFrequently: true }); if (!cx) return null;
    cx.drawImage(img, 0, 0, w, h);
    return accentFromPixels(cx.getImageData(0, 0, w, h).data);
  } catch { return null; }
  finally { if (made) URL.revokeObjectURL(url); }
}

/** The interface colours for an accent: brand 300–600 and the ink neutrals, as #rrggbb. */
export function tintPalette(accent: string): Record<string, string> {
  let [h, s] = hsl(rgb(accent)); s = Math.max(0.5, Math.min(0.92, s));
  // 500 is the button colour: as light as it can be while white text on it still reads (3.4:1).
  let l = 0.66; const white: RGB = [255, 255, 255];
  while (l > 0.3 && contrast(fromHsl(h, s, l), white) < 3.4) l -= 0.01;
  const out: Record<string, string> = { "brand-500": hex(fromHsl(h, s, l)), "brand-600": hex(fromHsl(h, s, Math.max(0.2, l - 0.09))), "brand-400": hex(fromHsl(h, Math.min(1, s + 0.06), Math.min(0.8, Math.max(l + 0.1, 0.68)))), "brand-300": hex(fromHsl(h, Math.min(1, s + 0.06), Math.min(0.88, Math.max(l + 0.18, 0.8)))) };
  for (const [k, v] of Object.entries(INK)) { const [, is, il] = hsl(rgb(v)); out["ink-" + k] = hex(fromHsl(h, Math.min(is, 0.3), il)); }
  return out;
}
/** Colours this page's interface from an accent (#rrggbb), or puts the standard colours back (null). */
export function applyTint(accent: string | null | undefined) {
  const id = "ui-tint"; let el = document.getElementById(id);
  if (!isHex(accent)) { el?.remove(); return; }
  if (!el) { el = document.createElement("style"); el.id = id; document.head.appendChild(el); }
  const css = ":root{" + Object.entries(tintPalette(accent)).map(([k, v]) => `--${k}:${rgb(v).join(" ")}`).join(";") + "}";
  if (el.textContent !== css) el.textContent = css;
}
