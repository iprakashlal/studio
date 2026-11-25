import { themeCode } from "../themes/codes";
import { useState } from "react";
import { TEMPLATES } from "../schema";
import { buildDesign, type Design } from "../lib/designer";
import type { DesignRec } from "../lib/designs";
import type { Studio, StudioIndex } from "../lib/studio";
import { explain } from "../lib/repo";
import { Empty, useConfirm, useToast } from "../ui/kit";
import { PreviewPopup } from "./DesignPage";

const KIND_ACC: Record<string, string> = { portfolio: "#8b5cf6", store: "#f08a24", business: "#3b82f6", restaurant: "#e5484d" };
const ago = (iso: string) => { const m = Math.max(0, Math.round((Date.now() - +new Date(iso)) / 60000)); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };

/** Projects → Design previews: what people made on the "Design yourself" page. */
export function DesignsTab({ studio, index, onIndex }: { studio: Studio; index: StudioIndex; onIndex: (i: StudioIndex) => void }) {
  const toast = useToast(), confirm = useConfirm();
  const list = index.designs || [];
  const [open, setOpen] = useState<{ rec: DesignRec; design: Design; ver: number } | null>(null);
  const [busy, setBusy] = useState("");
  const load = async (rec: DesignRec) => { const d = await buildDesign(rec.answers, rec.copy, rec.logo ? { logo: rec.logo } : null); if (!d) throw new Error("This preview can't be rebuilt."); return d; };
  const act = async (id: string, fn: () => Promise<void>) => { setBusy(id); try { await fn(); } catch (e) { toast(explain(e), "bad"); } setBusy(""); };

  if (!list.length) return <Empty title="No design previews yet" body="When someone answers the questions on the Design yourself page, their preview is kept here as a card. Open the page from the Themes gallery." action={<a className="btn btn-pri" href="#/design">Open Design yourself</a>} />;
  return (
    <>
      <p className="text-sm text-ink-400">Websites designed by answering simple questions. They are previews: nothing is published. Turn one into a real project when you take it forward.</p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((r) => {
          const acc = KIND_ACC[r.kind] || "#5B7CFF", t = TEMPLATES[r.kind];
          return (
            <article key={r.id} style={{ "--acc": acc } as React.CSSProperties} className="card group relative flex flex-col overflow-hidden rounded-3xl transition duration-200 hover:-translate-y-1 hover:border-ink-500 hover:shadow-[0_22px_44px_-22px_var(--acc)]">
              <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${acc}, ${acc}55)` }} />
              <div className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex items-center gap-2 text-xs"><span className="chip border-amber-400/50 text-amber-200">Preview · not published</span><span className="ml-auto text-ink-400">{ago(r.createdAt)}</span></div>
                <h2 className="truncate font-display text-xl font-extrabold leading-tight">{r.name}</h2>
                <p className="text-[13px] text-ink-400">{t?.name || r.kind} · {r.themeName || "Theme"}{r.themeId ? ` (${themeCode({ id: r.themeId })})` : ""}{r.answers.city ? ` · ${r.answers.city}` : ""}</p>
                {r.answers.about && <p className="line-clamp-2 text-[13px] text-ink-300">{r.answers.about}</p>}
                <div className="mt-auto flex flex-wrap gap-2 border-t border-ink-700/70 pt-4">
                  <button type="button" className="btn btn-pri btn-sm" disabled={!!busy} onClick={() => act(r.id, async () => setOpen({ rec: r, design: await load(r), ver: 1 }))}>{busy === r.id ? "Opening…" : "Preview"}</button>
                  <button type="button" className="btn btn-sm" disabled={!!busy} onClick={() => act("mk" + r.id, async () => {
                    const d = await load(r); const { index: i, id } = await studio.createProject({ name: r.name, template: d.kind, category: index.categories[0]?.id || "", client: "", content: d.content, summary: d.summary });
                    onIndex(i); toast("Project created"); location.hash = `#/p/${id}`;
                  })}>{busy === "mk" + r.id ? "Creating…" : "Make it a project"}</button>
                  <button type="button" className="btn btn-ghost btn-sm text-red-300 hover:text-red-200" disabled={!!busy} onClick={async () => { if (await confirm(`Delete the preview “${r.name}”?`, "This only removes the preview. Projects made from it are not affected.", "Delete", true)) act("rm" + r.id, async () => { onIndex(await studio.updateIndex((x) => { x.designs = (x.designs || []).filter((d) => d.id !== r.id); }, "Delete a design preview")); toast("Preview deleted"); }); }}>Delete</button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {open && <PreviewPopup design={open.design} ver={open.ver} a={open.rec.answers} done onClose={() => setOpen(null)} />}
    </>
  );
}
