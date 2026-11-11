// "Sign in on another device": a signed-in device makes a link and a one-time code.
// The link carries this login (repository, GitHub token, username) encrypted with the code
// (PBKDF2-SHA256, 310k rounds -> AES-256-GCM). The code is never part of the link, so the link
// alone is useless. Links stop working after 15 minutes.

import type { Session } from "./auth";
import { ITER } from "./crypto";

const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O or 1/I
const enc = new TextEncoder();
const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
/** "k7qf 2m9x-pl4d" → "K7QF2M9XPL4D" */
export const normCode = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, "");

async function key(code: string, salt: Uint8Array) {
  const base = await crypto.subtle.importKey("raw", enc.encode(normCode(code)), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: ITER, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export const LINK_MINUTES = 15;

/** A 12-character code (60 bits) shown as XXXX-XXXX-XXXX, and the link that needs it. */
export async function makeDeviceLink(s: Session, page = location.origin + location.pathname): Promise<{ code: string; url: string; expires: number }> {
  const r = crypto.getRandomValues(new Uint8Array(12));
  const raw = [...r].map((x) => ALPHA[x % 32]).join("");
  const code = raw.match(/.{4}/g)!.join("-");
  const expires = Date.now() + LINK_MINUTES * 60_000;
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(raw, salt), enc.encode(JSON.stringify({ cfg: s.cfg, token: s.token, username: s.username, expires }))));
  const blob = new Uint8Array(salt.length + iv.length + data.length);
  blob.set(salt, 0); blob.set(iv, 16); blob.set(data, 28);
  return { code, url: `${page}#join=${b64u(blob)}`, expires };
}

/** The link's login, or an error message. */
export async function openDeviceLink(blob: string, code: string): Promise<Session | string> {
  let b: Uint8Array;
  try { b = unb64u(blob); } catch { return "This link is damaged. Make a new one on your other device."; }
  if (b.length < 40) return "This link is damaged. Make a new one on your other device.";
  try {
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b.slice(16, 28) }, await key(code, b.slice(0, 16)), b.slice(28));
    const j = JSON.parse(new TextDecoder().decode(pt));
    if (!j?.token || !j?.cfg) return "This link is damaged. Make a new one on your other device.";
    if (Date.now() > j.expires) return "This link has expired. Make a new one on your other device.";
    return { cfg: j.cfg, token: j.token, username: j.username };
  } catch {
    return "That code doesn't match this link. Check it on your other device.";
  }
}

/** The encrypted part of a #join=… address, if this page was opened from a device link. */
export const joinBlob = () => (location.hash.match(/^#\/?join=([A-Za-z0-9_-]{40,})/) || [])[1] || "";
