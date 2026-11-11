// Builds a complete, self-editing website from a template + content:
//   template files  +  content.json  +  images  +  cms/ (admin.js, admin.css, site.json)
// and packs it as a ZIP or pushes it to a GitHub repository in one commit.

import JSZip from "jszip";
import type { TemplateDef } from "../schema/types";
import type { Repo } from "./repo";
import { bytesB64 } from "./repo";
import { blobToBytes, collectAssetPaths, getP, textToBytes } from "./util";
import { adminFile } from "../schema/common";

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

const escAttr = (s: string) => String(s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** Bake the site title and description into each page so search engines and link previews see them. */
function bakeSeo(html: string, title: string, description: string): string {
  let out = html.replace(/<title>[^<]*<\/title>/i, `<title>${escAttr(title)}</title>`);
  if (/<meta name="description"[^>]*>/i.test(out)) out = out.replace(/<meta name="description"[^>]*>/i, `<meta name="description" content="${escAttr(description)}">`);
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
}): Promise<{ files: SiteFile[]; warnings: string[]; admin: string }> {
  const { template, content } = opts;
  const m = await loadManifest(template.id);
  const files: SiteFile[] = [];
  const warnings: string[] = [];
  const title = content?.seo?.title || opts.name;
  const desc = content?.seo?.description || "";
  // The site's CMS page goes out under the owner's chosen name (Admin page → address).
  const admin = opts.admin || adminFile(content);

  const optional = Object.entries(m.when || {}).filter(([, paths]) => paths.every((p) => !!getP(content, p))).map(([f]) => f);
  for (const f of [...m.files, ...optional]) {
    let data = await fetchBytes(`templates/${template.id}/${f}`);
    if (f.endsWith(".html") && f !== "admin.html") data = textToBytes(bakeSeo(new TextDecoder().decode(data), title, desc));
    if (f.endsWith(".md") && admin !== "admin.html") data = textToBytes(new TextDecoder().decode(data).replace(/\badmin\.html\b/g, admin));
    files.push({ path: f === "admin.html" ? admin : f, data });
  }
  try {
    files.push({ path: "cms/admin.js", data: await fetchBytes("runtime/admin.js") });
    files.push({ path: "cms/admin.css", data: await fetchBytes("runtime/admin.css") });
  } catch {
    throw new Error("The site CMS files are missing from this Studio build. Run the GitHub Actions build again.");
  }
  files.push({ path: ".nojekyll", data: new Uint8Array() });
  files.push({
    path: "cms/site.json",
    data: textToBytes(JSON.stringify({ template: template.id, name: opts.name, version: opts.version, admin, exportedAt: new Date().toISOString(), generator: "Site Studio" }, null, 2)),
  });
  if (opts.includeContent) {
    files.push({ path: "content.json", data: textToBytes(JSON.stringify(content, null, 2)) });
    for (const p of collectAssetPaths(content)) {
      const b = await opts.getAsset(p);
      if (b) files.push({ path: p, data: await blobToBytes(b) });
      else warnings.push(`Image not found: ${p}`);
    }
  }
  return { files, warnings, admin };
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
