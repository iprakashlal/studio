/* The site's own menu, with sub-menus up to three levels deep, for every template. Content: content.menu = {
     custom, hover, arrows, mobileOpen,
     items: [{ id, label, show, to, page, cat, url, newTab, children: [{ …, children: [{ … }] }] }] }
   While `custom` is on and at least one item shows, the links of the template's menu are replaced with these; the
   template keeps its own look (each top-level link is a copy of one of its own links). Sub-menus drop down where
   the menu is a row and fold open where it is a column (phone menus, side menus).
   window.SiteMenu.mount(C, { navs: [css selectors], keep: "css of children to leave alone",
     resolve(item) -> { url, on }, onPick(a, event) }): safe to call again after every render.
   window.SiteMenu.wanted(C): is the custom menu on with something to show? */
(function () {
  "use strict";
  var CSS = [
    ".sm-has{position:relative;display:inline-flex;align-items:center;gap:2px}li.sm-has{display:flex}",
    ".sm-tg{appearance:none;border:0;background:transparent;color:inherit;cursor:pointer;padding:6px 4px;margin:0;display:inline-grid;place-items:center;border-radius:6px;font:inherit;line-height:1;opacity:.75}.sm-tg:hover{opacity:1}",
    ".sm-tg svg{width:12px;height:12px;transition:transform .2s}.sm-open>.sm-tg svg{transform:rotate(180deg)}",
    ".sm-sub{display:none;z-index:60;font:500 14.5px/1.35 var(--fb,system-ui,sans-serif);letter-spacing:0;text-transform:none}",
    ".sm-sub ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:1px}.sm-sub li{position:relative;display:flex;align-items:center;margin:0;padding:0}.sm-sub li::before,.sm-sub li::marker{content:none}",
    ".sm-sub a.sm-a{flex:1;min-width:0;display:block;padding:9px 12px;border-radius:8px;color:var(--text,#111);text-decoration:none;font:inherit;background:none;white-space:normal;text-align:left;margin:0;box-shadow:none;border:0;transform:none}",
    ".sm-sub a.sm-a::before,.sm-sub a.sm-a::after{content:none}",
    ".sm-sub a.sm-a:hover,.sm-sub a.sm-a:focus-visible,.sm-sub a.sm-a[aria-current]{background:color-mix(in srgb,var(--text,#111) 9%,transparent);color:var(--text,#111)}",
    ".sm-sub a.sm-a[aria-current]{font-weight:700}.sm-sub .sm-tg{color:var(--text,#111);padding:8px}.sm-nolink{cursor:default}",
    // a row: sub-menus drop down
    "[data-sm=pop] .sm-sub{position:absolute;top:100%;left:-8px;min-width:210px;max-width:min(300px,90vw);padding:7px;margin-top:6px;border-radius:min(var(--r,12px),14px);background:var(--surface,var(--bg,#fff));border:1px solid var(--line,rgba(0,0,0,.12));box-shadow:0 14px 40px rgba(0,0,0,.18)}",
    "[data-sm=pop] .sm-sub::before{content:'';position:absolute;left:0;right:0;top:-8px;height:8px}",
    "[data-sm=pop] .sm-sub.sm-flip{left:auto;right:-8px}",
    "[data-sm=pop] .sm-sub .sm-sub{top:-8px;left:100%;margin:0 0 0 4px}[data-sm=pop] .sm-sub .sm-sub::before{top:0;bottom:0;left:-6px;right:auto;width:6px;height:auto}[data-sm=pop] .sm-sub .sm-sub.sm-flip{left:auto;right:100%;margin:0 4px 0 0}",
    "[data-sm=pop] .sm-sub .sm-tg svg{transform:rotate(-90deg)}",
    "[data-sm=pop] .sm-open>.sm-sub{display:block;animation:sm-in .16s ease-out}@keyframes sm-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}",
    "@media (hover:hover){[data-sm=pop][data-sm-arrows=off]>.sm-has>.sm-tg:not(:focus-visible){position:absolute;width:1px;height:1px;padding:0;overflow:hidden;clip-path:inset(50%)}}",
    // a column: sub-menus fold open under their link
    "[data-sm=inline] .sm-has{display:flex;flex-wrap:wrap;width:100%}[data-sm=inline] .sm-has>a{flex:1;min-width:0}",
    "[data-sm=inline] .sm-tg{padding:10px 12px}[data-sm=inline] .sm-tg svg{width:14px;height:14px}",
    "[data-sm=inline] .sm-sub{flex:0 0 100%;width:100%;padding:2px 0 6px 14px;border-left:1px solid color-mix(in srgb,currentColor 22%,transparent);margin:2px 0 6px 6px}",
    "[data-sm=inline] .sm-sub a.sm-a,[data-sm=inline] .sm-sub .sm-tg{color:inherit}[data-sm=inline] .sm-sub a.sm-a:hover,[data-sm=inline] .sm-sub a.sm-a[aria-current]{color:inherit;background:color-mix(in srgb,currentColor 10%,transparent)}",
    "[data-sm=inline] .sm-open>.sm-sub{display:block}",
    "@media (prefers-reduced-motion:reduce){.sm-tg svg{transition:none}[data-sm=pop] .sm-open>.sm-sub{animation:none}}@media print{.sm-sub,.sm-tg{display:none!important}}"
  ].join("\n");
  var CARET = '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m2.5 4.5 3.5 3.5 3.5-3.5"/></svg>';
  function css() { if (document.getElementById("site-menu-css")) return; var s = document.createElement("style"); s.id = "site-menu-css"; s.textContent = CSS; document.head.appendChild(s); }
  var arr = function (x) { return Array.isArray(x) ? x : []; };
  var shown = function (list) { return arr(list).filter(function (i) { return i && typeof i === "object" && i.show !== false && String(i.label || "").trim(); }); };
  function wanted(C) { var M = (C && C.menu) || {}; return !!M.custom && shown(M.items).length > 0; }
  var pad2 = function (n) { return (n < 10 ? "0" : "") + n; };

  /** Put the label into a copy of one of the template's own links (which may hold a number, an icon, spans). */
  function setLabel(a, label, i) {
    var w = document.createTreeWalker(a, NodeFilter.SHOW_TEXT), n, best = null;
    while ((n = w.nextNode())) {
      var t = n.textContent.trim(); if (!t) continue;
      if (/^\d{2}$/.test(t)) { n.textContent = pad2(i + 1); continue; }
      if (!best || t.length > best.textContent.trim().length) best = n;
    }
    if (best) best.textContent = label; else a.textContent = label;
  }
  function link(a, it, o) {
    var r = (o.resolve && o.resolve(it)) || {}, url = String(r.url || "");
    a.removeAttribute("aria-current"); a.removeAttribute("id"); a.classList.remove("on", "active");
    // A section given its own page by this switch opens in the same tab, like any page of the site (resolve says so with `self`).
    if (url) { a.setAttribute("href", url); if (it.newTab && !r.self) { a.target = "_blank"; a.rel = "noopener"; } else { a.removeAttribute("target"); a.removeAttribute("rel"); } }
    else { a.removeAttribute("href"); a.removeAttribute("target"); a.setAttribute("role", "button"); a.tabIndex = 0; a.classList.add("sm-nolink"); }
    if (r.on) a.setAttribute("aria-current", "page");
    if (a.hasAttribute("data-nav")) { var m = /#([\w-]+)$/.exec(url); if (m) a.setAttribute("data-nav", m[1]); else a.removeAttribute("data-nav"); }
    return a;
  }
  function toggleBtn(label) {
    var b = document.createElement("button"); b.type = "button"; b.className = "sm-tg"; b.setAttribute("aria-expanded", "false"); b.setAttribute("aria-label", "More under " + label); b.innerHTML = CARET; return b;
  }
  /** A sub-menu: our own list, one more level inside it at most (depth 1 -> 2). */
  function sub(items, o, depth, open) {
    var box = document.createElement("div"); box.className = "sm-sub"; var ul = document.createElement("ul"); box.appendChild(ul);
    items.forEach(function (it) {
      var li = document.createElement("li"), a = document.createElement("a"); a.className = "sm-a"; a.textContent = it.label; link(a, it, o); li.appendChild(a);
      var kids = depth < 2 ? shown(it.children) : [];
      if (kids.length) { li.className = "sm-has" + (open ? " sm-open" : ""); var b = toggleBtn(it.label); if (open) b.setAttribute("aria-expanded", "true"); li.appendChild(b); li.appendChild(sub(kids, o, depth + 1, open)); }
      ul.appendChild(li);
    });
    return box;
  }
  function setOpen(has, on) {
    has.classList.toggle("sm-open", on); var b = has.querySelector(":scope > .sm-tg"); if (b) b.setAttribute("aria-expanded", String(on));
    if (!on) { Array.prototype.forEach.call(has.querySelectorAll(".sm-open"), function (x) { setOpen(x, false); }); return; }
    var box = has.querySelector(":scope > .sm-sub"); if (!box) return;
    box.classList.remove("sm-flip"); var r = box.getBoundingClientRect(); if (r.width && r.right > innerWidth - 6) box.classList.add("sm-flip");
  }
  function closeAll(root, but) {
    Array.prototype.forEach.call((root || document).querySelectorAll("[data-sm=pop] .sm-open"), function (x) { if (!but || !x.contains(but)) setOpen(x, false); });
  }
  /** A row of links drops its sub-menus down; a column (or anything else) folds them open in place. */
  function mode(el) {
    var cs = getComputedStyle(el), row = /flex/.test(cs.display) && !/^column/.test(cs.flexDirection);
    var m = row ? "pop" : "inline"; if (el.getAttribute("data-sm") === m) return;
    el.setAttribute("data-sm", m);
    var open = m === "inline" && el.getAttribute("data-sm-open") === "1";
    Array.prototype.forEach.call(el.querySelectorAll(".sm-has"), function (x) { setOpen(x, open); });
  }
  var watched = [], bound = false, ro = null;
  function bind() {
    if (bound) return; bound = true;
    document.addEventListener("click", function (e) {
      var t = e.target, tg = t.closest && t.closest(".sm-tg"), root = t.closest && t.closest("[data-sm]");
      if (tg && root) { e.preventDefault(); e.stopPropagation(); var has = tg.parentNode, on = !has.classList.contains("sm-open") || !!has.__smHover; has.__smHover = false; if (root.getAttribute("data-sm") === "pop") closeAll(root, has); setOpen(has, on); return; }
      var a = t.closest && t.closest("a");
      if (a && root) {
        var has2 = a.parentNode.classList.contains("sm-has") ? a.parentNode : null;
        if (!a.getAttribute("href")) { e.preventDefault(); if (has2) { var on2 = !has2.classList.contains("sm-open") || !!has2.__smHover; has2.__smHover = false; if (root.getAttribute("data-sm") === "pop") closeAll(root, has2); setOpen(has2, on2); } return; }
        closeAll(); var o = root.__sm; if (o && o.onPick) o.onPick(a, e); return;
      }
      closeAll();
    }, true);
    document.addEventListener("keydown", function (e) {
      var t = e.target, root = t.closest && t.closest("[data-sm]"); if (!root) return;
      var has = t.closest(".sm-has");
      if (e.key === "Escape" && has && has.classList.contains("sm-open")) { setOpen(has, false); var b = has.querySelector(":scope > .sm-tg"); if (b) b.focus(); e.stopPropagation(); return; }
      if ((e.key === "Enter" || e.key === " ") && t.classList.contains("sm-nolink")) { e.preventDefault(); t.click(); return; }
      if (e.key === "ArrowDown" && t.classList.contains("sm-tg")) { e.preventDefault(); setOpen(t.parentNode, true); var f = t.parentNode.querySelector(".sm-sub a"); if (f) f.focus(); }
    });
    var again = function () { watched = watched.filter(function (el) { return el.isConnected; }); watched.forEach(mode); };
    addEventListener("resize", again);
    if (window.ResizeObserver) ro = new ResizeObserver(again);
  }
  function hover(el) {
    var timer = null;
    Array.prototype.forEach.call(el.querySelectorAll(".sm-has"), function (has) {
      has.addEventListener("pointerenter", function (e) { if (e.pointerType !== "mouse" || el.getAttribute("data-sm") !== "pop") return; clearTimeout(timer); closeAll(el, has); if (!has.classList.contains("sm-open")) { has.__smHover = true; setOpen(has, true); } });
      has.addEventListener("pointerleave", function (e) { if (e.pointerType !== "mouse" || el.getAttribute("data-sm") !== "pop") return; clearTimeout(timer); if (!has.__smHover) return; timer = setTimeout(function () { has.__smHover = false; setOpen(has, false); }, 220); });
    });
  }
  function build(el, M, o) {
    var units = Array.prototype.filter.call(el.children, function (ch) {
      if (o.keep && ch.matches(o.keep)) return false;
      return ch.tagName === "A" || (ch.tagName === "LI" && ch.querySelector("a")) || ch.classList.contains("sm-has");
    });
    var sample = el.__smSample;
    if (!sample) { var first = units.filter(function (u) { return !u.classList.contains("sm-has"); })[0]; if (!first) return false; sample = el.__smSample = first.cloneNode(true); }
    var isLi = sample.tagName === "LI", before = units.length ? units[units.length - 1].nextSibling : null;
    units.forEach(function (u) { u.remove(); });
    var open = !!M.mobileOpen;
    shown(M.items).forEach(function (it, i) {
      var unit = sample.cloneNode(true), a = isLi ? unit.querySelector("a") : unit;
      setLabel(a, it.label, i); link(a, it, o); if (a.style && a.style.getPropertyValue("--d")) a.style.setProperty("--d", i);
      var kids = shown(it.children), node = unit;
      if (kids.length) {
        if (isLi) node = unit; else { node = document.createElement("span"); node.appendChild(unit); }
        node.classList.add("sm-has"); node.appendChild(toggleBtn(it.label)); node.appendChild(sub(kids, o, 1, open));
      }
      el.insertBefore(node, before);
    });
    el.__sm = o; el.setAttribute("data-sm-arrows", M.arrows === false ? "off" : "on"); el.setAttribute("data-sm-open", open ? "1" : "0"); el.removeAttribute("data-sm");
    mode(el); if (M.hover !== false) hover(el);
    if (watched.indexOf(el) < 0) { watched.push(el); if (ro) ro.observe(el); }
    return true;
  }
  function mount(C, o) {
    o = o || {}; var M = (C && C.menu) || {};
    if (!wanted(C)) return false;
    css(); bind();
    var done = false;
    (o.navs || []).forEach(function (sel) { Array.prototype.forEach.call(document.querySelectorAll(sel), function (el) { try { if (build(el, M, o)) done = true; } catch (e) { /* the template's own menu stays */ } }); });
    return done;
  }
  window.SiteMenu = { mount: mount, wanted: wanted };
})();
