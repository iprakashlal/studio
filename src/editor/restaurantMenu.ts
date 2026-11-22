// The restaurant's own admin page lists its sections the way an owner's day goes: what needs attention now (orders,
// bookings, guests), then the menu, then selling online, the website's pages, the details guests look for, the look of
// the site, and the settings last. A custom menu saved for the site (Studio → Menus) still wins over this default.
import type { NavEntry } from "../lib/menus";

/** [id, group, sub?, label?] in the order they are shown inside each heading. */
const LAYOUT: [string, string, string?, string?][] = [
  // Orders & guests: everything that comes in from guests
  ["purchased", "Orders & guests"], ["enquiries", "Orders & guests", undefined, "Table bookings & enquiries"], ["recovery", "Orders & guests"], ["customer-data", "Orders & guests"], ["reviews", "Orders & guests", undefined, "Guest reviews"],
  // Menu & dishes
  ["food", "Menu & dishes", undefined, "Food & drinks menu"], ["specials", "Menu & dishes"], ["offers", "Menu & dishes", undefined, "Offers & set menus"], ["inventory", "Menu & dishes", undefined, "Dish stock"],
  // Online ordering: how a guest orders and pays
  ["ordering", "Online ordering"], ["delivery", "Online ordering"], ["checkout", "Online ordering"], ["payments", "Online ordering"], ["coupons", "Online ordering"], ["users", "Online ordering"], ["orderdelivery", "Online ordering"],
  // Website pages: the home page and its sections
  ["pages", "Website pages"], ["menu", "Website pages"],
  ["hero", "Website pages", "Sections"], ["highlights", "Website pages", "Sections"], ["about", "Website pages", "Sections"], ["events", "Website pages", "Sections"], ["gallery", "Website pages", "Sections"], ["chef", "Website pages", "Sections"], ["testimonials", "Website pages", "Sections", "Guest quotes"], ["press", "Website pages", "Sections"], ["video", "Website pages", "Sections"], ["order", "Website pages", "Sections"], ["faq", "Website pages", "Sections"], ["cta", "Website pages", "Sections"],
  ["static-pages", "Website pages"],
  // Hours & contact: what guests look for first
  ["hours", "Hours & contact"], ["contact", "Hours & contact"], ["forms", "Hours & contact"], ["social", "Hours & contact"], ["footer", "Hours & contact"],
  // Look & feel
  ["look", "Look & feel"], ["brand", "Look & feel"], ["festival", "Look & feel"],
  // Email & chat
  ["emails", "Email & chat"], ["features", "Email & chat"],
  // Settings
  ["languages", "Settings"], ["seo", "Settings"], ["consent", "Settings"], ["legal", "Settings"], ["cms", "Settings"], ["people", "Settings"], ["connections", "Settings"], ["backup", "Settings"], ["account", "Settings"], ["code", "Settings"],
];
export const RESTAURANT_GROUPS = ["Orders & guests", "Menu & dishes", "Online ordering", "Website pages", "Hours & contact", "Look & feel", "Email & chat", "Settings"];

export function restaurantLayout(nav: NavEntry[]): NavEntry[] {
  const at = new Map(LAYOUT.map((x, i) => [x[0], i]));
  const out = nav.map((e) => { const L = LAYOUT.find((x) => x[0] === e.id); return L ? { ...e, group: L[1], sub: L[2], label: L[3] || e.label } : e; });
  // Anything new that is not placed above keeps its own heading after the known ones, in its old order.
  const rank = (e: NavEntry) => (at.has(e.id) ? at.get(e.id)! : LAYOUT.length + nav.indexOf(nav.find((x) => x.id === e.id)!));
  return out.slice().sort((a, b) => rank(a) - rank(b));
}
