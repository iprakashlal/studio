// Settings → Admin menus: rename, reorder, regroup and combine the sections of each template's editor.
// Applies to sites' admin pages (from their next publish or Push updates) and, if switched on, the Studio too.
import { useMemo, useState } from "react";
import { TEMPLATE_LIST, TEMPLATES } from "../schema";
import { applyMenu, cleanMenu, type MenuCfg, type MenuItem, type Menus } from "../lib/menus";
import type { Studio, StudioIndex } from "../lib/studio";
import { explain } from "../lib/repo";
import { useToast } from "../ui/kit";

/** Panels that aren't schema sections: they can be renamed, moved and regrouped, but not combined. */
const EXTRAS: Record<string, { id: string; label: string; group: string; desc: string; note?: string }[]> = {
  store: [
    { id: "shop-orders", label: "Orders", group: "Shop", desc: "", note: "admin page" },
    { id: "shop-customers", label: "Customers", group: "Shop", desc: "", note: "admin page" },
  ],
  business: [{ id: "enquiries", label: "Enquiries", group: "Content", desc: "" }],
  "*": [
    { id: "backup", label: "Backup & reset", group: "Settings", desc: "" },
    { id: "account", label: "Account", group: "Settings", desc: "", note: "admin page" },
  ],
};
const extrasFor = (t: string) => [...(EXTRAS[t] || []), ...EXTRAS["*"]];

export function MenusCard({ studio, menus, onIndex }: { studio: Studio; menus: Menus; onIndex: (i: StudioIndex) => void }) {
  const [tid, setTid] = useState(TEMPLATE_LIST[0].id);
  return (
    <section className="card flex flex-col gap-4 p-5" aria-label="Admin menus">
      <h3 className="text-[15px] font-extrabold">Admin menus</h3>
      <p className="text-sm text-ink-300">Rename the sections in the editor's menu, change their order and headings, or combine sections into one page. Set it per site type. Sites' admin pages use it from their next publish or <b className="text-ink-100">Push updates to live sites</b>; the Studio's own editor too if you switch that on.</p>
      <div className="flex flex-wrap rounded-lg border border-ink-600 self-start" role="tablist" aria-label="Site type">
        {TEMPLATE_LIST.map((t) => <button key={t.id} type="button" role="tab" aria-selected={tid === t.id} onClick={() => setTid(t.id)} className={`btn btn-sm border-0 ${tid === t.id ? "bg-ink-700" : "bg-transparent"}`}>{t.name}{menus[t.id] ? " •" : ""}</button>)}
      </div>
      <MenuEditor key={tid + JSON.stringify(menus[tid] || null)} tid={tid} saved={menus[tid]} studio={studio} onIndex={onIndex} />
    </section>
  );
}

function MenuEditor({ tid, saved, studio, onIndex }: { tid: string; saved?: MenuCfg; studio: Studio; onIndex: (i: StudioIndex) => void }) {
  const toast = useToast();
  const tpl = TEMPLATES[tid], extras = extrasFor(tid);
  const defaults = useMemo(() => [...tpl.schema.map((c) => ({ id: c.id, label: c.label, group: c.group, extra: false, note: c.showIf ? "shown only in some setups" : "" })), ...extras.map((e) => ({ id: e.id, label: e.label, group: e.group, extra: true, note: e.note || "" }))], [tid]);
  const def = (id: string) => defaults.find((d) => d.id === id)!;
  // Every section in the current order, with its overrides.
  const start = (): MenuItem[] => {
    const order = applyMenu(tpl.schema, extras, saved ? { items: saved.items.map(({ into, ...x }) => x) } : undefined).map((e) => e.id);
    const conf = new Map((saved?.items || []).map((x) => [x.id, x]));
    return order.map((id) => ({ id, label: conf.get(id)?.label || "", group: conf.get(id)?.group || "", into: conf.get(id)?.into || "" }));
  };
  const [items, setItems] = useState<MenuItem[]>(start);
  const [studioToo, setStudioToo] = useState(!!saved?.studio);
  const [busy, setBusy] = useState(false);
  const cfg: MenuCfg = { items: items.map((x) => ({ id: x.id, ...(x.label?.trim() ? { label: x.label.trim() } : {}), ...(x.group?.trim() ? { group: x.group.trim() } : {}), ...(x.into ? { into: x.into } : {}) })), ...(studioToo ? { studio: true } : {}) };
  const isDefault = cfg.items.every((x, i) => x.id === defaults[i]?.id && !x.label && !x.group && !x.into) && !studioToo;
  const dirty = JSON.stringify(cleanMenu(cfg)) !== JSON.stringify(cleanMenu(saved || { items: defaults.map((d) => ({ id: d.id })) }));
  const groups = [...new Set([...defaults.map((d) => d.group), ...items.map((x) => x.group || "").filter(Boolean)])];
  const set = (i: number, o: Partial<MenuItem>) => setItems((l) => l.map((x, j) => (j === i ? { ...x, ...o } : x)));
  const move = (i: number, d: number) => setItems((l) => { const n = [...l], j = i + d; if (j < 0 || j >= n.length) return l; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const result = applyMenu(tpl.schema, extras, cfg);
  const resultGroups = result.reduce<{ g: string; items: typeof result }[]>((a, e) => { let g = a.find((x) => x.g === e.group); if (!g) a.push((g = { g: e.group, items: [] })); g.items.push(e); return a; }, []);

  const save = async (reset = false) => {
    setBusy(true);
    try { onIndex(await studio.saveMenu(tid, reset || isDefault ? null : cfg)); toast(reset ? "Back to the template's menu." : "Saved. Publish a site or use Push updates to live sites to use it there."); }
    catch (e) { toast(explain(e), "bad"); }
    setBusy(false);
  };

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_168px]">
      <div className="flex flex-col gap-2">
        <datalist id={`mg-${tid}`}>{groups.map((g) => <option key={g} value={g} />)}</datalist>
        <div className="grid grid-cols-[auto_minmax(0,1fr)_92px_124px] gap-1.5 px-2 text-[10.5px] font-bold uppercase tracking-widest text-ink-500"><span className="w-4" /><span>Name</span><span>Heading</span><span>Page</span></div>
        <ol className="flex flex-col gap-1" aria-label={`${tpl.name} sections`}>
          {items.map((x, i) => {
            const d = def(x.id), into = x.into ? items.find((y) => y.id === x.into) : null;
            return (
              <li key={x.id} className={`grid grid-cols-[auto_minmax(0,1fr)_92px_124px] items-center gap-1.5 rounded-lg border px-2 py-1.5 ${x.into ? "border-ink-700 bg-ink-950/50" : "border-ink-600 bg-ink-950"}`}>
                <span className="flex flex-col">
                  <button type="button" className="px-1 text-xs leading-none text-ink-400 hover:text-ink-100 disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${d.label} up`}>▲</button>
                  <button type="button" className="px-1 text-xs leading-none text-ink-400 hover:text-ink-100 disabled:opacity-30" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${d.label} down`}>▼</button>
                </span>
                <input className="input min-w-0 px-2 py-1 text-[13px]" aria-label={`Name for ${d.label}`} placeholder={d.label} value={x.label || ""} maxLength={40} onChange={(e) => set(i, { label: e.target.value })} />
                <input className="input min-w-0 px-2 py-1 text-[13px]" title="Menu heading" aria-label={`Heading for ${d.label}`} placeholder={d.group} list={`mg-${tid}`} value={x.group || ""} maxLength={30} disabled={!!x.into} onChange={(e) => set(i, { group: e.target.value })} />
                {d.extra ? <span className="px-1 text-[11.5px] text-ink-500">{d.note ? `Panel · ${d.note}` : "Panel"}</span> : (
                  <select className="input min-w-0 px-1.5 py-1 text-[13px]" aria-label={`Combine ${d.label} into`} value={x.into || ""} onChange={(e) => set(i, { into: e.target.value })}>
                    <option value="">Own page</option>
                    {items.filter((y) => y.id !== x.id && !def(y.id).extra && !y.into).map((y) => <option key={y.id} value={y.id}>→ Into {y.label?.trim() || def(y.id).label}</option>)}
                  </select>
                )}
                {(x.label || into || d.note) && <span className="col-span-4 pl-6 text-[11.5px] text-ink-500">{x.label ? `Was “${d.label}”. ` : ""}{into ? `Its cards show at the end of “${into.label?.trim() || def(into.id).label}”. ` : ""}{!d.extra && d.note ? `(${d.note})` : ""}</span>}
              </li>
            );
          })}
        </ol>
        <label className="mt-1 flex items-center gap-2 text-sm"><input type="checkbox" className="accent-brand-400" checked={studioToo} onChange={(e) => setStudioToo(e.target.checked)} /> Also use this menu in the Studio's editor for {tpl.name} projects</label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-pri" disabled={busy || !dirty} onClick={() => save()}>{busy ? "Saving…" : "Save menu"}</button>
          <button type="button" className="btn" disabled={busy || !saved} onClick={() => save(true)}>Reset to the template's menu</button>
        </div>
      </div>
      <aside className="rounded-xl border border-ink-700 bg-ink-900 p-3" aria-label="Menu preview">
        <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-ink-500">Preview</p>
        {resultGroups.map((g) => (
          <div key={g.g} className="mb-1">
            <div className="px-1 pb-0.5 pt-2 text-[10px] font-bold uppercase tracking-widest text-ink-500">{g.g}</div>
            {g.items.map((e) => <div key={e.id} className="rounded px-1 py-1 text-[12.5px] font-semibold text-ink-200">{e.label}{e.from.length > 1 && <span className="ml-1 text-[11px] font-normal text-ink-500">+{e.from.length - 1}</span>}</div>)}
          </div>
        ))}
      </aside>
    </div>
  );
}
