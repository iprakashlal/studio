// Where a site's pages (or a Studio app) are served: Netlify, or Cloudflare (Workers static assets, free with no
// traffic limit). Both are driven from the Studio with a token kept on this device; Cloudflare's API is reached
// through the Studio's helper.
import { Netlify } from "./netlify";
import { Cloudflare } from "./cloudflare";
import { getHelper } from "./relay";
import { cfAccountVault, cfDeployInfo, cfSignedIn, dbCloudflare } from "./cfdb";
import type { HostCfg } from "./supa";
import { netlifyToken } from "./hosting";
import type { SiteFile } from "./exporter";

export type PagesKind = "netlify" | "cloudflare";
export type PagesSite = { siteId: string; siteName: string; url: string };
/** The built Studio's files (app-files.json): SHA-1 per path for Netlify, Cloudflare's hash and size per path. */
export type AppList = { build: string; files: Record<string, string>; cf?: Record<string, [string, number]> };

export interface Pages {
  kind: PagesKind; label: string; account?: string;
  /** Reads what addressOf needs (Cloudflare's workers.dev name for the account, made when it has none). */
  init(): Promise<void>;
  /** The address a new site with this name gets. */
  addressOf(name: string): string;
  /** An existing site with this name on the account, if any. */
  find(name: string): Promise<PagesSite | null>;
  get(siteId: string): Promise<PagesSite | null>;
  /** A new site (Cloudflare creates it on its first deploy). */
  create(name: string): Promise<PagesSite>;
  deploy(siteId: string, files: SiteFile[], title: string, progress?: (done: number, total: number) => void): Promise<{ url: string }>;
  /** Deploys an app known by its file list, reading only the files the host asks for. */
  deployApp(siteId: string, list: AppList, extra: { path: string; data: Uint8Array }[], get: (path: string) => Promise<Uint8Array>, title: string, progress?: (done: number, total: number) => void): Promise<{ url: string }>;
}

const sha1 = async (b: Uint8Array) => [...new Uint8Array(await crypto.subtle.digest("SHA-1", b as BufferSource))].map((x) => x.toString(16).padStart(2, "0")).join("");
const https = (u: string) => u.replace(/^http:/, "https:").replace(/\/?$/, "/");

export function netlifyPages(nf: Netlify): Pages {
  const site = (s: { id: string; name: string; ssl_url?: string; url: string }): PagesSite => ({ siteId: s.id, siteName: s.name, url: https(s.ssl_url || s.url || `https://${s.name}.netlify.app`) });
  return {
    kind: "netlify", label: "Netlify", init: async () => {},
    addressOf: (name) => `https://${name}.netlify.app/`,
    find: async (name) => { const s = await nf.getSite(`${name}.netlify.app`).catch(() => null); return s ? site(s) : null; },
    get: async (id) => { const s = await nf.getSite(id).catch(() => null); return s ? site(s) : null; },
    create: async (name) => site(await nf.createSite(name)),
    deploy: async (id, files, title, progress) => { const d = await nf.deploy(id, files, title, progress); return { url: d.url }; },
    deployApp: async (id, list, extra, get, title, progress) => {
      const digest = { ...list.files };
      for (const f of extra) digest[f.path] = await sha1(f.data);
      await nf.deployDigest(id, digest, (p) => { const x = extra.find((f) => f.path === p); return x ? Promise.resolve(x.data) : get(p); }, title, progress);
      const s = await nf.getSite(id).catch(() => null);
      return { url: s ? site(s).url : "" };
    },
  };
}

export function cloudflarePages(cf: Cloudflare, account: string, accountName = "studio"): Pages {
  let sub: string | null = null;
  const subdomain = async () => (sub ||= await cf.subdomain(account, accountName));
  const at = async (name: string): Promise<PagesSite> => ({ siteId: name, siteName: name, url: `https://${name}.${await subdomain()}.workers.dev/` });
  return {
    kind: "cloudflare", label: "Cloudflare", account, init: async () => { await subdomain(); },
    addressOf: (name) => `https://${name}.${sub || "<you>"}.workers.dev/`,
    find: async (name) => ((await cf.script(account, name)) ? at(name) : null),
    get: async (id) => ((await cf.script(account, id)) ? at(id) : null),
    create: (name) => at(name),
    deploy: async (id, files, _title, progress) => cf.deploySite(account, id, await subdomain(), files.map((f) => ({ path: f.path, data: f.data })), { progress }),
    deployApp: async (id, list, extra, get, _title, progress) => {
      const files: { path: string; data?: Uint8Array; hash?: string; size?: number }[] = [];
      for (const [path] of Object.entries(list.files)) {
        const c = list.cf?.[path];
        files.push(c ? { path, hash: c[0], size: c[1] } : { path, data: await get(path) });
      }
      files.push(...extra);
      return cf.deploySite(account, id, await subdomain(), files, { spa: true, get, progress });
    },
  };
}

/** The hosting on this device for `kind` (null when its account isn't connected here). `account` picks a
 *  Cloudflare account other than the saved one (a site published from another account the token can see). */
export async function loadPages(kind: PagesKind, studioToken: string, account?: string): Promise<Pages | null> {
  const t = await netlifyToken.load(studioToken), nf = t ? new Netlify(t.token) : null;
  if (kind === "netlify") return nf ? netlifyPages(nf) : null;
  const v = await cfAccountVault.load(studioToken);
  if (!v?.token || !(account || v.account)) return null;
  const relay = await getHelper(studioToken, nf).catch(() => null);
  if (!relay) return null;
  return cloudflarePages(new Cloudflare(relay, v.token), (account || v.account)!);
}

export const PAGES_LABEL: Record<PagesKind, string> = { netlify: "Netlify", cloudflare: "Cloudflare" };

/** Publishing through the Studio's database (its kept Cloudflare token) as a signed-in owner of `scope`; null when
 *  the database doesn't keep a token or this device isn't signed in to it. */
export async function pagesViaDb(api: string, scope: string): Promise<Pages | null> {
  const info = await cfDeployInfo(api);
  if (!info.deploy || !info.account || !(await cfSignedIn(api))) return null;
  return { ...cloudflarePages(dbCloudflare(api, scope), info.account), label: "Cloudflare" };
}
/** The way to publish a hosted site from this device: its own token if connected here, else through the database. */
export async function pagesForHost(h: HostCfg, studioToken: string): Promise<Pages | null> {
  const own = await loadPages(h.kind, studioToken, h.account).catch(() => null);
  if (own || h.kind !== "cloudflare" || !h.cf) return own;
  return pagesViaDb(h.cf.api, "site:" + h.cf.site);
}
