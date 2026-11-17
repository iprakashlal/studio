/* Regional languages for every template. Content: content.i18n = {
     on, base: { code, name },                      // the language the site is written in
     langs: [{ code, name, on }],                   // the other languages offered
     t: { hi: { "<text as written>": "<translation>" } },
     paths: ["hero.title", "services.items.*.title", …],   // where the site's own text sits (made by the editor)
     auto, place: "menu" | "left" | "right" }
   A translation is keyed by the text it replaces, so reordering or copying content never breaks it. The chosen
   language is applied in two passes: to the content before the page is drawn (paths), and to the page's fixed
   wording after it is drawn (any text, placeholder, label or button whose whole text has a translation).
   The choice is kept in this browser; ?lang=hi opens a language directly.
   window.SiteLang: wanted(C), current(C), apply(C), mount(C, { navs: [css], preview }), LANGS */
(function () {
  "use strict";
  var LANGS = [["hi", "हिन्दी", "Hindi"], ["mr", "मराठी", "Marathi"], ["gu", "ગુજરાતી", "Gujarati"], ["pa", "ਪੰਜਾਬੀ", "Punjabi"], ["bn", "বাংলা", "Bengali"], ["as", "অসমীয়া", "Assamese"], ["or", "ଓଡ଼ିଆ", "Odia"],
    ["ta", "தமிழ்", "Tamil"], ["te", "తెలుగు", "Telugu"], ["kn", "ಕನ್ನಡ", "Kannada"], ["ml", "മലയാളം", "Malayalam"], ["en", "English", "English"]];
  var KEY = "site-lang:" + location.pathname.replace(/[^/]*$/, "");
  var CSS = [
    ".sl-sw{display:inline-flex;align-items:center;gap:5px;font:600 13.5px/1 var(--fb,system-ui,sans-serif);color:inherit;position:relative;white-space:nowrap}",
    ".sl-sw svg{width:15px;height:15px;flex:none;opacity:.8}.sl-sw select{appearance:none;-webkit-appearance:none;border:1px solid color-mix(in srgb,currentColor 28%,transparent);background:transparent;color:inherit;font:inherit;padding:7px 24px 7px 10px;border-radius:99px;cursor:pointer;max-width:150px}",
    ".sl-sw select option{color:#111;background:#fff}.sl-sw::after{content:'';position:absolute;right:10px;top:50%;width:6px;height:6px;border-right:1.6px solid currentColor;border-bottom:1.6px solid currentColor;transform:translateY(-70%) rotate(45deg);pointer-events:none;opacity:.7}",
    ".sl-sw select:focus-visible{outline:2px solid var(--c1,var(--accent,currentColor));outline-offset:2px}li.sl-li{list-style:none;display:flex;align-items:center}",
    ".sl-float{position:fixed;z-index:2147481800;bottom:calc(14px + env(safe-area-inset-bottom,0px) + var(--sf-bottom,0px));padding:6px 8px 6px 10px;border-radius:99px;background:var(--surface,var(--bg,#fff));color:var(--text,#111);border:1px solid var(--line,rgba(0,0,0,.14));box-shadow:0 6px 18px rgba(0,0,0,.16)}",
    ".sl-float select{border:0;padding:4px 20px 4px 2px}.sl-float::after{right:12px}.sl-float[data-side=left]{left:14px}.sl-float[data-side=right]{right:14px}@media print{.sl-float{display:none}}"
  ].join("\n");
  var GLOBE = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><circle cx="8" cy="8" r="6.3"/><path d="M1.7 8h12.6M8 1.7c2 2.2 2 10.4 0 12.6M8 1.7c-2 2.2-2 10.4 0 12.6"/></svg>';
  function css() { if (document.getElementById("site-lang-css")) return; var s = document.createElement("style"); s.id = "site-lang-css"; s.textContent = CSS; document.head.appendChild(s); }
  var I = function (C) { return (C && C.i18n) || {}; };
  var nameOf = function (code) { for (var i = 0; i < LANGS.length; i++) if (LANGS[i][0] === code) return LANGS[i][1]; return code; };
  function offered(C) { var n = I(C); return (Array.isArray(n.langs) ? n.langs : []).filter(function (l) { return l && l.on !== false && /^[a-z]{2,3}$/.test(l.code || ""); }); }
  function wanted(C) { return !!I(C).on && offered(C).length > 0; }
  var baseCode = function (C) { return (I(C).base && I(C).base.code) || "en"; };
  var forced = null; // the editor's "show this language in the preview"
  /** The language to show: ?lang=, else this browser's saved choice, else (first visit, when allowed) the browser's own. */
  function current(C) {
    if (!wanted(C)) return "";
    var list = offered(C).map(function (l) { return l.code; }), base = baseCode(C), ok = function (c) { return c === base || list.indexOf(c) >= 0; };
    if (forced != null) return ok(forced) && forced !== base ? forced : "";
    var pick = "";
    try { var q = new URLSearchParams(location.search).get("lang"); if (q && ok(q)) { pick = q; localStorage.setItem(KEY, q); } } catch (e) {}
    if (!pick) try { var s = localStorage.getItem(KEY); if (s && ok(s)) pick = s; } catch (e) {}
    if (!pick && I(C).auto !== false) { var nav = (navigator.languages || [navigator.language || ""]); for (var i = 0; i < nav.length && !pick; i++) { var c = String(nav[i]).slice(0, 2).toLowerCase(); if (ok(c)) pick = c; } }
    return pick && pick !== base ? pick : "";
  }
  var dictOf = function (C, lang) { var t = I(C).t; return (lang && t && t[lang]) || null; };
  // ---- pass 1: the content. Every text slot is remembered with its original, so languages can be switched back.
  var slotsFor = null, slots = [];
  function collect(C) {
    slots = []; slotsFor = C;
    (I(C).paths || []).forEach(function (p) {
      var walk = function (o, parts) {
        if (o == null) return; var k = parts[0], rest = parts.slice(1);
        if (k === "*") { if (Array.isArray(o)) o.forEach(function (x, i) { if (!rest.length) { if (typeof x === "string") slots.push({ o: o, k: i, src: x }); } else walk(x, rest); }); return; }
        if (typeof o !== "object") return;
        if (!rest.length) { if (typeof o[k] === "string" && o[k]) slots.push({ o: o, k: k, src: o[k] }); return; }
        walk(o[k], rest);
      };
      walk(C, String(p).split("."));
    });
  }
  var norm = function (s) { return String(s).replace(/\s+/g, " ").trim(); };
  function look(d, s) { if (!d) return null; var v = d[s]; if (v == null) v = d[norm(s)]; return typeof v === "string" && v.trim() ? v : null; }
  /** Puts the chosen language into the content (call before drawing the page). */
  function apply(C) {
    if (!C || !I(C).paths) return "";
    if (slotsFor !== C) collect(C);
    var lang = current(C), d = dictOf(C, lang);
    slots.forEach(function (s) { var v = look(d, s.src); s.o[s.k] = v == null ? s.src : v; });
    try { document.documentElement.lang = lang || baseCode(C); } catch (e) {}
    return lang;
  }
  // ---- pass 2: the page's fixed wording
  var ATTRS = ["placeholder", "aria-label", "title", "alt"], orig = typeof WeakMap === "function" ? new WeakMap() : null, obs = null, cur = { C: null, d: null }, busy = false;
  function sweep(root) {
    if (!orig || !root) return; var d = cur.d; busy = true;
    try {
      var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), n;
      while ((n = w.nextNode())) {
        var p = n.parentNode; if (!p || /^(SCRIPT|STYLE|TEXTAREA|NOSCRIPT|OPTION)$/.test(p.nodeName) || (p.closest && p.closest(".sl-sw,[data-no-translate],#site-consent"))) continue;
        var o = orig.get(n), now = n.nodeValue;
        if (o && o.out !== now) o = null; // the page redrew this text itself
        var src = o ? o.src : now, key = norm(src); if (!key || key.length > 400) continue;
        var v = look(d, key), out = v == null ? src : src.replace(src.trim(), v);
        if (out !== now) n.nodeValue = out;
        if (v != null) orig.set(n, { src: src, out: out }); else if (o) orig.delete(n);
      }
      Array.prototype.forEach.call(root.querySelectorAll ? root.querySelectorAll("[placeholder],[aria-label],[title],img[alt],input[type=submit],input[type=button]") : [], function (el) {
        if (el.closest(".sl-sw,[data-no-translate]")) return;
        var m = orig.get(el) || {}; ATTRS.concat(/^INPUT$/.test(el.nodeName) && /submit|button/.test(el.type) ? ["value"] : []).forEach(function (a) {
          var now = el.getAttribute(a); if (now == null) return;
          var o = m[a]; if (o && o.out !== now) o = null;
          var src = o ? o.src : now, v = look(d, norm(src)), out = v == null ? src : v;
          if (out !== now) el.setAttribute(a, out);
          if (v != null) m[a] = { src: src, out: out }; else delete m[a];
        });
        orig.set(el, m);
      });
    } catch (e) { /* the page stays in its own language */ }
    busy = false;
  }
  function watch() {
    if (obs || typeof MutationObserver !== "function") return;
    var t = null; obs = new MutationObserver(function () { if (busy) return; clearTimeout(t); t = setTimeout(function () { if (cur.d || orig) sweep(document.body); }, 60); });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  // ---- the switcher
  function select(C, lang) {
    var s = document.createElement("select"); s.setAttribute("aria-label", "Language");
    var base = baseCode(C), opts = [{ code: base, name: (I(C).base && I(C).base.name) || nameOf(base) }].concat(offered(C).map(function (l) { return { code: l.code, name: l.name || nameOf(l.code) }; }));
    opts.forEach(function (o) { var e = document.createElement("option"); e.value = o.code; e.textContent = o.name; e.lang = o.code; if (o.code === (lang || base)) e.selected = true; s.appendChild(e); });
    s.onchange = function () {
      try { localStorage.setItem(KEY, s.value); } catch (e) {}
      if (forced != null) forced = s.value;
      try { var u = new URL(location.href); if (u.searchParams.has("lang")) { u.searchParams.set("lang", s.value); history.replaceState(null, "", u); } } catch (e) {}
      if (cur.again) cur.again(); else location.reload();
    };
    return s;
  }
  function switcher(C, o, lang) {
    Array.prototype.forEach.call(document.querySelectorAll(".sl-sw,.sl-li"), function (n) { n.remove(); });
    if (!wanted(C)) return;
    css(); var place = I(C).place || "menu", done = false;
    var make = function () { var l = document.createElement("label"); l.className = "sl-sw"; l.innerHTML = GLOBE; l.appendChild(select(C, lang)); return l; };
    if (place === "menu") (o.navs || []).forEach(function (sel) {
      Array.prototype.forEach.call(document.querySelectorAll(sel), function (nav) {
        var sw = make(), last = null;
        if (nav.tagName === "UL" || nav.tagName === "OL") { var li = document.createElement("li"); li.className = "sl-li"; li.appendChild(sw); sw = li; }
        if (o.keep) { var k = nav.querySelector(":scope > " + o.keep); if (k) last = k; }
        nav.insertBefore(sw, last); done = true;
      });
    });
    if (!done) { var f = make(); f.classList.add("sl-float"); f.setAttribute("data-side", place === "left" ? "left" : "right"); document.body.appendChild(f); }
  }
  /** After the page is drawn: translate its fixed wording and show the switcher. o.again redraws the page (else it reloads). */
  function mount(C, o) {
    o = o || {}; var lang = current(C);
    cur = { C: C, d: dictOf(C, lang), again: o.again || null };
    if (cur.d || orig) sweep(document.body);
    switcher(C, o, lang);
    if (wanted(C)) watch();
    return lang;
  }
  /** The editor's preview: show this language ("" = the site's own) until the switcher in the preview picks another. */
  var given; // what the editor last asked for
  function force(code) {
    code = code == null ? null : String(code);
    // The template repeats the editor's choice on every redraw. Only a new choice counts, so a language picked
    // with the switcher inside the preview stays until the editor asks for another.
    if (code === given) return;
    given = code; forced = code;
  }
  window.SiteLang = { wanted: wanted, current: current, apply: apply, mount: mount, force: force, LANGS: LANGS, KEY: KEY };
})();
