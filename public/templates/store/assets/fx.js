/* Site FX: the interaction engine shared by every Site Studio template.
   Source of truth: src/fx/fx.js. `npm run sync:fx` copies it to each template's assets/ folder
   (it runs automatically before `dev` and `build`), so exported sites carry it as assets/fx.js.

   Each template sets these attributes on <html> from content.theme and calls SiteFX.init()
   after every render:
     data-cursor    none | dot | blend | spotlight | trail | ring | glow | cross | square
     data-loader    none | curtain | counter | split | wipe | iris | columns | fade | portal   (also animates page-to-page links)
     data-textfx    none | lines | letters | scramble | words | flip | wave | wipe
     data-hoverfx   none | lift | magnetic | tilt | shine | spot | zoom | offset
     data-scrollfx  none | progress | smooth | skew | reveal | ring | dots
     data-scrollease light | medium | heavy  (how strongly smooth scrolling eases; mouse wheels only)
   Intro screen colours come from --intro-bg / --intro-fg (falling back to --deep / --on-deep).
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

    unboot();
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
    // A signature theme with its own preloader is already on screen: the waiting panel just goes.
    else if (cover && document.getElementById("vxLoad")) { cover.remove(); cover = null; st.loaderPlayed = true; }
    else if (cover) { st.loaderPlayed = true; revealCover(); delay = 350; }
    else if (c.loader !== "none" && !RM) {
      var play = PREVIEW ? c.loader !== st.loader : !st.loaderPlayed && Date.now() - T0 < 5000;
      if (play) { st.loaderPlayed = true; playLoader(c.loader, opts.brand || document.title); delay = c.loader === "counter" ? 1250 : 950; }
    }
    st.loader = c.loader;
    // Remembered on this device, so the next visit starts on the intro's panel (see skeleton()).
    if (!PREVIEW) try { var ik = "site-intro:" + location.pathname.replace(/[^/]*$/, ""); var vxl = document.getElementById("vxLoad"); if (c.loader !== "none") { var ic = colors(); localStorage.setItem(ik, JSON.stringify({ k: c.loader, bg: ic.deep, fg: ic.on })); } else if (vxl) { st.ownIntro = true; var vcs = getComputedStyle(vxl); localStorage.setItem(ik, JSON.stringify({ k: "curtain", bg: vcs.backgroundColor, fg: vcs.color })); } else if (!st.ownIntro) localStorage.removeItem(ik); } catch (e) {}
    setupText(root, c, animate, delay);
    setupScrollExtras(root, c);
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
    if (!cover && !st.bootTried && !RM && !PREVIEW) {
      st.bootTried = true;
      try {
        var m = JSON.parse(localStorage.getItem("site-intro:" + location.pathname.replace(/[^/]*$/, "")) || "null"), okc = /^(#[0-9a-f]{3,8}|rgba?\([0-9., %]+\))$/i;
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
  window.SiteFonts = { use: useFont, link: fontLink };
  window.SiteSkeleton = { show: skeleton };
  window.SiteLogo = { hero: heroLogo };
  window.SiteFX = { init: init, version: 1 };
})();
