/* Customer accounts for a shop or a restaurant (content.account). A customer signs in with a code sent to their mobile
   number or their email address (new or returning: it is the same step), stays signed in on this device, and can open
   "My account" to see their orders and points. The site's own database sends the codes and keeps the records.
   window.SiteAcct = { init, on, user, gate, open, out, skipped } */
(function () {
  "use strict";
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const digits = (s) => String(s || "").replace(/\D/g, "");
  const VIA = { wa: "on WhatsApp", sms: "by SMS" };
  const STATUS = { new: "Received", read: "Received", replied: "Received", accepted: "Accepted", preparing: "Being prepared", ready: "Ready", out: "On the way", done: "Completed", archived: "Completed", cancelled: "Cancelled" };
  let cfg = null, can = null, me = null, skip = null, where = null, modal = null, data = null;
  const ui = { tab: "", val: "", sent: false, via: "", msg: "", busy: false, open: "" };
  const key = () => "acct:" + cfg.site;
  const post = (path, body) => fetch(cfg.api + "/" + path + "/" + encodeURIComponent(cfg.site), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  const CSS = `
.sa{--sa-r:var(--r,12px);font:inherit;color:var(--text,#1b1a17);display:grid;gap:14px;text-align:left}
.sa h3{margin:0;font:inherit;font-weight:800;font-size:19px;line-height:1.25}.sa p{margin:0}.sa .sa-soft{color:var(--soft,#6b665d);font-size:13.5px;line-height:1.5}
.sa-tabs{display:inline-flex;justify-self:start;border:1px solid var(--line,#ddd);border-radius:999px;padding:3px;gap:2px}
.sa-tabs button,.sa-via button{border:0;background:transparent;color:inherit;opacity:.72;font:inherit;font-size:13.5px;font-weight:600;padding:7px 15px;border-radius:999px;cursor:pointer}
.sa-tabs button[aria-pressed=true],.sa-via button[aria-pressed=true]{background:var(--text,#1b1a17);color:var(--bg,#fff);opacity:1}
.sa-via{display:inline-flex;justify-self:start;border:1px solid var(--line,#ddd);border-radius:999px;padding:3px;gap:2px}.sa-via button{font-size:13px;padding:6px 13px}
.sa-f{display:grid;gap:6px}.sa-f label{font-size:12.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--soft,#6b665d)}
.sa-in{position:relative}.sa-in input{width:100%;box-sizing:border-box;border:1px solid var(--line,#ddd);background:var(--surface,#fff);color:inherit;border-radius:calc(var(--sa-r)*.6 + 4px);padding:13px 124px 13px 14px;font:inherit;font-size:16px;min-height:50px}
.sa-in input:focus{outline:2px solid var(--c1,var(--accent,#1f4d3a));outline-offset:1px}
.sa-in button{position:absolute;right:6px;top:50%;transform:translateY(-50%);height:38px;padding:0 16px;border:0;border-radius:calc(var(--sa-r)*.5 + 2px);background:var(--text,#1b1a17);color:var(--bg,#fff);font:inherit;font-weight:700;font-size:14px;cursor:pointer;white-space:nowrap}
.sa-in button[disabled]{opacity:.5;cursor:default}
.sa-link{justify-self:start;border:0;background:none;padding:0;color:inherit;font:inherit;font-size:13.5px;font-weight:600;text-decoration:underline;cursor:pointer;opacity:.8}
.sa-bad{color:#b3261e;font-size:13.5px;font-weight:600}html[data-dark=true] .sa-bad{color:#ff9e94}
.sa-card{border:1px solid var(--line,#ddd);background:var(--surface,#fff);border-radius:calc(var(--sa-r) + 2px);padding:22px;max-width:460px}
.sa-back{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.5);display:flex;align-items:flex-start;justify-content:center;padding:6vh 14px 14px;overflow:auto}
.sa-modal{width:100%;max-width:560px;background:var(--bg,#fff);color:var(--text,#1b1a17);border-radius:calc(var(--sa-r) + 6px);padding:22px;box-shadow:0 30px 80px rgba(0,0,0,.35);display:grid;gap:16px}
.sa-head{display:flex;align-items:center;gap:10px}.sa-head h3{flex:1}.sa-x{border:1px solid var(--line,#ddd);background:transparent;color:inherit;border-radius:999px;width:36px;height:36px;font-size:18px;line-height:1;cursor:pointer}
.sa-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px}.sa-stat{border:1px solid var(--line,#ddd);background:var(--surface,#fff);border-radius:var(--sa-r);padding:12px 14px}
.sa-stat b{display:block;font-size:22px;line-height:1.2}.sa-stat span{font-size:12.5px;color:var(--soft,#6b665d)}
.sa-orders{display:grid;gap:8px}.sa-o{border:1px solid var(--line,#ddd);background:var(--surface,#fff);border-radius:var(--sa-r);overflow:hidden}
.sa-o>button{display:grid;grid-template-columns:1fr auto;gap:2px 12px;width:100%;text-align:left;border:0;background:none;color:inherit;font:inherit;padding:12px 14px;cursor:pointer}
.sa-o b{font-size:14.5px}.sa-o .sa-when{font-size:12.5px;color:var(--soft,#6b665d)}.sa-o .sa-amt{font-weight:700;text-align:right}
.sa-chip{justify-self:end;font-size:11.5px;font-weight:700;border-radius:999px;padding:3px 9px;background:rgba(127,127,127,.14)}.sa-chip[data-s=done]{background:rgba(30,122,70,.14);color:#1e7a46}.sa-chip[data-s=cancelled]{background:rgba(179,38,30,.12);color:#b3261e}
.sa-o pre{margin:0;padding:0 14px 12px;white-space:pre-wrap;font:inherit;font-size:13px;color:var(--soft,#6b665d)}.sa-o .sa-pts{padding:0 14px 12px;font-size:12.5px;font-weight:600}
.sa-foot{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.sa-btn{border:1px solid var(--line,#ddd);background:transparent;color:inherit;border-radius:999px;padding:9px 16px;font:inherit;font-weight:700;font-size:14px;cursor:pointer}
.sa-who{display:flex;align-items:center;gap:10px;flex-wrap:wrap;border:1px solid var(--line,#ddd);background:var(--surface,#fff);border-radius:var(--sa-r);padding:10px 14px;font-size:14px}.sa-who b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}
`;
  function style() { if (document.getElementById("sa-css")) return; const s = document.createElement("style"); s.id = "sa-css"; s.textContent = CSS; document.head.appendChild(s); }

  const kinds = () => (can ? [can.phone && can.phone.length ? "phone" : "", can.email ? "email" : ""].filter(Boolean) : []);
  const tab = () => (kinds().includes(ui.tab) ? ui.tab : kinds()[0] || "phone");
  const viaNow = () => (can && can.phone.includes(ui.via) ? ui.via : (can && can.phone[0]) || "wa");
  const show = (k) => (/@/.test(k) ? k : "+" + k);

  /** The sign-in step: one box for the number or the address, then the code. New and returning customers alike. */
  function formHTML(card) {
    const t = tab(), ks = kinds(), phone = t === "phone";
    const box = ui.sent
      ? `<div class="sa-f"><label for="sa-code">Code we sent ${phone ? VIA[viaNow()] : "to your email"}</label><div class="sa-in"><input id="sa-code" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="Enter the code"><button type="button" data-sa="check"${ui.busy ? " disabled" : ""}>Continue</button></div></div>
         <p class="sa-soft">Sent to <b>${esc(ui.val)}</b>. <button type="button" class="sa-link" data-sa="again">Change</button> · <button type="button" class="sa-link" data-sa="send">Send a new code</button></p>`
      : `<div class="sa-f"><label for="sa-val">${phone ? "Mobile number" : "Email address"}</label><div class="sa-in"><input id="sa-val" ${phone ? 'type="tel" inputmode="tel" autocomplete="tel" placeholder="Your mobile number"' : 'type="email" autocomplete="email" placeholder="you@example.com"'} value="${esc(ui.val)}"><button type="button" data-sa="send"${ui.busy ? " disabled" : ""}>Send code</button></div></div>
         ${phone && can.phone.length > 1 ? `<div class="sa-via" role="group" aria-label="Send the code">${can.phone.map((v) => `<button type="button" data-sa="via" data-v="${v}" aria-pressed="${viaNow() === v}">${v === "wa" ? "WhatsApp" : "SMS"}</button>`).join("")}</div>` : ""}
         <p class="sa-soft">We send a one-time code ${phone ? can.phone.map((v) => VIA[v]).join(" or ") : "to this address"}. No password to remember.</p>`;
    return `<div class="sa${card ? " sa-card" : ""}" data-sa-form><div><h3>Sign in or create your account</h3><p class="sa-soft" style="margin-top:4px">New here? It is the same step: enter your ${ks.length > 1 ? "mobile number or email" : phone ? "mobile number" : "email address"} and we set you up.</p></div>
      ${ks.length > 1 && !ui.sent ? `<div class="sa-tabs" role="group" aria-label="Sign in with">${ks.map((k) => `<button type="button" data-sa="tab" data-v="${k}" aria-pressed="${t === k}">${k === "phone" ? "Mobile" : "Email"}</button>`).join("")}</div>` : ""}
      ${box}${ui.msg ? `<p class="sa-bad" role="alert">${esc(ui.msg)}</p>` : ""}</div>`;
  }
  function draw() {
    style();
    if (where && document.contains(where) && !me) { where.innerHTML = formHTML(true); }
    if (modal) modal.querySelector(".sa-modal").innerHTML = me ? acctHTML() : `<div class="sa-head"><span style="flex:1"></span><button type="button" class="sa-x" data-sa="close" aria-label="Close">×</button></div>` + formHTML(false);
  }
  const keepVal = () => { const i = document.getElementById("sa-val"); if (i) ui.val = i.value.trim(); };
  async function act(a, v) {
    if (a === "close") return shut();
    if (a === "out") { out(); return; }
    if (a === "toggle") { ui.open = ui.open === v ? "" : v; return draw(); }
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
        else { me = { key: j2.key, kind: j2.kind, pass: j2.pass, typed: ui.val }; try { localStorage.setItem(key(), JSON.stringify(me)); } catch (e) { /* private window */ } ui.sent = false; ui.val = ""; ui.busy = false; data = null; if (modal) load(); changed(); draw(); return; }
      }
    } catch (e) { ui.msg = "Couldn't reach us just now. Check your connection."; }
    ui.busy = false; draw(); const f = document.getElementById(ui.sent ? "sa-code" : "sa-val"); if (f) f.focus();
  }
  document.addEventListener("click", (e) => { const b = e.target.closest && e.target.closest("[data-sa]"); if (!b || !cfg) return; e.preventDefault(); act(b.getAttribute("data-sa"), b.getAttribute("data-v")); });
  document.addEventListener("keydown", (e) => { if (!cfg) return; if (e.key === "Escape" && modal) return shut(); if (e.key !== "Enter") return; const id = e.target && e.target.id; if (id === "sa-val") { e.preventDefault(); act("send"); } else if (id === "sa-code") { e.preventDefault(); act("check"); } });
  function changed() { try { cfg.onChange && cfg.onChange(me); } catch (e) { /* the page's own business */ } }

  /* ---- My account: orders and points */
  const when = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) + ", " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); };
  function acctHTML() {
    const d = data, head = `<div class="sa-head"><h3>My account</h3><button type="button" class="sa-x" data-sa="close" aria-label="Close">×</button></div><div class="sa-who"><b>${esc(show(me.key))}</b><button type="button" class="sa-link" data-sa="out">Sign out</button></div>`;
    if (!d) return `<div class="sa">${head}<p class="sa-soft">Loading your orders…</p></div>`;
    if (d.error) return `<div class="sa">${head}<p class="sa-bad" role="alert">${esc(d.error)}</p></div>`;
    const L = d.loyalty, worth = L && L.worth > 0 ? Math.round(d.points * L.worth * 100) / 100 : 0, m = cfg.money || ((n) => String(n));
    return `<div class="sa">${head}
      <div class="sa-stats">${L ? `<div class="sa-stat"><b>${d.points}</b><span>point${d.points === 1 ? "" : "s"}${worth ? ` · worth up to ${esc(m(worth))}` : ""}</span></div>` : ""}<div class="sa-stat"><b>${d.count}</b><span>order${d.count === 1 ? "" : "s"}</span></div></div>
      ${L && L.min > d.points ? `<p class="sa-soft">Points can be used from ${L.min}.</p>` : L && d.points ? `<p class="sa-soft">Tick “Use my points” at checkout to take them off an order.</p>` : ""}
      <div><p class="sa-soft" style="font-weight:700;margin-bottom:8px">Your orders</p>${d.orders.length ? `<div class="sa-orders">${d.orders.map((o) => `<div class="sa-o"><button type="button" data-sa="toggle" data-v="${esc(o.no)}" aria-expanded="${ui.open === o.no}"><b>${esc(o.no)}</b><span class="sa-amt">${esc(o.total)}</span><span class="sa-when">${esc(when(o.at))}${o.mode ? " · " + esc(o.mode) : ""}</span><span class="sa-chip" data-s="${esc(o.status)}">${esc(STATUS[o.status] || "Received")}${o.paid ? " · Paid" : ""}</span></button>${ui.open === o.no ? `${o.text ? `<pre>${esc(o.text)}</pre>` : ""}${o.points ? `<div class="sa-pts">${esc(o.points)}</div>` : ""}${cfg.track && cfg.track(o) ? `<div class="sa-pts"><a href="${esc(cfg.track(o))}">Track this order</a></div>` : ""}` : ""}</div>`).join("")}</div>` : `<p class="sa-soft">No orders yet. They show here once you place one while signed in.</p>`}</div></div>`;
  }
  async function load() {
    if (!me) return;
    try { const r = await post("acct/me", { key: me.key, pass: me.pass }), j = await r.json().catch(() => null);
      if (r.status === 401) { out(); return; }
      data = r.ok && j ? j : { error: (j && j.error) || "Couldn't load your account just now." };
    } catch (e) { data = { error: "Couldn't reach us just now. Check your connection." }; }
    draw();
  }
  function open() { if (!cfg || !can) return; style(); if (!modal) { modal = document.createElement("div"); modal.className = "sa-back"; modal.innerHTML = `<div class="sa-modal" role="dialog" aria-modal="true" aria-label="My account"></div>`; modal.addEventListener("mousedown", (e) => { if (e.target === modal) shut(); }); document.body.appendChild(modal); } data = null; ui.msg = ""; draw(); if (me) load(); else { const f = document.getElementById("sa-val"); if (f) f.focus(); } }
  function shut() { if (modal) { modal.remove(); modal = null; } }
  function out() { me = null; data = null; try { localStorage.removeItem(key()); } catch (e) { /* private window */ } shut(); changed(); draw(); }

  window.SiteAcct = {
    /** { api, site, acct (from the database's "what can this site do"), money(n), track(order), onChange(user) } */
    init(o) { cfg = o; can = o.acct || null; me = null; try { me = JSON.parse(localStorage.getItem(key()) || "null"); } catch (e) { me = null; }
      if (me && !(+String(me.pass).split(".")[0] > Date.now() && me.key)) me = null;
      if (me && can && !kinds().includes(me.kind)) me = null; },
    /** Signing in is offered here. */
    on: () => !!(cfg && can),
    user: () => me,
    /** The note that no code could be emailed to this address: checkout goes ahead without an account. */
    skipped: () => skip,
    /** Draws the sign-in step into an element (the checkout, before its form). */
    gate(el) { where = el; ui.msg = ""; draw(); },
    open, out,
  };
})();
