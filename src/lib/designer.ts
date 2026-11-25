// "Design yourself": a plain-language question flow that builds a preview website for any of the four types.
// Nothing here is published: the result is a preview (kept on this device, and in the Studio when signed in).
import { outsideLines, packSections, readSections, unpackSections, type DocSections } from "./docsections";
import { THEMES, THEME_TAGS, type Theme } from "../themes/catalog";
import { BIZ_THEMES } from "../themes/business";
import { BIZ_TYPES, BIZ_TYPE_WORDS } from "../themes/businessTypes";
import { REST_THEMES, REST_TAGS } from "../themes/restaurant";
import { TEMPLATES } from "../schema";
import { themeCode } from "../themes/codes";
import { loadStarter } from "./exporter";
import { defaultPicture, generatedPicture } from "./pictures";
import { systemWrite } from "./syswrite";
import { readDesignSettings, type Copy } from "./designs";
import { lookValues, pagesChoice, readColsAnswer } from "./designlook";
import { limitThemes } from "../themes/limit";

export type Kind = "portfolio" | "store" | "business" | "restaurant";
export type Answers = Record<string, string>;
export type Opt = { v: string; label: string; hint?: string };
export type Step = {
  id: string;
  /** What the assistant says (plain words). */
  ask: (a: Answers) => string;
  /** choice: tap one; many: tap several; text: one line; long: one item per line. */
  type: "choice" | "many" | "text" | "long" | "file";
  /** Asked only when this is true. */
  when?: (a: Answers) => boolean;
  /** file: what may be chosen and how big. */
  accept?: string; maxKB?: number;
  options?: (a: Answers) => Opt[];
  ph?: (a: Answers) => string;
  /** Can be left out (always, or only for some answers). */
  optional?: boolean | ((a: Answers) => boolean);
  /** One line shown under the question. */
  help?: (a: Answers) => string;
  /** long: asked as rows with these sub-fields (each row is one line of the answer, joined by `fmt`). */
  cols?: { label: string; ph?: string }[]; fmt?: (c: string[]) => string; addLabel?: string;
  /** Where the Studio's Settings lists it, and its short name there and in the answers. */
  group?: QGroup; label?: string;
  /** Listed in Settings but not asked yet (it needs a picture upload). */
  soon?: boolean;
};
export type QGroup = "basics" | Kind;

const k = (a: Answers) => (a.kind || "portfolio") as Kind;
const by = <T,>(a: Answers, m: Record<Kind, T>): T => m[k(a)];

/** Every theme of a type (for the "play with your design" panel). */
export const themesFor = (kind: Kind): Theme[] => offered(kind);
/** A theme of a type by its id, whether or not it is currently offered. */
export const themeOf = (kind: Kind, id: string): Theme | undefined => poolOf(kind).find((t) => t.id === id);
const LIGHT = { bg: "#FFFFFF", surface: "#F5F6F8", deep: "#ECEEF2", text: "#14161A", soft: "#5B6270", line: "#E1E4EA" };
const DARKK = { bg: "#0E1118", surface: "#161B26", deep: "#090B10", text: "#F2F4F8", soft: "#9AA3B5", line: "#262D3C" };
/** A theme with the person's own colour, light/dark and corner choices on top. */
export function tweakTheme(t: Theme, a: Answers): Theme {
  const o: Theme = { ...t, colors: { ...t.colors } };
  if (a.mode === "light" || a.mode === "dark") { Object.assign(o.colors, a.mode === "light" ? LIGHT : DARKK); o.dark = a.mode === "dark"; }
  if (/^#[0-9a-f]{6}$/i.test(a.accent || "")) { o.colors.c1 = a.accent; o.colors.c2 = a.accent; }
  if (a.corners && /^\d{1,2}$/.test(a.corners)) o.radius = +a.corners;
  const own = readColsAnswer(a.cols); // the person's own colours (the palette editor) come last
  for (const key of Object.keys(own)) (o.colors as any)[key] = own[key];
  if (own.bg && !a.mode) o.dark = (parseInt(own.bg.slice(1, 3), 16) * 299 + parseInt(own.bg.slice(3, 5), 16) * 587 + parseInt(own.bg.slice(5, 7), 16) * 114) / 1000 < 128;
  return o;
}

/** Whether a question may be skipped. */
export const isOptional = (s: Step, a: Answers) => (typeof s.optional === "function" ? s.optional(a) : !!s.optional);

export const KIND_OPTIONS: Opt[] = [
  { v: "portfolio", label: "A website about me", hint: "Show my work, skills and story. Good for designers, developers, photographers, creators." },
  { v: "store", label: "An online shop", hint: "Sell products with a cart and orders on WhatsApp or by UPI." },
  { v: "business", label: "A website for my business", hint: "Explain my services and let customers get in touch." },
  { v: "restaurant", label: "A restaurant or café site", hint: "Menu, opening hours, table booking and orders." },
];

export const STYLE_OPTIONS: Opt[] = [
  { v: "clean", label: "Minimal" },
  { v: "bold", label: "Bold" },
  { v: "elegant", label: "Elegant" },
  { v: "fun", label: "Playful" },
  { v: "corporate", label: "Corporate" },
];
/** Looks an older draft may still hold. */
const OLD_STYLES: Opt[] = [{ v: "dark", label: "Dark and modern" }, { v: "warm", label: "Warm and friendly" }];
export const COLOUR_OPTIONS: Opt[] = [
  { v: "blue", label: "Blue" }, { v: "green", label: "Green" }, { v: "red", label: "Red" }, { v: "orange", label: "Orange" },
  { v: "purple", label: "Purple" }, { v: "pink", label: "Pink" }, { v: "gold", label: "Gold" }, { v: "mono", label: "Black and white" }, { v: "any", label: "Surprise me" },
];
export const COLOUR_DOT: Record<string, string> = { blue: "#3b82f6", green: "#22a06b", red: "#e5484d", orange: "#f08a24", purple: "#8b5cf6", pink: "#ec4899", gold: "#d4a017", mono: "#222222", any: "linear-gradient(135deg,#3b82f6,#ec4899,#f08a24)" };

const YN = (): Opt[] => [{ v: "yes", label: "Yes" }, { v: "no", label: "No" }];
const doc = (a: Answers, key: keyof DocSections) => { const v: any = unpackSections(a.docsec)[key]; return !!(v && v.length); };
const P = (a: Answers) => k(a) === "portfolio", S = (a: Answers) => k(a) === "store", B = (a: Answers) => k(a) === "business", R = (a: Answers) => k(a) === "restaurant";

/** Every question, in the order they are asked. `group` is where the Studio's Settings → Design yourself → Questions lists it; `soon` ones (they need a picture upload) are listed but not asked yet. */
const RAW: Step[] = [
  { id: "kind", group: "basics", label: "Type", type: "choice", ask: () => "Hi! Let's design your website together. What kind of website do you want?", options: () => KIND_OPTIONS },
  {
    id: "doc", group: "basics", label: "Starting point", type: "file", optional: true, accept: "application/pdf", maxKB: 20480,
    ask: (a) => by(a, { portfolio: "Do you already have your details somewhere? Add your resume (PDF) or paste your LinkedIn or website link, and we'll fill in what we can.", store: "Do you already have your products somewhere? Add a catalogue or product menu (PDF) or paste your website or Instagram link, and we'll fill in what we can.", business: "Do you already have your details somewhere? Add a company profile or brochure (PDF) or paste your website link, and we'll fill in what we can.", restaurant: "Do you already have your menu or details somewhere? Add your menu or brochure (PDF) or paste your website or Instagram link, and we'll fill in what we can." }),
    ph: () => "Paste a link, e.g. https://yourname.com",
    help: () => "We only use what is written there, and we won't ask again for what we find. You can skip this.",
  },
  {
    id: "name", group: "basics", label: "Name", type: "text",
    ask: (a) => by(a, { portfolio: "What's your full name?", store: "What is your shop or brand called?", business: "What is your registered company name?", restaurant: "What is your restaurant or café called?" }),
    ph: (a) => by(a, { portfolio: "e.g. Asha Verma", store: "e.g. Kala Ghar", business: "e.g. Verma & Co", restaurant: "e.g. The Tiffin Box" }),
  },
  { id: "tagline", group: "basics", label: "Tagline", type: "text", optional: true, ask: () => "Your one-line tagline?", ph: () => "e.g. Honest work, on time", help: () => "A short line that sits under your name. Skip it and we'll write one." },
  { id: "logo", group: "basics", label: "Logo", type: "file", optional: true, when: (a) => k(a) !== "portfolio" && !!readDesignSettings().images?.on, ask: () => "Pick a logo idea.", help: () => "A free image generator draws these from your name and what you do. Tap one to use it, or skip and we'll use your name. A designer can refine your final logo later." },
  { id: "colour", group: "basics", label: "Colour", type: "choice", ask: () => "Which is your main brand colour?", options: () => COLOUR_OPTIONS },
  { id: "style", group: "basics", label: "Look", type: "choice", ask: () => "Which look fits you best?", options: () => STYLE_OPTIONS },
  {
    id: "btype", group: "business", label: "Business type", type: "choice", when: B,
    ask: () => "What type of business is it?",
    options: () => [...BIZ_TYPES.map((t) => ({ v: t, label: t.replace(/([a-z])([A-Z])/g, "$1 $2") })), { v: "Other", label: "Something else" }],
    help: () => "Pick the closest one. We use it to choose a design made for that kind of business.",
  },
  {
    id: "genre", group: "basics", label: "Theme type", type: "choice", when: (a) => !B(a),
    ask: () => "What genre of website?",
    options: (a) => [...(R(a) ? REST_TAGS : THEME_TAGS).map((t) => ({ v: t, label: t })), { v: "Any", label: "Any genre" }],
    help: () => "Pick the closest one. We use it to choose designs of that genre.",
  },
  { id: "email", group: "basics", label: "Contact email", type: "text", optional: true, ask: () => "Which email address should customers see?", ph: () => "e.g. hello@yourname.com", help: () => "Skip if you'd rather not." },
  { id: "phone", group: "basics", label: "Phone / WhatsApp", type: "text", optional: true, ask: () => "What phone or WhatsApp number should customers see?", ph: () => "e.g. +91 98765 43210", help: () => "It is shown on the website. Skip if you'd rather not." },
  { id: "wabtn", group: "basics", label: "WhatsApp button", type: "choice", optional: true, when: (a) => !!a.phone?.trim(), ask: () => "Show a WhatsApp chat button on your website?", options: YN },
  { id: "city", group: "basics", label: "City", type: "text", optional: true, ask: () => "Which city are you in?", ph: () => "e.g. Mumbai", help: () => "Skip it if you work online or don't want to show it." },
  { id: "social", group: "basics", label: "Social links", type: "text", optional: true, ask: (a) => (S(a) ? "What is your Instagram page link?" : "Do you have an Instagram or another page to link? Paste the link or your @name."), ph: () => "e.g. @yourname or https://instagram.com/yourname" },
  { id: "domain", group: "basics", label: "Custom domain", type: "text", optional: true, ask: () => "Do you already have your own website address (domain)?", ph: () => "e.g. yourname.com", help: () => "Only if you have one. We'll connect it when we publish." },

  // Personal portfolio
  { id: "about", group: "portfolio", label: "Role / title", type: "text", when: P, ask: () => "What is your role or title?", ph: () => "e.g. Wedding photographer", help: () => "One short line is enough. You can change it later." },
  { id: "photo", group: "portfolio", label: "Profile photo", type: "file", optional: true, when: P, accept: "image/png,image/jpeg,image/webp", maxKB: 5120, ask: () => "Add a profile photo." },
  { id: "intro", group: "portfolio", label: "Short intro", type: "text", optional: true, when: P, ask: () => "Write a short intro for the top of your page (1–2 lines).", ph: () => "e.g. I design brands that people remember." },
  { id: "story", group: "portfolio", label: "About", type: "long", optional: true, when: P, ask: () => "Tell us about yourself in a few lines: where you started and what you enjoy most.", ph: () => "Write it the way you'd tell a friend.", help: () => "We'll tidy it into proper website text. Skip it and we'll write something simple from your answers." },
  { id: "years", group: "portfolio", label: "Years of experience", type: "text", optional: true, when: P, ask: () => "How many years of experience do you have?", ph: () => "e.g. 6" },
  { id: "openwork", group: "portfolio", label: "Open to work badge", type: "choice", optional: true, when: P, ask: () => "Show an “Open to work / freelance” badge?", options: YN },
  { id: "items", group: "portfolio", label: "Key skills", type: "long", when: P, optional: true, ask: () => "List up to 6 things you are good at. Write one on each line.", ph: () => "Portraits\nWeddings\nProduct shoots", help: () => "Press Enter for a new line. We'll write a short line about each one." },
  { id: "projects", group: "portfolio", label: "Projects", type: "long", optional: true, when: P, ask: () => "List your projects or work samples, one on each line.", ph: () => "Brand film for Kora – a 2-minute story – https://kora.com\nWedding in Goa – photo series", help: () => "Write the name, then a dash and what it was. A link at the end is optional. Cover pictures can be added later." },
  { id: "offer", group: "portfolio", label: "Services", type: "long", optional: true, when: P, ask: () => "Do you offer services as a freelancer? List them, one on each line.", ph: () => "Logo design\nWebsite design\nSocial media posts" },
  { id: "exp", group: "portfolio", label: "Work experience", type: "long", optional: true, when: (a) => P(a) && !doc(a, "experience"), ask: () => "Tell us your work experience, one job on each line.", ph: () => "Acme Studio – Senior designer – 2019 to 2023 – led the brand team", help: () => "Company, position, from–to, and a highlight, with dashes between." },
  { id: "edu", group: "portfolio", label: "Education", type: "long", optional: true, when: (a) => P(a) && !doc(a, "education"), ask: () => "Where did you study? One on each line.", ph: () => "NID Ahmedabad – B.Des – 2018" },
  { id: "quotes", group: "portfolio", label: "Testimonials", type: "long", optional: true, when: (a) => P(a) && !doc(a, "testimonials"), ask: () => "Any kind words from clients or colleagues? One on each line.", ph: () => "Asha, Creative Director – “She delivered early and the work was brilliant.”", help: () => "Name and role, then the quote. Only real ones." },
  { id: "cform", group: "portfolio", label: "Contact form", type: "choice", optional: true, when: P, ask: () => "Add a contact form to your website?", options: YN },

  // Shop
  { id: "about", group: "store", label: "What you sell", type: "text", when: S, ask: () => "What do you sell?", ph: () => "e.g. Handmade candles and gifts", help: () => "One short line is enough. You can change it later." },
  { id: "story", group: "store", label: "About the store", type: "long", optional: true, when: S, ask: () => "Describe your store in 2–3 lines.", ph: () => "Write it the way you'd tell a friend.", help: () => "We'll tidy it into proper website text." },
  { id: "banner", group: "store", label: "Homepage banners", type: "file", optional: true, when: S, accept: "image/png,image/jpeg,image/webp", maxKB: 5120, ask: () => "Add pictures for your homepage banner." },
  { id: "currency", group: "store", label: "Currency", type: "choice", optional: true, when: S, ask: () => "Which currency do you sell in?", options: () => [{ v: "INR", label: "₹ Indian rupee" }, { v: "USD", label: "$ US dollar" }, { v: "EUR", label: "€ Euro" }, { v: "GBP", label: "£ Pound" }, { v: "AED", label: "AED Dirham" }] },
  { id: "cats", group: "store", label: "Product categories", type: "long", optional: true, when: S, ask: () => "What are your product categories? One on each line.", ph: () => "Candles\nGift boxes\nIncense" },
  { id: "items", group: "store", label: "Products", type: "long", when: S, optional: false, ask: () => "Name some products you sell, one on each line. You can add a price after a dash.", ph: () => "Soy candle - 450\nGift box - 899\nIncense set - 299", help: () => "Press Enter for a new line. Pictures, MRP, variants and stock can be added later." },
  { id: "accounts", group: "store", label: "Customer accounts", type: "choice", optional: true, when: S, ask: () => "Let customers create accounts?", options: YN },
  { id: "backend", group: "store", label: "Order backend", type: "choice", optional: true, when: S, ask: () => "Where should your orders be kept?", options: () => [{ v: "cloudflare", label: "Cloudflare (recommended)" }, { v: "supabase", label: "Supabase" }], help: () => "Cloudflare is the default if you skip this." },
  { id: "alertmail", group: "store", label: "Order alerts email", type: "text", optional: true, when: S, ask: () => "Which email should get new order alerts?", ph: () => "e.g. orders@yourname.com", help: () => "Orders alerts come by email. Skip it to use your contact email." },
  { id: "minorder", group: "store", label: "Minimum order", type: "text", optional: true, when: S, ask: () => "Is there a minimum order value?", ph: () => "e.g. 499" },
  { id: "deliver", group: "store", label: "Delivery area", type: "many", optional: true, when: S, ask: () => "Where do you deliver?", options: () => [{ v: "city", label: "My city" }, { v: "state", label: "My state" }, { v: "india", label: "All India" }, { v: "world", label: "International" }], help: () => "Tap everything that applies." },
  { id: "ship", group: "store", label: "Flat shipping", type: "text", optional: true, when: S, ask: () => "What is your flat shipping charge?", ph: () => "e.g. 60" },
  { id: "freeship", group: "store", label: "Free shipping above", type: "text", optional: true, when: S, ask: () => "Free shipping above what order value?", ph: () => "e.g. 999" },
  { id: "dtime", group: "store", label: "Delivery time", type: "text", optional: true, when: S, ask: () => "What is your usual delivery time?", ph: () => "e.g. 3–5 working days" },
  { id: "returns", group: "store", label: "Return policy", type: "long", optional: true, when: S, ask: () => "What is your return or exchange policy?", ph: () => "e.g. Return or exchange within 7 days if unused." },
  { id: "gstin", group: "store", label: "GSTIN", type: "text", optional: true, when: S, ask: () => "What is your GSTIN? (optional)", ph: () => "e.g. 27ABCDE1234F1Z5" },
  { id: "address", group: "store", label: "Business address", type: "text", optional: true, when: S, ask: () => "What is your registered business address?", ph: () => "e.g. 12 MG Road, Bengaluru 560001", help: () => "Shown on your contact page. Skip it if you work from home." },

  // Business portfolio
  { id: "about", group: "business", label: "Industry", type: "text", when: B, ask: () => "Which industry are you in, or what does your business do?", ph: () => "e.g. We repair and service home appliances", help: () => "One short line is enough. You can change it later." },
  { id: "founded", group: "business", label: "Year founded", type: "text", optional: true, when: B, ask: () => "Which year was the company founded?", ph: () => "e.g. 2012" },
  { id: "teamsize", group: "business", label: "Team size", type: "text", optional: true, when: B, ask: () => "How big is your team?", ph: () => "e.g. 25" },
  { id: "story", group: "business", label: "About the company", type: "long", optional: true, when: B, ask: () => "Tell us about your company in a few lines: how it started and who you help.", ph: () => "Write it the way you'd tell a friend.", help: () => "We'll tidy it into proper website text. Skip it and we'll write something simple from your answers." },
  { id: "mission", group: "business", label: "Mission / vision", type: "long", optional: true, when: (a) => B(a) && !doc(a, "mission") && !doc(a, "vision"), ask: () => "What is your mission or vision?", ph: () => "Mission: …\nVision: …" },
  { id: "bimage", group: "business", label: "Main banner image", type: "file", optional: true, when: B, accept: "image/png,image/jpeg,image/webp", maxKB: 5120, ask: () => "Add your main banner picture." },
  { id: "items", group: "business", label: "Services", type: "long", optional: true, when: (a) => B(a) && !doc(a, "services"), ask: () => "What are your main services or solutions? Write one on each line.", ph: () => "Repairs – quick fixes at your door\nAnnual service\nInstallation", help: () => "Name, then a dash and a short description (optional). Icons are chosen for you." },
  { id: "stats", group: "business", label: "Attributes", type: "long", optional: true, when: (a) => B(a) && !doc(a, "stats"), ask: () => "Which attributes would you like to show? One on each line.", ph: () => "120+ – Projects\n15 – Years\n98% – Clients return", help: () => "The number, a dash, then what it counts. Only true numbers." },
  { id: "work", group: "business", label: "Our work", type: "long", optional: true, when: (a) => B(a) && !doc(a, "work"), ask: (a) => `Which ${workWords(a).many} would you like to show?`, ph: () => "Name – a short line about it", help: (a) => `The ${workWords(a).one}, then what it is or what you did. Only things that are true.` },
  { id: "clients", group: "business", label: "Clients", type: "long", optional: true, when: (a) => B(a) && !doc(a, "clients"), ask: () => "Which clients would you like to name? One on each line.", ph: () => "Tata Motors\nCity Hospital" },
  { id: "team", group: "business", label: "Team members", type: "long", optional: true, when: (a) => B(a) && !doc(a, "team"), ask: () => "Who leads the company? Write one person on each line.", ph: () => "Asha Verma – Founder & CEO – linkedin.com/in/asha", help: () => "Name, designation, and a LinkedIn link if you like. Photos can be added later." },
  { id: "quotes", group: "business", label: "Testimonials", type: "long", optional: true, when: (a) => B(a) && !doc(a, "testimonials"), ask: () => "Any kind words from clients? One on each line.", ph: () => "Ravi, Acme Ltd – “They finished two weeks early.”", help: () => "Name and company, then the quote. Only real ones." },
  { id: "certs", group: "business", label: "Certifications / awards", type: "long", optional: true, when: B, ask: () => "Any certifications or awards? One on each line.", ph: () => "ISO 9001:2015\nBest Service Award 2023" },
  { id: "cta", group: "business", label: "Main button", type: "choice", when: B, ask: () => "What should the main button on your website say?", options: () => [{ v: "quote", label: "Get a quote" }, { v: "book", label: "Book a call" }, { v: "contact", label: "Contact us" }, { v: "demo", label: "Request a demo" }] },
  { id: "booklink", group: "business", label: "Booking link", type: "text", optional: true, when: (a) => B(a) && a.cta === "book", ask: () => "What is your calendar booking link?", ph: () => "e.g. https://cal.com/yourname", help: () => "Shown because you chose “Book a call”." },
  { id: "enqfields", group: "business", label: "Enquiry form fields", type: "many", optional: true, when: B, ask: () => "Which fields should your enquiry form have?", options: () => [{ v: "name", label: "Name" }, { v: "email", label: "Email" }, { v: "phone", label: "Phone" }, { v: "company", label: "Company" }, { v: "service", label: "Service needed" }, { v: "budget", label: "Budget" }, { v: "message", label: "Message" }], help: () => "Tap everything you want." },
  { id: "offices", group: "business", label: "Office locations", type: "long", optional: true, when: B, ask: () => "Where are your offices? One on each line.", ph: () => "Head office – 12 MG Road, Bengaluru 560001 – https://maps.app.goo.gl/…", help: () => "Name, address, and a map link if you like." },
  { id: "hours", group: "business", label: "Business hours", type: "text", optional: true, when: B, ask: () => "When are you open?", ph: () => "e.g. Monday to Saturday, 10 am to 7 pm", help: () => "Skip it if you don't want to show hours." },

  // Restaurant & café
  { id: "ptype", group: "restaurant", label: "Kind of place", type: "choice", when: R, ask: () => "What kind of place is it?", options: () => ["Restaurant", "Cafe", "Bakery", "Cloud kitchen", "Bar & lounge", "Food truck"].map((x) => ({ v: x, label: x })) },
  { id: "about", group: "restaurant", label: "Cuisines", type: "text", when: R, ask: () => "Which cuisines do you serve?", ph: () => "e.g. Home-style South Indian meals", help: () => "One short line is enough. You can change it later." },
  { id: "foodtype", group: "restaurant", label: "Food type", type: "choice", optional: true, when: R, ask: () => "What type of food is it?", options: () => ["Pure veg", "Veg & non-veg", "Non-veg focused", "Jain options"].map((x) => ({ v: x, label: x })) },
  { id: "story", group: "restaurant", label: "Your story", type: "long", optional: true, when: R, ask: () => "Tell us your story: what makes you special?", ph: () => "Write it the way you'd tell a friend.", help: () => "We'll tidy it into proper website text." },
  { id: "cost", group: "restaurant", label: "Cost for two", type: "text", optional: true, when: R, ask: () => "What is the average cost for two?", ph: () => "e.g. 800" },
  { id: "serves", group: "restaurant", label: "What you offer", type: "many", optional: true, when: R, ask: () => "What do you offer?", options: () => ["Dine-in", "Takeaway", "Delivery", "Catering", "Private dining"].map((x) => ({ v: x, label: x })), help: () => "Tap everything that applies." },
  { id: "photos", group: "restaurant", label: "Food & ambience photos", type: "file", optional: true, when: R, accept: "image/png,image/jpeg,image/webp", maxKB: 5120, ask: () => "Add photos of your food and the place." },
  { id: "menuhow", group: "restaurant", label: "How to add the menu", type: "choice", when: R, ask: () => "How do you want to add your menu?", options: () => [{ v: "type", label: "Type it in" }, { v: "upload", label: "Upload a photo or PDF" }] },
  { id: "menu", group: "restaurant", label: "Menu file", type: "file", optional: true, when: (a) => R(a) && a.menuhow === "upload", accept: "application/pdf", maxKB: 1200, ask: () => "Add your menu as a PDF here, or skip.", help: () => "A PDF up to 1.2 MB. Visitors can download it from your site." },
  { id: "items", group: "restaurant", label: "Menu dishes", type: "long", when: (a) => R(a) && a.menuhow !== "upload", optional: false, ask: () => "Name your best dishes, one on each line. You can add a price after a dash.", ph: () => "Masala dosa - 120\nFilter coffee - 60\nThali - 250", help: () => "Press Enter for a new line. Sections, photos, spice level and tags can be added later." },
  { id: "specials", group: "restaurant", label: "Offers / specials", type: "long", optional: true, when: (a) => R(a) && !doc(a, "offers"), ask: () => "Any current offers or specials? One on each line.", ph: () => "Sunday brunch – 2 for 1 on coffee" },
  { id: "outlets", group: "restaurant", label: "Outlets", type: "long", optional: true, when: R, ask: () => "Where are your outlets? One on each line.", ph: () => "HSR Layout – 12 27th Main, Bengaluru – 080 1234 5678 – 11 am to 11 pm", help: () => "Name or area, address, phone, map link and opening hours, with dashes between." },
  { id: "reserve", group: "restaurant", label: "Table reservations", type: "choice", optional: true, when: R, ask: () => "Take table reservations on your website?", options: YN },
  { id: "reserveto", group: "restaurant", label: "Where reservations go", type: "choice", optional: true, when: (a) => R(a) && a.reserve === "yes", ask: () => "How should reservations reach you?", options: () => [{ v: "whatsapp", label: "WhatsApp" }, { v: "email", label: "Email" }, { v: "phone", label: "Phone" }, { v: "link", label: "An outside booking link" }] },
  { id: "booklink", group: "restaurant", label: "Booking link", type: "text", optional: true, when: (a) => R(a) && a.reserve === "yes" && a.reserveto === "link", ask: () => "What is your booking link?", ph: () => "e.g. https://dineout.co.in/yourplace" },
  { id: "ordering", group: "restaurant", label: "Online ordering", type: "choice", optional: true, when: R, ask: () => "Take online orders on this website?", options: YN },
  { id: "reviews", group: "restaurant", label: "Google reviews link", type: "text", optional: true, when: R, ask: () => "What is your Google reviews link?", ph: () => "e.g. https://g.page/r/…" },
];

/** The questions as the Studio's settings list them (every one, even those not asked yet). */
export const QUESTION_LIST = RAW;
export const QUESTION_GROUPS: { id: QGroup; name: string }[] = [{ id: "basics", name: "Basics (asked for every type)" }, { id: "portfolio", name: "Personal portfolio" }, { id: "store", name: "Shop" }, { id: "business", name: "Business portfolio" }, { id: "restaurant", name: "Restaurant & café" }];

/** What a business shows as its "work", by kind of business (case studies suit only some). Singular, plural and the heading. */
export function workWords(a: Answers): { one: string; many: string; title: string } {
  const t = a.btype || "", is = (re: RegExp) => re.test(t);
  if (is(/^(Restaurant|Café|Bakery|Catering|Florist)$/)) return { one: "signature item", many: "signature items", title: "Signature items" };
  if (is(/^(Hotel|Travel)$/)) return { one: "stay or experience", many: "stays and experiences", title: "Stays & experiences" };
  if (is(/^(Retail|Boutique|Grocery|Pharmacy|Jewellery|Electronics|Furniture|Handicrafts|Textile|Automobile|Printing)$/)) return { one: "featured product", many: "featured products", title: "Featured products" };
  if (is(/^(Salon|Spa|Laundry|Cleaning|Petcare|Repair)$/)) return { one: "popular service", many: "popular services", title: "Popular treatments" };
  if (is(/^(Gym)$/)) return { one: "programme", many: "programmes", title: "Programmes" };
  if (is(/^(Clinic|Hospital|Dental)$/)) return { one: "treatment or success story", many: "treatments and success stories", title: "Treatments & results" };
  if (is(/^(School|Coaching|Tutoring)$/)) return { one: "result or achievement", many: "results and achievements", title: "Results & achievements" };
  if (is(/^(Events|Wedding)$/)) return { one: "event", many: "events", title: "Events we've done" };
  if (is(/^(Photography|Studio|Design|Interiors|Creator|Music|Gaming|Blogger|Freelancer)$/)) return { one: "project", many: "projects", title: "Selected work" };
  if (is(/^(NGO)$/)) return { one: "initiative", many: "initiatives", title: "Our initiatives" };
  if (is(/^(RealEstate|Construction)$/)) return { one: "project", many: "projects", title: "Our projects" };
  return { one: "project", many: "projects", title: "Our work" };
}
const dash = (c: string[]) => c.map((x) => x.trim()).filter(Boolean).join(" – ");
/** Questions whose answer is a list of items with several parts: each is asked as rows of sub-fields (same text format as typing it). */
const ROWS: Record<string, Pick<Step, "cols" | "fmt" | "addLabel">> = {
  "portfolio.projects": { addLabel: "Add a project", cols: [{ label: "Project", ph: "Brand film for Kora" }, { label: "What you did", ph: "Direction and edit" }] },
  "portfolio.exp": { addLabel: "Add a job", fmt: (c) => c.map((x) => x.trim()).filter(Boolean).join(", "), cols: [{ label: "Role", ph: "Lead photographer" }, { label: "Company", ph: "Lumen Studio" }, { label: "Period", ph: "2020 – Present" }] },
  "portfolio.edu": { addLabel: "Add a course", fmt: (c) => c.map((x) => x.trim()).filter(Boolean).join(", "), cols: [{ label: "Institute", ph: "NID Ahmedabad" }, { label: "Course", ph: "M.Des" }, { label: "Year", ph: "2014" }] },
  "portfolio.quotes": { addLabel: "Add a testimonial", fmt: (c) => (c[0]?.trim() ? `"${c[0].trim()}" – ${[c[1], c[2]].map((x) => (x || "").trim()).filter(Boolean).join(", ")}` : ""), cols: [{ label: "What they said", ph: "She made our day effortless." }, { label: "Name", ph: "Priya Nair" }, { label: "Role / company", ph: "Bride" }] },
  "store.items": { addLabel: "Add a product", fmt: (c) => [c[0]?.trim(), c[1]?.trim()].filter(Boolean).join(" - "), cols: [{ label: "Product", ph: "Soy candle" }, { label: "Price", ph: "450" }] },
  "business.stats": { addLabel: "Add an attribute", fmt: (c) => [c[0]?.trim(), c[1]?.trim()].filter(Boolean).join(" "), cols: [{ label: "Value", ph: "120+" }, { label: "Attribute", ph: "Projects" }] },
  "business.work": { addLabel: "Add another", cols: [{ label: "Name", ph: "e.g. Clinic booking app" }, { label: "Details", ph: "e.g. Rebuilt booking, cut drop-off by 30%" }] },
  "business.team": { addLabel: "Add a person", cols: [{ label: "Name", ph: "Asha Verma" }, { label: "Designation", ph: "Founder & CEO" }, { label: "LinkedIn (optional)", ph: "linkedin.com/in/asha" }] },
  "business.quotes": { addLabel: "Add a testimonial", fmt: (c) => (c[0]?.trim() ? `"${c[0].trim()}" – ${[c[1], c[2]].map((x) => (x || "").trim()).filter(Boolean).join(", ")}` : ""), cols: [{ label: "What they said", ph: "Brilliant team." }, { label: "Name", ph: "Priya Nair" }, { label: "Role / company", ph: "CDO, Arcadia" }] },
  "business.offices": { addLabel: "Add an office", cols: [{ label: "Office", ph: "Head office" }, { label: "Address", ph: "12 MG Road, Pune" }] },
  "restaurant.items": { addLabel: "Add a dish", fmt: (c) => [c[0]?.trim(), c[1]?.trim()].filter(Boolean).join(" - "), cols: [{ label: "Dish", ph: "Masala dosa" }, { label: "Price", ph: "120" }] },
  "restaurant.specials": { addLabel: "Add an offer", fmt: (c) => [c[0]?.trim(), c[1]?.trim()].filter(Boolean).join(" - "), cols: [{ label: "Offer", ph: "Weekday lunch thali" }, { label: "Price or discount", ph: "399" }] },
  "restaurant.outlets": { addLabel: "Add an outlet", cols: [{ label: "Outlet", ph: "HSR Layout" }, { label: "Address", ph: "12 27th Main, Bengaluru" }] },
};
export const rowsFmt = (s: Step, cells: string[]) => (s.fmt || dash)(cells);
const qrule = (s: Step) => readDesignSettings().questions?.[s.group || "basics"]?.[s.id];
/** What is asked: the owner's settings (hide a question, change its wording) are applied on top. */
export const STEPS: Step[] = RAW.filter((s) => !s.soon).map((s) => ({
  ...s, ...(ROWS[`${s.group}.${s.id}`] || {}),
  when: (a: Answers) => !qrule(s)?.h && (s.when ? s.when(a) : true),
  ask: (a: Answers) => qrule(s)?.t || (ROWS[`${s.group}.${s.id}`] ? s.ask(a).replace(/\s*(Write )?one (person )?on each line\.?/i, "").replace(/[,;:\s]+$/, "").trim() : s.ask(a)),
  help: (a: Answers) => qrule(s)?.p ?? (ROWS[`${s.group}.${s.id}`] ? "Fill one row for each. Use the + button to add more." : s.help?.(a) ?? ""),
}));

/** A short name for each question (for the answers shown above the current question). */
export const STEP_LABEL: Record<string, string> = { pages: "Pages", usp: "Highlights", goal: "Goal", hours: "Hours", address: "Address", ...Object.fromEntries(RAW.filter((x) => x.label).map((x) => [x.id, x.label!])), about: "About", story: "Story", items: "Offerings" };

/** The steps still to ask, in order. */
export const nextStep = (a: Answers): Step | null => STEPS.find((s) => (s.when ? s.when(a) : true) && !(s.id in a)) || null;
/** The question with this id (several types share ids such as "about"): the one that applies to these answers. */
export const stepOf = (id: string, a?: Answers) => (a && STEPS.find((s) => s.id === id && (!s.when || s.when(a)))) || STEPS.find((s) => s.id === id)!;
/** Its place in the order asked (-1 when it is not a question). */
export const stepAt = (id: string, a: Answers) => { const i = STEPS.findIndex((s) => s.id === id && (!s.when || s.when(a))); return i >= 0 ? i : STEPS.findIndex((s) => s.id === id); };

/** How an answer reads back to the person (their own chat bubble). */
export function sayAnswer(s: Step, a: Answers): string {
  const v = a[s.id]; if (!v) return "Skip";
  const src = (a.docfrom || "").split(",").includes(s.id) ? " (from your document)" : "";
  if (s.type === "file") return s.id === "logo" ? "Logo added" : s.id === "doc" ? (a.doclink ? `Link: ${v}` : `PDF: ${v}`) : `Menu added: ${v}`;
  if (s.id === "pages") return v === "multi" ? "Separate pages" : "One page";
  if (s.id === "kind") return KIND_OPTIONS.find((o) => o.v === v)?.label || v;
  if (s.type === "choice") return [...(s.options?.(a) || []), ...STYLE_OPTIONS, ...OLD_STYLES, ...COLOUR_OPTIONS].find((o) => o.v === v)?.label || v;
  if (s.type === "many") return v.split(",").map((x) => (s.options?.(a) || []).find((o) => o.v === x)?.label || x).join(", ");
  if (s.type === "long") return v.split("\n").filter(Boolean).join(" · ") + src;
  return v + src;
}

// ---- reading the person's own document

/** What a document's text can fill in: only things actually written in it (nothing is made up). Only fields not answered yet. */
export function fromDoc(text: string, a: Answers, meta?: { name?: string; about?: string }): Answers {
  const t = text.replace(/\r/g, ""), ls = t.split("\n").map((x) => x.trim()).filter(Boolean), out: Answers = {}, kind = k(a);
  const clean = (x: string) => x.replace(/\s+/g, " ").trim();
  const isFact = (l: string) => /@|https?:\/\/|^\+?[\d\s()-]{8,}$/.test(l) || /^(call|email|instagram)\b/i.test(l);
  const head = (meta?.name ? clean(meta.name) : (ls.find((l) => !isFact(l) && l.length >= 2) || "").split(/\s+[-–|·:]\s+/)[0]).slice(0, 60);
  if (!a.name && head.length >= 2 && head.length <= 45 && !/^\d/.test(head)) out.name = head;
  const aboutGuess = meta?.about ? clean(meta.about) : ls.slice(1, 8).find((l) => l.length >= 20 && l.length <= 110 && !isFact(l) && !/\d{3,}/.test(l) && !/(mon|tue|wed|thu|fri|sat|sun)[a-z]*\s*(?:-|–|to)/i.test(l) && !/[-–—:.…]\s*\d[\d,.]*$/.test(l) && l !== head);
  if (!a.about && aboutGuess) out.about = aboutGuess.length > 110 ? aboutGuess.slice(0, 110).replace(/\s+\S*$/, "") : aboutGuess.replace(/[.]+$/, "");
  const addr = ls.find((l) => l.length >= 15 && l.length <= 140 && /\b\d{6}\b|\b(road|rd\.?|street|st\.|nagar|layout|marg|lane|floor|plaza|complex|sector|colony)\b/i.test(l) && !/@/.test(l));
  if (addr && !a.address && k(a) !== "portfolio") out.address = clean(addr.replace(/^(address|visit us|find us)\s*[:\-–]?\s*/i, ""));
  const email = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/.exec(t)?.[0];
  const phone = /(?:\+\d{1,3}[\s-]?)?(?:\(?\d{3,5}\)?[\s-]?)?\d{3,5}[\s-]?\d{4,5}/.exec(t.replace(/[^\S\n]+/g, " "))?.[0]?.trim();
  if (email && !a.email) out.email = email;
  if (phone && /\d{10}/.test(phone.replace(/\D/g, "")) && !a.phone) out.phone = phone;
  const insta = /(?:instagram\.com\/|@)([\w.]{3,30})\b/i.exec(t.replace(email || "\u0000", ""))?.[0];
  if (insta && !a.social) out.social = insta.startsWith("@") ? insta : "https://" + insta.replace(/^https?:\/\//, "");
  const hours = ls.find((l) => l.length < 90 && /(mon|tue|wed|thu|fri|sat|sun)[a-z]*\s*(?:-|–|to)\s*(mon|tue|wed|thu|fri|sat|sun)/i.test(l) && /\d/.test(l));
  if (hours && !a.hours && (kind === "business" || kind === "restaurant")) out.hours = hours.replace(/\s+(call|mail|email|ig|instagram)\b.*$/i, "").trim();
  const priced = ls.map((l) => /^(.{2,50}?)\s*[-–—:.…]+\s*(?:₹|rs\.?|inr|\$)?\s*(\d[\d,.]*)\s*(?:\/-)?$/i.exec(l)).filter(Boolean).slice(0, 8) as RegExpExecArray[];
  const bullets = ls.filter((l) => /^[•●▪◦\-–*]\s+\S/.test(l)).map((l) => l.replace(/^[•●▪◦\-–*]\s+/, "")).filter((l) => l.length >= 3 && l.length <= 60).slice(0, 6);
  const used = new Set<string>([...priced.map((m) => m[0]), ...(hours ? [hours] : []), ...(addr ? [addr] : []), head, aboutGuess || ""]);
  const NAV = /^(home|about( us)?|contact( us)?|menu|blog|login|log in|sign in|services?|products?|gallery|faq|careers?|shop|cart|search|more|read more|book now|call|mail|email|privacy|terms)$/i;
  const short = (l: string) => l.length >= 3 && l.length <= 40 && l.split(/\s+/).length <= 5 && !/[.!?:@]|https?:|\d{3,}/.test(l) && !NAV.test(l) && l !== head && !used.has(l);
  let run: string[] = [], best: string[] = [];
  for (const l of ls) { if (short(l)) { run.push(l); if (run.length > best.length) best = run.slice(); } else run = []; }
  if (!a.items && (readSections(t).services?.length || 0) < 3) {
    if ((kind === "store" || kind === "restaurant") && priced.length >= 2) out.items = priced.map((m) => `${m[1].trim()} - ${m[2].replace(/,/g, "")}`).join("\n");
    else if (bullets.length >= 3) out.items = bullets.join("\n");
    else if (best.length >= 3 && best.length <= 8) out.items = best.join("\n");
  }
  const secs = readSections(t), outside = new Set(outsideLines(t));
  if (!a.items && (secs.services?.length || 0) >= 3) out.items = secs.services!.map((e) => e.title).slice(0, 8).join("\n");
  const prose = ls.filter((l) => outside.has(l) && l.length >= 45 && /[a-z]/.test(l) && !used.has(l) && !/@|https?:\/\//.test(l) && !/^[•●▪◦\-–*]\s/.test(l)).join(" ");
  if (!a.docsec) { const sec = packSections(readSections(t)); if (sec && sec !== "{}") out.docsec = sec; }
  if (!a.story && prose.length >= 120) out.story = prose.length > 700 ? prose.slice(0, 700).replace(/\s+\S*$/, "") + "…" : prose;
  return out;
}

// ---- choosing the look

const hexOf = (c: string) => { const m = /^#?([0-9a-f]{6})$/i.exec(c || ""); return m ? m[1] : "888888"; };
function hsl(c: string): { h: number; s: number; l: number } {
  const x = hexOf(c), r = parseInt(x.slice(0, 2), 16) / 255, g = parseInt(x.slice(2, 4), 16) / 255, b = parseInt(x.slice(4, 6), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = d === 0 ? 0 : mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360; return { h, s, l };
}
const HUE: Record<string, number> = { blue: 220, green: 145, red: 358, orange: 28, purple: 272, pink: 328, gold: 45 };
const STYLE_TAGS: Record<string, { want: string[]; dark?: boolean; light?: boolean }> = {
  clean: { want: ["Minimal", "Light", "Modern", "Calm", "Fresh", "Classic"], light: true },
  bold: { want: ["Bold", "Motion", "Playful", "Modern"] },
  elegant: { want: ["Elegant", "Luxury", "Classy", "Fine dining"] },
  dark: { want: ["Dark", "Tech", "Modern", "Bold"], dark: true },
  warm: { want: ["Warm", "Homemade", "Craft", "Family", "Nature", "Rustic", "Café"] },
  fun: { want: ["Playful", "Retro", "Street food", "Dessert", "Bold", "Motion"] },
  corporate: { want: ["Corporate", "Classic", "Minimal", "Light", "Modern", "Consulting"], light: true },
};
/** "B-27", "b27" and "B-027" are the same theme ID. */
const codeKey = (v?: string) => { const m = /^([a-z])[\s-]*0*(\d{1,4})$/i.exec((v || "").trim()); return m ? m[1].toLowerCase() + m[2] : ""; };
const hash = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
function poolOf(kind: Kind): Theme[] { return kind === "business" ? BIZ_THEMES : kind === "restaurant" ? REST_THEMES : THEMES; }
/** The Studio's own themes of a type (the ones its Themes page shows). */
export const myThemesOf = (kind: Kind): Theme[] => limitThemes(poolOf(kind), undefined, kind);
/** The themes the Studio's owner offers (all of them unless the owner picked some). */
function offered(kind: Kind): Theme[] { const al = readDesignSettings().themes?.[kind], all = myThemesOf(kind), l = al?.length ? all.filter((t) => al.includes(t.id)) : all; return l.length ? l : all; }

/** A plain sample picture (soft shapes in the theme's colours) for previews that have no photo yet. */
export const samplePicture = (c1: string, c2: string, bg: string) => "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 640"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="800" height="640" fill="${bg}"/><rect width="800" height="640" fill="url(#g)" opacity=".85"/><circle cx="560" cy="190" r="120" fill="#fff" opacity=".22"/><circle cx="250" cy="430" r="190" fill="#000" opacity=".12"/><path d="M0 520C160 440 300 560 460 500S700 420 800 470V640H0Z" fill="#fff" opacity=".2"/></svg>`);

/** The theme that best matches the feel and colour chosen; the person's name picks between near ties so two people don't get the same one. */
function scoreThemes(a: Answers) {
  const kind = k(a), pool = offered(kind), genre = kind !== "business" && a.genre && a.genre !== "Any" ? a.genre : "";
  const st = STYLE_TAGS[a.style || "clean"] || STYLE_TAGS.clean, col = a.colour || "any";
  // A business says what it does ("dental clinic", "wedding planner"): the themes made for that kind of business come first.
  const say = `${a.about || ""} ${a.name || ""}`.toLowerCase(), picked = kind === "business" && a.btype && BIZ_TYPES.includes(a.btype) ? [a.btype] : [], mine = kind === "business" ? picked.length ? picked : BIZ_TYPES.filter((ty) => say && new RegExp(BIZ_TYPE_WORDS[ty] || "(?!)", "i").test(say)) : [];
  const scored = pool.map((t) => {
    let s = st.want.reduce((n, tag, i) => n + (t.tags.includes(tag) ? 6 - Math.min(i, 4) : 0), 0);
    if (st.dark && t.dark) s += 8; if (st.dark && !t.dark) s -= 8; if (st.light && !t.dark) s += 4;
    if (!st.dark && t.dark && a.style !== "bold" && a.style !== "elegant") s -= 3;
    const c = hsl(t.colors.c1);
    if (col === "mono") s += c.s < 0.15 ? 10 : -c.s * 10;
    else if (col !== "any") { const d = Math.min(Math.abs(c.h - HUE[col]), 360 - Math.abs(c.h - HUE[col])); s += c.s < 0.2 ? -6 : Math.max(-8, 10 - d / 9); }
    if (kind === "store" && t.tags.includes("Products")) s += 2;
    if (genre && t.tags.includes(genre)) s += 40;
    for (const ty of mine) if (t.tags.includes(ty)) s += picked.length ? 40 : 12;
    return { t, s };
  }).sort((x, y) => y.s - x.s);
  return { kind, scored, mine };
}
/** The themes that go with what the person told us, best first: for a business, every theme made for its type; for the other kinds, the closest matches in feel and colour. */
export function relatedThemes(a: Answers, max = 14): Theme[] {
  const { kind, scored, mine } = scoreThemes(a);
  // Set in Settings → Design yourself: show exactly the themes the owner ticked, instead of the ones that match the answers.
  if (readDesignSettings().carousel?.[kind] === "custom") return scored.slice(0, 30).map((x) => x.t);
  const typed = kind === "business" && mine.length ? scored.filter((x) => mine.some((ty) => x.t.tags.includes(ty))) : [];
  const genre = kind !== "business" && a.genre && a.genre !== "Any" ? scored.filter((x) => x.t.tags.includes(a.genre!)) : [];
  const own = typed.length >= 3 ? typed : genre.length >= 2 ? genre : null;
  return (own || scored.slice(0, max)).map((x) => x.t);
}
export function pickTheme(a: Answers): Theme | null {
  const kind = k(a), pool = offered(kind); if (!pool.length) return null;
  const chosen = a.theme && poolOf(kind).find((t) => t.id === a.theme); if (chosen) return chosen;
  const ask = codeKey(a.themeid), byCode = ask ? poolOf(kind).find((t) => codeKey(themeCode(t)) === ask) : undefined; if (byCode) return byCode;
  const { scored } = scoreThemes(a);

  const top = scored.filter((x) => x.s >= scored[0].s - 1.5).slice(0, 6);
  return top[hash((a.name || "") + (a.about || "")) % top.length].t;
}

// ---- building the site

const starters: Partial<Record<Kind, Promise<any>>> = {};
const starter = (kind: Kind) => (starters[kind] ||= loadStarter(kind, "default"));
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const lines = (s: string | undefined) => String(s || "").split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 8);
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const digits = (s: string) => s.replace(/[^\d+]/g, "");
/** "Soy candle - 450" → name and price. */
const priced = (l: string) => { const m = /^(.*?)\s*[-–—:]\s*(?:₹|rs\.?|inr)?\s*([\d,.]+)\s*$/i.exec(l); return m ? { name: m[1].trim(), price: m[2].replace(/,/g, "") } : { name: l, price: "" }; };
/** Replace the sample brand everywhere in text (not in theme, code or settings). */
function rebrand(o: any, from: string, to: string, skip = new Set(["theme", "code", "i18n", "cms"])) {
  if (Array.isArray(o)) { o.forEach((v, i) => { if (typeof v === "string") o[i] = v.split(from).join(to); else rebrand(v, from, to, skip); }); return; }
  if (o && typeof o === "object") for (const key of Object.keys(o)) { if (skip.has(key)) continue; const v = o[key]; if (typeof v === "string") o[key] = v.split(from).join(to); else rebrand(v, from, to, skip); }
}
const goals = (a: Answers) => { const g = (a.goal || "").split(",").filter(Boolean); if (a.cta) g.unshift(a.cta); if (a.reserve === "yes") g.push("table"); if (a.ordering === "yes") g.push("order"); return [...new Set(g)]; };

/** The starter holds made-up facts (years of experience, clients, reviews, prices). A preview built from a few answers shouldn't show someone else's story as theirs, so those parts are hidden or emptied. */
/** The starter holds made-up facts (years of experience, clients, reviews, prices). A preview built from a few answers shouldn't show someone else's story as theirs, so those parts are hidden or emptied. */
function tidy(kind: Kind, c: any, o: { name: string; about: string; city: string; g: string[]; items: string[]; phone: string; email: string }) {
  const hide = (...ids: string[]) => { for (const x of c.sections || []) if (ids.includes(x.id)) { if ("visible" in x) x.visible = false; else x.show = false; } };
  const show = (...ids: string[]) => { for (const x of c.sections || []) if (ids.includes(x.id)) { if ("visible" in x) x.visible = true; else x.show = true; } };
  const put = (path: string, v: any) => { const ks = path.split("."); let t = c; for (const x of ks.slice(0, -1)) { if (!t[x] || typeof t[x] !== "object") t[x] = {}; t = t[x]; } t[ks[ks.length - 1]] = v; };
  const { name, about, city, items, g } = o, first = name.split(/\s+/)[0] || "";
  if (!o.email && c.contact) put("contact.email", "");
  if (!o.phone && c.contact) { put("contact.phone", ""); put("contact.whatsapp", ""); }
  if (kind === "portfolio") {
    hide("work", "learning", "projects");
    if (name && about) { put("about.storyHeading", `I'm ${first}. *${about}.*`); put("about.story", `${name} is a ${about.toLowerCase()}${city ? " based in " + city : ""}.\n\nGet in touch to talk about your project.`); }
    put("about.stats", []); put("about.facts", [...(about ? [{ k: "Focus", v: about }] : []), ...(city ? [{ k: "Based in", v: city }] : [])]);
    put("hero.meta", city ? [{ value: city, label: "Based in" }] : []);
    if (items.length) put("ticker", items.slice(0, 8));
    for (const key of ["showStory", "showSplit", "showPartners"]) put("velocity." + key, false);
    put("velocity.nextTitle", ""); put("velocity.nextDate", "");
  } else if (kind === "store") {
    put("home.banner.show", false); put("nav.showPortfolio", false); put("home.hero.eyebrow", "");
  } else if (kind === "business") {
    hide("clients", "stats", "work", "process", "team", "testimonials", "pricing", "faq", "products");
    put("about.mission", ""); put("about.vision", ""); put("about.values", []);
    put("stats.items", []); put("hero.ctaSecondary", ""); put("hero.ctaSecondaryTarget", "");
    if (!city) put("contact.address", "");
    if (!o.phone) put("contact.hours", "");
  } else {
    hide("highlights", "offers", "gallery", "chef", "events", "press", "testimonials", "order", "reserve", "faq");
    if (g.includes("order")) show("order"); if (g.includes("table")) show("reserve"); if (g.includes("event")) show("events");
    put("about.facts", []); put("about.signature", "");
    const dishes = items.map((l) => { const m = /^(.*?)\s*[-–—:]\s*(?:₹|rs\.?|inr)?\s*([\d,.]+)\s*$/i.exec(l); return { name: m ? m[1].trim() : l, price: m ? m[2].replace(/,/g, "") : "" }; });
    if (dishes.length) c.food.categories = [{ name: "Our menu", note: "", image: null, items: dishes.map((d) => ({ name: d.name, desc: "", price: d.price, diet: "", spice: "", tag: "", allergens: "", image: null, variants: [], soldOut: false })) }];
    else hide("food");
    put("hours.note", ""); put("hours.days", []); put("hours.showStatus", false); put("hero.showStatus", false);
    if (!city) put("contact.address", ""); put("contact.parking", "");
  }
}

export type Design = { kind: Kind; content: any; themeId: string; themeName: string; summary: string };
/** Pictures and files chosen in the chat (kept on this device until the request is sent). */
export type DesignFiles = { logo?: string; menu?: { name: string; b64: string }; /** Pictures for the picture questions (photo, banner, bimage, photos), each made small on the person's device. */ pics?: Record<string, string[]> };

const urlOf = (v: string) => { const t = v.trim(); if (!t) return ""; if (/^@?[\w.]{2,30}$/.test(t)) return "https://instagram.com/" + t.replace(/^@/, ""); return /^https?:\/\//i.test(t) ? t : /^[\w-]+(\.[\w-]+)+/.test(t) ? "https://" + t : ""; };

/** The website so far, from the answers so far (whatever isn't answered keeps its sample wording). `copy` is the written text for each topic. */
export async function buildDesign(a: Answers, copy?: Copy | null, files?: DesignFiles | null): Promise<Design | null> {
  if (!a.kind || !TEMPLATES[a.kind]) return null;
  const kind = a.kind as Kind, tpl = TEMPLATES[kind], c: any = clone(await starter(kind)); tpl.prepare?.(c); c.festival = { ...(c.festival || {}), on: false }; // the festival overlay would hide the first screen of a preview
  const name = (a.name || "").trim(), about = cap((a.about || "").trim()), city = (a.city || "").trim(), g = goals(a), items = lines(a.items), usp = lines(a.usp), story = (a.story || "").trim();
  const phone = (a.phone || "").trim(), email = (a.email || "").trim(), address = (a.address || "").trim(), hours = (a.hours || "").trim(), social = urlOf(a.social || "");
  const base0 = { service: clone(c.services?.items?.[0] || {}), work: clone(c.work?.items?.[0] || {}) };
  const theme = pickTheme(a), cp: Copy = copy || {}, noteOf = (n: string) => cp.items?.find((x) => x.name.toLowerCase() === n.toLowerCase())?.text || "";
  if (name) rebrand(c, "Picaffectz", name);
  const put = (path: string, v: any) => { const ks = path.split("."); let o = c; for (const x of ks.slice(0, -1)) { if (!o[x] || typeof o[x] !== "object") o[x] = {}; o = o[x]; } o[ks[ks.length - 1]] = v; };
  const seo = () => { if (name) put("seo.title", about ? `${name} · ${about}` : name); if (about) put("seo.description", `${about}${city ? " in " + city : ""}.`); };
  const aboutText = story || cp.about_text;

  if (kind === "portfolio") {
    if (name) { const p = name.split(/\s+/); put("hero.firstName", p[0]); put("hero.lastName", p.slice(1).join(" ")); put("brand.logoText", name); put("contact.footerLeft", `© ${new Date().getFullYear()} ${name}`); }
    if (about) { put("hero.eyebrow", about + (city ? " · " + city : "")); put("hero.role", `I'm a ${about.toLowerCase()}${city ? " based in " + city : ""}. *Let's make something good together.*`); put("seo.description", `Portfolio of ${name || "me"}: ${about.toLowerCase()}.`); }
    if (cp.hero_text) put("hero.role", cp.hero_text);
    if (items.length >= 3) c.skills.items = items.slice(0, 6).map((t, i) => ({ ...c.skills.items[i % c.skills.items.length], tag: `${String(i + 1).padStart(2, "0")} / Skill`, title: t, body: noteOf(t), detail: "" }));
    const first: Record<string, [string, string]> = { work: ["See my work ↓", "work"], hire: ["Hire me", "contact"], story: ["Read my story ↓", "about"], contact: ["Message me", "contact"] };
    if (g[0] && first[g[0]]) { put("hero.ctaPrimary", first[g[0]][0]); put("hero.ctaPrimaryTarget", first[g[0]][1]); }
    if (email) { put("contact.email", email); c.contact.links = (c.contact.links || []).filter((l: any) => !/linkedin/i.test(l.label)); }
    else c.contact.links = (c.contact.links || []).filter((l: any) => !/linkedin\.com\/?$/.test(l.url));
    if (a.linkedin?.trim()) { const l = a.linkedin.trim(), u = /^https?:\/\//i.test(l) ? l : "https://" + l.replace(/^\/+/, ""); c.contact.links = [{ label: "LinkedIn", url: u }, ...(c.contact.links || []).filter((x: any) => !/linkedin/i.test(x.label))]; }
    // The starter's made-up links (GitHub home page, example.com address) are not theirs.
    c.contact.links = (c.contact.links || []).filter((l: any) => !/^https:\/\/(www\.)?(github|linkedin)\.com\/?$/.test(l.url) && !/example\.com/.test(l.url));
    if (email) c.contact.links = [...c.contact.links, { label: "Email", url: "mailto:" + email }];
    if (social) c.contact.links = [...(c.contact.links || []), { label: /instagram/.test(social) ? "Instagram" : "My page", url: social }];
    if (cp.cta_text) put("contact.body", cp.cta_text);
    put("hero.ctaSecondary", ""); put("hero.ctaSecondaryUrl", "");
    seo();
  } else if (kind === "store") {
    if (name) put("brand.name", name);
    if (about) { put("brand.tagline", a.tagline?.trim() || cp.tagline || about); put("home.hero.text", cp.hero_text || about + "."); put("shop.intro", `Everything from ${name || "our shop"}, in one place.`); put("portfolio.intro", aboutText || about + "."); }
    if (name) { put("home.hero.title", `Welcome to\n${name}`); put("portfolio.title", `About ${name}`); }
    put("brand.showAnnouncement", false);
    if (items.length) {
      const base = c.products, cat = { ...c.categories[0], id: "all", name: "Our range", description: about };
      c.categories = [cat];
      c.products = items.map((l, i) => { const { name: n, price } = priced(l), s = clone(base[i % base.length]), t = noteOf(n); return { ...s, id: "p" + (i + 1), slug: n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item-" + (i + 1), name: n, category: "all", price: price ? +price : 0, compareAt: 0, short: t, description: t, features: [], options: [], optionName: "" }; });
    }
    if (usp.length) { put("home.banner.show", true); put("home.banner.title", usp[0]); put("home.banner.text", usp.slice(1).join(". ") || about); put("home.banner.cta", ""); }
    if (g.length) { const P = c.payments; P.cod.enabled = g.includes("cod"); P.upi.enabled = g.includes("upi"); P.razorpay.enabled = g.includes("card"); put("orders.sendVia", g.includes("whatsapp") || !phone ? "whatsapp" : "email"); }
    if (phone) { put("contact.phone", phone); put("contact.whatsapp", digits(phone)); put("orders.whatsapp", digits(phone)); }
    if (email) { put("contact.email", email); put("orders.email", email); }
    if (address || city) put("contact.address", address || city);
    if (social) put("contact.instagram", social);
    seo();
  } else if (kind === "business") {
    if (name) put("brand.name", name);
    if (about) { put("brand.tagline", a.tagline?.trim() || cp.tagline || about); put("hero.title", about + "."); put("hero.lede", cp.hero_text || `${name || "We"}${city ? ", " + city : ""}. Get in touch and we'll take it from there.`); put("about.body", aboutText || `${about}.`); put("cta.body", cp.cta_text || `Tell us what you need and we'll get back to you.`); }
    if (city) { put("hero.eyebrow", city); put("contact.address", city); } else put("hero.eyebrow", "");
    c.hero.badges = usp.slice(0, 4);
    if (items.length) c.services.items = items.slice(0, 6).map((t, i) => ({ ...c.services.items[i % c.services.items.length], title: t, body: noteOf(t) || `${t}${name ? " by " + name : ""}.`, points: [] }));
    if (cp.services_text && items.length) c.services.lede = cp.services_text;
    const cta: Record<string, [string, string]> = { quote: ["Get a quote", "contact"], call: ["Call us", "contact"], book: [a.cta === "book" ? "Book a call" : "Book a visit", "contact"], whatsapp: ["WhatsApp us", "contact"], contact: ["Contact us", "contact"], demo: ["Request a demo", "contact"] };
    if (g[0] && cta[g[0]]) { put("nav.cta", cta[g[0]][0]); put("hero.ctaPrimary", cta[g[0]][0]); put("cta.button", cta[g[0]][0]); }
    if (phone) { put("contact.phone", phone); put("contact.whatsapp", digits(phone)); }
    if (email) put("contact.email", email);
    put("footer.text", about ? `${name}. ${about}.` : name);
    seo();
  } else {
    if (name) put("brand.name", name);
    if (about) { put("brand.tagline", a.tagline?.trim() || cp.tagline || about); put("hero.eyebrow", about + (city ? " · " + city : "")); put("hero.lede", cp.hero_text || `${about}. Come hungry.`); put("about.body", aboutText || `${name || "We"} serve ${about.toLowerCase()}${city ? " in " + city : ""}.`); put("cta.body", cp.cta_text || "Book a table, or call us for takeaway."); }
    if (name) put("hero.title", name);
    put("hero.stamp", ""); c.hero.badges = usp.slice(0, 4);
    if (items.length) c.specials.items = items.slice(0, 8).map((l, i) => { const { name: n, price } = priced(l); return { ...c.specials.items[i % c.specials.items.length], name: n, desc: noteOf(n), price, tag: "", image: null }; });
    const cta: Record<string, [string, string]> = { table: ["Book a table", "reserve"], order: ["Order online", "order"], menu: ["See the menu", "food"], event: ["Plan a party", "events"] };
    if (g[0] && cta[g[0]]) { put("nav.cta", cta[g[0]][0]); put("nav.ctaTarget", cta[g[0]][1]); put("hero.ctaPrimary", cta[g[0]][0]); put("hero.ctaPrimaryTarget", cta[g[0]][1]); }
    if (city) put("contact.address", city);
    if (phone) { put("contact.phone", phone); put("contact.whatsapp", digits(phone)); }
    if (email) put("contact.email", email);
    put("footer.text", about ? `${name}. ${about}.` : name);
    seo();
  }
  tidy(kind, c, { name, about, city, g, items, phone, email });
  // A section the person gave nothing for isn't shown (not even with the template's sample words).
  const hideIf = (cond: boolean, ...ids: string[]) => { if (cond) for (const x of c.sections || []) if (ids.includes(x.id)) { if ("visible" in x) x.visible = false; else x.show = false; } };
  if (!items.length) { if (kind === "business") c.services.items = []; if (kind === "restaurant") c.specials.items = []; if (kind === "portfolio") c.skills.items = []; }
  if (kind === "business") put("about.title", name ? `About ${name}` : "About us");
  // The template's sample wording is not theirs: neutral headings instead.
  if (kind === "portfolio") { put("about.title", "About me"); put("about.lede", ""); put("about.quote", ""); if (!items.length) put("ticker", []); }
  if (kind === "restaurant") put("about.title", "Our story");
  if (kind === "store") { put("footer.text", about ? `${name}. ${about}.` : name); put("home.featuredText", ""); put("home.banner.title", usp[0] || ""); for (const x of c.products || []) x.badge = ""; }
  if (kind === "portfolio") { hideIf(!items.length, "skills"); hideIf(!(email || phone || social || address), "contact"); hideIf(!(story || cp.about_text || about), "about"); }
  if (kind === "business") { hideIf(!(phone || email || address || city || hours), "contact"); }
  if (kind === "restaurant") { hideIf(!items.length, "specials"); hideIf(!(phone || email || address || city || hours), "contact"); }

  // What only some types and answers add (after the starter's made-up parts are cleared).
  if (kind === "business" || kind === "restaurant") {
    if (address || city) put("contact.address", address || city);
    put("site.multiPage", pagesChoice(kind, a.pages, readDesignSettings()) === "multi");
    if (social) c.footer.links = [{ label: /instagram/.test(social) ? "Instagram" : "Find us online", url: social }, ...(c.footer.links || [])];
    if (cp.faq?.length && items.length >= 2) { put("faq.items", cp.faq); show(c, "faq"); }
  }
  if (kind === "business" && hours) put("contact.hours", hours);
  if (kind === "restaurant" && hours) { put("hours.note", hours); put("hours.days", []); put("hours.showStatus", false); }
  const ds = unpackSections(a.docsec); if (a.work?.trim()) delete ds.work;
  // Case studies: the work they said they delivered, each "project – what you did".
  const workLines = lines(a.work);
  if (kind === "business" && workLines.length) {
    c.work.items = workLines.slice(0, 6).map((l) => { const m = /^(.{2,70}?)\s*(?::|\s[-–—]\s)\s*(.{3,})$/.exec(l), title = (m ? m[1] : l).trim(), sum = (m ? m[2] : "").trim(); return { ...base0.work, title, client: "", sector: "", summary: sum || `${name || "We"} delivered ${title.charAt(0).toLowerCase() + title.slice(1)}.`, result: "", image: null, url: "" }; });
    c.work.lede = cp.work_text || ""; show(c, "work");
  }
  // The other answers, each into the part of the website that shows it (nothing is made up: only what was said).
  const yes = (v?: string) => v === "yes", many = (v?: string) => (v || "").split(",").map((x) => x.trim()).filter(Boolean), TS = typedSections(a);
  for (const k of Object.keys(TS) as (keyof DocSections)[]) if (!(ds as any)[k]?.length && !(ds as any)[k]) (ds as any)[k] = (TS as any)[k];
  if (a.domain?.trim()) put("seo.siteUrl", /^https?:\/\//i.test(a.domain.trim()) ? a.domain.trim() : "https://" + a.domain.trim().replace(/^\/+/, ""));
  if (yes(a.wabtn) && phone) put("addons.chat", { on: true, kind: "whatsapp", value: digits(phone), label: "Chat with us", message: name ? `Hello ${name}!` : "Hello!", side: "right", showLabel: true });
  if (kind === "portfolio") {
    const intro = (a.intro || "").trim(), yrs = (a.years || "").trim().replace(/[^\d+]/g, "");
    if (intro) put("hero.role", intro);
    if (yrs) put("hero.meta", [{ value: yrs + (yrs.includes("+") ? "" : "+"), label: "Years of experience" }, ...(city ? [{ value: city, label: "Based in" }] : [])]);
    if (yes(a.openwork)) { put("addons.badge", { on: true, text: "Open to work", side: "left" }); put("velocity.status", "Open to work"); }
    const proj = lines(a.projects);
    if (proj.length) {
      const SH = ["circle", "square", "diamond", "triangle"], CL = ["c1", "c2", "c3"];
      c.projects = { ...(c.projects || {}), items: proj.slice(0, 8).map((l, i) => { const m = /^(.{2,70}?)\s*(?::|\s[-–—]\s)\s*(.{3,})$/.exec(l); return { title: (m ? m[1] : l).trim(), body: (m ? m[2] : "").trim(), url: "", linkLabel: "", image: null, image2: null, color: CL[i % 3], shape: SH[i % 4], tags: [] }; }) };
      show(c, "projects");
    }
    const off = lines(a.offer).map((l) => priced(l).name);
    if (off.length) put("contact.body", `${cp.cta_text || ""}${cp.cta_text ? " " : ""}Available for: ${off.join(", ")}.`);
    if (ds.testimonials?.length) c.testimonials = { ...(c.testimonials || {}), items: ds.testimonials };
    if (yes(a.cform)) put("contactForm.on", true);
    if (yes(a.cform) || email || phone) show(c, "contact");
  } else if (kind === "store") {
    if (a.currency) put("settings.currency", a.currency);
    if (story) { put("portfolio.intro", story); put("home.hero.text", story.split(/(?<=[.!?])\s+/)[0] || story); }
    const cats = lines(a.cats);
    if (cats.length) {
      const slug = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "cat", base = c.categories?.[0] || { description: "", image: null };
      c.categories = cats.slice(0, 8).map((n) => ({ ...base, id: slug(n), name: n, description: "" }));
      (c.products || []).forEach((p: any, i: number) => { p.category = c.categories[i % c.categories.length].id; });
    }
    put("backend.accounts", yes(a.accounts)); put("backend.wishlist", yes(a.accounts));
    if (a.backend === "supabase") put("backend.provider", "supabase");
    if ((a.alertmail || "").trim()) put("orders.email", a.alertmail.trim());
    const num = (v?: string) => { const n = +String(v || "").replace(/[^\d.]/g, ""); return Number.isFinite(n) && n > 0 ? n : 0; };
    if (num(a.minorder)) put("settings.minOrder", num(a.minorder));
    if (a.ship?.trim()) put("settings.shippingFee", num(a.ship)); if (num(a.freeship)) put("settings.freeShippingOver", num(a.freeship));
    const where = many(a.deliver).map((x) => ({ city: city || "your city", state: "your state", india: "all over India", world: "worldwide" } as Record<string, string>)[x]).filter(Boolean);
    const pol = (id: string, title: string, text: string) => { const L = (c.policies = c.policies || []); const i = L.findIndex((x: any) => x.id === id); if (i >= 0) L[i] = { ...L[i], text }; else L.push({ id, title, text }); };
    if (where.length || a.dtime?.trim()) pol("shipping", "Shipping", [where.length ? `We deliver ${where.join(", ")}.` : "", a.dtime?.trim() ? `Delivery usually takes ${a.dtime.trim()}.` : ""].filter(Boolean).join(" "));
    if (a.returns?.trim()) pol("refunds", "Returns and refunds", a.returns.trim());
    if (a.gstin?.trim()) { put("footer.text", `${c.footer?.text || ""} GSTIN ${a.gstin.trim()}.`.trim()); }
    if (address) put("contact.address", address);
  } else if (kind === "business") {
    const yrNow = new Date().getFullYear(), fy = +(a.founded || "").replace(/\D/g, ""), ts = (a.teamsize || "").trim().replace(/[^\d+]/g, "");
    if (!(ds.stats?.length)) { const st: { value: string; label: string }[] = []; if (fy > 1900 && fy <= yrNow) st.push({ value: String(Math.max(1, yrNow - fy)) + "+", label: "Years in business" }); if (ts) st.push({ value: ts, label: "People in the team" }); if (st.length) { c.stats = { ...(c.stats || {}), items: st }; show(c, "stats"); } }
    if (fy > 1900 && fy <= yrNow) put("about.body", `${c.about?.body || ""}\n\nFounded in ${fy}.`.trim());
    const certs = lines(a.certs); if (certs.length) c.hero.badges = [...certs, ...usp].slice(0, 4);
    const offices = lines(a.offices); if (offices.length) { put("contact.address", offices.join("\n")); show(c, "contact"); }
    const f = many(a.enqfields); if (f.length) { const F = (c.contact.form = c.contact.form || {}); F.enabled = true; F.askPhone = f.includes("phone"); F.askCompany = f.includes("company"); F.askService = f.includes("service"); F.askBudget = f.includes("budget"); }
    const link = (a.booklink || "").trim(); if (a.cta === "book" && link) { for (const k of ["nav.cta", "hero.ctaPrimary", "cta.button"]) { const t = k.split(".")[0]; put(`${t}.${t === "hero" ? "ctaPrimaryTarget" : t === "nav" ? "ctaTarget" : "target"}`, "url"); put(`${t}.${t === "hero" ? "ctaPrimaryTargetUrl" : t === "nav" ? "ctaTargetUrl" : "targetUrl"}`, /^https?:/i.test(link) ? link : "https://" + link); } }
  } else {
    const bits = [a.ptype, a.foodtype, many(a.serves).join(" · ")].filter(Boolean) as string[];
    if (bits.length) c.hero.badges = [...bits, ...usp].slice(0, 4);
    const facts: { value: string; label: string }[] = [];
    if (a.cost?.trim()) facts.push({ value: "₹" + a.cost.trim().replace(/[^\d,]/g, ""), label: "For two" });
    if (a.foodtype) facts.push({ value: a.foodtype, label: "Food" });
    if (a.ptype) facts.push({ value: a.ptype, label: "Kind of place" });
    if (facts.length && !ds.stats?.length) { c.about = { ...(c.about || {}), facts }; }
    if (a.cost?.trim()) put("seo.priceRange", Number(a.cost.replace(/\D/g, "")) > 1500 ? "₹₹₹" : Number(a.cost.replace(/\D/g, "")) > 600 ? "₹₹" : "₹");
    const outlets = lines(a.outlets); if (outlets.length) { put("contact.address", outlets.join("\n")); show(c, "contact"); }
    if (yes(a.ordering)) { put("ordering.on", true); show(c, "order"); }
    if (yes(a.reserve)) {
      show(c, "reserve");
      if (a.reserveto === "email" && email) { put("contact.form.notify", true); put("contact.form.notifyTo", email); }
      if (a.reserveto === "link" && (a.booklink || "").trim()) { const l = a.booklink.trim(); put("hero.ctaPrimaryTarget", "url"); put("hero.ctaPrimaryTargetUrl", /^https?:/i.test(l) ? l : "https://" + l); }
    }
    if ((a.reviews || "").trim()) { const l = a.reviews.trim(), u = /^https?:/i.test(l) ? l : "https://" + l; c.footer.links = [{ label: "Reviews on Google", url: u }, ...(c.footer.links || [])]; }
  }
  applySections(kind, c, ds, (...ids) => show(c, ...ids));
  // The sections a person gave nothing for yet show a short note with an (Edit) link that goes to the answer.
  if (kind === "business") {
    if (!(items.length || ds.services?.length)) { c.services.items = [{ ...base0.service, title: "Your services", body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. (Edit:items)", points: [] }]; c.services.lede = ""; show(c, "services"); }
    if (!(workLines.length || ds.work?.length)) { c.work.items = [{ ...base0.work, title: `Your ${workWords(a).many}`, client: "", sector: "", summary: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. (Edit:work)", result: "", image: null, url: "" }]; c.work.lede = ""; show(c, "work"); }
    if (c.work) { c.work.eyebrow = "Our work"; c.work.title = workWords(a).title; }
  }
  if (kind === "business" || kind === "restaurant") {
    if (!(story || cp.about_text || about || ds.mission || ds.vision)) put("about.body", "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. (Edit:story)");
    show(c, "about");
  }
  { const lg = files?.logo || (/^https:\/\/image\.pollinations\.ai\//.test(a.logo || "") ? a.logo : ""); if (lg && kind !== "portfolio") put("brand.logo", { url: lg }); }
  if (kind === "restaurant" && files?.menu) { put("food.pdfUrl", "data:application/pdf;base64," + files.menu.b64); put("food.pdfLabel", "Download the menu (PDF)"); }
  if (theme) {
    const tt = tweakTheme(theme, a), lv = lookValues(kind, a.look, readDesignSettings());
    c.theme = { ...(c.theme || {}), ...tpl.themeValues(tt), ...lv };
    // Picture-side layouts and frames need a picture (otherwise that side stays empty): until they add one, a sample picture in the theme's colours stands in.
    const pal = { c1: tt.colors.c1, c2: tt.colors.c3 || tt.colors.c2, bg: tt.colors.surface }, subject = [a.btype, a.genre, a.ptype, a.about, a.name, kind === "store" ? "shop" : kind === "restaurant" ? "restaurant" : ""].filter(Boolean).join(" ");
    const gen = readDesignSettings().images, pic = (w = 1280, h = 1024) => (gen?.on ? generatedPicture(subject, name || about, gen.style, w, h) : defaultPicture(subject, pal));
    if ((kind === "business" || kind === "restaurant") && !c.hero?.image?.url && !c.hero?.video) put("hero.image", { url: pic() });
    if (kind === "store") { if (!c.home?.hero?.image) put("home.hero.image", { url: pic() }); if (c.home?.banner?.show && !c.home?.banner?.image) put("home.banner.image", { url: defaultPicture(subject + " gift", { ...pal, c1: pal.c2, c2: pal.c1 }, "scene", 2.4) }); }
    if (kind === "portfolio" && !c.hero?.photo) put("hero.photo", { url: defaultPicture("", pal, "person", 1) });
    // The pictures they chose replace the drawn ones.
    const mine = files?.pics || {};
    if (mine.photo?.[0] && kind === "portfolio") put("hero.photo", { url: mine.photo[0] });
    if (mine.bimage?.[0] && kind === "business") put("hero.image", { url: mine.bimage[0] });
    if (mine.banner?.[0] && kind === "store") { put("home.hero.image", { url: mine.banner[0] }); if (mine.banner[1]) { put("home.banner.show", true); put("home.banner.image", { url: mine.banner[1] }); } }
    if (mine.photos?.[0] && kind === "restaurant") { put("hero.image", { url: mine.photos[0] }); if (mine.photos.length > 1) { put("gallery.items", mine.photos.slice(1).map((u, i) => ({ image: { url: u }, caption: "", alt: `Photo ${i + 1}` }))); show(c, "gallery"); } }
  }
  return { kind, content: c, themeId: theme?.id || "", themeName: theme?.name || "", summary: tpl.summary(c) };
}
/** What the person's document says for each section of the website: it fills that section and shows it (sections the document says nothing about stay as they were). */
function applySections(kind: Kind, c: any, d: DocSections, show: (...ids: string[]) => void) {
  const has = (k: keyof DocSections) => { const v = (d as any)[k]; return Array.isArray(v) ? v.length > 0 : !!v; };
  const icons = (list: any[] | undefined, i: number, dflt: string) => (list && list.length ? list[i % list.length].icon : dflt);
  if (kind === "business") {
    if (has("services")) { const base = c.services.items; c.services.items = d.services!.map((e, i) => ({ ...base[i % base.length], title: e.title, body: e.body || e.title, points: e.bullets || [] })); c.services.lede = ""; show("services"); }
    if (has("stats")) { c.stats = { ...(c.stats || {}), items: d.stats }; show("stats"); }
    if (has("clients")) { c.clients = { ...(c.clients || {}), title: "Our clients", logos: d.clients!.map((n) => ({ name: n, logo: null })) }; show("clients"); }
    if (has("work")) { const base = c.work.items[0] || {}; c.work.items = d.work!.map((w) => ({ ...base, title: w.title, client: w.client, sector: "", summary: w.summary, result: w.result, image: null, url: "" })); c.work.lede = ""; show("work"); }
    if (has("process")) { c.process = { ...(c.process || {}), lede: "", steps: d.process!.map((e) => ({ title: e.title, body: e.body || "" })) }; show("process"); }
    if (has("team")) { c.team = { ...(c.team || {}), lede: "", members: d.team!.map((m) => ({ name: m.name, role: m.role, photo: null, linkedin: "" })) }; show("team"); }
    if (has("testimonials")) { c.testimonials = { ...(c.testimonials || {}), items: d.testimonials }; show("testimonials"); }
    if (has("pricing")) { c.pricing = { ...(c.pricing || {}), lede: "", plans: d.pricing!.map((p, i) => ({ name: p.name, price: p.price, period: p.period, blurb: p.blurb, features: p.features, cta: "Get in touch", featured: i === 1 })), note: "" }; show("pricing"); }
    if (has("faq")) { c.faq = { ...(c.faq || {}), items: d.faq }; show("faq"); }
    if (has("mission") || has("vision") || has("values")) { c.about = { ...(c.about || {}), mission: d.mission || "", vision: d.vision || "", values: (d.values || []).map((e) => ({ title: e.title, body: e.body || "" })) }; show("about"); }
  } else if (kind === "restaurant") {
    if (has("highlights")) { const base = c.highlights.items; c.highlights.items = d.highlights!.map((e, i) => ({ icon: icons(base, i, "flame"), title: e.title, body: e.body || "" })); show("highlights"); }
    if (has("offers")) { c.offers.items = d.offers!.map((o) => ({ title: o.title, body: o.body, when: o.when, price: o.price, code: "", image: null })); show("offers"); }
    if (has("events")) { const base = c.events.items; c.events.lede = ""; c.events.items = d.events!.map((e, i) => ({ icon: icons(base, i, "people"), title: e.title, body: e.body || "" })); show("events"); }
    if (has("team")) { c.chef = { ...(c.chef || {}), lede: "", members: d.team!.map((m) => ({ name: m.name, role: m.role, bio: m.bio, photo: null })) }; show("chef"); }
    if (has("clients")) { c.press = { ...(c.press || {}), logos: d.clients!.map((n) => ({ name: n, logo: null })) }; show("press"); }
    if (has("testimonials")) { c.testimonials = { ...(c.testimonials || {}), items: d.testimonials!.map((t) => ({ ...t, rating: "" })) }; show("testimonials"); }
    if (has("faq")) { c.faq = { ...(c.faq || {}), items: d.faq }; show("faq"); }
    if (has("stats")) { c.about = { ...(c.about || {}), facts: d.stats }; show("about"); }
  } else if (kind === "portfolio") {
    const COL = ["c1", "c2", "c3", "surface"], SHAPE = ["circle", "square", "diamond", "triangle"];
    if (has("experience")) { const base = c.work.items[0] || {}; c.work.items = d.experience!.map((x, i) => ({ ...base, period: x.period, title: x.title, org: x.org, orgNote: "", current: /present|now|current/i.test(x.period), color: COL[i % COL.length], image: null, bullets: x.bullets })); show("work"); }
    if (has("education") || has("languages")) { const base = c.learning.items[0] || {}; c.learning = { ...(c.learning || {}), items: has("education") ? d.education!.map((x, i) => ({ ...base, period: x.period, title: x.title, sub: x.sub, shape: SHAPE[i % SHAPE.length], color: COL[i % 3] })) : [], languages: d.languages || c.learning.languages }; show("learning"); }
    if (has("stats")) { c.about = { ...(c.about || {}), stats: d.stats!.map((x, i) => { const m = /^(\d[\d,.]*)\s*(\D*)$/.exec(x.value.replace(/,/g, "")); return { value: m ? +m[1] : 0, suffix: m ? m[2].trim() : x.value, label: x.label, color: COL[i % 3], shape: SHAPE[i % SHAPE.length] }; }) }; }
    if (has("skills") && !(c.skills?.items || []).length) { const base = c.skills.items[0] || {}; c.skills.items = d.skills!.map((e, i) => ({ ...base, tag: `${String(i + 1).padStart(2, "0")} / Skill`, title: e.title, body: e.body || "", detail: "", color: COL[i % 3], shape: SHAPE[i % SHAPE.length] })); show("skills"); }
  }
}


/** "“Great work.” – Priya Nair, CEO, Arcadia": the words, then who said them. */
function quotesOf(text: string | undefined): { quote: string; name: string; role: string; company: string }[] {
  return lines(text).map((l) => {
    const m = /^["“'‘]?(.{8,300}?)["”'’]?\s*(?:[-–—~]|\bby\b)\s*([^"”]{2,80})$/.exec(l); if (!m) return null;
    const [name, role, company] = m[2].split(",").map((x) => x.trim());
    return { quote: m[1].replace(/["“”]/g, "").trim(), name: name || "", role: role || "", company: company || "" };
  }).filter((x): x is { quote: string; name: string; role: string; company: string } => !!x && !!x.name);
}
/** "500+ customers", "Years: 12" or "98% - retention" as value and label. */
function statsOf(text: string | undefined): { value: string; label: string }[] {
  return lines(text).map((l) => {
    let m = /^(\d[\d,.]*\s?[%+kKxX×]?\+?)\s+(.{2,40})$/.exec(l); if (m) return { value: m[1].trim(), label: m[2].trim() };
    m = /^(.{2,40}?)\s*(?::|\s[-–—]\s)\s*(\d[\d,.]*\s?[%+kKxX×]?\+?)$/.exec(l); return m ? { value: m[2].trim(), label: m[1].trim() } : null;
  }).filter((x): x is { value: string; label: string } => !!x).slice(0, 6);
}
/** The long answers (typed in the chat) read the same way as a document's sections, so the same parts of the website fill from either. */
function typedSections(a: Answers): DocSections {
  const out: DocSections = {}, read = (heading: string, text: string | undefined) => (text?.trim() ? (readSections(heading + "\n" + text) as any) : {});
  const kind = a.kind as Kind;
  if (kind === "portfolio") { const e = read("Experience", a.exp).experience, d = read("Education", a.edu).education, t = quotesOf(a.quotes); if (e?.length) out.experience = e; if (d?.length) out.education = d.map((x: any) => ({ ...x, sub: String(x.sub || "").replace(/[,;.\s]+$/, "") })); if (t.length) out.testimonials = t; }
  if (kind === "business") {
    const st = statsOf(a.stats), t = quotesOf(a.quotes), tm = read("Team", a.team).team, cl = read("Clients", a.clients).clients;
    if (st.length) out.stats = st; if (t.length) out.testimonials = t; if (tm?.length) out.team = tm; if (cl?.length) out.clients = cl;
    const ml = (a.mission || "").trim();
    if (ml) { const v = /(?:^|\n)\s*vision\s*[:\-–—]\s*(.+)/i.exec(ml), m = ml.replace(/(?:^|\n)\s*vision\s*[:\-–—].*/i, "").replace(/^\s*mission\s*[:\-–—]\s*/i, "").trim(); if (m) out.mission = m; if (v) out.vision = v[1].trim(); }
  }
  if (kind === "restaurant") { const o = lines(a.specials).map((l) => { const m = /^(.{2,70}?)\s*(?:[-–—:]\s*)?(?:₹|rs\.?\s*)?(\d[\d,]*)\s*$/i.exec(l), pct = /\b(\d+\s?%\s*off)\b/i.exec(l); return { title: (m ? m[1] : l).trim(), body: "", when: "", price: m ? "₹" + m[2].replace(/,/g, "") : pct ? pct[1] : "" }; }); if (o.length) out.offers = o; }
  return out;
}

const show = (c: any, ...ids: string[]) => { for (const x of c.sections || []) if (ids.includes(x.id)) { if ("visible" in x) x.visible = true; else x.show = true; } };

/** The topics the person gave, as plain names (prices removed). */
export const topicsOf = (a: Answers) => lines(a.items).map((l) => priced(l).name);

/** Written text from the Picaffectz system, on this device: no AI service. It uses only what the person said. */
/** A short line for each offering from the owner's own words: the offering, then one of their highlights, else the opening of their story, else their About line. */
function topicLine(n: string, i: number, a: Answers, name: string, tail: string): string {
  const usp = lines(a.usp), first = ((a.story || "").trim().split(/(?<=[.!?])\s+/)[0] || "").trim(), about = cap((a.about || "").trim());
  const end = (x: string) => (/[.!?]$/.test(x.trim()) ? x.trim() : x.trim() + ".");
  const tie = usp.length ? usp[i % usp.length] : first && first.length <= 110 ? first : "";
  if (tie) return `${end(n + (name && name !== "We" ? " by " + name : ""))} ${end(tie)}`.slice(0, 220);
  if (about) return `${n} from ${name !== "We" ? name : "us"}, ${about.charAt(0).toLowerCase() + about.slice(1)}${a.city ? " in " + a.city : ""}.`.slice(0, 220);
  return `${n}, ${tail}`;
}
export function systemCopy(a: Answers): Copy {
  const kind = k(a), name = (a.name || "").trim() || "We", notes = [a.about, a.city ? "in " + a.city : "", a.story, (a.doctext || "").slice(0, 1200)].filter(Boolean).join(". ");
  let b: any = {};
  try { b = systemWrite({ brand: name, notes, kind, text: [a.about, a.story, a.usp, (a.doctext || "").slice(0, 1200)].filter(Boolean).join("\n") }).brief; } catch { /* a plain fallback below */ }
  const tail: Record<Kind, string> = { portfolio: "done with care and attention to detail.", store: "chosen and made with care.", business: "done properly and explained clearly.", restaurant: "made fresh and served warm." };
  const out: Copy = {
    ...(b.brand_tagline ? { tagline: b.brand_tagline } : {}), ...(b.hero_text ? { hero_text: b.hero_text } : {}), ...(b.cta_text ? { cta_text: b.cta_text } : {}),
    about_text: ((a.story || "").trim() || b.about_text || "").slice(0, 900) || undefined,
    ...(b.services_intro ? { services_text: String(b.services_intro) } : {}),
    ...((a.work || "").trim() ? { work_text: `Projects delivered${name === "We" ? "" : " by " + name}: ${(a.work || "").split("\n").map((x) => x.split(/\s*(?::|\s[-–—]\s)/)[0].trim()).filter(Boolean).slice(0, 6).join(", ")}. Each one is shown below.` } : {}),
    items: topicsOf(a).map((n, i) => ({ name: n, text: topicLine(n, i, a, name, tail[kind]) })),
    ...(Array.isArray(b.faq) && b.faq.length ? { faq: b.faq.slice(0, 4).map((x: any) => ({ q: String(x.q), a: String(x.a) })) } : {}),
  };
  if (kind === "portfolio") delete out.faq;
  return out;
}
/** The text for each topic: written by the Studio's own AI engine through its database when that is set up, otherwise by the Picaffectz system here. */
export async function writeCopy(a: Answers, host: { api: string; studio: string } | null): Promise<{ copy: Copy; engine: string }> {
  if (host) {
    try {
      const r = await fetch(host.api.replace(/\/+$/, "") + "/dq/write/" + encodeURIComponent(host.studio), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: a.kind, brand: a.name, about: a.about, city: a.city, story: a.story, usp: a.usp, doc: a.doctext || "", items: topicsOf(a), work: (a.work || "").split("\n").map((x) => x.trim()).filter(Boolean) }) });
      if (r.ok) { const j = await r.json(); if (j?.copy && Object.keys(j.copy).length) return { copy: j.copy, engine: j.engine }; }
    } catch { /* the Picaffectz system writes instead */ }
  }
  return { copy: systemCopy(a), engine: "system" };
}

/** What Picaffectz needs to know, as a short message (for WhatsApp or email). */
export function requestText(a: Answers, d: Design | null, link = ""): string {
  const kindName = KIND_OPTIONS.find((o) => o.v === a.kind)?.label || a.kind || "";
  const say = (id: string) => { const s = stepOf(id, a); return a[id] ? sayAnswer(s, a) : ""; };
  const row = (label: string, v: string) => (v ? `${label}: ${v}` : "");
  return [
    "Hi Picaffectz, I designed a website preview and would like to take it forward.", "",
    row("Type", kindName), row("Name", a.name || ""), row("What I do", a.about || ""), row("City", a.city || ""),
    row("Feel", say("style")), row("Colour", say("colour")), row("Includes", (a.items || "").split("\n").filter(Boolean).join(", ")), row("Work delivered", (a.work || "").split("\n").filter(Boolean).join(" · ")), row("Visitors can", say("goal")),
    row("Phone", a.phone || ""), row("Email", a.email || ""), row("Document", a.doc || ""), row("LinkedIn", a.linkedin || ""), row("Document link", a.doclink || ""), row("Chosen look", [a.theme, a.accent, a.mode].filter(Boolean).join(" · ")), d ? row("Design", `${d.themeName} (${d.themeId})`) : "", link ? "Preview: " + link : "",
  ].filter((x, i, all) => x || (i > 0 && all[i - 1])).join("\n");
}

/** Every theme of a type, whether or not the Studio's owner offers it (for the owner's settings). */
export const allThemesOf = (kind: Kind): Theme[] => myThemesOf(kind);
