// "Connect Cloudflare": Cloudflare's own sign-in window (OAuth, with PKCE, no secret) in place of creating a token
// by hand. The sign-in is used in the open tab only and never written to the device. For the other devices the
// Studio makes its own long-lasting API token for just the allowed accounts and keeps it on the Studio's database
// (a secret on the owner's own Cloudflare).
import type { Cloudflare, CfAccount } from "./cloudflare";

const AUTH = "https://dash.cloudflare.com/oauth2/auth", TOKEN = "https://dash.cloudflare.com/oauth2/token", REVOKE = "https://dash.cloudflare.com/oauth2/revoke";
const CFG = "studio-cf-oauth", BACK = "studio-cf-oauth-back";
/** Cloudflare's names for what the Studio needs (the same permissions as the pasted token). Editable in the set-up box. */
export const CF_OAUTH_SCOPES = "account-settings.read workers-scripts.write d1.write workers-routes.write zone.write dns.write api-tokens.write";
export type CfOauthCfg = { client: string; scopes: string };
/** The connection kept when the Studio couldn't make its own token: renewed with `refresh` before `exp`. */
export type CfOauthKeep = { refresh: string; exp: number; client: string };
export type CfOauthGot = { access: string; refresh: string; exp: number };

const env = (k: string): string => { try { return String((import.meta as any).env?.[k] || ""); } catch { return ""; } };
export const cfOauthCfg = {
  /** The OAuth client this Studio uses (not a secret): saved on this device, else the one built in. */
  get(): CfOauthCfg {
    let s: any = null; try { s = JSON.parse(localStorage.getItem(CFG) || "null"); } catch { /* private mode */ }
    return { client: String(s?.client || env("VITE_CF_OAUTH_CLIENT")).trim(), scopes: String(s?.scopes || env("VITE_CF_OAUTH_SCOPES") || CF_OAUTH_SCOPES).trim().replace(/[\s,]+/g, " ") };
  },
  set(c: CfOauthCfg) { try { localStorage.setItem(CFG, JSON.stringify({ client: c.client.trim(), scopes: c.scopes.trim().replace(/[\s,]+/g, " ") })); } catch { /* private mode */ } },
};
/** Where Cloudflare sends the person back: a small page of the Studio that hands the answer to this tab. */
export const cfOauthRedirect = (): string => { const u = new URL("cf-connect.html", document.baseURI); u.search = ""; u.hash = ""; return u.href; };

const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const rand = (n: number) => b64u(crypto.getRandomValues(new Uint8Array(n)));

async function tokenCall(body: Record<string, string>): Promise<CfOauthGot> {
  let r: Response;
  try { r = await fetch(TOKEN, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body: new URLSearchParams(body).toString() }); }
  catch { throw new Error(`Cloudflare didn't let this page finish the sign-in. In Cloudflare, open the OAuth client and add ${location.origin} under Allowed CORS origins, then press Connect Cloudflare again.`); }
  const j: any = await r.json().catch(() => null);
  if (!r.ok || !j?.access_token) throw new Error(`Cloudflare didn't complete the sign-in${j?.error_description || j?.error ? `: ${j.error_description || j.error}` : ` (${r.status})`}.`);
  return { access: j.access_token, refresh: j.refresh_token || "", exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
}

/** Opens Cloudflare's sign-in window. Call it straight from the click (browsers block windows opened later). */
export function cfOauthOpen(cfg: CfOauthCfg): { done: Promise<CfOauthGot>; cancel: () => void } {
  if (!cfg.client) throw new Error("Add the OAuth client ID first (Set up one-click connect).");
  const win = window.open("", "cf-connect", "popup,width=560,height=760");
  if (!win) throw new Error("Your browser blocked the Cloudflare window. Allow pop-ups for this page and press Connect Cloudflare again.");
  const state = rand(18), verifier = rand(48), redirect = cfOauthRedirect();
  try { localStorage.removeItem(BACK); } catch { /* private mode */ }
  let stop = () => {};
  const done = (async (): Promise<CfOauthGot> => {
    const challenge = b64u(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
    const scope = ["offline_access", ...cfg.scopes.split(" ").filter((s) => s && s !== "offline_access")].join(" ");
    win.location.href = AUTH + "?" + new URLSearchParams({ response_type: "code", client_id: cfg.client, redirect_uri: redirect, scope, state, code_challenge: challenge, code_challenge_method: "S256" });
    const back = await new Promise<{ code?: string; error?: string; text?: string }>((res, rej) => {
      const read = () => { try { const j = JSON.parse(localStorage.getItem(BACK) || "null"); if (j?.state === state) { end(); res(j); } } catch { /* not ours */ } };
      const on = (e: StorageEvent) => { if (e.key === BACK) read(); };
      const t = setInterval(() => { read(); if (win.closed) setTimeout(() => { read(); end(); rej(new Error("The Cloudflare window was closed before it finished. Nothing was changed.")); }, 600); }, 500);
      const end = () => { clearInterval(t); removeEventListener("storage", on); try { localStorage.removeItem(BACK); } catch { /* private mode */ } };
      stop = () => { end(); try { win.close(); } catch { /* gone */ } rej(new Error("Cancelled. Nothing was changed.")); };
      addEventListener("storage", on);
    });
    try { win.close(); } catch { /* gone */ }
    if (back.error || !back.code) {
      if (back.error === "invalid_scope") throw new Error(`Cloudflare says this OAuth client isn't allowed one of the permissions the Studio asked for (${cfg.scopes}). Tick them on the client in Cloudflare, or correct the list under “Set up one-click connect”.`);
      if (back.error === "access_denied") throw new Error("You didn't allow it on Cloudflare. Nothing was changed.");
      throw new Error(`Cloudflare didn't complete the sign-in: ${back.text || back.error || "no code came back"}.`);
    }
    return tokenCall({ grant_type: "authorization_code", code: back.code, redirect_uri: redirect, client_id: cfg.client, code_verifier: verifier });
  })();
  return { done, cancel: () => stop() };
}

export const cfOauthRefresh = (k: CfOauthKeep) => tokenCall({ grant_type: "refresh_token", refresh_token: k.refresh, client_id: k.client });
/** Ends the sign-in at Cloudflare once the Studio has its own token (best effort). */
export async function cfOauthRevoke(client: string, token: string) {
  if (!token) return;
  try { await fetch(REVOKE, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token, client_id: client }).toString() }); } catch { /* it expires by itself */ }
}

const WANT = [/^workers scripts (write|edit)$/i, /^d1 (write|edit)$/i, /^account settings read$/i, /^workers routes (write|edit)$/i, /^zone (write|edit)$/i, /^dns (write|edit)$/i];
/** Makes the Studio's own long-lasting API token for just these accounts (the same permissions as a pasted one).
 *  null when Cloudflare doesn't allow making one, or the new token doesn't work (`test`). */
export async function cfOauthMint(cf: Cloudflare, accounts: CfAccount[], test: (token: string) => Promise<boolean>): Promise<string | null> {
  try {
    const groups = await cf.permissionGroups(), found = WANT.map((re) => groups.find((g) => re.test(g.name)));
    if (!found[0] || !found[1] || !found[2]) return null;
    const has = (g: { scopes?: string[] }, sc: string) => (g.scopes || []).includes(sc);
    const acct = found.filter((g) => g && has(g, "com.cloudflare.api.account")), zone = found.filter((g) => g && !has(g, "com.cloudflare.api.account") && has(g, "com.cloudflare.api.account.zone"));
    const policies = [{ effect: "allow", resources: Object.fromEntries(accounts.map((a) => ["com.cloudflare.api.account." + a.id, "*"])), permission_groups: acct.map((g) => ({ id: g!.id })) },
      ...(zone.length ? [{ effect: "allow", resources: Object.fromEntries(accounts.map((a) => ["com.cloudflare.api.account." + a.id, { "com.cloudflare.api.account.zone.*": "*" }])), permission_groups: zone.map((g) => ({ id: g!.id })) }] : [])];
    const t = await cf.createToken({ name: "Picaffectz Studio", policies });
    return t?.value && (await test(t.value)) ? t.value : null;
  } catch { return null; }
}

/** The sign-in in use in this tab (never written to the device), shared by every Cloudflare box on the page. */
export const cfMem: { cur: { token: string; accounts: CfAccount[] } | null } = { cur: null };

type Kept = { token: string; oauth?: CfOauthKeep; more?: { token: string; oauth?: CfOauthKeep }[] };
/** Renews any kept sign-in that is about to run out. Returns the same object (changed in place) and whether to save it. */
export async function cfOauthFreshen<T extends Kept>(v: T): Promise<boolean> {
  let changed = false;
  for (const e of [v, ...(v.more || [])] as { token: string; oauth?: CfOauthKeep }[]) {
    if (!e.oauth || e.oauth.exp - Date.now() > 5 * 60000) continue;
    try { const g = await cfOauthRefresh(e.oauth); e.token = g.access; e.oauth = { ...e.oauth, refresh: g.refresh || e.oauth.refresh, exp: g.exp }; changed = true; } catch { /* shown as "connect again" when the token is refused */ }
  }
  return changed;
}
