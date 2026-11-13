// The Studio's setup helper: a tiny Netlify function on the user's own Netlify account that passes the Studio's
// requests on to Cloudflare's, Resend's and Stripe's APIs, which don't accept calls from web pages (CORS). It stores
// nothing: the user's keys travel with each request and are used only for that request. It answers only the
// Studio (its address and a random key made when it's set up), and only for those APIs (and Stripe's, to add
// the shop's webhook) plus GET checks of
// the user's own *.workers.dev Workers.
import { Netlify } from "./netlify";
import { vault } from "./vault";
import { zip } from "./zip";

export const RELAY_VERSION = 4;
const FN = "studio-relay";
/** The helper: a Netlify function (siteId is the Netlify site) or a Worker on the user's Cloudflare (kind "cloudflare"). */
export type Relay = { kind?: "netlify" | "cloudflare"; siteId: string; url: string; key: string; v: number };
export const relayVault = vault<Relay>("relay");

/** The function's code (Netlify Functions, Node 18+: fetch is built in). */
export function relaySource(key: string, origins: string[]): string {
  return `// Site Studio setup helper (v${RELAY_VERSION}). Passes the Studio's requests to Cloudflare, Resend, Stripe and Supabase. Stores nothing.
const KEY = ${JSON.stringify(key)};
const ORIGINS = ${JSON.stringify(origins)};
const BASES = { cloudflare: "https://api.cloudflare.com/client/v4", resend: "https://api.resend.com", stripe: "https://api.stripe.com", supabase: "https://api.supabase.com" };
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
exports.handler = async (event) => {
  const h = Object.fromEntries(Object.entries(event.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
  const origin = h.origin || "";
  const cors = { "Access-Control-Allow-Origin": ORIGINS.includes(origin) ? origin : ORIGINS[0], "Access-Control-Allow-Headers": "content-type, x-relay-key", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" };
  const out = (code, body) => ({ statusCode: code, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };
  if (event.httpMethod !== "POST" || h["x-relay-key"] !== KEY || !ORIGINS.includes(origin)) return out(403, { error: "This helper only answers Site Studio." });
  let q;
  try { q = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body || "", "base64").toString("utf8") : event.body || "{}"); } catch (e) { return out(400, { error: "Bad request." }); }
  if (q.target === "ping") return out(200, { ok: true, v: ${RELAY_VERSION} });
  let url, method = String(q.method || "GET").toUpperCase();
  if (q.target === "worker") {
    if (!/^https:\\/\\/[a-z0-9-]+\\.[a-z0-9-]+\\.workers\\.dev\\/(\\?mailtest)?$/.test(String(q.url || ""))) return out(400, { error: "Only a workers.dev address can be checked." });
    url = q.url; method = "GET";
  } else {
    const base = BASES[q.target], path = String(q.path || "");
    if (!base || !/^\\/[\\w\\-./?=&%:,]*$/.test(path) || path.includes("..")) return out(400, { error: "Not an allowed address." });
    if (!METHODS.includes(method)) return out(400, { error: "Not an allowed method." });
    url = base + path;
  }
  const headers = { "User-Agent": "site-studio-helper" };
  if (q.auth) headers.Authorization = "Bearer " + q.auth;
  if (q.contentType) headers["Content-Type"] = q.contentType;
  const body = method === "GET" ? undefined : q.body64 ? Buffer.from(q.body64, "base64") : q.body != null ? String(q.body) : undefined;
  try {
    const r = await fetch(url, { method, headers, body });
    return out(200, { status: r.status, body: await r.text() });
  } catch (e) {
    return out(502, { error: "Couldn't reach " + new URL(url).host + "." });
  }
};
`;
}

const PAGE = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Site Studio helper</title>
<style>body{font:16px/1.6 system-ui,sans-serif;max-width:560px;margin:12vh auto;padding:0 20px;color:#1d2433}code{background:#eef1f6;padding:1px 5px;border-radius:4px}</style>
<h1>Site Studio helper</h1><p>This small site lets Site Studio set up Cloudflare Workers, Resend email, Stripe webhooks and Supabase projects for your sites, because those services don't accept requests straight from a web page.</p>
<p>It keeps no keys or data: each request carries what it needs and is passed on once. It only answers Site Studio. You can delete this site in Netlify at any time; the Studio offers to set it up again when needed.</p>`;

const rand = (n: number) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, "0")).join("");

/** Creates (or updates) the helper site on the user's Netlify account and checks it answers. */
export async function setupRelay(nf: Netlify, studioToken: string, existing?: Relay | null, step?: (s: string) => void): Promise<Relay> {
  const key = existing?.key || rand(24);
  let siteId = existing?.siteId || "", url = existing?.url || "";
  if (siteId) { try { const s = await nf.getSite(siteId); url = s.ssl_url || s.url; } catch { siteId = ""; } }
  if (!siteId) {
    step?.("Creating the helper site on Netlify");
    for (let i = 0; i < 4 && !siteId; i++) {
      try { const s = await nf.createSite("studio-helper-" + rand(3)); siteId = s.id; url = s.ssl_url || s.url; } catch (e: any) { if (e?.status !== 422 || i === 3) throw e; }
    }
  }
  step?.("Uploading the helper");
  const enc = new TextEncoder();
  // Sent as source for Netlify to build: Netlify's direct function upload doesn't accept requests from web pages.
  const src = zip([
    { name: "index.html", data: enc.encode(PAGE) },
    { name: "netlify.toml", data: enc.encode(`[build]\n  publish = "."\n  command = ""\n\n[functions]\n  directory = "netlify/functions"\n  node_bundler = "esbuild"\n`) },
    { name: `netlify/functions/${FN}.js`, data: enc.encode(relaySource(key, [location.origin])) },
  ]);
  await nf.build(siteId, src, `Site Studio helper v${RELAY_VERSION}`, step);
  const relay: Relay = { kind: "netlify", siteId, url: url.replace(/^http:/, "https:").replace(/\/?$/, "/"), key, v: RELAY_VERSION };
  step?.("Checking the helper answers");
  let lastErr: any;
  for (let i = 0; i < 8; i++) {
    try { await relayCall(relay, { target: "ping" }); lastErr = null; break; } catch (e) { lastErr = e; await new Promise((r) => setTimeout(r, 1500)); }
  }
  if (lastErr) throw new Error("The helper was uploaded but doesn't answer yet. Wait a minute and press Set up the helper again.");
  await relayVault.save(relay, studioToken);
  return relay;
}

export class RelayError extends Error { constructor(msg: string, public status = 0) { super(msg); } }

/** One request through the helper. Returns the upstream status and body text. */
export async function relayCall(relay: Relay, q: { target: "ping" | "cloudflare" | "resend" | "stripe" | "supabase" | "worker"; method?: string; path?: string; url?: string; auth?: string; body?: string; body64?: string; contentType?: string }): Promise<{ status: number; body: string }> {
  let r: Response;
  try { r = await fetch(relayEndpoint(relay), { method: "POST", headers: { "Content-Type": "application/json", "x-relay-key": relay.key }, body: JSON.stringify(q) }); }
  catch { throw new RelayError(`Couldn't reach the Studio's helper on ${relay.kind === "cloudflare" ? "Cloudflare" : "Netlify"}. Check your connection, or set the helper up again.`); }
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new RelayError(j?.error || `The helper answered ${r.status}.`, r.status);
  return q.target === "ping" ? { status: 200, body: "" } : j;
}

export const relayEndpoint = (r: Relay) => (r.kind === "cloudflare" ? r.url : r.url + ".netlify/functions/" + FN);
/** A helper this Studio build can use as it is (a Netlify helper is rebuilt when the Studio's code changes). */
export const helperOk = (r: Relay | null | undefined): boolean => !!r && (r.kind === "cloudflare" || r.v === RELAY_VERSION);

// ---------------------------------------------------------------- the helper on Cloudflare
/** "Deploy to Cloudflare": copies the helper (deploy/cloudflare-helper in the Studio's repository) to the user's account. */
export const CF_HELPER_DEPLOY = "https://deploy.workers.cloudflare.com/?url=https://github.com/iprakashlal/studio/tree/main/deploy/cloudflare-helper";
export const cleanHelperUrl = (u: string) => {
  const m = /^(?:https?:\/\/)?([a-z0-9-]+\.[a-z0-9-]+\.workers\.dev)\/?$/i.exec(String(u || "").trim());
  return m ? `https://${m[1].toLowerCase()}/` : null;
};
export class HelperClaimed extends Error { constructor() { super("This helper is already connected to a Studio. Paste your Cloudflare API token too, and press Connect again: it proves the helper is on your account."); } }

/** Connects this Studio (on this device) to the helper Worker the user deployed. With `cfToken`, joins a helper
 *  another Studio or device connected first. */
export async function connectCfHelper(address: string, studioToken: string, cfToken?: string): Promise<Relay> {
  const url = cleanHelperUrl(address);
  if (!url) throw new RelayError("Paste the Worker's address, like https://picaffectz-helper.yourname.workers.dev");
  let info: any = null;
  try { info = await (await fetch(url, { cache: "no-store", headers: { Accept: "application/json" } })).json(); } catch { /* below */ }
  if (info?.service !== "site-studio-helper") throw new RelayError("That address doesn't answer as the Studio's helper. Check it, or wait a minute if Cloudflare is still deploying it.");
  const prev = await relayVault.load(studioToken);
  const key = prev?.kind === "cloudflare" && prev.url === url ? prev.key : rand(24);
  const r = await fetch(url + "claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, ...(cfToken ? { cf: cfToken } : {}) }) });
  const j = await r.json().catch(() => null);
  if (r.status === 409) throw new HelperClaimed();
  if (!r.ok) throw new RelayError(j?.error || `The helper answered ${r.status}.`, r.status);
  const relay: Relay = { kind: "cloudflare", siteId: url.replace(/^https:\/\/|\/$/g, ""), url, key, v: j?.v || 1 };
  await relayCall(relay, { target: "ping" });
  await relayVault.save(relay, studioToken);
  return relay;
}

export class HelperMissing extends Error { constructor(what = "Cloudflare") { super(`Set up the Studio's helper first (it talks to ${what} for you): Deploy it to Cloudflare, or connect Netlify.`); } }
/** The helper to use: the one on this device, else (re)built on Netlify when Netlify is connected. */
export async function getHelper(studioToken: string, nf: Netlify | null | undefined, step?: (s: string) => void, what?: string): Promise<Relay> {
  const r = await relayVault.load(studioToken);
  if (helperOk(r)) return r!;
  if (nf && (!r || r.kind !== "cloudflare")) return setupRelay(nf, studioToken, r, step);
  throw new HelperMissing(what);
}

/** Bytes → base64 for request bodies sent through the helper. */
export function b64(bytes: Uint8Array): string { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); }
