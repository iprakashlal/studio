import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { TemplateDef } from "../schema/types";
import { Ctx, FieldView, openListItem, type EditorCtx } from "./fields";
import { locateField } from "./locate";
import { applyMenu, type MenuCfg } from "../lib/menus";

/** Click-to-edit: the preview asks the editor to show a field ({ path }) or a whole section ({ cat }). */
export const GOTO_EVENT = "studio:goto";

export type ExtraPanel = { id: string; label: string; group: string; desc: string; render: () => ReactNode };

/** Category navigation + the cards of the selected category. Mutates `draft` and calls `onChange`. */
export function Editor({ tpl, draft, version, onChange, upload, img, extras = [], onCategory, site = false, menu }: {
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
  /** Renamed, reordered, regrouped or combined sections (Settings → Admin menus). */
  menu?: MenuCfg;
}) {
  tpl.prepare?.(draft);
  const [cat, setCat] = useState(tpl.schema[0].id);
  const shown = tpl.schema.filter((c) => !c.showIf || c.showIf(draft));
  const nav = applyMenu(shown, extras, menu);
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
  const ctx = useMemo<EditorCtx>(() => ({ tpl, root: draft, bump: onChange, upload, img, site }), [tpl, draft, onChange, upload, img, version, site]);
  const entry = entryOf(cat) || nav[0];
  const curId = entry?.id;
  const extra = entry?.extra ? extras.find((e) => e.id === entry.id) : undefined;

  return (
    <Ctx.Provider value={ctx}>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <nav aria-label="Content categories" className="scroll-thin flex flex-none gap-1 overflow-x-auto border-b border-ink-700 bg-ink-900 p-2 md:w-52 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r md:p-3">
          {groups.map((g) => { const shut = folded.includes(g.group); return (
            <div key={g.group} className="flex gap-1 md:flex-col">
              <button type="button" onClick={() => foldGroup(g.group)} aria-expanded={!shut} className="hidden items-center px-2.5 pb-1 pt-3 text-left text-[10.5px] font-bold uppercase tracking-widest text-ink-500 hover:text-ink-300 md:flex">
                <span className="flex-1">{g.group}</span><span aria-hidden className={`inline-block text-[9px] transition-transform ${shut ? "-rotate-90" : ""}`}>▾</span>
              </button>
              {g.items.filter((it) => !shut || curId === it.id).map((it) => (
                <button key={it.id} type="button" onClick={() => setCat(it.id)} aria-current={curId === it.id ? "page" : undefined}
                  className={`flex-none whitespace-nowrap rounded-lg px-2.5 py-2 text-left text-[13.5px] font-semibold transition md:w-full ${curId === it.id ? "bg-brand-500/15 text-ink-100" : "text-ink-400 hover:bg-ink-800 hover:text-ink-100"}`}>
                  {it.label}
                </button>
              ))}
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
