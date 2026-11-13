/* Site FX: the interaction engine shared by every Site Studio template.
   Source of truth: src/fx/fx.js. `npm run sync:fx` copies it to each template's assets/ folder
   (it runs automatically before `dev` and `build`), so exported sites carry it as assets/fx.js.

   Each template sets these attributes on <html> from content.theme and calls SiteFX.init()
   after every render:
     data-cursor    none | dot | blend | spotlight | trail | ring
     data-loader    none | curtain | counter | split | wipe | iris   (also animates page-to-page links)
     data-textfx    none | lines | letters | scramble | words
     data-hoverfx   none | lift | magnetic | tilt | shine
     data-scrollfx  none | progress | smooth | skew
     data-scrollease light | medium | heavy  (how strongly smooth scrolling eases; mouse wheels only)
   Intro screen colours come from --intro-bg / --intro-fg (falling back to --deep / --on-deep).
     data-overlay   none | grain | scanlines | vignette | paper | halftone
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
    var deep = cssVar("--intro-bg") || cssVar("--deep") || cssVar("--text") || "#111";
    var on = cssVar("--intro-fg") || cssVar("--on-deep") || cssVar("--bg") || "#fff";
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
  /* The Studio's mark (PA monogram) for the "Powered by" badge. */
  var MARK = "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%22425%2083%201056%201741%22%3E%3Cg%20fill%3D%22%23343366%22%3E%3Cpath%20d%3D%22M431%20240%20644%2089%20644%201308%20431%201176Z%22%2F%3E%3Cpath%20d%3D%22M644%2089%201267%20447%201048%20570%20644%20339Z%22%2F%3E%3Cpath%20d%3D%22M1048%20570%201267%20447%201269%20694%20666%201043%20666%20782Z%22%2F%3E%3C%2Fg%3E%3Cg%20fill%3D%22%2323233F%22%3E%3Cpath%20d%3D%22M644%2089%20666%20349%20644%20339Z%22%2F%3E%3Cpath%20d%3D%22M1028%20558%201267%20447%201048%20570Z%22%2F%3E%3C%2Fg%3E%3Cg%20fill%3D%22%2333679A%22%3E%3Cpath%20d%3D%22M1269%20727%201475%20853%201475%201818%201269%201691Z%22%2F%3E%3Cpath%20d%3D%22M666%201076%201269%20727%201269%20972%20886%201195Z%22%2F%3E%3Cpath%20d%3D%22M666%201076%20876%201201%201243%201420%201243%201676%20666%201322Z%22%2F%3E%3C%2Fg%3E%3Cg%20fill%3D%22%23244870%22%3E%3Cpath%20d%3D%22M1269%20727%201249%20983%201269%20972Z%22%2F%3E%3Cpath%20d%3D%22M666%201076%20897%201189%20876%201201Z%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E";
  var GRAIN = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";
  var CSS = [
    ":root{--fxa:var(--c1,var(--accent,#7c5cff));--fxi:var(--text,#111);--fxd:var(--deep,var(--text,#111));--fxo:var(--on-deep,var(--bg,#fff));--fxe:cubic-bezier(.16,1,.3,1)}",
    /* "Powered by" badge: always on screen, bottom right, small */
    ".fx-badge{position:fixed;right:max(12px,env(safe-area-inset-right,0px));bottom:max(12px,env(safe-area-inset-bottom,0px));z-index:99980;display:inline-flex;align-items:center;gap:7px;padding:5px 11px 5px 9px;border-radius:999px;background:#0E1118;color:#fff;font:600 11px/1.25 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;letter-spacing:.01em;text-decoration:none!important;box-shadow:0 8px 22px -10px rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.16);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);opacity:.92;transition:opacity .2s,transform .2s;max-width:calc(100vw - 24px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".fx-badge:hover,.fx-badge:focus-visible{opacity:1;transform:translateY(-1px)}",
    ".fx-badge .fx-bm{display:inline-block;flex:none;border-radius:3px}.fx-badge .fx-bm.m{background:#fff url(\"" + MARK + "\") center/auto 80% no-repeat}",
    "@media print{.fx-badge{display:none}}",
    /* overlay */
    ".fx-ov{position:fixed;pointer-events:none;z-index:99970;inset:0}",
    "html[data-overlay=grain] .fx-ov{inset:-60%;background-image:url(\"" + GRAIN + "\");opacity:.085;animation:fxgrain .9s steps(5) infinite}",
    "html.fx-dark[data-overlay=grain] .fx-ov{opacity:.11;mix-blend-mode:screen}",
    "html[data-overlay=scanlines] .fx-ov{background:repeating-linear-gradient(0deg,rgba(0,0,0,.22) 0 1px,transparent 1px 3px);mix-blend-mode:multiply}",
    "html[data-overlay=vignette] .fx-ov{background:radial-gradient(ellipse at 50% 45%,transparent 50%,rgba(0,0,0,.5))}",
    "html[data-overlay=paper] .fx-ov{inset:0;background-image:url(\"" + GRAIN + "\"),linear-gradient(115deg,rgba(255,240,215,.10),rgba(0,0,0,.04));opacity:.5;mix-blend-mode:multiply}",
    "html.fx-dark[data-overlay=paper] .fx-ov{mix-blend-mode:soft-light;opacity:.45}",
    "html[data-overlay=halftone] .fx-ov{inset:0;background-image:radial-gradient(rgba(0,0,0,.16) 1px,transparent 1.4px);background-size:5px 5px;-webkit-mask-image:linear-gradient(160deg,#000,transparent 55%);mask-image:linear-gradient(160deg,#000,transparent 55%)}",
    "html.fx-dark[data-overlay=halftone] .fx-ov{background-image:radial-gradient(rgba(255,255,255,.12) 1px,transparent 1.4px)}",
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
    "html[data-cursor=ring] .fx-dot i{width:5px;height:5px}",
    "html[data-cursor=ring] .fx-ring i{width:58px;height:58px;border:1px solid color-mix(in srgb,var(--fxi) 55%,transparent);transition:transform .7s var(--fxe),background .3s,border-color .3s}",
    "html[data-cursor=ring] .fx-ring.is-link i{transform:translate(-50%,-50%) scale(.55);background:color-mix(in srgb,var(--fxa) 25%,transparent);border-color:transparent}",
    "html[data-cursor=ring] .fx-ring.is-card i{transform:translate(-50%,-50%) scale(1.7);background:color-mix(in srgb,var(--fxa) 14%,transparent);border-color:var(--fxa)}",
    "html[data-cursor=ring] .fx-ring b{color:var(--fxi)}",
    ".fx-spot{position:fixed;inset:0;pointer-events:none;z-index:99960;opacity:0;transition:opacity .5s;background:radial-gradient(560px circle at var(--mx,50%) var(--my,50%),color-mix(in srgb,var(--fxa) 22%,transparent),transparent 62%);mix-blend-mode:multiply}",
    "html.fx-dark .fx-spot{mix-blend-mode:screen}",
    "html.fx-seen .fx-spot{opacity:1}",
    ".fx-trail{position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:99989}",
    /* loader + page transitions */
    ".fx-load{position:fixed;inset:0;z-index:99999;pointer-events:none;color:var(--fxo);font-family:var(--fd,system-ui)}",
    ".fx-load .fx-p{position:absolute;left:0;right:0;background:var(--fxd)}",
    ".fx-load--curtain .fx-p,.fx-load--counter .fx-p,.fx-cover:not(.fx-load--split) .fx-p,.fx-exit:not(.fx-load--split) .fx-p{top:0;bottom:0}",
    ".fx-load--curtain .fx-p{transition:transform 1s var(--fxe)}",
    ".fx-load--wipe .fx-p,.fx-load--iris .fx-p{top:0;bottom:0;transition:clip-path 1.1s var(--fxe)}",
    ".fx-load--wipe .fx-p{clip-path:polygon(0 0,100% 0,100% 100%,0 100%)}",
    ".fx-load--wipe.out .fx-p{clip-path:polygon(100% 0,100% 0,100% 100%,100% 100%)}",
    ".fx-load--iris .fx-p{clip-path:circle(150% at 50% 50%)}",
    ".fx-load--iris.out .fx-p{clip-path:circle(0% at 50% 50%)}",
    ".fx-load--curtain.out .fx-p,.fx-cover.out .fx-p{transform:translateY(-101%)}",
    ".fx-cover .fx-p{transition:transform .9s var(--fxe)}",
    ".fx-load--counter .fx-p{transition:clip-path 1s var(--fxe);clip-path:inset(0 0 0 0)}",
    ".fx-load--counter.out .fx-p{clip-path:inset(0 0 100% 0)}",
    ".fx-load--split .fx-pt{top:0;height:50.5%;transition:transform 1s var(--fxe)}",
    ".fx-load--split .fx-pb{bottom:0;height:50.5%;transition:transform 1s var(--fxe)}",
    ".fx-load--split.out .fx-pt{transform:translateY(-101%)}",
    ".fx-load--split.out .fx-pb{transform:translateY(101%)}",
    ".fx-brand{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:clamp(28px,6vw,76px);font-weight:800;letter-spacing:.32em;text-transform:uppercase;white-space:nowrap;padding-left:.32em;transition:opacity .4s,letter-spacing 1.2s var(--fxe)}",
    ".fx-brand span{display:inline-block;opacity:0;transform:translateY(60%)}",
    ".fx-load.ready .fx-brand span{animation:fxup .7s var(--fxe) forwards}",
    ".fx-load.go .fx-brand{letter-spacing:.12em}",
    ".fx-load.out .fx-brand,.fx-load.out .fx-num,.fx-load.out .fx-bar{opacity:0}",
    ".fx-num{position:absolute;right:4vw;bottom:3vh;font-size:clamp(72px,18vw,240px);font-weight:800;line-height:.8;letter-spacing:-.04em;font-variant-numeric:tabular-nums;transition:opacity .3s}",
    ".fx-num small{font-size:.3em;vertical-align:top;margin-left:.08em}",
    ".fx-bar{position:absolute;left:4vw;right:4vw;bottom:2vh;height:2px;background:currentColor;transform-origin:0 50%;transform:scaleX(0);opacity:.5;transition:opacity .3s}",
    ".fx-exit .fx-p{transform:translateY(101%);transition:transform .55s cubic-bezier(.7,0,.3,1)}",
    ".fx-exit.fx-load--split .fx-pt{transform:translateY(-101%)}",
    ".fx-exit.fx-load--split .fx-pt,.fx-exit.fx-load--split .fx-pb{transition:transform .55s cubic-bezier(.7,0,.3,1)}",
    ".fx-exit.in .fx-p{transform:none}",
    /* page-to-page: the name sits in the middle while the panels close, stays while the next page loads, then the panels open */
    ".fx-exit .fx-brand,.fx-cover .fx-brand{letter-spacing:.12em}",
    ".fx-exit .fx-brand span{animation-duration:.45s;animation-delay:.22s}",
    ".fx-cover .fx-brand span{animation:none;opacity:1;transform:none}",
    ".fx-cover.out .fx-brand{transition:opacity .35s}",
    "@keyframes fxup{to{opacity:1;transform:none}}",
    /* text */
    ".fx-w{display:inline-block;white-space:nowrap}",
    "html[data-textfx=lines] [data-fx-split] .fx-w{overflow:hidden;vertical-align:top;padding:0 .04em .1em;margin:0 -.04em -.1em}",
    "html[data-textfx=lines] [data-fx-split] .fx-wi{display:inline-block;transform:translateY(112%) rotate(4deg);transform-origin:0 100%;transition:transform 1.1s var(--fxe);transition-delay:calc(var(--l,0)*110ms + var(--k,0)*18ms)}",
    "html[data-textfx=lines] .fx-in .fx-wi{transform:none}",
    "html[data-textfx=letters] [data-fx-split] .fx-c{display:inline-block;opacity:0;transform:translateY(.55em) rotate(10deg) scale(.9);transform-origin:0 100%;transition:transform .9s var(--fxe),opacity .6s;transition-delay:calc(var(--i,0)*24ms)}",
    "html[data-textfx=letters] .fx-in .fx-c{opacity:1;transform:none}",
    "html[data-textfx=words] [data-fx-split] .fx-wi{display:inline-block;opacity:0;filter:blur(10px);transform:translateY(35%);transition:opacity .9s var(--fxe),filter .9s var(--fxe),transform .9s var(--fxe);transition-delay:calc(var(--k,0)*55ms)}",
    "html[data-textfx=words] .fx-in .fx-wi{opacity:1;filter:none;transform:none}",
    "html[data-textfx=words] .h-name .ln>span{animation:none!important}",
    "html[data-textfx=letters] .h-name .ln>span{animation:none!important}",
    ".fx-now,.fx-now *{transition:none!important}",
    /* hover */
    ".fx-card{transition:transform .5s var(--fxe),box-shadow .5s var(--fxe),border-color .3s}",
    "html:is([data-hoverfx=lift],[data-hoverfx=magnetic]) .fx-card:hover{transform:translateY(-6px)}",
    "html[data-hoverfx=tilt] .fx-tilt{transform-style:preserve-3d;transition:transform .6s var(--fxe)}",
    "html[data-hoverfx=shine] .fx-card:not(.cat):not(.contact-box){position:relative;overflow:hidden}",
    "html[data-hoverfx=shine] .fx-card:not(.cat):not(.contact-box)::after{content:'';position:absolute;inset:0;pointer-events:none;z-index:4;border-radius:inherit;background:linear-gradient(110deg,transparent 35%,rgba(255,255,255,.26) 50%,transparent 65%);transform:translateX(-130%)}",
    "html[data-hoverfx=shine] .fx-card:hover{transform:translateY(-4px)}",
    "html[data-hoverfx=shine] .fx-card:hover::after{transform:translateX(130%);transition:transform 1.05s var(--fxe)}",
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
  /** The intro panels with the site name in the middle (kind: split, or a single panel). */
  function panels(kind, brand) {
    var letters = String(brand || "").slice(0, 24).split("").map(function (ch, i) { return '<span style="--i:' + i + '">' + (ch === " " ? "&nbsp;" : escHtml(ch)) + "</span>"; }).join("");
    return (kind === "split" ? '<div class="fx-p fx-pt"></div><div class="fx-p fx-pb"></div>' : '<div class="fx-p"></div>') + (letters ? '<div class="fx-brand">' + letters + "</div>" : "");
  }
  try {
    var pend = sessionStorage.getItem("fx-exit");
    if (pend) {
      sessionStorage.removeItem("fx-exit");
      ensureStyle();
      var x = pend.charAt(0) === "{" ? JSON.parse(pend) : { bg: pend };
      var kind = x.kind === "split" ? "split" : "curtain";
      cover = el("div", "fx-load fx-cover fx-load--" + kind, panels(kind, ""));
      cover.style.setProperty("--fxd", x.bg || "#111"); cover.style.setProperty("--fxo", x.fg || "#fff");
      (document.body || doc).appendChild(cover); coverAt = Date.now();
      setTimeout(function () { if (cover) revealCover(); }, 4000);
    }
  } catch (e) {}
  // The page's <head> hid everything (in the panel colour) until this cover existed: no flash in between.
  var pre = document.getElementById("fx-pre"); if (pre) pre.remove();
  var coverAt = 0;
  function revealCover() {
    var c = cover; cover = null; if (!c) return;
    // Hold the name on screen for a moment even when the next page is ready at once.
    var wait = c.querySelector(".fx-brand") ? Math.max(0, 450 - (Date.now() - coverAt)) : 0;
    setTimeout(function () { requestAnimationFrame(function () { c.classList.add("out"); setTimeout(function () { c.remove(); }, 1000); }); }, wait);
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
    // The name is set like the site's own headline (Intro screen → font): same family, weight and style.
    var b = box.querySelector(".fx-brand");
    if (b) {
      var h = document.querySelector("main h1") || document.querySelector("h1");
      if (doc.getAttribute("data-introfont") === "body") { b.style.fontFamily = "var(--fb, inherit)"; b.style.fontWeight = "700"; }
      else if (h) { var cs = getComputedStyle(h); b.style.fontFamily = cs.fontFamily; b.style.fontWeight = cs.fontWeight; b.style.fontStyle = cs.fontStyle; }
      if (doc.getAttribute("data-introcase") === "asis") b.style.textTransform = "none";
    }
    document.body.appendChild(box);
    var hold = kind === "counter" ? 1200 : 1050, done = false, started = false;
    function out() { if (done) return; done = true; box.classList.add("out"); setTimeout(function () { box.remove(); }, 1100); }
    // Start once the font is ready (at most 800 ms), so the name never appears in a fallback font and then jumps.
    function start() {
      if (started) return; started = true;
      box.classList.add("ready");
      requestAnimationFrame(function () { box.classList.add("go"); });
      if (kind !== "counter") setTimeout(out, hold);
    }
    if (b && document.fonts && document.fonts.load) { whenFont(b, String(brand || ""), start); setTimeout(start, 1000); }
    else start();
    if (kind === "counter") {
      var n = box.querySelector(".fx-num"), bar = box.querySelector(".fx-bar"), s0 = performance.now();
      (function tick(now) {
        var p = Math.min(1, (now - s0) / hold), e = 1 - Math.pow(1 - p, 3);
        n.firstChild.nodeValue = String(Math.round(e * 100)); bar.style.transform = "scaleX(" + e + ")";
        if (p < 1) requestAnimationFrame(tick); else setTimeout(out, 120);
      })(s0);
    }
    setTimeout(out, 4300);
  }

  /** Calls back once el's font has loaded. Waits for the font's stylesheet to arrive first: until it does,
      document.fonts.load() resolves at once with nothing, and the text would show in a fallback font. */
  function whenFont(el, text, cb) {
    var cs = getComputedStyle(el), spec = cs.fontStyle + " " + cs.fontWeight + " 48px " + cs.fontFamily;
    var fam = cs.fontFamily.split(",")[0].replace(/["']/g, "").trim(), t0 = Date.now();
    (function poll() {
      var has = false;
      document.fonts.forEach(function (f) { if (f.family.replace(/["']/g, "") === fam) has = true; });
      if (has) { document.fonts.load(spec, text).then(function () { cb(); }, cb); return; }
      if (Date.now() - t0 > 900) return cb();
      setTimeout(poll, 40);
    })();
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
    var custom = FINE && !RM && (c.cursor === "dot" || c.cursor === "blend" || c.cursor === "ring");
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
  var sm = { target: 0, cur: 0, run: false, set: -1 };
  var EASE = { light: 0.2, medium: 0.12, heavy: 0.075 };
  function smoothOn() { var s = cfg().scroll; return FINE && !RM && (s === "smooth" || s === "skew"); }
  function scrollable(n) {
    for (; n && n !== document.body && n !== doc; n = n.parentElement) {
      var cs = getComputedStyle(n);
      if (/(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 1) return true;
    }
    return false;
  }
  // Trackpads send many small pixel steps (often fractional); easing those on top of their own momentum feels laggy.
  function trackpad(e) { return e.deltaMode === 0 && (Math.abs(e.deltaY) < 40 || e.deltaY % 1 !== 0); }
  function onWheel(e) {
    if (!smoothOn() || e.ctrlKey || e.defaultPrevented || Math.abs(e.deltaX) > Math.abs(e.deltaY) || scrollable(e.target)) return;
    if (trackpad(e)) { sm.run = false; return; }
    e.preventDefault();
    var max = doc.scrollHeight - innerHeight;
    if (!sm.run) sm.target = sm.cur = scrollY;
    sm.target = Math.max(0, Math.min(max, sm.target + e.deltaY * (e.deltaMode === 1 ? 36 : e.deltaMode === 2 ? innerHeight : 1)));
    if (!sm.run) { sm.run = true; requestAnimationFrame(smoothStep); }
  }
  function smoothStep() {
    if (!sm.run) return;
    // The visitor dragged the scrollbar, used the keyboard or followed a link: hand control back.
    if (sm.set >= 0 && Math.abs(scrollY - sm.set) > 2) { sm.run = false; sm.set = -1; return; }
    sm.cur += (sm.target - sm.cur) * (EASE[doc.getAttribute("data-scrollease")] || EASE.light);
    if (Math.abs(sm.target - sm.cur) < 0.5) { sm.cur = sm.target; sm.run = false; }
    // "instant": a site-wide scroll-behavior:smooth would otherwise animate every step and fight the easing.
    scrollTo({ top: sm.cur, behavior: "instant" }); sm.set = scrollY;
    if (sm.run) requestAnimationFrame(smoothStep); else sm.set = -1;
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
    var col = colors(), kind = c.loader === "split" ? "split" : "curtain", box = el("div", "fx-load fx-exit fx-load--" + kind, panels(kind, ""));
    box.style.setProperty("--fxd", col.deep); box.style.setProperty("--fxo", col.on);
    document.body.appendChild(box);
    try { sessionStorage.setItem("fx-exit", JSON.stringify({ bg: col.deep, fg: col.on, kind: kind, brand: st.brand })); } catch (x) {}
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
  /* "Powered by" badge. Its look comes from the Studio (window.SITE_BADGE, assets/badge.js); each site only
     says whether it shows (content.poweredBy.show === false hides it, set in the Studio). */
  var BADGE = { text: "Powered by Picaffectz", url: "https://iprakashlal.github.io/studio/#/themes", size: "m", bg: "#0E1118", fg: "#FFFFFF", icon: "mark" };
  var BSIZE = { s: [10, 4, 9, 11], m: [11, 5, 11, 14], l: [13, 7, 14, 18] }; // font, pad-y, pad-x, icon
  function badge(b) {
    b = b || {};
    var a = document.querySelector(".fx-badge");
    if (b.show === false) { if (a) a.remove(); return; }
    var g = {}, k, w = window.SITE_BADGE || {};
    for (k in BADGE) g[k] = BADGE[k];
    for (k in w) if (w[k] != null && w[k] !== "") g[k] = w[k];
    if (b.design) for (k in b.design) if (b.design[k] != null && b.design[k] !== "") g[k] = b.design[k]; // Studio preview
    var url = /^https?:\/\//i.test(String(g.url)) ? String(g.url) : BADGE.url, text = String(g.text || "").trim() || BADGE.text, z = BSIZE[g.size] || BSIZE.m;
    var hex = function (v, d) { return /^#[0-9a-f]{6}$/i.test(String(v || "")) ? v : d; };
    if (!a) { a = document.createElement("a"); a.className = "fx-badge"; a.target = "_blank"; a.rel = "noopener"; a.innerHTML = '<span class="fx-bm" aria-hidden="true"></span><span class="fx-bt"></span>'; document.body.appendChild(a); }
    a.href = url; a.setAttribute("aria-label", text); a.querySelector(".fx-bt").textContent = text;
    a.style.cssText = "font-size:" + z[0] + "px;padding:" + z[1] + "px " + (z[2] + 2) + "px " + z[1] + "px " + z[2] + "px;background:" + hex(g.bg, BADGE.bg) + ";color:" + hex(g.fg, BADGE.fg) + "!important;gap:" + Math.round(z[3] / 2) + "px";
    var m = a.querySelector(".fx-bm"), ic = g.icon === "custom" && /^data:image\/(png|jpeg|webp|svg\+xml);base64,/.test(g.iconData || "") ? "custom" : g.icon === "none" ? "none" : "mark";
    if (m.getAttribute("data-k") !== ic + (ic === "custom" ? g.iconData.length : "") + z[3]) {
      m.setAttribute("data-k", ic + (ic === "custom" ? g.iconData.length : "") + z[3]);
      m.style.display = ic === "none" ? "none" : "";
      if (ic === "custom") { m.innerHTML = ""; var im = document.createElement("img"); im.src = g.iconData; im.alt = ""; im.style.cssText = "display:block;width:" + z[3] + "px;height:" + z[3] + "px;border-radius:3px;object-fit:cover"; m.appendChild(im); }
      else if (ic === "mark") { m.innerHTML = ""; m.style.width = m.style.height = z[3] + "px"; }
      m.className = "fx-bm" + (ic === "mark" ? " m" : "");
    }
  }

  function init(opts) {
    opts = opts || {};
    var root = opts.root || document.body;
    ensureStyle(); wire();
    try { badge(opts.badge); } catch (e) {}
    var c = cfg(), sig = JSON.stringify(c), changed = sig !== st.sig;
    st.brand = opts.brand || st.brand || document.title;
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
    if (cover && c.loader !== "none" && !RM) {
      // Arriving from another page of the site: the panels are already closed, so play the site's full intro
      // (the name rises in letter by letter, then the panels open) exactly as on the first visit.
      var cv = cover; cover = null; st.loaderPlayed = true;
      playLoader(c.loader, opts.brand || document.title);
      requestAnimationFrame(function () { requestAnimationFrame(function () { cv.remove(); }); });
      delay = c.loader === "counter" ? 1250 : 950;
    }
    else if (cover) { st.loaderPlayed = true; revealCover(); delay = 350; }
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
