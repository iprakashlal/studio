import { useEffect, useRef, useState } from "react";
import { cfCall } from "../lib/cfdb";
import { SiteDbSignIn, useSiteDbSigned } from "../pages/Connections";
import { fmtDate } from "../lib/util";
import { Skel, useToast, SkelPanel } from "../ui/kit";

// Customer Data (restaurant and shop on a Cloudflare database): everyone who has ordered, kept by mobile number (else
// email) with their orders, what they spent and their points. The owner can search, change points, export and delete.
type Row = { ckey: string; name: string; phone: string; email: string; verified: number; orders: number; spent: number; points: number; first_at: string; last_at: string };
type Entry = { delta: number; why: string; order_no: string; at: string };
const PER = 20;
const csv = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

export function CustomerPanel({ cf, currency = "₹", points }: { cf?: { api: string; site: string } | null; currency?: string; points?: boolean }) {
  const toast = useToast();
  const [rows, setRows] = useState<Row[] | null>(null), [tot, setTot] = useState({ total: 0, points: 0, spent: 0, orders: 0 }), [err, setErr] = useState("");
  const [find, setFind] = useState(""), [page, setPage] = useState(0), [busy, setBusy] = useState("");
  const [open, setOpen] = useState(""), [log, setLog] = useState<Entry[] | null>(null), [delta, setDelta] = useState(""), [why, setWhy] = useState(""), [ask, setAsk] = useState("");
  const t = useRef<number>(0);
  const signed = useSiteDbSigned(cf), scope = cf ? "scope=" + encodeURIComponent("site:" + cf.site) : "";
  const money = (n: number) => currency + (Math.round((+n || 0) * 100) / 100).toLocaleString("en-IN");
  const [oldPts, setOldPts] = useState(false);
  const rebuild = async () => {
    if (!cf) return; setBusy("old");
    try { const r = await cfCall<any>(cf.api, `/c/rebuild?${scope}`, { method: "POST", body: JSON.stringify({ points: oldPts }) }); toast(r.orders ? `${r.orders} older order${r.orders === 1 ? "" : "s"} counted in, for ${r.customers} customer${r.customers === 1 ? "" : "s"}.` : "Every order is already counted. Nothing to add."); await load(); }
    catch (e: any) { toast(e?.status === 404 ? "This needs the database updated once (Settings → Hostings → Update this database)." : e?.message || "Couldn't count the older orders.", "bad"); }
    setBusy("");
  };
  const load = async (q = find, p = page) => {
    if (!cf || !signed) return; setErr("");
    try { const r = await cfCall<any>(cf.api, `/c/list?${scope}&q=${encodeURIComponent(q)}&page=${p}&per=${PER}`); setRows(r.rows || []); setTot({ total: r.total || 0, points: r.points || 0, spent: r.spent || 0, orders: r.orders || 0 }); }
    catch (e: any) { setRows([]); setErr(e?.status === 404 ? "This needs the site's database updated once (Settings → Hostings → Update this database)." : e?.status === 401 ? "Sign in to this site's admin page on this device to see its customers." : e?.message || "Couldn't load the customers."); }
  };
  useEffect(() => { setRows(null); setPage(0); setOpen(""); void load(find, 0); /* eslint-disable-next-line */ }, [cf?.api, cf?.site, signed]);
  const search = (v: string) => { setFind(v); setPage(0); window.clearTimeout(t.current); t.current = window.setTimeout(() => void load(v, 0), 350); };
  const go = (p: number) => { setPage(p); setOpen(""); void load(find, p); };
  const show = async (r: Row) => { if (open === r.ckey) { setOpen(""); return; } setOpen(r.ckey); setLog(null); setDelta(""); setWhy(""); setAsk(""); try { setLog(await cfCall<Entry[]>(cf!.api, `/c/points?${scope}&key=${encodeURIComponent(r.ckey)}`)); } catch { setLog([]); } };
  const adjust = async (r: Row, sign: 1 | -1) => {
    const n = Math.abs(Math.round(+delta || 0)); if (!n) return; setBusy("adjust");
    try { const j = await cfCall<any>(cf!.api, `/c/adjust?${scope}`, { method: "POST", body: JSON.stringify({ key: r.ckey, delta: sign * n, why: why.trim() || (sign > 0 ? "Added by the owner" : "Taken off by the owner") }) }); toast(`${r.name || r.phone || r.email}: ${j.points} points now.`); setDelta(""); setWhy(""); await load(); setLog(await cfCall<Entry[]>(cf!.api, `/c/points?${scope}&key=${encodeURIComponent(r.ckey)}`)); }
    catch (e: any) { toast(e?.message || "Couldn't change the points.", "bad"); }
    setBusy("");
  };
  const remove = async (r: Row) => { setBusy("delete"); try { await cfCall(cf!.api, `/c/delete?${scope}`, { method: "POST", body: JSON.stringify({ key: r.ckey }) }); toast("Customer deleted."); setOpen(""); setAsk(""); await load(); } catch (e: any) { toast(e?.message || "Couldn't delete.", "bad"); } setBusy(""); };
  const exportCsv = async () => {
    setBusy("export");
    try { const r = await cfCall<any>(cf!.api, `/c/list?${scope}&q=${encodeURIComponent(find)}&page=0&per=5000`);
      const head = ["Name", "Mobile", "Email", "Mobile verified", "Orders", "Spent", "Points", "First order", "Last order"];
      const body = (r.rows as Row[]).map((x) => [x.name, x.phone, x.email, x.verified ? "yes" : "no", x.orders, Math.round(x.spent * 100) / 100, x.points, x.first_at.slice(0, 10), x.last_at.slice(0, 10)].map(csv).join(","));
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + [head.join(","), ...body].join("\n")], { type: "text/csv" })); a.download = `customers-${cf!.site}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }
    catch (e: any) { toast(e?.message || "Couldn't export.", "bad"); }
    setBusy("");
  };

  if (!cf) return <section className="card max-w-3xl p-5 text-sm text-ink-300" aria-label="Customer Data"><h3 className="mb-1 text-[15px] font-extrabold text-ink-100">Customer Data</h3>Customers are kept on the site's own Cloudflare database. Host this site on Cloudflare (Host to External Services) and its customers will be listed here from the first order.</section>;
  if (!signed) return cf ? <div className="max-w-3xl"><SiteDbSignIn cf={cf} what="show its customers" /></div> : <section className="card max-w-3xl p-5 text-sm text-ink-300" aria-label="Customer Data"><h3 className="mb-1 text-[15px] font-extrabold text-ink-100">Customer Data</h3>Customers are kept on the site's own Cloudflare database. Host this site on Cloudflare (Host to External Services) to see them here.</section>;
  const pages = Math.max(1, Math.ceil(tot.total / PER));
  return (
    <section className="flex max-w-5xl flex-col gap-4" aria-label="Customer Data">
      <div className="card flex flex-col gap-2 p-5">
        <h3 className="text-[15px] font-extrabold">Customer Data</h3>
        <p className="text-sm text-ink-300">Everyone who has placed an order on this site, kept by mobile number (or email when there is no number). {points ? "Points are earned on each order and can be spent at checkout by guests whose number is verified." : "Switch on Points (Offers & coupons, or Prices & shipping for a shop) to reward returning customers."} These are personal details: export or share them only as your privacy policy allows.</p>
        <div className="flex flex-wrap gap-2 text-[13px]" aria-label="Totals"><span className="chip">{tot.total} customer{tot.total === 1 ? "" : "s"}</span><span className="chip">{tot.orders} order{tot.orders === 1 ? "" : "s"}</span><span className="chip">{money(tot.spent)} spent</span><span className="chip">{tot.points} point{tot.points === 1 ? "" : "s"} outstanding</span></div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="search" className="input max-w-xs" aria-label="Search customers" placeholder="Search name, mobile or email" value={find} onChange={(e) => search(e.target.value)} />
          <button type="button" className="btn btn-sm" disabled={!!busy || !tot.total} onClick={exportCsv}>{busy === "export" ? "Exporting…" : "Export as a spreadsheet (CSV)"}</button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => void load()}>Refresh</button>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-ink-700 pt-3 text-[13px] text-ink-300" aria-label="Older orders">
          <span className="min-w-0 flex-1 basis-64">Customers are listed from the day this was switched on. Orders placed before that are still under Purchased orders; count them in here once.</span>
          {points && <label className="flex items-center gap-2"><input type="checkbox" checked={oldPts} onChange={(e) => setOldPts(e.target.checked)} /> Give points for them too</label>}
          <button type="button" className="btn btn-sm" disabled={!!busy} onClick={rebuild}>{busy === "old" ? "Counting…" : "Add customers from older orders"}</button>
        </div>
      </div>
      {err && <p role="alert" className="rounded-lg border border-amber-400/40 bg-amber-400/5 px-3 py-2 text-sm text-amber-100">{err}</p>}
      {rows === null ? <SkelPanel label="Loading the customers" chips={false} rows={5} /> : !rows.length && !err ? <p className="card p-5 text-sm text-ink-300">{find ? "No customer matches that search." : "No customers yet. They appear here from the first order placed on the site."}</p> : rows.length > 0 && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[860px] text-left text-[13.5px]">
            <thead className="text-[11px] uppercase tracking-wider text-ink-400"><tr><th className="px-4 py-2.5">Customer</th><th className="px-3 py-2.5">Mobile</th><th className="px-3 py-2.5">Email</th><th className="px-3 py-2.5 text-right">Orders</th><th className="px-3 py-2.5 text-right">Spent</th><th className="px-3 py-2.5 text-right">Points</th><th className="px-3 py-2.5">Last order</th><th className="px-3 py-2.5" /></tr></thead>
            <tbody>
              {rows.map((r) => (<>
                <tr key={r.ckey} className="border-t border-ink-700" data-customer={r.ckey}>
                  <td className="px-4 py-2.5 font-semibold text-ink-100">{r.name || "No name"}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{r.phone || "–"}{r.verified ? <span className="chip ml-1.5 border-emerald-400/50 px-2 py-0.5 text-[11px] text-emerald-200" title="Proved with a code on WhatsApp or by SMS">Verified</span> : null}</td>
                  <td className="px-3 py-2.5">{r.email || "–"}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{r.orders}</td><td className="px-3 py-2.5 text-right tabular-nums">{money(r.spent)}</td><td className="px-3 py-2.5 text-right font-semibold tabular-nums">{r.points}</td>
                  <td className="whitespace-nowrap px-3 py-2.5" title={fmtDate(r.last_at)}>{new Date(r.last_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td>
                  <td className="px-3 py-2.5 text-right"><button type="button" className="btn btn-sm" aria-expanded={open === r.ckey} onClick={() => void show(r)}>{open === r.ckey ? "Close" : "Points & more"}</button></td>
                </tr>
                {open === r.ckey && <tr key={r.ckey + ":x"} className="border-t border-ink-800 bg-ink-950/40"><td colSpan={8} className="px-4 py-3">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-end gap-2">
                      <label className="flex flex-col gap-1 text-[12.5px] text-ink-300">Points<input className="input w-28 tabular-nums" inputMode="numeric" aria-label="Number of points" value={delta} onChange={(e) => setDelta(e.target.value.replace(/[^\d]/g, ""))} placeholder="50" /></label>
                      <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-[12.5px] text-ink-300">Reason (kept in the history)<input className="input" aria-label="Reason" value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Birthday gift" /></label>
                      <button type="button" className="btn btn-sm btn-pri" disabled={!!busy || !+delta} onClick={() => void adjust(r, 1)}>Add points</button>
                      <button type="button" className="btn btn-sm" disabled={!!busy || !+delta} onClick={() => void adjust(r, -1)}>Take off</button>
                      <span className="ml-auto flex items-center gap-2">{ask === r.ckey ? <><span className="text-[13px] text-ink-200">Delete this customer and their points? Their orders stay under Purchased orders.</span><button type="button" className="btn btn-sm border-red-400/50 text-red-200" disabled={!!busy} onClick={() => void remove(r)}>Yes, delete</button><button type="button" className="btn btn-sm" onClick={() => setAsk("")}>Keep</button></> : <button type="button" className="btn btn-sm border-red-400/50 text-red-200" onClick={() => setAsk(r.ckey)}>Delete this customer</button>}</span>
                    </div>
                    <div className="text-[13px]"><b className="text-ink-200">Points history</b>{log === null ? <span role="status" aria-label="Loading"><Skel className="mt-1 h-3.5 w-2/3" /></span> : !log.length ? <p className="text-ink-400">Nothing yet.</p> : <ul className="mt-1 flex flex-col gap-1" aria-label="Points history">{log.map((x, i) => <li key={i} className="flex flex-wrap gap-x-3 text-ink-300"><span className={`w-14 text-right font-semibold tabular-nums ${x.delta < 0 ? "text-amber-200" : "text-emerald-200"}`}>{x.delta > 0 ? "+" : ""}{x.delta}</span><span>{x.why}{x.order_no ? ` (${x.order_no})` : ""}</span><span className="text-ink-500">{fmtDate(x.at)}</span></li>)}</ul>}</div>
                    <p className="text-[12.5px] text-ink-400">Customer since {fmtDate(r.first_at)}.</p>
                  </div></td></tr>}
              </>))}
            </tbody>
          </table>
        </div>)}
      {pages > 1 && <div className="flex items-center gap-2 text-[13px]" aria-label="Pages"><button type="button" className="btn btn-sm" disabled={page <= 0} onClick={() => go(page - 1)}>Previous</button><span className="text-ink-300">Page {page + 1} of {pages}</span><button type="button" className="btn btn-sm" disabled={page >= pages - 1} onClick={() => go(page + 1)}>Next</button></div>}
    </section>
  );
}
