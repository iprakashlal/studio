// The Studio's own reading pages (privacy policy, terms…): Settings → Additional pages. Kept in the Studio's files
// as public/pages.json. Visitors who aren't signed in read them through the Studio's database: GET <api>/sp/<studio>
// on Cloudflare, or the "public pages" rule on Supabase. A Studio on GitHub only shows them once signed in.
import { useEffect, useState } from "react";
import type { Repo } from "./repo";
import type { StudioHostCfg } from "./studiohost";
import { basePath, textToB64 } from "./util";
import { pageSlug } from "../schema/common";

export const PAGES_FILE = "public/pages.json";
export type StudioPage = { id: string; title: string; slug?: string; subtitle?: string; updated?: string; body?: string; show?: boolean; inGate?: boolean; inFooter?: boolean; navLabel?: string; showTitle?: boolean; align?: string; size?: string; width?: string; toc?: boolean; crumbs?: boolean; noindex?: boolean };

export const studioPageDefault = (title = "New page"): StudioPage => ({ id: "sp-" + Math.random().toString(36).slice(2, 8), title, slug: "", subtitle: "", updated: "", body: "", show: true, inGate: true, inFooter: true, navLabel: "", showTitle: true, align: "left", size: "large", width: "narrow", toc: false, crumbs: true, noindex: false });
export const slugOf = (p: StudioPage) => pageSlug(p.slug || p.title) || p.id;
/** Pages visitors can open. */
export const shownPages = (all: StudioPage[]) => all.filter((p) => p && p.show !== false && String(p.title || "").trim());
export const pageHref = (p: StudioPage) => "#/pages/" + encodeURIComponent(slugOf(p));

const clean = (x: any): StudioPage[] => (Array.isArray(x?.pages) ? x.pages : Array.isArray(x) ? x : []).filter((p: any) => p && typeof p === "object" && typeof p.title === "string").slice(0, 30);
const KEY = () => "studio-pages:" + basePath();
export function cachedPages(): StudioPage[] { try { return clean(JSON.parse(localStorage.getItem(KEY()) || "null")); } catch { return []; } }
function cache(p: StudioPage[]) { try { localStorage.setItem(KEY(), JSON.stringify({ pages: shownPages(p) })); } catch { /* private mode */ } }

/** Read without signing in, from the Studio's database. null: not reachable that way. */
export async function publicPages(host: StudioHostCfg | null | undefined): Promise<StudioPage[] | null> {
  if (!host) return null;
  try {
    if (host.kind === "cloudflare") {
      const r = await fetch(host.api.replace(/\/+$/, "") + "/sp/" + encodeURIComponent(host.studio), { cache: "no-store" });
      if (r.status === 404) return []; if (!r.ok) return null;
      return clean(await r.json());
    }
    const r = await fetch(`${host.url.replace(/\/+$/, "")}/rest/v1/studio_files?select=body&studio=eq.${encodeURIComponent(host.studio)}&path=eq.${encodeURIComponent(PAGES_FILE)}`, { cache: "no-store", headers: { apikey: host.key, ...(/^sb_/.test(host.key) ? {} : { Authorization: "Bearer " + host.key }) } });
    if (!r.ok) return null;
    const j = await r.json(); return j?.[0]?.body ? clean(JSON.parse(j[0].body)) : [];
  } catch { return null; }
}
/** Read with the signed-in Studio's files (all pages, hidden ones too). */
export async function repoPages(repo: Repo): Promise<{ pages: StudioPage[]; sha: string | null }> {
  const f = await repo.getText(PAGES_FILE);
  if (!f) return { pages: [], sha: null };
  try { return { pages: clean(JSON.parse(f.text)), sha: f.sha }; } catch { return { pages: [], sha: f.sha }; }
}
export async function savePages(repo: Repo, pages: StudioPage[], sha: string | null): Promise<string> {
  const out = await repo.putFile(PAGES_FILE, textToB64(JSON.stringify({ pages }, null, 2)), "Update the Studio's pages", sha);
  cache(pages); emit(); return out;
}
const EV = "studio:pages";
const emit = () => dispatchEvent(new Event(EV));

/** The pages to show and link: the signed-in Studio's files when there are any, else the public copy (kept on this device too). */
export function useStudioPages(host: StudioHostCfg | null | undefined, repo?: Repo | null, all = false): { pages: StudioPage[]; ready: boolean } {
  const [st, setSt] = useState<{ pages: StudioPage[]; ready: boolean }>(() => ({ pages: cachedPages(), ready: false }));
  const [n, setN] = useState(0);
  useEffect(() => { const on = () => setN((x) => x + 1); addEventListener(EV, on); return () => removeEventListener(EV, on); }, []);
  useEffect(() => {
    let on = true;
    (async () => {
      let got: StudioPage[] | null = null;
      if (repo && !repo.demo) got = await repoPages(repo).then((r) => r.pages).catch(() => null);
      if (got === null) got = await publicPages(host);
      if (!on) return;
      if (got === null) return setSt((s) => ({ ...s, ready: true }));
      cache(got);
      setSt({ pages: all ? got : shownPages(got), ready: true });
    })();
    return () => { on = false; };
  }, [host, repo, n]);
  return st;
}
