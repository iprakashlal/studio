/* Site FX: the interaction engine shared by every Site Studio template.
   Source of truth: src/fx/fx.js. `npm run sync:fx` copies it to each template's assets/ folder
   (it runs automatically before `dev` and `build`), so exported sites carry it as assets/fx.js.

   Each template sets these attributes on <html> from content.theme and calls SiteFX.init()
   after every render:
     data-cursor    none | dot | blend | spotlight | trail | ring | glow | cross | square
     data-loader    none | curtain | counter | split | wipe | iris | columns | fade | portal   (also animates page-to-page links)
     data-loader-on both | load | menu    where it plays: first page load and menu links, only the first page load, or only menu links
     data-textfx    none | lines | letters | scramble | words | flip | wave | wipe
     data-hoverfx   none | lift | magnetic | tilt | shine | spot | zoom | offset
     data-scrollfx  none | progress | smooth | skew | reveal | ring | dots
     data-scrollease light | medium | heavy  (how strongly smooth scrolling eases; mouse wheels only)
   Intro screen colours come from --intro-bg / --intro-fg (falling back to --deep / --on-deep).
     data-herofx    none | float | breathe | sway | follow | halo | orbit | ripple | sparkle | shine | morph   (a quiet loop on the hero's picture)
     data-overlay   none | grain | scanlines | vignette | paper | halftone | aurora | grid | frame
   Visitors who ask for reduced motion get a still page (only static overlays stay). */
(function () {
  "use strict";
  /* A text as the letters a reader sees: a consonant stays with its vowel signs and conjuncts (Hindi, Tamil, Bengali…),
     and an emoji with its parts, so letter-by-letter effects never tear a word apart. */
  var chars = window.SiteChars || (window.SiteChars = function (s) {
    s = String(s == null ? "" : s); var seg = null, out = [], mark = null, join = /[\u094D\u09CD\u0A4D\u0ACD\u0B4D\u0BCD\u0C4D\u0CCD\u0D4D\u200D]$/;
    try { if (window.Intl && Intl.Segmenter) seg = Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s), function (x) { return x.segment; }); } catch (e) {}
    if (!seg) seg = s.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[\s\S]/g) || [];
    try { mark = new RegExp("^[\\p{M}\\u200C\\u200D]", "u"); } catch (e) { mark = /^[\u0300-\u036F\u0900-\u0903\u093A-\u094F\u200C\u200D]/; }
    seg.forEach(function (g) { var n = out.length; if (n && (mark.test(g) || join.test(out[n - 1]))) out[n - 1] += g; else out.push(g); });
    return out;
  });
  if (window.SiteFX) return;

  var doc = document.documentElement;
  var RM = matchMedia("(prefers-reduced-motion: reduce)").matches || /[?&]lite=1\b/.test(location.search); /* lite=1: a phone showing a live preview asks for a still page, so it can hold it */
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
    return { cursor: d.cursor || "none", loader: d.loader || "none", text: d.textfx || "none", hover: d.hoverfx || "none", scroll: d.scrollfx || "none", overlay: d.overlay || "none", herofx: d.herofx || "none", loaderOn: d.loaderOn || "both" };
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
    "html[data-overlay=aurora] .fx-ov{inset:-20%;background:radial-gradient(38% 42% at 22% 28%,color-mix(in srgb,var(--fxa) 46%,transparent),transparent 70%),radial-gradient(34% 40% at 78% 22%,color-mix(in srgb,var(--c2,var(--fxa)) 40%,transparent),transparent 70%),radial-gradient(44% 46% at 60% 82%,color-mix(in srgb,var(--fxa) 30%,transparent),transparent 72%);filter:blur(60px);opacity:.34;mix-blend-mode:multiply;animation:fxaurora 22s ease-in-out infinite alternate}",
    "html.fx-dark[data-overlay=aurora] .fx-ov{mix-blend-mode:screen;opacity:.3}",
    "html[data-overlay=grid] .fx-ov{background-image:linear-gradient(color-mix(in srgb,var(--fxi) 9%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--fxi) 9%,transparent) 1px,transparent 1px);background-size:56px 56px;background-position:center top;-webkit-mask-image:radial-gradient(ellipse at 50% 40%,#000 20%,transparent 78%);mask-image:radial-gradient(ellipse at 50% 40%,#000 20%,transparent 78%)}",
    "html[data-overlay=frame] .fx-ov{inset:clamp(8px,1.2vw,16px);border:1px solid color-mix(in srgb,var(--fxi) 38%,transparent);border-radius:clamp(10px,1.6vw,22px)}",
    "@keyframes fxaurora{0%{transform:translate3d(-4%,-3%,0) rotate(0deg) scale(1)}50%{transform:translate3d(5%,4%,0) rotate(8deg) scale(1.12)}100%{transform:translate3d(-3%,6%,0) rotate(-6deg) scale(1.05)}}",
    "@keyframes fxgrain{0%{transform:translate(0,0)}20%{transform:translate(-6%,4%)}40%{transform:translate(5%,-3%)}60%{transform:translate(-3%,-6%)}80%{transform:translate(6%,5%)}100%{transform:translate(0,0)}}",
    /* cursor */
    "html.fx-nocur,html.fx-nocur *{cursor:none!important}",
    "html.fx-nocur :is(input,textarea,[contenteditable=true]){cursor:text!important}",
    ".fx-dot,.fx-ring{position:fixed;left:0;top:0;pointer-events:none;z-index:2147483647;opacity:0;transition:opacity .3s;will-change:transform}",
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
    "html[data-cursor=square] .fx-dot i{width:5px;height:5px;border-radius:1px}",
    "html[data-cursor=square] .fx-ring i{width:34px;height:34px;border-radius:9px;border:1.5px solid var(--fxa);transition:transform .5s var(--fxe),background .3s,border-radius .4s var(--fxe)}",
    "html[data-cursor=square] .fx-ring.is-link i{transform:translate(-50%,-50%) rotate(45deg) scale(1.25);background:color-mix(in srgb,var(--fxa) 18%,transparent)}",
    "html[data-cursor=square] .fx-ring.is-card i{transform:translate(-50%,-50%) scale(2.5);border-radius:16px;background:var(--fxa)}",
    ".fx-glow{position:fixed;left:0;top:0;width:260px;height:260px;margin:-130px 0 0 -130px;border-radius:50%;pointer-events:none;z-index:99960;opacity:0;transition:opacity .5s;background:radial-gradient(circle,color-mix(in srgb,var(--fxa) 55%,transparent),transparent 68%);filter:blur(28px);mix-blend-mode:multiply;will-change:transform}",
    "html.fx-dark .fx-glow{mix-blend-mode:screen}html.fx-seen .fx-glow{opacity:.75}",
    ".fx-cross{position:fixed;inset:0;pointer-events:none;z-index:99960;opacity:0;transition:opacity .4s}html.fx-seen .fx-cross{opacity:1}",
    ".fx-cross i{position:absolute;background:color-mix(in srgb,var(--fxi) 22%,transparent)}.fx-cross i:first-child{left:0;right:0;top:var(--my,50%);height:1px}.fx-cross i:nth-child(2){top:0;bottom:0;left:var(--mx,50%);width:1px}",
    ".fx-cross b{position:absolute;left:var(--mx,50%);top:var(--my,50%);margin:12px 0 0 12px;font:600 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.06em;color:color-mix(in srgb,var(--fxi) 60%,transparent);white-space:nowrap}",
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
    ".fx-load--columns .fx-p{top:0;bottom:0;right:auto;width:20.3%;left:calc(var(--n)*20%);transition:transform .9s var(--fxe);transition-delay:calc(var(--n)*70ms)}",
    ".fx-load--columns.out .fx-p{transform:translateY(-101%)}",
    ".fx-load--columns.out .fx-p:nth-child(even){transform:translateY(101%)}",
    ".fx-load--fade .fx-p{top:0;bottom:0;transition:opacity .9s ease}.fx-load--fade.out .fx-p{opacity:0}",
    ".fx-load--fade .fx-brand{transition:opacity .5s,transform 1.4s var(--fxe),letter-spacing 1.2s var(--fxe)}.fx-load--fade.out .fx-brand{transform:translate(-50%,-50%) scale(1.25)}",
    "@property --fxr{syntax:'<length-percentage>';inherits:false;initial-value:0%}",
    ".fx-load--portal .fx-p{top:0;bottom:0;--fxr:0%;-webkit-mask-image:radial-gradient(circle at 50% 50%,transparent var(--fxr),#000 calc(var(--fxr) + 1px));mask-image:radial-gradient(circle at 50% 50%,transparent var(--fxr),#000 calc(var(--fxr) + 1px));transition:--fxr 1.1s var(--fxe),opacity .2s 1s}",
    ".fx-load--portal.out .fx-p{--fxr:120%;opacity:0}",
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
    "html[data-textfx=flip] [data-fx-split] .fx-w{perspective:600px}",
    "html[data-textfx=flip] [data-fx-split] .fx-wi{display:inline-block;opacity:0;transform:rotateX(-88deg) translateY(.2em);transform-origin:50% 100%;transition:transform 1s var(--fxe),opacity .5s;transition-delay:calc(var(--k,0)*70ms)}",
    "html[data-textfx=flip] .fx-in .fx-wi{opacity:1;transform:none}",
    "html[data-textfx=wave] [data-fx-split] .fx-c{display:inline-block;opacity:0;transform:translateY(.9em) scale(.6);transition:transform .8s cubic-bezier(.2,1.7,.35,1),opacity .35s;transition-delay:calc(var(--i,0)*32ms)}",
    "html[data-textfx=wave] .fx-in .fx-c{opacity:1;transform:none}",
    "html[data-textfx=wipe] [data-fx-split] .fx-wi{display:inline-block;clip-path:inset(-10% 100% -15% 0);transform:translateX(-.18em);transition:clip-path 1s var(--fxe),transform 1s var(--fxe);transition-delay:calc(var(--k,0)*80ms)}",
    "html[data-textfx=wipe] .fx-in .fx-wi{clip-path:inset(-10% -5% -15% 0);transform:none}",
    "html:is([data-textfx=flip],[data-textfx=wave],[data-textfx=wipe]) .h-name .ln>span{animation:none!important}",
    ".fx-now,.fx-now *{transition:none!important}",
    /* hover */
    ".fx-card{transition:transform .5s var(--fxe),box-shadow .5s var(--fxe),border-color .3s}",
    "html:is([data-hoverfx=lift],[data-hoverfx=magnetic]) .fx-card:hover{transform:translateY(-6px)}",
    "html[data-hoverfx=tilt] .fx-tilt{transform-style:preserve-3d;transition:transform .6s var(--fxe)}",
    "html[data-hoverfx=shine] .fx-card:not(.cat):not(.contact-box){position:relative;overflow:hidden}",
    "html[data-hoverfx=shine] .fx-card:not(.cat):not(.contact-box)::after{content:'';position:absolute;inset:0;pointer-events:none;z-index:4;border-radius:inherit;background:linear-gradient(110deg,transparent 35%,rgba(255,255,255,.26) 50%,transparent 65%);transform:translateX(-130%)}",
    "html[data-hoverfx=shine] .fx-card:hover{transform:translateY(-4px)}",
    "html[data-hoverfx=shine] .fx-card:hover::after{transform:translateX(130%);transition:transform 1.05s var(--fxe)}",
    "html[data-hoverfx=spot] .fx-card:hover{translate:0 -3px;border-color:color-mix(in srgb,var(--fxa) 55%,transparent)}",
    "html[data-hoverfx=spot] .fx-card>.fx-glare{background:radial-gradient(340px circle at var(--gx,50%) var(--gy,50%),color-mix(in srgb,var(--fxa) 30%,transparent),transparent 60%);mix-blend-mode:normal}",
    "html[data-hoverfx=spot] .fx-card:hover>.fx-glare{opacity:1}",
    "html[data-hoverfx=zoom] .fx-card :is(img,video){transition:transform .9s var(--fxe),filter .6s}",
    "html[data-hoverfx=zoom] .fx-card :has(>:is(img,video)){overflow:hidden}",
    "html[data-hoverfx=zoom] .fx-card:hover :is(img,video){transform:scale(1.07)}",
    "html[data-hoverfx=zoom] .fx-card:hover{translate:0 -3px}",
    "html:is([data-hoverfx=offset],[data-hoverfx=spot],[data-hoverfx=zoom]) .fx-card{transition:transform .5s var(--fxe),translate .3s var(--fxe),box-shadow .3s var(--fxe),border-color .3s}",
    "html[data-hoverfx=offset] .fx-card:hover{translate:-4px -4px;box-shadow:6px 6px 0 var(--fxa)!important;border-color:var(--fxi)}",
    ".fx-glare{position:absolute;inset:0;border-radius:inherit;pointer-events:none;opacity:0;transition:opacity .4s;background:radial-gradient(420px circle at var(--gx,50%) var(--gy,50%),rgba(255,255,255,.28),transparent 45%);mix-blend-mode:overlay;z-index:3}",
    ".fx-tilt:hover>.fx-glare{opacity:1}",
    /* scroll */
    ".fx-prog{position:fixed;left:0;top:0;height:3px;width:100%;z-index:99980;background:var(--fxa);transform-origin:0 50%;transform:scaleX(0);pointer-events:none}",
    /* Hero graphic effect: loops on the hero's picture. They use translate / rotate / scale (not transform), so they add to
       whatever the theme's frame or entrance already does. */
    "html[data-herofx=float] .fx-hg:not(.fx-hg-bg){animation:fxhgfloat 7s ease-in-out infinite alternate}",
    "html[data-herofx=sway] .fx-hg:not(.fx-hg-bg){animation:fxhgsway 9s ease-in-out infinite alternate;transform-origin:50% 100%}",
    "html[data-herofx=breathe] .fx-hg.fx-hg-pic :is(img,video){animation:fxhgbreathe 18s ease-in-out infinite alternate;will-change:scale}",
    "html[data-herofx=breathe] .fx-hg:not(.fx-hg-pic):not(.fx-hg-bg){animation:fxhgbreathe2 9s ease-in-out infinite alternate}",
    "html[data-herofx=breathe] .fx-hg.fx-hg-bg:not(.fx-hg-pic){animation:fxhgbreathe 18s ease-in-out infinite alternate}",
    ".fx-hg-clip{overflow-x:clip}.fx-hg-clip:has(>.fx-hg-bg){overflow:clip}",
    "html[data-herofx=follow] .fx-hg:not(.fx-hg-bg){translate:calc(var(--hx,0)*14px) calc(var(--hy,0)*14px);rotate:calc(var(--hx,0)*1.2deg);transition:translate .9s var(--fxe),rotate .9s var(--fxe)}",
    "html[data-herofx=follow] .fx-hg.fx-hg-pic :is(img,video){scale:1.06;translate:calc(var(--hx,0)*-10px) calc(var(--hy,0)*-10px);transition:translate 1.2s var(--fxe)}",
    "html[data-herofx=halo] .fx-hg:not(.fx-hg-bg){animation:fxhghalo 5.5s ease-in-out infinite alternate}",
    "html[data-herofx=morph] .fx-hg:not(.fx-hg-bg):not(.fx-hg-cut){animation:fxhgmorph 14s ease-in-out infinite;overflow:hidden}",
    ".fx-hg-shine{position:absolute;inset:0;z-index:3;pointer-events:none;overflow:hidden;border-radius:inherit}",
    ".fx-hg-shine::before{content:\"\";position:absolute;top:-20%;bottom:-20%;left:0;width:34%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.34) 45%,rgba(255,255,255,.5) 50%,rgba(255,255,255,.34) 55%,transparent);transform:translateX(-140%) skewX(-14deg);animation:fxhgshine 6.5s cubic-bezier(.4,0,.2,1) infinite;mix-blend-mode:soft-light}",
    ".fx-hg-deco{position:absolute;pointer-events:none;z-index:0}.fx-hg-deco.top{z-index:4}",
    ".fx-hg-deco svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}",
    ".fx-hg-deco .o1{animation:fxhgspin 38s linear infinite;transform-origin:50% 50%;transform-box:fill-box}.fx-hg-deco .o2{animation:fxhgspin 54s linear infinite reverse;transform-origin:50% 50%;transform-box:fill-box}",
    ".fx-hg-deco .rp{position:absolute;inset:6%;border-radius:var(--hgr,28px);border:1.5px solid var(--fxa);opacity:0;animation:fxhgripple 5.4s cubic-bezier(.2,.6,.3,1) infinite;animation-delay:calc(var(--n)*1.8s)}",
    ".fx-hg-deco .sp{position:absolute;left:var(--x);top:var(--y);width:var(--s);height:var(--s);color:var(--c);opacity:0;animation:fxhgspark var(--d) ease-in-out infinite;animation-delay:var(--w)}",
    ".fx-hg-deco .sp::before,.fx-hg-deco .sp::after{content:\"\";position:absolute;background:currentColor;border-radius:2px}",
    ".fx-hg-deco .sp::before{left:42%;right:42%;top:0;bottom:0}.fx-hg-deco .sp::after{top:42%;bottom:42%;left:0;right:0}.fx-hg-deco .sp.dot::before{inset:25%;border-radius:50%}.fx-hg-deco .sp.dot::after{display:none}",
    "@keyframes fxhgfloat{from{translate:0 -9px}to{translate:0 9px}}",
    "@keyframes fxhgsway{from{rotate:-1.3deg;translate:-5px 0}to{rotate:1.3deg;translate:5px 0}}",
    "@keyframes fxhgbreathe{from{scale:1.001;translate:0 0}to{scale:1.085;translate:-1.2% -1%}}",
    "@keyframes fxhgbreathe2{from{scale:.985}to{scale:1.02}}",
    "@keyframes fxhghalo{from{filter:drop-shadow(0 10px 22px color-mix(in srgb,var(--fxa) 10%,transparent))}to{filter:drop-shadow(0 16px 46px color-mix(in srgb,var(--fxa) 62%,transparent))}}",
    "@keyframes fxhgmorph{0%,100%{border-radius:58% 42% 47% 53%/45% 55% 45% 55%}33%{border-radius:44% 56% 60% 40%/56% 42% 58% 44%}66%{border-radius:52% 48% 40% 60%/40% 58% 42% 60%}}",
    "@keyframes fxhgshine{0%,58%{transform:translateX(-140%) skewX(-14deg)}100%{transform:translateX(440%) skewX(-14deg)}}",
    "@keyframes fxhgspin{to{rotate:360deg}}",
    "@keyframes fxhgripple{0%{opacity:0;scale:.92}18%{opacity:.5}100%{opacity:0;scale:1.22}}",
    "@keyframes fxhgspark{0%,100%{opacity:0;translate:0 8px;scale:.5;rotate:0deg}45%{opacity:.9;scale:1}60%{opacity:.75;translate:0 -10px;rotate:45deg}}",
    "@media (prefers-reduced-motion:reduce){.fx-hg,.fx-hg *{animation:none!important}.fx-hg-deco,.fx-hg-shine{display:none}}@media print{.fx-hg-deco,.fx-hg-shine{display:none}}",
    ".fx-rv{opacity:0;transform:translateY(34px);transition:opacity .9s var(--fxe),transform 1s var(--fxe)}.fx-rv.fx-rv-in{opacity:1;transform:none}",
    ".fx-top{position:fixed;left:max(14px,env(safe-area-inset-left,0px));bottom:max(14px,env(safe-area-inset-bottom,0px));z-index:99979;width:46px;height:46px;border:0;border-radius:50%;padding:0;cursor:pointer;background:color-mix(in srgb,var(--surface,var(--bg,#fff)) 92%,transparent);color:var(--fxi);box-shadow:0 8px 24px -10px rgba(0,0,0,.45);opacity:0;transform:translateY(10px) scale(.9);pointer-events:none;transition:opacity .35s,transform .45s var(--fxe)}",
    ".fx-top.on{opacity:1;transform:none;pointer-events:auto}.fx-top svg{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg)}",
    ".fx-top circle{fill:none;stroke-width:2.5}.fx-top circle:first-child{stroke:color-mix(in srgb,var(--fxi) 14%,transparent)}.fx-top circle:last-child{stroke:var(--fxa);stroke-linecap:round;stroke-dasharray:125.7;stroke-dashoffset:125.7}",
    ".fx-top span{position:relative;font:700 15px/1 system-ui,sans-serif}",
    ".fx-dots{position:fixed;right:max(10px,env(safe-area-inset-right,0px));top:50%;transform:translateY(-50%);z-index:99979;display:flex;flex-direction:column;gap:4px}",
    ".fx-dots button{width:22px;height:18px;border:0;padding:0;background:transparent;cursor:pointer;display:grid;place-items:center}",
    ".fx-dots button i{width:6px;height:6px;border-radius:99px;background:color-mix(in srgb,var(--fxi) 34%,transparent);transition:height .4s var(--fxe),background .3s}",
    ".fx-dots button:hover i{background:var(--fxi)}.fx-dots button.on i{height:18px;background:var(--fxa)}",
    "@media (max-width:760px){.fx-dots{display:none}}@media print{.fx-top,.fx-dots,.fx-ov,.fx-glow,.fx-cross{display:none}}",
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
    var letters = chars(String(brand || "")).slice(0, 24).map(function (ch, i) { return '<span style="--i:' + i + '">' + (ch === " " ? "&nbsp;" : escHtml(ch)) + "</span>"; }).join("");
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
  // The page's <head> may also have painted the intro's colour for a site with an intro (id fx-boot): it goes as soon as
  // the intro's panel is up, or the page starts, and in any case shortly after this script has loaded.
  function unboot() { var bt = document.getElementById("fx-boot"); if (bt) bt.remove(); }
  setTimeout(unboot, 1500);
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
  // "Page load only": the intro plays on the first page of a visit and not again on pages reached through the menu;
  // "Menu links only": no intro on a page load at all (the page-to-page cover still plays).
  function skipIntro(c) {
    if (c.loaderOn === "menu") return true;
    if (c.loaderOn === "load" && !PREVIEW) { try { return sessionStorage.getItem("fx-intro-seen") === "1"; } catch (x) {} }
    return false;
  }
  function playLoader(kind, brand) {
    var c = colors();
    var letters = chars(String(brand || "")).slice(0, 24).map(function (ch, i) { return '<span style="--i:' + i + '">' + (ch === " " ? "&nbsp;" : escHtml(ch)) + "</span>"; }).join("");
    var html = kind === "split" ? '<div class="fx-p fx-pt"></div><div class="fx-p fx-pb"></div>' : kind === "columns" ? [0, 1, 2, 3, 4].map(function (n) { return '<div class="fx-p" style="--n:' + n + '"></div>'; }).join("") : '<div class="fx-p"></div>';
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
    function out() { if (done) return; done = true; box.classList.add("out"); setTimeout(function () { box.remove(); }, kind === "columns" ? 1400 : 1100); }
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
          chars(p).forEach(function (ch) { var c = el("span", "fx-c"); c.textContent = ch; c.style.setProperty("--i", Math.min(ci++, 45)); w.appendChild(c); });
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
    if (node.__fxs) return;
    // Scrambling swaps single code units, which would tear vowel signs off their letters: only for plain alphabets.
    try { if (new RegExp("\\p{M}", "u").test(node.textContent || "")) return; } catch (e) {}
    node.__fxs = true;
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
    if (c.text !== "scramble") targets.forEach(function (n) { splitText(n, c.text === "wave" ? "letters" : c.text); });
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
    var custom = FINE && !RM && (c.cursor === "dot" || c.cursor === "blend" || c.cursor === "ring" || c.cursor === "square");
    doc.classList.toggle("fx-nocur", custom);
    layer("dot", custom, function () { return el("div", "fx-dot", "<i></i>"); });
    layer("ring", custom, function () { return el("div", "fx-ring", "<i></i><b>View</b>"); });
    layer("spot", FINE && !RM && c.cursor === "spotlight", function () { return el("div", "fx-spot"); });
    layer("glow", FINE && !RM && c.cursor === "glow", function () { return el("div", "fx-glow"); });
    layer("cross", FINE && !RM && c.cursor === "cross", function () { return el("div", "fx-cross", "<i></i><i></i><b></b>"); });
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
    if (L.glow) { st.gx = (st.gx == null ? st.x : st.gx) + (st.x - (st.gx == null ? st.x : st.gx)) * 0.09; st.gy = (st.gy == null ? st.y : st.gy) + (st.y - (st.gy == null ? st.y : st.gy)) * 0.09; L.glow.style.transform = "translate3d(" + st.gx + "px," + st.gy + "px,0)"; }
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
    if (st.hg && cfg().herofx === "follow") { var hr = st.hg.getBoundingClientRect(); if (hr.bottom > 0 && hr.top < innerHeight) { st.hg.style.setProperty("--hx", ((e.clientX - (hr.left + hr.width / 2)) / innerWidth * 2).toFixed(3)); st.hg.style.setProperty("--hy", ((e.clientY - (hr.top + hr.height / 2)) / innerHeight * 2).toFixed(3)); } }
    if (L.cross) { L.cross.style.setProperty("--mx", e.clientX + "px"); L.cross.style.setProperty("--my", e.clientY + "px"); L.cross.lastChild.textContent = Math.round(e.clientX) + " · " + Math.round(e.clientY); }
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
    if (c.hover === "spot") {
      var sc = t && t.closest(".fx-card");
      if (sc) {
        if (!sc.__fxg) { sc.__fxg = true; if (getComputedStyle(sc).position === "static") sc.style.position = "relative"; sc.appendChild(el("i", "fx-glare")); }
        var sr = sc.getBoundingClientRect(); sc.style.setProperty("--gx", (e.clientX - sr.left).toFixed(0) + "px"); sc.style.setProperty("--gy", (e.clientY - sr.top).toFixed(0) + "px");
      }
    }
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
  /* Hero graphic effect: finds the hero's picture or graphic, marks it, and adds the few extra pieces some effects need
     (a light band inside it, or rings / ripples / sparkles laid around it). */
  var HERO_G = ".hero .hero-bg, .hero .hero-media, .hero .art, .pf-hero .im, .hero .stage-wrap, #hero .stage-wrap";
  function setupHeroFx(root, c) {
    $$(".fx-hg").forEach(function (n) { n.classList.remove("fx-hg", "fx-hg-pic", "fx-hg-bg", "fx-hg-cut"); n.style.removeProperty("--hx"); n.style.removeProperty("--hy"); });
    $$(".fx-hg-deco,.fx-hg-shine").forEach(function (n) { n.remove(); }); $$(".fx-hg-clip").forEach(function (n) { n.classList.remove("fx-hg-clip"); });
    if (st.hgRO) { st.hgRO.disconnect(); st.hgRO = null; } st.hg = null;
    if (c.herofx === "none" || RM) return;
    var g = $$(HERO_G, root).filter(function (n) { return n.offsetWidth > 60 && n.offsetHeight > 60; })[0]; if (!g) return;
    var cs = getComputedStyle(g), r = g.getBoundingClientRect();
    // A picture that is the hero's whole background stays put: only what happens inside it applies.
    var bg = cs.position === "absolute" || cs.position === "fixed" || r.width >= innerWidth * 0.9;
    g.classList.add("fx-hg"); if (bg) g.classList.add("fx-hg-bg"); if (cs.clipPath && cs.clipPath !== "none") g.classList.add("fx-hg-cut");
    if (g.querySelector(":scope > img, :scope > video, :scope > picture > img")) g.classList.add("fx-hg-pic");
    st.hg = g;
    // What the effect draws beyond the picture's edge never widens the page.
    var sec = g.closest(".hero,#hero,section"); if (sec) sec.classList.add("fx-hg-clip");
    if (c.herofx === "shine") { if (cs.position === "static") g.style.position = "relative"; g.appendChild(el("i", "fx-hg-shine")); }
    if (bg || ["orbit", "ripple", "sparkle"].indexOf(c.herofx) < 0) return;
    var host = g.parentElement; if (!host) return;
    if (getComputedStyle(host).position === "static") host.style.position = "relative";
    if (cs.position === "static") g.style.position = "relative"; if (cs.zIndex === "auto") g.style.zIndex = "1";
    var html = "";
    if (c.herofx === "orbit") html = '<svg viewBox="0 0 200 200" aria-hidden="true"><g class="o1"><circle cx="100" cy="100" r="96" fill="none" stroke="var(--fxa)" stroke-width=".7" stroke-dasharray="1.5 7" stroke-linecap="round" opacity=".7"/><circle cx="100" cy="4" r="3.2" fill="var(--fxa)"/></g><g class="o2"><circle cx="100" cy="100" r="86" fill="none" stroke="var(--c2,var(--fxa))" stroke-width=".6" opacity=".4"/><circle cx="186" cy="100" r="2.4" fill="var(--c2,var(--fxa))"/><circle cx="14" cy="100" r="1.6" fill="var(--c3,var(--fxa))"/></g></svg>';
    if (c.herofx === "ripple") html = '<span class="rp" style="--n:0"></span><span class="rp" style="--n:1"></span><span class="rp" style="--n:2"></span>';
    if (c.herofx === "sparkle") { var cols = ["var(--fxa)", "var(--c2,var(--fxa))", "var(--c3,var(--fxa))"], pts = [[4, 12], [92, 6], [98, 46], [88, 90], [10, 86], [-2, 52], [50, -3], [34, 98], [72, 99], [18, 30], [80, 24]];
      html = pts.map(function (p, i) { return '<i class="sp' + (i % 3 === 1 ? " dot" : "") + '" style="--x:' + p[0] + "%;--y:" + p[1] + "%;--s:" + (10 + (i * 7) % 12) + "px;--c:" + cols[i % 3] + ";--d:" + (4.2 + (i % 4) * 0.9) + "s;--w:" + (-(i * 0.83)).toFixed(2) + 's"></i>'; }).join(""); }
    var deco = el("div", "fx-hg-deco" + (c.herofx === "sparkle" ? " top" : ""), html); deco.setAttribute("aria-hidden", "true"); host.appendChild(deco);
    var grow = c.herofx === "orbit" ? 0.13 : c.herofx === "ripple" ? 0.06 : 0.05;
    function place() { var w = g.offsetWidth, h = g.offsetHeight, d = c.herofx === "orbit" ? Math.min(Math.max(w, h) * (1 + grow * 2), Math.min(w, h) * 1.5) : 0;
      if (c.herofx === "orbit") { deco.style.width = deco.style.height = d + "px"; deco.style.left = g.offsetLeft + w / 2 - d / 2 + "px"; deco.style.top = g.offsetTop + h / 2 - d / 2 + "px"; }
      else { deco.style.left = g.offsetLeft - w * grow + "px"; deco.style.top = g.offsetTop - h * grow + "px"; deco.style.width = w * (1 + grow * 2) + "px"; deco.style.height = h * (1 + grow * 2) + "px"; }
      deco.style.setProperty("--hgr", getComputedStyle(g).borderTopLeftRadius || "28px"); }
    place(); if ("ResizeObserver" in window) { st.hgRO = new ResizeObserver(place); st.hgRO.observe(g); st.hgRO.observe(host); }
  }
  /** The page's sections, for "reveal" and the side dots: the direct children of <main> that take real room. */
  function sections(root) { return $$("main > *", root).filter(function (n) { return n.offsetHeight > 120 && getComputedStyle(n).position !== "fixed"; }); }
  function setupScrollExtras(root, c) {
    // reveal: each section fades up as it comes into view (what is already on screen stays as it is)
    if (st.rio) { st.rio.disconnect(); st.rio = null; }
    $$(".fx-rv", root).forEach(function (n) { if (c.scroll !== "reveal") n.classList.remove("fx-rv", "fx-rv-in"); });
    if (c.scroll === "reveal" && !RM && "IntersectionObserver" in window) {
      st.rio = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("fx-rv-in"); st.rio.unobserve(e.target); } }); }, { threshold: 0.08, rootMargin: "0px 0px -8% 0px" });
      sections(root).forEach(function (n) { if (n.classList.contains("fx-rv")) return; if (n.getBoundingClientRect().top < innerHeight * 0.92) return; n.classList.add("fx-rv"); st.rio.observe(n); });
    }
    // ring: how far down the page, as a ring around a "back to top" button
    var top = layer("top", c.scroll === "ring", function () { var b = el("button", "fx-top", '<svg viewBox="0 0 46 46" aria-hidden="true"><circle cx="23" cy="23" r="20"/><circle cx="23" cy="23" r="20"/></svg><span aria-hidden="true">↑</span>'); b.type = "button"; b.setAttribute("aria-label", "Back to the top"); b.addEventListener("click", function () { scrollTo({ top: 0, behavior: RM ? "auto" : "smooth" }); }); return b; });
    if (top) top.setAttribute("data-fx-skip", "");
    // dots: one per section down the side; the one in view is marked
    if (L.dots) { L.dots.remove(); L.dots = null; } st.dotEls = [];
    if (c.scroll === "dots") {
      var secs = sections(root).slice(0, 14);
      if (secs.length > 1) {
        var nav = el("nav", "fx-dots"); nav.setAttribute("aria-label", "Sections of this page");
        secs.forEach(function (sec, i) { var h = sec.querySelector("h1,h2,h3"), name = (h && h.textContent.replace(/\s+/g, " ").trim().slice(0, 60)) || "Section " + (i + 1); var b = el("button", "", "<i></i>"); b.type = "button"; b.title = name; b.setAttribute("aria-label", "Go to: " + name); b.addEventListener("click", function () { scrollTo({ top: sec.getBoundingClientRect().top + scrollY - 70, behavior: RM ? "auto" : "smooth" }); }); nav.appendChild(b); });
        document.body.appendChild(nav); L.dots = nav; st.dotEls = secs;
      }
    }
  }
  function onScroll() {
    if (L.top) { var mx = doc.scrollHeight - innerHeight, pr = mx > 0 ? Math.min(1, scrollY / mx) : 0; L.top.classList.toggle("on", scrollY > 240); L.top.querySelector("circle:last-child").style.strokeDashoffset = (125.7 * (1 - pr)).toFixed(1); }
    if (L.dots && st.dotEls) { var mid = innerHeight * 0.4, at = 0; st.dotEls.forEach(function (n, i) { if (n.getBoundingClientRect().top <= mid) at = i; }); for (var di = 0; di < L.dots.children.length; di++) L.dots.children[di].classList.toggle("on", di === at); }
    if (L.prog) { var max = doc.scrollHeight - innerHeight; L.prog.style.transform = "scaleX(" + (max > 0 ? Math.min(1, scrollY / max) : 0) + ")"; }
    if (st.skewEls.length && !RM && !sk.run) { sk.run = true; sk.last = scrollY - 1; requestAnimationFrame(skewStep); }
  }

  /* ---------------------------------------------------------------- page links */
  function onClick(e) {
    var c = cfg();
    if (c.loader === "none" || c.loaderOn === "load" || RM || PREVIEW || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
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
  /* A menu link to a section of the same page glides there. The route is made quiet first: sections passed on the way are already settled (they used to fade in half-way as the scroll went by and looked like a cancelled transition), and the target is measured again on every step, so a layout shift on the way (an image, the locations slider) can no longer make the glide end in the wrong place and snap. The section itself fades in where you land. */
  var glide = { id: 0 };
  function onJump(e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || PREVIEW) return;
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a || a.target && a.target !== "_self" || a.hasAttribute("download") || a.hasAttribute("data-fx-skip")) return;
    var u; try { u = new URL(a.href, location.href); } catch (x) { return; }
    if (u.origin !== location.origin || u.pathname !== location.pathname || u.search !== location.search || !u.hash || u.hash.length < 2) return;
    var t; try { t = document.getElementById(decodeURIComponent(u.hash.slice(1))); } catch (x) { return; }
    if (!t) return;
    e.preventDefault();
    var gap = function () { var a = parseFloat(getComputedStyle(t).scrollMarginTop) || 0, b = parseFloat(getComputedStyle(doc).scrollPaddingTop) || 0; return a + b; };
    var spot = function () { return Math.max(0, Math.min(doc.scrollHeight - innerHeight, scrollY + t.getBoundingClientRect().top - gap())); };
    if (!RM) $$(".rv:not(.in)").forEach(function (n) { if (!t.contains(n)) { n.style.transition = "none"; n.classList.add("in"); } });
    if (location.hash !== u.hash) { try { history.pushState(null, "", u.hash); dispatchEvent(new HashChangeEvent("hashchange")); } catch (x) { /* the address stays as it was */ } }
    var id = ++glide.id, from = scrollY, t0 = performance.now(), dist = Math.abs(spot() - from), dur = RM ? 0 : Math.max(450, Math.min(1100, 380 + dist * 0.18));
    var root = doc, was = root.style.scrollBehavior; root.style.scrollBehavior = "auto"; sm.run = false; sm.set = -1;
    var done = function () { root.style.scrollBehavior = was; sm.cur = sm.target = scrollY; sm.set = -1; };
    var cancel = function () { glide.id++; };
    addEventListener("wheel", cancel, { once: true, passive: true }); addEventListener("touchstart", cancel, { once: true, passive: true });
    (function step(now) {
      if (id !== glide.id) { done(); return; }
      var k = dur ? Math.min(1, (now - t0) / dur) : 1, ease = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      scrollTo(0, from + (spot() - from) * ease);
      if (k < 1) requestAnimationFrame(step); else { scrollTo(0, spot()); done(); }
    })(t0);
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
    document.addEventListener("click", onJump);
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

  // ---- A section's own background (content.sectionBg[key] = { on, kind, color, image, video, dim, text }): a colour, a
  // picture or GIF, or a silent looping video, laid behind the section's content whatever the theme.
  // A link given for a section's background video: a YouTube or Vimeo address (shown as a silent background player) or a video file's address.
  function vlink(u) { u = String(u || "").trim(); if (!u) return ""; if (/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/i.test(u) || /vimeo\.com\/(?:video\/)?(\d{6,12})/i.test(u) || /^https:\/\//i.test(u) || !/^[a-z][a-z0-9+.-]*:/i.test(u)) return u; return ""; }
  var SBG_CSS = ".has-sbg{isolation:isolate}.has-sbg[data-sbg-c]{background:var(--sbg)!important}" +
    ".sbg img,.sbg video{object-position:var(--sbp,50% 50%)}.sbg-still{position:absolute;left:0;top:0;width:100%;will-change:transform}.sbg-still>i{position:absolute;inset:0}" +
    ".fx-sbg-hide{display:none!important}.has-sbg[data-sbg-nobefore]::before,.has-sbg[data-sbg-noafter]::after{display:none!important}" +
    ".sbg{position:absolute;inset:0;z-index:-1;overflow:hidden;pointer-events:none;border-radius:inherit}" +
    ".sbg img,.sbg video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}.sbg i{position:absolute;inset:0}" +
    // a YouTube or Vimeo player is cropped to fill the section like a picture
    ".sbg[data-embed]{container-type:size}.sbg iframe{position:absolute;top:50%;left:50%;width:max(100%,calc(100cqh*1.7778));height:max(100%,calc(100cqw*.5625));transform:translate(-50%,-50%);border:0;pointer-events:none}" +
    ".sbg[data-blur] iframe{filter:blur(var(--sbl))}" +
    ".sbg-ctl{position:absolute;right:14px;bottom:14px;z-index:4;display:flex;gap:8px}.sbg-ctl button{width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,255,255,.35);background:rgba(0,0,0,.55);color:#fff;font-size:14px;line-height:1;cursor:pointer;backdrop-filter:blur(6px)}.sbg-ctl button:hover{background:rgba(0,0,0,.75)}.sbg-ctl button:focus-visible{outline:2px solid #fff;outline-offset:2px}" +
    ".sbg[data-blur] img,.sbg[data-blur] video{filter:blur(var(--sbl));inset:calc(var(--sbl)*-2);width:calc(100% + var(--sbl)*4);height:calc(100% + var(--sbl)*4)}" +
    // a slideshow of pictures: they follow each other by themselves, with no controls
    ".sbg[data-slides] img{opacity:0;transition:opacity 1.4s ease}.sbg[data-slides] img.on{opacity:1}" +
    ".sbg[data-slides=zoom] img{transform:scale(1);transition:opacity 1.4s ease,transform 12s linear}.sbg[data-slides=zoom] img.on{transform:scale(1.12)}" +
    ".sbg[data-slides=slide] img{opacity:1;transform:translateX(100%);transition:transform 1.1s cubic-bezier(.6,.05,.2,1)}.sbg[data-slides=slide] img.on{transform:none}.sbg[data-slides=slide] img.was{transform:translateX(-100%)}" +
    "@media(prefers-reduced-motion:reduce){.sbg[data-slides] img{transition:none!important;transform:none!important}}" +
    ".has-sbg[data-sbg-text=light]{--text:#fff;--soft:rgba(255,255,255,.82);--line:rgba(255,255,255,.24);--surface:rgba(255,255,255,.1);color:#fff}" +
    ".has-sbg[data-sbg-text=dark]{--text:#14161a;--soft:rgba(20,22,26,.7);--line:rgba(20,22,26,.16);--surface:rgba(255,255,255,.72);color:#14161a}" +
    // its own text colour, font and text style
    ".has-sbg[data-sbg-text=custom]{--text:var(--scol);--soft:color-mix(in srgb,var(--scol) 76%,transparent);--line:color-mix(in srgb,var(--scol) 24%,transparent);color:var(--scol)}" +
    ".has-sbg[data-sbg-text=custom] :is(h1,h2,h3,h4,h5,h6,p,li,blockquote,figcaption,summary,dt,dd,small){color:var(--scol)!important}" +
    ".has-sbg[data-sbg-text=custom] :is(p,li,figcaption,dd,small):not(:is(h1,h2,h3,h4,h5,h6) *){color:color-mix(in srgb,var(--scol) 84%,transparent)!important}" +
    ".has-sbg[data-sfont=all],.has-sbg[data-sfont=all] :is(h1,h2,h3,h4,h5,h6,p,li,a,span,b,strong,em,small,button,input,select,textarea,label,td,th,blockquote,figcaption,dt,dd,summary,div){font-family:var(--sfont),system-ui,sans-serif!important}" +
    ".has-sbg[data-sfont=head] :is(h1,h2,h3,h4,h5,h6),.has-sbg[data-sfont=head] :is(h1,h2,h3,h4,h5,h6) *{font-family:var(--sfont),system-ui,sans-serif!important}" +
    [["bold", "font-weight:800"], ["light", "font-weight:300"], ["italic", "font-style:italic"], ["bolditalic", "font-weight:800!important;font-style:italic"], ["upper", "text-transform:uppercase!important;letter-spacing:.04em"], ["spaced", "letter-spacing:.09em"]]
      .map(function (x) { return ".has-sbg[data-sfs=" + x[0] + "] :is(h1,h2,h3,h4,h5,h6,p,li,blockquote,figcaption,summary,dt,dd){" + x[1] + "!important}"; }).join("") +
    // its own alignment: headings and text outside the cards, and the blocks and rows that hold them (marked by sectionAlign)
    ":where([data-salign]) :where(.card,[class*=card],article,li,form,table,details,.box,.tile,.cat,.banner,.loc,.qa-i){text-align:start}" +
    [["left", "0", "auto", "flex-start", "start"], ["center", "auto", "auto", "center", "center"], ["right", "auto", "0", "flex-end", "end"]].map(function (x) { var S = "[data-salign=" + x[0] + "] ", OUT = ":not(:is(.card,[class*=card],article,li,form,table,details,.box,.tile,.cat,.banner,.loc,.qa-i) *)";
      return S + ":is(h1,h2,h3,h4,h5,h6,p,blockquote,figcaption,small,header,div,dl,dt,dd)" + OUT + ":not(:is(.card,[class*=card],article,form,table,details,.box,.tile,.cat,.banner,.loc,.qa-i,.sbg)){text-align:" + x[0] + "!important}" +
        S + ".fx-salm{margin-left:" + x[1] + "!important;margin-right:" + x[2] + "!important}" +
        S + ":is(.fx-salg,.fx-salf){justify-content:" + x[3] + "!important}" +
        S + ".fx-salc{align-items:" + x[3] + "!important}"; }).join("");
  /** Alignment: marks, outside the section's cards, the blocks narrower than their place (so they can be moved as a
   *  whole) and the rows and grids (so what they hold can be moved), whatever the theme calls them. */
  function sectionAlign(el) {
    var CARD = ".card,[class*=card],article,li,form,table,details,.box,.tile,.cat,.banner,.loc,.qa-i";
    Array.prototype.forEach.call(el.querySelectorAll("*"), function (n) {
      if (n.classList.contains("sbg") || n.closest(".sbg")) return;
      var c = n.closest(CARD); if (c && c !== el && el.contains(c)) return;
      var cs = getComputedStyle(n), d = cs.display;
      if (d === "grid" || d === "inline-grid") n.classList.add("fx-salg");
      else if (d === "flex" || d === "inline-flex") n.classList.add(cs.flexDirection.indexOf("column") === 0 ? "fx-salc" : "fx-salf");
      if (n.parentNode === el || cs.position === "absolute" || cs.position === "fixed") return;   // the section's own wrapper stays where it is
      var tag = n.tagName.toLowerCase(), block = d === "block" || d === "flex" || d === "grid" || d === "flow-root" || d === "list-item";
      if (block && (cs.maxWidth !== "none" || tag === "svg" || tag === "img" || tag === "hr")) n.classList.add("fx-salm");
    });
  }
  // ---- Custom site & code blocks (content.custom, content.blocks): the owner's own HTML, CSS and JavaScript, as a whole
  // page in place of the sections or as blocks placed after a section. Drawn again with the page (old copies are removed).
  function ccRun(js, el, name) {
    if (!String(js || "").trim()) return;
    var sc = document.createElement("script"); sc.setAttribute("data-cc", "");
    window.__ccBlock = el;
    sc.textContent = "(function(block){try{\n" + js + "\n}catch(e){console.error(" + JSON.stringify(name) + ",e)}})(window.__ccBlock);";
    document.body.appendChild(sc); window.__ccBlock = null;
  }
  /* Built-in analytics: this page view and what happens on it, sent to the site's own database (cms/site.json says which).
     Only when the visitor allows analytics under the site's cookie consent (or the site asks for none), never in the
     Studio's preview, and not when the site switched it off (content.analytics.on === false). No cookie is set and nothing
     is stored in the browser. Sent: the page view (page, referring site, campaign, device type); how long the page was
     looked at and how far down it was read; products seen in lists (impressions) and added to the cart; taps on call,
     WhatsApp and email links, forms sent and links out to other sites. */
  function siteAnalytics(c) {
    if (PREVIEW || window.__saSent || navigator.webdriver || (c && c.analytics && c.analytics.on === false)) return;
    if (/^(localhost|127\.|192\.168\.)/.test(location.hostname) || location.protocol === "file:") return;
    var allowed = function () { var S = window.SiteConsent; try { return !(S && S.state && S.state().asked) || S.has("analytics"); } catch (e) { return true; } };
    var pv = Math.random().toString(36).slice(2, 12), H = null, queue = [], seen = {}, shown = 0, since = 0, depth = 0;
    var post = function (path, o) {
      if (!H) return; var url = String(H.api).replace(/\/+$/, "") + path, body = JSON.stringify(o);
      if (!(navigator.sendBeacon && navigator.sendBeacon(url, body))) fetch(url, { method: "POST", body: body, keepalive: true, mode: "cors" }).catch(function () {});
    };
    var ev = function (k, key) { if (!H) return; queue.push({ k: k, key: String(key || "").slice(0, 120) }); if (queue.length >= 25) flush(); };
    var flush = function () { if (H && queue.length) { post("/a/ev", { site: H.site, pv: pv, ev: queue.splice(0, 30) }); } };
    var look = function () { var now = Date.now(); if (since) shown += now - since; since = document.visibilityState === "visible" ? now : 0; };
    var end = function () { look(); flush(); if (H) post("/a/end", { site: H.site, pv: pv, sec: Math.round(shown / 1000), depth: depth }); };
    var key = function (el) {
      var a = el.closest ? el.closest("a[href]") : null, inner = el.querySelector ? el.querySelector('a[href*="product.html?p="]') : null;
      var h = (el.getAttribute && (el.getAttribute("href") || "")) || (a && a.getAttribute("href")) || (inner && inner.getAttribute("href")) || "", m = /product\.html\?p=([^&#]+)/.exec(h);
      if (el.getAttribute && el.getAttribute("data-product")) return el.getAttribute("data-product");
      if (m) { try { return decodeURIComponent(m[1]); } catch (x) { return m[1]; } }
      var n = el.querySelector && el.querySelector(".dish-n span"); return n ? n.textContent.trim() : "";
    };
    var start = function () {
      // Products seen: each product shown at least half on screen, counted once per page view.
      if ("IntersectionObserver" in window) {
        var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (!e.isIntersecting) return; var k = key(e.target); io.unobserve(e.target); if (k && !seen[k]) { seen[k] = 1; ev("imp", k); } }); }, { threshold: 0.5 });
        var watch = function () { document.querySelectorAll('[data-product],a.pcard[href*="product.html?p="],.prod,.dish').forEach(function (el) { if (!el.__saW) { el.__saW = 1; io.observe(el); } }); };
        watch(); setTimeout(watch, 1500); setInterval(watch, 4000);
      }
      addEventListener("site:cart", function (e) { var d = (e && e.detail) || {}; ev("cart", d.key || d.name || ""); });
      document.addEventListener("click", function (e) {
        var a = e.target && e.target.closest && e.target.closest("a[href]"); if (!a) return; var h = a.getAttribute("href") || "";
        if (/^tel:/i.test(h)) ev("call", h.slice(4)); else if (/^mailto:/i.test(h)) ev("email", ""); else if (/wa\.me|whatsapp\.com|api\.whatsapp/i.test(h)) ev("whatsapp", "");
        else if (/^https?:/i.test(h)) { try { var u = new URL(h, location.href); if (u.hostname !== location.hostname) ev("out", u.hostname.replace(/^www\./, "")); } catch (x) { /* not a link */ } }
      }, true);
      document.addEventListener("submit", function (e) { var f = e.target; ev("form", (f && (f.getAttribute("aria-label") || f.id || f.className || "")).toString().slice(0, 60)); }, true);
      addEventListener("scroll", function () { var d = document.documentElement, h = Math.max(1, d.scrollHeight - innerHeight); depth = Math.max(depth, Math.min(100, Math.round((scrollY / h) * 100))); }, { passive: true });
      since = document.visibilityState === "visible" ? Date.now() : 0;
      document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") end(); else look(); });
      addEventListener("pagehide", end);
      setInterval(flush, 8000);
    };
    var send = function () {
      if (window.__saSent || !allowed()) return; window.__saSent = 1;
      fetch("cms/site.json", { cache: "force-cache" }).then(function (r) { return r.json(); }).then(function (j) {
        var h = j && (j.host && j.host.kind === "cloudflare" ? j.host : j.signin); if (!h || !h.api || !h.site) return; H = h;
        var q = new URLSearchParams(location.search), w = innerWidth || 1200, k = q.get("p") ? "p" : q.get("s") ? "s" : q.get("product") ? "product" : "";
        post("/a/hit", { site: h.site, pv: pv, path: location.pathname + (k ? "?" + k + "=" + q.get(k) : ""), ref: document.referrer || "", host: location.hostname, dev: w < 768 ? "mobile" : w < 1100 ? "tablet" : "desktop", src: q.get("utm_source") || q.get("ref") || "" });
        start();
      }).catch(function () {});
    };
    // The consent banner is drawn a moment after the page: wait for it, then count now or once the visitor allows analytics.
    setTimeout(send, 1200); addEventListener("site:consent", send);
  }
  function customCode(c, root) {
    if (!c || !root) return;
    Array.prototype.forEach.call(document.querySelectorAll(".cc-site,.cc-block,style[data-cc],script[data-cc]"), function (n) { n.remove(); });
    Array.prototype.forEach.call(root.querySelectorAll(".cc-hidden"), function (n) { n.classList.remove("cc-hidden"); });
    var home = (document.body.getAttribute("data-page") || "home") === "home" && !/[?&]p=/.test(location.search);
    var main = root.querySelector("main") || root, css = function (t, id) { if (!String(t || "").trim()) return; var st = document.createElement("style"); st.setAttribute("data-cc", id); st.textContent = t; document.head.appendChild(st); };
    if (!document.getElementById("cc-css")) { var b = document.createElement("style"); b.id = "cc-css"; b.textContent = ".cc-hidden{display:none!important}"; document.head.appendChild(b); }
    var K = c.custom;
    if (K && K.on && (K.pages === "all" || home)) {
      // Everything the page drew in its main part is put away; before it is the menu bar, after it the footer.
      Array.prototype.forEach.call(main.children, function (n) { n.classList.add("cc-hidden"); });
      var kids = Array.prototype.slice.call(root.children), at = kids.indexOf(main);
      if (at >= 0) kids.forEach(function (n, i) { if (n === main || /^(SCRIPT|STYLE)$/.test(n.tagName) || n.classList.contains("skip")) return; if ((i < at && K.keepNav === false) || (i > at && K.keepFooter === false)) n.classList.add("cc-hidden"); });
      var box = document.createElement("div"); box.className = "cc-site"; box.innerHTML = String(K.html || "");
      main.insertBefore(box, main.firstChild); css(K.css, "site"); ccRun(K.js, box, "Custom site");
    }
    var list = Array.isArray(c.blocks) ? c.blocks : [], last = {};
    list.forEach(function (k, i) {
      if (!k || k.on === false || !(k.pages === "all" || home)) return;
      var el = document.createElement("div"); el.className = "cc-block"; el.id = "cc-" + String(k.id || i).replace(/[^\w-]/g, ""); el.innerHTML = String(k.html || "");
      var key = String(k.after || ""), prev = last[key], target = null;
      if (key && key !== "^top") { try { target = main.querySelector("#" + (window.CSS && CSS.escape ? CSS.escape(key) : key)) || main.querySelector('[data-sec="' + key + '"]'); } catch (e) { target = null; } }
      if (prev) prev.after(el);
      else if (key === "^top") main.insertBefore(el, main.firstChild);
      else if (target) target.after(el);
      else main.appendChild(el);
      last[key] = el; css(k.css, el.id); ccRun(k.js, el, k.name || "Code block");
    });
  }
  /** A section given its own background: the page layout's or theme's own picture layers behind its content (an image
   *  or canvas spread over the whole section, with no words or buttons in it, or a covering ::before / ::after) are put
   *  away, so what the owner chose shows instead of the layout's standard graphic. */
  function hideCovers(el) {
    var R = el.getBoundingClientRect(); if (R.width < 10 || R.height < 10) return;
    var covers = function (cs, w, h) { return (cs.position === "absolute" || cs.position === "fixed") && w >= R.width * 0.7 && h >= R.height * 0.6; };
    var walk = function (n, depth) {
      Array.prototype.forEach.call(n.children, function (ch) {
        if (ch.classList.contains("sbg") || ch.classList.contains("sbg-ctl") || ch.classList.contains("fx-sbg-hide")) return;
        var cs = getComputedStyle(ch), r = ch.getBoundingClientRect();
        if (covers(cs, r.width, r.height) && !(ch.textContent || "").trim() && !ch.querySelector("a,button,input,select,textarea,label,h1,h2,h3,p")) { ch.classList.add("fx-sbg-hide"); return; }
        if (depth < 2) walk(ch, depth + 1);
      });
    };
    walk(el, 0);
    ["before", "after"].forEach(function (p) {
      var cs = getComputedStyle(el, "::" + p); if (!cs || !cs.content || cs.content === "none" || cs.content === "normal") return;
      var full = cs.top === "0px" && cs.left === "0px" && (cs.right === "0px" || parseFloat(cs.width) >= R.width * 0.7) && (cs.bottom === "0px" || parseFloat(cs.height) >= R.height * 0.6);
      if ((cs.position === "absolute" || cs.position === "fixed") && full) el.setAttribute("data-sbg-no" + p, "");
    });
  }
  /** A background that stays still while the page scrolls past it (like a window onto it): its picture, slides, video
   *  or pattern is held at the screen's top while the section moves, cut to the section's shape. */
  var stills = [], stillOn = false;
  function stillPlace() { stills = stills.filter(function (b) { return b.box.isConnected; }); stills.forEach(function (b) { var r = b.box.getBoundingClientRect(); b.in.style.transform = "translate3d(0," + (-r.top) + "px,0)"; b.in.style.height = innerHeight + "px"; }); }
  function stillBg(box) {
    var inn = document.createElement("div"); inn.className = "sbg-still";
    while (box.firstChild) inn.appendChild(box.firstChild);
    box.appendChild(inn); box.setAttribute("data-still", ""); stills.push({ box: box, in: inn });
    if (!stillOn) { stillOn = true; var q = false, go = function () { if (q) return; q = true; requestAnimationFrame(function () { q = false; stillPlace(); }); }; addEventListener("scroll", go, { passive: true }); addEventListener("resize", go); }
    stillPlace();
  }
  var COLOR_OK = /^(#[0-9a-f]{3,8}|rgba?\([0-9., %]+\))$/i;
  /** A section's own font, text colour and text style. */
  function sectionText(el, k, opts) {
    var fam = String(k.font || "").replace(/["\\<>;{}]/g, "").trim();
    if (fam) {
      var id = "sfont-" + fam.toLowerCase().replace(/[^a-z0-9]+/g, "-"), spec = (opts.fonts && opts.fonts[fam]) || encodeURIComponent(fam).replace(/%20/g, "+");
      if (!document.getElementById(id) && fontsOk(opts.c)) { var l = document.createElement("link"); l.id = id; l.rel = "stylesheet"; l.href = "https://fonts.googleapis.com/css2?family=" + spec + "&display=swap"; document.head.appendChild(l); }
      el.style.setProperty("--sfont", '"' + fam + '"'); el.setAttribute("data-sfont", k.fontFor === "head" ? "head" : "all");
    }
    var tc = String(k.textColor || "").trim();
    if (k.text === "custom" && COLOR_OK.test(tc)) { el.style.setProperty("--scol", tc); el.setAttribute("data-sbg-text", "custom"); }
    if (/^(bold|light|italic|bolditalic|upper|spaced)$/.test(k.fontStyle || "")) el.setAttribute("data-sfs", k.fontStyle);
  }
  // ---- Moving backgrounds and patterns, drawn here with no library: for a section (sectionBg[key].kind "anim" or
  // "pattern") and for the page or its hero (theme.animBg). They take the theme's colours, pause when out of sight
  // or when the tab is hidden, and stay still for visitors who ask their device for less motion.
  var ANIMS = { motion: 1, sand: 1, dunes: 1, sandlogo: 1, synth: 1, liquid: 1, terrain: 1, aurora: 1, stars: 1, flow: 1, silk: 1, bubbles: 1, rain: 1, fireflies: 1, ripple: 1, petals: 1, hex: 1, orbit: 1, warp: 1 };
  var PATTERNS = { dots: 1, grid: 1, lines: 1, columns: 1, diagonal: 1, cross: 1, waves: 1, rings: 1, topo: 1, gingham: 1, stripes: 1, mesh: 1, grain: 1 };
  function rgbOf(str) { var m = /rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.]+%?))?/.exec(String(str || "")); if (!m) return null; var a = m[4] == null ? 1 : /%$/.test(m[4]) ? parseFloat(m[4]) / 100 : +m[4]; return a < 0.05 ? null : [Math.round(+m[1]), Math.round(+m[2]), Math.round(+m[3])]; }
  /** The colours to draw with: the theme's two accents, and the colour behind `el` (its own, else the nearest one above it). */
  function animCols(el, fixed) {
    var probe = document.createElement("i"); probe.style.cssText = "position:absolute;width:0;height:0;visibility:hidden"; (el || document.body).appendChild(probe);
    var read = function (v) { probe.style.color = ""; probe.style.color = v; return rgbOf(getComputedStyle(probe).color); };
    var c1 = read("var(--c1, var(--accent, #5B7CFF))") || [91, 124, 255], c2 = read("var(--c2, var(--accent2, var(--c3, var(--c1, var(--accent, #5B7CFF)))))") || c1;
    probe.remove();
    var bg = rgbOf(fixed), n = el;
    while (!bg && n && n.nodeType === 1) { bg = rgbOf(getComputedStyle(n).backgroundColor); n = n.parentNode; }
    if (!bg) bg = rgbOf(getComputedStyle(document.documentElement).backgroundColor) || [255, 255, 255];
    if (Math.abs(c1[0] - c2[0]) + Math.abs(c1[1] - c2[1]) + Math.abs(c1[2] - c2[2]) < 40) c2 = [c1[1], c1[2], c1[0]];   // one accent only: a second from the same family
    return { c1: c1, c2: c2, bg: bg, dark: (0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2]) < 140 };
  }
  var RGBA = function (c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; };
  var MIX = function (a, b, t) { return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)]; };
  // smooth noise (value noise, three octaves): the same every time, so a still frame is always the same picture
  function h2(x, y) { var n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); }
  function vn(x, y) { var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); return (h2(xi, yi) * (1 - u) + h2(xi + 1, yi) * u) * (1 - v) + (h2(xi, yi + 1) * (1 - u) + h2(xi + 1, yi + 1) * u) * v; }
  function fbm(x, y) { return vn(x, y) * 0.55 + vn(x * 2.1, y * 2.1) * 0.3 + vn(x * 4.3, y * 4.3) * 0.15; }
  /** Draws `kind` on a canvas filling `host`. Returns { stop }. */
  function animMount(host, kind, o) {
    o = o || {};
    var cv = document.createElement("canvas"); cv.setAttribute("aria-hidden", "true"); cv.className = "fx-anim"; cv.setAttribute("data-anim", kind);
    cv.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block" + (kind === "liquid" ? ";filter:blur(26px) saturate(1.25);transform:scale(1.12)" : kind === "aurora" ? ";filter:blur(14px);transform:scale(1.06)" : "");
    host.insertBefore(cv, host.firstChild);
    var g = cv.getContext("2d"); if (!g) return { stop: function () {} };
    var K = animCols(host, o.bg), c1 = K.c1, c2 = K.c2, bg = K.bg, dark = K.dark, ink = dark ? [255, 255, 255] : [20, 22, 26];
    var W = 0, H = 0, D = 1, S = {}, speed = o.speed === "lively" ? 1.9 : o.speed === "slow" ? 0.55 : 1, strength = Math.max(0.2, Math.min(1, (+o.strength || 100) / 100));
    cv.style.opacity = String(strength);
    // Where the pointer is over this background (0 to 1 each way): several of them answer to it.
    var M = { x: 0.5, y: 0.5, on: false };
    function onMove(e) { var r = cv.getBoundingClientRect(); if (!r.width || !r.height) return; var x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height; M.on = x >= 0 && x <= 1 && y >= 0 && y <= 1; if (M.on) { M.x = x; M.y = y; } }
    function size() {
      var r = host.getBoundingClientRect(); D = Math.min(1.5, window.devicePixelRatio || 1) * (kind === "liquid" || kind === "aurora" ? 0.5 : 1);
      var w = Math.max(2, Math.round(r.width * D)), h = Math.max(2, Math.round(r.height * D));
      if (w === W && h === H) return; W = cv.width = w; H = cv.height = h; S = {};
    }
    var DRAW = {
      // drifting shapes: circles, rings, bars, plus signs and triangles, each on its own slow path
      motion: function (t) {
        var n = Math.max(10, Math.min(26, Math.round(W * H / (D * D) / 52000))), i;
        if (!S.p) { S.p = []; for (i = 0; i < n; i++) S.p.push({ x: h2(i, 1), y: h2(i, 2), r: 18 + h2(i, 3) * 70, k: Math.floor(h2(i, 4) * 5), a: 0.07 + h2(i, 5) * 0.13, ph: h2(i, 6) * 6.28, c: h2(i, 7) > 0.5 ? c1 : c2, sp: 0.4 + h2(i, 8) }); }
        g.clearRect(0, 0, W, H);
        S.p.forEach(function (p) {
          var x = (p.x + Math.sin(t * 0.09 * p.sp + p.ph) * 0.07) * W, y = (p.y + Math.cos(t * 0.07 * p.sp + p.ph * 1.3) * 0.09) * H, r = p.r * D * (1 + Math.sin(t * 0.3 + p.ph) * 0.08), rot = t * 0.12 * p.sp + p.ph;
          g.save(); g.translate(x, y); g.rotate(rot); g.fillStyle = RGBA(p.c, p.a); g.strokeStyle = RGBA(p.c, p.a * 1.7); g.lineWidth = Math.max(1.5, r * 0.09);
          if (p.k === 0) { g.beginPath(); g.arc(0, 0, r, 0, 6.2832); g.fill(); }
          else if (p.k === 1) { g.beginPath(); g.arc(0, 0, r, 0, 6.2832); g.stroke(); }
          else if (p.k === 2) { var w = r * 2.4, hh = r * 0.5; g.beginPath(); if (g.roundRect) g.roundRect(-w / 2, -hh / 2, w, hh, hh / 2); else g.rect(-w / 2, -hh / 2, w, hh); g.fill(); }
          else if (p.k === 3) { g.fillRect(-r, -r * 0.16, r * 2, r * 0.32); g.fillRect(-r * 0.16, -r, r * 0.32, r * 2); }
          else { g.beginPath(); g.moveTo(0, -r); g.lineTo(r * 0.9, r * 0.7); g.lineTo(-r * 0.9, r * 0.7); g.closePath(); g.stroke(); }
          g.restore();
        });
      },
      // grains carried by a slow wind, each catching the light in turn
      sand: function (t) {
        var n = Math.max(350, Math.min(2400, Math.round(W * H / (D * D) / 650))), i, p;
        if (!S.p) { S.p = []; for (i = 0; i < n; i++) S.p.push({ x: h2(i, 11) * W, y: h2(i, 12) * H, s: (0.7 + h2(i, 13) * 1.5) * D, ph: h2(i, 14) * 6.28, c: h2(i, 15) }); S.t = t; }
        var dt = Math.min(0.05, Math.max(0, t - S.t)); S.t = t;
        g.clearRect(0, 0, W, H);
        for (i = 0; i < S.p.length; i++) {
          p = S.p[i];
          var a = fbm(p.x / (260 * D), p.y / (260 * D) + t * 0.03) * 6.2832 * 1.4, v = (14 + p.c * 22) * D;
          p.x += (Math.cos(a) * v + 9 * D) * dt; p.y += Math.sin(a) * v * 0.55 * dt;
          if (p.x > W + 4) p.x = -4; else if (p.x < -4) p.x = W + 4; if (p.y > H + 4) p.y = -4; else if (p.y < -4) p.y = H + 4;
          var tw = Math.pow(Math.abs(Math.sin(p.ph + t * (0.6 + p.c))), 6), col = p.c < 0.34 ? c1 : p.c < 0.67 ? c2 : ink;
          g.fillStyle = RGBA(col, (0.16 + tw * 0.74).toFixed(3)); g.fillRect(p.x, p.y, p.s, p.s);
        }
      },
      // dunes rolling to the horizon, their ripples drifting in the wind, and a band of light sweeping across that makes the grains glint
      dunes: function (t) {
        g.clearRect(0, 0, W, H);
        var L = 5, k, x, step = Math.max(5 * D, W / 96), sweep = ((t * 0.06) % 1.5 - 0.25) * W, band = W * 0.22, WHITE = [255, 255, 255];
        var ridge = function (k, x) { var y0 = H * (0.3 + k * 0.15); return y0 - (fbm(x / W * (1.5 + k * 0.35) + k * 3.1 + t * 0.008 * (k + 1), k * 1.7) - 0.42) * H * (0.16 + k * 0.03); };
        // the sky glows faintly where the light is
        var sky = g.createRadialGradient(sweep, H * 0.15, 0, sweep, H * 0.15, W * 0.55); sky.addColorStop(0, RGBA(MIX(bg, c2, dark ? 0.3 : 0.18), 0.55)); sky.addColorStop(1, RGBA(bg, 0));
        g.fillStyle = sky; g.fillRect(0, 0, W, H);
        for (k = 0; k < L; k++) {
          var z = k / (L - 1), col = MIX(bg, k % 2 ? c2 : c1, (dark ? 0.14 : 0.1) + z * (dark ? 0.2 : 0.16));
          g.beginPath(); g.moveTo(-2, H + 2);
          for (x = -2; x <= W + step; x += step) g.lineTo(x, ridge(k, x));
          g.lineTo(W + 2, H + 2); g.closePath();
          var fill = g.createLinearGradient(0, H * (0.22 + k * 0.15), 0, H); fill.addColorStop(0, RGBA(MIX(col, ink, dark ? 0.1 : 0.06), 1)); fill.addColorStop(1, RGBA(MIX(col, bg, 0.35), 1));
          g.fillStyle = fill; g.fill();
          // the crest catches the light most where the band passes
          g.lineWidth = Math.max(1, D * (0.8 + z)); var crest = g.createLinearGradient(sweep - band, 0, sweep + band, 0);
          crest.addColorStop(0, RGBA(ink, 0.06)); crest.addColorStop(0.5, RGBA(dark ? MIX(WHITE, c2, 0.3) : MIX(c2, c1, 0.35), (0.3 + z * 0.35).toFixed(3))); crest.addColorStop(1, RGBA(ink, 0.06));
          g.strokeStyle = crest; g.stroke();
          // wind ripples on its face, drifting slowly
          g.lineWidth = Math.max(1, D * 0.7);
          for (var r = 1; r <= 3; r++) {
            g.beginPath();
            for (x = -2; x <= W + step; x += step) { var y = ridge(k, x) + r * H * 0.022 * (1 + z) + Math.sin(x / (W * 0.035) + t * 0.5 + r * 1.3 + k) * H * 0.004; if (x < 0) g.moveTo(x, y); else g.lineTo(x, y); }
            g.strokeStyle = RGBA(ink, (dark ? 0.05 : 0.04) + 0.02 * z); g.stroke();
          }
        }
        // grains: most stay dim; in the band of light each one glints in turn
        if (!S.p) { var n = Math.max(500, Math.min(2600, Math.round(W * H / (D * D) / 520))); S.p = []; for (var i = 0; i < n; i++) S.p.push({ x: h2(i, 31) * W, y: H * (0.25 + h2(i, 32) * 0.75), s: (0.6 + h2(i, 33) * 1.3) * D, ph: h2(i, 34) * 6.28, c: h2(i, 35) }); }
        for (var j = 0; j < S.p.length; j++) {
          var p = S.p[j], lit = Math.exp(-Math.pow((p.x - sweep) / band, 2)), tw = Math.pow(Math.abs(Math.sin(p.ph + t * (1.4 + p.c * 1.6))), 10);
          var a = 0.04 + lit * (0.2 + tw * 0.8); if (a < 0.05) continue;
          // a glint is light, not dirt: pale on a dark page, the accent's bright tone on a light one
          var gc = dark ? MIX(p.c < 0.5 ? c2 : c1, WHITE, 0.6) : MIX(p.c < 0.5 ? c2 : c1, WHITE, 0.1);
          g.fillStyle = RGBA(gc, Math.min(1, a).toFixed(3)); g.fillRect(p.x, p.y, p.s, p.s);
          // the brightest ones flash as a tiny four-point star
          if (lit > 0.45 && tw > 0.75) { var r2 = p.s * (1.6 + tw * 1.6); g.fillStyle = RGBA(dark ? WHITE : MIX(gc, WHITE, 0.25), (lit * tw * 0.85).toFixed(3)); g.fillRect(p.x - r2 + p.s / 2, p.y + p.s / 2 - D * 0.4, r2 * 2, D * 0.8); g.fillRect(p.x + p.s / 2 - D * 0.4, p.y - r2 + p.s / 2, D * 0.8, r2 * 2); }
        }
      },
      // grains of sand gather into the PA mark, shimmer, then scatter on the wind, over and over; the pointer blows them apart
      sandlogo: function (t) {
        var i, p;
        if (!S.p) {
          // the mark, drawn once small and sampled: each grain is given a spot inside it and the colour of its part
          var PW = 220, PH = 390, oc = document.createElement("canvas"); oc.width = PW; oc.height = PH; var o2 = oc.getContext("2d"), sx = PW / 1060, sy = PH / 1880;
          var poly = function (pts, col) { o2.fillStyle = col; o2.beginPath(); for (var k = 0; k < pts.length; k += 2) o2[k ? "lineTo" : "moveTo"]((pts[k] - 425) * sx, (pts[k + 1] - 85) * sy); o2.closePath(); o2.fill(); };
          poly([431, 240, 644, 89, 644, 1307, 431, 1176], "#f00"); poly([644, 89, 1267, 447, 1049, 570, 644, 339], "#f00"); poly([1267, 447, 1268, 694, 666, 1043, 666, 782, 1049, 570], "#f00");
          poly([1268, 727, 1474, 853, 1474, 1957, 1268, 1832], "#00f"); poly([666, 1076, 1268, 727, 1268, 971, 876, 1200], "#00f"); poly([666, 1076, 876, 1200, 1243, 1420, 1243, 1675, 666, 1322], "#00f");
          var px = o2.getImageData(0, 0, PW, PH).data, spots = [];
          for (var yy = 0; yy < PH; yy += 2) for (var xx = 0; xx < PW; xx += 2) { var q = (yy * PW + xx) * 4; if (px[q + 3] > 128) spots.push([xx / PW, yy / PH, px[q] > px[q + 2] ? 0 : 1]); }
          var n = Math.max(1400, Math.min(4500, Math.round(W * H / (D * D) / 210))), lh = Math.min(H * 0.78, W * 0.62 * PH / PW), lw = lh * PW / PH, ox = (W - lw) / 2, oy = (H - lh) / 2;
          // the brand's own colours, made lighter on a dark page so they still show
          var WH = [255, 255, 255], pc = [52, 51, 95], ac = [51, 102, 154]; if (dark) { pc = MIX([96, 92, 200], WH, 0.25); ac = MIX(ac, WH, 0.3); }
          S.p = []; for (i = 0; i < n; i++) { var sp = spots[Math.floor(h2(i, 41) * spots.length)] || [0.5, 0.5, 0]; S.p.push({ tx: ox + (sp[0] + (h2(i, 42) - 0.5) * 0.012) * lw, ty: oy + (sp[1] + (h2(i, 43) - 0.5) * 0.008) * lh, hx: h2(i, 44) * W, hy: h2(i, 45) * H, s: (0.7 + h2(i, 46) * 1.3) * D, ph: h2(i, 47) * 6.28, c: sp[2] ? ac : pc, d: h2(i, 48), vx: 0, vy: 0, ox: 0, oy: 0 }); }
          S.t = t;
        }
        var dt = Math.min(0.05, Math.max(0, t - S.t)); S.t = t;
        g.clearRect(0, 0, W, H);
        // one loop: gather (0–3.2s), hold (to 6.4s), scatter (to 8.4s), drift (to 10s); each grain a little early or late
        var cyc = t % 10, mx = M.x * W, my = M.y * H, R = 120 * D, ease = function (x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
        for (i = 0; i < S.p.length; i++) {
          p = S.p[i];
          var lag = p.d * 1.1, f = cyc < 6.4 ? ease((cyc - lag) / 2.6) : 1 - ease((cyc - 6.4 - lag * 0.6) / 1.8);
          // where it is when scattered: its own spot, drifting on a slow current
          var wx = p.hx + (fbm(p.hx / (300 * D) + t * 0.05, p.hy / (300 * D)) - 0.45) * 160 * D, wy = p.hy + (fbm(p.hy / (300 * D), p.hx / (300 * D) + t * 0.05) - 0.45) * 90 * D;
          var x = wx + (p.tx - wx) * f, y = wy + (p.ty - wy) * f;
          // the pointer blows nearby grains away; they settle back by themselves
          if (M.on) { var ex = x + p.ox - mx, ey = y + p.oy - my, d2 = ex * ex + ey * ey; if (d2 < R * R) { var dd = Math.sqrt(d2) + 0.01, k2 = (1 - dd / R) * 2600 * D; p.vx += ex / dd * k2 * dt; p.vy += ey / dd * k2 * dt; } }
          p.vx += -p.ox * 9 * dt; p.vy += -p.oy * 9 * dt; p.vx *= Math.pow(0.04, dt); p.vy *= Math.pow(0.04, dt); p.ox += p.vx * dt; p.oy += p.vy * dt;
          var tw = Math.pow(Math.abs(Math.sin(p.ph + t * (1.2 + p.d * 1.8))), 8), a = (0.22 + f * 0.6) + tw * 0.3;
          g.fillStyle = RGBA(f > 0.5 ? p.c : MIX(p.c, ink, 0.25), Math.min(1, a).toFixed(3)); g.fillRect(x + p.ox, y + p.oy, p.s, p.s);
          if (tw > 0.9 && f > 0.8) { g.fillStyle = RGBA(dark ? [255, 255, 255] : MIX(p.c, [255, 255, 255], 0.55), (tw * 0.7).toFixed(3)); g.fillRect(x + p.ox - p.s, y + p.oy + p.s / 2 - D * 0.35, p.s * 3, D * 0.7); g.fillRect(x + p.ox + p.s / 2 - D * 0.35, y + p.oy - p.s, D * 0.7, p.s * 3); }
        }
      },
      // a low sun over a grid that runs to the horizon
      synth: function (t) {
        var hz = H * 0.6, cx = W / 2, i, y;
        var sky = g.createLinearGradient(0, 0, 0, hz); sky.addColorStop(0, RGBA(bg, 1)); sky.addColorStop(1, RGBA(MIX(bg, c2, dark ? 0.42 : 0.3), 1));
        g.fillStyle = sky; g.fillRect(0, 0, W, hz);
        for (i = 0; i < 46; i++) { var tw = 0.25 + 0.75 * Math.abs(Math.sin(t * 0.7 + i * 2.3)); g.fillStyle = RGBA(ink, (0.1 + tw * 0.4).toFixed(3)); g.fillRect(h2(i, 21) * W, h2(i, 22) * hz * 0.8, D * (1 + h2(i, 23)), D * (1 + h2(i, 23))); }
        var r = Math.min(W, H) * 0.24, sun = g.createLinearGradient(0, hz - r * 2, 0, hz); sun.addColorStop(0, RGBA(c2, 1)); sun.addColorStop(1, RGBA(c1, 1));
        g.save(); g.beginPath(); g.rect(0, 0, W, hz); g.clip(); g.shadowColor = RGBA(c1, 0.6); g.shadowBlur = r * 0.5; g.fillStyle = sun; g.beginPath(); g.arc(cx, hz - r * 0.35, r, 0, 6.2832); g.fill(); g.shadowBlur = 0;
        // bands across the sun, sliding down and thickening as they reach the horizon
        g.fillStyle = RGBA(MIX(bg, c2, dark ? 0.42 : 0.3), 1);
        for (i = 0; i < 7; i++) { var f = ((i + (t * 0.08) % 1) / 7), by = hz - r * 1.35 + r * 1.35 * (0.35 + f * 0.65), bh = Math.max(D, r * 0.11 * f); g.fillRect(cx - r - 4, by, r * 2 + 8, bh); }
        g.restore();
        var fl = g.createLinearGradient(0, hz, 0, H); fl.addColorStop(0, RGBA(MIX(bg, c1, dark ? 0.3 : 0.2), 1)); fl.addColorStop(1, RGBA(bg, 1)); g.fillStyle = fl; g.fillRect(0, hz, W, H - hz);
        g.lineWidth = Math.max(1, D); g.strokeStyle = RGBA(c1, dark ? 0.75 : 0.6);
        for (i = -14; i <= 14; i++) { g.beginPath(); g.moveTo(cx + i * W * 0.012, hz); g.lineTo(cx + i * W * 0.16, H); g.stroke(); }
        var ph = (t * 0.22) % 1;
        for (i = 0; i < 13; i++) { var z = (i + ph) / 13; y = hz + (H - hz) * z * z; g.globalAlpha = Math.min(1, 0.25 + z); g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
        g.globalAlpha = 1; g.strokeStyle = RGBA(c2, 0.9); g.lineWidth = Math.max(1.5, D * 1.5); g.beginPath(); g.moveTo(0, hz); g.lineTo(W, hz); g.stroke();
      },
      // slow blobs of colour that merge and part, with waves along the bottom
      liquid: function (t) {
        g.fillStyle = RGBA(bg, 1); g.fillRect(0, 0, W, H);
        var n = 7, i, R = Math.max(W, H) * 0.32;
        for (i = 0; i < n; i++) {
          var x = W * (0.5 + 0.42 * Math.sin(t * 0.11 * (1 + i * 0.13) + i * 2.1)), y = H * (0.5 + 0.4 * Math.cos(t * 0.09 * (1 + i * 0.17) + i * 1.7)), r = R * (0.55 + 0.35 * Math.sin(t * 0.2 + i));
          var c = i % 3 === 0 ? c1 : i % 3 === 1 ? c2 : MIX(c1, c2, 0.5), gr = g.createRadialGradient(x, y, 0, x, y, r);
          gr.addColorStop(0, RGBA(c, dark ? 0.75 : 0.6)); gr.addColorStop(1, RGBA(c, 0)); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
        }
        for (i = 0; i < 3; i++) {
          g.fillStyle = RGBA(i % 2 ? c1 : c2, 0.18); g.beginPath(); g.moveTo(0, H);
          for (var x2 = 0; x2 <= W; x2 += W / 40) g.lineTo(x2, H * (0.72 + i * 0.08) + Math.sin(x2 / W * 6.28 * (1.2 + i * 0.5) + t * (0.5 + i * 0.2)) * H * 0.045 + Math.sin(x2 / W * 14 - t * 0.35) * H * 0.015);
          g.lineTo(W, H); g.closePath(); g.fill();
        }
      },
      // ridge after ridge of a landscape, scrolling toward you
      terrain: function (t) {
        g.clearRect(0, 0, W, H);
        var rows = 26, top = H * 0.2, i, x, step = Math.max(6 * D, W / 130), sc = t * 0.16;
        for (i = 0; i < rows; i++) {
          var z = i / (rows - 1), y0 = top + (H - top) * Math.pow(z, 1.55), amp = H * (0.035 + 0.15 * z), f = 1.2 + 2.2 * (1 - z);
          g.beginPath(); g.moveTo(-2, H + 2);
          for (x = -2; x <= W + step; x += step) { var e = fbm(x / W * f + 5, i * 0.33 - sc), mid = 1 - Math.pow(Math.abs(x / W - 0.5) * 1.5, 2); g.lineTo(x, y0 - (e - 0.3) * amp * (0.45 + 0.55 * Math.max(0, mid))); }
          g.lineTo(W + 2, H + 2); g.closePath();
          g.fillStyle = RGBA(bg, 1); g.fill();
          g.strokeStyle = RGBA(MIX(c2, c1, z), (0.16 + 0.62 * z).toFixed(3)); g.lineWidth = Math.max(1, D * (0.7 + z * 0.9)); g.stroke();
        }
      },
      // ribbons of light that sway
      aurora: function (t) {
        g.clearRect(0, 0, W, H);
        for (var i = 0; i < 5; i++) {
          var c = i % 2 ? c2 : MIX(c1, c2, i / 6), base = H * (0.18 + i * 0.13), gr = g.createLinearGradient(0, base - H * 0.2, 0, base + H * 0.35);
          gr.addColorStop(0, RGBA(c, 0)); gr.addColorStop(0.45, RGBA(c, dark ? 0.55 : 0.4)); gr.addColorStop(1, RGBA(c, 0));
          g.fillStyle = gr; g.beginPath(); g.moveTo(0, H);
          for (var x = 0; x <= W; x += W / 36) g.lineTo(x, base + Math.sin(x / W * 5 + t * (0.22 + i * 0.05) + i * 1.9) * H * 0.09 + (fbm(x / W * 2.2 + i * 3, t * 0.06 + i) - 0.5) * H * 0.22);
          g.lineTo(W, H); g.closePath(); g.fill();
        }
      },
      // points that drift, joined when they come near each other
      stars: function (t) {
        var n = Math.max(26, Math.min(90, Math.round(W * H / (D * D) / 15000))), i, j, link = 130 * D;
        if (!S.p) { S.p = []; for (i = 0; i < n; i++) S.p.push({ x: h2(i, 31), y: h2(i, 32), ph: h2(i, 33) * 6.28, sp: 0.3 + h2(i, 34), c: h2(i, 35) > 0.5 ? c1 : c2 }); }
        g.clearRect(0, 0, W, H);
        var P = S.p.map(function (p) { return { x: (p.x + Math.sin(t * 0.05 * p.sp + p.ph) * 0.06) * W, y: (p.y + Math.cos(t * 0.045 * p.sp + p.ph * 1.7) * 0.07) * H, p: p }; });
        g.lineWidth = Math.max(1, D);
        for (i = 0; i < P.length; i++) for (j = i + 1; j < P.length; j++) { var dx = P[i].x - P[j].x, dy = P[i].y - P[j].y, d = Math.sqrt(dx * dx + dy * dy); if (d < link) { g.strokeStyle = RGBA(MIX(c1, c2, 0.5), ((1 - d / link) * 0.42).toFixed(3)); g.beginPath(); g.moveTo(P[i].x, P[i].y); g.lineTo(P[j].x, P[j].y); g.stroke(); } }
        P.forEach(function (q) { var tw = 0.5 + 0.5 * Math.sin(t * 1.3 * q.p.sp + q.p.ph); g.fillStyle = RGBA(q.p.c, (0.45 + tw * 0.5).toFixed(3)); g.beginPath(); g.arc(q.x, q.y, D * (1.6 + tw * 1.6), 0, 6.2832); g.fill(); });
      },
      // thousands of fine trails following an unseen current; the pointer stirs them
      flow: function (t) {
        var n = Math.max(250, Math.min(1000, Math.round(W * H / (D * D) / 1500))), i, p, fresh = !S.p, cols = [c1, c2, ink];
        if (fresh) { S.p = []; for (i = 0; i < n; i++) S.p.push({ x: h2(i, 41) * W, y: h2(i, 42) * H, k: h2(i, 43) < 0.46 ? 0 : h2(i, 43) < 0.92 ? 1 : 2, life: 40 + h2(i, 44) * 160 }); g.clearRect(0, 0, W, H); }
        var steps = fresh ? 60 : 1, v = 2.4 * D * Math.min(1.6, Math.max(0.6, speed)), R = 170 * D, mx = M.x * W, my = M.y * H;
        g.lineCap = "round"; g.lineWidth = Math.max(1, D * 1.1);
        for (var s = 0; s < steps; s++) {
          g.globalCompositeOperation = "destination-out"; g.fillStyle = "rgba(0,0,0,0.055)"; g.fillRect(0, 0, W, H); g.globalCompositeOperation = "source-over";
          for (var k = 0; k < 3; k++) {
            g.strokeStyle = RGBA(cols[k], k === 2 ? 0.3 : 0.55); g.beginPath();
            for (i = 0; i < S.p.length; i++) {
              p = S.p[i]; if (p.k !== k) continue;
              var a = fbm(p.x / (320 * D), p.y / (320 * D) + t * 0.025) * 6.2832 * 2, dx = Math.cos(a) * v, dy = Math.sin(a) * v;
              if (M.on) { var ex = p.x - mx, ey = p.y - my, d2 = ex * ex + ey * ey; if (d2 < R * R) { var f = (1 - Math.sqrt(d2) / R) * v * 1.6, d = Math.sqrt(d2) + 0.01; dx += -ey / d * f; dy += ex / d * f; } }
              g.moveTo(p.x, p.y); p.x += dx; p.y += dy; g.lineTo(p.x, p.y);
              if (--p.life < 0 || p.x < -6 || p.x > W + 6 || p.y < -6 || p.y > H + 6) { S.q = (S.q || 0) + 1; p.x = h2(i, 45 + S.q) * W; p.y = h2(i, 46 + S.q * 1.7) * H; p.life = 60 + h2(i, 47 + S.q) * 160; }
            }
            g.stroke();
          }
        }
      },
      // sheets of fine lines that roll like silk; they lift toward the pointer
      silk: function (t) {
        g.clearRect(0, 0, W, H);
        var n = 26, i, x, step = W / 70, mx = M.x * W, my = M.y * H, sg = W * 0.09;
        g.lineWidth = Math.max(1, D * 1.15);
        for (i = 0; i < n; i++) {
          var z = i / (n - 1); g.strokeStyle = RGBA(MIX(c1, c2, z), (0.1 + 0.42 * Math.sin(z * 3.1416)).toFixed(3)); g.beginPath();
          for (x = -step; x <= W + step; x += step) {
            var u = x / W, y = H * 0.5 + (z - 0.5) * H * 0.34 + Math.sin(u * 4.2 + t * 0.5 + z * 2.6) * Math.cos(u * 1.7 - t * 0.23 + z * 1.4) * H * 0.2 * (0.45 + z) + Math.sin(u * 9 - t * 0.7 + z * 5) * H * 0.012;
            if (M.on) y += Math.exp(-((x - mx) * (x - mx)) / (2 * sg * sg)) * (my - y) * 0.32;
            if (x <= -step + 0.01) g.moveTo(x, y); else g.lineTo(x, y);
          }
          g.stroke();
        }
      },
      // bubbles rising, each with its own wobble and a glint of light
      bubbles: function (t) {
        g.clearRect(0, 0, W, H);
        var n = Math.max(16, Math.min(46, Math.round(W * H / (D * D) / 30000))), i;
        for (i = 0; i < n; i++) {
          var r = (7 + h2(i, 51) * h2(i, 52) * 46) * D, span = H + r * 2 + 20, v = (16 + h2(i, 53) * 34) * D * (46 * D / (r + 20 * D) + 0.5), y = H + r - ((t * v + h2(i, 54) * span) % span), x = h2(i, 55) * W + Math.sin(t * (0.5 + h2(i, 56)) + i) * 16 * D;
          var c = h2(i, 57) > 0.5 ? c1 : c2, fade = Math.min(1, (y + r) / (H * 0.25)), near = M.on ? Math.max(0, 1 - Math.sqrt(Math.pow(x - M.x * W, 2) + Math.pow(y - M.y * H, 2)) / (150 * D)) : 0;
          r *= 1 + near * 0.35;
          g.fillStyle = RGBA(c, (0.07 + near * 0.1) * fade); g.strokeStyle = RGBA(c, (0.5 + near * 0.3) * fade); g.lineWidth = Math.max(1, D * 1.3);
          g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill(); g.stroke();
          g.strokeStyle = RGBA(ink, 0.5 * fade); g.lineWidth = Math.max(1, r * 0.09); g.beginPath(); g.arc(x, y, r * 0.66, 3.6, 4.6); g.stroke();
        }
      },
      // columns of digits falling at their own pace
      rain: function (t) {
        g.clearRect(0, 0, W, H);
        var cw = 18 * D, cols = Math.ceil(W / cw), rows = Math.ceil(H / cw) + 1, i, j, tail = 16;
        g.font = "600 " + Math.round(13 * D) + "px ui-monospace,Menlo,Consolas,monospace"; g.textAlign = "center"; g.textBaseline = "middle";
        for (i = 0; i < cols; i++) {
          if (h2(i, 61) < 0.22) continue;
          var v = 5 + h2(i, 62) * 11, span = rows + tail + 6 + h2(i, 63) * 20, head = (t * v + h2(i, 64) * span) % span, hi = Math.floor(head), c = h2(i, 65) > 0.5 ? c1 : c2;
          for (j = 0; j < tail; j++) {
            var row = hi - j; if (row < 0 || row > rows) continue;
            var ch = h2(i * 7.1, row + Math.floor(t * 2 + h2(i, row) * 5)) > 0.5 ? "1" : "0";
            g.fillStyle = j === 0 ? RGBA(MIX(c, ink, 0.6), 0.95) : RGBA(c, (0.72 * (1 - j / tail)).toFixed(3));
            g.fillText(ch, i * cw + cw / 2, row * cw + cw / 2);
          }
        }
      },
      // soft lights that wander and breathe; they brighten near the pointer
      fireflies: function (t) {
        g.clearRect(0, 0, W, H);
        var n = Math.max(18, Math.min(48, Math.round(W * H / (D * D) / 26000))), i;
        for (i = 0; i < n; i++) {
          var sp = 0.4 + h2(i, 71), ph = h2(i, 72) * 6.28;
          var x = (h2(i, 73) + Math.sin(t * 0.13 * sp + ph) * 0.12 + Math.sin(t * 0.37 * sp + ph * 2.3) * 0.035) * W, y = (h2(i, 74) + Math.cos(t * 0.11 * sp + ph * 1.4) * 0.12 + Math.sin(t * 0.41 * sp + ph) * 0.03) * H;
          var pulse = Math.pow(0.5 + 0.5 * Math.sin(t * 1.15 * sp + ph), 3), near = M.on ? Math.max(0, 1 - Math.sqrt(Math.pow(x - M.x * W, 2) + Math.pow(y - M.y * H, 2)) / (220 * D)) : 0;
          var lit = Math.min(1, pulse + near), r = (9 + lit * 30) * D, c = h2(i, 75) > 0.5 ? c1 : c2, gr = g.createRadialGradient(x, y, 0, x, y, r);
          gr.addColorStop(0, RGBA(c, 0.2 + lit * 0.6)); gr.addColorStop(0.35, RGBA(c, 0.08 + lit * 0.22)); gr.addColorStop(1, RGBA(c, 0));
          g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
          g.fillStyle = RGBA(MIX(c, ink, dark ? 0.7 : 0.1), 0.35 + lit * 0.6); g.beginPath(); g.arc(x, y, D * (1.2 + lit * 1.4), 0, 6.2832); g.fill();
        }
      },
      // rings spreading like rain on still water; moving the pointer starts more
      ripple: function (t) {
        g.clearRect(0, 0, W, H);
        var big = Math.max(W, H) * 0.42, i, k;
        function ring(x, y, age, c, size) { for (k = 0; k < 3; k++) { var a = age - k * 0.09; if (a <= 0) continue; g.strokeStyle = RGBA(c, (Math.pow(1 - a, 1.4) * (0.85 - k * 0.2)).toFixed(3)); g.lineWidth = Math.max(1, D * (2.2 - k * 0.5) * (1 - a * 0.5)); g.beginPath(); g.ellipse(x, y, a * size, a * size * 0.62, 0, 0, 6.2832); g.stroke(); } }
        for (i = 0; i < 8; i++) { var u = t * 0.16 + i / 8, cyc = Math.floor(u), age = u - cyc; ring(h2(cyc + i * 13.7, 81) * W, h2(cyc + i * 13.7, 82) * H, age, i % 2 ? c1 : c2, big * (0.5 + h2(cyc, i + 83) * 0.6)); }
        if (M.on) { if (!S.r) S.r = []; var mx = M.x * W, my = M.y * H, lastR = S.r[S.r.length - 1]; if (!lastR || Math.abs(lastR.x - mx) + Math.abs(lastR.y - my) > 70 * D) { S.r.push({ x: mx, y: my, t: t }); if (S.r.length > 10) S.r.shift(); } }
        if (S.r) S.r.forEach(function (q) { var age = (t - q.t) / 2.6; if (age > 0 && age < 1) ring(q.x, q.y, age, MIX(c1, c2, 0.5), big * 0.45); });
      },
      // petals tumbling down on a light breeze
      petals: function (t) {
        g.clearRect(0, 0, W, H);
        var n = Math.max(18, Math.min(60, Math.round(W * H / (D * D) / 17000))), i;
        for (i = 0; i < n; i++) {
          var r = (9 + h2(i, 91) * 15) * D, span = H + r * 6, v = (20 + h2(i, 92) * 30) * D, y = ((t * v + h2(i, 93) * span) % span) - r * 3, ph = h2(i, 94) * 6.28;
          var x = ((h2(i, 95) * W + t * 9 * D + Math.sin(t * 0.7 + ph) * 34 * D) % (W + r * 4)) - r * 2, c = h2(i, 96) > 0.5 ? c1 : c2;
          g.save(); g.translate(x, y); g.rotate(t * (0.4 + h2(i, 97) * 0.8) + ph); g.scale(1, 0.25 + 0.75 * Math.abs(Math.cos(t * (0.9 + h2(i, 98)) + ph)));
          g.fillStyle = RGBA(c, 0.3 + h2(i, 99) * 0.34); g.beginPath(); g.moveTo(0, -r); g.bezierCurveTo(r * 0.95, -r * 0.55, r * 0.7, r * 0.75, 0, r); g.bezierCurveTo(-r * 0.7, r * 0.75, -r * 0.95, -r * 0.55, 0, -r); g.fill();
          g.strokeStyle = RGBA(c, 0.5); g.lineWidth = Math.max(1, D * 0.8); g.beginPath(); g.moveTo(0, -r * 0.7); g.lineTo(0, r * 0.8); g.stroke();
          g.restore();
        }
      },
      // a honeycomb that lights up in passing waves, and under the pointer
      hex: function (t) {
        g.clearRect(0, 0, W, H);
        var s = 30 * D, w = s * 1.732, hh = s * 1.5, rows = Math.ceil(H / hh) + 2, cols = Math.ceil(W / w) + 2, r, q, k, mx = M.x * W, my = M.y * H;
        var ox = W * (0.5 + 0.38 * Math.sin(t * 0.17)), oy = H * (0.5 + 0.38 * Math.cos(t * 0.13));
        function path(cx, cy, rad) { g.moveTo(cx, cy - rad); for (k = 1; k < 6; k++) g.lineTo(cx + Math.sin(k * 1.0472) * rad, cy - Math.cos(k * 1.0472) * rad); g.closePath(); }
        g.lineWidth = Math.max(1, D); g.strokeStyle = RGBA(c1, dark ? 0.16 : 0.13); g.beginPath();
        for (r = -1; r < rows; r++) for (q = -1; q < cols; q++) path(q * w + (r & 1 ? w / 2 : 0), r * hh, s - D);
        g.stroke();
        for (r = -1; r < rows; r++) for (q = -1; q < cols; q++) {
          var cx = q * w + (r & 1 ? w / 2 : 0), cy = r * hh, d = Math.sqrt((cx - ox) * (cx - ox) + (cy - oy) * (cy - oy)) / D;
          var lit = Math.pow(Math.max(0, Math.sin(d * 0.016 - t * 1.5) * 0.6 + fbm(q * 0.31 + t * 0.12, r * 0.31) * 0.9 - 0.42), 1.4);
          if (M.on) lit += Math.max(0, 1 - Math.sqrt((cx - mx) * (cx - mx) + (cy - my) * (cy - my)) / (150 * D)) * 0.8;
          if (lit < 0.03) continue;
          g.fillStyle = RGBA(MIX(c1, c2, h2(q, r)), Math.min(0.62, lit * 0.6).toFixed(3)); g.beginPath(); path(cx, cy, (s - D * 2) * Math.min(1, 0.55 + lit)); g.fill();
        }
      },
      // planets circling a small sun, each leaving a short trail
      orbit: function (t) {
        g.clearRect(0, 0, W, H);
        var cx = W * 0.5 + (M.on ? (M.x - 0.5) * W * 0.06 : 0), cy = H * 0.52 + (M.on ? (M.y - 0.5) * H * 0.06 : 0), R = Math.max(W, H) * 0.56, i, n = 8;
        g.save(); g.translate(cx, cy); g.rotate(-0.32);
        var sun = g.createRadialGradient(0, 0, 0, 0, 0, R * 0.09); sun.addColorStop(0, RGBA(c2, 0.9)); sun.addColorStop(0.35, RGBA(c1, 0.45)); sun.addColorStop(1, RGBA(c1, 0)); g.fillStyle = sun; g.beginPath(); g.arc(0, 0, R * 0.09, 0, 6.2832); g.fill();
        for (i = 0; i < n; i++) {
          var rx = R * (0.13 + i * 0.115), ry = rx * 0.36, c = i % 2 ? c2 : c1, a = t * (0.55 / (0.6 + i * 0.5)) + i * 1.9;
          g.strokeStyle = RGBA(c, 0.2); g.lineWidth = Math.max(1, D); g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, 6.2832); g.stroke();
          g.strokeStyle = RGBA(c, 0.6); g.lineWidth = Math.max(1.5, D * 2); g.beginPath(); g.ellipse(0, 0, rx, ry, 0, a - 0.55, a); g.stroke();
          var px = Math.cos(a) * rx, py = Math.sin(a) * ry, pr = D * (3 + h2(i, 101) * 5) * (1 + 0.35 * Math.sin(a));
          g.shadowColor = RGBA(c, 0.8); g.shadowBlur = pr * 3; g.fillStyle = RGBA(c, 0.95); g.beginPath(); g.arc(px, py, pr, 0, 6.2832); g.fill(); g.shadowBlur = 0;
        }
        g.restore();
      },
      // stars streaming past, as if flying through them; the pointer steers
      warp: function (t) {
        g.clearRect(0, 0, W, H);
        var tx = W * (0.5 + (M.on ? (M.x - 0.5) * 0.3 : 0)), ty = H * (0.5 + (M.on ? (M.y - 0.5) * 0.3 : 0));
        S.cx = S.cx == null ? tx : S.cx + (tx - S.cx) * 0.06; S.cy = S.cy == null ? ty : S.cy + (ty - S.cy) * 0.06;
        var n = Math.max(90, Math.min(260, Math.round(W * H / (D * D) / 5200))), i, far = Math.sqrt(W * W + H * H) * 0.62; g.lineCap = "round";
        for (i = 0; i < n; i++) {
          var a = h2(i, 111) * 6.2832, z = (h2(i, 112) + t * 0.11 * (0.5 + h2(i, 113))) % 1, r1 = z * z * far, r0 = Math.max(0, z - 0.035 - z * 0.05), c = h2(i, 114) < 0.4 ? c1 : h2(i, 114) < 0.8 ? c2 : ink; r0 = r0 * r0 * far;
          g.strokeStyle = RGBA(c, (Math.min(1, 0.08 + z * 0.9) * (c === ink ? 0.45 : 0.8)).toFixed(3)); g.lineWidth = Math.max(1, D * (0.5 + z * 1.6));
          g.beginPath(); g.moveTo(S.cx + Math.cos(a) * r0, S.cy + Math.sin(a) * r0); g.lineTo(S.cx + Math.cos(a) * r1, S.cy + Math.sin(a) * r1); g.stroke();
        }
      }
    };
    var draw = DRAW[kind] || DRAW.motion, raf = 0, seen = true, alive = true, t0 = performance.now(), last = 0;
    function frame(now) {
      raf = 0; if (!alive) return;
      if (!cv.isConnected) { stop(); return; }
      if (seen && !document.hidden && now - last > 30) { last = now; size(); try { draw((now - t0) / 1000 * speed); } catch (e) { stop(); return; } }
      raf = requestAnimationFrame(frame);
    }
    function still() { size(); try { draw(7.3); } catch (e) { /* stays empty */ } }
    var io = null, ro = null;
    function stop() { alive = false; if (raf) cancelAnimationFrame(raf); if (io) io.disconnect(); if (ro) ro.disconnect(); window.removeEventListener("pointermove", onMove); }
    if (RM || o.still) { still(); if (window.ResizeObserver) { ro = new ResizeObserver(function () { if (cv.isConnected) still(); else stop(); }); ro.observe(host); } }
    else {
      if (window.IntersectionObserver) { io = new IntersectionObserver(function (es) { seen = es[es.length - 1].isIntersecting; }); io.observe(host); }
      still(); raf = requestAnimationFrame(frame);
      if (matchMedia("(hover: hover)").matches) window.addEventListener("pointermove", onMove, { passive: true });
    }
    return { stop: stop };
  }
  /** A still pattern as a CSS background, in the theme's colour. */
  function patternCss(name, K) {
    var a = RGBA(K.c1, K.dark ? 0.34 : 0.26), b = RGBA(K.c1, K.dark ? 0.2 : 0.13), c = RGBA(K.c2, K.dark ? 0.3 : 0.2), s = "rgb(" + K.c1.join(",") + ")", op = K.dark ? 0.42 : 0.3;
    var svg = function (w, h, body) { return "url(\"data:image/svg+xml," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='" + w + "' height='" + h + "' viewBox='0 0 " + w + " " + h + "'>" + body + "</svg>") + "\")"; };
    var L = "fill='none' stroke='" + s + "' stroke-opacity='" + op + "' stroke-width='1.4'";
    switch (name) {
      case "dots": return "radial-gradient(" + a + " 1.4px,transparent 1.9px) 0 0/20px 20px";
      case "grid": return "linear-gradient(" + b + " 1px,transparent 1px) 0 0/30px 30px,linear-gradient(90deg," + b + " 1px,transparent 1px) 0 0/30px 30px";
      case "lines": return "repeating-linear-gradient(0deg," + b + " 0 1px,transparent 1px 24px)";
      case "columns": return "repeating-linear-gradient(90deg," + b + " 0 1px,transparent 1px 72px)";
      case "diagonal": return "repeating-linear-gradient(45deg," + b + " 0 2px,transparent 2px 18px)";
      case "cross": return svg(34, 34, "<path d='M17 11v12M11 17h12' " + L + "/>");
      case "waves": return svg(80, 24, "<path d='M0 12c10-12 30-12 40 0s30 12 40 0' " + L + "/>");
      case "rings": return svg(72, 72, "<circle cx='36' cy='36' r='10' " + L + "/><circle cx='36' cy='36' r='22' " + L + "/><circle cx='36' cy='36' r='34' " + L + "/>");
      case "topo": return svg(160, 120, "<path d='M-10 30c40-30 70 20 110-5s50 10 70 0M-10 60c30-18 60 22 100 0s60-20 80 5M-10 92c45-25 75 18 115-4s45 6 65-6' " + L + "/><path d='M40 8c18 10 34 8 50-2M30 112c22-12 44-8 66 2' " + L + "/>");
      case "gingham": return "linear-gradient(" + b + " 50%,transparent 50%) 0 0/32px 32px,linear-gradient(90deg," + b + " 50%,transparent 50%) 0 0/32px 32px";
      case "stripes": return "repeating-linear-gradient(90deg," + b + " 0 26px,transparent 26px 52px)";
      case "mesh": return "radial-gradient(60% 90% at 12% 8%," + RGBA(K.c1, K.dark ? 0.5 : 0.32) + ",transparent 62%),radial-gradient(55% 80% at 92% 96%," + c + ",transparent 60%),radial-gradient(40% 60% at 70% 20%," + RGBA(K.c2, 0.16) + ",transparent 60%)";
      case "grain": return svg(160, 160, "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 " + (K.dark ? 1 : 0) + " 0 0 0 0 " + (K.dark ? 1 : 0) + " 0 0 0 0 " + (K.dark ? 1 : 0) + " 0 0 0 " + (K.dark ? 0.22 : 0.3) + " 0'/></filter><rect width='160' height='160' filter='url(#n)'/>");
    }
    return "";
  }
  /** The page's own moving background (Theme & layout → Style): in the hero, or fixed behind the whole page. */
  var pageAnim = null;
  function pageBg(opts, root) {
    var th = (opts.c && opts.c.theme) || {}, kind = ANIMS[th.animBg] ? th.animBg : "", where = th.animBgWhere === "page" ? "page" : "hero";
    var sig = kind + "|" + where + "|" + (th.animBgSpeed || "") + "|" + (th.animBgStrength || "");
    var heroOwn = opts.bgs && opts.bgs.hero && opts.bgs.hero.on && opts.bgs.hero.kind !== "none";
    var hero = kind && where === "hero" && !heroOwn ? (root.querySelector("#hero") || root.querySelector('[data-sec="hero"]') || root.querySelector("section.hero,.hero") || root.querySelector("main section,section")) : null;
    if (pageAnim && pageAnim.sig === sig && pageAnim.host.isConnected && (where === "page" || pageAnim.host.parentNode === hero)) return;
    if (pageAnim) { pageAnim.a.stop(); pageAnim.host.remove(); if (pageAnim.el) pageAnim.el.classList.remove("has-pbg"); document.documentElement.classList.remove("fx-pbg"); pageAnim = null; }
    if (!kind) return;
    if (!document.getElementById("fx-pbg")) { var st3 = document.createElement("style"); st3.id = "fx-pbg"; st3.textContent = ".has-pbg{isolation:isolate;position:relative}.fx-pbgl{position:absolute;inset:0;z-index:-1;overflow:hidden;pointer-events:none;border-radius:inherit}html.fx-pbg{background:var(--fx-pbg)}html.fx-pbg body{background:transparent!important}.fx-pbgl[data-where=page]{position:fixed;z-index:-1}@media print{.fx-pbgl{display:none}}"; document.head.appendChild(st3); }
    var host = document.createElement("div"); host.className = "fx-pbgl"; host.setAttribute("aria-hidden", "true"); host.setAttribute("data-where", where);
    var o = { speed: th.animBgSpeed, strength: th.animBgStrength };
    if (where === "page") {
      var bgc = getComputedStyle(document.body).backgroundColor; if (!rgbOf(bgc)) bgc = getComputedStyle(document.documentElement).backgroundColor;
      if (rgbOf(bgc)) { document.documentElement.style.setProperty("--fx-pbg", bgc); o.bg = bgc; }
      document.body.appendChild(host); document.documentElement.classList.add("fx-pbg");
      pageAnim = { sig: sig, host: host, el: null, a: animMount(host, kind, o) };
    } else {
      if (!hero) return;
      if (getComputedStyle(hero).position === "static") hero.classList.add("has-pbg"); else hero.style.isolation = "isolate";
      hero.insertBefore(host, hero.firstChild);
      pageAnim = { sig: sig, host: host, el: hero, a: animMount(host, kind, o) };
    }
  }
  /** Brand → Logo motion: a quiet movement on the site's logo (in the menu and above the hero), all the time, once
   *  when the page opens, or when pointed at. Still for visitors who ask their device for less motion. */
  var LOGO_ANIMS = { float: 3.4, pulse: 2.6, spin: 9, swing: 2.8, bounce: 2.4, flip: 4.5, jelly: 2.2, glow: 2.8, shine: 3.6, heartbeat: 1.8, wobble: 2.4, tada: 2.6, rubber: 2.4, tilt: 5, drop: 4, pop: 3.2, neon: 3.4, hue: 6, glitch: 3.2 };
  function logoMotion(opts, root) {
    var B = (opts.c && opts.c.brand) || {}, kind = LOGO_ANIMS[B.logoAnim] ? B.logoAnim : "", on = B.logoAnimOn === "hover" || B.logoAnimOn === "load" ? B.logoAnimOn : "", sp = B.logoAnimSpeed === "slow" ? 1.6 : B.logoAnimSpeed === "lively" ? 0.6 : 1;
    Array.prototype.forEach.call(document.querySelectorAll("[data-la]"), function (n) { n.removeAttribute("data-la"); n.removeAttribute("data-la-on"); n.style.animationDuration = ""; });
    if (!kind || RM) return;
    if (!document.getElementById("fx-la")) {
      var st4 = document.createElement("style"); st4.id = "fx-la";
      st4.textContent = "@keyframes la-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-12%)}}@keyframes la-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}@keyframes la-spin{to{transform:rotate(360deg)}}" +
        "@keyframes la-swing{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(8deg)}}@keyframes la-bounce{0%,100%{transform:translateY(0)}30%{transform:translateY(-24%)}50%{transform:translateY(0)}65%{transform:translateY(-10%)}80%{transform:translateY(0)}}" +
        "@keyframes la-flip{0%,55%{transform:perspective(420px) rotateY(0)}85%,100%{transform:perspective(420px) rotateY(360deg)}}@keyframes la-jelly{0%,100%{transform:scale(1,1)}25%{transform:scale(1.14,.88)}50%{transform:scale(.9,1.1)}75%{transform:scale(1.06,.95)}}" +
        "@keyframes la-glow{0%,100%{filter:drop-shadow(0 0 0 rgba(0,0,0,0))}50%{filter:drop-shadow(0 0 10px var(--c1,var(--accent,#5b7cff)))}}@keyframes la-shine{0%,62%,100%{filter:brightness(1) saturate(1)}78%{filter:brightness(1.7) saturate(1.25)}}" +
        "@keyframes la-heartbeat{0%,40%,100%{transform:scale(1)}10%{transform:scale(1.16)}20%{transform:scale(1)}30%{transform:scale(1.1)}}@keyframes la-wobble{0%,100%{transform:translateX(0) rotate(0)}15%{transform:translateX(-9%) rotate(-6deg)}30%{transform:translateX(7%) rotate(4deg)}45%{transform:translateX(-5%) rotate(-3deg)}60%{transform:translateX(3%) rotate(2deg)}75%{transform:translateX(-1%) rotate(-1deg)}}@keyframes la-tada{0%,55%,100%{transform:scale(1) rotate(0)}6%,12%{transform:scale(.9) rotate(-4deg)}18%,30%,42%{transform:scale(1.14) rotate(4deg)}24%,36%{transform:scale(1.14) rotate(-4deg)}}@keyframes la-rubber{0%,60%,100%{transform:scale(1,1)}15%{transform:scale(1.25,.75)}24%{transform:scale(.78,1.22)}33%{transform:scale(1.14,.86)}42%{transform:scale(.95,1.05)}50%{transform:scale(1.04,.96)}}@keyframes la-tilt{0%,100%{transform:perspective(380px) rotateX(14deg) rotateY(0)}25%{transform:perspective(380px) rotateX(0) rotateY(18deg)}50%{transform:perspective(380px) rotateX(-14deg) rotateY(0)}75%{transform:perspective(380px) rotateX(0) rotateY(-18deg)}}@keyframes la-drop{0%{transform:translateY(-70%) scale(1,1);opacity:0}12%{transform:translateY(0) scale(1,1);opacity:1}17%{transform:translateY(0) scale(1.16,.8)}23%{transform:translateY(-14%) scale(.96,1.05)}30%,100%{transform:translateY(0) scale(1,1);opacity:1}}@keyframes la-pop{0%{transform:scale(.4);opacity:0}12%{transform:scale(1.18);opacity:1}18%{transform:scale(.94)}24%,100%{transform:scale(1);opacity:1}}@keyframes la-neon{0%,18%,22%,25%,53%,57%,100%{opacity:1;filter:drop-shadow(0 0 3px var(--c1,var(--accent,#5b7cff))) drop-shadow(0 0 11px var(--c1,var(--accent,#5b7cff)))}20%,24%,55%{opacity:.45;filter:none}}@keyframes la-hue{from{filter:hue-rotate(0deg)}to{filter:hue-rotate(360deg)}}@keyframes la-glitch{0%,6%,42%,48%,100%{transform:none;filter:none;clip-path:none}1%{transform:translate(-5%,2%) skewX(-8deg);filter:hue-rotate(80deg) saturate(1.6)}2.5%{transform:translate(5%,-2%) skewX(6deg);clip-path:inset(12% 0 46% 0)}4%{transform:translate(-3%,0);clip-path:inset(58% 0 8% 0);filter:hue-rotate(-70deg) saturate(1.6)}43.5%{transform:translate(4%,1%) skewX(5deg);filter:hue-rotate(60deg)}45.5%{transform:translate(-4%,-1%);clip-path:inset(30% 0 30% 0)}}" +
        "[data-la]{transform-origin:50% 50%;animation-timing-function:ease-in-out;animation-iteration-count:infinite;will-change:transform}[data-la=spin],[data-la=hue]{animation-timing-function:linear}[data-la=glitch]{animation-timing-function:steps(1,end)}[data-la=swing]{transform-origin:50% 0}" +
        Object.keys(LOGO_ANIMS).map(function (k) { return "[data-la=" + k + "]:not([data-la-on=hover]),a:hover [data-la=" + k + "][data-la-on=hover],[data-la=" + k + "][data-la-on=hover]:hover{animation-name:la-" + k + "}"; }).join("") +
        "[data-la][data-la-on=load]{animation-iteration-count:2}@media (prefers-reduced-motion:reduce){[data-la]{animation:none!important}}";
      document.head.appendChild(st4);
    }
    var seen = [];
    Array.prototype.forEach.call(document.querySelectorAll("header .brand .logo, header .brand .mark, nav .brand .logo, nav .brand .mark, .brand > .logo, .brand > .mark, .vx-logo, header .logo, .site-hero-logo > img, .site-hero-logo > video"), function (n) {
      if (seen.some(function (x) { return x.contains(n) || n.contains(x); }) || n.closest("footer,[hidden]")) return;
      seen.push(n); n.setAttribute("data-la", kind); if (on) n.setAttribute("data-la-on", on); n.style.animationDuration = (LOGO_ANIMS[kind] * sp).toFixed(2) + "s";
      if (getComputedStyle(n).display === "inline") n.style.display = "inline-block";
    });
  }
  function sectionBgs(opts, root) {
    var map = opts.bgs; if (!map || typeof map !== "object") return;
    var url = opts.asset || function (v) { return v && (v.url || v.path) || ""; };
    if (!Object.keys(map).some(function (x) { return map[x] && (map[x].on || map[x].align); })) return;
    if (!document.getElementById("fx-sbg")) { var st2 = document.createElement("style"); st2.id = "fx-sbg"; st2.textContent = SBG_CSS; document.head.appendChild(st2); }
    Object.keys(map).forEach(function (key) {
      var k = map[key]; if (!k || !(k.on || k.align)) return;
      var el = null; try { el = root.querySelector("#" + (window.CSS && CSS.escape ? CSS.escape(key) : key)) || root.querySelector('[data-sec="' + key + '"]'); } catch (e) { /* odd key */ }
      if (!el && key === "hero") el = root.querySelector("section.hero,.hero,#top");
      if (!el && key === "footer") el = root.querySelector("footer");
      if (!el) return;
      if (/^(left|center|right)$/.test(k.align || "")) { el.setAttribute("data-salign", k.align); try { sectionAlign(el); } catch (e) { /* the text is still aligned */ } }
      if (!k.on) return;
      var pics = k.kind === "slides" && Array.isArray(k.slides) ? k.slides.map(function (x) { return url(x); }).filter(Boolean) : [];
      var kind = k.kind === "image" || k.kind === "video" ? k.kind : pics.length > 1 ? "slides" : "color", src = kind === "image" ? url(k.image) : kind === "video" ? url(k.video) || vlink(k.videoUrl) : kind === "slides" ? pics[0] : pics[0] || "";
      if (k.kind === "slides" && pics.length === 1) kind = "image";
      if (k.kind === "anim" && ANIMS[k.anim]) kind = "anim"; else if (k.kind === "pattern" && PATTERNS[k.pattern]) kind = "pattern";
      var col = /^(#[0-9a-f]{3,8}|rgba?\([0-9., %]+\))$/i.test(String(k.color || "").trim()) ? String(k.color).trim() : "";
      if (kind !== "color" && kind !== "anim" && kind !== "pattern" && !src) kind = "color";
      var old = el.querySelector(":scope > .sbg"); if (old) { if (old.__ab) old.__ab.stop(); old.remove(); } var oldc = el.querySelector(":scope > .sbg-ctl"); if (oldc) oldc.remove();
      el.classList.add("has-sbg");
      try { sectionText(el, k, opts); } catch (e) { /* the text keeps the theme's look */ }
      if (k.kind === "none" || (kind === "color" && !col)) return;
      el.setAttribute("data-sbg", kind);
      // Clean up what an earlier pass put away (the owner may have switched the background off since), then put away the layout's own.
      Array.prototype.forEach.call(el.querySelectorAll(".fx-sbg-hide"), function (n) { n.classList.remove("fx-sbg-hide"); }); el.removeAttribute("data-sbg-nobefore"); el.removeAttribute("data-sbg-noafter");
      try { hideCovers(el); } catch (e) { /* the layout's graphic stays */ }
      if (col) { el.style.setProperty("--sbg", col); el.setAttribute("data-sbg-c", ""); }
      if (k.text === "light" || k.text === "dark") el.setAttribute("data-sbg-text", k.text);
      var cs = getComputedStyle(el);
      if (cs.position === "static") el.style.position = "relative";
      // Left on automatic: when the theme's text would be hard to read on the chosen colour, light or dark text is picked.
      if (!k.text && (kind === "color" || ((kind === "anim" || kind === "pattern") && col))) {
        var lum = function (c) { var m = /rgba?\(([^)]+)\)/.exec(c || ""); if (!m) return null; var v = m[1].split(",").slice(0, 3).map(function (x) { x = parseFloat(x) / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
        var lb = lum(cs.backgroundColor), lt = lum(cs.color);
        if (lb !== null && lt !== null && (Math.max(lb, lt) + 0.05) / (Math.min(lb, lt) + 0.05) < 3.5) el.setAttribute("data-sbg-text", lb < 0.4 ? "light" : "dark");
      }
      if (kind === "color") return;
      var box = document.createElement("div"); box.className = "sbg fx-skip"; box.setAttribute("aria-hidden", "true");
      var blur = Math.max(0, Math.min(40, Number(k.blur) || 0)); if (blur) { box.setAttribute("data-blur", ""); box.style.setProperty("--sbl", blur + "px"); }
      if (kind === "anim" || kind === "pattern") { /* drawn below, once it is in the page (it reads the colours around it) */ }
      else if (kind === "slides") {
        box.setAttribute("data-slides", k.slideFx === "zoom" || k.slideFx === "slide" ? k.slideFx : "fade");
        var ims = pics.map(function (u, n) { var x = document.createElement("img"); x.alt = ""; x.decoding = "async"; if (n > 1) x.loading = "lazy"; x.src = u; if (!n) x.className = "on"; box.appendChild(x); return x; });
        if (!RM) { var at = 0, secs = Math.max(2, Math.min(20, Number(k.slideSecs) || 5));
          var tick = setInterval(function () { if (!box.isConnected) { clearInterval(tick); return; } if (document.hidden) return; ims.forEach(function (x) { x.classList.remove("was"); }); ims[at].classList.remove("on"); ims[at].classList.add("was"); at = (at + 1) % ims.length; ims[at].classList.add("on"); }, secs * 1000); }
      } else
      if (kind === "image") { var im = document.createElement("img"); im.alt = ""; im.decoding = "async"; im.loading = "lazy"; im.src = src; box.appendChild(im); }
      else {
        var yt = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/i.exec(src), vm = /vimeo\.com\/(?:video\/)?(\d{6,12})/i.exec(src), lp = !k.videoOnce, go = RM ? 0 : 1, ctl = null;
        if (yt || vm) {
          var fr = document.createElement("iframe"); fr.title = "Background video"; fr.setAttribute("tabindex", "-1"); fr.setAttribute("allow", "autoplay; encrypted-media"); fr.setAttribute("referrerpolicy", "strict-origin-when-cross-origin"); fr.loading = "lazy";
          fr.src = yt ? "https://www.youtube-nocookie.com/embed/" + yt[1] + "?autoplay=" + go + "&mute=1&controls=0&disablekb=1&fs=0&modestbranding=1&rel=0&playsinline=1&iv_load_policy=3&enablejsapi=1" + (lp ? "&loop=1&playlist=" + yt[1] : "") : "https://player.vimeo.com/video/" + vm[1] + "?background=1&autoplay=" + go + "&muted=1&dnt=1&loop=" + (lp ? 1 : 0);
          box.setAttribute("data-embed", ""); box.appendChild(fr);
          var say = function (f, a2) { try { fr.contentWindow.postMessage(yt ? JSON.stringify({ event: "command", func: f, args: a2 || "" }) : JSON.stringify(a2 === undefined ? { method: f } : { method: f, value: a2 }), "*"); } catch (e) { /* the player is not ready */ } };
          ctl = { play: function () { say(yt ? "playVideo" : "play"); }, pause: function () { say(yt ? "pauseVideo" : "pause"); }, mute: function (m) { if (yt) say(m ? "mute" : "unMute"); else say("setVolume", m ? 0 : 1); } };
        } else {
          var v = document.createElement("video"); v.muted = true; v.loop = lp; v.playsInline = true; v.setAttribute("muted", ""); v.setAttribute("playsinline", ""); v.preload = "metadata"; if (!RM) v.autoplay = true; var poster = url(k.image); if (poster) v.poster = poster; v.src = src; box.appendChild(v); if (!RM) { var pl = v.play(); if (pl && pl.catch) pl.catch(function () {}); }
          ctl = { play: function () { var q = v.play(); if (q && q.catch) q.catch(function () {}); }, pause: function () { v.pause(); }, mute: function (m) { v.muted = m; } };
        }
        if (k.videoControls && ctl) {
          var bar = document.createElement("div"); bar.className = "sbg-ctl fx-skip"; var playing = !RM, muted = true;
          var pb = document.createElement("button"), mb = document.createElement("button"); pb.type = mb.type = "button";
          var paint = function () { pb.textContent = playing ? "❚❚" : "▶"; pb.setAttribute("aria-label", playing ? "Pause the background video" : "Play the background video"); mb.textContent = muted ? "🔇" : "🔊"; mb.setAttribute("aria-label", muted ? "Turn the sound on" : "Turn the sound off"); };
          pb.onclick = function () { playing = !playing; if (playing) ctl.play(); else ctl.pause(); paint(); };
          mb.onclick = function () { muted = !muted; ctl.mute(muted); if (!muted && !playing) { playing = true; ctl.play(); } paint(); };
          bar.appendChild(pb); bar.appendChild(mb); paint(); box.__ctl = bar;
        }
      }
      var dim = Math.max(0, Math.min(95, Number(k.dim) || 0));
      var ov = null, veil = function (white, a) { if (a <= 0) { if (ov) { ov.remove(); ov = null; } return; } if (!ov) { ov = document.createElement("i"); box.appendChild(ov); } ov.style.background = (white ? "rgba(255,255,255," : "rgba(0,0,0,") + Math.round(a * 100) / 100 + ")"; };
      veil(k.shade ? k.shade === "light" : k.text === "dark", dim / 100);
      // Text left on automatic over a picture, slideshow or video: the picture decides. A dark or mid-toned one gets light text, a bright
      // one dark text, and (with the backdrop on automatic too) just enough backdrop is laid over it for the text to read well. Until the
      // picture has been looked at, or when it can't be (a video, a picture from another site), it is treated as mid-toned.
      if (!k.text && (kind === "image" || kind === "slides" || kind === "video")) {
        var decide = function (L, sd) {
          if (k.shade === "light" || k.shade === "dark") { var a0 = dim / 100, Ld = k.shade === "light" ? L + (1 - L) * a0 : L * (1 - a0); el.setAttribute("data-sbg-text", Ld < 0.4 ? "light" : "dark"); tidy(Ld >= 0.4, Ld); return; }
          var dark = L >= 0.6, hi = Math.min(1, L + sd / 2), lo = Math.max(0, L - sd / 2);
          var need = dark ? (lo >= 0.3 ? 0 : (0.3 - lo) / (1 - lo)) : (hi <= 0.16 ? 0 : 1 - 0.16 / hi);
          var a1 = Math.min(0.72, Math.max(dim / 100, need)); veil(dark, a1);
          el.setAttribute("data-sbg-text", dark ? "dark" : "light");
          tidy(dark, dark ? lo + (1 - lo) * a1 : hi * (1 - a1));
        };
        // Small labels in the theme's accent colour (an eyebrow, a number) don't follow the text colour: any that would now be hard to
        // read on the picture is given the text's own soft tone. Text on its own card or button is left alone.
        var tidy = function (dark, Lbg) {
          requestAnimationFrame(function () {
            try {
              // a computed colour as [r, g, b, alpha]: "rgb(…)", "rgba(…)" or (from a mix of colours) "color(srgb …)"
              var rgbOf = function (c) { var m = /rgba?\(([^)]+)\)/.exec(c || ""), q; if (m) { q = m[1].split(/[,\/ ]+/).filter(Boolean).map(parseFloat); return [q[0], q[1], q[2], q.length > 3 ? q[3] : 1]; } m = /color\(srgb ([^)]+)\)/.exec(c || ""); if (!m) return null; q = m[1].split(/[\/ ]+/).filter(Boolean).map(parseFloat); return [q[0] * 255, q[1] * 255, q[2] * 255, q.length > 3 ? q[3] : 1]; };
              var lumOf = function (c) { var q = rgbOf(c); if (!q) return null; var al = q[3], g = 255 * (Lbg <= 0.0031308 ? 12.92 * Lbg : 1.055 * Math.pow(Lbg, 1 / 2.4) - 0.055), v = q.slice(0, 3).map(function (x) { x = (x * al + g * (1 - al)) / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
              [].forEach.call(el.querySelectorAll("[data-sbg-fix]"), function (x) { x.style.removeProperty("color"); x.removeAttribute("data-sbg-fix"); });
              var all = el.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,span,small,b,strong,em,a,dt,dd,figcaption,blockquote,label,div"), n = 0;
              for (var i = 0; i < all.length && n < 300; i++) {
                var x = all[i]; if (x.closest(".sbg,.sbg-ctl")) continue;
                var own = false; for (var c = x.firstChild; c; c = c.nextSibling) if (c.nodeType === 3 && c.nodeValue.trim()) { own = true; break; }
                if (!own) continue; n++;
                var onCard = false; for (var u = x; u && u !== el; u = u.parentElement) { var ba = rgbOf(getComputedStyle(u).backgroundColor); if (ba && ba[3] > 0.5) { onCard = true; break; } }
                if (onCard) continue;
                var lt = lumOf(getComputedStyle(x).color); if (lt === null) continue;
                if ((Math.max(lt, Lbg) + 0.05) / (Math.min(lt, Lbg) + 0.05) < 3) { x.style.setProperty("color", dark ? "rgba(20,22,26,.78)" : "rgba(255,255,255,.86)", "important"); x.setAttribute("data-sbg-fix", ""); }
              }
            } catch (e) { /* the labels keep the theme's colour */ }
          });
        };
        decide(0.35, 0.2);
        var look = kind === "video" ? url(k.image) : src;
        if (look && !/youtu\.?be|vimeo\.com/i.test(look)) {
          var pr = new Image(); pr.crossOrigin = "anonymous";
          pr.onload = function () {
            try {
              if (!box.isConnected) return;
              var cv = document.createElement("canvas"), N = 32; cv.width = cv.height = N; var cx = cv.getContext("2d", { willReadFrequently: true }); cx.drawImage(pr, 0, 0, N, N);
              var d = cx.getImageData(0, 0, N, N).data, sum = 0, sq = 0, cnt = 0, lin = function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
              for (var i = 0; i < d.length; i += 4) { if (d[i + 3] < 32) continue; var l = 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]); sum += l; sq += l * l; cnt++; }
              if (cnt) { var mean = sum / cnt; decide(mean, Math.sqrt(Math.max(0, sq / cnt - mean * mean))); }
            } catch (e) { /* the picture can't be read from here: it stays treated as mid-toned */ }
          };
          pr.src = look;
        }
      }
      // Where the picture or video sits in the section (what stays in view when it is cropped).
      var POS = { center: "50% 50%", top: "50% 0%", bottom: "50% 100%", left: "0% 50%", right: "100% 50%", "top-left": "0% 0%", "top-right": "100% 0%", "bottom-left": "0% 100%", "bottom-right": "100% 100%" };
      if (POS[k.pos]) box.style.setProperty("--sbp", POS[k.pos]);
      el.insertBefore(box, el.firstChild); if (box.__ctl) el.appendChild(box.__ctl);
      if (kind === "anim") box.__ab = animMount(box, k.anim, { speed: k.animSpeed, strength: k.animStrength, bg: col });
      else if (kind === "pattern") { var pt = document.createElement("i"); pt.setAttribute("data-pattern", k.pattern); pt.style.background = patternCss(k.pattern, animCols(box, col)); box.insertBefore(pt, box.firstChild); }
      if (k.fixed && kind !== "anim" && !RM) { try { stillBg(box); } catch (e) { /* it scrolls with the section */ } }
    });
  }
  // ---- Legal & privacy (content.legal, content.privacy)
  /** Has the visitor allowed this consent category? Read straight from the saved choice, so it works before consent.js loads. */
  function allowed(c, cat) {
    var K = c && c.consent; if (!K || !K.on || PREVIEW) return true;
    if (window.SiteConsent) { try { var st = window.SiteConsent.state(); if (st && st.asked) return !!st.categories[cat]; } catch (e) { /* not mounted yet */ } }
    if (K.mode === "notice") return true;
    try { var x = JSON.parse(localStorage.getItem("site-consent:" + location.pathname.replace(/[^/]*$/, "")) || "null"); if (x && x.c && (K.version == null || x.v === K.version)) return x.c[cat] === true; } catch (e) { /* no storage */ }
    return K.mode === "optout";
  }
  var fontsWere = null, fontWatch = null;
  /** Google Fonts may load: always, unless the site holds them back until the visitor allows the Preferences category. */
  function fontsOk(c) {
    var ok = !(c && c.privacy && c.privacy.blockFonts) || allowed(c, "preferences");
    fontsWere = ok;
    if (!ok && !fontWatch && window.MutationObserver) {
      // a backstop for fonts asked for by other parts of the page
      var G = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;
      document.querySelectorAll('link[href*="fonts.googleapis.com"],link[href*="fonts.gstatic.com"]').forEach(function (l) { l.remove(); });
      fontWatch = new MutationObserver(function (ms) { if (fontsWere) return; ms.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, function (n) { if (n.tagName === "LINK" && G.test(n.href || "")) n.remove(); }); if (m.type === "attributes" && m.target.tagName === "LINK" && G.test(m.target.href || "")) m.target.removeAttribute("href"); }); });
      fontWatch.observe(document.head, { childList: true, attributes: true, attributeFilter: ["href"], subtree: true });
    }
    return ok;
  }
  var legalCss = false;
  function legalBits(opts, root) {
    var c = opts.c; if (!c) return;
    if (!legalCss) { legalCss = true; var st2 = document.createElement("style"); st2.id = "fx-legal"; st2.textContent = ".legal-id{box-sizing:border-box;width:100%;max-width:1180px;margin:0 auto;padding:14px 20px calc(14px + env(safe-area-inset-bottom,0px));text-align:center;font:400 12.5px/1.6 var(--fb,system-ui,sans-serif);opacity:.78;border-top:1px solid color-mix(in srgb,currentColor 16%,transparent)}.legal-id b{font-weight:600}.legal-id span+span::before{content:'·';margin:0 .55em;opacity:.6}" +
      "label.consent a,.of-consent a,.co-consent a{text-decoration:underline;color:inherit}.of-consent,.co-consent{display:flex;gap:10px;align-items:flex-start;font-size:14px;line-height:1.45;margin:12px 0 4px;cursor:pointer}.of-consent input,.co-consent input{flex:none;width:18px;height:18px;margin-top:2px;accent-color:var(--c1,var(--accent,currentColor))}"; document.head.appendChild(st2); }
    // who runs the site, at the bottom of every page
    var L = c.legal || {}, name = String(L.name || "").trim(), foot = root.querySelector("footer");
    var old = root.querySelector(".legal-id"); if (old) old.remove();
    if (foot && name && L.footer !== false) {
      var bits = [["", name, 1], ["", String(L.address || "").replace(/\s*\n\s*/g, ", ").trim()], ["Phone: ", String(L.phone || "").trim()], ["Email: ", String(L.email || "").trim()], ["GSTIN: ", String(L.gstin || "").trim()], ["CIN: ", String(L.cin || "").trim()]].filter(function (x) { return x[1]; });
      var d = document.createElement("div"); d.className = "legal-id fx-skip"; d.setAttribute("aria-label", "Business details");
      d.innerHTML = bits.map(function (x) { return "<span>" + escHtml(x[0]) + (x[2] ? "<b>" + escHtml(x[1]) + "</b>" : escHtml(x[1])) + "</span>"; }).join("");
      foot.appendChild(d);
    }
    // the consent tick boxes link to the privacy policy
    var url = String(opts.policy || "");
    if (/^(https?:\/\/|[\w.?=&%\/#-]+$)/i.test(url)) Array.prototype.forEach.call(root.querySelectorAll("label.consent span,.of-consent span,.co-consent span"), function (sp) {
      if (sp.querySelector("a")) return; var t = sp.textContent, m = /privacy policy/i.exec(t), a = document.createElement("a"); a.href = url; a.target = "_blank"; a.rel = "noopener";
      if (m) { a.textContent = m[0]; sp.textContent = ""; sp.appendChild(document.createTextNode(t.slice(0, m.index))); sp.appendChild(a); sp.appendChild(document.createTextNode(t.slice(m.index + m[0].length))); }
      else { a.textContent = "Privacy policy"; sp.appendChild(document.createTextNode(" ")); sp.appendChild(a); }
    });
    // fonts held back: draw again with them once the visitor allows it
    if (opts.again && !legalBits.on) { legalBits.on = true; addEventListener("site:consent", function () { var c2 = legalBits.c; if (c2 && c2.privacy && (c2.privacy.blockFonts || c2.privacy.blockMaps) && fontsWere === false && allowed(c2, "preferences")) { fontsWere = true; try { legalBits.again(); } catch (e) { /* next page load */ } } }); }
    legalBits.c = c; legalBits.again = opts.again;
  }
  // ---- Accessibility check, asked for by the editor: looks at the page as drawn and answers with what it found.
  function a11yScan() {
    var out = [], seen = 0, add = function (kind, text, el) { if (out.length < 40 && !out.some(function (o) { return o.text === text && o.where === w(el); })) out.push({ kind: kind, text: text, where: w(el) }); };
    var w = function (el) { if (!el) return ""; var t = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("alt") || el.getAttribute("src") || "").replace(/\s+/g, " ").trim().slice(0, 48), sec = el.closest("section[id],footer,header,nav"); return (sec ? (sec.id || sec.tagName.toLowerCase()) + ": " : "") + (t ? "“" + t + "”" : el.tagName.toLowerCase()); };
    var vis = function (el) { if (!el.getClientRects().length) return false; var cs = getComputedStyle(el); return cs.visibility !== "hidden" && cs.display !== "none" && parseFloat(cs.opacity) > 0.05; };
    var parse = function (c) { var m = /rgba?\(([^)]+)\)/.exec(c || ""); if (!m) return null; var v = m[1].split(/[,\/ ]+/).filter(Boolean).map(parseFloat); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
    var lum = function (c) { var f = function (x) { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
    // the colour behind an element: the nearest solid background; a picture, video or gradient behind it cannot be judged
    var behind = function (el) { var q = el.getBoundingClientRect(), cx = q.left + q.width / 2, cy = q.top + q.height / 2;
      for (var e = el; e && e.nodeType === 1; e = e.parentElement) { var cs = getComputedStyle(e); if (cs.backgroundImage && cs.backgroundImage !== "none") return null;
        // a picture or video lying under the text (a card with a photo behind its title)
        if (e !== el) { for (var ps = 0; ps < 2; ps++) { var pc = getComputedStyle(e, ps ? "::after" : "::before"); if (pc && pc.content && pc.content !== "none" && pc.position === "absolute" && ((pc.backgroundImage && pc.backgroundImage !== "none") || ((parse(pc.backgroundColor) || { a: 0 }).a > 0.05))) return null; }
          for (var k2 = 0; k2 < e.children.length && k2 < 20; k2++) { var ch = e.children[k2]; if (ch === el || ch.contains(el)) continue; var cc = getComputedStyle(ch); if (cc.position !== "absolute" && cc.position !== "fixed") continue; var cr = ch.getBoundingClientRect(); if (cr.width > 40 && cx >= cr.left && cx <= cr.right && cy >= cr.top && cy <= cr.bottom && cc.display !== "none") return null; }
          var media = e.querySelectorAll("img,video,canvas"); for (var n = 0; n < media.length && n < 12; n++) { if (el.contains(media[n])) continue; var r = media[n].getBoundingClientRect(); if (r.width > 40 && cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) return null; } } if (e.classList.contains("has-sbg") && e.getAttribute("data-sbg") && e.getAttribute("data-sbg") !== "color") return null; var b = parse(cs.backgroundColor); if (b && b.a > 0.95) return b; if (b && b.a > 0.05) return null; } return { r: 255, g: 255, b: 255, a: 1 }; };
    var lowText = 0;
    Array.prototype.forEach.call(document.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,a,button,label,span,td,th,small,summary,blockquote,figcaption,dt,dd"), function (el) {
      if (el.closest(".fx-skip,[aria-hidden=true],#site-consent,#site-code-bar,.sbg") || !vis(el)) return;
      var own = Array.prototype.some.call(el.childNodes, function (n) { return n.nodeType === 3 && n.nodeValue.trim().length > 1; }); if (!own) return;
      seen++; var cs = getComputedStyle(el), fg = parse(cs.color), bg = behind(el); if (!fg || !bg || fg.a < 0.5) return;
      var l1 = lum(fg), l2 = lum(bg), ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05), size = parseFloat(cs.fontSize), big = size >= 24 || (size >= 18.5 && parseInt(cs.fontWeight, 10) >= 700);
      if (ratio < (big ? 3 : 4.5)) { lowText++; add("contrast", "Text is hard to read on its background (contrast " + ratio.toFixed(1) + ":1, needs " + (big ? "3" : "4.5") + ":1)", el); }
    });
    Array.prototype.forEach.call(document.querySelectorAll("img"), function (im) { if (im.closest(".fx-skip,[aria-hidden=true],.sbg") || !vis(im)) return; seen++; if (!im.hasAttribute("alt")) add("alt", "A picture has no description for screen readers", im); else if (!im.getAttribute("alt").trim() && im.closest("a,button") && !(im.closest("a,button").textContent || "").trim() && !im.closest("a,button").getAttribute("aria-label")) add("alt", "A picture used as a link or button has no description", im); });
    Array.prototype.forEach.call(document.querySelectorAll("a[href],button,[role=button]"), function (el) { if (el.closest(".fx-skip,[aria-hidden=true],#site-consent") || !vis(el)) return; seen++; var nm = (el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || "").trim() || Array.prototype.map.call(el.querySelectorAll("img[alt]"), function (i) { return i.alt; }).join("").trim() || (el.getAttribute("aria-labelledby") ? "x" : ""); if (!nm) add("name", "A " + (el.tagName === "A" ? "link" : "button") + " has no name a screen reader can say", el); });
    Array.prototype.forEach.call(document.querySelectorAll("input:not([type=hidden]):not([type=submit]):not([type=button]),select,textarea"), function (el) { if (el.closest(".fx-skip,[aria-hidden=true],#site-consent") || el.classList.contains("hp-f") || !vis(el)) return; seen++; var ok = el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.closest("label") || (el.id && document.querySelector('label[for="' + el.id.replace(/"/g, "") + '"]')) || el.getAttribute("title"); if (!ok) add("label", "A form box has no label" + (el.getAttribute("placeholder") ? " (a placeholder is not a label)" : ""), el); });
    var hs = Array.prototype.filter.call(document.querySelectorAll("h1,h2,h3,h4,h5,h6"), function (h) { return vis(h) && !h.closest(".fx-skip,[aria-hidden=true]"); }), h1 = hs.filter(function (h) { return h.tagName === "H1"; });
    if (!h1.length) add("heading", "The page has no main heading (h1)", null); else if (h1.length > 1) add("heading", "The page has " + h1.length + " main headings (h1); one is best", h1[1]);
    for (var i = 1; i < hs.length; i++) { var a = +hs[i - 1].tagName[1], b = +hs[i].tagName[1]; if (b > a + 1) { add("heading", "A heading skips a level (h" + a + " then h" + b + ")", hs[i]); break; } }
    if (!document.documentElement.getAttribute("lang")) add("lang", "The page does not say which language it is in", null);
    if (!document.title.trim()) add("title", "The page has no title for the browser tab", null);
    Array.prototype.forEach.call(document.querySelectorAll("[tabindex]"), function (el) { if (+el.getAttribute("tabindex") > 0 && vis(el)) add("keyboard", "An element changes the keyboard's Tab order (tabindex above 0)", el); });
    Array.prototype.forEach.call(document.querySelectorAll("[onclick],div[role=button],span[role=button]"), function (el) { if (vis(el) && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA|SUMMARY|LABEL)$/.test(el.tagName) && !el.hasAttribute("tabindex")) add("keyboard", "Something that is clicked cannot be reached with the keyboard", el); });
    return { issues: out, seen: seen };
  }
  if (PREVIEW) addEventListener("message", function (e) {
    if (e.origin !== location.origin || e.source !== window.parent || !e.data || e.data.type !== "cms:a11y") return;
    var r; try { r = a11yScan(); } catch (x) { r = { issues: [{ kind: "error", text: "The check could not finish on this page.", where: String(x && x.message || x).slice(0, 80) }], seen: 0 }; }
    window.parent.postMessage({ type: "cms:a11y", page: (location.pathname.split("/").pop() || "index.html") + location.search, issues: r.issues, seen: r.seen }, location.origin);
  });

  // Frosted glass (iPhone-style): drifting colour light behind translucent, blurred surfaces. Active on html[data-pattern=glass].
  var GLASS_SEL = ".card,.hp-card,.dish,.offer,.order-box,.mbar,.pcard,.box,.sum,.quote,.wcard,.ocard,.ctaband,.cat,.tile,.proj,.stat,.rv-c,.rv-top,.rv-form,.faq-item,.plan,.price,.pkg";
  var GLASS_CSS = "html[data-pattern=glass]{--g1:var(--c1,var(--accent,#6a7cff));--g2:var(--c2,var(--accent2,#ff7ab8));--g3:var(--c3,var(--c2,var(--accent2,#6ee7d8)));background:var(--bg)}" +
    "html[data-pattern=glass] body{background:transparent!important}" +
    "html[data-pattern=glass]::before{content:'';position:fixed;inset:-12%;z-index:-1;pointer-events:none;background:radial-gradient(34% 34% at 18% 22%,color-mix(in srgb,var(--g1) 62%,transparent),transparent 70%),radial-gradient(30% 30% at 82% 16%,color-mix(in srgb,var(--g2) 55%,transparent),transparent 70%),radial-gradient(36% 36% at 70% 84%,color-mix(in srgb,var(--g3) 50%,transparent),transparent 70%),radial-gradient(28% 28% at 12% 88%,color-mix(in srgb,var(--g2) 40%,transparent),transparent 70%);filter:blur(30px) saturate(1.3);animation:fx-glassdrift 26s ease-in-out infinite alternate}" +
    "@keyframes fx-glassdrift{to{transform:translate3d(3%,-3%,0) scale(1.08) rotate(4deg)}}" +
    "html[data-pattern=glass] .band:not(.has-sbg){background:transparent!important}" +
    "html[data-pattern=glass] .plane{display:none!important}" +
    "html[data-pattern=glass] :is(" + GLASS_SEL + "){background:color-mix(in srgb,var(--surface) 46%,transparent)!important;-webkit-backdrop-filter:blur(26px) saturate(1.8);backdrop-filter:blur(26px) saturate(1.8);border:1px solid rgba(255,255,255,.55)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.65),0 12px 40px -12px rgba(20,24,60,.28)!important}" +
    "html[data-pattern=glass][data-glass=dark] :is(" + GLASS_SEL + "){background:color-mix(in srgb,var(--surface) 38%,transparent)!important;border-color:rgba(255,255,255,.16)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.22),0 14px 44px -14px rgba(0,0,0,.6)!important}" +
    "html[data-pattern=glass] :is(.nav,.hdr){background:color-mix(in srgb,var(--bg) 40%,transparent)!important;-webkit-backdrop-filter:blur(26px) saturate(1.8);backdrop-filter:blur(26px) saturate(1.8);box-shadow:inset 0 -1px 0 rgba(255,255,255,.35)}" +
    "@media(prefers-reduced-motion:reduce){html[data-pattern=glass]::before{animation:none}}";
  function glassMode() {
    if (doc.getAttribute("data-pattern") !== "glass") { doc.removeAttribute("data-glass"); return; }
    if (!document.getElementById("fx-glass")) { var g = document.createElement("style"); g.id = "fx-glass"; g.textContent = GLASS_CSS; document.head.appendChild(g); }
    doc.setAttribute("data-glass", isDark() ? "dark" : "light");
  }
  function init(opts) {
    opts = opts || {};
    var root = opts.root || document.body;
    try { legalBits(opts, root); } catch (e) { /* never worth a broken page */ }
    try { sectionBgs(opts, root); } catch (e) { /* a background is never worth a broken page */ }
    try { customCode(opts.c, root); } catch (e) { /* the page stays as the template draws it */ }
    try { siteAnalytics(opts.c); } catch (e) { /* counting never breaks the page */ }
    try { pageBg(opts, root); } catch (e) { /* a background is never worth a broken page */ }
    try { logoMotion(opts, root); } catch (e) { /* nor is a moving logo */ }
    try { glassMode(); } catch (e) {}
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

    unboot();
    // entrance: page cover from the previous page, or the theme's loader
    // The entrance plays once per page load: a later render of the same page (after the database answers, a sign-in, a language change) keeps what is already shown instead of playing it again.
    var animate = !RM && (PREVIEW ? changed : !st.animated), delay = 0; if (animate && !PREVIEW) st.animated = true;
    if (cover && c.loader !== "none" && !RM) {
      // Arriving from another page of the site: the panels are already closed, so play the site's full intro
      // (the name rises in letter by letter, then the panels open) exactly as on the first visit.
      var cv = cover; cover = null; st.loaderPlayed = true;
      playLoader(c.loader, opts.brand || document.title);
      requestAnimationFrame(function () { requestAnimationFrame(function () { cv.remove(); }); });
      delay = c.loader === "counter" ? 1250 : 950;
    }
    // A signature theme with its own preloader is already on screen: the waiting panel just goes.
    else if (cover && document.getElementById("vxLoad")) { cover.remove(); cover = null; st.loaderPlayed = true; }
    else if (cover) { st.loaderPlayed = true; revealCover(); delay = 350; }
    else if (c.loader !== "none" && !skipIntro(c) && !RM) {
      var play = PREVIEW ? c.loader !== st.loader : !st.loaderPlayed && Date.now() - T0 < 5000;
      if (play) { st.loaderPlayed = true; if (c.loaderOn === "load") try { sessionStorage.setItem("fx-intro-seen", "1"); } catch (x) {} playLoader(c.loader, opts.brand || document.title); delay = c.loader === "counter" ? 1250 : 950; }
    }
    st.loader = c.loader;
    // Remembered on this device, so the next visit starts on the intro's panel (see skeleton()).
    if (!PREVIEW) try { var ik = "site-intro:" + location.pathname.replace(/[^/]*$/, ""); var vxl = document.getElementById("vxLoad"); if (c.loader !== "none" && c.loaderOn === "menu") localStorage.removeItem(ik); else if (c.loader !== "none") { var ic = colors(); localStorage.setItem(ik, JSON.stringify({ k: c.loader, bg: ic.deep, fg: ic.on })); } else if (vxl) { st.ownIntro = true; var vcs = getComputedStyle(vxl); localStorage.setItem(ik, JSON.stringify({ k: "curtain", bg: vcs.backgroundColor, fg: vcs.color })); } else if (!st.ownIntro) localStorage.removeItem(ik); } catch (e) {}
    setupText(root, c, animate, delay);
    setupScrollExtras(root, c);
    setupHeroFx(root, c);
    onScroll();
  }

  /* The site's logo above the hero's title (Brand → "Show the logo above the hero title"), for every template: it is
     put in front of the page's first main heading (and the small label above it, when there is one), so it follows
     whichever hero layout the theme draws. o: { size (px high), radius (% corners, square logos), wide, edit, video (an animated logo's address) }. */
  function heroLogo(src, o) {
    o = o || {}; Array.prototype.forEach.call(document.querySelectorAll(".site-hero-logo"), function (n) { n.remove(); });
    if (!src && !o.video) return null;
    var h1 = Array.prototype.filter.call(document.querySelectorAll(o.at || "main h1, #main h1, h1"), function (h) { return !h.closest("header,nav,aside,noscript,footer,[hidden]") && h.getClientRects().length; })[0];
    if (!h1) return null;
    var before = h1, prev = h1.previousElementSibling;
    if (prev && /eyebrow|kicker|pill|tag|chip|label|h-eye|vx-eye/i.test(prev.className || "") && (prev.textContent || "").length < 140) before = prev;
    var size = Math.max(32, Math.min(240, +o.size || 72)), d = document.createElement("div");
    d.className = "site-hero-logo"; if (o.edit) d.setAttribute("data-edit", o.edit);
    d.style.cssText = "display:block;line-height:0;margin:0 0 " + Math.round(size * 0.28 + 8) + "px;position:relative;z-index:2";
    // An animated logo (o.video) plays silently on a loop in the picture's place; the picture is its cover.
    var im = document.createElement(o.video ? "video" : "img");
    if (o.video) { im.muted = true; im.loop = true; im.autoplay = true; im.setAttribute("playsinline", ""); im.setAttribute("muted", ""); if (src) im.poster = src; im.src = o.video; } else { im.src = src; im.alt = ""; }
    im.style.cssText = o.wide ? "height:" + size + "px;width:auto;max-width:min(100%," + size * 5 + "px);object-fit:contain;display:inline-block"
      : "width:" + size + "px;height:" + size + "px;object-fit:cover;display:inline-block;border-radius:" + Math.max(0, Math.min(50, o.radius == null ? 22 : +o.radius)) + "%";
    d.appendChild(im); before.parentNode.insertBefore(d, before);
    return d;
  }
  /* Skeleton loading: the outline of a page (menu bar, headline, picture, cards) shown in an empty page root while
     the site's content is fetched, so a visitor on a slow connection sees the page taking shape instead of a blank
     screen. The template's first render replaces it. Neutral greys, so it sits on any theme's background. */
  function skeleton(root) {
    if (!root || root.firstElementChild) return null;
    // A site with an intro screen: its panel closes at once (in the colours remembered on this device), so the visitor
    // sees the intro from the first moment and never the outline before it. The intro then plays on that same panel.
    if (!cover && !st.bootTried && !RM && !PREVIEW && !skipIntro(cfg())) {
      st.bootTried = true;
      try {
        var m = JSON.parse(localStorage.getItem("site-intro:" + location.pathname.replace(/[^/]*$/, "")) || "null"), okc = /^(#[0-9a-f]{3,8}|rgba?\([0-9., %]+\))$/i;
        // A first visit has nothing remembered: the page itself says whether it has an intro (written in when it was published).
        if (!(m && m.k && okc.test(m.bg || ""))) {
          var hint = document.querySelector('meta[name="site-intro"]'), hp = hint ? String(hint.getAttribute("content") || "").split("|") : null;
          if (hp && hp[0]) { var pbg = okc.test(hp[1] || "") ? hp[1] : getComputedStyle(document.documentElement).backgroundColor; m = okc.test(pbg || "") && !/rgba\(0, 0, 0, 0\)/.test(pbg) ? { k: hp[0], bg: pbg, fg: hp[2] } : null; }
        }
        if (m && m.k && okc.test(m.bg || "")) {
          ensureStyle();
          var bk = m.k === "split" ? "split" : "curtain";
          cover = el("div", "fx-load fx-cover fx-load--" + bk, panels(bk, ""));
          cover.style.setProperty("--fxd", m.bg); cover.style.setProperty("--fxo", okc.test(m.fg || "") ? m.fg : "#fff");
          document.body.appendChild(cover); coverAt = Date.now(); unboot();
          // Content that takes very long: open the panel and show the outline after all.
          setTimeout(function () { if (cover) { revealCover(); skeleton(root); } }, 7000);
          return null;
        }
      } catch (e) {}
    }
    var b = function (st) { return '<i style="' + st + '"></i>'; }, row = function (inner, st) { return '<div style="display:flex;gap:14px;align-items:center;' + (st || "") + '">' + inner + "</div>"; };
    var d = document.createElement("div"); d.className = "site-skel"; d.setAttribute("role", "status"); d.setAttribute("aria-label", "Loading");
    d.innerHTML = "<style>.site-skel{max-width:1200px;margin:0 auto;padding:22px clamp(18px,4vw,32px) 60px;min-height:100vh}.site-skel i{display:block;border-radius:10px;background:linear-gradient(100deg,rgba(128,128,128,.16) 30%,rgba(128,128,128,.3) 50%,rgba(128,128,128,.16) 70%);background-size:220% 100%;animation:site-skel 1.6s ease-in-out infinite}" +
      "@keyframes site-skel{from{background-position:120% 0}to{background-position:-100% 0}}@media (prefers-reduced-motion:reduce){.site-skel i{animation:none}}.site-skel .sk-hero{display:grid;grid-template-columns:1.1fr 1fr;gap:clamp(24px,5vw,64px);align-items:center;margin-top:clamp(40px,8vw,90px)}.site-skel .sk-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:clamp(48px,8vw,96px)}@media (max-width:760px){.site-skel .sk-hero,.site-skel .sk-cards{grid-template-columns:1fr}.site-skel .sk-nav i:nth-child(n+3):not(:last-child){display:none}}</style>" +
      row(b("width:40px;height:40px;border-radius:12px") + b("width:130px;height:16px") + '<span style="flex:1"></span>' + b("width:64px;height:12px") + b("width:64px;height:12px") + b("width:64px;height:12px") + b("width:110px;height:38px;border-radius:99px"), "").replace("<div ", '<div class="sk-nav" ') +
      '<div class="sk-hero"><div>' + b("width:38%;height:12px") + b("width:92%;height:44px;margin-top:22px") + b("width:70%;height:44px;margin-top:12px") + b("width:88%;height:13px;margin-top:28px") + b("width:80%;height:13px;margin-top:10px") + b("width:56%;height:13px;margin-top:10px") +
      row(b("width:150px;height:46px;border-radius:99px") + b("width:120px;height:46px;border-radius:99px"), "margin-top:30px") + "</div>" + b("width:100%;aspect-ratio:5/4;border-radius:22px") + "</div>" +
      '<div class="sk-cards">' + [0, 1, 2].map(function () { return "<div>" + b("width:100%;aspect-ratio:16/10;border-radius:16px") + b("width:70%;height:15px;margin-top:16px") + b("width:92%;height:11px;margin-top:10px") + b("width:60%;height:11px;margin-top:8px") + "</div>"; }).join("") + "</div>";
    root.appendChild(d);
    // If the page never draws into this root (an error, a full-screen notice), the outline doesn't stay forever.
    setTimeout(function () { if (d.parentNode) d.remove(); }, 12000);
    return d;
  }
  /* Custom fonts (Brand & theme → Custom fonts): the owner's own font for headings, body text (and the portfolio's
     signature), from an uploaded file or a link. theme.customFonts[slot] = { file: {path, variable}, link, name }.
     use() loads it and returns the family name to put first in the font stack, or "" when there is none. */
  var FONT_EXT = /\.(woff2|woff|ttf|otf)$/i, FONT_FMT = { woff2: "woff2", woff: "woff", ttf: "truetype", otf: "opentype" };
  function fontLink(raw) {
    // Accepts a bare address or pasted embed code (<link href="…">, @import url(…)).
    var m = /https:\/\/[^\s"'<>)]+/i.exec(String(raw || "")); if (!m) return null;
    var u; try { u = new URL(m[0].replace(/&amp;/g, "&")); } catch (e) { return null; }
    if (FONT_EXT.test(u.pathname)) return { kind: "file", url: u.href, family: "" };
    var fam = "";
    if (u.hostname === "fonts.google.com") {
      var sp = /\/specimen\/([^/?#]+)/.exec(u.pathname); if (!sp) return null;
      try { fam = decodeURIComponent(sp[1]).replace(/\+/g, " "); } catch (e) { return null; }
      return { kind: "css", url: "https://fonts.googleapis.com/css?family=" + encodeURIComponent(fam).replace(/%20/g, "+") + ":300,400,500,600,700,800&display=swap", family: fam };
    }
    if (u.hostname === "fonts.googleapis.com" || u.hostname === "fonts.bunny.net") fam = String(u.searchParams.get("family") || "").split(/[:|]/)[0].replace(/\+/g, " ").trim();
    return { kind: "css", url: u.href, family: fam };
  }
  function useFont(theme, slot, urlOf) {
    var cf = ((theme || {}).customFonts || {})[slot] || {}, id = "sitefont-" + slot, el = document.getElementById(id);
    var fileUrl = cf.file && cf.file.path && urlOf ? String(urlOf(cf.file) || "") : "", L = !cf.file && cf.link ? fontLink(cf.link) : null;
    var fam = "", want = "", tag = "";
    if (fileUrl || (L && L.kind === "file")) {
      var url = fileUrl || L.url, ext = (FONT_EXT.exec(fileUrl ? String(cf.file.path) : new URL(L.url).pathname) || [])[1], variable = fileUrl ? !!cf.file.variable : !!cf.variable;
      fam = "Site " + slot + " font"; tag = "style";
      want = '@font-face{font-family:"' + fam + '";src:url("' + url.replace(/["\\\n\r]/g, "") + '")' + (ext ? ' format("' + FONT_FMT[ext.toLowerCase()] + '")' : "") + ";font-display:swap" + (variable ? ";font-weight:100 900" : "") + "}";
    } else if (L && (cf.name || L.family)) {
      fam = String(cf.name || L.family).replace(/["\;{}<>\n\r]/g, "").trim().slice(0, 80); tag = "link"; want = L.url;
    }
    if (!fam) { if (el) el.remove(); return ""; }
    if (el && el.tagName.toLowerCase() !== tag) { el.remove(); el = null; }
    if (!el) { el = document.createElement(tag); el.id = id; if (tag === "link") el.rel = "stylesheet"; document.head.appendChild(el); }
    if (tag === "style") { if (el.textContent !== want) el.textContent = want; } else if (el.getAttribute("href") !== want) el.setAttribute("href", want);
    return fam;
  }
  // ---- Code Update (content.code = { on, css, js, pages }): a site's own copy of the template's code. When it is on, the
  // template's script hands the page over before it draws anything: its stylesheet is swapped for the copy's CSS and
  // the copy's JavaScript runs in its place. A copy that cannot start (a slip in the JavaScript) is dropped and the
  // template's own code draws the site, so a mistake never leaves a blank page. Your HTML for each page: see scDrawn.
  var scPV = window.name === "cms-preview" && window.parent !== window;
  var sc = { run: null, bad: null, t: 0, ev: [], tm: [], o: {} }, scAdd = EventTarget.prototype.addEventListener, scTO = window.setTimeout, scIV = window.setInterval, scOn = false;
  function scWant(c) { var k = c && c.code; return k && k.on && String(k.js || "").trim() ? k : null; }
  function scSig(k) { return String(k.js || ""); }
  function scFlag(v) { try { if (v) sessionStorage.setItem("site-code-wait", "1"); else sessionStorage.removeItem("site-code-wait"); } catch (e) { /* private mode */ } }
  function scReload() { clearTimeout(sc.t); sc.t = scTO.call(window, function () { location.reload(); }, scPV ? 900 : 0); }
  // While the template's script starts up, note the listeners and timers it sets, so they can be taken off at the hand-over.
  function scTrack() {
    if (scOn) return; scOn = true;
    EventTarget.prototype.addEventListener = function (t, f, o) { sc.ev.push([this || window, t, f, o]); return scAdd.call(this || window, t, f, o); };
    window.setTimeout = function () { var id = scTO.apply(window, arguments); sc.tm.push(id); return id; };
    window.setInterval = function () { var id = scIV.apply(window, arguments); sc.tm.push(id); return id; };
    scTO.call(window, scUntrack, 0);
  }
  function scUntrack() { if (!scOn) return; scOn = false; EventTarget.prototype.addEventListener = scAdd; window.setTimeout = scTO; window.setInterval = scIV; }
  function scQuiet() { scUntrack(); sc.ev.forEach(function (x) { try { x[0].removeEventListener(x[1], x[2], x[3]); } catch (e) { /* gone */ } }); sc.tm.forEach(function (id) { clearTimeout(id); clearInterval(id); }); sc.ev = []; sc.tm = []; }
  function scCss(k, o) {
    var el = o.css ? document.querySelector(o.css) : null, st = document.getElementById("site-code-css"), css = k ? String(k.css || "") : "";
    if (!css.trim()) { if (st) st.remove(); if (el) el.disabled = false; return; }
    if (!st) { st = document.createElement("style"); st.id = "site-code-css"; if (el && el.parentNode) el.parentNode.insertBefore(st, el.nextSibling); else document.head.appendChild(st); }
    if (st.textContent !== css) st.textContent = css;
    if (el) el.disabled = true;
  }
  // ---- Your HTML for a page (content.code.pages[key] = { html, base }). "base" is the page's markup as the template drew
  // it when it was copied, "html" is that markup with your changes. Each time the template writes the page, the parts
  // you changed are laid over it, before anything is wired up: what you left alone still follows the content.
  function scKey() {
    var f = (location.pathname.split("/").pop() || "index").replace(/\.html?$/i, "") || "index", q;
    try { q = new URLSearchParams(location.search); ["p", "s", "id", "c"].forEach(function (n) { var v = q.get(n); if (v) f += "?" + n + "=" + v; }); } catch (e) { /* old browser */ }
    return f;
  }
  function scKids(n) { return Array.prototype.filter.call(n.childNodes, function (c) { return c.nodeType === 1 || (c.nodeType === 3 && c.nodeValue.trim()); }); }
  function scTxt(n) { return n.nodeValue.replace(/\s+/g, " ").trim(); }
  function scSame(a, b) {
    if (a.nodeType !== b.nodeType) return false;
    if (a.nodeType === 3) return scTxt(a) === scTxt(b);
    if (a.tagName !== b.tagName || a.attributes.length !== b.attributes.length) return false;
    for (var i = 0; i < a.attributes.length; i++) if (b.getAttribute(a.attributes[i].name) !== a.attributes[i].value) return false;
    var x = scKids(a), y = scKids(b); if (x.length !== y.length) return false;
    for (i = 0; i < x.length; i++) if (!scSame(x[i], y[i])) return false;
    return true;
  }
  function scImp(n) { var c = document.importNode(n, true); if (c.nodeType === 3) c.nodeValue = c.nodeValue.replace(/\s+/g, " "); return c; }
  function scPatch(live, to, base) {
    var i, a;
    for (i = 0; i < to.attributes.length; i++) { a = to.attributes[i]; if (base.getAttribute(a.name) !== a.value) live.setAttribute(a.name, a.value); }
    for (i = 0; i < base.attributes.length; i++) { a = base.attributes[i]; if (!to.hasAttribute(a.name)) live.removeAttribute(a.name); }
    var T = scKids(to), B = scKids(base), L = scKids(live), kind = function (n) { return n.nodeType === 3 ? "#" : n.tagName; };
    var lined = T.length === B.length && L.length === B.length && T.every(function (t, n) { return kind(t) === kind(B[n]); });
    if (lined) {
      for (i = 0; i < T.length; i++) {
        if (scSame(T[i], B[i])) continue;
        if (T[i].nodeType === 3) { if (L[i].nodeType === 3) L[i].nodeValue = T[i].nodeValue.replace(/\s+/g, " "); else live.replaceChild(scImp(T[i]), L[i]); }
        else if (L[i].nodeType === 1 && L[i].tagName === T[i].tagName) scPatch(L[i], T[i], B[i]);
        else live.replaceChild(scImp(T[i]), L[i]);
      }
      return;
    }
    // Something was added, taken out or moved here: keep the drawn pieces that are still wanted, in your order.
    var used = [], out = [], fits = L.length === B.length, mark = function (n) { return n.nodeType === 1 ? n.tagName + "#" + (n.getAttribute("id") || "") + "." + (n.getAttribute("class") || "") : ""; };
    T.forEach(function (t, n) {
      var j = -1, k;
      if (fits) { for (k = 0; k < B.length; k++) if (!used[k] && scSame(t, B[k])) { j = k; break; } }
      if (j >= 0) { used[j] = 1; out[n] = L[j]; }
    });
    T.forEach(function (t, n) {
      if (out[n]) return; var j = -1, k;
      if (fits && t.nodeType === 1) { for (k = 0; k < B.length; k++) if (!used[k] && B[k].nodeType === 1 && L[k].nodeType === 1 && L[k].tagName === t.tagName && mark(B[k]) === mark(t)) { j = k; break; } }
      if (j >= 0) { used[j] = 1; scPatch(L[j], t, B[j]); out[n] = L[j]; } else out[n] = scImp(t);
    });
    Array.prototype.slice.call(live.childNodes).forEach(function (n) { if (out.indexOf(n) < 0) live.removeChild(n); });
    out.forEach(function (n) { live.appendChild(n); });
  }
  var scMemo = { html: "", base: "", to: null, from: null };
  function scDom(h) { var t = document.createElement("template"); t.innerHTML = h; var d = document.createElement("div"); d.appendChild(t.content); return d; }
  /** Called by the template the moment it has written a page's markup. */
  /* ---- Own text colours. The editor keeps a colour beside the text it belongs to: content.<…>.title = "Hello" with
     titleInk = "#cc2200" (and, for a list of lines, linesInks = { "<line>": "#hex" }). After a page is drawn, every
     element whose whole text is that text gets the colour, in every layout, section and template. Redraws start from
     fresh markup, so a colour that was taken away is gone with it. */
  var TC_HEX = /^#[0-9a-f]{6}$/i;
  function tcNorm(t) { return String(t).replace(/[*_\u201c\u201d"\u2018\u2019']/g, "").replace(/[\u2013\u2014\u2012\u2212-]/g, "-").replace(/\s+/g, "").toLowerCase(); }
  function tcEntries(content) {
    var out = [], seen = 0;
    (function walk(o, d) {
      if (!o || typeof o !== "object" || d > 9 || seen > 20000) return; seen++;
      if (Array.isArray(o)) { for (var i = 0; i < o.length; i++) walk(o[i], d + 1); return; }
      for (var k in o) {
        if (!Object.prototype.hasOwnProperty.call(o, k)) continue; var v = o[k];
        if (k === "code" || k === "i18n" || k === "cms") continue;
        if (typeof v === "string") { var c = o[k + "Ink"]; if (typeof c === "string" && TC_HEX.test(c) && v.trim()) out.push({ t: tcNorm(v), c: c }); }
        else if (v && typeof v === "object" && /Inks$/.test(k)) { for (var t in v) if (typeof v[t] === "string" && TC_HEX.test(v[t]) && t.trim()) out.push({ t: tcNorm(t), c: v[t] }); }
        else if (v && typeof v === "object") walk(v, d + 1);
      }
    })(content, 0);
    return out;
  }
  function tcPaint(el, c) {
    var all = [el].concat([].slice.call(el.querySelectorAll("*")));
    for (var i = 0; i < all.length; i++) {
      var e = all[i]; if (/^(svg|path|img|script|style|video|canvas|input|select|textarea|button)$/i.test(e.nodeName) && e !== el) continue;
      if (e.closest && e.closest("svg") && e.nodeName.toLowerCase() !== "svg") continue;
      var st = e.style; st.setProperty("color", c, "important"); st.setProperty("-webkit-text-fill-color", c, "important");
      var cs = getComputedStyle(e);
      if ((cs.webkitBackgroundClip || cs.backgroundClip) === "text") { st.setProperty("background-image", "none", "important"); }
      if (parseFloat(cs.webkitTextStrokeWidth) > 0) st.setProperty("-webkit-text-stroke-color", c, "important");
      e.setAttribute("data-ink", "1");
    }
  }
  function tcApply(root, content) {
    if (!root || !root.querySelectorAll) return; var list = tcEntries(content); if (!list.length) return;
    var els = root.querySelectorAll("*"), cand = [];
    for (var i = 0; i < els.length; i++) {
      var e = els[i]; if (/^(SCRIPT|STYLE|SVG|IMG|INPUT|SELECT|TEXTAREA|OPTION|NOSCRIPT|VIDEO|CANVAS|IFRAME)$/i.test(e.nodeName) || (e.closest && e.closest("svg"))) continue;
      var x = e.textContent; if (!x || x.length > 900) continue;
      var own = ""; for (var c = e.firstChild; c; c = c.nextSibling) if (c.nodeType === 3) own += c.nodeValue; // the element's own words, beside a count or an arrow
      var nn = tcNorm(x), oo = own.trim() ? tcNorm(own) : ""; cand.push({ e: e, n: nn.replace(/\(\d+\)/g, ""), o: oo.replace(/\(\d+\)/g, "") }); // a count in brackets beside the words is not part of them
    }
    for (var j = 0; j < list.length; j++) {
      var w = list[j], hit = [];
      for (var q = 0; q < cand.length; q++) {
        var n = cand[q].n, ok = n === w.t || cand[q].o === w.t || (n.length > w.t.length && n.length - w.t.length <= 3 && (n.indexOf(w.t) === 0 || n.lastIndexOf(w.t) === n.length - w.t.length) && !/[\p{L}\p{N}]/u.test(n.split(w.t).join("")));
        if (ok) hit.push(cand[q].e);
      }
      // the innermost element that carries the whole text; a wrapper around it is left alone
      for (var h = 0; h < hit.length; h++) { var inner = false; for (var g = 0; g < hit.length; g++) if (g !== h && hit[h].contains(hit[g])) { inner = true; break; } if (!inner) tcPaint(hit[h], w.c); }
    }
  }
  var tcTok = 0;
  function tcRun(root, content) {
    var my = ++tcTok;
    try { tcApply(root, content); } catch (e) { /* colours are a nicety: never break the page */ }
    // text effects (letters, words, lines) rebuild their text a moment after the page is drawn; a newer draw cancels these
    if (tcEntries(content).length) [700, 2200].forEach(function (ms) { setTimeout(function () { if (my === tcTok) { try { tcApply(root, content); } catch (e) { /* none */ } } }, ms); });
  }
  function scDrawn(root, content) { scDrawn0(root, content); tcRun(root, content); }
  function scDrawn0(root, content) {
    if (!root) return; var key = scKey();
    if (scPV) sc.snap = { key: key, html: root.innerHTML };
    var k = content && content.code, p = k && k.on && k.pages && k.pages[key];
    if (!p || typeof p.html !== "string" || typeof p.base !== "string" || p.html === p.base) return;
    try {
      if (scMemo.html !== p.html || scMemo.base !== p.base) scMemo = { html: p.html, base: p.base, to: scDom(p.html), from: scDom(p.base) };
      if (!scSame(scMemo.to, scMemo.from)) scPatch(root, scMemo.to, scMemo.from);
    } catch (e) { try { console.error("Code Update: your HTML for this page could not be laid over it.", e); } catch (x) { /* no console */ } }
  }
  // The editor asks its preview for the markup of the page it shows, as the template drew it.
  if (scPV) addEventListener("message", function (e) {
    if (e.origin !== location.origin || e.source !== window.parent || !e.data || e.data.type !== "cms:snap") return;
    window.parent.postMessage({ type: "cms:snap", ok: !!sc.snap, key: sc.snap ? sc.snap.key : scKey(), html: sc.snap ? sc.snap.html : "" }, location.origin);
  });
  function scBar(msg) {
    var b = document.getElementById("site-code-bar"); if (!msg || !scPV) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement("div"); b.id = "site-code-bar"; b.setAttribute("role", "alert"); b.style.cssText = "position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483000;padding:10px 14px;border-radius:10px;background:#7f1d1d;color:#fff;font:13px/1.45 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.35)"; (document.body || document.documentElement).appendChild(b); }
    b.textContent = msg;
  }
  function scFail(k, e) {
    sc.run = null; sc.bad = scSig(k); scCss(null, sc.o);
    try { console.error("Code Update: the JavaScript could not start, so the template's own code is used.", e); } catch (x) { /* no console */ }
    scTO.call(window, function () { scBar("Code Update: your JavaScript has a mistake, so the template's own code is shown until it is fixed. " + String((e && e.message) || e).slice(0, 200)); }, 50);
  }
  /** Called by the template's script with the content, before it draws. True: the copy has the page, the caller stops. */
  function scTake(content, o) {
    o = o || {}; sc.o = o; var k = scWant(content); scFlag(!!k);
    if (!k) { clearTimeout(sc.t); if (sc.bad !== null) { sc.bad = null; scBar(""); } scCss(content && content.code && content.code.on ? content.code : null, o); return false; }
    if (sc.bad !== null) { if (scSig(k) !== sc.bad) scReload(); else clearTimeout(sc.t); return false; }
    if (o.drawn) { scReload(); return !scPV; }
    var fn; try { fn = new Function("SiteCode", "fetch", String(k.js)); } catch (e) { scFail(k, e); return false; }
    scQuiet();
    try { scCss(k, o); } catch (e) { /* keep the template's styles */ }
    var text = o.text, get = function (u, i) { if (text != null && /content\.json(\?|$)/.test(String(u))) { var x = text; text = null; return Promise.resolve(new Response(x, { status: 200, headers: { "Content-Type": "application/json" } })); } return window.fetch(u, i); };
    sc.run = scSig(k);
    try { fn({ drawn: scDrawn, take: function () { return false; }, wait: function () { return false; }, track: function () {}, untrack: function () {} }, get); } catch (e) { scFail(k, e); return false; }
    // In the editor's preview: a change to the CSS shows at once; a change to the HTML or JavaScript reloads the preview.
    if (scPV) scAdd.call(window, "message", function (e) {
      if (e.origin !== location.origin || e.source !== window.parent) return; var d = e.data || {};
      if (d.type !== "cms:content" || !d.content || typeof d.content !== "object") return;
      var k2 = scWant(d.content); scFlag(!!k2);
      if (!k2 || scSig(k2) !== sc.run) scReload(); else { clearTimeout(sc.t); scCss(k2, o); }
    });
    return true;
  }
  window.SiteCode = { drawn: scDrawn, take: scTake, track: scTrack, untrack: scUntrack, wait: function () { try { return scPV && sessionStorage.getItem("site-code-wait") === "1"; } catch (e) { return false; } } };
  window.SiteFonts = { use: useFont, link: fontLink };
  window.SiteSkeleton = { show: skeleton };
  window.SiteLogo = { hero: heroLogo };
  // ---- Bars that stick under the site's menu bar (the order page's toolbar, the menu's category row). Their place is
  // measured from the menu bar as it is drawn (every theme's bar has its own height, and some float with a see-through
  // surround), and once a bar is stuck a plain backdrop reaches from it up to the top of the window and out to both
  // edges, so the page never shows through around the menu bar.
  var sticky = [], stickOn = false;
  function stickMeasure() {
    var nv = document.querySelector(".nav, header.hdr, .vx-hdr"), pos = nv ? getComputedStyle(nv).position : "", top = nv && (pos === "sticky" || pos === "fixed") ? Math.round(nv.getBoundingClientRect().height) : 0;
    var vw = document.documentElement.clientWidth;
    sticky = sticky.filter(function (x) { return x.el.isConnected; });
    sticky.forEach(function (x) {
      (x.on || document.documentElement).style.setProperty(x.name, top + "px");
      var r = x.el.getBoundingClientRect(), stuck = top > 0 && r.top <= top + 1 && r.bottom > 0;
      x.el.classList.toggle("fx-stuck", stuck);
      if (!stuck) return;
      x.el.style.setProperty("--fx-st", top + "px"); x.el.style.setProperty("--fx-sl", Math.max(0, Math.round(r.left)) + "px"); x.el.style.setProperty("--fx-sr", Math.max(0, Math.round(vw - r.right)) + "px");
      if (!x.bg) { for (var n = x.el; n && n.nodeType === 1; n = n.parentNode) { var m = /rgba?\(([^)]+)\)/.exec(getComputedStyle(n).backgroundColor || ""), v = m ? m[1].split(",").map(parseFloat) : null; if (v && (v.length < 4 || v[3] > 0.5)) { x.bg = "rgb(" + v.slice(0, 3).join(",") + ")"; break; } } x.el.style.setProperty("--fx-sbg", x.bg || "#fff"); }
    });
  }
  function stick(el, name, on) {
    if (!el) return;
    if (!document.getElementById("fx-stick")) { var st3 = document.createElement("style"); st3.id = "fx-stick"; st3.textContent = ".fx-stuck::before{content:\"\";position:absolute;z-index:-1;pointer-events:none;top:calc(-1*var(--fx-st,0px));bottom:0;left:calc(-1*var(--fx-sl,0px));right:calc(-1*var(--fx-sr,0px));background:var(--fx-sbg,var(--bg,#fff))}"; document.head.appendChild(st3); }
    sticky = sticky.filter(function (x) { return x.el !== el && x.el.isConnected; }); sticky.push({ el: el, name: name, on: on });
    if (!stickOn) { stickOn = true; var tick = false, go = function () { if (tick) return; tick = true; requestAnimationFrame(function () { tick = false; stickMeasure(); }); }; addEventListener("scroll", go, { passive: true }); addEventListener("resize", go); addEventListener("load", go); }
    stickMeasure(); setTimeout(stickMeasure, 400);
  }
  window.SiteFX = { init: init, bgs: function (opts, root) { try { sectionBgs(opts || {}, root || document.body); } catch (e) { /* never worth a broken page */ } }, version: 1, fontsOk: fontsOk, allowed: allowed, stick: stick };
})();
