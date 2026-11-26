/* Cookie and tracking consent for every template. Content: content.consent = {
     on, wording: "auto" | "india" | "intl", try: "" | "india" | "intl" (editor preview only),
     india: { title, text, accept, decline, manage, save, extra }, intl: { …same },
     policyLabel, policyUrl, policyPage (a custom page's id),
     categories: [{ id: "necessary" | "analytics" | "marketing" | "preferences", on, label, text }],
     mode: "optin" | "optout" | "notice", showDecline, showManage, equal, closeX, lock,
     layout: "bar" | "box" | "center", position: "bottom" | "top", side: "left" | "right", look: "theme" | "dark" | "light",
     months, version, reopen, reopenLabel, gpc, gcm }
   "auto" shows the India wording to visitors whose device is set to Indian time and the international wording to
   everyone else. Nothing optional runs before the visitor allows it ("optin"); "optout" runs until they decline;
   "notice" only informs. The choice is kept in this browser (localStorage) for `months`, or until `version` changes.
   What it controls: custom code snippets with a category (assets/addons.js), any
   <script type="text/plain" data-consent="analytics"> in the page, and Google's Consent Mode when `gcm` is on.
   window.SiteConsent: mount(C, { preview, pageUrl(id) }), has(category), open(), state().
   Every change fires a "site:consent" event on window. A link to #cookie-settings (or [data-consent-open]) opens it. */
(function () {
  "use strict";
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var CATS = ["necessary", "analytics", "marketing", "preferences"];
  var DEF = {
    india: { title: "Your consent matters", text: "We use cookies and similar tools to run this website and, with your consent, to understand how it is used and to show you relevant offers. We use your personal data only for the purposes listed here, in line with India's Digital Personal Data Protection Act, 2023. You can withdraw your consent at any time from “Cookie settings”.", accept: "Accept all", decline: "Decline", manage: "Choose purposes", save: "Save my choices", extra: "To see, correct or erase your data, or to raise a grievance, contact us using the details on this site. You may also approach the Data Protection Board of India." },
    intl: { title: "We value your privacy", text: "We use cookies and similar technologies. Necessary ones make the site work. With your permission we also use them to measure visits and to personalise content and ads. You can accept all, reject the non-essential ones or choose by category, and change your mind at any time in “Cookie settings”.", accept: "Accept all", decline: "Reject non-essential", manage: "Manage preferences", save: "Save preferences", extra: "" },
    cats: {
      necessary: { label: "Strictly necessary", text: "Needed for the site to work: your choices here, your cart and signing in. Always on." },
      analytics: { label: "Analytics", text: "Help us count visits and see which pages are used, so we can improve the site." },
      marketing: { label: "Marketing", text: "Used to show relevant ads and measure campaigns, on this site and others." },
      preferences: { label: "Preferences", text: "Remember settings such as language or region, and run extras like chat boxes and embedded videos." }
    }
  };
  var CSS = [
    "#site-consent{position:fixed;z-index:2147482600;font:400 14.5px/1.55 var(--fb,system-ui,sans-serif);color:var(--sc-tx);--sc-bg:var(--surface,var(--bg,#fff));--sc-tx:var(--text,#111);--sc-ln:var(--line,rgba(0,0,0,.14));--sc-ac:var(--c1,var(--accent,#1d4ed8));--sc-soft:color-mix(in srgb,var(--sc-tx) 72%,transparent)}",
    "#site-consent[data-look=dark]{--sc-bg:#11161f;--sc-tx:#f3f5f8;--sc-ln:rgba(255,255,255,.16)}#site-consent[data-look=light]{--sc-bg:#fff;--sc-tx:#14171c;--sc-ln:rgba(0,0,0,.14)}",
    "#site-consent *{box-sizing:border-box}",
    ".sc-card{background:var(--sc-bg);color:var(--sc-tx);border:1px solid var(--sc-ln);box-shadow:0 18px 50px rgba(0,0,0,.24);position:relative}",
    "#site-consent[data-layout=bar]{left:0;right:0;bottom:0}#site-consent[data-layout=bar][data-position=top]{bottom:auto;top:0}",
    "#site-consent[data-layout=bar] .sc-card{border-width:1px 0 0;padding:16px max(18px,env(safe-area-inset-right)) calc(16px + env(safe-area-inset-bottom,0px)) max(18px,env(safe-area-inset-left))}#site-consent[data-layout=bar][data-position=top] .sc-card{border-width:0 0 1px;padding-bottom:16px}",
    "#site-consent[data-layout=bar] .sc-in{max-width:1180px;margin:0 auto;display:flex;gap:14px 28px;align-items:center;flex-wrap:wrap}#site-consent[data-layout=bar] .sc-body{flex:1 1 420px;min-width:0}#site-consent[data-layout=bar] .sc-panel .sc-in{display:block}",
    "#site-consent[data-layout=box]{bottom:calc(16px + env(safe-area-inset-bottom,0px));width:min(430px,calc(100vw - 24px))}#site-consent[data-layout=box][data-side=left]{left:12px}#site-consent[data-layout=box][data-side=right]{right:12px}",
    "#site-consent[data-layout=box] .sc-card,#site-consent[data-layout=center] .sc-card{border-radius:min(var(--r,14px),18px);padding:20px}",
    "#site-consent[data-layout=center]{inset:0;display:grid;place-items:center;padding:16px;background:rgba(8,10,14,.55);overflow:auto}#site-consent[data-layout=center] .sc-card{width:min(560px,100%)}",
    "#site-consent[data-lock]::before{content:'';position:fixed;inset:0;background:rgba(8,10,14,.5);z-index:-1}",
    ".sc-card{max-height:calc(100vh - 24px);max-height:calc(100dvh - 24px);overflow:auto}",
    ".sc-t{font:700 17px/1.3 var(--fd,inherit);margin:0 0 6px;color:inherit;letter-spacing:0}.sc-p{margin:0;color:var(--sc-soft)}.sc-p+.sc-p{margin-top:8px;font-size:13.5px}.sc-p a,.sc-link{color:var(--sc-ac);text-decoration:underline;text-underline-offset:3px}",
    ".sc-btns{display:flex;gap:8px;flex-wrap:wrap;align-items:center}#site-consent:not([data-layout=bar]) .sc-btns{margin-top:16px}",
    ".sc-b{appearance:none;font:700 14px/1 var(--fb,system-ui,sans-serif);padding:12px 18px;border-radius:min(var(--r,10px),12px);border:1.5px solid var(--sc-ac);background:var(--sc-ac);color:#fff;cursor:pointer;white-space:nowrap}",
    ".sc-b.sc-alt{background:transparent;color:var(--sc-tx);border-color:color-mix(in srgb,var(--sc-tx) 38%,transparent)}.sc-b.sc-txt{background:transparent;border-color:transparent;color:var(--sc-tx);text-decoration:underline;text-underline-offset:3px;padding-inline:8px;font-weight:600}",
    ".sc-b:focus-visible,.sc-x:focus-visible,.sc-sw input:focus-visible+i,#site-consent-open:focus-visible{outline:2px solid var(--sc-ac);outline-offset:2px}",
    ".sc-x{position:absolute;top:8px;right:8px;appearance:none;border:0;background:transparent;color:var(--sc-soft);font:400 22px/1 system-ui,sans-serif;width:32px;height:32px;border-radius:50%;cursor:pointer}.sc-x:hover{color:var(--sc-tx)}.sc-has-x .sc-t{padding-right:28px}",
    ".sc-cats{list-style:none;margin:14px 0 0;padding:0;display:flex;flex-direction:column;gap:8px}.sc-cat{border:1px solid var(--sc-ln);border-radius:10px;padding:11px 13px;display:grid;grid-template-columns:1fr auto;gap:2px 14px;align-items:center}",
    ".sc-cat b{font-weight:700;font-size:14.5px}.sc-cat span.sc-d{grid-column:1/-1;font-size:13px;color:var(--sc-soft)}.sc-always{font-size:12.5px;font-weight:700;color:var(--sc-soft);white-space:nowrap}",
    ".sc-sw{position:relative;display:inline-block;width:44px;height:26px;cursor:pointer}.sc-sw input{position:absolute;inset:0;opacity:0;margin:0;cursor:pointer}.sc-sw i{position:absolute;inset:0;border-radius:99px;background:color-mix(in srgb,var(--sc-tx) 26%,transparent);transition:background .18s}",
    ".sc-sw i::after{content:'';position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:transform .18s}.sc-sw input:checked+i{background:var(--sc-ac)}.sc-sw input:checked+i::after{transform:translateX(18px)}",
    ".sc-flag{display:inline-block;font:700 11.5px/1.3 system-ui,sans-serif;padding:3px 9px;border-radius:99px;background:#fff3cd;color:#6b4b00;margin:0 0 8px}",
    "#site-consent-open{position:fixed;z-index:2147481900;bottom:calc(12px + env(safe-area-inset-bottom,0px) + var(--sf-bottom,0px));appearance:none;font:600 12.5px/1 var(--fb,system-ui,sans-serif);padding:8px 12px;border-radius:99px;border:1px solid var(--line,rgba(0,0,0,.14));background:var(--surface,var(--bg,#fff));color:var(--text,#111);cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.14);opacity:.9}#site-consent-open:hover{opacity:1}",
    "#site-consent-open[data-side=left]{left:12px}#site-consent-open[data-side=right]{right:12px}",
    "@media (max-width:640px){#site-consent[data-layout=bar] .sc-btns{width:100%}.sc-b{flex:1 1 auto;text-align:center}.sc-b.sc-txt{flex:1 1 100%}}",
    "@media (prefers-reduced-motion:reduce){.sc-sw i,.sc-sw i::after{transition:none}}@media print{#site-consent,#site-consent-open{display:none!important}}"
  ].join("\n");
  function css() { if (document.getElementById("site-consent-css")) return; var s = document.createElement("style"); s.id = "site-consent-css"; s.textContent = CSS; document.head.appendChild(s); }

  var K = null, O = {}, started = false, ranOptional = false, previewDone = "";
  var KEY = "site-consent:" + location.pathname.replace(/[^/]*$/, "");
  var str = function (v, d) { v = v == null ? "" : String(v); return v.trim() ? v : d; };
  /** The settings with every gap filled in. */
  function conf(C) {
    var k = (C && C.consent) || {}, out = { on: !!k.on, wording: k.wording === "india" || k.wording === "intl" ? k.wording : "auto", try: k.try === "india" || k.try === "intl" ? k.try : "",
      mode: k.mode === "optout" || k.mode === "notice" ? k.mode : "optin", showDecline: k.showDecline !== false, showManage: k.showManage !== false, equal: k.equal !== false, closeX: !!k.closeX, lock: !!k.lock,
      layout: k.layout === "box" || k.layout === "center" ? k.layout : "bar", position: k.position === "top" ? "top" : "bottom", side: k.side === "right" ? "right" : "left", look: k.look === "dark" || k.look === "light" ? k.look : "theme",
      months: Math.max(1, Math.min(24, +k.months || 6)), version: String(k.version == null || k.version === "" ? 1 : k.version), reopen: k.reopen !== false, reopenLabel: str(k.reopenLabel, "Cookie settings"), gpc: k.gpc !== false, gcm: !!k.gcm,
      policyLabel: str(k.policyLabel, "Privacy policy"), policyUrl: String(k.policyUrl || "").trim(), policyPage: String(k.policyPage || "") };
    ["india", "intl"].forEach(function (r) { var w = k[r] || {}, d = DEF[r]; out[r] = { title: str(w.title, d.title), text: str(w.text, d.text), accept: str(w.accept, d.accept), decline: str(w.decline, d.decline), manage: str(w.manage, d.manage), save: str(w.save, d.save), extra: w.extra == null ? d.extra : String(w.extra) }; });
    var list = Array.isArray(k.categories) ? k.categories : [];
    out.cats = CATS.map(function (id) { var c = list.filter(function (x) { return x && x.id === id; })[0] || {}, d = DEF.cats[id]; return { id: id, on: id === "necessary" || c.on !== false, label: str(c.label, d.label), text: str(c.text, d.text) }; }).filter(function (c) { return c.on; });
    return out;
  }
  function indian() { try { var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; return tz === "Asia/Kolkata" || tz === "Asia/Calcutta"; } catch (e) { return false; } }
  var region = function () { return (O.preview && K.try) || (K.wording === "auto" ? (indian() ? "india" : "intl") : K.wording); };
  function stored() {
    if (O.preview) return null;
    try { var s = JSON.parse(localStorage.getItem(KEY) || "null"); if (!s || s.v !== K.version || !s.c || !(s.at + K.months * 30 * 864e5 > Date.now())) return null; return s; } catch (e) { return null; }
  }
  var gpc = function () { try { return !!navigator.globalPrivacyControl; } catch (e) { return false; } };
  /** May things of this category run? */
  function has(cat) {
    if (!cat || cat === "necessary" || cat === "always") return true;
    if (!K) return false; if (!K.on) return true;
    if (K.mode === "notice") return true;
    var s = stored(); if (s) return s.c[cat] === true;
    if (K.mode === "optin") return false;
    return !(K.gpc && gpc() && cat === "marketing");
  }
  function state() { var o = {}; CATS.forEach(function (c) { o[c] = has(c); }); return { asked: !!K && K.on, chosen: !!(K && stored()), region: K ? region() : "", categories: o }; }
  // ---- what consent switches on
  function gtagSignal(kind) {
    if (!K.gcm || O.preview) return;
    window.dataLayer = window.dataLayer || []; var g = function () { window.dataLayer.push(arguments); };
    var y = function (c) { return has(c) ? "granted" : "denied"; };
    g("consent", kind, { ad_storage: y("marketing"), ad_user_data: y("marketing"), ad_personalization: y("marketing"), analytics_storage: y("analytics"), functionality_storage: y("preferences"), personalization_storage: y("preferences"), security_storage: "granted" });
  }
  /** Scripts written as <script type="text/plain" data-consent="analytics"> run once their category is allowed. */
  function wake() {
    if (O.preview) return;
    Array.prototype.forEach.call(document.querySelectorAll('script[type="text/plain"][data-consent]'), function (n) {
      var cat = n.getAttribute("data-consent"); if (!has(cat)) return;
      var s = document.createElement("script");
      Array.prototype.forEach.call(n.attributes, function (a) { if (a.name !== "type" && a.name !== "data-consent") s.setAttribute(a.name, a.value); });
      s.text = n.textContent; n.parentNode.replaceChild(s, n); if (cat !== "necessary") ranOptional = true;
    });
  }
  function announce() {
    var st = state(); if (CATS.some(function (c) { return c !== "necessary" && st.categories[c]; })) ranOptional = true;
    wake();
    try { window.dispatchEvent(new CustomEvent("site:consent", { detail: st })); } catch (e) { /* old browsers */ }
  }
  function choose(c) {
    var before = state().categories, lost = false;
    if (O.preview) { previewDone = JSON.stringify(K); close(); return; }
    try { localStorage.setItem(KEY, JSON.stringify({ v: K.version, at: Date.now(), c: c, r: region() })); } catch (e) { /* private mode: asked again next visit */ }
    CATS.forEach(function (k) { if (before[k] && !has(k)) lost = true; });
    close(); gtagSignal("update");
    // Something already running can't be switched off in place: start the page again without it.
    if (lost && ranOptional) { location.reload(); return; }
    announce(); chip();
  }
  var all = function (v) { var c = {}; K.cats.forEach(function (x) { c[x.id] = x.id === "necessary" ? true : v; }); return c; };
  // ---- the banner
  var lastFocus = null;
  function close() { var el = document.getElementById("site-consent"); if (el) el.remove(); if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (e) {} lastFocus = null; }
  function policy() {
    var url = K.policyUrl; if (!/^(https?:\/\/|\/|\.\/|[\w-]+\.html|\?)/i.test(url)) url = "";
    if (!url && K.policyPage && O.pageUrl) url = O.pageUrl(K.policyPage) || "";
    return url ? ' <a class="sc-link" href="' + esc(url) + '">' + esc(K.policyLabel) + "</a>" : "";
  }
  function draw(panel) {
    css(); var W = K[region()], notice = K.mode === "notice", el = document.getElementById("site-consent");
    if (!el) { el = document.createElement("div"); el.id = "site-consent"; document.body.appendChild(el); }
    var modal = K.layout === "center";
    el.setAttribute("data-layout", K.layout); el.setAttribute("data-position", K.position); el.setAttribute("data-side", K.side); el.setAttribute("data-look", K.look);
    if (K.lock && !modal) el.setAttribute("data-lock", ""); else el.removeAttribute("data-lock");
    el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", String(modal || K.lock)); el.setAttribute("aria-labelledby", "sc-title");
    var flag = O.preview ? '<span class="sc-flag">Preview: ' + (region() === "india" ? "India" : "international") + " wording</span><br>" : "";
    var x = K.closeX && !notice ? '<button type="button" class="sc-x" data-sc="decline" aria-label="Close and ' + esc(W.decline) + '">×</button>' : "";
    var alt = K.equal ? "" : " sc-alt";
    var html;
    if (panel && !notice) {
      var cur = state().categories, opt = K.mode === "optout" || !!stored();
      html = '<div class="sc-in sc-panel-in">' + flag + '<h2 class="sc-t" id="sc-title" tabindex="-1">' + esc(W.manage) + '</h2><p class="sc-p">' + esc(W.text) + policy() + "</p>" +
        '<ul class="sc-cats">' + K.cats.map(function (c) {
          var on = c.id === "necessary" || (opt ? cur[c.id] : false);
          return '<li class="sc-cat"><b id="sc-l-' + c.id + '">' + esc(c.label) + "</b>" + (c.id === "necessary" ? '<span class="sc-always">Always on</span>' : '<label class="sc-sw"><input type="checkbox" role="switch" data-cat="' + c.id + '" aria-labelledby="sc-l-' + c.id + '"' + (on ? " checked" : "") + "><i></i></label>") + '<span class="sc-d">' + esc(c.text) + "</span></li>";
        }).join("") + "</ul>" + (W.extra ? '<p class="sc-p" style="margin-top:12px;font-size:13.5px">' + esc(W.extra) + "</p>" : "") +
        '<div class="sc-btns" style="margin-top:16px"><button type="button" class="sc-b" data-sc="save">' + esc(W.save) + '</button><button type="button" class="sc-b' + alt + '" data-sc="accept">' + esc(W.accept) + "</button>" + (K.showDecline ? '<button type="button" class="sc-b' + alt + '" data-sc="decline">' + esc(W.decline) + "</button>" : "") + "</div></div>";
    } else {
      html = '<div class="sc-in">' + '<div class="sc-body">' + flag + '<h2 class="sc-t" id="sc-title" tabindex="-1">' + esc(W.title) + '</h2><p class="sc-p">' + esc(W.text) + policy() + "</p>" + (W.extra ? '<p class="sc-p">' + esc(W.extra) + "</p>" : "") + "</div>" +
        '<div class="sc-btns">' + (notice ? '<button type="button" class="sc-b" data-sc="accept">' + esc(W.accept === DEF[region()].accept ? "OK" : W.accept) + "</button>"
          : '<button type="button" class="sc-b" data-sc="accept">' + esc(W.accept) + "</button>" + (K.showDecline ? '<button type="button" class="sc-b' + alt + '" data-sc="decline">' + esc(W.decline) + "</button>" : "") +
            (K.showManage && K.cats.length > 1 ? '<button type="button" class="sc-b sc-txt" data-sc="manage">' + esc(W.manage) + "</button>" : "")) + "</div></div>";
    }
    el.innerHTML = '<div class="sc-card' + (x ? " sc-has-x" : "") + (panel ? " sc-panel" : "") + '">' + x + html + "</div>";
    el.onclick = function (e) {
      var b = e.target.closest && e.target.closest("[data-sc]"); if (!b) return;
      var a = b.getAttribute("data-sc");
      if (a === "manage") { draw(true); var t = document.getElementById("sc-title"); if (t) t.focus(); return; }
      if (a === "accept") return choose(all(true));
      if (a === "decline") return choose(all(false));
      var c = all(false); Array.prototype.forEach.call(el.querySelectorAll("input[data-cat]"), function (i) { c[i.getAttribute("data-cat")] = i.checked; }); choose(c);
    };
    el.onkeydown = function (e) {
      if (e.key !== "Tab" || !(modal || K.lock)) return;
      var f = el.querySelectorAll("button,a[href],input"); if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    };
    var old = document.getElementById("site-consent-open"); if (old) old.remove();
  }
  /** The small "Cookie settings" button, once a choice is made. */
  function chip() {
    var old = document.getElementById("site-consent-open"); if (old) old.remove();
    if (!K || !K.on || !K.reopen || K.mode === "notice" || document.getElementById("site-consent")) return;
    if (!O.preview && !stored()) return;
    css(); var b = document.createElement("button"); b.type = "button"; b.id = "site-consent-open"; b.setAttribute("data-side", K.side); b.textContent = K.reopenLabel;
    b.onclick = function () { open(); }; document.body.appendChild(b);
  }
  function open() { if (!K || !K.on) return; lastFocus = document.activeElement; draw(K.mode !== "notice"); var t = document.getElementById("sc-title"); if (t) t.focus(); }
  function mount(C, o) {
    O = o || {}; K = conf(C);
    if (!started) {
      started = true;
      document.addEventListener("click", function (e) { var a = e.target.closest && e.target.closest('a[href$="#cookie-settings"],[data-consent-open]'); if (a && K && K.on) { e.preventDefault(); open(); } }, true);
    }
    if (!K.on) { close(); chip(); announce(); return; }
    if (!mount.signalled) { mount.signalled = true; gtagSignal("default"); }
    var need = O.preview ? previewDone !== JSON.stringify(K) : !stored();
    if (need) draw(false); else close();
    chip(); announce();
  }
  window.SiteConsent = { mount: mount, has: has, open: open, state: state, defaults: DEF };
})();
