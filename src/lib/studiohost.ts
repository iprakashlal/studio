// The Studio outside GitHub: the app on Netlify, its files (studio.json, projects/…, photos) in Supabase, and
// sign-in by an emailed 6-digit code. A hosted Studio finds its Supabase in studio.config.json next to the app.
//
//   studio_files    one row per file (JSON text in the row; photos and other binaries in Storage, bucket "studio")
//   studio_members  who may use which Studio (owner, member, partner)
import type { SupabaseClient } from "@supabase/supabase-js";
import { RepoError, gitBlobSha, type FileIn, type Repo } from "./repo";
import type { RepoCfg } from "./crypto";
import { cleanUrl, sbClient } from "./supa";

type HostCommon = { studio: string; name?: string; source?: string; partner?: { name: string; url?: string; logo?: string } };
export type SbHostCfg = HostCommon & { kind: "supabase"; url: string; key: string };
export type CfHostCfg = HostCommon & { kind: "cloudflare"; api: string };
export type StudioHostCfg = SbHostCfg | CfHostCfg;
/** Where a moved Studio lives (kept in studio.json, no secrets). */
export type HostedStudio = { url: string; siteId: string; siteName: string; /** Where the app runs (Netlify when not set). */ pages?: "netlify" | "cloudflare"; account?: string; sbUrl?: string; api?: string; backend?: "supabase" | "cloudflare"; studio: string; owner: string; build?: string; at: string };

export const STUDIO_BUCKET = "studio";
const TEXT = /\.(json|md|txt|csv|html|css|js|svg)$/i;

/** Tables, rules and the storage bucket for hosted Studios. Safe to run again. */
export function studioSql(studio: string, owner: string, role: "owner" | "member" | "partner" = "owner", extra: { email: string; role: "owner" | "member" | "partner" }[] = []) {
  const q = (s: string) => "'" + String(s).replace(/'/g, "''") + "'";
  return `-- Site Studio (hosted): the Studio's own files and who may use it. Safe to run again.
create table if not exists public.studio_files (
  studio text not null, path text not null,
  body text, blob boolean not null default false, sha text not null default '', size integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (studio, path)
);
create table if not exists public.studio_members (
  studio text not null, email text not null,
  role text not null default 'owner' check (role in ('owner', 'member', 'partner')),
  added_at timestamptz not null default now(),
  primary key (studio, email)
);
alter table public.studio_files enable row level security;
alter table public.studio_members enable row level security;
create or replace function public.studio_role(s text) returns text
  language sql stable security definer set search_path = public as $$
  select role from public.studio_members where studio = s and lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')) limit 1
$$;
drop policy if exists "studio files: members" on public.studio_files;
create policy "studio files: members" on public.studio_files for all to authenticated
  using (public.studio_role(studio) is not null) with check (public.studio_role(studio) is not null);
drop policy if exists "studio members: read" on public.studio_members;
create policy "studio members: read" on public.studio_members for select to authenticated using (public.studio_role(studio) is not null);
drop policy if exists "studio members: manage" on public.studio_members;
create policy "studio members: manage" on public.studio_members for all to authenticated
  using (public.studio_role(studio) in ('owner', 'partner')) with check (public.studio_role(studio) in ('owner', 'partner'));
insert into storage.buckets (id, name, public) values ('${STUDIO_BUCKET}', '${STUDIO_BUCKET}', false) on conflict (id) do nothing;
drop policy if exists "studio storage: members" on storage.objects;
create policy "studio storage: members" on storage.objects for all to authenticated
  using (bucket_id = '${STUDIO_BUCKET}' and public.studio_role(split_part(name, '/', 1)) is not null)
  with check (bucket_id = '${STUDIO_BUCKET}' and public.studio_role(split_part(name, '/', 1)) is not null);
insert into public.studio_members (studio, email, role) values (${q(studio)}, lower(${q(owner)}), ${q(role)})
  on conflict (studio, email) do update set role = excluded.role;
${extra.map((m) => `insert into public.studio_members (studio, email, role) values (${q(studio)}, lower(${q(m.email)}), ${q(m.role)})
  on conflict (studio, email) do update set role = excluded.role;`).join("\n")}`;
}

const b64Bytes = (b: string) => Uint8Array.from(atob(String(b).replace(/\s/g, "")), (c) => c.charCodeAt(0));
const mime = (p: string) => (/\.png$/i.test(p) ? "image/png" : /\.jpe?g$/i.test(p) ? "image/jpeg" : /\.webp$/i.test(p) ? "image/webp" : /\.gif$/i.test(p) ? "image/gif" : /\.svg$/i.test(p) ? "image/svg+xml" : /\.pdf$/i.test(p) ? "application/pdf" : "application/octet-stream");

/** The Studio's files in Supabase, with the same behaviour as its GitHub repository (stale writes are refused). */
export class StudioSbRepo implements Repo {
  readonly demo = false;
  readonly cfg: RepoCfg;
  constructor(private sb: { url: string; key: string }, readonly studio: string, private client?: SupabaseClient) {
    this.cfg = { owner: "supabase", repo: studio, branch: "main" };
  }
  get db() { return this.client || sbClient(this.sb); }
  private fail(e: any, what: string): never {
    const m = e?.message || String(e);
    throw new RepoError(/row-level|permission|JWT|not authorized/i.test(m) ? `This sign-in can't ${what} in this Studio.` : `Supabase couldn't ${what}: ${m}`, /row-level|permission/i.test(m) ? 403 : 500);
  }
  private async row(path: string) {
    const { data, error } = await this.db.from("studio_files").select("body, blob, sha, updated_at").eq("studio", this.studio).eq("path", path).maybeSingle();
    if (error) this.fail(error, "read " + path);
    return data as { body: string | null; blob: boolean; sha: string; updated_at: string } | null;
  }
  async check() {
    const { error } = await this.db.from("studio_files").select("path").eq("studio", this.studio).limit(1);
    if (error) this.fail(error, "read files");
  }
  async getText(path: string) {
    const r = await this.row(path);
    if (!r) return null;
    if (!r.blob) return { text: r.body || "", sha: r.sha };
    const b = await this.getRaw(path);
    return b ? { text: await b.text(), sha: r.sha } : null;
  }
  async getJSON<T = any>(path: string) {
    const f = await this.getText(path);
    return f ? { data: JSON.parse(f.text) as T, sha: f.sha } : null;
  }
  async getRaw(path: string) {
    const r = await this.row(path);
    if (!r) return null;
    if (!r.blob) return new Blob([r.body || ""], { type: TEXT.test(path) && /\.json$/i.test(path) ? "application/json" : "text/plain" });
    const { data, error } = await this.db.storage.from(STUDIO_BUCKET).download(`${this.studio}/${path}`);
    if (error) return null;
    return data;
  }
  private async write(path: string, base64: string) {
    const sha = await gitBlobSha(base64), bytes = b64Bytes(base64);
    if (TEXT.test(path)) {
      const { error } = await this.db.from("studio_files").upsert({ studio: this.studio, path, body: new TextDecoder().decode(bytes), blob: false, sha, size: bytes.length, updated_at: new Date().toISOString() });
      if (error) this.fail(error, "save " + path);
    } else {
      const { error: se } = await this.db.storage.from(STUDIO_BUCKET).upload(`${this.studio}/${path}`, new Blob([bytes], { type: mime(path) }), { upsert: true, contentType: mime(path) });
      if (se) this.fail(se, "upload " + path);
      const { error } = await this.db.from("studio_files").upsert({ studio: this.studio, path, body: null, blob: true, sha, size: bytes.length, updated_at: new Date().toISOString() });
      if (error) this.fail(error, "save " + path);
    }
    return sha;
  }
  async putFile(path: string, base64: string, _message: string, sha?: string | null) {
    if (sha) { const cur = await this.row(path); if (cur && cur.sha !== sha) throw new RepoError("The file changed since it was loaded. Try again.", 409); }
    return this.write(path, base64);
  }
  async pushFiles(files: FileIn[], _message: string, remove: string[] = []) {
    for (const f of files) await this.write(f.path, f.base64);
    if (remove.length) {
      const blobs = remove.filter((p) => !TEXT.test(p)).map((p) => `${this.studio}/${p}`);
      if (blobs.length) await this.db.storage.from(STUDIO_BUCKET).remove(blobs);
      const { error } = await this.db.from("studio_files").delete().eq("studio", this.studio).in("path", remove);
      if (error) this.fail(error, "delete files");
    }
  }
  async list(prefix: string) {
    const out: string[] = [];
    for (let from = 0; ; from += 1000) {
      let q = this.db.from("studio_files").select("path").eq("studio", this.studio).order("path").range(from, from + 999);
      if (prefix) q = q.like("path", prefix.replace(/[%_\\]/g, "\\$&") + "%");
      const { data, error } = await q;
      if (error) this.fail(error, "list files");
      out.push(...(data || []).map((r: any) => r.path));
      if (!data || data.length < 1000) break;
    }
    return out;
  }
  async lastChange(path: string) { return (await this.row(path))?.updated_at || null; }
}

/** studio.config.json next to the app: present only on a hosted Studio. */
export async function loadHostConfig(): Promise<StudioHostCfg | null> {
  try {
    const r = await fetch("studio.config.json", { cache: "no-store" });
    if (!r.ok) return null;
    const j = await r.json();
    if (!/^[a-z0-9-]+$/.test(j?.studio || "")) return null;
    if (j.kind === "cloudflare") return /^https:\/\//.test(j.api) ? { ...j, api: String(j.api).replace(/\/+$/, "") } : null;
    return j?.kind === "supabase" && /^https:\/\//.test(j.url) && j.key ? { ...j, url: cleanUrl(j.url) } : null;
  } catch { return null; }
}

/** Is this email a member of the Studio, and how? */
export async function studioRole(cfg: SbHostCfg): Promise<string | null> {
  const { data, error } = await sbClient(cfg).rpc("studio_role", { s: cfg.studio });
  if (error) return null;
  return (data as string) || null;
}

/** A random secret kept on this device for this Studio: it locks the device's saved tokens (the vault). */
export function deviceSecret(studio: string): string {
  const k = `site-studio:device-secret:${studio}`;
  try {
    let s = localStorage.getItem(k);
    if (!s) { s = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join(""); localStorage.setItem(k, s); }
    return s;
  } catch { return "device-" + studio; }
}
