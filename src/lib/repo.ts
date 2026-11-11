// File storage on GitHub (or in memory for demo mode). No database anywhere:
// every save is a commit to a repository.

import type { RepoCfg } from "./crypto";
import { b64ToText, bytesToB64, textToB64 } from "./util";

export type FileIn = { path: string; base64: string };

export class RepoError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface Repo {
  readonly cfg: RepoCfg;
  readonly demo: boolean;
  check(): Promise<void>;
  getText(path: string): Promise<{ text: string; sha: string } | null>;
  getJSON<T = any>(path: string): Promise<{ data: T; sha: string } | null>;
  getRaw(path: string): Promise<Blob | null>;
  putFile(path: string, base64: string, message: string, sha?: string | null): Promise<string>;
  /** One commit that writes `files` and removes `remove`. */
  pushFiles(files: FileIn[], message: string, remove?: string[]): Promise<void>;
  list(prefix: string): Promise<string[]>;
  /** When the file last changed on the branch (ISO date), or null if unknown. */
  lastChange(path: string): Promise<string | null>;
}

export function explain(e: unknown): string {
  const err = e as RepoError;
  if (err && err.status === 401) return "GitHub rejected the token. It may have expired; add a new one in Settings.";
  if (err && err.status === 403) return "The token can't write to this repository. Give it Contents: Read and write.";
  if (err && err.status === 404) return "Repository, branch or file not found. Check the details and the token's repository access.";
  if (err && (err.status === 409 || err.status === 422)) return "The file changed on GitHub since it was loaded. Try again.";
  if (e instanceof TypeError) return "Couldn't reach GitHub. Check your connection.";
  return (err && err.message) || "Unknown error";
}

const encPath = (p: string) => p.split("/").map(encodeURIComponent).join("/");

export class GitHubRepo implements Repo {
  readonly demo = false;
  constructor(readonly cfg: RepoCfg, private token: string) {}

  private async api(path: string, opts: RequestInit & { raw?: boolean } = {}): Promise<any> {
    const { raw, ...init } = opts;
    const r = await fetch(`https://api.github.com/repos/${encodeURIComponent(this.cfg.owner)}/${encodeURIComponent(this.cfg.repo)}${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        Accept: raw ? "application/vnd.github.raw+json" : "application/vnd.github+json",
        Authorization: "Bearer " + this.token,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
    });
    if (!r.ok) {
      let m = r.statusText;
      try {
        m = (await r.json()).message || m;
      } catch {
        /* keep statusText */
      }
      throw new RepoError(m, r.status);
    }
    if (raw) return r.blob();
    return r.status === 204 ? null : r.json();
  }

  async check() {
    await this.api("");
  }

  async getText(path: string) {
    try {
      const j = await this.api(`/contents/${encPath(path)}?ref=${encodeURIComponent(this.cfg.branch)}`);
      if (Array.isArray(j)) return null;
      if (j.content === "" && j.size > 0) {
        const b = await this.getRaw(path);
        return b ? { text: await b.text(), sha: j.sha } : null;
      }
      return { text: b64ToText(j.content), sha: j.sha };
    } catch (e) {
      if ((e as RepoError).status === 404) return null;
      throw e;
    }
  }

  async getJSON<T>(path: string) {
    const f = await this.getText(path);
    if (!f) return null;
    return { data: JSON.parse(f.text) as T, sha: f.sha };
  }

  async getRaw(path: string) {
    try {
      return (await this.api(`/contents/${encPath(path)}?ref=${encodeURIComponent(this.cfg.branch)}`, { raw: true })) as Blob;
    } catch (e) {
      if ((e as RepoError).status === 404) return null;
      throw e;
    }
  }

  async putFile(path: string, base64: string, message: string, sha?: string | null) {
    const body: any = { message, content: base64, branch: this.cfg.branch };
    if (sha) body.sha = sha;
    const j = await this.api(`/contents/${encPath(path)}`, { method: "PUT", body: JSON.stringify(body) });
    return j.content.sha as string;
  }

  private async headSha(): Promise<string | null> {
    try {
      const ref = await this.api(`/git/ref/heads/${encodeURIComponent(this.cfg.branch)}`);
      return ref.object.sha;
    } catch (e) {
      const s = (e as RepoError).status;
      if (s === 404 || s === 409) return null; // empty repository or branch missing
      throw e;
    }
  }

  async pushFiles(files: FileIn[], message: string, remove: string[] = []) {
    let head = await this.headSha();
    if (!head) {
      // An empty repository has no commit to build on: start it with a README.
      await this.putFile("README.md", textToB64("# Site\n\nCreated with Site Studio.\n"), "Initial commit");
      head = await this.headSha();
      if (!head) throw new RepoError("Couldn't start the repository. Create it with a README and try again.", 409);
    }
    const commit = await this.api(`/git/commits/${head}`);
    const entries: any[] = [];
    const queue = [...files];
    const worker = async () => {
      while (queue.length) {
        const f = queue.shift()!;
        const b = await this.api(`/git/blobs`, { method: "POST", body: JSON.stringify({ content: f.base64, encoding: "base64" }) });
        entries.push({ path: f.path, mode: "100644", type: "blob", sha: b.sha });
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    for (const p of remove) entries.push({ path: p, mode: "100644", type: "blob", sha: null });
    if (!entries.length) return;
    const tree = await this.api(`/git/trees`, { method: "POST", body: JSON.stringify({ base_tree: commit.tree.sha, tree: entries }) });
    const next = await this.api(`/git/commits`, { method: "POST", body: JSON.stringify({ message, tree: tree.sha, parents: [head] }) });
    await this.api(`/git/refs/heads/${encodeURIComponent(this.cfg.branch)}`, { method: "PATCH", body: JSON.stringify({ sha: next.sha }) });
  }

  async lastChange(path: string) {
    try {
      const c = await this.api(`/commits?path=${encodeURIComponent(path)}&sha=${encodeURIComponent(this.cfg.branch)}&per_page=1`);
      return (Array.isArray(c) && c[0]?.commit?.committer?.date) || null;
    } catch {
      return null;
    }
  }

  async list(prefix: string) {
    const head = await this.headSha();
    if (!head) return [];
    const t = await this.api(`/git/trees/${head}?recursive=1`);
    return (t.tree as any[]).filter((e) => e.type === "blob" && e.path.startsWith(prefix)).map((e) => e.path as string);
  }
}

/** Demo mode: everything lives in memory and disappears on reload. */
export class MemoryRepo implements Repo {
  readonly demo = true;
  readonly cfg: RepoCfg = { owner: "demo", repo: "studio-data", branch: "main" };
  private files = new Map<string, { b64: string; sha: string }>();
  private n = 0;
  private sha = () => "s" + ++this.n;
  async lastChange() { return null; }
  async check() {}
  async getText(path: string) {
    const f = this.files.get(path);
    return f ? { text: b64ToText(f.b64), sha: f.sha } : null;
  }
  async getJSON<T>(path: string) {
    const f = await this.getText(path);
    return f ? { data: JSON.parse(f.text) as T, sha: f.sha } : null;
  }
  async getRaw(path: string) {
    const f = this.files.get(path);
    if (!f) return null;
    const bin = atob(f.b64);
    const u8 = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const ext = path.split(".").pop() || "";
    const type = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", svg: "image/svg+xml", gif: "image/gif" }[ext] || "application/octet-stream";
    return new Blob([u8], { type });
  }
  async putFile(path: string, base64: string, _m: string, sha?: string | null) {
    const cur = this.files.get(path);
    if (cur && sha && cur.sha !== sha) throw new RepoError("conflict", 409);
    const s = this.sha();
    this.files.set(path, { b64: base64, sha: s });
    return s;
  }
  async pushFiles(files: FileIn[], _m: string, remove: string[] = []) {
    for (const f of files) this.files.set(f.path, { b64: f.base64, sha: this.sha() });
    for (const p of remove) this.files.delete(p);
  }
  async list(prefix: string) {
    return [...this.files.keys()].filter((k) => k.startsWith(prefix));
  }
}

export const jsonB64 = (v: unknown) => textToB64(JSON.stringify(v, null, 2));
export const bytesB64 = bytesToB64;
