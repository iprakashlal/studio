/* Shop template runtime. Renders every page from content.json.
   No server: the cart lives in the shopper's browser, and orders are sent to the
   seller as a pre-filled WhatsApp message or email. */
(() => {
"use strict";

/* ============================================================
   DEFAULT CONTENT (also exported as content.json)
   ============================================================ */
const DEFAULT = {
  theme: { bg: "#FAF7F2", surface: "#FFFFFF", text: "#1B1A17", soft: "#6B665D", line: "#E7E1D6", accent: "#1F4D3A", accent2: "#E9B949", sale: "#B4441B", fontDisplay: "Fraunces", fontBody: "Manrope", radius: 14 },
  brand: { name: "Fieldnote Goods", tagline: "Small-batch goods for slow mornings", logo: null, announcement: "Free shipping on orders over ₹1,999", showAnnouncement: true },
  seo: { title: "Fieldnote Goods", description: "Small-batch ceramics, linen and paper goods." },
  nav: { home: "Home", shop: "Shop", portfolio: "Our story", cart: "Cart", account: "Account", showPortfolio: true },
  home: {
    hero: { eyebrow: "New collection", title: "Objects for slow mornings", text: "Hand-made ceramics, linen and paper goods, made in small batches and shipped with care.", cta: "Shop the collection", image: null },
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
  backend: { enabled: false, provider: "supabase", workerUrl: "", supabaseUrl: "", anonKey: "", accounts: true, wishlist: true, requireLogin: false },
  accountPage: { title: "Your account", signInText: "Enter your email and we'll send you a 6-digit code. No password needed." },
};

const FONTS = { "Fraunces": "Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700", "Bricolage Grotesque": "Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800", "DM Serif Display": "DM+Serif+Display", "Syne": "Syne:wght@500;700;800", "Sora": "Sora:wght@500;700;800", "Unbounded": "Unbounded:wght@500;700",
  "Manrope": "Manrope:wght@400;500;600;700;800", "Instrument Sans": "Instrument+Sans:wght@400;500;600;700", "IBM Plex Sans": "IBM+Plex+Sans:wght@400;500;600;700", "DM Sans": "DM+Sans:wght@400;500;700", "Work Sans": "Work+Sans:wght@400;500;600;700" };

/* ============================================================
   UTILITIES
   ============================================================ */
const $ = (s, c = document) => c.querySelector(s), $$ = (s, c = document) => [...c.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
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
const imgUrl = (img) => (!img ? "" : img.path ? ASSETS[img.path] || img.path : img.url || "");
const basePath = location.pathname.replace(/[^/]*$/, "");
let C = merge(DEFAULT, {});
const PAGE = document.body.dataset.page || "home";
const PREVIEW = window.name === "cms-preview" && window.parent !== window;

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
   BACKEND (optional): Supabase, or a Cloudflare Worker that keeps
   orders as files in a private GitHub repo. Same routes either way.
   ============================================================ */
const SUPA_JS = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js";
const RZP_JS = "https://checkout.razorpay.com/v1/checkout.js";
const scripts = {};
function loadScript(src) {
  return (scripts[src] ||= new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => { delete scripts[src]; rej(new Error("load")); }; document.head.appendChild(s); }));
}
const CF = () => !!(C.backend && C.backend.provider === "cloudflare");
const httpsUrl = (u) => /^https:\/\/[^\s]+$/.test(u || "");
const BE = () => !!(C.backend && C.backend.enabled && (CF() ? httpsUrl(C.backend.workerUrl) : httpsUrl(C.backend.supabaseUrl) && C.backend.anonKey));
const ACCOUNTS = () => BE() && !!C.backend.accounts;
const sbUrl = () => String(C.backend.supabaseUrl).replace(/\/+$/, "");
const fnBase = () => (CF() ? String(C.backend.workerUrl).replace(/\/+$/, "") : `${sbUrl()}/functions/v1/shop`);
let SB = null, USER = null, PROFILE = null, WISH = null, sbReady = null;
// Cloudflare: a signed session token from the Worker, kept on this device.
const cfKey = () => "shop-cf:" + basePath;
let CFT = null, CF_CH = null, cfMe = null;
const cfGet = () => { try { return localStorage.getItem(cfKey()); } catch (e) { return null; } };
const cfSet = (t) => { CFT = t; try { t ? localStorage.setItem(cfKey(), t) : localStorage.removeItem(cfKey()); } catch (e) {} };
function cfApply(r) { USER = r.user ? { id: r.user.id, email: r.user.email } : null; PROFILE = r.profile || null; WISH = new Set(r.wishlist || []); }
function cfLoadMe() {
  if (!CFT) { USER = PROFILE = WISH = null; return Promise.resolve(null); }
  return (cfMe ||= fn("me", {}).then((r) => { cfApply(r); return r; }, (e) => { cfMe = null; if (/sign in/i.test(e.message)) { cfSet(null); USER = PROFILE = WISH = null; return null; } throw e; }));
}
function sbInit() {
  if (!BE() || PREVIEW) return Promise.resolve(null);
  return (sbReady ||= (async () => {
    if (CF()) { CFT = cfGet(); await cfLoadMe(); return true; }
    await loadScript(SUPA_JS);
    SB = window.supabase.createClient(sbUrl(), C.backend.anonKey, { auth: { persistSession: true, storageKey: "shop-auth:" + basePath, detectSessionInUrl: false } });
    const { data } = await SB.auth.getSession();
    USER = data.session ? data.session.user : null;
    return SB;
  })().catch((e) => { sbReady = null; throw e; }));
}
async function bearer() { if (CF()) return CFT; if (!SB) return null; const { data } = await SB.auth.getSession(); return data.session ? data.session.access_token : null; }
async function fn(route, body) {
  const t = await bearer();
  let r;
  const headers = CF() ? { "Content-Type": "application/json", ...(t ? { Authorization: "Bearer " + t } : {}) } : { "Content-Type": "application/json", apikey: C.backend.anonKey, Authorization: "Bearer " + (t || C.backend.anonKey) };
  try { r = await fetch(`${fnBase()}/${route}`, { method: "POST", headers, body: JSON.stringify(body) }); }
  catch (e) { throw new Error("Couldn't reach the shop. Check your connection and try again."); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Something went wrong. Please try again.");
  return j;
}
async function loadProfile() { if (CF()) { await cfLoadMe(); return PROFILE; } if (!SB || !USER) return (PROFILE = null); const { data } = await SB.from("profiles").select("*").eq("id", USER.id).maybeSingle(); return (PROFILE = data || null); }
async function loadWish() { if (CF()) { await cfLoadMe(); return WISH; } if (!SB || !USER) return (WISH = null); const { data } = await SB.from("wishlists").select("product_id"); return (WISH = new Set((data || []).map((r) => r.product_id))); }
/** Account actions, one implementation per backend. Each throws an Error with a message for the shopper. */
const api = {
  async sendCode(email) {
    if (CF()) { CF_CH = (await fn("auth-send", { email })).challenge; return; }
    const { error } = await SB.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (error) throw new Error(/rate|seconds/i.test(error.message) ? "Please wait a minute before asking for another code." : "We couldn't send a code. Check the email and try again.");
  },
  async verify(email, code) {
    if (CF()) { const r = await fn("auth-verify", { challenge: CF_CH, code }); cfSet(r.token); cfMe = Promise.resolve(r); cfApply(r); return; }
    const { data, error } = await SB.auth.verifyOtp({ email, token: code, type: "email" });
    if (error || !data.user) throw new Error("That code is wrong or has expired. Try again or ask for a new one.");
    USER = data.user;
  },
  async signOut() { if (CF()) { cfSet(null); cfMe = null; } else await SB.auth.signOut(); USER = null; PROFILE = null; WISH = null; },
  async wish(pid, on) {
    if (CF()) { WISH = new Set((await fn("wishlist", { action: on ? "add" : "remove", product_id: pid })).wishlist); return; }
    const { error } = on ? await SB.from("wishlists").insert({ user_id: USER.id, product_id: pid }) : await SB.from("wishlists").delete().eq("user_id", USER.id).eq("product_id", pid);
    if (error) throw new Error("Couldn't update your wishlist. Try again.");
    if (on) WISH.add(pid); else WISH.delete(pid);
  },
  async myOrders() {
    if (CF()) return (await fn("my-orders", {})).orders;
    const { data, error } = await SB.from("orders").select("order_no,created_at,status,payment_status,method,totals,items").order("created_at", { ascending: false });
    if (error) throw new Error("Your orders couldn't load. Try again.");
    return data || [];
  },
  async saveProfile(patch) {
    if (CF()) { PROFILE = (await fn("profile-update", patch)).profile; return; }
    const { error } = await SB.from("profiles").update(patch).eq("id", USER.id);
    if (error) throw new Error("Couldn't save your details. Try again.");
    PROFILE = { ...PROFILE, ...patch };
  },
};
const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());
function updateLocalOrder(id, patch) { store.set("orders", store.get("orders", []).map((o) => (o.id === id ? { ...o, ...patch } : o))); }

/* ============================================================
   CATALOGUE + CART
   ============================================================ */
const slugOf = (p) => p.slug || slugify(p.name) || p.id;
const catOf = (id) => C.categories.find((c) => c.id === id);
const prodBy = (id) => C.products.find((p) => p.id === id);
const productUrl = (p) => `product.html?p=${encodeURIComponent(slugOf(p))}`;
const onSale = (p) => Number(p.compareAt) > Number(p.price);

function ph(seed, cls = "") {
  let h = 0; for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const cols = [C.theme.accent, C.theme.accent2, C.theme.sale];
  return `<div class="ph ${cls}" style="--c:${cols[h % 3]}" aria-hidden="true"><i class="a" style="left:${8 + (h % 20)}%;top:${10 + (h % 14)}%"></i><i class="b"></i><i class="c"></i><b>${esc(String(seed).trim()[0] || "")}</b></div>`;
}
const pimg = (p, i = 0) => (p.images && p.images[i] ? `<img src="${esc(imgUrl(p.images[i]))}" alt="${esc(p.name)}" loading="lazy">` : ph(p.name));

let cart = store.get("cart", []);
const saveCart = () => { store.set("cart", cart); $$("[data-cartcount]").forEach((el) => { el.textContent = cartCount(); }); };
const cartCount = () => cart.reduce((n, l) => n + l.qty, 0);
function cartLines() { return cart.map((l) => ({ ...l, p: prodBy(l.id) })).filter((l) => l.p && l.p.stock !== "out"); }
function addToCart(id, opt, qty) {
  const max = Math.max(1, Number(C.settings.maxQty) || 10);
  const ex = cart.find((l) => l.id === id && l.opt === opt);
  if (ex) ex.qty = Math.min(max, ex.qty + qty); else cart.push({ id, opt, qty: Math.min(max, qty) });
  saveCart();
}
function totals(lines = cartLines()) {
  const S = C.settings, sub = lines.reduce((s, l) => s + Number(l.p.price) * l.qty, 0);
  const free = Number(S.freeShippingOver) > 0 && sub >= Number(S.freeShippingOver);
  const ship = !lines.length || free ? 0 : Number(S.shippingFee) || 0;
  const pct = Number(S.taxPercent) || 0;
  const taxAdd = pct && !S.taxIncluded ? Math.round(sub * pct) / 100 : 0;
  const taxIn = pct && S.taxIncluded ? Math.round((sub - sub / (1 + pct / 100)) * 100) / 100 : 0;
  const total = Math.round((sub + ship + taxAdd) * 100) / 100;
  const left = Number(S.freeShippingOver) > 0 && !free ? Number(S.freeShippingOver) - sub : 0;
  return { sub, ship, taxAdd, taxIn, total, left, free };
}
function methods() {
  const P = C.payments, out = [];
  if (P.upi.enabled && vpaOk(P.upi.vpa) && C.settings.currency === "INR") out.push({ id: "upi", label: P.upi.label, desc: "Scan a QR code or open your UPI app. The amount is filled in." });
  if (P.razorpay.enabled && (BE() || httpsOk(P.razorpay.link))) out.push({ id: "razorpay", label: P.razorpay.label, desc: BE() ? "Card, UPI, netbanking or wallet, in Razorpay's secure window." : "Pay on Razorpay's secure page." });
  if (P.stripe.enabled && (BE() || httpsOk(P.stripe.link))) out.push({ id: "stripe", label: P.stripe.label, desc: "Pay on Stripe's secure page." });
  if (P.paypal.enabled && ppOk(P.paypal.username)) out.push({ id: "paypal", label: P.paypal.label, desc: "Pay on PayPal with the amount filled in." });
  if (P.cod.enabled) out.push({ id: "cod", label: P.cod.label, desc: P.cod.note });
  return out;
}

/* ============================================================
   LAYOUT
   ============================================================ */
function applyTheme(t) {
  const r = document.documentElement.style;
  ["bg", "surface", "text", "soft", "line", "accent", "accent2", "sale"].forEach((k) => r.setProperty("--" + k, t[k]));
  r.setProperty("--on-accent", onColor(t.accent)); r.setProperty("--on-accent2", onColor(t.accent2));
  r.setProperty("--r", (+t.radius || 0) + "px");
  r.setProperty("--fd", `"${t.fontDisplay}",Georgia,serif`); r.setProperty("--fb", `"${t.fontBody}","Helvetica Neue",Arial,sans-serif`);
  const href = "https://fonts.googleapis.com/css2?" + [FONTS[t.fontDisplay], FONTS[t.fontBody], "JetBrains+Mono:wght@400;500"].filter(Boolean).map((f) => "family=" + f).join("&") + "&display=swap";
  let l = $("#fontlink"); if (!l) { l = document.createElement("link"); l.id = "fontlink"; l.rel = "stylesheet"; document.head.appendChild(l); }
  if (l.getAttribute("href") !== href) l.setAttribute("href", href);
}
function header() {
  const B = C.brand, N = C.nav;
  const initials = B.name.split(/\s+/).map((w) => w[0] || "").join("").slice(0, 2).toUpperCase();
  const cur = (p) => (PAGE === p ? ' aria-current="page"' : "");
  return `${B.showAnnouncement && B.announcement ? `<div class="announce">${esc(B.announcement)}</div>` : ""}
  <header class="hdr"><div class="wrap" style="position:relative">
    <a class="brand" href="index.html"><span class="mark">${B.logo ? `<img src="${esc(imgUrl(B.logo))}" alt="">` : esc(initials)}</span><b>${esc(B.name)}</b></a>
    <nav class="nav" id="nav" aria-label="Main"><a href="index.html"${cur("home")}>${esc(N.home)}</a><a href="shop.html"${cur("shop")}>${esc(N.shop)}</a>${N.showPortfolio ? `<a href="portfolio.html"${cur("portfolio")}>${esc(N.portfolio)}</a>` : ""}${ACCOUNTS() ? `<a href="account.html"${cur("account")}>${esc(N.account)}</a>` : ""}</nav>
    <a class="cartlink" href="cart.html"${cur("cart")}><span class="t">${esc(N.cart)}</span><span class="n" data-cartcount>${cartCount()}</span></a>
    <button class="menubtn" type="button" aria-controls="nav" aria-expanded="false" aria-label="Menu">☰</button>
  </div></header>`;
}
function footer() {
  const K = C.contact, ms = methods();
  return `<footer class="ftr"><div class="wrap"><div class="cols">
    <div class="about"><b style="font-family:var(--fd);font-size:22px">${esc(C.brand.name)}</b><p>${esc(C.footer.text || C.brand.tagline)}</p>${ms.length ? `<div class="pm">${ms.map((m) => `<span>${esc(m.label)}</span>`).join("")}</div>` : ""}</div>
    <div><h4>${esc(C.nav.shop)}</h4><ul><li><a href="shop.html">All products</a></li>${C.categories.map((c) => `<li><a href="shop.html?c=${encodeURIComponent(c.id)}">${esc(c.name)}</a></li>`).join("")}</ul></div>
    <div><h4>Help</h4><ul>${C.policies.map((p) => `<li><a href="policies.html#${esc(p.id || slugify(p.title))}">${esc(p.title)}</a></li>`).join("")}${C.nav.showPortfolio ? `<li><a href="portfolio.html">${esc(C.nav.portfolio)}</a></li>` : ""}</ul></div>
    <div><h4>Contact</h4><ul>${K.email ? `<li><a href="mailto:${esc(K.email)}">${esc(K.email)}</a></li>` : ""}${K.phone ? `<li><a href="tel:${esc(digits(K.phone))}">${esc(K.phone)}</a></li>` : ""}${K.whatsapp ? `<li><a href="https://wa.me/${digits(K.whatsapp)}" target="_blank" rel="noopener">WhatsApp</a></li>` : ""}${safeUrl(K.instagram) ? `<li><a href="${esc(safeUrl(K.instagram))}" target="_blank" rel="noopener">Instagram</a></li>` : ""}${K.address ? `<li class="soft" style="white-space:pre-line">${esc(K.address)}</li>` : ""}</ul></div>
  </div><div class="base"><span>© ${new Date().getFullYear()} ${esc(C.brand.name)}</span><span>Prices in ${esc(C.settings.currency)}</span></div></div></footer>`;
}
function pcard(p) {
  const badge = p.stock === "out" ? `<span class="badge out">Sold out</span>` : onSale(p) ? `<span class="badge sale">Sale</span>` : p.badge ? `<span class="badge">${esc(p.badge)}</span>` : "";
  return `<a class="pcard" href="${productUrl(p)}"><div class="im">${badge}${pimg(p)}</div><div><h3>${esc(p.name)}</h3>${p.short ? `<p class="s">${esc(p.short)}</p>` : ""}</div><div class="price">${esc(money(p.price))}${onSale(p) ? `<s>${esc(money(p.compareAt))}</s>` : ""}</div></a>`;
}

/* ============================================================
   PAGES
   ============================================================ */
const PAGES = {
  home() {
    const H = C.home, feat = C.products.filter((p) => p.featured).slice(0, 8), list = feat.length ? feat : C.products.slice(0, 4);
    const col = C.products.slice(0, 3);
    return `<section class="hero"><div class="wrap"><div><p class="eyebrow">${esc(H.hero.eyebrow)}</p><h1>${esc(H.hero.title)}</h1><p class="lead">${esc(H.hero.text)}</p>
      <div class="cta"><a class="btn pri" href="shop.html">${esc(H.hero.cta)} →</a>${C.nav.showPortfolio ? `<a class="btn" href="portfolio.html">${esc(C.nav.portfolio)}</a>` : ""}</div></div>
      <div class="art">${H.hero.image ? `<img src="${esc(imgUrl(H.hero.image))}" alt="">` : `<div class="collage">${(col.length ? col : [{ name: "A" }, { name: "B" }, { name: "C" }]).map((p) => `<div style="border-radius:calc(var(--r)*1.1);overflow:hidden">${p.images && p.images[0] ? pimg(p) : ph(p.name)}</div>`).join("")}</div>`}</div></div></section>
    ${list.length ? `<section class="sec" style="padding-top:12px"><div class="wrap"><div class="sec-h"><div><h2>${esc(H.featuredTitle)}</h2>${H.featuredText ? `<p class="soft" style="margin-top:8px">${esc(H.featuredText)}</p>` : ""}</div><a class="link" href="shop.html">View all</a></div><div class="grid">${list.map(pcard).join("")}</div></div></section>` : ""}
    ${H.showCategories && C.categories.length ? `<section class="sec" style="padding-top:0"><div class="wrap"><div class="sec-h"><h2>${esc(H.categoriesTitle)}</h2></div><div class="cats">${C.categories.map((c) => `<a class="cat" href="shop.html?c=${encodeURIComponent(c.id)}">${c.image ? `<img src="${esc(imgUrl(c.image))}" alt="">` : ph(c.name)}<span>${esc(c.name)}<small>${C.products.filter((p) => p.category === c.id).length} products</small></span></a>`).join("")}</div></div></section>` : ""}
    ${H.banner.show ? `<section class="sec" style="padding-top:0"><div class="wrap"><div class="banner"><div class="tx"><h2>${esc(H.banner.title)}</h2><p>${esc(H.banner.text)}</p>${C.nav.showPortfolio && H.banner.cta ? `<a class="btn" href="portfolio.html">${esc(H.banner.cta)} →</a>` : ""}</div><div class="im">${H.banner.image ? `<img src="${esc(imgUrl(H.banner.image))}" alt="">` : ph(H.banner.title)}</div></div></div></section>` : ""}
    ${H.testimonials.length ? `<section class="sec" style="padding-top:0"><div class="wrap"><div class="sec-h"><h2>${esc(H.testimonialsTitle)}</h2></div><div class="quotes">${H.testimonials.map((t) => `<figure class="quote" style="margin:0"><p>“${esc(t.quote)}”</p><span><b>${esc(t.name)}</b>${t.role ? ` · ${esc(t.role)}` : ""}</span></figure>`).join("")}</div></div></section>` : ""}`;
  },
  shop() {
    const S = C.shop, q = new URLSearchParams(location.search);
    return `<section class="page-h"><div class="wrap"><p class="eyebrow">${esc(C.brand.name)}</p><h1>${esc(S.title)}</h1>${S.intro ? `<p>${esc(S.intro)}</p>` : ""}</div></section>
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
    document.title = `${p.name} · ${C.brand.name}`;
    return `<div class="wrap"><nav class="crumbs" aria-label="Breadcrumb"><a href="shop.html">${esc(C.nav.shop)}</a>${cat ? `<span>/</span><a href="shop.html?c=${encodeURIComponent(cat.id)}">${esc(cat.name)}</a>` : ""}<span>/</span><span>${esc(p.name)}</span></nav>
    <div class="pd" data-pid="${esc(p.id)}"><div class="gal"><div class="main" id="mainimg">${imgs[0] ? `<img src="${esc(imgUrl(imgs[0]))}" alt="${esc(p.name)}">` : ph(p.name)}</div>
      ${imgs.length > 1 ? `<div class="thumbs">${imgs.map((im, i) => `<button type="button" data-i="${i}" aria-pressed="${i === 0}" aria-label="Photo ${i + 1}"><img src="${esc(imgUrl(im))}" alt=""></button>`).join("")}</div>` : ""}</div>
    <div class="info">${p.badge ? `<p class="eyebrow">${esc(p.badge)}</p>` : ""}<h1>${esc(p.name)}</h1>
      <div class="price">${esc(money(p.price))}${onSale(p) ? `<s>${esc(money(p.compareAt))}</s><span class="off">${Math.round((1 - p.price / p.compareAt) * 100)}% off</span>` : ""}</div>
      <p class="stock ${p.stock}">${p.stock === "out" ? "Sold out" : p.stock === "low" ? "Only a few left" : "In stock"}</p>
      ${p.short ? `<p style="font-size:17px">${esc(p.short)}</p>` : ""}
      ${p.options && p.options.length ? `<div class="opt"><span class="lbl" id="optl">${esc(p.optionName || "Option")}</span><div class="optbtns" role="group" aria-labelledby="optl">${p.options.map((o, i) => `<button type="button" data-o="${esc(o)}" aria-pressed="${i === 0}">${esc(o)}</button>`).join("")}</div></div>` : ""}
      ${p.stock !== "out" ? `<div class="opt"><span class="lbl">Quantity</span><div class="buy"><div class="qty"><button type="button" data-q="-1" aria-label="Fewer">−</button><output id="qty" aria-live="polite">1</output><button type="button" data-q="1" aria-label="More">+</button></div>
        <button class="btn pri" type="button" id="add">Add to cart</button><button class="btn" type="button" id="buynow">Buy now</button></div></div>` : `<a class="btn" href="shop.html">See other products</a>`}
      ${ACCOUNTS() && C.backend.wishlist ? `<button class="btn wish" type="button" id="wish" aria-pressed="false">♡ Save to wishlist</button>` : ""}
      ${p.features && p.features.length ? `<ul class="feat">${p.features.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>` : ""}
      ${p.description ? `<div class="desc">${paras(p.description)}</div>` : ""}
      ${Number(C.settings.freeShippingOver) > 0 ? `<p class="soft" style="font-size:14px">Free shipping on orders over ${esc(money(C.settings.freeShippingOver))}.</p>` : ""}
    </div></div>
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
    <aside class="sum"><h2>Summary</h2>${summaryRows(t)}
      ${t.left > 0 ? `<p class="note">Add <b>${esc(money(t.left))}</b> more for free shipping.</p>` : ""}
      ${below ? `<p class="note">The minimum order is <b>${esc(money(S.minOrder))}</b>.</p>` : ""}
      <a class="btn pri block" href="checkout.html"${below ? ' aria-disabled="true" style="pointer-events:none;opacity:.45"' : ""}>Checkout</a><a class="link" style="text-align:center" href="shop.html">Continue shopping</a></aside></div>`;
  },
  checkout() {
    const lines = cartLines(), q = new URLSearchParams(location.search).get("order");
    if (q) {
      const o = store.get("orders", []).find((x) => x.id === q);
      if (o) return orderDone(o);
      const k = new URLSearchParams(location.search).get("k");
      if (k && BE()) return `<div class="wrap"><div class="done" id="remote" data-k="${esc(k)}" data-o="${esc(q)}"><p class="soft">Loading your order…</p></div></div>`;
    }
    if (!lines.length) return `<section class="page-h"><div class="wrap"><h1>${esc(C.checkout.title)}</h1></div></section><div class="wrap" style="padding-bottom:80px"><div class="empty"><p>Your cart is empty.</p><a class="btn pri" href="shop.html">Start shopping</a></div></div>`;
    const K = C.checkout, ms = methods(), t = totals(lines);
    if (ACCOUNTS() && C.backend.requireLogin && !USER && !PREVIEW) return `<section class="page-h"><div class="wrap"><h1>${esc(K.title)}</h1></div></section><div class="wrap" style="padding-bottom:80px"><div class="box" style="max-width:520px"><h2>Sign in to check out</h2><p class="soft">We'll send a 6-digit code to your email. Your orders then appear in your account.</p><a class="btn pri" href="account.html?next=checkout.html">Sign in</a></div></div>`;
    const me = { ...store.get("me", {}), ...(PROFILE ? { name: PROFILE.name || "", phone: PROFILE.phone || "", ...(PROFILE.address || {}) } : {}), ...(USER ? { email: USER.email } : {}) };
    const fld = (id, label, type = "text", req = true, full = false, ac = "") => `<div class="f${full ? " full" : ""}"><label for="${id}">${esc(label)}${req ? "" : ' <span class="soft">(optional)</span>'}</label><input class="in" id="${id}" name="${id}" type="${type}"${req ? " required" : ""}${ac ? ` autocomplete="${ac}"` : ""}${id === "email" && USER ? " readonly" : ""} value="${esc(me[id] || "")}"><span class="err" id="${id}-e"></span></div>`;
    return `<section class="page-h"><div class="wrap"><h1>${esc(K.title)}</h1>${K.intro ? `<p>${esc(K.intro)}</p>` : ""}</div></section>
    <form class="wrap two" id="co" novalidate><div class="form">
      <div class="box"><h2>Your details</h2><div class="fgrid">${fld("name", "Full name", "text", true, false, "name")}${fld("email", "Email", "email", true, false, "email")}${K.askPhone ? fld("phone", "Phone", "tel", true, false, "tel") : ""}</div></div>
      ${K.askAddress ? `<div class="box"><h2>Delivery address</h2><div class="fgrid">${fld("address", "Address", "text", true, true, "street-address")}${fld("city", "City", "text", true, false, "address-level2")}${fld("pin", "PIN / postcode", "text", true, false, "postal-code")}${fld("state", "State", "text", true, false, "address-level1")}</div></div>` : ""}
      ${K.askNotes ? `<div class="box"><div class="f"><label for="notes">Notes <span class="soft">(optional)</span></label><textarea class="in" id="notes" name="notes" rows="3"></textarea></div></div>` : ""}
      <div class="box"><h2>Payment</h2>${ms.length ? `<div class="pays" role="radiogroup" aria-label="Payment method">${ms.map((m, i) => `<label class="pay"><input type="radio" name="pm" value="${m.id}"${i === 0 ? " checked" : ""}><div><b>${esc(m.label)}</b><span>${esc(m.desc)}</span></div></label>`).join("")}</div>` : `<p class="note">Online payment isn't set up yet. Place the order and we'll contact you about payment.</p>`}</div>
    </div>
    <aside class="sum"><h2>Order</h2><div class="mini">${lines.map((l) => `<div class="it"><div class="im">${pimg(l.p)}</div><div>${esc(l.p.name)}${l.opt ? `<br><span class="soft">${esc(l.opt)}</span>` : ""} × ${l.qty}</div><b>${esc(money(l.p.price * l.qty))}</b></div>`).join("")}</div>${summaryRows(t)}
      <p class="err" id="co-err" role="alert"></p><button class="btn pri block" type="submit">${esc(K.button)}</button><p class="soft" style="font-size:13px">${BE() ? "You'll see the exact total before you pay." : "Nothing is charged yet. You'll pay and send the order on the next screen."}</p></aside></form>`;
  },
  portfolio() {
    const P = C.portfolio;
    return `<section class="hero pf-hero"><div class="wrap"><div><p class="eyebrow">${esc(P.eyebrow)}</p><h1 style="font-size:clamp(38px,5.6vw,66px);margin-top:14px">${esc(P.title)}</h1><p class="lead">${esc(P.intro)}</p></div><div class="im">${P.image ? `<img src="${esc(imgUrl(P.image))}" alt="">` : ph(P.title)}</div></div></section>
    <section class="sec" style="padding-top:12px"><div class="wrap"><div class="story"><h2 style="font-size:clamp(28px,4vw,40px)">${esc(P.storyTitle)}</h2><div class="body">${paras(P.story)}</div></div>
      ${P.stats.length ? `<div class="stats">${P.stats.map((s) => `<div><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`).join("")}</div>` : ""}</div></section>
    ${P.work.length ? `<section class="sec" style="padding-top:0"><div class="wrap"><div class="sec-h"><h2>${esc(P.workTitle)}</h2></div><div class="work">${P.work.map((w) => `<article class="wcard"><div class="im">${w.image ? `<img src="${esc(imgUrl(w.image))}" alt="" loading="lazy">` : ph(w.title)}</div><div class="bd">${w.tag ? `<span class="tag">${esc(w.tag)}</span>` : ""}<h3>${esc(w.title)}</h3><p>${esc(w.text)}</p>${safeUrl(w.link) ? `<a class="link" href="${esc(safeUrl(w.link))}" target="_blank" rel="noopener">View ↗</a>` : ""}</div></article>`).join("")}</div></div></section>` : ""}
    <section class="sec" style="padding-top:0"><div class="wrap"><div class="ctaband"><h2>${esc(P.ctaTitle)}</h2><p class="soft">${esc(P.ctaText)}</p><a class="btn pri" href="shop.html">${esc(P.ctaButton)} →</a></div></div></section>`;
  },
  account() {
    return `<section class="page-h"><div class="wrap"><h1>${esc(C.accountPage.title)}</h1></div></section><div class="wrap" style="padding-bottom:80px"><div id="acct" aria-live="polite"><p class="soft">Loading…</p></div></div>`;
  },
  policies() {
    return `<section class="page-h"><div class="wrap"><h1>Policies</h1></div></section><div class="wrap pol">${C.policies.map((p) => `<section id="${esc(p.id || slugify(p.title))}"><h2>${esc(p.title)}</h2><p>${esc(p.text)}</p></section>`).join("")}</div>`;
  },
};

function summaryRows(t) {
  const S = C.settings;
  return `<div class="row"><span>Subtotal</span><span>${esc(money(t.sub))}</span></div>
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
  L.push("", `Subtotal: ${money(o.t.sub)}`, `Shipping: ${o.t.ship ? money(o.t.ship) : "Free"}`);
  if (o.t.taxAdd) L.push(`${C.settings.taxLabel}: ${money(o.t.taxAdd)}`);
  L.push(`Total: ${money(o.t.total)}`, `Payment: ${o.methodLabel}`, "", "Customer:", o.c.name, o.c.email);
  if (o.c.phone) L.push(o.c.phone);
  if (o.c.address) L.push(`${o.c.address}, ${o.c.city} ${o.c.pin}, ${o.c.state}`);
  if (o.c.notes) L.push("", `Notes: ${o.c.notes}`);
  return L.join("\n");
}
function upiLink(o) {
  const U = C.payments.upi;
  return `upi://pay?pa=${String(U.vpa).trim()}&pn=${encodeURIComponent(U.payeeName || C.brand.name)}&am=${Number(o.t.total).toFixed(2)}&cu=INR&tn=${encodeURIComponent(o.id)}`;
}
function serverDone(o) {
  const K = C.checkout, P = C.payments, wa = digits(C.orders.whatsapp), total = esc(money(o.t.total));
  const paid = o.payment_status === "paid", cod = o.payment_status === "cod";
  let pay = "";
  if (paid) pay = `<p class="note"><b>Payment received.</b> We've emailed a confirmation to ${esc(o.c.email)}.</p>`;
  else if (cod) pay = `<p>${esc(P.cod.note || "Pay when your order arrives.")} Keep <b>${total}</b> ready.</p><p class="note">We've emailed your order confirmation to ${esc(o.c.email)}.</p>`;
  else if (o.method === "razorpay") pay = `<p>Your payment isn't complete yet.</p><button class="btn pri" type="button" id="payrz">Pay ${total} now</button>`;
  else if (o.method === "stripe") pay = `<p>If you've just paid, this page updates in a moment.</p>${o.stripeUrl ? `<a class="btn pri" href="${esc(o.stripeUrl)}">Pay ${total} on Stripe</a>` : ""}`;
  else if (o.method === "upi") pay = `<p>Scan the code in any UPI app, or pay to the UPI ID. The amount and order number are filled in.</p><div class="qr" id="qr" aria-label="UPI QR code"></div><div class="copyrow"><code>${esc(P.upi.vpa)}</code><button type="button" data-copy="${esc(P.upi.vpa)}">Copy UPI ID</button></div><a class="btn pri" href="${esc(upiLink(o))}">Open UPI app</a><p class="note">Check your UPI app shows <b>${esc(P.upi.payeeName || C.brand.name)}</b> and <b>${total}</b>. Once we confirm your payment, we'll email you at ${esc(o.c.email)}.</p>`;
  else if (o.method === "paypal") pay = `<p>PayPal opens with the amount filled in. Add the order number <b>${esc(o.id)}</b> as the note.</p><a class="btn pri" href="https://www.paypal.me/${encodeURIComponent(P.paypal.username)}/${Number(o.t.total)}${esc(C.settings.currency)}" target="_blank" rel="noopener">Pay ${total} with PayPal ↗</a><p class="note">Once we confirm your payment, we'll email you at ${esc(o.c.email)}.</p>`;
  if (!paid && !cod && (o.method === "upi" || o.method === "paypal")) {
    const what = o.method === "upi" ? "UPI transaction ID (UTR)" : "PayPal transaction ID";
    pay += o.reported
      ? `<p class="note"><b>Thanks, we've got your reference ${esc(o.utr || "")}.</b> We'll email you at ${esc(o.c.email)} as soon as we've confirmed the payment.</p>`
      : `<form id="utr" class="form" novalidate style="border-top:1px solid var(--line);padding-top:16px"><div class="f"><label for="utr-in">Paid already? Enter the ${what}</label><input class="in" id="utr-in" inputmode="${o.method === "upi" ? "numeric" : "text"}" autocomplete="off" placeholder="${o.method === "upi" ? "12-digit number from your UPI app" : "Transaction ID"}"><span class="err" id="utr-e" role="alert"></span></div><button class="btn" type="submit">Send reference</button><p class="soft" style="font-size:13px">We'll check it and email you a confirmation.</p></form>`;
  }
  const title = paid || cod ? K.successTitle : "Your order is saved";
  return `<div class="wrap"><div class="done"><p class="eyebrow">Order ${esc(o.id)}</p><h1>${esc(title)}</h1>
    <div><span class="lbl">Your order number</span><br><span class="oid">${esc(o.id)}</span></div>
    <div class="box"><div class="step"><i>${paid || cod ? "✓" : "1"}</i><div><h2 style="font-size:22px">${paid ? "Paid" : cod ? "Pay on delivery" : `Pay ${total}`}</h2>${pay}</div></div></div>
    <div class="box"><h2 style="font-size:20px">Your order</h2><div class="mini">${o.items.map((i) => `<div class="it" style="grid-template-columns:minmax(0,1fr) auto"><div>${esc(i.name)}${i.opt ? ` <span class="soft">(${esc(i.opt)})</span>` : ""} × ${i.qty}</div><b>${esc(money(i.price * i.qty))}</b></div>`).join("")}</div>${summaryRows({ ...o.t, left: 0 })}</div>
    <div class="buy">${ACCOUNTS() ? `<a class="btn" href="account.html#orders">Track in your account</a>` : ""}${wa ? `<a class="btn" href="https://wa.me/${wa}?text=${encodeURIComponent(`Hi, about my order ${o.id}`)}" target="_blank" rel="noopener">Message us on WhatsApp</a>` : ""}</div>
    <a class="link" href="shop.html">Continue shopping</a></div></div>`;
}
async function openRazorpay(o) {
  if (!o.rz) return toast("This payment can't be restarted here. Contact us to pay.");
  try { await loadScript(RZP_JS); } catch (e) { return toast("Razorpay couldn't load. Check your connection and try again."); }
  const rz = new window.Razorpay({
    key: o.rz.key, amount: o.rz.amount, currency: o.rz.currency, name: o.rz.name, order_id: o.rz.order_id, prefill: o.rz.prefill, notes: { order_no: o.id }, theme: { color: C.theme.accent },
    handler: async (resp) => {
      try { const st = await fn("razorpay-verify", { order_no: o.id, ...resp }); updateLocalOrder(o.id, { payment_status: st.payment_status, status: st.status }); cart = []; saveCart(); render(); toast("Payment received"); }
      catch (e) { toast(esc(e.message)); }
    },
  });
  rz.open();
}
const statusChecked = new Set();
async function refreshStatus(o, tries) {
  // Wait for the shop's real settings: the first paint uses built-in defaults with the backend off.
  if (!BE() || PREVIEW || !o.server || !o.k || o.payment_status === "paid" || o.payment_status === "cod" || statusChecked.has(o.id + tries)) return;
  statusChecked.add(o.id + tries);
  try {
    await sbInit();
    const st = await fn("status", { order_no: o.id, access_key: o.k });
    if (st.payment_status !== o.payment_status) { updateLocalOrder(o.id, { payment_status: st.payment_status, status: st.status }); if (st.payment_status === "paid") { cart = []; saveCart(); } render(); return; }
  } catch (e) {}
  if (o.method === "stripe" && tries < 5) setTimeout(() => refreshStatus(o, tries + 1), 3000);
}
function orderDone(o) {
  if (o.server) return serverDone(o);
  const K = C.checkout, P = C.payments, O = C.orders, txt = orderText(o);
  const wa = digits(O.whatsapp), mail = O.email;
  const viaWa = wa && O.sendVia !== "email", viaMail = mail && O.sendVia !== "whatsapp";
  let pay = "";
  if (o.method === "upi") pay = `<p>Scan the code in any UPI app, or pay to the UPI ID. The amount and order number are filled in.</p><div class="qr" id="qr" aria-label="UPI QR code"></div><div class="copyrow"><code>${esc(P.upi.vpa)}</code><button type="button" data-copy="${esc(P.upi.vpa)}">Copy UPI ID</button></div><a class="btn pri" href="${esc(upiLink(o))}">Open UPI app</a><p class="note">Check your UPI app shows <b>${esc(P.upi.payeeName || C.brand.name)}</b> and <b>${esc(money(o.t.total))}</b> before you confirm.</p>`;
  else if (o.method === "razorpay" || o.method === "stripe") { const link = o.method === "razorpay" ? P.razorpay.link : P.stripe.link; pay = `<p>On the payment page, enter <b>${esc(money(o.t.total))}</b> and the order number <b>${esc(o.id)}</b>.</p><a class="btn pri" href="${esc(link)}" target="_blank" rel="noopener">Pay on ${o.method === "razorpay" ? "Razorpay" : "Stripe"} ↗</a>`; }
  else if (o.method === "paypal") pay = `<p>PayPal opens with the amount filled in. Add the order number <b>${esc(o.id)}</b> as the note.</p><a class="btn pri" href="https://www.paypal.me/${encodeURIComponent(P.paypal.username)}/${Number(o.t.total)}${esc(C.settings.currency)}" target="_blank" rel="noopener">Pay ${esc(money(o.t.total))} with PayPal ↗</a>`;
  else if (o.method === "cod") pay = `<p>${esc(P.cod.note || "Pay when your order arrives.")} Keep <b>${esc(money(o.t.total))}</b> ready.</p>`;
  else pay = `<p>We'll contact you about payment.</p>`;
  return `<div class="wrap"><div class="done"><p class="eyebrow">Order ${esc(o.id)}</p><h1>${esc(K.successTitle)}</h1><p class="soft" style="font-size:17px">${esc(K.successText)}</p>
    <div><span class="lbl">Your order number</span><br><span class="oid">${esc(o.id)}</span></div>
    <div class="box"><div class="step"><i>1</i><div><h2 style="font-size:22px">Pay ${esc(money(o.t.total))}</h2>${pay}</div></div></div>
    <div class="box"><div class="step"><i>2</i><div><h2 style="font-size:22px">Send us the order</h2><p>This opens ${viaWa && viaMail ? "WhatsApp or your email app" : viaWa ? "WhatsApp" : "your email app"} with the full order written out. Just press send.</p>
      <div class="buy">${viaWa ? `<a class="btn pri" href="https://wa.me/${wa}?text=${encodeURIComponent(txt)}" target="_blank" rel="noopener">Send on WhatsApp</a>` : ""}${viaMail ? `<a class="btn${viaWa ? "" : " pri"}" href="mailto:${esc(mail)}?subject=${encodeURIComponent(`Order ${o.id}`)}&body=${encodeURIComponent(txt)}">Send by email</a>` : ""}</div>
      ${!viaWa && !viaMail ? `<p class="note">Copy the order below and send it to ${esc(C.contact.email || "us")}.</p>` : ""}
      <pre class="msg" id="msg">${esc(txt)}</pre><button class="btn" type="button" data-copy-msg>Copy order details</button></div></div></div>
    <a class="link" href="shop.html">Continue shopping</a></div></div>`;
}

/* ============================================================
   RENDER + EVENTS
   ============================================================ */
function render() {
  applyTheme(C.theme);
  if (PAGE !== "product") document.title = PAGE === "home" ? C.seo.title || C.brand.name : `${{ shop: C.shop.title, cart: C.nav.cart, checkout: C.checkout.title, portfolio: C.nav.portfolio, policies: "Policies", account: C.accountPage.title }[PAGE] || ""} · ${C.brand.name}`;
  const fn = PAGES[PAGE] || PAGES.home;
  $("#app").innerHTML = `<a class="skip" href="#main">Skip to content</a>${header()}<main id="main">${fn()}</main>${footer()}`;
  bind();
}
function bind() {
  const mb = $(".menubtn"), nav = $("#nav");
  if (mb) mb.onclick = () => { const o = nav.classList.toggle("open"); mb.setAttribute("aria-expanded", o); };
  $$("[data-copy]").forEach((b) => (b.onclick = () => copy(b.dataset.copy, "Copied")));
  if (PAGE === "shop") bindShop();
  if (PAGE === "product") bindProduct();
  if (PAGE === "cart") bindCart();
  if (PAGE === "checkout") bindCheckout();
  if (PAGE === "account") bindAccount();
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
  let qty = 1, opt = p.options && p.options.length ? p.options[0] : "";
  $$(".thumbs button").forEach((b) => (b.onclick = () => { $("#mainimg").innerHTML = `<img src="${esc(imgUrl(p.images[+b.dataset.i]))}" alt="${esc(p.name)}">`; $$(".thumbs button").forEach((x) => x.setAttribute("aria-pressed", x === b)); }));
  $$(".optbtns button").forEach((b) => (b.onclick = () => { opt = b.dataset.o; $$(".optbtns button").forEach((x) => x.setAttribute("aria-pressed", x === b)); }));
  $$("[data-q]").forEach((b) => (b.onclick = () => { qty = Math.min(max, Math.max(1, qty + Number(b.dataset.q))); $("#qty").textContent = qty; }));
  const add = $("#add"); if (add) add.onclick = () => { addToCart(p.id, opt, qty); toast(`Added to cart · <a href="cart.html">View cart</a>`); };
  const bn = $("#buynow"); if (bn) bn.onclick = () => { addToCart(p.id, opt, qty); location.href = "checkout.html"; };
  const wb = $("#wish");
  if (wb) {
    const show = () => { const on = !!(WISH && WISH.has(p.id)); wb.setAttribute("aria-pressed", on); wb.textContent = on ? "♥ Saved to wishlist" : "♡ Save to wishlist"; };
    if (!PREVIEW) sbInit().then(loadWish).then(show).catch(() => {});
    wb.onclick = async () => {
      if (PREVIEW) return toast("The wishlist works on the live site.");
      try { await sbInit(); } catch (e) { return toast("Couldn't reach the shop. Try again."); }
      if (!USER) { location.href = `account.html?next=${encodeURIComponent("product.html" + location.search)}`; return; }
      wb.disabled = true;
      const on = WISH && WISH.has(p.id);
      try { await api.wish(p.id, !on); } catch (x) { wb.disabled = false; return toast(esc(x.message)); }
      wb.disabled = false;
      show();
      toast(on ? "Removed from your wishlist" : `Saved · <a href="account.html#wishlist">View wishlist</a>`);
    };
  }
}
function bindCart() {
  const lines = cartLines(), max = Math.max(1, Number(C.settings.maxQty) || 10);
  $$("[data-line]").forEach((b) => (b.onclick = () => { const l = lines[+b.dataset.line], c = cart.find((x) => x.id === l.id && x.opt === l.opt); c.qty = Math.min(max, Math.max(1, c.qty + Number(b.dataset.d))); saveCart(); render(); }));
  $$("[data-rm]").forEach((b) => (b.onclick = () => { const l = lines[+b.dataset.rm]; cart = cart.filter((x) => !(x.id === l.id && x.opt === l.opt)); saveCart(); render(); }));
}
function bindCheckout() {
  const remote = $("#remote");
  if (remote) {
    sbInit().then(() => fn("status", { order_no: remote.dataset.o, access_key: remote.dataset.k })).then((st) => {
      const o = { id: st.order_no, k: remote.dataset.k, server: true, method: st.method, methodLabel: st.method, items: st.items, t: st.totals, c: { email: "you" }, payment_status: st.payment_status, status: st.status };
      remote.outerHTML = serverDone(o).replace(/^<div class="wrap">|<\/div>$/g, "");
    }).catch(() => { remote.innerHTML = `<p>We couldn't find that order. Check the link in your email, or contact us.</p>`; });
    return;
  }
  const done = $(".done");
  if (done) {
    const cur = store.get("orders", []).find((x) => x.id === new URLSearchParams(location.search).get("order"));
    if (cur && cur.server) {
      refreshStatus(cur, 0);
      const pr = $("#payrz"); if (pr) pr.onclick = () => openRazorpay(cur);
      const uf = $("#utr");
      if (uf) uf.onsubmit = async (e) => {
        e.preventDefault();
        const v = $("#utr-in").value.replace(/[\s-]/g, ""), er = $("#utr-e"), b = $("#utr button");
        if (!/^[A-Za-z0-9]{6,30}$/.test(v)) { er.textContent = cur.method === "upi" ? "Enter the 12-digit UTR from your UPI app." : "Enter the transaction ID from PayPal."; return; }
        b.disabled = true; b.textContent = "Sending…"; er.textContent = "";
        try { const st = await fn("upi-reference", { order_no: cur.id, access_key: cur.k, utr: v }); updateLocalOrder(cur.id, { reported: true, utr: v, payment_status: st.payment_status, status: st.status }); render(); toast("Reference sent"); }
        catch (x) { er.textContent = x.message; b.disabled = false; b.textContent = "Send reference"; }
      };
    }
    const qr = $("#qr");
    if (qr) { const o = store.get("orders", []).find((x) => x.id === new URLSearchParams(location.search).get("order")); if (o && window.QRCode) { try { new window.QRCode(qr, { text: upiLink(o), width: 200, height: 200, correctLevel: window.QRCode.CorrectLevel.M }); } catch (e) { qr.outerHTML = `<p class="note">The QR code couldn't load. Use the UPI ID instead.</p>`; } } else if (!window.QRCode) qr.outerHTML = `<p class="note">The QR code couldn't load. Use the UPI ID instead.</p>`; }
    const cm = $("[data-copy-msg]"); if (cm) cm.onclick = () => copy($("#msg").textContent, "Order details copied");
    return;
  }
  const form = $("#co");
  if (BE() && !PREVIEW && !sbReady) { sbInit().then(loadProfile).then(() => render()).catch(() => {}); }
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
    if (bad) { bad.focus(); return; }
    const fd = Object.fromEntries(new FormData(form).entries());
    const lines = cartLines(), ms = methods(), m = ms.find((x) => x.id === fd.pm);
    if (BE() && !PREVIEW) return placeServerOrder(form, fd, lines, m);
    const o = { id: newOrderId(), at: new Date().toISOString(), method: m ? m.id : "none", methodLabel: m ? m.label : "To be arranged",
      items: lines.map((l) => ({ id: l.p.id, name: l.p.name, opt: l.opt, qty: l.qty, price: Number(l.p.price) })), t: totals(lines),
      c: { name: fd.name || "", email: fd.email || "", phone: fd.phone || "", address: fd.address || "", city: fd.city || "", pin: fd.pin || "", state: fd.state || "", notes: fd.notes || "" } };
    store.set("me", { name: o.c.name, email: o.c.email, phone: o.c.phone, address: o.c.address, city: o.c.city, pin: o.c.pin, state: o.c.state });
    store.set("orders", [o, ...store.get("orders", [])].slice(0, 10));
    cart = []; saveCart();
    history.pushState(null, "", `checkout.html?order=${encodeURIComponent(o.id)}`);
    render(); scrollTo(0, 0);
  };
}
async function placeServerOrder(form, fd, lines, m) {
  const btn = $('button[type="submit"]', form), err = $("#co-err");
  if (!m) { err.textContent = "Online ordering isn't set up yet. Please contact us to order."; return; }
  btn.disabled = true; btn.textContent = "Placing order…"; err.textContent = "";
  const c = { name: fd.name || "", email: (USER && USER.email) || fd.email || "", phone: fd.phone || "", address: fd.address || "", city: fd.city || "", pin: fd.pin || "", state: fd.state || "", notes: fd.notes || "" };
  try {
    await sbInit();
    const r = await fn("create-order", { method: m.id, items: lines.map((l) => ({ id: l.p.id, opt: l.opt, qty: l.qty })), customer: c });
    const o = { id: r.order_no, k: r.access_key, server: true, at: new Date().toISOString(), method: r.method, methodLabel: m.label, items: r.items, t: r.totals, c, payment_status: r.method === "cod" ? "cod" : "unpaid", status: r.method === "cod" ? "processing" : "pending", stripeUrl: r.stripe ? r.stripe.url : "", rz: r.razorpay || null };
    store.set("me", { name: c.name, email: c.email, phone: c.phone, address: c.address, city: c.city, pin: c.pin, state: c.state });
    store.set("orders", [o, ...store.get("orders", [])].slice(0, 10));
    if (USER && PROFILE && (!PROFILE.name || !PROFILE.phone)) api.saveProfile({ name: PROFILE.name || c.name, phone: PROFILE.phone || c.phone, address: (PROFILE.address && PROFILE.address.address) ? PROFILE.address : { address: c.address, city: c.city, pin: c.pin, state: c.state } }).catch(() => {});
    if (["cod", "upi", "paypal"].includes(r.method)) { cart = []; saveCart(); }
    if (r.stripe) { location.href = r.stripe.url; return; }
    history.pushState(null, "", `checkout.html?order=${encodeURIComponent(o.id)}`);
    render(); scrollTo(0, 0);
    if (r.razorpay) openRazorpay(o);
  } catch (x) {
    err.textContent = x.message; btn.disabled = false; btn.textContent = C.checkout.button;
  }
}

/* ============================================================
   ACCOUNT PAGE
   ============================================================ */
async function bindAccount() {
  const box = $("#acct"); if (!box) return;
  if (!ACCOUNTS()) { box.innerHTML = `<div class="empty"><p>Customer accounts aren't switched on for this shop.</p><a class="btn pri" href="shop.html">Go to the shop</a></div>`; return; }
  if (PREVIEW) return drawSignIn(box);
  try { await sbInit(); } catch (e) { box.innerHTML = `<div class="empty"><p>Your account couldn't load. Check your connection and try again.</p></div>`; return; }
  if (!USER) return drawSignIn(box);
  await Promise.all([loadProfile(), loadWish()]).catch(() => {});
  drawAccount(box);
}
function drawSignIn(box, email = "") {
  box.innerHTML = `<div class="box" style="max-width:480px"><h2>Sign in</h2><p class="soft">${esc(C.accountPage.signInText)}</p>
    <form id="otp1" class="form" novalidate><div class="f"><label for="ae">Email</label><input class="in" id="ae" type="email" autocomplete="email" required value="${esc(email || store.get("me", {}).email || "")}"><span class="err" id="ae-e" role="alert"></span></div><button class="btn pri" type="submit">Send code</button></form></div>`;
  $("#otp1").onsubmit = async (e) => {
    e.preventDefault();
    const em = $("#ae").value.trim().toLowerCase(), er = $("#ae-e"), b = $("#otp1 button");
    if (!emailOk(em)) { er.textContent = "Enter a valid email address."; return; }
    if (PREVIEW) { toast("Sign-in works on the live site."); return; }
    b.disabled = true; b.textContent = "Sending…"; er.textContent = "";
    try { await api.sendCode(em); } catch (x) { er.textContent = x.message; b.disabled = false; b.textContent = "Send code"; return; }
    drawCode(box, em);
  };
}
function drawCode(box, email) {
  box.innerHTML = `<div class="box" style="max-width:480px"><h2>Check your email</h2><p class="soft">We sent a 6-digit code to <b>${esc(email)}</b>.</p>
    <form id="otp2" class="form" novalidate><div class="f"><label for="ac">Code</label><input class="in" id="ac" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required style="font-size:22px;letter-spacing:.3em;font-family:var(--fm)"><span class="err" id="ac-e" role="alert"></span></div><button class="btn pri" type="submit">Sign in</button></form>
    <button class="rm" type="button" id="otpback">Use a different email</button></div>`;
  $("#ac").focus();
  $("#otpback").onclick = () => drawSignIn(box, email);
  $("#otp2").onsubmit = async (e) => {
    e.preventDefault();
    const code = $("#ac").value.replace(/\D/g, ""), er = $("#ac-e"), b = $("#otp2 button");
    if (code.length !== 6) { er.textContent = "Enter the 6-digit code from the email."; return; }
    b.disabled = true; b.textContent = "Signing in…";
    try { await api.verify(email, code); } catch (x) { er.textContent = x.message; b.disabled = false; b.textContent = "Sign in"; return; }
    const next = new URLSearchParams(location.search).get("next");
    if (next && /^[a-z]+\.html(\?[^#]*)?$/.test(next)) { location.href = next; return; }
    await Promise.all([loadProfile(), loadWish()]).catch(() => {});
    render();
  };
}
const ST_LABEL = { pending: "Awaiting payment", processing: "Being packed", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled" };
function track(o) {
  if (o.status === "cancelled") return `<p class="badge-x">Cancelled</p>`;
  const paid = o.payment_status === "paid" || o.payment_status === "cod";
  const lvl = { pending: 0, processing: 2, shipped: 3, delivered: 4 }[o.status] ?? 0;
  const steps = [["Placed", true], [o.payment_status === "cod" ? "Confirmed" : "Paid", paid], ["Packed", lvl >= 2 && paid], ["Shipped", lvl >= 3], ["Delivered", lvl >= 4]];
  return `<ol class="track" aria-label="Order progress">${steps.map(([l, d]) => `<li class="${d ? "on" : ""}"><i></i><span>${l}</span></li>`).join("")}</ol>`;
}
function drawAccount(box) {
  const tabs = [["orders", "Orders"], ...(C.backend.wishlist ? [["wishlist", "Wishlist"]] : []), ["details", "Account details"]];
  let tab = (location.hash || "#orders").slice(1); if (!tabs.some((t) => t[0] === tab)) tab = "orders";
  box.innerHTML = `<div class="acct-h"><div><p class="eyebrow">${PROFILE ? `Account ${esc(PROFILE.account_no)}` : "Account"}</p><h2 style="font-size:30px">Hi ${esc((PROFILE && PROFILE.name) || USER.email.split("@")[0])}</h2><p class="soft">${esc(USER.email)}</p></div><button class="btn" type="button" id="signout">Sign out</button></div>
    <div class="chips" role="tablist" aria-label="Account sections" style="margin:22px 0">${tabs.map(([id, l]) => `<button class="chip" type="button" role="tab" data-tab="${id}" aria-selected="${id === tab}" aria-pressed="${id === tab}">${l}</button>`).join("")}</div><div id="tabp"></div>`;
  $("#signout").onclick = async () => { await api.signOut(); render(); };
  $$("[data-tab]").forEach((b) => (b.onclick = () => { history.replaceState(null, "", "#" + b.dataset.tab); drawAccount(box); }));
  const tp = $("#tabp");
  if (tab === "orders") {
    tp.innerHTML = `<p class="soft">Loading your orders…</p>`;
    api.myOrders().then((data) => {
      tp.innerHTML = data && data.length ? `<div class="olist">${data.map((o) => `<article class="ocard"><div class="ocard-h"><div><b>Order ${esc(o.order_no)}</b><span class="soft">${new Date(o.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })} · ${esc(ST_LABEL[o.status] || o.status)}</span></div><b>${esc(money(o.totals.total))}</b></div>${track(o)}
        <ul class="oitems">${o.items.map((i) => `<li>${esc(i.name)}${i.opt ? ` <span class="soft">(${esc(i.opt)})</span>` : ""} × ${i.qty}</li>`).join("")}</ul></article>`).join("")}</div>`
        : `<div class="empty"><p>No orders yet.</p><a class="btn pri" href="shop.html">Start shopping</a></div>`;
    }, () => { tp.innerHTML = `<p>Your orders couldn't load. Try again.</p>`; });
  } else if (tab === "wishlist") {
    const list = C.products.filter((p) => WISH && WISH.has(p.id));
    tp.innerHTML = list.length ? `<div class="grid">${list.map((p) => `<div style="display:flex;flex-direction:column;gap:8px">${pcard(p)}<button class="rm" type="button" data-unwish="${esc(p.id)}" style="align-self:flex-start">Remove</button></div>`).join("")}</div>` : `<div class="empty"><p>Your wishlist is empty. Tap “Save to wishlist” on any product.</p><a class="btn pri" href="shop.html">Browse products</a></div>`;
    $$("[data-unwish]", tp).forEach((b) => (b.onclick = async () => { try { await api.wish(b.dataset.unwish, false); } catch (x) { return toast(esc(x.message)); } drawAccount(box); }));
  } else {
    const a = (PROFILE && PROFILE.address) || {}, v = (k) => esc(k);
    tp.innerHTML = `<form id="det" class="box" style="max-width:640px" novalidate><div class="fgrid">
      <div class="f"><label for="dn">Full name</label><input class="in" id="dn" autocomplete="name" value="${v((PROFILE && PROFILE.name) || "")}"></div>
      <div class="f"><label for="dp">Phone</label><input class="in" id="dp" type="tel" autocomplete="tel" value="${v((PROFILE && PROFILE.phone) || "")}"></div>
      <div class="f full"><label for="da">Address</label><input class="in" id="da" autocomplete="street-address" value="${v(a.address || "")}"></div>
      <div class="f"><label for="dc">City</label><input class="in" id="dc" autocomplete="address-level2" value="${v(a.city || "")}"></div>
      <div class="f"><label for="dz">PIN / postcode</label><input class="in" id="dz" autocomplete="postal-code" value="${v(a.pin || "")}"></div>
      <div class="f"><label for="ds">State</label><input class="in" id="ds" autocomplete="address-level1" value="${v(a.state || "")}"></div>
      <div class="f"><label>Account number</label><input class="in" readonly value="${v((PROFILE && PROFILE.account_no) || "")}"></div></div>
      <button class="btn pri" type="submit" style="align-self:flex-start">Save details</button></form>`;
    $("#det").onsubmit = async (e) => {
      e.preventDefault();
      const patch = { name: $("#dn").value.trim().slice(0, 120), phone: $("#dp").value.trim().slice(0, 30), address: { address: $("#da").value.trim(), city: $("#dc").value.trim(), pin: $("#dz").value.trim(), state: $("#ds").value.trim() } };
      try { await api.saveProfile(patch); } catch (x) { return toast(esc(x.message)); }
      toast("Details saved");
    };
  }
}

addEventListener("popstate", render);

/* ============================================================
   BOOT
   ============================================================ */
if (PAGE === "checkout") { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"; s.onload = () => { if ($(".done")) bindCheckout(); }; document.head.appendChild(s); }
if (PREVIEW) {
  addEventListener("message", (e) => {
    if (e.origin !== location.origin || e.source !== window.parent) return;
    const d = e.data || {};
    if (d.type === "cms:content" && d.content && typeof d.content === "object") { ASSETS = d.assets || {}; const y = scrollY; C = merge(DEFAULT, d.content); render(); scrollTo(0, y); }
  });
  window.parent.postMessage({ type: "cms:ready", page: location.pathname.split("/").pop() || "index.html" }, location.origin);
}
render();
if (!PREVIEW) fetch("content.json", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (j) { C = merge(DEFAULT, j); render(); } }).catch(() => {});
addEventListener("hashchange", () => { if (PAGE === "account") render(); });
})();
