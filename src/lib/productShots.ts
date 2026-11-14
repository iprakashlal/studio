// Product shots from a pamphlet or spreadsheet picture, made in the browser: the product is cut out from a plain
// background (when it has one) and placed in three looks, like an edited studio photo:
//   studio    white sweep with a soft contact shadow
//   gradient  soft colour glow in the site's accent, floating shadow
//   podium    warm wall and floor, the product on a round podium
// The product itself isn't redrawn or changed, so the catalogue stays true to it. A photo with a busy background
// is placed whole, as a framed print, in the same three looks.
export type ShotStyle = "studio" | "gradient" | "podium";
export const SHOT_STYLES: { id: ShotStyle; label: string }[] = [
  { id: "studio", label: "Studio white" }, { id: "gradient", label: "Soft gradient" }, { id: "podium", label: "Podium" },
];
type Cut = { img: HTMLCanvasElement; cutout: boolean };

const canvas = (w: number, h: number) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
const toBlob = (c: HTMLCanvasElement, type = "image/jpeg", q = 0.9) => new Promise<Blob>((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error("Couldn't make the picture."))), type, q));

/** The product with its background removed (flood-filled from the edges), trimmed; or the photo as it is. */
export async function cutOut(src: Blob): Promise<Cut> {
  const bmp = await createImageBitmap(src);
  const k = Math.min(1, 1100 / Math.max(bmp.width, bmp.height));
  const c = canvas(bmp.width * k, bmp.height * k), g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(bmp, 0, 0, c.width, c.height); bmp.close?.();
  const { width: W, height: H } = c, im = g.getImageData(0, 0, W, H), d = im.data;
  // The background colour: the most common colour around the edges.
  const edge: number[] = [];
  const at = (x: number, y: number) => (y * W + x) * 4;
  for (let x = 0; x < W; x += 2) edge.push(at(x, 0), at(x, H - 1));
  for (let y = 0; y < H; y += 2) edge.push(at(0, y), at(W - 1, y));
  const buckets = new Map<number, number>();
  for (const i of edge) { const key = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4); buckets.set(key, (buckets.get(key) || 0) + 1); }
  const top = [...buckets.entries()].sort((a, b) => b[1] - a[1])[0][0];
  let br = 0, bg = 0, bb = 0, n = 0;
  for (const i of edge) { const key = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4); if (key === top) { br += d[i]; bg += d[i + 1]; bb += d[i + 2]; n++; } }
  br /= n; bg /= n; bb /= n;
  const near = (i: number, t: number) => { const dr = d[i] - br, dg = d[i + 1] - bg, db = d[i + 2] - bb; return dr * dr + dg * dg + db * db < t * t; };
  const plainEdges = edge.filter((i) => near(i, 38)).length / edge.length;
  if (plainEdges < 0.72) return { img: c, cutout: false };
  // Flood the background in from the edges.
  const bgMask = new Uint8Array(W * H), q = new Int32Array(W * H); let qh = 0, qt = 0;
  const push = (x: number, y: number) => { const p = y * W + x; if (!bgMask[p] && near(p * 4, 44)) { bgMask[p] = 1; q[qt++] = p; } };
  for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
  for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }
  while (qh < qt) { const p = q[qh++], x = p % W, y = (p / W) | 0; if (x > 0) push(x - 1, y); if (x < W - 1) push(x + 1, y); if (y > 0) push(x, y - 1); if (y < H - 1) push(x, y + 1); }
  let minX = W, minY = H, maxX = -1, maxY = -1, keep = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = y * W + x;
    if (bgMask[p]) { d[p * 4 + 3] = 0; continue; }
    keep++; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    // Soften the edge: a pixel next to the background is half see-through.
    if ((x > 0 && bgMask[p - 1]) || (x < W - 1 && bgMask[p + 1]) || (y > 0 && bgMask[p - W]) || (y < H - 1 && bgMask[p + W])) d[p * 4 + 3] = 140;
  }
  const share = keep / (W * H);
  if (share < 0.03 || share > 0.97 || maxX < minX) return { img: c, cutout: false };
  g.putImageData(im, 0, 0);
  const t = canvas(maxX - minX + 1, maxY - minY + 1); t.getContext("2d")!.drawImage(c, minX, minY, t.width, t.height, 0, 0, t.width, t.height);
  return { img: t, cutout: true };
}

const mix = (hex: string, w: string, p: number) => {
  const h = /^#?([0-9a-f]{6})$/i.exec(hex || "")?.[1] || "5b7cff", a = parseInt(h, 16), b = parseInt(w.slice(1), 16);
  const ch = (s: number) => Math.round(((a >> s) & 255) * p + ((b >> s) & 255) * (1 - p));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
};

/** One square shot (1200 px) of the product in a look. `accent`: the site's main colour, for the gradient look. */
export async function shot(cut: Cut, style: ShotStyle, accent = "#5B7CFF", size = 1200): Promise<Blob> {
  const c = canvas(size, size), g = c.getContext("2d")!, S = size;
  // Backdrop
  if (style === "studio") { const gr = g.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.7, "#f7f7f8"); gr.addColorStop(1, "#ececef"); g.fillStyle = gr; g.fillRect(0, 0, S, S); }
  else if (style === "gradient") { const gr = g.createRadialGradient(S * 0.5, S * 0.42, S * 0.05, S * 0.5, S * 0.5, S * 0.75); gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.55, mix(accent, "#ffffff", 0.16)); gr.addColorStop(1, mix(accent, "#ffffff", 0.42)); g.fillStyle = gr; g.fillRect(0, 0, S, S); }
  else {
    const wall = g.createLinearGradient(0, 0, 0, S * 0.66); wall.addColorStop(0, "#f6efe6"); wall.addColorStop(1, "#ead9c6"); g.fillStyle = wall; g.fillRect(0, 0, S, S * 0.66);
    const floor = g.createLinearGradient(0, S * 0.66, 0, S); floor.addColorStop(0, "#dcc6ae"); floor.addColorStop(1, "#cdb293"); g.fillStyle = floor; g.fillRect(0, S * 0.66, S, S * 0.34);
    const lite = g.createRadialGradient(S * 0.35, S * 0.2, 10, S * 0.35, S * 0.2, S * 0.7); lite.addColorStop(0, "rgba(255,255,255,.55)"); lite.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = lite; g.fillRect(0, 0, S, S);
  }
  // Where the product stands
  const img = cut.img, box = style === "podium" ? S * 0.56 : S * 0.72;
  const k = Math.min(box / img.width, box / img.height), w = img.width * k, h = img.height * k;
  const base = style === "studio" ? S * 0.84 : style === "gradient" ? S * 0.8 : S * 0.74, x = (S - w) / 2, y = base - h;
  if (style === "podium") {
    const pw = Math.max(w * 1.25, S * 0.42), px = (S - pw) / 2, ph = S * 0.05, top = base;
    const side = g.createLinearGradient(px, 0, px + pw, 0); side.addColorStop(0, "#e9dccd"); side.addColorStop(0.5, "#fbf6f0"); side.addColorStop(1, "#dccbb7");
    g.fillStyle = "rgba(60,40,20,.18)"; g.beginPath(); g.ellipse(S / 2, top + S * 0.1, pw * 0.56, ph * 1.2, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = side; g.fillRect(px, top, pw, S * 0.09); g.beginPath(); g.ellipse(S / 2, top + S * 0.09, pw / 2, ph, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#fffaf4"; g.beginPath(); g.ellipse(S / 2, top, pw / 2, ph, 0, 0, Math.PI * 2); g.fill();
  }
  // Contact shadow under the product
  const sh = g.createRadialGradient(S / 2, base, 1, S / 2, base, w * 0.55);
  sh.addColorStop(0, `rgba(0,0,0,${style === "gradient" ? 0.16 : 0.26})`); sh.addColorStop(1, "rgba(0,0,0,0)");
  g.save(); g.translate(S / 2, base + (style === "gradient" ? S * 0.045 : 2)); g.scale(1, 0.14); g.translate(-S / 2, -base); g.fillStyle = sh; g.beginPath(); g.arc(S / 2, base, w * 0.55, 0, Math.PI * 2); g.fill(); g.restore();
  g.save();
  g.shadowColor = "rgba(0,0,0,.22)"; g.shadowBlur = S * 0.04; g.shadowOffsetY = S * 0.018;
  if (cut.cutout) g.drawImage(img, x, y, w, h);
  else {
    // A busy photo: shown whole as a print with rounded corners.
    const r = S * 0.03; g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
    g.fillStyle = "#fff"; g.fill(); g.shadowColor = "transparent"; g.clip(); g.drawImage(img, x, y, w, h);
  }
  g.restore();
  return toBlob(c);
}
