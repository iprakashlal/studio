// Admin menus: the Studio can rename, reorder, regroup and combine the sections of each template's editor
// (Settings → Admin menus). Sites' admin pages get the setting in cms/site.json; the Studio's own editor uses
// it too when "Use in the Studio" is on.
import type { Card, Category } from "../schema/types";

export type MenuItem = { id: string; label?: string; group?: string; into?: string };
export type MenuCfg = { items: MenuItem[]; studio?: boolean };
export type Menus = Record<string, MenuCfg>;

const txt = (v: unknown, n = 40) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
export function cleanMenu(m: any): MenuCfg | undefined {
  if (!m || !Array.isArray(m.items)) return undefined;
  const seen = new Set<string>();
  const items = m.items.map((x: any) => ({ id: txt(x?.id, 60), ...(txt(x?.label) ? { label: txt(x.label) } : {}), ...(txt(x?.group, 30) ? { group: txt(x.group, 30) } : {}), ...(txt(x?.into, 60) ? { into: txt(x.into, 60) } : {}) }))
    .filter((x: MenuItem) => /^[\w-]+$/.test(x.id) && !seen.has(x.id) && seen.add(x.id));
  return { items, ...(m.studio ? { studio: true } : {}) };
}
export function cleanMenus(m: any): Menus {
  const out: Menus = {};
  for (const [k, v] of Object.entries(m && typeof m === "object" ? m : {})) { const c = cleanMenu(v); if (/^[\w-]+$/.test(k) && c && c.items.length) out[k] = c; }
  return out;
}

let current: Menus = {};
export const currentMenus = () => current;
export const setCurrentMenus = (m: any) => { current = cleanMenus(m); };

/** A short fingerprint of one template's menu, kept in cms/site.json so Push updates can tell it changed. */
export function menuVersion(m?: MenuCfg): string {
  const s = JSON.stringify(m || null); let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}

export type NavEntry = { id: string; label: string; group: string; desc: string; cards: { card: Card; cat: string }[]; extra: boolean; from: string[] };

/** The editor's menu: the template's sections (and extra panels) after renaming, regrouping, ordering and
 *  combining. A combined section's cards move into the section it was combined into; extras can't combine. */
export function applyMenu(cats: Category[], extras: { id: string; label: string; group: string; desc: string }[], m?: MenuCfg): NavEntry[] {
  const base: NavEntry[] = [
    ...cats.map((c) => ({ id: c.id, label: c.label, group: c.group, desc: c.desc, cards: c.cards.map((card) => ({ card, cat: c.id })), extra: false, from: [c.id] })),
    ...extras.map((e) => ({ id: e.id, label: e.label, group: e.group, desc: e.desc, cards: [], extra: true, from: [e.id] })),
  ];
  if (!m?.items?.length) return base;
  const conf = new Map(m.items.map((x) => [x.id, x]));
  const pos = new Map(m.items.map((x, i) => [x.id, i]));
  // Order: items the setting lists, in its order; anything newer keeps its place after the item before it.
  const ordered: NavEntry[] = [];
  const listed = base.filter((e) => pos.has(e.id)).sort((a, b) => pos.get(a.id)! - pos.get(b.id)!);
  const rest = base.filter((e) => !pos.has(e.id));
  ordered.push(...listed);
  for (const e of rest) { const i = base.indexOf(e), prev = base.slice(0, i).reverse().find((x) => ordered.includes(x)); ordered.splice(prev ? ordered.indexOf(prev) + 1 : 0, 0, e); }
  for (const e of ordered) { const c = conf.get(e.id); if (c?.label) e.label = c.label; if (c?.group) e.group = c.group; }
  // Combine (one level; never into itself, an extra, or a section that is itself combined away).
  const byId = new Map(ordered.map((e) => [e.id, e]));
  const gone = new Set<string>();
  for (const e of ordered) {
    const into = conf.get(e.id)?.into, t = into ? byId.get(into) : undefined;
    if (!t || e.extra || t.extra || t === e || conf.get(t.id)?.into && byId.has(conf.get(t.id)!.into!)) continue;
    t.cards.push(...e.cards); t.from.push(e.id); gone.add(e.id);
  }
  return ordered.filter((e) => !gone.has(e.id));
}
