import { useState } from "react";
import { useBrand } from "../lib/brand";
import { COLOUR_SLOTS, KINDS, LOOK_AXES, type ColourSet, type Kind, type LookRule } from "../lib/designlook";
import { pushPref } from "../lib/prefs";
import { readDesignSettings, writeDesignSettings, type DesignSettings } from "../lib/designs";
import { Toggle } from "../ui/kit";

/** Settings → General: the "Design yourself" page (a link on the Themes page): on or off. */
export function DesignPageCard() {
  return <div className="flex flex-col gap-4"><DesignOnCard /><DesignLookCard /></div>;
}

const KIND_NAME: Record<Kind, string> = { business: "Business", restaurant: "Restaurant", portfolio: "Portfolio", store: "Shop" };
const DARK: Record<string, string> = { bg: "#0e1118", surface: "#161b26", text: "#f2f4f8", soft: "#9aa3b5", line: "#262d3c", deep: "#090b10" };
const LIGHT: Record<string, string> = { bg: "#f7f8fa", surface: "#ffffff", text: "#0e1b2c", soft: "#5a6678", line: "#dde2ea", deep: "#0e1b2c" };

/** Settings → Design yourself: the colour palettes and the layout choices visitors get, and the layout filled in by default for each answer. */
function DesignLookCard() {
  const brand = useBrand();
  const [s, setS] = useState<DesignSettings>(readDesignSettings);
  const [kind, setKind] = useState<Kind>("business");
  const save = (n: DesignSettings) => { setS(n); writeDesignSettings(n); pushPref({ design: n }); };
  const sets = s.sets || [];
  const setSets = (l: ColourSet[]) => save({ ...s, sets: l });
  const addSet = () => { const t = /^#[0-9a-f]{6}$/i.test(brand.tint || "") ? brand.tint! : "#3b82f6"; setSets([...sets, { name: sets.length ? "Palette " + (sets.length + 1) : "Studio colours", colours: { ...(brand.mode === "light" ? LIGHT : DARK), c1: t, c2: t, c3: t } }]); };
  const rules = s.look?.[kind] || {};
  const setRule = (key: string, patch: Partial<LookRule>) => {
    const r: LookRule = { ...rules[key], ...patch };
    if (!r.d) delete r.d; if (!r.a || !r.a.length) delete r.a; if (!r.h) delete r.h;
    const next = { ...rules }; if (Object.keys(r).length) next[key] = r; else delete next[key];
    const look = { ...(s.look || {}) }; if (Object.keys(next).length) look[kind] = next; else delete look[kind];
    save({ ...s, look });
  };
  return (
    <section className="card flex flex-col gap-4 p-5" aria-label="Design yourself colours and layouts">
      <h3 className="text-[15px] font-extrabold">Design yourself: colours and layouts</h3>
      <p className="text-sm text-ink-300">What a visitor can change when they press “Play with your design”, and the layout each type starts with. Visitors only see choices you leave on. Changes are saved in your Studio and reach the page for signed-out visitors after the next database update.</p>

      <div className="flex flex-col gap-3">
        <h4 className="text-sm font-bold">Colour palettes</h4>
        <p className="text-[13px] text-ink-400">Ready-made palettes visitors can tap. Each uses the same colours as Brand &amp; theme → Colours. A palette can leave a colour out to keep the theme's own. Without any, visitors get one made from your Studio's colour.</p>
        {sets.map((st, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-xl border border-ink-700 p-3">
            <div className="flex items-center gap-2"><input className="input max-w-[220px] py-1.5" aria-label="Palette name" maxLength={30} value={st.name} onChange={(e) => setSets(sets.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} /><button type="button" className="btn btn-ghost btn-sm ml-auto" onClick={() => setSets(sets.filter((_, j) => j !== i))}>Remove</button></div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
              {COLOUR_SLOTS.map(([k, label]) => (
                <label key={k} className="flex flex-col gap-1 text-[11px] leading-tight text-ink-400">{label}
                  <input type="color" aria-label={label} className="h-8 w-full cursor-pointer rounded border border-ink-600 bg-transparent" value={st.colours[k] || "#888888"} onChange={(e) => setSets(sets.map((x, j) => (j === i ? { ...x, colours: { ...x.colours, [k]: e.target.value } } : x)))} />
                </label>
              ))}
            </div>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-3"><button type="button" className="btn btn-sm" onClick={addSet} disabled={sets.length >= 12}>+ Add a palette</button>
          <Toggle id="design-pick" label="Let visitors change each colour" checked={s.pick !== false} onChange={(v) => save({ ...s, pick: v })} /></div>
      </div>

      <div className="flex flex-col gap-3">
        <h4 className="text-sm font-bold">Layouts for each type</h4>
        <p className="text-[13px] text-ink-400">“Starts with” is the layout filled in on every visitor's preview (the theme's own if left as is). Each choice shapes one of the visitor's answers. Turn a choice off to hide it, or narrow the options visitors can pick.</p>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Type of website">
          {KINDS.map((k) => <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)} className={`btn btn-sm ${kind === k ? "border-brand-400 bg-ink-700" : ""}`}>{KIND_NAME[k]}</button>)}
        </div>
        <div className="flex flex-col divide-y divide-ink-700 rounded-xl border border-ink-700">
          {LOOK_AXES[kind].map(([ax, forAnswer]) => {
            const r = rules[ax.key] || {}, allowed = r.a && r.a.length ? r.a : ax.options.map(([v]) => v);
            return (
              <div key={ax.key} className="flex flex-col gap-2 p-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><b className="text-[13px]">{ax.label}</b><span className="text-[12px] text-ink-500">shapes: {forAnswer}</span>
                  <span className="ml-auto"><Toggle id={`lk-${kind}-${ax.key}`} label="Show to visitors" checked={!r.h} onChange={(v) => setRule(ax.key, { h: !v })} /></span></div>
                <label className="flex flex-wrap items-center gap-2 text-[12px] text-ink-400">Starts with
                  <select className="input w-auto max-w-full py-1.5 text-[13px]" value={r.d || ""} onChange={(e) => setRule(ax.key, { d: e.target.value })}>
                    <option value="">Theme's own</option>
                    {ax.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select></label>
                <details className="text-[12px] text-ink-400"><summary className="cursor-pointer select-none">Options visitors can pick ({allowed.length} of {ax.options.length})</summary>
                  <div className="mt-2 grid gap-1 sm:grid-cols-2">
                    {ax.options.map(([v, l]) => (
                      <label key={v} className="flex items-center gap-2"><input type="checkbox" checked={allowed.includes(v)} onChange={(e) => { const n = e.target.checked ? [...allowed, v] : allowed.filter((x) => x !== v); setRule(ax.key, { a: n.length && n.length < ax.options.length ? n : [] }); }} />{l}</label>
                    ))}
                  </div></details>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function DesignOnCard() {
  const [s, setS] = useState<DesignSettings>(readDesignSettings);
  const on = s.on !== false;
  const save = (n: DesignSettings) => { setS(n); writeDesignSettings(n); pushPref({ design: n }); };
  return (
    <section className="card flex flex-col gap-3 p-5" aria-label="Design yourself">
      <h3 className="text-[15px] font-extrabold">Design yourself</h3>
      <p className="text-sm text-ink-300">A page on the Themes gallery where a visitor answers a few simple questions and sees a preview of their own website. Nothing is published. When they press Connect, the request is saved in your Studio's Cloudflare database and emailed to the Studio's owners. Open them with the “Design yourself queries” button next to New project on the Projects page (you read them with your own sign-in; visitors only send). Everything stays in your own Studio: the page, the AI text and the requests.</p>
      <Toggle id="design-on" label="Show “Design yourself” on the Themes page" checked={on} onChange={(v) => save({ ...s, on: v })} />
      <div className="flex flex-wrap gap-2"><a className="btn btn-sm" href="#/design">Open the page</a><a className="btn btn-ghost btn-sm" href="#/design-queries">See the requests</a></div>
    </section>
  );
}
