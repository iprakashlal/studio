// The numbers at the top of the Studio's dashboard. Settings → General → Dashboard numbers picks which show.
import type { ProjectMeta } from "./studio";

export const DASH_STATS: { key: string; label: string; count: (ps: ProjectMeta[]) => number }[] = [
  { key: "projects", label: "Projects", count: (ps) => ps.length },
  { key: "live", label: "Exported or published", count: (ps) => ps.filter((p) => p.status !== "draft").length },
  { key: "published", label: "Published", count: (ps) => ps.filter((p) => p.status === "published").length },
  { key: "exports", label: "Exports in total", count: (ps) => ps.reduce((s, p) => s + p.exports.length, 0) },
  { key: "drafts", label: "Drafts", count: (ps) => ps.filter((p) => p.status === "draft").length },
  { key: "github", label: "On GitHub", count: (ps) => ps.filter((p) => !!p.publish).length },
  { key: "domain", label: "Live with their own domain", count: (ps) => ps.filter((p) => !!p.host?.domain).length },
  { key: "hosted", label: "On Cloudflare or Netlify", count: (ps) => ps.filter((p) => !!p.host).length },
  { key: "cloudflare", label: "On Cloudflare", count: (ps) => ps.filter((p) => p.host?.kind === "cloudflare").length },
  { key: "netlify", label: "On Netlify", count: (ps) => ps.filter((p) => p.host?.kind === "netlify").length },
  { key: "shops", label: "Online shops (e-commerce)", count: (ps) => ps.filter((p) => p.template === "store").length },
  { key: "business", label: "Business websites", count: (ps) => ps.filter((p) => p.template === "business").length },
  { key: "restaurants", label: "Restaurant & café sites", count: (ps) => ps.filter((p) => p.template === "restaurant").length },
  { key: "portfolios", label: "Portfolios", count: (ps) => ps.filter((p) => p.template === "portfolio").length },
  { key: "clients", label: "Clients", count: (ps) => new Set(ps.map((p) => p.client.trim().toLowerCase()).filter(Boolean)).size },
];
export const DASH_DEFAULT = ["projects", "live", "published", "exports"];
/** The chosen numbers, in the list's order; the usual four when nothing was chosen. */
export const dashStats = (chosen: string[] | undefined) => { const keys = chosen?.length ? chosen : DASH_DEFAULT; return DASH_STATS.filter((s) => keys.includes(s.key)); };
