// Reads a product catalogue in the browser:
//  - a PDF: its text page by page (pages that are pictures are rendered to JPEG for the AI to read), and the
//    product pictures on each page, cut from the rendered page where the PDF places them;
//  - an Excel (.xlsx) or CSV sheet: one row per product, and the pictures placed on each row;
//  - photos of a pamphlet (made smaller), each also a candidate product picture.
import JSZip from "jszip";
import { parseCsv } from "./warranty";
import { findProducts } from "./saliency";

const load = new Function("u", "return import(u)") as (u: string) => Promise<any>;
export type PamphletPage = { n: number; text: string; image?: string };
/** A picture that may show a product: its page (or spreadsheet row) and where it sits, top to bottom. */
export type PamphletPic = { page: number; blob: Blob; y: number; x: number; /** already cut out (see-through background) */ cut?: boolean };
export type Pamphlet = { kind: "pdf" | "sheet" | "photos"; pages: PamphletPage[]; pics: PamphletPic[]; photo(n: number): Promise<Blob | null>; close(): void };
const MAX_PAGES = 12, MAX_ROWS = 300;

function canvasJpeg(c: HTMLCanvasElement, q = 0.88): Promise<Blob> { return new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error("Couldn't make the picture."))), "image/jpeg", q)); }
const blobUri = (b: Blob) => new Promise<string>((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.readAsDataURL(b); });

/** A photo made at most `max` pixels across, as JPEG. */
async function shrink(file: Blob, max = 1600): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height); bmp.close?.();
  return canvasJpeg(c);
}
const isPdf = (f: File) => /\.pdf$/i.test(f.name) || f.type === "application/pdf";
const isSheet = (f: File) => /\.(xlsx|csv)$/i.test(f.name) || /spreadsheetml|text\/csv/.test(f.type);

/** `find`: also look for product photos inside designed pages (needs the product finder; skipped if it can't load). */
export async function readPamphlet(files: File[], pdfBase: string, o: { find?: boolean; step?: (s: string) => void } = {}): Promise<Pamphlet> {
  const sheet = files.find(isSheet); if (sheet) return readSheet(sheet);
  const pdf = files.find(isPdf); if (pdf) return readPdf(pdf, pdfBase, o);
  const imgs = files.filter((f) => /^image\/(jpeg|png|webp)$/.test(f.type) || /\.(jpe?g|png|webp)$/i.test(f.name)).slice(0, 8);
  if (!imgs.length) throw new Error("Choose a PDF, an Excel (.xlsx) or CSV file, or photos (JPG, PNG or WebP) of the pamphlet.");
  const small = await Promise.all(imgs.map((f) => shrink(f)));
  const pages = await Promise.all(small.map(async (b, i) => ({ n: i + 1, text: "", image: await blobUri(b) })));
  const pics: PamphletPic[] = [];
  for (const [i, b] of small.entries()) {
    // A photo of a designed pamphlet: find the product photos in it. A plain product photo: use it whole.
    const found = o.find ? await find(await toCanvas(b), i + 1, small.length, o.step) : [];
    if (found.length) pics.push(...found); else pics.push({ page: i + 1, blob: b, x: 0, y: 0 });
  }
  return { kind: "photos", pages, pics, photo: async (n) => small[n - 1] || null, close() {} };
}

const toCanvas = async (b: Blob) => { const bmp = await createImageBitmap(b); const c = document.createElement("canvas"); c.width = bmp.width; c.height = bmp.height; c.getContext("2d")!.drawImage(bmp, 0, 0); bmp.close?.(); return c; };
/** Product photos inside a designed page, cut out. Empty when the finder can't load. */
async function find(c: HTMLCanvasElement, page: number, of: number, step?: (s: string) => void): Promise<PamphletPic[]> {
  step?.(`Finding the product photos${of > 1 ? ` (page ${page} of ${of})` : ""}`);
  try { return (await findProducts(c)).map((f) => ({ page, blob: f.blob, x: f.x, y: f.y, cut: true })); } catch { return []; }
}

// ---------------------------------------------------------------- PDF
async function readPdf(pdf: File, pdfBase: string, o: { find?: boolean; step?: (s: string) => void } = {}): Promise<Pamphlet> {
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
    return { c, vp, page };
  };
  const pages: PamphletPage[] = [], pics: PamphletPic[] = [];
  const O = pdfjs.OPS;
  for (let n = 1; n <= Math.min(doc.numPages, MAX_PAGES); n++) {
    const page = await doc.getPage(n), tc = await page.getTextContent();
    // Text runs in reading order: group by line (y), left to right.
    const runs = (tc.items as any[]).filter((it) => it.str?.trim()).map((it) => ({ x: it.transform[4], y: Math.round(it.transform[5]), s: it.str }));
    runs.sort((a, b) => b.y - a.y || a.x - b.x);
    const lines: string[] = []; let y: number | null = null, cur: string[] = [];
    for (const r of runs) { if (y !== null && Math.abs(r.y - y) > 3) { lines.push(cur.join(" ")); cur = []; } y = r.y; cur.push(r.s); }
    if (cur.length) lines.push(cur.join(" "));
    const text = lines.join("\n").replace(/[ \t]+/g, " ").trim();
    // Where the page draws pictures: follow the drawing operations' transforms to each image's box.
    const boxes: number[][] = [];
    try {
      const ops = await page.getOperatorList(); let m = [1, 0, 0, 1, 0, 0]; const stack: number[][] = [];
      const mul = (a: number[], b: number[]) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
      for (let i = 0; i < ops.fnArray.length; i++) {
        const fn = ops.fnArray[i], a = ops.argsArray[i];
        if (fn === O.save) stack.push(m); else if (fn === O.restore) m = stack.pop() || m;
        else if (fn === O.transform) m = mul(m, a);
        else if (fn === O.paintFormXObjectBegin) { stack.push(m); if (Array.isArray(a?.[0]) && a[0].length === 6) m = mul(m, a[0]); }
        else if (fn === O.paintFormXObjectEnd) m = stack.pop() || m;
        else if (fn === O.paintImageXObject || fn === O.paintInlineImageXObject || fn === O.paintJpegXObject) {
          const xs = [m[4], m[0] + m[4], m[2] + m[4], m[0] + m[2] + m[4]], ys = [m[5], m[1] + m[5], m[3] + m[5], m[1] + m[3] + m[5]];
          boxes.push([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]);
        }
      }
    } catch { /* no pictures found on this page */ }
    const pictureOnly = text.split(/\s+/).length < 25;
    if (pictureOnly || boxes.length) {
      const { c, vp } = await render(n, 1600);
      if (pictureOnly) pages.push({ n, text, image: await blobUri(await canvasJpeg(c)) }); else pages.push({ n, text });
      const area = c.width * c.height, before = pics.length;
      for (const b of boxes) {
        const [x1, y1, x2, y2] = vp.convertToViewportRectangle(b);
        const x = Math.max(0, Math.min(x1, x2)), yy = Math.max(0, Math.min(y1, y2)), w = Math.min(c.width, Math.max(x1, x2)) - x, h = Math.min(c.height, Math.max(y1, y2)) - yy;
        // Skip icons and logos (small), and backgrounds (the whole page).
        if (w < 110 || h < 110 || w * h < area * 0.015 || w * h > area * 0.92) continue;
        const cut = document.createElement("canvas"); cut.width = Math.round(w); cut.height = Math.round(h);
        cut.getContext("2d")!.drawImage(c, x, yy, w, h, 0, 0, cut.width, cut.height);
        pics.push({ page: n, blob: await canvasJpeg(cut, 0.92), x, y: yy });
      }
      // The page draws pictures, but none is a separate product picture (a flattened design or a scan): find the
      // products in it. Pages with only text and drawn shapes have no product photos, so they're skipped.
      if (pics.length === before && o.find && boxes.length) pics.push(...(await find(c, n, Math.min(doc.numPages, MAX_PAGES), o.step)));
    } else pages.push({ n, text });
  }
  pics.sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);
  return { kind: "pdf", pages, pics, photo: async (n) => { try { return await canvasJpeg((await render(n, 1600)).c); } catch { return null; } }, close: () => { doc.destroy(); } };
}

// ---------------------------------------------------------------- Excel / CSV
const colIndex = (ref: string) => { let n = 0; for (const ch of ref.replace(/\d+/g, "")) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
const xml = (s: string) => new DOMParser().parseFromString(s, "application/xml");
const kids = (el: Element | Document, local: string) => [...el.getElementsByTagNameNS("*", local)];
const resolve = (base: string, target: string) => { if (target.startsWith("/")) return target.slice(1); const p = base.split("/").slice(0, -1); for (const s of target.split("/")) { if (s === "..") p.pop(); else if (s !== ".") p.push(s); } return p.join("/"); };
const relsOf = async (zip: JSZip, part: string) => {
  const dir = part.split("/").slice(0, -1).join("/"), name = part.split("/").pop();
  const f = zip.file(`${dir}/_rels/${name}.rels`); if (!f) return new Map<string, string>();
  return new Map(kids(xml(await f.async("text")), "Relationship").map((r) => [r.getAttribute("Id")!, resolve(part, r.getAttribute("Target")!)]));
};

async function readSheet(file: File): Promise<Pamphlet> {
  let rows: string[][] = []; const pics: PamphletPic[] = [];
  if (/\.csv$/i.test(file.name) || file.type === "text/csv") {
    const recs = parseCsv(await file.text());
    // parseCsv gives objects keyed by header; turn them back into rows with the header first.
    const head = recs.length ? Object.keys(recs[0]) : [];
    rows = [head, ...recs.map((r) => head.map((h) => r[h] || ""))];
  } else {
    let zip: JSZip;
    try { zip = await JSZip.loadAsync(await file.arrayBuffer()); } catch { throw new Error("That isn't a readable Excel file. Save it as .xlsx (or CSV) and try again."); }
    const wbPath = "xl/workbook.xml", wb = zip.file(wbPath); if (!wb) throw new Error("That isn't a readable Excel file. Save it as .xlsx (or CSV) and try again.");
    const first = kids(xml(await wb.async("text")), "sheet")[0];
    const rid = first?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") || first?.getAttribute("r:id") || "";
    const sheetPath = (await relsOf(zip, wbPath)).get(rid) || "xl/worksheets/sheet1.xml";
    const sst = zip.file("xl/sharedStrings.xml") ? kids(xml(await zip.file("xl/sharedStrings.xml")!.async("text")), "si").map((si) => kids(si, "t").map((t) => t.textContent || "").join("")) : [];
    const sx = xml(await zip.file(sheetPath)!.async("text"));
    for (const r of kids(sx, "row")) {
      const n = +(r.getAttribute("r") || rows.length + 1) - 1, row: string[] = [];
      for (const c of kids(r, "c")) {
        const t = c.getAttribute("t"), v = kids(c, "v")[0]?.textContent ?? "";
        row[colIndex(c.getAttribute("r") || "A")] = t === "s" ? sst[+v] ?? "" : t === "inlineStr" ? kids(c, "t").map((x) => x.textContent).join("") : t === "b" ? (v === "1" ? "Yes" : "No") : v;
      }
      rows[n] = Array.from(row, (x) => (x ?? "").trim());
    }
    // Pictures placed over the sheet: the row each one starts on.
    const drawing = kids(sx, "drawing")[0], drid = drawing?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") || drawing?.getAttribute("r:id");
    const dPath = drid ? (await relsOf(zip, sheetPath)).get(drid) : null;
    if (dPath && zip.file(dPath)) {
      const dx = xml(await zip.file(dPath)!.async("text")), drels = await relsOf(zip, dPath);
      for (const anchor of [...kids(dx, "twoCellAnchor"), ...kids(dx, "oneCellAnchor")]) {
        const from = kids(anchor, "from")[0], row = +(kids(from, "row")[0]?.textContent || 0), col = +(kids(from, "col")[0]?.textContent || 0);
        const blip = kids(anchor, "blip")[0], emb = blip?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "embed") || blip?.getAttribute("r:embed");
        const media = emb && drels.get(emb); const f = media && zip.file(media);
        if (!f || !/\.(png|jpe?g|gif|webp|bmp)$/i.test(media!)) continue;
        try { pics.push({ page: row + 1, blob: await shrink(new Blob([await f.async("arraybuffer")]), 1600), x: col, y: 0 }); } catch { /* not a picture the browser can open */ }
      }
    }
  }
  rows = Array.from(rows, (r) => r || []);
  const headAt = rows.findIndex((r) => r.filter(Boolean).length >= 2);
  if (headAt < 0) throw new Error("That sheet has no table to read. Put one product per row, with a heading row on top.");
  const head = rows[headAt].map((h, i) => h || `Column ${i + 1}`);
  // Each product row becomes a "page" numbered by its row in the sheet, so pictures on that row go with it.
  const pages: PamphletPage[] = [];
  for (let i = headAt + 1; i < rows.length && pages.length < MAX_ROWS; i++) {
    const r = rows[i]; if (!r.some(Boolean)) continue;
    pages.push({ n: i + 1, text: head.map((h, k) => (r[k] ? `${h}: ${r[k]}` : "")).filter(Boolean).join(" | ") });
  }
  if (!pages.length) throw new Error("That sheet has a heading row but no products under it.");
  pics.sort((a, b) => a.page - b.page || a.x - b.x);
  return { kind: "sheet", pages, pics, photo: async (n) => pics.find((p) => p.page === n)?.blob || null, close() {} };
}

/** What the AI reads: text pages with markers, and pictures of the pages without text. */
export const pamphletInput = (p: Pamphlet) => ({
  text: p.pages.filter((x) => x.text).map((x) => `--- PAGE ${x.n} ---\n${x.text}`).join("\n\n"),
  images: p.pages.filter((x) => x.image).map((x) => ({ page: x.n, data: x.image! })),
  ...(p.kind === "sheet" ? { hint: "This is a spreadsheet: each --- PAGE n --- block is one row (row n of the sheet), one product per row. Use the row number as the product's page." } : {}),
});

/** A first guess at each product's picture: on each page, the products in order take that page's pictures in
 *  order (top to bottom, left to right). Index into `pics`, or -1. */
export function guessPics(products: { page: number }[], pics: PamphletPic[]): number[] {
  const used = new Map<number, number>();
  return products.map((p) => {
    const k = used.get(p.page) || 0; used.set(p.page, k + 1);
    const onPage = pics.map((x, i) => (x.page === p.page ? i : -1)).filter((i) => i >= 0);
    return onPage[k] ?? -1;
  });
}
