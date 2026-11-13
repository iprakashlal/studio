// Publishing to GitHub from the Studio: a separate "publishing" token kept on this device (encrypted with the
// Studio login), creating the site's repository when it doesn't exist, and switching on GitHub Pages.

import { RepoError } from "./repo";

const API = "https://api.github.com";
const KEY = "site-studio:gh-publish";
/** Fine-grained token page: All repositories, Administration + Contents + Pages read and write. */
export const GH_TOKEN_PAGE = "https://github.com/settings/personal-access-tokens/new";
/** Classic token page with the one scope publishing needs. */
export const GH_CLASSIC_TOKEN_PAGE = "https://github.com/settings/tokens/new?scopes=repo&description=Picaffectz%20Studio%20publishing";

const enc = new TextEncoder();
const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
const unhex = (h: string) => new Uint8Array((h.match(/../g) || []).map((x) => parseInt(x, 16)));
async function keyFor(secret: string, salt: Uint8Array) {
  const base = await crypto.subtle.importKey("raw", enc.encode(secret), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 120000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

let cached: { token: string; login: string } | null = null;
/** A Studio moved off GitHub signs in by email, so its login isn't a GitHub token and mustn't be sent to GitHub. */
let loginIsGitHub = true;
/** The publishing token on this device, encrypted with the Studio's own GitHub token. Never written to a repository. */
export const ghPublish = {
  /** The token to use for site repositories: the publishing token when set, else the Studio's own. */
  token: (fallback: string) => cached?.token || (loginIsGitHub ? fallback : ""),
  /** Set by the app: false in a Studio that signs in by email (moved off GitHub). */
  setLoginIsGitHub(v: boolean) { loginIsGitHub = v; },
  login: () => cached?.login || "",
  async load(studioToken: string) {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || "null");
      if (!s) { cached = null; return null; }
      const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unhex(s.iv) }, await keyFor(studioToken, unhex(s.salt)), unhex(s.data));
      cached = { token: new TextDecoder().decode(pt), login: s.login || "" };
      return cached;
    } catch { cached = null; return null; }
  },
  async save(token: string, studioToken: string, login: string) {
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const data = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await keyFor(studioToken, salt), enc.encode(token)));
    localStorage.setItem(KEY, JSON.stringify({ v: 1, login, salt: hex(salt), iv: hex(iv), data: hex(data) }));
    cached = { token, login };
  },
  clear() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } cached = null; },
};

async function gh(token: string, path: string, init: RequestInit = {}) {
  let r: Response;
  try {
    r = await fetch(API + path, { ...init, cache: "no-store", headers: { Accept: "application/vnd.github+json", Authorization: "Bearer " + token, "X-GitHub-Api-Version": "2022-11-28", ...(init.body ? { "Content-Type": "application/json" } : {}) } });
  } catch { throw new RepoError("Couldn't reach GitHub. Check your connection.", 0); }
  let j: any = null;
  try { j = r.status === 204 ? null : await r.json(); } catch { /* empty */ }
  if (!r.ok) throw new RepoError(j?.message || r.statusText, r.status);
  return j;
}

/** Checks a token and returns the account it belongs to. */
export async function ghWhoAmI(token: string): Promise<{ login: string; name: string }> {
  try { const u = await gh(token, "/user"); return { login: u.login, name: u.name || u.login }; }
  catch (e: any) { throw new RepoError(e.status === 401 ? "GitHub rejected that token. Copy it again, or make a new one." : e.message, e.status); }
}

/** Creates owner/name when it doesn't exist yet. Returns true when it was created. */
export async function ensureRepo(token: string, owner: string, name: string, description: string, priv = false): Promise<boolean> {
  try { const r = await gh(token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`); if (priv && !r.private) throw new RepoError(`${owner}/${name} already exists and is public. It will hold people's details, so use a private repository: make it private on GitHub (Settings → Danger Zone) or pick another name.`, 409); return false; }
  catch (e: any) { if (e.status !== 404) throw e; }
  const me = await gh(token, "/user");
  const body = JSON.stringify({ name, description, private: priv, auto_init: true, has_issues: false, has_wiki: false, has_projects: false });
  try {
    if (String(me.login).toLowerCase() === owner.toLowerCase()) await gh(token, "/user/repos", { method: "POST", body });
    else await gh(token, `/orgs/${encodeURIComponent(owner)}/repos`, { method: "POST", body });
  } catch (e: any) {
    if (e.status === 403 || e.status === 404) throw new RepoError(`This token can't create repositories for ${owner}. Give it Administration: Read and write on All repositories (or use a classic token with the repo scope), or create ${owner}/${name} on GitHub yourself.`, e.status);
    if (e.status === 422) throw new RepoError(`GitHub wouldn't create ${owner}/${name}: ${e.message}. Try another repository name.`, 422);
    throw e;
  }
  // A brand-new repository needs a moment before its branch accepts commits.
  for (let i = 0; i < 10; i++) {
    try { await gh(token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/git/ref/heads/main`); break; } catch { await new Promise((r) => setTimeout(r, 700)); }
  }
  return true;
}

/** Switches GitHub Pages on (branch / root). Returns the site address, or null if the token isn't allowed to. */
export async function ensurePages(token: string, owner: string, name: string, branch: string): Promise<{ url: string | null; turnedOn: boolean; error?: string }> {
  const base = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/pages`;
  try { const p = await gh(token, base); return { url: p.html_url || null, turnedOn: false }; }
  catch (e: any) { if (e.status !== 404) return { url: null, turnedOn: false, error: e.message }; }
  try {
    const p = await gh(token, base, { method: "POST", body: JSON.stringify({ build_type: "legacy", source: { branch, path: "/" } }) });
    return { url: p?.html_url || null, turnedOn: true };
  } catch (e: any) {
    if (e.status === 409) return { url: null, turnedOn: false };
    return { url: null, turnedOn: false, error: e.status === 403 || e.status === 404 ? "the token needs Pages: Read and write" : e.message };
  }
}
