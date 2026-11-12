// Netlify hosting from the Studio: create a site, deploy files (only the ones Netlify doesn't have yet),
// connect a custom domain and check its DNS. Uses a Netlify personal access token kept on this device.

import type { SiteFile } from "./exporter";

export const NETLIFY_API = "https://api.netlify.com/api/v1";
/** Netlify's load balancer for apex domains on external DNS. */
export const NETLIFY_APEX_IP = "75.2.60.5";
export const NETLIFY_APEX_ALIAS = "apex-loadbalancer.netlify.com";

export class NetlifyError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export type NetlifySite = { id: string; name: string; url: string; ssl_url: string; admin_url: string; custom_domain: string | null; domain_aliases?: string[]; ssl?: boolean; default_domain?: string };

async function sha1Hex(data: Uint8Array): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-1", data));
  return [...h].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export class Netlify {
  constructor(private token: string, private base = NETLIFY_API) {}

  private async req<T = any>(path: string, init: RequestInit = {}, raw = false): Promise<T> {
    let r: Response;
    try {
      r = await fetch(this.base.replace(/\/+$/, "") + path, { ...init, headers: { Authorization: `Bearer ${this.token}`, ...(raw ? { "Content-Type": "application/octet-stream" } : init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers || {}) } });
    } catch {
      throw new NetlifyError("Couldn't reach Netlify from this browser. Check the connection and try again; a browser extension that blocks requests can also cause this.", 0);
    }
    if (r.status === 401) throw new NetlifyError("Netlify rejected the token. Create a new personal access token and add it in Settings → Hosting accounts.", 401);
    if (r.status === 429) throw new NetlifyError("Netlify's limit is 3 deploys a minute and 100 a day. Wait a minute and publish again.", 429);
    if (!r.ok) {
      let msg = "";
      try { const j = await r.json(); msg = j.message || j.errors?.[0]?.message || JSON.stringify(j); } catch { /* not JSON */ }
      if (r.status === 422 && /subdomain|name/i.test(msg)) throw new NetlifyError("That Netlify site name is taken. Pick another.", 422);
      throw new NetlifyError(`Netlify: ${msg || r.statusText} (${r.status})`, r.status);
    }
    return (r.status === 204 ? null : r.json()) as Promise<T>;
  }

  me() { return this.req<{ email: string; full_name?: string; slug?: string }>("/user"); }
  getSite(id: string) { return this.req<NetlifySite>(`/sites/${encodeURIComponent(id)}`); }
  createSite(name: string) { return this.req<NetlifySite>("/sites", { method: "POST", body: JSON.stringify({ name }) }); }

  /** Deploys `files` as the whole site. Netlify asks only for contents it doesn't already have. */
  async deploy(siteId: string, files: SiteFile[], title: string, onProgress?: (done: number, total: number) => void): Promise<{ id: string; url: string }> {
    const digest: Record<string, string> = {};
    const bySha = new Map<string, SiteFile>();
    for (const f of files) {
      if (f.path === ".nojekyll") continue;
      const sha = await sha1Hex(f.data);
      digest["/" + f.path] = sha;
      bySha.set(sha, f);
    }
    const d = await this.req<{ id: string; required?: string[]; state: string; ssl_url?: string; deploy_ssl_url?: string }>(`/sites/${encodeURIComponent(siteId)}/deploys?title=${encodeURIComponent(title)}`, { method: "POST", body: JSON.stringify({ files: digest, async: true }) });
    let dep = d;
    for (let i = 0; i < 60 && dep.state === "preparing"; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      dep = await this.req(`/sites/${encodeURIComponent(siteId)}/deploys/${d.id}`);
    }
    const need = dep.required || [];
    let done = 0;
    onProgress?.(0, need.length);
    const queue = [...need];
    const worker = async () => {
      for (let sha = queue.shift(); sha; sha = queue.shift()) {
        const f = bySha.get(sha);
        if (!f) continue;
        const path = f.path.split("/").map(encodeURIComponent).join("/");
        for (let attempt = 0; ; attempt++) {
          try { await this.req(`/deploys/${d.id}/files/${path}`, { method: "PUT", body: f.data as unknown as BodyInit }, true); break; }
          catch (e) { if (attempt >= 2) throw e; await new Promise((r) => setTimeout(r, 1500)); }
        }
        onProgress?.(++done, need.length);
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, need.length) }, worker));
    for (let i = 0; i < 90; i++) {
      dep = await this.req(`/sites/${encodeURIComponent(siteId)}/deploys/${d.id}`);
      if (dep.state === "ready") break;
      if (dep.state === "error") throw new NetlifyError("Netlify couldn't finish the deploy. Publish again.", 500);
      await new Promise((r) => setTimeout(r, 1000));
    }
    return { id: d.id, url: dep.ssl_url || dep.deploy_ssl_url || "" };
  }

  /** Uses www.<domain> as the main address (Netlify's advice for external DNS); the bare domain redirects to it.
   *  HTTPS is requested later (provisionSsl), once DNS points here; Netlify then redirects http to https itself. */
  async setDomain(siteId: string, domain: string) {
    const apex = domain.replace(/^www\./, "");
    return this.req<NetlifySite>(`/sites/${encodeURIComponent(siteId)}`, { method: "PATCH", body: JSON.stringify({ custom_domain: `www.${apex}` }) });
  }
  async removeDomain(siteId: string) {
    return this.req<NetlifySite>(`/sites/${encodeURIComponent(siteId)}`, { method: "PATCH", body: JSON.stringify({ custom_domain: null, domain_aliases: [] }) });
  }
  provisionSsl(siteId: string) { return this.req(`/sites/${encodeURIComponent(siteId)}/ssl`, { method: "POST" }).catch((e) => { if (e.status === 422) return null; throw e; }); }
}

export const domainOk = (d: string) => /^(?!-)([a-z0-9-]{1,63}\.)+[a-z]{2,24}$/i.test(String(d || "").trim().replace(/^https?:\/\//, "").replace(/\/.*$/, ""));
export const cleanDomain = (d: string) => String(d || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");

export type DnsRecord = { type: "A" | "CNAME"; host: string; value: string; alt?: string };
export function dnsRecords(domain: string, netlifyHost: string): DnsRecord[] {
  return [
    { type: "A", host: "@", value: NETLIFY_APEX_IP, alt: `or ALIAS / ANAME / flattened CNAME → ${NETLIFY_APEX_ALIAS}` },
    { type: "CNAME", host: "www", value: netlifyHost },
  ];
}

/** Checks the records with Google's public DNS (works from the browser). */
export async function checkDns(domain: string, netlifyHost: string): Promise<{ apex: boolean; www: boolean; seen: { apex: string[]; www: string[] } }> {
  const q = async (name: string, type: string) => {
    try {
      const r = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`, { cache: "no-store" });
      const j = await r.json();
      return ((j.Answer || []) as { type: number; data: string }[]).map((a) => a.data.replace(/\.$/, "").toLowerCase());
    } catch { return []; }
  };
  const apex = cleanDomain(domain);
  const [a, w] = await Promise.all([q(apex, "A"), q("www." + apex, "CNAME")]);
  const wA = w.length ? w : await q("www." + apex, "A");
  return {
    apex: a.includes(NETLIFY_APEX_IP) || a.length > 0 && (await q(NETLIFY_APEX_ALIAS, "A")).some((ip) => a.includes(ip)),
    www: w.includes(netlifyHost.toLowerCase()) || (w.length === 0 && wA.includes(NETLIFY_APEX_IP)),
    seen: { apex: a, www: wA },
  };
}
