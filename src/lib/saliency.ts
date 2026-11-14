// Finds product photos inside a designed page (a pamphlet, a brochure page, a photo of one) and cuts them out,
// in the browser. Uses U²-Net (u2netp, Apache-2.0; models/NOTICE.txt) on onnxruntime-web, loaded only when
// needed (about 16 MB the first time, then cached by the browser).
//   1. The whole page: the model marks what stands out (the product photos, not the text or panels); each
//      large, solid region is a product.
//   2. Each product, cropped with a margin: the model again, for a finer outline, kept to the region found in
//      step 1, so badges or text that overlap the photo's corner are left out.
const load = new Function("u", "return import(u)") as (u: string) => Promise<any>;
const SIZE = 320;
let ready: Promise<{ o: any; s: any }> | null = null;

function model() {
  return (ready ||= (async () => {
    const base = new URL("runtime/ort/", location.href).href;
    const o = await load(base + "ort.wasm.min.mjs");
    o.env.wasm.wasmPaths = base; o.env.wasm.numThreads = 1;
    const s = await o.InferenceSession.create(new URL("models/u2netp.onnx", location.href).href, { executionProviders: ["wasm"] });
    return { o, s };
  })().catch((e) => { ready = null; throw e; }));
}

const canvas = (w: number, h: number) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };

/** How much each spot stands out, 0..1, on a 320×320 grid. */
async function saliency(src: HTMLCanvasElement): Promise<Float32Array> {
  const { o, s } = await model();
  const c = canvas(SIZE, SIZE), g = c.getContext("2d", { willReadFrequently: true })!;
  g.imageSmoothingQuality = "high"; g.drawImage(src, 0, 0, SIZE, SIZE);
  const d = g.getImageData(0, 0, SIZE, SIZE).data, N = SIZE * SIZE, x = new Float32Array(3 * N);
  const mean = [0.485, 0.456, 0.406], std = [0.229, 0.224, 0.225];
  for (let i = 0; i < N; i++) for (let k = 0; k < 3; k++) x[k * N + i] = (d[i * 4 + k] / 255 - mean[k]) / std[k];
  const out = await s.run({ [s.inputNames[0]]: new o.Tensor("float32", x, [1, 3, SIZE, SIZE]) });
  const m = out[s.outputNames[0]].data as Float32Array;
  let lo = Infinity, hi = -Infinity; for (let i = 0; i < N; i++) { if (m[i] < lo) lo = m[i]; if (m[i] > hi) hi = m[i]; }
  const r = new Float32Array(N); for (let i = 0; i < N; i++) r[i] = (m[i] - lo) / (hi - lo + 1e-6);
  return r;
}

type Region = { label: number; area: number; x0: number; y0: number; x1: number; y1: number };
/** Connected regions above `thr` on the grid. */
function regions(m: Float32Array, thr: number): { labels: Int32Array; list: Region[] } {
  const labels = new Int32Array(SIZE * SIZE), list: Region[] = [], q = new Int32Array(SIZE * SIZE);
  let next = 0;
  for (let p = 0; p < SIZE * SIZE; p++) {
    if (labels[p] || m[p] < thr) continue;
    const r: Region = { label: ++next, area: 0, x0: SIZE, y0: SIZE, x1: 0, y1: 0 };
    let h = 0, t = 0; q[t++] = p; labels[p] = r.label;
    while (h < t) {
      const c = q[h++], x = c % SIZE, y = (c / SIZE) | 0; r.area++;
      if (x < r.x0) r.x0 = x; if (x > r.x1) r.x1 = x; if (y < r.y0) r.y0 = y; if (y > r.y1) r.y1 = y;
      for (const n of [x > 0 ? c - 1 : -1, x < SIZE - 1 ? c + 1 : -1, y > 0 ? c - SIZE : -1, y < SIZE - 1 ? c + SIZE : -1]) if (n >= 0 && !labels[n] && m[n] >= thr) { labels[n] = r.label; q[t++] = n; }
    }
    list.push(r);
  }
  return { labels, list };
}

/** Grid helpers (320×320, 0/1): grow or shrink by r cells (square), keep the largest piece, fill enclosed holes. */
function grow(m: ArrayLike<number>, r: number): Uint8Array { return morph(m, r, 1); }
function shrinkBy(m: ArrayLike<number>, r: number): Uint8Array { return morph(m, r, 0); }
function morph(m: ArrayLike<number>, r: number, on: 0 | 1): Uint8Array {
  // Separable: rows then columns. on=1 grows (any set nearby), on=0 shrinks (all set nearby).
  const tmp = new Uint8Array(SIZE * SIZE), out = new Uint8Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    let v = on ? 0 : 1; for (let k = -r; k <= r; k++) { const X = x + k; const s = X < 0 || X >= SIZE ? 0 : m[y * SIZE + X] ? 1 : 0; if (on ? s : !s) { v = on; break; } }
    tmp[y * SIZE + x] = v;
  }
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    let v = on ? 0 : 1; for (let k = -r; k <= r; k++) { const Y = y + k; const s = Y < 0 || Y >= SIZE ? 0 : tmp[Y * SIZE + x]; if (on ? s : !s) { v = on; break; } }
    out[y * SIZE + x] = v;
  }
  return out;
}
function largest(m: Uint8Array): Uint8Array | null {
  const f = new Float32Array(m.length); for (let i = 0; i < m.length; i++) f[i] = m[i];
  const { labels, list } = regions(f, 0.5); if (!list.length) return null;
  const best = list.reduce((a, b) => (b.area > a.area ? b : a));
  const out = new Uint8Array(m.length); for (let i = 0; i < m.length; i++) out[i] = labels[i] === best.label ? 1 : 0;
  return out;
}
function fillHoles(m: Uint8Array) {
  const outside = new Uint8Array(m.length), q = new Int32Array(m.length); let h = 0, t = 0;
  const push = (p: number) => { if (!m[p] && !outside[p]) { outside[p] = 1; q[t++] = p; } };
  for (let i = 0; i < SIZE; i++) { push(i); push((SIZE - 1) * SIZE + i); push(i * SIZE); push(i * SIZE + SIZE - 1); }
  while (h < t) { const p = q[h++], x = p % SIZE, y = (p / SIZE) | 0; if (x > 0) push(p - 1); if (x < SIZE - 1) push(p + 1); if (y > 0) push(p - SIZE); if (y < SIZE - 1) push(p + SIZE); }
  for (let i = 0; i < m.length; i++) if (!outside[i]) m[i] = 1;
}

/** Edge cells whose colour matches what's just outside the product but not its body (a badge or banner printed
 *  over the photo's edge) are dropped. */
function trimFringe(m: Uint8Array, crop: HTMLCanvasElement, fine: Float32Array, foreign: Uint8Array) {
  // Only graphics the model saw but that were left out (a badge), never the plain page around the product.
  const graphic = new Uint8Array(m.length); for (let i = 0; i < m.length; i++) graphic[i] = !m[i] && fine[i] > 0.5 && foreign[i] ? 1 : 0;
  const c = canvas(SIZE, SIZE), g = c.getContext("2d", { willReadFrequently: true })!; g.drawImage(crop, 0, 0, SIZE, SIZE);
  const px = g.getImageData(0, 0, SIZE, SIZE).data, body = shrinkBy(m, 12), R = 13;
  const dist = (i: number, j: number) => { const a = i * 4, b = j * 4, r = px[a] - px[b], gg = px[a + 1] - px[b + 1], bb = px[a + 2] - px[b + 2]; return Math.sqrt(r * r + gg * gg + bb * bb); };
  // A few passes, measured from the left-out graphic only (so the peel can't spread into the product).
  for (let pass = 0; pass < 3; pass++) {
    const drop: number[] = [];
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const i = y * SIZE + x; if (!m[i] || body[i]) continue;
      let nearOut = Infinity, nearBody = Infinity;
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= SIZE || Y >= SIZE) continue;
        const j = Y * SIZE + X;
        if (graphic[j]) nearOut = Math.min(nearOut, dist(i, j)); else if (m[j] && body[j]) nearBody = Math.min(nearBody, dist(i, j));
      }
      if (nearOut < 45 && nearBody > 90) drop.push(i);
    }
    if (!drop.length) break;
    for (const i of drop) m[i] = 0;
  }
}

export type FoundProduct = { blob: Blob; x: number; y: number; w: number; h: number };

/** The product photos on a page, cut out (PNG with a see-through background), top to bottom. */
export async function findProducts(page: HTMLCanvasElement, opts: { max?: number; depth?: number } = {}): Promise<FoundProduct[]> {
  const W = page.width, H = page.height, sx = W / SIZE, sy = H / SIZE;
  const sal = await saliency(page);
  const { list } = regions(sal, 0.5);
  // Products are big and solid: skip small bits and loose shapes such as large headline letters.
  // How strongly a region stands out on average: products are near 1, text blocks and panels lower.
  const strength = (r: Region) => { let t = 0, n = 0; for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) { const i = y * SIZE + x; if (sal[i] >= 0.5) { t += sal[i]; n++; } } return n ? t / n : 0; };
  const keep = list.filter((r) => r.area >= SIZE * SIZE * 0.012 && r.area / ((r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1)) >= 0.32)
    .sort((a, b) => b.area - a.area).slice(0, opts.max || 6).sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  const out: FoundProduct[] = [];
  for (const r of keep) {
    // A large region may be the layout (panels or cards holding several products): look again inside it.
    // Several products inside: use them. A strong region on its own: one product (its parts aren't split up).
    // Otherwise the one thing that stands out inside it.
    let sub: FoundProduct[] = [];
    const ix = r.x0 * sx, iy = r.y0 * sy;
    if (r.area > SIZE * SIZE * 0.3 && (opts.depth || 0) < 2) {
      const iw = (r.x1 - r.x0 + 1) * sx, ih = (r.y1 - r.y0 + 1) * sy;
      const inner = canvas(iw, ih); inner.getContext("2d")!.drawImage(page, ix, iy, iw, ih, 0, 0, inner.width, inner.height);
      sub = (await findProducts(inner, { max: opts.max, depth: (opts.depth || 0) + 1 })).map((f) => ({ ...f, x: f.x + ix, y: f.y + iy }));
    }
    const strong = strength(r) >= 0.72;
    if (sub.length >= 2 || (!strong && sub.length === 1)) { out.push(...sub); continue; }
    if (!strong) continue;
    const mx = (r.x1 - r.x0 + 1) * 0.1, my = (r.y1 - r.y0 + 1) * 0.1;
    const gx0 = Math.max(0, r.x0 - mx), gy0 = Math.max(0, r.y0 - my), gx1 = Math.min(SIZE, r.x1 + 1 + mx), gy1 = Math.min(SIZE, r.y1 + 1 + my);
    const cx = gx0 * sx, cy = gy0 * sy, cw = (gx1 - gx0) * sx, ch = (gy1 - gy0) * sy;
    const crop = canvas(cw, ch); crop.getContext("2d")!.drawImage(page, cx, cy, cw, ch, 0, 0, crop.width, crop.height);
    const fine = await saliency(crop);
    // What may belong to the product: anything the whole page marked even faintly (a grey handle counts; a badge or
    // text printed over the photo's corner doesn't).
    const allowed = grow(sal.map((v) => (v > 0.06 ? 1 : 0)), 2);
    const M = new Uint8Array(SIZE * SIZE), foreign = new Uint8Array(SIZE * SIZE);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const gx = Math.min(SIZE - 1, ((cx + (x + 0.5) * cw / SIZE) / sx) | 0), gy = Math.min(SIZE - 1, ((cy + (y + 0.5) * ch / SIZE) / sy) | 0);
      M[y * SIZE + x] = fine[y * SIZE + x] > 0.5 && allowed[gy * SIZE + gx] ? 1 : 0;
      foreign[y * SIZE + x] = sal[gy * SIZE + gx] < 0.03 ? 1 : 0;
    }
    // Keep the one solid shape: thin bits joined to it come off, then its outline comes back.
    const core = largest(shrinkBy(M, 5)); if (!core) continue;
    const kept = grow(core, 8); for (let i = 0; i < kept.length; i++) kept[i] = kept[i] && M[i] ? 1 : 0;
    fillHoles(kept);
    trimFringe(kept, crop, fine, foreign);
    // Specks left after trimming: keep only the main piece.
    { const main = largest(kept); if (main) { kept.set(main); fillHoles(kept); } }
    // Scaled up smoothly to the crop's size for soft edges.
    const fc = canvas(SIZE, SIZE), fg = fc.getContext("2d")!, fi = fg.createImageData(SIZE, SIZE);
    for (let i = 0; i < SIZE * SIZE; i++) { const v = kept[i] ? 255 : 0; fi.data[i * 4] = fi.data[i * 4 + 1] = fi.data[i * 4 + 2] = v; fi.data[i * 4 + 3] = 255; }
    fg.putImageData(fi, 0, 0);
    // A slight blur before scaling up turns the grid's steps into a smooth outline.
    const up = canvas(crop.width, crop.height), ug = up.getContext("2d", { willReadFrequently: true })!; ug.imageSmoothingQuality = "high";
    ug.filter = `blur(${Math.max(1, crop.width / SIZE * 0.9).toFixed(1)}px)`; ug.drawImage(fc, 0, 0, up.width, up.height); ug.filter = "none";
    const a = ug.getImageData(0, 0, up.width, up.height).data;
    const cg = crop.getContext("2d", { willReadFrequently: true })!, img = cg.getImageData(0, 0, crop.width, crop.height), d = img.data;
    let minX = crop.width, minY = crop.height, maxX = -1, maxY = -1;
    for (let y = 0; y < crop.height; y++) for (let x = 0; x < crop.width; x++) {
      const i = y * crop.width + x, v = a[i * 4] / 255, al = v <= 0.35 ? 0 : v >= 0.65 ? 1 : (v - 0.35) / 0.3;
      d[i * 4 + 3] = Math.round(al * 255);
      if (al > 0.1) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    }
    if (maxX < minX) continue;
    cg.putImageData(img, 0, 0);
    const t = canvas(maxX - minX + 1, maxY - minY + 1); t.getContext("2d")!.drawImage(crop, minX, minY, t.width, t.height, 0, 0, t.width, t.height);
    const blob = await new Promise<Blob | null>((ok) => t.toBlob(ok, "image/png")); if (!blob) continue;
    out.push({ blob, x: cx + minX, y: cy + minY, w: t.width, h: t.height });
  }
  return out.sort((a, b) => a.y - b.y || a.x - b.x).slice(0, opts.max || 6);
}

/** The product in a single photo (busy background), cut out; null if nothing clear stands out. */
export async function cutSingle(photo: HTMLCanvasElement): Promise<Blob | null> {
  try { const f = await findProducts(photo, { max: 1 }); return f[0]?.blob || null; } catch { return null; }
}
