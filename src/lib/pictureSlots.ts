// Where a picture taken from the owner's old site can go in each kind of site (Write text from a site → Pictures).
export type Slot = { id: string; label: string; many?: boolean; /** A heading in the list: "A dish on the menu", "A product". */ group?: string };
const low = (v: unknown) => String(v ?? "").trim().toLowerCase();
/** The dishes (restaurant) or products (shop) of the site, as places a picture can go. A dish holds one picture, a product many. */
export function itemSlots(kind: string, c: any): Slot[] {
  const out: Slot[] = [], seen = new Set<string>();
  if (kind === "restaurant") for (const k of (Array.isArray(c?.food?.categories) ? c.food.categories : [])) for (const d of (Array.isArray(k?.items) ? k.items : [])) { const n = String(d?.name || "").trim(); if (!n || seen.has(low(n))) continue; seen.add(low(n)); out.push({ id: "dish:" + n, label: n, group: "A dish on the menu (Menu and Order now)" }); }
  if (kind === "store") for (const p of (Array.isArray(c?.products) ? c.products : [])) { const n = String(p?.name || "").trim(), id = String(p?.id || ""); if (!n || !id || seen.has(id)) continue; seen.add(id); out.push({ id: "product:" + id, label: n, many: true, group: "A product" }); }
  return out.slice(0, 400);
}
export function pictureSlots(kind: string): Slot[] {
  if (kind === "restaurant") return [{ id: "hero", label: "Hero picture" }, { id: "about", label: "Our story picture" }, { id: "logo", label: "Logo" }, { id: "gallery", label: "Gallery", many: true }];
  if (kind === "business") return [{ id: "hero", label: "Hero picture" }, { id: "about", label: "About picture" }, { id: "logo", label: "Logo" }];
  if (kind === "store") return [{ id: "hero", label: "Home page picture" }, { id: "banner", label: "Banner picture" }, { id: "logo", label: "Logo" }];
  return [{ id: "hero", label: "Hero picture" }, { id: "logo", label: "Logo" }];
}
/** Puts an uploaded picture ({ path }) in its place. Changes `c`. */
export function placePicture(kind: string, c: any, slot: string, img: { path: string }, alt = ""): void {
  const set = (o: any, k: string) => { o[k] = img; };
  // a dish's own picture (shown on the Menu and on Order now), or one more photo of a product
  if (slot.startsWith("dish:")) { const want = low(slot.slice(5)); for (const k of (c.food?.categories || [])) for (const d of (k?.items || [])) if (low(d?.name) === want) { d.image = img; c.food.photos = true; return; } placePicture(kind, c, "gallery", img, alt); return; }
  if (slot.startsWith("product:")) { const id = slot.slice(8), pr = (c.products || []).find((x: any) => String(x?.id) === id); if (pr) (pr.images = Array.isArray(pr.images) ? pr.images : []).push(img); return; }
  if (slot === "logo") { c.brand ||= {}; set(c.brand, kind === "portfolio" ? "icon" : "logo"); return; }
  if (kind === "store") { c.home ||= {}; if (slot === "hero") { c.home.hero ||= {}; set(c.home.hero, "image"); } else if (slot === "banner") { c.home.banner ||= {}; set(c.home.banner, "image"); } return; }
  if (kind === "portfolio") { if (slot === "hero") { c.hero ||= {}; set(c.hero, "discImage"); } return; }
  if (slot === "hero") { c.hero ||= {}; set(c.hero, "image"); }
  else if (slot === "about") { c.about ||= {}; set(c.about, "image"); }
  else if (slot === "gallery" && kind === "restaurant") { c.gallery ||= {}; (c.gallery.items ||= []).push({ image: img, caption: alt }); const s = (c.sections || []).find((x: any) => x.id === "gallery"); if (s) s.show = true; }
}
