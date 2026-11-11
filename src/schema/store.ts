import type { Category, Field, TemplateDef } from "./types";
import { uid, vpaOk, paypalOk, httpsOk } from "../lib/util";
import { BODY_FONTS, DISPLAY_FONTS, LINE_BREAKS_AXIS, STORE_AXES, THEMES, onColor, storeThemeValues } from "../themes/catalog";
import { adminCategory, seoCategory } from "./common";
import { themeCards } from "../themes/fields";

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "CAD"];
const FONTS_D = DISPLAY_FONTS;
const FONTS_B = BODY_FONTS;
const g2 = (...fields: Field[]): Field => ({ t: "grid", cols: 2, fields });
const g3 = (...fields: Field[]): Field => ({ t: "grid", cols: 3, fields });

const schema: Category[] = [
  {
    id: "look", label: "Theme & layout", group: "Design", desc: `Choose from ${THEMES.length} themes, then fine-tune the layout, elements and animation.`,
    cards: themeCards([STORE_AXES.grid, STORE_AXES.product], "“Stacked” puts the hero text over a full-width image. Visitors who ask their device for reduced motion always get a still page."),
  },
  {
    id: "theme", label: "Brand & theme", group: "Design", desc: "Store name, logo, colours, fonts and the announcement bar.",
    cards: [
      { title: "Brand", fields: [g2({ t: "text", path: "brand.name", label: "Store name" }, { t: "text", path: "brand.tagline", label: "Tagline", ml: true }), { t: "image", path: "brand.logo", label: "Logo (square works best)" },
        { t: "range", path: "theme.logoRadius", label: "Logo shape: 0 = square, 50 = circle", min: 0, max: 50, step: 1, unit: "%" },
        { t: "note", text: "The logo shape is used next to the store name and for the icon in the browser tab. Without a logo image, the icon shows your initials." }] },
      { title: "Announcement bar", fields: [{ t: "toggle", path: "brand.showAnnouncement", label: "Show the bar above the menu" }, { t: "text", path: "brand.announcement", label: "Message", ml: true }] },
      { title: "Colours", fields: [g3(
        { t: "color", path: "theme.bg", label: "Background" }, { t: "color", path: "theme.surface", label: "Cards" }, { t: "color", path: "theme.text", label: "Text" },
        { t: "color", path: "theme.soft", label: "Secondary text" }, { t: "color", path: "theme.line", label: "Borders" }, { t: "color", path: "theme.accent", label: "Accent & buttons" },
        { t: "color", path: "theme.accent2", label: "Second accent" }, { t: "color", path: "theme.sale", label: "Sale & badges" })] },
      { title: "Typography & corners", fields: [g2({ t: "select", path: "theme.fontDisplay", label: "Headings font", options: FONTS_D }, { t: "select", path: "theme.fontBody", label: "Body font", options: FONTS_B }),
        { t: "range", path: "theme.radius", label: "Corner radius", min: 0, max: 28, step: 1, unit: "px" },
        { t: "select", path: "theme.lineBreaks", label: LINE_BREAKS_AXIS.label, options: LINE_BREAKS_AXIS.options.map(([value, label]) => ({ value, label })) },
        { t: "note", text: "Headings and titles break where you press Enter. With “As typed”, a heading you typed on one line stays on one line (it shrinks a little to fit, and only wraps on screens too narrow for it)." }] },
    ],
  },
  {
    id: "nav", label: "Menu & pages", group: "Design", desc: "Menu labels and which pages appear.",
    cards: [
      { title: "Menu titles", fields: [g2({ t: "text", path: "nav.home", label: "Home" }, { t: "text", path: "nav.shop", label: "Shop" }, { t: "text", path: "nav.portfolio", label: "Story / portfolio page" }, { t: "text", path: "nav.cart", label: "Cart" }, { t: "text", path: "nav.account", label: "Account (when sign-in is on)" }),
        { t: "toggle", path: "nav.showPortfolio", label: "Show the story / portfolio page in the menu" }] },
      { title: "Footer titles & links", fields: [g2({ t: "text", path: "labels.allProducts", label: "“All products” link" }, { t: "text", path: "labels.viewAll", label: "“View all” link on the home page" },
        { t: "text", path: "labels.help", label: "Footer column: help & policies" }, { t: "text", path: "labels.contact", label: "Footer column: contact" })] },
    ],
  },
  {
    id: "home", label: "Home page", group: "Pages", desc: "The landing page: hero, featured products, categories, banner and reviews.",
    cards: [
      { title: "Hero", fields: [{ t: "text", path: "home.hero.eyebrow", label: "Small label", ml: true }, { t: "text", path: "home.hero.title", label: "Headline", ml: true }, { t: "textarea", path: "home.hero.text", label: "Text", hint: "Line breaks you type show on the site." },
        { t: "text", path: "home.hero.cta", label: "Button label" }, { t: "image", path: "home.hero.image", label: "Hero image", hint: "Wide images look best. Without one, a pattern in your colours is used." }] },
      { title: "Featured products", fields: [g2({ t: "text", path: "home.featuredTitle", label: "Title", ml: true }, { t: "text", path: "home.featuredText", label: "Line under the title", ml: true }),
        { t: "note", text: "Mark products as featured under Products. Up to 8 are shown." }] },
      { title: "Categories", fields: [{ t: "toggle", path: "home.showCategories", label: "Show categories on the home page" }, { t: "text", path: "home.categoriesTitle", label: "Title", ml: true }] },
      { title: "Banner", fields: [{ t: "toggle", path: "home.banner.show", label: "Show the banner" }, { t: "text", path: "home.banner.title", label: "Title", ml: true }, { t: "textarea", path: "home.banner.text", label: "Text", hint: "Line breaks you type show on the site." },
        { t: "text", path: "home.banner.cta", label: "Button label (opens the portfolio page)" }, { t: "image", path: "home.banner.image", label: "Banner image" }] },
      { title: "Customer reviews", fields: [{ t: "text", path: "home.testimonialsTitle", label: "Title", ml: true },
        { t: "list", path: "home.testimonials", add: () => ({ quote: "", name: "", role: "" }), max: 6, title: (it) => it.name || "Review",
          item: [{ t: "textarea", path: "quote", label: "Quote" }, g2({ t: "text", path: "name", label: "Name" }, { t: "text", path: "role", label: "Detail (city, product)" })] },
        { t: "note", text: "Only add reviews real customers gave you.", tone: "warn" }] },
    ],
  },
  {
    id: "products", label: "Products", group: "Catalogue", desc: "Everything you sell. Each product gets its own page.",
    cards: [
      { title: "Products", fields: [{ t: "list", path: "products", title: (it) => `${it.name || "Untitled"} · ${Number(it.price) || 0}${it.featured ? " · featured" : ""}${it.stock === "out" ? " · sold out" : ""}${it.sample ? " · sample" : ""}`,
        add: () => ({ id: uid("p"), slug: "", name: "New product", category: "", price: 999, compareAt: 0, images: [], short: "", description: "", features: [], optionName: "", options: [], stock: "in", featured: false, badge: "" }),
        item: [
          g2({ t: "text", path: "name", label: "Name" }, { t: "ref", path: "category", label: "Category", source: "categories", valueKey: "id", labelKey: "name", empty: "No category" }),
          g3({ t: "number", path: "price", label: "Price", min: 0, step: 1 }, { t: "number", path: "compareAt", label: "Was price (optional)", min: 0, step: 1 }, { t: "select", path: "stock", label: "Stock", options: [{ value: "in", label: "In stock" }, { value: "low", label: "Low stock" }, { value: "out", label: "Sold out" }] }),
          { t: "images", path: "images", label: "Photos", hint: "The first photo is the main one." },
          { t: "text", path: "short", label: "One-line summary" },
          { t: "textarea", path: "description", label: "Description", rows: 5, hint: "Leave a blank line between paragraphs." },
          { t: "strings", path: "features", label: "Key details", addLabel: "Add detail" },
          g2({ t: "text", path: "optionName", label: "Option name (e.g. Size)" }, { t: "text", path: "badge", label: "Badge (e.g. New)" }),
          { t: "strings", path: "options", label: "Option choices", addLabel: "Add choice" },
          g2({ t: "toggle", path: "featured", label: "Feature on the home page" }, { t: "text", path: "slug", label: "Page address (optional)", ph: "made from the name" }),
          { t: "toggle", path: "sample", label: "This is a sample product (warns before export)" },
        ] }] },
    ],
  },
  {
    id: "categories", label: "Categories", group: "Catalogue", desc: "Group products. Shoppers can filter the shop by category.",
    cards: [
      { title: "Categories", fields: [{ t: "list", path: "categories", title: (it) => it.name || "Category", add: () => ({ id: uid("c"), name: "New category", description: "", image: null }),
        item: [g2({ t: "text", path: "name", label: "Name" }, { t: "text", path: "id", label: "Short code (used in links)" }), { t: "text", path: "description", label: "Description" }, { t: "image", path: "image", label: "Image" }] },
        { t: "note", text: "Changing a short code un-links products that use it. Pick the category again on those products." }] },
    ],
  },
  {
    id: "shop", label: "Shop page", group: "Pages", desc: "The product listing page.",
    cards: [
      { title: "Shop page", fields: [g2({ t: "text", path: "shop.title", label: "Title", ml: true }, { t: "select", path: "shop.sortDefault", label: "Default sort", options: [{ value: "featured", label: "Featured first" }, { value: "new", label: "Newest first" }, { value: "low", label: "Price: low to high" }, { value: "high", label: "Price: high to low" }] }),
        { t: "textarea", path: "shop.intro", label: "Intro" }, { t: "toggle", path: "shop.showSearch", label: "Show the search box" }, { t: "text", path: "shop.emptyText", label: "Text when nothing matches" }] },
    ],
  },
  {
    id: "portfolio", label: "Portfolio page", group: "Pages", desc: "Your story, numbers and past work, on its own page.",
    cards: [
      { title: "Intro", fields: [g2({ t: "text", path: "portfolio.eyebrow", label: "Small label", ml: true }, { t: "text", path: "portfolio.title", label: "Title", ml: true }), { t: "textarea", path: "portfolio.intro", label: "Intro" }, { t: "image", path: "portfolio.image", label: "Image" }] },
      { title: "Story", fields: [{ t: "text", path: "portfolio.storyTitle", label: "Title", ml: true }, { t: "textarea", path: "portfolio.story", label: "Story", rows: 6, hint: "Leave a blank line between paragraphs." }] },
      { title: "Numbers", fields: [{ t: "list", path: "portfolio.stats", add: () => ({ value: "10+", label: "Label" }), max: 4, title: (it) => `${it.value} ${it.label}`, item: [g2({ t: "text", path: "value", label: "Value" }, { t: "text", path: "label", label: "Label" })] }] },
      { title: "Work", fields: [{ t: "text", path: "portfolio.workTitle", label: "Section title", ml: true },
        { t: "list", path: "portfolio.work", add: () => ({ title: "Project", text: "", tag: "", image: null, link: "" }), title: (it) => it.title || "Project",
          item: [g2({ t: "text", path: "title", label: "Title" }, { t: "text", path: "tag", label: "Tag" }), { t: "textarea", path: "text", label: "Description" }, { t: "image", path: "image", label: "Image" }, { t: "text", path: "link", label: "Link (optional)", check: "https" }] }] },
      { title: "Call to action", fields: [{ t: "text", path: "portfolio.ctaTitle", label: "Title", ml: true }, { t: "textarea", path: "portfolio.ctaText", label: "Text" }, { t: "text", path: "portfolio.ctaButton", label: "Button label (opens the shop)" }] },
    ],
  },
  {
    id: "pricing", label: "Prices & shipping", group: "Selling", desc: "Currency, shipping, tax and order limits used in the cart and checkout.",
    cards: [
      { title: "Prices", fields: [g3({ t: "select", path: "settings.currency", label: "Currency", options: CURRENCIES }, { t: "number", path: "settings.minOrder", label: "Minimum order", min: 0 }, { t: "number", path: "settings.maxQty", label: "Max quantity per item", min: 1 })] },
      { title: "Shipping", fields: [g2({ t: "number", path: "settings.shippingFee", label: "Shipping fee", min: 0 }, { t: "number", path: "settings.freeShippingOver", label: "Free shipping over (0 = never)", min: 0 })] },
      { title: "Tax", fields: [g3({ t: "number", path: "settings.taxPercent", label: "Tax %", min: 0, step: 0.1 }, { t: "text", path: "settings.taxLabel", label: "Tax name" }, { t: "toggle", path: "settings.taxIncluded", label: "Prices include tax" })] },
      { title: "Order numbers", fields: [{ t: "text", path: "settings.orderPrefix", label: "Order number prefix", hint: "Orders look like PREFIX-1105-4821." }] },
    ],
  },
  {
    id: "checkout", label: "Checkout", group: "Selling", desc: "What shoppers fill in and what they see after ordering.",
    cards: [
      { title: "Form", fields: [g2({ t: "text", path: "checkout.title", label: "Page title", ml: true }, { t: "text", path: "checkout.button", label: "Order button label" }), { t: "textarea", path: "checkout.intro", label: "Intro" },
        g3({ t: "toggle", path: "checkout.askPhone", label: "Ask for phone" }, { t: "toggle", path: "checkout.askAddress", label: "Ask for address" }, { t: "toggle", path: "checkout.askNotes", label: "Ask for notes" })] },
      { title: "After ordering", fields: [{ t: "text", path: "checkout.successTitle", label: "Title", ml: true }, { t: "textarea", path: "checkout.successText", label: "Text" }] },
    ],
  },
  {
    id: "payments", label: "Payments", group: "Selling", desc: "Turn on the ways customers can pay. A method only shows once its details are valid.",
    cards: [
      { title: "UPI", fields: [{ t: "toggle", path: "payments.upi.enabled", label: "Accept UPI (INR only)" }, g2({ t: "text", path: "payments.upi.vpa", label: "UPI ID", ph: "name@bank", check: "vpa" }, { t: "text", path: "payments.upi.payeeName", label: "Payee name (as your bank shows it)" }),
        { t: "text", path: "payments.upi.label", label: "Label at checkout" }, { t: "note", text: "Checkout shows a UPI QR code and app button with the exact order total and order number filled in. With the shop backend on, the customer then enters their UPI transaction ID (UTR): you both get an email, you check it in your UPI app and tap Mark paid in Orders, and you both get the confirmation. For confirmation with no checking, turn on Razorpay, which includes UPI." }] },
      { title: "Razorpay", fields: [{ t: "toggle", path: "payments.razorpay.enabled", label: "Accept Razorpay" }, { t: "text", path: "payments.razorpay.link", label: "Payment page link (customer enters amount)", check: "razorpay", ph: "https://rzp.io/…" },
        { t: "text", path: "payments.razorpay.label", label: "Label at checkout" }, { t: "note", text: "Create a Razorpay Payment Page that lets the customer enter the amount. Checkout tells them the exact total and order number to enter." }] },
      { title: "Stripe", fields: [{ t: "toggle", path: "payments.stripe.enabled", label: "Accept Stripe" }, { t: "text", path: "payments.stripe.link", label: "Payment link (customer chooses amount)", check: "stripe", ph: "https://buy.stripe.com/…" },
        { t: "text", path: "payments.stripe.label", label: "Label at checkout" }] },
      { title: "PayPal", fields: [{ t: "toggle", path: "payments.paypal.enabled", label: "Accept PayPal" }, g2({ t: "text", path: "payments.paypal.username", label: "PayPal.me username", check: "paypal" }, { t: "text", path: "payments.paypal.label", label: "Label at checkout" })] },
      { title: "Cash on delivery", fields: [{ t: "toggle", path: "payments.cod.enabled", label: "Offer cash on delivery" }, g2({ t: "text", path: "payments.cod.label", label: "Label at checkout" }, { t: "text", path: "payments.cod.note", label: "Note" })] },
    ],
  },
  {
    id: "backend", label: "Accounts & backend", group: "Selling", desc: "Connect a backend for customer accounts, automatic order emails and secure card checkout with the exact amount. Pick Supabase, or a free Cloudflare Worker that keeps orders as files in a private GitHub repository.",
    cards: [
      { title: "Shop backend", fields: [
        { t: "toggle", path: "backend.enabled", label: "Use the shop backend" },
        { t: "select", path: "backend.provider", label: "Backend", options: [
          { value: "supabase", label: "Supabase (free database)" },
          { value: "cloudflare", label: "Cloudflare Worker + GitHub files (free)" },
        ] },
        { t: "when", path: "backend.provider", is: "cloudflare", fields: [
          { t: "text", path: "backend.workerUrl", label: "Worker URL", ph: "https://shop.yourname.workers.dev", check: "https", hint: "Cloudflare → Workers & Pages → your worker → the workers.dev address at the top." },
          { t: "note", text: "Follow cloudflare/SETUP.md in the exported site: make a private GitHub repo for orders (e.g. shop-data), paste cloudflare/worker.js into a new Worker, and add the GitHub token, Resend, Razorpay and Stripe keys as the Worker's secrets. Secret keys never go in this CMS." },
          { t: "note", text: "Orders, customers and wishlists are saved as JSON files in that private repo, one commit per change. Good for small shops: up to a few thousand orders. Owner sign-in uses OWNER_EMAIL (or ADMIN_EMAILS) set on the Worker.", tone: "info" },
        ] },
        { t: "when", path: "backend.provider", not: "cloudflare", fields: [
          { t: "text", path: "backend.supabaseUrl", label: "Project URL", ph: "https://abcd1234.supabase.co", check: "https", hint: "Supabase → Project Settings → API → Project URL." },
          { t: "text", path: "backend.anonKey", label: "Public (anon) key", hint: "Supabase → Project Settings → API → anon public. It's safe to publish: access rules protect the data. Never paste the service_role key here." },
          { t: "note", text: "Follow supabase/SETUP.md in the exported site: run schema.sql, deploy the shop function, and add your Resend, Razorpay and Stripe keys as function secrets. Secret keys never go in this CMS." },
        ] },
        { t: "note", text: "With the backend on, Razorpay and Stripe charge the exact order total in their secure checkout, and the payment links under Payments aren't needed. A UPI payment is confirmed when you tap Mark paid in Orders. Customers and you get emails as soon as a payment goes through.", tone: "info" },
      ] },
      { title: "Customer accounts", fields: [
        { t: "toggle", path: "backend.accounts", label: "Let customers sign in to track orders and manage their details" },
        { t: "toggle", path: "backend.wishlist", label: "Wishlist for signed-in customers" },
        { t: "toggle", path: "backend.requireLogin", label: "Require sign-in to check out (only when sign-in is on)" },
        g2({ t: "text", path: "accountPage.title", label: "Account page title" }, { t: "text", path: "nav.account", label: "Menu label" }),
        { t: "textarea", path: "accountPage.signInText", label: "Sign-in text" },
        { t: "note", text: "Customers sign in with a 6-digit code sent to their email. Each customer gets an account number like AC-100001. Switched off, the shop has no sign-in, account page or wishlist at all, and exports leave the account page out." },
      ] },
    ],
  },
  {
    id: "orders", label: "Order delivery", group: "Selling", desc: "Where new orders reach you. This site has no server, so each order is sent to you as a pre-filled message.",
    cards: [
      { title: "Send orders to", fields: [g2({ t: "text", path: "orders.whatsapp", label: "WhatsApp number with country code", ph: "+91 98xxxxxx", check: "phone" }, { t: "text", path: "orders.email", label: "Email", check: "email" }),
        { t: "select", path: "orders.sendVia", label: "How customers send the order", options: [{ value: "whatsapp", label: "WhatsApp" }, { value: "email", label: "Email" }, { value: "both", label: "Both" }] },
        { t: "text", path: "orders.messageIntro", label: "First line of the order message" },
        { t: "note", text: "After placing an order, the customer taps a button that opens WhatsApp or their email app with the full order. Check payments in your UPI app or payment dashboard before you ship.", tone: "warn" }] },
    ],
  },
  {
    id: "contact", label: "Contact, policies & footer", group: "Pages", desc: "Contact details, store policies and the footer.",
    cards: [
      { title: "Contact", fields: [g2({ t: "text", path: "contact.email", label: "Email", check: "email" }, { t: "text", path: "contact.phone", label: "Phone" }, { t: "text", path: "contact.whatsapp", label: "WhatsApp", check: "phone" }, { t: "text", path: "contact.instagram", label: "Instagram link", check: "https" }),
        { t: "textarea", path: "contact.address", label: "Address", rows: 2 }] },
      { title: "Policies", fields: [{ t: "list", path: "policies", add: () => ({ id: uid("pol"), title: "New policy", text: "" }), title: (it) => it.title || "Policy", item: [{ t: "text", path: "title", label: "Title" }, { t: "textarea", path: "text", label: "Text", rows: 6 }] },
        { t: "note", text: "Payment providers usually ask for shipping, refund and privacy policies on your site." }] },
      { title: "Footer", fields: [{ t: "textarea", path: "footer.text", label: "Footer text" }] },
    ],
  },
  seoCategory(true),
  adminCategory(),
];

/** Defaults for settings added after a shop was made. */
export const STORE_LABELS = { allProducts: "All products", viewAll: "View all", help: "Help", contact: "Contact" };
export function prepareStore(c: any) {
  if (!c || typeof c !== "object") return;
  const t = c.theme && typeof c.theme === "object" ? c.theme : (c.theme = {});
  if (!t.introBg) t.introBg = t.deep || t.text || "#111111";
  if (!t.introFg) t.introFg = onColor(t.introBg);
  if (t.introTitle === undefined) t.introTitle = "";
  if (!t.introFont) t.introFont = "display";
  if (!t.introCase) t.introCase = "upper";
  if (t.logoRadius === undefined || t.logoRadius === null) t.logoRadius = 26;
  if (!t.scrollEase) t.scrollEase = "light";
  if (!t.lineBreaks) t.lineBreaks = "typed";
  c.labels = { ...STORE_LABELS, ...(c.labels && typeof c.labels === "object" ? c.labels : {}) };
  c.cms = { adminPage: "admin", ...(c.cms && typeof c.cms === "object" ? c.cms : {}) };
  c.seo = { titlePattern: "{page} · {site}", keywords: "", author: "", image: null, siteUrl: "", themeColor: "", noindex: false, googleVerification: "", meta: [], ...(c.seo && typeof c.seo === "object" ? c.seo : {}) };
}

/** Reads the payload of a Supabase key (a JWT) to catch a pasted service_role key. */
function atobSafe(jwt: string): string {
  try {
    return atob(String(jwt).split(".")[1].replace(/-/g, "+").replace(/_/g, "/"));
  } catch {
    return "";
  }
}

export const storeTemplate: TemplateDef = {
  id: "store",
  name: "Shop",
  kind: "Multi page",
  description: "Online shop: home, product listing, product pages, cart, checkout with UPI, Razorpay, Stripe, PayPal or cash on delivery, plus a portfolio page.",
  pages: [
    { file: "index.html", label: "Home" },
    { file: "shop.html", label: "Shop" },
    { file: "product.html", label: "Product" },
    { file: "cart.html", label: "Cart" },
    { file: "checkout.html", label: "Checkout" },
    { file: "portfolio.html", label: "Portfolio" },
    { file: "policies.html", label: "Policies" },
    { file: "account.html", label: "Account" },
  ],
  schema,
  colorKeys: [{ key: "accent", label: "Accent" }, { key: "accent2", label: "Second accent" }, { key: "sale", label: "Sale" }, { key: "text", label: "Text" }, { key: "surface", label: "Cards" }],
  themePath: "theme",
  themeValues: storeThemeValues,
  prepare: prepareStore,
  summary: (c) => `${(c?.products || []).length} products`,
  checks: (c) => {
    const w: string[] = [];
    const p = c?.payments || {};
    const cf = c?.backend?.provider === "cloudflare";
    const be = !!(c?.backend?.enabled && (cf ? httpsOk(c.backend.workerUrl) : httpsOk(c.backend.supabaseUrl) && c.backend.anonKey));
    const live = (p.upi?.enabled && vpaOk(p.upi.vpa)) || (p.razorpay?.enabled && (be || httpsOk(p.razorpay.link))) || (p.stripe?.enabled && (be || httpsOk(p.stripe.link))) || (p.paypal?.enabled && paypalOk(p.paypal.username)) || p.cod?.enabled;
    if (c?.backend?.enabled && !be) w.push(cf ? "The shop backend is switched on but its Worker URL is missing." : "The shop backend is switched on but its Project URL or public key is missing.");
    if (cf && /github\.com|github\.io/.test(c?.backend?.workerUrl || "")) w.push("The Worker URL looks like a GitHub address. Use the workers.dev address of your Cloudflare Worker.");
    if (!cf && c?.backend?.anonKey && /service_role/.test(atobSafe(c.backend.anonKey))) w.push("The key under Accounts & backend is a service_role key. Replace it with the anon public key now.");
    if (!live) w.push("No payment method is switched on with valid details.");
    if (!be && !c?.orders?.whatsapp && !c?.orders?.email) w.push("No WhatsApp number or email is set to receive orders.");
    if (!(c?.products || []).length) w.push("The shop has no products.");
    const samples = (c?.products || []).filter((x: any) => x.sample).length;
    if (samples) w.push(`${samples} sample product${samples > 1 ? "s are" : " is"} still in the catalogue.`);
    return w;
  },
};
