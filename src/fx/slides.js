/* Hero background slideshow, shared by the portfolio, shop and business templates (synced into each template's
   assets/ by scripts/sync-fx.mjs). Each template calls SiteSlides.mount(heroElement, settings, options) after it
   renders; calling it again (for example in the Studio's live preview) replaces the previous slideshow.

   settings (content: hero.slides, or home.hero.slides in the shop):
     enabled, items: [{ image, title, text, position }], effect: fade | slide | zoom | kenburns, interval (s),
     speed (s), overlay (0-90 %), overlayColor, overlayStyle: solid | left | bottom, textColor: light | dark | theme,
     height: auto | tall | full, dots, arrows, pause (pause while hovered or focused), hideArt
   options: { imgUrl(img), title: selector, text: selector, hide: selector (the hero's own picture) } */
(function () {
  "use strict";
  var CSS = ".hs-host{isolation:isolate;overflow:hidden}" +
    ".hs-bg{position:absolute;inset:0;z-index:-1;pointer-events:none;overflow:hidden}" +
    ".hs-s{position:absolute;inset:0;background-size:cover;background-repeat:no-repeat;opacity:0;transition:opacity var(--hs-sp,1s) ease,transform var(--hs-sp,1s) cubic-bezier(.2,.7,.2,1)}" +
    ".hs-s.on{opacity:1}" +
    ".hs-e-slide .hs-s{opacity:1;transform:translateX(100%)}.hs-e-slide .hs-s.on{transform:none}.hs-e-slide .hs-s.out{transform:translateX(-100%)}" +
    ".hs-e-zoom .hs-s{transform:scale(1.14)}.hs-e-zoom .hs-s.on{transform:scale(1)}" +
    ".hs-e-kenburns .hs-s.on{animation:hs-kb var(--hs-iv,6s) linear both}@keyframes hs-kb{from{transform:scale(1)}to{transform:scale(1.14)}}" +
    ".hs-ov{position:absolute;inset:0}" +
    ".hs-h-tall{min-height:min(86svh,900px)}.hs-h-full{min-height:100svh}" +
    ".hs-host.hs-light{color:#fff}.hs-host.hs-dark{color:#10141c}" +
    ".hs-host:is(.hs-light,.hs-dark) :is(h1,h2,h3,p,li,dt,dd,small,b,em,i,strong,.eyebrow,.lead,.lede,.hero-lede):not(.btn):not(.btn *):not(.hs-ui *){color:inherit!important;-webkit-text-fill-color:currentColor}" +
    ".hs-host.hs-light :is(h1,p,.eyebrow){text-shadow:0 1px 22px rgba(0,0,0,.35)}" +
    ".hs-ui{position:absolute;z-index:3;left:50%;bottom:max(14px,env(safe-area-inset-bottom,0px));transform:translateX(-50%);display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:99px;background:rgba(0,0,0,.28);backdrop-filter:blur(6px)}" +
    ".hs-ui button{all:unset;cursor:pointer;display:grid;place-items:center;width:20px;height:20px;border-radius:50%;color:#fff}" +
    ".hs-ui button:focus-visible,.hs-arr:focus-visible{outline:2px solid #fff;outline-offset:2px}" +
    ".hs-dot::before{content:'';width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.5);transition:background .2s,transform .2s}.hs-dot[aria-current=true]::before{background:#fff;transform:scale(1.25)}" +
    ".hs-arr{all:unset;cursor:pointer;position:absolute;z-index:3;top:50%;transform:translateY(-50%);width:42px;height:42px;display:grid;place-items:center;border-radius:50%;background:rgba(0,0,0,.3);color:#fff;font-size:22px;line-height:1;backdrop-filter:blur(6px)}" +
    ".hs-arr.p{left:max(12px,env(safe-area-inset-left,0px))}.hs-arr.n{right:max(12px,env(safe-area-inset-right,0px))}" +
    ".hs-cap{transition:opacity .45s ease}.hs-cap.hs-fade{opacity:0}" +
    "@media (max-width:640px){.hs-arr{display:none}}" +
    "@media (prefers-reduced-motion:reduce){.hs-s{transition:opacity .01s!important;animation:none!important}.hs-e-slide .hs-s{transform:none;opacity:0}.hs-e-slide .hs-s.on{opacity:1}}";
  var cur = null;
  var POS = { center: "50% 50%", top: "50% 0%", bottom: "50% 100%", left: "0% 50%", right: "100% 50%" };
  var escH = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var lines = function (s) { return escH(String(s || "").trim()).replace(/\r?\n/g, "<br>").replace(/\*([^*]+)\*/g, "<em>$1</em>"); };
  function css() { if (document.getElementById("hs-css")) return; var s = document.createElement("style"); s.id = "hs-css"; s.textContent = CSS; document.head.appendChild(s); }
  function stop() {
    if (!cur) return;
    clearInterval(cur.t); cur.off.forEach(function (f) { try { f(); } catch (e) {} });
    var h = cur.host; if (h && h.isConnected) { cur.made.forEach(function (n) { n.remove(); }); h.classList.remove.apply(h.classList, cur.cls); cur.hidden.forEach(function (n) { n.style.display = n.dataset.hsD || ""; }); cur.caps.forEach(function (c) { c.el.innerHTML = c.html; c.el.classList.remove("hs-cap", "hs-fade"); }); }
    cur = null;
  }
  function mount(host, S, o) {
    stop();
    o = o || {};
    if (!host || !S || !S.enabled) return;
    var url = o.imgUrl || function (i) { return i && (i.url || i.path) || ""; };
    var items = (S.items || []).map(function (it) { return { u: url(it && it.image), it: it || {} }; }).filter(function (x) { return x.u; });
    if (!items.length) return;
    css();
    var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    var effect = ["fade", "slide", "zoom", "kenburns"].indexOf(S.effect) >= 0 ? S.effect : "fade";
    var iv = Math.max(2, Math.min(30, +S.interval || 6)), sp = Math.max(.2, Math.min(4, S.speed == null ? 1 : +S.speed));
    var tone = S.textColor === "dark" ? "hs-dark" : S.textColor === "theme" ? "" : "hs-light";
    var cls = ["hs-host"].concat(tone ? [tone] : [], S.height === "tall" ? ["hs-h-tall"] : S.height === "full" ? ["hs-h-full"] : [], S.hideArt !== false ? ["hs-solo"] : []);
    var st = { host: host, made: [], cls: cls, hidden: [], caps: [], off: [], t: 0 };
    cur = st;
    host.classList.add.apply(host.classList, cls);
    if (getComputedStyle(host).position === "static") { host.style.position = "relative"; st.off.push(function () { host.style.position = ""; }); }
    var bg = document.createElement("div");
    bg.className = "hs-bg hs-e-" + effect + " fx-skip"; bg.setAttribute("aria-hidden", "true");
    bg.style.setProperty("--hs-sp", sp + "s"); bg.style.setProperty("--hs-iv", (iv + sp) + "s");
    bg.innerHTML = items.map(function (x, i) { return '<div class="hs-s' + (i === 0 ? " on" : "") + '" style="background-position:' + (POS[x.it.position] || POS.center) + '" data-u="' + escH(x.u) + '"></div>'; }).join("") +
      '<div class="hs-ov"></div>';
    var ov = bg.lastChild, a = Math.max(0, Math.min(90, S.overlay == null ? 40 : +S.overlay)) / 100, col = /^#[0-9a-f]{3,8}$/i.test(S.overlayColor || "") ? S.overlayColor : "#000000";
    var mix = function (p) { return "color-mix(in srgb," + col + " " + Math.round(p * 100) + "%,transparent)"; };
    ov.style.background = S.overlayStyle === "left" ? "linear-gradient(90deg," + mix(Math.min(1, a * 1.6)) + "," + mix(a * .25) + ")" : S.overlayStyle === "bottom" ? "linear-gradient(0deg," + mix(Math.min(1, a * 1.6)) + "," + mix(a * .2) + " 70%)" : col;
    if (S.overlayStyle !== "left" && S.overlayStyle !== "bottom") ov.style.opacity = a;
    host.insertBefore(bg, host.firstChild); st.made.push(bg);
    var slides = [].slice.call(bg.querySelectorAll(".hs-s"));
    var load = function (i) { var s = slides[i]; if (s && !s.style.backgroundImage) s.style.backgroundImage = "url(\"" + s.dataset.u.replace(/"/g, "%22") + "\")"; };
    load(0); load(1 % slides.length);
    if (S.hideArt !== false && o.hide) [].slice.call(host.querySelectorAll(o.hide)).forEach(function (n) { n.dataset.hsD = n.style.display; n.style.display = "none"; st.hidden.push(n); });
    // Slides with their own heading or text swap the hero's words while they show.
    var capEl = function (sel) { var e = sel && host.querySelector(sel); if (e) { st.caps.push({ el: e, html: e.innerHTML }); e.classList.add("hs-cap"); } return e; };
    var hasCaps = items.some(function (x) { return x.it.title || x.it.text; });
    var tEl = hasCaps ? capEl(o.title) : null, xEl = hasCaps ? capEl(o.text) : null;
    var tHtml = tEl ? tEl.innerHTML : "", xHtml = xEl ? xEl.innerHTML : "";
    var at = 0, paused = false, ui = null, dots = [];
    function words(i) {
      var it = items[i].it;
      var put = function (el, html) { if (!el || el.innerHTML === html) return; el.classList.add("hs-fade"); setTimeout(function () { el.innerHTML = html; el.classList.remove("hs-fade"); }, reduced ? 0 : 300); };
      put(tEl, it.title ? lines(it.title) : tHtml); put(xEl, it.text ? lines(it.text) : xHtml);
    }
    function go(i) {
      i = (i + slides.length) % slides.length; if (i === at) return;
      load(i); load((i + 1) % slides.length);
      var prev = slides[at];
      // Every other slide goes back to its waiting place without animating (for "slide": off to the right).
      slides.forEach(function (s) { if (s === prev) return; s.style.transition = "none"; s.classList.remove("out", "on"); });
      void bg.offsetWidth;
      slides.forEach(function (s) { if (s !== prev) s.style.transition = ""; });
      if (effect === "slide") prev.classList.add("out");
      if (effect === "kenburns") { slides[i].style.animation = "none"; void slides[i].offsetWidth; slides[i].style.animation = ""; }
      prev.classList.remove("on"); slides[i].classList.add("on");
      at = i; dots.forEach(function (d, k) { d.setAttribute("aria-current", String(k === i)); });
      words(i);
    }
    var auto = !reduced && slides.length > 1;
    function play() { clearInterval(st.t); if (auto && !paused) st.t = setInterval(function () { if (!document.hidden) go(at + 1); }, iv * 1000); }
    if (slides.length > 1) {
      if (S.dots !== false || auto) {
        ui = document.createElement("div"); ui.className = "hs-ui"; ui.setAttribute("role", "group"); ui.setAttribute("aria-label", "Background slides");
        if (S.dots !== false) items.forEach(function (_, i) { var b = document.createElement("button"); b.type = "button"; b.className = "hs-dot"; b.setAttribute("aria-label", "Show slide " + (i + 1)); b.setAttribute("aria-current", String(i === 0)); b.onclick = function () { go(i); play(); }; ui.appendChild(b); dots.push(b); });
        if (auto) {
          var pb = document.createElement("button"); pb.type = "button"; pb.className = "hs-pp";
          var sync = function () { pb.textContent = paused ? "▶" : "❚❚"; pb.style.fontSize = paused ? "11px" : "8px"; pb.setAttribute("aria-label", paused ? "Play slides" : "Pause slides"); };
          pb.onclick = function () { paused = !paused; st.user = paused; sync(); play(); }; sync(); ui.appendChild(pb);
        }
        host.appendChild(ui); st.made.push(ui);
      }
      if (S.arrows) ["p", "n"].forEach(function (k) { var b = document.createElement("button"); b.type = "button"; b.className = "hs-arr " + k; b.textContent = k === "p" ? "‹" : "›"; b.setAttribute("aria-label", k === "p" ? "Previous slide" : "Next slide"); b.onclick = function () { go(at + (k === "p" ? -1 : 1)); play(); }; host.appendChild(b); st.made.push(b); });
      // Swipe on touch screens.
      var x0 = null;
      var ts = function (e) { x0 = e.touches[0].clientX; }, te = function (e) { if (x0 == null) return; var dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 50) { go(at + (dx < 0 ? 1 : -1)); play(); } };
      host.addEventListener("touchstart", ts, { passive: true }); host.addEventListener("touchend", te, { passive: true });
      st.off.push(function () { host.removeEventListener("touchstart", ts); host.removeEventListener("touchend", te); });
      if (S.pause !== false) {
        var hold = function () { if (!st.user) { paused = true; play(); } }, free = function () { if (!st.user) { paused = false; play(); } };
        host.addEventListener("mouseenter", hold); host.addEventListener("mouseleave", free); host.addEventListener("focusin", hold); host.addEventListener("focusout", free);
        st.off.push(function () { host.removeEventListener("mouseenter", hold); host.removeEventListener("mouseleave", free); host.removeEventListener("focusin", hold); host.removeEventListener("focusout", free); });
      }
      play();
    }
    if (items[0].it.title || items[0].it.text) words(0);
  }
  window.SiteSlides = { mount: mount, stop: stop };
})();
