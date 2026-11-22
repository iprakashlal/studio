// Choices that used to live only in one browser (the Explorer helper, the Studio's auto-update, the editor's menu
// style) now also live in the Studio's own data (studio.json → prefs), so every signed-in device shows the same.
// Each choice is still written to this browser first (instant, works offline) and then saved to the Studio a moment
// later; when the Studio loads, what it holds is applied here.

export type SyncedPrefs = {
  explorer?: { on?: boolean; min?: boolean; corner?: "right" | "left"; content?: boolean; keys?: boolean };
  autoUpdate?: boolean;
  nav?: { view?: "drawer" | "list"; wide?: boolean; fold?: string[] };
};

type Sink = (patch: SyncedPrefs) => Promise<unknown>;
let sink: Sink | null = null, pending: SyncedPrefs = {}, timer: ReturnType<typeof setTimeout> | undefined;

/** The Studio screen that can save the choices (set while it is open). */
export const prefSync = {
  /** Choices made here that the Studio doesn't hold yet. */
  waiting: () => Object.keys(pending).length > 0,
  attach(f: Sink | null) { sink = f; if (f && Object.keys(pending).length) flush(); },
};

function merge(a: SyncedPrefs, b: SyncedPrefs): SyncedPrefs {
  return { ...a, ...b, ...(a.explorer || b.explorer ? { explorer: { ...a.explorer, ...b.explorer } } : {}), ...(a.nav || b.nav ? { nav: { ...a.nav, ...b.nav } } : {}) };
}
function flush() {
  if (!sink || !Object.keys(pending).length) return;
  const p = pending; pending = {};
  sink(p).catch(() => { pending = merge(p, pending); /* kept here; saved with the next change */ });
}
/** Save a choice to the Studio too (a moment after the last change, so dragging or clicking quickly saves once). */
export function pushPref(p: SyncedPrefs) {
  pending = merge(pending, p); clearTimeout(timer); timer = setTimeout(flush, 800);
}

const KEYS = { explorer: "studio-explorer", auto: "site-studio:auto-update", view: "studio-nav", wide: "studio-nav-wide", fold: "studio-menu-fold" };
const put = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

/** What the Studio holds becomes this browser's choice (called when the Studio's data loads). */
export function applyPrefs(p: SyncedPrefs | undefined) {
  if (!p || typeof p !== "object" || prefSync.waiting()) return;
  if (p.explorer && typeof p.explorer === "object") {
    let cur: any = {}; try { cur = JSON.parse(localStorage.getItem(KEYS.explorer) || "{}") || {}; } catch { /* none */ }
    const n = { ...cur, ...p.explorer }; put(KEYS.explorer, JSON.stringify(n));
    dispatchEvent(new CustomEvent("studio:explorer", { detail: undefined }));
  }
  if (typeof p.autoUpdate === "boolean") put(KEYS.auto, p.autoUpdate ? "on" : "off");
  if (p.nav) {
    if (p.nav.view === "drawer" || p.nav.view === "list") put(KEYS.view, p.nav.view);
    if (typeof p.nav.wide === "boolean") put(KEYS.wide, p.nav.wide ? "1" : "0");
    if (Array.isArray(p.nav.fold)) put(KEYS.fold, JSON.stringify(p.nav.fold.filter((x) => typeof x === "string").slice(0, 40)));
  }
}
