// "Delete & remove": takes one project's live site off every service it uses (its Workers and functions, its data,
// its GitHub repositories), or a client Studio off everything it runs on. Each step is tried on its own, so one
// refusal doesn't stop the rest; the result lists what was removed and what is left to delete by hand.
import { cfAccountVault, cfDeployInfo, cfTokenFor, dbCloudflare, dbGitHub, cfCall, siteEnquiries } from "./cfdb";
import { Cloudflare } from "./cloudflare";
import { ghPublish } from "./ghpublish";
import { hostRepo, netlifyToken } from "./hosting";
import { Netlify } from "./netlify";
import { backendOf } from "./backend";
import { hostOf, remoteRepo, type PartnerRec } from "./partners";
import { helperOk, relayVault } from "./relay";
import type { Repo } from "./repo";
import type { ProjectMeta } from "./studio";

export type TearResult = { done: string[]; failed: string[]; /** Things only the user can do, said plainly. */ notes?: string[] };
export type TearCtx = { studioToken: string; /** The Studio's own database, when it has one (its kept tokens reach Cloudflare and GitHub from any device). */ db?: { api: string; studio: string } | null; step: (s: string) => void };
type Item = { label: string; run: () => Promise<void> };

/** What "Delete & remove" will take away for this project, in plain words (shown before anything is deleted). */
export function projectPlan(p: ProjectMeta): string[] {
  const out: string[] = [], h = p.host;
  if (h) out.push(`The live site on ${h.kind === "cloudflare" ? "Cloudflare" : "Netlify"} (${h.siteName || h.siteId})${h.domain ? ` and its link to ${h.domain}` : ""}`);
  if (h?.cf) out.push(`Its content, photos, editors' list and enquiries in the database (${h.cf.api.replace(/^https:\/\//, "")}, site “${h.cf.site}”)`);
  if (h?.sb) out.push(`Its content and photos in Supabase (site “${h.sb.site}”)`);
  if (p.worker) out.push(`The shop's helper Worker on Cloudflare (${p.worker.name})${p.worker.dataRepo ? ` and its private data repository ${p.worker.dataRepo}` : ""}`);
  if (p.inbox) out.push(`The enquiry inbox helper on ${p.inbox.kind === "cloudflare" ? "Cloudflare" : "Netlify"}${p.inbox.repo ? ` and its private repository ${p.inbox.repo}` : ""}`);
  if (p.publish) out.push(`The GitHub repository ${p.publish.owner}/${p.publish.repo}, with the site's code and its GitHub Pages address`);
  return out;
}

async function tools(ctx: TearCtx) {
  const [v, relay, nfTok, info] = await Promise.all([cfAccountVault.load(ctx.studioToken), relayVault.load(ctx.studioToken), netlifyToken.load(ctx.studioToken), ctx.db ? cfDeployInfo(ctx.db.api).catch(() => null) : Promise.resolve(null)]);
  /** A Cloudflare client for the account: this device's token through the helper, else the database's kept token. */
  const cf = (account?: string): Cloudflare => {
    const token = cfTokenFor(v, account);
    if (token && helperOk(relay)) return new Cloudflare(relay!, token);
    if (ctx.db && info?.del) return dbCloudflare(ctx.db.api, "studio:" + ctx.db.studio);
    throw new Error(ctx.db && info && !info.del ? "update your Studio's database first (Settings → Sites and hosting accounts → Update the database), or use a device that has the Cloudflare token" : "no Cloudflare token for that account on this device");
  };
  /** Deletes a Worker: with this device's token, else through a database that keeps the account's token and has
   *  the Worker registered (the site's own scope first, then the Studio's). */
  const del = async (account: string | undefined, name: string, extra?: { api: string; scope: string } | null) => {
    const token = cfTokenFor(v, account);
    if (token && helperOk(relay)) return void (await new Cloudflare(relay!, token).deleteScript(account || "", name));
    const ways: Cloudflare[] = [];
    if (extra && (await cfDeployInfo(extra.api).catch(() => null))?.del) ways.push(dbCloudflare(extra.api, extra.scope));
    if (ctx.db && info?.del) ways.push(dbCloudflare(ctx.db.api, "studio:" + ctx.db.studio));
    if (!ways.length) { cf(account); return; } // says why not
    let last: any = null;
    for (const w of ways) { try { await w.deleteScript(account || "", name); return; } catch (e: any) { last = e; if (gone(e)) throw e; } }
    throw last;
  };
  const nf = (): Netlify => { if (!nfTok) throw new Error("no Netlify token on this device (Settings → Hosting accounts)"); return new Netlify(nfTok.token); };
  /** Deletes a GitHub repository: with this device's token, else through the database's kept token. */
  const repo = async (full: string) => {
    const token = ghPublish.token(ctx.studioToken);
    const viaDb = ctx.db && info?.gh ? dbGitHub(ctx.db.api, "studio:" + ctx.db.studio) : null;
    let r: Response | null = null;
    if (token) r = await fetch("https://api.github.com/repos/" + full, { method: "DELETE", headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" } });
    if ((!r || r.status === 403 || r.status === 401) && viaDb) r = await viaDb(full.toLowerCase(), "", { method: "DELETE" }, false);
    if (!r) throw new Error("no GitHub token on this device");
    if (r.status === 204 || r.status === 404) return;
    if (r.status === 403) throw new Error(`the GitHub token isn't allowed to delete repositories. Delete it on GitHub: github.com/${full}/settings (Danger Zone), or add “Administration: Read and write” to the token (classic tokens: delete_repo)`);
    throw new Error(`GitHub answered ${r.status}`);
  };
  return { cf, del, nf, repo };
}
/** Every file of a site's (or Studio's) data. */
async function wipe(r: Repo) { const all = await r.list(""); for (let i = 0; i < all.length; i += 100) await r.pushFiles([], "Delete & remove", all.slice(i, i + 100)); }
const gone = (e: any) => e?.status === 404 || /not found|10007|10090/i.test(e?.message || "");
async function runAll(items: Item[], step: (s: string) => void): Promise<TearResult> {
  const res: TearResult = { done: [], failed: [] };
  for (const it of items) {
    step(it.label);
    try { await it.run(); res.done.push(it.label); }
    catch (e: any) { if (gone(e)) res.done.push(it.label + " (was already gone)"); else res.failed.push(`${it.label}: ${e?.message || "couldn't be removed"}`); }
  }
  return res;
}

/** Removes the project's live site everywhere. The project itself stays in the Studio (as a draft). */
export async function teardownProject(p: ProjectMeta, ctx: TearCtx): Promise<TearResult> {
  const t = await tools(ctx), h = p.host, items: Item[] = [], own = h?.cf ? { api: h.cf.api, scope: "site:" + h.cf.site } : null;
  // Data first, while the sign-ins that reach it still work.
  if (h?.cf) {
    items.push({ label: "Enquiries in the database", run: async () => { const q = await siteEnquiries(h.cf!, h.account); const list = await q.list().catch(() => []); for (const e of list as any[]) await q.remove(e.id); } });
    items.push({ label: "Content and photos in the database", run: () => wipe(hostRepo(h)) });
  }
  if (h?.sb) items.push({ label: "Content and photos in Supabase", run: () => wipe(hostRepo(h)) });
  if (h) items.push(h.kind === "cloudflare"
    ? { label: `The site's Worker on Cloudflare (${h.siteId})`, run: () => t.del(h.account, h.siteId, own) }
    : { label: `The site on Netlify (${h.siteName || h.siteId})`, run: () => t.nf().deleteSite(h.siteId) });
  if (p.worker) {
    items.push({ label: `The shop's helper Worker (${p.worker.name})`, run: () => t.del(p.worker!.account, p.worker!.name, own) });
    if (/^[\w.-]+\/[\w.-]+$/.test(p.worker.dataRepo || "")) items.push({ label: `The shop's data repository ${p.worker.dataRepo}`, run: () => t.repo(p.worker!.dataRepo) });
  }
  if (p.inbox) {
    items.push(p.inbox.kind === "cloudflare"
      ? { label: "The enquiry inbox helper on Cloudflare", run: () => t.del(p.inbox!.account, p.inbox!.siteId, own) }
      : { label: "The enquiry inbox helper on Netlify", run: () => t.nf().deleteSite(p.inbox!.siteId) });
    if (/^[\w.-]+\/[\w.-]+$/.test(p.inbox.repo || "")) items.push({ label: `The enquiry inbox repository ${p.inbox.repo}`, run: () => t.repo(p.inbox!.repo) });
  }
  if (p.publish) items.push({ label: `The GitHub repository ${p.publish.owner}/${p.publish.repo}`, run: () => t.repo(`${p.publish!.owner}/${p.publish!.repo}`) });
  return runAll(items, ctx.step);
}

/** What removing a client Studio takes away. */
export function partnerPlan(p: PartnerRec): string[] {
  const where = p.backend === "cloudflare" ? `the database (${(p.api || "").replace(/^https:\/\//, "")}, Studio “${p.studio}”)` : `Supabase (Studio “${p.studio}”)`;
  return [
    p.siteId ? `Their Studio's app on ${p.pages === "cloudflare" ? "Cloudflare" : "Netlify"} (${p.url.replace(/^https:\/\//, "")})` : `Their Studio's app runs on the client's own account (${p.url.replace(/^https:\/\//, "")}): delete it there`,
    `Every project, photo and setting in their Studio, in ${where}`,
    `Their sign-ins: ${[...p.clientEmails, p.partnerEmail].join(", ")}`,
    "This card. Sites you shared stay in your own Studio; sites they published stay live until you remove those too",
  ];
}
/** Removes a client Studio: its data and members, then its app. Needs the partner sign-in to their Studio. */
export async function teardownPartner(p: PartnerRec, ctx: TearCtx): Promise<TearResult> {
  const t = await tools(ctx), be = backendOf(hostOf(p)), items: Item[] = [];
  items.push({ label: "Their Studio's projects, photos and settings", run: () => wipe(remoteRepo(p)) });
  if (p.siteId) items.push(p.pages === "cloudflare"
    ? { label: `Their Studio's app on Cloudflare (${p.siteId})`, run: () => t.del(p.pagesAccount, p.siteId!, p.backend === "cloudflare" && p.api ? { api: p.api, scope: "studio:" + p.studio } : null) }
    : { label: "Their Studio's app on Netlify", run: () => t.nf().deleteSite(p.siteId!) });
  if (p.backend === "cloudflare" && p.api) items.push({ label: "Their sign-ins", run: async () => {
    // Clients first, the partner's own access last (it carries these requests).
    for (const email of [...p.clientEmails.filter((e) => e.toLowerCase() !== p.partnerEmail.toLowerCase()), p.partnerEmail]) await cfCall(p.api!, `/m/remove?scope=${encodeURIComponent("studio:" + p.studio)}`, { method: "POST", body: JSON.stringify({ email }) });
    await be.signOut().catch(() => {});
  } });
  const res = await runAll(items, ctx.step);
  res.notes = [];
  if (!p.siteId) res.notes.push(`Their Studio's app is on the client's own account: delete ${p.url.replace(/^https:\/\//, "")} there.`);
  if (p.backend !== "cloudflare") res.notes.push("Their sign-ins are in the Supabase project: remove them there (Table editor → studio_members), or delete the project if nothing else uses it.");
  return res;
}
