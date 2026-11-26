// The admin menus (the Studio's editor and each site's own admin page) list their sections the way the owner works:
// what needs attention now first, then the content, then selling, the look of the site, and the settings last.
// A custom menu saved for the project or site (Studio → Menus) still wins over these defaults.
import type { NavEntry } from "../lib/menus";

type Row = [id: string, group: string, sub?: string, label?: string];
export type MenuLayout = { groups: string[]; rows: Row[] };
/** In the order they are shown inside each heading. */
const RESTAURANT: Row[] = [
  // Orders & guests: everything that comes in from guests
  ["purchased", "Orders & guests"], ["enquiries", "Orders & guests", undefined, "Table bookings & enquiries"], ["recovery", "Orders & guests"], ["customer-data", "Orders & guests"], ["reviews", "Orders & guests", undefined, "Guest reviews"],
  // Menu & dishes
  ["food", "Menu & dishes", undefined, "Food & drinks menu"], ["specials", "Menu & dishes"], ["offers", "Menu & dishes", undefined, "Offers & set menus"], ["inventory", "Menu & dishes", undefined, "Dish stock"],
  // Online ordering: how a guest orders and pays
  ["ordering", "Online ordering"], ["delivery", "Online ordering"], ["checkout", "Online ordering"], ["payments", "Online ordering"], ["coupons", "Online ordering"], ["users", "Online ordering"], ["orderdelivery", "Online ordering"],
  // Website pages: the home page and its sections
  ["pages", "Website pages"], ["menu", "Website pages"],
  ["hero", "Website pages", "Sections"], ["highlights", "Website pages", "Sections"], ["about", "Website pages", "Sections"], ["gallery", "Website pages", "Sections"], ["chef", "Website pages", "Sections"], ["events", "Website pages", "Sections"], ["press", "Website pages", "Sections"], ["testimonials", "Website pages", "Sections", "Guest quotes & dish reviews"], ["video", "Website pages", "Sections"], ["wall", "Website pages", "Sections"], ["order", "Website pages", "Sections", "Order links"], ["faq", "Website pages", "Sections"], ["cta", "Website pages", "Sections"],
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

const STORE: Row[] = [
  // Orders & customers: everything that comes in from shoppers
  ["purchased", "Orders & customers"], ["recovery", "Orders & customers"], ["customer-data", "Orders & customers"], ["reviews", "Orders & customers", undefined, "Product reviews"], ["warranty-records", "Orders & customers"], ["warranty", "Orders & customers", undefined, "Warranty & status settings"],
  // Products & stock
  ["products", "Products & stock"], ["categories", "Products & stock"], ["inventory", "Products & stock", undefined, "Stock"],
  // Selling & checkout: how a shopper pays and gets it
  ["pricing", "Selling & checkout"], ["delivery", "Selling & checkout"], ["checkout", "Selling & checkout"], ["payments", "Selling & checkout"], ["gst", "Selling & checkout"], ["users", "Selling & checkout"], ["orders", "Selling & checkout"], ["connections", "Selling & checkout"],
  // Website pages
  ["home", "Website pages"], ["shop", "Website pages"], ["portfolio", "Website pages"], ["video", "Website pages"], ["wall", "Website pages"], ["nav", "Website pages"], ["menu", "Website pages"], ["static-pages", "Website pages"],
  // Contact & policies
  ["contact", "Contact & policies"], ["social", "Contact & policies"],
  // Look & feel
  ["look", "Look & feel"], ["theme", "Look & feel"], ["festival", "Look & feel"],
  // Email & chat
  ["emails", "Email & chat"], ["features", "Email & chat"],
  // Settings
  ["languages", "Settings"], ["seo", "Settings"], ["consent", "Settings"], ["legal", "Settings"], ["cms", "Settings"], ["people", "Settings"], ["backup", "Settings"], ["account", "Settings"], ["code", "Settings"],
];
const PORTFOLIO: Row[] = [
  // Portfolio content: what visitors came to see, in the order it is on the page
  ["linkedin", "Portfolio content", undefined, "Import from LinkedIn"], ["hero", "Portfolio content"], ["about", "Portfolio content"], ["skills", "Portfolio content"], ["work", "Portfolio content"], ["projects", "Portfolio content"], ["learning", "Portfolio content"], ["extras", "Portfolio content"], ["video", "Portfolio content"], ["wall", "Portfolio content"],
  // Pages & navigation
  ["layout", "Pages & navigation", undefined, "Sections & order"], ["menu", "Pages & navigation"], ["static-pages", "Pages & navigation"],
  // Contact & social
  ["contact", "Contact & social"], ["social", "Contact & social"],
  // Look & feel
  ["look", "Look & feel"], ["velocity", "Look & feel"], ["theme", "Look & feel"], ["festival", "Look & feel"],
  // Email & chat
  ["emails", "Email & chat"], ["features", "Email & chat"],
  // Settings
  ["languages", "Settings"], ["seo", "Settings"], ["consent", "Settings"], ["legal", "Settings"], ["cms", "Settings"], ["people", "Settings"], ["backup", "Settings"], ["account", "Settings"], ["code", "Settings"],
];
export const MENU_LAYOUTS: Record<string, MenuLayout> = {
  restaurant: { groups: ["Orders & guests", "Menu & dishes", "Online ordering", "Website pages", "Hours & contact", "Look & feel", "Email & chat", "Settings"], rows: RESTAURANT },
  store: { groups: ["Orders & customers", "Products & stock", "Selling & checkout", "Website pages", "Contact & policies", "Look & feel", "Email & chat", "Settings"], rows: STORE },
  portfolio: { groups: ["Portfolio content", "Pages & navigation", "Contact & social", "Look & feel", "Email & chat", "Settings"], rows: PORTFOLIO },
};

/** The entries regrouped and ordered by a template's layout; anything not placed keeps its own heading after the known ones. */
export function applyLayout(L: MenuLayout, nav: NavEntry[]): NavEntry[] {
  const at = new Map(L.rows.map((x, i) => [x[0], i]));
  const out = nav.map((e) => { const r = L.rows.find((x) => x[0] === e.id); return r ? { ...e, group: r[1], sub: r[2], label: r[3] || e.label } : e; });
  const rank = (e: NavEntry) => (at.has(e.id) ? at.get(e.id)! : L.rows.length + nav.findIndex((x) => x.id === e.id));
  return out.slice().sort((a, b) => rank(a) - rank(b));
}
