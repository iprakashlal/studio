// The "Powered by" badge every published site shows (bottom right). Its look (text, link, size, colours, icon)
// is one Studio-wide setting in studio.json; each site only says whether it shows (content.poweredBy.show).
// Sites get the look as assets/badge.js (window.SITE_BADGE), written when they're published or updated.

export type BadgeCfg = { text: string; url: string; size: "s" | "m" | "l"; bg: string; fg: string; icon: "mark" | "none" | "custom"; iconData?: string };
export const BADGE_DEFAULT: BadgeCfg = { text: "Powered by Picaffectz", url: "https://iprakashlal.github.io/studio/#/themes", size: "m", bg: "#0E1118", fg: "#FFFFFF", icon: "mark" };

const hex = (v: unknown, d: string) => (/^#[0-9a-f]{6}$/i.test(String(v || "")) ? String(v) : d);
/** A clean badge setting from whatever studio.json holds. */
export function cleanBadge(b: any): BadgeCfg {
  const d = BADGE_DEFAULT;
  const icon = b?.icon === "none" || (b?.icon === "custom" && /^data:image\/(png|jpeg|webp|svg\+xml);base64,/.test(b?.iconData || "")) ? b.icon : "mark";
  return {
    text: String(b?.text ?? d.text).slice(0, 60).trim() || d.text,
    url: /^https?:\/\//i.test(String(b?.url || "")) ? String(b.url) : d.url,
    size: b?.size === "s" || b?.size === "l" ? b.size : "m",
    bg: hex(b?.bg, d.bg), fg: hex(b?.fg, d.fg), icon,
    ...(icon === "custom" ? { iconData: b.iconData } : {}),
  };
}

let current: BadgeCfg = BADGE_DEFAULT;
/** The Studio's badge setting, as loaded from studio.json (used when building sites and in the preview). */
export const currentBadge = () => current;
export const setCurrentBadge = (b: any) => { current = cleanBadge(b); };

/** A short fingerprint of the badge's look, kept in each site's cms/site.json so Push updates can tell it changed. */
export function badgeVersion(b: BadgeCfg = current): string {
  const s = JSON.stringify(cleanBadge(b)); let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}

/** assets/badge.js for a site: the badge's look. */
export const badgeScript = (b: BadgeCfg = current) => `window.SITE_BADGE = ${JSON.stringify(cleanBadge(b))};\n`;
