/* Shop template runtime. Renders every page from content.json.
   No server: the cart lives in the shopper's browser, and orders are sent to the
   seller as a pre-filled WhatsApp message or email. */
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
  theme: { bg: "#FAF7F2", surface: "#FFFFFF", text: "#1B1A17", soft: "#6B665D", line: "#E7E1D6", accent: "#1F4D3A", accent2: "#E9B949", sale: "#B4441B", fontDisplay: "Fraunces", fontBody: "Manrope", radius: 14,
    preset: "ivory-classic", layout: "split", nav: "pill", cards: "soft", buttons: "rounded", motionStyle: "none", pattern: "none", ornament: "none", heading: "normal", shead: "plain", width: "normal", grid: "auto", product: "classic",
    cursor: "none", loader: "none", textfx: "none", hoverfx: "none", scrollfx: "none", overlay: "none", herofx: "none", loaderOn: "both",
    introBg: "", introFg: "", introTitle: "", introFont: "display", introCase: "upper", logoRadius: 26, scrollEase: "light", lineBreaks: "typed" },
  warranty: { enabled: false, title: "Warranty & service status", intro: "Enter the number on your invoice or product to see its warranty and service status.", navLabel: "Warranty", inNav: true, inFooter: true,
    label: "Serial or invoice number", placeholder: "", verify: "none", verifyLabel: "", button: "Check status", notFound: "We couldn't find that number. Check it and try again.", help: "Need help? Contact us and we'll look it up.",
    showWarranty: true, showHistory: true, showCustomer: false,
    statuses: [{ id: "registered", label: "Registered", tone: "info" }, { id: "received", label: "Received for service", tone: "progress" }, { id: "in-repair", label: "In repair", tone: "progress" }, { id: "ready", label: "Ready for pickup", tone: "ok" }, { id: "delivered", label: "Delivered", tone: "ok" }, { id: "not-covered", label: "Not covered", tone: "bad" }] },
  labels: { allProducts: "All products", viewAll: "View all", help: "Help", contact: "Contact" },
  cms: { adminPage: "admin" },
  brand: { name: "Picaffectz", tagline: "Small-batch goods for slow mornings", logo: null, announcement: "Free shipping on orders over ₹1,999", showAnnouncement: true },
  seo: { title: "Picaffectz", description: "Small-batch ceramics, linen and paper goods.", titlePattern: "{page} · {site}", keywords: "", author: "", image: null, siteUrl: "", themeColor: "", noindex: false, googleVerification: "", meta: [] },
  nav: { home: "Home", shop: "Shop", portfolio: "Our story", cart: "Cart", account: "Account", showPortfolio: true, crumbs: true },
  home: {
    hero: { eyebrow: "New collection", title: "Objects for\nslow mornings", text: "Hand-made ceramics, linen and paper goods, made in small batches and shipped with care.", cta: "Shop the collection", image: null },
    featuredTitle: "Featured", featuredText: "Our most-loved pieces this season.",
    showCategories: true, categoriesTitle: "Shop by category",
    banner: { show: true, title: "Made in small batches", text: "Every piece is made by a small team. Read how we work and see what we've made for other brands.", cta: "Read our story", image: null },
    testimonialsTitle: "What customers say", testimonials: [],
  },
  shop: { title: "Shop", intro: "Everything we make, in one place.", sortDefault: "featured", showSearch: true, emptyText: "No products match. Try another category or search." },
  categories: [
    { id: "ceramics", name: "Ceramics", description: "Cups, bowls and plates", image: null },
    { id: "linen", name: "Linen", description: "Napkins, aprons and runners", image: null },
    { id: "paper", name: "Paper", description: "Notebooks and cards", image: null },
  ],
  products: [
    { id: "p1", slug: "stoneware-mug", name: "Stoneware mug", category: "ceramics", price: 850, compareAt: 1100, images: [], short: "Hand-thrown, 350 ml", description: "A sturdy everyday mug with a soft matte glaze.\n\nEach one is thrown by hand, so sizes and glaze vary slightly.", features: ["Dishwasher safe", "350 ml", "Lead-free glaze"], optionName: "Glaze", options: ["Sand", "Moss", "Ink"], stock: "in", featured: true, badge: "Bestseller", sample: true },
    { id: "p2", slug: "serving-bowl", name: "Serving bowl", category: "ceramics", price: 1650, compareAt: 0, images: [], short: "Wide bowl for salads and pasta", description: "A wide, shallow bowl for sharing.", features: ["24 cm across", "Oven safe to 200 °C"], optionName: "", options: [], stock: "low", featured: true, badge: "", sample: true },
    { id: "p3", slug: "linen-napkins", name: "Linen napkins, set of 4", category: "linen", price: 1200, compareAt: 0, images: [], short: "Stonewashed European linen", description: "Soft from the first use and softer with every wash.", features: ["45 × 45 cm", "Machine washable"], optionName: "Colour", options: ["Oat", "Rust", "Charcoal"], stock: "in", featured: true, badge: "New", sample: true },
    { id: "p4", slug: "work-apron", name: "Work apron", category: "linen", price: 1900, compareAt: 2400, images: [], short: "Heavy linen with two pockets", description: "Cross-back straps that don't pull on your neck.", features: ["One size", "Two front pockets"], optionName: "", options: [], stock: "in", featured: false, badge: "", sample: true },
    { id: "p5", slug: "dot-grid-notebook", name: "Dot-grid notebook", category: "paper", price: 450, compareAt: 0, images: [], short: "A5, 120 pages, lay-flat", description: "Thick paper that takes fountain pen ink without bleeding.", features: ["A5", "120 gsm paper", "Lay-flat binding"], optionName: "Cover", options: ["Kraft", "Forest"], stock: "in", featured: true, badge: "", sample: true },
    { id: "p6", slug: "letterpress-cards", name: "Letterpress cards", category: "paper", price: 600, compareAt: 0, images: [], short: "Set of 6 with envelopes", description: "Printed by hand on cotton paper.", features: ["A6", "Recycled envelopes"], optionName: "", options: [], stock: "out", featured: false, badge: "", sample: true },
  ],
  settings: { currency: "INR", shippingFee: 99, freeShippingOver: 1999, taxPercent: 0, taxLabel: "GST", taxIncluded: true, orderPrefix: "FG", minOrder: 0, maxQty: 10 },
  checkout: { title: "Checkout", intro: "Enter your details and choose how to pay. You'll send us the order on the next screen.", button: "Place order", askPhone: true, askAddress: true, askNotes: true, successTitle: "Thank you for your order", successText: "Pay using the option below, then send us the order so we can confirm it and ship." },
  payments: {
    upi: { enabled: false, vpa: "", payeeName: "", label: "UPI" },
    razorpay: { enabled: false, link: "", label: "Card, UPI or netbanking (Razorpay)" },
    stripe: { enabled: false, link: "", label: "International card (Stripe)" },
    paypal: { enabled: false, username: "", label: "PayPal" },
    cashfree: { enabled: false, label: "UPI, card or netbanking (Cashfree)" },
    phonepe: { enabled: false, label: "PhonePe (UPI, card, netbanking)" },
    cod: { enabled: true, label: "Cash on delivery", note: "Pay when your order arrives." },
  },
  orders: { whatsapp: "", email: "", sendVia: "whatsapp", messageIntro: "New order" },
  contact: { email: "hello@example.com", phone: "", whatsapp: "", instagram: "", address: "" },
  portfolio: {
    eyebrow: "Our story", title: "A small studio making useful things", intro: "We started with one kiln and a table at a weekend market. Today we make pieces for homes, cafés and other brands.", image: null,
    storyTitle: "How we work", story: "Every piece starts as a sketch and a test batch. We only make what we'd use ourselves.\n\nWe work with local makers and pay fairly, and we ship in recycled packaging.",
    stats: [{ value: "6", label: "Years making" }, { value: "40+", label: "Café partners" }, { value: "12k", label: "Pieces shipped" }],
    workTitle: "Selected work", work: [
      { title: "Café tableware", text: "A full set of cups and plates for a neighbourhood café.", tag: "Commission", image: null, link: "" },
      { title: "Brand gift boxes", text: "Corporate gift boxes with linen and a notebook.", tag: "B2B", image: null, link: "" },
      { title: "Market stall", text: "Where it all began: a weekend stall that still runs.", tag: "Retail", image: null, link: "" },
    ],
    ctaTitle: "Find something you'll use every day", ctaText: "Browse the full collection.", ctaButton: "Go to the shop",
  },
  policies: [
    { id: "shipping", title: "Shipping", text: "Orders ship within 3 working days. Delivery usually takes 3 to 7 days in India." },
    { id: "refunds", title: "Returns and refunds", text: "Contact us within 7 days of delivery if something is damaged or not right. We'll replace it or refund you." },
    { id: "privacy", title: "Privacy", text: "We only use your details to process and deliver your order. We don't sell or share them." },
    { id: "terms", title: "Terms", text: "Prices include applicable taxes unless stated. Orders are confirmed once payment is received or, for cash on delivery, once we confirm with you." },
  ],
  footer: { text: "Made in small batches." },

};

const FONTS = {
  "Unbounded": "Unbounded:wght@400;600;800", "Bricolage Grotesque": "Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800", "Syne": "Syne:wght@400;600;800",
    "Sora": "Sora:wght@400;600;800", "Fraunces": "Fraunces:opsz,wght@9..144,400;9..144,600;9..144,800", "Archivo Black": "Archivo+Black", "DM Serif Display": "DM+Serif+Display",
    "Playfair Display": "Playfair+Display:ital,wght@0,400;0,600;0,800;1,400", "Space Grotesk": "Space+Grotesk:wght@400;600;700", "Outfit": "Outfit:wght@400;500;600;800",
    "Oswald": "Oswald:wght@400;600;700", "Bebas Neue": "Bebas+Neue", "Cormorant Garamond": "Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400", "Libre Baskerville": "Libre+Baskerville:ital,wght@0,400;0,700;1,400",
    "Abril Fatface": "Abril+Fatface", "Righteous": "Righteous", "Lexend": "Lexend:wght@400;500;600;800", "Rubik": "Rubik:wght@400;500;700;800", "Instrument Serif": "Instrument+Serif:ital@0;1",
    "Young Serif": "Young+Serif", "Anton": "Anton", "Chakra Petch": "Chakra+Petch:wght@400;600;700", "Orbitron": "Orbitron:wght@400;600;800", "Silkscreen": "Silkscreen:wght@400;700",
    "Caveat": "Caveat:wght@400;700", "Josefin Sans": "Josefin+Sans:wght@400;600;700", "Poppins": "Poppins:wght@400;500;600;800", "Alfa Slab One": "Alfa+Slab+One",
    "Manrope": "Manrope:wght@400;500;600;700;800", "Instrument Sans": "Instrument+Sans:wght@400;500;600;700", "IBM Plex Sans": "IBM+Plex+Sans:wght@400;500;600;700", "DM Sans": "DM+Sans:wght@400;500;700",
    "Work Sans": "Work+Sans:wght@400;500;600;700", "Inter": "Inter:wght@400;500;600;700;800", "Nunito Sans": "Nunito+Sans:wght@400;600;700", "Karla": "Karla:wght@400;500;700",
    "Lora": "Lora:ital,wght@0,400;0,500;0,600;0,700;1,400", "Source Serif 4": "Source+Serif+4:wght@400;600;700", "Figtree": "Figtree:wght@400;500;600;700", "Plus Jakarta Sans": "Plus+Jakarta+Sans:wght@400;500;600;700",
    "Space Mono": "Space+Mono:wght@400;700", "JetBrains Mono": "JetBrains+Mono:wght@400;500;700", "Quicksand": "Quicksand:wght@400;500;600;700", "Mulish": "Mulish:wght@400;600;700",
};

/* ============================================================
   UTILITIES
   ============================================================ */
const $ = (s, c = document) => c.querySelector(s), $$ = (s, c = document) => [...c.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
/** Escaped text that keeps the line breaks typed in the CMS. */
const ml = (s) => esc(String(s ?? "").replace(/\r\n?/g, "\n").trim()).replace(/\n/g, "<br>");
const lab = (k, d) => (C.labels && C.labels[k]) || d;
const paras = (s) => String(s || "").split(/\n\s*\n/).filter((x) => x.trim()).map((p) => `<p>${esc(p)}</p>`).join("");
const safeUrl = (u) => { u = String(u || "").trim(); return /^(https?:|mailto:|tel:)/i.test(u) ? u : ""; };
const slugify = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 48) || "item";
function merge(def, val) {
  if (Array.isArray(def)) return Array.isArray(val) ? val : def;
  if (def && typeof def === "object") { const out = {}, v = val && typeof val === "object" && !Array.isArray(val) ? val : {}; for (const k of Object.keys(def)) out[k] = merge(def[k], v[k]); for (const k of Object.keys(v)) if (!(k in out)) out[k] = v[k]; return out; }
  return val === undefined ? def : val;
}
function hexRgb(h) { h = String(h || "#000").replace("#", ""); if (h.length === 3) h = h.split("").map((c) => c + c).join(""); const n = parseInt(h, 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function lum(h) { const [r, g, b] = hexRgb(h).map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; }
const onColor = (h) => (lum(h) > .45 ? "#16150F" : "#FFFFFF");
const vpaOk = (v) => /^[A-Za-z0-9.\-_]{2,256}@[A-Za-z][A-Za-z0-9.\-]{1,63}$/.test(String(v || "").trim());
const ppOk = (v) => /^[A-Za-z0-9]{1,40}$/.test(String(v || "").trim());
const httpsOk = (u) => /^https:\/\/[^\s]+$/i.test(String(u || "").trim());
const digits = (v) => String(v || "").replace(/\D/g, "");
let ASSETS = {};
// Hosted outside GitHub: the Studio adds a "site-host" JSON script tag saying where the live content and photos are.
const HOST = (() => { try { const e = document.getElementById("site-host"); return e ? JSON.parse(e.textContent) : null; } catch (e) { return null; } })();
const hostPhoto = (p) => (HOST && /^assets\/uploads\//.test(p) ? HOST.assets + p.split("/").map(encodeURIComponent).join("/") : p);
const imgUrl = (img) => (!img ? "" : img.path ? ASSETS[img.path] || hostPhoto(img.path) : img.url || "");
const basePath = location.pathname.replace(/[^/]*$/, "");
let C = merge(DEFAULT, {});
const PAGE = document.body.dataset.page || "home";
/* Static pages (privacy, terms…): content.staticPages, shown by assets/pages.js at page.html?p=<name>. */
const spSlug = (p) => String(p.slug || p.title || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || p.id || "";
const spList = () => (C.staticPages || []).filter((p) => p && p.show !== false && String(p.title || "").trim() && spSlug(p));
const spHref = (p) => "page.html?p=" + encodeURIComponent(spSlug(p));
const spCur = () => { try { return new URLSearchParams(location.search).get("p") || ""; } catch (e) { return ""; } };
const spHere = () => (window.SitePages && window.SitePages.find(C, spCur(), PREVIEW)) || null;
const PREVIEW = window.name === "cms-preview" && window.parent !== window;
/** In the Studio's preview: ?preview=cart | signin | account shows the checkout with a sample cart, the checkout's sign-in step, or "My account". */
const PV = PREVIEW ? (new URLSearchParams(location.search).get("preview") || "") : "";

function money(v) {
  const cur = C.settings.currency || "INR", n = Number(v) || 0;
  try { return new Intl.NumberFormat(cur === "INR" ? "en-IN" : "en-US", { style: "currency", currency: cur, maximumFractionDigits: n % 1 ? 2 : 0 }).format(n); } catch (e) { return cur + " " + n; }
}
let toastT;
function toast(html) { let t = $("#toast"); if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); } t.innerHTML = html; t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), 3000); }
function copy(text, msg) { try { navigator.clipboard.writeText(text).then(() => toast(esc(msg)), () => toast("Couldn't copy. Select the text instead.")); } catch (e) { toast("Couldn't copy. Select the text instead."); } }
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem((PREVIEW ? "preview:" : "") + basePath + k)) ?? d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem((PREVIEW ? "preview:" : "") + basePath + k, JSON.stringify(v)); } catch (e) {} },
};

/* ============================================================
   PAYMENT SCRIPTS AND THE SHOP'S DATABASE
   ============================================================ */
const RZP_JS = "https://checkout.razorpay.com/v1/checkout.js";
const scripts = {};
function loadScript(src) {
  return (scripts[src] ||= new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => { delete scripts[src]; rej(new Error("load")); }; document.head.appendChild(s); }));
}
const httpsUrl = (u) => /^https:\/\/[^\s]+$/.test(u || "");
/* The shop runs on its own Cloudflare database (the page carries #site-host), like the restaurant: accounts, orders,
   payments, points, stock, reviews and tracking all live there. */
const DBHOST = () => !!(HOST && HOST.api && HOST.site);

/* ============================================================
   CATALOGUE + CART
   ============================================================ */
const slugOf = (p) => p.slug || slugify(p.name) || p.id;
const catOf = (id) => C.categories.find((c) => c.id === id);
const prodBy = (id) => C.products.find((p) => p.id === id);
const productUrl = (p) => `product.html?p=${encodeURIComponent(slugOf(p))}`;
const onSale = (p) => Number(p.compareAt) > Number(p.price);

/* Theme element pack (assets/motifs.js): placeholders and ornaments use illustrated elements. */
let MOTIF = "geometric";
const moOn = () => MOTIF !== "geometric" && !!window.SiteMotifs && SiteMotifs.has(MOTIF);
function ph(seed, cls = "") {
  let h = 0; for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const cols = [C.theme.accent, C.theme.accent2, C.theme.sale];
  if (moOn()) {
    const a = cols[h % 3], b = cols[(h + 1) % 3];
    return `<div class="ph mo-ph ${cls}" style="--c:${a}" aria-hidden="true">${SiteMotifs.img(MOTIF, seed, "", 900, "mo-photo")}<span class="mo-b" style="color:${b};--mo2:${a}">${SiteMotifs.svg(MOTIF, h % 8, 0, true)}</span></div>`;
  }
  return `<div class="ph ${cls}" style="--c:${cols[h % 3]}" aria-hidden="true"><i class="a" style="left:${8 + (h % 20)}%;top:${10 + (h % 14)}%"></i><i class="b"></i><i class="c"></i><b>${esc(String(seed).trim()[0] || "")}</b></div>`;
}
const pimg = (p, i = 0) => (p.images && p.images[i] ? `<img src="${esc(imgUrl(p.images[i]))}" alt="${esc(p.name)}" loading="lazy">` : ph(p.name));

let cart = store.get("cart", []);
/* Reviews (content.reviews, hosted shops): the average under each product, and on its page the reviews, with a form to write one. */
const revOn = () => !PREVIEW && !!(C.reviews && C.reviews.on && HOST && HOST.api && HOST.site);
let REV = null;
const stars = (a) => { const n = Math.round(Number(a) || 0); return `<span class="stars" role="img" aria-label="${n} out of 5 stars">${"★".repeat(n)}<i class="off">${"★".repeat(5 - n)}</i></span>`; };
const revRow = (id) => (REV && REV[id] ? `<p class="rvs" data-rv="${esc(id)}">${stars(REV[id][0])}<b>${REV[id][0]}</b><small>(${REV[id][1]})</small></p>` : revOn() ? `<p class="rvs" data-rv="${esc(id)}" hidden></p>` : "");
/* Ratings arriving after the page is drawn are written into the cards in place: redrawing the page made it flicker. */
function revFill() { document.querySelectorAll(".rvs[data-rv]").forEach((e) => { const r = REV && REV[e.dataset.rv]; if (r) { e.innerHTML = `${stars(r[0])}<b>${r[0]}</b><small>(${r[1]})</small>`; e.hidden = false; } }); }
function revLoad() { if (!revOn()) return Promise.resolve(); return fetch(HOST.api + "/rev/" + encodeURIComponent(HOST.site), { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (j && j.s) REV = j.s; }).catch(() => {}); }
function revDraw(p) {
  const el = $("#rv"); if (!el) return; const api = HOST.api + "/rev/" + encodeURIComponent(HOST.site), me = store.get("me", {});
  let said = "";
  const draw = () => fetch(api + "?item=" + encodeURIComponent(p.id), { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => {
    j = j || { n: 0, a: 0, hist: [0, 0, 0, 0, 0], list: [] }; const open = el.querySelector("#rv-form") && !el.querySelector("#rv-form").hidden;
    el.innerHTML = `<div class="sec-h"><h2 style="font-size:28px">Reviews</h2></div>
      <div class="rv-top">${j.n ? `<div class="rv-sum"><b>${j.a}</b>${stars(j.a)}<small>${j.n} review${j.n === 1 ? "" : "s"}</small></div><div class="rv-bars">${[5, 4, 3, 2, 1].map((k) => `<div><span>${k}★</span><i><u style="width:${Math.round((100 * j.hist[k - 1]) / j.n)}%"></u></i><span>${j.hist[k - 1]}</span></div>`).join("")}</div>` : `<p class="soft">No reviews yet. Be the first to write one.</p>`}<button class="btn pri" type="button" id="rv-open" aria-expanded="false">Write a review</button></div>
      <p class="rv-said" role="status">${esc(said)}</p>
      <form class="rv-form" id="rv-form" hidden novalidate><fieldset class="rv-pick"><legend>Your rating</legend><div class="rv-stars">${[5, 4, 3, 2, 1].map((k) => `<label><input type="radio" name="rating" value="${k}"><span aria-hidden="true">★</span><b class="vh">${k} star${k === 1 ? "" : "s"}</b></label>`).join("")}</div></fieldset>
        <div class="two-f"><label>Your name<input class="in" name="name" maxlength="60" autocomplete="name" value="${esc(me.name || "")}"></label><label>Email <small class="soft">(never shown)</small><input class="in" name="email" type="email" maxlength="120" autocomplete="email" value="${esc(me.email || "")}"></label></div>
        <label>Headline <small class="soft">(optional)</small><input class="in" name="title" maxlength="100"></label><label>Your review<textarea class="in" name="body" rows="4" maxlength="1500"></textarea></label>
        <input class="vh" name="hp" tabindex="-1" autocomplete="off" aria-hidden="true"><p class="err" id="rv-err" role="alert"></p><button class="btn pri" type="submit">Send review</button></form>
      <ul class="rv-list">${j.list.map((r) => `<li class="rv-c"><div class="rv-who"><span class="rv-av" aria-hidden="true">${esc(String(r.name || "?").trim().slice(0, 1).toUpperCase())}</span><div><b>${esc(r.name)}</b><small>${esc(r.at)}</small></div>${stars(r.rating)}</div>${r.verified ? `<em class="rv-v">✓ Verified buyer</em>` : ""}${r.title ? `<h3>${esc(r.title)}</h3>` : ""}<p>${esc(r.body).replace(/\n/g, "<br>")}</p>${r.reply ? `<blockquote><b>Reply from ${esc((C.brand && C.brand.name) || "the shop")}</b><br>${esc(r.reply)}</blockquote>` : ""}</li>`).join("")}</ul>`;
    const f = $("#rv-form", el), o = $("#rv-open", el); if (open) { f.hidden = false; o.setAttribute("aria-expanded", "true"); }
    o.onclick = () => { f.hidden = !f.hidden; o.setAttribute("aria-expanded", String(!f.hidden)); if (!f.hidden) f.querySelector("input[name=name]").focus(); };
    f.onsubmit = async (e) => {
      e.preventDefault(); const g = (n) => String(f.elements[n].value || "").trim(), er = $("#rv-err", el), b = f.querySelector("button[type=submit]"), rating = (f.querySelector("input[name=rating]:checked") || {}).value;
      if (!rating) { er.textContent = "Choose a star rating."; return; } er.textContent = ""; b.disabled = true; b.textContent = "Sending…";
      try {
        const r = await fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ item: p.id, rating: +rating, name: g("name"), email: g("email"), title: g("title"), body: g("body"), hp: g("hp") }) }), x = await r.json().catch(() => ({}));
        if (!r.ok) { er.textContent = x.error || "Couldn't send your review. Please try again."; b.disabled = false; b.textContent = "Send review"; return; }
        store.set("me", { ...store.get("me", {}), name: g("name") || me.name, email: g("email") || me.email }); said = x.status === "live" ? "Thank you! Your review is up." : "Thank you! Your review will show once it has been approved."; draw();
      } catch (_) { er.textContent = "Couldn't send your review. Please try again."; b.disabled = false; b.textContent = "Send review"; }
    };
  }).catch(() => {});
  draw();
}
/* Abandoned carts (content.recovery, hosted shops): once an email address is typed at checkout, the cart is kept on the
   shop's database so a reminder can bring the shopper back. The link in the reminder (?rc=…) puts the cart back. */
const recoOn = () => !PREVIEW && !!(C.recovery && C.recovery.on && HOST && HOST.api && HOST.site);
let recoT = 0;
function recoSave(now) {
  clearTimeout(recoT);
  const send = () => {
    if (!recoOn()) return; const g = (i) => { const e = $("#co #" + i); return e ? String(e.value || "").trim() : ""; }, email = g("email") || (ME() && ME().kind === "email" ? String(ME().key || "").trim() : ""); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    const lines = cartLines(); if (!$("#co") || $(".done") || !lines.length) return;
    const body = JSON.stringify({ email, name: g("name"), phone: g("phone"), lines: lines.map((l) => ({ id: l.id, opt: l.opt || "", qty: l.qty })), items: lines.map((l) => ({ n: l.p.name + (l.opt ? " (" + l.opt + ")" : ""), q: l.qty })), total: lines.reduce((n, l) => n + (Number(l.p.price) || 0) * l.qty, 0), back: location.origin + location.pathname.replace(/[^/]*$/, "") + "checkout.html" });
    if (body === recoSave.last) return; recoSave.last = body;
    fetch(HOST.api + "/cart/" + encodeURIComponent(HOST.site), { method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true, body }).catch(() => { recoSave.last = ""; });
  };
  if (now) send(); else recoT = setTimeout(send, 900);
}
/* Saved while typing and again the moment the shopper leaves: closing the tab or going back never blurs a field, so waiting for that lost the cart. */
document.addEventListener("input", (e) => { const t = e.target; if (t && t.closest && t.closest("#co") && /^(email|name|phone)$/.test(t.id)) recoSave(); });
document.addEventListener("focusout", (e) => { const t = e.target; if (t && t.closest && t.closest("#co") && /^(email|name|phone)$/.test(t.id)) recoSave(true); });
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") recoSave(true); });
addEventListener("pagehide", () => recoSave(true));
(function recoBack() {
  const m = /[?&]rc=([a-f0-9]{32})(?:&|$)/.exec(location.search); if (!m || !HOST || !HOST.api || !HOST.site) return;
  const go = () => { const u = new URL(location.href); u.searchParams.delete("rc"); location.replace(u.href); };
  fetch(HOST.api + "/cart/" + encodeURIComponent(HOST.site) + "/" + m[1]).then((r) => (r.ok ? r.json() : null)).then((j) => { if (j && Array.isArray(j.lines) && j.lines.length) store.set("cart", j.lines.filter((l) => l && l.id).map((l) => ({ id: String(l.id), opt: String(l.opt || ""), qty: Math.max(1, Math.min(99, +l.qty || 1)) }))); go(); }).catch(go);
})();
const saveCart = () => { store.set("cart", cart); $$("[data-cartcount]").forEach((el) => { el.textContent = cartCount(); }); };
const cartCount = () => cart.reduce((n, l) => n + l.qty, 0);
/** A product's varieties with their own prices (p.kindsOn, p.kinds): the buyer must choose one, and it sets the price. */
const kindsOf = (p) => (p && p.kindsOn ? (p.kinds || []).filter((k) => k && String(k.label || "").trim() && isFinite(Number(k.price)) && Number(k.price) >= 0).map((k) => ({ label: String(k.label).trim(), price: Number(k.price) })) : []);
/** The product as bought on one cart line: with varieties, its price is the chosen variety's (the first part of the line's option). */
function asBought(p, opt) { const K = kindsOf(p); if (!K.length) return p; const k = K.find((x) => x.label === String(opt || "").split(" · ")[0].trim()); return k ? { ...p, price: k.price, compareAt: 0 } : null; }
/* Inventory (content.inventory.on, hosted shops): what the shop's database says is left of each counted product, or
   of one of its options. A product with nothing left shows as sold out, a few left says how many, and the cart can't
   hold more than there is. The database checks again when the order is placed. */
let STOCK = null;
const stockOn = () => !PREVIEW && !!(C.inventory && C.inventory.on && HOST && HOST.api && HOST.site);
/** How many are left of a product (with this option chosen), or null when it isn't counted. */
function stockLeft(id, opt) {
  if (!STOCK) return null;
  const o = String(opt || ""), tries = [o, ...o.split(" · ")].filter((x, i, a) => x.trim() && a.indexOf(x) === i).map((x) => id + "|" + x.replace(/\s+/g, " ").trim().toLowerCase().slice(0, 60));
  for (const k of [...tries, String(id)]) if (k in STOCK) return STOCK[k];
  return null;
}
/** Marks the products as the stock says (each time the page is drawn, so a reloaded page keeps the marks). */
function stockMark() {
  if (!STOCK) return; const few = Math.max(0, Number((C.inventory || {}).leftAt != null && (C.inventory || {}).leftAt !== "" ? C.inventory.leftAt : 5) || 0);
  for (const p of C.products || []) {
    const base = String(p.id) in STOCK ? STOCK[p.id] : null, opts = [...kindsOf(p).map((k) => k.label), ...(p.options || [])], own = opts.map((o) => stockLeft(p.id, o)), counted = own.filter((n, i) => (p.id + "|" + String(opts[i]).replace(/\s+/g, " ").trim().toLowerCase().slice(0, 60)) in STOCK);
    if (base == null && !counted.length) continue;
    // every option counted and none left, or the product itself has none
    const left = base != null ? base : counted.length === opts.length ? counted.reduce((a, b) => a + b, 0) : null;
    p._left = left; if (left === 0) p.stock = "out"; else if (left != null && left <= few) { p.stock = "low"; } else if (p.stock !== "out" && left != null) p.stock = "in";
  }
}
function stockLoad() { if (!stockOn()) return Promise.resolve(); return fetch(HOST.api + "/stock/" + encodeURIComponent(HOST.site), { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (j && j.s) { STOCK = j.s; stockMark(); } }).catch(() => {}); }
/** The most of one line the cart may hold: the shop's own limit, and what is left. */
const lineMax = (id, opt) => { const n = stockLeft(id, opt); return Math.max(1, Math.min(Math.max(1, Number(C.settings.maxQty) || 10), n == null ? Infinity : Math.max(1, n))); };
function cartLines() { return (PV && !cart.length && C.products[0] ? [{ id: C.products[0].id, opt: "", qty: 2 }] : cart).map((l) => ({ ...l, p: asBought(prodBy(l.id), l.opt) })).filter((l) => l.p && l.p.stock !== "out" && stockLeft(l.id, l.opt) !== 0).map((l) => { const n = stockLeft(l.id, l.opt); return n != null && l.qty > n ? { ...l, qty: n } : l; }); }
function addToCart(id, opt, qty) {
  const max = lineMax(id, opt);
  const ex = cart.find((l) => l.id === id && l.opt === opt);
  if (ex) ex.qty = Math.min(max, ex.qty + qty); else cart.push({ id, opt, qty: Math.min(max, qty) });
  saveCart();
}
/* Delivery areas (content.shipping): the same rules as the shop backend (functions/shop/index.ts). */
function pinsMatch(list, pin) {
  const p = String(pin || "").replace(/\D/g, ""); if (p.length < 4) return false;
  return String(list || "").split(/[\s,;]+/).filter(Boolean).some((t) => {
    const r = /^(\d{4,6})-(\d{4,6})$/.exec(t); if (r) return p.length === r[1].length && +p >= +r[1] && +p <= +r[2];
    return /^\d{2,6}$/.test(t) && (t.length === p.length ? t === p : p.startsWith(t));
  });
}
function shipQuote(pin) {
  const H = C.shipping || {}, open = { ok: true, zone: "", fee: null, freeOver: null, days: "", cod: true, known: false };
  if (!H.on) return open;
  const num = (v) => (v === "" || v == null || isNaN(Number(v)) ? null : Math.max(0, Number(v)));
  if (String(pin || "").replace(/\D/g, "").length < 4) return open;
  const z = (Array.isArray(H.zones) ? H.zones : []).find((x) => x && x.on !== false && pinsMatch(x.pins, pin));
  if (z) return { ok: true, zone: String(z.name || ""), fee: num(z.fee), freeOver: num(z.freeOver), days: String(z.days || ""), cod: z.cod !== false, known: true };
  if (H.rest === "no") return { ...open, ok: false, known: true };
  return { ok: true, zone: "", fee: num(H.restFee), freeOver: null, days: String(H.restDays || ""), cod: H.restCod !== false, known: true };
}
const shipOn = () => !!(C.shipping && C.shipping.on);
const curPin = () => String(store.get("pin", "") || (store.get("me", {}) || {}).pin || "");
/** What a PIN check says, in words. */
function pinSays(pin) {
  const H = C.shipping || {}, q = shipQuote(pin), t = totals(cartLines(), pin);
  if (String(pin || "").replace(/\D/g, "").length < 6) return { ok: null, text: "" };
  if (!q.ok) return { ok: false, text: H.blockMsg || `Sorry, we don't deliver to ${pin} yet.` };
  const fee = q.fee != null ? q.fee : Number(C.settings.shippingFee) || 0, over = q.freeOver != null ? q.freeOver : Number(C.settings.freeShippingOver) || 0;
  return { ok: true, text: `Delivers to ${pin}${q.days ? ` in ${q.days}` : ""}. ${cartLines().length && !t.ship ? "Shipping is free." : fee ? `Shipping ${money(fee)}${over > 0 ? `, free over ${money(over)}` : ""}.` : "Shipping is free."}${q.cod ? "" : " Cash on delivery isn't available here."}` };
}
function pinBox() {
  if (!shipOn()) return "";
  const pin = curPin(), r = pinSays(pin);
  return `<div class="pinbox" style="margin:14px 0"><label class="lbl" for="pinchk">${esc((C.shipping || {}).checkLabel || "Check delivery to your PIN code")}</label>
    <div style="display:flex;gap:8px;margin-top:6px;max-width:340px"><input class="in" id="pinchk" inputmode="numeric" maxlength="6" autocomplete="postal-code" placeholder="6-digit PIN" value="${esc(pin)}"><button type="button" class="btn" data-pinchk>Check</button></div>
    <p class="soft" id="pinres" role="status" style="font-size:14px;margin-top:6px${r.ok === false ? ";color:var(--sale,#c0392b)" : ""}">${esc(r.text)}</p></div>`;
}
/** The shipment's courier and tracking link, once the shop has added them to an order. */
function trackInfo(o) {
  let t = o && o.track; if (!t) try { t = JSON.parse(String((o && o.address && o.address.track) || "")); } catch (e) { t = null; }
  if (!t || !(t.awb || t.url || t.link)) return "";
  const link = safeUrl(t.link || t.url || "");
  return `<p class="note" style="margin-top:10px">Shipped with <b>${esc(t.name || "courier")}</b>${t.awb ? `, tracking number <b style="font-family:monospace">${esc(t.awb)}</b>` : ""}.${link ? ` <a class="link" href="${esc(link)}" target="_blank" rel="noopener">Track your parcel ↗</a>` : ""}</p>`;
}
/* Where the parcel is, for a shop hosted on the Studio's database: the courier and tracking number the shop saved on
   the order, and (when the shop has connected a tracking service) each scan, newest first. */
const SHIP_STEPS = [["booked", "Order placed"], ["picked", "Shipped"], ["transit", "On the way"], ["out", "Out for delivery"], ["delivered", "Delivered"]];
const shipCan = () => !PREVIEW && !!(HOST && HOST.api && HOST.site);
const shipAsk = (body) => fetch(HOST.api + "/track/" + encodeURIComponent(HOST.site), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json().then((j) => { if (!r.ok) throw new Error((j && j.error) || "We couldn't find that order."); return j; }));
const shipWhen = (v) => { const d = new Date(v); return !v ? "" : isNaN(+d) ? String(v) : /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }) : d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }); };
function shipHTML(j) {
  const T = j.track, L = j.live, cancelled = j.status === "cancelled";
  // without live scans, the order's own status says how far it is
  const at = cancelled ? -1 : L ? Math.max(0, SHIP_STEPS.findIndex(([k]) => k === (L.st === "failed" ? "out" : L.st === "returned" ? "transit" : L.st))) : j.status === "done" ? 4 : j.status === "out" ? (T ? 2 : 1) : T ? 1 : 0;
  const link = safeUrl((L && L.link) || (T && T.link) || "");
  return `<div class="box shipbox" data-ship="${esc(j.no || "")}"><h2 style="font-size:20px">Where your order is</h2>
    ${cancelled ? `<p class="note"><b>This order was cancelled.</b></p>` : `<ol class="track" aria-label="Delivery progress">${SHIP_STEPS.map(([, l], i) => `<li class="${i <= at ? "on" : ""}"${i === at ? ' aria-current="step"' : ""}><i></i><span>${l}</span></li>`).join("")}</ol>`}
    ${L ? `<p style="margin:0"><b data-ship-state="${esc(L.st)}">${esc(L.label || L.say)}</b>${L.say && L.say !== L.label ? ` <span class="soft">· ${esc(L.say)}</span>` : ""}${L.eta ? `<br><span class="soft">Expected by ${esc(shipWhen(L.eta))}</span>` : ""}</p>` : ""}
    ${T ? `<p class="note" style="margin:0">${T.awb ? `Shipped with <b>${esc(T.name)}</b>, tracking number <b style="font-family:monospace">${esc(T.awb)}</b>.` : `Shipped with <b>${esc(T.name)}</b>.`}${link ? ` <a class="link" href="${esc(link)}" target="_blank" rel="noopener">Track on the courier's site ↗</a>` : ""}</p>` : cancelled ? "" : `<p class="note" style="margin:0">${j.status === "done" ? "This order is complete." : "We are getting your order ready. The courier and tracking number show here once it ships."}</p>`}
    ${L && L.ev && L.ev.length ? `<ol class="shipev" aria-label="Parcel history">${L.ev.map((e, i) => `<li${i === 0 ? ' class="on"' : ""}><i></i><div><b>${esc(e.text)}</b><span class="soft">${esc([e.place, shipWhen(e.at)].filter(Boolean).join(" · "))}</span></div></li>`).join("")}</ol>` : ""}
    ${L && L.at ? `<p class="soft" style="font-size:12.5px;margin:0">Checked ${esc(shipWhen(new Date(L.at).toISOString()))}. <button type="button" class="link" data-ship-again style="background:none;border:0;padding:0;cursor:pointer;font:inherit">Check again</button></p>` : ""}</div>`;
}
/** Fills `el` with the order's tracking (and again when "Check again" is pressed). Quiet when the order isn't found. */
function shipInto(el, body, o = {}) {
  if (!el || !shipCan()) return Promise.resolve(null);
  if (!document.getElementById("shipcss")) { const st = document.createElement("style"); st.id = "shipcss"; st.textContent = ".shipev{list-style:none;margin:0;padding:0;display:grid;gap:0}.shipev li{display:grid;grid-template-columns:16px 1fr;gap:12px;padding-bottom:14px;position:relative}.shipev li i{width:10px;height:10px;border-radius:50%;background:var(--line);margin:6px 0 0 3px}.shipev li.on i{background:var(--accent);box-shadow:0 0 0 4px color-mix(in srgb,var(--accent) 22%,transparent)}.shipev li::after{content:\"\";position:absolute;left:7.5px;top:18px;bottom:0;width:1px;background:var(--line)}.shipev li:last-child{padding-bottom:0}.shipev li:last-child::after{display:none}.shipev b{display:block;font-size:14.5px}.shipev span{font-size:13px}.shipbox .track{margin:4px 0 6px}@media(max-width:520px){.shipbox .track span{font-size:10.5px}}"; document.head.appendChild(st); }
  return shipAsk(body).then((j) => { el.innerHTML = shipHTML(j); const again = el.querySelector("[data-ship-again]"); if (again) again.onclick = () => { again.textContent = "Checking…"; shipInto(el, body, o); }; return j; })
    .catch((x) => { if (o.say) el.innerHTML = `<p class="err" role="alert">${esc(x.message || "We couldn't find that order.")}</p>`; return null; });
}
/** "Track an order" (checkout.html?track): the order number and the mobile number or email it was placed with. */
function trackPage() {
  // The last order placed on this device fills the form in, but only for the person it belongs to: on a shop with customer accounts
  // that is the signed-in customer (signed out, or someone else's order: the form starts empty).
  const q = new URLSearchParams(location.search), no = q.get("order") || q.get("no") || "", lastAny = store.get("orders", [])[0], dg = (v) => String(v || "").replace(/\D/g, "");
  const mineLast = (o) => { const m = ME(), c = (o && o.c) || {}; return !!m && (m.kind === "email" ? String(c.email || "").trim().toLowerCase() === String(m.key).toLowerCase() : dg(c.phone).length >= 8 && dg(c.phone).slice(-10) === dg(m.key).slice(-10)); };
  const last = !(C.account && C.account.on) || mineLast(lastAny) ? lastAny : null;
  return `<section class="page-h"><div class="wrap"><h1 class="fit">Track your order</h1></div></section><div class="wrap" style="padding-bottom:80px;max-width:720px">
    <form class="form box" id="trackf" novalidate><div class="f"><label for="tr-no">Order number</label><input class="in" id="tr-no" autocomplete="off" autocapitalize="characters" placeholder="${esc(last ? last.id : "ORD-0101-1234")}" value="${esc(no || (last ? last.id : ""))}" required></div>
    <div class="f"><label for="tr-c">Mobile number or email you ordered with</label><input class="in" id="tr-c" autocomplete="tel" value="${esc(last && last.c ? last.c.phone || last.c.email || "" : "")}" required></div>
    <button class="btn pri" type="submit">Track</button><p class="soft" style="font-size:13px;margin:0">${shipCan() ? "It is on your order confirmation." : "Order tracking works on the published shop."}</p></form>
    <div id="trackout" style="margin-top:22px" aria-live="polite"></div></div>`;
}
function bindTrack() {
  const f = $("#trackf"), out = $("#trackout"); if (!f) return;
  const go = () => { const no = $("#tr-no").value.trim().toUpperCase(), c = $("#tr-c").value.trim(); if (!no || !c) { out.innerHTML = `<p class="err" role="alert">Enter the order number and the mobile number or email you ordered with.</p>`; return; }
    const loc = store.get("orders", []).find((x) => x.id === no); out.innerHTML = `<p class="soft">Looking for your order…</p>`; shipInto(out, { no, contact: c, ...(loc && loc.k ? { k: loc.k } : {}) }, { say: true }); };
  f.onsubmit = (e) => { e.preventDefault(); go(); };
  if ($("#tr-no").value && $("#tr-c").value && new URLSearchParams(location.search).get("order")) go();
}
/* GST invoice (assets/invoice.js), opened from an order. */
const gstOn = () => !!(C.gst && C.gst.on);
const invBtn = (id) => (gstOn() ? `<button type="button" class="btn" data-inv="${esc(id)}">Download invoice</button>` : "");
let invP;
/** The invoice as the editor's preview shows it: a sample order, redrawn whenever the owner changes a setting. */
function invPreview() {
  const P = C.products.slice(0, 2), seller = (C.gst && C.gst.state) || "Maharashtra";
  const items = P.length ? P.map((p, i) => ({ id: p.id, name: p.name, opt: "", qty: i ? 1 : 2, price: +p.price || 500 })) : [{ id: "x", name: "Sample product", opt: "", qty: 2, price: 500 }];
  const sub = items.reduce((a, x) => a + x.price * x.qty, 0), ship = 60, o = { id: "1042", at: new Date().toISOString(), items, t: { sub, ship, total: sub + ship }, c: { name: "Asha Rao", email: "asha@example.com", phone: "+91 98765 43210", address: "12 MG Road", city: "Pune", pin: "411001", state: seller } };
  setTimeout(() => (invP ||= new Promise((ok, no) => { if (window.SiteInvoice) return ok(); const s = document.createElement("script"); s.src = "assets/invoice.js"; s.onload = () => ok(); s.onerror = no; document.head.appendChild(s); }))
    .then(() => { const f = $("#inv-pv"); if (f) { f.srcdoc = window.SiteInvoice.html(o, C, { bar: false }); f.onload = () => { try { f.style.height = f.contentDocument.documentElement.scrollHeight + 20 + "px"; } catch (e) {} }; } }).catch(() => {}), 0);
  return `<div class="wrap" style="padding:18px 0 60px"><p class="soft" style="font-size:13px">Preview with a sample order. ${C.gst && C.gst.on ? "" : "Switch “Offer a GST invoice” on to offer it to customers."}</p><iframe id="inv-pv" title="Invoice preview" style="width:100%;height:1100px;border:1px solid var(--line);border-radius:12px;background:#fff"></iframe></div>`;
}
function openInvoice(o) {
  (invP ||= new Promise((ok, no) => { if (window.SiteInvoice) return ok(); const s = document.createElement("script"); s.src = "assets/invoice.js"; s.onload = () => ok(); s.onerror = no; document.head.appendChild(s); }))
    .then(() => window.SiteInvoice.open(o, C)).catch(() => {});
}
/** An order as the invoice reads it, from either a saved order here or one from the account list. */
function invOrder(id) {
  const loc = store.get("orders", []).find((x) => x.id === id), acc = (window.__accOrders || []).find((x) => x.order_no === id);
  if (acc) return { id: acc.order_no, at: acc.created_at, items: acc.items, t: acc.totals, c: { name: acc.name || (loc && loc.c.name) || "", email: acc.email || "", phone: acc.phone || "", ...(acc.address || (loc && loc.c) || {}), gstin: (loc && loc.c.gstin) || "" } };
  return loc || null;
}
function totals(lines = cartLines(), pin = curPin()) {
  const S = C.settings, sub = lines.reduce((s, l) => s + Number(l.p.price) * l.qty, 0), q = shipQuote(pin);
  const over = q.freeOver != null ? q.freeOver : Number(S.freeShippingOver);
  const free = over > 0 && sub >= over;
  const ship = !lines.length || free ? 0 : q.fee != null ? q.fee : Number(S.shippingFee) || 0;
  const pct = Number(S.taxPercent) || 0;
  const pt = ptsFor(sub), net = sub - pt.off; // points the buyer spends come off the goods, before tax
  const taxAdd = pct && !S.taxIncluded ? Math.round(net * pct) / 100 : 0;
  const taxIn = pct && S.taxIncluded ? Math.round((net - net / (1 + pct / 100)) * 100) / 100 : 0;
  const total = Math.round((net + ship + taxAdd) * 100) / 100;
  const left = over > 0 && !free ? over - sub : 0;
  const L = C.loyalty || {}, earn = L.on && +L.earn > 0 ? Math.floor((net / 100) * +L.earn) : 0;
  return { sub, ship, taxAdd, taxIn, total, left, free, pts: pt.pts, ptsOff: pt.off, earn };
}
/** Which of email and phone a shopper must give (Checkout → “A shopper must give”): email, phone, both or either one.
 *  Left alone, it is as before: email always, and the phone when it is asked for. A shop with accounts always needs the email. */
function mustGive() {
  const K = C.checkout || {}, n = ["email", "phone", "both", "either"].includes(K.need) ? K.need : "";
  const v = !!CAN.otp && !PREVIEW; // every shopper verifies their number: it is always asked for
  if (!n) return { email: true, phone: v || !!K.askPhone, askPhone: v || !!K.askPhone || !!ME(), either: false }; // (signed in: the other contact is asked for too)
  return { email: n === "email" || n === "both", phone: v || n === "phone" || n === "both", askPhone: true, either: n === "either" && !v };
}
/* Email check (Checkout → “Verify the email address”): a 6-digit code is emailed, and the order carries the proof.
   If the shop's database can't send the code at all, it gives a pass instead, so shoppers are never locked out. */
const EV = { tok: "", email: "", sent: false, msg: "" };
const evCan = () => !!CAN.em && !PREVIEW && !!(HOST && HOST.api && HOST.site);
const evEmail = () => { const i = $("#email"); return String(i ? i.value : EV.email).trim().toLowerCase(); };
const evTok = () => (EV.tok && EV.email === evEmail() && +EV.tok.replace(/^s:/, "").split(".")[0] > Date.now() + 60000 ? EV.tok : "");
/* “Verify” sits inside the box it verifies (a tick once done); the code row and the notes open under the box. */
const vTick = `<span class="in-tick">✓ Verified</span>`;
function evSlot() { const t = evTok(); if (ME() && ME().kind === "email") return vTick; return !evCan() || (t && t.startsWith("s:")) ? "" : t ? vTick : `<button type="button" class="in-vbtn" data-ev="send">${EV.sent ? "Resend" : "Verify"}</button>`; }
function evBox() {
  if (!evCan() || evTok() || (ME() && ME().kind === "email")) return "";
  const bad = EV.msg ? `<span class="err" role="alert">${esc(EV.msg)}</span>` : "";
  return (EV.sent ? `<div class="in-v has"><input class="in" id="evcode" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="Enter the code" aria-label="Code we emailed you"><button type="button" class="in-vbtn" data-ev="check">Confirm</button></div><span class="soft vnote">Enter the code we emailed you.</span>`
    : `<span class="soft vnote">We email a code to verify this address before taking the order${mustGive().email ? "" : " (only if you give one)"}.</span>`) + bad;
}
function vDraw(slot, box, a, b) { const s = $(slot), x = $(box); if (s) { s.innerHTML = a; s.parentNode.classList.toggle("has", !!a); } if (x) x.innerHTML = b; }
function evDraw() { vDraw("#evslot", "#evbox", evSlot(), evBox()); }
async function evAct(send) {
  const email = evEmail(), code = String(($("#evcode") || {}).value || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { EV.msg = "Enter your email address first."; return evDraw(); }
  if (!send && !/^\d{4,8}$/.test(code)) { EV.msg = "Enter the code."; return evDraw(); }
  EV.msg = "";
  try {
    const r = await fetch(HOST.api + "/eotp/" + (send ? "send" : "check") + "/" + encodeURIComponent(HOST.site), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, code }) }), j = await r.json().catch(() => null);
    if (!r.ok) EV.msg = (j && j.error) || "That didn't work. Please try again.";
    else if (send && j && j.skip) { EV.tok = "s:" + j.skip; EV.email = email; EV.sent = false; }
    else if (send) { EV.sent = true; EV.tok = ""; }
    else { EV.tok = String(j.token || ""); EV.email = email; EV.sent = false; }
  } catch (e) { EV.msg = "Couldn't reach us just now. Check your connection."; }
  evDraw(); const c = $("#evcode"); if (c) c.focus();
}
/* Points (content.loyalty): a buyer proves their phone number with a WhatsApp code, sees their points and can take them
   off the order. The shop's database holds the points and works the discount out again itself. */
const PTS = { tok: "", phone: "", info: null, use: false, sent: false, msg: "", via: "" };
const VIA = { wa: "on WhatsApp", sms: "by SMS" }, viaNow = () => (CAN.via.includes(PTS.via) ? PTS.via : CAN.via[0] || "wa");
const ptsOn = () => !!(C.loyalty && C.loyalty.on) && !!CAN.pts; // points can be spent here
const ptsCan = () => (ptsOn() || !!CAN.otp) && !PREVIEW && !!(HOST && HOST.api && HOST.site) && (mustGive().askPhone || !!ME());
const ptsPhone = () => { const i = $("#phone"); return i ? i.value : PTS.phone; };
/** Enough to show and spend points: a verified number, or being signed in. */
const ptsOK = () => ptsProved() || !!ME();
const ptsProved = () => !!(ME() && ME().kind === "phone") || !!PTS.tok && +PTS.tok.split(".")[0] > Date.now() + 60000 && digits(PTS.phone).length >= 8 && digits(ptsPhone()) === digits(PTS.phone);
function ptsFor(sub) {
  const P = PTS.info;
  if (PAGE !== "checkout" || !P || !PTS.use || !ptsCan() || !ptsOn() || !ptsOK() || !(P.worth > 0) || P.points < Math.max(1, P.min || 0) || !(sub > 0)) return { pts: 0, off: 0 };
  const pts = Math.max(0, Math.min(Math.floor(P.points), Math.floor((sub * P.maxPct) / 100 / P.worth)));
  return { pts, off: Math.round(pts * P.worth * 100) / 100 };
}
function pvSlot() { if (ME() && ME().kind === "phone") return vTick; return !ptsCan() || (ME() && !CAN.otp) ? "" : ptsProved() ? vTick : `<button type="button" class="in-vbtn" data-pts="send">${PTS.sent ? "Resend" : "Verify"}</button>`; }
function pvBox() {
  if (!ptsCan() || ptsProved() || (ME() && !CAN.otp)) return "";
  const ways = CAN.via.map((v) => VIA[v]).join(" or "), bad = PTS.msg ? `<span class="err" role="alert">${esc(PTS.msg)}</span>` : "";
  return (PTS.sent ? `<div class="in-v has"><input class="in" id="ptscode" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="Enter the code" aria-label="Code we sent you ${VIA[viaNow()]}"><button type="button" class="in-vbtn" data-pts="check">Confirm</button></div><span class="soft vnote">Enter the code we sent ${VIA[viaNow()]}.</span>`
    : `${CAN.via.length > 1 ? `<div class="in-via" role="group" aria-label="Send the code">${CAN.via.map((v) => `<button type="button" data-pts="via" data-via="${v}" aria-pressed="${viaNow() === v}">${v === "wa" ? "WhatsApp" : "SMS"}</button>`).join("")}</div>` : ""}<span class="soft vnote">${CAN.otp ? `We send a code ${ways} to verify this number before taking the order.` : `Optional: verify ${ways} to use your points.`}</span>`) + bad;
}
/** The points themselves, beside the order summary: the tick box once the number is verified, and what this order earns. */
function ptsBox() {
  const P = PTS.info, n = (k) => `${k} point${k === 1 ? "" : "s"}`, e = C.loyalty && C.loyalty.on ? totals().earn : 0; let h = "";
  if (ptsCan() && ptsOn() && ptsOK() && P) { const t = totals();
    h = P.points >= Math.max(1, P.min || 0) && P.worth > 0
      ? `<label class="co-consent"><input type="checkbox" id="usepts"${PTS.use ? " checked" : ""}> <span><b>Use my points</b><br><span class="soft">You have ${n(P.points)}${t.pts ? `: ${t.pts} used here, ${esc(money(t.ptsOff))} off` : `, worth up to ${esc(money(Math.round(P.points * P.worth * 100) / 100))}`}.</span></span></label>`
      : `<p class="soft">You have ${n(P.points)}.${P.min > P.points ? ` Points can be used from ${P.min}.` : ""}</p>`; }
  else if (ptsCan() && ptsOn() && !ME()) h = `<p class="soft">Verify your phone number (under Your details) to use your points.</p>`;
  return h || e ? `<div class="ptsbox" aria-live="polite">${h}${e ? `<p class="soft">This order earns you ${n(e)}.</p>` : ""}</div>` : "";
}
function ptsDraw() { vDraw("#pvslot", "#pvbox", pvSlot(), pvBox()); const b = $("#ptsbox"); if (b) b.innerHTML = ptsBox(); const rows = $("#sumrows"); if (rows && PAGE === "checkout") rows.innerHTML = summaryRows(totals()); }
async function ptsAct(send) {
  const phone = ptsPhone(), code = String(($("#ptscode") || {}).value || "").trim(), at = HOST.api + "/", site = encodeURIComponent(HOST.site), post = (path, body) => fetch(at + path + "/" + site, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (digits(phone).length < 8) { PTS.msg = "Enter your phone number under Your details first."; return ptsDraw(); }
  if (!send && !/^\d{4,8}$/.test(code)) { PTS.msg = "Enter the code."; return ptsDraw(); }
  PTS.msg = "";
  try {
    const r = await post("otp/" + (send ? "send" : "check"), { phone, code, via: viaNow() }), j = await r.json().catch(() => null);
    if (!r.ok) PTS.msg = (j && j.error) || "That didn't work. Please try again.";
    else if (send) { PTS.sent = true; PTS.tok = ""; PTS.info = null; if (j && j.via) PTS.via = j.via; }
    else {
      PTS.tok = String(j.token || ""); PTS.phone = phone; PTS.sent = false;
      if (ptsOn()) { const pr = await post("points", { phone, otp: PTS.tok }); PTS.info = pr.ok ? await pr.json() : { points: 0, min: 0, worth: 0, maxPct: 0 }; }
    }
  } catch (e) { PTS.msg = "Couldn't reach us just now. Check your connection."; }
  ptsDraw(); const c = $("#ptscode"); if (c) c.focus();
}
/** Gateways the shop's own database (Host to External Services) can charge with the owner's keys: the exact total, confirmed by itself. */
let CAN = { rz: "", pg: [], pts: false, em: false, otp: false, via: ["wa"] };
const GWID = { razorpay: "rz", cashfree: "cf", phonepe: "pe", stripe: "st", paypal: "pp" }, GWNAME = { razorpay: "Razorpay", cashfree: "Cashfree", phonepe: "PhonePe", stripe: "Stripe", paypal: "PayPal" };
const dbPay = (m) => !PREVIEW && !!(HOST && HOST.api && HOST.site) && (m === "razorpay" ? !!CAN.rz : CAN.pg.includes(GWID[m]));
/* Customer accounts (assets/acct.js, content.account): the shopper signs in before checkout, and "My account" in the
   header shows their orders and points. A signed-in phone number or email address counts as verified. */
const ME = () => (window.SiteAcct && SiteAcct.on() ? SiteAcct.user() : null);
let ADDR_AT = 0; // which saved address the checkout is using
const mustSign = () => !!(window.SiteAcct && SiteAcct.on() && !SiteAcct.user() && !SiteAcct.skipped() && (!PREVIEW || PV === "signin"));
let acctP = null;
const loadAcct = () => (acctP ||= new Promise((ok, no) => { if (window.SiteAcct) return ok(); const s = document.createElement("script"); s.src = "assets/acct.js"; s.onload = () => ok(); s.onerror = no; document.head.appendChild(s); }));
async function ptsMine() { // a signed-in shopper's points, without another code
  if (!ME() || !ptsOn() || PAGE !== "checkout") return;
  try { const r = await fetch(HOST.api + "/points/" + encodeURIComponent(HOST.site), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: ptsPhone(), email: evEmail(), acct: ME().pass }) }); if (r.ok) { PTS.info = await r.json(); ptsDraw(); } } catch (e) { /* points are a bonus */ }
}
/** How the checkout's sections are drawn (Theme & layout → Account customization): cards, numbered steps, or plain. */
const uiT = (k, d) => { const v = C.account && C.account.ui && String(C.account.ui[k] || "").trim(); return v || d; };
const coLook = () => { const v = C.account && C.account.ui && C.account.ui.checkout; return ["cards", "steps", "plain"].includes(v) ? v : "cards"; };
/* The Studio's preview has no database: a made-up account stands in, so the look can be chosen. */
function previewAcct() {
  if (!PREVIEW || !(C.account && C.account.on)) return;
  loadAcct().then(() => { const by = C.account.by === "email" || C.account.by === "either" ? C.account.by : "phone", had = !!(window.SiteAcct && SiteAcct.on());
    SiteAcct.init({ demo: true, signedIn: PV === "account", api: "", site: "preview", kind: "store", addresses: (C.account || {}).addresses !== false, ask: { dob: !!(C.account || {}).dob, gender: !!(C.account || {}).gender }, ui: C.account.ui || {}, acct: { by, phone: by === "email" ? [] : ["wa"], email: by !== "phone" }, money: (n) => money(n), img: (path) => imgUrl({ path }), demoItems: (C.products || []).slice(0, 3).map((p) => ({ n: p.name, i: (p.images && p.images[0] && p.images[0].path) || "" })), biz: { name: (C.brand && C.brand.name) || "" }, onChange: () => render() });
    if (PV === "account" && !previewAcct.opened) { previewAcct.opened = true; SiteAcct.open(); }
    if (!had) render(); }).catch(() => {});
}
function askCan() {
  if (askCan.done || PREVIEW || !(HOST && HOST.api && HOST.site) || (PAGE !== "checkout" && !(C.account && C.account.on))) return; askCan.done = true; askCan.waiting = PAGE === "checkout" && !!(C.account && C.account.on);
  const fin = () => { if (askCan.waiting) { askCan.waiting = false; if (!$(".done")) render(); } };
  fetch(HOST.api + "/site/" + encodeURIComponent(HOST.site) + "/can", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (!j) return fin(); CAN = { rz: String(j.rz || ""), pg: Array.isArray(j.pg) ? j.pg : [], pts: !!j.pts, em: !!j.em, otp: !!j.otp, via: Array.isArray(j.via) && j.via.length ? j.via.filter((v) => v === "wa" || v === "sms") : ["wa"] }; if (PAGE === "checkout") { if (!cameBack() && (CAN.rz || CAN.pg.length || CAN.otp)) render(); else { ptsDraw(); evDraw(); } }
    if (!j.acct) fin(); else loadAcct().then(() => { const redo = () => { if (!ME()) { PTS.info = null; PTS.use = false; } if (!$(".done")) render(); ptsMine(); };
      SiteAcct.init({ api: HOST.api, site: HOST.site, kind: "store", addresses: (C.account || {}).addresses !== false, ask: { dob: !!(C.account || {}).dob, gender: !!(C.account || {}).gender }, ui: (C.account && C.account.ui) || {}, acct: j.acct, money: (n) => money(n), img: (path) => imgUrl({ path }), biz: (() => { const L = C.legal || {}, K = C.contact || {}; return { name: L.name || (C.brand && C.brand.name) || "", address: L.address || K.address || "", phone: L.phone || K.phone || "", email: L.email || K.email || "", gstin: L.gstin || "", inv: C.invoice || null, logo: imgUrl(C.brand && C.brand.logo) }; })(), onChange: redo }); askCan.waiting = false; redo(); }).catch(fin); }).catch(fin);
}
function methods() {
  const P = C.payments, out = [], own = (n) => `You pay on ${n}'s secure page and come back here. The order is placed as soon as you've paid.`;
  if (P.upi.enabled && vpaOk(P.upi.vpa) && C.settings.currency === "INR") out.push({ id: "upi", label: P.upi.label, desc: "Scan a QR code or open your UPI app. The amount is filled in." });
  if (P.razorpay.enabled && (dbPay("razorpay") || httpsOk(P.razorpay.link))) out.push({ id: "razorpay", label: P.razorpay.label, desc: dbPay("razorpay") ? "Card, UPI, netbanking or wallet, in Razorpay's secure window." : "Pay on Razorpay's secure page." });
  if (P.cashfree.enabled && dbPay("cashfree")) out.push({ id: "cashfree", label: P.cashfree.label, desc: own("Cashfree") });
  if (P.phonepe.enabled && dbPay("phonepe")) out.push({ id: "phonepe", label: P.phonepe.label, desc: own("PhonePe") });
  if (P.stripe.enabled && (dbPay("stripe") || httpsOk(P.stripe.link))) out.push({ id: "stripe", label: P.stripe.label, desc: dbPay("stripe") ? own("Stripe") : "Pay on Stripe's secure page." });
  if (P.paypal.enabled && (dbPay("paypal") || ppOk(P.paypal.username))) out.push({ id: "paypal", label: P.paypal.label, desc: dbPay("paypal") ? own("PayPal") : "Pay on PayPal with the amount filled in." });
  if (P.cod.enabled) out.push({ id: "cod", label: P.cod.label, desc: P.cod.note });
  return out;
}

/* ============================================================
   LAYOUT
   ============================================================ */
function applyTheme(t) {
  const r = document.documentElement.style;
  r.background = t.bg; r.colorScheme = onColor(t.bg) === "#FFFFFF" ? "dark" : "light";
  if (!PREVIEW) try { localStorage.setItem("site-bg:" + location.pathname.replace(/[^/]*$/, ""), t.bg); } catch (e) {}
  ["bg", "surface", "text", "soft", "line", "accent", "accent2", "sale"].forEach((k) => r.setProperty("--" + k, t[k]));
  r.setProperty("--on-accent", onColor(t.accent)); r.setProperty("--on-accent2", onColor(t.accent2)); r.setProperty("--on-sale", onColor(t.sale));
  const deep = t.deep || t.text; r.setProperty("--deep", deep); r.setProperty("--on-deep", onColor(deep));
  const ib = t.introBg || deep; r.setProperty("--intro-bg", ib); r.setProperty("--intro-fg", t.introFg || onColor(ib));
  r.setProperty("--logo-r", Math.max(0, Math.min(50, t.logoRadius ?? 26)) + "%");
  MOTIF = window.SiteMotifs ? SiteMotifs.resolve(t, "cafe") : "geometric";
  const d = document.documentElement.dataset; d.motif = moOn() ? MOTIF : "geometric";
  for (const k of ["layout", "heroArt", "nav", "cards", "buttons", "motionStyle", "pattern", "ornament", "heading", "shead", "width", "grid", "product", "cursor", "loader", "textfx", "hoverfx", "scrollfx", "overlay", "herofx", "loaderOn"]) d[k] = String(t[k] || "");
  d.scrollease = t.scrollEase || "light"; d.linebreaks = t.lineBreaks || "typed"; d.menu = String(t.navMode || ""); d.menumob = String(t.navModeMob || "");
  d.crumbs = (C.nav || {}).crumbs === false ? "off" : "on"; d.introfont = t.introFont || "display"; d.introcase = t.introCase || "upper";
  r.setProperty("--r", (+t.radius || 0) + "px");
  r.setProperty("--fd", `"${t.fontDisplay}",Georgia,serif`); r.setProperty("--fb", `"${t.fontBody}","Helvetica Neue",Arial,sans-serif`);
  if (window.SiteFonts) { const cd = SiteFonts.use(t, "display", imgUrl), cb = SiteFonts.use(t, "body", imgUrl); if (cd) r.setProperty("--fd", `"${cd}","${t.fontDisplay}",Georgia,serif`); if (cb) r.setProperty("--fb", `"${cb}","${t.fontBody}","Helvetica Neue",Arial,sans-serif`); }
  // One stylesheet per family, so a family Google can't serve never blocks the others.
  const FOK = !(window.SiteFX && window.SiteFX.fontsOk) || window.SiteFX.fontsOk(C); // Google Fonts wait for consent when the site says so
  [[FONTS[t.fontDisplay], "fontlink"], [FONTS[t.fontBody], "fontlink2"], ["JetBrains+Mono:wght@400;500", "fontlink3"]].forEach(([f, id]) => {
    let l = document.getElementById(id); if (!l) { l = document.createElement("link"); l.id = id; l.rel = "stylesheet"; document.head.appendChild(l); }
    const href = f && FOK ? "https://fonts.googleapis.com/css2?family=" + f + "&display=swap" : ""; if (href && l.getAttribute("href") !== href) l.setAttribute("href", href); if (!FOK) l.removeAttribute("href");
  });
  // The next page starts loading these fonts from its <head>, before any script runs (no font swap on arrival).
  if (!PREVIEW) try { localStorage.setItem("site-fonts:" + location.pathname.replace(/[^/]*$/, ""), JSON.stringify(["fontlink", "fontlink2", "fontlink3"].map((id) => [id, (document.getElementById(id) || {}).href || ""]))); } catch (e) {}
}
/** Tab title: the home page uses the title as typed, other pages "{page} · {site}" (Title & metadata). */
function setTitle(label) {
  const one = (x) => String(x || "").replace(/\s*\n\s*/g, " ").trim();
  document.title = !label ? one(C.seo.title || C.brand.name) : one((C.seo.titlePattern || "{page} · {site}").replace(/\{page\}/g, one(label)).replace(/\{site\}/g, one(C.brand.name)));
}
/** Keeps the description and preview tags in step for crawlers that run JavaScript (the CMS also bakes them into the HTML). */
function applyMeta() {
  if (PREVIEW) return;
  const set = (attr, key, val) => { let m = document.head.querySelector(`meta[${attr}="${key}"]`); if (!val) { if (m) m.remove(); return; } if (!m) { m = document.createElement("meta"); m.setAttribute(attr, key); document.head.appendChild(m); } m.setAttribute("content", val); };
  const d = String(C.seo.description || "").replace(/\s+/g, " ").trim();
  set("name", "description", d); set("property", "og:title", document.title); set("property", "og:description", d);
  set("name", "theme-color", /^#[0-9a-f]{3,8}$/i.test(C.seo.themeColor || "") ? C.seo.themeColor : "");
}
/** The browser-tab icon: the uploaded logo, else the name's initials in the accent colour. The logo is used as it
 *  is straight away, then swapped for a square copy (the whole logo, centred) so a wide logo isn't squashed. */
let iconKey = "";
function setIcon() {
  const B = C.brand, t = C.theme, acc = t.accent, rad = Math.max(0, Math.min(50, t.logoRadius ?? 26)), src = imgUrl(B.logo), key = [src, B.name, rad, acc].join("|");
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
/** "As typed" headings: keep each typed line on one line, shrinking up to ~45% to fit; wrap only if it still can't. */
function fitLines() {
  const on = document.documentElement.dataset.linebreaks !== "auto";
  document.querySelectorAll("h1.fit,h2.fit").forEach((el) => {
    el.style.fontSize = ""; el.style.width = ""; el.classList.remove("fit-one");
    const room = el.clientWidth; // measured while wrapping is allowed: the real space, before a long line can widen a grid or flex column
    if (!on || !room) return;
    el.classList.add("fit-one"); el.style.width = room + "px";
    const need = el.scrollWidth; el.style.width = "";
    if (need <= room + 1) return;
    const k = room / need;
    if (k < 0.55) { el.classList.remove("fit-one"); return; }
    el.style.fontSize = (parseFloat(getComputedStyle(el).fontSize) * k * 0.98).toFixed(2) + "px";
  });
}
let fitT = 0;
addEventListener("resize", () => { clearTimeout(fitT); fitT = setTimeout(fitLines, 120); });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => fitLines());
function header() {
  const B = C.brand, N = C.nav;
  const initials = B.name.split(/\s+/).map((w) => w[0] || "").join("").slice(0, 2).toUpperCase();
  const cur = (p) => (PAGE === p ? ' aria-current="page"' : "");
  return `${B.showAnnouncement && B.announcement ? `<div class="announce">${ml(B.announcement)}</div>` : ""}
  <header class="hdr"><div class="wrap" style="position:relative">
    <a class="brand" href="index.html"><span class="mark" style="${markCss()}">${B.logoVideo ? `<video src="${esc(imgUrl(B.logoVideo))}"${B.logo ? ` poster="${esc(imgUrl(B.logo))}"` : ""} autoplay muted loop playsinline aria-hidden="true" style="${B.logoFit === "wide" ? `height:${markH()}px;width:auto;max-width:min(${markH() * 6}px,52vw);object-fit:contain` : "width:100%;height:100%;object-fit:cover"};display:block"></video>` : B.logo ? `<img src="${esc(imgUrl(B.logo))}" alt=""${B.logoFit === "wide" ? ` style="height:${markH()}px;width:auto;max-width:min(${markH() * 6}px,52vw);object-fit:contain"` : ""}>` : esc(initials)}</span>${B.showName === false && (B.logo || B.logoVideo) ? "" : `<b>${esc(B.name)}</b>`}</a>
    <nav class="nav" id="nav" aria-label="Main"><a href="index.html"${cur("home")}>${esc(N.home)}</a><a href="shop.html"${cur("shop")}>${esc(N.shop)}</a>${swOn() && C.warranty.inNav ? `<a href="warranty.html"${cur("warranty")}>${esc(C.warranty.navLabel || "Warranty")}</a>` : ""}${N.showPortfolio ? `<a href="portfolio.html"${cur("portfolio")}>${esc(N.portfolio)}</a>` : ""}${spList().filter((p) => p.inNav).map((p) => `<a href="${esc(spHref(p))}"${PAGE === "page" && spSlug(p) === spSlug({ slug: spCur() }) ? ' aria-current="page"' : ""}>${esc(p.navLabel || p.title)}</a>`).join("")}</nav>
    ${window.SiteAcct && SiteAcct.on() ? `<a class="cartlink acctlink" href="#" data-acct><span class="t">${ME() ? "My account" : "Sign in"}</span></a>` : ""}
    <a class="cartlink" href="cart.html"${cur("cart")}><span class="t">${esc(N.cart)}</span><span class="n" data-cartcount>${cartCount()}</span></a>
    <button class="menubtn" type="button" aria-controls="nav" aria-expanded="false" aria-label="Menu">☰</button>
  </div></header>`;
}
function footer() {
  const K = C.contact, ms = methods();
  return `<footer class="ftr"><div class="wrap"><div class="cols">
    <div class="about"><b style="font-family:var(--fd);font-size:22px">${esc(C.brand.name)}</b><p>${ml(C.footer.text || C.brand.tagline)}</p>${ms.length ? `<div class="pm">${ms.map((m) => `<span>${esc(m.label)}</span>`).join("")}</div>` : ""}</div>
    <div><h4>${esc(C.nav.shop)}</h4><ul><li><a href="shop.html">${esc(lab("allProducts", "All products"))}</a></li>${C.categories.map((c) => `<li><a href="shop.html?c=${encodeURIComponent(c.id)}">${esc(c.name)}</a></li>`).join("")}</ul></div>
    <div><h4>${esc(lab("help", "Help"))}</h4><ul>${swOn() && C.warranty.inFooter ? `<li><a href="warranty.html">${esc(C.warranty.navLabel || "Warranty")}</a></li>` : ""}${C.policies.map((p) => `<li><a href="policies.html#${esc(p.id || slugify(p.title))}">${esc(p.title)}</a></li>`).join("")}${spList().filter((p) => p.inFooter !== false).map((p) => `<li><a href="${esc(spHref(p))}">${esc(p.navLabel || p.title)}</a></li>`).join("")}${ckOn() ? `<li><a href="#cookie-settings">${esc(C.consent.reopenLabel || "Cookie settings")}</a></li>` : ""}${C.nav.showPortfolio ? `<li><a href="portfolio.html">${esc(C.nav.portfolio)}</a></li>` : ""}</ul></div>
    <div><h4>${esc(lab("contact", "Contact"))}</h4><ul>${K.email ? `<li><a href="mailto:${esc(K.email)}">${esc(K.email)}</a></li>` : ""}${K.phone ? `<li><a href="tel:${esc(digits(K.phone))}">${esc(K.phone)}</a></li>` : ""}${K.whatsapp ? `<li><a href="https://wa.me/${digits(K.whatsapp)}" target="_blank" rel="noopener">WhatsApp</a></li>` : ""}${safeUrl(K.instagram) ? `<li><a href="${esc(safeUrl(K.instagram))}" target="_blank" rel="noopener">Instagram</a></li>` : ""}${K.address ? `<li class="soft" style="white-space:pre-line">${esc(K.address)}</li>` : ""}</ul></div>
  </div><div class="base"><span>© ${new Date().getFullYear()} ${esc(C.brand.name)}</span><span>Prices in ${esc(C.settings.currency)}</span></div></div></footer>`;
}
function pcard(p) {
  const badge = p.stock === "out" ? `<span class="badge out">Sold out</span>` : onSale(p) ? `<span class="badge sale">Sale</span>` : p.badge ? `<span class="badge">${esc(p.badge)}</span>` : "";
  return `<a class="pcard" href="${productUrl(p)}"><div class="im">${badge}${pimg(p)}</div><div><h3>${esc(p.name)}</h3>${revRow(p.id)}${p.short ? `<p class="s">${esc(p.short)}</p>` : ""}</div><div class="price">${kindsOf(p).length ? "From " + esc(money(Math.min(...kindsOf(p).map((k) => k.price)))) : esc(money(p.price)) + (onSale(p) ? `<s>${esc(money(p.compareAt))}</s>` : "")}</div></a>`;
}

/* ============================================================
   PAGES
   ============================================================ */
/* Hero structures (kit 3) for the home page: each builds its own markup from the same hero content. */
/* A hero video plays silently on a loop in the picture's place (the picture is its cover); still for visitors who asked for less motion. */
const heroFilm = (h) => `<video src="${esc(imgUrl(h.video))}"${h.image ? ` poster="${esc(imgUrl(h.image))}"` : ""}${matchMedia("(prefers-reduced-motion: reduce)").matches ? "" : " autoplay"} muted loop playsinline aria-hidden="true" style="width:100%;height:100%;object-fit:cover;display:block"></video>`;
function hxArt(H, col) {
  return `<div class="art" data-edit="${H.hero.video ? "home.hero.video" : "home.hero.image"}">${H.hero.video ? heroFilm(H.hero) : H.hero.image ? `<img src="${esc(imgUrl(H.hero.image))}" alt="">` : `<div class="collage">${(col.length ? col : [{ name: "A" }, { name: "B" }, { name: "C" }]).map((p) => `<div style="border-radius:calc(var(--r)*1.1);overflow:hidden">${p.images && p.images[0] ? pimg(p) : ph(p.name)}</div>`).join("")}</div>`}</div>`;
}
function hxBits(H) {
  return {
    eb: `<p class="eyebrow">${ml(H.hero.eyebrow)}</p>`,
    h1: `<h1 class="fit">${ml(H.hero.title)}</h1>`,
    lead: `<p class="lead">${ml(H.hero.text)}</p>`,
    cta: `<div class="cta"><a class="btn pri" href="shop.html">${esc(H.hero.cta)} →</a>${C.nav.showPortfolio ? `<a class="btn" href="portfolio.html">${esc(C.nav.portfolio)}</a>` : ""}</div>`,
    flat: esc(String(H.hero.title || "").replace(/\s*\n\s*/g, " ")),
  };
}
const HXS = {
  marquee(H, col) { const B = hxBits(H), run = Array.from({ length: 6 }, () => `<span>${B.flat}</span><i>✦</i>`).join("");
    return `<section class="hero hx hx-marquee"><div class="hx-mq fx-skip" aria-hidden="true"><div class="hx-mq-t">${run}</div></div><div class="wrap hxw"><div class="hx-row"><div class="htx">${B.eb}<div class="sr">${B.h1}</div>${B.lead}${B.cta}</div>${hxArt(H, col)}</div></div></section>`; },
  bento(H, col) { const B = hxBits(H), n = C.products.length, cats = C.categories.length;
    return `<section class="hero hx hx-bento"><div class="wrap hxw"><div class="hx-grid">
      <div class="hx-t hx-name">${B.eb}${B.h1}</div><div class="hx-t hx-art">${hxArt(H, col)}</div>
      <div class="hx-t hx-role">${B.lead}</div><div class="hx-t hx-stat"><b>${n}</b><span>${esc(lab("products", "Products"))}</span></div>
      <div class="hx-t hx-stat"><b>${cats || 1}</b><span>${esc(lab("collections", "Collections"))}</span></div><div class="hx-t hx-go">${B.cta}</div></div></div></section>`; },
  orbit(H, col) { const B = hxBits(H), ring = (esc(C.brand.name) + " · " + esc(String(H.hero.eyebrow || "").replace(/\n/g, " ")) + " · ").repeat(3);
    return `<section class="hero hx hx-orbit"><div class="wrap hxw"><div class="hx-orb"><svg class="hx-ring" viewBox="0 0 200 200" aria-hidden="true"><defs><path id="hxc" d="M100,100 m-88,0 a88,88 0 1,1 176,0 a88,88 0 1,1 -176,0"/></defs><text><textPath href="#hxc">${ring}</textPath></text></svg>${hxArt(H, col)}</div><div class="htx hx-mid">${B.h1}${B.lead}${B.cta}</div></div></section>`; },
  index(H, col) { const B = hxBits(H), items = C.categories.length ? C.categories.map((c) => [`shop.html?c=${encodeURIComponent(c.id)}`, c.name]) : [["shop.html", C.nav.shop], ...(C.nav.showPortfolio ? [["portfolio.html", C.nav.portfolio]] : [])];
    return `<section class="hero hx hx-index"><div class="wrap hxw"><div class="hx-cols"><div class="htx">${B.eb}${B.h1}${B.lead}${B.cta}</div><ol class="hx-list">${items.map(([u, t], i) => `<li><a href="${esc(u)}"><span class="m">${String(i + 1).padStart(2, "0")}</span>${esc(t)}<i>→</i></a></li>`).join("")}</ol></div></div></section>`; },
  frame(H, col) { const B = hxBits(H);
    return `<section class="hero hx hx-frame"><div class="wrap hxw"><div class="hx-box htx"><span class="hx-c tl">${ml(H.hero.eyebrow)}</span><span class="hx-c tr">${esc(C.brand.name)}</span><span class="hx-c bl">${C.products.length} ${esc(lab("products", "Products"))}</span><span class="hx-c br">↓</span>${B.h1}${B.lead}${B.cta}${hxArt(H, col)}</div></div></section>`; },
  stackname(H, col) { const B = hxBits(H), lines = String(H.hero.title || "").split(/\n/);
    const h1 = `<h1>${lines.map((l, i) => `<span class="${i % 2 ? "o" : ""}">${esc(l)}</span>`).join("<br>")}</h1>`;
    return `<section class="hero hx hx-stackname"><div class="wrap hxw">${hxArt(H, col)}<div class="htx">${B.eb}${h1}<div class="hx-under">${B.lead}${B.cta}</div></div></div></section>`; },
};
const PAGES = {
  home() {
    const H = C.home, feat = C.products.filter((p) => p.featured).slice(0, 8), list = feat.length ? feat : C.products.slice(0, 4);
    const col = C.products.slice(0, 3);
    const hx = HXS[C.theme.layout] ? HXS[C.theme.layout](H, col) : "";
    return `${hx || `<section class="hero">${C.theme.ornament && C.theme.ornament !== "none" ? (moOn() ? `<div class="orn mo" aria-hidden="true">${[["accent2", 0], ["accent", 1], ["sale", 2]].map(([k, i]) => `<span style="color:var(--${k});--mo2:var(--${k === "accent" ? "accent2" : "accent"})">${SiteMotifs.svg(MOTIF, i, 0, true)}</span>`).join("")}</div>` : `<div class="orn" aria-hidden="true"><i></i><i></i><i></i></div>`) : ""}<div class="wrap"><div class="htx"><p class="eyebrow">${ml(H.hero.eyebrow)}</p><h1 class="fit">${ml(H.hero.title)}</h1><p class="lead">${ml(H.hero.text)}</p>
      <div class="cta"><a class="btn pri" href="shop.html">${esc(H.hero.cta)} →</a>${C.nav.showPortfolio ? `<a class="btn" href="portfolio.html">${esc(C.nav.portfolio)}</a>` : ""}</div></div>
      <div class="art" data-edit="${H.hero.video ? "home.hero.video" : "home.hero.image"}">${H.hero.video ? heroFilm(H.hero) : H.hero.image ? `<img src="${esc(imgUrl(H.hero.image))}" alt="">` : `<div class="collage">${(col.length ? col : [{ name: "A" }, { name: "B" }, { name: "C" }]).map((p) => `<div style="border-radius:calc(var(--r)*1.1);overflow:hidden">${p.images && p.images[0] ? pimg(p) : ph(p.name)}</div>`).join("")}</div>`}</div></div></section>`}
    ${list.length ? `<section class="sec" data-sec="featured" style="padding-top:12px"><div class="wrap"><div class="sec-h"><div><h2 class="fit">${ml(H.featuredTitle)}</h2>${H.featuredText ? `<p class="soft" style="margin-top:8px">${ml(H.featuredText)}</p>` : ""}</div><a class="link" href="shop.html">${esc(lab("viewAll", "View all"))}</a></div><div class="grid">${list.map(pcard).join("")}</div></div></section>` : ""}
    ${H.showCategories && C.categories.length ? `<section class="sec" data-sec="categories" style="padding-top:0"><div class="wrap"><div class="sec-h"><h2 class="fit">${ml(H.categoriesTitle)}</h2></div><div class="cats">${C.categories.map((c) => `<a class="cat" href="shop.html?c=${encodeURIComponent(c.id)}">${c.image ? `<img src="${esc(imgUrl(c.image))}" alt="">` : ph(c.name)}<span>${esc(c.name)}<small>${C.products.filter((p) => p.category === c.id).length} products</small></span></a>`).join("")}</div></div></section>` : ""}
    ${H.banner.show ? `<section class="sec" data-sec="banner" style="padding-top:0"><div class="wrap"><div class="banner"><div class="tx"><h2 class="fit">${ml(H.banner.title)}</h2><p>${ml(H.banner.text)}</p>${C.nav.showPortfolio && H.banner.cta ? `<a class="btn" href="portfolio.html">${esc(H.banner.cta)} →</a>` : ""}</div><div class="im">${H.banner.image ? `<img src="${esc(imgUrl(H.banner.image))}" alt="">` : ph(H.banner.title)}</div></div></div></section>` : ""}
    ${H.testimonials.length ? `<section class="sec" data-sec="reviews" style="padding-top:0"><div class="wrap"><div class="sec-h"><h2 class="fit">${ml(H.testimonialsTitle)}</h2></div>${H.google && H.google.rating && H.testimonials.some((t) => t.source === "google") ? `<p class="g-sum"><a href="${esc(H.google.url || "#")}" target="_blank" rel="noopener"><span class="stars" aria-hidden="true">${starRow(H.google.rating)}</span> <b>${(+H.google.rating).toFixed(1)}</b> from ${esc(String(H.google.count))} reviews on Google</a></p>` : ""}<div class="quotes">${H.testimonials.map((t) => `<figure class="quote" style="margin:0">${t.rating ? `<span class="stars" role="img" aria-label="${+t.rating} out of 5 stars">${starRow(t.rating)}</span>` : ""}<p>“${esc(t.quote)}”</p><span><b>${esc(t.name)}</b>${t.role ? ` · ${esc(t.role)}` : ""}</span></figure>`).join("")}</div></div></section>` : ""}`;
  },
  shop() {
    const S = C.shop, q = new URLSearchParams(location.search);
    return `<section class="page-h"><div class="wrap"><p class="eyebrow">${esc(C.brand.name)}</p><h1 class="fit">${ml(S.title)}</h1>${S.intro ? `<p>${ml(S.intro)}</p>` : ""}</div></section>
    <div class="wrap"><div class="toolbar"><div class="chips" role="group" aria-label="Category"><button class="chip" type="button" data-c="" aria-pressed="${!q.get("c")}">All</button>${C.categories.map((c) => `<button class="chip" type="button" data-c="${esc(c.id)}" aria-pressed="${q.get("c") === c.id}">${esc(c.name)}</button>`).join("")}</div>
      <div class="tools">${S.showSearch ? `<input class="in" type="search" id="q" placeholder="Search products" aria-label="Search products" value="${esc(q.get("q") || "")}">` : ""}<select class="in" id="sort" aria-label="Sort">${[["featured", "Featured first"], ["new", "Newest first"], ["low", "Price: low to high"], ["high", "Price: high to low"]].map(([v, l]) => `<option value="${v}"${(q.get("s") || S.sortDefault) === v ? " selected" : ""}>${l}</option>`).join("")}</select></div></div>
      <p class="count" id="count" aria-live="polite"></p><div class="grid" id="results"></div><div style="height:72px"></div></div>`;
  },
  product() {
    const q = new URLSearchParams(location.search).get("p");
    let p = C.products.find((x) => slugOf(x) === q || x.id === q);
    if (!p && (PREVIEW || !q)) p = C.products[0];
    if (!p) return `<div class="wrap"><div class="empty" style="margin-block:64px"><h1 style="font-size:32px">Product not found</h1><p>It may have been removed.</p><a class="btn pri" href="shop.html">Back to the shop</a></div></div>`;
    const cat = catOf(p.category), imgs = p.images && p.images.length ? p.images : [null];
    const related = C.products.filter((x) => x.id !== p.id && x.category === p.category).slice(0, 4);
    setTitle(p.name);
    return `<div class="wrap"><nav class="crumbs" aria-label="Breadcrumb"><a href="shop.html">${esc(C.nav.shop)}</a>${cat ? `<span>/</span><a href="shop.html?c=${encodeURIComponent(cat.id)}">${esc(cat.name)}</a>` : ""}<span>/</span><span>${esc(p.name)}</span></nav>
    <div class="pd" data-pid="${esc(p.id)}"><div class="gal"><div class="main" id="mainimg">${imgs[0] ? `<img src="${esc(imgUrl(imgs[0]))}" alt="${esc(p.name)}">` : ph(p.name)}</div>
      ${imgs.length > 1 ? `<div class="thumbs">${imgs.map((im, i) => `<button type="button" data-i="${i}" aria-pressed="${i === 0}" aria-label="Photo ${i + 1}"><img src="${esc(imgUrl(im))}" alt=""></button>`).join("")}</div>` : ""}</div>
    <div class="info">${p.badge ? `<p class="eyebrow">${esc(p.badge)}</p>` : ""}<h1>${esc(p.name)}</h1>
      <div class="price" id="pd-price" aria-live="polite">${kindsOf(p).length ? "From " + esc(money(Math.min(...kindsOf(p).map((k) => k.price)))) : esc(money(p.price)) + (onSale(p) ? `<s>${esc(money(p.compareAt))}</s><span class="off">${Math.round((1 - p.price / p.compareAt) * 100)}% off</span>` : "")}</div>
      <p class="stock ${p.stock}" id="pd-stock">${p.stock === "out" ? "Sold out" : p.stock === "low" ? (p._left > 0 ? `Only ${p._left} left` : "Only a few left") : "In stock"}</p>
      ${p.short ? `<p style="font-size:17px">${esc(p.short)}</p>` : ""}
      ${kindsOf(p).length ? `<div class="opt"><span class="lbl" id="kindl">${esc(p.kindName || "Variety")} <small class="soft">(choose one)</small></span><div class="kindbtns optbtns-k" role="group" aria-labelledby="kindl">${kindsOf(p).map((k) => `<button type="button" data-k="${esc(k.label)}" aria-pressed="false">${esc(k.label)} · ${esc(money(k.price))}</button>`).join("")}</div></div>` : ""}
      ${p.options && p.options.length ? `<div class="opt"><span class="lbl" id="optl">${esc(p.optionName || "Option")}</span><div class="optbtns" role="group" aria-labelledby="optl">${p.options.map((o, i) => `<button type="button" data-o="${esc(o)}" aria-pressed="${i === 0}">${esc(o)}</button>`).join("")}</div></div>` : ""}
      ${pinBox()}
      ${p.stock !== "out" ? `<div class="opt"><span class="lbl">Quantity</span><div class="buy"><div class="qty"><button type="button" data-q="-1" aria-label="Fewer">−</button><output id="qty" aria-live="polite">1</output><button type="button" data-q="1" aria-label="More">+</button></div>
        <button class="btn pri" type="button" id="add">Add to cart</button><button class="btn" type="button" id="buynow">Buy now</button></div></div>` : `<a class="btn" href="shop.html">See other products</a>`}
      ${p.features && p.features.length ? `<ul class="feat">${p.features.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>` : ""}
      ${p.description ? `<div class="desc">${paras(p.description)}</div>` : ""}
      ${Number(C.settings.freeShippingOver) > 0 ? `<p class="soft" style="font-size:14px">Free shipping on orders over ${esc(money(C.settings.freeShippingOver))}.</p>` : ""}
    </div></div>
    ${revOn() ? `<section class="rv" id="rv" aria-label="Reviews" style="padding-bottom:56px"></section>` : ""}
    ${related.length ? `<section style="padding-bottom:72px"><div class="sec-h"><h2 style="font-size:28px">You may also like</h2></div><div class="grid">${related.map(pcard).join("")}</div></section>` : ""}</div>`;
  },
  cart() {
    const lines = cartLines();
    if (!lines.length) return `<section class="page-h"><div class="wrap"><h1>${esc(C.nav.cart)}</h1></div></section><div class="wrap" style="padding-bottom:80px"><div class="empty"><p>Your cart is empty.</p><a class="btn pri" href="shop.html">Start shopping</a></div></div>`;
    const t = totals(lines), S = C.settings, max = Math.max(1, Number(S.maxQty) || 10), below = Number(S.minOrder) > 0 && t.sub < Number(S.minOrder);
    return `<section class="page-h"><div class="wrap"><h1>${esc(C.nav.cart)}</h1></div></section>
    <div class="wrap two"><div class="lines">${lines.map((l, i) => `<div class="line"><a class="im" href="${productUrl(l.p)}">${pimg(l.p)}</a><div><h3>${esc(l.p.name)}</h3><p class="meta">${l.opt ? esc(l.opt) + " · " : ""}${esc(money(l.p.price))} each</p>
      <div class="act"><div class="qty"><button type="button" data-line="${i}" data-d="-1" aria-label="Fewer"${l.qty <= 1 ? " disabled" : ""}>−</button><output>${l.qty}</output><button type="button" data-line="${i}" data-d="1" aria-label="More"${l.qty >= max ? " disabled" : ""}>+</button></div><button class="rm" type="button" data-rm="${i}">Remove</button></div></div>
      <div class="tot">${esc(money(l.p.price * l.qty))}</div></div>`).join("")}</div>
    <aside class="sum"><h2>Summary</h2><div id="sumrows">${summaryRows(t)}</div>${pinBox()}
      ${t.left > 0 ? `<p class="note">Add <b>${esc(money(t.left))}</b> more for free shipping.</p>` : ""}
      ${below ? `<p class="note">The minimum order is <b>${esc(money(S.minOrder))}</b>.</p>` : ""}
      <a class="btn pri block" href="checkout.html"${below ? ' aria-disabled="true" style="pointer-events:none;opacity:.45"' : ""}>Checkout</a><a class="link" style="text-align:center" href="shop.html">Continue shopping</a></aside></div>`;
  },
  checkout() {
    if (new URLSearchParams(location.search).has("track")) return trackPage();
    const lines = cartLines(), q = new URLSearchParams(location.search).get("order");
    if (q) {
      const o = store.get("orders", []).find((x) => x.id === q);
      if (o) return orderDone(o);

    }
    if (!lines.length) return `<section class="page-h"><div class="wrap"><h1>${esc(C.checkout.title)}</h1></div></section><div class="wrap" style="padding-bottom:80px"><div class="empty"><p>Your cart is empty.</p><a class="btn pri" href="shop.html">Start shopping</a></div></div>`;
    const K = C.checkout, ms = methods(), t = totals(lines);

    if (PREVIEW && PV === "invoice") return invPreview();
    if (askCan.waiting) return `<section class="page-h"><div class="wrap"><h1 class="fit">${ml(K.title)}</h1></div></section><div class="wrap" style="padding-bottom:80px"><div class="sk-wrap" role="status" aria-label="Loading"><i class="sk-b s"></i><i class="sk-b"></i><i class="sk-b"></i><i class="sk-b h"></i></div></div>`;
    if (mustSign()) return `<section class="page-h"><div class="wrap"><h1 class="fit">${ml(K.title)}</h1></div></section><div class="wrap" style="padding-bottom:80px"><div id="sa-gate"></div></div>`;
    { const k = window.SiteAcct && !ME() && SiteAcct.skipped(); if (k) { EV.tok = k.token; EV.email = k.email; } }
    const SP = ME() ? SiteAcct.profile() : null, SA = (SP && SP.addresses) || [], sa = SA[Math.min(ADDR_AT, SA.length - 1)] || null;
    const saved = SP ? { ...(SP.name ? { name: SP.name } : {}), ...(ME().kind === "phone" && SP.email ? { email: SP.email } : {}), ...(ME().kind === "email" && SP.phone ? { phone: SP.phone } : {}), ...(sa ? { address: [sa.line1, sa.line2].filter(Boolean).join(", "), city: sa.city, pin: sa.pin, state: sa.state } : {}) } : {};
    const me = { ...store.get("me", {}), ...saved, ...(ME() ? (ME().kind === "phone" ? { phone: ME().typed || "+" + ME().key } : { email: ME().key }) : window.SiteAcct && SiteAcct.skipped() ? { email: SiteAcct.skipped().email } : {}) };
    const V = { email: ["ev", evSlot(), evBox()], phone: ["pv", pvSlot(), pvBox()] };
    const fld = (id, label, type = "text", req = true, full = false, ac = "") => `<div class="f${full ? " full" : ""}"><label for="${id}">${esc(label)}${req ? "" : ' <span class="soft">(optional)</span>'}</label>${V[id] ? `<div class="in-v${V[id][1] ? " has" : ""}">` : ""}<input class="in" id="${id}" name="${id}" type="${type}"${req ? " required" : ""}${ac ? ` autocomplete="${ac}"` : ""}${(ME() && ME().kind === id) ? " readonly" : ""} value="${esc(me[id] || "")}">${V[id] ? `<span id="${V[id][0]}slot">${V[id][1]}</span></div>` : ""}<span class="err" id="${id}-e"></span>${V[id] ? `<div class="vbox" id="${V[id][0]}box">${V[id][2]}</div>` : ""}</div>`;
    return `<section class="page-h"><div class="wrap"><h1 class="fit">${ml(K.title)}</h1>${K.intro ? `<p>${ml(K.intro)}</p>` : ""}</div></section>
    <form class="wrap two" id="co" data-look="${esc(coLook())}" novalidate><div class="form">
      <div class="box"><h2>${esc(uiT("coDetails", "Your details"))}</h2>${ME() ? `<p class="soft" style="font-size:13.5px;margin:-6px 0 12px">Signed in as <b>${esc(/@/.test(ME().key) ? ME().key : "+" + ME().key)}</b> · <a href="#" data-acct>My account</a></p>` : ""}<div class="fgrid">${fld("name", "Full name", "text", true, false, "name")}${fld("email", "Email", "email", mustGive().email, false, "email")}${mustGive().askPhone ? fld("phone", "Phone", "tel", mustGive().phone, false, "tel") : ""}</div>${mustGive().either ? `<p class="soft" style="font-size:13.5px;margin-top:8px">Give your email address or your phone number (or both), so we can reach you about the order.</p>` : ""}</div>
      ${K.askAddress ? `<div class="box"><h2>${esc(uiT("coAddress", "Delivery address"))}</h2>${SA.length > 1 ? `<div class="f" style="margin-bottom:12px"><label for="addrpick">Use a saved address</label><select class="in" id="addrpick">${SA.map((a, i) => `<option value="${i}"${i === Math.min(ADDR_AT, SA.length - 1) ? " selected" : ""}>${esc([a.label, a.line1, a.city].filter(Boolean).join(" · "))}</option>`).join("")}</select></div>` : ""}<div class="fgrid">${fld("address", "Address", "text", true, true, "street-address")}${fld("city", "City", "text", true, false, "address-level2")}${fld("pin", "PIN / postcode", "text", true, false, "postal-code")}${fld("state", "State", "text", true, false, "address-level1")}${gstOn() && C.gst.askGstin ? fld("gstin", "GSTIN, for a business invoice", "text", false, true) : ""}</div>${shipOn() ? `<p class="soft" id="pin-msg" role="status" style="font-size:14px;margin-top:8px"></p>` : ""}</div>` : ""}
      ${K.askNotes ? `<div class="box"><div class="f"><label for="notes">Notes <span class="soft">(optional)</span></label><textarea class="in" id="notes" name="notes" rows="3"></textarea></div></div>` : ""}
      <div class="box"><h2>${esc(uiT("coPay", "Payment"))}</h2>${ms.length ? `<div class="pays" role="radiogroup" aria-label="Payment method">${ms.map((m, i) => `<label class="pay"><input type="radio" name="pm" value="${m.id}"${i === 0 ? " checked" : ""}><div><b>${esc(m.label)}</b><span>${esc(m.desc)}</span></div></label>`).join("")}</div>` : `<p class="note">Online payment isn't set up yet. Place the order and we'll contact you about payment.</p>`}</div>
    </div>
    <aside class="sum"><h2>${esc(uiT("coOrder", "Order"))}</h2><div class="mini">${lines.map((l) => `<div class="it"><div class="im">${pimg(l.p)}</div><div>${esc(l.p.name)}${l.opt ? `<br><span class="soft">${esc(l.opt)}</span>` : ""} × ${l.qty}</div><b>${esc(money(l.p.price * l.qty))}</b></div>`).join("")}</div><div id="sumrows">${summaryRows(t)}</div><div id="ptsbox">${ptsBox()}</div>
      ${consentWords("") ? `<label class="co-consent"><input type="checkbox" id="co-consent"> <span>${esc(consentWords(""))}</span></label>` : ""}
      ${uiT("coTrust", "") ? `<p class="co-trust">${esc(uiT("coTrust", ""))}</p>` : ""}<p class="err" id="co-err" role="alert"></p><button class="btn pri block" type="submit">${esc(K.button)}</button>${C.account && C.account.ui && C.account.ui.coNoteOff === true ? "" : `<p class="soft" style="font-size:13px">${esc(uiT("coNote", "Nothing is charged yet. You'll pay and send the order on the next screen."))}</p>`}</aside></form>`;
  },
  portfolio() {
    const P = C.portfolio;
    return `<section class="hero pf-hero"><div class="wrap"><div><p class="eyebrow">${ml(P.eyebrow)}</p><h1 class="fit" style="font-size:clamp(38px,5.6vw,66px);margin-top:14px">${ml(P.title)}</h1><p class="lead">${ml(P.intro)}</p></div><div class="im">${P.image ? `<img src="${esc(imgUrl(P.image))}" alt="">` : ph(P.title)}</div></div></section>
    <section class="sec" style="padding-top:12px"><div class="wrap"><div class="story"><h2 class="fit" style="font-size:clamp(28px,4vw,40px)">${ml(P.storyTitle)}</h2><div class="body">${paras(P.story)}</div></div>
      ${P.stats.length ? `<div class="stats">${P.stats.map((s) => `<div><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`).join("")}</div>` : ""}</div></section>
    ${P.work.length ? `<section class="sec" style="padding-top:0"><div class="wrap"><div class="sec-h"><h2 class="fit">${ml(P.workTitle)}</h2></div><div class="work">${P.work.map((w) => `<article class="wcard"><div class="im">${w.image ? `<img src="${esc(imgUrl(w.image))}" alt="" loading="lazy">` : ph(w.title)}</div><div class="bd">${w.tag ? `<span class="tag">${esc(w.tag)}</span>` : ""}<h3>${esc(w.title)}</h3><p>${esc(w.text)}</p>${safeUrl(w.link) ? `<a class="link" href="${esc(safeUrl(w.link))}" target="_blank" rel="noopener">View ↗</a>` : ""}</div></article>`).join("")}</div></div></section>` : ""}
    <section class="sec" style="padding-top:0"><div class="wrap"><div class="ctaband"><h2 class="fit">${ml(P.ctaTitle)}</h2><p class="soft">${ml(P.ctaText)}</p><a class="btn pri" href="shop.html">${esc(P.ctaButton)} →</a></div></div></section>`;
  },
  account() {
    return `<section class="page-h"><div class="wrap"><h1>${esc(C.accountPage.title)}</h1></div></section><div class="wrap" style="padding-bottom:80px"><div id="acct" aria-live="polite"><p class="soft">Loading…</p></div></div>`;
  },
  warranty() {
    const W = C.warranty;
    return `<section class="page-h"><div class="wrap"><h1>${esc(W.title)}</h1>${W.intro ? `<p class="soft" style="margin-top:8px">${esc(W.intro)}</p>` : ""}</div></section><section class="sec" style="padding-top:8px"><div class="wrap"><div id="sw-page" style="max-width:720px"></div></div></section>`;
  },
  page() {
    const S = window.SitePages; if (!S) return "";
    const p = spHere(), o = { home: "index.html", homeLabel: C.nav.home || "Home", preview: PREVIEW };
    return p ? S.article(p, o) : S.missing(o);
  },
  policies() {
    return `<section class="page-h"><div class="wrap"><h1>Policies</h1></div></section><div class="wrap pol">${C.policies.map((p) => `<section id="${esc(p.id || slugify(p.title))}"><h2>${esc(p.title)}</h2><p>${esc(p.text)}</p></section>`).join("")}</div>`;
  },
};

function summaryRows(t) {
  const S = C.settings;
  return `<div class="row"><span>Subtotal</span><span>${esc(money(t.sub))}</span></div>
    ${t.ptsOff ? `<div class="row"><span>Points used (${t.pts})</span><span>− ${esc(money(t.ptsOff))}</span></div>` : ""}
    <div class="row"><span>Shipping</span><span>${t.ship ? esc(money(t.ship)) : "Free"}</span></div>
    ${t.taxAdd ? `<div class="row"><span>${esc(S.taxLabel)} (${S.taxPercent}%)</span><span>${esc(money(t.taxAdd))}</span></div>` : ""}
    <div class="row t"><span>Total</span><span>${esc(money(t.total))}</span></div>
    ${t.taxIn ? `<p class="soft" style="font-size:13px">Includes ${esc(S.taxLabel)} of ${esc(money(t.taxIn))}</p>` : ""}`;
}

/* ============================================================
   ORDERS
   ============================================================ */
function newOrderId() {
  const d = new Date(), pre = String(C.settings.orderPrefix || "ORD").replace(/[^A-Za-z0-9]/g, "").slice(0, 6).toUpperCase() || "ORD";
  return `${pre}-${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${Math.floor(1000 + Math.random() * 9000)}`;
}
function orderText(o) {
  const L = [`${C.orders.messageIntro || "New order"} ${o.id}`, `Date: ${new Date(o.at).toLocaleString()}`, "", "Items:"];
  o.items.forEach((i) => L.push(`• ${i.name}${i.opt ? ` (${i.opt})` : ""} × ${i.qty} = ${money(i.price * i.qty)}`));
  L.push("", `Subtotal: ${money(o.t.sub)}`); if (o.t.ptsOff) L.push(`Points used (${o.t.pts}): − ${money(o.t.ptsOff)}`);
  L.push(`Shipping: ${o.t.ship ? money(o.t.ship) : "Free"}`);
  if (o.t.taxAdd) L.push(`${C.settings.taxLabel}: ${money(o.t.taxAdd)}`);
  L.push(`Total: ${money(o.t.total)}`, `Payment: ${o.methodLabel}`, "", "Customer:", o.c.name); if (o.c.email) L.push(o.c.email);
  if (o.c.phone) L.push(o.c.phone);
  if (o.c.address) L.push(`${o.c.address}, ${o.c.city} ${o.c.pin}, ${o.c.state}`);
  if (o.c.notes) L.push("", `Notes: ${o.c.notes}`);
  return L.join("\n");
}
function upiLink(o) {
  const U = C.payments.upi;
  return `upi://pay?pa=${String(U.vpa).trim()}&pn=${encodeURIComponent(U.payeeName || C.brand.name)}&am=${Number(o.t.total).toFixed(2)}&cu=INR&tn=${encodeURIComponent(o.id)}`;
}
function orderDone(o) {
  const K = C.checkout, P = C.payments, O = C.orders, txt = orderText(o);
  const wa = digits(O.whatsapp), mail = O.email;
  const viaWa = wa && O.sendVia !== "email", viaMail = mail && O.sendVia !== "whatsapp";
  let pay = "";
  if (o.paid) pay = `<p><b>${esc(money(o.t.total))} paid</b> through ${esc(GWNAME[o.method] || "the payment page")}. Thank you.</p>`;
  else if (o.method === "upi" && o.utr) pay = `<p><b>${esc(money(o.t.total))} paid by UPI</b>, reference <code>${esc(o.utr)}</code>.</p><p class="note">We check it in our UPI app and confirm your order${o.saved ? "" : " once you send it to us below"}.</p>`;
  else if (o.method === "upi") pay = `<p>Scan the code in any UPI app, or pay to the UPI ID. The amount and order number are filled in.</p><div class="qr" id="qr" aria-label="UPI QR code"></div><div class="copyrow"><code>${esc(P.upi.vpa)}</code><button type="button" data-copy="${esc(P.upi.vpa)}">Copy UPI ID</button></div><a class="btn pri" href="${esc(upiLink(o))}">Open UPI app</a><p class="note">Check your UPI app shows <b>${esc(P.upi.payeeName || C.brand.name)}</b> and <b>${esc(money(o.t.total))}</b> before you confirm.</p>`;
  else if (o.method === "razorpay" || o.method === "stripe") { const link = o.method === "razorpay" ? P.razorpay.link : P.stripe.link; pay = `<p>On the payment page, enter <b>${esc(money(o.t.total))}</b> and the order number <b>${esc(o.id)}</b>.</p><a class="btn pri" href="${esc(link)}" target="_blank" rel="noopener">Pay on ${o.method === "razorpay" ? "Razorpay" : "Stripe"} ↗</a>`; }
  else if (o.method === "paypal") pay = `<p>PayPal opens with the amount filled in. Add the order number <b>${esc(o.id)}</b> as the note.</p><a class="btn pri" href="https://www.paypal.me/${encodeURIComponent(P.paypal.username)}/${Number(o.t.total)}${esc(C.settings.currency)}" target="_blank" rel="noopener">Pay ${esc(money(o.t.total))} with PayPal ↗</a>`;
  else if (o.method === "cod") pay = `<p>${esc(P.cod.note || "Pay when your order arrives.")} Keep <b>${esc(money(o.t.total))}</b> ready.</p>`;
  else pay = `<p>We'll contact you about payment.</p>`;
  return `<div class="wrap"><div class="done"><p class="eyebrow">Order ${esc(o.id)}</p><h1 class="fit">${ml(K.successTitle)}</h1><p class="soft" style="font-size:17px">${ml(K.successText)}</p>
    <div><span class="lbl">Your order number</span><br><span class="oid">${esc(o.id)}</span></div>
    <div class="box"><div class="step"><i>${o.utr || o.paid ? "✓" : "1"}</i><div><h2 style="font-size:22px">${o.paid ? "Payment received" : o.utr ? "Payment sent" : `Pay ${esc(money(o.t.total))}`}</h2>${pay}</div></div></div>
    <div class="box"><div class="step"><i>${o.saved ? "✓" : "2"}</i><div><h2 style="font-size:22px">${o.saved ? "We have your order" : "Send us the order"}</h2>${o.saved ? `<p class="note">It is saved with us. You can also send a copy:</p>` : ""}<p>This opens ${viaWa && viaMail ? "WhatsApp or your email app" : viaWa ? "WhatsApp" : "your email app"} with the full order written out. Just press send.</p>
      <div class="buy">${invBtn(o.id)}${viaWa ? `<a class="btn pri" href="https://wa.me/${wa}?text=${encodeURIComponent(txt)}" target="_blank" rel="noopener">Send on WhatsApp</a>` : ""}${viaMail ? `<a class="btn${viaWa ? "" : " pri"}" href="mailto:${esc(mail)}?subject=${encodeURIComponent(`Order ${o.id}`)}&body=${encodeURIComponent(txt)}">Send by email</a>` : ""}</div>
      ${!viaWa && !viaMail ? `<p class="note">Copy the order below and send it to ${esc(C.contact.email || "us")}.</p>` : ""}
      <pre class="msg" id="msg">${esc(txt)}</pre><button class="btn" type="button" data-copy-msg>Copy order details</button></div></div></div>
    ${o.saved && shipCan() ? `<div id="shipslot" data-no="${esc(o.id)}"></div><a class="link" href="checkout.html?track=1&order=${encodeURIComponent(o.id)}">Track this order later</a>` : ""}
    <a class="link" href="shop.html">Continue shopping</a></div></div>`;
}

/* ============================================================
   RENDER + EVENTS
   ============================================================ */
/* Warranty & service status (assets/warranty.js, loaded when needed). Records: assets/data/warranty.json, next to the
   photos (on the Studio's database for hosted sites). */
let swP;
const SW = () => (swP ||= new Promise((ok, no) => { if (window.SiteWarranty) return ok(window.SiteWarranty); const s = document.createElement("script"); s.src = "assets/warranty.js"; s.onload = () => ok(window.SiteWarranty); s.onerror = no; document.head.appendChild(s); }));
const swOn = () => !!(C.warranty && C.warranty.enabled);
const swOpts = () => ({ cfg: C.warranty, url: (HOST && HOST.assets ? HOST.assets : "") + "assets/data/warranty.json", preview: PREVIEW, esc });
const swOpen = () => SW().then((w) => w.open(swOpts())).catch(() => {});
const swMount = () => { const el = document.getElementById("sw-page"); if (el) SW().then((w) => w.mount(el, swOpts())).catch(() => {}); };
/** Five stars, filled up to the rating. */
const starRow = (n) => { const r = Math.max(0, Math.min(5, Math.round(+n || 0))); return "★".repeat(r) + `<span class="off">${"★".repeat(5 - r)}</span>`; };
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
/* The logo's size and shape in the menu (Brand → Logo): a square icon of the chosen height, or a wide logo that keeps
   its own proportions (never cropped, no backing or rounded corners). */
const markH = () => Math.max(20, Math.min(96, +C.brand.logoSize || 38));
function markCss() {
  const B = C.brand, h = markH();
  return B.logoFit === "wide" && (B.logo || B.logoVideo) ? `height:${h}px;width:auto;background:none;border-radius:0` : h !== 38 ? `width:${h}px;height:${h}px;font-size:${Math.round(h * 0.4)}px` : "";
}
function heroLogo() {
  const B = C.brand, on = PAGE === "home" && B.logoOnHero, src = on && B.logo ? imgUrl(B.logo) : "";
  if (window.SiteLogo) window.SiteLogo.hero(src, { video: on && B.logoVideo ? imgUrl(B.logoVideo) : "", at: "#main h1", size: B.heroLogoSize, radius: C.theme.logoRadius ?? 26, wide: B.logoFit === "wide", edit: "brand.logo" });
}
/* Social links in the footer (assets/social.js). */
let ssP;
function social() {
  const S = C.social || {};
  if (!S.on && !window.SiteSocial) return;
  (ssP ||= new Promise((ok, no) => { if (window.SiteSocial) return ok(); const s = document.createElement("script"); s.src = "assets/social.js"; s.onload = () => ok(); s.onerror = no; document.head.appendChild(s); }))
    .then(() => window.SiteSocial.mount(C, { footer: "footer.ftr", before: ".base", imgUrl })).catch(() => {});
}
/* The social photo wall (assets/wall.js): the owner's Instagram or Pinterest photos on the home page, among its sections. */
let wallP = null;
function wall() {
  const W = C.wall || {};
  if (!W.on && !window.SiteWall) return;
  (wallP ||= new Promise((ok, no) => { if (window.SiteWall) return ok(); const s = document.createElement("script"); s.src = "assets/wall.js"; s.onload = () => ok(); s.onerror = no; document.head.appendChild(s); }))
    .then(() => window.SiteWall.mount(C, { sections: "#main > section", home: PAGE === "home", imgUrl })).catch(() => {});
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
const langOn = () => { const n = C.i18n || {}; return !!n.on && (n.langs || []).some((l) => l && l.on !== false); };
function langGate() {
  if (window.SiteLang) { if (PREVIEW) window.SiteLang.force((C.i18n || {}).preview || ""); window.SiteLang.apply(C); return false; }
  if (!langOn() || lgFail) return false;
  (lgP ||= new Promise((ok, no) => { const s = document.createElement("script"); s.src = "assets/lang.js"; s.onload = () => ok(); s.onerror = no; document.head.appendChild(s); })).then(render, () => { lgFail = true; render(); });
  return true;
}
function lang() { if (window.SiteLang) window.SiteLang.mount(C, { navs: ["#nav"], again: render }); }
/* PIN checks, the checkout's live shipping figure and the invoice button work on whatever page is drawn. */
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest("[data-pinchk]");
  if (b) { const i = $("#pinchk"), pin = i ? i.value.replace(/\D/g, "").slice(0, 6) : ""; const out = $("#pinres"); if (pin.length < 6) { if (out) { out.textContent = "Enter the 6 digits of your PIN code."; out.style.color = ""; } return; } store.set("pin", pin); const r = pinSays(pin); if (out) { out.textContent = r.text; out.style.color = r.ok === false ? "var(--sale,#c0392b)" : ""; } const rows = $("#sumrows"); if (rows) rows.innerHTML = summaryRows(totals()); return; }
  const ab = e.target.closest && e.target.closest("[data-acct]");
  if (ab) { e.preventDefault(); if (window.SiteAcct) SiteAcct.open(); return; }
  const eb = e.target.closest && e.target.closest("[data-ev]");
  if (eb) { evAct(eb.getAttribute("data-ev") === "send"); return; }
  const pb = e.target.closest && e.target.closest("[data-pts]");
  if (pb) { const v = pb.getAttribute("data-via"); if (v) PTS.via = v; if (pb.getAttribute("data-pts") === "via") { PTS.sent = false; ptsDraw(); } else ptsAct(pb.getAttribute("data-pts") === "send"); return; }
  const v = e.target.closest && e.target.closest("[data-inv]");
  if (v) { const o = invOrder(v.getAttribute("data-inv")); if (o) openInvoice(o); }
});
document.addEventListener("change", (e) => { if (e.target && e.target.id === "addrpick") { ADDR_AT = +e.target.value || 0; const k = $("#co"); if (k) { const m = store.get("me", {}); for (const i of ["name", "email", "phone"]) { const el = $("#" + i, k); if (el) m[i] = el.value; } store.set("me", m); } render(); return; } if (e.target && e.target.id === "usepts") { PTS.use = e.target.checked; ptsDraw(); } });
document.addEventListener("input", (e) => {
  if (e.target && e.target.id === "phone" && PTS.tok) ptsDraw(); // a changed number is no longer the proved one
  if (e.target && e.target.id === "email" && (EV.tok || EV.sent)) { EV.sent = false; evDraw(); } // nor a changed email address
  if (!e.target || e.target.id !== "pin" || !shipOn()) return;
  const pin = e.target.value.replace(/\D/g, ""), msg = $("#pin-msg"), er = $("#pin-e"); if (er) er.textContent = "";
  if (pin.length < 6) { if (msg) msg.textContent = ""; return; }
  store.set("pin", pin); const r = pinSays(pin); if (msg) { msg.textContent = r.text; msg.style.color = r.ok === false ? "var(--sale,#c0392b)" : ""; }
  const rows = $("#sumrows"); if (rows) rows.innerHTML = summaryRows(totals(cartLines(), pin));
  const cod = $('input[name="pm"][value="cod"]'); if (cod) { const q = shipQuote(pin); cod.disabled = !q.cod; if (!q.cod && cod.checked) { const other = $('input[name="pm"]:not([value="cod"])'); if (other) other.checked = true; } }
});
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
  const t = it.to || "", at = (file, page) => ({ url: file, on: PAGE === page });
  if (t === "none") return { url: "" };
  if (t === "url") { const u = String(it.url || "").trim(); return { url: safeUrl(u) || (/^(#|\/|\.\/|[\w-]+\.html)/.test(u) ? u : "") }; }
  if (t === "page") { const p = spList().find((x) => x.id === it.page); return p ? { url: spHref(p), on: PAGE === "page" && spSlug(p) === spSlug({ slug: spCur() }) } : { url: "" }; }
  if (t === "cat") { const c = C.categories.find((x) => x.id === it.cat); let cur = ""; try { cur = new URLSearchParams(location.search).get("c") || ""; } catch (e) {} return c ? { url: "shop.html?c=" + encodeURIComponent(c.id), on: PAGE === "shop" && cur === c.id } : { url: "shop.html" }; }
  if (t === "warranty") return swOn() ? at("warranty.html", "warranty") : { url: "" };
  if (t === "account") return { url: "index.html#account" };
  const file = { home: "index.html", shop: "shop.html", portfolio: "portfolio.html", policies: "policies.html", cart: "cart.html" }[t];
  return file ? at(file, t) : { url: "" };
}
function menu() {
  if (!menuOn()) return;
  const done = () => { const w = document.getElementById("sm-wait"); if (w) w.remove(); };
  if (!window.SiteMenu && !document.getElementById("sm-wait")) { const w = document.createElement("style"); w.id = "sm-wait"; w.textContent = "#nav{visibility:hidden}"; document.head.appendChild(w); setTimeout(done, 2500); }
  (mnP ||= new Promise((ok, no) => { if (window.SiteMenu) return ok(); const s = document.createElement("script"); s.src = "assets/menu.js"; s.onload = () => ok(); s.onerror = no; document.head.appendChild(s); }))
    .then(() => { window.SiteMenu.mount(C, { navs: ["#nav"], resolve: menuGo, onPick: () => { const mb = $(".menubtn"), nav = $("#nav"); if (nav) nav.classList.remove("open"); if (mb) mb.setAttribute("aria-expanded", "false"); } }); done(); }).catch(done);
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
let lastHtml = "", waitIdx = null;
function keepWaiting() { waitIdx = new Set(); $$(".rv.wait").forEach((e) => { const i = +e.dataset.rvi; if (i >= 0) waitIdx.add(i); }); }
function render() {
  stockMark();
  askCan(); previewAcct();
  if (langGate()) return;
  applyTheme(C.theme);
  if (maintGate(render)) return;
  if (!PREVIEW && PAGE === "warranty" && !swOn()) { location.replace("index.html"); return; }
  if (PAGE !== "product") setTitle(PAGE === "home" ? "" : { shop: C.shop.title, cart: C.nav.cart, checkout: C.checkout.title, portfolio: C.nav.portfolio, policies: "Policies", account: (C.accountPage || {}).title, warranty: (C.warranty || {}).title, page: (spHere() || {}).title }[PAGE] || "");
  applyMeta();
  const fn = PAGES[PAGE] || PAGES.home;
  const html = `<a class="skip" href="#main">Skip to content</a>${header()}<main id="main">${fn()}</main>${footer()}`;
  /* A redraw that would produce exactly what is already on screen is skipped: it only made images and animations blink. */
  if (!PREVIEW && html === lastHtml && $("#app").firstChild) return;
  lastHtml = html; keepWaiting();
  $("#app").innerHTML = html;
  if (SC && SC.drawn) SC.drawn($("#app"), C);
  bind();
  if (PAGE === "checkout") recoSave(); // a signed-in shopper's own email counts, even if they never type in the form
  reveal();
  slides();
  if (window.SiteFX) try { window.SiteFX.init({ root: $("#app"), brand: C.theme.introTitle || C.brand.name, badge: C.poweredBy, bgs: C.sectionBg, asset: imgUrl, fonts: FONTS, c: C, policy: policyUrl(), again: render }); } catch (e) {}
  setIcon(); fitLines();
}
/* Hero background slides on the home page (assets/slides.js, loaded when switched on). */
let slP, slGen = 0;
function slides() {
  const S = C.home && C.home.hero && C.home.hero.slides, g = ++slGen, host = PAGE === "home" ? $("#main .hero") : null;
  if (!host || !S || !S.enabled || !(S.items || []).some((x) => x && (x.image || x.video))) { if (window.SiteSlides) window.SiteSlides.stop(); return; }
  (slP ||= new Promise((ok, no) => { if (window.SiteSlides) return ok(window.SiteSlides); const s = document.createElement("script"); s.src = "assets/slides.js"; s.onload = () => ok(window.SiteSlides); s.onerror = no; document.head.appendChild(s); }))
    .then((w) => { if (g === slGen) w.mount(host, S, { imgUrl, title: "h1", text: ".lead", hide: ".art,.hx-art,.orn" }); }).catch(() => {});
}
/* Entrance animations from the theme. In the CMS preview they play on the first render only, not on every keystroke. */
let revealed = 0;
function reveal() {
  const st = C.theme.motionStyle;
  if (!st || st === "none" || matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
  const first = revealed++ === 0; if (!first && !(waitIdx && waitIdx.size)) return; // the entrance plays once; a redraw while it is still running carries on from where it was, so nothing pops
  const els = $$(".hero .htx, .hero .art, .sec-h, .pcard, .cat, .quote, .banner, .wcard, .ctaband, .page-h .wrap, .pd .gal, .pd .info, .box, .sum, .ocard");
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.remove("wait"); io.unobserve(e.target); } }), { threshold: 0.08 });
  els.forEach((el, i) => { if (!first && !waitIdx.has(i)) return; el.dataset.rvi = i; el.classList.add("rv", "wait"); el.style.transitionDelay = (i % 4) * 70 + "ms"; io.observe(el); });
}
function bind() {
  const mb = $(".menubtn"), nav = $("#nav");
  if (mb) mb.onclick = () => { const o = nav.classList.toggle("open"); mb.setAttribute("aria-expanded", o); };
  $$("[data-copy]").forEach((b) => (b.onclick = () => copy(b.dataset.copy, "Copied")));
  if (PAGE === "shop") bindShop();
  if (PAGE === "product") bindProduct();
  if (PAGE === "cart") bindCart();
  { const g = $("#sa-gate"); if (g && window.SiteAcct) SiteAcct.gate(g); }
  if (PAGE === "checkout") bindCheckout();
  if (PAGE === "warranty") swMount();
  if (PAGE === "page" && window.SitePages) window.SitePages.after(spHere());
  heroLogo(); video(); social(); wall(); menu(); lang(); consent(); addons(); festival();
  if (location.hash && PAGE === "policies") { const el = document.getElementById(location.hash.slice(1)); if (el) el.scrollIntoView(); }
}
function bindShop() {
  const st = { c: new URLSearchParams(location.search).get("c") || "", q: new URLSearchParams(location.search).get("q") || "", s: new URLSearchParams(location.search).get("s") || C.shop.sortDefault };
  const draw = () => {
    let list = C.products.filter((p) => (!st.c || p.category === st.c) && (!st.q || (p.name + " " + p.short + " " + p.description).toLowerCase().includes(st.q.toLowerCase())));
    const idx = (p) => C.products.indexOf(p);
    if (st.s === "low") list.sort((a, b) => a.price - b.price);
    else if (st.s === "high") list.sort((a, b) => b.price - a.price);
    else if (st.s === "new") list.sort((a, b) => idx(b) - idx(a));
    else list.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || idx(a) - idx(b));
    list.sort((a, b) => (a.stock === "out" ? 1 : 0) - (b.stock === "out" ? 1 : 0));
    $("#results").innerHTML = list.length ? list.map(pcard).join("") : `<div class="empty" style="grid-column:1/-1"><p>${esc(C.shop.emptyText)}</p></div>`;
    $("#count").textContent = `${list.length} ${list.length === 1 ? "product" : "products"}`;
    $$(".chip[data-c]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.c === st.c));
    const u = new URLSearchParams(); if (st.c) u.set("c", st.c); if (st.q) u.set("q", st.q); if (st.s !== C.shop.sortDefault) u.set("s", st.s);
    history.replaceState(null, "", location.pathname + (u.toString() ? "?" + u : ""));
  };
  $$(".chip[data-c]").forEach((b) => (b.onclick = () => { st.c = b.dataset.c; draw(); }));
  const qi = $("#q"); if (qi) qi.oninput = () => { st.q = qi.value.trim(); draw(); };
  $("#sort").onchange = (e) => { st.s = e.target.value; draw(); };
  draw();
}
function bindProduct() {
  const box = $(".pd"); if (!box) return;
  const p = prodBy(box.dataset.pid), max = Math.max(1, Number(C.settings.maxQty) || 10);
  if (revOn()) revDraw(p);
  let qty = 1, opt = p.options && p.options.length ? p.options[0] : "", kind = "";
  // Varieties: one must be chosen before the price is final and the product can be added.
  const KS = kindsOf(p), full = () => [kind, opt].filter(Boolean).join(" · "), ready = () => !KS.length || !!kind;
  const gate = () => { for (const id of ["#add", "#buynow"]) { const b = $(id); if (b) { b.disabled = !ready(); if (id === "#add") b.textContent = ready() ? "Add to cart" : "Choose " + (/^[aeiou]/i.test(p.kindName || "variety") ? "an " : "a ") + String(p.kindName || "variety").toLowerCase(); } } };
  $$(".kindbtns button").forEach((b) => (b.onclick = () => { kind = b.dataset.k; $$(".kindbtns button").forEach((x) => x.setAttribute("aria-pressed", x === b)); const k = KS.find((x) => x.label === kind), pr = $("#pd-price"); if (k && pr) pr.textContent = money(k.price); gate(); }));
  gate();
  $$(".thumbs button").forEach((b) => (b.onclick = () => { $("#mainimg").innerHTML = `<img src="${esc(imgUrl(p.images[+b.dataset.i]))}" alt="${esc(p.name)}">`; $$(".thumbs button").forEach((x) => x.setAttribute("aria-pressed", x === b)); }));
  $$(".optbtns button").forEach((b) => (b.onclick = () => { opt = b.dataset.o; $$(".optbtns button").forEach((x) => x.setAttribute("aria-pressed", x === b)); }));
  // what is left of the chosen option caps the quantity; an option with none left can't be chosen
  const capNow = () => lineMax(p.id, full());
  if (STOCK) $$(".kindbtns button, .optbtns button").forEach((b) => { if (stockLeft(p.id, b.dataset.k || b.dataset.o) === 0 && ((p.id + "|" + String(b.dataset.k || b.dataset.o).replace(/\s+/g, " ").trim().toLowerCase().slice(0, 60)) in STOCK)) { b.disabled = true; b.setAttribute("data-out", ""); b.title = "Sold out"; b.style.opacity = ".45"; b.style.textDecoration = "line-through"; if (b.getAttribute("aria-pressed") === "true") { b.setAttribute("aria-pressed", "false"); if (b.dataset.o === opt) { const nx = $$(".optbtns button").find((x) => !x.disabled && x !== b); opt = nx ? nx.dataset.o : ""; if (nx) nx.setAttribute("aria-pressed", "true"); } } } });
  $$(".kindbtns button, .optbtns button").forEach((b) => b.addEventListener("click", () => { qty = Math.min(qty, capNow()); const q = $("#qty"); if (q) q.textContent = qty; }));
  $$("[data-q]").forEach((b) => (b.onclick = () => { const cap = capNow(); qty = Math.min(cap, Math.max(1, qty + Number(b.dataset.q))); $("#qty").textContent = qty; if (Number(b.dataset.q) > 0 && qty >= cap && stockLeft(p.id, full()) != null && cap < Math.max(1, Number(C.settings.maxQty) || 10)) toast(`Only ${cap} left`); }));
  const add = $("#add"); if (add) add.onclick = () => { if (!ready()) return; addToCart(p.id, full(), qty); toast(`Added to cart · <a href="cart.html">View cart</a>`); };
  const bn = $("#buynow"); if (bn) bn.onclick = () => { if (!ready()) return; addToCart(p.id, full(), qty); location.href = "checkout.html"; };
}
function bindCart() {
  const lines = cartLines(), max = Math.max(1, Number(C.settings.maxQty) || 10);
  $$("[data-line]").forEach((b) => (b.onclick = () => { const l = lines[+b.dataset.line], c = cart.find((x) => x.id === l.id && x.opt === l.opt); c.qty = Math.min(max, lineMax(l.id, l.opt), Math.max(1, c.qty + Number(b.dataset.d))); saveCart(); render(); }));
  $$("[data-rm]").forEach((b) => (b.onclick = () => { const l = lines[+b.dataset.rm]; cart = cart.filter((x) => !(x.id === l.id && x.opt === l.opt)); saveCart(); render(); }));
}
function bindCheckout() {
  if ($("#trackf")) return bindTrack();
  const done = $(".done");
  if (done) {
    const qr = $("#qr");
    if (qr) { const o = store.get("orders", []).find((x) => x.id === new URLSearchParams(location.search).get("order")); if (o && window.QRCode) { try { new window.QRCode(qr, { text: upiLink(o), width: 200, height: 200, correctLevel: window.QRCode.CorrectLevel.M }); } catch (e) { qr.outerHTML = `<p class="note">The QR code couldn't load. Use the UPI ID instead.</p>`; } } else if (!window.QRCode) qr.outerHTML = `<p class="note">The QR code couldn't load. Use the UPI ID instead.</p>`; }
    const cm = $("[data-copy-msg]"); if (cm) cm.onclick = () => copy($("#msg").textContent, "Order details copied");
    { const slot = $("#shipslot"), so = slot && store.get("orders", []).find((x) => x.id === slot.dataset.no); if (so) shipInto(slot, { no: so.id, ...(so.k ? { k: so.k } : { contact: so.c.phone || so.c.email }) }); }
    return;
  }
  const form = $("#co");
  if (!form) return;
  form.onsubmit = async (e) => {
    e.preventDefault();
    let bad = null;
    $$("input[required]", form).forEach((i) => {
      const er = $("#" + i.id + "-e"); let m = "";
      if (!i.value.trim()) m = "Fill this in.";
      else if (i.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i.value.trim())) m = "Enter a valid email address.";
      else if (i.type === "tel" && digits(i.value).length < 8) m = "Enter a phone number with at least 8 digits.";
      if (er) er.textContent = m; if (m && !bad) bad = i;
    });
    // an optional email or phone that was filled in is checked too, and "either one" needs one of them
    { const em = $("#email", form), ph = $("#phone", form), say = (i, m) => { const er = $("#" + i.id + "-e"); if (er) er.textContent = m; if (!bad) bad = i; };
      if (em && !em.required && em.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em.value.trim())) say(em, "Enter a valid email address.");
      if (ph && !ph.required && ph.value.trim() && digits(ph.value).length < 8) say(ph, "Enter a phone number with at least 8 digits.");
      if (!bad && mustGive().either && em && !em.value.trim() && !(ph && ph.value.trim())) say(em, "Enter your email address or your phone number."); }
    if (bad) { bad.focus(); return; }
    // every shopper verifies their phone number, where the shop asks for that
    if (CAN.otp && ptsCan() && !ptsProved()) { $("#co-err").textContent = PTS.sent ? "Enter the code we sent to your phone to verify your number." : "Please verify your phone number first."; const c = $("#ptscode") || $("[data-pts=send]"); if (c) { c.scrollIntoView({ block: "center" }); c.focus(); } return; }
    // the email address must be proved first, where the shop asks for that: the code is sent now if it wasn't yet
    if (evCan() && evEmail() && !evTok() && !(ME() && ME().kind === "email")) {
      const tell = (t) => { $("#co-err").textContent = t; const c = $("#evcode"); if (c) c.focus(); };
      if (EV.sent) return tell("Enter the code we emailed you to verify your email address.");
      $("#co-err").textContent = ""; await evAct(true);
      if (!evTok()) return tell(EV.sent ? "We've emailed you a code. Enter it under your email address, then place the order." : EV.msg || "Please verify your email address first.");
    }
    { const cc = $("#co-consent", form); if (cc && !cc.checked) { $("#co-err").textContent = "Please tick the box to agree before placing the order."; cc.focus(); return; } AGREED = cc ? "Agreed on " + new Date().toISOString() + ": " + consentWords("") : ""; }
    const fd = Object.fromEntries(new FormData(form).entries());
    if (shipOn() && fd.pin) {
      store.set("pin", String(fd.pin).trim()); const q = shipQuote(fd.pin);
      if (!q.ok) { const er = $("#pin-e"); if (er) er.textContent = (C.shipping || {}).blockMsg || "Sorry, we don't deliver to that PIN code yet."; $("#pin").focus(); return; }
      if (fd.pm === "cod" && !q.cod) { $("#co-err").textContent = "Cash on delivery isn't available for that PIN code. Please choose another way to pay."; return; }
    }
    const lines = cartLines(), ms = methods(), m = ms.find((x) => x.id === fd.pm);
    const o = { id: newOrderId(), at: new Date().toISOString(), method: m ? m.id : "none", methodLabel: m ? m.label : "To be arranged",
      items: lines.map((l) => ({ id: l.p.id, name: l.p.name, opt: l.opt, qty: l.qty, price: Number(l.p.price) })), t: totals(lines), ...(ptsProved() && PTS.tok ? { otp: PTS.tok } : {}), ...(ME() ? { ac: ME().pass } : {}), ...(evCan() && evTok() ? { et: evTok() } : {}),
      c: { name: fd.name || "", email: fd.email || "", phone: fd.phone || "", address: fd.address || "", city: fd.city || "", pin: fd.pin || "", state: fd.state || "", notes: fd.notes || "", gstin: String(fd.gstin || "").trim().toUpperCase().slice(0, 15) } };
    store.set("me", { name: o.c.name, email: o.c.email, phone: o.c.phone, address: o.c.address, city: o.c.city, pin: o.c.pin, state: o.c.state });
    const placeIt = () => placeOrder(o);
    // Paying by UPI comes first: the order is placed once the customer enters the payment's reference number.
    if (o.method === "upi") payFirst(o, placeIt); else if (dbPay(o.method)) payGateway(o, lines, $("#co-err"), $('button[type="submit"]', form)); else placeIt();
  };
}
/** What the shop's database keeps for an order (it shows under Purchased orders). */
let AGREED = ""; // the consent given at checkout, saved with the order
const orderData = (o) => ({ ...(AGREED ? { consent: AGREED } : {}), type: "Order", order_no: o.id, ...(o.k ? { okey: o.k } : {}), name: o.c.name, phone: o.c.phone, email: o.c.email, mode: "Shop order", address: [o.c.address, o.c.city, o.c.pin, o.c.state].filter(Boolean).join(", "),
  items: o.items.map((i) => `${i.qty} × ${i.name}${i.opt ? ` (${i.opt})` : ""} = ${money(i.price * i.qty)}`).join("\n"), total: money(o.t.total), payment: o.utr ? "UPI, paid before ordering" : o.rz || o.pg ? `Paid online (${GWNAME[o.method]})` : o.methodLabel, utr: o.utr || "",
  ...(o.rz ? { rz_order: o.rz.razorpay_order_id, rz_payment: o.rz.razorpay_payment_id, rz_sig: o.rz.razorpay_signature } : {}), ...(o.pg ? { pay_gw: o.pg.gw, pay_ref: o.pg.ref } : {}), notes: o.c.notes, ...(o.otp ? { otp_token: o.otp } : {}), ...(o.et ? { email_token: o.et } : {}), ...(o.ac ? { acct_token: o.ac } : {}), message: orderText(o) });
/** The order as the database can price it again (what was bought, and the points asked for). */
const orderCart = (o) => ({ items: o.items.map((i) => ({ id: i.id, qty: i.qty, opt: i.opt || "" })), pin: o.c.pin || "", points: (o.t && o.t.pts) || 0 });
const sendOrder = (o) => fetch(HOST.api + "/enquire/" + encodeURIComponent(HOST.site), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ page: "checkout.html", data: orderData(o), cart: orderCart(o) }) });
async function placeOrder(o) {
  // A shop hosted on the Studio's database keeps the order under Purchased orders too.
  if (!PREVIEW && HOST && HOST.api && HOST.site && o.saved == null) {
    // the order's own key: this device can ask where the parcel is with it
    if (!o.k) { try { o.k = [...crypto.getRandomValues(new Uint8Array(16))].map((x) => x.toString(16).padStart(2, "0")).join(""); } catch (e) { /* tracked by number and phone instead */ } }
    try { const r = await sendOrder(o);
      // Something sold out while the customer was checking out: the order isn't placed, and they are told what to change.
      if (r.status === 409 && !o.rz && !o.pg) { const j = await r.json().catch(() => null), msg = (j && j.error) || "Something in your cart has just sold out. Check your cart and try again."; for (const id of ["#co-err", "#pf-e"]) { const e = $(id); if (e) e.textContent = msg; } $$("#co button[type=submit], #pf-ok").forEach((b) => { b.disabled = false; if (b.id !== "pf-ok") b.textContent = C.checkout.button || "Place order"; }); toast(esc(msg)); stockLoad(); return false; }
      o.saved = r.ok; if (r.ok && o.rz) o.paid = true; } catch (e) { o.saved = false; }
  }
  store.set("orders", [o, ...store.get("orders", [])].slice(0, 10));
  cart = []; saveCart();
  history.pushState(null, "", `checkout.html?order=${encodeURIComponent(o.id)}`);
  render(); scrollTo(0, 0);
}
/** Paying through a gateway the shop's database holds the keys for: the database works out the amount and starts the payment. */
async function payGateway(o, lines, err, btn) {
  const g = GWID[o.method], say = (t) => { err.textContent = t; if (btn) { btn.disabled = false; btn.textContent = C.checkout.button || "Place order"; } };
  if (btn) { btn.disabled = true; btn.textContent = "Opening payment…"; } err.textContent = "";
  try {
    const r = await fetch(HOST.api + "/pay/" + g + "/" + encodeURIComponent(HOST.site), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ back: location.origin + location.pathname, order_no: o.id, total: o.t.total, pin: o.c.pin, name: o.c.name, email: o.c.email, phone: o.c.phone, items: lines.map((l) => ({ id: l.p.id, qty: l.qty, opt: l.opt || "" })), points: o.t.pts || 0, otp: o.otp || "", acct: o.ac || "" }) });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j || !(j.order_id || j.go || j.session)) return say((j && j.error) || "Online payment couldn't start. Please try again, or choose another way to pay.");
    if (g === "rz") {
      await loadScript(RZP_JS);
      new window.Razorpay({ key: j.key, order_id: j.order_id, amount: j.amount, currency: j.currency, name: j.name || C.brand.name, description: "Order " + o.id, prefill: { name: o.c.name, email: o.c.email || undefined, contact: o.c.phone || undefined }, notes: { order_no: o.id }, theme: { color: C.theme.accent },
        handler: (resp) => { o.rz = resp; placeOrder(o); }, modal: { ondismiss: () => say("The payment wasn't completed, so the order isn't placed yet. You can try again.") } }).open();
      return;
    }
    // The order waits on this device while the customer pays on the gateway's page; it is placed when they come back paid.
    store.set("pend", { o, ref: j.ref, at: Date.now() });
    if (g === "cf") { await loadScript("https://sdk.cashfree.com/js/v3/cashfree.js"); window.Cashfree({ mode: j.mode }).checkout({ paymentSessionId: j.session, redirectTarget: "_self" }); }
    else location.href = j.go;
  } catch (e) { say("Online payment couldn't open. Check your connection and try again, or choose another way to pay."); }
}
/** Back from a gateway's page: the waiting order is sent with the payment's reference, and the database asks the gateway whether it was paid. */
function cameBack() {
  if (cameBack.done) return false; cameBack.done = true;
  let q; try { q = new URLSearchParams(location.search); } catch (e) { return false; }
  const gw = q.get("paid"), no = q.get("o"), pend = store.get("pend", null); if (!gw || !no) return false;
  history.replaceState(null, "", "checkout.html");
  if (!pend || !pend.o || pend.o.id !== no || GWID[pend.o.method] !== gw) return false;
  const o = pend.o, tell = (t) => { render(); const e = $("#co-err"); if (e) { e.textContent = t; e.scrollIntoView({ block: "center" }); } };
  if (q.get("x")) { store.set("pend", null); tell("The payment wasn't completed, so the order isn't placed yet. You can try again."); return true; }
  tell("Confirming your payment…");
  o.pg = { gw, ref: pend.ref };
  sendOrder(o).then(async (r) => {
    const j = await r.json().catch(() => null);
    if (r.status === 502) return tell((j && j.error) || "We couldn't confirm the payment just now. Reload this page in a moment; your order is kept.");
    store.set("pend", null);
    if (!r.ok) return tell((j && j.error) || "The payment wasn't completed, so the order isn't placed yet. You can try again.");
    o.saved = true; o.paid = true; placeOrder(o);
  }).catch(() => tell("We couldn't confirm the payment just now. Check your connection and reload this page; your order is kept."));
  return true;
}
/** The UPI step before an order is placed: QR code and app button with the exact amount, then the payment's reference number. */
function payFirst(o, then) {
  const old = $("#payfirst"); if (old) old.remove();
  const d = document.createElement("div"); d.id = "payfirst"; d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true"); d.setAttribute("aria-label", "Pay to place your order");
  d.style.cssText = "position:fixed;inset:0;z-index:300;background:rgba(10,10,12,.6);display:grid;place-items:center;padding:16px;overflow:auto";
  d.innerHTML = `<div style="background:var(--bg);color:var(--text);border-radius:calc(var(--r) + 6px);padding:24px;width:min(440px,100%);display:grid;gap:12px;text-align:center;box-shadow:0 30px 80px -20px rgba(0,0,0,.6)">
      <h2 style="font-size:22px;margin:0">Pay to place your order</h2><p class="soft" style="margin:0">Order <b>${esc(o.id)}</b></p><p style="margin:0;font-size:32px;font-weight:800">${esc(money(o.t.total))}</p>
      <p style="margin:0;text-align:left"><b>1.</b> Pay by scanning this code in any UPI app, or with the button under it.</p>
      <div class="qr" id="pf-qr" aria-label="UPI QR code" style="justify-self:center"></div><div class="copyrow" style="justify-content:center"><code>${esc(C.payments.upi.vpa)}</code><button type="button" data-copy="${esc(C.payments.upi.vpa)}">Copy UPI ID</button></div>
      <a class="btn" href="${esc(upiLink(o))}">Open UPI app</a>
      <p style="margin:0;text-align:left"><b>2.</b> Enter the reference number your UPI app shows after paying (UTR or UPI transaction ID, 12 digits).</p>
      <div class="f" style="text-align:left"><label for="pf-utr">UPI reference number</label><input class="in" id="pf-utr" inputmode="numeric" autocomplete="off" maxlength="22" placeholder="12-digit number"><span class="err" id="pf-e" role="alert"></span></div>
      <button class="btn pri" type="button" id="pf-ok">I've paid: place the order</button><button class="link" type="button" id="pf-x">Back to checkout</button>
      <p class="note" style="margin:0">Your order is placed only after this step. You pay in your own UPI app; this page takes no card or bank details.</p></div>`;
  document.body.appendChild(d);
  const qr = $("#pf-qr", d); if (window.QRCode) { try { new window.QRCode(qr, { text: upiLink(o), width: 200, height: 200, correctLevel: window.QRCode.CorrectLevel.M }); } catch (e) { qr.outerHTML = `<p class="note">The QR code couldn't load. Use the UPI ID instead.</p>`; } } else qr.outerHTML = `<p class="note">The QR code couldn't load. Use the UPI ID or the button.</p>`;
  const cp = $("[data-copy]", d); if (cp) cp.onclick = () => copy(cp.dataset.copy, "UPI ID copied");
  $("#pf-x", d).onclick = () => d.remove();
  $("#pf-ok", d).onclick = () => {
    const v = $("#pf-utr", d).value.replace(/[\s-]/g, "");
    if (!/^[A-Za-z0-9]{12,22}$/.test(v)) { $("#pf-e", d).textContent = "Enter the 12-digit reference number from your UPI app (shown on the receipt as UTR or UPI transaction ID)."; $("#pf-utr", d).focus(); return; }
    o.utr = v; o.methodLabel = (o.methodLabel || "UPI") + ", reference " + v; d.remove(); then();
  };
  $("#pf-utr", d).focus();
}
addEventListener("popstate", render);

/* ============================================================
   BOOT
   ============================================================ */
if (PAGE === "checkout") { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"; s.onload = () => { if ($(".done")) bindCheckout(); }; document.head.appendChild(s); }
const SCO = { css: 'link[href*="assets/store.css"]', js: "assets/store.js" }; let DREW = false, HAND = false;
if (PREVIEW) {
  addEventListener("message", (e) => {
    if (e.origin !== location.origin || e.source !== window.parent) return;
    const d = e.data || {};
    if (d.type === "cms:content" && d.content && typeof d.content === "object") { if (SC && SC.take(d.content, { ...SCO, drawn: DREW })) return; DREW = true; ASSETS = d.assets || {}; const y = scrollY; C = merge(DEFAULT, d.content); render(); scrollTo(0, y); }
  });
  window.parent.postMessage({ type: "cms:ready", page: (location.pathname.split("/").pop() || "index.html") + (PAGE === "page" && spCur() ? "?p=" + encodeURIComponent(spCur()) : MNT_Q ? "?maintenance=1" : PV ? "?preview=" + PV : "") }, location.origin);
}
// The live site never shows the template's sample design: it waits for content.json (a returning visitor
// gets the copy saved on the previous page at once), and only falls back to the defaults if loading fails.
const CKEY = "site-content:" + location.pathname.replace(/[^/]*$/, "");
if (PREVIEW) { if (!(SC && SC.wait())) { DREW = true; render(); } }
else {
  let shown = "";
  try { const c = sessionStorage.getItem(CKEY); if (c) { const j = JSON.parse(c); if (SC && SC.take(j, SCO)) HAND = true; else { C = merge(DEFAULT, j); render(); shown = c; } } } catch (e) {}
  // A first visit: the page's outline shows while the content is fetched (the first render replaces it).
  if (!shown && !HAND && window.SiteSkeleton) window.SiteSkeleton.show($("#app"));
  const giveUp = setTimeout(() => { if (!shown && !HAND) { render(); shown = "default"; } }, 6000);
  const fromFile = () => fetch("content.json", { cache: "no-store" }).then((r) => (r.ok ? r.text() : null));
  // Hosted on the Studio's Cloudflare database: content is a public file there.
  const fromCf = () => fetch(HOST.api + "/p/" + encodeURIComponent(HOST.site) + "/content.json", { cache: "no-store" }).then((r) => (r.ok ? r.text() : null)).catch(() => null).then((t) => t || fromFile());
  const fromDb = () => HOST.api ? fromCf() : fetch(HOST.db + "/rest/v1/site_content?select=content&site=eq." + encodeURIComponent(HOST.site), { cache: "no-store", headers: { apikey: HOST.key, ...(/^sb_/.test(HOST.key) ? {} : { Authorization: "Bearer " + HOST.key }) } })
    .then((r) => (r.ok ? r.json() : null)).then((j) => (j && j[0] && j[0].content ? JSON.stringify(j[0].content) : null)).catch(() => null).then((t) => t || fromFile());
  if (!HAND) (HOST ? fromDb() : fromFile()).then((txt) => {
    clearTimeout(giveUp);
    if (!txt) { if (!shown) render(); return; }
    try { sessionStorage.setItem(CKEY, txt); } catch (e) {}
    if (txt === shown) return;
    const j = JSON.parse(txt); if (SC && SC.take(j, { ...SCO, drawn: !!shown, text: txt })) return;
    C = merge(DEFAULT, j); render();
  }).catch(() => { clearTimeout(giveUp); if (!shown) render(); })
    // what is left of each counted product, once the content is in (a placed order's page has nothing to redraw)
    .then(() => { if (revOn() && PAGE !== "product") revLoad().then(revFill); })
    .then(() => { if (stockOn()) stockLoad().then(() => { if (STOCK && !$(".done") && !$("#trackf") && !(document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName))) render(); }); });
}
if (SC) SC.untrack();
})();

// Menu when scrolling (theme.navMode): "" theme default, fixed, hide (hide on scroll down, show on scroll up), scroll (scrolls away)
(function(){let lastY=scrollY;const de=document.documentElement,SEL=".nav,.hdr,.vx-hdr,.ks-top,.kk-top,.kg-top,.kv-top,.kp-top";
  addEventListener("scroll",()=>{const y=scrollY,d=y-lastY;
    if(((matchMedia("(max-width:760px)").matches&&de.dataset.menumob)||de.dataset.menu)!=="hide"||de.classList.contains("vx-menu-open")||document.querySelector(".hdr [aria-expanded=true],.nav [aria-expanded=true]")){de.classList.remove("menu-away");lastY=y;return}
    if(Math.abs(d)<6)return;de.classList.toggle("menu-away",d>0&&y>140);lastY=y},{passive:true});
  document.addEventListener("focusin",e=>{if(e.target.closest&&e.target.closest(SEL))de.classList.remove("menu-away")});
})();
