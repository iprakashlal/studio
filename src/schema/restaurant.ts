import type { Category, Field, TemplateDef } from "./types";
import { FX_AXES, LINE_BREAKS_AXIS, type Axis } from "../themes/catalog";
import { REST_AXES, REST_BODY_FONTS, REST_DISPLAY_FONTS, REST_TAGS, REST_THEMES, restaurantThemeValues } from "../themes/restaurant";
import { NAV_MODE_FIELD } from "../themes/fields";
import { adminCategory, videoCategory, socialCategory, logoFields, consentCategory, emailsCategory, i18nCategory, prepareI18n, featuresCategory, festivalCategory, menuCategory, menuItem, prepareMenu, staticPagesCategory, heroSlidesCard, prepareSlides, prepareMaintenance, seoCategory } from "./common";

const g2 = (...fields: Field[]): Field => ({ t: "grid", cols: 2, fields });
const g3 = (...fields: Field[]): Field => ({ t: "grid", cols: 3, fields });
const sel = (a: Axis): Field => ({ t: "select", path: "theme." + a.key, label: a.label, options: a.options.map(([value, label]) => ({ value, label })) });
type Card = Category["cards"][number];

export const REST_SECTIONS: [string, string][] = [["hero", "Home"], ["highlights", "Highlights"], ["about", "Our story"], ["specials", "Signature dishes"], ["food", "Menu"], ["offers", "Offers"], ["gallery", "Gallery"], ["chef", "Our team"], ["events", "Events & catering"],
  ["press", "Featured in"], ["testimonials", "Reviews"], ["order", "Order online"], ["reserve", "Book a table"], ["contact", "Visit us"], ["faq", "FAQ"], ["cta", "Call to action"]];
const IN_NAV = ["about", "food", "gallery", "events", "contact"];
const TARGETS = REST_SECTIONS.filter(([id]) => id !== "hero").map(([value, label]) => ({ value, label }));
const ICONS: [string, string][] = [["cutlery", "Fork and knife"], ["flame", "Flame"], ["leaf", "Leaf"], ["bowl", "Steaming bowl"], ["people", "People"], ["cup", "Cup"], ["glass", "Glass"], ["cake", "Cake"], ["pizza", "Pizza slice"], ["fish", "Fish"], ["hat", "Chef's hat"], ["truck", "Delivery van"],
  ["bag", "Takeaway bag"], ["calendar", "Calendar"], ["clock", "Clock"], ["pin", "Map pin"], ["phone", "Phone"], ["star", "Star"], ["heart", "Heart"], ["music", "Music"], ["wifi", "Wi-Fi"], ["car", "Parking"], ["sun", "Outdoor seating"], ["paw", "Pet friendly"], ["gift", "Gift"], ["shield", "Hygiene"], ["spark", "Spark"]];
const ICON_OPTS = ICONS.map(([value, label]) => ({ value, label }));
const DIETS = [{ value: "", label: "Not marked" }, { value: "veg", label: "Vegetarian" }, { value: "vegan", label: "Vegan" }, { value: "egg", label: "Contains egg" }, { value: "nonveg", label: "Non-vegetarian" }];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const head = (k: string, title = "Section heading"): Card => ({ title, fields: [g2({ t: "text", path: k + ".eyebrow", label: "Small label above" }, { t: "text", path: k + ".title", label: "Heading", ml: true }), { t: "textarea", path: k + ".lede", label: "Intro line", rows: 2 }] });
const head2 = (k: string): Card => ({ title: "Heading", fields: [g2({ t: "text", path: k + ".eyebrow", label: "Small label above" }, { t: "text", path: k + ".title", label: "Heading", ml: true })] });
export const newDish = () => ({ name: "New dish", desc: "", price: "", diet: "", spice: "0", tag: "", allergens: "", image: null, variants: [], soldOut: false });

const schema: Category[] = [
  {
    id: "look", label: "Theme & layout", group: "Design", desc: `Choose from ${REST_THEMES.length} restaurant themes, then fine-tune the layout, the food menu's style and the graphics.`,
    cards: [
      { title: "Theme", fields: [{ t: "note", studio: true, text: `${REST_THEMES.length} restaurant themes (R-001 to R-${String(REST_THEMES.length).padStart(3, "0")}), half classic and half modern. Each has its own mix of hero layout, picture frame, menu bar, food-menu style, background, section edges and ornament. Picking one restyles the whole site; your content stays as it is, and every setting below stays editable.` }, { t: "themes" }] },
      { title: "Layout", fields: [g2(sel(REST_AXES.layout), sel(REST_AXES.heroArt), sel(REST_AXES.nav), NAV_MODE_FIELD, sel(REST_AXES.width), sel(REST_AXES.bands)),
        { t: "note", text: "“Full-width photo” and “Photo in a frame” need a hero photo (Hero → Picture); the collage needs two or three. Without them the hero uses the split layout, with a round stamp made from your name." }] },
      { title: "Food menu & gallery", fields: [g2(sel(REST_AXES.menuStyle), sel(REST_AXES.gallery)),
        { t: "note", text: "Photo cards, the list and the magazine style show dish photos; the classic, chalkboard, printed card and boxes keep the menu to words and prices." }] },
      { title: "Style & graphics", fields: [g2(sel(REST_AXES.heading), sel(REST_AXES.shead), sel(REST_AXES.ornament), sel(REST_AXES.divider), sel(REST_AXES.pattern), sel(REST_AXES.cards), sel(REST_AXES.buttons), sel(REST_AXES.motionStyle)),
        { t: "note", text: "The ornament is the small drawing above section titles, in the menu and in the footer. The edge shapes show where a band of colour begins, so they need “Alternate soft bands” or “Alternate dark bands”. Visitors who ask their device for reduced motion always get a still page." }] },
      { title: "Interactions (optional)", fields: [{ t: "note", text: "Restaurant themes keep these off, so the page stays quick on a phone. Switch one on if it suits your place." },
        g2({ ...sel(FX_AXES.cursor) }, sel(FX_AXES.loader), sel(FX_AXES.textfx), sel(FX_AXES.hoverfx), sel(FX_AXES.scrollfx), sel(FX_AXES.overlay))] },
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
    ],
  },
  {
    id: "pages", label: "Sections & order", group: "Pages", desc: "One page or several, which sections show, their order, the announcement bar and the phone's quick buttons.",
    cards: [
      { title: "Pages", fields: [{ t: "toggle", path: "site.multiPage", label: "Use several pages (Home, Menu, Our story, Gallery, Visit & book)" },
        { t: "note", text: "Off: one page with every section, and the menu bar scrolls to them. On: Home shows the highlights (hero, story, signature dishes, the first menu sections, offers, a few photos, reviews) and the menu bar opens the Menu, Our story, Gallery and Visit & book pages. The Menu page (menu.html) is a good address for a table QR code." },
        { t: "when", path: "site.multiPage", is: "true", fields: [g3({ t: "text", path: "site.pageLabels.home", label: "Home page name" }, { t: "text", path: "site.pageLabels.menu", label: "Menu page name" }, { t: "text", path: "site.pageLabels.about", label: "Story page name" },
          { t: "text", path: "site.pageLabels.gallery", label: "Gallery page name" }, { t: "text", path: "site.pageLabels.contact", label: "Visit & book page name" })] }] },
      { title: "Sections", fields: [{ t: "note", text: "Reorder with the arrows. Hidden sections stay in your content. On one page, sections with “In the menu bar” get a link at the top." },
        { t: "list", path: "sections", fixed: true, add: () => ({}), title: (it) => `${it.label || it.id}${it.show === false ? " (hidden)" : ""}`,
          item: [g2({ t: "text", path: "label", label: "Name in the menu bar" }, { t: "toggle", path: "show", label: "Show this section" }), { t: "toggle", path: "inNav", label: "In the menu bar (one-page mode)" }] }] },
      { title: "Button in the menu bar", fields: [g2({ t: "text", path: "nav.cta", label: "Button label (empty hides it)" }, { t: "select", path: "nav.ctaTarget", label: "Goes to", options: TARGETS })] },
      { title: "Announcement bar", fields: [{ t: "toggle", path: "notice.on", label: "Show a line above the menu bar" },
        { t: "when", path: "notice.on", is: "true", fields: [{ t: "text", path: "notice.text", label: "Announcement", ph: "Closed on 26 January. Open as usual from the 27th." },
          g2({ t: "text", path: "notice.label", label: "Link label (optional)", ph: "See offers" }, { t: "select", path: "notice.target", label: "Link goes to", options: TARGETS }),
          { t: "note", text: "Visitors can close it; it comes back when you change the text." }] }] },
      { title: "Quick buttons on phones", fields: [{ t: "toggle", path: "site.mobileBar", label: "Keep Call, Directions, Menu and Book at the bottom of the screen on phones" },
        { t: "note", text: "Each button shows only when it has somewhere to go: a phone number, an address, a menu, the booking form." }] },
    ],
  },
  menuCategory({ where: "the sections marked “In the menu bar” (or the site's pages when it has several)", targets: [{ value: "home", label: "Home (top of the site)" }, ...TARGETS.map((t) => ({ value: t.value, label: `Section: ${t.label}` }))] }),
  {
    id: "hero", label: "Hero", group: "Pages", sub: "Sections", desc: "The first screen: headline, intro, buttons, the open-now badge and the picture.",
    cards: [
      { title: "Text", fields: [{ t: "text", path: "hero.eyebrow", label: "Small label above", ph: "Modern Indian kitchen · Pune" }, { t: "text", path: "hero.title", label: "Headline", ml: true, hint: "Enter starts a new line. Wrap words in *asterisks* to highlight them." }, { t: "textarea", path: "hero.lede", label: "Intro", rows: 3 }] },
      { title: "Buttons", fields: [g2({ t: "text", path: "hero.ctaPrimary", label: "Main button" }, { t: "select", path: "hero.ctaPrimaryTarget", label: "Goes to", options: TARGETS }, { t: "text", path: "hero.ctaSecondary", label: "Second button" }, { t: "select", path: "hero.ctaSecondaryTarget", label: "Goes to", options: TARGETS })] },
      { title: "Open now & points", fields: [{ t: "toggle", path: "hero.showStatus", label: "Show “Open now” or “Closed now” above the headline" },
        { t: "strings", path: "hero.badges", label: "Short points under the buttons", addLabel: "Add point" }] },
      { title: "Picture", fields: [{ t: "image", path: "hero.image", label: "Hero photo (optional)", hint: "Your best dish, the dining room or the shopfront. Without one, the hero shows a round stamp with the line below." },
        { t: "images", path: "hero.images", label: "More photos for the collage layout (up to 2)", hint: "Used by the “Three-photo collage” hero layout, beside the hero photo." },
        { t: "videoFile", path: "hero.video", label: "Or a hero video", hint: "MP4 or WebM, up to 20 MB. It plays silently on a loop in the photo's place; the photo above is shown first, while it loads. A short clip works best." },
        { t: "text", path: "hero.stamp", label: "Line around the stamp (no photo)", ph: "Est. 2014 · Cooked over fire" }] },
      heroSlidesCard("hero", "the hero photo or stamp"),
    ],
  },
  {
    id: "food", label: "Menu", group: "Pages", sub: "Sections", desc: "Your food and drinks menu: sections, dishes, prices, diet marks, spice level, allergens and photos.",
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
      { title: "Sections and dishes", fields: [{ t: "list", path: "food.categories", max: 40, title: (it) => `${it.name || "Section"} · ${(it.items || []).length} dish${(it.items || []).length === 1 ? "" : "es"}`, add: () => ({ name: "New section", note: "", image: null, items: [newDish()] }),
        item: [g2({ t: "text", path: "name", label: "Section name", ph: "Starters" }, { t: "text", path: "note", label: "Note (optional)", ph: "Served till 4 pm" }),
          { t: "image", path: "image", label: "Section photo (magazine style)", hint: "Shown beside the section in the magazine menu style." },
          { t: "list", path: "items", label: "Dishes", max: 120, title: (it) => `${it.name || "Dish"}${it.price ? " · " + it.price : ""}${it.soldOut ? " · sold out" : ""}`, add: newDish,
            item: [g2({ t: "text", path: "name", label: "Dish" }, { t: "text", path: "price", label: "Price", ph: "320" }),
              { t: "textarea", path: "desc", label: "Description", rows: 2 },
              g3({ t: "select", path: "diet", label: "Diet", options: DIETS }, { t: "select", path: "spice", label: "Spice", options: [{ value: "0", label: "Not shown" }, { value: "1", label: "Mild" }, { value: "2", label: "Medium" }, { value: "3", label: "Hot" }] }, { t: "text", path: "tag", label: "Tag (optional)", ph: "Bestseller, New" }),
              g2({ t: "text", path: "allergens", label: "Contains (allergens)", ph: "dairy, nuts" }, { t: "toggle", path: "soldOut", label: "Sold out today" }),
              { t: "image", path: "image", label: "Photo (optional)" },
              { t: "list", path: "variants", label: "Sizes with their own prices (optional)", max: 6, title: (it) => `${it.label || "Size"}${it.price ? " · " + it.price : ""}`, add: () => ({ label: "", price: "" }), item: [g2({ t: "text", path: "label", label: "Size", ph: "Half" }, { t: "text", path: "price", label: "Price", ph: "180" })] }] }] }] },
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
    id: "testimonials", label: "Reviews", group: "Pages", sub: "Sections", desc: "What guests say.",
    cards: [head2("testimonials"),
      { title: "Reviews from Google", studio: true, fields: [{ t: "googleReviews" }] },
      { title: "Reviews", fields: [{ t: "list", path: "testimonials.items", max: 12, title: (it) => it.name || "Review", add: () => ({ quote: "", name: "", role: "", company: "", rating: "5" }),
        item: [{ t: "textarea", path: "quote", label: "What they said", rows: 3 }, g2({ t: "text", path: "name", label: "Name" }, { t: "select", path: "rating", label: "Stars", options: [{ value: "", label: "None" }, { value: "5", label: "★★★★★" }, { value: "4", label: "★★★★" }, { value: "3", label: "★★★" }] })] }] }],
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
    id: "faq", label: "FAQ", group: "Pages", sub: "Sections", desc: "Questions guests often ask.",
    cards: [head2("faq"), { title: "Questions", fields: [{ t: "list", path: "faq.items", max: 20, title: (it) => it.q || "Question", add: () => ({ q: "New question", a: "" }), item: [{ t: "text", path: "q", label: "Question" }, { t: "textarea", path: "a", label: "Answer", rows: 3 }] }] }],
  },
  {
    id: "cta", label: "Call to action", group: "Pages", sub: "Sections", desc: "The dark band near the end that asks visitors to book.",
    cards: [{ title: "Call to action", fields: [{ t: "text", path: "cta.title", label: "Heading", ml: true }, { t: "textarea", path: "cta.body", label: "Text", rows: 2 }, g2({ t: "text", path: "cta.button", label: "Button" }, { t: "select", path: "cta.target", label: "Goes to", options: TARGETS })] }],
  },
  videoCategory("Pages", "Sections"),
  socialCategory("Pages"),
  {
    id: "hours", label: "Opening hours", group: "Pages", desc: "The week's hours, the “Open now” badge and your time zone.",
    cards: [
      { title: "The week", fields: [
        { t: "list", path: "hours.days", fixed: true, add: () => ({}), title: (it) => `${it.day || "Day"} · ${it.closed ? "closed" : [it.open && it.close ? `${it.open}–${it.close}` : "", it.open2 && it.close2 ? `${it.open2}–${it.close2}` : ""].filter(Boolean).join(", ") || "no hours yet"}`,
          item: [g2({ t: "text", path: "day", label: "Day" }, { t: "toggle", path: "closed", label: "Closed this day" }),
            { t: "when", path: "closed", not: "true", local: true, fields: [g2({ t: "text", path: "open", label: "Opens", ph: "12:00" }, { t: "text", path: "close", label: "Closes", ph: "23:00" }, { t: "text", path: "open2", label: "Opens again (optional)", ph: "19:00" }, { t: "text", path: "close2", label: "Closes", ph: "23:30" })] }] },
        { t: "note", text: "Write times as 12:00 or 7:30 pm. A closing time earlier than the opening time runs past midnight (18:00 to 01:00). Use “Opens again” for a break between lunch and dinner." }] },
      { title: "How they show", fields: [g2({ t: "text", path: "hours.title", label: "Heading" }, { t: "select", path: "hours.format", label: "Clock", options: [{ value: "12", label: "12-hour (7:30 pm)" }, { value: "24", label: "24-hour (19:30)" }] }),
        { t: "toggle", path: "hours.showStatus", label: "Show “Open now” / “Closed now”" },
        g3({ t: "text", path: "hours.openLabel", label: "Words when open" }, { t: "text", path: "hours.closedLabel", label: "Words when closed" }, { t: "text", path: "hours.utcOffset", label: "Time zone (from UTC)", ph: "+05:30", hint: "India is +05:30. It makes “Open now” right for visitors anywhere." }),
        { t: "text", path: "hours.note", label: "Note under the hours", ph: "Kitchen closes 30 minutes before closing time." }] },
    ],
  },
  {
    id: "contact", label: "Address & contact", group: "Pages", desc: "Where you are, how to reach you and the map. The booking form is under Forms & records.",
    cards: [
      head("contact"),
      { title: "Details", fields: [{ t: "textarea", path: "contact.address", label: "Address", rows: 2 },
        g2({ t: "text", path: "contact.phone", label: "Phone", check: "phone" }, { t: "text", path: "contact.email", label: "Email", check: "email" }, { t: "text", path: "contact.whatsapp", label: "WhatsApp number (optional)", check: "phone" }, { t: "text", path: "contact.parking", label: "Parking (optional)", ph: "Valet parking in the evening" })] },
      { title: "Map", fields: [{ t: "toggle", path: "contact.mapEmbed", label: "Show a map of the address" },
        { t: "text", path: "contact.mapUrl", label: "Your Google Maps link (optional)", check: "https", hint: "Used by Get directions. Without it, directions search for the address above." },
        { t: "note", text: "The map loads only when a visitor presses “Show the map”, so nothing is sent to Google before that." }] },
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
  emailsCategory(true),
  featuresCategory(),
  consentCategory(),
  festivalCategory(),
  i18nCategory(),
  (() => { const s = seoCategory(true); s.cards.splice(2, 0, { title: "For search engines: about the restaurant", fields: [g2({ t: "text", path: "seo.cuisine", label: "Cuisine", ph: "Indian, North Indian" }, { t: "text", path: "seo.priceRange", label: "Price range", ph: "₹₹" }),
    { t: "note", text: "Together with your name, address, phone and opening hours, these are written into the home page in the form search engines read for restaurants, which can add your hours and rating to search results." }] }); return s; })(),
  adminCategory(),
];

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
  for (const k of c.food.categories) { k.items = (Array.isArray(k.items) ? k.items : []).filter((d: any) => d && typeof d === "object"); for (const d of k.items) { if (!Array.isArray(d.variants)) d.variants = []; d.spice = String(Math.max(0, Math.min(3, +d.spice || 0))); } }
  c.hours = { title: "Opening hours", format: "12", utcOffset: "+05:30", showStatus: true, note: "", openLabel: "Open now", closedLabel: "Closed now", ...(c.hours && typeof c.hours === "object" ? c.hours : {}) };
  const have: any[] = Array.isArray(c.hours.days) ? c.hours.days.filter((d: any) => d && typeof d === "object") : [];
  c.hours.days = DAYS.map((day, i) => ({ day, closed: false, open: "", close: "", open2: "", close2: "", ...(have[i] || {}) }));
  for (const k of ["highlights", "specials", "offers", "gallery", "chef", "events", "press", "testimonials", "order", "reserve", "faq", "about", "cta", "footer"]) c[k] = c[k] && typeof c[k] === "object" ? c[k] : {};
  for (const [k, list] of [["highlights", "items"], ["specials", "items"], ["offers", "items"], ["gallery", "items"], ["chef", "members"], ["events", "items"], ["press", "logos"], ["testimonials", "items"], ["order", "links"], ["faq", "items"], ["about", "facts"]] as const) if (!Array.isArray(c[k][list])) c[k][list] = [];
  c.contact ||= {}; c.contact.form = c.contact.form && typeof c.contact.form === "object" ? c.contact.form : { enabled: true };
  { const F = c.contact.form; if (F.saveTo !== "file") F.saveTo = "auto"; if (F.notifyAsk !== 1) { F.notify = true; F.notifyAsk = 1; } else F.notify = F.notify === true; F.notifyTo ??= ""; F.notifySubject ??= "";
    for (const k of ["slots", "occasions", "types"]) if (!Array.isArray(F[k])) F[k] = []; }
  if (typeof c.contact.mapEmbed !== "boolean") c.contact.mapEmbed = true;
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
    if (!(c?.hours?.days || []).some((d: any) => d && (d.closed || (d.open && d.close)))) w.push("The opening hours are empty. Fill them in under Opening hours.");
    if (F.enabled && F.saveTo !== "file" && !K.email) w.push("The booking form has no email to fall back on. Add one under Address & contact.");
    if (F.enabled && (F.sbUrl || F.sbKey) && !(F.sbUrl && F.sbKey && F.site)) w.push("The booking form's Supabase settings are incomplete (Project URL, public key and Site ID are all needed).");
    if (c?.events?.button && c?.events?.type && F.askType !== false && !(F.types || []).includes(c.events.type)) w.push(`The events button picks “${c.events.type}” in the booking form, but that isn't one of the form's choices.`);
    if (/copper pot/i.test(JSON.stringify(c?.brand || {}))) w.push("The restaurant name is still the sample (Copper Pot Kitchen).");
    return w;
  },
};
