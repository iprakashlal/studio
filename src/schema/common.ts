import { FESTIVALS, FESTIVAL_DECOS, festivalWhen } from "../lib/festivals";
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

export const emailsDefault = () => ({
  signin: { subject: "", intro: "", footer: "" },
  enquiry: { intro: "", footer: "" },
  reply: { on: false, subject: "", message: "", copy: false },
});
/** Older content gets the email templates' fields (empty: the standard wording). */
export function prepareEmails(c: any) {
  if (!c || typeof c !== "object") return;
  const d = emailsDefault(), e = c.emails && typeof c.emails === "object" ? c.emails : {};
  const obj = (x: any) => (x && typeof x === "object" && !Array.isArray(x) ? x : {});
  c.emails = { signin: { ...d.signin, ...obj(e.signin) }, enquiry: { ...d.enquiry, ...obj(e.enquiry) }, reply: { ...d.reply, ...obj(e.reply) } };
}
/** Email templates: the wording of the emails this site sends from its Cloudflare database. `form`: the template
 *  has an enquiry form (so also the enquiry email and the thank-you to the visitor). */
export function emailsCategory(form: boolean): Category {
  const g2 = (...fields: Field[]): Field => ({ t: "grid", cols: 2, fields });
  return {
    id: "emails", label: "Email templates", group: "Forms & records",
    desc: "The wording of the emails this site sends. Leave a box empty to keep the standard wording shown in grey.",
    cards: [
      { title: "How templates work", fields: [
        { t: "note", text: "Write plain text: a blank line starts a new paragraph. These words in curly brackets are filled in when the email is sent: {site} the site's name, {name} the visitor's name, {email} the visitor's email, {page} the page the form was on. The emails are sent by the site's Cloudflare database through your Resend email settings, and a change here starts once you publish." },
      ] },
      ...(form ? [
        { title: "Enquiry email to you", fields: [
          { t: "note", text: "Sent to you for each enquiry when “Also email me each enquiry” is on (Enquiry form). The visitor's answers are listed between the opening and closing lines." },
          { t: "text", path: "contact.form.notifySubject", label: "Subject", ph: "New enquiry from {name}" },
          { t: "textarea", path: "emails.enquiry.intro", label: "Opening line", rows: 2, hint: "Standard: New enquiry from the {site} website." },
          { t: "textarea", path: "emails.enquiry.footer", label: "Closing line", rows: 2, hint: "Standard: It is also saved under Enquiries in the site's admin page." },
        ] as Field[] },
        { title: "Thank-you email to the visitor", fields: [
          { t: "toggle", path: "emails.reply.on", label: "Send the visitor a thank-you email when they send the form" },
          { t: "when", path: "emails.reply.on", is: "true", fields: [
            { t: "text", path: "emails.reply.subject", label: "Subject", ph: "Thank you for contacting {site}" },
            { t: "textarea", path: "emails.reply.message", label: "Message", rows: 7, hint: "Standard: Hi {name}, / Thank you for your message. We have received it and will get back to you soon. / {site}" },
            { t: "toggle", path: "emails.reply.copy", label: "Add a copy of what they sent" },
            { t: "note", text: "It goes to the email address the visitor typed, and their reply comes to your enquiry address. One address gets at most 3 of these an hour." },
          ] },
        ] as Field[] },
      ] : []),
      { title: "Sign-in code email", fields: [
        { t: "note", text: "Sent to you and your editors when signing in to this admin page. The 6-digit code always sits between the opening and closing lines." },
        { t: "text", path: "emails.signin.subject", label: "Subject and heading", ph: "Your sign-in code" },
        g2({ t: "textarea", path: "emails.signin.intro", label: "Opening line", rows: 3, hint: "Standard: Enter this code to sign in:" },
          { t: "textarea", path: "emails.signin.footer", label: "Closing line", rows: 3, hint: "Standard: It works for 10 minutes. If you didn't ask for it, ignore this email." }),
      ] },
      { title: "If the wording doesn't change", studio: true, fields: [
        { t: "note", text: "Templates need the database updated once after 16 November 2026: Settings → Hostings → Update the database (for a site with its own database, save its Email settings in Publish to Cloudflare). Sites without the Cloudflare database don't send these emails." },
      ] },
    ],
  };
}

/** Older content gets the festival overlay's fields; one row for every festival in the list (new festivals are
 *  added, the site's own choices kept). */
export function prepareFestival(c: any) {
  if (!c || typeof c !== "object") return;
  const f = c.festival && typeof c.festival === "object" ? c.festival : {};
  const have: any[] = Array.isArray(f.items) ? f.items.filter((x: any) => x && typeof x === "object") : [];
  // One switch now (festival.on). Content from when the Studio had to offer it first keeps what it showed: a site
  // that wasn't offered it stays off until its owner switches it on.
  const on = f.v >= 2 ? f.on !== false : c.festival && typeof c.festival === "object" ? f.allowed === true && f.on !== false : true;
  c.festival = { v: 2, on, style: f.style || "both", position: f.position || "top", lead: String(f.lead ?? 2), signoff: f.signoff !== false, preview: f.preview || "",
    items: FESTIVALS.map((d) => { const x = have.find((h) => h.id === d.id) || {}; return { id: d.id, name: d.name, on: x.on !== false, from: x.from || "", to: x.to || "", message: x.message || "" }; }),
    custom: Array.isArray(f.custom) ? f.custom : [] };
}
/** Features → Festival overlay: greetings and decorations on India's festivals (assets/festival.js). It runs by
 *  itself on the official days while switched on; the owner picks festivals, dates and wording, or switches it off. */
export function festivalCategory(): Category {
  const g2 = (...fields: Field[]): Field => ({ t: "grid", cols: 2, fields });
  const byId = (id: string) => FESTIVALS.find((d) => d.id === id);
  return {
    id: "festival", label: "Festival overlay", group: "Features",
    desc: "A greeting ribbon and a short shower of decorations on India's festivals. It shows by itself on the official days; choose the festivals, change the dates or wording, or switch it off.",
    cards: [
      { title: "Festival overlay", fields: [
        { t: "toggle", path: "festival.on", label: "Show festival greetings on the site" },
        { t: "when", path: "festival.on", is: "true", fields: [
          g2({ t: "select", path: "festival.style", label: "What shows", options: [{ value: "both", label: "Greeting ribbon and falling decorations" }, { value: "ribbon", label: "Greeting ribbon only" }, { value: "deco", label: "Falling decorations only" }] },
            { t: "select", path: "festival.position", label: "Ribbon position", options: [{ value: "top", label: "Top of the page" }, { value: "bottom", label: "Bottom of the page" }] },
            { t: "select", path: "festival.lead", label: "Start showing", options: [{ value: "0", label: "On the day" }, { value: "1", label: "1 day before" }, { value: "2", label: "2 days before" }, { value: "3", label: "3 days before" }, { value: "5", label: "5 days before" }, { value: "7", label: "A week before" }] },
            { t: "toggle", path: "festival.signoff", label: "Add “from <your site's name>” to the greeting" }),
          { t: "select", path: "festival.preview", label: "Try one in the preview", options: [{ value: "", label: "None (the preview follows today's date)" }, ...FESTIVALS.map((d) => ({ value: d.id, label: d.name }))] },
          { t: "note", text: "“Try one in the preview” only changes this preview, so you can see a festival before its day; visitors always get today's festival. Visitors see the ribbon until they close it and the decorations once per visit, for about 15 seconds. Nothing shows for visitors who have asked their device for less motion. When two festivals fall together, the one ending first shows." },
        ] },
      ] },
      { title: "Festivals", fields: [
        { t: "note", text: "Every festival is on with its official days. Open one to switch it off, give it your own days, or write your own greeting. Festivals that follow the moon (Eid) can shift by a day: set the day yourself once it is announced." },
        { t: "list", path: "festival.items", fixed: true, add: () => ({}), title: (it) => { const d = byId(it?.id); return `${it?.name || d?.name || "Festival"} · ${it?.on === false ? "off" : it?.from ? `your days: ${it.from}${it.to && it.to !== it.from ? " to " + it.to : ""}` : d ? festivalWhen(d) : ""}`; },
          item: [
            { t: "toggle", path: "on", label: "Celebrate this festival on the site" },
            g2({ t: "date", path: "from", label: "Show from (optional)", hint: "Empty: the official day, with the lead days above." }, { t: "date", path: "to", label: "Show until (optional)", hint: "Empty: the same day as “from”." }),
            { t: "text", path: "message", label: "Greeting (optional)", ph: "the usual greeting, e.g. Happy Diwali", hint: "{site} adds your site's name." },
          ] },
      ] },
      { title: "Your own occasions", fields: [
        { t: "note", text: "Add days of your own: a regional festival, your anniversary, a sale. These come before the festivals above when they fall on the same day." },
        { t: "list", path: "festival.custom", max: 20, add: () => ({ name: "", deco: "confetti", from: "", to: "", message: "", on: true }), title: (it) => `${it?.name || "New occasion"}${it?.from ? ` · ${it.from}${it.to && it.to !== it.from ? " to " + it.to : ""}` : " · no date yet"}${it?.on === false ? " · off" : ""}`,
          item: [
            g2({ t: "text", path: "name", label: "Name", ph: "Pongal, Durga Puja, our 10th anniversary" }, { t: "select", path: "deco", label: "Decorations", options: FESTIVAL_DECOS }),
            g2({ t: "date", path: "from", label: "Show from" }, { t: "date", path: "to", label: "Show until (optional)" }),
            { t: "text", path: "message", label: "Greeting", ph: "Happy Pongal" }, { t: "toggle", path: "on", label: "On" },
          ] },
      ] },
    ],
  };
}

// ---------------------------------------------------------------- cookie & tracking consent (all templates)
/** The wording each banner starts with (the same text assets/consent.js falls back to). */
export const CONSENT_WORDS = {
  india: { title: "Your consent matters", text: "We use cookies and similar tools to run this website and, with your consent, to understand how it is used and to show you relevant offers. We use your personal data only for the purposes listed here, in line with India's Digital Personal Data Protection Act, 2023. You can withdraw your consent at any time from “Cookie settings”.", accept: "Accept all", decline: "Decline", manage: "Choose purposes", save: "Save my choices", extra: "To see, correct or erase your data, or to raise a grievance, contact us using the details on this site. You may also approach the Data Protection Board of India." },
  intl: { title: "We value your privacy", text: "We use cookies and similar technologies. Necessary ones make the site work. With your permission we also use them to measure visits and to personalise content and ads. You can accept all, reject the non-essential ones or choose by category, and change your mind at any time in “Cookie settings”.", accept: "Accept all", decline: "Reject non-essential", manage: "Manage preferences", save: "Save preferences", extra: "" },
};
export const CONSENT_CATS = [
  { id: "necessary", label: "Strictly necessary", text: "Needed for the site to work: your choices here, your cart and signing in. Always on." },
  { id: "analytics", label: "Analytics", text: "Help us count visits and see which pages are used, so we can improve the site." },
  { id: "marketing", label: "Marketing", text: "Used to show relevant ads and measure campaigns, on this site and others." },
  { id: "preferences", label: "Preferences", text: "Remember settings such as language or region, and run extras like chat boxes and embedded videos." },
];
export const consentDefault = () => ({
  on: false, wording: "auto", try: "", india: { ...CONSENT_WORDS.india }, intl: { ...CONSENT_WORDS.intl },
  policyLabel: "Privacy policy", policyPage: "", policyUrl: "",
  categories: CONSENT_CATS.map((c) => ({ ...c, on: true })),
  mode: "optin", showDecline: true, showManage: true, equal: true, closeX: false, lock: false,
  layout: "bar", position: "bottom", side: "left", look: "theme", months: "6", version: 1, reopen: true, footerLink: true, reopenLabel: "Cookie settings", gpc: true, gcm: false,
});
/** Older content gets the consent banner's fields (off), with both wordings filled in. */
export function prepareConsent(c: any) {
  if (!c || typeof c !== "object") return;
  const d = consentDefault(), k = c.consent && typeof c.consent === "object" ? c.consent : {};
  const obj = (x: any) => (x && typeof x === "object" && !Array.isArray(x) ? x : {});
  const have: any[] = Array.isArray(k.categories) ? k.categories.filter((x: any) => x && typeof x === "object") : [];
  c.consent = { ...d, ...k, india: { ...d.india, ...obj(k.india) }, intl: { ...d.intl, ...obj(k.intl) }, months: String(k.months ?? d.months),
    categories: d.categories.map((x) => ({ ...x, ...(have.find((h) => h.id === x.id) || {}), id: x.id, ...(x.id === "necessary" ? { on: true } : {}) })) };
}
/** Features → Cookie consent: the banner that asks visitors before analytics, marketing and other optional code
 *  runs (assets/consent.js), with one wording for visitors in India and one for everyone else. */
export function consentCategory(): Category {
  const g2 = (...fields: Field[]): Field => ({ t: "grid", cols: 2, fields });
  const words = (r: "india" | "intl"): Field[] => [
    { t: "text", path: `consent.${r}.title`, label: "Heading" },
    { t: "textarea", path: `consent.${r}.text`, label: "Message", rows: 5 },
    g2({ t: "text", path: `consent.${r}.accept`, label: "Accept button" }, { t: "text", path: `consent.${r}.decline`, label: "Decline button" },
      { t: "text", path: `consent.${r}.manage`, label: "Choose-by-category button" }, { t: "text", path: `consent.${r}.save`, label: "Save button (in the category list)" }),
    { t: "textarea", path: `consent.${r}.extra`, label: "Extra line (optional)", rows: 3, hint: r === "india" ? "For example your Grievance Officer's name and email, as the DPDP Act expects." : "For example who the data controller is and how to reach them." },
  ];
  return {
    id: "consent", label: "Cookie consent", group: "Features",
    desc: "A banner that asks visitors before analytics, marketing and other optional code runs, with Accept and Decline buttons, a choice by category, and separate wording for visitors in India and for international visitors.",
    cards: [
      { title: "Consent banner", fields: [
        { t: "toggle", path: "consent.on", label: "Ask visitors for consent" },
        { t: "when", path: "consent.on", is: "true", fields: [
          g2({ t: "select", path: "consent.wording", label: "Which wording visitors see", options: [{ value: "auto", label: "Automatic: India wording in India, international elsewhere" }, { value: "india", label: "India wording for everyone" }, { value: "intl", label: "International wording for everyone" }] },
            { t: "select", path: "consent.try", label: "Try one in the preview", options: [{ value: "", label: "Follow the choice on the left" }, { value: "india", label: "India wording" }, { value: "intl", label: "International wording" }] }),
          { t: "note", text: "Automatic goes by the visitor's device clock: Indian time gets the India wording (written for the Digital Personal Data Protection Act, 2023), everyone else the international one (written for GDPR-style rules in the EU, UK and similar). No location is looked up and nothing is sent anywhere. The preview always shows the banner; visitors see it until they choose." },
          { t: "note", text: "The banner controls three things: Custom code with a category (Features → Chat, badges & code), scripts you mark yourself, and Google's Consent Mode. The wording is a starting point, not legal advice: check it against what your site actually collects.", tone: "warn" },
        ] },
      ] },
      { title: "Wording for visitors in India", fields: words("india") },
      { title: "Wording for international visitors", fields: words("intl") },
      { title: "Privacy policy link", fields: [
        g2({ t: "text", path: "consent.policyLabel", label: "Link text", ph: "Privacy policy" }, { t: "ref", path: "consent.policyPage", label: "Opens this custom page", source: "staticPages", valueKey: "id", labelKey: "title", empty: "None" }),
        { t: "text", path: "consent.policyUrl", label: "Or a web address", ph: "https://…", hint: "Used instead of the custom page when filled in." },
        { t: "note", text: "The link follows the message in the banner. Write the policy under Pages → Custom pages. Without a page or address, no link shows." },
      ] },
      { title: "Consent categories", fields: [
        { t: "note", text: "What visitors can allow or refuse one by one. Strictly necessary is always shown and always on. Switch off a category your site doesn't use." },
        { t: "list", path: "consent.categories", fixed: true, add: () => ({}), title: (it) => `${it?.label || it?.id}${it?.id === "necessary" ? " · always on" : it?.on === false ? " · not offered" : ""}`,
          item: [
            { t: "when", local: true, path: "id", not: "necessary", fields: [{ t: "toggle", path: "on", label: "Offer this category" }] },
            { t: "text", path: "label", label: "Name" }, { t: "textarea", path: "text", label: "What it is for", rows: 2 },
          ] },
      ] },
      { title: "Buttons & behaviour", fields: [
        { t: "select", path: "consent.mode", label: "Before the visitor chooses", options: [{ value: "optin", label: "Nothing optional runs until they accept (opt-in; India, EU, UK)" }, { value: "optout", label: "Optional things run until they decline (opt-out)" }, { value: "notice", label: "Notice only: everything runs, the banner just informs" }] },
        g2({ t: "toggle", path: "consent.showDecline", label: "Show the Decline button" }, { t: "toggle", path: "consent.equal", label: "Decline looks as strong as Accept" },
          { t: "toggle", path: "consent.showManage", label: "Show the choose-by-category button" }, { t: "toggle", path: "consent.closeX", label: "Show a close (×) button; closing counts as declining" },
          { t: "toggle", path: "consent.lock", label: "Dim the page until the visitor chooses" }, { t: "toggle", path: "consent.gpc", label: "Respect the browser's “do not sell or share” signal (Global Privacy Control)" }),
        g2({ t: "select", path: "consent.months", label: "Ask again after", options: [{ value: "1", label: "1 month" }, { value: "3", label: "3 months" }, { value: "6", label: "6 months" }, { value: "12", label: "12 months" }, { value: "24", label: "24 months" }] },
          { t: "number", path: "consent.version", label: "Notice version", min: 1, step: 1, hint: "Raise it by one after changing what you collect: everyone is asked again." }),
        { t: "toggle", path: "consent.gcm", label: "Send the choice to Google tags (Consent Mode v2)" },
        { t: "note", text: "Accept allows every category, Decline only the necessary one, and the category list lets visitors pick. The choice is kept in the visitor's own browser, not on a server. When a visitor withdraws consent for something already running, the page reloads without it. Cookies a service set earlier stay until they expire or the visitor clears them." },
      ] },
      { title: "Look", fields: [
        g2({ t: "select", path: "consent.layout", label: "Shape", options: [{ value: "bar", label: "Bar across the page" }, { value: "box", label: "Box in a corner" }, { value: "center", label: "Window in the middle" }] },
          { t: "select", path: "consent.look", label: "Colours", options: [{ value: "theme", label: "The site's theme" }, { value: "dark", label: "Dark" }, { value: "light", label: "Light" }] }),
        { t: "when", path: "consent.layout", is: "bar", fields: [{ t: "select", path: "consent.position", label: "Bar position", options: [{ value: "bottom", label: "Bottom of the page" }, { value: "top", label: "Top of the page" }] }] },
        g2({ t: "select", path: "consent.side", label: "Corner (box and the Cookie settings button)", options: [{ value: "left", label: "Bottom left" }, { value: "right", label: "Bottom right" }] },
          { t: "toggle", path: "consent.reopen", label: "Keep a small “Cookie settings” button on the page" },
          { t: "toggle", path: "consent.footerLink", label: "Add a “Cookie settings” link to the footer, with the other links" }, { t: "text", path: "consent.reopenLabel", label: "Text of the button and the footer link", ph: "Cookie settings" }),
        { t: "note", text: "Visitors must be able to change their mind as easily as they agreed. The footer link and the button both open the category list; so does any link you add that goes to #cookie-settings." },
      ] },
    ],
  };
}

// ---------------------------------------------------------------- the site's own menu, with sub-menus (all templates)
export type MenuOpts = { /** Where a link can go, besides a custom page and a web address. */ targets: { value: string; label: string }[]; /** Extra per-link fields for a target, e.g. the shop category. */ extra?: Field[]; where: string; /** A caution shown under the switch. */ note?: string };
export const menuItem = (label = "New link", to = "", more: Record<string, unknown> = {}) => ({ id: "mi-" + Math.random().toString(36).slice(2, 8), label, show: true, to, page: "", cat: "", url: "", newTab: false, children: [] as any[], ...more });
/** Older content gets the menu's fields: the custom menu is off and starts as a copy of the automatic one. */
export function prepareMenu(c: any, seed: () => any[]) {
  if (!c || typeof c !== "object") return;
  const m = c.menu && typeof c.menu === "object" ? c.menu : {};
  const fix = (list: any, depth: number): any[] => (Array.isArray(list) ? list : []).filter((x) => x && typeof x === "object").map((x) => ({ ...menuItem(), ...x, children: depth < 3 ? fix(x.children, depth + 1) : [] }));
  c.menu = { custom: m.custom === true, hover: m.hover !== false, arrows: m.arrows !== false, mobileOpen: m.mobileOpen === true, items: Array.isArray(m.items) ? fix(m.items, 1) : fix(seed(), 1) };
}
/** Pages → Menu: build the site's menu yourself, with sub-menus up to three levels (assets/menu.js). */
export function menuCategory(o: MenuOpts, group = "Pages"): Category {
  const g2 = (...fields: Field[]): Field => ({ t: "grid", cols: 2, fields });
  const targets = [...o.targets, { value: "page", label: "A custom page" }, { value: "url", label: "A web address" }, { value: "none", label: "Nothing: it only opens its sub-menu" }];
  const name = (v: string) => targets.find((t) => t.value === v)?.label || "";
  const kids = (it: any) => (Array.isArray(it?.children) ? it.children.length : 0);
  const title = (it: any) => `${it?.label || "Untitled"}${it?.to && it.to !== "none" ? " → " + name(it.to) : ""}${kids(it) ? ` · ${kids(it)} under it` : ""}${it?.show === false ? " · hidden" : ""}`;
  const level = (depth: number): Field[] => [
    g2({ t: "text", path: "label", label: "Name in the menu" }, { t: "select", path: "to", label: "Goes to", options: targets }),
    ...(o.extra || []),
    { t: "when", local: true, path: "to", is: "page", fields: [{ t: "ref", path: "page", label: "Custom page", source: "staticPages", valueKey: "id", labelKey: "title", empty: "Choose a page" }] },
    { t: "when", local: true, path: "to", is: "url", fields: [{ t: "text", path: "url", label: "Web address", ph: "https://…", hint: "A full address, or a file of this site such as shop.html." }] },
    g2({ t: "toggle", path: "show", label: "Show this link" }, { t: "toggle", path: "newTab", label: "Open in a new tab" }),
    ...(depth < 3 ? [{ t: "list", path: "children", label: depth === 1 ? "Sub-menu (second level)" : "Sub-menu (third level)", max: 12, add: () => menuItem("New link", o.targets[0]?.value || "url"), title, item: level(depth + 1) } as Field] : []),
  ];
  return {
    id: "menu", label: "Menu & sub-menus", group,
    desc: "Build the menu yourself: name each link, choose where it goes, hide or show it, and nest links under it up to three levels deep.",
    cards: [
      { title: "Your own menu", fields: [
        { t: "toggle", path: "menu.custom", label: "Use my own menu instead of the automatic one" },
        { t: "note", text: `While this is off, the menu is made for you from ${o.where}. Switch it on to use the links below: they start as a copy of the automatic menu. If every link below is hidden, the automatic menu shows again.` },
        ...(o.note ? [{ t: "note", text: o.note, tone: "warn" } as Field] : []),
        { t: "when", path: "menu.custom", is: "true", fields: [
          g2({ t: "toggle", path: "menu.hover", label: "Open sub-menus when the pointer is over them" }, { t: "toggle", path: "menu.arrows", label: "Show a small arrow beside links with a sub-menu" },
            { t: "toggle", path: "menu.mobileOpen", label: "On phones, show sub-menus already open" }),
          { t: "note", text: "Sub-menus always open with a click or tap on the arrow, and with the keyboard. On phones and in side menus they fold open under their link instead of dropping down." },
        ] },
      ] },
      { title: "Menu links", fields: [
        { t: "note", text: "Open a link to rename it, point it somewhere, hide it, or add links under it. Use the arrows to reorder." },
        { t: "list", path: "menu.items", max: 14, add: () => menuItem("New link", o.targets[0]?.value || "url"), title, item: level(1) },
      ] },
    ],
  };
}

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
    id: "features", label: "Chat, badges & code", group: "Features",
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
        { t: "list", path: "addons.code", max: 12, add: () => ({ id: "cc-" + Math.random().toString(36).slice(2, 8), name: "", on: true, where: "body", pages: "all", consent: "", code: "" }), title: (it) => `${it?.name || "Custom code"}${it?.on === false ? " (off)" : ""}`,
          item: [
            g2({ t: "text", path: "name", label: "Name (for you)", ph: "Tawk.to chat box" }, { t: "toggle", path: "on", label: "On" },
              { t: "select", path: "where", label: "Where it goes", options: [{ value: "body", label: "End of the page (most widgets)" }, { value: "head", label: "The page's head (analytics, verification tags)" }] },
              { t: "select", path: "pages", label: "Pages", options: [{ value: "all", label: "Every page" }, { value: "home", label: "The home page only" }] }),
            { t: "select", path: "consent", label: "Needs the visitor's consent for", options: [{ value: "", label: "Nothing: it always runs (only for code the site can't work without)" }, { value: "analytics", label: "Analytics" }, { value: "marketing", label: "Marketing" }, { value: "preferences", label: "Preferences (chat boxes, videos, other extras)" }], },
            { t: "note", text: "This only matters while the consent banner is on (Features → Cookie consent): the code then waits until the visitor allows that category." },
            { t: "textarea", path: "code", label: "Code", rows: 6, hint: "HTML with <script>, <link>, <meta> or <style> tags, exactly as the service gives it." },
          ] },
      ] },
      { title: "“Powered by” badge", studio: true, fields: [
        { t: "toggle", path: "poweredBy.show", label: "Show the badge on this site" },
        { t: "note", text: "A small link in the bottom-right corner of every page, always on screen. Its text, link, size, colours and icon are set once for all sites in Settings → Customize → “Powered by” badge. Only the Studio can show or hide it: the site's own admin page doesn't have this setting." },
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
      { t: "note", text: "While this is on, every page of the site shows the maintenance page below, and so does this preview (its “Show the site here” button lets you keep editing). Visitors see it once you publish. This admin page keeps working. To look at the live site yourself, open it once with ?peek at the end of the address (for example yoursite/?peek). Turn the switch off and publish to bring the site back. A site last published from the Studio before 16 November 2026 needs one publish from the Studio first, to get the maintenance page's files.", tone: "warn" },
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
    { title: "Features in this site's admin page", studio: true, fields: [{ t: "adminSections" }] },
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
 *  under Settings → Customize → Additional pages; the site's own admin page shows it as its own "Static pages" section. */
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
  prepareAddons(c); prepareEmails(c); prepareFestival(c); prepareConsent(c);
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
