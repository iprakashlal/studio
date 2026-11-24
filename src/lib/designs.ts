// "Design yourself": the previews people have made, and the page's own settings (on/off, where requests go).
// Signed in, previews live in the Studio (studio.json → designs) and show in Projects → Design previews; without
// signing in they stay on this device. Only the answers are kept: the preview is rebuilt from them.

/** The words written for a design (by the Studio's AI engine or the Picaffectz system): a summary for each topic the person gave. */
export type Copy = { tagline?: string; hero_text?: string; about_text?: string; cta_text?: string; items?: { name: string; text: string }[]; faq?: { q: string; a: string }[] };
export type DesignRec = { id: string; name: string; kind: string; themeId: string; themeName: string; answers: Record<string, string>; createdAt: string; summary?: string; copy?: Copy; /** A small logo (data URL), when one was added. */ logo?: string };
export type DesignSettings = { on?: boolean };

const LS = "site-studio:designs", SET = "site-studio:design-page";
const str = (x: any, n: number) => (typeof x === "string" ? x.slice(0, n) : "");

export function cleanDesigns(x: any): DesignRec[] {
  return (Array.isArray(x) ? x : []).filter((d) => d && typeof d.id === "string" && d.answers && typeof d.answers === "object").slice(0, 200).map((d) => ({
    id: str(d.id, 40), name: str(d.name, 120), kind: str(d.kind, 20), themeId: str(d.themeId, 60), themeName: str(d.themeName, 80), createdAt: str(d.createdAt, 40), summary: str(d.summary, 300), ...(d.copy ? { copy: cleanCopy(d.copy) } : {}), ...(typeof d.logo === "string" && /^data:image\/(png|jpeg|webp);base64,/.test(d.logo) && d.logo.length < 60000 ? { logo: d.logo } : {}),
    answers: Object.fromEntries(Object.entries(d.answers).filter(([k, v]) => /^[a-z]{1,20}$/.test(k) && typeof v === "string").map(([k, v]) => [k, (v as string).slice(0, 1200)])),
  }));
}
export function cleanDesignSettings(x: any): DesignSettings {
  const o: DesignSettings = {}; if (!x || typeof x !== "object") return o;
  if (typeof x.on === "boolean") o.on = x.on;
  return o;
}
export function cleanCopy(c: any): Copy {
  const o: Copy = {}; if (!c || typeof c !== "object") return o;
  for (const k of ["tagline", "hero_text", "about_text", "cta_text"] as const) if (typeof c[k] === "string" && c[k].trim()) o[k] = c[k].trim().slice(0, 900);
  if (Array.isArray(c.items)) o.items = c.items.slice(0, 12).filter((i: any) => i && typeof i.name === "string").map((i: any) => ({ name: str(i.name, 120), text: str(i.text, 260) }));
  if (Array.isArray(c.faq)) o.faq = c.faq.slice(0, 6).filter((i: any) => i && typeof i.q === "string" && typeof i.a === "string").map((i: any) => ({ q: str(i.q, 160), a: str(i.a, 420) }));
  return o;
}
export const readDesignSettings = (): DesignSettings => { try { return cleanDesignSettings(JSON.parse(localStorage.getItem(SET) || "{}")); } catch { return {}; } };
export const writeDesignSettings = (s: DesignSettings) => { try { localStorage.setItem(SET, JSON.stringify(s)); dispatchEvent(new Event("studio:design-page")); } catch { /* private mode */ } };
/** Is the Design yourself page on? (On unless the Studio's owner turned it off.) */
export const designPageOn = () => readDesignSettings().on !== false;

export const readLocalDesigns = (): DesignRec[] => { try { return cleanDesigns(JSON.parse(localStorage.getItem(LS) || "[]")); } catch { return []; } };
export const writeLocalDesigns = (l: DesignRec[]) => { try { localStorage.setItem(LS, JSON.stringify(l)); } catch { /* private mode */ } };
export const newDesignId = () => "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
