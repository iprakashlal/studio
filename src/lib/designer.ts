// "Design yourself": a plain-language question flow that builds a preview website for any of the four types.
// Nothing here is published: the result is a preview (kept on this device, and in the Studio when signed in).
import { THEMES, type Theme } from "../themes/catalog";
import { BIZ_THEMES } from "../themes/business";
import { REST_THEMES } from "../themes/restaurant";
import { TEMPLATES } from "../schema";
import { loadStarter } from "./exporter";
import { systemWrite } from "./syswrite";
import { readDesignSettings, type Copy } from "./designs";
import { lookValues, readColsAnswer } from "./designlook";

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
};

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
/** A short name for each question (for the answers shown above the current question). */
export const STEP_LABEL: Record<string, string> = { kind: "Type", doc: "Starting point", name: "Name", about: "About", city: "City", logo: "Logo", style: "Feel", colour: "Colour", pages: "Pages", story: "Story", items: "Offerings", usp: "Highlights", goal: "Goal", menu: "Menu", hours: "Hours", address: "Address", social: "Social", phone: "Phone", email: "Email" };

export const KIND_OPTIONS: Opt[] = [
  { v: "portfolio", label: "A website about me", hint: "Show my work, skills and story. Good for designers, developers, photographers, creators." },
  { v: "store", label: "An online shop", hint: "Sell products with a cart and orders on WhatsApp or by UPI." },
  { v: "business", label: "A website for my business", hint: "Explain my services and let customers get in touch." },
  { v: "restaurant", label: "A restaurant or café site", hint: "Menu, opening hours, table booking and orders." },
];

export const STYLE_OPTIONS: Opt[] = [
  { v: "clean", label: "Clean and simple" },
  { v: "bold", label: "Bold and colourful" },
  { v: "elegant", label: "Elegant and premium" },
  { v: "dark", label: "Dark and modern" },
  { v: "warm", label: "Warm and friendly" },
  { v: "fun", label: "Playful and fun" },
];
export const COLOUR_OPTIONS: Opt[] = [
  { v: "blue", label: "Blue" }, { v: "green", label: "Green" }, { v: "red", label: "Red" }, { v: "orange", label: "Orange" },
  { v: "purple", label: "Purple" }, { v: "pink", label: "Pink" }, { v: "gold", label: "Gold" }, { v: "mono", label: "Black and white" }, { v: "any", label: "Surprise me" },
];
export const COLOUR_DOT: Record<string, string> = { blue: "#3b82f6", green: "#22a06b", red: "#e5484d", orange: "#f08a24", purple: "#8b5cf6", pink: "#ec4899", gold: "#d4a017", mono: "#222222", any: "linear-gradient(135deg,#3b82f6,#ec4899,#f08a24)" };

export const STEPS: Step[] = [
  { id: "kind", type: "choice", ask: () => "Hi! Let's design your website together. What kind of website do you want?", options: () => KIND_OPTIONS },
  {
    id: "doc", type: "file", optional: true, accept: "application/pdf", maxKB: 4000,
    ask: (a) => by(a, { portfolio: "Do you already have your details somewhere? Add a PDF (resume, profile) or paste a link, and we'll fill in what we can.", store: "Do you already have your products somewhere? Add a PDF (catalogue, price list) or paste your website or Instagram link, and we'll fill in what we can.", business: "Do you already have your details somewhere? Add a PDF (brochure, profile, price list) or paste your website link, and we'll fill in what we can.", restaurant: "Do you already have your menu or details somewhere? Add a PDF or paste your website or Instagram link, and we'll fill in what we can." }),
    ph: () => "Paste a link, e.g. https://yourname.com",
    help: () => "We only use what is written there, and we won't ask again for what we find. You can skip this.",
  },
  {
    id: "name", type: "text",
    ask: (a) => by(a, { portfolio: "What's your name?", store: "What is your shop called?", business: "What is your business called?", restaurant: "What is your restaurant or café called?" }),
    ph: (a) => by(a, { portfolio: "e.g. Asha Verma", store: "e.g. Kala Ghar", business: "e.g. Verma & Co", restaurant: "e.g. The Tiffin Box" }),
  },
  {
    id: "about", type: "text",
    ask: (a) => by(a, { portfolio: "In a few words, what do you do?", store: "What do you sell?", business: "What does your business do?", restaurant: "What kind of food do you serve?" }),
    ph: (a) => by(a, { portfolio: "e.g. Wedding photographer", store: "e.g. Handmade candles and gifts", business: "e.g. We repair and service home appliances", restaurant: "e.g. Home-style South Indian meals" }),
    help: () => "One short line is enough. You can change it later.",
  },
  { id: "city", type: "text", optional: true, ask: () => "Which city are you in?", ph: () => "e.g. Mumbai", help: () => "Skip it if you work online or don't want to show it." },
  { id: "logo", type: "file", optional: true, accept: "image/png,image/jpeg,image/webp", maxKB: 4000, when: (a) => k(a) !== "portfolio", ask: () => "Do you have a logo? Add it here, or skip and we'll use your name.", help: () => "A PNG or JPG picture. You can send a better one later." },
  { id: "style", type: "choice", ask: () => "How should your website feel?", options: () => STYLE_OPTIONS },
  { id: "colour", type: "choice", ask: () => "Which colour do you like best?", options: () => COLOUR_OPTIONS },
  {
    id: "pages", type: "choice", when: (a) => k(a) === "business" || k(a) === "restaurant",
    ask: () => "Should your website be one long page, or have separate pages (Home, About, Contact…)?",
    options: () => [{ v: "single", label: "One page", hint: "Everything on one page you scroll down." }, { v: "multi", label: "Separate pages", hint: "Each topic gets its own page." }],
  },
  {
    id: "story", type: "long", optional: true,
    ask: (a) => by(a, { portfolio: "Tell us about yourself in a few lines: where you started and what you enjoy most.", store: "How did your shop start? Tell us your story in a few lines.", business: "Tell us about your business in a few lines: how it started and who you help.", restaurant: "Tell us your story in a few lines: how the place started and what makes the food yours." }),
    ph: () => "Write it the way you'd tell a friend.",
    help: () => "We'll tidy it into proper website text. Skip it and we'll write something simple from your answers.",
  },
  {
    id: "items", type: "long",
    ask: (a) => by(a, {
      portfolio: "List up to 6 things you are good at. Write one on each line.",
      store: "Name some products you sell, one on each line. You can add a price after a dash.",
      business: "What are your main services? Write one on each line.",
      restaurant: "Name your best dishes, one on each line. You can add a price after a dash.",
    }),
    ph: (a) => by(a, { portfolio: "Portraits\nWeddings\nProduct shoots", store: "Soy candle - 450\nGift box - 899\nIncense set - 299", business: "Repairs\nAnnual service\nInstallation", restaurant: "Masala dosa - 120\nFilter coffee - 60\nThali - 250" }),
    help: () => "Press Enter for a new line. We'll write a short line about each one.",
    optional: (a) => k(a) !== "store",
  },
  { id: "usp", type: "long", optional: true, ask: () => "What makes you different from others? Write one thing on each line.", ph: () => "Same-day delivery\nFamily recipes\nFree first consultation", help: () => "Only things that are true. They appear as highlights on your site." },
  {
    id: "goal", type: "many",
    ask: (a) => by(a, { portfolio: "What should visitors do on your website?", store: "How will customers pay you?", business: "How should customers reach you?", restaurant: "What should guests be able to do?" }),
    help: () => "Tap everything that applies. The first one you tap becomes the main button.",
    options: (a) => by<Opt[]>(a, {
      portfolio: [{ v: "work", label: "See my work" }, { v: "hire", label: "Hire me" }, { v: "story", label: "Read my story" }, { v: "contact", label: "Message me" }],
      store: [{ v: "upi", label: "UPI" }, { v: "cod", label: "Cash on delivery" }, { v: "whatsapp", label: "Send the order on WhatsApp" }, { v: "card", label: "Card payment link" }],
      business: [{ v: "quote", label: "Ask for a quote" }, { v: "call", label: "Call us" }, { v: "book", label: "Book a visit" }, { v: "whatsapp", label: "WhatsApp us" }],
      restaurant: [{ v: "table", label: "Book a table" }, { v: "order", label: "Order food online" }, { v: "menu", label: "See the menu" }, { v: "event", label: "Plan a party" }],
    }),
  },
  { id: "menu", type: "file", optional: true, accept: "application/pdf", maxKB: 1200, when: (a) => k(a) === "restaurant", ask: () => "Do you have your menu as a PDF? Add it here, or skip.", help: () => "A PDF up to 1.2 MB. Visitors can download it from your site." },
  { id: "hours", type: "text", optional: true, when: (a) => k(a) === "business" || k(a) === "restaurant", ask: () => "When are you open?", ph: () => "e.g. Monday to Saturday, 10 am to 7 pm", help: () => "Skip it if you don't want to show hours." },
  { id: "address", type: "text", optional: true, when: (a) => k(a) !== "portfolio", ask: () => "What is your full address?", ph: () => "e.g. 12 MG Road, Bengaluru 560001", help: () => "Shown on your contact page. Skip it if you work from home or online." },
  { id: "social", type: "text", optional: true, ask: () => "Do you have an Instagram or another page to link? Paste the link or your @name.", ph: () => "e.g. @yourname or https://instagram.com/yourname" },
  { id: "phone", type: "text", optional: true, ask: () => "What phone or WhatsApp number should customers see?", ph: () => "e.g. +91 98765 43210", help: () => "It is shown on the website. Skip if you'd rather not." },
  { id: "email", type: "text", optional: true, ask: () => "And your email address?", ph: () => "e.g. hello@yourname.com", help: () => "Skip if you'd rather not." },
];

/** The steps still to ask, in order. */
export const nextStep = (a: Answers): Step | null => STEPS.find((s) => (s.when ? s.when(a) : true) && !(s.id in a)) || null;
export const stepOf = (id: string) => STEPS.find((s) => s.id === id)!;

/** How an answer reads back to the person (their own chat bubble). */
export function sayAnswer(s: Step, a: Answers): string {
  const v = a[s.id]; if (!v) return "Skip";
  const src = (a.docfrom || "").split(",").includes(s.id) ? " (from your document)" : "";
  if (s.type === "file") return s.id === "logo" ? "Logo added" : s.id === "doc" ? (a.doclink ? `Link: ${v}` : `PDF: ${v}`) : `Menu added: ${v}`;
  if (s.id === "pages") return v === "multi" ? "Separate pages" : "One page";
  if (s.id === "kind") return KIND_OPTIONS.find((o) => o.v === v)?.label || v;
  if (s.type === "choice") return [...STYLE_OPTIONS, ...COLOUR_OPTIONS].find((o) => o.v === v)?.label || v;
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
  if (!a.items) {
    if ((kind === "store" || kind === "restaurant") && priced.length >= 2) out.items = priced.map((m) => `${m[1].trim()} - ${m[2].replace(/,/g, "")}`).join("\n");
    else if (bullets.length >= 3) out.items = bullets.join("\n");
    else if (best.length >= 3 && best.length <= 8) out.items = best.join("\n");
  }
  const prose = ls.filter((l) => l.length >= 45 && /[a-z]/.test(l) && !used.has(l) && !/@|https?:\/\//.test(l) && !/^[•●▪◦\-–*]\s/.test(l)).join(" ");
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
};
const hash = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
function poolOf(kind: Kind): Theme[] { return kind === "business" ? BIZ_THEMES : kind === "restaurant" ? REST_THEMES : THEMES; }
/** The themes the Studio's owner offers (all of them unless the owner picked some). */
function offered(kind: Kind): Theme[] { const al = readDesignSettings().themes?.[kind], all = poolOf(kind), l = al?.length ? all.filter((t) => al.includes(t.id)) : all; return l.length ? l : all; }

/** A plain sample picture (soft shapes in the theme's colours) for previews that have no photo yet. */
const samplePicture = (c1: string, c2: string, bg: string) => "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 640"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="800" height="640" fill="${bg}"/><rect width="800" height="640" fill="url(#g)" opacity=".85"/><circle cx="560" cy="190" r="120" fill="#fff" opacity=".22"/><circle cx="250" cy="430" r="190" fill="#000" opacity=".12"/><path d="M0 520C160 440 300 560 460 500S700 420 800 470V640H0Z" fill="#fff" opacity=".2"/></svg>`);

/** The theme that best matches the feel and colour chosen; the person's name picks between near ties so two people don't get the same one. */
export function pickTheme(a: Answers): Theme | null {
  const kind = k(a), pool = offered(kind); if (!pool.length) return null;
  const chosen = a.theme && poolOf(kind).find((t) => t.id === a.theme); if (chosen) return chosen;
  const st = STYLE_TAGS[a.style || "clean"] || STYLE_TAGS.clean, col = a.colour || "any";
  const scored = pool.map((t) => {
    let s = st.want.reduce((n, tag, i) => n + (t.tags.includes(tag) ? 6 - Math.min(i, 4) : 0), 0);
    if (st.dark && t.dark) s += 8; if (st.dark && !t.dark) s -= 8; if (st.light && !t.dark) s += 4;
    if (!st.dark && t.dark && a.style !== "bold" && a.style !== "elegant") s -= 3;
    const c = hsl(t.colors.c1);
    if (col === "mono") s += c.s < 0.15 ? 10 : -c.s * 10;
    else if (col !== "any") { const d = Math.min(Math.abs(c.h - HUE[col]), 360 - Math.abs(c.h - HUE[col])); s += c.s < 0.2 ? -6 : Math.max(-8, 10 - d / 9); }
    if (kind === "store" && t.tags.includes("Products")) s += 2;
    return { t, s };
  }).sort((x, y) => y.s - x.s);
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
const goals = (a: Answers) => (a.goal || "").split(",").filter(Boolean);

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
export type DesignFiles = { logo?: string; menu?: { name: string; b64: string } };

const urlOf = (v: string) => { const t = v.trim(); if (!t) return ""; if (/^@?[\w.]{2,30}$/.test(t)) return "https://instagram.com/" + t.replace(/^@/, ""); return /^https?:\/\//i.test(t) ? t : /^[\w-]+(\.[\w-]+)+/.test(t) ? "https://" + t : ""; };

/** The website so far, from the answers so far (whatever isn't answered keeps its sample wording). `copy` is the written text for each topic. */
export async function buildDesign(a: Answers, copy?: Copy | null, files?: DesignFiles | null): Promise<Design | null> {
  if (!a.kind || !TEMPLATES[a.kind]) return null;
  const kind = a.kind as Kind, tpl = TEMPLATES[kind], c: any = clone(await starter(kind)); tpl.prepare?.(c); c.festival = { ...(c.festival || {}), on: false }; // the festival overlay would hide the first screen of a preview
  const name = (a.name || "").trim(), about = cap((a.about || "").trim()), city = (a.city || "").trim(), g = goals(a), items = lines(a.items), usp = lines(a.usp), story = (a.story || "").trim();
  const phone = (a.phone || "").trim(), email = (a.email || "").trim(), address = (a.address || "").trim(), hours = (a.hours || "").trim(), social = urlOf(a.social || "");
  const theme = pickTheme(a), cp: Copy = copy || {}, noteOf = (n: string) => cp.items?.find((x) => x.name.toLowerCase() === n.toLowerCase())?.text || "";
  if (name) rebrand(c, "Picaffectz", name);
  const put = (path: string, v: any) => { const ks = path.split("."); let o = c; for (const x of ks.slice(0, -1)) { if (!o[x] || typeof o[x] !== "object") o[x] = {}; o = o[x]; } o[ks[ks.length - 1]] = v; };
  const seo = () => { if (name) put("seo.title", about ? `${name} · ${about}` : name); if (about) put("seo.description", `${about}${city ? " in " + city : ""}.`); };
  const aboutText = cp.about_text || story;

  if (kind === "portfolio") {
    if (name) { const p = name.split(/\s+/); put("hero.firstName", p[0]); put("hero.lastName", p.slice(1).join(" ")); put("brand.logoText", name); put("contact.footerLeft", `© ${new Date().getFullYear()} ${name}`); }
    if (about) { put("hero.eyebrow", about + (city ? " · " + city : "")); put("hero.role", `I'm a ${about.toLowerCase()}${city ? " based in " + city : ""}. *Let's make something good together.*`); put("seo.description", `Portfolio of ${name || "me"}: ${about.toLowerCase()}.`); }
    if (cp.hero_text) put("hero.role", cp.hero_text);
    if (items.length >= 3) c.skills.items = items.slice(0, 6).map((t, i) => ({ ...c.skills.items[i % c.skills.items.length], tag: `${String(i + 1).padStart(2, "0")} / Skill`, title: t, body: noteOf(t), detail: "" }));
    const first: Record<string, [string, string]> = { work: ["See my work ↓", "work"], hire: ["Hire me", "contact"], story: ["Read my story ↓", "about"], contact: ["Message me", "contact"] };
    if (g[0] && first[g[0]]) { put("hero.ctaPrimary", first[g[0]][0]); put("hero.ctaPrimaryTarget", first[g[0]][1]); }
    if (email) { put("contact.email", email); c.contact.links = (c.contact.links || []).filter((l: any) => !/linkedin/i.test(l.label)); }
    else c.contact.links = (c.contact.links || []).filter((l: any) => !/linkedin\.com\/?$/.test(l.url));
    if (social) c.contact.links = [...(c.contact.links || []), { label: /instagram/.test(social) ? "Instagram" : "My page", url: social }];
    if (cp.cta_text) put("contact.body", cp.cta_text);
    put("hero.ctaSecondary", ""); put("hero.ctaSecondaryUrl", "");
    seo();
  } else if (kind === "store") {
    if (name) put("brand.name", name);
    if (about) { put("brand.tagline", cp.tagline || about); put("home.hero.text", cp.hero_text || about + "."); put("shop.intro", `Everything from ${name || "our shop"}, in one place.`); put("portfolio.intro", aboutText || about + "."); }
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
    if (about) { put("brand.tagline", cp.tagline || about); put("hero.title", about + "."); put("hero.lede", cp.hero_text || `${name || "We"}${city ? ", " + city : ""}. Get in touch and we'll take it from there.`); put("about.body", aboutText || `${about}.`); put("cta.body", cp.cta_text || `Tell us what you need and we'll get back to you.`); }
    if (city) { put("hero.eyebrow", city); put("contact.address", city); } else put("hero.eyebrow", "");
    c.hero.badges = usp.slice(0, 4);
    if (items.length) c.services.items = items.slice(0, 6).map((t, i) => ({ ...c.services.items[i % c.services.items.length], title: t, body: noteOf(t) || `${t}${name ? " by " + name : ""}.`, points: [] }));
    const cta: Record<string, [string, string]> = { quote: ["Ask for a quote", "contact"], call: ["Call us", "contact"], book: ["Book a visit", "contact"], whatsapp: ["WhatsApp us", "contact"] };
    if (g[0] && cta[g[0]]) { put("nav.cta", cta[g[0]][0]); put("hero.ctaPrimary", cta[g[0]][0]); put("cta.button", cta[g[0]][0]); }
    if (phone) { put("contact.phone", phone); put("contact.whatsapp", digits(phone)); }
    if (email) put("contact.email", email);
    put("footer.text", about ? `${name}. ${about}.` : name);
    seo();
  } else {
    if (name) put("brand.name", name);
    if (about) { put("brand.tagline", cp.tagline || about); put("hero.eyebrow", about + (city ? " · " + city : "")); put("hero.lede", cp.hero_text || `${about}. Come hungry.`); put("about.body", aboutText || `${name || "We"} serve ${about.toLowerCase()}${city ? " in " + city : ""}.`); put("cta.body", cp.cta_text || "Book a table, or call us for takeaway."); }
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
  if (kind === "business") { hideIf(!items.length, "services"); hideIf(!(story || cp.about_text), "about"); hideIf(!(phone || email || address || city || hours), "contact"); }
  if (kind === "restaurant") { hideIf(!items.length, "specials"); hideIf(!(story || cp.about_text), "about"); hideIf(!(phone || email || address || city || hours), "contact"); }

  // What only some types and answers add (after the starter's made-up parts are cleared).
  if (kind === "business" || kind === "restaurant") {
    if (address || city) put("contact.address", address || city);
    if (a.pages) put("site.multiPage", a.pages === "multi");
    if (social) c.footer.links = [{ label: /instagram/.test(social) ? "Instagram" : "Find us online", url: social }, ...(c.footer.links || [])];
    if (cp.faq?.length && items.length >= 2) { put("faq.items", cp.faq); show(c, "faq"); }
  }
  if (kind === "business" && hours) put("contact.hours", hours);
  if (kind === "restaurant" && hours) { put("hours.note", hours); put("hours.days", []); put("hours.showStatus", false); }
  if (files?.logo && kind !== "portfolio") put("brand.logo", { url: files.logo });
  if (kind === "restaurant" && files?.menu) { put("food.pdfUrl", "data:application/pdf;base64," + files.menu.b64); put("food.pdfLabel", "Download the menu (PDF)"); }
  if (theme) {
    const tt = tweakTheme(theme, a), lv = lookValues(kind, a.look, readDesignSettings());
    c.theme = { ...(c.theme || {}), ...tpl.themeValues(tt), ...lv };
    // A picture frame only shows around a picture: until they add one, a sample picture in the theme's colours stands in.
    if ((kind === "business" || kind === "restaurant") && lv.heroArt && lv.heroArt !== "default" && !c.hero?.image?.url && !c.hero?.video) put("hero.image", { url: samplePicture(tt.colors.c1, tt.colors.c3 || tt.colors.c2, tt.colors.surface) });
  }
  return { kind, content: c, themeId: theme?.id || "", themeName: theme?.name || "", summary: tpl.summary(c) };
}
const show = (c: any, ...ids: string[]) => { for (const x of c.sections || []) if (ids.includes(x.id)) { if ("visible" in x) x.visible = true; else x.show = true; } };

/** The topics the person gave, as plain names (prices removed). */
export const topicsOf = (a: Answers) => lines(a.items).map((l) => priced(l).name);

/** Written text from the Picaffectz system, on this device: no AI service. It uses only what the person said. */
export function systemCopy(a: Answers): Copy {
  const kind = k(a), name = (a.name || "").trim() || "We", notes = [a.about, a.city ? "in " + a.city : "", a.story, (a.doctext || "").slice(0, 1200)].filter(Boolean).join(". ");
  let b: any = {};
  try { b = systemWrite({ brand: name, notes, kind, text: [a.about, a.story, a.usp, (a.doctext || "").slice(0, 1200)].filter(Boolean).join("\n") }).brief; } catch { /* a plain fallback below */ }
  const tail: Record<Kind, string> = { portfolio: "done with care and attention to detail.", store: "chosen and made with care.", business: "done properly and explained clearly.", restaurant: "made fresh and served warm." };
  const out: Copy = {
    ...(b.brand_tagline ? { tagline: b.brand_tagline } : {}), ...(b.hero_text ? { hero_text: b.hero_text } : {}), ...(b.cta_text ? { cta_text: b.cta_text } : {}),
    about_text: [(a.story || "").trim(), b.about_text].filter(Boolean).join("\n\n").slice(0, 900) || undefined,
    items: topicsOf(a).map((n) => ({ name: n, text: `${n}, ${tail[kind]}` })),
    ...(Array.isArray(b.faq) && b.faq.length ? { faq: b.faq.slice(0, 4).map((x: any) => ({ q: String(x.q), a: String(x.a) })) } : {}),
  };
  if (kind === "portfolio") delete out.faq;
  return out;
}
/** The text for each topic: written by the Studio's own AI engine through its database when that is set up, otherwise by the Picaffectz system here. */
export async function writeCopy(a: Answers, host: { api: string; studio: string } | null): Promise<{ copy: Copy; engine: string }> {
  if (host) {
    try {
      const r = await fetch(host.api.replace(/\/+$/, "") + "/dq/write/" + encodeURIComponent(host.studio), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: a.kind, brand: a.name, about: a.about, city: a.city, story: a.story, usp: a.usp, doc: a.doctext || "", items: topicsOf(a) }) });
      if (r.ok) { const j = await r.json(); if (j?.copy && Object.keys(j.copy).length) return { copy: j.copy, engine: j.engine }; }
    } catch { /* the Picaffectz system writes instead */ }
  }
  return { copy: systemCopy(a), engine: "system" };
}

/** What Picaffectz needs to know, as a short message (for WhatsApp or email). */
export function requestText(a: Answers, d: Design | null, link = ""): string {
  const kindName = KIND_OPTIONS.find((o) => o.v === a.kind)?.label || a.kind || "";
  const say = (id: string) => { const s = stepOf(id); return a[id] ? sayAnswer(s, a) : ""; };
  const row = (label: string, v: string) => (v ? `${label}: ${v}` : "");
  return [
    "Hi Picaffectz, I designed a website preview and would like to take it forward.", "",
    row("Type", kindName), row("Name", a.name || ""), row("What I do", a.about || ""), row("City", a.city || ""),
    row("Feel", say("style")), row("Colour", say("colour")), row("Includes", (a.items || "").split("\n").filter(Boolean).join(", ")), row("Visitors can", say("goal")),
    row("Phone", a.phone || ""), row("Email", a.email || ""), row("Document", a.doc || ""), row("Document link", a.doclink || ""), row("Chosen look", [a.theme, a.accent, a.mode].filter(Boolean).join(" · ")), d ? row("Design", `${d.themeName} (${d.themeId})`) : "", link ? "Preview: " + link : "",
  ].filter((x, i, all) => x || (i > 0 && all[i - 1])).join("\n");
}

/** Every theme of a type, whether or not the Studio's owner offers it (for the owner's settings). */
export const allThemesOf = (kind: Kind): Theme[] => poolOf(kind);
