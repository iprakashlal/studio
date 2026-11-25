import { themeCode } from "../themes/codes";
import { useCallback, useEffect, useRef, useState } from "react";
import { TEMPLATES } from "../schema";
import { buildDesign, type Design } from "../lib/designer";
import { deleteQuery, designHost, listQueries, queryFiles, setQueryStatus, type DesignHost, type Query } from "../lib/designapi";
import type { Studio, StudioIndex } from "../lib/studio";
import { explain } from "../lib/repo";
import { Empty, SkelRows, useConfirm, useToast } from "../ui/kit";
import { Pager, usePage } from "../ui/Pager";
import { PreviewPopup } from "./DesignPage";

const ACC: Record<string, string> = { portfolio: "#8b5cf6", store: "#f08a24", business: "#3b82f6", restaurant: "#e5484d" };
const ago = (iso: string) => { const m = Math.max(0, Math.round((Date.now() - +new Date(iso)) / 60000)); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
const STATUS: Record<string, { label: string; cls: string }> = { new: { label: "New", cls: "border-emerald-400/60 text-emerald-200" }, read: { label: "Seen", cls: "border-ink-500 text-ink-300" }, done: { label: "Done", cls: "border-brand-400/50 text-brand-200" } };

/** How many requests are new (shown on the tab). It loads by itself and never blocks the page. */
export function useNewQueries(): number | null {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    let live = true, t: ReturnType<typeof setTimeout>;
    const run = async () => { const h = await designHost(); if (h) { try { const l = await listQueries(h); if (live) setN(l.filter((q) => q.status === "new").length); } catch { /* not signed in, or an older database */ } } if (live) t = setTimeout(run, 90_000); };
    run(); return () => { live = false; clearTimeout(t); };
  }, []);
  return n;
}

/** Projects → DIY Submissions: the requests people sent from the Design yourself page, read from the Studio's database as it loads. */
export function QueriesTab({ studio, index, onIndex }: { studio: Studio; index: StudioIndex; onIndex: (i: StudioIndex) => void }) {
  const toast = useToast(), confirm = useConfirm();
  const [host, setHost] = useState<DesignHost | null | undefined>(undefined);
  const [rows, setRows] = useState<Query[] | null>(null);
  const [pg, setPg] = useState(0), pageOf = usePage(rows || [], 6, pg, setPg);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<{ q: Query; design: Design; ver: number } | null>(null);
  const [busy, setBusy] = useState("");
  const mine = useRef(true);

  const load = useCallback(async (h: DesignHost, quiet = false) => {
    if (!quiet) setLoading(true);
    try { const l = await listQueries(h); if (mine.current) { setRows(l); setErr(""); } }
    catch (e: any) { if (mine.current) setErr(e?.status === 404 || e?.status === 403 || e?.status === 401 ? (e?.status === 401 ? "Sign in to the Studio again to see the requests." : "The database doesn't have this yet. Update it once from Settings → Hosting accounts, then come back.") : explain(e)); }
    if (mine.current) setLoading(false);
  }, []);
  useEffect(() => { mine.current = true; designHost().then(setHost); return () => { mine.current = false; }; }, []);
  // It loads as the tab opens, then keeps itself fresh.
  useEffect(() => { if (!host) return; load(host); const t = setInterval(() => load(host, true), 45_000); return () => clearInterval(t); }, [host]);

  const act = async (id: string, fn: () => Promise<void>) => { setBusy(id); try { await fn(); } catch (e) { toast(explain(e), "bad"); } setBusy(""); };
  const design = async (q: Query) => {
    let logo = ""; let menu: { name: string; b64: string } | undefined; let pics: Record<string, string[]> | undefined;
    if (q.has_logo || q.pdf_name || q.has_pics) { const f = await queryFiles(host!, q.id); logo = f.logo || ""; if (f.pdf) menu = { name: f.pdf_name, b64: f.pdf }; if (f.pics && Object.keys(f.pics).length) pics = f.pics; }
    const d = await buildDesign(q.answers, q.copy, { ...(logo ? { logo } : {}), ...(menu ? { menu } : {}), ...(pics ? { pics } : {}) });
    if (!d) throw new Error("This request can't be rebuilt.");
    return d;
  };
  const mark = async (q: Query, status: string) => { await setQueryStatus(host!, q.id, status); setRows((r) => (r || []).map((x) => (x.id === q.id ? { ...x, status: status as Query["status"] } : x))); };

  if (host === undefined) return <SkelRows n={2} label="Loading requests" />;
  if (!host) return <Empty title="Submissions need the Cloudflare database" body="Design yourself saves each request in your Studio's own Cloudflare database. This Studio isn't on one, so requests can't be received here." />;
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-sm text-ink-400">Submissions sent from the Design yourself page (DIY). Each was saved in your Studio's database and emailed to the owners.</p>
        <button type="button" className="btn btn-sm" disabled={loading} onClick={() => load(host)}>{loading ? "Loading…" : "Refresh"}</button>
      </div>
      {err && <p className="rounded-lg border border-red-400/40 bg-red-400/5 px-3 py-2 text-[13px] text-red-200" role="alert">{err}</p>}
      {rows === null ? (err ? null : <SkelRows n={3} label="Loading requests" />) : !rows.length ? (
        <Empty title="No submissions yet" body="When someone finishes a design and presses Connect with Picaffectz, their request appears here." action={<a className="btn btn-pri" href="#/design">Open Design yourself</a>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {pageOf.slice.map((q) => {
            const acc = ACC[q.kind] || "#5B7CFF", st = STATUS[q.status] || STATUS.new, t = TEMPLATES[q.kind];
            return (
              <article key={q.id} style={{ "--acc": acc } as React.CSSProperties} className="card group relative flex flex-col overflow-hidden rounded-3xl transition duration-200 hover:-translate-y-1 hover:border-ink-500 hover:shadow-[0_22px_44px_-22px_var(--acc)]">
                <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${acc}, ${acc}55)` }} />
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <div className="flex items-center gap-2 text-xs"><span className={`chip ${st.cls}`}>{st.label}</span><span className="ml-auto text-ink-400">{ago(q.created_at)}</span></div>
                  <h2 className="truncate font-display text-xl font-extrabold leading-tight">{q.name}</h2>
                  <p className="text-[13px] text-ink-400">{t?.name || q.kind}{q.answers.city ? ` · ${q.answers.city}` : ""}</p>
                  {(q.answers.themeid || q.answers.theme) && <p className="text-xs text-ink-300">Theme ID: <b className="rounded bg-ink-800 px-1.5 py-0.5 font-mono text-brand-200">{themeCode({ id: q.answers.themeid || q.answers.theme })}</b></p>}
                  <div className="rounded-xl border border-ink-700 bg-ink-950/40 p-3 text-[13px]">
                    <b className="block text-ink-100">{q.person}</b>
                    {q.phone && <a className="block text-brand-200 hover:underline" href={`tel:${q.phone.replace(/[^\d+]/g, "")}`}>{q.phone}</a>}
                    {q.email && <a className="block break-all text-brand-200 hover:underline" href={`mailto:${q.email}`}>{q.email}</a>}
                    {q.email && q.answers.emailverified && <span className={`text-xs ${q.answers.emailverified === "yes" ? "text-emerald-300" : "text-amber-300"}`}>{q.answers.emailverified === "yes" ? "Email verified" : "Email not verified"}</span>}
                    {q.note && <p className="mt-1.5 whitespace-pre-line text-ink-300">{q.note}</p>}
                  </div>
                  {q.answers.about && <p className="line-clamp-2 text-[13px] text-ink-300">{q.answers.about}</p>}
                  {(q.answers.doc || q.answers.doclink) && <p className="text-xs text-ink-400">{q.answers.doc ? `Document: ${q.answers.doc}${q.answers.doctext ? " (text read)" : ""}` : ""}{q.answers.doc && q.answers.doclink ? " · " : ""}{q.answers.doclink ? <>Link: <a className="underline" href={q.answers.doclink} target="_blank" rel="noopener noreferrer">{q.answers.doclink}</a></> : null}</p>}
                  {(q.answers.theme || q.answers.accent || q.answers.mode) && <p className="text-xs text-ink-400">Chosen look: {[q.answers.theme, q.answers.accent, q.answers.mode].filter(Boolean).join(" · ")}</p>}
                  {(q.pdf_name || q.has_logo || q.has_pics) && <p className="text-xs text-ink-400">{[q.has_logo ? "Logo added" : "", q.has_pics ? "Pictures added" : "", q.pdf_name ? `Menu PDF: ${q.pdf_name}` : ""].filter(Boolean).join(" · ")}</p>}
                  {q.mail && <p className="text-xs text-amber-200">{q.mail}</p>}
                  <div className="mt-auto flex flex-wrap gap-2 border-t border-ink-700/70 pt-4">
                    <button type="button" className="btn btn-pri btn-sm" disabled={!!busy} onClick={() => act("pv" + q.id, async () => { const d = await design(q); setOpen({ q, design: d, ver: 1 }); if (q.status === "new") mark(q, "read").catch(() => {}); })}>{busy === "pv" + q.id ? "Opening…" : "Preview"}</button>
                    <button type="button" className="btn btn-sm" disabled={!!busy} onClick={() => act("mk" + q.id, async () => {
                      const d = await design(q); const { index: i, id } = await studio.createProject({ name: q.name, template: d.kind, category: index.categories[0]?.id || "", client: q.person, content: d.content, summary: d.summary });
                      onIndex(i); await mark(q, "done").catch(() => {}); toast("Project created"); location.hash = `#/p/${id}`;
                    })}>{busy === "mk" + q.id ? "Creating…" : "Make it a project"}</button>
                    {q.status !== "done" ? <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => act("st" + q.id, () => mark(q, "done"))}>Mark done</button> : <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => act("st" + q.id, () => mark(q, "new"))}>Reopen</button>}
                    <button type="button" className="btn btn-ghost btn-sm text-red-300 hover:text-red-200" disabled={!!busy} onClick={async () => { if (await confirm(`Delete the request from ${q.person}?`, "This removes it from the database for good.", "Delete", true)) act("rm" + q.id, async () => { await deleteQuery(host, q.id); setRows((r) => (r || []).filter((x) => x.id !== q.id)); toast("Request deleted"); }); }}>Delete</button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {rows && rows.length > 0 && <Pager page={pageOf.at} pages={pageOf.pages} total={rows.length} per={6} onPage={setPg} noun="submissions" />}
      {open && <PreviewPopup design={open.design} ver={open.ver} a={open.q.answers} done onClose={() => setOpen(null)} />}
    </>
  );
}
