import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { TemplateDef } from "../schema/types";
import { Ctx, FieldView, openListItem, type EditorCtx } from "./fields";
import { locateField } from "./locate";

/** Click-to-edit: the preview asks the editor to show a field ({ path }) or a whole section ({ cat }). */
export const GOTO_EVENT = "studio:goto";

export type ExtraPanel = { id: string; label: string; group: string; desc: string; render: () => ReactNode };

/** Category navigation + the cards of the selected category. Mutates `draft` and calls `onChange`. */
export function Editor({ tpl, draft, version, onChange, upload, img, extras = [], onCategory, site = false }: {
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
}) {
  tpl.prepare?.(draft);
  const [cat, setCat] = useState(tpl.schema[0].id);
  const shown = tpl.schema.filter((c) => !c.showIf || c.showIf(draft));
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
        if (loc.cat !== cat) { setCat(loc.cat); onCategory?.(loc.cat); } else onChange();
      } else if (d.cat && shown.some((c) => c.id === d.cat)) { setCat(d.cat); scroller.current?.scrollTo({ top: 0, behavior: "smooth" }); }
    };
    addEventListener(GOTO_EVENT, on);
    return () => removeEventListener(GOTO_EVENT, on);
  }, [tpl, draft, cat, shown.map((c) => c.id).join()]);
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
  const groups = useMemo(() => {
    const items = [...shown.map((c) => ({ id: c.id, label: c.label, group: c.group })), ...extras.map((e) => ({ id: e.id, label: e.label, group: e.group }))];
    const out: { group: string; items: typeof items }[] = [];
    for (const it of items) {
      let g = out.find((x) => x.group === it.group);
      if (!g) out.push((g = { group: it.group, items: [] }));
      g.items.push(it);
    }
    return out;
  }, [tpl, extras, shown.map((c) => c.id).join()]);
  const ctx = useMemo<EditorCtx>(() => ({ tpl, root: draft, bump: onChange, upload, img, site }), [tpl, draft, onChange, upload, img, version, site]);
  const extra = extras.find((e) => e.id === cat);
  const current = extra ? undefined : shown.find((c) => c.id === cat) || shown[0];

  return (
    <Ctx.Provider value={ctx}>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <nav aria-label="Content categories" className="scroll-thin flex flex-none gap-1 overflow-x-auto border-b border-ink-700 bg-ink-900 p-2 md:w-52 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r md:p-3">
          {groups.map((g) => (
            <div key={g.group} className="flex gap-1 md:flex-col">
              <div className="hidden px-2.5 pb-1 pt-3 text-[10.5px] font-bold uppercase tracking-widest text-ink-500 md:block">{g.group}</div>
              {g.items.map((it) => (
                <button key={it.id} type="button" onClick={() => setCat(it.id)} aria-current={cat === it.id ? "page" : undefined}
                  className={`flex-none whitespace-nowrap rounded-lg px-2.5 py-2 text-left text-[13.5px] font-semibold transition md:w-full ${cat === it.id ? "bg-brand-500/15 text-ink-100" : "text-ink-400 hover:bg-ink-800 hover:text-ink-100"}`}>
                  {it.label}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div ref={scroller} className="scroll-thin min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-5 sm:px-6">
            <div>
              <h2 className="text-lg font-extrabold">{current?.label || extra?.label}</h2>
              <p className="mt-1 text-sm text-ink-400">{current?.desc || extra?.desc}</p>
            </div>
            {current?.cards.filter((card) => !(site && card.studio)).map((card) => (
              <section key={card.title} className="card flex flex-col gap-4 p-4 sm:p-5">
                <h3 className="text-[15px] font-extrabold">{card.title}</h3>
                {card.fields.map((f, i) => <FieldView key={i} f={f} obj={draft} base={cat} />)}
              </section>
            ))}
            {extra?.render()}
          </div>
        </div>
      </div>
    </Ctx.Provider>
  );
}
