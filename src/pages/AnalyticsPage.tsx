// Studio → Analytics: visits to the Studio's live sites, counted by each site's own database (built-in analytics: the
// pages report a view only when the visitor allows analytics; no cookie, nothing that names a visitor is kept).
import { useEffect, useMemo, useState } from "react";
import type { ProjectMeta, StudioIndex } from "../lib/studio";
import { cfSession, siteStats, type SiteStats } from "../lib/cfdb";
import { loadHostConfig } from "../lib/studiohost";
import { siteAddress } from "../lib/hosting";
import { TEMPLATES } from "../schema";
import { Skel } from "../ui/kit";

type Src = { cf: { api: string; site: string }; account?: string };
type Entry = { p: ProjectMeta; src: Src | null; why?: string; stats?: SiteStats | null; err?: string };
const RANGES: [number, string][] = [[1, "Today"], [7, "7 days"], [30, "30 days"], [90, "90 days"], [365, "12 months"]];

const fmt = (n: number) => (n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e4 ? Math.round(n / 1e3) + "k" : n >= 1e3 ? (n / 1e3).toFixed(1) + "k" : String(n));
const pct = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 100) : a ? 100 : 0);
const flag = (cc: string) => (/^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : "🌐");
const country = (() => { let d: Intl.DisplayNames | null = null; try { d = new Intl.DisplayNames(["en"], { type: "region" }); } catch { /* old browser */ } return (cc: string) => { try { return (d && d.of(cc)) || cc; } catch { return cc; } }; })();
/** A page's address as words: Home, Menu, Gallery (section), Product · name, or the address itself. */
const pageName = (k: string) => {
  const m = /^(\/[^?]*)?\?(p|s|product)=(.+)$/.exec(k), cap = (x: string) => decodeURIComponent(x).replace(/[-_]+/g, " ").replace(/^./, (c) => c.toUpperCase());
  if (m) return m[2] === "p" ? cap(m[3]) : m[2] === "s" ? cap(m[3]) + " (section)" : "Product · " + cap(m[3]);
  if (/^\/?(index\.html)?$/.test(k.replace(/^\/[^/]+\/$/, "/"))) return "Home";
  return k;
};
const liveUrl = (p: ProjectMeta) => (p.host ? siteAddress(p.host) : p.publish ? `https://${p.publish.owner}.github.io/${p.publish.repo}/` : "");

/** Where a project's views are counted, or why they aren't. */
function sourceOf(p: ProjectMeta, studioDb: { api: string } | null): { src: Src | null; why?: string } {
  const h = p.host;
  if (h?.cf) return { src: { cf: h.cf, account: h.kind === "cloudflare" ? h.account : undefined } };
  if (h) return { src: null, why: "Its content is on Supabase. Built-in analytics counts sites whose database is on Cloudflare." };
  if (p.publish) return studioDb ? { src: { cf: { api: studioDb.api, site: p.id } } } : { src: null, why: "A GitHub Pages site is counted through your Studio's database on Cloudflare, signed in on this device." };
  return { src: null, why: "Not published yet." };
}

export function AnalyticsPage({ index, demo }: { index: StudioIndex; demo: boolean }) {
  const [days, setDays] = useState(30), [pick, setPick] = useState<string>(() => { try { return sessionStorage.getItem("studio-analytics-site") || ""; } catch { return ""; } });
  const [list, setList] = useState<Entry[] | null>(null);
  useEffect(() => { try { sessionStorage.setItem("studio-analytics-site", pick); } catch { /* private mode */ } }, [pick]);
  const projects = useMemo(() => index.projects.slice(), [index.projects]);
  useEffect(() => {
    let live = true;
    setList((old) => old && old.map((e) => ({ ...e, stats: e.src ? undefined : e.stats })));
    (async () => {
      if (demo) { if (live) setList(projects.map((p, i) => ({ p, src: { cf: { api: "", site: p.id } }, stats: sample(days, i) }))); return; }
      const hc = await loadHostConfig().catch(() => null);
      const studioDb = hc && hc.kind === "cloudflare" && cfSession.load(hc.api) ? { api: hc.api } : null;
      const base: Entry[] = projects.map((p) => ({ p, ...sourceOf(p, studioDb) }));
      if (live) setList(base);
      await Promise.all(base.map(async (e, i) => {
        if (!e.src) return;
        try { const s = await siteStats(e.src.cf, days, e.src.account); if (live) setList((l) => l && l.map((x, j) => (j === i ? { ...x, stats: s } : x))); }
        catch (x: any) {
          const msg = x?.status === 401 ? "Sign in to this site's database on this device." : x?.status === 403 ? "You aren't one of this site's people, so its numbers stay with them." : /Unknown|Not found|404/i.test(x?.message || "") ? "Update the database once (Settings → Updates) to start counting." : x?.message || "Couldn't read its numbers.";
          if (live) setList((l) => l && l.map((y, j) => (j === i ? { ...y, stats: null, err: msg } : y)));
        }
      }));
    })();
    return () => { live = false; };
  }, [days, projects, demo]);

  const counted = (list || []).filter((e) => e.src && e.stats !== null), off = (list || []).filter((e) => !e.src || e.stats === null);
  const one = pick ? (list || []).find((e) => e.p.id === pick) : null;
  const total = useMemo(() => combine(counted.map((e) => e.stats).filter(Boolean) as SiteStats[], days), [list, days]);
  const loading = counted.some((e) => e.stats === undefined);

  return (
    <main className="mx-auto flex max-w-[1400px] flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-4xl font-extrabold tracking-tight">Analytics</h1>
          <p className="mt-1 max-w-[80ch] text-sm text-ink-400">Visits to your live sites, counted by each site's own database. No cookies and nothing that names a visitor: a page view is sent only when the visitor allows analytics under the site's cookie consent.</p>
        </div>
        <div role="radiogroup" aria-label="Period" className="flex rounded-full border border-ink-700 p-1">
          {RANGES.map(([d, l]) => <button key={d} type="button" role="radio" aria-checked={days === d} onClick={() => setDays(d)} className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${days === d ? "bg-brand-500 text-white" : "text-ink-300 hover:text-ink-100"}`}>{l}</button>)}
        </div>
      </div>
      {demo && <p className="rounded-xl border border-amber-400/40 bg-amber-400/5 px-4 py-2.5 text-[13px] text-amber-100">Demo: these numbers are made up, to show how the page looks.</p>}

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Site">
        <button type="button" role="tab" aria-selected={!pick} onClick={() => setPick("")} className={`chip ${!pick ? "border-ink-100 bg-ink-100 text-ink-950" : ""}`}>All sites <span className="opacity-60">{counted.length}</span></button>
        {counted.map((e) => <button key={e.p.id} type="button" role="tab" aria-selected={pick === e.p.id} onClick={() => setPick(e.p.id)} className={`chip ${pick === e.p.id ? "border-ink-100 bg-ink-100 text-ink-950" : ""}`}>{e.p.name}</button>)}
      </div>

      {list === null ? <SkelPage /> : one && one.stats ? <SiteView e={one} /> : one && one.stats === undefined ? <SkelPage /> : <>
        <Kpis s={total} label={`All ${counted.length} counted site${counted.length === 1 ? "" : "s"}`} />
        <Panel title="Views and visitors" right={<Legend />}><Chart s={total} /></Panel>
        <Panel title="Sites" note="Press a site for its pages, where visitors come from, their devices and countries.">
          {!counted.length ? <p className="text-[13px] text-ink-400">No site is counted yet. Publish a site with its database on Cloudflare (or a GitHub Pages site with email sign-in), then Push updates so its pages report visits.</p> :
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {[...counted].sort((a, b) => (b.stats?.views || 0) - (a.stats?.views || 0)).map((e) => <li key={e.p.id}><SiteCard e={e} onOpen={() => setPick(e.p.id)} /></li>)}
            </ul>}
          {loading && <p className="text-[12.5px] text-ink-400" role="status">Reading the sites' numbers…</p>}
        </Panel>
      </>}

      {!pick && off.length > 0 && <Panel title="Not counted" note="These projects don't report visits yet.">
        <ul className="flex flex-col divide-y divide-ink-700 text-[13px]">
          {off.map((e) => <li key={e.p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2"><b className="min-w-[10rem]">{e.p.name}</b><span className="text-ink-400">{TEMPLATES[e.p.template]?.name || e.p.template}</span><span className="flex-1 text-ink-300">{e.err || e.why}</span></li>)}
        </ul>
      </Panel>}
      <p className="text-[12.5px] text-ink-400">A visitor is counted once a day per site (an address and browser, scrambled with the day, so they can't be followed from one day to the next). Each site's pages start reporting once it's published or updated with Settings → Updates → Push updates. Views older than about 13 months are removed.</p>
    </main>
  );
}

/** One site: its numbers, chart and breakdowns. */
function SiteView({ e }: { e: Entry }) {
  const s = e.stats!, url = liveUrl(e.p), devTotal = s.devices.reduce((a, b) => a + b.v, 0) || 1;
  const DEV: Record<string, [string, string]> = { mobile: ["Phone", "bg-brand-500"], tablet: ["Tablet", "bg-sky-400"], desktop: ["Computer", "bg-emerald-400"] };
  return <>
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><h2 className="font-display text-2xl font-extrabold">{e.p.name}</h2>{url && <a className="text-[13px] text-brand-300 underline-offset-2 hover:underline" href={url} target="_blank" rel="noopener noreferrer">{url.replace(/^https:\/\//, "").replace(/\/$/, "")} ↗</a>}</div>
    <Kpis s={s} />
    <Panel title="Views and visitors" right={<Legend />}><Chart s={s} /></Panel>
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Top pages"><Bars rows={s.pages.map((r) => ({ ...r, label: pageName(r.k) }))} empty="No views in this period." /></Panel>
      <Panel title="Where visitors come from" note="Other sites that linked to yours (search engines, social apps). Visitors who typed the address or used a bookmark aren't listed.">
        <Bars rows={s.refs.map((r) => ({ ...r, label: r.k }))} empty="No other site sent visitors in this period." /></Panel>
      <Panel title="Devices">
        <div className="flex h-3 overflow-hidden rounded-full bg-ink-800" aria-hidden>{s.devices.map((d) => <span key={d.k} className={DEV[d.k]?.[1] || "bg-ink-500"} style={{ width: (d.v / devTotal) * 100 + "%" }} />)}</div>
        <ul className="mt-3 grid grid-cols-3 gap-2 text-[13px]">{(["mobile", "tablet", "desktop"] as const).map((k) => { const d = s.devices.find((x) => x.k === k); return <li key={k} className="rounded-xl border border-ink-700 px-3 py-2"><span className="flex items-center gap-1.5 text-ink-400"><i className={`h-2 w-2 rounded-full ${DEV[k][1]}`} />{DEV[k][0]}</span><b className="font-display text-xl">{Math.round(((d?.v || 0) / devTotal) * 100)}%</b></li>; })}</ul>
      </Panel>
      <Panel title="Countries"><Bars rows={s.countries.map((r) => ({ ...r, label: `${flag(r.k)}  ${country(r.k)}` }))} empty="No views in this period." /></Panel>
      {s.sources.length > 0 && <Panel title="Campaigns" note="Links you shared with ?utm_source=… (or ?ref=…) at the end."><Bars rows={s.sources.map((r) => ({ ...r, label: r.k }))} empty="" /></Panel>}
    </div>
  </>;
}

function Kpis({ s, label }: { s: SiteStats; label?: string }) {
  const per = s.visitors ? (s.views / s.visitors).toFixed(1) : "0";
  const Tile = ({ n, l, d, hot }: { n: string; l: string; d?: number; hot?: boolean }) => (
    <div className={`rounded-2xl border p-4 ${hot ? "border-emerald-400/40 bg-emerald-400/5" : "border-ink-700 bg-ink-900"}`}>
      <div className="text-[12px] font-bold uppercase tracking-wider text-ink-400">{l}</div>
      <div className="mt-1 flex items-baseline gap-2"><b className="font-display text-3xl font-extrabold leading-none">{n}</b>
        {d !== undefined && <span className={`text-[12.5px] font-semibold ${d > 0 ? "text-emerald-300" : d < 0 ? "text-red-300" : "text-ink-400"}`}>{d > 0 ? "▲" : d < 0 ? "▼" : "•"} {Math.abs(d)}%</span>}</div>
    </div>);
  return <section aria-label={label || "Totals"} className="flex flex-col gap-2">
    {label && <span className="text-[12.5px] text-ink-400">{label} · compared with the {s.days === 1 ? "day" : s.days + " days"} before</span>}
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile n={fmt(s.views)} l="Page views" d={pct(s.views, s.prevViews)} />
      <Tile n={fmt(s.visitors)} l="Visitors" d={pct(s.visitors, s.prevVisitors)} />
      <Tile n={per} l="Pages per visitor" />
      <Tile n={String(s.live)} l="On the site now" hot={s.live > 0} />
    </div>
  </section>;
}

/** Views (area) and visitors (line) per day, with the numbers of the day under the pointer. */
function Chart({ s }: { s: SiteStats }) {
  const pts = fill(s), W = 1000, H = 220, max = Math.max(4, ...pts.map((p) => p.v)), n = Math.max(1, pts.length - 1);
  const x = (i: number) => (pts.length === 1 ? W / 2 : (i / n) * W), y = (v: number) => H - (v / max) * (H - 14) - 2;
  const line = (k: "v" | "u") => pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p[k]).toFixed(1)}`).join("");
  const [at, setAt] = useState<number | null>(null);
  const label = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const ticks = pts.length <= 1 ? [0] : [0, Math.round(n / 3), Math.round((2 * n) / 3), n];
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-56 w-full overflow-visible" role="img" aria-label={`Page views per day: ${pts.map((p) => p.v).join(", ")}`}
        onMouseMove={(e) => { const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect(); setAt(Math.max(0, Math.min(pts.length - 1, Math.round(((e.clientX - r.left) / r.width) * n)))); }} onMouseLeave={() => setAt(null)}>
        <defs><linearGradient id="an-g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="rgb(var(--brand-500, 91 124 255))" stopOpacity=".45" /><stop offset="1" stopColor="rgb(var(--brand-500, 91 124 255))" stopOpacity="0" /></linearGradient></defs>
        {[0.25, 0.5, 0.75, 1].map((f) => <line key={f} x1="0" x2={W} y1={y(max * f)} y2={y(max * f)} stroke="currentColor" className="text-ink-700" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" />)}
        <path d={`${line("v")}L${x(pts.length - 1)} ${H}L${x(0)} ${H}Z`} fill="url(#an-g)" />
        <path d={line("v")} fill="none" stroke="rgb(var(--brand-400, 129 140 248))" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        <path d={line("u")} fill="none" stroke="rgb(52 211 153)" strokeWidth="2" strokeDasharray="6 5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        {at !== null && <line x1={x(at)} x2={x(at)} y1="0" y2={H} stroke="currentColor" className="text-ink-400" vectorEffect="non-scaling-stroke" />}
      </svg>
      <div className="pointer-events-none absolute right-0 top-0 text-[11px] text-ink-500">{fmt(max)}</div>
      <div className="mt-1 flex justify-between text-[11.5px] text-ink-400">{ticks.map((i) => <span key={i}>{pts[i] ? label(pts[i].day) : ""}</span>)}</div>
      {at !== null && pts[at] && <div className="pointer-events-none absolute top-2 rounded-xl border border-ink-600 bg-ink-900 px-3 py-2 text-[12.5px] shadow-xl" style={{ left: `clamp(0px, calc(${(x(at) / W) * 100}% - 70px), calc(100% - 150px))` }}>
        <b className="block">{new Date(pts[at].day + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</b>
        <span className="text-brand-300">{pts[at].v} views</span> · <span className="text-emerald-300">{pts[at].u} visitors</span></div>}
    </div>
  );
}
const Legend = () => <span className="flex items-center gap-3 text-[12px] text-ink-400"><span className="flex items-center gap-1.5"><i className="h-0.5 w-4 rounded bg-brand-400" />Views</span><span className="flex items-center gap-1.5"><i className="h-0.5 w-4 rounded border-t-2 border-dashed border-emerald-400" />Visitors</span></span>;

function Bars({ rows, empty }: { rows: { label: string; v: number; u: number }[]; empty: string }) {
  if (!rows.length) return <p className="text-[13px] text-ink-400">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.v));
  return <ul className="flex flex-col gap-1.5 text-[13px]">{rows.map((r) => (
    <li key={r.label} className="relative flex items-center gap-3 overflow-hidden rounded-lg px-3 py-1.5">
      <span aria-hidden className="absolute inset-y-0 left-0 rounded-lg bg-brand-500/15" style={{ width: (r.v / max) * 100 + "%" }} />
      <span className="relative min-w-0 flex-1 truncate" title={r.label}>{r.label}</span>
      <b className="relative tabular-nums">{fmt(r.v)}</b><span className="relative w-16 text-right tabular-nums text-ink-400">{fmt(r.u)} ppl</span>
    </li>))}</ul>;
}

function SiteCard({ e, onOpen }: { e: Entry; onOpen: () => void }) {
  const s = e.stats, d = s ? pct(s.views, s.prevViews) : 0;
  return (
    <button type="button" onClick={onOpen} className="card flex w-full flex-col gap-3 p-4 text-left transition hover:-translate-y-0.5 hover:border-ink-500">
      <span className="flex items-center gap-2"><b className="min-w-0 flex-1 truncate">{e.p.name}</b>{s && s.live > 0 && <span className="chip border-emerald-400/50 text-emerald-200"><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />{s.live} now</span>}</span>
      {!s ? <Skel className="h-12 w-full" /> : <>
        <span className="flex items-end gap-4"><span><b className="font-display text-2xl font-extrabold">{fmt(s.views)}</b><span className="block text-[12px] text-ink-400">views</span></span>
          <span><b className="font-display text-2xl font-extrabold">{fmt(s.visitors)}</b><span className="block text-[12px] text-ink-400">visitors</span></span>
          <span className={`ml-auto text-[12.5px] font-semibold ${d > 0 ? "text-emerald-300" : d < 0 ? "text-red-300" : "text-ink-400"}`}>{d > 0 ? "▲" : d < 0 ? "▼" : "•"} {Math.abs(d)}%</span></span>
        <Spark s={s} />
        <span className="truncate text-[12px] text-ink-400">Top page: {s.pages[0] ? pageName(s.pages[0].k) : "none yet"}</span>
      </>}
    </button>
  );
}
function Spark({ s }: { s: SiteStats }) {
  const pts = fill(s), max = Math.max(1, ...pts.map((p) => p.v)), n = Math.max(1, pts.length - 1);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${((i / n) * 100).toFixed(1)} ${(30 - (p.v / max) * 26).toFixed(1)}`).join("");
  return <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="h-10 w-full" aria-hidden><path d={`${d}L100 32L0 32Z`} className="fill-brand-500/15" /><path d={d} fill="none" stroke="rgb(var(--brand-400, 129 140 248))" strokeWidth="1.6" vectorEffect="non-scaling-stroke" /></svg>;
}

const Panel = ({ title, note, right, children }: { title: string; note?: string; right?: React.ReactNode; children: React.ReactNode }) => (
  <section className="card flex flex-col gap-3 p-5" aria-label={title}>
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><h3 className="text-[15px] font-extrabold">{title}</h3>{right && <span className="ml-auto">{right}</span>}</div>
    {note && <p className="-mt-1 text-[12.5px] text-ink-400">{note}</p>}
    {children}
  </section>
);
const SkelPage = () => <div className="flex flex-col gap-4" aria-label="Loading"><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skel key={i} className="h-24 rounded-2xl" />)}</div><Skel className="h-72 rounded-2xl" /></div>;

/** Every day of the period, with the days nobody came as zero. */
function fill(s: SiteStats) {
  const out: { day: string; v: number; u: number }[] = [], by = new Map(s.daily.map((d) => [d.day, d]));
  for (let i = s.days - 1; i >= 0; i--) { const day = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10); out.push(by.get(day) || { day, v: 0, u: 0 }); }
  return out;
}
/** Several sites' numbers as one. */
function combine(all: SiteStats[], days: number): SiteStats {
  const add = (k: "pages" | "refs" | "sources" | "devices" | "countries") => { const m = new Map<string, { k: string; v: number; u: number }>(); for (const s of all) for (const r of s[k]) { const o = m.get(r.k) || { k: r.k, v: 0, u: 0 }; o.v += r.v; o.u += r.u; m.set(r.k, o); } return [...m.values()].sort((a, b) => b.v - a.v).slice(0, 12); };
  const daily = new Map<string, { day: string; v: number; u: number }>(); for (const s of all) for (const d of s.daily) { const o = daily.get(d.day) || { day: d.day, v: 0, u: 0 }; o.v += d.v; o.u += d.u; daily.set(d.day, o); }
  const sum = (k: "views" | "visitors" | "prevViews" | "prevVisitors" | "live") => all.reduce((a, s) => a + (s[k] || 0), 0);
  return { days, from: "", views: sum("views"), visitors: sum("visitors"), prevViews: sum("prevViews"), prevVisitors: sum("prevVisitors"), live: sum("live"), daily: [...daily.values()].sort((a, b) => a.day.localeCompare(b.day)), pages: add("pages"), refs: add("refs"), sources: add("sources"), devices: add("devices"), countries: add("countries") };
}
/** The demo's made-up numbers. */
function sample(days: number, seed: number): SiteStats {
  let r = seed * 97 + 13; const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  const daily = Array.from({ length: days }, (_, i) => { const day = new Date(Date.now() - (days - 1 - i) * 864e5).toISOString().slice(0, 10), v = Math.round(40 + 30 * Math.sin(i / 3 + seed) + rnd() * 50 + i * 0.6); return { day, v, u: Math.round(v * (0.55 + rnd() * 0.15)) }; });
  const views = daily.reduce((a, d) => a + d.v, 0), visitors = daily.reduce((a, d) => a + d.u, 0);
  const share = (k: string, f: number) => ({ k, v: Math.round(views * f), u: Math.round(visitors * f) });
  return { days, from: daily[0].day, views, visitors, prevViews: Math.round(views * (0.8 + rnd() * 0.3)), prevVisitors: Math.round(visitors * 0.9), live: Math.round(rnd() * 4), daily,
    pages: [share("/", 0.46), share("/?p=menu", 0.18), share("/?p=about", 0.12), share("/?p=contact", 0.09), share("/?s=gallery", 0.05)],
    refs: [share("google.com", 0.31), share("instagram.com", 0.14), share("facebook.com", 0.06), share("linkedin.com", 0.03)],
    sources: [share("instagram-bio", 0.08), share("whatsapp", 0.05)], devices: [share("mobile", 0.68), share("desktop", 0.27), share("tablet", 0.05)],
    countries: [share("IN", 0.82), share("US", 0.06), share("AE", 0.05), share("GB", 0.03)] };
}
