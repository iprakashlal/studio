// Projects → "Push updates to live sites": one place to put this Studio build (template, theme and CMS code)
// on every published site, without touching any site's content.
import { useEffect, useMemo, useState } from "react";
import { netlifyToken } from "../lib/hosting";
import { Netlify } from "../lib/netlify";
import { explain } from "../lib/repo";
import { checkTarget, liveTargets, pushTarget, type LiveTarget, type TargetState } from "../lib/pushupdates";
import type { Studio, StudioIndex } from "../lib/studio";
import { fmtDate, timeAgo } from "../lib/util";
import { STUDIO_BUILD } from "../build-info";
import { Modal, useToast } from "../ui/kit";

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

export function PushUpdatesDialog({ studio, index, token, onClose }: { studio: Studio; index: StudioIndex; token: string; onClose: () => void }) {
  const toast = useToast();
  const targets = useMemo(() => liveTargets(index.projects, token), [index, token]);
  const [st, setSt] = useState<Record<string, TargetState>>({});
  const [pick, setPick] = useState<Record<string, boolean>>({});
  const [nf, setNf] = useState<Netlify | null>(null);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const set = (k: string, v: TargetState) => setSt((m) => ({ ...m, [k]: v }));

  useEffect(() => {
    netlifyToken.load(token).then((t) => setNf(t ? new Netlify(t.token) : null));
    targets.forEach((t) => set(t.key, { s: "checking" }));
    Promise.all(targets.map(async (t) => {
      const v = await checkTarget(t);
      set(t.key, v);
      setPick((m) => ({ ...m, [t.key]: v.s === "old" }));
    }));
  }, [targets]);

  const chosen = targets.filter((t) => pick[t.key]);
  const needsNetlify = chosen.some((t) => t.kind === "netlify") && !nf;

  const run = async () => {
    setRunning(true);
    let ok = 0, bad = 0;
    for (const t of chosen) {
      if (t.kind === "netlify" && !nf) { set(t.key, { s: "skipped", msg: "Netlify isn't connected on this device (Settings → Hosting accounts)." }); continue; }
      set(t.key, { s: "pushing" });
      try {
        await pushTarget(t, { studio, nf, step: (d) => set(t.key, { s: "pushing", detail: d }) });
        set(t.key, { s: "done" }); ok++;
      } catch (e) { set(t.key, { s: "failed", msg: explain(e) }); bad++; }
    }
    setRunning(false); setFinished(true);
    toast(bad ? `${ok} site(s) updated, ${bad} failed` : `${ok} site(s) updated`, bad ? "bad" : "ok");
  };

  const allOld = targets.filter((t) => st[t.key]?.s === "old" || st[t.key]?.s === "current");
  const footer = finished
    ? <button className="btn btn-pri" onClick={onClose}>Done</button>
    : <><button className="btn" onClick={onClose} disabled={running}>Cancel</button>
        <button className="btn btn-pri" disabled={running || !chosen.length || studio.repo.demo} onClick={run}>{running ? "Updating…" : `Push to ${chosen.length} site${chosen.length === 1 ? "" : "s"}`}</button></>;

  return (
    <Modal title="Push Studio updates to live sites" wide onClose={() => !running && onClose()} footer={footer}>
      <p className="text-sm text-ink-300">Rebuilds the chosen sites with this Studio build: template and theme code, effects and the site's admin page. <b className="text-ink-100">Each site keeps its own content and photos</b>, including edits made in its admin page.</p>
      <p className="text-[13px] text-ink-400">This Studio: build <code className="font-mono text-xs">{STUDIO_BUILD.id}</code>{STUDIO_BUILD.at && <> from {fmtDate(STUDIO_BUILD.at)}</>}.</p>
      {studio.repo.demo && <p className="rounded-lg border border-amber-400/40 bg-amber-400/5 px-3 py-2.5 text-[13px] text-amber-100">The demo has no live sites. Sign in with your repository to push updates.</p>}
      {!targets.length && !studio.repo.demo && <p className="rounded-lg border border-ink-700 px-3 py-2.5 text-sm text-ink-300">No project is published yet. Publish a project to GitHub or Netlify first.</p>}
      {targets.length > 0 && (
        <div className="flex flex-col gap-2">
          {!running && !finished && allOld.length > 1 && (
            <div className="flex gap-3 text-[13px]">
              <button type="button" className="text-brand-300 underline" onClick={() => setPick(Object.fromEntries(allOld.map((t) => [t.key, true])))}>Select all</button>
              <button type="button" className="text-brand-300 underline" onClick={() => setPick({})}>Select none</button>
            </div>
          )}
          <ul className="flex flex-col divide-y divide-ink-700 rounded-xl border border-ink-700" aria-label="Live sites">
            {targets.map((t) => <Row key={t.key} t={t} v={st[t.key] || { s: "checking" }} on={!!pick[t.key]} lock={running || finished} onPick={(b) => setPick((m) => ({ ...m, [t.key]: b }))} />)}
          </ul>
        </div>
      )}
      {needsNetlify && !running && !finished && <p className="rounded-lg border border-amber-400/40 bg-amber-400/5 px-3 py-2.5 text-[13px] text-amber-100">Netlify isn't connected on this device, so Netlify sites will be skipped. Add the token in Settings → Hosting accounts.</p>}
      {chosen.some((t) => t.kind === "netlify") && <p className="hint">Netlify allows 3 deploys a minute; with more sites the Studio waits and carries on by itself.</p>}
      {finished && <p className="hint">GitHub Pages sites show the update about a minute after it's pushed; Netlify sites at once.</p>}
    </Modal>
  );
}

function Row({ t, v, on, lock, onPick }: { t: LiveTarget; v: TargetState; on: boolean; lock: boolean; onPick: (b: boolean) => void }) {
  const [label, cls] = BADGE[v.s];
  const id = "pu-" + t.key.replace(/[^a-z0-9]/gi, "-");
  const canPick = v.s === "old" || v.s === "current";
  const sub = v.s === "old" ? (v.at ? `Last built ${timeAgo(v.at)}${v.build ? ` with build ${v.build}` : " with an earlier Studio"}` : "Built with an earlier Studio")
    : v.s === "current" ? `Already on this build · ${timeAgo(v.at)}`
    : v.s === "pushing" ? v.detail || "Starting…"
    : v.s === "failed" || v.s === "unreachable" || v.s === "skipped" ? v.msg : "";
  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <input id={id} type="checkbox" className="h-4 w-4 shrink-0 accent-brand-400" checked={on} disabled={lock || !canPick} onChange={(e) => onPick(e.target.checked)} />
      <label htmlFor={id} className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink-100">{t.project.name} <span className="font-normal text-ink-400">· {t.label}</span></span>
        <span className="block truncate text-[12px] text-ink-400"><a className="text-brand-300 underline" href={t.url} target="_blank" rel="noopener noreferrer">{t.url.replace(/^https:\/\//, "")}</a>{sub && <> · {sub}</>}</span>
      </label>
      <span className={`chip shrink-0 ${cls}`}>{label}</span>
    </li>
  );
}
