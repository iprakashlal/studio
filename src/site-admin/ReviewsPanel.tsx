import { useEffect, useState } from "react";
import { cfCall } from "../lib/cfdb";
import { SiteDbSignIn, useSiteDbSigned } from "../pages/Connections";
import { useToast, SkelPanel } from "../ui/kit";

// Reviews (shop and restaurant on a Cloudflare database): what customers wrote about each product or dish. The owner
// approves or hides each one, can answer it, and can delete it. Only approved reviews show on the site.
type Review = { id: number; item: string; label: string; name: string; email: string; rating: number; title: string; body: string; verified: number; status: "pending" | "live" | "hidden"; reply: string; created_at: string };
type Data = { on: boolean; moderate: boolean; rows: Review[] };
const when = (iso: string) => { try { return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }); } catch { return iso; } };

export function ReviewsPanel({ cf, kind, on }: { cf?: { api: string; site: string } | null; kind: "store" | "restaurant"; /** content.reviews.on as last saved. */ on: boolean }) {
  const toast = useToast(), signed = useSiteDbSigned(cf), scope = cf ? "scope=" + encodeURIComponent("site:" + cf.site) : "";
  const [d, setD] = useState<Data | null>(null), [err, setErr] = useState(""), [busy, setBusy] = useState(0), [view, setView] = useState<"pending" | "live" | "hidden" | "all">("pending"), [reply, setReply] = useState<Record<number, string>>({});
  const load = async () => {
    if (!cf || !signed) return; setErr("");
    try { setD(await cfCall<Data>(cf.api, `/rw/list?${scope}`)); }
    catch (e: any) { setD({ on: false, moderate: true, rows: [] }); setErr(e?.status === 404 ? "This needs the site's database updated once (Settings → Hostings → Sites and hosting accounts → Data → Update this database)." : e?.message || "Couldn't load the reviews."); }
  };
  useEffect(() => { setD(null); void load(); /* eslint-disable-next-line */ }, [cf?.api, cf?.site, signed]);
  const act = async (path: string, body: object, said: string, id: number) => { setBusy(id); try { await cfCall(cf!.api, `${path}?${scope}`, { method: "POST", body: JSON.stringify({ id, ...body }) }); toast(said); await load(); } catch (e: any) { toast(e?.message || "That didn't work.", "bad"); } setBusy(0); };
  const Empty = ({ children }: { children: React.ReactNode }) => <section className="card max-w-3xl p-5 text-sm text-ink-300" aria-label="Reviews"><h3 className="mb-1 text-[15px] font-extrabold text-ink-100">Reviews</h3>{children}</section>;
  if (!cf) return <Empty>Reviews need the site on its own Cloudflare database. Connect one under Settings → Hostings, then publish.</Empty>;
  if (!signed) return <Empty><p className="mb-3">Sign in to this site's database to see the reviews.</p><SiteDbSignIn cf={cf} /></Empty>;
  if (!d) return <SkelPanel label="Loading the reviews" />;
  const n = { pending: d.rows.filter((r) => r.status === "pending").length, live: d.rows.filter((r) => r.status === "live").length, hidden: d.rows.filter((r) => r.status === "hidden").length };
  const rows = d.rows.filter((r) => view === "all" || r.status === view), avg = n.live ? d.rows.filter((r) => r.status === "live").reduce((a, r) => a + r.rating, 0) / n.live : 0;
  const stars = (k: number) => <span className="text-amber-300" aria-label={`${k} out of 5`}>{"★".repeat(k)}<span className="text-ink-600">{"★".repeat(5 - k)}</span></span>;
  return (
    <section className="flex max-w-4xl flex-col gap-4" aria-label="Reviews">
      <div>
        <h3 className="text-[15px] font-extrabold text-ink-100">Reviews</h3>
        <p className="text-sm text-ink-300">What customers wrote about your {kind === "restaurant" ? "dishes" : "products"}. Only approved reviews show on the site.</p>
        {!d.on && <p role="status" className="mt-2 rounded-lg border border-amber-400/40 bg-amber-400/5 px-3 py-2 text-[13px] text-amber-100" data-rv-off>{on ? <>Reviews are switched on in the editor but not on the live site yet. <b>Publish the site</b> to start taking them.</> : <>Reviews are switched off. Turn on <b>{kind === "store" ? "Prices & shipping" : "Online ordering"} → Reviews → Let customers review</b>, then publish.</>}</p>}
        {err && <p role="alert" className="mt-2 text-[13px] text-red-300">{err}</p>}
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4" aria-label="Summary">
          {[["Waiting for you", n.pending], ["Showing", n.live], ["Hidden", n.hidden], ["Average", n.live ? avg.toFixed(1) + " ★" : "–"]].map(([k, v]) => <div key={String(k)} className="card p-3"><dt className="text-xs text-ink-400">{k}</dt><dd className="text-lg font-extrabold text-ink-100">{v}</dd></div>)}
        </dl>
      </div>
      <div className="flex self-start rounded-lg border border-ink-600" role="group" aria-label="Show">{([["pending", `Waiting (${n.pending})`], ["live", "Showing"], ["hidden", "Hidden"], ["all", "All"]] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={view === k} onClick={() => setView(k)} className={`btn btn-sm border-0 ${view === k ? "bg-ink-700 text-ink-100" : "text-ink-300"}`}>{l}</button>)}</div>
      {rows.length === 0 ? <p className="text-sm text-ink-400" data-rv-empty>{view === "pending" ? "Nothing is waiting for you." : "No reviews here yet."}</p> :
        <ul className="flex flex-col gap-3" aria-label="Reviews list">{rows.map((r) => <li key={r.id} className="card flex flex-col gap-2 p-4" data-review={r.id}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">{stars(r.rating)}<b className="text-ink-100">{r.title || "(no headline)"}</b>{r.verified ? <span className="chip" data-state="verified">Verified buyer</span> : null}<span className={`chip ${r.status === "live" ? "" : ""}`} data-state={r.status}>{r.status === "live" ? "Showing" : r.status === "pending" ? "Waiting" : "Hidden"}</span></div>
          <p className="whitespace-pre-line text-sm text-ink-200">{r.body}</p>
          <p className="text-xs text-ink-400">{r.name}{r.email ? ` · ${r.email}` : ""} · on <b className="text-ink-300">{r.label || r.item}</b> · {when(r.created_at)}</p>
          <label className="flex flex-col gap-1 text-xs text-ink-400">Your reply (shown under the review)<textarea className="input min-h-[3.5rem] text-sm" aria-label={`Reply to ${r.name}`} value={reply[r.id] ?? r.reply} onChange={(e) => setReply({ ...reply, [r.id]: e.target.value })} /></label>
          <div className="flex flex-wrap gap-2">
            {r.status !== "live" && <button type="button" className="btn btn-sm btn-pri" disabled={!!busy} onClick={() => act("/rw/set", { status: "live" }, "Approved. It shows on the site.", r.id)}>Approve</button>}
            {r.status !== "hidden" && <button type="button" className="btn btn-sm" disabled={!!busy} onClick={() => act("/rw/set", { status: "hidden" }, "Hidden from the site.", r.id)}>Hide</button>}
            {(reply[r.id] ?? r.reply) !== r.reply && <button type="button" className="btn btn-sm" disabled={!!busy} onClick={() => act("/rw/set", { reply: reply[r.id] ?? "" }, "Reply saved.", r.id)}>Save reply</button>}
            <button type="button" className="btn btn-sm text-ink-400" disabled={!!busy} onClick={() => { if (confirm("Delete this review for good?")) void act("/rw/del", {}, "Deleted.", r.id); }}>Delete</button>
          </div>
        </li>)}</ul>}
    </section>
  );
}
