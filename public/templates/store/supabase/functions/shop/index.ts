// Shop server function for Site Studio shops (Supabase Edge Function, Deno).
// The same code is bundled into cloudflare/worker.js for the Cloudflare + GitHub backend.
//
// Routes (POST, JSON):
//   /shop/create-order       price the cart from the live content.json, save the order, start payment
//   /shop/razorpay-verify    confirm a Razorpay Checkout payment from the browser
//   /shop/razorpay-webhook   Razorpay → payment.captured / order.paid
//   /shop/stripe-webhook     Stripe → checkout.session.completed
//   /shop/status             order status for the shopper who placed it (order number + access key)
//   /shop/upi-reference      shopper reports a UPI/PayPal transaction ID; owner is asked to verify
//   /shop/admin              shop admins: mark-paid, set-status
//
// Secrets (Dashboard → Edge Functions → Secrets):
//   SITE_URL                 https://you.github.io/shop/   (where content.json lives)
//   RESEND_API_KEY, MAIL_FROM  e.g. "Fieldnote Goods <orders@yourdomain.com>"
//   OWNER_EMAIL              where new-order emails go (comma-separate several)
//   RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET   (if using Razorpay)
//   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET                        (if using Stripe)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
//
// Deploy with "Verify JWT" switched OFF: webhooks don't send a Supabase login. The admin
// route checks the caller's login itself.

// ---------------------------------------------------------------- types
export type Order = {
  id?: string; order_no: string; access_key: string; user_id: string | null; email: string; name: string; phone: string;
  address: Record<string, string>; notes: string; items: Item[]; totals: Totals; currency: string; method: string;
  payment_status: "unpaid" | "paid" | "cod" | "refunded"; status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  payment_ref: string | null; paid_at: string | null; notify_log: { at: string; what: string; ok: boolean }[]; created_at?: string;
};
export type Item = { id: string; name: string; opt: string; qty: number; price: number };
export type Totals = { sub: number; ship: number; taxAdd: number; taxIn: number; total: number };
export type Db = {
  insertOrder(o: Order): Promise<void>;
  getOrder(by: { order_no?: string; payment_ref?: string }): Promise<Order | null>;
  updateOrder(order_no: string, patch: Partial<Order>): Promise<Order>;
  isAdmin(email: string): Promise<boolean>;
  getUser(token: string): Promise<{ id: string; email: string } | null>;
};
export type Deps = { db: Db; env: (k: string) => string; fetch: typeof fetch; now: () => Date };

// ---------------------------------------------------------------- small helpers
const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
export async function hmacHex(secret: string, msg: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, enc.encode(msg)));
}
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
export const randHex = (n: number) => hex(crypto.getRandomValues(new Uint8Array(n)).buffer);
export const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
export const str = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);
export const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const vpaOk = (v: string) => /^[A-Za-z0-9.\-_]{2,256}@[A-Za-z][A-Za-z0-9.\-]{1,63}$/.test(String(v || "").trim());
const ppOk = (v: string) => /^[A-Za-z0-9]{1,40}$/.test(String(v || "").trim());
export const round2 = (n: number) => Math.round(n * 100) / 100;

export function money(v: number, cur: string): string {
  try {
    return new Intl.NumberFormat(cur === "INR" ? "en-IN" : "en-US", { style: "currency", currency: cur, maximumFractionDigits: v % 1 ? 2 : 0 }).format(v);
  } catch {
    return `${cur} ${v}`;
  }
}

/** Same formula as the shop's cart page, so shoppers see the exact amount they're charged. */
export function computeTotals(items: Item[], s: any): Totals {
  const sub = round2(items.reduce((t, i) => t + i.price * i.qty, 0));
  const free = Number(s.freeShippingOver) > 0 && sub >= Number(s.freeShippingOver);
  const ship = !items.length || free ? 0 : Number(s.shippingFee) || 0;
  const pct = Number(s.taxPercent) || 0;
  const taxAdd = pct && !s.taxIncluded ? Math.round(sub * pct) / 100 : 0;
  const taxIn = pct && s.taxIncluded ? round2(sub - sub / (1 + pct / 100)) : 0;
  return { sub, ship, taxAdd, taxIn, total: round2(sub + ship + taxAdd) };
}

export function methodsFor(c: any): string[] {
  const P = c.payments || {}, out: string[] = [];
  if (P.upi?.enabled && vpaOk(P.upi.vpa) && c.settings?.currency === "INR") out.push("upi");
  if (P.razorpay?.enabled) out.push("razorpay");
  if (P.stripe?.enabled) out.push("stripe");
  if (P.paypal?.enabled && ppOk(P.paypal.username)) out.push("paypal");
  if (P.cod?.enabled) out.push("cod");
  return out;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

// ---------------------------------------------------------------- site content (cached briefly)
let contentCache: { at: number; data: any } | null = null;
export async function siteContent(d: Deps): Promise<any> {
  if (contentCache && d.now().getTime() - contentCache.at < 60_000) return contentCache.data;
  const base = d.env("SITE_URL").replace(/\/?$/, "/");
  if (!/^https?:\/\//.test(base)) throw new HttpError(500, "SITE_URL secret is not set.");
  const r = await d.fetch(base + "content.json", { headers: { "cache-control": "no-cache" } });
  if (!r.ok) throw new HttpError(502, "Couldn't load the shop's catalogue.");
  const data = await r.json();
  contentCache = { at: d.now().getTime(), data };
  return data;
}
export const _resetCache = () => { contentCache = null; };

// ---------------------------------------------------------------- email
function orderTable(o: Order): string {
  const rows = o.items.map((i) => `<tr><td style="padding:6px 0">${esc(i.name)}${i.opt ? ` <span style="color:#777">(${esc(i.opt)})</span>` : ""} × ${i.qty}</td><td style="padding:6px 0;text-align:right">${esc(money(i.price * i.qty, o.currency))}</td></tr>`).join("");
  const t = o.totals;
  const line = (l: string, v: string, b = false) => `<tr><td style="padding:4px 0;${b ? "font-weight:700;border-top:1px solid #ddd;padding-top:8px" : "color:#555"}">${l}</td><td style="padding:4px 0;text-align:right;${b ? "font-weight:700;border-top:1px solid #ddd;padding-top:8px" : ""}">${v}</td></tr>`;
  return `<table style="width:100%;border-collapse:collapse;font-size:14px">${rows}${line("Subtotal", esc(money(t.sub, o.currency)))}${line("Shipping", t.ship ? esc(money(t.ship, o.currency)) : "Free")}${t.taxAdd ? line("Tax", esc(money(t.taxAdd, o.currency))) : ""}${line("Total", esc(money(t.total, o.currency)), true)}</table>`;
}
export function wrap(shop: string, title: string, body: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f4f2;font-family:Arial,Helvetica,sans-serif;color:#1b1a17"><div style="max-width:560px;margin:0 auto;padding:24px"><div style="background:#fff;border-radius:12px;padding:28px"><p style="margin:0 0 4px;font-size:13px;color:#777">${esc(shop)}</p><h1 style="margin:0 0 16px;font-size:22px">${esc(title)}</h1>${body}</div><p style="font-size:12px;color:#888;text-align:center;margin-top:16px">${esc(shop)}</p></div></body></html>`;
}
const addr = (o: Order) => [o.address.address, [o.address.city, o.address.pin].filter(Boolean).join(" "), o.address.state].filter(Boolean).map(esc).join("<br>");

export async function sendEmail(d: Deps, to: string[], subject: string, html: string, replyTo?: string): Promise<boolean> {
  const key = d.env("RESEND_API_KEY"), from = d.env("MAIL_FROM");
  if (!key || !from || !to.length) return false;
  const r = await d.fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
  }).catch(() => null);
  return !!r && r.ok;
}
const owners = (d: Deps) => d.env("OWNER_EMAIL").split(",").map((s) => s.trim()).filter(emailOk);

async function notify(d: Deps, o: Order, kind: "paid" | "cod" | "awaiting" | "reported" | "shipped" | "delivered" | "cancelled"): Promise<Order["notify_log"]> {
  const c = await siteContent(d).catch(() => ({}));
  const shop = c?.brand?.name || "Shop";
  const site = d.env("SITE_URL").replace(/\/?$/, "/");
  const own = owners(d);
  const log: Order["notify_log"] = [];
  const track = c?.backend?.accounts ? `<p style="font-size:14px">Track it any time in <a href="${esc(site)}account.html">your account</a> using ${esc(o.email)}.</p>` : "";
  const cust = async (subject: string, title: string, intro: string) => {
    const ok = await sendEmail(d, [o.email], subject, wrap(shop, title, `<p style="font-size:15px">${intro}</p><p style="font-size:14px;color:#555">Order <b>${esc(o.order_no)}</b></p>${orderTable(o)}${track}`), own[0]);
    log.push({ at: d.now().toISOString(), what: `customer:${kind}`, ok });
  };
  const owner = async (subject: string, title: string) => {
    if (!own.length) return;
    const ok = await sendEmail(d, own, subject, wrap(shop, title, `<p style="font-size:15px"><b>${esc(o.name)}</b> · ${esc(o.email)}${o.phone ? ` · ${esc(o.phone)}` : ""}</p><p style="font-size:14px;color:#555">Order <b>${esc(o.order_no)}</b> · ${esc(o.method)} · payment ${esc(o.payment_status)}</p>${orderTable(o)}${addr(o) ? `<p style="font-size:14px"><b>Deliver to</b><br>${addr(o)}</p>` : ""}${o.notes ? `<p style="font-size:14px"><b>Notes</b><br>${esc(o.notes)}</p>` : ""}`), o.email);
    log.push({ at: d.now().toISOString(), what: `owner:${kind}`, ok });
  };
  if (kind === "paid") {
    await cust(`Order ${o.order_no} confirmed`, "Payment received, thank you", `Hi ${esc(o.name)}, we've received your payment of <b>${esc(money(o.totals.total, o.currency))}</b>. We'll let you know when your order ships.`);
    await owner(`Paid order ${o.order_no} · ${money(o.totals.total, o.currency)}`, "New paid order");
  } else if (kind === "cod") {
    await cust(`Order ${o.order_no} confirmed`, "Order confirmed", `Hi ${esc(o.name)}, your order is confirmed. Please keep <b>${esc(money(o.totals.total, o.currency))}</b> ready to pay on delivery.`);
    await owner(`New cash-on-delivery order ${o.order_no}`, "New order (cash on delivery)");
  } else if (kind === "awaiting") {
    await owner(`New order ${o.order_no} awaiting ${o.method.toUpperCase()} payment`, "New order: check for payment");
  } else if (kind === "reported") {
    const via = o.method === "paypal" ? "PayPal" : "UPI";
    await cust(`Payment reference received for order ${o.order_no}`, "We've got your payment reference", `Hi ${esc(o.name)}, thanks for paying <b>${esc(money(o.totals.total, o.currency))}</b> by ${via}. Your reference is <b>${esc(o.payment_ref)}</b>. We'll email you again as soon as we've confirmed it.`);
    if (own.length) {
      const ok = await sendEmail(d, own, `Check ${via} payment for ${o.order_no}: ref ${o.payment_ref}`, wrap(shop, `Customer says they've paid by ${via}`, `<p style="font-size:15px"><b>${esc(o.name)}</b> reports paying <b>${esc(money(o.totals.total, o.currency))}</b> for order <b>${esc(o.order_no)}</b>.</p><p style="font-size:15px">Reference: <b style="font-family:monospace;font-size:17px">${esc(o.payment_ref)}</b></p><p style="font-size:14px">Find this reference in your ${via} app. If the amount matches, open <a href="${esc(site)}admin.html">the shop CMS → Orders</a> and tap <b>Mark paid</b>. You and the customer then get the confirmation email.</p>${orderTable(o)}`), o.email);
      log.push({ at: d.now().toISOString(), what: "owner:reported", ok });
    }
  } else {
    const words = { shipped: ["has shipped", "Your order is on its way."], delivered: ["was delivered", "Your order has been delivered. We hope you love it."], cancelled: ["was cancelled", "Your order has been cancelled. Reply to this email if you have questions."] }[kind];
    await cust(`Order ${o.order_no} ${words[0]}`, `Order ${words[0]}`, `Hi ${esc(o.name)}, ${words[1]}`);
  }
  return log;
}

// ---------------------------------------------------------------- payments
async function markPaid(d: Deps, o: Order, ref: string | null): Promise<Order> {
  if (o.payment_status === "paid") return o; // webhooks and the browser may both report the same payment
  let next = await d.db.updateOrder(o.order_no, { payment_status: "paid", paid_at: d.now().toISOString(), status: o.status === "pending" ? "processing" : o.status, ...(ref ? { payment_ref: ref } : {}) });
  const log = await notify(d, next, "paid");
  next = await d.db.updateOrder(o.order_no, { notify_log: [...(next.notify_log || []), ...log] });
  return next;
}

async function razorpayOrder(d: Deps, o: Order): Promise<{ id: string }> {
  const id = d.env("RAZORPAY_KEY_ID"), secret = d.env("RAZORPAY_KEY_SECRET");
  if (!id || !secret) throw new HttpError(500, "Razorpay keys are not set on the server.");
  const r = await d.fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { Authorization: "Basic " + btoa(`${id}:${secret}`), "Content-Type": "application/json" },
    body: JSON.stringify({ amount: Math.round(o.totals.total * 100), currency: o.currency, receipt: o.order_no, notes: { order_no: o.order_no } }),
  });
  if (!r.ok) throw new HttpError(502, "Razorpay couldn't start the payment.");
  return r.json();
}

async function stripeSession(d: Deps, o: Order): Promise<{ id: string; url: string }> {
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
    "payment_intent_data[metadata][order_no]": o.order_no,
  });
  const r = await d.fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" }, body: f.toString() });
  if (!r.ok) throw new HttpError(502, "Stripe couldn't start the payment.");
  return r.json();
}

// ---------------------------------------------------------------- routes
async function createOrder(d: Deps, body: any, token: string | null) {
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
  const items: Item[] = [];
  for (const raw of body.items) {
    const p = (c.products || []).find((x: any) => x.id === raw?.id);
    if (!p) throw new HttpError(409, "A product in your cart is no longer available. Please review your cart.");
    if (p.stock === "out") throw new HttpError(409, `${p.name} is sold out. Please remove it from your cart.`);
    const qty = Math.floor(Number(raw.qty));
    if (!(qty >= 1 && qty <= maxQty)) throw new HttpError(400, `You can order up to ${maxQty} of each item.`);
    const opt = str(raw.opt, 60);
    if (opt && !(p.options || []).includes(opt)) throw new HttpError(409, `The option “${opt}” for ${p.name} has changed. Please add it to your cart again.`);
    items.push({ id: p.id, name: str(p.name, 160), opt, qty, price: round2(Number(p.price) || 0) });
  }
  const totals = computeTotals(items, S);
  if (Number(S.minOrder) > 0 && totals.sub < Number(S.minOrder)) throw new HttpError(400, `The minimum order is ${money(Number(S.minOrder), cur)}.`);

  const now = d.now();
  const pre = String(S.orderPrefix || "ORD").replace(/[^A-Za-z0-9]/g, "").slice(0, 6).toUpperCase() || "ORD";
  const order: Order = {
    order_no: `${pre}-${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}-${randHex(3).toUpperCase()}`,
    access_key: randHex(16),
    user_id: user?.id || null,
    email, name,
    phone: str(cust.phone, 30),
    address: { address: str(cust.address, 200), city: str(cust.city, 80), pin: str(cust.pin, 20), state: str(cust.state, 80) },
    notes: str(cust.notes, 1000),
    items, totals, currency: cur, method,
    payment_status: method === "cod" ? "cod" : "unpaid",
    status: method === "cod" ? "processing" : "pending",
    payment_ref: null, paid_at: null, notify_log: [],
  };
  await d.db.insertOrder(order);

  const out: any = { order_no: order.order_no, access_key: order.access_key, totals, currency: cur, method, items };
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

export const publicOrder = (o: Order) => ({ order_no: o.order_no, status: o.status, payment_status: o.payment_status, totals: o.totals, currency: o.currency, items: o.items, method: o.method, created_at: o.created_at, reported: (o.method === "upi" || o.method === "paypal") && !!o.payment_ref });

async function upiReference(d: Deps, b: any) {
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
  next = await d.db.updateOrder(o.order_no, { notify_log: [...(next.notify_log || []), ...log] });
  return publicOrder(next);
}

async function razorpayVerify(d: Deps, b: any) {
  const o = await d.db.getOrder({ order_no: str(b.order_no, 40) });
  if (!o || o.payment_ref !== b.razorpay_order_id) throw new HttpError(404, "Order not found.");
  if (!d.env("RAZORPAY_KEY_SECRET")) throw new HttpError(500, "Razorpay keys are not set on the server.");
  const expect = await hmacHex(d.env("RAZORPAY_KEY_SECRET"), `${b.razorpay_order_id}|${b.razorpay_payment_id}`);
  if (!safeEqual(expect, String(b.razorpay_signature || ""))) throw new HttpError(400, "The payment couldn't be verified.");
  return publicOrder(await markPaid(d, o, null));
}

async function razorpayWebhook(d: Deps, raw: string, sig: string) {
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

async function stripeWebhook(d: Deps, raw: string, header: string) {
  const secret = d.env("STRIPE_WEBHOOK_SECRET");
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = Number(parts.t);
  if (!secret || !t || Math.abs(d.now().getTime() / 1000 - t) > 300) throw new HttpError(400, "Bad signature");
  const expect = await hmacHex(secret, `${parts.t}.${raw}`);
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

async function status(d: Deps, b: any) {
  const o = await d.db.getOrder({ order_no: str(b.order_no, 40) });
  if (!o || !safeEqual(o.access_key, String(b.access_key || ""))) throw new HttpError(404, "Order not found.");
  return publicOrder(o);
}

async function admin(d: Deps, b: any, token: string | null) {
  const user = token ? await d.db.getUser(token) : null;
  if (!user || !(await d.db.isAdmin(user.email))) throw new HttpError(403, "Only shop admins can do this.");
  const o = await d.db.getOrder({ order_no: str(b.order_no, 40) });
  if (!o) throw new HttpError(404, "Order not found.");
  if (b.action === "mark-paid") return { order: await markPaid(d, o, str(b.ref, 100) || null) };
  if (b.action === "set-status") {
    const st = String(b.status);
    if (!["pending", "processing", "shipped", "delivered", "cancelled"].includes(st)) throw new HttpError(400, "Unknown status.");
    let next = await d.db.updateOrder(o.order_no, { status: st as Order["status"] });
    if (st !== o.status && (st === "shipped" || st === "delivered" || st === "cancelled")) {
      const log = await notify(d, next, st);
      next = await d.db.updateOrder(o.order_no, { notify_log: [...(next.notify_log || []), ...log] });
    }
    return { order: next };
  }
  throw new HttpError(400, "Unknown action.");
}

// ---------------------------------------------------------------- HTTP
/** Extra routes (used by the Cloudflare Worker build) run with the same CORS and error handling. */
export type Route = (body: any, token: string | null) => Promise<unknown>;

export function makeHandler(d: Deps, extra: Record<string, Route> = {}) {
  return async (req: Request): Promise<Response> => {
    const site = d.env("SITE_URL");
    const allowed = [site ? new URL(site).origin : "", ...d.env("ALLOWED_ORIGINS").split(",").map((s) => s.trim())].filter(Boolean);
    const origin = req.headers.get("origin") || "";
    const cors: Record<string, string> = {
      "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : allowed[0] || "*",
      "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      Vary: "Origin",
    };
    const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (req.method !== "POST") return json(405, { error: "Use POST." });
    const route = new URL(req.url).pathname.split("/").filter(Boolean).pop() || "";
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    try {
      const raw = await req.text();
      if (raw.length > 100_000) throw new HttpError(413, "Request too large.");
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

// ---------------------------------------------------------------- Supabase wiring
async function realDeps(): Promise<Deps> {
  const { createClient } = await import("npm:@supabase/supabase-js@2.45.4");
  const env = (k: string) => Deno.env.get(k) || "";
  const sb = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const db: Db = {
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
      return data as Order | null;
    },
    async updateOrder(order_no, patch) {
      const { data, error } = await sb.from("orders").update(patch).eq("order_no", order_no).select("*").single();
      if (error) throw new Error(error.message);
      return data as Order;
    },
    async isAdmin(email) {
      const { data } = await sb.from("shop_admins").select("email");
      return (data || []).some((r: { email: string }) => r.email.toLowerCase() === email.toLowerCase());
    },
    async getUser(token) {
      const { data } = await sb.auth.getUser(token);
      return data?.user ? { id: data.user.id, email: (data.user.email || "").toLowerCase() } : null;
    },
  };
  return { db, env, fetch: (...a) => fetch(...a), now: () => new Date() };
}

// deno-lint-ignore no-explicit-any
const D = (globalThis as any).Deno;
if (D && !D.env.get("SHOP_TEST")) {
  let handler: ((req: Request) => Promise<Response>) | null = null;
  D.serve(async (req: Request) => (handler ||= makeHandler(await realDeps()))(req));
}
