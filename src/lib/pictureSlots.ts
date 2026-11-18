// Where a picture taken from the owner's old site can go in each kind of site (Write text from a site → Pictures).
export type Slot = { id: string; label: string; many?: boolean };
export function pictureSlots(kind: string): Slot[] {
  if (kind === "restaurant") return [{ id: "hero", label: "Hero picture" }, { id: "about", label: "Our story picture" }, { id: "logo", label: "Logo" }, { id: "gallery", label: "Gallery", many: true }];
  if (kind === "business") return [{ id: "hero", label: "Hero picture" }, { id: "about", label: "About picture" }, { id: "logo", label: "Logo" }];
  if (kind === "store") return [{ id: "hero", label: "Home page picture" }, { id: "banner", label: "Banner picture" }, { id: "logo", label: "Logo" }];
  return [{ id: "hero", label: "Hero picture" }, { id: "logo", label: "Logo" }];
}
/** Puts an uploaded picture ({ path }) in its place. Changes `c`. */
export function placePicture(kind: string, c: any, slot: string, img: { path: string }, alt = ""): void {
  const set = (o: any, k: string) => { o[k] = img; };
  if (slot === "logo") { c.brand ||= {}; set(c.brand, kind === "portfolio" ? "icon" : "logo"); return; }
  if (kind === "store") { c.home ||= {}; if (slot === "hero") { c.home.hero ||= {}; set(c.home.hero, "image"); } else if (slot === "banner") { c.home.banner ||= {}; set(c.home.banner, "image"); } return; }
  if (kind === "portfolio") { if (slot === "hero") { c.hero ||= {}; set(c.hero, "discImage"); } return; }
  if (slot === "hero") { c.hero ||= {}; set(c.hero, "image"); }
  else if (slot === "about") { c.about ||= {}; set(c.about, "image"); }
  else if (slot === "gallery" && kind === "restaurant") { c.gallery ||= {}; (c.gallery.items ||= []).push({ image: img, caption: alt }); const s = (c.sections || []).find((x: any) => x.id === "gallery"); if (s) s.show = true; }
}
