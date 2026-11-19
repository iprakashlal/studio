import { useEffect, useMemo, useRef, useState, type ReactNode, Fragment } from "react";
import type { TemplateDef } from "../schema/types";
import { Ctx, FieldView, openListItem, type EditorCtx } from "./fields";
import { locateField } from "./locate";
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
  const nav = applyMenu(shown, extras.filter((e) => !cmsHide.includes(e.id)), menu);
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
  const foldGroup = (g: string) => setFolded((f) => { const n = f.includes(g) ? f.filter((x) => x !== g) : [...f, g]; try { localStorage.setItem("studio-menu-fold", JSON.stringify(n)); } catch { /* private mode */ } return n; });
  const groups: { group: string; items: typeof nav }[] = [];
  for (const it of nav) {
    let g = groups.find((x) => x.group === it.group);
    if (!g) groups.push((g = { group: it.group, items: [] }));
    g.items.push(it);
  }
  // The usual order of the headings (a custom admin menu keeps its own order).
  if (!menu?.items?.length) {
    const ORDER = ["Design", "Pages", "Catalogue", "Selling", "Shop", "Forms & records", "Features", "Settings", "Project"];
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
  const pick = (r: { id: string; path?: string }) => { setQ(""); if (r.path) dispatchEvent(new CustomEvent(GOTO_EVENT, { detail: { path: r.path } })); else { setCat(r.id); onCategory?.(r.id); } };
  const entry = entryOf(cat) || nav[0];
  const curId = entry?.id;
  const extra = entry?.extra ? extras.find((e) => e.id === entry.id) : undefined;

  return (
    <Ctx.Provider value={ctx}>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <nav aria-label="Content categories" className="scroll-thin flex flex-none gap-1 overflow-x-auto border-b border-ink-700 bg-ink-900 p-2 md:w-52 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r md:p-3">
          <div className="flex-none md:sticky md:-top-3 md:z-10 md:-mx-3 md:-mt-3 md:bg-ink-900 md:px-3 md:pb-1 md:pt-3">
            <label className="sr-only" htmlFor="menu-search">Search the settings</label>
            <input id="menu-search" type="search" className="input w-40 py-1.5 text-[13px] md:w-full" placeholder="Search settings" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") setQ(""); if (e.key === "Enter" && found?.length) pick(found[0]); }} />
          </div>
          {found && (
            <ul className="flex gap-1 md:flex-col" aria-label="Search results">
              {found.map((r, i) => (
                <li key={i} className="flex-none"><button type="button" onClick={() => pick(r)} className="flex w-full flex-col rounded-lg px-2.5 py-2 text-left text-[13.5px] font-semibold text-ink-200 hover:bg-ink-800 hover:text-ink-100">
                  <span>{r.label}</span>{r.where ? <span className="whitespace-normal text-[11.5px] font-normal text-ink-400">{r.where}</span> : <span className="text-[11px] font-normal uppercase tracking-wide text-ink-500">{r.group}</span>}
                </button></li>
              ))}
              {!found.length && <li className="px-2.5 py-2 text-[13px] text-ink-400">Nothing matches “{q}”.</li>}
            </ul>
          )}
          {!found && groups.map((g) => { const shut = folded.includes(g.group); return (
            <div key={g.group} className="flex gap-1 md:flex-col">
              <button type="button" onClick={() => foldGroup(g.group)} aria-expanded={!shut} className="hidden items-center px-2.5 pb-1 pt-3 text-left text-[10.5px] font-bold uppercase tracking-widest text-ink-500 hover:text-ink-300 md:flex">
                <span className="flex-1">{g.group}</span><span aria-hidden className={`inline-block text-[9px] transition-transform ${shut ? "-rotate-90" : ""}`}>▾</span>
              </button>
              {g.items.filter((it) => !shut || curId === it.id).map((it, i, list) => {
                // A sub-heading ("Sections") folds its entries away too; the open one stays visible.
                const key = it.sub ? g.group + "/" + it.sub : "", subShut = !!key && folded.includes(key);
                const head = it.sub && !shut && (i === 0 || list[i - 1].sub !== it.sub);
                return (
                  <Fragment key={it.id}>
                    {head && (
                      <button type="button" onClick={() => foldGroup(key)} aria-expanded={!subShut} className="hidden items-center rounded-lg px-2.5 py-1.5 text-left text-[12.5px] font-bold text-ink-300 hover:bg-ink-800 hover:text-ink-100 md:flex">
                        <span className="flex-1">{it.sub}</span><span className="mr-1.5 text-[11px] font-semibold text-ink-500">{list.filter((x) => x.sub === it.sub).length}</span><span aria-hidden className={`inline-block text-[9px] transition-transform ${subShut ? "-rotate-90" : ""}`}>▾</span>
                      </button>
                    )}
                    {(!subShut || curId === it.id) && (
                      <button type="button" onClick={() => setCat(it.id)} aria-current={curId === it.id ? "page" : undefined}
                        className={`flex-none whitespace-nowrap rounded-lg px-2.5 py-2 text-left text-[13.5px] font-semibold transition md:w-full ${it.sub && !shut ? "md:ml-2.5 md:w-[calc(100%-10px)] md:border-l md:border-ink-700 md:rounded-l-none md:pl-3" : ""} ${curId === it.id ? "bg-brand-500/15 text-ink-100" : "text-ink-400 hover:bg-ink-800 hover:text-ink-100"}`}>
                        {it.label}
                      </button>
                    )}
                  </Fragment>
                );
              })}
            </div>
          ); })}
        </nav>
        <div ref={scroller} className="scroll-thin min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-5 sm:px-6">
            <div>
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
