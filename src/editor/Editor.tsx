import { MENU_LAYOUTS, applyLayout } from "./menuLayout";
import { pushPref } from "../lib/prefs";
import { tourSections } from "../ui/Tour";
import { useEffect, useMemo, useRef, useState, type ReactNode, Fragment } from "react";
import type { TemplateDef } from "../schema/types";
import { Ctx, FieldView, openListItem, type EditorCtx } from "./fields";
import { locateField } from "./locate";
import { NavDrawer } from "./NavDrawer";
import { studioHidden } from "../lib/features";
import { applyMenu, type MenuCfg } from "../lib/menus";

/** Click-to-edit: the preview asks the editor to show a field ({ path }) or a whole section ({ cat }). */
export const GOTO_EVENT = "studio:goto";

export type ExtraPanel = { id: string; label: string; group: string; desc: string; render: () => ReactNode };

/** Category navigation + the cards of the selected category. Mutates `draft` and calls `onChange`. */
export function Editor({ tpl, draft, version, onChange, upload, img, extras = [], onCategory, site = false, menu, cf }: {
  tpl: TemplateDef;
  draft: any;
  version: number;
  onChange: () => void;
  upload: EditorCtx["upload"];
  img: EditorCtx["img"];
  extras?: ExtraPanel[];
  onCategory?: (id: string) => void;
  /** In the site's own admin page: hides Studio-only settings and limits themes to those the Studio allows. */
  site?: boolean;
  /** Renamed, reordered, regrouped or combined sections (Settings → Customize → Admin menus). */
  menu?: MenuCfg;
  /** The site's own Cloudflare database, when it is hosted on one. */
  cf?: EditorCtx["cf"];
}) {
  tpl.prepare?.(draft);
  const [cat, setCat] = useState(tpl.schema[0].id);
  // The site's own admin page leaves out the sections its Studio unticked for this site (content.cms.hide).
  const cmsHide: string[] = site && Array.isArray(draft?.cms?.hide) ? draft.cms.hide : [];
  const cmsAllow: string[] = Array.isArray(draft?.cms?.allow) ? draft.cms.allow : [];
  // A client Studio whose partner switched the festival overlay off doesn't show it at all.
  const noFestival = !site && studioHidden().has("festival");
  const shown = tpl.schema.filter((c) => (!c.showIf || c.showIf(draft)) && !cmsHide.includes(c.id) && !(site && c.siteIf && !cmsAllow.includes(c.siteIf)) && !(c.id === "festival" && noFestival)).map((c) => (site && c.site ? { ...c, label: c.site.label || c.label, group: c.site.group || c.group } : c));
  const nav0 = applyMenu(shown, extras.filter((e) => !cmsHide.includes(e.id)), menu);
  const byOwnerDay = !menu?.items?.length ? MENU_LAYOUTS[tpl.id] : undefined;
  const nav = byOwnerDay ? applyLayout(byOwnerDay, nav0) : nav0;
  /** The menu entry showing a section (itself, or the one it was combined into). */
  const entryOf = (id: string) => nav.find((e) => e.from.includes(id));
  const scroller = useRef<HTMLDivElement>(null);
  const [focus, setFocus] = useState<{ id: string; n: number } | null>(null);
  useEffect(() => {
    if (focus) return; // a jump scrolls to its field instead
    scroller.current?.scrollTo(0, 0);
    onCategory?.(cat);
  }, [cat]);
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent).detail || {};
      if (d.path) {
        const loc = locateField(tpl.schema, d.path, draft);
        if (!loc) return;
        loc.open.forEach(openListItem);
        setFocus({ id: loc.domId || "", n: Date.now() });
        const to = entryOf(loc.cat)?.id || loc.cat;
        if (to !== curId) { setCat(to); onCategory?.(to); } else onChange();
      } else if (d.cat && entryOf(d.cat)) { setCat(entryOf(d.cat)!.id); scroller.current?.scrollTo({ top: 0, behavior: "smooth" }); }
    };
    addEventListener(GOTO_EVENT, on);
    return () => removeEventListener(GOTO_EVENT, on);
  }, [tpl, draft, cat, nav.map((c) => c.id + ":" + c.from.join("+")).join()]);
  useEffect(() => {
    if (!focus) return;
    const t = setTimeout(() => {
      let el = focus.id ? document.getElementById(focus.id) : null;
      // File inputs are hidden: use their label (the Upload button) and the field around it.
      if (el && !el.offsetParent) el = document.querySelector<HTMLElement>(`label[for="${focus.id}"]`) || el.parentElement;
      const box = (el?.closest(".field, [data-field]") as HTMLElement | null) || el?.parentElement || el;
      if (box) {
        box.scrollIntoView({ block: "center", behavior: "smooth" });
        box.classList.remove("jump-flash"); void box.offsetWidth; box.classList.add("jump-flash");
        setTimeout(() => box.classList.remove("jump-flash"), 1800);
      }
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && el.offsetParent) (el as HTMLInputElement).focus({ preventScroll: true });
      setFocus(null);
    }, 80);
    return () => clearTimeout(t);
  }, [focus]);
  // Menu headings fold their sections away (the open section stays visible); remembered in this browser.
  const [folded, setFolded] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem("studio-menu-fold") || "[]"); } catch { return []; } });
  const foldGroup = (g: string) => setFolded((f) => { const n = f.includes(g) ? f.filter((x) => x !== g) : [...f, g]; try { localStorage.setItem("studio-menu-fold", JSON.stringify(n)); } catch { /* private mode */ } pushPref({ nav: { fold: n } }); return n; });
  const groups: { group: string; items: typeof nav }[] = [];
  for (const it of nav) {
    let g = groups.find((x) => x.group === it.group);
    if (!g) groups.push((g = { group: it.group, items: [] }));
    g.items.push(it);
  }
  // The usual order of the headings (a custom admin menu keeps its own order).
  if (!menu?.items?.length) {
    const ORDER = byOwnerDay ? byOwnerDay.groups : ["Design", "Pages", "Catalogue", "Selling", "Shop", "Forms & records", "Features", "Settings", "Project"];
    const at = (g: string) => { const i = ORDER.indexOf(g); return i < 0 ? ORDER.length : i; };
    groups.sort((a, b) => at(a.group) - at(b.group));
  }
  const ctx = useMemo<EditorCtx>(() => ({ tpl, root: draft, bump: onChange, upload, img, site, cf }), [tpl, draft, onChange, upload, img, version, site, cf?.api, cf?.site]);
  // Search the menu: section names, what each is for, card titles and the labels of the settings inside.
  const [q, setQ] = useState("");
  const index = useMemo(() => {
    const rows: { id: string; label: string; group: string; where: string; text: string; path?: string }[] = [];
    const walk = (fields: any[], add: (label: string, path?: string) => void, top = true) => { for (const f of fields || []) {
      if (!f) continue;
      if (f.t === "grid" || f.t === "when") walk(f.fields, add, top);
      else if (f.t === "list") { if (f.label) add(f.label, top ? f.path : undefined); walk(f.item, (l) => add(l, top ? f.path : undefined), false); }
      else if (f.t === "note") continue;
      else if (f.label) add(f.label, top ? f.path : undefined);
    } };
    for (const e of nav) {
      rows.push({ id: e.id, label: e.label, group: e.group, where: "", text: (e.label + " " + ((e as any).desc || "")).toLowerCase() });
      for (const cid of e.from) { const c = shown.find((x) => x.id === cid); if (!c) continue;
        if (c.desc) rows.push({ id: e.id, label: e.label, group: e.group, where: "", text: c.desc.toLowerCase() });
        for (const card of c.cards) { rows.push({ id: e.id, label: e.label, group: e.group, where: card.title, text: card.title.toLowerCase() }); walk(card.fields, (l, path) => rows.push({ id: e.id, label: e.label, group: e.group, where: `${card.title} → ${l}`, text: l.toLowerCase(), path })); } }
      const x = extras.find((y) => y.id === e.id); if (x?.desc) rows.push({ id: e.id, label: e.label, group: e.group, where: "", text: x.desc.toLowerCase() });
    }
    return rows;
  }, [tpl, nav.map((c) => c.id + ":" + c.label).join(), site]);
  const found = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean); if (!words.length) return null;
    const out: typeof index = [], seen = new Set<string>();
    // A section's own name first, then the settings inside sections.
    for (const pass of [0, 1]) for (const r of index) { if ((pass === 0) !== !r.where) continue; if (!words.every((w) => r.text.includes(w))) continue; const k = r.id + "|" + r.where; if (seen.has(k) || (pass === 0 && seen.has(r.id + "|"))) continue; seen.add(k); out.push(r); if (out.length >= 14) return out; }
    return out;
  }, [q, index]);
  // On a phone the menu is a full-screen list opened from one bar (the section's name, with previous and next beside it).
  const [sheet, setSheet] = useState(false), navRef = useRef<HTMLElement>(null);
  // On a computer the menu is a drawer: a row with an icon for each main group, which opens a list beside it. It can be
  // narrow (icons only) or wide, or swapped for the full list; both choices are remembered on this device.
  const pref = (k: string, d: string) => { try { return localStorage.getItem(k) || d; } catch { return d; } }, keep = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private window */ } };
  const [navView, setNavView] = useState(() => pref("studio-nav", "drawer")), [wide, setWide] = useState(() => pref("studio-nav-wide", "1") === "1"), [landed, setLanded] = useState(0);
  const drawer = navView !== "list";
  const drawerPick = (id: string) => { setQ(""); setCat(id); onCategory?.(id); scroller.current?.scrollTo({ top: 0 }); setLanded(Date.now()); };
  useEffect(() => {
    if (!sheet) return;
    const cur = navRef.current?.querySelector<HTMLElement>('[aria-current="page"]'); cur?.scrollIntoView({ block: "center" });
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setSheet(false); }; addEventListener("keydown", esc); return () => removeEventListener("keydown", esc);
  }, [sheet]);
  const pick = (r: { id: string; path?: string }) => { setQ(""); setSheet(false); if (r.path) dispatchEvent(new CustomEvent(GOTO_EVENT, { detail: { path: r.path } })); else { setCat(r.id); onCategory?.(r.id); } };
  // The site admin's quick tour walks through these sections, opening each one and saying what it is for.
  if (site) tourSections.list = nav.map((n: any) => ({ id: n.id, label: n.label, group: n.group, desc: String(n.desc || ""), cards: (n.cards || []).map((c: any) => String(c?.card?.title || "")).filter(Boolean) }));
  const entry = entryOf(cat) || nav[0];
  const curId = entry?.id;
  const extra = entry?.extra ? extras.find((e) => e.id === entry.id) : undefined;
  const flat = groups.flatMap((g) => g.items), at = flat.findIndex((x) => x.id === curId), step = (d: number) => { const n = flat[at + d]; if (n) { setCat(n.id); onCategory?.(n.id); } };

  return (
    <Ctx.Provider value={ctx}>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="flex flex-none items-center gap-1.5 border-b border-ink-700 bg-ink-900 p-2 md:hidden" aria-label="Section">
          <button type="button" className="btn btn-sm flex-none px-3 text-base" aria-label="Previous section" disabled={at <= 0} onClick={() => step(-1)}>‹</button>
          <button type="button" onClick={() => setSheet(true)} aria-haspopup="dialog" aria-expanded={sheet} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-ink-600 bg-ink-950 px-3 py-1.5 text-left">
            <span className="min-w-0 flex-1"><span className="block truncate text-[10.5px] font-bold uppercase tracking-widest text-ink-500">{[entry?.group, entry?.sub].filter(Boolean).join(" · ")}{at >= 0 ? ` · ${at + 1} of ${flat.length}` : ""}</span><span className="block truncate text-[15px] font-extrabold text-ink-100">{entry?.label}</span></span>
            <span className="flex-none text-[12px] font-semibold text-ink-400">All <span aria-hidden>▾</span></span>
          </button>
          <button type="button" className="btn btn-sm flex-none px-3 text-base" aria-label="Next section" disabled={at < 0 || at >= flat.length - 1} onClick={() => step(1)}>›</button>
        </div>
        <nav ref={navRef} aria-label="Content categories" className={`scroll-thin ${sheet ? "fixed inset-0 z-[80] flex" : "hidden"} flex-none flex-col gap-1 overflow-y-auto bg-ink-900 p-3 md:static md:z-auto md:flex md:border-r md:border-ink-700 ${drawer && !wide ? "md:w-[64px] md:p-2" : "md:w-52"}`}>
          <div className="sticky -top-3 z-10 -mx-3 -mt-3 flex-none bg-ink-900 px-3 pb-1 pt-3">
            <div className="mb-2 flex items-center md:hidden"><b className="flex-1 text-base font-extrabold">All sections</b><button type="button" className="btn btn-sm" onClick={() => setSheet(false)}>Close</button></div>
            <label className="sr-only" htmlFor="menu-search">Search the settings</label>
            <input id="menu-search" type="search" className={`input w-full py-2 text-[15px] md:py-1.5 md:text-[13px] ${drawer && !wide ? "md:hidden" : ""}`} placeholder="Search settings" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") setQ(""); if (e.key === "Enter" && found?.length) pick(found[0]); }} />
          </div>
          {found && (
            <ul className="flex flex-col gap-1" aria-label="Search results">
              {found.map((r, i) => (
                <li key={i} className="flex-none"><button type="button" onClick={() => pick(r)} className="flex w-full flex-col rounded-lg px-2.5 py-2 text-left text-[13.5px] font-semibold text-ink-200 hover:bg-ink-800 hover:text-ink-100">
                  <span>{r.label}</span>{r.where ? <span className="whitespace-normal text-[11.5px] font-normal text-ink-400">{r.where}</span> : <span className="text-[11px] font-normal uppercase tracking-wide text-ink-500">{r.group}</span>}
                </button></li>
              ))}
              {!found.length && <li className="px-2.5 py-2 text-[13px] text-ink-400">Nothing matches “{q}”.</li>}
            </ul>
          )}
          {!found && drawer && <div className="hidden md:block"><NavDrawer groups={groups} cur={curId} wide={wide} onWide={(v) => { setWide(v); keep("studio-nav-wide", v ? "1" : "0"); pushPref({ nav: { wide: v } }); }} onPick={drawerPick} /></div>}
          {!found && groups.map((g) => { const shut = folded.includes(g.group); return (
            <div key={g.group} className={`flex flex-col gap-1 ${drawer ? "md:hidden" : ""}`}>
              <button type="button" onClick={() => foldGroup(g.group)} aria-expanded={!shut} className="flex items-center px-2.5 pb-1 pt-3 text-left text-[11.5px] font-bold uppercase tracking-widest text-ink-500 hover:text-ink-300 md:text-[10.5px]">
                <span className="flex-1">{g.group}</span><span aria-hidden className={`inline-block text-[9px] transition-transform ${shut ? "-rotate-90" : ""}`}>▾</span>
              </button>
              {g.items.filter((it) => !shut || curId === it.id).map((it, i, list) => {
                // A sub-heading ("Sections") folds its entries away too; the open one stays visible.
                const key = it.sub ? g.group + "/" + it.sub : "", subShut = !!key && folded.includes(key);
                const head = it.sub && !shut && (i === 0 || list[i - 1].sub !== it.sub);
                return (
                  <Fragment key={it.id}>
                    {head && (
                      <button type="button" onClick={() => foldGroup(key)} aria-expanded={!subShut} className="flex items-center rounded-lg px-2.5 py-2 text-left text-[14px] font-bold text-ink-300 hover:bg-ink-800 hover:text-ink-100 md:py-1.5 md:text-[12.5px]">
                        <span className="flex-1">{it.sub}</span><span className="mr-1.5 text-[11px] font-semibold text-ink-500">{list.filter((x) => x.sub === it.sub).length}</span><span aria-hidden className={`inline-block text-[9px] transition-transform ${subShut ? "-rotate-90" : ""}`}>▾</span>
                      </button>
                    )}
                    {(!subShut || curId === it.id) && (
                      <button type="button" onClick={() => { setCat(it.id); setSheet(false); }} aria-current={curId === it.id ? "page" : undefined}
                        className={`w-full flex-none rounded-lg px-2.5 py-2.5 text-left text-[15px] font-semibold transition md:whitespace-nowrap md:py-2 md:text-[13.5px] ${it.sub && !shut ? "ml-2.5 w-[calc(100%-10px)] rounded-l-none border-l border-ink-700 pl-3" : ""} ${curId === it.id ? "bg-brand-500/15 text-ink-100" : "text-ink-400 hover:bg-ink-800 hover:text-ink-100"}`}>
                        {it.label}
                      </button>
                    )}
                  </Fragment>
                );
              })}
            </div>
          ); })}
          {!found && !(drawer && !wide) && <button type="button" className="mt-auto hidden rounded-lg px-2.5 py-2 text-left text-[12px] font-semibold text-ink-500 hover:bg-ink-800 hover:text-ink-200 md:block" onClick={() => { const v = drawer ? "list" : "drawer"; setNavView(v); keep("studio-nav", v); pushPref({ nav: { view: v as "drawer" | "list" } }); }}>{drawer ? "Show the full list instead" : "Show as a drawer with icons"}</button>}
        </nav>
        <div ref={scroller} className="scroll-thin min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-5 sm:px-6">
            <div key={landed} data-tour="section-head" className={landed ? "hub-landed -mx-2 rounded-lg px-2 py-1" : undefined}>
              <h2 className="text-lg font-extrabold">{entry?.label}</h2>
              <p className="mt-1 text-sm text-ink-400">{entry?.desc}</p>
            </div>
            {!entry?.extra && entry?.cards.filter(({ card }) => !(site && card.studio)).map(({ card, cat: from }) => (
              <section key={from + ":" + card.title} className="card flex flex-col gap-4 p-4 sm:p-5">
                <h3 className="text-[15px] font-extrabold">{card.title}</h3>
                {card.fields.map((f, i) => <FieldView key={i} f={f} obj={draft} base={from} />)}
              </section>
            ))}
            {extra?.render()}
          </div>
        </div>
      </div>
    </Ctx.Provider>
  );
}
