import { useEffect, useMemo, useState } from "react";
import { THEMES } from "../themes/catalog";
import { limitThemes } from "../themes/limit";
import { ThemeGallery } from "../themes/ThemeGallery";
import { anyThemeById as themeById } from "../themes/codes";
import { dashStats } from "../lib/dashstats";
import { TEMPLATES, TEMPLATE_LIST } from "../schema";
import { QuickOverview, QuickSetup } from "./QuickTiles";
import { CATEGORY_COLORS, type CategoryRec, type ProjectMeta, type Studio, type StudioIndex } from "../lib/studio";
import { explain } from "../lib/repo";
import { siteAddress, siteRepoFor } from "../lib/hosting";
import { loadManifest, loadStarter, type Manifest } from "../lib/exporter";
import { slugify, timeAgo } from "../lib/util";
import { Empty, Field, Logo, Modal, useConfirm, useToast } from "../ui/kit";
import { BrandMark } from "../lib/brand";
import { SandIntro } from "../ui/SandIntro";
import { PayNote } from "./PayNote";
import { loadHostConfig } from "../lib/studiohost";
import { rvSummary, type RvSummary } from "../lib/approvals";

const STATUS: Record<ProjectMeta["status"], { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "border-ink-500 text-ink-300" },
  exported: { label: "Exported", cls: "border-sky-400/60 text-sky-200" },
  published: { label: "Published", cls: "border-emerald-400/60 text-emerald-200" },
};

/** What the client said on the project's review link, in two lines: the decision, then their latest words. Opens the replies. */
function Feedback({ s, id }: { s: RvSummary; id: string }) {
  const look = s.status === "approved" ? { cls: "border-emerald-400/40 bg-emerald-400/5", ic: "bg-emerald-400/20 text-emerald-200", head: "Approved", d: "M5 12.5l4.5 4.5L19 7.5" }
    : s.status === "changes" ? { cls: "border-amber-400/40 bg-amber-400/5", ic: "bg-amber-400/20 text-amber-200", head: "Changes requested", d: "M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4" }
    : { cls: "border-ink-700 bg-ink-850/60", ic: "bg-ink-700 text-ink-300", head: s.comments ? "In review" : "Waiting for the client", d: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" };
  const when = s.status === "open" ? (s.last ? timeAgo(s.last.created_at) : "shared " + timeAgo(s.created_at)) : timeAgo(s.decided_at || s.created_at);
  return (
    <a href={`#/p/${id}`} onClick={() => { try { sessionStorage.setItem("site-studio:open-approve", id); } catch { /* private mode */ } }} data-fb={s.status}
      className={`relative z-10 flex items-start gap-2.5 rounded-xl border px-3 py-2 text-[13px] transition hover:border-ink-400 ${look.cls}`} aria-label="Client feedback" title="Open the review link's comments">
      <span className={`mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-full ${look.ic}`}><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={look.d} /></svg></span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <b className="text-ink-100">{look.head}</b>
          {s.status !== "open" && s.decided_by && <span className="truncate text-ink-300">by {s.decided_by}</span>}
          <span className="text-ink-400">· {when}</span>
          {s.waiting && <span className="chip border-brand-400/60 px-1.5 py-0 text-[11px] text-brand-200">Reply due</span>}
          {s.comments > 0 && <span className="ml-auto flex-none text-[12px] text-ink-400" title={`${s.comments} from the client`}>{s.comments} 💬</span>}
        </span>
        {s.last?.body && <span className="mt-0.5 line-clamp-2 block text-ink-300">“{s.last.body}”{s.status === "open" || s.last.who !== s.decided_by ? <span className="text-ink-500"> — {s.last.who}</span> : null}</span>}
      </span>
    </a>
  );
}

/** Last live-site check per project, so going back and forth doesn't re-check every time. */
const checked = new Map<string, number>();

export function Dashboard({ studio, index, onIndex, token, hid = () => false, max = {}, only }: { studio: Studio; index: StudioIndex; onIndex: (i: StudioIndex) => void; token: string; /** Features a partner hid in this client Studio. */ hid?: (key: string) => boolean; /** The most sites of each template this client Studio may have. */ max?: Record<string, number>; /** One template's own page (#/type/<id>): every card of that type. */ only?: string }) {
  // A template is on offer when it isn't hidden and the Studio hasn't reached its limit for that type.
  const countOf = (t: string) => index.projects.filter((p) => p.template === t).length;
  const room = (t: string) => max[t] === undefined || countOf(t) < max[t];
  const offered = TEMPLATE_LIST.filter((t) => !hid("tpl-" + t.id) && room(t.id));
  const full = TEMPLATE_LIST.filter((t) => !hid("tpl-" + t.id) && !room(t.id));
  const canNew = !hid("new") && offered.length > 0;
  const toast = useToast();
  const [live, setLive] = useState<Record<string, "checking" | "pulled" | "conflict">>({});
  // What clients said on their review links (a Studio on Cloudflare keeps those), for the cards.
  const [fb, setFb] = useState<Record<string, RvSummary>>({});
  const ids = index.projects.map((p) => p.id).join(",");
  useEffect(() => {
    if (studio.repo.demo || !ids) return; let on = true;
    loadHostConfig().then(async (h) => { if (h?.kind !== "cloudflare") return; const s = await rvSummary(h.api, h.studio, ids.split(",")); if (on) setFb(s); }).catch(() => {});
    return () => { on = false; };
  }, [ids]); // eslint-disable-line react-hooks/exhaustive-deps

  // Central control: published projects pick up edits made in their sites' own CMS.
  useEffect(() => {
    if (studio.repo.demo) return;
    let on = true;
    (async () => {
      const due = index.projects.filter((p) => (p.publish || p.host) && Date.now() - (checked.get(p.id) || 0) > 60_000);
      const pulled: string[] = [];
      for (const p of due) {
        if (!on) return;
        checked.set(p.id, Date.now());
        setLive((m) => ({ ...m, [p.id]: "checking" }));
        try {
          const site = siteRepoFor(p, token)!;
          // Don't leave "Checking…" up forever on a slow or blocked connection.
          const st = await Promise.race([studio.siteState(p, site), new Promise<never>((_, no) => setTimeout(() => no(new Error("timeout")), 45_000))]);
          if (st.kind === "pull") {
            const r = await studio.importFromSite(p.id, site);
            if (on) onIndex(r.index);
            pulled.push(p.name);
            setLive((m) => ({ ...m, [p.id]: "pulled" }));
          } else setLive((m) => { const n = { ...m }; if (st.kind === "conflict") n[p.id] = "conflict"; else delete n[p.id]; return n; });
        } catch {
          setLive((m) => { const n = { ...m }; delete n[p.id]; return n; });
        }
      }
      if (on && pulled.length) toast(`Updated from the live site${pulled.length > 1 ? "s" : ""}: ${pulled.join(", ")}`);
    })();
    return () => { on = false; };
  }, [index.projects.map((p) => p.id + (p.publish ? p.publish.repo : "") + (p.host ? p.host.siteId : "")).join()]);
  const confirm = useConfirm();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [tpl, setTpl] = useState("");
  const [status, setStatus] = useState("");
  const [client, setClient] = useState("");
  const clients = useMemo(() => [...new Map(index.projects.map((p) => p.client.trim()).filter(Boolean).map((c) => [c.toLowerCase(), c] as const)).values()].sort((a, b) => a.localeCompare(b)), [index]);
  const [sort, setSort] = useState("updated");
  const [creating, setCreating] = useState(false);
  const [managing, setManaging] = useState(false);
  const [busy, setBusy] = useState("");

  const cats = index.categories;
  const catById = (id: string) => cats.find((c) => c.id === id);
  const list = useMemo(() => {
    let l = index.projects.filter((p) => (!cat || p.category === cat) && (only ? p.template === only : !tpl || p.template === tpl) && (!status || p.status === status) && (!client || p.client.trim().toLowerCase() === client.toLowerCase())
      && (!q || `${p.name} ${p.client} ${p.summary || ""}`.toLowerCase().includes(q.toLowerCase())));
    l = [...l].sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : sort === "created" ? b.createdAt.localeCompare(a.createdAt) : b.updatedAt.localeCompare(a.updatedAt));
    return l;
  }, [index, q, cat, tpl, status, sort, client, only]);

  const stats = dashStats(index.dash?.stats).map((d) => ({ n: d.count(index.projects), l: d.label }));

  const [quick, setQuick] = useState<{ id: string; kind: "setup" | "overview" } | null>(null);
  const run = async (key: string, fn: () => Promise<StudioIndex>, ok: string) => {
    setBusy(key);
    try { onIndex(await fn()); toast(ok); } catch (e) { toast(explain(e), "bad"); }
    setBusy("");
  };

  const card = (p: ProjectMeta) => {
            const c = catById(p.category), t = TEMPLATES[p.template], st = STATUS[p.status], last = p.exports[0];
            return (
              <article key={p.id} className="card group relative flex flex-col overflow-hidden rounded-2xl transition hover:-translate-y-0.5 hover:border-ink-500 hover:shadow-lg">
                <div className="h-1.5" style={{ background: c?.color || "#2E3A4C" }} />
                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    {c && <span className="inline-flex items-center gap-1.5 truncate text-ink-400"><span className="h-2 w-2 rounded-full" style={{ background: c.color }} />{c.name}</span>}
                    <span className={`chip ml-auto ${st.cls}`}>{st.label}</span>
                    {(index.partners || []).filter((x) => x.shared.some((y) => y.project === p.id)).map((x) => <span key={x.id} className="chip border-brand-400/50 text-brand-200" title={`Shared with ${x.name}'s Studio; sync it from Settings → Studio Partners.`}>Shared with {x.name}</span>)}
                    {p.partner && <span className="chip border-brand-400/50 text-brand-200" title="Shared with you by your Studio Partner; changes are kept in step with them.">Shared by {p.partner.name}</span>}
                    {live[p.id] === "checking" && <span className="chip border-ink-600 text-ink-400">Checking live site…</span>}
                    {live[p.id] === "pulled" && <span className="chip border-emerald-400/60 text-emerald-200" title="Edits made in the site's own CMS were copied into this project.">Updated from live site</span>}
                    {live[p.id] === "conflict" && <span className="chip border-amber-400/60 text-amber-200" title="The site's own CMS and the Studio both changed the content. Open the project to choose which to keep.">Live site edited · review</span>}
                  </div>
                  <div>
                    <a href={`#/p/${p.id}`} className="after:absolute after:inset-0">
                      <h2 className="font-display text-lg font-extrabold leading-tight">{p.name}</h2>
                    </a>
                    <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[13px] text-ink-400">
                      <span>{t?.name || p.template} · {t?.kind}</span>
                      <span aria-hidden>·</span>
                      {p.client.trim() ? <button type="button" className="relative z-10 font-semibold text-ink-200 underline-offset-2 hover:underline" title={`Show only ${p.client.trim()}'s sites`} onClick={() => setClient(p.client.trim())}><span className="font-normal text-ink-400">Client </span>{p.client.trim()}</button> : <span>No client set</span>}
                    </p>
                    {p.summary && <p className="mt-1 line-clamp-2 text-[13px] text-ink-400">{p.summary}</p>}
                  </div>
                  {fb[p.id] && <Feedback s={fb[p.id]} id={p.id} />}
                  <div className="mt-auto flex flex-col gap-2.5">
                    <PayNote id={"p:" + p.id} pay={p.pay} onSave={async (pay) => onIndex(await studio.savePay(p.id, pay))} />
                    <p className="text-xs text-ink-400">Edited <b className="font-semibold text-ink-200">{timeAgo(p.updatedAt)}</b> · Export <b className="font-semibold text-ink-200">{last ? `v${last.version} · ${timeAgo(last.at)}` : "not yet"}</b></p>
                  </div>
                  <div className="relative z-10 flex flex-wrap items-center gap-1.5 border-t border-ink-700 pt-3">
                    <a href={`#/p/${p.id}`} className="btn btn-pri btn-sm">Open</a>
                    <button type="button" className="btn btn-sm" onClick={() => setQuick({ id: p.id, kind: "setup" })}>Quick Setup</button>
                    <button type="button" className="btn btn-sm" onClick={() => setQuick({ id: p.id, kind: "overview" })}>Quick Overview</button>
                    <span className="ml-auto flex items-center gap-0.5">
                      {p.host ? <a className="btn btn-ghost btn-sm" href={siteAddress(p.host)} target="_blank" rel="noopener">Live site ↗</a> : p.publish && <a className="btn btn-ghost btn-sm" href={`https://${p.publish.owner}.github.io/${p.publish.repo === `${p.publish.owner}.github.io` ? "" : p.publish.repo + "/"}`} target="_blank" rel="noopener">Live site ↗</a>}
                      {!hid("duplicate") && !hid("new") && !hid("tpl-" + p.template) && room(p.template) && <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => run("dup" + p.id, () => studio.duplicate(p.id, `${p.name} (copy)`), "Project duplicated")}>{busy === "dup" + p.id ? "Copying…" : "Duplicate"}</button>}
                      {!hid("delete") && <button className="btn btn-ghost btn-sm text-red-300 hover:text-red-200" disabled={!!busy} onClick={async () => {
                        if (await confirm(`Delete “${p.name}”?`, "This removes the project, its images and export snapshots from the Studio. Sites you already exported or published are not affected.", "Delete", true)) run("del" + p.id, () => studio.remove(p.id), "Project deleted");
                      }}>Delete</button>}
                    </span>
                  </div>
                </div>
              </article>
            );
  };

  return (
    <main className="mx-auto flex max-w-[1400px] flex-col gap-6 px-4 py-8 sm:px-6">
      {!only && <SandIntro />}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 font-display text-3xl font-extrabold sm:text-4xl"><BrandMark size={36} fallback={<Logo size={16} />} />Projects</h1>
          <p className="mt-1 text-sm text-ink-400">Create, preview, export and re-edit websites. Every site ships with its own CMS.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canNew && <button className="btn btn-pri" onClick={() => setCreating(true)}>+ New project</button>}
        </div>
      </div>
      {full.length > 0 && !hid("new") && <p className="rounded-lg border border-amber-400/40 bg-amber-400/5 px-3 py-2 text-[13px] text-amber-100" role="status">This Studio has reached its limit for {full.map((t) => `${t.name.toLowerCase()} sites (${max[t.id]})`).join(" and ")}. Ask your Studio Partner for more.</p>}

      {only && <a href="#/" className="btn btn-ghost btn-sm self-start text-ink-400">← All projects</a>}
      {!only && stats.length > 0 && <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900 sm:grid-cols-3 lg:grid-cols-4" aria-label="Studio numbers">
        {stats.map((s) => (
          <div key={s.l} className="-mb-px -mr-px border-b border-r border-ink-700 px-5 py-4">
            <div className="font-display text-3xl font-extrabold tabular-nums">{s.n}</div>
            <div className="text-xs text-ink-400">{s.l}</div>
          </div>
        ))}
      </div>}

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Category">
          <button className={`chip ${!cat ? "border-ink-100 bg-ink-100 text-ink-950" : ""}`} onClick={() => setCat("")}>All <span className="opacity-60">{index.projects.length}</span></button>
          {cats.map((c) => (
            <button key={c.id} className={`chip ${cat === c.id ? "border-ink-100 bg-ink-100 text-ink-950" : ""}`} onClick={() => setCat(c.id)}>
              <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />{c.name} <span className="opacity-60">{index.projects.filter((p) => p.category === c.id).length}</span>
            </button>
          ))}
          <button className="btn btn-ghost btn-sm" onClick={() => setManaging(true)}>Manage categories</button>
        </div>
        <div className="flex flex-wrap gap-2">
          <input className="input max-w-xs py-2" type="search" placeholder="Search by project or client name" aria-label="Search projects" value={q} onChange={(e) => setQ(e.target.value)} />
          {clients.length > 0 && <select className="input w-auto max-w-[220px] py-2" aria-label="Client" value={client} onChange={(e) => setClient(e.target.value)}><option value="">All clients</option>{clients.map((c) => <option key={c} value={c}>{c}</option>)}</select>}
          {!only && <select className="input w-auto py-2" aria-label="Template" value={tpl} onChange={(e) => setTpl(e.target.value)}><option value="">All templates</option>{TEMPLATE_LIST.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>}
          <select className="input w-auto py-2" aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Any status</option><option value="draft">Draft</option><option value="exported">Exported</option><option value="published">Published</option></select>
          <select className="input w-auto py-2" aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)}><option value="updated">Recently edited</option><option value="created">Newest</option><option value="name">Name</option></select>
        </div>
      </div>

      {!index.projects.length ? (
        <Empty title="Start your first site" body="Pick a template, add content, preview it live, then export a ZIP or publish straight to a GitHub repository." action={canNew ? <button className="btn btn-pri" onClick={() => setCreating(true)}>+ New project</button> : undefined} />
      ) : !list.length ? (
        <Empty title="No projects match" body="Try another category, template or search." />
      ) : (
        only || tpl ? (
          <section className="flex flex-col gap-3" aria-label={TEMPLATES[only || tpl]?.name || "Projects"}>
            {only && <h2 className="font-display text-2xl font-extrabold">{TEMPLATES[only]?.name || only} <span className="text-base font-semibold text-ink-400">· {list.length}</span></h2>}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{list.map(card)}</div>
          </section>
        ) : (
          // One block for each type, the three most recent first; "View all" opens that type's own page.
          <div className="flex flex-col gap-8">
            {TEMPLATE_LIST.map((t) => ({ t, items: list.filter((p) => p.template === t.id) })).filter((g) => g.items.length).map(({ t, items }) => (
              <section key={t.id} className="flex flex-col gap-3" aria-label={t.name}>
                <div className="flex flex-wrap items-baseline gap-3">
                  <h2 className="font-display text-xl font-extrabold">{t.name}</h2>
                  <span className="text-sm text-ink-400">{items.length} {items.length === 1 ? "site" : "sites"}</span>
                  {items.length > 3 && <a href={`#/type/${t.id}`} className="btn btn-ghost btn-sm ml-auto text-brand-200">View all {items.length} →</a>}
                </div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{items.slice(0, 3).map(card)}</div>
                {items.length > 3 && <a href={`#/type/${t.id}`} className="btn btn-sm self-center">View more {t.name.toLowerCase()} sites ({items.length - 3} more)</a>}
              </section>
            ))}
          </div>
        )
      )}

      {creating && <NewProject templates={offered} studio={studio} index={index} onClose={() => setCreating(false)} onCreated={(i, id) => { onIndex(i); setCreating(false); location.hash = `#/p/${id}`; }} />}
      {managing && <Categories studio={studio} index={index} onClose={() => setManaging(false)} onIndex={onIndex} />}
      {quick && (() => { const qp = index.projects.find((x) => x.id === quick.id); return qp ? (quick.kind === "setup" ? <QuickSetup project={qp} onClose={() => setQuick(null)} /> : <QuickOverview project={qp} onClose={() => setQuick(null)} />) : null; })()}
    </main>
  );
}

function NewProject({ studio, index, onClose, onCreated, templates }: { studio: Studio; index: StudioIndex; onClose: () => void; onCreated: (i: StudioIndex, id: string) => void; templates: typeof TEMPLATE_LIST }) {
  const toast = useToast();
  const [f, setF] = useState({ name: "", client: "", template: templates[0]?.id || "portfolio", starter: "default", theme: "", category: index.categories[0]?.id || "" });
  const [man, setMan] = useState<Record<string, Manifest>>({});
  const [busy, setBusy] = useState(false);
  // The themes this Studio may use for the chosen type (a client Studio's partner can narrow them): a new site starts on one of them.
  const pool = TEMPLATES[f.template].themes || THEMES, offered = limitThemes(pool, undefined, f.template);
  useEffect(() => { if (offered.length && offered.length < pool.length && !offered.some((t) => t.id === f.theme)) setF((x) => ({ ...x, theme: offered[0].id })); }, [f.template, f.theme, offered.length]);
  const pick = (template: string) => setF((x) => ({ ...x, template, starter: "default", theme: (TEMPLATES[template].themes || []).some((t) => t.id === x.theme) || (!TEMPLATES[template].themes && !/^(biz|rest)-/.test(x.theme)) ? x.theme : "" }));
  useEffect(() => {
    if (!man[f.template]) loadManifest(f.template).then((m) => setMan((o) => ({ ...o, [f.template]: m }))).catch(() => {});
  }, [f.template]);
  const create = async () => {
    if (!f.name.trim()) return toast("Give the project a name.", "bad");
    setBusy(true);
    try {
      const content = await loadStarter(f.template, f.starter);
      const tpl = TEMPLATES[f.template];
      const th = f.theme ? themeById(f.theme) : undefined;
      if (th) content.theme = { ...(content.theme || {}), ...tpl.themeValues(th) };
      const { index: i, id } = await studio.createProject({ name: f.name.trim(), template: f.template, category: f.category, client: f.client.trim(), content, summary: tpl.summary(content) });
      onCreated(i, id);
    } catch (e) {
      toast(explain(e), "bad");
      setBusy(false);
    }
  };
  return (
    <Modal title="New project" wide onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-pri" disabled={busy} onClick={create}>{busy ? "Creating…" : "Create project"}</button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Project name" htmlFor="np-name"><input id="np-name" autoFocus className="input" value={f.name} placeholder="e.g. Asha's portfolio" onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Client (optional)" htmlFor="np-client"><input id="np-client" className="input" value={f.client} onChange={(e) => setF({ ...f, client: e.target.value })} /></Field>
      </div>
      <div className="flex flex-col gap-2">
        <span className="label">Template</span>
        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Template">
          {templates.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={f.template === t.id} onClick={() => pick(t.id)}
              className={`flex flex-col gap-1.5 rounded-xl border p-4 text-left ${f.template === t.id ? "border-brand-500 bg-brand-500/10" : "border-ink-600 bg-ink-950 hover:border-ink-400"}`}>
              <span className="font-extrabold leading-snug">{t.name}</span>
              <span className="chip self-start">{t.kind}</span>
              <span className="text-[13px] text-ink-300">{t.description}</span>
              <span className="text-xs text-ink-500">{t.pages.length} page{t.pages.length > 1 ? "s" : ""}: {t.pages.map((p) => p.label).join(", ")}</span>
            </button>
          ))}
        </div>
      </div>
      {man[f.template] && man[f.template].starters.length > 1 && (
        <Field label="Start from" htmlFor="np-starter">
          <select id="np-starter" className="input" value={f.starter} onChange={(e) => setF({ ...f, starter: e.target.value })}>
            {man[f.template].starters.map((s) => <option key={s.id} value={s.id}>{s.name}: {s.description}</option>)}
          </select>
        </Field>
      )}
      <div className="flex flex-col gap-2">
        <span className="label flex flex-wrap items-center justify-between gap-2">Theme
          <button type="button" className={`rounded-full border px-2.5 py-1 text-xs font-semibold normal-case tracking-normal ${!f.theme ? "border-brand-500 bg-brand-500/15 text-ink-100" : "border-ink-600 text-ink-400"}`} aria-pressed={!f.theme} onClick={() => setF({ ...f, theme: "" })}>Template's own look</button>
        </span>
        <div className="max-h-[340px] overflow-y-auto pr-1 scroll-thin">
          <ThemeGallery compact current={f.theme || (TEMPLATES[f.template].themes ? offered[0]?.id : "")} themes={offered} tags={TEMPLATES[f.template].themeTags} onPick={(t) => setF({ ...f, theme: t.id })} />
        </div>
        <p className="text-xs text-ink-500">You can change the theme any time in Design → Theme &amp; layout.</p>
      </div>
      <Field label="Category" htmlFor="np-cat">
        <select id="np-cat" className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
          <option value="">No category</option>
          {index.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
    </Modal>
  );
}

function Categories({ studio, index, onClose, onIndex }: { studio: Studio; index: StudioIndex; onClose: () => void; onIndex: (i: StudioIndex) => void }) {
  const toast = useToast();
  const [list, setList] = useState<CategoryRec[]>(index.categories.map((c) => ({ ...c })));
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const clean = list.filter((c) => c.name.trim()).map((c) => ({ ...c, name: c.name.trim() }));
    setBusy(true);
    try {
      const ids = new Set(clean.map((c) => c.id));
      onIndex(await studio.updateIndex((i) => {
        i.categories = clean;
        i.projects.forEach((p) => { if (p.category && !ids.has(p.category)) p.category = ""; });
      }, "Update categories"));
      toast("Categories saved");
      onClose();
    } catch (e) {
      toast(explain(e), "bad");
      setBusy(false);
    }
  };
  return (
    <Modal title="Categories" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-pri" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save categories"}</button></>}>
      <p className="text-sm text-ink-300">Group projects by client, purpose or anything you like. Deleting a category keeps its projects, uncategorised.</p>
      {list.map((c, i) => (
        <div key={c.id} className="flex items-center gap-2">
          <div className="flex gap-1">
            {CATEGORY_COLORS.map((col) => <button key={col} type="button" aria-label={`Colour ${col}`} aria-pressed={c.color === col} onClick={() => setList(list.map((x, j) => (j === i ? { ...x, color: col } : x)))} className={`h-5 w-5 rounded-full ${c.color === col ? "ring-2 ring-white" : ""}`} style={{ background: col }} />)}
          </div>
          <input aria-label="Category name" className="input py-2" value={c.name} onChange={(e) => setList(list.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
          <button type="button" className="icon-btn hover:text-red-300" aria-label="Delete category" onClick={() => setList(list.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button type="button" className="btn btn-sm self-start" onClick={() => setList([...list, { id: slugify("cat") + "-" + Date.now().toString(36), name: "New category", color: CATEGORY_COLORS[list.length % CATEGORY_COLORS.length] }])}>+ Add category</button>
    </Modal>
  );
}
