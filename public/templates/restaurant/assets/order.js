/* Order now page (order.html) of the restaurant template: delivery, pickup or at the table.
   The menu with search and filters, a sheet to customise a dish, the cart with offers, charges and tax,
   checkout with address and time, and a confirmation the guest can track.
   rest.js draws the page around it and passes its helpers in (RestOrder.page(api) / RestOrder.bind(api)).
   Nothing here needs a server: the cart, favourites, details and past orders stay on the guest's device.
   The order reaches the restaurant through the site's enquiry inbox when it has one, and on WhatsApp. */
(function () {
  "use strict";
  let A, C, D = [];
  const KEY = "site-order:" + location.pathname.replace(/[^/]*$/, "");
  const st = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(KEY + ":" + k)); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(KEY + ":" + k, JSON.stringify(v)); } catch (e) {} },
  };
  const $ = (s, c = document) => c.querySelector(s), $$ = (s, c = document) => [...c.querySelectorAll(s)];
  let cart = st.get("cart", []);
  const favs = new Set(st.get("favs", []));
  const ui = {
    mode: st.get("mode", ""), q: "", diet: "", fav: false, shut: {}, sheet: null, drawer: "", coupon: st.get("coupon", ""), couponMsg: "", tip: 0, err: "", busy: false, done: null, back: null,
    form: Object.assign({ name: "", phone: "", email: "", line1: "", area: "", landmark: "", pin: "", label: "Home", table: "", when: "", pay: "", notes: "", cutlery: false }, st.get("me", {}), { when: "", notes: "" }),
  };
  try { const t = new URLSearchParams(location.search).get("table"); if (t) { ui.form.table = t.slice(0, 12); ui.table = true; } } catch (e) {}

  /** What the site's database offers this page: a WhatsApp code for the guest's number, and online payment (its public key id). */
  let can = { otp: false, pts: false, rz: "", pg: [] }, canAsked = false;
  /** Gateways other than Razorpay: the guest pays on the gateway's own page and comes back here. */
  const GW = { cf: { key: "cashfree", name: "Cashfree", label: "Pay online with Cashfree (UPI, card, netbanking)" }, pe: { key: "phonepe", name: "PhonePe", label: "Pay with PhonePe (UPI, card, netbanking)" }, st: { key: "stripe", name: "Stripe", label: "Pay by card (Stripe)" }, pp: { key: "paypal", name: "PayPal", label: "Pay with PayPal" } };
  const digits = (v) => String(v || "").replace(/\D/g, "").slice(-10);
  const verified = () => !!(ui.otp && ui.otp.token && ui.otp.phone === digits(ui.form.phone) && +ui.otp.token.split(".")[0] > Date.now() + 60000);
  const esc = (s) => A.esc(s);
  const num = (p) => { const n = parseFloat(String(p == null ? "" : p).replace(/[^\d.]/g, "")); return isFinite(n) ? n : NaN; };
  /** An amount as plain text (messages), and for the page. */
  const txt = (n) => A.money((Math.round(n * 100) / 100).toFixed(Math.round(n * 100) % 100 ? 2 : 0));
  const fmt = (n) => A.esc(txt(n));
  const O = () => C.ordering || {};
  const SV = {
    heart: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 20.5s-7.5-4.4-7.5-10A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 7.5 2.9c0 5.600-7.500 10-7.500 10z"/></svg>',
    bag: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
    x: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    clock: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.500V12l3 2"/></svg>',
    list: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5 7h14M5 12h10M5 17h6"/></svg>',
    chev: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>',
  };

  /* ---------- the dishes that can be ordered ---------- */
  const optOf = (s) => { const t = String(s || ""), i = t.lastIndexOf("="); const label = (i > 0 ? t.slice(0, i) : t).trim(), p = i > 0 ? num(t.slice(i + 1)) : 0; return label ? { label, price: isNaN(p) ? 0 : p } : null; };
  const groupsOf = (d) => (Array.isArray(d.addons) ? d.addons : []).map((g) => ({ title: String((g && g.title) || "Extras"), max: Math.max(0, +(g && g.max) || 0), need: !!(g && g.required), opts: ((g && g.options) || []).map(optOf).filter(Boolean) })).filter((g) => g.opts.length);
  function load() {
    D = [];
    A.cats().forEach((c) => c.items.forEach((d) => {
      if (d.noOrder) return;
      // sizes, varieties (one must be chosen), or every variety in every size: worked out by the site's script
      const CH = A.choices ? A.choices(d) : null, V = CH ? CH.list : (d.variants || []).filter((v) => v && v.label && !isNaN(num(v.price))).map((v) => ({ label: String(v.label), price: num(v.price) })), base = num(d.price);
      if (isNaN(base) && !V.length) return;
      D.push({ id: A.slug(c.name) + "/" + A.slug(d.name), cat: c, d, V, need: !!(CH && CH.need), G: groupsOf(d), base: V.length ? Math.min.apply(null, V.map((v) => v.price)) : base });
    }));
    // A dish taken off the menu (or sold out) leaves the cart.
    const ok = new Set(D.filter((x) => !x.d.soldOut).map((x) => x.id)), n = cart.length;
    cart = cart.filter((l) => ok.has(l.id)); if (cart.length !== n) st.set("cart", cart);
  }
  const byId = (id) => D.find((x) => x.id === id);
  const qtyOf = (id) => cart.reduce((n, l) => n + (l.id === id ? l.qty : 0), 0);
  const count = () => cart.reduce((n, l) => n + l.qty, 0);
  const save = () => st.set("cart", cart);

  /* ---------- how the order is taken, and when ---------- */
  const MODES = { delivery: "Delivery", pickup: "Pick up", dinein: "At the table" };
  const modes = () => { const m = O().modes || {}, l = ["delivery", "pickup", "dinein"].filter((k) => m[k]); return l.length ? l : ["pickup"]; };
  const mode = () => { const l = modes(); return ui.table && l.includes("dinein") && !ui.modePicked ? "dinein" : l.includes(ui.mode) ? ui.mode : l[0]; };
  const lead = () => Math.max(0, +(mode() === "delivery" ? O().deliveryMins : mode() === "pickup" ? O().pickupMins : O().dineMins) || 0);
  /** ASAP (when open now) and the times a guest can ask for, from the opening hours. Values: "asap" or "<days ahead>:<minute of day>". */
  function slots() {
    const H = C.hours || {}, Dd = A.weekDays(), out = [], s = A.openState(), ck = A.clock(), L = lead(), step = Math.max(10, +O().slotMins || 30);
    if (!Dd.length) return [{ v: "asap", label: "As soon as possible" + (L ? ` (about ${L} min)` : "") }];
    if (s && s.open) out.push({ v: "asap", label: "As soon as possible" + (L ? ` (about ${L} min)` : "") });
    if (O().schedule === false || mode() === "dinein") return out;
    const ahead = Math.max(0, Math.min(6, +O().daysAhead || 1));
    for (let k = 0; k <= ahead; k++) {
      const i = (ck.day + k) % 7, name = k === 0 ? "Today" : k === 1 ? "Tomorrow" : (Dd[i] || {}).day || "";
      for (const [a, b] of A.periods(Dd[i])) {
        const from = Math.max(a + L, k === 0 ? ck.min + L + step / 2 : 0);
        for (let t = Math.ceil(from / step) * step; t <= b; t += step) out.push({ v: k + ":" + t, label: `${name}, ${A.fmtTime(A.hhmm(t % 1440))}` });
      }
    }
    return out.slice(0, 80);
  }
  const whenLabel = (v, list) => ((list || slots()).find((s) => s.v === v) || {}).label || "";

  /* ---------- the bill ---------- */
  const coupons = () => (O().coupons || []).filter((c) => c && c.on !== false && String(c.code || "").trim() && +c.value > 0);
  /** Delivery areas: one per line, a PIN code or an area name, with its own fee after "=" when it differs. */
  function areaFor(pin, area) {
    const lines = String(O().areas || "").split(/\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return { ok: true, fee: null };
    const p = String(pin || "").replace(/\D/g, ""), a = String(area || "").trim().toLowerCase();
    for (const l of lines) {
      const i = l.lastIndexOf("="), key = (i > 0 ? l.slice(0, i) : l).trim().toLowerCase(), fee = i > 0 ? num(l.slice(i + 1)) : NaN;
      if (!key) continue;
      if (/^\d{4,}$/.test(key) ? key === p : a && (a.includes(key) || key.includes(a))) return { ok: true, fee: isNaN(fee) ? null : fee };
    }
    return { ok: false, fee: null };
  }
  const loy = () => { const L = (C && C.loyalty) || {}; return { on: !!L.on, earn: Math.max(0, +L.earn || 0) }; };
  /** A verified guest's points, asked from the site's database (it answers only with the proof of the number). */
  async function loadPts() {
    const be = A.backend(); if (!loy().on || !be || !be.cf || !verified()) return;
    try { const r = await fetch(be.cf + "/points/" + encodeURIComponent(be.site), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: ui.form.phone, otp: ui.otp.token }) }); if (r.ok) { ui.pts = await r.json(); over(true); } } catch (e) { /* points are a bonus: ordering carries on */ }
  }
  function bill() {
    const o = O(), m = mode(), sub = cart.reduce((n, l) => n + l.unit * l.qty, 0);
    const cp = coupons().find((c) => String(c.code).trim().toUpperCase() === String(ui.coupon || "").trim().toUpperCase());
    let disc = 0, cpNote = "";
    if (cp) { if (sub < (+cp.min || 0)) cpNote = `Add ${txt((+cp.min || 0) - sub)} more to use ${String(cp.code).toUpperCase()}.`; else disc = Math.min(sub, cp.kind === "flat" ? +cp.value : Math.min((sub * +cp.value) / 100, +cp.max > 0 ? +cp.max : Infinity)); }
    disc = Math.round(disc * 100) / 100;
    const pack = m === "dinein" ? 0 : Math.max(0, +o.packing || 0);
    const ar = m === "delivery" ? areaFor(ui.form.pin, ui.form.area) : { ok: true, fee: null };
    const free = +o.freeAbove > 0 && sub - disc >= +o.freeAbove;
    const del = m !== "delivery" || !cart.length ? 0 : free ? 0 : Math.max(0, ar.fee != null ? ar.fee : +o.deliveryFee || 0);
    // Points (content.loyalty): a guest whose number is verified can pay part of the bill with theirs; the database works it out the same way.
    const P = ui.pts, L = loy(); let pts = 0, ptsOff = 0;
    if (L.on && P && ui.usePts && verified() && P.points >= Math.max(1, P.min || 0) && P.worth > 0 && sub - disc > 0) { pts = Math.max(0, Math.min(Math.floor(P.points), Math.floor(((sub - disc) * P.maxPct) / 100 / P.worth))); ptsOff = Math.round(pts * P.worth * 100) / 100; }
    const earn = L.on && L.earn > 0 ? Math.floor(((sub - disc - ptsOff) / 100) * L.earn) : 0;
    const base = sub - disc - ptsOff + (cart.length ? pack : 0), pct = Math.max(0, +o.taxPercent || 0);
    const tax = o.taxIncluded || !pct ? 0 : Math.round(base * pct) / 100;
    const tip = o.tips !== false && m !== "pickup" ? Math.max(0, +ui.tip || 0) : 0;
    const raw = base + tax + del + tip, total = o.roundOff === false ? Math.round(raw * 100) / 100 : Math.round(raw);
    const min = m === "dinein" ? 0 : Math.max(0, +o.minOrder || 0);
    return { pts, ptsOff, earn, sub, disc, code: cp && disc ? String(cp.code).trim().toUpperCase() : "", cpNote, pack: cart.length ? pack : 0, del, free: m === "delivery" && free, tax, pct, tip, round: Math.round((total - raw) * 100) / 100, total, min, short: Math.max(0, min - sub), area: ar };
  }
  const billRows = (b, o) => {
    const r = [["Item total", fmt(b.sub)]];
    if (b.disc) r.push([`Discount (${esc(b.code)})`, "− " + fmt(b.disc), "good"]);
    if (b.ptsOff) r.push([`Points used (${b.pts})`, "− " + fmt(b.ptsOff), "good"]);
    if (b.pack) r.push(["Packing", fmt(b.pack)]);
    if ((o ? o.mode : mode()) === "delivery") r.push(["Delivery", b.del ? fmt(b.del) : "Free", b.del ? "" : "good"]);
    if (b.tax) r.push([`${esc((o ? o.taxLabel : O().taxLabel) || "Tax")} ${b.pct}%`, fmt(b.tax)]);
    if (b.tip) r.push(["Tip", fmt(b.tip)]);
    if (b.round) r.push(["Rounding", (b.round < 0 ? "− " : "") + fmt(Math.abs(b.round))]);
    return `<dl class="ob-rows">${r.map(([k, v, c]) => `<div${c ? ` class="${c}"` : ""}><dt>${k}</dt><dd>${v}</dd></div>`).join("")}<div class="ob-total"><dt>To pay</dt><dd>${fmt(b.total)}</dd></div></dl>`;
  };

  /* ---------- the page ---------- */
  const stepper = (id, n, key) => `<span class="ostep" role="group" aria-label="Quantity"><button type="button" data-act="dec" data-id="${esc(id)}"${key ? ` data-key="${esc(key)}"` : ""} aria-label="One fewer">−</button><b aria-live="polite">${n}</b><button type="button" data-act="inc" data-id="${esc(id)}"${key ? ` data-key="${esc(key)}"` : ""} aria-label="One more">+</button></span>`;
  function card(x) {
    const d = x.d, im = A.imgUrl(d.image), n = qtyOf(x.id), custom = x.V.length || x.G.length, fav = favs.has(x.id), long = String(d.desc || "").length > 84;
    return `<li class="oc${d.soldOut ? " sold" : ""}" data-id="${esc(x.id)}" data-diet="${esc(d.diet || "")}" data-fav="${fav}" data-q="${esc((d.name + " " + (d.desc || "") + " " + (d.tag || "") + " " + x.cat.name).toLowerCase())}">
      <button type="button" class="oc-pic" data-act="open" data-id="${esc(x.id)}" aria-label="${esc(d.name)}: details"${d.soldOut ? " disabled" : ""}>${im ? `<img src="${esc(im)}" alt="" loading="lazy">` : A.ph(d.name)}${d.tag ? `<em class="oc-tag">${esc(d.tag)}</em>` : ""}</button>
      <div class="oc-b"><div class="oc-t"><h3>${A.dietMark(d.diet)}<span>${esc(d.name)}</span></h3><button type="button" class="oc-fav" data-act="fav" data-id="${esc(x.id)}" aria-pressed="${fav}" aria-label="${fav ? "Remove " + esc(d.name) + " from favourites" : "Save " + esc(d.name) + " as a favourite"}">${SV.heart}</button></div>
        ${d.desc ? `<p class="oc-d">${A.rich(d.desc)}</p>${long ? `<button type="button" class="oc-more" data-act="more" aria-expanded="false">Show more</button>` : ""}` : ""}
        <div class="oc-f"><div><b class="oc-p">${x.V.length ? "From " : ""}${fmt(x.base)}</b>${custom ? `<small>Customisation available</small>` : ""}</div>
          ${d.soldOut ? `<span class="oc-out">Sold out</span>` : n && !custom ? stepper(x.id, n) : `<button type="button" class="btn sec oc-add" data-act="add" data-id="${esc(x.id)}" aria-label="Add ${esc(d.name)}">+ Add${n ? ` <i>${n}</i>` : ""}</button>`}</div></div></li>`;
  }
  function strip() {
    const o = O(), m = mode(), L = lead(), b = [];
    if (+o.minOrder > 0 && m !== "dinein") b.push(`${SV.bag}<span>Minimum order <b>${fmt(+o.minOrder)}</b></span>`);
    if (L) b.push(`${SV.clock}<span>${m === "delivery" ? "Delivery in about" : m === "pickup" ? "Ready in about" : "Served in about"} <b>${L} mins</b></span>`);
    if (m === "delivery" && +o.freeAbove > 0) b.push(`<span>Free delivery above <b>${fmt(+o.freeAbove)}</b></span>`);
    return b.length ? `<div class="ord-strip"><div class="wrap">${b.map((x) => `<span class="os-i">${x}</span>`).join("")}</div></div>` : "";
  }
  function menuHTML() {
    const o = O(), cs = A.cats().map((c) => ({ c, items: D.filter((x) => x.cat.id === c.id) })).filter((g) => g.items.length);
    const best = D.filter((x) => x.d.bestseller && !x.d.soldOut);
    const sec = (id, title, items, note) => `<section class="ord-sec${ui.shut[id] ? " shut" : ""}" id="${esc(id)}" aria-label="${esc(title)}"><h2 class="ord-st"><button type="button" data-act="fold" data-id="${esc(id)}" aria-expanded="${!ui.shut[id]}"><span>${esc(title)}</span><small>${items.length}</small>${SV.chev}</button></h2>${note ? `<p class="ord-sn">${A.rich(note)}</p>` : ""}<ul class="ord-grid">${items.map(card).join("")}</ul></section>`;
    return `${cs.length > 1 && o.tiles !== false ? `<nav class="ord-tiles" aria-label="Food categories">${cs.map((g) => { const im = A.imgUrl(g.c.image) || A.imgUrl((g.items.find((x) => A.imgUrl(x.d.image)) || { d: {} }).d.image); return `<a href="#o-${esc(g.c.id)}" data-act="jump" data-id="o-${esc(g.c.id)}">${im ? `<img src="${esc(im)}" alt="" loading="lazy">` : A.ph(g.c.name)}<span>${esc(g.c.name)}</span></a>`; }).join("")}</nav>` : ""}
      ${best.length ? sec("o-best", o.bestTitle || "Best sellers", best) : ""}
      ${cs.map((g) => sec("o-" + g.c.id, g.c.name, g.items, g.c.note)).join("")}
      <p class="ord-none" hidden>No dishes match. Try another word or filter.</p>`;
  }
  function closedNote() {
    const s = A.openState(); if (!s || s.open) return "";
    const Dd = A.weekDays(), nx = s.next, at = nx ? `${nx.k === 0 ? "today at" : nx.k === 1 ? "tomorrow at" : esc((Dd[nx.day] || {}).day || "") + " at"} ${A.fmtTime(A.hhmm(nx.at))}` : "";
    const later = slots().length > 0;
    return `<p class="ord-closed" role="status"><b>We're closed right now.</b> ${at ? `We open ${at}. ` : ""}${later ? "You can still order ahead for a later time." : "Ordering opens again then."}</p>`;
  }
  function page(api) {
    A = api; C = A.C(); load();
    const o = O(), ms = modes(), m = mode(), diets = [...new Set(D.map((x) => x.d.diet).filter((d) => A.DIET[d]))], past = st.get("orders", []);
    return `<section class="ord" id="order-page">${strip()}
      <div class="wrap">
        <header class="ord-head"><div><p class="crumbs"><a href="${A.PAGES.home}">${esc((C.site.pageLabels || {}).home || "Home")}</a> / ${esc(o.label || "Order now")}</p><h1 class="h1">${A.rich(o.title || "Order online")}</h1>${o.lede ? `<p class="hero-lede">${A.rich(o.lede)}</p>` : ""}</div>${A.statusChip()}</header>
        ${closedNote()}
        <div class="ord-bar">
          ${ms.length > 1 ? `<div class="ord-mode" role="radiogroup" aria-label="How would you like your order?">${ms.map((k) => `<button type="button" role="radio" aria-checked="${k === m}" data-act="mode" data-id="${k}">${MODES[k]}</button>`).join("")}</div>` : `<span class="ord-only">${MODES[m]}</span>`}
          <label class="ord-q"><span class="vh">Search the menu</span>${A.icon("search", "ms-ic")}<input type="search" id="ord-q" placeholder="Search dishes" autocomplete="off" value="${esc(ui.q)}"></label>
          <div class="ord-tools">
            <button type="button" class="chip" data-act="cats" aria-haspopup="dialog">${SV.list} Category</button>
            ${diets.length > 1 ? ["veg", "vegan", "egg", "nonveg"].filter((d) => diets.includes(d)).map((d) => `<button type="button" class="chip" data-act="diet" data-id="${d}" aria-pressed="${ui.diet === d}"><span class="diet ${d}" aria-hidden="true"></span>${A.DIET[d]}</button>`).join("") : ""}
            <button type="button" class="chip" data-act="favs" aria-pressed="${ui.fav}">${SV.heart} Favourites</button>
            ${past.length ? `<button type="button" class="chip" data-act="orders">Your orders (${past.length})</button>` : ""}
          </div>
        </div>
        <div class="ord-menu" id="ord-menu">${D.length ? menuHTML() : `<p class="ord-empty">The menu for ordering isn't ready yet. Please call us to order.</p>`}</div>
      </div>
      <div id="ord-fab"></div><div id="ord-over"></div></section>`;
  }

  /* ---------- the dish sheet ---------- */
  function sheetPrice(s) { const x = byId(s.id); if (!x) return 0; const v = x.V.length ? x.V[s.v] || (x.need ? null : x.V[0]) : null; return (v ? v.price : x.base) + x.G.reduce((n, g, gi) => n + g.opts.reduce((m, op, oi) => m + ((s.g[gi] || []).includes(oi) ? op.price : 0), 0), 0); }
  function sheetHTML() {
    const s = ui.sheet, x = byId(s.id); if (!x) return "";
    const d = x.d, im = A.imgUrl(d.image), fav = favs.has(x.id), unit = sheetPrice(s), pick = x.need && !x.V[s.v], miss = pick || x.G.some((g, gi) => g.need && !(s.g[gi] || []).length);
    return `<div class="ord-shade" data-act="close"></div><div class="ord-sheet" role="dialog" aria-modal="true" aria-label="${esc(d.name)}">
      <button type="button" class="ord-x" data-act="close" aria-label="Close">${SV.x}</button>
      <div class="osh-body"><div class="osh-top">${im ? `<img class="osh-img" src="${esc(im)}" alt="">` : ""}<div class="osh-info"><div class="oc-t"><h2>${A.dietMark(d.diet)}<span>${esc(d.name)}</span></h2><button type="button" class="oc-fav" data-act="fav" data-id="${esc(x.id)}" aria-pressed="${fav}" aria-label="${fav ? "Remove from favourites" : "Save as a favourite"}">${SV.heart}</button></div>
          ${d.desc ? `<p class="osh-d">${A.rich(d.desc)}</p>` : ""}${d.allergens ? `<p class="osh-a">Contains: ${esc(d.allergens)}</p>` : ""}
          <span class="ostep big" role="group" aria-label="Quantity"><button type="button" data-act="sq" data-id="-1" aria-label="One fewer"${s.qty <= 1 ? " disabled" : ""}>−</button><b aria-live="polite">${s.qty}</b><button type="button" data-act="sq" data-id="1" aria-label="One more">+</button></span></div></div>
        ${O().dishNotes !== false ? `<label class="osh-note"><span class="vh">Special instructions</span><input type="text" id="osh-note" maxlength="140" placeholder="Add special instructions…" value="${esc(s.note)}"></label>` : ""}
        ${x.V.length ? `<fieldset class="osh-g"><legend><span>${x.need ? "Choose a variety" : "Choose one"}</span><small>Required</small></legend>${x.V.map((v, i) => `<label class="osh-o"><input type="radio" name="osh-v" value="${i}"${i === s.v ? " checked" : ""}><span>${esc(v.label)}</span><b>${fmt(v.price)}</b></label>`).join("")}</fieldset>` : ""}
        ${x.G.map((g, gi) => { const sel = s.g[gi] || [], full = g.max > 0 && sel.length >= g.max; return `<fieldset class="osh-g"><legend><span>${esc(g.title)}</span><small>${g.need ? "Required · " : ""}${sel.length}/${g.max || g.opts.length}</small></legend>${g.opts.map((op, oi) => `<label class="osh-o${full && !sel.includes(oi) ? " off" : ""}"><input type="checkbox" data-g="${gi}" value="${oi}"${sel.includes(oi) ? " checked" : ""}${full && !sel.includes(oi) ? " disabled" : ""}><span>${esc(op.label)}</span><b>${op.price ? "+ " + fmt(op.price) : "Free"}</b></label>`).join("")}</fieldset>`; }).join("")}</div>
      <div class="osh-foot"><div>${pick ? `<b>From ${fmt(x.base)}</b><small>Choose a variety to see the price</small>` : `<b>${fmt(unit * s.qty)}</b><small>Total price</small>`}</div><button type="button" class="btn pri" data-act="put"${miss ? " disabled" : ""}>${pick ? "Choose a variety" : miss ? "Choose the required options" : "Add to cart"}</button></div></div>`;
  }

  /* ---------- cart, checkout, confirmation ---------- */
  const lineText = (l) => [l.variant, ...(l.addons || []).map((a) => a.label)].filter(Boolean).join(", ");
  function cartHTML() {
    const b = bill(), o = O(), cps = coupons(), m = mode(), tips = String(o.tipOptions || "10,20,30").split(/[,\s]+/).map((t) => +t).filter((t) => t > 0).slice(0, 4);
    if (!cart.length) return `<div class="od-empty">${SV.bag}<p><b>Your cart is empty.</b><br>Add a few dishes to get started.</p><button type="button" class="btn pri" data-act="close">Browse the menu</button></div>`;
    return `<ul class="od-lines">${cart.map((l) => `<li><div class="odl-n"><b>${A.dietMark(l.diet)}${esc(l.name)}</b>${lineText(l) ? `<small>${esc(lineText(l))}</small>` : ""}${l.note ? `<small class="odl-note">“${esc(l.note)}”</small>` : ""}</div>${stepper(l.id, l.qty, l.key)}<span class="odl-p">${fmt(l.unit * l.qty)}</span></li>`).join("")}</ul>
      <button type="button" class="link od-more" data-act="close">+ Add more items</button>
      ${cps.length ? `<div class="od-box"><label for="od-code">Offers and coupons</label><div class="od-code"><input id="od-code" type="text" autocomplete="off" autocapitalize="characters" placeholder="Enter a code" value="${esc(ui.coupon)}"><button type="button" class="btn sec" data-act="${b.code ? "uncoupon" : "coupon"}">${b.code ? "Remove" : "Apply"}</button></div>
        ${b.code ? `<p class="od-ok">${esc(b.code)} applied: you save ${fmt(b.disc)}.</p>` : ui.couponMsg || b.cpNote ? `<p class="od-bad" role="alert">${esc(ui.couponMsg || b.cpNote)}</p>` : ""}
        <ul class="od-cps">${cps.map((c) => `<li><button type="button" data-act="usecoupon" data-id="${esc(String(c.code).trim().toUpperCase())}"><b>${esc(String(c.code).trim().toUpperCase())}</b><span>${esc(c.note || (c.kind === "flat" ? `${fmt(+c.value)} off` : `${+c.value}% off${+c.max > 0 ? ` up to ${fmt(+c.max)}` : ""}`) + (+c.min > 0 ? ` on orders above ${fmt(+c.min)}` : ""))}</span></button></li>`).join("")}</ul></div>` : ""}
      ${o.tips !== false && m !== "pickup" && tips.length ? `<div class="od-box"><span class="od-l">Add a tip for the team</span><div class="od-tips" role="group" aria-label="Tip">${tips.map((t) => `<button type="button" class="chip" data-act="tip" data-id="${t}" aria-pressed="${+ui.tip === t}">${fmt(t)}</button>`).join("")}</div></div>` : ""}
      ${o.cutlery !== false && m !== "dinein" ? `<label class="od-check"><input type="checkbox" id="od-cutlery"${ui.form.cutlery ? " checked" : ""}><span>Send cutlery<small>Leave it off to help cut waste.</small></span></label>` : ""}
      <div class="od-box" id="od-bill"><span class="od-l">Bill details</span>${billRows(b)}</div>
      ${b.short ? `<p class="od-bad" role="alert">Add ${fmt(b.short)} more to reach the minimum order of ${fmt(b.min)}.</p>` : ""}`;
  }
  const pays = () => { const o = O(), p = o.pay || {}, m = mode(), out = []; if (p.razorpay && can.rz) out.push({ id: "rz", label: "Pay online (UPI, card, netbanking)", note: "Secure payment by Razorpay. The order is placed as soon as you've paid." }); for (const g of Object.keys(GW)) if (p[GW[g].key] && (can.pg || []).includes(g)) out.push({ id: g, label: GW[g].label, note: `You pay on ${GW[g].name}'s secure page and come back here. The order is placed as soon as you've paid.` }); if (p.cod !== false) out.push({ id: "cod", label: m === "delivery" ? p.codLabel || "Pay on delivery (cash or UPI)" : m === "pickup" ? "Pay at the counter" : "Pay at the table" }); if (p.upi && /^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(String(p.upiId || "").trim()) && (C.food.currency || "₹") === "₹") out.push({ id: "upi", label: "Pay now by UPI", note: "Scan a QR code or open your UPI app. The order is placed once you've paid." }); return out; };
  /** Points at checkout: what the guest has and a tick box to use them (verified numbers only), and what this order earns. */
  function ptsBox() {
    const L = loy(); if (!L.on) return ""; const P = ui.pts, b = bill();
    const have = P && verified() ? (P.points >= Math.max(1, P.min || 0) && P.worth > 0
      ? `<label class="od-check"><input type="checkbox" id="od-pts"${ui.usePts ? " checked" : ""}><span>Use my points<small>You have ${P.points} point${P.points === 1 ? "" : "s"}${b.pts ? `: ${b.pts} used here, ${fmt(b.ptsOff)} off` : `, worth up to ${fmt(Math.round(P.points * P.worth * 100) / 100)}`}.</small></span></label>`
      : `<p class="od-live">You have ${P.points} point${P.points === 1 ? "" : "s"}.${P.min > P.points ? ` Points can be used from ${P.min}.` : ""}</p>`) : "";
    return `<div class="od-pts" id="od-ptsbox">${have}${b.earn ? `<p class="od-live">This order earns you ${b.earn} point${b.earn === 1 ? "" : "s"}.</p>` : ""}</div>`;
  }
  const inp = (k, label, a = "") => `<div class="of"><label for="of-${k}">${label}</label><input id="of-${k}" data-f="${k}" value="${esc(ui.form[k] || "")}" ${a}></div>`;
  function checkoutHTML() {
    const b = bill(), o = O(), m = mode(), f = ui.form, sl = slots(), ps = pays();
    if (!sl.some((s) => s.v === f.when)) f.when = sl.length ? sl[0].v : "";
    if (!ps.some((p) => p.id === f.pay)) f.pay = ps.length ? ps[0].id : "";
    return `<form class="od-form" id="od-form" novalidate>
      <fieldset><legend>Your details</legend>${inp("name", "Name", 'autocomplete="name" required')}${inp("phone", "Mobile number", 'type="tel" inputmode="tel" autocomplete="tel" required')}${o.askEmail ? inp("email", "Email (optional)", 'type="email" autocomplete="email"') : ""}
        ${can.otp || (can.pts && loy().on) ? `<div class="od-otp" id="od-otp">${verified() ? `<p class="od-ok">Mobile number verified on WhatsApp.</p>` : ui.otpSent ? `<div class="of"><label for="of-code">Code we sent you on WhatsApp</label><div class="od-code"><input id="of-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6 digits"><button type="button" class="btn sec" data-act="otpcheck">Verify</button></div></div><button type="button" class="link od-more" data-act="otpsend">Send a new code</button>` : can.otp ? `<button type="button" class="btn sec" data-act="otpsend">Verify this number on WhatsApp</button><p class="od-live">We send a 6-digit code to this number on WhatsApp before taking the order.</p>` : `<button type="button" class="btn sec" data-act="otpsend">Verify this number to use your points</button><p class="od-live">Optional. We send a 6-digit code to this number on WhatsApp, then show the points you can take off this order.</p>`}${ui.otpMsg ? `<p class="od-bad" role="alert">${esc(ui.otpMsg)}</p>` : ""}</div>` : ""}${ptsBox()}</fieldset>
      ${m === "delivery" ? `<fieldset><legend>Delivery address</legend>${inp("line1", "Flat, house or building", 'autocomplete="address-line1" required')}${inp("area", "Street and area", 'autocomplete="address-line2" required')}<div class="of2">${inp("landmark", "Landmark (optional)")}${inp("pin", "PIN code", 'inputmode="numeric" autocomplete="postal-code" maxlength="10"' + (o.askPin !== false ? " required" : ""))}</div>
        <div class="od-tips" role="radiogroup" aria-label="Save this address as">${["Home", "Work", "Other"].map((l) => `<button type="button" class="chip" role="radio" data-act="label" data-id="${l}" aria-checked="${f.label === l}">${l}</button>`).join("")}</div>
        <p class="od-bad" id="od-area" role="alert"${!b.area.ok && (f.pin || f.area) ? "" : " hidden"}>${esc(o.areaNote || "Sorry, we don't deliver to that area yet. Choose Pick up, or call us.")}</p></fieldset>` : ""}
      ${m === "dinein" ? `<fieldset><legend>Your table</legend>${inp("table", "Table number", 'required maxlength="12"')}</fieldset>` : ""}
      <fieldset><legend>${m === "delivery" ? "Delivery time" : m === "pickup" ? "Pickup time" : "When"}</legend>${sl.length ? `<div class="of"><label for="of-when" class="vh">Time</label><select id="of-when" data-f="when">${sl.map((s) => `<option value="${s.v}"${s.v === f.when ? " selected" : ""}>${esc(s.label)}</option>`).join("")}</select></div>` : `<p class="od-bad" role="alert">We aren't taking orders right now. Please check our opening hours.</p>`}</fieldset>
      <fieldset><legend>Payment</legend>${ps.length ? ps.map((p) => `<label class="osh-o"><input type="radio" name="of-pay" value="${p.id}"${p.id === f.pay ? " checked" : ""}><span>${esc(p.label)}${p.note ? `<small>${esc(p.note)}</small>` : ""}</span></label>`).join("") : `<p class="od-bad">No payment method is set up yet. Please call us to order.</p>`}</fieldset>
      ${o.notes !== false ? `<div class="of"><label for="of-notes">Note for the kitchen (optional)</label><textarea id="of-notes" data-f="notes" rows="2" maxlength="300">${esc(f.notes || "")}</textarea></div>` : ""}
      <div class="od-box" id="od-bill"><span class="od-l">Bill details</span>${billRows(b)}</div>
      ${agree() ? `<label class="of-consent"><input type="checkbox" id="of-consent"${ui.agreed ? " checked" : ""}> <span>${A.consentHTML ? A.consentHTML() : esc(agree())}</span></label>` : ""}
      <p class="od-bad" id="od-err" role="alert"${ui.err ? "" : " hidden"}>${esc(ui.err)}</p></form>`;
  }
  const STEPS = { delivery: ["Order received", "Confirmed", "Being prepared", "Out for delivery", "Delivered"], pickup: ["Order received", "Confirmed", "Being prepared", "Ready for pickup", "Collected"], dinein: ["Order received", "Confirmed", "Being prepared", "Served", "Completed"] };
  const stepOf = (s) => ({ accepted: 1, preparing: 2, ready: 3, out: 3, done: 4 }[s] || 0);
  const upiLink = (o) => `upi://pay?pa=${encodeURIComponent(o.upiId)}&pn=${encodeURIComponent(o.payee || C.brand.name)}&am=${Number(o.bill.total).toFixed(2)}&cu=INR&tn=${encodeURIComponent(o.id)}`;
  function orderText(o) {
    const L = [`${o.intro || "New order"} ${o.id} (${MODES[o.mode]})`, `For: ${o.whenLabel}`, "", "Items:"];
    o.items.forEach((l) => { L.push(`• ${l.qty} × ${l.name}${lineText(l) ? ` (${lineText(l)})` : ""} = ${txt(l.unit * l.qty)}`); if (l.note) L.push(`   Note: ${l.note}`); });
    const b = o.bill; L.push("", `Item total: ${txt(b.sub)}`);
    if (b.disc) L.push(`Discount (${b.code}): −${txt(b.disc)}`);
    if (b.pack) L.push(`Packing: ${txt(b.pack)}`);
    if (o.mode === "delivery") L.push(`Delivery: ${b.del ? txt(b.del) : "Free"}`);
    if (b.tax) L.push(`${o.taxLabel || "Tax"} ${b.pct}%: ${txt(b.tax)}`);
    if (b.tip) L.push(`Tip: ${txt(b.tip)}`);
    L.push(`To pay: ${txt(b.total)} (${o.payLabel})`); if (o.utr) L.push(`UPI reference: ${o.utr} (please check it in your UPI app)`); if (o.rz) L.push(`Paid online with Razorpay, payment ${o.rz.razorpay_payment_id}`);
    L.push("", o.c.name, o.c.phone);
    if (o.c.email) L.push(o.c.email);
    if (o.mode === "delivery") L.push(o.c.address);
    if (o.mode === "dinein") L.push(`Table ${o.c.table}`);
    if (o.mode !== "dinein") L.push(o.cutlery ? "Cutlery: yes" : "Cutlery: no");
    if (o.notes) L.push("", `Note: ${o.notes}`);
    return L.join("\n");
  }
  function doneHTML(o) {
    const wa = String(o.wa || "").replace(/\D/g, ""), steps = STEPS[o.mode], at = stepOf(o.status), cancelled = o.status === "cancelled";
    const sendWa = wa ? `<a class="btn ${o.sent ? "sec" : "pri"}" href="https://wa.me/${wa}?text=${encodeURIComponent(orderText(o))}" target="_blank" rel="noopener">${o.sent ? "Message us about this order" : "Send the order on WhatsApp"}</a>` : "";
    return `<div class="od-done"><p class="od-tick${cancelled ? " no" : ""}" aria-hidden="true">${cancelled ? "×" : "✓"}</p><h3>${cancelled ? "This order was cancelled" : o.sent ? esc(O().success || "Thank you! Your order is placed.") : "One more step: send us your order"}</h3>
      <p class="od-no">Order number <b>${esc(o.id)}</b></p><p class="od-when">${esc(MODES[o.mode])} · ${esc(o.whenLabel)}</p>
      ${o.preview ? `<p class="od-ok">Preview: nothing was sent. On the live site the order reaches ${A.backend() ? "your Enquiries inbox" : wa ? "you on WhatsApp" : "you once a WhatsApp number or the enquiry inbox is set up"}.</p>` : ""}
      ${!o.sent && !o.preview ? `<div class="od-box"><p>${wa ? "Tap the button to open WhatsApp with your order written out, then press send. We'll confirm it there." : `Please call us to confirm this order${C.contact.phone ? ` on <a href="${esc(A.tel(C.contact.phone))}">${esc(C.contact.phone)}</a>` : ""}.`}</p>${sendWa}</div>` : ""}
      ${o.sent && !cancelled ? `<ol class="od-track" aria-label="Order status">${steps.map((s, i) => `<li class="${i < at ? "was" : i === at ? "now" : ""}"${i === at ? ' aria-current="step"' : ""}><i aria-hidden="true"></i><span>${s}</span></li>`).join("")}</ol>${o.live ? `<p class="od-live">This page updates as the kitchen works on your order.</p>` : `<p class="od-live">We'll call or message you on ${esc(o.c.phone)} if we need anything.</p>`}` : ""}
      ${GW[o.pay] && o.pg && !cancelled ? `<div class="od-box"><span class="od-l">Payment</span><p class="od-ok">Payment of ${fmt(o.bill.total)} received through ${GW[o.pay].name}. Thank you.</p></div>` : ""}
      ${o.pay === "rz" && !cancelled ? `<div class="od-box"><span class="od-l">Payment</span><p class="od-ok">${o.sent ? `Payment of ${fmt(o.bill.total)} received. Thank you.` : `You paid ${fmt(o.bill.total)} online (payment ${esc((o.rz || {}).razorpay_payment_id || "")}).`}</p></div>` : ""}
      ${o.pay === "upi" && !cancelled ? `<div class="od-box"><span class="od-l">Payment</span>${o.paid ? `<p class="od-ok">Payment of ${fmt(o.bill.total)} received. Thank you.</p>` : `<p><b>${fmt(o.bill.total)} by UPI</b>, reference <code>${esc(o.utr || "")}</code>.</p><p class="od-live">${o.live ? "The restaurant is checking it in their UPI app. This page shows it as soon as they confirm." : "The restaurant checks it in their UPI app and confirms with you."}</p>`}</div>` : ""}
      <div class="od-box"><span class="od-l">Your order</span><ul class="od-sum">${o.items.map((l) => `<li><span>${l.qty} × ${esc(l.name)}${lineText(l) ? ` <small>(${esc(lineText(l))})</small>` : ""}</span><b>${fmt(l.unit * l.qty)}</b></li>`).join("")}</ul>${billRows(o.bill, o)}</div>
      <div class="od-acts">${o.sent ? sendWa : ""}${C.contact.phone ? `<a class="btn sec" href="${esc(A.tel(C.contact.phone))}">Call the restaurant</a>` : ""}<button type="button" class="btn sec" data-act="again" data-id="${esc(o.id)}">Order again</button></div></div>`;
  }
  /** Paying comes first: the QR code and the UPI app button carry the exact amount and the order number. The order is
      placed when the guest enters the reference number their UPI app shows after paying. */
  function payHTML() {
    const o = ui.paying; if (!o) return "";
    return `<div class="od-pay"><p class="od-no">Order <b>${esc(o.id)}</b> · ${esc(MODES[o.mode])}</p><p class="od-amt">${fmt(o.bill.total)}</p>
      <ol class="od-steps"><li><b>Pay ${fmt(o.bill.total)}</b> by scanning this code in any UPI app, or with the button under it.</li></ol>
      <div class="od-qr" id="od-qr" aria-label="UPI QR code for ${esc(txt(o.bill.total))}"></div><p><code>${esc(o.upiId)}</code></p><a class="btn sec" href="${esc(upiLink(o))}">Open your UPI app</a>
      <ol class="od-steps" start="2"><li><b>Enter the reference number</b> your UPI app shows after paying (UTR or UPI transaction ID, 12 digits).</li></ol>
      <div class="of"><label for="of-utr">UPI reference number</label><input id="of-utr" inputmode="numeric" autocomplete="off" maxlength="22" placeholder="12-digit number" value="${esc(ui.utr || "")}"></div>
      <p class="od-bad" id="od-err" role="alert"${ui.err ? "" : " hidden"}>${esc(ui.err)}</p>
      <p class="od-live">Your order is sent to the kitchen only after this step. Nothing is charged by this page: you pay in your own UPI app.</p></div>`;
  }
  function ordersHTML() {
    const L = st.get("orders", []);
    return L.length ? `<ul class="od-past">${L.map((o) => `<li><button type="button" data-act="view" data-id="${esc(o.id)}"><b>${esc(o.id)}</b><span>${new Date(o.at).toLocaleDateString(undefined, { day: "numeric", month: "short" })} · ${o.items.reduce((n, l) => n + l.qty, 0)} items · ${fmt(o.bill.total)}</span><small>${esc(o.items.map((l) => l.name).join(", ").slice(0, 90))}</small></button><button type="button" class="btn sec" data-act="again" data-id="${esc(o.id)}">Order again</button></li>`).join("")}</ul>` : `<div class="od-empty"><p>No orders from this device yet.</p></div>`;
  }
  function catsHTML() {
    const cs = A.cats().map((c) => ({ c, n: D.filter((x) => x.cat.id === c.id).length })).filter((g) => g.n), best = D.filter((x) => x.d.bestseller && !x.d.soldOut).length;
    return `<ul class="od-cats">${best ? `<li><button type="button" data-act="jump" data-id="o-best"><span>${esc(O().bestTitle || "Best sellers")}</span><b>${best}</b></button></li>` : ""}${cs.map((g) => `<li><button type="button" data-act="jump" data-id="o-${esc(g.c.id)}"><span>${esc(g.c.name)}</span><b>${g.n}</b></button></li>`).join("")}</ul>`;
  }
  function overHTML() {
    if (ui.sheet) return sheetHTML();
    if (!ui.drawer) return "";
    const T = { cart: "Your cart", checkout: "Checkout", pay: "Pay to place your order", done: "Your order", orders: "Your orders", cats: "Categories" }[ui.drawer], b = bill(), blocked = ui.drawer === "checkout" && (!slots().length || !pays().length || (mode() === "delivery" && !b.area.ok && !!(ui.form.pin || ui.form.area)));
    const body = ui.drawer === "cart" ? cartHTML() : ui.drawer === "checkout" ? checkoutHTML() : ui.drawer === "pay" ? payHTML() : ui.drawer === "done" ? doneHTML(ui.done) : ui.drawer === "orders" ? ordersHTML() : catsHTML();
    const foot = ui.drawer === "cart" && cart.length ? `<div class="od-foot"><div><b>${fmt(b.total)}</b><small>${count()} item${count() === 1 ? "" : "s"} · ${MODES[mode()]}</small></div><button type="button" class="btn pri" data-act="checkout"${b.short ? " disabled" : ""}>Checkout</button></div>`
      : ui.drawer === "checkout" ? `<div class="od-foot"><div><b>${fmt(b.total)}</b><small>To pay</small></div><button type="button" class="btn pri" data-act="place"${blocked || ui.busy ? " disabled" : ""}>${ui.busy ? "Placing…" : ui.form.pay === "upi" || ui.form.pay === "rz" ? "Continue to pay" : "Place order"}</button></div>`
      : ui.drawer === "pay" ? `<div class="od-foot"><div><b>${fmt(ui.paying.bill.total)}</b><small>Pay first, then place</small></div><button type="button" class="btn pri" data-act="paid"${ui.busy ? " disabled" : ""}>${ui.busy ? "Placing…" : "I've paid: place the order"}</button></div>` : "";
    return `<div class="ord-shade" data-act="close"></div><aside class="ord-drawer${ui.drawer === "cats" ? " small" : ""}" role="dialog" aria-modal="true" aria-label="${T}"><header><${ui.drawer === "checkout" ? 'button type="button" class="od-back" data-act="cart" aria-label="Back to the cart">←</button><h2' : ui.drawer === "pay" ? 'button type="button" class="od-back" data-act="unpay" aria-label="Back to checkout">←</button><h2' : "h2"}>${T}</h2><button type="button" class="ord-x" data-act="close" aria-label="Close">${SV.x}</button></header><div class="od-body">${body}</div>${foot}</aside>`;
  }
  function fabHTML() { const n = count(); return n && !ui.drawer && !ui.sheet ? `<button type="button" class="ord-fab" data-act="cart" aria-label="View your cart: ${n} item${n === 1 ? "" : "s"}">${SV.bag}<span><b>${n} item${n === 1 ? "" : "s"}</b> · ${fmt(bill().sub)}</span><em>View cart</em></button>` : ""; }

  /* ---------- drawing and behaviour ---------- */
  let root;
  function over(keep) {
    const el = $("#ord-over", root); if (!el) return;
    const sc = keep ? ($(".od-body, .osh-body", el) || {}).scrollTop : 0;
    el.innerHTML = overHTML(); $("#ord-fab", root).innerHTML = fabHTML();
    const open = !!(ui.sheet || ui.drawer); document.documentElement.classList.toggle("ord-lock", open); document.documentElement.classList.toggle("ord-cart", !open && count() > 0);
    const b = $(".od-body, .osh-body", el); if (b && sc) b.scrollTop = sc;
    if (open && !keep) { const f = $(".ord-x", el); f && f.focus({ preventScroll: true }); }
    if (ui.drawer === "pay") qr();
  }
  /** The address changed: the delivery fee, the area message and the Place order button follow, without redrawing the form. */
  function rebill() {
    const b = bill(), box = $("#od-bill", root), ar = $("#od-area", root), bad = mode() === "delivery" && !b.area.ok && !!(ui.form.pin || ui.form.area);
    if (box) box.innerHTML = `<span class="od-l">Bill details</span>${billRows(b)}`;
    if (ar) ar.hidden = !bad;
    const pl = $('[data-act="place"]', root); if (pl) { pl.disabled = bad || !slots().length || !pays().length || ui.busy; const t = pl.parentNode.querySelector("b"); if (t) t.textContent = txt(b.total); }
  }
  function menu() { const m = $("#ord-menu", root); if (m && D.length) { m.innerHTML = menuHTML(); filter(); } }
  function filter() {
    const q = ui.q.trim().toLowerCase(); let any = false;
    $$(".ord-sec", root).forEach((s) => { let n = 0; $$(".oc", s).forEach((c) => { const ok = (!q || c.dataset.q.includes(q)) && (!ui.diet || c.dataset.diet === ui.diet || (ui.diet === "veg" && c.dataset.diet === "vegan")) && (!ui.fav || c.dataset.fav === "true"); c.hidden = !ok; if (ok) n++; }); s.hidden = !n; if (n) any = true; });
    const none = $(".ord-none", root); if (none) none.hidden = any;
    const t = $(".ord-tiles", root); if (t) t.hidden = !!(q || ui.diet || ui.fav);
  }
  function toggleFav(id) { favs.has(id) ? favs.delete(id) : favs.add(id); st.set("favs", [...favs]); }
  function addLine(x, s) {
    if (x.need && !x.V[s.v]) return;
    const v = x.V.length ? x.V[s.v] || x.V[0] : null, addons = [];
    x.G.forEach((g, gi) => (s.g[gi] || []).forEach((oi) => g.opts[oi] && addons.push({ label: g.opts[oi].label, price: g.opts[oi].price })));
    const note = String(s.note || "").trim().slice(0, 140), key = [x.id, v ? v.label : "", addons.map((a) => a.label).join("+"), note].join("|");
    const unit = (v ? v.price : x.base) + addons.reduce((n, a) => n + a.price, 0), had = cart.find((l) => l.key === key);
    if (had) had.qty = Math.min(50, had.qty + s.qty); else cart.push({ key, id: x.id, name: x.d.name, diet: x.d.diet || "", variant: v ? v.label : "", addons, note, qty: Math.min(50, s.qty), unit });
    save();
  }
  function change(id, key, by) {
    // On a dish card the stepper changes its latest line; in the cart it changes that line.
    const l = key ? cart.find((x) => x.key === key) : [...cart].reverse().find((x) => x.id === id); if (!l) return;
    l.qty += by; if (l.qty <= 0) cart = cart.filter((x) => x !== l); else if (l.qty > 50) l.qty = 50; save();
  }
  const openSheet = (id) => { const x = byId(id); if (!x || x.d.soldOut) return; ui.sheet = { id, qty: 1, v: x.need ? -1 : 0, g: {}, note: "" }; over(); };
  const close = () => { const b = ui.back; ui.sheet = null; ui.drawer = ""; ui.err = ""; over(); if (b && b.isConnected) b.focus({ preventScroll: true }); };
  /** The words of the consent tick box (Legal & privacy → Consent on forms), or "" when it is off. */
  const agree = () => (A.consentWords ? A.consentWords() : "");
  function sync() { $$("[data-f]", root).forEach((e) => { ui.form[e.dataset.f] = e.value; }); { const cc = $("#of-consent", root); if (cc) ui.agreed = cc.checked; } const p = $('input[name="of-pay"]:checked', root); if (p) ui.form.pay = p.value; }
  const remember = () => { const f = ui.form; st.set("me", { name: f.name, phone: f.phone, email: f.email, line1: f.line1, area: f.area, landmark: f.landmark, pin: f.pin, label: f.label, cutlery: f.cutlery }); };
  function newId() { const d = new Date(), pre = String(O().prefix || "ORD").replace(/[^A-Za-z0-9]/g, "").slice(0, 6).toUpperCase() || "ORD"; return `${pre}-${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${Math.floor(1000 + Math.random() * 9000)}`; }
  async function place() {
    sync(); const f = ui.form, m = mode(), b = bill(), o = O(), sl = slots(), bad = (k, t) => { ui.err = t; over(true); const e = $("#of-" + k, root); e && e.focus(); };
    if (!cart.length) return;
    if (!String(f.name).trim()) return bad("name", "Please enter your name.");
    if (String(f.phone).replace(/\D/g, "").length < 10) return bad("phone", "Please enter a mobile number we can reach you on.");
    if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) return bad("email", "Please check the email address.");
    if (m === "delivery") {
      if (!String(f.line1).trim()) return bad("line1", "Please enter your flat, house or building.");
      if (!String(f.area).trim()) return bad("area", "Please enter your street and area.");
      if (o.askPin !== false && String(f.pin).replace(/\D/g, "").length < 4) return bad("pin", "Please enter your PIN code.");
      if (!b.area.ok) return bad("pin", o.areaNote || "Sorry, we don't deliver to that area yet.");
    }
    if (m === "dinein" && !String(f.table).trim()) return bad("table", "Please enter your table number.");
    if (can.otp && !A.PREVIEW && !verified()) return bad("phone", "Please verify your mobile number on WhatsApp first.");
    if (!sl.some((s) => s.v === f.when)) return bad("when", "Please choose a time.");
    if (b.short) return bad("name", `The minimum order is ${txt(b.min)}.`);
    const ps = pays(), pay = ps.find((p) => p.id === f.pay); if (!pay) return bad("name", "Please choose how you'll pay.");
    if (agree() && !ui.agreed) return bad("consent", "Please tick the box to agree before placing the order.");
    ui.err = ""; remember();
    const key = Array.from(crypto.getRandomValues(new Uint8Array(12)), (x) => x.toString(16).padStart(2, "0")).join("");
    const od = { consent: agree() ? "Agreed on " + new Date().toISOString() + ": " + agree() : "", id: newId(), k: key, at: Date.now(), mode: m, when: f.when, whenLabel: whenLabel(f.when, sl), items: cart.map((l) => ({ ...l })), bill: b, taxLabel: o.taxLabel || "Tax", pay: pay.id, payLabel: pay.label, upiId: String((o.pay || {}).upiId || "").trim(), payee: (o.pay || {}).payee || "", notes: String(f.notes || "").trim(), cutlery: !!f.cutlery, intro: o.intro || "", wa: o.whatsapp || C.contact.whatsapp || "",
      pin: String(f.pin || "").trim(), area: String(f.area || "").trim(),
      c: { name: String(f.name).trim(), phone: String(f.phone).trim(), email: String(f.email || "").trim(), table: String(f.table || "").trim(), address: m === "delivery" ? [f.line1, f.area, f.landmark ? "Near " + f.landmark : "", f.pin].map((x) => String(x || "").trim()).filter(Boolean).join(", ") + ` (${f.label})` : "" }, status: "new", sent: false, live: false };
    // Paying by UPI comes before the order is placed.
    if (pay.id === "upi") { ui.paying = od; ui.utr = ""; ui.drawer = "pay"; over(); return; }
    if ((pay.id === "rz" || GW[pay.id]) && !A.PREVIEW) return payOnline(od);
    finish(od);
  }
  /** Online payment: the database works out the amount from the menu and starts the payment; Razorpay's own window takes it. */
  let rzP;
  async function payOnline(od) {
    const be = A.backend(), f = ui.form, stop = (t) => { ui.busy = false; ui.err = t; over(true); };
    ui.busy = true; over(true);
    try {
      const g = od.pay;
      const r = await fetch(be.cf + "/pay/" + g + "/" + encodeURIComponent(be.site), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ back: location.origin + location.pathname, name: od.c.name, phone: od.c.phone, email: od.c.email, order_no: od.id, mode: od.mode, pin: f.pin, area: f.area, coupon: od.bill.code, tip: od.bill.tip, total: od.bill.total, points: od.bill.pts || 0, otp: ui.otp ? ui.otp.token : "", items: od.items.map((l) => ({ id: l.id, qty: l.qty, variant: l.variant, addons: (l.addons || []).map((a) => a.label) })) }) });
      const j = await r.json().catch(() => null); if (!r.ok || !j || !(j.order_id || j.go || j.session)) return stop((j && j.error) || "Online payment couldn't start. Please try again, or choose another way to pay.");
      if (GW[g]) {
        // The order waits on this device while the guest pays on the gateway's page; it is placed when they come back paid.
        st.set("pend", { od, ref: j.ref, otp: ui.otp ? ui.otp.token : "", usePts: !!ui.usePts, at: Date.now() });
        if (g === "cf") { await new Promise((ok, no) => { if (window.Cashfree) return ok(); const s = document.createElement("script"); s.src = "https://sdk.cashfree.com/js/v3/cashfree.js"; s.onload = ok; s.onerror = no; document.head.appendChild(s); }); window.Cashfree({ mode: j.mode }).checkout({ paymentSessionId: j.session, redirectTarget: "_self" }); }
        else location.href = j.go;
        return;
      }
      await (rzP = rzP || new Promise((ok, no) => { if (window.Razorpay) return ok(); const s = document.createElement("script"); s.src = "https://checkout.razorpay.com/v1/checkout.js"; s.onload = ok; s.onerror = no; document.head.appendChild(s); })).catch(() => { rzP = null; throw new Error("x"); });
      new window.Razorpay({ key: j.key, order_id: j.order_id, amount: j.amount, currency: j.currency, name: j.name || C.brand.name, description: "Order " + od.id, prefill: { name: od.c.name, contact: od.c.phone, email: od.c.email || undefined }, notes: { order_no: od.id }, theme: { color: C.theme.c1 },
        handler: (resp) => { od.rz = resp; od.payLabel = "Paid online"; finish(od); },
        modal: { ondismiss: () => stop("The payment wasn't completed, so the order isn't placed yet. You can try again.") } }).open();
    } catch (e) { stop("Online payment couldn't open. Check your connection and try again, or choose another way to pay."); }
  }
  /** Back from a gateway's page: the order that was waiting is sent with the payment's reference; the database asks the gateway whether it was paid. */
  async function cameBack() {
    let q; try { q = new URLSearchParams(location.search); } catch (e) { return; }
    const g = q.get("paid"), no = q.get("o"); if (!g || !GW[g] || !no) return;
    const be0 = A.backend(); if (A.PREVIEW || !be0 || !be0.cf) return;
    const pend = st.get("pend", null), keep = new URLSearchParams(); if (q.get("table")) keep.set("table", q.get("table"));
    history.replaceState(null, "", location.pathname + (keep.toString() ? "?" + keep : ""));
    if (!pend || !pend.od || pend.od.id !== no || pend.od.pay !== g) return;
    // A number already verified on WhatsApp stays verified when the guest comes back to try again.
    if (pend.otp) ui.otp = { phone: digits(pend.od.c.phone), token: pend.otp }; if (pend.usePts) ui.usePts = true;
    const od = pend.od, again = (t) => { ui.busy = false; ui.err = t; ui.drawer = "checkout"; over(); };
    if (q.get("x")) { st.set("pend", null); return again("The payment wasn't completed, so the order isn't placed yet. You can try again."); }
    ui.busy = true; ui.drawer = "checkout"; ui.err = "Confirming your payment…"; over();
    const be = A.backend();
    try {
      od.pg = { gw: g, ref: pend.ref, otp: pend.otp }; od.payLabel = "Paid online";
      const r = await fetch(be.cf + "/enquire/" + encodeURIComponent(be.site), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ page: "order.html", data: orderData(od), cart: cartOf(od) }) });
      const j = await r.json().catch(() => null);
      if (r.status === 502) return again((j && j.error) || "We couldn't confirm the payment just now. Reload this page in a moment; your order is kept.");
      st.set("pend", null);
      if (!r.ok) return again((j && j.error) || "The payment wasn't completed, so the order isn't placed yet. You can try again.");
      od.sent = true; od.live = true; od.paid = true; delete od.pg.otp; shown(od);
    } catch (e) { again("We couldn't confirm the payment just now. Check your connection and reload this page; your order is kept."); }
  }
  async function finish(od) {
    const m = od.mode, b = od.bill, pay = { label: od.payLabel };
    ui.busy = true; over(true);
    if (A.PREVIEW) od.preview = true;
    else {
      try {
        const data = orderData(od);
        const how = await A.postEnquiry(data, "order.html", cartOf(od)); od.sent = !!how; od.live = how === "cf"; if ((od.rz || od.pg) && od.sent) od.paid = true;
      } catch (e) { od.sent = false; }
    }
    shown(od);
  }
  /** The cart as the database reads it (to hand the order to the restaurant's billing system when one is connected). */
  function cartOf(od) { return { mode: od.mode, pin: od.pin || "", area: od.area || "", coupon: od.bill.code || "", tip: od.bill.tip || 0, points: od.bill.pts || 0, items: od.items.map((l) => ({ id: l.id, qty: l.qty, variant: l.variant, addons: (l.addons || []).map((a) => a.label) })) }; }
  /** What is saved for an order (it goes to the site's database under Purchased orders). */
  function orderData(od) { const m = od.mode, b = od.bill, pay = { label: od.payLabel }; return { ...(od.consent ? { consent: od.consent } : {}), type: "Order", order_no: od.id, okey: od.k, name: od.c.name, phone: od.c.phone, email: od.c.email, mode: MODES[m], when: od.whenLabel, address: od.c.address, table: od.c.table, items: od.items.map((l) => `${l.qty} × ${l.name}${lineText(l) ? ` (${lineText(l)})` : ""}${l.note ? ` [${l.note}]` : ""} = ${txt(l.unit * l.qty)}`).join("\n"), total: txt(b.total), payment: od.utr ? "UPI, paid before ordering" : od.rz ? "Paid online (Razorpay)" : od.pg ? `Paid online (${GW[od.pg.gw].name})` : pay.label, utr: od.utr || "", ...(od.pg ? { pay_gw: od.pg.gw, pay_ref: od.pg.ref, otp_token: od.pg.otp || undefined } : {}), ...(od.rz ? { rz_order: od.rz.razorpay_order_id, rz_payment: od.rz.razorpay_payment_id, rz_sig: od.rz.razorpay_signature } : {}), ...(ui.otp ? { otp_token: ui.otp.token } : {}), message: orderText(od) }; }
  /** The order is placed: the cart empties and the page shows it. */
  function shown(od) {
    cart = []; save(); ui.usePts = false; ui.pts = null; ui.coupon = ""; st.set("coupon", ""); ui.tip = 0; ui.form.notes = ""; ui.paying = null; ui.utr = ""; ui.err = "";
    st.set("orders", [od, ...st.get("orders", [])].slice(0, 20));
    ui.busy = false; ui.done = od; ui.drawer = "done";
    // The whole page is drawn again, so “Your orders” shows in the toolbar.
    const host = root.parentNode, y = scrollY; host.innerHTML = page(A); bind(A); scrollTo(0, y);
  }
  /** The guest's number is checked with a code sent on WhatsApp (only when the owner switched that on). */
  async function otp(send) {
    sync(); const be = A.backend(), phone = ui.form.phone, code = String(($("#of-code", root) || {}).value || "").trim();
    if (digits(phone).length < 10) { ui.otpMsg = "Enter your mobile number first."; return over(true); }
    if (!send && !/^\d{6}$/.test(code)) { ui.otpMsg = "Enter the 6-digit code."; return over(true); }
    ui.otpMsg = "";
    try {
      const r = await fetch(be.cf + "/otp/" + (send ? "send" : "check") + "/" + encodeURIComponent(be.site), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, code }) }), j = await r.json().catch(() => null);
      if (!r.ok) ui.otpMsg = (j && j.error) || "That didn't work. Please try again.";
      else if (send) { ui.otpSent = true; A.toast("Code sent on WhatsApp"); }
      else { ui.otp = { phone: digits(phone), token: j.token }; ui.otpSent = false; ui.err = ""; loadPts(); }
    } catch (e) { ui.otpMsg = "Couldn't reach us just now. Check your connection."; }
    over(true); const c = $("#of-code", root); c && c.focus();
  }
  let qrP, pollT;
  function qr() {
    const el = $("#od-qr", root), o = ui.paying; if (!el || !o || el.firstChild) return;
    (qrP = qrP || new Promise((ok, no) => { if (window.QRCode) return ok(); const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"; s.onload = ok; s.onerror = no; document.head.appendChild(s); }))
      .then(() => { const e = $("#od-qr", root); if (e && !e.firstChild && window.QRCode) new window.QRCode(e, { text: upiLink(o), width: 180, height: 180, correctLevel: window.QRCode.CorrectLevel.M }); }).catch(() => { qrP = null; });
  }
  /** While the confirmation is open, ask the site's database how the order is doing. */
  function track(o) {
    clearTimeout(pollT); const be = A.backend();
    if (!o || !o.live || !be || !be.cf || A.PREVIEW || ["done", "cancelled"].includes(o.status)) return;
    const ask = () => fetch(be.cf + "/order/" + encodeURIComponent(be.site) + "/" + encodeURIComponent(o.id) + "?k=" + encodeURIComponent(o.k), { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => {
      const paid = !!(j && j.paid);
      if (j && j.status && (j.status !== o.status || paid !== !!o.paid)) { o.status = j.status; o.paid = paid; st.set("orders", st.get("orders", []).map((x) => (x.id === o.id ? { ...x, status: j.status, paid } : x))); if (ui.drawer === "done" && ui.done === o) over(true); }
    }).catch(() => {}).then(() => { if (ui.drawer === "done" && ui.done === o && !["done", "cancelled"].includes(o.status)) pollT = setTimeout(ask, 20000); });
    ask();
  }
  function again(id) {
    const o = st.get("orders", []).find((x) => x.id === id); if (!o) return; let n = 0;
    o.items.forEach((l) => { const x = byId(l.id); if (!x || x.d.soldOut) return; const had = cart.find((c) => c.key === l.key); if (had) had.qty = Math.min(50, had.qty + l.qty); else cart.push({ ...l }); n++; });
    save(); A.toast(n ? (n < o.items.length ? "Added what is still on the menu." : "Added to your cart.") : "Those dishes aren't on the menu right now."); ui.drawer = n ? "cart" : ui.drawer; menu(); over();
  }
  function act(e) {
    const t = e.target.closest("[data-act]"); if (!t || !root.contains(t)) return;
    const a = t.dataset.act, id = t.dataset.id;
    if (a === "jump") e.preventDefault();
    if (!ui.sheet && !ui.drawer) ui.back = t;
    if (a === "mode") { ui.mode = id; ui.modePicked = true; st.set("mode", id); const y = scrollY; const host = root.parentNode; host.innerHTML = page(A); bind(A); scrollTo(0, y); }
    else if (a === "add") { const x = byId(id); if (!x) return; if (x.V.length || x.G.length) openSheet(id); else { addLine(x, { qty: 1, v: 0, g: {}, note: "" }); menu(); over(); } }
    else if (a === "open") openSheet(id);
    else if (a === "inc" || a === "dec") { change(id, t.dataset.key, a === "inc" ? 1 : -1); menu(); over(true); }
    else if (a === "fav") { toggleFav(id); if (ui.sheet) over(true); menu(); }
    else if (a === "more") { const p = t.previousElementSibling, on = !p.classList.contains("all"); p.classList.toggle("all", on); t.textContent = on ? "Show less" : "Show more"; t.setAttribute("aria-expanded", String(on)); }
    else if (a === "fold") { ui.shut[id] = !ui.shut[id]; const s = t.closest(".ord-sec"); s.classList.toggle("shut", !!ui.shut[id]); t.setAttribute("aria-expanded", String(!ui.shut[id])); }
    else if (a === "diet") { ui.diet = ui.diet === id ? "" : id; $$('[data-act="diet"]', root).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.id === ui.diet))); filter(); }
    else if (a === "favs") { ui.fav = !ui.fav; t.setAttribute("aria-pressed", String(ui.fav)); filter(); }
    else if (a === "cats" || a === "orders" || a === "cart") { sync(); ui.err = ""; ui.sheet = null; ui.drawer = a; over(); }
    else if (a === "jump") { ui.sheet = null; ui.drawer = ""; over(); ui.q = ""; const q = $("#ord-q", root); if (q) q.value = ""; ui.shut[id] = false; menu(); const s = document.getElementById(id); if (s) { s.classList.remove("shut"); s.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); } }
    else if (a === "close") close();
    else if (a === "sq") { ui.sheet.qty = Math.max(1, Math.min(50, ui.sheet.qty + +id)); const n = $("#osh-note", root); if (n) ui.sheet.note = n.value; over(true); }
    else if (a === "put") { const n = $("#osh-note", root); if (n) ui.sheet.note = n.value; const x = byId(ui.sheet.id); addLine(x, ui.sheet); ui.sheet = null; menu(); over(); A.toast("Added to your cart: <b>" + esc(x.d.name) + "</b>"); }
    else if (a === "coupon" || a === "usecoupon") { const code = a === "usecoupon" ? id : String(($("#od-code", root) || {}).value || "").trim().toUpperCase(); ui.coupon = code; ui.couponMsg = code && !coupons().some((c) => String(c.code).trim().toUpperCase() === code) ? "That code isn't valid." : ""; if (ui.couponMsg) ui.coupon = ""; st.set("coupon", ui.coupon); over(true); }
    else if (a === "uncoupon") { ui.coupon = ""; ui.couponMsg = ""; st.set("coupon", ""); over(true); }
    else if (a === "tip") { ui.tip = +ui.tip === +id ? 0 : +id; over(true); }
    else if (a === "label") { sync(); ui.form.label = id; over(true); }
    else if (a === "checkout") { const c = $("#od-cutlery", root); if (c) ui.form.cutlery = c.checked; ui.err = ""; ui.drawer = "checkout"; over(); }
    else if (a === "place") place();
    else if (a === "otpsend" || a === "otpcheck") otp(a === "otpsend");
    else if (a === "unpay") { ui.err = ""; ui.drawer = "checkout"; over(); }
    else if (a === "paid") {
      const v = String(($("#of-utr", root) || {}).value || "").replace(/[\s-]/g, ""); ui.utr = v;
      if (!/^\d{12}$/.test(v) && !/^[A-Za-z0-9]{12,22}$/.test(v)) { ui.err = "Enter the 12-digit reference number from your UPI app. It is shown on the payment's receipt as UTR or UPI transaction ID."; over(true); const e2 = $("#of-utr", root); e2 && e2.focus(); return; }
      ui.err = ""; ui.paying.utr = v; finish(ui.paying);
    }
    else if (a === "view") { const o = st.get("orders", []).find((x) => x.id === id); if (o) { ui.done = o; ui.drawer = "done"; over(); track(o); } }
    else if (a === "again") again(id);
  }
  function bind(api) {
    A = api; C = A.C(); root = $("#order-page"); if (!root) return;
    root.addEventListener("click", act);
    root.addEventListener("input", (e) => {
      const t = e.target;
      if (t.id === "ord-q") { ui.q = t.value; filter(); }
      else if (t.dataset && t.dataset.f) ui.form[t.dataset.f] = t.value;
    });
    root.addEventListener("change", (e) => {
      const t = e.target;
      if (t.id === "od-pts") { sync(); ui.usePts = t.checked; over(true); }
      else if (t.name === "osh-v") { ui.sheet.v = +t.value; const n = $("#osh-note", root); if (n) ui.sheet.note = n.value; over(true); }
      else if (t.dataset && t.dataset.g != null && ui.sheet) { const gi = +t.dataset.g, cur = new Set(ui.sheet.g[gi] || []); t.checked ? cur.add(+t.value) : cur.delete(+t.value); ui.sheet.g[gi] = [...cur]; const n = $("#osh-note", root); if (n) ui.sheet.note = n.value; over(true); }
      else if (t.id === "od-cutlery") ui.form.cutlery = t.checked;
      else if (t.name === "of-pay") { ui.form.pay = t.value; const pl = $('[data-act="place"]', root); if (pl && !ui.busy) pl.textContent = t.value === "upi" || t.value === "rz" ? "Continue to pay" : "Place order"; }
      else if (t.dataset && (t.dataset.f === "pin" || t.dataset.f === "area")) { sync(); rebill(); }
    });
    root.addEventListener("submit", (e) => { e.preventDefault(); place(); });
    if (!bind.key) { bind.key = true; addEventListener("keydown", (e) => { if (e.key === "Escape" && (ui.sheet || ui.drawer)) close(); }); }
    // The toolbar sticks under the site's menu bar when that one stays on screen.
    const nv = $(".nav"), pos = nv ? getComputedStyle(nv).position : ""; root.style.setProperty("--ord-top", (pos === "sticky" || pos === "fixed" ? nv.offsetHeight : 0) + "px");
    if (window.SiteFX && window.SiteFX.stick) window.SiteFX.stick($(".ord-bar", root), "--ord-top", root);
    filter(); over(true);
    if (ui.drawer === "done" && ui.done) track(ui.done);
    const be = A.backend();
    if (!bind.back) { bind.back = true; cameBack(); }
    if (!canAsked && !A.PREVIEW && be && be.cf) { canAsked = true; fetch(be.cf + "/site/" + encodeURIComponent(be.site) + "/can", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (j) { can = { otp: !!j.otp, pts: !!j.pts, rz: String(j.rz || ""), pg: Array.isArray(j.pg) ? j.pg : [] }; if (ui.drawer === "checkout") { sync(); over(true); } } }).catch(() => {}); }
  }
  window.RestOrder = { page, bind };
})();
