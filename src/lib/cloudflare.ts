// Cloudflare Workers through the Studio's helper: check the token, find the account and its workers.dev
// address, upload a Worker with its settings and secrets, and read the Worker's own health check.
import { b64, relayCall, type Relay } from "./relay";
import { vault } from "./vault";

export const cfVault = vault<{ token: string; account?: string }>("cloudflare");
/** Cloudflare's token page with the shop server's permissions already ticked (Workers Scripts, Account Settings). */
export const CF_TOKEN_PAGE = `https://dash.cloudflare.com/profile/api-tokens?${new URLSearchParams({ permissionGroupKeys: JSON.stringify([{ key: "workers_scripts", type: "edit" }, { key: "account_settings", type: "read" }]), accountId: "*", zoneId: "all", name: "Picaffectz Studio shop" })}`;
/** Where to add "Zone → DNS → Edit" to the token, so the Studio can add email records too. */
export const CF_DNS_HINT = "Edit the token (My Profile → API Tokens → Edit) and add the permission Zone → DNS → Edit for your domain.";
/** What a Cloudflare API call was doing, for error messages. */
export function cfStep(method: string, path: string): string {
  if (/\/assets-upload-session$/.test(path)) return "starting the upload of the site's files";
  if (/\/workers\/assets\/upload/.test(path)) return "uploading the site's files";
  if (/\/workers\/scripts\/[^/]+\/subdomain$/.test(path)) return "turning on the workers.dev address";
  if (/\/workers\/scripts\/[^/]+\/settings$/.test(path)) return "reading a Worker";
  if (/\/workers\/scripts\/[^/]+$/.test(path)) return method === "PUT" ? "putting the new version live" : "reading a Worker";
  if (/\/workers\/domains/.test(path)) return "connecting the domain";
  if (/\/d1\//.test(path)) return "using the database";
  if (/^\/zones/.test(path)) return /dns_records/.test(path) ? "adding DNS records" : "checking the domain";
  if (/\/workers\/subdomain/.test(path)) return "reading the workers.dev name";
  return `${method} ${path.split("?")[0]}`;
}
export class CfError extends Error { constructor(msg: string, public status = 0, public code = 0) { super(msg); } }
export type CfAccount = { id: string; name: string };
export type CfZone = { id: string; name: string; status: string; name_servers?: string[]; original_name_servers?: string[] | null; original_registrar?: string | null };
/** Where to change nameservers, for the registrars people use most (else Cloudflare's guide). */
export function registrarHelp(z: Pick<CfZone, "name" | "original_registrar" | "original_name_servers">): { name: string; url: string; how: string } {
  const r = `${z.original_registrar || ""} ${(z.original_name_servers || []).join(" ")}`.toLowerCase(), d = encodeURIComponent(z.name);
  if (/godaddy|domaincontrol/.test(r)) return { name: "GoDaddy", url: `https://dcc.godaddy.com/control/portfolio/${d}/settings?tab=dns&subtab=nameservers`, how: "Nameservers → Change Nameservers → I'll use my own nameservers, paste the two below, Save" };
  if (/namecheap|registrar-servers/.test(r)) return { name: "Namecheap", url: `https://ap.www.namecheap.com/domains/domaincontrolpanel/${d}/domain`, how: "Nameservers → Custom DNS, paste the two below, ✓" };
  if (/hostinger|dns-parking/.test(r)) return { name: "Hostinger", url: `https://hpanel.hostinger.com/domain/${d}/dns`, how: "Change nameservers → paste the two below, Save" };
  if (/bigrock|resellerclub|publicdomainregistry|bigrock/.test(r)) return { name: "BigRock", url: "https://manage.bigrock.in/", how: "Domain → Name Servers, paste the two below, Update" };
  if (/squarespace|google/.test(r)) return { name: "Squarespace", url: `https://account.squarespace.com/domains/managed/${d}/dns/domain-nameservers`, how: "Use custom nameservers, paste the two below, Save" };
  if (/porkbun/.test(r)) return { name: "Porkbun", url: "https://porkbun.com/account/domainsSpeedy", how: "Details → Authoritative nameservers → Edit, paste the two below" };
  if (/hostgator|bluehost|ionos|1and1/.test(r)) return { name: (/hostgator/.test(r) ? "HostGator" : /bluehost/.test(r) ? "Bluehost" : "IONOS"), url: "https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/#update-your-nameservers", how: "In your domain's settings, set custom nameservers to the two below" };
  return { name: "your domain company", url: "https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/#update-your-nameservers", how: "Find Nameservers in the domain's settings, set them to the two below (remove the others)" };
}

export class Cloudflare {
  constructor(private relay: Relay, private token: string) {}
  private async api<T = any>(method: string, path: string, body?: { json?: unknown; bytes?: Uint8Array; text?: string; type?: string; auth?: string }): Promise<T> {
    const q = { target: "cloudflare" as const, method, path, auth: body?.auth || this.token, ...(body?.json !== undefined ? { body: JSON.stringify(body.json), contentType: "application/json" } : body?.bytes ? { body64: b64(body.bytes), contentType: body.type } : body?.text !== undefined ? { body: body.text, contentType: body.type } : {}) };
    // Cloudflare's "unknown error" (10013) and 5xx answers are usually momentary: try again twice before giving up.
    for (let attempt = 0; ; attempt++) {
      const r = await relayCall(this.relay, q);
      let j: any = null; try { j = JSON.parse(r.body); } catch { /* not JSON */ }
      if (r.status === 401 || r.status === 403 || j?.errors?.some((e: any) => e.code === 10000 || e.code === 9109)) throw new CfError("Cloudflare refused the token. Create one with the “Edit Cloudflare Workers” template and paste it again.", r.status);
      if (j?.success) return j.result as T;
      const e = j?.errors?.[0], code = e?.code || 0;
      const passing = r.status >= 500 || code === 10013 || /unknown error/i.test(e?.message || "");
      if (passing && attempt < 2) { await new Promise((res) => setTimeout(res, attempt ? 5000 : 1500)); continue; }
      const what = cfStep(method, path);
      throw new CfError(passing
        ? `Cloudflare had a problem on its side while ${what} (code ${code || r.status}), even after trying again. Wait a minute and press the button again; nothing is lost.`
        : `Cloudflare (${what}): ${e?.message || r.body.slice(0, 200) || r.status}${code ? ` [${code}]` : ""}`, r.status, code);
    }
  }
  accounts() { return this.api<CfAccount[]>("GET", "/accounts?per_page=50"); }
  /** The account's workers.dev name, creating it when the account doesn't have one yet. */
  async subdomain(account: string, wish: string): Promise<string> {
    try { const r = await this.api<{ subdomain: string }>("GET", `/accounts/${account}/workers/subdomain`); if (r?.subdomain) return r.subdomain; } catch (e: any) { if (!(e instanceof CfError) || (e.status !== 404 && e.code !== 10007)) throw e; }
    const base = wish.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "studio";
    for (const name of [base, base + "-" + Math.random().toString(36).slice(2, 6)]) {
      try { const r = await this.api<{ subdomain: string }>("PUT", `/accounts/${account}/workers/subdomain`, { json: { subdomain: name } }); return r.subdomain || name; } catch (e) { if (name !== base) throw e; }
    }
    throw new CfError("Couldn't create a workers.dev address for this account.");
  }
  /** Uploads (or replaces) a Worker module. With `keep`, settings and secrets already on the Worker stay. */
  // ---- D1 (the Studio's database on Cloudflare)
  d1List(account: string) { return this.api<{ uuid: string; name: string }[]>("GET", `/accounts/${account}/d1/database?per_page=100`); }
  d1Create(account: string, name: string) { return this.api<{ uuid: string; name: string }>("POST", `/accounts/${account}/d1/database`, { json: { name } }); }
  d1Query(account: string, id: string, sql: string, params: unknown[] = []) { return this.api<any[]>("POST", `/accounts/${account}/d1/database/${id}/query`, { json: { sql, ...(params.length ? { params } : {}) } }); }

  async upload(account: string, name: string, code: string, opts: { vars?: Record<string, string>; secrets?: Record<string, string>; keep?: boolean; d1?: { name: string; id: string }[]; assets?: { jwt: string; config: Record<string, unknown> } }) {
    const bindings = [
      ...(opts.assets ? [{ type: "assets", name: "ASSETS" }] : []),
      ...(opts.d1 || []).map((d) => ({ type: "d1", name: d.name, id: d.id })),
      ...Object.entries(opts.vars || {}).filter(([, v]) => v !== "").map(([n, text]) => ({ type: "plain_text", name: n, text })),
      ...Object.entries(opts.secrets || {}).filter(([, v]) => v !== "").map(([n, text]) => ({ type: "secret_text", name: n, text })),
    ];
    const meta = { main_module: "worker.js", compatibility_date: "2024-09-23", bindings, ...(opts.keep ? { keep_bindings: ["plain_text", "secret_text"] } : {}), ...(opts.assets ? { assets: opts.assets } : {}) };
    const boundary = "----studio" + Math.random().toString(16).slice(2);
    const enc = new TextEncoder();
    const body = enc.encode(
      `--${boundary}\r\nContent-Disposition: form-data; name="metadata"; filename="metadata.json"\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(meta)}\r\n` +
      `--${boundary}\r\nContent-Disposition: form-data; name="worker.js"; filename="worker.js"\r\nContent-Type: application/javascript+module\r\n\r\n${code}\r\n--${boundary}--\r\n`);
    return this.api("PUT", `/accounts/${account}/workers/scripts/${encodeURIComponent(name)}`, { bytes: body, type: "multipart/form-data; boundary=" + boundary });
  }
  /** The Cloudflare zone that holds `domain` (or one of its parents), when this token can see it. */
  async zoneFor(domain: string): Promise<{ id: string; name: string } | null> {
    const parts = domain.toLowerCase().split(".");
    for (let i = 0; i < parts.length - 1; i++) {
      const name = parts.slice(i).join(".");
      try { const z = await this.api<{ id: string; name: string }[]>("GET", `/zones?name=${encodeURIComponent(name)}`); if (z?.length) return z[0]; } catch (e) { if (!(e instanceof CfError) || i === 0) throw e; }
    }
    return null;
  }
  // ---- Adding your domain to Cloudflare (the one step left for you: switching its nameservers where you bought it)
  async zone(id: string) { return this.api<CfZone>("GET", `/zones/${id}`); }
  /** The zone named exactly `name` on this account, whatever its status. */
  async zoneNamed(name: string): Promise<CfZone | null> { const z = await this.api<CfZone[]>("GET", `/zones?name=${encodeURIComponent(name)}`); return z?.[0] || null; }
  /** Adds the domain to the account; Cloudflare copies its current DNS records first (jump_start), so email keeps working. */
  zoneCreate(account: string, name: string) { return this.api<CfZone>("POST", "/zones", { json: { name, account: { id: account }, type: "full", jump_start: true } }); }
  /** Asks Cloudflare to look at the nameservers again now (it otherwise checks every few hours). */
  zoneCheck(id: string) { return this.api("PUT", `/zones/${id}/activation_check`).catch(() => null); }
  /** Adds DNS records (names relative to `base`), skipping ones already there. Returns what it did per record. */
  async addRecords(zone: { id: string; name: string }, base: string, recs: { type: string; name: string; value: string; priority?: number }[]) {
    const out: { name: string; type: string; done: "added" | "there" | "conflict" }[] = [];
    for (const r of recs) {
      const fq = !r.name || r.name === "@" ? base : r.name.endsWith("." + base) || r.name === base ? r.name : `${r.name}.${base}`;
      const have = await this.api<{ content: string; type: string }[]>("GET", `/zones/${zone.id}/dns_records?type=${r.type}&name=${encodeURIComponent(fq)}`);
      const clean = (v: string) => v.replace(/^"|"$/g, "").replace(/\.$/, "").toLowerCase();
      if (have.some((h) => clean(h.content) === clean(r.value))) { out.push({ name: fq, type: r.type, done: "there" }); continue; }
      // One CNAME per name, and one SPF TXT: don't add a second one that would break the first.
      if (have.length && (r.type === "CNAME" || (r.type === "TXT" && /^"?v=spf1/i.test(r.value) && have.some((h) => /^"?v=spf1/i.test(h.content))))) { out.push({ name: fq, type: r.type, done: "conflict" }); continue; }
      await this.api("POST", `/zones/${zone.id}/dns_records`, { json: { type: r.type, name: fq, content: r.value, ttl: 1, proxied: false, ...(r.type === "MX" ? { priority: r.priority ?? 10 } : {}) } });
      out.push({ name: fq, type: r.type, done: "added" });
    }
    return out;
  }
  /** The Worker's settings, or null when there's no Worker by that name. */
  async script(account: string, name: string): Promise<{ bindings?: unknown[] } | null> {
    try { return await this.api("GET", `/accounts/${account}/workers/scripts/${encodeURIComponent(name)}/settings`); }
    catch (e) { if (e instanceof CfError && (e.status === 404 || e.code === 10007)) return null; throw e; }
  }

  // ---- Static sites (Workers static assets): the pages are uploaded once and served free, with no traffic limit.
  /**
   * Puts `files` live as the whole site of Worker `name` (created when new) and returns its workers.dev address.
   * Cloudflare asks only for the files it doesn't have yet. `get` reads a file's bytes when they're not in `files`.
   */
  async deploySite(account: string, name: string, sub: string, files: { path: string; data?: Uint8Array; hash?: string; size?: number }[], o: { spa?: boolean; get?: (path: string) => Promise<Uint8Array>; progress?: (done: number, total: number) => void } = {}): Promise<{ url: string }> {
    const manifest: Record<string, { hash: string; size: number }> = {}, byHash = new Map<string, (typeof files)[number]>();
    for (const f of files) {
      if (f.path === ".nojekyll") continue;
      const hash = f.hash || await assetHash(f.path, f.data!), size = f.size ?? f.data!.length;
      manifest["/" + f.path.replace(/^\/+/, "")] = { hash, size };
      if (!byHash.has(hash)) byHash.set(hash, f);
    }
    const s = await this.api<{ jwt: string; buckets?: string[][] }>("POST", `/accounts/${account}/workers/scripts/${encodeURIComponent(name)}/assets-upload-session`, { json: { manifest } });
    let done = 0, completion = s.jwt;
    const need = (s.buckets || []).flat().length;
    o.progress?.(0, need);
    for (const bucket of s.buckets || []) {
      // Kept under ~3 MB a request so it also passes a Netlify helper.
      let parts: { hash: string; b64: string; type: string }[] = [], size = 0;
      const send = async () => {
        if (!parts.length) return;
        const boundary = "----studio" + Math.random().toString(16).slice(2);
        const text = parts.map((p) => `--${boundary}\r\nContent-Disposition: form-data; name="${p.hash}"; filename="${p.hash}"\r\nContent-Type: ${p.type}\r\n\r\n${p.b64}\r\n`).join("") + `--${boundary}--\r\n`;
        const r = await this.api<{ jwt?: string } | null>("POST", `/accounts/${account}/workers/assets/upload?base64=true`, { text, type: "multipart/form-data; boundary=" + boundary, auth: s.jwt });
        if (r?.jwt) completion = r.jwt;
        done += parts.length; o.progress?.(done, need); parts = []; size = 0;
      };
      for (const hash of bucket) {
        const f = byHash.get(hash);
        if (!f) throw new CfError("Cloudflare asked for a file the Studio didn't send.");
        const data = f.data || (await o.get!(f.path)), enc64 = b64(data);
        if (size && size + enc64.length > 3_000_000) await send();
        parts.push({ hash, b64: enc64, type: mimeOf(f.path) }); size += enc64.length;
      }
      await send();
    }
    await this.upload(account, name, SITE_WORKER, { assets: { jwt: completion, config: { html_handling: "auto-trailing-slash", not_found_handling: o.spa ? "single-page-application" : "404-page" } } });
    await this.enableWorkersDev(account, name);
    return { url: `https://${name}.${sub}.workers.dev/` };
  }

  // ---- Your own domain on a Worker (the domain's DNS must be on this Cloudflare account)
  workerDomains(account: string, service: string) { return this.api<{ id: string; hostname: string; service: string }[]>("GET", `/accounts/${account}/workers/domains?service=${encodeURIComponent(service)}`); }
  /** Points hostname at the Worker. Old records for that exact name (say, pointing at Netlify) are replaced. */
  addWorkerDomain(account: string, service: string, hostname: string, zoneId: string) { return this.api("PUT", `/accounts/${account}/workers/domains`, { json: { environment: "production", hostname, service, zone_id: zoneId, override_existing_dns_record: true, override_existing_origin: true } }); }
  removeWorkerDomain(account: string, id: string) { return this.api("DELETE", `/accounts/${account}/workers/domains/${id}`); }

  enableWorkersDev(account: string, name: string) { return this.api("POST", `/accounts/${account}/workers/scripts/${encodeURIComponent(name)}/subdomain`, { json: { enabled: true, previews_enabled: false } }); }
}

/** The small script in front of a static site: every request is answered from its files (404.html when missing). */
export const SITE_WORKER = "export default { fetch: (request, env) => env.ASSETS.fetch(request) };\n";
/** What Cloudflare calls a file (SHA-256 of its base64 plus its extension, 32 hex characters). */
export async function assetHash(path: string, data: Uint8Array): Promise<string> {
  const ext = /\.([^./]+)$/.exec(path)?.[1] || "";
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(b64(data) + ext)));
  return [...h].map((x) => x.toString(16).padStart(2, "0")).join("").slice(0, 32);
}
const MIME: Record<string, string> = { html: "text/html", htm: "text/html", css: "text/css", js: "text/javascript", mjs: "text/javascript", json: "application/json", map: "application/json", txt: "text/plain", xml: "application/xml", svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", avif: "image/avif", ico: "image/x-icon", woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf", pdf: "application/pdf", mp4: "video/mp4", webm: "video/webm", mp3: "audio/mpeg", wasm: "application/wasm", webmanifest: "application/manifest+json" };
export const mimeOf = (path: string) => MIME[(/\.([^./]+)$/.exec(path)?.[1] || "").toLowerCase()] || "application/octet-stream";
/** What a token needs to put a site on your own domain (added to the token once).  */
export const CF_DOMAIN_HINT = "Edit the token (My Profile → API Tokens → Edit) and add Zone → Workers Routes → Edit and Zone → DNS → Edit for your domain, then press Connect again.";

/** The Worker's own check (GET on its address) or test email (?mailtest), read through the helper. */
export async function workerCheck(relay: Relay, url: string, mailtest = false): Promise<any> {
  const r = await relayCall(relay, { target: "worker", url: url.replace(/\/?$/, "/") + (mailtest ? "?mailtest" : "") });
  try { return JSON.parse(r.body); } catch { return { status: `The Worker answered ${r.status}.`, checks: [] }; }
}
