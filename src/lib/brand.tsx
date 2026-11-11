// The Studio's own name and logo (Settings → Studio name & logo). Saved in the data repository's
// studio.json so every signed-in device gets them, and remembered in this browser so the sign-in
// screen and the public theme gallery show them too.

import { useEffect, useState, type ReactNode } from "react";
import { basePath } from "./util";

export const DEFAULT_NAME = "Picaffectz Studio";
export type Brand = { name: string; logo: string /* small data: URL, or "" */; v?: number };

const KEY = () => "studio-brand:" + basePath();
function load(): Brand {
  try { const b = JSON.parse(localStorage.getItem(KEY()) || "null"); if (b && typeof b.name === "string") return { name: b.name || DEFAULT_NAME, logo: typeof b.logo === "string" && b.logo.startsWith("data:image/") ? b.logo : "", v: b.v }; } catch { /* ignore */ }
  return { name: DEFAULT_NAME, logo: "" };
}
let cur = load();
const subs = new Set<(b: Brand) => void>();

function applyDoc(b: Brand) {
  let l = document.querySelector<HTMLLinkElement>("link[rel=icon]");
  if (b.logo) { if (!l) { l = document.createElement("link"); l.rel = "icon"; document.head.appendChild(l); } l.href = b.logo; }
  else if (l) l.remove();
}
applyDoc(cur);

export const brand = () => cur;
export function setBrand(b: Partial<Brand>) {
  cur = { name: (b.name ?? cur.name).trim() || DEFAULT_NAME, logo: b.logo ?? cur.logo, v: b.v ?? cur.v };
  try { localStorage.setItem(KEY(), JSON.stringify(cur)); } catch { /* private mode: this session only */ }
  applyDoc(cur);
  subs.forEach((f) => f(cur));
}
export function useBrand(): Brand {
  const [b, setB] = useState(cur);
  useEffect(() => { subs.add(setB); return () => { subs.delete(setB); }; }, []);
  return b;
}

/** The Studio logo if one is set, otherwise `fallback` (the three shapes). */
export function BrandMark({ fallback, size = 26 }: { fallback: ReactNode; size?: number }) {
  const b = useBrand();
  return b.logo ? <img src={b.logo} alt="" width={size} height={size} className="flex-none rounded-md object-cover" style={{ width: size, height: size }} /> : <>{fallback}</>;
}

/** Squares and shrinks an image file (for the logo): PNG data URL, `px` wide. */
export function shrinkImage(file: Blob, px = 192): Promise<string> {
  return new Promise((ok, no) => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      const c = document.createElement("canvas"); c.width = c.height = px;
      const x = c.getContext("2d")!, s = Math.max(px / im.width, px / im.height);
      x.drawImage(im, (px - im.width * s) / 2, (px - im.height * s) / 2, im.width * s, im.height * s);
      URL.revokeObjectURL(url); ok(c.toDataURL("image/png"));
    };
    im.onerror = () => { URL.revokeObjectURL(url); no(new Error("That file isn't an image this browser can read.")); };
    im.src = url;
  });
}
