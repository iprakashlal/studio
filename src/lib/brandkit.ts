// Brand kit: print and social pieces drawn from a site's theme, logo and details. Each piece is an SVG string (so
// it stays sharp at any size) that the dialog shows, and turns into a PNG for printing or posting.
//   visiting card (front and back, 3.5 × 2 in), QR standee (A5), pamphlet (A5), festival posts (1080 × 1080).
import qrcode from "qrcode-generator";
import { FESTIVALS, type Festival } from "./festivals";

export type KitInfo = {
  name: string; tagline: string; person: string; role: string;
  phone: string; email: string; address: string; site: string;
  /** What the QR code opens (the site, unless changed). */
  qr: string; qrLabel: string;
  /** Up to four things the business offers: title and one line. */
  points: { title: string; text: string }[];
  headline: string; offer: string;
  /** The logo as a data: URL ("" = draw the initials). */
  logo: string;
  colors: { bg: string; surface: string; text: string; soft: string; line: string; c1: string; c2: string; c3: string; deep: string };
  display: string; body: string; radius: number;
  /** @font-face rules with the fonts embedded, so the PNG uses the site's fonts ("" = system fonts). */
  fontCss: string;
};
export type Piece = { id: string; name: string; group: string; w: number; h: number; /** Print size, for the file name and the note. */ size: string; /** Pixels per unit when saved as PNG. */ scale: number; svg: string };

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const rgb = (h: string) => { const x = /^#?([0-9a-f]{6})/i.exec(h || "")?.[1] || "000000", n = parseInt(x, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const lum = (h: string) => { const [r, g, b] = rgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
/** Black or white, whichever reads on this colour. */
export const on = (h: string) => (lum(h) > 0.42 ? "#111418" : "#FFFFFF");
const mixHex = (a: string, b: string, t: number) => { const x = rgb(a), y = rgb(b); return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join(""); };
const initials = (name: string) => name.split(/\s+/).map((w) => w[0] || "").join("").slice(0, 2).toUpperCase() || "•";

/** Breaks text into lines of at most `max` characters (rough: SVG has no wrapping of its own). */
export function wrap(text: string, max: number, lines = 9): string[] {
  const out: string[] = [];
  for (const para of String(text || "").split(/\n/)) {
    let line = "";
    for (const w of para.trim().split(/\s+/).filter(Boolean)) { if ((line + " " + w).trim().length > max && line) { out.push(line); line = w; } else line = (line + " " + w).trim(); }
    if (line) out.push(line);
  }
  if (out.length > lines) { const cut = out.slice(0, lines); cut[lines - 1] = cut[lines - 1].replace(/.{0,2}$/, "…"); return cut; }
  return out;
}
const tspans = (lines: string[], x: number, lh: number) => lines.map((l, i) => `<tspan x="${x}" dy="${i ? lh : 0}">${esc(l)}</tspan>`).join("");
/** Shrinks a font size so a single line fits a width (rough: 0.56 em per character). */
const fit = (text: string, size: number, width: number, min = size * 0.5) => Math.max(min, Math.min(size, width / (Math.max(1, text.length) * 0.56)));

/** A QR code as SVG path data on a `size` square, with its own quiet zone. */
export function qrPath(text: string, size: number): { d: string; cell: number } {
  const q = qrcode(0, "M"); q.addData(text || "https://example.com"); q.make();
  const n = q.getModuleCount(), cell = size / (n + 2); let d = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${((c + 1) * cell).toFixed(2)} ${((r + 1) * cell).toFixed(2)}h${cell.toFixed(2)}v${cell.toFixed(2)}h-${cell.toFixed(2)}z`;
  return { d, cell };
}
const qrBlock = (k: KitInfo, x: number, y: number, size: number, r = 10) => `<g transform="translate(${x} ${y})"><rect width="${size}" height="${size}" rx="${r}" fill="#fff"/><path d="${qrPath(k.qr, size).d}" fill="#111"/></g>`;
/** The logo in a box, or the initials on the accent colour. */
function logoBlock(k: KitInfo, x: number, y: number, s: number, plain = false): string {
  if (k.logo) return `<image href="${esc(k.logo)}" x="${x}" y="${y}" width="${s}" height="${s}" preserveAspectRatio="xMidYMid meet"/>`;
  const r = Math.min(k.radius, s / 3.2);
  return `<g transform="translate(${x} ${y})"><rect width="${s}" height="${s}" rx="${r}" fill="${plain ? "#fff" : k.colors.c1}"/><text x="${s / 2}" y="${s / 2}" text-anchor="middle" dominant-baseline="central" font-family="${fd(k)}" font-weight="800" font-size="${s * 0.42}" fill="${plain ? k.colors.c1 : on(k.colors.c1)}">${esc(initials(k.name))}</text></g>`;
}
const fd = (k: KitInfo) => `'${k.display}', 'Noto Sans', 'Segoe UI', Arial, sans-serif`;
const fb = (k: KitInfo) => `'${k.body}', 'Noto Sans', 'Segoe UI', Arial, sans-serif`;
const open = (k: KitInfo, w: number, h: number) => `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${k.fontCss ? `<style>${k.fontCss}</style>` : ""}`;
const short = (u: string) => u.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");

// ---------------------------------------------------------------- visiting card (1050 × 600 = 3.5 × 2 in at 300 dpi)
function cardFront(k: KitInfo): string {
  const c = k.colors, W = 1050, H = 600, ink = on(c.c1);
  const nameSize = fit(k.name, 62, 760);
  return open(k, W, H) + `<rect width="${W}" height="${H}" fill="${c.c1}"/>
<circle cx="${W - 70}" cy="80" r="210" fill="${c.c2}" opacity=".9"/><circle cx="${W - 250}" cy="${H + 40}" r="150" fill="${c.c3}" opacity=".85"/>
<rect x="0" y="${H - 14}" width="${W}" height="14" fill="${mixHex(c.c1, "#000000", 0.25)}"/>
${logoBlock(k, 80, 190, 130, true)}
<text x="80" y="${400}" font-family="${fd(k)}" font-weight="800" font-size="${nameSize}" fill="${ink}">${esc(k.name)}</text>
${k.tagline ? `<text x="80" y="456" font-family="${fb(k)}" font-size="${fit(k.tagline, 26, 800, 18)}" fill="${ink}" opacity=".88">${esc(wrap(k.tagline, 70, 1)[0] || "")}</text>` : ""}</svg>`;
}
function cardBack(k: KitInfo): string {
  const c = k.colors, W = 1050, H = 600, rows = [k.phone && ["Phone", k.phone], k.email && ["Email", k.email], k.site && ["Web", short(k.site)]].filter(Boolean) as string[][];
  const addr = wrap(k.address, 44, 2);
  return open(k, W, H) + `<rect width="${W}" height="${H}" fill="${c.bg}"/><rect width="26" height="${H}" fill="${c.c1}"/>
<text x="90" y="128" font-family="${fd(k)}" font-weight="800" font-size="${fit(k.person || k.name, 50, 560)}" fill="${c.text}">${esc(k.person || k.name)}</text>
${(() => { const sub = k.person ? [k.role, k.name].filter(Boolean).join(" · ") : k.role || k.tagline; return `<text x="90" y="172" font-family="${fb(k)}" font-size="${fit(sub, 24, 600, 15)}" fill="${c.c1}" font-weight="700">${esc(wrap(sub, 74, 1)[0] || "")}</text>`; })()}
<line x1="90" y1="212" x2="250" y2="212" stroke="${c.line}" stroke-width="3"/>
${rows.map((r, i) => `<text x="90" y="${276 + i * 56}" font-family="${fb(k)}" font-size="18" letter-spacing="2" fill="${c.soft}">${esc(r[0].toUpperCase())}</text><text x="190" y="${276 + i * 56}" font-family="${fb(k)}" font-size="${fit(r[1], 27, 470, 18)}" font-weight="600" fill="${c.text}">${esc(r[1])}</text>`).join("")}
${addr.length ? `<text x="90" y="${276 + rows.length * 56 + 6}" font-family="${fb(k)}" font-size="21" fill="${c.soft}">${tspans(addr, 90, 30)}</text>` : ""}
${qrBlock(k, W - 300, 150, 220, 14)}<text x="${W - 190}" y="408" text-anchor="middle" font-family="${fb(k)}" font-size="19" font-weight="700" fill="${c.text}">${esc(k.qrLabel)}</text>
${logoBlock(k, W - 150, H - 130, 70)}</svg>`;
}

// ---------------------------------------------------------------- QR standee (A5 portrait, 148 × 210 mm → 1480 × 2100)
function standee(k: KitInfo): string {
  const c = k.colors, W = 1480, H = 2100, ink = on(c.c1), head = wrap(k.qrLabel, 16, 2);
  return open(k, W, H) + `<rect width="${W}" height="${H}" fill="${c.c1}"/>
<circle cx="${W + 40}" cy="140" r="430" fill="${c.c2}" opacity=".9"/><circle cx="-60" cy="${H - 250}" r="360" fill="${c.c3}" opacity=".85"/>
${logoBlock(k, 120, 130, 170, true)}
<text x="330" y="${k.tagline ? 212 : 238}" font-family="${fd(k)}" font-weight="800" font-size="${fit(k.name, 78, 1000)}" fill="${ink}">${esc(k.name)}</text>
${k.tagline ? `<text x="330" y="272" font-family="${fb(k)}" font-size="${fit(k.tagline, 36, 1000, 24)}" fill="${ink}" opacity=".9">${esc(wrap(k.tagline, 56, 1)[0] || "")}</text>` : ""}
<text x="${W / 2}" y="560" text-anchor="middle" font-family="${fd(k)}" font-weight="800" font-size="${fit(head[0] || "", 150, 1240)}" fill="${ink}">${tspans(head, W / 2, 160)}</text>
<rect x="250" y="${head.length > 1 ? 800 : 700}" width="980" height="980" rx="${Math.min(60, k.radius * 2.2)}" fill="#fff"/>
<g transform="translate(300 ${head.length > 1 ? 850 : 750})"><path d="${qrPath(k.qr, 880).d}" fill="#111"/></g>
<text x="${W / 2}" y="${head.length > 1 ? 1880 : 1790}" text-anchor="middle" font-family="${fb(k)}" font-size="44" font-weight="700" fill="${ink}">${esc(short(k.qr).slice(0, 44))}</text>
<text x="${W / 2}" y="${H - 90}" text-anchor="middle" font-family="${fb(k)}" font-size="36" fill="${ink}" opacity=".9">${esc([k.phone, k.email].filter(Boolean).join("   ·   "))}</text></svg>`;
}

// ---------------------------------------------------------------- pamphlet (A5 portrait)
function pamphlet(k: KitInfo): string {
  const c = k.colors, W = 1480, H = 2100, ink = on(c.c1), head = wrap(k.headline || k.tagline || k.name, 22, 3), pts = k.points.slice(0, 4);
  const hh = 330 + head.length * 104, top = hh + 210, rowH = pts.length ? Math.min(240, (H - top - 500 - (k.offer ? 170 : 0)) / pts.length) : 0;
  return open(k, W, H) + `<rect width="${W}" height="${H}" fill="${c.bg}"/>
<path d="M0 0H${W}V${hh - 60}Q${W / 2} ${hh + 90} 0 ${hh - 60}Z" fill="${c.c1}"/><circle cx="${W - 120}" cy="110" r="300" fill="${c.c2}" opacity=".85"/>
${logoBlock(k, 110, 100, 130, true)}<text x="275" y="182" font-family="${fd(k)}" font-weight="800" font-size="${fit(k.name, 60, 900)}" fill="${ink}">${esc(k.name)}</text>
<text x="110" y="380" font-family="${fd(k)}" font-weight="800" font-size="${fit(head.reduce((a, b) => (a.length > b.length ? a : b), ""), 96, 1250, 60)}" fill="${ink}">${tspans(head, 110, 104)}</text>
${pts.map((p, i) => { const y = top + i * rowH; return `<circle cx="150" cy="${y + 34}" r="38" fill="${[c.c1, c.c2, c.c3, c.c1][i]}"/><text x="150" y="${y + 36}" text-anchor="middle" dominant-baseline="central" font-family="${fd(k)}" font-weight="800" font-size="36" fill="${on([c.c1, c.c2, c.c3, c.c1][i])}">${i + 1}</text>
<text x="230" y="${y + 30}" font-family="${fd(k)}" font-weight="700" font-size="${fit(p.title, 50, 1120, 34)}" fill="${c.text}">${esc(p.title)}</text><text x="230" y="${y + 84}" font-family="${fb(k)}" font-size="32" fill="${c.soft}">${tspans(wrap(p.text, 68, 2), 230, 44)}</text>`; }).join("")}
${k.offer ? `<rect x="110" y="${H - 640}" width="${W - 220}" height="130" rx="${Math.min(40, k.radius * 1.5)}" fill="${mixHex(c.bg, c.c1, 0.12)}" stroke="${c.c1}" stroke-width="3" stroke-dasharray="14 10"/><text x="${W / 2}" y="${H - 575}" text-anchor="middle" dominant-baseline="central" font-family="${fd(k)}" font-weight="800" font-size="${fit(k.offer, 50, W - 300, 30)}" fill="${c.c1}">${esc(k.offer)}</text>` : ""}
<rect x="0" y="${H - 440}" width="${W}" height="440" fill="${c.deep}"/>
${qrBlock(k, 110, H - 370, 300, 18)}
<text x="470" y="${H - 300}" font-family="${fd(k)}" font-weight="800" font-size="54" fill="${on(c.deep)}">${esc(k.qrLabel)}</text>
<text x="470" y="${H - 228}" font-family="${fb(k)}" font-size="36" fill="${on(c.deep)}" opacity=".9">${tspans([k.phone, k.email, short(k.site)].filter(Boolean), 470, 54)}</text>
${k.address ? `<text x="470" y="${H - 228 + [k.phone, k.email, k.site].filter(Boolean).length * 54}" font-family="${fb(k)}" font-size="30" fill="${on(c.deep)}" opacity=".75">${tspans(wrap(k.address, 54, 2), 470, 42)}</text>` : ""}</svg>`;
}

// ---------------------------------------------------------------- festival posts (1080 × 1080)
const SPARK = (x: number, y: number, s: number, fill: string) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0-20 5-5 20 0 5 5 0 20-5 5-20 0-5-5Z" fill="${fill}"/>`;
/** A decoration per kind of festival, drawn from simple shapes in the theme's colours. */
function deco(kind: string, k: KitInfo, ink: string): string {
  const c = k.colors;
  if (kind === "flowers" || kind === "feathers") return [[150, 170, 1.5, c.c2], [930, 190, 1.2, c.c3], [170, 910, 1.2, c.c3], [920, 900, 1.6, c.c2], [540, 110, 0.8, ink], [90, 540, 0.7, c.c2], [990, 560, 0.7, c.c3]].map(([x, y, s, f]) => `<g transform="translate(${x} ${y}) scale(${s})" opacity=".9">${[0, 60, 120, 180, 240, 300].map((a) => `<ellipse rx="16" ry="38" cy="-40" fill="${f}" transform="rotate(${a})"/>`).join("")}<circle r="16" fill="#FFC83A"/></g>`).join("");
  if (kind === "diyas" || kind === "lamps" || kind === "lanterns" || kind === "fire") return [0, 1, 2, 3, 4].map((i) => { const x = 170 + i * 185, y = 200 + (i % 2) * 22; return `<path d="M${x - 62} ${y}q62 70 124 0z" fill="${i % 2 ? c.c3 : c.c2}"/><path d="M${x} ${y - 14}c-26-34 0-58 0-84 0 26 26 50 0 84z" fill="#FFC83A"/><circle cx="${x}" cy="${y - 44}" r="46" fill="#FFC83A" opacity=".18"/>`; }).join("");
  if (kind === "colors" || kind === "colours" || kind === "gulal") return [[170, 190, 150, c.c2], [900, 240, 190, c.c3], [200, 900, 180, c.c3], [880, 880, 150, c.c2], [540, 130, 90, ink]].map(([x, y, r, f]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${f}" opacity=".55"/><circle cx="${+x + 60}" cy="${+y + 40}" r="${+r * 0.5}" fill="${f}" opacity=".4"/>`).join("");
  if (kind === "kites") return [[200, 220, c.c2, -18], [860, 180, c.c3, 14], [760, 860, c.c2, 22]].map(([x, y, f, a]) => `<g transform="translate(${x} ${y}) rotate(${a})"><path d="M0-90 70 0 0 110-70 0Z" fill="${f}"/><path d="M0-90V110M-70 0H70" stroke="${ink}" stroke-width="3" opacity=".5"/><path d="M0 110q30 50-10 100t20 90" fill="none" stroke="${ink}" stroke-width="3" opacity=".6"/></g>`).join("");
  if (kind === "flag" || kind === "tricolour" || kind === "tricolor") return `<rect x="0" y="0" width="1080" height="46" fill="#FF9933"/><rect x="0" y="1034" width="1080" height="46" fill="#138808"/><circle cx="540" cy="200" r="62" fill="none" stroke="#000080" stroke-width="7"/>${Array.from({ length: 24 }, (_, i) => `<path d="M540 200L${540 + 62 * Math.cos((i * Math.PI) / 12)} ${200 + 62 * Math.sin((i * Math.PI) / 12)}" stroke="#000080" stroke-width="2.5"/>`).join("")}`;
  if (kind === "moon" || kind === "crescent") return `<path d="M780 130a150 150 0 1 0 150 220 120 120 0 1 1-150-220z" fill="${c.c3}"/>${SPARK(640, 190, 1.6, c.c3)}${SPARK(260, 250, 1.1, c.c2)}${SPARK(180, 860, 1.5, c.c3)}${SPARK(900, 820, 1.2, c.c2)}`;
  if (kind === "snow" || kind === "stars" || kind === "star") return [[160, 170, 2.4], [900, 200, 1.8], [240, 880, 1.6], [880, 860, 2.6], [540, 120, 1.4], [120, 520, 1.2], [960, 540, 1.3]].map(([x, y, s], i) => SPARK(x, y, s, i % 2 ? c.c3 : c.c2)).join("");
  // confetti, flowers, anything else
  return Array.from({ length: 34 }, (_, i) => { const x = (i * 197) % 1080, y = i % 2 ? ((i * 71) % 250) + 30 : 1050 - ((i * 53) % 250), f = [c.c2, c.c3, ink][i % 3]; if (y > 780 && x > 340 && x < 740) return ""; return i % 3 ? `<rect x="${x}" y="${y}" width="26" height="12" rx="4" fill="${f}" opacity=".85" transform="rotate(${(i * 37) % 180} ${x} ${y})"/>` : `<circle cx="${x}" cy="${y}" r="11" fill="${f}" opacity=".85"/>`; }).join("");
}
function festivalPost(k: KitInfo, f: Festival, variant: number): string {
  const c = k.colors, S = 1080, bg = variant === 0 ? c.c1 : variant === 1 ? c.deep : c.bg, ink = on(bg), accent = variant === 2 ? c.c1 : ink;
  const head = wrap(f.greet, 14, 3), size = fit(head.reduce((a, b) => (a.length > b.length ? a : b), ""), 132, 900, 70), y0 = 500 - ((head.length - 1) * size * 1.08) / 2;
  return open(k, S, S) + `<rect width="${S}" height="${S}" fill="${bg}"/>${deco(f.deco, k, ink)}
<text x="${S / 2}" y="${y0}" text-anchor="middle" font-family="${fd(k)}" font-weight="800" font-size="${size}" fill="${accent}">${tspans(head, S / 2, size * 1.08)}</text>
<text x="${S / 2}" y="${y0 + head.length * size * 1.08 + 10}" text-anchor="middle" font-family="${fb(k)}" font-size="38" fill="${ink}" opacity=".9">${esc(`from all of us at ${k.name}`.slice(0, 52))}</text>
<g transform="translate(${S / 2 - 46} ${S - 250})">${logoBlock(k, 0, 0, 92, variant !== 2)}</g>
<text x="${S / 2}" y="${S - 110}" text-anchor="middle" font-family="${fb(k)}" font-size="30" font-weight="700" fill="${ink}" opacity=".85">${esc(short(k.site).slice(0, 48))}</text></svg>`;
}

/** The festivals coming up next (by official date), soonest first. */
export function upcomingFestivals(n: number, now = new Date()): Festival[] {
  const y = now.getFullYear(), md = (d: Date) => d.toISOString().slice(0, 10), today = md(now);
  const next = (f: Festival): string => {
    if (f.fixed) { const a = `${y}-${f.fixed[1]}`; return a >= today ? `${y}-${f.fixed[0]}` : `${y + 1}-${f.fixed[0]}`; }
    for (const yr of [y, y + 1]) { const d = f.dates?.[String(yr)]; if (d && d[1] >= today) return d[0]; }
    return "9999";
  };
  return FESTIVALS.map((f) => ({ f, at: next(f) })).filter((x) => x.at !== "9999").sort((a, b) => a.at.localeCompare(b.at)).slice(0, n).map((x) => x.f);
}

/** Every piece of the kit, drawn for this business. */
export function makeKit(k: KitInfo, festivals: Festival[]): Piece[] {
  return [
    { id: "card-front", name: "Visiting card · front", group: "Visiting card", w: 1050, h: 600, size: "3.5 × 2 in", scale: 1, svg: cardFront(k) },
    { id: "card-back", name: "Visiting card · back", group: "Visiting card", w: 1050, h: 600, size: "3.5 × 2 in", scale: 1, svg: cardBack(k) },
    { id: "qr-standee", name: "QR standee", group: "QR standee", w: 1480, h: 2100, size: "A5", scale: 1.182, svg: standee(k) },
    { id: "pamphlet", name: "Pamphlet", group: "Pamphlet", w: 1480, h: 2100, size: "A5", scale: 1.182, svg: pamphlet(k) },
    ...festivals.map((f, i) => ({ id: "post-" + f.id, name: f.name + " post", group: "Festival posts", w: 1080, h: 1080, size: "1080 × 1080", scale: 1, svg: festivalPost(k, f, i % 3) })),
  ];
}

/** An SVG piece as a PNG (the fonts and logo are inside the SVG, so nothing else is loaded). */
export async function pieceToPng(p: Piece): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([p.svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = await new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error("Couldn't draw " + p.name + ".")); i.src = url; });
    const cv = document.createElement("canvas"); cv.width = Math.round(p.w * p.scale); cv.height = Math.round(p.h * p.scale);
    cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height);
    return await new Promise<Blob>((ok, no) => cv.toBlob((b) => (b ? ok(b) : no(new Error("Couldn't save " + p.name + "."))), "image/png"));
  } finally { URL.revokeObjectURL(url); }
}
const fontCache = new Map<string, string>();
/** @font-face rules for these Google fonts with the font files inside (Latin), so a saved PNG keeps the site's type. */
export async function embedFonts(families: string[]): Promise<string> {
  let out = "";
  for (const fam of [...new Set(families.filter(Boolean))]) {
    if (!fontCache.has(fam)) {
      let css = "";
      try {
        const sheet = await (await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(fam).replace(/%20/g, "+")}:wght@400;600;700;800&display=swap`)).text();
        // One file per weight: the block for basic Latin (the last one of each weight).
        const blocks = [...sheet.matchAll(/@font-face\s*\{[^}]*\}/g)].map((m) => m[0]).filter((b) => /U\+0000-00FF/.test(b) || !/unicode-range/.test(b));
        for (const b of blocks.slice(0, 4)) {
          const u = /url\((https:[^)]+)\)/.exec(b)?.[1]; if (!u) continue;
          const buf = new Uint8Array(await (await fetch(u)).arrayBuffer()); let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
          css += b.replace(/url\(https:[^)]+\)/, `url(data:font/woff2;base64,${btoa(bin)})`).replace(/unicode-range:[^;]+;/, "");
        }
      } catch { /* system fonts */ }
      fontCache.set(fam, css);
    }
    out += fontCache.get(fam);
  }
  return out;
}
