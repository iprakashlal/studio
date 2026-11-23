// The two shortcuts on each project tile: Quick Setup (who can sign in to the site's admin page and how, and publishing)
// and Quick Overview (what needs attention: new and processing orders, abandoned carts, submitted enquiries).
import { useEffect, useState } from "react";
import type { ProjectMeta } from "../lib/studio";
import { Modal } from "../ui/kit";
import { cfCall, siteEnquiries } from "../lib/cfdb";
import { LoginEmails } from "./SitesHostingCard";
import { MailForm, SiteDbSignIn, useMailBridge, useSiteDbSigned } from "./Connections";
import { GoogleSignInCard } from "../ui/GoogleSignIn";
import { PinCard } from "../ui/PinSignIn";

/** Opens a project with one of its publish dialogs already showing. */
export function openPublish(p: ProjectMeta, modal: "host" | "publish") {
  try { sessionStorage.setItem("studio-open-modal", p.id + ":" + modal); } catch { /* the project opens without it */ }
  location.hash = "#/p/" + p.id;
}

const Sec = ({ title, children, note }: { title: string; note?: string; children: React.ReactNode }) => (
  <section className="flex flex-col gap-2 rounded-xl border border-ink-700 p-3.5" aria-label={title}>
    <h3 className="text-[13px] font-extrabold uppercase tracking-wide text-ink-300">{title}</h3>
    {note && <p className="text-[13px] text-ink-400">{note}</p>}
    {children}
  </section>
);

export function QuickSetup({ project, onClose }: { project: ProjectMeta; onClose: () => void }) {
  const h = project.host, cf = h?.cf || null, signed = useSiteDbSigned(cf), bridge = useMailBridge(cf, h?.kind === "cloudflare" ? h.account : undefined, signed);
  const [tab, setTab] = useState<"who" | "how" | "publish">("who");
  const host = h ? (h.kind === "cloudflare" ? "Cloudflare" : h.kind === "netlify" ? "Netlify" : "its host") : "";
  const tabs: [typeof tab, string][] = [["who", "Who can sign in"], ["how", "How they sign in"], ["publish", "Publish"]];
  const note = (t: string) => <p className="text-[13px] text-ink-400">{t}</p>;
  return (
    <Modal wide title={`Quick setup · ${project.name}`} onClose={onClose}>
      <div role="tablist" aria-label="Quick setup" className="-mt-1 flex gap-1 rounded-full border border-ink-700 p-1">
        {tabs.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`flex-1 rounded-full px-3 py-1.5 text-[13px] font-semibold transition ${tab === k ? "bg-brand-500 text-white" : "text-ink-300 hover:text-ink-100"}`}>{l}</button>)}
      </div>
      {tab === "who" && <section aria-label="Admin login: who can sign in" className="flex flex-col gap-3">
        {note("These emails can open this site's admin page; each gets a 6-digit code.")}
        {cf ? <LoginEmails cf={cf} account={h!.kind === "cloudflare" ? h!.account : undefined} name={project.name} startOpen />
          : <p className="text-[13px] text-amber-200">{h ? "This site keeps its logins in Supabase: manage them in the site's admin page." : "No email sign-in yet. Publish this site to Cloudflare to add login emails."}</p>}
      </section>}
      {tab === "how" && <section aria-label="Admin login: how they sign in" className="flex flex-col gap-3">
        {!cf ? <p className="text-[13px] text-amber-200">Sign-in options need the site on Cloudflare.</p> : <>
          {note("Email code always works. Google and PIN apply to every site on this database.")}
          {!signed ? <>{bridge && <MailForm where={null} studio bridge={bridge} />}<SiteDbSignIn cf={cf} small what="change the sign-in options" /></> : <>
            <MailForm where={{ api: cf.api, scope: "site:" + cf.site }} studio />
            <GoogleSignInCard api={cf.api} what="this site's admin page and any other site on this database" />
            <PinCard api={cf.api} what="this site's admin page and any other site on this database" />
          </>}
        </>}
      </section>}
      {tab === "publish" && <section aria-label="Publish" className="flex flex-col gap-3">
        {note(h ? `Hosted on ${host}. Publishing opens the project with the publish window ready.` : project.publish ? "On GitHub Pages. Publishing opens the project with the publish window ready." : "Not published yet. Pick where to host it.")}
        <div className="flex flex-wrap gap-2">
          {h && <button type="button" className="btn btn-pri btn-sm" onClick={() => openPublish(project, "host")}>Publish to {host}</button>}
          {!h && <button type="button" className="btn btn-pri btn-sm" onClick={() => openPublish(project, "publish")}>Publish to GitHub</button>}
          {!h && !project.publish && <button type="button" className="btn btn-sm" onClick={() => openPublish(project, "host")}>Host to external services</button>}
          {h && project.publish && <button type="button" className="btn btn-sm" onClick={() => openPublish(project, "publish")}>Also update GitHub</button>}
        </div>
      </section>}
    </Modal>
  );
}

type Row = { id: number; data: Record<string, string>; status: string; created_at: string };
type Cart = { ckey: string; email: string; name: string; total: number; status: string; updated_at?: string };
const isOrder = (d: any) => !!(d && d.order_no);
const CLOSED = ["done", "cancelled", "archived", "delivered", "completed", "rejected"];
const ago = (iso: string) => { const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)); return m < 1 ? "just now" : m < 60 ? m + " min ago" : m < 1440 ? Math.round(m / 60) + " h ago" : Math.round(m / 1440) + " d ago"; };

/** What's waiting on this site: counts first, then the latest few. */
export function QuickOverview({ project, onClose }: { project: ProjectMeta; onClose: () => void }) {
  const h = project.host, cf = h?.cf || null, shop = project.template === "store" || project.template === "restaurant";
  const [rows, setRows] = useState<Row[] | null>(null), [carts, setCarts] = useState<Cart[] | null | "na">(null), [err, setErr] = useState("");
  useEffect(() => {
    if (!cf) return; let live = true;
    (async () => {
      try { const l = await (await siteEnquiries(cf, h!.kind === "cloudflare" ? h!.account : undefined)).list(); if (live) setRows(l as Row[]); }
      catch (e: any) { if (live) { setRows([]); setErr(e?.message || "Couldn't read this site's database."); } }
      if (shop) { try { const d = await cfCall<{ rows: Cart[] }>(cf.api, `/rc/list?scope=${encodeURIComponent("site:" + cf.site)}`); if (live) setCarts(d.rows || []); } catch { if (live) setCarts("na"); } }
    })();
    return () => { live = false; };
  }, [cf?.api, cf?.site]);
  const money = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
  const orders = (rows || []).filter((r) => isOrder(r.data)), enq = (rows || []).filter((r) => !isOrder(r.data));
  const open = orders.filter((r) => !CLOSED.includes(r.status)), fresh = open.filter((r) => r.status === "new" || r.status === "read"), proc = open.filter((r) => !(r.status === "new" || r.status === "read"));
  const newEnq = enq.filter((r) => r.status === "new"), liveEnq = enq.filter((r) => r.status !== "archived");
  const abandoned = Array.isArray(carts) ? carts.filter((c) => c.status === "open") : [];
  const Stat = ({ n, l, hot }: { n: number | string; l: string; hot?: boolean }) => <div className={`rounded-xl border px-3 py-2.5 ${hot ? "border-brand-500/60" : "border-ink-700"}`}><div className="font-display text-2xl font-extrabold">{n}</div><div className="text-[12.5px] text-ink-400">{l}</div></div>;
  const who = (d: Record<string, string>) => d.name || d.email || "Guest";
  return (
    <Modal wide title={`Quick overview · ${project.name}`} onClose={onClose} footer={<a className="btn btn-pri btn-sm" href={`#/p/${project.id}`} onClick={onClose}>Open project</a>}>
      {!cf ? <p className="text-[13px] text-amber-200">{shop ? "Orders, carts and enquiries are kept on the site's Cloudflare database. Publish this site to Cloudflare to see them here." : "Enquiries are kept on the site's Cloudflare database. Publish this site to Cloudflare to see them here."}</p>
        : rows === null ? <p className="text-sm text-ink-400" role="status">Loading…</p> : <>
          {err && <p role="status" className="rounded-lg border border-amber-400/40 bg-amber-400/5 px-3 py-2 text-[13px] text-amber-100">{err}</p>}
          {shop ? <>
            <div className="grid grid-cols-3 gap-2" aria-label="Orders and carts">
              <Stat n={fresh.length} l="New orders" hot={fresh.length > 0} /><Stat n={proc.length} l="Processing" />
              <Stat n={carts === "na" ? "–" : carts === null ? "…" : abandoned.length} l="Abandoned carts" />
            </div>
            {carts === "na" && <p className="text-[12.5px] text-ink-400">Abandoned carts need you signed in to this site's database on this device (or its database updated once).</p>}
            <Sec title="Latest open orders">{open.length ? <ul className="flex flex-col divide-y divide-ink-700 text-[13px]">{open.slice(0, 6).map((r) => <li key={r.id} className="flex flex-wrap items-center gap-2 py-1.5"><b>{r.data.order_no}</b><span>{who(r.data)}</span><span className="text-ink-400">{r.data.total || ""}</span><span className="chip ml-auto">{r.status === "new" ? "New" : r.status}</span><span className="text-ink-400">{ago(r.created_at)}</span></li>)}</ul> : <p className="text-[13px] text-ink-400">No orders waiting.</p>}</Sec>
            {abandoned.length > 0 && <Sec title="Abandoned carts"><ul className="flex flex-col divide-y divide-ink-700 text-[13px]">{abandoned.slice(0, 5).map((c) => <li key={c.ckey} className="flex flex-wrap items-center gap-2 py-1.5"><span>{c.name || c.email}</span><span className="text-ink-400">{money(+c.total || 0)}</span></li>)}</ul></Sec>}
          </> : <>
            <div className="grid grid-cols-2 gap-2" aria-label="Enquiries"><Stat n={newEnq.length} l="New enquiries" hot={newEnq.length > 0} /><Stat n={liveEnq.length} l="Submitted in total" /></div>
            <Sec title="Latest enquiries">{liveEnq.length ? <ul className="flex flex-col divide-y divide-ink-700 text-[13px]">{liveEnq.slice(0, 6).map((r) => <li key={r.id} className="flex flex-wrap items-center gap-2 py-1.5"><b>{who(r.data)}</b><span className="truncate text-ink-400">{(r.data.message || r.data.subject || "").slice(0, 60)}</span>{r.status === "new" && <span className="chip ml-auto">New</span>}<span className="text-ink-400">{ago(r.created_at)}</span></li>)}</ul> : <p className="text-[13px] text-ink-400">No enquiries yet.</p>}</Sec>
          </>}
        </>}
    </Modal>
  );
}
