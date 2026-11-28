// Report files made on this device, with no outside library: an Excel workbook (several sheets), CSV files in a ZIP, and a
// PDF (A4, its own small writer: Helvetica, tables that carry over pages with their headings, a line chart, page numbers).
import JSZip from "jszip";

export type Cell = string | number;
export type Sheet = { name: string; title?: string; note?: string; head: string[]; rows: Cell[][]; /** Column widths in characters. */ widths?: number[] };

// ---------------------------------------------------------------- Excel
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
const col = (i: number) => { let s = ""; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
const sheetName = (n: string, used: Set<string>) => { let b = n.replace(/[\\/?*[\]:]/g, " ").slice(0, 31).trim() || "Sheet", x = b, i = 2; while (used.has(x.toLowerCase())) x = (b.slice(0, 28) + " " + i++).trim(); used.add(x.toLowerCase()); return x; };

/** A workbook: each sheet has an optional title and note above a header row (bold, shaded, frozen, with a filter). */
export async function xlsxBook(sheets: Sheet[], meta: { title: string; author: string }): Promise<Blob> {
  const zip = new JSZip(), used = new Set<string>(), names = sheets.map((s) => sheetName(s.name, used));
  // Styles: 0 plain · 1 title · 2 note · 3 header · 4 number · 5 percent-like text right · 6 bold number (totals)
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0"/></numFmts><fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="15"/><color rgb="FF1F2A44"/><name val="Calibri"/></font><font><i/><sz val="10"/><color rgb="FF6B7280"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF3B4FD8"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFD7DBE6"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="7"><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="3" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="right"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  sheets.forEach((s, si) => {
    const out: string[] = []; let r = 0;
    const row = (cells: string) => { r++; out.push(`<row r="${r}">${cells}</row>`); };
    const str = (c: number, v: string, st: number) => `<c r="${col(c)}${r + 1}" t="inlineStr" s="${st}"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
    const num = (c: number, v: number, st: number) => `<c r="${col(c)}${r + 1}" s="${st}"><v>${Number.isFinite(v) ? v : 0}</v></c>`;
    if (s.title) row(str(0, s.title, 1));
    if (s.note) row(str(0, s.note, 2));
    if (s.title || s.note) row("");
    const headAt = r + 1; row(s.head.map((h, c) => str(c, h, 3)).join(""));
    for (const x of s.rows) row(x.map((v, c) => (typeof v === "number" ? num(c, v, 4) : /^[-+]?\d+(\.\d+)?%$|^[▲▼•]/.test(String(v)) ? str(c, String(v), 5) : str(c, String(v ?? ""), 0))).join(""));
    const w = s.head.map((h, c) => Math.min(60, Math.max(8, s.widths?.[c] ?? Math.max(h.length + 2, ...s.rows.slice(0, 200).map((x) => String(x[c] ?? "").length + 2)))));
    const last = `${col(Math.max(0, s.head.length - 1))}${headAt + s.rows.length}`;
    zip.file(`xl/worksheets/sheet${si + 1}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"${si === 0 ? ' tabSelected="1"' : ""}><pane ySplit="${headAt}" topLeftCell="A${headAt + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${w.map((x, i) => `<col min="${i + 1}" max="${i + 1}" width="${x}" customWidth="1"/>`).join("")}</cols><sheetData>${out.join("")}</sheetData>${s.rows.length ? `<autoFilter ref="A${headAt}:${last}"/>` : ""}</worksheet>`);
  });
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`);
  zip.file("docProps/core.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(meta.title)}</dc:title><dc:creator>${esc(meta.author)}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created></cp:coreProperties>`);
  zip.file("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets><definedNames>${sheets.map((s, i) => { if (!s.rows.length) return ""; const h = (s.title ? 1 : 0) + (s.note ? 1 : 0) + (s.title || s.note ? 1 : 0) + 1; return `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${esc(names[i]).replace(/'/g, "''")}'!$A$${h}:$${col(s.head.length - 1)}$${h + s.rows.length}</definedName>`; }).join("")}</definedNames></workbook>`);
  zip.file("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  zip.file("xl/styles.xml", styles);
  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

// ---------------------------------------------------------------- CSV
const csvCell = (v: Cell) => { const s = String(v ?? ""); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export const csvOf = (s: Sheet) => "﻿" + [s.head, ...s.rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
/** One CSV file per table, together in a ZIP. */
export async function csvZip(sheets: Sheet[]): Promise<Blob> {
  const zip = new JSZip(), used = new Set<string>();
  sheets.forEach((s, i) => zip.file(`${String(i + 1).padStart(2, "0")} ${sheetName(s.name, used).replace(/[^\w .()-]+/g, "")}.csv`, csvOf(s)));
  return zip.generateAsync({ type: "blob" });
}

// ---------------------------------------------------------------- PDF
export type PdfBlock =
  | { t: "cover"; title: string; lines: string[]; brand: string }
  | { t: "h1"; text: string } | { t: "h2"; text: string } | { t: "p"; text: string }
  | { t: "kpis"; items: { label: string; value: string; sub?: string; good?: boolean | null }[] }
  | { t: "table"; head: string[]; rows: Cell[][]; align?: ("l" | "r")[]; widths?: number[] }
  | { t: "chart"; title: string; labels: string[]; series: { name: string; values: number[]; color: [number, number, number]; dash?: boolean }[] }
  | { t: "bars"; title: string; labels: string[]; values: number[] }
  | { t: "break" };

// Helvetica and Helvetica-Bold widths for characters 32–126 (per 1000).
const HW = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const BW = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
/** Text as the PDF's standard fonts can draw it (Latin letters): the rupee sign as "Rs ", accents dropped, the rest as "?". */
const latin = (s: string) => String(s ?? "").replace(/₹\s?/g, "Rs ").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/…/g, "...").replace(/[▲]/g, "+").replace(/[▼]/g, "-").replace(/•/g, "-").replace(/[^\x20-\x7e\xa0-\xff]/g, (ch) => ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7e]/g, "?"));
const widthOf = (s: string, size: number, bold = false) => { const W = bold ? BW : HW; let w = 0; for (const ch of s) { const c = ch.charCodeAt(0); w += c >= 32 && c <= 126 ? W[c - 32] : 556; } return (w * size) / 1000; };
const fit = (s: string, max: number, size: number, bold = false) => { s = latin(s); if (widthOf(s, size, bold) <= max) return s; while (s.length > 1 && widthOf(s + "...", size, bold) > max) s = s.slice(0, -1); return s + "..."; };
const wrap = (s: string, max: number, size: number, bold = false) => { const out: string[] = []; let line = ""; for (const w of latin(s).split(/\s+/)) { const t = line ? line + " " + w : w; if (widthOf(t, size, bold) > max && line) { out.push(line); line = w; } else line = t; } if (line) out.push(line); return out; };
const pdfStr = (s: string) => "(" + s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)") + ")";

/** An A4 report: blocks flow down the pages, tables carry their headings over to the next page; a footer on every page. */
export function pdfDoc(blocks: PdfBlock[], meta: { title: string; footer: string; accent?: [number, number, number] }): Blob {
  const PW = 595.28, PH = 841.89, M = 44, CW = PW - 2 * M, A = meta.accent || [59, 79, 216];
  const pages: string[][] = []; let ops: string[] = [], y = 0;
  const rgb = (c: [number, number, number], fill = true) => `${(c[0] / 255).toFixed(3)} ${(c[1] / 255).toFixed(3)} ${(c[2] / 255).toFixed(3)} ${fill ? "rg" : "RG"}`;
  const text = (x: number, yy: number, s: string, size: number, bold = false, c: [number, number, number] = [20, 26, 44]) => ops.push(`BT ${rgb(c)} /${bold ? "F2" : "F1"} ${size} Tf ${x.toFixed(2)} ${yy.toFixed(2)} Td ${pdfStr(latin(s))} Tj ET`);
  const rtext = (x: number, yy: number, s: string, size: number, bold = false, c?: [number, number, number]) => text(x - widthOf(latin(s), size, bold), yy, s, size, bold, c);
  const rect = (x: number, yy: number, w: number, h: number, c: [number, number, number]) => ops.push(`${rgb(c)} ${x.toFixed(2)} ${yy.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
  const line = (x1: number, y1: number, x2: number, y2: number, c: [number, number, number], w = 0.6, dash = false) => ops.push(`${rgb(c, false)} ${w} w ${dash ? "[3 2] 0 d" : "[] 0 d"} ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
  const page = () => { ops = []; pages.push(ops); y = PH - M; };
  const need = (h: number) => { if (y - h < M + 24) page(); };
  page();
  for (const b of blocks) {
    if (b.t === "break") { if (y < PH - M - 1) page(); continue; }
    if (b.t === "cover") {
      rect(0, PH - 260, PW, 260, A);
      text(M, PH - 70, b.brand, 12, true, [255, 255, 255]);
      let yy = PH - 140; for (const l of wrap(b.title, CW, 28, true)) { text(M, yy, l, 28, true, [255, 255, 255]); yy -= 34; }
      y = PH - 300; for (const l of b.lines) { if (!l) { y -= 8; continue; } text(M, y, l, 11.5, false, [55, 65, 81]); y -= 18; }
      y -= 12; continue;
    }
    if (b.t === "h1") { need(60); y -= 8; text(M, y - 18, b.text, 18, true); y -= 30; line(M, y, M + CW, y, A, 1.4); y -= 16; continue; }
    if (b.t === "h2") { need(40); text(M, y - 12, b.text, 12.5, true, A); y -= 24; continue; }
    if (b.t === "p") { for (const l of wrap(b.text, CW, 9.5)) { need(14); text(M, y - 10, l, 9.5, false, [75, 85, 99]); y -= 13; } y -= 6; continue; }
    if (b.t === "kpis") {
      const per = 4, gap = 8, w = (CW - gap * (per - 1)) / per, h = 54;
      for (let i = 0; i < b.items.length; i += per) {
        need(h + gap);
        b.items.slice(i, i + per).forEach((k, j) => {
          const x = M + j * (w + gap); rect(x, y - h, w, h, [244, 246, 251]); rect(x, y - h, 3, h, A);
          text(x + 10, y - 15, fit(k.label.toUpperCase(), w - 16, 7.5, true), 7.5, true, [107, 114, 128]);
          text(x + 10, y - 34, fit(k.value, w - 16, 16, true), 16, true);
          if (k.sub) text(x + 10, y - 47, fit(k.sub, w - 16, 7.5), 7.5, false, k.good === true ? [5, 150, 105] : k.good === false ? [220, 38, 38] : [107, 114, 128]);
        });
        y -= h + gap;
      }
      y -= 6; continue;
    }
    if (b.t === "table") {
      const n = b.head.length, size = n > 7 ? 7.6 : 8.6, rh = size + 8;
      const want = b.widths || b.head.map((h, c) => Math.max(widthOf(latin(h), size, true), ...b.rows.slice(0, 60).map((r) => widthOf(latin(String(r[c] ?? "")), size))) + 12);
      const sum = want.reduce((a, x) => a + x, 0), ws = want.map((x) => (x / sum) * CW);
      const align = b.align || b.head.map((_, c) => (b.rows.some((r) => typeof r[c] === "number") ? "r" : "l"));
      const head = () => { rect(M, y - rh, CW, rh, A); let x = M; b.head.forEach((h, c) => { const s = fit(h, ws[c] - 8, size, true); if (align[c] === "r") rtext(x + ws[c] - 5, y - rh + 5.2, s, size, true, [255, 255, 255]); else text(x + 5, y - rh + 5.2, s, size, true, [255, 255, 255]); x += ws[c]; }); y -= rh; };
      need(rh * 3); head();
      if (!b.rows.length) { text(M + 5, y - rh + 5, "Nothing in this period.", size, false, [107, 114, 128]); y -= rh; }
      b.rows.forEach((r, i) => {
        if (y - rh < M + 24) { page(); head(); }
        if (i % 2) rect(M, y - rh, CW, rh, [247, 248, 252]);
        let x = M; r.forEach((v, c) => { const s = fit(typeof v === "number" ? v.toLocaleString("en-IN") : String(v ?? ""), ws[c] - 8, size); if (align[c] === "r") rtext(x + ws[c] - 5, y - rh + 5.2, s, size); else text(x + 5, y - rh + 5.2, s, size); x += ws[c]; });
        y -= rh;
      });
      line(M, y, M + CW, y, [215, 219, 230]); y -= 14; continue;
    }
    if (b.t === "chart") {
      const h = 150; need(h + 40);
      text(M, y - 11, b.title, 10.5, true); y -= 20;
      const top = y, bot = y - h, max = Math.max(4, ...b.series.flatMap((s) => s.values)), n = Math.max(1, b.labels.length - 1), X = (i: number) => M + 30 + (b.labels.length === 1 ? (CW - 30) / 2 : (i / n) * (CW - 30)), Y = (v: number) => bot + (v / max) * (h - 8);
      [0, 0.5, 1].forEach((f) => { line(M + 30, Y(max * f), M + CW, Y(max * f), [226, 230, 238], 0.5, f > 0); rtext(M + 26, Y(max * f) - 3, Math.round(max * f).toLocaleString("en-IN"), 7, false, [107, 114, 128]); });
      for (const s of b.series) { for (let i = 1; i < s.values.length; i++) line(X(i - 1), Y(s.values[i - 1]), X(i), Y(s.values[i]), s.color, 1.6, !!s.dash); }
      const step = Math.max(1, Math.ceil(b.labels.length / 8)); b.labels.forEach((l, i) => { if (i % step === 0 || i === b.labels.length - 1) text(X(i) - widthOf(latin(l), 7) / 2, bot - 11, l, 7, false, [107, 114, 128]); });
      let lx = M + 30; for (const s of b.series) { line(lx, top + 2, lx + 14, top + 2, s.color, 2, !!s.dash); text(lx + 18, top - 1, s.name, 7.5, false, [75, 85, 99]); lx += 30 + widthOf(s.name, 7.5); }
      y = bot - 26; continue;
    }
    if (b.t === "bars") {
      const h = 110; need(h + 40); text(M, y - 11, b.title, 10.5, true); y -= 20;
      const bot = y - h, max = Math.max(1, ...b.values), bw = (CW - 30) / Math.max(1, b.values.length);
      b.values.forEach((v, i) => { const bh = (v / max) * (h - 14); rect(M + 30 + i * bw + bw * 0.15, bot, bw * 0.7, bh, A); });
      const step = Math.max(1, Math.ceil(b.labels.length / 12)); b.labels.forEach((l, i) => { if (i % step === 0) text(M + 30 + i * bw + bw / 2 - widthOf(latin(l), 7) / 2, bot - 11, l, 7, false, [107, 114, 128]); });
      rtext(M + 26, bot + h - 17, max.toLocaleString("en-IN"), 7, false, [107, 114, 128]);
      y = bot - 24; continue;
    }
  }
  // Footer on every page: what it is, and the page number.
  pages.forEach((o, i) => { ops = o; line(M, M - 4, M + CW, M - 4, [226, 230, 238], 0.5); text(M, M - 16, fit(meta.footer, CW - 80, 7.5), 7.5, false, [107, 114, 128]); rtext(M + CW, M - 16, `Page ${i + 1} of ${pages.length}`, 7.5, false, [107, 114, 128]); });
  // The file: catalog, pages, two fonts, one content stream per page.
  const objs: string[] = [], add = (s: string) => { objs.push(s); return objs.length; };
  const cat = add(""), pagesId = add(""), f1 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"), f2 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const kids: number[] = [];
  for (const o of pages) { const body = o.join("\n"), c = add(`<< /Length ${body.length} >>\nstream\n${body}\nendstream`); kids.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${c} 0 R >>`)); }
  objs[cat - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objs[pagesId - 1] = `<< /Type /Pages /Kids [${kids.map((k) => k + " 0 R").join(" ")}] /Count ${kids.length} >>`;
  const info = add(`<< /Title ${pdfStr(latin(meta.title))} /Producer (Site Studio) /CreationDate (D:${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}) >>`);
  let out = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"; const at: number[] = [];
  objs.forEach((o, i) => { at.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${at.map((n) => String(n).padStart(10, "0") + " 00000 n \n").join("")}trailer\n<< /Size ${objs.length + 1} /Root ${cat} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const bytes = new Uint8Array(out.length); for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
  return new Blob([bytes], { type: "application/pdf" });
}
