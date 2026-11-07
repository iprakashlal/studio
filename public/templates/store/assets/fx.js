/* Site FX: the interaction engine shared by every Site Studio template.
   Source of truth: src/fx/fx.js. `npm run sync:fx` copies it to each template's assets/ folder
   (it runs automatically before `dev` and `build`), so exported sites carry it as assets/fx.js.

   Each template sets these attributes on <html> from content.theme and calls SiteFX.init()
   after every render:
     data-cursor    none | dot | blend | spotlight | trail
     data-loader    none | curtain | counter | split      (also animates page-to-page links)
     data-textfx    none | lines | letters | scramble
     data-hoverfx   none | lift | magnetic | tilt
     data-scrollfx  none | progress | smooth | skew
     data-overlay   none | grain | scanlines | vignette
   Visitors who ask for reduced motion get a still page (only static overlays stay). */
(function () {
  "use strict";
  if (window.SiteFX) return;

  var doc = document.documentElement;
  var RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var FINE = matchMedia("(hover:hover) and (pointer:fine)").matches;
  var PREVIEW = window.name === "cms-preview" && window.parent !== window;
  var T0 = Date.now();

  var CARD = ".tile,.proj,.edu .t,.contact-box,.pcard,.cat,.wcard,.quote,.ocard,.box";
  var TILT = ".tile,.proj,.edu .t,.pcard .im,.cat,.wcard";
  var MAGNET = ".b,.btn,.pill-btn,.logo,.nav a,header nav a,.chip,[data-magnetic]";
  var LINKISH = "a,button,[role=button],label,summary,select,.chip";
  var TEXT = "main h1,main h2,[data-fx-text]";
  var GLYPHS = "!<>-_\\/[]{}=+*^?#ABCDEFGHIKLMNOPRSTUVXYZ0123456789";

  var st = { sig: "", loader: "", loaderPlayed: false, x: -100, y: -100, rx: -100, ry: -100, seen: false, io: null, skewEls: [] };

  function cfg() {
    var d = doc.dataset;
    return { cursor: d.cursor || "none", loader: d.loader || "none", text: d.textfx || "none", hover: d.hoverfx || "none", scroll: d.scrollfx || "none", overlay: d.overlay || "none" };
  }
  function cssVar(n) { return getComputedStyle(doc).getPropertyValue(n).trim(); }
  function colors() {
    var a = cssVar("--c1") || cssVar("--accent") || "#7c5cff";
    var deep = cssVar("--deep") || cssVar("--text") || "#111";
    var on = cssVar("--on-deep") || cssVar("--bg") || "#fff";
    return { a: a, deep: deep, on: on };
  }
  function isDark() {
    var h = (cssVar("--bg") || "#fff").replace("#", "");
    if (h.length === 3) h = h.replace(/./g, "$&$&");
    var n = parseInt(h, 16); if (isNaN(n)) return false;
    return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) < 110;
  }
  function el(tag, cls, html) { var e = document.createElement(tag); e.className = cls; if (html) e.innerHTML = html; return e; }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function escHtml(s) { return String(s || "").replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  /* ---------------------------------------------------------------- styles */
  var GRAIN = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";
  var CSS = [
    ":root{--fxa:var(--c1,var(--accent,#7c5cff));--fxi:var(--text,#111);--fxd:var(--deep,var(--text,#111));--fxo:var(--on-deep,var(--bg,#fff));--fxe:cubic-bezier(.16,1,.3,1)}",
    /* overlay */
    ".fx-ov{position:fixed;pointer-events:none;z-index:99970;inset:0}",
    "html[data-overlay=grain] .fx-ov{inset:-60%;background-image:url(\"" + GRAIN + "\");opacity:.085;animation:fxgrain .9s steps(5) infinite}",
    "html.fx-dark[data-overlay=grain] .fx-ov{opacity:.11;mix-blend-mode:screen}",
    "html[data-overlay=scanlines] .fx-ov{background:repeating-linear-gradient(0deg,rgba(0,0,0,.22) 0 1px,transparent 1px 3px);mix-blend-mode:multiply}",
    "html[data-overlay=vignette] .fx-ov{background:radial-gradient(ellipse at 50% 45%,transparent 50%,rgba(0,0,0,.5))}",
    "@keyframes fxgrain{0%{transform:translate(0,0)}20%{transform:translate(-6%,4%)}40%{transform:translate(5%,-3%)}60%{transform:translate(-3%,-6%)}80%{transform:translate(6%,5%)}100%{transform:translate(0,0)}}",
    /* cursor */
    "html.fx-nocur,html.fx-nocur *{cursor:none!important}",
    "html.fx-nocur :is(input,textarea,[contenteditable=true]){cursor:text!important}",
    ".fx-dot,.fx-ring{position:fixed;left:0;top:0;pointer-events:none;z-index:99990;opacity:0;transition:opacity .3s;will-change:transform}",
    "html.fx-seen .fx-dot,html.fx-seen .fx-ring{opacity:1}",
    "html.fx-typing .fx-dot,html.fx-typing .fx-ring{opacity:0}",
    ".fx-dot i,.fx-ring i{position:absolute;left:0;top:0;border-radius:50%;transform:translate(-50%,-50%);transition:transform .45s var(--fxe),background .3s,border-color .3s}",
    ".fx-dot i{width:7px;height:7px;background:var(--fxa)}",
    ".fx-ring i{width:38px;height:38px;border:1.5px solid color-mix(in srgb,var(--fxi) 45%,transparent)}",
    ".fx-ring b{position:absolute;left:0;top:0;transform:translate(-50%,-50%) scale(.6);opacity:0;font:700 11px/1 var(--fb,system-ui);letter-spacing:.12em;text-transform:uppercase;color:var(--on-c1,#fff);white-space:nowrap;transition:opacity .3s,transform .45s var(--fxe)}",
    ".fx-ring.is-link i{transform:translate(-50%,-50%) scale(1.55);background:color-mix(in srgb,var(--fxa) 16%,transparent);border-color:var(--fxa)}",
    ".fx-ring.is-card i{transform:translate(-50%,-50%) scale(2.35);background:var(--fxa);border-color:var(--fxa)}",
    ".fx-ring.is-card b{opacity:1;transform:translate(-50%,-50%) scale(1)}",
    ".fx-dot.is-card i{transform:translate(-50%,-50%) scale(0)}",
    ".fx-ring.is-down i{transform:translate(-50%,-50%) scale(.8)}",
    "html[data-cursor=blend] .fx-dot{display:none}",
    "html[data-cursor=blend] .fx-ring{mix-blend-mode:difference}",
    "html[data-cursor=blend] .fx-ring i{width:22px;height:22px;border:0;background:#fff}",
    "html[data-cursor=blend] .fx-ring.is-link i{transform:translate(-50%,-50%) scale(3);background:#fff}",
    "html[data-cursor=blend] .fx-ring.is-card i{transform:translate(-50%,-50%) scale(5.2);background:#fff}",
    "html[data-cursor=blend] .fx-ring b{display:none}",
    ".fx-spot{position:fixed;inset:0;pointer-events:none;z-index:99960;opacity:0;transition:opacity .5s;background:radial-gradient(560px circle at var(--mx,50%) var(--my,50%),color-mix(in srgb,var(--fxa) 22%,transparent),transparent 62%);mix-blend-mode:multiply}",
    "html.fx-dark .fx-spot{mix-blend-mode:screen}",
    "html.fx-seen .fx-spot{opacity:1}",
    ".fx-trail{position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:99989}",
    /* loader + page transitions */
    ".fx-load{position:fixed;inset:0;z-index:99999;pointer-events:none;color:var(--fxo);font-family:var(--fd,system-ui)}",
    ".fx-load .fx-p{position:absolute;left:0;right:0;background:var(--fxd)}",
    ".fx-load--curtain .fx-p,.fx-load--counter .fx-p,.fx-cover .fx-p,.fx-exit .fx-p{top:0;bottom:0}",
    ".fx-load--curtain .fx-p{transition:transform 1s var(--fxe)}",
    ".fx-load--curtain.out .fx-p,.fx-cover.out .fx-p{transform:translateY(-101%)}",
    ".fx-cover .fx-p{transition:transform .9s var(--fxe)}",
    ".fx-load--counter .fx-p{transition:clip-path 1s var(--fxe);clip-path:inset(0 0 0 0)}",
    ".fx-load--counter.out .fx-p{clip-path:inset(0 0 100% 0)}",
    ".fx-load--split .fx-pt{top:0;height:50.5%;transition:transform 1s var(--fxe)}",
    ".fx-load--split .fx-pb{bottom:0;height:50.5%;transition:transform 1s var(--fxe)}",
    ".fx-load--split.out .fx-pt{transform:translateY(-101%)}",
    ".fx-load--split.out .fx-pb{transform:translateY(101%)}",
    ".fx-brand{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:clamp(28px,6vw,76px);font-weight:800;letter-spacing:.32em;text-transform:uppercase;white-space:nowrap;padding-left:.32em;transition:opacity .4s,letter-spacing 1.2s var(--fxe)}",
    ".fx-brand span{display:inline-block;opacity:0;transform:translateY(60%);animation:fxup .7s var(--fxe) forwards;animation-delay:calc(var(--i)*45ms)}",
    ".fx-load.go .fx-brand{letter-spacing:.12em}",
    ".fx-load.out .fx-brand,.fx-load.out .fx-num,.fx-load.out .fx-bar{opacity:0}",
    ".fx-num{position:absolute;right:4vw;bottom:3vh;font-size:clamp(72px,18vw,240px);font-weight:800;line-height:.8;letter-spacing:-.04em;font-variant-numeric:tabular-nums;transition:opacity .3s}",
    ".fx-num small{font-size:.3em;vertical-align:top;margin-left:.08em}",
    ".fx-bar{position:absolute;left:4vw;right:4vw;bottom:2vh;height:2px;background:currentColor;transform-origin:0 50%;transform:scaleX(0);opacity:.5;transition:opacity .3s}",
    ".fx-exit .fx-p{transform:translateY(101%);transition:transform .55s cubic-bezier(.7,0,.3,1)}",
    ".fx-exit.in .fx-p{transform:none}",
    "@keyframes fxup{to{opacity:1;transform:none}}",
    /* text */
    ".fx-w{display:inline-block;white-space:nowrap}",
    "html[data-textfx=lines] [data-fx-split] .fx-w{overflow:hidden;vertical-align:top;padding:0 .04em .1em;margin:0 -.04em -.1em}",
    "html[data-textfx=lines] [data-fx-split] .fx-wi{display:inline-block;transform:translateY(112%) rotate(4deg);transform-origin:0 100%;transition:transform 1.1s var(--fxe);transition-delay:calc(var(--l,0)*110ms + var(--k,0)*18ms)}",
    "html[data-textfx=lines] .fx-in .fx-wi{transform:none}",
    "html[data-textfx=letters] [data-fx-split] .fx-c{display:inline-block;opacity:0;transform:translateY(.55em) rotate(10deg) scale(.9);transform-origin:0 100%;transition:transform .9s var(--fxe),opacity .6s;transition-delay:calc(var(--i,0)*24ms)}",
    "html[data-textfx=letters] .fx-in .fx-c{opacity:1;transform:none}",
    "html[data-textfx=letters] .h-name .ln>span{animation:none!important}",
    ".fx-now,.fx-now *{transition:none!important}",
    /* hover */
    ".fx-card{transition:transform .5s var(--fxe),box-shadow .5s var(--fxe),border-color .3s}",
    "html:is([data-hoverfx=lift],[data-hoverfx=magnetic]) .fx-card:hover{transform:translateY(-6px);box-shadow:0 0 0 1px color-mix(in srgb,var(--fxa) 55%,transparent),0 26px 50px -26px rgba(0,0,0,.55)}",
    "html[data-hoverfx=tilt] .fx-tilt{transform-style:preserve-3d;transition:transform .6s var(--fxe)}",
    ".fx-glare{position:absolute;inset:0;border-radius:inherit;pointer-events:none;opacity:0;transition:opacity .4s;background:radial-gradient(420px circle at var(--gx,50%) var(--gy,50%),rgba(255,255,255,.28),transparent 45%);mix-blend-mode:overlay;z-index:3}",
    ".fx-tilt:hover>.fx-glare{opacity:1}",
    /* scroll */
    ".fx-prog{position:fixed;left:0;top:0;height:3px;width:100%;z-index:99980;background:var(--fxa);transform-origin:0 50%;transform:scaleX(0);pointer-events:none}",
  ].join("\n");

  function ensureStyle() {
    if (document.getElementById("sitefx-css")) return;
    var s = document.createElement("style"); s.id = "sitefx-css"; s.textContent = CSS; document.head.appendChild(s);
  }

  /* ---------------------------------------------------------------- page-to-page cover */
  // A link click with a loader theme slides a panel in; the next page starts covered and slides it away.
  var cover = null;
  try {
    var pend = sessionStorage.getItem("fx-exit");
    if (pend) {
      sessionStorage.removeItem("fx-exit");
      ensureStyle();
      cover = el("div", "fx-load fx-cover", '<div class="fx-p" style="background:' + escHtml(pend) + '"></div>');
      (document.body || doc).appendChild(cover);
      setTimeout(function () { if (cover) revealCover(); }, 4000);
    }
  } catch (e) {}
  function revealCover() {
    var c = cover; cover = null; if (!c) return;
    requestAnimationFrame(function () { c.classList.add("out"); setTimeout(function () { c.remove(); }, 1000); });
  }

  /* ---------------------------------------------------------------- layers */
  var L = {};
  function layer(key, want, make) {
    if (want && !L[key]) { L[key] = make(); document.body.appendChild(L[key]); }
    if (!want && L[key]) { L[key].remove(); L[key] = null; }
    return L[key];
  }

  /* ---------------------------------------------------------------- loader */
  function playLoader(kind, brand) {
    var c = colors();
    var letters = String(brand || "").slice(0, 24).split("").map(function (ch, i) { return '<span style="--i:' + i + '">' + (ch === " " ? "&nbsp;" : escHtml(ch)) + "</span>"; }).join("");
    var html = kind === "split" ? '<div class="fx-p fx-pt"></div><div class="fx-p fx-pb"></div>' : '<div class="fx-p"></div>';
    if (kind !== "counter" && letters) html += '<div class="fx-brand">' + letters + "</div>";
    if (kind === "counter") html += '<div class="fx-num">0<small>%</small></div><div class="fx-bar"></div>';
    var box = el("div", "fx-load fx-load--" + kind, html);
    box.style.setProperty("--fxd", c.deep); box.style.setProperty("--fxo", c.on);
    document.body.appendChild(box);
    var hold = kind === "counter" ? 1200 : 1050, done = false;
    function out() { if (done) return; done = true; box.classList.add("out"); setTimeout(function () { box.remove(); }, 1100); }
    requestAnimationFrame(function () { box.classList.add("go"); });
    if (kind === "counter") {
      var n = box.querySelector(".fx-num"), bar = box.querySelector(".fx-bar"), s0 = performance.now();
      (function tick(now) {
        var p = Math.min(1, (now - s0) / hold), e = 1 - Math.pow(1 - p, 3);
        n.firstChild.nodeValue = String(Math.round(e * 100)); bar.style.transform = "scaleX(" + e + ")";
        if (p < 1) requestAnimationFrame(tick); else setTimeout(out, 120);
      })(s0);
    } else setTimeout(out, hold);
    setTimeout(out, 3500);
  }

  /* ---------------------------------------------------------------- text */
  function splitText(node, mode) {
    if (node.hasAttribute("data-fx-split")) return;
    var label = node.textContent.replace(/\s+/g, " ").trim();
    if (!label) return;
    if (mode === "letters" && label.length > 90) mode = "lines";
    node.setAttribute("data-fx-split", mode);
    if (!node.hasAttribute("aria-label")) node.setAttribute("aria-label", label);
    var walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT), nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    var ci = 0, wi = 0;
    nodes.forEach(function (n) {
      var parts = n.nodeValue.split(/(\s+)/), frag = document.createDocumentFragment();
      parts.forEach(function (p) {
        if (!p) return;
        if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(" ")); return; }
        var w = el("span", "fx-w"); w.setAttribute("aria-hidden", "true"); w.style.setProperty("--k", wi++);
        if (mode === "letters") {
          Array.from(p).forEach(function (ch) { var c = el("span", "fx-c"); c.textContent = ch; c.style.setProperty("--i", Math.min(ci++, 45)); w.appendChild(c); });
        } else { var i = el("span", "fx-wi"); i.textContent = p; w.appendChild(i); }
        frag.appendChild(w);
      });
      n.parentNode.replaceChild(frag, n);
    });
  }
  function markLines(node) {
    var top = null, line = -1;
    $$(".fx-w", node).forEach(function (w) {
      var t = Math.round(w.offsetTop);
      if (top === null || Math.abs(t - top) > 4) { top = t; line++; }
      w.style.setProperty("--l", line);
    });
  }
  var ORIG = new WeakMap();
  function scramble(node) {
    if (node.__fxs) return; node.__fxs = true;
    var tn = [], w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) tn.push(w.currentNode);
    tn.forEach(function (t) { if (!ORIG.has(t)) ORIG.set(t, t.nodeValue); });
    var total = tn.reduce(function (a, t) { return a + ORIG.get(t).length; }, 0);
    var frames = Math.min(50, 18 + Math.round(total * 0.6)), f = 0;
    (function step() {
      var k = 0;
      tn.forEach(function (t) {
        var o = ORIG.get(t), out = "";
        for (var i = 0; i < o.length; i++, k++) {
          var ch = o[i], at = (k / Math.max(1, total)) * frames * 0.75 + 4;
          out += /\s/.test(ch) || f >= at ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
        }
        t.nodeValue = out;
      });
      if (++f <= frames) requestAnimationFrame(step);
      else { tn.forEach(function (t) { t.nodeValue = ORIG.get(t); }); node.__fxs = false; }
    })();
  }
  function setupText(root, c, animate, delay) {
    if (st.io) { st.io.disconnect(); st.io = null; }
    if (c.text === "none" || RM) return;
    var targets = $$(TEXT, root).filter(function (n) { return !n.closest("nav,header,form,.fx-skip,.nav"); });
    if (c.text === "lines") targets = targets.filter(function (n) { return !n.classList.contains("h-name"); });
    if (c.text !== "scramble") targets.forEach(function (n) { splitText(n, c.text); });
    if (!animate) { targets.forEach(function (n) { n.classList.add("fx-in", "fx-now"); }); setTimeout(function () { targets.forEach(function (n) { n.classList.remove("fx-now"); }); }, 50); return; }
    if (!("IntersectionObserver" in window)) { targets.forEach(function (n) { n.classList.add("fx-in"); }); return; }
    st.io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var n = e.target; st.io.unobserve(n);
        if (c.text === "scramble") scramble(n);
        else { if (c.text === "lines") markLines(n); requestAnimationFrame(function () { n.classList.add("fx-in"); }); }
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -6% 0px" });
    var io = st.io;
    setTimeout(function () { if (st.io === io) targets.forEach(function (n) { io.observe(n); }); }, delay || 0);
  }

  /* ---------------------------------------------------------------- cursor */
  var trail = { pts: [], ctx: null, run: false };
  function setupCursor(c) {
    var custom = FINE && !RM && (c.cursor === "dot" || c.cursor === "blend");
    doc.classList.toggle("fx-nocur", custom);
    layer("dot", custom, function () { return el("div", "fx-dot", "<i></i>"); });
    layer("ring", custom, function () { return el("div", "fx-ring", "<i></i><b>View</b>"); });
    layer("spot", FINE && !RM && c.cursor === "spotlight", function () { return el("div", "fx-spot"); });
    var tc = layer("trail", FINE && !RM && c.cursor === "trail", function () { return el("canvas", "fx-trail"); });
    if (tc) { trail.ctx = tc.getContext("2d"); sizeTrail(); }
  }
  function sizeTrail() {
    if (!L.trail) return; var d = Math.min(devicePixelRatio || 1, 2);
    L.trail.width = innerWidth * d; L.trail.height = innerHeight * d; trail.ctx.setTransform(d, 0, 0, d, 0, 0);
  }
  function drawTrail() {
    if (!L.trail) { trail.run = false; return; }
    var x = trail.ctx, now = performance.now();
    trail.pts = trail.pts.filter(function (p) { return now - p.t < 520; });
    x.clearRect(0, 0, innerWidth, innerHeight);
    if (trail.pts.length > 1) {
      x.lineCap = "round"; x.lineJoin = "round"; x.strokeStyle = st.accent || "#7c5cff";
      for (var i = 1; i < trail.pts.length; i++) {
        var a = trail.pts[i - 1], b = trail.pts[i], life = 1 - (now - b.t) / 520;
        x.globalAlpha = life * 0.9; x.lineWidth = 2 + life * 10;
        x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke();
      }
      x.globalAlpha = 1;
    }
    if (trail.pts.length) requestAnimationFrame(drawTrail); else trail.run = false;
  }
  function cursorLoop() {
    if (L.ring) {
      st.rx += (st.x - st.rx) * 0.18; st.ry += (st.y - st.ry) * 0.18;
      L.ring.style.transform = "translate3d(" + st.rx + "px," + st.ry + "px,0)";
      L.dot.style.transform = "translate3d(" + st.x + "px," + st.y + "px,0)";
    }
    requestAnimationFrame(cursorLoop);
  }

  /* ---------------------------------------------------------------- hover */
  var mag = null;
  function releaseMag() { if (!mag) return; mag.style.transition = "transform .7s cubic-bezier(.2,1.8,.4,1)"; mag.style.transform = ""; mag = null; }
  function tiltCard(t, e) {
    var r = t.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    if (!t.__fxg) {
      t.__fxg = true;
      if (getComputedStyle(t).position === "static") t.style.position = "relative";
      t.appendChild(el("i", "fx-glare"));
    }
    t.style.transition = "transform .12s linear";
    t.style.transform = "perspective(900px) rotateX(" + ((0.5 - py) * 9).toFixed(2) + "deg) rotateY(" + ((px - 0.5) * 11).toFixed(2) + "deg) translateZ(6px)";
    t.style.setProperty("--gx", (px * 100).toFixed(1) + "%"); t.style.setProperty("--gy", (py * 100).toFixed(1) + "%");
  }
  var tiltEl = null;
  function releaseTilt() { if (!tiltEl) return; tiltEl.style.transition = "transform .7s var(--fxe)"; tiltEl.style.transform = ""; tiltEl = null; }

  function onMove(e) {
    var c = cfg();
    st.x = e.clientX; st.y = e.clientY;
    if (!st.seen) { st.seen = true; st.rx = st.x; st.ry = st.y; doc.classList.add("fx-seen"); }
    if (L.spot) { L.spot.style.setProperty("--mx", e.clientX + "px"); L.spot.style.setProperty("--my", e.clientY + "px"); }
    if (L.trail) { trail.pts.push({ x: e.clientX, y: e.clientY, t: performance.now() }); if (!trail.run) { trail.run = true; requestAnimationFrame(drawTrail); } }
    var t = e.target && e.target.closest ? e.target : null;
    if (L.ring && t) {
      var typing = !!t.closest("input,textarea,[contenteditable=true]");
      doc.classList.toggle("fx-typing", typing);
      var card = t.closest(".fx-card"), link = t.closest(LINKISH);
      var lab = card && (card.getAttribute("data-fx-label") || (card.closest("a") || card.querySelector("a") ? "View" : ""));
      var isCard = !!(card && lab && (!link || link.contains(card) || link === card));
      L.ring.classList.toggle("is-card", isCard); L.dot.classList.toggle("is-card", isCard);
      L.ring.classList.toggle("is-link", !isCard && !!link);
      if (isCard) L.ring.querySelector("b").textContent = lab;
    }
    if (RM || !FINE) return;
    if (c.hover === "magnetic") {
      var m = t && t.closest(MAGNET);
      if (m !== mag) releaseMag();
      if (m) {
        mag = m; var r = m.getBoundingClientRect();
        var dx = (e.clientX - (r.left + r.width / 2)) * 0.32, dy = (e.clientY - (r.top + r.height / 2)) * 0.4;
        m.style.transition = "transform .25s var(--fxe)"; m.style.transform = "translate3d(" + dx.toFixed(1) + "px," + dy.toFixed(1) + "px,0)";
      }
    } else if (mag) releaseMag();
    if (c.hover === "tilt") {
      var tl = t && t.closest(".fx-tilt");
      if (tl !== tiltEl) releaseTilt();
      if (tl) { tiltEl = tl; tiltCard(tl, e); }
    } else if (tiltEl) releaseTilt();
  }

  /* ---------------------------------------------------------------- scroll */
  var sm = { target: 0, cur: 0, run: false };
  function smoothOn() { var s = cfg().scroll; return FINE && !RM && (s === "smooth" || s === "skew"); }
  function scrollable(n) {
    for (; n && n !== document.body && n !== doc; n = n.parentElement) {
      var cs = getComputedStyle(n);
      if (/(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 1) return true;
    }
    return false;
  }
  function onWheel(e) {
    if (!smoothOn() || e.ctrlKey || e.defaultPrevented || Math.abs(e.deltaX) > Math.abs(e.deltaY) || scrollable(e.target)) return;
    e.preventDefault();
    var max = doc.scrollHeight - innerHeight;
    if (!sm.run) sm.target = sm.cur = scrollY;
    sm.target = Math.max(0, Math.min(max, sm.target + e.deltaY * (e.deltaMode === 1 ? 36 : e.deltaMode === 2 ? innerHeight : 1)));
    if (!sm.run) { sm.run = true; requestAnimationFrame(smoothStep); }
  }
  function smoothStep() {
    sm.cur += (sm.target - sm.cur) * 0.1;
    if (Math.abs(sm.target - sm.cur) < 0.5) { sm.cur = sm.target; sm.run = false; }
    scrollTo(0, sm.cur);
    if (sm.run) requestAnimationFrame(smoothStep);
  }
  var sk = { last: 0, v: 0, run: false };
  function skewStep() {
    var y = scrollY, dv = y - sk.last; sk.last = y;
    sk.v += (dv - sk.v) * 0.18;
    var s = Math.max(-4, Math.min(4, sk.v * 0.09));
    var still = Math.abs(s) < 0.02;
    st.skewEls.forEach(function (n) { n.style.transform = still ? "" : "skewY(" + s.toFixed(3) + "deg)"; });
    if (!still || Math.abs(dv) > 0) requestAnimationFrame(skewStep); else sk.run = false;
  }
  function onScroll() {
    if (L.prog) { var max = doc.scrollHeight - innerHeight; L.prog.style.transform = "scaleX(" + (max > 0 ? Math.min(1, scrollY / max) : 0) + ")"; }
    if (st.skewEls.length && !RM && !sk.run) { sk.run = true; sk.last = scrollY - 1; requestAnimationFrame(skewStep); }
  }

  /* ---------------------------------------------------------------- page links */
  function onClick(e) {
    var c = cfg();
    if (c.loader === "none" || RM || PREVIEW || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a || a.target && a.target !== "_self" || a.hasAttribute("download")) return;
    var u; try { u = new URL(a.href, location.href); } catch (x) { return; }
    if (u.origin !== location.origin || !/^https?:$/.test(u.protocol) || /admin\.html$/.test(u.pathname)) return;
    if (u.pathname === location.pathname && u.search === location.search) return;
    e.preventDefault();
    var col = colors(), box = el("div", "fx-load fx-exit", '<div class="fx-p"></div>');
    box.querySelector(".fx-p").style.background = col.deep;
    document.body.appendChild(box);
    try { sessionStorage.setItem("fx-exit", col.deep); } catch (x) {}
    requestAnimationFrame(function () { requestAnimationFrame(function () { box.classList.add("in"); }); });
    setTimeout(function () { location.href = u.href; }, 560);
  }
  addEventListener("pageshow", function (e) { if (e.persisted) $$(".fx-exit").forEach(function (n) { n.remove(); }); });

  /* ---------------------------------------------------------------- init */
  var wired = false;
  function wire() {
    if (wired) return; wired = true;
    addEventListener("pointermove", onMove, { passive: true });
    addEventListener("pointerdown", function () { if (L.ring) L.ring.classList.add("is-down"); }, { passive: true });
    addEventListener("pointerup", function () { if (L.ring) L.ring.classList.remove("is-down"); }, { passive: true });
    document.addEventListener("pointerleave", function () { doc.classList.remove("fx-seen"); st.seen = false; });
    addEventListener("wheel", onWheel, { passive: false });
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", sizeTrail);
    document.addEventListener("click", onClick);
    document.addEventListener("pointerover", function (e) {
      if (cfg().text !== "scramble" || RM) return;
      var a = e.target.closest && e.target.closest(".nav a,header a,.b,.btn,.pill-btn");
      if (a && !a.contains(e.relatedTarget)) scramble(a);
    });
    requestAnimationFrame(cursorLoop);
  }

  /** Call after every render. opts.root: the element holding the site; opts.brand: name for the loader. */
  function init(opts) {
    opts = opts || {};
    var root = opts.root || document.body;
    ensureStyle(); wire();
    var c = cfg(), sig = JSON.stringify(c), changed = sig !== st.sig;
    st.sig = sig;
    doc.classList.toggle("fx-dark", isDark());
    st.accent = colors().a;

    layer("ov", c.overlay !== "none", function () { return el("div", "fx-ov"); });
    if (RM && L.ov) L.ov.style.animation = "none";
    setupCursor(c);
    layer("prog", !RM && c.scroll === "progress", function () { return el("div", "fx-prog"); });

    // cards for hover effects
    $$(CARD, root).forEach(function (n) { if (!n.closest(".stack")) n.classList.add("fx-card"); });
    $$(TILT, root).forEach(function (n) { if (!n.closest(".stack") && !n.classList.contains("tiltable")) n.classList.add("fx-tilt"); });
    if (c.hover !== "tilt") releaseTilt();
    if (c.hover !== "magnetic") releaseMag();

    // velocity skew targets (sticky decks stay straight)
    st.skewEls.forEach(function (n) { n.style.transform = ""; });
    st.skewEls = c.scroll === "skew" && !RM ? $$("main > *", root).filter(function (n) { return !n.querySelector(".stack,[style*=sticky]") && !n.classList.contains("hero"); }) : [];

    // entrance: page cover from the previous page, or the theme's loader
    var animate = !RM && (!PREVIEW || changed), delay = 0;
    if (cover) { st.loaderPlayed = true; revealCover(); delay = 350; }
    else if (c.loader !== "none" && !RM) {
      var play = PREVIEW ? c.loader !== st.loader : !st.loaderPlayed && Date.now() - T0 < 5000;
      if (play) { st.loaderPlayed = true; playLoader(c.loader, opts.brand || document.title); delay = c.loader === "counter" ? 1250 : 950; }
    }
    st.loader = c.loader;
    setupText(root, c, animate, delay);
    onScroll();
  }

  window.SiteFX = { init: init, version: 1 };
})();
