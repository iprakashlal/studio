// Site Studio database for Cloudflare Workers (D1). Set up and updated from the Studio. Generated from worker/db-worker.ts.


// src/lib/cfdbSchema.ts
var CFDB_SCHEMA = `
create table if not exists members (scope text not null, email text not null, role text not null default 'owner', added_at text not null default (datetime('now')), primary key (scope, email));
create table if not exists files (scope text not null, path text not null, sha text not null, size integer not null default 0, parts integer not null default 1, type text not null default '', updated_at text not null, primary key (scope, path));
create table if not exists chunks (scope text not null, path text not null, n integer not null, data blob not null, primary key (scope, path, n));
create table if not exists codes (email text primary key, hash text not null, expires integer not null, tries integer not null default 0, sent integer not null default 0);
create table if not exists enquiries (id integer primary key autoincrement, site text not null, data text not null, page text not null default '', status text not null default 'new', created_at text not null);
create index if not exists enquiries_site on enquiries (site, created_at);
create table if not exists workers (worker text primary key, scope text not null);
create table if not exists repos (repo text primary key, scope text not null);
`;
var CFDB_VERSION = 13;
var CFDB_WORKER_NAME = "picaffectz-db";

// src/lib/lookdigest.ts
var hex2 = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
var NAMED = { white: "#ffffff", black: "#000000" };
function hsl(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return "#" + hex2(f(0) * 255) + hex2(f(8) * 255) + hex2(f(4) * 255);
}
function cssColor(v) {
  v = v.trim().toLowerCase();
  let m;
  if (NAMED[v]) return NAMED[v];
  if (m = /^#([0-9a-f]{3,8})$/.exec(v)) {
    const h = m[1];
    if (h.length === 3 || h.length === 4) return "#" + h.slice(0, 3).split("").map((c) => c + c).join("");
    if (h.length === 6 || h.length === 8) return "#" + h.slice(0, 6);
    return "";
  }
  if (m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(v)) {
    const a = m[4] == null ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return a < 0.6 ? "" : "#" + hex2(+m[1]) + hex2(+m[2]) + hex2(+m[3]);
  }
  if (m = /^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(v)) {
    const a = m[4] == null ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return a < 0.6 ? "" : hsl(+m[1], +m[2], +m[3]);
  }
  return "";
}
var GENERIC = /^(inherit|initial|unset|serif|sans-serif|monospace|system-ui|ui-sans-serif|ui-serif|ui-monospace|cursive|fantasy|-apple-system|blinkmacsystemfont|segoe ui|arial|helvetica|helvetica neue|roboto|var\(.*\)|emoji|math)$/i;
var ICON = /icon|awesome|glyph|symbol|material|swiper|slick|dashicons|elementor|eicons/i;
function family(v) {
  for (const part of v.split(",")) {
    const n = part.trim().replace(/^["']|["']$/g, "").replace(/!important/i, "").trim();
    if (n && !GENERIC.test(n) && !ICON.test(n) && n.length < 40) return n;
  }
  return "";
}
var count = (m, k, n = 1) => m.set(k, (m.get(k) || 0) + n);
var top = (m, n) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
function digestPage(html, css) {
  html = String(html || "").slice(0, 3e6);
  css = String(css || "").slice(0, 3e6);
  const inline = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");
  const attrs = [...html.matchAll(/\sstyle\s*=\s*"([^"]{0,600})"/gi)].map((m) => m[1]).join(";\n");
  const all = (css + "\n" + inline).replace(/\/\*[\s\S]*?\*\//g, ""), sheet = all + "\n" + attrs;
  const vars = /* @__PURE__ */ new Map();
  for (const m of all.matchAll(/(--[\w-]+)\s*:\s*([^;}{]+)[;}]/g)) {
    const c = cssColor(m[2]);
    if (c && !vars.has(m[1])) vars.set(m[1], c);
  }
  const resolve = (v) => {
    const m = /var\(\s*(--[\w-]+)/.exec(v);
    return m ? vars.get(m[1]) || "" : cssColor(v.replace(/!important/i, "").trim().split(/\s+(?![^(]*\))/)[0] || "");
  };
  const colors = /* @__PURE__ */ new Map();
  for (const m of sheet.matchAll(/#[0-9a-f]{3,8}\b|rgba?\([^)]{5,40}\)|hsla?\([^)]{5,40}\)/gi)) {
    const c = cssColor(m[0]);
    if (c) count(colors, c);
  }
  const fonts = /* @__PURE__ */ new Map(), radii = /* @__PURE__ */ new Map();
  let bg = "", text = "", headFont = "", bodyFont = "", centered = 0, upper = 0;
  for (const m of all.matchAll(/([^{}]{1,300})\{([^{}]{1,4000})\}/g)) {
    const sel = m[1].trim().toLowerCase(), body = m[2];
    const isRoot = /(^|[\s,])(body|html|:root)(\s*[,{]|$)/.test(sel + "{"), isHead = /(^|[\s,>])h[12]\b|\.hero|\.title|\.heading|\.display/.test(sel);
    const ff = /font-family\s*:\s*([^;}]+)/i.exec(body);
    if (ff) {
      const f = family(ff[1].includes("var(") ? "" : ff[1]);
      if (f) {
        count(fonts, f);
        if (isHead && !headFont) headFont = f;
        if (isRoot && !bodyFont) bodyFont = f;
      }
    }
    if (isRoot) {
      const b = /background(?:-color)?\s*:\s*([^;}]+)/i.exec(body), c = /(?:^|[;\s])color\s*:\s*([^;}]+)/i.exec(body);
      if (b && !bg) bg = resolve(b[1]);
      if (c && !text) text = resolve(c[1]);
    }
    for (const r of body.matchAll(/border-radius\s*:\s*([\d.]+)(px|rem|em)\b/gi)) {
      const px = Math.round(parseFloat(r[1]) * (r[2] === "px" ? 1 : 16));
      if (px >= 0 && px <= 60) count(radii, px);
    }
    if (isHead && /text-align\s*:\s*center/i.test(body)) centered++;
    if (isHead && /text-transform\s*:\s*uppercase/i.test(body)) upper++;
  }
  for (const m of html.matchAll(/fonts\.googleapis\.com\/css2?\?([^"'>\s]+)/gi)) for (const f of m[1].matchAll(/family=([^&:@"']+)/g)) {
    const n = decodeURIComponent(f[1].replace(/\+/g, " ")).trim();
    if (n && !ICON.test(n)) count(fonts, n, 5);
  }
  if (!headFont || !bodyFont) for (const m of all.matchAll(/--[\w-]*(font|ff|family)[\w-]*\s*:\s*([^;}]+)[;}]/gi)) {
    const f = family(m[2]);
    if (!f) continue;
    count(fonts, f, 2);
    if (/head|display|title/i.test(m[0]) && !headFont) headFont = f;
    else if (/body|base|text|sans|primary/i.test(m[0]) && !bodyFont) bodyFont = f;
  }
  if (!bg) bg = vars.get("--bg") || vars.get("--background") || vars.get("--color-bg") || vars.get("--color-background") || vars.get("--body-bg") || "";
  if (!text) text = vars.get("--text") || vars.get("--color-text") || vars.get("--foreground") || vars.get("--body-color") || "";
  const src = html + "\n" + all, libs = [];
  const has = (k, re) => {
    if (re.test(src)) libs.push(k);
  };
  has("smooth", /\blenis\b|locomotive-scroll|smooth-scrollbar|ScrollSmoother|data-scroll-container/i);
  has("reveal", /\bgsap\b|ScrollTrigger|\baos\b|data-aos|split-?type|splitting|\bwow\.js|scrollreveal|data-sal\b|framer-motion/i);
  has("cursor", /custom-cursor|cursor-(dot|follower|ring|inner|outer)|\.cursor[\s{.,]|mouse-follower|cursor\s*:\s*none/i);
  has("tilt", /vanilla-tilt|data-tilt|tilt\.js|atropos/i);
  has("loader", /preloader|page-loader|loading-screen|\bpace\.js|barba|swup/i);
  has("marquee", /marquee|ticker/i);
  has("parallax", /parallax|rellax|data-speed/i);
  has("slider", /swiper|slick|splide|flickity|owl-carousel|embla/i);
  has("3d", /three(\.module)?(\.min)?\.js|\bTHREE\.|spline|babylon/i);
  const bodyAt = html.search(/<body/i), first = html.slice(Math.max(0, bodyAt), Math.max(0, bodyAt) + 9e3);
  const heroImage = /<(img|video|picture|canvas|model-viewer)\b/i.test(first.replace(/<header[\s\S]*?<\/header>|<nav[\s\S]*?<\/nav>/gi, ""));
  return { colors: top(colors, 40), ...bg ? { bg } : {}, ...text ? { text } : {}, fonts: top(fonts, 12), ...headFont ? { headFont } : {}, ...bodyFont ? { bodyFont } : {}, radii: top(radii, 8).map(([r]) => r), libs, centered: centered > 0, heroImage, uppercase: upper > 0 };
}
function sheetLinks(html, base) {
  const out = [];
  for (const m of String(html).matchAll(/<link\b[^>]*>/gi)) {
    if (!/rel\s*=\s*["']?[^"'>]*stylesheet/i.test(m[0])) continue;
    const h = /href\s*=\s*["']([^"']+)["']/i.exec(m[0]);
    if (!h) continue;
    try {
      const u = new URL(h[1].replace(/&amp;/g, "&"), base);
      if (u.protocol === "https:" && !/fonts\.googleapis\.com/.test(u.host) && !out.includes(u.href)) out.push(u.href);
    } catch {
    }
  }
  return out;
}

// worker/db-worker.ts
var V = CFDB_VERSION;
var CHUNK = 9e5;
var enc = new TextEncoder();
function otherToken(env, account) {
  if (!/^[\w-]{1,64}$/.test(account)) return "";
  try {
    return String(JSON.parse(env["CFX_" + account.replace(/-/g, "_")] || "null")?.t || "");
  } catch {
    return "";
  }
}
function otherAccounts(env) {
  const out = [];
  for (const k of Object.keys(env)) if (k.startsWith("CFX_")) {
    try {
      const j = JSON.parse(env[k]);
      if (j?.t) out.push({ id: k.slice(4), name: String(j.n || "").slice(0, 80) });
    } catch {
    }
  }
  return out;
}
var SCHEMA = CFDB_SCHEMA;
var cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, x-sha", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Max-Age": "86400", "Access-Control-Expose-Headers": "x-sha, x-updated" };
var json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });
var err = (status, error) => json({ error }, status);
var b64u = (b) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
var unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
var hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
async function hmac(secret, data) {
  const k = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(data)));
}
var emailOk = (e) => /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(e);
var scopeOk = (s) => /^(studio|site):[a-z0-9][a-z0-9-]{0,59}$/.test(s);
var pathOk = (p) => !!p && p.length < 400 && !p.includes("..") && !p.startsWith("/") && /^[\w\-./ ()@+,]+$/.test(p);
var TYPES = { json: "application/json", html: "text/html; charset=utf-8", css: "text/css", js: "text/javascript", md: "text/markdown", txt: "text/plain", svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", avif: "image/avif", pdf: "application/pdf", ico: "image/x-icon" };
var typeOf = (p) => TYPES[(p.split(".").pop() || "").toLowerCase()] || "application/octet-stream";
var publicPath = (p) => p === "content.json" || p === "cms/site.json" || p.startsWith("assets/");
async function sessionFor(env, email) {
  const body = b64u(enc.encode(JSON.stringify({ e: email, x: Date.now() + 30 * 864e5 })));
  return body + "." + b64u(await hmac(env.SECRET, "s:" + body));
}
async function who(env, req) {
  const t = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const [body, sig] = t.split(".");
  if (!body || !sig) return null;
  if (b64u(await hmac(env.SECRET, "s:" + body)) !== sig) return null;
  try {
    const o = JSON.parse(new TextDecoder().decode(unb64u(body)));
    return o.x > Date.now() && emailOk(o.e) ? o.e : null;
  } catch {
    return null;
  }
}
var roleOf = async (env, scope, email) => email ? (await env.DB.prepare("select role from members where scope = ? and email = ?").bind(scope, email).first())?.role || null : null;
async function readFile(env, scope, path) {
  const f = await env.DB.prepare("select sha, size, parts, type, updated_at from files where scope = ? and path = ?").bind(scope, path).first();
  if (!f) return null;
  const rows = (await env.DB.prepare("select data from chunks where scope = ? and path = ? order by n").bind(scope, path).all()).results || [];
  const parts = rows.map((r) => new Uint8Array(r.data));
  const out = new Uint8Array(parts.reduce((a, b) => a + b.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return { ...f, bytes: out };
}
async function sha1(b) {
  return hex(await crypto.subtle.digest("SHA-1", b));
}
async function writeFile(env, scope, path, bytes, sha) {
  const s = sha || "c" + await sha1(bytes);
  const n = Math.max(1, Math.ceil(bytes.length / CHUNK));
  const st = [env.DB.prepare("delete from chunks where scope = ? and path = ?").bind(scope, path)];
  for (let i = 0; i < n; i++) st.push(env.DB.prepare("insert into chunks (scope, path, n, data) values (?, ?, ?, ?)").bind(scope, path, i, bytes.slice(i * CHUNK, (i + 1) * CHUNK)));
  st.push(env.DB.prepare("insert into files (scope, path, sha, size, parts, type, updated_at) values (?, ?, ?, ?, ?, ?, ?) on conflict (scope, path) do update set sha = excluded.sha, size = excluded.size, parts = excluded.parts, type = excluded.type, updated_at = excluded.updated_at").bind(scope, path, s, bytes.length, n, typeOf(path), (/* @__PURE__ */ new Date()).toISOString()));
  await env.DB.batch(st);
  return s;
}
async function sendMail(env, to, subject, html, replyTo) {
  if (!env.RESEND_API_KEY || !env.MAIL_FROM) throw new Error("Email isn't set up on this database (Resend).");
  const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ from: env.MAIL_FROM, to: Array.isArray(to) ? to : [to], subject, html, ...replyTo ? { reply_to: replyTo } : {} }) });
  if (!r.ok) throw new Error("Resend didn't accept the email (" + r.status + "): " + (await r.text()).slice(0, 200));
}
var EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;
var hesc = (x) => String(x).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
var oneLine = (x) => String(x).replace(/[\r\n]+/g, " ").trim();
var fill = (t, vars) => String(t).replace(/\{(\w+)\}/g, (m, k) => k in vars ? vars[k] : m);
var paras = (t, style = "margin:0 0 12px") => String(t).trim().split(/\n\s*\n/).filter((p) => p.trim()).map((p) => `<p style="${style}">${hesc(p.trim()).replace(/\n/g, "<br>")}</p>`).join("");
var WRAP = (inner) => `<div style="font:15px/1.55 system-ui,Segoe UI,Arial,sans-serif;color:#111;max-width:560px">${inner}</div>`;
async function siteContent(env, site) {
  const f = await readFile(env, "site:" + site, "content.json");
  if (!f) return null;
  try {
    return JSON.parse(new TextDecoder().decode(f.bytes));
  } catch {
    return null;
  }
}
var siteName = (c, site) => oneLine(String(c?.brand?.name || c?.brand?.logoText || site));
async function notifyEnquiry(env, site, data, page) {
  const c = await siteContent(env, site);
  if (!c) return "";
  const F = c?.contact?.form || {}, E = c?.emails && typeof c.emails === "object" ? c.emails : {};
  const wantOwner = F.notify === true || F.notifyAsk !== 1, wantReply = E.reply?.on === true && EMAIL_RE.test(data.email || "");
  if (!wantOwner && !wantReply) return "";
  if (!env.RESEND_API_KEY || !env.MAIL_FROM) return wantOwner ? "Not emailed: email (Resend) isn't set up on this site's database." : "";
  const since = new Date(Date.now() - 36e5).toISOString();
  const n = await env.DB.prepare("select count(*) n from enquiries where site = ? and created_at > ?").bind(site, since).first();
  if ((n?.n || 0) > 40) return wantOwner ? "Not emailed: more than 40 enquiries in an hour, so emails are paused." : "";
  const name = siteName(c, site);
  const addrs = (x) => [...new Set(String(x || "").split(/[,;\s]+/).map((y) => y.trim().toLowerCase()).filter((y) => EMAIL_RE.test(y)))].slice(0, 3);
  let owners = addrs(F.notifyTo);
  if (!owners.length) owners = addrs(c?.contact?.email);
  if (!owners.length && wantOwner) owners = addrs(((await env.DB.prepare("select email from members where scope = ? order by role = 'owner' desc limit 3").bind("site:" + site).all()).results || []).map((r) => r.email).join(","));
  let said = wantOwner && !owners.length ? "Not emailed: no address to send to. Fill in \u201CSend to\u201D under Enquiry form." : "";
  const vars = { name: oneLine(data.name || ""), site: name, page: page || "", email: oneLine(data.email || "") };
  const label = (k) => k.replace(/[-_]+/g, " ").replace(/^./, (ch) => ch.toUpperCase());
  const rows = Object.entries(data).filter(([k]) => k !== "consent" && !k.startsWith("_")).map(([k, v]) => `<tr><td style="padding:6px 14px 6px 0;color:#667;vertical-align:top;white-space:nowrap">${hesc(label(k))}</td><td style="padding:6px 0;white-space:pre-wrap">${hesc(v)}</td></tr>`).join("");
  const table = `<table style="border-collapse:collapse;margin:0 0 14px">${rows}</table>`;
  const jobs = [];
  if (wantOwner && owners.length) {
    const subject = oneLine(fill(String(F.notifySubject || "New enquiry from {name}"), { ...vars, name: vars.name || "your website" })).slice(0, 150) || "New enquiry";
    const intro = fill(String(E.enquiry?.intro || "New enquiry from the {site} website."), vars);
    const foot = fill(String(E.enquiry?.footer || "It is also saved under Enquiries in the site's admin page."), vars) + (EMAIL_RE.test(data.email || "") ? " Reply to this email to answer the visitor." : "");
    jobs.push(sendMail(env, owners, subject, WRAP(paras(intro) + table + paras(foot, "margin:0 0 8px;color:#667;font-size:13px")), EMAIL_RE.test(data.email || "") ? data.email : void 0).then(() => {
      said = "Emailed to " + owners.join(", ") + ".";
    }, (e) => {
      said = "Not emailed: " + String(e?.message || e).slice(0, 300);
    }));
  }
  if (wantReply) {
    const mine = await env.DB.prepare("select count(*) n from enquiries where site = ? and created_at > ? and instr(lower(data), ?) > 0").bind(site, since, JSON.stringify(String(data.email).toLowerCase())).first();
    if ((mine?.n || 0) <= 3) {
      const v2 = { ...vars, name: vars.name || "there" };
      const subject = oneLine(fill(String(E.reply.subject || "Thank you for contacting {site}"), v2)).slice(0, 150) || "Thank you";
      const body = fill(String(E.reply.message || "Hi {name},\n\nThank you for your message. We have received it and will get back to you soon.\n\n{site}"), v2);
      const copy = E.reply.copy === true ? `<p style="margin:14px 0 6px;color:#667;font-size:13px">${hesc(String(E.reply.copyLabel || "What you sent us"))}</p>${table}` : "";
      jobs.push(sendMail(env, String(data.email).trim(), subject, WRAP(paras(body) + copy), owners[0] || (EMAIL_RE.test(c?.contact?.email || "") ? c.contact.email : void 0)));
    }
  }
  await Promise.allSettled(jobs);
  return said;
}
var ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "\u2019", lsquo: "\u2018", rdquo: "\u201D", ldquo: "\u201C", ndash: "\u2013", mdash: "\u2014", hellip: "\u2026" };
var unent = (t) => t.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => e[0] === "#" ? String.fromCodePoint(parseInt(e[1] === "x" || e[1] === "X" ? e.slice(2) : e.slice(1), e[1] === "x" || e[1] === "X" ? 16 : 10) || 32) : ENT[e.toLowerCase()] ?? m);
function outlineOf(html) {
  const h = html.replace(/<(script|style|noscript|svg|template|iframe)[\s\S]*?<\/\1>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ");
  const clean = (x) => unent(x.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  const out = [];
  const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(h);
  if (t) out.push("TITLE: " + clean(t[1]));
  const d = /<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i.exec(h) || /<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i.exec(h);
  if (d) out.push("DESCRIPTION: " + clean(d[1]));
  const re = /<(h[1-4]|li|p|dt|dd|blockquote|figcaption)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  const seen = /* @__PURE__ */ new Set();
  while (m = re.exec(h)) {
    const x = clean(m[2]);
    if (x.length < 3 || seen.has(x)) continue;
    seen.add(x);
    const tag = m[1].toLowerCase();
    out.push(tag[0] === "h" ? "\n" + tag.toUpperCase() + ": " + x : tag === "li" ? "- " + x : x);
  }
  return out.join("\n").slice(0, 9e3);
}
var words = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
function copiedBits(o, src, n = 6) {
  const grams = /* @__PURE__ */ new Set();
  const w = words(src);
  for (let i = 0; i + n <= w.length; i++) grams.add(w.slice(i, i + n).join(" "));
  const hit = [];
  const walk = (v, path) => {
    if (typeof v === "string") {
      const x = words(v);
      for (let i = 0; i + n <= x.length; i++) if (grams.has(x.slice(i, i + n).join(" "))) {
        hit.push(path);
        return;
      }
    } else if (Array.isArray(v)) v.forEach((y, i) => walk(y, path + "." + i));
    else if (v && typeof v === "object") for (const k of Object.keys(v)) walk(v[k], path ? path + "." + k : k);
  };
  walk(o, "");
  return hit;
}
var BRIEF_KEYS = "brand_tagline, hero_eyebrow, hero_title, hero_text, hero_cta, about_title, about_text, mission, vision, values (4 \xD7 {title, text}), services_title, services_intro, services (up to 6 \xD7 {title, text}), process (4 \xD7 {title, text}), faq (up to 6 \xD7 {q, a}), banner_title, banner_text, cta_title, cta_text, seo_title, seo_description, footer_text";
var GOOGLE_HOSTS = /^(?:[\w-]+\.)*(?:google\.[a-z.]{2,6}|goo\.gl|g\.co|g\.page)$/i;
async function placesCall(key, url, body, mask) {
  const r = await fetch(url, { method: body ? "POST" : "GET", headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": mask, ...body ? { "Content-Type": "application/json" } : {} }, body: body ? JSON.stringify(body) : void 0 });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const m = String(j?.error?.message || r.status), st = String(j?.error?.status || "");
    if (/API key not valid|API_KEY_INVALID/i.test(m)) throw new Error("Google says that API key isn't valid. Check you copied all of it.");
    if (st === "PERMISSION_DENIED" || /not been used|disabled|not authorized/i.test(m)) throw new Error('Turn on "Places API (New)" for this key in Google Cloud (APIs & Services \u2192 Library), then try again.');
    if (r.status === 429) throw new Error("Google's limit for this key was reached. Try again later.");
    throw new Error("Google answered: " + m);
  }
  return j;
}
async function googleReviews(q) {
  const key = String(q.key || "").trim(), raw = String(q.link || "").trim().slice(0, 600);
  if (!/^AIza[\w-]{30,}$/.test(key)) return { error: "Paste a Google Maps Platform API key (it starts with AIza)." };
  if (!raw) return { error: "Paste the business's Google Maps link, or its name and city." };
  let id = "", text = "", ll = null;
  try {
    if (/^https?:\/\//i.test(raw)) {
      let u = new URL(raw);
      if (!GOOGLE_HOSTS.test(u.hostname)) return { error: "That isn't a Google Maps link. Open the business on Google Maps, press Share, and copy the link." };
      if (!/google\./i.test(u.hostname)) {
        const r = await fetch(u.href, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0" } });
        u = new URL(r.url);
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
      const s = await placesCall(key, "https://places.googleapis.com/v1/places:searchText", { textQuery: text, maxResultCount: 1, ...ll ? { locationBias: { circle: { center: ll, radius: 500 } } } : {} }, "places.id");
      id = s?.places?.[0]?.id || "";
      if (!id) return { error: `Google found no place for "${text}". Try the name with its area and city.` };
    }
    const d = await placesCall(key, `https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`, null, "id,displayName,formattedAddress,rating,userRatingCount,reviews,googleMapsUri");
    const S = (v, n) => String(v ?? "").trim().slice(0, n);
    return {
      place: { id: d.id, name: S(d.displayName?.text, 120), address: S(d.formattedAddress, 200), rating: +d.rating || 0, count: +d.userRatingCount || 0, url: S(d.googleMapsUri, 300) },
      reviews: (d.reviews || []).map((r) => ({ rating: +r.rating || 0, text: S(r.text?.text || r.originalText?.text, 1500), author: S(r.authorAttribution?.displayName, 80), authorUrl: S(r.authorAttribution?.uri, 300), when: S(r.relativePublishTimeDescription, 40), time: S(r.publishTime, 40) })).filter((r) => r.text && r.author)
    };
  } catch (e) {
    return { error: e?.message || String(e) };
  }
}
var VISION = ["@cf/meta/llama-4-scout-17b-16e-instruct", "@cf/meta/llama-3.2-11b-vision-instruct"];
async function readImage(env, dataUri) {
  const ask = "Transcribe ALL the text in this product pamphlet image exactly as printed: product names, prices, specifications, features, model numbers, contact details. Keep tables as 'label: value' lines. Output only the text.";
  let last;
  for (const model of VISION) {
    try {
      if (model.includes("3.2")) await env.AI.run(model, { prompt: "agree" }).catch(() => null);
      const r = await env.AI.run(model, { messages: [{ role: "user", content: [{ type: "text", text: ask }, { type: "image_url", image_url: { url: dataUri } }] }], max_tokens: 2048 });
      const t = String(r?.response ?? "").trim();
      if (t) return t;
    } catch (e) {
      last = e;
    }
  }
  throw last || new Error("Couldn't read the image.");
}
function productsIn(v, depth = 0) {
  if (typeof v === "string") {
    const t = v.replace(/```(?:json)?/gi, "");
    for (const m of [/\{[\s\S]*/, /\[[\s\S]*/]) {
      const x = m.exec(t.trim());
      if (x) {
        const o = parseLoose(x[0].replace(/\s*```?\s*$/, ""));
        if (o) return productsIn(o, depth);
      }
    }
    return [];
  }
  if (Array.isArray(v)) return v.filter((x) => x && typeof x === "object");
  if (!v || typeof v !== "object" || depth > 3) return [];
  if (Array.isArray(v.products)) return productsIn(v.products);
  if (v.name || v.product_name || v.model || v.title) return [v];
  for (const k of Object.keys(v)) {
    const x = productsIn(v[k], depth + 1);
    if (x.length) return x;
  }
  return [];
}
function parseLoose(t) {
  try {
    return JSON.parse(t);
  } catch {
  }
  for (let end = t.length; end > 0; end = t.lastIndexOf("}", end - 1)) {
    const full = end === t.length, head = full ? t : t.slice(0, end + 1);
    let st = [], inStr = false;
    for (let i = 0; i < head.length; i++) {
      const c = head[i];
      if (inStr) {
        if (c === "\\") i++;
        else if (c === '"') inStr = false;
      } else if (c === '"') inStr = true;
      else if (c === "{" || c === "[") st.push(c === "{" ? "}" : "]");
      else if (c === "}" || c === "]") st.pop();
    }
    if (inStr && !full) continue;
    try {
      return JSON.parse(head.replace(/[,:]\s*$/, "") + (inStr ? '"' : "") + st.reverse().join(""));
    } catch {
    }
    if (end < t.length - 2e4) break;
  }
  return null;
}
var specList = (v) => Array.isArray(v) ? v : v && typeof v === "object" ? Object.entries(v).map(([label, value]) => ({ label, value: String(value) })) : [];
function fromText(all) {
  const lines = all.split(/\n/).map((l) => l.replace(/^[-•*#>\s]+|\s+$/g, "").replace(/\*\*/g, "")).filter((l) => l && !/^--- PAGE/.test(l));
  const model = /\b[A-Z]{1,6}[- ]?\d{2,5}[A-Z]?\b/;
  let name = "", at = -1;
  for (let i = 0; i < lines.length && !name; i++) {
    const l = lines[i];
    if (l.length > 60 || !model.test(l) || /:|\|/.test(l)) continue;
    at = i;
    const prev = lines[i - 1] || "";
    name = (/^[A-Z][A-Z0-9&.\- ]{1,24}$/.test(prev) && !model.test(prev) && !l.toUpperCase().includes(prev.toUpperCase()) ? prev + " " : "") + l;
  }
  if (!name) name = lines.find((l) => l.length >= 3 && l.length <= 50 && /^[A-Z0-9][A-Z0-9&.\- ]+$/.test(l)) || "";
  if (!name) return [];
  const specs = [];
  for (const l of lines) {
    const m = /^([A-Za-z][^:|]{1,60}?)\s*[:|]\s*([^|]{1,120}?)\s*\|?$/.exec(l);
    if (m && !/https?$/i.test(m[1]) && !/phone|email|call|www/i.test(m[1])) specs.push({ label: m[1].trim(), value: m[2].trim() });
  }
  const summary = lines.filter((l) => l.length > 70 && /[a-z]/.test(l) && !/:/.test(l)).sort((a, b) => b.length - a.length)[0] || "";
  const fi = lines.findIndex((l) => /^key\s*features|^features/i.test(l)), features = [];
  if (fi >= 0) for (const l of lines.slice(fi + 1)) {
    if (/:|\|/.test(l) || l.length > 90 || !/[a-z]/.test(l) || features.length >= 8) break;
    if (l.length > 3) features.push(l);
  }
  const next = lines[at + 1] || "", kind = /welder|machine|system|series|inverter|pump|motor|printer|unit/i;
  const cat = at >= 0 && next.length < 50 && !/:/.test(next) && /^[A-Z]/.test(next) && next.split(" ").length >= 2 ? next : lines.find((l) => l.length < 50 && kind.test(l) && l !== name) || "";
  const category = cat.replace(/\s*[-–]\s*premium$/i, "").toLowerCase().replace(/^./, (c) => c.toUpperCase()).replace(/\b(saw|mig|tig|mma|igbt|ac|dc)\b/gi, (w) => w.toUpperCase());
  return [{ name: name.replace(/\s+/g, " "), category, summary, features, specs, details: "", price: "", page: 1 }];
}
var PRODUCT_KEYS = `{"products":[{"name":"","category":"","summary":"one or two sentences","price":"exactly as printed, or empty","features":["short points"],"details":"a fuller description in paragraphs","specs":[{"label":"","value":""}],"page":1}]}`;
async function readPamphlet(env, q) {
  const pages = [];
  const text = String(q.text || "").slice(0, 6e4);
  if (text.trim()) pages.push(text);
  const imgs = (Array.isArray(q.images) ? q.images : []).slice(0, 8);
  try {
    for (const im of imgs) {
      const uri = String(im?.data || "");
      if (!/^data:image\/(jpeg|png|webp);base64,/.test(uri) || uri.length > 45e5) continue;
      pages.push(`--- PAGE ${+im.page || pages.length + 1} ---
` + await readImage(env, uri));
    }
  } catch (e) {
    return { error: /neuron|quota|limit|429/i.test(String(e?.message || e)) ? "Today's free AI allowance is used up. Try again tomorrow." : "Couldn't read the pamphlet's pictures: " + (e?.message || e) };
  }
  const all = pages.join("\n\n").slice(0, 24e3);
  if (words(all).length < 12) return { error: "Couldn't find any text in that pamphlet. Try a clearer photo or the original PDF." };
  const sys = `You turn a business's own product pamphlet into catalogue entries. Return ONLY JSON shaped like ${PRODUCT_KEYS}. One entry per distinct product or model. Rules: use only what the pamphlet says; never invent prices, numbers, ratings, certifications or features; copy prices, model numbers and specification values exactly as printed; leave a field empty ("" or []) when the pamphlet doesn't say; category is a short group name the pamphlet suggests (or ""); summary is one or two plain sentences; features are short points; specs are label/value pairs from tables or lists; page is the page number (from the --- PAGE n --- markers) where the product appears, or 1. Skip company contact details, terms and general marketing text.`;
  const model = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
  const user = (q.hint ? "Note from the owner: " + String(q.hint).slice(0, 500) + "\n\n" : "") + "PAMPHLET TEXT:\n" + all;
  const S = (v, n = 2e3) => typeof v === "string" || typeof v === "number" ? String(v).trim().slice(0, n) : "";
  const clean = (list) => list.map((p) => ({
    name: S(p?.name ?? p?.product_name ?? p?.productName ?? p?.product ?? p?.model ?? p?.title, 120),
    category: S(p?.category, 60),
    summary: S(p?.summary ?? p?.description, 400),
    price: S(p?.price, 60),
    features: (Array.isArray(p?.features) ? p.features : []).map((x) => S(x, 160)).filter(Boolean).slice(0, 12),
    details: S(p?.details, 3e3),
    specs: specList(p?.specs ?? p?.specifications).map((x) => ({ label: S(x?.label, 80), value: S(x?.value, 200) })).filter((x) => x.label || x.value).slice(0, 30),
    page: Math.max(1, Math.min(99, parseInt(p?.page, 10) || 1))
  })).filter((p) => p.name).slice(0, 60);
  let products = [], guessed = false;
  for (const json2 of [true, false]) {
    let r;
    try {
      r = await env.AI.run(model, { messages: [{ role: "system", content: sys }, { role: "user", content: user }], max_tokens: json2 ? 4e3 : 6e3, temperature: 0.1, ...json2 ? { response_format: { type: "json_object" } } : {} });
    } catch (e) {
      if (/neuron|quota|limit|429/i.test(String(e?.message || e))) return { error: "Today's free AI allowance is used up. Try again tomorrow." };
      if (!json2) break;
      continue;
    }
    products = clean(productsIn(r?.response ?? r));
    if (products.length) break;
  }
  if (!products.length) {
    products = clean(fromText(all));
    guessed = products.length > 0;
  }
  if (!products.length) return { error: 'No products were found in that pamphlet. Add a note naming the product (for example "one product: MZ 1250 welder") and try again.' };
  return { products, read: words(all).length, ...guessed ? { guessed: true } : {} };
}
async function translateTexts(env, q) {
  const to = oneLine(String(q.to || "")).slice(0, 40), from = oneLine(String(q.from || "English")).slice(0, 40);
  const texts = (Array.isArray(q.texts) ? q.texts : []).slice(0, 30).map((x) => String(x ?? "").slice(0, 1500));
  if (!/^[\p{L} ()-]{2,40}$/u.test(to) || !texts.length) return { error: "Choose a language and some text." };
  const sys = `You translate the text of a small business website from ${from} into ${to}, written in ${to}'s own script. Rules: translate naturally, the way a good ${to} website for Indian customers reads, not word for word; keep brand and product names, people's names, numbers, prices, units, emails, web addresses and emoji exactly as they are; keep every line break and every marker exactly where it is (**bold**, ==highlight==, __underline__, {accent:\u2026}, list dashes, #, | table bars, HTML tags, {placeholders} in curly brackets); short labels stay short; never add notes or explanations. You receive a JSON object {"texts": [...]} and answer with only a JSON object {"t": [...]} holding the same number of strings in the same order.`;
  const ask = async (list) => {
    const r = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", { messages: [{ role: "system", content: sys }, { role: "user", content: JSON.stringify({ texts: list }) }], max_tokens: 6e3, temperature: 0.2, response_format: { type: "json_object" } });
    const raw = typeof r?.response === "string" ? r.response : JSON.stringify(r?.response ?? r);
    let j;
    try {
      j = JSON.parse(raw);
    } catch {
      const m = /\{[\s\S]*\}/.exec(raw);
      j = m ? JSON.parse(m[0]) : null;
    }
    const out = Array.isArray(j?.t) ? j.t : null;
    if (!out || out.length !== list.length) throw new Error("count");
    return out.map((x) => typeof x === "string" && x.trim() ? x.slice(0, 4e3) : null);
  };
  try {
    return { t: await ask(texts) };
  } catch {
    const out = [];
    const half = Math.ceil(texts.length / 2);
    for (const part of [texts.slice(0, half), texts.slice(half)]) {
      if (!part.length) continue;
      try {
        out.push(...await ask(part));
      } catch {
        for (const one of part) {
          try {
            out.push((await ask([one]))[0]);
          } catch {
            out.push(null);
          }
        }
      }
    }
    return { t: out };
  }
}
function publicUrl(url) {
  if (!/^https:\/\/[^\s/]+\.[^\s]+$/i.test(url)) return null;
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  return /^(localhost|[\d.]+|\[.*\])$/.test(host) || /\.(local|internal|localhost)$/.test(host) ? null : u;
}
async function lookAt(url) {
  const u = publicUrl(url.trim());
  if (!u) return { error: "Enter the page's public address (https://\u2026)." };
  const get = async (x, accept) => {
    const r = await fetch(x, { headers: { "User-Agent": "Mozilla/5.0 (site-studio reference reader)", Accept: accept }, redirect: "follow" });
    if (!r.ok) throw new Error(String(r.status));
    return (await r.text()).slice(0, 15e5);
  };
  let html = "";
  try {
    html = await get(u.href, "text/html");
  } catch (e) {
    return { error: /^\d+$/.test(String(e?.message)) ? `That page answered ${e.message}.` : "Couldn't open that address." };
  }
  let css = "";
  for (const link of sheetLinks(html, u.href).slice(0, 5)) {
    if (!publicUrl(link) || css.length > 25e5) continue;
    try {
      css += "\n" + await get(link, "text/css");
    } catch {
    }
  }
  return { digest: digestPage(html, css) };
}
async function writeSite(env, q) {
  const brand = String(q.brand || "").trim().slice(0, 80), notes = String(q.notes || "").slice(0, 1500), kind = String(q.kind || "business");
  if (!brand) return { error: "Enter your brand name." };
  let src = String(q.text || "").slice(0, 2e4);
  if (!src.trim()) {
    const url = String(q.url || "").trim();
    if (!/^https:\/\/[^\s/]+\.[^\s]+$/i.test(url)) return { error: "Enter the site's address (https://\u2026)." };
    const host = new URL(url).hostname.toLowerCase();
    if (/^(localhost|[\d.]+|\[.*\])$/.test(host) || /\.(local|internal|localhost)$/.test(host)) return { error: "Use the site's public address." };
    let r;
    try {
      r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (site-studio reference reader)", Accept: "text/html" }, redirect: "follow" });
    } catch {
      return { error: "Couldn't open that address." };
    }
    if (!r.ok) return { error: `That site answered ${r.status}.` };
    const html = (await r.text()).slice(0, 3e6);
    src = outlineOf(html);
  }
  if (words(src).length < 40) return { error: "That page has almost no text to read (it may build its text with JavaScript). Paste the page's text into the box instead.", thin: true };
  const sys = `You write website copy for small businesses. You are given a REFERENCE website's outline only to understand what kind of business it is and which topics a site like it covers. Write completely NEW, original copy for a different business named "${brand}". Rules: never reuse the reference's sentences, phrases, slogans or distinctive wording; never mention the reference business, its name, people, clients, prices, numbers, years, awards or locations; do not invent facts (no years, statistics, client names, awards, certifications, prices or testimonials); keep claims general and honest; use the name ${brand} naturally; plain, warm, professional English; short sentences. Site type: ${kind}. Return ONLY a JSON object with these keys: ${BRIEF_KEYS}. Every value is a string or an array as described; use "" when a key doesn't fit.`;
  const user = `${notes ? "About " + brand + " (from the owner, use this): " + notes + "\n\n" : ""}REFERENCE OUTLINE (for topics only, do not copy):
${src.slice(0, 7e3)}`;
  const model = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
  const ask = async (messages) => {
    const r = await env.AI.run(model, { messages, max_tokens: 3e3, temperature: 0.8, response_format: { type: "json_object" } });
    const t = typeof r?.response === "string" ? r.response : JSON.stringify(r?.response ?? r);
    try {
      return JSON.parse(t);
    } catch {
      const m = /\{[\s\S]*\}/.exec(t);
      if (m) return JSON.parse(m[0]);
      throw new Error("The writer returned something unreadable. Try again.");
    }
  };
  let brief;
  try {
    brief = await ask([{ role: "system", content: sys }, { role: "user", content: user }]);
  } catch (e) {
    return { error: /neuron|quota|limit|429/i.test(String(e?.message || e)) ? "Today's free AI allowance is used up. Try again tomorrow." : "Couldn't write the text: " + (e?.message || e) };
  }
  let flagged = copiedBits(brief, src);
  if (flagged.length) {
    try {
      const again = await ask([
        { role: "system", content: sys },
        { role: "user", content: user },
        { role: "assistant", content: JSON.stringify(brief) },
        { role: "user", content: `These fields reuse wording from the reference: ${flagged.join(", ")}. Rewrite them in completely different words (keep the rest). Return the whole JSON again.` }
      ]);
      if (again && typeof again === "object") {
        brief = again;
        flagged = copiedBits(brief, src);
      }
    } catch {
    }
  }
  return { brief, flagged, words: words(src).length };
}
var db_worker_default = {
  async fetch(req, env, ctx) {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const u = new URL(req.url), p = u.pathname.replace(/\/+$/, "") || "/";
    try {
      if (p === "/") return json({ ok: true, service: "site-studio-db", v: V, mail: !!(env.RESEND_API_KEY && env.MAIL_FROM), ...env.CF_TOKEN && env.CF_ACCOUNT ? { deploy: true, account: env.CF_ACCOUNT } : {}, ...env.GH_TOKEN ? { gh: true } : {}, ...env.AI ? { ai: true, pamphlet: 2 } : {}, reviews: true, look: 1, translate: 1, accounts: 2, cfx: 4, studioPages: 1, del: 1, enqMail: 3, ...otherAccounts(env).length ? { more: otherAccounts(env).length } : {} });
      if (p === "/auth/code" && req.method === "POST") {
        const { email: raw, site: forSite, studio: forStudio } = await req.json();
        const email2 = String(raw || "").trim().toLowerCase();
        if (!emailOk(email2)) return err(400, "Enter a valid email.");
        const known = await env.DB.prepare("select 1 from members where email = ? limit 1").bind(email2).first();
        if (!known) return err(403, `${email2} isn't a member here. Ask the owner to add you.`);
        const prev = await env.DB.prepare("select sent from codes where email = ?").bind(email2).first();
        if (prev && Date.now() - prev.sent < 45e3) return err(429, "A code was just sent. Wait a minute before asking for another.");
        const code = String(1e5 + crypto.getRandomValues(new Uint32Array(1))[0] % 9e5);
        await env.DB.prepare("insert into codes (email, hash, expires, tries, sent) values (?, ?, ?, 0, ?) on conflict (email) do update set hash = excluded.hash, expires = excluded.expires, tries = 0, sent = excluded.sent").bind(email2, b64u(await hmac(env.SECRET, "c:" + email2 + ":" + code)), Date.now() + 10 * 6e4, Date.now()).run();
        let subject = "Your sign-in code", intro = `Enter this code to sign in${env.NAME ? " to " + env.NAME : ""}:`, footer = "It works for 10 minutes. If you didn't ask for it, ignore this email.", heading = "Your sign-in code";
        if (typeof forSite === "string" && /^[a-z0-9][a-z0-9-]{0,59}$/.test(forSite) && await env.DB.prepare("select 1 from members where email = ? and scope = ? limit 1").bind(email2, "site:" + forSite).first()) {
          const c = await siteContent(env, forSite).catch(() => null), T = c?.emails?.signin;
          if (T && typeof T === "object") {
            const vars = { site: siteName(c, forSite), email: email2 };
            if (T.subject) {
              subject = oneLine(fill(String(T.subject), vars)).slice(0, 150) || subject;
              heading = subject;
            }
            if (T.intro) intro = fill(String(T.intro), vars);
            if (T.footer) footer = fill(String(T.footer), vars);
          }
        } else if (typeof forStudio === "string" && /^[a-z0-9][a-z0-9-]{0,59}$/.test(forStudio) && await env.DB.prepare("select 1 from members where email = ? and scope = ? limit 1").bind(email2, "studio:" + forStudio).first()) {
          let E = null;
          try {
            const f = await readFile(env, "studio:" + forStudio, "public/emails.json");
            if (f) E = JSON.parse(new TextDecoder().decode(f.bytes));
          } catch {
          }
          const T = E?.signin;
          if (T && typeof T === "object") {
            const nm = oneLine(String(E.name || env.NAME || "the Studio")).slice(0, 80), vars = { studio: nm, site: nm, email: email2 };
            if (T.subject) {
              subject = oneLine(fill(String(T.subject), vars)).slice(0, 150) || subject;
              heading = subject;
            }
            if (T.intro) intro = fill(String(T.intro), vars);
            if (T.footer) footer = fill(String(T.footer), vars);
          }
        }
        await sendMail(env, email2, subject, WRAP(`<h2 style="margin:0 0 12px;font-size:20px">${hesc(heading)}</h2>${paras(intro)}<p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:0 0 14px">${code}</p>${paras(footer, "margin:0 0 8px;color:#667;font-size:13px")}`));
        return json({ ok: true });
      }
      if (p === "/auth/verify" && req.method === "POST") {
        const b = await req.json();
        const email2 = String(b.email || "").trim().toLowerCase(), code = String(b.code || "").trim();
        const c = await env.DB.prepare("select hash, expires, tries from codes where email = ?").bind(email2).first();
        if (!c || c.expires < Date.now()) return err(403, "The code has expired. Ask for a new one.");
        if (c.tries >= 5) return err(429, "Too many tries. Ask for a new code.");
        if (b64u(await hmac(env.SECRET, "c:" + email2 + ":" + code)) !== c.hash) {
          await env.DB.prepare("update codes set tries = tries + 1 where email = ?").bind(email2).run();
          return err(403, "That code isn't right.");
        }
        await env.DB.prepare("delete from codes where email = ?").bind(email2).run();
        return json({ token: await sessionFor(env, email2), email: email2 });
      }
      if (p === "/me") {
        const e = await who(env, req);
        if (!e) return err(401, "Sign in first.");
        const rows = (await env.DB.prepare("select scope, role from members where email = ?").bind(e).all()).results || [];
        return json({ email: e, scopes: rows });
      }
      if (p.startsWith("/p/") && req.method === "GET") {
        const [, , site, ...rest] = p.split("/");
        const path2 = decodeURIComponent(rest.join("/"));
        if (!/^[a-z0-9][a-z0-9-]{0,59}$/.test(site) || !pathOk(path2) || !publicPath(path2)) return err(404, "Not found.");
        const f = await readFile(env, "site:" + site, path2);
        if (!f) return err(404, "Not found.");
        return new Response(f.bytes, { headers: { ...cors, "Content-Type": f.type || typeOf(path2), "Cache-Control": path2.startsWith("assets/") && !path2.startsWith("assets/data/") ? "public, max-age=31536000, immutable" : "no-store", "x-sha": f.sha, "x-updated": f.updated_at } });
      }
      if (p.startsWith("/sp/") && req.method === "GET") {
        const id = p.split("/")[2] || "";
        if (!/^[a-z0-9][a-z0-9-]{0,59}$/.test(id)) return err(404, "Not found.");
        const f = await readFile(env, "studio:" + id, "public/pages.json");
        if (!f) return err(404, "Not found.");
        return new Response(f.bytes, { headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
      }
      if (p.startsWith("/enquire/") && req.method === "POST") {
        const site = p.split("/")[2];
        if (!/^[a-z0-9][a-z0-9-]{0,59}$/.test(site)) return err(404, "Not found.");
        const raw = await req.text();
        if (raw.length > 2e4) return err(413, "Too long.");
        const q = JSON.parse(raw || "{}");
        if (q.website) return json({ ok: true });
        const data = {};
        for (const [k, v] of Object.entries(q.data || {}).slice(0, 25)) if (/^[a-z0-9][\w-]{0,39}$/i.test(k) && v != null && String(v).trim()) data[k] = String(v).slice(0, 5e3);
        if (!Object.keys(data).length) return err(400, "The form was empty.");
        const made = await env.DB.prepare("insert into enquiries (site, data, page, created_at) values (?, ?, ?, ?) returning id").bind(site, JSON.stringify(data), String(q.page || "").slice(0, 200), (/* @__PURE__ */ new Date()).toISOString()).first();
        const rowId = made?.id;
        const mail = notifyEnquiry(env, site, data, String(q.page || "").slice(0, 200)).catch((e) => "Not emailed: " + String(e?.message || e).slice(0, 300)).then((said) => said && rowId ? env.DB.prepare("update enquiries set data = ? where id = ? and site = ?").bind(JSON.stringify({ ...data, _mail: said }), rowId, site).run() : null).catch(() => {
        });
        if (ctx?.waitUntil) ctx.waitUntil(mail);
        else await mail;
        return json({ ok: true });
      }
      if (p === "/reviews/google" && req.method === "POST") {
        const email2 = await who(env, req);
        if (!email2) return err(401, "Sign in first.");
        if (!await env.DB.prepare("select 1 from members where email = ? and role in ('owner', 'partner') limit 1").bind(email2).first()) return err(403, "Only owners can use this.");
        return json(await googleReviews(await req.json()));
      }
      if (p === "/ai/products" && req.method === "POST") {
        const email2 = await who(env, req);
        if (!email2) return err(401, "Sign in first.");
        if (!await env.DB.prepare("select 1 from members where email = ? and role in ('owner', 'partner') limit 1").bind(email2).first()) return err(403, "Only owners can use this.");
        if (!env.AI) return err(501, "Reading pamphlets needs the database updated once (from a device with the Cloudflare token).");
        return json(await readPamphlet(env, await req.json()));
      }
      if (p === "/ai/translate" && req.method === "POST") {
        const email2 = await who(env, req);
        if (!email2) return err(401, "Sign in first.");
        if (!await env.DB.prepare("select 1 from members where email = ? limit 1").bind(email2).first()) return err(403, "Only members can use this.");
        if (!env.AI) return json({ error: "Translating needs Workers AI on this database. Update the database once (Settings \u2192 Hostings)." });
        return json(await translateTexts(env, await req.json()));
      }
      if (p === "/ai/look" && req.method === "POST") {
        const email2 = await who(env, req);
        if (!email2) return err(401, "Sign in first.");
        if (!await env.DB.prepare("select 1 from members where email = ? limit 1").bind(email2).first()) return err(403, "Only members can use this.");
        return json(await lookAt(String((await req.json()).url || "")));
      }
      if (p === "/ai/write" && req.method === "POST") {
        const email2 = await who(env, req);
        if (!email2) return err(401, "Sign in first.");
        if (!await env.DB.prepare("select 1 from members where email = ? and role in ('owner', 'partner') limit 1").bind(email2).first()) return err(403, "Only owners can use this.");
        if (!env.AI) return err(501, "Writing needs the database updated once (Settings \u2192 Hosting accounts, from a device with the Cloudflare token).");
        return json(await writeSite(env, await req.json()));
      }
      const email = await who(env, req);
      if (!email) return err(401, "Sign in first.");
      const scope = u.searchParams.get("scope") || "";
      if (!scopeOk(scope)) return err(400, "Unknown scope.");
      const role = await roleOf(env, scope, email);
      if (!role) return err(403, `${email} isn't a member of this ${scope.startsWith("site:") ? "site" : "Studio"}.`);
      if (p === "/f/list") {
        const pre = u.searchParams.get("prefix") || "";
        const rows = (await env.DB.prepare("select path from files where scope = ? and substr(path, 1, ?) = ? order by path").bind(scope, pre.length, pre).all()).results || [];
        return json(rows.map((r) => r.path));
      }
      const path = u.searchParams.get("path") || "";
      if (p === "/f/meta") {
        const f = await env.DB.prepare("select sha, size, updated_at from files where scope = ? and path = ?").bind(scope, path).first();
        return json(f || null);
      }
      if (p === "/f/get") {
        const f = await readFile(env, scope, path);
        if (!f) return err(404, "Not found.");
        return new Response(f.bytes, { headers: { ...cors, "Content-Type": f.type || typeOf(path), "x-sha": f.sha, "x-updated": f.updated_at } });
      }
      if (p === "/f/put" && req.method === "PUT") {
        if (!pathOk(path)) return err(400, "Bad file name.");
        const want = u.searchParams.get("sha");
        if (want) {
          const cur = await env.DB.prepare("select sha from files where scope = ? and path = ?").bind(scope, path).first();
          if (cur && cur.sha !== want) return err(409, "The file changed since it was loaded.");
        }
        const sha = await writeFile(env, scope, path, new Uint8Array(await req.arrayBuffer()), req.headers.get("x-sha") || void 0);
        return json({ sha });
      }
      if (p === "/f/delete" && req.method === "POST") {
        const { paths } = await req.json();
        const list = (Array.isArray(paths) ? paths : []).filter(pathOk).slice(0, 500);
        await env.DB.batch(list.flatMap((x) => [env.DB.prepare("delete from chunks where scope = ? and path = ?").bind(scope, x), env.DB.prepare("delete from files where scope = ? and path = ?").bind(scope, x)]));
        return json({ ok: true, n: list.length });
      }
      if (p.startsWith("/cfx")) {
        if (!scope.startsWith("studio:")) return err(400, "Only for the Studio's own scope.");
        if (role !== "owner" && role !== "partner") return err(403, "Only the Studio's owners can change its hosting accounts.");
        const keepSecret = async (name, text) => {
          if (!env.CF_TOKEN || !env.CF_ACCOUNT) return err(409, "Turn on Publish from any device first (Settings), so the database can keep tokens itself.");
          const base = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT}/workers/scripts/${CFDB_WORKER_NAME}/secrets`;
          const r = text == null ? await fetch(base + "/" + name, { method: "DELETE", headers: { Authorization: "Bearer " + env.CF_TOKEN } }) : await fetch(base, { method: "PUT", headers: { Authorization: "Bearer " + env.CF_TOKEN, "Content-Type": "application/json" }, body: JSON.stringify({ name, text, type: "secret_text" }) });
          if (!r.ok && !(text == null && r.status === 404)) return err(502, "Cloudflare didn't keep it: " + ((await r.json().catch(() => null))?.errors?.[0]?.message || r.status));
          return null;
        };
        if (p === "/cfx" && req.method === "GET") return json({
          main: env.CF_TOKEN && env.CF_ACCOUNT ? env.CF_ACCOUNT : null,
          accounts: otherAccounts(env),
          // Sites every device can publish: "<worker>" on the main account, "<account>/<worker>" on another.
          workers: ((await env.DB.prepare("select worker from workers where scope = ? limit 500").bind(scope).all()).results || []).map((r) => String(r.worker).split("@")[0])
        });
        if (p === "/cfx/put" && req.method === "POST") {
          const b = await req.json(), token = String(b.token || "").trim();
          if (!/^[\w-]{20,200}$/.test(token)) return err(400, "Paste the account's Cloudflare API token.");
          const r = await fetch("https://api.cloudflare.com/client/v4/accounts?per_page=50", { headers: { Authorization: "Bearer " + token } });
          const list = (await r.json().catch(() => null))?.result || [];
          if (!r.ok || !list.length) return err(400, "Cloudflare didn't accept that token, or it can't see any account. Create it while signed in to that account.");
          const kept = [];
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
          const a = String((await req.json()).account || "");
          if (!/^[\w-]{1,64}$/.test(a)) return err(400, "Which account?");
          return await keepSecret("CFX_" + a.replace(/-/g, "_"), null) || json({ ok: true });
        }
        if (p === "/cfx/site" && req.method === "POST") {
          const b = await req.json(), a = String(b.account || ""), w = String(b.worker || "");
          if (!/^[\w-]{1,64}$/.test(a) || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(w)) return err(400, "Which site?");
          const main = a === env.CF_ACCOUNT;
          if (!main && !otherToken(env, a)) return err(409, "That Cloudflare account isn't kept here yet: add it first.");
          await env.DB.prepare("insert into workers (worker, scope) values (?, ?) on conflict (worker) do update set scope = excluded.scope").bind(main ? w : a + "/" + w + "@" + scope, scope).run();
          const site = String(b.site || "");
          if (/^[a-z0-9][a-z0-9-]{0,62}$/.test(site)) await env.DB.prepare("insert into workers (worker, scope) values (?, ?) on conflict (worker) do update set scope = excluded.scope").bind(main ? w : a + "/" + w + "@site:" + site, "site:" + site).run();
          return json({ ok: true });
        }
        if (p === "/cfx/db" && req.method === "POST") {
          const b = await req.json(), a = String(b.account || ""), site = String(b.site || ""), op = String(b.op || "");
          if (!/^[\w-]{1,64}$/.test(a) || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(site)) return err(400, "Which site?");
          const tok = otherToken(env, a) || (a === env.CF_ACCOUNT ? env.CF_TOKEN || "" : "");
          if (!tok) return err(409, "That Cloudflare account isn't kept here yet: add it in Settings \u2192 Sites and hosting accounts.");
          const cfa = async (path3, init = {}) => {
            const r = await fetch("https://api.cloudflare.com/client/v4/accounts/" + a + path3, { ...init, headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json" } });
            const j = await r.json().catch(() => null);
            if (!r.ok || !j?.success) {
              const e = new Error(j?.errors?.[0]?.message || "Cloudflare answered " + r.status);
              e.cf = true;
              throw e;
            }
            return j.result;
          };
          let dbId = String(b.db || "");
          const q = async (sql, params = []) => (await cfa(`/d1/database/${dbId}/query`, { method: "POST", body: JSON.stringify({ sql, params }) }))?.[0]?.results || [];
          const bytesOf = (v) => Array.isArray(v) ? new Uint8Array(v) : typeof v === "string" ? Uint8Array.from(atob(v), (c) => c.charCodeAt(0)) : v && Array.isArray(v.data) ? new Uint8Array(v.data) : new Uint8Array(0);
          const hex3 = (u2) => {
            let s = "";
            for (let i = 0; i < u2.length; i++) s += (u2[i] < 16 ? "0" : "") + u2[i].toString(16);
            return s;
          };
          const b64 = (u2) => {
            let s = "";
            for (let i = 0; i < u2.length; i += 32768) s += String.fromCharCode(...u2.subarray(i, i + 32768));
            return btoa(s);
          };
          const S2 = "site:" + site, path2 = String(b.path || "");
          try {
            if (!/^[\w-]{1,64}$/.test(dbId)) {
              const list = await cfa(`/d1/database?name=${encodeURIComponent(CFDB_WORKER_NAME)}`) || [];
              dbId = String(list.find((d) => d.name === CFDB_WORKER_NAME)?.uuid || "");
              if (!dbId) return err(404, "No Studio database on that Cloudflare account.");
            }
            if (op === "list") {
              const pre = String(b.prefix || "");
              return json({ db: dbId, paths: (await q("select path from files where scope = ? and substr(path, 1, ?) = ? order by path", [S2, pre.length, pre])).map((r) => r.path) });
            }
            if (op === "meta") return json({ db: dbId, meta: (await q("select sha, updated_at from files where scope = ? and path = ?", [S2, path2]))[0] || null });
            if (op === "get") {
              if (!pathOk(path2)) return err(400, "Bad file name.");
              const f = (await q("select sha, size, type, updated_at from files where scope = ? and path = ?", [S2, path2]))[0];
              if (!f) return json({ db: dbId, file: null });
              const parts = (await q("select data from chunks where scope = ? and path = ? order by n", [S2, path2])).map((r) => bytesOf(r.data));
              const all = new Uint8Array(parts.reduce((x, y) => x + y.length, 0));
              let o = 0;
              for (const x of parts) {
                all.set(x, o);
                o += x.length;
              }
              return json({ db: dbId, file: { b64: b64(all), sha: f.sha, type: f.type, updated_at: f.updated_at } });
            }
            if (op === "put") {
              if (!pathOk(path2)) return err(400, "Bad file name.");
              const bytes = bytesOf(String(b.b64 || ""));
              if (b.sha) {
                const cur = (await q("select sha from files where scope = ? and path = ?", [S2, path2]))[0];
                if (cur && cur.sha !== String(b.sha)) return err(409, "The file changed since it was loaded.");
              }
              const s = "c" + await sha1(bytes);
              let size = 7e5, n = Math.max(1, Math.ceil(bytes.length / size)), lit = false;
              const putChunk = async (i) => {
                const part = bytes.slice(i * size, (i + 1) * size);
                if (lit) await q(`insert into chunks (scope, path, n, data) values (?, ?, ?, X'${hex3(part)}') on conflict (scope, path, n) do update set data = excluded.data`, [S2, path2, i]);
                else await q("insert into chunks (scope, path, n, data) values (?, ?, ?, unhex(?)) on conflict (scope, path, n) do update set data = excluded.data", [S2, path2, i, hex3(part)]);
              };
              try {
                for (let i = 0; i < n; i++) await putChunk(i);
              } catch (e) {
                if (!/unhex|no such function/i.test(String(e?.message))) throw e;
                lit = true;
                size = 4e4;
                n = Math.max(1, Math.ceil(bytes.length / size));
                for (let i = 0; i < n; i++) await putChunk(i);
              }
              await q("insert into files (scope, path, sha, size, parts, type, updated_at) values (?, ?, ?, ?, ?, ?, ?) on conflict (scope, path) do update set sha = excluded.sha, size = excluded.size, parts = excluded.parts, type = excluded.type, updated_at = excluded.updated_at", [S2, path2, s, bytes.length, n, typeOf(path2), (/* @__PURE__ */ new Date()).toISOString()]);
              await q("delete from chunks where scope = ? and path = ? and n >= ?", [S2, path2, n]);
              return json({ db: dbId, sha: s });
            }
            if (op === "enq") {
              const sub = String(b.sub || "list");
              if (sub === "list") return json({ db: dbId, rows: (await q("select id, site, data, page, status, created_at from enquiries where site = ? order by created_at desc limit 500", [site])).map((r) => {
                let d = {};
                try {
                  d = JSON.parse(r.data);
                } catch {
                }
                return { ...r, data: d };
              }) });
              const id = Number(b.id);
              if (!Number.isInteger(id)) return err(400, "Which enquiry?");
              if (sub === "status") {
                const st = String(b.status || "");
                if (!["new", "read", "replied", "archived"].includes(st)) return err(400, "Unknown status.");
                await q("update enquiries set status = ? where id = ? and site = ?", [st, id, site]);
                return json({ db: dbId, ok: true });
              }
              if (sub === "delete") {
                await q("delete from enquiries where id = ? and site = ?", [id, site]);
                return json({ db: dbId, ok: true });
              }
              return err(400, "Unknown operation.");
            }
            if (op === "mem") {
              const sub = String(b.sub || "list");
              if (sub === "list") return json({ db: dbId, rows: await q("select email, role from members where scope = ? order by email", [S2]) });
              const e = String(b.email || "").trim().toLowerCase();
              if (!emailOk(e)) return err(400, "Enter a valid email.");
              if (sub === "add") {
                await q("insert into members (scope, email, role) values (?, ?, 'owner') on conflict (scope, email) do nothing", [S2, e]);
                return json({ db: dbId, ok: true });
              }
              if (sub === "remove") {
                await q("delete from members where scope = ? and email = ?", [S2, e]);
                return json({ db: dbId, ok: true });
              }
              return err(400, "Unknown operation.");
            }
            if (op === "delete") {
              const list = (Array.isArray(b.paths) ? b.paths : []).filter(pathOk).slice(0, 200);
              for (const x of list) {
                await q("delete from chunks where scope = ? and path = ?", [S2, x]);
                await q("delete from files where scope = ? and path = ?", [S2, x]);
              }
              return json({ db: dbId, n: list.length });
            }
            return err(400, "Unknown operation.");
          } catch (e) {
            return err(502, "Couldn't reach the site's database on its Cloudflare account: " + (e?.message || e));
          }
        }
        if (p === "/cfx/import" && req.method === "POST") {
          const b = await req.json(), a = String(b.account || ""), site = String(b.site || ""), step = String(b.step || "start");
          if (!/^[\w-]{1,64}$/.test(a) || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(site)) return err(400, "Which site?");
          const tok = otherToken(env, a);
          if (!tok) return err(409, "That Cloudflare account isn't kept here yet: add it first (Settings \u2192 Sites and hosting accounts).");
          const cfa = async (path2, init = {}) => {
            const r = await fetch("https://api.cloudflare.com/client/v4/accounts/" + a + path2, { ...init, headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json" } });
            const j = await r.json().catch(() => null);
            if (!r.ok || !j?.success) throw new Error(j?.errors?.[0]?.message || "Cloudflare answered " + r.status);
            return j.result;
          };
          const q = async (dbId, sql, params) => (await cfa(`/d1/database/${dbId}/query`, { method: "POST", body: JSON.stringify({ sql, params }) }))?.[0]?.results || [];
          const bytesOf = (v) => Array.isArray(v) ? new Uint8Array(v) : typeof v === "string" ? Uint8Array.from(atob(v), (c) => c.charCodeAt(0)) : v && Array.isArray(v.data) ? new Uint8Array(v.data) : new Uint8Array(0);
          const S2 = "site:" + site;
          try {
            if (step === "start") {
              const list = await cfa(`/d1/database?name=${encodeURIComponent(CFDB_WORKER_NAME)}`) || [];
              const dbId = String(list.find((d) => d.name === CFDB_WORKER_NAME)?.uuid || "");
              if (!dbId) return err(404, "No Studio database on that Cloudflare account.");
              const files = await q(dbId, "select path, sha, size, parts, type, updated_at from files where scope = ? order by path", [S2]);
              if (!files.some((f) => f.path === "content.json")) return err(404, `The site ${site} has no content in that database.`);
              const mem = await q(dbId, "select email, role from members where scope = ?", [S2]);
              for (const m of mem) if (emailOk(String(m.email || ""))) await env.DB.prepare("insert into members (scope, email, role) values (?, ?, ?) on conflict (scope, email) do nothing").bind(S2, String(m.email).toLowerCase(), ["owner", "member", "partner"].includes(m.role) ? m.role : "member").run();
              let enquiries = 0;
              if (!await env.DB.prepare("select 1 from enquiries where site = ? limit 1").bind(site).first()) {
                const rows = await q(dbId, "select data, page, status, created_at from enquiries where site = ? order by created_at limit 1000", [site]);
                for (const r of rows) await env.DB.prepare("insert into enquiries (site, data, page, status, created_at) values (?, ?, ?, ?, ?)").bind(site, String(r.data || "{}"), String(r.page || ""), String(r.status || "new"), String(r.created_at || (/* @__PURE__ */ new Date()).toISOString())).run();
                enquiries = rows.length;
              }
              return json({ db: dbId, files: files.map((f) => f.path), editors: mem.length, enquiries });
            }
            if (step === "file") {
              const dbId = String(b.db || ""), path2 = String(b.path || "");
              if (!/^[\w-]{1,64}$/.test(dbId) || !pathOk(path2)) return err(400, "Which file?");
              const f = (await q(dbId, "select sha, size, parts, type, updated_at from files where scope = ? and path = ?", [S2, path2]))[0];
              if (!f) return json({ ok: false, missing: path2 });
              const chunks = await q(dbId, "select n, data from chunks where scope = ? and path = ? order by n", [S2, path2]);
              await env.DB.batch([
                env.DB.prepare("delete from chunks where scope = ? and path = ?").bind(S2, path2),
                env.DB.prepare("insert into files (scope, path, sha, size, parts, type, updated_at) values (?, ?, ?, ?, ?, ?, ?) on conflict (scope, path) do update set sha = excluded.sha, size = excluded.size, parts = excluded.parts, type = excluded.type, updated_at = excluded.updated_at").bind(S2, path2, String(f.sha), Number(f.size) || 0, chunks.length || 1, String(f.type || ""), String(f.updated_at || (/* @__PURE__ */ new Date()).toISOString())),
                ...chunks.map((c) => env.DB.prepare("insert into chunks (scope, path, n, data) values (?, ?, ?, ?)").bind(S2, path2, Number(c.n) || 0, bytesOf(c.data)))
              ]);
              return json({ ok: true });
            }
          } catch (e) {
            return err(502, "Couldn't read the other account's database: " + (e?.message || e));
          }
          return err(400, "Unknown step.");
        }
        return err(404, "Not found.");
      }
      if (p === "/cf" && req.method === "POST") {
        if (role !== "owner" && role !== "partner") return err(403, "Only the owners of this site can publish it.");
        const q = await req.json(), method = String(q.method || "GET").toUpperCase(), path2 = String(q.path || "");
        const A = (/^\/accounts\/([\w-]+)\//.exec(path2) || [])[1] || env.CF_ACCOUNT || "";
        const tokenOf = otherToken(env, A) || (A === env.CF_ACCOUNT ? env.CF_TOKEN : "");
        if (!tokenOf) return err(501, "This database can't publish there: no Cloudflare token for that account is kept here.");
        const main = A === env.CF_ACCOUNT;
        const ACC = "/accounts/" + A + "/workers";
        let worker = "", useJwt = false, m;
        if (method === "GET" && path2 === ACC + "/subdomain") {
        } else if (method === "POST" && path2 === ACC + "/assets/upload?base64=true") useJwt = true;
        else if ((m = path2.match(/^\/accounts\/([\w-]+)\/workers\/scripts\/([a-z0-9][a-z0-9-]{0,62})(\/settings|\/assets-upload-session|\/subdomain|\?force=true)?$/)) && m[1] === A && (method === "GET" && m[3] === "/settings" || method === "POST" && (m[3] === "/assets-upload-session" || m[3] === "/subdomain") || method === "PUT" && !m[3] || method === "DELETE" && m[3] === "?force=true")) worker = m[2];
        else return err(403, "Not something publishing needs.");
        if (worker && !await env.DB.prepare("select 1 from workers where worker = ? and scope = ?").bind(main ? worker : A + "/" + worker + "@" + scope, scope).first()) return err(403, `The Worker ${worker} isn't registered to ${scope}. Publish once from a device with the Cloudflare token.`);
        const body = q.body64 ? Uint8Array.from(atob(String(q.body64)), (c) => c.charCodeAt(0)) : q.body != null ? String(q.body) : void 0;
        if (method === "PUT") {
          const text = typeof body === "string" ? body : new TextDecoder().decode(body);
          const mm = /name="metadata"[^\r\n]*\r\n(?:[^\r\n]+\r\n)*\r\n(\{[\s\S]*?\})\r\n--/.exec(text);
          let meta = null;
          try {
            meta = mm ? JSON.parse(mm[1]) : null;
          } catch {
            meta = null;
          }
          if (!meta || !Array.isArray(meta.bindings) || meta.bindings.some((x) => x?.type !== "assets") || meta.keep_bindings) return err(403, "A site's Worker can only be given its own files.");
        }
        if (useJwt && !/^[\w.~+/=-]{8,4096}$/.test(String(q.jwt || ""))) return err(400, "Missing upload token.");
        const r = await fetch("https://api.cloudflare.com/client/v4" + path2, { method, headers: { Authorization: "Bearer " + (useJwt ? q.jwt : tokenOf), ...q.contentType ? { "Content-Type": String(q.contentType) } : {} }, body: method === "GET" ? void 0 : body });
        return json({ status: r.status, body: await r.text() });
      }
      if (p === "/gh" && req.method === "POST") {
        if (!env.GH_TOKEN) return err(501, "This database can't reach GitHub: no GitHub token is kept here.");
        if (role !== "owner" && role !== "partner") return err(403, "Only this Studio's owners can publish its GitHub sites.");
        const q = await req.json(), repo = String(q.repo || "").toLowerCase(), path2 = String(q.path || ""), method = String(q.method || "GET").toUpperCase();
        if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || path2 && !/^\/[\w\-./%?=&,~]*$/.test(path2) || path2.includes("..") || !["GET", "PUT", "POST", "PATCH", "DELETE"].includes(method)) return err(400, "Not a GitHub call publishing needs.");
        if (!await env.DB.prepare("select 1 from repos where repo = ? and scope = ?").bind(repo, scope).first()) return err(403, `The repository ${repo} isn't registered to ${scope}. Turn on Publish from any device again from a Studio that has the GitHub token.`);
        const r = await fetch("https://api.github.com/repos/" + repo + path2, { method, headers: { Authorization: "Bearer " + env.GH_TOKEN, Accept: q.raw ? "application/vnd.github.raw+json" : "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "site-studio-db", ...q.body != null ? { "Content-Type": "application/json" } : {} }, body: method === "GET" ? void 0 : q.body != null ? String(q.body) : void 0 });
        const bytes = new Uint8Array(await r.arrayBuffer());
        let bin = "";
        for (let i = 0; i < bytes.length; i += 32768) bin += String.fromCharCode(...bytes.subarray(i, i + 32768));
        return json({ status: r.status, b64: btoa(bin), type: r.headers.get("content-type") || "" });
      }
      if (p === "/m") return json((await env.DB.prepare("select email, role, added_at from members where scope = ? order by email").bind(scope).all()).results || []);
      if (p === "/m/add" && req.method === "POST") {
        if (role !== "owner" && role !== "partner") return err(403, "Only owners can add people.");
        const b = await req.json();
        const e = String(b.email || "").trim().toLowerCase(), r = ["owner", "member", "partner"].includes(b.role) ? b.role : "member";
        if (!emailOk(e)) return err(400, "Enter a valid email.");
        await env.DB.prepare("insert into members (scope, email, role) values (?, ?, ?) on conflict (scope, email) do update set role = excluded.role").bind(scope, e, r).run();
        return json({ ok: true });
      }
      if (p === "/m/remove" && req.method === "POST") {
        if (role !== "owner" && role !== "partner") return err(403, "Only owners can remove people.");
        const b = await req.json();
        await env.DB.prepare("delete from members where scope = ? and email = ?").bind(scope, String(b.email || "").toLowerCase()).run();
        return json({ ok: true });
      }
      if (p === "/e/list") {
        const site = scope.replace(/^site:/, "");
        const rows = (await env.DB.prepare("select id, site, data, page, status, created_at from enquiries where site = ? order by created_at desc limit 500").bind(site).all()).results || [];
        return json(rows.map((r) => ({ ...r, data: JSON.parse(r.data) })));
      }
      if ((p === "/e/status" || p === "/e/delete") && req.method === "POST") {
        const b = await req.json();
        const site = scope.replace(/^site:/, "");
        if (p === "/e/status") {
          if (!["new", "read", "replied", "archived"].includes(b.status)) return err(400, "Unknown status.");
          await env.DB.prepare("update enquiries set status = ? where id = ? and site = ?").bind(b.status, b.id, site).run();
        } else await env.DB.prepare("delete from enquiries where id = ? and site = ?").bind(b.id, site).run();
        return json({ ok: true });
      }
      return err(404, "Not found.");
    } catch (e) {
      return err(500, e?.message || "Something went wrong.");
    }
  }
};
export {
  SCHEMA,
  copiedBits,
  db_worker_default as default,
  outlineOf
};
