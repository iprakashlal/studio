// A client Studio can be limited to chosen themes for each type of site (set by its Studio Partner), or, in older
// setups, to the first N themes of each template.
// (Remembered for the tab, so the Themes gallery opened on its own follows it too.)
const KEY = "site-studio:theme-limit", KEY2 = "site-studio:theme-allow";
let limit = (() => { try { return Math.max(0, Math.floor(+(sessionStorage.getItem(KEY) || 0))) || 0; } catch { return 0; } })();
let allow: Record<string, string[]> = (() => { try { const j = JSON.parse(sessionStorage.getItem(KEY2) || "null"); return j && typeof j === "object" ? j : {}; } catch { return {}; } })();
export const setThemeLimit = (n: number | undefined) => { limit = n && n > 0 ? Math.floor(n) : 0; try { limit ? sessionStorage.setItem(KEY, String(limit)) : sessionStorage.removeItem(KEY); } catch { /* private mode */ } };
/** The themes allowed for each type ({ portfolio: [ids], store: [ids], business: [ids] }); a type left out allows all. */
export const setThemeAllow = (m: Record<string, string[]> | undefined) => { allow = m && typeof m === "object" ? m : {}; try { Object.keys(allow).length ? sessionStorage.setItem(KEY2, JSON.stringify(allow)) : sessionStorage.removeItem(KEY2); } catch { /* private mode */ } };
export const themeLimit = () => limit;
/** The themes on offer for a type of site: the chosen ones (else the first N), plus the one in use so it never disappears. */
export const limitThemes = <T extends { id: string }>(all: T[], keep?: string, kind?: string): T[] => {
  const list = kind ? allow[kind] : undefined;
  if (Array.isArray(list) && list.length) { const ok = new Set(list); return all.filter((t) => ok.has(t.id) || t.id === keep); }
  return !limit ? all : all.filter((t, i) => i < limit || t.id === keep);
};

/** { portfolio: [theme ids], store: […], business: […] }, with empty and odd entries dropped. */
export const cleanThemeList = (x: any): Record<string, string[]> => {
  const out: Record<string, string[]> = {};
  for (const k of ["portfolio", "store", "business"]) { const l = Array.isArray(x?.[k]) ? [...new Set(x[k].filter((id: any) => typeof id === "string" && /^[\w-]{1,60}$/.test(id)))].slice(0, 400) as string[] : []; if (l.length) out[k] = l; }
  return out;
};
