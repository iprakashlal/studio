import { useEffect, useState } from "react";
// "Design yourself": the previews people have made, and the page's own settings (on/off, where requests go).
// Signed in, previews live in the Studio (studio.json → designs) and show in Projects → Design previews; without
// signing in they stay on this device. Only the answers are kept: the preview is rebuilt from them.

/** The words written for a design (by the Studio's AI engine or the Picaffectz system): a summary for each topic the person gave. */
export type Copy = { tagline?: string; hero_text?: string; about_text?: string; services_text?: string; work_text?: string; cta_text?: string; items?: { name: string; text: string }[]; faq?: { q: string; a: string }[] };
export type DesignRec = { id: string; name: string; kind: string; themeId: string; themeName: string; answers: Record<string, string>; createdAt: string; summary?: string; copy?: Copy; /** A small logo (data URL), when one was added. */ logo?: string };
import { cleanAi, cleanDomain, cleanGallery, cleanLook, cleanThemes, type DesignSettings } from "./designlook";
export type { DesignSettings };

const LS = "site-studio:designs", SET = "site-studio:design-page";
const str = (x: any, n: number) => (typeof x === "string" ? x.slice(0, n) : "");

export function cleanDesigns(x: any): DesignRec[] {
  return (Array.isArray(x) ? x : []).filter((d) => d && typeof d.id === "string" && d.answers && typeof d.answers === "object").slice(0, 200).map((d) => ({
    id: str(d.id, 40), name: str(d.name, 120), kind: str(d.kind, 20), themeId: str(d.themeId, 60), themeName: str(d.themeName, 80), createdAt: str(d.createdAt, 40), summary: str(d.summary, 300), ...(d.copy ? { copy: cleanCopy(d.copy) } : {}), ...(typeof d.logo === "string" && /^data:image\/(png|jpeg|webp);base64,/.test(d.logo) && d.logo.length < 60000 ? { logo: d.logo } : {}),
    answers: Object.fromEntries(Object.entries(d.answers).filter(([k, v]) => /^[a-z]{1,20}$/.test(k) && typeof v === "string").map(([k, v]) => [k, (v as string).slice(0, 3000)])),
  }));
}
export function cleanDesignSettings(x: any): DesignSettings {
  const o: DesignSettings = {}; if (!x || typeof x !== "object") return o;
  if (typeof x.on === "boolean") o.on = x.on;
  if (typeof x.pick === "boolean") o.pick = x.pick;
  const ai = cleanAi(x.ai); if (ai) o.ai = ai;
  const dm = cleanDomain(x.domain); if (dm) o.domain = dm;
  const ga = cleanGallery(x.gallery); if (ga) o.gallery = ga;
  const th = cleanThemes(x.themes); if (Object.keys(th).length) o.themes = th;
  if (x.images && typeof x.images === "object") { const im: NonNullable<DesignSettings["images"]> = {}; if (x.images.on === true) im.on = true; if (["photo", "illustration", "3d", "flat"].includes(x.images.style)) im.style = x.images.style; if (x.images.source === "engine") im.source = "engine"; if (Object.keys(im).length) o.images = im; }
  if (x.adminAi === false) o.adminAi = false;
  if (x.notice && typeof x.notice === "object") { const n: NonNullable<DesignSettings["notice"]> = {}; if (x.notice.on === false) n.on = false; const t = typeof x.notice.text === "string" ? x.notice.text.replace(/[<>]/g, "").trim().slice(0, 400) : ""; if (t) n.text = t; if (Object.keys(n).length) o.notice = n; }
  if (x.chat && typeof x.chat === "object") {
    const c: NonNullable<DesignSettings["chat"]> = {}, hex = (v: any) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : "");
    for (const k of ["you", "bot", "page"] as const) if (hex(x.chat[k])) c[k] = hex(x.chat[k]);
    const im = x.chat.image; if (typeof im === "string" && im.length <= 100_000 && /^(data:image\/(jpeg|webp|png);base64,[A-Za-z0-9+/=]+|https:\/\/[^\s<>"']{3,400})$/.test(im)) c.image = im;
    if (Number.isFinite(+x.chat.dim) && +x.chat.dim > 0) c.dim = Math.min(80, Math.round(+x.chat.dim));
    if (Object.keys(c).length) o.chat = c;
  }
  if (x.carousel && typeof x.carousel === "object") { const c: NonNullable<DesignSettings["carousel"]> = {}; for (const k of ["portfolio", "store", "business", "restaurant"] as const) if (x.carousel[k] === "custom") c[k] = "custom"; if (Object.keys(c).length) o.carousel = c; }
  if (x.questions && typeof x.questions === "object") {
    const q: NonNullable<DesignSettings["questions"]> = {}, tx = (v: any, n: number) => (typeof v === "string" ? v.replace(/[<>]/g, "").trim().slice(0, n) : "");
    for (const g of ["basics", "portfolio", "store", "business", "restaurant"]) {
      const src = x.questions[g]; if (!src || typeof src !== "object") continue;
      const rules: Record<string, { h?: boolean; t?: string; p?: string }> = {};
      for (const id of Object.keys(src).slice(0, 80)) { if (!/^[a-z]{1,20}$/.test(id)) continue; const r = src[id] || {}, o: { h?: boolean; t?: string; p?: string } = {}; if (r.h === true) o.h = true; if (tx(r.t, 300)) o.t = tx(r.t, 300); if (tx(r.p, 300)) o.p = tx(r.p, 300); if (Object.keys(o).length) rules[id] = o; }
      if (Object.keys(rules).length) q[g] = rules;
    }
    if (Object.keys(q).length) o.questions = q;
  }
  const look = cleanLook(x.look); if (Object.keys(look).length) o.look = look;
  return o;
}
export function cleanCopy(c: any): Copy {
  const o: Copy = {}; if (!c || typeof c !== "object") return o;
  for (const k of ["tagline", "hero_text", "about_text", "services_text", "work_text", "cta_text"] as const) if (typeof c[k] === "string" && c[k].trim()) o[k] = c[k].trim().slice(0, 900);
  if (Array.isArray(c.items)) o.items = c.items.slice(0, 12).filter((i: any) => i && typeof i.name === "string").map((i: any) => ({ name: str(i.name, 120), text: str(i.text, 260) }));
  if (Array.isArray(c.faq)) o.faq = c.faq.slice(0, 6).filter((i: any) => i && typeof i.q === "string" && typeof i.a === "string").map((i: any) => ({ q: str(i.q, 160), a: str(i.a, 420) }));
  return o;
}
let setRaw: string | null = null, setVal: DesignSettings = {};
export const readDesignSettings = (): DesignSettings => { try { const raw = localStorage.getItem(SET) || "{}"; if (raw !== setRaw) { setVal = cleanDesignSettings(JSON.parse(raw)); setRaw = raw; } return setVal; } catch { return {}; } };
export const writeDesignSettings = (s: DesignSettings) => { try { localStorage.setItem(SET, JSON.stringify(s)); dispatchEvent(new Event("studio:design-page")); } catch { /* private mode */ } };
/** Is the Design yourself page on? (On unless the Studio's owner turned it off.) */
export const designPageOn = () => readDesignSettings().on !== false;

export const readLocalDesigns = (): DesignRec[] => { try { return cleanDesigns(JSON.parse(localStorage.getItem(LS) || "[]")); } catch { return []; } };
export const writeLocalDesigns = (l: DesignRec[]) => { try { localStorage.setItem(LS, JSON.stringify(l)); } catch { /* private mode */ } };
export const newDesignId = () => "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/** The owner's design settings, kept fresh when they change (Settings, or a signed-out page loading them). */
export function useDesignSettings(): DesignSettings {
  const [s, setS] = useState<DesignSettings>(readDesignSettings);
  useEffect(() => { const f = () => setS(readDesignSettings()); addEventListener("studio:design-page", f); return () => removeEventListener("studio:design-page", f); }, []);
  return s;
}
