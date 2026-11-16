/* Festival overlay for every template: a greeting ribbon and a short shower of decorations on India's festivals.
   Content: content.festival = { v, on, style: "both" | "ribbon" | "deco", position: "top" | "bottom", lead (days
   shown before the festival), items: [{ id, on, from, to, message }] (one per festival below; from/to in YYYY-MM-DD
   replace the official days), custom: [{ name, deco, from, to, message }] }.
   It shows while it is switched on (on; content saved before v 2 also needs the old Studio offer, allowed). Dates use the
   visitor's own calendar day. The same list lives in src/lib/festivals.ts for the editor.
   window.SiteFestival: mount(C, { preview, site }), today(C, date) */
(function () {
  "use strict";
  var LIST = [{"id":"new-year","name":"New Year","fixed":["01-01","01-01"],"deco":"confetti","greet":"Happy New Year"},{"id":"lohri","name":"Lohri","fixed":["01-13","01-13"],"deco":"fire","greet":"Happy Lohri"},{"id":"sankranti","name":"Makar Sankranti / Pongal","fixed":["01-14","01-15"],"deco":"kites","greet":"Happy Makar Sankranti and Pongal"},{"id":"republic-day","name":"Republic Day","fixed":["01-26","01-26"],"deco":"tricolour","greet":"Happy Republic Day"},{"id":"shivratri","name":"Maha Shivratri","dates":{"2027":["03-06","03-06"]},"deco":"lamps","greet":"Happy Maha Shivratri"},{"id":"holi","name":"Holi","dates":{"2027":["03-22","03-22"]},"deco":"colours","greet":"Happy Holi"},{"id":"eid-fitr","name":"Eid ul-Fitr","dates":{"2027":["03-10","03-10"]},"deco":"crescent","greet":"Eid Mubarak","moon":true},{"id":"ugadi","name":"Ugadi / Gudi Padwa","dates":{"2027":["04-08","04-08"]},"deco":"flowers","greet":"Happy Ugadi and Gudi Padwa"},{"id":"baisakhi","name":"Baisakhi / Vishu / Tamil New Year","fixed":["04-14","04-14"],"deco":"flowers","greet":"Happy Baisakhi"},{"id":"ram-navami","name":"Ram Navami","dates":{"2027":["04-15","04-15"]},"deco":"lamps","greet":"Happy Ram Navami"},{"id":"easter","name":"Good Friday and Easter","dates":{"2027":["03-26","03-28"]},"deco":"flowers","greet":"Happy Easter"},{"id":"eid-adha","name":"Eid ul-Adha (Bakrid)","dates":{"2027":["05-17","05-17"]},"deco":"crescent","greet":"Eid Mubarak","moon":true},{"id":"buddha-purnima","name":"Buddha Purnima","dates":{"2027":["05-20","05-20"]},"deco":"lamps","greet":"Happy Buddha Purnima"},{"id":"independence-day","name":"Independence Day","fixed":["08-15","08-15"],"deco":"tricolour","greet":"Happy Independence Day"},{"id":"raksha-bandhan","name":"Raksha Bandhan","dates":{"2027":["08-17","08-17"]},"deco":"flowers","greet":"Happy Raksha Bandhan"},{"id":"janmashtami","name":"Janmashtami","dates":{"2027":["08-25","08-25"]},"deco":"feathers","greet":"Happy Janmashtami"},{"id":"ganesh-chaturthi","name":"Ganesh Chaturthi","dates":{"2027":["09-04","09-04"]},"deco":"flowers","greet":"Happy Ganesh Chaturthi"},{"id":"onam","name":"Onam","dates":{"2027":["09-11","09-11"]},"deco":"flowers","greet":"Happy Onam"},{"id":"gandhi-jayanti","name":"Gandhi Jayanti","fixed":["10-02","10-02"],"deco":"tricolour","greet":"Remembering Gandhi Jayanti"},{"id":"navratri","name":"Navratri and Dussehra","dates":{"2027":["10-01","10-10"]},"deco":"lamps","greet":"Happy Navratri and Dussehra"},{"id":"diwali","name":"Diwali","dates":{"2027":["10-27","10-31"]},"deco":"diyas","greet":"Happy Diwali"},{"id":"guru-nanak","name":"Guru Nanak Jayanti","dates":{"2026":["11-24","11-24"],"2027":["11-14","11-14"]},"deco":"lamps","greet":"Happy Gurpurab"},{"id":"christmas","name":"Christmas","fixed":["12-24","12-25"],"deco":"snow","greet":"Merry Christmas"}];
  var DECO = {
    confetti: ["🎉", "🎊", "✨", "⭐"], diyas: ["🪔", "✨", "🎆", "🪔"], lamps: ["🪔", "🌼", "✨"], colours: ["#ff3d7f", "#ffd000", "#29c46b", "#2aa8ff", "#a04bff", "#ff7a1a"],
    tricolour: ["#FF9933", "#FFFFFF", "#138808", "#FF9933", "#138808"], crescent: ["🌙", "⭐", "✨"], flowers: ["🌼", "🌸", "🌺", "🏵️"], kites: ["🪁", "🪁", "☀️"],
    snow: ["❄️", "❄️", "⭐", "🎄"], fire: ["🔥", "✨", "🌾"], feathers: ["🪶", "🦚", "✨"], hearts: ["❤️", "💛", "💙"]
  };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var pad = function (n) { return (n < 10 ? "0" : "") + n; };
  var ymd = function (d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
  var okDate = function (s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")); };
  var shift = function (s, days) { var p = s.split("-"), d = new Date(+p[0], +p[1] - 1, +p[2] + days); return ymd(d); };
  /** Switched on? One switch (on); content saved while the Studio still had to offer it first (no v) also needs that offer. */
  function active(F) { return !!F && F.on !== false && (F.v >= 2 || F.allowed === true); }
  /** The festival (or the site's own occasion) to show on this day, or null. Custom occasions come first, then the
   *  festival whose day is nearest. */
  function today(C, date) {
    var F = (C && C.festival) || {}; if (!active(F)) return null;
    var now = ymd(date || new Date()), y = +now.slice(0, 4), lead = Math.max(0, Math.min(14, +F.lead >= 0 && F.lead !== "" && F.lead != null ? +F.lead : 2));
    var hits = [];
    (F.custom || []).forEach(function (x) {
      if (!x || x.on === false || !String(x.name || "").trim() || !okDate(x.from)) return;
      var to = okDate(x.to) && x.to >= x.from ? x.to : x.from;
      if (now >= x.from && now <= to) hits.push({ id: "custom", name: x.name, deco: DECO[x.deco] ? x.deco : "confetti", greet: x.message || x.name, from: x.from, to: to, own: 1 });
    });
    var set = {}; (F.items || []).forEach(function (x) { if (x && x.id) set[x.id] = x; });
    LIST.forEach(function (f) {
      var s = set[f.id] || {}; if (s.on === false) return;
      var from, to;
      if (okDate(s.from)) { from = s.from; to = okDate(s.to) && s.to >= s.from ? s.to : s.from; }
      else {
        var span = f.fixed || (f.dates && f.dates[y]); if (!span) return;
        from = shift(y + "-" + span[0], -lead); to = y + "-" + span[1];
        // New Year's lead days fall in the year before
        if (f.id === "new-year" && now.slice(5) > "12-20") { from = shift((y + 1) + "-01-01", -lead); to = (y + 1) + "-01-01"; }
      }
      if (now >= from && now <= to) hits.push({ id: f.id, name: f.name, deco: f.deco, greet: s.message || f.greet, from: from, to: to });
    });
    if (!hits.length) return null;
    hits.sort(function (a, b) { return (b.own || 0) - (a.own || 0) || (a.to < b.to ? -1 : a.to > b.to ? 1 : 0); });
    return hits[0];
  }
  var CSS = [
    "#sf-ribbon{position:relative;left:0;right:0;z-index:2147481000;display:flex;align-items:center;justify-content:center;gap:10px;padding:9px 44px 9px 14px;font:600 14.5px/1.35 var(--fb,system-ui,sans-serif);text-align:center;color:#fff;background:linear-gradient(90deg,var(--c1,var(--accent,#c2410c)),color-mix(in srgb,var(--c1,var(--accent,#c2410c)) 62%,#000));box-shadow:0 4px 18px rgba(0,0,0,.2)}",
    "#sf-ribbon[data-pos=top]{animation:sf-in-t .5s ease both}#sf-ribbon[data-pos=bottom]{position:fixed;bottom:0;animation:sf-in-b .5s ease both}",
    "#sf-ribbon button{position:absolute;right:8px;top:50%;transform:translateY(-50%);width:30px;height:30px;border:0;border-radius:50%;background:rgba(255,255,255,.18);color:#fff;font:700 16px/1 system-ui,sans-serif;cursor:pointer}#sf-ribbon button:hover{background:rgba(255,255,255,.3)}",
    "#sf-ribbon .sf-e{font-size:18px;line-height:1}",
    "@keyframes sf-in-t{from{transform:translateY(-100%)}to{transform:none}}@keyframes sf-in-b{from{transform:translateY(100%)}to{transform:none}}",
    "#sf-deco{position:fixed;inset:0;z-index:2147480999;pointer-events:none;overflow:hidden}",
    "#sf-deco i{position:absolute;top:-8vh;font-style:normal;will-change:transform;animation:sf-fall linear forwards}#sf-deco i.sf-dot{width:11px;height:11px;border-radius:50%;box-shadow:0 0 0 1px rgba(0,0,0,.08)}#sf-deco i.sf-bar{width:9px;height:16px;border-radius:2px;box-shadow:0 0 0 1px rgba(0,0,0,.1)}",
    "@keyframes sf-fall{0%{transform:translate3d(0,0,0) rotate(0);opacity:0}8%{opacity:1}85%{opacity:1}100%{transform:translate3d(var(--dx,0),116vh,0) rotate(var(--rot,180deg));opacity:0}}",
    "@media (prefers-reduced-motion:reduce){#sf-deco{display:none}#sf-ribbon{animation:none!important}}@media print{#sf-ribbon,#sf-deco{display:none}}"
  ].join("\n");
  function css() { if (document.getElementById("site-festival-css")) return; var s = document.createElement("style"); s.id = "site-festival-css"; s.textContent = CSS; document.head.appendChild(s); }
  /* The top ribbon sits in the page, above the header, and scrolls away with it. A header that is pinned to the
     window (position: fixed) is moved down by the ribbon's height while the ribbon is in view, so neither covers
     the other. The bottom ribbon lifts the chat button and badges (assets/addons.js) above itself. */
  var pinned = [], onScroll = null;
  function unpin() {
    pinned.forEach(function (p) { p.el.style.top = p.was; }); pinned = [];
    if (onScroll) { removeEventListener("scroll", onScroll); removeEventListener("resize", onScroll); onScroll = null; }
    document.documentElement.style.removeProperty("--sf-bottom");
  }
  function place(r, pos) {
    unpin();
    if (pos === "bottom") { document.documentElement.style.setProperty("--sf-bottom", r.offsetHeight + "px"); return; }
    var all = document.querySelectorAll("header, nav, .nav, #nav, [data-nav]");
    for (var i = 0; i < all.length; i++) {
      var el = all[i]; if (el === r || r.contains(el)) continue;
      var cs = getComputedStyle(el), top = parseFloat(cs.top);
      if (cs.position === "fixed" && top >= 0 && top < 60 && el.getBoundingClientRect().top < 80) pinned.push({ el: el, was: el.style.top, top: top });
    }
    if (!pinned.length) return;
    onScroll = function () { var h = r.isConnected ? Math.max(0, r.offsetHeight - scrollY) : 0; pinned.forEach(function (p) { p.el.style.top = (p.top + h) + "px"; }); };
    addEventListener("scroll", onScroll, { passive: true }); addEventListener("resize", onScroll); onScroll();
  }
  function clear() { unpin(); ["sf-ribbon", "sf-deco"].forEach(function (id) { var e = document.getElementById(id); if (e) e.remove(); }); }
  var shownKey = "";
  function mount(C, o) {
    o = o || {};
    var F = (C && C.festival) || {}, hit = today(C, o.date);
    // The editor's preview can ask to see one festival whatever the day (festival.preview = its id).
    if (o.preview && active(F) && F.preview) { var pf = LIST.filter(function (f) { return f.id === F.preview; })[0]; if (pf) { var st = (F.items || []).filter(function (x) { return x && x.id === pf.id; })[0] || {}; hit = { id: pf.id, name: pf.name, deco: pf.deco, greet: st.message || pf.greet, to: "preview" }; } }
    var style = F.style === "ribbon" || F.style === "deco" ? F.style : "both", pos = F.position === "bottom" ? "bottom" : "top";
    var key = hit ? [hit.id, hit.name, hit.greet, hit.to, style, pos, o.site].join("|") : "";
    if (key === shownKey && (!hit || document.getElementById("sf-ribbon") || style === "deco")) return;
    shownKey = key; clear(); if (!hit) return;
    var seen = "site-festival:" + hit.id + ":" + hit.to, closed = false; try { closed = !o.preview && sessionStorage.getItem(seen) === "1"; } catch (e) {}
    css();
    var set = DECO[hit.deco] || DECO.confetti, glyph = set.filter(function (x) { return x[0] !== "#"; })[0] || "✨";
    if (style !== "deco" && !closed) {
      var r = document.createElement("div"); r.id = "sf-ribbon"; r.setAttribute("data-pos", pos); r.setAttribute("role", "status");
      var text = String(hit.greet).replace(/\{site\}/g, o.site || "");
      r.innerHTML = '<span class="sf-e" aria-hidden="true">' + glyph + "</span><span>" + esc(text) + (o.site && !/\{site\}/.test(hit.greet) && F.signoff !== false ? " <span style=\"opacity:.85;font-weight:500\">from " + esc(o.site) + "</span>" : "") + '</span><span class="sf-e" aria-hidden="true">' + glyph + '</span><button type="button" aria-label="Close">×</button>';
      r.querySelector("button").onclick = function () { r.remove(); unpin(); try { sessionStorage.setItem(seen, "1"); } catch (e) {} };
      if (pos === "top") document.body.insertBefore(r, document.body.firstChild); else document.body.appendChild(r);
      place(r, pos); setTimeout(function () { if (r.isConnected) place(r, pos); }, 700);
    }
    var decoSeen = false; try { decoSeen = !o.preview && sessionStorage.getItem(seen + ":d") === "1"; } catch (e) {}
    if (style !== "ribbon" && !decoSeen && !(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) {
      var box = document.createElement("div"); box.id = "sf-deco"; box.setAttribute("aria-hidden", "true");
      var n = Math.min(46, Math.max(18, Math.round(innerWidth / 30)));
      for (var i = 0; i < n; i++) {
        var p = set[i % set.length], el = document.createElement("i");
        if (p[0] === "#") { el.className = hit.deco === "tricolour" ? "sf-bar" : "sf-dot"; el.style.background = p; var sz = 8 + Math.random() * 12; if (hit.deco === "colours") { el.style.width = el.style.height = sz + "px"; el.style.opacity = ".85"; } }
        else { el.textContent = p; el.style.fontSize = 16 + Math.random() * 16 + "px"; }
        el.style.left = Math.random() * 100 + "vw"; el.style.setProperty("--dx", (Math.random() * 16 - 8) + "vw"); el.style.setProperty("--rot", (Math.random() * 540 - 270) + "deg");
        el.style.animationDuration = 5 + Math.random() * 5 + "s"; el.style.animationDelay = Math.random() * 5 + "s";
        box.appendChild(el);
      }
      document.body.appendChild(box);
      setTimeout(function () { if (box.parentNode) box.remove(); }, 16000);
      try { sessionStorage.setItem(seen + ":d", "1"); } catch (e) {}
    }
  }
  window.SiteFestival = { mount: mount, today: today, LIST: LIST };
})();
