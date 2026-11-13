// The Studio's records, kept as plain files in the data repository:
//
//   studio.json                         index of projects, categories and export history
//   projects/<id>/content.json          the site's content
//   projects/<id>/assets/uploads/*      images used by the site
//   projects/<id>/exports/v<N>.json     content snapshot saved with each export

import { cleanBadge, type BadgeCfg } from "./badge";
import { cleanMenu, cleanMenus, type MenuCfg } from "./menus";
import type { Repo } from "./repo";
import { jsonB64, bytesB64 } from "./repo";
import { blobToBytes, collectAssetPaths, safeFileName, uid } from "./util";
import { TEMPLATES } from "../schema";
import type { HostCfg } from "./supa";

export type ExportRec = { version: number; at: string; kind: "zip" | "github" | "netlify"; note: string; target?: string };
export type PublishTarget = { owner: string; repo: string; branch: string };
export type WorkerCfg = { account: string; name: string; url: string; dataRepo: string; mailFrom: string; build?: string; deployedAt?: string };
export type ProjectMeta = {
  id: string;
  name: string;
  template: string;
  category: string;
  client: string;
  notes: string;
  status: "draft" | "exported" | "published";
  createdAt: string;
  updatedAt: string;
  version: number;
  summary?: string;
  exports: ExportRec[];
  publish?: PublishTarget;
  /** Hosted outside GitHub (Netlify + Supabase). When set, this is the live site the Studio keeps in step with. */
  host?: HostCfg;
  /** The shop's Cloudflare Worker, when the Studio set it up (no secrets here: they live on the Worker). */
  worker?: WorkerCfg;
  /** Business sites: the enquiry inbox function and its private repository (no secrets: the token lives in the function). */
  inbox?: import("./inbox").InboxCfg;
  /** When the Studio's copy of the content last changed (saves and imports). */
  contentAt?: string;
  /** content.json's blob sha on the live site when the two were last in step, and when that was. */
  siteSha?: string;
  syncedAt?: string;
};
/** How a project's live site compares with the Studio's copy. */
export type SiteState =
  | { kind: "none" | "same" }
  | { kind: "pull" | "conflict"; siteAt: string | null };
export type CategoryRec = { id: string; name: string; color: string };
/** The Studio's own name and logo (logo: a file in the data repository). */
export type StudioBrand = { name: string; logo?: string; v?: number };
export type StudioIndex = { version: 1; categories: CategoryRec[]; projects: ProjectMeta[]; brand?: StudioBrand; /** The "Powered by" badge every site shows (its look; each site only turns it on or off). */ badge?: import("./badge").BadgeCfg; /** Admin menus per template: renamed, reordered, combined sections. */ menus?: import("./menus").Menus; /** Where this Studio was moved (Netlify + Supabase). */ hosted?: import("./studiohost").HostedStudio; /** Client Studios (Studio Partners). */ partners?: import("./partners").PartnerRec[] };

export const CATEGORY_COLORS = ["#5B7CFF", "#3FB97A", "#F2A541", "#F06A6A", "#B57BFF", "#34C3D9", "#E86FB0", "#9AA6BC"];

const INDEX = "studio.json";
const now = () => new Date().toISOString();

export class Studio {
  constructor(readonly repo: Repo) {}
  /** Opens a project's live site (set by the workspace, which holds the token): GitHub, or Supabase when hosted outside it. */
  siteRepo: ((p: ProjectMeta) => Repo | null) | null = null;
  private lastIndex: StudioIndex | null = null;

  async loadIndex(): Promise<StudioIndex> {
    const f = await this.repo.getJSON<StudioIndex>(INDEX);
    if (f) return (this.lastIndex = normalise(f.data));
    const fresh: StudioIndex = {
      version: 1,
      categories: [
        { id: "personal", name: "Personal", color: CATEGORY_COLORS[0] },
        { id: "clients", name: "Clients", color: CATEGORY_COLORS[1] },
        { id: "shops", name: "Shops", color: CATEGORY_COLORS[2] },
      ],
      projects: [],
    };
    await this.repo.pushFiles([{ path: INDEX, base64: jsonB64(fresh) }], "Set up Site Studio");
    return (this.lastIndex = fresh);
  }

  /** Re-reads the index right before writing so edits from another device aren't lost. */
  async updateIndex(fn: (i: StudioIndex) => void, message: string, files: { path: string; base64: string }[] = [], remove: string[] = []): Promise<StudioIndex> {
    const idx = await this.loadIndex();
    fn(idx);
    await this.repo.pushFiles([{ path: INDEX, base64: jsonB64(idx) }, ...files], message, remove);
    return (this.lastIndex = idx);
  }

  async createProject(p: { name: string; template: string; category: string; client: string; content: any; summary?: string }): Promise<{ index: StudioIndex; id: string }> {
    const id = uid();
    const meta: ProjectMeta = {
      id, name: p.name, template: p.template, category: p.category, client: p.client, notes: "",
      status: "draft", createdAt: now(), updatedAt: now(), contentAt: now(), version: 0, summary: p.summary, exports: [],
    };
    const index = await this.updateIndex((i) => i.projects.unshift(meta), `Create project ${p.name}`, [{ path: `projects/${id}/content.json`, base64: jsonB64(p.content) }]);
    return { index, id };
  }

  async loadContent(id: string): Promise<any | null> {
    const f = await this.repo.getJSON(`projects/${id}/content.json`);
    return f ? f.data : null;
  }

  async saveContent(id: string, content: any, summary: string): Promise<StudioIndex> {
    return this.updateIndex(
      (i) => {
        const m = i.projects.find((x) => x.id === id);
        if (m) {
          m.updatedAt = m.contentAt = now();
          m.summary = summary;
        }
      },
      "Update project content",
      [{ path: `projects/${id}/content.json`, base64: jsonB64(content) }],
    );
  }

  async updateMeta(id: string, patch: Partial<ProjectMeta>, message = "Update project details"): Promise<StudioIndex> {
    return this.updateIndex((i) => {
      const m = i.projects.find((x) => x.id === id);
      if (m) Object.assign(m, patch, { updatedAt: now() });
    }, message);
  }

  async uploadAsset(id: string, file: File): Promise<{ path: string }> {
    const path = `assets/uploads/${Date.now()}-${safeFileName(file.name)}`;
    await this.repo.putFile(`projects/${id}/${path}`, bytesB64(await blobToBytes(file)), `Upload ${file.name}`);
    return { path };
  }

  /** An image of a project: the Studio's copy, or else the live site's (images uploaded in the site's own CMS stay there). */
  async assetBlob(id: string, path: string): Promise<Blob | null> {
    const b = await this.repo.getRaw(`projects/${id}/${path}`);
    if (b) return b;
    const p = this.lastIndex?.projects.find((x) => x.id === id);
    const site = p && this.siteRepo ? this.siteRepo(p) : null;
    return site ? site.getRaw(path).catch(() => null) : null;
  }

  async duplicate(id: string, name: string): Promise<StudioIndex> {
    const idx = await this.loadIndex();
    const src = idx.projects.find((p) => p.id === id);
    if (!src) throw new Error("Project not found");
    const content = await this.loadContent(id);
    const nid = uid();
    const files = [{ path: `projects/${nid}/content.json`, base64: jsonB64(content) }];
    for (const p of collectAssetPaths(content)) {
      const b = await this.assetBlob(id, p);
      if (b) files.push({ path: `projects/${nid}/${p}`, base64: bytesB64(await blobToBytes(b)) });
    }
    const copy: ProjectMeta = { ...src, id: nid, name, status: "draft", version: 0, exports: [], publish: undefined, host: undefined, createdAt: now(), updatedAt: now() };
    return this.updateIndex((i) => i.projects.unshift(copy), `Duplicate ${src.name}`, files);
  }

  async remove(id: string): Promise<StudioIndex> {
    const paths = await this.repo.list(`projects/${id}/`);
    return this.updateIndex((i) => (i.projects = i.projects.filter((p) => p.id !== id)), "Delete project", [], paths);
  }

  async recordExport(id: string, rec: Omit<ExportRec, "version" | "at">, content: any, status: ProjectMeta["status"], publish?: PublishTarget, siteSha?: string, host?: HostCfg): Promise<{ index: StudioIndex; version: number }> {
    let version = 0;
    const idx0 = await this.loadIndex();
    const m0 = idx0.projects.find((x) => x.id === id);
    version = (m0?.version || 0) + 1;
    const index = await this.updateIndex(
      (i) => {
        const m = i.projects.find((x) => x.id === id);
        if (!m) return;
        m.version = version;
        m.exports.unshift({ ...rec, version, at: now() });
        m.exports = m.exports.slice(0, 50);
        if (status === "published" || m.status !== "published") m.status = status;
        if (publish) m.publish = publish;
        if (host) m.host = host;
        m.updatedAt = now();
        // Published with content: the site and the Studio now hold the same content.
        if (siteSha) { m.siteSha = siteSha; m.syncedAt = m.updatedAt; }
      },
      `Export v${version}`,
      [{ path: `projects/${id}/exports/v${version}.json`, base64: jsonB64(content) }],
    );
    return { index, version };
  }

  async loadSnapshot(id: string, version: number): Promise<any | null> {
    const f = await this.repo.getJSON(`projects/${id}/exports/v${version}.json`);
    return f ? f.data : null;
  }

  /** Copy content edited in a published site's own CMS back into the Studio project. */
  /** `track`: remember this site as the one the project is in step with (false for a secondary copy, e.g. GitHub beside Netlify). */
  async importFromSite(id: string, site: Repo, track = true): Promise<{ index: StudioIndex; content: any; missing: string[] }> {
    const f = await site.getJSON("content.json");
    if (!f) throw new Error("The site has no content.json yet.");
    // Only the content is copied, so a pull is quick however many photos the site has.
    // Images stay on the site and load from there (see assetBlob) until the Studio has its own copy.
    const index = await this.updateIndex((i) => {
      const m = i.projects.find((x) => x.id === id);
      if (m && !track) { m.updatedAt = m.contentAt = now(); m.summary = TEMPLATES[m.template]?.summary(f.data) ?? m.summary; }
      else if (m) { m.updatedAt = m.contentAt = m.syncedAt = now(); m.siteSha = f.sha; m.summary = TEMPLATES[m.template]?.summary(f.data) ?? m.summary; }
    }, "Update from the live site (edited in its own CMS)", [{ path: `projects/${id}/content.json`, base64: jsonB64(f.data) }]);
    return { index, content: f.data, missing: [] };
  }

  /** Copies photos the Studio doesn't have from a site (used when pulling from a secondary copy). Returns how many were missing everywhere. */
  async copyMissingAssets(id: string, content: any, from: Repo): Promise<number> {
    const have = new Set(await this.repo.list(`projects/${id}/assets/`).catch(() => [] as string[]));
    const files: { path: string; base64: string }[] = [];
    let missing = 0;
    for (const p of collectAssetPaths(content)) {
      if (have.has(`projects/${id}/${p}`)) continue;
      const b = await from.getRaw(p).catch(() => null);
      if (b) files.push({ path: `projects/${id}/${p}`, base64: bytesB64(await blobToBytes(b)) });
      else missing++;
    }
    if (files.length) await this.repo.pushFiles(files, `Copy ${files.length} photo(s) from the live site`);
    return missing;
  }

  /** Saves the Studio's name and logo (a PNG data URL, "" to remove it) for every device. */
  async saveBrand(name: string, logo: string | null): Promise<StudioIndex> {
    const files: { path: string; base64: string }[] = [];
    if (logo) files.push({ path: "studio-assets/logo.png", base64: logo.split(",")[1] });
    return this.updateIndex((i) => {
      i.brand = { name: name.trim(), v: Date.now(), ...(logo ? { logo: "studio-assets/logo.png" } : logo === "" ? {} : i.brand?.logo ? { logo: i.brand.logo } : {}) };
    }, "Update the Studio's name and logo", files);
  }

  async saveMenu(template: string, m: MenuCfg | null): Promise<StudioIndex> {
    return this.updateIndex((i) => {
      const all = cleanMenus(i.menus); const c = m && cleanMenu(m);
      if (c && c.items.length) all[template] = c; else delete all[template];
      if (Object.keys(all).length) i.menus = all; else delete i.menus;
    }, "Update the admin menu");
  }

  async saveBadge(b: BadgeCfg): Promise<StudioIndex> {
    return this.updateIndex((i) => { i.badge = cleanBadge(b); }, "Update the “Powered by” badge");
  }

  /** Remember that the live site's current content is accounted for (e.g. "keep the Studio's version"). */
  async markSynced(id: string, sha: string): Promise<StudioIndex> {
    return this.updateIndex((i) => {
      const m = i.projects.find((x) => x.id === id);
      if (m) { m.siteSha = sha; m.syncedAt = now(); }
    }, "Mark the live site as reviewed");
  }

  /**
   * Compares a project with its live site. "pull": the site's CMS changed the content and the Studio
   * hasn't, so it's safe to copy over. "conflict": both changed since they were last in step.
   */
  async siteState(p: ProjectMeta, site: Repo): Promise<SiteState> {
    const f = await site.getText("content.json");
    if (!f) return { kind: "none" };
    if (p.siteSha && p.siteSha === f.sha) return { kind: "same" };
    const local = await this.loadContent(p.id);
    let live: any = null;
    try { live = JSON.parse(f.text); } catch { return { kind: "none" }; }
    if (local && stable(local) === stable(live)) {
      if (p.siteSha !== f.sha) await this.markSynced(p.id, f.sha).catch(() => {});
      return { kind: "same" };
    }
    const siteAt = await site.lastChange("content.json");
    const edited = p.contentAt || p.updatedAt;
    // Without a record of the last sync (projects published before this existed), compare dates instead.
    const studioChanged = p.syncedAt ? edited > p.syncedAt : !siteAt || edited > siteAt;
    return { kind: studioChanged ? "conflict" : "pull", siteAt };
  }
}

function normalise(i: any): StudioIndex {
  return {
    version: 1,
    ...(i?.brand && typeof i.brand.name === "string" ? { brand: { name: i.brand.name, ...(typeof i.brand.logo === "string" ? { logo: i.brand.logo } : {}), ...(typeof i.brand.v === "number" ? { v: i.brand.v } : {}) } } : {}),
    ...(i?.badge && typeof i.badge === "object" ? { badge: cleanBadge(i.badge) } : {}),
    ...(i?.menus && Object.keys(cleanMenus(i.menus)).length ? { menus: cleanMenus(i.menus) } : {}),
    ...(i?.hosted && typeof i.hosted.url === "string" ? { hosted: i.hosted } : {}),
    ...(Array.isArray(i?.partners) ? { partners: i.partners.filter((x: any) => x && typeof x.id === "string") } : {}),
    categories: Array.isArray(i?.categories) ? i.categories : [],
    projects: (Array.isArray(i?.projects) ? i.projects : []).map((p: any) => ({ exports: [], version: 0, notes: "", client: "", status: "draft", ...p })),
  };
}

/** JSON with sorted keys, so key order doesn't count as a change. */
export const sameContent = (a: any, b: any) => stable(a) === stable(b);

/** Top-level sections whose content differs (hero, about, theme…). */
export function changedSections(a: any, b: any): string[] {
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  return [...keys].filter((k) => stable(a?.[k]) !== stable(b?.[k])).sort();
}

function stable(v: any): string {
  if (Array.isArray(v)) return "[" + v.map(stable).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => JSON.stringify(k) + ":" + stable(v[k])).join(",") + "}";
  return JSON.stringify(v ?? null);
}
