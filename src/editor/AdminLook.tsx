// Admin page → Admin page colours: this site's admin page in its own colours. Dark or light, and a colour taken
// from the logo (any of its colours), a ready-made scheme, or any colour. A small preview shows the result here;
// the admin page itself changes at once when this is edited there.
import { useContext, useEffect, useState } from "react";
import { Ctx } from "./fields";
import { brand } from "../lib/brand";
import { SCHEMES, coloursFromImage, isHex, tintPalette, type UiMode } from "../lib/tint";
import { Toggle } from "../ui/kit";

export function AdminLookField() {
  const { root, bump, img } = useContext(Ctx);
  const cms = root.cms || {};
  const set = (k: string, v: unknown) => { root.cms = { ...(root.cms || {}), [k]: v }; bump(); };
  const on = !!cms.tint, color = isHex(cms.tintColor) ? String(cms.tintColor) : "", mode: "" | UiMode = cms.tintMode === "light" || cms.tintMode === "dark" ? cms.tintMode : "";
  const logo = root.brand?.icon || root.brand?.logo;
  const src = logo?.path ? img(logo) : /^(https:|data:image\/)/i.test(String(logo?.url || "")) ? String(logo.url) : "";
  const [cols, setCols] = useState<string[] | null>(null); // null: reading
  useEffect(() => { let live = true; setCols(null); (src ? coloursFromImage(src, 6) : Promise.resolve([] as string[])).then((c) => { if (live) setCols(c); }); return () => { live = false; }; }, [src]);
  const fallback = [root.theme?.c1, root.theme?.accent].find(isHex) || "";
  const shown = color || cols?.[0] || fallback, shownMode: UiMode = mode || (brand().mode === "light" ? "light" : "dark");
  const pal = shown ? tintPalette(shown, shownMode) : null;
  const v = (k: string, d: string) => pal?.[k] || d;
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  const chip = (active: boolean) => `flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[13px] ${active ? "border-brand-400 bg-ink-700 text-ink-100" : "border-ink-600 text-ink-300 hover:bg-ink-800"}`;
  return (
    <div className="flex flex-col gap-3" aria-label="Admin page colours">
      <Toggle id="cms-tint" label="Give this site's admin page its own colours" checked={on} onChange={(x) => set("tint", x)} />
      {!on ? <p className="hint">Off: the admin page wears the Studio's look. The site itself never changes with this.</p> : <>
        <div className="flex flex-col gap-1.5"><span className="label">Look</span>
          <div className="flex self-start rounded-lg border border-ink-600" role="radiogroup" aria-label="Admin page look">
            {([["", "Same as the Studio"], ["dark", "Dark"], ["light", "Light"]] as const).map(([k, l]) => <button key={k || "same"} type="button" role="radio" aria-checked={mode === k} onClick={() => set("tintMode", k)} className={`btn btn-sm border-0 ${mode === k ? "bg-ink-700" : "bg-transparent"}`}>{l}</button>)}
          </div>
        </div>
        <div className="flex flex-col gap-2 rounded-xl border border-ink-700 p-3" role="radiogroup" aria-label="Admin page colour">
          <span className="label">Colour</span>
          <div className="flex flex-wrap items-center gap-2" aria-label="Logo colours">
            <span className="text-[13px] text-ink-400">From the logo:</span>
            {cols === null ? <span className="hint">reading the logo…</span> : !cols.length ? <span className="text-[13px] text-amber-200">{src ? "this logo is black, white or grey, so there's no colour to take." : "add a logo under Brand first."}{fallback ? " The site's accent colour is used until you pick one below." : " Pick one below."}</span>
              : <>
                <button type="button" role="radio" aria-checked={!color} onClick={() => set("tintColor", "")} className={chip(!color)} title="Follows the logo: changes with it"><i aria-hidden className="h-4 w-4 rounded-full border border-white/20" style={{ background: cols[0] }} />Main colour</button>
                {cols.slice(1).map((c, i) => <button key={c} type="button" role="radio" aria-checked={same(color, c)} aria-label={`Logo colour ${i + 2}`} title={c} onClick={() => set("tintColor", c)} className={chip(same(color, c))}><i aria-hidden className="h-4 w-4 rounded-full border border-white/20" style={{ background: c }} />{c.toUpperCase()}</button>)}
              </>}
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Colour schemes">
            {SCHEMES.map((x) => <button key={x.id} type="button" role="radio" aria-checked={same(color, x.hex)} aria-label={x.name} title={x.name} onClick={() => set("tintColor", x.hex)} className={chip(same(color, x.hex))}><i aria-hidden className="h-4 w-4 rounded-full border border-white/20" style={{ background: x.hex }} />{x.name}</button>)}
            <label className={`${chip(!!color && !SCHEMES.some((x) => same(x.hex, color)) && !(cols || []).some((c) => same(c, color)))} relative cursor-pointer`}><i aria-hidden className="h-4 w-4 rounded border border-white/20" style={{ background: color || shown || "#4A67F0" }} />Your own colour<input type="color" className="sr-only" aria-label="Your own admin colour" value={color || shown || "#4A67F0"} onChange={(e) => set("tintColor", e.target.value)} /></label>
          </div>
        </div>
        {pal ? (
          <div aria-label="Admin page preview" data-mode={shownMode} className="overflow-hidden rounded-xl border border-ink-600 text-[12.5px]" style={{ background: v("ink-950", shownMode === "light" ? "#F3F5F9" : "#0B0F17"), color: v("ink-100", shownMode === "light" ? "#131A26" : "#EEF1F6") }}>
            <div className="flex items-center gap-2 px-3 py-2" style={{ background: v("ink-900", shownMode === "light" ? "#FFFFFF" : "#0F141D"), borderBottom: `1px solid ${v("ink-700", "#222C3B")}` }}>
              <i aria-hidden className="h-3 w-3 rounded-full" style={{ background: v("brand-500", shown) }} /><b>Admin page</b><span className="ml-auto rounded-md px-2.5 py-1 font-semibold text-white" data-part="button" style={{ background: v("brand-500", shown) }}>Save</span>
            </div>
            <div className="flex gap-3 p-3">
              <div className="flex w-28 flex-col gap-1.5">{["Brand", "Pages", "Orders"].map((t, i) => <span key={t} className="rounded-md px-2 py-1" style={i === 0 ? { background: v("ink-700", "#222C3B"), color: v("ink-100", "#EEF1F6") } : { color: v("ink-300", "#A9B3C4") }}>{t}</span>)}</div>
              <div className="flex flex-1 flex-col gap-2 rounded-lg p-3" style={{ background: v("ink-900", "#0F141D"), border: `1px solid ${v("ink-700", "#222C3B")}` }}>
                <span style={{ color: v("ink-400", "#7D8AA0") }}>SITE NAME</span>
                <span className="rounded-md px-2 py-1.5" style={{ background: v("ink-950", "#0B0F17"), border: `1px solid ${v("ink-600", "#2E3A4C")}` }}>Picaffectz</span>
                <span data-part="link" style={{ color: v("brand-300", shown) }}>A link looks like this</span>
              </div>
            </div>
          </div>
        ) : cols !== null && <p className="hint">Pick a colour above to see it here.</p>}
        <p className="hint">The admin page's buttons and highlights take this colour and its background leans toward it. Open the site's admin page to see it for real: it changes there as soon as this is saved. The site itself doesn't change.</p>
      </>}
    </div>
  );
}
