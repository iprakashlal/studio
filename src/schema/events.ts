import { legalChecks } from "../lib/legal";
import type { Category, Field, TemplateDef } from "./types";
import { BODY_FONTS, DISPLAY_FONTS, FX_AXES, HERO_FX_AXIS, LOADER_ON_AXIS, LINE_BREAKS_AXIS, type Axis } from "../themes/catalog";
import { EVT_AXES as BIZ_AXES, EVT_TAGS, EVT_THEMES, EVT_TYPES, REG_KINDS, eventThemeValues } from "../themes/events";
import { INTRO_CARD, NAV_MODE_FIELD, NAV_MODE_MOB_FIELD } from "../themes/fields";
import { ANIM_BG_FIELDS, adminCategory, legalCategory, codeCategory, withSectionBg, videoCategory, wallCategory, socialCategory, logoFields, consentCategory, emailsCategory, i18nCategory, prepareI18n, featuresCategory, festivalCategory, menuCategory, menuItem, prepareMenu, staticPagesCategory, heroSlidesCard, prepareSlides, prepareMaintenance, seoCategory, customFontsCard } from "./common";

const g2 = (...fields: Field[]): Field => ({ t: "grid", cols: 2, fields });
const g3 = (...fields: Field[]): Field => ({ t: "grid", cols: 3, fields });
const sel = (a: Axis): Field => ({ t: "select", path: "theme." + a.key, label: a.label, options: a.options.map(([value, label]) => ({ value, label })) });

const SECTIONS: [string, string][] = [["hero", "Hero"], ["clients", "Sponsors"], ["about", "About"], ["services", "Highlights"], ["stats", "Numbers"], ["team", "Line-up"], ["schedule", "Schedule"], ["tickets", "Tickets"], ["gallery", "Gallery"], ["venue", "Venue"], ["work", "Past editions"], ["process", "How it works"], ["testimonials", "What people say"], ["faq", "FAQ"], ["cta", "Call to action"], ["wall", "Social wall"], ["contact", "Contact"]];
/** Sections that start hidden when a newer version adds them to an older site. */
const HIDDEN = ["work", "process"];
const TARGETS = SECTIONS.filter(([id]) => id !== "hero").map(([value, label]) => ({ value, label }));
/** Where a button can go: a section, or a link the person types. */
const GOES = [{ value: "register", label: "The registration page" }, ...TARGETS, { value: "url", label: "A custom link…" }];
const linkWhen = (path: string, label: string): Field => ({ t: "when", path, is: "url", fields: [{ t: "text", path: path + "Url", label, ph: "https://…", hint: "A full web address (a link to another site, a WhatsApp link, a PDF…)." }] });
const ICONS: [string, string][] = [["mic", "Microphone (talks)"], ["ticket", "Ticket"], ["cal", "Calendar"], ["pin", "Map pin"], ["compass", "Compass (strategy)"], ["layers", "Layers (design)"], ["code", "Code"], ["chart", "Chart (growth)"], ["shield", "Shield (security)"], ["people", "People"], ["cloud", "Cloud"], ["globe", "Globe"], ["cog", "Cog (operations)"], ["spark", "Spark (ideas)"], ["briefcase", "Briefcase"], ["scale", "Scales (legal)"], ["building", "Building"], ["heart", "Heart (care)"], ["leaf", "Leaf (sustainability)"], ["rocket", "Rocket (launch)"]];
const head = (k: string, title = "Section heading"): Card => ({ title, fields: [g2({ t: "text", path: k + ".eyebrow", label: "Small label above" }, { t: "text", path: k + ".title", label: "Heading", ml: true }), { t: "textarea", path: k + ".lede", label: "Intro line", rows: 2 }] });
type Card = Category["cards"][number];

const schema: Category[] = [
  {
    id: "look", label: "Theme & layout", group: "Design", desc: `Choose from ${EVT_THEMES.length} event themes (${EVT_TYPES.length} kinds of event, 20 each), then fine-tune the layout and style.`,
    cards: [
      { title: "Theme", fields: [{ t: "note", studio: true, text: `${EVT_THEMES.length} event themes (E-0001 to E-${String(EVT_THEMES.length).padStart(4, "0")}): 20 for every kind of event. Picking one restyles the whole site: colours, fonts, hero layout, menu, schedule, line-up, tickets, countdown and the registration page, and sets the kind of registration that suits the event (change it under Registration). Your content stays as it is, and every setting below stays editable.` }, { t: "themes" }] },
      { title: "Layout", fields: [g2(sel(BIZ_AXES.layout), sel(BIZ_AXES.heroArt), sel(BIZ_AXES.nav), NAV_MODE_FIELD, NAV_MODE_MOB_FIELD, sel(BIZ_AXES.width), sel(BIZ_AXES.bands))] },
      { title: "Style", fields: [g2(sel(BIZ_AXES.heading), sel(BIZ_AXES.shead), sel(BIZ_AXES.cards), sel(BIZ_AXES.buttons), sel(BIZ_AXES.pattern), sel(BIZ_AXES.motionStyle)),
        { t: "note", text: "“Full-width photo” needs a hero image (Hero → Image); without one the hero uses the split layout. Visitors who ask their device for reduced motion always get a still page." }, ...ANIM_BG_FIELDS] },
      { title: "Event parts", fields: [g2(sel(BIZ_AXES.dateBadge), sel(BIZ_AXES.count), sel(BIZ_AXES.sched), sel(BIZ_AXES.lineup), sel(BIZ_AXES.tix), sel(BIZ_AXES.reg))] },
      { title: "Section layouts", fields: [{ t: "note", text: "How the shared sections are laid out, and the order the page runs in. “As arranged” keeps the order you set under Sections & order." }, g2(sel(BIZ_AXES.flow), sel(BIZ_AXES.high), sel(BIZ_AXES.about), sel(BIZ_AXES.stat), sel(BIZ_AXES.quote), sel(BIZ_AXES.faq), sel(BIZ_AXES.cta))] },
      { title: "Interactions (optional)", fields: [{ t: "note", text: "Cursor, intro, heading and scroll effects. Set any of them to None for a calmer site." },
        g2({ ...sel(FX_AXES.cursor) }, sel(FX_AXES.loader), sel(FX_AXES.textfx), sel(FX_AXES.hoverfx), sel(FX_AXES.scrollfx), sel(FX_AXES.overlay)), sel(LOADER_ON_AXIS), sel(HERO_FX_AXIS), { t: "note", text: "Hero graphic effect is a slow, quiet loop on the hero's picture or graphic, drawn in your theme's accent colours. It stays still for visitors who ask their device for less motion." }] },
      { ...INTRO_CARD, fields: [{ t: "note", text: "Shown when “Intro & page transition” above is set to anything but None. Leave a colour empty to use the theme's own." }, ...INTRO_CARD.fields.slice(1)] },
    ],
  },
  {
    id: "brand", label: "Brand & theme", group: "Design", desc: "The event's name, logo, colours and fonts.",
    cards: [
      { title: "Brand", fields: [g2({ t: "text", path: "brand.name", label: "Event name" }, { t: "text", path: "brand.tagline", label: "Tagline", ml: true }),
        { t: "image", path: "brand.logo", label: "Logo icon", hint: "A square logo works best. Without one, your initials show in your primary colour. It's also the browser tab icon." },
        { t: "range", path: "theme.logoRadius", label: "Logo shape: 0 = square, 50 = circle", min: 0, max: 50, step: 1, unit: "%" },
        ...logoFields("brand.logo", 36),
        { t: "toggle", path: "brand.showName", label: "Show the event name next to the logo" }] },
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
      { title: "Pages", fields: [{ t: "toggle", path: "site.multiPage", label: "Use several pages (Home, Schedule, Line-up, About, Contact)" },
        { t: "toggle", path: "site.crumbs", label: "Show the page trail (Home / Page name) at the top of inner pages" },
        { t: "note", text: "Off: one page with every section, and the menu scrolls to them. On: Home shows the highlights, and the menu opens Schedule, Line-up, About and Contact pages. The registration page is always a page of its own." },
        { t: "when", path: "site.multiPage", is: "true", fields: [g3({ t: "text", path: "site.pageLabels.home", label: "Home page name" }, { t: "text", path: "site.pageLabels.schedule", label: "Schedule page name" }, { t: "text", path: "site.pageLabels.lineup", label: "Line-up page name" }, { t: "text", path: "site.pageLabels.about", label: "About page name" }, { t: "text", path: "site.pageLabels.contact", label: "Contact page name" })] },
        { t: "text", path: "site.pageLabels.register", label: "Registration page name" }] },
      { title: "Sections", fields: [{ t: "note", text: "Reorder with the arrows. Hidden sections stay in your content. On one page, sections with “In the menu” get a menu link." },
        { t: "list", path: "sections", fixed: true, add: () => ({}), title: (it) => `${it.label || it.id}${it.show === false ? " (hidden)" : ""}`,
          item: [g2({ t: "text", path: "label", label: "Menu name" }, { t: "toggle", path: "show", label: "Show this section" }), { t: "toggle", path: "inNav", label: "In the menu (one-page mode)" }] }] },
      { title: "Menu button", fields: [g2({ t: "text", path: "nav.cta", label: "Button label (empty hides it)" }, { t: "select", path: "nav.ctaTarget", label: "Goes to", options: GOES }), linkWhen("nav.ctaTarget", "Custom link for the menu button")] },
    ],
  },
  menuCategory({ note: "On a one-page site (“Use several pages” off), a link to a section with “Open in a new tab” switched on gives that section a page of its own, opened in the same tab like any page of a site with several pages, and the section no longer shows on the main page. Buttons that point to that section open its page too.", where: "the sections marked “In the menu” (or the site's pages when it has several)", targets: [{ value: "home", label: "Home (top of the site)" }, ...TARGETS.map((t) => ({ value: t.value, label: `Section: ${t.label}` }))] }),
  {
    id: "event", label: "Event details", group: "Event", desc: "What kind of event it is, when and where. The hero, the countdown, the venue and the registration page all use these.",
    cards: [
      { title: "The event", fields: [g2({ t: "select", path: "event.type", label: "Kind of event", options: EVT_TYPES }, { t: "select", path: "event.mode", label: "Held", options: [{ value: "inperson", label: "In person" }, { value: "online", label: "Online" }, { value: "hybrid", label: "In person and online" }] }),
        g2({ t: "text", path: "event.venue", label: "Venue name" }, { t: "text", path: "event.city", label: "City" }),
        { t: "when", path: "event.mode", not: "inperson", fields: [{ t: "text", path: "event.onlineUrl", label: "Link to join online (optional)", check: "https", hint: "Kept for you; add it to the confirmation or the schedule when you want people to see it." }] }] },
      { title: "When", fields: [g2({ t: "date", path: "event.date", label: "Starts on" }, { t: "text", path: "event.time", label: "Start time", ph: "09:30", hint: "24-hour time, for example 18:00." }, { t: "date", path: "event.endDate", label: "Ends on (optional)" }, { t: "text", path: "event.endTime", label: "End time", ph: "18:00" }),
        { t: "text", path: "event.dateText", label: "Your own wording for the date (optional)", ph: "Every Saturday in March", hint: "Shown in place of the dates above. The countdown still uses “Starts on”." }] },
      { title: "Countdown", fields: [{ t: "toggle", path: "event.countdown", label: "Show a countdown in the hero", def: true }, g2({ t: "text", path: "event.countLabel", label: "Words before the countdown" }, { t: "text", path: "event.endedText", label: "Shown once the event is over" })] },
    ],
  },
  {
    id: "schedule", label: "Schedule", group: "Event", desc: "What happens when: one list per day.",
    cards: [head("schedule"), { title: "Days", fields: [{ t: "list", path: "schedule.days", max: 14, title: (it, i) => `${it.label || "Day " + (i + 1)} · ${(it.items || []).length} items`, add: () => ({ label: "New day", date: "", items: [] }),
      item: [g2({ t: "text", path: "label", label: "Name", ph: "Day 1" }, { t: "date", path: "date", label: "Date (optional)" }),
        { t: "list", path: "items", max: 80, title: (it) => `${it.time || "–"} · ${it.title || "Item"}`, add: () => ({ time: "", title: "New item", who: "", place: "", body: "", tag: "" }),
          item: [g2({ t: "text", path: "time", label: "Time", ph: "10:30" }, { t: "text", path: "title", label: "What" }), g3({ t: "text", path: "who", label: "Who (optional)" }, { t: "text", path: "place", label: "Where (optional)", ph: "Main stage" }, { t: "text", path: "tag", label: "Label (optional)", ph: "Keynote" }), { t: "textarea", path: "body", label: "Details (optional)", rows: 2 }] }] }] }],
  },
  {
    id: "team", label: "Line-up", group: "Event", desc: "The people on stage: speakers, artists, hosts, judges, chefs…",
    cards: [head("team"), { title: "People", fields: [{ t: "list", path: "team.members", max: 60, title: (it) => `${it.name}${it.role ? " · " + it.role : ""}`, add: () => ({ name: "New person", role: "", topic: "", photo: null, bio: "", linkedin: "" }),
      item: [g2({ t: "text", path: "name", label: "Name" }, { t: "text", path: "role", label: "Who they are", ph: "Founder, Vertex Labs" }), { t: "text", path: "topic", label: "What they're doing here (optional)", ph: "Keynote: Products people keep" }, { t: "image", path: "photo", label: "Photo (optional)" }, { t: "textarea", path: "bio", label: "Short bio (optional)", rows: 2 }, { t: "text", path: "linkedin", label: "Link (optional)", check: "https" }] }] }],
  },
  {
    id: "register", label: "Registration", group: "Event", desc: "The registration page: what kind it is, the tickets or categories and their prices, and what the form asks.",
    cards: [
      { title: "Registration", fields: [{ t: "toggle", path: "register.enabled", label: "Registration is open", def: true },
        { t: "select", path: "register.kind", label: "Kind of registration", options: [{ value: "auto", label: "The theme's own (suits the kind of event)" }, ...REG_KINDS.map(([value, label]) => ({ value, label }))] },
        g2({ t: "text", path: "register.title", label: "Page heading" }, { t: "date", path: "register.closes", label: "Closes after (optional)" }), { t: "textarea", path: "register.lede", label: "Intro line", rows: 2 },
        g2({ t: "text", path: "register.submit", label: "Button label (empty uses the kind's own)" }, { t: "text", path: "register.closedText", label: "Shown when registration is closed" }),
        { t: "textarea", path: "register.success", label: "Message after registering", rows: 2 }, { t: "text", path: "register.consent", label: "Consent checkbox (empty uses the site's own wording)" },
        { t: "previewPages", pages: [{ file: "register.html", label: "Registration page" }], text: "See it in the preview:" }] },
      { title: "Tickets, passes or categories", fields: [{ t: "note", text: "Used by tickets, delegate passes, team categories, stalls, race categories, seats and batches. An RSVP, a volunteer sign-up, press accreditation and a donation don't use them. Price 0 is free." },
        { t: "list", path: "register.tickets", max: 20, title: (it) => `${it.name || "Ticket"} · ${+it.price > 0 ? it.price : "Free"}${it.soldOut ? " (sold out)" : ""}${it.featured ? " ★" : ""}`, add: () => ({ name: "New ticket", price: 0, blurb: "", features: [], limit: 0, featured: false, soldOut: false }),
          item: [g2({ t: "text", path: "name", label: "Name" }, { t: "number", path: "price", label: "Price (0 = free)", min: 0, step: 1 }), { t: "text", path: "blurb", label: "One-line description" }, { t: "strings", path: "features", label: "What's included", addLabel: "Add line" },
            g3({ t: "number", path: "limit", label: "Places available (0 = no limit)", min: 0, step: 1 }, { t: "toggle", path: "featured", label: "Highlight this one" }, { t: "toggle", path: "soldOut", label: "Sold out" })] },
        { t: "note", text: "A limit is counted by the site's database: when the places are taken the ticket shows as sold out by itself (cancel a registration under Registrations & messages to give its places back). A site without a database can't count, so mark it Sold out yourself." },
        g2({ t: "number", path: "register.maxPer", label: "Most of one kind a person can book", min: 1, step: 1 }, { t: "select", path: "settings.currency", label: "Currency", options: ["INR", "USD", "EUR", "GBP", "AUD", "CAD", "SGD", "AED", "NZD", "CHF"] }),
        g2({ t: "toggle", path: "register.payLater", label: "Let people register now and pay later", def: true }, { t: "text", path: "register.payLaterLabel", label: "Words for paying later", ph: "Pay at the venue" }),
        { t: "note", text: "Switch this off to take online payment only (set it up under Online payment). With no online payment set up, people can always register and pay later." }] },
      { title: "Tickets section on the site", fields: [g2({ t: "text", path: "tickets.eyebrow", label: "Small label above" }, { t: "text", path: "tickets.title", label: "Heading", ml: true }), { t: "textarea", path: "tickets.lede", label: "Intro line", rows: 2 },
        g3({ t: "text", path: "tickets.button", label: "Button label (empty uses the kind's own)" }, { t: "text", path: "tickets.soldOut", label: "Sold-out label" }, { t: "text", path: "tickets.free", label: "Word for a free ticket" }), { t: "text", path: "tickets.note", label: "Note under the tickets" }] },
      { title: "What the form asks", fields: [{ t: "note", text: "Name and email are always asked. “The kind's own” asks what suits the kind of registration (a team entry asks for the team's name, an RSVP for the number of guests…)." },
        g3(...(([["phone", "Phone"], ["company", "Company or organisation"], ["role", "Job title"], ["city", "City"], ["guests", "Number of guests"], ["meal", "Meal preference"], ["team", "Team name"], ["size", "T-shirt size"], ["age", "Age"], ["emergency", "Emergency contact"], ["notes", "A notes box"]] as [string, string][]).map(([k, label]): Field => ({ t: "select", path: "register.ask." + k, label, options: [{ value: "auto", label: "The kind's own" }, { value: "yes", label: "Ask" }, { value: "no", label: "Don't ask" }] })))),
        g2({ t: "strings", path: "register.meals", label: "Meal choices", addLabel: "Add choice" }, { t: "strings", path: "register.sizes", label: "T-shirt sizes", addLabel: "Add size" }), { t: "strings", path: "register.amounts", label: "Donation amounts offered", addLabel: "Add amount", number: true }] },
      { title: "Your own questions", fields: [{ t: "list", path: "register.extra", max: 12, title: (it) => it.label || "Question", add: () => ({ label: "New question", type: "text", options: [], required: false }),
        item: [g2({ t: "text", path: "label", label: "Question" }, { t: "select", path: "type", label: "Answer", options: [{ value: "text", label: "One line" }, { value: "area", label: "A few lines" }, { value: "select", label: "Choose from a list" }, { value: "check", label: "A tick box" }] }),
          { t: "when", path: "type", is: "select", local: true, fields: [{ t: "strings", path: "options", label: "Choices", addLabel: "Add choice" }] }, { t: "toggle", path: "required", label: "Must be answered" }] }] },
      { title: "Where registrations go", fields: [{ t: "note", text: "Each registration is saved with the site's messages and listed under Registrations & messages in the admin page (press Registrations there for the totals and a CSV download), with its registration number, what was chosen, the total and whether it is paid. The person gets a confirmation email when email is set up on the site's database. (A site that has no database yet opens the visitor's email app instead, addressed to your contact email: give it one with Publish to Cloudflare in the Studio.)" }] },
    ],
  },
  {
    id: "payments", label: "Online payment", group: "Event", desc: "Take payment for tickets, entries, stalls and donations when people register. Each needs your own account with the payment company.",
    cards: [
      { title: "How it works", fields: [{ t: "note", text: "Switch on the ones you use and connect your keys. The registration page then offers “Pay online”; the amount is worked out by your site's database from your tickets (never by the visitor's phone), and the registration is saved as Paid only after the payment company confirms the money arrived. Needs the site's own database (Publish to Cloudflare in the Studio). The currency is set under Registration." }] },
      { title: "Razorpay", fields: [{ t: "toggle", path: "payments.razorpay.enabled", label: "Accept Razorpay (UPI, cards, netbanking)" }, { t: "connection", kind: "rz" },
        { t: "note", text: "Opens over the registration page. Prices in INR only. Try it with a rzp_test_ key first: test mode takes no real money." }, { t: "text", path: "payments.razorpay.label", label: "Label on the registration page" }] },
      { title: "Cashfree", fields: [{ t: "toggle", path: "payments.cashfree.enabled", label: "Accept Cashfree (UPI, cards, netbanking)" }, { t: "connection", kind: "cf" },
        { t: "note", text: "The visitor pays on Cashfree's page and comes back. Needs a 10-digit mobile number, so keep Phone asked on the form. Prices in INR only." }, { t: "text", path: "payments.cashfree.label", label: "Label on the registration page" }] },
      { title: "PhonePe", fields: [{ t: "toggle", path: "payments.phonepe.enabled", label: "Accept PhonePe (UPI, cards, netbanking)" }, { t: "connection", kind: "pe" },
        { t: "note", text: "The visitor pays on PhonePe's page and comes back. Prices in INR only. Use the Client ID, version and secret of PhonePe's Standard Checkout." }, { t: "text", path: "payments.phonepe.label", label: "Label on the registration page" }] },
      { title: "Stripe", fields: [{ t: "toggle", path: "payments.stripe.enabled", label: "Accept Stripe (cards from any country)" }, { t: "connection", kind: "st" },
        { t: "note", text: "The visitor pays on Stripe's page and comes back." }, { t: "text", path: "payments.stripe.label", label: "Label on the registration page" }] },
      { title: "PayPal", fields: [{ t: "toggle", path: "payments.paypal.enabled", label: "Accept PayPal" }, { t: "connection", kind: "pp" },
        { t: "note", text: "The visitor pays on PayPal's page and comes back. PayPal doesn't take INR: use it for an event priced in USD, EUR or GBP." }, { t: "text", path: "payments.paypal.label", label: "Label on the registration page" }] },
    ],
  },
  {
    id: "venue", label: "Venue", group: "Event", desc: "Where it is and how to get there.",
    cards: [head("venue"), { title: "The place", fields: [g2({ t: "text", path: "venue.name", label: "Venue name" }, { t: "text", path: "venue.mapUrl", label: "Map link (optional)", check: "https" }), { t: "textarea", path: "venue.address", label: "Address", rows: 2 }, { t: "image", path: "venue.image", label: "Photo or map picture (optional)" }] },
      { title: "Getting there", fields: [{ t: "list", path: "venue.points", max: 8, title: (it) => it.title || "Point", add: () => ({ title: "New point", body: "" }), item: [{ t: "text", path: "title", label: "Heading", ph: "By metro" }, { t: "textarea", path: "body", label: "Details", rows: 2 }] }] }],
  },
  {
    id: "gallery", label: "Gallery", group: "Event", desc: "Photos from the event or earlier editions. The section shows once there are photos.",
    cards: [head("gallery"), { title: "Photos", fields: [{ t: "images", path: "gallery.images", label: "Photos", hint: "Up to 24 are shown." }] }],
  },
  {
    id: "hero", label: "Hero", group: "Pages", sub: "Sections", desc: "The first screen: headline, intro, the date and place, buttons, the countdown and image.",
    cards: [
      { title: "Text", fields: [{ t: "text", path: "hero.eyebrow", label: "Small label above" }, { t: "text", path: "hero.title", label: "Headline", ml: true, hint: "Enter starts a new line. Wrap words in *asterisks* to highlight them." }, { t: "textarea", path: "hero.lede", label: "Intro", rows: 3 }] },
      { title: "Buttons", fields: [g2({ t: "text", path: "hero.ctaPrimary", label: "Main button" }, { t: "select", path: "hero.ctaPrimaryTarget", label: "Goes to", options: GOES }, { t: "text", path: "hero.ctaSecondary", label: "Second button" }, { t: "select", path: "hero.ctaSecondaryTarget", label: "Goes to", options: GOES }), linkWhen("hero.ctaPrimaryTarget", "Custom link for the main button"), linkWhen("hero.ctaSecondaryTarget", "Custom link for the second button")] },
      { title: "Date, place and badges", fields: [{ t: "toggle", path: "hero.showMeta", label: "Show the date and place under the intro", def: true }, { t: "note", text: "The date, the place and the countdown come from Event details." }, { t: "strings", path: "hero.badges", label: "Short points under the buttons", addLabel: "Add point" }] },
      { title: "Image", fields: [{ t: "image", path: "hero.image", label: "Hero image (optional)", hint: "A photo from the event, the venue or the artwork. Without one, the hero shows cards with the date, the first sessions and the lowest price." },
        { t: "videoFile", path: "hero.video", label: "Or a hero video", hint: "MP4 or WebM, up to 20 MB. It plays silently on a loop in the image's place; the image above is shown first, while it loads. A short clip works best." }] },
      { title: "Cards beside the headline", fields: [
        { t: "when", path: "hero.image", not: "", fields: [{ t: "note", text: "These cards show when there's no hero image. Remove the image above to use them." }] },
        { t: "toggle", path: "hero.panel.show", label: "Show the cards" }, { t: "toggle", path: "hero.panel.dot", label: "Show the round accent" }] },
      heroSlidesCard("hero", "the hero image or panel"),
    ],
  },
  {
    id: "about", label: "About", group: "Pages", sub: "Sections", desc: "What the event is about, and what it stands for.",
    cards: [
      { title: "About", fields: [g2({ t: "text", path: "about.eyebrow", label: "Small label above" }, { t: "text", path: "about.title", label: "Heading", ml: true }), { t: "textarea", path: "about.body", label: "About the event", rows: 6, hint: "Leave an empty line between paragraphs." }, { t: "image", path: "about.image", label: "Image (optional)" }] },
      { title: "Mission & vision", fields: [{ t: "textarea", path: "about.mission", label: "Mission", rows: 2 }, { t: "textarea", path: "about.vision", label: "Vision", rows: 2 }] },
      { title: "Values", fields: [{ t: "list", path: "about.values", max: 8, title: (it) => it.title || "Value", add: () => ({ title: "New value", body: "" }), item: [{ t: "text", path: "title", label: "Value" }, { t: "textarea", path: "body", label: "What it means", rows: 2 }] }] },
    ],
  },
  {
    id: "services", label: "Highlights", group: "Pages", sub: "Sections", desc: "What people can expect: the parts of the event worth calling out.",
    cards: [head("services"), { title: "Highlights", fields: [{ t: "list", path: "services.items", max: 12, title: (it) => it.title || "Highlight", add: () => ({ icon: "spark", title: "New highlight", body: "", points: [] }),
      item: [g2({ t: "text", path: "title", label: "Name" }, { t: "select", path: "icon", label: "Icon", options: ICONS.map(([value, label]) => ({ value, label })) }), { t: "textarea", path: "body", label: "Description", rows: 2 }, { t: "strings", path: "points", label: "Key points", addLabel: "Add point" }] }] }],
  },
  {
    id: "stats", label: "Numbers", group: "Pages", sub: "Sections", desc: "A row of key figures.",
    cards: [{ title: "Numbers", fields: [{ t: "list", path: "stats.items", max: 6, title: (it) => `${it.value} · ${it.label}`, add: () => ({ value: "10+", label: "New figure" }), item: [g2({ t: "text", path: "value", label: "Figure" }, { t: "text", path: "label", label: "Label" })] }] }],
  },
  {
    id: "clients", label: "Sponsors", group: "Pages", sub: "Sections", desc: "A strip of sponsor or partner names or logos.",
    cards: [{ title: "Sponsors & partners", fields: [{ t: "text", path: "clients.title", label: "Line above the logos" },
      { t: "list", path: "clients.logos", max: 16, title: (it) => it.name || "Sponsor", add: () => ({ name: "New sponsor", logo: null }), item: [{ t: "text", path: "name", label: "Name" }, { t: "image", path: "logo", label: "Logo (optional)", hint: "Transparent PNG or SVG works best. Without a logo, the name shows in your headings font." }] }] }],
  },
  {
    id: "work", label: "Past editions", group: "Pages", sub: "Sections", desc: "Earlier editions or other events you have run. Hidden until you switch it on under Sections & order.",
    cards: [head("work"), { title: "Past editions", fields: [{ t: "list", path: "work.items", max: 24, title: (it) => it.title || "Edition", add: () => ({ title: "New edition", client: "", sector: "", summary: "", result: "", image: null, url: "" }),
      item: [{ t: "text", path: "title", label: "Title" }, g2({ t: "text", path: "client", label: "Where" }, { t: "text", path: "sector", label: "When" }), { t: "textarea", path: "summary", label: "Summary", rows: 2 }, { t: "text", path: "result", label: "Result (one line)", ph: "Processing time down 46%" },
        { t: "image", path: "image", label: "Image (optional)" }, { t: "text", path: "url", label: "Link (optional)", check: "https" }] }] }],
  },
  {
    id: "process", label: "How it works", group: "Pages", sub: "Sections", desc: "The steps for people taking part. Hidden until you switch it on under Sections & order.",
    cards: [{ title: "Heading", fields: [g2({ t: "text", path: "process.eyebrow", label: "Small label above" }, { t: "text", path: "process.title", label: "Heading", ml: true })] },
      { title: "Steps", fields: [{ t: "list", path: "process.steps", max: 8, title: (it, i) => `${i + 1}. ${it.title}`, add: () => ({ title: "New step", body: "" }), item: [{ t: "text", path: "title", label: "Step" }, { t: "textarea", path: "body", label: "Description", rows: 2 }] }] }],
  },
  {
    id: "testimonials", label: "Testimonials", group: "Pages", sub: "Sections", desc: "What people said about the event.",
    cards: [{ title: "Heading", fields: [g2({ t: "text", path: "testimonials.eyebrow", label: "Small label above" }, { t: "text", path: "testimonials.title", label: "Heading", ml: true })] },
      { title: "Testimonials", fields: [{ t: "list", path: "testimonials.items", max: 12, title: (it) => it.name || "Testimonial", add: () => ({ quote: "", name: "", role: "", company: "" }),
        item: [{ t: "textarea", path: "quote", label: "Quote", rows: 3 }, g3({ t: "text", path: "name", label: "Name" }, { t: "text", path: "role", label: "Role" }, { t: "text", path: "company", label: "Company" }), { t: "select", path: "rating", label: "Stars", options: [{ value: "", label: "None" }, { value: "5", label: "★★★★★" }, { value: "4", label: "★★★★" }, { value: "3", label: "★★★" }, { value: "2", label: "★★" }, { value: "1", label: "★" }] }] }] }],
  },
  {
    id: "faq", label: "FAQ", group: "Pages", sub: "Sections", desc: "Questions people often ask.",
    cards: [{ title: "Heading", fields: [g2({ t: "text", path: "faq.eyebrow", label: "Small label above" }, { t: "text", path: "faq.title", label: "Heading", ml: true })] },
      { title: "Questions", fields: [{ t: "list", path: "faq.items", max: 20, title: (it) => it.q || "Question", add: () => ({ q: "New question", a: "" }), item: [{ t: "text", path: "q", label: "Question" }, { t: "textarea", path: "a", label: "Answer", rows: 3 }] }] }],
  },
  {
    id: "cta", label: "Call to action", group: "Pages", sub: "Sections", desc: "The dark band that asks visitors to register.",
    cards: [{ title: "Call to action", fields: [{ t: "text", path: "cta.title", label: "Heading", ml: true }, { t: "textarea", path: "cta.body", label: "Text", rows: 2 }, g2({ t: "text", path: "cta.button", label: "Button" }, { t: "select", path: "cta.target", label: "Goes to", options: GOES }), linkWhen("cta.target", "Custom link for the button")] }],
  },
  videoCategory("Pages", "Sections"),
  wallCategory("Pages", "Sections"),
  socialCategory("Pages"),
  {
    id: "contact", label: "Contact details", group: "Pages", desc: "Contact details and the contact section's heading. The enquiry form is under Forms & records.",
    cards: [
      head("contact"),
      { title: "Details", fields: [g2({ t: "text", path: "contact.email", label: "Email", check: "email" }, { t: "text", path: "contact.phone", label: "Phone", check: "phone" }), { t: "textarea", path: "contact.address", label: "Address", rows: 2 },
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
    id: "forms", label: "Message form", group: "Forms & records", desc: "The message form in the contact section: its questions, its messages and where they go.",
    cards: [
      { title: "Enquiry form", fields: [{ t: "toggle", path: "contact.form.enabled", label: "Show the enquiry form" },
        { t: "when", path: "contact.form.enabled", is: "true", fields: [
          { t: "text", path: "contact.form.title", label: "Form heading" },
          g2({ t: "toggle", path: "contact.form.askPhone", label: "Ask for a phone number" }, { t: "toggle", path: "contact.form.askCompany", label: "Ask for the company" }),
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
function prepareEvents(c: any) {
  if (!c || typeof c !== "object") return;
  c.site ||= { multiPage: false };
  c.site.pageLabels = { home: "Home", schedule: "Schedule", lineup: "Line-up", about: "About", contact: "Contact", register: "Register", ...(c.site.pageLabels && typeof c.site.pageLabels === "object" ? c.site.pageLabels : {}) };
  c.settings = { currency: "INR", ...(c.settings && typeof c.settings === "object" ? c.settings : {}) };
  c.payments = c.payments && typeof c.payments === "object" ? c.payments : {};
  for (const k of ["razorpay", "cashfree", "phonepe", "stripe", "paypal"]) c.payments[k] = { enabled: false, label: "", ...(c.payments[k] && typeof c.payments[k] === "object" ? c.payments[k] : {}) };
  c.event = { type: "Conference", date: "", time: "", endDate: "", endTime: "", dateText: "", venue: "", city: "", mode: "inperson", onlineUrl: "", countdown: true, countLabel: "Starts in", endedText: "This event has ended. Thank you for being part of it.", ...(c.event && typeof c.event === "object" ? c.event : {}) };
  c.hero ||= {}; prepareSlides(c.hero, c.theme?.deep || "#0E1B2C"); prepareMaintenance(c);
  c.hero.panel = { show: true, dot: true, ...(c.hero.panel && typeof c.hero.panel === "object" ? c.hero.panel : {}) };
  for (const k of ["clients", "services", "about", "stats", "team", "schedule", "tickets", "gallery", "venue", "work", "process", "testimonials", "faq", "cta", "footer"]) if (!c[k] || typeof c[k] !== "object") c[k] = {};
  const arr = (o: any, k: string) => { if (!Array.isArray(o[k])) o[k] = []; };
  arr(c.clients, "logos"); arr(c.services, "items"); arr(c.stats, "items"); arr(c.team, "members"); arr(c.schedule, "days"); arr(c.gallery, "images"); arr(c.venue, "points"); arr(c.work, "items"); arr(c.process, "steps"); arr(c.testimonials, "items"); arr(c.faq, "items"); arr(c.about, "values");
  for (const d of c.schedule.days) if (d && !Array.isArray(d.items)) d.items = [];
  c.tickets = { eyebrow: "Tickets", title: "Tickets", lede: "", note: "", button: "", soldOut: "Sold out", free: "Free", ...c.tickets };
  const R = (c.register = { enabled: true, kind: "auto", title: "Register", lede: "", closes: "", closedText: "Registration is closed.", maxPer: 10, payLater: true, payLaterLabel: "Pay at the venue", submit: "", success: "You're registered. We've noted your details and will be in touch with what happens next.", consent: "", ...(c.register && typeof c.register === "object" ? c.register : {}) });
  arr(R, "tickets"); arr(R, "extra"); if (!Array.isArray(R.meals)) R.meals = ["Vegetarian", "Non-vegetarian", "Vegan", "Jain"]; if (!Array.isArray(R.sizes)) R.sizes = ["XS", "S", "M", "L", "XL", "XXL"]; if (!Array.isArray(R.amounts)) R.amounts = [500, 1000, 2500, 5000];
  R.ask = { phone: "auto", company: "auto", role: "auto", city: "auto", guests: "auto", meal: "auto", team: "auto", size: "auto", age: "auto", emergency: "auto", notes: "auto", ...(R.ask && typeof R.ask === "object" ? R.ask : {}) };
  for (const x of R.extra) if (x && !Array.isArray(x.options)) x.options = [];
  prepareI18n(c, () => schema);
  prepareMenu(c, () => (Array.isArray(c.sections) ? c.sections : []).filter((x: any) => x && x.show !== false && x.inNav).map((x: any) => menuItem(x.label || x.id, x.id)));
  c.contact ||= {}; c.contact.form ||= { enabled: true };
  { const F = c.contact.form; if (F.saveTo !== "file") F.saveTo = "auto"; if (F.notifyAsk !== 1) { F.notify = true; F.notifyAsk = 1; } else F.notify = F.notify === true; F.notifyTo ??= ""; F.notifySubject ??= ""; }
  c.sections = Array.isArray(c.sections) ? c.sections : [];
  // A section added in a newer version goes in after the one before it in the default order.
  SECTIONS.forEach(([id, label], k) => {
    if (c.sections.some((s: any) => s.id === id)) return;
    const after = k ? c.sections.findIndex((s: any) => s.id === SECTIONS[k - 1][0]) : -1;
    c.sections.splice(after + 1, 0, { id, label, show: id === "wall" ? !!c.wall?.on : !HIDDEN.includes(id), inNav: ["about", "team", "schedule", "tickets", "venue", "contact"].includes(id) });
  });
}
export const eventsTemplate: TemplateDef = {
  id: "events",
  name: "Event",
  kind: "One or several pages, with registration",
  description: "A website for an event of any kind (a conference, a concert, a wedding, a marathon, a market…): the date and a countdown, schedule, line-up, tickets, venue, gallery, FAQ and a registration page whose registrations show in the admin page.",
  pages: [
    { file: "index.html", label: "Home" },
    { file: "schedule.html", label: "Schedule" },
    { file: "lineup.html", label: "Line-up" },
    { file: "about.html", label: "About" },
    { file: "contact.html", label: "Contact" },
    { file: "register.html", label: "Registration" },
  ],
  schema,
  colorKeys: [{ key: "c1", label: "Primary" }, { key: "c2", label: "Secondary" }, { key: "c3", label: "Highlight" }, { key: "text", label: "Text" }, { key: "surface", label: "Cards" }, { key: "deep", label: "Dark" }],
  themePath: "theme",
  themeValues: eventThemeValues,
  themes: EVT_THEMES,
  themeTags: EVT_TAGS,
  prepare: prepareEvents,
  summary: (c) => `${c?.event?.type || "Event"}${c?.event?.date ? " · " + c.event.date : ""} · ${(c?.register?.tickets || []).length} ticket types · ${(c?.team?.members || []).length} in the line-up`,
  checks: (c) => {
    const w: string[] = [];
    const F = c?.contact?.form || {}, R = c?.register || {};
    if (!c?.event?.date) w.push("The event has no date yet. Add one under Event details.");
    if (c?.event?.date && new Date(c.event.endDate || c.event.date).getTime() < Date.now() - 86400000) w.push("The event's date is in the past.");
    if (R.payLater === false && !["razorpay", "cashfree", "phonepe", "stripe", "paypal"].some((k) => c?.payments?.[k]?.enabled)) w.push("Registration is set to online payment only, but no way to pay online is switched on (Online payment). People can still register and pay later until one is.");
    if (R.enabled !== false && !c?.contact?.email) w.push("Registration has no email to fall back on. Add one under Contact details.");
    if (F.enabled && F.saveTo === "file" && !/^https:\/\//.test(F.fileUrl || "")) w.push("Messages are set to save as JSON files, but the inbox isn't set up. Press Enquiry inbox at the top of the project.");
    if (/^horizon summit$/i.test(String(c?.brand?.name || "").trim())) w.push("The event name is still the sample (Horizon Summit).");
    return [...w, ...legalChecks("business", c)];
  },
};
