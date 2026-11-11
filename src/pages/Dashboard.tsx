import { useEffect, useMemo, useState } from "react";
import { ThemeGallery } from "../themes/ThemeGallery";
import { themeById } from "../themes/catalog";
import { TEMPLATES, TEMPLATE_LIST } from "../schema";
import { CATEGORY_COLORS, type CategoryRec, type ProjectMeta, type Studio, type StudioIndex } from "../lib/studio";
import { GitHubRepo, explain } from "../lib/repo";
import { loadManifest, loadStarter, type Manifest } from "../lib/exporter";
import { slugify, timeAgo } from "../lib/util";
import { Empty, Field, Modal, useConfirm, useToast } from "../ui/kit";

const STATUS: Record<ProjectMeta["status"], { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "border-ink-500 text-ink-300" },
  exported: { label: "Exported", cls: "border-sky-400/60 text-sky-200" },
  published: { label: "Published", cls: "border-emerald-400/60 text-emerald-200" },
};

/** Last live-site check per project, so going back and forth doesn't re-check every time. */
const checked = new Map<string, number>();

export function Dashboard({ studio, index, onIndex, token }: { studio: Studio; index: StudioIndex; onIndex: (i: StudioIndex) => void; token: string }) {
  const toast = useToast();
  const [live, setLive] = useState<Record<string, "checking" | "pulled" | "conflict">>({});

  // Central control: published projects pick up edits made in their sites' own CMS.
  useEffect(() => {
    if (studio.repo.demo) return;
    let on = true;
    (async () => {
      const due = index.projects.filter((p) => p.publish && Date.now() - (checked.get(p.id) || 0) > 60_000);
      const pulled: string[] = [];
      for (const p of due) {
        if (!on) return;
        checked.set(p.id, Date.now());
        setLive((m) => ({ ...m, [p.id]: "checking" }));
        try {
          const site = new GitHubRepo(p.publish!, token);
          const st = await studio.siteState(p, site);
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
  }, [index.projects.map((p) => p.id + (p.publish ? p.publish.repo : "")).join()]);
  const confirm = useConfirm();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [tpl, setTpl] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("updated");
  const [creating, setCreating] = useState(false);
  const [managing, setManaging] = useState(false);
  const [busy, setBusy] = useState("");

  const cats = index.categories;
  const catById = (id: string) => cats.find((c) => c.id === id);
  const list = useMemo(() => {
    let l = index.projects.filter((p) => (!cat || p.category === cat) && (!tpl || p.template === tpl) && (!status || p.status === status)
      && (!q || `${p.name} ${p.client} ${p.summary || ""}`.toLowerCase().includes(q.toLowerCase())));
    l = [...l].sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : sort === "created" ? b.createdAt.localeCompare(a.createdAt) : b.updatedAt.localeCompare(a.updatedAt));
    return l;
  }, [index, q, cat, tpl, status, sort]);

  const stats = [
    { n: index.projects.length, l: "Projects" },
    { n: index.projects.filter((p) => p.status !== "draft").length, l: "Exported or published" },
    { n: index.projects.filter((p) => p.status === "published").length, l: "Published to GitHub" },
    { n: index.projects.reduce((s, p) => s + p.exports.length, 0), l: "Exports in total" },
  ];

  const run = async (key: string, fn: () => Promise<StudioIndex>, ok: string) => {
    setBusy(key);
    try { onIndex(await fn()); toast(ok); } catch (e) { toast(explain(e), "bad"); }
    setBusy("");
  };

  return (
    <main className="mx-auto flex max-w-[1400px] flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold sm:text-4xl">Projects</h1>
          <p className="mt-1 text-sm text-ink-400">Create, preview, export and re-edit websites. Every site ships with its own CMS.</p>
        </div>
        <button className="btn btn-pri" onClick={() => setCreating(true)}>+ New project</button>
      </div>

      <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-ink-700 md:grid-cols-4">
        {stats.map((s, i) => (
          <div key={s.l} className={`bg-ink-900 px-5 py-4 ${i % 2 ? "" : "border-r border-ink-700"} ${i < 2 ? "border-b border-ink-700 md:border-b-0" : ""} md:border-r md:last:border-r-0`}>
            <div className="font-display text-3xl font-extrabold tabular-nums">{s.n}</div>
            <div className="text-xs text-ink-400">{s.l}</div>
          </div>
        ))}
      </div>

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
          <input className="input max-w-xs py-2" type="search" placeholder="Search projects or clients" aria-label="Search projects" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input w-auto py-2" aria-label="Template" value={tpl} onChange={(e) => setTpl(e.target.value)}><option value="">All templates</option>{TEMPLATE_LIST.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
          <select className="input w-auto py-2" aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Any status</option><option value="draft">Draft</option><option value="exported">Exported</option><option value="published">Published</option></select>
          <select className="input w-auto py-2" aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)}><option value="updated">Recently edited</option><option value="created">Newest</option><option value="name">Name</option></select>
        </div>
      </div>

      {!index.projects.length ? (
        <Empty title="Start your first site" body="Pick a template, add content, preview it live, then export a ZIP or publish straight to a GitHub repository." action={<button className="btn btn-pri" onClick={() => setCreating(true)}>+ New project</button>} />
      ) : !list.length ? (
        <Empty title="No projects match" body="Try another category, template or search." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => {
            const c = catById(p.category), t = TEMPLATES[p.template], st = STATUS[p.status], last = p.exports[0];
            return (
              <article key={p.id} className="card group relative flex flex-col overflow-hidden transition hover:border-ink-500">
                <div className="h-1.5" style={{ background: c?.color || "#2E3A4C" }} />
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="chip">{t?.name || p.template} · {t?.kind}</span>
                    <span className={`chip ${st.cls}`}>{st.label}</span>
                    {live[p.id] === "checking" && <span className="chip border-ink-600 text-ink-400">Checking live site…</span>}
                    {live[p.id] === "pulled" && <span className="chip border-emerald-400/60 text-emerald-200" title="Edits made in the site's own CMS were copied into this project.">Updated from live site</span>}
                    {live[p.id] === "conflict" && <span className="chip border-amber-400/60 text-amber-200" title="The site's own CMS and the Studio both changed the content. Open the project to choose which to keep.">Live site edited · review</span>}
                    {c && <span className="ml-auto truncate text-ink-400">{c.name}</span>}
                  </div>
                  <a href={`#/p/${p.id}`} className="after:absolute after:inset-0">
                    <h2 className="font-display text-xl font-extrabold leading-tight">{p.name}</h2>
                  </a>
                  <p className="text-sm text-ink-400">{[p.client, p.summary].filter(Boolean).join(" · ") || "No client set"}</p>
                  <dl className="mt-auto grid grid-cols-2 gap-2 border-t border-ink-700 pt-3 text-xs">
                    <div><dt className="text-ink-500">Edited</dt><dd className="font-semibold text-ink-200">{timeAgo(p.updatedAt)}</dd></div>
                    <div><dt className="text-ink-500">Last export</dt><dd className="font-semibold text-ink-200">{last ? `v${last.version} · ${timeAgo(last.at)}` : "Not yet"}</dd></div>
                  </dl>
                  <div className="relative z-10 flex flex-wrap gap-2">
                    <a href={`#/p/${p.id}`} className="btn btn-pri btn-sm">Open</a>
                    <button className="btn btn-sm" disabled={!!busy} onClick={() => run("dup" + p.id, () => studio.duplicate(p.id, `${p.name} (copy)`), "Project duplicated")}>{busy === "dup" + p.id ? "Copying…" : "Duplicate"}</button>
                    {p.publish && <a className="btn btn-sm" href={`https://${p.publish.owner}.github.io/${p.publish.repo === `${p.publish.owner}.github.io` ? "" : p.publish.repo + "/"}`} target="_blank" rel="noopener">Live site ↗</a>}
                    <button className="btn btn-sm btn-danger ml-auto" disabled={!!busy} onClick={async () => {
                      if (await confirm(`Delete “${p.name}”?`, "This removes the project, its images and export snapshots from the Studio. Sites you already exported or published are not affected.", "Delete", true)) run("del" + p.id, () => studio.remove(p.id), "Project deleted");
                    }}>Delete</button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {creating && <NewProject studio={studio} index={index} onClose={() => setCreating(false)} onCreated={(i, id) => { onIndex(i); setCreating(false); location.hash = `#/p/${id}`; }} />}
      {managing && <Categories studio={studio} index={index} onClose={() => setManaging(false)} onIndex={onIndex} />}
    </main>
  );
}

function NewProject({ studio, index, onClose, onCreated }: { studio: Studio; index: StudioIndex; onClose: () => void; onCreated: (i: StudioIndex, id: string) => void }) {
  const toast = useToast();
  const [f, setF] = useState({ name: "", client: "", template: "portfolio", starter: "default", theme: "", category: index.categories[0]?.id || "" });
  const [man, setMan] = useState<Record<string, Manifest>>({});
  const [busy, setBusy] = useState(false);
  const pick = (template: string) => setF((x) => ({ ...x, template, starter: "default" }));
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
          {TEMPLATE_LIST.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={f.template === t.id} onClick={() => pick(t.id)}
              className={`flex flex-col gap-1.5 rounded-xl border p-4 text-left ${f.template === t.id ? "border-brand-500 bg-brand-500/10" : "border-ink-600 bg-ink-950 hover:border-ink-400"}`}>
              <span className="flex items-center gap-2 font-extrabold">{t.name}<span className="chip">{t.kind}</span></span>
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
          <ThemeGallery compact current={f.theme} onPick={(t) => setF({ ...f, theme: t.id })} />
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
