/* Social and contact links in the footer, for every template. Content: content.social = {
     on, title,                               // title: a small heading such as "Follow us" (optional)
     style: "badges" | "labels" | "both",     // badges, plain labels, or a badge with its label
     align: "center" | "left" | "right",
     graphics: "icons" | "initials",          // what a badge shows unless its link says otherwise
     shape: "circle" | "rounded" | "square", fill: "outline" | "solid" | "soft" | "plain", size: "s" | "m" | "l",
     items: [{ kind, url, label, graphic, icon }] }   // graphic: "auto", "initials" or one of ICONS; icon: the owner's own picture
   A badge shows a plain line drawing (a camera, a play button, a speech bubble…) or the network's short initials. The
   drawings are generic on purpose: the networks' own logos are their trademarks, so the site doesn't draw them. An
   owner who wants a logo uploads it as that link's icon. Colours come from the theme (accent, text), so the badges
   fit every theme of every template.
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
  // Plain 24x24 line drawings (stroke only; "play" has one filled triangle). Not any network's logo.
  var ICONS = {
    camera: '<rect x="3" y="6.5" width="18" height="13.5" rx="3"/><path d="M8.5 6.5l1.2-2.200h4.600l1.200 2.200"/><circle cx="12" cy="13.200" r="3.500"/>',
    play: '<rect x="3" y="5" width="18" height="14" rx="4"/><path d="M10 9.200v5.600l5-2.800z" fill="currentColor"/>',
    chat: '<path d="M4 6.500A2.500 2.500 0 0 1 6.500 4h11A2.500 2.500 0 0 1 20 6.500v7a2.500 2.500 0 0 1-2.500 2.500H11l-4.500 4v-4A2.500 2.500 0 0 1 4 13.500z"/>',
    briefcase: '<rect x="3" y="7.500" width="18" height="12" rx="2.500"/><path d="M9 7.500V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.500M3 13h18"/>',
    code: '<path d="M8.500 7.500L4 12l4.500 4.500M15.500 7.500L20 12l-4.500 4.500M13.500 5l-3 14"/>',
    pen: '<path d="M4 20l1-4.500L16.500 4a2.100 2.100 0 0 1 3 3L8 18.500zM14.500 6l3.500 3.500"/>',
    pin: '<path d="M12 21s6.500-5.600 6.500-11a6.500 6.500 0 0 0-13 0c0 5.400 6.500 11 6.500 11z"/><circle cx="12" cy="10" r="2.400"/>',
    mail: '<rect x="3" y="5.500" width="18" height="13" rx="2.500"/><path d="M4 7.500l8 6 8-6"/>',
    phone: '<path d="M6.500 3.500h3l1.500 4-2 1.500a12 12 0 0 0 6 6l1.500-2 4 1.500v3a2 2 0 0 1-2.200 2A16.500 16.500 0 0 1 4.500 5.700a2 2 0 0 1 2-2.200z"/>',
    globe: '<circle cx="12" cy="12" r="8.500"/><path d="M3.500 12h17M12 3.500c2.800 3 2.800 14 0 17M12 3.500c-2.800 3-2.800 14 0 17"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.700 0l3-3a4 4 0 0 0-5.700-5.700l-1 1M14 10a4 4 0 0 0-5.700 0l-3 3a4 4 0 0 0 5.700 5.700l1-1"/>',
    tag: '<path d="M3.500 12.500V5a1.500 1.500 0 0 1 1.500-1.500h7.500L21 12l-8.500 8.500z"/><circle cx="8" cy="8" r="1.400"/>',
    people: '<circle cx="9" cy="8.500" r="3.200"/><path d="M3 19.500c.5-3.500 3-5.500 6-5.500s5.500 2 6 5.500M16 5.600a3.200 3.200 0 0 1 0 5.800M17.500 14.300c1.900.7 3.200 2.500 3.500 5.200"/>',
    megaphone: '<path d="M4 10v4h3l8 4.500v-13L7 10zM18 9.500a4 4 0 0 1 0 5M8 14.500l1 4.500h2.500"/>',
    star: '<path d="M12 3.500l2.600 5.300 5.900.9-4.200 4.100 1 5.800L12 16.900l-5.300 2.700 1-5.800-4.200-4.100 5.900-.9z"/>',
    heart: '<path d="M12 20s-7.500-4.500-7.500-10a4.300 4.300 0 0 1 7.500-2.800A4.300 4.300 0 0 1 19.500 10c0 5.500-7.500 10-7.500 10z"/>'
  };
  // The drawing a kind gets when its link doesn't choose one: by what the place is for, not by its brand.
  var AUTO = { instagram: "camera", facebook: "people", x: "megaphone", linkedin: "briefcase", youtube: "play", whatsapp: "chat", telegram: "chat", threads: "chat", pinterest: "heart", snapchat: "camera", tiktok: "play",
    github: "code", behance: "pen", dribbble: "pen", medium: "pen", maps: "pin", indiamart: "tag", justdial: "star", email: "mail", phone: "phone", website: "globe", other: "link" };
  var svg = function (name) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.700" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + "</svg>"; };
  var CSS = [
    ".ss{display:flex;flex-wrap:wrap;align-items:center;gap:10px 12px;padding:18px 0;font-family:var(--fb,inherit);color:inherit}",
    ".ss[data-align=center]{justify-content:center}.ss[data-align=right]{justify-content:flex-end}.ss-out{padding:22px clamp(18px,4vw,32px);max-width:1200px;margin:0 auto}",
    ".ss-t{font-size:12.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;opacity:.7;margin-right:4px}",
    ".ss-a{display:inline-flex;align-items:center;gap:8px;color:inherit;text-decoration:none;font-size:14.5px;font-weight:600;line-height:1;border-radius:99px;transition:transform .15s,opacity .15s}",
    ".ss-a:hover{transform:translateY(-2px)}.ss-a:focus-visible{outline:2px solid var(--c1,var(--accent,currentColor));outline-offset:3px}",
    ".ss{--ss-s:38px;--ss-acc:var(--c1,var(--accent,currentColor));--ss-on:var(--on-c1,var(--on-accent,#fff))}.ss[data-size=s]{--ss-s:32px}.ss[data-size=l]{--ss-s:46px}",
    ".ss-b{width:var(--ss-s);height:var(--ss-s);flex:none;border-radius:50%;display:grid;place-items:center;font-size:calc(var(--ss-s)*.3);font-weight:800;letter-spacing:.02em;border:1.5px solid color-mix(in srgb,currentColor 32%,transparent);background:color-mix(in srgb,currentColor 7%,transparent);transition:background .15s,color .15s,border-color .15s}",
    ".ss-b svg{width:54%;height:54%;display:block}.ss[data-shape=rounded] .ss-b,.ss[data-shape=rounded] .ss-b img{border-radius:30%}.ss[data-shape=square] .ss-b,.ss[data-shape=square] .ss-b img{border-radius:6px}",
    ".ss[data-fill=solid] .ss-b{background:var(--ss-acc);border-color:transparent;color:var(--ss-on)}.ss[data-fill=soft] .ss-b{background:color-mix(in srgb,var(--ss-acc) 26%,transparent);border-color:color-mix(in srgb,var(--ss-acc) 45%,transparent)}",
    ".ss[data-fill=plain] .ss-b{background:none;border-color:transparent}.ss[data-fill=plain] .ss-b svg{width:66%;height:66%}",
    ".ss-a:hover .ss-b{background:var(--ss-acc);border-color:transparent;color:var(--ss-on)}.ss[data-fill=solid] .ss-a:hover .ss-b{background:none;border-color:var(--ss-acc);color:var(--ss-acc)}.ss[data-fill=plain] .ss-a:hover .ss-b{background:none;color:var(--ss-acc)}",
    ".ss-b img{width:100%;height:100%;border-radius:50%;object-fit:cover;display:block}.ss-b.pic{border:0!important;background:none!important}",
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
      // The link's own choice, else the row's: a drawing (the kind's usual one) or initials.
      var own = it.graphic === "initials" || ICONS[it.graphic] ? it.graphic : "", g = own || (S.graphics === "initials" ? "initials" : AUTO[k] || "link");
      var badge = style === "labels" ? "" : '<span class="ss-b' + (pic ? " pic" : "") + '" data-g="' + (pic ? "own" : g) + '" aria-hidden="true">' + (pic ? '<img src="' + esc(pic) + '" alt="" loading="lazy">' : g === "initials" ? esc(KINDS[k][1]) : svg(g)) + "</span>";
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
    d.setAttribute("data-align", /^(left|right)$/.test(S.align) ? S.align : "center");
    d.setAttribute("data-shape", /^(rounded|square)$/.test(S.shape) ? S.shape : "circle"); d.setAttribute("data-fill", /^(solid|soft|plain)$/.test(S.fill) ? S.fill : "outline"); d.setAttribute("data-size", /^(s|l)$/.test(S.size) ? S.size : "m"); d.setAttribute("role", "navigation"); d.setAttribute("aria-label", S.title || "Social links"); d.innerHTML = html;
    var foots = document.querySelectorAll(o.footer || "footer"), foot = foots[foots.length - 1] || null, at = foot && o.before ? foot.querySelector(o.before) : null;
    if (at) at.parentNode.insertBefore(d, at);
    else if (foot) { d.classList.add("ss-out"); foot.parentNode.insertBefore(d, foot); }
    else { d.classList.add("ss-out"); (document.querySelector("main") || document.body).appendChild(d); }
    return d;
  }
  window.SiteSocial = { mount: mount, href: href, KINDS: KINDS, ICONS: ICONS, AUTO: AUTO };
})();
