// What a web page looks like, read from its HTML and CSS: the colours, fonts and corner sizes it uses most, and
// which interaction libraries it loads. Used to build a theme from a reference (src/lib/themefrom.ts): by the
// database Worker for a link (it fetches the page), and in the browser for an uploaded HTML file. Only the design
// facts are read; none of the page's text or pictures is kept.
export type Digest = {
  /** Colours by how often the stylesheet uses them, most used first (#rrggbb). */
  colors: [string, number][];
  /** The page's own background and text colour, when the stylesheet says (body / html / :root). */
  bg?: string; text?: string;
  /** Font families by use; the ones set on headings and on the body when found. */
  fonts: [string, number][]; headFont?: string; bodyFont?: string;
  /** Corner radii in px, most used first. */
  radii: number[];
  /** Interaction libraries and patterns found: smooth, reveal, cursor, tilt, loader, marquee, parallax, slider, 3d. */
  libs: string[];
  centered: boolean; heroImage: boolean; uppercase: boolean;
};

const hex2 = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
const NAMED: Record<string, string> = { white: "#ffffff", black: "#000000" };
function hsl(h: number, s: number, l: number): string {
  s /= 100; l /= 100; const k = (n: number) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return "#" + hex2(f(0) * 255) + hex2(f(8) * 255) + hex2(f(4) * 255);
}
/** One CSS colour value → #rrggbb, or "" (transparent, gradients, variables and keywords other than black/white). */
export function cssColor(v: string): string {
  v = v.trim().toLowerCase(); let m: RegExpExecArray | null;
  if (NAMED[v]) return NAMED[v];
  if ((m = /^#([0-9a-f]{3,8})$/.exec(v))) { const h = m[1]; if (h.length === 3 || h.length === 4) return "#" + h.slice(0, 3).split("").map((c) => c + c).join(""); if (h.length === 6 || h.length === 8) return "#" + h.slice(0, 6); return ""; }
  if ((m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(v))) { const a = m[4] == null ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]); return a < 0.6 ? "" : "#" + hex2(+m[1]) + hex2(+m[2]) + hex2(+m[3]); }
  if ((m = /^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(v))) { const a = m[4] == null ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]); return a < 0.6 ? "" : hsl(+m[1], +m[2], +m[3]); }
  return "";
}
const GENERIC = /^(inherit|initial|unset|serif|sans-serif|monospace|system-ui|ui-sans-serif|ui-serif|ui-monospace|cursive|fantasy|-apple-system|blinkmacsystemfont|segoe ui|arial|helvetica|helvetica neue|roboto|var\(.*\)|emoji|math)$/i;
const ICON = /icon|awesome|glyph|symbol|material|swiper|slick|dashicons|elementor|eicons/i;
/** The first real family of a font-family value ("Inter", not the fallbacks). */
function family(v: string): string {
  for (const part of v.split(",")) { const n = part.trim().replace(/^["']|["']$/g, "").replace(/!important/i, "").trim(); if (n && !GENERIC.test(n) && !ICON.test(n) && n.length < 40) return n; }
  return "";
}
const count = <T,>(m: Map<T, number>, k: T, n = 1) => m.set(k, (m.get(k) || 0) + n);
const top = <T,>(m: Map<T, number>, n: number): [T, number][] => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);

export function digestPage(html: string, css: string): Digest {
  html = String(html || "").slice(0, 3_000_000); css = String(css || "").slice(0, 3_000_000);
  const inline = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");
  const attrs = [...html.matchAll(/\sstyle\s*=\s*"([^"]{0,600})"/gi)].map((m) => m[1]).join(";\n");
  const all = (css + "\n" + inline).replace(/\/\*[\s\S]*?\*\//g, ""), sheet = all + "\n" + attrs;
  // CSS variables that hold a colour, so var(--x) in body/background rules can be followed.
  const vars = new Map<string, string>();
  for (const m of all.matchAll(/(--[\w-]+)\s*:\s*([^;}{]+)[;}]/g)) { const c = cssColor(m[2]); if (c && !vars.has(m[1])) vars.set(m[1], c); }
  const resolve = (v: string): string => { const m = /var\(\s*(--[\w-]+)/.exec(v); return m ? vars.get(m[1]) || "" : cssColor(v.replace(/!important/i, "").trim().split(/\s+(?![^(]*\))/)[0] || ""); };

  const colors = new Map<string, number>();
  for (const m of sheet.matchAll(/#[0-9a-f]{3,8}\b|rgba?\([^)]{5,40}\)|hsla?\([^)]{5,40}\)/gi)) { const c = cssColor(m[0]); if (c) count(colors, c); }

  const fonts = new Map<string, number>(), radii = new Map<number, number>();
  let bg = "", text = "", headFont = "", bodyFont = "", centered = 0, upper = 0;
  for (const m of all.matchAll(/([^{}]{1,300})\{([^{}]{1,4000})\}/g)) {
    const sel = m[1].trim().toLowerCase(), body = m[2];
    const isRoot = /(^|[\s,])(body|html|:root)(\s*[,{]|$)/.test(sel + "{"), isHead = /(^|[\s,>])h[12]\b|\.hero|\.title|\.heading|\.display/.test(sel);
    const ff = /font-family\s*:\s*([^;}]+)/i.exec(body);
    if (ff) { const f = family(ff[1].includes("var(") ? "" : ff[1]); if (f) { count(fonts, f); if (isHead && !headFont) headFont = f; if (isRoot && !bodyFont) bodyFont = f; } }
    if (isRoot) {
      const b = /background(?:-color)?\s*:\s*([^;}]+)/i.exec(body), c = /(?:^|[;\s])color\s*:\s*([^;}]+)/i.exec(body);
      if (b && !bg) bg = resolve(b[1]); if (c && !text) text = resolve(c[1]);
    }
    for (const r of body.matchAll(/border-radius\s*:\s*([\d.]+)(px|rem|em)\b/gi)) { const px = Math.round(parseFloat(r[1]) * (r[2] === "px" ? 1 : 16)); if (px >= 0 && px <= 60) count(radii, px); }
    if (isHead && /text-align\s*:\s*center/i.test(body)) centered++;
    if (isHead && /text-transform\s*:\s*uppercase/i.test(body)) upper++;
  }
  // Web fonts named in a Google Fonts link count strongly: they're the ones the page chose.
  for (const m of html.matchAll(/fonts\.googleapis\.com\/css2?\?([^"'>\s]+)/gi)) for (const f of m[1].matchAll(/family=([^&:@"']+)/g)) { const n = decodeURIComponent(f[1].replace(/\+/g, " ")).trim(); if (n && !ICON.test(n)) count(fonts, n, 5); }
  // Font variables (--font-heading: "X") when the rules themselves only say var(...).
  if (!headFont || !bodyFont) for (const m of all.matchAll(/--[\w-]*(font|ff|family)[\w-]*\s*:\s*([^;}]+)[;}]/gi)) { const f = family(m[2]); if (!f) continue; count(fonts, f, 2); if (/head|display|title/i.test(m[0]) && !headFont) headFont = f; else if (/body|base|text|sans|primary/i.test(m[0]) && !bodyFont) bodyFont = f; }
  if (!bg) bg = vars.get("--bg") || vars.get("--background") || vars.get("--color-bg") || vars.get("--color-background") || vars.get("--body-bg") || "";
  if (!text) text = vars.get("--text") || vars.get("--color-text") || vars.get("--foreground") || vars.get("--body-color") || "";

  const src = html + "\n" + all, libs: string[] = [];
  const has = (k: string, re: RegExp) => { if (re.test(src)) libs.push(k); };
  has("smooth", /\blenis\b|locomotive-scroll|smooth-scrollbar|ScrollSmoother|data-scroll-container/i);
  has("reveal", /\bgsap\b|ScrollTrigger|\baos\b|data-aos|split-?type|splitting|\bwow\.js|scrollreveal|data-sal\b|framer-motion/i);
  has("cursor", /custom-cursor|cursor-(dot|follower|ring|inner|outer)|\.cursor[\s{.,]|mouse-follower|cursor\s*:\s*none/i);
  has("tilt", /vanilla-tilt|data-tilt|tilt\.js|atropos/i);
  has("loader", /preloader|page-loader|loading-screen|\bpace\.js|barba|swup/i);
  has("marquee", /marquee|ticker/i);
  has("parallax", /parallax|rellax|data-speed/i);
  has("slider", /swiper|slick|splide|flickity|owl-carousel|embla/i);
  has("3d", /three(\.module)?(\.min)?\.js|\bTHREE\.|spline|babylon/i);
  // The first screen: a picture or video near the top of the body.
  const bodyAt = html.search(/<body/i), first = html.slice(Math.max(0, bodyAt), Math.max(0, bodyAt) + 9000);
  const heroImage = /<(img|video|picture|canvas|model-viewer)\b/i.test(first.replace(/<header[\s\S]*?<\/header>|<nav[\s\S]*?<\/nav>/gi, ""));
  return { colors: top(colors, 40), ...(bg ? { bg } : {}), ...(text ? { text } : {}), fonts: top(fonts, 12), ...(headFont ? { headFont } : {}), ...(bodyFont ? { bodyFont } : {}), radii: top(radii, 8).map(([r]) => r), libs, centered: centered > 0, heroImage, uppercase: upper > 0 };
}
/** The stylesheets a page links (absolute https addresses), most important first. */
export function sheetLinks(html: string, base: string): string[] {
  const out: string[] = [];
  for (const m of String(html).matchAll(/<link\b[^>]*>/gi)) {
    if (!/rel\s*=\s*["']?[^"'>]*stylesheet/i.test(m[0])) continue;
    const h = /href\s*=\s*["']([^"']+)["']/i.exec(m[0]); if (!h) continue;
    try { const u = new URL(h[1].replace(/&amp;/g, "&"), base); if (u.protocol === "https:" && !/fonts\.googleapis\.com/.test(u.host) && !out.includes(u.href)) out.push(u.href); } catch { /* not an address */ }
  }
  return out;
}
