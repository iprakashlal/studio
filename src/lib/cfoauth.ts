// "Connect Cloudflare": Cloudflare's own sign-in window (OAuth, with PKCE, no secret) in place of creating a token
// by hand. The sign-in is used in the open tab only and never written to the device. For the other devices the
// Studio makes its own long-lasting API token for just the allowed accounts and keeps it on the Studio's database
// (a secret on the owner's own Cloudflare).
import { CfError, type Cloudflare, type CfAccount } from "./cloudflare";

const AUTH = "https://dash.cloudflare.com/oauth2/auth", TOKEN = "https://dash.cloudflare.com/oauth2/token", REVOKE = "https://dash.cloudflare.com/oauth2/revoke";
const CFG = "studio-cf-oauth", BACK = "studio-cf-oauth-back";
/** Cloudflare's names for what the Studio needs (the same permissions as the pasted token). Editable in the set-up box. */
export const CF_OAUTH_SCOPES = "user-details.read account-settings.read workers:write d1.write workers-routes.write zone.read dns.write";
/** Earlier guesses at the names, which Cloudflare refuses: a list saved from one of these is replaced by the current one. */
const OLD_SCOPES = ["account-settings.read workers-scripts.write d1.write workers-routes.write zone.write dns.write api-tokens.write"];
export type CfOauthCfg = { client: string; scopes: string };
/** The connection kept when the Studio couldn't make its own token: renewed with `refresh` before `exp`. */
export type CfOauthKeep = { refresh: string; exp: number; client: string };
export type CfOauthGot = { access: string; refresh: string; exp: number };

const env = (k: string): string => { try { return String((import.meta as any).env?.[k] || ""); } catch { return ""; } };
export const cfOauthCfg = {
  /** The OAuth client this Studio uses (not a secret): saved on this device, else the one built in. */
  get(): CfOauthCfg {
    let s: any = null; try { s = JSON.parse(localStorage.getItem(CFG) || "null"); } catch { /* private mode */ }
    const saved = String(s?.scopes || "").trim().replace(/[\s,]+/g, " ");
    return { client: String(s?.client || env("VITE_CF_OAUTH_CLIENT")).trim(), scopes: (saved && !OLD_SCOPES.includes(saved) ? saved : String(env("VITE_CF_OAUTH_SCOPES") || CF_OAUTH_SCOPES)).trim().replace(/[\s,]+/g, " ") };
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
      // Cloudflare's pages cut the link to the window that opened them, so from here the window can look closed while
      // it is still open: wait for its answer (or Cancel, or ten minutes) and never judge by `win.closed`.
      const started = Date.now();
      const t = setInterval(() => { read(); if (Date.now() - started > 10 * 60000) { end(); rej(new Error("No answer came back from Cloudflare in ten minutes. Nothing was changed; press Connect Cloudflare to try again.")); } }, 500);
      const end = () => { clearInterval(t); removeEventListener("storage", on); try { localStorage.removeItem(BACK); } catch { /* private mode */ } };
      stop = () => { end(); try { win.close(); } catch { /* gone */ } rej(new Error("Cancelled. Nothing was changed.")); };
      addEventListener("storage", on);
    });
    try { win.close(); } catch { /* gone */ }
    if (back.error || !back.code) {
      if (back.error === "invalid_scope") throw new Error(`Cloudflare says this OAuth client isn't allowed one of the permissions the Studio asked for (${cfg.scopes}). Tick them on the client in Cloudflare, or correct the list under “Set up one-click connect”.`);
      if (back.error === "unsupported_response_type" || /response_type/i.test(back.text || "")) throw new Error("This OAuth client isn't set to the “Code” response type, which the sign-in needs. Run “Let the Studio set it up” again (it makes a client with the right settings), or open the client in Cloudflare and set Response type: Code and Grant type: Authorization code.");
      if (back.error === "unauthorized_client" || /grant/i.test(back.error || "")) throw new Error(`This OAuth client isn't allowed the authorization-code sign-in (${back.text || back.error}). Run “Let the Studio set it up” again, or set Grant type: Authorization code (and Refresh token) on the client in Cloudflare.`);
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
/** Makes the Studio's own long-lasting API token for these accounts (the same permissions as a pasted one): one
 *  token of the person's for all of them, else one owned by each account. Returns account id → token; null when
 *  Cloudflare doesn't allow making any, or a new token doesn't work (`test`). */
export async function cfOauthMint(cf: Cloudflare, accounts: CfAccount[], test: (token: string) => Promise<boolean>): Promise<Record<string, string> | null> {
  const policiesFor = (groups: { id: string; name: string; scopes?: string[] }[], accs: CfAccount[]) => {
    const found = WANT.map((re) => groups.find((g) => re.test(g.name)));
    if (!found[0] || !found[1] || !found[2]) return null;
    const has = (g: { scopes?: string[] }, sc: string) => (g.scopes || []).includes(sc);
    const acct = found.filter((g) => g && has(g, "com.cloudflare.api.account")), zone = found.filter((g) => g && !has(g, "com.cloudflare.api.account") && has(g, "com.cloudflare.api.account.zone"));
    return [{ effect: "allow", resources: Object.fromEntries(accs.map((a) => ["com.cloudflare.api.account." + a.id, "*"])), permission_groups: acct.map((g) => ({ id: g!.id })) },
      ...(zone.length ? [{ effect: "allow", resources: Object.fromEntries(accs.map((a) => ["com.cloudflare.api.account." + a.id, { "com.cloudflare.api.account.zone.*": "*" }])), permission_groups: zone.map((g) => ({ id: g!.id })) }] : [])];
  };
  try {
    const policies = policiesFor(await cf.permissionGroups(), accounts);
    const t = policies ? await cf.createToken({ name: "Picaffectz Studio", policies }) : null;
    if (t?.value && (await test(t.value))) return Object.fromEntries(accounts.map((a) => [a.id, t.value!]));
  } catch { /* not allowed to make the person's own tokens: try the accounts' */ }
  const out: Record<string, string> = {};
  for (const a of accounts) {
    try {
      const policies = policiesFor(await cf.accountPermissionGroups(a.id), [a]);
      const t = policies ? await cf.createAccountToken(a.id, { name: "Picaffectz Studio", policies }) : null;
      if (t?.value && (await test(t.value))) out[a.id] = t.value;
    } catch { /* not allowed on this account */ }
  }
  return Object.keys(out).length ? out : null;
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

// ---------------------------------------------------------------- setting the client up (once, by the Studio's owner)
/** Cloudflare's token page with the one permission the set-up needs (managing OAuth clients) asked for. */
export const CF_OAUTH_SETUP_TOKEN_PAGE = `https://dash.cloudflare.com/profile/api-tokens?${new URLSearchParams({ permissionGroupKeys: JSON.stringify([{ key: "oauth_client", type: "edit" }, { key: "account_settings", type: "read" }]), accountId: "*", name: "Picaffectz Studio set-up (delete after use)" })}`;
export const CF_OAUTH_CLIENT_NAME = "Picaffectz Studio";
/** What the Studio needs, as the names Cloudflare may use for each (the first one its list has is taken), then by
 *  the permission's plain name. `must`: the sign-in is no use without it. */
const NEEDS: { what: string; ids: string[]; name: RegExp; must?: boolean }[] = [
  { what: "User Details (read)", ids: ["user-details.read", "user.read"], name: /^user details read$/i },
  { what: "Account Settings (read)", ids: ["account-settings.read", "account.read"], name: /^account settings read$/i, must: true },
  { what: "Workers (write)", ids: ["workers:write", "workers-scripts.write", "workers.write"], name: /^workers scripts? (write|edit)$/i, must: true },
  { what: "D1 (write)", ids: ["d1.write"], name: /^d1 (write|edit)$/i, must: true },
  { what: "Workers Routes (write)", ids: ["workers-routes.write"], name: /^workers routes (write|edit)$/i },
  { what: "Zone (read)", ids: ["zone.read"], name: /^zone read$/i },
  { what: "DNS (write)", ids: ["dns.write", "dns-records.write"], name: /^dns (write|edit)$/i },
  { what: "API Tokens (write)", ids: ["api-tokens.write", "user-api-tokens.write", "account-api-tokens.write"], name: /^(user |account )?api tokens (write|edit)$/i },
];
const PROTOCOL = ["openid", "offline", "offline_access"];
/** Creates the Studio's OAuth client on `account` with a token that may manage OAuth clients (used now, not kept),
 *  or finds the one already there. The permissions are taken from Cloudflare's own list, so what the Studio asks for
 *  at sign-in is exactly what the client has. */
export async function cfOauthSetup(cf: Cloudflare, account: CfAccount): Promise<{ cfg: CfOauthCfg; made: boolean; left: string[]; visibility: string; txt: string }> {
  const redirect = cfOauthRedirect(), origin = location.origin;
  const denied = (e: any) => e instanceof CfError && (e.status === 401 || e.status === 403);
  let list: Awaited<ReturnType<Cloudflare["oauthClients"]>>;
  try { list = (await cf.oauthClients(account.id)) || []; }
  catch (e: any) { throw new Error(denied(e) ? `That token can't manage OAuth clients on ${account.name}. Create it from the link (permission: Account → OAuth Client → Edit) while signed in to that account, and paste it again.` : e?.message || "Couldn't reach Cloudflare."); }
  // A client is only reused when the sign-in can work with it: the Studio's return page, no secret, and the "code"
  // response type with the authorization-code grant. One made by hand with other choices is left alone.
  const usable = (c: { response_types?: string[]; grant_types?: string[] }) => (!c.response_types || c.response_types.includes("code")) && (!c.grant_types || c.grant_types.includes("authorization_code"));
  const mine = list.find((c) => (c.redirect_uris || []).includes(redirect) && (!c.token_endpoint_auth_method || c.token_endpoint_auth_method === "none") && usable(c));
  if (mine) {
    const scopes = (mine.scopes || []).filter((x) => !PROTOCOL.includes(x));
    if (!scopes.length) throw new Error("The OAuth client already on this account has no permissions. Delete it in Cloudflare (Manage Account → OAuth clients) and press Set it up again.");
    return { cfg: { client: mine.client_id, scopes: scopes.join(" ") }, made: false, left: [], visibility: mine.visibility || "private", txt: mine.client_uri_verification?.text || "" };
  }
  // Cloudflare's own names for the permissions; without its list, the names known to work.
  let catalog: { id: string; name: string }[] | null = null;
  try { catalog = await cf.oauthScopes(); } catch { catalog = null; }
  const picked: string[] = [], left: string[] = [];
  if (catalog?.length) {
    for (const n of NEEDS) {
      const id = n.ids.find((x) => catalog!.some((c) => c.id === x)) || catalog.find((c) => n.name.test(String(c.name || "").trim()))?.id;
      if (id) picked.push(id); else if (n.must) throw new Error(`Cloudflare's list of permissions for OAuth clients has none for ${n.what}, which the Studio can't work without. Nothing was created.`); else left.push(n.what);
    }
  } else picked.push(...CF_OAUTH_SCOPES.split(" "));
  const body = { client_name: CF_OAUTH_CLIENT_NAME, grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], redirect_uris: [redirect], allowed_cors_origins: [origin], scopes: picked, token_endpoint_auth_method: "none" };
  let made: Awaited<ReturnType<Cloudflare["createOauthClient"]>>;
  try {
    // With the Studio's address on it, the client can later be made public (after Cloudflare's domain check).
    try { made = await cf.createOauthClient(account.id, { ...body, client_uri: origin }); }
    catch (e: any) { if (denied(e)) throw e; made = await cf.createOauthClient(account.id, body); }
  } catch (e: any) { throw new Error(denied(e) ? `That token can read OAuth clients on ${account.name} but can't create one. Give it Account → OAuth Client → Edit and paste it again.` : e?.message || "Cloudflare didn't create the client."); }
  if (!made?.client_id) throw new Error("Cloudflare didn't give back a client ID. Check Manage Account → OAuth clients, and paste its Client ID by hand.");
  // Cloudflare kept other choices than the ones sent: put them right, or say what to change.
  if (!usable(made)) {
    try { made = { ...made, ...(await cf.updateOauthClient(account.id, made.client_id, { response_types: ["code"], grant_types: ["authorization_code", "refresh_token"] })) }; } catch { /* said below */ }
    if (!usable(made)) throw new Error(`The client was created (${CF_OAUTH_CLIENT_NAME}) but Cloudflare didn't set its response type to Code. Open it in Cloudflare (Manage Account → OAuth clients), set Response type: Code and Grant type: Authorization code, then paste its Client ID below.`);
  }
  const scopes = ((made.scopes || []).filter((x) => !PROTOCOL.includes(x)).length ? (made.scopes || []).filter((x) => !PROTOCOL.includes(x)) : picked).join(" ");
  return { cfg: { client: made.client_id, scopes }, made: true, left, visibility: made.visibility || "private", txt: made.client_uri_verification?.text || "" };
}
