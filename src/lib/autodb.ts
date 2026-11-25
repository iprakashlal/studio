// Keeps the databases on the same build as the Studio, and tells the Studio's two status icons how things stand.
// When the Studio has updated itself (and reloaded onto the new build), its database, and any site databases the Studio
// has the access to, are updated by themselves with the Cloudflare access this device (or the Studio's database) already
// has. Without that access nothing changes and the icon stays yellow, so the person can finish it in Settings.
import { useEffect, useState } from "react";
import type { Session } from "./auth";
import type { StudioIndex } from "./studio";
import { CFDB_VERSION } from "./cfdbSchema";
import { cfAccountVault, cfDeployInfo, setupCfDb, studioDbWay } from "./cfdb";
import { Cloudflare, cfDbToken, type CfAccount } from "./cloudflare";
import { getHelper, type Relay } from "./relay";
import { loadHostConfig } from "./studiohost";
import { appBase, appFiles } from "./migrate";
import { STUDIO_BUILD } from "../build-info";

export type Dot = "pending" | "current" | "unknown" | "na";
export type UpdateStatus = { studio: Dot; db: Dot; dbBusy: boolean };
let status: UpdateStatus = { studio: "unknown", db: "unknown", dbBusy: false };
const subs = new Set<() => void>();
const set = (p: Partial<UpdateStatus>) => { status = { ...status, ...p }; subs.forEach((f) => f()); };
export function useUpdateStatus(): UpdateStatus {
  const [, bump] = useState(0);
  useEffect(() => { const f = () => bump((n) => n + 1); subs.add(f); return () => { subs.delete(f); }; }, []);
  return status;
}

const clean = (a: string) => a.replace(/\/+$/, "");
/** The databases this Studio uses: its own, and those of sites hosted on a Cloudflare account of their own. */
async function targets(index: StudioIndex): Promise<{ api: string; main: boolean }[]> {
  const out: { api: string; main: boolean }[] = [];
  const cfg = await loadHostConfig().catch(() => null);
  const main = cfg?.kind === "cloudflare" ? clean(cfg.api) : "";
  if (main) out.push({ api: main, main: true });
  for (const p of index.projects) { const a = p.host?.cf?.api ? clean(p.host.cf.api) : ""; if (a && a !== main && !out.some((x) => x.api === a)) out.push({ api: a, main: false }); }
  return out;
}

/** Where the Studio's app and its databases stand against this build. */
export async function refreshStatus(index: StudioIndex): Promise<void> {
  const cfg = await loadHostConfig().catch(() => null);
  let studio: Dot = "na";
  if (index.hosted?.siteId && cfg?.source && appBase() !== cfg.source.replace(/\/?$/, "/")) {
    const latest = (await appFiles(cfg.source).catch(() => null))?.build;
    studio = !latest ? "unknown" : latest === STUDIO_BUILD.id ? "current" : "pending";
  }
  const list = await targets(index);
  let db: Dot = list.length ? "current" : "na";
  for (const t of list) { const i = await cfDeployInfo(t.api); if (!i.v) { if (db === "current") db = "unknown"; } else if (i.v < CFDB_VERSION) { db = "pending"; break; } }
  set({ studio, db });
}

/** A Cloudflare client that can manage the account running `api` (this device's tokens, or the Studio's database for its own). */
async function clientFor(session: Session, api: string, main: boolean): Promise<{ cf: Cloudflare; relay: Relay | null; account: CfAccount; token: string; own: boolean } | null> {
  const host = api.replace(/^https:\/\//, ""), want = (sub: string | null) => !!sub && `picaffectz-db.${sub}.workers.dev` === host;
  const v = await cfAccountVault.load(session.token).catch(() => null);
  const tokens = [v?.token, ...(v?.more || []).map((m) => m.token)].filter((t): t is string => !!t);
  if (tokens.length) {
    const relay = await getHelper(session.token, null).catch(() => null);
    if (relay) for (const t of tokens) {
      const cf = new Cloudflare(relay, t);
      for (const a of await cf.accounts().catch(() => [] as CfAccount[])) if (want(await cf.subdomainOf(a.id).catch(() => null))) return { cf, relay, account: a, token: t, own: t === v?.token };
    }
  }
  if (main) {
    const way = await studioDbWay().catch(() => null);
    if (way) for (const a of await new Cloudflare(null, way.token).accounts().catch(() => [] as CfAccount[])) {
      const t = cfDbToken(way.api, way.scope, a.id), cf = new Cloudflare(null, t);
      if (want(await cf.subdomainOf(a.id).catch(() => null))) return { cf, relay: null, account: a, token: t, own: false };
    }
  }
  return null;
}

/** Updates every database that is older than this build, when access is at hand. "skip": nothing could be done here. */
export async function autoUpdateDatabases(session: Session, index: StudioIndex, step: (s: string) => void = () => {}): Promise<"updated" | "current" | "skip"> {
  const list = await targets(index); let did = false, skipped = false;
  for (const t of list) {
    const info = await cfDeployInfo(t.api);
    if (!info.v || info.v >= CFDB_VERSION) continue;
    // One try per build and database on this device, so a failing update can't loop.
    const key = `site-studio:auto-db-tried:${STUDIO_BUILD.id}:${t.api}`;
    try { if (sessionStorage.getItem(key)) { skipped = true; continue; } sessionStorage.setItem(key, "1"); } catch { /* private mode */ }
    const c = await clientFor(session, t.api, t.main).catch(() => null);
    if (!c) { skipped = true; continue; }
    const v = await cfAccountVault.load(session.token).catch(() => null);
    const old = t.main ? (v?.setup && clean(v.setup.api) === t.api ? v.setup : null) : (v?.setups || []).find((x) => clean(x.api) === t.api) || null;
    try {
      const setup = await setupCfDb(c.relay as Relay, c.token, { account: c.account, resendKey: "", mailFrom: v?.mailFrom || "", name: "Picaffectz Studio", existing: old, requireMail: false, ...(t.main && info.deploy ? { deployToken: c.token } : {}) }, step);
      // What the manual update keeps: the new setup, on this device (never a token that only stands for the database).
      if (v && c.own) await cfAccountVault.save(t.main ? { ...v, account: c.account.id, setup } : { ...v, setups: [...(v.setups || []).filter((x) => x.account !== c.account.id), setup] }, session.token).catch(() => {});
      did = true;
    } catch (e: any) { console.warn("Database update:", e?.message || e); skipped = true; }
  }
  return did ? "updated" : skipped ? "skip" : "current";
}

/** Runs the database update (when the Studio itself is up to date) and refreshes the icons. */
export async function syncDatabases(session: Session, index: StudioIndex, toast: (m: string, tone?: "ok" | "bad") => void): Promise<void> {
  await refreshStatus(index);
  if (status.db !== "pending" || status.studio === "pending") return;
  set({ dbBusy: true });
  try {
    const r = await autoUpdateDatabases(session, index);
    if (r === "updated") toast("The database was updated to match the Studio.");
  } catch (e: any) { console.warn("Database update:", e?.message || e); }
  set({ dbBusy: false });
  await refreshStatus(index);
}
