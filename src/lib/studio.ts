// The Studio's records, kept as plain files in the data repository:
//
//   studio.json                         index of projects, categories and export history
//   projects/<id>/content.json          the site's content
//   projects/<id>/assets/uploads/*      images used by the site
//   projects/<id>/exports/v<N>.json     content snapshot saved with each export

import type { Repo } from "./repo";
import { jsonB64, bytesB64 } from "./repo";
import { blobToBytes, collectAssetPaths, safeFileName, uid } from "./util";
import { TEMPLATES } from "../schema";

export type ExportRec = { version: number; at: string; kind: "zip" | "github"; note: string; target?: string };
export type PublishTarget = { owner: string; repo: string; branch: string };
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
export type StudioIndex = { version: 1; categories: CategoryRec[]; projects: ProjectMeta[] };

export const CATEGORY_COLORS = ["#5B7CFF", "#3FB97A", "#F2A541", "#F06A6A", "#B57BFF", "#34C3D9", "#E86FB0", "#9AA6BC"];

const INDEX = "studio.json";
const now = () => new Date().toISOString();

export class Studio {
  constructor(readonly repo: Repo) {}
  /** Opens a project's live-site repository (set by the workspace, which holds the token). */
  siteRepo: ((t: PublishTarget) => Repo) | null = null;
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
    const t = this.lastIndex?.projects.find((x) => x.id === id)?.publish;
    return t && this.siteRepo ? this.siteRepo(t).getRaw(path).catch(() => null) : null;
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
    const copy: ProjectMeta = { ...src, id: nid, name, status: "draft", version: 0, exports: [], publish: undefined, createdAt: now(), updatedAt: now() };
    return this.updateIndex((i) => i.projects.unshift(copy), `Duplicate ${src.name}`, files);
  }

  async remove(id: string): Promise<StudioIndex> {
    const paths = await this.repo.list(`projects/${id}/`);
    return this.updateIndex((i) => (i.projects = i.projects.filter((p) => p.id !== id)), "Delete project", [], paths);
  }

  async recordExport(id: string, rec: Omit<ExportRec, "version" | "at">, content: any, status: ProjectMeta["status"], publish?: PublishTarget, siteSha?: string): Promise<{ index: StudioIndex; version: number }> {
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
  async importFromSite(id: string, site: Repo): Promise<{ index: StudioIndex; content: any; missing: string[] }> {
    const f = await site.getJSON("content.json");
    if (!f) throw new Error("The site has no content.json yet.");
    // Only the content is copied, so a pull is quick however many photos the site has.
    // Images stay on the site and load from there (see assetBlob) until the Studio has its own copy.
    const index = await this.updateIndex((i) => {
      const m = i.projects.find((x) => x.id === id);
      if (m) { m.updatedAt = m.contentAt = m.syncedAt = now(); m.siteSha = f.sha; m.summary = TEMPLATES[m.template]?.summary(f.data) ?? m.summary; }
    }, "Update from the live site (edited in its own CMS)", [{ path: `projects/${id}/content.json`, base64: jsonB64(f.data) }]);
    return { index, content: f.data, missing: [] };
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
    categories: Array.isArray(i?.categories) ? i.categories : [],
    projects: (Array.isArray(i?.projects) ? i.projects : []).map((p: any) => ({ exports: [], version: 0, notes: "", client: "", status: "draft", ...p })),
  };
}

/** JSON with sorted keys, so key order doesn't count as a change. */
function stable(v: any): string {
  if (Array.isArray(v)) return "[" + v.map(stable).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => JSON.stringify(k) + ":" + stable(v[k])).join(",") + "}";
  return JSON.stringify(v ?? null);
}
