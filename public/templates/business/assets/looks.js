/* Page styles (content.theme.look → html[data-look]): whole-page looks that sit over any theme of the business, events,
   restaurant and shop templates. Each one reshapes the page, not just its colours:
     neu      Neumorphism: everything is pressed out of one soft surface. A floating capsule menu, the hero as one raised
              slab with its picture set into it, borderless raised cards, pressed fields and labels, round stat dials and a
              raised footer slab. Light and dark themes both work: the light edge and the shade are mixed from the page colour.
     spatial  Spatial UI: the page becomes a lit room and every section a glass window floating in it (as on a headset).
              A floating capsule menu (an "ornament"), the hero window tilts toward the pointer while its picture floats in
              front, cards lift and glow when pointed at, capsule buttons.
   Source of truth: src/fx/looks.js (synced to every template as assets/looks.js). */
(function () {
  "use strict";
  if (typeof document === "undefined" || window.SiteLooks) return;
  var R = ":root[data-look=neu]", S = ":root[data-look=spatial]";
  var neu = [
    R + "{--nacc:var(--c1,var(--accent));--non:var(--on-c1,var(--on-accent,#fff));--nhi:color-mix(in srgb,var(--bg) 30%,#fff);--nlo:color-mix(in srgb,var(--bg) 84%,#1a2340);",
    "  --nup:12px 12px 28px var(--nlo),-12px -12px 28px var(--nhi);--nsm:6px 6px 14px var(--nlo),-6px -6px 14px var(--nhi);--nin:inset 6px 6px 13px var(--nlo),inset -6px -6px 13px var(--nhi);--nrad:clamp(26px,3.4vw,44px)}",
    R + "[data-lkdark=true]{--nhi:color-mix(in srgb,var(--bg) 88%,#fff);--nlo:color-mix(in srgb,var(--bg) 40%,#000)}",
    R + " body{background:var(--bg)}",
    // the menu: a raised capsule floating under the top edge
    R + " header.nav{background:transparent!important;box-shadow:none!important;border:0!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;padding-top:14px}",
    R + " header.nav .nav-in," + R + " .hdr>.wrap{background:var(--bg);border-radius:999px;box-shadow:var(--nsm);padding-inline:clamp(16px,2.4vw,28px) 10px;min-height:64px}",
    R + " .hdr{background:transparent;border:0;-webkit-backdrop-filter:none;backdrop-filter:none;padding-top:12px}",
    R + " header.nav .links a," + R + " .hdr .nav a{padding:9px 16px;border-radius:999px;transition:box-shadow .2s,color .2s}",
    R + " header.nav .links a::after{display:none}",
    R + " header.nav .links a:hover," + R + " .hdr .nav a:hover{box-shadow:var(--nsm);color:var(--text)}",
    R + " header.nav .links a[aria-current]," + R + " .hdr .nav a[aria-current]{box-shadow:var(--nin);color:var(--nacc)}",
    // the hero: one raised slab with the picture set into a pressed well
    R + " .hero{background:transparent}",
    R + " .hero>.wrap{background:var(--bg);border-radius:var(--nrad);box-shadow:var(--nup);padding:clamp(22px,4vw,60px)}",
    R + " .hero-media:not(.none)," + R + " .hero .art{border:12px solid var(--bg);border-radius:calc(var(--nrad) - 6px);box-shadow:var(--nin),var(--nsm);overflow:hidden}",
    // sections sit on the one surface: no tinted bands
    R + " .band{background:transparent!important;clip-path:none!important}",
    R + " .band::before," + R + " .band::after{content:none!important}",
    R + " .card," + R + " .cat," + R + " .banner{background:var(--bg);border-color:transparent!important;border-radius:max(var(--r,12px),24px);box-shadow:var(--nup)}",
    R + " .card:hover{transform:none}",
    R + " :is(.hp-card,.emb,.cd-u){background:var(--bg)!important;border-color:transparent!important;box-shadow:var(--nsm)!important}",
    R + " .banner{color:var(--text)}" + R + " .banner .btn{color:var(--text)}",
    R + " .pcard{background:var(--bg);border-radius:26px;padding:12px 12px 16px;box-shadow:var(--nup);transition:box-shadow .25s}",
    R + " .pcard:hover{box-shadow:var(--nsm)}",
    R + " .pcard .im," + R + " .pcard .ph{border-radius:18px;overflow:hidden;box-shadow:var(--nin)}",
    R + " :is(.case-media,.prod-media,.sp-media,.dish-pic,.venue-p) img{border-radius:18px}",
    R + " .eyebrow{display:inline-flex;padding:8px 16px;border-radius:999px;box-shadow:var(--nin);color:var(--nacc)}",
    R + " .eyebrow::before{display:none}",
    // stat dials
    R + " .stat{display:grid;place-items:center;text-align:center;aspect-ratio:1;max-width:220px;margin-inline:auto;border-radius:50%;padding:22px;box-shadow:var(--nup);background:var(--bg);border:0!important}",
    R + " .stat .value{width:100%}",
    // buttons: raised capsules, pressed when held
    R + " .btn{border-radius:999px!important;border-color:transparent!important;box-shadow:var(--nsm);transition:box-shadow .18s,transform .18s,color .18s}",
    R + " .btn:hover{transform:none!important;box-shadow:8px 8px 18px var(--nlo),-8px -8px 18px var(--nhi)}",
    R + " .btn:active{box-shadow:var(--nin)!important}",
    R + " .btn.pri{background:var(--nacc);color:var(--non)}",
    R + " .btn:not(.pri){background:var(--bg);color:var(--text)}",
    R + " .chip," + R + " .sch-tabs button{border-color:transparent!important;border-radius:999px;box-shadow:var(--nsm);background:var(--bg)}",
    R + " .chip[aria-pressed=true]," + R + " .chip.on," + R + " .sch-tabs button[aria-selected=true]{box-shadow:var(--nin);color:var(--nacc)}",
    // fields are pressed into the surface
    R + " :is(.fld,.rv-form,.pf-f,form) :is(input:not([type=checkbox]):not([type=radio]),select,textarea){background:var(--bg)!important;border-color:transparent!important;border-radius:16px!important;box-shadow:var(--nin)!important}",
    R + " :is(.fld,.rv-form,.pf-f,form) :is(input,select,textarea):focus{box-shadow:var(--nin),0 0 0 3px color-mix(in srgb,var(--nacc) 35%,transparent)!important}",
    R + " .qa-i{background:var(--bg);border:0!important;border-radius:22px;box-shadow:var(--nsm);margin-bottom:14px;padding-inline:20px}",
    R + " .cta-box{border-radius:var(--nrad);box-shadow:var(--nup)}",
    // the footer: a raised slab on the same surface
    R + " .foot," + R + " .ftr{background:transparent;border:0;color:var(--text);--on-deep:var(--text);--soft:color-mix(in srgb,var(--text) 62%,var(--bg))}",
    R + " .foot>.wrap," + R + " .ftr>.wrap{background:var(--bg);border-radius:var(--nrad);box-shadow:var(--nup);padding:clamp(24px,4vw,52px)}",
    R + " .foot a{color:inherit}",
    "@media(max-width:760px){" + R + " .hero>.wrap," + R + " .foot>.wrap," + R + " .ftr>.wrap{width:calc(100% - 24px);border-radius:28px}}",
  ];
  var spatial = [
    S + "{--sacc:var(--c1,var(--accent));--sl1:var(--c1,var(--accent));--sl2:var(--c2,var(--accent2,var(--c1,var(--accent))));--sl3:var(--c3,var(--sale,var(--c1,var(--accent))));",
    "  --swin:color-mix(in srgb,var(--surface) 58%,transparent);--srim:rgb(255 255 255 / .55);--sdrop:0 50px 90px -42px rgb(20 30 70 / .45),0 14px 28px -16px rgb(20 30 70 / .22);--srad:clamp(26px,3vw,40px);background:var(--bg)}",
    S + "[data-lkdark=true]{--swin:color-mix(in srgb,var(--surface) 46%,transparent);--srim:rgb(255 255 255 / .16);--sdrop:0 50px 90px -40px rgb(0 0 0 / .75),0 14px 28px -14px rgb(0 0 0 / .45)}",
    // the room: lights in the theme's colours over a floor grid that runs to the horizon
    S + " body{background:transparent!important}",
    S + "::before{content:\"\";position:fixed;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(55% 42% at 50% 110%,color-mix(in srgb,var(--sl1) 42%,transparent),transparent 70%),radial-gradient(38% 36% at 6% 6%,color-mix(in srgb,var(--sl2) 34%,transparent),transparent 70%),radial-gradient(40% 38% at 96% 14%,color-mix(in srgb,var(--sl3) 28%,transparent),transparent 70%),var(--bg)}",
    S + "::after{content:\"\";position:fixed;left:-20%;right:-20%;bottom:-34vh;height:72vh;z-index:-1;pointer-events:none;opacity:.3;background-image:linear-gradient(color-mix(in srgb,var(--sl1) 60%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--sl1) 60%,transparent) 1px,transparent 1px);background-size:70px 70px;transform:perspective(640px) rotateX(64deg);transform-origin:50% 0;-webkit-mask-image:linear-gradient(transparent,#000 30%,transparent 92%);mask-image:linear-gradient(transparent,#000 30%,transparent 92%)}",
    // the menu: a glass ornament capsule
    S + " header.nav{background:transparent!important;box-shadow:none!important;border:0!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;padding-top:14px}",
    S + " .hdr{background:transparent;border:0;-webkit-backdrop-filter:none;backdrop-filter:none;padding-top:12px}",
    S + " header.nav .nav-in," + S + " .hdr>.wrap{background:var(--swin);-webkit-backdrop-filter:blur(30px) saturate(1.8);backdrop-filter:blur(30px) saturate(1.8);border:1px solid var(--srim);border-radius:999px;box-shadow:inset 0 1px 0 rgb(255 255 255 / .35),var(--sdrop);padding-inline:clamp(16px,2.4vw,26px) 8px;min-height:62px}",
    S + " header.nav .links a," + S + " .hdr .nav a{padding:9px 16px;border-radius:999px;transition:background .2s,color .2s,transform .2s}",
    S + " header.nav .links a::after{display:none}",
    S + " header.nav .links a:hover," + S + " .hdr .nav a:hover{background:color-mix(in srgb,var(--text) 9%,transparent);color:var(--text);transform:scale(1.04)}",
    S + " header.nav .links a[aria-current]," + S + " .hdr .nav a[aria-current]{background:color-mix(in srgb,var(--text) 14%,transparent);color:var(--text)}",
    // every section is a window floating in the room
    S + " main>section{background:transparent!important;clip-path:none!important;padding-block:clamp(12px,2vw,24px)!important}",
    S + " main>section::before," + S + " main>section::after{content:none!important}",
    S + " main>section>.wrap{background:var(--swin);-webkit-backdrop-filter:blur(34px) saturate(1.7);backdrop-filter:blur(34px) saturate(1.7);border:1px solid var(--srim);border-radius:var(--srad);box-shadow:inset 0 1px 0 rgb(255 255 255 / .32),inset 0 -1px 0 rgb(0 0 0 / .08),var(--sdrop);padding:clamp(24px,4.2vw,64px)}",
    S + " main{padding-top:10px}",
    // the hero window tilts toward the pointer (assets/looks.js), its picture floats in front of it
    S + " .hero>.wrap{transform:perspective(1600px) rotateX(var(--srx,0deg)) rotateY(var(--sry,0deg));transition:transform .5s cubic-bezier(.2,.8,.2,1);will-change:transform}",
    S + " .hero-media:not(.none)," + S + " .hero .art{border-radius:calc(var(--srad) - 8px);overflow:hidden;border:1px solid var(--srim);box-shadow:0 46px 80px -34px rgb(0 0 0 / .6),0 0 0 1px rgb(255 255 255 / .08);transform:translate3d(var(--smx,0px),var(--smy,0px),0) scale(1.03);transition:transform .5s cubic-bezier(.2,.8,.2,1)}",
    // glass tiles inside the windows: they lift and catch the light under the pointer
    S + " .card," + S + " .pcard," + S + " .cat," + S + " .qa-i{background:color-mix(in srgb,var(--surface) 42%,transparent)!important;border:1px solid var(--srim)!important;border-radius:26px;box-shadow:inset 0 1px 0 rgb(255 255 255 / .28);transition:transform .35s cubic-bezier(.2,.8,.2,1),box-shadow .35s}",
    S + " .pcard{padding:10px 10px 14px}" + S + " .qa-i{padding-inline:20px;margin-bottom:12px}",
    S + " :is(.card,.pcard,.cat):hover{transform:translateY(-6px) scale(1.015);box-shadow:inset 0 1px 0 rgb(255 255 255 / .4),0 34px 54px -26px rgb(0 0 0 / .5),0 0 0 1.5px color-mix(in srgb,var(--sacc) 55%,transparent)}",
    S + " .pcard :is(.im,.ph)," + S + " :is(.case-media,.prod-media,.sp-media) {border-radius:18px;overflow:hidden}",
    S + " .banner," + S + " .cta-box{border-radius:var(--srad);border:1px solid var(--srim);box-shadow:inset 0 1px 0 rgb(255 255 255 / .3),var(--sdrop)}",
    S + " .eyebrow{display:inline-flex;padding:7px 14px;border-radius:999px;background:color-mix(in srgb,var(--text) 8%,transparent);border:1px solid var(--srim)}",
    S + " .eyebrow::before{display:none}",
    // capsule buttons that light up
    S + " .btn{border-radius:999px!important;transition:transform .22s,box-shadow .22s,background .22s}",
    S + " .btn:not(.pri){background:color-mix(in srgb,var(--text) 8%,transparent);border-color:var(--srim)!important;color:var(--text);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px)}",
    S + " .btn.pri{box-shadow:inset 0 1px 0 rgb(255 255 255 / .35),0 12px 28px -10px color-mix(in srgb,var(--sacc) 80%,transparent)}",
    S + " .btn:hover{transform:translateY(-1px) scale(1.04)!important;box-shadow:0 0 0 1px rgb(255 255 255 / .3),0 14px 30px -10px color-mix(in srgb,var(--sacc) 70%,transparent)}",
    S + " :is(.fld,.rv-form,.pf-f,form) :is(input:not([type=checkbox]):not([type=radio]),select,textarea){background:color-mix(in srgb,var(--bg) 55%,transparent)!important;border-color:var(--srim)!important;border-radius:16px!important}",
    // the footer is the last window
    S + " .foot," + S + " .ftr{background:transparent;border:0;color:var(--text);--on-deep:var(--text);--soft:color-mix(in srgb,var(--text) 64%,transparent);padding-top:12px}",
    S + " .foot>.wrap," + S + " .ftr>.wrap{background:var(--swin);-webkit-backdrop-filter:blur(34px) saturate(1.7);backdrop-filter:blur(34px) saturate(1.7);border:1px solid var(--srim);border-radius:var(--srad);box-shadow:inset 0 1px 0 rgb(255 255 255 / .3),var(--sdrop);padding:clamp(24px,4vw,52px);margin-bottom:18px}",
    S + " .foot a{color:inherit}",
    "@media(max-width:760px){" + S + " main>section>.wrap," + S + " .foot>.wrap," + S + " .ftr>.wrap{width:calc(100% - 20px);border-radius:26px;padding:22px 18px}}",
    "@media(prefers-reduced-motion:reduce){" + S + " .hero>.wrap," + S + " .hero-media," + S + " .hero .art{transform:none!important}}",
  ];
  var st = document.createElement("style"); st.id = "site-looks"; st.textContent = neu.join("\n") + "\n" + spatial.join("\n");
  (document.head || document.documentElement).appendChild(st);

  var H = document.documentElement;
  // Light or dark page: the neumorphic light edge and shade, and the spatial glass, are mixed for it.
  function tone() {
    if (!H.dataset.look) return;
    var c = getComputedStyle(H).getPropertyValue("--bg").trim(), m = /^#?([0-9a-f]{6})$/i.exec(c), rgb = null;
    if (m) { var n = parseInt(m[1], 16); rgb = [n >> 16 & 255, n >> 8 & 255, n & 255]; }
    else if ((m = /rgba?\(([^)]+)\)/.exec(getComputedStyle(document.body || H).backgroundColor))) rgb = m[1].split(",").map(parseFloat);
    if (rgb) { var d = String(0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2] < 110); if (H.dataset.lkdark !== d) H.dataset.lkdark = d; }
  }
  var t = 0; function soon() { clearTimeout(t); t = setTimeout(tone, 30); }
  try { new MutationObserver(soon).observe(H, { attributes: true, attributeFilter: ["data-look", "style"] }); } catch (e) {}
  soon();

  // Spatial: the hero window turns a little toward the pointer, and its picture moves further than the window.
  var still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches, raf = 0, px = 0, py = 0;
  function tilt() {
    raf = 0; var w = document.querySelector(".hero>.wrap"); if (!w) return;
    w.style.setProperty("--sry", (px * 4).toFixed(2) + "deg"); w.style.setProperty("--srx", (-py * 3).toFixed(2) + "deg");
    w.style.setProperty("--smx", (px * 16).toFixed(1) + "px"); w.style.setProperty("--smy", (py * 12).toFixed(1) + "px");
  }
  if (!still) addEventListener("pointermove", function (e) {
    if (H.dataset.look !== "spatial" || e.pointerType === "touch") return;
    px = e.clientX / innerWidth - 0.5; py = e.clientY / innerHeight - 0.5; if (!raf) raf = requestAnimationFrame(tilt);
  }, { passive: true });

  window.SiteLooks = { list: [["classic", "Classic"], ["neu", "Neumorphism"], ["spatial", "Spatial UI"]], tone: tone };
})();
