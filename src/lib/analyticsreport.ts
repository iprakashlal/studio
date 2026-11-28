// Analytics reports: the numbers of one or more sites for a period, laid out as the chosen sections, as a PDF, an Excel
// workbook or CSV files (lib/reportwriters.ts). Everything is made on this device from the numbers the sites' databases give.
import type { SiteStats } from "./cfdb";
import { csvZip, pdfDoc, xlsxBook, type Cell, type PdfBlock, type Sheet } from "./reportwriters";

export const SECTIONS: [string, string, string][] = [
  ["summary", "Summary", "Views, visitors, time on site, bounce rate, orders, revenue and conversion, with the change from the period before"],
  ["trend", "Trend", "Views, visitors and time per day, week or month"],
  ["sites", "Sites compared", "One row per site (when the report has more than one)"],
  ["pages", "Pages", "Views, visitors, average time and how far down each page is read"],
  ["entry", "Landing and exit pages", "Where visits start and end"],
  ["sources", "Traffic sources", "Sites that sent visitors (search, social), and campaigns (utm_source)"],
  ["products", "Products", "Impressions, product page views, click-through, time on the product page and adds to cart"],
  ["actions", "Actions", "Calls, WhatsApp, emails, forms sent, adds to cart and links out"],
  ["audience", "Devices and countries", "Phones, tablets and computers; where visitors are"],
  ["time", "Time of day and week", "When visitors come, by hour and by weekday"],
  ["orders", "Orders and enquiries", "Orders, revenue, average order value, enquiries and conversion rate"],
];
export type Criteria = {
  title: string; client: string; note: string; sites: string[]; group: "day" | "week" | "month"; compare: boolean;
  sections: string[]; top: number; perSite: boolean; format: "pdf" | "xlsx" | "csv";
};
export const DEFAULT_CRITERIA: Criteria = { title: "Website performance report", client: "", note: "", sites: [], group: "day", compare: true, sections: SECTIONS.map(([k]) => k), top: 15, perSite: true, format: "pdf" };

const WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const dur = (sec: number) => { sec = Math.round(sec || 0); if (sec < 60) return sec + "s"; const m = Math.floor(sec / 60), s = sec % 60; return m < 60 ? `${m}m ${String(s).padStart(2, "0")}s` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`; };
export const money = (n: number) => "₹" + Math.round(n || 0).toLocaleString("en-IN");
const pc = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 100) : a ? 100 : 0);
const sign = (d: number) => (d > 0 ? "▲ " : d < 0 ? "▼ " : "• ") + Math.abs(d) + "%";
const pctOf = (a: number, b: number, dp = 1) => (b ? +((a / b) * 100).toFixed(dp) : 0);
/** A page's address as words. */
export const pageName = (k: string) => {
  const m = /^(\/[^?]*)?\?(p|s|product)=(.+)$/.exec(k), cap = (x: string) => { try { x = decodeURIComponent(x); } catch { /* as written */ } return x.replace(/[-_]+/g, " ").replace(/^./, (c) => c.toUpperCase()); };
  if (m) return /product\.html$/.test(m[1] || "") ? "Product · " + cap(m[3]) : m[2] === "p" ? cap(m[3]) : m[2] === "s" ? cap(m[3]) + " (section)" : "Product · " + cap(m[3]);
  if (/^\/?(index\.html)?$/.test(k.replace(/^\/[^/]+\/$/, "/"))) return "Home";
  return k;
};
let regionNames: Intl.DisplayNames | null = null; try { regionNames = new Intl.DisplayNames(["en"], { type: "region" }); } catch { /* old browser */ }
export const countryName = (cc: string) => { try { return (regionNames && regionNames.of(cc)) || cc; } catch { return cc; } };
const DEV: Record<string, string> = { mobile: "Phone", tablet: "Tablet", desktop: "Computer" };
export const ACTIONS: [string, string][] = [["call", "Calls"], ["whatsapp", "WhatsApp"], ["email", "Emails"], ["form", "Forms sent"], ["cart", "Adds to cart"], ["out", "Links out"]];

/** The headline numbers of a period, with the period before's. */
export function headline(s: SiteStats) {
  const bounce = pctOf(s.bounces || 0, s.visitors), pBounce = pctOf(s.prevBounces || 0, s.prevVisitors);
  const tpv = s.visitors ? (s.time || 0) / s.visitors : 0, pTpv = s.prevVisitors ? (s.prevTime || 0) / s.prevVisitors : 0;
  const conv = pctOf(s.orders || 0, s.visitors, 2), pConv = pctOf(s.prevOrders || 0, s.prevVisitors, 2);
  return [
    { k: "views", label: "Page views", v: s.views, p: s.prevViews, show: String(s.views.toLocaleString("en-IN")) },
    { k: "visitors", label: "Visitors", v: s.visitors, p: s.prevVisitors, show: s.visitors.toLocaleString("en-IN") },
    { k: "time", label: "Avg. time per visitor", v: tpv, p: pTpv, show: dur(tpv) },
    { k: "ppv", label: "Pages per visitor", v: s.visitors ? s.views / s.visitors : 0, p: s.prevVisitors ? s.prevViews / s.prevVisitors : 0, show: (s.visitors ? s.views / s.visitors : 0).toFixed(1) },
    { k: "bounce", label: "Bounce rate", v: bounce, p: pBounce, show: bounce + "%", lowerBetter: true },
    { k: "depth", label: "Avg. read depth", v: s.depth || 0, p: 0, show: (s.depth || 0) + "%" },
    { k: "orders", label: "Orders", v: s.orders || 0, p: s.prevOrders || 0, show: String(s.orders || 0) },
    { k: "revenue", label: "Revenue", v: s.revenue || 0, p: s.prevRevenue || 0, show: money(s.revenue || 0) },
    { k: "aov", label: "Avg. order value", v: s.orders ? (s.revenue || 0) / s.orders : 0, p: s.prevOrders ? (s.prevRevenue || 0) / s.prevOrders : 0, show: money(s.orders ? (s.revenue || 0) / s.orders : 0) },
    { k: "conv", label: "Conversion rate", v: conv, p: pConv, show: conv + "%" },
    { k: "enquiries", label: "Enquiries", v: s.enquiries || 0, p: 0, show: String(s.enquiries || 0) },
  ];
}

/** Every day of the period, the days nobody came as zero. */
export function filled(s: SiteStats) {
  const by = new Map(s.daily.map((d) => [d.day, d])), out: { day: string; v: number; u: number; d: number }[] = [];
  const end = s.to || new Date().toISOString().slice(0, 10);
  for (let t = Date.parse(s.from || end); t <= Date.parse(end); t += 864e5) { const day = new Date(t).toISOString().slice(0, 10), x = by.get(day); out.push({ day, v: x?.v || 0, u: x?.u || 0, d: x?.d || 0 }); }
  return out;
}
/** The days grouped by week (from Monday) or month. */
export function grouped(s: SiteStats, g: Criteria["group"]) {
  const m = new Map<string, { label: string; v: number; u: number; d: number }>();
  for (const x of filled(s)) {
    const d = new Date(x.day + "T00:00:00Z"); let k = x.day, label = new Date(x.day + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    if (g === "week") { const mon = new Date(d); mon.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); k = mon.toISOString().slice(0, 10); label = "Week of " + new Date(k + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
    if (g === "month") { k = x.day.slice(0, 7); label = new Date(x.day + "T00:00:00").toLocaleDateString("en-IN", { month: "long", year: "numeric" }); }
    const o = m.get(k) || { label, v: 0, u: 0, d: 0 }; o.v += x.v; o.u += x.u; o.d += x.d; m.set(k, o);
  }
  return [...m.values()];
}

type Part = { title: string; note?: string; head: string[]; rows: Cell[][] };
/** The report's tables for one set of numbers (one site, or several together). */
function parts(s: SiteStats, c: Criteria, scope: string): Part[] {
  const on = (k: string) => c.sections.includes(k), N = c.top, out: Part[] = [];
  if (on("summary")) out.push({ title: "Summary", head: c.compare ? ["Metric", "This period", "Period before", "Change"] : ["Metric", "This period"],
    rows: headline(s).map((h) => (c.compare ? [h.label, ["views", "visitors", "orders", "enquiries"].includes(h.k) ? h.v : h.show, h.k === "depth" || h.k === "enquiries" ? "" : h.k === "time" ? dur(h.p) : h.k === "revenue" || h.k === "aov" ? money(h.p) : h.k === "bounce" || h.k === "conv" ? h.p + "%" : h.k === "ppv" ? h.p.toFixed(1) : Math.round(h.p), h.k === "depth" || h.k === "enquiries" ? "" : sign(pc(h.v, h.p))] : [h.label, ["views", "visitors", "orders", "enquiries"].includes(h.k) ? h.v : h.show])) });
  if (on("trend")) out.push({ title: `Trend by ${c.group}`, head: [c.group === "day" ? "Day" : c.group === "week" ? "Week" : "Month", "Page views", "Visitors", "Time on site", "Avg. time per visitor"], rows: grouped(s, c.group).map((g) => [g.label, g.v, g.u, dur(g.d), dur(g.u ? g.d / g.u : 0)]) });
  if (on("pages")) out.push({ title: "Pages", head: ["Page", "Address", "Views", "Visitors", "Avg. time", "Read depth"], rows: s.pages.slice(0, N).map((p) => [pageName(p.k), p.k, p.v, p.u, dur(p.t || 0), (p.dp || 0) + "%"]) });
  if (on("entry")) { out.push({ title: "Landing pages", note: "The first page of a visit.", head: ["Page", "Visits started here"], rows: (s.entries || []).slice(0, N).map((p) => [pageName(p.k), p.v]) }); out.push({ title: "Exit pages", note: "The last page of a visit.", head: ["Page", "Visits ended here"], rows: (s.exits || []).slice(0, N).map((p) => [pageName(p.k), p.v]) }); }
  if (on("sources")) { out.push({ title: "Referring sites", note: "Other sites that sent visitors. Typed addresses and bookmarks aren't listed.", head: ["Site", "Views", "Visitors", "Share of views"], rows: s.refs.slice(0, N).map((r) => [r.k, r.v, r.u, pctOf(r.v, s.views) + "%"]) }); out.push({ title: "Campaigns", note: "Links shared with ?utm_source=… (or ?ref=…).", head: ["Campaign", "Views", "Visitors"], rows: s.sources.slice(0, N).map((r) => [r.k, r.v, r.u]) }); }
  if (on("products")) out.push({ title: "Products", note: "Impressions: shown in a list on screen. Views: its own page opened. Click-through: views per impression.", head: ["Product", "Impressions", "Page views", "Click-through", "Avg. time on page", "Adds to cart", "Cart rate"], rows: (s.products || []).slice(0, N).map((p) => [p.k, p.imp, p.v, p.imp ? pctOf(p.v, p.imp) + "%" : "", dur(p.t), p.cart, p.v ? pctOf(p.cart, p.v) + "%" : ""]) });
  if (on("actions")) { out.push({ title: "Actions", head: ["Action", "Times", "Per 100 visitors"], rows: ACTIONS.map(([k, l]) => [l, s.actions?.[k] || 0, s.visitors ? +(((s.actions?.[k] || 0) / s.visitors) * 100).toFixed(1) : 0]) }); if ((s.outs || []).length) out.push({ title: "Links out", head: ["Site", "Clicks"], rows: (s.outs || []).slice(0, N).map((r) => [r.k, r.v]) }); }
  if (on("audience")) { const dt = s.devices.reduce((a, d) => a + d.v, 0) || 1; out.push({ title: "Devices", head: ["Device", "Views", "Visitors", "Share"], rows: s.devices.map((d) => [DEV[d.k] || d.k, d.v, d.u, pctOf(d.v, dt) + "%"]) }); out.push({ title: "Countries", head: ["Country", "Views", "Visitors", "Share"], rows: s.countries.slice(0, N).map((r) => [countryName(r.k), r.v, r.u, pctOf(r.v, s.views) + "%"]) }); }
  if (on("time")) { out.push({ title: "By hour of the day", head: ["Hour", "Page views"], rows: (s.hours || Array(24).fill(0)).map((v, h) => [`${String(h).padStart(2, "0")}:00–${String(h).padStart(2, "0")}:59`, v]) }); out.push({ title: "By day of the week", head: ["Day", "Page views"], rows: [1, 2, 3, 4, 5, 6, 0].map((d) => [WEEK[d], (s.week || [])[d] || 0]) }); }
  if (on("orders")) out.push({ title: "Orders and enquiries", head: ["Measure", "This period", ...(c.compare ? ["Period before", "Change"] : [])], rows: [
    ["Orders", s.orders || 0, ...(c.compare ? [s.prevOrders || 0, sign(pc(s.orders || 0, s.prevOrders || 0))] : [])],
    ["Revenue", money(s.revenue || 0), ...(c.compare ? [money(s.prevRevenue || 0), sign(pc(s.revenue || 0, s.prevRevenue || 0))] : [])],
    ["Average order value", money(s.orders ? (s.revenue || 0) / s.orders : 0), ...(c.compare ? [money(s.prevOrders ? (s.prevRevenue || 0) / s.prevOrders : 0), ""] : [])],
    ["Conversion rate (orders per visitor)", pctOf(s.orders || 0, s.visitors, 2) + "%", ...(c.compare ? [pctOf(s.prevOrders || 0, s.prevVisitors, 2) + "%", ""] : [])],
    ...((s.regs || 0) + (s.prevRegs || 0) ? [["Registrations", s.regs || 0, ...(c.compare ? [s.prevRegs || 0, sign(pc(s.regs || 0, s.prevRegs || 0))] : [])], ["Registration revenue", money(s.regRevenue || 0), ...(c.compare ? ["", ""] : [])]] as Cell[][] : []),
    ["Enquiries", s.enquiries || 0, ...(c.compare ? ["", ""] : [])]] });
  return out.map((p) => ({ ...p, title: p.title + (scope ? " · " + scope : "") }));
}

export type ReportSite = { name: string; url: string; stats: SiteStats };
/** The report as a file: name and blob. */
export async function buildReport(c: Criteria, sites: ReportSite[], all: SiteStats, brand: string): Promise<{ name: string; blob: Blob }> {
  const range = (s: SiteStats) => { const f = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }); return `${f(s.from)} – ${f(s.to || new Date().toISOString().slice(0, 10))}`; };
  const prevRange = (s: SiteStats) => { const span = s.days, pt = new Date(Date.parse(s.from) - 864e5), pf = new Date(Date.parse(s.from) - span * 864e5); const f = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); return `${f(pf)} – ${f(pt)}`; };
  const many = sites.length > 1, scopeAll = many ? "All sites" : "";
  const sections: Part[] = [...parts(all, c, many ? "All sites" : "")];
  if (many && c.sections.includes("sites")) sections.splice(c.sections.includes("summary") ? 1 : 0, 0, { title: "Sites compared", head: ["Site", "Page views", "Visitors", "Change in views", "Avg. time per visitor", "Bounce rate", "Orders", "Revenue"],
    rows: [...sites].sort((a, b) => b.stats.views - a.stats.views).map((x) => [x.name, x.stats.views, x.stats.visitors, sign(pc(x.stats.views, x.stats.prevViews)), dur(x.stats.visitors ? (x.stats.time || 0) / x.stats.visitors : 0), pctOf(x.stats.bounces || 0, x.stats.visitors) + "%", x.stats.orders || 0, money(x.stats.revenue || 0)]) });
  const perSite = many && c.perSite ? sites.map((x) => ({ x, parts: parts(x.stats, c, x.name) })) : [];
  const stamp = new Date().toISOString().slice(0, 10), file = `${(c.client || c.title).replace(/[^\w -]+/g, "").trim().replace(/\s+/g, "-") || "report"}-${all.from}-to-${all.to || stamp}`;
  const intro = [c.client ? `Prepared for ${c.client}` : "", `Period: ${range(all)}`, c.compare ? `Compared with: ${prevRange(all)}` : "", `Sites: ${sites.map((x) => x.name).join(", ")}`, `Prepared on ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} by ${brand}`];
  if (c.format === "xlsx" || c.format === "csv") {
    const sheets: Sheet[] = [{ name: "Report", title: c.title, note: intro.filter(Boolean).join(" · "), head: ["Item", "Value"], rows: [["Report", c.title], ...(c.client ? [["Prepared for", c.client] as Cell[]] : []), ["Period", range(all)], ...(c.compare ? [["Compared with", prevRange(all)] as Cell[]] : []), ["Sites", sites.map((x) => x.name).join(", ")], ["Prepared by", brand], ["Prepared on", stamp], ...(c.note ? [["Notes", c.note] as Cell[]] : []), ...sites.map((x) => ["Address · " + x.name, x.url] as Cell[])] }];
    for (const p of [...sections, ...perSite.flatMap((x) => x.parts)]) sheets.push({ name: p.title, title: p.title, note: p.note, head: p.head, rows: p.rows });
    return { name: file + (c.format === "xlsx" ? ".xlsx" : "-csv.zip"), blob: c.format === "xlsx" ? await xlsxBook(sheets, { title: c.title, author: brand }) : await csvZip(sheets) };
  }
  // PDF: a cover, the headline tiles and the chart, then each section as a table.
  const B: PdfBlock[] = [{ t: "cover", title: c.title, brand, lines: [...intro.filter(Boolean), ...(c.note ? ["", c.note] : [])] }];
  const kpiBlock = (s: SiteStats): PdfBlock => ({ t: "kpis", items: headline(s).filter((h) => !["depth", "enquiries", "aov"].includes(h.k) || h.v).map((h) => { const d = pc(h.v, h.p); return { label: h.label, value: h.show, sub: c.compare && h.k !== "depth" && h.k !== "enquiries" ? `${d > 0 ? "+" : ""}${d}% vs period before` : undefined, good: !c.compare || !d ? null : (d > 0) !== !!(h as any).lowerBetter }; }) });
  const chartOf = (s: SiteStats, title: string): PdfBlock => { const g = grouped(s, c.group); return { t: "chart", title, labels: g.map((x) => x.label.replace(/^Week of /, "").replace(/ \d{4}$/, "")), series: [{ name: "Page views", values: g.map((x) => x.v), color: [59, 79, 216] }, { name: "Visitors", values: g.map((x) => x.u), color: [16, 185, 129], dash: true }] }; };
  const tables = (ps: Part[]) => { for (const p of ps) { if (p.title.startsWith("Summary")) continue; B.push({ t: "h2", text: p.title }); if (p.note) B.push({ t: "p", text: p.note }); B.push({ t: "table", head: p.head, rows: p.rows }); } };
  B.push({ t: "h1", text: many ? "All sites" : sites[0]?.name || "Overview" });
  if (c.sections.includes("summary")) B.push(kpiBlock(all));
  if (c.sections.includes("trend")) B.push(chartOf(all, `Page views and visitors by ${c.group}`));
  if (c.sections.includes("time")) B.push({ t: "bars", title: "Page views by hour of the day", labels: Array.from({ length: 24 }, (_, h) => String(h)), values: all.hours || [] });
  tables(sections);
  for (const x of perSite) { B.push({ t: "break" }); B.push({ t: "h1", text: x.x.name }); B.push({ t: "p", text: x.x.url }); if (c.sections.includes("summary")) B.push(kpiBlock(x.x.stats)); if (c.sections.includes("trend")) B.push(chartOf(x.x.stats, `Page views and visitors by ${c.group}`)); tables(x.parts); }
  void scopeAll;
  return { name: file + ".pdf", blob: pdfDoc(B, { title: c.title, footer: `${c.title}${c.client ? " · " + c.client : ""} · ${range(all)} · ${brand}` }) };
}
