/* Events runtime. Renders every page of an event's website from content.json: the event's date, countdown,
   schedule, line-up, tickets, venue and gallery, and the registration page (register.html).
   One page with all sections, or several pages (Home, Schedule, Line-up, About, Contact).
   Registrations and messages are saved where the site keeps its enquiries (hosted sites, or the form's own
   settings), otherwise they open the visitor's email app addressed to the organiser. */
(() => {
"use strict";
/* Code Update (content.code): when a site runs its own copy of this code, SiteCode (fx.js) takes the page over before
   anything is drawn. Inside that copy SiteCode is empty, so the copy never hands over again. */
const SC = typeof SiteCode === "undefined" || !SiteCode ? null : SiteCode;
if (SC) SC.track();

/* ============================================================
   DEFAULT CONTENT (also exported as content.json)
   ============================================================ */
const DEFAULT = {
  theme: {"cursor": "none", "loader": "fade", "textfx": "words", "hoverfx": "shine", "scrollfx": "smooth", "overlay": "vignette", "herofx": "breathe", "loaderOn": "both", "introTitle": "", "introFont": "display", "introCase": "upper", "logoRadius": 22, "scrollEase": "light", "lineBreaks": "typed", "bg": "#F1F3F8", "surface": "#FFFFFF", "deep": "#121B30", "text": "#101728", "soft": "#555C6D", "line": "#D7DBE5", "c1": "#1F47A3", "c2": "#4C2C8C", "c3": "#E2D828", "fontDisplay": "Manrope", "fontBody": "Inter", "radius": 6, "preset": "evt-conference-04", "layout": "center", "heroArt": "coupon", "nav": "island", "cards": "glass", "buttons": "pill", "heading": "serif", "shead": "line", "pattern": "lines", "bands": "stripe", "motionStyle": "rise", "width": "xwide", "motif": "studio", "introBg": "#121B30", "introFg": "#FFFFFF", "sched": "cards", "lineup": "tilt", "tix": "band", "count": "inline", "dateBadge": "stamp", "reg": "accent", "flow": "programme", "high": "list", "stat": "top", "about": "centre", "faq": "two", "cta": "centre", "quote": "bubble", "regKind": "delegate"},
  cms: { adminPage: "admin" },
  poweredBy: { show: true },
  settings: { currency: "INR" },
  brand: { name: "Horizon Summit", tagline: "Two days of ideas for people who build what's next", logo: null, showName: true },
  site: { multiPage: false, crumbs: true, pageLabels: { home: "Home", schedule: "Schedule", lineup: "Speakers", about: "About", contact: "Contact", register: "Register" } },
  nav: { cta: "Register", ctaTarget: "register", ctaTargetUrl: "" },
  event: { type: "Conference", date: "2027-03-12", time: "09:30", endDate: "2027-03-13", endTime: "18:00", dateText: "", venue: "Harbour Convention Centre", city: "Mumbai", mode: "inperson", onlineUrl: "", countdown: true, countLabel: "Starts in", endedText: "This event has ended. Thank you for being part of it." },
  sections: [
    { id: "hero", label: "Home", show: true, inNav: false },
    { id: "clients", label: "Sponsors", show: true, inNav: false },
    { id: "about", label: "About", show: true, inNav: true },
    { id: "services", label: "Highlights", show: true, inNav: false },
    { id: "stats", label: "Numbers", show: true, inNav: false },
    { id: "team", label: "Speakers", show: true, inNav: true },
    { id: "schedule", label: "Schedule", show: true, inNav: true },
    { id: "tickets", label: "Tickets", show: true, inNav: true },
    { id: "gallery", label: "Gallery", show: true, inNav: false },
    { id: "venue", label: "Venue", show: true, inNav: true },
    { id: "work", label: "Past editions", show: false, inNav: false },
    { id: "process", label: "How it works", show: false, inNav: false },
    { id: "testimonials", label: "What people say", show: true, inNav: false },
    { id: "faq", label: "FAQ", show: true, inNav: false },
    { id: "cta", label: "Call to action", show: true, inNav: false },
    { id: "wall", label: "Social wall", show: false, inNav: false },
    { id: "contact", label: "Contact", show: true, inNav: true },
  ],
  hero: {
    eyebrow: "Conference · 2027",
    title: "Two days of ideas for people\nwho build *what's next*.",
    lede: "Talks, workshops and conversations with the people shaping technology, design and business. Come for the sessions, stay for the people you meet.",
    ctaPrimary: "Register now", ctaPrimaryTarget: "register", ctaPrimaryTargetUrl: "", ctaSecondary: "See the schedule", ctaSecondaryTarget: "schedule", ctaSecondaryTargetUrl: "",
    image: null, badges: ["40+ speakers", "1,200 attendees", "2 days, 3 stages"], showMeta: true,
    slides: { enabled: false, items: [], effect: "fade", interval: 6, speed: 1.2, overlay: 45, overlayColor: "#0E1B2C", overlayStyle: "left", textColor: "light", height: "tall", dots: true, arrows: false, pause: true, hideArt: true, artOpacity: 100 },
    panel: { show: true, dot: true },
  },
  clients: { title: "Supported by", logos: [{ name: "Arcadia Bank", logo: null }, { name: "Helix Health", logo: null }, { name: "Orbit Insurance", logo: null }, { name: "Lumen Retail", logo: null }, { name: "Stratus Cloud", logo: null }, { name: "Vertex Labs", logo: null }] },
  services: {
    eyebrow: "What to expect", title: "Made to be useful, not just inspiring", lede: "Every session is chosen so you leave with something you can use on Monday.",
    items: [
      { icon: "spark", title: "Keynotes", body: "Big-picture talks from people who have built and led at scale.", points: ["Opening keynote", "Founder stories", "Closing fireside"] },
      { icon: "layers", title: "Hands-on workshops", body: "Small rooms, real exercises and experts on hand to help.", points: ["Limited to 40 seats", "Bring a laptop", "Materials included"] },
      { icon: "people", title: "Networking", body: "Curated meet-ups so you find the people you came to meet.", points: ["Speed networking", "Evening social", "Community tables"] },
      { icon: "rocket", title: "Showcase", body: "New products and demos from teams doing interesting work.", points: ["Startup alley", "Live demos", "Partner booths"] },
    ],
  },
  about: {
    eyebrow: "About the event", title: "A gathering built around conversations",
    body: "Horizon Summit brings together people who design, build and lead. Over two days you'll hear practical talks, join workshops and meet others working on the same problems as you.\n\nIt's independent, carefully curated and small enough that you can actually talk to the speakers.",
    image: null, mission: "", vision: "",
    values: [{ title: "Practical", body: "Talks you can apply, from people who have done the work." }, { title: "Open", body: "Speakers stay for the whole event and join the conversations." }, { title: "Welcoming", body: "A code of conduct, quiet spaces and an accessible venue." }],
  },
  stats: { items: [{ value: "40+", label: "Speakers" }, { value: "1,200", label: "Attendees" }, { value: "24", label: "Sessions" }, { value: "2", label: "Days" }] },
  team: {
    eyebrow: "Speakers", title: "Who you'll hear from", lede: "Builders, designers and leaders sharing what they've learned.",
    members: [
      { name: "Ananya Rao", role: "Chief Product Officer, Arcadia", topic: "Keynote: Products people keep", photo: null, bio: "", linkedin: "" },
      { name: "David Mercer", role: "Head of Design, Lumen", topic: "Design systems at scale", photo: null, bio: "", linkedin: "" },
      { name: "Karan Mehta", role: "Founder, Vertex Labs", topic: "From prototype to platform", photo: null, bio: "", linkedin: "" },
      { name: "Sara Lindqvist", role: "VP Engineering, Stratus", topic: "Teams that ship", photo: null, bio: "", linkedin: "" },
    ],
  },
  schedule: {
    eyebrow: "Schedule", title: "What's on", lede: "Times are local. The programme may change a little before the day.",
    days: [
      { label: "Day 1", date: "2027-03-12", items: [
        { time: "09:30", title: "Doors open & registration", who: "", place: "Main foyer", body: "", tag: "" },
        { time: "10:30", title: "Opening keynote: Products people keep", who: "Ananya Rao", place: "Main stage", body: "", tag: "Keynote" },
        { time: "12:00", title: "Design systems at scale", who: "David Mercer", place: "Stage 2", body: "", tag: "Talk" },
        { time: "13:00", title: "Lunch & networking", who: "", place: "Terrace", body: "", tag: "Break" },
        { time: "14:30", title: "Workshop: From prototype to platform", who: "Karan Mehta", place: "Workshop room", body: "", tag: "Workshop" },
        { time: "18:30", title: "Evening social", who: "", place: "Rooftop", body: "", tag: "Social" },
      ] },
      { label: "Day 2", date: "2027-03-13", items: [
        { time: "10:00", title: "Teams that ship", who: "Sara Lindqvist", place: "Main stage", body: "", tag: "Talk" },
        { time: "11:30", title: "Panel: What we'd do differently", who: "All speakers", place: "Main stage", body: "", tag: "Panel" },
        { time: "14:00", title: "Startup showcase", who: "", place: "Expo hall", body: "", tag: "Showcase" },
        { time: "16:30", title: "Closing fireside & awards", who: "", place: "Main stage", body: "", tag: "Keynote" },
      ] },
    ],
  },
  tickets: { eyebrow: "Tickets", title: "Choose your pass", lede: "Prices include all sessions and lunch on both days.", note: "Group of five or more? Write to us for a group rate.", button: "Register", soldOut: "Sold out", free: "Free" },
  register: {
    enabled: true, kind: "auto", title: "Register", lede: "It takes about a minute. You'll get a confirmation by email.", closes: "", closedText: "Registration is closed.",
    tickets: [
      { name: "Standard pass", price: 4999, blurb: "Both days, all talks.", features: ["All keynotes and talks", "Lunch and refreshments", "Evening social"], limit: 0, featured: false, soldOut: false },
      { name: "Workshop pass", price: 7999, blurb: "Talks plus one workshop.", features: ["Everything in Standard", "One hands-on workshop", "Workshop materials"], limit: 0, featured: true, soldOut: false },
      { name: "Student pass", price: 1499, blurb: "For full-time students.", features: ["All keynotes and talks", "Student ID needed at entry"], limit: 0, featured: false, soldOut: false },
    ],
    maxPer: 10, ask: { phone: "auto", company: "auto", role: "auto", city: "auto", guests: "auto", meal: "auto", team: "auto", size: "auto", age: "auto", emergency: "auto", notes: "auto" },
    meals: ["Vegetarian", "Non-vegetarian", "Vegan", "Jain"], sizes: ["XS", "S", "M", "L", "XL", "XXL"], amounts: [500, 1000, 2500, 5000],
    extra: [], payLater: true, payLaterLabel: "Pay at the venue", submit: "", success: "You're registered. We've noted your details and will be in touch with what happens next.",
    consent: "", notify: false, notifyTo: "",
  },
  payments: { razorpay: { enabled: false }, cashfree: { enabled: false }, phonepe: { enabled: false }, stripe: { enabled: false }, paypal: { enabled: false } },
  gallery: { eyebrow: "Gallery", title: "Moments from last time", lede: "", images: [] },
  venue: {
    eyebrow: "Venue", title: "Getting there", lede: "", name: "Harbour Convention Centre", address: "12 Marine Drive\nMumbai 400020", mapUrl: "", image: null,
    points: [{ title: "By metro", body: "Five minutes' walk from Churchgate station." }, { title: "Parking", body: "Paid parking in the basement, with spaces kept for accessible vehicles." }, { title: "Stay nearby", body: "Partner hotels within walking distance. Ask us for the event rate." }],
  },
  work: { eyebrow: "Past editions", title: "Where we've been", lede: "", items: [] },
  process: { eyebrow: "How it works", title: "From sign-up to the day", steps: [{ title: "Register", body: "Pick a pass and fill in your details." }, { title: "Get your confirmation", body: "We email your registration number." }, { title: "Come along", body: "Show the confirmation at the entrance." }] },
  testimonials: {
    eyebrow: "From last year", title: "What people said",
    items: [
      { quote: "The most useful two days I spent all year. I came back with a notebook full of things to try.", name: "Priya Nair", role: "Product Lead", company: "Arcadia Bank" },
      { quote: "Small enough to meet everyone, big enough to hear from the best. Already booked for next year.", name: "James Whitfield", role: "Founder", company: "Orbit" },
    ],
  },
  faq: {
    eyebrow: "FAQ", title: "Good to know",
    items: [
      { q: "Can I get a refund?", a: "Yes, up to 14 days before the event. After that you can pass your ticket to someone else." },
      { q: "Is the venue accessible?", a: "Yes. Step-free access, accessible toilets and reserved seating. Tell us what you need when you register." },
      { q: "Will sessions be recorded?", a: "Main stage talks are recorded and sent to ticket holders after the event." },
      { q: "Is food included?", a: "Lunch and refreshments are included on both days. Tell us about dietary needs when you register." },
    ],
  },
  cta: { title: "Seats are limited.", body: "Register today to be sure of your place.", button: "Register now", target: "register", targetUrl: "" },
  contact: {
    eyebrow: "Contact", title: "Questions? Write to us", lede: "For sponsorship, speaking, press and group bookings.",
    email: "hello@horizonsummit.example", phone: "+91 22 4000 1234", whatsapp: "", address: "Harbour Convention Centre\n12 Marine Drive, Mumbai 400020", hours: "", mapUrl: "", linkedin: "",
    form: {
      enabled: true, title: "Send us a message", askPhone: true, askCompany: false, askService: false, askBudget: false,
      budgets: [], submit: "Send message",
      success: "Thank you. We've received your message and will reply soon.", consent: "I agree to be contacted about this message.",
      saveTo: "auto", fileUrl: "", sbUrl: "", sbKey: "", site: "", notify: false, notifyTo: "", notifySubject: "",
    },
  },
  footer: { text: "Two days of ideas for people who build what's next.", legal: "© {year} Horizon Summit. All rights reserved.", links: [{ label: "Privacy", url: "" }, { label: "Terms", url: "" }] },
  seo: { title: "Horizon Summit 2027 · Mumbai", description: "Two days of talks, workshops and conversations for people who build what's next. Register now.", titlePattern: "{page} · {site}", keywords: "", author: "", image: null, siteUrl: "", themeColor: "", noindex: false, googleVerification: "", meta: [] },
};

const FONTS = {
  "Unbounded": "Unbounded:wght@400;600;800", "Bricolage Grotesque": "Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800", "Syne": "Syne:wght@400;600;800",
  "Sora": "Sora:wght@400;600;800", "Fraunces": "Fraunces:opsz,wght@9..144,400;9..144,600;9..144,800", "Archivo Black": "Archivo+Black", "DM Serif Display": "DM+Serif+Display",
  "Playfair Display": "Playfair+Display:ital,wght@0,400;0,600;0,800;1,400", "Space Grotesk": "Space+Grotesk:wght@400;600;700", "Outfit": "Outfit:wght@400;500;600;800",
  "Oswald": "Oswald:wght@400;600;700", "Bebas Neue": "Bebas+Neue", "Cormorant Garamond": "Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400", "Libre Baskerville": "Libre+Baskerville:ital,wght@0,400;0,700;1,400",
  "Lexend": "Lexend:wght@400;500;600;800", "Rubik": "Rubik:wght@400;500;700;800", "Instrument Serif": "Instrument+Serif:ital@0;1", "Young Serif": "Young+Serif",
  "Josefin Sans": "Josefin+Sans:wght@400;600;700", "Poppins": "Poppins:wght@400;500;600;800",
  "Manrope": "Manrope:wght@400;500;600;700;800", "Instrument Sans": "Instrument+Sans:wght@400;500;600;700", "IBM Plex Sans": "IBM+Plex+Sans:wght@400;500;600;700", "DM Sans": "DM+Sans:wght@400;500;700",
  "Work Sans": "Work+Sans:wght@400;500;600;700", "Inter": "Inter:wght@400;500;600;700;800", "Nunito Sans": "Nunito+Sans:wght@400;600;700", "Karla": "Karla:wght@400;500;700",
  "Lora": "Lora:ital,wght@0,400;0,500;0,600;0,700;1,400", "Source Serif 4": "Source+Serif+4:wght@400;600;700", "Figtree": "Figtree:wght@400;500;600;700", "Plus Jakarta Sans": "Plus+Jakarta+Sans:wght@400;500;600;700;800",
  "Space Mono": "Space+Mono:wght@400;700", "Chakra Petch": "Chakra+Petch:wght@400;600;700", "Anton": "Anton", "Alfa Slab One": "Alfa+Slab+One", "Orbitron": "Orbitron:wght@400;600;800", "Quicksand": "Quicksand:wght@400;600;700", "Righteous": "Righteous", "JetBrains Mono": "JetBrains+Mono:wght@400;500;700", "Mulish": "Mulish:wght@400;600;700",
};

/* Line icons for services (24px grid, stroke = currentColor). */
const ICONS = {
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  code: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  shield: '<path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><circle cx="17.5" cy="9" r="2.5"/><path d="M17 14.5c2.4 0 4 1.5 4.6 4.5"/>',
  cloud: '<path d="M7 18h10.5a4 4 0 0 0 .4-8A6 6 0 0 0 6.3 9.5 4.3 4.3 0 0 0 7 18z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/>',
  cog: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2M3 13h18"/>',
  scale: '<path d="M12 3v18M7 21h10M5 7h14M5 7l-3 7a3.5 3.5 0 0 0 6 0zM19 7l-3 7a3.5 3.5 0 0 0 6 0z"/>',
  building: '<path d="M4 21V5l8-2v18M12 8h8v13M8 8v.01M8 12v.01M8 16v.01M16 12v.01M16 16v.01M2 21h20"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  leaf: '<path d="M5 19c0-8 5-13 15-14-1 10-6 15-14 15M5 19 13 11"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.800 12 21 12 21z"/><circle cx="12" cy="9.500" r="2.500"/>',
  ticket: '<path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z"/><path d="M14 6v12" stroke-dasharray="2 2.500"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  rocket: '<path d="M5 15c-1 1.5-1.5 3.5-1.5 5.5 2 0 4-.5 5.5-1.5M9 15l-3-3c1.5-5 6-8.5 12-9-.5 6-4 10.5-9 12zM14.5 9.5v.01"/>',
};
const icon = (k, cls = "ic") => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k] || ICONS.spark}</svg>`;

/* ============================================================
   UTILITIES
   ============================================================ */
const $ = (s, c = document) => c.querySelector(s), $$ = (s, c = document) => [...c.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ml = (s) => esc(String(s ?? "").replace(/\r\n?/g, "\n").trim()).replace(/\n/g, "<br>");
/** *words* become highlighted. */
const rich = (s) => ml(s).replace(/\*([^*]+)\*/g, "<em>$1</em>");
const paras = (s) => String(s || "").split(/\n\s*\n/).filter((x) => x.trim()).map((p) => `<p>${rich(p.trim())}</p>`).join("");
const safeUrl = (u) => { u = String(u || "").trim(); return /^(https?:|mailto:|tel:)/i.test(u) ? u : ""; };
/** A button that goes to "a custom link": the typed address becomes its target (only web, mail and phone links). */
function norm(c) {
  try {
    const link = (o, k) => { if (o && o[k] === "url") { const u = String(o[k + "Url"] || "").trim(); o[k] = /^(https?:|mailto:|tel:)/i.test(u) ? u : /^[\w-]+(\.[\w-]+)+/.test(u) ? "https://" + u : ""; } };
    link(c.nav, "ctaTarget"); link(c.hero, "ctaPrimaryTarget"); link(c.hero, "ctaSecondaryTarget"); link(c.cta, "target");
  } catch (e) {}
  return c;
}
function merge(def, val) {
  if (Array.isArray(def)) return Array.isArray(val) ? val : def;
  if (def && typeof def === "object") { const out = {}, v = val && typeof val === "object" && !Array.isArray(val) ? val : {}; for (const k of Object.keys(def)) out[k] = merge(def[k], v[k]); for (const k of Object.keys(v)) if (!(k in out)) out[k] = v[k]; return out; }
  return val === undefined ? def : val;
}
function hexRgb(h) { h = String(h || "#000").replace("#", ""); if (h.length === 3) h = h.split("").map((c) => c + c).join(""); const n = parseInt(h, 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function lum(h) { const [r, g, b] = hexRgb(h).map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; }
// White or near-black on a colour, whichever reads better (white is kept for mid-tones while it still reads clearly).
const onColor = (h) => (lum(h) > .3 ? "#10141C" : "#FFFFFF");
const initials = (s) => String(s || "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "•";
let ASSETS = {};
const HOST = (() => { try { const e = document.getElementById("site-host"); return e ? JSON.parse(e.textContent) : null; } catch (e) { return null; } })();
const hostPhoto = (p) => (HOST && /^assets\/uploads\//.test(p) ? HOST.assets + p.split("/").map(encodeURIComponent).join("/") : p);
const imgUrl = (img) => (!img ? "" : img.path ? ASSETS[img.path] || hostPhoto(img.path) : img.url || "");
let C = norm(merge(DEFAULT, {}));
const PAGE = document.body.dataset.page || "home";
const PREVIEW = window.name === "cms-preview" && window.parent !== window;
const PAGES = { home: "index.html", schedule: "schedule.html", lineup: "lineup.html", about: "about.html", contact: "contact.html", register: "register.html", page: "page.html", section: "section.html" };
/* Static pages (privacy, terms…): content.staticPages, shown by assets/pages.js at page.html?p=<name>. */
const spSlug = (p) => String(p.slug || p.title || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || p.id || "";
const spList = () => (C.staticPages || []).filter((p) => p && p.show !== false && String(p.title || "").trim() && spSlug(p));
const spHref = (p) => PAGES.page + "?p=" + encodeURIComponent(spSlug(p));
const spCur = () => { try { return new URLSearchParams(location.search).get("p") || ""; } catch (e) { return ""; } };
/** Which sections each page shows when the site has several pages (home follows the section order). */
const PAGE_SECTIONS = {
  home: ["hero", "clients", "about", "services", "stats", "team", "schedule", "tickets", "testimonials", "cta", "wall"],
  schedule: ["schedule", "venue", "faq", "cta"],
  lineup: ["team", "clients", "cta"],
  about: ["about", "stats", "gallery", "work", "process", "testimonials", "cta"],
  contact: ["contact", "venue", "faq"],
};
/** The page a section lives on in several-page mode. */
const HOME_OF = { schedule: "schedule", venue: "schedule", faq: "schedule", team: "lineup", clients: "lineup", about: "about", gallery: "about", work: "about", process: "about", testimonials: "about", contact: "contact", tickets: "home", services: "home", stats: "home" };
const multi = () => !!C.site.multiPage;
/** On one-page sites, section links from the other pages go back to the home page. */
const AT = PAGE === "home" ? "" : PAGES.home;
/* A theme can ask for its own running order ("flow"): the sections it names come first, in that order, and the rest
   follow as the owner arranged them. "own" (or none) keeps the owner's order as it is. */
const FLOW = {
  programme: ["hero", "schedule", "team", "about", "services", "stats", "tickets"], people: ["hero", "team", "about", "services", "schedule", "tickets"],
  tickets: ["hero", "about", "tickets", "services", "team", "schedule"], story: ["hero", "about", "stats", "services", "gallery", "team", "schedule", "tickets"],
  proof: ["hero", "stats", "about", "testimonials", "services", "team", "schedule", "tickets"], spotlight: ["hero", "services", "about", "team", "schedule", "tickets"],
  venue: ["hero", "about", "venue", "schedule", "team", "services", "tickets"],
};
function flowed() {
  const f = FLOW[C.theme.flow], L = C.sections; if (!f) return L;
  const at = (s) => { const i = f.indexOf(s.id); return i < 0 ? 100 + L.indexOf(s) : i; };
  // Sponsors stay where they were relative to the hero, and the closing sections stay last.
  return L.slice().sort((a, b) => at(a) - at(b));
}
const shown = (id) => { const s = C.sections.find((x) => x.id === id); return !s || s.show !== false; };
/** A link to a section: an anchor on one page, or its page when the site has several. */
/** On a one-page site, a section whose link in the owner's own menu has "Open in a new tab" on gets a page of its own
    (section.html?s=<id>) and leaves the main page. */
function soloSections() {
  const out = new Set(); if (multi() || !(C.menu && C.menu.custom)) return out;
  const walk = (L) => (L || []).forEach((i) => { if (!i || i.show === false) return; if (i.newTab && i.to && i.to !== "hero" && RENDER[i.to] && shown(i.to)) out.add(i.to); walk(i.children); });
  walk(C.menu.items); return out;
}
const soloCur = () => { try { return new URLSearchParams(location.search).get("s") || ""; } catch (e) { return ""; } };
const soloHref = (id) => PAGES.section + "?s=" + encodeURIComponent(id);
function href(id) {
  if (!id) return "#top";
  if (/^(https?:|mailto:|tel:)/i.test(id)) return id;
  if (id === "register") return PAGES.register;
  if (!multi() && soloSections().has(id)) return soloHref(id);
  if (!multi()) return (PAGE === "home" ? "" : PAGES.home) + "#" + id;
  if (id === "hero" || id === "home") return PAGES.home;
  const pg = HOME_OF[id] || "home";
  return PAGES[pg] + (PAGE === pg ? "#" + id : pg === id || (pg === "lineup" && id === "team") ? "" : "#" + id);
}
let toastT;
function toast(html) { let t = $("#toast"); if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); } t.innerHTML = html; t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), 3600); }

/* ============================================================
   THEME
   ============================================================ */
let MOTIF = "geometric";
function applyTheme(t) {
  const r = document.documentElement.style;
  r.background = t.bg; r.colorScheme = onColor(t.bg) === "#FFFFFF" ? "dark" : "light";
  if (!PREVIEW) try { localStorage.setItem("site-bg:" + location.pathname.replace(/[^/]*$/, ""), t.bg); } catch (e) {}
  ["bg", "surface", "deep", "text", "soft", "line", "c1", "c2", "c3"].forEach((k) => r.setProperty("--" + k, t[k]));
  ["c1", "c2", "c3", "deep", "surface"].forEach((k) => r.setProperty("--on-" + k, onColor(t[k])));
  const ib = t.introBg || t.deep; r.setProperty("--intro-bg", ib); r.setProperty("--intro-fg", t.introFg || onColor(ib));
  r.setProperty("--logo-r", Math.max(0, Math.min(50, t.logoRadius ?? 22)) + "%");
  r.setProperty("--r", (+t.radius || 0) + "px");
  r.setProperty("--fd", `"${t.fontDisplay}",Georgia,serif`); r.setProperty("--fb", `"${t.fontBody}","Helvetica Neue",Arial,sans-serif`);
  if (window.SiteFonts) { const cd = SiteFonts.use(t, "display", imgUrl), cb = SiteFonts.use(t, "body", imgUrl); if (cd) r.setProperty("--fd", `"${cd}","${t.fontDisplay}",Georgia,serif`); if (cb) r.setProperty("--fb", `"${cb}","${t.fontBody}","Helvetica Neue",Arial,sans-serif`); }
  const d = document.documentElement.dataset;
  for (const k of ["layout", "heroArt", "nav", "cards", "buttons", "motionStyle", "pattern", "heading", "shead", "width", "bands", "cursor", "loader", "textfx", "hoverfx", "scrollfx", "overlay", "herofx", "loaderOn", "sched", "lineup", "tix", "count", "dateBadge", "reg", "high", "stat", "about", "faq", "cta", "quote"]) d[k] = String(t[k] || "");
  d.scrollease = t.scrollEase || "light"; d.linebreaks = t.lineBreaks || "typed"; d.menu = String(t.navMode || ""); d.menumob = String(t.navModeMob || "");
  d.crumbs = (C.site || {}).crumbs === false ? "off" : "on"; d.introfont = t.introFont || "display"; d.introcase = t.introCase || "upper"; d.dark = String(onColor(t.bg) === "#FFFFFF");
  const FOK = !(window.SiteFX && window.SiteFX.fontsOk) || window.SiteFX.fontsOk(C); // Google Fonts wait for consent when the site says so
  [[FONTS[t.fontDisplay], "fontlink"], [FONTS[t.fontBody], "fontlink2"]].forEach(([f, id]) => {
    let l = document.getElementById(id); if (!l) { l = document.createElement("link"); l.id = id; l.rel = "stylesheet"; document.head.appendChild(l); }
    const h = f && FOK ? "https://fonts.googleapis.com/css2?family=" + f + "&display=swap" : ""; if (h && l.getAttribute("href") !== h) l.setAttribute("href", h); if (!FOK) l.removeAttribute("href");
  });
  if (!PREVIEW) try { localStorage.setItem("site-fonts:" + location.pathname.replace(/[^/]*$/, ""), JSON.stringify(["fontlink", "fontlink2"].map((id) => [id, (document.getElementById(id) || {}).href || ""]))); } catch (e) {}
}
function setTitle() {
  const one = (x) => String(x || "").replace(/\s*\n\s*/g, " ").trim();
  const label = PAGE === "register" ? (C.site.pageLabels || {}).register || "Register" : PAGE === "section" ? (C.sections.find((x) => x.id === soloCur()) || {}).label || "" : PAGE === "home" || !multi() ? "" : PAGE === "page" ? ((window.SitePages && window.SitePages.find(C, spCur(), PREVIEW)) || {}).title || "" : (C.site.pageLabels || {})[PAGE] || "";
  document.title = !label ? one(C.seo.title || C.brand.name) : one((C.seo.titlePattern || "{page} · {site}").replace(/\{page\}/g, label).replace(/\{site\}/g, one(C.brand.name)));
}

/* ============================================================
   SECTIONS
   ============================================================ */
const head = (s, cls = "") => (s.eyebrow || s.title || s.lede) ? `<header class="sh ${cls}">${s.eyebrow ? `<p class="eyebrow">${esc(s.eyebrow)}</p>` : ""}${s.title ? `<h2 class="h2">${rich(s.title)}</h2>` : ""}${s.lede ? `<p class="lede">${rich(s.lede)}</p>` : ""}</header>` : "";
const btn = (label, to, kind = "pri") => label ? `<a class="btn ${kind}" href="${esc(href(to))}">${esc(label)}</a>` : "";
const arrow = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

/* ---------- The event itself: when, where, the countdown ---------- */
const CUR = { INR: "₹", USD: "$", EUR: "€", GBP: "£", AUD: "A$", CAD: "C$", SGD: "S$", AED: "AED ", NZD: "NZ$", CHF: "CHF " };
const money = (n) => { const v = Math.round((+n || 0) * 100) / 100, c = String((C.settings || {}).currency || "INR").toUpperCase(); return (CUR[c] ?? c + " ") + v.toLocaleString(c === "INR" ? "en-IN" : "en-US", { maximumFractionDigits: 2 }); };
/** A day ("2027-03-12") and an optional time ("09:30") as a Date in the visitor's own time. */
const dOf = (d, t) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d || "")); if (!m) return null; const tm = /^(\d{1,2}):(\d{2})$/.exec(String(t || "")); return new Date(+m[1], +m[2] - 1, +m[3], tm ? +tm[1] : 0, tm ? +tm[2] : 0); };
const fmtD = (d, o) => { const x = dOf(d); return x ? x.toLocaleDateString("en-GB", o || { weekday: "short", day: "numeric", month: "long", year: "numeric" }) : ""; };
const fmtT = (t) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || "").trim()); if (!m) return String(t || ""); const h = +m[1]; return ((h % 12) || 12) + (m[2] === "00" ? "" : ":" + m[2]) + (h < 12 ? " am" : " pm"); };
/** "Fri, 12 March 2027, 9:30 am", or "12 – 13 March 2027" for an event of several days (or the owner's own wording). */
function evWhen() {
  const E = C.event; if (String(E.dateText || "").trim()) return E.dateText.trim();
  const a = dOf(E.date), b = dOf(E.endDate); if (!a) return "";
  if (b && b > a) {
    const sameM = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear(), sameY = a.getFullYear() === b.getFullYear();
    return (sameM ? a.getDate() : a.toLocaleDateString("en-GB", { day: "numeric", month: "long", ...(sameY ? {} : { year: "numeric" }) })) + " – " + b.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  }
  return fmtD(E.date) + (E.time ? ", " + fmtT(E.time) : "");
}
const evWhere = () => [C.event.venue, C.event.city].filter(Boolean).join(", ") || (C.event.mode === "online" ? "Online" : "");
function evMeta() {
  const w = evWhen(), p = evWhere(), E = C.event, a = dOf(E.date);
  if (!w && !p) return "";
  const leaf = a ? `<span class="ev-leaf" aria-hidden="true"><i>${esc(a.toLocaleDateString("en-GB", { month: "short" }))}</i><b>${a.getDate()}</b></span>` : "";
  return `<div class="ev-meta" data-edit="event.date">${leaf}<span class="ev-mt">${w ? `<span class="ev-when">${icon("cal", "ev-i")}${esc(w)}</span>` : ""}${p ? `<span class="ev-where">${icon("pin", "ev-i")}${esc(p)}</span>` : ""}${E.mode === "online" && p !== "Online" ? `<span class="ev-mode">Online event</span>` : E.mode === "hybrid" ? `<span class="ev-mode">In person and online</span>` : ""}</span></div>`;
}
function countdownHTML() {
  const E = C.event, a = dOf(E.date, E.time); if (E.countdown === false || !a) return "";
  const end = dOf(E.endDate || E.date, E.endTime || "23:59") || a;
  if (Date.now() > end.getTime()) return E.endedText ? `<p class="ev-ended">${esc(E.endedText)}</p>` : "";
  if (Date.now() >= a.getTime()) return `<p class="ev-live"><span></span>Happening now</p>`;
  const u = (k, l) => `<span class="cd-u"><b data-u="${k}">0</b><i>${l}</i></span>`;
  return `<div class="cd" data-to="${a.getTime()}" role="timer" data-edit="event.countdown">${E.countLabel ? `<span class="cd-l">${esc(E.countLabel)}</span>` : ""}<span class="cd-g">${u("d", "days")}${u("h", "hours")}${u("m", "min")}${u("s", "sec")}</span></div>`;
}
let cdT;
function countdown() {
  clearInterval(cdT); const el = $(".cd"); if (!el) return;
  const to = +el.dataset.to, set = (k, v) => { const b = $(`[data-u="${k}"]`, el); if (b && b.textContent !== String(v)) b.textContent = v; };
  const tick = () => { let s = Math.max(0, Math.floor((to - Date.now()) / 1000)); set("d", Math.floor(s / 86400)); s %= 86400; set("h", String(Math.floor(s / 3600)).padStart(2, "0")); s %= 3600; set("m", String(Math.floor(s / 60)).padStart(2, "0")); set("s", String(s % 60).padStart(2, "0")); if (to <= Date.now()) { clearInterval(cdT); if (!PREVIEW) render(); } };
  tick(); cdT = setInterval(tick, 1000);
}

/** Without a hero image: the date, the first sessions and the lowest price, in the theme's colours. */
function heroPanel() {
  const E = C.event, a = dOf(E.date), P = C.hero.panel || {};
  const it = (((C.schedule.days || [])[0] || {}).items || []).filter((x) => x && x.title).slice(0, 3);
  const K = REG[regKind()], T = K.tix ? regTickets() : [], min = T.length ? Math.min(...T.map((t) => +t.price || 0)) : null;
  return `<div class="hp" aria-hidden="true">
    ${a ? `<div class="hp-card hp-a"><span class="hp-k">${esc(a.toLocaleDateString("en-GB", { weekday: "long" }))}</span><b>${a.getDate()} ${esc(a.toLocaleDateString("en-GB", { month: "short" }))}</b><span class="hp-y">${a.getFullYear()}${E.city ? " · " + esc(E.city) : ""}</span><i class="hp-bars">${[38, 54, 46, 70, 62, 84, 96].map((h) => `<span style="--h:${h}%"></span>`).join("")}</i></div>` : ""}
    ${it.length ? `<div class="hp-card hp-b">${it.map((s) => `<span class="hp-row"><span class="hp-t">${esc(fmtT(s.time))}</span><span>${esc(s.title)}</span></span>`).join("")}</div>` : ""}
    ${min != null ? `<div class="hp-card hp-c"><span class="hp-k">${min > 0 ? "Passes from" : "Entry"}</span><b>${min > 0 ? esc(money(min)) : "Free"}</b></div>` : ""}
    ${P.dot !== false ? `<span class="hp-dot"></span>` : ""}
  </div>`;
}

/* ---------- Schedule: one list per day; several days get a tab each ---------- */
function scheduleHTML(full) {
  const S = C.schedule, days = (S.days || []).filter((d) => d && (d.items || []).some((x) => x && x.title));
  if (!days.length) return "";
  const cut = multi() && !full, show = cut ? days.slice(0, 1) : days, tabs = show.length > 1;
  const item = (x, i) => `<li class="sch-i rv" style="--i:${Math.min(i, 8)}"><time class="sch-t">${esc(fmtT(x.time))}</time><div class="sch-b">${x.tag ? `<span class="sch-tag">${esc(x.tag)}</span>` : ""}<h3 class="h3">${esc(x.title)}</h3>${x.who || x.place ? `<p class="sch-m">${[x.who, x.place].filter(Boolean).map(esc).join(" · ")}</p>` : ""}${x.body ? `<p class="sch-d">${rich(x.body)}</p>` : ""}</div></li>`;
  const lab = (d, i) => esc(d.label || "Day " + (i + 1));
  return `<section class="schedule band" id="schedule"><div class="wrap">${head(S)}
    ${tabs ? `<div class="chips sch-tabs">${show.map((d, i) => `<button class="chip" type="button" data-day="${i}" aria-pressed="${i === 0}">${lab(d, i)}${d.date ? ` <small>${esc(fmtD(d.date, { day: "numeric", month: "short" }))}</small>` : ""}</button>`).join("")}</div>` : ""}
    ${show.map((d, i) => `<div class="sch-day" data-day="${i}"${tabs && i ? " hidden" : ""}>${!tabs && d.date ? `<p class="sch-dl">${lab(d, i)} · ${esc(fmtD(d.date))}</p>` : ""}<ol class="sch">${(d.items || []).filter((x) => x && x.title).slice(0, cut ? 5 : 200).map(item).join("")}</ol></div>`).join("")}
    ${cut ? `<p class="more"><a class="link" href="${PAGES.schedule}">${esc((C.site.pageLabels || {}).schedule || "Full schedule")} ${arrow}</a></p>` : ""}</div></section>`;
}
/** The people on stage (speakers, artists, hosts…), with what they are there for. */
function teamHTML(full) {
  const T = C.team, all = (T.members || []).filter((m) => m && m.name); if (!all.length) return "";
  const L = multi() && !full ? all.slice(0, 4) : all;
  return `<section class="team" id="team"><div class="wrap">${head(T)}<div class="people">${L.map((m, i) => {
    const ph = imgUrl(m.photo), li = safeUrl(m.linkedin);
    return `<article class="person rv" style="--i:${i}"><div class="pp">${ph ? `<img src="${esc(ph)}" alt="${esc(m.name)}" loading="lazy">` : `<span>${esc(initials(m.name))}</span>`}</div><div class="pb"><h3 class="h3">${esc(m.name)}</h3>${m.role ? `<p class="role">${esc(m.role)}</p>` : ""}${m.topic ? `<p class="topic">${esc(m.topic)}</p>` : ""}${m.bio ? `<p class="bio">${rich(m.bio)}</p>` : ""}</div>${li ? `<a class="pl" href="${esc(li)}" target="_blank" rel="noopener" aria-label="More about ${esc(m.name)}">↗</a>` : ""}</article>`;
  }).join("")}</div>${multi() && !full && all.length > L.length ? `<p class="more"><a class="link" href="${PAGES.lineup}">${esc((C.site.pageLabels || {}).lineup || "Everyone")} ${arrow}</a></p>` : ""}</div></section>`;
}
function galleryHTML() {
  const G = C.gallery, L = (G.images || []).map(imgUrl).filter(Boolean); if (!L.length) return "";
  return `<section class="gallery" id="gallery"><div class="wrap">${head(G)}<div class="gal" data-edit="gallery.images">${L.slice(0, 24).map((u, i) => `<figure class="gal-i rv" style="--i:${i % 6}"><img src="${esc(u)}" alt="" loading="lazy"></figure>`).join("")}</div></div></section>`;
}
function venueHTML() {
  const V = C.venue, im = imgUrl(V.image), map = safeUrl(V.mapUrl), pts = (V.points || []).filter((p) => p && (p.title || p.body));
  if (!V.name && !V.address && !pts.length && !im) return "";
  return `<section class="venue band" id="venue"><div class="wrap">${head(V)}<div class="venue-grid${im ? " has-img" : ""}">
      <div class="card venue-card">${icon("pin", "venue-ic")}${V.name ? `<h3 class="h3">${esc(V.name)}</h3>` : ""}${V.address ? `<p class="venue-ad">${ml(V.address)}</p>` : ""}${evWhen() ? `<p class="venue-when">${icon("cal", "ev-i")}${esc(evWhen())}</p>` : ""}${map ? `<a class="btn sec" href="${esc(map)}" target="_blank" rel="noopener">Open in Maps ${arrow}</a>` : ""}</div>
      ${im ? `<div class="venue-img" data-edit="venue.image"><img src="${esc(im)}" alt="" loading="lazy"></div>` : ""}
      ${pts.length ? `<div class="venue-pts">${pts.map((p, i) => `<div class="venue-p rv" style="--i:${i}"><h3 class="h3">${esc(p.title)}</h3><p>${rich(p.body)}</p></div>`).join("")}</div>` : ""}</div></div></section>`;
}

/* ---------- Registration. The kind decides what is asked: tickets, an RSVP, a team entry, a stall… ---------- */
const REG = {
  tickets: { label: "Tickets", cta: "Book tickets", per: "per ticket", tix: true, qty: true, pick: "Tickets", ask: ["phone"], submit: "Book now", none: "Choose at least one ticket." },
  delegate: { label: "Delegate registration", cta: "Register", per: "per person", tix: true, qty: true, pick: "Passes", ask: ["phone", "company", "role"], submit: "Complete registration", none: "Choose at least one pass." },
  rsvp: { label: "RSVP", cta: "RSVP", tix: false, attend: true, ask: ["phone", "guests", "meal", "notes"], submit: "Send RSVP", lab: { notes: "A message for the hosts" } },
  team: { label: "Team registration", cta: "Register your team", per: "per team", tix: true, qty: false, pick: "Category", ask: ["phone", "team", "company", "notes"], submit: "Register team", lab: { name: "Team lead's name", company: "College or company", notes: "Team members (one name per line)" }, none: "Choose a category." },
  stall: { label: "Stall booking", cta: "Book a stall", per: "per stall", tix: true, qty: true, pick: "Stalls", ask: ["phone", "company", "notes"], submit: "Request a stall", lab: { company: "Business name", notes: "What will you show or sell?" }, none: "Choose at least one stall." },
  entry: { label: "Participant entry", cta: "Enter now", per: "per entry", tix: true, qty: false, pick: "Category", ask: ["phone", "age", "size", "emergency"], submit: "Confirm entry", none: "Choose a category." },
  seat: { label: "Seat reservation", cta: "Reserve a seat", per: "per seat", tix: true, qty: true, pick: "Seats", ask: ["phone"], submit: "Reserve", none: "Choose at least one seat." },
  enrol: { label: "Enrolment", cta: "Enrol", per: "per person", tix: true, qty: false, pick: "Choose a batch", ask: ["phone", "notes"], submit: "Enrol now", lab: { notes: "Your experience so far (optional)" }, none: "Choose a batch." },
  donate: { label: "Donation", cta: "Donate", tix: false, amount: true, ask: ["phone", "notes"], submit: "Donate", lab: { notes: "A message (optional)" } },
  volunteer: { label: "Volunteer sign-up", cta: "Sign up", tix: false, ask: ["phone", "age", "city", "notes"], submit: "Sign me up", lab: { notes: "When are you free, and how would you like to help?" } },
  media: { label: "Press accreditation", cta: "Request a pass", tix: false, ask: ["phone", "company", "role", "notes"], submit: "Request accreditation", lab: { company: "Publication or outlet", role: "Your role" } },
};
const ASK = { phone: "Phone", company: "Company or organisation", role: "Job title", city: "City", guests: "Number of guests (including you)", meal: "Meal preference", team: "Team name", size: "T-shirt size", age: "Age", emergency: "Emergency contact (name and phone)", notes: "Anything we should know?" };
const regKind = () => { const k = (C.register || {}).kind; return REG[k] ? k : REG[C.theme.regKind] ? C.theme.regKind : "tickets"; };
const regTickets = () => ((C.register || {}).tickets || []).filter((t) => t && String(t.name || "").trim()).map((t) => (REGI && REGI.left && REGI.left[String(t.name).trim()] === 0 ? { ...t, soldOut: true } : t));
/* What the site's database says about registration (GET /reg/<site>): the ways to pay online that are set up, and the
   places left of tickets that have a limit. Asked once per visit; a site with no database has none of this. */
let REGI = null, regAsked = false;
function regInfo() {
  const be = backend(); if (regAsked || PREVIEW || !be || !be.cf) return; regAsked = true;
  fetch(be.cf + "/reg/" + encodeURIComponent(be.site), { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => {
    if (!j) return; REGI = j;
    // A ticket that has run out is drawn as sold out; otherwise only the ways to pay need drawing.
    if (Object.values(j.left || {}).some((n) => n === 0) && !$(".reg-done")) render(); else { const f = $("#regform"); if (f) f.dispatchEvent(new Event("input")); }
  }).catch(() => {});
}
const GW = { rz: ["razorpay", "Pay online (UPI, card, netbanking)"], cf: ["cashfree", "Pay online with Cashfree (UPI, card, netbanking)"], pe: ["phonepe", "Pay with PhonePe (UPI, card, netbanking)"], st: ["stripe", "Pay by card (Stripe)"], pp: ["paypal", "Pay with PayPal"] };
/** The ways to pay online: the ones the database has keys for (in the preview, the ones switched on in the content). */
const regWays = () => (PREVIEW ? Object.keys(GW).filter((g) => ((C.payments || {})[GW[g][0]] || {}).enabled) : (REGI && REGI.pay) || []).filter((g) => GW[g]);
const regOpen = () => { const R = C.register || {}, c = dOf(R.closes, "23:59"); return R.enabled !== false && !(c && Date.now() > c.getTime()); };
/** What this registration asks besides name and email: the kind's own questions, switched on or off by the owner. */
const regAsks = (k) => { const A = (C.register || {}).ask || {}; return Object.keys(ASK).filter((f) => A[f] === "yes" || (A[f] !== "no" && REG[k].ask.includes(f))); };
function ticketsHTML() {
  const T = C.tickets, K = REG[regKind()], L = K.tix ? regTickets() : [], open = regOpen(); if (!L.length) return "";
  return `<section class="tickets band" id="tickets"><div class="wrap">${head(T)}<div class="plans tix">${L.map((t, i) => `<article class="card plan tk rv${t.featured && !t.soldOut ? " featured" : ""}${t.soldOut ? " out" : ""}" style="--i:${i}">${t.featured && !t.soldOut ? `<span class="plan-flag">Popular</span>` : ""}
      <h3 class="h3">${esc(t.name)}</h3>${t.blurb ? `<p class="plan-blurb">${rich(t.blurb)}</p>` : ""}<p class="price"><b>${+t.price > 0 ? esc(money(t.price)) : esc(T.free || "Free")}</b>${K.per && +t.price > 0 ? `<span>${esc(K.per)}</span>` : ""}</p>
      ${(t.features || []).filter(Boolean).length ? `<ul class="ticks">${t.features.filter(Boolean).map((f) => `<li>${esc(f)}</li>`).join("")}</ul>` : `<span class="tk-sp"></span>`}
      ${t.soldOut ? `<span class="btn sec off">${esc(T.soldOut || "Sold out")}</span>` : open ? `<a class="btn ${t.featured ? "pri" : "sec"}" href="${PAGES.register}?t=${i}">${esc(T.button || K.cta)}</a>` : ""}</article>`).join("")}</div>
    ${T.note ? `<p class="plan-note">${rich(T.note)}</p>` : ""}${open ? "" : `<p class="plan-note">${esc(C.register.closedText || "Registration is closed.")}</p>`}</div></section>`;
}
function registerPage() {
  const R = C.register, k = regKind(), K = REG[k], L = K.tix ? regTickets() : [], lab = (f) => (K.lab && K.lab[f]) || ASK[f];
  const headS = `<section class="phead" id="page"><div class="wrap"><p class="crumbs"><a href="${PAGES.home}">${esc(C.site.pageLabels.home || "Home")}</a> / ${esc(C.site.pageLabels.register || "Register")}</p><h1 class="h1">${rich(R.title || K.label)}</h1>${R.lede ? `<p class="hero-lede">${rich(R.lede)}</p>` : ""}${evMeta()}</div></section>`;
  if (!regOpen()) return headS + `<section class="reg"><div class="wrap"><div class="card reg-closed"><p>${esc(R.closedText || "Registration is closed.")}</p><a class="btn sec" href="${PAGES.home}">Back to the home page</a></div></div></section>`;
  const fld = (id, label, input, req) => `<label class="fld" for="r-${id}"><span>${esc(label)}${req ? ' <i aria-hidden="true">*</i>' : ""}</span>${input}</label>`;
  const sel = (id, opts, req) => `<select id="r-${id}" name="${id}"${req ? " required" : ""}><option value="">Choose…</option>${opts.filter(Boolean).map((o) => `<option>${esc(o)}</option>`).join("")}</select>`;
  const pre = Math.max(0, parseInt(new URLSearchParams(location.search).get("t") || "0", 10) || 0), first = L.findIndex((t, i) => !t.soldOut && i >= 0), start = L[pre] && !L[pre].soldOut ? pre : first;
  const tn = (t) => `<span class="reg-tn"><b>${esc(t.name)}</b>${t.blurb ? `<small>${esc(t.blurb)}</small>` : ""}</span><span class="reg-tp">${+t.price > 0 ? esc(money(t.price)) : esc(C.tickets.free || "Free")}</span>`;
  const tix = !L.length ? "" : `<fieldset class="reg-tix"><legend>${esc(K.pick)}</legend>${L.map((t, i) => t.soldOut ? `<div class="reg-t out">${tn(t)}<span class="reg-so">${esc(C.tickets.soldOut || "Sold out")}</span></div>`
    : K.qty ? `<div class="reg-t">${tn(t)}<span class="qty"><button type="button" data-q="-1" data-i="${i}" aria-label="One fewer: ${esc(t.name)}">−</button><input name="q${i}" inputmode="numeric" value="${i === start ? 1 : 0}" aria-label="${esc(t.name)}: how many"><button type="button" data-q="1" data-i="${i}" aria-label="One more: ${esc(t.name)}">+</button></span></div>`
    : `<label class="reg-t pick"><input type="radio" name="pick" value="${i}"${i === start ? " checked" : ""}>${tn(t)}</label>`).join("")}</fieldset>`;
  const amounts = (R.amounts || []).map(Number).filter((n) => n > 0);
  const amount = K.amount ? `<fieldset class="reg-tix"><legend>Amount</legend>${amounts.length ? `<div class="chips reg-amts">${amounts.map((a, i) => `<button class="chip" type="button" data-amt="${a}" aria-pressed="${i === 0}">${esc(money(a))}</button>`).join("")}</div>` : ""}${fld("amount", "Or another amount", `<input id="r-amount" name="amount" inputmode="decimal" value="${amounts[0] || ""}" required>`, 1)}</fieldset>` : "";
  const attend = K.attend ? fld("attending", "Will you be there?", sel("attending", ["Yes, I'll be there", "Sorry, can't make it", "Not sure yet"], 1), 1) : "";
  const ask = regAsks(k), one = (f) => f === "meal" ? fld(f, lab(f), sel(f, R.meals || [])) : f === "size" ? fld(f, lab(f), sel(f, R.sizes || [])) : f === "notes" ? "" : fld(f, lab(f), `<input id="r-${f}" name="${f}"${f === "phone" ? ' type="tel" autocomplete="tel"' : f === "guests" || f === "age" ? ' inputmode="numeric"' : f === "company" ? ' autocomplete="organization"' : ""}${f === "guests" ? ' value="1"' : ""}>`);
  const cells = ask.filter((f) => f !== "notes").map(one), rows = []; for (let i = 0; i < cells.length; i += 2) rows.push(`<div class="row2">${cells[i]}${cells[i + 1] || ""}</div>`);
  const extra = (R.extra || []).filter((x) => x && String(x.label || "").trim()).slice(0, 12).map((x, i) => { const id = "x" + i, req = !!x.required, o = (x.options || []).filter(Boolean);
    return x.type === "check" ? `<label class="consent"><input type="checkbox" name="${id}"${req ? " required" : ""}> <span>${esc(x.label)}</span></label>` : fld(id, x.label, x.type === "select" && o.length ? sel(id, o, req) : x.type === "area" ? `<textarea id="r-${id}" name="${id}" rows="3"${req ? " required" : ""}></textarea>` : `<input id="r-${id}" name="${id}"${req ? " required" : ""}>`, req); }).join("");
  const priced = K.amount || L.some((t) => +t.price > 0);
  const form = `<form class="card form reg-form" id="regform" novalidate>
      ${tix}${amount}
      <div class="row2">${fld("name", lab("name") || "Your name", `<input id="r-name" name="name" required autocomplete="name">`, 1)}${fld("email", "Email", `<input id="r-email" name="email" type="email" required autocomplete="email">`, 1)}</div>
      ${attend}${rows.join("")}${extra}${ask.includes("notes") ? fld("notes", lab("notes"), `<textarea id="r-notes" name="notes" rows="3"></textarea>`) : ""}
      <input class="hp-f" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
      ${consentWords(R.consent) ? `<label class="consent"><input type="checkbox" name="consent" required> <span>${esc(consentWords(R.consent))}</span></label>` : ""}
      <div id="reg-pay"></div>
      <p class="form-msg" role="status" aria-live="polite"></p>
      <button class="btn pri" type="submit">${esc(R.submit || K.submit)} ${arrow}</button></form>`;
  const sum = `<aside class="card reg-sum" aria-live="polite"><h3 class="h3">${esc(C.brand.name)}</h3>${evWhen() ? `<p class="reg-sw">${icon("cal", "ev-i")}${esc(evWhen())}</p>` : ""}${evWhere() ? `<p class="reg-sw">${icon("pin", "ev-i")}${esc(evWhere())}</p>` : ""}${L.length || K.amount ? `<div id="reg-lines"></div>${priced ? `<p class="reg-total"><span>Total</span><b id="reg-total"></b></p>` : ""}` : ""}</aside>`;
  return headS + `<section class="reg" id="register"><div class="wrap reg-grid">${form}${sum}</div></section>`;
}
/** What the form has chosen so far: the lines, how many, and what it comes to. */
function regState(f) {
  const K = REG[regKind()], L = K.tix ? regTickets() : [], lines = [], max = Math.max(1, Math.min(50, +C.register.maxPer || 10)); let total = 0, count = 0;
  if (K.amount) { const a = Math.max(0, parseFloat(String((f.elements.amount || {}).value || "").replace(/[^\d.]/g, "")) || 0); if (a) lines.push({ name: K.label, qty: 1, price: a }); total = a; }
  else if (K.qty) L.forEach((t, i) => { const el = f.elements["q" + i]; if (!el || t.soldOut) return; const q = Math.max(0, Math.min(max, parseInt(el.value, 10) || 0)); if (String(q) !== el.value) el.value = q; if (q) { lines.push({ i, name: t.name, qty: q, price: +t.price || 0 }); total += q * (+t.price || 0); count += q; } });
  else if (L.length) { const c = f.querySelector("input[name=pick]:checked"), t = c ? L[+c.value] : null; if (t && !t.soldOut) { lines.push({ i: +c.value, name: t.name, qty: 1, price: +t.price || 0 }); total = +t.price || 0; count = 1; } }
  return { lines, count, total: Math.round(total * 100) / 100 };
}
function regNo() { const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let s = ""; const r = crypto.getRandomValues(new Uint8Array(6)); for (const b of r) s += a[b % a.length]; return "REG-" + s; }
function bindRegister() {
  const f = $("#regform"); if (!f) return;
  const draw = () => { const S = regState(f), box = $("#reg-lines"), tot = $("#reg-total");
    if (box) box.innerHTML = S.lines.length ? `<ul class="reg-ll">${S.lines.map((l) => `<li><span>${l.qty > 1 ? l.qty + " × " : ""}${esc(l.name)}</span><b>${l.price > 0 ? esc(money(l.price * l.qty)) : esc(C.tickets.free || "Free")}</b></li>`).join("")}</ul>` : `<p class="reg-none">Nothing chosen yet.</p>`;
    if (tot) tot.textContent = S.total > 0 ? money(S.total) : S.lines.length ? (C.tickets.free || "Free") : "–";
    regPay(f, S); };
  $$(".qty button", f).forEach((b) => b.addEventListener("click", () => { const el = f.elements["q" + b.dataset.i]; el.value = Math.max(0, (parseInt(el.value, 10) || 0) + +b.dataset.q); draw(); }));
  $$(".reg-amts .chip", f).forEach((b) => b.addEventListener("click", () => { f.elements.amount.value = b.dataset.amt; $$(".reg-amts .chip", f).forEach((x) => x.setAttribute("aria-pressed", String(x === b))); draw(); }));
  f.addEventListener("input", (e) => { if (e.target.name === "amount") $$(".reg-amts .chip", f).forEach((x) => x.setAttribute("aria-pressed", String(+x.dataset.amt === +e.target.value))); draw(); });
  f.addEventListener("submit", regSubmit); draw(); regInfo();
  if (!bindRegister.back) { bindRegister.back = true; regCameBack(); }
}
/** How the registration is paid for (shown when it costs something): online where the site has it set up, or later. */
function regPay(f, S) {
  const box = $("#reg-pay", f); if (!box) return; const R = C.register, ways = regWays(), later = R.payLater !== false || !ways.length;
  const key = S.total > 0 ? ways.join() + "|" + later : ""; if (box.dataset.k === key) return; box.dataset.k = key;
  if (!(S.total > 0)) { box.innerHTML = ""; return; }
  if (!ways.length) { box.innerHTML = R.payLater !== false ? `<p class="reg-payn">${icon("ticket", "ev-i")}${esc(R.payLaterLabel || "Pay at the venue")}</p>` : ""; return; }
  const opt = (v, label, on) => `<label class="reg-t pick"><input type="radio" name="payway" value="${v}"${on ? " checked" : ""}><span class="reg-tn"><b>${esc(label)}</b></span></label>`;
  box.innerHTML = `<fieldset class="reg-tix reg-ways"><legend>Payment</legend>${ways.map((g, i) => opt(g, ((C.payments || {})[GW[g][0]] || {}).label || GW[g][1], i === 0)).join("")}${later ? opt("later", R.payLaterLabel || "Pay at the venue", false) : ""}</fieldset>`;
}
async function regSubmit(e) {
  e.preventDefault();
  const f = e.currentTarget, msg = $(".form-msg", f), b = $("button[type=submit]", f), k = regKind(), K = REG[k], R = C.register, S = regState(f);
  const raw = Object.fromEntries(new FormData(f).entries()); if (raw.website) return;
  const say = (t, cls) => { msg.className = "form-msg " + cls; msg.textContent = t; };
  const bad = [...f.querySelectorAll("[required]")].find((i) => (i.type === "checkbox" ? !i.checked : !String(i.value).trim()) || (i.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i.value)));
  if (bad) { say(bad.type === "email" ? "Please enter a valid email address." : "Please fill in the required fields.", "bad"); bad.focus(); return; }
  if (K.tix && regTickets().length && !S.lines.length) { say(K.none || "Choose an option first.", "bad"); return; }
  if (K.amount && !(S.total > 0)) { say("Enter an amount.", "bad"); return; }
  const lab = (x) => (K.lab && K.lab[x]) || ASK[x] || x, data = { type: K.label, reg_no: regNo(), event: C.brand.name, name: raw.name, email: raw.email };
  if (raw.attending) data.attending = raw.attending;
  for (const a of regAsks(k)) if (raw[a]) data[a] = raw[a];
  (R.extra || []).filter((x) => x && String(x.label || "").trim()).slice(0, 12).forEach((x, i) => { const v = raw["x" + i]; if (v) data["q" + (i + 1)] = String(x.label).slice(0, 80) + ": " + (x.type === "check" ? "Yes" : v); });
  if (S.lines.length) { data.tickets = S.lines.map((l) => (l.qty > 1 || K.qty ? l.qty + " × " : "") + l.name).join(", "); data.count = String(S.count || 1); }
  if (S.total > 0) { data.total = money(S.total); data.payment = R.payLaterLabel || "Pay at the venue"; }
  data.consent = raw.consent ? "Agreed on " + new Date().toISOString() + ": " + consentWords(R.consent) : "";
  if (PREVIEW) { say("Preview: registration works on the live site, and each one is listed under Registrations & messages in the admin page." + (S.total > 0 && regWays().length ? " Online payment opens on the live site." : ""), "ok"); return; }
  const cart = { lines: S.lines.filter((l) => l.i != null).map((l) => ({ i: l.i, qty: l.qty })), ...(K.amount ? { amount: S.total } : {}) }, way = S.total > 0 ? (f.elements.payway || {}).value || "" : "";
  b.disabled = true; say(way && way !== "later" ? "Opening the payment…" : "Sending…", "");
  const fail = (t) => { msg.className = "form-msg bad"; if (t) msg.textContent = t; else msg.innerHTML = C.contact.email ? `Couldn't send just now. Please email us at <a href="mailto:${esc(C.contact.email)}">${esc(C.contact.email)}</a>.` : "Couldn't send just now. Please try again in a moment."; b.disabled = false; };
  try {
    const be = backend();
    if (be && be.cf && C.contact.form.saveTo !== "file") {
      if (way && way !== "later") return await regPayOnline(way, data, cart, f, fail);
      const r = await regSave(data, cart, null); if (!r.ok) return fail(r.error);
      return regDone(f, data, r.paid ? "paid" : "saved");
    }
    regDone(f, data, await sendData(data, "Registration: " + (data.name || "") + " (" + data.reg_no + ")"));
  } catch (x) { fail(""); }
}
/** Saves a registration on the site's database. The database works out what was chosen and what it costs, and checks a payment with the gateway itself. */
async function regSave(data, cart, pay) {
  const be = backend(), guard = (C.privacy || {}).spam !== false, took = Math.max(1600, Math.round(performance.now() - FORM_T0));
  const r = await fetch(be.cf + "/reg/" + encodeURIComponent(be.site), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data, cart, page: location.pathname, ...(pay ? { pay } : guard ? { took } : {}) }) });
  const j = await r.json().catch(() => null);
  return r.ok && j && j.ok ? { ok: true, paid: !!j.paid } : { ok: false, error: (j && j.error) || "Couldn't save your registration just now. Please try again in a moment." };
}
function regDone(f, data, how) {
  const R = C.register, K = REG[regKind()], done = document.createElement("div"); done.className = "card reg-done"; done.setAttribute("role", "status");
  done.innerHTML = how === "mail" ? `<h2 class="h2">One more step</h2><p>Your email app should have opened with your registration filled in. Press Send there to finish.</p>`
    : `<span class="reg-ok" aria-hidden="true">✓</span><h2 class="h2">${esc(K.attend ? "Thank you" : "You're in")}</h2><p>${esc(R.success || "Your registration is received.")}</p><p class="reg-no">Registration number <b>${esc(data.reg_no)}</b></p>${data.tickets ? `<p class="reg-dl">${esc(data.tickets)}${data.total ? " · " + esc(data.total) : ""}${how === "paid" ? " · Paid" : ""}</p>` : how === "paid" && data.total ? `<p class="reg-dl">${esc(data.total)} · Paid</p>` : ""}<a class="btn sec" href="${PAGES.home}">Back to the home page</a>`;
  const at = f && f.isConnected ? f : $("#regform") || $(".reg-grid"); if (at && at.id === "regform") at.replaceWith(done); else if (at) at.prepend(done);
  done.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}
const PEND = () => "reg-pend:" + location.pathname.replace(/[^/]*$/, "");
const script = (src) => new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
/** Pays for a registration online. Razorpay opens over the page; the others take the visitor to their own page and bring them back (see regCameBack). */
async function regPayOnline(g, data, cart, f, fail) {
  const be = backend();
  const r = await fetch(be.cf + "/reg/pay/" + g + "/" + encodeURIComponent(be.site), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...cart, reg_no: data.reg_no, name: data.name, email: data.email, phone: data.phone || "", back: location.origin + location.pathname }) });
  const j = await r.json().catch(() => null); if (!r.ok || !j || !(j.order_id || j.go || j.session)) return fail((j && j.error) || "Online payment couldn't start. Please try again, or choose another way to pay.");
  if (g !== "rz") {
    // The registration waits on this device while the visitor pays on the gateway's page; it is saved when they come back paid.
    try { sessionStorage.setItem(PEND(), JSON.stringify({ data, cart, g, ref: j.ref, at: Date.now() })); } catch (e) {}
    if (g === "cf") { if (!window.Cashfree) await script("https://sdk.cashfree.com/js/v3/cashfree.js"); window.Cashfree({ mode: j.mode }).checkout({ paymentSessionId: j.session, redirectTarget: "_self" }); }
    else location.href = j.go;
    return;
  }
  if (!window.Razorpay) await script("https://checkout.razorpay.com/v1/checkout.js");
  new window.Razorpay({ key: j.key, order_id: j.order_id, amount: j.amount, currency: j.currency, name: j.name || C.brand.name, description: "Registration " + data.reg_no, prefill: { name: data.name, contact: data.phone || undefined, email: data.email }, notes: { reg_no: data.reg_no }, theme: { color: C.theme.c1 },
    handler: async (resp) => { const s = await regSave(data, cart, { rz_order: resp.razorpay_order_id, rz_payment: resp.razorpay_payment_id, rz_sig: resp.razorpay_signature }).catch(() => ({ ok: false, error: "" })); if (s.ok) regDone(f, data, "paid"); else fail(s.error || "The payment went through but we couldn't save your registration. Please contact us with your registration number " + data.reg_no + "."); },
    modal: { ondismiss: () => fail("The payment wasn't completed, so you aren't registered yet. You can try again.") } }).open();
}
/** Back from a gateway's page: the registration that was waiting is sent with the payment's reference, and the database asks the gateway whether it was paid. */
async function regCameBack() {
  let q; try { q = new URLSearchParams(location.search); } catch (e) { return; }
  const g = q.get("paid"), no = q.get("o"); if (!g || !GW[g] || !no || PREVIEW) return;
  const be = backend(); if (!be || !be.cf) return;
  let pend = null; try { pend = JSON.parse(sessionStorage.getItem(PEND()) || "null"); } catch (e) {}
  history.replaceState(null, "", location.pathname);
  if (!pend || !pend.data || pend.data.reg_no !== no || pend.g !== g) return;
  const f = $("#regform"), msg = f && $(".form-msg", f), b = f && $("button[type=submit]", f); if (b) b.disabled = true;
  if (msg) { msg.className = "form-msg"; msg.textContent = "Confirming your payment…"; msg.scrollIntoView({ block: "center" }); }
  const s = await regSave(pend.data, pend.cart, { gw: g, ref: pend.ref }).catch(() => ({ ok: false, error: "" }));
  if (s.ok) { try { sessionStorage.removeItem(PEND()); } catch (e) {} regDone(f, pend.data, "paid"); }
  else { if (msg) { msg.className = "form-msg bad"; msg.textContent = s.error || "We couldn't confirm the payment just now. Refresh this page to try again."; } if (b) b.disabled = false; }
}
/** Saves a form's answers where this site keeps them (the same places as the enquiry form). Gives "saved", or "mail" when the visitor's email app was opened. */
async function sendData(data, subject) {
  const cfg = backend(), guard = (C.privacy || {}).spam !== false, took = Math.max(1600, Math.round(performance.now() - FORM_T0));
  if (!cfg && C.contact.form.saveTo === "file") throw new Error("not connected");
  if (cfg && cfg.file) { const r = await fetch(cfg.file, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "submit", data, page: location.pathname }) }); if (!r.ok) throw new Error("save " + r.status); return "saved"; }
  if (cfg && cfg.cf) { const r = await fetch(cfg.cf + "/enquire/" + encodeURIComponent(cfg.site), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data, page: location.pathname, ...(guard ? { took } : {}) }) }); if (!r.ok) throw new Error("save " + r.status); return "saved"; }
  if (cfg) { const r = await fetch(cfg.url + "/rest/v1/site_enquiries", { method: "POST", headers: { apikey: cfg.key, ...(/^sb_/.test(cfg.key) ? {} : { Authorization: "Bearer " + cfg.key }), "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ site: cfg.site, data, page: location.pathname }) }); if (!r.ok) throw new Error("save " + r.status); return "saved"; }
  const body = Object.entries(data).filter(([, v]) => v).map(([k, v]) => `${k[0].toUpperCase() + k.slice(1).replace(/_/g, " ")}: ${v}`).join("\n");
  location.href = `mailto:${encodeURIComponent(C.contact.email || "")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return "mail";
}

function heroHTML() {
  const H = C.hero, vid = imgUrl(H.video), im = imgUrl(H.image);
  // A hero video plays silently on a loop in the picture's place (the picture is its cover); still for visitors who asked for less motion.
  const film = vid ? `<video src="${esc(vid)}"${im ? ` poster="${esc(im)}"` : ""}${matchMedia("(prefers-reduced-motion: reduce)").matches ? "" : " autoplay"} muted loop playsinline aria-hidden="true"></video>` : "";
  const media = vid ? `<div class="hero-media" data-edit="hero.video">${film}</div>` : im ? `<div class="hero-media" data-edit="hero.image"><img src="${esc(im)}" alt=""></div>` : (H.panel || {}).show === false ? "" : `<div class="hero-media none" data-edit="hero.panel.show">${heroPanel()}</div>`;
  const badges = (H.badges || []).filter(Boolean).length ? `<ul class="badges">${H.badges.filter(Boolean).map((b) => `<li>${icon("spark", "bi")}${esc(b)}</li>`).join("")}</ul>` : "";
  const pic = im || vid;
  return `<section class="hero${pic ? " has-img" : ""}" id="hero">${C.theme.layout === "full" && pic ? `<div class="hero-bg" data-edit="${vid ? "hero.video" : "hero.image"}"${im ? ` style="background-image:url('${esc(im)}')"` : ""}>${film}</div>` : ""}
    <div class="wrap hero-in"><div class="hero-text">${H.eyebrow ? `<p class="eyebrow">${esc(H.eyebrow)}</p>` : ""}<h1 class="h1 fit">${rich(H.title)}</h1>${H.lede ? `<p class="hero-lede">${rich(H.lede)}</p>` : ""}${H.showMeta === false ? "" : evMeta()}
      <div class="cta-row">${btn(H.ctaPrimary, H.ctaPrimaryTarget)}${btn(H.ctaSecondary, H.ctaSecondaryTarget, "sec")}</div>${countdownHTML()}${badges}</div>
      ${C.theme.layout === "full" && pic ? "" : media}</div></section>`;
}
function clientsHTML() {
  const L = C.clients.logos.filter((l) => l.name || l.logo);
  if (!L.length) return "";
  return `<section class="clients" id="clients"><div class="wrap">${C.clients.title ? `<p class="clients-t">${esc(C.clients.title)}</p>` : ""}<ul class="logos">${L.map((l) => `<li title="${esc(l.name)}">${l.logo ? `<img src="${esc(imgUrl(l.logo))}" alt="${esc(l.name)}">` : `<span>${esc(l.name)}</span>`}</li>`).join("")}</ul></div></section>`;
}
function servicesHTML(full) {
  const S = C.services, items = S.items;
  return `<section class="services band" id="services"><div class="wrap">${head(S)}<div class="svc-grid">${items.map((s, i) => `<article class="card svc rv" style="--i:${i}">
      <span class="svc-ic">${icon(s.icon)}</span><h3 class="h3">${esc(s.title)}</h3><p>${rich(s.body)}</p>${(s.points || []).length ? `<ul class="ticks">${s.points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>` : ""}</article>`).join("")}</div>
</div></section>`;
}
function statsHTML() {
  const I = C.stats.items.filter((s) => s.value || s.label);
  if (!I.length) return "";
  return `<section class="stats" id="stats"><div class="wrap"><dl class="stat-row">${I.map((s) => `<div class="stat rv"><dt>${esc(s.label)}</dt><dd>${esc(s.value)}</dd></div>`).join("")}</dl></div></section>`;
}
function workHTML(full) {
  const W = C.work, items = W.items; if (!items.length) return "";
  return `<section class="work band" id="work"><div class="wrap">${head(W)}<div class="cases">${items.map((w, i) => {
    const im = imgUrl(w.image), u = safeUrl(w.url), tag = u ? "a" : "article";
    return `<${tag} class="card case rv"${u ? ` href="${esc(u)}" target="_blank" rel="noopener"` : ""} style="--i:${i}"><div class="case-media">${im ? `<img src="${esc(im)}" alt="" loading="lazy">` : `<span class="case-ph" aria-hidden="true"><b>${esc(initials(w.client || w.title))}</b></span>`}</div>
      <div class="case-body"><p class="case-meta">${[w.client, w.sector].filter(Boolean).map(esc).join(" · ")}</p><h3 class="h3">${esc(w.title)}</h3><p>${rich(w.summary)}</p>${w.result ? `<p class="case-result">${icon("chart", "ri")}${esc(w.result)}</p>` : ""}${u ? `<span class="link">See more ${arrow}</span>` : ""}</div></${tag}>`;
  }).join("")}</div>
</div></section>`;
}
function aboutHTML() {
  const A = C.about, im = imgUrl(A.image);
  return `<section class="about" id="about"><div class="wrap"><div class="about-grid">
      <div class="about-text">${head(A, "left")}<div class="prose">${paras(A.body)}</div></div>
      <div class="about-side">${im ? `<div class="about-img"><img src="${esc(im)}" alt="" loading="lazy"></div>` : ""}
        ${A.mission || A.vision ? `<div class="mv">${A.mission ? `<div class="card mv-i"><span class="mv-k">Mission</span><p>${rich(A.mission)}</p></div>` : ""}${A.vision ? `<div class="card mv-i"><span class="mv-k">Vision</span><p>${rich(A.vision)}</p></div>` : ""}</div>` : ""}</div></div>
    ${(A.values || []).length ? `<div class="values">${A.values.map((v, i) => `<div class="value rv" style="--i:${i}"><span class="vn">${String(i + 1).padStart(2, "0")}</span><h3 class="h3">${esc(v.title)}</h3><p>${rich(v.body)}</p></div>`).join("")}</div>` : ""}</div></section>`;
}
function processHTML() {
  const P = C.process;
  return `<section class="process band" id="process"><div class="wrap">${head(P)}<ol class="steps">${P.steps.map((s, i) => `<li class="step rv" style="--i:${i}"><span class="sn">${i + 1}</span><h3 class="h3">${esc(s.title)}</h3><p>${rich(s.body)}</p></li>`).join("")}</ol></div></section>`;
}
/** Five stars, filled up to the rating. */
const starRow = (n) => { const r = Math.max(0, Math.min(5, Math.round(+n || 0))); return "★".repeat(r) + `<span class="off">${"★".repeat(5 - r)}</span>`; };
function testimonialsHTML() {
  const T = C.testimonials;
  if (!T.items.length) return "";
  const G = T.google && T.google.rating && T.items.some((q) => q.source === "google") ? T.google : null;
  return `<section class="testimonials band" id="testimonials"><div class="wrap">${head(T)}${G ? `<p class="g-sum"><a href="${esc(G.url || "#")}" target="_blank" rel="noopener"><span class="stars" aria-hidden="true">${starRow(G.rating)}</span> <b>${(+G.rating).toFixed(1)}</b> from ${esc(String(G.count))} reviews on Google</a></p>` : ""}<div class="quotes">${T.items.map((q, i) => `<figure class="card quote rv" style="--i:${i}"><span class="qm" aria-hidden="true">“</span>${q.rating ? `<span class="stars" role="img" aria-label="${+q.rating} out of 5 stars">${starRow(q.rating)}</span>` : ""}<blockquote>${rich(q.quote)}</blockquote>
      <figcaption><span class="qa">${esc(initials(q.name))}</span><span><b>${esc(q.name)}</b><small>${[q.role, q.company].filter(Boolean).map(esc).join(", ")}</small></span></figcaption></figure>`).join("")}</div></div></section>`;
}
function faqHTML() {
  const F = C.faq;
  if (!F.items.length) return "";
  return `<section class="faq band" id="faq"><div class="wrap faq-grid">${head(F, "left")}<div class="qa-list">${F.items.map((q) => `<details class="qa-i"><summary>${esc(q.q)}<span class="pm" aria-hidden="true"></span></summary><div class="qa-a">${paras(q.a)}</div></details>`).join("")}</div></div></section>`;
}
function ctaHTML() {
  const X = C.cta;
  if (!X.title) return "";
  return `<section class="cta" id="cta"><div class="wrap"><div class="cta-box"><div><h2 class="h2">${rich(X.title)}</h2>${X.body ? `<p>${rich(X.body)}</p>` : ""}</div>${btn(X.button, X.target || "contact", "inv")}</div></div></section>`;
}
function contactHTML() {
  const K = C.contact, F = K.form, svc = C.services.items.map((s) => s.title).filter(Boolean);
  const line = (ic, label, val, link) => val ? `<li>${icon(ic, "ci")}<span><small>${esc(label)}</small>${link ? `<a href="${esc(link)}">${ml(val)}</a>` : ml(val)}</span></li>` : "";
  const field = (id, label, input, req) => `<label class="fld" for="f-${id}"><span>${esc(label)}${req ? ' <i aria-hidden="true">*</i>' : ""}</span>${input}</label>`;
  const form = F.enabled ? `<form class="card form" id="enquiry" novalidate>
      ${F.title ? `<h3 class="h3">${esc(F.title)}</h3>` : ""}
      <div class="row2">${field("name", "Name", `<input id="f-name" name="name" required autocomplete="name">`, 1)}${field("email", "Email", `<input id="f-email" name="email" type="email" required autocomplete="email">`, 1)}</div>
      ${F.askPhone || F.askCompany ? `<div class="row2">${F.askPhone ? field("phone", "Phone", `<input id="f-phone" name="phone" type="tel" autocomplete="tel">`) : ""}${F.askCompany ? field("company", "Company", `<input id="f-company" name="company" autocomplete="organization">`) : ""}</div>` : ""}
      ${F.askService || F.askBudget ? `<div class="row2">${F.askService && svc.length ? field("service", "Interested in", `<select id="f-service" name="service"><option value="">Choose…</option>${svc.map((s) => `<option>${esc(s)}</option>`).join("")}<option>Something else</option></select>`) : ""}${F.askBudget && (F.budgets || []).length ? field("budget", "Budget", `<select id="f-budget" name="budget"><option value="">Choose…</option>${F.budgets.map((b) => `<option>${esc(b)}</option>`).join("")}</select>`) : ""}</div>` : ""}
      ${field("message", "How can we help?", `<textarea id="f-message" name="message" rows="5" required></textarea>`, 1)}
      <input class="hp-f" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
      ${consentWords(F.consent) ? `<label class="consent"><input type="checkbox" name="consent" required> <span>${esc(consentWords(F.consent))}</span></label>` : ""}
      <p class="form-msg" role="status" aria-live="polite"></p>
      <button class="btn pri" type="submit">${esc(F.submit || "Send")} ${arrow}</button></form>` : "";
  return `<section class="contact band" id="contact"><div class="wrap">${head(K)}<div class="contact-grid">
      <aside class="contact-info"><ul class="cl">${line("briefcase", "Email", K.email, K.email ? "mailto:" + K.email : "")}${line("people", "Phone", K.phone, K.phone ? "tel:" + K.phone.replace(/[^\d+]/g, "") : "")}${line("pin", "Address", K.address, safeUrl(K.mapUrl))}${line("cog", "Hours", K.hours, "")}</ul>
        ${K.whatsapp || K.linkedin ? `<div class="cta-row">${K.whatsapp ? `<a class="btn sec" href="https://wa.me/${esc(String(K.whatsapp).replace(/\D/g, ""))}" target="_blank" rel="noopener">WhatsApp</a>` : ""}${safeUrl(K.linkedin) ? `<a class="btn sec" href="${esc(safeUrl(K.linkedin))}" target="_blank" rel="noopener">LinkedIn</a>` : ""}</div>` : ""}</aside>
      ${form}</div></div></section>`;
}
const RENDER = { wall: wallSlot, hero: heroHTML, clients: clientsHTML, services: () => servicesHTML(true), stats: statsHTML, schedule: () => scheduleHTML(PAGE === "schedule"), team: () => teamHTML(PAGE === "lineup"), tickets: ticketsHTML, gallery: galleryHTML, venue: venueHTML, work: () => workHTML(true), about: aboutHTML, process: processHTML, testimonials: testimonialsHTML, faq: faqHTML, cta: ctaHTML, contact: contactHTML };

/* ============================================================
   PAGE
   ============================================================ */
/** The pages in the menu when the site has several. */
const mpages = () => ["schedule", "lineup", "about", "contact"].filter((p) => p !== "schedule" || shown("schedule")).filter((p) => p !== "lineup" || shown("team"));
/* The logo's size and shape in the menu (Brand → Logo): a square icon of the chosen height, or a wide logo that keeps
   its own proportions (never cropped, no rounded corners). */
function logoCss(def) {
  const B = C.brand, h = Math.max(20, Math.min(96, +B.logoSize || def));
  return B.logoFit === "wide" ? `height:${h}px;width:auto;max-width:min(${h * 6}px,52vw);object-fit:contain;border-radius:0` : `width:${h}px;height:${h}px${h !== def ? `;font-size:${Math.round(h * 0.36)}px` : ""}`;
}
function heroLogo() {
  const B = C.brand, on = PAGE === "home" && B.logoOnHero, src = on ? imgUrl(B.logo) : "";
  if (window.SiteLogo) window.SiteLogo.hero(src, { video: on ? imgUrl(B.logoVideo) : "", at: "#hero h1", size: B.heroLogoSize, radius: C.theme.logoRadius, wide: B.logoFit === "wide", edit: "brand.logo" });
}
function navHTML() {
  const B = C.brand, logo = imgUrl(B.logo);
  const items = multi()
    ? mpages().map((p) => ({ label: C.site.pageLabels[p] || p, url: PAGES[p], on: PAGE === p }))
    : flowed().filter((s) => s.show !== false && s.inNav && RENDER[s.id] && (s.id !== "wall" || wallSlot())).map((s) => ({ label: s.label, url: AT + "#" + s.id }));
  spList().filter((p) => p.inNav).forEach((p) => items.push({ label: p.navLabel || p.title, url: spHref(p), on: PAGE === "page" && spSlug(p) === spSlug({ slug: spCur() }) }));
  return `<header class="nav" id="top"><div class="wrap nav-in">
      <a class="brand" href="${multi() || PAGE !== "home" ? PAGES.home : "#top"}">${imgUrl(B.logoVideo) ? `<video class="logo" src="${esc(imgUrl(B.logoVideo))}"${logo ? ` poster="${esc(logo)}"` : ""} autoplay muted loop playsinline aria-hidden="true" style="${logoCss(36)}"></video>` : logo ? `<img class="logo" src="${esc(logo)}" alt="" style="${logoCss(36)}">` : `<span class="logo mark" style="${logoCss(36).replace(/height:(\d+)px;width:auto.*/, "width:$1px;height:$1px")}">${esc(initials(B.name))}</span>`}${B.showName !== false ? `<span class="bn">${esc(B.name)}</span>` : ""}</a>
      <nav class="links" aria-label="Main">${items.map((i) => `<a href="${esc(i.url)}"${i.on ? ' aria-current="page"' : ""}>${esc(i.label)}</a>`).join("")}</nav>
      ${C.nav.cta ? `<a class="btn pri nav-cta" href="${esc(href(C.nav.ctaTarget || "contact"))}">${esc(C.nav.cta)}</a>` : ""}
      <button class="burger" type="button" aria-expanded="false" aria-controls="mnav" aria-label="Menu"><span></span><span></span></button></div>
    <nav class="mnav" id="mnav" aria-label="Main">${items.map((i) => `<a href="${esc(i.url)}">${esc(i.label)}</a>`).join("")}${C.nav.cta ? `<a class="btn pri" href="${esc(href(C.nav.ctaTarget || "contact"))}">${esc(C.nav.cta)}</a>` : ""}</nav></header>`;
}
function pageHead() {
  const S = { schedule: C.schedule, lineup: C.team, about: C.about, contact: C.contact }[PAGE];
  if (!S) return "";
  return `<section class="phead" id="page"><div class="wrap"><p class="crumbs"><a href="${PAGES.home}">${esc(C.site.pageLabels.home || "Home")}</a> / ${esc(C.site.pageLabels[PAGE] || PAGE)}</p><h1 class="h1">${rich(S.title)}</h1>${S.lede ? `<p class="hero-lede">${rich(S.lede)}</p>` : ""}</div></section>`;
}
function footerHTML() {
  const F = C.footer, B = C.brand, K = C.contact;
  const cols = multi() ? mpages().map((p) => `<a href="${PAGES[p]}">${esc(C.site.pageLabels[p] || p)}</a>`) : C.sections.filter((s) => s.show !== false && s.inNav && RENDER[s.id] && (s.id !== "wall" || wallSlot())).map((s) => `<a href="${AT}#${s.id}">${esc(s.label)}</a>`);
  spList().filter((p) => p.inFooter !== false).forEach((p) => cols.push(`<a href="${esc(spHref(p))}">${esc(p.navLabel || p.title)}</a>`));
  if (ckOn()) cols.push(`<a href="#cookie-settings">${esc(C.consent.reopenLabel || "Cookie settings")}</a>`);
  return `<footer class="foot" id="footer"><div class="wrap"><div class="foot-grid">
      <div><a class="brand" href="${multi() || PAGE !== "home" ? PAGES.home : "#top"}">${imgUrl(B.logo) ? `<img class="logo" src="${esc(imgUrl(B.logo))}" alt=""${B.logoFit === "wide" ? ` style="height:36px;width:auto;max-width:200px;object-fit:contain;border-radius:0"` : ""}>` : `<span class="logo mark">${esc(initials(B.name))}</span>`}<span class="bn">${esc(B.name)}</span></a><p>${rich(F.text)}</p></div>
      <nav aria-label="Footer">${cols.join("")}</nav>
      <div class="fc">${K.email ? `<a href="mailto:${esc(K.email)}">${esc(K.email)}</a>` : ""}${K.phone ? `<a href="tel:${esc(K.phone.replace(/[^\d+]/g, ""))}">${esc(K.phone)}</a>` : ""}${K.address ? `<span>${ml(K.address)}</span>` : ""}</div></div>
    <div class="foot-legal"><span>${esc(String(F.legal || "").replace(/\{year\}/g, new Date().getFullYear()))}</span><span>${(F.links || []).filter((l) => l.label).map((l) => safeUrl(l.url) ? `<a href="${esc(safeUrl(l.url))}">${esc(l.label)}</a>` : `<span>${esc(l.label)}</span>`).join("")}</span></div></div></footer>`;
}
/** One section on a page of its own (see soloSections). */
function sectionPage() {
  const id = soloCur(), sec = C.sections.find((x) => x.id === id), body = sec && RENDER[id] && id !== "hero" && shown(id) ? RENDER[id]() : "";
  const crumbs = `<p class="crumbs"><a href="${PAGES.home}">${esc((C.site.pageLabels || {}).home || "Home")}</a> / ${esc((sec && sec.label) || "")}</p>`;
  if (!body) return `<section class="phead"><div class="wrap">${crumbs}<h1 class="h1">${esc((sec && sec.label) || "Page")}</h1><p class="hero-lede">${PREVIEW ? "This section is hidden or has nothing to show yet." : "There is nothing here right now."}</p></div></section>`;
  return `<div class="solo-top"><div class="wrap">${crumbs}</div></div>${body}`;
}
function staticPage() {
  const S = window.SitePages; if (!S) return "";
  const p = S.find(C, spCur(), PREVIEW), o = { home: PAGES.home, homeLabel: C.site.pageLabels.home || "Home", preview: PREVIEW };
  return p ? S.article(p, o) : S.missing(o);
}
/** The browser-tab icon: the uploaded logo, else the name's initials in the accent colour. The logo is used as it
 *  is straight away, then swapped for a square copy (the whole logo, centred) so a wide logo isn't squashed. */
let iconKey = "";
function setIcon() {
  const B = C.brand, t = C.theme, acc = t.c1, rad = Math.max(0, Math.min(50, t.logoRadius ?? 22)), src = imgUrl(B.logo), key = [src, B.name, rad, acc].join("|");
  if (key === iconKey) return; iconKey = key;
  let l = document.querySelector("link[rel=icon]"); if (!l) { l = document.createElement("link"); l.rel = "icon"; document.head.appendChild(l); }
  document.querySelectorAll('link[rel="shortcut icon"], link[rel="apple-touch-icon"]').forEach((x) => x.remove());
  if (src) {
    l.removeAttribute("type"); l.href = src;
    const im = new Image(); im.crossOrigin = "anonymous";
    im.onload = () => { try {
      if (iconKey !== key || !im.width || Math.abs(im.width - im.height) < 3) return;
      const cv = document.createElement("canvas"); cv.width = cv.height = 128; const s = Math.min(128 / im.width, 128 / im.height);
      cv.getContext("2d").drawImage(im, (128 - im.width * s) / 2, (128 - im.height * s) / 2, im.width * s, im.height * s);
      const u = cv.toDataURL("image/png"); if (iconKey === key) { l.type = "image/png"; l.href = u; }
    } catch (e) { /* the photo host doesn't allow copying: the logo itself stays as the icon */ } };
    im.src = src;
    return;
  }
  const ini = String(B.name || "").split(/\s+/).map((w) => w[0] || "").join("").slice(0, 2).toUpperCase() || "•";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="${(rad * 0.64).toFixed(1)}" fill="${esc(acc)}"/><text x="32" y="34" dominant-baseline="middle" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="${ini.length > 1 ? 26 : 34}" fill="${onColor(acc)}">${esc(ini)}</text></svg>`;
  l.type = "image/svg+xml"; l.href = "data:image/svg+xml," + encodeURIComponent(svg);
}
/* Features (assets/addons.js): chat button, badge, custom code and the custom API for form entries. */
let adP;
function addons() {
  const A = C.addons || {}, any = (A.chat && A.chat.on) || (A.badge && A.badge.on) || (A.api && A.api.on) || (A.code || []).some((x) => x && x.on !== false && x.code);
  if (!any && !window.SiteAddons) return;
  (adP ||= new Promise((ok, no) => { if (window.SiteAddons) return ok(); const s = document.createElement("script"); s.src = "assets/addons.js"; s.onload = () => ok(); s.onerror = no; document.head.appendChild(s); }))
    .then(() => window.SiteAddons.mount(C, { preview: PREVIEW, home: PAGE === "home", site: C.brand.name })).catch(() => {});
}
/* Festival overlay (assets/festival.js): greetings on India's festivals, when the Studio offered it to this site. */
let fsP;
function festival() {
  const F = C.festival || {};
  if (!(F.on !== false && (F.v >= 2 || F.allowed)) && !window.SiteFestival) return;
  (fsP ||= new Promise((ok, no) => { if (window.SiteFestival) return ok(); const s = document.createElement("script"); s.src = "assets/festival.js"; s.onload = () => ok(); s.onerror = no; document.head.appendChild(s); }))
    .then(() => window.SiteFestival.mount(C, { preview: PREVIEW, site: C.brand.name })).catch(() => {});
}
/* Social links in the footer (assets/social.js). */
let ssP;
function social() {
  const S = C.social || {};
  if (!S.on && !window.SiteSocial) return;
  (ssP ||= new Promise((ok, no) => { if (window.SiteSocial) return ok(); const s = document.createElement("script"); s.src = "assets/social.js"; s.onload = () => ok(); s.onerror = no; document.head.appendChild(s); }))
    .then(() => window.SiteSocial.mount(C, { footer: "footer.foot", before: ".foot-legal", imgUrl })).catch(() => {});
}
/* The social photo wall (assets/wall.js): the owner's Instagram or Pinterest photos. It is one of the page's sections: its row under
   Sections & order switches it on and sets where it stands; the script fills the empty slot drawn there, with this page's own
   section heading, wrapper and button, so it wears the theme like the other sections. */
const wallOn = () => { const s = C.sections.find((x) => x.id === "wall"); return s ? s.show !== false : !!(C.wall && C.wall.on); };
function wallSlot() { return wallOn() && C.wall && ((Array.isArray(C.wall.items) && C.wall.items.length) || /^(instagram|pinterest)$/.test(C.wall.auto)) ? `<section id="wall" data-wall-slot hidden></section>` : ""; }
let wallP = null;
function wall() {
  if (!wallOn() && !window.SiteWall) return;
  (wallP ||= new Promise((ok, no) => { if (window.SiteWall) return ok(); const s = document.createElement("script"); s.src = "assets/wall.js"; s.onload = () => ok(); s.onerror = no; document.head.appendChild(s); }))
    // A site saved before the wall became a row in the list has no row for it: it keeps its old place on the home page.
    .then(() => window.SiteWall.mount(C, C.sections.some((x) => x.id === "wall") ? { on: wallOn(), slot: "only", imgUrl, head: head({ eyebrow: C.wall.eyebrow, title: C.wall.title, lede: C.wall.text }), wrap: "wrap", cls: "sw-ctr", btn: "btn pri" } : { sections: "#main > section", home: PAGE === "home", imgUrl })).catch(() => {});
}
/* The video section (assets/video.js): one video on the home page, placed among its sections. */
let svP;
function video() {
  const V = C.video || {};
  if (!V.on && !window.SiteVideo) return;
  (svP ||= new Promise((ok, no) => { if (window.SiteVideo) return ok(); const s = document.createElement("script"); s.src = "assets/video.js"; s.onload = () => ok(); s.onerror = no; document.head.appendChild(s); }))
    .then(() => window.SiteVideo.mount(C, { sections: "#main > section", home: PAGE === "home", imgUrl })).catch(() => {});
}
/** The footer's link that reopens the consent choices (while the banner is on). */
/* Legal & privacy: the privacy policy's address, and the words of the consent tick box on forms (content.privacy). */
const policyUrl = () => { const K = C.consent || {}; if (safeUrl(K.policyUrl)) return safeUrl(K.policyUrl); const L = spList(), p = L.find((x) => x.id === K.policyPage) || L.find((x) => x.id === "pg-privacy" || /privacy/i.test(String(x.title || ""))); return p ? spHref(p) : ""; };
const consentWords = (own) => String(own || "").trim() || ((C.privacy || {}).formConsent === false ? "" : String((C.privacy || {}).formText || "").trim() || "I agree to my details being used to respond to me, as described in the Privacy policy.");
const ckOn = () => !!(C.consent && C.consent.on && C.consent.footerLink !== false);
/* Regional languages (assets/lang.js): the chosen language is put into the content before the page is drawn, then
   the page's fixed wording is translated and the language switcher added. */
let lgP, lgFail = false;
// Also loaded for the owner's own words for the page's fixed wording (content.words).
const langOn = () => { const n = C.i18n || {}; return (!!n.on && (n.langs || []).some((l) => l && l.on !== false)) || (!!C.words && Object.values(C.words).some((v) => typeof v === "string" && v.trim())); };
function langGate() {
  if (window.SiteLang) { if (PREVIEW) window.SiteLang.force((C.i18n || {}).preview || ""); window.SiteLang.apply(C); return false; }
  if (!langOn() || lgFail) return false;
  (lgP ||= new Promise((ok, no) => { const s = document.createElement("script"); s.src = "assets/lang.js"; s.onload = () => ok(); s.onerror = no; document.head.appendChild(s); })).then(render, () => { lgFail = true; render(); });
  return true;
}
function lang() { if (window.SiteLang) window.SiteLang.mount(C, { navs: [".nav .links", "#mnav"], keep: "a.btn", again: render }); }
/* Cookie consent (assets/consent.js): the banner that asks before analytics, marketing and other optional code runs. */
let csP;
function consent() {
  if (!(C.consent || {}).on && !window.SiteConsent) return;
  (csP ||= new Promise((ok, no) => { if (window.SiteConsent) return ok(); const s = document.createElement("script"); s.src = "assets/consent.js"; s.onload = () => ok(); s.onerror = no; document.head.appendChild(s); }))
    .then(() => window.SiteConsent.mount(C, { preview: PREVIEW, pageUrl: (id) => { const p = spList().find((x) => x.id === id); return p ? spHref(p) : ""; } })).catch(() => {});
}
/* The owner's own menu with sub-menus (assets/menu.js), in place of the automatic links. */
let mnP;
const menuOn = () => !!(C.menu && C.menu.custom && (C.menu.items || []).some((i) => i && i.show !== false && String(i.label || "").trim()));
function menuGo(it) {
  const t = it.to || "";
  if (t === "none") return { url: "" };
  if (t === "url") { const u = String(it.url || "").trim(); return { url: safeUrl(u) || (/^(#|\/|\.\/|[\w-]+\.html)/.test(u) ? u : "") }; }
  if (t === "page") { const p = spList().find((x) => x.id === it.page); return p ? { url: spHref(p), on: PAGE === "page" && spSlug(p) === spSlug({ slug: spCur() }) } : { url: "" }; }
  const url = href(t === "home" ? "hero" : t);
  if (!multi() && soloSections().has(t)) return { url, on: PAGE === "section" && soloCur() === t, self: true };
  return { url: t === "home" && !multi() ? AT + "#top" : url, on: (multi() && (url === PAGES[PAGE])) || (PAGE === "section" && soloCur() === t) };
}
function menu() {
  if (!menuOn()) return;
  const done = () => { const w = document.getElementById("sm-wait"); if (w) w.remove(); };
  if (!window.SiteMenu && !document.getElementById("sm-wait")) { const w = document.createElement("style"); w.id = "sm-wait"; w.textContent = ".nav .links,#mnav{visibility:hidden}"; document.head.appendChild(w); setTimeout(done, 2500); }
  (mnP ||= new Promise((ok, no) => { if (window.SiteMenu) return ok(); const s = document.createElement("script"); s.src = "assets/menu.js"; s.onload = () => ok(); s.onerror = no; document.head.appendChild(s); }))
    .then(() => {
      window.SiteMenu.mount(C, { navs: [".nav .links", "#mnav"], keep: "a.btn", resolve: menuGo, onPick: (a, e) => {
        const b = $(".burger"), m = $("#mnav"); b && b.setAttribute("aria-expanded", "false"); m && m.classList.remove("open");
      } });
      done();
    }).catch(done);
}
/* Maintenance mode (assets/maint.js): while content.maintenance.on, visitors see the maintenance page instead of the
   site. The editor's preview shows it too (with a button to see the site), and on its "Maintenance page" entry
   (?maintenance=1) while it is off. */
const MNT_Q = /[?&]maintenance=1(&|$)/.test(location.search);
let mntP, mntPass = false;
function maintGate(again) {
  const on = (PREVIEW && MNT_Q) || !!(C.maintenance || {}).on;
  if (!on || mntPass) { if (window.SiteMaint) window.SiteMaint.hide(); return false; }
  (mntP ||= new Promise((ok, no) => { if (window.SiteMaint) return ok(); const s = document.createElement("script"); s.src = "assets/maint.js"; s.onload = () => ok(); s.onerror = no; document.head.appendChild(s); }))
    .then(() => {
      if (window.SiteMaint.wanted(C, PREVIEW)) window.SiteMaint.show(C, { name: C.brand.name, logo: imgUrl(C.brand.logo), preview: PREVIEW, again });
      else { mntPass = true; again(); }
    }).catch(() => { mntPass = true; again(); });
  return true;
}
let lastHtml = "", drawn = false;
function render() {
  // A several-page link opened while the site is one page goes to that section.
  // A section's own page: only while its link still says so; otherwise the visitor goes to that section on the main page.
  if (PAGE === "section" && !PREVIEW && !soloSections().has(soloCur())) { location.replace(multi() ? href(soloCur()) : PAGES.home + (RENDER[soloCur()] ? "#" + soloCur() : "")); return; }
  if (!PREVIEW && !multi() && !["home", "register", "page", "section"].includes(PAGE)) { location.replace(PAGES.home + "#" + (PAGE === "lineup" ? "team" : PAGE)); return; }
  if (langGate()) return;
  applyTheme(C.theme); setTitle(); setIcon();
  if (maintGate(render)) return;
  const special = { register: registerPage, page: staticPage, section: sectionPage }[PAGE];
  const solo = soloSections();
  const ids = special ? [] : multi() ? (PAGE === "home" ? flowed().map((s) => s.id).filter((id) => PAGE_SECTIONS.home.includes(id)) : PAGE_SECTIONS[PAGE]) : flowed().map((s) => s.id).filter((id) => !solo.has(id));
  const body = special ? special() : ids.filter((id) => RENDER[id] && shown(id)).map((id) => RENDER[id]()).join("");
  const html = `<a class="skip" href="#main">Skip to content</a>${navHTML()}<main id="main">${multi() && !special && PAGE !== "home" ? pageHead() : ""}${body}</main>${footerHTML()}`;
  /* A redraw that gives what is already on screen is skipped, and one that lands while the entrance is still running carries on from where it was: both used to make the page blink. */
  if (!PREVIEW && html === lastHtml && $("#app").firstChild) return;
  lastHtml = html; const pend = drawn ? new Set($$(".rv").map((e, i) => (e.classList.contains("in") ? -1 : i))) : null; drawn = true;
  $("#app").innerHTML = html;
  if (pend) $$(".rv").forEach((e, i) => { if (!pend.has(i)) e.classList.add("in"); });
  if (SC && SC.drawn) SC.drawn($("#app"), C);
  bind();
  if (PAGE === "page" && window.SitePages) window.SitePages.after(window.SitePages.find(C, spCur(), PREVIEW));
  slides(); heroLogo(); video(); social(); wall(); menu(); lang(); consent(); addons(); festival();
  if (window.SiteFX) try { window.SiteFX.init({ root: $("#app"), brand: C.theme.introTitle || C.brand.name, badge: C.poweredBy, bgs: C.sectionBg, asset: imgUrl, fonts: FONTS, c: C, policy: policyUrl(), again: render }); } catch (e) {}
}

/* ============================================================
   BEHAVIOUR
   ============================================================ */
function bind() {
  const b = $(".burger"), m = $("#mnav");
  if (b) b.onclick = () => { const o = b.getAttribute("aria-expanded") !== "true"; b.setAttribute("aria-expanded", String(o)); m.classList.toggle("open", o); };
  $$("#mnav a").forEach((a) => a.addEventListener("click", () => { b && b.setAttribute("aria-expanded", "false"); m.classList.remove("open"); }));
  const nav = $(".nav"); const onS = () => nav && nav.classList.toggle("scrolled", scrollY > 8); addEventListener("scroll", onS, { passive: true }); onS();
  // Reveal on scroll
  const rv = $$(".rv");
  if (C.theme.motionStyle === "none" || matchMedia("(prefers-reduced-motion: reduce)").matches || /[?&]lite=1\b/.test(location.search) || !("IntersectionObserver" in window)) rv.forEach((e) => e.classList.add("in"));
  else { const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px" }); rv.forEach((e) => io.observe(e)); }
  const f = $("#enquiry"); if (f) f.addEventListener("submit", submit);
  bindRegister(); countdown(); if ($(".tickets")) regInfo();
  $$(".sch-tabs .chip").forEach((b) => b.addEventListener("click", () => { const box = b.closest("section"); $$(".sch-tabs .chip", box).forEach((x) => x.setAttribute("aria-pressed", String(x === b))); $$(".sch-day", box).forEach((d) => { d.hidden = d.dataset.day !== b.dataset.day; if (!d.hidden) $$(".rv", d).forEach((e) => e.classList.add("in")); }); }));
}

/* Hero background slides (assets/slides.js, loaded when switched on). */
let slP, slGen = 0;
function slides() {
  const S = C.hero.slides, g = ++slGen, host = $("#hero");
  const H = document.documentElement;
  if (!host || !S || !S.enabled || !(S.items || []).some((x) => x && (x.image || x.video))) { if (window.SiteSlides) window.SiteSlides.stop(); H.classList.remove("hs-top", "hs-top-light"); return; }
  (slP ||= new Promise((ok, no) => { if (window.SiteSlides) return ok(window.SiteSlides); const s = document.createElement("script"); s.src = "assets/slides.js"; s.onload = () => ok(window.SiteSlides); s.onerror = no; document.head.appendChild(s); }))
    .then((w) => {
      if (g !== slGen) return;
      w.mount(host, S, { imgUrl, title: ".h1", text: ".hero-lede", hide: ".hero-media,.hero-bg" });
      // The photos run up behind the header, so the header and the hero read as one piece (not a strip above the photos).
      const nav = $(".nav"), top = !!nav && !host.previousElementSibling && H.dataset.nav !== "dark" && H.dataset.layout !== "panel" && host.classList.contains("hs-host");
      H.classList.toggle("hs-top", top); H.classList.toggle("hs-top-light", top && host.classList.contains("hs-light"));
      if (top) { const fit = () => H.style.setProperty("--nav-h", nav.offsetHeight + "px"); fit(); if (!slides.bound) { slides.bound = true; addEventListener("resize", fit); } }
    }).catch(() => {});
}
/** Where enquiries go: the hosted site's Supabase, the form's own Supabase settings, or email. */
function backend() {
  const F = C.contact.form;
  if (F.saveTo === "file") return /^https:\/\//.test(F.fileUrl || "") ? { file: F.fileUrl } : null;
  if (HOST && HOST.api && HOST.site) return { cf: HOST.api, site: HOST.site };
  if (HOST && HOST.db && HOST.key && HOST.site) return { url: HOST.db, key: HOST.key, site: HOST.site };
  if (/^https:\/\//.test(F.sbUrl || "") && F.sbKey && F.site) return { url: String(F.sbUrl).replace(/\/+$/, ""), key: F.sbKey, site: F.site };
  return null;
}
let FORM_T0 = 0; // when the page was last drawn (performance.now)
async function submit(e) {
  e.preventDefault();
  const f = e.currentTarget, msg = $(".form-msg", f), btnEl = $("button[type=submit]", f);
  const data = Object.fromEntries(new FormData(f).entries());
  // spam traps: the hidden box only robots fill in; and the time since the page opened goes with the entry (the database drops one sent faster than anyone types)
  const guard = (C.privacy || {}).spam !== false, took = Math.max(1600, Math.round(performance.now() - FORM_T0));
  if (data.website) return;
  delete data.website; data.consent = data.consent ? "Agreed on " + new Date().toISOString() + ": " + consentWords(C.contact.form.consent) : "";
  const bad = [...f.querySelectorAll("[required]")].find((i) => (i.type === "checkbox" ? !i.checked : !String(i.value).trim()) || (i.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i.value)));
  if (bad) { msg.className = "form-msg bad"; msg.textContent = bad.type === "email" ? "Please enter a valid email address." : "Please fill in the required fields."; bad.focus(); return; }
  if (PREVIEW) { msg.className = "form-msg ok"; msg.textContent = "Preview: the form works on the live site. " + (backend() ? (backend().file ? "Enquiries are saved as JSON files and listed under Enquiries in the admin page. No email is sent." : "Enquiries are saved to Enquiries in the admin page.") : C.contact.form.saveTo === "file" ? "Set up the enquiry inbox in the Studio, then publish." : "It opens the visitor's email app addressed to " + (C.contact.email || "your email") + "."); return; }
  btnEl.disabled = true; msg.className = "form-msg"; msg.textContent = "Sending…";
  const cfg = backend();
  if (!cfg && C.contact.form.saveTo === "file") { msg.className = "form-msg bad"; msg.textContent = "This form isn't connected yet. Please contact us another way."; btnEl.disabled = false; return; }
  try {
    if (cfg && cfg.file) {
      const r = await fetch(cfg.file, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "submit", data, page: location.pathname }) });
      if (!r.ok) throw new Error("save " + r.status);
      f.reset(); msg.className = "form-msg ok"; msg.textContent = C.contact.form.success || "Thank you. We'll be in touch.";
    } else if (cfg && cfg.cf) {
      const r = await fetch(cfg.cf + "/enquire/" + encodeURIComponent(cfg.site), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data, page: location.pathname, ...(guard ? { took } : {}) }) });
      if (!r.ok) throw new Error("save " + r.status);
      f.reset(); msg.className = "form-msg ok"; msg.textContent = C.contact.form.success || "Thank you. We'll be in touch.";
    } else if (cfg) {
      const r = await fetch(cfg.url + "/rest/v1/site_enquiries", { method: "POST", headers: { apikey: cfg.key, ...(/^sb_/.test(cfg.key) ? {} : { Authorization: "Bearer " + cfg.key }), "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ site: cfg.site, data, page: location.pathname }) });
      if (!r.ok) throw new Error("save " + r.status);
      f.reset(); msg.className = "form-msg ok"; msg.textContent = C.contact.form.success || "Thank you. We'll be in touch.";
    } else {
      const to = C.contact.email || "";
      const body = Object.entries(data).filter(([, v]) => v).map(([k, v]) => `${k[0].toUpperCase() + k.slice(1)}: ${v}`).join("\n");
      location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent("Enquiry from " + (data.name || "the website"))}&body=${encodeURIComponent(body)}`;
      msg.className = "form-msg ok"; msg.textContent = "Your email app should open with the enquiry filled in. Press Send there to reach us.";
    }
  } catch (x) {
    msg.className = "form-msg bad"; msg.innerHTML = C.contact.email ? `Couldn't send just now. Please email us at <a href="mailto:${esc(C.contact.email)}">${esc(C.contact.email)}</a>.` : "Couldn't send just now. Please try again in a moment.";
  }
  btnEl.disabled = false;
}

/* ============================================================
   BOOT
   ============================================================ */
const SCO = { css: 'link[href*="assets/evt.css"]', js: "assets/evt.js" }; let DREW = false, HAND = false;
if (PREVIEW) {
  addEventListener("message", (e) => {
    if (e.origin !== location.origin || e.source !== window.parent) return;
    const d = e.data || {};
    if (d.type === "cms:content" && d.content && typeof d.content === "object") { if (SC && SC.take(d.content, { ...SCO, drawn: DREW })) return; DREW = true; ASSETS = d.assets || {}; const y = scrollY; C = norm(merge(DEFAULT, d.content)); render(); scrollTo(0, y); }
  });
  window.parent.postMessage({ type: "cms:ready", page: (location.pathname.split("/").pop() || "index.html") + (PAGE === "page" && spCur() ? "?p=" + encodeURIComponent(spCur()) : MNT_Q ? "?maintenance=1" : "") }, location.origin);
  if (!(SC && SC.wait())) { DREW = true; render(); }
} else {
  const CKEY = "site-content:" + location.pathname.replace(/[^/]*$/, "");
  let shownTxt = "";
  try { const c = sessionStorage.getItem(CKEY); if (c) { const j = JSON.parse(c); if (SC && SC.take(j, SCO)) HAND = true; else { C = norm(merge(DEFAULT, j)); render(); shownTxt = c; } } } catch (e) {}
  // A first visit: the page's outline shows while the content is fetched (the first render replaces it).
  if (!shownTxt && !HAND && window.SiteSkeleton) window.SiteSkeleton.show($("#app"));
  const giveUp = setTimeout(() => { if (!shownTxt && !HAND) { render(); shownTxt = "default"; } }, 6000);
  const fromFile = () => fetch("content.json", { cache: "no-store" }).then((r) => (r.ok ? r.text() : null));
  // Hosted on the Studio's Cloudflare database: content is a public file there.
  const fromCf = () => fetch(HOST.api + "/p/" + encodeURIComponent(HOST.site) + "/content.json", { cache: "no-store" }).then((r) => (r.ok ? r.text() : null)).catch(() => null).then((t) => t || fromFile());
  const fromDb = () => HOST.api ? fromCf() : fetch(HOST.db + "/rest/v1/site_content?select=content&site=eq." + encodeURIComponent(HOST.site), { cache: "no-store", headers: { apikey: HOST.key, ...(/^sb_/.test(HOST.key) ? {} : { Authorization: "Bearer " + HOST.key }) } })
    .then((r) => (r.ok ? r.json() : null)).then((j) => (j && j[0] && j[0].content ? JSON.stringify(j[0].content) : null)).catch(() => null).then((t) => t || fromFile());
  if (!HAND) (HOST ? fromDb() : fromFile()).then((txt) => {
    clearTimeout(giveUp);
    if (!txt) { if (!shownTxt) render(); return; }
    try { sessionStorage.setItem(CKEY, txt); } catch (e) {}
    if (txt === shownTxt) return;
    const j = JSON.parse(txt); if (SC && SC.take(j, { ...SCO, drawn: !!shownTxt, text: txt })) return;
    C = norm(merge(DEFAULT, j)); render();
  }).catch(() => { clearTimeout(giveUp); if (!shownTxt) render(); });
}
if (SC) SC.untrack();
})();

// Menu when scrolling (theme.navMode; theme.navModeMob for phones): "" theme default, fixed, hide (hide on scroll down, show on scroll up), scroll (scrolls away)
(function(){let lastY=scrollY;const de=document.documentElement;
  addEventListener("scroll",()=>{const y=scrollY,d=y-lastY;
    if(((matchMedia("(max-width:760px)").matches&&de.dataset.menumob)||de.dataset.menu)!=="hide"||document.querySelector(".nav [aria-expanded=true]")){de.classList.remove("menu-away");lastY=y;return}
    if(Math.abs(d)<6)return;de.classList.toggle("menu-away",d>0&&y>140);lastY=y},{passive:true});
  document.addEventListener("focusin",e=>{if(e.target.closest&&e.target.closest(".nav"))de.classList.remove("menu-away")});
})();
