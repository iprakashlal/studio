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
var CFDB_VERSION = 3;

// worker/db-worker.ts
var V = CFDB_VERSION;
var CHUNK = 9e5;
var enc = new TextEncoder();
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
async function sendMail(env, to, subject, html) {
  if (!env.RESEND_API_KEY || !env.MAIL_FROM) throw new Error("Email isn't set up on this database (Resend).");
  const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject, html }) });
  if (!r.ok) throw new Error("Resend didn't accept the email (" + r.status + "): " + (await r.text()).slice(0, 200));
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
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const u = new URL(req.url), p = u.pathname.replace(/\/+$/, "") || "/";
    try {
      if (p === "/") return json({ ok: true, service: "site-studio-db", v: V, mail: !!(env.RESEND_API_KEY && env.MAIL_FROM), ...env.CF_TOKEN && env.CF_ACCOUNT ? { deploy: true, account: env.CF_ACCOUNT } : {}, ...env.GH_TOKEN ? { gh: true } : {}, ...env.AI ? { ai: true } : {} });
      if (p === "/auth/code" && req.method === "POST") {
        const { email: raw } = await req.json();
        const email2 = String(raw || "").trim().toLowerCase();
        if (!emailOk(email2)) return err(400, "Enter a valid email.");
        const known = await env.DB.prepare("select 1 from members where email = ? limit 1").bind(email2).first();
        if (!known) return err(403, `${email2} isn't a member here. Ask the owner to add you.`);
        const prev = await env.DB.prepare("select sent from codes where email = ?").bind(email2).first();
        if (prev && Date.now() - prev.sent < 45e3) return err(429, "A code was just sent. Wait a minute before asking for another.");
        const code = String(1e5 + crypto.getRandomValues(new Uint32Array(1))[0] % 9e5);
        await env.DB.prepare("insert into codes (email, hash, expires, tries, sent) values (?, ?, ?, 0, ?) on conflict (email) do update set hash = excluded.hash, expires = excluded.expires, tries = 0, sent = excluded.sent").bind(email2, b64u(await hmac(env.SECRET, "c:" + email2 + ":" + code)), Date.now() + 10 * 6e4, Date.now()).run();
        await sendMail(env, email2, "Your sign-in code", `<h2>Your sign-in code</h2><p>Enter this code to sign in${env.NAME ? " to " + env.NAME : ""}:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>It works for 10 minutes. If you didn't ask for it, ignore this email.</p>`);
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
      if (p.startsWith("/enquire/") && req.method === "POST") {
        const site = p.split("/")[2];
        if (!/^[a-z0-9][a-z0-9-]{0,59}$/.test(site)) return err(404, "Not found.");
        const raw = await req.text();
        if (raw.length > 2e4) return err(413, "Too long.");
        const q = JSON.parse(raw || "{}");
        if (q.website) return json({ ok: true });
        const data = {};
        for (const [k, v] of Object.entries(q.data || {}).slice(0, 25)) if (/^[\w-]{1,40}$/.test(k) && v != null && String(v).trim()) data[k] = String(v).slice(0, 5e3);
        if (!Object.keys(data).length) return err(400, "The form was empty.");
        await env.DB.prepare("insert into enquiries (site, data, page, created_at) values (?, ?, ?, ?)").bind(site, JSON.stringify(data), String(q.page || "").slice(0, 200), (/* @__PURE__ */ new Date()).toISOString()).run();
        return json({ ok: true });
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
      if (p === "/cf" && req.method === "POST") {
        if (!env.CF_TOKEN || !env.CF_ACCOUNT) return err(501, "This database can't publish: no Cloudflare token is kept here.");
        if (role !== "owner" && role !== "partner") return err(403, "Only the owners of this site can publish it.");
        const q = await req.json(), method = String(q.method || "GET").toUpperCase(), path2 = String(q.path || ""), A = env.CF_ACCOUNT;
        const ACC = "/accounts/" + A + "/workers";
        let worker = "", useJwt = false, m;
        if (method === "GET" && path2 === ACC + "/subdomain") {
        } else if (method === "POST" && path2 === ACC + "/assets/upload?base64=true") useJwt = true;
        else if ((m = path2.match(/^\/accounts\/([\w-]+)\/workers\/scripts\/([a-z0-9][a-z0-9-]{0,62})(\/settings|\/assets-upload-session|\/subdomain)?$/)) && m[1] === A && (method === "GET" && m[3] === "/settings" || method === "POST" && (m[3] === "/assets-upload-session" || m[3] === "/subdomain") || method === "PUT" && !m[3])) worker = m[2];
        else return err(403, "Not something publishing needs.");
        if (worker && !await env.DB.prepare("select 1 from workers where worker = ? and scope = ?").bind(worker, scope).first()) return err(403, `The Worker ${worker} isn't registered to ${scope}. Publish once from a device with the Cloudflare token.`);
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
        const r = await fetch("https://api.cloudflare.com/client/v4" + path2, { method, headers: { Authorization: "Bearer " + (useJwt ? q.jwt : env.CF_TOKEN), ...q.contentType ? { "Content-Type": String(q.contentType) } : {} }, body: method === "GET" ? void 0 : body });
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
