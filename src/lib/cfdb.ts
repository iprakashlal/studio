// The Site Studio database on Cloudflare (a Worker with D1, see worker/db-worker.ts): sign-in with emailed codes,
// a Repo for a Studio's files, and the one-click setup through the Studio's helper (Cloudflare's API doesn't
// accept calls from web pages).
import { RepoError, type FileIn, type Repo } from "./repo";
import type { RepoCfg } from "./crypto";
import type { Relay } from "./relay";
import { Cloudflare, type CfAccount } from "./cloudflare";
import { CFDB_SCHEMA, CFDB_VERSION } from "./cfdbSchema";
import { STUDIO_BUILD } from "../build-info";
import { vault } from "./vault";

/** The Cloudflare account on this device (one token for hosting, the database and Workers) and the database's setup. */
export const cfAccountVault = vault<{ token: string; account?: string; resendKey?: string; mailFrom?: string; setup?: CfDbSetup }>("cfdb");

export const CFDB_WORKER = "picaffectz-db";
export const CFDB_DATABASE = "picaffectz-db";
export type CfDbCfg = { api: string };

/** A Cloudflare token page with exactly the permissions the setup needs already ticked. */
export const CF_DB_TOKEN_PAGE = `https://dash.cloudflare.com/profile/api-tokens?${new URLSearchParams({
  permissionGroupKeys: JSON.stringify([{ key: "workers_scripts", type: "edit" }, { key: "d1", type: "edit" }, { key: "account_settings", type: "read" }]),
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
/** A Studio's (or site's) files in the database, behaving like its GitHub repository (stale writes are refused). */
export class CfRepo implements Repo {
  readonly demo = false;
  readonly cfg: RepoCfg;
  constructor(private api: string, readonly scope: string) { this.cfg = { owner: "cloudflare", repo: scope.replace(/^\w+:/, ""), branch: "main" }; }
  private q(path?: string) { return `scope=${encodeURIComponent(this.scope)}${path !== undefined ? "&path=" + encodeURIComponent(path) : ""}`; }
  private fail(e: any, what: string): never {
    if (e?.status === 409) throw new RepoError("The file changed since it was loaded. Try again.", 409);
    throw new RepoError(e?.status === 403 ? `This sign-in can't ${what} here.` : `Couldn't ${what}: ${e?.message || e}`, e?.status || 500);
  }
  async check() { try { await cfCall(this.api, `/f/list?${this.q()}&prefix=studio.json`); } catch (e) { this.fail(e, "read files"); } }
  private async res(path: string): Promise<Response | null> {
    try { return await cfCall<Response>(this.api, `/f/get?${this.q(path)}`, { raw: true }); } catch (e: any) { if (e?.status === 404) return null; this.fail(e, "read " + path); }
  }
  async getText(path: string) { const r = await this.res(path); return r ? { text: await r.text(), sha: r.headers.get("x-sha") || "" } : null; }
  async getJSON<T = any>(path: string) { const f = await this.getText(path); return f ? { data: JSON.parse(f.text) as T, sha: f.sha } : null; }
  async getRaw(path: string) { const r = await this.res(path); return r ? r.blob() : null; }
  async putFile(path: string, base64: string, _m: string, sha?: string | null) {
    try { const j = await cfCall<{ sha: string }>(this.api, `/f/put?${this.q(path)}${sha ? "&sha=" + encodeURIComponent(sha) : ""}`, { method: "PUT", body: b64Bytes(base64) as BodyInit, headers: { "Content-Type": "application/octet-stream" } }); return j.sha; }
    catch (e) { this.fail(e, "save " + path); }
  }
  async pushFiles(files: FileIn[], m: string, remove: string[] = []) {
    for (const f of files) await this.putFile(f.path, f.base64, m);
    if (remove.length) try { await cfCall(this.api, `/f/delete?${this.q()}`, { method: "POST", body: JSON.stringify({ paths: remove }) }); } catch (e) { this.fail(e, "delete files"); }
  }
  async list(prefix: string) { try { return await cfCall<string[]>(this.api, `/f/list?${this.q()}&prefix=${encodeURIComponent(prefix)}`); } catch (e) { this.fail(e, "list files"); } }
  async lastChange(path: string) { try { return (await cfCall<{ updated_at: string } | null>(this.api, `/f/meta?${this.q(path)}`))?.updated_at || null; } catch { return null; } }
}

// ---------------------------------------------------------------- one-click setup
export type CfDbSetup = { account: string; api: string; databaseId: string; v: number };
const q = (s: string) => "'" + String(s).replace(/'/g, "''") + "'";
/** SQL that adds people to a scope (run through Cloudflare's D1 API during setup). */
export const membersSql = (scope: string, list: { email: string; role: "owner" | "member" | "partner" }[]) =>
  list.map((m) => `insert into members (scope, email, role) values (${q(scope)}, lower(${q(m.email.trim())}), ${q(m.role)}) on conflict (scope, email) do update set role = excluded.role;`).join("\n");

/** Finds or creates the database, its tables and the Worker, and checks the Worker answers. Safe to run again. */
export async function setupCfDb(relay: Relay, token: string, o: { account: CfAccount; resendKey: string; mailFrom: string; name: string; existing?: CfDbSetup | null }, step: (s: string) => void): Promise<CfDbSetup> {
  const cf = new Cloudflare(relay, token), acc = o.account.id;
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
    vars: { MAIL_FROM: o.mailFrom, NAME: o.name },
    secrets: { ...(o.existing ? {} : { SECRET: secret }), ...(o.resendKey ? { RESEND_API_KEY: o.resendKey } : {}) },
    d1: [{ name: "DB", id: db.uuid }], keep: !!o.existing,
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
  if (!last.mail) throw new Error("The database is up, but email isn't set: add your Resend API key and sender, then run the setup again.");
  return { account: acc, api, databaseId: db.uuid, v: CFDB_VERSION };
}
/** Adds people to a Studio or site in the database (owner/partner/member). */
export async function cfAddMembers(relay: Relay, token: string, s: CfDbSetup, scope: string, list: { email: string; role: "owner" | "member" | "partner" }[]) {
  if (list.length) await new Cloudflare(relay, token).d1Query(s.account, s.databaseId, membersSql(scope, list));
}

/** Resend's test mode (no verified domain) only emails the Resend account's own address; returns it from the error. */
export const resendTestOnly = (msg: string): string | null => /own email address \(([^)\s]+@[^)\s]+)\)/i.exec(String(msg || ""))?.[1]?.toLowerCase() || null;
