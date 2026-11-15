// The Site Studio database on Cloudflare (a Worker with D1, see worker/db-worker.ts): sign-in with emailed codes,
// a Repo for a Studio's files, and the one-click setup through the Studio's helper (Cloudflare's API doesn't
// accept calls from web pages).
import { RepoError, type FileIn, type Repo } from "./repo";
import type { RepoCfg } from "./crypto";
import type { Relay } from "./relay";
import { Cloudflare, type CfAccount } from "./cloudflare";
import { CFDB_SCHEMA, CFDB_VERSION, CFDB_WORKER_NAME } from "./cfdbSchema";
import { STUDIO_BUILD } from "../build-info";
import { vault } from "./vault";

/** The Cloudflare account on this device (one token for hosting, the database and Workers) and the database's setup. */
export const cfAccountVault = vault<{ token: string; account?: string; resendKey?: string; mailFrom?: string; setup?: CfDbSetup; more?: CfMoreToken[] }>("cfdb");
/** More Cloudflare tokens on this device, for sites hosted on other Cloudflare accounts (an old account, a client's). */
export type CfMoreToken = { token: string; accounts: { id: string; name: string }[] };
/** The token on this device that can manage `account`: another account's own token, else the main one. */
export function cfTokenFor(v: { token?: string; more?: CfMoreToken[] } | null | undefined, account?: string): string {
  const other = account ? (v?.more || []).find((m) => m.accounts.some((a) => a.id === account)) : null;
  return other?.token || v?.token || "";
}

export const CFDB_WORKER = CFDB_WORKER_NAME;
export const CFDB_DATABASE = "picaffectz-db";
export type CfDbCfg = { api: string };

/** A Cloudflare token page with exactly the permissions the setup needs already ticked. */
export const CF_DB_TOKEN_PAGE = `https://dash.cloudflare.com/profile/api-tokens?${new URLSearchParams({
  permissionGroupKeys: JSON.stringify([{ key: "workers_scripts", type: "edit" }, { key: "d1", type: "edit" }, { key: "account_settings", type: "read" }, { key: "workers_routes", type: "edit" }, { key: "zone", type: "edit" }, { key: "dns", type: "edit" }]),
  accountId: "*", zoneId: "all", name: "Picaffectz Studio",
})}`;

// ---------------------------------------------------------------- sign-in (one session per database, per device)
const KEY = (api: string) => `site-cfdb:${api.replace(/\/+$/, "")}`;
const clean = (api: string) => api.replace(/\/+$/, "");
type Sess = { email: string; token: string };
export const cfSession = {
  load(api: string): Sess | null { try { const s = JSON.parse(localStorage.getItem(KEY(api)) || "null"); return s?.token ? s : null; } catch { return null; } },
  save(api: string, s: Sess) { try { localStorage.setItem(KEY(api), JSON.stringify(s)); } catch { /* private mode */ } },
  clear(api: string) { try { localStorage.removeItem(KEY(api)); } catch { /* private mode */ } },
};
export class CfDbError extends Error { constructor(msg: string, public status = 0) { super(msg); } }
export async function cfCall<T = any>(api: string, path: string, init: RequestInit & { auth?: boolean; raw?: boolean } = {}): Promise<T> {
  const { auth = true, raw = false, ...rest } = init;
  const s = auth ? cfSession.load(api) : null;
  let r: Response;
  try { r = await fetch(clean(api) + path, { ...rest, cache: "no-store", headers: { ...(s ? { Authorization: "Bearer " + s.token } : {}), ...(rest.body && typeof rest.body === "string" ? { "Content-Type": "application/json" } : {}), ...(rest.headers || {}) } }); }
  catch { throw new CfDbError("Couldn't reach the Studio's database on Cloudflare. Check your connection."); }
  if (!r.ok) { const j = await r.json().catch(() => null); throw new CfDbError(j?.error || `The database answered ${r.status}.`, r.status); }
  return !raw && (r.headers.get("content-type") || "").includes("json") ? r.json() : (r as any);
}
export const cfSendCode = (api: string, email: string) => cfCall(api, "/auth/code", { method: "POST", auth: false, body: JSON.stringify({ email }) });
export async function cfVerifyCode(api: string, email: string, code: string) {
  const j = await cfCall<{ token: string; email: string }>(api, "/auth/verify", { method: "POST", auth: false, body: JSON.stringify({ email, code }) });
  cfSession.save(api, { email: j.email, token: j.token });
  return j.email;
}
/** The signed-in email (checked with the database), or null. */
export async function cfSignedIn(api: string): Promise<string | null> {
  if (!cfSession.load(api)) return null;
  try { return (await cfCall<{ email: string }>(api, "/me")).email; } catch (e: any) { if (e?.status === 401) cfSession.clear(api); return null; }
}
export async function cfRole(api: string, scope: string): Promise<string | null> {
  try { const me = await cfCall<{ scopes: { scope: string; role: string }[] }>(api, "/me"); return me.scopes.find((s) => s.scope === scope)?.role || null; } catch { return null; }
}

// ---------------------------------------------------------------- files
const b64Bytes = (b: string) => Uint8Array.from(atob(String(b).replace(/\s/g, "")), (c) => c.charCodeAt(0));
// A site whose own database is on another Cloudflare account: when this browser isn't signed in to that database, its
// files are reached through the Studio's database (/cfx/db, with that account's kept token), so every device signed in
// to the Studio reaches it. The site's data stays in its own database.
let linkCache: Promise<{ api: string; studio: string } | null> | null = null;
const dbIds = new Map<string, string>();
async function studioLink(siteApi: string): Promise<{ api: string; studio: string } | null> {
  linkCache ||= import("./studiohost").then((m) => m.loadHostConfig()).then((c) => (c?.kind === "cloudflare" ? { api: c.api, studio: c.studio } : null)).catch(() => null);
  const l = await linkCache;
  return l && clean(l.api) !== clean(siteApi) && cfSession.load(l.api) ? l : null;
}
/** A Studio's (or site's) files in the database, behaving like its GitHub repository (stale writes are refused). */
export class CfRepo implements Repo {
  readonly demo = false;
  readonly cfg: RepoCfg;
  constructor(private api: string, readonly scope: string, private opts: { account?: string } = {}) { this.cfg = { owner: "cloudflare", repo: scope.replace(/^\w+:/, ""), branch: "main" }; }
  /** Through the Studio's database, when this browser has no session for the site's own database (or it expired). */
  private async bridge(): Promise<((b: any) => Promise<any>) | null> {
    if (!this.opts.account || !this.scope.startsWith("site:") || cfSession.load(this.api)) return null;
    const l = await studioLink(this.api); if (!l) return null;
    const account = this.opts.account, site = this.scope.slice(5);
    return async (b: any) => {
      const r = await cfCall<any>(l.api, `/cfx/db?scope=${encodeURIComponent("studio:" + l.studio)}`, { method: "POST", body: JSON.stringify({ account, site, db: dbIds.get(account), ...b }) });
      if (r?.db) dbIds.set(account, r.db);
      return r;
    };
  }
  private async via<T>(direct: () => Promise<T>, viaBridge: (call: (b: any) => Promise<any>) => Promise<T>, what: string): Promise<T> {
    const br = await this.bridge();
    if (br) { try { return await viaBridge(br); } catch (e: any) { this.fail(e, what); } }
    try { return await direct(); }
    catch (e: any) {
      // The site's own session expired: try the Studio's database before asking for a sign-in.
      if (e?.status === 401 && this.opts.account) { cfSession.clear(this.api); const b2 = await this.bridge(); if (b2) { try { return await viaBridge(b2); } catch (e2: any) { this.fail(e2, what); } } }
      throw e;
    }
  }
  private q(path?: string) { return `scope=${encodeURIComponent(this.scope)}${path !== undefined ? "&path=" + encodeURIComponent(path) : ""}`; }
  private fail(e: any, what: string): never {
    if (e?.status === 409) throw new RepoError("The file changed since it was loaded. Try again.", 409);
    if (e?.status === 401) {
      const host = this.api.replace(/^https:\/\//, "").replace(/\/.*$/, "");
      const x: any = new RepoError(`This browser isn't signed in to the database that holds this ${this.scope.startsWith("site:") ? "site" : "Studio"} (${host}). Open Publish to Cloudflare for the project and sign in there with an email code.`, 401);
      x.db = this.api; throw x;
    }
    throw new RepoError(e?.status === 403 ? `This sign-in can't ${what} here.` : `Couldn't ${what}: ${e?.message || e}`, e?.status || 500);
  }
  async check() { try { await this.via(() => cfCall(this.api, `/f/list?${this.q()}&prefix=studio.json`), (c) => c({ op: "list", prefix: "studio.json" }), "read files"); } catch (e) { this.fail(e, "read files"); } }
  private async res(path: string): Promise<Response | null> {
    try {
      return await this.via(() => cfCall<Response>(this.api, `/f/get?${this.q(path)}`, { raw: true }), async (c) => {
        const r = await c({ op: "get", path }); if (!r?.file) return null;
        return new Response(b64Bytes(r.file.b64) as BodyInit, { headers: { "Content-Type": r.file.type || "application/octet-stream", "x-sha": r.file.sha || "", "x-updated": r.file.updated_at || "" } });
      }, "read " + path);
    } catch (e: any) { if (e?.status === 404) return null; this.fail(e, "read " + path); }
  }
  async getText(path: string) { const r = await this.res(path); return r ? { text: await r.text(), sha: r.headers.get("x-sha") || "" } : null; }
  async getJSON<T = any>(path: string) { const f = await this.getText(path); return f ? { data: JSON.parse(f.text) as T, sha: f.sha } : null; }
  async getRaw(path: string) { const r = await this.res(path); return r ? r.blob() : null; }
  async putFile(path: string, base64: string, _m: string, sha?: string | null) {
    const br = await this.bridge();
    if (br) { try { return (await br({ op: "put", path, b64: base64.replace(/\s/g, ""), ...(sha ? { sha } : {}) })).sha as string; } catch (e) { this.fail(e, "save " + path); } }
    try { const j = await cfCall<{ sha: string }>(this.api, `/f/put?${this.q(path)}${sha ? "&sha=" + encodeURIComponent(sha) : ""}`, { method: "PUT", body: b64Bytes(base64) as BodyInit, headers: { "Content-Type": "application/octet-stream" } }); return j.sha; }
    catch (e) { this.fail(e, "save " + path); }
  }
  async pushFiles(files: FileIn[], m: string, remove: string[] = []) {
    for (const f of files) await this.putFile(f.path, f.base64, m);
    if (remove.length) try { await this.via(() => cfCall(this.api, `/f/delete?${this.q()}`, { method: "POST", body: JSON.stringify({ paths: remove }) }), (c) => c({ op: "delete", paths: remove }), "delete files"); } catch (e) { this.fail(e, "delete files"); }
  }
  async list(prefix: string) { try { return await this.via(() => cfCall<string[]>(this.api, `/f/list?${this.q()}&prefix=${encodeURIComponent(prefix)}`), async (c) => (await c({ op: "list", prefix })).paths as string[], "list files"); } catch (e) { this.fail(e, "list files"); } }
  async lastChange(path: string) { try { return await this.via(async () => (await cfCall<{ updated_at: string } | null>(this.api, `/f/meta?${this.q(path)}`))?.updated_at || null, async (c) => (await c({ op: "meta", path })).meta?.updated_at || null, "read " + path); } catch { return null; } }
  /** Whether this site is reached through the Studio's database on this device (no sign-in to its own database). */
  async bridged() { return !!(await this.bridge()); }
}

// ---------------------------------------------------------------- one-click setup
export type CfDbSetup = { account: string; api: string; databaseId: string; v: number };
const q = (s: string) => "'" + String(s).replace(/'/g, "''") + "'";
/** SQL that adds people to a scope (run through Cloudflare's D1 API during setup). */
export const membersSql = (scope: string, list: { email: string; role: "owner" | "member" | "partner" }[]) =>
  list.map((m) => `insert into members (scope, email, role) values (${q(scope)}, lower(${q(m.email.trim())}), ${q(m.role)}) on conflict (scope, email) do update set role = excluded.role;`).join("\n");

/** Finds or creates the database, its tables and the Worker, and checks the Worker answers. Safe to run again. */
export async function setupCfDb(relay: Relay, token: string, o: { account: CfAccount; resendKey: string; mailFrom: string; name: string; existing?: CfDbSetup | null; deployToken?: string; requireMail?: boolean }, step: (s: string) => void): Promise<CfDbSetup> {
  const cf = new Cloudflare(relay, token), acc = o.account.id;
  // A database Worker set up from another device or Studio keeps its secret (sessions and codes) and settings.
  const keep = !!o.existing || !!(await cf.script(acc, CFDB_WORKER).catch(() => null));
  step("Finding the Studio's database");
  let db = (await cf.d1List(acc)).find((d) => d.name === CFDB_DATABASE);
  if (!db) { step("Creating the database (Cloudflare D1, free plan)"); db = await cf.d1Create(acc, CFDB_DATABASE); }
  step("Creating its tables"); await cf.d1Query(acc, db.uuid, CFDB_SCHEMA);
  step("Getting the database's code");
  const r = await fetch(`templates/cfdb/worker.js?v=${STUDIO_BUILD.id}`, { cache: "no-store" });
  if (!r.ok) throw new Error("Couldn't load the database Worker from the Studio.");
  step("Uploading the Worker");
  const secret = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("");
  await cf.upload(acc, CFDB_WORKER, await r.text(), {
    vars: { MAIL_FROM: o.mailFrom, NAME: o.name, ...(o.deployToken ? { CF_ACCOUNT: acc } : {}) },
    secrets: { ...(keep ? {} : { SECRET: secret }), ...(o.resendKey ? { RESEND_API_KEY: o.resendKey } : {}), ...(o.deployToken ? { CF_TOKEN: o.deployToken } : {}) },
    d1: [{ name: "DB", id: db.uuid }], keep, ai: true,
  });
  step("Turning on its workers.dev address");
  const sub = await cf.subdomain(acc, o.account.name || "studio");
  await cf.enableWorkersDev(acc, CFDB_WORKER);
  const api = `https://${CFDB_WORKER}.${sub}.workers.dev`;
  step("Checking the database answers");
  let last: any = null;
  for (let i = 0; i < 10; i++) {
    try { last = await (await fetch(api + "/", { cache: "no-store" })).json(); if (last?.service === "site-studio-db") break; } catch { /* starting */ }
    await new Promise((res) => setTimeout(res, 2000));
  }
  if (last?.service !== "site-studio-db") throw new Error("The database Worker was uploaded but doesn't answer yet. Wait a minute and try again.");
  if (!last.mail && o.requireMail !== false) throw new Error("The database is up, but email isn't set: add your Resend API key and sender, then run the setup again.");
  return { account: acc, api, databaseId: db.uuid, v: CFDB_VERSION };
}
/** Adds people to a Studio or site in the database (owner/partner/member). */
export async function cfAddMembers(relay: Relay, token: string, s: CfDbSetup, scope: string, list: { email: string; role: "owner" | "member" | "partner" }[]) {
  if (list.length) await new Cloudflare(relay, token).d1Query(s.account, s.databaseId, membersSql(scope, list));
}

/** Resend's test mode (no verified domain) only emails the Resend account's own address; returns it from the error. */
export const resendTestOnly = (msg: string): string | null => /own email address \(([^)\s]+@[^)\s]+)\)/i.exec(String(msg || ""))?.[1]?.toLowerCase() || null;

// ---------------------------------------------------------------- publishing from any device
/** Whether this database keeps a Cloudflare token for publishing (and for which account). */
export async function cfDeployInfo(api: string): Promise<{ cfx?: boolean; cfxImport?: boolean; bridge?: boolean; deploy: boolean; account?: string; gh?: boolean; ai?: boolean; reviews?: boolean; pamphlet?: boolean; accounts?: boolean; more?: number }> {
  try { const j = await (await fetch(clean(api) + "/", { cache: "no-store" })).json(); return { deploy: !!j?.deploy, account: j?.account, gh: !!j?.gh, ai: !!j?.ai, reviews: !!j?.reviews, cfx: !!j?.cfx, cfxImport: (+j?.cfx || 0) >= 2, bridge: (+j?.cfx || 0) >= 3, pamphlet: (+j?.pamphlet || 0) >= 2, accounts: (+j?.accounts || 0) >= 2, more: +j?.more || 0 }; } catch { return { deploy: false }; }
}
/** GitHub calls through the database (its kept token) as a signed-in owner of `scope`: a fetch-like Response. */
export function dbGitHub(api: string, scope: string) {
  return async (repo: string, path: string, init: RequestInit, raw: boolean): Promise<Response> => {
    const s = cfSession.load(api);
    const r = await fetch(clean(api) + "/gh?scope=" + encodeURIComponent(scope), { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json", ...(s ? { Authorization: "Bearer " + s.token } : {}) }, body: JSON.stringify({ repo, path, method: init.method || "GET", raw, ...(init.body != null ? { body: String(init.body) } : {}) }) });
    const j = await r.json().catch(() => null);
    if (!r.ok) return new Response(JSON.stringify({ message: j?.error || `The database answered ${r.status}.` }), { status: r.status === 401 ? 403 : r.status, headers: { "Content-Type": "application/json" } });
    const bytes = Uint8Array.from(atob(j.b64 || ""), (c) => c.charCodeAt(0));
    return new Response(j.status === 204 ? null : bytes, { status: j.status, headers: { "Content-Type": j.type || "application/json" } });
  };
}
/** Lets these GitHub repositories be published from Studios that sign in by email (owners of `scope`). */
export async function registerRepos(cf: Cloudflare, s: CfDbSetup, list: { repo: string; scope: string }[]) {
  for (const x of list) await cf.d1Query(s.account, s.databaseId, "insert into repos (repo, scope) values (?, ?) on conflict (repo) do update set scope = excluded.scope", [x.repo.toLowerCase(), x.scope]);
}
/** A Cloudflare client that publishes through the database (its kept token), as the signed-in owner of `scope`. */
export function dbCloudflare(api: string, scope: string): Cloudflare {
  return new Cloudflare(null, "", async (q) => {
    const s = cfSession.load(api);
    let r: Response;
    try { r = await fetch(clean(api) + "/cf?scope=" + encodeURIComponent(scope), { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json", ...(s ? { Authorization: "Bearer " + s.token } : {}) }, body: JSON.stringify({ method: q.method, path: q.path, body: q.body, body64: q.body64, contentType: q.contentType, ...(q.auth ? { jwt: q.auth } : {}) }) }); }
    catch { return { status: 502, body: JSON.stringify({ success: false, errors: [{ code: 0, message: "Couldn't reach the Studio's database on Cloudflare." }] }) }; }
    const j = await r.json().catch(() => null);
    if (!r.ok) return { status: r.status === 401 || r.status === 403 ? 400 : r.status, body: JSON.stringify({ success: false, errors: [{ code: r.status, message: j?.error || `The database answered ${r.status}.` }] }) };
    return j as { status: number; body: string };
  });
}
/** Lets these Workers be published from any device by the owners of their scope (needs the token, via D1). */
export async function registerWorkers(cf: Cloudflare, s: CfDbSetup, list: { worker: string; scope: string }[]) {
  for (const x of list) await cf.d1Query(s.account, s.databaseId, "insert into workers (worker, scope) values (?, ?) on conflict (worker) do update set scope = excluded.scope", [x.worker, x.scope]);
}

// ---------------------------------------------------------------- writing site text from a reference site
export type Brief = Partial<Record<"brand_tagline" | "hero_eyebrow" | "hero_title" | "hero_text" | "hero_cta" | "about_title" | "about_text" | "mission" | "vision" | "services_title" | "services_intro" | "banner_title" | "banner_text" | "cta_title" | "cta_text" | "seo_title" | "seo_description" | "footer_text", string>> & { values?: { title: string; text: string }[]; services?: { title: string; text: string }[]; process?: { title: string; text: string }[]; faq?: { q: string; a: string }[] };
/** Reads the reference (link or pasted text) and writes new text for `brand` with Workers AI on the database. */
export async function cfWrite(api: string, o: { url?: string; text?: string; brand: string; notes?: string; kind: string }): Promise<{ brief: Brief; flagged: string[] }> {
  const j = await cfCall<any>(api, "/ai/write", { method: "POST", body: JSON.stringify(o) });
  if (j?.error) { const e: any = new Error(j.error); e.thin = !!j.thin; throw e; }
  return j;
}

// ---------------------------------------------------------------- reading a product pamphlet
export type PamphletProduct = { name: string; category: string; summary: string; price: string; features: string[]; details: string; specs: { label: string; value: string }[]; page: number };
/** Turns a pamphlet's text (and pictures of pages without text) into catalogue entries, with Workers AI on the database. */
export async function cfProducts(api: string, o: { text?: string; images?: { page: number; data: string }[]; hint?: string }): Promise<PamphletProduct[] & { guessed?: boolean }> {
  const j = await cfCall<any>(api, "/ai/products", { method: "POST", body: JSON.stringify(o) });
  if (j?.error) throw new Error(j.error);
  return Object.assign(j.products || [], { guessed: !!j.guessed });
}

// ---------------------------------------------------------------- Google reviews
export type GooglePlace = { id: string; name: string; address: string; rating: number; count: number; url: string };
export type GoogleReview = { rating: number; text: string; author: string; authorUrl: string; when: string; time: string };
/** A Google Maps Platform key, kept encrypted on this device only. */
export const googleKeyVault = vault<{ key: string }>("google-places");
/** The place's rating and the reviews Google gives (up to 5), through the database (the key isn't kept there). */
export async function cfGoogleReviews(api: string, link: string, key: string): Promise<{ place: GooglePlace; reviews: GoogleReview[] }> {
  const j = await cfCall<any>(api, "/reviews/google", { method: "POST", body: JSON.stringify({ link, key }) });
  if (j?.error) throw new Error(j.error);
  return j;
}

// ---------------------------------------------------------------- other Cloudflare accounts, kept on the database
/** The Cloudflare accounts this Studio's database keeps tokens for (names and ids only; tokens are never read back). */
export const cfxList = (api: string, studio: string) => cfCall<{ main: string | null; accounts: { id: string; name: string }[] }>(api, `/cfx?scope=${encodeURIComponent("studio:" + studio)}`);
/** Keeps another account's token as a Worker secret on the database (checked with Cloudflare first). */
export const cfxPut = (api: string, studio: string, token: string) => cfCall<{ ok: true; accounts: { id: string; name: string }[] }>(api, `/cfx/put?scope=${encodeURIComponent("studio:" + studio)}`, { method: "POST", body: JSON.stringify({ token }) });
export const cfxDelete = (api: string, studio: string, account: string) => cfCall(api, `/cfx/delete?scope=${encodeURIComponent("studio:" + studio)}`, { method: "POST", body: JSON.stringify({ account }) });
/** Lets the Studio's owners publish a site's Worker on that account from any device. */
export const cfxSite = (api: string, studio: string, account: string, worker: string, site?: string) => cfCall(api, `/cfx/site?scope=${encodeURIComponent("studio:" + studio)}`, { method: "POST", body: JSON.stringify({ account, worker, ...(site ? { site } : {}) }) });
/** Copies a site from the Studio's database on another Cloudflare account into this one (done by the database with
 *  that account's kept token: no sign-in to the old database, works from any device). */
export async function cfxImportSite(api: string, studio: string, account: string, site: string, step: (s: string) => void): Promise<{ files: string[]; missing: string[]; editors: number; enquiries: number }> {
  const call = (b: any) => cfCall<any>(api, `/cfx/import?scope=${encodeURIComponent("studio:" + studio)}`, { method: "POST", body: JSON.stringify({ account, site, ...b }) });
  step("Reading the site in the other account's database");
  const s = await call({ step: "start" }), list: string[] = s.files || [];
  const order = [...list.filter((p) => p !== "content.json" && p !== "cms/site.json"), ...list.filter((p) => p === "cms/site.json"), ...list.filter((p) => p === "content.json")];
  const missing: string[] = []; let n = 0;
  for (const p of order) { step(`Copying the site (${++n} of ${order.length})`); const r = await call({ step: "file", db: s.db, path: p }); if (!r?.ok) missing.push(p); }
  return { files: order, missing, editors: s.editors || 0, enquiries: s.enquiries || 0 };
}
/** A site's enquiries: from its own database when signed in to it here, else through the Studio's database. */
export async function siteEnquiries(cf: { api: string; site: string }, account?: string) {
  const scope = "scope=" + encodeURIComponent("site:" + cf.site);
  const l = !cfSession.load(cf.api) && account ? await studioLink(cf.api) : null;
  const br = l ? (b: any) => cfCall<any>(l.api, `/cfx/db?scope=${encodeURIComponent("studio:" + l.studio)}`, { method: "POST", body: JSON.stringify({ account, site: cf.site, db: dbIds.get(account!), op: "enq", ...b }) }).then((r) => { if (r?.db) dbIds.set(account!, r.db); return r; }) : null;
  return {
    bridged: !!br,
    list: async (): Promise<any[]> => (br ? (await br({ sub: "list" })).rows : await cfCall<any[]>(cf.api, "/e/list?" + scope)),
    status: async (id: number, status: string) => { br ? await br({ sub: "status", id, status }) : await cfCall(cf.api, "/e/status?" + scope, { method: "POST", body: JSON.stringify({ id, status }) }); },
    remove: async (id: number) => { br ? await br({ sub: "delete", id }) : await cfCall(cf.api, "/e/delete?" + scope, { method: "POST", body: JSON.stringify({ id }) }); },
  };
}
