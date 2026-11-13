// Studio helper for Cloudflare Workers. Passes the Studio's requests to Cloudflare's, Resend's, Stripe's
// and Supabase's APIs (they don't accept calls from web pages). The user's keys travel with each request and are
// used only for it. Only Studios holding a key connected to this helper are answered.
//
//   GET  /         {service, v, claimed}
//   POST /claim    {key}           the first Studio connects; later ones add {cf: <Cloudflare API token>} to prove
//                                  they manage the account this Worker runs on
//   POST /         {target, method, path, auth, body | body64, contentType} with header x-relay-key
export const HELPER_VERSION = 2;
const BASES = { cloudflare: "https://api.cloudflare.com/client/v4", resend: "https://api.resend.com", stripe: "https://api.stripe.com", supabase: "https://api.supabase.com" };
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const enc = new TextEncoder();
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const sha = async (s) => hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
const unb64 = (s) => Uint8Array.from(atob(String(s).replace(/\s/g, "")), (c) => c.charCodeAt(0));

const esc = (x) => String(x).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
/** The page shown when the helper's address is opened: a button that hands its address back to the Studio. */
const page = (studio, self) => `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Studio helper</title>
<style>body{font:16px/1.6 system-ui,sans-serif;max-width:560px;margin:12vh auto;padding:0 20px;color:#1d2433}a.b{display:inline-block;background:#4f6bff;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px;margin:8px 0}code{background:#eef1f6;padding:1px 5px;border-radius:4px}small{color:#667}</style>
<h1>Your Studio helper is ready</h1><p>It lets your Studio set up Cloudflare, Resend email, Stripe webhooks and Supabase for your sites, because those services don't accept requests straight from a web page. It keeps none of your keys.</p>
${studio ? `<p><a class="b" href="${esc(studio + "#helper=" + encodeURIComponent(self))}">Connect to my Studio →</a></p><p><small>Opens ${esc(studio)}. Using a Studio at another address? Paste <code>${esc(self)}</code> into its helper box instead.</small></p>` : `<p>Copy this address into your Studio's helper box: <code>${esc(self)}</code></p>`}`;

/** True when `token` can manage the Cloudflare account this Worker runs on (name.subdomain.workers.dev). */
async function ownsMe(token, host) {
  const m = /^([a-z0-9-]+)\.([a-z0-9-]+)\.workers\.dev$/i.exec(host);
  if (!m || !token) return false;
  const [, script, sub] = m;
  const cf = (p) => fetch(BASES.cloudflare + p, { headers: { Authorization: "Bearer " + token } }).then((r) => r.json()).catch(() => null);
  const accounts = (await cf("/accounts?per_page=50"))?.result || [];
  for (const a of accounts) {
    if ((await cf(`/accounts/${a.id}/workers/subdomain`))?.result?.subdomain?.toLowerCase() !== sub.toLowerCase()) continue;
    if ((await cf(`/accounts/${a.id}/workers/scripts/${script}/settings`))?.success) return true;
  }
  return false;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url), origin = req.headers.get("origin") || "";
    const cors = { "Access-Control-Allow-Origin": origin || "*", "Access-Control-Allow-Headers": "content-type, x-relay-key", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Max-Age": "600", Vary: "Origin" };
    const out = (code, body) => new Response(JSON.stringify(body), { status: code, headers: { ...cors, "Content-Type": "application/json" } });
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (!env.HELPER) return out(500, { error: "The helper's storage (the HELPER KV namespace) is missing. Deploy it again from the Studio." });
    const keys = (await env.HELPER.get("keys", "json")) || [];
    if (req.method === "GET") {
      if ((req.headers.get("accept") || "").includes("text/html")) {
        const studio = /^https:\/\/[^\s"'<>]+$/.test(String(env.STUDIO_URL || "")) ? String(env.STUDIO_URL).replace(/#.*$/, "") : "";
        return new Response(page(studio, url.origin), { headers: { "Content-Type": "text/html; charset=utf-8" } });
      }
      return out(200, { service: "site-studio-helper", v: HELPER_VERSION, claimed: keys.length > 0 });
    }
    if (req.method !== "POST") return out(405, { error: "Use POST." });
    let q;
    try { q = await req.json(); } catch { return out(400, { error: "Bad request." }); }

    if (url.pathname === "/claim") {
      const key = String(q.key || "");
      if (!/^[a-f0-9]{32,128}$/.test(key)) return out(400, { error: "Bad key." });
      const h = await sha(key);
      if (keys.includes(h)) return out(200, { ok: true, v: HELPER_VERSION });
      if (keys.length && !(await ownsMe(String(q.cf || ""), url.hostname))) return out(q.cf ? 403 : 409, { error: q.cf ? "That Cloudflare token can't manage the account this helper runs on." : "This helper is already connected to a Studio.", claimed: true });
      await env.HELPER.put("keys", JSON.stringify([...keys, h].slice(-20)));
      return out(200, { ok: true, v: HELPER_VERSION });
    }

    const k = req.headers.get("x-relay-key") || "";
    if (!k || !keys.includes(await sha(k))) return out(403, { error: "This helper only answers the Studio it's connected to." });
    if (q.target === "ping") return out(200, { ok: true, v: HELPER_VERSION });
    let target, method = String(q.method || "GET").toUpperCase();
    if (q.target === "worker") {
      if (!/^https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev\/(\?mailtest)?$/.test(String(q.url || ""))) return out(400, { error: "Only a workers.dev address can be checked." });
      target = q.url; method = "GET";
    } else {
      const base = BASES[q.target], path = String(q.path || "");
      if (!base || !/^\/[\w\-./?=&%:,]*$/.test(path) || path.includes("..")) return out(400, { error: "Not an allowed address." });
      if (!METHODS.includes(method)) return out(400, { error: "Not an allowed method." });
      target = base + path;
    }
    const headers = { "User-Agent": "site-studio-helper" };
    if (q.auth) headers.Authorization = "Bearer " + q.auth;
    if (q.contentType) headers["Content-Type"] = q.contentType;
    const body = method === "GET" ? undefined : q.body64 ? unb64(q.body64) : q.body != null ? String(q.body) : undefined;
    try {
      const r = await fetch(target, { method, headers, body });
      return out(200, { status: r.status, body: await r.text() });
    } catch {
      return out(502, { error: "Couldn't reach " + new URL(target).host + "." });
    }
  },
};
