import { themeCode } from "../themes/codes";
import { useEffect, useState } from "react";
import { deleteDraft, designHost, listDrafts, type Draft, type DesignHost } from "../lib/designapi";
import { TEMPLATES } from "../schema";
import { buildDesign, type Design } from "../lib/designer";
import type { DesignRec } from "../lib/designs";
import type { Studio, StudioIndex } from "../lib/studio";
import { explain } from "../lib/repo";
import { Empty, useConfirm, useToast } from "../ui/kit";
import { Pager, usePage } from "../ui/Pager";
import { PreviewPopup } from "./DesignPage";

const KIND_ACC: Record<string, string> = { portfolio: "#8b5cf6", store: "#f08a24", business: "#3b82f6", restaurant: "#e5484d", events: "#22a06b" };
const ago = (iso: string) => { const m = Math.max(0, Math.round((Date.now() - +new Date(iso)) / 60000)); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };

/** Progress kept in the Studio's database by people whose email is confirmed and who have not sent it yet. */
export function useDrafts(): { host: DesignHost | null; list: Draft[]; reload: () => void } {
  const [host, setHost] = useState<DesignHost | null>(null), [list, setList] = useState<Draft[]>([]), [n, setN] = useState(0);
  useEffect(() => {
    let live = true, t: ReturnType<typeof setTimeout>;
    const run = async () => { const h = await designHost(); if (h && live) { setHost(h); try { const l = await listDrafts(h); if (live) setList(l); } catch { /* not signed in, or an older database */ } } if (live) t = setTimeout(run, 90_000); };
    run(); return () => { live = false; clearTimeout(t); };
  }, [n]);
  return { host, list, reload: () => setN((x) => x + 1) };
}

/** Projects → Design previews: what people made on the "Design yourself" page. */
export function DesignsTab({ studio, index, onIndex }: { studio: Studio; index: StudioIndex; onIndex: (i: StudioIndex) => void }) {
  const toast = useToast(), confirm = useConfirm();
  const saved = index.designs || [], dr = useDrafts();
  const asRec = (d: Draft): DesignRec & { email: string } => ({ id: d.id, name: d.name || "Untitled", kind: d.kind, themeId: d.themeId, themeName: d.themeName, answers: d.answers, createdAt: d.updatedAt || d.createdAt, summary: d.summary, copy: d.copy, ...(d.logo ? { logo: d.logo } : {}), email: d.email });
  const list: (DesignRec & { email?: string })[] = [...dr.list.filter((d) => d.kind).map(asRec), ...saved];
  const [open, setOpen] = useState<{ rec: DesignRec; design: Design; ver: number } | null>(null);
  const [busy, setBusy] = useState(""), [pg, setPg] = useState(0);
  const pageOf = usePage(list, 9, pg, setPg);
  const load = async (rec: DesignRec) => { const d = await buildDesign(rec.answers, rec.copy, rec.logo ? { logo: rec.logo } : null); if (!d) throw new Error("This preview can't be rebuilt."); return d; };
  const act = async (id: string, fn: () => Promise<void>) => { setBusy(id); try { await fn(); } catch (e) { toast(explain(e), "bad"); } setBusy(""); };

  if (!list.length) return <Empty title="No design previews yet" body="When someone confirms their email and answers the questions on the Design yourself page, their progress is kept here as a card. Once they send it, it moves to DIY Submissions. Open the page from the Themes gallery." action={<a className="btn btn-pri" href="#/design">Open Design yourself</a>} />;
  return (
    <>
      <p className="text-sm text-ink-400">Websites designed by answering simple questions. They are previews: nothing is published. Turn one into a real project when you take it forward.</p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {pageOf.slice.map((r) => {
          const acc = KIND_ACC[r.kind] || "#5B7CFF", t = TEMPLATES[r.kind];
          return (
            <article key={r.id} style={{ "--acc": acc } as React.CSSProperties} className="card group relative flex flex-col overflow-hidden rounded-3xl transition duration-200 hover:-translate-y-1 hover:border-ink-500 hover:shadow-[0_22px_44px_-22px_var(--acc)]">
              <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${acc}, ${acc}55)` }} />
              <div className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex items-center gap-2 text-xs"><span className="chip border-amber-400/50 text-amber-200">{r.email ? "In progress · not sent" : "Preview · not published"}</span><span className="ml-auto text-ink-400">{ago(r.createdAt)}</span></div>
                <h2 className="truncate font-display text-xl font-extrabold leading-tight">{r.name}</h2>
                <p className="text-[13px] text-ink-400">{t?.name || r.kind} · {r.themeName || "Theme"}{r.themeId ? ` (${themeCode({ id: r.themeId })})` : ""}{r.answers.city ? ` · ${r.answers.city}` : ""}</p>
                {r.email && <p className="truncate text-[12.5px] text-emerald-200">✓ {r.email} (verified)</p>}
                {r.answers.about && <p className="line-clamp-2 text-[13px] text-ink-300">{r.answers.about}</p>}
                <div className="mt-auto flex flex-wrap gap-2 border-t border-ink-700/70 pt-4">
                  <button type="button" className="btn btn-pri btn-sm" disabled={!!busy} onClick={() => act(r.id, async () => setOpen({ rec: r, design: await load(r), ver: 1 }))}>{busy === r.id ? "Opening…" : "Preview"}</button>
                  <button type="button" className="btn btn-sm" disabled={!!busy} onClick={() => act("mk" + r.id, async () => {
                    const d = await load(r); const { index: i, id } = await studio.createProject({ name: r.name, template: d.kind, category: index.categories[0]?.id || "", client: "", content: d.content, summary: d.summary });
                    onIndex(i); toast("Project created"); location.hash = `#/p/${id}`;
                  })}>{busy === "mk" + r.id ? "Creating…" : "Make it a project"}</button>
                  <button type="button" className="btn btn-ghost btn-sm text-red-300 hover:text-red-200" disabled={!!busy} onClick={async () => { if (await confirm(`Delete the preview “${r.name}”?`, "This only removes the preview. Projects made from it are not affected.", "Delete", true)) act("rm" + r.id, async () => { if (r.email && dr.host) { await deleteDraft(dr.host, r.id); dr.reload(); } else onIndex(await studio.updateIndex((x) => { x.designs = (x.designs || []).filter((d) => d.id !== r.id); }, "Delete a design preview")); toast("Preview deleted"); }); }}>Delete</button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <Pager page={pageOf.at} pages={pageOf.pages} total={list.length} per={9} onPage={setPg} noun="previews" />
      {open && <PreviewPopup design={open.design} ver={open.ver} a={open.rec.answers} done onClose={() => setOpen(null)} />}
    </>
  );
}
