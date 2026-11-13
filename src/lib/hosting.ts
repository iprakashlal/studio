// Hosting outside GitHub, from the Studio's side: the Netlify token kept on this device, which repository a
// project's live site is, and publishing a project to Netlify with its content and photos in Supabase.

import { GitHubRepo, type Repo } from "./repo";
import { bytesB64, jsonB64 } from "./repo";
import type { ProjectMeta } from "./studio";
import type { TemplateDef } from "../schema/types";
import { buildSite } from "./exporter";
import { Netlify } from "./netlify";
import { SupabaseRepo, type CfSiteCfg, type HostCfg, type SbCfg } from "./supa";
import { CfRepo } from "./cfdb";
import { blobToBytes, collectAssetPaths } from "./util";
import { adminFile } from "../schema/common";
import { ghPublish } from "./ghpublish";

/** The live site of a project: its Supabase data when hosted outside GitHub, else its GitHub repository. */
export function siteRepoFor(p: ProjectMeta, token: string): Repo | null {
  if (p.host?.kind === "netlify") return hostRepo(p.host);
  if (p.publish) return new GitHubRepo(p.publish, ghPublish.token(token));
  return null;
}

/** A hosted site's own data: its rows in Supabase, or its files in the Studio's Cloudflare database. */
export const hostRepo = (h: HostCfg): Repo => (h.cf ? new CfRepo(h.cf.api, "site:" + h.cf.site) : new SupabaseRepo(h.sb!));
/** What the pages are told about where their content lives. */
export const hostDb = (h: HostCfg): SbCfg | CfSiteCfg => (h.cf ? h.cf : h.sb!);
export const siteAddress = (h: HostCfg) => (h.domain ? `https://www.${h.domain}/` : h.url.replace(/\/?$/, "/"));

// The Netlify personal access token, encrypted on this device with a key made from the GitHub login's token,
// so it only opens while the Studio is signed in. It is never written to the data repository.
const KEY = "site-studio:netlify";
const enc = new TextEncoder();
const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
const unhex = (h: string) => new Uint8Array((h.match(/../g) || []).map((x) => parseInt(x, 16)));
async function keyFor(secret: string, salt: Uint8Array) {
  const base = await crypto.subtle.importKey("raw", enc.encode(secret), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 120000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
export const netlifyToken = {
  async save(token: string, ghToken: string, who: string) {
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const data = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await keyFor(ghToken, salt), enc.encode(token)));
    localStorage.setItem(KEY, JSON.stringify({ v: 1, who, salt: hex(salt), iv: hex(iv), data: hex(data) }));
  },
  async load(ghToken: string): Promise<{ token: string; who: string } | null> {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || "null");
      if (!s) return null;
      const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unhex(s.iv) }, await keyFor(ghToken, unhex(s.salt)), unhex(s.data));
      return { token: new TextDecoder().decode(pt), who: s.who || "" };
    } catch { return null; }
  },
  saved: () => { try { return !!localStorage.getItem(KEY); } catch { return false; } },
  clear: () => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } },
};

export type HostStep = { label: string; done?: boolean; detail?: string };

/**
 * Publishes a project to Netlify. With `withContent`, the content and any photos Supabase doesn't have yet are
 * uploaded first (so the pages never point at missing photos); otherwise the content edited in the site's own
 * CMS stays. Returns the content's new sha for the Studio's sync records.
 */
export async function publishToNetlify(o: {
  nf: Netlify; host: HostCfg; tpl: TemplateDef; draft: any; name: string; version: number; withContent: boolean;
  getBlob: (p: string) => Promise<Blob | null>; note: string; step: (i: number, detail?: string) => void;
}): Promise<{ warnings: string[]; siteSha?: string; admin: string; url: string }> {
  const { nf, host, tpl, draft } = o;
  const db = hostRepo(host);
  await db.check();
  const warnings: string[] = [];
  const live = (await db.getJSON("content.json").catch(() => null))?.data || null;
  let content = o.withContent || !live ? draft : live;

  // 1. Photos
  o.step(0);
  if (content === draft) {
    const have = new Set(await db.list("assets/").catch(() => [] as string[]));
    const need = [...collectAssetPaths(draft)].filter((p) => p.startsWith("assets/") && !have.has(p));
    let n = 0;
    for (const p of need) {
      const b = await o.getBlob(p);
      if (!b) { warnings.push(`Image not found: ${p}`); continue; }
      await db.putFile(p, bytesB64(await blobToBytes(b)), "Upload photo");
      o.step(0, `${++n} of ${need.length}`);
    }
  }
  // 2. Content
  o.step(1);
  if (content === draft) await db.putFile("content.json", jsonB64(draft), "Publish from Site Studio");
  content = (await db.getJSON("content.json"))?.data || content;
  const siteSha = (await db.getText("content.json"))?.sha;

  // 3. Pages
  o.step(2);
  const base = siteAddress(host);
  const { files, warnings: w, admin } = await buildSite({ template: tpl, content: draft, name: o.name, version: o.version, includeContent: false, getAsset: o.getBlob, admin: adminFile(content), headContent: content, base, host: hostDb(host) });
  warnings.push(...w);
  // A copy of the content goes with the pages, used only if Supabase can't be reached.
  files.push({ path: "content.json", data: enc.encode(JSON.stringify(content, null, 2)) });
  const info = files.find((f) => f.path === "cms/site.json");
  if (info) await db.putFile("cms/site.json", bytesB64(info.data), "Site info").catch(() => {});
  const dep = await nf.deploy(host.siteId, files, `v${o.version} from Site Studio${o.note ? ": " + o.note : ""}`, (d, t) => o.step(2, t ? `${d} of ${t} files` : ""));
  o.step(3);
  return { warnings, siteSha, admin, url: dep.url || base };
}
