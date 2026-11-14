// Reads a product pamphlet in the browser: a PDF's text page by page (pages that are pictures are rendered to
// JPEG for the AI to read), or photos of a pamphlet (made smaller). Also renders pages to use as product photos.
const load = new Function("u", "return import(u)") as (u: string) => Promise<any>;
export type PamphletPage = { n: number; text: string; image?: string };
export type Pamphlet = { pages: PamphletPage[]; photo(n: number): Promise<Blob | null>; close(): void };
const MAX_PAGES = 12;

function canvasJpeg(c: HTMLCanvasElement, q = 0.85): Promise<Blob> { return new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error("Couldn't make the picture."))), "image/jpeg", q)); }
const blobUri = (b: Blob) => new Promise<string>((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.readAsDataURL(b); });

/** A photo made at most `max` pixels across, as JPEG. */
async function shrink(file: Blob, max = 1600): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height); bmp.close?.();
  return canvasJpeg(c);
}

export async function readPamphlet(files: File[], pdfBase: string): Promise<Pamphlet> {
  const pdf = files.find((f) => /\.pdf$/i.test(f.name) || f.type === "application/pdf");
  if (!pdf) {
    const imgs = files.filter((f) => /^image\/(jpeg|png|webp)$/.test(f.type) || /\.(jpe?g|png|webp)$/i.test(f.name)).slice(0, 8);
    if (!imgs.length) throw new Error("Choose a PDF or photos (JPG, PNG or WebP) of the pamphlet.");
    const small = await Promise.all(imgs.map((f) => shrink(f)));
    const pages = await Promise.all(small.map(async (b, i) => ({ n: i + 1, text: "", image: await blobUri(b) })));
    return { pages, photo: async (n) => small[n - 1] || null, close() {} };
  }
  let pdfjs: any;
  try { pdfjs = await load(new URL("pdf.min.js", pdfBase).href); } catch { throw new Error("The PDF reader didn't load. Check your connection and try again."); }
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdf.worker.min.js", pdfBase).href;
  let doc: any;
  try { doc = await pdfjs.getDocument({ data: new Uint8Array(await pdf.arrayBuffer()), isEvalSupported: false }).promise; }
  catch (e: any) { throw new Error(/password/i.test(e?.name + e?.message) ? "This PDF is password-protected. Save a copy without a password and upload that." : "This file isn't a readable PDF."); }
  const render = async (n: number, width: number) => {
    const page = await doc.getPage(n), vp1 = page.getViewport({ scale: 1 }), vp = page.getViewport({ scale: Math.min(3, width / vp1.width) });
    const c = document.createElement("canvas"); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    const g = c.getContext("2d")!; g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: g, viewport: vp }).promise;
    return canvasJpeg(c);
  };
  const pages: PamphletPage[] = [];
  for (let n = 1; n <= Math.min(doc.numPages, MAX_PAGES); n++) {
    const page = await doc.getPage(n), tc = await page.getTextContent();
    // Text runs in reading order: group by line (y), left to right.
    const runs = (tc.items as any[]).filter((it) => it.str?.trim()).map((it) => ({ x: it.transform[4], y: Math.round(it.transform[5]), s: it.str }));
    runs.sort((a, b) => b.y - a.y || a.x - b.x);
    const lines: string[] = []; let y: number | null = null, cur: string[] = [];
    for (const r of runs) { if (y !== null && Math.abs(r.y - y) > 3) { lines.push(cur.join(" ")); cur = []; } y = r.y; cur.push(r.s); }
    if (cur.length) lines.push(cur.join(" "));
    const text = lines.join("\n").replace(/[ \t]+/g, " ").trim();
    // A page that's mostly a picture (a scan, or text drawn as artwork) goes to the AI as an image.
    pages.push({ n, text, ...(text.split(/\s+/).length < 25 ? { image: await blobUri(await render(n, 1400)) } : {}) });
  }
  return { pages, photo: (n) => render(n, 1600).catch(() => null), close: () => { doc.destroy(); } };
}

/** What the AI reads: text pages with markers, and pictures of the pages without text. */
export const pamphletInput = (p: Pamphlet) => ({
  text: p.pages.filter((x) => x.text).map((x) => `--- PAGE ${x.n} ---\n${x.text}`).join("\n\n"),
  images: p.pages.filter((x) => x.image).map((x) => ({ page: x.n, data: x.image! })),
});
