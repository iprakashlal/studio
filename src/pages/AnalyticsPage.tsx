// Studio → Analytics: visits to the Studio's live sites, counted by each site's own database (built-in analytics: the
// pages report a view only when the visitor allows analytics; no cookie, nothing that names a visitor is kept).
import { useEffect, useMemo, useRef, useState } from "react";
import type { ProjectMeta, StudioIndex } from "../lib/studio";
import { cfSession, siteStats, type SiteStats, type StatsAsk } from "../lib/cfdb";
import { ACTIONS, DEFAULT_CRITERIA, SECTIONS, buildReport, dur, filled, headline, pageName, type Criteria } from "../lib/analyticsreport";
import { brand } from "../lib/brand";
import { downloadBlob } from "../lib/exporter";
import { useToast } from "../ui/kit";
import { loadHostConfig } from "../lib/studiohost";
import { siteAddress } from "../lib/hosting";
import { TEMPLATES } from "../schema";
import { Skel } from "../ui/kit";

type Src = { cf: { api: string; site: string }; account?: string };
type Entry = { p: ProjectMeta; src: Src | null; why?: string; stats?: SiteStats | null; err?: string };
const RANGES: [string, string][] = [["d1", "Today"], ["d7", "7 days"], ["d30", "30 days"], ["d90", "90 days"], ["d365", "12 months"]];
const today = () => new Date().toISOString().slice(0, 10);
/** A period as the database is asked for it: "d30" (the last 30 days) or "c:2026-01-01:2026-01-31" (from, to). */
const askOf = (rk: string): StatsAsk => { const m = /^c:(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/.exec(rk); return m ? { from: m[1], to: m[2] } : { days: +rk.slice(1) || 30 }; };
const spanOf = (rk: string) => { const a = askOf(rk); return a.from ? Math.round((Date.parse(a.to!) - Date.parse(a.from)) / 864e5) + 1 : a.days || 30; };

const fmt = (n: number) => (n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e4 ? Math.round(n / 1e3) + "k" : n >= 1e3 ? (n / 1e3).toFixed(1) + "k" : String(n));
const pct = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 100) : a ? 100 : 0);
const flag = (cc: string) => (/^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : "🌐");
const country = (() => { let d: Intl.DisplayNames | null = null; try { d = new Intl.DisplayNames(["en"], { type: "region" }); } catch { /* old browser */ } return (cc: string) => { try { return (d && d.of(cc)) || cc; } catch { return cc; } }; })();
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
const SNAP = (d: string) => "studio-analytics:" + d;
const readSnap = (d: string): Snap | null => { try { const j = JSON.parse(localStorage.getItem(SNAP(d)) || "null"); return j && j.rows ? j : null; } catch { return null; } };
const writeSnap = (d: string, l: Entry[]) => { try { const rows: Snap["rows"] = {}; for (const e of l) if (e.stats !== undefined || !e.src) rows[e.p.id] = { has: !!e.src, stats: e.stats, err: e.err, why: e.why }; localStorage.setItem(SNAP(d), JSON.stringify({ at: Date.now(), rows })); } catch { /* full or private: the next visit reads afresh */ } };
const fromSnap = (projects: ProjectMeta[], sn: Snap): Entry[] => projects.map((p) => { const r = sn.rows[p.id]; return r ? { p, src: r.has ? { cf: { api: "", site: p.id } } : null, stats: r.stats, err: r.err, why: r.why } : { p, src: { cf: { api: "", site: p.id } } }; });
const ago = (t: number) => { const sec = Math.round((Date.now() - t) / 1000), m = Math.round(sec / 60); return sec < 10 ? "just now" : sec < 60 ? sec + "s ago" : m < 60 ? m + " min ago" : m < 1440 ? Math.round(m / 60) + " h ago" : Math.round(m / 1440) + " d ago"; };

export function AnalyticsPage({ index, demo }: { index: StudioIndex; demo: boolean }) {
  const [rk, setRk] = useState("d30"), [view, setView] = useState<"dash" | "reports">("dash"), [pick, setPick] = useState<string>(() => { try { return sessionStorage.getItem("studio-analytics-site") || ""; } catch { return ""; } });
  const [list, setList] = useState<Entry[] | null>(() => { const sn = demo ? null : readSnap("d30"); return sn ? fromSnap(index.projects, sn) : null; });
  const [at, setAt] = useState<number | null>(() => (demo ? null : readSnap("d30")?.at ?? null)), [busy, setBusy] = useState(false), [again, setAgain] = useState(0);
  useEffect(() => { try { sessionStorage.setItem("studio-analytics-site", pick); } catch { /* private mode */ } }, [pick]);
  const projects = useMemo(() => index.projects.slice(), [index.projects]);
  useEffect(() => {
    let live = true;
    // What this device saw last for this period, straight away; the fresh numbers replace it as they come.
    const sn = demo ? null : readSnap(rk), seen = new Map<string, SiteStats | null | undefined>();
    if (sn) { const l = fromSnap(projects, sn); l.forEach((e) => seen.set(e.p.id, e.stats)); setList(l); setAt(sn.at); }
    else { setList((old) => old && old.map((e) => ({ ...e, stats: e.src ? undefined : e.stats }))); setAt(null); }
    setBusy(true);
    (async () => {
      if (demo) { if (live) { setList(projects.map((p, i) => ({ p, src: { cf: { api: "", site: p.id } }, stats: sample(rk, i) }))); setBusy(false); } return; }
      const hc = await loadHostConfig().catch(() => null);
      const studioDb = hc && hc.kind === "cloudflare" && cfSession.load(hc.api) ? { api: hc.api } : null;
      const base: Entry[] = projects.map((p) => { const x = sourceOf(p, studioDb), old = seen.get(p.id); return { p, ...x, ...(x.src && old ? { stats: old } : {}) }; });
      if (live) setList(base);
      // Six at a time, so a Studio with a hundred sites doesn't send a hundred requests at once.
      let next = 0;
      const one = async (e: Entry, i: number) => {
        if (!e.src) return;
        try { const s = await siteStats(e.src.cf, askOf(rk), e.src.account); if (live) setList((l) => l && l.map((x, j) => (j === i ? { ...x, stats: s } : x))); }
        catch (x: any) {
          const msg = x?.status === 401 ? "Sign in to this site's database on this device." : x?.status === 403 ? "You aren't one of this site's people, so its numbers stay with them." : /Unknown|Not found|404/i.test(x?.message || "") ? "Update the database once (Settings → Updates) to start counting." : x?.message || "Couldn't read its numbers.";
          if (live) setList((l) => l && l.map((y, j) => (j === i ? { ...y, stats: null, err: msg } : y)));
        }
      };
      await Promise.all(Array.from({ length: 6 }, async () => { while (live && next < base.length) { const i = next++; await one(base[i], i); } }));
      if (live) { setList((l) => { if (l) writeSnap(rk, l); return l; }); setAt(Date.now()); setBusy(false); }
    })();
    return () => { live = false; };
  }, [rk, projects, demo, again]);
  // Live: the numbers read themselves again every minute while this page is on screen (and as soon as it comes back),
  // quietly, behind what is shown. Hidden tabs ask for nothing.
  useEffect(() => {
    if (demo) return;
    const due = () => document.visibilityState === "visible" && (!at || Date.now() - at > 55_000);
    const tick = setInterval(() => { if (!busy && due()) setAgain((n) => n + 1); }, 60_000);
    const back = () => { if (!busy && due()) setAgain((n) => n + 1); };
    document.addEventListener("visibilitychange", back);
    return () => { clearInterval(tick); document.removeEventListener("visibilitychange", back); };
  }, [busy, at, demo]);

  const counted = (list || []).filter((e) => e.src && e.stats !== null), off = (list || []).filter((e) => !e.src || e.stats === null);
  const one = pick ? (list || []).find((e) => e.p.id === pick) : null;
  const total = useMemo(() => combine(counted.map((e) => e.stats).filter(Boolean) as SiteStats[], rk), [list, rk]);
  const loading = counted.some((e) => e.stats === undefined);
  // Switching period from the overview is instant too: once this period is in, the other periods are read behind it, a few sites at a time.
  useEffect(() => {
    if (demo || busy || !list) return; let live = true;
    const t = setTimeout(async () => {
      for (const [d] of RANGES) {
        if (!live || d === rk) continue; const sn = readSnap(d); if (sn && Date.now() - sn.at < 10 * 60_000) continue;
        const out: Entry[] = list.map((e) => ({ ...e, stats: e.src && e.stats !== null ? undefined : e.stats })); let next = 0;
        await Promise.all(Array.from({ length: 3 }, async () => { while (live && next < out.length) { const i = next++, e = out[i]; if (!e.src || e.stats === null || !e.src.cf.api) continue; try { out[i] = { ...e, stats: await siteStats(e.src.cf, askOf(d), e.src.account) }; } catch { /* left for its own visit */ } } }));
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
        <LiveStatus busy={busy} at={at} onRefresh={() => setAgain((n) => n + 1)} />
        {view === "dash" && <Period rk={rk} onRk={setRk} />}
      </div>
      <div role="tablist" aria-label="Analytics" className="-mb-2 flex gap-1 border-b border-ink-700">
        {([["dash", "Dashboard"], ["reports", "Reports & downloads"]] as const).map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={view === k} onClick={() => setView(k)} className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition ${view === k ? "border-brand-400 text-ink-100" : "border-transparent text-ink-400 hover:text-ink-200"}`}>{l}</button>)}
      </div>
      {demo && <p className="rounded-xl border border-amber-400/40 bg-amber-400/5 px-4 py-2.5 text-[13px] text-amber-100">Demo: these numbers are made up, to show how the page looks.</p>}

      {view === "reports" ? <Reports list={counted} rk={rk} loading={loading || busy} /> : <>
      <SitePicker list={counted} pick={pick} onPick={setPick} />

      {list === null ? <SkelPage /> : one && one.stats ? <SiteView e={one} /> : one && one.stats === undefined ? <SkelPage /> : <>
        <Kpis s={total} label={`All ${counted.length} counted site${counted.length === 1 ? "" : "s"}`} />
        <Panel title="Views and visitors" right={<Legend />}><Chart s={total} /></Panel>
        <div className="grid gap-4 lg:grid-cols-2"><ActionsPanel s={total} /><ProductsPanel s={total} short /></div>
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
      </>}
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
      <Panel title="Top pages" note="Views, then the average time on the page."><Bars rows={s.pages.map((r) => ({ ...r, label: pageName(r.k), extra: r.t ? dur(r.t) : "" }))} empty="No views in this period." /></Panel>
      <Panel title="Where visitors come from" note="Other sites that linked to yours (search engines, social apps). Visitors who typed the address or used a bookmark aren't listed.">
        <Bars rows={s.refs.map((r) => ({ ...r, label: r.k }))} empty="No other site sent visitors in this period." /></Panel>
      <Panel title="Devices">
        <div className="flex h-3 overflow-hidden rounded-full bg-ink-800" aria-hidden>{s.devices.map((d) => <span key={d.k} className={DEV[d.k]?.[1] || "bg-ink-500"} style={{ width: (d.v / devTotal) * 100 + "%" }} />)}</div>
        <ul className="mt-3 grid grid-cols-3 gap-2 text-[13px]">{(["mobile", "tablet", "desktop"] as const).map((k) => { const d = s.devices.find((x) => x.k === k); return <li key={k} className="rounded-xl border border-ink-700 px-3 py-2"><span className="flex items-center gap-1.5 text-ink-400"><i className={`h-2 w-2 rounded-full ${DEV[k][1]}`} />{DEV[k][0]}</span><b className="font-display text-xl">{Math.round(((d?.v || 0) / devTotal) * 100)}%</b></li>; })}</ul>
      </Panel>
      <Panel title="Countries"><Bars rows={s.countries.map((r) => ({ ...r, label: `${flag(r.k)}  ${country(r.k)}` }))} empty="No views in this period." /></Panel>
      <Panel title="Landing pages" note="The first page of a visit."><Bars rows={(s.entries || []).map((r) => ({ ...r, label: pageName(r.k) }))} empty="No visits in this period." plain /></Panel>
      <Panel title="Exit pages" note="The last page of a visit."><Bars rows={(s.exits || []).map((r) => ({ ...r, label: pageName(r.k) }))} empty="No visits in this period." plain /></Panel>
      <ActionsPanel s={s} />
      <WhenPanel s={s} />
      <div className="lg:col-span-2"><ProductsPanel s={s} /></div>
      {(s.outs || []).length > 0 && <Panel title="Links out" note="Other sites visitors left to from yours."><Bars rows={(s.outs || []).map((r) => ({ ...r, label: r.k }))} empty="" plain /></Panel>}
      {s.sources.length > 0 && <Panel title="Campaigns" note="Links you shared with ?utm_source=… (or ?ref=…) at the end."><Bars rows={s.sources.map((r) => ({ ...r, label: r.k }))} empty="" /></Panel>}
    </div>
  </>;
}

function Kpis({ s, label }: { s: SiteStats; label?: string }) {
  const H = headline(s), get = (k: string) => H.find((h) => h.k === k)!, shop = (s.orders || 0) + (s.prevOrders || 0) > 0;
  const Tile = ({ k, hot, big }: { k: string; hot?: boolean; big?: boolean }) => {
    const h = get(k), d = h.k === "depth" || h.k === "enquiries" ? undefined : pct(h.v, h.p), good = d === undefined || !d ? null : (d > 0) !== !!(h as any).lowerBetter;
    return (
      <div className={`rounded-2xl border p-4 ${hot ? "border-emerald-400/40 bg-emerald-400/5" : "border-ink-700 bg-ink-900"}`}>
        <div className="text-[11.5px] font-bold uppercase tracking-wider text-ink-400">{h.label}</div>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2"><b className={`font-display font-extrabold leading-none ${big ? "text-3xl" : "text-2xl"}`}>{k === "views" || k === "visitors" ? fmt(h.v) : h.show}</b>
          {d !== undefined && <span className={`text-[12px] font-semibold ${good === true ? "text-emerald-300" : good === false ? "text-red-300" : "text-ink-400"}`}>{d > 0 ? "▲" : d < 0 ? "▼" : "•"} {Math.abs(d)}%</span>}</div>
      </div>);
  };
  return <section aria-label={label || "Totals"} className="flex flex-col gap-2">
    {label && <span className="text-[12.5px] text-ink-400">{label} · compared with the {s.days === 1 ? "day" : s.days + " days"} before</span>}
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile k="views" big /><Tile k="visitors" big /><Tile k="time" big />
      <div className={`rounded-2xl border p-4 ${s.live ? "border-emerald-400/40 bg-emerald-400/5" : "border-ink-700 bg-ink-900"}`}><div className="text-[11.5px] font-bold uppercase tracking-wider text-ink-400">On the site now</div><b className="mt-1 flex items-center gap-2 font-display text-3xl font-extrabold leading-none">{s.live > 0 && <i className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />}{s.live}</b></div>
    </div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Tile k="ppv" /><Tile k="bounce" /><Tile k="depth" /><Tile k="enquiries" /></div>
    {shop && <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Tile k="orders" /><Tile k="revenue" /><Tile k="aov" /><Tile k="conv" /></div>}
  </section>;
}

/** Calls, WhatsApp, emails, forms, adds to cart and links out: what visitors did. */
function ActionsPanel({ s }: { s: SiteStats }) {
  const a = s.actions || {}, any = ACTIONS.some(([k]) => a[k]);
  return <Panel title="Actions" note="Taps on call, WhatsApp and email links, forms sent, adds to cart and links out to other sites.">
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">{ACTIONS.map(([k, l]) => <li key={k} className="rounded-xl border border-ink-700 px-3 py-2.5"><span className="block text-[12px] text-ink-400">{l}</span><b className="font-display text-xl">{fmt(a[k] || 0)}</b>{s.visitors > 0 && <span className="ml-1.5 text-[11.5px] text-ink-500">{(((a[k] || 0) / s.visitors) * 100).toFixed(1)} per 100</span>}</li>)}</ul>
    {!any && <p className="text-[12.5px] text-ink-400">Nothing yet in this period.</p>}
  </Panel>;
}
/** Products: seen in a list (impressions), their page opened, time on it, added to the cart. */
function ProductsPanel({ s, short }: { s: SiteStats; short?: boolean }) {
  const rows = (s.products || []).slice(0, short ? 6 : 50);
  return <Panel title="Products" note={short ? "Top products across the sites. Open a site for all of them." : "Impressions: shown on screen in a list. Views: its own page opened. Click-through: views per impression."}>
    {!rows.length ? <p className="text-[13px] text-ink-400">No product seen in this period (shops, restaurant menus and business product pages report them).</p> :
      <div className="scroll-thin overflow-x-auto"><table className="w-full min-w-[560px] text-[13px]">
        <thead className="text-[11.5px] uppercase tracking-wider text-ink-400"><tr><th className="py-1.5 pr-3 text-left font-semibold">Product</th><th className="px-2 text-right font-semibold">Impressions</th><th className="px-2 text-right font-semibold">Views</th><th className="px-2 text-right font-semibold">Click-through</th>{!short && <th className="px-2 text-right font-semibold">Time on page</th>}<th className="pl-2 text-right font-semibold">Cart</th></tr></thead>
        <tbody className="divide-y divide-ink-700">{rows.map((p) => <tr key={p.k}><td className="max-w-[220px] truncate py-1.5 pr-3 font-semibold" title={p.k}>{p.k}</td><td className="px-2 text-right tabular-nums">{fmt(p.imp)}</td><td className="px-2 text-right tabular-nums">{fmt(p.v)}</td><td className="px-2 text-right tabular-nums text-ink-300">{p.imp ? ((p.v / p.imp) * 100).toFixed(1) + "%" : "—"}</td>{!short && <td className="px-2 text-right tabular-nums text-ink-300">{p.t ? dur(p.t) : "—"}</td>}<td className="pl-2 text-right tabular-nums">{fmt(p.cart)}</td></tr>)}</tbody>
      </table></div>}
  </Panel>;
}
/** When visitors come: by hour of the day and by weekday. */
function WhenPanel({ s }: { s: SiteStats }) {
  const h = s.hours || Array(24).fill(0), w = s.week || Array(7).fill(0), mh = Math.max(1, ...h), mw = Math.max(1, ...w), WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return <Panel title="When visitors come" note="Page views by hour of the day (your time) and by day of the week.">
    <div className="flex h-28 items-end gap-[3px]" aria-label="By hour">{h.map((v, i) => <span key={i} title={`${String(i).padStart(2, "0")}:00 · ${v} views`} className="flex-1 rounded-t bg-brand-500/70 transition hover:bg-brand-400" style={{ height: Math.max(2, (v / mh) * 100) + "%" }} />)}</div>
    <div className="flex justify-between text-[11px] text-ink-500"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>
    <ul className="mt-2 grid grid-cols-7 gap-1.5 text-center text-[11.5px]">{[1, 2, 3, 4, 5, 6, 0].map((d) => <li key={d} className="flex flex-col items-center gap-1"><span className="flex h-14 w-full items-end overflow-hidden rounded-lg bg-ink-800"><span className="w-full bg-emerald-400/70" style={{ height: (w[d] / mw) * 100 + "%" }} /></span><span className="text-ink-400">{WD[d]}</span><b className="tabular-nums">{fmt(w[d])}</b></li>)}</ul>
  </Panel>;
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

function Bars({ rows, empty, plain }: { rows: { label: string; v: number; u: number; extra?: string }[]; empty: string; plain?: boolean }) {
  if (!rows.length) return <p className="text-[13px] text-ink-400">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.v));
  return <ul className="flex flex-col gap-1.5 text-[13px]">{rows.map((r) => (
    <li key={r.label} className="relative flex items-center gap-3 overflow-hidden rounded-lg px-3 py-1.5">
      <span aria-hidden className="absolute inset-y-0 left-0 rounded-lg bg-brand-500/15" style={{ width: (r.v / max) * 100 + "%" }} />
      <span className="relative min-w-0 flex-1 truncate" title={r.label}>{r.label}</span>
      <b className="relative tabular-nums">{fmt(r.v)}</b>{!plain && <span className="relative w-16 text-right tabular-nums text-ink-400">{r.extra !== undefined ? r.extra || "—" : fmt(r.u) + " ppl"}</span>}
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

const fill = (s: SiteStats) => filled(s);
/** Several sites' numbers as one. */
function combine(all: SiteStats[], rk: string): SiteStats {
  const add = (k: "pages" | "refs" | "sources" | "devices" | "countries" | "entries" | "exits" | "outs") => { const m = new Map<string, { k: string; v: number; u: number }>(); for (const s of all) for (const r of s[k] || []) { const o = m.get(r.k) || { k: r.k, v: 0, u: 0 }; o.v += r.v; o.u += r.u; m.set(r.k, o); } return [...m.values()].sort((a, b) => b.v - a.v).slice(0, 50); };
  const daily = new Map<string, { day: string; v: number; u: number; d: number }>(); for (const s of all) for (const d of s.daily) { const o = daily.get(d.day) || { day: d.day, v: 0, u: 0, d: 0 }; o.v += d.v; o.u += d.u; o.d += d.d || 0; daily.set(d.day, o); }
  const sum = (k: keyof SiteStats) => all.reduce((a, s) => a + (+(s[k] as any) || 0), 0);
  // Pages keep their time and read depth, weighted by views.
  const PG = new Map<string, { k: string; v: number; u: number; t: number; dp: number }>(); for (const s of all) for (const r of s.pages) { const o = PG.get(r.k) || { k: r.k, v: 0, u: 0, t: 0, dp: 0 }; o.t = (o.t * o.v + (r.t || 0) * r.v) / Math.max(1, o.v + r.v); o.dp = (o.dp * o.v + (r.dp || 0) * r.v) / Math.max(1, o.v + r.v); o.v += r.v; o.u += r.u; PG.set(r.k, o); }
  const P = new Map<string, { k: string; imp: number; v: number; t: number; cart: number }>(); for (const s of all) for (const p of s.products || []) { const o = P.get(p.k) || { k: p.k, imp: 0, v: 0, t: 0, cart: 0 }; o.t = (o.t * o.v + p.t * p.v) / Math.max(1, o.v + p.v); o.imp += p.imp; o.v += p.v; o.cart += p.cart; P.set(p.k, o); }
  const actions: Record<string, number> = {}; for (const s of all) for (const [k, v] of Object.entries(s.actions || {})) actions[k] = (actions[k] || 0) + v;
  const arr = (k: "hours" | "week", n: number) => { const o = Array(n).fill(0); for (const s of all) (s[k] || []).forEach((v, i) => (o[i] += v)); return o; };
  const a = askOf(rk), to = a.to || today(), from = a.from || new Date(Date.now() - ((a.days || 30) - 1) * 864e5).toISOString().slice(0, 10), timed = sum("timed");
  return { days: spanOf(rk), from, to, views: sum("views"), visitors: sum("visitors"), prevViews: sum("prevViews"), prevVisitors: sum("prevVisitors"), live: sum("live"),
    time: sum("time"), timed, prevTime: sum("prevTime"), depth: timed ? Math.round(all.reduce((x, s) => x + (s.depth || 0) * (s.timed || 0), 0) / timed) : 0, bounces: sum("bounces"), prevBounces: sum("prevBounces"),
    orders: sum("orders"), revenue: sum("revenue"), enquiries: sum("enquiries"), prevOrders: sum("prevOrders"), prevRevenue: sum("prevRevenue"),
    daily: [...daily.values()].sort((x, y) => x.day.localeCompare(y.day)), hours: arr("hours", 24), week: arr("week", 7),
    pages: [...PG.values()].map((x) => ({ ...x, t: Math.round(x.t), dp: Math.round(x.dp) })).sort((a, b) => b.v - a.v).slice(0, 50), entries: add("entries"), exits: add("exits"), refs: add("refs"), sources: add("sources"), devices: add("devices"), countries: add("countries"), outs: add("outs"),
    products: [...P.values()].map((p) => ({ ...p, t: Math.round(p.t) })).sort((x, y) => y.v - x.v || y.imp - x.imp).slice(0, 50), actions };
}
/** The demo's made-up numbers. */
function sample(rk: string, seed: number): SiteStats {
  const days = spanOf(rk), a = askOf(rk), end = a.to ? Date.parse(a.to) : Date.now();
  let r = seed * 97 + 13; const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  const daily = Array.from({ length: days }, (_, i) => { const day = new Date(end - (days - 1 - i) * 864e5).toISOString().slice(0, 10), v = Math.round(40 + 30 * Math.sin(i / 3 + seed) + rnd() * 50 + i * 0.6), u = Math.round(v * (0.55 + rnd() * 0.15)); return { day, v, u, d: Math.round(u * (60 + rnd() * 90)) }; });
  const views = daily.reduce((x, d) => x + d.v, 0), visitors = daily.reduce((x, d) => x + d.u, 0), time = daily.reduce((x, d) => x + d.d, 0);
  const share = (k: string, f: number) => ({ k, v: Math.round(views * f), u: Math.round(visitors * f) });
  const orders = Math.round(visitors * 0.021);
  return { days, from: daily[0].day, to: daily[daily.length - 1].day, views, visitors, prevViews: Math.round(views * (0.8 + rnd() * 0.3)), prevVisitors: Math.round(visitors * 0.9), live: Math.round(rnd() * 4), daily,
    time, timed: views, prevTime: Math.round(time * 0.92), depth: 58, bounces: Math.round(visitors * 0.38), prevBounces: Math.round(visitors * 0.41), orders, revenue: orders * 1450, enquiries: Math.round(visitors * 0.012), prevOrders: Math.round(orders * 0.85), prevRevenue: Math.round(orders * 0.85 * 1380),
    hours: Array.from({ length: 24 }, (_, h) => Math.round((views / 24) * (0.2 + Math.max(0, Math.sin(((h - 6) / 24) * Math.PI * 2)) * 1.8))), week: [0.11, 0.15, 0.15, 0.14, 0.15, 0.16, 0.14].map((f) => Math.round(views * f)),
    pages: [share("/", 0.46), share("/products.html", 0.18), share("/product.html?p=stoneware-mug", 0.12), share("/about.html", 0.09), share("/?s=gallery", 0.05)].map((x, i) => ({ ...x, t: [42, 65, 88, 51, 30][i], dp: [62, 70, 81, 55, 48][i] })),
    entries: [share("/", 0.4), share("/product.html?p=stoneware-mug", 0.08), share("/products.html", 0.06)], exits: [share("/", 0.22), share("/product.html?p=stoneware-mug", 0.1), share("/about.html", 0.07)],
    refs: [share("google.com", 0.31), share("instagram.com", 0.14), share("facebook.com", 0.06), share("linkedin.com", 0.03)],
    sources: [share("instagram-bio", 0.08), share("whatsapp", 0.05)], devices: [share("mobile", 0.68), share("desktop", 0.27), share("tablet", 0.05)],
    countries: [share("IN", 0.82), share("US", 0.06), share("AE", 0.05), share("GB", 0.03)],
    products: [["Stoneware mug", 0.9, 0.12, 0.03], ["Serving bowl", 0.7, 0.08, 0.02], ["Linen napkins", 0.6, 0.05, 0.01], ["Dot-grid notebook", 0.5, 0.04, 0.012]].map(([k, i, v, c]) => ({ k: String(k), imp: Math.round(views * +i), v: Math.round(views * +v), t: Math.round(60 + rnd() * 60), cart: Math.round(views * +c) })),
    actions: { call: Math.round(visitors * 0.03), whatsapp: Math.round(visitors * 0.05), email: Math.round(visitors * 0.01), form: Math.round(visitors * 0.012), cart: Math.round(views * 0.06), out: Math.round(visitors * 0.04) }, outs: [share("instagram.com", 0.02), share("maps.google.com", 0.015)] };
}

/** The period: a preset, or a custom range of dates (up to a year, within the last 13 months). */
function Period({ rk, onRk }: { rk: string; onRk: (v: string) => void }) {
  const custom = rk.startsWith("c:"), a = askOf(rk);
  const [open, setOpen] = useState(false), [from, setFrom] = useState(a.from || new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10)), [to, setTo] = useState(a.to || today());
  const min = new Date(Date.now() - 395 * 864e5).toISOString().slice(0, 10), ok = from <= to && from >= min && to <= today() && (Date.parse(to) - Date.parse(from)) / 864e5 < 366;
  const label = custom ? `${new Date(a.from + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${new Date(a.to + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : "Custom";
  return (
    <div className="relative flex flex-col items-end gap-2">
      <div role="radiogroup" aria-label="Period" className="flex flex-wrap rounded-full border border-ink-700 p-1">
        {RANGES.map(([d, l]) => <button key={d} type="button" role="radio" aria-checked={rk === d} onClick={() => { onRk(d); setOpen(false); }} className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${rk === d ? "bg-brand-500 text-white" : "text-ink-300 hover:text-ink-100"}`}>{l}</button>)}
        <button type="button" role="radio" aria-checked={custom} aria-expanded={open} onClick={() => setOpen(!open)} className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${custom ? "bg-brand-500 text-white" : "text-ink-300 hover:text-ink-100"}`}>📅 {label}</button>
      </div>
      {open && <div className="card absolute right-0 top-[calc(100%+6px)] z-30 flex w-[min(360px,calc(100vw-32px))] flex-col gap-3 rounded-2xl p-4 shadow-2xl" role="dialog" aria-label="Custom dates">
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1"><span className="label">From</span><input type="date" className="input py-2" min={min} max={to} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="flex flex-col gap-1"><span className="label">To</span><input type="date" className="input py-2" min={from} max={today()} value={to} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
        <div className="flex flex-wrap gap-1.5">{([["This month", () => [today().slice(0, 8) + "01", today()]], ["Last month", () => { const d = new Date(); const f = new Date(d.getFullYear(), d.getMonth() - 1, 1), t = new Date(d.getFullYear(), d.getMonth(), 0); return [iso(f), iso(t)]; }], ["This year", () => [today().slice(0, 4) + "-01-01", today()]], ["Last 14 days", () => [new Date(Date.now() - 13 * 864e5).toISOString().slice(0, 10), today()]]] as [string, () => string[]][]).map(([l, f]) => <button key={l} type="button" className="chip" onClick={() => { const [x, y] = f(); setFrom(x < min ? min : x); setTo(y); }}>{l}</button>)}</div>
        {!ok && <p className="text-[12.5px] text-amber-200">Pick up to a year, within the last 13 months (views older than that are removed).</p>}
        <div className="flex justify-end gap-2"><button type="button" className="btn btn-sm" onClick={() => setOpen(false)}>Cancel</button><button type="button" className="btn btn-pri btn-sm" disabled={!ok} onClick={() => { onRk(`c:${from}:${to}`); setOpen(false); }}>Show these dates</button></div>
      </div>}
    </div>
  );
}
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/* Reports: choose the sites, the period, what goes in and how, then download a PDF, an Excel workbook or CSV files.
   The last choices and any saved report setups are kept in this browser. */
type Preset = { name: string; c: Criteria; rk: string };
const PRESETS_KEY = "studio-analytics-reports", LAST_KEY = "studio-analytics-report-last";
const load = <T,>(k: string, d: T): T => { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v ?? d; } catch { return d; } };
const keep = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const QUICK: { name: string; note: string; rk: string; c: Partial<Criteria> }[] = [
  { name: "Monthly client report", note: "Last month · PDF · summary, trend, pages, sources, actions, orders", rk: "lastMonth", c: { format: "pdf", group: "day", sections: ["summary", "trend", "sites", "pages", "sources", "actions", "orders"], perSite: true } },
  { name: "Product performance", note: "30 days · Excel · impressions, views, click-through, time, cart", rk: "d30", c: { format: "xlsx", sections: ["summary", "products", "actions", "orders"], top: 100, title: "Product performance" } },
  { name: "Traffic and audience", note: "90 days · PDF · sources, campaigns, devices, countries, when", rk: "d90", c: { format: "pdf", group: "week", sections: ["summary", "trend", "sources", "audience", "time", "entry"], title: "Traffic and audience" } },
  { name: "Full data export", note: "12 months · CSV files · every section, 100 rows each", rk: "d365", c: { format: "csv", group: "month", sections: SECTIONS.map(([k]) => k), top: 100, title: "Analytics data export" } },
];
function Reports({ list, rk: dashRk, loading }: { list: Entry[]; rk: string; loading: boolean }) {
  const toast = useToast();
  const [c, setC] = useState<Criteria>(() => ({ ...DEFAULT_CRITERIA, ...load<Partial<Criteria>>(LAST_KEY, {}) }));
  const [rk, setRk] = useState(dashRk), [presets, setPresets] = useState<Preset[]>(() => load<Preset[]>(PRESETS_KEY, []));
  const [q, setQ] = useState(""), [busy, setBusy] = useState(""), [pname, setPname] = useState("");
  useEffect(() => keep(LAST_KEY, c), [c]);
  const set = (o: Partial<Criteria>) => setC((x) => ({ ...x, ...o }));
  const chosen = c.sites.length ? list.filter((e) => c.sites.includes(e.p.id)) : list;
  const shown = list.filter((e) => !q.trim() || e.p.name.toLowerCase().includes(q.trim().toLowerCase()) || (e.p.client || "").toLowerCase().includes(q.trim().toLowerCase()));
  const toggleSite = (id: string) => { const cur = c.sites.length ? c.sites : list.map((e) => e.p.id); const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]; set({ sites: next.length === list.length ? [] : next }); };
  const toggleSec = (k: string) => set({ sections: c.sections.includes(k) ? c.sections.filter((x) => x !== k) : SECTIONS.map(([x]) => x).filter((x) => x === k || c.sections.includes(x)) });
  const rangeFor = (r: string) => { if (r !== "lastMonth") return r; const d = new Date(), f = new Date(d.getFullYear(), d.getMonth() - 1, 1), t = new Date(d.getFullYear(), d.getMonth(), 0); return `c:${iso(f)}:${iso(t)}`; };
  const make = async (cc: Criteria, r: string) => {
    const sites = cc.sites.length ? list.filter((e) => cc.sites.includes(e.p.id)) : list;
    if (!sites.length) return toast("Choose at least one site.", "bad");
    if (!cc.sections.length) return toast("Choose at least one section.", "bad");
    setBusy("Reading the numbers"); const ask = { ...askOf(r), top: cc.top }, out: { e: Entry; stats: SiteStats }[] = []; let n = 0;
    try {
      await Promise.all(Array.from({ length: 4 }, async () => { while (n < sites.length) { const e = sites[n++]; let st: SiteStats | null = null;
        if (!e.src?.cf.api) st = sample(r, list.indexOf(e)); else { try { st = await siteStats(e.src.cf, ask, e.src.account); } catch { st = null; } }
        if (st) out.push({ e, stats: st }); setBusy(`Reading the numbers (${out.length} of ${sites.length})`); } }));
      if (!out.length) throw new Error("No site's numbers could be read. Check you're signed in to their databases on this device.");
      out.sort((a, b) => sites.indexOf(a.e) - sites.indexOf(b.e));
      setBusy("Making the " + (cc.format === "pdf" ? "PDF" : cc.format === "xlsx" ? "Excel file" : "CSV files"));
      const all = out.length === 1 ? out[0].stats : combine(out.map((x) => x.stats), r);
      const { name, blob } = await buildReport(cc, out.map((x) => ({ name: x.e.p.name, url: liveUrl(x.e.p), stats: x.stats })), all, brand().name || "Picaffectz Studio");
      downloadBlob(blob, name); toast(`Downloaded ${name}` + (out.length < sites.length ? ` (${sites.length - out.length} site${sites.length - out.length === 1 ? "" : "s"} couldn't be read)` : ""));
    } catch (e: any) { toast(e?.message || "Couldn't make the report.", "bad"); }
    setBusy("");
  };
  const savePreset = () => { const name = pname.trim() || c.title; const next = [...presets.filter((x) => x.name !== name), { name, c, rk }]; setPresets(next); keep(PRESETS_KEY, next); setPname(""); toast(`Saved “${name}”.`); };
  const Box = ({ n, title, children, right }: { n: number; title: string; children: React.ReactNode; right?: React.ReactNode }) => (
    <section className="card flex flex-col gap-3 p-5"><div className="flex flex-wrap items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded-full bg-brand-500/20 text-[12px] font-extrabold text-brand-300">{n}</span><h3 className="text-[15px] font-extrabold">{title}</h3>{right && <span className="ml-auto">{right}</span>}</div>{children}</section>);
  const FORMATS: [Criteria["format"], string, string, string][] = [["pdf", "PDF", "A designed report to send or print: cover, headline tiles, charts and tables.", "📄"], ["xlsx", "Excel", "A workbook with a sheet per table, filters and frozen headings, ready to sort and chart.", "📊"], ["csv", "CSV", "Plain data files in a ZIP, one per table, for any other tool.", "🗂️"]];
  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex min-w-0 flex-col gap-4">
        <Box n={1} title="Report">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1"><span className="label">Title</span><input className="input" value={c.title} onChange={(e) => set({ title: e.target.value })} /></label>
            <label className="flex flex-col gap-1"><span className="label">Prepared for (optional)</span><input className="input" placeholder="Client or company name" value={c.client} onChange={(e) => set({ client: e.target.value })} /></label>
          </div>
          <label className="flex flex-col gap-1"><span className="label">Notes on the cover (optional)</span><textarea className="input min-h-[64px]" placeholder="What changed this month, campaigns that ran…" value={c.note} onChange={(e) => set({ note: e.target.value })} /></label>
        </Box>
        <Box n={2} title="Sites" right={<span className="text-[12.5px] text-ink-400">{chosen.length} of {list.length} chosen</span>}>
          <div className="flex flex-wrap gap-2"><input className="input max-w-xs py-2" placeholder="Search sites or clients" value={q} onChange={(e) => setQ(e.target.value)} /><button type="button" className="btn btn-sm" onClick={() => set({ sites: [] })}>All</button><button type="button" className="btn btn-sm" onClick={() => set({ sites: list.length ? [list[0].p.id] : [] })}>Just one</button></div>
          {!list.length ? <p className="text-[13px] text-ink-400">No site is counted yet.</p> :
            <ul className="scroll-thin grid max-h-56 gap-1.5 overflow-auto sm:grid-cols-2 lg:grid-cols-3">{shown.map((e) => { const on = !c.sites.length || c.sites.includes(e.p.id); return <li key={e.p.id}><label className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-[13px] ${on ? "border-brand-400/60 bg-brand-500/10" : "border-ink-700"}`}><input type="checkbox" checked={on} onChange={() => toggleSite(e.p.id)} className="accent-brand-500" /><span className="min-w-0 flex-1 truncate font-semibold">{e.p.name}</span>{e.stats && <span className="text-[11.5px] tabular-nums text-ink-400">{fmt(e.stats.views)}</span>}</label></li>; })}</ul>}
          {chosen.length > 1 && <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" className="accent-brand-500" checked={c.perSite} onChange={(e) => set({ perSite: e.target.checked })} />A section for each site too (after the totals for all of them)</label>}
        </Box>
        <Box n={3} title="Period">
          <div className="flex flex-wrap items-start justify-between gap-3"><Period rk={rk} onRk={setRk} />
            <div className="flex flex-col gap-2 text-[13px]">
              <label className="flex items-center gap-2"><input type="checkbox" className="accent-brand-500" checked={c.compare} onChange={(e) => set({ compare: e.target.checked })} />Compare with the period before</label>
              <div className="flex items-center gap-2"><span className="text-ink-400">Trend by</span><div role="radiogroup" aria-label="Trend by" className="flex rounded-full border border-ink-700 p-0.5">{(["day", "week", "month"] as const).map((g) => <button key={g} type="button" role="radio" aria-checked={c.group === g} onClick={() => set({ group: g })} className={`rounded-full px-3 py-1 text-[12.5px] font-semibold capitalize ${c.group === g ? "bg-brand-500 text-white" : "text-ink-300"}`}>{g}</button>)}</div></div>
            </div>
          </div>
        </Box>
        <Box n={4} title="What goes in" right={<span className="flex gap-1.5"><button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ sections: SECTIONS.map(([k]) => k) })}>All</button><button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ sections: ["summary"] })}>Only the summary</button></span>}>
          <ul className="grid gap-2 md:grid-cols-2">{SECTIONS.map(([k, l, d]) => { const on = c.sections.includes(k); return <li key={k}><label className={`flex h-full cursor-pointer gap-3 rounded-xl border p-3 text-[13px] ${on ? "border-brand-400/60 bg-brand-500/10" : "border-ink-700"}`}><input type="checkbox" className="mt-0.5 accent-brand-500" checked={on} onChange={() => toggleSec(k)} /><span><b className="block">{l}</b><span className="text-[12.5px] text-ink-400">{d}</span></span></label></li>; })}</ul>
          <label className="flex items-center gap-2 text-[13px]"><span className="text-ink-400">Rows in each list</span><select className="input w-auto py-1.5" value={c.top} onChange={(e) => set({ top: +e.target.value })}>{[10, 15, 25, 50, 100].map((n) => <option key={n} value={n}>Top {n}</option>)}</select></label>
        </Box>
        <Box n={5} title="Format">
          <div role="radiogroup" aria-label="Format" className="grid gap-2 sm:grid-cols-3">{FORMATS.map(([k, l, d, ic]) => <button key={k} type="button" role="radio" aria-checked={c.format === k} onClick={() => set({ format: k })} className={`flex flex-col gap-1 rounded-xl border p-3 text-left ${c.format === k ? "border-brand-400 bg-brand-500/10" : "border-ink-700 hover:border-ink-500"}`}><span className="text-xl" aria-hidden>{ic}</span><b>{l}</b><span className="text-[12px] text-ink-400">{d}</span></button>)}</div>
          <div className="flex flex-wrap items-center gap-2 border-t border-ink-700 pt-3">
            <button type="button" className="btn btn-pri" disabled={!!busy || !chosen.length} onClick={() => make(c, rk)}>{busy ? busy + "…" : `Download ${c.format === "pdf" ? "PDF" : c.format === "xlsx" ? "Excel" : "CSV"} report`}</button>
            {loading && !busy && <span className="text-[12.5px] text-ink-400">The dashboard is still reading; the report reads the numbers itself.</span>}
          </div>
        </Box>
      </div>
      <aside className="flex flex-col gap-4 xl:sticky xl:top-20">
        <section className="card flex flex-col gap-3 p-5" aria-label="Quick reports"><h3 className="text-[15px] font-extrabold">Quick reports</h3><p className="-mt-1 text-[12.5px] text-ink-400">Ready-made, for all the sites chosen in step 2. One press downloads it.</p>
          <ul className="flex flex-col gap-2">{QUICK.map((x) => <li key={x.name}><button type="button" disabled={!!busy} onClick={() => make({ ...c, title: x.c.title || x.name, ...x.c } as Criteria, rangeFor(x.rk))} className="flex w-full flex-col rounded-xl border border-ink-700 p-3 text-left transition hover:border-brand-400/60 hover:bg-brand-500/5 disabled:opacity-50"><b className="text-[13.5px]">{x.name}</b><span className="text-[12px] text-ink-400">{x.note}</span></button></li>)}</ul>
        </section>
        <section className="card flex flex-col gap-3 p-5" aria-label="Saved report setups"><h3 className="text-[15px] font-extrabold">Saved setups</h3>
          <div className="flex gap-2"><input className="input py-2" placeholder={c.title} aria-label="Name for this setup" value={pname} onChange={(e) => setPname(e.target.value)} /><button type="button" className="btn btn-sm" onClick={savePreset}>Save</button></div>
          {!presets.length ? <p className="text-[12.5px] text-ink-400">Save the choices on the left to make the same report again in one press (kept in this browser).</p> :
            <ul className="flex flex-col divide-y divide-ink-700 text-[13px]">{presets.map((x) => <li key={x.name} className="flex items-center gap-2 py-2"><button type="button" className="min-w-0 flex-1 truncate text-left font-semibold hover:text-brand-300" onClick={() => { setC({ ...DEFAULT_CRITERIA, ...x.c }); setRk(x.rk); }}>{x.name}</button><span className="text-[11.5px] uppercase text-ink-400">{x.c.format}</span><button type="button" className="btn btn-sm" disabled={!!busy} onClick={() => make({ ...DEFAULT_CRITERIA, ...x.c }, x.rk)}>Download</button><button type="button" className="icon-btn h-7 w-7" aria-label={`Delete ${x.name}`} onClick={() => { const next = presets.filter((y) => y.name !== x.name); setPresets(next); keep(PRESETS_KEY, next); }}>✕</button></li>)}</ul>}
        </section>
        <section className="card flex flex-col gap-2 p-5 text-[12.5px] text-ink-400" aria-label="In this report"><h3 className="text-[15px] font-extrabold text-ink-100">In this report</h3>
          <p><b className="text-ink-200">{chosen.length}</b> site{chosen.length === 1 ? "" : "s"} · <b className="text-ink-200">{spanOf(rk)}</b> day{spanOf(rk) === 1 ? "" : "s"}{c.compare ? ", compared with the days before" : ""} · <b className="text-ink-200">{c.sections.length}</b> section{c.sections.length === 1 ? "" : "s"} · top {c.top} rows · {c.format.toUpperCase()}</p>
          <p>Made on this device from the sites' own numbers. Nothing is sent anywhere else.</p>
        </section>
      </aside>
    </div>
  );
}

/** Live status beside the period: a pulsing dot while the numbers read themselves every minute, when they last came, and a
 *  Refresh button to read them now. */
function LiveStatus({ busy, at, onRefresh }: { busy: boolean; at: number | null; onRefresh: () => void }) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 10_000); return () => clearInterval(t); }, []);
  return (
    <div className="flex items-center gap-3 text-[12.5px] leading-none text-ink-400" role="status">
      <span className="inline-flex items-center gap-2">
        <span className="relative inline-flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" /></span>
        <span><b className="font-semibold text-emerald-300">Live</b>{busy ? " · updating…" : at ? ` · updated ${ago(at)}` : ""}</span>
      </span>
      <button type="button" className="btn btn-sm inline-flex items-center gap-1.5" disabled={busy} onClick={onRefresh} title="Read the numbers again now">
        <svg aria-hidden viewBox="0 0 24 24" className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 4v5h-5" /></svg>
        Refresh
      </button>
    </div>
  );
}
