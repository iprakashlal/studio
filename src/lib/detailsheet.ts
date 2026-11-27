// A details sheet: every DIY question for one kind of website as "Label: answer", so a person can fill it in once
// (a .txt, Word or Excel file) and upload it. The sheet is made from the questions themselves, and read back by the
// same labels, so the two can't drift apart. "*" marks an answer that must be filled in. A line starting with "#" is a note.
import JSZip from "jszip";
import { STEPS, isOptional, type Answers, type Step } from "./designer";
import type { DocRead, DocItem } from "./docread";

/** Asked after the upload instead (the type of business, the theme type and the look are chosen by tapping). */
const LATER = ["kind", "how", "doc", "colour", "style", "btype", "etype", "ptype", "genre", "menuhow", "logo"];
export const SHEET_KIND: Record<string, string> = { portfolio: "Portfolio", business: "Business", store: "Shop", restaurant: "Restaurant & café", events: "Event" };

/** The questions a sheet for this kind of website holds, in the order asked. */
export function sheetSteps(kind: string): Step[] {
  const seen = new Set<string>();
  return STEPS.filter((s) => (s.group === "basics" || s.group === kind) && s.type !== "file" && !LATER.includes(s.id) && !!s.label && !seen.has(norm(s.label)) && !!seen.add(norm(s.label)));
}
const norm = (l: string) => l.toLowerCase().replace(/\((mandatory|mandate|required|must|optional)\)/g, " ").replace(/[*:：]/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
const must = (s: Step, kind: string) => !isOptional(s, { kind, menuhow: "type" });
/** What to write for it, in a few words. */
function hintOf(s: Step, kind: string): string {
  const a: Answers = { kind }, opts = s.options?.(a) || [];
  if (s.type === "choice") return "One of: " + opts.map((o) => o.label).join(" / ");
  if (s.type === "many") return "Any of (commas between): " + opts.map((o) => o.label).join(", ");
  if (s.input === "date") return "A date, e.g. 14 March 2027";
  if (s.input === "time") return "A time, e.g. 10:00 AM";
  if (s.type === "long") return s.cols?.length ? `One on each line: ${s.cols.map((c) => c.label).join(" – ")}. E.g. ${s.cols.map((c) => c.ph || c.label).join(" – ")}` : (s.ph?.(a) || "").includes("\n") || /one on each line/i.test(s.ask(a)) ? `One on each line. E.g. ${(s.ph?.(a) || "").split("\n")[0].replace(/^e\.g\.\s*/i, "")}` : "A few lines, in your own words.";
  return (s.ph?.(a) || "").replace(/\n/g, " / ");
}
export type SheetRow = { label: string; must: boolean; hint: string; long: boolean };
export const sheetRows = (kind: string): SheetRow[] => sheetSteps(kind).map((s) => ({ label: s.label!, must: must(s, kind), hint: hintOf(s, kind), long: s.type === "long" }));
const head = (kind: string) => [`${SHEET_KIND[kind] || "Website"} website details`, "Fill in your answers. * means it must be filled in; leave the others empty if they don't apply.", "Lines that start with # are notes for you and are not read. Where it says one on each line, add as many lines as you need under the label.", "After you upload this, you only choose your type and look."];

// ---------------------------------------------------------------- the sheet as a file
export function sheetTxt(kind: string): string {
  const out = head(kind).map((l) => "# " + l); out.push("");
  for (const r of sheetRows(kind)) { if (r.hint) out.push("# " + r.hint); out.push(`${r.label}${r.must ? " *" : ""}: `, ""); }
  return out.join("\r\n");
}
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export async function sheetXlsx(kind: string): Promise<Blob> {
  const rows: string[][] = [...head(kind).map((l) => ["# " + l]), ["Label", "Your answer"]];
  for (const r of sheetRows(kind)) { if (r.hint) rows.push(["# " + r.hint]); rows.push([`${r.label}${r.must ? " *" : ""}`, ""]); if (r.long) rows.push([""], [""]); }
  const col = (i: number) => String.fromCharCode(65 + i);
  // Styles: 1 = a note (grey italics), 2 = a label (bold), 3 = a label that must be filled (bold, red).
  const xml = rows.map((r, i) => `<row r="${i + 1}">${r.map((c, j) => (c ? `<c r="${col(j)}${i + 1}" t="inlineStr" s="${c.startsWith("#") ? 1 : j === 0 ? (/\*$/.test(c) ? 3 : 2) : 0}"><is><t xml:space="preserve">${esc(c)}</t></is></c>` : "")).join("")}</row>`).join("");
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  zip.file("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Details" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  zip.file("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  zip.file("xl/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><i/><sz val="10"/><color rgb="FF6B7280"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFB91C1C"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top"/></xf><xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top"/></xf></cellXfs></styleSheet>`);
  zip.file("xl/worksheets/sheet1.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="34" customWidth="1"/><col min="2" max="2" width="70" customWidth="1" style="0"/></cols><sheetData>${xml}</sheetData></worksheet>`);
  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
export async function sheetDocx(kind: string): Promise<Blob> {
  const run = (t: string, o: { b?: boolean; i?: boolean; color?: string; sz?: number } = {}) => `<w:r><w:rPr>${o.b ? "<w:b/>" : ""}${o.i ? "<w:i/>" : ""}${o.color ? `<w:color w:val="${o.color}"/>` : ""}<w:sz w:val="${o.sz || 22}"/></w:rPr><w:t xml:space="preserve">${esc(t)}</w:t></w:r>`;
  const p = (inner: string, after = 80) => `<w:p><w:pPr><w:spacing w:after="${after}"/></w:pPr>${inner}</w:p>`;
  const cell = (inner: string, w: number) => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/></w:tcPr>${inner}</w:tc>`;
  const h = head(kind); let body = p(run(h[0], { b: true, sz: 32 }), 120) + h.slice(1).map((l) => p(run("# " + l, { i: true, color: "6B7280", sz: 20 }))).join("");
  const bd = `<w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map((k) => `<w:${k} w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>`).join("")}</w:tblBorders>`;
  // Each answer has its own small table (label | answer), with its note above: a note inside the table would be read as an answer.
  for (const r of sheetRows(kind)) {
    if (r.hint) body += p(run("# " + r.hint, { i: true, color: "6B7280", sz: 18 }), 40);
    body += `<w:tbl><w:tblPr><w:tblW w:w="9360" w:type="dxa"/>${bd}<w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="3000"/><w:gridCol w:w="6360"/></w:tblGrid><w:tr>${cell(p(run(r.label + (r.must ? " *" : ""), { b: true, color: r.must ? "B91C1C" : undefined }), 0), 3000)}${cell(p("", 0) + (r.long ? p("", 0) + p("", 0) : ""), 6360)}</w:tr></w:tbl>` + p("", 60);
  }
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1080" w:right="1440" w:bottom="1080" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`);
  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}

// ---------------------------------------------------------------- reading a filled sheet back
const pad = (n: number) => String(n).padStart(2, "0");
function dateOf(v: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const M = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  let m = /^(\d{1,2})(?:st|nd|rd|th)?[\s-]+([A-Za-z]{3,9})\.?,?[\s-]+(\d{4})$/.exec(v); if (m && M.indexOf(m[2].slice(0, 3).toLowerCase()) >= 0) return `${m[3]}-${pad(M.indexOf(m[2].slice(0, 3).toLowerCase()) + 1)}-${pad(+m[1])}`;
  m = /^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/.exec(v); if (m && M.indexOf(m[1].slice(0, 3).toLowerCase()) >= 0) return `${m[3]}-${pad(M.indexOf(m[1].slice(0, 3).toLowerCase()) + 1)}-${pad(+m[2])}`;
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(v); if (m && +m[2] <= 12) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;   // day first
  return "";
}
function timeOf(v: string): string {
  const m = /^(\d{1,2})(?:[:.](\d\d))?\s*(am|pm)?$/i.exec(v.trim()); if (!m) return ""; let h = +m[1]; if (h > 23 || +(m[2] || 0) > 59) return ""; let ap = (m[3] || "").toUpperCase();
  if (!ap) { ap = h >= 12 ? "PM" : "AM"; } if (h > 12) h -= 12; if (h === 0) h = 12; return `${h}:${m[2] || "00"} ${ap}`;   // as the time picker writes it
}
export type SheetRead = { /** How many of the sheet's labels were found (a sheet has most of them). */ labels: number; answers: Answers; /** Labels marked * that are empty. */ missing: string[]; /** Answers that could not be understood (a choice that isn't offered, a date). */ unclear: string[] };
/** rows: the file's lines as cells. Each label starts an answer; the lines under it (until the next label) continue it. */
export function readSheet(kind: string, rows: string[][]): SheetRead {
  const steps = sheetSteps(kind), by = new Map(steps.map((s) => [norm(s.label!), s])), got = new Map<Step, string[]>(); let cur: Step | null = null, labels = 0;
  for (const r0 of rows) {
    const r = r0.map((c) => c.trim()).filter(Boolean); if (!r.length || r[0].startsWith("#")) continue;
    let s = by.get(norm(r[0])), rest = r.slice(1);
    if (!s && r.length === 1) { const m = /^([^:：]{2,48})[:：]\s*(.*)$/.exec(r[0]); const t = m && by.get(norm(m[1])); if (t) { s = t; rest = m![2] ? [m![2]] : []; } }
    if (s) { cur = s; labels++; if (!got.has(s)) got.set(s, []); if (rest.join("").trim()) got.get(s)!.push(rest.join(" – ")); continue; }
    if (/^label$/i.test(r[0]) && /answer/i.test(r[1] || "")) continue;   // the table's own header row
    if (cur && (cur.type === "long" || !got.get(cur)!.length)) got.get(cur)!.push(r.join(" – "));
  }
  const answers: Answers = { kind }, unclear: string[] = [];
  for (const [s, lines] of got) {
    const raw = lines.join("\n").trim(); if (!raw) continue; const opts = s.options?.({ kind }) || [];
    const opt = (x: string) => { const n = norm(x); return n ? opts.find((o) => norm(o.label) === n || norm(o.v) === n) || opts.find((o) => norm(o.label).startsWith(n) || n.startsWith(norm(o.label))) : undefined; };
    if (s.type === "choice") { const o = opt(lines[0]); if (o) answers[s.id] = o.v; else unclear.push(`${s.label} (“${lines[0].slice(0, 40)}” is not one of: ${opts.map((x) => x.label).join(" / ")})`); }
    else if (s.type === "many") { const vs = raw.split(/[,\n;]+/).map((x) => opt(x)?.v).filter(Boolean); if (vs.length) answers[s.id] = [...new Set(vs)].join(","); else unclear.push(`${s.label}`); }
    else if (s.input === "date") { const d = dateOf(lines[0]); if (d) answers[s.id] = d; else unclear.push(`${s.label} (write it like 14 March 2027)`); }
    else if (s.input === "time") { const t = timeOf(lines[0]); if (t) answers[s.id] = t; else unclear.push(`${s.label} (write it like 10:00 AM)`); }
    else answers[s.id] = s.type === "long" ? raw : lines.join(" ");
  }
  const missing = steps.filter((s) => (!s.when || s.when(answers)) && must(s, kind) && !answers[s.id]).map((s) => s.label!);
  return { labels, answers, missing, unclear };
}

// ---------------------------------------------------------------- a filled sheet as a document (to fill a project)
/** A details sheet's answers as what a document says, so a project can be filled from it the same way as from any file. */
export function sheetToDoc(kind: string, a: Answers): DocRead {
  const f: Record<string, string> = {}, put = (k: string, v?: string) => { if (v && v.trim() && !f[k]) f[k] = v.trim(); };
  put("name", a.name); put("tagline", a.tagline); put("email", a.email); put("phone", a.phone); put("city", a.city); put("domain", a.domain);
  put("social", a.social && (/instagram\.com\/([\w.]+)/i.exec(a.social)?.[1] ? "@" + /instagram\.com\/([\w.]+)/i.exec(a.social)![1] : /^@/.test(a.social.trim()) ? a.social.trim() : ""));
  put("about", a.about); put("story", a.story || a.eabout); put("hours", a.hours); put("address", a.address || a.evenue); put("mission", a.mission); put("usp", a.usp || a.ehigh);
  if (kind === "restaurant" && a.outlets) { const l = a.outlets.split("\n").map((x) => x.split(/\s+[–—-]\s+/)).filter((x) => x.length >= 2).map((x) => `${x[0].trim()}: ${x.slice(1).join(", ").trim()}`); if (l.length) { put("address", l[0].split(": ").slice(1).join(": ")); if (l.length >= 2) f.places = l.join("\n"); } }
  let money = "";
  const items: DocItem[] = String(a.items || "").split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const parts = l.split(/\s+[–—-]\s+/).map((x) => x.trim()).filter(Boolean), last = parts[parts.length - 1] || "", pm = parts.length >= 2 ? /^(₹|rs\.?|inr|\$|€|£|aed)?\s*(\d[\d,]*(?:\.\d{1,2})?)\s*(?:\/-)?$/i.exec(last) : null;
    if (pm && !money) money = /\$/.test(pm[1] || "") ? "$" : /€/.test(pm[1] || "") ? "€" : /£/.test(pm[1] || "") ? "£" : /aed/i.test(pm[1] || "") ? "AED" : "₹";
    const body = pm ? parts.slice(0, -1) : parts;
    return { name: (body[0] || l).slice(0, 80), desc: body.slice(1).join(" – "), price: pm ? pm[2].replace(/,/g, "") : "", cat: "" };
  });
  return { fields: f, items, money };
}
