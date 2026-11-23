import { useEffect, useMemo, useState } from "react";
import { cfCall } from "../lib/cfdb";
import { SiteDbSignIn, useSiteDbSigned } from "../pages/Connections";
import { useToast, SkelPanel } from "../ui/kit";

// Inventory (shop and restaurant on a Cloudflare database): how many of each product or dish are left. An item is
// counted once it is given a quantity here; everything else sells without a limit. Orders take from the count as they
// are placed, a cancelled order gives it back, and every change is in the log.
type Item = { item: string; name: string; group: string; opt: boolean };
type Row = { item: string; qty: number; low: number; updated_at: string };
type Log = { item: string; delta: number; qty: number; why: string; ref: string; at: string };
type Data = { on: boolean; items: Item[]; rows: Row[]; log: Log[] };
const csv = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const when = (iso: string) => { try { return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }); } catch { return iso; } };
/** One line of a pasted or uploaded sheet: name or code, quantity, optional low mark. */
function parseSheet(text: string): string[][] {
  return text.split(/\r?\n/).map((l) => { const out: string[] = []; let cur = "", q = false; for (let i = 0; i < l.length; i++) { const ch = l[i]; if (q) { if (ch === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; } else if (ch === '"') q = true; else if (ch === "," || ch === "\t" || ch === ";") { out.push(cur.trim()); cur = ""; } else cur += ch; } out.push(cur.trim()); return out; }).filter((r) => r.some((c) => c));
}

export function InventoryPanel({ cf, kind, on }: { cf?: { api: string; site: string } | null; /** What the site sells. */ kind: "store" | "restaurant"; /** content.inventory.on as last saved (the published site follows the published content). */ on?: boolean }) {
  const toast = useToast(), signed = useSiteDbSigned(cf), scope = cf ? "scope=" + encodeURIComponent("site:" + cf.site) : "";
  const [d, setD] = useState<Data | null>(null), [err, setErr] = useState(""), [busy, setBusy] = useState(""), [find, setFind] = useState(""), [view, setView] = useState<"all" | "counted" | "low" | "out">("all"), [edit, setEdit] = useState<Record<string, { qty?: string; low?: string }>>({}), [showLog, setShowLog] = useState(false), [sheet, setSheet] = useState<string | null>(null);
  const thing = kind === "restaurant" ? "dish" : "product", things = kind === "restaurant" ? "dishes" : "products";
  const load = async () => {
    if (!cf || !signed) return; setErr("");
    try { setD(await cfCall<Data>(cf.api, `/st/list?${scope}`)); }
    catch (e: any) { setD({ on: false, items: [], rows: [], log: [] }); setErr(e?.status === 404 ? "This needs the site's database updated once (Settings → Hostings → Sites and hosting accounts → Data → Update this database)." : e?.status === 401 ? "Sign in to this site's admin page on this device to see its stock." : e?.message || "Couldn't load the stock."); }
  };
  useEffect(() => { setD(null); setEdit({}); void load(); /* eslint-disable-next-line */ }, [cf?.api, cf?.site, signed]);
  const rows = useMemo(() => new Map((d?.rows || []).map((r) => [r.item, r])), [d]);
  const names = useMemo(() => new Map((d?.items || []).map((i) => [i.item, i.name])), [d]);
  // Counted items the site no longer has (a product that was deleted or renamed) are listed too, so they can be cleared.
  const gone = useMemo(() => (d?.rows || []).filter((r) => !names.has(r.item)).map((r) => ({ item: r.item, name: r.item + " (no longer on the site)", group: "", opt: false })), [d, names]);
  const all = useMemo(() => [...(d?.items || []), ...gone], [d, gone]);
  const state = (i: Item) => { const r = rows.get(i.item); return !r ? "off" : r.qty <= 0 ? "out" : r.qty <= r.low ? "low" : "ok"; };
  const list = useMemo(() => all.filter((i) => (!find || i.name.toLowerCase().includes(find.toLowerCase())) && (view === "all" || (view === "counted" ? rows.has(i.item) : state(i) === view))), [all, find, view, rows]); // eslint-disable-line react-hooks/exhaustive-deps
  const n = { counted: all.filter((i) => rows.has(i.item)).length, low: all.filter((i) => state(i) === "low").length, out: all.filter((i) => state(i) === "out").length, units: (d?.rows || []).reduce((a, r) => a + r.qty, 0) };
  const send = async (items: any[], said: string, why?: string) => {
    if (!cf || !items.length) return false; setBusy("save");
    try { await cfCall(cf.api, `/st/set?${scope}`, { method: "POST", body: JSON.stringify({ items, why }) }); toast(said); await load(); setBusy(""); return true; }
    catch (e: any) { toast(e?.message || "Couldn't save the stock.", "bad"); setBusy(""); return false; }
  };
  const dirty = Object.entries(edit).filter(([k, v]) => { const r = rows.get(k); return (v.qty != null && v.qty.trim() !== "" && +v.qty !== (r?.qty ?? NaN)) || (v.low != null && v.low.trim() !== "" && +v.low !== (r?.low ?? 0) && (r || (v.qty != null && v.qty.trim() !== ""))); });
  const saveAll = async () => { if (await send(dirty.map(([item, v]) => ({ item, ...(v.qty != null && v.qty.trim() !== "" ? { qty: Math.max(0, Math.round(+v.qty || 0)) } : {}), ...(v.low != null && v.low.trim() !== "" ? { low: Math.max(0, Math.round(+v.low || 0)) } : {}) })), `Stock saved for ${dirty.length} ${dirty.length === 1 ? "item" : "items"}.`)) setEdit({}); };
  const exportCsv = () => { const body = all.map((i) => { const r = rows.get(i.item); return [i.name, i.item, r ? r.qty : "", r ? r.low : ""].map(csv).join(","); }); const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + ["Name,Code,In stock,Low mark", ...body].join("\n")], { type: "text/csv" })); a.download = `stock-${cf!.site}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); };
  /** A sheet's rows matched to items by code, else by name. */
  const sheetRows = useMemo(() => { if (sheet == null) return null; const byName = new Map(all.map((i) => [i.name.toLowerCase(), i.item])), codes = new Set(all.map((i) => i.item)); const ok: { item: string; name: string; qty: number; low?: number }[] = [], bad: string[] = [];
    for (const r of parseSheet(sheet)) { if (/^(name|item|product|dish)$/i.test(r[0] || "")) continue; const hasCode = r.length >= 3 && codes.has(r[1]), item = hasCode ? r[1] : codes.has(r[0]) ? r[0] : byName.get((r[0] || "").toLowerCase()) || "", nums = r.slice(hasCode ? 2 : 1).filter((x) => x !== ""); if (!item || !nums.length || !isFinite(+nums[0])) { if (r[0]) bad.push(r[0]); continue; } ok.push({ item, name: names.get(item) || item, qty: Math.max(0, Math.round(+nums[0])), ...(nums[1] != null && isFinite(+nums[1]) ? { low: Math.max(0, Math.round(+nums[1])) } : {}) }); }
    return { ok, bad }; }, [sheet, all, names]);

  const Empty = ({ children }: { children: React.ReactNode }) => <section className="card max-w-3xl p-5 text-sm text-ink-300" aria-label="Inventory"><h3 className="mb-1 text-[15px] font-extrabold text-ink-100">Inventory</h3>{children}</section>;
  if (!cf) return <Empty>Stock is kept on the site's own Cloudflare database. Host this site on Cloudflare (Host to External Services) and you can count your {things} here.</Empty>;
  if (!signed) return <div className="max-w-3xl"><SiteDbSignIn cf={cf} what="show its stock" /></div>;
  if (!d) return <SkelPanel label="Loading the stock" chips={false} rows={6} />;
  const chip = (s: string) => s === "out" ? "border-red-400/50 text-red-200" : s === "low" ? "border-amber-400/60 text-amber-200" : s === "ok" ? "border-emerald-400/50 text-emerald-200" : "border-ink-600 text-ink-400";
  const liveOn = on ?? d.on;
  return (
    <section className="flex max-w-5xl flex-col gap-4" aria-label="Inventory">
      <div className="card flex flex-col gap-2 p-5">
        <h3 className="flex flex-wrap items-center gap-2 text-[15px] font-extrabold">Inventory<span className={`chip ${d.on ? "border-emerald-400/50 text-emerald-200" : "border-ink-600 text-ink-400"}`}>{d.on ? "Counting on the live site" : "Not counting yet"}</span></h3>
        <p className="text-sm text-ink-300">Give a {thing} a quantity and it is counted: every order takes from it, a cancelled order gives it back, and at zero it shows as <b className="text-ink-100">sold out</b> by itself. A {thing} with no quantity sells without a limit. {kind === "store" ? "An option or variety can have its own count; otherwise it draws on the product's." : "A size can have its own count; otherwise it draws on the dish's."}</p>
        {!d.on && <p role="status" className="rounded-lg border border-amber-400/40 bg-amber-400/5 px-3 py-2 text-[13px] text-amber-100" data-inv-off>{liveOn ? <>Counting is switched on in the editor but not on the live site yet. <b>Publish the site</b> and orders will start taking from stock.</> : <>Counting is switched off. Turn on <b>{kind === "store" ? "Products" : "Menu"} → Stock → Count stock</b>, then publish. You can enter quantities now; they take effect once it is on.</>}</p>}
        {err && <p className="text-sm text-red-300">{err}</p>}
        <dl className="mt-1 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4" aria-label="Stock summary">
          {[["Counted", n.counted + " of " + all.length], ["Units in stock", n.units.toLocaleString("en-IN")], ["Running low", String(n.low)], ["Sold out", String(n.out)]].map(([k, v]) => <div key={k} className="rounded-lg border border-ink-700 px-3 py-2"><dt className="text-[11px] uppercase tracking-wider text-ink-400">{k}</dt><dd className="text-lg font-extrabold text-ink-100">{v}</dd></div>)}
        </dl>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input className="input w-auto min-w-[14rem] flex-1 py-2" type="search" placeholder={`Search ${things}`} aria-label={`Search ${things}`} value={find} onChange={(e) => setFind(e.target.value)} />
        <div className="flex rounded-lg border border-ink-600" role="group" aria-label="Show">{([["all", "All"], ["counted", "Counted"], ["low", `Low (${n.low})`], ["out", `Sold out (${n.out})`]] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={view === k} onClick={() => setView(k)} className={`btn btn-sm border-0 ${view === k ? "bg-ink-700 text-ink-100" : "text-ink-300"}`}>{l}</button>)}</div>
        <button type="button" className="btn btn-sm" onClick={() => setSheet(sheet == null ? "" : null)}>{sheet == null ? "Paste or upload a sheet" : "Close the sheet"}</button>
        <button type="button" className="btn btn-sm" onClick={exportCsv}>Export CSV</button>
        <button type="button" className="btn btn-sm" onClick={() => setShowLog(!showLog)}>{showLog ? "Hide the log" : "Log of changes"}</button>
      </div>
      {sheet != null && <div className="card flex flex-col gap-3 p-4" aria-label="Stock sheet">
        <p className="text-sm text-ink-300">One line per {thing}: its name (or code), then the quantity, then (optional) the low mark. Commas or tabs both work, so you can paste straight from a spreadsheet, or load the CSV exported here after editing it.</p>
        <textarea className="input min-h-[7rem] font-mono text-[13px]" aria-label="Stock sheet lines" placeholder={`${all[0]?.name || "Name"}, 24, 5`} value={sheet} onChange={(e) => setSheet(e.target.value)} />
        <div className="flex flex-wrap items-center gap-2">
          <label className="btn btn-sm cursor-pointer">Choose a CSV file<input type="file" accept=".csv,text/csv,text/plain" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setSheet((await f.text()).replace(/^﻿/, "")); e.target.value = ""; }} /></label>
          <button type="button" className="btn btn-sm btn-pri" disabled={!!busy || !sheetRows?.ok.length} onClick={async () => { if (await send(sheetRows!.ok.map(({ item, qty, low }) => ({ item, qty, ...(low != null ? { low } : {}) })), `Stock set for ${sheetRows!.ok.length} ${sheetRows!.ok.length === 1 ? "item" : "items"}.`, "Stock sheet")) setSheet(null); }}>Set stock for {sheetRows?.ok.length || 0} {sheetRows?.ok.length === 1 ? "item" : "items"}</button>
          {sheetRows && sheetRows.bad.length > 0 && <span className="text-[13px] text-amber-200" data-sheet-bad>Not matched: {sheetRows.bad.slice(0, 5).join(", ")}{sheetRows.bad.length > 5 ? ` and ${sheetRows.bad.length - 5} more` : ""}</span>}
        </div>
      </div>}
      {showLog && <div className="card overflow-x-auto p-0" aria-label="Log of stock changes">
        {d.log.length ? <table className="w-full min-w-[34rem] text-left text-sm"><thead className="text-[11px] uppercase tracking-wider text-ink-400"><tr><th className="px-4 py-2.5">When</th><th className="px-3 py-2.5">Item</th><th className="px-3 py-2.5 text-right">Change</th><th className="px-3 py-2.5 text-right">Left</th><th className="px-3 py-2.5">Why</th></tr></thead>
          <tbody>{d.log.map((l, i) => <tr key={i} className="border-t border-ink-800"><td className="whitespace-nowrap px-4 py-2 text-ink-400">{when(l.at)}</td><td className="px-3 py-2">{names.get(l.item) || l.item}</td><td className={`px-3 py-2 text-right font-mono ${l.delta < 0 ? "text-amber-200" : l.delta > 0 ? "text-emerald-200" : "text-ink-400"}`}>{l.delta > 0 ? "+" + l.delta : l.delta}</td><td className="px-3 py-2 text-right font-mono">{l.qty}</td><td className="px-3 py-2 text-ink-300">{l.why}{l.ref ? ` · ${l.ref}` : ""}</td></tr>)}</tbody></table>
          : <p className="p-4 text-sm text-ink-400">Nothing has changed yet.</p>}
      </div>}
      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[40rem] text-left text-sm" aria-label="Stock">
          <thead className="text-[11px] uppercase tracking-wider text-ink-400"><tr><th className="px-4 py-2.5">{kind === "restaurant" ? "Dish" : "Product"}</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5">In stock</th><th className="px-3 py-2.5">Low mark</th><th className="px-3 py-2.5">Quick</th></tr></thead>
          <tbody>
            {list.map((i) => { const r = rows.get(i.item), e = edit[i.item] || {}, s = state(i);
              return <tr key={i.item} className="border-t border-ink-800" data-item={i.item}>
                <td className={`px-4 py-2 ${i.opt ? "pl-9 text-ink-300" : "font-semibold text-ink-100"}`}>{i.name}{i.group && <span className="ml-2 text-xs font-normal text-ink-500">{i.group}</span>}</td>
                <td className="px-3 py-2"><span className={`chip ${chip(s)}`} data-state={s}>{s === "out" ? "Sold out" : s === "low" ? "Low" : s === "ok" ? "In stock" : "Not counted"}</span></td>
                <td className="px-3 py-2"><input className="input w-24 py-1.5 text-right font-mono" inputMode="numeric" aria-label={`In stock: ${i.name}`} placeholder={r ? "" : "no limit"} value={e.qty ?? (r ? String(r.qty) : "")} onChange={(ev) => setEdit({ ...edit, [i.item]: { ...e, qty: ev.target.value.replace(/[^\d]/g, "") } })} /></td>
                <td className="px-3 py-2"><input className="input w-20 py-1.5 text-right font-mono" inputMode="numeric" aria-label={`Low mark: ${i.name}`} placeholder="0" value={e.low ?? (r ? String(r.low) : "")} onChange={(ev) => setEdit({ ...edit, [i.item]: { ...e, low: ev.target.value.replace(/[^\d]/g, "") } })} /></td>
                <td className="whitespace-nowrap px-3 py-2">{r ? <span className="flex items-center gap-1">{[1, 10].map((k) => <button key={k} type="button" className="btn btn-sm" disabled={!!busy} aria-label={`Add ${k} to ${i.name}`} onClick={() => send([{ item: i.item, add: k }], `${i.name}: ${r.qty + k} in stock.`)}>+{k}</button>)}<button type="button" className="btn btn-sm" disabled={!!busy || r.qty <= 0} aria-label={`Take 1 off ${i.name}`} onClick={() => send([{ item: i.item, add: -1 }], `${i.name}: ${Math.max(0, r.qty - 1)} in stock.`)}>−1</button><button type="button" className="btn btn-sm text-ink-400" disabled={!!busy} title="Sell it without a limit again" onClick={() => send([{ item: i.item, off: true }], `${i.name} is no longer counted.`)}>Stop counting</button></span> : <span className="text-xs text-ink-500">Type a quantity to start</span>}</td>
              </tr>; })}
            {!list.length && <tr><td colSpan={5} className="px-4 py-6 text-center text-ink-400">{all.length ? "Nothing matches." : `No ${things} on the live site yet. Add them, publish, and they are listed here.`}</td></tr>}
          </tbody>
        </table>
      </div>
      {dirty.length > 0 && <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-brand-500/50 bg-ink-900 px-4 py-3 shadow-xl" role="status"><span className="text-sm text-ink-200">{dirty.length} {dirty.length === 1 ? "change" : "changes"} not saved yet.</span><button type="button" className="btn btn-sm btn-pri" disabled={!!busy} onClick={saveAll}>{busy ? "Saving…" : "Save stock"}</button><button type="button" className="btn btn-sm" disabled={!!busy} onClick={() => setEdit({})}>Discard</button></div>}
      <p className="hint">The list is read from the live site, so a {thing} added in the editor shows here after you publish. Stock is checked again when an order is placed: if two people want the last one, the second is told it has sold out. An order paid online is always kept; if stock had run out meanwhile, the order says so.</p>
    </section>
  );
}
