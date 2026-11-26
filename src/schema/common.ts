import { FESTIVALS, FESTIVAL_DECOS, festivalWhen } from "../lib/festivals";
// Settings both templates share: where the site's own CMS lives.
import { SOCIAL_KINDS, SOCIAL_GRAPHICS, socialDefault, socialKind, mergeSocial, type SocialItem } from "../lib/social";
import type { Card, Category, Field } from "./types";
import { fontLinkLine } from "../lib/fontlink";

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
export function emailsCategory(form: boolean, orders = false): Category {
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
          { t: "note", text: "Sent to you for each enquiry when “Email me each enquiry” is on (Enquiry form). The visitor's answers are listed between the opening and closing lines." },
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
      ...(orders ? [
        { title: "Order emails: what customers get", fields: [
          { t: "note", text: "Order emails use these words in curly brackets: {name} the customer, {order} the order number, {total}, {site} your shop's name, {items} the list of items, {when} the delivery or pickup time. For the shipped email also {courier} and {tracking}. Plain text; a blank line starts a new paragraph. Leave a box empty to keep the standard wording shown in grey." },
        ] as Field[] },
        { title: "Order confirmation to the customer", fields: [
          { t: "toggle", path: "emails.order.on", label: "Email the customer when they place an order (they must have given an email address)" },
          { t: "when", path: "emails.order.on", is: "true", fields: [
            { t: "text", path: "emails.order.subject", label: "Subject", ph: "Thanks for your order {order}" },
            { t: "text", path: "emails.order.heading", label: "Heading", ph: "We've got your order" },
            { t: "textarea", path: "emails.order.message", label: "Message", rows: 6, hint: "Standard: Hi {name}, / Thanks for your order {order} from {site}. We've received it and will get it ready soon. / Order total: {total}" },
            { t: "toggle", path: "emails.order.items", def: true, label: "List the items they ordered" },
            { t: "text", path: "emails.order.itemsLabel", label: "Heading above the items", ph: "Your order" },
            { t: "textarea", path: "emails.order.footer", label: "Closing line", rows: 2, hint: "Standard: Questions? Just reply to this email." },
          ] },
        ] as Field[] },
        { title: "New-order email to you", fields: [
          { t: "note", text: "Sent to you for each order (see Enquiry form / Send orders to for the address). The order's details are listed between the opening and closing lines." },
          { t: "text", path: "emails.orderOwner.subject", label: "Subject", ph: "New order {order} ({total}) from {name}" },
          { t: "textarea", path: "emails.orderOwner.intro", label: "Opening line", rows: 2, hint: "Standard: New order {order} on the {site} website." },
          { t: "textarea", path: "emails.orderOwner.footer", label: "Closing line", rows: 2, hint: "Standard: It is also saved under Purchased orders in the site's admin page." },
        ] as Field[] },
        { title: "Shipped email", fields: [
          { t: "note", text: "Sent when you mark an order as shipped with a tracking number. Switch it off per shop in the order's courier box." },
          { t: "text", path: "emails.shipped.subject", label: "Subject", ph: "Your order {order} has shipped" },
          { t: "text", path: "emails.shipped.heading", label: "Heading", ph: "Your order is on its way" },
          { t: "textarea", path: "emails.shipped.message", label: "Message", rows: 4, hint: "Standard: Hi {name}, your order {order} from {site} has shipped with {courier}. / Tracking number: {tracking}" },
          g2({ t: "text", path: "emails.shipped.button", label: "Button text", ph: "Track your parcel" }, { t: "text", path: "emails.shipped.footer", label: "Closing line", ph: "Thank you for shopping with us." }),
        ] as Field[] },
        ...([["ready", "Order ready", "is ready"], ["out", "Out for delivery", "is out for delivery"], ["done", "Order complete", "is complete"], ["cancelled", "Order cancelled", "was cancelled"]] as const).map(([k, label, was]) => ({ title: label + " email", fields: [
          { t: "toggle", path: `emails.status.${k}.on`, label: `Email the customer when an order is marked “${k === "ready" ? "Ready" : k === "out" ? "Out for delivery" : k === "done" ? "Done" : "Cancelled"}”` },
          { t: "when", path: `emails.status.${k}.on`, is: "true", fields: [
            { t: "text", path: `emails.status.${k}.subject`, label: "Subject", ph: `Your order {order} ${was}` },
            { t: "text", path: `emails.status.${k}.heading`, label: "Heading", ph: label },
            { t: "textarea", path: `emails.status.${k}.message`, label: "Message", rows: 3, hint: `Standard: Hi {name}, your order {order} from {site} ${was}.` },
            { t: "textarea", path: `emails.status.${k}.footer`, label: "Closing line", rows: 2 },
          ] },
        ] as Field[] })),
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
/** The logo's size and shape in the menu, and the logo above the hero's title: shared by the three templates.
 *  path: the logo picture's own field ("brand.logo", or "brand.icon" in the portfolio). */
export function logoFields(path: string, def: number, title = "the hero title"): Field[] {
  void path;
  return [
      { t: "grid", cols: 2, fields: [
        { t: "select", path: "brand.logoFit", label: "Logo shape in the menu", options: [{ value: "square", label: "Square icon (cropped to a square)" }, { value: "wide", label: "Wide logo (keeps its own shape, never cropped)" }] },
        { t: "range", path: "brand.logoSize", label: "Logo height in the menu", min: 20, max: 96, step: 2, unit: "px" }] },
      { t: "note", text: `Choose Wide for a logo that is longer than it is tall (a wordmark, or an icon with the name beside it): it keeps its proportions and its corners. The height applies to both shapes; ${def}px is the usual size.` },
      { t: "grid", cols: 2, fields: [
        { t: "select", path: "brand.logoAnim", label: "Logo motion", options: [{ value: "", label: "None (still)" }, { value: "float", label: "Float (up and down)" }, { value: "pulse", label: "Pulse (breathes)" }, { value: "spin", label: "Spin (slow turn)" }, { value: "swing", label: "Swing (like a sign)" }, { value: "bounce", label: "Bounce" }, { value: "flip", label: "Flip (turns over)" }, { value: "jelly", label: "Jelly (squash and stretch)" }, { value: "glow", label: "Glow (in your accent colour)" }, { value: "shine", label: "Shine (a flash of light)" }, { value: "heartbeat", label: "Heartbeat" }, { value: "wobble", label: "Wobble" }, { value: "tada", label: "Ta-da (shake and grow)" }, { value: "rubber", label: "Rubber band" }, { value: "tilt", label: "Tilt (sways in 3D)" }, { value: "drop", label: "Drop in and land" }, { value: "pop", label: "Pop in" }, { value: "neon", label: "Neon flicker" }, { value: "hue", label: "Colour cycle" }, { value: "glitch", label: "Glitch" }] },
        { t: "when", path: "brand.logoAnim", not: "", fields: [{ t: "select", path: "brand.logoAnimOn", label: "When it moves", options: [{ value: "", label: "All the time" }, { value: "load", label: "When the page opens (twice, then still)" }, { value: "hover", label: "When pointed at" }] }] }] },
      { t: "when", path: "brand.logoAnim", not: "", fields: [{ t: "select", path: "brand.logoAnimSpeed", label: "Logo motion speed", options: [{ value: "slow", label: "Slow" }, { value: "", label: "Calm" }, { value: "lively", label: "Lively" }] },
        { t: "note", text: "Moves the logo you uploaded, in the menu and above the hero. It needs no video and stays still for visitors who ask their device for less motion. For a logo that is itself an animation, upload it below instead." }] },
      { t: "videoFile", path: "brand.logoVideo", label: "Animated logo (optional)", hint: "A short MP4 or WebM of the logo, up to 20 MB. It plays silently on a loop in the logo's place, in the menu and on the hero, with the same shape and height. The logo picture is kept as its cover and for the browser tab." },
      { t: "toggle", path: "brand.logoOnHero", label: `Show the logo above ${title}` },
      { t: "when", path: "brand.logoOnHero", is: "true", fields: [{ t: "range", path: "brand.heroLogoSize", label: "Its height there", min: 32, max: 240, step: 4, unit: "px" }] },
  ];
}
/** Older content gets the logo's size settings (the template's usual size, square, not on the hero). */
export function prepareLogo(c: any) {
  const B = c?.brand; if (!B || typeof B !== "object") return;
  const def = B.logoText !== undefined ? 30 : Array.isArray(c.products) ? 38 : 36;
  if (B.logoFit !== "wide") B.logoFit = "square";
  if (!(+B.logoSize >= 16)) B.logoSize = def;
  if (typeof B.logoOnHero !== "boolean") B.logoOnHero = false;
  if (!(+B.heroLogoSize >= 32)) B.heroLogoSize = 72;
  if (B.logoVideo === undefined) B.logoVideo = null;
  if (B.logoText === undefined && typeof B.showName !== "boolean") B.showName = true;
}
/** Older content gets the footer's social links (off), seeded once from the links the site already has elsewhere. */
export function prepareSocial(c: any) {
  if (!c || typeof c !== "object") return;
  const d = socialDefault(), first = !c.social || typeof c.social !== "object", v = first ? {} : c.social;
  c.social = { ...d, ...v, items: (Array.isArray(v.items) ? v.items : []).filter((x: any) => x && typeof x === "object").map((x: any) => ({ kind: SOCIAL_KINDS[x.kind] ? x.kind : "other", url: String(x.url || ""), label: String(x.label || ""), graphic: SOCIAL_GRAPHICS.some(([g]) => g === x.graphic) ? x.graphic : "auto", icon: x.icon || null })) };
  if (!first) return;
  const K = c.contact || {}, found: SocialItem[] = [];
  const add = (url: any) => { const u = String(url || "").trim(), kind = u ? socialKind(u) : ""; if (kind && kind !== "website" && kind !== "email" && kind !== "phone") found.push({ kind, url: u, label: "" }); };
  add(K.linkedin); add(K.instagram); add(K.facebook);
  if (String(K.whatsapp || "").replace(/\D/g, "").length >= 10) found.push({ kind: "whatsapp", url: "https://wa.me/" + String(K.whatsapp).replace(/\D/g, ""), label: "" });
  for (const l of Array.isArray(K.links) ? K.links : []) add(l?.url);
  mergeSocial(c, found.filter((f) => !/^https:\/\/(www\.)?(linkedin\.com|github\.com)\/?$/.test(f.url)));
  c.social.on = false; // seeded, not switched on: the owner decides
}
/** Footer → social links, for every template. */
export function socialCategory(group = "Pages", sub?: string, extra = ""): Category {
  const g2 = (...fields: Field[]): Field => ({ t: "grid", cols: 2, fields });
  return {
    id: "social", label: "Social links", group, ...(sub ? { sub } : {}),
    desc: "Links to your social media and other profiles, in the site's footer: as round badges, as labels, or both.",
    cards: [
      { title: "Social links in the footer", fields: [
        { t: "toggle", path: "social.on", label: "Show social links in the footer" },
        g2({ t: "select", path: "social.style", label: "Shown as", options: [{ value: "badges", label: "Badges" }, { value: "labels", label: "Labels (text)" }, { value: "both", label: "Badge and label" }] },
          { t: "select", path: "social.align", label: "Position", options: [{ value: "center", label: "Centre" }, { value: "left", label: "Left" }, { value: "right", label: "Right" }] }),
        { t: "text", path: "social.title", label: "Small heading before the links", ph: "Follow us" },
        ...(extra ? [{ t: "note", text: extra } as Field] : []),
        { t: "when", path: "social.style", not: "labels", fields: [
          g2({ t: "select", path: "social.graphics", label: "Badge graphic", options: [{ value: "icons", label: "Drawings (camera, play button, speech bubble…)" }, { value: "initials", label: "Initials (IG, FB, YT…)" }] },
            { t: "select", path: "social.shape", label: "Badge shape", options: [{ value: "circle", label: "Circle" }, { value: "rounded", label: "Rounded square" }, { value: "square", label: "Square" }] }),
          g2({ t: "select", path: "social.fill", label: "Badge look", options: [{ value: "outline", label: "Outline" }, { value: "solid", label: "Solid, in the theme's accent colour" }, { value: "soft", label: "Soft tint of the accent colour" }, { value: "plain", label: "Graphic only, no badge" }] },
            { t: "select", path: "social.size", label: "Size", options: [{ value: "s", label: "Small" }, { value: "m", label: "Medium" }, { value: "l", label: "Large" }] }),
          { t: "note", text: "The badges take their colours from the site's theme, so they fit whichever theme you choose. Each link below can pick its own graphic. The drawings are generic pictures, not the networks' logos (those are their trademarks, so the site doesn't draw them): to show a logo, upload it as that link's own icon." },
        ] },
      ] },
      { title: "The links", fields: [
        { t: "note", text: "Paste the profile's full address, or just the handle or number (@yourname, a WhatsApp number). Links found in a profile, CV or pamphlet you upload are filled in here for you; change or remove any of them." },
        { t: "list", path: "social.items", label: "Links", max: 16, add: () => ({ kind: "instagram", url: "", label: "", graphic: "auto", icon: null }), title: (it: any, i: number) => `${SOCIAL_KINDS[it?.kind]?.[0] || "Link"}${it?.label ? " · " + it.label : ""}${it?.url ? "" : " · no link yet"}` || `Link ${i + 1}`,
          item: [g2({ t: "select", path: "kind", label: "Network", options: Object.entries(SOCIAL_KINDS).map(([value, [label]]) => ({ value, label })) }, { t: "text", path: "url", label: "Profile link, handle or number", ph: "https://…  or  @yourname" }),
            g2({ t: "text", path: "label", label: "Label (optional)", ph: "Shown as text, and read out for badges" }, { t: "select", path: "graphic", label: "Badge graphic", options: SOCIAL_GRAPHICS.map(([value, label]) => ({ value, label })) }),
            { t: "image", path: "icon", label: "Your own icon (optional)", hint: "A small square picture, shown in place of the graphic: for example the network's official logo." }] },
      ] },
    ],
  };
}
/** The settings a new social photo wall starts with (content.wall; drawn by src/fx/wall.js). */
export const wallDefault = () => ({ on: false, network: "instagram", handle: "", url: "", eyebrow: "", title: "", text: "", button: "", layout: "auto", cols: "", shape: "", captions: "hover", place: "bottom", auto: "", board: "", count: 12, items: [] as { image: any; url: string; caption: string }[] });
/** Older content gets the social wall's fields (off). */
export function prepareWall(c: any) {
  if (!c || typeof c !== "object") return;
  const d = wallDefault(), w = c.wall && typeof c.wall === "object" ? c.wall : {};
  c.wall = { ...d, ...w, items: Array.isArray(w.items) ? w.items.filter((x: any) => x && typeof x === "object") : [] };
}
/** The social photo wall, for every template: Instagram, Pinterest or another network's photos on the home page, with a follow button. */
/** `ownSwitch`: the template has no Sections & order list (the shop), so the switch and the place on the page are set on this screen.
 *  Everywhere else the wall is a row in that list: switched on, named and moved there like any section. */
export function wallCategory(group = "Pages", sub?: string, extra = "", ownSwitch = false): Category {
  const g2 = (...fields: Field[]): Field => ({ t: "grid", cols: 2, fields });
  return {
    id: "wall", label: "Social photo wall", group, ...(sub ? { sub } : {}),
    desc: "A wall of your Instagram, Pinterest or other social media photos on the home page, with a button to follow you. It takes its look from the site's theme.",
    cards: [
      { title: "The wall", fields: [
        ownSwitch ? { t: "toggle", path: "wall.on", label: "Show the social photo wall" } : { t: "note", text: "The wall is one of your sections: switch it on and move it up or down under Sections & order, in the row “Social wall”. It shows once it has at least one photo." },
        g2({ t: "select", path: "wall.network", label: "Network", options: [{ value: "instagram", label: "Instagram" }, { value: "pinterest", label: "Pinterest" }, { value: "facebook", label: "Facebook" }, { value: "tiktok", label: "TikTok" }, { value: "youtube", label: "YouTube" }, { value: "x", label: "X" }, { value: "behance", label: "Behance" }, { value: "dribbble", label: "Dribbble" }, { value: "other", label: "Another one" }] },
          { t: "text", path: "wall.handle", label: "Your handle", ph: "@yourname", hint: "Used for the follow button, and for the photos when the wall fills itself from Instagram." }),
        { t: "text", path: "wall.url", label: "Profile or board address (optional)", ph: "https://www.pinterest.com/yourname/your-board/", hint: "Only needed when the handle alone doesn't lead to the right page: a Pinterest board, or another network." },
        ...(extra ? [{ t: "note", text: extra } as Field] : []),
      ] },
      { title: "Fill it by itself", fields: [
        { t: "select", path: "wall.auto", label: "Where the photos come from", options: [{ value: "", label: "I add them myself (below)" }, { value: "instagram", label: "My newest Instagram posts, by themselves" }, { value: "pinterest", label: "The newest pins of a Pinterest profile or board, by themselves" }] },
        { t: "when", path: "wall.auto", is: "instagram", fields: [{ t: "note", text: "Write your Instagram handle above (Your handle). When the Studio has its Instagram token, that is all it takes: the wall shows that account's newest posts. The account has to be public and a Business or Creator account (free to switch in the Instagram app). The token is set once for every site in the Studio's own settings (Settings → General → Instagram photos); there is nothing to set up on the site." }] },
        { t: "when", path: "wall.auto", is: "pinterest", fields: [{ t: "text", path: "wall.board", label: "Pinterest profile or board", ph: "yourname/your-board  or  https://www.pinterest.com/yourname/your-board/", hint: "A public profile or board. No key is needed; a secret board has no feed." }] },
        { t: "when", path: "wall.auto", not: "", fields: [
          { t: "range", path: "wall.count", label: "How many photos", min: 3, max: 24, step: 1 },
          { t: "note", text: "The site's own database fetches the photos (twice an hour at most), so this needs the site to be published with a Cloudflare database (Host to External Services). A site hosted on GitHub Pages alone, or a moment when the network doesn't answer, shows the photos added by hand below instead. A new post appears within half an hour." }] },
      ] },
      { title: "Photos added by hand", fields: [
        { t: "note", text: "These show when the wall isn't filling itself, and whenever the network doesn't answer. Uploading your best photos also keeps the wall fast." },
      ] },
      { title: "Heading and button", fields: [
        g2({ t: "text", path: "wall.eyebrow", label: "Small line above the heading", ph: "On Instagram" }, { t: "text", path: "wall.title", label: "Heading", ph: "Follow along" }),
        { t: "textarea", path: "wall.text", label: "Text under the heading (optional)" },
        { t: "text", path: "wall.button", label: "Follow button", ph: "Follow @yourname", hint: "Empty uses “Follow @yourhandle”. The button shows when a handle or a profile address is given." },
      ] },
      { title: "Layout", fields: [
        g2({ t: "select", path: "wall.layout", label: "Layout", options: [{ value: "auto", label: "Automatic (to suit your theme)" }, { value: "grid", label: "Even grid" }, { value: "masonry", label: "Masonry (photos keep their own height)" }, { value: "mosaic", label: "Mosaic (some photos larger)" }, { value: "strip", label: "One row that scrolls sideways" }, { value: "flush", label: "Edge to edge, no gaps" }] },
          ...(ownSwitch ? [{ t: "select", path: "wall.place", label: "Where on the home page", options: [{ value: "top", label: "After the first screen" }, { value: "middle", label: "In the middle of the page" }, { value: "bottom", label: "Before the last section" }, { value: "end", label: "At the end of the page" }] } as Field] : [])),
        g2({ t: "select", path: "wall.cols", label: "Photos in a row", options: [{ value: "", label: "Automatic" }, { value: "3", label: "3" }, { value: "4", label: "4" }, { value: "5", label: "5" }, { value: "6", label: "6" }] },
          { t: "select", path: "wall.shape", label: "Photo shape", options: [{ value: "", label: "Square" }, { value: "portrait", label: "Upright (4:5)" }, { value: "landscape", label: "Wide (4:3)" }] }),
        { t: "select", path: "wall.captions", label: "Captions", options: [{ value: "hover", label: "Over the photo, when pointed at" }, { value: "below", label: "Under the photo" }, { value: "none", label: "No captions" }] },
        { t: "note", text: "Automatic picks the wall that goes with your theme: its card look decides between an even grid, masonry, a mosaic, a scrolling row or an edge-to-edge wall. The photos' corners, borders, shadows, colours and fonts always follow the theme. On a phone the wall shows two photos in a row." },
      ] },
      { title: "The photos", fields: [
        { t: "note", text: "Upload a photo and paste the link of its post, so a tap opens it on the network. Or paste only an Instagram post or reel link, or a Pinterest pin link: it is shown as that post, loaded from the network when the visitor presses it. Up to 24." },
        { t: "list", path: "wall.items", label: "Photos", max: 24, add: () => ({ image: null, url: "", caption: "" }), title: (it: any, i: number) => `${it?.caption || `Photo ${i + 1}`}${it?.image ? "" : it?.url ? " · post link only" : " · no photo yet"}`,
          item: [{ t: "image", path: "image", label: "Photo" }, g2({ t: "text", path: "url", label: "Link of the post (optional)", ph: "https://www.instagram.com/p/…" }, { t: "text", path: "caption", label: "Caption (optional)" })] },
      ] },
    ],
  };
}
/** The settings a new video section starts with (content.video; drawn by src/fx/video.js). */
export const videoDefault = () => ({ on: false, url: "", file: null as any, poster: null as any, layout: "center", place: "top", ratio: "16:9", eyebrow: "", title: "", text: "", links: [] as { label: string; url: string }[], auto: false, controls: true, round: true });
/** Older content gets the video section's fields (off). */
export function prepareVideo(c: any) {
  if (!c || typeof c !== "object") return;
  const d = videoDefault(), v = c.video && typeof c.video === "object" ? c.video : {};
  c.video = { ...d, ...v, links: Array.isArray(v.links) ? v.links.filter((l: any) => l && typeof l === "object") : [] };
}
/** The video section, for every template: one video on the home page, with its position, width and the text beside it. */
export function videoCategory(group = "Pages", sub?: string, extra = ""): Category {
  const g2 = (...fields: Field[]): Field => ({ t: "grid", cols: 2, fields });
  return {
    id: "video", label: "Video", group, ...(sub ? { sub } : {}),
    desc: "A video on the home page: centred, wide, edge to edge, or on the left or right with a heading, a description and buttons beside it.",
    cards: [
      { title: "The video", fields: [
        { t: "toggle", path: "video.on", label: "Show the video section" },
        { t: "text", path: "video.url", label: "Video link", ph: "https://youtu.be/…  or  https://…/film.mp4", hint: "A YouTube or Vimeo link, or the address of a video file (.mp4 or .webm).",
          show: (v) => { const u = String(v || "").trim(); return !u ? "" : /youtube\.com|youtu\.be/i.test(u) ? "A YouTube video. It loads when the visitor presses play." : /vimeo\.com/i.test(u) ? "A Vimeo video. It loads when the visitor presses play." : /^https:\/\//i.test(u) || !/^[a-z][a-z0-9+.-]*:/i.test(u) ? "A video file, played by the site's own player." : "Use a link that starts with https://"; } },
        { t: "videoFile", path: "video.file", label: "Or upload a video", hint: "MP4 or WebM, up to 20 MB. An uploaded video is used instead of the link above, and is played by the site's own player. For a longer film, put it on YouTube or Vimeo and paste its link." },
        { t: "image", path: "video.poster", label: "Cover picture", hint: "Shown before the video plays. Without one, a YouTube or Vimeo video shows a dark panel with a play button." },
        ...(extra ? [{ t: "note", text: extra } as Field] : []),
      ] },
      { title: "Position and size", fields: [
        g2({ t: "select", path: "video.layout", label: "Layout", options: [{ value: "center", label: "Centre" }, { value: "wide", label: "Wide" }, { value: "full", label: "Full bleed (edge to edge)" }, { value: "left", label: "Video on the left, text on the right" }, { value: "right", label: "Video on the right, text on the left" }] },
          { t: "select", path: "video.place", label: "Where on the home page", options: [{ value: "top", label: "After the first screen" }, { value: "middle", label: "In the middle of the page" }, { value: "bottom", label: "Before the last section" }, { value: "end", label: "At the end of the page" }] },
          { t: "select", path: "video.ratio", label: "Shape", options: [{ value: "16:9", label: "Widescreen (16:9)" }, { value: "4:3", label: "Classic (4:3)" }, { value: "1:1", label: "Square" }, { value: "9:16", label: "Upright, for phone videos (9:16)" }] },
          { t: "toggle", path: "video.round", label: "Rounded corners" }),
        g2({ t: "toggle", path: "video.auto", label: "Play by itself, silently, on a loop" }, { t: "toggle", path: "video.controls", label: "Show the player's controls" }),
        { t: "note", text: "Playing by itself and hiding the controls apply to a video file. A YouTube or Vimeo video always starts when the visitor presses play, and uses its own controls." },
      ] },
      { title: "Text and buttons", fields: [
        { t: "when", path: "video.layout", is: "full", fields: [{ t: "note", text: "Full bleed shows the video alone. Choose another layout to show a heading, a description and buttons with it." }] },
        { t: "when", path: "video.layout", not: "full", fields: [
          { t: "note", text: "With the video on the left or right, this text sits beside it. With Centre or Wide it sits above the video. Leave it all empty to show the video alone." },
          { t: "text", path: "video.eyebrow", label: "Small label above" },
          { t: "text", path: "video.title", label: "Title" },
          { t: "textarea", path: "video.text", label: "Description", rows: 4 },
          { t: "list", path: "video.links", label: "Buttons", max: 3, add: () => ({ label: "", url: "" }), title: (it: any, i: number) => it?.label || `Button ${i + 1}`, item: [g2({ t: "text", path: "label", label: "Label" }, { t: "text", path: "url", label: "Link", ph: "https://…  or  contact.html" })] },
        ] },
      ] },
    ],
  };
}
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
/** Settings → Cookie consent: the banner that asks visitors before analytics, marketing and other optional code
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
    id: "consent", label: "Cookie consent", group: "Settings",
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

// ---------------------------------------------------------------- regional languages (all templates)
/** code → [name in its own script, English name] (the same list assets/lang.js offers). */
export const LANG_NAMES: Record<string, [string, string]> = { hi: ["हिन्दी", "Hindi"], mr: ["मराठी", "Marathi"], gu: ["ગુજરાતી", "Gujarati"], pa: ["ਪੰਜਾਬੀ", "Punjabi"], bn: ["বাংলা", "Bengali"], as: ["অসমীয়া", "Assamese"], or: ["ଓଡ଼ିଆ", "Odia"],
  ta: ["தமிழ்", "Tamil"], te: ["తెలుగు", "Telugu"], kn: ["ಕನ್ನಡ", "Kannada"], ml: ["മലയാളം", "Malayalam"], en: ["English", "English"] };
/** Brand & theme → Custom fonts: the owner's own font for each font setting, from an uploaded file or a link. */
/** The upload box, the link box and (for a stylesheet link) the name box of one custom font. */
export const customFontFields = (k: string, label: string): Field[] => [
  { t: "grid", cols: 2, fields: [
    { t: "fontFile", path: `theme.customFonts.${k}.file`, label: `${label}: upload a file` },
    { t: "text", path: `theme.customFonts.${k}.link`, label: `${label}: or paste a link`, ph: "https://fonts.google.com/specimen/Lobster", show: fontLinkLine }] },
  { t: "when", path: `theme.customFonts.${k}.link`, not: "", fields: [{ t: "text", path: `theme.customFonts.${k}.name`, label: `${label}: the font's name in that stylesheet`, hint: "Only for a stylesheet that isn't Google Fonts, for example “brandon-grotesque” from Adobe Fonts.", ph: "brandon-grotesque" }] },
];
export function customFontsCard(more: Field[] = []): Category["cards"][number] {
  return { title: "Custom fonts", fields: [
    { t: "note", text: "Use your own font in place of one chosen above: upload the font file, or paste a link. A link can be a font file (ending in .woff2, .woff, .ttf or .otf), a font's page or embed link on Google Fonts, or another font stylesheet such as Adobe Fonts. An uploaded file is used before a link. Remove both to go back to the font chosen above. Only use fonts you have the licence for." },
    ...customFontFields("display", "Headings font"), ...customFontFields("body", "Body font"), ...more,
  ] };
}
const NOT_TEXT = /(^|\.)(url|link|href|email|phone|whatsapp|tel|slug|id|code|gstin|pincode|pincodes|domain|handle|username|key|token|vpa|upi|map|embed|video|file|path|src|sku|hsn|currency|page|cat|ph|notifyTo|fileUrl|sbUrl|sbKey|site|workerUrl|policyUrl|reopenLabel|preview|font\w*|preset)$/i;
const NOT_TEXT_END = /(Url|Link|Href|Email|Phone|Id|Slug|Code|Color|Colour|Font|Icon|Key|Token|Handle)$/;
const NOT_TREE = /^(theme|cms|i18n|backend|payments|emails|addons|festival\.custom|shipping\.zones|gst)(\.|$)/;
/** Where a template's own text sits, as path patterns ("services.items.*.title"), read from its editor schema. */
export function textPaths(schema: Category[]): string[] {
  const out = new Set<string>();
  const walk = (fields: Field[], pre: string) => {
    for (const f of fields) {
      if (f.t === "grid" || f.t === "when") { walk(f.fields, pre); continue; }
      if (f.t === "list") { walk(f.item, pre + f.path + ".*."); continue; }
      if (f.t === "strings") { const p = pre + f.path; if (!f.number && !NOT_TEXT.test(p) && !NOT_TEXT_END.test(p) && !NOT_TREE.test(p)) out.add(p + ".*"); continue; }
      if (f.t !== "text" && f.t !== "textarea") continue;
      const p = pre + f.path; if ((f.t === "text" && f.check) || NOT_TEXT.test(p) || NOT_TEXT_END.test(p) || NOT_TREE.test(p)) continue;
      out.add(p);
    }
  };
  for (const c of schema) for (const card of c.cards) walk(card.fields, "");
  return [...out];
}
/** Every text of the site, in page order, without repeats (what Languages translates). */
export function siteTexts(c: any): string[] {
  const out: string[] = [], seen = new Set<string>();
  const take = (v: unknown) => { if (typeof v !== "string") return; const t = v.replace(/\s+/g, " ").trim(); if (t.length < 2 || !/\p{L}/u.test(t) || /^(https?:\/\/|mailto:|tel:)\S+$|^[\w.+-]+@[\w-]+\.[\w.-]+$|^#[0-9a-f]{3,8}$/i.test(t) || seen.has(t)) return; seen.add(t); out.push(v); };
  for (const p of (c?.i18n?.paths as string[]) || []) {
    const walk = (o: any, parts: string[]) => {
      if (o == null) return; const [k, ...rest] = parts;
      if (k === "*") { if (Array.isArray(o)) o.forEach((x) => (rest.length ? walk(x, rest) : take(x))); return; }
      if (typeof o !== "object") return;
      if (!rest.length) take(o[k]); else walk(o[k], rest);
    };
    walk(c, p.split("."));
  }
  return out;
}
export const i18nDefault = () => ({ on: false, base: { code: "en", name: "English" }, langs: Object.entries(LANG_NAMES).filter(([k]) => k !== "en").map(([code, [name]]) => ({ code, name, on: false })),
  t: {} as Record<string, Record<string, string>>, paths: [] as string[], ui: [] as string[], auto: true, place: "menu", preview: "" });
/** Older content gets the language fields (off); the list of text places is refreshed from the template's schema. */
export function prepareI18n(c: any, schema: () => Category[]) {
  if (!c || typeof c !== "object") return;
  const d = i18nDefault(), n = c.i18n && typeof c.i18n === "object" ? c.i18n : {};
  const have: any[] = Array.isArray(n.langs) ? n.langs.filter((x: any) => x && typeof x === "object" && LANG_NAMES[x.code]) : [];
  const base = n.base && LANG_NAMES[n.base.code] ? { code: n.base.code, name: String(n.base.name || LANG_NAMES[n.base.code][0]) } : d.base;
  c.i18n = { ...d, ...n, base, t: n.t && typeof n.t === "object" ? n.t : {}, ui: Array.isArray(n.ui) ? n.ui : [], paths: textPaths(schema()),
    langs: Object.entries(LANG_NAMES).filter(([k]) => k !== base.code).map(([code, [name]]) => { const h = have.find((x) => x.code === code); return { code, name: String(h?.name || name), on: h?.on === true, ...(typeof h?.ready === "boolean" ? { ready: h.ready } : {}) }; }) };
}
/** Settings → Languages: other languages for the site, a switcher for visitors, and the translations. */
export function i18nCategory(group = "Settings"): Category {
  const g2 = (...fields: Field[]): Field => ({ t: "grid", cols: 2, fields });
  return {
    id: "languages", label: "Languages", group,
    desc: "Offer the site in Hindi, Marathi, Tamil and other languages. Visitors switch with one tap; every translation is made in one click and stays editable.",
    cards: [
      { title: "Languages on this site", fields: [
        { t: "toggle", path: "i18n.on", label: "Offer the site in more than one language" },
        { t: "when", path: "i18n.on", is: "true", fields: [
          g2({ t: "select", path: "i18n.base.code", label: "The site is written in", options: Object.entries(LANG_NAMES).map(([value, [n, e]]) => ({ value, label: n === e ? e : `${e} (${n})` })) },
            { t: "text", path: "i18n.base.name", label: "Its name in the switcher", ph: "English" }),
          { t: "select", path: "i18n.engine", label: "Translate with", options: [{ value: "", label: "Picaffectz engine", studio: true }, { value: "cloudflare", label: "Cloudflare AI: best quality, a free daily allowance" }, { value: "system", label: "Picaffectz system: on this device, no allowance" }, { value: "custom", label: "Custom engine", studio: true, siteIf: "customEngine" }] },
          { t: "note", text: "The Picaffectz system uses the Studio's phrase book for the words every site shares, and this browser's own translator for the rest (Chrome or Edge on a computer; Hindi, Marathi, Bengali, Tamil, Telugu and Kannada). What it can't do stays under “Not translated” for you to type in. If Cloudflare's allowance runs out part-way, it carries on by itself." },
          { t: "note", text: "Switch on each language you want. It is translated straight away, with a progress bar under Translations below, and appears in the site's switcher once its translation is complete." },
          { t: "list", path: "i18n.langs", fixed: true, add: () => ({}), title: (it) => `${LANG_NAMES[it?.code]?.[1] || it?.code} · ${it?.name || ""}${it?.on ? (it?.ready === false ? " · on · being translated, not shown to visitors yet" : " · on") : ""}`,
            item: [g2({ t: "toggle", path: "on", label: "Offer this language" }, { t: "text", path: "name", label: "Name in the switcher" })] },
          g2({ t: "select", path: "i18n.place", label: "Language switcher", options: [{ value: "menu", label: "In the menu" }, { value: "right", label: "Floating, bottom right" }, { value: "left", label: "Floating, bottom left" }] },
            { t: "toggle", path: "i18n.auto", label: "First visit: use the visitor's own language when the site has it" }),
          { t: "note", text: "The visitor's choice is remembered in their browser. A link ending in ?lang=hi (the language's two-letter code) opens that language directly, for sharing or ads." },
        ] },
      ] },
      { title: "Translations", fields: [
        { t: "when", path: "i18n.on", is: "true", fields: [
          { t: "note", text: "One click translates everything that has no translation yet, including the page's own buttons and labels. New text you add later shows as “Not translated” here. Translations follow the text itself, so reordering sections or products never loses them; changing a text means translating that one again." },
          { t: "translations" },
        ] },
        { t: "when", path: "i18n.on", not: "true", fields: [{ t: "note", text: "Switch languages on above to translate the site." }] },
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
            { t: "note", text: "This only matters while the consent banner is on (Settings → Cookie consent): the code then waits until the visitor allows that category." },
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

/** A section's own look (content.sectionBg[key]): a background (a colour, a picture or GIF, or a video) and its own font,
 *  text colour and text style, with a switch. Drawn by fx.js, whatever the theme. */
import { ANIM_BGS, ANIM_SPEEDS, BG_PATTERNS } from "./animbg";
export { ANIM_BGS, ANIM_BG_FIELDS, BG_PATTERNS } from "./animbg";
export function sectionBgCard(key: string, title = "Background & text of this section", fonts: string[] = []): Card {
  const p = `sectionBg.${key}.`;
  return { title, fields: [
    { t: "toggle", path: p + "on", label: "Give this section its own background and text" },
    { t: "when", path: p + "on", is: "true", fields: [
      { t: "grid", cols: 2, fields: [{ t: "select", path: p + "kind", label: "Background", options: [{ value: "", label: "A colour" }, { value: "image", label: "A picture or GIF" }, { value: "slides", label: "A slideshow of pictures" }, { value: "video", label: "A video" }, { value: "anim", label: "An animated background" }, { value: "pattern", label: "A pattern" }, { value: "none", label: "Keep the theme's background" }] }, { t: "when", path: p + "kind", not: "none", fields: [{ t: "color", path: p + "color", label: "Colour" }] }] },
      { t: "when", path: p + "kind", is: "anim", fields: [{ t: "grid", cols: 2, fields: [{ t: "select", path: p + "anim", label: "Animated background", options: [{ value: "", label: "Choose one" }, ...ANIM_BGS.map(([value, label]) => ({ value, label }))] }, { t: "select", path: p + "animSpeed", label: "Speed", options: ANIM_SPEEDS }] },
        { t: "range", path: p + "animStrength", label: "Strength", min: 20, max: 100, step: 5, unit: "%" },
        { t: "note", text: "Drawn in the theme's colours over the colour above (leave the colour empty to keep the section's own). It stays still for visitors who ask their device for less motion." }] },
      { t: "when", path: p + "kind", is: "pattern", fields: [{ t: "select", path: p + "pattern", label: "Pattern", options: [{ value: "", label: "Choose one" }, ...BG_PATTERNS.map(([value, label]) => ({ value, label }))] }] },
      { t: "when", path: p + "kind", is: "image", fields: [{ t: "image", path: p + "image", label: "Picture or GIF", hint: "JPG, PNG, WebP or an animated GIF. It fills the section and is cropped to fit. The colour shows while it loads." }] },
      { t: "when", path: p + "kind", is: "video", fields: [
        { t: "text", path: p + "videoUrl", label: "Video link", ph: "https://youtu.be/…  or  https://vimeo.com/…  or  https://…/film.mp4", hint: "A YouTube or Vimeo link, or the address of a video file. Used when no video is uploaded below." },
        { t: "videoFile", path: p + "video", label: "Or upload a video", hint: "MP4 or WebM, up to 20 MB. An uploaded video is used instead of the link above." },
        { t: "image", path: p + "image", label: "Picture shown until the video plays (optional)" },
        { t: "grid", cols: 2, fields: [{ t: "toggle", path: p + "videoOnce", label: "Play once (do not loop)" }, { t: "toggle", path: p + "videoControls", label: "Show pause and sound buttons" }] },
        { t: "note", text: "It starts by itself, without sound (browsers only allow that), and loops unless you turn that off. With the buttons on, visitors can pause it and turn the sound on. YouTube and Vimeo cover the section like a picture and are not clickable." }] },
      { t: "when", path: p + "kind", is: "slides", fields: [{ t: "images", path: p + "slides", label: "Pictures of the slideshow", hint: "Two or more pictures. They follow each other by themselves in a soft fade, on a loop, with no arrows, dots or pause button." },
        { t: "grid", cols: 2, fields: [{ t: "range", path: p + "slideSecs", label: "Seconds per picture", min: 2, max: 12, step: 1, unit: "s" }, { t: "select", path: p + "slideFx", label: "Change of picture", options: [{ value: "", label: "Fade" }, { value: "zoom", label: "Fade with a slow zoom" }, { value: "slide", label: "Slide sideways" }] }] }] },
      { t: "grid", cols: 2, fields: [{ t: "range", path: p + "blur", label: "Blur the picture or video", min: 0, max: 30, step: 1, unit: "px" }, { t: "select", path: p + "shade", label: "Backdrop over it", options: [{ value: "", label: "Automatic (as much as the text needs)" }, { value: "dark", label: "Dark backdrop" }, { value: "light", label: "Light backdrop" }] }] },
      { t: "grid", cols: 2, fields: [{ t: "range", path: p + "dim", label: "Strength of the backdrop", min: 0, max: 90, step: 5, unit: "%" }, { t: "select", path: p + "text", label: "Text colour", options: [{ value: "", label: "Automatic (light or dark, to suit the background)" }, { value: "light", label: "Light text (for a dark background)" }, { value: "dark", label: "Dark text (for a light background)" }, { value: "custom", label: "A colour I choose" }] }] },
      { t: "when", path: p + "text", is: "custom", fields: [{ t: "color", path: p + "textColor", label: "Colour of the text" }] },
      { t: "grid", cols: 2, fields: [{ t: "select", path: p + "font", label: "Font", options: [{ value: "", label: "The theme's fonts" }, ...fonts.map((f) => ({ value: f, label: f }))] }, { t: "select", path: p + "fontFor", label: "Use the font for", options: [{ value: "", label: "All the text here" }, { value: "head", label: "The headings only" }] }] },
      { t: "select", path: p + "fontStyle", label: "Text style", options: [{ value: "", label: "The theme's own" }, { value: "bold", label: "Bold" }, { value: "light", label: "Light" }, { value: "italic", label: "Italic" }, { value: "bolditalic", label: "Bold italic" }, { value: "upper", label: "CAPITALS" }, { value: "spaced", label: "Spaced out letters" }] },
    ] },
  ] };
}
/** A section's alignment (content.sectionBg[key].align): its heading and text outside the cards; it works by itself,
 *  whether or not the section has a background of its own. */
export function sectionAlignCard(key: string, title = "Alignment of this section"): Card {
  return { title, fields: [
    { t: "select", path: `sectionBg.${key}.align`, label: "Alignment", options: [{ value: "", label: "The theme's own" }, { value: "left", label: "Left" }, { value: "center", label: "Centre" }, { value: "right", label: "Right" }] },
    { t: "note", text: "Moves the section's heading, its opening text and its buttons. What is inside the cards, lists and forms of the section keeps the theme's alignment." },
  ] };
}
/** Adds the background card to every section's category (those under "Sections"), and to the ones named in `more`:
 *  category id → [section key, card title][]. */
export function withSectionBg(schema: Category[], more: Record<string, [string, string?][]> = {}, fonts: string[] = []): Category[] {
  const list = [...new Set(fonts)].sort((a, b) => a.localeCompare(b));
  for (const c of schema) {
    if (more[c.id]) for (const [key, title] of more[c.id]) c.cards.push(sectionAlignCard(key, title ? title.replace(/^Background & text/, "Alignment") : undefined), sectionBgCard(key, title, list));
    else if (c.sub === "Sections") c.cards.push(sectionAlignCard(c.id), sectionBgCard(c.id, undefined, list));
  }
  return schema;
}

/** Code Update: the site's own copy of the template's code (content.code = { on, html, css, js }). While it is on the
 *  site runs this copy in place of the template's code (SiteCode in assets/fx.js) and the theme cannot be changed.
 *  Studio only unless allowed for the site (content.cms.allow has "code"). */
export function codeCategory(): Category {
  return {
    id: "code", label: "Code Update", group: "Code", siteIf: "code", desc: "A copy of this site's whole template code (HTML, CSS, JavaScript) that you can edit and run in place of the template.",
    cards: [{ title: "Code Update", fields: [{ t: "codeTemplate" }] }],
  };
}

/** Points for returning customers (content.loyalty): earned on every order kept in the site's database; a restaurant's
 *  guest with a verified mobile number can spend them at checkout. */
/** Customer accounts: sign in before checkout with a code, then "My account" with orders and points. */
export function accountCard(kind: "restaurant" | "store"): Card {
  const who = kind === "restaurant" ? "guest" : "shopper";
  return { title: "Customer accounts", fields: [
    { t: "toggle", path: "account.on", label: `Ask every ${who} to sign in (or sign up) before checkout` },
    { t: "when", path: "account.on", is: "true", fields: [
      { t: "select", path: "account.by", label: "They sign in with", options: [{ value: "phone", label: "Mobile number (a code on WhatsApp or by SMS)" }, { value: "email", label: "Email address (a code by email)" }, { value: "either", label: "Either: the customer chooses" }] },
      ...(kind === "restaurant" ? [{ t: "toggle", path: "account.inNav", label: "Show “My account” in the site's menu", def: true } as Field, { t: "text", path: "account.label", label: "Its name in the menu", placeholder: "My account" } as Field] : []),
      { t: "note", text: `Where customers sign in: ${kind === "restaurant" ? "the “My account” link in the site's menu, the same button on the Order now page, and the checkout itself" : "the “Sign in” link in the site's header on every page, and the checkout itself"}. To link straight to it (from a message, a QR code or a button), add #account to the end of ${kind === "restaurant" ? "the Order now page's address, for example yoursite.com/order.html#account" : "any page's address, for example yoursite.com/index.html#account"}.` },
      { t: "note", text: `Signing in and signing up are one step: the ${who} enters their mobile number or email address, gets a one-time code and types it in. There is no password. At checkout they are then asked for their name${kind === "restaurant" ? ", address (for delivery)" : ", address"} and the other contact (the email if they signed in by mobile, the mobile if by email); “A ${who} must give” above decides whether that one is required. They stay signed in on that device for 30 days, and “My account” (${kind === "restaurant" ? "on the Order now page" : "in the site's header"}) shows their orders and points. This works on a site hosted on Cloudflare. A mobile sign-in needs WhatsApp or SMS set up with a code template; an email sign-in is sent by the site database's own email. Where no code can be sent at all, checkout carries on without an account so nobody is locked out.` }] }] };
}
/** Theme & layout → Account customization: how the sign-in step, "My account" and the checkout look. They always take
 *  the theme's own accent colour, corners, fonts and dark mode; these choices shape the rest. */
/** Invoice and bill look and wording (content.invoice): used by the GST invoice (shop) and the bill in “My account” (shop and restaurant). */
const g2 = (...f: Field[]): Field => ({ t: "grid", cols: 2, fields: f });
const g3 = (...f: Field[]): Field => ({ t: "grid", cols: 3, fields: f });
export const GST_STATES = ["Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"];
/** The GST invoice section: the GST details, then the invoice's style, layout and wording (shared by the shop and the restaurant). */
export function gstCategory(kind: "restaurant" | "store"): Category {
  const rest = kind === "restaurant";
  return {
    id: "gst", label: "GST invoices", group: "Selling", ...(rest ? { sub: "Online ordering" } : {}), desc: `A tax invoice for every order, with your GSTIN, ${rest ? "the SAC/HSN code" : "HSN codes"} and the CGST/SGST or IGST split, that ${rest ? "guests" : "customers"} and you can print or save as PDF. Its style, layout and wording are set here too.`,
    cards: [
      { title: "GST invoice", fields: [
        { t: "toggle", path: "gst.on", label: "Offer a GST invoice on every order" },
        { t: "when", path: "gst.on", is: "true", fields: [
          g2({ t: "text", path: "gst.legalName", label: "Legal name of the business", ph: "as on the GST certificate" }, { t: "text", path: "gst.gstin", label: "GSTIN", ph: "27ABCDE1234F1Z5" }),
          { t: "textarea", path: "gst.address", label: "Registered address", rows: 2 },
          g3({ t: "select", path: "gst.state", label: "State", options: [{ value: "", label: "Choose the state" }, ...GST_STATES.map((n) => ({ value: n, label: n }))] }, { t: "text", path: "gst.pan", label: "PAN (optional)" }, { t: "text", path: "gst.prefix", label: "Invoice number starts with", ph: "INV-" }),
          g3({ t: "select", path: "gst.defaultRate", label: "Usual GST rate", options: ["0", "0.25", "3", "5", "12", "18", "28"].map((v) => ({ value: v, label: v + "%" })) }, { t: "text", path: "gst.defaultHsn", label: "Usual HSN code" }, { t: "toggle", path: "gst.askGstin", label: rest ? "Ask business guests for their GSTIN at checkout" : "Ask business buyers for their GSTIN at checkout" }),
          g2({ t: "text", path: "gst.sign", label: "Signature line", ph: "Authorised signatory" }, { t: "text", path: "gst.notes", label: "Note at the bottom (optional)", ph: "Goods once sold are not returnable." }),
          { t: "note", text: rest ? "Prices on your menu are read as including GST at the usual rate, so the invoice total always equals what the guest paid; if the Order now page adds a tax percentage on top (Online ordering → Tax, not included), that percentage is used instead (delivery is not taxed then). Restaurant service is usually SAC 9963 at 5%; ask your accountant which applies to you. Tips are not part of the invoice. With “Ask business guests for their GSTIN” on, a guest's GSTIN is printed on the invoice and its first two digits decide CGST+SGST (same state) or IGST (another state); it also reaches you with the order. The invoice opens from the order-done page (Download GST invoice) and “My account” (Bill) for orders placed after this update." : "Each product can have its own HSN code and rate (Products → open a product). Prices are read as including GST, so the invoice total always equals what the customer paid; if the shop adds one tax percentage on top (Prices & tax → Tax, not included), that percentage is used instead. Buyers in your state get CGST + SGST, others IGST. The invoice number is your prefix plus the order number." },
          { t: "note", text: "This prepares the invoice; it doesn't file anything with the GST portal. Have your accountant check the rates, HSN codes and number series before you rely on it.", tone: "warn" },
        ] },
      ] },
      ...invoiceLookCard(kind),
    ],
  };
}
export function invoiceLookCard(kind: "restaurant" | "store" = "store"): Card[] {
  const o = (pairs: [string, string][]) => pairs.map(([value, label]) => ({ value, label }));
  const t = (path: string, label: string, ph: string): Field => ({ t: "text", path: "invoice." + path, label, ph });
  const store = kind === "store";
  const look: Card = { title: "Invoice style & layout", fields: [
    ...(store ? [{ t: "previewPages", text: "Show the invoice in the live preview (a sample order; it updates as you change the settings below):", pages: [{ file: "checkout.html?preview=invoice", label: "Invoice" }] } as Field] : [{ t: "previewPages", text: "Show the invoice in the live preview (a sample order; it updates as you change the settings below). The same look is used for the bill in “My account”:", pages: [{ file: "order.html?preview=invoice", label: "Invoice" }] } as Field]),
    { t: "select", path: "invoice.theme", label: "Ready-made style", options: o([["", "None: choose layout, colour and font yourself"], ["corporate", "Corporate: blue, colour header band"], ["ink", "Ink: classic black and white"], ["sunset", "Sunset: bold orange"], ["emerald", "Emerald: minimal, green"], ["royal", "Royal: purple, serif"], ["boutique", "Boutique: minimal, berry, serif"], ["receipt", "Receipt: boxed grid, monospace"]]) },
    { t: "grid", cols: 2, fields: [
      { t: "select", path: "invoice.layout", label: "Layout", options: o([["", "The style's own (Classic if no style)"], ["classic", "Classic: ruled header, plain table"], ["modern", "Modern: colour header band, soft table"], ["minimal", "Minimal: light, airy, hairlines"], ["bold", "Bold: big title, dark table head, colour total"], ["ledger", "Ledger: boxed grid, compact (traditional tax invoice)"]]) },
      { t: "select", path: "invoice.font", label: "Font", options: o([["", "The style's own (sans-serif if no style)"], ["sans", "Clean sans-serif"], ["serif", "Serif (formal)"], ["mono", "Monospace (receipt)"]]) },
      { t: "color", path: "invoice.accent", label: "Accent colour (header, headings, total)" },
      { t: "select", path: "invoice.paper", label: "Paper size when printed", options: o([["", "A4"], ["letter", "Letter"], ["a5", "A5 (half page)"]]) },
    ] },
    { t: "toggle", path: "invoice.logo", label: store ? "Show the shop's logo at the top" : "Show the restaurant's logo at the top" },
    { t: "grid", cols: 3, fields: [
      { t: "toggle", path: "invoice.words", def: true, label: "Amount in words" },
      { t: "toggle", path: "invoice.summary", def: true, label: "Tax summary table" },
      { t: "toggle", path: "invoice.sign", def: true, label: "Signature line" },
      { t: "toggle", path: "invoice.colHsn", def: true, label: "HSN/SAC column" },
      { t: "toggle", path: "invoice.colRate", def: true, label: "Rate column" },
      { t: "toggle", path: "invoice.colTaxable", def: true, label: "Taxable value (column and total)" },
      { t: "toggle", path: "invoice.colTax", def: true, label: "CGST / SGST / IGST (columns and totals)" },
      { t: "toggle", path: "invoice.contact", label: store ? "Shop phone, email and website in the header" : "Restaurant phone, email and website in the header" },
    ] } as Field,
  ] };
  const words: Card = { title: "Invoice contents & wording", fields: [
    { t: "note", text: "Every piece of text on the printed page. Leave a box empty to keep the standard wording shown in grey." },
    ...[
      g2c(t("title", "Document title", "Tax Invoice"), t("lblNo", "Label: invoice number", "Invoice no.")),
      g2c(t("lblDate", "Label: date", "Date"), t("lblOrder", "Label: order", "Order")),
      g2c(t("lblSupply", "Label: place of supply", "Place of supply"), t("lblBill", "Label: billed to", "Billed to")),
      g2c(t("lblContact", "Label: contact", "Contact"), t("lblItem", "Column: item", "Item")),
      g2c(t("lblHsn", "Column: HSN/SAC", "HSN/SAC"), t("lblQty", "Column: quantity", "Qty")),
      g2c(t("lblRate", "Column: rate", "Rate"), t("lblTaxable", "Column: taxable value", "Taxable value")),
      g2c(t("lblAmount", "Column: amount", "Amount"), t("lblTotal", "Label: total", "Total")),
      g2c(t("lblWords", "Label: amount in words", "Amount in words"), t("lblSummary", "Heading: tax summary", "Tax summary")),
      ({ t: "textarea", path: "invoice.bank", label: "Bank details (optional)", rows: 3, hint: "Account name, number, IFSC, UPI: shown in its own block under the totals." } as Field),
      t("lblBank", "Heading for the bank details", "Bank details"),
    ],
    ({ t: "textarea", path: "invoice.terms", label: "Terms & conditions (optional)", rows: 3, hint: "Returns, warranty, jurisdiction…" } as Field),
    t("lblTerms", "Heading for the terms", "Terms & conditions"),
    ({ t: "text", path: "invoice.thanks", label: "Thank-you line (optional)", ph: "Thank you for your business!" } as Field),
    ({ t: "text", path: "invoice.footer", label: "Closing line", ph: store ? "This is a computer-generated invoice." : "This bill is made from your order as it was placed." } as Field),
  ] };
  return [look, words];
}
const g2c = (a: Field, b: Field): Field => ({ t: "grid", cols: 2, fields: [a, b] });

export function accountLookCard(kind: "restaurant" | "store"): Card {
  const o = (pairs: [string, string][]) => pairs.map(([value, label]) => ({ value, label }));
  const S = (path: string, label: string, pairs: [string, string][]): Field => ({ t: "select", path: "account.ui." + path, label, options: o(pairs) });
  return { title: "Account customization", fields: [
    { t: "note", text: `How the sign-in step, “My account” and the checkout look. They always use this theme's accent colour, corners, fonts and dark mode; the choices below shape the rest. To see them in the preview, switch accounts on (Selling → User accounts), then tap “Sign in” ${kind === "restaurant" ? "on the Order now page" : "in the header"}: the preview signs you in with any number and any code, and shows a sample account.` },
    { t: "previewPages", text: "Show it in the live preview (with sample data; any number and any code signs in):", pages: kind === "restaurant" ? [{ file: "order.html?preview=cart", label: "Checkout" }, { file: "order.html?preview=signin", label: "Sign-in step" }, { file: "order.html?preview=account", label: "My account" }] : [{ file: "checkout.html?preview=cart", label: "Checkout" }, { file: "checkout.html?preview=signin", label: "Sign-in step" }, { file: "index.html?preview=account", label: "My account" }] },
    { t: "grid", cols: 2, fields: [
      S("panel", "“My account” opens as", [["", "A panel from the right"], ["left", "A panel from the left"], ["sheet", "A card in the middle"], ["full", "The whole screen"]]),
      S("head", "Top of “My account”", [["", "A coloured banner with a greeting"], ["plain", "Plain, no banner"]]),
      S("tone", "Buttons and highlights", [["", "The theme's accent colour"], ["ink", "The text colour (dark)"], ["soft", "A soft tint of the accent"]]),
      S("corners", "Corners", [["", "As the theme has them"], ["soft", "Soft"], ["round", "Very round"], ["sharp", "Sharp"]]),
      S("cards", "Order cards", [["", "Lifted, with a shadow"], ["outline", "Outlined"], ["filled", "Tinted"]]),
      S("tabs", "Tabs", [["", "Underlined"], ["pills", "Pills"], ["blocks", "A switch"]]),
      S("track", "Order tracking", [["", "A progress bar"], ["steps", "The steps one under another"]]),
      S("checkout", "Checkout sections", [["", "Cards"], ["steps", "Numbered steps"], ["plain", "Plain"]]),
    ] },
    { t: "grid", cols: 2, fields: [
      { t: "text", path: "account.ui.signTitle", label: "Sign-in heading", ph: "Sign in or create your account" },
      { t: "text", path: "account.ui.signText", label: "Line under it", ph: "New here? It is the same step…" }] },
    { t: "note", text: "“My account”: the words and parts. Leave a box empty to keep the standard wording shown in grey." },
    { t: "grid", cols: 3, fields: [
      { t: "text", path: "account.ui.tabNow", label: "Tab: current order", ph: "Current order" },
      { t: "text", path: "account.ui.tabOrders", label: "Tab: order history", ph: "Order history" },
      { t: "text", path: "account.ui.tabProfile", label: "Tab: profile", ph: "Profile" }] },
    { t: "grid", cols: 2, fields: [
      { t: "text", path: "account.ui.hello", label: "Greeting", ph: "Hi, {name}", hint: "{name} is the customer's first name." },
      { t: "text", path: "account.ui.welcome", label: "Greeting when we don't know the name", ph: "Welcome" },
      { t: "text", path: "account.ui.emptyNow", label: "When no order is in progress", ph: "No order in progress." },
      { t: "text", path: "account.ui.emptyOrders", label: "When there are no orders", ph: "No orders yet. They show here once you place one while signed in." }] },
    { t: "grid", cols: 3, fields: [
      S("startView", "Opens on (when nothing is in progress)", [["", "Order history"], ["profile", "Profile"]]),
      { t: "toggle", path: "account.ui.hideNow", label: "Hide the “current order” tab" },
      { t: "toggle", path: "account.ui.hidePills", label: "Hide the points and order count" }] },
    { t: "note", text: "Checkout: the section titles and two extra lines. Leave a box empty to keep the standard wording." },
    { t: "grid", cols: 2, fields: [
      { t: "text", path: "account.ui.coDetails", label: "Section: your details", ph: "Your details" },
      { t: "text", path: "account.ui.coAddress", label: "Section: delivery address", ph: "Delivery address" },
      ...(kind === "store" ? [{ t: "text", path: "account.ui.coPay", label: "Section: payment", ph: "Payment" } as Field, { t: "text", path: "account.ui.coOrder", label: "Section: order summary", ph: "Order" } as Field] : [])] },
    { t: "text", path: "account.ui.coTrust", label: "Reassurance line before the order button (optional)", ph: "Secure checkout · Easy returns · Questions? WhatsApp us" },
    ...(kind === "store" ? [
      { t: "text", path: "account.ui.coNote", label: "Note under the order button", ph: "Nothing is charged yet. You'll pay and send the order on the next screen." } as Field,
      { t: "toggle", path: "account.ui.coNoteOff", label: "Hide the note under the order button" } as Field] : []),
  ] };
}
/** Selling → User accounts: customer accounts and what goes with them, in one place. */
export function accountsCategory(kind: "restaurant" | "store"): Category {
  const who = kind === "restaurant" ? "guest" : "shopper";
  return { id: "users", label: "User accounts", group: "Selling", desc: `Customer accounts: signing in before checkout, and “My account” with orders, bills, points and a profile.`,
    cards: [
      accountCard(kind),
      { title: "What “My account” holds", fields: [{ t: "note", text: `“My account” opens as a panel at the side of the site with three parts. Current order: the order in progress with its steps (it follows the status you set under Purchased orders${kind === "restaurant" ? ", or Petpooja's" : ""}). Order history: every order placed while signed in, with pictures of what was ordered and a bill to download. Profile: the ${who}'s name, the other contact and ${kind === "store" ? "up to six saved addresses" : "their address"}, which then fill in the checkout for them. Points show at the top when points are switched on.` }] },
      { title: "What the profile asks for", fields: [
        { t: "note", text: `The Profile part of “My account” always has the ${who}'s name and mobile number or email (the one they signed in with can't be changed). Switch on what else it should ask. Everything here is optional for the ${who}.` },
        { t: "toggle", path: "account.addresses", label: `Let ${kind === "restaurant" ? "guests" : "shoppers"} keep several addresses (up to 6, each with a name such as Home or Office)`, def: kind === "store" },
        { t: "toggle", path: "account.dob", label: "Ask for the date of birth" },
        { t: "toggle", path: "account.gender", label: "Ask for the gender (female, male, other, or prefer not to say)" },
      ] },
      { title: "Verifying contacts", fields: [
        { t: "toggle", path: kind === "restaurant" ? "ordering.verifyPhone" : "checkout.verifyPhone", label: `Verify the mobile number with a code before the order is placed` },
        { t: "toggle", path: kind === "restaurant" ? "ordering.verifyEmail" : "checkout.verifyEmail", label: `Verify the email address with a code before the order is placed` },
        { t: "note", text: `These are the same two switches as under Checkout. A ${who} who is signed in has already proved the contact they signed in with, so they are not asked again for that one. Mobile codes go on WhatsApp or by SMS (set up under ${kind === "restaurant" ? "Restaurant backend" : "WhatsApp & SMS"}); email codes are sent by the site database's own email.` }] },
    ] };
}
export function loyaltyCard(kind: "restaurant" | "store"): Card {
  const g2 = (...fields: Field[]): Field => ({ t: "grid", cols: 2, fields });
  return { title: "Points for returning customers", fields: [
    { t: "toggle", path: "loyalty.on", label: "Give points on every order" },
    { t: "when", path: "loyalty.on", is: "true", fields: [
      g2({ t: "number", path: "loyalty.earn", label: "Points earned for every 100 spent", min: 0, step: 1 }, { t: "number", path: "loyalty.worth", label: "What one point is worth when spent", min: 0, step: 0.05 }),
      g2({ t: "number", path: "loyalty.min", label: "Fewest points that can be spent at once", min: 0, step: 1 }, { t: "range", path: "loyalty.maxPct", label: "Most of a bill that points can pay", min: 0, max: 100, step: 5, unit: "%" }),
      { t: "note", text: kind === "restaurant"
        ? "Points are counted on what a guest pays for the food (after any coupon), for orders placed on the Order now page of a site hosted on Cloudflare. Guests are known by their mobile number. To spend points a guest verifies their mobile number with a code at checkout, on WhatsApp or by SMS: this is offered on its own as soon as WhatsApp is connected with a code template, or SMS is set up (Restaurant backend), and no guest is made to verify unless you also switch on “Ask guests to verify their mobile number”. Without WhatsApp, points are still earned and you can see and change them under Customer Data. With Petpooja, points spent are sent as part of the order's discount so both bills match; Petpooja's own loyalty programme is separate and is not changed by these points."
        : "Points are counted on what a customer pays for the goods, for orders placed on a shop hosted on Cloudflare, and are listed with each customer under Customer Data, where you can also add or take off points. To spend points at checkout, a customer taps “Use my points”, proves their phone number with a code (on WhatsApp or by SMS) and ticks the box: this needs WhatsApp connected with a code template, or SMS set up (WhatsApp & SMS). Without either, points are still earned. Customer records and points are personal data: say so in your privacy policy (Legal & privacy writes it for you; write the page again if you made it before switching points on)." }] },
  ] };
}

/** Legal & privacy: who runs the site (content.legal), its privacy policy and terms pages, consent on forms, what
 *  waits for consent, spam protection (content.privacy) and an accessibility check. Wording is a starting point, not legal advice. */
export function legalCategory(): Category {
  const g2 = (...fields: Field[]): Field => ({ t: "grid", cols: 2, fields });
  return {
    id: "legal", label: "Legal & privacy", group: "Settings",
    desc: "Who runs this site, its privacy policy and terms, consent on forms, what waits for consent, spam protection and an accessibility check.",
    cards: [
      { title: "Business identity", fields: [
        { t: "note", text: "The business behind this site, as registered. Visitors and payment providers expect to find this on the site, and the privacy policy and terms are written from it." },
        g2({ t: "text", path: "legal.name", label: "Legal name", ph: "Acme Foods Private Limited" }, { t: "text", path: "legal.email", label: "Email for legal and privacy questions", check: "email" }),
        { t: "textarea", path: "legal.address", label: "Registered address", rows: 2 },
        g2({ t: "text", path: "legal.phone", label: "Phone", check: "phone" }, { t: "text", path: "legal.gstin", label: "GSTIN (if registered for GST)", ph: "27ABCDE1234F1Z5" }),
        g2({ t: "text", path: "legal.cin", label: "CIN or other registration number (if any)", ph: "U12345MH2020PTC123456" }, { t: "toggle", path: "legal.footer", label: "Show these details at the bottom of every page", def: true }),
      ] },
      { title: "Legal pages", fields: [{ t: "legalPages" }] },
      { title: "Consent on forms", fields: [
        { t: "toggle", path: "privacy.formConsent", label: "Ask visitors to agree before they send a form or place an order", def: true },
        { t: "when", path: "privacy.formConsent", not: "false", fields: [
          { t: "text", path: "privacy.formText", label: "Words next to the tick box", ph: "I agree to my details being used to respond to me, as described in the Privacy policy." },
          { t: "note", text: "A tick box, never ticked in advance, is added to the enquiry or booking form and to the checkout, with a link to your privacy policy. The entry is saved with the words the visitor agreed to and the time. A form that already has its own consent text keeps that text." }] },
      ] },
      { title: "Before consent", fields: [
        g2({ t: "toggle", path: "privacy.blockFonts", label: "Load Google Fonts only after consent" }, { t: "toggle", path: "privacy.blockMaps", label: "Load Google Maps only after consent or a tap" }),
        { t: "note", text: "Google Fonts and Google Maps are fetched from Google, which sees the visitor's address. With these on, the site uses the device's own fonts and shows a “Show the map” button until the visitor accepts the Preferences category in the consent banner (Settings → Cookie consent must be on). Fonts you uploaded yourself are not affected." },
      ] },
      { title: "Spam protection", fields: [
        { t: "toggle", path: "privacy.spam", label: "Protect forms from spam robots", def: true },
        { t: "note", text: "No puzzle for visitors: forms carry a hidden box only robots fill in, and an entry sent faster than a person can type is quietly dropped. Sites on a Cloudflare database are also limited to a fair number of entries per hour." },
      ] },
      { title: "Accessibility check", fields: [{ t: "a11yCheck" }] },
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
    ] }, { title: "Admin page colours", fields: [
      { t: "adminLook" },
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
  prepareAddons(c); prepareEmails(c); prepareFestival(c); prepareConsent(c); prepareVideo(c); prepareWall(c); prepareSocial(c); prepareLogo(c);
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
        { t: "list", path: P + "items", max: 10, title: (it, i) => `Slide ${i + 1}${it?.title ? ": " + String(it.title).split("\n")[0] : ""}${it?.video ? " · video" : it?.image ? "" : " (no photo)"}`, add: () => ({ image: null, video: null, position: "center", title: "", text: "" }),
          item: [{ t: "image", path: "image", label: "Photo", hint: "Wide photos (at least 1920 px across) look best." },
            { t: "videoFile", path: "video", label: "Or a video for this slide", hint: "MP4 or WebM, up to 20 MB. It plays silently on a loop while this slide shows; the photo above is shown first, while it loads. A short, wide clip works best." },
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
