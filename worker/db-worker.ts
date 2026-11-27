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
const dec = new TextDecoder();
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

import { CFDB_SCHEMA, CFDB_TABLES, CFDB_UPGRADES, CFDB_VERSION, CFDB_WORKER_NAME } from "../src/lib/cfdbSchema";
import { cleanDiyLook } from "../src/lib/diylook";
import { ROLE_IDS, cleanPrivs, fileRule, isAdminRole, privsOf, userKey } from "../src/lib/roles";
import { MAIL_KINDS, MAIL_TPL_MAX, codeBlock, mailEmail, sampleBlocks, tplOf } from "../src/lib/mailtpl";
import { digestPage, sheetLinks } from "../src/lib/lookdigest";
import { socialFromText } from "../src/lib/social";
import { COURIERS, TRACKERS, TRACKER_FIELDS, TRACK_STATES, TrackError, courierLink, courierName, pickTracker, trackLive, trackerReady, type Live } from "../src/lib/tracking";
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
// ---- PIN sign-in: when the owners switch it on, a member who has set a PIN signs in with email + PIN instead of an emailed
// code, but only on a device that has already signed in with a code (it holds a secret the database remembers as a hash).
// Five wrong PINs lock that person's PIN sign-in for 15 minutes; the emailed code always works.
const pinOn = async (env: Env) => !!((await getSetting(env, "_db", "pin").catch(() => null)) as any)?.on;
const pinWeak = (pin: string) => /^(\d)\1+$/.test(pin) || "0123456789".includes(pin) || "9876543210".includes(pin) || ["1212", "2580", "0852", "121212", "123123", "112233"].includes(pin);
const pinHash = async (env: Env, email: string, salt: string, pin: string) => b64u(await hmac(env.SECRET, "pin:" + email + ":" + salt + ":" + pin));
const devHash = async (env: Env, dev: string) => b64u(await hmac(env.SECRET, "dev:" + dev));
async function pinDevice(env: Env, email: string) {
  const dev = b64u(crypto.getRandomValues(new Uint8Array(24)));
  await env.DB.prepare("insert into pin_dev (email, dev, at) values (?, ?, ?)").bind(email, await devHash(env, dev), Date.now()).run();
  await env.DB.prepare("delete from pin_dev where email = ? and dev not in (select dev from pin_dev where email = ? order by at desc limit 8)").bind(email, email).run();
  return dev;
}
const isDbOwner = async (env: Env, e: string) => !!(await env.DB.prepare("select 1 from members where email = ? and role = 'owner' and scope like 'studio:%' limit 1").bind(e).first())
  || (!(await env.DB.prepare("select 1 from members where scope like 'studio:%' limit 1").first()) && !!(await env.DB.prepare("select 1 from members where email = ? and role = 'owner' limit 1").bind(e).first()));

// ---- Sign in with Google (see /auth/google…): the setting, the addresses it may be used from, and checking Google's token.
async function gsCfg(env: Env): Promise<{ on?: boolean; clientId?: string; origins?: string[] }> { return (await getSetting(env, "_db", "google")) || {}; }
/** Remembers an address (an https origin) someone signed in from with an email code, or the owner set this up from. */
async function gsOrigin(env: Env, origin: string) {
  if (!/^https:\/\/[a-z0-9.-]{1,200}(:\d{1,5})?$/i.test(origin)) return;
  const g = await gsCfg(env), list = g.origins || [];
  if (list.includes(origin)) return;
  await putSetting(env, "_db", "google", { ...g, origins: [...list, origin].slice(-60) });
}
let gsKeys: { at: number; keys: any[] } | null = null;
/** The verified email in a Google ID token made for `aud` with this `nonce`, or "" when anything about it is off. */
async function gsEmail(idToken: string, aud: string, nonce: string): Promise<string> {
  try {
    const [h, b, sg] = idToken.split("."); if (!h || !b || !sg) return "";
    const head = JSON.parse(dec.decode(unb64u(h))), c = JSON.parse(dec.decode(unb64u(b)));
    if (head.alg !== "RS256") return "";
    if (!gsKeys || Date.now() - gsKeys.at > 3600_000 || !gsKeys.keys.some((k) => k.kid === head.kid)) { const r = await fetch("https://www.googleapis.com/oauth2/v3/certs"); if (!r.ok) return ""; gsKeys = { at: Date.now(), keys: (((await r.json()) as any).keys || []) }; }
    const jwk = gsKeys.keys.find((k) => k.kid === head.kid); if (!jwk) return "";
    const key = await crypto.subtle.importKey("jwk", { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true }, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    if (!(await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, unb64u(sg), enc.encode(h + "." + b)))) return "";
    if ((c.iss !== "https://accounts.google.com" && c.iss !== "accounts.google.com") || c.aud !== aud || !(+c.exp * 1000 > Date.now()) || c.nonce !== nonce) return "";
    if (c.email_verified !== true && c.email_verified !== "true") return "";
    const email = String(c.email || "").trim().toLowerCase();
    return emailOk(email) ? email : "";
  } catch { return ""; }
}
/** The small page shown in the Google window: a message, and (when `finish`) the script that hands Google's token to this Worker. */
function gsPage(title: string, text: string, finish = false): Response {
  const esc = (x: string) => x.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" } as any)[ch]);
  const script = finish ? `<script>(function(){var q=new URLSearchParams(location.hash.slice(1)),h=document.getElementById("h"),p=document.getElementById("p");try{history.replaceState(null,"",location.pathname)}catch(e){}
function say(a,b){h.textContent=a;p.textContent=b}
if(q.get("error")||!q.get("id_token")){say("Not signed in",q.get("error")==="access_denied"?"You closed Google's sign-in. You can close this window.":"Google didn't finish the sign-in. Close this window and try again.");return}
fetch("/auth/google/finish",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id_token:q.get("id_token"),state:q.get("state")})}).then(function(r){return r.json().then(function(j){return{ok:r.ok,j:j}})}).then(function(x){if(x.ok){say("Signed in","You can close this window and go back.");setTimeout(function(){try{window.close()}catch(e){}},400)}else say("Not signed in",(x.j&&x.j.error)||"Something went wrong. Close this window and try again.")}).catch(function(){say("Not signed in","Couldn't reach the sign-in. Close this window and try again.")})})();</script>` : "";
  return new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><meta name="referrer" content="no-referrer"><title>Sign in</title><style>body{font:16px/1.6 system-ui,sans-serif;max-width:420px;margin:18vh auto;padding:0 20px;color:#1d2433;text-align:center}p{color:#5b6475}</style><h1 id="h">${esc(title)}</h1><p id="p">${esc(text)}</p>${script}`, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Frame-Options": "DENY" } });
}
const roleOf = async (env: Env, scope: string, email: string | null) => (email ? ((await env.DB.prepare("select role from members where scope = ? and email = ?").bind(scope, email).first()) as any)?.role || null : null);
/** What a role may do in a scope (Role Management): the Administrator's saved choices over the standard ones. A database not yet updated has no table: the standard ones. */
async function privsFor(env: Env, scope: string, role: string | null): Promise<Record<string, boolean>> {
  if (isAdminRole(role)) return privsOf(role);
  let saved: any = null;
  try { const r: any = await env.DB.prepare("select privs from role_mgmt where scope = ? and role = ?").bind(scope, String(role)).first(); if (r) saved = JSON.parse(r.privs); } catch { /* the standard ones */ }
  return privsOf(role, saved);
}
/** May this person (not an Administrator) read or write a file of the Studio? A project is theirs when it is registered to them;
 *  writing into a project nobody has files in yet makes it theirs. Everything unregistered belongs to the Administrators. */
async function fileMay(env: Env, scope: string, email: string, path: string, shared: boolean, write: boolean): Promise<boolean | "strip"> {
  const r = fileRule(path, userKey(email), shared);
  if (!r.project) return write ? r.write : r.read;
  const own: any = await env.DB.prepare("select email from project_owners where scope = ? and project = ?").bind(scope, r.project).first().catch(() => null);
  if (own) return own.email === email;
  if (!write) return false;
  const pre = "projects/" + r.project + "/";
  if (await env.DB.prepare("select 1 from files where scope = ? and substr(path, 1, ?) = ? limit 1").bind(scope, pre.length, pre).first()) return false;
  await env.DB.prepare("insert into project_owners (scope, project, email, at) values (?, ?, ?, ?) on conflict (scope, project) do nothing").bind(scope, r.project, email, new Date().toISOString()).run();
  const now: any = await env.DB.prepare("select email from project_owners where scope = ? and project = ?").bind(scope, r.project).first();
  return now?.email === email;
}

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
  env = await siteMail(env, site);
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
  const rows = Object.entries(data).filter(([k]) => k !== "consent" && k !== "okey" && k !== "pay_state" && k !== "rz_order" && k !== "pay_gw" && k !== "cart" && k !== "_items" && !(k === "message" && data.order_no) && !k.startsWith("_")).map(([k, v]) => `<tr><td style="padding:6px 14px 6px 0;color:#667;vertical-align:top;white-space:nowrap">${hesc(label(k))}</td><td style="padding:6px 0;white-space:pre-wrap">${hesc(v)}</td></tr>`).join("");
  const table = `<table style="border-collapse:collapse;margin:0 0 14px">${rows}</table>`;
  const jobs: Promise<unknown>[] = [];
  if (wantOwner && owners.length) {
    const OO = (E.orderOwner && typeof E.orderOwner === "object" ? E.orderOwner : {}) as any, ov = { ...vars, name: vars.name || "your website", order: oneLine(String(data.order_no || "")), total: oneLine(String(data.total || "")) };
    const subject = data.order_no ? (oneLine(fill(String(OO.subject || "New order {order}{totalbit} from {name}"), { ...ov, totalbit: data.total ? " (" + data.total + ")" : "" })).slice(0, 150) || "New order")
      : oneLine(fill(String(F.notifySubject || (data.reg_no ? "New registration from {name} (" + data.reg_no + ")" : "New enquiry from {name}")), { ...vars, name: vars.name || "your website" })).slice(0, 150) || "New enquiry";
    const intro = data.order_no ? fill(String(OO.intro || "New order {order} on the {site} website."), ov) : fill(String(E.enquiry?.intro || (data.reg_no ? "New registration on the {site} website." : "New enquiry from the {site} website.")), vars);
    const foot = (data.order_no ? fill(String(OO.footer || "It is also saved under Purchased orders in the site's admin page."), ov) : fill(String(E.enquiry?.footer || "It is also saved under Enquiries in the site's admin page."), vars)) + (EMAIL_RE.test(data.email || "") ? " Reply to this email to answer the visitor." : "");
    // A template written in the editor (Email templates → Edit template) replaces the opening and closing lines.
    const oTpl = tplOf(E, data.order_no ? "orderOwner" : "enquiry");
    jobs.push(sendMail(env, owners, subject, oTpl ? mailEmail(oTpl, data.order_no ? ov : vars, { details: table }, WRAP) : WRAP(paras(intro) + table + paras(foot, "margin:0 0 8px;color:#667;font-size:13px")), EMAIL_RE.test(data.email || "") ? data.email : undefined)
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
      const rTpl = tplOf(E, "reply");
      jobs.push(sendMail(env, String(data.email).trim(), subject, rTpl ? mailEmail(rTpl, v2, { details: table }, WRAP) : WRAP(paras(body) + copy), owners[0] || (EMAIL_RE.test(c?.contact?.email || "") ? c.contact.email : undefined)));
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
   Read-only views that show the data grouped by area in Cloudflare's D1 console (DIY, Studio settings, the
   Studio's own files and public pages, and each site's admin). They store nothing and nothing here reads
   them: the tables stay exactly as they are. Bump VIEWS_V when a view changes, so it is made again.
   ============================================================ */
const VIEWS_V = "v1";
const SITE_OF = "substr(scope, 6)", STUDIO_OF = "substr(scope, 8)";
const VIEWS: Record<string, string> = {
  // Design yourself: every query sent in and every saved draft, newest first.
  v_diy: `select 'query' as what, q.studio as studio, cast(q.id as text) as id, q.name as name, q.kind as kind, q.person as person, q.email as email, q.phone as phone, q.status as status, '' as theme,
      (select count(*) from design_pics p where p.studio = q.studio and p.ref = q.id) as pictures, q.created_at as at from design_queries q
    union all select 'draft', d.studio, d.id, d.name, d.kind, '', d.email, '', '', d.theme_name, 0, d.updated_at from design_drafts d
    order by at desc`,
  // Studio settings: the Studio's index file (studio.json), its saved connections (names only: the values are encrypted) and its people.
  v_studio_settings: `select 'settings file' as what, ${STUDIO_OF} as studio, path as name, size || ' bytes' as detail, updated_at as at from files where scope like 'studio:%' and path = 'studio.json'
    union all select 'connection', case when scope like 'studio:%' then ${STUDIO_OF} else '(this database)' end, name, 'encrypted', updated_at from settings where scope like 'studio:%' or scope = '_db'
    union all select 'member', ${STUDIO_OF}, email, role, added_at from members where scope like 'studio:%'
    order by studio, what, name`,
  // The Studio's own files: projects, their pictures and exports.
  v_studio_files: `select ${STUDIO_OF} as studio, case when path like 'projects/%' then substr(path, 10, instr(substr(path, 10), '/') - 1) else '' end as project, path, size, type, updated_at
    from files where scope like 'studio:%' and path <> 'studio.json' and path not like 'public/%' order by studio, path`,
  // The Studio's own public pages (its main site) and the emails it keeps.
  v_studio_site_admin: `select ${STUDIO_OF} as studio, path, size, type, updated_at from files where scope like 'studio:%' and path like 'public/%' order by studio, path`,
  // Each site's admin at a glance: one row per site.
  v_site_admin: `select s.site as site,
      (select group_concat(email, ', ') from members m where m.scope = 'site:' || s.site) as admins,
      (select count(*) from files f where f.scope = 'site:' || s.site) as files,
      (select coalesce(sum(size), 0) from files f where f.scope = 'site:' || s.site) as bytes,
      (select max(updated_at) from files f where f.scope = 'site:' || s.site) as last_saved,
      (select count(*) from settings t where t.scope = 'site:' || s.site) as connections,
      (select count(*) from enquiries e where e.site = s.site and e.data not like '%"reg_no"%') as enquiries,
      (select count(*) from enquiries e where e.site = s.site and e.data like '%"reg_no"%') as registrations,
      (select count(*) from customers c where c.site = s.site) as customers,
      (select count(*) from carts c where c.site = s.site) as carts,
      (select count(*) from reviews r where r.site = s.site) as reviews,
      (select count(*) from stock k where k.site = s.site) as stock_items,
      (select count(*) from payments p where p.site = s.site) as payments
    from (select ${SITE_OF} as site from files where scope like 'site:%' union select ${SITE_OF} from members where scope like 'site:%') s order by s.site`,
  // Each site's files (content, draft, pictures).
  v_site_files: `select ${SITE_OF} as site, path, size, type, updated_at from files where scope like 'site:%' order by site, path`,
  // Each site's saved connections (names only: the values are encrypted) and its admins.
  v_site_settings: `select 'connection' as what, ${SITE_OF} as site, name, 'encrypted' as detail, updated_at as at from settings where scope like 'site:%'
    union all select 'admin', ${SITE_OF}, email, role, added_at from members where scope like 'site:%' order by site, what, name`,
};
/** Makes the views once per version. Any failure is ignored: the views are only a convenience and must never stop the worker. */
async function ensureViews(env: Env) {
  try {
    const have = new Set((((await env.DB.prepare("select name from sqlite_master where type = 'view' and sql like ?").bind(`%/*${VIEWS_V}*/%`).all()).results || []) as any[]).map((r) => r.name));
    const todo = Object.keys(VIEWS).filter((n) => !have.has(n)); if (!todo.length) return;
    await env.DB.batch(todo.flatMap((n) => [env.DB.prepare(`drop view if exists ${n}`), env.DB.prepare(`create view ${n} as /*${VIEWS_V}*/ ${VIEWS[n]}`)]));
  } catch { /* the tables are untouched either way */ }
}

/* ============================================================
   Connections an owner can switch on: their own AI API, WhatsApp (Meta's Cloud API) and payment gateways.
   Their keys are kept in this database encrypted with the Worker's own secret, are never sent back to
   a browser, and each is used only when it is switched on.
   ============================================================ */
/** Table changes from CFDB_UPGRADES that are in place. Each is tried once per start; a failure leaves the old way of working in use. */
const upgraded: Record<string, boolean> = {}, upgradeTried: Record<string, boolean> = {};
async function upgradedTo(env: Env, name: string): Promise<boolean> {
  if (upgraded[name]) return true; if (upgradeTried[name]) return false; upgradeTried[name] = true;
  const u = CFDB_UPGRADES.find((x) => x.name === name); if (!u) return false;
  const there = async () => { try { await env.DB.prepare(u.probe).first(); return true; } catch { return false; } };
  if (!(await there())) { try { await env.DB.batch(u.steps.map((s) => env.DB.prepare(s))); } catch { /* left as it was */ } if (!(await there())) return false; }
  return (upgraded[name] = true);
}
/** The condition and value that find an enquiry by its order or registration number: by the indexed number once the database
 *  has it (see CFDB_UPGRADES), and until then by looking for it in the saved text, as before. */
async function byRef(env: Env, no: string, old: [string, string]): Promise<[string, string]> { return (await upgradedTo(env, "enquiries.ref")) ? ["ref = ?", no] : old; }
let ensured = false;
async function ensure(env: Env) {
  if (ensured) return;
  await env.DB.batch(CFDB_TABLES.map((sql) => env.DB.prepare(sql)));
  ensured = true;
  await ensureViews(env);
}
const SETTINGS: Record<string, { secret: string[]; text: string[]; flags: string[] }> = {
  ai: { secret: ["key"], text: ["base", "model", "vision", "image"], flags: ["on"] },
  // Unsplash: real photos found by words, in the place of a drawn picture (the owner's own free access key).
  un: { secret: ["key"], text: [], flags: ["on"] },
  wa: { secret: ["token"], text: ["phoneId", "waba", "cc", "lang", "to", "phones", "tplOtp", "tplOrder", "tplEnquiry"], flags: ["on", "login", "orderOtp", "orderAlert", "enquiryAlert"] },
  rz: { secret: ["secret"], text: ["keyId"], flags: ["on"] },
  cf: { secret: ["secret"], text: ["appId"], flags: ["test"] },
  pe: { secret: ["secret"], text: ["clientId", "version"], flags: ["test"] },
  st: { secret: ["secret"], text: [], flags: [] },
  pp: { secret: ["secret"], text: ["clientId"], flags: ["test"] },
  // Petpooja (the restaurant's billing system): orders placed on the site go to it, and it sends back each order's status.
  pos: { secret: ["secret", "token"], text: ["appKey", "restId", "url"], flags: ["on"] },
  // SMS (text messages) through the owner's own account with MSG91 or Twilio: codes for signing in and for checkout.
  sms: { secret: ["key"], text: ["provider", "tpl", "varName", "sender", "sid", "from", "text", "cc", "phones", "chan", "email"], flags: ["on", "login", "orderOtp"] },
};
// Courier tracking (shops): one connection per service the shop has an account with (tk_<service>), and what to do with what they say.
for (const id of Object.keys(TRACKERS)) SETTINGS["tk_" + id] = TRACKER_FIELDS;
SETTINGS.ship = { secret: [], text: [], flags: ["manual", "quiet"] };
// Email through the site's own Resend account (key and sender), when the Studio's owner has switched the site to "Custom".
SETTINGS.mail = { secret: ["key"], text: ["from"], flags: ["on"] };
// The site admin's own choices (tour, click-to-edit, menu layout...), kept here so they follow its people to any device.
SETTINGS.prefs = { secret: [], text: ["json"], flags: [] };
// Instagram for a site's social photo wall: the account owner's own access token (Instagram API with Instagram Login).
// "at" is when the token was saved or last renewed: Instagram's long-lived tokens last 60 days and are renewed here before that.
SETTINGS.ig = { secret: ["token"], text: ["at"], flags: ["on"] };
async function aesKey(env: Env) { return crypto.subtle.importKey("raw", await crypto.subtle.digest("SHA-256", enc.encode("settings:" + env.SECRET)), "AES-GCM", false, ["encrypt", "decrypt"]); }
/** A project's own Resend key and sender can be dropped into its database from outside (the Studio does it through
 *  Cloudflare's D1 API when the owner isn't signed in to the site yet, since the sign-in code itself needs working email).
 *  The row is plain text; the first read here encrypts it as the site's "mail" setting and deletes the row. */
async function adoptMail(env: Env, scope: string) {
  const r: any = await env.DB.prepare("select value from settings where scope = ? and name = 'mail!pending'").bind(scope).first(); if (!r) return;
  let v: any = null; try { v = JSON.parse(String(r.value)); } catch { /* ignored */ }
  await env.DB.prepare("delete from settings where scope = ? and name = 'mail!pending'").bind(scope).run();
  if (v && /^re_\S{8,}$/.test(String(v.key || "")) && /^[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+$|<[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+>$/.test(String(v.from || "").trim())) await putSetting(env, scope, "mail", { on: true, key: String(v.key), from: String(v.from).trim() });
}
async function getSetting(env: Env, scope: string, name: string): Promise<any | null> {
  await ensure(env);
  if (name === "mail" && scope.startsWith("site:")) await adoptMail(env, scope).catch(() => {});
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
// ---------------------------------------------------------------- where a shop order's parcel is
/** The shipment saved on an order: { c: courier, awb, url, name, at }. */
const trackOf = (d: any): any | null => { try { const t = JSON.parse(String(d?._track || "")); return t && (t.awb || t.url) ? t : null; } catch { return null; } };
/** What the customer may see of it. */
const trackShown = (t: any) => (t ? { c: String(t.c || "other"), name: t.c === "other" || !COURIERS[t.c] ? String(t.name || "Courier") : courierName(t.c), awb: String(t.awb || ""), link: /^https:\/\//.test(String(t.url || "")) ? String(t.url) : courierLink(t.c, String(t.awb || "")) } : null);
async function shipSaved(env: Env, site: string): Promise<Record<string, any>> {
  await ensure(env); const o: Record<string, any> = {};
  for (const r of ((await env.DB.prepare("select name from settings where scope = ? and name like 'tk!_%' escape '!'").bind("site:" + site).all()).results || []) as any[]) { const id = String(r.name).slice(3); if (TRACKERS[id]) { const z = await getSetting(env, "site:" + site, r.name).catch(() => null); if (z) o[id] = z; } }
  return o;
}
const SHIP_OPEN = ["new", "read", "accepted", "preparing", "ready"];
/** Asks the tracking service where the parcel is (at most every 20 minutes; a delivered parcel is not asked about again),
 *  keeps the answer with the order, and moves the order on when the parcel has left or arrived. */
async function shipLive(env: Env, site: string, rowId: number, d: any, status: string, force = false): Promise<{ live: (Live & { t: number; via: string }) | null; why: string; status: string }> {
  const t = trackOf(d); if (!t || !t.awb) return { live: null, why: "", status };
  let had: any = null; try { had = JSON.parse(String(d._trk || "")); } catch { /* never asked */ }
  if (had && (had.st === "delivered" || (!force && Date.now() - (+had.t || 0) < 20 * 60_000))) return { live: had, why: "", status };
  // A service that failed a moment ago is not asked again at once (the page asks every time it is opened).
  if (!force && !had && +d._trk_bad > Date.now() - 5 * 60_000) return { live: null, why: String(d._trk_why || ""), status };
  const saved = await shipSaved(env, site), id = pickTracker(saved, String(t.c || ""));
  if (!id) return { live: had, why: Object.keys(saved).length ? "No tracking connection covers this courier." : "", status };
  let live: Live;
  try { live = await trackLive(id, saved[id], String(t.awb), String(t.c || "")); }
  catch (e: any) {
    const why = e instanceof TrackError ? e.message : "The tracking service couldn't be read.";
    if (!had) await env.DB.prepare("update enquiries set data = ? where id = ? and site = ?").bind(JSON.stringify({ ...d, _trk_bad: String(Date.now()), _trk_why: why }), rowId, site).run().catch(() => {});
    return { live: had, why, status };
  }
  const keep = { ...live, ev: live.ev.slice(0, 25), t: Date.now(), via: id }, nd = { ...d, _trk: JSON.stringify(keep) }; delete nd._trk_bad; delete nd._trk_why;
  const opt = await getSetting(env, "site:" + site, "ship").catch(() => null);
  let next = status;
  if (!opt?.manual) { if (live.st === "delivered" && [...SHIP_OPEN, "out"].includes(status)) next = "done"; else if (["picked", "transit", "out"].includes(live.st) && SHIP_OPEN.includes(status)) next = "out"; }
  await env.DB.prepare("update enquiries set data = ?, status = ? where id = ? and site = ?").bind(JSON.stringify(nd), next, rowId, site).run();
  return { live: keep, why: "", status: next };
}
/* ---- Order emails: the customer's confirmation, the "shipped" note and status notes, all worded by the site's email
   templates (content.emails.order / shipped / status.*). Placeholders: {name} {order} {total} {site} {items} {when}
   {courier} {tracking}. A status email is sent once per status per order, and only if the site switched it on. */
const ORDER_DEF: Record<string, { subject: string; heading: string; message: string; footer: string }> = {
  placed: { subject: "Thanks for your order {order}", heading: "We've got your order", message: "Hi {name},\n\nThanks for your order {order} from {site}. We've received it and will get it ready soon.\n\nOrder total: {total}", footer: "Questions? Just reply to this email." },
  shipped: { subject: "Your order {order} has shipped", heading: "Your order is on its way", message: "Hi {name}, your order {order} from {site} has shipped with {courier}.{trackline}", footer: "Thank you for shopping with us." },
  ready: { subject: "Your order {order} is ready", heading: "Your order is ready", message: "Hi {name}, your order {order} from {site} is ready.", footer: "Thank you!" },
  out: { subject: "Your order {order} is out for delivery", heading: "On its way to you", message: "Hi {name}, your order {order} from {site} is out for delivery.", footer: "Thank you!" },
  done: { subject: "Your order {order} is complete", heading: "Order complete", message: "Hi {name}, your order {order} from {site} is complete. We hope you enjoy it!", footer: "Thank you for choosing us." },
  cancelled: { subject: "Your order {order} was cancelled", heading: "Order cancelled", message: "Hi {name}, your order {order} from {site} has been cancelled. If you didn't ask for this, just reply to this email.", footer: "" },
};
const itemsText = (d: any) => { try { const a = JSON.parse(String(d?._items || "[]")); return Array.isArray(a) ? a.slice(0, 40).map((x: any) => `• ${Math.max(1, +x.q || 1)} × ${oneLine(String(x.n || ""))}`).join("\n") : ""; } catch { return ""; } };
/** Sends one order email to the customer. kind: placed, shipped, ready, out, done or cancelled. Returns a line for the order's note, or "". */
async function orderMail(env: Env, site: string, kind: string, d: any, c0?: any): Promise<string> {
  env = await siteMail(env, site);
  const to = emailKey(d?.email); if (!to || !env.RESEND_API_KEY || !env.MAIL_FROM) return "";
  const c = c0 || (await siteContent(env, site).catch(() => null)), E = (c?.emails && typeof c.emails === "object" ? c.emails : {}) as any;
  const T: any = kind === "placed" ? E.order : kind === "shipped" ? E.shipped : E.status?.[kind];
  if (kind !== "shipped" && T?.on !== true) return "";
  const def = ORDER_DEF[kind]; if (!def) return "";
  const t = kind === "shipped" ? trackShown(trackOf(d)) : null; if (kind === "shipped" && !t) return "";
  const name = siteName(c, site);
  const vars: Record<string, string> = { name: oneLine(String(d.name || "")) || "there", order: oneLine(String(d.order_no || "")), total: oneLine(String(d.total || "")), site: name, shop: name, when: oneLine([d.mode, d.when].filter(Boolean).join(", ")), items: itemsText(d), courier: t ? t.name : "", tracking: t?.awb || "", trackline: t?.awb ? "\nTracking number: " + t.awb : "" };
  const subject = oneLine(fill(String(T?.subject || def.subject), vars)).slice(0, 150) || "Your order";
  const body = fill(String(T?.message || def.message), vars), heading = oneLine(fill(String(T?.heading || def.heading), vars));
  const foot = fill(String(T?.footer ?? def.footer) || (T && "footer" in T ? "" : def.footer), vars);
  const showItems = kind !== "shipped" && T?.items !== false && vars.items;
  const btn = t?.link ? `<p style="margin:0 0 12px"><a href="${hesc(t.link)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px">${hesc(oneLine(String(T?.button || "Track your parcel")))}</a></p>` : "";
  const list = showItems ? `<p style="margin:0 0 6px;color:#667;font-size:13px">${hesc(String(T?.itemsLabel || "Your order"))}</p>${paras(vars.items, "margin:0 0 12px")}` : "";
  const reply = emailKey(c?.contact?.email) || undefined;
  const tpl = tplOf(E, kind === "placed" ? "order" : kind === "shipped" ? "shipped" : "status." + kind);
  await sendMail(env, to, subject, tpl ? mailEmail(tpl, { ...vars, tracklink: t?.link || "" }, { items: vars.items ? paras(vars.items, "margin:0 0 12px") : "" }, WRAP) : WRAP(`<h2 style="margin:0 0 12px;font-size:20px">${hesc(heading)}</h2>${paras(body)}${list}${btn}${foot ? paras(foot, "margin:0 0 8px;color:#667;font-size:13px") : ""}`), reply);
  return kind === "shipped" ? "Shipping email sent to " + to : "Order email (" + kind + ") sent to " + to;
}
async function shippedMail(env: Env, site: string, d: any) { return orderMail(env, site, "shipped", d); }

/** The environment a site\'s emails are sent with: its own Resend key and sender when the Studio\'s owner switched the site to
 *  Custom and both are filled in, otherwise the database\'s own (the Studio\'s Resend). */
async function siteMail(env: Env, site: string): Promise<Env> {
  if (!/^[a-z0-9][a-z0-9-]{0,59}$/.test(site)) return env;
  const m = await getSetting(env, "site:" + site, "mail").catch(() => null);
  return m?.on && m.key && m.from ? { ...env, RESEND_API_KEY: String(m.key), MAIL_FROM: String(m.from) } : env;
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
      const send = (fmt: boolean) => fetch(base + "/chat/completions", { signal: AbortSignal.timeout(40000), method: "POST", headers: { Authorization: "Bearer " + c.key, "Content-Type": "application/json" },
        body: JSON.stringify({ model: (vision && c.vision) || c.model, messages: o.messages, ...(o.max_tokens ? { max_tokens: Math.min(o.max_tokens, 8000) } : {}), ...(o.temperature != null ? { temperature: o.temperature } : {}), ...(fmt && o.response_format ? { response_format: o.response_format } : {}) }) });
      let r: Response; try { r = await send(true); } catch (e: any) { throw new Error(e?.name === "TimeoutError" || e?.name === "AbortError" ? "Your AI API took too long to answer (40 s). Check the model name, or try a faster model." : String(e?.message || e)); }
      // Not every API knows the JSON switch: asked again without it (the prompts already ask for JSON).
      if (r.status === 400 && o.response_format) r = await send(false);
      if (!r.ok) { const t = (await r.text()).replace(/\s+/g, " ").slice(0, 240); throw new Error(r.status === 401 || r.status === 403 ? `Your AI API refused the key (${r.status}). Check it under Settings → AI.` : r.status === 429 ? "Your AI API says its limit is reached (429)." : `Your AI API answered ${r.status}: ${t}`); }
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
  const r = await fetch(`https://graph.facebook.com/v23.0/${encodeURIComponent(String(c.phoneId).trim())}/messages`, { method: "POST", headers: { Authorization: "Bearer " + c.token, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "template", template: { name: String(tpl).trim(), language: { code: String(c.lang || "en").trim() || "en" }, components: comps } }) });
  if (!r.ok) throw new Error(`WhatsApp didn't accept the message (${r.status}): ` + (await r.text()).replace(/\s+/g, " ").slice(0, 200));
}
/* Setting WhatsApp up from the token alone: Meta is asked which WhatsApp account, numbers and templates the token can use. */
const GRAPH = "https://graph.facebook.com/v23.0";
async function graph(token: string, path: string, init?: { method?: string; body?: any }): Promise<any> {
  const r = await fetch(GRAPH + path, { method: init?.method || "GET", headers: { Authorization: "Bearer " + token, ...(init?.body ? { "Content-Type": "application/json" } : {}) }, ...(init?.body ? { body: JSON.stringify(init.body) } : {}) });
  const j: any = await r.json().catch(() => null);
  if (!r.ok) { const e: any = new Error(String(j?.error?.error_user_msg || j?.error?.message || `Meta answered ${r.status}.`).slice(0, 300)); e.status = r.status; e.code = j?.error?.code; throw e; }
  return j;
}
/** The WhatsApp accounts a token reaches, each with its numbers and templates. `hint`: an ID typed by the owner.
    Meta lists the token's targets without saying what each is, so every ID is tried as a WhatsApp account, then as a
    business that owns WhatsApp accounts, then as a single phone number. */
async function waFind(token: string, hint = ""): Promise<{ wabas: any[]; why?: string }> {
  const ids = new Set<string>(); let why = "", refused = false, said = "", scopes: string[] | null = null;
  let raw = "", named = 0, firms = 0;
  const note = (e: any) => { const m = String(e?.message || "").trim(); if (m) raw = m; if (m && !/^Meta answered 404|nonexisting field|Unsupported get request|does not exist/i.test(m)) said = m; };
  if (/^\d{6,20}$/.test(hint)) ids.add(hint);
  try { const d = await graph(token, "/debug_token?input_token=" + encodeURIComponent(token)); for (const g of d?.data?.granular_scopes || []) if (/^(whatsapp_business_(management|messaging)|business_management)$/.test(g?.scope)) for (const t of g.target_ids || []) ids.add(String(t)); if (Array.isArray(d?.data?.scopes)) scopes = d.data.scopes.map(String); if (d?.data?.is_valid === false) why = "Meta says this token isn't valid (it may have expired)."; }
  catch (e: any) { if (e?.status === 401 || e?.code === 190) { refused = true; why = "Meta refused the token. Check that you copied all of it and that it hasn't expired."; } }
  named = ids.size - (/^\d{6,20}$/.test(hint) ? 1 : 0);
  const wabas: any[] = [], seen = new Set<string>();
  const account = async (id: string): Promise<boolean> => {
    if (seen.has(id)) return true;
    const ph = await graph(token, `/${id}/phone_numbers?fields=id,display_phone_number,verified_name&limit=20`).catch((e) => { note(e); throw e; }), tp = await graph(token, `/${id}/message_templates?fields=name,status,category,language&limit=200`).catch(() => ({ data: [] }));
    seen.add(id);
    wabas.push({ id, phones: (ph?.data || []).map((x: any) => ({ id: String(x.id), number: String(x.display_phone_number || ""), name: String(x.verified_name || "") })), templates: (tp?.data || []).map((x: any) => ({ name: String(x.name), status: String(x.status || ""), category: String(x.category || ""), language: String(x.language || "") })) });
    return true;
  };
  const lone: any[] = [];
  // A token that names no assets (some are made for "all assets"): ask which businesses it belongs to, and look there.
  if (!ids.size && !refused) { const b = await graph(token, "/me/businesses?fields=id&limit=10").catch((e) => { note(e); return null; }); for (const x of b?.data || []) if (x?.id) { ids.add(String(x.id)); firms++; } }
  for (const id of refused ? [] : [...ids].slice(0, 8)) {
    if (await account(id).catch(() => false)) continue;
    // Not a WhatsApp account: a business portfolio that owns some?
    let got = false;
    for (const edge of ["owned_whatsapp_business_accounts", "client_whatsapp_business_accounts"]) {
      const r = await graph(token, `/${id}/${edge}?fields=id&limit=5`).catch(() => null);
      for (const w of r?.data || []) if (await account(String(w.id)).catch(() => false)) got = true;
    }
    if (got) continue;
    // Or one phone number's own ID.
    const one = await graph(token, `/${id}?fields=id,display_phone_number,verified_name`).catch(() => null);
    if (one?.display_phone_number) lone.push({ id: String(one.id || id), number: String(one.display_phone_number), name: String(one.verified_name || "") });
  }
  // Only a number was found: enough to send from; its templates can't be listed without the account's ID.
  if (!wabas.length && lone.length) wabas.push({ id: "", phones: lone, templates: [] });
  // Say what is actually missing, when Meta told us.
  if (!wabas.length && !why && scopes) { const need = ["whatsapp_business_management", "whatsapp_business_messaging"].filter((x) => !scopes!.includes(x)); if (need.length) why = `This token was made without the permission${need.length > 1 ? "s" : ""} ${need.join(" and ")}. In Business settings → System users, press Generate new token, tick whatsapp_business_management and whatsapp_business_messaging in the list of permissions, and paste the new token here.`; }
  if (!wabas.length && !why && hint && /^\d{6,20}$/.test(hint)) why = `Meta would not open ${hint} with this token${said || raw ? `: “${(said || raw).slice(0, 220)}”` : ""}. That usually means the number pasted is not the WhatsApp Business Account ID, or the token was made without whatsapp_business_management. On the app's WhatsApp → API Setup page (Step 1. Try it out), copy the “WhatsApp Business Account ID”, or paste the “Phone number ID” shown beside it instead: either one works here.`;
  else if (!wabas.length && !why && hint) why = "The ID pasted should be digits only: the WhatsApp Business Account ID, or the Phone number ID, from the app's WhatsApp → API Setup page.";
  // What was looked at, so the next step is clear.
  const tail = !wabas.length && !why ? ` (Looked at: ${named} asset${named === 1 ? "" : "s"} named by the token, ${firms} business${firms === 1 ? "" : "es"} it belongs to.${said ? ` Meta said: “${said.slice(0, 200)}”.` : ""})` : "";
  return { wabas, ...(wabas.length ? {} : { why: why || "The token works, but Meta didn't show a WhatsApp account for it. Give the system user Full control of your WhatsApp account (Business settings → System users → Assign assets → WhatsApp accounts), generate a new token, and press Connect again. Or paste the WhatsApp Business Account ID, or the Phone number ID, below (both are on the app's WhatsApp → API Setup page)." + tail }) };
}
const WA_TPL: Record<string, (lang: string) => any> = {
  otp: (language) => ({ name: "signin_code", language, category: "authentication", components: [{ type: "body", add_security_recommendation: true }, { type: "footer", code_expiration_minutes: 10 }, { type: "buttons", buttons: [{ type: "otp", otp_type: "copy_code" }] }] }),
  order: (language) => ({ name: "order_alert", language, category: "utility", components: [{ type: "body", text: "New order {{1}} from {{2}}. To pay {{3}}. {{4}}", example: { body_text: [["ORD-1118-1234", "Asha Rao", "Rs 376", "Delivery, today 7:30 pm"]] } }] }),
  enquiry: (language) => ({ name: "enquiry_alert", language, category: "utility", components: [{ type: "body", text: "New enquiry from {{1}} ({{2}}): {{3}}", example: { body_text: [["Asha Rao", "9876543210", "Do you take group bookings on Sunday?"]] } }] }),
};
const waReady = (c: any) => !!(c && c.on && c.token && String(c.phoneId || "").trim());
/** "name@site.com = +91 98…" lines: the WhatsApp number of each person who signs in. */
/* ---- SMS: a code sent as a text message through the owner's own MSG91 (India, DLT templates) or Twilio account. */
const smsReady = (z: any) => !!(z && z.on && z.key && (z.provider === "twilio" ? String(z.sid || "").trim() && String(z.from || "").trim() : z.provider === "mcentral" ? String(z.sid || "").trim() : String(z.tpl || "").trim()));
/** Message Central (VerifyNow) makes and checks its own codes, so it can't carry a code this database made (sign-in codes). */
const smsOwnCode = (z: any) => z?.provider !== "mcentral";
const MC = "https://cpaas.messagecentral.com";
async function mcToken(z: any): Promise<string> {
  const q = new URLSearchParams({ customerId: String(z.sid).trim(), key: btoa(String(z.key)), scope: "NEW" }); if (String(z.email || "").trim()) { q.set("email", String(z.email).trim()); q.set("country", "IN"); }
  const r = await fetch(`${MC}/auth/v1/authentication/token?${q}`, { headers: { accept: "*/*" } }); let j: any = null; try { j = await r.json(); } catch { /* not JSON */ }
  if (!r.ok || !j?.token) throw new Error(`Message Central didn't accept the sign-in (${r.status}). Check the Customer ID and password.`);
  return String(j.token);
}
/** A number as Message Central wants it: the country code and the rest apart. */
const mcParts = (z: any, to: string) => { const cc = String(z.cc || "91").replace(/\D/g, "") || "91"; return to.startsWith(cc) ? { countryCode: cc, mobileNumber: to.slice(cc.length) } : { countryCode: cc, mobileNumber: to }; };
/** Message Central checks the code a customer typed against the one it sent. */
async function mcCheck(z: any, to: string, ref: string, code: string): Promise<boolean> {
  const q = new URLSearchParams({ ...mcParts(z, to), verificationId: ref, customerId: String(z.sid).trim(), code });
  const r = await fetch(`${MC}/verification/v3/validateOtp?${q}`, { headers: { accept: "*/*", authToken: await mcToken(z) } }); let j: any = null; try { j = await r.json(); } catch { /* not JSON */ }
  return r.ok && j?.data?.verificationStatus === "VERIFICATION_COMPLETED";
}
/** Sends a code by SMS. Gives back a reference when the SMS company made the code itself (it is then checked with them). */
async function smsSend(z: any, to: string, code: string, brand: string): Promise<string | void> {
  if (z.provider === "mcentral") {
    const q = new URLSearchParams({ ...mcParts(z, to), customerId: String(z.sid).trim(), flowType: "SMS", otpLength: "6" }); // (its own default is 4 digits)
    const r = await fetch(`${MC}/verification/v3/send?${q}`, { method: "POST", headers: { accept: "*/*", authToken: await mcToken(z) } }); let j: any = null; try { j = await r.json(); } catch { /* not JSON */ }
    const ref = String(j?.data?.verificationId ?? ""); if (!r.ok || !ref) throw new Error(`Message Central didn't send the code (${r.status})${j?.message ? ": " + String(j.message).slice(0, 200) : ""}`);
    return ref;
  }
  if (z.provider === "sent") {
    // Sent (sent.dm): a template with the code in its variable; on SMS, or on whichever channel Sent picks.
    const v = String(z.varName || "code").trim() || "code", chan = ["sms", "whatsapp", "rcs", "sent"].includes(z.chan) ? z.chan : "sms";
    const r = await fetch("https://api.sent.dm/v3/messages", { method: "POST", headers: { "x-api-key": z.key, "Content-Type": "application/json" }, body: JSON.stringify({ to: ["+" + to], template: { id: String(z.tpl).trim(), parameters: { [v]: code } }, channel: [chan] }) });
    let j: any = null; try { j = await r.json(); } catch { /* not JSON */ }
    if (!r.ok || j?.success === false) throw new Error(`Sent didn't accept the message (${r.status})${j?.error?.message ? ": " + String(j.error.message).slice(0, 200) : ""}`);
    return;
  }
  if (z.provider === "twilio") {
    const body = (String(z.text || "").trim() || "{code} is your verification code for {site}.").replace(/\{code\}/g, code).replace(/\{site\}/g, brand).slice(0, 300), from = String(z.from).trim();
    const f = new URLSearchParams({ To: "+" + to, Body: body }); f.set(/^MG[0-9a-f]{32}$/i.test(from) ? "MessagingServiceSid" : "From", from);
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(String(z.sid).trim())}/Messages.json`, { method: "POST", headers: { Authorization: "Basic " + btoa(String(z.sid).trim() + ":" + z.key), "Content-Type": "application/x-www-form-urlencoded" }, body: f.toString() });
    if (!r.ok) { let m = ""; try { m = String(((await r.json()) as any)?.message || ""); } catch { /* not JSON */ } throw new Error(`Twilio didn't accept the message (${r.status})${m ? ": " + m.slice(0, 200) : ""}`); }
    return;
  }
  // MSG91 "flow": the template approved on DLT, with the code in its variable (the name is tried as typed, in capitals and in small letters).
  const v = String(z.varName || "var1").trim() || "var1", rec: any = { mobiles: to, [v]: code, [v.toUpperCase()]: code, [v.toLowerCase()]: code }, tpl = String(z.tpl).trim();
  const r = await fetch("https://control.msg91.com/api/v5/flow/", { method: "POST", headers: { authkey: z.key, "Content-Type": "application/json", accept: "application/json" }, body: JSON.stringify({ template_id: tpl, flow_id: tpl, ...(String(z.sender || "").trim() ? { sender: String(z.sender).trim() } : {}), short_url: "0", recipients: [rec] }) });
  let j: any = null; try { j = await r.json(); } catch { /* not JSON */ }
  if (!r.ok || !j || j.type !== "success") throw new Error(`MSG91 didn't accept the message (${r.status})${j?.message ? ": " + String(j.message).slice(0, 200) : ""}`);
}
/** What the Studio lets a site use for codes (content.cms.msg): sign-in codes besides email, and checkout codes. Unset: everything. */
function msgPolicy(c: any): { login: { wa: boolean; sms: boolean }; checkout: { wa: boolean; sms: boolean } } {
  const m = c?.cms?.msg || {}, of = (v: unknown) => ({ wa: v == null || v === "" || v === "wa" || v === "both", sms: v == null || v === "" || v === "sms" || v === "both" });
  return { login: of(m.login), checkout: of(m.checkout) };
}
/** How a site can send a checkout code just now: WhatsApp, SMS or both, and whether every customer has to verify. */
async function codeWays(env: Env, site: string, c?: any) {
  const w = await getSetting(env, "site:" + site, "wa").catch(() => null), z = await getSetting(env, "site:" + site, "sms").catch(() => null);
  const sc = c === undefined ? await siteContent(env, site).catch(() => null) : c, pol = msgPolicy(sc).checkout;
  const wa = pol.wa && waReady(w) && !!String(w.tplOtp || "").trim(), sms = pol.sms && smsReady(z);
  // every customer verifies: asked for in the WhatsApp or SMS card, or by the site's own switch (Checkout → Contact details)
  const asked = !!(isRest(sc) ? sc?.ordering?.verifyPhone : sc?.checkout?.verifyPhone);
  return { w, z, wa, sms, any: wa || sms, need: (wa && !!w.orderOtp) || (sms && !!z.orderOtp) || ((wa || sms) && asked), cc: String(w?.cc || z?.cc || "91") };
}
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
/** Points (content.loyalty): earned on every order, spent at checkout by a guest whose mobile number is verified. */
export const loyOf = (c: any) => { const L = c?.loyalty || {}; return { on: !!L.on, earn: Math.max(0, +L.earn || 0), worth: Math.max(0, +L.worth || 0), min: Math.max(0, Math.floor(+L.min || 0)), maxPct: Math.max(0, Math.min(100, L.maxPct == null || L.maxPct === "" ? 50 : +L.maxPct || 0)) }; };
/** Points a bill may be paid with: what the guest asked for, no more than they have, than the site's limit of the
 *  bill, or than the bill itself. `bal` comes from this database only (never from the page). */
export function pointsFor(c: any, want: unknown, bal: number, amount: number): { points: number; off: number } {
  const L = loyOf(c), ask = Math.min(Math.floor(+(want as any) || 0), Math.floor(bal || 0));
  if (!L.on || !(L.worth > 0) || ask <= 0 || ask < L.min || !(amount > 0)) return { points: 0, off: 0 };
  const points = Math.max(0, Math.min(ask, Math.floor((amount * L.maxPct) / 100 / L.worth)));
  return { points, off: Math.round(points * L.worth * 100) / 100 };
}
export function restBill(c: any, q: any): { total: number; points?: number; pointsOff?: number; net?: number; parts?: { sub: number; disc: number; pack: number; del: number; tax: number; pct: number; tip: number; incl: boolean }; units?: number[] } | { error: string } {
  const o = c?.ordering || {}; if (!o.on) return { error: "Online ordering is switched off." };
  const mode = String(q?.mode || ""), modes = o.modes || {}; if (!["delivery", "pickup", "dinein"].includes(mode) || !modes[mode]) return { error: "That way of ordering isn't offered." };
  const dishes = new Map<string, any>();
  for (const k of c?.food?.categories || []) { if (!k || !String(k.name || "").trim()) continue; for (const d of k.items || []) if (d && String(d.name || "").trim() && !d.noOrder && !d.soldOut) dishes.set(rslug(k.name) + "/" + rslug(d.name), d); }
  let sub = 0; const units: number[] = []; const lines = Array.isArray(q?.items) ? q.items.slice(0, 60) : []; if (!lines.length) return { error: "The cart is empty." };
  for (const l of lines) {
    const d = dishes.get(String(l?.id || "")); if (!d) return { error: "A dish in the cart is no longer on the menu. Refresh the page." };
    const V = rchoices(d), qty = Math.max(1, Math.min(50, Math.floor(+l.qty || 0)));
    let unit = V.length ? Number((V.find((v) => v.label === String(l.variant)) || { price: NaN }).price) : rnum(d.price);
    if (isNaN(unit)) return { error: "A dish in the cart changed. Refresh the page." };
    const opts = new Map<string, number>(); for (const g of d.addons || []) for (const s of (g && g.options) || []) { const t = String(s || ""), i = t.lastIndexOf("="), label = (i > 0 ? t.slice(0, i) : t).trim(), pr = i > 0 ? rnum(t.slice(i + 1)) : 0; if (label) opts.set(label, isNaN(pr) ? 0 : pr); }
    for (const a of Array.isArray(l.addons) ? l.addons.slice(0, 20) : []) { if (!opts.has(String(a))) return { error: "An extra in the cart changed. Refresh the page." }; unit += opts.get(String(a))!; }
    sub += unit * qty; units.push(Math.round(unit * 100) / 100);
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
  // points the guest spends (q._bal: their balance, set by this database after their number is verified)
  const pt = pointsFor(c, q.points, +q._bal || 0, sub - disc);
  const base = sub - disc - pt.off + pack, pct = Math.max(0, +o.taxPercent || 0), tax = o.taxIncluded || !pct ? 0 : Math.round(base * pct) / 100;
  const tip = o.tips !== false && mode !== "pickup" ? Math.max(0, Math.min(5000, +q.tip || 0)) : 0;
  const raw = base + tax + del + tip, total = o.roundOff === false ? Math.round(raw * 100) / 100 : Math.round(raw);
  if (mode !== "dinein" && sub < Math.max(0, +o.minOrder || 0)) return { error: "The order is below the minimum." };
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return { total, points: pt.points, pointsOff: pt.off, net: Math.round((sub - disc - pt.off) * 100) / 100, units, parts: { sub: r2(sub), disc: r2(disc + pt.off), pack: r2(pack), del: r2(del), tax: r2(tax), pct, tip: r2(tip), incl: !!o.taxIncluded } };
}

/* ---- Petpooja: an order placed on the site is handed to the restaurant's Petpooja, which then reports its status. ---- */
const POS_URL = "https://pponlineordercb.petpooja.com/save_order";
const posReady = (z: any) => !!(z && z.on && z.secret && z.token && z.appKey && z.restId);
/** The cart as Petpooja items. Every dish (or the chosen size) needs the item's ID from Petpooja; without one the order can't be sent. */
export function posItems(c: any, q: any): { items: any[]; sub: number } | { error: string } {
  const dishes = new Map<string, any>();
  for (const k of c?.food?.categories || []) { if (!k || !String(k.name || "").trim()) continue; for (const d of k.items || []) if (d && String(d.name || "").trim()) dishes.set(rslug(k.name) + "/" + rslug(d.name), d); }
  const items: any[] = []; let sub = 0;
  for (const l of Array.isArray(q?.items) ? q.items.slice(0, 60) : []) {
    const d = dishes.get(String(l?.id || "")); if (!d) return { error: "a dish that is no longer on the menu" };
    const V = rchoices(d), v = V.length ? V.find((x) => x.label === String(l.variant)) : null, qty = Math.max(1, Math.min(50, Math.floor(+l.qty || 0)));
    if (V.length && !v) return { error: `a size or variety of “${String(d.name).slice(0, 60)}” that is no longer on the menu` };
    const id = String(d.posId || "").trim(), vid = v ? String(v.posId || "").trim() : "";
    if (!id) return { error: `“${String(d.name).slice(0, 60)}” has no Petpooja item ID` };
    let unit = v ? rnum(v.price) : rnum(d.price); if (isNaN(unit)) return { error: "a dish whose price changed" };
    const opts = new Map<string, number>(); for (const g of d.addons || []) for (const o of (g && g.options) || []) { const t = String(o || ""), i = t.lastIndexOf("="), label = (i > 0 ? t.slice(0, i) : t).trim(), pr = i > 0 ? rnum(t.slice(i + 1)) : 0; if (label) opts.set(label, isNaN(pr) ? 0 : pr); }
    const extras = (Array.isArray(l.addons) ? l.addons.slice(0, 20) : []).map(String).filter((a: string) => opts.has(a)); for (const a of extras) unit += opts.get(a)!;
    sub += unit * qty;
    items.push({ id, name: String(d.name).slice(0, 120), gst_liability: "restaurant", item_tax: [], item_discount: "", price: unit.toFixed(2), final_price: unit.toFixed(2), quantity: String(qty), description: extras.length ? "Extras: " + extras.join(", ") : "", variation_name: v ? String(v.label) : "", variation_id: vid, AddonItem: { details: [] } });
  }
  return items.length ? { items, sub } : { error: "an empty cart" };
}
/** A guest's verified points balance: their number proved with the code sent on WhatsApp (the same proof an order
 *  needs), then looked up here. 0 when the proof is missing or stale. */
/** What an order held, in short: each thing's name, how many, and its picture (a path inside the site). Kept with the
 *  order so a signed-in customer's history can show it. */
function orderItems(c: any, cart: any): { n: string; q: number; i: string; p?: number }[] {
  const out: { n: string; q: number; i: string; p?: number }[] = [], lines = Array.isArray(cart?.items) ? cart.items.slice(0, 40) : [], pic = (v: any) => (typeof v?.path === "string" && !/^[a-z]+:|^\/\//i.test(v.path) ? v.path.slice(0, 200) : "");
  if (isRest(c)) {
    const dishes = new Map<string, any>(); for (const k of c?.food?.categories || []) for (const d of k?.items || []) if (d && String(d.name || "").trim()) dishes.set(rslug(k.name) + "/" + rslug(d.name), d);
    for (const l of lines) { const d = dishes.get(String(l?.id || "")); if (d) out.push({ n: (oneLine(String(d.name)) + (l.variant ? " · " + oneLine(String(l.variant)) : "")).slice(0, 90), q: Math.max(1, Math.floor(+l.qty || 1)), i: pic(d.image) }); }
  } else {
    const P = new Map<string, any>((Array.isArray(c?.products) ? c.products : []).filter((x: any) => x && x.id).map((x: any) => [String(x.id), x]));
    for (const l of lines) { const p = P.get(String(l?.id || "")); if (p) out.push({ n: (oneLine(String(p.name)) + (l.opt ? " · " + oneLine(String(l.opt)) : "")).slice(0, 90), q: Math.max(1, Math.floor(+l.qty || 1)), i: pic(Array.isArray(p.images) ? p.images[0] : null) }); }
  }
  return out;
}
/* ---- Inventory (content.inventory.on): how many of each product or dish are left, kept on this database. An item is
   counted only once the owner gives it a quantity; everything else sells without a limit. An option or size can have
   its own count ("<item>|<option>"), else it draws on the item's. Orders take from it as they are placed (an unpaid
   order that asks for more than is left is refused), a cancelled order gives it back, and every change is logged. */
const invOn = (c: any) => !!c?.inventory?.on;
/** A customer's saved items: up to 200 short ids, each once. */
const cleanFavs = (v: unknown): string[] => [...new Set((Array.isArray(v) ? v : []).map((x) => String(x || "").trim().slice(0, 140)).filter(Boolean))].slice(0, 200);
const stockKey = (id: unknown, opt?: unknown) => { const a = String(id || "").trim().slice(0, 130), b = oneLine(String(opt || "")).toLowerCase().slice(0, 60); return b ? a + "|" + b : a; };
/** Every item that can be counted on this site: [key, name], options and sizes after their item. */
function stockItems(c: any): { item: string; name: string; group: string; opt: boolean }[] {
  const out: { item: string; name: string; group: string; opt: boolean }[] = [];
  if (isRest(c)) { for (const k of c?.food?.categories || []) for (const d of k?.items || []) { if (!d || !String(d.name || "").trim()) continue; const id = rslug(k.name) + "/" + rslug(d.name), nm = oneLine(String(d.name)).slice(0, 90); out.push({ item: id, name: nm, group: oneLine(String(k.name || "")).slice(0, 60), opt: false }); for (const v of Array.isArray(d.variants) ? d.variants : []) if (v && String(v.label || "").trim()) out.push({ item: stockKey(id, v.label), name: nm + " · " + oneLine(String(v.label)).slice(0, 40), group: "", opt: true }); } }
  else { const cats = new Map<string, string>((Array.isArray(c?.categories) ? c.categories : []).map((x: any) => [String(x?.id || ""), oneLine(String(x?.name || ""))])); for (const p of Array.isArray(c?.products) ? c.products : []) { if (!p || !p.id) continue; const nm = oneLine(String(p.name || "")).slice(0, 90); out.push({ item: String(p.id), name: nm, group: cats.get(String(p.category || "")) || "", opt: false }); for (const o of [...(p.kindsOn && Array.isArray(p.kinds) ? p.kinds : []), ...(Array.isArray(p.options) ? p.options : [])]) { const l = oneLine(String(typeof o === "string" ? o : o?.label || o?.name || "")); if (l) out.push({ item: stockKey(p.id, l), name: nm + " · " + l.slice(0, 40), group: "", opt: true }); } } }
  return out.slice(0, 1500);
}
/** What a cart needs from stock: for each counted row, how many, and what to call it. */
async function stockNeed(env: Env, site: string, c: any, cart: any): Promise<{ need: Map<string, { q: number; name: string }>; rows: Map<string, { qty: number; low: number }> }> {
  await ensure(env);
  const lines = (Array.isArray(cart?.items) ? cart.items.slice(0, 40) : []).map((l: any) => ({ base: stockKey(l?.id), own: [String(l?.opt || l?.variant || ""), ...String(l?.opt || "").split(" · ")].filter((x, i, a) => x.trim() && a.indexOf(x) === i).map((x) => stockKey(l?.id, x)), q: Math.max(1, Math.min(999, Math.floor(+l?.qty || 1))) })).filter((l: any) => l.base);
  const need = new Map<string, { q: number; name: string }>(), rows = new Map<string, { qty: number; low: number }>(); if (!lines.length) return { need, rows };
  const keys = [...new Set(lines.flatMap((l: any) => [l.base, ...l.own]))] as string[];
  for (const r of ((await env.DB.prepare(`select item, qty, low from stock where site = ? and item in (${keys.map(() => "?").join(",")})`).bind(site, ...keys).all()).results || []) as any[]) rows.set(String(r.item), { qty: +r.qty || 0, low: +r.low || 0 });
  const names = new Map(stockItems(c).map((x) => [x.item, x.name]));
  // a line draws on its own option's count when that option is counted, else on the item's
  for (const l of lines) { const k = l.own.find((x: string) => rows.has(x)) || (rows.has(l.base) ? l.base : ""); if (!k) continue; const had = need.get(k); need.set(k, { q: (had?.q || 0) + l.q, name: names.get(k) || names.get(l.base) || "that item" }); }
  return { need, rows };
}
const stockSorry = (name: string, left: number) => (left > 0 ? `Sorry, only ${left} left of ${name}. Change the quantity in your cart and try again.` : `Sorry, ${name} has just sold out. Remove it from your cart to go on.`);
/** "" when everything in the cart is in stock, else what to tell the customer. */
async function stockCheck(env: Env, site: string, c: any, cart: any): Promise<string> {
  const { need, rows } = await stockNeed(env, site, c, cart);
  for (const [k, n] of need) { const left = rows.get(k)!.qty; if (left < n.q) return stockSorry(n.name, Math.max(0, left)); }
  return "";
}
/** Takes an order's items out of stock. `force` (an order already paid for) never refuses: it takes what there is. */
async function stockTake(env: Env, site: string, c: any, cart: any, ref: string, force = false): Promise<{ taken: [string, number][]; short: string; low: { name: string; qty: number }[] }> {
  const { need, rows } = await stockNeed(env, site, c, cart), now = new Date().toISOString(), taken: [string, number][] = [], low: { name: string; qty: number }[] = []; let short = "";
  for (const [k, n] of need) {
    const r: any = await env.DB.prepare("update stock set qty = qty - ?, updated_at = ? where site = ? and item = ? and qty >= ?").bind(n.q, now, site, k, n.q).run();
    if (r?.meta?.changes) { taken.push([k, n.q]); continue; }
    const left = Math.max(0, +(((await env.DB.prepare("select qty from stock where site = ? and item = ?").bind(site, k).first()) as any)?.qty) || 0);
    short = short || stockSorry(n.name, left);
    if (!force) { await stockBack(env, site, taken, ref, "Order not placed"); return { taken: [], short, low: [] }; }
    if (left > 0) { await env.DB.prepare("update stock set qty = 0, updated_at = ? where site = ? and item = ?").bind(now, site, k).run(); taken.push([k, left]); }
  }
  if (!taken.length) return { taken, short, low };
  const after = new Map<string, number>(); for (const r of ((await env.DB.prepare(`select item, qty from stock where site = ? and item in (${taken.map(() => "?").join(",")})`).bind(site, ...taken.map((t) => t[0])).all()).results || []) as any[]) after.set(String(r.item), +r.qty || 0);
  await env.DB.batch(taken.map(([k, q]) => env.DB.prepare("insert into stock_log (site, item, delta, qty, why, ref, at) values (?, ?, ?, ?, 'Order', ?, ?)").bind(site, k, -q, after.get(k) ?? 0, ref.slice(0, 40), now)));
  for (const [k, q] of taken) { const a = after.get(k) ?? 0, lw = rows.get(k)?.low || 0; if ((a <= lw && a + q > lw) || (a === 0 && q > 0)) low.push({ name: need.get(k)!.name, qty: a }); }
  return { taken, short, low };
}
/** Gives quantities back to stock (a cancelled order). */
async function stockBack(env: Env, site: string, taken: [string, number][], ref: string, why: string) {
  const now = new Date().toISOString();
  for (const [k, q] of taken) { if (!(q > 0)) continue; const r: any = await env.DB.prepare("update stock set qty = qty + ?, updated_at = ? where site = ? and item = ? returning qty").bind(q, now, site, k).first(); if (r) await env.DB.prepare("insert into stock_log (site, item, delta, qty, why, ref, at) values (?, ?, ?, ?, ?, ?, ?)").bind(site, k, q, +r.qty || 0, why.slice(0, 60), ref.slice(0, 40), now).run(); }
}
/** An email to the owner when an order takes an item down to its low mark (or to nothing). */
async function stockLowMail(env: Env, site: string, c: any, low: { name: string; qty: number }[]) {
  env = await siteMail(env, site);
  if (!low.length || c?.inventory?.alert === false || !env.RESEND_API_KEY || !env.MAIL_FROM) return;
  const addrs = (v: unknown) => String(v || "").split(/[,;\s]+/).map((x) => x.trim()).filter((x) => EMAIL_RE.test(x)).slice(0, 5);
  let to = addrs(c?.inventory?.alertTo); if (!to.length) to = addrs(c?.contact?.form?.notifyTo); if (!to.length) to = addrs(c?.contact?.email);
  if (!to.length) to = addrs((((await env.DB.prepare("select email from members where scope = ? order by role = 'owner' desc limit 3").bind("site:" + site).all()).results || []) as any[]).map((r) => r.email).join(","));
  if (!to.length) return;
  const out = low.filter((x) => x.qty <= 0), few = low.filter((x) => x.qty > 0);
  await sendMail(env, to, `${out.length ? "Sold out: " + out.map((x) => x.name).join(", ") : "Running low: " + few.map((x) => x.name).join(", ")}`.slice(0, 150), WRAP(`<h2 style="margin:0 0 12px;font-size:20px">Stock at ${hesc(siteName(c, site))}</h2>${out.length ? paras("Sold out:\n" + out.map((x) => "• " + x.name).join("\n")) : ""}${few.length ? paras("Running low:\n" + few.map((x) => `• ${x.name}: ${x.qty} left`).join("\n")) : ""}${paras("Add stock under Inventory in your site's admin page.", "margin:0 0 8px;color:#667;font-size:13px")}`));
}
/* ---- Abandoned carts (content.recovery): a shopper who typed their email at checkout and left leaves their cart here; a
   reminder with a link that puts it back goes out after an hour (and again a day later, if the owner wants). An order
   from the same email closes the cart as recovered. Reminders are sent by a sweep that runs whenever the site is used
   (no clock needed), at most one every few minutes, at most 50 emails a day per site, and every email has a stop link. */
const recOn = (c: any) => !!c?.recovery?.on;
const recKey = (email: string) => email.trim().toLowerCase();
const recMoney = (c: any, n: number) => { const cur = siteCur(c); try { return new Intl.NumberFormat("en-IN", { style: "currency", currency: cur, maximumFractionDigits: n % 1 ? 2 : 0 }).format(n); } catch { return cur + " " + n; } };
const recTok = () => { const a = new Uint8Array(16); crypto.getRandomValues(a); return [...a].map((x) => x.toString(16).padStart(2, "0")).join(""); };
async function recSend(env: Env, site: string, c: any, row: any, origin: string): Promise<void> {
  env = await siteMail(env, site);
  const R = c?.recovery || {}, shop = siteName(c, site), items: { n: string; q: number }[] = (() => { try { return JSON.parse(row.items); } catch { return []; } })();
  const base = String(R.url || "").trim().replace(/[?#].*$/, ""), back = /^https:\/\//.test(base) ? base : String(row.back || "");
  if (!/^https:\/\//.test(back)) throw new Error("No shop address to link to.");
  const link = back + "?rc=" + row.tok, stop = origin + "/cart/" + site + "/" + row.tok + "/stop";
  const list = items.slice(0, 12).map((x) => `• ${x.n}${x.q > 1 ? " × " + x.q : ""}`).join("\n") + (items.length > 12 ? `\n• and ${items.length - 12} more` : "");
  const vars = { name: oneLine(row.name).split(" ")[0] || "there", items: list, total: recMoney(c, +row.total || 0), shop, offer: oneLine(String(R.offer || "")) };
  const subject = oneLine(fill(String(R.subject || "You left something in your cart at {shop}"), vars)).slice(0, 150);
  const text = fill(String(R.body || "Hi {name},\n\nYou left these in your cart at {shop}:\n\n{items}\n\nTotal: {total}\n\n{offer}"), vars).replace(/\n{3,}/g, "\n\n");
  const html = WRAP(`${paras(text)}<p style="margin:18px 0"><a href="${hesc(link)}" style="background:#111;color:#fff;padding:11px 20px;border-radius:8px;text-decoration:none;display:inline-block">${hesc(String(R.button || "Back to my cart"))}</a></p><p style="margin:0;color:#889;font-size:12px">Don't want these reminders? <a href="${hesc(stop)}" style="color:#889">Stop them</a>.</p>`);
  await sendMail(env, row.email, subject, html, undefined);
}
let recLast = 0;
/** Sends the reminders that are due. Runs at most every 4 minutes per instance, whenever the site is used. */
async function recSweep(env: Env, origin: string, force = false): Promise<number> {
  const now = Date.now(); if (!force && now - recLast < ((env as any).REC_GAP ?? 240_000)) return 0; recLast = now; if (!env.RESEND_API_KEY || !env.MAIL_FROM) return 0;
  const rows = (((await env.DB.prepare("select * from carts where status = 'open' and sent < 2 and email != '' and updated_at < ? and updated_at > ? order by updated_at limit 60").bind(new Date(now - 1800_000).toISOString(), new Date(now - 7 * 86400_000).toISOString()).all()).results) || []) as any[];
  const cache = new Map<string, any>(), day = new Map<string, number>(); let sent = 0;
  for (const r of rows) {
    if (sent >= 20) break;
    if (!cache.has(r.site)) cache.set(r.site, await siteContent(env, r.site).catch(() => null));
    const c = cache.get(r.site), R = c?.recovery; if (!recOn(c) || R.auto === false) continue;
    const after = Math.max(0.5, Math.min(72, +R.after || 1)) * 3600_000, again = R.again === 0 || R.again === "0" ? 0 : Math.max(2, Math.min(240, +R.again || 24)) * 3600_000;
    const last = Date.parse(r.sent ? r.sent_at : r.updated_at) || 0; if (now - last < (r.sent ? again : after) || (r.sent && !again)) continue;
    if (!day.has(r.site)) day.set(r.site, +(((await env.DB.prepare("select count(*) n from carts where site = ? and sent_at > ?").bind(r.site, new Date(now - 86400_000).toISOString()).first()) as any)?.n || 0));
    if ((day.get(r.site) || 0) >= 50) continue;
    try { await recSend(env, r.site, c, r, origin); } catch { await env.DB.prepare("update carts set sent = 2, sent_at = ? where site = ? and ckey = ?").bind(new Date().toISOString(), r.site, r.ckey).run(); continue; }
    await env.DB.prepare("update carts set sent = sent + 1, sent_at = ? where site = ? and ckey = ?").bind(new Date().toISOString(), r.site, r.ckey).run(); day.set(r.site, (day.get(r.site) || 0) + 1); sent++;
  }
  if (Math.random() < 0.02) await env.DB.prepare("delete from carts where updated_at < ?").bind(new Date(now - 45 * 86400_000).toISOString()).run().catch(() => {});
  return sent;
}
/* ---- Product and dish reviews (content.reviews): shoppers rate and write about a product or dish on its page. Each review
   waits for the owner's approval unless that is switched off; one from an email that ordered the item is marked as a
   verified buyer. Only a first name and initial are shown, never the email address. */
const revOn = (c: any) => !!c?.reviews?.on;
const revName = (n: string) => { const w = oneLine(n).split(" ").filter(Boolean); return w.length > 1 ? w[0] + " " + w[w.length - 1][0].toUpperCase() + "." : w[0] || "Customer"; };
const revShown = (r: any) => ({ id: r.id, name: revName(r.name), rating: r.rating, title: r.title, body: r.body, verified: !!r.verified, reply: r.reply || "", at: String(r.created_at).slice(0, 10) });
async function ownerTo(env: Env, site: string, c: any, pref: unknown): Promise<string[]> {
  const addrs = (v: unknown) => String(v || "").split(/[,;\s]+/).map((x) => x.trim()).filter((x) => EMAIL_RE.test(x)).slice(0, 5);
  let to = addrs(pref); if (!to.length) to = addrs(c?.contact?.form?.notifyTo); if (!to.length) to = addrs(c?.contact?.email);
  if (!to.length) to = addrs((((await env.DB.prepare("select email from members where scope = ? order by role = 'owner' desc limit 3").bind("site:" + site).all()).results || []) as any[]).map((r) => r.email).join(","));
  return to;
}
const cleanDob = (v: unknown) => (/^(19|20)\d\d-\d\d-\d\d$/.test(String(v ?? "")) ? String(v) : "");
const cleanGender = (v: unknown) => (["female", "male", "other"].includes(String(v ?? "")) ? String(v) : "");
const cleanAddr = (a: any) => { const t = (v: unknown, n = 120) => oneLine(String(v ?? "")).replace(/\s+/g, " ").slice(0, n); return { label: t(a?.label, 30), line1: t(a?.line1), line2: t(a?.line2), city: t(a?.city, 60), pin: t(a?.pin, 12), state: t(a?.state, 60) }; };
/* ---- Customer accounts (content.account): a customer signs in with a code sent to their mobile number or email address,
   and stays signed in on that device with a pass only this database can make. The pass names the customer by that number
   or address (the same key their record and points are kept under). */
const CUST_DAYS = 30;
const custPass = async (env: Env, site: string, key: string, exp: number) => exp + "." + b64u(await hmac(env.SECRET, "cust:" + site + ":" + key + ":" + exp));
async function custOk(env: Env, site: string, key: string, pass: unknown): Promise<boolean> {
  const [exp, sig] = String(pass || "").split("."); return !!key && +exp > Date.now() && sig === b64u(await hmac(env.SECRET, "cust:" + site + ":" + key + ":" + exp));
}
/** What signing in is offered with on this site just now, or null when accounts are off or no code can be sent. */
function acctOf(env: Env, c: any, cw: { wa: boolean; sms: boolean }): { by: string; phone: string[]; email: boolean } | null {
  const a = c?.account; if (!a?.on) return null;
  const by = a.by === "email" || a.by === "either" ? a.by : "phone", via = [cw.wa ? "wa" : "", cw.sms ? "sms" : ""].filter(Boolean);
  const phone = by === "email" ? [] : via, email = by !== "phone" && !!(env.RESEND_API_KEY && env.MAIL_FROM);
  return phone.length || email ? { by, phone, email } : null;
}
/** The customer a signed-in pass stands for, among the number and address given: their key, or "". */
async function custWho(env: Env, site: string, A: { phone: string[]; email: boolean } | null, cc: string, phone: unknown, email: unknown, pass: unknown): Promise<{ key: string; kind: "" | "phone" | "email" }> {
  if (!A || !pass) return { key: "", kind: "" };
  const pk = A.phone.length ? waNum(phone, cc) : "", ek = A.email ? emailKey(email) : "";
  if (pk && (await custOk(env, site, pk, pass))) return { key: pk, kind: "phone" };
  if (ek && (await custOk(env, site, ek, pass))) return { key: ek, kind: "email" };
  return { key: "", kind: "" };
}
async function pointsBal(env: Env, site: string, phone: unknown, token: unknown, more?: { email?: unknown; acct?: unknown }): Promise<{ key: string; bal: number; ok: boolean }> {
  if (more?.acct) { // signed in: the pass is the proof
    const sc = await siteContent(env, site).catch(() => null), cw = await codeWays(env, site, sc), who = await custWho(env, site, acctOf(env, sc, cw), cw.cc, phone, more.email, more.acct);
    if (who.key) { const r: any = await env.DB.prepare("select points from customers where site = ? and ckey = ?").bind(site, who.key).first(); return { key: who.key, bal: Math.max(0, +r?.points || 0), ok: true }; }
  }
  const cc = (await getSetting(env, "site:" + site, "wa").catch(() => null))?.cc || (await getSetting(env, "site:" + site, "sms").catch(() => null))?.cc, num = waNum(phone, cc), [exp, sig] = String(token || "").split(".");
  if (!num || !(+exp > Date.now()) || sig !== b64u(await hmac(env.SECRET, "otp:" + site + ":" + num + ":" + exp))) return { key: num, bal: 0, ok: false };
  const r: any = await env.DB.prepare("select points from customers where site = ? and ckey = ?").bind(site, num).first();
  return { key: num, bal: Math.max(0, +r?.points || 0), ok: true };
}
/** Keeps the customer of an order (by mobile number, else email), counts the order, and settles its points: spent ones
 *  come off, new ones are earned on what was paid for the goods. Gives back a line for the order's record. */
async function custOrder(env: Env, site: string, c: any, data: Record<string, string>, cart: any, who = ""): Promise<string> {
  const w = { cc: (await getSetting(env, "site:" + site, "wa").catch(() => null))?.cc || (await getSetting(env, "site:" + site, "sms").catch(() => null))?.cc };
  // a signed-in customer is kept under what they signed in with; anyone else by mobile number, else email
  const key = who || waNum(data.phone, w?.cc) || String(data.email || "").trim().toLowerCase().slice(0, 120); if (!key) return "";
  if (await env.DB.prepare("select 1 from points where site = ? and order_no = ? limit 1").bind(site, data.order_no).first()) return "";
  const L = loyOf(c), verified = data._phone || who ? 1 : 0, now = new Date().toISOString();
  let net = NaN, used = 0, off = 0;
  if (cart && typeof cart === "object") {
    if (isRest(c)) { const bal = verified ? Math.max(0, +((await env.DB.prepare("select points from customers where site = ? and ckey = ?").bind(site, key).first()) as any)?.points || 0) : 0;
      const b = restBill(c, { ...cart, _bal: bal }); if (!("error" in b)) { net = b.net ?? b.total; used = b.points || 0; off = b.pointsOff || 0; } }
    else if (Array.isArray(c?.products)) { const bal = verified ? Math.max(0, +((await env.DB.prepare("select points from customers where site = ? and ckey = ?").bind(site, key).first()) as any)?.points || 0) : 0;
      const b = shopBill(c, { ...cart, _bal: bal }); if (!("error" in b)) { net = b.net ?? b.total; used = b.points || 0; off = b.pointsOff || 0; } }
  }
  if (isNaN(net)) net = rnum(data.total);
  const spent = isNaN(net) ? 0 : net, earned = L.on && L.earn > 0 ? Math.floor((spent / 100) * L.earn) : 0;
  await env.DB.prepare("insert into customers (site, ckey, name, phone, email, verified, orders, spent, points, first_at, last_at) values (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?) on conflict (site, ckey) do update set name = case when excluded.name <> '' then excluded.name else name end, phone = case when excluded.phone <> '' then excluded.phone else phone end, email = case when excluded.email <> '' then excluded.email else email end, verified = max(verified, excluded.verified), orders = orders + 1, spent = spent + excluded.spent, points = max(0, points + excluded.points), last_at = excluded.last_at")
    .bind(site, key, oneLine(String(data.name || "")).slice(0, 100), String(data.phone || "").slice(0, 24), String(data.email || "").trim().slice(0, 120), verified, spent, earned - used, now, now).run();
  const st = []; if (used) st.push(env.DB.prepare("insert into points (site, ckey, delta, why, order_no, at) values (?, ?, ?, ?, ?, ?)").bind(site, key, -used, "Spent on an order", data.order_no, now));
  st.push(env.DB.prepare("insert into points (site, ckey, delta, why, order_no, at) values (?, ?, ?, ?, ?, ?)").bind(site, key, earned, "Earned on an order", data.order_no, now));
  await env.DB.batch(st);
  const cur = siteCur(c);
  return L.on ? [used ? `Spent ${used} point${used === 1 ? "" : "s"} (${pgMoney(cur, Math.round(off * 100))} off)` : "", earned ? `Earned ${earned} point${earned === 1 ? "" : "s"}` : ""].filter(Boolean).join(". ") : "";
}
/** Sends one saved order to Petpooja. Gives back a short line for the order's record. */
async function posSend(env: Env, site: string, z: any, c: any, q: any, data: Record<string, string>, origin: string): Promise<string> {
  const it = posItems(c, q); if ("error" in it) return "Not sent to Petpooja: " + it.error + ".";
  const bill = restBill(c, q); if ("error" in bill) return "Not sent to Petpooja: " + bill.error;
  const o = c.ordering || {}, mode = String(q.mode), now = new Date(Date.now() + 330 * 60000).toISOString().replace("T", " ").slice(0, 19);
  const cp = (o.coupons || []).find((x: any) => x && x.on !== false && +x.value > 0 && String(x.code || "").trim().toUpperCase() === String(q.coupon || "").trim().toUpperCase() && String(q.coupon || "").trim());
  let disc = 0; if (cp && it.sub >= (+cp.min || 0)) disc = Math.min(it.sub, cp.kind === "flat" ? +cp.value : Math.min((it.sub * +cp.value) / 100, +cp.max > 0 ? +cp.max : Infinity)); disc = Math.round(disc * 100) / 100;
  // Points spent are part of the order's discount, so Petpooja's bill comes to the same total.
  disc = Math.round((disc + (bill.pointsOff || 0)) * 100) / 100;
  const pack = mode === "dinein" ? 0 : Math.max(0, +o.packing || 0), pct = Math.max(0, +o.taxPercent || 0), tax = o.taxIncluded || !pct ? 0 : Math.round((it.sub - disc + pack) * pct) / 100;
  const tip = o.tips !== false && mode !== "pickup" ? Math.max(0, Math.min(5000, +q.tip || 0)) : 0, del = Math.max(0, Math.round((bill.total - (it.sub - disc + pack + tax + tip)) * 100) / 100);
  const paid = data._paid === "yes", key = b64u(await hmac(env.SECRET, "pos:" + site)).slice(0, 32);
  const body = { app_key: z.appKey, app_secret: z.secret, access_token: z.token, orderinfo: { OrderInfo: {
    Restaurant: { details: { res_name: siteName(c, site), address: oneLine(String(c?.contact?.address || "")).slice(0, 300), contact_information: String(c?.contact?.phone || "").slice(0, 40), restID: z.restId } },
    Customer: { details: { email: String(data.email || ""), name: String(data.name || "Guest").slice(0, 100), address: String(data.address || "").slice(0, 400), phone: String(data.phone || "").replace(/[^\d+]/g, "").slice(0, 16), latitude: "", longitude: "" } },
    Order: { details: { orderID: data.order_no, preorder_date: now.slice(0, 10), preorder_time: now.slice(11), service_charge: "0", sc_tax_amount: "0", delivery_charges: String(del), dc_tax_amount: "0", dc_gst_details: [], packing_charges: String(pack), pc_tax_amount: "0", pc_gst_details: [],
      order_type: mode === "delivery" ? "H" : mode === "pickup" ? "P" : "D", ondc_bap: "", advanced_order: "N", urgent_order: false, urgent_time: 20, payment_type: paid ? "ONLINE" : "COD", table_no: String(data.table || ""), no_of_persons: "0",
      discount_total: String(disc), tax_total: String(tax), discount_type: "F", total: String(bill.total), description: oneLine(String(data.notes || "")).slice(0, 300) + (tip ? ` (tip ${tip})` : ""), created_on: now, enable_delivery: 1, min_prep_time: Math.max(0, Math.round(+o.prepMinutes || 20)),
      callback_url: origin + "/hook/pos/" + site + "?k=" + key, collect_cash: paid ? "0" : String(bill.total), otp: "" } },
    OrderItem: { details: it.items },
    Tax: { details: tax ? [{ id: String(o.posTaxId || ""), title: "GST", type: "P", price: String(pct), tax: String(tax), restaurant_liable_amt: String(tax) }] : [] },
    Discount: { details: disc ? [{ id: "", title: cp ? String(cp.code) : "Discount", type: "F", price: String(disc) }] : [] } }, udid: "", device_type: "Web" } };
  try {
    const u = /^https:\/\/[\w.-]+\.petpooja\.com\//.test(String(z.url || "")) ? String(z.url) : POS_URL;
    const r = await fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), j: any = await r.json().catch(() => null);
    if (r.ok && j && String(j.success) === "1") return "Sent to Petpooja" + (j.orderID ? " (its order " + String(j.orderID).slice(0, 40) + ")" : "") + ".";
    return "Not sent to Petpooja: " + oneLine(String((j && (j.message || j.error)) || "it answered " + r.status)).slice(0, 200);
  } catch { return "Not sent to Petpooja: it couldn't be reached."; }
}
const POS_STATUS: Record<string, string> = { "-1": "cancelled", "1": "accepted", "2": "accepted", "3": "accepted", "4": "out", "5": "ready", "10": "done" };

/* ---- A shop's bill, by the same rules as the shop's own checkout (assets/store.js): prices come from the site's content. ---- */
/** What a dish is sold as, exactly as the site works it out (rest.js dishChoices): sizes, varieties, or every variety in every size. */
function rchoices(d: any): { label: string; price: number; posId: string }[] {
  const ok = (v: any) => v && String(v.label || "").trim() && !isNaN(rnum(v.price));
  const S = (d.variants || []).filter(ok), K = d.kindsOn ? (Array.isArray(d.kinds) ? d.kinds : []).filter(ok) : [];
  if (!K.length) return (d.variants || []).filter((v: any) => v && v.label && !isNaN(rnum(v.price))).map((v: any) => ({ label: String(v.label), price: rnum(v.price), posId: String(v.posId || "").trim() }));
  const s0 = S.length ? rnum(S[0].price) : 0, t = (v: any) => String(v.label).trim();
  return S.length ? K.flatMap((k: any) => S.map((v: any) => ({ label: t(k) + " · " + t(v), price: rnum(k.price) + rnum(v.price) - s0, posId: String(k.posId || v.posId || "").trim() })))
    : K.map((k: any) => ({ label: t(k), price: rnum(k.price), posId: String(k.posId || "").trim() }));
}
/** A product's price for the chosen variety (p.kindsOn, p.kinds; the variety is the first part of the line's option). NaN: no such variety. */
function kindPrice(p: any, opt: unknown): number {
  const K = p?.kindsOn ? (Array.isArray(p.kinds) ? p.kinds : []).filter((k: any) => k && String(k.label || "").trim() && isFinite(Number(k.price)) && Number(k.price) >= 0) : [];
  if (!K.length) return Number(p?.price);
  const first = String(opt ?? "").split(" · ")[0].trim(), k = K.find((x: any) => String(x.label).trim() === first);
  return k ? Number(k.price) : NaN;
}
export function shopBill(c: any, q: any): { total: number; points?: number; pointsOff?: number; net?: number } | { error: string } {
  const S = c?.settings || {}, P = new Map<string, any>((Array.isArray(c?.products) ? c.products : []).filter((p: any) => p && p.id).map((p: any) => [String(p.id), p]));
  const lines = Array.isArray(q?.items) ? q.items.slice(0, 100) : []; if (!lines.length) return { error: "The cart is empty." };
  const max = Math.max(1, Number(S.maxQty) || 10); let sub = 0;
  for (const l of lines) {
    const p = P.get(String(l?.id || "")), price = kindPrice(p, l?.opt);
    if (!p || p.stock === "out" || !isFinite(price) || price < 0) return { error: "Something in the cart is no longer sold. Refresh the page." };
    sub += price * Math.max(1, Math.min(max, Math.floor(+l.qty || 0)));
  }
  const H = c?.shipping || {}, num = (v: any) => (v === "" || v == null || isNaN(Number(v)) ? null : Math.max(0, Number(v)));
  const pin = String(q?.pin || "").replace(/\D/g, ""); let fee: number | null = null, freeOver: number | null = null;
  if (H.on && pin.length >= 4) {
    const hit = (list: any) => String(list || "").split(/[\s,;]+/).filter(Boolean).some((t) => { const r = /^(\d{4,6})-(\d{4,6})$/.exec(t); if (r) return pin.length === r[1].length && +pin >= +r[1] && +pin <= +r[2]; return /^\d{2,6}$/.test(t) && (t.length === pin.length ? t === pin : pin.startsWith(t)); });
    const z = (Array.isArray(H.zones) ? H.zones : []).find((x: any) => x && x.on !== false && hit(x.pins));
    if (z) { fee = num(z.fee); freeOver = num(z.freeOver); } else if (H.rest === "no") return { error: "We don't deliver to that PIN code." }; else fee = num(H.restFee);
  }
  const over = freeOver != null ? freeOver : Number(S.freeShippingOver), free = over > 0 && sub >= over;
  // points the buyer spends (q._bal: their balance, set by this database after their number is verified)
  const pt = pointsFor(c, q.points, +q._bal || 0, sub);
  const ship = free ? 0 : fee != null ? fee : Number(S.shippingFee) || 0, pct = Number(S.taxPercent) || 0, taxAdd = pct && !S.taxIncluded ? Math.round((sub - pt.off) * pct) / 100 : 0;
  return { total: Math.round((sub - pt.off + ship + taxAdd) * 100) / 100, points: pt.points, pointsOff: pt.off, net: Math.round((sub - pt.off) * 100) / 100 };
}

/* ---- Payment gateways a site's owner can connect with their own keys. The amount is always worked out here, the gateway is
   asked by this database whether the money arrived, and an order is saved as paid only then. ---- */
const PG: Record<string, { name: string; key: string; inr?: boolean }> = { rz: { name: "Razorpay", key: "razorpay", inr: true }, cf: { name: "Cashfree", key: "cashfree", inr: true }, pe: { name: "PhonePe", key: "phonepe", inr: true }, st: { name: "Stripe", key: "stripe" }, pp: { name: "PayPal", key: "paypal" } };
const PG_CUR = ["INR", "USD", "EUR", "GBP", "AUD", "CAD", "SGD", "AED", "NZD", "CHF"];
const pgReady = (g: string, z: any) => !!z && !!(g === "rz" ? z.on && z.secret && z.keyId : g === "cf" ? z.secret && z.appId : g === "pe" ? z.secret && z.clientId : g === "st" ? z.secret : g === "pp" ? z.secret && z.clientId : false);
const isRest = (c: any) => !!(c?.ordering && c?.food);
/** A site that asks customers to prove their email address at checkout (its own content says so), on a database that can send mail. */
const emailCheckOn = (env: Env, c: any) => !!(env.RESEND_API_KEY && env.MAIL_FROM) && !!(isRest(c) ? c?.ordering?.verifyEmail : c?.checkout?.verifyEmail);
const emailKey = (v: unknown) => { const e = String(v || "").trim().toLowerCase().slice(0, 120); return EMAIL_RE.test(e) ? e : ""; };
/** Whether the site's published content has this way to pay switched on. */
const pgOn = (c: any, g: string) => !!(isRest(c) ? c.ordering?.pay?.[PG[g].key] : c?.payments?.[PG[g].key]?.enabled);
function siteCur(c: any): string {
  if (isRest(c)) { const s = String(c.food.currency || "₹").trim(); return ({ "₹": "INR", Rs: "INR", "Rs.": "INR", $: "USD", "€": "EUR", "£": "GBP" } as Record<string, string>)[s] || (/^[A-Z]{3}$/.test(s) ? s : ""); }
  return String(c?.settings?.currency || "").toUpperCase();
}
const pgMoney = (cur: string, minor: number) => (cur === "INR" ? "₹" : cur + " ") + (minor / 100).toFixed(2).replace(/\.00$/, "");
class PgError extends Error { constructor(m: string, public keys = false) { super(m); } }
const pgFail = (g: string, r: Response) => new PgError(r.status === 401 || r.status === 403 ? `${PG[g].name} refused this site's keys. The owner needs to check them.` : `${PG[g].name} couldn't start the payment just now. Please try again, or choose another way to pay.`, r.status === 401 || r.status === 403);
const cfHost = (z: any) => (z.test ? "https://sandbox.cashfree.com" : "https://api.cashfree.com"), cfHead = (z: any) => ({ "x-client-id": z.appId, "x-client-secret": z.secret, "x-api-version": "2023-08-01", "Content-Type": "application/json", Accept: "application/json" });
const peHost = (z: any) => (z.test ? "https://api-preprod.phonepe.com/apis/pg-sandbox" : "https://api.phonepe.com/apis/pg");
async function peToken(z: any) {
  const r = await fetch(z.test ? "https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token" : "https://api.phonepe.com/apis/identity-manager/v1/oauth/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: z.clientId, client_version: String(z.version || "1"), client_secret: z.secret, grant_type: "client_credentials" }).toString() });
  const j: any = await r.json().catch(() => null); if (!r.ok || !j?.access_token) throw pgFail("pe", r.ok ? new Response(null, { status: 401 }) : r); return String(j.access_token);
}
const ppHost = (z: any) => (z.test ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com");
async function ppToken(z: any) {
  const r = await fetch(ppHost(z) + "/v1/oauth2/token", { method: "POST", headers: { Authorization: "Basic " + btoa(z.clientId + ":" + z.secret), "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" });
  const j: any = await r.json().catch(() => null); if (!r.ok || !j?.access_token) throw pgFail("pp", r.ok ? new Response(null, { status: 401 }) : r); return String(j.access_token);
}
type PgOrder = { no: string; id: string; amount: number; cur: string; back: string; name: string; cust: { name: string; email: string; phone: string } };
/** Starts a payment at the gateway. Gives back the reference this database keeps, and what the page needs to open the gateway. */
async function pgStart(g: string, z: any, o: PgOrder): Promise<{ ref: string; out: any }> {
  const ok = o.back + "&r=", email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.cust.email) ? o.cust.email : "";
  if (g === "rz") {
    const r = await fetch("https://api.razorpay.com/v1/orders", { method: "POST", headers: { Authorization: "Basic " + btoa(z.keyId + ":" + z.secret), "Content-Type": "application/json" }, body: JSON.stringify({ amount: o.amount, currency: o.cur, receipt: o.no, notes: { order_no: o.no } }) });
    const j: any = await r.json().catch(() => null); if (!r.ok || !j?.id) throw pgFail(g, r);
    return { ref: String(j.id), out: { key: z.keyId, order_id: j.id } };
  }
  if (g === "cf") {
    const phone = o.cust.phone.replace(/\D/g, "").slice(-10); if (phone.length < 10) throw new PgError("Cashfree needs a 10-digit mobile number. Add it and try again.");
    const r = await fetch(cfHost(z) + "/pg/orders", { method: "POST", headers: cfHead(z), body: JSON.stringify({ order_id: o.id, order_amount: +(o.amount / 100).toFixed(2), order_currency: o.cur, customer_details: { customer_id: "c" + phone, customer_phone: phone, ...(o.cust.name ? { customer_name: o.cust.name.slice(0, 100) } : {}), ...(email ? { customer_email: email } : {}) }, order_meta: { return_url: ok + "cf:" + o.id }, order_note: "Order " + o.no }) });
    const j: any = await r.json().catch(() => null); if (!r.ok || !j?.payment_session_id) throw pgFail(g, r);
    return { ref: "cf:" + o.id, out: { session: String(j.payment_session_id), mode: z.test ? "sandbox" : "production" } };
  }
  if (g === "pe") {
    const t = await peToken(z);
    const r = await fetch(peHost(z) + "/checkout/v2/pay", { method: "POST", headers: { Authorization: "O-Bearer " + t, "Content-Type": "application/json" }, body: JSON.stringify({ merchantOrderId: o.id, amount: o.amount, paymentFlow: { type: "PG_CHECKOUT", message: "Order " + o.no, merchantUrls: { redirectUrl: ok + "pe:" + o.id } } }) });
    const j: any = await r.json().catch(() => null); if (!r.ok || !/^https:\/\//.test(String(j?.redirectUrl || ""))) throw pgFail(g, r);
    return { ref: "pe:" + o.id, out: { go: String(j.redirectUrl) } };
  }
  if (g === "st") {
    const f = new URLSearchParams({ mode: "payment", success_url: o.back, cancel_url: o.back + "&x=1", client_reference_id: o.no, "line_items[0][quantity]": "1", "line_items[0][price_data][currency]": o.cur.toLowerCase(), "line_items[0][price_data][unit_amount]": String(o.amount), "line_items[0][price_data][product_data][name]": `Order ${o.no}, ${o.name}`.slice(0, 200), ...(email ? { customer_email: email } : {}) });
    const r = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { Authorization: "Bearer " + z.secret, "Content-Type": "application/x-www-form-urlencoded" }, body: f.toString() });
    const j: any = await r.json().catch(() => null); if (!r.ok || !j?.id || !/^https:\/\//.test(String(j.url || ""))) throw pgFail(g, r);
    return { ref: "st:" + j.id, out: { go: String(j.url) } };
  }
  if (g === "pp") {
    const t = await ppToken(z);
    const r = await fetch(ppHost(z) + "/v2/checkout/orders", { method: "POST", headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" }, body: JSON.stringify({ intent: "CAPTURE", purchase_units: [{ reference_id: o.no, description: ("Order " + o.no).slice(0, 120), amount: { currency_code: o.cur, value: (o.amount / 100).toFixed(2) } }], payment_source: { paypal: { experience_context: { brand_name: o.name.slice(0, 120), user_action: "PAY_NOW", shipping_preference: "NO_SHIPPING", return_url: o.back, cancel_url: o.back + "&x=1" } } } }) });
    const j: any = await r.json().catch(() => null), go = String((j?.links || []).find((l: any) => l && (l.rel === "payer-action" || l.rel === "approve"))?.href || "");
    if (!r.ok || !j?.id || !/^https:\/\//.test(go)) throw pgFail(g, r);
    return { ref: "pp:" + j.id, out: { go } };
  }
  throw new PgError("Unknown way to pay.");
}
/** Asks the gateway itself whether a payment this database started was paid, in full. */
async function pgCheck(g: string, z: any, id: string, amount: number, cur: string): Promise<{ paid: boolean; id: string }> {
  const near = (v: unknown) => Math.abs(Math.round(Number(v)) - amount) <= 1;
  if (g === "cf") {
    const r = await fetch(cfHost(z) + "/pg/orders/" + encodeURIComponent(id), { headers: cfHead(z) }), j: any = await r.json().catch(() => null); if (!r.ok || !j) throw new Error("cf " + r.status);
    return { paid: j.order_status === "PAID" && near(Number(j.order_amount) * 100) && String(j.order_currency || cur) === cur, id: String(j.cf_order_id || id) };
  }
  if (g === "pe") {
    const r = await fetch(peHost(z) + "/checkout/v2/order/" + encodeURIComponent(id) + "/status", { headers: { Authorization: "O-Bearer " + (await peToken(z)), "Content-Type": "application/json" } }), j: any = await r.json().catch(() => null); if (!r.ok || !j) throw new Error("pe " + r.status);
    return { paid: j.state === "COMPLETED" && near(j.amount), id: String(j.orderId || id) };
  }
  if (g === "st") {
    const r = await fetch("https://api.stripe.com/v1/checkout/sessions/" + encodeURIComponent(id), { headers: { Authorization: "Bearer " + z.secret } }), j: any = await r.json().catch(() => null); if (!r.ok || !j) throw new Error("st " + r.status);
    return { paid: j.payment_status === "paid" && near(j.amount_total) && String(j.currency || "").toUpperCase() === cur, id: String(j.payment_intent || id) };
  }
  if (g === "pp") {
    const t = await ppToken(z), h = { Authorization: "Bearer " + t, "Content-Type": "application/json" };
    let r = await fetch(ppHost(z) + "/v2/checkout/orders/" + encodeURIComponent(id) + "/capture", { method: "POST", headers: h, body: "{}" }), j: any = await r.json().catch(() => null);
    // Already captured (the page was opened twice), or not approved by the payer: the order itself says which.
    if (!r.ok) { r = await fetch(ppHost(z) + "/v2/checkout/orders/" + encodeURIComponent(id), { headers: h }); j = await r.json().catch(() => null); if (!r.ok || !j) throw new Error("pp " + r.status); }
    const cap = j?.purchase_units?.[0]?.payments?.captures?.[0];
    return { paid: j.status === "COMPLETED" && !!cap && cap.status === "COMPLETED" && near(Number(cap.amount?.value) * 100) && String(cap.amount?.currency_code) === cur, id: String(cap?.id || id) };
  }
  return { paid: false, id };
}

/* ---- Event registrations (the Events template). What a registration costs is worked out here from the site's own
   tickets, never taken from the page; a paid one is saved as paid only once the gateway says so. ---- */
const isEvt = (c: any) => !!(c?.register && typeof c.register === "object" && c?.event && typeof c.event === "object");
/** How each kind of registration is priced (the same table as REG in the template's assets/evt.js). */
const EVT_REG: Record<string, { label: string; tix?: boolean; qty?: boolean; amount?: boolean }> = {
  tickets: { label: "Tickets", tix: true, qty: true }, delegate: { label: "Delegate registration", tix: true, qty: true }, rsvp: { label: "RSVP" }, team: { label: "Team registration", tix: true },
  stall: { label: "Stall booking", tix: true, qty: true }, entry: { label: "Participant entry", tix: true }, seat: { label: "Seat reservation", tix: true, qty: true }, enrol: { label: "Enrolment", tix: true },
  donate: { label: "Donation", amount: true }, volunteer: { label: "Volunteer sign-up" }, media: { label: "Press accreditation" },
};
const evtKind = (c: any) => { const k = String(c?.register?.kind || ""); return EVT_REG[k] ? k : EVT_REG[String(c?.theme?.regKind || "")] ? String(c.theme.regKind) : "tickets"; };
/** Open until the end of its closing day (with half a day's grace, as the site may be anywhere in the world). */
const evtOpen = (c: any) => { const R = c?.register || {}; if (R.enabled === false) return false; const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(R.closes || "")); return !(m && Date.now() > Date.UTC(+m[1], +m[2] - 1, +m[3]) + 36 * 3600_000); };
const evtTickets = (c: any): any[] => (Array.isArray(c?.register?.tickets) ? c.register.tickets : []).filter((t: any) => t && String(t.name || "").trim());
type EvtBill = { total: number; count: number; kind: string; lines: { name: string; qty: number; price: number }[] };
/** What a registration comes to. `q.lines` is [{ i: the ticket's place in the list, qty }], or `q.amount` for a donation. */
export function evtBill(c: any, q: any): EvtBill | { error: string } {
  if (!isEvt(c)) return { error: "This site doesn't take registrations." };
  if (!evtOpen(c)) return { error: oneLine(String(c.register.closedText || "Registration is closed.")).slice(0, 200) };
  const kind = evtKind(c), K = EVT_REG[kind], T = evtTickets(c), max = Math.max(1, Math.min(50, Math.floor(+c.register.maxPer || 10)));
  if (K.amount) { const a = Math.round((+q?.amount || 0) * 100) / 100; if (!(a >= 1) || a > 10_000_000) return { error: "Enter an amount." }; return { total: a, count: 1, kind, lines: [{ name: K.label, qty: 1, price: a }] }; }
  const lines: EvtBill["lines"] = []; let total = 0, count = 0;
  if (K.tix && T.length) {
    const seen = new Set<number>();
    for (const l of Array.isArray(q?.lines) ? q.lines.slice(0, 20) : []) {
      const i = Math.floor(+l?.i), t = T[i], qty = Math.floor(+l?.qty || 0); if (!t || seen.has(i) || qty < 1) continue; seen.add(i);
      const nm = oneLine(String(t.name)).slice(0, 80);
      if (t.soldOut) return { error: `${nm} is sold out.` };
      if (qty > (K.qty ? max : 1)) return { error: `You can book up to ${K.qty ? max : 1} of ${nm}.` };
      const price = Math.max(0, +t.price || 0); lines.push({ name: nm, qty, price }); total += price * qty; count += qty;
    }
    if (!lines.length || (!K.qty && lines.length > 1)) return { error: "Choose an option first." };
  }
  return { total: Math.round(total * 100) / 100, count: count || 1, kind, lines };
}
/** How many of each ticket are taken so far (cancelled registrations give theirs back). */
async function evtSold(env: Env, site: string): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const rows = ((await env.DB.prepare("select data from enquiries where site = ? and status != 'cancelled' and instr(data, '\"_lines\"') > 0 order by id desc limit 5000").bind(site).all()).results || []) as any[];
  for (const r of rows) { try { for (const l of JSON.parse(JSON.parse(r.data)._lines || "[]")) if (l && l.name) out[String(l.name)] = (out[String(l.name)] || 0) + Math.max(0, Math.floor(+l.qty || 0)); } catch { /* an entry that can't be read is skipped */ } }
  return out;
}
/** The tickets with a limit, and how many of each are left. */
async function evtLeft(env: Env, site: string, c: any): Promise<Record<string, number>> {
  const lim = evtTickets(c).filter((t) => Math.floor(+t.limit || 0) > 0); if (!lim.length) return {};
  const sold = await evtSold(env, site), out: Record<string, number> = {};
  for (const t of lim) { const nm = oneLine(String(t.name)).slice(0, 80); out[nm] = Math.max(0, Math.floor(+t.limit) - (sold[nm] || 0)); }
  return out;
}
/** A sentence when a registration asks for more places than are left, or "". */
async function evtFull(env: Env, site: string, c: any, bill: EvtBill): Promise<string> {
  const left = await evtLeft(env, site, c);
  for (const l of bill.lines) if (l.name in left && l.qty > left[l.name]) return left[l.name] > 0 ? `Only ${left[l.name]} left of ${l.name}. Choose fewer and try again.` : `${l.name} is sold out.`;
  return "";
}
const evtWhen = (c: any) => { const E = c?.event || {}; return oneLine(String(E.dateText || [E.date, E.time].filter(Boolean).join(", "))); };
/** The registrant's own copy: their number, what they chose and whether it is paid. */
async function regMail(env: Env, site: string, c: any, d: Record<string, string>): Promise<string> {
  env = await siteMail(env, site);
  if (!env.RESEND_API_KEY || !env.MAIL_FROM || !EMAIL_RE.test(d.email || "")) return "";
  const name = siteName(c, site), where = oneLine([c?.event?.venue, c?.event?.city].filter(Boolean).join(", "));
  const lines = [`Registration number: ${d.reg_no}`, evtWhen(c) && `When: ${evtWhen(c)}`, where && `Where: ${where}`, d.tickets && `You chose: ${d.tickets}`, d.total && `Total: ${d.total}${d._paid === "yes" ? " (paid)" : d.payment ? ` (${d.payment})` : ""}`].filter(Boolean).join("\n");
  try { await sendMail(env, d.email, `Your registration for ${name}: ${d.reg_no}`.slice(0, 150), WRAP(`<h2 style="margin:0 0 12px;font-size:20px">You're registered for ${hesc(name)}</h2>${paras(`Hello ${oneLine(d.name || "")},\n\n${oneLine(String(c?.register?.success || "Your registration is received."))}`)}${paras(lines)}${paras("Keep this email: the registration number is your reference.", "margin:0;color:#555;font-size:13px")}`), EMAIL_RE.test(String(c?.contact?.email || "")) ? String(c.contact.email) : undefined); return "Confirmation emailed."; }
  catch (e: any) { return "Confirmation not emailed: " + String(e?.message || e).slice(0, 200); }
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


/* ============================================================
   Design yourself: a visitor answers a few questions on the Studio's own page, gets a preview, and sends the request.
   The request is kept in this database (design_queries) and emailed to the Studio's owners. The Studio's own look
   (GET /sb/<studio>) and its chosen AI engine are read from the Studio's own files here: nothing leaves this database
   except the email and, when the owner chose Cloudflare AI or their own AI API, the text-writing call.
   ============================================================ */
const DQ_KINDS = ["portfolio", "store", "business", "restaurant", "events"];
const DQ_LABEL: Record<string, string> = { portfolio: "Personal website", store: "Online shop", business: "Business website", restaurant: "Restaurant or café", events: "Event website" };
const studioId = (x: string) => (/^[a-z0-9][a-z0-9-]{0,59}$/.test(x) ? x : "");
async function studioIndex(env: Env, id: string): Promise<any | null> {
  const f = await readFile(env, "studio:" + id, "studio.json"); if (!f) return null;
  try { return JSON.parse(new TextDecoder().decode(f.bytes)); } catch { return null; }
}
/** At most `max` calls per `secs` for a key; false when over. */
async function dqRate(env: Env, key: string, max: number, secs: number): Promise<boolean> {
  await ensure(env); const now = Date.now();
  const r: any = await env.DB.prepare("select n, exp from dq_rate where k = ?").bind(key).first();
  if (!r || r.exp < now) { await env.DB.prepare("insert or replace into dq_rate (k, n, exp) values (?, 1, ?)").bind(key, now + secs * 1000).run(); return true; }
  if (r.n >= max) return false;
  await env.DB.prepare("update dq_rate set n = n + 1 where k = ?").bind(key).run(); return true;
}
const clip = (x: unknown, n: number) => String(x ?? "").replace(/\u0000/g, "").trim().slice(0, n);
function dqStrings(o: any, keys: number, len: number): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(o && typeof o === "object" ? o : {}).slice(0, keys)) if (/^[a-z]{1,20}$/.test(k) && typeof v === "string") out[k] = v.slice(0, len);
  return out;
}
function dqCopy(c: any) {
  const out: any = {}; if (!c || typeof c !== "object") return out;
  for (const k of ["tagline", "hero_text", "about_text", "services_text", "work_text", "cta_text"]) if (typeof c[k] === "string" && c[k].trim()) out[k] = c[k].trim().slice(0, 900);
  if (Array.isArray(c.items)) out.items = c.items.slice(0, 12).filter((i: any) => i && typeof i.name === "string").map((i: any) => ({ name: clip(i.name, 120), text: clip(i.text, 260) }));
  if (Array.isArray(c.faq)) out.faq = c.faq.slice(0, 6).filter((i: any) => i && typeof i.q === "string" && typeof i.a === "string").map((i: any) => ({ q: clip(i.q, 160), a: clip(i.a, 420) }));
  return out;
}
const b64Of = (bytes: Uint8Array) => { let s = ""; for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192)); return btoa(s); };

/** The owner's Design yourself choices that a visitor's page needs: on or off, colour palettes and layout choices (checked again by the page). */
function dqDesignPub(d: any) {
  const out: any = { on: d?.on !== false }; if (!d || typeof d !== "object") return out;
  const HEX = /^#[0-9a-f]{6}$/i, KEY = /^[A-Za-z]{1,20}$/;
  if (typeof d.pick === "boolean") out.pick = d.pick;
  if (typeof d.domain === "string" && /^(?=.{4,100}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(d.domain.trim().toLowerCase())) out.domain = d.domain.trim().toLowerCase();
  if (d.gallery && typeof d.gallery === "object") {
    const g = d.gallery, o: any = {}, tx = (v: any, n: number) => (typeof v === "string" ? v.replace(/[<>]/g, "").trim().slice(0, n) : "");
    if (typeof g.domain === "string" && /^(?=.{4,100}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(g.domain.trim().toLowerCase())) o.domain = g.domain.trim().toLowerCase();
    if (tx(g.link, 24)) o.link = tx(g.link, 24);
    if (g.count === "total" || g.count === "off") o.count = g.count;
    if (Array.isArray(g.types)) { const l = ["business", "restaurant", "portfolio", "store", "events"].filter((k) => g.types.includes(k)); if (l.length && l.length < 4) o.types = l; }
    if (g.tags === false) o.tags = false;
    if (tx(g.title, 80)) o.title = tx(g.title, 80);
    if (tx(g.intro, 400)) o.intro = tx(g.intro, 400);
    if (Object.keys(o).length) out.gallery = o;
  }
  if (d.themes && typeof d.themes === "object") { const th: any = {}; for (const kind of ["business", "restaurant", "portfolio", "store", "events"]) if (Array.isArray(d.themes[kind])) th[kind] = d.themes[kind].filter((v: any) => typeof v === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(v)).slice(0, 400); out.themes = th; }
  if (d.images && typeof d.images === "object") { const im: any = {}; if (d.images.on === true) im.on = true; if (["photo", "illustration", "3d", "flat"].includes(d.images.style)) im.style = d.images.style; if (d.images.source === "engine" || d.images.source === "unsplash") im.source = d.images.source; if (Object.keys(im).length) out.images = im; }
  // The owner's details sheets per type: their names and the help line (the files themselves are fetched from /sd/…).
  if (d.refs && typeof d.refs === "object") {
    const o: any = {};
    for (const k of ["business", "restaurant", "portfolio", "store", "events"]) {
      const r = d.refs[k]; if (!r || typeof r !== "object") continue; const c: any = {};
      for (const e of ["txt", "xlsx", "docx"]) if (typeof r[e] === "string" && r[e].trim()) c[e] = r[e].replace(/[<>"\\/]/g, "").trim().slice(0, 100);
      if (typeof r.note === "string" && r.note.trim()) c.note = r.note.replace(/[<>]/g, "").trim().slice(0, 300);
      if (Number.isFinite(+r.v) && +r.v > 0) c.v = Math.round(+r.v);
      if (Object.keys(c).length) o[k] = c;
    }
    if (Object.keys(o).length) out.refs = o;
  }
  if (d.notice && typeof d.notice === "object") { const n: any = {}; if (d.notice.on === false) n.on = false; const t = typeof d.notice.text === "string" ? d.notice.text.replace(/[<>]/g, "").trim().slice(0, 400) : ""; if (t) n.text = t; if (Object.keys(n).length) out.notice = n; }
  if (d.chat && typeof d.chat === "object") {
    const c: any = {}, hex = (v: any) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : "");
    for (const k of ["you", "bot", "page"]) if (hex(d.chat[k])) c[k] = hex(d.chat[k]);
    const im = d.chat.image; if (typeof im === "string" && im.length <= 100000 && /^(data:image\/(jpeg|webp|png);base64,[A-Za-z0-9+/=]+|https:\/\/[^\s<>"']{3,400})$/.test(im)) c.image = im;
    if (Number.isFinite(+d.chat.dim) && +d.chat.dim > 0) c.dim = Math.min(80, Math.round(+d.chat.dim));
    if (Object.keys(c).length) out.chat = c;
  }
  if (d.carousel && typeof d.carousel === "object") { const c: any = {}; for (const kind of ["business", "restaurant", "portfolio", "store", "events"]) if (d.carousel[kind] === "custom") c[kind] = "custom"; if (Object.keys(c).length) out.carousel = c; }
  // the page's own look, wording, question order and background: cleaned by the same code the Studio saves them with
  Object.assign(out, cleanDiyLook(d));
  if (d.questions && typeof d.questions === "object") {
    const q: any = {}, tx = (v: any, n: number) => (typeof v === "string" ? v.replace(/[<>]/g, "").trim().slice(0, n) : "");
    for (const g of ["basics", "business", "restaurant", "portfolio", "store", "events"]) {
      const src = d.questions[g]; if (!src || typeof src !== "object") continue;
      const rules: any = {};
      for (const id of Object.keys(src).slice(0, 80)) { if (!/^[a-z]{1,20}$/.test(id)) continue; const r = src[id] || {}, o: any = {}; if (r.h === true) o.h = true; if (tx(r.t, 300)) o.t = tx(r.t, 300); if (tx(r.p, 300)) o.p = tx(r.p, 300); if (Object.keys(o).length) rules[id] = o; }
      if (Object.keys(rules).length) q[g] = rules;
    }
    if (Object.keys(q).length) out.questions = q;
  }
  if (d.look && typeof d.look === "object") {
    const look: any = {};
    for (const kind of ["business", "restaurant", "portfolio", "store", "events"]) {
      const src = d.look[kind]; if (!src || typeof src !== "object") continue;
      const rules: any = {};
      for (const key of Object.keys(src).slice(0, 30)) {
        const r = src[key]; if (!KEY.test(key) || !r || typeof r !== "object") continue;
        const o: any = {}; if (typeof r.d === "string") o.d = clip(r.d, 30); if (Array.isArray(r.a)) o.a = r.a.filter((v: any) => typeof v === "string").slice(0, 60).map((v: string) => clip(v, 30)); if (r.h === true) o.h = true;
        rules[key] = o;
      }
      look[kind] = rules;
    }
    out.look = look;
  }
  // Pictures (the page's logo and backgrounds) make this large. If it is too large to send with every visit, the pictures are
  // left out one by one, largest kind first, and everything else is still sent: never nothing.
  const size = () => JSON.stringify(out).length, MAX = 600_000;
  for (const drop of [() => { if (out.bg?.slides) delete out.bg.slides; }, () => { if (out.bg?.image) delete out.bg.image; }, () => { if (out.chat?.image) delete out.chat.image; }, () => { if (out.ui?.logo) delete out.ui.logo; }]) { if (size() <= MAX) break; drop(); }
  return size() > MAX ? { on: out.on } : out;
}

/** The Studio's name, logo and colours, for its sign-in and public pages (no secrets, nothing about the owner). */
async function dqBrand(env: Env, id: string) {
  const idx = await studioIndex(env, id); const b = idx?.brand;
  if (!b || typeof b.name !== "string") return null;
  let logo = "";
  if (typeof b.logo === "string" && pathOk(b.logo)) { const f = await readFile(env, "studio:" + id, b.logo); if (f && f.bytes.length <= 150_000) logo = `data:${f.type || "image/png"};base64,${b64Of(f.bytes)}`; }
  return { name: clip(b.name, 80), logo, v: +b.v || 0, tint: /^#[0-9a-f]{6}$/i.test(b.tint || "") ? b.tint : "", mode: b.mode === "light" ? "light" : "dark", anim: clip(b.anim, 20), layout: clip(b.layout, 20), design: dqDesignPub(idx?.prefs?.design) };
}

/** Design yourself: a code to confirm the visitor's email (sent from this database), and the pass that code earns. */
async function dqOtp(env: Env, id: string, req: Request, send: boolean): Promise<Response> {
  await ensure(env);
  if (!(await env.DB.prepare("select 1 from members where scope = ? limit 1").bind("studio:" + id).first())) return err(404, "Not found.");
  let b: any; try { b = JSON.parse((await req.text()).slice(0, 2000) || "{}"); } catch { return err(400, "Couldn't read the request."); }
  const em = emailKey(b.email); if (!em) return err(400, "Enter a valid email address.");
  const k = "dq:" + id + ":" + em, now = Date.now();
  if (send) {
    const ip = req.headers.get("cf-connecting-ip") || "x";
    if (!(await dqRate(env, "dqotp:" + id, 60, 3600)) || !(await dqRate(env, "dqotpip:" + ip, 8, 3600))) return err(429, "Too many codes were asked for. Please try again later.");
    const prev: any = await env.DB.prepare("select sent from otps where k = ?").bind(k).first();
    if (prev && now - prev.sent < 45_000) return err(429, "A code was just sent. Wait a minute before asking for another.");
    const code = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
    await env.DB.prepare("insert into otps (k, hash, expires, tries, sent) values (?, ?, ?, 0, ?) on conflict (k) do update set hash = excluded.hash, expires = excluded.expires, tries = 0, sent = excluded.sent").bind(k, b64u(await hmac(env.SECRET, k + ":" + code)), now + 10 * 60_000, now).run();
    const name = oneLine(String((await studioIndex(env, id))?.brand?.name || "")).slice(0, 60) || "Picaffectz";
    try { await sendMail(env, em, `${code} is your code for ${name}`, `<p>Your code to confirm this email address for ${hesc(name)}:</p><p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p><p>It works for 10 minutes. If you didn't ask for it, ignore this email.</p>`); }
    catch { const exp = now + 8 * 3600_000; return json({ ok: false, skip: exp + "." + b64u(await hmac(env.SECRET, "dqskip:" + id + ":" + em + ":" + exp)) }); }
    return json({ ok: true });
  }
  const c: any = await env.DB.prepare("select hash, expires, tries from otps where k = ?").bind(k).first();
  if (!c || c.expires < now) return err(403, "The code has expired. Ask for a new one.");
  if (c.tries >= 5) return err(429, "Too many tries. Ask for a new code.");
  if (c.hash !== b64u(await hmac(env.SECRET, k + ":" + String(b.code || "").trim()))) { await env.DB.prepare("update otps set tries = tries + 1 where k = ?").bind(k).run(); return err(403, "That code isn't right."); }
  await env.DB.prepare("update otps set expires = 0 where k = ?").bind(k).run();
  const exp = now + 8 * 3600_000;
  return json({ ok: true, token: exp + "." + b64u(await hmac(env.SECRET, "dqotp:" + id + ":" + em + ":" + exp)) });
}
/** Does this pass (earned by confirming the email with its code, or given instead when mail can't be sent) belong to this email? */
async function dqPass(env: Env, id: string, email: string, otp: any, skip: any): Promise<"otp" | "skip" | ""> {
  const em = emailKey(email), [oexp, osig] = String(otp || "").split("."), [sexp, ssig] = String(skip || "").split(".");
  if (!em) return "";
  if (+oexp > Date.now() && osig === b64u(await hmac(env.SECRET, "dqotp:" + id + ":" + em + ":" + oexp))) return "otp";
  if (+sexp > Date.now() && ssig === b64u(await hmac(env.SECRET, "dqskip:" + id + ":" + em + ":" + sexp))) return "skip";
  return "";
}
/** Design yourself: the progress of someone whose email is confirmed is kept here as they answer (Projects → Design previews), until they send it (then it is a DIY submission). */
async function dqDraft(env: Env, id: string, req: Request): Promise<Response> {
  await ensure(env);
  const raw = await req.text(); if (raw.length > 400_000) return err(413, "That is too big.");
  let q: any; try { q = JSON.parse(raw || "{}"); } catch { return err(400, "Couldn't read the request."); }
  if (!(await env.DB.prepare("select 1 from members where scope = ? limit 1").bind("studio:" + id).first())) return err(404, "Not found.");
  const ip = req.headers.get("cf-connecting-ip") || "x";
  if (!(await dqRate(env, "dqdr:" + id, 1500, 3600)) || !(await dqRate(env, "dqdrip:" + ip, 300, 3600))) return err(429, "Too many requests just now.");
  const email = clip(q.email, 120); if (!EMAIL_RE.test(email)) return err(400, "Confirm your email first.");
  if (!(await dqPass(env, id, email, q.otp, q.skip))) return err(403, "Please confirm your email address with the code we send you.");
  const did = String(q.id || "").replace(/[^a-z0-9_-]/gi, "").slice(0, 40); if (!did) return err(400, "Which design?");
  const answers = dqStrings(q.answers, 110, 3000), copy = dqCopy(q.copy);
  if (typeof q.answers?.doctext === "string" && q.answers.doctext.trim()) answers.doctext = q.answers.doctext.slice(0, 12000);
  if (typeof q.answers?.docsec === "string" && q.answers.docsec.length <= 9000) { try { if (JSON.parse(q.answers.docsec)) answers.docsec = q.answers.docsec; } catch { /* not kept */ } }
  if (answers.doclink && !/^https?:\/\//i.test(answers.doclink)) delete answers.doclink;
  const logo = typeof q.logo === "string" && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(q.logo) && q.logo.length <= 60_000 ? q.logo : "";
  const kind = DQ_KINDS.includes(q.kind) ? q.kind : "", now = new Date().toISOString();
  // (a design already sent is not brought back as a preview)
  if (await env.DB.prepare("select 1 from design_queries where studio = ? and json_extract(answers, '$.draftid') = ? limit 1").bind(id, did).first()) return json({ ok: true, sent: true });
  await env.DB.prepare("insert into design_drafts (studio, id, email, name, kind, theme_id, theme_name, summary, answers, copy, logo, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) on conflict (studio, id) do update set email = excluded.email, name = excluded.name, kind = excluded.kind, theme_id = excluded.theme_id, theme_name = excluded.theme_name, summary = excluded.summary, answers = excluded.answers, copy = excluded.copy, logo = excluded.logo, updated_at = excluded.updated_at where design_drafts.email = excluded.email")
    .bind(id, did, email, clip(q.name, 120), kind, clip(q.themeId, 60), clip(q.themeName, 80), clip(q.summary, 300), JSON.stringify(answers), JSON.stringify(copy), logo, now, now).run();
  await env.DB.prepare("delete from design_drafts where studio = ? and updated_at < ?").bind(id, new Date(Date.now() - 90 * 86400_000).toISOString()).run().catch(() => {});
  return json({ ok: true });
}
async function dqSubmit(env: Env, id: string, req: Request, ctx?: { waitUntil(p: Promise<unknown>): void }): Promise<Response> {
  await ensure(env);
  const raw = await req.text(); if (raw.length > 3_200_000) return err(413, "That is too big. Use smaller pictures or a smaller PDF.");
  let q: any; try { q = JSON.parse(raw || "{}"); } catch { return err(400, "Couldn't read the request."); }
  if (q.website) return json({ ok: true });
  if (!(await env.DB.prepare("select 1 from members where scope = ? limit 1").bind("studio:" + id).first())) return err(404, "Not found.");
  const ip = req.headers.get("cf-connecting-ip") || "x";
  if (!(await dqRate(env, "dq:" + id, 30, 3600)) || !(await dqRate(env, "dqip:" + ip, 6, 3600))) return err(429, "Too many requests just now. Please try again in a little while.");
  const kind = DQ_KINDS.includes(q.kind) ? q.kind : "", person = clip(q.person, 80), phone = clip(q.phone, 30), email = clip(q.email, 120), note = clip(q.note, 1000), name = clip(q.name, 120);
  if (!kind || !name) return err(400, "Something is missing from the design. Please start again.");
  if (!person) return err(400, "Please tell us your name.");
  if (!EMAIL_RE.test(email)) return err(400, email ? "That email address doesn't look right." : "Please give your email address.");
  // The email must be confirmed with the code sent to it (or, when this database can't send mail at all, with the pass it gave instead).
  const em = emailKey(email), [oexp, osig] = String(q.otp || "").split("."), [sexp, ssig] = String(q.skip || "").split(".");
  const okOtp = !!em && +oexp > Date.now() && osig === b64u(await hmac(env.SECRET, "dqotp:" + id + ":" + em + ":" + oexp));
  const okSkip = !okOtp && !!em && +sexp > Date.now() && ssig === b64u(await hmac(env.SECRET, "dqskip:" + id + ":" + em + ":" + sexp));
  if (!okOtp && !okSkip) return err(403, "Please confirm your email address with the code we send you.");
  const answers = dqStrings(q.answers, 110, 3000), copy = dqCopy(q.copy);
  const draftId = String(q.draft || "").replace(/[^a-z0-9_-]/gi, "").slice(0, 40); if (draftId) answers.draftid = draftId;
  // The text read from the person's own document (kept longer than an ordinary answer) and the link they gave.
  answers.emailverified = okOtp ? "yes" : "no";
  if (typeof q.answers?.doctext === "string" && q.answers.doctext.trim()) answers.doctext = q.answers.doctext.slice(0, 12000);
  if (typeof q.answers?.docsec === "string" && q.answers.docsec.length <= 9000) { try { if (JSON.parse(q.answers.docsec)) answers.docsec = q.answers.docsec; } catch { /* not kept */ } }
  if (answers.doclink && !/^https?:\/\//i.test(answers.doclink)) delete answers.doclink;
  let logo = ""; if (typeof q.logo === "string" && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(q.logo) && q.logo.length <= 160_000) logo = q.logo;
  let pdf = "", pdfName = "";
  if (q.pdf && typeof q.pdf.b64 === "string") { if (!/^JVBER/.test(q.pdf.b64) || q.pdf.b64.length > 1_700_000 || !/^[A-Za-z0-9+/=]+$/.test(q.pdf.b64)) return err(400, "The menu must be a PDF under 1.2 MB."); pdf = q.pdf.b64; pdfName = clip(q.pdf.name, 100) || "menu.pdf"; }
  const made: any = await env.DB.prepare("insert into design_queries (studio, name, kind, person, phone, email, note, answers, copy, logo, pdf_name, pdf, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) returning id")
    .bind(id, name, kind, person, phone, email, note, JSON.stringify(answers), JSON.stringify(copy), logo, pdfName, pdf, new Date().toISOString()).first();
  // The pictures they chose (profile photo, banners, restaurant photos): each already made small on their device.
  if (made?.id && q.pics && typeof q.pics === "object") {
    const rows: [string, number, string][] = []; let total = 0;
    for (const slot of ["photo", "banner", "bimage", "photos"]) for (const [i, d] of (Array.isArray(q.pics[slot]) ? q.pics[slot] : []).slice(0, 4).entries()) {
      if (typeof d === "string" && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(d) && d.length <= 190_000 && total + d.length <= 700_000) { total += d.length; rows.push([slot, i, d]); }
    }
    if (rows.length) await env.DB.batch(rows.map(([slot, i, d]) => env.DB.prepare("insert or replace into design_pics (studio, ref, slot, idx, data) values (?, ?, ?, ?, ?)").bind(id, made.id, slot, i, d))).catch(() => {});
  }
  if (draftId) await env.DB.prepare("delete from design_drafts where studio = ? and id = ?").bind(id, draftId).run().catch(() => {});
  // The request is kept either way; the email is a copy, so a mail problem never fails it.
  const mail = (async () => {
    let said = "";
    try {
      const owners = ((await env.DB.prepare("select email from members where scope = ? and role in ('owner', 'partner') order by role = 'owner' desc limit 3").bind("studio:" + id).all()).results || []).map((r: any) => r.email as string);
      if (!owners.length) said = "Not emailed: no owner address.";
      else if (!env.RESEND_API_KEY || !env.MAIL_FROM) said = "Not emailed: email (Resend) isn't set up on this database.";
      else {
        const rows: [string, string][] = [["Name", person], ["Phone", phone], ["Email", email], ["Type", DQ_LABEL[kind]], ["Website name", name], ["What they do", answers.about || ""], ["City", answers.city || ""], ["Pages", answers.pages || ""], ["Feel", answers.style || ""], ["Colour", answers.colour || ""], ["Items", (answers.items || "").replace(/\n/g, ", ")], ["Visitors can", answers.goal || ""], ["Hours", answers.hours || ""], ["Address", answers.address || ""], ["Their document", answers.doc || ""], ["Document link", answers.doclink || ""], ["Chosen look", [answers.theme, answers.accent, answers.mode].filter(Boolean).join(" · ")], ["Note", note]];
        const table = `<table style="border-collapse:collapse;margin:0 0 14px">${rows.filter(([, v]) => v).map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#666;vertical-align:top">${hesc(k)}</td><td style="padding:4px 0">${hesc(v).replace(/\n/g, "<br>")}</td></tr>`).join("")}</table>`;
        await sendMail(env, owners, `New website request: ${name} (${DQ_LABEL[kind]})`.slice(0, 150), WRAP(`<p style="margin:0 0 12px"><b>${hesc(person)}</b> designed a website on your Design yourself page and wants to take it forward.</p>${table}<p style="margin:0;color:#666">Open Projects → Design yourself Query in your Studio to see the preview.${pdf ? " A menu PDF is attached to the request there." : ""}</p>`), EMAIL_RE.test(email) ? email : undefined);
      }
    } catch (e: any) { said = "Not emailed: " + String(e?.message || e).slice(0, 200); }
    if (said && made?.id) await env.DB.prepare("update design_queries set mail = ? where id = ?").bind(said, made.id).run().catch(() => {});
  })();
  if (ctx?.waitUntil) ctx.waitUntil(mail); else await mail;
  return json({ ok: true });
}

/** "Design yourself": reads a public web page the visitor points to and returns its plain text and a few facts (name, description,
 *  phone, email, Instagram), so the site can start from what they already have. Public pages only, small, rate-limited. */
async function dqRead(env: Env, id: string, req: Request): Promise<Response> {
  const ip = req.headers.get("cf-connecting-ip") || "x";
  if (!(await dqRate(env, "dqrd:" + id, 60, 3600)) || !(await dqRate(env, "dqrdip:" + ip, 10, 3600))) return json({ error: "busy" });
  if (!(await studioIndex(env, id))) return err(404, "Not found.");
  let q: any; try { q = JSON.parse((await req.text()).slice(0, 2000) || "{}"); } catch { return json({ error: "Couldn't read the request." }); }
  const u = publicUrl(String(q.url || "").trim()); if (!u) return json({ error: "That isn't a public web address (it must start with https://)." });
  let html = "";
  try {
    const r = await fetch(u.href, { headers: { "User-Agent": "Mozilla/5.0 (site-studio reference reader)", Accept: "text/html" }, redirect: "follow", signal: AbortSignal.timeout(8000) });
    if (!r.ok) return json({ error: `That page answered ${r.status}.` });
    if (!/html|text\/plain/i.test(r.headers.get("content-type") || "")) return json({ error: "That address isn't a web page." });
    html = new TextDecoder().decode((await r.arrayBuffer()).slice(0, 600_000));
  } catch { return json({ error: "Couldn't open that address." }); }
  const dec = (t: string) => t.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&(?:#39|rsquo|lsquo);/g, "'").replace(/&#(\d{2,5});/g, (_, n) => String.fromCharCode(+n));
  const meta = (re: RegExp) => dec((re.exec(html)?.[1] || "").trim());
  const title = clip(meta(/<title[^>]*>([\s\S]*?)<\/title>/i), 160);
  const site = clip(meta(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']*)["']/i) || meta(/<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:site_name["']/i), 100);
  const description = clip(meta(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) || meta(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i) || meta(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i), 300);
  const extra: string[] = [];
  for (const m of html.matchAll(/href=["']tel:([^"']+)["']/gi)) extra.push("Call " + dec(m[1]).trim());
  for (const m of html.matchAll(/href=["']mailto:([^"'?]+)/gi)) extra.push("Email " + dec(m[1]).trim());
  const ig = /instagram\.com\/([\w.]{2,30})/i.exec(html); if (ig && !/^(p|reel|explore|accounts)$/i.test(ig[1])) extra.push("Instagram https://instagram.com/" + ig[1]);
  const body = html.replace(/<(script|style|noscript|svg|head|template)[\s\S]*?<\/\1>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|footer|header|td|ul|ol)>|<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ");
  const lines: string[] = [];
  for (const raw of dec(body).split("\n")) { const l = raw.replace(/\s+/g, " ").trim(); if (l.length >= 2 && l !== lines[lines.length - 1]) lines.push(l); if (lines.length >= 400) break; }
  const text = [...new Set([...extra, ...lines])].join("\n").slice(0, 12000);
  if (!text && !title) return json({ error: "That page has no readable text (it may need JavaScript to show its content)." });
  return json({ title, site, description, text });
}

/** The AI that serves Design yourself: the choice made under Settings → AI for Design yourself, else the Studio's engine (also Settings → AI). The Picaffectz system (or an engine that isn't ready) has no AI here: the visitor's own device does the work. */
async function dqEngine(env: Env, idx: any): Promise<{ choice: string; ai: any }> {
  const mine = idx?.prefs?.design?.ai, g = idx?.ai?.engine;
  const choice = mine === "custom" || mine === "system" || mine === "cloudflare" ? mine : g === "custom" ? "custom" : g === "system" ? "system" : "cloudflare";
  let ai: any = null;
  if (choice === "custom") { const c = await anySetting(env, "ai"); if (c?.on && c.key && c.model && publicUrl(String(c.base || "").trim())) ai = customAI(c); }
  else if (choice === "cloudflare" && env.AI) ai = env.AI;
  return { choice, ai };
}

/** Reads a document or page's text and picks out what a visitor's answers need (their name, what they do, items, contact details…). With no AI available the visitor's device reads it by rules instead. */
/** The sections an AI found in a document (team, FAQ, pricing…), cut down to the fields and lengths the website uses. */
const DQ_SEC: Record<string, [string, number][]> = {
  services: [["title", 60], ["body", 220]], process: [["title", 60], ["body", 220]], highlights: [["title", 60], ["body", 220]], events: [["title", 60], ["body", 220]], values: [["title", 60], ["body", 220]], skills: [["title", 60], ["body", 220]],
  team: [["name", 50], ["role", 60], ["bio", 240]], testimonials: [["quote", 300], ["name", 50], ["role", 60], ["company", 60]], faq: [["q", 140], ["a", 400]],
  pricing: [["name", 40], ["price", 20], ["period", 30], ["blurb", 160]], stats: [["value", 20], ["label", 40]], work: [["title", 70], ["summary", 220], ["client", 60], ["result", 80]],
  offers: [["title", 60], ["body", 160], ["when", 40], ["price", 20]], experience: [["period", 30], ["title", 60], ["org", 60]], education: [["period", 30], ["title", 70], ["sub", 70]],
};
function dqSections(x: any): Record<string, any> {
  const out: Record<string, any> = {}; if (!x || typeof x !== "object") return out;
  for (const [k, fields] of Object.entries(DQ_SEC)) {
    if (!Array.isArray(x[k])) continue;
    const list = x[k].slice(0, 8).map((e: any) => { const o: any = {}; for (const [f, n] of fields) o[f] = clip(e?.[f], n); if (k === "pricing") o.features = (Array.isArray(e?.features) ? e.features : []).slice(0, 7).map((v: any) => clip(v, 80)).filter(Boolean); if (k === "experience") o.bullets = (Array.isArray(e?.bullets) ? e.bullets : []).slice(0, 4).map((v: any) => clip(v, 160)).filter(Boolean); if (["services", "process", "highlights", "events", "values", "skills"].includes(k)) o.bullets = []; return o; }).filter((o: any) => fields.some(([f]) => k === "team" ? f === "name" && o[f] : o[fields[0][0]]));
    if (list.length) out[k] = list;
  }
  for (const k of ["clients", "languages"]) if (Array.isArray(x[k])) { const l = x[k].slice(0, 12).map((v: any) => clip(v, 40)).filter(Boolean); if (l.length) out[k] = l; }
  for (const k of ["mission", "vision"]) { const v = clip(x[k], 220); if (v) out[k] = v; }
  return out;
}

/** Photos from Unsplash for a few words, asked with the owner's own access key (kept here; never sent to a browser). */
/** ---- The social photo wall's automatic photos (GET /wall/<site>): the newest posts of the owner's Instagram (with the token
 *  they saved) or the newest pins of a public Pinterest profile or board (its public feed, no key). */
type WallPic = { img: string; url: string; caption: string };
const igPics = (data: any): WallPic[] => (Array.isArray(data) ? data : []).map((m: any) => ({ img: String((m.media_type === "VIDEO" ? m.thumbnail_url : m.media_url) || ""), url: String(m.permalink || ""), caption: oneLine(String(m.caption || "")).slice(0, 160) })).filter((x: WallPic) => /^https:\/\//.test(x.img));
/** A token that starts with EAA is read through Facebook's Graph API. Meta gives this kind to newer apps (Instagram API with
 *  Unified login: the Instagram accounts shared with the token are listed by me/assigned_instagram_accounts), and to apps that
 *  reach the Instagram account through its Facebook Page (then it is the account linked to a Page the token can see). */
async function igMediaFb(token: string, n: number, handle = ""): Promise<{ items?: WallPic[]; error?: string }> {
  const G = "https://graph.facebook.com/", t = "access_token=" + encodeURIComponent(token), get = async (path: string) => { const r = await fetch(G + path + (path.includes("?") ? "&" : "?") + t, { signal: AbortSignal.timeout(15000) }); return { ok: r.ok, status: r.status, j: (await r.json().catch(() => null)) as any }; };
  const said = (x: { status: number; j: any }) => (x.j?.error?.message ? "Facebook said: " + String(x.j.error.message).slice(0, 220) : `Facebook answered ${x.status}.`);
  try {
    // a person's token lists their Pages; a Page's own token is asked about itself
    const F = "fields=name,instagram_business_account,connected_instagram_account", igOf = (p: any) => String(p?.instagram_business_account?.id || p?.connected_instagram_account?.id || "");
    let id = "", me = "", pages: any[] = [];
    // Unified login (what Meta gives newer apps): the token is a business one, and the Instagram accounts shared with it are listed directly
    const u = await get("me/assigned_instagram_accounts?fields=id,username&limit=20");
    if (u.ok) { const acc = (Array.isArray(u.j?.data) ? u.j.data : []).find((x: any) => x?.id); id = String(acc?.id || ""); me = String(acc?.username || "").toLowerCase(); }
    const a = id ? { ok: true, status: 200, j: null as any } : await get("me/accounts?" + F + "&limit=50");
    if (!id && a.ok) { pages = Array.isArray(a.j?.data) ? a.j.data : []; id = pages.map(igOf).find(Boolean) || ""; }
    if (!id) { const b = await get("me?" + F); if (b.ok) id = igOf(b.j); else if (!a.ok) return { error: said(a) }; }
    if (!/^\d+$/.test(id)) {
      // say which of the things it needs is missing: the permissions the token was given, and the Pages it can see
      const pr = await get("me/permissions"), have: string[] = pr.ok && Array.isArray(pr.j?.data) ? pr.j.data.filter((x: any) => x?.status === "granted").map((x: any) => String(x.permission)) : [];
      const lack = ["pages_show_list", "instagram_basic"].filter((x) => !have.includes(x));
      if (pr.ok && lack.length) return { error: `This Facebook token wasn't given the permission${lack.length > 1 ? "s" : ""} ${lack.join(" and ")}${have.length ? ` (it has: ${have.slice(0, 12).join(", ")})` : ""}. Easiest: in your Meta app open Instagram API → “API setup with Unified login” → “2. Generate access tokens” and press Generate token beside your Instagram account, then paste that token here. (A token from Graph API Explorer needs pages_show_list, instagram_basic and pages_read_engagement ticked.)` };
      if (!pages.length) return { error: "This Facebook token can't see any Facebook Page. When Meta asks which Pages the app may use, tick the Page your Instagram account is linked to (or choose all), then generate the token again. If the Page belongs to a business portfolio, also add the permission business_management." };
      return { error: `This Facebook token can see ${pages.length === 1 ? "the Page" : "the Pages"} ${pages.slice(0, 5).map((p) => "“" + oneLine(String(p?.name || p?.id || "")).slice(0, 40) + "”").join(", ")}, but no Instagram account is linked to ${pages.length === 1 ? "it" : "any of them"}. Link your Instagram account to the Page (the Page's Settings → Linked accounts → Instagram), make sure it is a Business or Creator account, then press Test again.` };
    }
    // Another account's posts, by its handle (Meta's Business Discovery): any public Business or Creator account can be read
    // through the token's own account. The token's own handle is simply its own posts.
    if (handle && !me) { const w = await get(id + "?fields=username"); if (w.ok) me = String(w.j?.username || "").toLowerCase(); }
    if (handle && handle.toLowerCase() !== me) {
      const d = await get(id + `?fields=business_discovery.username(${handle}){username,media.limit(${n}){caption,media_type,media_url,thumbnail_url,permalink}}`);
      if (d.ok) return { items: igPics(d.j?.business_discovery?.media?.data) };
      const msg = String(d.j?.error?.message || "");
      return { error: /username|user id|cannot find|does not exist|unsupported get/i.test(msg) || d.j?.error?.code === 110 ? `Instagram can't show @${handle}: the account has to exist, be public, and be a Business or Creator account (free to switch in the Instagram app).` : said(d) };
    }
    const m = await get(id + `/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink&limit=${n}`);
    return m.ok ? { items: igPics(m.j?.data) } : { error: said(m) };
  } catch { return { error: "Facebook didn't answer in time." }; }
}
/** `handle`: whose posts (another account is looked up through the token's own account; empty = the token's own account).
 *  `shared`: the token is the Studio's, serving a site that has none of its own, so it may only be used for that site's handle. */
async function igMedia(token: string, n: number, handle = "", shared = false): Promise<{ items?: WallPic[]; error?: string }> {
  if (/^EAA/.test(token)) return igMediaFb(token, n, handle);
  if (shared) return { error: "The Studio's Instagram token is the kind that can only show its own account (it starts with IGAA). A token that starts with EAA is needed to show other accounts by their handle." };
  try {
    const r = await fetch(`https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink&limit=${n}&access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(15000) });
    const j: any = await r.json().catch(() => null);
    if (!r.ok) return { error: j?.error?.message ? "Instagram said: " + String(j.error.message).slice(0, 200) : `Instagram answered ${r.status}.` };
    return { items: igPics(j?.data) };
  } catch { return { error: "Instagram didn't answer in time." }; }
}
/** Renews the token when it is over 30 days old (it can be renewed from one day after it was made until it runs out at 60). */
async function igRenew(env: Env, scope: string, c: any) {
  // a Facebook token (EAA…) can only be renewed with the app's secret, which is not kept here: the owner pastes a new one when it runs out
  if (/^EAA/.test(String(c.token)) || Date.now() - (+c.at || 0) < 30 * 86400000) return;
  try {
    const r = await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(String(c.token))}`, { signal: AbortSignal.timeout(15000) });
    const j: any = await r.json().catch(() => null);
    // a failed renewal is tried again a day later, not on every visit
    await putSetting(env, scope, "ig", r.ok && j?.access_token ? { ...c, token: String(j.access_token), at: String(Date.now()) } : { ...c, at: String(Date.now() - 29 * 86400000) });
  } catch { /* tried again next time */ }
}
/** A Pinterest profile or board, as the owner wrote it (name, name/board or its address) → its public feed's address. */
function pinFeed(src: string): string | null {
  const m = String(src || "").trim().replace(/^@/, "").replace(/^https?:\/\/(?:[a-z]{2,3}\.)?pinterest\.[a-z.]{2,6}\//i, "").replace(/[?#].*$/, "").split("/").filter(Boolean);
  if (!m.length || m.length > 2 || m.some((x) => !/^[\w.%-]{1,80}$/.test(x))) return null;
  return "https://www.pinterest.com/" + m[0] + (m[1] ? "/" + m[1] + ".rss" : "/feed.rss");
}
const unXml = (t: string) => t.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&amp;/g, "&");
function pinParse(xml: string, n: number): WallPic[] {
  const out: WallPic[] = [];
  for (const it of xml.match(/<item\b[\s\S]*?<\/item>/g) || []) {
    const tag = (k: string) => unXml((it.match(new RegExp("<" + k + "\\b[^>]*>([\\s\\S]*?)</" + k + ">")) || [])[1] || "").trim();
    const img = (tag("description").match(/<img[^>]+src=["']([^"']+)["']/i) || [])[1] || "", url = tag("link");
    if (!/^https:\/\/i\.pinimg\.com\//.test(img) || !/^https:\/\/([a-z]{2,3}\.)?pinterest\.[a-z.]{2,6}\//.test(url)) continue;
    out.push({ img: img.replace(/\/\d{2,4}x\//, "/564x/"), url, caption: oneLine(tag("title").replace(/<[^>]+>/g, "")).slice(0, 160) });
    if (out.length >= n) break;
  }
  return out;
}
async function pinMedia(src: string, n: number): Promise<{ items?: WallPic[]; error?: string }> {
  const feed = pinFeed(src); if (!feed) return { error: "That doesn't look like a Pinterest profile or board. Write it as name or name/board, or paste its address." };
  try {
    const r = await fetch(feed, { signal: AbortSignal.timeout(15000), headers: { "User-Agent": "Mozilla/5.0 (compatible; PicaffectzStudio/1.0; +https://picaffectz.com)", Accept: "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8" } });
    if (r.status === 404) return { error: "Pinterest has no public profile or board at that address." };
    if (!r.ok) return { error: `Pinterest answered ${r.status}.` };
    const items = pinParse(await r.text(), n);
    return items.length ? { items } : { error: "Pinterest's feed for that profile or board has no pins with pictures (a secret board has no feed)." };
  } catch { return { error: "Pinterest didn't answer in time." }; }
}
const igHandle = (v: unknown) => { const h = String(v || "").trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/[/?#].*$/, ""); return /^[A-Za-z0-9._]{1,30}$/.test(h) ? h : ""; };
/** The Studio's own Instagram token (Settings → General), which serves every site on this database that has none of its own. */
async function studioIg(env: Env): Promise<any | null> {
  const r: any = await env.DB.prepare("select scope from settings where name = 'ig' and scope like 'studio:%' order by updated_at desc limit 1").first().catch(() => null);
  const c = r ? await getSetting(env, r.scope, "ig").catch(() => null) : null; return c?.on && c.token ? c : null;
}
/** The Studio's token is shared and the address is public, so a site may spend it on a limited number of accounts a day:
 *  12 different handles that were found, and 40 that weren't (a handle typed letter by letter in the Studio is many handles that
 *  aren't found, so those are counted apart and generously). The site must be one this database knows.
 *  igHandleOk says whether one more may be tried; igHandleNote records how it went. */
type IgTry = [string, number, number?];
/** Where a site's tries are counted: under the site itself when this database knows it; otherwise (a site kept on a database of
 *  its own, or on GitHub Pages, that asks the Studio's database for its wall) in one shared count for all such sites. */
async function igBucket(env: Env, site: string): Promise<{ scope: string; found: number; missed: number }> {
  const scope = "site:" + site;
  const known = (await env.DB.prepare("select 1 x from members where scope = ? limit 1").bind(scope).first().catch(() => null)) || (await env.DB.prepare("select 1 x from files where scope = ? limit 1").bind(scope).first().catch(() => null));
  return known ? { scope, found: 12, missed: 40 } : { scope: "wall:others", found: 150, missed: 300 };
}
async function igTries(env: Env, scope: string): Promise<IgTry[]> { const cur = await getSetting(env, scope, "igh").catch(() => null), now = Date.now(); return (Array.isArray(cur?.l) ? cur.l : []).filter((x: any) => Array.isArray(x) && now - +x[1] < 86400000); }
async function igHandleOk(env: Env, site: string, handle: string): Promise<boolean> {
  const h = handle.toLowerCase(), B = await igBucket(env, site), list = await igTries(env, B.scope);
  if (list.some((x) => x[0] === h && x[2] === 1)) return true;
  return list.filter((x) => x[2] === 1).length < B.found && list.filter((x) => x[2] !== 1).length < B.missed;
}
async function igHandleNote(env: Env, site: string, handle: string, found: boolean) {
  const h = handle.toLowerCase(), B = await igBucket(env, site), list = await igTries(env, B.scope);
  if (list.some((x) => x[0] === h && (x[2] === 1) === found)) return;
  await putSetting(env, B.scope, "igh", { l: [...list.filter((x) => x[0] !== h), [h, Date.now(), found ? 1 : 0]].slice(-500) }).catch(() => {});
}
async function wallFeed(env: Env, site: string, src: string, pin: string, n: number, handle = ""): Promise<{ items?: WallPic[]; error?: string }> {
  if (src === "pinterest") return pinMedia(pin, n);
  const scope = "site:" + site, c = await getSetting(env, scope, "ig").catch(() => null);
  // the site's own token: its own posts, or the handle it names
  if (c?.on && c.token) { await igRenew(env, scope, c); return igMedia(String(((await getSetting(env, scope, "ig").catch(() => null)) || c).token), n, handle); }
  // no token of its own: the Studio's, for the handle the site gives
  const s = await studioIg(env);
  if (!s) return { error: "Instagram isn't connected yet: neither for this site nor for the Studio." };
  if (!handle) return { error: "Give the wall your Instagram handle (Social photo wall → Your handle)." };
  if (!(await igHandleOk(env, site, handle))) return { error: "Too many different Instagram accounts have been asked for today. Try again tomorrow." };
  const r = await igMedia(String(s.token), n, handle, true);
  await igHandleNote(env, site, handle, !!r.items);
  return r;
}
async function unsplashFind(key: string, words: string, n: number): Promise<{ photos?: any[]; error?: string }> {
  try {
    const r = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(words)}&per_page=${Math.max(1, Math.min(8, n))}&orientation=landscape&content_filter=high`, { signal: AbortSignal.timeout(15000), headers: { Authorization: "Client-ID " + key, "Accept-Version": "v1" } });
    if (r.status === 401) return { error: "Unsplash didn't accept the access key. Check it under Settings → AI → Pictures drawn by AI." };
    if (r.status === 403 || r.status === 429) return { error: "Unsplash's hourly limit for this key is used up (50 searches an hour until Unsplash approves the app). Please try again later." };
    const j: any = await r.json().catch(() => null);
    if (!r.ok) return { error: `Unsplash answered ${r.status}${j?.errors?.[0] ? ": " + String(j.errors[0]).slice(0, 140) : ""}` };
    const photos = (j?.results || []).filter((x: any) => x?.urls?.regular).map((x: any) => ({ url: String(x.urls.regular), thumb: String(x.urls.small || x.urls.regular), by: String(x.user?.name || "").slice(0, 80), link: String(x.user?.links?.html || ""), page: String(x.links?.html || ""), dl: String(x.links?.download_location || "") }));
    return photos.length ? { photos } : { error: "Unsplash has no photo for those words. Try simpler words." };
  } catch { return { error: "Unsplash didn't answer in time. Please try again." }; }
}
/** Unsplash asks to be told when one of its photos is used: its "download" address is called, with the key. */
async function dqPhotoUsed(env: Env, id: string, req: Request): Promise<Response> {
  if (!(await dqRate(env, "dqun2:" + id, 400, 3600))) return json({ ok: true });
  let q: any; try { q = JSON.parse((await req.text()).slice(0, 2000) || "{}"); } catch { return json({ ok: true }); }
  const dl = String(q.dl || ""), c: any = await anySetting(env, "un");
  if (c?.key && /^https:\/\/api\.unsplash\.com\/photos\/[\w-]{3,40}\/download(\?[\w=&%.-]{0,400})?$/.test(dl)) await fetch(dl, { signal: AbortSignal.timeout(8000), headers: { Authorization: "Client-ID " + c.key, "Accept-Version": "v1" } }).catch(() => {});
  return json({ ok: true });
}

/** A picture drawn from words by the Studio's own AI engine (Cloudflare's: the fast FLUX model). The Picaffectz system can't draw: the page then says so. */
async function dqImage(env: Env, id: string, req: Request): Promise<Response> {
  const ip = req.headers.get("cf-connecting-ip") || "x";
  if (!(await dqRate(env, "dqimg:" + id, 120, 3600)) || !(await dqRate(env, "dqimgip:" + ip, 16, 3600))) return json({ engine: "system", error: "busy" });
  const idx = await studioIndex(env, id); if (!idx) return err(404, "Not found.");
  const d = idx?.prefs?.design;
  if (d?.images?.source === "unsplash") {
    let b: any; try { b = JSON.parse((await req.text()).slice(0, 2000) || "{}"); } catch { return err(400, "Couldn't read the request."); }
    const words = clip(b.words || b.prompt, 120); if (words.length < 2) return err(400, "Describe the picture first.");
    const c: any = await anySetting(env, "un"); if (!c?.key) return json({ engine: "unsplash", error: "No Unsplash access key is saved yet. Add it under Settings → AI → Pictures drawn by AI." });
    return json({ engine: "unsplash", ...(await unsplashFind(String(c.key), words, +b.n || 4)) });
  }
  // Anything but Unsplash is drawn by the Studio's engine (there is no other generator).
  const { choice, ai } = await dqEngine(env, idx); if ((choice !== "cloudflare" && choice !== "custom") || !ai) return json({ engine: "system" });
  let q: any; try { q = JSON.parse((await req.text()).slice(0, 2000) || "{}"); } catch { return err(400, "Couldn't read the request."); }
  const prompt = clip(q.prompt, 400); if (prompt.length < 3) return err(400, "Describe the picture first.");
  if (choice === "custom") {
    // The owner's own API: an OpenAI-style picture endpoint, with the picture model named in Settings (or a known one for OpenAI and Gemini).
    try {
      const c: any = await anySetting(env, "ai"), base = String(c?.base || "").trim().replace(/\/+$/, "").replace(/\/chat\/completions$/, "");
      const model = String(c?.image || "").trim() || (/api\.openai\.com/.test(base) ? "dall-e-3" : /generativelanguage\.googleapis\.com/.test(base) ? "gemini-2.5-flash-image" : "");
      if (!model) return json({ engine: "custom", error: "No picture model is set. Add one under Settings → AI (for example dall-e-3 or gemini-2.5-flash-image)." });
      // Gemini's picture models ("…-image", "nano banana") are not on its OpenAI-style address: they are asked on Google's own endpoint.
      if (/generativelanguage\.googleapis\.com/.test(base) && !/imagen/i.test(model)) {
        const g = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model.replace(/^models\//, ""))}:generateContent`, { signal: AbortSignal.timeout(60000), method: "POST", headers: { "x-goog-api-key": c.key, "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: "Draw this picture: " + prompt }] }], generationConfig: { responseModalities: ["IMAGE", "TEXT"] } }) });
        const gj: any = await g.json().catch(() => null);
        if (!g.ok) return json({ engine: "custom", error: `Google answered ${g.status}: ` + String(gj?.error?.message || "").slice(0, 160) });
        const part = (gj?.candidates?.[0]?.content?.parts || []).find((x: any) => x?.inlineData?.data || x?.inline_data?.data), gi = part?.inlineData?.data || part?.inline_data?.data;
        if (typeof gi !== "string" || gi.length < 100) return json({ engine: "custom", error: "Google returned no picture (the words may have been filtered, or this model doesn't draw)." });
        return json({ engine: "custom", image: gi });
      }
      // Gemini's own picture models (the "Nano Banana" ones) draw through generateContent; the OpenAI-style address only knows Imagen.
      if (/generativelanguage\.googleapis\.com/.test(base) && !/^imagen/i.test(model)) {
        const g = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model.replace(/^models\//, ""))}:generateContent`, { method: "POST", signal: AbortSignal.timeout(60000), headers: { "x-goog-api-key": c.key, "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["IMAGE"] } }) });
        if (!g.ok) { const t = (await g.text()).replace(/\s+/g, " "); const m = /"message":\s*"([^"]{1,200})/.exec(t); return json({ engine: "custom", error: `Gemini answered ${g.status}${m ? ": " + m[1] : ""}` }); }
        const gj: any = await g.json().catch(() => null), parts: any[] = gj?.candidates?.[0]?.content?.parts || [], inl = parts.map((x) => x?.inlineData || x?.inline_data).find((x) => x?.data);
        if (!inl) return json({ engine: "custom", error: "Gemini returned no picture. That model may not draw pictures; try gemini-2.5-flash-image." });
        return json({ engine: "custom", image: inl.data });
      }
      const send = (fmt: boolean) => fetch(base + "/images/generations", { signal: AbortSignal.timeout(60000), method: "POST", headers: { Authorization: "Bearer " + c.key, "Content-Type": "application/json" }, body: JSON.stringify({ model, prompt, n: 1, ...(fmt ? { response_format: "b64_json" } : {}) }) });
      let r = await send(true); if (r.status === 400) r = await send(false);
      if (!r.ok) { const t = (await r.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 140); return json({ engine: choice, error: `Your AI API answered ${r.status} for the picture model "${model}"${t ? ": " + t : ""}` }); }
      const j: any = await r.json().catch(() => null), x = j?.data?.[0];
      let img = typeof x?.b64_json === "string" ? x.b64_json : "";
      if (!img && typeof x?.url === "string" && publicUrl(x.url)) { const b = new Uint8Array(await (await fetch(x.url)).arrayBuffer()); let s = ""; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192)); img = btoa(s); }
      if (img.length < 100) return json({ engine: choice, error: "empty" });
      return json({ engine: "custom", image: img });
    } catch (e: any) { return json({ engine: choice, error: String(e?.message || e).slice(0, 160) }); }
  }
  try {
    const r: any = await ai.run("@cf/black-forest-labs/flux-1-schnell", { prompt, steps: 4 });
    const img = typeof r?.image === "string" ? r.image : "";
    if (img.length < 100) return json({ engine: choice, error: "empty" });
    return json({ engine: "cloudflare", image: img });
  } catch (e: any) { return json({ engine: choice, error: String(e?.message || e).slice(0, 160) }); }
}

async function dqUnderstand(env: Env, id: string, req: Request): Promise<Response> {
  const ip = req.headers.get("cf-connecting-ip") || "x";
  if (!(await dqRate(env, "dqun:" + id, 80, 3600)) || !(await dqRate(env, "dqunip:" + ip, 12, 3600))) return json({ engine: "system", error: "busy" });
  const idx = await studioIndex(env, id); if (!idx) return err(404, "Not found.");
  const { choice, ai } = await dqEngine(env, idx); if (!ai) return json({ engine: "system" });
  let q: any; try { q = JSON.parse((await req.text()).slice(0, 20000) || "{}"); } catch { return err(400, "Couldn't read the request."); }
  const kind = DQ_KINDS.includes(q.kind) ? q.kind : "business", text = clip(q.text, 9000); if (text.length < 30) return json({ engine: "system" });
  const sys = `You read the text of a ${DQ_LABEL[kind].toLowerCase()}'s document or web page and pick out facts for a website. Use ONLY facts written in the text. Never invent anything. Leave out what isn't there. Reply with JSON only: {"name": short name (max 45 chars), "about": what they do in one short line (max 100 chars), "city": city or area, "story": 1-2 plain sentences about them (max 300 chars), "usp": what makes them special (max 160 chars), "items": up to 8 short names of the ${kind === "store" ? "products" : kind === "restaurant" ? "dishes" : kind === "portfolio" ? "skills" : "services"} they offer, "phone": phone number, "email": email address, "hours": opening hours in one line, "address": street address, "social": Instagram address, "sections": {each of these only when the text has it: "services": [{"title","body"}], "team": [{"name","role","bio"}], "testimonials": [{"quote","name","role","company"}], "faq": [{"q","a"}], "pricing": [{"name","price","period","blurb","features":[]}], "process": [{"title","body"}], "stats": [{"value","label"}], "clients": [names], "work": [{"title","summary","client","result"}], "highlights": [{"title","body"}], "offers": [{"title","body","when","price"}], "events": [{"title","body"}], "experience": [{"period","title","org","bullets":[]}], "education": [{"period","title","sub"}], "languages": [names], "mission": text, "vision": text, "values": [{"title","body"}]}}. Copy the wording of the text; keep every entry short. Use plain words.`;
  try {
    const r: any = await ai.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", { messages: [{ role: "system", content: sys }, { role: "user", content: text }], max_tokens: 2200, temperature: 0.1, response_format: { type: "json_object" } });
    const t = typeof r?.response === "string" ? r.response : JSON.stringify(r?.response ?? r);
    let j: any; try { j = JSON.parse(t); } catch { const m = /\{[\s\S]*\}/.exec(t); j = m ? JSON.parse(m[0]) : null; }
    if (!j || typeof j !== "object") return json({ engine: "system", error: "unreadable" });
    const f: any = {}; for (const [k, n] of [["name", 60], ["about", 110], ["city", 60], ["story", 400], ["usp", 200], ["phone", 30], ["email", 80], ["hours", 90], ["address", 140], ["social", 120]] as [string, number][]) { const v = clip(j[k], n); if (v) f[k] = v; }
    const items = (Array.isArray(j.items) ? j.items : []).map((x: any) => clip(x, 60)).filter(Boolean).slice(0, 8); if (items.length) f.items = items;
    const sections = dqSections(j.sections); if (Object.keys(sections).length) f.sections = sections;
    return json({ engine: choice, fields: f });
  } catch (e: any) { return json({ engine: "system", error: String(e?.message || e).slice(0, 160) }); }
}

async function dqWrite(env: Env, id: string, req: Request): Promise<Response> {
  const ip = req.headers.get("cf-connecting-ip") || "x";
  if (!(await dqRate(env, "dqai:" + id, 80, 3600)) || !(await dqRate(env, "dqaiip:" + ip, 12, 3600))) return json({ engine: "system", error: "busy" });
  const idx = await studioIndex(env, id); if (!idx) return err(404, "Not found.");
  const { choice, ai } = await dqEngine(env, idx);
  // The Picaffectz system (or an engine that isn't ready) writes on the visitor's own device.
  if (!ai) return json({ engine: "system" });
  let q: any; try { q = JSON.parse((await req.text()).slice(0, 20000) || "{}"); } catch { return err(400, "Couldn't read the request."); }
  const kind = DQ_KINDS.includes(q.kind) ? q.kind : "business", brand = clip(q.brand, 80); if (!brand) return err(400, "Missing name.");
  const items: string[] = (Array.isArray(q.items) ? q.items : []).slice(0, 8).map((x: any) => clip(x, 100)).filter(Boolean);
  const facts = [["About", clip(q.about, 200)], ["City", clip(q.city, 60)], ["Their story", clip(q.story, 900)], ["What makes them special", clip(q.usp, 400)], ["From their own document (use only facts found here)", clip(q.doc, 3000)]].filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("\n");
  const noun = kind === "store" ? "products" : kind === "restaurant" ? "dishes" : kind === "portfolio" ? "skills" : "services";
  const sys = `You write short, friendly website text in plain words for a small ${DQ_LABEL[kind].toLowerCase()}. Use ONLY what the owner told you. Never invent facts: no years, numbers, prices, awards, client names, addresses or claims. Keep every line short and simple. Return JSON only: {"tagline": at most 8 words, "hero_text": at most 30 words, "about_text": four to five short lines (about 60 words in all), built only from their About, services and what makes them special (a story they wrote is shown as it is, separately), "services_text": four to five short lines (about 55 words) that sum up what they offer, built only from their services, About and what makes them special, "work_text": four to five short lines (about 55 words) that sum up the projects they delivered, built only from the projects listed (empty text if none are listed), "cta_text": at most 14 words, "items": [{"name": the ${noun.slice(0, -1)} exactly as given, "text": one sentence of at most 18 words describing it, using their About line, story and what makes them special where they fit, without inventing facts}] in the same order, "faq": [{"q": question, "a": answer}] three general questions a customer might ask, answered without inventing facts}.`;
  const work: string[] = (Array.isArray(q.work) ? q.work : []).slice(0, 6).map((x: any) => clip(x, 160)).filter(Boolean);
  const user = `Name: ${brand}\n${facts}\n${noun}: ${items.join("; ") || "(none given)"}${work.length ? `\nProjects delivered: ${work.join("; ")}` : ""}`;
  try {
    const r: any = await ai.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", { messages: [{ role: "system", content: sys }, { role: "user", content: user }], max_tokens: 1600, temperature: 0.7, response_format: { type: "json_object" } });
    const t = typeof r?.response === "string" ? r.response : JSON.stringify(r?.response ?? r);
    let j: any; try { j = JSON.parse(t); } catch { const m = /\{[\s\S]*\}/.exec(t); j = m ? JSON.parse(m[0]) : null; }
    const copy = dqCopy(j); if (!Object.keys(copy).length) return json({ engine: "system", error: "unreadable" });
    return json({ engine: choice, copy });
  } catch (e: any) { return json({ engine: "system", error: String(e?.message || e).slice(0, 160) }); }
}

export default {
  async fetch(req: Request, env: Env, ctx?: { waitUntil(p: Promise<unknown>): void }): Promise<Response> {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const u = new URL(req.url), p = u.pathname.replace(/\/+$/, "") || "/";
    try {
      if (p === "/") return json({ ok: true, service: "site-studio-db", v: V, mail: !!(env.RESEND_API_KEY && env.MAIL_FROM), ...(env.CF_TOKEN && env.CF_ACCOUNT ? { deploy: true, account: env.CF_ACCOUNT } : {}), ...(env.GH_TOKEN ? { gh: true } : {}), ...(env.AI ? { ai: true, pamphlet: 2 } : {}), reviews: true, dq: 1, look: 1, outline: 1, pictures: 1, connect: 2, translate: 4, approvals: 1, accounts: 2, cfx: 4, cfa: 1, google: 1, studioPages: 1, del: 1, enqMail: 3, ...(otherAccounts(env).length ? { more: otherAccounts(env).length } : {}) });

      // ---- a site's social photo wall, filled by itself (public): GET /wall/<site>?src=instagram|pinterest&pin=<profile or board>&n=12
      // Answers are kept for half an hour, so a busy site asks Instagram or Pinterest twice an hour at most.
      if (/^\/wall\/[a-z0-9][a-z0-9-]{0,59}$/.test(p) && req.method === "GET") {
        const src = u.searchParams.get("src") === "pinterest" ? "pinterest" : "instagram", pin = String(u.searchParams.get("pin") || "").slice(0, 200), n = Math.max(3, Math.min(24, +(u.searchParams.get("n") || 12) || 12)), handle = src === "instagram" ? igHandle(u.searchParams.get("h")) : "";
        const key = new Request(u.origin + p + "?src=" + src + "&pin=" + encodeURIComponent(pin) + "&n=" + n + "&h=" + handle.toLowerCase()), store = (globalThis as any).caches?.default;
        const hit = store ? await store.match(key).catch(() => null) : null; if (hit) return hit;
        const r = await wallFeed(env, p.split("/")[2], src, pin, n, handle);
        const res = new Response(JSON.stringify(r.items ? { items: r.items } : { items: [], error: r.error }), { headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "public, max-age=" + (r.items ? 1800 : 120) } });
        if (store) { const put = store.put(key, res.clone()).catch(() => {}); if (ctx?.waitUntil) ctx.waitUntil(put); else await put; }
        return res;
      }

      // The owner's own AI API in the place of Workers AI, when a request asks for it.
      if (p.startsWith("/ai/") && u.searchParams.get("engine") === "custom") {
        const c = await anySetting(env, "ai");
        if (!c?.on || !c.key || !c.model || !publicUrl(String(c.base || "").trim())) return json({ error: "Your own AI API isn't set up yet. Fill it in under Settings → AI." });
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
        let mailEnv = env, custom = "";
        if (typeof forSite === "string" && /^[a-z0-9][a-z0-9-]{0,59}$/.test(forSite) && (await env.DB.prepare("select 1 from members where email = ? and scope = ? limit 1").bind(email, "site:" + forSite).first())) {
          mailEnv = await siteMail(env, forSite);
          const c = await siteContent(env, forSite).catch(() => null), T = c?.emails?.signin;
          if (c) intro = `Enter this code to sign in to ${siteName(c, forSite)}:`; // the site's own name, not the Studio's
          if (T && typeof T === "object") {
            const vars = { site: siteName(c, forSite), email };
            if (T.subject) { subject = oneLine(fill(String(T.subject), vars)).slice(0, 150) || subject; heading = subject; }
            if (T.intro) intro = fill(String(T.intro), vars);
            if (T.footer) footer = fill(String(T.footer), vars);
            const tp = tplOf(c.emails, "signin"); if (tp && /\{code\}/.test(tp)) custom = mailEmail(tp, { ...vars, code }, { code: codeBlock(code) }, WRAP);
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
        let onWa = false, onSms = false;
        const waScope = typeof forSite === "string" && /^[a-z0-9][a-z0-9-]{0,59}$/.test(forSite) ? "site:" + forSite : typeof forStudio === "string" && /^[a-z0-9][a-z0-9-]{0,59}$/.test(forStudio) ? "studio:" + forStudio : "";
        if (waScope && (await env.DB.prepare("select 1 from members where email = ? and scope = ? limit 1").bind(email, waScope).first())) {
          const w = await getSetting(env, waScope, "wa").catch(() => null), num = waReady(w) && w.login && String(w.tplOtp || "").trim() ? waNum(waPhoneOf(w.phones, email), w.cc) : "";
          // what the Studio lets this site use for sign-in codes (a Studio's own sign-in may use both)
          const pol = waScope.startsWith("site:") ? msgPolicy(await siteContent(env, waScope.slice(5)).catch(() => null)).login : { wa: true, sms: true };
          if (num && pol.wa) try { await waSend(w, num, w.tplOtp, [code], code); onWa = true; } catch { /* the email still goes */ }
          const z = await getSetting(env, waScope, "sms").catch(() => null), sn = pol.sms && smsReady(z) && smsOwnCode(z) && z.login ? waNum(waPhoneOf(z.phones, email), z.cc) : "";
          if (sn) try { await smsSend(z, sn, code, env.NAME || "your account"); onSms = true; } catch { /* the email still goes */ }
        }
        try { await sendMail(mailEnv, email, subject, custom ? custom : WRAP(`<h2 style="margin:0 0 12px;font-size:20px">${hesc(heading)}</h2>${paras(intro)}<p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:0 0 14px">${code}</p>${paras(footer, "margin:0 0 8px;color:#667;font-size:13px")}`)); }
        catch (e) { if (!onWa && !onSms) throw e; }
        return json({ ok: true, ...(onWa ? { whatsapp: true } : {}), ...(onSms ? { sms: true } : {}) });
      }
      if (p === "/auth/verify" && req.method === "POST") {
        const b = (await req.json()) as any; const email = String(b.email || "").trim().toLowerCase(), code = String(b.code || "").trim();
        const c: any = await env.DB.prepare("select hash, expires, tries from codes where email = ?").bind(email).first();
        if (!c || c.expires < Date.now()) return err(403, "The code has expired. Ask for a new one.");
        if (c.tries >= 5) return err(429, "Too many tries. Ask for a new code.");
        if (b64u(await hmac(env.SECRET, "c:" + email + ":" + code)) !== c.hash) { await env.DB.prepare("update codes set tries = tries + 1 where email = ?").bind(email).run(); return err(403, "That code isn't right."); }
        await env.DB.prepare("delete from codes where email = ?").bind(email).run();
        // The address this sign-in came from is now known: Sign in with Google is offered there (and only on such addresses).
        try { await gsOrigin(env, req.headers.get("origin") || ""); } catch { /* the sign-in still stands */ }
        return json({ token: await sessionFor(env, email), email, ...((await pinOn(env)) ? { dev: await pinDevice(env, email) } : {}) });
      }
      // ---- Sign in with Google, for emails that are already members (the same people who can get a code by email).
      // No Google script on the page and no secret: Google sends a signed token to this Worker, which checks it.
      if (p === "/auth/google" && req.method === "GET") { const g = await gsCfg(env); return json({ on: !!(g.on && g.clientId), clientId: g.clientId || "", redirect: u.origin + "/auth/google/cb" }); }
      if (p === "/auth/google/set" && req.method === "POST") {
        const e = await who(env, req); if (!e) return err(401, "Sign in first.");
        // The Studio's owners; on a database with no Studio in it (a site's own), that site's owners.
        const owner = await env.DB.prepare("select 1 from members where email = ? and role = 'owner' and scope like 'studio:%' limit 1").bind(e).first()
          || (!(await env.DB.prepare("select 1 from members where scope like 'studio:%' limit 1").first()) && await env.DB.prepare("select 1 from members where email = ? and role = 'owner' limit 1").bind(e).first());
        if (!owner) return err(403, "Only the owners can change how people sign in.");
        const b = (await req.json()) as any, clientId = String(b.clientId || "").trim();
        if (clientId && !/^[\w.-]{10,200}\.apps\.googleusercontent\.com$/.test(clientId)) return err(400, "That doesn't look like a Google client ID (it ends in .apps.googleusercontent.com).");
        const g = await gsCfg(env); await putSetting(env, "_db", "google", { ...g, clientId, on: !!b.on && !!clientId });
        try { await gsOrigin(env, req.headers.get("origin") || ""); } catch { /* saved all the same */ }
        return json({ ok: true, on: !!b.on && !!clientId, clientId });
      }
      if (p === "/auth/google/start" && req.method === "GET") {
        const g = await gsCfg(env), origin = String(u.searchParams.get("origin") || ""), nonce = String(u.searchParams.get("nonce") || "");
        if (!g.on || !g.clientId) return gsPage("Sign in with Google isn't switched on here.", "Use your email and a code instead.");
        if (!/^[A-Za-z0-9_-]{32,128}$/.test(nonce)) return gsPage("That sign-in link is incomplete.", "Go back and press Sign in with Google again.");
        if (!(g.origins || []).includes(origin)) return gsPage("Sign in with a code once first.", "Sign in with Google works on an address after someone has signed in there with an email code.");
        const body = b64u(enc.encode(JSON.stringify({ o: origin, n: nonce, x: Date.now() + 10 * 60000 }))), state = body + "." + b64u(await hmac(env.SECRET, "g:" + body));
        return Response.redirect("https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({ client_id: g.clientId, redirect_uri: u.origin + "/auth/google/cb", response_type: "id_token", scope: "openid email", nonce, state, prompt: "select_account" }), 302);
      }
      // Google sends the person back here with the token in the address's fragment, which only this page can read.
      if (p === "/auth/google/cb" && req.method === "GET") return gsPage("Signing you in…", "One moment.", true);
      if (p === "/auth/google/finish" && req.method === "POST") {
        const b = (await req.json().catch(() => ({}))) as any, [body, sig] = String(b.state || "").split(".");
        if (!body || !sig || b64u(await hmac(env.SECRET, "g:" + body)) !== sig) return err(400, "That sign-in didn't start here. Go back and press Sign in with Google again.");
        let st: any = null; try { st = JSON.parse(dec.decode(unb64u(body))); } catch { /* refused below */ }
        if (!st || st.x < Date.now()) return err(400, "That took too long. Go back and press Sign in with Google again.");
        const g = await gsCfg(env); if (!g.on || !g.clientId) return err(403, "Sign in with Google isn't switched on here.");
        const email = await gsEmail(String(b.id_token || ""), g.clientId, st.n);
        if (!email) return err(403, "Google's answer couldn't be checked. Go back and try again.");
        if (!(await env.DB.prepare("select 1 from members where email = ? limit 1").bind(email).first())) return err(403, `${email} isn't a member here. Ask the owner to add you, then sign in again.`);
        // Kept for two minutes for the page that started it (it holds the other half), and given out once.
        await putSetting(env, "_gs", b64u(await hmac(env.SECRET, "gn:" + st.n)), { token: await sessionFor(env, email), email, o: st.o, x: Date.now() + 2 * 60000 });
        return json({ ok: true, email });
      }
      if (p === "/auth/google/poll" && req.method === "POST") {
        const b = (await req.json().catch(() => ({}))) as any, nonce = String(b.nonce || "");
        if (!/^[A-Za-z0-9_-]{32,128}$/.test(nonce)) return err(400, "Not a sign-in.");
        const key = b64u(await hmac(env.SECRET, "gn:" + nonce)), r = await getSetting(env, "_gs", key);
        if (!r) return json({ wait: true });
        await putSetting(env, "_gs", key, null);
        if (r.x < Date.now() || r.o !== (req.headers.get("origin") || "")) return err(403, "That sign-in can't be used here. Press Sign in with Google again.");
        return json({ token: r.token, email: r.email });
      }
      // ---- PIN sign-in (see pinOn above)
      if (p === "/auth/pin" && req.method === "GET") {
        const e = await who(env, req), on = await pinOn(env);
        return json({ on, ...(e ? { has: !!(await env.DB.prepare("select 1 from pins where email = ?").bind(e).first()) } : {}) });
      }
      if (p === "/auth/pin/set-on" && req.method === "POST") {
        const e = await who(env, req); if (!e) return err(401, "Sign in first.");
        if (!(await isDbOwner(env, e))) return err(403, "Only the owners can change how people sign in.");
        const b = (await req.json().catch(() => ({}))) as any; await putSetting(env, "_db", "pin", { on: !!b.on });
        return json({ ok: true, on: !!b.on });
      }
      if (p === "/auth/pin/save" && req.method === "POST") {
        const e = await who(env, req); if (!e) return err(401, "Sign in first.");
        if (!(await pinOn(env))) return err(403, "PIN sign-in isn't switched on.");
        const b = (await req.json().catch(() => ({}))) as any, pin = String(b.pin || "");
        if (!/^\d{4,6}$/.test(pin)) return err(400, "A PIN is 4 to 6 digits.");
        if (pinWeak(pin)) return err(400, "That PIN is too easy to guess (like 1234 or 1111). Choose another.");
        const salt = b64u(crypto.getRandomValues(new Uint8Array(12)));
        await env.DB.prepare("insert into pins (email, salt, hash, tries, locked, set_at) values (?, ?, ?, 0, 0, ?) on conflict (email) do update set salt = excluded.salt, hash = excluded.hash, tries = 0, locked = 0, set_at = excluded.set_at").bind(e, salt, await pinHash(env, e, salt, pin), new Date().toISOString()).run();
        return json({ ok: true, dev: await pinDevice(env, e) });
      }
      if (p === "/auth/pin/device" && req.method === "POST") { // this device signed in another way (Google): let it use the PIN too
        const e = await who(env, req); if (!e) return err(401, "Sign in first.");
        if (!(await pinOn(env)) || !(await env.DB.prepare("select 1 from pins where email = ?").bind(e).first())) return err(404, "No PIN.");
        return json({ ok: true, dev: await pinDevice(env, e) });
      }
      if (p === "/auth/pin/remove" && req.method === "POST") {
        const e = await who(env, req); if (!e) return err(401, "Sign in first.");
        await env.DB.batch([env.DB.prepare("delete from pins where email = ?").bind(e), env.DB.prepare("delete from pin_dev where email = ?").bind(e)]);
        return json({ ok: true });
      }
      if (p === "/auth/pin/login" && req.method === "POST") {
        const b = (await req.json().catch(() => ({}))) as any, email = String(b.email || "").trim().toLowerCase(), pin = String(b.pin || ""), dev = String(b.dev || "");
        const no = () => err(403, "That PIN isn't right, or this device hasn't signed in with a code yet. Use an emailed code instead.");
        if (!(await pinOn(env))) return err(403, "PIN sign-in isn't switched on.");
        if (!emailOk(email) || !/^\d{4,6}$/.test(pin) || !/^[\w-]{20,60}$/.test(dev)) return no();
        const row: any = await env.DB.prepare("select salt, hash, locked from pins where email = ?").bind(email).first();
        const dv = row && (await env.DB.prepare("select 1 from pin_dev where email = ? and dev = ?").bind(email, await devHash(env, dev)).first());
        if (!row || !dv) return no();
        if (row.locked > Date.now()) return err(429, `Too many wrong PINs. PIN sign-in is paused for ${Math.ceil((row.locked - Date.now()) / 60000)} minutes; use an emailed code instead.`);
        if (await pinHash(env, email, row.salt, pin) !== row.hash) {
          const r: any = await env.DB.prepare("update pins set tries = tries + 1 where email = ? returning tries").bind(email).first(), left = 5 - (r?.tries || 5);
          if (left <= 0) { await env.DB.prepare("update pins set tries = 0, locked = ? where email = ?").bind(Date.now() + 15 * 60_000, email).run(); return err(429, "Too many wrong PINs. PIN sign-in is paused for 15 minutes; use an emailed code instead."); }
          return err(403, `That PIN isn't right. ${left} ${left === 1 ? "try" : "tries"} left.`);
        }
        if (!(await env.DB.prepare("select 1 from members where email = ? limit 1").bind(email).first())) return no();
        await env.DB.prepare("update pins set tries = 0, locked = 0 where email = ?").bind(email).run();
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
        const pg: string[] = []; for (const g of ["cf", "pe", "st", "pp"]) if (pgReady(g, await getSetting(env, "site:" + site, g).catch(() => null))) pg.push(g);
        const sc = await siteContent(env, site).catch(() => null), cw = await codeWays(env, site, sc), canCode = cw.any;
        return json({ otp: cw.need, pts: canCode && loyOf(sc).on, via: [cw.wa ? "wa" : "", cw.sms ? "sms" : ""].filter(Boolean), em: emailCheckOn(env, sc), acct: acctOf(env, sc, cw), rz: z?.on && z.secret && z.keyId ? String(z.keyId) : "", pg });
      }
      if (/^\/points\/[a-z0-9][a-z0-9-]{0,59}$/.test(p) && req.method === "POST") {
        const site = p.split("/")[2], b = (await req.json()) as any, L = loyOf(await siteContent(env, site));
        if (!L.on) return err(404, "Not found.");
        const v = await pointsBal(env, site, b.phone, b.otp, { email: b.email, acct: b.acct }); if (!v.ok) return err(403, "Verify your mobile number first.");
        return json({ points: v.bal, worth: L.worth, min: L.min, maxPct: L.maxPct, earn: L.earn });
      }
      // ---- Customer accounts: signing in with a proved number or address, and the customer's own orders and points.
      if (/^\/acct\/(in|me|save|favs)\/[a-z0-9][a-z0-9-]{0,59}$/.test(p) && req.method === "POST") {
        const site = p.split("/")[3], b = (await req.json()) as any, sc = await siteContent(env, site).catch(() => null), cw = await codeWays(env, site, sc), A = acctOf(env, sc, cw);
        if (!A) return err(404, "Not found.");
        if (p.startsWith("/acct/in/")) {
          // the proof is the one a code check just gave (never the "couldn't send" pass: that proves nothing about who this is)
          let key = "", kind = "";
          if (A.phone.length && b.phone) { const num = waNum(b.phone, cw.cc), [exp, sig] = String(b.otp || "").split("."); if (num && +exp > Date.now() && sig === b64u(await hmac(env.SECRET, "otp:" + site + ":" + num + ":" + exp))) { key = num; kind = "phone"; } }
          else if (A.email && b.email) { const em = emailKey(b.email), [exp, sig] = String(b.eotp || "").split("."); if (em && +exp > Date.now() && sig === b64u(await hmac(env.SECRET, "eotp:" + site + ":" + em + ":" + exp))) { key = em; kind = "email"; } }
          if (!key) return err(403, "That code has expired. Ask for a new one.");
          const exp = Date.now() + CUST_DAYS * 86400_000;
          return json({ ok: true, key, kind, pass: await custPass(env, site, key, exp) });
        }
        const key = String(b.key || ""); if (!(await custOk(env, site, key, b.pass))) return err(401, "Please sign in again.");
        const byMail = key.includes("@");
        // The customer's own details: their name, the other contact (never the one they signed in with), and their addresses.
        // The customer's saved items (favourite dishes, a wishlist): kept with their account, so they follow them to any device.
        if (p.startsWith("/acct/favs/")) {
          const favs = cleanFavs(b.favs);
          let kept: any = {}; try { kept = JSON.parse(String(((await env.DB.prepare("select data from profiles where site = ? and ckey = ?").bind(site, key).first()) as any)?.data || "{}")) || {}; } catch { /* none kept */ }
          await env.DB.prepare("insert into profiles (site, ckey, data) values (?, ?, ?) on conflict (site, ckey) do update set data = excluded.data").bind(site, key, JSON.stringify({ ...kept, favs })).run();
          return json({ ok: true, favs });
        }
        if (p.startsWith("/acct/save/")) {
          const name = oneLine(String(b.name || "")).replace(/\s+/g, " ").slice(0, 100), phone = byMail ? String(b.phone || "").replace(/[^\d+ ()-]/g, "").slice(0, 24) : "", email = byMail ? "" : emailKey(b.email);
          if (!byMail && String(b.email || "").trim() && !email) return err(400, "Enter a valid email address.");
          if (byMail && phone && phone.replace(/\D/g, "").length < 8) return err(400, "Enter a mobile number with at least 8 digits.");
          const addrs = (Array.isArray(b.addresses) ? b.addresses : []).slice(0, 6).map(cleanAddr).filter((a: any) => a.line1 || a.city || a.pin), now = new Date().toISOString();
          // Date of birth and gender are kept only when the page sends them (a shop that doesn't ask never touches them).
          let kept: any = {}; try { kept = JSON.parse(String(((await env.DB.prepare("select data from profiles where site = ? and ckey = ?").bind(site, key).first()) as any)?.data || "{}")) || {}; } catch { /* none kept */ }
          const dob = "dob" in b ? (/^(19|20)\d\d-\d\d-\d\d$/.test(String(b.dob)) && String(b.dob) <= now.slice(0, 10) ? String(b.dob) : "") : cleanDob(kept.dob), gender = "gender" in b ? cleanGender(b.gender) : cleanGender(kept.gender);
          await env.DB.batch([
            env.DB.prepare("insert into customers (site, ckey, name, phone, email, verified, orders, spent, points, first_at, last_at) values (?, ?, ?, ?, ?, 1, 0, 0, 0, ?, ?) on conflict (site, ckey) do update set name = excluded.name, phone = case when ? = 1 then excluded.phone else phone end, email = case when ? = 1 then email else excluded.email end, verified = 1")
              .bind(site, key, name, byMail ? phone : "+" + key, byMail ? key : email, now, now, byMail ? 1 : 0, byMail ? 1 : 0),
            env.DB.prepare("insert into profiles (site, ckey, data) values (?, ?, ?) on conflict (site, ckey) do update set data = excluded.data").bind(site, key, JSON.stringify({ addresses: addrs, dob, gender, favs: cleanFavs(kept.favs) })),
          ]);
          return json({ ok: true, profile: { name, phone: byMail ? phone : "+" + key, email: byMail ? key : email, addresses: addrs, dob, gender } });
        }
        const row: any = await env.DB.prepare("select name, phone, email, orders, spent, points, first_at from customers where site = ? and ckey = ?").bind(site, key).first();
        let addresses: any[] = [], pf: any = {}; try { pf = JSON.parse(String(((await env.DB.prepare("select data from profiles where site = ? and ckey = ?").bind(site, key).first()) as any)?.data || "{}")) || {}; addresses = (pf.addresses || []).slice(0, 6).map(cleanAddr); } catch { /* none kept */ }
        const nos = (((await env.DB.prepare("select order_no, max(at) t from points where site = ? and ckey = ? and order_no <> '' group by order_no order by t desc limit 25").bind(site, key).all()).results || []) as any[]).map((r) => String(r.order_no));
        const orders: any[] = [];
        if (nos.length) {
          const by = await Promise.all(nos.map((n) => byRef(env, n, ["instr(data, ?) > 0", `"order_no":${JSON.stringify(n)}`])));
          const rows = ((await env.DB.prepare(`select data, status, created_at from enquiries where site = ? and (${by.map((x) => x[0]).join(" or ")}) order by created_at desc limit 40`).bind(site, ...by.map((x) => x[1])).all()).results || []) as any[];
          for (const r of rows) { let d: any = null; try { d = JSON.parse(r.data); } catch { continue; } if (!nos.includes(String(d.order_no))) continue;
            let items: any[] = []; try { items = JSON.parse(String(d._items || "[]")).slice(0, 40); } catch { /* an older order: its text is shown */ }
            orders.push({ no: String(d.order_no), at: r.created_at, total: String(d.total || ""), status: String(r.status || "new"), mode: String(d.mode || ""), paid: d._paid === "yes", pay: String(d.payment || d.pay || ""), address: String(d.address || ""), name: String(d.name || ""), points: String(d._points || ""), ...(d._bill ? (() => { try { return { bill: JSON.parse(String(d._bill)) }; } catch { return {}; } })() : {}), ...(trackOf(d) ? { track: trackShown(trackOf(d)) } : {}), items, text: String(d.items || d.order || d.message || "").slice(0, 2000) }); }
        }
        const L = loyOf(sc);
        return json({ ok: true, name: row?.name || "", phone: byMail ? row?.phone || "" : "+" + key, email: byMail ? key : row?.email || "", addresses, favs: cleanFavs(pf.favs), dob: cleanDob(pf.dob), gender: cleanGender(pf.gender), count: +row?.orders || 0, points: Math.max(0, +row?.points || 0), loyalty: L.on ? { worth: L.worth, min: L.min, maxPct: L.maxPct } : null, orders });
      }
      // ---- A customer proves their email address at checkout: a 6-digit code by email, then a proof only this database can make.
      if (/^\/eotp\/(send|check)\/[a-z0-9][a-z0-9-]{0,59}$/.test(p) && req.method === "POST") {
        const site = p.split("/")[3], b = (await req.json()) as any, sc = await siteContent(env, site).catch(() => null);
        if (!emailCheckOn(env, sc) && !acctOf(env, sc, { wa: false, sms: false })?.email) return err(404, "Not found."); // (also where customers sign in by email)
        const em = emailKey(b.email); if (!em) return err(400, "Enter a valid email address.");
        const k = "e:" + site + ":" + em, now = Date.now();
        if (p.startsWith("/eotp/send/")) {
          const prev: any = await env.DB.prepare("select sent from otps where k = ?").bind(k).first();
          if (prev && now - prev.sent < 45_000) return err(429, "A code was just sent. Wait a minute before asking for another.");
          const n: any = await env.DB.prepare("select count(*) n from otps where k like ? and sent > ?").bind("e:" + site + ":%", now - 3600_000).first();
          if ((n?.n || 0) >= 150) return err(429, "Too many codes were asked for. Please try again later.");
          const code = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000)), name = oneLine(String(sc?.brand?.name || "")).slice(0, 60) || "your order";
          await env.DB.prepare("insert into otps (k, hash, expires, tries, sent) values (?, ?, ?, 0, ?) on conflict (k) do update set hash = excluded.hash, expires = excluded.expires, tries = 0, sent = excluded.sent").bind(k, b64u(await hmac(env.SECRET, k + ":" + code)), now + 10 * 60_000, now).run();
          try { await sendMail(await siteMail(env, site), em, `${code} is your code for ${name}`, `<p>Your code to confirm this email address for ${hesc(name)}:</p><p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p><p>It works for 10 minutes. If you didn't ask for it, ignore this email.</p>`); }
          catch {
            // The database could not send mail to this address at all (for example its sender is still in test mode). Customers are
            // not locked out for that: the order may go ahead unverified, with a pass only this database can make, and is marked so.
            const exp = now + 45 * 60_000;
            return json({ ok: false, skip: exp + "." + b64u(await hmac(env.SECRET, "eskip:" + site + ":" + em + ":" + exp)) });
          }
          return json({ ok: true });
        }
        const c: any = await env.DB.prepare("select hash, expires, tries from otps where k = ?").bind(k).first();
        if (!c || c.expires < now) return err(403, "The code has expired. Ask for a new one.");
        if (c.tries >= 5) return err(429, "Too many tries. Ask for a new code.");
        if (c.hash !== b64u(await hmac(env.SECRET, k + ":" + String(b.code || "").trim()))) { await env.DB.prepare("update otps set tries = tries + 1 where k = ?").bind(k).run(); return err(403, "That code isn't right."); }
        await env.DB.prepare("update otps set expires = 0 where k = ?").bind(k).run();
        const exp = now + 45 * 60_000;
        return json({ ok: true, token: exp + "." + b64u(await hmac(env.SECRET, "eotp:" + site + ":" + em + ":" + exp)) });
      }
      if (/^\/otp\/(send|check)\/[a-z0-9][a-z0-9-]{0,59}$/.test(p) && req.method === "POST") {
        const site = p.split("/")[3], b = (await req.json()) as any, sc = await siteContent(env, site).catch(() => null), cw = await codeWays(env, site, sc), w = cw.w;
        // Codes go out where the site asks guests to verify, or where points can be spent (a guest verifies to use theirs).
        if (!(cw.any && (cw.need || loyOf(sc).on || acctOf(env, sc, cw)?.phone.length))) return err(404, "Not found."); // (also where customers sign in by mobile)
        // on WhatsApp or by SMS: the one asked for when the site has both, else the one it has
        const via = b.via === "sms" && cw.sms ? "sms" : b.via === "wa" && cw.wa ? "wa" : cw.wa ? "wa" : "sms";
        const num = waNum(b.phone, cw.cc); if (!num) return err(400, "Enter your mobile number with its country code.");
        const k = "o:" + site + ":" + num, now = Date.now();
        if (p.startsWith("/otp/send/")) {
          const prev: any = await env.DB.prepare("select sent from otps where k = ?").bind(k).first();
          if (prev && now - prev.sent < 45_000) return err(429, "A code was just sent. Wait a minute before asking for another.");
          // No more than 80 codes an hour for a site: each one is a paid message for its owner.
          const n: any = await env.DB.prepare("select count(*) n from otps where k like ? and sent > ?").bind("o:" + site + ":%", now - 3600_000).first();
          if ((n?.n || 0) >= 80) return err(429, "Too many codes were asked for. Please try again later, or call us.");
          const code = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
          await env.DB.prepare("insert into otps (k, hash, expires, tries, sent) values (?, ?, ?, 0, ?) on conflict (k) do update set hash = excluded.hash, expires = excluded.expires, tries = 0, sent = excluded.sent").bind(k, b64u(await hmac(env.SECRET, k + ":" + code)), now + 10 * 60_000, now).run();
          try {
            if (via === "sms") { const ref = await smsSend(cw.z, num, code, siteName(sc, site)); if (ref) await env.DB.prepare("update otps set hash = ? where k = ?").bind("ref:" + ref, k).run(); }
            else await waSend(w, num, w.tplOtp, [code], code);
          }
          catch { return err(502, `We couldn't send the code ${via === "sms" ? "by SMS" : "on WhatsApp"} just now. Check the number${cw.wa && cw.sms ? ", try the other way" : ""}, or call us to order.`); }
          return json({ ok: true, via });
        }
        const c: any = await env.DB.prepare("select hash, expires, tries from otps where k = ?").bind(k).first();
        if (!c || c.expires < now) return err(403, "The code has expired. Ask for a new one.");
        if (c.tries >= 5) return err(429, "Too many tries. Ask for a new code.");
        // a code the SMS company made itself is checked with them; any other against what was kept here
        const typed = String(b.code || "").trim(), right = String(c.hash).startsWith("ref:") ? /^\d{4,8}$/.test(typed) && !!cw.z && (await mcCheck(cw.z, num, String(c.hash).slice(4), typed).catch(() => false)) : c.hash === b64u(await hmac(env.SECRET, k + ":" + typed));
        if (!right) { await env.DB.prepare("update otps set tries = tries + 1 where k = ?").bind(k).run(); return err(403, "That code isn't right."); }
        await env.DB.prepare("update otps set expires = 0 where k = ?").bind(k).run();
        const exp = now + 45 * 60_000;
        // (the ".s" on the end only says the code went by SMS, for the order's record)
        return json({ ok: true, token: exp + "." + b64u(await hmac(env.SECRET, "otp:" + site + ":" + num + ":" + exp)) + (via === "sms" ? ".s" : "") });
      }
      // ---- Petpooja reports an order's status (accepted, ready, dispatched, delivered, cancelled). The address carries a key only this database can make.
      if (/^\/hook\/pos\/[a-z0-9][a-z0-9-]{0,59}$/.test(p) && req.method === "POST") {
        const site = p.split("/")[3], key = b64u(await hmac(env.SECRET, "pos:" + site)).slice(0, 32);
        if (u.searchParams.get("k") !== key) return err(403, "Not allowed.");
        const z = await getSetting(env, "site:" + site, "pos").catch(() => null); if (!posReady(z)) return err(404, "Not set up.");
        const b = (await req.json().catch(() => ({}))) as any, no = String(b.orderID || b.clientOrderID || ""), st = POS_STATUS[String(b.status)];
        if (String(b.restID || "") !== String(z.restId) || !/^[A-Z0-9][A-Z0-9-]{3,29}$/.test(no) || !st) return json({ success: false, message: "Unknown order or status." }, 400);
        const by = await byRef(env, no, ["data like ?", `%"order_no":"${no}"%`]);
        const rows = ((await env.DB.prepare(`select id, data, status from enquiries where site = ? and ${by[0]} order by id desc limit 5`).bind(site, by[1]).all()).results || []) as any[];
        const row = rows.find((r) => { try { return JSON.parse(r.data).order_no === no; } catch { return false; } });
        if (!row) return json({ success: false, message: "Order not found." }, 404);
        const d = JSON.parse(row.data); d._pos = "Petpooja: " + ({ accepted: "accepted", ready: "food ready", out: "dispatched", done: "delivered", cancelled: "cancelled" } as Record<string, string>)[st] + (b.cancel_reason ? " (" + oneLine(String(b.cancel_reason)).slice(0, 120) + ")" : "") + (b.rider_name ? `, rider ${oneLine(String(b.rider_name)).slice(0, 60)} ${String(b.rider_phone_number || "").replace(/[^\d+ ]/g, "").slice(0, 20)}` : "");
        if (+b.minimum_prep_time > 0) d._pos_prep = String(Math.round(+b.minimum_prep_time));
        await env.DB.prepare("update enquiries set status = ?, data = ? where id = ?").bind(st, JSON.stringify(d), row.id).run();
        return json({ success: true, message: "Order status updated." });
      }
      // ---- an online payment for an order (restaurant or shop): the amount comes from the site's own content, worked out here
      if (/^\/pay\/(rz|cf|pe|st|pp)\/[a-z0-9][a-z0-9-]{0,59}$/.test(p) && req.method === "POST") {
        const g = p.split("/")[2], site = p.split("/")[3], z = await getSetting(env, "site:" + site, g);
        if (!pgReady(g, z)) return err(404, "Online payment isn't set up for this site.");
        const q = (await req.json()) as any, no = String(q.order_no || "");
        if (!/^[A-Z0-9][A-Z0-9-]{3,29}$/.test(no)) return err(400, "Which order?");
        const c = await siteContent(env, site), rest = isRest(c);
        if (g !== "rz" && !pgOn(c, g)) return err(404, "That way to pay isn't switched on for this site.");
        q._bal = +q.points > 0 ? (await pointsBal(env, site, q.phone, q.otp, { email: q.email, acct: q.acct })).bal : 0;
        const bill = rest ? restBill(c, q) : Array.isArray(c?.products) ? shopBill(c, q) : { error: "This site doesn't take orders." };
        if ("error" in bill) return err(409, bill.error);
        if (invOn(c)) { const sorry = await stockCheck(env, site, c, { items: q.items }); if (sorry) return err(409, sorry); }
        if (Math.abs(bill.total - (+q.total || 0)) > 0.5) return err(409, rest ? "The menu or its prices changed while you were ordering. Refresh the page and check your cart." : "Prices or delivery charges changed while you were ordering. Refresh the page and check your cart.");
        const n: any = await env.DB.prepare("select count(*) n from payments where site = ? and created_at > ?").bind(site, new Date(Date.now() - 3600_000).toISOString()).first();
        if ((n?.n || 0) >= 200) return err(429, "Too many payments were started. Please try again in a while.");
        const amount = Math.round(bill.total * 100), cur = siteCur(c);
        if (PG[g].inr ? cur !== "INR" || amount < 100 : !PG_CUR.includes(cur) || amount < 100) return err(400, PG[g].inr ? `${PG[g].name} works for totals in rupees of ₹1 or more.` : `${PG[g].name} can't take this site's currency here.`);
        let back = ""; if (g !== "rz") { let b: URL | null = null; try { b = new URL(String(q.back || "")); } catch { /* none */ } if (!b || !/^https?:$/.test(b.protocol)) return err(400, "Where should the payment come back to?"); back = b.origin + b.pathname + "?paid=" + g + "&o=" + encodeURIComponent(no); }
        const cust = { name: oneLine(String(q.name || "")).slice(0, 100), email: String(q.email || "").trim().slice(0, 200), phone: String(q.phone || "").slice(0, 30) };
        const id = no + "-" + Array.from(crypto.getRandomValues(new Uint8Array(5)), (x) => x.toString(16).padStart(2, "0")).join("");
        let made: { ref: string; out: any };
        try { made = await pgStart(g, z, { no, id, amount, cur, back, name: siteName(c, site), cust }); } catch (e: any) { return err(e instanceof PgError && !e.keys && /needs a/.test(e.message) ? 400 : 502, e instanceof PgError ? e.message : `${PG[g].name} couldn't start the payment just now. Please try again, or choose another way to pay.`); }
        await env.DB.prepare("insert into payments (rz_order, site, order_no, amount, status, created_at) values (?, ?, ?, ?, 'created', ?)").bind(made.ref, site, no, amount, new Date().toISOString()).run();
        return json({ ...made.out, ref: made.ref, amount, currency: cur, name: siteName(c, site) });
      }
      // ---- event registrations (the Events template)
      //      GET  /reg/<site>            which ways to pay are ready, and the places left of tickets that have a limit
      //      POST /reg/pay/<gw>/<site>   starts an online payment for a registration (the amount is worked out here)
      //      POST /reg/<site>            saves a registration: free, to be paid later, or with a payment this database checks
      if (/^\/reg\/[a-z0-9][a-z0-9-]{0,59}$/.test(p) && req.method === "GET") {
        const site = p.split("/")[2]; await ensure(env);
        const c = await siteContent(env, site).catch(() => null); if (!isEvt(c)) return err(404, "Not found.");
        const pay: string[] = []; for (const g of Object.keys(PG)) if (pgOn(c, g) && pgReady(g, await getSetting(env, "site:" + site, g).catch(() => null))) pay.push(g);
        return new Response(JSON.stringify({ open: evtOpen(c), pay, left: await evtLeft(env, site, c) }), { headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
      }
      if (/^\/reg\/pay\/(rz|cf|pe|st|pp)\/[a-z0-9][a-z0-9-]{0,59}$/.test(p) && req.method === "POST") {
        const g = p.split("/")[3], site = p.split("/")[4], z = await getSetting(env, "site:" + site, g).catch(() => null);
        if (!pgReady(g, z)) return err(404, "Online payment isn't set up for this site.");
        const q = (await req.json().catch(() => ({}))) as any, no = String(q.reg_no || "");
        if (!/^REG-[A-Z0-9]{6}$/.test(no)) return err(400, "Which registration?");
        const c = await siteContent(env, site); if (!isEvt(c) || !pgOn(c, g)) return err(404, "That way to pay isn't switched on for this site.");
        const bill = evtBill(c, q); if ("error" in bill) return err(409, bill.error);
        if (!(bill.total > 0)) return err(400, "There is nothing to pay for this registration.");
        { const full = await evtFull(env, site, c, bill); if (full) return err(409, full); }
        const n: any = await env.DB.prepare("select count(*) n from payments where site = ? and created_at > ?").bind(site, new Date(Date.now() - 3600_000).toISOString()).first();
        if ((n?.n || 0) >= 200) return err(429, "Too many payments were started. Please try again in a while.");
        const amount = Math.round(bill.total * 100), cur = siteCur(c);
        if (PG[g].inr ? cur !== "INR" || amount < 100 : !PG_CUR.includes(cur) || amount < 100) return err(400, PG[g].inr ? `${PG[g].name} works for totals in rupees of ₹1 or more.` : `${PG[g].name} can't take this site's currency here.`);
        let back = ""; if (g !== "rz") { let b: URL | null = null; try { b = new URL(String(q.back || "")); } catch { /* none */ } if (!b || !/^https?:$/.test(b.protocol)) return err(400, "Where should the payment come back to?"); back = b.origin + b.pathname + "?paid=" + g + "&o=" + encodeURIComponent(no); }
        const cust = { name: oneLine(String(q.name || "")).slice(0, 100), email: String(q.email || "").trim().slice(0, 200), phone: String(q.phone || "").slice(0, 30) };
        const id = no + "-" + Array.from(crypto.getRandomValues(new Uint8Array(5)), (x) => x.toString(16).padStart(2, "0")).join("");
        let made: { ref: string; out: any };
        try { made = await pgStart(g, z, { no, id, amount, cur, back, name: siteName(c, site), cust }); } catch (e: any) { return err(e instanceof PgError && !e.keys && /needs a/.test(e.message) ? 400 : 502, e instanceof PgError ? e.message : `${PG[g].name} couldn't start the payment just now. Please try again, or choose another way to pay.`); }
        await env.DB.prepare("insert into payments (rz_order, site, order_no, amount, status, created_at) values (?, ?, ?, ?, 'created', ?)").bind(made.ref, site, no, amount, new Date().toISOString()).run();
        return json({ ...made.out, ref: made.ref, amount, currency: cur, name: siteName(c, site) });
      }
      if (/^\/reg\/[a-z0-9][a-z0-9-]{0,59}$/.test(p) && req.method === "POST") {
        const site = p.split("/")[2]; await ensure(env);
        const raw = await req.text(); if (raw.length > 20000) return err(413, "Too long.");
        let q: any; try { q = JSON.parse(raw || "{}"); } catch { return err(400, "Couldn't read the registration."); }
        // spam traps: the hidden box only robots fill in, and a form sent faster than anyone can type (a paid one has its own check)
        if (q.website || (q.took != null && Number(q.took) < 1500 && !q.pay)) return json({ ok: true });
        const data: Record<string, string> = {};
        for (const [k, v] of Object.entries(q.data || {}).slice(0, 34)) if (/^[a-z0-9][\w-]{0,39}$/i.test(k) && v != null && String(v).trim()) data[k] = String(v).slice(0, 3000);
        const no = String(data.reg_no || ""); if (!/^REG-[A-Z0-9]{6}$/.test(no)) return err(400, "The registration has no number. Refresh the page and try again.");
        if (!oneLine(data.name || "") || !EMAIL_RE.test(String(data.email || "").trim())) return err(400, "Please give your name and a valid email address.");
        const c = await siteContent(env, site).catch(() => null); if (!isEvt(c)) return err(404, "This site doesn't take registrations.");
        // The same registration sent twice (the page was opened again after paying) is kept once.
        const by = await byRef(env, no, ["instr(data, ?) > 0", `"reg_no":"${no}"`]);
        if (await env.DB.prepare(`select 1 x from enquiries where site = ? and ${by[0]} limit 1`).bind(site, by[1]).first()) return json({ ok: true, again: true });
        const bill = evtBill(c, q.cart || {}); if ("error" in bill) return err(409, bill.error);
        const hour = new Date(Date.now() - 3600_000).toISOString();
        if (+(((await env.DB.prepare("select count(*) n from enquiries where site = ? and created_at > ?").bind(site, hour).first()) as any)?.n || 0) >= 600) return err(429, "Too many registrations just now. Please try again in a few minutes.");
        const amount = Math.round(bill.total * 100), cur = siteCur(c), P = q.pay && typeof q.pay === "object" ? q.pay : null;
        // What was chosen and what it costs are written here, from the site's own tickets.
        for (const k of ["tickets", "count", "total", "payment", "pay_gw", "type"]) delete data[k];
        data.type = EVT_REG[bill.kind].label;
        if (bill.lines.length) { data.tickets = bill.lines.map((l) => (EVT_REG[bill.kind].qty || l.qty > 1 ? l.qty + " × " : "") + l.name).join(", "); data.count = String(bill.count); data._lines = JSON.stringify(bill.lines.map((l) => ({ name: l.name, qty: l.qty }))); }
        if (amount > 0) {
          data.total = pgMoney(cur || "INR", amount);
          if (P && P.rz_order) {
            // Razorpay: its own signature for the payment this database started.
            const z = await getSetting(env, "site:" + site, "rz").catch(() => null);
            const row: any = z?.secret ? await env.DB.prepare("select order_no, amount from payments where rz_order = ? and site = ?").bind(String(P.rz_order), site).first() : null;
            const want = row ? hex((await hmac(z.secret, P.rz_order + "|" + P.rz_payment)).buffer as ArrayBuffer) : "";
            if (!row || row.order_no !== no || row.amount !== amount || !want || want !== String(P.rz_sig || "")) return err(400, "The payment couldn't be confirmed. If money left your account, contact us with your registration number " + no + ".");
            await env.DB.prepare("update payments set status = 'paid' where rz_order = ?").bind(String(P.rz_order)).run();
            data._paid = "yes"; data._paid_by = `Razorpay, ${pgMoney(cur, amount)}, ${String(P.rz_payment).slice(0, 40)}`; data.payment = "Paid online"; data.pay_gw = "Razorpay";
          } else if (P && P.gw) {
            // Any other gateway: this database asks the gateway itself whether the payment it started was paid in full.
            const g = String(P.gw), ref = String(P.ref || ""), z = PG[g] && g !== "rz" && ref.startsWith(g + ":") ? await getSetting(env, "site:" + site, g).catch(() => null) : null;
            const row: any = pgReady(g, z) ? await env.DB.prepare("select order_no, amount, status from payments where rz_order = ? and site = ?").bind(ref, site).first() : null;
            if (!row || row.order_no !== no || row.amount !== amount) return err(400, "The payment couldn't be confirmed. If money left your account, contact us with your registration number " + no + ".");
            let got: { paid: boolean; id: string };
            try { got = await pgCheck(g, z, ref.slice(3), row.amount, cur); } catch { return err(502, `We couldn't reach ${PG[g].name} to confirm the payment. Please try again in a moment.`); }
            if (!got.paid) return err(402, "The payment wasn't completed, so you aren't registered yet. You can try again.");
            await env.DB.prepare("update payments set status = 'paid' where rz_order = ?").bind(ref).run();
            data._paid = "yes"; data._paid_by = `${PG[g].name}, ${pgMoney(cur, amount)}, ${got.id.slice(0, 60)}`; data.payment = "Paid online"; data.pay_gw = PG[g].name;
          } else {
            // Not paid online: allowed unless the site takes online payment only.
            let online = false; if (c.register.payLater === false) for (const g of Object.keys(PG)) if (pgOn(c, g) && pgReady(g, await getSetting(env, "site:" + site, g).catch(() => null))) { online = true; break; }
            if (online) return err(402, "Please pay online to complete your registration.");
            data.payment = oneLine(String(c.register.payLaterLabel || "Pay at the venue")).slice(0, 120);
          }
        }
        // A place that ran out while someone was filling in the form: refused unless it is already paid for (the owner sees the note).
        { const full = await evtFull(env, site, c, bill); if (full) { if (data._paid !== "yes") return err(409, full); data._full = "Paid after the places ran out: " + full; } }
        const page = String(q.page || "").slice(0, 200), made: any = await env.DB.prepare("insert into enquiries (site, data, page, created_at) values (?, ?, ?, ?) returning id").bind(site, JSON.stringify(data), page, new Date().toISOString()).first();
        // The registration is saved either way; the emails are copies, so a mail failure never fails the form.
        const rowId = made?.id, mail = Promise.all([notifyEnquiry(env, site, data, page).catch((e: any) => "Not emailed: " + String(e?.message || e).slice(0, 300)), waAlert(env, site, data).catch(() => ""), regMail(env, site, c, data).catch(() => "")])
          .then(([said, wa, rm]) => ((said || wa || rm) && rowId ? env.DB.prepare("update enquiries set data = ? where id = ? and site = ?").bind(JSON.stringify({ ...data, ...(said ? { _mail: said } : {}), ...(wa ? { _wa: wa } : {}), ...(rm ? { _rmail: rm } : {}) }), rowId, site).run() : null)).catch(() => {});
        if (ctx?.waitUntil) ctx.waitUntil(mail); else await mail;
        return json({ ok: true, paid: data._paid === "yes" });
      }
      // ---- how an order from a site's Order now page is doing, for the guest who placed it (the order's own key opens it)
      if (p.startsWith("/order/") && req.method === "GET") {
        const [, , site, no] = p.split("/"), k = u.searchParams.get("k") || "";
        if (!/^[a-z0-9][a-z0-9-]{0,59}$/.test(site || "") || !/^[A-Z0-9][A-Z0-9-]{3,29}$/.test(no || "") || !/^[a-f0-9]{16,64}$/.test(k)) return err(404, "Not found.");
        const by = await byRef(env, no, ["data like ?", `%"order_no":"${no}"%`]);
        const rows = ((await env.DB.prepare(`select status, data from enquiries where site = ? and ${by[0]} order by id desc limit 5`).bind(site, by[1]).all()).results || []) as any[];
        const hit = rows.find((r) => { try { const d = JSON.parse(r.data); return d.order_no === no && d.okey === k; } catch { return false; } });
        if (!hit) return err(404, "Not found.");
        let paid = "", track: any = null; try { const hd = JSON.parse(hit.data); paid = String(hd._paid || ""); track = trackShown(trackOf(hd)); } catch { /* none */ }
        return json({ status: hit.status, paid, ...(track ? { track } : {}) });
      }
      // ---- reviews: GET /rev/<site> gives every item's average, GET /rev/<site>?item= its approved reviews, POST adds one
      if (/^\/rev\/[a-z0-9][a-z0-9-]{0,59}$/.test(p) && req.method === "GET") {
        const site = p.split("/")[2], item = (u.searchParams.get("item") || "").slice(0, 200); await ensure(env);
        const hdr = { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" };
        if (!item) {
          const s: Record<string, [number, number]> = {}; for (const r of ((await env.DB.prepare("select item, avg(rating) a, count(*) n from reviews where site = ? and status = 'live' group by item limit 3000").bind(site).all()).results || []) as any[]) s[String(r.item)] = [Math.round(+r.a * 10) / 10, +r.n];
          return new Response(JSON.stringify({ s }), { headers: hdr });
        }
        const rows = ((await env.DB.prepare("select id, name, rating, title, body, verified, reply, created_at from reviews where site = ? and item = ? and status = 'live' order by id desc limit 60").bind(site, item).all()).results || []) as any[];
        const hist = [0, 0, 0, 0, 0]; let sum = 0; for (const r of rows) { hist[Math.max(1, Math.min(5, r.rating)) - 1]++; sum += r.rating; }
        return new Response(JSON.stringify({ n: rows.length, a: rows.length ? Math.round((sum / rows.length) * 10) / 10 : 0, hist, list: rows.slice(0, 30).map(revShown) }), { headers: hdr });
      }
      if (/^\/rev\/[a-z0-9][a-z0-9-]{0,59}$/.test(p) && req.method === "POST") {
        const site = p.split("/")[2], b = (await req.json().catch(() => ({}))) as any; await ensure(env);
        const c = await siteContent(env, site).catch(() => null); if (!revOn(c)) return err(404, "Reviews aren't switched on for this site.");
        if (String(b.hp || "")) return json({ ok: true, status: "pending" });
        const it = stockItems(c).find((x) => !x.opt && x.item === String(b.item || "")); if (!it) return err(404, "We couldn't find that item.");
        const rating = Math.round(+b.rating), body = String(b.body || "").replace(/\r/g, "").trim().slice(0, 1500), name = oneLine(String(b.name || "")).slice(0, 60), title = oneLine(String(b.title || "")).slice(0, 100), email = String(b.email || "").trim().toLowerCase().slice(0, 120);
        if (!(rating >= 1 && rating <= 5)) return err(400, "Choose a star rating.");
        if (!name) return err(400, "Please give your name.");
        if (body.length < 3) return err(400, "Please write a few words about it.");
        if (email && !EMAIL_RE.test(email)) return err(400, "That email address doesn't look right.");
        if (c.reviews.needEmail !== false && !email) return err(400, "Please give your email address (it is never shown).");
        const hour = new Date(Date.now() - 3600_000).toISOString();
        if (+(((await env.DB.prepare("select count(*) n from reviews where site = ? and created_at > ?").bind(site, hour).first()) as any)?.n || 0) >= 40) return err(429, "Too many reviews just now. Please try again in a while.");
        if (email && (await env.DB.prepare("select 1 x from reviews where site = ? and item = ? and email = ?").bind(site, it.item, email).first())) return err(409, "You've already reviewed this.");
        let verified = 0;
        if (email) { const nm = JSON.stringify(it.name.split(" · ")[0]).slice(1, -1); verified = (await env.DB.prepare("select 1 x from enquiries where site = ? and status != 'cancelled' and instr(data, '\"order_no\"') > 0 and instr(lower(data), ?) > 0 and instr(data, ?) > 0 limit 1").bind(site, email, nm).first()) ? 1 : 0; }
        if (c.reviews.buyersOnly && !verified) return err(403, "Only people who have ordered this can review it. Use the email address you ordered with.");
        const live = c.reviews.auto === true || (c.reviews.trustBuyers && verified);
        await env.DB.prepare("insert into reviews (site, item, label, name, email, rating, title, body, verified, status, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(site, it.item, it.name.slice(0, 120), name, email, rating, title, body, verified, live ? "live" : "pending", new Date().toISOString()).run();
        if (!live && c.reviews.alert !== false && (await siteMail(env, site)).RESEND_API_KEY && (await siteMail(env, site)).MAIL_FROM) { const to = await ownerTo(env, site, c, c.reviews.alertTo); if (to.length) { const mm = sendMail(await siteMail(env, site), to, `New review to approve: ${it.name}`.slice(0, 150), WRAP(`<h2 style="margin:0 0 12px;font-size:20px">New review for ${hesc(it.name)}</h2>${paras(`${"★".repeat(rating)}${"☆".repeat(5 - rating)}  ${name}${verified ? " (verified buyer)" : ""}\n${title ? title + "\n" : ""}\n${body}`)}${paras("Approve or hide it under Reviews in your site's admin page.", "margin:0 0 8px;color:#667;font-size:13px")}`)).catch(() => {}); if (ctx?.waitUntil) ctx.waitUntil(mm); else await mm; } }
        return json({ ok: true, status: live ? "live" : "pending" });
      }
      // ---- abandoned carts: the page saves the cart once an email is typed, and restores it from the link in the reminder
      if (/^\/cart\/[a-z0-9][a-z0-9-]{0,59}$/.test(p) && req.method === "POST") {
        const site = p.split("/")[2], b = (await req.json().catch(() => ({}))) as any; await ensure(env);
        const c = await siteContent(env, site).catch(() => null); if (!recOn(c)) return json({ ok: true, off: true });
        const email = String(b.email || "").trim().slice(0, 120); if (!EMAIL_RE.test(email)) return json({ ok: true });
        const lines = Array.isArray(b.lines) ? b.lines.slice(0, 40) : [], key = recKey(email);
        if (!lines.length) { await env.DB.prepare("delete from carts where site = ? and ckey = ? and status = 'open'").bind(site, key).run(); return json({ ok: true }); }
        const items = (Array.isArray(b.items) ? b.items : []).slice(0, 40).map((x: any) => ({ n: oneLine(String(x?.n || "")).slice(0, 100), q: Math.max(1, Math.min(999, Math.round(+x?.q || 1))) })).filter((x: any) => x.n);
        const total = Math.max(0, Math.min(10_000_000, +b.total || 0)), now = new Date().toISOString();
        let back = ""; try { const u = new URL(String(b.back || "")); const o = req.headers.get("origin"); if (u.protocol === "https:" && (!o || o === u.origin)) back = (u.origin + u.pathname).slice(0, 300); } catch { /* no link */ }
        const old: any = await env.DB.prepare("select status, lines, tok from carts where site = ? and ckey = ?").bind(site, key).first(); if (old?.status === "stop") return json({ ok: true });
        const ls = JSON.stringify(lines).slice(0, 12000), same = old && old.lines === ls && old.status === "open";
        await env.DB.prepare("insert into carts (site, ckey, tok, email, name, phone, lines, items, total, cur, back, status, sent, order_no, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', 0, '', ?, ?) on conflict (site, ckey) do update set name = excluded.name, phone = excluded.phone, lines = excluded.lines, items = excluded.items, total = excluded.total, back = excluded.back, status = 'open', order_no = '', " + (same ? "" : "sent = 0, sent_at = null, ") + "updated_at = " + (same ? "carts.updated_at" : "excluded.updated_at"))
          .bind(site, key, recTok(), email.toLowerCase(), oneLine(String(b.name || "")).slice(0, 80), oneLine(String(b.phone || "")).slice(0, 30), ls, JSON.stringify(items).slice(0, 6000), total, siteCur(c), back, now, now).run();
        const sw = recSweep(env, new URL(req.url).origin).catch(() => 0); if (ctx?.waitUntil) ctx.waitUntil(sw); else await sw;
        return json({ ok: true });
      }
      if (/^\/cart\/[a-z0-9][a-z0-9-]{0,59}\/[a-f0-9]{32}$/.test(p) && req.method === "GET") {
        const [, , site, tok] = p.split("/"); await ensure(env);
        const r: any = await env.DB.prepare("select lines, status from carts where site = ? and tok = ?").bind(site, tok).first();
        if (!r || r.status === "recovered") return json({ lines: [] });
        return json({ lines: JSON.parse(r.lines) });
      }
      if (/^\/cart\/[a-z0-9][a-z0-9-]{0,59}\/[a-f0-9]{32}\/stop$/.test(p) && req.method === "GET") {
        const [, , site, tok] = p.split("/"); await ensure(env);
        await env.DB.prepare("update carts set status = 'stop' where site = ? and tok = ? and status = 'open'").bind(site, tok).run();
        return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font:16px system-ui;max-width:420px;margin:15vh auto;padding:0 20px"><h2>No more reminders</h2><p>We won\'t email you about this cart again.</p>', { headers: { "Content-Type": "text/html; charset=utf-8" } });
      }
      // ---- what is left of each counted item, for the site's pages (never more than "plenty": 99)
      if (/^\/stock\/[a-z0-9][a-z0-9-]{0,59}$/.test(p) && req.method === "GET") {
        const site = p.split("/")[2]; await ensure(env);
        const s: Record<string, number> = {}; for (const r of ((await env.DB.prepare("select item, qty from stock where site = ? limit 3000").bind(site).all()).results || []) as any[]) s[String(r.item)] = Math.max(0, Math.min(99, +r.qty || 0));
        { const sw = recSweep(env, new URL(req.url).origin).catch(() => 0); if (ctx?.waitUntil) ctx.waitUntil(sw); }
        return new Response(JSON.stringify({ s }), { headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
      }
      // ---- where a shop order's parcel is: POST /track/<site> { no, k | contact | key + pass }. The order's own key
      //      opens it (the device that ordered), or the mobile number or email the order was placed with.
      if (/^\/track\/[a-z0-9][a-z0-9-]{0,59}$/.test(p) && req.method === "POST") {
        const site = p.split("/")[2], b = (await req.json().catch(() => ({}))) as any, no = String(b.no || "").trim().toUpperCase();
        if (!/^[A-Z0-9][A-Z0-9-]{3,29}$/.test(no)) return err(404, "We couldn't find that order. Check the order number.");
        // lookups by contact are counted, so order numbers can't be guessed at speed
        const byKey = /^[a-f0-9]{16,64}$/.test(String(b.k || ""));
        if (!byKey) { const now = Date.now(), k = "trk:" + site + ":" + Math.floor(now / 3600_000); const n: any = await env.DB.prepare("select tries from otps where k = ?").bind(k).first(); if ((n?.tries || 0) >= 400) return err(429, "Too many lookups just now. Please try again later.");
          await env.DB.prepare("insert into otps (k, hash, expires, tries, sent) values (?, '', ?, 1, ?) on conflict (k) do update set tries = tries + 1").bind(k, now + 2 * 3600_000, now).run(); }
        const by = await byRef(env, no, ["data like ?", `%"order_no":"${no}"%`]);
        const rows = ((await env.DB.prepare(`select id, status, data, created_at from enquiries where site = ? and ${by[0]} order by id desc limit 5`).bind(site, by[1]).all()).results || []) as any[];
        let cust = ""; if (b.key && (await custOk(env, site, String(b.key), b.pass))) cust = String(b.key);
        const same = (d: any, c: string) => { const e = emailKey(c); if (e) return e === emailKey(d.email); const a = String(c || "").replace(/\D/g, ""), z = String(d.phone || "").replace(/\D/g, ""); return a.length >= 8 && z.length >= 8 && a.slice(-10) === z.slice(-10); };
        let hit: any = null, hd: any = null;
        for (const r of rows) { let d: any; try { d = JSON.parse(r.data); } catch { continue; } if (d.order_no !== no) continue; if ((byKey && d.okey === b.k) || (cust && same(d, cust.includes("@") ? cust : "+" + cust)) || (b.contact && same(d, String(b.contact)))) { hit = r; hd = d; break; } }
        if (!hit) return err(404, "We couldn't find that order. Check the order number and the mobile number or email you ordered with.");
        const got = await shipLive(env, site, hit.id, hd, hit.status).catch(() => ({ live: null, why: "", status: hit.status }));
        const L = got.live;
        return json({ no, at: hit.created_at, status: got.status, total: String(hd.total || ""), paid: hd._paid === "yes", track: trackShown(trackOf(hd)), live: L ? { st: L.st, label: TRACK_STATES[L.st] || L.say, say: L.say, eta: L.eta, link: L.link, ev: L.ev, at: L.t } : null });
      }
      // ---- Design yourself (public): the Studio's own look, the request, and the text writer. See dqSubmit / dqWrite.
      if (p.startsWith("/sb/") && req.method === "GET") {
        const id = studioId(p.split("/")[2] || ""); const b = id ? await dqBrand(env, id) : null; if (!b) return err(404, "Not found.");
        return new Response(JSON.stringify(b), { headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "public, max-age=60" } });
      }
      // A details sheet the owner uploaded for one type of website (Settings → Design yourself), to download and fill in.
      if (p.startsWith("/sd/") && req.method === "GET") {
        const [, , sid, file] = p.split("/"), id = studioId(sid || ""), m = /^(business|restaurant|portfolio|store|events)\.(txt|xlsx|docx)$/.exec(decodeURIComponent(file || ""));
        if (!id || !m) return err(404, "Not found.");
        const idx = await studioIndex(env, id), name = idx?.prefs?.design?.refs?.[m[1]]?.[m[2]];
        const f = typeof name === "string" && name ? await readFile(env, "studio:" + id, `studio-assets/diy-docs/${m[1]}.${m[2]}`) : null;
        if (!f) return err(404, "That sheet isn't there any more.");
        const type = m[2] === "txt" ? "text/plain; charset=utf-8" : m[2] === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        const safe = String(name).replace(/[^\w .()-]+/g, "_").replace(/\.(txt|xlsx|docx)$/i, "") + "." + m[2];
        return new Response(f.bytes, { headers: { ...cors, "Content-Type": type, "Content-Disposition": `attachment; filename="${safe}"`, "Cache-Control": "public, max-age=60" } });
      }
      if (p.startsWith("/dq/photo-used/") && req.method === "POST") { const id = studioId(p.split("/")[3] || ""); if (!id) return err(404, "Not found."); return dqPhotoUsed(env, id, req); }
      if (p.startsWith("/dq/image/") && req.method === "POST") { const id = studioId(p.split("/")[3] || ""); if (!id) return err(404, "Not found."); return dqImage(env, id, req); }
      if (p.startsWith("/dq/understand/") && req.method === "POST") { const id = studioId(p.split("/")[3] || ""); if (!id) return err(404, "Not found."); return dqUnderstand(env, id, req); }
      if (p.startsWith("/dq/read/") && req.method === "POST") { const id = studioId(p.split("/")[3] || ""); if (!id) return err(404, "Not found."); return dqRead(env, id, req); }
      if (/^\/dq\/otp\/(send|check)\/[a-z0-9-]+$/.test(p) && req.method === "POST") { const id = studioId(p.split("/")[4] || ""); if (!id) return err(404, "Not found."); return dqOtp(env, id, req, p.startsWith("/dq/otp/send/")); }
      if (p.startsWith("/dq/draft/") && req.method === "POST") { const id = studioId(p.split("/")[3] || ""); if (!id) return err(404, "Not found."); return dqDraft(env, id, req); }
      if (p.startsWith("/dq/write/") && req.method === "POST") { const id = studioId(p.split("/")[3] || ""); if (!id) return err(404, "Not found."); return dqWrite(env, id, req); }
      if (/^\/dq\/[a-z0-9-]+$/.test(p) && !["/dq/list", "/dq/get", "/dq/status", "/dq/delete", "/dq/drafts", "/dq/draft-delete"].includes(p) && req.method === "POST") { const id = studioId(p.split("/")[2]); if (!id) return err(404, "Not found."); return dqSubmit(env, id, req, ctx); }

      if (p.startsWith("/enquire/") && req.method === "POST") {
        const site = p.split("/")[2]; if (!/^[a-z0-9][a-z0-9-]{0,59}$/.test(site)) return err(404, "Not found.");
        const raw = await req.text(); if (raw.length > 20000) return err(413, "Too long.");
        const q = JSON.parse(raw || "{}");
        // spam traps: the hidden box only robots fill in, and a form sent faster than anyone can type (orders have their own checks)
        if (q.website || (q.took != null && Number(q.took) < 1500 && !(q.data && q.data.order_no))) return json({ ok: true });
        const data: Record<string, string> = {};
        for (const [k, v] of Object.entries(q.data || {}).slice(0, 25)) if (/^[a-z0-9][\w-]{0,39}$/i.test(k) && v != null && String(v).trim()) data[k] = String(v).slice(0, 5000);
        if (!Object.keys(data).length) return err(400, "The form was empty.");
        let who = ""; // the signed-in customer's key, when there is one
        if (data.order_no) {
          // The guest's mobile number, proved with a code on WhatsApp, when the site asks for that.
          const sc0 = await siteContent(env, site).catch(() => null), cw = await codeWays(env, site, sc0), A = acctOf(env, sc0, cw);
          // A signed-in customer: their pass stands for the number or address they signed in with.
          const me = await custWho(env, site, A, cw.cc, data.phone, data.email, data.acct_token); delete data.acct_token; who = me.key;
          if (me.kind === "phone") data._phone = "Verified (signed in)"; if (me.kind === "email") data._email = "Verified (signed in)";
          if (cw.any && me.kind !== "phone") {
            const num = waNum(data.phone, cw.cc), [exp, sig, how] = String(data.otp_token || "").split(".");
            const proved = !!num && +exp > Date.now() && sig === b64u(await hmac(env.SECRET, "otp:" + site + ":" + num + ":" + exp));
            // Required where the site asks every guest for it; otherwise taken when given (a guest who verified to spend points).
            if (proved) data._phone = how === "s" ? "Verified by SMS" : "Verified on WhatsApp"; else if (cw.need) return err(403, "Please verify your mobile number first.");
          }
          delete data.otp_token;
          // an email address that must be proved (the site's own setting): the proof, or the pass given when the code could not be sent
          { const em = emailKey(data.email), tk = String(data.email_token || ""); delete data.email_token;
            const skip = tk.startsWith("s:"), [exp, sig] = (skip ? tk.slice(2) : tk).split("."), good = !!em && +exp > Date.now() && sig === b64u(await hmac(env.SECRET, (skip ? "eskip:" : "eotp:") + site + ":" + em + ":" + exp));
            if (em && me.kind !== "email" && emailCheckOn(env, sc0)) {
              if (!good) return err(403, "Please verify your email address first.");
              data._email = skip ? "Not verified: the code could not be sent" : "Verified by a code";
            }
            // Where customers must sign in before ordering: a pass, or (email only) the note that no code could be sent to them.
            if (A && !who && !(A.email && good && skip)) return err(403, "Please sign in before placing the order."); }
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
          // Any other gateway: this database asks the gateway itself whether the payment it started was paid in full.
          if (data.pay_gw || data.pay_ref) {
            const g = String(data.pay_gw || ""), ref = String(data.pay_ref || ""), z = PG[g] && g !== "rz" && ref.startsWith(g + ":") ? await getSetting(env, "site:" + site, g).catch(() => null) : null;
            const row: any = pgReady(g, z) ? await env.DB.prepare("select order_no, amount, status from payments where rz_order = ? and site = ?").bind(ref, site).first() : null;
            if (!row || row.order_no !== data.order_no) return err(400, "The payment couldn't be confirmed. If money left your account, contact us with your order number.");
            // The same paid order sent twice (the page was opened again) is kept once.
            if (row.status === "paid") return json({ ok: true, again: true });
            const cur = siteCur(await siteContent(env, site)); let got: { paid: boolean; id: string };
            try { got = await pgCheck(g, z, ref.slice(3), row.amount, cur); } catch { return err(502, `We couldn't reach ${PG[g].name} to confirm the payment. Please try again in a moment.`); }
            if (!got.paid) return err(402, "The payment wasn't completed, so the order isn't placed yet. You can try again.");
            await env.DB.prepare("update payments set status = 'paid' where rz_order = ?").bind(ref).run();
            data._paid = "yes"; data._paid_by = `${PG[g].name}, ${pgMoney(cur, row.amount)}, ${got.id.slice(0, 60)}`; data.pay_gw = PG[g].name; delete data.pay_ref;
          }
        }
        // Inventory: the order's items leave stock now. An unpaid order that asks for more than is left is refused; one
        // already paid for is kept, and the shortfall noted for the owner.
        let lowNow: { name: string; qty: number }[] = [], stockC: any = null;
        if (data.order_no && q.cart && typeof q.cart === "object") {
          stockC = await siteContent(env, site).catch(() => null);
          if (invOn(stockC)) { const paid = data._paid === "yes", tk = await stockTake(env, site, stockC, q.cart, String(data.order_no), paid); if (tk.short && !paid) return err(409, tk.short); if (tk.taken.length) data._stock = JSON.stringify(tk.taken); if (tk.short) data._stock_short = "Not enough stock when this paid order came in. " + tk.short.replace(/ (Change|Remove).*$/, ""); lowNow = tk.low; }
        }
        // A restaurant that uses Petpooja: the order is handed to it now, and its answer is kept with the order.
        if (data.order_no && q.cart && typeof q.cart === "object") q.cart._bal = data._phone && +q.cart.points > 0 ? Math.max(0, +((await env.DB.prepare("select points from customers where site = ? and ckey = ?").bind(site, waNum(data.phone, (await codeWays(env, site)).cc)).first()) as any)?.points || 0) : 0;
        if (data.order_no && q.cart && typeof q.cart === "object") {
          const pz = await getSetting(env, "site:" + site, "pos").catch(() => null);
          if (posReady(pz)) { const pc = await siteContent(env, site); if (isRest(pc)) data._pos = await posSend(env, site, pz, pc, q.cart, data, u.origin); }
        }
        // The customer is kept, and the order's points settled, with the order.
        if (data.order_no && q.cart) { try { const it = orderItems(await siteContent(env, site), q.cart); if (it.length) { const sc2 = await siteContent(env, site); if (isRest(sc2)) { const rb = restBill(sc2, q.cart); if (!("error" in rb) && rb.units && rb.units.length === it.length) { it.forEach((x: any, i: number) => { x.p = rb.units![i]; }); data._bill = JSON.stringify({ ...rb.parts, total: rb.total }); } } data._items = JSON.stringify(it).slice(0, 6000); } } catch { /* the order's text is enough */ } }
        if (data.order_no) { const said = await custOrder(env, site, await siteContent(env, site), data, q.cart, who).catch(() => ""); if (said) data._points = said; }
        const made: any = await env.DB.prepare("insert into enquiries (site, data, page, created_at) values (?, ?, ?, ?) returning id").bind(site, JSON.stringify(data), String(q.page || "").slice(0, 200), new Date().toISOString()).first();
        // The enquiry is saved either way; the email is a copy, so a mail failure never fails the form. What happened
        // to the email is noted on the enquiry (_mail: keys starting with "_" never come from the visitor).
        const rowId = made?.id;
        if (data.order_no && EMAIL_RE.test(String(data.email || ""))) await env.DB.prepare("update carts set status = 'recovered', order_no = ?, updated_at = ? where site = ? and ckey = ? and status != 'recovered'").bind(String(data.order_no).slice(0, 30), new Date().toISOString(), site, recKey(String(data.email))).run().catch(() => {});
        if (lowNow.length) { const lm = stockLowMail(env, site, stockC, lowNow).catch(() => {}); if (ctx?.waitUntil) ctx.waitUntil(lm); else await lm; }
        const mail = Promise.all([notifyEnquiry(env, site, data, String(q.page || "").slice(0, 200)).catch((e: any) => "Not emailed: " + String(e?.message || e).slice(0, 300)), waAlert(env, site, data).catch(() => ""), data.order_no ? orderMail(env, site, "placed", data).catch(() => "") : Promise.resolve("")])
          .then(([said, wa, om]) => ((said || wa || om) && rowId ? env.DB.prepare("update enquiries set data = ? where id = ? and site = ?").bind(JSON.stringify({ ...data, ...(said ? { _mail: said } : {}), ...(wa ? { _wa: wa } : {}), ...(om ? { _omail: om } : {}) }), rowId, site).run() : null)).catch(() => {});
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
          const buf = await r2.arrayBuffer(); if (buf.byteLength > 20 * 1024 * 1024) return json({ error: "That picture is over 20 MB." });
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
      // Role Management: Administrators (and a Studio Partner) may do everything; the other roles what their privileges say.
      const admin = isAdminRole(role), inStudio = scope.startsWith("studio:");
      let privCache: Record<string, boolean> | null = null;
      const can = async (k: string) => admin || !!(privCache ||= await privsFor(env, scope, role))[k];
      if (p === "/roles" && req.method === "GET") {
        const rows = admin ? ((await env.DB.prepare("select role, privs, updated_at, updated_by from role_mgmt where scope = ?").bind(scope).all().catch(() => ({ results: [] as any[] }))).results || []) : [];
        const saved: any = {}; for (const r of rows as any[]) { try { saved[r.role] = JSON.parse(r.privs); } catch { /* standard */ } }
        const roles: any = {}; for (const r of ROLE_IDS) roles[r] = privsOf(r, saved[r]);
        const ready = !!(await env.DB.prepare("select 1 from sqlite_master where type = 'table' and name = 'role_mgmt'").first().catch(() => null));
        return json({ me: { email, role, key: userKey(email), privs: await privsFor(env, scope, role) }, ready, ...(admin ? { roles, members: (await env.DB.prepare("select email, role, added_at from members where scope = ? order by email").bind(scope).all()).results || [], owners: inStudio ? ((await env.DB.prepare("select project, email from project_owners where scope = ?").bind(scope).all().catch(() => ({ results: [] as any[] }))).results || []) : [] } : {}) });
      }
      if (p === "/roles" && req.method === "POST") {
        if (role !== "owner") return err(403, "Only an Administrator can change Role Management.");
        const b = (await req.json().catch(() => ({}))) as any, r = String(b.role || "");
        if (!ROLE_IDS.includes(r) || r === "owner") return err(400, "Choose a role other than Administrator: Administrators can always do everything.");
        await env.DB.prepare("insert into role_mgmt (scope, role, privs, updated_at, updated_by) values (?, ?, ?, ?, ?) on conflict (scope, role) do update set privs = excluded.privs, updated_at = excluded.updated_at, updated_by = excluded.updated_by")
          .bind(scope, r, JSON.stringify(cleanPrivs(r, b.privs)), new Date().toISOString(), email).run();
        return json({ ok: true, privs: privsOf(r, cleanPrivs(r, b.privs)) });
      }
      // Whose a project is, set by an Administrator (handing a project to someone, or taking it back with email "").
      if (p === "/roles/project" && req.method === "POST") {
        if (role !== "owner" || !inStudio) return err(403, "Only an Administrator can hand a project to someone.");
        const b = (await req.json().catch(() => ({}))) as any, pr = String(b.project || ""), to = String(b.email || "").trim().toLowerCase();
        if (!/^[\w-]{1,80}$/.test(pr)) return err(400, "Which project?");
        if (!to) await env.DB.prepare("delete from project_owners where scope = ? and project = ?").bind(scope, pr).run();
        else { if (!(await roleOf(env, scope, to))) return err(400, to + " can't sign in to this Studio yet. Add them first.");
          await env.DB.prepare("insert into project_owners (scope, project, email, at) values (?, ?, ?, ?) on conflict (scope, project) do update set email = excluded.email, at = excluded.at").bind(scope, pr, to, new Date().toISOString()).run(); }
        return json({ ok: true });
      }

      // ---- an email template tried out: the draft in the editor, with made-up details, sent only to the person signed in
      if (p === "/mail/test" && req.method === "POST") {
        if (!scope.startsWith("site:")) return err(400, "Test emails are for a site's templates.");
        const b = (await req.json().catch(() => ({}))) as any, kind = String(b.kind || ""), K = MAIL_KINDS[kind];
        if (!K) return err(400, "Unknown email.");
        const site = scope.slice(5), c = await siteContent(env, site).catch(() => null), vars = { ...K.sample, site: siteName(c, site), ...(kind === "signin" ? { email } : {}) };
        const tpl = String(typeof b.tpl === "string" && b.tpl.trim() ? b.tpl : K.std).slice(0, MAIL_TPL_MAX);
        // At most 10 test emails per person in 10 minutes.
        const tk = "mailtest:" + email, hit: any = await env.DB.prepare("select tries, sent from codes where email = ?").bind(tk).first(), fresh = !hit || Date.now() - (hit.sent || 0) > 600_000;
        if (!fresh && hit.tries >= 10) return err(429, "That's 10 test emails in ten minutes. Wait a few minutes and try again.");
        await env.DB.prepare("insert into codes (email, hash, expires, tries, sent) values (?, '', 0, 1, ?) on conflict (email) do update set tries = ?, sent = ?").bind(tk, Date.now(), fresh ? 1 : hit.tries + 1, fresh ? Date.now() : hit.sent).run();
        const subject = "[Test] " + (oneLine(fill(String(b.subject || K.subject), vars)).slice(0, 140) || K.label);
        await sendMail(await siteMail(env, site), email, subject, mailEmail(tpl, vars, sampleBlocks(kind), WRAP));
        return json({ ok: true, to: email });
      }

      // ---- connections (the owner's own AI API, WhatsApp, Razorpay): owners set them; the keys are never sent back
      if (p === "/set" || p === "/set/test" || p === "/set/wa" || p === "/set/sms") {
        if (role !== "owner") return err(403, "Only an owner can change connections.");
        // SMS: a test code to the owner's own phone, with what is saved.
        if (p === "/set/sms" && req.method === "POST") {
          const b = (await req.json()) as any, z = await getSetting(env, scope, "sms"), to = waNum(b.to, z?.cc);
          if (!smsReady(z)) return json({ error: "Switch SMS on, fill in the boxes and press Save first." });
          if (!to) return json({ error: "Enter the mobile number to send the test to." });
          try { const own = !(await smsSend(z, to, "123456", env.NAME || "your site")); return json({ ok: true, own }); } catch (e: any) { return json({ error: String(e?.message || e).slice(0, 300) }); }
        }
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
        const b = (await req.json()) as any, name = String(b.name || ""), S = SETTINGS[name];
        // Pinterest needs no key, so it is not a saved connection: only its feed is tried, for the wall's settings screen.
        if (p === "/set/test" && name === "pin") { const r = await pinMedia(String(b.pin || ""), 6); return r.items ? json({ ok: true, said: r.items.length + (r.items.length === 1 ? " pin" : " pins") }) : json({ error: r.error }); }
        if (!S) return err(400, "Unknown connection.");
        if (p === "/set/test" && name.startsWith("tk_")) {
          const id = name.slice(3), z = await getSetting(env, scope, name); if (!trackerReady(id, { ...z, on: true })) return json({ error: "Fill in the boxes and press Save first." });
          try { const live = await trackLive(id, z, String(b.awb || ""), String(b.courier || (TRACKERS[id].kind === "courier" ? id : "other"))); return json({ ok: true, live: { st: live.st, label: TRACK_STATES[live.st] || live.say, say: live.say, eta: live.eta, ev: live.ev.slice(0, 5), n: live.ev.length } }); }
          catch (e: any) { return json({ error: e instanceof TrackError ? e.message : "The tracking service's answer couldn't be read." }); }
        }
        if (p === "/set/test") {
          if (name === "un") { const c = await getSetting(env, scope, "un"); if (!c?.key) return json({ error: "Save the access key first." }); const r = await unsplashFind(String(c.key), "coffee shop", 1); return r.photos ? json({ ok: true, said: `a photo by ${r.photos[0].by || "an Unsplash photographer"}` }) : json({ error: r.error }); }
          if (name === "ig") { const c = await getSetting(env, scope, "ig"); if (!c?.token) return json({ error: "Save the access token first." }); const h = igHandle(b.handle); if (b.handle && !h) return json({ error: "That doesn't look like an Instagram handle." }); const r = await igMedia(String(c.token), 6, h, !!h && !/^EAA/.test(String(c.token))); return r.items ? json({ ok: true, said: r.items.length + (r.items.length === 1 ? " post" : " posts") + (h ? " from @" + h : "") }) : json({ error: r.error }); }
          if (name !== "ai") return err(400, "Nothing to test.");
          const c = await getSetting(env, scope, "ai"); if (!c?.key || !c.model || !publicUrl(String(c.base || "").trim())) return json({ error: "Fill in the address, the model and the key first." });
          try { const r: any = await customAI(c).run("", { messages: [{ role: "user", content: "Reply with the single word: ready" }], max_tokens: 20, temperature: 0 }); return json({ ok: true, said: String(r.response || "").trim().slice(0, 80) }); }
          catch (e: any) { return json({ error: String(e?.message || e).slice(0, 300) }); }
        }
        if (b.value == null) { await putSetting(env, scope, name, null); return json({ ok: true }); }
        if (name === "mail" && !scope.startsWith("site:")) return err(400, "Site email is set per site.");
        const old = (await getSetting(env, scope, name)) || {}, v: any = {};
        for (const k of S.text) v[k] = String(b.value[k] ?? old[k] ?? "").slice(0, 3000).trim();
        for (const k of S.flags) v[k] = b.value[k] == null ? !!old[k] : !!b.value[k];
        // A secret left empty keeps the one already saved.
        for (const k of S.secret) v[k] = String(b.value[k] || "").trim().slice(0, 600) || old[k] || "";
        // Which Resend a site uses (the Studio's or its own) is the Studio owner's choice, not the site owner's.
        if (name === "mail") {
          // The Studio's owner decides. A site on its own database (one with no Studio in it) has no one above its owner.
          const so = await env.DB.prepare("select 1 x from members where email = ? and scope like 'studio:%' and role = 'owner' limit 1").bind(email).first();
          const hasStudio = await env.DB.prepare("select 1 x from members where scope like 'studio:%' limit 1").first();
          if (!so && hasStudio && v.on !== !!old.on) return err(403, `Only the Studio's owner can switch this site's Resend. You are signed in as ${email}, who isn't an owner of this database's Studio. Sign in to the Studio with its owner's email.`);
          if (v.from && !EMAIL_RE.test(v.from.replace(/^.*<([^<>]+)>\s*$/, "$1"))) return err(400, "The sender should look like Name <codes@your-domain.com>.");
          if (v.key && !/^re_\S{8,}$/.test(v.key)) return err(400, "A Resend API key starts with re_.");
        }
        if (name === "ai" && v.base && !publicUrl(v.base)) return err(400, "The API address must be a public https:// address.");
        if (name.startsWith("tk_") && v.url && !publicUrl(v.url.replace(/\{(awb|courier)\}/g, "x"))) return err(400, "The tracking address must be a public https:// address.");
        await putSetting(env, scope, name, v);
        return json({ ok: true, value: maskSetting(name, v) });
      }
      // In a Studio, someone who is not an Administrator has their own space (users/<them>/) and their own projects;
      // the rest is read-only for them, and other people's spaces and projects are closed.
      const limited = inStudio && !admin, sharedOk = limited ? await can("shared") : true;
      const siteEdit = scope.startsWith("site:") && !admin ? await can("edit") : true;
      if (p === "/f/list") {
        const pre = u.searchParams.get("prefix") || "";
        const rows = (await env.DB.prepare("select path from files where scope = ? and substr(path, 1, ?) = ? order by path").bind(scope, pre.length, pre).all()).results || [];
        let paths = rows.map((r: any) => r.path as string);
        if (limited) {
          const mine = new Set((((await env.DB.prepare("select project from project_owners where scope = ? and email = ?").bind(scope, email).all().catch(() => ({ results: [] as any[] }))).results || []) as any[]).map((r) => r.project));
          paths = paths.filter((x) => { const r = fileRule(x, userKey(email), sharedOk); return r.project ? mine.has(r.project) : !!r.read; });
        }
        return json(paths);
      }
      const path = u.searchParams.get("path") || "";
      if (limited && (p === "/f/meta" || p === "/f/get")) {
        const ok = await fileMay(env, scope, email, path, sharedOk, false);
        if (!ok) return p === "/f/meta" ? json(null) : err(404, "Not found.");
        if (ok === "strip" && p === "/f/get") {
          // The shared list, without anyone's projects (each person's own are in their own space).
          const f = await readFile(env, scope, path); if (!f) return err(404, "Not found.");
          let o: any = {}; try { o = JSON.parse(new TextDecoder().decode(f.bytes)); } catch { /* empty */ }
          o.projects = []; delete o.prefs;
          return new Response(JSON.stringify(o), { headers: { ...cors, "Content-Type": "application/json", "x-sha": f.sha, "x-updated": f.updated_at } });
        }
      }
      if (limited && p === "/f/put" && !(await fileMay(env, scope, email, path, sharedOk, true))) return err(403, path === "studio.json" ? "Only an Administrator can change this Studio-wide setting." : "Your role can't change this. Ask an Administrator (Settings → Role Management).");
      if (!siteEdit && (p === "/f/put" || p === "/f/delete")) return err(403, "Your role can't change this site's content. Ask its Administrator (Role Management).");
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
        const { paths } = (await req.json()) as any; let list = (Array.isArray(paths) ? paths : []).filter(pathOk).slice(0, 500) as string[];
        if (limited) {
          const okd: string[] = []; const seen: Record<string, boolean> = {};
          for (const x of list) { const r = fileRule(x, userKey(email), sharedOk); const k = r.project ? "p:" + r.project : x; if (!(k in seen)) seen[k] = r.project ? !!(await env.DB.prepare("select 1 from project_owners where scope = ? and project = ? and email = ?").bind(scope, r.project, email).first().catch(() => null)) : r.write; if (seen[k]) okd.push(x); }
          if (okd.length !== list.length) return err(403, "Your role can't delete some of these files.");
          list = okd;
        }
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
            if (op === "mail") {
              // The site's own Resend key and sender, left as a pending row that the site's database encrypts and adopts on its next email.
              if (!/^re_\S{8,}$/.test(String(b.key || ""))) return err(400, "That doesn't look like a Resend API key (it starts with re_).");
              const from = String(b.from || "").trim(); if (!/^[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+$|<[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+>$/.test(from)) return err(400, "Enter a sender like Name <hello@your-domain.com>.");
              await q("create table if not exists settings (scope text not null, name text not null, value text not null, updated_at text not null, primary key (scope, name))");
              await q("insert into settings (scope, name, value, updated_at) values (?, 'mail!pending', ?, ?) on conflict (scope, name) do update set value = excluded.value, updated_at = excluded.updated_at", [S2, JSON.stringify({ key: String(b.key), from }), new Date().toISOString()]);
              return json({ db: dbId, ok: true });
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
      // ---- Connect once, use on every device: the Studio's own Cloudflare work (new sites, the database, domains,
      // updates) made with the tokens kept here, for the Studio's OWNERS only, signed in by email code. Limited to
      // Workers, D1 and zones (domains and DNS): no tokens, members, billing or OAuth clients. A site's own owners
      // never reach this; they keep to /cf below.
      if (p === "/cfa/accounts" || p === "/cfa") {
        if (!scope.startsWith("studio:")) return err(400, "Only for the Studio's own scope.");
        if (role !== "owner") return err(403, "Only the Studio's owners can use its Cloudflare accounts.");
        const tokenFor = (a: string) => otherToken(env, a) || (a && a === env.CF_ACCOUNT ? env.CF_TOKEN || "" : "");
        if (p === "/cfa/accounts" && req.method === "GET") {
          // The accounts a token is kept for, with their names as Cloudflare gives them (the main one first).
          const ids = [...(env.CF_TOKEN && env.CF_ACCOUNT ? [env.CF_ACCOUNT] : []), ...otherAccounts(env).map((x) => x.id)];
          const out: { id: string; name: string }[] = [];
          for (const id of ids) {
            if (out.some((x) => x.id === id)) continue;
            let name = otherAccounts(env).find((x) => x.id === id)?.name || "";
            if (!name) { try { const r = await fetch("https://api.cloudflare.com/client/v4/accounts/" + id, { headers: { Authorization: "Bearer " + tokenFor(id) } }); name = String((((await r.json().catch(() => null)) as any)?.result?.name) || ""); } catch { /* shown by its id */ } }
            out.push({ id, name: (name || "Cloudflare account " + id.slice(0, 6)).slice(0, 80) });
          }
          return json({ accounts: out, main: env.CF_TOKEN && env.CF_ACCOUNT ? env.CF_ACCOUNT : null });
        }
        if (p === "/cfa" && req.method === "POST") {
          const q = (await req.json()) as any, method = String(q.method || "GET").toUpperCase(), path = String(q.path || "");
          if (!/^\/[\w\-./?=&%:,]*$/.test(path) || path.includes("..") || !["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) return err(400, "Not a Cloudflare call the Studio makes.");
          const inAcc = /^\/accounts\/([\w-]{1,64})\/(workers|d1)\//.exec(path), zone = /^\/zones(\/|\?|$)/.test(path);
          if (!inAcc && !zone) return err(403, "The database only passes on calls about Workers, D1 and domains.");
          const A = inAcc ? inAcc[1] : /^[\w-]{1,64}$/.test(String(q.acct || "")) ? String(q.acct) : env.CF_ACCOUNT || "";
          const tok = tokenFor(A);
          if (!tok) return err(501, "No Cloudflare token for that account is kept on this database. Connect it once on a device (Settings → Hostings) and turn on Publish from any device.");
          // Uploading a site's files carries its own short upload token, as Cloudflare asks.
          const jwt = /^\/accounts\/[\w-]+\/workers\/assets\/upload/.test(path) && /^[\w.~+/=-]{8,4096}$/.test(String(q.jwt || "")) ? String(q.jwt) : "";
          const body = q.body64 ? Uint8Array.from(atob(String(q.body64)), (c) => c.charCodeAt(0)) : q.body != null ? String(q.body) : undefined;
          const r = await fetch("https://api.cloudflare.com/client/v4" + path, { method, headers: { Authorization: "Bearer " + (jwt || tok), ...(q.contentType ? { "Content-Type": String(q.contentType) } : {}) }, body: method === "GET" ? undefined : body });
          return json({ status: r.status, body: await r.text() });
        }
        return err(404, "Not found.");
      }
      // ---- publish from any device: the calls a site's (or Studio's) pages need, made with the token kept here.
      // Only Workers registered to this scope (the `workers` table, written by the Studio with the token), only by
      // its owners and partners, and only with no bindings but its own files, so nobody gets more than the pages.
      if (p === "/cf" && req.method === "POST") {
        if (!(await can("publishCf"))) return err(403, "Your role can't publish to Cloudflare. Ask an Administrator (Role Management).");
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
      // ---- Email sign-in for a GitHub Pages site's admin page: the Studio links the site to its repository and names who may sign in.
      // After this the site's people sign in here with an emailed code and save through /gh (the kept token), with no GitHub token on their devices.
      if (p === "/site/link" && req.method === "POST") {
        if (!inStudio || !(await can("publishGh"))) return err(403, "Your role can't publish to GitHub. Ask an Administrator (Role Management).");
        if (!env.GH_TOKEN) return err(501, "This database keeps no GitHub token, so it can't save for the site's people. Turn on Publish from any device (Settings → Hostings).");
        const b = (await req.json().catch(() => ({}))) as any, site = String(b.site || ""), repo = String(b.repo || "").toLowerCase();
        if (!/^[\w-]{3,80}$/.test(site) || !/^[\w.-]+\/[\w.-]+$/.test(repo)) return err(400, "Which site and repository?");
        const studio = scope.slice(7), had: any = await env.DB.prepare("select studio from site_repos where site = ?").bind(site).first();
        if (had && had.studio !== studio) return err(403, "This site is linked to another Studio.");
        // The site must be this Studio's to link: one of its repositories, or a site nobody has people in yet.
        const registered = !!(await env.DB.prepare("select 1 from repos where repo = ? and scope = ?").bind(repo, scope).first());
        // Someone who isn't an Administrator links only repositories this Studio already publishes: the kept token may reach others.
        if (!admin && !registered) return err(403, "Only an Administrator can set up email sign-in for a repository this Studio hasn't published through its database yet.");
        const mine = !!had || registered || !(await env.DB.prepare("select 1 from members where scope = ? limit 1").bind("site:" + site).first());
        if (!mine) return err(403, "This site already has its own people. An Administrator of the site can link it.");
        await env.DB.prepare("insert into site_repos (site, repo, studio, at) values (?, ?, ?, ?) on conflict (site) do update set repo = excluded.repo, at = excluded.at").bind(site, repo, studio, new Date().toISOString()).run();
        const mails = [...new Set([email, ...(Array.isArray(b.emails) ? b.emails : [])].map((x: any) => String(x || "").trim().toLowerCase()).filter(emailOk))].slice(0, 20);
        for (const m of mails) await env.DB.prepare("insert into members (scope, email, role) values (?, ?, 'owner') on conflict (scope, email) do nothing").bind("site:" + site, m).run();
        return json({ ok: true, people: mails });
      }
      // ---- GitHub Pages sites from any device: calls on repositories registered to this scope, with the kept token.
      if (p === "/gh" && req.method === "POST") {
        if (!env.GH_TOKEN) return err(501, "This database can't reach GitHub: no GitHub token is kept here.");
        // A site's own people (its GitHub Pages admin page, signed in by email) change that site's repository; a Studio's people publish its sites.
        const forSite = scope.startsWith("site:");
        if (forSite ? !(await can("edit")) : !(await can("publishGh"))) return err(403, forSite ? "Your role can't change this site. Ask its Administrator (Role Management)." : "Your role can't publish to GitHub. Ask an Administrator (Role Management).");
        const q = (await req.json()) as any, repo = String(q.repo || "").toLowerCase(), path = String(q.path || ""), method = String(q.method || "GET").toUpperCase();
        if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || (path && !/^\/[\w\-./%?=&,~]*$/.test(path)) || path.includes("..") || !["GET", "PUT", "POST", "PATCH", "DELETE"].includes(method)) return err(400, "Not a GitHub call publishing needs.");
        if (forSite) { if (!(await env.DB.prepare("select 1 from site_repos where site = ? and repo = ?").bind(scope.slice(5), repo).first().catch(() => null))) return err(403, "This site's repository isn't linked to its email sign-in. Publish the site again from the Studio."); }
        else if (!(await env.DB.prepare("select 1 from repos where repo = ? and scope = ?").bind(repo, scope).first())) return err(403, `The repository ${repo} isn't registered to ${scope}. Turn on Publish from any device again from a Studio that has the GitHub token.`);
        const r = await fetch("https://api.github.com/repos/" + repo + path, { method, headers: { Authorization: "Bearer " + env.GH_TOKEN, Accept: q.raw ? "application/vnd.github.raw+json" : "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "site-studio-db", ...(q.body != null ? { "Content-Type": "application/json" } : {}) }, body: method === "GET" ? undefined : q.body != null ? String(q.body) : undefined });
        const bytes = new Uint8Array(await r.arrayBuffer());
        let bin = ""; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return json({ status: r.status, b64: btoa(bin), type: r.headers.get("content-type") || "" });
      }
      if (p === "/m") return json((await env.DB.prepare("select email, role, added_at from members where scope = ? order by email").bind(scope).all()).results || []);
      if (p === "/m/add" && req.method === "POST") {
        if (role !== "owner" && role !== "partner") return err(403, "Only an Administrator can add people or change their role.");
        const b = (await req.json()) as any; const e = String(b.email || "").trim().toLowerCase(), r = [...ROLE_IDS, "partner"].includes(b.role) ? b.role : "member";
        // The last Administrator can't be made something else: nobody could manage roles any more.
        if (r !== "owner" && (await roleOf(env, scope, e)) === "owner" && ((await env.DB.prepare("select count(*) n from members where scope = ? and role = 'owner'").bind(scope).first()) as any)?.n <= 1) return err(400, "This is the only Administrator. Make someone else an Administrator first.");
        if (!emailOk(e)) return err(400, "Enter a valid email.");
        await env.DB.prepare("insert into members (scope, email, role) values (?, ?, ?) on conflict (scope, email) do update set role = excluded.role").bind(scope, e, r).run();
        return json({ ok: true });
      }
      if (p === "/m/remove" && req.method === "POST") {
        if (role !== "owner" && role !== "partner") return err(403, "Only an Administrator can remove people.");
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
      // ---- Customer data: everyone who ordered from this site, with their points
      if (p === "/c/list") {
        const site = scope.replace(/^site:/, ""), find = String(u.searchParams.get("q") || "").trim().toLowerCase().slice(0, 60), like = "%" + find.replace(/[%_]/g, "") + "%";
        const page = Math.max(0, Math.floor(+(u.searchParams.get("page") || 0))), per = Math.max(1, Math.min(5000, Math.floor(+(u.searchParams.get("per") || 20))));
        const where = find ? "site = ? and (lower(name) like ? or phone like ? or lower(email) like ? or ckey like ?)" : "site = ?", args = find ? [site, like, like, like, like] : [site];
        const tot: any = await env.DB.prepare(`select count(*) n, coalesce(sum(points), 0) pts, coalesce(sum(spent), 0) spent, coalesce(sum(orders), 0) orders from customers where ${where}`).bind(...args).first();
        const rows = (await env.DB.prepare(`select ckey, name, phone, email, verified, orders, spent, points, first_at, last_at from customers where ${where} order by last_at desc limit ? offset ?`).bind(...args, per, page * per).all()).results || [];
        return json({ rows, total: tot?.n || 0, points: tot?.pts || 0, spent: tot?.spent || 0, orders: tot?.orders || 0 });
      }
      if (p === "/c/points") {
        const site = scope.replace(/^site:/, ""), key = String(u.searchParams.get("key") || "");
        return json((await env.DB.prepare("select delta, why, order_no, at from points where site = ? and ckey = ? order by id desc limit 100").bind(site, key).all()).results || []);
      }
      // Orders saved before customer records were kept (or before this database knew them): counted in now, once each.
      // No points are given for them unless asked (`points`), and then by the site's rule of today.
      if (p === "/c/rebuild" && req.method === "POST") {
        const b = (await req.json().catch(() => ({}))) as any, site = scope.replace(/^site:/, ""), c = await siteContent(env, site).catch(() => null), L = loyOf(c);
        const cc = (await getSetting(env, "site:" + site, "wa").catch(() => null))?.cc || (await getSetting(env, "site:" + site, "sms").catch(() => null))?.cc;
        const rows = ((await env.DB.prepare("select data, created_at from enquiries where site = ? order by created_at asc limit 5000").bind(site).all()).results || []) as any[];
        const done = new Set((((await env.DB.prepare("select distinct order_no from points where site = ? and order_no <> ''").bind(site).all()).results || []) as any[]).map((r) => String(r.order_no)));
        let orders = 0; const who = new Set<string>(), st: any[] = [];
        for (const r of rows) {
          let d: any = null; try { d = JSON.parse(r.data); } catch { /* not an order */ }
          const no = String(d?.order_no || ""); if (!no || done.has(no)) continue;
          const key = waNum(d.phone, cc) || String(d.email || "").trim().toLowerCase().slice(0, 120); if (!key) continue;
          const n = rnum(d.total), spent = isNaN(n) ? 0 : n, earned = b.points && L.on && L.earn > 0 ? Math.floor((spent / 100) * L.earn) : 0, at = String(r.created_at || new Date().toISOString());
          st.push(env.DB.prepare("insert into customers (site, ckey, name, phone, email, verified, orders, spent, points, first_at, last_at) values (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?) on conflict (site, ckey) do update set name = case when name = '' then excluded.name else name end, phone = case when phone = '' then excluded.phone else phone end, email = case when email = '' then excluded.email else email end, verified = max(verified, excluded.verified), orders = orders + 1, spent = spent + excluded.spent, points = points + excluded.points, first_at = min(first_at, excluded.first_at), last_at = max(last_at, excluded.last_at)")
            .bind(site, key, oneLine(String(d.name || "")).slice(0, 100), String(d.phone || "").slice(0, 24), String(d.email || "").trim().slice(0, 120), d._phone ? 1 : 0, spent, earned, at, at));
          st.push(env.DB.prepare("insert into points (site, ckey, delta, why, order_no, at) values (?, ?, ?, ?, ?, ?)").bind(site, key, earned, earned ? "Earned on an earlier order" : "Earlier order counted in", no, at));
          done.add(no); who.add(key); orders++;
        }
        for (let i = 0; i < st.length; i += 80) await env.DB.batch(st.slice(i, i + 80));
        return json({ ok: true, orders, customers: who.size });
      }
      if ((p === "/c/adjust" || p === "/c/delete") && req.method === "POST") {
        const b = (await req.json()) as any, site = scope.replace(/^site:/, ""), key = String(b.key || "");
        const row: any = await env.DB.prepare("select points from customers where site = ? and ckey = ?").bind(site, key).first(); if (!row) return err(404, "That customer isn't here any more.");
        if (p === "/c/delete") { await env.DB.batch([env.DB.prepare("delete from points where site = ? and ckey = ?").bind(site, key), env.DB.prepare("delete from customers where site = ? and ckey = ?").bind(site, key)]); return json({ ok: true }); }
        const d = Math.round(+b.delta || 0); if (!d || Math.abs(d) > 1_000_000) return err(400, "How many points?");
        const next = Math.max(0, (+row.points || 0) + d), real = next - (+row.points || 0);
        await env.DB.batch([env.DB.prepare("update customers set points = ? where site = ? and ckey = ?").bind(next, site, key), env.DB.prepare("insert into points (site, ckey, delta, why, order_no, at) values (?, ?, ?, ?, '', ?)").bind(site, key, real, oneLine(String(b.why || "Changed by the owner")).slice(0, 120), new Date().toISOString())]);
        return json({ ok: true, points: next });
      }
      // ---- Design yourself requests, for the Studio's members
      if (p === "/dq/drafts" || p === "/dq/draft-delete") {
        if (!scope.startsWith("studio:")) return err(400, "Unknown scope.");
        await ensure(env); const sid = scope.slice(7);
        if (p === "/dq/drafts") {
          const rows = (await env.DB.prepare("select id, email, name, kind, theme_id, theme_name, summary, answers, copy, logo, created_at, updated_at from design_drafts where studio = ? order by updated_at desc limit 200").bind(sid).all()).results || [];
          return json(rows.map((r: any) => ({ id: r.id, email: r.email, name: r.name, kind: r.kind, themeId: r.theme_id, themeName: r.theme_name, summary: r.summary, answers: JSON.parse(r.answers || "{}"), copy: JSON.parse(r.copy || "{}"), ...(r.logo ? { logo: r.logo } : {}), createdAt: r.created_at, updatedAt: r.updated_at })));
        }
        const b: any = await req.json().catch(() => ({}));
        await env.DB.prepare("delete from design_drafts where studio = ? and id = ?").bind(sid, String(b.id || "")).run(); return json({ ok: true });
      }
      if (p === "/dq/list" || p === "/dq/get" || p === "/dq/status" || p === "/dq/delete") {
        if (!scope.startsWith("studio:")) return err(400, "Unknown scope.");
        await ensure(env); const sid = scope.slice(7);
        if (p === "/dq/list") {
          const rows = (await env.DB.prepare("select id, name, kind, person, phone, email, note, answers, copy, status, mail, pdf_name, (logo != '') as has_logo, exists (select 1 from design_pics p where p.studio = design_queries.studio and p.ref = design_queries.id) as has_pics, created_at from design_queries where studio = ? order by id desc limit 300").bind(sid).all()).results || [];
          return json(rows.map((r: any) => ({ ...r, answers: JSON.parse(r.answers || "{}"), copy: JSON.parse(r.copy || "{}"), has_logo: !!r.has_logo, has_pics: !!r.has_pics })));
        }
        const b: any = req.method === "POST" ? await req.json().catch(() => ({})) : {}, qid = Math.floor(+(b.id ?? u.searchParams.get("id")) || 0);
        if (!qid) return err(400, "Which request?");
        if (p === "/dq/get") { const r: any = await env.DB.prepare("select logo, pdf_name, pdf from design_queries where studio = ? and id = ?").bind(sid, qid).first(); if (!r) return err(404, "Not found."); const pics: Record<string, string[]> = {}; for (const x of ((await env.DB.prepare("select slot, data from design_pics where studio = ? and ref = ? order by slot, idx").bind(sid, qid).all().catch(() => ({ results: [] }))).results || []) as any[]) (pics[x.slot] ||= []).push(x.data); return json({ ...r, pics }); }
        if (p === "/dq/status") { if (!["new", "read", "done"].includes(b.status)) return err(400, "Unknown status."); await env.DB.prepare("update design_queries set status = ? where studio = ? and id = ?").bind(b.status, sid, qid).run(); return json({ ok: true }); }
        await env.DB.prepare("delete from design_pics where studio = ? and ref = ?").bind(sid, qid).run().catch(() => {}); await env.DB.prepare("delete from design_queries where studio = ? and id = ?").bind(sid, qid).run(); return json({ ok: true });
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
      // ---- Reviews: every review for the owner to approve, hide, answer or delete.
      if (p === "/rw/list") {
        const site = scope.replace(/^site:/, ""); await ensure(env);
        const rows = (await env.DB.prepare("select id, item, label, name, email, rating, title, body, verified, status, reply, created_at from reviews where site = ? order by id desc limit 500").bind(site).all()).results || [];
        const c = await siteContent(env, site).catch(() => null);
        return json({ on: revOn(c), moderate: c?.reviews?.auto !== true, rows });
      }
      if (p === "/rw/set" && req.method === "POST") {
        const b = (await req.json()) as any, site = scope.replace(/^site:/, ""), id = +b.id;
        const r: any = await env.DB.prepare("select id from reviews where id = ? and site = ?").bind(id, site).first(); if (!r) return err(404, "That review isn't here any more.");
        if (b.status != null) { if (!["live", "pending", "hidden"].includes(String(b.status))) return err(400, "Which state?"); await env.DB.prepare("update reviews set status = ? where id = ? and site = ?").bind(String(b.status), id, site).run(); }
        if (b.reply != null) { const t = String(b.reply).trim().slice(0, 800); await env.DB.prepare("update reviews set reply = ?, reply_at = ? where id = ? and site = ?").bind(t, t ? new Date().toISOString() : null, id, site).run(); }
        return json({ ok: true });
      }
      if (p === "/rw/del" && req.method === "POST") {
        const b = (await req.json()) as any, site = scope.replace(/^site:/, "");
        await env.DB.prepare("delete from reviews where id = ? and site = ?").bind(+b.id, site).run(); return json({ ok: true });
      }
      // ---- Abandoned carts: the list, a reminder sent now, and a cart taken off the list.
      if (p === "/rc/list") {
        const site = scope.replace(/^site:/, ""); await ensure(env);
        const rows = (await env.DB.prepare("select ckey, email, name, phone, items, total, status, sent, sent_at, order_no, updated_at from carts where site = ? order by updated_at desc limit 300").bind(site).all()).results || [];
        const c = await siteContent(env, site).catch(() => null);
        return json({ on: recOn(c), mail: !!(env.RESEND_API_KEY && env.MAIL_FROM), rows: (rows as any[]).map((r) => ({ ...r, items: JSON.parse(r.items) })) });
      }
      if (p === "/rc/send" && req.method === "POST") {
        const b = (await req.json()) as any, site = scope.replace(/^site:/, ""); await ensure(env);
        const r: any = await env.DB.prepare("select * from carts where site = ? and ckey = ?").bind(site, String(b.key || "")).first(); if (!r) return err(404, "That cart isn't here any more.");
        if (r.status === "recovered") return err(409, "That shopper has already ordered.");
        const c = await siteContent(env, site).catch(() => null); if (!c) return err(409, "Publish the site first.");
        try { await recSend(env, site, c, r, new URL(req.url).origin); } catch (e: any) { return err(502, String(e?.message || e)); }
        await env.DB.prepare("update carts set sent = sent + 1, sent_at = ?, status = case when status = 'stop' then 'open' else status end where site = ? and ckey = ?").bind(new Date().toISOString(), site, r.ckey).run();
        return json({ ok: true });
      }
      if (p === "/rc/drop" && req.method === "POST") {
        const b = (await req.json()) as any, site = scope.replace(/^site:/, "");
        await env.DB.prepare("delete from carts where site = ? and ckey = ?").bind(site, String(b.key || "")).run(); return json({ ok: true });
      }
      // ---- Inventory: what is counted and how many are left; the owner sets, adds or stops counting; the log of changes.
      if (p === "/st/list") {
        const site = scope.replace(/^site:/, ""); await ensure(env);
        const rows = (await env.DB.prepare("select item, qty, low, updated_at from stock where site = ? order by item limit 3000").bind(site).all()).results || [];
        const log = (await env.DB.prepare("select item, delta, qty, why, ref, at from stock_log where site = ? order by id desc limit 200").bind(site).all()).results || [];
        const c = await siteContent(env, site).catch(() => null);
        return json({ on: invOn(c), items: c ? stockItems(c) : [], rows, log });
      }
      if (p === "/st/set" && req.method === "POST") {
        const site = scope.replace(/^site:/, ""), b = (await req.json()) as any, now = new Date().toISOString(), why = oneLine(String(b.why || "")).slice(0, 60); await ensure(env);
        const list = (Array.isArray(b.items) ? b.items : []).slice(0, 600); let n = 0;
        for (const it of list) {
          const item = String(it?.item || "").trim().slice(0, 200); if (!item) continue;
          if (it.off) { await env.DB.prepare("delete from stock where site = ? and item = ?").bind(site, item).run(); await env.DB.prepare("insert into stock_log (site, item, delta, qty, why, ref, at) values (?, ?, 0, 0, 'No longer counted', '', ?)").bind(site, item, now).run(); n++; continue; }
          const had: any = await env.DB.prepare("select qty, low from stock where site = ? and item = ?").bind(site, item).first();
          const int = (v: unknown) => Math.max(0, Math.min(1_000_000, Math.round(+(v as any) || 0)));
          const qty = it.add != null && isFinite(+it.add) ? int((+had?.qty || 0) + Math.round(+it.add)) : it.qty != null && isFinite(+it.qty) ? int(it.qty) : +had?.qty || 0, low = it.low != null && isFinite(+it.low) ? int(it.low) : +had?.low || 0;
          if (had && +had.qty === qty && +had.low === low) continue;
          await env.DB.prepare("insert into stock (site, item, qty, low, updated_at) values (?, ?, ?, ?, ?) on conflict (site, item) do update set qty = excluded.qty, low = excluded.low, updated_at = excluded.updated_at").bind(site, item, qty, low, now).run();
          if (!had || +had.qty !== qty) await env.DB.prepare("insert into stock_log (site, item, delta, qty, why, ref, at) values (?, ?, ?, ?, ?, ?, ?)").bind(site, item, qty - (+had?.qty || 0), qty, why || (had ? (it.add != null ? (+it.add >= 0 ? "Stock added" : "Stock taken off") : "Counted") : "Started counting"), String(email || "").slice(0, 40), now).run();
          n++;
        }
        return json({ ok: true, changed: n });
      }
      // A shop order's shipment: the courier and its tracking number (and, with `ship`, the order is marked as sent and the customer told).
      if ((p === "/e/track" || p === "/e/track/live") && req.method === "POST") {
        const b = (await req.json()) as any, site = scope.replace(/^site:/, "");
        const row: any = await env.DB.prepare("select data, status from enquiries where id = ? and site = ?").bind(b.id, site).first(); if (!row) return err(404, "Not found.");
        const d = JSON.parse(row.data); if (!d.order_no) return err(400, "That isn't an order.");
        if (p === "/e/track/live") { const g = await shipLive(env, site, b.id, d, row.status, true); return json({ live: g.live ? { ...g.live, label: TRACK_STATES[g.live.st] || g.live.say } : null, why: g.why, status: g.status }); }
        const c = COURIERS[String(b.courier)] ? String(b.courier) : "other", awb = String(b.awb || "").trim().slice(0, 40), url = String(b.url || "").trim().slice(0, 400);
        if (awb && !/^[A-Za-z0-9][A-Za-z0-9 _-]{3,39}$/.test(awb)) return err(400, "That doesn't look like a tracking number.");
        if (url && !publicUrl(url)) return err(400, "The tracking link must be a public https:// address.");
        delete d._trk; delete d._trk_bad; delete d._trk_why;
        if (!awb && !url) delete d._track; else d._track = JSON.stringify({ c, awb, url, name: oneLine(String(b.name || "")).slice(0, 60), at: new Date().toISOString() });
        let status = row.status, said = "";
        if (b.ship && d._track && SHIP_OPEN.includes(status)) status = "out";
        if (b.ship && d._track && !d._ship_mail) { const opt = await getSetting(env, scope, "ship").catch(() => null); if (!opt?.quiet) { said = await shippedMail(env, site, d).catch((e: any) => "Not emailed: " + String(e?.message || e).slice(0, 200)); if (said) d._ship_mail = said; } }
        await env.DB.prepare("update enquiries set data = ?, status = ? where id = ? and site = ?").bind(JSON.stringify(d), status, b.id, site).run();
        return json({ ok: true, status, data: d, mail: said });
      }
      if ((p === "/e/status" || p === "/e/delete") && req.method === "POST") {
        const b = (await req.json()) as any; const site = scope.replace(/^site:/, "");
        if (p === "/e/status") { if (!["new", "read", "replied", "archived", "accepted", "preparing", "ready", "out", "done", "cancelled"].includes(b.status)) return err(400, "Unknown status.");
          // A cancelled order gives its items back to stock; one brought back from cancelled takes them again.
          const row: any = await env.DB.prepare("select data, status from enquiries where id = ? and site = ?").bind(b.id, site).first();
          let nd: string | null = null;
          if (row && (b.status === "cancelled") !== (row.status === "cancelled")) { try { const d = JSON.parse(row.data), tk = JSON.parse(String(d._stock || "[]")) as [string, number][];
            if (Array.isArray(tk) && tk.length) { if (b.status === "cancelled" && !d._stock_back) { await stockBack(env, site, tk, String(d.order_no || ""), "Order cancelled"); d._stock_back = "yes"; nd = JSON.stringify(d); }
              else if (b.status !== "cancelled" && d._stock_back) { const now = new Date().toISOString(); for (const [k, q] of tk) { const r: any = await env.DB.prepare("update stock set qty = max(0, qty - ?), updated_at = ? where site = ? and item = ? returning qty").bind(q, now, site, k).first(); if (r) await env.DB.prepare("insert into stock_log (site, item, delta, qty, why, ref, at) values (?, ?, ?, ?, 'Order brought back', ?, ?)").bind(site, k, -q, +r.qty || 0, String(d.order_no || "").slice(0, 40), now).run(); } delete d._stock_back; nd = JSON.stringify(d); } } } catch { /* an order without stock lines */ } }
          if (nd) await env.DB.prepare("update enquiries set status = ?, data = ? where id = ? and site = ?").bind(b.status, nd, b.id, site).run(); else await env.DB.prepare("update enquiries set status = ? where id = ? and site = ?").bind(b.status, b.id, site).run();
          // A status the site switched on emails the customer once (content.emails.status.<status>.on).
          if (row && row.status !== b.status && ["ready", "out", "done", "cancelled"].includes(b.status)) { try { const d = JSON.parse(nd || row.data), sent = String(d._smail || "").split(","); if (d.order_no && !sent.includes(b.status)) { const said = await orderMail(env, site, b.status, d); if (said) { d._smail = [...sent.filter(Boolean), b.status].join(","); d._omail = said; await env.DB.prepare("update enquiries set data = ? where id = ? and site = ?").bind(JSON.stringify(d), b.id, site).run(); } } } catch { /* the status is saved; the email is a courtesy */ } } }
        else await env.DB.prepare("delete from enquiries where id = ? and site = ?").bind(b.id, site).run();
        return json({ ok: true });
      }
      return err(404, "Not found.");
    } catch (e: any) {
      return err(500, e?.message || "Something went wrong.");
    }
  },
};
