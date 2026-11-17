/* Social and contact links in the footer, for every template. Content: content.social = {
     on, title,                               // title: a small heading such as "Follow us" (optional)
     style: "badges" | "labels" | "both",     // round badges, plain labels, or a badge with its label
     align: "center" | "left" | "right",
     items: [{ kind, url, label, icon }] }    // kind: one of KINDS below, or "other"; icon: the owner's own picture
   A badge is a neutral round mark with the network's short initials: the networks' own logos are their trademarks, so
   the site doesn't draw them. An owner who wants a logo uploads it as that link's icon.
   A link may be a full address, or just the handle / number: "@name" becomes the profile address of its network.
   window.SiteSocial.mount(C, { footer: css, before: css, imgUrl }): safe to call again after every render. */
(function () {
  "use strict";
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  // kind: [name, badge, address for a bare handle ({h})]
  var KINDS = {
    instagram: ["Instagram", "IG", "https://www.instagram.com/{h}"], facebook: ["Facebook", "FB", "https://www.facebook.com/{h}"], x: ["X", "X", "https://x.com/{h}"],
    linkedin: ["LinkedIn", "IN", "https://www.linkedin.com/in/{h}"], youtube: ["YouTube", "YT", "https://www.youtube.com/@{h}"], whatsapp: ["WhatsApp", "WA", "https://wa.me/{d}"],
    telegram: ["Telegram", "TG", "https://t.me/{h}"], threads: ["Threads", "TH", "https://www.threads.net/@{h}"], pinterest: ["Pinterest", "PI", "https://www.pinterest.com/{h}"],
    snapchat: ["Snapchat", "SC", "https://www.snapchat.com/add/{h}"], tiktok: ["TikTok", "TT", "https://www.tiktok.com/@{h}"], github: ["GitHub", "GH", "https://github.com/{h}"],
    behance: ["Behance", "BE", "https://www.behance.net/{h}"], dribbble: ["Dribbble", "DR", "https://dribbble.com/{h}"], medium: ["Medium", "ME", "https://medium.com/@{h}"],
    maps: ["Google Maps", "MAP", ""], indiamart: ["IndiaMART", "IM", ""], justdial: ["Justdial", "JD", ""],
    email: ["Email", "@", "mailto:{h}"], phone: ["Phone", "TEL", "tel:{d}"], website: ["Website", "WEB", "https://{h}"], other: ["Link", "↗", ""]
  };
  var CSS = [
    ".ss{display:flex;flex-wrap:wrap;align-items:center;gap:10px 12px;padding:18px 0;font-family:var(--fb,inherit);color:inherit}",
    ".ss[data-align=center]{justify-content:center}.ss[data-align=right]{justify-content:flex-end}.ss-out{padding:22px clamp(18px,4vw,32px);max-width:1200px;margin:0 auto}",
    ".ss-t{font-size:12.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;opacity:.7;margin-right:4px}",
    ".ss-a{display:inline-flex;align-items:center;gap:8px;color:inherit;text-decoration:none;font-size:14.5px;font-weight:600;line-height:1;border-radius:99px;transition:transform .15s,opacity .15s}",
    ".ss-a:hover{transform:translateY(-2px)}.ss-a:focus-visible{outline:2px solid var(--c1,var(--accent,currentColor));outline-offset:3px}",
    ".ss-b{width:38px;height:38px;flex:none;border-radius:50%;display:grid;place-items:center;font-size:11.5px;font-weight:800;letter-spacing:.02em;border:1.5px solid color-mix(in srgb,currentColor 32%,transparent);background:color-mix(in srgb,currentColor 7%,transparent);transition:background .15s,color .15s,border-color .15s}",
    ".ss-a:hover .ss-b{background:var(--c1,var(--accent,currentColor));border-color:transparent;color:var(--on-c1,var(--on-accent,#fff))}",
    ".ss-b img{width:100%;height:100%;border-radius:50%;object-fit:cover;display:block}.ss-b.pic{border:0;background:none}.ss-a:hover .ss-b.pic{background:none}",
    ".ss[data-style=labels] .ss-a{padding:8px 4px;text-decoration:underline;text-decoration-color:color-mix(in srgb,currentColor 35%,transparent);text-underline-offset:4px}",
    ".ss[data-style=both] .ss-a{padding-right:6px}@media print{.ss{display:none}}"
  ].join("\n");
  function css() { if (document.getElementById("site-social-css")) return; var s = document.createElement("style"); s.id = "site-social-css"; s.textContent = CSS; document.head.appendChild(s); }
  /** The address a link opens: a full https / mailto / tel address as given, or one built from a handle or number. */
  function href(kind, v) {
    v = String(v || "").trim(); if (!v) return "";
    if (/^https:\/\//i.test(v)) return v;
    if (/^(mailto:|tel:)/i.test(v)) return v;
    if (/^[a-z][a-z0-9+.-]*:/i.test(v) || /^\/\//.test(v)) return "";   // http:, javascript: and the like
    var k = KINDS[kind] || KINDS.other, digits = v.replace(/[^\d]/g, "");
    if (kind === "email") return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? "mailto:" + v : "";
    if (kind === "phone" || kind === "whatsapp") return digits.length >= 7 ? k[2].replace("{d}", (kind === "phone" && /^\+/.test(v) ? "+" : "") + digits) : "";
    if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(v)) return "https://" + v;     // an address typed without https://
    var h = v.replace(/^@/, ""); return k[2] && /^[\w.-]{1,80}$/.test(h) ? k[2].replace("{h}", encodeURIComponent(h)) : "";
  }
  function row(S, o) {
    var style = /^(badges|labels|both)$/.test(S.style) ? S.style : "badges", out = "";
    (Array.isArray(S.items) ? S.items : []).forEach(function (it, i) {
      if (!it) return; var k = KINDS[it.kind] ? it.kind : "other", u = href(k, it.url); if (!u) return;
      var name = String(it.label || "").trim() || KINDS[k][0], pic = it.icon ? (o.imgUrl ? o.imgUrl(it.icon) : it.icon.url || "") : "";
      var badge = style === "labels" ? "" : '<span class="ss-b' + (pic ? " pic" : "") + '" aria-hidden="true">' + (pic ? '<img src="' + esc(pic) + '" alt="" loading="lazy">' : esc(KINDS[k][1])) + "</span>";
      var text = style === "badges" ? "" : '<span data-edit="social.items.' + i + '.label">' + esc(name) + "</span>";
      out += '<a class="ss-a" href="' + esc(u) + '"' + (/^https:/i.test(u) ? ' target="_blank" rel="noopener me"' : "") + (style === "badges" ? ' aria-label="' + esc(name) + '" title="' + esc(name) + '"' : "") + ' data-kind="' + k + '">' + badge + text + "</a>";
    });
    if (!out) return "";
    return (S.title ? '<span class="ss-t" data-edit="social.title">' + esc(S.title) + "</span>" : "") + out;
  }
  /** Draws the row into the footer (o.before: an element inside the footer to sit above), or just above a footer that
   *  has no room of its own. Without a footer it goes at the end of the page. */
  function mount(C, o) {
    o = o || {}; Array.prototype.forEach.call(document.querySelectorAll("#site-social"), function (n) { n.remove(); });
    var S = (C && C.social) || {}; if (!S.on) return null;
    var html = row(S, o); if (!html) return null;
    css();
    var d = document.createElement("div"); d.id = "site-social"; d.className = "ss"; d.setAttribute("data-style", /^(badges|labels|both)$/.test(S.style) ? S.style : "badges");
    d.setAttribute("data-align", /^(left|right)$/.test(S.align) ? S.align : "center"); d.setAttribute("role", "navigation"); d.setAttribute("aria-label", S.title || "Social links"); d.innerHTML = html;
    var foots = document.querySelectorAll(o.footer || "footer"), foot = foots[foots.length - 1] || null, at = foot && o.before ? foot.querySelector(o.before) : null;
    if (at) at.parentNode.insertBefore(d, at);
    else if (foot) { d.classList.add("ss-out"); foot.parentNode.insertBefore(d, foot); }
    else { d.classList.add("ss-out"); (document.querySelector("main") || document.body).appendChild(d); }
    return d;
  }
  window.SiteSocial = { mount: mount, href: href, KINDS: KINDS };
})();
