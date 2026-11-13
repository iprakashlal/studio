// Cloudflare Workers through the Studio's helper: check the token, find the account and its workers.dev
// address, upload a Worker with its settings and secrets, and read the Worker's own health check.
import { b64, relayCall, type Relay } from "./relay";
import { vault } from "./vault";

export const cfVault = vault<{ token: string; account?: string }>("cloudflare");
export const CF_TOKEN_PAGE = "https://dash.cloudflare.com/profile/api-tokens";
/** Where to add "Zone → DNS → Edit" to the token, so the Studio can add email records too. */
export const CF_DNS_HINT = "Edit the token (My Profile → API Tokens → Edit) and add the permission Zone → DNS → Edit for your domain.";
export class CfError extends Error { constructor(msg: string, public status = 0, public code = 0) { super(msg); } }
export type CfAccount = { id: string; name: string };

export class Cloudflare {
  constructor(private relay: Relay, private token: string) {}
  private async api<T = any>(method: string, path: string, body?: { json?: unknown; bytes?: Uint8Array; type?: string }): Promise<T> {
    const r = await relayCall(this.relay, { target: "cloudflare", method, path, auth: this.token, ...(body?.json !== undefined ? { body: JSON.stringify(body.json), contentType: "application/json" } : body?.bytes ? { body64: b64(body.bytes), contentType: body.type } : {}) });
    let j: any = null; try { j = JSON.parse(r.body); } catch { /* not JSON */ }
    if (r.status === 401 || r.status === 403 || j?.errors?.some((e: any) => e.code === 10000 || e.code === 9109)) throw new CfError("Cloudflare refused the token. Create one with the “Edit Cloudflare Workers” template and paste it again.", r.status);
    if (!j?.success) { const e = j?.errors?.[0]; throw new CfError(`Cloudflare: ${e?.message || r.body.slice(0, 200) || r.status}`, r.status, e?.code || 0); }
    return j.result as T;
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
  async upload(account: string, name: string, code: string, opts: { vars?: Record<string, string>; secrets?: Record<string, string>; keep?: boolean }) {
    const bindings = [
      ...Object.entries(opts.vars || {}).filter(([, v]) => v !== "").map(([n, text]) => ({ type: "plain_text", name: n, text })),
      ...Object.entries(opts.secrets || {}).filter(([, v]) => v !== "").map(([n, text]) => ({ type: "secret_text", name: n, text })),
    ];
    const meta = { main_module: "worker.js", compatibility_date: "2024-09-23", bindings, ...(opts.keep ? { keep_bindings: ["plain_text", "secret_text"] } : {}) };
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
  enableWorkersDev(account: string, name: string) { return this.api("POST", `/accounts/${account}/workers/scripts/${encodeURIComponent(name)}/subdomain`, { json: { enabled: true, previews_enabled: false } }); }
}

/** The Worker's own check (GET on its address) or test email (?mailtest), read through the helper. */
export async function workerCheck(relay: Relay, url: string, mailtest = false): Promise<any> {
  const r = await relayCall(relay, { target: "worker", url: url.replace(/\/?$/, "/") + (mailtest ? "?mailtest" : "") });
  try { return JSON.parse(r.body); } catch { return { status: `The Worker answered ${r.status}.`, checks: [] }; }
}
