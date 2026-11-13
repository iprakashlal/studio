// Settings → Migration: put a copy of this Studio on Cloudflare or Netlify with its files in the Studio's
// Cloudflare database or Supabase.
import type { Pages } from "./pages";
import { bytesB64, type Repo } from "./repo";
import { blobToBytes } from "./util";
import { SupaMgmt } from "./supamgmt";
import { studioSql, type StudioHostCfg } from "./studiohost";

/** This app's address (the folder index.html is in), e.g. https://you.github.io/studio/. */
export const appBase = () => location.origin + location.pathname.replace(/[^/]*$/, "");

export type AppFiles = { build: string; at?: string; files: Record<string, string>; cf?: Record<string, [string, number]> };
export async function appFiles(base: string): Promise<AppFiles> {
  const r = await fetch(base + "app-files.json?x=" + Date.now(), { cache: "no-store" });
  if (!r.ok) throw new Error("This Studio build has no file list (app-files.json). Wait for the next GitHub build and try again.");
  return r.json();
}

/** Tables, rules, storage and code emails in the chosen Supabase project; returns its address and public key. */
export async function prepareSupabase(m: SupaMgmt, ref: string, studio: string, owner: string, step: (s: string) => void) {
  step("Waiting for the Supabase project"); await m.waitReady(ref, step);
  step("Reading its public key"); const key = await m.publicKey(ref);
  step("Creating the Studio's tables and storage"); await m.sql(ref, studioSql(studio, owner));
  step("Turning on 6-digit sign-in codes"); await m.codeEmails(ref);
  return { url: `https://${ref}.supabase.co`, key };
}

/** Copies every file of `from` (studio.json, projects, photos) into the hosted Studio. */
export async function transferFiles(from: Repo, to: Repo, step: (done: number, total: number, path: string) => void, skip: (p: string) => boolean = () => false) {
  const paths = (await from.list("")).filter((p) => !p.startsWith(".") && !skip(p));
  let n = 0;
  for (const p of paths) {
    step(n, paths.length, p);
    const b = await from.getRaw(p);
    if (b) await to.pushFiles([{ path: p, base64: bytesB64(await blobToBytes(b)) }], "Move the Studio");
    n++;
  }
  step(n, paths.length, "");
  return paths.length;
}

/** Puts the Studio app on Netlify or Cloudflare (a new site, or the existing one) with its studio.config.json. */
export async function deployStudioApp(pages: Pages, o: { siteId?: string; siteName: string; source: string; config: StudioHostCfg }, step: (s: string) => void) {
  step("Reading the Studio's files");
  const r0 = await fetch(o.source + "app-files.json?x=" + Date.now(), { cache: "no-store" });
  if (!r0.ok) throw new Error("This Studio build has no file list (app-files.json). Wait for the next GitHub build and try again.");
  const listBytes = new Uint8Array(await r0.arrayBuffer()), m = JSON.parse(new TextDecoder().decode(listBytes)) as AppFiles;
  const cfg = new TextEncoder().encode(JSON.stringify({ ...o.config, source: o.source }, null, 2));
  let site = o.siteId ? await pages.get(o.siteId) : null;
  if (!site) {
    step(`Creating the Studio's site on ${pages.label}`);
    for (let i = 0; i < 4 && !site; i++) {
      const name = i ? `${o.siteName}-${Math.random().toString(36).slice(2, 6)}` : o.siteName;
      // A Cloudflare name that's taken on the account is this Studio's own earlier copy only when it was recorded; pick another.
      if (pages.kind === "cloudflare" && (await pages.find(name))) continue;
      try { site = await pages.create(name); }
      catch (e: any) { if (e?.status !== 422 || i === 3) throw e; }
    }
    if (!site) throw new Error("Couldn't find a free name for the Studio's site. Try another address.");
  }
  const dep = await pages.deployApp(site.siteId, m, [{ path: "studio.config.json", data: cfg }, { path: "app-files.json", data: listBytes }], async (p) => {
    const r = await fetch(o.source + p, { cache: "no-store" });
    if (!r.ok) throw new Error(`Couldn't read ${p} from the Studio.`);
    return new Uint8Array(await r.arrayBuffer());
  }, `Site Studio ${m.build}`, (d, t) => step(t ? `Uploading the Studio (${d} of ${t} files)` : "Uploading the Studio"));
  return { siteId: site.siteId, url: (dep.url || site.url).replace(/^http:/, "https:").replace(/\/?$/, "/"), build: m.build, kind: pages.kind, account: pages.account };
}
