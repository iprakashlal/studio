// Resend (email) through the Studio's helper: domains, their DNS records and verification, and a sending-only
// key for a Worker.
import { relayCall, type Relay } from "./relay";

export const RESEND_KEYS_PAGE = "https://resend.com/api-keys";
export type ResendRecord = { record: string; name: string; type: string; value: string; ttl?: string; status?: string; priority?: number };
export type ResendDomain = { id: string; name: string; status: string; region?: string; records?: ResendRecord[] };
export class ResendError extends Error { constructor(msg: string, public status = 0, public restricted = false) { super(msg); } }

export class Resend {
  constructor(private relay: Relay, private key: string) {}
  private async api<T = any>(method: string, path: string, json?: unknown): Promise<T> {
    const r = await relayCall(this.relay, { target: "resend", method, path, auth: this.key, ...(json !== undefined ? { body: JSON.stringify(json), contentType: "application/json" } : {}) });
    let j: any = null; try { j = JSON.parse(r.body); } catch { /* not JSON */ }
    if (r.status >= 400) {
      const restricted = j?.name === "restricted_api_key";
      if (r.status === 401 && !restricted) throw new ResendError("Resend refused the API key. Copy it again from Resend → API Keys.", 401);
      throw new ResendError(restricted ? "This key can only send email. To add your domain from here, use a key with Full access (you can delete it afterwards)." : `Resend: ${j?.message || r.status}`, r.status, restricted);
    }
    return j as T;
  }
  async domains(): Promise<ResendDomain[]> { const r = await this.api<{ data: ResendDomain[] }>("GET", "/domains"); return r.data || []; }
  domain(id: string) { return this.api<ResendDomain>("GET", `/domains/${id}`); }
  addDomain(name: string) { return this.api<ResendDomain>("POST", "/domains", { name }); }
  verify(id: string) { return this.api("POST", `/domains/${id}/verify`); }
  /** A key that can only send email, optionally only from one domain: what a Worker should hold. */
  sendingKey(name: string, domainId?: string) { return this.api<{ id: string; token: string }>("POST", "/api-keys", { name, permission: "sending_access", ...(domainId ? { domain_id: domainId } : {}) }); }
}
