// Enquiry inbox for business sites: the form saves each enquiry as a JSON file in a private GitHub repository,
// through a tiny Netlify function on the user's own Netlify account (a web page can't write to GitHub without
// a token, and the token must not be in the site). No email is sent. The function holds a token that can only
// write that one repository; it isn't in the site, the content or any repository.
//
// Reading: the admin page and the Studio ask the same function, sending a GitHub token that can edit the site's
// repository (or the inbox repository). The function checks that with GitHub before answering.
import { Netlify } from "./netlify";
import { zip } from "./zip";

export const INBOX_VERSION = 1;
const FN = "enquiry";
export type InboxCfg = { siteId: string; url: string; repo: string; origins: string[]; siteRepos: string[]; v: number; deployedAt?: string };
export type InboxEnquiry = { path: string; id: string; created_at: string; status: string; page?: string; data: Record<string, string> };

/** The function's code (Netlify Functions, Node 18+). */
export function inboxSource(o: { token: string; repo: string; siteRepos: string[]; origins: string[] }): string {
  return `// Site Studio enquiry inbox (v${INBOX_VERSION}). Saves each enquiry from the website's form as a JSON file in ${o.repo}.
const TOKEN = ${JSON.stringify(o.token)};
const REPO = ${JSON.stringify(o.repo)};
const SITE_REPOS = ${JSON.stringify(o.siteRepos)};
const ORIGINS = ${JSON.stringify(o.origins)};
const API = "https://api.github.com";
const gh = (path, init = {}, token = TOKEN) => fetch(API + path, { ...init, headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json", "User-Agent": "site-studio-inbox", ...(init.body ? { "Content-Type": "application/json" } : {}) } });
const b64 = (s) => Buffer.from(s, "utf8").toString("base64");
const unb64 = (s) => Buffer.from(String(s || ""), "base64").toString("utf8");
const STATUSES = ["new", "read", "replied", "archived"];
exports.handler = async (event) => {
  const h = Object.fromEntries(Object.entries(event.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
  const origin = h.origin || "";
  const cors = { "Access-Control-Allow-Origin": ORIGINS.includes(origin) ? origin : ORIGINS[0] || "*", "Access-Control-Allow-Headers": "content-type, authorization", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Vary": "Origin" };
  const out = (code, body) => ({ statusCode: code, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };
  if (event.httpMethod === "GET") {
    const r = await gh("/repos/" + REPO); const j = await r.json().catch(() => ({}));
    return out(200, { ok: r.ok && j.private === true && !!(j.permissions && j.permissions.push), private: j.private === true, canWrite: !!(j.permissions && j.permissions.push), status: r.status, v: ${INBOX_VERSION} });
  }
  if (event.httpMethod !== "POST") return out(405, { error: "Use POST." });
  const raw = event.isBase64Encoded ? unb64(event.body) : event.body || "";
  if (raw.length > 20000) return out(413, { error: "Too long." });
  let q; try { q = JSON.parse(raw || "{}"); } catch (e) { return out(400, { error: "Bad request." }); }
  const action = q.action || "submit";

  if (action === "submit") {
    if (!ORIGINS.includes(origin)) return out(403, { error: "This form only accepts enquiries from its own website." });
    if (q.website) return out(200, { ok: true }); // spam trap
    const src = q.data && typeof q.data === "object" ? q.data : {}, data = {};
    for (const [k, v] of Object.entries(src).slice(0, 25)) if (/^[\\w-]{1,40}$/.test(k) && v != null && String(v).trim()) data[k] = String(v).slice(0, 5000);
    if (!Object.keys(data).length) return out(400, { error: "The form was empty." });
    const now = new Date(), id = now.toISOString().replace(/[-:.]/g, "").slice(0, 15) + "-" + Math.random().toString(36).slice(2, 8);
    const path = "enquiries/" + now.toISOString().slice(0, 4) + "/" + now.toISOString().slice(5, 7) + "/" + id + ".json";
    const rec = { id, created_at: now.toISOString(), status: "new", page: String(q.page || "").slice(0, 200), data };
    const r = await gh("/repos/" + REPO + "/contents/" + path, { method: "PUT", body: JSON.stringify({ message: "Enquiry from " + String(data.name || data.email || "the website").slice(0, 60), content: b64(JSON.stringify(rec, null, 2) + "\\n") }) });
    if (!r.ok) return out(502, { error: "Couldn't save the enquiry (" + r.status + ")." });
    return out(200, { ok: true });
  }

  // Reading and managing: the caller's GitHub token must be able to edit the site's repository or this inbox.
  const who = String(h.authorization || "").replace(/^Bearer\\s+/i, "");
  if (!who) return out(401, { error: "Sign in first." });
  let allowed = false;
  for (const repo of [...SITE_REPOS, REPO]) {
    const r = await gh("/repos/" + repo, {}, who); if (!r.ok) continue;
    const j = await r.json().catch(() => ({})); if (j.permissions && j.permissions.push) { allowed = true; break; }
  }
  if (!allowed) return out(403, { error: "Your GitHub token can't edit this site's repository, so it can't read its enquiries." });
  const okPath = (p) => /^enquiries\\/[\\w/.-]+\\.json$/.test(String(p || "")) && !String(p).includes("..");
  const getFile = async (p) => { const r = await gh("/repos/" + REPO + "/contents/" + p); if (!r.ok) return null; const j = await r.json(); return { sha: j.sha, rec: JSON.parse(unb64(j.content)) }; };

  if (action === "list") {
    const t = await gh("/repos/" + REPO + "/git/trees/HEAD?recursive=1");
    if (t.status === 409 || t.status === 404) return out(200, { items: [] });
    const tree = (await t.json()).tree || [];
    const paths = tree.filter((x) => x.type === "blob" && okPath(x.path)).map((x) => x.path).sort().reverse().slice(0, 300);
    const items = [];
    for (let i = 0; i < paths.length; i += 10) {
      const got = await Promise.all(paths.slice(i, i + 10).map(async (p) => { try { const f = await getFile(p); return f && { path: p, ...f.rec }; } catch (e) { return null; } }));
      items.push(...got.filter(Boolean));
    }
    return out(200, { items, more: tree.filter((x) => okPath(x.path)).length > paths.length });
  }
  if (!okPath(q.path)) return out(400, { error: "Not an enquiry." });
  const f = await getFile(q.path); if (!f) return out(404, { error: "That enquiry is gone." });
  if (action === "status") {
    if (!STATUSES.includes(q.status)) return out(400, { error: "Unknown status." });
    const r = await gh("/repos/" + REPO + "/contents/" + q.path, { method: "PUT", body: JSON.stringify({ message: "Mark enquiry " + q.status, sha: f.sha, content: b64(JSON.stringify({ ...f.rec, status: q.status }, null, 2) + "\\n") }) });
    return r.ok ? out(200, { ok: true }) : out(502, { error: "Couldn't update it (" + r.status + ")." });
  }
  if (action === "delete") {
    const r = await gh("/repos/" + REPO + "/contents/" + q.path, { method: "DELETE", body: JSON.stringify({ message: "Delete an enquiry", sha: f.sha }) });
    return r.ok ? out(200, { ok: true }) : out(502, { error: "Couldn't delete it (" + r.status + ")." });
  }
  return out(400, { error: "Unknown action." });
};
`;
}

const PAGE = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Enquiry inbox</title>
<style>body{font:16px/1.6 system-ui,sans-serif;max-width:560px;margin:12vh auto;padding:0 20px;color:#1d2433}</style>
<h1>Enquiry inbox</h1><p>This small site receives a website's enquiry form and saves each enquiry as a file in a private GitHub repository. It was set up by Site Studio. Read enquiries in the website's admin page or in the Studio.</p>`;

const rand = (n: number) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, "0")).join("");

/** Creates (or updates) the inbox site on the user's Netlify, builds the function and checks it can write. */
export async function setupInbox(nf: Netlify, o: { token: string; repo: string; siteRepos: string[]; origins: string[]; name: string }, existing?: Pick<InboxCfg, "siteId" | "url"> | null, step?: (s: string) => void, onSite?: (s: { siteId: string; url: string }) => void): Promise<InboxCfg> {
  let siteId = existing?.siteId || "", url = existing?.url || "";
  if (siteId) { try { const s = await nf.getSite(siteId); url = s.ssl_url || s.url; } catch { siteId = ""; } }
  if (!siteId) {
    step?.("Creating the inbox site on Netlify");
    const base = o.name.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30) || "site";
    for (let i = 0; i < 4 && !siteId; i++) {
      try { const s = await nf.createSite(`${base}-inbox-${rand(3)}`); siteId = s.id; url = s.ssl_url || s.url; onSite?.({ siteId, url }); } catch (e: any) { if (e?.status !== 422 || i === 3) throw e; }
    }
  }
  step?.("Uploading the inbox");
  const enc = new TextEncoder();
  const src = zip([
    { name: "index.html", data: enc.encode(PAGE) },
    { name: "netlify.toml", data: enc.encode(`[build]\n  publish = "."\n  command = ""\n\n[functions]\n  directory = "netlify/functions"\n  node_bundler = "esbuild"\n`) },
    { name: `netlify/functions/${FN}.js`, data: enc.encode(inboxSource(o)) },
  ]);
  await nf.build(siteId, src, `Enquiry inbox v${INBOX_VERSION}`, step);
  const cfg: InboxCfg = { siteId, url: url.replace(/^http:/, "https:").replace(/\/?$/, "/") + ".netlify/functions/" + FN, repo: o.repo, origins: o.origins, siteRepos: o.siteRepos, v: INBOX_VERSION, deployedAt: new Date().toISOString() };
  step?.("Checking it can save to " + o.repo);
  let last: any = null;
  for (let i = 0; i < 8; i++) {
    try { const r = await fetch(cfg.url, { cache: "no-store" }); const j = await r.json(); last = j; if (j.ok) return cfg; if (j.status === 401 || j.status === 404 || j.private === false) break; } catch { /* still starting */ }
    await new Promise((r) => setTimeout(r, 1500));
  }
  if (last?.status === 401) throw new Error("GitHub rejected the token. Create it again and paste the new one.");
  if (last?.status === 404) throw new Error(`The token can't see ${o.repo}. On the token page, choose Only select repositories → ${o.repo.split("/")[1]}.`);
  if (last && last.private === false) throw new Error(`${o.repo} is public. Make it private first: enquiries hold people's details.`);
  if (last && !last.canWrite) throw new Error("The token can read but not write. Set Contents to Read and write.");
  throw new Error("The inbox was uploaded but doesn't answer yet. Wait a minute and press Set up again.");
}

export class InboxError extends Error { constructor(msg: string, public status = 0) { super(msg); } }

/** Reads or changes enquiries through the inbox function, proving access with a GitHub token. */
export async function inboxCall<T = any>(url: string, token: string, body: Record<string, unknown>): Promise<T> {
  let r: Response;
  try { r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify(body) }); }
  catch { throw new InboxError("Couldn't reach the enquiry inbox on Netlify. Check your connection and try again."); }
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new InboxError(j?.error || `The inbox answered ${r.status}.`, r.status);
  return j as T;
}
