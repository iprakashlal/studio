// The Studio's own reading pages (privacy, terms…) at #/pages/<name>, open to anyone with the link, and the links to
// them on the sign-in screen and under the Studio. Set up in Settings → Additional pages.
import { useEffect, useMemo, useState, type CSSProperties, type MouseEvent } from "react";
import "../fx/pages.js";
import type { Repo } from "../lib/repo";
import { explain } from "../lib/repo";
import type { StudioHostCfg } from "../lib/studiohost";
import { loadHostConfig } from "../lib/studiohost";
import { cfDeployInfo } from "../lib/cfdb";
import { PAGES_FILE, pageHref, repoPages, savePages, slugOf, studioPageDefault, useStudioPages, type StudioPage } from "../lib/studiopages";
import { pageSlug, staticPageFields } from "../schema/common";
import { BrandMark, useBrand } from "../lib/brand";
import { Logo, useToast } from "../ui/kit";
import { Ctx, FieldView } from "../editor/fields";
import { TEMPLATES } from "../schema";
import { basePath } from "../lib/util";

const SP = () => (window as any).SitePages as { article: (p: any, o: any) => string; missing: (o: any) => string; after: (p: any) => void };
/** Reading colours for the Studio's dark look (assets/pages.js reads these). */
const VARS = { "--text": "#EEF1F6", "--soft": "#A9B3C4", "--line": "#2E3A4C", "--c1": "#8099FF", "--r": "14px", "--fd": "inherit", "--fb": "inherit" } as CSSProperties;

/** Links to the Studio's pages; `where` picks those switched on for the sign-in screen or the Studio's footer. */
export function StudioPageLinks({ host, repo, where, className = "" }: { host: StudioHostCfg | null | undefined; repo?: Repo | null; where: "gate" | "footer"; className?: string }) {
  const { pages } = useStudioPages(host, repo);
  const list = pages.filter((p) => (where === "gate" ? p.inGate !== false : p.inFooter !== false));
  if (!list.length) return null;
  return <nav aria-label="Studio pages" className={`flex flex-wrap justify-center gap-x-4 gap-y-1 text-[12.5px] text-ink-400 ${className}`}>{list.map((p) => <a key={p.id} className="hover:text-ink-100 hover:underline" href={pageHref(p)}>{p.navLabel || p.title}</a>)}</nav>;
}

/** #/pages/<name>: one page, readable without signing in (a hidden page only by signed-in people, marked). */
export function StudioPageView({ slug, host, repo }: { slug: string; host: StudioHostCfg | null | undefined; repo?: Repo | null }) {
  const b = useBrand();
  const { pages, ready } = useStudioPages(host, repo, !!repo);
  const p = pages.find((x) => slugOf(x) === pageSlug(slug)) || null;
  useEffect(() => { document.title = p ? `${p.title.replace(/\s+/g, " ")} · ${b.name}` : b.name; SP().after(p); return () => SP().after(null); }, [p, b.name]);
  const html = useMemo(() => (p ? SP().article(p, { home: "#/", homeLabel: b.name, preview: !!repo }) : ready ? SP().missing({ home: "#/", homeLabel: "Back to the Studio" }) : ""), [p, ready, b.name, repo]);
  // Section links (#what-we-collect) scroll within the page instead of changing the Studio's route.
  const jump = (e: MouseEvent) => {
    const a = (e.target as HTMLElement).closest?.("a"); const h = a?.getAttribute("href") || "";
    if (!h.startsWith("#") || h.startsWith("#/")) return;
    e.preventDefault(); document.getElementById(decodeURIComponent(h.slice(1)))?.scrollIntoView({ behavior: "smooth" });
  };
  return (
    <div className="min-h-screen bg-ink-950" style={VARS}>
      <header className="border-b border-ink-700">
        <div className="mx-auto flex max-w-[1040px] items-center gap-3 px-4 py-3 sm:px-6">
          <a href="#/" className="flex items-center gap-2.5 font-extrabold"><BrandMark fallback={<Logo />} />{b.name}</a>
          <a href="#/" className="btn btn-ghost btn-sm ml-auto text-ink-400">← {repo ? "Back to the Studio" : "Sign in"}</a>
        </div>
      </header>
      {html ? <div onClick={jump} dangerouslySetInnerHTML={{ __html: html }} /> : <p className="py-24 text-center text-sm text-ink-400">Loading…</p>}
      <footer className="border-t border-ink-700 py-5"><StudioPageLinks host={host} repo={repo} where="footer" /></footer>
    </div>
  );
}

/** Settings → Additional pages: the Studio's own privacy policy, terms and other reading pages. */
export function StudioPagesCard({ repo }: { repo: Repo }) {
  const toast = useToast();
  const [draft, setDraft] = useState<{ pages: StudioPage[] } | null>(null);
  const [sha, setSha] = useState<string | null>(null);
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  const [v, setV] = useState(0);
  const [reach, setReach] = useState<"public" | "update" | "private" | null>(null);
  const load = () => repoPages(repo).then((r) => { setDraft({ pages: r.pages }); setSha(r.sha); setSaved(JSON.stringify(r.pages)); }).catch((e) => toast(explain(e), "bad"));
  useEffect(() => { load(); }, [repo]);
  useEffect(() => {
    loadHostConfig().then(async (h) => {
      if (!h) return setReach("private");
      if (h.kind === "supabase") return setReach("public");
      setReach((await cfDeployInfo(h.api)).studioPages ? "public" : "update");
    }).catch(() => setReach(null));
  }, []);
  const addr = location.origin + basePath() + "#/pages/";
  const fields = useMemo(() => [{ t: "list" as const, path: "pages", max: 30, add: () => studioPageDefault(), title: (it: any) => `${it?.title || "Untitled page"}${it?.show === false ? " (hidden)" : ""}`,
    item: staticPageFields(addr, [{ t: "toggle", path: "inGate", label: "Link on the sign-in screen" }, { t: "toggle", path: "inFooter", label: "Link under the Studio" }, { t: "text", path: "navLabel", label: "Link name (optional)", ph: "the title" }], "Show “Studio / page” at the top") }], [addr]);
  const dirty = !!draft && JSON.stringify(draft.pages) !== saved;
  const save = async () => {
    if (!draft) return;
    const slugs = draft.pages.map(slugOf); const dup = slugs.find((s, i) => slugs.indexOf(s) !== i);
    if (dup) return toast(`Two pages use the address name “${dup}”. Change one of them.`, "bad");
    setBusy(true);
    try { setSha(await savePages(repo, draft.pages, sha)); setSaved(JSON.stringify(draft.pages)); toast("Saved. The pages are live at their addresses."); }
    catch (e) { toast(explain(e), "bad"); await load(); }
    setBusy(false);
  };
  const ctx = useMemo(() => ({ tpl: TEMPLATES.business, root: draft, bump: () => setV((x) => x + 1), upload: async () => { throw new Error("Pictures aren't used on these pages."); }, img: () => "" }), [draft]);
  return (
    <section className="card flex flex-col gap-4 p-5" aria-label="Additional pages">
      <h3 className="text-[15px] font-extrabold">Additional pages</h3>
      <p className="text-sm text-ink-300">The Studio's own reading pages, such as its privacy policy and terms. Each one opens at <span className="font-mono text-[12.5px]">{addr}&lt;name&gt;</span> and can be linked on the sign-in screen and under the Studio. Saved in the Studio's files (<code className="font-mono text-xs">{PAGES_FILE}</code>), so every device shows the same.</p>
      {reach === "update" && <p className="rounded-lg border border-amber-400/40 bg-amber-400/5 px-3 py-2 text-[13px] text-amber-100">People who aren't signed in can read these after one update of your Studio's database: Settings → Sites and hosting accounts → Update the database.</p>}
      {reach === "private" && <p className="rounded-lg border border-amber-400/40 bg-amber-400/5 px-3 py-2 text-[13px] text-amber-100">This Studio keeps its files in a private GitHub repository, so only people signed in to the Studio can read these pages. A Studio on Cloudflare (Settings → Migration) shows them to everyone.</p>}
      {!draft ? <p className="text-sm text-ink-400">Loading…</p> : (
        <Ctx.Provider value={ctx}>
          <div className="flex flex-col gap-3" data-v={v}>{fields.map((f, i) => <FieldView key={i} f={f} obj={draft} base="studio-pages" />)}</div>
        </Ctx.Provider>
      )}
      {draft && draft.pages.some((p) => p.title) && <div className="flex flex-wrap gap-2 text-[13px]">{draft.pages.filter((p) => p.title).map((p) => <a key={p.id} className="chip" href={pageHref(p)} target="_blank" rel="noopener">Open {p.title} ↗</a>)}</div>}
      <button type="button" className="btn btn-pri self-start" disabled={busy || !dirty} onClick={save}>{busy ? "Saving…" : "Save pages"}</button>
    </section>
  );
}
