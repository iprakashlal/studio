/* Business / professional portfolio runtime. Renders every page from content.json.
   One page with all sections, or several pages (Home, Services, Work, About, Contact).
   The enquiry form saves to Supabase when the site has it (hosted sites, or the form's own
   settings), otherwise it opens the visitor's email app addressed to the business. */
(() => {
"use strict";

/* ============================================================
   DEFAULT CONTENT (also exported as content.json)
   ============================================================ */
const DEFAULT = {
  theme: {
    bg: "#F7F8FA", surface: "#FFFFFF", deep: "#0E1B2C", text: "#0E1B2C", soft: "#5A6678", line: "#DDE2EA", c1: "#1D4ED8", c2: "#0E7490", c3: "#F59E0B",
    fontDisplay: "Plus Jakarta Sans", fontBody: "Inter", radius: 12, preset: "meridian",
    layout: "split", nav: "bar", cards: "outline", buttons: "rounded", heading: "normal", shead: "label", pattern: "none", width: "normal", motionStyle: "rise", bands: "soft", heroArt: "panel",
    cursor: "none", loader: "none", textfx: "none", hoverfx: "none", scrollfx: "none", overlay: "none",
    introBg: "", introFg: "", introTitle: "", introFont: "display", introCase: "upper", logoRadius: 22, scrollEase: "light", lineBreaks: "typed",
  },
  cms: { adminPage: "admin" },
  brand: { name: "Northbeam Partners", tagline: "Strategy, design and engineering for growing companies", logo: null, showName: true },
  site: { multiPage: false, pageLabels: { home: "Home", services: "Services", work: "Work", about: "About", contact: "Contact" } },
  nav: { cta: "Book a call", ctaTarget: "contact" },
  sections: [
    { id: "hero", label: "Home", show: true, inNav: false },
    { id: "clients", label: "Clients", show: true, inNav: false },
    { id: "services", label: "Services", show: true, inNav: true },
    { id: "stats", label: "Numbers", show: true, inNav: false },
    { id: "work", label: "Work", show: true, inNav: true },
    { id: "about", label: "About", show: true, inNav: true },
    { id: "process", label: "Process", show: true, inNav: false },
    { id: "team", label: "Team", show: true, inNav: true },
    { id: "testimonials", label: "Testimonials", show: true, inNav: false },
    { id: "pricing", label: "Pricing", show: true, inNav: false },
    { id: "faq", label: "FAQ", show: true, inNav: false },
    { id: "cta", label: "Call to action", show: true, inNav: false },
    { id: "contact", label: "Contact", show: true, inNav: true },
  ],
  hero: {
    eyebrow: "Consulting · Design · Engineering",
    title: "We help growing companies\nbuild what's next.",
    lede: "Northbeam is an independent team of strategists, designers and engineers. We plan, design and ship digital products for banks, insurers and healthcare companies.",
    ctaPrimary: "Book a consultation", ctaPrimaryTarget: "contact", ctaSecondary: "See our work", ctaSecondaryTarget: "work",
    image: null, badges: ["ISO 27001 certified", "120+ projects delivered", "Offices in Mumbai & London"],
  },
  clients: { title: "Trusted by teams at", logos: [{ name: "Arcadia Bank", logo: null }, { name: "Helix Health", logo: null }, { name: "Orbit Insurance", logo: null }, { name: "Lumen Retail", logo: null }, { name: "Stratus Cloud", logo: null }, { name: "Vertex Labs", logo: null }] },
  services: {
    eyebrow: "What we do", title: "Services built around outcomes", lede: "Pick one engagement or bring us in end to end. Every project has a single lead who owns delivery.",
    items: [
      { icon: "compass", title: "Strategy & discovery", body: "Research, roadmaps and business cases that get a project funded and pointed the right way.", points: ["Customer research", "Product roadmaps", "Business cases"] },
      { icon: "layers", title: "Product design", body: "Interfaces people understand at first glance, tested with real users before a line of code.", points: ["UX & UI design", "Design systems", "Usability testing"] },
      { icon: "code", title: "Engineering", body: "Web and mobile platforms built to last: secure, accessible and easy for your team to run.", points: ["Web & mobile apps", "Cloud platforms", "Integrations & APIs"] },
      { icon: "chart", title: "Data & analytics", body: "Dashboards and data pipelines that turn day-to-day numbers into decisions.", points: ["Dashboards", "Data pipelines", "Reporting automation"] },
      { icon: "shield", title: "Security & compliance", body: "Reviews, hardening and documentation for regulated industries.", points: ["Security reviews", "Compliance readiness", "Access controls"] },
      { icon: "people", title: "Team augmentation", body: "Senior specialists who join your team for a quarter or a year.", points: ["Tech leads", "Designers", "QA engineers"] },
    ],
  },
  about: {
    eyebrow: "About us", title: "Independent, senior and accountable",
    body: "We started Northbeam in 2014 with a simple idea: small senior teams deliver better work than large junior ones.\n\nToday we're 45 people across Mumbai and London. We work with a handful of clients at a time, so every engagement gets our full attention.",
    image: null, mission: "Help organisations make better products with less risk.", vision: "Be the partner companies call first when the work really matters.",
    values: [{ title: "Clarity", body: "Plain language, honest estimates, no surprises." }, { title: "Craft", body: "We sweat the details our clients' customers notice." }, { title: "Ownership", body: "One lead, accountable from kickoff to launch." }, { title: "Care", body: "For the people we work with and the people they serve." }],
  },
  stats: { items: [{ value: "12+", label: "Years in business" }, { value: "120+", label: "Projects delivered" }, { value: "45", label: "Specialists" }, { value: "98%", label: "Clients who return" }] },
  work: {
    eyebrow: "Case studies", title: "Selected work", lede: "A few recent engagements. More on request, under NDA.",
    items: [
      { title: "Digital onboarding for a retail bank", client: "Arcadia Bank", sector: "Banking", summary: "Rebuilt account opening from a 40-minute branch visit into a 7-minute mobile journey.", result: "3.2× more accounts opened online", image: null, url: "" },
      { title: "Claims portal for 40,000 agents", client: "Orbit Insurance", sector: "Insurance", summary: "Replaced four legacy tools with one portal for agents, adjusters and partners.", result: "Claim processing time down 46%", image: null, url: "" },
      { title: "Patient app and care dashboard", client: "Helix Health", sector: "Healthcare", summary: "A patient app linked to a clinician dashboard for remote monitoring.", result: "28% fewer missed appointments", image: null, url: "" },
    ],
  },
  process: {
    eyebrow: "How we work", title: "A clear path from first call to launch",
    steps: [
      { title: "Discover", body: "Two weeks of interviews, data and workshops to agree on the problem and the goal." },
      { title: "Plan", body: "A roadmap, budget and team you can take to your board." },
      { title: "Build", body: "Fortnightly releases you can see and test, with one lead accountable." },
      { title: "Launch & grow", body: "Go-live support, training and a plan for what comes next." },
    ],
  },
  team: {
    eyebrow: "Leadership", title: "The people you'll work with", lede: "Senior leads on every project, from first call to launch.",
    members: [
      { name: "Ananya Rao", role: "Managing Partner", photo: null, linkedin: "" },
      { name: "David Mercer", role: "Head of Design", photo: null, linkedin: "" },
      { name: "Karan Mehta", role: "Head of Engineering", photo: null, linkedin: "" },
      { name: "Sara Lindqvist", role: "Head of Strategy", photo: null, linkedin: "" },
    ],
  },
  testimonials: {
    eyebrow: "Client stories", title: "What clients say",
    items: [
      { quote: "Northbeam took a project three vendors had failed at and shipped it in six months. They're the first team I call now.", name: "Priya Nair", role: "Chief Digital Officer", company: "Arcadia Bank" },
      { quote: "Senior people, honest estimates and no surprises. Exactly what a regulated business needs from a partner.", name: "James Whitfield", role: "COO", company: "Orbit Insurance" },
    ],
  },
  pricing: {
    eyebrow: "Engagements", title: "Ways to work with us", lede: "Fixed scopes for a clear start; retainers when you want a team on call.",
    plans: [
      { name: "Discovery sprint", price: "₹4.5L", period: "fixed, 2 weeks", blurb: "Research, workshops and a costed roadmap.", features: ["Stakeholder interviews", "User research", "Roadmap & estimate"], cta: "Start a sprint", featured: false },
      { name: "Product build", price: "From ₹25L", period: "per project", blurb: "Design and engineering to launch.", features: ["Dedicated lead", "Fortnightly releases", "Launch support"], cta: "Plan a project", featured: true },
      { name: "Retainer", price: "₹6L", period: "per month", blurb: "A senior team on call for improvements.", features: ["Design + engineering hours", "Monthly roadmap review", "Priority support"], cta: "Talk to us", featured: false },
    ],
    note: "Prices exclude GST. Every engagement starts with a free 30-minute call.",
  },
  faq: {
    eyebrow: "FAQ", title: "Questions we're often asked",
    items: [
      { q: "How quickly can you start?", a: "Usually within two to three weeks of signing. Discovery sprints can often start the following week." },
      { q: "Do you work with companies outside India?", a: "Yes. About a third of our clients are in the UK, Europe and the Middle East. We overlap with their working hours." },
      { q: "Who owns the work?", a: "You do. All designs, code and documents are yours once invoices are paid." },
      { q: "Can you work with our in-house team?", a: "Most of our projects are joint teams. We can lead, support or hand over, whichever suits you." },
    ],
  },
  cta: { title: "Have a project in mind?", body: "Tell us where you are and where you want to be. We'll reply within one working day.", button: "Start a conversation", target: "contact" },
  contact: {
    eyebrow: "Contact", title: "Let's talk about your project", lede: "Send a few details and we'll set up a 30-minute call. No obligation.",
    email: "hello@northbeam.example", phone: "+91 22 4000 1234", whatsapp: "", address: "Level 9, One BKC\nBandra Kurla Complex, Mumbai 400051", hours: "Mon–Fri, 9:30 am – 6:30 pm IST", mapUrl: "", linkedin: "https://www.linkedin.com/",
    form: {
      enabled: true, title: "Tell us about your project", askPhone: true, askCompany: true, askService: true, askBudget: true,
      budgets: ["Under ₹5L", "₹5L – ₹25L", "₹25L – ₹1Cr", "Above ₹1Cr"], submit: "Send enquiry",
      success: "Thank you. We've received your enquiry and will reply within one working day.", consent: "I agree to be contacted about this enquiry.",
      saveTo: "auto", sbUrl: "", sbKey: "", site: "",
    },
  },
  footer: { text: "Strategy, design and engineering for growing companies.", legal: "© {year} Northbeam Partners LLP. All rights reserved.", links: [{ label: "Privacy", url: "" }, { label: "Terms", url: "" }] },
  seo: { title: "Northbeam Partners · Strategy, design and engineering", description: "Independent consultancy helping banks, insurers and healthcare companies plan, design and ship digital products.", titlePattern: "{page} · {site}", keywords: "", author: "", image: null, siteUrl: "", themeColor: "", noindex: false, googleVerification: "", meta: [] },
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
  "Space Mono": "Space+Mono:wght@400;700", "JetBrains Mono": "JetBrains+Mono:wght@400;500;700", "Mulish": "Mulish:wght@400;600;700",
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
function merge(def, val) {
  if (Array.isArray(def)) return Array.isArray(val) ? val : def;
  if (def && typeof def === "object") { const out = {}, v = val && typeof val === "object" && !Array.isArray(val) ? val : {}; for (const k of Object.keys(def)) out[k] = merge(def[k], v[k]); for (const k of Object.keys(v)) if (!(k in out)) out[k] = v[k]; return out; }
  return val === undefined ? def : val;
}
function hexRgb(h) { h = String(h || "#000").replace("#", ""); if (h.length === 3) h = h.split("").map((c) => c + c).join(""); const n = parseInt(h, 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function lum(h) { const [r, g, b] = hexRgb(h).map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; }
const onColor = (h) => (lum(h) > .45 ? "#10141C" : "#FFFFFF");
const initials = (s) => String(s || "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "•";
let ASSETS = {};
const HOST = (() => { try { const e = document.getElementById("site-host"); return e ? JSON.parse(e.textContent) : null; } catch (e) { return null; } })();
const hostPhoto = (p) => (HOST && /^assets\/uploads\//.test(p) ? HOST.assets + p.split("/").map(encodeURIComponent).join("/") : p);
const imgUrl = (img) => (!img ? "" : img.path ? ASSETS[img.path] || hostPhoto(img.path) : img.url || "");
let C = merge(DEFAULT, {});
const PAGE = document.body.dataset.page || "home";
const PREVIEW = window.name === "cms-preview" && window.parent !== window;
const PAGES = { home: "index.html", services: "services.html", work: "work.html", about: "about.html", contact: "contact.html" };
/** Which sections each page shows when the site has several pages (home follows the section order). */
const PAGE_SECTIONS = {
  home: ["hero", "clients", "services", "stats", "work", "testimonials", "cta"],
  services: ["services", "process", "pricing", "faq", "cta"],
  work: ["work", "clients", "testimonials", "cta"],
  about: ["about", "stats", "team", "process", "cta"],
  contact: ["contact", "faq"],
};
/** The page a section lives on in several-page mode. */
const HOME_OF = { services: "services", process: "services", pricing: "services", faq: "services", work: "work", about: "about", team: "about", contact: "contact", testimonials: "work", clients: "work" };
const multi = () => !!C.site.multiPage;
const shown = (id) => { const s = C.sections.find((x) => x.id === id); return !s || s.show !== false; };
/** A link to a section: an anchor on one page, or its page when the site has several. */
function href(id) {
  if (!id) return "#top";
  if (/^(https?:|mailto:|tel:)/i.test(id)) return id;
  if (!multi()) return "#" + id;
  if (id === "hero" || id === "home") return PAGES.home;
  const pg = HOME_OF[id] || "home";
  return PAGES[pg] + (PAGE === pg ? "#" + id : pg === id ? "" : "#" + id);
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
  const d = document.documentElement.dataset;
  for (const k of ["layout", "heroArt", "nav", "cards", "buttons", "motionStyle", "pattern", "heading", "shead", "width", "bands", "cursor", "loader", "textfx", "hoverfx", "scrollfx", "overlay"]) d[k] = String(t[k] || "");
  d.scrollease = t.scrollEase || "light"; d.linebreaks = t.lineBreaks || "typed"; d.menu = String(t.navMode || "");
  d.introfont = t.introFont || "display"; d.introcase = t.introCase || "upper"; d.dark = String(onColor(t.bg) === "#FFFFFF");
  [[FONTS[t.fontDisplay], "fontlink"], [FONTS[t.fontBody], "fontlink2"]].forEach(([f, id]) => {
    let l = document.getElementById(id); if (!l) { l = document.createElement("link"); l.id = id; l.rel = "stylesheet"; document.head.appendChild(l); }
    const h = f ? "https://fonts.googleapis.com/css2?family=" + f + "&display=swap" : ""; if (h && l.getAttribute("href") !== h) l.setAttribute("href", h);
  });
  if (!PREVIEW) try { localStorage.setItem("site-fonts:" + location.pathname.replace(/[^/]*$/, ""), JSON.stringify(["fontlink", "fontlink2"].map((id) => [id, (document.getElementById(id) || {}).href || ""]))); } catch (e) {}
}
function setTitle() {
  const one = (x) => String(x || "").replace(/\s*\n\s*/g, " ").trim();
  const label = PAGE === "home" || !multi() ? "" : (C.site.pageLabels || {})[PAGE] || "";
  document.title = !label ? one(C.seo.title || C.brand.name) : one((C.seo.titlePattern || "{page} · {site}").replace(/\{page\}/g, label).replace(/\{site\}/g, one(C.brand.name)));
}

/* ============================================================
   SECTIONS
   ============================================================ */
const head = (s, cls = "") => (s.eyebrow || s.title || s.lede) ? `<header class="sh ${cls}">${s.eyebrow ? `<p class="eyebrow">${esc(s.eyebrow)}</p>` : ""}${s.title ? `<h2 class="h2">${rich(s.title)}</h2>` : ""}${s.lede ? `<p class="lede">${rich(s.lede)}</p>` : ""}</header>` : "";
const btn = (label, to, kind = "pri") => label ? `<a class="btn ${kind}" href="${esc(href(to))}">${esc(label)}</a>` : "";
const arrow = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

/** Without a hero image: a calm composition of the business's own numbers and services, in the theme's colours. */
function heroPanel() {
  const st = C.stats.items.slice(0, 2), sv = C.services.items.slice(0, 3);
  return `<div class="hp" aria-hidden="true">
    <div class="hp-card hp-a"><span class="hp-k">${esc((st[0] || {}).label || "Projects")}</span><b>${esc((st[0] || {}).value || "120+")}</b><i class="hp-bars">${[38, 54, 46, 70, 62, 84, 96].map((h) => `<span style="--h:${h}%"></span>`).join("")}</i></div>
    <div class="hp-card hp-b">${sv.map((s) => `<span class="hp-row">${icon(s.icon, "hp-ic")}<span>${esc(s.title)}</span></span>`).join("")}</div>
    <div class="hp-card hp-c"><span class="hp-k">${esc((st[1] || {}).label || "Clients")}</span><b>${esc((st[1] || {}).value || "98%")}</b></div>
    <span class="hp-dot"></span>
  </div>`;
}
function heroHTML() {
  const H = C.hero, im = imgUrl(H.image);
  const media = im ? `<div class="hero-media" data-edit="hero.image"><img src="${esc(im)}" alt=""></div>` : `<div class="hero-media none" data-edit="hero.image">${heroPanel()}</div>`;
  const badges = (H.badges || []).filter(Boolean).length ? `<ul class="badges">${H.badges.filter(Boolean).map((b) => `<li>${icon("shield", "bi")}${esc(b)}</li>`).join("")}</ul>` : "";
  return `<section class="hero${im ? " has-img" : ""}" id="hero">${C.theme.layout === "full" && im ? `<div class="hero-bg" data-edit="hero.image" style="background-image:url('${esc(im)}')"></div>` : ""}
    <div class="wrap hero-in"><div class="hero-text">${H.eyebrow ? `<p class="eyebrow">${esc(H.eyebrow)}</p>` : ""}<h1 class="h1 fit">${rich(H.title)}</h1>${H.lede ? `<p class="hero-lede">${rich(H.lede)}</p>` : ""}
      <div class="cta-row">${btn(H.ctaPrimary, H.ctaPrimaryTarget)}${btn(H.ctaSecondary, H.ctaSecondaryTarget, "sec")}</div>${badges}</div>
      ${C.theme.layout === "full" && im ? "" : media}</div></section>`;
}
function clientsHTML() {
  const L = C.clients.logos.filter((l) => l.name || l.logo);
  if (!L.length) return "";
  return `<section class="clients" id="clients"><div class="wrap">${C.clients.title ? `<p class="clients-t">${esc(C.clients.title)}</p>` : ""}<ul class="logos">${L.map((l) => `<li title="${esc(l.name)}">${l.logo ? `<img src="${esc(imgUrl(l.logo))}" alt="${esc(l.name)}">` : `<span>${esc(l.name)}</span>`}</li>`).join("")}</ul></div></section>`;
}
function servicesHTML(full) {
  const S = C.services, items = full || !multi() ? S.items : S.items.slice(0, 3);
  return `<section class="services band" id="services"><div class="wrap">${head(S)}<div class="svc-grid">${items.map((s, i) => `<article class="card svc rv" style="--i:${i}">
      <span class="svc-ic">${icon(s.icon)}</span><h3 class="h3">${esc(s.title)}</h3><p>${rich(s.body)}</p>${(s.points || []).length ? `<ul class="ticks">${s.points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>` : ""}</article>`).join("")}</div>
    ${multi() && !full && S.items.length > items.length ? `<p class="more"><a class="link" href="${PAGES.services}">${esc((C.site.pageLabels || {}).services || "All services")} ${arrow}</a></p>` : ""}</div></section>`;
}
function statsHTML() {
  const I = C.stats.items.filter((s) => s.value || s.label);
  if (!I.length) return "";
  return `<section class="stats" id="stats"><div class="wrap"><dl class="stat-row">${I.map((s) => `<div class="stat rv"><dt>${esc(s.label)}</dt><dd>${esc(s.value)}</dd></div>`).join("")}</dl></div></section>`;
}
function workHTML(full) {
  const W = C.work, items = full || !multi() ? W.items : W.items.slice(0, 3);
  return `<section class="work band" id="work"><div class="wrap">${head(W)}<div class="cases">${items.map((w, i) => {
    const im = imgUrl(w.image), u = safeUrl(w.url), tag = u ? "a" : "article";
    return `<${tag} class="card case rv"${u ? ` href="${esc(u)}" target="_blank" rel="noopener"` : ""} style="--i:${i}"><div class="case-media">${im ? `<img src="${esc(im)}" alt="" loading="lazy">` : `<span class="case-ph" aria-hidden="true"><b>${esc(initials(w.client || w.title))}</b></span>`}</div>
      <div class="case-body"><p class="case-meta">${[w.client, w.sector].filter(Boolean).map(esc).join(" · ")}</p><h3 class="h3">${esc(w.title)}</h3><p>${rich(w.summary)}</p>${w.result ? `<p class="case-result">${icon("chart", "ri")}${esc(w.result)}</p>` : ""}${u ? `<span class="link">View case study ${arrow}</span>` : ""}</div></${tag}>`;
  }).join("")}</div>
    ${multi() && !full && W.items.length > items.length ? `<p class="more"><a class="link" href="${PAGES.work}">All case studies ${arrow}</a></p>` : ""}</div></section>`;
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
function teamHTML() {
  const T = C.team;
  return `<section class="team" id="team"><div class="wrap">${head(T)}<div class="people">${T.members.map((m, i) => {
    const ph = imgUrl(m.photo), li = safeUrl(m.linkedin);
    return `<article class="person rv" style="--i:${i}"><div class="pp">${ph ? `<img src="${esc(ph)}" alt="${esc(m.name)}" loading="lazy">` : `<span>${esc(initials(m.name))}</span>`}</div><h3 class="h3">${esc(m.name)}</h3><p class="role">${esc(m.role)}</p>${li ? `<a class="pl" href="${esc(li)}" target="_blank" rel="noopener" aria-label="${esc(m.name)} on LinkedIn">in</a>` : ""}</article>`;
  }).join("")}</div></div></section>`;
}
function testimonialsHTML() {
  const T = C.testimonials;
  if (!T.items.length) return "";
  return `<section class="testimonials band" id="testimonials"><div class="wrap">${head(T)}<div class="quotes">${T.items.map((q, i) => `<figure class="card quote rv" style="--i:${i}"><span class="qm" aria-hidden="true">“</span><blockquote>${rich(q.quote)}</blockquote>
      <figcaption><span class="qa">${esc(initials(q.name))}</span><span><b>${esc(q.name)}</b><small>${[q.role, q.company].filter(Boolean).map(esc).join(", ")}</small></span></figcaption></figure>`).join("")}</div></div></section>`;
}
function pricingHTML() {
  const P = C.pricing;
  if (!P.plans.length) return "";
  return `<section class="pricing" id="pricing"><div class="wrap">${head(P)}<div class="plans">${P.plans.map((p, i) => `<article class="card plan rv${p.featured ? " featured" : ""}" style="--i:${i}">${p.featured ? `<span class="plan-flag">Most chosen</span>` : ""}
      <h3 class="h3">${esc(p.name)}</h3><p class="plan-blurb">${rich(p.blurb)}</p><p class="price"><b>${esc(p.price)}</b><span>${esc(p.period)}</span></p>
      <ul class="ticks">${(p.features || []).map((f) => `<li>${esc(f)}</li>`).join("")}</ul>${btn(p.cta, "contact", p.featured ? "pri" : "sec")}</article>`).join("")}</div>
    ${P.note ? `<p class="plan-note">${rich(P.note)}</p>` : ""}</div></section>`;
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
      <div class="row2">${field("name", "Name", `<input id="f-name" name="name" required autocomplete="name">`, 1)}${field("email", "Work email", `<input id="f-email" name="email" type="email" required autocomplete="email">`, 1)}</div>
      ${F.askPhone || F.askCompany ? `<div class="row2">${F.askPhone ? field("phone", "Phone", `<input id="f-phone" name="phone" type="tel" autocomplete="tel">`) : ""}${F.askCompany ? field("company", "Company", `<input id="f-company" name="company" autocomplete="organization">`) : ""}</div>` : ""}
      ${F.askService || F.askBudget ? `<div class="row2">${F.askService && svc.length ? field("service", "Interested in", `<select id="f-service" name="service"><option value="">Choose…</option>${svc.map((s) => `<option>${esc(s)}</option>`).join("")}<option>Something else</option></select>`) : ""}${F.askBudget && (F.budgets || []).length ? field("budget", "Budget", `<select id="f-budget" name="budget"><option value="">Choose…</option>${F.budgets.map((b) => `<option>${esc(b)}</option>`).join("")}</select>`) : ""}</div>` : ""}
      ${field("message", "How can we help?", `<textarea id="f-message" name="message" rows="5" required></textarea>`, 1)}
      <input class="hp-f" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
      ${F.consent ? `<label class="consent"><input type="checkbox" name="consent" required> <span>${esc(F.consent)}</span></label>` : ""}
      <p class="form-msg" role="status" aria-live="polite"></p>
      <button class="btn pri" type="submit">${esc(F.submit || "Send")} ${arrow}</button></form>` : "";
  return `<section class="contact band" id="contact"><div class="wrap">${head(K)}<div class="contact-grid">
      <aside class="contact-info"><ul class="cl">${line("briefcase", "Email", K.email, K.email ? "mailto:" + K.email : "")}${line("people", "Phone", K.phone, K.phone ? "tel:" + K.phone.replace(/[^\d+]/g, "") : "")}${line("building", "Office", K.address, safeUrl(K.mapUrl))}${line("cog", "Hours", K.hours, "")}</ul>
        ${K.whatsapp || K.linkedin ? `<div class="cta-row">${K.whatsapp ? `<a class="btn sec" href="https://wa.me/${esc(String(K.whatsapp).replace(/\D/g, ""))}" target="_blank" rel="noopener">WhatsApp</a>` : ""}${safeUrl(K.linkedin) ? `<a class="btn sec" href="${esc(safeUrl(K.linkedin))}" target="_blank" rel="noopener">LinkedIn</a>` : ""}</div>` : ""}</aside>
      ${form}</div></div></section>`;
}
const RENDER = { hero: heroHTML, clients: clientsHTML, services: () => servicesHTML(PAGE === "services"), stats: statsHTML, work: () => workHTML(PAGE === "work"), about: aboutHTML, process: processHTML, team: teamHTML, testimonials: testimonialsHTML, pricing: pricingHTML, faq: faqHTML, cta: ctaHTML, contact: contactHTML };

/* ============================================================
   PAGE
   ============================================================ */
function navHTML() {
  const B = C.brand, logo = imgUrl(B.logo);
  const items = multi()
    ? ["services", "work", "about", "contact"].map((p) => ({ label: C.site.pageLabels[p] || p, url: PAGES[p], on: PAGE === p }))
    : C.sections.filter((s) => s.show !== false && s.inNav && RENDER[s.id]).map((s) => ({ label: s.label, url: "#" + s.id }));
  return `<header class="nav" id="top"><div class="wrap nav-in">
      <a class="brand" href="${multi() ? PAGES.home : "#top"}">${logo ? `<img class="logo" src="${esc(logo)}" alt="">` : `<span class="logo mark">${esc(initials(B.name))}</span>`}${B.showName !== false ? `<span class="bn">${esc(B.name)}</span>` : ""}</a>
      <nav class="links" aria-label="Main">${items.map((i) => `<a href="${esc(i.url)}"${i.on ? ' aria-current="page"' : ""}>${esc(i.label)}</a>`).join("")}</nav>
      ${C.nav.cta ? `<a class="btn pri nav-cta" href="${esc(href(C.nav.ctaTarget || "contact"))}">${esc(C.nav.cta)}</a>` : ""}
      <button class="burger" type="button" aria-expanded="false" aria-controls="mnav" aria-label="Menu"><span></span><span></span></button></div>
    <nav class="mnav" id="mnav" aria-label="Main">${items.map((i) => `<a href="${esc(i.url)}">${esc(i.label)}</a>`).join("")}${C.nav.cta ? `<a class="btn pri" href="${esc(href(C.nav.ctaTarget || "contact"))}">${esc(C.nav.cta)}</a>` : ""}</nav></header>`;
}
function pageHead() {
  const S = { services: C.services, work: C.work, about: C.about, contact: C.contact }[PAGE];
  if (!S) return "";
  return `<section class="phead" id="page"><div class="wrap"><p class="crumbs"><a href="${PAGES.home}">${esc(C.site.pageLabels.home || "Home")}</a> / ${esc(C.site.pageLabels[PAGE] || PAGE)}</p><h1 class="h1">${rich(S.title)}</h1>${S.lede ? `<p class="hero-lede">${rich(S.lede)}</p>` : ""}</div></section>`;
}
function footerHTML() {
  const F = C.footer, B = C.brand, K = C.contact;
  const cols = multi() ? ["services", "work", "about", "contact"].map((p) => `<a href="${PAGES[p]}">${esc(C.site.pageLabels[p])}</a>`) : C.sections.filter((s) => s.show !== false && s.inNav && RENDER[s.id]).map((s) => `<a href="#${s.id}">${esc(s.label)}</a>`);
  return `<footer class="foot" id="footer"><div class="wrap"><div class="foot-grid">
      <div><a class="brand" href="${multi() ? PAGES.home : "#top"}">${imgUrl(B.logo) ? `<img class="logo" src="${esc(imgUrl(B.logo))}" alt="">` : `<span class="logo mark">${esc(initials(B.name))}</span>`}<span class="bn">${esc(B.name)}</span></a><p>${rich(F.text)}</p></div>
      <nav aria-label="Footer">${cols.join("")}</nav>
      <div class="fc">${K.email ? `<a href="mailto:${esc(K.email)}">${esc(K.email)}</a>` : ""}${K.phone ? `<a href="tel:${esc(K.phone.replace(/[^\d+]/g, ""))}">${esc(K.phone)}</a>` : ""}${K.address ? `<span>${ml(K.address)}</span>` : ""}</div></div>
    <div class="foot-legal"><span>${esc(String(F.legal || "").replace(/\{year\}/g, new Date().getFullYear()))}</span><span>${(F.links || []).filter((l) => l.label).map((l) => safeUrl(l.url) ? `<a href="${esc(safeUrl(l.url))}">${esc(l.label)}</a>` : `<span>${esc(l.label)}</span>`).join("")}</span></div></div></footer>`;
}
function render() {
  // A several-page link opened while the site is one page goes to that section.
  if (!PREVIEW && !multi() && PAGE !== "home") { location.replace(PAGES.home + "#" + (PAGE === "work" ? "work" : PAGE)); return; }
  applyTheme(C.theme); setTitle();
  const ids = multi() ? (PAGE === "home" ? C.sections.map((s) => s.id).filter((id) => PAGE_SECTIONS.home.includes(id)) : PAGE_SECTIONS[PAGE]) : C.sections.map((s) => s.id);
  const body = ids.filter((id) => RENDER[id] && shown(id)).map((id) => RENDER[id]()).join("");
  $("#app").innerHTML = `<a class="skip" href="#main">Skip to content</a>${navHTML()}<main id="main">${multi() && PAGE !== "home" ? pageHead() : ""}${body}</main>${footerHTML()}`;
  bind();
  if (window.SiteFX) try { window.SiteFX.init({ root: $("#app"), brand: C.theme.introTitle || C.brand.name }); } catch (e) {}
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
  if (C.theme.motionStyle === "none" || matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) rv.forEach((e) => e.classList.add("in"));
  else { const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px" }); rv.forEach((e) => io.observe(e)); }
  const f = $("#enquiry"); if (f) f.addEventListener("submit", submit);
}

/** Where enquiries go: the hosted site's Supabase, the form's own Supabase settings, or email. */
function backend() {
  const F = C.contact.form;
  if (F.saveTo === "email") return null;
  if (HOST && HOST.db && HOST.key && HOST.site) return { url: HOST.db, key: HOST.key, site: HOST.site };
  if (/^https:\/\//.test(F.sbUrl || "") && F.sbKey && F.site) return { url: String(F.sbUrl).replace(/\/+$/, ""), key: F.sbKey, site: F.site };
  return null;
}
async function submit(e) {
  e.preventDefault();
  const f = e.currentTarget, msg = $(".form-msg", f), btnEl = $("button[type=submit]", f);
  const data = Object.fromEntries(new FormData(f).entries());
  if (data.website) return; // spam trap
  delete data.website; data.consent = data.consent ? "yes" : "";
  const bad = [...f.querySelectorAll("[required]")].find((i) => (i.type === "checkbox" ? !i.checked : !String(i.value).trim()) || (i.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i.value)));
  if (bad) { msg.className = "form-msg bad"; msg.textContent = bad.type === "email" ? "Please enter a valid email address." : "Please fill in the required fields."; bad.focus(); return; }
  if (PREVIEW) { msg.className = "form-msg ok"; msg.textContent = "Preview: the form works on the live site. " + (backend() ? "Enquiries are saved to Enquiries in the admin page." : "It opens the visitor's email app addressed to " + (C.contact.email || "your email") + "."); return; }
  btnEl.disabled = true; msg.className = "form-msg"; msg.textContent = "Sending…";
  const cfg = backend();
  try {
    if (cfg) {
      const r = await fetch(cfg.url + "/rest/v1/site_enquiries", { method: "POST", headers: { apikey: cfg.key, Authorization: "Bearer " + cfg.key, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ site: cfg.site, data, page: location.pathname }) });
      if (!r.ok) throw new Error("save " + r.status);
      f.reset(); msg.className = "form-msg ok"; msg.textContent = C.contact.form.success || "Thank you. We'll be in touch.";
    } else {
      const to = C.contact.email || "";
      const body = Object.entries(data).filter(([, v]) => v).map(([k, v]) => `${k[0].toUpperCase() + k.slice(1)}: ${v}`).join("\n");
      location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent("Enquiry from " + (data.name || "the website"))}&body=${encodeURIComponent(body)}`;
      msg.className = "form-msg ok"; msg.textContent = "Your email app should open with the enquiry filled in. Press Send there to reach us.";
    }
  } catch (x) {
    msg.className = "form-msg bad"; msg.innerHTML = `Couldn't send just now. Please email us at <a href="mailto:${esc(C.contact.email)}">${esc(C.contact.email)}</a>.`;
  }
  btnEl.disabled = false;
}

/* ============================================================
   BOOT
   ============================================================ */
if (PREVIEW) {
  addEventListener("message", (e) => {
    if (e.origin !== location.origin || e.source !== window.parent) return;
    const d = e.data || {};
    if (d.type === "cms:content" && d.content && typeof d.content === "object") { ASSETS = d.assets || {}; const y = scrollY; C = merge(DEFAULT, d.content); render(); scrollTo(0, y); }
  });
  window.parent.postMessage({ type: "cms:ready", page: location.pathname.split("/").pop() || "index.html" }, location.origin);
  render();
} else {
  const CKEY = "site-content:" + location.pathname.replace(/[^/]*$/, "");
  let shownTxt = "";
  try { const c = sessionStorage.getItem(CKEY); if (c) { C = merge(DEFAULT, JSON.parse(c)); render(); shownTxt = c; } } catch (e) {}
  const giveUp = setTimeout(() => { if (!shownTxt) { render(); shownTxt = "default"; } }, 6000);
  const fromFile = () => fetch("content.json", { cache: "no-store" }).then((r) => (r.ok ? r.text() : null));
  const fromDb = () => fetch(HOST.db + "/rest/v1/site_content?select=content&site=eq." + encodeURIComponent(HOST.site), { cache: "no-store", headers: { apikey: HOST.key, Authorization: "Bearer " + HOST.key } })
    .then((r) => (r.ok ? r.json() : null)).then((j) => (j && j[0] && j[0].content ? JSON.stringify(j[0].content) : null)).catch(() => null).then((t) => t || fromFile());
  (HOST ? fromDb() : fromFile()).then((txt) => {
    clearTimeout(giveUp);
    if (!txt) { if (!shownTxt) render(); return; }
    try { sessionStorage.setItem(CKEY, txt); } catch (e) {}
    if (txt === shownTxt) return;
    C = merge(DEFAULT, JSON.parse(txt)); render();
  }).catch(() => { clearTimeout(giveUp); if (!shownTxt) render(); });
}
})();
