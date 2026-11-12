// Builds a complete, self-editing website from a template + content:
//   template files  +  content.json  +  images  +  cms/ (admin.js, admin.css, site.json)
// and packs it as a ZIP or pushes it to a GitHub repository in one commit.

import { STUDIO_BUILD } from "../build-info";
import JSZip from "jszip";
import type { TemplateDef } from "../schema/types";
import type { Repo } from "./repo";
import { bytesB64 } from "./repo";
import { blobToBytes, collectAssetPaths, getP, textToBytes } from "./util";
import { adminFile } from "../schema/common";
import { bakeHead, storePageLabel } from "./head";
import { assetBase, cleanUrl, type SbCfg } from "./supa";

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

async function fetchBytes(url: string): Promise<Uint8Array> {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`Couldn't load ${url} (${r.status}).`);
  return new Uint8Array(await r.arrayBuffer());
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
  host?: SbCfg;
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
      data = textToBytes(bakeHead(new TextDecoder().decode(data), hc, { file: f, label: template.id === "store" ? storePageLabel(f, hc) : "", base: opts.base, bg: hc?.theme?.bg, assets: opts.host ? assetBase(opts.host) : undefined }));
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
  // The portfolio CMS reads LinkedIn profile PDFs with pdf.js, loaded only when someone imports one.
  if (template.id === "portfolio") {
    for (const f of ["pdf.min.js", "pdf.worker.min.js"]) {
      try { files.push({ path: `cms/${f}`, data: await fetchBytes(`runtime/${f}`) }); }
      catch { warnings.push("The PDF reader for Import from LinkedIn is missing from this Studio build; the data export ZIP still works."); break; }
    }
  }
  if (!opts.host) files.push({ path: ".nojekyll", data: new Uint8Array() });
  files.push({
    path: "cms/site.json",
    data: textToBytes(JSON.stringify({ template: template.id, name: opts.name, version: opts.version, admin, exportedAt: new Date().toISOString(), generator: "Site Studio", studioBuild: STUDIO_BUILD, ...(opts.host ? { host: { kind: "supabase", url: cleanUrl(opts.host.url), key: opts.host.key, site: opts.host.site } } : {}) }, null, 2)),
  });
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
export function hostTag(html: string, sb: SbCfg): string {
  const cfg = JSON.stringify({ db: cleanUrl(sb.url), key: sb.key, site: sb.site, assets: assetBase(sb) }).replace(/</g, "\\u003c");
  const tag = `<script id="site-host" type="application/json">${cfg}</script>`;
  html = html.replace(/<script id="site-host" type="application\/json">[^<]*<\/script>\n?/, "");
  return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => `${m}\n${tag}`) : tag + html;
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
