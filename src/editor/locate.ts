// Click-to-edit: from something in the preview (its text or image) to the content path it shows, and from a
// content path to the editor field that edits it (section, open list items, element id).

import type { Category, Field } from "../schema/types";

/** Content keys that hold settings, not words people read on the page. */
const SKIP_KEY = /(^|\.)(theme|velocityTheme|labelsHidden)(\.|$)|(color|colour|shape|type|kind|layout|target|url|href|id|icon|motif|preset|size|rim|radius|align|style|bg|fg|mode)$/i;
/** Compared without spaces, emphasis marks, quotes or dash styles: templates split headings into word and letter
 *  spans (no spaces between them in the page text) and show periods with their own dashes. */
const norm = (s: string) => String(s).replace(/[*“”"‘’']/g, "").replace(/[–—‒−-]/g, "-").replace(/\s+/g, "").toLowerCase();

type Leaf = { path: string; text: string };
type Img = { path: string; key: string };

/** Every readable text value and every image in the content, with its path ("work.items.2.title"). */
export function contentIndex(content: any): { texts: Leaf[]; imgs: Img[] } {
  const texts: Leaf[] = [], imgs: Img[] = [];
  const walk = (v: any, p: string) => {
    if (v == null) return;
    if (typeof v === "string") {
      const last = p.split(".").filter((x) => !/^\d+$/.test(x)).pop() || "";
      if (!SKIP_KEY.test(p) && !SKIP_KEY.test(last) && /[a-z]{2}/i.test(v) && !/^(https?:|mailto:|tel:|#|assets\/)/i.test(v)) texts.push({ path: p, text: norm(v) });
      return;
    }
    if (Array.isArray(v)) { v.forEach((x, i) => walk(x, p ? `${p}.${i}` : String(i))); return; }
    if (typeof v === "object") {
      if (typeof v.path === "string" && /^assets\//.test(v.path)) { imgs.push({ path: p, key: v.path }); return; }
      if (typeof v.url === "string" && Object.keys(v).length <= 3 && /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(v.url)) { imgs.push({ path: p, key: v.url }); return; }
      for (const k of Object.keys(v)) walk(v[k], p ? `${p}.${k}` : k);
    }
  };
  walk(content, "");
  return { texts, imgs };
}

/** The content path a piece of preview text shows: an exact match first, then the longest value it contains. */
export function matchText(idx: ReturnType<typeof contentIndex>, raw: string): string | null {
  const t = norm(raw);
  if (t.length < 2) return null;
  const exact = idx.texts.find((l) => l.text === t);
  if (exact) return exact.path;
  // The element adds a little around the value ("Your Name." or "01 · Senior Designer").
  let best: Leaf | null = null;
  // A small card can hold two values (a skill's line and its details): the larger one wins.
  for (const l of idx.texts) if (l.text.length >= 3 && t.includes(l.text) && t.length <= l.text.length * (t.length < 160 ? 2.6 : 1.6) + 8 && (!best || l.text.length > best.text.length)) best = l;
  if (best) return best.path;
  // The element shows part of a longer value (one paragraph of a story).
  if (t.length >= 20) { const part = idx.texts.find((l) => l.text.includes(t)); if (part) return part.path; }
  return null;
}

/** The content path of an image in the preview, from its src (a blob address for Studio uploads, or the file path). */
export function matchImage(idx: ReturnType<typeof contentIndex>, src: string, assets: Record<string, string>): string | null {
  if (!src) return null;
  const byBlob = Object.entries(assets).find(([, u]) => u === src)?.[0];
  const hit = idx.imgs.find((i) => i.key === byBlob || (i.key && (src === i.key || src.endsWith("/" + i.key) || decodeURIComponent(src).endsWith(i.key))));
  return hit?.path || null;
}

export type FieldLoc = { cat: string; catLabel: string; trail: string[]; domId: string; open: string[] };

const domId = (base: string, path: string) => `f-${base}-${path}`.replace(/[^\w-]/g, "_");

/** Where the editor edits `contentPath`: its section, the list items to open, a readable trail, and the field's id. */
export function locateField(schema: Category[], contentPath: string, content: any): FieldLoc | null {
  for (const cat of schema) {
    if (cat.showIf && !cat.showIf(content)) continue;
    for (const card of cat.cards) {
      const r = inFields(card.fields, contentPath, "", cat.id, content);
      if (r) return { cat: cat.id, catLabel: cat.label, trail: [cat.label, ...(r.trail.length ? r.trail : [card.title])], domId: r.domId, open: r.open };
    }
  }
  return null;
}

function inFields(fields: Field[], cp: string, prefix: string, base: string, content: any): { trail: string[]; domId: string; open: string[] } | null {
  for (const f of fields) {
    if (f.t === "grid" || f.t === "when") { const r = inFields(f.fields, cp, prefix, base, content); if (r) return r; continue; }
    if (!("path" in f)) continue;
    const full = prefix + f.path;
    if (f.t === "list") {
      if (!cp.startsWith(full + ".")) continue;
      const rest = cp.slice(full.length + 1), i = Number(rest.split(".")[0]);
      if (!Number.isInteger(i)) continue;
      const item = full.split(".").reduce((o: any, k) => (o == null ? o : o[k]), content)?.[i];
      const itemBase = `${base}.${f.path}.${i}`, title = (item && f.title(item, i)) || `Item ${i + 1}`;
      const inner = inFields(f.item, cp, `${full}.${i}.`, itemBase, content);
      const openKey = `${base}.${f.path}#${i}`;
      if (inner) return { trail: [title, ...inner.trail], domId: inner.domId, open: [openKey, ...inner.open] };
      return { trail: [title], domId: "", open: [openKey] };
    }
    if (cp === full || cp.startsWith(full + ".")) {
      let id = domId(base, f.path);
      if (f.t === "strings") { const i = Number(cp.slice(full.length + 1).split(".")[0]); if (Number.isInteger(i)) id = `${id}-${i}`; }
      return { trail: "label" in f && f.label ? [f.label] : [], domId: id, open: [] };
    }
  }
  return null;
}
