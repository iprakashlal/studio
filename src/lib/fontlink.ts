// What a pasted font link is, for the note under the box. The site reads links the same way (src/fx/fx.js → SiteFonts.link).
export type FontLink = { kind: "file" | "css"; url: string; family: string };
const EXT = /\.(woff2|woff|ttf|otf)$/i;
export function fontLink(raw: string): FontLink | null {
  const m = /https:\/\/[^\s"'<>)]+/i.exec(String(raw || "")); if (!m) return null;
  let u: URL; try { u = new URL(m[0].replace(/&amp;/g, "&")); } catch { return null; }
  if (EXT.test(u.pathname)) return { kind: "file", url: u.href, family: "" };
  let fam = "";
  if (u.hostname === "fonts.google.com") {
    const sp = /\/specimen\/([^/?#]+)/.exec(u.pathname); if (!sp) return null;
    try { fam = decodeURIComponent(sp[1]).replace(/\+/g, " "); } catch { return null; }
    return { kind: "css", url: "https://fonts.googleapis.com/css?family=" + encodeURIComponent(fam).replace(/%20/g, "+") + ":300,400,500,600,700,800&display=swap", family: fam };
  }
  if (u.hostname === "fonts.googleapis.com" || u.hostname === "fonts.bunny.net") fam = String(u.searchParams.get("family") || "").split(/[:|]/)[0].replace(/\+/g, " ").trim();
  return { kind: "css", url: u.href, family: fam };
}
/** One plain line saying how the link was understood. */
export function fontLinkLine(raw: string): string {
  if (!String(raw || "").trim()) return "";
  const l = fontLink(raw);
  if (!l) return /fonts\.google\.com/i.test(raw) ? "Open the font's own page on Google Fonts and paste that address (it has /specimen/ in it)." : "Not a link the site can use: it must start with https://.";
  if (l.kind === "file") return "A font file: the site loads it straight from that address (the address must allow other sites to use it).";
  return l.family ? `Google Fonts: ${l.family}.` : "A font stylesheet: type the font's name below, exactly as the stylesheet calls it.";
}
