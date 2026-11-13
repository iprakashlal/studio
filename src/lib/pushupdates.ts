// "Push updates to live sites": rebuilds every published project with this Studio build (template code,
// themes' CSS and effects, the site CMS) and puts the new pages live. Each site keeps its own content and
// photos, including edits made in its own admin page; only the pages and code change.

import { GitHubRepo, explain, type Repo } from "./repo";
import { SupabaseRepo } from "./supa";
import { Netlify, NetlifyError } from "./netlify";
import { buildSite, loadDefaults, publishSite } from "./exporter";
import { publishToNetlify, siteAddress } from "./hosting";
import { ghPublish } from "./ghpublish";
import { adminFile } from "../schema/common";
import { TEMPLATES } from "../schema";
import { merge } from "./util";
import type { ProjectMeta, Studio } from "./studio";
import { STUDIO_BUILD } from "../build-info";
import { relayVault, RELAY_VERSION } from "./relay";
import { Cloudflare, cfVault } from "./cloudflare";

export type LiveTarget = { key: string; project: ProjectMeta; kind: "netlify" | "github" | "worker"; label: string; url: string; repo: Repo | null };
export type TargetState =
  | { s: "checking" } | { s: "current"; at: string } | { s: "old"; at: string | null; build: string | null }
  | { s: "unreachable"; msg: string } | { s: "pushing"; detail?: string } | { s: "done" } | { s: "failed"; msg: string } | { s: "skipped"; msg: string };

const ghUrl = (t: { owner: string; repo: string }) => `https://${t.owner}.github.io/${t.repo === `${t.owner}.github.io` ? "" : t.repo + "/"}`;

/** Every place a project is live: its Netlify site and/or its GitHub repository. */
export function liveTargets(projects: ProjectMeta[], token: string): LiveTarget[] {
  const out: LiveTarget[] = [];
  for (const p of projects) {
    if (!TEMPLATES[p.template]) continue;
    if (p.host?.kind === "netlify") out.push({ key: p.id + ":netlify", project: p, kind: "netlify", label: "Netlify", url: siteAddress(p.host), repo: new SupabaseRepo(p.host.sb) });
    if (p.publish) out.push({ key: p.id + ":github", project: p, kind: "github", label: "GitHub Pages", url: ghUrl(p.publish), repo: new GitHubRepo(p.publish, ghPublish.token(token)) });
    // The shop's server code, when the Studio set up its Cloudflare Worker.
    if (p.worker) out.push({ key: p.id + ":worker", project: p, kind: "worker", label: "Shop server (Cloudflare Worker)", url: p.worker.url, repo: null });
  }
  return out;
}

/** Which Studio build the live site was made with, read from its cms/site.json. */
export async function checkTarget(t: LiveTarget): Promise<TargetState> {
  if (t.kind === "worker") { const w = t.project.worker!; return w.build === STUDIO_BUILD.id ? { s: "current", at: w.deployedAt || "" } : { s: "old", at: w.deployedAt || null, build: w.build || null }; }
  try {
    const f = await t.repo!.getJSON<any>("cms/site.json");
    const b = f?.data?.studioBuild;
    if (b?.id && b.id === STUDIO_BUILD.id) return { s: "current", at: f!.data.exportedAt };
    return { s: "old", at: f?.data?.exportedAt || null, build: b?.id || null };
  } catch (e) { return { s: "unreachable", msg: explain(e) }; }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Rebuilds one live site with this Studio build, keeping the site's own content. */
export async function pushTarget(t: LiveTarget, o: { studio: Studio; nf: Netlify | null; step: (d: string) => void; token?: string }) {
  const p = t.project, tpl = TEMPLATES[p.template];
  if (t.kind === "worker") {
    // New code only: the Worker's settings and secrets stay as they are.
    const w = p.worker!;
    const relay = o.token ? await relayVault.load(o.token) : null, cf = o.token ? await cfVault.load(o.token) : null;
    if (!relay || relay.v !== RELAY_VERSION || !cf?.token) throw new Error("Open the shop project → Shop backend on this device once (it needs the Studio helper and your Cloudflare token).");
    o.step("Getting the new server code");
    const r = await fetch(`templates/store/cloudflare/worker.js?v=${STUDIO_BUILD.id}`, { cache: "no-store" });
    if (!r.ok) throw new Error("Couldn't load the Worker code from the Studio.");
    o.step("Uploading to Cloudflare");
    await new Cloudflare(relay, cf.token).upload(w.account, w.name, await r.text(), { keep: true });
    await o.studio.updateMeta(p.id, { worker: { ...w, build: STUDIO_BUILD.id, deployedAt: new Date().toISOString() } }, "Update the shop's Cloudflare Worker");
    return;
  }
  const defaults = await loadDefaults(p.template);
  const draft = merge(defaults, (await o.studio.loadContent(p.id)) || {});
  const getBlob = (path: string) => o.studio.assetBlob(p.id, path);
  const note = `Studio update ${STUDIO_BUILD.id}`;

  if (t.kind === "netlify") {
    if (!o.nf) throw new Error("Connect Netlify in Settings → Hosting accounts first.");
    const steps = ["Checking photos", "Checking content", "Uploading pages", "Done"];
    for (let attempt = 0; ; attempt++) {
      try {
        await publishToNetlify({ nf: o.nf, host: p.host!, tpl, draft, name: p.name, version: p.version, withContent: false, getBlob, note, step: (i, d) => o.step(`${steps[i] || ""}${d ? " · " + d : ""}`) });
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
  o.step("Building pages");
  const { files, admin } = await buildSite({ template: tpl, content: draft, name: p.name, version: p.version, includeContent: false, getAsset: getBlob, admin: adminFile(live.data), headContent: live.data, base: t.url });
  o.step(`Uploading ${files.length} files`);
  await publishSite(repo, files, note, admin);
}
