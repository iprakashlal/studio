/* "Under maintenance" page for every template. Content: content.maintenance = { on, title, text, back, button:
   { label, url }, contact, look: "page" | "dark" | "accent", showLogo }. While `on`, every page of the live site shows
   this instead of the site (the admin page keeps working). The owner can still see the site by opening it once with
   ?peek at the end of the address (remembered for that browser tab); ?peek=off ends it.
   window.SiteMaint: wanted(C, preview), show(C, { name, logo }), hide() */
(function () {
  "use strict";
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var DEF = { on: false, title: "We'll be back soon", text: "We're making a few improvements. Please check back in a little while.", back: "", button: { label: "", url: "" }, contact: "", look: "page", showLogo: true };
  var CSS = [
    "#site-maint{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;overflow:auto;padding:28px 20px;background:var(--bg,#fff);color:var(--text,#111);font-family:var(--fb,system-ui,sans-serif);--m-ac:var(--c1,var(--accent,currentColor));--m-soft:var(--soft,inherit)}",
    "#site-maint[data-look=dark]{background:var(--deep,#0e1420);color:var(--on-deep,#fff);--m-soft:color-mix(in srgb,currentColor 72%,transparent)}",
    "#site-maint[data-look=accent]{background:var(--m-ac);color:#fff;--m-soft:rgba(255,255,255,.86)}#site-maint[data-look=accent] .sm-btn{background:#fff;color:#111}#site-maint[data-look=accent] .sm-bar i{background:#fff}#site-maint[data-look=accent] a{color:#fff}",
    ".sm-in{width:100%;max-width:620px;text-align:center}.sm-logo{max-height:72px;max-width:220px;width:auto;margin:0 auto 26px;display:block;object-fit:contain}.sm-name{font:700 18px/1.2 var(--fd,inherit);letter-spacing:.01em;margin:0 0 26px;color:inherit}",
    ".sm-bar{display:flex;justify-content:center;gap:6px;margin:0 0 22px}.sm-bar i{width:9px;height:9px;border-radius:50%;background:var(--m-ac);animation:sm-b 1.4s ease-in-out infinite}.sm-bar i:nth-child(2){animation-delay:.18s}.sm-bar i:nth-child(3){animation-delay:.36s}",
    "@keyframes sm-b{0%,80%,100%{opacity:.25;transform:scale(.8)}40%{opacity:1;transform:scale(1)}}@media (prefers-reduced-motion:reduce){.sm-bar i{animation:none}}",
    ".sm-in h1{font:800 clamp(30px,6vw,52px)/1.08 var(--fd,inherit);letter-spacing:-.02em;margin:0 0 16px;color:inherit}",
    ".sm-text{font-size:clamp(16px,1.7vw,18.5px);line-height:1.65;color:var(--m-soft)}.sm-text p{margin:0 0 .9em}.sm-text a{color:var(--m-ac);text-decoration:underline;text-underline-offset:3px}.sm-text strong{color:inherit;font-weight:700}",
    ".sm-text ul,.sm-text ol{display:inline-block;text-align:left;margin:0 0 .9em;padding-left:1.3em}.sm-text ul{list-style:disc}.sm-text ol{list-style:decimal}.sm-text h2,.sm-text h3{font:700 1.15em/1.3 var(--fd,inherit);margin:1.1em 0 .4em;color:inherit}",
    ".sm-back{display:inline-block;margin:10px 0 0;padding:7px 16px;border-radius:99px;border:1px solid color-mix(in srgb,currentColor 28%,transparent);font-size:14px;font-weight:600}",
    ".sm-btn{display:inline-block;margin:26px 0 0;padding:13px 26px;border-radius:min(var(--r,12px),14px);background:var(--m-ac);color:#fff;font-weight:700;text-decoration:none;font-size:15.5px}",
    ".sm-contact{margin:22px 0 0;font-size:14.5px;color:var(--m-soft)}.sm-contact a{color:inherit;text-decoration:underline;text-underline-offset:3px}",
    ".sm-flag{position:fixed;top:10px;left:50%;transform:translateX(-50%);font:700 12px/1.3 system-ui,sans-serif;padding:6px 12px;border-radius:99px;background:#fff3cd;color:#6b4b00;z-index:1;display:flex;align-items:center;gap:10px;max-width:calc(100% - 20px)}",
    ".sm-flag button{font:700 12px/1 system-ui,sans-serif;padding:5px 10px;border-radius:99px;border:1px solid #6b4b00;background:transparent;color:#6b4b00;cursor:pointer;white-space:nowrap}",
    "#site-peek-bar{position:fixed;left:0;right:0;bottom:0;z-index:2147483000;padding:9px 14px;background:#fff3cd;color:#6b4b00;font:500 13px/1.4 system-ui,sans-serif;text-align:center;box-shadow:0 -2px 12px rgba(0,0,0,.18)}#site-peek-bar a{color:inherit;font-weight:700;text-decoration:underline}"
  ].join("\n");
  function css() { if (document.getElementById("site-maint-css")) return; var s = document.createElement("style"); s.id = "site-maint-css"; s.textContent = CSS; document.head.appendChild(s); }
  function conf(C) { var m = (C && C.maintenance) || {}, o = {}; for (var k in DEF) o[k] = m[k] == null ? DEF[k] : m[k]; o.button = { label: (m.button && m.button.label) || "", url: (m.button && m.button.url) || "" }; return o; }
  var PEEK = "site-peek";
  function peeking() {
    try {
      var q = new URLSearchParams(location.search);
      if (q.has("peek")) { if (q.get("peek") === "off") sessionStorage.removeItem(PEEK); else sessionStorage.setItem(PEEK, "1"); }
      return sessionStorage.getItem(PEEK) === "1";
    } catch (e) { return false; }
  }
  var previewSite = false; // the editor pressed "Show the site" in the preview
  /** Should this page show the maintenance screen? While it is switched on: always, for visitors and in the editor's
   *  preview alike (the preview offers a button to see the site instead). The preview's "Maintenance page" entry
   *  shows it while it is off too. */
  function wanted(C, preview) {
    var q = /[?&]maintenance=1(&|$)/.test(location.search), on = !!((C && C.maintenance) || {}).on;
    if (preview) return q || (on && !previewSite);
    if (on && peeking()) { setTimeout(peekBar, 0); return false; }
    return on;
  }
  /** The owner is peeking at the site while visitors see the maintenance page: say so, with the way back. */
  function peekBar() {
    if (document.getElementById("site-peek-bar")) return; css();
    var b = document.createElement("div"); b.id = "site-peek-bar";
    b.innerHTML = "<b>Maintenance mode is on.</b> Visitors see the maintenance page; only you see the site in this tab. <a href=\"?peek=off\">Show me the maintenance page</a>";
    document.body.appendChild(b);
  }
  function rich(t) {
    if (window.SitePages) return window.SitePages.body(t);
    return String(t || "").split(/\n\s*\n/).map(function (p) { return "<p>" + esc(p.trim()).replace(/\n/g, "<br>") + "</p>"; }).join("");
  }
  var linkify = function (s) { return esc(s).replace(/\bhttps?:\/\/[^\s<]+[^\s<.,;:!?)]/g, function (u) { return '<a href="' + u + '" target="_blank" rel="noopener">' + u + "</a>"; }).replace(/\b[\w.+-]+@[\w-]+(\.[\w-]+)+\b/g, function (m) { return '<a href="mailto:' + m + '">' + m + "</a>"; }).replace(/(^|\s)(\+?\d[\d\s-]{7,14}\d)\b/g, function (_, a, n) { return a + '<a href="tel:' + n.replace(/[^\d+]/g, "") + '">' + n + "</a>"; }); };
  var prevTitle = null, prevOverflow = null;
  function show(C, o) {
    o = o || {}; css();
    var m = conf(C), el = document.getElementById("site-maint");
    if (!el) { el = document.createElement("div"); el.id = "site-maint"; el.setAttribute("role", "main"); document.body.appendChild(el); prevOverflow = document.documentElement.style.overflow; document.documentElement.style.overflow = "hidden"; prevTitle = document.title; }
    el.setAttribute("data-look", m.look === "dark" || m.look === "accent" ? m.look : "page");
    var btn = m.button.label && m.button.url && /^(https?:|mailto:|tel:|\/|\.\/|#|[\w-]+\.html)/i.test(m.button.url);
    el.innerHTML = (o.preview ? '<span class="sm-flag"><span>' + (m.on ? "Maintenance mode is ON: visitors see this page" : "Preview: maintenance mode is off, visitors see the site") + "</span>" + (m.on && o.again && !/[?&]maintenance=1(&|$)/.test(location.search) ? '<button type="button" data-sm-site>Show the site here</button>' : "") + "</span>" : "") +
      '<div class="sm-in">' +
      (m.showLogo !== false ? (o.logo ? '<img class="sm-logo" src="' + esc(o.logo) + '" alt="' + esc(o.name || "") + '">' : o.name ? '<p class="sm-name">' + esc(o.name) + "</p>" : "") : "") +
      '<div class="sm-bar" aria-hidden="true"><i></i><i></i><i></i></div>' +
      "<h1>" + esc(m.title).replace(/\n/g, "<br>") + "</h1>" +
      '<div class="sm-text">' + rich(m.text) + "</div>" +
      (m.back ? '<p class="sm-back">' + esc(m.back) + "</p>" : "") +
      (btn ? '<div><a class="sm-btn" href="' + esc(m.button.url) + '"' + (/^https?:/i.test(m.button.url) ? ' target="_blank" rel="noopener"' : "") + ">" + esc(m.button.label) + "</a></div>" : "") +
      (m.contact ? '<p class="sm-contact">' + linkify(m.contact).replace(/\n/g, "<br>") + "</p>" : "") + "</div>";
    var sb = el.querySelector("[data-sm-site]");
    if (sb) sb.onclick = function () { previewSite = true; hide(); o.again(); };
    document.title = String(m.title || "").replace(/\s+/g, " ") + (o.name ? " · " + o.name : "");
    if (!o.preview && !document.head.querySelector('meta[name="robots"][data-sm]')) { var r = document.createElement("meta"); r.name = "robots"; r.content = "noindex"; r.setAttribute("data-sm", ""); document.head.appendChild(r); }
    // the message's marks (bold, lists, links) need the reading-page script; load it once and draw again
    if (!window.SitePages && !show.loading) { show.loading = true; var s = document.createElement("script"); s.src = "assets/pages.js"; s.onload = function () { if (document.getElementById("site-maint")) show(C, o); }; document.head.appendChild(s); }
  }
  function hide() {
    var el = document.getElementById("site-maint"); if (!el) return;
    el.remove(); document.documentElement.style.overflow = prevOverflow || ""; if (prevTitle != null) document.title = prevTitle;
    var r = document.head.querySelector('meta[name="robots"][data-sm]'); if (r) r.remove();
  }
  window.SiteMaint = { wanted: wanted, show: show, hide: hide, peeking: peeking };
})();
