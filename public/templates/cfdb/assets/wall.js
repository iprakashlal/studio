/* A social photo wall for every template's home page: the owner's Instagram, Pinterest (or any other network's) photos shown as
   a wall, with a button to follow them. Content: content.wall = {
     on, network, handle,          // network: instagram | pinterest | facebook | tiktok | youtube | x | behance | dribbble | other
     url,                          // the profile's own address, when the handle alone can't make it ("other", or a board)
     eyebrow, title, text, button, // above the wall; button: the follow button's words (empty: "Follow @handle")
     layout: "auto" | "grid" | "masonry" | "mosaic" | "strip",   // auto: chosen from the site's theme (see pick() below)
     cols: "" | 3 | 4 | 5 | 6, shape: "" | "square" | "portrait" | "landscape", captions: "hover" | "below" | "none",
     place: "top" | "middle" | "bottom" | "end",
     auto: "" | "instagram" | "pinterest", board, count,   // filled by itself from the network (see feed() below)
     items: [{ image, url, caption }] }
   A photo is a picture the owner uploads, with the link of its post. An item with only a post link (Instagram or Pinterest) is
   shown as that post, embedded: it is loaded from the network only when the visitor presses it, so nothing reaches those services
   before that. The wall can also fill itself (wall.auto): the secret key that needs is held by the site's database Worker, never by the page. The wall takes its colours, corners, card look and fonts from the site's theme.
   A template that lists its sections (Sections & order) draws an empty <section data-wall-slot> where the wall's row stands in that
   list, and passes { on, slot: true }: the wall fills that slot, so its place, its switch and its menu link work like any section's.
   Without a slot (the shop, and layouts with no section flow of their own) it is placed by "place" among the page's sections.
   So the wall reads as part of the page, a template can hand it its own pieces: head (its section heading, as HTML), wrap (the class of
   its content wrapper), cls (its section classes) and btn (its button classes). The tiles follow the theme's card style.
   window.SiteWall.mount(C, { sections: css, home, imgUrl, on, slot, head, wrap, cls, btn }): safe to call again after every render. */
(function () {
  "use strict";
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  // network: [name, address for a bare handle ({h})]
  var NETS = { instagram: ["Instagram", "https://www.instagram.com/{h}"], pinterest: ["Pinterest", "https://www.pinterest.com/{h}"], facebook: ["Facebook", "https://www.facebook.com/{h}"], tiktok: ["TikTok", "https://www.tiktok.com/@{h}"],
    youtube: ["YouTube", "https://www.youtube.com/@{h}"], x: ["X", "https://x.com/{h}"], behance: ["Behance", "https://www.behance.net/{h}"], dribbble: ["Dribbble", "https://dribbble.com/{h}"], other: ["", ""] };
  var CSS = [
    ".sw{--sw-acc:var(--c1,var(--accent,currentColor));--sw-on:var(--on-c1,var(--on-accent,#fff));--sw-line:var(--line,color-mix(in srgb,currentColor 16%,transparent));--sw-gap:clamp(8px,1.2vw,16px);position:relative}.sw:not(.sw-n){padding:clamp(44px,7vw,88px) 0}",
    ".sw-in{max-width:1240px;margin:0 auto;padding:0 clamp(18px,4vw,32px)}",
    ".sw-hd{text-align:center;max-width:760px;margin:0 auto clamp(22px,3vw,38px)}",
    ".sw-eb{margin:0 0 10px;font-size:13px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--sw-acc)}",
    ".sw-h{margin:0;font-size:clamp(26px,3.6vw,42px);line-height:1.12;letter-spacing:-.02em;font-family:var(--fh,var(--fd,inherit));color:inherit}",
    ".sw-p{margin:12px 0 0;font-size:clamp(15.5px,1.5vw,18px);line-height:1.6;opacity:.82;white-space:pre-line}",
    ".sw-fw{display:flex;justify-content:center;margin-top:clamp(22px,3vw,34px)}",
    ".sw-btn{display:inline-flex;align-items:center;gap:9px;padding:13px 22px;border-radius:var(--sw-btn,99px);font-weight:700;font-size:15px;line-height:1;text-decoration:none;background:var(--sw-acc);color:var(--sw-on);transition:transform .15s,filter .15s}",
    ".sw-btn:hover{transform:translateY(-1px);filter:brightness(1.06)}.sw-fw svg{width:18px;height:18px;flex:none}.sw-n .sw-in{max-width:none;padding:0}.sw-n .sw-fw{justify-content:flex-start;padding:0!important}.sw-n[data-l=strip] .sw-g{padding-inline:0}.sw-n.sw-ctr .sw-fw{justify-content:center}",
    // tiles: the theme's corners and card look
    ".sw-g{display:grid;gap:var(--sw-gap);grid-template-columns:repeat(var(--sw-cols,4),minmax(0,1fr))}",
    ".sw-t{position:relative;display:block;overflow:hidden;border-radius:var(--sw-rad,12px);background:var(--surface,color-mix(in srgb,currentColor 6%,transparent));color:inherit;text-decoration:none;aspect-ratio:var(--sw-ar,1/1);border:1px solid var(--sw-line);margin:0}",
    ".sw-t img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .5s cubic-bezier(.2,.7,.2,1)}a.sw-t:hover img,a.sw-t:focus-visible img{transform:scale(1.05)}",
    "a.sw-t:focus-visible{outline:3px solid var(--sw-acc);outline-offset:2px}",
    ".sw-c{position:absolute;inset:auto 0 0 0;padding:26px 12px 10px;font-size:13px;line-height:1.35;color:#fff;background:linear-gradient(180deg,transparent,rgba(0,0,0,.72));opacity:0;transform:translateY(6px);transition:opacity .25s,transform .25s;text-align:left}",
    ".sw-t:hover .sw-c,.sw-t:focus-visible .sw-c{opacity:1;transform:none}.sw[data-cap=none] .sw-c{display:none}@media(hover:none){.sw-c{opacity:1;transform:none}}",
    ".sw-m{position:absolute;top:10px;right:10px;width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:rgba(0,0,0,.42);color:#fff;opacity:0;transition:opacity .25s;backdrop-filter:blur(4px)}.sw-m svg{width:16px;height:16px}a.sw-t:hover .sw-m,a.sw-t:focus-visible .sw-m{opacity:1}",
    // captions under the photo: the tile becomes a small card
    ".sw[data-cap=below] .sw-t{aspect-ratio:auto;display:flex;flex-direction:column}.sw[data-cap=below] .sw-t img{aspect-ratio:var(--sw-ar,1/1);height:auto}",
    ".sw[data-cap=below] .sw-c{position:static;opacity:1;transform:none;background:none;color:inherit;padding:10px 12px 12px}",
    // the theme's card looks, where the theme has them
    "html[data-cards=flat] .sw-t{border-color:transparent}html[data-cards=elevated] .sw-t{border-color:transparent;box-shadow:0 1px 2px rgba(16,24,40,.05),0 12px 32px -14px rgba(16,24,40,.22)}",
    "html[data-cards=outline] .sw-t{background:transparent;border:1.5px solid var(--sw-line)}html[data-cards=brutal] .sw-t{border:2px solid var(--text,currentColor);box-shadow:5px 5px 0 var(--text,currentColor)}html[data-cards=brutal] .sw-g{padding:0 6px 6px 0}",
    "html[data-cards=gradient] .sw-t{border:2px solid transparent;background:linear-gradient(var(--surface,#fff),var(--surface,#fff)) padding-box,linear-gradient(135deg,var(--sw-acc),var(--c2,var(--sw-acc))) border-box}html[data-cards=inset] .sw-t{border-color:transparent;box-shadow:0 0 0 1px color-mix(in srgb,currentColor 12%,transparent)}html[data-cards=soft] .sw-t{border-color:transparent}",
    "html[data-cards=lined] .sw-t{border:0;border-radius:0}html[data-cards=accent] .sw-t{border-top:3px solid var(--sw-acc)}html[data-cards=glass] .sw-t{border-color:color-mix(in srgb,var(--sw-line) 60%,transparent);box-shadow:0 8px 30px -12px rgba(0,0,0,.25)}",
    // layouts
    ".sw[data-l=masonry] .sw-g{display:block;columns:var(--sw-cols,4);column-gap:var(--sw-gap)}.sw[data-l=masonry] .sw-t{aspect-ratio:auto;break-inside:avoid;margin:0 0 var(--sw-gap)}.sw[data-l=masonry] .sw-t img{height:auto}",
    ".sw[data-l=masonry] .sw-t.sw-e{aspect-ratio:4/5}",
    ".sw[data-l=mosaic] .sw-g{grid-auto-flow:dense}.sw[data-l=mosaic] .sw-t:nth-child(7n+1){grid-column:span 2;grid-row:span 2}",
    ".sw[data-l=strip] .sw-in{max-width:none;padding:0}.sw[data-l=strip] .sw-hd,.sw[data-l=strip] .sw-fw{padding:0 clamp(18px,4vw,32px)}",
    ".sw[data-l=strip] .sw-g{display:flex;overflow-x:auto;scroll-snap-type:x proximity;padding:4px clamp(18px,4vw,32px) 14px;scrollbar-width:thin}.sw[data-l=strip] .sw-t{flex:0 0 clamp(190px,24vw,300px);scroll-snap-align:start}",
    ".sw[data-l=flush]{--sw-gap:0px}.sw[data-l=flush] .sw-in{max-width:none;padding:0}.sw[data-l=flush] .sw-hd,.sw[data-l=flush] .sw-fw{padding:0 clamp(18px,4vw,32px)}.sw[data-l=flush] .sw-t{border-radius:0;border:0;box-shadow:none}",
    // an embedded post: pressed to load
    ".sw-e{display:grid;place-items:center;padding:14px;text-align:center;cursor:pointer;font:inherit;width:100%}.sw-e b{display:block;font-size:14px;margin-top:8px}.sw-e small{display:block;font-size:12px;opacity:.7;margin-top:4px}.sw-e svg{width:30px;height:30px;color:var(--sw-acc)}",
    ".sw-e:hover{border-color:var(--sw-acc)}.sw-f{aspect-ratio:auto!important;min-height:420px;padding:0;background:#fff}.sw-f iframe{width:100%;height:100%;min-height:420px;border:0;display:block}",
    "@media (max-width:900px){.sw-g{grid-template-columns:repeat(min(var(--sw-cols,4),3),minmax(0,1fr))}.sw[data-l=masonry] .sw-g{columns:min(var(--sw-cols,4),3)}}",
    "@media (max-width:560px){.sw-g{grid-template-columns:repeat(2,minmax(0,1fr))}.sw[data-l=masonry] .sw-g{columns:2}.sw[data-l=mosaic] .sw-t:nth-child(7n+1){grid-column:span 2;grid-row:span 1;aspect-ratio:2/1}}",
    ".sw-why{max-width:760px;margin:0 auto;padding:14px 18px;border:1.5px dashed var(--sw-line);border-radius:12px;font-size:14.5px;line-height:1.5;text-align:center}.sw-why small{opacity:.7}",
    "@media (prefers-reduced-motion:reduce){.sw-t img,.sw-c,.sw-btn{transition:none}}@media print{.sw{display:none}}"
  ].join("\n");
  function css() { if (document.getElementById("site-wall-css")) return; var s = document.createElement("style"); s.id = "site-wall-css"; s.textContent = CSS; document.head.appendChild(s); }
  var IC = { cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.200 6.800h.01"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4h6l-1 6 3 3H7l3-3-1-6zM12 13v7"/></svg>',
    out: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 16L16 8M9.500 8H16v6.500"/></svg>' };
  var safe = function (u) { u = String(u || "").trim(); return /^https:\/\//i.test(u) ? u : /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(u) ? "https://" + u : ""; };
  /** The profile's address: the one given, or one made from the handle. */
  function profile(W) {
    var u = safe(W.url); if (u) return u;
    var n = NETS[W.network] || NETS.other, h = String(W.handle || "").trim().replace(/^@/, "");
    return n[1] && /^[\w.-]{1,80}$/.test(h) ? n[1].replace("{h}", encodeURIComponent(h)) : "";
  }
  /** A post that can be shown embedded, from its link: Instagram posts and reels, Pinterest pins. */
  function embedOf(u) {
    var m = /^https:\/\/(?:www\.)?instagram\.com\/(p|reel|tv)\/([\w-]{5,40})/i.exec(u); if (m) return { src: "https://www.instagram.com/" + m[1].toLowerCase() + "/" + m[2] + "/embed", name: "Instagram", ic: IC.cam };
    m = /^https:\/\/(?:[a-z]{2,3}\.)?pinterest\.[a-z.]{2,6}\/pin\/(\d{5,30})/i.exec(u); if (m) return { src: "https://assets.pinterest.com/ext/embed.html?id=" + m[1], name: "Pinterest", ic: IC.pin };
    return null;
  }
  /** "auto": the layout that suits the site's theme. Themes that say how their cards look (html[data-cards]) get the wall that
   *  goes with it; a theme with square corners gets an edge-to-edge wall; otherwise an even grid. */
  function pick(n) {
    var H = document.documentElement, cards = H.getAttribute("data-cards") || "";
    if (cards === "lined") return "strip"; if (cards === "elevated" || cards === "glass") return "masonry"; if (cards === "accent") return n >= 5 ? "mosaic" : "grid"; if (cards === "flat") return "flush";
    return "grid";
  }
  /** The theme's own corner: taken from a card or a button already on the page. */
  function corner() {
    var el = document.querySelector(".card, .oc, .prod, .pcard, .tile, .btn, button"); if (!el) return "";
    var r = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0; return (r > 40 ? 22 : r) + "px";
  }
  function onOpen(e) {
    var b = e.target.closest && e.target.closest(".sw-e"); if (!b) return;
    var src = b.getAttribute("data-src"); if (!/^https:\/\/(www\.instagram\.com|assets\.pinterest\.com)\//.test(src)) return;
    var d = document.createElement("div"); d.className = "sw-t sw-f"; d.innerHTML = '<iframe src="' + esc(src) + '" title="' + esc(b.getAttribute("data-name") || "Post") + '" loading="lazy" allowtransparency="true" referrerpolicy="strict-origin-when-cross-origin"></iframe>';
    b.parentNode.replaceChild(d, b);
  }
  /* Filled by itself: with wall.auto ("instagram" or "pinterest") the newest posts come from the site's own database Worker
     (GET <api>/wall/<site>), which asks Instagram with the saved token, or reads a public Pinterest profile or board (wall.board).
     Which Worker: the Studio's own (wall.api, written when the project is saved; C._wallHost in the Studio's preview), else the
     site's own database from its <script id="site-host">. Without it, or when nothing comes back, the photos added by hand are shown. */
  var FEED = {}, LAST = null, feedT = 0, LAST_KEY = "", WHY = "";
  function host(C) {
    // The Studio's own database, written into the wall when the project is saved (wall.api, wall.sid): it holds the one Instagram
    // token every site uses, so a site on a database of its own, or on GitHub Pages with none, fills its wall too.
    if (C && C._wallHost && C._wallHost.api && C._wallHost.site) return C._wallHost;
    var W = (C && C.wall) || {}; if (/^https:\/\/[^\s"'<>]+$/.test(W.api || "") && /^[a-z0-9][a-z0-9-]{0,59}$/.test(W.sid || "")) return { api: W.api, site: W.sid };
    try { var e = document.getElementById("site-host"), h = e ? JSON.parse(e.textContent) : null; if (h && h.api && h.site) return h; } catch (x) { /* no host */ } return C && C._wallHost && C._wallHost.api && C._wallHost.site ? C._wallHost : null; }
  function feed(C, W) {
    var auto = /^(instagram|pinterest)$/.test(W.auto) ? W.auto : "", H = auto ? host(C) : null, board = String(W.board || "").trim();
    if (!H || (auto === "pinterest" && !board)) return null;
    // whose Instagram: the handle (or the profile's address) the owner gave; the database then shows that account
    var hd = String(W.handle || "").trim().replace(/^@/, "") || ((String(W.url || "").match(/instagram\.com\/([A-Za-z0-9._]{1,30})/i) || [])[1] || ""); if (!/^[A-Za-z0-9._]{1,30}$/.test(hd)) hd = "";
    var cnt = Math.max(3, Math.min(24, +W.count || 12)), key = [H.api, H.site, auto, board, cnt, hd].join("|"), f = FEED[key];
    if (!f) { FEED[key] = "wait";
      var ask = function () {
        fetch(String(H.api).replace(/\/+$/, "") + "/wall/" + encodeURIComponent(H.site) + "?src=" + auto + "&pin=" + encodeURIComponent(auto === "pinterest" ? board : "") + "&n=" + cnt + (auto === "instagram" && hd ? "&h=" + encodeURIComponent(hd) : "")).then(function (r) { return r.json(); })
          .then(function (j) { FEED[key] = { items: j && Array.isArray(j.items) && j.items.length ? j.items : null, why: (j && j.error) || "" }; if (LAST && (FEED[key].items || FEED[key].why)) mount(LAST.C, LAST.o); }).catch(function () { FEED[key] = { items: null, why: "" }; });
      };
      // In the Studio's preview the page is redrawn at every letter typed (a handle, a board): only what the owner stops on is
      // asked for, a moment after the last change. A live site asks at once.
      if (C && C._wallHost) { clearTimeout(feedT); LAST_KEY = key; feedT = setTimeout(function () { if (LAST_KEY === key) ask(); else delete FEED[key]; }, 900); for (var k in FEED) if (FEED[k] === "wait" && k !== key) delete FEED[k]; } else ask();
      return null; }
    WHY = f !== "wait" && !f.items ? f.why || "" : "";
    return f !== "wait" && f.items ? f.items.map(function (x) { return { src: String(x.img || ""), url: x.url, caption: x.caption }; }) : null;
  }
  function mount(C, o) {
    o = o || {}; LAST = { C: C, o: o }; var old = document.getElementById("site-wall"); if (old) old.remove();
    var W = (C && C.wall) || {}, slot = document.querySelector("[data-wall-slot]"), on = o.on != null ? !!o.on : !!W.on;
    var blank = function () { if (slot) { slot.innerHTML = ""; slot.hidden = true; slot.className = ""; } return null; };
    if (!on || (o.home === false && !slot)) return blank();
    var net = NETS[W.network] ? W.network : "other", name = NETS[net][0], prof = profile(W), tiles = "", n = 0;
    WHY = ""; var fed = feed(C, W);
    (fed || (Array.isArray(W.items) ? W.items : [])).slice(0, 24).forEach(function (it, i) {
      if (!it) return; var pic = fed ? (/^https:\/\//.test(it.src) ? it.src : "") : it.image ? (o.imgUrl ? o.imgUrl(it.image) : it.image.url || "") : "", u = safe(it.url), cap = String(it.caption || "").trim(), em = !pic && u ? embedOf(u) : null;
      var c = cap ? '<span class="sw-c"' + (fed ? "" : ' data-edit="wall.items.' + i + '.caption"') + ">" + esc(cap) + "</span>" : "";
      if (pic) { n++; var inner = '<img src="' + esc(pic) + '" alt="' + esc(cap || (name ? name + " photo" : "Photo")) + '" loading="lazy" decoding="async"' + (fed ? ' referrerpolicy="no-referrer"' : "") + ">" + c;
        tiles += u ? '<a class="sw-t" href="' + esc(u) + '" target="_blank" rel="noopener">' + inner + '<span class="sw-m" aria-hidden="true">' + IC.out + "</span></a>" : '<figure class="sw-t">' + inner + "</figure>"; }
      else if (em) { n++; tiles += '<button type="button" class="sw-t sw-e" data-src="' + esc(em.src) + '" data-name="' + esc(em.name + " post") + '"><span>' + em.ic + "<b>" + esc(cap || "Show this " + em.name + " post") + "</b><small>Loads from " + esc(em.name) + " when pressed</small></span></button>"; }
    });
    // In the Studio's preview, a wall that should fill itself and has nothing says why (the live site just shows no wall).
    if (!n && WHY && C && C._wallHost && slot) { css(); slot.hidden = false; slot.className = "sw"; slot.innerHTML = '<div class="sw-in"><p class="sw-why"><b>Social photo wall:</b> ' + esc(WHY) + " <small>(Only you see this note, here in the preview.)</small></p></div>"; return slot; }
    if (!n) return blank();
    if (!slot && o.slot === "only") return null;
    var all = slot ? [] : Array.prototype.slice.call(document.querySelectorAll(o.sections || "main > section")); if (!slot && !all.length) return null;
    var parent = slot ? null : all[0].parentNode, list = slot ? [] : all.filter(function (s) { return s.parentNode === parent && s.id !== "site-video"; });
    css();
    var layout = /^(grid|masonry|mosaic|strip|flush)$/.test(W.layout) ? W.layout : pick(n), cols = /^[3-6]$/.test(String(W.cols)) ? +W.cols : n <= 3 ? 3 : n <= 8 ? 4 : 5;
    // a masonry wall of a few photos: columns that the photos can fill, so none is left empty
    if (layout === "masonry") while (cols > 2 && n < cols * 3 && n % cols) cols--;
    var ar = W.shape === "portrait" ? "4/5" : W.shape === "landscape" ? "4/3" : "1/1", cap = /^(below|none)$/.test(W.captions) ? W.captions : "hover";
    var h = String(W.handle || "").trim().replace(/^@/, ""), label = String(W.button || "").trim() || (h ? "Follow @" + h : name ? "Follow us on " + name : "See more");
    var head = W.eyebrow || W.title || W.text ? '<div class="sw-hd">' + (W.eyebrow ? '<p class="sw-eb" data-edit="wall.eyebrow">' + esc(W.eyebrow) + "</p>" : "") + (W.title ? '<h2 class="sw-h" data-edit="wall.title">' + esc(W.title) + "</h2>" : "") + (W.text ? '<p class="sw-p" data-edit="wall.text">' + esc(W.text) + "</p>" : "") + "</div>" : "";
    var s = slot || document.createElement("section"); if (slot) { s.hidden = false; s.removeEventListener("click", onOpen); } else { s.id = "site-wall"; s.setAttribute("data-sec", "wall"); } s.className = "sw" + (o.cls ? " sw-n " + o.cls : ""); s.setAttribute("data-l", layout); s.setAttribute("data-cap", cap); s.setAttribute("aria-label", W.title || (name ? name + " photos" : "Photo wall"));
    s.style.setProperty("--sw-cols", String(cols)); s.style.setProperty("--sw-ar", ar); var rad = corner(); if (rad) s.style.setProperty("--sw-rad", rad);
    s.innerHTML = '<div class="' + esc(o.wrap || "sw-in") + '">' + (o.head != null ? o.head : head) + '<div class="sw-g">' + tiles + "</div>" + (prof ? '<div class="sw-fw"><a class="' + esc(o.btn || "sw-btn") + '" href="' + esc(prof) + '" target="_blank" rel="noopener me">' + (net === "pinterest" ? IC.pin : IC.cam) + '<span data-edit="wall.button">' + esc(label) + "</span></a></div>" : "") + "</div>";
    s.addEventListener("click", onOpen);
    // the section's own background and text (Background & text of this section), drawn by fx.js: the wall is filled after the
    // page's effects ran, so they are asked again for this one section once it stands in the page
    var bg = function () { var B = C && C.sectionBg && C.sectionBg.wall; if (B && (B.on || B.align) && window.SiteFX && window.SiteFX.bgs && s.parentNode) window.SiteFX.bgs({ bgs: { wall: B }, asset: o.imgUrl }, s.parentNode); };
    if (slot) { bg(); return s; }
    var place = W.place || "bottom", m = list.length, before = place === "end" ? null : place === "bottom" ? list[m - 1] : place === "middle" ? list[Math.max(1, Math.ceil(m / 2))] || null : list[1] || null;
    if (before && m > 1) parent.insertBefore(s, before); else if (list[m - 1].nextSibling) parent.insertBefore(s, list[m - 1].nextSibling); else parent.appendChild(s);
    bg();
    return s;
  }
  window.SiteWall = { mount: mount, NETS: NETS };
})();
