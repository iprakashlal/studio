// Builds a complete, self-editing website from a template + content:
//   template files  +  content.json  +  images  +  cms/ (admin.js, admin.css, site.json)
// and packs it as a ZIP or pushes it to a GitHub repository in one commit.

import { badgeScript, badgeVersion, type BadgeCfg } from "./badge";
import { currentMenus, menuVersion } from "./menus";
import { STUDIO_BUILD } from "../build-info";
import JSZip from "jszip";
import type { TemplateDef } from "../schema/types";
import { TEMPLATES } from "../schema";
import type { Repo } from "./repo";
import { bytesB64 } from "./repo";
import { blobToBytes, collectAssetPaths, getP, textToBytes } from "./util";
import { adminFile } from "../schema/common";
import { siteBase, bakeHead, pageLabel } from "./head";
import { assetBase, cfAssetBase, cleanUrl, type CfSiteCfg, type SbCfg } from "./supa";

export type SiteFile = { path: string; data: Uint8Array };
/** `when` lists files exported only if every given content path is switched on. */
export type Manifest = { files: string[]; when?: Record<string, string[]>; starters: { id: string; name: string; description: string; file: string }[] };

const manifests = new Map<string, Promise<Manifest>>();
export function loadManifest(templateId: string): Promise<Manifest> {
  if (!manifests.has(templateId)) {
    manifests.set(templateId, fetch(`templates/${templateId}/manifest.json`, { cache: "no-store" }).then((r) => {
      if (!r.ok) throw new Error(`Template "${templateId}" is missing its manifest.`);
      return r.json();
    }));
  }
  return manifests.get(templateId)!;
}

export async function loadStarter(templateId: string, starterId: string): Promise<any> {
  const m = await loadManifest(templateId);
  const s = m.starters.find((x) => x.id === starterId) || m.starters[0];
  const r = await fetch(`templates/${templateId}/${s.file}`, { cache: "no-store" });
  if (!r.ok) throw new Error("Couldn't load the starter content.");
  return r.json();
}

/** Default content for a template, used to fill gaps in older projects. */
export async function loadDefaults(templateId: string) {
  return loadStarter(templateId, "default");
}
/** What a saved project is merged over when it opens: the starting content, without sample lists a template added
 *  later (an older project shouldn't suddenly show the starter's sample products). */
export async function loadMergeBase(templateId: string) {
  const c: any = await loadDefaults(templateId);
  for (const path of TEMPLATES[templateId]?.sampleOnly || []) { const ks = path.split("."); let o = c; for (const k of ks.slice(0, -1)) o = o?.[k]; if (o && Array.isArray(o[ks[ks.length - 1]])) o[ks[ks.length - 1]] = []; }
  return c;
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`Couldn't load ${url} (${r.status}).`);
  return new Uint8Array(await r.arrayBuffer());
}


const slugify = (v: unknown) => String(v ?? "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
/** robots.txt, and sitemap.xml when the site's address is known: the template's public pages, custom pages and (for a shop) products. */
export function siteFiles(template: TemplateDef, c: any, base: string, admin: string, have: Set<string>): { path: string; text: string }[] {
  const hidden = !!c?.seo?.noindex, xml = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const urls: string[] = [];
  if (base && !hidden) {
    const PRIVATE = /^(admin|404|cart|checkout|account|order|page|section|product)\.html$/;
    const multi = template.id === "store" || !!c?.site?.multiPage;
    urls.push(base);
    if (multi) for (const p of template.pages) if (p.file !== "index.html" && !PRIVATE.test(p.file) && have.has(p.file) && !(p.file === "portfolio.html" && c?.nav?.showPortfolio === false)) urls.push(base + p.file);
    if (template.id === "restaurant" && c?.ordering?.on && have.has("order.html")) urls.push(base + "order.html");
    const pageFile = template.pageFile === "index.html" ? "" : "page.html";
    for (const p of (Array.isArray(c?.staticPages) ? c.staticPages : [])) { const slug = p && p.show !== false && !p.noindex && String(p.title || "").trim() ? slugify(p.slug || p.title) || p.id : ""; if (slug) urls.push(base + pageFile + "?p=" + encodeURIComponent(slug)); }
    if (template.id === "store") for (const p of (Array.isArray(c?.products) ? c.products : [])) { const slug = p && p.hidden !== true ? p.slug || slugify(p.name) || p.id : ""; if (slug) urls.push(base + "product.html?p=" + encodeURIComponent(slug)); }
  }
  const day = new Date().toISOString().slice(0, 10), list = [...new Set(urls)].slice(0, 5000);
  const robots = ["User-agent: *", hidden ? "Disallow: /" : "Allow: /", ...(hidden ? [] : ["Disallow: /" + admin, "Disallow: /cms/"]), ...(list.length ? ["", "Sitemap: " + base + "sitemap.xml"] : []), ""].join("\n");
  const out = [{ path: "robots.txt", text: robots }];
  if (list.length) out.push({ path: "sitemap.xml", text: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${list.map((u) => `  <url><loc>${xml(u)}</loc><lastmod>${day}</lastmod></url>`).join("\n")}\n</urlset>\n` });
  return out;
}

export async function buildSite(opts: {
  template: TemplateDef;
  content: any;
  name: string;
  version: number;
  includeContent: boolean;
  getAsset: (path: string) => Promise<Blob | null>;
  /** Admin page file name to use instead of the one in `content` (when the site keeps its own content). */
  admin?: string;
  /** Content whose title, metadata and background go into the pages' <head> (defaults to `content`; the live
   *  site's own content when it keeps it). */
  headContent?: any;
  /** The site's address, for canonical links and share images when the content doesn't set one. */
  base?: string;
  /** Image paths the target already has. Upload names are unique, so these are left as they are instead of re-sent. */
  keep?: Set<string>;
  /** Hosted outside GitHub: pages load the content and photos from this Supabase project. */
  host?: SbCfg | CfSiteCfg;
  /** The badge's look; defaults to the Studio's current setting. */
  badge?: BadgeCfg;
}): Promise<{ files: SiteFile[]; warnings: string[]; admin: string }> {
  const { template, content } = opts;
  const m = await loadManifest(template.id);
  const files: SiteFile[] = [];
  const warnings: string[] = [];
  const hc0 = opts.headContent || content;
  const hc = hc0?.seo?.title || hc0?.brand?.name || hc0?.brand?.logoText ? hc0 : { ...hc0, seo: { ...(hc0?.seo || {}), title: opts.name } };
  // The site's CMS page goes out under the owner's chosen name (Admin page → address).
  const admin = opts.admin || adminFile(content);

  const optional = Object.entries(m.when || {}).filter(([, paths]) => paths.every((p) => !!getP(content, p))).map(([f]) => f);
  for (const f of [...m.files, ...optional]) {
    let data = await fetchBytes(`templates/${template.id}/${f}`);
    if (f.endsWith(".html") && f !== "admin.html" && f !== "404.html")
      data = textToBytes(bakeHead(new TextDecoder().decode(data), hc, { file: f, label: pageLabel(template.id, f, hc), base: opts.base, bg: hc?.theme?.bg, assets: opts.host ? ("api" in opts.host ? cfAssetBase(opts.host) : assetBase(opts.host)) : undefined }));
    // Google Fonts held back until consent (Legal & privacy): the pages must not ask for them from their own <head>.
    if (f.endsWith(".html") && hc0?.privacy?.blockFonts && hc0?.consent?.on) data = textToBytes(new TextDecoder().decode(data).replace(/<link\b[^>]*\bhref="https:\/\/fonts\.(?:googleapis|gstatic)\.com[^"]*"[^>]*>\s*/g, (m) => (/\brel="stylesheet"/.test(m) ? m.replace(/\shref="[^"]*"/, "") : "")));
    if (opts.host && f.endsWith(".html")) data = textToBytes(hostTag(new TextDecoder().decode(data), opts.host));
    if (f.endsWith(".md") && admin !== "admin.html") data = textToBytes(new TextDecoder().decode(data).replace(/\badmin\.html\b/g, admin));
    files.push({ path: f === "admin.html" ? admin : f, data });
  }
  try {
    files.push({ path: "cms/admin.js", data: await fetchBytes("runtime/admin.js") });
    files.push({ path: "cms/admin.css", data: await fetchBytes("runtime/admin.css") });
  } catch {
    throw new Error("The site CMS files are missing from this Studio build. Run the GitHub Actions build again.");
  }
  // The admin page reads PDFs with pdf.js (LinkedIn profiles, Fill from a PDF on static pages), loaded only when used.
  {
    for (const f of ["pdf.min.js", "pdf.worker.min.js"]) {
      try { files.push({ path: `cms/${f}`, data: await fetchBytes(`runtime/${f}`) }); }
      catch { warnings.push("The PDF reader (Import from LinkedIn, Fill from a PDF) is missing from this Studio build."); break; }
    }
  }
  // The "Powered by" badge's look (the Studio-wide setting); each site's content says whether it shows.
  files.push({ path: "assets/badge.js", data: textToBytes(badgeScript(opts.badge)) });
  if (!opts.host) files.push({ path: ".nojekyll", data: new Uint8Array() });
  files.push({
    path: "cms/site.json",
    data: textToBytes(JSON.stringify({ template: template.id, name: opts.name, version: opts.version, admin, exportedAt: new Date().toISOString(), generator: "Site Studio", studioBuild: STUDIO_BUILD, badge: badgeVersion(opts.badge), ...(currentMenus()[template.id] ? { menu: currentMenus()[template.id] } : {}), menuV: menuVersion(currentMenus()[template.id]), ...(opts.host ? { host: "api" in opts.host ? { kind: "cloudflare", api: opts.host.api, site: opts.host.site } : { kind: "supabase", url: cleanUrl(opts.host.url), key: opts.host.key, site: opts.host.site } } : {}) }, null, 2)),
  });
  // robots.txt and sitemap.xml, for search engines. The sitemap needs the site's address (SEO → Site address, or the
  // address it is being published to); without one only robots.txt is written.
  { const sm = siteFiles(template, hc0, siteBase(hc0, opts.base), admin, new Set([...m.files, ...optional])); for (const f of sm) files.push({ path: f.path, data: textToBytes(f.text) }); }
  if (opts.includeContent) {
    files.push({ path: "content.json", data: textToBytes(JSON.stringify(content, null, 2)) });
    for (const p of collectAssetPaths(content)) {
      if (opts.keep?.has(p)) continue;
      const b = await opts.getAsset(p);
      if (b) files.push({ path: p, data: await blobToBytes(b) });
      else warnings.push(`Image not found: ${p}`);
    }
  }
  return { files, warnings, admin };
}

/** Tells the pages where the live content and photos are (the key is the public anon key). */
export function hostTag(html: string, db: SbCfg | CfSiteCfg): string {
  const cfg = JSON.stringify("api" in db ? { api: db.api, site: db.site, assets: cfAssetBase(db) } : { db: cleanUrl(db.url), key: db.key, site: db.site, assets: assetBase(db) }).replace(/</g, "\\u003c");
  const tag = `<script id="site-host" type="application/json">${cfg}</script>`;
  html = html.replace(/<script id="site-host" type="application\/json">[^<]*<\/script>\n?/, "");
  return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => `${m}\n${tag}`) : tag + html;
}

/** What a site ZIP made by Export holds, for loading it back into a project. */
export type SiteZip = { template: string; name: string; version: number; exportedAt: string; content: any; /** Pictures the content uses that are in the ZIP. */ assets: { path: string; data: Uint8Array }[]; /** Pictures the content names that the ZIP doesn't have. */ missing: string[] };
const ZIP_MAX = 300 * 1024 * 1024, CONTENT_MAX = 8 * 1024 * 1024, ASSET_MAX = 40 * 1024 * 1024;
/** Reads a ZIP made by Export ZIP. Only the content and the pictures it names are taken; the pages, scripts and
 *  CMS files in the ZIP are ignored (the Studio builds those itself). Throws a plain message when it isn't one. */
export async function readSiteZip(file: Blob): Promise<SiteZip> {
  if (file.size > ZIP_MAX) throw new Error("That file is over 300 MB, which is more than a site ZIP should be.");
  let zip: JSZip;
  try { zip = await JSZip.loadAsync(await file.arrayBuffer()); } catch { throw new Error("That file isn't a ZIP the Studio can open."); }
  // A ZIP that was unpacked and zipped again often has everything inside one folder: look there too.
  const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir);
  const at = names.find((n) => /(^|\/)cms\/site\.json$/.test(n) && !n.includes("__MACOSX"));
  if (!at) throw new Error("This isn't a ZIP made by Export ZIP (it has no cms/site.json).");
  const root = at.slice(0, at.length - "cms/site.json".length);
  const text = async (n: string, max: number) => { const f = zip.file(root + n); if (!f) return null; const b = await f.async("uint8array"); if (b.length > max) throw new Error(`${n} in the ZIP is too large.`); return new TextDecoder().decode(b); };
  let info: any = null, content: any = null;
  try { info = JSON.parse((await text("cms/site.json", 1024 * 1024)) || "null"); } catch { /* not JSON */ }
  if (!info || typeof info.template !== "string") throw new Error("This ZIP's cms/site.json can't be read.");
  const raw = await text("content.json", CONTENT_MAX);
  if (raw == null) throw new Error("This ZIP has the site's pages but not its content (content.json), so there is nothing to load. Export it again from the project it came from.");
  try { content = JSON.parse(raw); } catch { /* not JSON */ }
  if (!content || typeof content !== "object" || Array.isArray(content)) throw new Error("This ZIP's content.json can't be read.");
  const assets: SiteZip["assets"] = [], missing: string[] = [];
  for (const p of collectAssetPaths(content)) {
    // Only pictures in the uploads folder, by their plain file name.
    if (!/^assets\/uploads\/[\w][\w.\-]{0,200}$/.test(p)) { missing.push(p); continue; }
    const f = zip.file(root + p); if (!f) { missing.push(p); continue; }
    const data = await f.async("uint8array");
    if (data.length > ASSET_MAX) { missing.push(p); continue; }
    assets.push({ path: p, data });
  }
  return { template: info.template, name: String(info.name || "").slice(0, 120), version: +info.version || 0, exportedAt: String(info.exportedAt || ""), content, assets, missing };
}

export async function zipSite(files: SiteFile[]): Promise<Blob> {
  const zip = new JSZip();
  for (const f of files) zip.file(f.path, f.data);
  return zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Commits the site. If the admin page was renamed since the last publish, the old page is removed in the same commit. */
export async function publishSite(target: Repo, files: SiteFile[], message: string, admin = "admin.html") {
  const prev = await target.getJSON<{ admin?: string }>("cms/site.json").catch(() => null);
  const old = prev ? prev.data?.admin || "admin.html" : "";
  const remove = old && old !== admin && /^[a-z0-9-]+\.html$/.test(old) ? [old] : [];
  await target.pushFiles(files.map((f) => ({ path: f.path, base64: bytesB64(f.data) })), message, remove);
}

export const zipName = (name: string, version: number) => `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "site"}-v${version}.zip`;
