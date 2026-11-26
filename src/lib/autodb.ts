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
export type UpdateStatus = { studio: Dot; db: Dot; dbBusy: boolean; /** What the database update is doing now, and how far along it is (0–100). */ dbStep: string; dbPct: number };
let status: UpdateStatus = { studio: "unknown", db: "unknown", dbBusy: false, dbStep: "", dbPct: 0 };
/** Set when the Studio has just updated itself: the database update follows on the new build, as the second part of one progress bar. */
export const UPDATE_CHAIN = "site-studio:update-chain";
export const chainOn = () => { try { return sessionStorage.getItem(UPDATE_CHAIN) === "1"; } catch { return false; } };
export const chainSet = (on: boolean) => { try { if (on) sessionStorage.setItem(UPDATE_CHAIN, "1"); else sessionStorage.removeItem(UPDATE_CHAIN); } catch { /* private mode */ } subs.forEach((f) => f()); };
/** "Update everything" was pressed (Settings → Updates): after the Studio has updated itself and its databases, the live sites follow.
 *  Kept across the reload onto the new build, and forgotten after half an hour so it can never fire on a later visit. */
const UPDATE_ALL = "site-studio:update-all";
export const allOn = () => { try { const t = +(localStorage.getItem(UPDATE_ALL) || 0); return t > 0 && Date.now() - t < 30 * 60_000; } catch { return false; } };
export const allSet = (on: boolean) => { try { if (on) localStorage.setItem(UPDATE_ALL, String(Date.now())); else localStorage.removeItem(UPDATE_ALL); } catch { /* private mode */ } };
/** A press asks again: the "tried already in this session" marks of the automatic database update are cleared. */
export const dbTriesReset = () => { try { for (let i = sessionStorage.length - 1; i >= 0; i--) { const k = sessionStorage.key(i) || ""; if (k.startsWith("site-studio:auto-db-tried:") || k.startsWith("site-studio:auto-db-told:")) sessionStorage.removeItem(k); } } catch { /* private mode */ } };
/** The status as it stands now (for code that is not a component). */
export const updateStatusNow = () => status;
/** How far along one database update is, from the step it reports. */
const STEP_AT: [RegExp, number][] = [[/^Finding/, 5], [/^Creating the database/, 12], [/^Creating its tables/, 25], [/^Getting/, 40], [/^Uploading/, 55], [/^Turning on/, 70], [/^Checking/, 82], [/^Waiting/, 92]];
const stepAt = (t: string) => STEP_AT.find(([re]) => re.test(t))?.[1] ?? 10;
const subs = new Set<() => void>();
const set = (p: Partial<UpdateStatus>) => { status = { ...status, ...p }; subs.forEach((f) => f()); };
export function useUpdateStatus(): UpdateStatus {
  const [, bump] = useState(0);
  useEffect(() => { const f = () => bump((n) => n + 1); subs.add(f); return () => { subs.delete(f); }; }, []);
  return status;
}

const clean = (a: string) => a.replace(/\/+$/, "");
/** The databases this Studio uses: its own, and those of sites hosted on a Cloudflare account of their own. */
async function targets(index: StudioIndex): Promise<{ api: string; main: boolean; sites: string[] }[]> {
  const out: { api: string; main: boolean; sites: string[] }[] = [];
  const cfg = await loadHostConfig().catch(() => null);
  const main = cfg?.kind === "cloudflare" ? clean(cfg.api) : "";
  if (main) out.push({ api: main, main: true, sites: [] });
  for (const p of index.projects) { const a = p.host?.cf?.api ? clean(p.host.cf.api) : ""; if (!a || a === main) continue; const e = out.find((x) => x.api === a); if (e) e.sites.push(p.name); else out.push({ api: a, main: false, sites: [p.name] }); }
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
export async function autoUpdateDatabases(session: Session, index: StudioIndex, step: (s: string, pct: number) => void = () => {}): Promise<"updated" | "current" | "skip"> {
  const list = await targets(index); let did = false, skipped = false;
  // Every database that is behind, so the progress counts them all (one bar for the whole update).
  const behind: { api: string; main: boolean; sites: string[]; info: Awaited<ReturnType<typeof cfDeployInfo>> }[] = [];
  for (const t of list) { const info = await cfDeployInfo(t.api); if (info.v && info.v < CFDB_VERSION) behind.push({ ...t, info }); }
  // The Studio's own database first, by itself; then every site database at the same time. One bar counts them all.
  const done = behind.map(() => 0), n = behind.length;
  const total = () => (done.reduce((a, b) => a + b, 0) / n) * 100;
  const one = async ({ info, ...t }: (typeof behind)[number], at: number, together: number) => {
    const what = t.main ? "Studio database" : `${t.sites.slice(0, 2).join(", ")}${t.sites.length > 2 ? ` +${t.sites.length - 2}` : ""} database`;
    const note = (x: string) => { done[at] = Math.max(done[at], stepAt(x) / 100); step(n > 1 ? (together > 1 ? `${x} (${what}; ${together} site databases at once)` : `${x} (${what}, ${at + 1} of ${n})`) : x, total()); };
    // Up to three tries per build and database in this browser session (a short failure is tried again), so a failing update can't loop.
    const key = `site-studio:auto-db-tried:${STUDIO_BUILD.id}:${t.api}`;
    try { const k = +(sessionStorage.getItem(key) || 0); if (k >= 3) { skipped = true; done[at] = 1; return; } sessionStorage.setItem(key, String(k + 1)); } catch { /* private mode */ }
    const c = await clientFor(session, t.api, t.main).catch(() => null);
    if (!c) { skipped = true; done[at] = 1; return; }
    const v = await cfAccountVault.load(session.token).catch(() => null);
    const old = t.main ? (v?.setup && clean(v.setup.api) === t.api ? v.setup : null) : (v?.setups || []).find((x) => clean(x.api) === t.api) || null;
    try {
      const setup = await setupCfDb(c.relay as Relay, c.token, { account: c.account, resendKey: "", mailFrom: v?.mailFrom || "", name: "Picaffectz Studio", existing: old, requireMail: false, ...(t.main && info.deploy ? { deployToken: c.token } : {}) }, note);
      // What the manual update keeps: the new setup, on this device (never a token that only stands for the database).
      // Saved one after another (see `saving`): site databases finish at the same time, and each save rewrites the whole list.
      if (c.own) saving = saving.then(async () => { const w = await cfAccountVault.load(session.token).catch(() => null); if (w) await cfAccountVault.save(t.main ? { ...w, account: c.account.id, setup } : { ...w, setups: [...(w.setups || []).filter((x) => x.account !== c.account.id), setup] }, session.token).catch(() => {}); });
      await saving;
      did = true; done[at] = 1; step(n > 1 ? `Database updated (${what})` : "Database updated", total());
    } catch (e: any) { console.warn("Database update:", e?.message || e); skipped = true; done[at] = 1; }
  };
  let saving: Promise<void> = Promise.resolve();
  const mainAt = behind.findIndex((b) => b.main);
  if (mainAt >= 0) await one(behind[mainAt], mainAt, 1);
  const rest = behind.map((b, i) => [b, i] as const).filter(([b]) => !b.main);
  await Promise.all(rest.map(([b, i]) => one(b, i, rest.length)));
  return did ? "updated" : skipped ? "skip" : "current";
}

/** Runs the database update (when the Studio itself is up to date) and refreshes the icons. */
export async function syncDatabases(session: Session, index: StudioIndex, toast: (m: string, tone?: "ok" | "bad") => void): Promise<void> {
  if (status.dbBusy) return;   // one at a time (it is started when the Studio opens, and again by "Update everything")
  await refreshStatus(index);
  if (status.db !== "pending" || status.studio === "pending") { chainSet(false); return; }
  set({ dbBusy: true, dbStep: "Checking the database", dbPct: 0 });
  try {
    const r = await autoUpdateDatabases(session, index, (t, pct) => set({ dbStep: t, dbPct: pct }));
    if (r === "updated") toast("The database was updated to match the Studio.");
    else if (r === "skip") {
      // Said once per build, so it is never silent when it can't be done here (no Cloudflare access on this device, or it failed).
      const k = `site-studio:auto-db-told:${STUDIO_BUILD.id}`;
      let told = false; try { told = !!sessionStorage.getItem(k); if (!told) sessionStorage.setItem(k, "1"); } catch { /* private mode */ }
      if (!told) toast("The database couldn't be updated automatically from this device. Open Settings → Hostings → Update the database.", "bad");
    }
  } catch (e: any) { console.warn("Database update:", e?.message || e); }
  set({ dbBusy: false, dbStep: "", dbPct: 0 });
  chainSet(false);
  await refreshStatus(index);
}
