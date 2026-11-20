import { legalChecks } from "../lib/legal";
import type { Category, Field, TemplateDef } from "./types";
import { uid, vpaOk, paypalOk, httpsOk } from "../lib/util";
import { BODY_FONTS, DISPLAY_FONTS, LINE_BREAKS_AXIS, STORE_AXES, THEMES, onColor, storeThemeValues } from "../themes/catalog";
import { adminCategory, loyaltyCard, legalCategory, codeCategory, withSectionBg, videoCategory, socialCategory, logoFields, consentCategory, emailsCategory, i18nCategory, prepareI18n, featuresCategory, festivalCategory, menuCategory, menuItem, prepareMenu, staticPagesCategory, heroSlidesCard, prepareSlides, prepareMaintenance, seoCategory, warrantyCategory, customFontsCard } from "./common";
import { NAV_MODE_FIELD, NAV_MODE_MOB_FIELD, themeCards } from "../themes/fields";

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "CAD"];
const FONTS_D = DISPLAY_FONTS;
const FONTS_B = BODY_FONTS;
const g2 = (...fields: Field[]): Field => ({ t: "grid", cols: 2, fields });
const g3 = (...fields: Field[]): Field => ({ t: "grid", cols: 3, fields });

const GST_STATES = ["Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"];
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
        { t: "note", text: "The logo shape is used next to the store name and for the icon in the browser tab. Without a logo image, the icon shows your initials." },
        ...logoFields("brand.logo", 38, "the home page's title"),
        { t: "toggle", path: "brand.showName", label: "Show the store name next to the logo" }] },
      { title: "Announcement bar", fields: [{ t: "toggle", path: "brand.showAnnouncement", label: "Show the bar above the menu" }, { t: "text", path: "brand.announcement", label: "Message", ml: true }] },
      { title: "Colours", fields: [g3(
        { t: "color", path: "theme.bg", label: "Background" }, { t: "color", path: "theme.surface", label: "Cards" }, { t: "color", path: "theme.text", label: "Text" },
        { t: "color", path: "theme.soft", label: "Secondary text" }, { t: "color", path: "theme.line", label: "Borders" }, { t: "color", path: "theme.accent", label: "Accent & buttons" },
        { t: "color", path: "theme.accent2", label: "Second accent" }, { t: "color", path: "theme.sale", label: "Sale & badges" })] },
      { title: "Typography & corners", fields: [g2({ t: "select", path: "theme.fontDisplay", label: "Headings font", options: FONTS_D }, { t: "select", path: "theme.fontBody", label: "Body font", options: FONTS_B }),
        { t: "range", path: "theme.radius", label: "Corner radius", min: 0, max: 28, step: 1, unit: "px" },
        { t: "select", path: "theme.lineBreaks", label: LINE_BREAKS_AXIS.label, options: LINE_BREAKS_AXIS.options.map(([value, label]) => ({ value, label })) },
        { t: "note", text: "Headings and titles break where you press Enter. With “As typed”, a heading you typed on one line stays on one line (it shrinks a little to fit, and only wraps on screens too narrow for it)." }] },
      customFontsCard(),
    ],
  },
  {
    id: "nav", label: "Menu & pages", group: "Design", desc: "Menu labels and which pages appear.",
    cards: [
      { title: "Menu titles", fields: [g2({ t: "text", path: "nav.home", label: "Home" }, { t: "text", path: "nav.shop", label: "Shop" }, { t: "text", path: "nav.portfolio", label: "Story / portfolio page" }, { t: "text", path: "nav.cart", label: "Cart" }, { t: "text", path: "nav.account", label: "Account (when sign-in is on)" }),
        { t: "toggle", path: "nav.showPortfolio", label: "Show the story / portfolio page in the menu" },
        { t: "toggle", path: "nav.crumbs", label: "Show the page trail (Shop / Category / Product, Home / Page name) at the top of pages" }] },
      { title: "Menu when scrolling", fields: [NAV_MODE_FIELD, NAV_MODE_MOB_FIELD, { t: "note", text: "Theme default keeps the menu at the top of the screen while shoppers scroll. The same setting is under Theme & layout." }] },
      { title: "Footer titles & links", fields: [g2({ t: "text", path: "labels.allProducts", label: "“All products” link" }, { t: "text", path: "labels.viewAll", label: "“View all” link on the home page" },
        { t: "text", path: "labels.help", label: "Footer column: help & policies" }, { t: "text", path: "labels.contact", label: "Footer column: contact" })] },
    ],
  },
  menuCategory({ where: "the shop's pages (Home, Shop, your story, custom pages and Account)", targets: [{ value: "home", label: "Home" }, { value: "shop", label: "Shop (all products)" }, { value: "cat", label: "A product category" }, { value: "portfolio", label: "Story / portfolio page" }, { value: "policies", label: "Policies" }, { value: "warranty", label: "Warranty & status check" }, { value: "account", label: "Account" }, { value: "cart", label: "Cart" }],
    extra: [{ t: "when", local: true, path: "to", is: "cat", fields: [{ t: "ref", path: "cat", label: "Category", source: "categories", valueKey: "id", labelKey: "name", empty: "Choose a category" }] }] }, "Design"),
  {
    id: "home", label: "Home page", group: "Pages", desc: "The landing page: hero, featured products, categories, banner and reviews.",
    cards: [
      { title: "Hero", fields: [{ t: "text", path: "home.hero.eyebrow", label: "Small label", ml: true }, { t: "text", path: "home.hero.title", label: "Headline", ml: true }, { t: "textarea", path: "home.hero.text", label: "Text", hint: "Line breaks you type show on the site." },
        { t: "text", path: "home.hero.cta", label: "Button label" }, { t: "image", path: "home.hero.image", label: "Hero image", hint: "Wide images look best. Without one, a pattern in your colours is used." },
        { t: "videoFile", path: "home.hero.video", label: "Or a hero video", hint: "MP4 or WebM, up to 20 MB. It plays silently on a loop in the image's place; the image is shown first, while it loads. A short clip works best." }] },
      heroSlidesCard("home.hero", "the hero image or collage"),
      { title: "Featured products", fields: [g2({ t: "text", path: "home.featuredTitle", label: "Title", ml: true }, { t: "text", path: "home.featuredText", label: "Line under the title", ml: true }),
        { t: "note", text: "Mark products as featured under Products. Up to 8 are shown." }] },
      { title: "Categories", fields: [{ t: "toggle", path: "home.showCategories", label: "Show categories on the home page" }, { t: "text", path: "home.categoriesTitle", label: "Title", ml: true }] },
      { title: "Banner", fields: [{ t: "toggle", path: "home.banner.show", label: "Show the banner" }, { t: "text", path: "home.banner.title", label: "Title", ml: true }, { t: "textarea", path: "home.banner.text", label: "Text", hint: "Line breaks you type show on the site." },
        { t: "text", path: "home.banner.cta", label: "Button label (opens the portfolio page)" }, { t: "image", path: "home.banner.image", label: "Banner image" }] },
      { title: "Reviews from Google", studio: true, fields: [{ t: "googleReviews" }] },
      { title: "Customer reviews", fields: [{ t: "text", path: "home.testimonialsTitle", label: "Title", ml: true },
        { t: "list", path: "home.testimonials", add: () => ({ quote: "", name: "", role: "" }), max: 6, title: (it) => it.name || "Review",
          item: [{ t: "textarea", path: "quote", label: "Quote" }, g2({ t: "text", path: "name", label: "Name" }, { t: "text", path: "role", label: "Detail (city, product)" }), { t: "select", path: "rating", label: "Stars", options: [{ value: "", label: "None" }, { value: "5", label: "★★★★★" }, { value: "4", label: "★★★★" }, { value: "3", label: "★★★" }, { value: "2", label: "★★" }, { value: "1", label: "★" }] }] },
        { t: "note", text: "Only add reviews real customers gave you.", tone: "warn" }] },
    ],
  },
  {
    id: "products", label: "Products", group: "Catalogue", desc: "Everything you sell. Each product gets its own page.",
    cards: [
      { title: "Fill in from a PDF or pamphlet", studio: true, fields: [{ t: "pamphlet" }] },
      { title: "Product photos in bulk", fields: [{ t: "bulkPhotos", kind: "product" }] },
      { title: "Products", fields: [{ t: "list", path: "products", title: (it) => `${it.name || "Untitled"} · ${Number(it.price) || 0}${it.featured ? " · featured" : ""}${it.stock === "out" ? " · sold out" : ""}${it.sample ? " · sample" : ""}`,
        add: () => ({ id: uid("p"), slug: "", name: "New product", category: "", price: 999, compareAt: 0, images: [], short: "", description: "", features: [], optionName: "", options: [], stock: "in", featured: false, badge: "" }),
        item: [
          g2({ t: "text", path: "name", label: "Name" }, { t: "ref", path: "category", label: "Category", source: "categories", valueKey: "id", labelKey: "name", empty: "No category" }),
          g3({ t: "number", path: "price", label: "Price", min: 0, step: 1 }, { t: "number", path: "compareAt", label: "Was price (optional)", min: 0, step: 1 }, { t: "select", path: "stock", label: "Stock", options: [{ value: "in", label: "In stock" }, { value: "low", label: "Low stock" }, { value: "out", label: "Sold out" }] }),
          { t: "when", path: "gst.on", is: "true", fields: [g2({ t: "text", path: "hsn", label: "HSN code (for the GST invoice)", ph: "the shop's default" }, { t: "select", path: "gstRate", label: "GST rate", options: [{ value: "", label: "The shop's default rate" }, ...["0", "0.25", "3", "5", "12", "18", "28"].map((v) => ({ value: v, label: v + "%" }))] })] },
          { t: "images", path: "images", label: "Photos", hint: "The first photo is the main one." },
          { t: "text", path: "short", label: "One-line summary" },
          { t: "textarea", path: "description", label: "Description", rows: 5, hint: "Leave a blank line between paragraphs." },
          { t: "strings", path: "features", label: "Key details", addLabel: "Add detail" },
          g2({ t: "text", path: "optionName", label: "Option name (e.g. Size)" }, { t: "text", path: "badge", label: "Badge (e.g. New)" }),
          { t: "strings", path: "options", label: "Option choices", addLabel: "Add choice" },
          { t: "toggle", path: "kindsOn", label: "This product comes in varieties with their own prices (the buyer must choose one)" },
          { t: "when", path: "kindsOn", is: "true", local: true, fields: [
            { t: "text", path: "kindName", label: "What the varieties are called", ph: "Variety" },
            { t: "list", path: "kinds", label: "Varieties with their own prices", max: 20, title: (it) => `${it.label || "Variety"}${it.price !== "" && it.price != null ? " · " + it.price : ""}`, add: () => ({ label: "", price: 0 }), item: [g2({ t: "text", path: "label", label: "Variety", ph: "500 g" }, { t: "number", path: "price", label: "Price", min: 0, step: 1 })] },
            { t: "note", text: "The product page shows the varieties as buttons with none chosen: the price shows “From” the lowest one until the buyer picks, and it can only be added to the cart after that. The product's own Price is not used then. Options without a price (colour, say) still go in the Options list." }] },
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
  videoCategory("Pages"),
  socialCategory("Pages"),
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
    id: "delivery", label: "Delivery areas", group: "Selling", desc: "Which PIN codes you deliver to, what each area costs and how long it takes. Shoppers check their PIN on the product page and in the cart.",
    cards: [
      { title: "Delivery by PIN code", fields: [
        { t: "toggle", path: "shipping.on", label: "Deliver by PIN code" },
        { t: "note", text: "While this is off, every order ships at the flat fee under Prices & shipping. Switch it on to set areas with their own charge, delivery time and cash-on-delivery rule, and to stop orders from places you don't reach." },
        { t: "when", path: "shipping.on", is: "true", fields: [
          { t: "list", path: "shipping.zones", max: 30, add: () => ({ id: "z-" + Math.random().toString(36).slice(2, 8), on: true, name: "New area", pins: "", fee: "", freeOver: "", days: "", cod: true }),
            title: (it) => `${it?.name || "Area"}${it?.fee !== "" && it?.fee != null ? ` · ${Number(it.fee) ? "fee " + it.fee : "free"}` : ""}${it?.days ? ` · ${it.days}` : ""}${it?.on === false ? " · off" : ""}`,
            item: [
              g2({ t: "text", path: "name", label: "Area name (for you)", ph: "Mumbai" }, { t: "toggle", path: "on", label: "Deliver here" }),
              { t: "textarea", path: "pins", label: "PIN codes", rows: 2, hint: "Separate with commas. A full PIN (400001), a range (400001-400104), or the first digits for a whole region (40 covers every PIN starting with 40)." },
              g3({ t: "number", path: "fee", label: "Shipping fee", min: 0, hint: "Empty uses the flat fee." }, { t: "number", path: "freeOver", label: "Free over", min: 0, hint: "Empty uses the shop's rule." }, { t: "text", path: "days", label: "Delivery time", ph: "2–3 days" }),
              { t: "toggle", path: "cod", label: "Cash on delivery available here" },
            ] },
          { t: "note", text: "Areas are checked from the top: the first one that covers a PIN wins. Put the most specific area first." },
        ] },
      ] },
      { title: "Everywhere else", fields: [
        { t: "when", path: "shipping.on", is: "true", fields: [
          { t: "select", path: "shipping.rest", label: "A PIN code that no area covers", options: [{ value: "serve", label: "Still deliver there" }, { value: "no", label: "Don't deliver: the order is stopped" }] },
          { t: "when", path: "shipping.rest", is: "serve", fields: [g3({ t: "number", path: "shipping.restFee", label: "Shipping fee", min: 0, hint: "Empty uses the flat fee." }, { t: "text", path: "shipping.restDays", label: "Delivery time", ph: "5–7 days" }, { t: "toggle", path: "shipping.restCod", label: "Cash on delivery" })] },
          { t: "when", path: "shipping.rest", is: "no", fields: [{ t: "text", path: "shipping.blockMsg", label: "What shoppers are told", ph: "Sorry, we don't deliver to that PIN code yet." }] },
          { t: "text", path: "shipping.checkLabel", label: "Label above the PIN box", ph: "Check delivery to your PIN code" },
        ] },
        { t: "note", text: "With a shop backend, the backend checks the PIN and the fee again when the order is placed. Publish the site and update the backend once after changing these (Accounts & backend)." },
      ] },
      { title: "Couriers and tracking", fields: [
        { t: "note", text: "When an order ships, open it under Orders, choose the courier and type its tracking number: the customer sees a “Track your parcel” link on their order and in the shipped email. Orders also has buttons that open each courier's booking page with the address ready to paste. Booking itself happens on the courier's own site." },
      ] },
    ],
  },
  {
    id: "gst", label: "GST invoices", group: "Selling", desc: "A tax invoice for every order, with your GSTIN, HSN codes and the CGST/SGST or IGST split, that customers and you can print or save as PDF.",
    cards: [
      { title: "GST invoice", fields: [
        { t: "toggle", path: "gst.on", label: "Offer a GST invoice on every order" },
        { t: "when", path: "gst.on", is: "true", fields: [
          g2({ t: "text", path: "gst.legalName", label: "Legal name of the business", ph: "as on the GST certificate" }, { t: "text", path: "gst.gstin", label: "GSTIN", ph: "27ABCDE1234F1Z5" }),
          { t: "textarea", path: "gst.address", label: "Registered address", rows: 2 },
          g3({ t: "select", path: "gst.state", label: "State", options: [{ value: "", label: "Choose the state" }, ...GST_STATES.map((n) => ({ value: n, label: n }))] }, { t: "text", path: "gst.pan", label: "PAN (optional)" }, { t: "text", path: "gst.prefix", label: "Invoice number starts with", ph: "INV-" }),
          g3({ t: "select", path: "gst.defaultRate", label: "Usual GST rate", options: ["0", "0.25", "3", "5", "12", "18", "28"].map((v) => ({ value: v, label: v + "%" })) }, { t: "text", path: "gst.defaultHsn", label: "Usual HSN code" }, { t: "toggle", path: "gst.askGstin", label: "Ask business buyers for their GSTIN at checkout" }),
          g2({ t: "text", path: "gst.sign", label: "Signature line", ph: "Authorised signatory" }, { t: "text", path: "gst.notes", label: "Note at the bottom (optional)", ph: "Goods once sold are not returnable." }),
          { t: "note", text: "Each product can have its own HSN code and rate (Products → open a product). Prices are read as including GST, so the invoice total always equals what the customer paid; if the shop adds one tax percentage on top (Prices & shipping → Tax, not included), that percentage is used instead. Buyers in your state get CGST + SGST, others IGST. The invoice number is your prefix plus the order number." },
          { t: "note", text: "This prepares the invoice; it doesn't file anything with the GST portal. Have your accountant check the rates, HSN codes and number series before you rely on it.", tone: "warn" },
        ] },
      ] },
    ],
  },
  {
    id: "checkout", label: "Checkout", group: "Selling", desc: "What shoppers fill in and what they see after ordering.",
    cards: [
      { title: "Form", fields: [g2({ t: "text", path: "checkout.title", label: "Page title", ml: true }, { t: "text", path: "checkout.button", label: "Order button label" }), { t: "textarea", path: "checkout.intro", label: "Intro" },
        g3({ t: "toggle", path: "checkout.askPhone", label: "Ask for phone" }, { t: "toggle", path: "checkout.askAddress", label: "Ask for address" }, { t: "toggle", path: "checkout.askNotes", label: "Ask for notes" }),
        { t: "select", path: "checkout.need", label: "A shopper must give", options: [{ value: "", label: "Standard: email (and phone if asked above)" }, { value: "phone", label: "Mobile number (email optional)" }, { value: "email", label: "Email address (mobile optional)" }, { value: "both", label: "Both mobile number and email" }, { value: "either", label: "Either one: mobile number or email" }] },
        { t: "toggle", path: "checkout.verifyEmail", label: "Verify the email address with a code before the order is placed" },
        { t: "when", path: "checkout.verifyEmail", is: "true", fields: [{ t: "note", text: "The shopper is emailed a 6-digit code and enters it at checkout; the order then shows “Email: verified by a code” under Purchased orders. This works on a shop hosted on Cloudflare, and the codes are sent by that database's own email (Resend). While its sender is still in test mode, codes can't reach shoppers: orders are then let through and marked “not verified”, so nobody is locked out. Send from your own domain (hosting window → Email settings) to verify everyone. An email address is checked only when one is given: choose Email or Both above to ask every shopper for it." }] },
        { t: "note", text: "Any choice but Standard shows both boxes, with the one that isn't required marked optional. A shop with customer accounts always needs the email. Points are spent with a WhatsApp code, so they need a phone number." }] },
      { title: "After ordering", fields: [{ t: "text", path: "checkout.successTitle", label: "Title", ml: true }, { t: "textarea", path: "checkout.successText", label: "Text" }] },
    ],
  },
  {
    id: "payments", label: "Payments", group: "Selling", desc: "Turn on the ways customers can pay. A gateway shows at checkout once its keys are saved. The keys are kept on the shop's own Cloudflare database (Host to External Services), encrypted.",
    cards: [
      { title: "UPI", fields: [{ t: "toggle", path: "payments.upi.enabled", label: "Accept UPI (INR only)" }, g2({ t: "text", path: "payments.upi.vpa", label: "UPI ID", ph: "name@bank", check: "vpa" }, { t: "text", path: "payments.upi.payeeName", label: "Payee name (as your bank shows it)" }),
        { t: "text", path: "payments.upi.label", label: "Label at checkout" }, { t: "note", text: "The customer pays first: checkout shows a UPI QR code and app button with the exact order total and order number, and the order is placed only when they enter the payment's 12-digit reference number (UTR). On a shop hosted on your Cloudflare database the order then appears under Purchased orders as “Payment to check”; find the reference in your UPI app and press Payment received. With the shop backend on, the customer enters the UTR after ordering and you tap Mark paid. For confirmation with no checking at all, turn on Razorpay, which includes UPI." }] },
      { title: "Razorpay", fields: [{ t: "toggle", path: "payments.razorpay.enabled", label: "Accept Razorpay (UPI, cards, netbanking): confirmed automatically" },
        { t: "connection", kind: "rz" },
        { t: "note", text: "Razorpay tells your database by itself that the money arrived, so the order is placed and marked Paid with no checking by you. The amount is worked out by your database from your products, delivery charges and tax, not by the customer's phone. Razorpay charges its usual fee per payment. Prices in INR only. Try it with a rzp_test_ key first: test mode takes no real money." },
        { t: "text", path: "payments.razorpay.label", label: "Label at checkout" }] },
      { title: "Cashfree", fields: [{ t: "toggle", path: "payments.cashfree.enabled", label: "Accept Cashfree (UPI, cards, netbanking): confirmed automatically" },
        { t: "connection", kind: "cf" },
        { t: "note", text: "The customer pays on Cashfree's page and comes back to the shop; your database then asks Cashfree whether the money arrived, and only then places the order, marked Paid, under Purchased orders. Needs the customer's 10-digit mobile number (keep Ask for phone on). Prices in INR only. Tick the test switch with sandbox keys to try it with no real money." },
        { t: "text", path: "payments.cashfree.label", label: "Label at checkout" }] },
      { title: "PhonePe", fields: [{ t: "toggle", path: "payments.phonepe.enabled", label: "Accept PhonePe (UPI, cards, netbanking): confirmed automatically" },
        { t: "connection", kind: "pe" },
        { t: "note", text: "The customer pays on PhonePe's page and comes back to the shop; your database then asks PhonePe whether the money arrived, and only then places the order, marked Paid, under Purchased orders. Prices in INR only. Use the Client ID, version and secret of PhonePe's Standard Checkout." },
        { t: "text", path: "payments.phonepe.label", label: "Label at checkout" }] },
      { title: "Stripe", fields: [{ t: "toggle", path: "payments.stripe.enabled", label: "Accept Stripe (cards from any country): confirmed automatically" },
        { t: "connection", kind: "st" },
        { t: "note", text: "The customer pays on Stripe's page and comes back to the shop; your database then asks Stripe whether the money arrived, and only then places the order, marked Paid, under Purchased orders." },
        { t: "text", path: "payments.stripe.label", label: "Label at checkout" }] },
      { title: "PayPal", fields: [{ t: "toggle", path: "payments.paypal.enabled", label: "Accept PayPal: confirmed automatically" },
        { t: "connection", kind: "pp" },
        { t: "note", text: "The customer pays on PayPal's page and comes back to the shop; your database then collects the payment and only then places the order, marked Paid, under Purchased orders. PayPal doesn't take INR: use it for a shop priced in USD, EUR or GBP." },
        { t: "text", path: "payments.paypal.label", label: "Label at checkout" }] },
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
        { t: "note", text: "With the backend on, Razorpay and Stripe charge the exact order total in their secure checkout, with the keys set on that backend. A UPI payment is confirmed when you tap Mark paid in Orders. Customers and you get emails as soon as a payment goes through.", tone: "info" },
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
  staticPagesCategory("page"),
  warrantyCategory("page"),
  emailsCategory(false),
  featuresCategory(),
  festivalCategory(),
  i18nCategory(),
  seoCategory(true),
  consentCategory(),
  legalCategory(),
  adminCategory(),
  codeCategory(),
];
{ const k = schema.find((c) => c.id === "pricing"); if (k) k.cards.push(loyaltyCard("store")); }
withSectionBg(schema, { home: [["hero", "Background & text: hero"], ["featured", "Background & text: featured products"], ["categories", "Background & text: categories"], ["banner", "Background & text: banner"], ["reviews", "Background & text: customer reviews"]], contact: [["footer", "Background & text: footer"]] }, [...FONTS_D, ...FONTS_B]);

/** Defaults for settings added after a shop was made. */
export const STORE_LABELS = { allProducts: "All products", viewAll: "View all", help: "Help", contact: "Contact" };
export function prepareStore(c: any) {
  if (c && typeof c === "object") {
    const H = c.shipping && typeof c.shipping === "object" ? c.shipping : {};
    c.shipping = { on: false, rest: "serve", restFee: "", restDays: "", restCod: true, blockMsg: "", checkLabel: "", ...H, zones: Array.isArray(H.zones) ? H.zones : [] };
    const G = c.gst && typeof c.gst === "object" ? c.gst : {};
    c.gst = { on: false, legalName: "", gstin: "", address: "", state: "", pan: "", prefix: "INV-", defaultHsn: "", askGstin: false, sign: "", notes: "", ...G, defaultRate: String(G.defaultRate ?? "18") };
  }
  if (c && typeof c === "object" && c.home?.hero) prepareSlides(c.home.hero, "#000000");
  if (c && typeof c === "object") c.loyalty = { on: false, earn: 5, worth: 1, min: 50, maxPct: 50, ...(c.loyalty && typeof c.loyalty === "object" ? c.loyalty : {}) };
  prepareMaintenance(c);
  prepareI18n(c, () => schema);
  prepareMenu(c, () => [menuItem(c.nav?.home || "Home", "home"), { ...menuItem(c.nav?.shop || "Shop", "shop"), children: (Array.isArray(c.categories) ? c.categories : []).slice(0, 12).map((k: any) => menuItem(k.name || "Category", "cat", { cat: k.id })) },
    ...(c.nav?.showPortfolio !== false ? [menuItem(c.nav?.portfolio || "Our story", "portfolio")] : [])]);
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
    const live = (p.upi?.enabled && vpaOk(p.upi.vpa)) || (p.razorpay?.enabled && (be || httpsOk(p.razorpay.link))) || (p.stripe?.enabled && (be || httpsOk(p.stripe.link))) || (p.paypal?.enabled && paypalOk(p.paypal.username)) || p.cod?.enabled
      // A gateway whose keys are on the shop's own database: the editor can't see the keys, so the switch counts.
      || (!be && (p.razorpay?.enabled || p.cashfree?.enabled || p.phonepe?.enabled || p.stripe?.enabled || p.paypal?.enabled));
    if (c?.backend?.enabled && !be) w.push(cf ? "The shop backend is switched on but its Worker URL is missing." : "The shop backend is switched on but its Project URL or public key is missing.");
    if (cf && /github\.com|github\.io/.test(c?.backend?.workerUrl || "")) w.push("The Worker URL looks like a GitHub address. Use the workers.dev address of your Cloudflare Worker.");
    if (!cf && c?.backend?.anonKey && /service_role/.test(atobSafe(c.backend.anonKey))) w.push("The key under Accounts & backend is a service_role key. Replace it with the anon public key now.");
    if (!live) w.push("No payment method is switched on with valid details.");
    if (!be && !c?.orders?.whatsapp && !c?.orders?.email) w.push("No WhatsApp number or email is set to receive orders.");
    if (!(c?.products || []).length) w.push("The shop has no products.");
    const samples = (c?.products || []).filter((x: any) => x.sample).length;
    if (samples) w.push(`${samples} sample product${samples > 1 ? "s are" : " is"} still in the catalogue.`);
    return [...w, ...legalChecks("store", c)];
  },
};
