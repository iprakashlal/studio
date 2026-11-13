// Supabase's Management API through the Studio's helper (it doesn't accept calls from web pages): list or
// create a project, read its public key, run the setup SQL and turn on 6-digit sign-in codes. The access token
// is kept encrypted on this device only.
import { relayCall, type Relay } from "./relay";
import { vault } from "./vault";

export const SB_TOKENS_PAGE = "https://supabase.com/dashboard/account/tokens";
export const sbMgmtVault = vault<{ token: string }>("supabase");
export type SbProject = { id: string; ref?: string; name: string; status: string; region: string; organization_id?: string; organization_slug?: string };
export type SbOrg = { id: string; slug?: string; name: string };

/** The sign-in email: a 6-digit code (the CMS asks for the code instead of following a link). */
export const CODE_EMAIL = `<h2>Your sign-in code</h2>
<p>Enter this code on the page you're signing in to:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:6px">{{ .Token }}</p>
<p>It works for one hour. If you didn't ask for it, you can ignore this email.</p>`;

export class SbMgmtError extends Error { constructor(msg: string, public status = 0) { super(msg); } }

export class SupaMgmt {
  constructor(private relay: Relay, private token: string) {}
  private async api<T = any>(method: string, path: string, json?: unknown): Promise<T> {
    const r = await relayCall(this.relay, { target: "supabase", method, path, auth: this.token, ...(json !== undefined ? { body: JSON.stringify(json), contentType: "application/json" } : {}) });
    let j: any = null; try { j = r.body ? JSON.parse(r.body) : null; } catch { /* not JSON */ }
    if (r.status === 401) throw new SbMgmtError("Supabase refused the access token. Create a new one and paste it again.", 401);
    if (r.status >= 400) throw new SbMgmtError("Supabase: " + (j?.message || j?.error || r.body?.slice(0, 200) || r.status), r.status);
    return j as T;
  }
  projects() { return this.api<SbProject[]>("GET", "/v1/projects"); }
  orgs() { return this.api<SbOrg[]>("GET", "/v1/organizations"); }
  project(ref: string) { return this.api<SbProject>("GET", `/v1/projects/${ref}`); }
  createProject(name: string, org: SbOrg, region: "americas" | "emea" | "apac") {
    const pass = [...crypto.getRandomValues(new Uint8Array(18))].map((b) => b.toString(36).padStart(2, "0")).join("") + "Aa1!";
    return this.api<SbProject>("POST", "/v1/projects", { name, ...(org.slug ? { organization_slug: org.slug } : { organization_id: org.id }), db_pass: pass, region_selection: { type: "smartGroup", code: region } });
  }
  /** Waits until a new (or restarting) project answers. */
  async waitReady(ref: string, step?: (s: string) => void) {
    for (let i = 0; i < 90; i++) {
      const p = await this.project(ref).catch(() => null);
      if (p?.status === "ACTIVE_HEALTHY") return;
      if (p?.status && /PAUSED|INACTIVE/.test(p.status)) throw new SbMgmtError("This project is paused. Restore it in the Supabase dashboard, then try again.");
      step?.(`Waiting for Supabase to start the project (${p?.status?.toLowerCase().replace(/_/g, " ") || "starting"})`);
      await new Promise((r) => setTimeout(r, 4000));
    }
    throw new SbMgmtError("The project is taking long to start. Wait a minute and press Set up again.");
  }
  /** The key a website uses: the legacy anon key when the project has it, else the publishable key. */
  async publicKey(ref: string): Promise<string> {
    const keys = await this.api<{ name?: string; type?: string; api_key?: string }[]>("GET", `/v1/projects/${ref}/api-keys?reveal=true`);
    const anon = keys.find((k) => k.name === "anon" && k.api_key), pub = keys.find((k) => k.type === "publishable" && k.api_key);
    const k = anon?.api_key || pub?.api_key;
    if (!k) throw new SbMgmtError("Couldn't find the project's public key.");
    return k;
  }
  sql(ref: string, query: string) { return this.api("POST", `/v1/projects/${ref}/database/query`, { query }); }
  codeEmails(ref: string) { return this.api("PATCH", `/v1/projects/${ref}/config/auth`, { mailer_subjects_magic_link: "Your sign-in code", mailer_templates_magic_link_content: CODE_EMAIL }); }
}

export const refOf = (p: SbProject) => p.ref || p.id;
