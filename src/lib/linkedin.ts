// LinkedIn import for the portfolio editor.
//
// LinkedIn doesn't let other websites read a profile page (it needs a signed-in visitor and its
// terms forbid scraping), so the profile link alone can't be fetched from a static site. The owner
// brings the data instead, in one of the two forms LinkedIn itself offers:
//   • the profile PDF (profile → More → Save to PDF), read here with pdf.js, or
//   • the data export (Settings → Data privacy → Get a copy of your data): a ZIP of CSV files.
// Both are parsed into LinkedInData, which applyLinkedIn() maps onto portfolio content.


export type LiRole = { title: string; company: string; location?: string; start?: string; end?: string; current?: boolean; description?: string };
export type LiSchool = { school: string; degree?: string; start?: string; end?: string };
export type LiCert = { name: string; issuer?: string; date?: string };
export type LiProject = { title: string; description?: string; url?: string; start?: string; end?: string };

export type LinkedInData = {
  source: "pdf" | "export";
  firstName?: string;
  lastName?: string;
  headline?: string;
  location?: string;
  summary?: string;
  email?: string;
  profileUrl?: string;
  websites?: string[];
  roles: LiRole[];
  education: LiSchool[];
  certifications: LiCert[];
  skills: string[];
  languages: string[];
  projects: LiProject[];
};

const empty = (source: LinkedInData["source"]): LinkedInData => ({ source, roles: [], education: [], certifications: [], skills: [], languages: [], projects: [] });

/** A LinkedIn profile address, tidied to https://www.linkedin.com/in/<name>, or null. */
export function profileUrl(v: string): string | null {
  const m = String(v || "").trim().match(/^(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/([A-Za-z0-9%_-]{2,100})\/?(?:[?#].*)?$/i);
  return m ? `https://www.linkedin.com/in/${m[1]}` : null;
}

// ───────────────────────────── data export (CSV / ZIP) ─────────────────────────────

/** RFC 4180 CSV: quoted fields, doubled quotes, newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
}

/** Rows as objects. Some export files start with a few lines of notes, so the header is the first row that has `must`. */
function records(text: string, must: string): Record<string, string>[] {
  const rows = parseCsv(text);
  const h = rows.findIndex((r) => r.some((x) => x.trim().toLowerCase() === must.toLowerCase()));
  if (h < 0) return [];
  const head = rows[h].map((x) => x.trim());
  return rows.slice(h + 1).map((r) => Object.fromEntries(head.map((k, i) => [k, (r[i] || "").trim()])));
}

const pick = (r: Record<string, string>, ...keys: string[]) => { for (const k of keys) if (r[k]) return r[k]; return ""; };

/** Reads LinkedIn export files (by file name) into LinkedInData. */
export function fromExport(files: Record<string, string>): LinkedInData {
  const d = empty("export");
  const get = (name: string) => { const k = Object.keys(files).find((f) => f.split("/").pop()!.toLowerCase() === name.toLowerCase()); return k ? files[k] : ""; };
  const p = records(get("Profile.csv"), "First Name")[0];
  if (p) {
    d.firstName = pick(p, "First Name"); d.lastName = pick(p, "Last Name"); d.headline = pick(p, "Headline");
    d.summary = pick(p, "Summary"); d.location = pick(p, "Geo Location", "Location");
    const w = pick(p, "Websites");
    if (w) d.websites = w.replace(/^\[|\]$/g, "").split(/,\s*/).map((x) => x.replace(/^[A-Z]+:/, "").trim()).filter((x) => /^https?:\/\//i.test(x));
  }
  d.roles = records(get("Positions.csv"), "Company Name").map((r) => ({
    title: pick(r, "Title"), company: pick(r, "Company Name"), location: pick(r, "Location") || undefined,
    start: pick(r, "Started On") || undefined, end: pick(r, "Finished On") || undefined, current: !pick(r, "Finished On"), description: pick(r, "Description") || undefined,
  })).filter((r) => r.title || r.company);
  d.education = records(get("Education.csv"), "School Name").map((r) => ({
    school: pick(r, "School Name"), degree: [pick(r, "Degree Name"), pick(r, "Notes")].filter(Boolean)[0] || undefined, start: pick(r, "Start Date") || undefined, end: pick(r, "End Date") || undefined,
  })).filter((r) => r.school);
  d.skills = records(get("Skills.csv"), "Name").map((r) => pick(r, "Name")).filter(Boolean);
  d.certifications = records(get("Certifications.csv"), "Name").map((r) => ({ name: pick(r, "Name"), issuer: pick(r, "Authority") || undefined, date: pick(r, "Started On") || undefined })).filter((r) => r.name);
  d.languages = records(get("Languages.csv"), "Name").map((r) => pick(r, "Name")).filter(Boolean);
  d.projects = records(get("Projects.csv"), "Title").map((r) => ({ title: pick(r, "Title"), description: pick(r, "Description") || undefined, url: pick(r, "Url", "URL") || undefined, start: pick(r, "Started On") || undefined, end: pick(r, "Finished On") || undefined })).filter((r) => r.title);
  const em = records(get("Email Addresses.csv"), "Email Address");
  d.email = pick(em.find((r) => /yes/i.test(r["Primary"] || "")) || em[0] || {}, "Email Address") || undefined;
  return d;
}

/** Reads the .csv files out of a ZIP (stored or deflated entries), without a ZIP library. */
export async function unzipCsv(buf: ArrayBuffer): Promise<Record<string, string>> {
  const v = new DataView(buf), u8 = new Uint8Array(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66000); i--) if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("This isn't a ZIP file LinkedIn sent. Upload the ZIP from “Get a copy of your data”.");
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const out: Record<string, string> = {};
  const dec = new TextDecoder();
  for (let n = 0; n < count && v.getUint32(p, true) === 0x02014b50; n++) {
    const method = v.getUint16(p + 10, true), csize = v.getUint32(p + 20, true);
    const nlen = v.getUint16(p + 28, true), xlen = v.getUint16(p + 30, true), clen = v.getUint16(p + 32, true), local = v.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
    p += 46 + nlen + xlen + clen;
    if (!/\.csv$/i.test(name)) continue;
    const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    const raw = u8.slice(start, start + csize);
    if (method === 0) out[name] = dec.decode(raw);
    else if (method === 8) out[name] = await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
  }
  return out;
}

export async function fromZip(data: ArrayBuffer): Promise<LinkedInData> {
  const files = await unzipCsv(data);
  if (!Object.keys(files).length) throw new Error("This ZIP has no CSV files. Use the ZIP that LinkedIn emails you from “Get a copy of your data”.");
  return fromExport(files);
}

// ───────────────────────────── profile PDF ─────────────────────────────

/** A run of text from the PDF: its page, position (y grows downwards) and font size. */
export type PdfItem = { page: number; x: number; y: number; size: number; text: string; bold?: boolean; w?: number };
type Line = { page: number; x: number; y: number; size: number; text: string; bold: boolean; end: number };

const MAIN_HEADS = ["summary", "about", "experience", "education", "licenses & certifications", "certifications", "projects", "volunteer experience", "honors & awards", "honors-awards", "publications", "patents", "courses", "skills", "languages", "recommendations", "organizations", "test scores"];
const SIDE_HEADS = ["contact", "top skills", "skills", "languages", "certifications", "honors-awards", "honors & awards", "publications", "patents"];
const MONTH = "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
const DATE = `(?:${MONTH}\\s+)?\\d{4}`;
const RANGE = new RegExp(`^(${DATE})\\s*[-–—]\\s*(Present|${DATE})(?:\\s*\\((.*)\\))?\\s*$`, "i");
const DURATION = /^(?:less than a year|\d+\s+years?(?:\s+\d+\s+months?)?|\d+\s+months?)$/i;
const PAGE = /^Page \d+ of \d+$/i;

/** Joins PDF text runs into lines (same page, same baseline), top to bottom. */
function toLines(items: PdfItem[]): Line[] {
  const sorted = items.filter((i) => i.text.trim()).sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);
  const out: Line[] = [];
  for (const it of sorted) {
    const w = it.w ?? it.text.length * it.size * 0.5;
    // Same page and baseline, and close on the left: the same line. (The sidebar and the main column share baselines.)
    const last = out.slice(-6).reverse().find((l) => l.page === it.page && Math.abs(l.y - it.y) < Math.max(2, it.size * 0.35) && it.x >= l.x && it.x - l.end < it.size * 1.6);
    if (last) {
      const gap = /\s$/.test(last.text) || /^\s/.test(it.text) || it.x - last.end < it.size * 0.12 ? "" : " ";
      last.text = (last.text + gap + it.text).replace(/\s+/g, " ");
      last.size = Math.max(last.size, it.size); last.bold = last.bold || !!it.bold; last.end = Math.max(last.end, it.x + w);
    } else out.push({ page: it.page, x: it.x, y: it.y, size: it.size, text: it.text.replace(/\s+/g, " "), bold: !!it.bold, end: it.x + w });
  }
  return out.map((l) => ({ ...l, text: l.text.trim() })).filter((l) => l.text && !PAGE.test(l.text));
}

const mode = (xs: number[]) => { const m = new Map<number, number>(); for (const x of xs) { const k = Math.round(x * 2) / 2; m.set(k, (m.get(k) || 0) + 1); } return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 10; };

/** Joins body lines into paragraphs: a bigger gap than usual between lines starts a new one. */
function paragraphs(lines: Line[]): string {
  const out: string[] = [];
  let cur = "";
  lines.forEach((l, i) => {
    const prev = lines[i - 1];
    const gap = prev && prev.page === l.page ? l.y - prev.y : 0;
    if (prev && (gap > l.size * 1.9 || /^[•·▪●\-–]\s/.test(l.text))) { out.push(cur.trim()); cur = ""; }
    cur += (cur && !cur.endsWith("-") ? " " : "") + l.text;
  });
  if (cur.trim()) out.push(cur.trim());
  return out.join("\n\n");
}

/** Reads the profile PDF's text runs (see readPdf) into LinkedInData. */
export function fromPdfItems(items: PdfItem[]): LinkedInData {
  const d = empty("pdf");
  const lines = toLines(items);
  if (!lines.length) throw new Error("This PDF has no readable text.");
  // The name is the biggest text on page 1; the main column starts at its left edge.
  const first = lines.filter((l) => l.page === 1);
  const nameLine = first.reduce((a, b) => (b.size > a.size ? b : a), first[0]);
  const mainX = nameLine.x - 12;
  const main = lines.filter((l) => l.x >= mainX);
  const side = lines.filter((l) => l.x < mainX);
  const body = mode(main.map((l) => l.size));
  const isHead = (l: Line, list: string[]) => list.includes(l.text.toLowerCase()) && l.size > body + 1.5;

  // ── Sidebar: contact, top skills, languages, certifications
  const sideBody = mode(side.map((l) => l.size));
  let sec = "";
  const sideSecs: Record<string, Line[]> = {};
  for (const l of side) {
    if (SIDE_HEADS.includes(l.text.toLowerCase()) && l.size > sideBody + 0.5) { sec = l.text.toLowerCase(); continue; }
    const arr = (sideSecs[sec] ||= []);
    const prev = arr[arr.length - 1];
    // The narrow sidebar wraps long entries: "AWS Certified Solutions Architect –" / "Associate".
    if (prev && prev.page === l.page && l.y - prev.y < l.size * 1.6 && (/[–\-,&/]$/.test(prev.text) || /^[a-z(]/.test(l.text))) { prev.text += (/[/]$/.test(prev.text) ? "" : " ") + l.text; continue; }
    arr.push({ ...l });
  }
  const contact = (sideSecs["contact"] || []).map((l) => l.text).join(" ");
  d.email = contact.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/)?.[0];
  const li = contact.replace(/\s+/g, "").match(/(?:www\.)?linkedin\.com\/in\/[A-Za-z0-9%_-]+/i)?.[0];
  if (li) d.profileUrl = profileUrl(li) || undefined;
  d.websites = [...contact.matchAll(/((?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s()]*)?)\s*\((?!LinkedIn)[^)]*\)/gi)].map((m) => m[1]).filter((u) => !/linkedin\.com/i.test(u)).map((u) => (/^https?:/i.test(u) ? u : "https://" + u));
  d.skills = [...(sideSecs["top skills"] || sideSecs["skills"] || [])].map((l) => l.text);
  d.languages = (sideSecs["languages"] || []).map((l) => l.text.replace(/\s*\([^)]*\)\s*$/, "")).filter(Boolean);
  const certs = sideSecs["certifications"] || [];
  d.certifications = certs.map((l) => ({ name: l.text }));

  // ── Main column: name, headline, location, then the sections
  const n = nameLine.text.split(" ");
  d.lastName = n.length > 1 ? n.pop() : ""; d.firstName = n.join(" ");
  const top: Line[] = [];
  const secs: Record<string, Line[]> = {};
  sec = "";
  for (const l of main) {
    if (l === nameLine) continue;
    if (isHead(l, MAIN_HEADS)) { sec = l.text.toLowerCase(); secs[sec] ||= []; continue; }
    if (!sec) { if (l.page === 1 && l.y > nameLine.y) top.push(l); continue; }
    secs[sec].push(l);
  }
  // Headline lines are bigger than the location line under them.
  if (top.length) {
    const loc = top[top.length - 1];
    const hl = top.length > 1 ? top.slice(0, -1) : top;
    d.headline = hl.map((l) => l.text).join(" ");
    if (top.length > 1) d.location = loc.text;
  }
  d.summary = paragraphs(secs["summary"] || secs["about"] || []) || undefined;

  // Experience: a date range line follows each role's title; the company sits above the title,
  // or above a total-duration line when one company has several roles.
  const ex = secs["experience"] || [];
  const dates = ex.map((l, i) => (RANGE.test(l.text) ? i : -1)).filter((i) => i >= 0);
  let company = "";
  const starts: number[] = [];
  dates.forEach((di, k) => {
    const t = di - 1, tStart = t;
    const title = ex.slice(tStart, t + 1).map((l) => l.text).join(" ");
    let s = tStart;
    const above = ex[tStart - 1];
    if (above && DURATION.test(above.text) && ex[tStart - 2]) { company = ex[tStart - 2].text; s = tStart - 2; }
    else if (above && above.size > body + 0.2 && !RANGE.test(above.text)) { company = above.text; s = tStart - 1; }
    else if (k === 0 && above) { company = above.text; s = tStart - 1; }
    starts.push(s);
    const m = ex[di].text.match(RANGE)!;
    (d.roles as any[]).push({ title, company, start: m[1], end: /present/i.test(m[2]) ? undefined : m[2], current: /present/i.test(m[2]), _di: di });
  });
  d.roles.forEach((r: any, k) => {
    let i = r._di + 1;
    const next = k + 1 < starts.length ? starts[k + 1] : ex.length;
    const l = ex[i];
    if (l && i < next && l.text.length < 70 && !/[.!?]$/.test(l.text) && (/,|remote|hybrid|on-site|india|area/i.test(l.text))) { r.location = l.text; i++; }
    const desc = paragraphs(ex.slice(i, next));
    if (desc) r.description = desc;
    delete r._di;
  });

  // Education: the school, then "Degree, Field · (2012 - 2016)" lines.
  const ed = secs["education"] || [];
  for (let i = 0; i < ed.length; i++) {
    const l = ed[i];
    if (l.size > body + 0.2) d.education.push({ school: l.text });
    else if (d.education.length) {
      const cur = d.education[d.education.length - 1];
      const txt = (cur.degree ? cur.degree + " " : "") + l.text;
      const m = txt.match(/^(.*?)\s*·?\s*\((?:(\w+\s+)?(\d{4}))?\s*[-–]\s*(?:(\w+\s+)?(\d{4}|Present))?\)\s*$/i);
      if (m) { cur.degree = m[1].replace(/\s*·\s*$/, "").trim() || undefined; cur.start = m[3]; cur.end = m[5]; }
      else cur.degree = txt;
    }
  }
  const lc = secs["licenses & certifications"] || secs["certifications"] || [];
  for (const l of lc) if (l.size > body + 0.2 || !d.certifications.length) d.certifications.push({ name: l.text });
  const pj = secs["projects"] || [];
  for (const l of pj) {
    if (l.size > body + 0.2) d.projects.push({ title: l.text });
    else if (d.projects.length) { const p = d.projects[d.projects.length - 1]; p.description = ((p.description || "") + " " + l.text).trim(); }
  }
  if (!d.roles.length && !d.summary && !d.headline) throw new Error("This doesn't look like a LinkedIn profile PDF. On your profile, use More → Save to PDF, then upload that file.");
  return d;
}

/** Reads a PDF's text runs with pdf.js, loaded on demand from `base` (pdf.min.js + pdf.worker.min.js). */
export async function readPdf(data: ArrayBuffer, base: string): Promise<PdfItem[]> {
  const load = new Function("u", "return import(u)") as (u: string) => Promise<any>;
  let pdfjs: any;
  try {
    pdfjs = await load(new URL("pdf.min.js", base).href);
  } catch {
    throw new Error("The PDF reader didn't load. Check your connection, or use the data export ZIP instead.");
  }
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdf.worker.min.js", base).href;
  let doc: any;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(data), isEvalSupported: false }).promise;
  } catch (e: any) {
    throw new Error(/password/i.test(e?.name + e?.message) ? "This PDF is password-protected. Save your profile as a PDF again and upload that." : "This file isn't a readable PDF. On your profile, use More → Save to PDF, then upload that file.");
  }
  const items: PdfItem[] = [];
  for (let p = 1; p <= Math.min(doc.numPages, 20); p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    for (const it of tc.items as any[]) {
      if (!("str" in it) || !it.str.trim()) continue;
      const [a, b, , dd, e, f] = it.transform;
      const size = Math.round(Math.hypot(a, b) * 10) / 10 || Math.abs(dd);
      const font = tc.styles?.[it.fontName]?.fontFamily || "";
      items.push({ page: p, x: e, y: vp.height - f, size, text: it.str, bold: /bold/i.test(it.fontName + font), w: it.width });
    }
  }
  await doc.destroy();
  return items;
}

/** Reads any of the accepted files: a profile PDF, the export ZIP, or loose export CSVs. */
export async function readFiles(files: File[], pdfBase: string): Promise<LinkedInData> {
  const pdf = files.find((f) => /\.pdf$/i.test(f.name) || f.type === "application/pdf");
  if (pdf) return fromPdfItems(await readPdf(await pdf.arrayBuffer(), pdfBase));
  const zip = files.find((f) => /\.zip$/i.test(f.name));
  if (zip) return fromZip(await zip.arrayBuffer());
  const csv = files.filter((f) => /\.csv$/i.test(f.name));
  if (csv.length) {
    const map: Record<string, string> = {};
    for (const f of csv) map[f.name] = await f.text();
    return fromExport(map);
  }
  throw new Error("Upload the profile PDF, or the ZIP (or CSV files) from LinkedIn's data export.");
}

// ───────────────────────────── mapping onto the portfolio ─────────────────────────────

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
/** "Jul 2022", "July 2022", "2022", "07/2022" → { y, m }. */
function parseDate(s?: string): { y: number; m: number } | null {
  if (!s) return null;
  const t = s.trim();
  let m = t.match(/^([A-Za-z]{3})[a-z]*\.?\s+(\d{4})$/);
  if (m) { const i = MONTHS.indexOf(m[1].toLowerCase()); return { y: +m[2], m: i < 0 ? 0 : i }; }
  m = t.match(/^(\d{1,2})\/(\d{4})$/); if (m) return { y: +m[2], m: +m[1] - 1 };
  m = t.match(/(\d{4})/); if (m) return { y: +m[1], m: 0 };
  return null;
}
const fmt = (s?: string) => { const d = parseDate(s); if (!d) return s || ""; return /^[A-Za-z]/.test(String(s).trim()) ? `${MONTHS[d.m][0].toUpperCase()}${MONTHS[d.m].slice(1)} ${d.y}` : String(d.y); };
export const period = (start?: string, end?: string, current?: boolean) => [fmt(start), current ? "Present" : fmt(end)].filter(Boolean).join(" – ");

/** Whole years since the earliest role started. */
export function yearsOfExperience(d: LinkedInData, now = new Date()): number {
  const starts = d.roles.map((r) => parseDate(r.start)).filter(Boolean) as { y: number; m: number }[];
  if (!starts.length) return 0;
  const e = starts.reduce((a, b) => (a.y * 12 + a.m <= b.y * 12 + b.m ? a : b));
  return Math.max(0, Math.floor((now.getFullYear() * 12 + now.getMonth() - (e.y * 12 + e.m)) / 12));
}

/** Description text → up to `max` short highlights. */
export function bullets(text?: string, max = 4): string[] {
  if (!text) return [];
  const parts = text.split(/\n+|\s*[•▪●]\s+|(?:^|\s)[-–]\s+(?=[A-Z])/).map((x) => x.trim()).filter((x) => x.length > 2);
  const out = parts.length > 1 ? parts : (text.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g) || []).map((x) => x.trim()).filter(Boolean);
  return out.map((x) => x.replace(/^[-–•▪●*]\s+/, "").trim()).filter(Boolean).slice(0, max).map((x) => (x.length > 220 ? x.slice(0, 217).replace(/\s+\S*$/, "") + "…" : x));
}

export type ApplyParts = { profile: boolean; about: boolean; work: boolean; learning: boolean; skills: boolean; projects: boolean; contact: boolean };
export const PART_LABELS: Record<keyof ApplyParts, string> = {
  profile: "Name, headline and location (Hero)",
  about: "About text (About → Story)",
  work: "Experience (Work deck)",
  learning: "Education, certifications and languages (Learning)",
  skills: "Skills (scrolling band under the hero)",
  projects: "Projects",
  contact: "LinkedIn link and email (Contact & hero button)",
};

/** Which parts the data can fill, with a short count for the review list. */
export function available(d: LinkedInData): Partial<Record<keyof ApplyParts, string>> {
  const a: Partial<Record<keyof ApplyParts, string>> = {};
  const nm = [d.firstName, d.lastName].filter(Boolean).join(" ");
  if (nm || d.headline) a.profile = [nm, d.headline, d.location].filter(Boolean).join(" · ");
  if (d.summary) a.about = d.summary.length > 120 ? d.summary.slice(0, 117) + "…" : d.summary;
  if (d.roles.length) a.work = `${d.roles.length} role${d.roles.length > 1 ? "s" : ""}: ${d.roles.slice(0, 3).map((r) => `${r.title} at ${r.company}`).join("; ")}${d.roles.length > 3 ? "…" : ""}`;
  const ln = d.education.length + d.certifications.length;
  if (ln || d.languages.length) a.learning = [d.education.length && `${d.education.length} school${d.education.length > 1 ? "s" : ""}`, d.certifications.length && `${d.certifications.length} certification${d.certifications.length > 1 ? "s" : ""}`, d.languages.length && d.languages.join(", ")].filter(Boolean).join(" · ");
  if (d.skills.length) a.skills = d.skills.slice(0, 8).join(", ") + (d.skills.length > 8 ? "…" : "");
  if (d.projects.length) a.projects = `${d.projects.length} project${d.projects.length > 1 ? "s" : ""}`;
  if (d.profileUrl || d.email) a.contact = [d.profileUrl, d.email].filter(Boolean).join(" · ");
  return a;
}

/** Writes the chosen parts into portfolio content (in place). Designs and colours stay as they are. */
export function applyLinkedIn(c: any, d: LinkedInData, parts: ApplyParts, profileLink?: string) {
  const cyc = <T,>(arr: T[], i: number, dflt: T) => (arr.length ? arr[i % arr.length] : dflt);
  const link = profileLink || d.profileUrl;
  if (parts.profile) {
    c.hero ||= {};
    if (d.firstName) c.hero.firstName = d.firstName;
    if (d.lastName !== undefined && d.firstName) c.hero.lastName = d.lastName || "";
    const city = d.location?.split(",")[0]?.trim();
    if (d.headline) c.hero.eyebrow = [d.headline.split(/\s+[|·]\s+/)[0], city].filter(Boolean).join(" · ");
    const yrs = yearsOfExperience(d);
    for (const m of c.hero.meta || []) {
      if (/year/i.test(m.label) && yrs) m.value = `${yrs}+`;
      if (/based|city|location/i.test(m.label) && city) m.value = city;
    }
    const name = [d.firstName, d.lastName].filter(Boolean).join(" ");
    if (name) {
      c.brand ||= {}; c.brand.logoText = name;
      if (c.theme && "introTitle" in c.theme) c.theme.introTitle = name;
      c.seo ||= {};
      c.seo.title = d.headline ? `${name} · ${d.headline.split(/\s+[|·]\s+/)[0]}`.slice(0, 70) : name;
      if (d.summary) { const t = d.summary.replace(/\s+/g, " ").trim(); c.seo.description = t.length > 155 ? t.slice(0, 154).replace(/\s+\S*$/, "") + "…" : t; }
      c.seo.author = name;
      if (c.velocity && "signature" in c.velocity && d.firstName) c.velocity.signature = d.firstName;
      if (c.contact) c.contact.footerLeft = `© ${new Date().getFullYear()} ${name}`;
    }
    for (const s of c.about?.stats || []) if (/year/i.test(s.label) && yrs) s.value = yrs;
  }
  if (parts.about && d.summary) {
    c.about ||= {};
    c.about.story = d.summary.trim().replace(/\n(?!\n)/g, "\n\n").replace(/\n{3,}/g, "\n\n");
    const firstSentence = d.summary.split(/(?<=[.!?])\s+/)[0];
    if (firstSentence && firstSentence.length <= 140) c.about.lede = firstSentence;
  }
  if (parts.work && d.roles.length) {
    c.work ||= {};
    const old: any[] = c.work.items || [];
    c.work.items = d.roles.map((r, i) => ({
      period: period(r.start, r.end, r.current), title: r.title, org: r.company, orgNote: r.location?.split(",")[0] || "", current: !!r.current,
      color: cyc(old.map((o) => o.color), i, "surface"), image: null,
      bullets: bullets(r.description).length ? bullets(r.description) : [`${r.title} at ${r.company}.`],
      art: cyc(old.map((o) => o.art), i, [{ type: "circle", color: "c1" }, { type: "square", color: "c2" }]),
    }));
    const ys = d.roles.map((r) => parseDate(r.start)?.y).filter(Boolean) as number[];
    if (ys.length && /\d{4}/.test(c.work.eyebrow || "")) c.work.eyebrow = String(c.work.eyebrow).replace(/\d{4}/, String(Math.min(...ys)));
  }
  if (parts.learning) {
    c.learning ||= {};
    const old: any[] = c.learning.items || [];
    const items = [
      ...d.education.map((e) => ({ period: [e.start, e.end].filter(Boolean).join(" – ") || "Education", title: e.degree || e.school, sub: e.degree ? e.school : "" })),
      ...d.certifications.map((x) => ({ period: x.date ? fmt(x.date) : "Certification", title: x.name, sub: x.issuer || "" })),
    ].map((it, i) => ({ ...it, shape: cyc(old.map((o) => o.shape), i, "circle"), color: cyc(old.map((o) => o.color), i, "c1") }));
    if (items.length) c.learning.items = items;
    if (d.languages.length) c.learning.languages = d.languages;
  }
  if (parts.skills && d.skills.length) c.ticker = d.skills.slice(0, 14);
  if (parts.projects && d.projects.length) {
    c.projects ||= {};
    const old: any[] = c.projects.items || [];
    c.projects.items = d.projects.map((p, i) => ({
      title: p.title, body: p.description || "", url: p.url || "", linkLabel: p.url ? "View project" : "", image: null,
      color: cyc(old.map((o) => o.color), i, "c1"), shape: cyc(old.map((o) => o.shape), i, "circle"), tags: [],
    }));
  }
  if (parts.contact) {
    c.contact ||= {};
    if (link) {
      const links: any[] = (c.contact.links ||= []);
      const li = links.find((l) => /linkedin/i.test(l.label + l.url));
      if (li) li.url = link; else links.unshift({ label: "LinkedIn", url: link });
      if (c.hero && (/linkedin/i.test(c.hero.ctaSecondaryUrl || "") || /linkedin/i.test(c.hero.ctaSecondary || ""))) c.hero.ctaSecondaryUrl = link;
    }
    if (d.email) {
      c.contact.email = d.email;
      const em = (c.contact.links || []).find((l: any) => /^mailto:/i.test(l.url));
      if (em) em.url = `mailto:${d.email}`;
    }
    for (const w of d.websites || []) {
      const links: any[] = c.contact.links;
      if (links.length < 8 && !links.some((l) => l.url.replace(/\/$/, "") === w.replace(/\/$/, ""))) links.push({ label: w.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""), url: w });
    }
  }
}
