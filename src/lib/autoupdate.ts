// A moved Studio (on Cloudflare or Netlify) keeps itself on the latest build: when it opens and its source (the
// GitHub Pages Studio) has a newer build, it redeploys its app files. Only the app changes; projects, photos,
// members and settings live in the database and aren't touched. Uses this device's hosting token, or the
// database's kept token (Settings → Accounts → Publish from any device) for a signed-in owner.
import type { Session } from "./auth";
import type { StudioIndex } from "./studio";
import { loadHostConfig } from "./studiohost";
import { appBase, appFiles, deployStudioApp } from "./migrate";
import { loadPages, pagesViaDb } from "./pages";
import { STUDIO_BUILD } from "../build-info";

const OFF = "site-studio:auto-update";
export const autoUpdatePref = {
  on: () => { try { return localStorage.getItem(OFF) !== "off"; } catch { return true; } },
  set: (v: boolean) => { try { localStorage.setItem(OFF, v ? "on" : "off"); } catch { /* private mode */ } },
};

/** "updated" (reload to use it), "current", or "skip" (not a moved Studio, turned off, no way to deploy, or tried). */
export async function autoUpdateStudio(session: Session, index: StudioIndex, step: (s: string) => void = () => {}): Promise<"updated" | "current" | "skip"> {
  if (!autoUpdatePref.on() || !index.hosted?.siteId) return "skip";
  const cfg = await loadHostConfig().catch(() => null);
  // The source itself (GitHub Pages, even when it shares the database) never deploys anything.
  if (!cfg?.source || appBase() === cfg.source.replace(/\/?$/, "/")) return "skip";
  const latest = (await appFiles(cfg.source).catch(() => null))?.build;
  if (!latest || latest === STUDIO_BUILD.id) return "current";
  // One try per build on this device, so a failing update can't loop.
  const key = "site-studio:auto-update-tried:" + latest;
  try { if (sessionStorage.getItem(key)) return "skip"; sessionStorage.setItem(key, "1"); } catch { /* private mode */ }
  const where = index.hosted.pages || "netlify";
  const pages = (await loadPages(where, session.token, index.hosted.account).catch(() => null))
    || (where === "cloudflare" && cfg.kind === "cloudflare" ? await pagesViaDb(cfg.api, "studio:" + cfg.studio).catch(() => null) : null);
  if (!pages) { console.info("Studio update: no way to deploy from this device (no Cloudflare token here, and Publish from any device is off)."); return "skip"; }
  await deployStudioApp(pages, { siteId: index.hosted.siteId, siteName: "", source: cfg.source, config: cfg }, step);
  return "updated";
}
