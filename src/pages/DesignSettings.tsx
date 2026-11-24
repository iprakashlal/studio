import { useMemo, useState } from "react";
import { pushPref, savePrefNow } from "../lib/prefs";
import { cleanDesignSettings, readDesignSettings, writeDesignSettings, type DesignSettings } from "../lib/designs";
import { DEFAULT_BACKGROUNDS, GROUPS, KINDS, LOOK_AXES, type Kind, type LookRule } from "../lib/designlook";
import { allThemesOf } from "../lib/designer";
import { COLOUR_DOT } from "../lib/designer";
import { Toggle, useToast } from "../ui/kit";

/** Settings → General: the "Design yourself" page (a link on the Themes page): on or off. */
export function DesignPageCard() { return <DesignOnCard />; }

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

const KIND_NAME: Record<Kind, string> = { business: "Business", restaurant: "Restaurant", portfolio: "Portfolio", store: "Shop" };
const DEFAULT_ACCENTS = ["blue", "green", "red", "orange", "purple", "pink", "gold", "mono"].map((c) => COLOUR_DOT[c]);
const same = (x: unknown, y: unknown) => JSON.stringify(x) === JSON.stringify(y);

function Block({ title, note, children, open = true }: { title: string; note?: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group card overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
        <h3 className="text-[15px] font-extrabold">{title}</h3><span aria-hidden className="ml-auto text-ink-500 transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="flex flex-col gap-4 border-t border-ink-700 px-5 pb-5 pt-4">{note && <p className="text-[13px] leading-relaxed text-ink-400">{note}</p>}{children}</div>
    </details>
  );
}

/** Settings → Design yourself: what a visitor can change on the Design yourself page (colours, themes, layout, style, interactions, intro screen) and what each type starts with. Saved with the Save button. */
export function DesignLookTab() {
  const toast = useToast();
  const [saved, setSaved] = useState<DesignSettings>(readDesignSettings);
  const [d, setD] = useState<DesignSettings>(saved);
  const [kind, setKind] = useState<Kind>("business");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const dirty = useMemo(() => !same(cleanDesignSettings({ ...d, on: saved.on }), cleanDesignSettings(saved)), [d, saved]);
  const upd = (p: Partial<DesignSettings>) => { setD((o) => ({ ...o, ...p })); setErr(""); };

  const backgrounds = d.backgrounds?.length ? d.backgrounds : DEFAULT_BACKGROUNDS, accents = d.accents?.length ? d.accents : DEFAULT_ACCENTS;
  const rules = d.look?.[kind] || {};
  const setRule = (key: string, patch: Partial<LookRule>) => {
    const r: LookRule = { ...rules[key], ...patch };
    if (!r.d) delete r.d; if (!r.a || !r.a.length) delete r.a; if (!r.h) delete r.h;
    const next = { ...rules }; if (Object.keys(r).length) next[key] = r; else delete next[key];
    const look = { ...(d.look || {}) }; if (Object.keys(next).length) look[kind] = next; else delete look[kind];
    upd({ look });
  };
  const themes = allThemesOf(kind), offered = d.themes?.[kind]?.length ? d.themes[kind]! : themes.map((t) => t.id);
  const setOffered = (ids: string[]) => { const th = { ...(d.themes || {}) }; if (ids.length && ids.length < themes.length) th[kind] = ids; else delete th[kind]; upd({ themes: th }); };

  const save = async () => {
    const clean = cleanDesignSettings({ ...d, on: readDesignSettings().on });
    setBusy(true); setErr("");
    try {
      writeDesignSettings(clean);
      await savePrefNow({ design: clean });
      setSaved(clean); setD(clean); toast("Saved. The Design yourself page now uses these settings.");
    } catch (e: any) { setErr((e?.message || "Couldn't save.") + " Your changes are still here: try Save again."); }
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-300">Everything a visitor can change on the Design yourself page after their preview is ready, and what each type starts with. Choices are the ones in your site admin's Theme &amp; layout. Press <b className="text-ink-100">Save changes</b> to store them in your Studio's database; signed-out visitors get them with the next page load.</p>

      <Block title="Accent colours" note="The round colours visitors tap to recolour the buttons and links. “Theme's own” is always the first choice and the default.">
        <div className="flex flex-wrap items-center gap-2.5">
          {accents.map((c, i) => (
            <span key={i} className="relative">
              <input type="color" aria-label={`Accent colour ${i + 1}`} className="h-10 w-10 cursor-pointer rounded-full border border-ink-600 bg-transparent p-0.5" value={c} onChange={(e) => upd({ accents: accents.map((x, j) => (j === i ? e.target.value : x)) })} />
              <button type="button" aria-label={`Remove accent colour ${i + 1}`} className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full border border-ink-600 bg-ink-800 text-[10px] text-ink-300 hover:text-ink-100" onClick={() => upd({ accents: accents.filter((_, j) => j !== i) })}>✕</button>
            </span>
          ))}
          <button type="button" className="btn btn-sm" disabled={accents.length >= 16} onClick={() => upd({ accents: [...accents, "#3b82f6"] })}>+ Add</button>
          {!!d.accents?.length && <button type="button" className="btn btn-ghost btn-sm" onClick={() => upd({ accents: [] })}>Use the standard set</button>}
        </div>
      </Block>

      <Block title="Background colours" note="A few backgrounds, light to dark, that visitors can tap. The text, cards and borders adjust automatically so the page stays easy to read. “Theme's own” is always the first choice and the default.">
        <div className="flex flex-wrap items-center gap-2.5">
          {backgrounds.map((c, i) => (
            <span key={i} className="relative">
              <input type="color" aria-label={`Background colour ${i + 1}`} className="h-10 w-10 cursor-pointer rounded-full border border-ink-600 bg-transparent p-0.5" value={c} onChange={(e) => upd({ backgrounds: backgrounds.map((x, j) => (j === i ? e.target.value : x)) })} />
              <button type="button" aria-label={`Remove background colour ${i + 1}`} className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full border border-ink-600 bg-ink-800 text-[10px] text-ink-300 hover:text-ink-100" onClick={() => upd({ backgrounds: backgrounds.filter((_, j) => j !== i) })}>✕</button>
            </span>
          ))}
          <button type="button" className="btn btn-sm" disabled={backgrounds.length >= 16} onClick={() => upd({ backgrounds: [...backgrounds, "#ffffff"] })}>+ Add</button>
          {!!d.backgrounds?.length && <button type="button" className="btn btn-ghost btn-sm" onClick={() => upd({ backgrounds: [] })}>Use the standard set</button>}
        </div>
        <Toggle id="design-pick" label="Let visitors change each colour" checked={d.pick !== false} onChange={(v) => upd({ pick: v })} />
      </Block>

      <Block title="Themes, layout, style and interactions" note="Choose a type, then the themes it offers and, for each choice, the option it starts with. “Starts with” is filled in on every visitor's preview of that type (the theme's own if left alone). Each choice is labelled with the answer it shapes. Hide a choice, or narrow the options visitors can pick.">
        <div className="flex flex-wrap gap-1 rounded-xl border border-ink-700 p-1" role="tablist" aria-label="Type of website">
          {KINDS.map((k) => <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)} className={`h-9 flex-1 rounded-lg px-3 text-[13px] font-semibold ${kind === k ? "bg-ink-700 text-ink-100" : "text-ink-400 hover:text-ink-100"}`}>{KIND_NAME[k]}</button>)}
        </div>

        <details className="group rounded-xl border border-ink-700">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-[13px] font-bold [&::-webkit-details-marker]:hidden">Themes offered<span className="font-normal text-ink-500">{offered.length} of {themes.length}</span><span aria-hidden className="ml-auto text-ink-500 transition-transform group-open:rotate-180">▾</span></summary>
          <div className="flex flex-col gap-3 border-t border-ink-700 p-4">
            <div className="flex gap-2"><button type="button" className="btn btn-sm" onClick={() => setOffered(themes.map((t) => t.id))}>All</button><button type="button" className="btn btn-sm" onClick={() => setOffered([themes[0].id])}>Only one</button></div>
            <div className="grid max-h-80 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
              {themes.map((t) => (
                <label key={t.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-ink-700 px-3 py-2 text-[13px] hover:border-ink-500">
                  <input type="checkbox" checked={offered.includes(t.id)} onChange={(e) => setOffered(e.target.checked ? [...offered, t.id] : offered.filter((x) => x !== t.id))} />
                  <span className="flex flex-none overflow-hidden rounded-full border border-white/20" aria-hidden>{[t.colors.bg, t.colors.c1, t.colors.c2].map((c, i) => <span key={i} className="h-4 w-3.5" style={{ background: c }} />)}</span>
                  <span className="min-w-0 flex-1 truncate">{t.name}</span>
                </label>
              ))}
            </div>
          </div>
        </details>

        {GROUPS.map((g) => {
          const rows = LOOK_AXES[kind].filter((x) => x[2] === g); if (!rows.length) return null;
          return (
            <details key={g} className="group rounded-xl border border-ink-700" open={g === "Layout"}>
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-[13px] font-bold [&::-webkit-details-marker]:hidden">{g}<span className="font-normal text-ink-500">{rows.length} choices</span><span aria-hidden className="ml-auto text-ink-500 transition-transform group-open:rotate-180">▾</span></summary>
              <div className="flex flex-col divide-y divide-ink-700 border-t border-ink-700">
                {rows.map(([ax, forAnswer]) => {
                  const r = rules[ax.key] || {}, allowed = r.a && r.a.length ? r.a : ax.options.map(([v]) => v);
                  return (
                    <div key={ax.key} className="grid gap-x-4 gap-y-2.5 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                      <div className="min-w-0"><b className="block text-[13px]">{ax.label}</b><span className="text-[12px] text-ink-500">Shapes: {forAnswer}</span></div>
                      <div className="flex flex-col gap-2">
                        <select aria-label={`${ax.label}: starts with`} className="input h-10 py-0 text-[13px]" value={r.d || ""} onChange={(e) => setRule(ax.key, { d: e.target.value })}>
                          <option value="">Starts with: theme's own</option>
                          {ax.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2"><Toggle id={`lk-${kind}-${ax.key}`} label="Show to visitors" checked={!r.h} onChange={(v) => setRule(ax.key, { h: !v })} />
                          <details className="text-[12px] text-ink-400"><summary className="cursor-pointer select-none">Options visitors can pick ({allowed.length} of {ax.options.length})</summary>
                            <div className="mt-2 grid gap-1.5">
                              {ax.options.map(([v, l]) => <label key={v} className="flex items-center gap-2"><input type="checkbox" checked={allowed.includes(v)} onChange={(e) => { const n = e.target.checked ? [...allowed, v] : allowed.filter((x) => x !== v); setRule(ax.key, { a: n.length && n.length < ax.options.length ? n : [] }); }} />{l}</label>)}
                            </div></details></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </details>
          );
        })}
      </Block>

      <div className="card sticky bottom-3 z-10 flex flex-wrap items-center gap-3 border-ink-600 bg-ink-900/95 p-3 shadow-xl backdrop-blur" role="region" aria-label="Save">
        <p className={`min-w-0 flex-1 text-[13px] ${err ? "text-red-300" : "text-ink-400"}`} role="status">{err || (dirty ? "You have changes that aren't saved yet." : "All changes are saved.")}</p>
        <button type="button" className="btn btn-ghost btn-sm" disabled={!dirty || busy} onClick={() => { setD(saved); setErr(""); }}>Discard</button>
        <button type="button" className="btn btn-pri" disabled={!dirty || busy} onClick={save}>{busy ? "Saving…" : "Save changes"}</button>
      </div>
    </div>
  );
}
