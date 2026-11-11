// Settings both templates share: where the site's own CMS lives.
import type { Category } from "./types";

/** Page names a site already uses, so the admin page can't take them. */
const RESERVED = ["index", "404", "shop", "product", "cart", "checkout", "portfolio", "policies", "account", "content", "readme", "assets", "cms"];

/** "My Admin!" → "my-admin". Empty or unusable names fall back to "admin". */
export function adminSlug(raw: unknown): string {
  const s = String(raw ?? "").trim().toLowerCase().replace(/\.html?$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return s.length >= 2 && !RESERVED.includes(s) ? s : "admin";
}
/** The admin page's file name for this content, e.g. "admin.html". */
export const adminFile = (content: any) => adminSlug(content?.cms?.adminPage) + ".html";

export function adminCategory(): Category {
  return {
    id: "cms", label: "Admin page", group: "Settings", desc: "The address of this site's own editor (the CMS).",
    cards: [{ title: "Admin page address", fields: [
      { t: "text", path: "cms.adminPage", label: "Admin page name", ph: "admin", show: (v) => `Opens at yoursite/${adminSlug(v)} after you publish. Letters, numbers and dashes; spaces become dashes.` },
      { t: "note", text: "A less obvious name keeps casual visitors away from the sign-in screen. It isn't a password: the editor still needs your GitHub token. After you publish a new name, the old address stops working, so bookmark the new one." },
      { t: "note", text: "Names the site already uses (index, shop, cart, checkout, portfolio, account…) aren't allowed and fall back to admin.", tone: "warn" },
    ] }],
  };
}
