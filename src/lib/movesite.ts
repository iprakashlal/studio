// One click, from any device: the Studio's database copies a site from another Cloudflare account's database (with
// that account's kept token), the project is pointed at the Studio's database, and the site is republished on its own
// account so its pages read from there. The old database is only read.
import { cfxImportSite, cfxSite } from "./cfdb";
import { pagesForHost } from "./pages";
import { liveTargets, pushTarget } from "./pushupdates";
import type { ProjectMeta, Studio, StudioIndex } from "./studio";

export async function moveSiteIntoStudioDb(o: { studio: Studio; project: ProjectMeta; db: { api: string; studio: string }; token: string; step: (s: string) => void }): Promise<{ index: StudioIndex; missing: string[]; editors: number; enquiries: number; files: number }> {
  const h = o.project.host;
  if (!h || h.kind !== "cloudflare" || !h.cf || !h.account) throw new Error("This site isn't on Cloudflare with its data in a database.");
  const r = await cfxImportSite(o.db.api, o.db.studio, h.account, h.cf.site, o.step);
  const next = { ...h, cf: { api: o.db.api, site: h.cf.site } };
  await cfxSite(o.db.api, o.db.studio, h.account, h.siteId, h.cf.site).catch(() => null);
  o.step("Saving the project");
  const index = await o.studio.updateMeta(o.project.id, { host: next }, `${o.project.name}: data moved into the Studio's database`);
  const proj = index.projects.find((x) => x.id === o.project.id)!, t = liveTargets([proj], o.token).find((x) => x.kind === "hosted")!;
  o.step("Publishing the site so it reads from the Studio's database");
  await pushTarget(t, { studio: o.studio, pages: (hh) => pagesForHost(hh, o.token), token: o.token, step: o.step });
  return { index, missing: r.missing, editors: r.editors, enquiries: r.enquiries, files: r.files.length };
}
