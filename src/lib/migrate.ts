// Settings → Migration: put a copy of this Studio on Netlify with its files in Supabase.
import { Netlify } from "./netlify";
import { bytesB64, type Repo } from "./repo";
import { blobToBytes } from "./util";
import { SupaMgmt } from "./supamgmt";
import { studioSql, type StudioHostCfg } from "./studiohost";

const sha1 = async (b: Uint8Array) => [...new Uint8Array(await crypto.subtle.digest("SHA-1", b as BufferSource))].map((x) => x.toString(16).padStart(2, "0")).join("");
/** This app's address (the folder index.html is in), e.g. https://you.github.io/studio/. */
export const appBase = () => location.origin + location.pathname.replace(/[^/]*$/, "");

export type AppFiles = { build: string; at?: string; files: Record<string, string> };
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

/** Puts the Studio app on Netlify (a new site, or the existing one) with its studio.config.json. */
export async function deployStudioApp(nf: Netlify, o: { siteId?: string; siteName: string; source: string; config: StudioHostCfg }, step: (s: string) => void) {
  step("Reading the Studio's files");
  const r0 = await fetch(o.source + "app-files.json?x=" + Date.now(), { cache: "no-store" });
  if (!r0.ok) throw new Error("This Studio build has no file list (app-files.json). Wait for the next GitHub build and try again.");
  const listBytes = new Uint8Array(await r0.arrayBuffer()), m = JSON.parse(new TextDecoder().decode(listBytes)) as AppFiles;
  const cfg = new TextEncoder().encode(JSON.stringify({ ...o.config, source: o.source }, null, 2));
  const digest = { ...m.files, "studio.config.json": await sha1(cfg), "app-files.json": await sha1(listBytes) };
  let siteId = o.siteId || "", url = "";
  if (siteId) { try { const s = await nf.getSite(siteId); url = s.ssl_url || s.url; } catch { siteId = ""; } }
  if (!siteId) {
    step("Creating the Studio's site on Netlify");
    for (let i = 0; i < 4 && !siteId; i++) {
      try { const s = await nf.createSite(i ? `${o.siteName}-${Math.random().toString(36).slice(2, 6)}` : o.siteName); siteId = s.id; url = s.ssl_url || s.url; }
      catch (e: any) { if (e?.status !== 422 || i === 3) throw e; }
    }
  }
  await nf.deployDigest(siteId, digest, async (p) => {
    if (p === "studio.config.json") return cfg;
    if (p === "app-files.json") return listBytes;
    const r = await fetch(o.source + p, { cache: "no-store" });
    if (!r.ok) throw new Error(`Couldn't read ${p} from the Studio.`);
    return new Uint8Array(await r.arrayBuffer());
  }, `Site Studio ${m.build}`, (d, t) => step(t ? `Uploading the Studio (${d} of ${t} files)` : "Uploading the Studio"));
  return { siteId, url: url.replace(/^http:/, "https:").replace(/\/?$/, "/"), build: m.build };
}
