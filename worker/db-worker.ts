// Site Studio database on Cloudflare: one Worker with a D1 database, for Studios (and their client Studios) and
// sites hosted outside GitHub. It keeps files (JSON and photos, in chunks), who may use what (members), sign-in
// codes (emailed through Resend) and enquiries. Set up and updated from the Studio; don't edit by hand.
//
// Scopes: "studio:<id>" for a Studio's files, "site:<id>" for a hosted site. Members have a role per scope:
// owner, member or partner. Owners and partners can add and remove members.
//
// env: DB (D1), SECRET (signs sessions and codes), RESEND_API_KEY, MAIL_FROM, NAME (shown in emails),
// CF_TOKEN + CF_ACCOUNT (optional: lets any signed-in owner publish their sites from any device, see /cf),
// GH_TOKEN (optional: the same for GitHub Pages sites, see /gh), AI (Workers AI: writes site text, see /ai/write).

type Env = { DB: any; SECRET: string; RESEND_API_KEY?: string; MAIL_FROM?: string; NAME?: string; CF_TOKEN?: string; CF_ACCOUNT?: string; GH_TOKEN?: string; AI?: any };
const V = CFDB_VERSION;
const CHUNK = 900_000;
const enc = new TextEncoder();
// Other Cloudflare accounts kept here (secrets CFX_<account id> = {"t": token, "n": name}), for sites hosted on them.
function otherToken(env: any, account: string): string {
  if (!/^[\w-]{1,64}$/.test(account)) return "";
  try { return String(JSON.parse(env["CFX_" + account.replace(/-/g, "_")] || "null")?.t || ""); } catch { return ""; }
}
function otherAccounts(env: any): { id: string; name: string }[] {
  const out: { id: string; name: string }[] = [];
  for (const k of Object.keys(env)) if (k.startsWith("CFX_")) { try { const j = JSON.parse(env[k]); if (j?.t) out.push({ id: k.slice(4), name: String(j.n || "").slice(0, 80) }); } catch { /* not ours */ } }
  return out;
}

import { CFDB_SCHEMA, CFDB_VERSION, CFDB_WORKER_NAME } from "../src/lib/cfdbSchema";
import { digestPage, sheetLinks } from "../src/lib/lookdigest";
import { socialFromText } from "../src/lib/social";
export const SCHEMA = CFDB_SCHEMA;

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, x-sha", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Max-Age": "86400", "Access-Control-Expose-Headers": "x-sha, x-updated" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });
const err = (status: number, error: string) => json({ error }, status);
const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
async function hmac(secret: string, data: string) {
  const k = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(data)));
}
const emailOk = (e: string) => /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(e);
const scopeOk = (s: string) => /^(studio|site):[a-z0-9][a-z0-9-]{0,59}$/.test(s);
const pathOk = (p: string) => !!p && p.length < 400 && !p.includes("..") && !p.startsWith("/") && /^[\w\-./ ()@+,]+$/.test(p);
const TYPES: Record<string, string> = { json: "application/json", html: "text/html; charset=utf-8", css: "text/css", js: "text/javascript", md: "text/markdown", txt: "text/plain", svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", avif: "image/avif", pdf: "application/pdf", ico: "image/x-icon", mp4: "video/mp4", webm: "video/webm" };
const typeOf = (p: string) => TYPES[(p.split(".").pop() || "").toLowerCase()] || "application/octet-stream";
// Hosted sites: what anyone may read without signing in.
const publicPath = (p: string) => p === "content.json" || p === "cms/site.json" || p.startsWith("assets/");

/** Session: base64url(json).sig, signed with SECRET, 30 days. */
async function sessionFor(env: Env, email: string) {
  const body = b64u(enc.encode(JSON.stringify({ e: email, x: Date.now() + 30 * 864e5 })));
  return body + "." + b64u(await hmac(env.SECRET, "s:" + body));
}
async function who(env: Env, req: Request): Promise<string | null> {
  const t = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const [body, sig] = t.split(".");
  if (!body || !sig) return null;
  if (b64u(await hmac(env.SECRET, "s:" + body)) !== sig) return null;
  try { const o = JSON.parse(new TextDecoder().decode(unb64u(body))); return o.x > Date.now() && emailOk(o.e) ? o.e : null; } catch { return null; }
}
const roleOf = async (env: Env, scope: string, email: string | null) => (email ? ((await env.DB.prepare("select role from members where scope = ? and email = ?").bind(scope, email).first()) as any)?.role || null : null);

async function readFile(env: Env, scope: string, path: string) {
  const f: any = await env.DB.prepare("select sha, size, parts, type, updated_at from files where scope = ? and path = ?").bind(scope, path).first();
  if (!f) return null;
  const rows = (await env.DB.prepare("select data from chunks where scope = ? and path = ? order by n").bind(scope, path).all()).results || [];
  const parts = rows.map((r: any) => new Uint8Array(r.data));
  const out = new Uint8Array(parts.reduce((a: number, b: Uint8Array) => a + b.length, 0));
  let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return { ...f, bytes: out };
}
async function sha1(b: Uint8Array) { return hex(await crypto.subtle.digest("SHA-1", b)); }
async function writeFile(env: Env, scope: string, path: string, bytes: Uint8Array, sha?: string) {
  const s = sha || "c" + (await sha1(bytes));
  const n = Math.max(1, Math.ceil(bytes.length / CHUNK));
  const st = [env.DB.prepare("delete from chunks where scope = ? and path = ?").bind(scope, path)];
  for (let i = 0; i < n; i++) st.push(env.DB.prepare("insert into chunks (scope, path, n, data) values (?, ?, ?, ?)").bind(scope, path, i, bytes.slice(i * CHUNK, (i + 1) * CHUNK)));
  st.push(env.DB.prepare("insert into files (scope, path, sha, size, parts, type, updated_at) values (?, ?, ?, ?, ?, ?, ?) on conflict (scope, path) do update set sha = excluded.sha, size = excluded.size, parts = excluded.parts, type = excluded.type, updated_at = excluded.updated_at")
    .bind(scope, path, s, bytes.length, n, typeOf(path), new Date().toISOString()));
  await env.DB.batch(st);
  return s;
}

async function sendMail(env: Env, to: string | string[], subject: string, html: string, replyTo?: string) {
  if (!env.RESEND_API_KEY || !env.MAIL_FROM) throw new Error("Email isn't set up on this database (Resend).");
  const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ from: env.MAIL_FROM, to: Array.isArray(to) ? to : [to], subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }) });
  if (!r.ok) throw new Error("Resend didn't accept the email (" + r.status + "): " + (await r.text()).slice(0, 200));
}

// ---------------------------------------------------------------- enquiry emails
const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;
const hesc = (x: string) => String(x).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]!));
const oneLine = (x: string) => String(x).replace(/[\r\n]+/g, " ").trim();
/** A site admin's template text with its {placeholders} filled in. */
const fill = (t: string, vars: Record<string, string>) => String(t).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
/** Template text → email HTML: escaped, a blank line starts a new paragraph, single line breaks are kept. */
const paras = (t: string, style = "margin:0 0 12px") => String(t).trim().split(/\n\s*\n/).filter((p) => p.trim()).map((p) => `<p style="${style}">${hesc(p.trim()).replace(/\n/g, "<br>")}</p>`).join("");
const WRAP = (inner: string) => `<div style="font:15px/1.55 system-ui,Segoe UI,Arial,sans-serif;color:#111;max-width:560px">${inner}</div>`;
async function siteContent(env: Env, site: string): Promise<any | null> {
  const f = await readFile(env, "site:" + site, "content.json"); if (!f) return null;
  try { return JSON.parse(new TextDecoder().decode(f.bytes)); } catch { return null; }
}
const siteName = (c: any, site: string) => oneLine(String(c?.brand?.name || c?.brand?.logoText || site));
/** Emails for a new enquiry, when the site's published content asks for them: a copy to the site's owner
 *  (contact.form.notify) and a thank-you to the visitor (emails.reply.on). Wording comes from the site's email
 *  templates (content.emails). Owner addresses come only from that content, never from the visitor's request; the
 *  visitor only ever gets the owner's own template; and a busy hour stops the emails (enquiries are still saved),
 *  so the form can't be used to send mail to strangers or to flood an inbox. */
/** Returns what happened to the owner's copy, in words for the Enquiries list ("" when it is switched off). */
async function notifyEnquiry(env: Env, site: string, data: Record<string, string>, page: string): Promise<string> {
  const c = await siteContent(env, site); if (!c) return "";
  const F = c?.contact?.form || {}, E = (c?.emails && typeof c.emails === "object" ? c.emails : {}) as any;
  // The owner's copy is on unless the owner switched it off (content saved before the switch existed counts as on).
  const wantOwner = F.notify === true || F.notifyAsk !== 1, wantReply = E.reply?.on === true && EMAIL_RE.test(data.email || "");
  if (!wantOwner && !wantReply) return "";
  if (!env.RESEND_API_KEY || !env.MAIL_FROM) return wantOwner ? "Not emailed: email (Resend) isn't set up on this site's database." : "";
  const since = new Date(Date.now() - 3600_000).toISOString();
  const n = await env.DB.prepare("select count(*) n from enquiries where site = ? and created_at > ?").bind(site, since).first<{ n: number }>();
  if ((n?.n || 0) > 40) return wantOwner ? "Not emailed: more than 40 enquiries in an hour, so emails are paused." : "";
  const name = siteName(c, site);
  const addrs = (x: unknown) => [...new Set(String(x || "").split(/[,;\s]+/).map((y) => y.trim().toLowerCase()).filter((y) => EMAIL_RE.test(y)))].slice(0, 3);
  let owners = addrs(F.notifyTo); if (!owners.length) owners = addrs(c?.contact?.email);
  // No address written anywhere: the site's own editors get it.
  if (!owners.length && wantOwner) owners = addrs((((await env.DB.prepare("select email from members where scope = ? order by role = 'owner' desc limit 3").bind("site:" + site).all()).results || []) as any[]).map((r) => r.email).join(","));
  let said = wantOwner && !owners.length ? "Not emailed: no address to send to. Fill in “Send to” under Enquiry form." : "";
  const vars = { name: oneLine(data.name || ""), site: name, page: page || "", email: oneLine(data.email || "") };
  const label = (k: string) => k.replace(/[-_]+/g, " ").replace(/^./, (ch) => ch.toUpperCase());
  const rows = Object.entries(data).filter(([k]) => k !== "consent" && k !== "okey" && k !== "pay_state" && k !== "rz_order" && k !== "cart" && !(k === "message" && data.order_no) && !k.startsWith("_")).map(([k, v]) => `<tr><td style="padding:6px 14px 6px 0;color:#667;vertical-align:top;white-space:nowrap">${hesc(label(k))}</td><td style="padding:6px 0;white-space:pre-wrap">${hesc(v)}</td></tr>`).join("");
  const table = `<table style="border-collapse:collapse;margin:0 0 14px">${rows}</table>`;
  const jobs: Promise<unknown>[] = [];
  if (wantOwner && owners.length) {
    const subject = data.order_no ? oneLine(`New order ${data.order_no}${data.total ? " (" + data.total + ")" : ""} from ${vars.name || "your website"}`).slice(0, 150)
      : oneLine(fill(String(F.notifySubject || "New enquiry from {name}"), { ...vars, name: vars.name || "your website" })).slice(0, 150) || "New enquiry";
    const intro = fill(String(E.enquiry?.intro || "New enquiry from the {site} website."), vars);
    const foot = fill(String(E.enquiry?.footer || "It is also saved under Enquiries in the site's admin page."), vars) + (EMAIL_RE.test(data.email || "") ? " Reply to this email to answer the visitor." : "");
    jobs.push(sendMail(env, owners, subject, WRAP(paras(intro) + table + paras(foot, "margin:0 0 8px;color:#667;font-size:13px")), EMAIL_RE.test(data.email || "") ? data.email : undefined)
      .then(() => { said = "Emailed to " + owners.join(", ") + "."; }, (e: any) => { said = "Not emailed: " + String(e?.message || e).slice(0, 300); }));
  }
  if (wantReply) {
    // At most 3 thank-you emails to one address in an hour.
    const mine = await env.DB.prepare("select count(*) n from enquiries where site = ? and created_at > ? and instr(lower(data), ?) > 0").bind(site, since, JSON.stringify(String(data.email).toLowerCase())).first<{ n: number }>();
    if ((mine?.n || 0) <= 3) {
      const v2 = { ...vars, name: vars.name || "there" };
      const subject = oneLine(fill(String(E.reply.subject || "Thank you for contacting {site}"), v2)).slice(0, 150) || "Thank you";
      const body = fill(String(E.reply.message || "Hi {name},\n\nThank you for your message. We have received it and will get back to you soon.\n\n{site}"), v2);
      const copy = E.reply.copy === true ? `<p style="margin:14px 0 6px;color:#667;font-size:13px">${hesc(String(E.reply.copyLabel || "What you sent us"))}</p>${table}` : "";
      jobs.push(sendMail(env, String(data.email).trim(), subject, WRAP(paras(body) + copy), owners[0] || (EMAIL_RE.test(c?.contact?.email || "") ? c.contact.email : undefined)));
    }
  }
  await Promise.allSettled(jobs);
  return said;
}

// ---------------------------------------------------------------- writing site text (/ai/write)
const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", hellip: "…" };
const unent = (t: string) => t.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => e[0] === "#" ? String.fromCodePoint(parseInt(e[1] === "x" || e[1] === "X" ? e.slice(2) : e.slice(1), e[1] === "x" || e[1] === "X" ? 16 : 10) || 32) : ENT[e.toLowerCase()] ?? m);
/** The page's outline as text: title, description, headings, list items and paragraphs (no scripts or styles). */
export function outlineOf(html: string): string {
  const h = html.replace(/<(script|style|noscript|svg|template|iframe)[\s\S]*?<\/\1>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ");
  const clean = (x: string) => unent(x.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  const out: string[] = [];
  const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(h); if (t) out.push("TITLE: " + clean(t[1]));
  const d = /<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i.exec(h) || /<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i.exec(h); if (d) out.push("DESCRIPTION: " + clean(d[1]));
  const re = /<(h[1-4]|li|p|dt|dd|blockquote|figcaption)\b[^>]*>([\s\S]*?)<\/\1>/gi; let m: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((m = re.exec(h))) {
    const x = clean(m[2]); if (x.length < 3 || seen.has(x)) continue; seen.add(x);
    const tag = m[1].toLowerCase(); out.push(tag[0] === "h" ? "\n" + tag.toUpperCase() + ": " + x : tag === "li" ? "- " + x : x);
  }
  return out.join("\n").slice(0, 9000);
}
const words = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
/** Texts in `o` that share 6 words in a row with the source. */
export function copiedBits(o: any, src: string, n = 6): string[] {
  const grams = new Set<string>(); const w = words(src); for (let i = 0; i + n <= w.length; i++) grams.add(w.slice(i, i + n).join(" "));
  const hit: string[] = [];
  const walk = (v: any, path: string) => {
    if (typeof v === "string") { const x = words(v); for (let i = 0; i + n <= x.length; i++) if (grams.has(x.slice(i, i + n).join(" "))) { hit.push(path); return; } }
    else if (Array.isArray(v)) v.forEach((y, i) => walk(y, path + "." + i));
    else if (v && typeof v === "object") for (const k of Object.keys(v)) walk(v[k], path ? path + "." + k : k);
  };
  walk(o, ""); return hit;
}
const BRIEF_KEYS = "brand_tagline, hero_eyebrow, hero_title, hero_text, hero_cta, about_title, about_text, mission, vision, values (4 × {title, text}), services_title, services_intro, services (up to 6 × {title, text}), process (4 × {title, text}), faq (up to 6 × {q, a}), banner_title, banner_text, cta_title, cta_text, seo_title, seo_description, footer_text";
// ---------------------------------------------------------------- Google reviews (/reviews/google)
// Finds a place from a Google Maps link (or a name and city) and returns its rating and the reviews Google's
// Places API gives (up to 5). The API key comes with each request from the owner's device and isn't kept here.
const GOOGLE_HOSTS = /^(?:[\w-]+\.)*(?:google\.[a-z.]{2,6}|goo\.gl|g\.co|g\.page)$/i;
async function placesCall(key: string, url: string, body: any, mask: string) {
  const r = await fetch(url, { method: body ? "POST" : "GET", headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": mask, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) {
    const m = String(j?.error?.message || r.status), st = String(j?.error?.status || "");
    if (/API key not valid|API_KEY_INVALID/i.test(m)) throw new Error("Google says that API key isn't valid. Check you copied all of it.");
    if (st === "PERMISSION_DENIED" || /not been used|disabled|not authorized/i.test(m)) throw new Error("Turn on \"Places API (New)\" for this key in Google Cloud (APIs & Services → Library), then try again.");
    if (r.status === 429) throw new Error("Google's limit for this key was reached. Try again later.");
    throw new Error("Google answered: " + m);
  }
  return j;
}
async function googleReviews(q: any) {
  const key = String(q.key || "").trim(), raw = String(q.link || "").trim().slice(0, 600);
  if (!/^AIza[\w-]{30,}$/.test(key)) return { error: "Paste a Google Maps Platform API key (it starts with AIza)." };
  if (!raw) return { error: "Paste the business's Google Maps link, or its name and city." };
  let id = "", text = "", ll: { latitude: number; longitude: number } | null = null;
  try {
    if (/^https?:\/\//i.test(raw)) {
      let u = new URL(raw);
      if (!GOOGLE_HOSTS.test(u.hostname)) return { error: "That isn't a Google Maps link. Open the business on Google Maps, press Share, and copy the link." };
      if (!/google\./i.test(u.hostname)) { // a short link: follow it to the full Maps address
        const r = await fetch(u.href, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0" } }); u = new URL(r.url);
        if (!GOOGLE_HOSTS.test(u.hostname)) return { error: "That link didn't lead to Google Maps." };
      }
      const full = decodeURIComponent(u.href);
      id = (/(ChIJ[\w-]{10,})/.exec(full) || [])[1] || u.searchParams.get("query_place_id") || "";
      const name = (/\/maps\/place\/([^/@?]+)/.exec(u.pathname) || [])[1];
      text = (name ? decodeURIComponent(name) : u.searchParams.get("q") || u.searchParams.get("query") || "").replace(/\+/g, " ").trim();
      const m = /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(full) || /[?&](?:ll|center)=(-?\d+\.\d+),(-?\d+\.\d+)/.exec(full);
      if (m) ll = { latitude: +m[1], longitude: +m[2] };
      if (!id && !text) return { error: "Couldn't find the business in that link. Paste its name, area and city instead." };
    } else text = raw;
    if (!id) {
      const s = await placesCall(key, "https://places.googleapis.com/v1/places:searchText", { textQuery: text, maxResultCount: 1, ...(ll ? { locationBias: { circle: { center: ll, radius: 500 } } } : {}) }, "places.id");
      id = s?.places?.[0]?.id || "";
      if (!id) return { error: `Google found no place for "${text}". Try the name with its area and city.` };
    }
    const d = await placesCall(key, `https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`, null, "id,displayName,formattedAddress,rating,userRatingCount,reviews,googleMapsUri");
    const S = (v: any, n: number) => String(v ?? "").trim().slice(0, n);
    return {
      place: { id: d.id, name: S(d.displayName?.text, 120), address: S(d.formattedAddress, 200), rating: +d.rating || 0, count: +d.userRatingCount || 0, url: S(d.googleMapsUri, 300) },
      reviews: (d.reviews || []).map((r: any) => ({ rating: +r.rating || 0, text: S(r.text?.text || r.originalText?.text, 1500), author: S(r.authorAttribution?.displayName, 80), authorUrl: S(r.authorAttribution?.uri, 300), when: S(r.relativePublishTimeDescription, 40), time: S(r.publishTime, 40) })).filter((r: any) => r.text && r.author),
    };
  } catch (e: any) { return { error: e?.message || String(e) }; }
}

// ---------------------------------------------------------------- reading a product pamphlet (/ai/products)
const VISION = ["@cf/meta/llama-4-scout-17b-16e-instruct", "@cf/meta/llama-3.2-11b-vision-instruct"];
/** The text in a photo or scanned page, read by a vision model. */
async function readImage(env: Env, dataUri: string): Promise<string> {
  const ask = "Transcribe ALL the text in this product pamphlet image exactly as printed: product names, prices, specifications, features, model numbers, contact details. Keep tables as 'label: value' lines. Output only the text.";
  let last: any;
  for (const model of VISION) {
    try {
      if (model.includes("3.2")) await env.AI.run(model, { prompt: "agree" }).catch(() => null); // that model asks once for its licence to be accepted
      const r: any = await env.AI.run(model, { messages: [{ role: "user", content: [{ type: "text", text: ask }, { type: "image_url", image_url: { url: dataUri } }] }], max_tokens: 2048 });
      const t = String(r?.response ?? "").trim(); if (t) return t;
    } catch (e) { last = e; }
  }
  throw last || new Error("Couldn't read the image.");
}
/** The product list in whatever shape the model answered: {"products":[…]}, another key, a bare list or one product. */
function productsIn(v: any, depth = 0): any[] {
  if (typeof v === "string") { const t = v.replace(/```(?:json)?/gi, ""); for (const m of [/\{[\s\S]*/, /\[[\s\S]*/]) { const x = m.exec(t.trim()); if (x) { const o = parseLoose(x[0].replace(/\s*```?\s*$/, "")); if (o) return productsIn(o, depth); } } return []; }
  if (Array.isArray(v)) return v.filter((x) => x && typeof x === "object");
  if (!v || typeof v !== "object" || depth > 3) return [];
  if (Array.isArray(v.products)) return productsIn(v.products);
  if (v.name || v.product_name || v.model || v.title) return [v];
  for (const k of Object.keys(v)) { const x = productsIn(v[k], depth + 1); if (x.length) return x; }
  return [];
}
/** JSON, or JSON cut off mid-way: close what's open so the complete products survive. */
function parseLoose(t: string): any {
  try { return JSON.parse(t); } catch {}
  for (let end = t.length; end > 0; end = t.lastIndexOf("}", end - 1)) {
    const full = end === t.length, head = full ? t : t.slice(0, end + 1); let st: string[] = [], inStr = false;
    for (let i = 0; i < head.length; i++) { const c = head[i]; if (inStr) { if (c === "\\") i++; else if (c === '"') inStr = false; } else if (c === '"') inStr = true; else if (c === "{" || c === "[") st.push(c === "{" ? "}" : "]"); else if (c === "}" || c === "]") st.pop(); }
    if (inStr && !full) continue;
    try { return JSON.parse(head.replace(/[,:]\s*$/, "") + (inStr ? '"' : "") + st.reverse().join("")); } catch {}
    if (end < t.length - 20000) break;
  }
  return null;
}
const specList = (v: any) => Array.isArray(v) ? v : v && typeof v === "object" ? Object.entries(v).map(([label, value]) => ({ label, value: String(value) })) : [];
/** A product read straight from the pamphlet text: its model name, the paragraph about it, "label: value" lines as
 *  specs and short points under a features heading. Used only when the AI returned nothing. */
function fromText(all: string): any[] {
  const lines = all.split(/\n/).map((l) => l.replace(/^[-•*#>\s]+|\s+$/g, "").replace(/\*\*/g, "")).filter((l) => l && !/^--- PAGE/.test(l));
  const model = /\b[A-Z]{1,6}[- ]?\d{2,5}[A-Z]?\b/;
  let name = "", at = -1;
  for (let i = 0; i < lines.length && !name; i++) {
    const l = lines[i]; if (l.length > 60 || !model.test(l) || /:|\|/.test(l)) continue; at = i;
    const prev = lines[i - 1] || ""; name = (/^[A-Z][A-Z0-9&.\- ]{1,24}$/.test(prev) && !model.test(prev) && !l.toUpperCase().includes(prev.toUpperCase()) ? prev + " " : "") + l;
  }
  if (!name) name = lines.find((l) => l.length >= 3 && l.length <= 50 && /^[A-Z0-9][A-Z0-9&.\- ]+$/.test(l)) || "";
  if (!name) return [];
  const specs: { label: string; value: string }[] = [];
  for (const l of lines) { const m = /^([A-Za-z][^:|]{1,60}?)\s*[:|]\s*([^|]{1,120}?)\s*\|?$/.exec(l); if (m && !/https?$/i.test(m[1]) && !/phone|email|call|www/i.test(m[1])) specs.push({ label: m[1].trim(), value: m[2].trim() }); }
  const summary = lines.filter((l) => l.length > 70 && /[a-z]/.test(l) && !/:/.test(l)).sort((a, b) => b.length - a.length)[0] || "";
  const fi = lines.findIndex((l) => /^key\s*features|^features/i.test(l)), features: string[] = [];
  if (fi >= 0) for (const l of lines.slice(fi + 1)) { if (/:|\|/.test(l) || l.length > 90 || !/[a-z]/.test(l) || features.length >= 8) break; if (l.length > 3) features.push(l); }
  // The type: the short line just under the name ("SUBMERGED ARC AUTOMATIC WELDER"), else a line naming a kind of product.
  const next = lines[at + 1] || "", kind = /welder|machine|system|series|inverter|pump|motor|printer|unit/i;
  const cat = at >= 0 && next.length < 50 && !/:/.test(next) && /^[A-Z]/.test(next) && next.split(" ").length >= 2 ? next : lines.find((l) => l.length < 50 && kind.test(l) && l !== name) || "";
  const category = cat.replace(/\s*[-–]\s*premium$/i, "").toLowerCase().replace(/^./, (c) => c.toUpperCase()).replace(/\b(saw|mig|tig|mma|igbt|ac|dc)\b/gi, (w) => w.toUpperCase());
  return [{ name: name.replace(/\s+/g, " "), category, summary, features, specs, details: "", price: "", page: 1 }];
}
const PRODUCT_KEYS = `{"products":[{"name":"","category":"","summary":"one or two sentences","price":"exactly as printed, or empty","features":["short points"],"details":"a fuller description in paragraphs","specs":[{"label":"","value":""}],"page":1}]}`;
async function readPamphlet(env: Env, q: any) {
  const pages: string[] = [];
  const text = String(q.text || "").slice(0, 60000); if (text.trim()) pages.push(text);
  const imgs = (Array.isArray(q.images) ? q.images : []).slice(0, 8);
  try {
    for (const im of imgs) {
      const uri = String(im?.data || ""); if (!/^data:image\/(jpeg|png|webp);base64,/.test(uri) || uri.length > 4_500_000) continue;
      pages.push(`--- PAGE ${+im.page || pages.length + 1} ---\n` + (await readImage(env, uri)));
    }
  } catch (e: any) { return { error: /neuron|quota|limit|429/i.test(String(e?.message || e)) ? "Today's free AI allowance is used up. Try again tomorrow." : "Couldn't read the pamphlet's pictures: " + (e?.message || e) }; }
  const all = pages.join("\n\n").slice(0, 24000);
  if (words(all).length < 12) return { error: "Couldn't find any text in that pamphlet. Try a clearer photo or the original PDF." };
  const sys = `You turn a business's own product pamphlet into catalogue entries. Return ONLY JSON shaped like ${PRODUCT_KEYS}. One entry per distinct product or model. Rules: use only what the pamphlet says; never invent prices, numbers, ratings, certifications or features; copy prices, model numbers and specification values exactly as printed; leave a field empty ("" or []) when the pamphlet doesn't say; category is a short group name the pamphlet suggests (or ""); summary is one or two plain sentences; features are short points; specs are label/value pairs from tables or lists; page is the page number (from the --- PAGE n --- markers) where the product appears, or 1. Skip company contact details, terms and general marketing text.`;
  const model = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
  const user = (q.hint ? "Note from the owner: " + String(q.hint).slice(0, 500) + "\n\n" : "") + "PAMPHLET TEXT:\n" + all;
  const S = (v: any, n = 2000) => (typeof v === "string" || typeof v === "number" ? String(v).trim().slice(0, n) : "");
  const clean = (list: any[]) => list.map((p: any) => ({
    name: S(p?.name ?? p?.product_name ?? p?.productName ?? p?.product ?? p?.model ?? p?.title, 120), category: S(p?.category, 60), summary: S(p?.summary ?? p?.description, 400), price: S(p?.price, 60),
    features: (Array.isArray(p?.features) ? p.features : []).map((x: any) => S(x, 160)).filter(Boolean).slice(0, 12),
    details: S(p?.details, 3000), specs: specList(p?.specs ?? p?.specifications).map((x: any) => ({ label: S(x?.label, 80), value: S(x?.value, 200) })).filter((x: any) => x.label || x.value).slice(0, 30),
    page: Math.max(1, Math.min(99, parseInt(p?.page, 10) || 1)),
  })).filter((p: any) => p.name).slice(0, 60);
  let products: any[] = [], guessed = false;
  // Two tries: JSON mode first; then plain text (JSON mode can come back empty or cut short on long spec sheets).
  for (const json of [true, false]) {
    let r: any;
    try { r = await env.AI.run(model, { messages: [{ role: "system", content: sys }, { role: "user", content: user }], max_tokens: json ? 4000 : 6000, temperature: 0.1, ...(json ? { response_format: { type: "json_object" } } : {}) }); }
    catch (e: any) { if (/neuron|quota|limit|429/i.test(String(e?.message || e))) return { error: "Today's free AI allowance is used up. Try again tomorrow." }; if (!json) break; continue; }
    products = clean(productsIn(r?.response ?? r));
    if (products.length) break;
  }
  // The AI found nothing, but the pamphlet has text: build the product from the text itself, for the owner to check.
  if (!products.length) { products = clean(fromText(all)); guessed = products.length > 0; }
  if (!products.length) return { error: "No products were found in that pamphlet. Add a note naming the product (for example \"one product: MZ 1250 welder\") and try again." };
  // The pamphlet's own social links (also read from page pictures), for the site's footer row.
  return { products, read: words(all).length, social: socialFromText(all), ...(guessed ? { guessed: true } : {}) };
}

/** Translates up to 30 short texts in one go. Returns { t: (string | null)[] } in the same order (null: try again). */
async function translateTexts(env: Env, q: any): Promise<any> {
  const to = oneLine(String(q.to || "")).slice(0, 40), from = oneLine(String(q.from || "English")).slice(0, 40);
  const texts: string[] = (Array.isArray(q.texts) ? q.texts : []).slice(0, 30).map((x: any) => String(x ?? "").slice(0, 1500));
  if (!/^[\p{L} ()-]{2,40}$/u.test(to) || !texts.length) return { error: "Choose a language and some text." };
  const sys = `You translate the text of a small business website from ${from} into ${to}, written in ${to}'s own script. Rules: translate naturally, the way a good ${to} website for Indian customers reads, not word for word; keep brand and product names, people's names, numbers, prices, units, emails, web addresses and emoji exactly as they are; keep every line break and every marker exactly where it is (**bold**, ==highlight==, __underline__, {accent:…}, list dashes, #, | table bars, HTML tags, {placeholders} in curly brackets); short labels stay short; never add notes or explanations. You receive a JSON object {"texts": {"1": "…", "2": "…"}} and answer with only a JSON object {"t": {"1": "…", "2": "…"}} with the same numbers, each holding the translation of the text with that number.`;
  // Texts go and come back numbered ({"1": "…"}), so a line the model drops or merges costs only that line, not the batch.
  let failed = "";
  const ask = async (idx: number[]): Promise<Map<number, string>> => {
    const got = new Map<number, string>();
    try {
      const r: any = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", { messages: [{ role: "system", content: sys }, { role: "user", content: JSON.stringify({ texts: Object.fromEntries(idx.map((i) => [String(i + 1), texts[i]])) }) }], max_tokens: 6000, temperature: 0.2, response_format: { type: "json_object" } });
      const raw = typeof r?.response === "string" ? r.response : JSON.stringify(r?.response ?? r);
      let j: any = null; try { j = JSON.parse(raw); } catch { try { const m = /\{[\s\S]*\}/.exec(raw); j = m ? JSON.parse(m[0]) : null; } catch { j = null; } }
      // An answer that isn't valid JSON as a whole (cut short, a stray quote) still holds good numbered lines.
      if (!j) for (const m of raw.matchAll(/"(\d+)"\s*:\s*"((?:[^"\\]|\\.)*)"/g)) { try { const v = JSON.parse('"' + m[2] + '"'); if (typeof v === "string" && v.trim() && idx.includes(+m[1] - 1)) got.set(+m[1] - 1, v.slice(0, 4000)); } catch { /* that line is asked again */ } }
      const t = j?.t;
      if (Array.isArray(t)) { if (t.length === idx.length) t.forEach((x: any, k: number) => { if (typeof x === "string" && x.trim()) got.set(idx[k], x.slice(0, 4000)); }); }
      else if (t && typeof t === "object") for (const i of idx) { const x = t[String(i + 1)]; if (typeof x === "string" && x.trim()) got.set(i, x.slice(0, 4000)); }
    } catch (e: any) { failed = String(e?.message || e); /* the model or its answer failed: these lines are asked again below */ }
    return got;
  };
  const all = texts.map((_, i) => i), half = Math.ceil(all.length / 2);
  // Two halves at once (shorter answers come back sooner), then one more go at whatever is still missing.
  const first = await Promise.all((all.length > 6 ? [all.slice(0, half), all.slice(half)] : [all]).map(ask));
  const done = new Map<number, string>(); for (const m of first) for (const [k, v] of m) done.set(k, v);
  const missing = all.filter((i) => !done.has(i));
  if (missing.length) for (const [k, v] of await ask(missing)) done.set(k, v);
  // Nothing at all came back and the model itself failed: say why, so the editor doesn't treat the texts as untranslatable.
  if (!done.size && failed) return { error: /neuron|quota|limit|429|capacity/i.test(failed) ? "Today's free AI allowance on this Cloudflare account is used up. Press Translate again after it resets (midnight UTC), or type translations in." : "The translator didn't answer (" + failed.slice(0, 120) + ")." };
  return { t: all.map((i) => done.get(i) ?? null) };
}
/** A public https address (not this machine, a bare IP or an internal name). */
/* ============================================================
   Connections an owner can switch on: their own AI API, WhatsApp (Meta's Cloud API) and Razorpay.
   Their keys are kept in this database encrypted with the Worker's own secret, are never sent back to
   a browser, and each is used only when it is switched on.
   ============================================================ */
let ensured = false;
async function ensure(env: Env) {
  if (ensured) return;
  await env.DB.batch([
    env.DB.prepare("create table if not exists settings (scope text not null, name text not null, value text not null, updated_at text not null, primary key (scope, name))"),
    env.DB.prepare("create table if not exists otps (k text primary key, hash text not null, expires integer not null, tries integer not null default 0, sent integer not null default 0)"),
    env.DB.prepare("create table if not exists payments (rz_order text primary key, site text not null, order_no text not null, amount integer not null, status text not null default 'created', created_at text not null)"),
  ]);
  ensured = true;
}
const SETTINGS: Record<string, { secret: string[]; text: string[]; flags: string[] }> = {
  ai: { secret: ["key"], text: ["base", "model", "vision"], flags: ["on"] },
  wa: { secret: ["token"], text: ["phoneId", "waba", "cc", "lang", "to", "phones", "tplOtp", "tplOrder", "tplEnquiry"], flags: ["on", "login", "orderOtp", "orderAlert", "enquiryAlert"] },
  rz: { secret: ["secret"], text: ["keyId"], flags: ["on"] },
};
async function aesKey(env: Env) { return crypto.subtle.importKey("raw", await crypto.subtle.digest("SHA-256", enc.encode("settings:" + env.SECRET)), "AES-GCM", false, ["encrypt", "decrypt"]); }
async function getSetting(env: Env, scope: string, name: string): Promise<any | null> {
  await ensure(env);
  const r: any = await env.DB.prepare("select value from settings where scope = ? and name = ?").bind(scope, name).first(); if (!r) return null;
  try { const b = unb64u(r.value); return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: b.slice(0, 12) }, await aesKey(env), b.slice(12)))); } catch { return null; }
}
async function putSetting(env: Env, scope: string, name: string, value: any | null) {
  await ensure(env);
  if (value == null) { await env.DB.prepare("delete from settings where scope = ? and name = ?").bind(scope, name).run(); return; }
  const iv = crypto.getRandomValues(new Uint8Array(12)), ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(env), enc.encode(JSON.stringify(value))));
  const all = new Uint8Array(12 + ct.length); all.set(iv); all.set(ct, 12);
  let s = ""; for (let i = 0; i < all.length; i += 8000) s += String.fromCharCode(...all.subarray(i, i + 8000));
  await env.DB.prepare("insert into settings (scope, name, value, updated_at) values (?, ?, ?, ?) on conflict (scope, name) do update set value = excluded.value, updated_at = excluded.updated_at")
    .bind(scope, name, btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""), new Date().toISOString()).run();
}
/** What a browser may see of a setting: everything but the secrets (those only say whether one is saved). */
function maskSetting(name: string, v: any) {
  const S = SETTINGS[name], o: any = {}; if (!v) return null;
  for (const k of S.text) o[k] = String(v[k] ?? ""); for (const k of S.flags) o[k] = !!v[k]; for (const k of S.secret) o[k] = !!v[k];
  return o;
}
/** The newest saved setting of a kind in this database (the Studio's own AI API serves every site on it). */
async function anySetting(env: Env, name: string): Promise<any | null> {
  await ensure(env);
  const r: any = await env.DB.prepare("select scope from settings where name = ? order by updated_at desc limit 1").bind(name).first();
  return r ? getSetting(env, r.scope, name) : null;
}

/** An OpenAI-compatible chat API in the place of Workers AI: same call, same answer shape. */
function customAI(c: any) {
  const base = String(c.base || "").trim().replace(/\/+$/, "").replace(/\/chat\/completions$/, "");
  return {
    run: async (_model: string, o: any) => {
      if (!o?.messages) return { response: "" };
      const vision = o.messages.some((m: any) => Array.isArray(m.content));
      const send = (fmt: boolean) => fetch(base + "/chat/completions", { method: "POST", headers: { Authorization: "Bearer " + c.key, "Content-Type": "application/json" },
        body: JSON.stringify({ model: (vision && c.vision) || c.model, messages: o.messages, ...(o.max_tokens ? { max_tokens: Math.min(o.max_tokens, 8000) } : {}), ...(o.temperature != null ? { temperature: o.temperature } : {}), ...(fmt && o.response_format ? { response_format: o.response_format } : {}) }) });
      let r = await send(true);
      // Not every API knows the JSON switch: asked again without it (the prompts already ask for JSON).
      if (r.status === 400 && o.response_format) r = await send(false);
      if (!r.ok) { const t = (await r.text()).replace(/\s+/g, " ").slice(0, 240); throw new Error(r.status === 401 || r.status === 403 ? `Your AI API refused the key (${r.status}). Check it under Settings → AI engine.` : r.status === 429 ? "Your AI API says its limit is reached (429)." : `Your AI API answered ${r.status}: ${t}`); }
      const j: any = await r.json().catch(() => null), m = j?.choices?.[0]?.message?.content;
      return { response: typeof m === "string" ? m : Array.isArray(m) ? m.map((x: any) => x?.text || "").join("") : "" };
    },
  };
}

/* ---- WhatsApp (Meta's WhatsApp Business Cloud API). Messages a business starts must use templates it has had approved. ---- */
const waNum = (v: unknown, cc = "91") => { let d = String(v ?? "").replace(/\D/g, ""); if (d.length === 10) d = (String(cc || "91").replace(/\D/g, "") || "91") + d; return d.length >= 11 && d.length <= 15 ? d : ""; };
/** A template's variable can't hold line breaks, tabs or long runs of spaces. */
const waText = (s: unknown, n = 300) => String(s ?? "").replace(/[\r\n\t]+/g, " ").replace(/ {4,}/g, "   ").trim().slice(0, n) || "-";
async function waSend(c: any, to: string, tpl: string, params: string[], otp?: string) {
  const comps: any[] = [{ type: "body", parameters: params.map((t) => ({ type: "text", text: waText(t) })) }];
  // An authentication template carries the code in its copy-code button as well.
  if (otp) comps.push({ type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: otp }] });
  const r = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(String(c.phoneId).trim())}/messages`, { method: "POST", headers: { Authorization: "Bearer " + c.token, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "template", template: { name: String(tpl).trim(), language: { code: String(c.lang || "en").trim() || "en" }, components: comps } }) });
  if (!r.ok) throw new Error(`WhatsApp didn't accept the message (${r.status}): ` + (await r.text()).replace(/\s+/g, " ").slice(0, 200));
}
/* Setting WhatsApp up from the token alone: Meta is asked which WhatsApp account, numbers and templates the token can use. */
const GRAPH = "https://graph.facebook.com/v21.0";
async function graph(token: string, path: string, init?: { method?: string; body?: any }): Promise<any> {
  const r = await fetch(GRAPH + path, { method: init?.method || "GET", headers: { Authorization: "Bearer " + token, ...(init?.body ? { "Content-Type": "application/json" } : {}) }, ...(init?.body ? { body: JSON.stringify(init.body) } : {}) });
  const j: any = await r.json().catch(() => null);
  if (!r.ok) { const e: any = new Error(String(j?.error?.error_user_msg || j?.error?.message || `Meta answered ${r.status}.`).slice(0, 300)); e.status = r.status; e.code = j?.error?.code; throw e; }
  return j;
}
/** The WhatsApp accounts a token reaches, each with its numbers and templates. `hint`: an account ID typed by the owner. */
async function waFind(token: string, hint = ""): Promise<{ wabas: any[]; why?: string }> {
  const ids = new Set<string>(); let why = "";
  if (/^\d{6,20}$/.test(hint)) ids.add(hint);
  try { const d = await graph(token, "/debug_token?input_token=" + encodeURIComponent(token)); for (const g of d?.data?.granular_scopes || []) if (/^whatsapp_business_(management|messaging)$/.test(g?.scope)) for (const t of g.target_ids || []) ids.add(String(t)); if (d?.data?.is_valid === false) why = "Meta says this token isn't valid (it may have expired)."; }
  catch (e: any) { why = e?.status === 401 || e?.code === 190 ? "Meta refused the token. Check that you copied all of it and that it hasn't expired." : ""; }
  const wabas: any[] = [];
  for (const id of [...ids].slice(0, 3)) {
    try {
      const ph = await graph(token, `/${id}/phone_numbers?fields=id,display_phone_number,verified_name&limit=20`), tp = await graph(token, `/${id}/message_templates?fields=name,status,category,language&limit=200`).catch(() => ({ data: [] }));
      wabas.push({ id, phones: (ph?.data || []).map((x: any) => ({ id: String(x.id), number: String(x.display_phone_number || ""), name: String(x.verified_name || "") })), templates: (tp?.data || []).map((x: any) => ({ name: String(x.name), status: String(x.status || ""), category: String(x.category || ""), language: String(x.language || "") })) });
    } catch (e: any) { why = why || String(e?.message || e); }
  }
  return { wabas, ...(wabas.length ? {} : { why: why || "Couldn't tell which WhatsApp account this token belongs to. Paste the WhatsApp Business Account ID too (Meta shows it on the API Setup page, under the phone number)." }) };
}
const WA_TPL: Record<string, (lang: string) => any> = {
  otp: (language) => ({ name: "signin_code", language, category: "authentication", components: [{ type: "body", add_security_recommendation: true }, { type: "footer", code_expiration_minutes: 10 }, { type: "buttons", buttons: [{ type: "otp", otp_type: "copy_code" }] }] }),
  order: (language) => ({ name: "order_alert", language, category: "utility", components: [{ type: "body", text: "New order {{1}} from {{2}}. To pay {{3}}. {{4}}", example: { body_text: [["ORD-1118-1234", "Asha Rao", "Rs 376", "Delivery, today 7:30 pm"]] } }] }),
  enquiry: (language) => ({ name: "enquiry_alert", language, category: "utility", components: [{ type: "body", text: "New enquiry from {{1}} ({{2}}): {{3}}", example: { body_text: [["Asha Rao", "9876543210", "Do you take group bookings on Sunday?"]] } }] }),
};
const waReady = (c: any) => !!(c && c.on && c.token && String(c.phoneId || "").trim());
/** "name@site.com = +91 98…" lines: the WhatsApp number of each person who signs in. */
const waPhoneOf = (lines: unknown, email: string) => { for (const l of String(lines || "").split(/\n/)) { const i = l.indexOf("="); if (i > 0 && l.slice(0, i).trim().toLowerCase() === email) return l.slice(i + 1).trim(); } return ""; };
/** Tells the owner on WhatsApp about a new order or enquiry, when they switched that on. Says what happened. */
async function waAlert(env: Env, site: string, data: Record<string, string>): Promise<string> {
  const c = await getSetting(env, "site:" + site, "wa"); if (!waReady(c)) return "";
  const order = !!data.order_no, tpl = String((order ? c.orderAlert && c.tplOrder : c.enquiryAlert && c.tplEnquiry) || "").trim(); if (!tpl) return "";
  const to = [...new Set(String(c.to || "").split(/[,;\n]+/).map((x) => waNum(x, c.cc)).filter(Boolean))].slice(0, 3); if (!to.length) return "Not sent on WhatsApp: no number to send to.";
  const since = new Date(Date.now() - 3600_000).toISOString(), n: any = await env.DB.prepare("select count(*) n from enquiries where site = ? and created_at > ?").bind(site, since).first();
  if ((n?.n || 0) > 60) return "Not sent on WhatsApp: more than 60 in an hour, so messages are paused.";
  const params = order ? [data.order_no, data.name || "-", data.total || "-", [data.mode, data.when].filter(Boolean).join(", ") || "-"] : [data.name || "-", data.phone || data.email || "-", data.message || [data.type, data.date, data.time, data.guests && data.guests + " guests"].filter(Boolean).join(", ") || "-"];
  try { for (const t of to) await waSend(c, t, tpl, params); return "Sent on WhatsApp."; } catch (e: any) { return "Not sent on WhatsApp: " + String(e?.message || e).slice(0, 240); }
}

/* ---- Razorpay for a restaurant's Order now page: the amount is worked out here from the site's own menu, never taken from the browser. ---- */
const rslug = (s: unknown) => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "item";
const rnum = (p: unknown) => { const n = parseFloat(String(p ?? "").replace(/[^\d.]/g, "")); return isFinite(n) ? n : NaN; };
/** The bill of a restaurant order, by the same rules as the site's Order now page (assets/order.js). */
export function restBill(c: any, q: any): { total: number } | { error: string } {
  const o = c?.ordering || {}; if (!o.on) return { error: "Online ordering is switched off." };
  const mode = String(q?.mode || ""), modes = o.modes || {}; if (!["delivery", "pickup", "dinein"].includes(mode) || !modes[mode]) return { error: "That way of ordering isn't offered." };
  const dishes = new Map<string, any>();
  for (const k of c?.food?.categories || []) { if (!k || !String(k.name || "").trim()) continue; for (const d of k.items || []) if (d && String(d.name || "").trim() && !d.noOrder && !d.soldOut) dishes.set(rslug(k.name) + "/" + rslug(d.name), d); }
  let sub = 0; const lines = Array.isArray(q?.items) ? q.items.slice(0, 60) : []; if (!lines.length) return { error: "The cart is empty." };
  for (const l of lines) {
    const d = dishes.get(String(l?.id || "")); if (!d) return { error: "A dish in the cart is no longer on the menu. Refresh the page." };
    const V = (d.variants || []).filter((v: any) => v && v.label && !isNaN(rnum(v.price))), qty = Math.max(1, Math.min(50, Math.floor(+l.qty || 0)));
    let unit = V.length ? rnum((V.find((v: any) => String(v.label) === String(l.variant)) || {}).price) : rnum(d.price);
    if (isNaN(unit)) return { error: "A dish in the cart changed. Refresh the page." };
    const opts = new Map<string, number>(); for (const g of d.addons || []) for (const s of (g && g.options) || []) { const t = String(s || ""), i = t.lastIndexOf("="), label = (i > 0 ? t.slice(0, i) : t).trim(), pr = i > 0 ? rnum(t.slice(i + 1)) : 0; if (label) opts.set(label, isNaN(pr) ? 0 : pr); }
    for (const a of Array.isArray(l.addons) ? l.addons.slice(0, 20) : []) { if (!opts.has(String(a))) return { error: "An extra in the cart changed. Refresh the page." }; unit += opts.get(String(a))!; }
    sub += unit * qty;
  }
  const cp = (o.coupons || []).find((x: any) => x && x.on !== false && +x.value > 0 && String(x.code || "").trim().toUpperCase() === String(q.coupon || "").trim().toUpperCase() && String(q.coupon || "").trim());
  let disc = 0; if (cp && sub >= (+cp.min || 0)) disc = Math.min(sub, cp.kind === "flat" ? +cp.value : Math.min((sub * +cp.value) / 100, +cp.max > 0 ? +cp.max : Infinity));
  disc = Math.round(disc * 100) / 100;
  const pack = mode === "dinein" ? 0 : Math.max(0, +o.packing || 0);
  let fee: number | null = null, okArea = true;
  if (mode === "delivery") {
    const L = String(o.areas || "").split(/\n/).map((x) => x.trim()).filter(Boolean);
    if (L.length) { okArea = false; const pin = String(q.pin || "").replace(/\D/g, ""), area = String(q.area || "").trim().toLowerCase();
      for (const l of L) { const i = l.lastIndexOf("="), key = (i > 0 ? l.slice(0, i) : l).trim().toLowerCase(), f = i > 0 ? rnum(l.slice(i + 1)) : NaN; if (!key) continue; if (/^\d{4,}$/.test(key) ? key === pin : !!area && (area.includes(key) || key.includes(area))) { okArea = true; fee = isNaN(f) ? null : f; break; } } }
  }
  if (!okArea) return { error: "We don't deliver to that address." };
  const free = +o.freeAbove > 0 && sub - disc >= +o.freeAbove, del = mode !== "delivery" ? 0 : free ? 0 : Math.max(0, fee != null ? fee : +o.deliveryFee || 0);
  const base = sub - disc + pack, pct = Math.max(0, +o.taxPercent || 0), tax = o.taxIncluded || !pct ? 0 : Math.round(base * pct) / 100;
  const tip = o.tips !== false && mode !== "pickup" ? Math.max(0, Math.min(5000, +q.tip || 0)) : 0;
  const raw = base + tax + del + tip, total = o.roundOff === false ? Math.round(raw * 100) / 100 : Math.round(raw);
  if (mode !== "dinein" && sub < Math.max(0, +o.minOrder || 0)) return { error: "The order is below the minimum." };
  return { total };
}

/** The pictures a page shows: <img> (with lazy-loading and srcset variants), <source>, CSS background images in style attributes and the share image. */
function picturesOf(html: string, base: URL): { url: string; alt: string }[] {
  const out: { url: string; alt: string }[] = [], seen = new Set<string>();
  const add = (raw: string, alt = "") => {
    const v = raw.replace(/&amp;/g, "&").trim(); if (!v || /^data:/i.test(v)) return;
    let u: URL; try { u = new URL(v, base); } catch { return; }
    if (u.protocol !== "https:" || !publicUrl(u.href) || /\.(svg|ico)(\?|$)/i.test(u.pathname) || /(sprite|pixel|spacer|blank|1x1|tracking|favicon)/i.test(u.pathname)) return;
    const key = u.origin + u.pathname; if (seen.has(key) || out.length >= 60) return; seen.add(key);
    out.push({ url: u.href, alt: alt.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 120) });
  };
  const attr = (tag: string, name: string) => { const m = new RegExp("\\s" + name + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s>]+))", "i").exec(tag); return m ? m[1] ?? m[2] ?? m[3] ?? "" : ""; };
  const biggest = (srcset: string) => srcset.split(",").map((x) => x.trim().split(/\s+/)).filter((x) => x[0]).sort((a, b) => (parseFloat(b[1]) || 0) - (parseFloat(a[1]) || 0))[0]?.[0] || "";
  const og = /<meta[^>]+property=["']og:image["'][^>]*>/i.exec(html); if (og) add(attr(og[0], "content"), "Share image");
  for (const m of html.matchAll(/<(img|source)\b[^>]*>/gi)) {
    const t = m[0], alt = attr(t, "alt");
    const set = attr(t, "data-srcset") || attr(t, "srcset");
    add((set && biggest(set)) || attr(t, "data-src") || attr(t, "data-lazy-src") || attr(t, "data-original") || attr(t, "src"), alt);
  }
  for (const m of html.matchAll(/style\s*=\s*["'][^"']*background(?:-image)?\s*:[^"']*url\(\s*(?:&quot;|["'])?([^"')&]+)/gi)) add(m[1]);
  return out;
}
function publicUrl(url: string): URL | null {
  if (!/^https:\/\/[^\s/]+\.[^\s]+$/i.test(url)) return null;
  let u: URL; try { u = new URL(url); } catch { return null; }
  const host = u.hostname.toLowerCase();
  return /^(localhost|[\d.]+|\[.*\])$/.test(host) || /\.(local|internal|localhost)$/.test(host) ? null : u;
}
/** Reads a page and its stylesheets and returns only the design facts (see src/lib/lookdigest.ts). */
async function lookAt(url: string): Promise<any> {
  const u = publicUrl(url.trim()); if (!u) return { error: "Enter the page's public address (https://…)." };
  const get = async (x: string, accept: string) => { const r = await fetch(x, { headers: { "User-Agent": "Mozilla/5.0 (site-studio reference reader)", Accept: accept }, redirect: "follow" }); if (!r.ok) throw new Error(String(r.status)); return (await r.text()).slice(0, 1_500_000); };
  let html = ""; try { html = await get(u.href, "text/html"); } catch (e: any) { return { error: /^\d+$/.test(String(e?.message)) ? `That page answered ${e.message}.` : "Couldn't open that address." }; }
  let css = "";
  for (const link of sheetLinks(html, u.href).slice(0, 5)) { if (!publicUrl(link) || css.length > 2_500_000) continue; try { css += "\n" + (await get(link, "text/css")); } catch { /* that sheet is skipped */ } }
  return { digest: digestPage(html, css) };
}
async function writeSite(env: Env, q: any) {
  const brand = String(q.brand || "").trim().slice(0, 80), notes = String(q.notes || "").slice(0, 1500), kind = String(q.kind || "business");
  if (!brand) return { error: "Enter your brand name." };
  let src = String(q.text || "").slice(0, 20000);
  if (!src.trim()) {
    const url = String(q.url || "").trim();
    if (!/^https:\/\/[^\s/]+\.[^\s]+$/i.test(url)) return { error: "Enter the site's address (https://…)." };
    const host = new URL(url).hostname.toLowerCase();
    if (/^(localhost|[\d.]+|\[.*\])$/.test(host) || /\.(local|internal|localhost)$/.test(host)) return { error: "Use the site's public address." };
    let r: Response; try { r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (site-studio reference reader)", Accept: "text/html" }, redirect: "follow" }); } catch { return { error: "Couldn't open that address." }; }
    if (!r.ok) return { error: `That site answered ${r.status}.` };
    const html = (await r.text()).slice(0, 3_000_000);
    src = outlineOf(html);
  }
  if (words(src).length < 40) return { error: "That page has almost no text to read (it may build its text with JavaScript). Paste the page's text into the box instead.", thin: true };
  const sys = `You write website copy for small businesses. You are given a REFERENCE website's outline only to understand what kind of business it is and which topics a site like it covers. Write completely NEW, original copy for a different business named "${brand}". Rules: never reuse the reference's sentences, phrases, slogans or distinctive wording; never mention the reference business, its name, people, clients, prices, numbers, years, awards or locations; do not invent facts (no years, statistics, client names, awards, certifications, prices or testimonials); keep claims general and honest; use the name ${brand} naturally; plain, warm, professional English; short sentences. Site type: ${kind}. Return ONLY a JSON object with these keys: ${BRIEF_KEYS}. Every value is a string or an array as described; use "" when a key doesn't fit.`;
  const user = `${notes ? "About " + brand + " (from the owner, use this): " + notes + "\n\n" : ""}REFERENCE OUTLINE (for topics only, do not copy):\n${src.slice(0, 7000)}`;
  const model = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
  const ask = async (messages: any[]) => {
    const r: any = await env.AI.run(model, { messages, max_tokens: 3000, temperature: 0.8, response_format: { type: "json_object" } });
    const t = typeof r?.response === "string" ? r.response : JSON.stringify(r?.response ?? r);
    try { return JSON.parse(t); } catch { const m = /\{[\s\S]*\}/.exec(t); if (m) return JSON.parse(m[0]); throw new Error("The writer returned something unreadable. Try again."); }
  };
  let brief: any;
  try { brief = await ask([{ role: "system", content: sys }, { role: "user", content: user }]); }
  catch (e: any) { return { error: /neuron|quota|limit|429/i.test(String(e?.message || e)) ? "Today's free AI allowance is used up. Try again tomorrow." : "Couldn't write the text: " + (e?.message || e) }; }
  let flagged = copiedBits(brief, src);
  if (flagged.length) {
    try {
      const again = await ask([{ role: "system", content: sys }, { role: "user", content: user }, { role: "assistant", content: JSON.stringify(brief) },
        { role: "user", content: `These fields reuse wording from the reference: ${flagged.join(", ")}. Rewrite them in completely different words (keep the rest). Return the whole JSON again.` }]);
      if (again && typeof again === "object") { brief = again; flagged = copiedBits(brief, src); }
    } catch { /* keep the first answer; flagged fields are left out by the Studio */ }
  }
  return { brief, flagged, words: words(src).length };
}

export default {
  async fetch(req: Request, env: Env, ctx?: { waitUntil(p: Promise<unknown>): void }): Promise<Response> {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const u = new URL(req.url), p = u.pathname.replace(/\/+$/, "") || "/";
    try {
      if (p === "/") return json({ ok: true, service: "site-studio-db", v: V, mail: !!(env.RESEND_API_KEY && env.MAIL_FROM), ...(env.CF_TOKEN && env.CF_ACCOUNT ? { deploy: true, account: env.CF_ACCOUNT } : {}), ...(env.GH_TOKEN ? { gh: true } : {}), ...(env.AI ? { ai: true, pamphlet: 2 } : {}), reviews: true, look: 1, outline: 1, pictures: 1, connect: 2, translate: 4, approvals: 1, accounts: 2, cfx: 4, studioPages: 1, del: 1, enqMail: 3, ...(otherAccounts(env).length ? { more: otherAccounts(env).length } : {}) });

      // The owner's own AI API in the place of Workers AI, when a request asks for it.
      if (p.startsWith("/ai/") && u.searchParams.get("engine") === "custom") {
        const c = await anySetting(env, "ai");
        if (!c?.on || !c.key || !c.model || !publicUrl(String(c.base || "").trim())) return json({ error: "Your own AI API isn't set up yet. Fill it in under Settings → AI engine." });
        env = { ...env, AI: customAI(c) };
      }

      // ---- sign in with an emailed code (members only)
      if (p === "/auth/code" && req.method === "POST") {
        const { email: raw, site: forSite, studio: forStudio } = (await req.json()) as any; const email = String(raw || "").trim().toLowerCase();
        if (!emailOk(email)) return err(400, "Enter a valid email.");
        const known = await env.DB.prepare("select 1 from members where email = ? limit 1").bind(email).first();
        if (!known) return err(403, `${email} isn't a member here. Ask the owner to add you.`);
        const prev: any = await env.DB.prepare("select sent from codes where email = ?").bind(email).first();
        if (prev && Date.now() - prev.sent < 45_000) return err(429, "A code was just sent. Wait a minute before asking for another.");
        const code = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
        await env.DB.prepare("insert into codes (email, hash, expires, tries, sent) values (?, ?, ?, 0, ?) on conflict (email) do update set hash = excluded.hash, expires = excluded.expires, tries = 0, sent = excluded.sent")
          .bind(email, b64u(await hmac(env.SECRET, "c:" + email + ":" + code)), Date.now() + 10 * 60_000, Date.now()).run();
        // A site's admin page names its site: that site's own wording is used when this email is one of its editors.
        // The Studio's sign-in names the Studio: its own wording (Settings → Customize) for its members.
        let subject = "Your sign-in code", intro = `Enter this code to sign in${env.NAME ? " to " + env.NAME : ""}:`, footer = "It works for 10 minutes. If you didn't ask for it, ignore this email.", heading = "Your sign-in code";
        if (typeof forSite === "string" && /^[a-z0-9][a-z0-9-]{0,59}$/.test(forSite) && (await env.DB.prepare("select 1 from members where email = ? and scope = ? limit 1").bind(email, "site:" + forSite).first())) {
          const c = await siteContent(env, forSite).catch(() => null), T = c?.emails?.signin;
          if (T && typeof T === "object") {
            const vars = { site: siteName(c, forSite), email };
            if (T.subject) { subject = oneLine(fill(String(T.subject), vars)).slice(0, 150) || subject; heading = subject; }
            if (T.intro) intro = fill(String(T.intro), vars);
            if (T.footer) footer = fill(String(T.footer), vars);
          }
        }
        else if (typeof forStudio === "string" && /^[a-z0-9][a-z0-9-]{0,59}$/.test(forStudio) && (await env.DB.prepare("select 1 from members where email = ? and scope = ? limit 1").bind(email, "studio:" + forStudio).first())) {
          let E: any = null; try { const f = await readFile(env, "studio:" + forStudio, "public/emails.json"); if (f) E = JSON.parse(new TextDecoder().decode(f.bytes)); } catch { /* standard wording */ }
          const T = E?.signin;
          if (T && typeof T === "object") {
            const nm = oneLine(String(E.name || env.NAME || "the Studio")).slice(0, 80), vars = { studio: nm, site: nm, email };
            if (T.subject) { subject = oneLine(fill(String(T.subject), vars)).slice(0, 150) || subject; heading = subject; }
            if (T.intro) intro = fill(String(T.intro), vars);
            if (T.footer) footer = fill(String(T.footer), vars);
          }
        }
        // The same code on WhatsApp too, when the Studio or the site has that switched on and knows this person's number.
        let onWa = false;
        const waScope = typeof forSite === "string" && /^[a-z0-9][a-z0-9-]{0,59}$/.test(forSite) ? "site:" + forSite : typeof forStudio === "string" && /^[a-z0-9][a-z0-9-]{0,59}$/.test(forStudio) ? "studio:" + forStudio : "";
        if (waScope && (await env.DB.prepare("select 1 from members where email = ? and scope = ? limit 1").bind(email, waScope).first())) {
          const w = await getSetting(env, waScope, "wa").catch(() => null), num = waReady(w) && w.login && String(w.tplOtp || "").trim() ? waNum(waPhoneOf(w.phones, email), w.cc) : "";
          if (num) try { await waSend(w, num, w.tplOtp, [code], code); onWa = true; } catch { /* the email still goes */ }
        }
        try { await sendMail(env, email, subject, WRAP(`<h2 style="margin:0 0 12px;font-size:20px">${hesc(heading)}</h2>${paras(intro)}<p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:0 0 14px">${code}</p>${paras(footer, "margin:0 0 8px;color:#667;font-size:13px")}`)); }
        catch (e) { if (!onWa) throw e; }
        return json({ ok: true, ...(onWa ? { whatsapp: true } : {}) });
      }
      if (p === "/auth/verify" && req.method === "POST") {
        const b = (await req.json()) as any; const email = String(b.email || "").trim().toLowerCase(), code = String(b.code || "").trim();
        const c: any = await env.DB.prepare("select hash, expires, tries from codes where email = ?").bind(email).first();
        if (!c || c.expires < Date.now()) return err(403, "The code has expired. Ask for a new one.");
        if (c.tries >= 5) return err(429, "Too many tries. Ask for a new code.");
        if (b64u(await hmac(env.SECRET, "c:" + email + ":" + code)) !== c.hash) { await env.DB.prepare("update codes set tries = tries + 1 where email = ?").bind(email).run(); return err(403, "That code isn't right."); }
        await env.DB.prepare("delete from codes where email = ?").bind(email).run();
        return json({ token: await sessionFor(env, email), email });
      }
      if (p === "/me") {
        const e = await who(env, req); if (!e) return err(401, "Sign in first.");
        const rows = (await env.DB.prepare("select scope, role from members where email = ?").bind(e).all()).results || [];
        return json({ email: e, scopes: rows });
      }

      // ---- public reads for hosted sites: /p/<site>/<path>
      if (p.startsWith("/p/") && req.method === "GET") {
        const [, , site, ...rest] = p.split("/"); const path = decodeURIComponent(rest.join("/"));
        if (!/^[a-z0-9][a-z0-9-]{0,59}$/.test(site) || !pathOk(path) || !publicPath(path)) return err(404, "Not found.");
        const f = await readFile(env, "site:" + site, path); if (!f) return err(404, "Not found.");
        const head = { ...cors, "Content-Type": f.type || typeOf(path), "Cache-Control": path.startsWith("assets/") && !path.startsWith("assets/data/") ? "public, max-age=31536000, immutable" : "no-store", "x-sha": f.sha, "x-updated": f.updated_at, "Accept-Ranges": "bytes" };
        // A part of the file (Range: bytes=a-b), which video players use to seek, and iPhones need to play at all.
        const rg = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("Range") || ""), size = f.bytes.length;
        if (rg && (rg[1] || rg[2])) {
          const from = rg[1] ? +rg[1] : Math.max(0, size - +rg[2]), to = rg[1] && rg[2] ? Math.min(+rg[2], size - 1) : size - 1;
          if (from >= size || from > to) return new Response(null, { status: 416, headers: { ...cors, "Content-Range": `bytes */${size}` } });
          return new Response(f.bytes.slice(from, to + 1), { status: 206, headers: { ...head, "Content-Range": `bytes ${from}-${to}/${size}` } });
        }
        return new Response(f.bytes, { headers: head });
      }
      // ---- the Studio's own public pages (privacy, terms…): GET /sp/<studio> → its public/pages.json
      if (p.startsWith("/sp/") && req.method === "GET") {
        const id = p.split("/")[2] || "";
        if (!/^[a-z0-9][a-z0-9-]{0,59}$/.test(id)) return err(404, "Not found.");
        const f = await readFile(env, "studio:" + id, "public/pages.json"); if (!f) return err(404, "Not found.");
        return new Response(f.bytes, { headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
      }
      // ---- client approval (public, by an unguessable link): GET /rv/<token> the snapshot and its notes,
      //      GET /rv/<token>/f/<path> a picture of that project, POST /rv/<token>/note | /decide
      if (p.startsWith("/rv/") && !u.searchParams.has("scope")) {
        const [, , token, sub, ...rest] = p.split("/");
        if (!/^[a-f0-9]{32}$/.test(token || "")) return err(404, "Not found.");
        const a: any = await env.DB.prepare("select token, scope, project, name, template, note, status, decided_by, decided_at, created_by, created_at" + (sub ? "" : ", content") + " from approvals where token = ?").bind(token).first();
        if (!a) return err(404, "Not found.");
        if (a.status === "closed") return err(410, "This review link has been closed. Ask for a new one.");
        if (sub === "f" && req.method === "GET") {
          const path = decodeURIComponent(rest.join("/"));
          if (!pathOk(path) || !path.startsWith("assets/")) return err(404, "Not found.");
          const f = await readFile(env, a.scope, `projects/${a.project}/${path}`); if (!f) return err(404, "Not found.");
          return new Response(f.bytes, { headers: { ...cors, "Content-Type": f.type || "application/octet-stream", "Cache-Control": "private, max-age=600", "X-Content-Type-Options": "nosniff" } });
        }
        const notes = async () => ((await env.DB.prepare("select id, who, body, page, kind, created_at from approval_notes where token = ? order by id limit 300").bind(token).all()).results || []);
        if (!sub && req.method === "GET") {
          let content: any = {}; try { content = JSON.parse(a.content); } catch { /* an empty preview */ }
          return json({ name: a.name, template: a.template, note: a.note, status: a.status, decided_by: a.decided_by, decided_at: a.decided_at, created_at: a.created_at, content, notes: await notes() });
        }
        if ((sub === "note" || sub === "decide") && req.method === "POST") {
          const b = (await req.json().catch(() => ({}))) as any;
          const whoIs = oneLine(String(b.who || "")).slice(0, 80), body = String(b.body || "").trim().slice(0, 2000), now = new Date().toISOString();
          if (!whoIs) return err(400, "Enter your name.");
          const hour = new Date(Date.now() - 3600_000).toISOString();
          const n: any = await env.DB.prepare("select count(*) n, sum(case when created_at > ? then 1 else 0 end) h from approval_notes where token = ?").bind(hour, token).first();
          if ((n?.n || 0) >= 300 || (n?.h || 0) >= 40) return err(429, "Too many notes on this link for now. Try again later.");
          let kind = "comment", status = a.status;
          if (sub === "decide") {
            if (b.decision !== "approved" && b.decision !== "changes") return err(400, "Choose approve or request changes.");
            if (b.decision === "changes" && !body) return err(400, "Say what should change.");
            kind = b.decision; status = b.decision;
            await env.DB.prepare("update approvals set status = ?, decided_by = ?, decided_at = ? where token = ?").bind(status, whoIs, now, token).run();
          } else if (!body) return err(400, "Write your comment.");
          await env.DB.prepare("insert into approval_notes (token, who, body, page, kind, created_at) values (?, ?, ?, ?, ?, ?)").bind(token, whoIs, body, oneLine(String(b.page || "")).slice(0, 120), kind, now).run();
          // Tell the person who shared it (a copy only: the note is saved either way).
          const mail = (async () => {
            if (!env.RESEND_API_KEY || !env.MAIL_FROM || !EMAIL_RE.test(a.created_by || "")) return;
            const what = kind === "approved" ? "approved" : kind === "changes" ? "asked for changes to" : "commented on";
            await sendMail(env, a.created_by, `${whoIs} ${what} ${oneLine(a.name)}`.slice(0, 150), WRAP(`<h2 style="margin:0 0 12px;font-size:20px">${hesc(whoIs)} ${what} ${hesc(a.name)}</h2>${body ? paras(body) : ""}${paras("Open the project in your Studio → Share for approval to read it and reply.", "margin:0 0 8px;color:#667;font-size:13px")}`));
          })().catch((e) => { if ((env as any).DEBUG) console.log("approval mail:", e?.message); });
          if (ctx?.waitUntil) ctx.waitUntil(mail); else await mail;
          return json({ ok: true, status, notes: await notes() });
        }
        return err(404, "Not found.");
      }
      // ---- enquiries from a hosted site's form (public): POST /enquire/<site>; members read them with /e/*
      // ---- what a site's Order now page may use: a code on WhatsApp for the guest's number, and online payment
      if (/^\/site\/[a-z0-9][a-z0-9-]{0,59}\/can$/.test(p) && req.method === "GET") {
        const site = p.split("/")[2], w = await getSetting(env, "site:" + site, "wa").catch(() => null), z = await getSetting(env, "site:" + site, "rz").catch(() => null);
        return json({ otp: !!(waReady(w) && w.orderOtp && String(w.tplOtp || "").trim()), rz: z?.on && z.secret && z.keyId ? String(z.keyId) : "" });
      }
      if (/^\/otp\/(send|check)\/[a-z0-9][a-z0-9-]{0,59}$/.test(p) && req.method === "POST") {
        const site = p.split("/")[3], b = (await req.json()) as any, w = await getSetting(env, "site:" + site, "wa");
        if (!(waReady(w) && w.orderOtp && String(w.tplOtp || "").trim())) return err(404, "Not found.");
        const num = waNum(b.phone, w.cc); if (!num) return err(400, "Enter your mobile number with its country code.");
        const k = "o:" + site + ":" + num, now = Date.now();
        if (p.startsWith("/otp/send/")) {
          const prev: any = await env.DB.prepare("select sent from otps where k = ?").bind(k).first();
          if (prev && now - prev.sent < 45_000) return err(429, "A code was just sent. Wait a minute before asking for another.");
          // No more than 80 codes an hour for a site: each one is a paid message for its owner.
          const n: any = await env.DB.prepare("select count(*) n from otps where k like ? and sent > ?").bind("o:" + site + ":%", now - 3600_000).first();
          if ((n?.n || 0) >= 80) return err(429, "Too many codes were asked for. Please try again later, or call us.");
          const code = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
          await env.DB.prepare("insert into otps (k, hash, expires, tries, sent) values (?, ?, ?, 0, ?) on conflict (k) do update set hash = excluded.hash, expires = excluded.expires, tries = 0, sent = excluded.sent").bind(k, b64u(await hmac(env.SECRET, k + ":" + code)), now + 10 * 60_000, now).run();
          try { await waSend(w, num, w.tplOtp, [code], code); } catch { return err(502, "We couldn't send the code on WhatsApp just now. Check the number, or call us to order."); }
          return json({ ok: true });
        }
        const c: any = await env.DB.prepare("select hash, expires, tries from otps where k = ?").bind(k).first();
        if (!c || c.expires < now) return err(403, "The code has expired. Ask for a new one.");
        if (c.tries >= 5) return err(429, "Too many tries. Ask for a new code.");
        if (c.hash !== b64u(await hmac(env.SECRET, k + ":" + String(b.code || "").trim()))) { await env.DB.prepare("update otps set tries = tries + 1 where k = ?").bind(k).run(); return err(403, "That code isn't right."); }
        await env.DB.prepare("update otps set expires = 0 where k = ?").bind(k).run();
        const exp = now + 45 * 60_000;
        return json({ ok: true, token: exp + "." + b64u(await hmac(env.SECRET, "otp:" + site + ":" + num + ":" + exp)) });
      }
      // ---- an online payment for a restaurant order: the amount comes from the site's own menu, worked out here
      if (/^\/pay\/rz\/[a-z0-9][a-z0-9-]{0,59}$/.test(p) && req.method === "POST") {
        const site = p.split("/")[3], z = await getSetting(env, "site:" + site, "rz");
        if (!(z?.on && z.secret && z.keyId)) return err(404, "Online payment isn't set up for this site.");
        const q = (await req.json()) as any, no = String(q.order_no || "");
        if (!/^[A-Z0-9][A-Z0-9-]{3,29}$/.test(no)) return err(400, "Which order?");
        const c = await siteContent(env, site), bill = restBill(c, q);
        if ("error" in bill) return err(409, bill.error);
        if (Math.abs(bill.total - (+q.total || 0)) > 0.5) return err(409, "The menu or its prices changed while you were ordering. Refresh the page and check your cart.");
        const n: any = await env.DB.prepare("select count(*) n from payments where site = ? and created_at > ?").bind(site, new Date(Date.now() - 3600_000).toISOString()).first();
        if ((n?.n || 0) >= 200) return err(429, "Too many payments were started. Please try again in a while.");
        const amount = Math.round(bill.total * 100), cur = String(c?.food?.currency || "₹") === "₹" ? "INR" : "";
        if (!cur || amount < 100) return err(400, "Online payment works for totals in rupees of ₹1 or more.");
        const r = await fetch("https://api.razorpay.com/v1/orders", { method: "POST", headers: { Authorization: "Basic " + btoa(z.keyId + ":" + z.secret), "Content-Type": "application/json" }, body: JSON.stringify({ amount, currency: cur, receipt: no, notes: { site, order_no: no } }) });
        const j: any = await r.json().catch(() => null);
        if (!r.ok || !j?.id) return err(502, r.status === 401 ? "Razorpay refused this site's keys. The owner needs to check them." : "Razorpay couldn't start the payment just now. Please try again, or choose another way to pay.");
        await env.DB.prepare("insert into payments (rz_order, site, order_no, amount, status, created_at) values (?, ?, ?, ?, 'created', ?)").bind(String(j.id), site, no, amount, new Date().toISOString()).run();
        return json({ key: z.keyId, order_id: j.id, amount, currency: cur, name: siteName(c, site) });
      }
      // ---- how an order from a site's Order now page is doing, for the guest who placed it (the order's own key opens it)
      if (p.startsWith("/order/") && req.method === "GET") {
        const [, , site, no] = p.split("/"), k = u.searchParams.get("k") || "";
        if (!/^[a-z0-9][a-z0-9-]{0,59}$/.test(site || "") || !/^[A-Z0-9][A-Z0-9-]{3,29}$/.test(no || "") || !/^[a-f0-9]{16,64}$/.test(k)) return err(404, "Not found.");
        const rows = ((await env.DB.prepare("select status, data from enquiries where site = ? and data like ? order by id desc limit 5").bind(site, `%"order_no":"${no}"%`).all()).results || []) as any[];
        const hit = rows.find((r) => { try { const d = JSON.parse(r.data); return d.order_no === no && d.okey === k; } catch { return false; } });
        if (!hit) return err(404, "Not found.");
        let paid = ""; try { paid = String(JSON.parse(hit.data)._paid || ""); } catch { /* none */ }
        return json({ status: hit.status, paid });
      }
      if (p.startsWith("/enquire/") && req.method === "POST") {
        const site = p.split("/")[2]; if (!/^[a-z0-9][a-z0-9-]{0,59}$/.test(site)) return err(404, "Not found.");
        const raw = await req.text(); if (raw.length > 20000) return err(413, "Too long.");
        const q = JSON.parse(raw || "{}"); if (q.website) return json({ ok: true });
        const data: Record<string, string> = {};
        for (const [k, v] of Object.entries(q.data || {}).slice(0, 25)) if (/^[a-z0-9][\w-]{0,39}$/i.test(k) && v != null && String(v).trim()) data[k] = String(v).slice(0, 5000);
        if (!Object.keys(data).length) return err(400, "The form was empty.");
        if (data.order_no) {
          // The guest's mobile number, proved with a code on WhatsApp, when the site asks for that.
          const w = await getSetting(env, "site:" + site, "wa").catch(() => null);
          if (waReady(w) && w.orderOtp && String(w.tplOtp || "").trim()) {
            const num = waNum(data.phone, w.cc), [exp, sig] = String(data.otp_token || "").split(".");
            if (!num || !(+exp > Date.now()) || sig !== b64u(await hmac(env.SECRET, "otp:" + site + ":" + num + ":" + exp))) return err(403, "Please verify your mobile number first.");
            data._phone = "Verified on WhatsApp";
          }
          delete data.otp_token;
          // An online payment is accepted only with Razorpay's own signature for the payment this database started.
          if (data.rz_order || data.rz_payment || data.rz_sig) {
            const z = await getSetting(env, "site:" + site, "rz").catch(() => null);
            const row: any = z?.secret ? await env.DB.prepare("select order_no, amount from payments where rz_order = ? and site = ?").bind(String(data.rz_order || ""), site).first() : null;
            const want = row ? hex((await hmac(z.secret, data.rz_order + "|" + data.rz_payment)).buffer as ArrayBuffer) : "";
            if (!row || row.order_no !== data.order_no || !want || want !== String(data.rz_sig || "")) return err(400, "The payment couldn't be confirmed. If money left your account, contact us with your order number.");
            await env.DB.prepare("update payments set status = 'paid' where rz_order = ?").bind(data.rz_order).run();
            data._paid = "yes"; data._paid_by = `Razorpay, ₹${(row.amount / 100).toFixed(2).replace(/\.00$/, "")}, ${String(data.rz_payment).slice(0, 40)}`;
            delete data.rz_sig;
          }
        }
        const made: any = await env.DB.prepare("insert into enquiries (site, data, page, created_at) values (?, ?, ?, ?) returning id").bind(site, JSON.stringify(data), String(q.page || "").slice(0, 200), new Date().toISOString()).first();
        // The enquiry is saved either way; the email is a copy, so a mail failure never fails the form. What happened
        // to the email is noted on the enquiry (_mail: keys starting with "_" never come from the visitor).
        const rowId = made?.id;
        const mail = Promise.all([notifyEnquiry(env, site, data, String(q.page || "").slice(0, 200)).catch((e: any) => "Not emailed: " + String(e?.message || e).slice(0, 300)), waAlert(env, site, data).catch(() => "")])
          .then(([said, wa]) => ((said || wa) && rowId ? env.DB.prepare("update enquiries set data = ? where id = ? and site = ?").bind(JSON.stringify({ ...data, ...(said ? { _mail: said } : {}), ...(wa ? { _wa: wa } : {}) }), rowId, site).run() : null)).catch(() => {});
        if (ctx?.waitUntil) ctx.waitUntil(mail); else await mail;
        return json({ ok: true });
      }

      // ---- new site text from a reference site's outline (Workers AI), for any Studio or site owner
      if (p === "/reviews/google" && req.method === "POST") {
        const email = await who(env, req); if (!email) return err(401, "Sign in first.");
        if (!(await env.DB.prepare("select 1 from members where email = ? and role in ('owner', 'partner') limit 1").bind(email).first())) return err(403, "Only owners can use this.");
        return json(await googleReviews((await req.json()) as any));
      }
      if (p === "/ai/products" && req.method === "POST") {
        const email = await who(env, req); if (!email) return err(401, "Sign in first.");
        if (!(await env.DB.prepare("select 1 from members where email = ? and role in ('owner', 'partner') limit 1").bind(email).first())) return err(403, "Only owners can use this.");
        if (!env.AI) return err(501, "Reading pamphlets needs the database updated once (from a device with the Cloudflare token).");
        return json(await readPamphlet(env, (await req.json()) as any));
      }
      // ---- translate a site's text into another language (Workers AI), for Languages in the editor
      if (p === "/ai/translate" && req.method === "POST") {
        const email = await who(env, req); if (!email) return err(401, "Sign in first.");
        if (!(await env.DB.prepare("select 1 from members where email = ? limit 1").bind(email).first())) return err(403, "Only members can use this.");
        if (!env.AI) return json({ error: "Translating needs Workers AI on this database. Update the database once (Settings → Hostings)." });
        return json(await translateTexts(env, (await req.json()) as any));
      }
      // ---- how a reference page looks (colours, fonts, corners, interaction libraries), for "theme from a reference"
      if (p === "/ai/look" && req.method === "POST") {
        const email = await who(env, req); if (!email) return err(401, "Sign in first.");
        if (!(await env.DB.prepare("select 1 from members where email = ? limit 1").bind(email).first())) return err(403, "Only members can use this.");
        return json(await lookAt(String(((await req.json()) as any).url || "")));
      }
      // A reference page's text outline, for the on-device writer. No AI is used, so it costs nothing from the allowance.
      if (p === "/ai/outline" && req.method === "POST") {
        const email = await who(env, req); if (!email) return err(401, "Sign in first.");
        if (!(await env.DB.prepare("select 1 from members where email = ? and role in ('owner', 'partner') limit 1").bind(email).first())) return err(403, "Only owners can use this.");
        const q = (await req.json()) as any, u2 = publicUrl(String(q?.url || "").trim());
        if (!u2) return json({ error: "Enter the site's public address (https://…)." });
        let r2: Response; try { r2 = await fetch(u2.href, { headers: { "User-Agent": "Mozilla/5.0 (site-studio reference reader)", Accept: "text/html" }, redirect: "follow" }); } catch { return json({ error: "Couldn't open that address." }); }
        if (!r2.ok) return json({ error: `That site answered ${r2.status}.` });
        return json({ text: outlineOf((await r2.text()).slice(0, 3_000_000)).slice(0, 20000) });
      }
      // The pictures on a reference page (no AI): the list, and one picture's bytes so the Studio can keep a copy the owner chose.
      if ((p === "/ai/pictures" || p === "/ai/picture") && req.method === "POST") {
        const email = await who(env, req); if (!email) return err(401, "Sign in first.");
        if (!(await env.DB.prepare("select 1 from members where email = ? and role in ('owner', 'partner') limit 1").bind(email).first())) return err(403, "Only owners can use this.");
        const q = (await req.json()) as any, u2 = publicUrl(String(q?.url || "").trim());
        if (!u2) return json({ error: "Enter the site's public address (https://…)." });
        let r2: Response; try { r2 = await fetch(u2.href, { headers: { "User-Agent": "Mozilla/5.0 (site-studio reference reader)", Accept: p === "/ai/picture" ? "image/*" : "text/html" }, redirect: "follow" }); } catch { return json({ error: "Couldn't open that address." }); }
        if (!r2.ok) return json({ error: `That site answered ${r2.status}.` });
        if (p === "/ai/picture") {
          const type = (r2.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
          if (!/^image\/(jpeg|png|webp|gif|avif)$/.test(type)) return json({ error: "That address isn't a picture the site can use (JPG, PNG, WebP, GIF or AVIF)." });
          const buf = await r2.arrayBuffer(); if (buf.byteLength > 6 * 1024 * 1024) return json({ error: "That picture is over 6 MB." });
          return new Response(buf, { headers: { ...cors, "Content-Type": type, "Cache-Control": "no-store" } });
        }
        return json({ pictures: picturesOf((await r2.text()).slice(0, 3_000_000), u2) });
      }
      if (p === "/ai/write" && req.method === "POST") {
        const email = await who(env, req); if (!email) return err(401, "Sign in first.");
        if (!(await env.DB.prepare("select 1 from members where email = ? and role in ('owner', 'partner') limit 1").bind(email).first())) return err(403, "Only owners can use this.");
        if (!env.AI) return err(501, "Writing needs the database updated once (Settings → Hosting accounts, from a device with the Cloudflare token).");
        return json(await writeSite(env, (await req.json()) as any));
      }

      // ---- everything else needs a member of the scope
      const email = await who(env, req); if (!email) return err(401, "Sign in first.");
      const scope = u.searchParams.get("scope") || "";
      if (!scopeOk(scope)) return err(400, "Unknown scope.");
      const role = await roleOf(env, scope, email);
      if (!role) return err(403, `${email} isn't a member of this ${scope.startsWith("site:") ? "site" : "Studio"}.`);

      // ---- connections (the owner's own AI API, WhatsApp, Razorpay): owners set them; the keys are never sent back
      if (p === "/set" || p === "/set/test" || p === "/set/wa") {
        if (role !== "owner") return err(403, "Only an owner can change connections.");
        // WhatsApp set up from the token: find the account, make the templates, send a test code.
        if (p === "/set/wa" && req.method === "POST") {
          const b = (await req.json()) as any, old = (await getSetting(env, scope, "wa")) || {}, token = String(b.token || "").trim() || String(old.token || "");
          if (!token) return json({ error: "Paste the access token first." });
          if (b.do === "find") {
            const f = await waFind(token, String(b.waba || old.waba || "").trim());
            // A token that works is kept at once, so the next steps need nothing typed again.
            if (f.wabas.length && String(b.token || "").trim()) await putSetting(env, scope, "wa", { ...old, token });
            return json(f);
          }
          if (b.do === "templates") {
            const waba = String(b.waba || old.waba || "").trim(); if (!/^\d{6,20}$/.test(waba)) return json({ error: "Which WhatsApp account? Press Connect first." });
            const lang = String(b.lang || old.lang || "en").trim() || "en", out: any[] = [];
            for (const k of (Array.isArray(b.make) ? b.make : []).filter((x: string) => WA_TPL[x]).slice(0, 3)) {
              const t = WA_TPL[k](lang);
              try { const r = await graph(token, `/${waba}/message_templates`, { method: "POST", body: t }); out.push({ kind: k, name: t.name, status: String(r?.status || "PENDING") }); }
              catch (e: any) { out.push({ kind: k, name: t.name, ...(/already exists|2388024/i.test(String(e?.message) + e?.code) ? { status: "EXISTS" } : { error: String(e?.message || e).slice(0, 240) }) }); }
            }
            return json({ made: out });
          }
          if (b.do === "test") {
            const to = waNum(b.to, old.cc), tpl = String(b.tpl || old.tplOtp || "").trim(), phoneId = String(b.phoneId || old.phoneId || "").trim();
            if (!to) return json({ error: "Enter the WhatsApp number to send the test to." }); if (!tpl || !phoneId) return json({ error: "Choose the number to send from and the template for codes first." });
            try { await waSend({ token, phoneId, lang: b.lang || old.lang }, to, tpl, ["123456"], "123456"); return json({ ok: true }); } catch (e: any) { return json({ error: String(e?.message || e).slice(0, 300) }); }
          }
          return err(400, "Unknown step.");
        }
        if (p === "/set" && req.method === "GET") { const o: any = {}; for (const n of Object.keys(SETTINGS)) o[n] = maskSetting(n, await getSetting(env, scope, n)); return json(o); }
        const b = (await req.json()) as any, name = String(b.name || ""), S = SETTINGS[name]; if (!S) return err(400, "Unknown connection.");
        if (p === "/set/test") {
          if (name !== "ai") return err(400, "Nothing to test.");
          const c = await getSetting(env, scope, "ai"); if (!c?.key || !c.model || !publicUrl(String(c.base || "").trim())) return json({ error: "Fill in the address, the model and the key first." });
          try { const r: any = await customAI(c).run("", { messages: [{ role: "user", content: "Reply with the single word: ready" }], max_tokens: 20, temperature: 0 }); return json({ ok: true, said: String(r.response || "").trim().slice(0, 80) }); }
          catch (e: any) { return json({ error: String(e?.message || e).slice(0, 300) }); }
        }
        if (b.value == null) { await putSetting(env, scope, name, null); return json({ ok: true }); }
        const old = (await getSetting(env, scope, name)) || {}, v: any = {};
        for (const k of S.text) v[k] = String(b.value[k] ?? old[k] ?? "").slice(0, 3000).trim();
        for (const k of S.flags) v[k] = b.value[k] == null ? !!old[k] : !!b.value[k];
        // A secret left empty keeps the one already saved.
        for (const k of S.secret) v[k] = String(b.value[k] || "").trim().slice(0, 600) || old[k] || "";
        if (name === "ai" && v.base && !publicUrl(v.base)) return err(400, "The API address must be a public https:// address.");
        await putSetting(env, scope, name, v);
        return json({ ok: true, value: maskSetting(name, v) });
      }
      if (p === "/f/list") {
        const pre = u.searchParams.get("prefix") || "";
        const rows = (await env.DB.prepare("select path from files where scope = ? and substr(path, 1, ?) = ? order by path").bind(scope, pre.length, pre).all()).results || [];
        return json(rows.map((r: any) => r.path));
      }
      const path = u.searchParams.get("path") || "";
      if (p === "/f/meta") { const f: any = await env.DB.prepare("select sha, size, updated_at from files where scope = ? and path = ?").bind(scope, path).first(); return json(f || null); }
      if (p === "/f/get") {
        const f = await readFile(env, scope, path); if (!f) return err(404, "Not found.");
        return new Response(f.bytes, { headers: { ...cors, "Content-Type": f.type || typeOf(path), "x-sha": f.sha, "x-updated": f.updated_at } });
      }
      if (p === "/f/put" && req.method === "PUT") {
        if (!pathOk(path)) return err(400, "Bad file name.");
        const want = u.searchParams.get("sha");
        if (want) { const cur: any = await env.DB.prepare("select sha from files where scope = ? and path = ?").bind(scope, path).first(); if (cur && cur.sha !== want) return err(409, "The file changed since it was loaded."); }
        const sha = await writeFile(env, scope, path, new Uint8Array(await req.arrayBuffer()), req.headers.get("x-sha") || undefined);
        return json({ sha });
      }
      if (p === "/f/delete" && req.method === "POST") {
        const { paths } = (await req.json()) as any; const list = (Array.isArray(paths) ? paths : []).filter(pathOk).slice(0, 500);
        await env.DB.batch(list.flatMap((x: string) => [env.DB.prepare("delete from chunks where scope = ? and path = ?").bind(scope, x), env.DB.prepare("delete from files where scope = ? and path = ?").bind(scope, x)]));
        return json({ ok: true, n: list.length });
      }
      // ---- Other Cloudflare accounts, managed from any device (Settings → Sites and hosting accounts). Tokens go in as
      // Worker secrets (CFX_<account>) through the main token kept here and are never read back; only names and ids.
      if (p.startsWith("/cfx")) {
        if (!scope.startsWith("studio:")) return err(400, "Only for the Studio's own scope.");
        if (role !== "owner" && role !== "partner") return err(403, "Only the Studio's owners can change its hosting accounts.");
        const keepSecret = async (name: string, text: string | null) => {
          if (!env.CF_TOKEN || !env.CF_ACCOUNT) return err(409, "Turn on Publish from any device first (Settings), so the database can keep tokens itself.");
          const base = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT}/workers/scripts/${CFDB_WORKER_NAME}/secrets`;
          const r = text == null
            ? await fetch(base + "/" + name, { method: "DELETE", headers: { Authorization: "Bearer " + env.CF_TOKEN } })
            : await fetch(base, { method: "PUT", headers: { Authorization: "Bearer " + env.CF_TOKEN, "Content-Type": "application/json" }, body: JSON.stringify({ name, text, type: "secret_text" }) });
          if (!r.ok && !(text == null && r.status === 404)) return err(502, "Cloudflare didn't keep it: " + (((await r.json().catch(() => null)) as any)?.errors?.[0]?.message || r.status));
          return null;
        };
        if (p === "/cfx" && req.method === "GET") return json({ main: env.CF_TOKEN && env.CF_ACCOUNT ? env.CF_ACCOUNT : null, accounts: otherAccounts(env),
          // Sites every device can publish: "<worker>" on the main account, "<account>/<worker>" on another.
          workers: (((await env.DB.prepare("select worker from workers where scope = ? limit 500").bind(scope).all()).results || []) as any[]).map((r) => String(r.worker).split("@")[0]) });
        if (p === "/cfx/put" && req.method === "POST") {
          const b = (await req.json()) as any, token = String(b.token || "").trim();
          if (!/^[\w-]{20,200}$/.test(token)) return err(400, "Paste the account's Cloudflare API token.");
          const r = await fetch("https://api.cloudflare.com/client/v4/accounts?per_page=50", { headers: { Authorization: "Bearer " + token } });
          const list = ((await r.json().catch(() => null)) as any)?.result || [];
          if (!r.ok || !list.length) return err(400, "Cloudflare didn't accept that token, or it can't see any account. Create it while signed in to that account.");
          const kept: { id: string; name: string }[] = [];
          for (const a of list) {
            if (!/^[\w-]{1,64}$/.test(String(a.id)) || a.id === env.CF_ACCOUNT) continue;
            const bad = await keepSecret("CFX_" + String(a.id).replace(/-/g, "_"), JSON.stringify({ t: token, n: String(a.name || "").slice(0, 80) }));
            if (bad) return bad;
            kept.push({ id: a.id, name: String(a.name || "") });
          }
          if (!kept.length) return err(400, "That token is for the Studio's own Cloudflare account, which is already used.");
          return json({ ok: true, accounts: kept });
        }
        if (p === "/cfx/delete" && req.method === "POST") {
          const a = String(((await req.json()) as any).account || "");
          if (!/^[\w-]{1,64}$/.test(a)) return err(400, "Which account?");
          return (await keepSecret("CFX_" + a.replace(/-/g, "_"), null)) || json({ ok: true });
        }
        if (p === "/cfx/site" && req.method === "POST") {
          // Lets the Studio's owners publish this site's Worker on that account from any device.
          const b = (await req.json()) as any, a = String(b.account || ""), w = String(b.worker || "");
          if (!/^[\w-]{1,64}$/.test(a) || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(w)) return err(400, "Which site?");
          const main = a === env.CF_ACCOUNT;
          if (!main && !otherToken(env, a)) return err(409, "That Cloudflare account isn't kept here yet: add it first.");
          await env.DB.prepare("insert into workers (worker, scope) values (?, ?) on conflict (worker) do update set scope = excluded.scope").bind(main ? w : a + "/" + w + "@" + scope, scope).run();
          // Its content in this database too: the site's own owners can publish it (and the Studio publishes it as the site).
          const site = String(b.site || "");
          if (/^[a-z0-9][a-z0-9-]{0,62}$/.test(site)) await env.DB.prepare("insert into workers (worker, scope) values (?, ?) on conflict (worker) do update set scope = excluded.scope").bind(main ? w : a + "/" + w + "@site:" + site, "site:" + site).run();
          return json({ ok: true });
        }
        if (p === "/cfx/db" && req.method === "POST") {
          // A site's own database on another Cloudflare account, reached through this one: its files read and written
          // with Cloudflare's D1 API and that account's kept token. The site's data stays in its own database; the
          // Studio's owners reach it from any device without signing in to it separately.
          const b = (await req.json()) as any, a = String(b.account || ""), site = String(b.site || ""), op = String(b.op || "");
          if (!/^[\w-]{1,64}$/.test(a) || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(site)) return err(400, "Which site?");
          const tok = otherToken(env, a) || (a === env.CF_ACCOUNT ? env.CF_TOKEN || "" : "");
          if (!tok) return err(409, "That Cloudflare account isn't kept here yet: add it in Settings → Sites and hosting accounts.");
          const cfa = async (path: string, init: any = {}) => {
            const r = await fetch("https://api.cloudflare.com/client/v4/accounts/" + a + path, { ...init, headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json" } });
            const j: any = await r.json().catch(() => null);
            if (!r.ok || !j?.success) { const e: any = new Error(j?.errors?.[0]?.message || "Cloudflare answered " + r.status); e.cf = true; throw e; }
            return j.result;
          };
          let dbId = String(b.db || "");
          const q = async (sql: string, params: unknown[] = []) => ((await cfa(`/d1/database/${dbId}/query`, { method: "POST", body: JSON.stringify({ sql, params }) }))?.[0]?.results || []) as any[];
          const bytesOf = (v: any): Uint8Array => Array.isArray(v) ? new Uint8Array(v) : typeof v === "string" ? Uint8Array.from(atob(v), (c) => c.charCodeAt(0)) : v && Array.isArray(v.data) ? new Uint8Array(v.data) : new Uint8Array(0);
          const hex = (u: Uint8Array) => { let s = ""; for (let i = 0; i < u.length; i++) s += (u[i] < 16 ? "0" : "") + u[i].toString(16); return s; };
          const b64 = (u: Uint8Array) => { let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
          const S2 = "site:" + site, path = String(b.path || "");
          try {
            if (!/^[\w-]{1,64}$/.test(dbId)) {
              const list = (await cfa(`/d1/database?name=${encodeURIComponent(CFDB_WORKER_NAME)}`)) || [];
              dbId = String(list.find((d: any) => d.name === CFDB_WORKER_NAME)?.uuid || "");
              if (!dbId) return err(404, "No Studio database on that Cloudflare account.");
            }
            if (op === "list") {
              const pre = String(b.prefix || "");
              return json({ db: dbId, paths: (await q("select path from files where scope = ? and substr(path, 1, ?) = ? order by path", [S2, pre.length, pre])).map((r) => r.path) });
            }
            if (op === "meta") return json({ db: dbId, meta: (await q("select sha, updated_at from files where scope = ? and path = ?", [S2, path]))[0] || null });
            if (op === "get") {
              if (!pathOk(path)) return err(400, "Bad file name.");
              const f = (await q("select sha, size, type, updated_at from files where scope = ? and path = ?", [S2, path]))[0];
              if (!f) return json({ db: dbId, file: null });
              const parts = (await q("select data from chunks where scope = ? and path = ? order by n", [S2, path])).map((r) => bytesOf(r.data));
              const all = new Uint8Array(parts.reduce((x, y) => x + y.length, 0)); let o = 0; for (const x of parts) { all.set(x, o); o += x.length; }
              return json({ db: dbId, file: { b64: b64(all), sha: f.sha, type: f.type, updated_at: f.updated_at } });
            }
            if (op === "put") {
              if (!pathOk(path)) return err(400, "Bad file name.");
              const bytes = bytesOf(String(b.b64 || ""));
              if (b.sha) { const cur = (await q("select sha from files where scope = ? and path = ?", [S2, path]))[0]; if (cur && cur.sha !== String(b.sha)) return err(409, "The file changed since it was loaded."); }
              const s = "c" + (await sha1(bytes));
              // Chunks first (unhex keeps the bytes exact through the API), then the file's row, then any old extra chunks.
              let size = 700_000, n = Math.max(1, Math.ceil(bytes.length / size)), lit = false;
              const putChunk = async (i: number) => {
                const part = bytes.slice(i * size, (i + 1) * size);
                if (lit) await q(`insert into chunks (scope, path, n, data) values (?, ?, ?, X'${hex(part)}') on conflict (scope, path, n) do update set data = excluded.data`, [S2, path, i]);
                else await q("insert into chunks (scope, path, n, data) values (?, ?, ?, unhex(?)) on conflict (scope, path, n) do update set data = excluded.data", [S2, path, i, hex(part)]);
              };
              try { for (let i = 0; i < n; i++) await putChunk(i); }
              catch (e: any) { if (!/unhex|no such function/i.test(String(e?.message))) throw e; lit = true; size = 40_000; n = Math.max(1, Math.ceil(bytes.length / size)); for (let i = 0; i < n; i++) await putChunk(i); }
              await q("insert into files (scope, path, sha, size, parts, type, updated_at) values (?, ?, ?, ?, ?, ?, ?) on conflict (scope, path) do update set sha = excluded.sha, size = excluded.size, parts = excluded.parts, type = excluded.type, updated_at = excluded.updated_at", [S2, path, s, bytes.length, n, typeOf(path), new Date().toISOString()]);
              await q("delete from chunks where scope = ? and path = ? and n >= ?", [S2, path, n]);
              return json({ db: dbId, sha: s });
            }
            if (op === "enq") {
              // The site's enquiries (business sites): list, change status, delete.
              const sub = String(b.sub || "list");
              if (sub === "list") return json({ db: dbId, rows: (await q("select id, site, data, page, status, created_at from enquiries where site = ? order by created_at desc limit 500", [site])).map((r: any) => { let d = {}; try { d = JSON.parse(r.data); } catch { /* kept as is */ } return { ...r, data: d }; }) });
              const id = Number(b.id); if (!Number.isInteger(id)) return err(400, "Which enquiry?");
              if (sub === "paid") { const rw = (await q("select data from enquiries where id = ? and site = ?", [id, site]))[0] as any; if (!rw) return err(404, "Not found."); const d = JSON.parse(rw.data); if (!d.order_no) return err(400, "That isn't an order."); if (b.paid) d._paid = "yes"; else delete d._paid; await q("update enquiries set data = ? where id = ? and site = ?", [JSON.stringify(d), id, site]); return json({ db: dbId, ok: true }); }
              if (sub === "status") { const st = String(b.status || ""); if (!["new", "read", "replied", "archived", "accepted", "preparing", "ready", "out", "done", "cancelled"].includes(st)) return err(400, "Unknown status."); await q("update enquiries set status = ? where id = ? and site = ?", [st, id, site]); return json({ db: dbId, ok: true }); }
              if (sub === "delete") { await q("delete from enquiries where id = ? and site = ?", [id, site]); return json({ db: dbId, ok: true }); }
              return err(400, "Unknown operation.");
            }
            if (op === "mem") {
              // The site's sign-in emails (its editors): list, add, remove.
              const sub = String(b.sub || "list");
              if (sub === "list") return json({ db: dbId, rows: await q("select email, role from members where scope = ? order by email", [S2]) });
              const e = String(b.email || "").trim().toLowerCase(); if (!emailOk(e)) return err(400, "Enter a valid email.");
              if (sub === "add") { await q("insert into members (scope, email, role) values (?, ?, 'owner') on conflict (scope, email) do nothing", [S2, e]); return json({ db: dbId, ok: true }); }
              if (sub === "remove") { await q("delete from members where scope = ? and email = ?", [S2, e]); return json({ db: dbId, ok: true }); }
              return err(400, "Unknown operation.");
            }
            if (op === "delete") {
              const list = (Array.isArray(b.paths) ? b.paths : []).filter(pathOk).slice(0, 200);
              for (const x of list) { await q("delete from chunks where scope = ? and path = ?", [S2, x]); await q("delete from files where scope = ? and path = ?", [S2, x]); }
              return json({ db: dbId, n: list.length });
            }
            return err(400, "Unknown operation.");
          } catch (e: any) { return err(502, "Couldn't reach the site's database on its Cloudflare account: " + (e?.message || e)); }
        }
        if (p === "/cfx/import" && req.method === "POST") {
          // Copies a site from the Studio's database on another Cloudflare account into this one, with that account's
          // kept token and Cloudflare's D1 API: no sign-in to the old database needed, from any device. Step by step
          // (the Studio calls it once to start, then once per file), so each call stays small.
          const b = (await req.json()) as any, a = String(b.account || ""), site = String(b.site || ""), step = String(b.step || "start");
          if (!/^[\w-]{1,64}$/.test(a) || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(site)) return err(400, "Which site?");
          const tok = otherToken(env, a); if (!tok) return err(409, "That Cloudflare account isn't kept here yet: add it first (Settings → Sites and hosting accounts).");
          const cfa = async (path: string, init: any = {}) => {
            const r = await fetch("https://api.cloudflare.com/client/v4/accounts/" + a + path, { ...init, headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json" } });
            const j: any = await r.json().catch(() => null);
            if (!r.ok || !j?.success) throw new Error(j?.errors?.[0]?.message || "Cloudflare answered " + r.status);
            return j.result;
          };
          const q = async (dbId: string, sql: string, params: unknown[]) => ((await cfa(`/d1/database/${dbId}/query`, { method: "POST", body: JSON.stringify({ sql, params }) }))?.[0]?.results || []) as any[];
          const bytesOf = (v: any): Uint8Array => Array.isArray(v) ? new Uint8Array(v) : typeof v === "string" ? Uint8Array.from(atob(v), (c) => c.charCodeAt(0)) : v && Array.isArray(v.data) ? new Uint8Array(v.data) : new Uint8Array(0);
          const S2 = "site:" + site;
          try {
            if (step === "start") {
              const list = (await cfa(`/d1/database?name=${encodeURIComponent(CFDB_WORKER_NAME)}`)) || [];
              const dbId = String(list.find((d: any) => d.name === CFDB_WORKER_NAME)?.uuid || "");
              if (!dbId) return err(404, "No Studio database on that Cloudflare account.");
              const files = await q(dbId, "select path, sha, size, parts, type, updated_at from files where scope = ? order by path", [S2]);
              if (!files.some((f) => f.path === "content.json")) return err(404, `The site ${site} has no content in that database.`);
              // Editors (with their roles) and enquiries, in this first call.
              const mem = await q(dbId, "select email, role from members where scope = ?", [S2]);
              for (const m of mem) if (emailOk(String(m.email || ""))) await env.DB.prepare("insert into members (scope, email, role) values (?, ?, ?) on conflict (scope, email) do nothing").bind(S2, String(m.email).toLowerCase(), ["owner", "member", "partner"].includes(m.role) ? m.role : "member").run();
              let enquiries = 0;
              if (!(await env.DB.prepare("select 1 from enquiries where site = ? limit 1").bind(site).first())) {
                const rows = await q(dbId, "select data, page, status, created_at from enquiries where site = ? order by created_at limit 1000", [site]);
                for (const r of rows) await env.DB.prepare("insert into enquiries (site, data, page, status, created_at) values (?, ?, ?, ?, ?)").bind(site, String(r.data || "{}"), String(r.page || ""), String(r.status || "new"), String(r.created_at || new Date().toISOString())).run();
                enquiries = rows.length;
              }
              return json({ db: dbId, files: files.map((f) => f.path), editors: mem.length, enquiries });
            }
            if (step === "file") {
              const dbId = String(b.db || ""), path = String(b.path || "");
              if (!/^[\w-]{1,64}$/.test(dbId) || !pathOk(path)) return err(400, "Which file?");
              const f = (await q(dbId, "select sha, size, parts, type, updated_at from files where scope = ? and path = ?", [S2, path]))[0];
              if (!f) return json({ ok: false, missing: path });
              const chunks = await q(dbId, "select n, data from chunks where scope = ? and path = ? order by n", [S2, path]);
              await env.DB.batch([
                env.DB.prepare("delete from chunks where scope = ? and path = ?").bind(S2, path),
                env.DB.prepare("insert into files (scope, path, sha, size, parts, type, updated_at) values (?, ?, ?, ?, ?, ?, ?) on conflict (scope, path) do update set sha = excluded.sha, size = excluded.size, parts = excluded.parts, type = excluded.type, updated_at = excluded.updated_at").bind(S2, path, String(f.sha), Number(f.size) || 0, chunks.length || 1, String(f.type || ""), String(f.updated_at || new Date().toISOString())),
                ...chunks.map((c) => env.DB.prepare("insert into chunks (scope, path, n, data) values (?, ?, ?, ?)").bind(S2, path, Number(c.n) || 0, bytesOf(c.data))),
              ]);
              return json({ ok: true });
            }
          } catch (e: any) { return err(502, "Couldn't read the other account's database: " + (e?.message || e)); }
          return err(400, "Unknown step.");
        }
        return err(404, "Not found.");
      }
      // ---- publish from any device: the calls a site's (or Studio's) pages need, made with the token kept here.
      // Only Workers registered to this scope (the `workers` table, written by the Studio with the token), only by
      // its owners and partners, and only with no bindings but its own files, so nobody gets more than the pages.
      if (p === "/cf" && req.method === "POST") {
        if (role !== "owner" && role !== "partner") return err(403, "Only the owners of this site can publish it.");
        const q = (await req.json()) as any, method = String(q.method || "GET").toUpperCase(), path = String(q.path || "");
        // Which account: the main one (CF_TOKEN) or another account kept here (CFX_<account id>), from the call's path.
        const A = (/^\/accounts\/([\w-]+)\//.exec(path) || [])[1] || env.CF_ACCOUNT || "";
        const tokenOf = otherToken(env, A) || (A === env.CF_ACCOUNT ? env.CF_TOKEN : "");
        if (!tokenOf) return err(501, "This database can't publish there: no Cloudflare token for that account is kept here.");
        const main = A === env.CF_ACCOUNT;
        const ACC = "/accounts/" + A + "/workers";
        let worker = "", useJwt = false, m: RegExpMatchArray | null;
        if (method === "GET" && path === ACC + "/subdomain") { /* the account's workers.dev name */ }
        else if (method === "POST" && path === ACC + "/assets/upload?base64=true") useJwt = true;
        else if ((m = path.match(/^\/accounts\/([\w-]+)\/workers\/scripts\/([a-z0-9][a-z0-9-]{0,62})(\/settings|\/assets-upload-session|\/subdomain|\?force=true)?$/)) && m[1] === A
          && ((method === "GET" && m[3] === "/settings") || (method === "POST" && (m[3] === "/assets-upload-session" || m[3] === "/subdomain")) || (method === "PUT" && !m[3]) || (method === "DELETE" && m[3] === "?force=true"))) worker = m[2];
        else return err(403, "Not something publishing needs.");
        if (worker && !(await env.DB.prepare("select 1 from workers where worker = ? and scope = ?").bind(main ? worker : A + "/" + worker + "@" + scope, scope).first())) return err(403, `The Worker ${worker} isn't registered to ${scope}. Publish once from a device with the Cloudflare token.`);
        const body = q.body64 ? Uint8Array.from(atob(String(q.body64)), (c) => c.charCodeAt(0)) : q.body != null ? String(q.body) : undefined;
        if (method === "PUT") {
          const text = typeof body === "string" ? body : new TextDecoder().decode(body);
          const mm = /name="metadata"[^\r\n]*\r\n(?:[^\r\n]+\r\n)*\r\n(\{[\s\S]*?\})\r\n--/.exec(text);
          let meta: any = null; try { meta = mm ? JSON.parse(mm[1]) : null; } catch { meta = null; }
          if (!meta || !Array.isArray(meta.bindings) || meta.bindings.some((x: any) => x?.type !== "assets") || meta.keep_bindings) return err(403, "A site's Worker can only be given its own files.");
        }
        if (useJwt && !/^[\w.~+/=-]{8,4096}$/.test(String(q.jwt || ""))) return err(400, "Missing upload token.");
        const r = await fetch("https://api.cloudflare.com/client/v4" + path, { method, headers: { Authorization: "Bearer " + (useJwt ? q.jwt : tokenOf), ...(q.contentType ? { "Content-Type": String(q.contentType) } : {}) }, body: method === "GET" ? undefined : body });
        return json({ status: r.status, body: await r.text() });
      }
      // ---- GitHub Pages sites from any device: calls on repositories registered to this scope, with the kept token.
      if (p === "/gh" && req.method === "POST") {
        if (!env.GH_TOKEN) return err(501, "This database can't reach GitHub: no GitHub token is kept here.");
        if (role !== "owner" && role !== "partner") return err(403, "Only this Studio's owners can publish its GitHub sites.");
        const q = (await req.json()) as any, repo = String(q.repo || "").toLowerCase(), path = String(q.path || ""), method = String(q.method || "GET").toUpperCase();
        if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || (path && !/^\/[\w\-./%?=&,~]*$/.test(path)) || path.includes("..") || !["GET", "PUT", "POST", "PATCH", "DELETE"].includes(method)) return err(400, "Not a GitHub call publishing needs.");
        if (!(await env.DB.prepare("select 1 from repos where repo = ? and scope = ?").bind(repo, scope).first())) return err(403, `The repository ${repo} isn't registered to ${scope}. Turn on Publish from any device again from a Studio that has the GitHub token.`);
        const r = await fetch("https://api.github.com/repos/" + repo + path, { method, headers: { Authorization: "Bearer " + env.GH_TOKEN, Accept: q.raw ? "application/vnd.github.raw+json" : "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "site-studio-db", ...(q.body != null ? { "Content-Type": "application/json" } : {}) }, body: method === "GET" ? undefined : q.body != null ? String(q.body) : undefined });
        const bytes = new Uint8Array(await r.arrayBuffer());
        let bin = ""; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return json({ status: r.status, b64: btoa(bin), type: r.headers.get("content-type") || "" });
      }
      if (p === "/m") return json((await env.DB.prepare("select email, role, added_at from members where scope = ? order by email").bind(scope).all()).results || []);
      if (p === "/m/add" && req.method === "POST") {
        if (role !== "owner" && role !== "partner") return err(403, "Only owners can add people.");
        const b = (await req.json()) as any; const e = String(b.email || "").trim().toLowerCase(), r = ["owner", "member", "partner"].includes(b.role) ? b.role : "member";
        if (!emailOk(e)) return err(400, "Enter a valid email.");
        await env.DB.prepare("insert into members (scope, email, role) values (?, ?, ?) on conflict (scope, email) do update set role = excluded.role").bind(scope, e, r).run();
        return json({ ok: true });
      }
      if (p === "/m/remove" && req.method === "POST") {
        if (role !== "owner" && role !== "partner") return err(403, "Only owners can remove people.");
        const b = (await req.json()) as any; await env.DB.prepare("delete from members where scope = ? and email = ?").bind(scope, String(b.email || "").toLowerCase()).run();
        return json({ ok: true });
      }
      // ---- client approval, the Studio's side (members of the Studio): share, list, reply, close
      if (p.startsWith("/rv/")) {
        if (!scope.startsWith("studio:")) return err(400, "Sharing for approval belongs to a Studio.");
        const b = req.method === "POST" ? ((await req.json().catch(() => ({}))) as any) : {};
        const project = String(b.project || u.searchParams.get("project") || "");
        if (p === "/rv/new" && req.method === "POST") {
          if (role === "viewer") return err(403, "Viewers can't share for approval.");
          if (!/^[\w-]{1,80}$/.test(project)) return err(400, "Which project?");
          const content = JSON.stringify(b.content || {}); if (content.length > 1_800_000) return err(413, "This project's content is too large to share this way.");
          const token = [...crypto.getRandomValues(new Uint8Array(16))].map((x) => x.toString(16).padStart(2, "0")).join("");
          await env.DB.prepare("insert into approvals (token, scope, project, name, template, content, note, created_by, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)")
            .bind(token, scope, project, oneLine(String(b.name || "Project")).slice(0, 120), String(b.template || "").slice(0, 40), content, String(b.note || "").trim().slice(0, 2000), email, new Date().toISOString()).run();
          return json({ token });
        }
        if (p === "/rv/list") {
          const rows = ((await env.DB.prepare("select token, name, note, status, decided_by, decided_at, created_by, created_at from approvals where scope = ? and project = ? order by created_at desc limit 20").bind(scope, project).all()).results || []) as any[];
          for (const r of rows) r.notes = (await env.DB.prepare("select id, who, body, page, kind, created_at from approval_notes where token = ? order by id limit 300").bind(r.token).all()).results || [];
          return json(rows);
        }
        // What the client last said about each project (its newest link that is still open), for the project cards.
        if (p === "/rv/summary") {
          const rows = ((await env.DB.prepare("select token, project, status, decided_by, decided_at, created_at from approvals where scope = ? and status != 'closed' order by created_at desc limit 400").bind(scope).all()).results || []) as any[];
          const summary: Record<string, any> = {}, byTok: Record<string, any> = {};
          for (const r of rows) if (!summary[r.project]) { summary[r.project] = byTok[r.token] = { token: r.token, status: r.status, decided_by: r.decided_by || "", decided_at: r.decided_at || null, created_at: r.created_at, comments: 0, waiting: false }; }
          const toks = Object.keys(byTok);
          for (let i = 0; i < toks.length; i += 40) {
            const part = toks.slice(i, i + 40);
            const notes = ((await env.DB.prepare(`select token, who, body, kind, created_at from approval_notes where token in (${part.map(() => "?").join(",")}) order by id`).bind(...part).all()).results || []) as any[];
            for (const n of notes) { const s = byTok[n.token]; if (!s) continue; s.waiting = n.kind === "comment"; if (n.kind !== "reply") { s.comments++; s.last = { who: n.who, body: String(n.body || "").slice(0, 240), kind: n.kind, created_at: n.created_at }; } }
          }
          return json({ summary });
        }
        const tok = String(b.token || ""), own: any = await env.DB.prepare("select token from approvals where token = ? and scope = ?").bind(tok, scope).first();
        if (!own) return err(404, "That review link isn't in this Studio.");
        if (p === "/rv/reply" && req.method === "POST") {
          const body = String(b.body || "").trim().slice(0, 2000); if (!body) return err(400, "Write your reply.");
          await env.DB.prepare("insert into approval_notes (token, who, body, page, kind, created_at) values (?, ?, ?, '', 'reply', ?)").bind(tok, oneLine(String(b.who || email)).slice(0, 80), body, new Date().toISOString()).run();
          return json({ ok: true });
        }
        if (p === "/rv/close" && req.method === "POST") { await env.DB.prepare("update approvals set status = 'closed', content = '{}' where token = ?").bind(tok).run(); return json({ ok: true }); }
        if (p === "/rv/delete" && req.method === "POST") { await env.DB.batch([env.DB.prepare("delete from approval_notes where token = ?").bind(tok), env.DB.prepare("delete from approvals where token = ?").bind(tok)]); return json({ ok: true }); }
        return err(404, "Not found.");
      }
      if (p === "/e/list") {
        const site = scope.replace(/^site:/, "");
        const rows = (await env.DB.prepare("select id, site, data, page, status, created_at from enquiries where site = ? order by created_at desc limit 500").bind(site).all()).results || [];
        return json(rows.map((r: any) => ({ ...r, data: JSON.parse(r.data) })));
      }
      // The owner has seen an order's payment in their UPI app (or takes it back). Kept on the order as _paid.
      if (p === "/e/paid" && req.method === "POST") {
        const b = (await req.json()) as any, site = scope.replace(/^site:/, "");
        const row: any = await env.DB.prepare("select data from enquiries where id = ? and site = ?").bind(b.id, site).first(); if (!row) return err(404, "Not found.");
        const d = JSON.parse(row.data); if (!d.order_no) return err(400, "That isn't an order.");
        if (b.paid) d._paid = "yes"; else delete d._paid;
        await env.DB.prepare("update enquiries set data = ? where id = ? and site = ?").bind(JSON.stringify(d), b.id, site).run();
        return json({ ok: true });
      }
      if ((p === "/e/status" || p === "/e/delete") && req.method === "POST") {
        const b = (await req.json()) as any; const site = scope.replace(/^site:/, "");
        if (p === "/e/status") { if (!["new", "read", "replied", "archived", "accepted", "preparing", "ready", "out", "done", "cancelled"].includes(b.status)) return err(400, "Unknown status."); await env.DB.prepare("update enquiries set status = ? where id = ? and site = ?").bind(b.status, b.id, site).run(); }
        else await env.DB.prepare("delete from enquiries where id = ? and site = ?").bind(b.id, site).run();
        return json({ ok: true });
      }
      return err(404, "Not found.");
    } catch (e: any) {
      return err(500, e?.message || "Something went wrong.");
    }
  },
};
