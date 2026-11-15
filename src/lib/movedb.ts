// Moving a hosted site's database from Supabase to the Studio's database on Cloudflare: content, site info, the
// unpublished draft, photos, editors and enquiries. Supabase is only read, never changed, so the move can be run
// again and the old project deleted later by the owner.
import { SupabaseRepo, type CfSiteCfg, type SbCfg } from "./supa";
import { CfRepo, cfCall } from "./cfdb";
import { bytesB64 } from "./repo";
import { blobToBytes } from "./util";
import { SupaMgmt, sbMgmtVault } from "./supamgmt";
import type { Relay } from "./relay";
import type { Cloudflare } from "./cloudflare";

const utf8B64 = (s: string) => bytesB64(new TextEncoder().encode(s));
const q = (s: string) => "'" + String(s).replace(/'/g, "''") + "'";

/** The site's editors in Supabase, read with the Supabase access token saved on this device (null when there's none). */
export async function sbEditors(sb: SbCfg, studioToken: string, relay: Relay | null): Promise<string[] | null> {
  const v = await sbMgmtVault.load(studioToken).catch(() => null);
  const ref = /^https:\/\/([a-z0-9]+)\.supabase\.(co|in|net)$/i.exec(sb.url.replace(/\/+$/, ""))?.[1];
  if (!v?.token || !relay || !ref) return null;
  try {
    const rows = await new SupaMgmt(relay, v.token).sql(ref, `select email from public.site_admins where site = ${q(sb.site)} order by email`);
    return Array.isArray(rows) ? rows.map((r: any) => String(r.email || "").trim().toLowerCase()).filter(Boolean) : null;
  } catch { return null; }
}

export type MoveResult = { files: string[]; photos: number; enquiries: number; editors: string[]; missing: string[] };

/**
 * Copies the site from Supabase into the Cloudflare database. Needs a Supabase sign-in that can edit the site (for
 * the draft and the enquiries) and a Cloudflare database sign-in as its owner (to write and add editors).
 * Enquiries are copied only while the Cloudflare side has none for the site, so running it again doesn't double them.
 */
export async function moveSbToCf(o: { sb: SbCfg; cf: CfSiteCfg; editors: string[]; d1?: { cf: Cloudflare; account: string; databaseId: string } | null; step: (s: string) => void }): Promise<MoveResult> {
  const src = new SupabaseRepo(o.sb), dst = new CfRepo(o.cf.api, "site:" + o.cf.site);
  await src.check(); await dst.check();
  const res: MoveResult = { files: [], photos: 0, enquiries: 0, editors: [], missing: [] };

  // 1. Photos first, so the content never points at one that isn't there yet.
  o.step("Finding the photos in Supabase");
  const photos = await src.list("assets/");
  const have = new Set(await dst.list("assets/").catch(() => [] as string[]));
  let n = 0;
  for (const p of photos) {
    o.step(`Copying photos (${++n} of ${photos.length})`);
    if (have.has(p)) { res.photos++; continue; }
    const b = await src.getRaw(p);
    if (!b) { res.missing.push(p); continue; }
    await dst.putFile(p, bytesB64(await blobToBytes(b)), "Move photo");
    res.photos++;
  }

  // 2. Content, site info and the draft (unpublished edits from the site's own CMS).
  for (const p of ["content.json", "cms/site.json", "cms/draft.json"]) {
    o.step(`Copying ${p === "content.json" ? "the content" : p === "cms/site.json" ? "the site's settings" : "unpublished edits"}`);
    const t = await src.getText(p).catch((e) => { if (p === "cms/draft.json") return null; throw e; });
    if (!t) continue;
    await dst.putFile(p, utf8B64(t.text), "Move from Supabase");
    res.files.push(p);
  }
  if (!res.files.includes("content.json")) throw new Error("The site has no content in Supabase yet: publish it there once, or publish this project straight to Cloudflare instead.");

  // 3. Editors (the signed-in owner is already one).
  const scope = encodeURIComponent("site:" + o.cf.site);
  for (const e of [...new Set(o.editors.map((x) => x.trim().toLowerCase()).filter((x) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)))]) {
    o.step("Adding the site's editors");
    await cfCall(o.cf.api, `/m/add?scope=${scope}`, { method: "POST", body: JSON.stringify({ email: e, role: "owner" }) });
    res.editors.push(e);
  }

  // 4. Enquiries (business sites), through Cloudflare's D1 API.
  o.step("Copying enquiries");
  const { data: rows, error } = await src.db.from("site_enquiries").select("data, page, status, created_at").eq("site", o.sb.site).order("created_at");
  if (!error && rows?.length) {
    if (!o.d1) throw new Error("This site has enquiries in Supabase: connect Cloudflare on this device so they can be copied too.");
    const cur = await o.d1.cf.d1Query(o.d1.account, o.d1.databaseId, "select count(*) as n from enquiries where site = ?", [o.cf.site]);
    const already = Number(cur?.[0]?.results?.[0]?.n || 0);
    if (!already) {
      for (let i = 0; i < rows.length; i += 18) {
        const part = rows.slice(i, i + 18);
        await o.d1.cf.d1Query(o.d1.account, o.d1.databaseId,
          "insert into enquiries (site, data, page, status, created_at) values " + part.map(() => "(?, ?, ?, ?, ?)").join(", "),
          part.flatMap((r: any) => [o.cf.site, JSON.stringify(r.data || {}), String(r.page || ""), String(r.status || "new"), new Date(r.created_at).toISOString()]));
        o.step(`Copying enquiries (${Math.min(i + 18, rows.length)} of ${rows.length})`);
      }
      res.enquiries = rows.length;
    }
  }
  return res;
}

/**
 * Copies a site from one Cloudflare database to another (for example from an old account's database into this
 * Studio's): every file of the site (content, settings, draft, photos, warranty data), its editors and its enquiries.
 * The old database is only read, never changed. Needs this browser signed in to both (as an owner of the site on the
 * old one) and the new database's D1 access, for the editors and enquiries.
 */
export async function moveCfToCf(o: { from: CfSiteCfg; to: CfSiteCfg; d1: { cf: Cloudflare; account: string; databaseId: string }; addMembers: (list: { email: string; role: "owner" | "member" | "partner" }[]) => Promise<void>; step: (s: string) => void }): Promise<MoveResult> {
  const src = new CfRepo(o.from.api, "site:" + o.from.site);
  const res: MoveResult = { files: [], photos: 0, enquiries: 0, editors: [], missing: [] };
  await src.check();
  // 1. Editors first: the new scope needs its owners before anyone can write to it from the site.
  o.step("Reading the site's editors");
  const members = await cfCall<{ email: string; role: string }[]>(o.from.api, `/m?scope=${encodeURIComponent("site:" + o.from.site)}`).catch(() => []);
  const list = (members || []).filter((m) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.email)).map((m) => ({ email: m.email.toLowerCase(), role: (["owner", "member", "partner"].includes(m.role) ? m.role : "member") as "owner" | "member" | "partner" }));
  if (list.length) { o.step("Adding the site's editors"); await o.addMembers(list); res.editors = list.map((m) => m.email); }
  const dst = new CfRepo(o.to.api, "site:" + o.to.site);
  await dst.check();
  // 2. Files: photos and other assets first, the content last (so it never points at a photo that isn't there).
  o.step("Finding the site's files");
  const all = await src.list("");
  const order = [...all.filter((p) => p !== "content.json" && p !== "cms/site.json"), ...all.filter((p) => p === "cms/site.json"), ...all.filter((p) => p === "content.json")];
  if (!all.includes("content.json")) throw new Error("The site has no content in its database yet.");
  let n = 0;
  for (const p of order) {
    o.step(`Copying the site (${++n} of ${order.length})`);
    const b = await src.getRaw(p);
    if (!b) { res.missing.push(p); continue; }
    await dst.putFile(p, bytesB64(await blobToBytes(b)), "Move from another database");
    if (p.startsWith("assets/")) res.photos++; else res.files.push(p);
  }
  // 3. Enquiries, only while the new database has none for the site (so running it again doesn't double them).
  o.step("Copying enquiries");
  const rows = await cfCall<any[]>(o.from.api, `/e/list?scope=${encodeURIComponent("site:" + o.from.site)}`).catch(() => [] as any[]);
  if (rows?.length) {
    const cur = await o.d1.cf.d1Query(o.d1.account, o.d1.databaseId, "select count(*) as n from enquiries where site = ?", [o.to.site]);
    if (!Number(cur?.[0]?.results?.[0]?.n || 0)) {
      const asc = [...rows].reverse();
      for (let i = 0; i < asc.length; i += 18) {
        const part = asc.slice(i, i + 18);
        await o.d1.cf.d1Query(o.d1.account, o.d1.databaseId, "insert into enquiries (site, data, page, status, created_at) values " + part.map(() => "(?, ?, ?, ?, ?)").join(", "),
          part.flatMap((r: any) => [o.to.site, JSON.stringify(r.data || {}), String(r.page || ""), String(r.status || "new"), String(r.created_at || new Date().toISOString())]));
      }
      res.enquiries = rows.length;
    }
  }
  return res;
}
