/* Static pages (privacy policy, terms, shipping, any reading page) for every template.
   Content: content.staticPages = [{ id, title, slug, subtitle, updated, body, show, inNav, inFooter, navLabel,
   showTitle, align, size, width, toc, noindex }]. A page opens at page.html?p=<slug> (the portfolio: ./?p=<slug>).
   The body is plain text with a few simple marks:
     # or ## Heading      ### Smaller heading      - or * bullet      1. numbered      > quote      --- line
     **bold**  *italic*  [words](https://link)  and bare links or emails become links.
   window.SitePages: list(C), find(C, slug), slug(p), here(), article(p, opts), missing(opts), body(text), css() */
(function () {
  "use strict";
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var slugify = function (s) { return String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60); };
  var slugOf = function (p) { return slugify(p && (p.slug || p.title)) || (p && p.id) || ""; };
  /** Pages visitors can open (preview shows hidden ones too, marked). */
  function list(C, all) { return ((C && C.staticPages) || []).filter(function (p) { return p && slugOf(p) && String(p.title || "").trim() && (all || p.show !== false); }); }
  function find(C, slug, all) { var s = slugify(slug); return list(C, all).filter(function (p) { return slugOf(p) === s; })[0] || null; }
  function here() { try { return new URLSearchParams(location.search).get("p") || ""; } catch (e) { return ""; } }

  function inline(s) {
    // s is already escaped
    var links = [];
    var keep = function (html) { links.push(html); return "\u0000" + (links.length - 1) + "\u0000"; };
    s = s.replace(/\[([^\]\n]+)\]\(((?:https?:\/\/|mailto:|tel:|\/|\.\/|#|[\w-]+\.html)[^\s)]*)\)/g, function (_, t, u) {
      var ext = /^https?:/i.test(u);
      return keep('<a href="' + u + '"' + (ext ? ' target="_blank" rel="noopener"' : "") + ">" + t + "</a>");
    });
    s = s.replace(/\bhttps?:\/\/[^\s<]+[^\s<.,;:!?)\]'"]/g, function (u) { return keep('<a href="' + u + '" target="_blank" rel="noopener">' + u + "</a>"); });
    s = s.replace(/\b[\w.+-]+@[\w-]+(\.[\w-]+)+\b/g, function (m) { return keep('<a href="mailto:' + m + '">' + m + "</a>"); });
    // text styles: {accent:words} {big:words} {small:words} {muted:words}, ==highlight==, ~~struck~~, __underlined__
    for (var i = 0; i < 3; i++) s = s.replace(/\{(accent|big|small|muted):([^{}\n]+)\}/g, '<span class="sp-$1">$2</span>');
    s = s.replace(/==(?=\S)([^=\n]*?\S)==/g, "<mark>$1</mark>").replace(/~~(?=\S)([^~\n]*?\S)~~/g, "<s>$1</s>").replace(/(^|[^\w])__(?=\S)([^_\n]*?\S)__(?!\w)/g, "$1<u>$2</u>");
    s = s.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*\w])\*(?=\S)([^*\n]*?\S)\*(?!\w)/g, "$1<em>$2</em>").replace(/(^|[^\w])_(?=\S)([^_\n]*?\S)_(?!\w)/g, "$1<em>$2</em>");
    return s.replace(/\u0000(\d+)\u0000/g, function (_, i) { return links[+i]; });
  }
  /** The body's HTML, and its section headings (for the contents list). */
  function parse(text) {
    var lines = String(text || "").replace(/\r\n?/g, "\n").split("\n"), out = [], heads = [], used = {}, para = [], list = null, quote = [], table = [], pc = "";
    var idFor = function (t) { var b = slugify(t.replace(/<[^>]+>/g, "")) || "section", id = b, n = 2; while (used[id]) id = b + "-" + n++; used[id] = 1; return id; };
    var flushP = function () { if (para.length) { out.push("<p" + pc + ">" + para.map(function (l) { return inline(esc(l)); }).join("<br>") + "</p>"); para = []; pc = ""; } };
    var flushL = function () { if (list) { out.push("<" + list.tag + ">" + list.items.map(function (i) { return "<li>" + inline(esc(i)) + "</li>"; }).join("") + "</" + list.tag + ">"); list = null; } };
    var flushQ = function () { if (quote.length) { out.push("<blockquote>" + quote.map(function (l) { return inline(esc(l)); }).join("<br>") + "</blockquote>"); quote = []; } };
    // A table: lines that start with |, cells split by |. A second line of dashes (|---|:--:|--:|) makes the first
    // line the heading row and sets each column's alignment.
    var cells = function (l) { return l.replace(/^\|/, "").replace(/\|\s*$/, "").split(/(?<!\\)\|/).map(function (c) { return c.replace(/\\\|/g, "|").trim(); }); };
    var flushT = function () {
      if (!table.length) return;
      var rows = table.map(cells), al = [], head = null;
      if (rows.length > 1 && rows[1].every(function (c) { return /^:?-{2,}:?$/.test(c); })) { al = rows[1].map(function (c) { return /^:.*:$/.test(c) ? "center" : /:$/.test(c) ? "right" : ""; }); head = rows[0]; rows = rows.slice(2); }
      var n = Math.max.apply(null, rows.concat(head ? [head] : []).map(function (x) { return x.length; }));
      var row = function (x, tag) { var h = "<tr>"; for (var i = 0; i < n; i++) h += "<" + tag + (al[i] ? ' style="text-align:' + al[i] + '"' : "") + ">" + inline(esc(x[i] || "")) + "</" + tag + ">"; return h + "</tr>"; };
      out.push('<div class="sp-table"><table>' + (head ? "<thead>" + row(head, "th") + "</thead>" : "") + "<tbody>" + rows.map(function (x) { return row(x, "td"); }).join("") + "</tbody></table></div>");
      table = [];
    };
    var flush = function () { flushP(); flushL(); flushQ(); flushT(); };
    lines.forEach(function (raw) {
      var l = raw.replace(/\s+$/, ""), t = l.trim(), m;
      if (!t) { flush(); return; }
      if (/^\|.*\|/.test(t) || (table.length && /^\|/.test(t))) { flushP(); flushL(); flushQ(); table.push(t); return; }
      flushT();
      if ((m = /^!>\s?(.+)$/.exec(t))) { flush(); out.push('<p class="sp-note">' + inline(esc(m[1])) + "</p>"); return; }
      if ((m = /^->\s?(.+?)(\s*<-)?$/.exec(t))) { flush(); out.push('<p class="sp-center">' + inline(esc(m[1])) + "</p>"); return; }
      if ((m = /^(#{1,3})\s+(.+)$/.exec(t))) {
        flush();
        var lv = m[1].length === 3 ? 3 : 2, h = inline(esc(m[2].replace(/\s*#+$/, ""))), id = idFor(m[2]);
        if (lv === 2) heads.push({ id: id, text: m[2].replace(/\*\*|__/g, "") });
        out.push("<h" + lv + ' id="' + id + '">' + h + "</h" + lv + ">");
        return;
      }
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) { flush(); out.push("<hr>"); return; }
      if ((m = /^>\s?(.*)$/.exec(t))) { flushP(); flushL(); quote.push(m[1]); return; }
      if ((m = /^[-*•]\s+(.+)$/.exec(t))) { flushP(); flushQ(); if (!list || list.tag !== "ul") { flushL(); list = { tag: "ul", items: [] }; } list.items.push(m[1]); return; }
      if ((m = /^\d{1,3}[.)]\s+(.+)$/.exec(t))) { flushP(); flushQ(); if (!list || list.tag !== "ol") { flushL(); list = { tag: "ol", items: [] }; } list.items.push(m[1]); return; }
      if (list && /^\s{2,}\S/.test(l)) { list.items[list.items.length - 1] += " " + t; return; }
      flushL(); flushQ(); para.push(t);
    });
    flush();
    return { html: out.join(""), heads: heads };
  }

  var CSS = [
    ".sp{--sp-ac:var(--c1,var(--accent,currentColor));--sp-soft:var(--soft,inherit);--sp-line:var(--line,rgba(128,128,128,.28));color:var(--text,inherit);font-family:var(--fb,inherit);padding:clamp(28px,6vw,72px) 20px clamp(48px,8vw,96px);position:relative;z-index:2}",
    ".sp-in{max-width:760px;margin:0 auto}.sp[data-width=wide] .sp-in{max-width:1040px}.sp[data-width=full] .sp-in{max-width:none}",
    ".sp-crumbs{font-size:14px;color:var(--sp-soft);margin:0 0 18px}.sp-crumbs a{color:inherit;text-decoration:underline;text-underline-offset:3px}",
    ".sp-head{margin:0 0 clamp(24px,4vw,40px);padding-bottom:clamp(18px,3vw,28px);border-bottom:1px solid var(--sp-line)}.sp[data-align=center] .sp-head{text-align:center}",
    ".sp-head h1{font-family:var(--fd,inherit);font-size:clamp(32px,5.2vw,56px);line-height:1.06;letter-spacing:-.02em;margin:0;color:inherit;font-weight:800}",
    ".sp[data-size=medium] .sp-head h1{font-size:clamp(28px,4vw,42px)}.sp[data-size=small] .sp-head h1{font-size:clamp(24px,3vw,32px)}",
    ".sp-sub{font-size:clamp(16px,1.6vw,19px);color:var(--sp-soft);margin:14px 0 0;line-height:1.5}.sp[data-align=center] .sp-sub{margin-left:auto;margin-right:auto;max-width:620px}",
    ".sp-date{font-size:13px;color:var(--sp-soft);margin:14px 0 0;letter-spacing:.02em}",
    ".sp-toc{border:1px solid var(--sp-line);border-radius:min(var(--r,12px),14px);padding:16px 20px;margin:0 0 32px;font-size:15px}.sp-toc b{display:block;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--sp-soft);margin-bottom:8px}",
    ".sp-toc ol{list-style:decimal;margin:0;padding-left:20px;columns:2 240px;column-gap:28px}.sp-toc li{margin:4px 0;break-inside:avoid}.sp-toc a{color:inherit;text-decoration:none}.sp-toc a:hover{color:var(--sp-ac);text-decoration:underline}",
    ".sp-body{font-size:clamp(16px,1.25vw,17.5px);line-height:1.72;overflow-wrap:anywhere}.sp-body>*:first-child{margin-top:0}",
    ".sp-body p{margin:0 0 1.05em}.sp-body h2{font-family:var(--fd,inherit);font-size:clamp(21px,2.2vw,27px);line-height:1.2;margin:1.9em 0 .6em;color:inherit;font-weight:700;scroll-margin-top:90px}",
    ".sp-body h3{font-size:clamp(17px,1.5vw,19px);line-height:1.3;margin:1.5em 0 .45em;color:inherit;font-weight:700;scroll-margin-top:90px}",
    ".sp-body ul,.sp-body ol{margin:0 0 1.1em;padding-left:1.4em}.sp-body ul{list-style:disc}.sp-body ol{list-style:decimal}.sp-body li{display:list-item;margin:.3em 0;padding:0}.sp-body li::before{content:none}.sp-body li::marker{color:var(--sp-ac)}",
    ".sp-body a{color:var(--sp-ac);text-decoration:underline;text-underline-offset:3px}.sp-body strong{font-weight:700;color:inherit}.sp-body em{font-style:italic;color:inherit}",
    ".sp-body blockquote{margin:0 0 1.1em;padding:12px 18px;border-left:3px solid var(--sp-ac);background:color-mix(in srgb,var(--sp-ac) 7%,transparent);border-radius:0 10px 10px 0}",
    ".sp-table{overflow-x:auto;margin:0 0 1.2em;border:1px solid var(--sp-line);border-radius:min(var(--r,12px),12px)}.sp-table table{width:100%;border-collapse:collapse;font-size:.94em;line-height:1.5}",
    ".sp-table th,.sp-table td{padding:10px 14px;text-align:left;vertical-align:top;border-bottom:1px solid var(--sp-line);color:inherit}.sp-table th{font-weight:700;background:color-mix(in srgb,var(--sp-ac) 9%,transparent);white-space:nowrap}.sp-table tbody tr:last-child td{border-bottom:0}",
    ".sp-body mark{background:color-mix(in srgb,var(--sp-ac) 24%,transparent);color:inherit;padding:.05em .25em;border-radius:4px}.sp-body u{text-decoration:underline;text-underline-offset:3px}.sp-body s{opacity:.7}",
    ".sp-accent{color:var(--sp-ac)}.sp-big{font-size:1.3em;line-height:1.35}.sp-small{font-size:.86em}.sp-muted{color:var(--sp-soft)}.sp-body .sp-center{text-align:center}",
    ".sp-body .sp-note{padding:12px 16px;border:1px solid color-mix(in srgb,var(--sp-ac) 40%,transparent);background:color-mix(in srgb,var(--sp-ac) 8%,transparent);border-radius:10px}",
    ".sp-body hr{border:0;border-top:1px solid var(--sp-line);margin:2em 0}",
    ".sp-flag{display:inline-block;font-size:12px;font-weight:700;padding:3px 10px;border-radius:99px;background:#fff3cd;color:#6b4b00;margin-bottom:12px}",
    ".sp-links{display:flex;flex-wrap:wrap;gap:6px 18px;justify-content:center;padding:18px 20px 28px;font-size:14px;position:relative;z-index:2}.sp-links a{color:var(--soft,inherit);text-decoration:none}.sp-links a:hover{color:var(--text,inherit);text-decoration:underline}",
    ".sp-top{display:flex;align-items:center;justify-content:space-between;gap:12px;max-width:1040px;margin:0 auto;padding:18px 20px;position:relative;z-index:3}.sp-top a{color:var(--text,inherit);text-decoration:none;font-weight:700}.sp-top .sp-back{font-weight:500;color:var(--soft,inherit)}",
    "@media print{.sp{padding:0}.sp-toc{display:none}}"
  ].join("\n");
  function css() { if (document.getElementById("sp-css")) return; var s = document.createElement("style"); s.id = "sp-css"; s.textContent = CSS; document.head.appendChild(s); }

  /** The whole reading page. opts: { home, homeLabel, preview } */
  function article(p, opts) {
    opts = opts || {}; css();
    var b = parse(p.body), showT = p.showTitle !== false;
    var head = (showT || p.subtitle || p.updated) ? '<header class="sp-head">' +
      (showT ? "<h1>" + esc(p.title).replace(/\n/g, "<br>") + "</h1>" : "") +
      (p.subtitle ? '<p class="sp-sub">' + inline(esc(p.subtitle)).replace(/\n/g, "<br>") + "</p>" : "") +
      (p.updated ? '<p class="sp-date">' + esc(p.updatedLabel || "Last updated") + ": " + esc(p.updated) + "</p>" : "") + "</header>" : "";
    var toc = p.toc && b.heads.length > 1 ? '<nav class="sp-toc" aria-label="On this page"><b>' + esc(p.tocLabel || "On this page") + "</b><ol>" + b.heads.map(function (h) { return '<li><a href="#' + h.id + '">' + esc(h.text) + "</a></li>"; }).join("") + "</ol></nav>" : "";
    return '<article class="sp" id="page" data-align="' + (p.align === "center" ? "center" : "left") + '" data-size="' + esc(p.size || "large") + '" data-width="' + esc(p.width || "narrow") + '"><div class="sp-in">' +
      (opts.preview && p.show === false ? '<span class="sp-flag">Hidden: visitors can\'t open this page</span>' : "") +
      (opts.home && p.crumbs !== false ? '<p class="sp-crumbs"><a href="' + esc(opts.home) + '">' + esc(opts.homeLabel || "Home") + "</a> / " + esc(p.navLabel || p.title) + "</p>" : "") +
      head + toc + '<div class="sp-body">' + (b.html || (opts.preview ? '<p style="opacity:.6">Write this page\'s text in the editor.</p>' : "")) + "</div></div></article>";
  }
  function missing(opts) {
    opts = opts || {}; css();
    return '<article class="sp" id="page"><div class="sp-in"><header class="sp-head"><h1>Page not found</h1><p class="sp-sub">This page has moved or isn\'t available.</p></header><div class="sp-body"><p><a href="' + esc(opts.home || "./") + '">← ' + esc(opts.homeLabel || "Back to the home page") + "</a></p></div></div></article>";
  }
  /** After a page renders: jump to #section links, and set the noindex robots tag. */
  function after(p) {
    var m = document.head.querySelector('meta[name="robots"][data-sp]');
    if (p && p.noindex) { if (!m) { m = document.createElement("meta"); m.name = "robots"; m.setAttribute("data-sp", ""); document.head.appendChild(m); } m.content = "noindex"; } else if (m) m.remove();
    if (location.hash) { var el = document.getElementById(decodeURIComponent(location.hash.slice(1))); if (el) setTimeout(function () { el.scrollIntoView(); }, 30); }
  }
  window.SitePages = { list: list, find: find, slug: slugOf, here: here, article: article, missing: missing, body: function (t) { return parse(t).html; }, css: css, after: after, esc: esc };
})();
