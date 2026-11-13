// Studio Partners: client Studios this Studio set up (on its own accounts or the client's), and the sites shared
// with them, kept in step both ways. Each client Studio is a hosted Studio (Netlify + Supabase) where the
// client's emails are owners and this Studio's email is a partner member.
import { Netlify } from "./netlify";
import { gitBlobSha, jsonB64, type Repo } from "./repo";
import { SupaMgmt } from "./supamgmt";
import { studioSql, type StudioHostCfg } from "./studiohost";
import { backendOf } from "./backend";
import { deployStudioApp } from "./migrate";
import type { ProjectMeta, Studio, StudioIndex } from "./studio";
import { TEMPLATES } from "../schema";

export type SharedSite = { project: string; base: string; at: string };
export type PartnerRec = {
  id: string; name: string; url: string; studio: string; siteId?: string;
  /** Where the client Studio keeps its files: Supabase (sbUrl, sbKey) or the Studio database on Cloudflare (api). */
  backend?: "supabase" | "cloudflare"; api?: string; sbUrl?: string; sbKey?: string;
  accounts: "mine" | "client"; clientEmails: string[]; partnerEmail: string; at: string; shared: SharedSite[];
};
export type SiteSync = "same" | "mine" | "theirs" | "both" | "gone";

const now = () => new Date().toISOString();
/** The client Studio's place (its studio.config.json, without branding). */
export const hostOf = (p: Pick<PartnerRec, "backend" | "api" | "sbUrl" | "sbKey" | "studio" | "name">, partner?: { name: string; url?: string }): StudioHostCfg =>
  p.backend === "cloudflare" ? { kind: "cloudflare", api: p.api!, studio: p.studio, name: p.name, ...(partner ? { partner } : {}) } : { kind: "supabase", url: p.sbUrl!, key: p.sbKey!, studio: p.studio, name: p.name, ...(partner ? { partner } : {}) };
export const partnerCfg = (p: PartnerRec, partner: { name: string; url?: string }): StudioHostCfg => hostOf(p, partner);
/** The client Studio's files, read and written as this Studio's partner sign-in. */
export const remoteRepo = (p: PartnerRec) => backendOf(hostOf(p)).repo(p.studio);
export async function partnerSignedIn(p: Pick<PartnerRec, "backend" | "api" | "sbUrl" | "sbKey" | "studio" | "name" | "partnerEmail">) {
  const e = await backendOf(hostOf(p)).signedIn().catch(() => null);
  return !!e && e.toLowerCase() === p.partnerEmail.toLowerCase();
}

/** Tables, members (client owners + this Studio as partner) and code emails in the client's Supabase project. */
export async function prepareClientSupabase(m: SupaMgmt, ref: string, o: { studio: string; clientEmails: string[]; partnerEmail: string }, step: (s: string) => void) {
  step("Waiting for the Supabase project"); await m.waitReady(ref, step);
  step("Reading its public key"); const key = await m.publicKey(ref);
  const [first, ...rest] = o.clientEmails;
  step("Creating the client Studio's tables, storage and members");
  await m.sql(ref, studioSql(o.studio, first, "owner", [...rest.map((email) => ({ email, role: "owner" as const })), { email: o.partnerEmail, role: "partner" as const }]));
  step("Turning on 6-digit sign-in codes"); await m.codeEmails(ref);
  return { url: `https://${ref}.supabase.co`, key };
}

/** First files of a client Studio: its name, your “Powered by” look and an empty project list. */
export async function seedClientStudio(remote: Repo, o: { name: string; badge?: unknown; menus?: unknown }) {
  const cur = await remote.getJSON<any>("studio.json").catch(() => null);
  const idx = { version: 1, categories: [], projects: [], ...(cur?.data || {}), brand: { name: o.name, v: Date.now() }, ...(o.badge ? { badge: o.badge } : {}), ...(o.menus ? { menus: o.menus } : {}) };
  await remote.putFile("studio.json", jsonB64(idx), "Set up the client Studio", cur?.sha);
}

/** Puts (or updates) the Studio app for the client on Netlify with its studio.config.json. */
export async function deployClientApp(nf: Netlify, p: Pick<PartnerRec, "siteId" | "studio" | "backend" | "api" | "sbUrl" | "sbKey" | "name">, siteName: string, source: string, partner: { name: string; url?: string }, step: (s: string) => void) {
  return deployStudioApp(nf, { siteId: p.siteId, siteName, source, config: hostOf(p, partner) }, step);
}

const projectFiles = async (r: Repo, id: string) => (await r.list(`projects/${id}/`)).filter((p) => !p.includes("/exports/"));
/** Copies a project's content and any photos the other side lacks. Returns the content's sha (same on both sides). */
async function copyProject(from: Repo, to: Repo, id: string, step?: (s: string) => void): Promise<string> {
  const c = await from.getText(`projects/${id}/content.json`);
  if (!c) throw new Error("The project's content wasn't found.");
  const have = new Set(await projectFiles(to, id));
  const photos = (await projectFiles(from, id)).filter((p) => p !== `projects/${id}/content.json` && !have.has(p));
  let n = 0;
  for (const p of photos) {
    step?.(`Copying photos (${++n} of ${photos.length})`);
    const b = await from.getRaw(p); if (!b) continue;
    const bytes = new Uint8Array(await b.arrayBuffer()); let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    await to.pushFiles([{ path: p, base64: btoa(s) }], "Copy photo");
  }
  step?.("Copying the content");
  const b64 = btoa(unescape(encodeURIComponent(c.text)));
  await to.pushFiles([{ path: `projects/${id}/content.json`, base64: b64 }], "Copy content");
  return gitBlobSha(b64);
}
const shaOf = async (r: Repo, id: string) => { const t = await r.getText(`projects/${id}/content.json`); return t ? gitBlobSha(btoa(unescape(encodeURIComponent(t.text)))) : null; };

/** The project's entry for the client Studio: what it is and its history, not your hosting or publishing. */
const metaFor = (m: ProjectMeta, partner: { name: string; url?: string }, prev?: ProjectMeta): ProjectMeta => {
  const { publish, host, worker, inbox, siteSha, syncedAt, ...rest } = m as any;
  return { ...rest, ...(prev ? { publish: prev.publish, host: prev.host, worker: prev.worker, inbox: prev.inbox, siteSha: prev.siteSha, syncedAt: prev.syncedAt } : {}), partner, updatedAt: now(), contentAt: now() } as ProjectMeta;
};
async function upsertRemoteMeta(remote: Repo, m: ProjectMeta, partner: { name: string; url?: string }) {
  const cur = await remote.getJSON<StudioIndex>("studio.json");
  const idx: StudioIndex = cur?.data || ({ version: 1, categories: [], projects: [] } as StudioIndex);
  const i = idx.projects.findIndex((x) => x.id === m.id);
  const next = metaFor(m, partner, i >= 0 ? idx.projects[i] : undefined);
  if (i >= 0) idx.projects[i] = next; else idx.projects.unshift(next);
  await remote.putFile("studio.json", jsonB64(idx), `Shared ${m.name}`, cur?.sha);
}

/** Sends a project to the client Studio (first share, or “send my version”). */
export async function sendSite(me: Studio, p: PartnerRec, m: ProjectMeta, partner: { name: string; url?: string }, step?: (s: string) => void): Promise<SharedSite> {
  const remote = remoteRepo(p);
  const sha = await copyProject(me.repo, remote, m.id, step);
  step?.("Adding it to the client's projects"); await upsertRemoteMeta(remote, m, partner);
  return { project: m.id, base: sha, at: now() };
}

/** Brings the client's version into this Studio (“keep theirs”). */
export async function pullSite(me: Studio, p: PartnerRec, id: string, step?: (s: string) => void): Promise<{ shared: SharedSite; index: StudioIndex }> {
  const remote = remoteRepo(p);
  const sha = await copyProject(remote, me.repo, id, step);
  const c = await me.loadContent(id);
  const index = await me.updateIndex((i) => { const m = i.projects.find((x) => x.id === id); if (m) { m.updatedAt = m.contentAt = now(); m.summary = TEMPLATES[m.template]?.summary(c) ?? m.summary; } }, "Bring in the client's changes");
  return { shared: { project: id, base: sha, at: now() }, index };
}

/** Who changed the site since it was last in step: you, the client, both, or neither. */
export async function siteSync(me: Studio, p: PartnerRec, s: SharedSite): Promise<SiteSync> {
  const [mine, theirs] = await Promise.all([shaOf(me.repo, s.project), shaOf(remoteRepo(p), s.project)]);
  if (!theirs || !mine) return "gone";
  if (mine === theirs) return "same";
  if (theirs === s.base) return "mine";
  if (mine === s.base) return "theirs";
  return "both";
}
