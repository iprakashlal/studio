// "Host outside GitHub": a site's content, drafts and photos live in the owner's Supabase project, and
// the site itself is served by Cloudflare or Netlify. This file is shared by the Studio and the site CMS.
//
//   site_content  one row per site: the live content (public read), info (cms/site.json), version
//   site_drafts   saved-but-not-published edits (owners only)
//   site_admins   who may edit which site (email)
//   storage       bucket "site-assets", objects at <site>/<path>, public read, owners write
//
// SupabaseRepo implements the Repo interface over those, so the CMS editor, publishing and the Studio's
// live-site sync work the same way they do with GitHub.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { FileIn, Repo } from "./repo";
import { RepoError } from "./repo";
import type { RepoCfg } from "./crypto";

/** Where a site's data lives. `key` is the project's public (anon) key: safe in the browser, guarded by RLS. */
export type SbCfg = { url: string; key: string; site: string };
/** A site's content, photos and editors on the Studio's Cloudflare database (its Worker address and the site ID). */
export type CfSiteCfg = { api: string; site: string };
/** Hosted outside GitHub: Netlify or Cloudflare serves the pages (`kind`; on Cloudflare siteId is the Worker's
 *  name in `account`); the content lives in Supabase (sb) or the Cloudflare database (cf). */
export type HostCfg = { kind: "netlify" | "cloudflare"; siteId: string; siteName: string; url: string; account?: string; domain?: string; sb?: SbCfg; cf?: CfSiteCfg;
  /** A domain added to Cloudflare that's waiting for its nameservers to be switched; connected by itself once active. */
  domainSetup?: { name: string; zoneId: string; ns: string[]; registrar?: { name: string; url: string; how: string }; at: string } };

export const BUCKET = "site-assets";
export const cleanUrl = (u: string) => String(u || "").trim().replace(/\/+$/, "");
export const sbUrlOk = (u: string) => /^https:\/\/[a-z0-9-]+\.supabase\.(co|in|net)$/i.test(cleanUrl(u)) || /^https:\/\/[^\s/]+$/i.test(cleanUrl(u));
export const siteIdOk = (s: string) => /^[a-z0-9][a-z0-9-]{1,48}$/.test(s);
/** Where a site on the Cloudflare database serves its photos from (public). */
export const cfAssetBase = (c: CfSiteCfg) => `${c.api.replace(/\/+$/, "")}/p/${encodeURIComponent(c.site)}/`;
export const assetBase = (sb: SbCfg) => `${cleanUrl(sb.url)}/storage/v1/object/public/${BUCKET}/${encodeURIComponent(sb.site)}/`;

const clients = new Map<string, SupabaseClient>();
/** One client per project; the sign-in is kept on this device under its own key. */
export function sbClient(sb: Pick<SbCfg, "url" | "key">): SupabaseClient {
  const k = cleanUrl(sb.url) + "|" + sb.key;
  if (!clients.has(k)) clients.set(k, createClient(cleanUrl(sb.url), sb.key, { auth: { persistSession: true, storageKey: `site-db:${cleanUrl(sb.url)}`, detectSessionInUrl: false } }));
  return clients.get(k)!;
}

/** The SQL the owner runs once in Supabase → SQL Editor. Safe to run again. */
const ENQ_SQL = `-- Enquiries from the business template's contact form: anyone can send one, only the site's editors read them.
create table if not exists public.site_enquiries (
  id bigint generated always as identity primary key,
  site text not null,
  data jsonb not null default '{}'::jsonb,
  page text not null default '',
  status text not null default 'new',
  created_at timestamptz not null default now()
);
alter table public.site_enquiries enable row level security;
create index if not exists site_enquiries_site on public.site_enquiries (site, created_at desc);
drop policy if exists "anyone sends an enquiry" on public.site_enquiries;
create policy "anyone sends an enquiry" on public.site_enquiries for insert to anon, authenticated with check (status = 'new' and length(data::text) < 20000);
drop policy if exists "owners read enquiries" on public.site_enquiries;
create policy "owners read enquiries" on public.site_enquiries for select to authenticated using (public.is_site_admin(site));
drop policy if exists "owners update enquiries" on public.site_enquiries;
create policy "owners update enquiries" on public.site_enquiries for update to authenticated using (public.is_site_admin(site)) with check (public.is_site_admin(site));
drop policy if exists "owners delete enquiries" on public.site_enquiries;
create policy "owners delete enquiries" on public.site_enquiries for delete to authenticated using (public.is_site_admin(site));
`;

export function setupSql(site: string, email: string): string {
  const s = site.replace(/'/g, "''"), e = email.trim().toLowerCase().replace(/'/g, "''");
  return `-- Site Studio: content, drafts and photos for websites hosted outside GitHub.
-- Run it in Supabase → SQL Editor. Running it again is safe.
create table if not exists public.site_content (
  site text primary key,
  content jsonb not null default '{}'::jsonb,
  info jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);
create table if not exists public.site_drafts (
  site text primary key references public.site_content(site) on delete cascade,
  content jsonb not null,
  saved_at timestamptz not null default now()
);
create table if not exists public.site_admins (
  site text not null,
  email text not null,
  primary key (site, email)
);
alter table public.site_content enable row level security;
alter table public.site_drafts enable row level security;
alter table public.site_admins enable row level security;

create or replace function public.is_site_admin(s text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.site_admins a where a.site = s and lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

drop policy if exists "anyone reads live content" on public.site_content;
create policy "anyone reads live content" on public.site_content for select using (true);
drop policy if exists "owners add content" on public.site_content;
create policy "owners add content" on public.site_content for insert to authenticated with check (public.is_site_admin(site));
drop policy if exists "owners change content" on public.site_content;
create policy "owners change content" on public.site_content for update to authenticated using (public.is_site_admin(site)) with check (public.is_site_admin(site));
drop policy if exists "owners manage drafts" on public.site_drafts;
create policy "owners manage drafts" on public.site_drafts for all to authenticated using (public.is_site_admin(site)) with check (public.is_site_admin(site));
drop policy if exists "owners see their sites" on public.site_admins;
create policy "owners see their sites" on public.site_admins for select to authenticated using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

insert into storage.buckets (id, name, public) values ('${BUCKET}', '${BUCKET}', true) on conflict (id) do update set public = true;
-- Uploads replace files in place (upsert), which needs editors to be able to see the bucket's files too.
drop policy if exists "owners see site photos" on storage.objects;
create policy "owners see site photos" on storage.objects for select to authenticated using (bucket_id = '${BUCKET}' and public.is_site_admin(split_part(name, '/', 1)));
drop policy if exists "owners upload site photos" on storage.objects;
create policy "owners upload site photos" on storage.objects for insert to authenticated with check (bucket_id = '${BUCKET}' and public.is_site_admin(split_part(name, '/', 1)));
drop policy if exists "owners replace site photos" on storage.objects;
create policy "owners replace site photos" on storage.objects for update to authenticated using (bucket_id = '${BUCKET}' and public.is_site_admin(split_part(name, '/', 1)));
drop policy if exists "owners delete site photos" on storage.objects;
create policy "owners delete site photos" on storage.objects for delete to authenticated using (bucket_id = '${BUCKET}' and public.is_site_admin(split_part(name, '/', 1)));

-- Enquiries from the business template's contact form: anyone can send one, only the site's editors read them.
create table if not exists public.site_enquiries (
  id bigint generated always as identity primary key,
  site text not null,
  data jsonb not null default '{}'::jsonb,
  page text not null default '',
  status text not null default 'new',
  created_at timestamptz not null default now()
);
alter table public.site_enquiries enable row level security;
create index if not exists site_enquiries_site on public.site_enquiries (site, created_at desc);
drop policy if exists "anyone sends an enquiry" on public.site_enquiries;
create policy "anyone sends an enquiry" on public.site_enquiries for insert to anon, authenticated with check (status = 'new' and length(data::text) < 20000);
drop policy if exists "owners read enquiries" on public.site_enquiries;
create policy "owners read enquiries" on public.site_enquiries for select to authenticated using (public.is_site_admin(site));
drop policy if exists "owners update enquiries" on public.site_enquiries;
create policy "owners update enquiries" on public.site_enquiries for update to authenticated using (public.is_site_admin(site)) with check (public.is_site_admin(site));
drop policy if exists "owners delete enquiries" on public.site_enquiries;
create policy "owners delete enquiries" on public.site_enquiries for delete to authenticated using (public.is_site_admin(site));

-- Who can edit this site. Add more rows for more editors.
insert into public.site_admins (site, email) values ('${s}', '${e}') on conflict do nothing;
`;
}

/** Only what the business template's enquiry form needs, for sites on GitHub Pages that use Supabase just for enquiries. */
export function enquiriesSql(site: string, email: string): string {
  const s = site.replace(/'/g, "''"), e = email.trim().toLowerCase().replace(/'/g, "''");
  return `-- Site Studio: enquiries from your website's contact form. Run it in Supabase → SQL Editor. Running it again is safe.
create table if not exists public.site_admins (
  site text not null,
  email text not null,
  primary key (site, email)
);
alter table public.site_admins enable row level security;
create or replace function public.is_site_admin(s text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.site_admins a where a.site = s and lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;
drop policy if exists "owners see their sites" on public.site_admins;
create policy "owners see their sites" on public.site_admins for select to authenticated using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

${ENQ_SQL}
-- Who can read enquiries. Add more rows for more people.
insert into public.site_admins (site, email) values ('${s}', '${e}') on conflict do nothing;
`;
}

const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", svg: "image/svg+xml", avif: "image/avif", ico: "image/x-icon", pdf: "application/pdf", mp4: "video/mp4" };
const mimeOf = (p: string) => MIME[(p.split(".").pop() || "").toLowerCase()] || "application/octet-stream";
const b64Bytes = (b: string) => Uint8Array.from(atob(String(b).replace(/\s/g, "")), (c) => c.charCodeAt(0));

function sbError(e: any, what: string): RepoError {
  const msg = String(e?.message || e || "");
  if (/relation .* does not exist|schema cache|site_content/i.test(msg) && /exist|find/i.test(msg)) return new RepoError("Supabase isn't set up for websites yet: run the setup SQL from the Studio in Supabase → SQL Editor.", 404);
  if (/row-level security|permission denied|not allowed|Unauthorized|JWT/i.test(msg) || e?.status === 401 || e?.status === 403 || e?.statusCode === "403")
    return new RepoError(`Supabase refused to ${what}. Sign in with an email listed in site_admins for this site.`, 403);
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return new RepoError("Couldn't reach Supabase. Check the connection and the project URL.", 0);
  return new RepoError(`Supabase: ${msg || what}`, e?.status || 500);
}

export class SupabaseRepo implements Repo {
  readonly demo = false;
  readonly cfg: RepoCfg;
  readonly sb: SbCfg;
  constructor(sb: SbCfg) {
    this.sb = { ...sb, url: cleanUrl(sb.url) };
    this.cfg = { owner: "supabase", repo: sb.site, branch: "main" } as RepoCfg;
  }
  get db() { return sbClient(this.sb); }

  async check() {
    const { error } = await this.db.from("site_content").select("site").eq("site", this.sb.site).limit(1);
    if (error) throw sbError(error, "read the site");
  }
  private async row() {
    const { data, error } = await this.db.from("site_content").select("content, info, version, updated_at").eq("site", this.sb.site).maybeSingle();
    if (error) throw sbError(error, "read the site");
    return data as { content: any; info: any; version: number; updated_at: string } | null;
  }
  async getText(path: string) {
    if (path === "content.json") {
      const r = await this.row();
      return r ? { text: JSON.stringify(r.content, null, 2), sha: "v" + r.version } : null;
    }
    if (path === "cms/site.json") {
      const r = await this.row();
      return r ? { text: JSON.stringify(r.info || {}, null, 2), sha: "i" + r.version } : null;
    }
    if (path === "cms/draft.json") {
      const { data, error } = await this.db.from("site_drafts").select("content, saved_at").eq("site", this.sb.site).maybeSingle();
      if (error) throw sbError(error, "read the draft");
      return data ? { text: JSON.stringify({ savedAt: data.saved_at, content: data.content }), sha: "d" + data.saved_at } : null;
    }
    if (path.startsWith("assets/")) {
      const b = await this.getRaw(path);
      return b ? { text: await b.text(), sha: "" } : null;
    }
    return null;
  }
  async getJSON<T = any>(path: string) {
    const f = await this.getText(path);
    return f ? { data: JSON.parse(f.text) as T, sha: f.sha } : null;
  }
  async getRaw(path: string) {
    const r = await fetch(assetBase(this.sb) + path.split("/").map(encodeURIComponent).join("/"), { cache: "no-store" }).catch(() => null);
    return r && r.ok ? r.blob() : null;
  }
  /** content.json uses the version as its sha: a stale sha means someone published since, like GitHub's 409. */
  async putFile(path: string, base64: string, _message: string, sha?: string | null): Promise<string> {
    if (path === "content.json" || path === "cms/site.json") {
      const val = JSON.parse(new TextDecoder().decode(b64Bytes(base64)));
      const col = path === "content.json" ? "content" : "info";
      const cur = await this.row();
      if (!cur) {
        const { error } = await this.db.from("site_content").insert({ site: this.sb.site, [col]: val, version: 1 });
        if (error) throw sbError(error, "save the site");
        return path === "content.json" ? "v1" : "i1";
      }
      // Site info isn't content: changing it doesn't change the content's version (its "sha").
      if (col === "info") {
        const { error } = await this.db.from("site_content").update({ info: val }).eq("site", this.sb.site);
        if (error) throw sbError(error, "save the site");
        return "i" + cur.version;
      }
      const want = sha && /^[vi]\d+$/.test(sha) ? Number(sha.slice(1)) : cur.version;
      if (path === "content.json" && sha && want !== cur.version) throw new RepoError("changed", 409);
      const { data, error } = await this.db.from("site_content").update({ [col]: val, version: cur.version + 1, updated_at: new Date().toISOString() })
        .eq("site", this.sb.site).eq("version", cur.version).select("version");
      if (error) throw sbError(error, "save the site");
      if (!data?.length) throw new RepoError("changed", 409);
      return (path === "content.json" ? "v" : "i") + (cur.version + 1);
    }
    if (path === "cms/draft.json") {
      const val = JSON.parse(new TextDecoder().decode(b64Bytes(base64)));
      const savedAt = val.savedAt || new Date().toISOString();
      if (!(await this.row())) throw new RepoError("Publish the site once before saving drafts.", 404);
      const { error } = await this.db.from("site_drafts").upsert({ site: this.sb.site, content: val.content ?? val, saved_at: savedAt });
      if (error) throw sbError(error, "save the draft");
      return "d" + savedAt;
    }
    if (path.startsWith("assets/")) {
      const { error } = await this.db.storage.from(BUCKET).upload(`${this.sb.site}/${path}`, new Blob([b64Bytes(base64)], { type: mimeOf(path) }), { upsert: true, contentType: mimeOf(path), cacheControl: "31536000" });
      if (error) throw sbError(error, "upload the photo");
      return "a" + Date.now();
    }
    // Pages, scripts and the CMS itself are hosted by Cloudflare or Netlify and change only when the Studio publishes.
    return "";
  }
  async pushFiles(files: FileIn[], message: string, remove: string[] = []) {
    // Photos first, so the content never points at a photo that isn't there yet.
    const order = [...files].sort((a, b) => Number(b.path.startsWith("assets/")) - Number(a.path.startsWith("assets/")));
    for (const f of order) {
      const cur = f.path === "content.json" ? (await this.getText("content.json"))?.sha : undefined;
      await this.putFile(f.path, f.base64, message, cur);
    }
    for (const p of remove) {
      if (p === "cms/draft.json") {
        const { error } = await this.db.from("site_drafts").delete().eq("site", this.sb.site);
        if (error) throw sbError(error, "delete the draft");
      } else if (p.startsWith("assets/")) await this.db.storage.from(BUCKET).remove([`${this.sb.site}/${p}`]);
    }
  }
  async list(prefix: string): Promise<string[]> {
    if (!prefix.startsWith("assets")) return [];
    const out: string[] = [];
    const walk = async (dir: string, depth: number) => {
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await this.db.storage.from(BUCKET).list(`${this.sb.site}/${dir}`.replace(/\/$/, ""), { limit: 1000, offset });
        if (error) throw sbError(error, "list photos");
        for (const o of data || []) {
          if (o.id) out.push(`${dir}${o.name}`);
          else if (depth < 4) await walk(`${dir}${o.name}/`, depth + 1);
        }
        if (!data || data.length < 1000) break;
      }
    };
    await walk(prefix.endsWith("/") ? prefix : prefix + "/", 0);
    return out;
  }
  async lastChange(path: string) {
    if (path !== "content.json") return null;
    return (await this.row())?.updated_at || null;
  }
}

/** Email sign-in with a 6-digit code. */
export async function sendCode(sb: Pick<SbCfg, "url" | "key">, email: string) {
  const { error } = await sbClient(sb).auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
  if (error) throw sbError(error, "send the code");
}
export async function verifyCode(sb: Pick<SbCfg, "url" | "key">, email: string, code: string) {
  const { error } = await sbClient(sb).auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
  if (error) throw new RepoError(/expired|invalid/i.test(error.message) ? "That code is wrong or has expired. Send a new one." : error.message, 401);
}
export async function signedInEmail(sb: Pick<SbCfg, "url" | "key">): Promise<string | null> {
  const { data } = await sbClient(sb).auth.getSession();
  return data.session?.user?.email || null;
}
export async function isAdmin(sb: SbCfg): Promise<boolean> {
  const { data, error } = await sbClient(sb).from("site_admins").select("site").eq("site", sb.site).limit(1);
  if (error) throw sbError(error, "check your access");
  return !!data?.length;
}
