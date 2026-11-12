/* Site Layouts: fully separate page structures for the portfolio template.
   Source of truth: src/fx/layouts.js (synced to templates as assets/layouts.js).

   Each kit renders the same content (hero, about, skills, work, projects, learning, contact)
   with its own structure, CSS and signature interaction:
     render(c, h) → HTML        init(root, c, h) → cleanup function (optional)
   h (from the template): esc, rich, safeUrl, imgUrl, mo(key,color,size,extra), photo(key,w),
   pimg(key,alt,w,cls), itemImg(item,key,alt,w,cls), copy(text), motion, signal (AbortSignal). */
(function (root) {
  "use strict";
  var K = {};
  function on(c, id) { return c.sections.some(function (s) { return s.id === id && s.visible; }); }
  function navOf(c) { return c.sections.filter(function (s) { return s.visible && s.id !== "contact" && (s.id !== "projects" || c.projects.items.length); }); }
  /** Projects to show: the real ones, or (with none yet) the work entries as case studies. */
  function projectsOf(c) {
    if (c.projects.items.length) return c.projects.items.map(function (p) { return { title: p.title, body: p.body, tags: p.tags || [], url: p.url, linkLabel: p.linkLabel, image: p.image }; });
    return c.work.items.map(function (w) { return { title: w.title, body: w.org + (w.bullets[0] ? " — " + w.bullets[0] : ""), tags: [w.period], image: w.image }; });
  }
  function paras(h, s) { return String(s || "").split(/\n\s*\n/).map(function (p) { return "<p>" + h.rich(p) + "</p>"; }).join(""); }
  function links(h, c, cls) { return c.contact.links.map(function (l) { return '<a class="' + (cls || "") + '" href="' + h.esc(h.safeUrl(l.url)) + '" target="_blank" rel="noopener">' + h.esc(l.label) + " ↗</a>"; }).join(""); }
  function mail(h, c, cls) { return c.contact.email ? '<button type="button" class="' + (cls || "") + '" data-copy="' + h.esc(c.contact.email) + '">' + h.esc(c.contact.email) + "</button>" : ""; }
  function name(c) { return (c.hero.firstName + " " + c.hero.lastName).trim(); }
  function bindCopy(root, h) { root.querySelectorAll("[data-copy]").forEach(function (b) { b.addEventListener("click", function () { h.copy(b.getAttribute("data-copy")); }); }); }
  function inView(els, fn, opt) {
    if (!("IntersectionObserver" in window)) { els.forEach(function (e) { fn(e, true); }); return function () {}; }
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { fn(e.target, e.isIntersecting, e); }); }, opt || { threshold: 0.2 });
    els.forEach(function (e) { io.observe(e); });
    return function () { io.disconnect(); };
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  /** A word the layout shows (menu buttons, hints): the owner's wording from content.labels, or the default. */
  function L(h, k, d) { return h.esc((h.lab && h.lab(k, d)) || d); }
  /** The owner's logo icon before the name in a header, when it is switched on for the menu. */
  function ic(h) { return h.logoIc ? h.logoIc() : ""; }

  /* =====================================================================
     1. SOLARE: type specimen. Pointer-reactive letter spacing, hover-reveal images.
     ===================================================================== */
  K.solare = {
    name: "Type specimen",
    css: [
      ".k-solare{--pad:clamp(20px,5vw,72px)}",
      ".ks-top{position:fixed;inset:0 0 auto;z-index:50;display:flex;justify-content:space-between;align-items:center;padding:18px var(--pad);font-size:12px;letter-spacing:.24em;text-transform:uppercase;mix-blend-mode:difference;color:#fff}",
      ".ks-top a{color:inherit;text-decoration:none}.ks-top nav{display:flex;gap:26px}",
      "@media(max-width:760px){.ks-top nav{display:none}}",
      ".ks-hero{min-height:100svh;display:grid;place-items:center;text-align:center;position:relative;overflow:hidden;padding:120px var(--pad) 80px}",
      ".ks-sun{position:absolute;width:min(62vw,620px);aspect-ratio:1;border-radius:50%;overflow:hidden;opacity:.55;filter:saturate(1.2);box-shadow:0 0 140px 40px color-mix(in srgb,var(--c1) 45%,transparent)}",
      ".ks-sun img{width:100%;height:100%;object-fit:cover;animation:ksspin 90s linear infinite}",
      "@keyframes ksspin{to{transform:rotate(360deg) scale(1.15)}}",
      ".ks-name{position:relative;font-family:var(--fd);font-size:clamp(54px,13vw,210px);line-height:.9;font-weight:400;text-transform:uppercase;--ls:.32em;letter-spacing:var(--ls);margin-right:calc(var(--ls)*-1);transition:letter-spacing .25s}",
      ".ks-name i{display:block;font-style:italic;text-transform:none;letter-spacing:-.02em;margin:0;color:var(--c1)}",
      ".ks-role{position:relative;max-width:520px;margin:28px auto 0;font-size:17px;color:var(--soft)}",
      ".ks-hint{position:absolute;bottom:26px;left:50%;translate:-50% 0;font-size:11px;letter-spacing:.3em;text-transform:uppercase;color:var(--soft)}",
      ".ks-hint::after{content:'';display:block;width:1px;height:42px;background:currentColor;margin:10px auto 0;animation:kshint 2s ease-in-out infinite;transform-origin:top}",
      "@keyframes kshint{50%{transform:scaleY(.3)}}",
      ".ks-sec{padding:clamp(80px,12vw,160px) var(--pad);border-top:1px solid var(--line)}",
      ".ks-lab{display:flex;justify-content:space-between;font-size:12px;letter-spacing:.24em;text-transform:uppercase;color:var(--soft);margin-bottom:48px}",
      ".ks-big{font-family:var(--fd);font-size:clamp(34px,6.4vw,96px);line-height:1;letter-spacing:-.02em;font-weight:400;max-width:15ch}",
      ".ks-big em{color:var(--c1)}",
      ".ks-cols{display:grid;grid-template-columns:1fr 1fr;gap:clamp(24px,6vw,96px);margin-top:56px;color:var(--soft);font-size:17px;line-height:1.7}",
      ".ks-cols p+p{margin-top:1em}",
      ".ks-nums{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));border-top:1px solid var(--line);margin-top:72px}",
      ".ks-nums div{padding:28px 0;border-bottom:1px solid var(--line)}",
      ".ks-nums b{display:block;font-family:var(--fd);font-weight:400;font-size:clamp(56px,8vw,120px);line-height:1;color:var(--text)}",
      ".ks-nums span{font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:var(--soft)}",
      ".ks-weights{display:grid;grid-template-columns:repeat(3,1fr);border-left:1px solid var(--line)}",
      ".ks-w{border-right:1px solid var(--line);border-bottom:1px solid var(--line);padding:28px;min-height:230px;display:flex;flex-direction:column;justify-content:space-between;transition:background .4s,color .4s;cursor:default}",
      ".ks-w h3{font-family:var(--fd);font-weight:400;font-size:clamp(30px,3.6vw,52px);line-height:1;transition:letter-spacing .5s}",
      ".ks-w p{color:var(--soft);font-size:15px;transition:color .4s}.ks-w small{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--soft)}",
      ".ks-w:hover{background:var(--c1);color:var(--on-c1)}.ks-w:hover p,.ks-w:hover small{color:inherit}.ks-w:hover h3{letter-spacing:.08em}",
      "@media(max-width:760px){.ks-weights{grid-template-columns:1fr}.ks-cols{grid-template-columns:1fr}}",
      ".ks-rows{list-style:none;padding:0;margin:0;border-top:1px solid var(--line)}",
      ".ks-row{display:grid;grid-template-columns:150px 1fr auto;gap:24px;align-items:baseline;padding:30px 0;border-bottom:1px solid var(--line);position:relative}",
      ".ks-row h3{font-family:var(--fd);font-weight:400;font-size:clamp(28px,4vw,58px);line-height:1;transition:transform .5s cubic-bezier(.2,.8,.2,1),color .3s}",
      ".ks-row:hover h3{transform:translateX(18px);color:var(--c1)}",
      ".ks-row span,.ks-row small{color:var(--soft);font-size:13px;letter-spacing:.12em;text-transform:uppercase}",
      "@media(max-width:760px){.ks-row{grid-template-columns:1fr}}",
      ".ks-float{position:fixed;left:0;top:0;width:300px;aspect-ratio:4/5;pointer-events:none;z-index:40;border-radius:6px;overflow:hidden;opacity:0;scale:.6;transition:opacity .35s,scale .45s cubic-bezier(.2,.8,.2,1)}",
      ".ks-float.on{opacity:1;scale:1}.ks-float img,.ks-float span{width:100%;height:100%;object-fit:cover;display:block}",
      ".ks-end{text-align:center}.ks-end .ks-big{margin:0 auto}",
      ".ks-mail{margin-top:42px;font:inherit;font-family:var(--fd);font-size:clamp(22px,3vw,40px);background:none;border:0;border-bottom:1px solid currentColor;color:var(--c1);cursor:pointer;padding:4px 0}",
      ".ks-links{display:flex;gap:28px;justify-content:center;margin-top:32px;flex-wrap:wrap}.ks-links a{color:var(--soft);font-size:13px;letter-spacing:.2em;text-transform:uppercase;text-decoration:none}",
      ".ks-foot{display:flex;justify-content:space-between;padding:26px var(--pad);font-size:12px;color:var(--soft);letter-spacing:.1em;border-top:1px solid var(--line)}",
    ].join("\n"),
    render: function (c, h) {
      var H = c.hero, A = c.about, i = 0;
      var spaced = h.esc(H.firstName).split("").join("");
      var out = '<header class="ks-top"><a href="#top">' + ic(h) + h.esc(c.brand.logoText) + "</a><nav>" + navOf(c).map(function (s) { return '<a href="#' + s.id + '">' + h.esc(s.navLabel) + "</a>"; }).join("") + '</nav><a href="#contact">' + h.esc(c.brand.contactLabel) + "</a></header><main id=\"top\">";
      out += '<section class="ks-hero"><div class="ks-sun">' + (H.photo ? '<img src="' + h.esc(h.imgUrl(H.photo)) + '" alt="">' : h.pimg(0, "", 1000)) + '</div><div><h1 class="ks-name" data-fx-text>' + spaced + "<i>" + h.esc(H.lastName) + "</i></h1>" + '<p class="ks-role">' + h.rich(H.role) + '</p></div><span class="ks-hint">' + L(h, "scrollHint", "Scroll to discover") + '</span></section>';
      if (on(c, "about")) out += '<section class="ks-sec" id="about"><div class="ks-lab"><span>' + h.esc(A.eyebrow) + "</span><span>01</span></div><h2 class=\"ks-big\">" + h.rich(A.storyHeading || A.title) + '</h2><div class="ks-cols"><div>' + paras(h, A.story) + "</div><div><p>" + h.rich(A.quote) + "</p><p>" + A.facts.map(function (f) { return "<b>" + h.esc(f.k) + "</b> · " + h.esc(f.v); }).join("<br>") + '</p></div></div><div class="ks-nums">' + A.stats.concat(H.meta.map(function (m) { return { value: m.value, suffix: "", label: m.label }; })).map(function (s) { return "<div><b>" + h.esc(s.value) + h.esc(s.suffix || "") + "</b><span>" + h.esc(s.label) + "</span></div>"; }).join("") + "</div></section>";
      if (on(c, "skills")) out += '<section class="ks-sec" id="skills"><div class="ks-lab"><span>' + h.esc(c.skills.eyebrow) + '</span><span>02</span></div><h2 class="ks-big" style="margin-bottom:56px">' + h.rich(c.skills.title) + '</h2><div class="ks-weights">' + c.skills.items.map(function (s) { return '<div class="ks-w"><small>' + h.esc(s.tag) + "</small><h3>" + h.esc(s.title) + "</h3><p>" + h.esc(s.body) + "</p></div>"; }).join("") + "</div></section>";
      if (on(c, "work")) out += '<section class="ks-sec" id="work"><div class="ks-lab"><span>' + h.esc(c.work.eyebrow) + '</span><span>03</span></div><h2 class="ks-big" style="margin-bottom:56px">' + h.rich(c.work.title) + '</h2><ul class="ks-rows">' + c.work.items.map(function (w) { return '<li class="ks-row" data-img="' + (i++) + '"><span>' + h.esc(w.period) + "</span><h3>" + h.esc(w.title) + "</h3><small>" + h.esc(w.org) + "</small></li>"; }).join("") + (on(c, "projects") ? c.projects.items.map(function (p) { return '<li class="ks-row" data-img="' + (i++) + '"><span>' + L(h, "project", "Project") + '</span><h3>' + h.esc(p.title) + "</h3><small>" + h.esc((p.tags || []).join(" · ")) + "</small></li>"; }).join("") : "") + "</ul></section>";
      if (on(c, "learning")) out += '<section class="ks-sec" id="learning"><div class="ks-lab"><span>' + h.esc(c.learning.eyebrow) + '</span><span>04</span></div><ul class="ks-rows">' + c.learning.items.map(function (l) { return '<li class="ks-row"><span>' + h.esc(l.period) + "</span><h3>" + h.esc(l.title) + "</h3><small>" + h.esc(l.sub) + "</small></li>"; }).join("") + "</ul></section>";
      if (on(c, "contact")) out += '<section class="ks-sec ks-end" id="contact"><div class="ks-lab"><span>' + h.esc(c.contact.eyebrow) + '</span><span>05</span></div><h2 class="ks-big">' + h.rich(c.contact.title) + "</h2>" + mail(h, c, "ks-mail") + '<div class="ks-links">' + links(h, c) + "</div></section>";
      out += '</main><footer class="ks-foot"><span>' + h.esc(c.contact.footerLeft) + "</span><span>" + h.esc(c.contact.footerRight) + '</span></footer><div class="ks-float" aria-hidden="true"></div>';
      return out;
    },
    init: function (root, c, h) {
      bindCopy(root, h);
      var name = root.querySelector(".ks-name"), hero = root.querySelector(".ks-hero"), fl = root.querySelector(".ks-float");
      var sig = { signal: h.signal };
      if (h.motion && name) hero.addEventListener("pointermove", function (e) {
        var r = name.getBoundingClientRect(), d = Math.min(1, Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) / (innerWidth * 0.6));
        name.style.setProperty("--ls", (0.05 + d * 0.4).toFixed(3) + "em");
      }, sig);
      var x = 0, y = 0, tx = 0, ty = 0, run = false, imgs = {};
      function loop() { x = lerp(x, tx, 0.15); y = lerp(y, ty, 0.15); fl.style.transform = "translate3d(" + (x + 24) + "px," + (y - 160) + "px,0) rotate(" + ((tx - x) * 0.04).toFixed(2) + "deg)"; if (run) requestAnimationFrame(loop); }
      root.querySelectorAll(".ks-row[data-img]").forEach(function (row) {
        row.addEventListener("pointerenter", function (e) {
          var k = +row.getAttribute("data-img"); if (!imgs[k]) imgs[k] = h.pimg(k, "", 600);
          fl.innerHTML = imgs[k]; fl.classList.add("on"); tx = x = e.clientX; ty = y = e.clientY; if (!run && h.motion) { run = true; loop(); }
        }, sig);
        row.addEventListener("pointermove", function (e) { tx = e.clientX; ty = e.clientY; if (!h.motion) fl.style.transform = "translate3d(" + (tx + 24) + "px," + (ty - 160) + "px,0)"; }, sig);
        row.addEventListener("pointerleave", function () { fl.classList.remove("on"); run = false; }, sig);
      });
    },
  };

  /* =====================================================================
     2. TECH LEAD: sticky profile sidebar + dashboard. Active-section tracking, live clock, sparklines.
     ===================================================================== */
  K["tech-lead"] = {
    name: "Profile dashboard",
    css: [
      ".k-tech-lead{display:grid;grid-template-columns:minmax(260px,340px) 1fr;min-height:100vh;max-width:1360px;margin:0 auto}",
      "@media(max-width:900px){.k-tech-lead{grid-template-columns:1fr}}",
      ".kt-side{position:sticky;top:0;height:100vh;padding:40px 32px;display:flex;flex-direction:column;gap:22px;border-right:1px solid var(--line)}",
      "@media(max-width:900px){.kt-side{position:relative;height:auto;border-right:0;border-bottom:1px solid var(--line)}}",
      ".kt-av{width:92px;height:92px;border-radius:50%;overflow:hidden;box-shadow:0 0 0 4px var(--surface),0 0 0 5px var(--line)}",
      ".kt-av img,.kt-av span{width:100%;height:100%;object-fit:cover}",
      ".kt-side h1{font-family:var(--fd);font-size:28px;line-height:1.1;letter-spacing:-.02em}",
      ".kt-side p{color:var(--soft);font-size:15px}",
      ".kt-status{display:inline-flex;align-items:center;gap:8px;font-size:13px;color:var(--soft)}.kt-status i{width:8px;height:8px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 0 #22c55e;animation:ktping 2s infinite}",
      "@keyframes ktping{70%{box-shadow:0 0 0 8px transparent}}",
      ".kt-nav{display:flex;flex-direction:column;gap:2px;margin-top:8px}",
      ".kt-nav a{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;color:var(--soft);text-decoration:none;font-size:15px;transition:background .2s,color .2s}",
      ".kt-nav a::before{content:'';width:14px;height:1px;background:currentColor;transition:width .3s}",
      ".kt-nav a.on{color:var(--text);background:var(--surface)}.kt-nav a.on::before{width:28px;background:var(--c1)}",
      ".kt-links{display:flex;flex-wrap:wrap;gap:8px;margin-top:auto}.kt-links a,.kt-links button{font:inherit;font-size:13px;padding:7px 12px;border-radius:999px;border:1px solid var(--line);color:var(--text);background:none;text-decoration:none;cursor:pointer}",
      ".kt-links a:hover,.kt-links button:hover{border-color:var(--c1);color:var(--c1)}",
      ".kt-main{padding:56px clamp(20px,4vw,64px);display:flex;flex-direction:column;gap:96px;min-width:0}",
      ".kt-hero h2{font-family:var(--fd);font-size:clamp(34px,4.6vw,64px);line-height:1.05;letter-spacing:-.035em;max-width:18ch}",
      ".kt-hero h2 em{color:var(--c1);font-style:normal}",
      ".kt-strip{display:flex;gap:14px;margin-top:40px}",
      ".kt-strip figure{flex:1;margin:0;aspect-ratio:3/4;border-radius:14px;overflow:hidden;transition:transform .5s cubic-bezier(.2,.8,.2,1),flex .5s}",
      ".kt-strip figure:nth-child(odd){transform:rotate(-2.5deg)}.kt-strip figure:nth-child(even){transform:rotate(2deg) translateY(12px)}",
      ".kt-strip figure:hover{transform:none;flex:1.6}.kt-strip img,.kt-strip span{width:100%;height:100%;object-fit:cover}",
      "@media(max-width:700px){.kt-strip figure:nth-child(n+4){display:none}}",
      ".kt-h{display:flex;align-items:baseline;justify-content:space-between;gap:16px;margin-bottom:24px}",
      ".kt-h h3{font-family:var(--fd);font-size:26px;letter-spacing:-.02em}.kt-h span{color:var(--soft);font-size:14px}",
      ".kt-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px}",
      ".kt-stat{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:20px;position:relative;overflow:hidden}",
      ".kt-stat small{color:var(--soft);font-size:13px}.kt-stat b{display:block;font-family:var(--fd);font-size:44px;letter-spacing:-.03em;margin:6px 0}",
      ".kt-stat em{font-style:normal;font-size:13px;font-weight:700;color:#16a34a}",
      ".kt-spark{width:100%;height:46px;margin-top:8px}.kt-spark path{fill:none;stroke:var(--c1);stroke-width:2;stroke-dasharray:400;stroke-dashoffset:400;transition:stroke-dashoffset 1.6s ease}",
      ".kt-spark .area{fill:color-mix(in srgb,var(--c1) 14%,transparent);stroke:none;opacity:0;transition:opacity 1s .8s}",
      ".kt-stat.in .kt-spark path{stroke-dashoffset:0}.kt-stat.in .kt-spark .area{opacity:1}",
      ".kt-skills{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}",
      ".kt-skill{display:flex;gap:14px;align-items:flex-start;padding:16px;border-radius:14px;border:1px solid var(--line)}",
      ".kt-skill .shp{flex:none}.kt-skill h4{font-size:16px}.kt-skill p{color:var(--soft);font-size:14px}",
      ".kt-work{list-style:none;margin:0;padding:0;counter-reset:w}",
      ".kt-job{display:grid;grid-template-columns:52px 1fr auto;gap:18px;padding:22px 0;border-top:1px solid var(--line);align-items:start}",
      ".kt-logo{width:52px;height:52px;border-radius:12px;display:grid;place-items:center;font-family:var(--fd);font-weight:800;font-size:20px;color:var(--on-c1);background:var(--c1)}",
      ".kt-job:nth-child(3n+2) .kt-logo{background:var(--c2)}.kt-job:nth-child(3n) .kt-logo{background:var(--c3);color:var(--text)}",
      ".kt-job h4{font-size:18px}.kt-job p{color:var(--soft);font-size:15px}.kt-job ul{margin:8px 0 0 18px;color:var(--soft);font-size:14px}.kt-job time{color:var(--soft);font-size:13px;white-space:nowrap}",
      ".kt-projects{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px}",
      ".kt-proj{border:1px solid var(--line);border-radius:16px;overflow:hidden;background:var(--surface);text-decoration:none;color:inherit;display:flex;flex-direction:column}",
      ".kt-proj figure{margin:0;aspect-ratio:16/10;overflow:hidden}.kt-proj img,.kt-proj figure span{width:100%;height:100%;object-fit:cover;transition:transform .6s}",
      ".kt-proj:hover img{transform:scale(1.05)}.kt-proj div{padding:16px}.kt-proj h4{font-size:17px}.kt-proj p{color:var(--soft);font-size:14px;margin-top:4px}",
      ".kt-badges{display:flex;flex-wrap:wrap;gap:12px}.kt-badge{display:flex;gap:12px;align-items:center;padding:12px 16px 12px 12px;border-radius:999px;background:var(--surface);border:1px solid var(--line)}",
      ".kt-badge b{display:block;font-size:14px}.kt-badge span{font-size:12px;color:var(--soft)}",
      ".kt-cta{border-radius:22px;padding:36px;background:var(--deep);color:var(--on-deep)}.kt-cta h3{font-family:var(--fd);font-size:clamp(26px,3vw,40px);letter-spacing:-.02em}",
      ".kt-cta p{opacity:.75;margin:10px 0 20px}.kt-cta button{font:inherit;font-weight:700;padding:12px 18px;border-radius:12px;border:0;background:var(--c1);color:var(--on-c1);cursor:pointer}",
    ].join("\n"),
    render: function (c, h) {
      var H = c.hero, A = c.about;
      var av = H.photo ? '<img src="' + h.esc(h.imgUrl(H.photo)) + '" alt="' + h.esc(name(c)) + '">' : h.pimg(0, "", 300);
      var out = '<aside class="kt-side"><div class="kt-av">' + av + '</div><div><h1>' + h.esc(name(c)) + "</h1><p>" + h.esc(H.eyebrow) + '</p></div><span class="kt-status"><i></i><span data-clock>' + L(h, "available", "Available") + '</span></span><nav class="kt-nav">' + navOf(c).map(function (s) { return '<a href="#' + s.id + '" data-nav="' + s.id + '">' + h.esc(s.navLabel) + "</a>"; }).join("") + (on(c, "contact") ? '<a href="#contact" data-nav="contact">' + h.esc(c.brand.contactLabel) + "</a>" : "") + '</nav><div class="kt-links">' + links(h, c) + mail(h, c) + "</div></aside><main class=\"kt-main\" id=\"top\">";
      out += '<section class="kt-hero"><h2 data-fx-text>' + h.rich(H.role) + '</h2><div class="kt-strip">' + [0, 1, 2, 3, 4].map(function (k) { return "<figure>" + h.pimg(k, "", 500) + "</figure>"; }).join("") + "</div></section>";
      if (on(c, "about")) {
        var stats = A.stats.map(function (s) { return { v: +s.value || 0, suf: s.suffix || "", l: s.label }; }).concat(H.meta.filter(function (m) { return /\d/.test(m.value); }).map(function (m) { return { v: parseFloat(m.value) || 0, suf: String(m.value).replace(/[\d.]/g, ""), l: m.label }; }));
        out += '<section id="about"><div class="kt-h"><h3>' + h.esc(A.eyebrow) + "</h3><span>" + h.esc(A.lede) + '</span></div><div class="kt-stats">' + stats.map(function (s, i) {
          var pts = [], v = 10; for (var k = 0; k < 12; k++) { v = Math.max(4, Math.min(40, v + ((k * 7 + i * 13) % 11) - 3)); pts.push([k * 18, 46 - v]); }
          var d = "M" + pts.map(function (p) { return p.join(" "); }).join("L");
          return '<div class="kt-stat"><small>' + h.esc(s.l) + '</small><b data-to="' + s.v + '" data-suf="' + h.esc(s.suf) + '">0</b><em>↑ ' + (12 + i * 9) + '%</em><svg class="kt-spark" viewBox="0 0 198 46" preserveAspectRatio="none"><path class="area" d="' + d + 'L198 46L0 46Z"/><path d="' + d + '"/></svg></div>';
        }).join("") + '</div><div style="margin-top:28px;color:var(--soft);max-width:70ch;font-size:17px;line-height:1.7">' + paras(h, A.story) + "</div></section>";
      }
      if (on(c, "skills")) out += '<section id="skills"><div class="kt-h"><h3>' + h.esc(c.skills.eyebrow) + "</h3><span>" + h.esc(c.skills.title) + '</span></div><div class="kt-skills">' + c.skills.items.map(function (s) { return '<div class="kt-skill">' + h.mo(s.shape, "var(--" + (s.color === "surface" || s.color === "deep" ? "c1" : s.color) + ")", 36) + "<div><h4>" + h.esc(s.title) + "</h4><p>" + h.esc(s.detail) + "</p></div></div>"; }).join("") + "</div></section>";
      if (on(c, "work")) out += '<section id="work"><div class="kt-h"><h3>' + h.esc(c.work.eyebrow) + '</h3></div><ol class="kt-work">' + c.work.items.map(function (w) { return '<li class="kt-job"><span class="kt-logo">' + h.esc((w.org || "?").trim()[0]) + "</span><div><h4>" + h.esc(w.title) + "</h4><p>" + h.esc(w.org) + (w.orgNote ? " · " + h.esc(w.orgNote) : "") + "</p>" + (w.bullets.length ? "<ul>" + w.bullets.map(function (b) { return "<li>" + h.esc(b) + "</li>"; }).join("") + "</ul>" : "") + "</div><time>" + h.esc(w.period) + "</time></li>"; }).join("") + "</ol></section>";
      if (on(c, "projects")) { var pr = projectsOf(c); out += '<section id="projects"><div class="kt-h"><h3>' + h.esc(c.projects.title) + "</h3><span>" + h.esc(c.projects.lede) + '</span></div><div class="kt-projects">' + pr.map(function (p, i) { return '<a class="kt-proj" ' + (p.url ? 'href="' + h.esc(h.safeUrl(p.url)) + '" target="_blank" rel="noopener"' : "") + "><figure>" + h.itemImg(p, i + 2, p.title, 700) + "</figure><div><h4>" + h.esc(p.title) + "</h4><p>" + h.esc(p.body) + "</p></div></a>"; }).join("") + "</div></section>"; }
      if (on(c, "learning")) out += '<section id="learning"><div class="kt-h"><h3>' + h.esc(c.learning.title) + '</h3></div><div class="kt-badges">' + c.learning.items.map(function (l) { return '<div class="kt-badge">' + h.mo(l.shape, "var(--c1)", 34) + "<div><b>" + h.esc(l.title) + "</b><span>" + h.esc(l.sub) + " · " + h.esc(l.period) + "</span></div></div>"; }).join("") + "</div></section>";
      if (on(c, "contact")) out += '<section id="contact" class="kt-cta"><h3>' + h.rich(c.contact.title) + "</h3><p>" + h.esc(c.contact.body) + "</p>" + (c.contact.email ? '<button type="button" data-copy="' + h.esc(c.contact.email) + '">' + h.esc(c.contact.copyLabel) + " · " + h.esc(c.contact.email) + "</button>" : "") + "</section>";
      return out + '<footer style="color:var(--soft);font-size:13px;display:flex;justify-content:space-between"><span>' + h.esc(c.contact.footerLeft) + "</span><span>" + h.esc(c.contact.footerRight) + "</span></footer></main>";
    },
    init: function (root, c, h) {
      bindCopy(root, h);
      var navs = root.querySelectorAll("[data-nav]"), clock = root.querySelector("[data-clock]");
      var stop1 = inView(Array.prototype.slice.call(root.querySelectorAll("main section[id]")), function (el, vis) {
        if (vis) navs.forEach(function (a) { a.classList.toggle("on", a.getAttribute("data-nav") === el.id); });
      }, { rootMargin: "-45% 0px -50% 0px" });
      var stop2 = inView(Array.prototype.slice.call(root.querySelectorAll(".kt-stat")), function (el, vis) {
        if (!vis || el.classList.contains("in")) return; el.classList.add("in");
        var b = el.querySelector("b"), to = +b.getAttribute("data-to"), suf = b.getAttribute("data-suf"), t0 = performance.now();
        (function step(t) { var p = h.motion ? Math.min(1, (t - t0) / 1400) : 1; b.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))) + suf; if (p < 1) requestAnimationFrame(step); })(t0);
      });
      function tick() { if (clock) clock.textContent = "Available · " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + " local"; }
      tick(); var iv = setInterval(tick, 20000);
      return function () { stop1(); stop2(); clearInterval(iv); };
    },
  };

  /* =====================================================================
     3. KINETIC NOIR: horizontal scroll track driven by vertical scroll.
     ===================================================================== */
  K["kinetic-noir"] = {
    name: "Horizontal reel",
    css: [
      ".kk-top{position:fixed;inset:0 0 auto;z-index:50;display:flex;justify-content:space-between;padding:18px 28px;font-family:var(--fd);text-transform:uppercase;letter-spacing:.06em;font-size:15px}",
      ".kk-top a{color:var(--text);text-decoration:none}",
      ".kk-pin{position:relative}.kk-view{position:sticky;top:0;height:100vh;overflow:hidden}",
      ".kk-track{display:flex;height:100%;will-change:transform}",
      ".kk-p{flex:none;height:100%;padding:90px 5vw 70px;display:flex;flex-direction:column;justify-content:center;border-right:1px solid var(--line);position:relative}",
      ".kk-hero{width:100vw}.kk-hero h1{font-family:var(--fd);text-transform:uppercase;font-size:clamp(70px,17vw,300px);line-height:.82;letter-spacing:-.02em}",
      ".kk-hero h1 span{display:block}.kk-hero h1 .o{color:transparent;-webkit-text-stroke:2px var(--text)}",
      ".kk-hero p{max-width:440px;margin-top:28px;font-size:18px;color:var(--soft)}",
      ".kk-tag{position:absolute;top:90px;left:5vw;font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:var(--c1)}",
      ".kk-w{width:min(80vw,820px)}.kk-w h2{font-family:var(--fd);text-transform:uppercase;font-size:clamp(44px,7vw,110px);line-height:.9}",
      ".kk-w p{color:var(--soft);font-size:17px;max-width:52ch;margin-top:20px;line-height:1.6}",
      ".kk-num{font-family:var(--fd);font-size:clamp(120px,22vw,340px);line-height:.8;color:transparent;-webkit-text-stroke:1.5px var(--line);position:absolute;right:4vw;bottom:40px;pointer-events:none}",
      ".kk-job{width:min(86vw,980px);display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:center}",
      ".kk-job figure{margin:0;height:62vh;overflow:hidden;clip-path:inset(0 100% 0 0);transition:clip-path 1.1s cubic-bezier(.7,0,.2,1)}",
      ".kk-job.in figure{clip-path:inset(0 0 0 0)}.kk-job img,.kk-job figure span{width:100%;height:100%;object-fit:cover;scale:1.2}",
      ".kk-job h3{font-family:var(--fd);text-transform:uppercase;font-size:clamp(36px,5vw,76px);line-height:.9}",
      ".kk-job .org{color:var(--c1);font-size:14px;letter-spacing:.2em;text-transform:uppercase;margin:16px 0}",
      ".kk-job ul{color:var(--soft);margin-left:18px;line-height:1.6}",
      ".kk-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--line);margin-top:30px;border:1px solid var(--line)}",
      ".kk-grid div{background:var(--bg);padding:22px;transition:background .3s,color .3s}.kk-grid div:hover{background:var(--c1);color:var(--on-c1)}",
      ".kk-grid h4{font-family:var(--fd);text-transform:uppercase;font-size:24px}.kk-grid p{font-size:14px;opacity:.75}",
      ".kk-end{width:100vw;align-items:flex-start}.kk-end h2{font-family:var(--fd);text-transform:uppercase;font-size:clamp(50px,10vw,170px);line-height:.85}",
      ".kk-end button{margin-top:30px;font:inherit;font-family:var(--fd);text-transform:uppercase;font-size:clamp(20px,3vw,36px);background:var(--c1);color:var(--on-c1);border:0;padding:16px 26px;cursor:pointer}",
      ".kk-end .lk{display:flex;gap:24px;margin-top:24px}.kk-end .lk a{color:var(--soft);text-transform:uppercase;letter-spacing:.14em;font-size:13px;text-decoration:none}",
      ".kk-bar{position:fixed;left:28px;right:28px;bottom:22px;z-index:50;display:flex;align-items:center;gap:16px;font-size:12px;letter-spacing:.2em;font-family:var(--fd)}",
      ".kk-bar i{flex:1;height:2px;background:var(--line);position:relative}.kk-bar i b{position:absolute;inset:0;background:var(--c1);transform-origin:0 50%;transform:scaleX(0)}",
      "@media(max-width:760px){.kk-view{position:relative;height:auto}.kk-track{flex-direction:column;transform:none!important}.kk-p{width:100%!important;height:auto;min-height:80vh;border-right:0;border-bottom:1px solid var(--line)}.kk-job{grid-template-columns:1fr}.kk-job figure{height:44vh;clip-path:none}.kk-grid{grid-template-columns:1fr 1fr}.kk-bar{display:none}}",
    ].join("\n"),
    render: function (c, h) {
      var H = c.hero, A = c.about, n = 0, panels = [];
      panels.push('<section class="kk-p kk-hero" id="top"><span class="kk-tag">' + h.esc(H.eyebrow) + '</span><h1 data-fx-text><span>' + h.esc(H.firstName) + '</span><span class="o">' + h.esc(H.lastName) + "</span></h1><p>" + h.rich(H.role) + "</p></section>");
      if (on(c, "about")) panels.push('<section class="kk-p kk-w" id="about"><span class="kk-tag">' + h.esc(A.eyebrow) + "</span><h2>" + h.rich(A.title) + "</h2>" + paras(h, A.story) + '<span class="kk-num">0' + (++n) + "</span></section>");
      if (on(c, "skills")) panels.push('<section class="kk-p kk-w" id="skills" style="width:min(92vw,1100px)"><span class="kk-tag">' + h.esc(c.skills.eyebrow) + "</span><h2>" + h.rich(c.skills.title) + '</h2><div class="kk-grid">' + c.skills.items.map(function (s) { return "<div><h4>" + h.esc(s.title) + "</h4><p>" + h.esc(s.detail) + "</p></div>"; }).join("") + '</div><span class="kk-num">0' + (++n) + "</span></section>");
      if (on(c, "work")) c.work.items.forEach(function (w, i) { panels.push('<section class="kk-p kk-job" ' + (i ? "" : 'id="work"') + "><figure>" + h.itemImg(w, i, w.title, 900) + '</figure><div><span class="kk-tag" style="position:static">' + h.esc(w.period) + "</span><h3>" + h.esc(w.title) + '</h3><p class="org">' + h.esc(w.org) + "</p>" + (w.bullets.length ? "<ul>" + w.bullets.map(function (b) { return "<li>" + h.esc(b) + "</li>"; }).join("") + "</ul>" : "") + "</div></section>"); });
      if (on(c, "projects") && c.projects.items.length) c.projects.items.forEach(function (p, i) { panels.push('<section class="kk-p kk-job" ' + (i ? "" : 'id="projects"') + "><figure>" + h.itemImg(p, i + 3, p.title, 900) + '</figure><div><span class="kk-tag" style="position:static">' + L(h, "project", "Project") + '</span><h3>' + h.esc(p.title) + '</h3><p style="color:var(--soft)">' + h.esc(p.body) + "</p></div></section>"); });
      if (on(c, "learning")) panels.push('<section class="kk-p kk-w" id="learning"><span class="kk-tag">' + h.esc(c.learning.eyebrow) + "</span><h2>" + h.rich(c.learning.title) + "</h2>" + c.learning.items.map(function (l) { return '<p style="color:var(--text);font-size:20px"><b>' + h.esc(l.title) + '</b> <span style="color:var(--soft)">' + h.esc(l.sub) + " · " + h.esc(l.period) + "</span></p>"; }).join("") + "</section>");
      if (on(c, "contact")) panels.push('<section class="kk-p kk-end" id="contact"><span class="kk-tag">' + h.esc(c.contact.eyebrow) + "</span><h2>" + h.rich(c.contact.title) + "</h2>" + (c.contact.email ? '<button type="button" data-copy="' + h.esc(c.contact.email) + '">' + h.esc(c.contact.email) + "</button>" : "") + '<div class="lk">' + links(h, c) + "</div></section>");
      return '<header class="kk-top"><a href="#top">' + ic(h) + h.esc(c.brand.logoText) + '</a><a href="#contact">' + h.esc(c.brand.contactLabel) + '</a></header><main class="kk-pin"><div class="kk-view"><div class="kk-track">' + panels.join("") + '</div></div></main><div class="kk-bar"><span data-i>01</span><i><b></b></i><span>' + String(panels.length).padStart(2, "0") + "</span></div>";
    },
    init: function (root, c, h) {
      bindCopy(root, h);
      var pin = root.querySelector(".kk-pin"), track = root.querySelector(".kk-track"), bar = root.querySelector(".kk-bar b"), idx = root.querySelector("[data-i]"), panels = root.querySelectorAll(".kk-p");
      var mobile = matchMedia("(max-width:760px)"), cur = 0, target = 0, run = false;
      function size() { pin.style.height = mobile.matches ? "" : (track.scrollWidth - innerWidth + innerHeight) + "px"; }
      function read() { var r = pin.getBoundingClientRect(), max = track.scrollWidth - innerWidth; target = Math.max(0, Math.min(max, -r.top)); if (!run) { run = true; requestAnimationFrame(step); } }
      function step() {
        cur = h.motion ? lerp(cur, target, 0.12) : target; if (Math.abs(cur - target) < 0.5) { cur = target; run = false; }
        if (!mobile.matches) track.style.transform = "translate3d(" + (-cur).toFixed(1) + "px,0,0)";
        var max = Math.max(1, track.scrollWidth - innerWidth), p = cur / max;
        bar.style.transform = "scaleX(" + p + ")";
        var i = 0; panels.forEach(function (el, k) { if (el.offsetLeft - innerWidth * 0.5 <= cur) i = k; el.classList.toggle("in", el.offsetLeft - innerWidth * 0.75 < cur); });
        idx.textContent = String(i + 1).padStart(2, "0");
        if (run) requestAnimationFrame(step);
      }
      size(); read();
      addEventListener("scroll", read, { passive: true, signal: h.signal });
      addEventListener("resize", function () { size(); read(); }, { signal: h.signal });
      // anchor links: scroll to the panel's horizontal position
      root.querySelectorAll('a[href^="#"]').forEach(function (a) {
        a.addEventListener("click", function (e) {
          var el = root.querySelector(a.getAttribute("href")); if (!el || mobile.matches) return;
          e.preventDefault(); e.stopPropagation();
          scrollTo({ top: pin.offsetTop + (el.id === "top" ? 0 : el.offsetLeft), behavior: h.motion ? "smooth" : "auto" });
        }, { signal: h.signal });
      });
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { size(); read(); });
      return function () { pin.style.height = ""; };
    },
  };

  /* =====================================================================
     4. DECODE: a working terminal. Typed commands, clickable file tree, history.
     ===================================================================== */
  K.decode = {
    name: "Terminal",
    css: [
      ".k-decode{min-height:100vh;display:grid;place-items:center;padding:clamp(10px,3vw,40px)}",
      ".kd-win{width:min(1180px,100%);height:min(86vh,900px);display:grid;grid-template-rows:auto 1fr auto;border:1px solid var(--line);border-radius:12px;background:var(--surface);box-shadow:0 0 0 1px color-mix(in srgb,var(--c1) 20%,transparent),0 40px 120px -40px color-mix(in srgb,var(--c1) 45%,transparent);overflow:hidden;font-family:var(--fb)}",
      ".kd-bar{display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--line);font-size:13px;color:var(--soft)}",
      ".kd-bar i{width:11px;height:11px;border-radius:50%;background:var(--c2)}.kd-bar i+i{background:var(--c3)}.kd-bar i+i+i{background:var(--c1)}.kd-bar span{margin-left:10px}",
      ".kd-body{display:grid;grid-template-columns:220px 1fr;min-height:0}",
      "@media(max-width:760px){.kd-body{grid-template-columns:1fr}.kd-tree{display:none}}",
      ".kd-tree{border-right:1px solid var(--line);padding:14px;font-size:14px;overflow:auto}",
      ".kd-tree b{display:block;color:var(--soft);font-weight:400;margin-bottom:8px}",
      ".kd-tree button{display:block;width:100%;text-align:left;font:inherit;background:none;border:0;color:var(--text);padding:5px 8px;border-radius:6px;cursor:pointer}",
      ".kd-tree button:hover,.kd-tree button.on{background:color-mix(in srgb,var(--c1) 18%,transparent);color:var(--c1)}",
      ".kd-out{overflow:auto;padding:18px 22px;font-size:15px;line-height:1.6}",
      ".kd-out .cmd{color:var(--c1)}.kd-out .cmd::before{content:'❯ ';color:var(--c3)}",
      ".kd-out .blk{margin:6px 0 18px;white-space:pre-wrap}.kd-out .dim{color:var(--soft)}.kd-out h1{font-family:var(--fd);font-size:clamp(28px,5vw,60px);line-height:1;color:var(--c1);margin:8px 0;text-shadow:0 0 18px color-mix(in srgb,var(--c1) 55%,transparent)}",
      ".kd-out a,.kd-out button.lnk{color:var(--c3);font:inherit;background:none;border:0;padding:0;cursor:pointer;text-decoration:underline}",
      ".kd-out table{border-collapse:collapse}.kd-out td{padding:2px 18px 2px 0;vertical-align:top}",
      ".kd-out .bar{display:inline-block;height:10px;background:var(--c1);vertical-align:middle;box-shadow:0 0 10px var(--c1)}",
      ".kd-in{display:flex;align-items:center;gap:8px;padding:12px 18px;border-top:1px solid var(--line)}",
      ".kd-in label{color:var(--c3);white-space:nowrap}.kd-in input{flex:1;font:inherit;font-size:15px;background:none;border:0;outline:0;color:var(--text);caret-color:var(--c1)}",
      ".kd-chips{display:flex;gap:6px;flex-wrap:wrap}.kd-chips button{font:inherit;font-size:12px;padding:3px 9px;border:1px solid var(--line);border-radius:999px;background:none;color:var(--soft);cursor:pointer}",
      ".kd-chips button:hover{color:var(--c1);border-color:var(--c1)}",
      ".kd-photo{width:120px;height:120px;object-fit:cover;filter:grayscale(1) contrast(1.2);border:1px solid var(--line);float:right;margin:0 0 10px 14px}",
    ].join("\n"),
    render: function (c, h) {
      var user = (c.hero.firstName || "guest").toLowerCase().replace(/[^a-z0-9]/g, "") || "guest";
      var files = [["whoami", "~/" + user], ["about", "about.md"], ["skills", "skills/"], ["work", "work.log"], ["projects", "projects/"], ["learning", "learning.txt"], ["contact", "contact.sh"]].filter(function (f) { return f[0] === "whoami" || on(c, f[0]); });
      return '<main id="top"><div class="kd-win"><div class="kd-bar"><i></i><i></i><i></i><span>' + h.esc(user) + "@portfolio: ~ — " + ic(h) + h.esc(c.brand.logoText) + '</span></div><div class="kd-body"><nav class="kd-tree" aria-label="Sections"><b>EXPLORER</b>' + files.map(function (f) { return '<button type="button" data-run="' + f[0] + '">' + (f[1].slice(-1) === "/" ? "▸ " : "· ") + h.esc(f[1]) + "</button>"; }).join("") + '</nav><div class="kd-out" aria-live="polite" tabindex="0"></div></div><form class="kd-in"><label for="kd-cmd">' + h.esc(user) + ' ~ ❯</label><input id="kd-cmd" autocomplete="off" spellcheck="false" placeholder="type help, or click a file"><div class="kd-chips">' + files.slice(1).map(function (f) { return '<button type="button" data-run="' + f[0] + '">' + f[0] + "</button>"; }).join("") + "</div></form></div></main>" +
        '<noscript><h1>' + h.esc(name(c)) + "</h1><p>" + h.esc(c.hero.role) + "</p></noscript>";
    },
    init: function (root, c, h) {
      var out = root.querySelector(".kd-out"), form = root.querySelector(".kd-in"), input = root.querySelector("#kd-cmd"), hist = [], hi = 0, busy = Promise.resolve();
      var A = c.about;
      function bar(n, max) { return '<span class="bar" style="width:' + Math.round(8 + (n / max) * 140) + 'px"></span>'; }
      var CMDS = {
        help: function () { return '<span class="dim">Commands:</span> ' + Object.keys(CMDS).filter(function (k) { return k !== "help" && (k === "whoami" || k === "clear" || on(c, k)); }).map(function (k) { return '<button class="lnk" type="button" data-run="' + k + '">' + k + "</button>"; }).join("  ") + '\n<span class="dim">Tip: ↑/↓ for history, Tab to complete.</span>'; },
        whoami: function () { return (c.hero.photo ? '<img class="kd-photo" alt="" src="' + h.esc(h.imgUrl(c.hero.photo)) + '">' : "") + '<span class="dim">' + h.esc(c.hero.eyebrow) + "</span><h1>" + h.esc(name(c)) + "</h1>" + h.rich(c.hero.role) + "\n" + c.hero.meta.map(function (m) { return '<span class="dim">' + h.esc(m.label) + ":</span> " + h.esc(m.value); }).join("   "); },
        about: function () { return "<b>" + h.rich(A.storyHeading) + "</b>\n\n" + h.esc(A.story) + "\n\n" + A.stats.map(function (s) { return h.esc(s.label) + ": " + h.esc(s.value) + h.esc(s.suffix); }).join("\n") + "\n" + A.facts.map(function (f) { return '<span class="dim">' + h.esc(f.k).padEnd(8) + "</span> " + h.esc(f.v); }).join("\n"); },
        skills: function () { var n = c.skills.items.length; return "<table>" + c.skills.items.map(function (s, i) { return "<tr><td>" + h.esc(s.title) + "</td><td>" + bar(n - i, n) + '</td><td class="dim">' + h.esc(s.detail) + "</td></tr>"; }).join("") + "</table>"; },
        work: function () { return c.work.items.map(function (w) { return '<span class="dim">[' + h.esc(w.period) + "]</span> <b>" + h.esc(w.title) + "</b> @ " + h.esc(w.org) + (w.current ? ' <span style="color:var(--c1)">● now</span>' : "") + "\n" + w.bullets.map(function (b) { return "  └ " + h.esc(b); }).join("\n"); }).join("\n\n"); },
        projects: function () { return projectsOf(c).map(function (p) { return "<b>" + h.esc(p.title) + "</b> — " + h.esc(p.body) + (p.url ? ' <a href="' + h.esc(h.safeUrl(p.url)) + '" target="_blank" rel="noopener">open ↗</a>' : ""); }).join("\n"); },
        learning: function () { return c.learning.items.map(function (l) { return '<span class="dim">' + h.esc(l.period) + "</span>  " + h.esc(l.title) + ", " + h.esc(l.sub); }).join("\n") + (c.learning.languages.length ? '\n\n<span class="dim">' + h.esc(c.learning.languagesLabel) + ":</span> " + c.learning.languages.map(h.esc).join(", ") : ""); },
        contact: function () { return h.rich(c.contact.title) + "\n" + h.esc(c.contact.body) + "\n\n" + (c.contact.email ? '<button class="lnk" type="button" data-copy="' + h.esc(c.contact.email) + '">' + h.esc(c.contact.email) + "</button> (click to copy)\n" : "") + c.contact.links.map(function (l) { return '<a href="' + h.esc(h.safeUrl(l.url)) + '" target="_blank" rel="noopener">' + h.esc(l.label) + "</a>"; }).join("  "); },
        clear: function () { out.innerHTML = ""; return null; },
      };
      function print(cmd) {
        var key = cmd.trim().toLowerCase().split(/\s+/)[0].replace(/\.(md|log|txt|sh)$|\/$/, "");
        if (key === "cat" || key === "ls" || key === "cd" || key === "./contact") key = cmd.trim().toLowerCase().split(/\s+/)[1] ? cmd.trim().toLowerCase().split(/\s+/)[1].replace(/\.(md|log|txt|sh)$|\/$/, "") : "help";
        if (key === "contact.sh") key = "contact";
        root.querySelectorAll(".kd-tree button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-run") === key); });
        busy = busy.then(function () {
          return new Promise(function (res) {
            var line = document.createElement("div"); line.className = "cmd"; out.appendChild(line);
            var i = 0, text = cmd;
            (function type() {
              line.textContent = text.slice(0, ++i);
              if (i < text.length && h.motion) setTimeout(type, 28 + Math.random() * 40);
              else {
                var fn = CMDS[key], html = fn ? fn() : '<span class="dim">command not found: ' + h.esc(key) + ". Try </span><button class=\"lnk\" type=\"button\" data-run=\"help\">help</button>";
                if (html !== null) { var blk = document.createElement("div"); blk.className = "blk"; blk.innerHTML = html; out.appendChild(blk); blk.querySelectorAll("[data-copy]").forEach(function (b) { b.addEventListener("click", function () { h.copy(b.getAttribute("data-copy")); }); }); }
                out.scrollTop = out.scrollHeight; setTimeout(res, h.motion ? 120 : 0);
              }
            })();
          });
        });
      }
      root.addEventListener("click", function (e) { var b = e.target.closest("[data-run]"); if (b) { e.preventDefault(); print(b.getAttribute("data-run") === "whoami" ? "whoami" : "cat " + b.getAttribute("data-run")); input.focus({ preventScroll: true }); } }, { signal: h.signal });
      form.addEventListener("submit", function (e) { e.preventDefault(); var v = input.value.trim(); if (!v) return; hist.push(v); hi = hist.length; input.value = ""; print(v); }, { signal: h.signal });
      input.addEventListener("keydown", function (e) {
        if (e.key === "ArrowUp" && hist.length) { hi = Math.max(0, hi - 1); input.value = hist[hi]; e.preventDefault(); }
        else if (e.key === "ArrowDown") { hi = Math.min(hist.length, hi + 1); input.value = hist[hi] || ""; e.preventDefault(); }
        else if (e.key === "Tab") { var m = Object.keys(CMDS).filter(function (k) { return k.indexOf(input.value) === 0; }); if (m.length === 1) { input.value = m[0]; e.preventDefault(); } }
      }, { signal: h.signal });
      print("whoami"); print("help");
    },
  };

  /* =====================================================================
     5. GALLERY: an endless canvas you drag around, with a detail viewer.
     ===================================================================== */
  K.gallery = {
    name: "Drag canvas",
    css: [
      ".k-gallery{height:100vh;overflow:hidden;position:relative;cursor:grab;touch-action:none;user-select:none}",
      ".k-gallery.drag{cursor:grabbing}",
      ".kg-top{position:fixed;inset:0 0 auto;z-index:20;display:flex;justify-content:space-between;align-items:center;padding:20px 28px;pointer-events:none}",
      ".kg-top>*{pointer-events:auto}.kg-top h1{font-family:var(--fd);font-weight:400;text-transform:uppercase;letter-spacing:.18em;font-size:15px}",
      ".kg-top p{font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:var(--soft)}",
      ".kg-top button{font:inherit;font-size:12px;letter-spacing:.16em;text-transform:uppercase;padding:9px 14px;border:1px solid var(--text);background:var(--bg);color:var(--text);cursor:pointer}",
      ".kg-plane{position:absolute;inset:0}",
      ".kg-t{position:absolute;left:0;top:0;will-change:transform;transition:box-shadow .4s}",
      ".kg-t>div{width:100%;height:100%;transition:transform .6s cubic-bezier(.2,.8,.2,1)}",
      ".kg-t:hover>div{transform:scale(1.04)}",
      ".kg-ph{overflow:hidden;background:var(--surface)}.kg-ph img,.kg-ph span.mo-fallback{width:100%;height:100%;object-fit:cover;pointer-events:none}",
      ".kg-cap{position:absolute;left:0;bottom:-26px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--soft);white-space:nowrap}",
      ".kg-txt{background:var(--surface);border:1px solid var(--line);padding:24px;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden}",
      ".kg-txt small{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--soft)}",
      ".kg-txt h2,.kg-txt h3{font-family:var(--fd);font-weight:400;line-height:1.05;font-size:clamp(20px,2vw,30px)}",
      ".kg-txt.big h2{font-size:clamp(34px,4vw,60px);text-transform:uppercase}",
      ".kg-txt p{font-size:14px;color:var(--soft)}",
      ".kg-txt.ink{background:var(--deep);color:var(--on-deep);border:0}.kg-txt.ink small,.kg-txt.ink p{color:inherit;opacity:.7}",
      ".kg-txt.acc{background:var(--c1);color:var(--on-c1);border:0}.kg-txt.acc small,.kg-txt.acc p{color:inherit;opacity:.8}",
      ".kg-view{position:fixed;inset:0;z-index:30;background:color-mix(in srgb,var(--bg) 92%,transparent);backdrop-filter:blur(10px);display:none;place-items:center;padding:30px;cursor:auto}",
      ".kg-view.on{display:grid;animation:kgin .4s ease}@keyframes kgin{from{opacity:0}}",
      ".kg-card{display:grid;grid-template-columns:1.1fr 1fr;gap:40px;max-width:1080px;width:100%;align-items:center}",
      ".kg-card figure{margin:0;aspect-ratio:4/5;overflow:hidden;background:var(--surface)}.kg-card img,.kg-card figure span{width:100%;height:100%;object-fit:cover}",
      ".kg-card h2{font-family:var(--fd);font-weight:400;font-size:clamp(32px,4vw,60px);line-height:1}.kg-card p{color:var(--soft);margin-top:16px}",
      ".kg-card button{margin-top:24px;font:inherit;font-size:12px;letter-spacing:.16em;text-transform:uppercase;padding:10px 16px;border:1px solid var(--text);background:none;color:var(--text);cursor:pointer}",
      "@media(max-width:760px){.kg-card{grid-template-columns:1fr}.kg-card figure{aspect-ratio:16/10}}",
      ".k-gallery.list{height:auto;overflow:visible;cursor:auto;touch-action:auto}",
      ".k-gallery.list .kg-plane{position:static;display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:40px 24px;padding:100px 28px 60px}",
      ".k-gallery.list .kg-t{position:relative;transform:none!important;width:auto!important;height:auto!important;min-height:200px}",
      ".k-gallery.list .kg-ph{aspect-ratio:4/5}",
    ].join("\n"),
    render: function (c, h) {
      var t = [], A = c.about;
      t.push({ k: "txt big ink", w: 2, h: 1, html: "<small>" + h.esc(c.hero.eyebrow) + "</small><h2 data-fx-text>" + h.esc(name(c)) + "</h2><p>" + h.esc(String(c.hero.role).replace(/\*/g, "")) + "</p>" });
      projectsOf(c).forEach(function (p, i) { t.push({ k: "ph", w: 1, h: 1.3, img: p, i: i, cap: p.title, title: p.title, body: p.body, tags: (p.tags || []).join(" · ") }); });
      if (on(c, "about")) { t.push({ k: "txt", w: 1.4, h: 1, html: "<small>" + h.esc(A.eyebrow) + "</small><h3>" + h.rich(A.storyHeading) + "</h3><p>" + h.esc(A.story.split(/\n\s*\n/)[0]) + "</p>" }); A.stats.forEach(function (s) { t.push({ k: "txt acc", w: 0.8, h: 0.8, html: "<small>" + h.esc(s.label) + '</small><h2 style="font-size:56px">' + h.esc(s.value) + h.esc(s.suffix) + "</h2>" }); }); if (A.quote) t.push({ k: "txt", w: 1.2, h: 0.8, html: "<h3>" + h.rich(A.quote) + "</h3><small>" + h.esc(A.quoteLabel) + "</small>" }); }
      if (on(c, "skills")) c.skills.items.forEach(function (s) { t.push({ k: "txt", w: 0.9, h: 0.9, html: "<small>" + h.esc(s.tag) + "</small>" + h.mo(s.shape, "var(--c1)", 64) + "<h3>" + h.esc(s.title) + "</h3><p>" + h.esc(s.detail) + "</p>" }); });
      [6, 7, 8].forEach(function (k, j) { t.push({ k: "ph", w: 1, h: j === 1 ? 0.8 : 1.2, img: null, i: k, cap: "", title: c.brand.logoText, body: "" }); });
      if (on(c, "contact")) t.push({ k: "txt ink", w: 1.4, h: 0.9, html: "<small>" + h.esc(c.contact.eyebrow) + "</small><h3>" + h.rich(c.contact.title) + "</h3>" + (c.contact.email ? '<p><button type="button" data-copy="' + h.esc(c.contact.email) + '" style="font:inherit;color:inherit;background:none;border:0;border-bottom:1px solid;cursor:pointer;padding:0">' + h.esc(c.contact.email) + "</button></p>" : "") });
      K.gallery._tiles = t;
      return '<header class="kg-top"><h1>' + ic(h) + h.esc(c.brand.logoText) + "</h1><p>" + L(h, "dragHint", "Drag to explore") + "</p><button type=\"button\" data-list>" + L(h, "listView", "List view") + "</button></header><main id=\"top\" class=\"kg-plane\">" + t.map(function (x, i) {
        var inner = x.k === "ph" ? '<div class="kg-ph">' + h.itemImg(x.img, x.i, x.title, 700) + "</div>" + (x.cap ? '<span class="kg-cap">' + h.esc(x.cap) + "</span>" : "") : '<div class="kg-' + x.k.split(" ").join(" ") + '">' + x.html + "</div>";
        return '<article class="kg-t" data-t="' + i + '">' + inner + "</article>";
      }).join("") + '</main><div class="kg-view" role="dialog" aria-modal="true"></div>';
    },
    init: function (root, c, h) {
      bindCopy(root, h);
      var tiles = Array.prototype.slice.call(root.querySelectorAll(".kg-t")), data = K.gallery._tiles, view = root.querySelector(".kg-view");
      var U = Math.max(200, Math.min(300, innerWidth / 5)), G = 40, cols = Math.ceil(Math.sqrt(tiles.length * 1.6)), x = 0, y = 0, vx = 0, vy = 0, drag = false, moved = 0, lx = 0, ly = 0, raf = 0;
      var pos = [], cx = 0, cy = 0, rowH = 0, W = 0, Hh = 0;
      tiles.forEach(function (el, i) {
        var d = data[i], w = d.w * U, hh = d.h * U;
        if (i % cols === 0 && i) { cx = 0; cy += rowH + G * 2; rowH = 0; }
        pos.push([cx + (i % 2 ? 0 : G * 0.6), cy + ((i * 37) % 60)]); el.style.width = w + "px"; el.style.height = hh + "px";
        cx += w + G * 1.5; rowH = Math.max(rowH, hh + 60); W = Math.max(W, cx); Hh = Math.max(Hh, cy + rowH);
      });
      W += G; Hh += G;
      function wrap(v, m) { return ((v % m) + m) % m; }
      function place() {
        tiles.forEach(function (el, i) {
          var px = wrap(pos[i][0] + x, W) - W * 0.25, py = wrap(pos[i][1] + y, Hh) - Hh * 0.25;
          el.style.transform = "translate3d(" + px.toFixed(1) + "px," + py.toFixed(1) + "px,0)";
        });
      }
      function loop() { if (!drag) { x += vx; y += vy; vx *= 0.93; vy *= 0.93; } place(); if (drag || Math.abs(vx) + Math.abs(vy) > 0.05) raf = requestAnimationFrame(loop); else raf = 0; }
      x = innerWidth * 0.1; y = innerHeight * 0.05; place();
      var list = matchMedia("(max-width:640px)").matches;
      function setList(on) { list = on; root.classList.toggle("list", on); root.querySelector("[data-list]").textContent = on ? (h.lab ? h.lab("canvasView", "Canvas view") : "Canvas view") : (h.lab ? h.lab("listView", "List view") : "List view"); if (!on) place(); }
      setList(list);
      root.querySelector("[data-list]").addEventListener("click", function () { setList(!list); }, { signal: h.signal });
      root.addEventListener("pointerdown", function (e) { if (list || e.target.closest("button,a,.kg-view")) return; drag = true; moved = 0; lx = e.clientX; ly = e.clientY; root.classList.add("drag"); try { root.setPointerCapture(e.pointerId); } catch (_) {} if (!raf) raf = requestAnimationFrame(loop); }, { signal: h.signal });
      root.addEventListener("pointermove", function (e) { if (!drag) return; var dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY; x += dx; y += dy; vx = dx; vy = dy; moved += Math.abs(dx) + Math.abs(dy); }, { signal: h.signal });
      root.addEventListener("pointerup", function (e) {
        if (!drag) return; drag = false; root.classList.remove("drag"); if (!h.motion) { vx = vy = 0; }
        if (moved < 6) { var el = document.elementFromPoint(e.clientX, e.clientY), t = el && el.closest(".kg-t"); if (t) open(+t.getAttribute("data-t")); }
      }, { signal: h.signal });
      addEventListener("wheel", function (e) { if (list || view.classList.contains("on")) return; e.preventDefault(); x -= e.deltaX; y -= e.deltaY; place(); }, { passive: false, signal: h.signal });
      function open(i) {
        var d = data[i]; if (d.k !== "ph") return;
        view.innerHTML = '<div class="kg-card"><figure>' + h.itemImg(d.img, d.i, d.title, 1200) + "</figure><div><small style=\"letter-spacing:.18em;text-transform:uppercase;color:var(--soft);font-size:12px\">" + h.esc(d.tags || "") + "</small><h2>" + h.esc(d.title) + "</h2><p>" + h.esc(d.body) + '</p><button type="button" data-close>' + L(h, "close", "Close") + '</button></div></div>';
        view.classList.add("on"); view.querySelector("[data-close]").focus();
      }
      view.addEventListener("click", function (e) { if (e.target === view || e.target.closest("[data-close]")) view.classList.remove("on"); }, { signal: h.signal });
      addEventListener("keydown", function (e) { if (e.key === "Escape") view.classList.remove("on"); }, { signal: h.signal });
      return function () { cancelAnimationFrame(raf); };
    },
  };

  /* =====================================================================
     6. VELVET CINEMA: full-screen scenes with snap, Ken Burns backdrops and a scene counter.
     ===================================================================== */
  K["velvet-cinema"] = {
    name: "Cinema scenes",
    css: [
      "html.kv-snap{scroll-snap-type:y mandatory}",
      ".kv-s{min-height:100vh;scroll-snap-align:start;position:relative;display:grid;place-items:center;overflow:hidden;padding:110px clamp(20px,6vw,90px) 90px;text-align:center;isolation:isolate}",
      ".kv-bg{position:absolute;inset:0;z-index:-2}.kv-bg img,.kv-bg span{width:100%;height:100%;object-fit:cover;transform:scale(1.18);transition:transform 9s ease-out,filter 1.2s;filter:brightness(.35) saturate(.9)}",
      ".kv-s.in .kv-bg img{transform:scale(1.02)}",
      ".kv-s::after{content:'';position:absolute;inset:0;z-index:-1;background:radial-gradient(ellipse at center,transparent 30%,color-mix(in srgb,var(--bg) 92%,#000) 100%)}",
      ".kv-in{max-width:980px;opacity:0;transform:translateY(40px);transition:opacity 1.2s .2s,transform 1.2s .2s cubic-bezier(.2,.8,.2,1)}",
      ".kv-s.in .kv-in{opacity:1;transform:none}",
      ".kv-sc{display:block;font-size:12px;letter-spacing:.42em;text-transform:uppercase;color:var(--c1);margin-bottom:26px}",
      ".kv-s h1{font-family:var(--fd);font-weight:400;text-transform:uppercase;letter-spacing:.06em;font-size:clamp(48px,10vw,150px);line-height:.95}",
      ".kv-s h2{font-family:var(--fd);font-weight:400;font-size:clamp(36px,6vw,88px);line-height:1;text-transform:uppercase;letter-spacing:.04em}",
      ".kv-s h2 em,.kv-s h1 em{color:var(--c1)}",
      ".kv-s p{color:var(--soft);font-size:18px;line-height:1.7;max-width:60ch;margin:20px auto 0}",
      ".kv-by{font-family:var(--fd);font-style:italic;font-size:22px;color:var(--soft);margin-top:18px}",
      ".kv-cred{display:grid;gap:34px;margin-top:40px}",
      ".kv-cred div small{display:block;font-size:12px;letter-spacing:.3em;text-transform:uppercase;color:var(--soft)}",
      ".kv-cred div b{display:block;font-family:var(--fd);font-weight:400;font-size:clamp(26px,3.6vw,46px);text-transform:uppercase;letter-spacing:.06em}",
      ".kv-cred div span{color:var(--c1);font-size:14px;letter-spacing:.14em;text-transform:uppercase}",
      ".kv-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:40px;text-align:left}",
      ".kv-grid div{border-top:1px solid var(--c1);padding-top:14px}.kv-grid h3{font-family:var(--fd);font-weight:400;font-size:24px;text-transform:uppercase;letter-spacing:.06em}.kv-grid p{margin:6px 0 0;font-size:15px}",
      "@media(max-width:760px){.kv-grid{grid-template-columns:1fr}}",
      ".kv-dots{position:fixed;right:22px;top:50%;translate:0 -50%;z-index:40;display:flex;flex-direction:column;gap:12px}",
      ".kv-dots a{width:8px;height:8px;border-radius:50%;border:1px solid var(--text);display:block;transition:background .3s,transform .3s}",
      ".kv-dots a.on{background:var(--c1);border-color:var(--c1);transform:scale(1.4)}",
      ".kv-count{position:fixed;left:26px;bottom:22px;z-index:40;font-family:var(--fd);letter-spacing:.3em;font-size:13px;color:var(--soft)}",
      ".kv-top{position:fixed;inset:0 0 auto;z-index:40;display:flex;justify-content:space-between;padding:22px 28px;font-size:12px;letter-spacing:.32em;text-transform:uppercase}",
      ".kv-top a{color:var(--text);text-decoration:none}",
      ".kv-btn{margin-top:34px;font:inherit;font-family:var(--fd);font-size:20px;letter-spacing:.14em;text-transform:uppercase;padding:14px 26px;border:1px solid var(--c1);color:var(--c1);background:none;cursor:pointer;transition:background .3s,color .3s}",
      ".kv-btn:hover{background:var(--c1);color:var(--on-c1)}",
    ].join("\n"),
    render: function (c, h) {
      var S = [], A = c.about, k = 0;
      function scene(id, inner, ph) { S.push('<section class="kv-s"' + (id ? ' id="' + id + '"' : "") + '><div class="kv-bg">' + h.pimg(ph, "", 1600) + '</div><div class="kv-in"><span class="kv-sc">Scene ' + String(S.length + 1).padStart(2, "0") + "</span>" + inner + "</div></section>"); }
      scene("top", '<p style="margin:0 auto 16px;letter-spacing:.3em;text-transform:uppercase;font-size:13px">' + h.esc(c.hero.eyebrow) + '</p><h1 data-fx-text>' + h.esc(name(c)) + '</h1><p class="kv-by">' + h.rich(c.hero.role) + "</p>", k++);
      if (on(c, "about")) scene("about", "<h2>" + h.rich(A.storyHeading || A.title) + "</h2>" + paras(h, A.story) + (A.quote ? '<p class="kv-by">' + h.rich(A.quote) + "</p>" : ""), k++);
      if (on(c, "skills")) scene("skills", "<h2>" + h.rich(c.skills.title) + '</h2><div class="kv-grid">' + c.skills.items.map(function (s) { return "<div><h3>" + h.esc(s.title) + "</h3><p>" + h.esc(s.detail) + "</p></div>"; }).join("") + "</div>", k++);
      if (on(c, "work")) scene("work", "<h2>" + h.rich(c.work.title) + '</h2><div class="kv-cred">' + c.work.items.map(function (w) { return "<div><small>" + h.esc(w.period) + "</small><b>" + h.esc(w.title) + "</b><span>" + h.esc(w.org) + "</span></div>"; }).join("") + "</div>", k++);
      if (on(c, "projects") && c.projects.items.length) scene("projects", "<h2>" + h.rich(c.projects.title) + '</h2><div class="kv-grid">' + c.projects.items.map(function (p) { return "<div><h3>" + h.esc(p.title) + "</h3><p>" + h.esc(p.body) + "</p></div>"; }).join("") + "</div>", k++);
      if (on(c, "learning")) scene("learning", "<h2>" + h.rich(c.learning.title) + '</h2><div class="kv-cred">' + c.learning.items.map(function (l) { return "<div><small>" + h.esc(l.period) + "</small><b>" + h.esc(l.title) + "</b><span>" + h.esc(l.sub) + "</span></div>"; }).join("") + "</div>", k++);
      if (on(c, "contact")) scene("contact", "<h2>" + h.rich(c.contact.title) + "</h2><p>" + h.esc(c.contact.body) + "</p>" + (c.contact.email ? '<button class="kv-btn" type="button" data-copy="' + h.esc(c.contact.email) + '">' + h.esc(c.contact.email) + "</button>" : "") + '<p style="display:flex;gap:22px;justify-content:center">' + links(h, c) + "</p>", k++);
      return '<header class="kv-top"><a href="#top">' + ic(h) + h.esc(c.brand.logoText) + '</a><span style="color:var(--soft)">' + L(h, "scenes", "A portfolio in {n} scenes").replace("{n}", S.length) + '</span></header><main>' + S.join("") + '</main><nav class="kv-dots" aria-label="Scenes">' + S.map(function (_, i) { return '<a href="#" data-go="' + i + '" aria-label="Scene ' + (i + 1) + '"></a>'; }).join("") + '</nav><div class="kv-count"><span data-n>01</span> / ' + String(S.length).padStart(2, "0") + "</div>";
    },
    init: function (root, c, h) {
      bindCopy(root, h);
      document.documentElement.classList.add("kv-snap");
      var sc = Array.prototype.slice.call(root.querySelectorAll(".kv-s")), dots = root.querySelectorAll(".kv-dots a"), n = root.querySelector("[data-n]"), cur = 0;
      var stop = inView(sc, function (el, vis) { if (vis) { el.classList.add("in"); cur = sc.indexOf(el); n.textContent = String(cur + 1).padStart(2, "0"); dots.forEach(function (d, i) { d.classList.toggle("on", i === cur); }); } }, { threshold: 0.55 });
      dots.forEach(function (d) { d.addEventListener("click", function (e) { e.preventDefault(); sc[+d.getAttribute("data-go")].scrollIntoView({ behavior: h.motion ? "smooth" : "auto" }); }, { signal: h.signal }); });
      addEventListener("keydown", function (e) {
        if (/input|textarea/i.test((e.target || {}).tagName || "")) return;
        var to = e.key === "ArrowDown" || e.key === "PageDown" ? cur + 1 : e.key === "ArrowUp" || e.key === "PageUp" ? cur - 1 : -1;
        if (to >= 0 && to < sc.length) { e.preventDefault(); sc[to].scrollIntoView({ behavior: h.motion ? "smooth" : "auto" }); }
      }, { signal: h.signal });
      if (!h.motion) sc.forEach(function (s) { s.classList.add("in"); });
      return function () { stop(); document.documentElement.classList.remove("kv-snap"); };
    },
  };

  /* =====================================================================
     7. STUDIO POP: a pin board of stickers, notes and polaroids you can drag around.
     ===================================================================== */
  K["studio-pop"] = {
    name: "Sticker board",
    css: [
      ".k-studio-pop{background-image:radial-gradient(color-mix(in srgb,var(--text) 14%,transparent) 1.4px,transparent 1.6px);background-size:26px 26px;overflow-x:hidden}",
      ".kp-top{display:flex;justify-content:space-between;align-items:center;padding:20px clamp(16px,4vw,48px)}",
      ".kp-top b{font-family:var(--fd);font-size:20px}.kp-top nav{display:flex;gap:8px;flex-wrap:wrap}",
      ".kp-top nav a{padding:8px 14px;border-radius:999px;background:var(--surface);border:2px solid var(--text);color:var(--text);text-decoration:none;font-weight:700;font-size:14px;box-shadow:3px 3px 0 var(--text);transition:transform .2s,box-shadow .2s}",
      ".kp-top nav a:hover{transform:translate(-2px,-2px) rotate(-3deg);box-shadow:5px 5px 0 var(--text)}",
      ".kp-hero{position:relative;min-height:88vh;display:grid;place-items:center;text-align:center;padding:40px 16px}",
      ".kp-hero h1{font-family:var(--fd);font-size:clamp(64px,15vw,230px);line-height:.85;letter-spacing:-.04em;position:relative;z-index:1}",
      ".kp-hero h1 span{display:inline-block;transition:transform .4s cubic-bezier(.2,1.8,.4,1)}.kp-hero h1 span:hover{transform:translateY(-14px) rotate(-8deg);color:var(--c1)}",
      ".kp-hero p{position:relative;z-index:1;font-size:20px;max-width:540px;margin:20px auto 0}",
      ".kp-hint{display:inline-block;margin-top:22px;padding:6px 12px;border-radius:999px;background:var(--c3);color:var(--text);font-weight:700;font-size:13px;transform:rotate(-3deg)}",
      ".kp-st{position:absolute;z-index:2;cursor:grab;touch-action:none;filter:drop-shadow(0 8px 10px rgba(0,0,0,.18));transition:scale .25s}",
      ".kp-st:active{cursor:grabbing;scale:1.1}.kp-st .shp{pointer-events:none}",
      ".kp-board{display:grid;grid-template-columns:repeat(12,1fr);gap:28px;padding:40px clamp(16px,4vw,48px) 100px;max-width:1300px;margin:0 auto}",
      ".kp-card{grid-column:span 4;background:var(--surface);border:2.5px solid var(--text);border-radius:22px;padding:24px;box-shadow:6px 6px 0 var(--text);position:relative;transition:transform .4s cubic-bezier(.2,1.6,.4,1)}",
      ".kp-card:nth-child(4n+1){rotate:-1.5deg}.kp-card:nth-child(4n+2){rotate:1.2deg}.kp-card:nth-child(4n+3){rotate:-.6deg}",
      ".kp-card:hover{transform:translateY(-6px) rotate(1deg) scale(1.02)}",
      ".kp-card.w8{grid-column:span 8}.kp-card.w6{grid-column:span 6}.kp-card.w12{grid-column:span 12}",
      ".kp-card.c1{background:var(--c1);color:var(--on-c1)}.kp-card.c2{background:var(--c2);color:var(--on-c2,#fff)}.kp-card.c3{background:var(--c3)}",
      "@media(max-width:860px){.kp-card,.kp-card.w8,.kp-card.w6{grid-column:span 12}}",
      ".kp-card h2{font-family:var(--fd);font-size:clamp(30px,3.6vw,52px);line-height:.95;letter-spacing:-.03em}",
      ".kp-card h3{font-family:var(--fd);font-size:22px}.kp-card p{font-size:16px;opacity:.85;margin-top:8px}",
      ".kp-tape{position:absolute;top:-14px;left:50%;width:90px;height:26px;translate:-50% 0;rotate:-4deg;background:color-mix(in srgb,var(--c3) 70%,transparent);border-radius:3px}",
      ".kp-pills{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}",
      ".kp-pill{display:inline-flex;align-items:center;gap:8px;padding:8px 14px 8px 8px;border-radius:999px;border:2px solid var(--text);background:var(--bg);font-weight:700;cursor:grab;touch-action:none;transition:transform .3s cubic-bezier(.2,1.6,.4,1)}",
      ".kp-pill:hover{transform:rotate(-4deg) scale(1.05)}",
      ".kp-polas{display:flex;flex-wrap:wrap;gap:26px;justify-content:center;margin-top:10px}",
      ".kp-pola{width:230px;background:#fff;color:#222;padding:12px 12px 16px;box-shadow:0 14px 26px -10px rgba(0,0,0,.35);cursor:grab;touch-action:none;transition:transform .4s cubic-bezier(.2,1.6,.4,1)}",
      ".kp-pola:nth-child(odd){rotate:-4deg}.kp-pola:nth-child(even){rotate:3deg}.kp-pola:hover{transform:scale(1.05) rotate(2deg)}",
      ".kp-pola figure{margin:0;aspect-ratio:1;overflow:hidden;background:#eee}.kp-pola img,.kp-pola figure span{width:100%;height:100%;object-fit:cover;pointer-events:none}",
      ".kp-pola b{display:block;margin-top:10px;font-family:var(--fd);font-size:18px}.kp-pola small{color:#666}",
      ".kp-big{display:inline-block;margin-top:18px;font:inherit;font-family:var(--fd);font-size:clamp(22px,3vw,34px);padding:16px 28px;border-radius:999px;border:3px solid var(--text);background:var(--c3);color:var(--text);box-shadow:5px 5px 0 var(--text);cursor:pointer;animation:kpjig 3s ease-in-out infinite}",
      "@keyframes kpjig{0%,90%,100%{rotate:0}93%{rotate:-4deg}96%{rotate:4deg}}",
    ].join("\n"),
    render: function (c, h) {
      var H = c.hero, A = c.about, cards = [];
      var spots = [[6, 14, 110], [80, 10, 96], [12, 66, 84], [84, 62, 120], [44, 6, 70], [60, 76, 76], [28, 34, 58], [70, 36, 64]];
      var stickers = spots.map(function (s, i) { return '<span class="kp-st" data-drag style="left:' + s[0] + "%;top:" + s[1] + "%;rotate:" + ((i * 23) % 40 - 20) + 'deg">' + h.mo(i, "var(--" + ["c1", "c2", "c3"][i % 3] + ")", s[2]) + "</span>"; }).join("");
      if (on(c, "about")) { cards.push('<article class="kp-card w8" id="about"><span class="kp-tape"></span><h2>' + h.rich(A.storyHeading) + "</h2>" + paras(h, A.story) + "</article>"); A.stats.forEach(function (s, i) { cards.push('<article class="kp-card c' + (i % 2 ? 2 : 1) + '"><h2 style="font-size:72px">' + h.esc(s.value) + h.esc(s.suffix) + "</h2><p>" + h.esc(s.label) + "</p></article>"); }); if (A.quote) cards.push('<article class="kp-card c3 w6"><h3>' + h.rich(A.quote) + "</h3><p>" + h.esc(A.quoteLabel) + "</p></article>"); }
      if (on(c, "skills")) cards.push('<article class="kp-card w12" id="skills"><h2>' + h.rich(c.skills.title) + '</h2><p>' + L(h, "stickerHint", "Grab a sticker and move it around.") + '</p><div class="kp-pills">' + c.skills.items.map(function (s, i) { return '<span class="kp-pill" data-drag>' + h.mo(s.shape, "var(--" + ["c1", "c2", "c3"][i % 3] + ")", 34) + h.esc(s.title) + "</span>"; }).join("") + "</div></article>");
      if (on(c, "work")) cards.push('<article class="kp-card w12" id="work" style="background:transparent;border-style:dashed;box-shadow:none"><h2 style="text-align:center;margin-bottom:24px">' + h.rich(c.work.title) + '</h2><div class="kp-polas">' + c.work.items.map(function (w, i) { return '<div class="kp-pola" data-drag><figure>' + h.itemImg(w, i, w.title, 500) + "</figure><b>" + h.esc(w.title) + "</b><small>" + h.esc(w.org) + " · " + h.esc(w.period) + "</small></div>"; }).join("") + "</div></article>");
      if (on(c, "projects") && c.projects.items.length) cards.push('<article class="kp-card w12" id="projects" style="background:transparent;border-style:dashed;box-shadow:none"><h2 style="text-align:center;margin-bottom:24px">' + h.rich(c.projects.title) + '</h2><div class="kp-polas">' + c.projects.items.map(function (p, i) { return '<div class="kp-pola" data-drag><figure>' + h.itemImg(p, i + 3, p.title, 500) + "</figure><b>" + h.esc(p.title) + "</b><small>" + h.esc(p.body) + "</small></div>"; }).join("") + "</div></article>");
      if (on(c, "learning")) cards.push('<article class="kp-card w6" id="learning"><h3>' + h.rich(c.learning.title) + "</h3>" + c.learning.items.map(function (l) { return "<p><b>" + h.esc(l.title) + "</b> · " + h.esc(l.sub) + "</p>"; }).join("") + "</article>");
      if (on(c, "contact")) cards.push('<article class="kp-card w6 c1" id="contact"><h2>' + h.rich(c.contact.title) + "</h2>" + (c.contact.email ? '<button class="kp-big" type="button" data-copy="' + h.esc(c.contact.email) + '">Say hi 👋</button>' : "") + '<p style="display:flex;gap:16px;margin-top:20px">' + links(h, c) + "</p></article>");
      var letters = Array.from(H.firstName || "").map(function (ch) { return "<span>" + h.esc(ch) + "</span>"; }).join("");
      return '<header class="kp-top"><b>' + ic(h) + h.esc(c.brand.logoText) + "</b><nav>" + navOf(c).map(function (s) { return '<a href="#' + s.id + '">' + h.esc(s.navLabel) + "</a>"; }).join("") + '</nav></header><main id="top"><section class="kp-hero">' + stickers + '<div><h1 data-fx-text>' + letters + "<br>" + h.esc(H.lastName) + "</h1><p>" + h.rich(H.role) + '</p><span class="kp-hint">✋ drag the stickers</span></div></section><section class="kp-board">' + cards.join("") + '</section></main><footer style="text-align:center;padding:30px;font-weight:700">' + h.esc(c.contact.footerLeft) + "</footer>";
    },
    init: function (root, c, h) {
      bindCopy(root, h);
      var cur = null, sx = 0, sy = 0, ox = 0, oy = 0, z = 10;
      root.addEventListener("pointerdown", function (e) {
        var el = e.target.closest("[data-drag]"); if (!el || e.target.closest("a,button")) return;
        cur = el; sx = e.clientX; sy = e.clientY;
        var t = (el.style.translate || "0px 0px").split(" "); ox = parseFloat(t[0]) || 0; oy = parseFloat(t[1]) || 0;
        el.style.zIndex = ++z; el.style.transition = "none"; try { el.setPointerCapture(e.pointerId); } catch (_) {} e.preventDefault();
      }, { signal: h.signal });
      root.addEventListener("pointermove", function (e) { if (!cur) return; var dx = e.clientX - sx, dy = e.clientY - sy; cur.style.translate = (ox + dx) + "px " + (oy + dy) + "px"; cur.style.rotate = Math.max(-25, Math.min(25, dx * 0.08)) + "deg"; }, { signal: h.signal });
      function up() { if (!cur) return; cur.style.transition = "rotate .6s cubic-bezier(.2,1.8,.4,1)"; cur.style.rotate = ((Math.random() * 16) - 8).toFixed(1) + "deg"; cur = null; }
      root.addEventListener("pointerup", up, { signal: h.signal }); root.addEventListener("pointercancel", up, { signal: h.signal });
    },
  };

  /* =====================================================================
     8. EDITORIAL MOTION: a broadsheet newspaper with a live reading index.
     ===================================================================== */
  K["editorial-motion"] = {
    name: "Broadsheet",
    css: [
      ".k-editorial-motion{max-width:1320px;margin:0 auto;padding:0 clamp(16px,3vw,40px)}",
      ".ke-mast{text-align:center;padding:26px 0 14px;border-bottom:4px double var(--text)}",
      ".ke-mast .row{display:flex;justify-content:space-between;font-size:12px;letter-spacing:.14em;text-transform:uppercase;border-bottom:1px solid var(--text);padding-bottom:8px}",
      ".ke-mast h1{font-family:var(--fd);font-size:clamp(48px,11vw,170px);line-height:.95;letter-spacing:-.02em;margin:14px 0 6px}",
      ".ke-mast nav{display:flex;justify-content:center;gap:clamp(12px,3vw,36px);border-top:1px solid var(--text);padding-top:8px;font-size:13px;letter-spacing:.12em;text-transform:uppercase;flex-wrap:wrap}",
      ".ke-mast nav a{color:var(--text);text-decoration:none}.ke-mast nav a:hover{color:var(--c2)}",
      ".ke-wrap{display:grid;grid-template-columns:1fr 220px;gap:40px}",
      "@media(max-width:980px){.ke-wrap{grid-template-columns:1fr}.ke-index{display:none}}",
      ".ke-lead{display:grid;grid-template-columns:1.5fr 1fr;gap:32px;padding:30px 0;border-bottom:1px solid var(--text)}",
      "@media(max-width:760px){.ke-lead{grid-template-columns:1fr}}",
      ".ke-kick{font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:var(--c2);font-weight:700}",
      ".ke-lead h2{font-family:var(--fd);font-size:clamp(36px,5.4vw,78px);line-height:1;letter-spacing:-.02em;margin:10px 0}",
      ".ke-lead h2 em{font-style:italic;color:var(--c2)}",
      ".ke-by{font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:var(--soft);border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:8px 0;margin:14px 0}",
      ".ke-cols{column-count:2;column-gap:28px;column-rule:1px solid var(--line);font-size:16px;line-height:1.65;text-align:justify;hyphens:auto}",
      ".ke-cols p+p{text-indent:1.4em}",
      ".ke-cols.drop>p:first-child::first-letter{float:left;font-family:var(--fd);font-size:5.4em;line-height:.8;padding:6px 8px 0 0;color:var(--c2)}",
      ".ke-fig{margin:0;position:relative;overflow:hidden;border:1px solid var(--text)}",
      ".ke-fig .im{aspect-ratio:4/5;overflow:hidden}.ke-fig img,.ke-fig .im span{width:100%;height:118%;object-fit:cover;filter:grayscale(.3) contrast(1.05);will-change:transform}",
      ".ke-fig figcaption{font-size:12px;font-style:italic;color:var(--soft);padding:8px;border-top:1px solid var(--text)}",
      ".ke-sec{padding:36px 0;border-bottom:1px solid var(--text)}",
      ".ke-sec>header{display:flex;align-items:baseline;gap:16px;border-bottom:3px solid var(--text);margin-bottom:22px;padding-bottom:6px}",
      ".ke-sec>header h2{font-family:var(--fd);font-size:clamp(28px,3.4vw,46px);line-height:1}",
      ".ke-sec>header span{font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:var(--soft);margin-left:auto}",
      ".ke-three{display:grid;grid-template-columns:repeat(3,1fr);gap:0}",
      ".ke-three>*{padding:0 20px;border-left:1px solid var(--line)}.ke-three>*:first-child{border-left:0;padding-left:0}",
      "@media(max-width:760px){.ke-three{grid-template-columns:1fr}.ke-three>*{border-left:0;padding:14px 0;border-top:1px solid var(--line)}}",
      ".ke-three h3{font-family:var(--fd);font-size:24px;line-height:1.1;margin:6px 0}",
      ".ke-three p{font-size:15px;line-height:1.6;color:var(--soft)}",
      ".ke-pull{font-family:var(--fd);font-style:italic;font-size:clamp(26px,3vw,40px);line-height:1.2;text-align:center;padding:30px 10%;border-top:1px solid var(--text);border-bottom:1px solid var(--text);margin:26px 0}",
      ".ke-stats{display:flex;gap:40px;flex-wrap:wrap}.ke-stats b{font-family:var(--fd);font-size:54px;display:block;line-height:1}.ke-stats span{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--soft)}",
      ".ke-index{position:sticky;top:20px;align-self:start;padding-top:30px;font-size:13px}",
      ".ke-index b{display:block;font-size:11px;letter-spacing:.2em;text-transform:uppercase;border-bottom:1px solid var(--text);padding-bottom:6px;margin-bottom:10px}",
      ".ke-index a{display:block;color:var(--text);text-decoration:none;padding:8px 0;border-bottom:1px solid var(--line)}",
      ".ke-index i{display:block;height:2px;background:var(--line);margin-top:6px}.ke-index i u{display:block;height:100%;background:var(--c2);transform-origin:0 50%;transform:scaleX(0);text-decoration:none}",
      ".ke-class{display:grid;grid-template-columns:repeat(4,1fr);gap:0;border:1px solid var(--text)}",
      ".ke-class>div{padding:14px;border-right:1px solid var(--line);font-size:14px}.ke-class>div:last-child{border-right:0}",
      "@media(max-width:760px){.ke-class{grid-template-columns:1fr 1fr}}",
      ".ke-foot{display:flex;justify-content:space-between;font-size:12px;letter-spacing:.1em;text-transform:uppercase;padding:20px 0;border-top:4px double var(--text);margin-top:30px}",
      ".ke-cols a{margin-right:16px;color:var(--c2)}",
      ".ke-copy{font:inherit;background:var(--text);color:var(--bg);border:0;padding:10px 16px;font-size:14px;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;margin-top:10px}",
    ].join("\n"),
    render: function (c, h) {
      var H = c.hero, A = c.about, secs = [];
      var date = new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
      var out = '<header class="ke-mast"><div class="row"><span>Vol. ' + new Date().getFullYear() + '</span><span>' + h.esc(date) + "</span><span>" + L(h, "edition", "Portfolio edition") + "</span></div><h1>" + h.esc(c.brand.logoText) + "</h1><nav>" + navOf(c).map(function (s) { return '<a href="#' + s.id + '">' + h.esc(s.navLabel) + "</a>"; }).join("") + (on(c, "contact") ? '<a href="#contact">' + h.esc(c.brand.contactLabel) + "</a>" : "") + '</nav></header><div class="ke-wrap"><main id="top">';
      out += '<article class="ke-lead"><div><span class="ke-kick">' + h.esc(H.eyebrow) + '</span><h2 data-fx-text>' + h.rich(H.role) + '</h2><div class="ke-by">By ' + h.esc(name(c)) + " · " + H.meta.map(function (m) { return h.esc(m.value) + " " + h.esc(m.label); }).join(" · ") + '</div><div class="ke-cols drop">' + paras(h, A.story) + '</div></div><figure class="ke-fig"><div class="im">' + (H.photo ? '<img src="' + h.esc(h.imgUrl(H.photo)) + '" alt="' + h.esc(name(c)) + '">' : h.pimg(0, "", 900)) + "</div><figcaption>" + h.esc(name(c)) + ", " + h.esc(H.eyebrow) + ".</figcaption></figure></article>";
      if (on(c, "about")) { secs.push(["about", A.eyebrow]); out += '<section class="ke-sec" id="about"><header><h2>' + h.rich(A.storyHeading) + "</h2><span>" + h.esc(A.eyebrow) + "</span></header>" + (A.quote ? '<blockquote class="ke-pull">' + h.rich(A.quote) + "</blockquote>" : "") + '<div class="ke-stats">' + A.stats.map(function (s) { return "<div><b>" + h.esc(s.value) + h.esc(s.suffix) + "</b><span>" + h.esc(s.label) + "</span></div>"; }).join("") + A.facts.map(function (f) { return '<div><b style="font-size:22px;margin-top:20px">' + h.esc(f.v) + "</b><span>" + h.esc(f.k) + "</span></div>"; }).join("") + "</div></section>"; }
      if (on(c, "work")) { secs.push(["work", c.work.eyebrow]); out += '<section class="ke-sec" id="work"><header><h2>' + h.rich(c.work.title) + "</h2><span>" + h.esc(c.work.eyebrow) + '</span></header><div class="ke-three">' + c.work.items.map(function (w) { return '<article><span class="ke-kick">' + h.esc(w.period) + "</span><h3>" + h.esc(w.title) + ", " + h.esc(w.org) + "</h3>" + w.bullets.map(function (b) { return "<p>" + h.esc(b) + "</p>"; }).join("") + "</article>"; }).join("") + "</div></section>"; }
      if (on(c, "projects") && c.projects.items.length) { secs.push(["projects", c.projects.eyebrow]); out += '<section class="ke-sec" id="projects"><header><h2>' + h.rich(c.projects.title) + "</h2><span>" + h.esc(c.projects.eyebrow) + '</span></header><div class="ke-three">' + c.projects.items.map(function (p, i) { return '<article><figure class="ke-fig"><div class="im" style="aspect-ratio:16/10">' + h.itemImg(p, i + 1, p.title, 700) + "</div></figure><h3>" + h.esc(p.title) + "</h3><p>" + h.esc(p.body) + "</p></article>"; }).join("") + "</div></section>"; }
      if (on(c, "skills")) { secs.push(["skills", c.skills.eyebrow]); out += '<section class="ke-sec" id="skills"><header><h2>' + h.rich(c.skills.title) + "</h2><span>" + h.esc(c.skills.eyebrow) + '</span></header><div class="ke-three">' + c.skills.items.map(function (s) { return '<article><span class="ke-kick">' + h.esc(s.tag) + "</span><h3>" + h.esc(s.title) + "</h3><p>" + h.esc(s.body) + " " + h.esc(s.detail) + "</p></article>"; }).join("") + "</div></section>"; }
      if (on(c, "learning")) { secs.push(["learning", c.learning.eyebrow]); out += '<section class="ke-sec" id="learning"><header><h2>' + L(h, "classifieds", "Classifieds") + '</h2><span>' + h.esc(c.learning.eyebrow) + '</span></header><div class="ke-class">' + c.learning.items.map(function (l) { return "<div><b>" + h.esc(l.title) + "</b><br>" + h.esc(l.sub) + '<br><span style="color:var(--soft)">' + h.esc(l.period) + "</span></div>"; }).join("") + "</div></section>"; }
      if (on(c, "contact")) { secs.push(["contact", c.contact.eyebrow]); out += '<section class="ke-sec" id="contact"><header><h2>' + L(h, "letters", "Letters to the editor") + '</h2><span>' + h.esc(c.contact.eyebrow) + '</span></header><div class="ke-cols"><p><b>' + h.rich(c.contact.title) + "</b></p><p>" + h.esc(c.contact.body) + "</p><p>" + links(h, c) + "</p></div>" + (c.contact.email ? '<button class="ke-copy" type="button" data-copy="' + h.esc(c.contact.email) + '">Write to ' + h.esc(c.contact.email) + "</button>" : "") + "</section>"; }
      out += '</main><aside class="ke-index"><b>' + L(h, "inThisEdition", "In this edition") + '</b>' + secs.map(function (s) { return '<a href="#' + s[0] + '" data-ix="' + s[0] + '">' + h.esc(s[1]) + "<i><u></u></i></a>"; }).join("") + "</aside></div>";
      return out + '<footer class="ke-foot"><span>' + h.esc(c.contact.footerLeft) + "</span><span>" + h.esc(c.contact.footerRight) + "</span></footer>";
    },
    init: function (root, c, h) {
      bindCopy(root, h);
      var ix = Array.prototype.slice.call(root.querySelectorAll("[data-ix]")).map(function (a) { return [a.querySelector("u"), root.querySelector("#" + a.getAttribute("data-ix"))]; });
      var figs = root.querySelectorAll(".ke-fig .im");
      function upd() {
        ix.forEach(function (p) { if (!p[1]) return; var r = p[1].getBoundingClientRect(), v = Math.max(0, Math.min(1, (innerHeight * 0.5 - r.top) / Math.max(1, r.height))); p[0].style.transform = "scaleX(" + v + ")"; });
        if (h.motion) figs.forEach(function (f) { var r = f.getBoundingClientRect(), im = f.firstElementChild; if (im) im.style.transform = "translate3d(0," + (((r.top + r.height / 2) - innerHeight / 2) * -0.08).toFixed(1) + "px,0)"; });
      }
      upd(); addEventListener("scroll", upd, { passive: true, signal: h.signal });
    },
  };

  root.SiteLayouts = { kits: K, has: function (id) { return !!K[id]; }, list: Object.keys(K).map(function (k) { return [k, K[k].name]; }) };
})(typeof window !== "undefined" ? window : globalThis);
