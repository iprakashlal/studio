import { legalChecks } from "../lib/legal";
import type { Category, Field, TemplateDef } from "./types";
import { FX_AXES, HERO_FX_AXIS, LOADER_ON_AXIS, LINE_BREAKS_AXIS, type Axis } from "../themes/catalog";
import { REST_AXES, REST_BODY_FONTS, REST_DISPLAY_FONTS, REST_TAGS, REST_THEMES, restaurantThemeValues } from "../themes/restaurant";
import { INTRO_CARD, NAV_MODE_FIELD, NAV_MODE_MOB_FIELD } from "../themes/fields";
import { ANIM_BG_FIELDS, gstCategory, adminCategory, loyaltyCard, accountsCategory, accountLookCard, legalCategory, codeCategory, withSectionBg, videoCategory, socialCategory, logoFields, consentCategory, emailsCategory, i18nCategory, prepareI18n, featuresCategory, festivalCategory, menuCategory, menuItem, prepareMenu, staticPagesCategory, heroSlidesCard, prepareSlides, prepareMaintenance, seoCategory, customFontsCard } from "./common";

const g2 = (...fields: Field[]): Field => ({ t: "grid", cols: 2, fields });
const g3 = (...fields: Field[]): Field => ({ t: "grid", cols: 3, fields });
const sel = (a: Axis): Field => ({ t: "select", path: "theme." + a.key, label: a.label, options: a.options.map(([value, label]) => ({ value, label })) });
type Card = Category["cards"][number];

export const REST_SECTIONS: [string, string][] = [["hero", "Home"], ["highlights", "Highlights"], ["about", "Our story"], ["specials", "Signature dishes"], ["food", "Menu"], ["offers", "Offers"], ["gallery", "Gallery"], ["chef", "Our team"], ["events", "Events & catering"],
  ["press", "Featured in"], ["testimonials", "Reviews"], ["order", "Order online"], ["reserve", "Book a table"], ["contact", "Visit us"], ["faq", "FAQ"], ["cta", "Call to action"]];
const IN_NAV = ["about", "food", "gallery", "events", "contact"];
const TARGETS = [...REST_SECTIONS.filter(([id]) => id !== "hero").map(([value, label]) => ({ value, label })), { value: "ordering", label: "Order now page (when online ordering is on)" }];
/** Where a button can go: a section, or a link the person types. */
const GOES = [...TARGETS, { value: "url", label: "A custom link…" }];
const linkWhen = (path: string, label: string): Field => ({ t: "when", path, is: "url", fields: [{ t: "text", path: path + "Url", label, ph: "https://…", hint: "A full web address (a link to another site, a WhatsApp link, a PDF…)." }] });
const ICONS: [string, string][] = [["cutlery", "Fork and knife"], ["flame", "Flame"], ["leaf", "Leaf"], ["bowl", "Steaming bowl"], ["people", "People"], ["cup", "Cup"], ["glass", "Glass"], ["cake", "Cake"], ["pizza", "Pizza slice"], ["fish", "Fish"], ["hat", "Chef's hat"], ["truck", "Delivery van"],
  ["bag", "Takeaway bag"], ["calendar", "Calendar"], ["clock", "Clock"], ["pin", "Map pin"], ["phone", "Phone"], ["star", "Star"], ["heart", "Heart"], ["music", "Music"], ["wifi", "Wi-Fi"], ["car", "Parking"], ["sun", "Outdoor seating"], ["paw", "Pet friendly"], ["gift", "Gift"], ["shield", "Hygiene"], ["spark", "Spark"]];
const ICON_OPTS = ICONS.map(([value, label]) => ({ value, label }));
const DIETS = [{ value: "", label: "Not marked" }, { value: "veg", label: "Vegetarian" }, { value: "vegan", label: "Vegan" }, { value: "egg", label: "Contains egg" }, { value: "nonveg", label: "Non-vegetarian" }];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const head = (k: string, title = "Section heading"): Card => ({ title, fields: [g2({ t: "text", path: k + ".eyebrow", label: "Small label above" }, { t: "text", path: k + ".title", label: "Heading", ml: true }), { t: "textarea", path: k + ".lede", label: "Intro line", rows: 2 }] });
const head2 = (k: string): Card => ({ title: "Heading", fields: [g2({ t: "text", path: k + ".eyebrow", label: "Small label above" }, { t: "text", path: k + ".title", label: "Heading", ml: true })] });
export const newDish = () => ({ name: "New dish", desc: "", price: "", diet: "", spice: "0", tag: "", allergens: "", image: null, variants: [], addons: [], soldOut: false });

const schema: Category[] = [
  {
    id: "look", label: "Theme & layout", group: "Design", desc: `Choose from ${REST_THEMES.length} restaurant themes, then fine-tune the layout, the food menu's style and the graphics.`,
    cards: [
      { title: "Theme", fields: [{ t: "note", studio: true, text: `${REST_THEMES.length} restaurant themes (R-001 to R-${String(REST_THEMES.length).padStart(3, "0")}), half classic and half modern. Each has its own mix of hero layout, picture frame, menu bar, food-menu style, background, section edges and ornament. Picking one restyles the whole site; your content stays as it is, and every setting below stays editable.` }, { t: "themes" }] },
      { title: "Layout", fields: [g2(sel(REST_AXES.layout), sel(REST_AXES.heroArt), sel(REST_AXES.nav), NAV_MODE_FIELD, NAV_MODE_MOB_FIELD, sel(REST_AXES.width), sel(REST_AXES.bands)),
        { t: "note", text: "“Full-width photo” and “Photo in a frame” need a hero photo (Hero → Picture); the collage needs two or three. Without a photo, each hero layout has its own arrangement, and the picture is replaced by an emblem drawn from your name. The Picture frame chooses the emblem: a plate (Plain), a printed label (Thin frame), a solid block (Offset shadow), an arch, a round stamp (Circle), a soft blob, today's card (Tilted print) or a scalloped seal." }] },
      { title: "Food menu & gallery", fields: [g2(sel(REST_AXES.menuStyle), sel(REST_AXES.gallery)),
        { t: "note", text: "Photo cards, the list and the magazine style show dish photos; the classic, chalkboard, printed card and boxes keep the menu to words and prices." }] },
      { title: "Style & graphics", fields: [g2(sel(REST_AXES.heading), sel(REST_AXES.shead), sel(REST_AXES.ornament), sel(REST_AXES.divider), sel(REST_AXES.pattern), sel(REST_AXES.cards), sel(REST_AXES.buttons), sel(REST_AXES.motionStyle)),
        { t: "note", text: "The ornament is the small drawing above section titles, in the menu and in the footer. The edge shapes show where a band of colour begins, so they need “Alternate soft bands” or “Alternate dark bands”. Visitors who ask their device for reduced motion always get a still page." }, ...ANIM_BG_FIELDS] },
      { title: "Interactions (optional)", fields: [{ t: "note", text: "Restaurant themes keep these off, so the page stays quick on a phone. Switch one on if it suits your place." },
        g2({ ...sel(FX_AXES.cursor) }, sel(FX_AXES.loader), sel(FX_AXES.textfx), sel(FX_AXES.hoverfx), sel(FX_AXES.scrollfx), sel(FX_AXES.overlay)), sel(LOADER_ON_AXIS), sel(HERO_FX_AXIS), { t: "note", text: "Hero graphic effect is a slow, quiet loop on the hero's picture or graphic, drawn in your theme's accent colours. It stays still for visitors who ask their device for less motion." }] },
      { ...INTRO_CARD, fields: [{ t: "note", text: "Shown when “Intro & page transition” above is set to anything but None. Leave a colour empty to use the theme's own." }, ...INTRO_CARD.fields.slice(1)] },
  accountLookCard("restaurant"),
    ],
  },
  {
    id: "brand", label: "Brand & theme", group: "Design", desc: "The restaurant's name, logo, colours and fonts.",
    cards: [
      { title: "Brand", fields: [g2({ t: "text", path: "brand.name", label: "Restaurant name" }, { t: "text", path: "brand.tagline", label: "Tagline", ml: true }),
        { t: "image", path: "brand.logo", label: "Logo icon", hint: "A square or round logo works best. Without one, your initials show in your primary colour. It's also the browser tab icon." },
        { t: "range", path: "theme.logoRadius", label: "Logo shape: 0 = square, 50 = circle", min: 0, max: 50, step: 1, unit: "%" },
        ...logoFields("brand.logo", 40),
        { t: "toggle", path: "brand.showName", label: "Show the name next to the logo" }] },
      { title: "Colours", fields: [g3(
        { t: "color", path: "theme.bg", label: "Background" }, { t: "color", path: "theme.surface", label: "Cards" }, { t: "color", path: "theme.text", label: "Text" },
        { t: "color", path: "theme.soft", label: "Secondary text" }, { t: "color", path: "theme.line", label: "Borders" }, { t: "color", path: "theme.deep", label: "Dark panels & footer" },
        { t: "color", path: "theme.c1", label: "Primary (buttons, prices)" }, { t: "color", path: "theme.c2", label: "Secondary" }, { t: "color", path: "theme.c3", label: "Highlight (tags)" })] },
      { title: "Typography & corners", fields: [g2({ t: "select", path: "theme.fontDisplay", label: "Headings font", options: REST_DISPLAY_FONTS }, { t: "select", path: "theme.fontBody", label: "Body font", options: REST_BODY_FONTS }),
        { t: "select", path: "theme.lineBreaks", label: LINE_BREAKS_AXIS.label, options: LINE_BREAKS_AXIS.options.map(([value, label]) => ({ value, label })) },
        { t: "range", path: "theme.radius", label: "Corner radius", min: 0, max: 28, step: 1, unit: "px" }] },
      customFontsCard(),
    ],
  },
  {
    id: "pages", label: "Sections & order", group: "Pages", desc: "One page or several, which sections show, their order, the announcement bar and the phone's quick buttons.",
    cards: [
      { title: "Pages", fields: [{ t: "toggle", path: "site.multiPage", label: "Use several pages (Home, Menu, Our story, Gallery, Visit & book)" },
        { t: "toggle", path: "site.crumbs", label: "Show the page trail (Home / Page name) at the top of inner pages" },
        { t: "note", text: "Off: one page with every section, and the menu bar scrolls to them. On: Home shows the highlights (hero, story, signature dishes, the first menu sections, offers, a few photos, reviews) and the menu bar opens the Menu, Our story, Gallery and Visit & book pages. The Menu page (menu.html) is a good address for a table QR code." },
        { t: "when", path: "site.multiPage", is: "true", fields: [g3({ t: "text", path: "site.pageLabels.home", label: "Home page name" }, { t: "text", path: "site.pageLabels.menu", label: "Menu page name" }, { t: "text", path: "site.pageLabels.about", label: "Story page name" },
          { t: "text", path: "site.pageLabels.gallery", label: "Gallery page name" }, { t: "text", path: "site.pageLabels.contact", label: "Visit & book page name" })] }] },
      { title: "Sections", fields: [{ t: "note", text: "Reorder with the arrows. Hidden sections stay in your content. On one page, sections with “In the menu bar” get a link at the top." },
        { t: "list", path: "sections", fixed: true, add: () => ({}), title: (it) => `${it.label || it.id}${it.show === false ? " (hidden)" : ""}`,
          item: [g2({ t: "text", path: "label", label: "Name in the menu bar" }, { t: "toggle", path: "show", label: "Show this section" }), { t: "toggle", path: "inNav", label: "In the menu bar (one-page mode)" }] }] },
      { title: "Button in the menu bar", fields: [g2({ t: "text", path: "nav.cta", label: "Button label (empty hides it)" }, { t: "select", path: "nav.ctaTarget", label: "Goes to", options: GOES }), linkWhen("nav.ctaTarget", "Custom link for the menu button")] },
      { title: "Announcement bar", fields: [{ t: "toggle", path: "notice.on", label: "Show a line above the menu bar" },
        { t: "when", path: "notice.on", is: "true", fields: [{ t: "text", path: "notice.text", label: "Announcement", ph: "Closed on 26 January. Open as usual from the 27th." },
          g2({ t: "text", path: "notice.label", label: "Link label (optional)", ph: "See offers" }, { t: "select", path: "notice.target", label: "Link goes to", options: TARGETS }),
          { t: "note", text: "Visitors can close it; it comes back when you change the text." }] }] },
      { title: "Quick buttons on phones", fields: [{ t: "toggle", path: "site.mobileBar", label: "Keep Call, Directions, Menu and Book at the bottom of the screen on phones" },
        { t: "note", text: "Each button shows only when it has somewhere to go: a phone number, an address, a menu, the booking form." }] },
    ],
  },
  menuCategory({ note: "On a one-page site (“Use several pages” off), a link to a section with “Open in a new tab” switched on gives that section a page of its own, opened in the same tab like any page of a site with several pages, and the section no longer shows on the main page. Buttons that point to that section open its page too.", where: "the sections marked “In the menu bar” (or the site's pages when it has several)", targets: [{ value: "home", label: "Home (top of the site)" }, ...TARGETS.map((t) => ({ value: t.value, label: `Section: ${t.label}` }))] }),
  {
    id: "hero", label: "Hero", group: "Pages", sub: "Sections", desc: "The first screen: headline, intro, buttons, the open-now badge and the picture.",
    cards: [
      { title: "Text", fields: [{ t: "text", path: "hero.eyebrow", label: "Small label above", ph: "Modern Indian kitchen · Pune" }, { t: "text", path: "hero.title", label: "Headline", ml: true, hint: "Enter starts a new line. Wrap words in *asterisks* to highlight them." }, { t: "textarea", path: "hero.lede", label: "Intro", rows: 3 }] },
      { title: "Buttons", fields: [g2({ t: "text", path: "hero.ctaPrimary", label: "Main button" }, { t: "select", path: "hero.ctaPrimaryTarget", label: "Goes to", options: GOES }, { t: "text", path: "hero.ctaSecondary", label: "Second button" }, { t: "select", path: "hero.ctaSecondaryTarget", label: "Goes to", options: GOES }), linkWhen("hero.ctaPrimaryTarget", "Custom link for the main button"), linkWhen("hero.ctaSecondaryTarget", "Custom link for the second button")] },
      { title: "Open now & points", fields: [{ t: "toggle", path: "hero.showStatus", label: "Show “Open now” or “Closed now” above the headline" },
        { t: "strings", path: "hero.badges", label: "Short points under the buttons", addLabel: "Add point" }] },
      { title: "Picture", fields: [{ t: "image", path: "hero.image", label: "Hero photo (optional)", hint: "Your best dish, the dining room or the shopfront. Without one, the hero shows a round stamp with the line below." },
        { t: "images", path: "hero.images", label: "More photos for the collage layout (up to 2)", hint: "Used by the “Three-photo collage” hero layout, beside the hero photo." },
        { t: "videoFile", path: "hero.video", label: "Or a hero video", hint: "MP4 or WebM, up to 20 MB. It plays silently on a loop in the photo's place; the photo above is shown first, while it loads. A short clip works best." },
        { t: "text", path: "hero.stamp", label: "Line on the emblem (no photo)", ph: "Est. 2014 · Cooked over fire" }] },
      heroSlidesCard("hero", "the hero photo or stamp"),
    ],
  },
  {
    id: "food", label: "Menu", group: "Pages", sub: "Sections", desc: "Your food and drinks menu: sections, dishes, prices, diet marks, spice level, allergens and photos, and counting stock.",
    cards: [
      head("food"),
      { title: "How the menu shows", fields: [
        g3({ t: "text", path: "food.currency", label: "Currency sign", ph: "₹" }, { t: "number", path: "food.homeCount", label: "Sections shown on Home (several pages)", min: 1, step: 1 }, { t: "text", path: "food.all", label: "Link to the full menu" }),
        g2({ t: "toggle", path: "food.dietMarks", label: "Show diet marks (vegetarian, vegan, egg, non-vegetarian)" }, { t: "toggle", path: "food.filters", label: "Let visitors filter by diet" }, { t: "toggle", path: "food.search", label: "Search box (menus with more than 8 dishes)" }, { t: "toggle", path: "food.photos", label: "Show dish photos" }),
        g2({ t: "text", path: "food.pdfUrl", label: "Link to a printable menu (optional)", check: "https", ph: "https://…/menu.pdf" }, { t: "text", path: "food.pdfLabel", label: "Label for that link" }),
        { t: "textarea", path: "food.note", label: "Note under the menu", rows: 2, hint: "Taxes, service charge, an allergy line." },
        { t: "note", text: "A price that is only a number gets the currency sign in front; anything else shows as you type it (“Market price”, “₹250 / ₹450”). The menu's look is under Theme & layout → Food menu & gallery." },
      ] },
      { title: "Fill in from a photo of your menu", studio: true, fields: [{ t: "pamphlet", text: "Have a printed menu, a menu PDF or photos of the menu board? Upload it and the sections, dishes and prices are filled in for you.", button: "Fill in from my menu" }] },
      { title: "Dish photos in bulk", fields: [{ t: "bulkPhotos", kind: "dish" }] },
      { title: "Sections and dishes", fields: [{ t: "list", path: "food.categories", max: 40, title: (it) => `${it.name || "Section"} · ${(it.items || []).length} dish${(it.items || []).length === 1 ? "" : "es"}`, add: () => ({ name: "New section", note: "", image: null, items: [newDish()] }),
        item: [g2({ t: "text", path: "name", label: "Section name", ph: "Starters" }, { t: "text", path: "note", label: "Note (optional)", ph: "Served till 4 pm" }),
          { t: "image", path: "image", label: "Section photo (magazine style)", hint: "Shown beside the section in the magazine menu style." },
          { t: "list", path: "items", label: "Dishes", max: 120, title: (it) => `${it.name || "Dish"}${it.price ? " · " + it.price : ""}${it.soldOut ? " · sold out" : ""}`, add: newDish,
            item: [g2({ t: "text", path: "name", label: "Dish" }, { t: "text", path: "price", label: "Price", ph: "320" }),
              { t: "textarea", path: "desc", label: "Description", rows: 2 },
              g3({ t: "select", path: "diet", label: "Diet", options: DIETS }, { t: "select", path: "spice", label: "Spice", options: [{ value: "0", label: "Not shown" }, { value: "1", label: "Mild" }, { value: "2", label: "Medium" }, { value: "3", label: "Hot" }] }, { t: "text", path: "tag", label: "Tag (optional)", ph: "Bestseller, New" }),
              g2({ t: "text", path: "allergens", label: "Contains (allergens)", ph: "dairy, nuts" }, { t: "toggle", path: "soldOut", label: "Sold out today" }),
              { t: "image", path: "image", label: "Photo (optional)" },
              { t: "when", path: "food.photos", is: "false", fields: [{ t: "note", tone: "warn", text: "Dish photos are switched off, so the Menu shows a plain tile in place of this photo. Switch on “Show dish photos” near the top of this page to show it. (The Order now page shows dish photos either way.)" }] },
              g2({ t: "toggle", path: "bestseller", label: "Best seller (shown first on the Order now page)" }, { t: "toggle", path: "noOrder", label: "Dine-in only: leave it off the Order now page" }),
              { t: "list", path: "addons", label: "Extras guests can add when ordering (optional)", max: 6, title: (it) => `${it.title || "Extras"} · ${(it.options || []).length} choice${(it.options || []).length === 1 ? "" : "s"}`, add: () => ({ title: "Extras", max: 3, required: false, options: [] }),
                item: [g3({ t: "text", path: "title", label: "Group name", ph: "Extras" }, { t: "number", path: "max", label: "Most a guest can pick (0 = any)", min: 0, step: 1 }, { t: "toggle", path: "required", label: "Must pick at least one" }),
                  { t: "strings", path: "options", label: "Choices, one per line. Add the price after “=” (leave it out for free).", addLabel: "Add a choice" }] },
              { t: "list", path: "variants", label: "Sizes with their own prices (optional)", max: 6, title: (it) => `${it.label || "Size"}${it.price ? " · " + it.price : ""}`, add: () => ({ label: "", price: "" }), item: [g2({ t: "text", path: "label", label: "Size", ph: "Half" }, { t: "text", path: "price", label: "Price", ph: "180" }), { t: "text", path: "posId", label: "Petpooja variation ID (only with Petpooja)" }] },
              { t: "toggle", path: "kindsOn", label: "This dish comes in varieties (the guest must choose one)" },
              { t: "when", path: "kindsOn", is: "true", local: true, fields: [
                { t: "list", path: "kinds", label: "Varieties with their own prices", max: 12, title: (it) => `${it.label || "Variety"}${it.price ? " · " + it.price : ""}`, add: () => ({ label: "", price: "", posId: "" }), item: [g2({ t: "text", path: "label", label: "Variety", ph: "Butter" }, { t: "text", path: "price", label: "Price", ph: "49" }), { t: "text", path: "posId", label: "Petpooja variation ID (only with Petpooja)" }] },
                { t: "note", text: "For the same dish made in different ways, such as Oil, Butter and Cheese. The Menu lists each variety with its price, and on Order now the guest has to choose one before the price shows and the dish can be added. The dish's own Price box is not used then. If the dish also has sizes, the first size costs the variety's price and each bigger size adds its difference." }] },
              { t: "text", path: "posId", label: "Petpooja item ID", hint: "Only if your orders go to Petpooja (Restaurant backend → Petpooja): the item's ID in your Petpooja menu. An order with a dish that has no ID is kept here but not sent to Petpooja." }] }] }] },
      { title: "Inventory", fields: [
        { t: "toggle", path: "inventory.on", label: "Count stock (dishes you give a quantity sell out by themselves)" },
        { t: "when", path: "inventory.on", is: "true", fields: [
          { t: "text", path: "inventory.alertTo", label: "Send low-stock emails to (optional)", ph: "you@example.com", hint: "Empty uses the address new orders go to." },
          { t: "toggle", path: "inventory.alert", def: true, label: "Email me when a dish runs low or sells out" },
        ] },
        { t: "note", text: "Enter the quantities under Dish stock (in the menu, under Menu & dishes). Only dishes you give a quantity are counted (for example the day's specials); the rest sell without a limit, and “Sold out today” on each dish still works as before. Counting runs on the site's own Cloudflare database, so the site must be hosted there and published once after switching this on." },
      ] },
    ],
  },
  {
    id: "specials", label: "Signature dishes", group: "Pages", sub: "Sections", desc: "A few dishes with large photos, near the top of the home page.",
    cards: [head("specials"), { title: "Dishes", fields: [{ t: "list", path: "specials.items", max: 9, title: (it) => it.name || "Dish", add: () => ({ name: "New dish", desc: "", price: "", tag: "", diet: "", image: null }),
      item: [g2({ t: "text", path: "name", label: "Dish" }, { t: "text", path: "price", label: "Price", ph: "340" }), { t: "textarea", path: "desc", label: "Description", rows: 2 }, g2({ t: "text", path: "tag", label: "Tag on the photo (optional)", ph: "Chef's special" }, { t: "select", path: "diet", label: "Diet", options: DIETS }), { t: "image", path: "image", label: "Photo" }] }] }],
  },
  {
    id: "highlights", label: "Highlights", group: "Pages", sub: "Sections", desc: "A row of short points under the hero: what makes the place different.",
    cards: [{ title: "Highlights", fields: [{ t: "list", path: "highlights.items", max: 8, title: (it) => it.title || "Point", add: () => ({ icon: "star", title: "New point", body: "" }),
      item: [g2({ t: "text", path: "title", label: "Point" }, { t: "select", path: "icon", label: "Icon", options: ICON_OPTS }), { t: "textarea", path: "body", label: "One line more", rows: 2 }] }] }],
  },
  {
    id: "about", label: "Our story", group: "Pages", sub: "Sections", desc: "Who you are and how it began.",
    cards: [
      { title: "Story", fields: [g2({ t: "text", path: "about.eyebrow", label: "Small label above" }, { t: "text", path: "about.title", label: "Heading", ml: true }), { t: "textarea", path: "about.body", label: "Story", rows: 6, hint: "Leave an empty line between paragraphs." },
        g2({ t: "text", path: "about.signature", label: "Signed by (optional)", ph: "Meera & Arjun, founders" }), { t: "image", path: "about.image", label: "Photo (optional)", hint: "It takes the hero's picture frame." }] },
      { title: "Figures", fields: [{ t: "list", path: "about.facts", max: 4, title: (it) => `${it.value || ""} · ${it.label || ""}`, add: () => ({ value: "10+", label: "New figure" }), item: [g2({ t: "text", path: "value", label: "Figure" }, { t: "text", path: "label", label: "Label" })] }] },
    ],
  },
  {
    id: "offers", label: "Offers", group: "Pages", sub: "Sections", desc: "Deals, set menus and happy hours, shown as tickets.",
    cards: [head2("offers"), { title: "Offers", fields: [{ t: "list", path: "offers.items", max: 12, title: (it) => `${it.title || "Offer"}${it.price ? " · " + it.price : ""}`, add: () => ({ title: "New offer", body: "", when: "", price: "", code: "", image: null }),
      item: [g2({ t: "text", path: "title", label: "Offer" }, { t: "text", path: "price", label: "Price or saving", ph: "₹399 or 15% off" }), { t: "textarea", path: "body", label: "What's included", rows: 2 },
        g2({ t: "text", path: "when", label: "When", ph: "Mon–Fri, 12–3 pm" }, { t: "text", path: "code", label: "Code (optional)", ph: "EARLY15" }), { t: "image", path: "image", label: "Photo (optional)" }] },
      { t: "note", text: "A code shows as a button that copies it. With no offers, the section doesn't show." }] }],
  },
  {
    id: "gallery", label: "Gallery", group: "Pages", sub: "Sections", desc: "Photos of the food and the place. Visitors can open them large and step through.",
    cards: [head("gallery"), { title: "Photos", fields: [g2({ t: "number", path: "gallery.homeCount", label: "Photos shown on Home (several pages)", min: 1, step: 1 }, { t: "text", path: "gallery.all", label: "Link to all photos" }),
      { t: "list", path: "gallery.items", max: 60, title: (it, i) => it.caption || `Photo ${i + 1}`, add: () => ({ image: null, caption: "" }), item: [{ t: "image", path: "image", label: "Photo" }, { t: "text", path: "caption", label: "Caption (optional)" }] },
      { t: "note", text: "The layout (even grid, masonry, mosaic or a sideways strip) is under Theme & layout → Food menu & gallery." }] }],
  },
  {
    id: "chef", label: "Our team", group: "Pages", sub: "Sections", desc: "The chef and the people guests meet.",
    cards: [head("chef"), { title: "People", fields: [{ t: "list", path: "chef.members", max: 12, title: (it) => `${it.name || "Person"}${it.role ? " · " + it.role : ""}`, add: () => ({ name: "New person", role: "", bio: "", photo: null }),
      item: [g2({ t: "text", path: "name", label: "Name" }, { t: "text", path: "role", label: "Role" }), { t: "textarea", path: "bio", label: "A line or two about them", rows: 2 }, { t: "image", path: "photo", label: "Photo (optional)" }] }] }],
  },
  {
    id: "events", label: "Events & catering", group: "Pages", sub: "Sections", desc: "Private dining, celebrations and catering, with a button that opens the booking form.",
    cards: [head("events"), { title: "What you offer", fields: [{ t: "list", path: "events.items", max: 6, title: (it) => it.title || "Service", add: () => ({ icon: "people", title: "New service", body: "" }),
      item: [g2({ t: "text", path: "title", label: "Name" }, { t: "select", path: "icon", label: "Icon", options: ICON_OPTS }), { t: "textarea", path: "body", label: "Description", rows: 2 }] },
      g2({ t: "text", path: "events.button", label: "Button (empty hides it)" }, { t: "text", path: "events.type", label: "Kind of request it picks in the form", ph: "Private event", hint: "Must match one of the choices under Booking form → “I'd like to”." })] }],
  },
  {
    id: "press", label: "Featured in", group: "Pages", sub: "Sections", desc: "A strip of guides, awards or publications that mention you.",
    cards: [{ title: "Featured in", fields: [{ t: "text", path: "press.title", label: "Line above the names" },
      { t: "list", path: "press.logos", max: 12, title: (it) => it.name || "Name", add: () => ({ name: "New mention", logo: null }), item: [{ t: "text", path: "name", label: "Name" }, { t: "image", path: "logo", label: "Logo (optional)", hint: "Only use a logo you are allowed to show. Without one, the name shows in your headings font." }] }] }],
  },
  {
    id: "testimonials", label: "Reviews", group: "Pages", sub: "Sections", desc: "What guests say: quotes on the site, Google reviews and the reviews customers leave on dishes.",
    cards: [head2("testimonials"),
      { title: "Reviews from Google", studio: true, fields: [{ t: "googleReviews" }] },
      { title: "Reviews", fields: [{ t: "list", path: "testimonials.items", max: 12, title: (it) => it.name || "Review", add: () => ({ quote: "", name: "", role: "", company: "", rating: "5" }),
        item: [{ t: "textarea", path: "quote", label: "What they said", rows: 3 }, g2({ t: "text", path: "name", label: "Name" }, { t: "select", path: "rating", label: "Stars", options: [{ value: "", label: "None" }, { value: "5", label: "★★★★★" }, { value: "4", label: "★★★★" }, { value: "3", label: "★★★" }] })] }] },
      { title: "Dish reviews (online ordering)", fields: [
        { t: "toggle", path: "reviews.on", label: "Let customers review dishes (stars and a few words, on each dish page)" },
        { t: "when", path: "reviews.on", is: "true", fields: [
          { t: "toggle", path: "reviews.auto", label: "Show reviews straight away (off: you approve each one first)" },
          { t: "toggle", path: "reviews.trustBuyers", label: "…but only approve-first for people who haven't ordered it (a buyer's review shows straight away)" },
          { t: "toggle", path: "reviews.buyersOnly", label: "Only people who ordered it can review it (matched by the email they ordered with)" },
          g2({ t: "toggle", path: "reviews.alert", def: true, label: "Email me when a review needs approving" }, { t: "text", path: "reviews.alertTo", label: "Send those emails to (optional)", ph: "you@example.com", hint: "Empty uses the address new orders go to." }),
        ] },
        { t: "note", text: "Reviews, approving, hiding and replying are under Guest reviews (in the menu, under Orders & guests). Only the reviewer's first name and last initial are shown, never the email address. A reviewer's email decides “Verified buyer”: it must match the email on an order for that item. It runs on the site's own Cloudflare database, so the site must be hosted there and published once after this is switched on." },
      ] }
    ],
  },
  {
    id: "order", label: "Order online", group: "Pages", sub: "Sections", desc: "Links to where guests can order for pickup or delivery, plus call and WhatsApp.",
    cards: [head("order"), { title: "Ways to order", fields: [
      { t: "list", path: "order.links", max: 6, title: (it) => `${it.label || "Link"}${it.url ? "" : " · no link yet"}`, add: () => ({ label: "Order online", url: "", note: "" }),
        item: [g2({ t: "text", path: "label", label: "Label", ph: "Order for delivery" }, { t: "text", path: "url", label: "Link", check: "https", ph: "https://…" }), { t: "text", path: "note", label: "Small line (optional)", ph: "Within 6 km" }] },
      { t: "note", text: "A link shows once it has an address: paste your page on the delivery app, or your own ordering page." },
      g2({ t: "toggle", path: "order.call", label: "Add “Call to order” (uses the phone number)" }, { t: "toggle", path: "order.whatsapp", label: "Add “Order on WhatsApp” (uses the WhatsApp number)" }),
      { t: "when", path: "order.whatsapp", is: "true", fields: [{ t: "text", path: "order.whatsappText", label: "Message the chat starts with" }] }] }],
  },
  {
    id: "ordering", label: "Online ordering", group: "Selling", sub: "Online ordering", desc: "An Order now page of your own: guests pick dishes, add extras, and order for delivery, pickup or their table. No commission and no ordering app.",
    cards: [
      { title: "Order now page", fields: [{ t: "toggle", path: "ordering.on", label: "Take orders on the site (adds the Order now page)" },
        { t: "note", text: "The page lists every dish on your Menu that has a price. Guests search, filter by diet, save favourites, choose sizes and extras, and check out with their name, mobile number and address. It opens at order.html, a good address for a table QR code (order.html?table=7 fills in table 7)." },
        g2({ t: "text", path: "ordering.label", label: "Name in the menu bar and on buttons" }, { t: "toggle", path: "ordering.inNav", label: "Show it in the menu bar" }),
        { t: "toggle", path: "ordering.onMenu", label: "Show the button on the Menu page (next to the search)" },
        g2({ t: "text", path: "ordering.title", label: "Page heading", ml: true }, { t: "text", path: "ordering.bestTitle", label: "Heading of the best sellers" }),
        { t: "textarea", path: "ordering.lede", label: "Line under the heading", rows: 2 },
        { t: "toggle", path: "ordering.tiles", label: "Show the menu's sections as tiles at the top" },
        { t: "note", text: "Mark best sellers, add extras (for example “Extra cheese = 30”) and keep a dish dine-in only under Menu → each dish. “Sold out today” there also stops it being ordered." }] },
      { title: "Ways to order and timing", fields: [g3({ t: "toggle", path: "ordering.modes.delivery", label: "Delivery" }, { t: "toggle", path: "ordering.modes.pickup", label: "Pick up" }, { t: "toggle", path: "ordering.modes.dinein", label: "At the table (dine-in)" }),
        g3({ t: "number", path: "ordering.deliveryMins", label: "Delivery takes about (minutes)", min: 0, step: 5 }, { t: "number", path: "ordering.pickupMins", label: "Pickup is ready in (minutes)", min: 0, step: 5 }, { t: "number", path: "ordering.dineMins", label: "Served at the table in (minutes)", min: 0, step: 5 }),
        { t: "toggle", path: "ordering.schedule", label: "Let guests order ahead for a later time" },
        { t: "when", path: "ordering.schedule", is: "true", fields: [g2({ t: "number", path: "ordering.slotMins", label: "Time slots every (minutes)", min: 10, step: 5 }, { t: "number", path: "ordering.daysAhead", label: "How many days ahead (0 = today only)", min: 0, step: 1 })] },
        { t: "note", text: "Times follow your Opening hours. While you're closed, guests can only order ahead (or not at all, if ordering ahead is off)." }] },
    ],
  },
  {
    id: "delivery", label: "Delivery & charges", group: "Selling", sub: "Online ordering", desc: "Where you deliver, what it costs, the minimum order, packing and tax used in the cart and at checkout.",
    cards: [
      { title: "Delivery area and fees", fields: [g3({ t: "number", path: "ordering.minOrder", label: "Minimum order", min: 0, step: 10 }, { t: "number", path: "ordering.deliveryFee", label: "Delivery fee", min: 0, step: 5 }, { t: "number", path: "ordering.freeAbove", label: "Free delivery above (0 = never)", min: 0, step: 50 }),
        { t: "textarea", path: "ordering.areas", label: "Where you deliver: one PIN code or area per line (empty = anywhere)", rows: 4 },
        { t: "note", text: "Add “= fee” for an area with its own delivery fee, for example “411001 = 30” or “Koregaon Park = 0”. An address outside the list can't be ordered to; the guest is offered pickup." },
        g2({ t: "text", path: "ordering.areaNote", label: "Message for an address you don't deliver to", ph: "Sorry, we don't deliver there yet. Choose Pick up, or call us." }, { t: "toggle", path: "ordering.askPin", label: "Ask for the PIN code" })] },
      { title: "Packing, tax and rounding", fields: [
        g3({ t: "number", path: "ordering.packing", label: "Packing charge per order", min: 0, step: 5 }, { t: "number", path: "ordering.taxPercent", label: "Tax (%)", min: 0, step: 0.5 }, { t: "text", path: "ordering.taxLabel", label: "Tax name", ph: "GST" }),
        g2({ t: "toggle", path: "ordering.taxIncluded", label: "Menu prices already include tax" }, { t: "toggle", path: "ordering.roundOff", label: "Round the total to a whole number" })] },
    ],
  },
  {
    id: "coupons", label: "Offers & coupons", group: "Selling", sub: "Online ordering", desc: "Codes guests can use in the cart.",
    cards: [
      { title: "Offers and coupons", fields: [{ t: "list", path: "ordering.coupons", max: 12, title: (it) => `${String(it.code || "CODE").toUpperCase()} · ${it.kind === "flat" ? "" : ""}${it.value || 0}${it.kind === "flat" ? " off" : "% off"}${it.on === false ? " (off)" : ""}`, add: () => ({ on: true, code: "", kind: "percent", value: 10, min: 0, max: 0, note: "" }),
        item: [g3({ t: "text", path: "code", label: "Code", ph: "WELCOME10" }, { t: "select", path: "kind", label: "Kind", options: [{ value: "percent", label: "Percent off" }, { value: "flat", label: "Amount off" }] }, { t: "number", path: "value", label: "Value", min: 0, step: 1 }),
          g3({ t: "number", path: "min", label: "Only on orders above", min: 0, step: 10 }, { t: "number", path: "max", label: "Most it takes off (percent; 0 = no limit)", min: 0, step: 10 }, { t: "toggle", path: "on", label: "Active" }),
          { t: "text", path: "note", label: "Line shown to guests (optional)", ph: "10% off your first order" }] },
        { t: "note", text: "Active codes are listed in the cart so guests can tap one. A code is checked on the guest's device, so treat it as a public offer, not a secret." }] },
    ],
  },
  {
    id: "checkout", label: "Checkout", group: "Selling", sub: "Online ordering", desc: "What guests are asked in the cart and at checkout, reminders for abandoned carts, and the GST invoice they can download.",
    cards: [
      { title: "Cart extras", fields: [g2({ t: "toggle", path: "ordering.tips", label: "Offer a tip for the team" }, { t: "text", path: "ordering.tipOptions", label: "Tip amounts", ph: "10, 20, 30" }),
        g3({ t: "toggle", path: "ordering.cutlery", label: "Ask whether to send cutlery" }, { t: "toggle", path: "ordering.dishNotes", label: "Special instructions per dish" }, { t: "toggle", path: "ordering.notes", label: "A note for the kitchen" }),
        { t: "toggle", path: "ordering.askEmail", label: "Ask for an email address (optional for the guest)" }] },
      { title: "Contact details before checkout", fields: [
        { t: "select", path: "ordering.need", label: "A guest must give", options: [{ value: "", label: "Standard: mobile number (email only if asked above)" }, { value: "phone", label: "Mobile number (email optional)" }, { value: "email", label: "Email address (mobile optional)" }, { value: "both", label: "Both mobile number and email" }, { value: "either", label: "Either one: mobile number or email" }] },
        { t: "toggle", path: "ordering.verifyPhone", label: "Verify the mobile number with a code before the order is placed" },
        { t: "when", path: "ordering.verifyPhone", is: "true", fields: [{ t: "note", text: "The guest gets a code on WhatsApp or by SMS and enters it at checkout (“Verify” sits inside the mobile number box); the order then shows the number as verified. It needs WhatsApp or SMS set up with a code template. Until one is, nothing is asked and orders go through as before. Switching it on here is the same as ticking “Ask customers to verify their mobile number” in the WhatsApp or SMS card." }] },
        { t: "toggle", path: "ordering.verifyEmail", label: "Verify the email address with a code before the order is placed" },
        { t: "when", path: "ordering.verifyEmail", is: "true", fields: [{ t: "note", text: "The guest is emailed a 6-digit code and enters it at checkout; the order then shows “Email: verified by a code” under Purchased orders. This works on a site hosted on Cloudflare, and the codes are sent by that database's own email (Resend). While its sender is still in test mode, codes can't reach guests: orders are then let through and marked “not verified”, so nobody is locked out. Send from your own domain (hosting window → Email settings) to verify everyone. An email address is checked only when one is given: choose Email or Both above to ask every guest for it (with Standard, also switch on “Ask for an email address” under Cart extras)." }] },
        { t: "note", text: "The other one is still shown, marked optional. Where guests verify their number on WhatsApp, or orders go to Petpooja, keep the mobile number required: verifying always asks for it, and Petpooja expects one." }] },
      // The GST invoice (details, style, layout, preview and wording) is part of checkout.
      { title: "Abandoned carts", fields: [
        { t: "toggle", path: "recovery.on", label: "Remind shoppers who leave their cart (they must have typed their email at checkout)" },
        { t: "when", path: "recovery.on", is: "true", fields: [
          g2({ t: "number", path: "recovery.after", label: "First reminder after (hours)", min: 1, step: 1, hint: "Empty means 1." }, { t: "number", path: "recovery.again", label: "Second reminder after (hours)", min: 0, step: 1, hint: "Empty means 24. 0 sends only one." }),
          { t: "text", path: "recovery.subject", label: "Email subject", ph: "You left something in your cart at {shop}" },
          { t: "textarea", path: "recovery.body", label: "Email text", hint: "Use {name}, {items}, {total}, {shop} and {offer}. The button back to the cart is added for you. Empty uses the standard wording." },
          g2({ t: "text", path: "recovery.offer", label: "Offer line (optional)", ph: "Use code COMEBACK10 for 10% off" }, { t: "text", path: "recovery.button", label: "Button label", ph: "Back to my cart" }),
          { t: "text", path: "recovery.url", label: "Address of this page (optional)", ph: "https://yourshop.com/checkout.html", hint: "Where the button goes. Empty uses the page the shopper was on." },
          { t: "toggle", path: "recovery.auto", def: true, label: "Send reminders by themselves (off: only when you press “Remind now”)" },
        ] },
        { t: "note", text: "Carts and the Remind now button are under Abandoned carts (in the menu, under Orders & guests). Every email has a link to stop reminders, an order from the same email closes the cart, and a site sends at most 50 reminders a day. Reminders are sent while the site is being visited, so a very quiet site may send them a little late. It runs on the site's own Cloudflare database, so the site must be hosted there and published once after this is switched on." },
      ] },
      ...gstCategory("restaurant").cards,
    ],
  },
  accountsCategory("restaurant"),
  {
    id: "payments", label: "Payments", group: "Selling", sub: "Online ordering", desc: "Turn on the ways guests can pay. A method only shows once its details are valid.",
    cards: [
      { title: "UPI", fields: [{ t: "toggle", path: "ordering.pay.upi", label: "Accept UPI (prices in ₹ only)" }, g2({ t: "text", path: "ordering.pay.upiId", label: "UPI ID", ph: "name@bank", check: "vpa" }, { t: "text", path: "ordering.pay.payee", label: "Payee name (as your bank shows it)" }),
        { t: "note", text: "The guest pays first: checkout shows a QR code and a button for their UPI app with the exact total and the order number, and the order is placed only when they enter the payment's 12-digit reference number (UTR). Under Purchased orders the order is marked “Payment to check” with that reference; find it in your UPI app and press Payment received, and the guest's order page shows it. A UPI ID alone can't tell a website that money arrived. For confirmation with no checking, turn on Razorpay, which includes UPI." }] },
      { title: "Razorpay", fields: [{ t: "toggle", path: "ordering.pay.razorpay", label: "Accept Razorpay (UPI, cards, netbanking): confirmed automatically" },
        { t: "connection", kind: "rz" },
        { t: "note", text: "Razorpay tells your database by itself that the money arrived, so the order is placed and marked Paid with no checking by you. The amount is worked out by your database from the menu, not by the guest's phone. Razorpay charges its usual fee per payment. Try it with a rzp_test_ key first: test mode takes no real money." }] },
      { title: "Cashfree", fields: [{ t: "toggle", path: "ordering.pay.cashfree", label: "Accept Cashfree (UPI, cards, netbanking): confirmed automatically" },
        { t: "connection", kind: "cf" },
        { t: "note", text: "The guest pays on Cashfree's page and comes back to your site; your database then asks Cashfree whether the money arrived, and only then places the order, marked Paid. Needs the guest's 10-digit mobile number. Prices in ₹ only. Tick the test switch with sandbox keys to try it with no real money." }] },
      { title: "PhonePe", fields: [{ t: "toggle", path: "ordering.pay.phonepe", label: "Accept PhonePe (UPI, cards, netbanking): confirmed automatically" },
        { t: "connection", kind: "pe" },
        { t: "note", text: "The guest pays on PhonePe's page and comes back to your site; your database then asks PhonePe whether the money arrived, and only then places the order, marked Paid. Prices in ₹ only. Use the Client ID, version and secret of PhonePe's Standard Checkout." }] },
      { title: "Stripe", fields: [{ t: "toggle", path: "ordering.pay.stripe", label: "Accept Stripe (cards from any country): confirmed automatically" },
        { t: "connection", kind: "st" },
        { t: "note", text: "The guest pays on Stripe's page and comes back to your site; your database then asks Stripe whether the money arrived, and only then places the order, marked Paid. Works for prices in ₹, $, € or £." }] },
      { title: "PayPal", fields: [{ t: "toggle", path: "ordering.pay.paypal", label: "Accept PayPal: confirmed automatically" },
        { t: "connection", kind: "pp" },
        { t: "note", text: "The guest pays on PayPal's page and comes back to your site; your database then collects the payment and only then places the order, marked Paid. PayPal doesn't take ₹: use it for prices in $, € or £." }] },
      { title: "Cash on delivery", fields: [{ t: "toggle", path: "ordering.pay.cod", label: "Offer pay on delivery, at the counter or at the table" }, { t: "text", path: "ordering.pay.codLabel", label: "Label at checkout for delivery orders", ph: "Pay on delivery (cash or UPI)" }] },
    ],
  },
  {
    id: "orderdelivery", label: "Order delivery", group: "Selling", sub: "Online ordering", desc: "Where new orders reach you.",
    cards: [
      { title: "Where orders reach you", fields: [
        { t: "note", text: "With the booking inbox set up (Booking form → where requests are saved), every order lands in Enquiries on the admin page and is emailed to you like a booking. There you move it through Confirmed, Being prepared, Out for delivery and Delivered, and on a site hosted on your Cloudflare database the guest's order page follows along. Without an inbox, the guest sends the order to you on WhatsApp with one tap." },
        g2({ t: "text", path: "ordering.whatsapp", label: "WhatsApp number for orders (empty uses the one under Address & contact)", ph: "+91 98xxxxxxxx", check: "phone" }, { t: "text", path: "ordering.intro", label: "First words of the order message", ph: "New order" }),
        g2({ t: "text", path: "ordering.prefix", label: "Order numbers start with", ph: "ORD" }, { t: "text", path: "ordering.success", label: "Message after ordering" }),
        { t: "note", text: "Guests aren't asked to sign in or wait for a code by SMS: their details, favourites and past orders are remembered on their own phone, and “Order again” refills the cart.", tone: "info" }] },
    ],
  },
  {
    id: "faq", label: "FAQ", group: "Pages", sub: "Sections", desc: "Questions guests often ask.",
    cards: [head2("faq"), { title: "Questions", fields: [{ t: "list", path: "faq.items", max: 20, title: (it) => it.q || "Question", add: () => ({ q: "New question", a: "" }), item: [{ t: "text", path: "q", label: "Question" }, { t: "textarea", path: "a", label: "Answer", rows: 3 }] }] }],
  },
  {
    id: "cta", label: "Call to action", group: "Pages", sub: "Sections", desc: "The dark band near the end that asks visitors to book.",
    cards: [{ title: "Call to action", fields: [{ t: "text", path: "cta.title", label: "Heading", ml: true }, { t: "textarea", path: "cta.body", label: "Text", rows: 2 }, g2({ t: "text", path: "cta.button", label: "Button" }, { t: "select", path: "cta.target", label: "Goes to", options: GOES }), linkWhen("cta.target", "Custom link for the button")] }],
  },
  videoCategory("Pages", "Sections"),
  socialCategory("Pages"),
  {
    id: "hours", label: "Opening hours", group: "Pages", desc: "The week's hours, the “Open now” badge and your time zone.",
    cards: [
      { title: "The week", fields: [
        { t: "toggle", path: "hours.same", label: "Same hours every day" },
        { t: "when", path: "hours.same", is: "true", fields: [g2({ t: "text", path: "hours.all.open", label: "Opens", ph: "12:00" }, { t: "text", path: "hours.all.close", label: "Closes", ph: "23:00" }, { t: "text", path: "hours.all.open2", label: "Opens again (optional)", ph: "19:00" }, { t: "text", path: "hours.all.close2", label: "Closes", ph: "23:30" }),
          { t: "note", text: "These hours apply to all seven days. Untick “Same hours every day” to set each day by itself (your day-by-day hours are kept)." }] },
        { t: "when", path: "hours.same", not: "true", fields: [
        { t: "list", path: "hours.days", fixed: true, add: () => ({}), title: (it) => `${it.day || "Day"} · ${it.closed ? "closed" : [it.open && it.close ? `${it.open}–${it.close}` : "", it.open2 && it.close2 ? `${it.open2}–${it.close2}` : ""].filter(Boolean).join(", ") || "no hours yet"}`,
          item: [g2({ t: "text", path: "day", label: "Day" }, { t: "toggle", path: "closed", label: "Closed this day" }),
            { t: "when", path: "closed", not: "true", local: true, fields: [g2({ t: "text", path: "open", label: "Opens", ph: "12:00" }, { t: "text", path: "close", label: "Closes", ph: "23:00" }, { t: "text", path: "open2", label: "Opens again (optional)", ph: "19:00" }, { t: "text", path: "close2", label: "Closes", ph: "23:30" })] }] }] },
        { t: "note", text: "Write times as 12:00 or 7:30 pm. A closing time earlier than the opening time runs past midnight (18:00 to 01:00). Use “Opens again” for a break between lunch and dinner." }] },
      { title: "How they show", fields: [g2({ t: "text", path: "hours.title", label: "Heading" }, { t: "select", path: "hours.format", label: "Clock", options: [{ value: "12", label: "12-hour (7:30 pm)" }, { value: "24", label: "24-hour (19:30)" }] }),
        { t: "toggle", path: "hours.showStatus", label: "Show “Open now” / “Closed now”" },
        g3({ t: "text", path: "hours.openLabel", label: "Words when open" }, { t: "text", path: "hours.closedLabel", label: "Words when closed" }, { t: "text", path: "hours.utcOffset", label: "Time zone (from UTC)", ph: "+05:30", hint: "India is +05:30. It makes “Open now” right for visitors anywhere." }),
        { t: "text", path: "hours.note", label: "Note under the hours", ph: "Kitchen closes 30 minutes before closing time." }] },
    ],
  },
  {
    id: "contact", label: "Address & contact", group: "Pages", desc: "Where you are, how to reach you and the map. The booking form is under Hours & contact → Booking form.",
    cards: [
      head("contact"),
      { title: "Details", fields: [{ t: "textarea", path: "contact.address", label: "Address", rows: 2 },
        g2({ t: "text", path: "contact.phone", label: "Phone", check: "phone" }, { t: "text", path: "contact.email", label: "Email", check: "email" }, { t: "text", path: "contact.whatsapp", label: "WhatsApp number (optional)", check: "phone" }, { t: "text", path: "contact.parking", label: "Parking (optional)", ph: "Valet parking in the evening" }),
        g2({ t: "text", path: "contact.placeTitle", label: "Name of this location (optional)", ph: "Koregaon Park", hint: "Shown as the title of its map when you have more than one location." }, { t: "text", path: "contact.placeGroup", label: "City, state or country it is in (optional)", ph: "Pune", hint: "Locations that share this are grouped together." })] },
      { title: "Map", fields: [{ t: "toggle", path: "contact.mapEmbed", label: "Show a map of the address" },
        { t: "text", path: "contact.mapUrl", label: "Your Google Maps link (optional)", check: "https", hint: "Used by Get directions. Without it, directions search for the address above." },
        g2({ t: "select", path: "contact.mapSize", label: "Size of the map", options: [{ value: "", label: "The theme's own size" }, { value: "s", label: "Small" }, { value: "m", label: "Medium" }, { value: "l", label: "Large" }, { value: "xl", label: "Extra large" }, { value: "tall", label: "Tall (portrait)" }] },
          { t: "select", path: "contact.mapFrom", label: "What the map shows", options: [{ value: "", label: "The address entered above" }, { value: "place", label: "A place name or coordinates I type" }] }),
        { t: "when", path: "contact.mapFrom", is: "place", fields: [{ t: "text", path: "contact.mapQ", label: "Place to show on the map", ph: "18.5362, 73.8940", hint: "The name of the place as Google Maps knows it, a plus code, or its coordinates (latitude, longitude). Use this when the address alone puts the pin in the wrong spot." }] },
        { t: "toggle", path: "contact.mapTap", label: "Wait for a tap before loading the map (privacy)" },
        { t: "note", text: "The map shows by itself as soon as there is an address. With “wait for a tap” on, visitors see a “Show the map” button first, and nothing is sent to Google before they press it." }] },
      { title: "More locations", fields: [
        { t: "note", text: "Add your other outlets here: in another country, state or city, or in other parts of the same city. Each one gets its own title, address and map. With more than one location, Find us shows them all in the style you choose below; the address above is the first one." },
        { t: "list", path: "contact.places", max: 60, add: () => ({ id: "pl-" + Math.random().toString(36).slice(2, 8), on: true, title: "", group: "", address: "", phone: "", note: "", mapFrom: "", mapQ: "", mapUrl: "" }), title: (it) => `${it?.title || (it?.address || "").split("\n")[0] || "Location"}${it?.group ? " · " + it.group : ""}${it?.on === false ? " (hidden)" : ""}`,
          item: [
            g2({ t: "text", path: "title", label: "Title", ph: "Indiranagar" }, { t: "text", path: "group", label: "City, state or country it is in", ph: "Bengaluru", hint: "Locations that share this are grouped together." }),
            { t: "textarea", path: "address", label: "Address", rows: 2 },
            g2({ t: "text", path: "phone", label: "Phone (optional)", check: "phone" }, { t: "text", path: "note", label: "Hours or a note (optional)", ph: "Open 12 to 11, all days" }),
            g2({ t: "select", path: "mapFrom", label: "What the map shows", options: [{ value: "", label: "The address entered above" }, { value: "place", label: "A place name or coordinates I type" }] }, { t: "text", path: "mapUrl", label: "Google Maps link (optional)", check: "https", hint: "Used by Get directions." }),
            { t: "when", path: "mapFrom", is: "place", local: true, fields: [{ t: "text", path: "mapQ", label: "Place to show on the map", ph: "12.9719, 77.6412" }] },
            { t: "toggle", path: "on", label: "Show this location" },
          ] },
        g2({ t: "select", path: "contact.placesStyle", label: "How several locations are shown", options: [{ value: "", label: "Stacked cards: one in front, the next ones peeking at the sides" }, { value: "tabs", label: "Tabs: a row of names, one location at a time" }, { value: "split", label: "List and map: names on the left, the chosen one on the right" }, { value: "grid", label: "Grid: every location as a card" }, { value: "accordion", label: "Fold-out list: tap a name to open it" }, { value: "strip", label: "Sliding row: swipe sideways through the cards" }] },
          { t: "toggle", path: "contact.placesFilter", label: "Let visitors filter by city, state or country" }),
      ] },
    ],
  },
  {
    id: "footer", label: "Footer", group: "Pages", desc: "The bottom of every page: a line about you, the address, this week's hours and legal links.",
    cards: [{ title: "Footer", fields: [{ t: "textarea", path: "footer.text", label: "Short description", rows: 2 }, { t: "text", path: "footer.legal", label: "Legal line", hint: "{year} becomes the current year." },
      { t: "list", path: "footer.links", max: 6, title: (it) => it.label || "Link", add: () => ({ label: "New link", url: "" }), item: [g2({ t: "text", path: "label", label: "Label" }, { t: "text", path: "url", label: "Link", check: "https" })] }] }],
  },
  staticPagesCategory("page"),
  {
    id: "forms", label: "Booking form", group: "Forms & records", desc: "The table-booking form's questions, its messages and where the requests go.",
    cards: [
      { title: "Heading beside the form", fields: [g2({ t: "text", path: "reserve.eyebrow", label: "Small label above" }, { t: "text", path: "reserve.title", label: "Heading", ml: true }), { t: "textarea", path: "reserve.lede", label: "Intro line", rows: 2 }, { t: "text", path: "reserve.note", label: "Small note", ph: "For groups of more than 10, please call us." }] },
      { title: "Booking form", fields: [{ t: "toggle", path: "contact.form.enabled", label: "Show the booking form" },
        { t: "when", path: "contact.form.enabled", is: "true", fields: [
          { t: "text", path: "contact.form.title", label: "Form heading" },
          { t: "note", text: "The form always asks for a name and a phone number." },
          g2({ t: "toggle", path: "contact.form.askDate", label: "Ask for the date" }, { t: "toggle", path: "contact.form.askTime", label: "Ask for the time" }, { t: "toggle", path: "contact.form.askGuests", label: "Ask how many guests" }, { t: "toggle", path: "contact.form.askEmail", label: "Ask for an email (optional for the guest)" },
            { t: "toggle", path: "contact.form.askOccasion", label: "Ask for the occasion" }, { t: "toggle", path: "contact.form.askType", label: "Ask what the request is for" }),
          { t: "when", path: "contact.form.askGuests", is: "true", fields: [{ t: "number", path: "contact.form.maxGuests", label: "Largest table guests can pick", min: 1, step: 1 }] },
          { t: "when", path: "contact.form.askTime", is: "true", fields: [{ t: "strings", path: "contact.form.slots", label: "Times guests can pick", addLabel: "Add a time" }, { t: "note", text: "Write each as 19:30. With no times listed, guests type any time." }] },
          { t: "when", path: "contact.form.askOccasion", is: "true", fields: [{ t: "strings", path: "contact.form.occasions", label: "Occasions", addLabel: "Add occasion" }] },
          { t: "when", path: "contact.form.askType", is: "true", fields: [{ t: "strings", path: "contact.form.types", label: "“I'd like to” choices", addLabel: "Add choice" }] },
          g2({ t: "text", path: "contact.form.messageLabel", label: "Label of the notes box" }, { t: "text", path: "contact.form.submit", label: "Button label" }),
          { t: "text", path: "contact.form.consent", label: "Consent checkbox (empty hides it)" },
          { t: "textarea", path: "contact.form.success", label: "Message after sending", rows: 2 },
          { t: "note", text: "Requests are saved in the site's database and listed under Enquiries in the admin page. A request is not a confirmed booking: call or message the guest to confirm. (A site that has no database yet opens the visitor's email app instead, addressed to your contact email: give it one with Publish to Cloudflare in the Studio.)" },
          { t: "toggle", path: "contact.form.notify", label: "Email me each request" },
          { t: "when", path: "contact.form.notify", is: "true", fields: [
            g2({ t: "text", path: "contact.form.notifyTo", label: "Send to", ph: "the contact email", hint: "Up to 3 addresses, separated by commas. Empty uses the email under Address & contact, or else the site's editors." },
              { t: "text", path: "contact.form.notifySubject", label: "Subject", ph: "New booking request from {name}", hint: "{name} is the guest's name, {site} the site's name." }),
            { t: "note", text: "The email lists everything the guest filled in. It is sent by the site's database through the same Resend email settings that send your sign-in codes. If one doesn't arrive, open Enquiries: every request says whether it was emailed and, when it wasn't, why." },
          ] },
          { t: "when", path: "contact.form.sbUrl", not: "", fields: [g3({ t: "text", path: "contact.form.sbUrl", label: "Supabase Project URL (GitHub sites)", check: "https" }, { t: "text", path: "contact.form.sbKey", label: "Public (anon) key" }, { t: "text", path: "contact.form.site", label: "Site ID", ph: "my-restaurant" })] },
        ] }] },
    ],
  },
  emailsCategory(true, true),
  featuresCategory(),
  festivalCategory(),
  i18nCategory(),
  (() => { const s = seoCategory(true); s.cards.splice(2, 0, { title: "For search engines: about the restaurant", fields: [g2({ t: "text", path: "seo.cuisine", label: "Cuisine", ph: "Indian, North Indian" }, { t: "text", path: "seo.priceRange", label: "Price range", ph: "₹₹" }),
    { t: "note", text: "Together with your name, address, phone and opening hours, these are written into the home page in the form search engines read for restaurants, which can add your hours and rating to search results." }] }); return s; })(),
  consentCategory(),
  legalCategory(),
  adminCategory(),
  codeCategory(),
];
{ const k = schema.find((c) => c.id === "coupons"); if (k) k.cards.push(loyaltyCard("restaurant")); }
withSectionBg(schema, { contact: [["contact"]], forms: [["reserve", "Background & text of the booking section"]] }, [...REST_DISPLAY_FONTS, ...REST_BODY_FONTS]);

function prepareRestaurant(c: any) {
  if (!c || typeof c !== "object") return;
  c.site ||= { multiPage: false };
  c.site.pageLabels = { home: "Home", menu: "Menu", about: "Our story", gallery: "Gallery", contact: "Visit & book", ...(c.site.pageLabels && typeof c.site.pageLabels === "object" ? c.site.pageLabels : {}) };
  if (typeof c.site.mobileBar !== "boolean") c.site.mobileBar = true;
  c.notice = { on: false, text: "", label: "", target: "offers", ...(c.notice && typeof c.notice === "object" ? c.notice : {}) };
  c.hero ||= {}; if (!Array.isArray(c.hero.images)) c.hero.images = [];
  prepareSlides(c.hero, c.theme?.deep || "#2A1710"); prepareMaintenance(c);
  c.food = { eyebrow: "", title: "Menu", lede: "", currency: "₹", dietMarks: true, filters: true, search: true, photos: true, homeCount: 3, all: "See the full menu", pdfUrl: "", pdfLabel: "Download the menu (PDF)", note: "", ...(c.food && typeof c.food === "object" ? c.food : {}) };
  c.food.categories = (Array.isArray(c.food.categories) ? c.food.categories : []).filter((k: any) => k && typeof k === "object");
  for (const k of c.food.categories) { k.items = (Array.isArray(k.items) ? k.items : []).filter((d: any) => d && typeof d === "object"); for (const d of k.items) { if (!Array.isArray(d.variants)) d.variants = []; if (d.kinds !== undefined && !Array.isArray(d.kinds)) d.kinds = []; d.addons = (Array.isArray(d.addons) ? d.addons : []).filter((g: any) => g && typeof g === "object"); for (const g of d.addons) g.options = (Array.isArray(g.options) ? g.options : []).map((o: any) => String(o ?? "")); d.spice = String(Math.max(0, Math.min(3, +d.spice || 0))); } }
  { const G = c.gst && typeof c.gst === "object" ? c.gst : {}; c.gst = { on: false, legalName: "", gstin: "", address: "", state: "", pan: "", prefix: "INV-", defaultHsn: "9963", askGstin: false, sign: "", notes: "", ...G, defaultRate: String(G.defaultRate ?? "5") }; }
  c.hours = { title: "Opening hours", format: "12", utcOffset: "+05:30", showStatus: true, note: "", openLabel: "Open now", closedLabel: "Closed now", ...(c.hours && typeof c.hours === "object" ? c.hours : {}) };
  const have: any[] = Array.isArray(c.hours.days) ? c.hours.days.filter((d: any) => d && typeof d === "object") : [];
  c.hours.days = DAYS.map((day, i) => ({ day, closed: false, open: "", close: "", open2: "", close2: "", ...(have[i] || {}) }));
  // "Same hours every day": one set of times for the whole week (starts from Monday's when first switched on).
  c.hours.same = c.hours.same === true;
  { const a = c.hours.all && typeof c.hours.all === "object" ? c.hours.all : {}, m = c.hours.days[0] || {}; c.hours.all = { open: String(a.open ?? m.open ?? ""), close: String(a.close ?? m.close ?? ""), open2: String(a.open2 ?? m.open2 ?? ""), close2: String(a.close2 ?? m.close2 ?? "") }; }
  for (const k of ["highlights", "specials", "offers", "gallery", "chef", "events", "press", "testimonials", "order", "reserve", "faq", "about", "cta", "footer"]) c[k] = c[k] && typeof c[k] === "object" ? c[k] : {};
  {
    const o = c.ordering && typeof c.ordering === "object" ? c.ordering : {};
    c.ordering = { on: false, label: "Order now", title: "Order online", lede: "Fresh from our kitchen, for delivery or pickup.", bestTitle: "Best sellers", tiles: true, inNav: true, onMenu: true, deliveryMins: 40, pickupMins: 20, dineMins: 15, minOrder: 200, deliveryFee: 40, freeAbove: 0, areas: "", areaNote: "", askPin: true, packing: 0, taxPercent: 5, taxLabel: "GST", taxIncluded: false, roundOff: true,
      tips: true, tipOptions: "10, 20, 30", cutlery: true, notes: true, dishNotes: true, askEmail: false, schedule: true, slotMins: 30, daysAhead: 1, whatsapp: "", intro: "New order", prefix: "ORD", success: "Thank you! Your order is placed.", ...o,
      modes: { delivery: true, pickup: true, dinein: false, ...(o.modes && typeof o.modes === "object" ? o.modes : {}) }, pay: { cod: true, codLabel: "", upi: false, upiId: "", payee: "", razorpay: false, cashfree: false, phonepe: false, stripe: false, paypal: false, ...(o.pay && typeof o.pay === "object" ? o.pay : {}) },
      coupons: (Array.isArray(o.coupons) ? o.coupons : []).filter((x: any) => x && typeof x === "object") };
  }
  for (const [k, list] of [["highlights", "items"], ["specials", "items"], ["offers", "items"], ["gallery", "items"], ["chef", "members"], ["events", "items"], ["press", "logos"], ["testimonials", "items"], ["order", "links"], ["faq", "items"], ["about", "facts"]] as const) if (!Array.isArray(c[k][list])) c[k][list] = [];
  c.contact ||= {}; c.contact.form = c.contact.form && typeof c.contact.form === "object" ? c.contact.form : { enabled: true };
  { const F = c.contact.form; if (F.saveTo !== "file") F.saveTo = "auto"; if (F.notifyAsk !== 1) { F.notify = true; F.notifyAsk = 1; } else F.notify = F.notify === true; F.notifyTo ??= ""; F.notifySubject ??= "";
    for (const k of ["slots", "occasions", "types"]) if (!Array.isArray(F[k])) F[k] = []; }
  if (typeof c.contact.mapEmbed !== "boolean") c.contact.mapEmbed = true;
  c.loyalty = { on: false, earn: 5, worth: 1, min: 50, maxPct: 50, ...(c.loyalty && typeof c.loyalty === "object" ? c.loyalty : {}) };
  c.contact.places = (Array.isArray(c.contact.places) ? c.contact.places : []).filter((x: any) => x && typeof x === "object"); if (typeof c.contact.placesFilter !== "boolean") c.contact.placesFilter = true;
  prepareI18n(c, () => schema);
  prepareMenu(c, () => (Array.isArray(c.sections) ? c.sections : []).filter((x: any) => x && x.show !== false && x.inNav).map((x: any) => menuItem(x.label || x.id, x.id)));
  c.sections = (Array.isArray(c.sections) ? c.sections : []).filter((s: any) => s && REST_SECTIONS.some(([id]) => id === s.id));
  // A section added in a newer version goes in after the one before it in the default order.
  REST_SECTIONS.forEach(([id, label], k) => {
    if (c.sections.some((s: any) => s.id === id)) return;
    const after = k ? c.sections.findIndex((s: any) => s.id === REST_SECTIONS[k - 1][0]) : -1;
    c.sections.splice(after + 1, 0, { id, label, show: true, inNav: IN_NAV.includes(id) });
  });
}

const dishCount = (c: any) => (c?.food?.categories || []).reduce((n: number, k: any) => n + (k?.items || []).length, 0);

export const restaurantTemplate: TemplateDef = {
  id: "restaurant",
  name: "Restaurant & café",
  kind: "One or several pages",
  description: "A site for a restaurant, café, bakery, bar or any dine-in place: a full menu with diet marks, offers, a gallery, opening hours with “Open now”, a map, ordering links and a table-booking form whose requests show in the admin page.",
  pages: [
    { file: "index.html", label: "Home" },
    { file: "menu.html", label: "Menu" },
    { file: "about.html", label: "Our story" },
    { file: "gallery.html", label: "Gallery" },
    { file: "contact.html", label: "Visit & book" },
    { file: "order.html", label: "Order now" },
  ],
  schema,
  colorKeys: [{ key: "c1", label: "Primary" }, { key: "c2", label: "Secondary" }, { key: "c3", label: "Highlight" }, { key: "text", label: "Text" }, { key: "surface", label: "Cards" }, { key: "deep", label: "Dark" }],
  themePath: "theme",
  themeValues: restaurantThemeValues,
  themes: REST_THEMES,
  themeTags: REST_TAGS,
  prepare: prepareRestaurant,
  sampleOnly: ["gallery.items"],
  summary: (c) => { const n = dishCount(c), k = (c?.food?.categories || []).length; return `${n} dish${n === 1 ? "" : "es"} in ${k} menu section${k === 1 ? "" : "s"}${(c?.offers?.items || []).length ? ` · ${c.offers.items.length} offers` : ""}`; },
  checks: (c) => {
    const w: string[] = [];
    const F = c?.contact?.form || {}, K = c?.contact || {};
    if (!dishCount(c)) w.push("The menu has no dishes yet. Add them under Menu.");
    if (!String(K.phone || "").trim()) w.push("There is no phone number. Guests expect one: add it under Address & contact.");
    if (!String(K.address || "").trim()) w.push("There is no address, so Get directions and the map can't show.");
    if (!(c?.hours?.same ? c.hours.all?.open && c.hours.all?.close : (c?.hours?.days || []).some((d: any) => d && (d.closed || (d.open && d.close))))) w.push("The opening hours are empty. Fill them in under Opening hours.");
    if (F.enabled && F.saveTo !== "file" && !K.email) w.push("The booking form has no email to fall back on. Add one under Address & contact.");
    if (F.enabled && (F.sbUrl || F.sbKey) && !(F.sbUrl && F.sbKey && F.site)) w.push("The booking form's Supabase settings are incomplete (Project URL, public key and Site ID are all needed).");
    if (c?.events?.button && c?.events?.type && F.askType !== false && !(F.types || []).includes(c.events.type)) w.push(`The events button picks “${c.events.type}” in the booking form, but that isn't one of the form's choices.`);
    if (/^picaffectz$/i.test(String(c?.brand?.name || "").trim()) && c?.brand?.tagline === "Slow-cooked food, served warm") w.push("The restaurant name and tagline are still the sample (Picaffectz).");
    return [...w, ...legalChecks("restaurant", c)];
  },
};
