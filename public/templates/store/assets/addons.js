/* Features on top of every page, for every template. Content: content.addons = {
     chat:  { on, kind: "whatsapp" | "phone" | "email" | "link", value, label, message, side, showLabel, color },
     badge: { on, text, api, field, link, side },      // text may hold {value}, read from the API's JSON answer
     code:  [{ id, name, on, where: "body" | "head", pages: "all" | "home", consent, code }],   // any service's snippet;
                                                       // consent: "" (always) | "analytics" | "marketing" | "preferences":
                                                       // with the consent banner on (assets/consent.js) it waits for that permission
     api:   { on, url } }                              // form entries are also posted here as JSON
   window.SiteAddons.mount(C, { preview, home, site }): safe to call again after every render. Custom code and the
   custom API only run on the live site (never in the editor's preview). */
(function () {
  "use strict";
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var CSS = [
    ".sa-chat,.sa-badge{position:fixed;bottom:calc(18px + env(safe-area-inset-bottom,0px) + var(--sa-lift,0px) + var(--sf-bottom,0px));z-index:2147482000;font:600 14.5px/1 var(--fb,system-ui,sans-serif);text-decoration:none;display:inline-flex;align-items:center;gap:9px;box-shadow:0 8px 26px rgba(0,0,0,.22);transition:transform .18s}",
    ".sa-chat[data-side=right],.sa-badge[data-side=right]{right:18px}.sa-chat[data-side=left],.sa-badge[data-side=left]{left:18px}",
    ".sa-chat{height:54px;min-width:54px;padding:0 15px;border-radius:99px;background:var(--sa-bg,#25D366);color:#fff;justify-content:center}.sa-chat:hover,.sa-badge[href]:hover{transform:translateY(-2px)}.sa-chat svg{width:26px;height:26px;flex:none}",
    ".sa-chat.sa-icon{padding:0;width:54px}",
    ".sa-badge{padding:10px 14px;border-radius:99px;background:var(--surface,#fff);color:var(--text,#111);border:1px solid var(--line,rgba(0,0,0,.12));font-size:13.5px}",
    ".sa-stack{--sa-lift:64px}",
    "@media (max-width:560px){.sa-chat .sa-l{display:none}.sa-chat{padding:0;width:54px}}@media print{.sa-chat,.sa-badge{display:none}}"
  ].join("\n");
  var ICON = {
    whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2a9.9 9.9 0 0 0-8.5 14.98L2 22l5.16-1.5A9.93 9.93 0 1 0 12.04 2Zm0 1.8a8.12 8.12 0 0 1 6.9 12.42 8.12 8.12 0 0 1-10.9 2.72l-.37-.22-3.05.89.9-2.97-.24-.39A8.12 8.12 0 0 1 12.04 3.8Zm-3.3 4.1c-.2 0-.5.07-.77.36-.26.3-1 .98-1 2.4 0 1.4 1.03 2.77 1.17 2.96.15.2 2 3.16 4.94 4.3 2.44.96 2.94.77 3.47.72.53-.05 1.7-.7 1.95-1.37.24-.67.24-1.25.17-1.37-.07-.12-.26-.2-.55-.34-.3-.15-1.7-.84-1.97-.94-.26-.1-.46-.14-.65.15-.2.3-.75.94-.92 1.13-.17.2-.34.22-.63.08-.3-.15-1.23-.46-2.34-1.45-.87-.77-1.45-1.72-1.62-2.01-.17-.3-.02-.45.13-.6.13-.13.3-.34.44-.5.14-.18.19-.3.29-.5.1-.19.05-.36-.03-.5-.07-.15-.65-1.58-.9-2.16-.23-.56-.47-.48-.65-.49l-.55-.01Z"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.800.6 2.8.7a2 2 0 0 1 1.7 2Z"/></svg>',
    email: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.800-.9L3 21l1.900-5.700a8.4 8.4 0 0 1-.9-3.800 8.500 8.500 0 0 1 4.700-7.600 8.400 8.400 0 0 1 3.800-.9h.5a8.500 8.500 0 0 1 8 8v.5Z"/></svg>'
  };
  function css() { if (document.getElementById("site-addons-css")) return; var s = document.createElement("style"); s.id = "site-addons-css"; s.textContent = CSS; document.head.appendChild(s); }
  function chatHref(c) {
    var v = String(c.value || "").trim(); if (!v) return "";
    if (c.kind === "whatsapp") { var n = v.replace(/[^\d]/g, ""); return n.length < 7 ? "" : "https://wa.me/" + n + (c.message ? "?text=" + encodeURIComponent(c.message) : ""); }
    if (c.kind === "phone") return "tel:" + v.replace(/[^\d+]/g, "");
    if (c.kind === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? "mailto:" + v : "";
    return /^(https?:\/\/|mailto:|tel:)/i.test(v) ? v : "";
  }
  function chat(c) {
    var old = document.getElementById("sa-chat"); if (old) old.remove();
    var href = c && c.on ? chatHref(c) : ""; if (!href) return;
    var a = document.createElement("a"); a.id = "sa-chat"; a.href = href; a.setAttribute("data-side", c.side === "left" ? "left" : "right");
    var label = String(c.label || "Chat with us"), show = c.showLabel !== false;
    a.className = "sa-chat" + (show ? "" : " sa-icon"); a.setAttribute("aria-label", label);
    if (/^https?:/i.test(href)) { a.target = "_blank"; a.rel = "noopener"; }
    var col = /^#[0-9a-f]{3,8}$/i.test(c.color || "") ? c.color : c.kind === "whatsapp" ? "#25D366" : "";
    a.style.setProperty("--sa-bg", col || "var(--c1,var(--accent,#1d4ed8))");
    a.innerHTML = (ICON[c.kind] || ICON.link) + (show ? '<span class="sa-l">' + esc(label) + "</span>" : "");
    document.body.appendChild(a);
  }
  var pick = function (o, path) { return String(path || "").split(".").filter(Boolean).reduce(function (a, k) { return a == null ? a : a[k]; }, o); };
  var badgeGen = 0, badgeCache = {};
  function badge(b, o) {
    var old = document.getElementById("sa-badge"); if (old) old.remove();
    var g = ++badgeGen; if (!b || !b.on || !String(b.text || "").trim()) return;
    var draw = function (value) {
      if (g !== badgeGen) return;
      var text = String(b.text).replace(/\{value\}/g, value == null ? "" : String(value)).trim(); if (!text) return;
      var link = /^https?:\/\//i.test(b.link || "") ? b.link : "", el = document.createElement(link ? "a" : "div");
      el.id = "sa-badge"; el.className = "sa-badge"; el.setAttribute("data-side", b.side === "right" ? "right" : "left"); el.textContent = text;
      if (link) { el.href = link; el.target = "_blank"; el.rel = "noopener"; }
      document.body.appendChild(el); stack();
    };
    if (!/\{value\}/.test(b.text) || !/^https:\/\//i.test(b.api || "")) return draw(o.preview && /\{value\}/.test(b.text) ? "…" : "");
    if (b.api in badgeCache) return draw(badgeCache[b.api + "|" + b.field]);
    fetch(b.api, { headers: { Accept: "application/json" } }).then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (j) { var v = b.field ? pick(j, b.field) : j; if (v == null || typeof v === "object") throw 0; badgeCache[b.api] = 1; badgeCache[b.api + "|" + b.field] = v; draw(v); })
      .catch(function () { if (o.preview) draw("?"); });
  }
  /** Two things in the same corner (or the "Powered by" badge on the right): the upper one is lifted. */
  function stack() {
    var c = document.getElementById("sa-chat"), b = document.getElementById("sa-badge");
    var pb = document.querySelector(".fx-badge"), lift = pb ? pb.offsetHeight + 14 : 0;
    [c, b].forEach(function (el) { if (el) el.style.marginBottom = el.getAttribute("data-side") === "right" && lift ? lift + "px" : ""; });
    if (b) b.classList.toggle("sa-stack", !!c && c.getAttribute("data-side") === b.getAttribute("data-side"));
  }
  // ---- custom code: each snippet once per page load, scripts recreated so they run
  var ran = {}, last = null;
  /** With the consent banner on, a snippet with a category runs only once the visitor allowed that category. */
  function allowed(x, C) {
    var cat = x.consent, K = (C && C.consent) || {};
    if (!K.on || !cat || cat === "necessary" || cat === "always") return true;
    return window.SiteConsent ? window.SiteConsent.has(cat) : false;
  }
  addEventListener("site:consent", function () { if (last) code(last.list, last.o, last.C); });
  function code(list, o, C) {
    if (o.preview) return;
    last = { list: list, o: o, C: C };
    (list || []).forEach(function (x, i) {
      if (!x || x.on === false || !String(x.code || "").trim() || (x.pages === "home" && !o.home) || !allowed(x, C)) return;
      var key = x.id || "i" + i; if (ran[key]) return; ran[key] = 1;
      var t = document.createElement("template"); t.innerHTML = String(x.code);
      var to = x.where === "head" ? document.head : document.body;
      Array.prototype.slice.call(t.content.childNodes).forEach(function (n) {
        if (n.nodeType === 1 && n.tagName === "SCRIPT") {
          var s = document.createElement("script");
          Array.prototype.slice.call(n.attributes).forEach(function (a) { s.setAttribute(a.name, a.value); });
          s.text = n.textContent; to.appendChild(s);
        } else if (n.nodeType === 1 || (n.nodeType === 3 && x.where !== "head" && n.textContent.trim())) to.appendChild(n);
      });
    });
  }
  // ---- custom API: form entries are also posted to the owner's address
  var api = { url: "", site: "" }, bound = false;
  function forms(a, o) {
    api.url = !o.preview && a && a.on && /^https:\/\//i.test(a.url || "") ? a.url : ""; api.site = o.site || "";
    if (bound || !api.url) return; bound = true;
    document.addEventListener("submit", function (e) {
      var f = e.target; if (!api.url || !f || f.tagName !== "FORM") return;
      if (f.querySelector("input[type=password]") || !f.querySelector("textarea,input[type=email]")) return;
      var fields = {};
      Array.prototype.slice.call(f.elements).forEach(function (el) {
        var n = el.name || el.id; if (!n || el.disabled || /^(password|file|submit|button|hidden)$/.test(el.type) || /card|cvv|cvc|upi|otp|pass/i.test(n)) return;
        if ((el.type === "checkbox" || el.type === "radio") && !el.checked) return;
        fields[n] = el.type === "checkbox" ? true : String(el.value || "").slice(0, 4000);
      });
      if (!Object.keys(fields).length) return;
      var body = JSON.stringify({ site: api.site, page: location.href.split("#")[0], form: f.id || f.getAttribute("name") || "form", fields: fields, at: new Date().toISOString() });
      try { fetch(api.url, { method: "POST", mode: "no-cors", keepalive: true, headers: { "Content-Type": "text/plain;charset=UTF-8" }, body: body }).catch(function () {}); } catch (x) { /* never block the form */ }
    }, true);
  }
  function mount(C, o) {
    o = o || {}; var A = (C && C.addons) || {}; css();
    chat(A.chat); badge(A.badge, o); stack(); setTimeout(stack, 900); code(A.code, o, C); forms(A.api, o);
  }
  window.SiteAddons = { mount: mount };
})();
