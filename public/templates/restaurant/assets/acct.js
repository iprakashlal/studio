/* Customer accounts for a shop or a restaurant (content.account). A customer signs in with a code sent to their mobile
   number or their email address (new or returning: it is the same step), stays signed in on this device, and opens
   "My account": a drawer with the order in progress and its tracking, the order history with a bill for every order,
   and their profile (name, the other contact, saved addresses). The site's own database sends the codes and keeps it all.
   window.SiteAcct = { init, on, user, profile, gate, open, out, skipped } */
(function () {
  "use strict";
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const digits = (s) => String(s || "").replace(/\D/g, "");
  const VIA = { wa: "on WhatsApp", sms: "by SMS" };
  /* An order's progress, as the customer reads it. */
  const LIVE = { new: 0, read: 0, replied: 1, accepted: 1, preparing: 2, ready: 3, out: 4, done: 5, archived: 5 };
  const STEPS = { restaurant: ["Received", "Accepted", "Being prepared", "Ready", "On the way", "Completed"], store: ["Received", "Confirmed", "Packed", "Ready to ship", "Shipped", "Delivered"] };
  let cfg = null, can = null, me = null, skip = null, where = null, modal = null, data = null, timer = 0;
  const ui = { tab: "", val: "", sent: false, via: "", msg: "", busy: false, open: "", view: "", saved: "", addrs: null };
  const key = () => "acct:" + cfg.site;
  const post = (path, body) => fetch(cfg.api + "/" + path + "/" + encodeURIComponent(cfg.site), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const steps = () => STEPS[cfg.kind === "store" ? "store" : "restaurant"];
  const label = (o) => (o.status === "cancelled" ? "Cancelled" : steps()[LIVE[o.status] || 0]);
  const active = (o) => o.status !== "cancelled" && (LIVE[o.status] || 0) < 5;

  const CSS = `
.sa{--sa-r:var(--r,12px);font-family:var(--fb,inherit);color:var(--text,#1b1a17);display:grid;gap:14px;text-align:left;font-size:15px;line-height:1.5}
.sa h3,.sa-title{margin:0;font-family:var(--fd,inherit);font-weight:700;font-size:21px;line-height:1.2;letter-spacing:-.01em}.sa p{margin:0}.sa .sa-soft{color:var(--soft,#6b665d);font-size:13.5px;line-height:1.5}
.sa-seg{display:inline-flex;justify-self:start;border:1px solid var(--line,#ddd);border-radius:999px;padding:3px;gap:2px;max-width:100%}
.sa-seg button{border:0;background:transparent;color:inherit;opacity:.72;font:inherit;font-size:13.5px;font-weight:600;padding:7px 15px;border-radius:999px;cursor:pointer;white-space:nowrap}
.sa-seg button[aria-pressed=true],.sa-seg button[aria-selected=true]{background:var(--text,#1b1a17);color:var(--bg,#fff);opacity:1}.sa-seg.sm button{font-size:13px;padding:6px 13px}
.sa-f{display:grid;gap:6px;min-width:0}.sa-f label{font-size:12.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--soft,#6b665d)}
.sa-f input,.sa-in input{width:100%;box-sizing:border-box;border:1px solid var(--line,#ddd);background:var(--surface,#fff);color:inherit;border-radius:calc(var(--sa-r)*.6 + 4px);padding:12px 14px;font:inherit;font-size:16px;min-height:48px}
.sa-f input:focus,.sa-in input:focus{outline:2px solid var(--c1,var(--accent,#1f4d3a));outline-offset:1px}.sa-f input[readonly]{opacity:.7}
.sa-in{position:relative}.sa-in input{padding-right:124px}
.sa-in button{position:absolute;right:6px;top:50%;transform:translateY(-50%);height:36px;padding:0 16px;border:0;border-radius:calc(var(--sa-r)*.5 + 2px);background:var(--text,#1b1a17);color:var(--bg,#fff);font:inherit;font-weight:700;font-size:14px;cursor:pointer;white-space:nowrap}
.sa-in button[disabled],.sa-btn[disabled]{opacity:.5;cursor:default}
.sa-link{justify-self:start;border:0;background:none;padding:0;color:inherit;font:inherit;font-size:13.5px;font-weight:600;text-decoration:underline;cursor:pointer;opacity:.8}
.sa-bad{color:#b3261e;font-size:13.5px;font-weight:600}html[data-dark=true] .sa-bad{color:#ff9e94}.sa-good{color:#1e7a46;font-size:13.5px;font-weight:600}html[data-dark=true] .sa-good{color:#7bd9a0}
.sa-card{border:1px solid var(--line,#ddd);background:var(--surface,#fff);border-radius:calc(var(--sa-r) + 2px);padding:22px;max-width:460px}
.sa-back{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.5);display:flex;justify-content:flex-end}
.sa-drawer{width:min(480px,100vw);height:100%;background:var(--bg,#fff);color:var(--text,#1b1a17);font-family:var(--fb,inherit);box-shadow:-20px 0 60px -20px rgba(0,0,0,.5);display:flex;flex-direction:column;animation:sa-in .22s ease-out}
@keyframes sa-in{from{transform:translateX(24px);opacity:0}to{transform:none;opacity:1}}@media (prefers-reduced-motion:reduce){.sa-drawer{animation:none}}
.sa-head{display:flex;align-items:center;gap:10px;padding:16px 18px;border-bottom:1px solid var(--line,#ddd);flex:none}.sa-head .sa-title{flex:1}
.sa-x{border:1px solid var(--line,#ddd);background:transparent;color:inherit;border-radius:999px;width:38px;height:38px;font-size:19px;line-height:1;cursor:pointer;flex:none}
.sa-body{flex:1;overflow-y:auto;padding:18px;display:grid;gap:16px;align-content:start}
.sa-who{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:14px}.sa-who b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}
.sa-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px}.sa-stat{border:1px solid var(--line,#ddd);background:var(--surface,#fff);border-radius:var(--sa-r);padding:11px 14px}
.sa-stat b{display:block;font-family:var(--fd,inherit);font-size:22px;line-height:1.2}.sa-stat span{font-size:12.5px;color:var(--soft,#6b665d)}
.sa-orders{display:grid;gap:10px}.sa-o{border:1px solid var(--line,#ddd);background:var(--surface,#fff);border-radius:var(--sa-r);overflow:hidden}
.sa-o>button{display:grid;grid-template-columns:auto 1fr auto;gap:2px 12px;align-items:center;width:100%;text-align:left;border:0;background:none;color:inherit;font:inherit;padding:12px 14px;cursor:pointer}
.sa-thumbs{grid-row:1/3;display:flex}.sa-thumbs img,.sa-thumbs i{width:44px;height:44px;border-radius:calc(var(--sa-r)*.5 + 2px);object-fit:cover;border:2px solid var(--surface,#fff);background:rgba(127,127,127,.16);margin-left:-14px;display:grid;place-items:center;font-style:normal;font-size:12px;font-weight:700;color:var(--soft,#6b665d)}.sa-thumbs>:first-child{margin-left:0}
.sa-o b{font-size:14.5px}.sa-o .sa-when{grid-column:2;font-size:12.5px;color:var(--soft,#6b665d)}.sa-o .sa-amt{font-weight:700;text-align:right}
.sa-chip{justify-self:end;font-size:11.5px;font-weight:700;border-radius:999px;padding:3px 9px;background:rgba(127,127,127,.14);white-space:nowrap}.sa-chip[data-s=done]{background:rgba(30,122,70,.14);color:#1e7a46}.sa-chip[data-s=cancelled]{background:rgba(179,38,30,.12);color:#b3261e}
.sa-more{padding:0 14px 14px;display:grid;gap:10px}.sa-lines{margin:0;padding:0;list-style:none;display:grid;gap:6px}.sa-lines li{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;font-size:13.5px}
.sa-lines img,.sa-lines i{width:36px;height:36px;border-radius:8px;object-fit:cover;background:rgba(127,127,127,.16)}.sa-more pre{margin:0;white-space:pre-wrap;font:inherit;font-size:13px;color:var(--soft,#6b665d)}
.sa-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.sa-btn{border:1px solid var(--line,#ddd);background:transparent;color:inherit;border-radius:999px;padding:8px 15px;font:inherit;font-weight:700;font-size:13.5px;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center}
.sa-btn.pri{background:var(--text,#1b1a17);color:var(--bg,#fff);border-color:transparent}
.sa-track{display:grid;gap:0;margin:2px 0 0;padding:0;list-style:none}.sa-track li{display:grid;grid-template-columns:18px 1fr;gap:10px;align-items:start;font-size:13.5px;color:var(--soft,#6b665d);padding-bottom:10px;position:relative}
.sa-track li::before{content:"";width:12px;height:12px;border-radius:50%;border:2px solid var(--line,#ccc);background:var(--surface,#fff);margin:3px 0 0 1px;box-sizing:border-box}
.sa-track li::after{content:"";position:absolute;left:6.5px;top:17px;bottom:-1px;width:2px;background:var(--line,#ccc)}.sa-track li:last-child{padding-bottom:0}.sa-track li:last-child::after{display:none}
.sa-track li[data-on]{color:inherit;font-weight:600}.sa-track li[data-on]::before{background:var(--text,#1b1a17);border-color:var(--text,#1b1a17)}.sa-track li[data-on]::after{background:var(--text,#1b1a17)}.sa-track li[data-now]::before{box-shadow:0 0 0 4px rgba(127,127,127,.22)}
.sa-form{display:grid;gap:12px}.sa-two{display:grid;grid-template-columns:1fr 1fr;gap:10px}@media (max-width:420px){.sa-two{grid-template-columns:1fr}}
.sa-addr{border:1px solid var(--line,#ddd);background:var(--surface,#fff);border-radius:var(--sa-r);padding:14px;display:grid;gap:10px}.sa-addr .sa-row{justify-content:space-between}.sa-addr b{font-size:13.5px}
.sa-empty{border:1px dashed var(--line,#ccc);border-radius:var(--sa-r);padding:22px;text-align:center;color:var(--soft,#6b665d);font-size:14px}
`;
  function style() { if (document.getElementById("sa-css")) return; const s = document.createElement("style"); s.id = "sa-css"; s.textContent = CSS; document.head.appendChild(s); }

  const kinds = () => (can ? [can.phone && can.phone.length ? "phone" : "", can.email ? "email" : ""].filter(Boolean) : []);
  const tab = () => (kinds().includes(ui.tab) ? ui.tab : kinds()[0] || "phone");
  const viaNow = () => (can && can.phone.includes(ui.via) ? ui.via : (can && can.phone[0]) || "wa");
  const show = (k) => (/@/.test(k) ? k : "+" + k);
  const pic = (p) => (p && cfg.img ? cfg.img(p) : "");
  const when = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) + ", " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); };

  /** The sign-in step: one box for the number or the address, then the code. New and returning customers alike. */
  function formHTML(card) {
    const t = tab(), ks = kinds(), phone = t === "phone";
    const box = ui.sent
      ? `<div class="sa-f"><label for="sa-code">Code we sent ${phone ? VIA[viaNow()] : "to your email"}</label><div class="sa-in"><input id="sa-code" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="Enter the code"><button type="button" data-sa="check"${ui.busy ? " disabled" : ""}>Continue</button></div></div>
         <p class="sa-soft">Sent to <b>${esc(ui.val)}</b>. <button type="button" class="sa-link" data-sa="again">Change</button> · <button type="button" class="sa-link" data-sa="send">Send a new code</button></p>`
      : `<div class="sa-f"><label for="sa-val">${phone ? "Mobile number" : "Email address"}</label><div class="sa-in"><input id="sa-val" ${phone ? 'type="tel" inputmode="tel" autocomplete="tel" placeholder="Your mobile number"' : 'type="email" autocomplete="email" placeholder="you@example.com"'} value="${esc(ui.val)}"><button type="button" data-sa="send"${ui.busy ? " disabled" : ""}>Send code</button></div></div>
         ${phone && can.phone.length > 1 ? `<div class="sa-seg sm" role="group" aria-label="Send the code">${can.phone.map((v) => `<button type="button" data-sa="via" data-v="${v}" aria-pressed="${viaNow() === v}">${v === "wa" ? "WhatsApp" : "SMS"}</button>`).join("")}</div>` : ""}
         <p class="sa-soft">We send a one-time code ${phone ? can.phone.map((v) => VIA[v]).join(" or ") : "to this address"}. No password to remember.</p>`;
    return `<div class="sa${card ? " sa-card" : ""}" data-sa-form><div><h3>Sign in or create your account</h3><p class="sa-soft" style="margin-top:6px">New here? It is the same step: enter your ${ks.length > 1 ? "mobile number or email" : phone ? "mobile number" : "email address"} and we set you up.</p></div>
      ${ks.length > 1 && !ui.sent ? `<div class="sa-seg" role="group" aria-label="Sign in with">${ks.map((k) => `<button type="button" data-sa="tab" data-v="${k}" aria-pressed="${t === k}">${k === "phone" ? "Mobile" : "Email"}</button>`).join("")}</div>` : ""}
      ${box}${ui.msg ? `<p class="sa-bad" role="alert">${esc(ui.msg)}</p>` : ""}</div>`;
  }

  /* ---- My account: the order in progress, the history, the profile */
  const thumbs = (o) => { const it = (o.items || []).slice(0, 3); return `<span class="sa-thumbs">${it.length ? it.map((x) => (pic(x.i) ? `<img src="${esc(pic(x.i))}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : `<i>${esc(String(x.n || "?").slice(0, 1).toUpperCase())}</i>`)).join("") + ((o.items || []).length > 3 ? `<i>+${o.items.length - 3}</i>` : "") : `<i>#</i>`}</span>`; };
  const lines = (o) => ((o.items || []).length ? `<ul class="sa-lines">${o.items.map((x) => `<li>${pic(x.i) ? `<img src="${esc(pic(x.i))}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : `<i></i>`}<span>${esc(x.n)}</span><b>× ${x.q}</b></li>`).join("")}</ul>` : o.text ? `<pre>${esc(o.text)}</pre>` : "");
  function track(o) {
    if (o.status === "cancelled") return `<p class="sa-bad">This order was cancelled.</p>`;
    const at = LIVE[o.status] || 0, S = steps().filter((_, i) => !(cfg.kind !== "store" && i === 4 && !/deliver/i.test(o.mode || "")));
    const idx = steps().map((_, i) => i).filter((i) => !(cfg.kind !== "store" && i === 4 && !/deliver/i.test(o.mode || "")));
    return `<ol class="sa-track" aria-label="Where this order is">${S.map((s, k) => `<li${idx[k] <= at ? " data-on" : ""}${idx[k] === at ? ' data-now aria-current="step"' : ""}>${esc(s)}</li>`).join("")}</ol>`;
  }
  function orderHTML(o, live) {
    const open = live || ui.open === o.no, t = cfg.track && cfg.track(o);
    return `<div class="sa-o" data-order="${esc(o.no)}"><button type="button" data-sa="toggle" data-v="${esc(o.no)}" aria-expanded="${open}">${thumbs(o)}<b>${esc(o.no)}</b><span class="sa-amt">${esc(o.total)}</span><span class="sa-when">${esc(when(o.at))}${o.mode ? " · " + esc(o.mode) : ""}</span><span class="sa-chip" data-s="${esc(o.status === "cancelled" ? "cancelled" : (LIVE[o.status] || 0) >= 5 ? "done" : "")}">${esc(label(o))}${o.paid ? " · Paid" : ""}</span></button>
      ${open ? `<div class="sa-more">${live ? track(o) : ""}${lines(o)}${o.points ? `<p class="sa-soft" style="font-weight:600">${esc(o.points)}</p>` : ""}<div class="sa-row"><button type="button" class="sa-btn" data-sa="bill" data-v="${esc(o.no)}">Download bill</button>${t ? `<a class="sa-btn" href="${esc(t)}">Open tracking page</a>` : ""}</div></div>` : ""}</div>`;
  }
  const blankAddr = () => ({ label: "", line1: "", line2: "", city: "", pin: "", state: "" });
  function profileHTML(d) {
    const byMail = me.kind === "email", A = ui.addrs || (ui.addrs = (d.addresses && d.addresses.length ? d.addresses : [blankAddr()]).map((a) => ({ ...blankAddr(), ...a }))), many = !!cfg.addresses;
    const f = (id, lab, val, more) => `<div class="sa-f"><label for="${id}">${lab}</label><input id="${id}" value="${esc(val || "")}" ${more || ""}></div>`;
    return `<form class="sa-form" data-sa-profile novalidate>
      ${f("sa-name", "Name", d.name, 'autocomplete="name" maxlength="100"')}
      <div class="sa-two">${f("sa-phone", "Mobile number", d.phone, byMail ? 'type="tel" inputmode="tel" autocomplete="tel"' : "readonly")}${f("sa-email", "Email address", d.email, byMail ? "readonly" : 'type="email" autocomplete="email"')}</div>
      <p class="sa-soft">You sign in with your ${byMail ? "email address" : "mobile number"}, so that one can't be changed here.</p>
      <p class="sa-soft" style="font-weight:700;color:inherit">${many ? "Saved addresses" : "Your address"}</p>
      ${A.map((a, i) => `<div class="sa-addr" data-addr="${i}">${many ? `<div class="sa-row"><b>Address ${i + 1}</b>${A.length > 1 ? `<button type="button" class="sa-link" data-sa="deladdr" data-v="${i}">Remove</button>` : ""}</div>${f("sa-a-label-" + i, "Name for it (optional)", a.label, 'placeholder="Home, Office…" maxlength="30"')}` : ""}
        ${f("sa-a-line1-" + i, "Address", a.line1, 'autocomplete="address-line1"')}${f("sa-a-line2-" + i, "Area or landmark (optional)", a.line2, 'autocomplete="address-line2"')}
        <div class="sa-two">${f("sa-a-city-" + i, "City", a.city, 'autocomplete="address-level2"')}${f("sa-a-pin-" + i, "PIN code", a.pin, 'inputmode="numeric" autocomplete="postal-code"')}</div>${many ? f("sa-a-state-" + i, "State", a.state, 'autocomplete="address-level1"') : ""}</div>`).join("")}
      ${many && A.length < 6 ? `<button type="button" class="sa-link" data-sa="addaddr">+ Add another address</button>` : ""}
      ${ui.msg ? `<p class="sa-bad" role="alert">${esc(ui.msg)}</p>` : ui.saved ? `<p class="sa-good" role="status">${esc(ui.saved)}</p>` : ""}
      <div class="sa-row"><button type="button" class="sa-btn pri" data-sa="save"${ui.busy ? " disabled" : ""}>${ui.busy ? "Saving…" : "Save"}</button></div></form>`;
  }
  function acctHTML() {
    const d = data;
    if (!d) return `<div class="sa"><p class="sa-soft">Loading your account…</p></div>`;
    if (d.error) return `<div class="sa"><p class="sa-bad" role="alert">${esc(d.error)}</p></div>`;
    const live = d.orders.filter(active), past = d.orders.filter((o) => !active(o)), view = ui.view || (live.length ? "now" : "orders");
    const L = d.loyalty, worth = L && L.worth > 0 ? Math.round(d.points * L.worth * 100) / 100 : 0, m = cfg.money || ((n) => String(n));
    const tabs = [["now", "Current order" + (live.length > 1 ? "s" : "")], ["orders", "Order history"], ["profile", "Profile"]];
    return `<div class="sa"><div class="sa-who"><b>${esc(d.name || show(me.key))}${d.name ? `<span class="sa-soft" style="display:block;font-weight:400">${esc(show(me.key))}</span>` : ""}</b><button type="button" class="sa-link" data-sa="out">Sign out</button></div>
      <div class="sa-stats">${L ? `<div class="sa-stat"><b>${d.points}</b><span>point${d.points === 1 ? "" : "s"}${worth ? ` · worth up to ${esc(m(worth))}` : ""}</span></div>` : ""}<div class="sa-stat"><b>${d.count}</b><span>order${d.count === 1 ? "" : "s"}</span></div></div>
      <div class="sa-seg" role="tablist" aria-label="My account">${tabs.map(([k, l]) => `<button type="button" role="tab" data-sa="view" data-v="${k}" aria-selected="${view === k}">${l}${k === "now" && live.length ? ` (${live.length})` : ""}</button>`).join("")}</div>
      ${view === "now" ? (live.length ? `<div class="sa-orders">${live.map((o) => orderHTML(o, true)).join("")}</div><p class="sa-soft">This updates by itself while it is open.</p>` : `<div class="sa-empty">No order in progress.</div>`)
        : view === "orders" ? (past.length || live.length ? `<div class="sa-orders">${[...live, ...past].map((o) => orderHTML(o, false)).join("")}</div>` : `<div class="sa-empty">No orders yet. They show here once you place one while signed in.</div>`)
        : profileHTML(d)}</div>`;
  }
  function draw() {
    style();
    if (where && document.contains(where) && !me) where.innerHTML = formHTML(true);
    if (modal) { const b = modal.querySelector(".sa-body"), y = b.scrollTop; b.innerHTML = me ? acctHTML() : formHTML(false); b.scrollTop = y; modal.querySelector(".sa-title").textContent = me ? "My account" : "Sign in"; }
  }
  const keepVal = () => { const i = document.getElementById("sa-val"); if (i) ui.val = i.value.trim(); };
  /** What is typed in the profile form, read back into the working copy (so a redraw keeps it). */
  function readProfile() {
    const v = (id) => String((document.getElementById(id) || {}).value || "").trim(); if (!document.getElementById("sa-name") || !data || data.error) return;
    data.name = v("sa-name"); if (me.kind === "email") data.phone = v("sa-phone"); else data.email = v("sa-email");
    (ui.addrs || []).forEach((a, i) => { for (const k of ["label", "line1", "line2", "city", "pin", "state"]) if (document.getElementById("sa-a-" + k + "-" + i)) a[k] = v("sa-a-" + k + "-" + i); });
  }
  /** A bill for one order: a page of its own that prints (or saves as a PDF) cleanly. */
  function bill(o) {
    const B = cfg.biz || {}, rows = (o.items || []).length ? `<table><thead><tr><th>Item</th><th class="r">Qty</th></tr></thead><tbody>${o.items.map((x) => `<tr><td>${esc(x.n)}</td><td class="r">${x.q}</td></tr>`).join("")}</tbody></table>` : "";
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bill ${esc(o.no)}</title><style>
body{font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#111;margin:0;padding:32px;max-width:760px;margin-inline:auto}h1{font-size:22px;margin:0}h2{font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#666;margin:22px 0 6px}
.top{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:16px}.top p{margin:2px 0;color:#444;font-size:13.5px}.r{text-align:right}
table{width:100%;border-collapse:collapse;margin-top:6px}th,td{padding:8px 0;border-bottom:1px solid #ddd;text-align:left;font-size:14px}th{font-size:12px;letter-spacing:.05em;text-transform:uppercase;color:#666}
pre{white-space:pre-wrap;font:inherit;font-size:14px;margin:6px 0 0}.tot{display:flex;justify-content:space-between;font-size:18px;font-weight:700;border-top:2px solid #111;margin-top:18px;padding-top:12px}
.note{color:#666;font-size:12.5px;margin-top:26px}button{font:inherit;font-weight:700;padding:10px 18px;border-radius:999px;border:1px solid #111;background:#111;color:#fff;cursor:pointer;margin-top:22px}@media print{button{display:none}body{padding:0}}
</style></head><body><div class="top"><div><h1>${esc(B.name || "")}</h1>${B.address ? `<p>${esc(B.address)}</p>` : ""}${B.phone ? `<p>${esc(B.phone)}</p>` : ""}${B.email ? `<p>${esc(B.email)}</p>` : ""}${B.gstin ? `<p>GSTIN: ${esc(B.gstin)}</p>` : ""}</div><div class="r"><p><b>Bill</b></p><p>${esc(o.no)}</p><p>${esc(when(o.at))}</p><p>${esc(label(o))}${o.paid ? " · Paid" : ""}</p></div></div>
<h2>Billed to</h2><p>${esc(o.name || (data && data.name) || "")}<br>${esc(show(me.key))}${o.address ? "<br>" + esc(o.address) : ""}</p>
<h2>Order${o.mode ? " · " + esc(o.mode) : ""}</h2>${rows}${o.text ? `<pre>${esc(o.text)}</pre>` : ""}
<div class="tot"><span>Total${o.pay ? ` <span style="font-weight:400;font-size:13.5px;color:#666">· ${esc(o.pay)}</span>` : ""}</span><span>${esc(o.total)}</span></div>
<p class="note">This bill is made from your order as it was placed${B.gstin ? "" : ". It is not a tax invoice"}.</p><button onclick="print()">Print or save as PDF</button></body></html>`;
    const blob = new Blob([html], { type: "text/html" }), url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = "Bill-" + String(o.no).replace(/[^\w-]+/g, "") + ".html"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  async function act(a, v) {
    if (a === "close") return shut();
    if (a === "out") { out(); return; }
    if (a === "toggle") { ui.open = ui.open === v ? "" : v; return draw(); }
    if (a === "view") { readProfile(); ui.view = v; ui.msg = ""; ui.saved = ""; return draw(); }
    if (a === "bill") { const o = data && data.orders.find((x) => x.no === v); if (o) bill(o); return; }
    if (a === "addaddr") { readProfile(); ui.addrs.push(blankAddr()); return draw(); }
    if (a === "deladdr") { readProfile(); ui.addrs.splice(+v, 1); return draw(); }
    if (a === "save") {
      readProfile(); ui.msg = ""; ui.saved = ""; ui.busy = true; draw();
      try { const r = await post("acct/save", { key: me.key, pass: me.pass, name: data.name, phone: data.phone, email: data.email, addresses: ui.addrs }), j = await r.json().catch(() => null);
        if (r.status === 401) { ui.busy = false; out(); return; }
        if (!r.ok || !j || !j.profile) ui.msg = (j && j.error) || "Couldn't save that. Please try again.";
        else { Object.assign(data, j.profile); ui.addrs = null; ui.saved = "Saved."; keepProfile(); changed(); }
      } catch (e) { ui.msg = "Couldn't reach us just now. Check your connection."; }
      ui.busy = false; return draw();
    }
    if (a === "tab") { keepVal(); ui.tab = v; ui.val = ""; ui.msg = ""; return draw(); }
    if (a === "via") { keepVal(); ui.via = v; return draw(); }
    if (a === "again") { ui.sent = false; ui.msg = ""; return draw(); }
    const phone = tab() === "phone"; keepVal();
    const code = String((document.getElementById("sa-code") || {}).value || "").trim();
    if (a === "send") {
      if (phone ? digits(ui.val).length < 8 : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ui.val)) { ui.msg = phone ? "Enter your mobile number." : "Enter your email address."; return draw(); }
    } else if (!/^\d{4,8}$/.test(code)) { ui.msg = "Enter the code."; return draw(); }
    ui.msg = ""; ui.busy = true; draw();
    try {
      const body = phone ? { phone: ui.val, code, via: viaNow() } : { email: ui.val, code };
      const r = await post((phone ? "otp/" : "eotp/") + (a === "send" ? "send" : "check"), body), j = await r.json().catch(() => null);
      if (!r.ok) ui.msg = (j && j.error) || "That didn't work. Please try again.";
      else if (a === "send" && j && j.skip) { // no code can be emailed just now: the order isn't held up, but there is no account to open
        skip = { email: ui.val.toLowerCase(), token: "s:" + j.skip }; ui.busy = false; shut(); changed(); return; }
      else if (a === "send") { ui.sent = true; if (j && j.via) ui.via = j.via; }
      else {
        const r2 = await post("acct/in", phone ? { phone: ui.val, otp: j.token } : { email: ui.val, eotp: j.token }), j2 = await r2.json().catch(() => null);
        if (!r2.ok || !j2 || !j2.pass) ui.msg = (j2 && j2.error) || "Couldn't sign you in. Please try again.";
        else { me = { key: j2.key, kind: j2.kind, pass: j2.pass, typed: ui.val }; try { localStorage.setItem(key(), JSON.stringify(me)); } catch (e) { /* private window */ } ui.sent = false; ui.val = ""; ui.busy = false; ui.view = ""; data = null; draw(); await load(); changed(); return; }
      }
    } catch (e) { ui.msg = "Couldn't reach us just now. Check your connection."; }
    ui.busy = false; draw(); const f = document.getElementById(ui.sent ? "sa-code" : "sa-val"); if (f) f.focus();
  }
  document.addEventListener("click", (e) => { const b = e.target.closest && e.target.closest("[data-sa]"); if (!b || !cfg) return; e.preventDefault(); act(b.getAttribute("data-sa"), b.getAttribute("data-v")); });
  document.addEventListener("keydown", (e) => { if (!cfg) return; if (e.key === "Escape" && modal) return shut(); if (e.key !== "Enter") return; const id = e.target && e.target.id; if (id === "sa-val") { e.preventDefault(); act("send"); } else if (id === "sa-code") { e.preventDefault(); act("check"); } else if (e.target.closest && e.target.closest("[data-sa-profile]")) { e.preventDefault(); act("save"); } });
  function changed() { try { cfg.onChange && cfg.onChange(me); } catch (e) { /* the page's own business */ } }

  /* The profile is kept on the device too, so a checkout can fill itself in before the account has loaded. */
  let prof = null;
  function keepProfile() { prof = data && !data.error ? { name: data.name || "", phone: data.phone || "", email: data.email || "", addresses: data.addresses || [] } : prof; try { if (prof) localStorage.setItem(key() + ":p", JSON.stringify(prof)); } catch (e) { /* private window */ } }
  async function load(quiet) {
    if (!me) return;
    try { const r = await post("acct/me", { key: me.key, pass: me.pass }), j = await r.json().catch(() => null);
      if (r.status === 401) { out(); return; }
      if (r.ok && j) { const typing = quiet && data && !data.error && ui.view === "profile"; if (typing) data.orders = j.orders; else { data = j; ui.addrs = null; } keepProfile(); }
      else if (!quiet) data = { error: (j && j.error) || "Couldn't load your account just now." };
    } catch (e) { if (!quiet) data = { error: "Couldn't reach us just now. Check your connection." }; }
    if (!(quiet && ui.view === "profile")) draw();
  }
  /** The page's address with #account on the end opens this (a link to "My account" from anywhere, or from a message). */
  const asked = () => /^#account$/i.test(location.hash);
  function open(view) {
    if (!cfg || !can) return; style();
    if (!modal) { modal = document.createElement("div"); modal.className = "sa-back"; modal.innerHTML = `<aside class="sa-drawer" role="dialog" aria-modal="true" aria-label="My account"><div class="sa-head"><span class="sa-title">My account</span><button type="button" class="sa-x" data-sa="close" aria-label="Close">×</button></div><div class="sa-body"></div></aside>`;
      modal.addEventListener("mousedown", (e) => { if (e.target === modal) shut(); }); document.body.appendChild(modal);
      clearInterval(timer); timer = setInterval(() => { if (modal && me && data && !data.error && data.orders.some(active)) load(true); }, 20000); }
    ui.msg = ""; ui.saved = ""; ui.view = typeof view === "string" ? view : ""; draw(); if (me) load(); else { const f = document.getElementById("sa-val"); if (f) f.focus(); }
  }
  function shut() { clearInterval(timer); if (modal) { modal.remove(); modal = null; } if (asked()) try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* the address stays */ } }
  addEventListener("hashchange", () => { if (asked() && cfg && can && !modal) open(); });
  function out() { me = null; data = null; prof = null; ui.addrs = null; try { localStorage.removeItem(key()); localStorage.removeItem(key() + ":p"); } catch (e) { /* private window */ } shut(); changed(); draw(); }

  window.SiteAcct = {
    /** { api, site, kind ("restaurant" | "store"), acct (from the database's "what can this site do"), addresses (several can be kept),
     *    money(n), img(path), track(order), biz { name, address, phone, email, gstin }, onChange(user) } */
    init(o) { cfg = o; can = o.acct || null; me = null; prof = null; try { me = JSON.parse(localStorage.getItem(key()) || "null"); } catch (e) { me = null; }
      if (me && !(+String(me.pass).split(".")[0] > Date.now() && me.key)) me = null;
      if (me && can && !kinds().includes(me.kind)) me = null;
      if (me) try { prof = JSON.parse(localStorage.getItem(key() + ":p") || "null"); } catch (e) { prof = null; }
      if (asked() && can && !modal) setTimeout(open, 0); },
    /** Signing in is offered here. */
    on: () => !!(cfg && can),
    user: () => me,
    /** The signed-in customer's own details (name, contacts, addresses), as last saved or loaded; null before that. */
    profile: () => (me ? prof : null),
    /** The note that no code could be emailed to this address: checkout goes ahead without an account. */
    skipped: () => skip,
    /** Draws the sign-in step into an element (the checkout, before its form). */
    gate(el) { where = el; ui.msg = ""; draw(); },
    open, out,
  };
})();
