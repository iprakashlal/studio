// The words inside a document someone already has (PDF, Word, Excel, CSV or plain text), read on their own device:
// nothing is uploaded to be read. Used by Design yourself to fill in the answers from a file.
import JSZip from "jszip";
import { pdfLines, pdfBase } from "./pdftext";
import { rowsOf, type DocRow } from "./docread";

/** What can be read, for the file chooser and for the message when something else is chosen. */
export const DOC_ACCEPT = ".pdf,.docx,.xlsx,.csv,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain";
export const DOC_KINDS = "PDF, Word (.docx), Excel (.xlsx), CSV or text";
export const DOC_MAX_MB = 50;

const ent = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_m, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, "&");
const tidy = (s: string) => s.replace(/[ \u00a0]+/g, " ").replace(/ *\t */g, "\t").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();

/** Word: each paragraph on its own line; a table row's cells on one line. */
async function docx(buf: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf), main = zip.file("word/document.xml");
  if (!main) throw new Error("That Word file has no text the Studio can read.");
  const xml = await main.async("string");
  return tidy(ent(xml.replace(/<w:tab\b[^>]*\/>/g, " ").replace(/<w:br\b[^>]*\/>/g, "\n").replace(/<\/w:tc>/g, "\t").replace(/<\/w:tr>/g, "\n").replace(/<\/w:p>/g, "\n").replace(/<[^>]+>/g, "")).replace(/\t+\n/g, "\n").replace(/\t+$/gm, ""));
}
/** Excel: every sheet's rows. A row of two filled cells reads as "Label: value" (how details are usually listed); longer rows are joined with " | ". */
async function xlsx(buf: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const shared: string[] = []; const ss = zip.file("xl/sharedStrings.xml");
  if (ss) for (const m of (await ss.async("string")).matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) shared.push(ent([...m[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join("")));
  const sheets = Object.keys(zip.files).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort((a, b) => +a.replace(/\D/g, "") - +b.replace(/\D/g, "")).slice(0, 8);
  if (!sheets.length) throw new Error("That Excel file has no sheets the Studio can read.");
  const out: string[] = [];
  for (const name of sheets) {
    const xml = await zip.file(name)!.async("string"); let rows = 0;
    for (const r of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      if (++rows > 2000) break;
      const cells: string[] = [];
      for (const c of r[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const t = /\bt="(\w+)"/.exec(c[1])?.[1], body = c[2] || "";
        const v = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? "", inl = [...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join("");
        const val = (t === "s" ? shared[+v] ?? "" : t === "inlineStr" ? ent(inl) : ent(v)).trim();
        if (val) cells.push(val);
      }
      if (cells.length) out.push(cells.join("\t"));
    }
    out.push("");
  }
  return tidy(out.join("\n"));
}
/** The text of a chosen file. Throws a plain-words reason when it can't be read. */
export async function fileText(f: File): Promise<string> {
  if (f.size > DOC_MAX_MB * 1024 * 1024) throw new Error(`That file is over ${DOC_MAX_MB} MB. Please choose a smaller one.`);
  const name = f.name.toLowerCase(), head = new Uint8Array(await f.slice(0, 8).arrayBuffer()), sig = String.fromCharCode(...head.slice(0, 4));
  if (sig === "%PDF" || name.endsWith(".pdf")) return (await pdfLines(f)).join("\n");
  if (head[0] === 0xd0 && head[1] === 0xcf) throw new Error("That is an older Word or Excel file (.doc or .xls). Open it and save it as .docx or .xlsx, or as a PDF, then choose it again.");
  if (sig.startsWith("PK")) {
    const buf = await f.arrayBuffer();
    if (name.endsWith(".xlsx")) return xlsx(buf);
    if (name.endsWith(".docx")) return docx(buf);
    const zip = await JSZip.loadAsync(buf).catch(() => null);
    if (zip?.file("word/document.xml")) return docx(buf);
    if (zip?.file("xl/workbook.xml")) return xlsx(buf);
    throw new Error(`The Studio can't read that kind of file. Choose a ${DOC_KINDS} file.`);
  }
  // A CSV's commas separate cells; in notes (.txt) a comma is just a comma.
  if (/\.csv$/.test(name) || f.type === "text/csv") return tidy((await f.text()).split("\n").map((l) => l.split(/\t|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((x) => x.trim().replace(/^"|"$/g, "")).filter(Boolean).join("\t")).join("\n"));
  if (/\.(txt|md)$/.test(name) || /^text\//.test(f.type)) return tidy(await f.text());
  throw new Error(`The Studio can't read that kind of file. Choose a ${DOC_KINDS} file.`);
}

// ---------------------------------------------------------------- the whole document: rows of cells, and its pictures
/** A picture found in the document (made small), and where it was (a PDF), so it can be paired with the item beside it. */
export type DocPic = { url: string; page?: number; y?: number };
export type DocFile = { rows: DocRow[]; pics: DocPic[] };
const MAX_PICS = 24;

/** A picture made small enough to keep (JPEG, at most 900px on its long side). */
async function small(src: ImageBitmap | HTMLCanvasElement | HTMLImageElement, w: number, h: number): Promise<string> {
  if (w < 80 || h < 80) return "";   // an icon, a rule or a bullet: not a photograph
  const k = Math.min(1, 900 / Math.max(w, h)), c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
  const g = c.getContext("2d")!; g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(src as any, 0, 0, c.width, c.height);
  let q = 0.82, u = c.toDataURL("image/jpeg", q); while (u.length > 160_000 && q > 0.45) { q -= 0.1; u = c.toDataURL("image/jpeg", q); }
  return u.length <= 220_000 ? u : "";
}
async function fromBytes(bytes: Uint8Array, type: string): Promise<string> {
  try { const bmp = await createImageBitmap(new Blob([bytes as any], { type })); const u = await small(bmp, bmp.width, bmp.height); bmp.close?.(); return u; } catch { return ""; }
}
/** A PDF: each line as cells (a wide gap starts a new cell, so table columns stay apart), and the pictures with their place on the page. */
async function pdfDoc(f: File): Promise<DocFile> {
  const load = new Function("u", "return import(u)") as (u: string) => Promise<any>, base = pdfBase();
  let pdfjs: any; try { pdfjs = await load(new URL("pdf.min.js", base).href); } catch { throw new Error("The PDF reader didn't load. Check your connection and try again."); }
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdf.worker.min.js", base).href;
  let doc: any; try { doc = await pdfjs.getDocument({ data: new Uint8Array(await f.arrayBuffer()), isEvalSupported: false }).promise; } catch (e: any) { throw new Error(/password/i.test(e?.name + e?.message) ? "This PDF is password-protected. Save a copy without a password and choose that." : "This file isn't a readable PDF."); }
  const rows: DocRow[] = [], pics: DocPic[] = [];
  for (let p = 1; p <= Math.min(doc.numPages, 40); p++) {
    const page = await doc.getPage(p), vp = page.getViewport({ scale: 1 }), tc = await page.getTextContent();
    type Run = { x: number; end: number; y: number; size: number; text: string };
    const runs: Run[] = [];
    for (const it of tc.items as any[]) { const t = String(it.str || ""); if (!t.trim()) continue; const size = Math.abs(it.transform[3]) || Math.abs(it.transform[0]) || 10; runs.push({ x: it.transform[4], end: it.transform[4] + (it.width || 0), y: vp.height - it.transform[5], size, text: t }); }
    runs.sort((a, b) => a.y - b.y || a.x - b.x);
    const lines: Run[][] = [];
    for (const r of runs) { const l = lines[lines.length - 1]; if (l && Math.abs(l[0].y - r.y) <= Math.max(2, Math.min(l[0].size, r.size) * 0.45)) l.push(r); else lines.push([r]); }
    let prev: { x: number }[] = [];
    for (const l0 of lines) {
      const l = l0.sort((a, b) => a.x - b.x), cells: { x: number; t: string }[] = [];
      for (let i = 0; i < l.length; i++) {
        const gap = i ? l[i].x - l[i - 1].end : 0, c = cells[cells.length - 1];
        if (!i || gap > Math.max(14, l[i].size * 1.4)) cells.push({ x: l[i].x, t: l[i].text });
        else c.t += (gap > l[i].size * 0.18 && !/\s$/.test(c.t) && !/^\s/.test(l[i].text) ? " " : "") + l[i].text;
      }
      const last = rows[rows.length - 1];
      // A cell that wraps: a lone piece of text starting where the row above's last cell started continues that cell.
      if (last && last.page === p && cells.length === 1 && prev.length >= 2 && Math.abs(cells[0].x - prev[prev.length - 1].x) <= 3) { const lc = last.cells; lc[lc.length - 1] += (lc[lc.length - 1].endsWith("-") ? "" : " ") + cells[0].t.trim(); continue; }
      const out = cells.map((c) => c.t.replace(/\s+/g, " ").trim()).filter(Boolean); if (!out.length) continue;
      rows.push({ cells: out, page: p, y: l[0].y }); prev = cells.map((c) => ({ x: c.x }));
    }
    // Pictures, with where they sit: the drawing commands are replayed far enough to know each picture's place.
    if (pics.length < MAX_PICS) try {
      const ops = await page.getOperatorList(), O = pdfjs.OPS; let m = [1, 0, 0, 1, 0, 0]; const stack: number[][] = [];
      const mul = (a: number[], b: number[]) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
      for (let i = 0; i < ops.fnArray.length && pics.length < MAX_PICS; i++) {
        const fn = ops.fnArray[i], args = ops.argsArray[i];
        if (fn === O.save) stack.push(m.slice()); else if (fn === O.restore) m = stack.pop() || m; else if (fn === O.transform) m = mul(m, args);
        else if (fn === O.paintImageXObject || fn === O.paintInlineImageXObject) {
          // A picture may still be decoding when its command is read: wait for it (a few seconds at most).
          let img: any = null;
          if (typeof args[0] !== "string") img = args[0];
          else img = await new Promise<any>((res) => { const from = args[0].startsWith("g_") ? page.commonObjs : page.objs; const t = setTimeout(() => res(null), 4000); try { from.get(args[0], (o: any) => { clearTimeout(t); res(o); }); } catch { clearTimeout(t); res(null); } });
          if (!img) continue;
          const w = img.width, h = img.height; let url = "";
          if (img.bitmap) url = await small(img.bitmap, w, h);
          else if (img.data && w && h) { const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d")!, id = g.createImageData(w, h), d = img.data, n = w * h; if (d.length === n * 4) id.data.set(d); else if (d.length === n * 3) for (let k = 0; k < n; k++) { id.data[k * 4] = d[k * 3]; id.data[k * 4 + 1] = d[k * 3 + 1]; id.data[k * 4 + 2] = d[k * 3 + 2]; id.data[k * 4 + 3] = 255; } else continue; g.putImageData(id, 0, 0); url = await small(c, w, h); }
          if (url) pics.push({ url, page: p, y: vp.height - (m[5] + m[3] / 2) });
        }
      }
    } catch { /* the words are enough */ }
  }
  return { rows, pics };
}
/** The pictures inside a Word or Excel file, in the order they are kept. */
async function zipPics(zip: JSZip, folder: string): Promise<DocPic[]> {
  const n$ = (x: string) => +(/(\d+)\.\w+$/.exec(x)?.[1] || 0);
  const names = Object.keys(zip.files).filter((n) => n.startsWith(folder) && /\.(png|jpe?g|webp|gif)$/i.test(n)).sort((a, b) => n$(a) - n$(b)).slice(0, MAX_PICS), out: DocPic[] = [];
  for (const n of names) { const u = await fromBytes(await zip.file(n)!.async("uint8array"), /png$/i.test(n) ? "image/png" : /webp$/i.test(n) ? "image/webp" : /gif$/i.test(n) ? "image/gif" : "image/jpeg"); if (u) out.push({ url: u }); }
  return out;
}
/** A chosen file as rows of cells, with its pictures. Throws a plain-words reason when it can't be read. */
export async function fileDoc(f: File): Promise<DocFile> {
  if (f.size > DOC_MAX_MB * 1024 * 1024) throw new Error(`That file is over ${DOC_MAX_MB} MB. Please choose a smaller one.`);
  const name = f.name.toLowerCase(), head = new Uint8Array(await f.slice(0, 8).arrayBuffer()), sig = String.fromCharCode(...head.slice(0, 4));
  if (sig === "%PDF" || name.endsWith(".pdf")) return pdfDoc(f);
  const text = await fileText(f); let pics: DocPic[] = [];
  if (sig.startsWith("PK")) try { const zip = await JSZip.loadAsync(await f.arrayBuffer()); pics = await zipPics(zip, zip.file("word/document.xml") ? "word/media/" : "xl/media/"); } catch { /* the words are enough */ }
  return { rows: rowsOf(text), pics };
}

/** Which picture goes with which item: in a PDF the one beside it on the page; otherwise in order, when there is one for each.
 *  per: a picture for each item ("" where none); rest: the pictures that belong to no item. */
export function pairPics(items: { page?: number; y?: number; img?: string }[], pics: DocPic[]): { per: string[]; rest: string[] } {
  const used = new Set<number>(), per = items.map(() => "");
  const placed = pics.some((x) => x.y !== undefined) && items.some((i) => i.y !== undefined);
  if (placed) items.forEach((it, i) => { let best = -1, d = 110; pics.forEach((x, j) => { if (used.has(j) || x.page !== it.page || x.y === undefined || it.y === undefined) return; const dy = Math.abs(x.y - (it.y + 18)); if (dy < d) { d = dy; best = j; } }); if (best >= 0) { used.add(best); per[i] = pics[best].url; } });
  else if (items.length && pics.length >= items.length) { const skip = pics.length - items.length; items.forEach((_it, i) => { per[i] = pics[skip + i].url; used.add(skip + i); }); }
  return { per, rest: pics.filter((_x, j) => !used.has(j)).map((x) => x.url) };
}
