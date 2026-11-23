// Choices that used to live only in one browser (the Explorer helper, the Studio's auto-update, the editor's menu
// style) now also live in the Studio's own data (studio.json → prefs), so every signed-in device shows the same.
// Each choice is still written to this browser first (instant, works offline) and then saved to the Studio a moment
// later; when the Studio loads, what it holds is applied here.

export type SyncedPrefs = {
  explorer?: { on?: boolean; min?: boolean; corner?: "right" | "left"; content?: boolean; keys?: boolean };
  autoUpdate?: boolean;
  nav?: { view?: "drawer" | "list"; wide?: boolean; fold?: string[] };
  /** The guided tour (Settings → Help) is on. */
  tour?: boolean;
  /** Projects and tiles whose private payment marker is hidden. */
  payHidden?: string[];
  /** Click-to-edit in the preview is on. */
  clickToEdit?: boolean;
};

/** Only the choices this file knows about, in their right shapes (what is kept when the Studio's data is read). */
export function cleanPrefs(p: any): SyncedPrefs {
  const o: SyncedPrefs = {}; if (!p || typeof p !== "object") return o;
  if (p.explorer && typeof p.explorer === "object") { const e: any = {}; for (const k of ["on", "min", "content", "keys"]) if (typeof p.explorer[k] === "boolean") e[k] = p.explorer[k]; if (p.explorer.corner === "left" || p.explorer.corner === "right") e.corner = p.explorer.corner; if (Object.keys(e).length) o.explorer = e; }
  if (typeof p.autoUpdate === "boolean") o.autoUpdate = p.autoUpdate;
  if (p.nav && typeof p.nav === "object") { const n: any = {}; if (p.nav.view === "drawer" || p.nav.view === "list") n.view = p.nav.view; if (typeof p.nav.wide === "boolean") n.wide = p.nav.wide; if (Array.isArray(p.nav.fold)) n.fold = p.nav.fold.filter((x: any) => typeof x === "string").slice(0, 40); if (Object.keys(n).length) o.nav = n; }
  if (typeof p.tour === "boolean") o.tour = p.tour;
  if (Array.isArray(p.payHidden)) o.payHidden = p.payHidden.filter((x: any) => typeof x === "string").slice(-300);
  if (typeof p.clickToEdit === "boolean") o.clickToEdit = p.clickToEdit;
  return o;
}

type Sink = (patch: SyncedPrefs) => Promise<unknown>;
let sink: Sink | null = null, pending: SyncedPrefs = {}, timer: ReturnType<typeof setTimeout> | undefined;

/** The Studio screen that can save the choices (set while it is open). */
export const prefSync = {
  /** Choices made here that the Studio doesn't hold yet. */
  waiting: () => Object.keys(pending).length > 0,
  attach(f: Sink | null) { sink = f; if (f && Object.keys(pending).length) flush(); },
};

export function mergePrefs(a: SyncedPrefs, b: SyncedPrefs): SyncedPrefs { return merge(a, b); }
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

const KEYS = { tour: "site-admin-tour", pay: "site-studio:pay-hidden", edit: "site-studio:click-to-edit", explorer: "studio-explorer", auto: "site-studio:auto-update", view: "studio-nav", wide: "studio-nav-wide", fold: "studio-menu-fold" };
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
  if (typeof p.tour === "boolean") { put(KEYS.tour, p.tour ? "on" : "off"); dispatchEvent(new CustomEvent("site-admin:tour", { detail: { on: p.tour } })); }
  if (Array.isArray(p.payHidden)) { put(KEYS.pay, JSON.stringify(p.payHidden.filter((x) => typeof x === "string").slice(-500))); dispatchEvent(new Event("studio:pay-hidden")); }
  if (typeof p.clickToEdit === "boolean") put(KEYS.edit, p.clickToEdit ? "on" : "off");
  if (p.nav) {
    if (p.nav.view === "drawer" || p.nav.view === "list") put(KEYS.view, p.nav.view);
    if (typeof p.nav.wide === "boolean") put(KEYS.wide, p.nav.wide ? "1" : "0");
    if (Array.isArray(p.nav.fold)) put(KEYS.fold, JSON.stringify(p.nav.fold.filter((x) => typeof x === "string").slice(0, 40)));
  }
}
