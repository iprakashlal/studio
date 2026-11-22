// The Site Studio database on Cloudflare (a Worker with D1, see worker/db-worker.ts): sign-in with emailed codes,
// a Repo for a Studio's files, and the one-click setup through the Studio's helper (Cloudflare's API doesn't
// accept calls from web pages).
import { RepoError, type FileIn, type Repo } from "./repo";
import type { RepoCfg } from "./crypto";
import type { Relay } from "./relay";
import { Cloudflare, cfDbToken, isCfDbToken, type CfAccount } from "./cloudflare";
import { loadHostConfig } from "./studiohost";
import { CFDB_SCHEMA, CFDB_VERSION, CFDB_WORKER_NAME } from "./cfdbSchema";
import { STUDIO_BUILD } from "../build-info";
import { vault } from "./vault";
import { cfOauthFreshen, type CfOauthKeep } from "./cfoauth";

/** The Cloudflare account on this device (one token for hosting, the database and Workers) and the database's setup. */
type CfKept = { token: string; /** Set when the token is a Cloudflare sign-in this device renews (see cfoauth.ts). */ oauth?: CfOauthKeep; account?: string; resendKey?: string; mailFrom?: string; setup?: CfDbSetup; /** Databases set up on other Cloudflare accounts (a site's own database on its own account). */ setups?: CfDbSetup[]; more?: CfMoreToken[]; /** Other accounts whose token this device knows is kept on the database (ids only). */ inDb?: string[] };
const cfRawVault = vault<CfKept>("cfdb");
/** Tokens in use in this tab only (a Cloudflare sign-in): never written to the device, whoever saves. */
export const cfMemTokens = new Set<string>();
/** Cloudflare sign-in tokens (they last a short while and are renewed): fine for this device's own calls, but never
 *  to be stored anywhere as a lasting secret (a Worker's CF_TOKEN and the like). */
export const cfShortTokens = new Set<string>();
let cfRenewing: Promise<void> | null = null;
export const cfAccountVault = {
  ...cfRawVault,
  /** Loads the kept connection, renewing a Cloudflare sign-in that is about to run out first (once, however many ask). */
  async load(studioToken: string): Promise<CfKept | null> {
    let v = await cfRawVault.load(studioToken);
    if (v && [v, ...(v.more || [])].some((e) => e.oauth && e.oauth.exp - Date.now() <= 5 * 60000)) {
      cfRenewing ||= (async () => { const cur = await cfRawVault.load(studioToken); if (cur && (await cfOauthFreshen(cur))) await cfRawVault.save(cur, studioToken); })().catch(() => {}).finally(() => { cfRenewing = null; });
      await cfRenewing; v = await cfRawVault.load(studioToken);
    }
    if (v) for (const e of [v, ...(v.more || [])]) if (e.oauth && e.token) cfShortTokens.add(e.token);
    return v;
  },
  async save(v: CfKept, studioToken: string) {
    // Never written down: a sign-in used in this tab only, and the "through the database" marker (it isn't a token).
    const mem = (t: string) => cfMemTokens.has(t) || isCfDbToken(t);
    if (mem(v.token) || (v.more || []).some((m) => mem(m.token))) {
      const old = await cfRawVault.load(studioToken);
      v = { ...v, token: mem(v.token) ? (old?.token && !mem(old.token) ? old.token : "") : v.token, ...(v.more ? { more: v.more.filter((m) => !mem(m.token)) } : {}) };
    }
    return cfRawVault.save(v, studioToken);
  },
};
/** The database setup this device knows for a database address (the Studio's, or a site's own on another account). */
export const cfSetupFor = (v: { setup?: CfDbSetup; setups?: CfDbSetup[] } | null | undefined, api: string): CfDbSetup | null => {
  const c = (u: string) => u.replace(/\/+$/, "");
  return [v?.setup, ...(v?.setups || [])].find((s) => !!s && c(s.api) === c(api)) || null;
};
/** More Cloudflare tokens on this device, for sites hosted on other Cloudflare accounts (an old account, a client's). */
export type CfMoreToken = { token: string; accounts: { id: string; name: string }[]; oauth?: CfOauthKeep };
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

/** The same page, named for a client's account (the permissions are already ticked: the owner only presses Continue, then Create Token). */
export const cfTokenPageFor = (name: string) => CF_DB_TOKEN_PAGE.replace(/name=[^&]*$/, "name=" + encodeURIComponent(("Picaffectz Studio " + name).slice(0, 60)));

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
/** `site`: the site whose admin page is asking, so the email uses that site's own sign-in template. */
export const cfSendCode = (api: string, email: string, site?: string, studio?: string) => cfCall(api, "/auth/code", { method: "POST", auth: false, body: JSON.stringify({ email, ...(site ? { site } : {}), ...(studio ? { studio } : {}) }) });
export async function cfVerifyCode(api: string, email: string, code: string) {
  const j = await cfCall<{ token: string; email: string; dev?: string }>(api, "/auth/verify", { method: "POST", auth: false, body: JSON.stringify({ email, code }) });
  cfSession.save(api, { email: j.email, token: j.token });
  if (j.dev) cfPinDev.set(api, j.email, j.dev);
  return j.email;
}
// ---- PIN sign-in: email + PIN instead of a code, on a device that has already signed in with a code (the Worker's /auth/pin…)
const PD = (api: string, email: string) => "site-pin-dev:" + clean(api) + ":" + email.trim().toLowerCase(), PL = (api: string) => "site-pin-last:" + clean(api);
export const cfPinDev = {
  get(api: string, email: string): string | null { try { return localStorage.getItem(PD(api, email)); } catch { return null; } },
  set(api: string, email: string, dev: string) { try { localStorage.setItem(PD(api, email), dev); localStorage.setItem(PL(api), email.trim().toLowerCase()); } catch { /* private mode */ } },
  /** The email last signed in here that holds a device secret: offered first on the PIN screen. */
  last(api: string): string | null { try { const e = localStorage.getItem(PL(api)); return e && localStorage.getItem(PD(api, e)) ? e : null; } catch { return null; } },
  forget(api: string, email: string) { try { localStorage.removeItem(PD(api, email)); } catch { /* private mode */ } },
};
/** Is PIN sign-in on for this database, and (when signed in) has this person set one? A database that predates it says off. */
export const cfPinInfo = (api: string): Promise<{ on: boolean; has?: boolean }> => cfCall<{ on: boolean; has?: boolean }>(api, "/auth/pin").then((j) => ({ on: !!j?.on, ...(j && "has" in j ? { has: !!j.has } : {}) })).catch(() => ({ on: false }));
export const cfPinSetOn = (api: string, on: boolean) => cfCall<{ ok: true; on: boolean }>(api, "/auth/pin/set-on", { method: "POST", body: JSON.stringify({ on }) });
export async function cfPinSave(api: string, pin: string) {
  const j = await cfCall<{ dev: string }>(api, "/auth/pin/save", { method: "POST", body: JSON.stringify({ pin }) });
  const e = cfSession.load(api)?.email; if (e && j.dev) cfPinDev.set(api, e, j.dev);
}
export async function cfPinRemove(api: string) { await cfCall(api, "/auth/pin/remove", { method: "POST", body: "{}" }); const e = cfSession.load(api)?.email; if (e) cfPinDev.forget(api, e); }
/** A device that signed in another way (Google) gets the PIN too, when this person has one. */
export async function cfPinEnroll(api: string) { const e = cfSession.load(api)?.email; if (!e || cfPinDev.get(api, e)) return; try { const j = await cfCall<{ dev: string }>(api, "/auth/pin/device", { method: "POST", body: "{}" }); cfPinDev.set(api, e, j.dev); } catch { /* no PIN set: nothing to do */ } }
export async function cfPinLogin(api: string, email: string, pin: string) {
  const dev = cfPinDev.get(api, email); if (!dev) throw new CfDbError("This device hasn't signed in with a code yet. Use an emailed code once.");
  const j = await cfCall<{ token: string; email: string }>(api, "/auth/pin/login", { method: "POST", auth: false, body: JSON.stringify({ email: email.trim().toLowerCase(), pin, dev }) });
  cfSession.save(api, { email: j.email, token: j.token });
  return j.email;
}
// ---- Sign in with Google (the database checks Google's signed answer; see the Worker's /auth/google…)
export const cfGoogleInfo = (api: string): Promise<{ on: boolean; clientId: string; redirect: string }> =>
  cfCall<{ on: boolean; clientId: string; redirect: string }>(api, "/auth/google", { auth: false }).then((j) => ({ on: !!j?.on, clientId: String(j?.clientId || ""), redirect: String(j?.redirect || clean(api) + "/auth/google/cb") })).catch(() => ({ on: false, clientId: "", redirect: clean(api) + "/auth/google/cb" }));
export const cfGoogleSet = (api: string, clientId: string, on: boolean) => cfCall<{ ok: true; on: boolean; clientId: string }>(api, "/auth/google/set", { method: "POST", body: JSON.stringify({ clientId, on }) });
/** Opens Google's sign-in in a small window (call it straight from the click) and waits for the database to say who
 *  signed in. Signs this device in to `api` and resolves with the email. */
export function cfGoogleSignIn(api: string): { done: Promise<string>; cancel: () => void } {
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const win = window.open(`${clean(api)}/auth/google/start?${new URLSearchParams({ origin: location.origin, nonce })}`, "google-signin", "popup,width=520,height=680");
  if (!win) throw new Error("Your browser blocked the Google window. Allow pop-ups for this page and press Sign in with Google again.");
  let stop = () => {};
  const done = new Promise<string>((res, rej) => {
    const started = Date.now(); let busy = false;
    const t = setInterval(async () => {
      if (busy) return;
      if (Date.now() - started > 5 * 60000) { end(); rej(new Error("No answer came back from Google in five minutes. Press Sign in with Google to try again.")); return; }
      busy = true;
      try {
        const r = await fetch(clean(api) + "/auth/google/poll", { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nonce }) });
        const j: any = await r.json().catch(() => null);
        if (r.ok && j?.token) { end(); cfSession.save(api, { email: j.email, token: j.token }); try { win.close(); } catch { /* gone */ } res(j.email); }
        else if (!r.ok) { end(); rej(new Error(j?.error || "Couldn't sign in with Google.")); }
      } catch { /* offline for a moment: keep waiting */ }
      busy = false;
    }, 1500);
    const end = () => clearInterval(t);
    stop = () => { end(); try { win.close(); } catch { /* gone */ } rej(new Error("Cancelled.")); };
  });
  return { done, cancel: () => stop() };
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
  // A Cloudflare sign-in's token runs out within hours: it is never kept on the Worker as its publishing token.
  const dep = o.deployToken && !cfShortTokens.has(o.deployToken) && !isCfDbToken(o.deployToken) ? o.deployToken : "";
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
    vars: { MAIL_FROM: o.mailFrom, NAME: o.name, ...(dep ? { CF_ACCOUNT: acc } : {}) },
    secrets: { ...(keep ? {} : { SECRET: secret }), ...(o.resendKey ? { RESEND_API_KEY: o.resendKey } : {}), ...(dep ? { CF_TOKEN: dep } : {}) },
    d1: [{ name: "DB", id: db.uuid }], keep, ai: true,
  });
  step("Turning on its workers.dev address");
  const sub = await cf.subdomain(acc, o.account.name || "studio");
  await cf.enableWorkersDev(acc, CFDB_WORKER);
  const api = `https://${CFDB_WORKER}.${sub}.workers.dev`;
  step("Checking the database answers");
  let last: any = null;
  // Cloudflare goes on answering with the previous build for a few seconds after an upload: wait for the new one, so
  // the Studio doesn't read the old version straight afterwards and ask for the update again.
  for (let i = 0; i < 20; i++) {
    try { last = await (await fetch(api + "/?t=" + Date.now(), { cache: "no-store" })).json(); if (last?.service === "site-studio-db" && (+last.v || 0) >= CFDB_VERSION) break; } catch { /* starting */ }
    if (i === 4) step("Waiting for Cloudflare to switch to the new build");
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
export async function cfDeployInfo(api: string): Promise<{ /** The database build's version number. */ v?: number; cfx?: boolean; cfxImport?: boolean; bridge?: boolean; studioPages?: boolean; del?: boolean; enqMail?: boolean; deploy: boolean; account?: string; gh?: boolean; ai?: boolean; /** Passes on the Studio owners' Cloudflare calls with its kept tokens (connect once, every device). */ cfa?: boolean; reviews?: boolean; pamphlet?: boolean; accounts?: boolean; more?: number }> {
  try { const j = await (await fetch(clean(api) + "/", { cache: "no-store" })).json(); return { v: +j?.v || 0, deploy: !!j?.deploy, account: j?.account, cfa: !!j?.cfa, gh: !!j?.gh, ai: !!j?.ai, reviews: !!j?.reviews, cfx: !!j?.cfx, cfxImport: (+j?.cfx || 0) >= 2, bridge: (+j?.cfx || 0) >= 3, studioPages: !!j?.studioPages, del: !!j?.del, enqMail: (+j?.enqMail || 0) >= 3, pamphlet: (+j?.pamphlet || 0) >= 2, accounts: (+j?.accounts || 0) >= 2, more: +j?.more || 0 }; } catch { return { deploy: false }; }
}
/** Where this device can do the Studio's Cloudflare work with no token or helper of its own: the Studio's database,
 *  when the Studio signs in there by email, this device is signed in, and the database keeps a token and passes calls on. */
export async function studioDbWay(): Promise<{ api: string; scope: string; token: string } | null> {
  const hc = await loadHostConfig().catch(() => null);
  if (!hc || hc.kind !== "cloudflare" || !cfSession.load(hc.api)) return null;
  const i = await cfDeployInfo(hc.api);
  if (!i.cfa || !(i.deploy || i.more)) return null;
  const scope = "studio:" + hc.studio;
  return { api: hc.api, scope, token: cfDbToken(hc.api, scope) };
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

// ---------------------------------------------------------------- translating a site's text (Languages)
/** Up to 30 texts into `to` (a language's English name) by Workers AI on the database. null entries failed. */
export async function cfTranslate(api: string, o: { to: string; from: string; texts: string[]; engine?: string }): Promise<(string | null)[]> {
  const j = await cfCall<any>(api, "/ai/translate" + ((o as any).engine === "custom" ? "?engine=custom" : ""), { method: "POST", body: JSON.stringify(o) });
  if (j?.error) throw new Error(j.error);
  if (!Array.isArray(j?.t)) throw new Error("Translating needs the database updated once (Settings → Hostings → Update the database).");
  return j.t;
}
/** A database this device is signed in to, for the editor's AI helpers: the Studio's, or (in a site's admin page) the site's own. */
export async function signedInApi(): Promise<string | null> {
  const { loadHostConfig } = await import("./studiohost");
  const hc = await loadHostConfig().catch(() => null);
  if (hc?.kind === "cloudflare" && (await cfSignedIn(hc.api).catch(() => null))) return hc.api;
  try { const j = await (await fetch("cms/site.json", { cache: "no-store" })).json(); if (j?.host?.kind === "cloudflare" && (await cfSignedIn(j.host.api).catch(() => null))) return j.host.api; } catch { /* not a site's admin page */ }
  return null;
}

// ---------------------------------------------------------------- a reference page's look, for "theme from a reference"
/** The design facts of a public page (colours, fonts, corners, interaction libraries), read by the database. */
export async function cfLook(api: string, url: string): Promise<import("./lookdigest").Digest> {
  const j = await cfCall<any>(api, "/ai/look", { method: "POST", body: JSON.stringify({ url }) });
  if (j?.error) throw new Error(j.error);
  if (!j?.digest) throw new Error("Reading a link needs the database updated once (Settings → Hostings → Update the database). An image, PDF or HTML file works without it.");
  return j.digest;
}

// ---------------------------------------------------------------- writing site text from a reference site
export type Brief = Partial<Record<"brand_tagline" | "hero_eyebrow" | "hero_title" | "hero_text" | "hero_cta" | "about_title" | "about_text" | "mission" | "vision" | "services_title" | "services_intro" | "banner_title" | "banner_text" | "cta_title" | "cta_text" | "seo_title" | "seo_description" | "footer_text", string>> & { values?: { title: string; text: string }[]; services?: { title: string; text: string }[]; process?: { title: string; text: string }[]; faq?: { q: string; a: string }[] };
/** Reads the reference (link or pasted text) and writes new text for `brand` with Workers AI on the database. */
export async function cfWrite(api: string, o: { url?: string; text?: string; brand: string; notes?: string; kind: string; engine?: string }): Promise<{ brief: Brief; flagged: string[] }> {
  const j = await cfCall<any>(api, "/ai/write" + ((o as any).engine === "custom" ? "?engine=custom" : ""), { method: "POST", body: JSON.stringify(o) });
  if (j?.error) { const e: any = new Error(j.error); e.thin = !!j.thin; throw e; }
  return j;
}

/** A public page's text outline, read by the database without any AI (for the Picaffectz system's writer). */
export type SitePicture = { url: string; alt: string };
/** The pictures a page shows (no AI). */
export async function cfPictures(api: string, url: string): Promise<SitePicture[]> {
  let j: any; try { j = await cfCall<any>(api, "/ai/pictures", { method: "POST", body: JSON.stringify({ url }) }); } catch (e: any) { if (e?.status === 404) throw new Error("Taking pictures from a site needs the database updated once (Settings → Hostings → Update the database)."); throw e; }
  if (j?.error) throw new Error(j.error);
  return Array.isArray(j?.pictures) ? j.pictures : [];
}
/** One of those pictures, as a file to keep with the site. */
export async function cfPicture(api: string, url: string): Promise<File> {
  const r = await cfCall<Response>(api, "/ai/picture", { method: "POST", body: JSON.stringify({ url }), raw: true });
  const type = (r.headers.get("content-type") || "").split(";")[0];
  if (!/^image\//.test(type)) { const j = await r.json().catch(() => null); throw new Error(j?.error || "Couldn't fetch that picture."); }
  const name = (decodeURIComponent(new URL(url).pathname.split("/").pop() || "picture").replace(/\.[a-z0-9]+$/i, "").replace(/[^\w-]+/g, "-").slice(0, 40) || "picture") + "." + type.split("/")[1].replace("jpeg", "jpg");
  return new File([await r.blob()], name, { type });
}
export async function cfOutline(api: string, url: string): Promise<string> {
  let j: any; try { j = await cfCall<any>(api, "/ai/outline", { method: "POST", body: JSON.stringify({ url }) }); } catch { j = null; }
  if (j?.error) throw new Error(j.error);
  if (typeof j?.text !== "string") throw new Error("Reading a link needs the database updated once (Settings → Hostings → Update the database). A PDF, pasted text or no reference work without it.");
  return j.text;
}

// ---------------------------------------------------------------- reading a product pamphlet
export type PamphletProduct = { name: string; category: string; summary: string; price: string; features: string[]; details: string; specs: { label: string; value: string }[]; page: number };
/** Turns a pamphlet's text (and pictures of pages without text) into catalogue entries, with Workers AI on the database. */
export async function cfProducts(api: string, o: { text?: string; images?: { page: number; data: string }[]; hint?: string; engine?: string }): Promise<PamphletProduct[] & { guessed?: boolean; social?: { kind: string; url: string; label: string }[] }> {
  const j = await cfCall<any>(api, "/ai/products" + ((o as any).engine === "custom" ? "?engine=custom" : ""), { method: "POST", body: JSON.stringify(o) });
  if (j?.error) throw new Error(j.error);
  return Object.assign(j.products || [], { guessed: !!j.guessed, social: Array.isArray(j.social) ? j.social.filter((x: any) => x && typeof x.kind === "string" && /^https:\/\//.test(x.url || "")).slice(0, 16).map((x: any) => ({ kind: x.kind, url: String(x.url), label: "" })) : [] });
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
export const cfxList = (api: string, studio: string) => cfCall<{ main: string | null; accounts: { id: string; name: string }[]; /** Sites every device can publish: "<worker>" on the main account, "<account>/<worker>" on another. */ workers?: string[] }>(api, `/cfx?scope=${encodeURIComponent("studio:" + studio)}`);
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
/** A site's sign-in emails (the people who can open its admin page with an emailed code): from its own database
 *  when signed in to it here, else through the Studio's database. */
export async function siteMembers(cf: { api: string; site: string }, account?: string) {
  const scope = "scope=" + encodeURIComponent("site:" + cf.site);
  const l = !cfSession.load(cf.api) && account ? await studioLink(cf.api) : null;
  const br = l ? (b: any) => cfCall<any>(l.api, `/cfx/db?scope=${encodeURIComponent("studio:" + l.studio)}`, { method: "POST", body: JSON.stringify({ account, site: cf.site, db: dbIds.get(account!), op: "mem", ...b }) }).then((r) => { if (r?.db) dbIds.set(account!, r.db); return r; }) : null;
  return {
    list: async (): Promise<{ email: string; role: string }[]> => (br ? (await br({ sub: "list" })).rows || [] : await cfCall<any[]>(cf.api, "/m?" + scope)),
    add: async (email: string) => { br ? await br({ sub: "add", email }) : await cfCall(cf.api, "/m/add?" + scope, { method: "POST", body: JSON.stringify({ email, role: "owner" }) }); },
    remove: async (email: string) => { br ? await br({ sub: "remove", email }) : await cfCall(cf.api, "/m/remove?" + scope, { method: "POST", body: JSON.stringify({ email }) }); },
  };
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
    /** The owner has seen (or not) an order's payment arrive. */
    paid: async (id: number, paid: boolean) => { br ? await br({ sub: "paid", id, paid }) : await cfCall(cf.api, "/e/paid?" + scope, { method: "POST", body: JSON.stringify({ id, paid }) }); },
    remove: async (id: number) => { br ? await br({ sub: "delete", id }) : await cfCall(cf.api, "/e/delete?" + scope, { method: "POST", body: JSON.stringify({ id }) }); },
    /** A shop order's shipment: its courier and tracking number (with `ship`, the order is marked as sent and the customer emailed). */
    track: async (id: number, b: { courier: string; awb: string; url?: string; name?: string; ship?: boolean }): Promise<{ status: string; data: Record<string, string>; mail: string }> => {
      if (br) throw new Error("Sign in to this site's admin page on this device to save tracking (its database is on another Cloudflare account).");
      return cfCall(cf.api, "/e/track?" + scope, { method: "POST", body: JSON.stringify({ id, ...b }) }); },
    /** Where the parcel is now, asked of the shop's tracking service. */
    live: async (id: number): Promise<{ live: any | null; why: string; status: string }> => {
      if (br) throw new Error("Sign in to this site's admin page on this device to check tracking.");
      return cfCall(cf.api, "/e/track/live?" + scope, { method: "POST", body: JSON.stringify({ id }) }); },
  };
}
