// The Studio updating itself (its app files, never the projects): one job for the whole Studio, so it carries on
// whichever screen is open or however the browser's tabs are switched, shows on every screen, and ends by reloading
// onto the Projects page. Unsaved edits are never thrown away: then it waits for a press.
import { useEffect, useState } from "react";

export type StudioUpdateState = { running: boolean; step: string; err: string; /** Done, and waiting for the person (unsaved edits open). */ ready: boolean };
let state: StudioUpdateState = { running: false, step: "", err: "", ready: false };
const subs = new Set<() => void>();
const set = (p: Partial<StudioUpdateState>) => { state = { ...state, ...p }; subs.forEach((f) => f()); };
/** Set by the editor while a project has unsaved changes. */
export const studioDirty = { on: false };
const guard = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };

/** Reloads the Studio onto its Projects page (the first screen), on the new build. */
export function reloadToProjects() {
  // The database update follows on the new build as the second part of the same progress bar.
  try { sessionStorage.setItem("site-studio:update-chain", "1"); } catch { /* private mode */ }
  removeEventListener("beforeunload", guard);
  try { history.replaceState(null, "", location.pathname + location.search + "#/"); } catch { location.hash = "#/"; }
  location.reload();
}
export const studioUpdate = {
  get: () => state,
  /** Runs `job` (returns true when the Studio was updated). Does nothing while one is already running. */
  start(job: (step: (s: string) => void) => Promise<boolean>, opts: { quietErrors?: boolean } = {}): void {
    if (state.running || state.ready) return;
    set({ running: true, step: "Checking", err: "", ready: false });
    addEventListener("beforeunload", guard);
    const run = async () => {
      try {
        const updated = await job((s) => set({ step: s }));
        removeEventListener("beforeunload", guard);
        if (!updated) { set({ running: false, step: "" }); return; }
        if (studioDirty.on) { set({ running: false, step: "", ready: true }); return; }
        set({ step: "Updated. Opening your projects" }); setTimeout(reloadToProjects, 900);
      } catch (e: any) {
        removeEventListener("beforeunload", guard);
        if (opts.quietErrors) console.warn("Studio update:", e?.message || e);
        set({ running: false, step: "", err: opts.quietErrors ? "" : e?.message || "Couldn't update." });
      }
    };
    // A held lock tells the browser this tab is busy, so it isn't frozen while it sits in the background.
    const locks = (navigator as any).locks;
    if (locks?.request) locks.request("studio-update", { ifAvailable: true }, (lock: unknown) => (lock ? run() : (removeEventListener("beforeunload", guard), set({ running: false, step: "" }), undefined))).catch(() => run());
    else run();
  },
  clearError: () => set({ err: "" }),
};
export function useStudioUpdate(): StudioUpdateState {
  const [, bump] = useState(0);
  useEffect(() => { const f = () => bump((n) => n + 1); subs.add(f); return () => { subs.delete(f); }; }, []);
  return state;
}
