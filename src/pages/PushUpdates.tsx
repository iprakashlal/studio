// Settings → Updates → "Push Studio updates to live sites": one place to put this Studio build (template, theme and CMS code)
// on every published site, without touching any site's content.
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { pagesForHost, type Pages } from "../lib/pages";
import { explain } from "../lib/repo";
import { checkTarget, liveTargets, pushTarget, type LiveTarget, type TargetState } from "../lib/pushupdates";
import type { Studio, StudioIndex } from "../lib/studio";
import { fmtDate, timeAgo } from "../lib/util";
import { STUDIO_BUILD } from "../build-info";
import { Dock, Modal, ProgressBar, partOf, useToast } from "../ui/kit";

/** How far one site's update is (0–100), from the step it reports. */
export function pushPct(detail: string | undefined, prev = 4): number {
  const d = detail || "";
  if (/^Getting the new server code/.test(d)) return 25;
  if (/^Uploading to Cloudflare/.test(d)) return 65;
  if (/^Checking photos/.test(d)) return partOf(d, 6, 26);
  if (/^Checking content/.test(d)) return 32;
  if (/^Uploading pages/.test(d)) return partOf(d, 40, 97);
  if (/^Done/.test(d)) return 100;
  if (/^Reading the live content/.test(d)) return 12;
  if (/^Building pages/.test(d)) return 38;
  if (/^Uploading \d+ files/.test(d)) return 66;
  return prev;
}

const BADGE: Record<TargetState["s"], [string, string]> = {
  checking: ["Checking…", "border-ink-500 text-ink-300"],
  current: ["Up to date", "border-emerald-400/60 text-emerald-200"],
  old: ["Update available", "border-amber-400/60 text-amber-200"],
  unreachable: ["Can't reach", "border-rose-400/60 text-rose-200"],
  pushing: ["Updating…", "border-brand-400/60 text-brand-200"],
  done: ["Updated", "border-emerald-400/60 text-emerald-200"],
  failed: ["Failed", "border-rose-400/60 text-rose-200"],
  skipped: ["Skipped", "border-ink-500 text-ink-300"],
};

/* ---- The job lives outside the screens: it carries on while you work elsewhere in the Studio, with the window minimised. ---- */
type Job = { open: boolean; min: boolean; st: Record<string, TargetState>; pick: Record<string, boolean>; have: Record<string, boolean>; running: boolean; finished: boolean; page: number; order: LiveTarget[] };
let job: Job = { open: false, min: false, st: {}, pick: {}, have: {}, running: false, finished: false, page: 0, order: [] };
const subs = new Set<() => void>();
const put = (f: (j: Job) => Partial<Job>) => { job = { ...job, ...f(job) }; subs.forEach((x) => x()); };
const useJob = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => job);
/** Opens the window (Settings → Updates). A run in hand, or one just finished, is shown as it is. */
export function openPushUpdates() { put((j) => (j.running || (j.finished && j.open) ? { open: true, min: false } : { open: true, min: false, st: {}, pick: {}, have: {}, finished: false, page: 0, order: [] })); }
/** How many sites a page of the list shows. */
export const PUSH_PAGE = 5;

/** Mounted once for the whole Studio: the window, or its minimised strip while an update runs. */
export function PushUpdatesHost({ studio, index, token }: { studio: Studio; index: StudioIndex | null; token: string }) {
  const j = useJob(), toast = useToast();
  const targets = useMemo(() => (index ? liveTargets(index.projects, token) : []), [index, token]);
  const pageCache = useMemo(() => new Map<string, Promise<Pages | null>>(), [token]);
  const pagesFor = (h: NonNullable<LiveTarget["project"]["host"]>) => { const k = h.kind + ":" + (h.account || "") + ":" + (h.cf ? h.cf.api + "|" + h.cf.site : ""); if (!pageCache.has(k)) pageCache.set(k, pagesForHost(h, token)); return pageCache.get(k)!; };
  const set = (k: string, v: TargetState) => put((x) => ({ st: { ...x.st, [k]: v } }));
  // The list is the one the window was opened with while a run is in hand (the projects list changes as sites are updated).
  const list = j.order.length ? j.order : targets;
  const fresh = j.open && !j.running && !j.finished && !j.order.length;
  useEffect(() => {
    if (!fresh || !targets.length) return;
    put(() => ({ order: targets, st: Object.fromEntries(targets.map((t) => [t.key, { s: "checking" } as TargetState])) }));
    // Each hosted site: this device's own account, or (Cloudflare) publishing through the Studio's database.
    Promise.all(targets.filter((t) => t.kind === "hosted").map(async (t) => [t.key, !!(await pagesFor(t.project.host!))] as const)).then((l) => put(() => ({ have: Object.fromEntries(l) })));
    targets.forEach(async (t) => { const v = await checkTarget(t); put((x) => ({ st: { ...x.st, [t.key]: v }, pick: { ...x.pick, [t.key]: v.s === "old" } })); });
  }, [fresh, targets]); // eslint-disable-line react-hooks/exhaustive-deps
  // Leaving the Studio itself would stop the run: the browser asks first.
  useEffect(() => { if (!j.running) return; const f = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; }; addEventListener("beforeunload", f); return () => removeEventListener("beforeunload", f); }, [j.running]);
  if (!j.open) return null;

  const st = j.st, pick = j.pick, have = j.have, running = j.running, finished = j.finished;
  const chosen = list.filter((t) => pick[t.key]);
  const missingT = chosen.filter((t) => t.kind === "hosted" && have[t.key] === false);
  const missing = [...new Set(missingT.map((t) => t.label))];
  const pages = Math.max(1, Math.ceil(list.length / PUSH_PAGE)), page = Math.min(j.page, pages - 1), shown = list.slice(page * PUSH_PAGE, page * PUSH_PAGE + PUSH_PAGE);
  const close = () => put(() => ({ open: false, min: false, st: {}, pick: {}, have: {}, finished: false, page: 0, order: [] }));

  const run = async () => {
    const todo = chosen, haveNow = have;
    put(() => ({ running: true }));
    let ok = 0, bad = 0;
    for (const t of todo) {
      // The list turns to the page of the site in hand.
      put(() => ({ page: Math.floor(list.indexOf(t) / PUSH_PAGE) }));
      if (t.kind === "hosted" && haveNow[t.key] === false) { set(t.key, { s: "skipped", msg: `${t.label} isn't connected on this device (Settings → Hostings → Hosting accounts).` }); continue; }
      set(t.key, { s: "pushing" });
      try {
        let pct = 4;
        await pushTarget(t, { studio, pages: pagesFor, token, step: (d) => { pct = Math.max(pct, pushPct(d, pct)); set(t.key, { s: "pushing", detail: d, pct }); } });
        set(t.key, { s: "done" }); ok++;
      } catch (e) { set(t.key, { s: "failed", msg: explain(e) }); bad++; }
    }
    put(() => ({ running: false, finished: true }));
    toast(bad ? `${ok} site(s) updated, ${bad} failed` : `${ok} site(s) updated`, bad ? "bad" : "ok");
  };

  // The whole run: finished sites count in full, the one in hand by how far it is.
  const ran = chosen.filter((t) => ["done", "failed", "skipped"].includes(st[t.key]?.s)), now = chosen.find((t) => st[t.key]?.s === "pushing"), nowV = now && st[now.key];
  const overall = chosen.length ? ((ran.length + (nowV && nowV.s === "pushing" ? (nowV.pct || 0) / 100 : 0)) / chosen.length) * 100 : 0;
  const failedN = chosen.filter((t) => st[t.key]?.s === "failed").length, skippedN = chosen.filter((t) => st[t.key]?.s === "skipped").length;
  const allOld = list.filter((t) => st[t.key]?.s === "old" || st[t.key]?.s === "current");
  const overallBar = <ProgressBar value={finished ? 100 : overall} tone={finished ? (failedN ? "bad" : "ok") : "run"} label="All chosen sites"
    detail={finished ? `${ran.length - failedN - skippedN} of ${chosen.length} updated${failedN ? ` · ${failedN} failed` : ""}` : now ? `Site ${ran.length + 1} of ${chosen.length} · ${now.project.name}` : "Starting…"} />;

  // Minimised: a small strip in the corner of every Studio screen.
  if (j.min) return (
    <Dock><div role="status" aria-label="Updating live sites" className="w-full rounded-xl border border-brand-500/40 bg-ink-900 p-3 shadow-2xl">
      <div className="mb-2 flex items-center gap-2"><b className="min-w-0 flex-1 truncate text-[13px] text-ink-100">{finished ? "Live sites updated" : "Updating live sites…"}</b>
        <button type="button" className="btn btn-sm" onClick={() => put(() => ({ min: false }))}>Open</button>
        {finished && <button type="button" className="icon-btn" aria-label="Dismiss" onClick={close}>✕</button>}</div>
      {overallBar}
      {!finished && <p className="mt-1.5 text-[11.5px] text-ink-400">Carry on working in the Studio. Keep this tab open until it finishes.</p>}
    </div></Dock>
  );

  const footer = finished
    ? <button className="btn btn-pri" onClick={close}>Done</button>
    : running ? <><span className="mr-auto text-[12.5px] text-ink-400">You can minimise this and keep working.</span><button className="btn btn-pri" onClick={() => put(() => ({ min: true }))}>Minimise</button></>
    : <><button className="btn" onClick={close}>Cancel</button>
        <button className="btn btn-pri" disabled={!chosen.length || studio.repo.demo} onClick={run}>{`Push to ${chosen.length} site${chosen.length === 1 ? "" : "s"}`}</button></>;

  return (
    <Modal title="Push Studio updates to live sites" wide onClose={() => (running ? put(() => ({ min: true })) : close())} footer={footer}>
      <p className="text-sm text-ink-300">Rebuilds the chosen sites with this Studio build: template and theme code, effects and the site's admin page. <b className="text-ink-100">Each site keeps its own content and photos</b>, including edits made in its admin page.</p>
      <p className="text-[13px] text-ink-400">This Studio: build <code className="font-mono text-xs">{STUDIO_BUILD.id}</code>{STUDIO_BUILD.at && <> from {fmtDate(STUDIO_BUILD.at)}</>}.</p>
      {studio.repo.demo && <p className="rounded-lg border border-amber-400/40 bg-amber-400/5 px-3 py-2.5 text-[13px] text-amber-100">The demo has no live sites. Sign in with your repository to push updates.</p>}
      {!list.length && !studio.repo.demo && <p className="rounded-lg border border-ink-700 px-3 py-2.5 text-sm text-ink-300">No project is published yet. Publish a project to GitHub or Netlify first.</p>}
      {list.length > 0 && (
        <div className="flex flex-col gap-2">
          {!running && !finished && allOld.length > 1 && (
            <div className="flex gap-3 text-[13px]">
              <button type="button" className="text-brand-300 underline" onClick={() => put(() => ({ pick: Object.fromEntries(allOld.map((t) => [t.key, true])) }))}>Select all{pages > 1 ? ` ${allOld.length}` : ""}</button>
              <button type="button" className="text-brand-300 underline" onClick={() => put(() => ({ pick: {} }))}>Select none</button>
              {pages > 1 && <span className="ml-auto text-ink-400">{chosen.length} of {list.length} selected</span>}
            </div>
          )}
          {(running || finished) && chosen.length > 0 && <div className="rounded-xl border border-ink-700 px-3 py-2.5" aria-label="Overall progress">{overallBar}</div>}
          <ul className="flex flex-col divide-y divide-ink-700 rounded-xl border border-ink-700" aria-label="Live sites">
            {shown.map((t) => <Row key={t.key} t={t} v={st[t.key] || { s: "checking" }} on={!!pick[t.key]} lock={running || finished} onPick={(b) => put((x) => ({ pick: { ...x.pick, [t.key]: b } }))} />)}
          </ul>
          {pages > 1 && <nav className="flex items-center justify-between gap-3 text-[13px]" aria-label="Pages of sites">
            <button type="button" className="btn btn-sm" disabled={page === 0} onClick={() => put(() => ({ page: page - 1 }))}>← Previous</button>
            <span className="text-ink-400">Page {page + 1} of {pages} · sites {page * PUSH_PAGE + 1}–{Math.min(list.length, (page + 1) * PUSH_PAGE)} of {list.length}</span>
            <button type="button" className="btn btn-sm" disabled={page >= pages - 1} onClick={() => put(() => ({ page: page + 1 }))}>Next →</button>
          </nav>}
        </div>
      )}
      {missing.length > 0 && !running && !finished && <p className="rounded-lg border border-amber-400/40 bg-amber-400/5 px-3 py-2.5 text-[13px] text-amber-100">{missing.join(" and ")} isn't connected on this device, so {missingT.length === 1 ? "that site" : "those sites"} will be skipped.{missingT.some((t) => t.project.host?.cf) ? " For Cloudflare sites: sign in to the site's database on this device (its hosting window), and turn on “Publish from any device” once in Settings → Hostings → Hosting accounts on a device that has the Cloudflare token." : " Connect it in Settings → Hostings → Hosting accounts."}</p>}
      {chosen.some((t) => t.kind === "hosted" && t.project.host!.kind === "netlify") && <p className="hint">Netlify allows 3 deploys a minute; with more sites the Studio waits and carries on by itself.</p>}
      {finished && <p className="hint">GitHub Pages sites show the update about a minute after it's pushed; Netlify and Cloudflare sites at once.</p>}
    </Modal>
  );
}

/** Settings → Updates: where pushing this Studio build to live sites starts. */
export function PushUpdatesCard({ index, demo }: { index: StudioIndex; demo?: boolean }) {
  const j = useJob(), n = index.projects.filter((p) => p.publish || p.host).length;
  return (
    <section className="card flex flex-col gap-3 p-5" aria-label="Live sites">
      <h2 className="text-lg font-extrabold">Live sites</h2>
      <p className="text-sm text-ink-300">Put this Studio build (templates, themes, effects and each site's admin page) on your published sites. Each site keeps its own content and photos. You can minimise the window and keep working while it runs.</p>
      <p className="text-[13px] text-ink-400">This Studio: build <code className="font-mono text-xs">{STUDIO_BUILD.id}</code>{STUDIO_BUILD.at && <> from {fmtDate(STUDIO_BUILD.at)}</>}. {n ? `${n} published project${n === 1 ? "" : "s"}.` : "No project is published yet."}</p>
      <div><button type="button" className="btn btn-pri" disabled={!n || demo} onClick={openPushUpdates}>{j.running ? "↻ Show the update in progress" : "↻ Push Studio updates to live sites"}</button></div>
    </section>
  );
}

function Row({ t, v, on, lock, onPick }: { t: LiveTarget; v: TargetState; on: boolean; lock: boolean; onPick: (b: boolean) => void }) {
  const [label, cls] = BADGE[v.s];
  const id = "pu-" + t.key.replace(/[^a-z0-9]/gi, "-");
  const canPick = v.s === "old" || v.s === "current";
  const sub = v.s === "old" ? (v.at ? `Last ${t.kind === "worker" ? "deployed" : "built"} ${timeAgo(v.at)}${v.build ? ` with build ${v.build}` : " with an earlier Studio"}` : "Built with an earlier Studio")
    : v.s === "current" ? `Already on this build · ${timeAgo(v.at)}`
    : v.s === "failed" || v.s === "unreachable" || v.s === "skipped" ? v.msg : "";
  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <input id={id} type="checkbox" className="h-4 w-4 shrink-0 accent-brand-400" checked={on} disabled={lock || !canPick} onChange={(e) => onPick(e.target.checked)} />
      <div className="min-w-0 flex-1"><label htmlFor={id} className="block min-w-0">
        <span className="block truncate text-sm font-semibold text-ink-100">{t.project.name} <span className="font-normal text-ink-400">· {t.label}</span></span>
        <span className="block truncate text-[12px] text-ink-400"><a className="text-brand-300 underline" href={t.url} target="_blank" rel="noopener noreferrer">{t.url.replace(/^https:\/\//, "")}</a>{sub && <> · {sub}</>}</span>
      </label>
        {v.s === "pushing" && <div className="mt-1.5"><ProgressBar value={v.pct ?? 4} label={`Updating ${t.project.name}`} detail={v.detail || "Starting…"} /></div>}
        {v.s === "done" && <div className="mt-1.5"><ProgressBar value={100} tone="ok" label={`${t.project.name} updated`} /></div>}
      </div>
      <span className={`chip shrink-0 ${cls}`}>{label}</span>
    </li>
  );
}
