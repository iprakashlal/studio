import { useMemo, useState } from "react";
import { THEMES, THEME_TAGS, hasFx, Motifs, type Theme } from "./catalog";

/** A small drawing of the theme: background, a card in its card style, a button in its button style, and the hero layout. */
export function ThemeSwatch({ t }: { t: Theme }) {
  const c = t.colors, r = Math.min(t.radius, 16) / 2;
  const btnRadius = { pill: 99, sharp: 0, brutal: r, rounded: 6, outline: 6, glow: 7 }[t.style.buttons] ?? 6;
  const card: React.CSSProperties = {
    background: t.style.cards === "outline" ? "transparent" : t.style.cards === "glass" ? c.surface + "AA" : c.surface,
    border: t.style.cards === "brutal" ? `1.5px solid ${c.text}` : t.style.cards === "flat" || t.style.cards === "elevated" ? "1px solid transparent" : `1px solid ${c.line}`,
    boxShadow: t.style.cards === "brutal" ? `2px 2px 0 ${c.text}` : t.style.cards === "elevated" ? "0 6px 12px -6px rgba(0,0,0,.45)" : "none",
    borderRadius: r,
  };
  const art = Motifs.has(t.motif) ? (
    <div className="flex flex-1 items-center justify-center" style={{ minWidth: 0 }}>
      {[[0, c.c1, c.c3, 26], [1, c.c2, c.c1, 20], [2, c.c3, c.c2, 18]].map(([i, col, acc, sz]) => (
        <span key={i} className="block" style={{ width: sz, height: sz, color: col as string, ["--mo2" as any]: acc, marginLeft: i ? -4 : 0 }} dangerouslySetInnerHTML={{ __html: Motifs.svg(t.motif, i as number) }} />
      ))}
    </div>
  ) : (
    <div className="flex flex-1 items-center justify-center gap-1" style={{ minWidth: 0 }}>
      <i className="block h-5 w-5 rounded-full" style={{ background: c.c1, filter: t.style.ornament === "soft" ? "blur(2px)" : undefined, boxShadow: t.style.ornament === "outline" ? `inset 0 0 0 2px ${c.c1}` : undefined, backgroundColor: t.style.ornament === "outline" ? "transparent" : c.c1 }} />
      <i className="block h-4 w-4" style={{ background: c.c2, borderRadius: r / 2 }} />
      <i className="block h-0 w-0" style={{ borderLeft: "8px solid transparent", borderRight: "8px solid transparent", borderBottom: `14px solid ${c.c3}` }} />
    </div>
  );
  const text = (
    <div className={`flex flex-1 flex-col gap-1 ${t.style.layout === "center" ? "items-center" : ""}`} style={{ minWidth: 0 }}>
      <span className="block truncate text-[13px] font-extrabold leading-none" style={{ color: c.text, textTransform: t.style.heading === "upper" ? "uppercase" : undefined, fontStyle: t.style.heading === "italic" ? "italic" : undefined, letterSpacing: t.style.heading === "tight" ? "-.06em" : undefined }}>Aa</span>
      <span className="block h-1 w-10 rounded" style={{ background: c.soft, opacity: 0.6 }} />
      <span className="mt-0.5 block h-3 w-10" style={{ background: t.style.buttons === "outline" ? "transparent" : c.c1, border: `1.5px solid ${t.style.buttons === "brutal" ? c.text : c.c1}`, borderRadius: btnRadius, boxShadow: t.style.buttons === "brutal" ? `2px 2px 0 ${c.text}` : t.style.buttons === "glow" ? `0 2px 8px ${c.c1}` : undefined }} />
    </div>
  );
  const pattern = t.style.pattern === "grid" ? `linear-gradient(${c.line}55 1px,transparent 1px),linear-gradient(90deg,${c.line}55 1px,transparent 1px)` : t.style.pattern === "dots" ? `radial-gradient(${c.line} 1px,transparent 1.2px)` : t.style.pattern === "diagonal" ? `repeating-linear-gradient(45deg,${c.line}66 0 1px,transparent 1px 7px)` : t.style.pattern === "lines" ? `linear-gradient(${c.line}66 1px,transparent 1px)` : "none";
  return (
    <div className="relative flex h-[84px] flex-col gap-1.5 overflow-hidden p-2" style={{ background: c.bg, backgroundImage: pattern, backgroundSize: t.style.pattern === "lines" ? "100% 9px" : "10px 10px" }}>
      <div className="flex items-center gap-1" style={{ justifyContent: t.style.nav === "center" ? "center" : "space-between" }}>
        <span className="block h-1.5 w-6 rounded" style={{ background: c.text }} />
        <span className="block h-1.5 w-10" style={{ background: t.style.nav === "bar" ? c.deep : "transparent", border: t.style.nav === "pill" ? `1px solid ${c.line}` : undefined, borderRadius: t.style.nav === "pill" ? 99 : 0 }} />
      </div>
      <div className={`flex flex-1 gap-1.5 p-1.5 ${t.style.layout === "reverse" ? "flex-row-reverse" : t.style.layout === "center" || t.style.layout === "stacked" ? "flex-col" : ""}`} style={card}>
        {text}
        {t.style.layout !== "minimal" && art}
      </div>
    </div>
  );
}

const fxSummary = (t: Theme) => [t.fx.cursor !== "none" && t.fx.cursor + " cursor", t.fx.loader !== "none" && t.fx.loader, t.fx.textfx !== "none" && t.fx.textfx].filter(Boolean).join(" · ") || "interactive";

/** Theme gallery with tag filters. `current` is the selected theme id. */
export function ThemeGallery({ current, onPick, compact }: { current?: string; onPick: (t: Theme) => void; compact?: boolean }) {
  const [tag, setTag] = useState("");
  const [q, setQ] = useState("");
  const list = useMemo(() => THEMES.filter((t) => (!tag || t.tags.includes(tag)) && (!q || t.name.toLowerCase().includes(q.toLowerCase()))), [tag, q]);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <input className="input w-40 py-1.5 text-sm" placeholder="Search themes" aria-label="Search themes" value={q} onChange={(e) => setQ(e.target.value)} />
        {["", ...THEME_TAGS].map((x) => (
          <button key={x || "all"} type="button" aria-pressed={tag === x} onClick={() => setTag(x)}
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${tag === x ? "border-brand-500 bg-brand-500/15 text-ink-100" : "border-ink-600 text-ink-400 hover:text-ink-100"}`}>{x || `All ${THEMES.length}`}</button>
        ))}
      </div>
      <div className={`grid gap-2.5 ${compact ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4"}`} role="radiogroup" aria-label="Themes">
        {list.map((t) => (
          <button key={t.id} type="button" role="radio" aria-checked={current === t.id} onClick={() => onPick(t)} title={`${t.name}: ${t.style.layout} layout, ${t.style.cards} cards, ${t.style.buttons} buttons, ${t.style.motionStyle} animation`}
            className={`flex flex-col overflow-hidden rounded-xl border text-left transition ${current === t.id ? "border-brand-500 ring-2 ring-brand-500/50" : "border-ink-600 hover:border-ink-400"}`}>
            <ThemeSwatch t={t} />
            <span className="flex items-center justify-between gap-2 bg-ink-950 px-2.5 py-2">
              <span className="min-w-0">
                <b className="block truncate text-[13px]">{t.name}</b>
                <span className="block truncate text-[11px] text-ink-400">{Motifs.packs[t.motif]?.name || t.display}{hasFx(t) ? " · " + fxSummary(t) : ""}</span>
              </span>
              {current === t.id ? <span className="text-xs font-bold text-brand-400">✓</span> : hasFx(t) && <span className="shrink-0 rounded-full border border-brand-500/50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-400" title="Interactive theme: cursor, intro and scroll effects">fx</span>}
            </span>
          </button>
        ))}
        {!list.length && <p className="col-span-full text-sm text-ink-400">No themes match.</p>}
      </div>
    </div>
  );
}
