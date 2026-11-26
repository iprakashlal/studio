import { legalChecks } from "../lib/legal";
import type { Category, Field, TemplateDef } from "./types";
import { BODY_FONTS, DISPLAY_FONTS, FX_AXES, HERO_FX_AXIS, LOADER_ON_AXIS, LINE_BREAKS_AXIS, type Axis } from "../themes/catalog";
import { BIZ_AXES, BIZ_TAGS, BIZ_THEMES, businessThemeValues } from "../themes/business";
import { INTRO_CARD, NAV_MODE_FIELD, NAV_MODE_MOB_FIELD } from "../themes/fields";
import { ANIM_BG_FIELDS, adminCategory, legalCategory, codeCategory, withSectionBg, videoCategory, wallCategory, WALL_SWITCH, socialCategory, logoFields, consentCategory, emailsCategory, i18nCategory, prepareI18n, featuresCategory, festivalCategory, menuCategory, menuItem, prepareMenu, staticPagesCategory, heroSlidesCard, prepareSlides, prepareMaintenance, seoCategory, warrantyCategory, customFontsCard } from "./common";

const g2 = (...fields: Field[]): Field => ({ t: "grid", cols: 2, fields });
const g3 = (...fields: Field[]): Field => ({ t: "grid", cols: 3, fields });
const sel = (a: Axis): Field => ({ t: "select", path: "theme." + a.key, label: a.label, options: a.options.map(([value, label]) => ({ value, label })) });

const SECTIONS: [string, string][] = [["hero", "Hero"], ["clients", "Clients"], ["services", "Services"], ["products", "Products"], ["stats", "Numbers"], ["work", "Case studies"], ["about", "About"], ["process", "Process"], ["team", "Team"], ["testimonials", "Testimonials"], ["pricing", "Pricing"], ["faq", "FAQ"], ["cta", "Call to action"], ["contact", "Contact"]];
const TARGETS = SECTIONS.filter(([id]) => id !== "hero").map(([value, label]) => ({ value, label }));
/** Where a button can go: a section, or a link the person types. */
const GOES = [...TARGETS, { value: "url", label: "A custom link…" }];
const linkWhen = (path: string, label: string): Field => ({ t: "when", path, is: "url", fields: [{ t: "text", path: path + "Url", label, ph: "https://…", hint: "A full web address (a link to another site, a WhatsApp link, a PDF…)." }] });
const ICONS: [string, string][] = [["compass", "Compass (strategy)"], ["layers", "Layers (design)"], ["code", "Code"], ["chart", "Chart (growth)"], ["shield", "Shield (security)"], ["people", "People"], ["cloud", "Cloud"], ["globe", "Globe"], ["cog", "Cog (operations)"], ["spark", "Spark (ideas)"], ["briefcase", "Briefcase"], ["scale", "Scales (legal)"], ["building", "Building"], ["heart", "Heart (care)"], ["leaf", "Leaf (sustainability)"], ["rocket", "Rocket (launch)"]];
const head = (k: string, title = "Section heading"): Card => ({ title, fields: [g2({ t: "text", path: k + ".eyebrow", label: "Small label above" }, { t: "text", path: k + ".title", label: "Heading", ml: true }), { t: "textarea", path: k + ".lede", label: "Intro line", rows: 2 }] });
type Card = Category["cards"][number];

const schema: Category[] = [
  {
    id: "look", label: "Theme & layout", group: "Design", desc: `Choose from ${BIZ_THEMES.length} business themes, then fine-tune the layout and style.`,
    cards: [
      { title: "Theme", fields: [{ t: "note", studio: true, text: `${BIZ_THEMES.length} business themes (B-01 to B-${BIZ_THEMES.length}). Picking one restyles the whole site: colours, fonts, hero layout, menu, cards, buttons and section style. Your content stays as it is, and every setting below stays editable.` }, { t: "themes" }] },
      { title: "Layout", fields: [g2(sel(BIZ_AXES.layout), sel(BIZ_AXES.heroArt), sel(BIZ_AXES.nav), NAV_MODE_FIELD, NAV_MODE_MOB_FIELD, sel(BIZ_AXES.width), sel(BIZ_AXES.bands))] },
      { title: "Style", fields: [g2(sel(BIZ_AXES.heading), sel(BIZ_AXES.shead), sel(BIZ_AXES.cards), sel(BIZ_AXES.buttons), sel(BIZ_AXES.pattern), sel(BIZ_AXES.motionStyle)),
        { t: "note", text: "“Full-width photo” needs a hero image (Hero → Image); without one the hero uses the split layout. Visitors who ask their device for reduced motion always get a still page." }, ...ANIM_BG_FIELDS] },
      { title: "Interactions (optional)", fields: [{ t: "note", text: "Business themes keep these off for a calm, professional feel. Switch one on if it suits your brand." },
        g2({ ...sel(FX_AXES.cursor) }, sel(FX_AXES.loader), sel(FX_AXES.textfx), sel(FX_AXES.hoverfx), sel(FX_AXES.scrollfx), sel(FX_AXES.overlay)), sel(LOADER_ON_AXIS), sel(HERO_FX_AXIS), { t: "note", text: "Hero graphic effect is a slow, quiet loop on the hero's picture or graphic, drawn in your theme's accent colours. It stays still for visitors who ask their device for less motion." }] },
      { ...INTRO_CARD, fields: [{ t: "note", text: "Shown when “Intro & page transition” above is set to anything but None. Leave a colour empty to use the theme's own." }, ...INTRO_CARD.fields.slice(1)] },
    ],
  },
  {
    id: "brand", label: "Brand & theme", group: "Design", desc: "Company name, logo, colours and fonts.",
    cards: [
      { title: "Brand", fields: [g2({ t: "text", path: "brand.name", label: "Company name" }, { t: "text", path: "brand.tagline", label: "Tagline", ml: true }),
        { t: "image", path: "brand.logo", label: "Logo icon", hint: "A square logo works best. Without one, your initials show in your primary colour. It's also the browser tab icon." },
        { t: "range", path: "theme.logoRadius", label: "Logo shape: 0 = square, 50 = circle", min: 0, max: 50, step: 1, unit: "%" },
        ...logoFields("brand.logo", 36),
        { t: "toggle", path: "brand.showName", label: "Show the company name next to the logo" }] },
      { title: "Colours", fields: [g3(
        { t: "color", path: "theme.bg", label: "Background" }, { t: "color", path: "theme.surface", label: "Cards" }, { t: "color", path: "theme.text", label: "Text" },
        { t: "color", path: "theme.soft", label: "Secondary text" }, { t: "color", path: "theme.line", label: "Borders" }, { t: "color", path: "theme.deep", label: "Dark panels & footer" },
        { t: "color", path: "theme.c1", label: "Primary (buttons, links)" }, { t: "color", path: "theme.c2", label: "Secondary" }, { t: "color", path: "theme.c3", label: "Highlight" })] },
      { title: "Typography & corners", fields: [g2({ t: "select", path: "theme.fontDisplay", label: "Headings font", options: DISPLAY_FONTS }, { t: "select", path: "theme.fontBody", label: "Body font", options: BODY_FONTS }),
        { t: "select", path: "theme.lineBreaks", label: LINE_BREAKS_AXIS.label, options: LINE_BREAKS_AXIS.options.map(([value, label]) => ({ value, label })) },
        { t: "range", path: "theme.radius", label: "Corner radius", min: 0, max: 28, step: 1, unit: "px" }] },
      customFontsCard(),
    ],
  },
  {
    id: "pages", label: "Sections & order", group: "Pages", desc: "One page or several, which sections show, their order and the menu.",
    cards: [
      { title: "Pages", fields: [{ t: "toggle", path: "site.multiPage", label: "Use several pages (Home, Services, Products, Work, About, Contact)" },
        { t: "toggle", path: "site.crumbs", label: "Show the page trail (Home / Page name) at the top of inner pages" },
        { t: "note", text: "Off: one page with every section, and the menu scrolls to them. On: Home shows the highlights (hero, clients, a few services, numbers, a few case studies, testimonials) and the menu opens Services, Work, About and Contact pages." },
        { t: "when", path: "site.multiPage", is: "true", fields: [g3({ t: "text", path: "site.pageLabels.home", label: "Home page name" }, { t: "text", path: "site.pageLabels.services", label: "Services page name" }, { t: "text", path: "site.pageLabels.products", label: "Products page name" }, { t: "text", path: "site.pageLabels.work", label: "Work page name" },
          { t: "text", path: "site.pageLabels.about", label: "About page name" }, { t: "text", path: "site.pageLabels.contact", label: "Contact page name" })] }] },
      { title: "Sections", fields: [{ t: "note", text: "Reorder with the arrows. Hidden sections stay in your content. On one page, sections with “In the menu” get a menu link." },
        { t: "list", path: "sections", fixed: true, add: () => ({}), title: (it) => `${it.label || it.id}${it.show === false ? " (hidden)" : ""}`,
          item: [g2({ t: "text", path: "label", label: "Menu name" }, { t: "toggle", path: "show", label: "Show this section" }), { t: "toggle", path: "inNav", label: "In the menu (one-page mode)" }] }, ...WALL_SWITCH] },
      { title: "Menu button", fields: [g2({ t: "text", path: "nav.cta", label: "Button label (empty hides it)" }, { t: "select", path: "nav.ctaTarget", label: "Goes to", options: GOES }), linkWhen("nav.ctaTarget", "Custom link for the menu button")] },
    ],
  },
  menuCategory({ note: "On a one-page site (“Use several pages” off), a link to a section with “Open in a new tab” switched on gives that section a page of its own, opened in the same tab like any page of a site with several pages, and the section no longer shows on the main page. Buttons that point to that section open its page too.", where: "the sections marked “In the menu” (or the site's pages when it has several)", targets: [{ value: "home", label: "Home (top of the site)" }, ...TARGETS.map((t) => ({ value: t.value, label: `Section: ${t.label}` })), { value: "warranty", label: "Warranty & status check" }] }),
  {
    id: "hero", label: "Hero", group: "Pages", sub: "Sections", desc: "The first screen: headline, intro, buttons, trust badges and image.",
    cards: [
      { title: "Text", fields: [{ t: "text", path: "hero.eyebrow", label: "Small label above" }, { t: "text", path: "hero.title", label: "Headline", ml: true, hint: "Enter starts a new line. Wrap words in *asterisks* to highlight them." }, { t: "textarea", path: "hero.lede", label: "Intro", rows: 3 }] },
      { title: "Buttons", fields: [g2({ t: "text", path: "hero.ctaPrimary", label: "Main button" }, { t: "select", path: "hero.ctaPrimaryTarget", label: "Goes to", options: GOES }, { t: "text", path: "hero.ctaSecondary", label: "Second button" }, { t: "select", path: "hero.ctaSecondaryTarget", label: "Goes to", options: GOES }), linkWhen("hero.ctaPrimaryTarget", "Custom link for the main button"), linkWhen("hero.ctaSecondaryTarget", "Custom link for the second button")] },
      { title: "Trust badges", fields: [{ t: "strings", path: "hero.badges", label: "Short proof points under the buttons", addLabel: "Add badge" }] },
      { title: "Image", fields: [{ t: "image", path: "hero.image", label: "Hero image (optional)", hint: "A team photo, your office or your product. Without one, the hero shows cards built from your numbers and services (edit them below)." },
        { t: "videoFile", path: "hero.video", label: "Or a hero video", hint: "MP4 or WebM, up to 20 MB. It plays silently on a loop in the image's place; the image above is shown first, while it loads. A short clip works best." }] },
      { title: "Cards beside the headline", fields: [
        { t: "when", path: "hero.image", not: "", fields: [{ t: "note", text: "These cards show when there's no hero image. Remove the image above to use them." }] },
        { t: "toggle", path: "hero.panel.show", label: "Show the cards" },
        { t: "when", path: "hero.panel.show", is: "true", fields: [
          { t: "select", path: "hero.panel.source", label: "What the cards say", options: [{ value: "auto", label: "My first numbers and services" }, { value: "own", label: "What I write here" }] },
          { t: "when", path: "hero.panel.source", is: "auto", fields: [{ t: "note", text: "The big card shows your first number, the dark card your second, and the list your first three services. Change them in Numbers and Services, or choose What I write here." }] },
          { t: "when", path: "hero.panel.source", is: "own", fields: [
            g2({ t: "text", path: "hero.panel.aLabel", label: "Big card: label", ph: "Years in business" }, { t: "text", path: "hero.panel.aValue", label: "Big card: number", ph: "12+" }),
            { t: "toggle", path: "hero.panel.bars", label: "Show the bar chart on the big card" },
            { t: "list", path: "hero.panel.rows", label: "List card", max: 4, title: (it) => it.title || "Line", add: () => ({ icon: "spark", title: "" }),
              item: [g2({ t: "text", path: "title", label: "Text" }, { t: "select", path: "icon", label: "Icon", options: ICONS.map(([value, label]) => ({ value, label })) })] },
            g2({ t: "text", path: "hero.panel.cLabel", label: "Dark card: label", ph: "Projects delivered" }, { t: "text", path: "hero.panel.cValue", label: "Dark card: number", ph: "120+" }),
            { t: "note", text: "An empty card is left out." }] },
          { t: "toggle", path: "hero.panel.dot", label: "Show the round accent" }] }] },
      heroSlidesCard("hero", "the hero image or panel"),
    ],
  },
  {
    id: "products", label: "Products", group: "Pages", sub: "Sections", desc: "A catalogue: product cards with View more and Enquire, a page listing them all, and a page for each product.",
    cards: [
      head("products"),
      { title: "How the catalogue shows", fields: [
        g2({ t: "number", path: "products.homeCount", label: "Products shown in the section", min: 1, step: 1 }, { t: "text", path: "products.all", label: "Link to all products" }),
        g2({ t: "text", path: "products.more", label: "View more button" }, { t: "text", path: "products.enquire", label: "Enquire button" }),
        g2({ t: "toggle", path: "products.showPrice", label: "Show prices" }, { t: "toggle", path: "products.filter", label: "Category filter on the products page" }, { t: "toggle", path: "products.related", label: "Show more from the same category on each product page" }),
        { t: "note", text: "View more opens the product's own page (product.html). Enquire opens the enquiry form with the product filled in. Without the form, it opens WhatsApp, or else email, with a message about the product. The section shows the first products; the rest are on the products page." },
      ] },
      { title: "Fill in from a pamphlet", studio: true, fields: [{ t: "pamphlet" }] },
      { title: "Products", fields: [{ t: "list", path: "products.items", max: 200, title: (it) => `${it.name || "Product"}${it.category ? " · " + it.category : ""}`, add: () => ({ name: "New product", category: "", badge: "", summary: "", price: "", images: [], features: [], details: "", specs: [] }),
        item: [g2({ t: "text", path: "name", label: "Name" }, { t: "text", path: "category", label: "Category" }),
          g2({ t: "text", path: "price", label: "Price (optional)", ph: "₹12,500 or On request" }, { t: "text", path: "badge", label: "Badge (optional)", ph: "New, Bestseller" }),
          { t: "textarea", path: "summary", label: "Short description (on the card)", rows: 2 },
          { t: "images", path: "images", label: "Photos", hint: "The first photo is shown on the card. All of them show on the product page." },
          { t: "strings", path: "features", label: "Key features", addLabel: "Add feature" },
          { t: "textarea", path: "details", label: "Full description (product page)", rows: 5, hint: "Leave an empty line between paragraphs." },
          { t: "list", path: "specs", max: 30, title: (it) => `${it.label || "Spec"}${it.value ? ": " + it.value : ""}`, add: () => ({ label: "", value: "" }), item: [g2({ t: "text", path: "label", label: "Specification" }, { t: "text", path: "value", label: "Value" })] },
          { t: "text", path: "id", label: "Page address (optional)", hint: "Used in the product page link: product.html?p=… Made from the name when empty." }] }] },
    ],
  },
  {
    id: "clients", label: "Clients", group: "Pages", sub: "Sections", desc: "A strip of client names or logos.",
    cards: [{ title: "Clients", fields: [{ t: "text", path: "clients.title", label: "Line above the logos" },
      { t: "list", path: "clients.logos", max: 16, title: (it) => it.name || "Client", add: () => ({ name: "New client", logo: null }), item: [{ t: "text", path: "name", label: "Name" }, { t: "image", path: "logo", label: "Logo (optional)", hint: "Transparent PNG or SVG works best. Without a logo, the name shows in your headings font." }] }] }],
  },
  {
    id: "services", label: "Services", group: "Pages", sub: "Sections", desc: "What you offer.",
    cards: [head("services"), { title: "Services", fields: [{ t: "list", path: "services.items", max: 12, title: (it) => it.title || "Service", add: () => ({ icon: "spark", title: "New service", body: "", points: [] }),
      item: [g2({ t: "text", path: "title", label: "Name" }, { t: "select", path: "icon", label: "Icon", options: ICONS.map(([value, label]) => ({ value, label })) }), { t: "textarea", path: "body", label: "Description", rows: 2 }, { t: "strings", path: "points", label: "Key points", addLabel: "Add point" }] }] }],
  },
  {
    id: "stats", label: "Numbers", group: "Pages", sub: "Sections", desc: "A row of key figures.",
    cards: [{ title: "Numbers", fields: [{ t: "list", path: "stats.items", max: 6, title: (it) => `${it.value} · ${it.label}`, add: () => ({ value: "10+", label: "New figure" }), item: [g2({ t: "text", path: "value", label: "Figure" }, { t: "text", path: "label", label: "Label" })] }] }],
  },
  {
    id: "work", label: "Case studies", group: "Pages", sub: "Sections", desc: "Projects and results.",
    cards: [head("work"), { title: "Case studies", fields: [{ t: "list", path: "work.items", max: 24, title: (it) => it.title || "Case study", add: () => ({ title: "New case study", client: "", sector: "", summary: "", result: "", image: null, url: "" }),
      item: [{ t: "text", path: "title", label: "Title" }, g2({ t: "text", path: "client", label: "Client" }, { t: "text", path: "sector", label: "Sector" }), { t: "textarea", path: "summary", label: "Summary", rows: 2 }, { t: "text", path: "result", label: "Result (one line)", ph: "Processing time down 46%" },
        { t: "image", path: "image", label: "Image (optional)" }, { t: "text", path: "url", label: "Link to the full case study (optional)", check: "https" }] }] }],
  },
  {
    id: "about", label: "About", group: "Pages", sub: "Sections", desc: "Your story, mission, vision and values.",
    cards: [
      { title: "Story", fields: [g2({ t: "text", path: "about.eyebrow", label: "Small label above" }, { t: "text", path: "about.title", label: "Heading", ml: true }), { t: "textarea", path: "about.body", label: "Story", rows: 6, hint: "Leave an empty line between paragraphs." }, { t: "image", path: "about.image", label: "Image (optional)" }] },
      { title: "Mission & vision", fields: [{ t: "textarea", path: "about.mission", label: "Mission", rows: 2 }, { t: "textarea", path: "about.vision", label: "Vision", rows: 2 }] },
      { title: "Values", fields: [{ t: "list", path: "about.values", max: 8, title: (it) => it.title || "Value", add: () => ({ title: "New value", body: "" }), item: [{ t: "text", path: "title", label: "Value" }, { t: "textarea", path: "body", label: "What it means", rows: 2 }] }] },
    ],
  },
  {
    id: "process", label: "Process", group: "Pages", sub: "Sections", desc: "How you work, step by step.",
    cards: [{ title: "Heading", fields: [g2({ t: "text", path: "process.eyebrow", label: "Small label above" }, { t: "text", path: "process.title", label: "Heading", ml: true })] },
      { title: "Steps", fields: [{ t: "list", path: "process.steps", max: 8, title: (it, i) => `${i + 1}. ${it.title}`, add: () => ({ title: "New step", body: "" }), item: [{ t: "text", path: "title", label: "Step" }, { t: "textarea", path: "body", label: "Description", rows: 2 }] }] }],
  },
  {
    id: "team", label: "Team", group: "Pages", sub: "Sections", desc: "The people behind the business.",
    cards: [head("team"), { title: "People", fields: [{ t: "list", path: "team.members", max: 24, title: (it) => `${it.name} · ${it.role}`, add: () => ({ name: "New person", role: "", photo: null, linkedin: "" }),
      item: [g2({ t: "text", path: "name", label: "Name" }, { t: "text", path: "role", label: "Role" }), { t: "image", path: "photo", label: "Photo (optional)" }, { t: "text", path: "linkedin", label: "LinkedIn (optional)", check: "https" }] }] }],
  },
  {
    id: "testimonials", label: "Testimonials", group: "Pages", sub: "Sections", desc: "What clients say.",
    cards: [{ title: "Heading", fields: [g2({ t: "text", path: "testimonials.eyebrow", label: "Small label above" }, { t: "text", path: "testimonials.title", label: "Heading", ml: true })] },
      { title: "Reviews from Google", studio: true, fields: [{ t: "googleReviews" }] },
      { title: "Testimonials", fields: [{ t: "list", path: "testimonials.items", max: 12, title: (it) => it.name || "Testimonial", add: () => ({ quote: "", name: "", role: "", company: "" }),
        item: [{ t: "textarea", path: "quote", label: "Quote", rows: 3 }, g3({ t: "text", path: "name", label: "Name" }, { t: "text", path: "role", label: "Role" }, { t: "text", path: "company", label: "Company" }), { t: "select", path: "rating", label: "Stars", options: [{ value: "", label: "None" }, { value: "5", label: "★★★★★" }, { value: "4", label: "★★★★" }, { value: "3", label: "★★★" }, { value: "2", label: "★★" }, { value: "1", label: "★" }] }] }] }],
  },
  {
    id: "pricing", label: "Pricing", group: "Pages", sub: "Sections", desc: "Packages, engagements or plans.",
    cards: [head("pricing"), { title: "Plans", fields: [{ t: "list", path: "pricing.plans", max: 6, title: (it) => `${it.name}${it.featured ? " ★" : ""}`, add: () => ({ name: "New plan", price: "", period: "", blurb: "", features: [], cta: "Get in touch", featured: false }),
      item: [g3({ t: "text", path: "name", label: "Name" }, { t: "text", path: "price", label: "Price" }, { t: "text", path: "period", label: "Per", ph: "per month" }), { t: "text", path: "blurb", label: "One-line description" }, { t: "strings", path: "features", label: "What's included", addLabel: "Add item" },
        g2({ t: "text", path: "cta", label: "Button label" }, { t: "toggle", path: "featured", label: "Highlight this plan" })] }, { t: "text", path: "pricing.note", label: "Note under the plans" }] }],
  },
  {
    id: "faq", label: "FAQ", group: "Pages", sub: "Sections", desc: "Questions clients often ask.",
    cards: [{ title: "Heading", fields: [g2({ t: "text", path: "faq.eyebrow", label: "Small label above" }, { t: "text", path: "faq.title", label: "Heading", ml: true })] },
      { title: "Questions", fields: [{ t: "list", path: "faq.items", max: 20, title: (it) => it.q || "Question", add: () => ({ q: "New question", a: "" }), item: [{ t: "text", path: "q", label: "Question" }, { t: "textarea", path: "a", label: "Answer", rows: 3 }] }] }],
  },
  {
    id: "cta", label: "Call to action", group: "Pages", sub: "Sections", desc: "The dark band that asks visitors to get in touch.",
    cards: [{ title: "Call to action", fields: [{ t: "text", path: "cta.title", label: "Heading", ml: true }, { t: "textarea", path: "cta.body", label: "Text", rows: 2 }, g2({ t: "text", path: "cta.button", label: "Button" }, { t: "select", path: "cta.target", label: "Goes to", options: GOES }), linkWhen("cta.target", "Custom link for the button")] }],
  },
  videoCategory("Pages", "Sections"),
  wallCategory("Pages", "Sections"),
  socialCategory("Pages"),
  {
    id: "contact", label: "Contact details", group: "Pages", desc: "Contact details and the contact section's heading. The enquiry form is under Forms & records.",
    cards: [
      head("contact"),
      { title: "Details", fields: [g2({ t: "text", path: "contact.email", label: "Email", check: "email" }, { t: "text", path: "contact.phone", label: "Phone", check: "phone" }), { t: "textarea", path: "contact.address", label: "Office address", rows: 2 },
        g2({ t: "text", path: "contact.hours", label: "Opening hours" }, { t: "text", path: "contact.mapUrl", label: "Map link (optional)", check: "https" }, { t: "text", path: "contact.whatsapp", label: "WhatsApp number (optional)", check: "phone" }, { t: "text", path: "contact.linkedin", label: "LinkedIn page (optional)", check: "https" })] },
    ],
  },
  {
    id: "footer", label: "Footer", group: "Pages", desc: "The bottom of every page.",
    cards: [{ title: "Footer", fields: [{ t: "textarea", path: "footer.text", label: "Short description", rows: 2 }, { t: "text", path: "footer.legal", label: "Legal line", hint: "{year} becomes the current year." },
      { t: "list", path: "footer.links", max: 6, title: (it) => it.label || "Link", add: () => ({ label: "New link", url: "" }), item: [g2({ t: "text", path: "label", label: "Label" }, { t: "text", path: "url", label: "Link", check: "https" })] }] }],
  },
  staticPagesCategory("page"),
  {
    id: "forms", label: "Enquiry form", group: "Forms & records", desc: "The enquiry form's questions, its messages and where enquiries go.",
    cards: [
      { title: "Enquiry form", fields: [{ t: "toggle", path: "contact.form.enabled", label: "Show the enquiry form" },
        { t: "when", path: "contact.form.enabled", is: "true", fields: [
          { t: "text", path: "contact.form.title", label: "Form heading" },
          g2({ t: "toggle", path: "contact.form.askPhone", label: "Ask for a phone number" }, { t: "toggle", path: "contact.form.askCompany", label: "Ask for the company" }, { t: "toggle", path: "contact.form.askService", label: "Ask which service (from your Services)" }, { t: "toggle", path: "contact.form.askBudget", label: "Ask for a budget" }),
          { t: "when", path: "contact.form.askBudget", is: "true", fields: [{ t: "strings", path: "contact.form.budgets", label: "Budget choices", addLabel: "Add choice" }] },
          g2({ t: "text", path: "contact.form.submit", label: "Button label" }, { t: "text", path: "contact.form.consent", label: "Consent checkbox (empty hides it)" }),
          { t: "textarea", path: "contact.form.success", label: "Message after sending", rows: 2 },
          { t: "note", text: "Enquiries are saved in the site's database and listed under Enquiries in the admin page. (A site that has no database yet opens the visitor's email app instead, addressed to your contact email: give it one with Publish to Cloudflare in the Studio.)" },
          { t: "toggle", path: "contact.form.notify", label: "Email me each enquiry" },
          { t: "when", path: "contact.form.notify", is: "true", fields: [
            g2({ t: "text", path: "contact.form.notifyTo", label: "Send to", ph: "the contact email above", hint: "Up to 3 addresses, separated by commas. Empty uses the contact email under Contact details, or else the site's editors." },
              { t: "text", path: "contact.form.notifySubject", label: "Subject", ph: "New enquiry from {name}", hint: "{name} is the visitor's name, {site} the site's name." }),
            { t: "note", text: "The email lists everything the visitor filled in, and replying to it answers the visitor. It is sent by the site's database through the same Resend email settings that send your sign-in codes. If one doesn't arrive, open Enquiries: every enquiry says whether it was emailed and, when it wasn't, why." },
          ] },
          { t: "when", path: "contact.form.saveTo", is: "file", fields: [
            { t: "note", text: "This site still uses the older enquiry inbox: each enquiry is a JSON file in a private GitHub repository, with no email. Switch below to save to the database instead.", tone: "warn" },
            { t: "select", path: "contact.form.saveTo", label: "Enquiry inbox", options: [{ value: "file", label: "Keep the private repository inbox" }, { value: "auto", label: "Use the site's database" }] },
            { t: "text", path: "contact.form.fileUrl", label: "Inbox address", check: "https", hint: "Filled in by Enquiry inbox in the Studio." },
          ] },
          { t: "when", path: "contact.form.sbUrl", not: "", fields: [g3({ t: "text", path: "contact.form.sbUrl", label: "Supabase Project URL (GitHub sites)", check: "https" }, { t: "text", path: "contact.form.sbKey", label: "Public (anon) key" }, { t: "text", path: "contact.form.site", label: "Site ID", ph: "my-company" })] },
        ] }] },
    ],
  },
  warrantyCategory("popup-or-page"),
  emailsCategory(true),
  featuresCategory(),
  festivalCategory(),
  i18nCategory(),
  seoCategory(true),
  consentCategory(),
  legalCategory(),
  adminCategory(),
  codeCategory(),
];
withSectionBg(schema, { contact: [["contact"]], footer: [["footer"]] }, [...DISPLAY_FONTS, ...BODY_FONTS]);

function prepareBusiness(c: any) {
  if (!c || typeof c !== "object") return;
  c.site ||= { multiPage: false };
  // Early business sites stored the default theme as "meridian"; its id is "biz-meridian".
  if (c.theme?.preset && !BIZ_THEMES.some((t) => t.id === c.theme.preset) && BIZ_THEMES.some((t) => t.id === "biz-" + c.theme.preset)) c.theme.preset = "biz-" + c.theme.preset;
  c.site.pageLabels ||= { home: "Home", services: "Services", work: "Work", about: "About", contact: "Contact" };
  c.site.pageLabels.products ||= "Products";
  c.products = { eyebrow: "Catalogue", title: "Products", lede: "", homeCount: 6, enquire: "Enquire", more: "View more", all: "View all products", showPrice: true, filter: true, related: true, ...(c.products && typeof c.products === "object" ? c.products : {}) };
  if (!Array.isArray(c.products.items)) c.products.items = [];
  c.hero ||= {}; prepareSlides(c.hero, c.theme?.deep || "#0E1B2C"); prepareMaintenance(c);
  prepareI18n(c, () => schema);
  prepareMenu(c, () => (Array.isArray(c.sections) ? c.sections : []).filter((x: any) => x && x.show !== false && x.inNav).map((x: any) => menuItem(x.label || x.id, x.id)));
  // Enquiries always go to the site's database now: the old "always open the email app" choice is gone.
  if (c.contact?.form && typeof c.contact.form === "object") { const F = c.contact.form; if (F.saveTo !== "file") F.saveTo = "auto"; if (F.notifyAsk !== 1) { F.notify = true; F.notifyAsk = 1; } else F.notify = F.notify === true; F.notifyTo ??= ""; F.notifySubject ??= ""; }
  c.hero.panel = { show: true, source: "auto", aLabel: "", aValue: "", bars: true, rows: [], cLabel: "", cValue: "", dot: true, ...(c.hero.panel && typeof c.hero.panel === "object" ? c.hero.panel : {}) };
  if (!Array.isArray(c.hero.panel.rows)) c.hero.panel.rows = [];
  c.sections = Array.isArray(c.sections) ? c.sections : [];
  // A section added in a newer version goes in after the one before it in the default order.
  SECTIONS.forEach(([id, label], k) => {
    if (c.sections.some((s: any) => s.id === id)) return;
    const after = k ? c.sections.findIndex((s: any) => s.id === SECTIONS[k - 1][0]) : -1;
    c.sections.splice(after + 1, 0, { id, label, show: true, inNav: ["services", "products", "work", "about", "team", "contact"].includes(id) });
  });
  c.contact ||= {}; c.contact.form ||= { enabled: true };
}

export const businessTemplate: TemplateDef = {
  id: "business",
  name: "Business portfolio",
  kind: "One or several pages",
  description: "A professional site for a company, agency, firm or practice: services, case studies, team, pricing, FAQ and an enquiry form whose messages show in the admin page.",
  pages: [
    { file: "index.html", label: "Home" },
    { file: "services.html", label: "Services" },
    { file: "products.html", label: "Products" },
    { file: "product.html", label: "Product page" },
    { file: "work.html", label: "Work" },
    { file: "about.html", label: "About" },
    { file: "contact.html", label: "Contact" },
  ],
  schema,
  colorKeys: [{ key: "c1", label: "Primary" }, { key: "c2", label: "Secondary" }, { key: "c3", label: "Highlight" }, { key: "text", label: "Text" }, { key: "surface", label: "Cards" }, { key: "deep", label: "Dark" }],
  themePath: "theme",
  themeValues: businessThemeValues,
  themes: BIZ_THEMES,
  themeTags: BIZ_TAGS,
  prepare: prepareBusiness,
  sampleOnly: ["products.items"],
  summary: (c) => `${(c?.services?.items || []).length} services${(c?.products?.items || []).length ? ` · ${c.products.items.length} products` : ""} · ${(c?.work?.items || []).length} case studies`,
  checks: (c) => {
    const w: string[] = [];
    const F = c?.contact?.form || {};
    if (F.enabled && F.saveTo === "file" && !/^https:\/\//.test(F.fileUrl || "")) w.push("Enquiries are set to save as JSON files, but the inbox isn't set up. Press Enquiry inbox at the top of the project.");
    if (F.enabled && F.saveTo !== "file" && !c?.contact?.email) w.push("The enquiry form has no email to fall back on. Add one under Contact & form → Details.");
    if (F.enabled && F.saveTo !== "email" && (F.sbUrl || F.sbKey) && !(F.sbUrl && F.sbKey && F.site)) w.push("The enquiry form's Supabase settings are incomplete (Project URL, public key and Site ID are all needed).");
    if (/^picaffectz$/i.test(String(c?.brand?.name || "").trim()) && c?.brand?.tagline === "Strategy, design and engineering for growing companies") w.push("The company name and tagline are still the sample (Picaffectz).");
    return [...w, ...legalChecks("business", c)];
  },
};
