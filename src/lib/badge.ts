// The "Powered by" badge every published site shows (bottom right). Its look (text, link, size, colours, icon)
// is one Studio-wide setting in studio.json; each site only says whether it shows (content.poweredBy.show).
// Sites get the look as assets/badge.js (window.SITE_BADGE), written when they're published or updated.

export type BadgeCfg = { text: string; url: string; size: "s" | "m" | "l"; bg: string; fg: string; icon: "mark" | "none" | "custom"; iconData?: string };
/** A blank link or colour means "follow the Studio": its own address and its brand colour (resolved by resolveBadge). */
export const BADGE_DEFAULT: BadgeCfg = { text: "Powered by Picaffectz", url: "", size: "m", bg: "", fg: "", icon: "mark" };
const FALLBACK = { url: "https://iprakashlal.github.io/studio/#/themes", bg: "#0E1118", fg: "#FFFFFF" };

import { basePath } from "./util";
import { brand } from "./brand";
import { isHex } from "./tint";

const hex = (v: unknown, d: string) => (/^#[0-9a-f]{6}$/i.test(String(v || "")) ? String(v) : d);
/** A clean badge setting from whatever studio.json holds. */
export function cleanBadge(b: any): BadgeCfg {
  const d = BADGE_DEFAULT;
  const icon = b?.icon === "none" || (b?.icon === "custom" && /^data:image\/(png|jpeg|webp|svg\+xml);base64,/.test(b?.iconData || "")) ? b.icon : "mark";
  return {
    text: String(b?.text ?? d.text).slice(0, 60).trim() || d.text,
    url: /^https?:\/\//i.test(String(b?.url || "")) ? String(b.url) : "",
    size: b?.size === "s" || b?.size === "l" ? b.size : "m",
    bg: hex(b?.bg, ""), fg: hex(b?.fg, ""), icon,
    ...(icon === "custom" ? { iconData: b.iconData } : {}),
  };
}

const full = (h: string) => (h.length === 4 ? "#" + h[1] + h[1] + h[2] + h[2] + h[3] + h[3] : h).toUpperCase();
/** White or near-black text, whichever reads better on the colour. */
const readable = (bg: string) => { const n = parseInt(bg.slice(1), 16), l = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; return l > 0.6 ? "#14161A" : "#FFFFFF"; };
/** The Studio's own address (its Themes page) and brand colour, used wherever the badge leaves link or colours blank. */
export function studioLook(): { url: string; bg: string; fg: string } {
  let url = FALLBACK.url;
  try { if (typeof location !== "undefined" && /^https?:/.test(location.protocol)) url = location.origin + (basePath() || "/").replace(/\/?$/, "/") + "#/themes"; } catch { /* keep the fallback */ }
  const t = brand().tint, bg = isHex(t) ? full(t) : FALLBACK.bg;
  return { url, bg, fg: readable(bg) };
}
/** The badge with every blank link/colour filled from the Studio. */
export function resolveBadge(b: BadgeCfg): BadgeCfg {
  const c = cleanBadge(b), s = studioLook(), bg = c.bg || s.bg;
  return { ...c, url: c.url || s.url, bg, fg: c.fg || (c.bg ? readable(c.bg) : s.fg) };
}

let current: BadgeCfg = BADGE_DEFAULT;
/** The Studio's badge setting, as loaded from studio.json (used when building sites and in the preview). */
export const currentBadge = () => resolveBadge(current);
export const setCurrentBadge = (b: any) => { current = cleanBadge(b); };

/** A short fingerprint of the badge's look, kept in each site's cms/site.json so Push updates can tell it changed. */
export function badgeVersion(b: BadgeCfg = current): string {
  const s = JSON.stringify(resolveBadge(b)); let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}

/** assets/badge.js for a site: the badge's look. */
export const badgeScript = (b: BadgeCfg = current) => `window.SITE_BADGE = ${JSON.stringify(resolveBadge(b))};\n`;
