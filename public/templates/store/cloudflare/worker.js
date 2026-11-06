// Site Studio shop backend for Cloudflare Workers. Paste this whole file into your Worker (Edit code → Deploy).
// Setup: cloudflare/SETUP.md. Generated from worker/shop-worker.ts. Don't edit by hand.

var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// stub:npm:@supabase/supabase-js@2.45.4
var supabase_js_2_45_exports = {};
__export(supabase_js_2_45_exports, {
  createClient: () => createClient
});
var createClient;
var init_supabase_js_2_45 = __esm({
  "stub:npm:@supabase/supabase-js@2.45.4"() {
    createClient = () => {
      throw new Error("Not available on Cloudflare");
    };
  }
});

// public/templates/store/supabase/functions/shop/index.ts
var enc = new TextEncoder();
var hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
async function hmacHex(secret2, msg) {
  const k = await crypto.subtle.importKey("raw", enc.encode(secret2), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, enc.encode(msg)));
}
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
var randHex = (n) => hex(crypto.getRandomValues(new Uint8Array(n)).buffer);
var esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var str = (v, max = 200) => String(v ?? "").trim().slice(0, max);
var emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
var vpaOk = (v) => /^[A-Za-z0-9.\-_]{2,256}@[A-Za-z][A-Za-z0-9.\-]{1,63}$/.test(String(v || "").trim());
var ppOk = (v) => /^[A-Za-z0-9]{1,40}$/.test(String(v || "").trim());
var round2 = (n) => Math.round(n * 100) / 100;
function money(v, cur) {
  try {
    return new Intl.NumberFormat(cur === "INR" ? "en-IN" : "en-US", { style: "currency", currency: cur, maximumFractionDigits: v % 1 ? 2 : 0 }).format(v);
  } catch {
    return `${cur} ${v}`;
  }
}
function computeTotals(items, s) {
  const sub = round2(items.reduce((t, i) => t + i.price * i.qty, 0));
  const free = Number(s.freeShippingOver) > 0 && sub >= Number(s.freeShippingOver);
  const ship = !items.length || free ? 0 : Number(s.shippingFee) || 0;
  const pct = Number(s.taxPercent) || 0;
  const taxAdd = pct && !s.taxIncluded ? Math.round(sub * pct) / 100 : 0;
  const taxIn = pct && s.taxIncluded ? round2(sub - sub / (1 + pct / 100)) : 0;
  return { sub, ship, taxAdd, taxIn, total: round2(sub + ship + taxAdd) };
}
function methodsFor(c) {
  const P = c.payments || {}, out = [];
  if (P.upi?.enabled && vpaOk(P.upi.vpa) && c.settings?.currency === "INR") out.push("upi");
  if (P.razorpay?.enabled) out.push("razorpay");
  if (P.stripe?.enabled) out.push("stripe");
  if (P.paypal?.enabled && ppOk(P.paypal.username)) out.push("paypal");
  if (P.cod?.enabled) out.push("cod");
  return out;
}
var HttpError = class extends Error {
  constructor(status2, message) {
    super(message);
    this.status = status2;
  }
};
var contentCache = null;
async function siteContent(d) {
  if (contentCache && d.now().getTime() - contentCache.at < 6e4) return contentCache.data;
  const base = d.env("SITE_URL").replace(/\/?$/, "/");
  if (!/^https?:\/\//.test(base)) throw new HttpError(500, "SITE_URL secret is not set.");
  const r = await d.fetch(base + "content.json", { headers: { "cache-control": "no-cache" } });
  if (!r.ok) throw new HttpError(502, "Couldn't load the shop's catalogue.");
  const data = await r.json();
  contentCache = { at: d.now().getTime(), data };
  return data;
}
function orderTable(o) {
  const rows = o.items.map((i) => `<tr><td style="padding:6px 0">${esc(i.name)}${i.opt ? ` <span style="color:#777">(${esc(i.opt)})</span>` : ""} \xD7 ${i.qty}</td><td style="padding:6px 0;text-align:right">${esc(money(i.price * i.qty, o.currency))}</td></tr>`).join("");
  const t = o.totals;
  const line = (l, v, b = false) => `<tr><td style="padding:4px 0;${b ? "font-weight:700;border-top:1px solid #ddd;padding-top:8px" : "color:#555"}">${l}</td><td style="padding:4px 0;text-align:right;${b ? "font-weight:700;border-top:1px solid #ddd;padding-top:8px" : ""}">${v}</td></tr>`;
  return `<table style="width:100%;border-collapse:collapse;font-size:14px">${rows}${line("Subtotal", esc(money(t.sub, o.currency)))}${line("Shipping", t.ship ? esc(money(t.ship, o.currency)) : "Free")}${t.taxAdd ? line("Tax", esc(money(t.taxAdd, o.currency))) : ""}${line("Total", esc(money(t.total, o.currency)), true)}</table>`;
}
function wrap(shop, title, body) {
  return `<!doctype html><html><body style="margin:0;background:#f4f4f2;font-family:Arial,Helvetica,sans-serif;color:#1b1a17"><div style="max-width:560px;margin:0 auto;padding:24px"><div style="background:#fff;border-radius:12px;padding:28px"><p style="margin:0 0 4px;font-size:13px;color:#777">${esc(shop)}</p><h1 style="margin:0 0 16px;font-size:22px">${esc(title)}</h1>${body}</div><p style="font-size:12px;color:#888;text-align:center;margin-top:16px">${esc(shop)}</p></div></body></html>`;
}
var addr = (o) => [o.address.address, [o.address.city, o.address.pin].filter(Boolean).join(" "), o.address.state].filter(Boolean).map(esc).join("<br>");
async function sendEmail(d, to, subject, html, replyTo) {
  const key = d.env("RESEND_API_KEY"), from = d.env("MAIL_FROM");
  if (!key || !from || !to.length) return false;
  const r = await d.fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html, ...replyTo ? { reply_to: replyTo } : {} })
  }).catch(() => null);
  if (r && !r.ok) console.error("Resend refused the email:", r.status, await r.text().catch(() => ""));
  return !!r && r.ok;
}
var owners = (d) => d.env("OWNER_EMAIL").split(",").map((s) => s.trim()).filter(emailOk);
async function notify(d, o, kind) {
  const c = await siteContent(d).catch(() => ({}));
  const shop = c?.brand?.name || "Shop";
  const site = d.env("SITE_URL").replace(/\/?$/, "/");
  const own = owners(d);
  const log = [];
  const track = c?.backend?.accounts ? `<p style="font-size:14px">Track it any time in <a href="${esc(site)}account.html">your account</a> using ${esc(o.email)}.</p>` : "";
  const cust = async (subject, title, intro) => {
    const ok = await sendEmail(d, [o.email], subject, wrap(shop, title, `<p style="font-size:15px">${intro}</p><p style="font-size:14px;color:#555">Order <b>${esc(o.order_no)}</b></p>${orderTable(o)}${track}`), own[0]);
    log.push({ at: d.now().toISOString(), what: `customer:${kind}`, ok });
  };
  const owner = async (subject, title) => {
    if (!own.length) return;
    const ok = await sendEmail(d, own, subject, wrap(shop, title, `<p style="font-size:15px"><b>${esc(o.name)}</b> \xB7 ${esc(o.email)}${o.phone ? ` \xB7 ${esc(o.phone)}` : ""}</p><p style="font-size:14px;color:#555">Order <b>${esc(o.order_no)}</b> \xB7 ${esc(o.method)} \xB7 payment ${esc(o.payment_status)}</p>${orderTable(o)}${addr(o) ? `<p style="font-size:14px"><b>Deliver to</b><br>${addr(o)}</p>` : ""}${o.notes ? `<p style="font-size:14px"><b>Notes</b><br>${esc(o.notes)}</p>` : ""}`), o.email);
    log.push({ at: d.now().toISOString(), what: `owner:${kind}`, ok });
  };
  if (kind === "paid") {
    await cust(`Order ${o.order_no} confirmed`, "Payment received, thank you", `Hi ${esc(o.name)}, we've received your payment of <b>${esc(money(o.totals.total, o.currency))}</b>. We'll let you know when your order ships.`);
    await owner(`Paid order ${o.order_no} \xB7 ${money(o.totals.total, o.currency)}`, "New paid order");
  } else if (kind === "cod") {
    await cust(`Order ${o.order_no} confirmed`, "Order confirmed", `Hi ${esc(o.name)}, your order is confirmed. Please keep <b>${esc(money(o.totals.total, o.currency))}</b> ready to pay on delivery.`);
    await owner(`New cash-on-delivery order ${o.order_no}`, "New order (cash on delivery)");
  } else if (kind === "awaiting") {
    await owner(`New order ${o.order_no} awaiting ${o.method.toUpperCase()} payment`, "New order: check for payment");
  } else if (kind === "reported") {
    const via = o.method === "paypal" ? "PayPal" : "UPI";
    await cust(`Payment reference received for order ${o.order_no}`, "We've got your payment reference", `Hi ${esc(o.name)}, thanks for paying <b>${esc(money(o.totals.total, o.currency))}</b> by ${via}. Your reference is <b>${esc(o.payment_ref)}</b>. We'll email you again as soon as we've confirmed it.`);
    if (own.length) {
      const ok = await sendEmail(d, own, `Check ${via} payment for ${o.order_no}: ref ${o.payment_ref}`, wrap(shop, `Customer says they've paid by ${via}`, `<p style="font-size:15px"><b>${esc(o.name)}</b> reports paying <b>${esc(money(o.totals.total, o.currency))}</b> for order <b>${esc(o.order_no)}</b>.</p><p style="font-size:15px">Reference: <b style="font-family:monospace;font-size:17px">${esc(o.payment_ref)}</b></p><p style="font-size:14px">Find this reference in your ${via} app. If the amount matches, open <a href="${esc(site)}admin.html">the shop CMS \u2192 Orders</a> and tap <b>Mark paid</b>. You and the customer then get the confirmation email.</p>${orderTable(o)}`), o.email);
      log.push({ at: d.now().toISOString(), what: "owner:reported", ok });
    }
  } else {
    const words = { shipped: ["has shipped", "Your order is on its way."], delivered: ["was delivered", "Your order has been delivered. We hope you love it."], cancelled: ["was cancelled", "Your order has been cancelled. Reply to this email if you have questions."] }[kind];
    await cust(`Order ${o.order_no} ${words[0]}`, `Order ${words[0]}`, `Hi ${esc(o.name)}, ${words[1]}`);
  }
  return log;
}
async function markPaid(d, o, ref) {
  if (o.payment_status === "paid") return o;
  let next = await d.db.updateOrder(o.order_no, { payment_status: "paid", paid_at: d.now().toISOString(), status: o.status === "pending" ? "processing" : o.status, ...ref ? { payment_ref: ref } : {} });
  const log = await notify(d, next, "paid");
  next = await d.db.updateOrder(o.order_no, { notify_log: [...next.notify_log || [], ...log] });
  return next;
}
async function razorpayOrder(d, o) {
  const id = d.env("RAZORPAY_KEY_ID"), secret2 = d.env("RAZORPAY_KEY_SECRET");
  if (!id || !secret2) throw new HttpError(500, "Razorpay keys are not set on the server.");
  const r = await d.fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { Authorization: "Basic " + btoa(`${id}:${secret2}`), "Content-Type": "application/json" },
    body: JSON.stringify({ amount: Math.round(o.totals.total * 100), currency: o.currency, receipt: o.order_no, notes: { order_no: o.order_no } })
  });
  if (!r.ok) throw new HttpError(502, "Razorpay couldn't start the payment.");
  return r.json();
}
async function stripeSession(d, o) {
  const key = d.env("STRIPE_SECRET_KEY");
  if (!key) throw new HttpError(500, "Stripe key is not set on the server.");
  const site = d.env("SITE_URL").replace(/\/?$/, "/");
  const f = new URLSearchParams({
    mode: "payment",
    success_url: `${site}checkout.html?order=${encodeURIComponent(o.order_no)}&k=${o.access_key}`,
    cancel_url: `${site}checkout.html`,
    customer_email: o.email,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": o.currency.toLowerCase(),
    "line_items[0][price_data][unit_amount]": String(Math.round(o.totals.total * 100)),
    "line_items[0][price_data][product_data][name]": `Order ${o.order_no}`,
    "metadata[order_no]": o.order_no,
    "payment_intent_data[metadata][order_no]": o.order_no
  });
  const r = await d.fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" }, body: f.toString() });
  if (!r.ok) throw new HttpError(502, "Stripe couldn't start the payment.");
  return r.json();
}
async function createOrder(d, body, token) {
  const c = await siteContent(d);
  const S = c.settings || {}, cur = String(S.currency || "INR");
  const user = token ? await d.db.getUser(token) : null;
  if (c.backend?.accounts && c.backend?.requireLogin && !user) throw new HttpError(401, "Please sign in to place an order.");
  const method = str(body.method, 20);
  if (!methodsFor(c).includes(method)) throw new HttpError(400, "That payment method isn't available.");
  const cust = body.customer || {};
  const email = (user?.email || str(cust.email, 200)).toLowerCase();
  const name = str(cust.name, 120);
  if (!name) throw new HttpError(400, "Please enter your name.");
  if (!emailOk(email)) throw new HttpError(400, "Please enter a valid email address.");
  const maxQty = Math.max(1, Number(S.maxQty) || 10);
  if (!Array.isArray(body.items) || !body.items.length || body.items.length > 50) throw new HttpError(400, "Your cart is empty.");
  const items = [];
  for (const raw of body.items) {
    const p = (c.products || []).find((x) => x.id === raw?.id);
    if (!p) throw new HttpError(409, "A product in your cart is no longer available. Please review your cart.");
    if (p.stock === "out") throw new HttpError(409, `${p.name} is sold out. Please remove it from your cart.`);
    const qty = Math.floor(Number(raw.qty));
    if (!(qty >= 1 && qty <= maxQty)) throw new HttpError(400, `You can order up to ${maxQty} of each item.`);
    const opt = str(raw.opt, 60);
    if (opt && !(p.options || []).includes(opt)) throw new HttpError(409, `The option \u201C${opt}\u201D for ${p.name} has changed. Please add it to your cart again.`);
    items.push({ id: p.id, name: str(p.name, 160), opt, qty, price: round2(Number(p.price) || 0) });
  }
  const totals = computeTotals(items, S);
  if (Number(S.minOrder) > 0 && totals.sub < Number(S.minOrder)) throw new HttpError(400, `The minimum order is ${money(Number(S.minOrder), cur)}.`);
  const now = d.now();
  const pre = String(S.orderPrefix || "ORD").replace(/[^A-Za-z0-9]/g, "").slice(0, 6).toUpperCase() || "ORD";
  const order = {
    order_no: `${pre}-${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}-${randHex(3).toUpperCase()}`,
    access_key: randHex(16),
    user_id: user?.id || null,
    email,
    name,
    phone: str(cust.phone, 30),
    address: { address: str(cust.address, 200), city: str(cust.city, 80), pin: str(cust.pin, 20), state: str(cust.state, 80) },
    notes: str(cust.notes, 1e3),
    items,
    totals,
    currency: cur,
    method,
    payment_status: method === "cod" ? "cod" : "unpaid",
    status: method === "cod" ? "processing" : "pending",
    payment_ref: null,
    paid_at: null,
    notify_log: []
  };
  await d.db.insertOrder(order);
  const out = { order_no: order.order_no, access_key: order.access_key, totals, currency: cur, method, items };
  if (method === "razorpay") {
    const rz = await razorpayOrder(d, order);
    await d.db.updateOrder(order.order_no, { payment_ref: rz.id });
    out.razorpay = { key: d.env("RAZORPAY_KEY_ID"), order_id: rz.id, amount: Math.round(totals.total * 100), currency: cur, name: c.brand?.name || "Shop", prefill: { name, email, contact: order.phone } };
  } else if (method === "stripe") {
    const ss = await stripeSession(d, order);
    await d.db.updateOrder(order.order_no, { payment_ref: ss.id });
    out.stripe = { url: ss.url };
  } else {
    const log = await notify(d, order, method === "cod" ? "cod" : "awaiting");
    await d.db.updateOrder(order.order_no, { notify_log: log });
  }
  return out;
}
var publicOrder = (o) => ({ order_no: o.order_no, status: o.status, payment_status: o.payment_status, totals: o.totals, currency: o.currency, items: o.items, method: o.method, created_at: o.created_at, reported: (o.method === "upi" || o.method === "paypal") && !!o.payment_ref });
async function upiReference(d, b) {
  const o = await d.db.getOrder({ order_no: str(b.order_no, 40) });
  if (!o || !safeEqual(o.access_key, String(b.access_key || ""))) throw new HttpError(404, "Order not found.");
  if (o.method !== "upi" && o.method !== "paypal") throw new HttpError(400, "This order isn't paid by UPI or PayPal.");
  if (o.payment_status !== "unpaid") return publicOrder(o);
  const ref = String(b.utr || "").replace(/[\s-]/g, "").slice(0, 40);
  if (!/^[A-Za-z0-9]{6,30}$/.test(ref)) throw new HttpError(400, o.method === "upi" ? "Enter the 12-digit UPI transaction ID (UTR) shown in your payment app." : "Enter the transaction ID from PayPal.");
  if (o.payment_ref === ref) return publicOrder(o);
  if ((o.notify_log || []).filter((l) => l.what === "owner:reported").length >= 3) throw new HttpError(429, "We've already received your reference. We'll confirm your payment soon.");
  let next = await d.db.updateOrder(o.order_no, { payment_ref: ref });
  const log = await notify(d, next, "reported");
  next = await d.db.updateOrder(o.order_no, { notify_log: [...next.notify_log || [], ...log] });
  return publicOrder(next);
}
async function razorpayVerify(d, b) {
  const o = await d.db.getOrder({ order_no: str(b.order_no, 40) });
  if (!o || o.payment_ref !== b.razorpay_order_id) throw new HttpError(404, "Order not found.");
  if (!d.env("RAZORPAY_KEY_SECRET")) throw new HttpError(500, "Razorpay keys are not set on the server.");
  const expect = await hmacHex(d.env("RAZORPAY_KEY_SECRET"), `${b.razorpay_order_id}|${b.razorpay_payment_id}`);
  if (!safeEqual(expect, String(b.razorpay_signature || ""))) throw new HttpError(400, "The payment couldn't be verified.");
  return publicOrder(await markPaid(d, o, null));
}
async function razorpayWebhook(d, raw, sig) {
  if (!d.env("RAZORPAY_WEBHOOK_SECRET")) throw new HttpError(400, "Bad signature");
  const expect = await hmacHex(d.env("RAZORPAY_WEBHOOK_SECRET"), raw);
  if (!safeEqual(expect, sig)) throw new HttpError(400, "Bad signature");
  const ev = JSON.parse(raw);
  const rzOrder = ev?.payload?.payment?.entity?.order_id || ev?.payload?.order?.entity?.id;
  if (!["payment.captured", "order.paid"].includes(ev?.event) || !rzOrder) return { ignored: true };
  const o = await d.db.getOrder({ payment_ref: rzOrder });
  if (!o) return { ignored: true };
  await markPaid(d, o, null);
  return { ok: true };
}
async function stripeWebhook(d, raw, header) {
  const secret2 = d.env("STRIPE_WEBHOOK_SECRET");
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  const t = Number(parts.t);
  if (!secret2 || !t || Math.abs(d.now().getTime() / 1e3 - t) > 300) throw new HttpError(400, "Bad signature");
  const expect = await hmacHex(secret2, `${parts.t}.${raw}`);
  const sigs = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!sigs.some((s) => safeEqual(expect, s))) throw new HttpError(400, "Bad signature");
  const ev = JSON.parse(raw);
  if (ev.type !== "checkout.session.completed" || ev.data?.object?.payment_status !== "paid") return { ignored: true };
  const no = ev.data.object.metadata?.order_no;
  const o = no ? await d.db.getOrder({ order_no: no }) : null;
  if (!o) return { ignored: true };
  await markPaid(d, o, ev.data.object.payment_intent || null);
  return { ok: true };
}
async function status(d, b) {
  const o = await d.db.getOrder({ order_no: str(b.order_no, 40) });
  if (!o || !safeEqual(o.access_key, String(b.access_key || ""))) throw new HttpError(404, "Order not found.");
  return publicOrder(o);
}
async function admin(d, b, token) {
  const user = token ? await d.db.getUser(token) : null;
  if (!user || !await d.db.isAdmin(user.email)) throw new HttpError(403, "Only shop admins can do this.");
  const o = await d.db.getOrder({ order_no: str(b.order_no, 40) });
  if (!o) throw new HttpError(404, "Order not found.");
  if (b.action === "mark-paid") return { order: await markPaid(d, o, str(b.ref, 100) || null) };
  if (b.action === "set-status") {
    const st = String(b.status);
    if (!["pending", "processing", "shipped", "delivered", "cancelled"].includes(st)) throw new HttpError(400, "Unknown status.");
    let next = await d.db.updateOrder(o.order_no, { status: st });
    if (st !== o.status && (st === "shipped" || st === "delivered" || st === "cancelled")) {
      const log = await notify(d, next, st);
      next = await d.db.updateOrder(o.order_no, { notify_log: [...next.notify_log || [], ...log] });
    }
    return { order: next };
  }
  throw new HttpError(400, "Unknown action.");
}
function makeHandler(d, extra = {}) {
  return async (req) => {
    const site = d.env("SITE_URL");
    let siteOrigin = "";
    try {
      siteOrigin = site ? new URL(site.trim()).origin : "";
    } catch {
    }
    const allowed = [siteOrigin, ...d.env("ALLOWED_ORIGINS").split(",").map((s) => s.trim())].filter(Boolean);
    const origin = req.headers.get("origin") || "";
    const cors = {
      "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : allowed[0] || "*",
      "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      Vary: "Origin"
    };
    const json = (status2, body) => new Response(JSON.stringify(body), { status: status2, headers: { ...cors, "Content-Type": "application/json" } });
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (req.method !== "POST") return json(405, { error: "Use POST." });
    const route = new URL(req.url).pathname.split("/").filter(Boolean).pop() || "";
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    try {
      const raw = await req.text();
      if (raw.length > 1e5) throw new HttpError(413, "Request too large.");
      if (route === "razorpay-webhook") return json(200, await razorpayWebhook(d, raw, req.headers.get("x-razorpay-signature") || ""));
      if (route === "stripe-webhook") return json(200, await stripeWebhook(d, raw, req.headers.get("stripe-signature") || ""));
      const b = raw ? JSON.parse(raw) : {};
      if (route === "create-order") return json(200, await createOrder(d, b, token));
      if (route === "razorpay-verify") return json(200, await razorpayVerify(d, b));
      if (route === "status") return json(200, await status(d, b));
      if (route === "upi-reference") return json(200, await upiReference(d, b));
      if (route === "admin") return json(200, await admin(d, b, token));
      if (Object.prototype.hasOwnProperty.call(extra, route)) return json(200, await extra[route](b, token));
      return json(404, { error: "Unknown route." });
    } catch (e) {
      if (e instanceof HttpError) return json(e.status, { error: e.message });
      console.error(e);
      return json(500, { error: "Something went wrong. Please try again." });
    }
  };
}
async function realDeps() {
  const { createClient: createClient2 } = await Promise.resolve().then(() => (init_supabase_js_2_45(), supabase_js_2_45_exports));
  const env = (k) => Deno.env.get(k) || "";
  const sb = createClient2(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const db = {
    async insertOrder(o) {
      const { error } = await sb.from("orders").insert(o);
      if (error) throw new Error(error.message);
    },
    async getOrder(by) {
      let q = sb.from("orders").select("*").limit(1);
      if (by.order_no) q = q.eq("order_no", by.order_no);
      else if (by.payment_ref) q = q.eq("payment_ref", by.payment_ref);
      else return null;
      const { data, error } = await q.maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
    async updateOrder(order_no, patch) {
      const { data, error } = await sb.from("orders").update(patch).eq("order_no", order_no).select("*").single();
      if (error) throw new Error(error.message);
      return data;
    },
    async isAdmin(email) {
      const { data } = await sb.from("shop_admins").select("email");
      return (data || []).some((r) => r.email.toLowerCase() === email.toLowerCase());
    },
    async getUser(token) {
      const { data } = await sb.auth.getUser(token);
      return data?.user ? { id: data.user.id, email: (data.user.email || "").toLowerCase() } : null;
    }
  };
  return { db, env, fetch: (...a) => fetch(...a), now: () => /* @__PURE__ */ new Date() };
}
var D = globalThis.Deno;
if (D && !D.env.get("SHOP_TEST")) {
  let handler = null;
  D.serve(async (req) => (handler ||= makeHandler(await realDeps()))(req));
}

// worker/shop-worker.ts
var te = new TextEncoder();
var td = new TextDecoder();
function b64(s) {
  const b = te.encode(s);
  let bin = "";
  for (let i = 0; i < b.length; i += 32768) bin += String.fromCharCode(...b.subarray(i, i + 32768));
  return btoa(bin);
}
var unb64 = (s) => td.decode(Uint8Array.from(atob(s.replace(/\s/g, "")), (c) => c.charCodeAt(0)));
var b64url = (s) => b64(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
var unb64url = (s) => unb64(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
async function sha256Hex(s) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", te.encode(s)))].map((x) => x.toString(16).padStart(2, "0")).join("");
}
var repoChecked = /* @__PURE__ */ new Map();
var GitHub = class {
  constructor(repo, token, f) {
    this.repo = repo;
    this.token = token;
    this.f = f;
  }
  h() {
    return { Authorization: `Bearer ${this.token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "site-studio-shop", "Content-Type": "application/json" };
  }
  /** Refuse to store orders in a public repository: GitHub Pages or anyone could read them. */
  async ensurePrivate() {
    if (repoChecked.get(this.repo)) return;
    const r = await this.f(`https://api.github.com/repos/${this.repo}`, { headers: this.h() });
    if (r.status === 401) throw new HttpError(500, "GITHUB_TOKEN is invalid or expired.");
    if (r.status === 404) throw new HttpError(500, "DATA_REPO wasn't found, or GITHUB_TOKEN can't see it.");
    if (!r.ok) throw new HttpError(502, "GitHub didn't respond. Try again.");
    const j = await r.json();
    if (!j.private) throw new HttpError(500, "DATA_REPO must be a private repository. Orders contain customer details.");
    repoChecked.set(this.repo, true);
  }
  async get(path) {
    const r = await this.f(`https://api.github.com/repos/${this.repo}/contents/${path}`, { headers: this.h() });
    if (r.status === 404) return null;
    if (!r.ok) throw new HttpError(502, `GitHub read failed (${r.status}).`);
    const j = await r.json();
    return { data: JSON.parse(unb64(j.content)), sha: j.sha };
  }
  /** Returns the new sha, or null when the file changed underneath us (sha mismatch / already exists). */
  async put(path, data, message, sha) {
    const r = await this.f(`https://api.github.com/repos/${this.repo}/contents/${path}`, {
      method: "PUT",
      headers: this.h(),
      body: JSON.stringify({ message, content: b64(JSON.stringify(data, null, 2) + "\n"), ...sha ? { sha } : {} })
    });
    if (r.status === 409 || r.status === 422) return null;
    if (!r.ok) throw new HttpError(502, `GitHub write failed (${r.status}).`);
    const j = await r.json();
    return j.content.sha;
  }
  /** Every JSON file in a folder in ONE request (GraphQL), to stay well inside Worker limits. */
  async list(folder) {
    const [owner, name] = this.repo.split("/");
    const r = await this.f("https://api.github.com/graphql", {
      method: "POST",
      headers: this.h(),
      body: JSON.stringify({ query: "query($o:String!,$n:String!,$e:String!){repository(owner:$o,name:$n){object(expression:$e){... on Tree{entries{name object{... on Blob{text}}}}}}}", variables: { o: owner, n: name, e: `HEAD:${folder}` } })
    });
    if (!r.ok) throw new HttpError(502, `GitHub list failed (${r.status}).`);
    const j = await r.json();
    if (j.errors?.length && !j.data?.repository) throw new HttpError(502, "GitHub list failed.");
    const entries = j.data?.repository?.object?.entries || [];
    const out = [];
    for (const e of entries) {
      if (!e.name.endsWith(".json") || typeof e.object?.text !== "string") continue;
      try {
        out.push(JSON.parse(e.object.text));
      } catch {
      }
    }
    return out;
  }
  /** Read-modify-write with retries, for files several requests may change at once. */
  async update(path, change, message, known) {
    let cur = known === void 0 ? await this.get(path) : known;
    for (let i = 0; i < 5; i++) {
      const next = change(cur ? cur.data : null);
      const sha = await this.put(path, next, message, cur?.sha);
      if (sha) return { data: next, sha };
      await new Promise((res) => setTimeout(res, 150 * (i + 1)));
      cur = await this.get(path);
    }
    throw new HttpError(503, "The shop is busy. Please try again.");
  }
};
var safeName = (s) => String(s).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 80);
var DAY = 864e5;
function secret(env) {
  const s = env.AUTH_SECRET || "";
  if (s.length < 32) throw new HttpError(500, "AUTH_SECRET must be set to a random value of at least 32 characters.");
  return s;
}
async function signSession(env, email, id, now) {
  const p = b64url(JSON.stringify({ e: email, i: id, x: now + 30 * DAY }));
  return `s1.${p}.${await hmacHex(secret(env), "sess|" + p)}`;
}
async function readSession(env, token, now) {
  if (!token || !token.startsWith("s1.")) return null;
  const [, p, mac] = token.split(".");
  if (!p || !mac || !safeEqual(await hmacHex(secret(env), "sess|" + p), mac)) return null;
  try {
    const j = JSON.parse(unb64url(p));
    return j.x > now && emailOk(j.e) ? { email: j.e, id: j.i } : null;
  } catch {
    return null;
  }
}
var lastSend = /* @__PURE__ */ new Map();
function githubDb(gh, env, now) {
  const cache = /* @__PURE__ */ new Map();
  const custId = async (email) => (await sha256Hex("cust|" + email.toLowerCase())).slice(0, 32);
  const orderPath = (no) => `orders/${safeName(no)}.json`;
  const loadOrder = async (no) => {
    if (!safeName(no)) return null;
    const f = cache.get(no) || await gh.get(orderPath(no));
    if (f) cache.set(no, f);
    return f;
  };
  const admins = () => (env.ADMIN_EMAILS || env.OWNER_EMAIL || "").split(",").map((s) => s.trim().toLowerCase()).filter(emailOk);
  const db = {
    async insertOrder(o) {
      await gh.ensurePrivate();
      const data = { ...o, id: o.order_no, created_at: now().toISOString() };
      const sha = await gh.put(orderPath(o.order_no), data, `Order ${o.order_no} placed`);
      if (!sha) throw new HttpError(503, "Couldn't save the order. Please try again.");
      cache.set(o.order_no, { data, sha });
    },
    async getOrder(by) {
      if (by.order_no) return (await loadOrder(by.order_no))?.data || null;
      if (by.payment_ref) {
        const ref = await gh.get(`refs/${safeName(by.payment_ref)}.json`);
        return ref ? (await loadOrder(ref.data.order_no))?.data || null : null;
      }
      return null;
    },
    async updateOrder(no, patch) {
      const known = await loadOrder(no);
      if (!known) throw new HttpError(404, "Order not found.");
      const what = patch.payment_status === "paid" ? "paid" : patch.status ? `\u2192 ${patch.status}` : patch.payment_ref ? "payment reference" : "updated";
      const next = await gh.update(orderPath(no), (cur) => ({ ...cur || known.data, ...patch }), `Order ${no} ${what}`, known);
      cache.set(no, next);
      if (patch.payment_ref && /^order_[A-Za-z0-9]+$/.test(patch.payment_ref)) await gh.put(`refs/${safeName(patch.payment_ref)}.json`, { order_no: no }, `Razorpay ref for ${no}`).catch(() => null);
      return next.data;
    },
    async isAdmin(email) {
      return admins().includes(email.toLowerCase());
    },
    async getUser(token) {
      return readSession(env, token, now().getTime());
    }
  };
  const customers = {
    id: custId,
    get: async (email) => gh.get(`customers/${await custId(email)}.json`),
    async ensure(email) {
      const have = await customers.get(email);
      if (have) return have.data;
      await gh.ensurePrivate();
      const counter = await gh.update("meta/counter.json", (c2) => ({ next: (c2?.next || 100001) + 1 }), "Next account number");
      const c = { id: await custId(email), account_no: `AC-${counter.data.next - 1}`, email, name: "", phone: "", address: {}, created_at: now().toISOString(), wishlist: [] };
      const sha = await gh.put(`customers/${c.id}.json`, c, `Customer ${c.account_no} signed up`);
      if (!sha) return (await customers.get(email)).data;
      return c;
    },
    async change(email, fn, msg) {
      const path = `customers/${await custId(email)}.json`;
      const known = await gh.get(path);
      if (!known) throw new HttpError(404, "Account not found. Sign in again.");
      return (await gh.update(path, (cur) => fn(cur || known.data), msg, known)).data;
    }
  };
  return { db, customers, admins };
}
var profileOut = (c) => c ? { id: c.id, account_no: c.account_no, email: c.email, name: c.name, phone: c.phone, address: c.address, created_at: c.created_at } : null;
function routes(d, gh, env, store) {
  const now = () => d.now().getTime();
  const need = async (token) => {
    const u = await readSession(env, token, now());
    if (!u) throw new HttpError(401, "Please sign in again.");
    return u;
  };
  const accountsOn = async () => !!(await siteContent(d))?.backend?.accounts;
  const needAccounts = async () => {
    if (!await accountsOn()) throw new HttpError(403, "Customer accounts aren't switched on for this shop.");
  };
  const needAdmin = async (token) => {
    const u = await need(token);
    if (!await store.db.isAdmin(u.email)) throw new HttpError(403, "Only shop admins can do this.");
    return u;
  };
  return {
    // 1. email → 6-digit code. Nothing is stored: the code is checked against a signed challenge.
    "auth-send": async (b) => {
      const email = str(b.email, 200).toLowerCase();
      if (!emailOk(email)) throw new HttpError(400, "Enter a valid email address.");
      const admin2 = await store.db.isAdmin(email);
      if (!admin2 && !await accountsOn()) throw new HttpError(403, "This email can't sign in here.");
      const last = lastSend.get(email) || 0;
      if (now() - last < 45e3) throw new HttpError(429, "Please wait a minute before asking for another code.");
      lastSend.set(email, now());
      const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1e6).padStart(6, "0");
      const p = b64url(JSON.stringify({ e: email, x: now() + 10 * 6e4, n: randHex(12) }));
      const challenge = `c1.${p}.${await hmacHex(secret(env), `otp|${p}|${code}`)}`;
      const c = await siteContent(d).catch(() => ({}));
      const shop = c?.brand?.name || "Shop";
      const ok = await sendEmail(d, [email], `${code} is your ${shop} sign-in code`, wrap(shop, "Your sign-in code", `<p style="font-size:15px">Enter this code to sign in. It works for 10 minutes.</p><p style="font-size:34px;font-weight:700;letter-spacing:8px;font-family:monospace;margin:18px 0">${code}</p><p style="font-size:13px;color:#777">If you didn't ask for this, you can ignore this email.</p>`));
      if (!ok) {
        lastSend.delete(email);
        throw new HttpError(502, "We couldn't send a code. Check the email and try again.");
      }
      return { challenge };
    },
    // 2. challenge + code → 30-day session. Five wrong codes lock that challenge.
    "auth-verify": async (b) => {
      const [tag, p, mac] = String(b.challenge || "").split(".");
      let ch;
      try {
        ch = JSON.parse(unb64url(p));
      } catch {
        throw new HttpError(400, "Ask for a new code.");
      }
      if (tag !== "c1" || !mac || !ch?.n || !emailOk(ch.e)) throw new HttpError(400, "Ask for a new code.");
      if (ch.x < now()) throw new HttpError(400, "That code has expired. Ask for a new one.");
      const failPath = `auth/${safeName(ch.n)}.json`;
      const fails = await gh.get(failPath);
      if ((fails?.data.fails || 0) >= 5) throw new HttpError(429, "Too many wrong codes. Ask for a new one.");
      const code = String(b.code || "").replace(/\D/g, "");
      if (code.length !== 6 || !safeEqual(await hmacHex(secret(env), `otp|${p}|${code}`), mac)) {
        await gh.update(failPath, (c) => ({ fails: (c?.fails || 0) + 1 }), "Failed sign-in attempt", fails).catch(() => null);
        throw new HttpError(400, "That code is wrong or has expired. Try again or ask for a new one.");
      }
      const admin2 = await store.db.isAdmin(ch.e);
      const cust = !(b.admin && admin2) && await accountsOn() ? await store.customers.ensure(ch.e) : (await store.customers.get(ch.e))?.data || null;
      const id = cust?.id || await store.customers.id(ch.e);
      return { token: await signSession(env, ch.e, id, now()), user: { id, email: ch.e }, admin: admin2, profile: profileOut(cust), wishlist: cust?.wishlist || [] };
    },
    me: async (_b, token) => {
      const u = await need(token);
      const admin2 = await store.db.isAdmin(u.email);
      const cust = await accountsOn() ? (await store.customers.get(u.email))?.data || null : null;
      return { user: u, admin: admin2, profile: profileOut(cust), wishlist: cust?.wishlist || [] };
    },
    "profile-update": async (b, token) => {
      await needAccounts();
      const u = await need(token);
      const a = b.address || {};
      const c = await store.customers.change(u.email, (c2) => ({ ...c2, name: str(b.name, 120), phone: str(b.phone, 30), address: { address: str(a.address, 200), city: str(a.city, 80), pin: str(a.pin, 20), state: str(a.state, 80) } }), "Customer details updated");
      return { profile: profileOut(c) };
    },
    wishlist: async (b, token) => {
      await needAccounts();
      const u = await need(token);
      const pid = str(b.product_id, 80);
      if (!pid) throw new HttpError(400, "Missing product.");
      const c = await store.customers.change(u.email, (c2) => {
        const set = new Set(c2.wishlist || []);
        if (b.action === "remove") set.delete(pid);
        else set.add(pid);
        return { ...c2, wishlist: [...set].slice(0, 200) };
      }, "Wishlist updated");
      return { wishlist: c.wishlist };
    },
    "my-orders": async (_b, token) => {
      await needAccounts();
      const u = await need(token);
      const all = await gh.list("orders");
      return { orders: all.filter((o) => o.email.toLowerCase() === u.email).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).map(publicOrder) };
    },
    "admin-data": async (_b, token) => {
      await needAdmin(token);
      const [orders, custs] = await Promise.all([gh.list("orders"), gh.list("customers")]);
      orders.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      custs.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      return { orders, customers: custs.map(profileOut) };
    }
  };
}
async function health(env, f, repo) {
  const e = (k) => String(env[k] ?? "").trim();
  const checks = [];
  const add = (setting, ok2, detail) => checks.push({ setting, ok: ok2, detail });
  let siteOrigin = "";
  const site = e("SITE_URL");
  if (!site) add("SITE_URL", false, "Missing. Set it to your shop's address, e.g. https://iprakashlal.github.io/Myshop/");
  else if (!/^(https:\/\/[^\s]+|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/\S*)$/.test(site)) add("SITE_URL", false, `"${site}" must start with https:// and have no spaces.`);
  else {
    try {
      siteOrigin = new URL(site).origin;
    } catch {
    }
    const base = site.replace(/\/?$/, "/");
    try {
      const r = await f(base + "content.json", { headers: { "cache-control": "no-cache" } });
      if (!r.ok) add("SITE_URL", false, `${base}content.json returned ${r.status}. Check the address (letters are case-sensitive, e.g. /Myshop/) and that the shop is published.`);
      else {
        const c = await r.json().catch(() => null);
        const be = c?.backend || {};
        add("SITE_URL", true, `Shop found at ${base} ("${c?.brand?.name || "Shop"}").`);
        add("Shop CMS backend", !!be.enabled && be.provider === "cloudflare", be.enabled && be.provider === "cloudflare" ? `Backend on, Cloudflare selected, customer sign-in ${be.accounts ? "on" : "off"}.` : "In the shop's admin.html \u2192 Accounts & backend: switch on the backend, choose Cloudflare Worker + GitHub files, paste this Worker's URL, then Save & publish.");
      }
    } catch {
      add("SITE_URL", false, `Couldn't load ${base}content.json.`);
    }
  }
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) add("DATA_REPO", false, `"${e("DATA_REPO")}" should look like iprakashlal/shop-data`);
  else if (!e("GITHUB_TOKEN")) add("GITHUB_TOKEN", false, "Missing. Add the fine-grained token for the data repo as a Secret.");
  else {
    try {
      const r = await f(`https://api.github.com/repos/${repo}`, { headers: { Authorization: `Bearer ${e("GITHUB_TOKEN")}`, Accept: "application/vnd.github+json", "User-Agent": "site-studio-shop" } });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) add("GITHUB_TOKEN", false, "GitHub rejected the token (expired, deleted or copied wrong).");
      else if (r.status === 404) add("DATA_REPO", false, `${repo} not found, or the token doesn't include it (token \u2192 Repository access \u2192 add it).`);
      else if (!r.ok) add("DATA_REPO", false, `GitHub answered ${r.status}.`);
      else if (!j.private) add("DATA_REPO", false, `${repo} is public. Make it private: orders contain customer details.`);
      else if (j.permissions && !j.permissions.push) add("GITHUB_TOKEN", false, "The token can read but not write. Set Contents: Read and write.");
      else add("DATA_REPO + GITHUB_TOKEN", true, `${repo} is private and reachable.`);
    } catch {
      add("DATA_REPO", false, "Couldn't reach GitHub.");
    }
  }
  add("AUTH_SECRET", e("AUTH_SECRET").length >= 32, e("AUTH_SECRET").length >= 32 ? "Set." : "Missing or shorter than 32 characters. Run crypto.randomUUID() + crypto.randomUUID() in a browser console and paste the result as a Secret.");
  add("RESEND_API_KEY", /^re_/.test(e("RESEND_API_KEY")), /^re_/.test(e("RESEND_API_KEY")) ? "Set." : "Missing or not a Resend key (starts with re_). No emails or sign-in codes can be sent without it.");
  const from = e("MAIL_FROM");
  const fromOk = /^[^<>@]*<[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>$/.test(from) || /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(from);
  add("MAIL_FROM", fromOk, !from ? "Missing. Example: My Shop <onboarding@resend.dev>" : !fromOk ? `"${from}" isn't a valid sender. Use exactly: Name <address@domain>, with nothing after the closing >. Example: My Shop <onboarding@resend.dev>` : /onboarding@resend\.dev/i.test(from) ? `${from}. Resend's test sender: emails reach ONLY your own Resend sign-up email. Verify your domain in Resend to email customers.` : from);
  add("OWNER_EMAIL", emailOk(e("OWNER_EMAIL").split(",")[0] || ""), emailOk(e("OWNER_EMAIL").split(",")[0] || "") ? e("OWNER_EMAIL") : "Missing. Your email: gets new-order emails and signs in to Orders.");
  const ok = checks.every((c) => c.ok);
  const body = {
    status: ok ? "Ready. The shop can use this Worker." : "Not ready. Fix the settings marked ok: false under Settings \u2192 Variables and Secrets, press Deploy, then reload this page.",
    shop_pages_allowed_from: [siteOrigin, ...e("ALLOWED_ORIGINS").split(",").map((s) => s.trim())].filter(Boolean),
    checks
  };
  return new Response(JSON.stringify(body, null, 2), { status: ok ? 200 : 500, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
var lastMailTest = 0;
async function mailTest(env, f) {
  const e = (k) => String(env[k] ?? "").trim();
  const out = (o, status2 = 200) => new Response(JSON.stringify(o, null, 2), { status: status2, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
  const to = e("OWNER_EMAIL").split(",")[0].trim();
  if (!emailOk(to)) return out({ sent: false, problem: "Set OWNER_EMAIL first: the test email goes there." }, 400);
  if (Date.now() - lastMailTest < 3e4) return out({ sent: false, problem: "Wait 30 seconds between tests." }, 429);
  lastMailTest = Date.now();
  const r = await f("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${e("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: e("MAIL_FROM"), to: [to], subject: "Shop email test", html: "<p>If you can read this, your shop can send emails.</p>" })
  }).catch(() => null);
  if (!r) return out({ sent: false, problem: "Couldn't reach Resend." }, 502);
  const text = await r.text().catch(() => "");
  let msg = text;
  try {
    msg = JSON.parse(text).message || text;
  } catch {
  }
  const hint = r.ok ? `Sent to ${to}. Check the inbox (and spam).` : /own email|testing emails/i.test(msg) ? "Resend's test sender (onboarding@resend.dev) only delivers to the email you signed up to Resend with. Set OWNER_EMAIL to that email and sign in with it, or verify your own domain in Resend and change MAIL_FROM to an address on it." : /domain is not verified|not verified/i.test(msg) ? "The domain in MAIL_FROM isn't verified in Resend. Finish Resend \u2192 Domains, or use My Shop <onboarding@resend.dev> for testing." : /api key|unauthori|forbidden|invalid/i.test(msg) || r.status === 401 || r.status === 403 ? "RESEND_API_KEY is wrong, deleted or lacks sending access. Create a new key in Resend \u2192 API Keys (Sending access, All domains) and replace the secret." : /from/i.test(msg) ? "MAIL_FROM is malformed. Use exactly: My Shop <onboarding@resend.dev>" : "See Resend's message above.";
  return out({ sent: r.ok, to, from: e("MAIL_FROM"), resend_status: r.status, resend_says: msg, what_to_do: hint }, r.ok ? 200 : 500);
}
var shop_worker_default = {
  async fetch(req, env) {
    const e = (k) => String(env[k] ?? "").trim();
    const f = (...a) => fetch(...a);
    const now = () => /* @__PURE__ */ new Date();
    const repo = e("DATA_REPO").replace(/^https:\/\/github\.com\//, "").replace(/\/+$/, "");
    const origin = req.headers.get("origin") || "*";
    const fail = (msg) => new Response(JSON.stringify({ error: msg }), { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "authorization, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", Vary: "Origin" } });
    if (req.method === "GET" && new URL(req.url).searchParams.has("mailtest")) return mailTest(env, f);
    if (req.method === "GET") return health(env, f, repo);
    if (req.method === "POST") {
      if (!/^(https:\/\/\S+|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/\S*)$/.test(e("SITE_URL"))) return fail("The shop server isn't set up: SITE_URL is missing or doesn't start with https://. Open the Worker's address in a browser to see what to fix.");
      if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || !e("GITHUB_TOKEN")) return fail("The shop server isn't set up: add DATA_REPO and GITHUB_TOKEN in the Worker's settings. Open the Worker's address in a browser to see what to fix.");
    }
    const gh = new GitHub(repo, e("GITHUB_TOKEN"), f);
    const store = githubDb(gh, env, now);
    const d = { db: store.db, env: e, fetch: f, now };
    try {
      return await makeHandler(d, routes(d, gh, env, store))(req);
    } catch (x) {
      console.error(x);
      return fail("The shop server hit an error. Open the Worker's address in a browser to check its settings.");
    }
  }
};
var _test = { b64, unb64, readSession, signSession };
export {
  _test,
  shop_worker_default as default
};
