// The <head> of every exported page: title, description, search and link-preview tags.
// Baked into the HTML (search engines and WhatsApp/Facebook/LinkedIn previews don't run JavaScript),
// by the Studio when it exports or publishes and by the site's own CMS when the owner changes them.
// The templates apply the same values at runtime too (see applyMeta in store.js / index.html).

export type MetaTag = { name: string; content: string };
export type Seo = {
  title?: string; titlePattern?: string; description?: string; keywords?: string; author?: string;
  image?: { path?: string } | null; siteUrl?: string; themeColor?: string; noindex?: boolean; googleVerification?: string; meta?: MetaTag[];
};

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const oneLine = (s: unknown) => String(s ?? "").replace(/\s*\n\s*/g, " ").trim();

/** Page file → what the shop calls that page (used in "{page} · {site}"). */
export function storePageLabel(file: string, c: any): string {
  const m: Record<string, string> = {
    "shop.html": c?.shop?.title, "product.html": "Product", "cart.html": c?.nav?.cart, "checkout.html": c?.checkout?.title,
    "portfolio.html": c?.nav?.portfolio, "policies.html": "Policies", "account.html": c?.accountPage?.title,
  };
  return oneLine(m[file] || "");
}

/** The tab title for a page: the home page uses the title as typed, other pages follow the pattern. */
export function pageTitle(c: any, file = "index.html", label = ""): string {
  const site = oneLine(c?.seo?.title || c?.brand?.name || c?.brand?.logoText || "");
  if (file === "index.html" || !label) return site;
  const brand = oneLine(c?.brand?.name || c?.brand?.logoText || site);
  return oneLine((c?.seo?.titlePattern || "{page} · {site}").replace(/\{page\}/g, label).replace(/\{site\}/g, brand));
}

/** Absolute site address ("https://…/") for canonical links and share images. */
export function siteBase(c: any, fallback = ""): string {
  const u = String(c?.seo?.siteUrl || fallback || "").trim();
  return /^https?:\/\/[^\s"<>]+$/i.test(u) ? u.replace(/\/?$/, "/") : "";
}

const MARK = /<!-- site-meta -->[\s\S]*?<!-- \/site-meta -->\n?/g;

/** Rewrites a page's <title> and its managed meta block. Safe to run again on an already baked page. */
export function bakeHead(html: string, c: any, opts: { file: string; label?: string; base?: string; bg?: string }): string {
  const s: Seo = c?.seo || {};
  const title = pageTitle(c, opts.file, opts.label);
  const desc = oneLine(s.description);
  const base = siteBase(c, opts.base);
  const url = base ? base + (opts.file === "index.html" ? "" : opts.file) : "";
  const img = s.image && (s.image as any).path ? (base ? base + String((s.image as any).path).replace(/^\.?\//, "") : "") : "";
  const tags: string[] = [];
  const meta = (k: "name" | "property", n: string, v: unknown) => { const t = oneLine(v); if (t) tags.push(`<meta ${k}="${esc(n)}" content="${esc(t)}">`); };
  meta("name", "description", desc);
  meta("name", "keywords", s.keywords);
  meta("name", "author", s.author);
  if (s.noindex) meta("name", "robots", "noindex, nofollow");
  if (/^#[0-9a-f]{3,8}$/i.test(s.themeColor || "")) meta("name", "theme-color", s.themeColor);
  meta("name", "google-site-verification", s.googleVerification);
  if (url && !s.noindex) tags.push(`<link rel="canonical" href="${esc(url)}">`);
  meta("property", "og:type", "website");
  meta("property", "og:title", title);
  meta("property", "og:description", desc);
  meta("property", "og:site_name", c?.brand?.name || c?.brand?.logoText);
  if (url) meta("property", "og:url", url);
  if (img) meta("property", "og:image", img);
  meta("name", "twitter:card", img ? "summary_large_image" : "summary");
  meta("name", "twitter:title", title);
  meta("name", "twitter:description", desc);
  if (img) meta("name", "twitter:image", img);
  for (const m of Array.isArray(s.meta) ? s.meta : []) {
    const n = String(m?.name || "").trim();
    if (!/^[a-z0-9:._-]{1,60}$/i.test(n)) continue;
    meta(/^(og|fb|article|product):/i.test(n) ? "property" : "name", n, m.content);
  }
  if (/^#[0-9a-f]{3,8}$/i.test(opts.bg || "")) tags.push(`<style id="site-boot">html{background:${opts.bg}}</style>`);

  let out = html.replace(MARK, "").replace(/<style id="site-boot">[^<]*<\/style>\n?/g, "").replace(/<meta name="description"[^>]*>\n?/gi, "");
  out = out.replace(/<title>[^<]*<\/title>/i, `<title>${esc(title)}</title>\n<!-- site-meta -->\n${tags.join("\n")}\n<!-- /site-meta -->`);
  return out;
}

/** True when anything baked into the pages differs between two versions of the content. */
export function headChanged(a: any, b: any): boolean {
  const pick = (c: any) => JSON.stringify([c?.seo || {}, c?.theme?.bg, c?.brand?.name, c?.brand?.logoText, c?.shop?.title, c?.nav, c?.checkout?.title, c?.accountPage?.title]);
  return pick(a) !== pick(b);
}
