import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { TemplateDef } from "../schema/types";
import { STUDIO_BUILD } from "../build-info";
import { contentIndex, locateField, matchImage, matchText } from "./locate";
import { GOTO_EVENT } from "./Editor";

const EDIT_KEY = "site-studio:click-to-edit";
const editPref = () => { try { return localStorage.getItem(EDIT_KEY) !== "off"; } catch { return true; } };

/** The template page for this Studio build, so a Studio update never previews a cached older template. */
const pageUrl = (base: string, file: string, r = 0) => `${base}${file}?v=${STUDIO_BUILD.id}${r ? `&r=${r}` : ""}`;

// The template pages run in an iframe named "cms-preview". They announce themselves with
// { type: "cms:ready", page } and render whatever { type: "cms:content" } we send back.

const DEVICES = [
  { id: "desktop", label: "Desktop", w: 1280 },
  { id: "tablet", label: "Tablet", w: 820 },
  { id: "phone", label: "Phone", w: 390 },
] as const;

/** `editable: false` (the Themes page): no click-to-edit, since there are no fields to open there. */
export function Preview({ tpl, base, content, version, assets, editable = true }: { tpl: TemplateDef; base: string; content: any; version: number; assets: Record<string, string>; editable?: boolean }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [device, setDevice] = useState<(typeof DEVICES)[number]["id"]>("desktop");
  const [page, setPage] = useState(tpl.pages[0].file);
  const [src, setSrc] = useState(pageUrl(base, tpl.pages[0].file));
  const [size, setSize] = useState({ w: 600, h: 600 });
  const latest = useRef({ content, assets });
  latest.current = { content, assets };
  const [editOn, setEditOn] = useState(() => editable && editPref());
  const live = useRef({ editOn, idx: contentIndex(content), tpl, content, assets });
  live.current = { editOn, idx: live.current.content === content && live.current.idx ? live.current.idx : contentIndex(content), tpl, content, assets };
  useEffect(() => { live.current.idx = contentIndex(content); }, [version]);
  useEffect(() => { if (editable) try { localStorage.setItem(EDIT_KEY, editOn ? "on" : "off"); } catch { /* private mode */ } if (!editOn) frame.current?.contentDocument?.getElementById("cms-edit-ui")?.remove(); }, [editOn]);
  const wire = () => { if (!editable) return; try { const d = frame.current?.contentDocument; if (d) clickToEdit(d, live); } catch { /* another origin */ } };

  const send = () => {
    const w = frame.current?.contentWindow;
    if (w) w.postMessage({ type: "cms:content", content: latest.current.content, assets: latest.current.assets }, location.origin);
  };

  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== frame.current?.contentWindow) return;
      if (e.data?.type === "cms:ready") {
        if (e.data.page) setPage(e.data.page);
        send();
      }
    };
    addEventListener("message", on);
    return () => removeEventListener("message", on);
  }, []);

  useEffect(() => {
    const t = setTimeout(send, 120);
    return () => clearTimeout(t);
  }, [version, assets]);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const dw = DEVICES.find((d) => d.id === device)!.w;
  const scale = Math.min(1, (size.w - 24) / dw);
  const go = (file: string) => {
    setPage(file);
    setSrc(pageUrl(base, file, file === page ? Date.now() : 0));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-ink-950">
      <div className="flex flex-wrap items-center gap-2 border-b border-ink-700 px-3 py-2">
        <span className="text-xs font-bold uppercase tracking-wider text-ink-400">Live preview</span>
        {tpl.pages.length > 1 && (
          <select aria-label="Preview page" className="input w-auto py-1.5 text-[13px]" value={page} onChange={(e) => go(e.target.value)}>
            {tpl.pages.map((p) => <option key={p.file} value={p.file}>{p.label}</option>)}
          </select>
        )}
        <div className="ml-auto flex gap-1" role="group" aria-label="Device size">
          {DEVICES.map((d) => (
            <button key={d.id} type="button" aria-pressed={device === d.id} onClick={() => setDevice(d.id)} className={`btn btn-sm ${device === d.id ? "border-brand-500 text-brand-300" : ""}`}>{d.label}</button>
          ))}
          <button type="button" className="btn btn-sm" title="Reload preview" aria-label="Reload preview" onClick={() => go(page)}>↻</button>
          {editable && <button type="button" aria-pressed={editOn} onClick={() => setEditOn(!editOn)} title="Point at text or a picture in the preview to see its field; Ctrl+click (⌘+click on a Mac), or press and hold on touch, to open it" className={`btn btn-sm ${editOn ? "border-brand-500 text-brand-300" : ""}`}>✎ Click to edit</button>}
        </div>
      </div>
      <div ref={box} className="relative min-h-0 flex-1 overflow-hidden">
        <div className="absolute left-1/2 top-3 origin-top overflow-hidden rounded-lg border border-ink-700 bg-white shadow-2xl" style={{ width: dw, height: (size.h - 24) / scale, transform: `translateX(-50%) scale(${scale})` }}>
          <iframe ref={frame} name="cms-preview" title="Site preview" src={src} onLoad={wire} className="h-full w-full border-0" />
        </div>
      </div>
    </div>
  );
}

type Live = { current: { editOn: boolean; idx: ReturnType<typeof contentIndex>; tpl: TemplateDef; content: any; assets: Record<string, string> } };

/** In the preview page: outline what's under the pointer (or a tap) and offer "✎ Section → Field" to jump to its field. */
function clickToEdit(doc: Document, live: Live) {
  const w = doc.defaultView as (Window & { __cte?: boolean }) | null;
  if (!w || w.__cte) return;
  w.__cte = true;
  // Which upload each picture is (path → address), for checking click-to-edit in tests.
  Object.defineProperty(w, "__cteAssets", { get: () => live.current.assets });
  let ui: HTMLElement | null = null, box: HTMLElement, chip: HTMLElement, cur: { el: Element; path?: string; cat?: string } | null = null, raf = 0;
  const build = () => {
    ui = doc.createElement("div"); ui.id = "cms-edit-ui";
    ui.innerHTML = `<style>#cms-edit-ui{position:fixed;inset:0;pointer-events:none;z-index:2147483647}#cms-edit-ui .b{position:fixed;border:2px solid #5B7CFF;border-radius:6px;background:rgba(91,124,255,.07);box-shadow:0 0 0 4px rgba(91,124,255,.16);transition:all .08s}#cms-edit-ui .c{position:fixed;font:600 12px/1 system-ui,-apple-system,Segoe UI,sans-serif;color:#fff;background:#4A67F0;border-radius:7px;padding:7px 10px;box-shadow:0 6px 18px rgba(0,0,0,.28);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:0;text-transform:none}#cms-edit-ui .c i{font-style:normal;opacity:.75;font-weight:500}</style><div class="b"></div><div class="c" role="status"></div>`;
    box = ui.querySelector(".b") as HTMLElement; chip = ui.querySelector(".c") as HTMLElement;
    doc.body.appendChild(ui);
  };
  // The label only names the field; Ctrl+click (⌘+click on a Mac) on the outlined item opens it. Touch: press and hold.
  const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent), hint = mac ? "⌘+click to edit" : "Ctrl+click to edit";
  const go = (hit: { path?: string; cat?: string } | null) => {
    if (!hit) return;
    parent.dispatchEvent(new CustomEvent(GOTO_EVENT, { detail: hit.path ? { path: hit.path } : { cat: hit.cat } }));
  };
  const hide = () => { if (ui) ui.style.display = "none"; cur = null; };
  /** The content section an element is in ("hero", "about"…), to prefer that section's values. */
  const sectionOf = (el: Element | null) => { const id = el?.closest("section[id], header[id], footer[id], [data-section]")?.getAttribute("data-section") || el?.closest("section[id], header[id], footer[id]")?.id || ""; return id === "top" ? "hero" : id; };
  const find = (el: Element | null): { el: Element; path?: string; cat?: string; label: string } | null => {
    const L = live.current, prefer = sectionOf(el), region = el?.closest("[data-edit]");
    for (let n = el, d = 0; n && n !== doc.body && d < 7; n = n.parentElement, d++) {
      if (n.closest("#cms-edit-ui")) return null;
      // A part that names its field (the hero graphic) wins over text further up around it.
      if (n.hasAttribute("data-edit")) { const dp = n.getAttribute("data-edit") || "", dl = locateField(L.tpl.schema, dp, L.content); if (dl) return { el: n, path: dp, label: dl.trail.join(" → ") }; }
      let path: string | null = null;
      if (n.tagName === "IMG") path = matchImage(L.idx, (n as HTMLImageElement).getAttribute("src") || "", L.assets);
      // Inside the hero graphic its words repeat your content: they belong to the graphic, not those fields.
      if (!path && !(region && region !== n && region.contains(n))) { const t = n.textContent || ""; if (t.trim() && t.length < 700) path = matchText(L.idx, t, prefer); }
      if (path) {
        const loc = locateField(L.tpl.schema, path, L.content);
        if (loc) return { el: n, path, label: loc.trail.join(" → ") };
      }
    }
    // Parts of the page that name their field (the hero graphic, an empty portrait): data-edit="hero.graphic".
    const named = el?.closest("[data-edit]");
    if (named) {
      const path = named.getAttribute("data-edit") || "", loc = locateField(L.tpl.schema, path, L.content);
      if (loc) return { el: named, path, label: loc.trail.join(" → ") };
    }
    // Nothing editable right here: offer the page section it's in.
    const sec = el?.closest("section[id], header[id], footer[id], [data-section]");
    const id = sec?.getAttribute("data-section") || sec?.id || "";
    const cat = L.tpl.schema.find((c) => c.id === id || (id === "top" && c.id === "hero"));
    return cat && sec ? { el: sec, cat: cat.id, label: cat.label } : null;
  };
  const show = (hit: NonNullable<ReturnType<typeof find>>) => {
    if (!ui || !ui.isConnected) build();
    const r = hit.el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return hide();
    ui!.style.display = "";
    // The preview is zoomed out to fit (a desktop page on a phone): keep the outline and button a readable size.
    const fw = (w!.frameElement as HTMLElement | null)?.getBoundingClientRect().width || w!.innerWidth, k = Math.max(1, Math.min(4, w!.innerWidth / fw));
    Object.assign(chip.style, { fontSize: 12 * k + "px", padding: `${7 * k}px ${10 * k}px`, borderRadius: 7 * k + "px", maxWidth: Math.min(460 * k, w!.innerWidth - 12) + "px" });
    box.style.borderWidth = 2 * k + "px";
    Object.assign(box.style, { left: r.left - 4 + "px", top: r.top - 4 + "px", width: r.width + 8 + "px", height: r.height + 8 + "px" });
    chip.innerHTML = "";
    chip.append("✎ " + hit.label + "  ");
    const h = doc.createElement("i"); h.textContent = "· " + (coarse ? "press and hold to edit" : hint); chip.append(h);
    const ch = chip.offsetHeight || 26 * k, top = r.top > ch + 8 ? r.top - ch - 6 : Math.min(r.bottom + 6, w!.innerHeight - ch - 4);
    chip.style.left = Math.max(6, Math.min(r.left - 4, w!.innerWidth - chip.offsetWidth - 6)) + "px"; chip.style.top = top + "px";
    cur = hit;
  };
  // Holding Ctrl / ⌘ shows a pointer cursor over the outlined item.
  const cursor = (on: boolean) => { doc.documentElement.style.cursor = on && live.current.editOn ? "pointer" : ""; };
  w.addEventListener("keydown", (e) => { if (e.key === "Control" || e.key === "Meta") cursor(true); });
  w.addEventListener("keyup", (e) => { if (e.key === "Control" || e.key === "Meta") cursor(false); });
  w.addEventListener("blur", () => cursor(false));
  let coarse = false;
  /** What's editable at a point: the text or picture there, else its page section. */
  const resolve = (x: number, y: number, target: EventTarget | null) => {
    const el = ((target as Element) || doc.elementFromPoint(x, y)) as Element;
    if (!el || !el.closest || el.closest("#cms-edit-ui")) return null;
    const ownText = (e: Element) => [...e.childNodes].some((t) => t.nodeType === 3 && (t.textContent || "").trim());
    // Layout size, so hover zooms (a card photo scaling up) don't change which is smaller.
    const area = (e: Element) => { const h = e as HTMLElement; if (h.offsetWidth !== undefined) return h.offsetWidth * h.offsetHeight; const r = e.getBoundingClientRect(); return r.width * r.height; };
    const inside = (e: Element) => { const r = e.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom && r.width > 4 && r.height > 4; };
    // Inside a part that names its field (the hero graphic, whose terminal or chart repeats your words), that field.
    const named = el.closest("[data-edit]");
    if (named && ownText(el)) { const dp = named.getAttribute("data-edit") || "", dl = locateField(live.current.tpl.schema, dp, live.current.content); if (dl) return { el: named, path: dp, label: dl.trail.join(" → ") }; }
    // Text (or a picture) right under the pointer: that's it.
    const direct = ownText(el) || el.tagName === "IMG" ? find(el) : null;
    if (direct && direct.path) return direct;
    // A blank or decorative spot: compare what's there — pictures (also under layers that ignore the pointer),
    // text that lets the pointer through (big animated names), and parts that name their field — smallest wins.
    const L = live.current, cands: NonNullable<ReturnType<typeof find>>[] = [];
    const up = find(el);
    if (up && up.path) cands.push(up);
    for (const im of Array.from(doc.images)) {
      if (!inside(im)) continue;
      const path = matchImage(L.idx, im.getAttribute("src") || "", L.assets);
      const loc = path && locateField(L.tpl.schema, path, L.content);
      if (loc) cands.push({ el: im, path: path!, label: loc.trail.join(" → ") });
    }
    const scope = (el.closest("section, header, footer, main") || doc.body) as Element;
    let best: Element | null = null;
    for (const c of Array.from(scope.querySelectorAll("*"))) if (!c.closest("#cms-edit-ui") && ownText(c) && inside(c) && (!best || area(c) < area(best))) best = c;
    const byPos = best && find(best);
    if (byPos && byPos.path) cands.push(byPos);
    // Same size (a photo filling its card): the picture wins, as the card's text can be pointed at directly.
    const score = (h: NonNullable<ReturnType<typeof find>>) => area(h.el) * (h.el.tagName === "IMG" ? 0.98 : 1);
    if (cands.length) return cands.sort((a, b) => score(a) - score(b))[0];
    return up; // only the page section
  };
  const at = (x: number, y: number, target: EventTarget | null) => {
    if (!live.current.editOn) return hide();
    const hit = resolve(x, y, target);
    if (!hit) return hide();
    if (cur && cur.el === hit.el) return;
    show(hit);
  };
  doc.addEventListener("pointermove", (e) => { if (e.pointerType === "touch") return; coarse = false; cursor(e.ctrlKey || e.metaKey); cancelAnimationFrame(raf); raf = requestAnimationFrame(() => at(e.clientX, e.clientY, e.target)); }, { passive: true });
  // Ctrl+click / ⌘+click: open the field instead of following a link or button.
  const editClick = (e: MouseEvent) => {
    if (!live.current.editOn || !(e.ctrlKey || e.metaKey) || e.button !== 0 && e.type === "click") return false;
    const hit = resolve(e.clientX, e.clientY, e.target);
    if (!hit) return false;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    go(hit); hide();
    return true;
  };
  doc.addEventListener("click", editClick, true);
  // On a Mac, Ctrl+click is a right-click: treat it the same way.
  doc.addEventListener("contextmenu", (e) => { if (e.ctrlKey) editClick(e); }, true);
  doc.addEventListener("auxclick", (e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); } }, true);
  // Touch: a tap outlines; press and hold (half a second, without moving) opens the field.
  let hold = 0, sx = 0, sy = 0, held = false;
  doc.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "touch" || !live.current.editOn) return;
    coarse = true; held = false; sx = e.clientX; sy = e.clientY; at(e.clientX, e.clientY, e.target);
    clearTimeout(hold);
    hold = w.setTimeout(() => { const hit = resolve(sx, sy, e.target); if (hit) { held = true; go(hit); hide(); } }, 550);
  }, { passive: true });
  doc.addEventListener("pointermove", (e) => { if (e.pointerType === "touch" && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) clearTimeout(hold); }, { passive: true });
  doc.addEventListener("pointerup", () => clearTimeout(hold), { passive: true });
  doc.addEventListener("pointercancel", () => clearTimeout(hold), { passive: true });
  // After a hold, don't also follow the link under the finger or open the long-press menu.
  doc.addEventListener("click", (e) => { if (held) { e.preventDefault(); e.stopPropagation(); held = false; } }, true);
  doc.addEventListener("contextmenu", (e) => { if (coarse && live.current.editOn) e.preventDefault(); }, true);
  doc.documentElement.addEventListener("mouseleave", () => hide());
  doc.addEventListener("scroll", () => { if (cur) { const c = cur as any; cur = null; show(c); } }, { passive: true, capture: true });
}
