// Settings both templates share: where the site's own CMS lives.
import type { Category, Field } from "./types";

/** Page names a site already uses, so the admin page can't take them. */
const RESERVED = ["index", "404", "shop", "product", "cart", "checkout", "portfolio", "policies", "account", "content", "readme", "assets", "cms", "services", "work", "about", "contact", "warranty", "products"];

/** "My Admin!" → "my-admin". Empty or unusable names fall back to "admin". */
export function adminSlug(raw: unknown): string {
  const s = String(raw ?? "").trim().toLowerCase().replace(/\.html?$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return s.length >= 2 && !RESERVED.includes(s) ? s : "admin";
}
/** The admin page's file name for this content, e.g. "admin.html". */
export const adminFile = (content: any) => adminSlug(content?.cms?.adminPage) + ".html";

export const addonsDefault = () => ({
  chat: { on: false, kind: "whatsapp", value: "", label: "Chat with us", message: "", side: "right", showLabel: true, color: "" },
  badge: { on: false, text: "", api: "", field: "", link: "", side: "left" },
  code: [] as any[],
  api: { on: false, url: "" },
});
/** Older content gets the Features fields (all off). */
export function prepareAddons(c: any) {
  if (!c || typeof c !== "object") return;
  const d = addonsDefault(), a = c.addons && typeof c.addons === "object" ? c.addons : {};
  const obj = (x: any) => (x && typeof x === "object" && !Array.isArray(x) ? x : {});
  c.addons = { chat: { ...d.chat, ...obj(a.chat) }, badge: { ...d.badge, ...obj(a.badge) }, code: Array.isArray(a.code) ? a.code : [], api: { ...d.api, ...obj(a.api) } };
}
/** Features: add-ons that sit on top of every page (assets/addons.js): a chat button, a live badge, custom code
 *  (any chat box, analytics or widget snippet) and a custom API that receives the site's form entries. */
export function featuresCategory(): Category {
  const g2 = (...fields: Field[]): Field => ({ t: "grid", cols: 2, fields });
  return {
    id: "features", label: "Chat, badges & custom code", group: "Features",
    desc: "Extras on top of every page: a chat button, a badge, your own API and any widget's code (chat boxes, analytics, booking tools).",
    cards: [
      { title: "Chat button", fields: [
        { t: "toggle", path: "addons.chat.on", label: "Show a floating chat button" },
        { t: "when", path: "addons.chat.on", is: "true", fields: [
          g2({ t: "select", path: "addons.chat.kind", label: "Opens", options: [{ value: "whatsapp", label: "WhatsApp chat" }, { value: "phone", label: "A phone call" }, { value: "email", label: "An email" }, { value: "link", label: "A link (Messenger, Telegram, a booking page…)" }] },
            { t: "text", path: "addons.chat.value", label: "Number, email or link", ph: "+91 98765 43210" },
            { t: "text", path: "addons.chat.label", label: "Button text", ph: "Chat with us" }, { t: "toggle", path: "addons.chat.showLabel", label: "Show the text beside the icon" },
            { t: "select", path: "addons.chat.side", label: "Corner", options: [{ value: "right", label: "Bottom right" }, { value: "left", label: "Bottom left" }] },
            { t: "color", path: "addons.chat.color", label: "Colour (empty: WhatsApp green or the accent colour)" }),
          { t: "when", path: "addons.chat.kind", is: "whatsapp", fields: [{ t: "text", path: "addons.chat.message", label: "Message already typed for the visitor (optional)", ph: "Hi, I'd like to know more about…" }] },
        ] },
      ] },
      { title: "Badge", fields: [
        { t: "toggle", path: "addons.badge.on", label: "Show a small badge in a corner" },
        { t: "when", path: "addons.badge.on", is: "true", fields: [
          g2({ t: "text", path: "addons.badge.text", label: "Badge text", ph: "★ {value} on Google", hint: "{value} is replaced with the number or word read from your API below." }, { t: "text", path: "addons.badge.link", label: "Opens (optional)", check: "https" },
            { t: "text", path: "addons.badge.api", label: "API address for {value} (optional)", ph: "https://api.example.com/rating", check: "https" }, { t: "text", path: "addons.badge.field", label: "Field in the API's answer", ph: "rating or data.score" },
            { t: "select", path: "addons.badge.side", label: "Corner", options: [{ value: "left", label: "Bottom left" }, { value: "right", label: "Bottom right" }] }),
          { t: "note", text: "Without an API address the badge shows its text as it is. With one, the site asks that address when a page opens (it must answer in JSON and allow requests from websites) and hides the badge if it doesn't answer." },
        ] },
      ] },
      { title: "Custom API for form entries", fields: [
        { t: "toggle", path: "addons.api.on", label: "Also send each form entry to my API" },
        { t: "when", path: "addons.api.on", is: "true", fields: [
          { t: "text", path: "addons.api.url", label: "API address (a webhook)", ph: "https://hooks.example.com/enquiry", check: "https" },
          { t: "note", text: "When a visitor sends the enquiry form (or any form with a message or email box), the site also posts the entry to this address as JSON: { site, page, form, fields, at }. Works with Zapier, Make, n8n, Google Apps Script or your own server. Passwords and card details are never sent. The address is public, so don't put a secret in it, and mention it in your privacy policy." },
        ] },
      ] },
      { title: "Custom code", fields: [
        { t: "note", text: "Paste the code a service gives you: a chat box (Tawk.to, Crisp, Tidio), analytics, a booking or review widget, or your own script. It runs on the live site, not in this preview. Only paste code from services you trust: it can see and change everything on the site.", tone: "warn" },
        { t: "list", path: "addons.code", max: 12, add: () => ({ id: "cc-" + Math.random().toString(36).slice(2, 8), name: "", on: true, where: "body", pages: "all", code: "" }), title: (it) => `${it?.name || "Custom code"}${it?.on === false ? " (off)" : ""}`,
          item: [
            g2({ t: "text", path: "name", label: "Name (for you)", ph: "Tawk.to chat box" }, { t: "toggle", path: "on", label: "On" },
              { t: "select", path: "where", label: "Where it goes", options: [{ value: "body", label: "End of the page (most widgets)" }, { value: "head", label: "The page's head (analytics, verification tags)" }] },
              { t: "select", path: "pages", label: "Pages", options: [{ value: "all", label: "Every page" }, { value: "home", label: "The home page only" }] }),
            { t: "textarea", path: "code", label: "Code", rows: 6, hint: "HTML with <script>, <link>, <meta> or <style> tags, exactly as the service gives it." },
          ] },
      ] },
      { title: "“Powered by” badge", studio: true, fields: [
        { t: "toggle", path: "poweredBy.show", label: "Show the badge on this site" },
        { t: "note", text: "A small link in the bottom-right corner of every page, always on screen. Its text, link, size, colours and icon are set once for all sites in Settings → “Powered by” badge. Only the Studio can show or hide it: the site's own admin page doesn't have this setting." },
      ] },
    ],
  };
}

export function adminCategory(): Category {
  const g2 = (...fields: Field[]): Field => ({ t: "grid", cols: 2, fields });
  return {
    id: "cms", label: "Admin page", group: "Settings", site: { label: "Publish & admin" }, desc: "Maintenance mode, and the address of this site's own editor (the CMS).",
    cards: [{ title: "Maintenance mode", fields: [
      { t: "toggle", path: "maintenance.on", label: "Show the maintenance page instead of the site" },
      { t: "note", text: "While this is on and published, every page of the site shows the maintenance page below. This admin page keeps working. To look at the site yourself, open it once with ?peek at the end of the address (for example yoursite/?peek); ?peek=off ends it. Turn the switch off and publish to bring the site back.", tone: "warn" },
      { t: "text", path: "maintenance.title", label: "Heading", ph: "We'll be back soon", ml: true },
      { t: "textarea", path: "maintenance.text", label: "Message", rows: 5, rich: true, hint: "Plain text; the buttons add bold, lists and links. Leave empty for the standard message." },
      g2({ t: "text", path: "maintenance.back", label: "Back by (optional)", ph: "Back on Monday, 10 am" }, { t: "select", path: "maintenance.look", label: "Look", options: [{ value: "page", label: "The site's page colours" }, { value: "dark", label: "Dark" }, { value: "accent", label: "The accent colour" }] },
        { t: "text", path: "maintenance.button.label", label: "Button text (optional)", ph: "Message us on WhatsApp" }, { t: "text", path: "maintenance.button.url", label: "Button link", ph: "https://wa.me/91…" }),
      { t: "textarea", path: "maintenance.contact", label: "Contact line (optional)", rows: 2, hint: "For example an email address and a phone number; they become clickable." },
      { t: "toggle", path: "maintenance.showLogo", label: "Show the logo or name at the top" },
      { t: "note", text: "Pick “Maintenance page” in the preview's page list to see it before switching it on." },
    ] }, { title: "Admin page address", fields: [
      { t: "text", path: "cms.adminPage", label: "Admin page name", ph: "admin", show: (v) => `Opens at yoursite/${adminSlug(v)} after you publish. Letters, numbers and dashes; spaces become dashes.` },
      { t: "note", text: "A less obvious name keeps casual visitors away from the sign-in screen. It isn't a password: the editor still needs your GitHub token. After you publish a new name, the old address stops working, so bookmark the new one." },
      { t: "note", text: "Names the site already uses (index, shop, cart, checkout, portfolio, account…) aren't allowed and fall back to admin.", tone: "warn" },
    ] },
    { title: "Themes in the admin page", studio: true, fields: [{ t: "adminThemes" }] },],
  };
}

/** Tab titles, search and link-preview metadata. Baked into every page's <head> on publish. */
export function seoCategory(shop: boolean): Category {
  const g2 = (...fields: Field[]): Field => ({ t: "grid", cols: 2, fields });
  return {
    id: "seo", label: "Title & metadata", group: "Settings", desc: "The browser tab title, and what Google, WhatsApp, LinkedIn and others show for your site.",
    cards: [
      { title: "Browser tab title", fields: [
        { t: "text", path: "seo.title", label: shop ? "Home page title" : "Page title", show: (v) => `The <title> in the page's <head>. ${String(v || "").length}/60 characters: about 60 fit in search results.` },
        ...(shop ? [{ t: "text", path: "seo.titlePattern", label: "Other pages", ph: "{page} · {site}", hint: "{page} becomes the page (Shop, Cart, the product name…) and {site} the store name. Example: “{page} | Kasa Katha”." } as Field] : []),
      ] },
      { title: "Search & link previews", fields: [
        { t: "textarea", path: "seo.description", label: "Description", hint: "One or two sentences (about 155 characters) for search results and link previews." },
        { t: "image", path: "seo.image", label: "Share image (1200 × 630 works best)", hint: "Shown when the link is shared on WhatsApp, Facebook, LinkedIn or X." },
        g2({ t: "text", path: "seo.keywords", label: "Keywords (comma separated)" }, { t: "text", path: "seo.author", label: "Author or business name" }),
        { t: "text", path: "seo.siteUrl", label: "Site address (optional)", ph: "https://yourname.github.io/site/", check: "https", hint: "Filled in automatically when you publish from the Studio. Set it for a custom domain; share images need a full address." },
      ] },
      { title: "Advanced", fields: [
        g2({ t: "color", path: "seo.themeColor", label: "Browser bar colour on phones" }, { t: "text", path: "seo.googleVerification", label: "Google Search Console code", hint: "Only the content=\"…\" value of the verification tag." }),
        { t: "toggle", path: "seo.noindex", label: "Hide this site from search engines" },
        { t: "list", path: "seo.meta", label: "More meta tags", max: 20, title: (it) => it.name ? `${it.name} = ${it.content || ""}` : "New tag", add: () => ({ name: "", content: "" }),
          item: [g2({ t: "text", path: "name", label: "Name or property", ph: "og:locale" }, { t: "text", path: "content", label: "Content", ph: "en_IN" })] },
        { t: "note", text: "Tags whose name starts with og:, fb:, article: or product: are written as property=…, others as name=…. WhatsApp and Facebook keep old previews for a while: to refresh one, paste the link into Facebook's Sharing Debugger." },
      ] },
    ],
  };
}

// ---------------------------------------------------------------- static pages (all templates)
/** "Privacy Policy" → "privacy-policy": the name in the page's address (page.html?p=…). Same rule as assets/pages.js. */
export const pageSlug = (raw: unknown) => String(raw ?? "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
export const staticPageDefault = (title = "New page") => ({ id: "pg-" + Math.random().toString(36).slice(2, 8), title, slug: "", subtitle: "", updated: "", body: "", show: true, inNav: false, inFooter: true, navLabel: "", showTitle: true, align: "left", size: "large", width: "narrow", toc: false, crumbs: true, noindex: false });
/** Reading pages with a title and plain text: privacy policy, terms, shipping, refunds, about… In the Studio it sits
 *  under Settings → Additional pages; the site's own admin page shows it as its own "Static pages" section. */
/** One page's fields. `addr`: the address before the page's name; `links`: the link switches; `back`: the "back" line's label. */
export function staticPageFields(addr: string, links: Field[], back: string): Field[] {
  const g2 = (...fields: Field[]): Field => ({ t: "grid", cols: 2, fields });
  return [
    { t: "text", path: "title", label: "Title", ml: true },
    { t: "text", path: "slug", label: "Address name (optional)", ph: "made from the title", show: (v) => `Opens at ${addr}${pageSlug(v) || "<the title>"}. Letters, numbers and dashes. Empty uses the title.` },
    { t: "textarea", path: "subtitle", label: "Subtitle under the title (optional)", rows: 2 },
    { t: "text", path: "updated", label: "Last updated (optional)", ph: "15 November 2026", hint: "Shown under the title as “Last updated: …”. Leave empty to hide it." },
    { t: "textarea", path: "body", label: "Text", rows: 16, pdf: true, rich: true, hint: "Plain text: a blank line starts a new paragraph. Select words and use the buttons for headings, lists, tables and text styles, or type the marks yourself: ## Heading, - bullet, 1. numbered, > quote, **bold**, | cell | cell | for a table row. Links and emails become clickable on their own. You can paste text from a document or fill it from a PDF." },
    g2({ t: "toggle", path: "show", label: "Published (visitors can open it)" }, ...links),
    { t: "note", text: "Title options" },
    g2({ t: "toggle", path: "showTitle", label: "Show the title on the page" }, { t: "select", path: "align", label: "Title alignment", options: [{ value: "left", label: "Left" }, { value: "center", label: "Centre" }] },
      { t: "select", path: "size", label: "Title size", options: [{ value: "large", label: "Large" }, { value: "medium", label: "Medium" }, { value: "small", label: "Small" }] },
      { t: "select", path: "width", label: "Text width", options: [{ value: "narrow", label: "Narrow (easiest to read)" }, { value: "wide", label: "Wide" }, { value: "full", label: "Full width" }] },
      { t: "toggle", path: "toc", label: "List the headings at the top (“On this page”)" }, { t: "toggle", path: "crumbs", label: back },
      { t: "toggle", path: "noindex", label: "Hide this page from search engines" }),
  ];
}
export function staticPagesCategory(where: "page" | "portfolio"): Category {
  const portfolio = where === "portfolio";
  return {
    id: "static-pages", label: "Custom pages", group: "Pages",
    desc: "Reading pages with a title and text, such as a privacy policy, terms, shipping or refunds. Each one gets its own address and a link in the footer or menu.",
    cards: [{ title: "Pages", fields: [
      { t: "list", path: "staticPages", max: 30, add: () => staticPageDefault(), title: (it) => `${it?.title || "Untitled page"}${it?.show === false ? " (hidden)" : ""}`,
        item: staticPageFields(portfolio ? "yoursite/?p=" : "yoursite/page.html?p=",
          portfolio ? [{ t: "toggle", path: "inFooter", label: "Link at the bottom of the site" }]
            : [{ t: "toggle", path: "inFooter", label: "Link in the footer" }, { t: "toggle", path: "inNav", label: "Link in the menu" }, { t: "text", path: "navLabel", label: "Link name (optional)", ph: "the title" }],
          portfolio ? "Show “Back” at the top" : "Show “Home / page” at the top") },
      { t: "note", text: "Pages use the site's colours and fonts. Pick a page in the preview's page list to see it. A site published before this update needs one publish from the Studio to get the page file; after that, pages added here or in the site's admin page work as soon as you publish." },
    ] }],
  };
}

/** Warranty & service-status check (shop and business sites): settings here, records in the "Warranty records" panel. */
export function warrantyCategory(where: "page" | "popup-or-page"): Category {
  const g = (...fields: Field[]): Field => ({ t: "grid", cols: 2, fields });
  return {
    id: "warranty", label: "Warranty & status", group: "Forms & records",
    desc: where === "page" ? "A page where customers check their product's warranty and service status by its number." : "Customers check their product's warranty and service status by its number: a popup on a one-page site, its own page with several pages.",
    cards: [
      { title: "Warranty & status check", fields: [
        { t: "toggle", path: "warranty.enabled", label: "Show the warranty & status check on the site" },
        { t: "note", text: "Records (numbers, products, dates and status) are added in Warranty records, in this menu. Set that up once with a records password; each record is stored encrypted under its own number, so nobody can list them." },
        g({ t: "text", path: "warranty.title", label: "Title" }, { t: "text", path: "warranty.navLabel", label: "Link name (menu and footer)" }),
        { t: "textarea", path: "warranty.intro", label: "Intro", rows: 2 },
        g({ t: "toggle", path: "warranty.inNav", label: "Link in the menu" }, { t: "toggle", path: "warranty.inFooter", label: "Link in the footer" }),
        ...(where === "popup-or-page" ? [{ t: "note", text: "One-page site: the link opens the check in a popup (also at yoursite/#warranty). Several pages: it opens its own page, warranty.html." } as Field] : []),
      ] },
      { title: "What customers enter", fields: [
        g({ t: "text", path: "warranty.label", label: "Number label", ph: "Serial or invoice number" }, { t: "text", path: "warranty.placeholder", label: "Example in the box", ph: "e.g. NB-2026-0142" }),
        { t: "select", path: "warranty.verify", label: "Also ask for (so only the customer can see their record)", options: [{ value: "none", label: "Nothing else: the number is enough" }, { value: "phone4", label: "Last 4 digits of their phone" }, { value: "email", label: "Their email" }] },
        { t: "when", path: "warranty.verify", not: "none", fields: [{ t: "text", path: "warranty.verifyLabel", label: "Label for that box", ph: "Last 4 digits of your phone" }, { t: "note", text: "After changing this, open Warranty records and press Save so the records use it.", tone: "warn" }] },
        g({ t: "text", path: "warranty.button", label: "Button" }, { t: "text", path: "warranty.notFound", label: "When the number isn't found" }),
        { t: "text", path: "warranty.help", label: "Help line under “not found”", ph: "Need help? Contact us and we'll look it up." },
      ] },
      { title: "What the result shows", fields: [
        g({ t: "toggle", path: "warranty.showWarranty", label: "Purchase date, warranty end and whether it's still covered" }, { t: "toggle", path: "warranty.showHistory", label: "Status history" }),
        { t: "toggle", path: "warranty.showCustomer", label: "Customer name" },
      ] },
      { title: "Statuses", fields: [
        { t: "note", text: "The steps a product goes through. Tone sets the colour: info (grey), progress (blue), ok (green), warn (amber), bad (red)." },
        { t: "list", path: "warranty.statuses", add: () => ({ id: "status-" + Math.random().toString(36).slice(2, 6), label: "New status", tone: "info" }), title: (it) => it.label || it.id,
          item: [g({ t: "text", path: "label", label: "Name" }, { t: "select", path: "tone", label: "Tone", options: ["info", "progress", "ok", "warn", "bad"].map((v) => ({ value: v, label: v })) })] },
      ] },
    ],
  };
}

// ---------------------------------------------------------------- hero background slides (all templates)
/** The settings a new hero slideshow starts with (content: hero.slides, or home.hero.slides in the shop). */
export const heroSlidesDefault = (overlayColor = "#000000") => ({ enabled: false, items: [] as any[], effect: "fade", interval: 6, speed: 1.2, overlay: 45, overlayColor, overlayStyle: "left", textColor: "light", height: "tall", dots: true, arrows: false, pause: true, hideArt: true, artOpacity: 100 });
/** Fills in the slideshow settings an older site doesn't have yet. */
export const maintenanceDefault = () => ({ on: false, title: "We'll be back soon", text: "We're making a few improvements. Please check back in a little while.", back: "", button: { label: "", url: "" }, contact: "", look: "page", showLogo: true });
/** Older content gets the maintenance page's fields (off). */
export function prepareMaintenance(c: any) {
  if (!c || typeof c !== "object") return;
  const d = maintenanceDefault(), m = c.maintenance && typeof c.maintenance === "object" ? c.maintenance : {};
  prepareAddons(c);
  c.maintenance = { ...d, ...m, button: { ...d.button, ...(m.button && typeof m.button === "object" ? m.button : {}) } };
}
export function prepareSlides(hero: any, overlayColor?: string) {
  if (!hero || typeof hero !== "object") return;
  const d = heroSlidesDefault(overlayColor);
  hero.slides = { ...d, ...(hero.slides && typeof hero.slides === "object" ? hero.slides : {}) };
  if (!Array.isArray(hero.slides.items)) hero.slides.items = [];
}
/** The Studio card for a hero's background slideshow. `base` is the hero's path ("hero" or "home.hero"). */
export function heroSlidesCard(base: string, artLabel = "the hero's own picture", words = { title: "Headline for this slide (optional)", titleKeep: "the hero's own headline", text: "Text for this slide (optional)", textKeep: "the hero's own text" }): { title: string; fields: Field[] } {
  const P = base + ".slides.";
  const g2 = (...fields: Field[]): Field => ({ t: "grid", cols: 2, fields });
  return {
    title: "Background slides",
    fields: [
      { t: "toggle", path: P + "enabled", label: "Show photos sliding behind the hero" },
      { t: "when", path: P + "enabled", is: "true", fields: [
        { t: "list", path: P + "items", max: 10, title: (it, i) => `Slide ${i + 1}${it?.title ? ": " + String(it.title).split("\n")[0] : ""}${it?.image ? "" : " (no photo)"}`, add: () => ({ image: null, position: "center", title: "", text: "" }),
          item: [{ t: "image", path: "image", label: "Photo", hint: "Wide photos (at least 1920 px across) look best." },
            { t: "select", path: "position", label: "Keep in view when cropped", options: [{ value: "center", label: "Centre" }, { value: "top", label: "Top" }, { value: "bottom", label: "Bottom" }, { value: "left", label: "Left" }, { value: "right", label: "Right" }] },
            { t: "text", path: "title", label: words.title, ml: true, hint: `Empty keeps ${words.titleKeep}.` },
            { t: "textarea", path: "text", label: words.text, rows: 2, hint: `Empty keeps ${words.textKeep}.` }] },
        g2({ t: "select", path: P + "effect", label: "Change effect", options: [{ value: "fade", label: "Fade" }, { value: "slide", label: "Slide across" }, { value: "zoom", label: "Zoom out" }, { value: "kenburns", label: "Slow zoom (Ken Burns)" }] },
          { t: "select", path: P + "height", label: "Hero height", options: [{ value: "auto", label: "Fit the words" }, { value: "tall", label: "Tall" }, { value: "full", label: "Full screen" }] }),
        g2({ t: "range", path: P + "interval", label: "Each slide shows for", min: 2, max: 15, step: 1, unit: " s" }, { t: "range", path: P + "speed", label: "Change takes", min: 0.2, max: 3, step: 0.1, unit: " s" }),
        g2({ t: "range", path: P + "overlay", label: "Darken the photos (so the words stay readable)", min: 0, max: 90, step: 5, unit: "%" }, { t: "color", path: P + "overlayColor", label: "Shade colour" }),
        g2({ t: "select", path: P + "overlayStyle", label: "Shade", options: [{ value: "solid", label: "Even" }, { value: "left", label: "Stronger on the left" }, { value: "bottom", label: "Stronger at the bottom" }] },
          { t: "select", path: P + "textColor", label: "Words over the photos", options: [{ value: "light", label: "White" }, { value: "dark", label: "Dark" }, { value: "theme", label: "Theme colours" }] }),
        g2({ t: "toggle", path: P + "dots", label: "Show dots to pick a slide" }, { t: "toggle", path: P + "arrows", label: "Show arrows (larger screens)" },
          { t: "toggle", path: P + "pause", label: "Pause while the pointer is over the hero" }, { t: "toggle", path: P + "hideArt", label: `Hide ${artLabel} while slides show` }),
        { t: "when", path: P + "hideArt", is: "false", fields: [{ t: "range", path: P + "artOpacity", label: `Opacity of ${artLabel} over the photos`, min: 10, max: 100, step: 5, unit: "%" },
          { t: "note", text: "100% is solid. Lower lets the sliding photos show through, so it sits over them like a glass layer." }] },
        { t: "note", text: "Photos change on their own, with a pause button for visitors. People who ask their device for less motion see one photo at a time and change it with the dots. A single photo stays still." },
      ] },
    ],
  };
}
