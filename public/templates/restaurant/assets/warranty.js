/* Warranty & service-status check for shop and business sites.
   Customers type their number (serial, invoice or ticket) and, if the site asks for it, the last 4 digits of their
   phone or their email. Records live in assets/data/warranty.json, each one encrypted with a key made from its own
   number, and filed under a hash of it: the file can't be listed or read without knowing a number.
   window.SiteWarranty.mount(el, opts) draws it in a page; .open(opts) in a popup.
   opts: { cfg (content.warranty), url (the data file), preview (bool), esc, today? } */
(function () {
  "use strict";
  var ITER = 20000;
  var enc = new TextEncoder();
  var b64d = function (s) { return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); }); };
  var hex = function (b) { return Array.prototype.map.call(new Uint8Array(b), function (x) { return ("0" + x.toString(16)).slice(-2); }).join(""); };
  var norm = function (s) { return String(s || "").toUpperCase().replace(/[\s\-_/.]+/g, ""); };
  var extraOf = function (kind, v) { v = String(v || "").trim(); return kind === "phone4" ? v.replace(/\D/g, "").slice(-4) : kind === "email" ? v.toLowerCase() : ""; };
  /** 64 bytes from the number (+ extra): the first half files the record, the second half opens it. */
  function derive(salt, num, extra) {
    return crypto.subtle.importKey("raw", enc.encode(norm(num) + "|" + extra), "PBKDF2", false, ["deriveBits"]).then(function (k) {
      return crypto.subtle.deriveBits({ name: "PBKDF2", salt: enc.encode("sw|" + salt), iterations: ITER, hash: "SHA-256" }, k, 512);
    }).then(function (bits) { return { id: hex(bits.slice(0, 32)), key: bits.slice(32) }; });
  }
  function open(data, salt, num, extra) {
    return derive(salt, num, extra).then(function (d) {
      var blob = data.e && data.e[d.id];
      if (!blob) return null;
      var raw = b64d(blob);
      return crypto.subtle.importKey("raw", d.key, "AES-GCM", false, ["decrypt"]).then(function (k) {
        return crypto.subtle.decrypt({ name: "AES-GCM", iv: raw.slice(0, 12) }, k, raw.slice(12));
      }).then(function (pt) { return JSON.parse(new TextDecoder().decode(pt)); }).catch(function () { return null; });
    });
  }
  var cache = {};
  function load(url) {
    if (!cache[url]) cache[url] = fetch(url + (url.indexOf("?") < 0 ? "?" : "&") + "t=" + Math.floor(Date.now() / 60000), { cache: "no-store" })
      .then(function (r) { if (r.status === 404) return { none: true }; if (!r.ok) throw new Error("load"); return r.json(); })
      .catch(function () { delete cache[url]; return { error: true }; });
    return cache[url];
  }
  /** Looks a number up; with a phone/email check, records saved without one are found by number alone. */
  function lookup(url, num, kind, extraIn) {
    return load(url).then(function (data) {
      if (data.error) return { error: "load" };
      if (data.none || !data.salt) return { error: "none" };
      var ex = extraOf(data.verify || kind, extraIn);
      return open(data, data.salt, num, ex).then(function (r) { return r || (ex ? open(data, data.salt, num, "") : null); }).then(function (r) { return r ? { rec: r } : { error: "notfound" }; });
    });
  }

  var CSS = ".sw{display:flex;flex-direction:column;gap:14px;font:inherit;color:inherit}.sw form{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end}.sw label{display:flex;flex-direction:column;gap:6px;flex:1 1 200px;font-size:.92em;font-weight:600}" +
    ".sw input{font:inherit;padding:12px 14px;border-radius:calc(var(--r,10px) * .8);border:1px solid var(--line,rgba(127,127,127,.35));background:var(--surface,#fff);color:inherit;min-width:0}.sw input:focus{outline:2px solid var(--c1,var(--accent,#2b59ff));outline-offset:1px}" +
    ".sw .sw-go{padding:12px 20px;flex:none}.sw .sw-msg{font-size:.95em;opacity:.85}.sw .sw-card{border:1px solid var(--line,rgba(127,127,127,.3));background:var(--surface,#fff);border-radius:var(--r,12px);padding:18px 20px;display:flex;flex-direction:column;gap:12px}" +
    ".sw .sw-top{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between}.sw .sw-top b{font-size:1.15em}.sw .sw-pill{display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:999px;font-size:.85em;font-weight:700;background:rgba(127,127,127,.14)}" +
    ".sw .t-ok{background:rgba(22,163,74,.14);color:#15803d}.sw .t-warn{background:rgba(245,158,11,.16);color:#b45309}.sw .t-bad{background:rgba(220,38,38,.13);color:#b91c1c}.sw .t-progress{background:rgba(37,99,235,.13);color:#1d4ed8}.sw .t-info{background:rgba(100,116,139,.15)}" +
    ".sw dl{display:grid;grid-template-columns:max-content 1fr;gap:6px 16px;margin:0;font-size:.95em}.sw dt{opacity:.7}.sw dd{margin:0;font-weight:600}.sw ol{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px;font-size:.92em}.sw ol span{opacity:.7;margin-right:6px}" +
    ".sw-ov{position:fixed;inset:0;z-index:99990;background:rgba(10,12,18,.55);display:grid;place-items:center;padding:16px;backdrop-filter:blur(3px)}.sw-box{width:min(560px,100%);max-height:calc(100dvh - 32px);overflow:auto;background:var(--bg,#fff);color:var(--text,#111);border-radius:calc(var(--r,12px) + 4px);padding:24px;box-shadow:0 30px 80px rgba(0,0,0,.35);position:relative}" +
    ".sw-box h2{margin:0 0 6px;font-family:var(--fd,inherit);font-size:1.5em}.sw-box .sw-intro{margin:0 0 16px;opacity:.8}.sw-x{position:absolute;top:10px;right:10px;width:36px;height:36px;border-radius:50%;border:0;background:rgba(127,127,127,.15);color:inherit;font-size:20px;cursor:pointer}";
  function style() { if (document.getElementById("sw-css")) return; var s = document.createElement("style"); s.id = "sw-css"; s.textContent = CSS; document.head.appendChild(s); }

  var plainEsc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  function fmtDate(d) { var x = new Date(d); return isNaN(x) ? String(d || "") : x.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }); }
  function addMonths(d, m) { var x = new Date(d); if (isNaN(x)) return null; x.setMonth(x.getMonth() + (+m || 0)); return x; }

  function result(o, r) {
    var C = o.cfg || {}, esc = o.esc || plainEsc, st = (C.statuses || []).filter(function (s) { return s.id === r.status; })[0];
    var tone = (st && st.tone) || r.tone || "info", label = (st && st.label) || r.statusLabel || r.status || "";
    var rows = [];
    if (r.product) rows.push(["Product", r.product]);
    if (r.customer && C.showCustomer) rows.push(["Name", r.customer]);
    var until = r.expires ? new Date(r.expires) : r.purchased && r.months ? addMonths(r.purchased, r.months) : null;
    var wPill = "";
    if (C.showWarranty !== false && (r.purchased || until)) {
      if (r.purchased) rows.push([C.purchasedLabel || "Purchased", fmtDate(r.purchased)]);
      if (until) { var on = until.getTime() >= new Date(o.today || Date.now()).setHours(0, 0, 0, 0); rows.push([C.untilLabel || "Warranty until", fmtDate(until)]); wPill = '<span class="sw-pill ' + (on ? "t-ok" : "t-bad") + '">' + esc(on ? C.inWarranty || "In warranty" : C.outWarranty || "Warranty ended") + "</span>"; }
    }
    if (r.updated) rows.push(["Last update", fmtDate(r.updated)]);
    var hist = C.showHistory !== false && r.history && r.history.length > 1 ? '<div><b style="font-size:.95em">' + esc(C.historyLabel || "History") + "</b><ol>" + r.history.slice().reverse().map(function (h) {
      var s = (C.statuses || []).filter(function (x) { return x.id === h.status; })[0];
      return "<li><span>" + esc(fmtDate(h.at)) + "</span>" + esc((s && s.label) || h.label || h.status || "") + (h.note ? " · " + esc(h.note) : "") + "</li>";
    }).join("") + "</ol></div>" : "";
    return '<div class="sw-card" role="status"><div class="sw-top"><b>' + esc(o.num) + "</b><span>" + (label ? '<span class="sw-pill t-' + esc(tone) + '">' + esc(label) + "</span> " : "") + wPill + "</span></div>" +
      (r.note ? "<p style=\"margin:0\">" + esc(r.note) + "</p>" : "") + (rows.length ? "<dl>" + rows.map(function (x) { return "<dt>" + esc(x[0]) + "</dt><dd>" + esc(x[1]) + "</dd>"; }).join("") + "</dl>" : "") + hist + "</div>";
  }

  /** Draws the check into `el`. */
  function mount(el, o) {
    style();
    var C = o.cfg || {}, esc = o.esc || plainEsc, kind = C.verify || "none";
    el.innerHTML = '<div class="sw"><form novalidate><label>' + esc(C.label || "Serial number") + '<input name="n" required autocomplete="off" spellcheck="false" placeholder="' + esc(C.placeholder || "") + '"></label>' +
      (kind !== "none" ? "<label>" + esc(C.verifyLabel || (kind === "phone4" ? "Last 4 digits of your phone" : "Your email")) + '<input name="x" ' + (kind === "phone4" ? 'inputmode="numeric" maxlength="4"' : 'type="email"') + ' autocomplete="off"></label>' : "") +
      '<button class="btn pri sw-go" type="submit">' + esc(C.button || "Check status") + '</button></form><div class="sw-out" aria-live="polite"></div></div>';
    var f = el.querySelector("form"), out = el.querySelector(".sw-out"), go = el.querySelector(".sw-go");
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var num = f.n.value.trim(), x = f.x ? f.x.value.trim() : "";
      if (!num) { f.n.focus(); return; }
      if (kind !== "none" && !x) { f.x.focus(); return; }
      if (o.preview) { out.innerHTML = '<p class="sw-msg">' + esc("Checks run on the live site, from the records in its admin page.") + "</p>"; return; }
      go.disabled = true; out.innerHTML = '<p class="sw-msg">' + esc(C.checking || "Checking…") + "</p>";
      lookup(o.url, num, kind, x).then(function (res) {
        go.disabled = false;
        if (res.rec) { out.innerHTML = result({ cfg: C, esc: esc, num: num.toUpperCase(), today: o.today }, res.rec); return; }
        var msg = res.error === "notfound" ? C.notFound || "We couldn't find that number. Check it and try again." : res.error === "none" ? C.empty || "Status checks aren't available yet." : "Couldn't check right now. Please try again in a moment.";
        out.innerHTML = '<p class="sw-msg">' + esc(msg) + "</p>" + (res.error === "notfound" && C.help ? '<p class="sw-msg">' + esc(C.help) + "</p>" : "");
      }).catch(function () { go.disabled = false; out.innerHTML = '<p class="sw-msg">Couldn\'t check right now. Please try again in a moment.</p>'; });
    });
  }

  /** The check in a popup (one-page sites). */
  function openPopup(o) {
    style();
    var C = o.cfg || {}, esc = o.esc || plainEsc, last = document.activeElement;
    var ov = document.createElement("div"); ov.className = "sw-ov";
    ov.innerHTML = '<div class="sw-box" role="dialog" aria-modal="true" aria-labelledby="sw-h"><button class="sw-x" type="button" aria-label="Close">×</button><h2 id="sw-h">' + esc(C.title || "Warranty & service status") + "</h2>" + (C.intro ? '<p class="sw-intro">' + esc(C.intro) + "</p>" : "") + '<div class="sw-in"></div></div>';
    document.body.appendChild(ov);
    var close = function () { ov.remove(); document.removeEventListener("keydown", key); if (location.hash === "#warranty") history.replaceState(null, "", location.pathname + location.search); if (last && last.focus) last.focus(); };
    var key = function (e) { if (e.key === "Escape") close(); };
    ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
    ov.querySelector(".sw-x").onclick = close;
    document.addEventListener("keydown", key);
    mount(ov.querySelector(".sw-in"), o);
    setTimeout(function () { var i = ov.querySelector("input"); if (i) i.focus(); }, 30);
  }

  window.SiteWarranty = { mount: mount, open: openPopup, _derive: derive, _norm: norm, _extra: extraOf };
})();
