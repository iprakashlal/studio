// Device-only login. The GitHub token is encrypted with the user's password
// (PBKDF2-SHA256, 310k rounds -> AES-256-GCM) and kept in this browser only.

export type RepoCfg = { owner: string; repo: string; branch: string };
export type Sealed = RepoCfg & { v: 1; salt: string; iter: number; iv: string; data: string };
export type Unsealed = { username: string; token: string };

const enc = new TextEncoder();
const hex = (b: ArrayBuffer | Uint8Array) => [...new Uint8Array(b instanceof Uint8Array ? b : new Uint8Array(b))].map((x) => x.toString(16).padStart(2, "0")).join("");
const unhex = (h: string) => new Uint8Array((h.match(/../g) || []).map((x) => parseInt(x, 16)));
export const ITER = 310000;

async function keyFrom(pw: string, salt: string, iter: number) {
  const base = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: unhex(salt), iterations: iter, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export async function seal(cfg: RepoCfg, username: string, password: string, token: string): Promise<Sealed> {
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const k = await keyFrom(password, salt, ITER);
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k, enc.encode(JSON.stringify({ username, token })));
  return { v: 1, owner: cfg.owner, repo: cfg.repo, branch: cfg.branch, salt, iter: ITER, iv: hex(iv), data: hex(data) };
}

export async function unseal(s: Sealed, password: string): Promise<Unsealed | null> {
  try {
    const k = await keyFrom(password, s.salt, s.iter || ITER);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unhex(s.iv) }, k, unhex(s.data));
    return JSON.parse(new TextDecoder().decode(pt));
  } catch {
    return null;
  }
}

/** 0–4. Setup requires 3+ and at least 12 characters. */
export function pwScore(p: string): number {
  let s = 0;
  if (p.length >= 12) s++;
  if (p.length >= 16) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  if (/^(.)\1+$/.test(p) || /password|qwerty|123456|letmein/i.test(p)) s = 0;
  return Math.min(s, 4);
}
export const pwStrongEnough = (p: string) => p.length >= 12 && pwScore(p) >= 3;
