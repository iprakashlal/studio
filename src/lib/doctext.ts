// The words inside a document someone already has (PDF, Word, Excel, CSV or plain text), read on their own device:
// nothing is uploaded to be read. Used by Design yourself to fill in the answers from a file.
import JSZip from "jszip";
import { pdfLines } from "./pdftext";

/** What can be read, for the file chooser and for the message when something else is chosen. */
export const DOC_ACCEPT = ".pdf,.docx,.xlsx,.csv,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain";
export const DOC_KINDS = "PDF, Word (.docx), Excel (.xlsx), CSV or text";
export const DOC_MAX_MB = 50;

const ent = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_m, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, "&");
const tidy = (s: string) => s.replace(/[ \t ]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();

/** Word: each paragraph on its own line; a table row's cells on one line. */
async function docx(buf: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf), main = zip.file("word/document.xml");
  if (!main) throw new Error("That Word file has no text the Studio can read.");
  const xml = await main.async("string");
  return tidy(ent(xml.replace(/<w:tab\b[^>]*\/>/g, " ").replace(/<w:br\b[^>]*\/>/g, "\n").replace(/<\/w:tc>/g, " | ").replace(/<\/w:tr>/g, "\n").replace(/<\/w:p>/g, "\n").replace(/<[^>]+>/g, "")).replace(/( \| )+\n/g, "\n").replace(/ \| *$/gm, ""));
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
      if (cells.length === 2 && !/[:：]$/.test(cells[0])) out.push(`${cells[0]}: ${cells[1]}`);
      else if (cells.length) out.push(cells.join(cells.length === 2 ? " " : " | "));
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
  if (/\.(csv|txt|md)$/.test(name) || /^text\//.test(f.type)) return tidy((await f.text()).split("\n").map((l) => { const c = l.split(/\t|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((x) => x.trim().replace(/^"|"$/g, "")).filter(Boolean); return c.length === 2 ? `${c[0]}: ${c[1]}` : c.join(" | "); }).join("\n"));
  throw new Error(`The Studio can't read that kind of file. Choose a ${DOC_KINDS} file.`);
}
