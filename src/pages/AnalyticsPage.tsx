// Studio → Analytics: visits to the Studio's live sites, counted by each site's own database (built-in analytics: the
// pages report a view only when the visitor allows analytics; no cookie, nothing that names a visitor is kept).
import { useEffect, useMemo, useRef, useState } from "react";
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

/* The last numbers this device saw, per period: shown at once when the page opens (or the period changes), while the fresh
   ones are read quietly behind them. Kept in this browser only. */
type Snap = { at: number; rows: Record<string, { has: boolean; stats?: SiteStats | null; err?: string; why?: string }> };
const SNAP = (d: number) => "studio-analytics:" + d;
const readSnap = (d: number): Snap | null => { try { const j = JSON.parse(localStorage.getItem(SNAP(d)) || "null"); return j && j.rows ? j : null; } catch { return null; } };
const writeSnap = (d: number, l: Entry[]) => { try { const rows: Snap["rows"] = {}; for (const e of l) if (e.stats !== undefined || !e.src) rows[e.p.id] = { has: !!e.src, stats: e.stats, err: e.err, why: e.why }; localStorage.setItem(SNAP(d), JSON.stringify({ at: Date.now(), rows })); } catch { /* full or private: the next visit reads afresh */ } };
const fromSnap = (projects: ProjectMeta[], sn: Snap): Entry[] => projects.map((p) => { const r = sn.rows[p.id]; return r ? { p, src: r.has ? { cf: { api: "", site: p.id } } : null, stats: r.stats, err: r.err, why: r.why } : { p, src: { cf: { api: "", site: p.id } } }; });
const ago = (t: number) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "just now" : m < 60 ? m + " min ago" : m < 1440 ? Math.round(m / 60) + " h ago" : Math.round(m / 1440) + " d ago"; };

export function AnalyticsPage({ index, demo }: { index: StudioIndex; demo: boolean }) {
  const [days, setDays] = useState(30), [pick, setPick] = useState<string>(() => { try { return sessionStorage.getItem("studio-analytics-site") || ""; } catch { return ""; } });
  const [list, setList] = useState<Entry[] | null>(() => { const sn = demo ? null : readSnap(30); return sn ? fromSnap(index.projects, sn) : null; });
  const [at, setAt] = useState<number | null>(() => (demo ? null : readSnap(30)?.at ?? null)), [busy, setBusy] = useState(false), [again, setAgain] = useState(0);
  useEffect(() => { try { sessionStorage.setItem("studio-analytics-site", pick); } catch { /* private mode */ } }, [pick]);
  const projects = useMemo(() => index.projects.slice(), [index.projects]);
  useEffect(() => {
    let live = true;
    // What this device saw last for this period, straight away; the fresh numbers replace it as they come.
    const sn = demo ? null : readSnap(days), seen = new Map<string, SiteStats | null | undefined>();
    if (sn) { const l = fromSnap(projects, sn); l.forEach((e) => seen.set(e.p.id, e.stats)); setList(l); setAt(sn.at); }
    else { setList((old) => old && old.map((e) => ({ ...e, stats: e.src ? undefined : e.stats }))); setAt(null); }
    setBusy(true);
    (async () => {
      if (demo) { if (live) { setList(projects.map((p, i) => ({ p, src: { cf: { api: "", site: p.id } }, stats: sample(days, i) }))); setBusy(false); } return; }
      const hc = await loadHostConfig().catch(() => null);
      const studioDb = hc && hc.kind === "cloudflare" && cfSession.load(hc.api) ? { api: hc.api } : null;
      const base: Entry[] = projects.map((p) => { const x = sourceOf(p, studioDb), old = seen.get(p.id); return { p, ...x, ...(x.src && old ? { stats: old } : {}) }; });
      if (live) setList(base);
      // Six at a time, so a Studio with a hundred sites doesn't send a hundred requests at once.
      let next = 0;
      const one = async (e: Entry, i: number) => {
        if (!e.src) return;
        try { const s = await siteStats(e.src.cf, days, e.src.account); if (live) setList((l) => l && l.map((x, j) => (j === i ? { ...x, stats: s } : x))); }
        catch (x: any) {
          const msg = x?.status === 401 ? "Sign in to this site's database on this device." : x?.status === 403 ? "You aren't one of this site's people, so its numbers stay with them." : /Unknown|Not found|404/i.test(x?.message || "") ? "Update the database once (Settings → Updates) to start counting." : x?.message || "Couldn't read its numbers.";
          if (live) setList((l) => l && l.map((y, j) => (j === i ? { ...y, stats: null, err: msg } : y)));
        }
      };
      await Promise.all(Array.from({ length: 6 }, async () => { while (live && next < base.length) { const i = next++; await one(base[i], i); } }));
      if (live) { setList((l) => { if (l) writeSnap(days, l); return l; }); setAt(Date.now()); setBusy(false); }
    })();
    return () => { live = false; };
  }, [days, projects, demo, again]);

  const counted = (list || []).filter((e) => e.src && e.stats !== null), off = (list || []).filter((e) => !e.src || e.stats === null);
  const one = pick ? (list || []).find((e) => e.p.id === pick) : null;
  const total = useMemo(() => combine(counted.map((e) => e.stats).filter(Boolean) as SiteStats[], days), [list, days]);
  const loading = counted.some((e) => e.stats === undefined);
  // Switching period from the overview is instant too: once this period is in, the other periods are read behind it, a few sites at a time.
  useEffect(() => {
    if (demo || busy || !list) return; let live = true;
    const t = setTimeout(async () => {
      for (const [d] of RANGES) {
        if (!live || d === days) continue; const sn = readSnap(d); if (sn && Date.now() - sn.at < 10 * 60_000) continue;
        const out: Entry[] = list.map((e) => ({ ...e, stats: e.src && e.stats !== null ? undefined : e.stats })); let next = 0;
        await Promise.all(Array.from({ length: 3 }, async () => { while (live && next < out.length) { const i = next++, e = out[i]; if (!e.src || e.stats === null || !e.src.cf.api) continue; try { out[i] = { ...e, stats: await siteStats(e.src.cf, d, e.src.account) }; } catch { /* left for its own visit */ } } }));
        if (live) writeSnap(d, out.filter((e) => e.stats !== undefined || !e.src));
      }
    }, 2500);
    return () => { live = false; clearTimeout(t); };
  }, [busy]);

  return (
    <main className="mx-auto flex max-w-[1400px] flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-4xl font-extrabold tracking-tight">Analytics</h1>
          <p className="mt-1 max-w-[80ch] text-sm text-ink-400">Visits to your live sites, counted by each site's own database. No cookies and nothing that names a visitor: a page view is sent only when the visitor allows analytics under the site's cookie consent.</p>
        </div>
        <span className="flex items-center gap-2 text-[12.5px] text-ink-400" role="status">{busy ? <><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-400" />{at ? `Updating · shown from ${ago(at)}` : "Reading the numbers…"}</> : at ? <>Updated {ago(at)}<button type="button" className="icon-btn h-7 w-7" aria-label="Read the numbers again" title="Read the numbers again" onClick={() => setAgain((n) => n + 1)}>↻</button></> : null}</span>
        <div role="radiogroup" aria-label="Period" className="flex rounded-full border border-ink-700 p-1">
          {RANGES.map(([d, l]) => <button key={d} type="button" role="radio" aria-checked={days === d} onClick={() => setDays(d)} className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${days === d ? "bg-brand-500 text-white" : "text-ink-300 hover:text-ink-100"}`}>{l}</button>)}
        </div>
      </div>
      {demo && <p className="rounded-xl border border-amber-400/40 bg-amber-400/5 px-4 py-2.5 text-[13px] text-amber-100">Demo: these numbers are made up, to show how the page looks.</p>}

      <SitePicker list={counted} pick={pick} onPick={setPick} />

      {list === null ? <SkelPage /> : one && one.stats ? <SiteView e={one} /> : one && one.stats === undefined ? <SkelPage /> : <>
        <Kpis s={total} label={`All ${counted.length} counted site${counted.length === 1 ? "" : "s"}`} />
        <Panel title="Views and visitors" right={<Legend />}><Chart s={total} /></Panel>
        <Panel title="Sites" note="Search, sort by any column, and press a site for its pages, where visitors come from, their devices and countries.">
          {!counted.length ? <p className="text-[13px] text-ink-400">No site is counted yet. Publish a site with its database on Cloudflare (or a GitHub Pages site with email sign-in), then Push updates so its pages report visits.</p> :
            <SitesTable list={counted} onOpen={setPick} />}
          {loading && !at && <p className="text-[12.5px] text-ink-400" role="status">Reading the sites' numbers…</p>}
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

/** Which site to show: a button that opens a searchable list (any number of sites), busiest first, with each one's views. */
function SitePicker({ list, pick, onPick }: { list: Entry[]; pick: string; onPick: (id: string) => void }) {
  const [open, setOpen] = useState(false), [q, setQ] = useState(""), [at, setAt] = useState(0);
  const box = useRef<HTMLDivElement>(null), input = useRef<HTMLInputElement>(null);
  const cur = list.find((e) => e.p.id === pick);
  const rows = useMemo(() => {
    const w = q.trim().toLowerCase(), sorted = [...list].sort((a, b) => (b.stats?.views || 0) - (a.stats?.views || 0) || a.p.name.localeCompare(b.p.name));
    return [{ id: "", name: "All sites", views: list.reduce((n, e) => n + (e.stats?.views || 0), 0), d: null as number | null },
      ...sorted.filter((e) => !w || e.p.name.toLowerCase().includes(w) || (e.p.client || "").toLowerCase().includes(w)).map((e) => ({ id: e.p.id, name: e.p.name, views: e.stats?.views || 0, d: e.stats ? pct(e.stats.views, e.stats.prevViews) : null }))]
      .filter((r) => r.id || !w);
  }, [list, q]);
  useEffect(() => { if (!open) return; setAt(Math.max(0, rows.findIndex((r) => r.id === pick))); setTimeout(() => input.current?.focus(), 0);
    const off = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); }; addEventListener("mousedown", off); return () => removeEventListener("mousedown", off); }, [open]);
  useEffect(() => setAt(0), [q]);
  const choose = (id: string) => { onPick(id); setOpen(false); setQ(""); };
  const idx = list.findIndex((e) => e.p.id === pick), step = (d: number) => { if (!list.length) return; const n = idx < 0 ? (d > 0 ? 0 : list.length - 1) : (idx + d + list.length) % list.length; onPick(list[n].p.id); };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div ref={box} className="relative">
        <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)} className="card flex min-w-[260px] items-center gap-3 rounded-2xl px-4 py-2.5 text-left transition hover:border-ink-500">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500/15 font-display text-sm font-extrabold text-brand-300">{cur ? cur.p.name.trim()[0]?.toUpperCase() : "∑"}</span>
          <span className="min-w-0 flex-1"><span className="block text-[11px] font-bold uppercase tracking-wider text-ink-400">Showing</span><b className="block truncate">{cur ? cur.p.name : `All sites · ${list.length}`}</b></span>
          <span aria-hidden className="text-ink-400">▾</span>
        </button>
        {open && <div className="card absolute left-0 top-[calc(100%+6px)] z-30 flex w-[min(420px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl shadow-2xl">
          <div className="border-b border-ink-700 p-2"><input ref={input} className="input py-2" placeholder={`Search ${list.length} site${list.length === 1 ? "" : "s"} or clients`} aria-label="Search sites" value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); setAt((a) => Math.min(rows.length - 1, a + 1)); } else if (e.key === "ArrowUp") { e.preventDefault(); setAt((a) => Math.max(0, a - 1)); } else if (e.key === "Enter" && rows[at]) choose(rows[at].id); else if (e.key === "Escape") setOpen(false); }} /></div>
          <ul role="listbox" aria-label="Sites" className="scroll-thin max-h-[min(420px,60vh)] overflow-auto p-1.5">
            {rows.map((r, i) => <li key={r.id || "all"} role="option" aria-selected={r.id === pick}>
              <button type="button" onMouseEnter={() => setAt(i)} onClick={() => choose(r.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[13.5px] ${i === at ? "bg-ink-800" : ""} ${r.id === pick ? "text-brand-300" : ""}`}>
                <span className="min-w-0 flex-1 truncate font-semibold">{r.name}</span>
                <span className="tabular-nums text-ink-300">{fmt(r.views)}</span>
                <span className={`w-12 text-right text-[12px] tabular-nums ${r.d === null ? "text-ink-500" : r.d > 0 ? "text-emerald-300" : r.d < 0 ? "text-red-300" : "text-ink-400"}`}>{r.d === null ? "" : (r.d > 0 ? "+" : "") + r.d + "%"}</span>
              </button></li>)}
            {rows.length === (q.trim() ? 0 : 1) && q.trim() && <li className="px-3 py-3 text-[13px] text-ink-400">No site matches “{q}”.</li>}
          </ul>
        </div>}
      </div>
      {list.length > 1 && <div className="flex gap-1"><button type="button" className="icon-btn h-10 w-10 rounded-xl" aria-label="Previous site" onClick={() => step(-1)}>‹</button><button type="button" className="icon-btn h-10 w-10 rounded-xl" aria-label="Next site" onClick={() => step(1)}>›</button></div>}
      {pick && <button type="button" className="btn btn-ghost btn-sm" onClick={() => onPick("")}>← All sites</button>}
    </div>
  );
}

/** Every site in one table: search, sort by any column, the busiest first; long lists show the first rows until asked. */
function SitesTable({ list, onOpen }: { list: Entry[]; onOpen: (id: string) => void }) {
  type K = "name" | "views" | "visitors" | "change" | "live";
  const [q, setQ] = useState(""), [by, setBy] = useState<K>("views"), [asc, setAsc] = useState(false), [all, setAll] = useState(false);
  const val = (e: Entry, k: K): number | string => { const s = e.stats; return k === "name" ? e.p.name.toLowerCase() : !s ? -1 : k === "views" ? s.views : k === "visitors" ? s.visitors : k === "live" ? s.live : pct(s.views, s.prevViews); };
  const rows = useMemo(() => { const w = q.trim().toLowerCase(); return list.filter((e) => !w || e.p.name.toLowerCase().includes(w) || (e.p.client || "").toLowerCase().includes(w)).sort((a, b) => { const x = val(a, by), y = val(b, by); const c = x < y ? -1 : x > y ? 1 : 0; return asc ? c : -c; }); }, [list, q, by, asc]);
  const shown = all ? rows : rows.slice(0, 15);
  const H = ({ k, children, right }: { k: K; children: React.ReactNode; right?: boolean }) => <th scope="col" aria-sort={by === k ? (asc ? "ascending" : "descending") : "none"} className={`px-3 py-2 font-semibold ${right ? "text-right" : "text-left"}`}><button type="button" className={`inline-flex items-center gap-1 uppercase tracking-wider hover:text-ink-100 ${by === k ? "text-ink-100" : ""}`} onClick={() => { if (by === k) setAsc(!asc); else { setBy(k); setAsc(k === "name"); } }}>{children}<span aria-hidden className="text-[10px]">{by === k ? (asc ? "▲" : "▼") : ""}</span></button></th>;
  return (
    <div className="flex flex-col gap-3">
      {list.length > 6 && <input className="input max-w-sm py-2" placeholder={`Search ${list.length} sites or clients`} aria-label="Search the sites" value={q} onChange={(e) => setQ(e.target.value)} />}
      <div className="scroll-thin overflow-x-auto rounded-xl border border-ink-700">
        <table className="w-full min-w-[720px] text-[13.5px]">
          <thead className="bg-ink-950/50 text-[12px] uppercase tracking-wider text-ink-400"><tr>
            <H k="name">Site</H><H k="views" right>Views</H><H k="visitors" right>Visitors</H><H k="change" right>Change</H><H k="live" right>Now</H>
            <th scope="col" className="px-3 py-2 text-left font-semibold">Trend</th><th scope="col" className="px-3 py-2 text-left font-semibold">Top page</th></tr></thead>
          <tbody className="divide-y divide-ink-700">
            {shown.map((e) => { const s = e.stats, d = s ? pct(s.views, s.prevViews) : 0; return (
              <tr key={e.p.id} className="cursor-pointer transition hover:bg-ink-800/60" onClick={() => onOpen(e.p.id)}>
                <td className="px-3 py-2.5"><button type="button" className="text-left font-semibold hover:text-brand-300" onClick={(x) => { x.stopPropagation(); onOpen(e.p.id); }}>{e.p.name}</button>{e.p.client?.trim() && <span className="block text-[12px] text-ink-400">{e.p.client}</span>}</td>
                {!s ? <td colSpan={6} className="px-3 py-2.5"><Skel className="h-4 w-full" /></td> : <>
                  <td className="px-3 py-2.5 text-right font-display text-base font-extrabold tabular-nums">{fmt(s.views)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmt(s.visitors)}</td>
                  <td className={`px-3 py-2.5 text-right text-[12.5px] font-semibold tabular-nums ${d > 0 ? "text-emerald-300" : d < 0 ? "text-red-300" : "text-ink-400"}`}>{d > 0 ? "▲" : d < 0 ? "▼" : "•"} {Math.abs(d)}%</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{s.live ? <span className="inline-flex items-center gap-1.5 text-emerald-300"><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />{s.live}</span> : <span className="text-ink-500">0</span>}</td>
                  <td className="w-40 px-3 py-1"><Spark s={s} /></td>
                  <td className="max-w-[200px] truncate px-3 py-2.5 text-ink-300">{s.pages[0] ? pageName(s.pages[0].k) : "—"}</td></>}
              </tr>); })}
            {!rows.length && <tr><td colSpan={7} className="px-3 py-4 text-ink-400">No site matches “{q}”.</td></tr>}
          </tbody>
        </table>
      </div>
      {rows.length > 15 && <button type="button" className="btn btn-sm self-start" onClick={() => setAll(!all)}>{all ? "Show the first 15" : `Show all ${rows.length} sites`}</button>}
    </div>
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
