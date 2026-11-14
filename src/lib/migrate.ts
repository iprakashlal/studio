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

// ---------------------------------------------------------------- keeping a moved Studio's projects in step
export type ProjectRow = { id: string; name: string; here?: string; there?: string; same: boolean };
/** Every project in either Studio: when each copy last changed, and whether the two copies are the same. */
export async function compareProjects(here: Repo, there: Repo): Promise<{ rows: ProjectRow[]; hereIdx: any; thereIdx: any; thereSha?: string }> {
  const a = (await here.getJSON<any>("studio.json"))?.data || { projects: [] };
  const bf = await there.getJSON<any>("studio.json"), b = bf?.data || { version: 1, categories: [], projects: [] };
  const ids = [...new Set([...a.projects, ...b.projects].map((p: any) => p.id))];
  const rows: ProjectRow[] = [];
  for (const id of ids) {
    const x = a.projects.find((p: any) => p.id === id), y = b.projects.find((p: any) => p.id === id);
    let same = false;
    if (x && y) {
      const [cx, cy] = await Promise.all([here.getText(`projects/${id}/content.json`).catch(() => null), there.getText(`projects/${id}/content.json`).catch(() => null)]);
      same = !!cx && !!cy && cx.text.trim() === cy.text.trim() && x.version === y.version;
    }
    rows.push({ id, name: (x || y).name, here: x?.updatedAt, there: y?.updatedAt, same });
  }
  return { rows, hereIdx: a, thereIdx: b, thereSha: bf?.sha };
}
/** Copies the chosen projects (their entry, content and photos) from `here` into `there`. Nothing else in
 *  `there` changes: its other projects, settings and members stay as they are. */
export async function bringProjects(here: Repo, there: Repo, ids: string[], step: (s: string) => void) {
  const { hereIdx } = await compareProjects(here, there).catch(() => ({ hereIdx: null as any }));
  const all = await here.list("projects/");
  for (const [k, id] of ids.entries()) {
    const files = all.filter((p) => p.startsWith(`projects/${id}/`));
    for (const [n, p] of files.entries()) {
      step(`Copying ${hereIdx?.projects.find((x: any) => x.id === id)?.name || id} (${k + 1} of ${ids.length}) · file ${n + 1} of ${files.length}`);
      const b = await here.getRaw(p);
      if (b) await there.pushFiles([{ path: p, base64: bytesB64(await blobToBytes(b)) }], "Bring a project across");
    }
  }
  step("Adding them to the Studio's project list");
  // Re-read just before writing, so changes made there in the meantime are kept.
  for (let attempt = 0; attempt < 3; attempt++) {
    const cur = await there.getJSON<any>("studio.json"), idx = cur?.data || { version: 1, categories: [], projects: [] };
    for (const id of ids) {
      const p = hereIdx.projects.find((x: any) => x.id === id); if (!p) continue;
      const i = idx.projects.findIndex((x: any) => x.id === id);
      if (i >= 0) idx.projects[i] = p; else idx.projects.push(p);
      const cat = (hereIdx.categories || []).find((c: any) => c.id === p.category);
      if (cat && !(idx.categories || []).some((c: any) => c.id === cat.id)) (idx.categories ||= []).push(cat);
    }
    try { await there.putFile("studio.json", bytesB64(new TextEncoder().encode(JSON.stringify(idx, null, 2))), "Bring projects across", cur?.sha); return; }
    catch (e: any) { if (attempt === 2 || !/409|conflict|changed/i.test(String(e?.message || e?.status))) throw e; }
  }
}
