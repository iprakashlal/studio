// The two shortcuts on each project tile: Quick setup (who can sign in to the site's admin page, and publishing) and
// Overview (what needs attention: new and processing orders, abandoned carts, submitted enquiries). Each one turns the
// project's card over into a window (ui/FlipModal).
import { useEffect, useState, type ReactNode } from "react";
import type { ProjectMeta } from "../lib/studio";
import { cfCall, cfSession, siteEnquiries } from "../lib/cfdb";
import { loadHostConfig } from "../lib/studiohost";
import { siteAddress } from "../lib/hosting";
import { TEMPLATES } from "../schema";
import { LoginEmails } from "./SitesHostingCard";
import { FlipModal } from "../ui/FlipModal";

/** Opens a project with one of its publish dialogs already showing. */
export function openPublish(p: ProjectMeta, modal: "host" | "publish") {
  try { sessionStorage.setItem("studio-open-modal", p.id + ":" + modal); } catch { /* the project opens without it */ }
  location.hash = "#/p/" + p.id;
}

const Sec = ({ title, children, note }: { title: string; note?: string; children: ReactNode }) => (
  <section className="flex flex-col gap-2 rounded-2xl border border-ink-700 bg-ink-950/40 p-4" aria-label={title}>
    <h3 className="text-[12px] font-extrabold uppercase tracking-wider text-ink-400">{title}</h3>
    {note && <p className="text-[13px] text-ink-400">{note}</p>}
    {children}
  </section>
);

/** Where the project is live, in words, and its address. */
function whereLive(p: ProjectMeta): { label: string; url: string } {
  const h = p.host;
  if (h) return { label: h.kind === "cloudflare" ? "Live on Cloudflare" : h.kind === "netlify" ? "Live on Netlify" : "Live", url: siteAddress(h) };
  if (p.publish) return { label: "Live on GitHub Pages", url: `https://${p.publish.owner}.github.io/${p.publish.repo}/` };
  return { label: "Not published yet", url: "" };
}
/** The top of both windows: what it is, the project's name, its kind, where it's live and its address. */
function Head({ kicker, p }: { kicker: string; p: ProjectMeta }) {
  const w = whereLive(p), t = TEMPLATES[p.template];
  return (
    <div className="flex flex-col gap-1.5 pr-10">
      <span className="text-[11.5px] font-extrabold uppercase tracking-[.18em] text-brand-300">{kicker}</span>
      <h2 className="truncate font-display text-2xl font-extrabold leading-tight tracking-tight">{p.name}</h2>
      <div className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
        <span className="chip">{t?.name || p.template}</span>
        <span className={`chip ${w.url ? "border-emerald-400/50 text-emerald-200" : "border-amber-400/50 text-amber-200"}`}><span aria-hidden className={`h-1.5 w-1.5 rounded-full ${w.url ? "bg-emerald-400" : "bg-amber-400"}`} />{w.label}</span>
        {w.url && <a className="truncate text-brand-300 underline-offset-2 hover:underline" href={w.url} target="_blank" rel="noopener noreferrer">{w.url.replace(/^https:\/\//, "").replace(/\/$/, "")} ↗</a>}
      </div>
    </div>
  );
}

/** Where this site's admin-page logins are kept: its own Cloudflare database, or (a GitHub Pages site with email sign-in)
 *  the Studio's database. null while looking, false when there's none. */
function useLogins(p: ProjectMeta): { cf: { api: string; site: string }; account?: string } | null | false {
  const h = p.host, [gh, setGh] = useState<{ cf: { api: string; site: string } } | null | false>(null);
  useEffect(() => {
    if (h?.cf || h) return; if (!p.publish) { setGh(false); return; }
    let live = true;
    (async () => {
      const hc = await loadHostConfig().catch(() => null);
      if (!hc || hc.kind !== "cloudflare" || !cfSession.load(hc.api)) { if (live) setGh(false); return; }
      const r = await cfCall<any>(hc.api, "/site/people?scope=" + encodeURIComponent("studio:" + hc.studio) + "&site=" + encodeURIComponent(p.id)).catch(() => null);
      if (live) setGh(r?.linked ? { cf: { api: hc.api, site: p.id } } : false);
    })();
    return () => { live = false; };
  }, [p.id, p.publish?.repo, !!h]);
  if (h?.cf) return { cf: h.cf, account: h.kind === "cloudflare" ? h.account : undefined };
  if (h) return false;
  return gh;
}

export function QuickSetup({ project, onClose, start, from }: { project: ProjectMeta; onClose: () => void; start?: "who" | "publish"; from: HTMLElement | null }) {
  const h = project.host, logins = useLogins(project);
  const [tab, setTab] = useState<"who" | "publish">(start || "who");
  const host = h ? (h.kind === "cloudflare" ? "Cloudflare" : h.kind === "netlify" ? "Netlify" : "its host") : "";
  const tabs: [typeof tab, string][] = [["who", "Who can sign in"], ["publish", "Publish"]];
  return (
    <FlipModal from={from} title={`Quick setup · ${project.name}`} onClose={onClose} head={<>
      <Head kicker="Quick setup" p={project} />
      <div role="tablist" aria-label="Quick setup" className="mt-4 inline-flex gap-1 self-start rounded-full border border-ink-700 bg-ink-950/40 p-1">
        {tabs.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded-full px-4 py-1.5 text-[13px] font-semibold transition ${tab === k ? "bg-brand-500 text-white" : "text-ink-300 hover:text-ink-100"}`}>{l}</button>)}
      </div>
    </>}>
      {tab === "who" && <Sec title="Admin page · who can sign in" note="These emails can open this site's admin page; each gets a 6-digit code.">
        {logins === null ? <p className="text-[13px] text-ink-400" role="status">Looking for this site's logins…</p>
          : logins ? <LoginEmails cf={logins.cf} account={logins.account} name={project.name} startOpen />
          : <p className="text-[13px] text-amber-200">{h ? "This site keeps its logins in Supabase: manage them in the site's admin page."
            : project.publish ? "Email sign-in isn't set up for this GitHub site. Publish it to GitHub again with “Sign in to the admin page with an email code” on (it needs your Studio's database on Cloudflare, signed in on this device)."
            : "Not published yet. Publish this site (GitHub or Cloudflare) with email sign-in to add login emails."}</p>}
      </Sec>}
      {tab === "publish" && <Sec title="Publish" note={h ? `Hosted on ${host}. Publishing opens the project with the publish window ready.` : project.publish ? "On GitHub Pages. Publishing opens the project with the publish window ready." : "Not published yet. Pick where to host it."}>
        <div className="flex flex-wrap gap-2">
          {h && <button type="button" className="btn btn-pri btn-sm" onClick={() => openPublish(project, "host")}>Publish to {host}</button>}
          {!h && <button type="button" className="btn btn-pri btn-sm" onClick={() => openPublish(project, "publish")}>Publish to GitHub</button>}
          {!h && !project.publish && <button type="button" className="btn btn-sm" onClick={() => openPublish(project, "host")}>Host to external services</button>}
          {h && project.publish && <button type="button" className="btn btn-sm" onClick={() => openPublish(project, "publish")}>Also update GitHub</button>}
        </div>
      </Sec>}
    </FlipModal>
  );
}

type Row = { id: number; data: Record<string, string>; status: string; created_at: string };
type Cart = { ckey: string; email: string; name: string; total: number; status: string; updated_at?: string };
const isOrder = (d: any) => !!(d && d.order_no);
const CLOSED = ["done", "cancelled", "archived", "delivered", "completed", "rejected"];
const ago = (iso: string) => { const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)); return m < 1 ? "just now" : m < 60 ? m + " min ago" : m < 1440 ? Math.round(m / 60) + " h ago" : Math.round(m / 1440) + " d ago"; };

/** What's waiting on this site: counts first, then the latest few. */
export function QuickOverview({ project, onClose, from }: { project: ProjectMeta; onClose: () => void; from: HTMLElement | null }) {
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
  const Stat = ({ n, l, hot }: { n: number | string; l: string; hot?: boolean }) => <div className={`rounded-2xl border px-4 py-3.5 ${hot ? "border-brand-500/60 bg-brand-500/10" : "border-ink-700 bg-ink-950/40"}`}><div className="font-display text-3xl font-extrabold leading-none">{n}</div><div className="mt-1.5 text-[12.5px] text-ink-400">{l}</div></div>;
  const who = (d: Record<string, string>) => d.name || d.email || "Guest";
  return (
    <FlipModal from={from} title={`Overview · ${project.name}`} onClose={onClose} head={<Head kicker="Overview" p={project} />} footer={<a className="btn btn-pri btn-sm" href={`#/p/${project.id}`} onClick={onClose}>Open project</a>}>
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
    </FlipModal>
  );
}

