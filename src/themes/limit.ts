// A client Studio can be limited to the first N themes of each template (set by its Studio Partner).
// (Remembered for the tab, so the Themes gallery opened on its own follows it too.)
const KEY = "site-studio:theme-limit";
let limit = (() => { try { return Math.max(0, Math.floor(+(sessionStorage.getItem(KEY) || 0))) || 0; } catch { return 0; } })();
export const setThemeLimit = (n: number | undefined) => { limit = n && n > 0 ? Math.floor(n) : 0; try { limit ? sessionStorage.setItem(KEY, String(limit)) : sessionStorage.removeItem(KEY); } catch { /* private mode */ } };
export const themeLimit = () => limit;
/** The themes on offer: the first N, plus the one in use so it never disappears. */
export const limitThemes = <T extends { id: string }>(all: T[], keep?: string): T[] => (!limit ? all : all.filter((t, i) => i < limit || t.id === keep));
