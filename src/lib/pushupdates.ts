// "Push updates to live sites": rebuilds every published project with this Studio build (template code,
// themes' CSS and effects, the site CMS) and puts the new pages live. Each site keeps its own content and
// photos, including edits made in its own admin page; only the pages and code change.

import { GitHubRepo, explain, type Repo } from "./repo";
import { NetlifyError } from "./netlify";
import { PAGES_LABEL, type Pages } from "./pages";
import { buildSite, loadMergeBase, publishSite } from "./exporter";
import { hostRepo, publishHosted, siteAddress } from "./hosting";
import { ghPublish } from "./ghpublish";
import { adminFile } from "../schema/common";
import { TEMPLATES } from "../schema";
import { merge } from "./util";
import { applyDefaults, pdReady, pdVersion } from "./projdefaults";
import { jsonB64 } from "./repo";
import type { ProjectMeta, Studio } from "./studio";
import { STUDIO_BUILD } from "../build-info";
import { badgeVersion } from "./badge";
import { currentMenus, menuVersion } from "./menus";

export type LiveTarget = { key: string; project: ProjectMeta; kind: "hosted" | "github" | "worker"; label: string; url: string; repo: Repo | null };
export type TargetState =
  | { s: "checking" } | { s: "current"; at: string } | { s: "old"; at: string | null; build: string | null }
  | { s: "unreachable"; msg: string } | { s: "pushing"; detail?: string; /** 0–100 */ pct?: number } | { s: "done" } | { s: "failed"; msg: string } | { s: "skipped"; msg: string };

const ghUrl = (t: { owner: string; repo: string }) => `https://${t.owner}.github.io/${t.repo === `${t.owner}.github.io` ? "" : t.repo + "/"}`;

/** Every place a project is live: its Netlify or Cloudflare site and/or its GitHub repository. */
export function liveTargets(projects: ProjectMeta[], token: string): LiveTarget[] {
  const out: LiveTarget[] = [];
  for (const p of projects) {
    if (!TEMPLATES[p.template]) continue;
    if (p.host) out.push({ key: p.id + ":hosted", project: p, kind: "hosted", label: PAGES_LABEL[p.host.kind] || "Netlify", url: siteAddress(p.host), repo: hostRepo(p.host) });
    if (p.publish) out.push({ key: p.id + ":github", project: p, kind: "github", label: "GitHub Pages", url: ghUrl(p.publish), repo: new GitHubRepo(p.publish, ghPublish.token(token)) });
    // The shop's server code, when the Studio set up its Cloudflare Worker.
  }
  return out;
}

/** Which Studio build the live site was made with, read from its cms/site.json. */
export async function checkTarget(t: LiveTarget): Promise<TargetState> {
  await pdReady();
  try {
    const f = await t.repo!.getJSON<any>("cms/site.json");
    const b = f?.data?.studioBuild;
    if (b?.id && b.id === STUDIO_BUILD.id && f!.data.badge === badgeVersion() && (f!.data.menuV || menuVersion(undefined)) === menuVersion(currentMenus()[t.project.template]) && (f!.data.pdV || "") === pdVersion(t.project.template)) return { s: "current", at: f!.data.exportedAt };
    return { s: "old", at: f?.data?.exportedAt || null, build: b?.id || null };
  } catch (e) { return { s: "unreachable", msg: explain(e) }; }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Rebuilds one live site with this Studio build, keeping the site's own content. */
export async function pushTarget(t: LiveTarget, o: { studio: Studio; pages: (h: NonNullable<ProjectMeta["host"]>) => Promise<Pages | null>; step: (d: string) => void; token?: string }) {
  const p = t.project, tpl = TEMPLATES[p.template];
  const defaults = await loadMergeBase(p.template);
  const draft = merge(defaults, (await o.studio.loadContent(p.id)) || {});
  const getBlob = (path: string) => o.studio.assetBlob(p.id, path);
  const note = `Studio update ${STUDIO_BUILD.id}`;

  if (t.kind === "hosted") {
    const pages = await o.pages(p.host!);
    if (!pages) throw new Error(`Connect ${t.label} in Settings → Hostings → Hosting accounts first.`);
    const steps = ["Checking photos", "Checking content", "Uploading pages", "Done"];
    for (let attempt = 0; ; attempt++) {
      try {
        await publishHosted({ pages, host: p.host!, tpl, draft, name: p.name, version: p.version, withContent: false, getBlob, note, step: (i, d) => o.step(`${steps[i] || ""}${d ? " · " + d : ""}`) });
        return;
      } catch (e) {
        // Netlify allows 3 deploys a minute: wait and try again.
        if (e instanceof NetlifyError && e.status === 429 && attempt < 3) { o.step("Netlify's deploy limit: waiting a minute…"); await wait(62000); continue; }
        throw e;
      }
    }
  }

  const repo = t.repo!;
  o.step("Reading the live content");
  await repo.check();
  const live = await repo.getJSON<any>("content.json").catch(() => null);
  if (!live) throw new Error("The repository has no content.json. Publish it once from the project first.");
  // Settings → Project defaults reach the live content too (not the sections the site's admin switched off).
  await pdReady();
  applyDefaults(draft, p.template);
  if (live.data && typeof live.data === "object" && applyDefaults(live.data, p.template)) { o.step("Writing the Studio's defaults"); await repo.putFile("content.json", jsonB64(live.data), "Studio defaults", live.sha); }
  o.step("Building pages");
  // A site whose admin page signs in by email keeps doing so.
  const was = await repo.getJSON<any>("cms/site.json").catch(() => null);
  const { files, admin } = await buildSite({ signin: was?.data?.signin && typeof was.data.signin.api === "string" ? was.data.signin : undefined, template: tpl, content: draft, name: p.name, version: p.version, includeContent: false, getAsset: getBlob, admin: adminFile(live.data), headContent: live.data, base: t.url });
  o.step(`Uploading ${files.length} files`);
  await publishSite(repo, files, note, admin);
}
