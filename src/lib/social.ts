// Social and contact links: the networks the footer row knows (src/fx/social.js draws them), and finding such links
// in text, for filling them in from an uploaded profile, CV or pamphlet.
export type SocialItem = { kind: string; url: string; label: string; icon?: any };
/** kind → [name, the hosts that mean it]. Order matters for the editor's list. */
export const SOCIAL_KINDS: Record<string, [string, RegExp | null]> = {
  instagram: ["Instagram", /(^|\.)(instagram\.com|instagr\.am)$/], facebook: ["Facebook", /(^|\.)(facebook\.com|fb\.com|fb\.me)$/], x: ["X (Twitter)", /(^|\.)(x\.com|twitter\.com)$/],
  linkedin: ["LinkedIn", /(^|\.)linkedin\.com$/], youtube: ["YouTube", /(^|\.)(youtube\.com|youtu\.be)$/], whatsapp: ["WhatsApp", /(^|\.)(wa\.me|whatsapp\.com)$/],
  telegram: ["Telegram", /(^|\.)(t\.me|telegram\.me)$/], threads: ["Threads", /(^|\.)threads\.(net|com)$/], pinterest: ["Pinterest", /(^|\.)(pinterest\.[a-z.]+|pin\.it)$/],
  snapchat: ["Snapchat", /(^|\.)snapchat\.com$/], tiktok: ["TikTok", /(^|\.)tiktok\.com$/], github: ["GitHub", /(^|\.)github\.com$/],
  behance: ["Behance", /(^|\.)behance\.net$/], dribbble: ["Dribbble", /(^|\.)dribbble\.com$/], medium: ["Medium", /(^|\.)medium\.com$/],
  maps: ["Google Maps", /(^|\.)(maps\.app\.goo\.gl|goo\.gl|g\.page|maps\.google\.[a-z.]+)$/], indiamart: ["IndiaMART", /(^|\.)indiamart\.com$/], justdial: ["Justdial", /(^|\.)(justdial\.com|jsdl\.in)$/],
  email: ["Email", null], phone: ["Phone", null], website: ["Website", null], other: ["Other link", null],
};
export const socialDefault = () => ({ on: false, title: "", style: "badges", align: "center", items: [] as SocialItem[] });

/** Which network an address belongs to ("website" for any other https address, "" when it isn't one). */
export function socialKind(url: string): string {
  let u: URL; try { u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(url) ? url : "https://" + url); } catch { return ""; }
  if (u.protocol === "mailto:") return "email"; if (u.protocol === "tel:") return "phone";
  if (u.protocol !== "https:" && u.protocol !== "http:") return "";
  const host = u.hostname.toLowerCase();
  if (host === "google.com" || host === "www.google.com") return /^\/maps/.test(u.pathname) ? "maps" : "website";
  for (const [k, [, re]] of Object.entries(SOCIAL_KINDS)) if (re && re.test(host)) return k;
  return /\.[a-z]{2,}$/.test(host) ? "website" : "";
}
const tidy = (u: string) => u.replace(/[)\].,;:!?'"›»]+$/, "").replace(/^http:\/\//i, "https://");
/** The social and contact links written in a text (a CV, a profile export, a pamphlet's pages): full addresses
 *  (with or without https://) of the known networks, wa.me numbers, and "Instagram: @name" style handles.
 *  Plain websites, emails and phone numbers are left to the import's own fields. One link per network, first wins. */
export function socialFromText(text: string): SocialItem[] {
  const t = String(text || "").replace(/­/g, ""), out = new Map<string, SocialItem>();
  const add = (kind: string, url: string) => { if (kind && !out.has(kind)) out.set(kind, { kind, url, label: "" }); };
  for (const m of t.matchAll(/(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>()"']*)?/gi)) {
    const raw = tidy(m[0]), kind = socialKind(raw);
    if (!kind || kind === "website" || kind === "email" || kind === "phone") continue;
    // A bare network name ("instagram.com") with no profile after it isn't a link to anything.
    let u: URL; try { u = new URL(/^https?:/i.test(raw) ? raw : "https://" + raw); } catch { continue; }
    if (u.pathname.replace(/\/+$/, "") === "" && !u.search && kind !== "maps") continue;
    add(kind, u.href.replace(/^http:/, "https:"));
  }
  // "Instagram: @name", "Twitter - @name", "Telegram @name"
  const HANDLE: [RegExp, string, (h: string) => string][] = [
    [/instagram|insta\b|\big\b/i, "instagram", (h) => `https://www.instagram.com/${h}`], [/facebook|\bfb\b/i, "facebook", (h) => `https://www.facebook.com/${h}`],
    [/twitter|\bx\b/i, "x", (h) => `https://x.com/${h}`], [/telegram/i, "telegram", (h) => `https://t.me/${h}`], [/youtube/i, "youtube", (h) => `https://www.youtube.com/@${h}`],
    [/threads/i, "threads", (h) => `https://www.threads.net/@${h}`], [/github/i, "github", (h) => `https://github.com/${h}`], [/snapchat/i, "snapchat", (h) => `https://www.snapchat.com/add/${h}`],
  ];
  for (const m of t.matchAll(/([A-Za-z]{1,10})\s*(?:[:\-–|]|\bat\b|\bon\b)?\s*@([A-Za-z0-9._]{2,40})(?![\w.]*@|\.[a-z]{2,}\b)/g)) for (const [re, kind, make] of HANDLE) if (re.test(m[1])) { add(kind, make(m[2].replace(/\.$/, ""))); break; }
  // WhatsApp: +91 98xxx xxxxx
  const wa = /whats\s*app[^\d+\n]{0,20}(\+?\d[\d\s-]{8,16}\d)/i.exec(t); if (wa) { const d = wa[1].replace(/\D/g, ""); if (d.length >= 10) add("whatsapp", `https://wa.me/${d.length === 10 ? "91" + d : d}`); }
  return [...out.values()];
}
/** Adds found links to the site's footer row: a network that already has a link keeps it. Returns how many were added. */
export function mergeSocial(c: any, found: SocialItem[]): number {
  if (!c || !found.length) return 0;
  const s = (c.social && typeof c.social === "object" ? c.social : (c.social = socialDefault())); if (!Array.isArray(s.items)) s.items = [];
  let n = 0;
  for (const f of found) {
    const have = s.items.find((x: any) => x && x.kind === f.kind && f.kind !== "website" && f.kind !== "other");
    if (have) { if (!String(have.url || "").trim()) { have.url = f.url; n++; } continue; }
    if (s.items.some((x: any) => x && String(x.url || "").replace(/\/$/, "") === f.url.replace(/\/$/, ""))) continue;
    if (s.items.length >= 16) break;
    s.items.push({ kind: f.kind, url: f.url, label: f.label || "", icon: null }); n++;
  }
  if (n) s.on = true;
  return n;
}
