// Reading the words in a picture on this device (Tesseract, bundled with the Studio under runtime/tess/).
// Nothing is fetched from another site and nothing is uploaded. English print reads best; photos should be
// straight and sharp.
const base = () => new URL("runtime/tess/", location.href).href;

type Worker = { recognize: (img: string | Blob | HTMLCanvasElement) => Promise<{ data: { text: string; confidence: number } }>; terminate: () => Promise<unknown> };
let worker: Promise<Worker> | null = null;

/** Starts the reader once (about 7 MB from the Studio's own files the first time, then cached by the browser). */
function start(step?: (s: string) => void): Promise<Worker> {
  return (worker ||= (async () => {
    const T: any = await import("tesseract.js");
    const create = T.createWorker || T.default?.createWorker;
    return (await create("eng", 1, {
      workerPath: base() + "worker.min.js", corePath: base(), langPath: base(), gzip: true, workerBlobURL: false,
      logger: (m: any) => { if (step && m?.status) step(/recogni/i.test(m.status) ? `Reading the picture: ${Math.round((m.progress || 0) * 100)}%` : "Starting the reader"); },
    })) as Worker;
  })().catch((e) => { worker = null; throw new Error("The on-device reader couldn't start (" + String(e?.message || e).slice(0, 120) + "). Reload the Studio and try again."); }));
}

/** The picture as an <img>, whatever it came as. */
async function loadImg(src: string | Blob): Promise<HTMLImageElement> {
  const url = typeof src === "string" ? src : URL.createObjectURL(src);
  try { const im = new Image(); im.decoding = "async"; im.src = url; await im.decode(); return im; } finally { if (typeof src !== "string") setTimeout(() => URL.revokeObjectURL(url), 30000); }
}
/**
 * Gets a picture ready for reading. Small print reads far better enlarged, and a page with two columns (a menu spread,
 * a screenshot of two pages side by side) reads wrongly as one: lines from both columns run together. So the picture is
 * cut at the blank gaps that run its whole height, and each column is enlarged and read by itself, left to right.
 */
export async function columnsOf(src: string | Blob): Promise<HTMLCanvasElement[]> {
  const im = await loadImg(src), W = im.naturalWidth, H = im.naturalHeight;
  const cv = (w: number, h: number) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
  if (!W || !H) return [];
  // A small copy, to find the gaps: a column of pixels that hardly changes from top to bottom is blank.
  const sw = Math.min(W, 800), sh = Math.max(1, Math.min(H, 1200)), small = cv(sw, sh), sx = small.getContext("2d", { willReadFrequently: true })!;
  sx.drawImage(im, 0, 0, sw, sh);
  const px = sx.getImageData(0, 0, sw, sh).data, blank: boolean[] = [];
  for (let x = 0; x < sw; x++) {
    let sum = 0, sq = 0, n = 0;
    for (let y = 0; y < sh; y += 2) { const k = (y * sw + x) * 4, l = px[k] * 0.3 + px[k + 1] * 0.59 + px[k + 2] * 0.11; sum += l; sq += l * l; n++; }
    const mean = sum / n; blank.push(Math.sqrt(Math.max(0, sq / n - mean * mean)) < 6);
  }
  const cuts: number[] = []; const minGap = Math.max(4, Math.round(sw * 0.012));
  for (let x = 0; x < sw; x++) {
    if (!blank[x]) continue; let e = x; while (e < sw && blank[e]) e++;
    // Only gaps inside the picture split it (the margins at either edge don't), and only wide ones.
    if (x > sw * 0.15 && e < sw * 0.85 && e - x >= minGap) cuts.push(((x + e) / 2 / sw) * W);
    x = e;
  }
  const edges = [0, ...cuts.slice(0, 3), W], out: HTMLCanvasElement[] = [];
  for (let i = 0; i + 1 < edges.length; i++) {
    const x0 = Math.round(edges[i]), w = Math.round(edges[i + 1]) - x0; if (w < 40) continue;
    // Enlarge so a column is about 1700 px across (print of 9–10 px becomes readable), without making a huge picture.
    const scale = Math.max(1, Math.min(4, 1700 / w, Math.sqrt(26e6 / (w * H))));
    const c = cv(Math.round(w * scale), Math.round(H * scale)), g = c.getContext("2d")!;
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high"; g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(im, x0, 0, w, H, 0, 0, c.width, c.height); out.push(c);
  }
  return out;
}
/** The text of a picture (a data: address or a file), line by line as printed; columns are read one after the other. */
export async function readPicture(img: string | Blob, step?: (s: string) => void): Promise<{ text: string; sure: number }> {
  const w = await start(step);
  let parts: (HTMLCanvasElement | string | Blob)[] = [];
  try { parts = await columnsOf(img); } catch { /* read it as it is */ }
  if (!parts.length) parts = [img];
  const texts: string[] = []; let sure = 0;
  for (const [i, part] of parts.entries()) {
    if (step && parts.length > 1) step(`Reading column ${i + 1} of ${parts.length}`);
    const r = await w.recognize(part as any);
    texts.push(String(r?.data?.text || "").replace(/[ \t]+\n/g, "\n").trim()); sure += r?.data?.confidence || 0;
  }
  return { text: texts.filter(Boolean).join("\n"), sure: Math.round(sure / parts.length) };
}
/** Frees the reader's memory (it starts again when next needed). */
export async function stopReader() { const w = worker; worker = null; try { await (await w)?.terminate(); } catch { /* already gone */ } }
