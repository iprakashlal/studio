import { useEffect, useState } from "react";
import { cfCall } from "../lib/cfdb";
import { SiteDbSignIn, useSiteDbSigned } from "../pages/Connections";
import { useToast, SkelPanel } from "../ui/kit";

// Abandoned carts (shop and restaurant on a Cloudflare database): shoppers who typed their email at checkout and left.
// A reminder goes out by itself after the wait set under Selling; here the owner sees who, what and how much, can send
// one now, and sees how many came back and ordered.
type Cart = { ckey: string; email: string; name: string; phone: string; items: { n: string; q: number }[]; total: number; status: "open" | "recovered" | "stop"; sent: number; sent_at: string | null; order_no: string; updated_at: string };
type Data = { on: boolean; mail: boolean; rows: Cart[] };
const when = (iso: string) => { try { return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }); } catch { return iso; } };

export function RecoveryPanel({ cf, kind, on }: { cf?: { api: string; site: string } | null; kind: "store" | "restaurant"; /** content.recovery.on as last saved. */ on: boolean }) {
  const toast = useToast(), signed = useSiteDbSigned(cf), scope = cf ? "scope=" + encodeURIComponent("site:" + cf.site) : "";
  const [d, setD] = useState<Data | null>(null), [err, setErr] = useState(""), [busy, setBusy] = useState(""), [view, setView] = useState<"open" | "recovered" | "all">("open");
  const load = async () => {
    if (!cf || !signed) return; setErr("");
    try { setD(await cfCall<Data>(cf.api, `/rc/list?${scope}`)); }
    catch (e: any) { setD({ on: false, mail: false, rows: [] }); setErr(e?.status === 404 ? "This needs the site's database updated once (Settings → Hostings → Sites and hosting accounts → Data → Update this database)." : e?.message || "Couldn't load the carts."); }
  };
  useEffect(() => { setD(null); void load(); /* eslint-disable-next-line */ }, [cf?.api, cf?.site, signed]);
  const act = async (path: string, key: string, said: string) => { setBusy(key); try { await cfCall(cf!.api, `${path}?${scope}`, { method: "POST", body: JSON.stringify({ key }) }); toast(said); await load(); } catch (e: any) { toast(e?.message || "That didn't work.", "bad"); } setBusy(""); };
  const Empty = ({ children }: { children: React.ReactNode }) => <section className="card max-w-3xl p-5 text-sm text-ink-300" aria-label="Abandoned carts"><h3 className="mb-1 text-[15px] font-extrabold text-ink-100">Abandoned carts</h3>{children}</section>;
  if (!cf) return <Empty>Abandoned-cart reminders need the site on its own Cloudflare database. Connect one under Settings → Hostings, then publish.</Empty>;
  if (!signed) return <Empty><p className="mb-3">Sign in to this site's database to see the carts.</p><SiteDbSignIn cf={cf} /></Empty>;
  if (!d) return <SkelPanel label="Loading the carts" />;
  const rows = d.rows.filter((r) => view === "all" || (view === "recovered" ? r.status === "recovered" : r.status !== "recovered")), got = d.rows.filter((r) => r.status === "recovered" && r.sent > 0);
  const money = (n: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
  return (
    <section className="flex max-w-5xl flex-col gap-4" aria-label="Abandoned carts">
      <div>
        <h3 className="text-[15px] font-extrabold text-ink-100">Abandoned carts</h3>
        <p className="text-sm text-ink-300">Someone typed their email at checkout and left. A reminder with a link back to their cart goes out by itself; you can also send one now.</p>
        {!d.on && <p role="status" className="mt-2 rounded-lg border border-amber-400/40 bg-amber-400/5 px-3 py-2 text-[13px] text-amber-100" data-rc-off>{on ? <>Reminders are switched on in the editor but not on the live site yet. <b>Publish the site</b> to start keeping carts.</> : <>Reminders are switched off. Turn on <b>{kind === "store" ? "Prices & shipping" : "Online ordering"} → Abandoned carts → Remind shoppers</b>, then publish.</>}</p>}
        {!d.mail && <p role="status" className="mt-2 rounded-lg border border-amber-400/40 bg-amber-400/5 px-3 py-2 text-[13px] text-amber-100">Email isn't set up on this database (Resend), so reminders can't be sent.</p>}
        {err && <p role="alert" className="mt-2 text-[13px] text-red-300">{err}</p>}
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4" aria-label="Summary">
          {[["Waiting", d.rows.filter((r) => r.status === "open").length], ["Reminded", d.rows.filter((r) => r.sent > 0).length], ["Came back and ordered", got.length], ["Won back", money(got.reduce((a, r) => a + r.total, 0))]].map(([k, v]) => <div key={String(k)} className="card p-3"><dt className="text-xs text-ink-400">{k}</dt><dd className="text-lg font-extrabold text-ink-100">{v}</dd></div>)}
        </dl>
      </div>
      <div className="flex rounded-lg border border-ink-600 self-start" role="group" aria-label="Show">{([["open", "Waiting"], ["recovered", "Ordered"], ["all", "All"]] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={view === k} onClick={() => setView(k)} className={`btn btn-sm border-0 ${view === k ? "bg-ink-700 text-ink-100" : "text-ink-300"}`}>{l}</button>)}</div>
      {rows.length === 0 ? <p className="text-sm text-ink-400" data-rc-empty>{view === "recovered" ? "Nobody has come back from a reminder yet." : "No carts waiting. They show up here once a shopper types their email at checkout and leaves."}</p> :
        <div className="card overflow-x-auto p-0"><table className="w-full min-w-[44rem] text-left text-sm" aria-label="Carts">
          <thead className="text-xs text-ink-400"><tr><th className="px-3 py-2">Shopper</th><th className="px-3 py-2">Cart</th><th className="px-3 py-2">Total</th><th className="px-3 py-2">Last seen</th><th className="px-3 py-2">Reminders</th><th className="px-3 py-2" /></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.ckey} className="border-t border-ink-800" data-cart={r.email}>
            <td className="px-3 py-2"><b className="text-ink-100">{r.name || r.email}</b>{r.name && <small className="block text-ink-400">{r.email}</small>}{r.phone && <small className="block text-ink-400">{r.phone}</small>}</td>
            <td className="px-3 py-2 text-ink-200">{r.items.slice(0, 3).map((i) => `${i.n}${i.q > 1 ? " × " + i.q : ""}`).join(", ")}{r.items.length > 3 ? ` +${r.items.length - 3} more` : ""}</td>
            <td className="px-3 py-2 font-mono">{money(r.total)}</td>
            <td className="whitespace-nowrap px-3 py-2 text-ink-300">{when(r.updated_at)}</td>
            <td className="px-3 py-2 text-ink-300">{r.status === "recovered" ? <span className="chip" data-state="recovered">Ordered {r.order_no}</span> : r.status === "stop" ? <span className="chip" data-state="stop">Opted out</span> : r.sent ? `${r.sent} sent${r.sent_at ? ", " + when(r.sent_at) : ""}` : "Not yet"}</td>
            <td className="whitespace-nowrap px-3 py-2"><span className="flex gap-1">{r.status !== "recovered" && <button type="button" className="btn btn-sm" disabled={!!busy || !d.mail} onClick={() => act("/rc/send", r.ckey, `Reminder sent to ${r.email}.`)} aria-label={`Send a reminder to ${r.email}`}>{busy === r.ckey ? "Sending…" : "Remind now"}</button>}<button type="button" className="btn btn-sm text-ink-400" disabled={!!busy} onClick={() => act("/rc/drop", r.ckey, "Taken off the list.")} aria-label={`Remove ${r.email}`}>Remove</button></span></td>
          </tr>)}</tbody></table></div>}
    </section>
  );
}
