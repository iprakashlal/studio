/* A video section for every template's home page. Content: content.video = {
     on, url,                       // a YouTube or Vimeo link, or the address of a video file (.mp4 / .webm)
     poster,                        // a picture shown before the video plays (the editor's picture object)
     layout: "center" | "wide" | "full" | "left" | "right",   // left / right: the video sits on that side, the text beside it
     place:  "top" | "middle" | "bottom" | "end",              // after the first screen · mid page · before the last section · last
     ratio:  "16:9" | "4:3" | "1:1" | "9:16",
     eyebrow, title, text, links: [{ label, url }],            // beside the video (left / right) or above it (centre / wide)
     auto, controls, round }       // auto: a video file plays by itself, silently, on a loop
   A YouTube or Vimeo video is only loaded when the visitor presses play, so nothing reaches those services before that.
   window.SiteVideo.mount(C, { sections: css, home, imgUrl }): safe to call again after every render. */
(function () {
  "use strict";
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var CSS = [
    ".sv{padding:clamp(44px,7vw,88px) 0;position:relative}.sv-in{max-width:1160px;margin:0 auto;padding:0 clamp(18px,4vw,32px)}",
    ".sv-center .sv-in{max-width:900px}.sv-wide .sv-in{max-width:1400px}.sv-full{padding:0}.sv-full .sv-in{max-width:none;padding:0}",
    ".sv-box{position:relative;width:100%;aspect-ratio:var(--sv-r,16/9);background:#0b0d14;overflow:hidden;border-radius:var(--sv-rad,0px);box-shadow:0 18px 50px rgba(0,0,0,.16)}",
    ".sv-full .sv-box{border-radius:0;box-shadow:none;max-height:92vh}.sv-box[data-r='9:16']{max-width:420px;margin-inline:auto}.sv-box[data-r='1:1']{max-width:720px;margin-inline:auto}",
    ".sv-box video,.sv-box iframe,.sv-box img{position:absolute;inset:0;width:100%;height:100%;border:0;display:block}.sv-box video,.sv-box img{object-fit:cover}",
    ".sv-play{position:absolute;inset:0;width:100%;height:100%;border:0;padding:0;margin:0;background:transparent;cursor:pointer;display:grid;place-items:center;color:#fff}",
    ".sv-play::before{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.08),rgba(0,0,0,.34))}",
    ".sv-play span{position:relative;width:clamp(58px,8vw,84px);height:clamp(58px,8vw,84px);border-radius:50%;background:rgba(255,255,255,.94);display:grid;place-items:center;box-shadow:0 10px 30px rgba(0,0,0,.35);transition:transform .2s}",
    ".sv-play:hover span,.sv-play:focus-visible span{transform:scale(1.08)}.sv-play:focus-visible{outline:3px solid var(--c1,var(--accent,#fff));outline-offset:-6px}",
    ".sv-play svg{width:38%;height:38%;margin-left:6%;fill:#111}",
    ".sv-tx{min-width:0}.sv-eb{margin:0 0 10px;font-size:13px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--c1,var(--accent,currentColor))}",
    ".sv-h{margin:0;font-size:clamp(26px,3.6vw,42px);line-height:1.12;letter-spacing:-.02em;font-family:var(--fh,var(--fd,inherit));color:inherit}",
    ".sv-p{margin:14px 0 0;font-size:clamp(15.5px,1.5vw,18px);line-height:1.6;opacity:.82;white-space:pre-line}",
    ".sv-ln{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}",
    ".sv-a{display:inline-flex;align-items:center;gap:8px;padding:12px 20px;border-radius:var(--sv-btn,99px);font-weight:700;font-size:15px;line-height:1;text-decoration:none;border:1.5px solid color-mix(in srgb,currentColor 30%,transparent);color:inherit;transition:transform .15s,background .15s}",
    ".sv-a:hover{transform:translateY(-1px)}.sv-a:first-child{background:var(--c1,var(--accent,#111));border-color:transparent;color:var(--on-c1,var(--on-accent,#fff))}",
    ".sv-center .sv-tx,.sv-wide .sv-tx{text-align:center;max-width:760px;margin:0 auto clamp(22px,3vw,36px)}.sv-center .sv-ln,.sv-wide .sv-ln{justify-content:center}",
    ".sv-left .sv-in,.sv-right .sv-in{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:clamp(24px,5vw,64px);align-items:center}",
    ".sv-right .sv-in{grid-template-columns:minmax(0,1fr) minmax(0,1.2fr)}.sv-right .sv-box{order:2}",
    ".sv-notx .sv-in{display:block}.sv-left.sv-notx .sv-box,.sv-right.sv-notx .sv-box{max-width:760px}.sv-right.sv-notx .sv-box{margin-left:auto}",
    "@media (max-width:820px){.sv-left .sv-in,.sv-right .sv-in{grid-template-columns:1fr}.sv-right .sv-box{order:0}.sv-left.sv-notx .sv-box,.sv-right.sv-notx .sv-box{max-width:none}}",
    "@media print{.sv{display:none}}"
  ].join("\n");
  function css() { if (document.getElementById("site-video-css")) return; var s = document.createElement("style"); s.id = "site-video-css"; s.textContent = CSS; document.head.appendChild(s); }
  /** A link the page may open: https, or a file inside the site itself. */
  function safe(u) { u = String(u || "").trim(); if (!u) return ""; if (/^https:\/\//i.test(u)) return u; if (/^(mailto:|tel:)/i.test(u)) return u; return /^[a-z][a-z0-9+.-]*:/i.test(u) || /^\/\//.test(u) ? "" : u; }
  /** What the address points at: { kind: "youtube" | "vimeo" | "file", src }. */
  function source(u) {
    u = String(u || "").trim(); var m;
    if ((m = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/i.exec(u))) return { kind: "youtube", src: "https://www.youtube-nocookie.com/embed/" + m[1] + "?autoplay=1&rel=0&playsinline=1" };
    if ((m = /vimeo\.com\/(?:video\/)?(\d{6,12})/i.exec(u))) return { kind: "vimeo", src: "https://player.vimeo.com/video/" + m[1] + "?autoplay=1&dnt=1" };
    var s = safe(u); return s && !/^(mailto:|tel:)/i.test(s) ? { kind: "file", src: s } : null;
  }
  var PLAY = '<span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3.5v17a1 1 0 0 0 1.5.86l14-8.5a1 1 0 0 0 0-1.72l-14-8.5A1 1 0 0 0 5 3.5Z"/></svg></span>';
  var RATIO = { "16:9": "16/9", "4:3": "4/3", "1:1": "1/1", "9:16": "9/16" };
  function box(V, src, poster) {
    var r = RATIO[V.ratio] ? V.ratio : "16:9", rad = V.round === false ? 0 : 18;
    var open = '<div class="sv-box" data-r="' + r + '" data-edit="video.url" style="--sv-r:' + RATIO[r] + ";--sv-rad:" + rad + 'px">';
    var label = esc(V.title ? "Play: " + V.title : "Play the video");
    if (src.kind === "file") {
      if (V.auto) return open + '<video src="' + esc(src.src) + '"' + (poster ? ' poster="' + esc(poster) + '"' : "") + " autoplay muted loop playsinline" + (V.controls ? " controls" : "") + ' preload="metadata"></video></div>';
      // With a poster the file is only fetched on play; without one the first frame is the picture.
      return open + '<video src="' + esc(src.src) + '"' + (poster ? ' poster="' + esc(poster) + '" preload="none"' : ' preload="metadata"') + (V.controls === false ? "" : " controls") + " playsinline></video>" +
        (V.controls === false ? '<button type="button" class="sv-play" data-sv="file" aria-label="' + label + '">' + PLAY + "</button>" : "") + "</div>";
    }
    return open + (poster ? '<img src="' + esc(poster) + '" alt="" loading="lazy">' : "") + '<button type="button" class="sv-play" data-sv="' + src.kind + '" data-src="' + esc(src.src) + '" aria-label="' + label + '">' + PLAY + "</button></div>";
  }
  function text(V) {
    var links = (Array.isArray(V.links) ? V.links : []).map(function (l, i) { var u = safe(l && l.url); return l && l.label && u ? '<a class="sv-a" href="' + esc(u) + '"' + (/^https:/i.test(u) ? ' target="_blank" rel="noopener"' : "") + ' data-edit="video.links.' + i + '.label">' + esc(l.label) + "</a>" : ""; }).join("");
    if (!V.eyebrow && !V.title && !V.text && !links) return "";
    return '<div class="sv-tx">' + (V.eyebrow ? '<p class="sv-eb" data-edit="video.eyebrow">' + esc(V.eyebrow) + "</p>" : "") + (V.title ? '<h2 class="sv-h" data-edit="video.title">' + esc(V.title) + "</h2>" : "") +
      (V.text ? '<p class="sv-p" data-edit="video.text">' + esc(V.text) + "</p>" : "") + (links ? '<div class="sv-ln">' + links + "</div>" : "") + "</div>";
  }
  function onPlay(e) {
    var b = e.target.closest && e.target.closest(".sv-play"); if (!b) return;
    var host = b.parentNode, kind = b.getAttribute("data-sv");
    if (kind === "file") { var v = host.querySelector("video"); if (v) { v.setAttribute("controls", ""); v.play().catch(function () {}); } b.remove(); return; }
    var f = document.createElement("iframe"); f.src = b.getAttribute("data-src"); f.title = b.getAttribute("aria-label") || "Video";
    f.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen"; f.allowFullscreen = true; f.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    host.innerHTML = ""; host.appendChild(f);
  }
  /** Draws the section into the home page (or removes it). o.sections: the selector of the page's own sections. */
  function mount(C, o) {
    o = o || {}; var old = document.getElementById("site-video"); if (old) old.remove();
    var V = (C && C.video) || {}; if (!V.on || o.home === false) return null;
    var src = source(V.url); if (!src) return null;
    var all = Array.prototype.slice.call(document.querySelectorAll(o.sections || "main > section")); if (!all.length) return null;
    var parent = all[0].parentNode, list = all.filter(function (s) { return s.parentNode === parent; });
    var layout = /^(center|wide|full|left|right)$/.test(V.layout) ? V.layout : "center", side = layout === "left" || layout === "right";
    var poster = V.poster ? (o.imgUrl ? o.imgUrl(V.poster) : V.poster.url || "") : "", tx = layout === "full" ? "" : text(V);
    css();
    var s = document.createElement("section"); s.id = "site-video"; s.className = "sv sv-" + layout + (tx ? "" : " sv-notx");
    s.innerHTML = '<div class="sv-in">' + (side ? box(V, src, poster) + tx : tx + box(V, src, poster)) + "</div>";
    s.addEventListener("click", onPlay);
    var place = V.place || "top", n = list.length, before = place === "end" ? null : place === "bottom" ? list[n - 1] : place === "middle" ? list[Math.max(1, Math.ceil(n / 2))] || null : list[1] || null;
    if (before) parent.insertBefore(s, before); else if (list[n - 1].nextSibling) parent.insertBefore(s, list[n - 1].nextSibling); else parent.appendChild(s);
    return s;
  }
  window.SiteVideo = { mount: mount, source: source };
})();
