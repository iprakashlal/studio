import { BrandMark, useBrand } from "../lib/brand";
import { STUDIO_BUILD } from "../build-info";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { THEMES, THEME_TAGS, portfolioThemeValues, storeThemeValues, type Theme } from "../themes/catalog";
import { BIZ_TAGS, BIZ_THEMES, businessThemeValues } from "../themes/business";
import { ThemeSwatch } from "../themes/ThemeGallery";
import { themeCode } from "../themes/codes";
import { TEMPLATES } from "../schema";
import { Preview } from "../editor/Preview";
import { Logo, useToast } from "../ui/kit";

// A public page (no sign-in) that shows every theme, so you can send it to a client.
// Hover a card for a live preview, click it for a bigger one, and quote the theme ID (T-07) to choose.
// URL: #/themes?v=store&t=velocity&list=velocity,blueprint

type Kind = "portfolio" | "store" | "business";
const KINDS: { id: Kind; label: string }[] = [{ id: "portfolio", label: "Personal portfolio" }, { id: "store", label: "Shop" }, { id: "business", label: "Business portfolio" }];
/** Business sites have their own themes; personal portfolios and shops share the rest. */
const poolOf = (k: Kind): Theme[] => (k === "business" ? BIZ_THEMES : THEMES);
const ALL: Theme[] = [...THEMES, ...BIZ_THEMES];
const LS = "site-studio:theme-shortlist";

function parse(): { v: Kind; t: string; list: string[] } {
  const q = new URLSearchParams(location.hash.split("?")[1] || "");
  const v: Kind = q.get("v") === "store" ? "store" : q.get("v") === "business" ? "business" : "portfolio";
  return { v, t: q.get("t") || "", list: (q.get("list") || "").split(",").filter((id) => ALL.some((t) => t.id === id)) };
}
function link(p: { v: Kind; t?: string; list?: string[] }) {
  const q = new URLSearchParams();
  if (p.v !== "portfolio") q.set("v", p.v);
  if (p.t) q.set("t", p.t);
  if (p.list && p.list.length) q.set("list", p.list.join(","));
  const s = q.toString();
  return location.origin + location.pathname + "#/themes" + (s ? "?" + s : "");
}
const values = (k: Kind, t: Theme) => (k === "store" ? storeThemeValues(t) : k === "business" ? businessThemeValues(t) : portfolioThemeValues(t));
const withTheme = (sample: any, k: Kind, t: Theme) => sample && { ...sample, theme: { ...(sample.theme || {}), ...values(k, t) } };
const readList = (): string[] => { try { return JSON.parse(localStorage.getItem(LS) || "[]").filter((id: string) => ALL.some((t) => t.id === id)); } catch { return []; } };

export function ThemesPage({ signedIn }: { signedIn: boolean }) {
  const toast = useToast();
  const init = useMemo(parse, []);
  const [kind, setKind] = useState<Kind>(init.v);
  const [tag, setTag] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string>(init.t);
  const [mine, setMine] = useState<string[]>(readList);
  const [shared] = useState<string[]>(init.list);
  const [only, setOnly] = useState<"" | "shared" | "mine">(init.list.length ? "shared" : "");
  const [samples, setSamples] = useState<Record<Kind, any>>({ portfolio: null, store: null, business: null });
  const pool = poolOf(kind), tags = kind === "business" ? BIZ_TAGS : THEME_TAGS;
  // Switching between business and the other types changes the theme list: clear what doesn't belong.
  const switchKind = (k: Kind) => { if ((k === "business") !== (kind === "business")) { setTag(""); setOpen(""); setHover(null); } setKind(k); };

  useEffect(() => {
    for (const k of ["portfolio", "store", "business"] as Kind[])
      fetch(`templates/${k}/content.json`, { cache: "no-store" }).then((r) => r.json()).then((c) => {
        TEMPLATES[k].prepare?.(c);
        setSamples((s) => ({ ...s, [k]: c }));
      }).catch(() => {});
  }, []);
  useEffect(() => { try { localStorage.setItem(LS, JSON.stringify(mine)); } catch { /* private mode */ } }, [mine]);
  useEffect(() => { history.replaceState(null, "", link({ v: kind, t: open, list: only === "shared" ? shared : undefined })); }, [kind, open, only]);
  const studioBrand = useBrand();
  useEffect(() => { document.title = "Theme gallery · " + studioBrand.name; }, [studioBrand.name]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase().replace(/^[tb]-?0*/, "");
    return pool.filter((t) => {
      if (only === "shared" && !shared.includes(t.id)) return false;
      if (only === "mine" && !mine.includes(t.id)) return false;
      if (tag && !t.tags.includes(tag)) return false;
      if (!s) return true;
      const code = themeCode(t).toLowerCase().replace(/^[tb]-?0*/, "");
      return code === s || t.name.toLowerCase().includes(q.trim().toLowerCase()) || t.tags.some((g) => g.toLowerCase() === q.trim().toLowerCase());
    });
  }, [q, tag, only, mine, shared, pool]);

  const toggle = (id: string) => setMine((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  const copy = async (text: string, msg: string) => {
    try { await navigator.clipboard.writeText(text); toast(msg); } catch { prompt("Copy this:", text); }
  };
  const shareMine = () => {
    const ts = mine.map((id) => pool.find((t) => t.id === id)!).filter(Boolean);
    copy(ts.map((t) => `${themeCode(t)} · ${t.name}`).join("\n") + "\n\n" + link({ v: kind, list: mine }), "Shortlist and link copied");
  };

  const openTheme = pool.find((t) => t.id === open);
  const idx = openTheme ? list.findIndex((t) => t.id === open) : -1;
  const step = (d: number) => { if (!list.length) return; const i = idx < 0 ? 0 : (idx + d + list.length) % list.length; setOpen(list[i].id); };

  // ---------- hover preview (pointer devices only)
  const [hover, setHover] = useState<{ id: string; rect: DOMRect } | null>(null);
  const timer = useRef<number>();
  const fine = useMemo(() => matchMedia("(hover: hover) and (pointer: fine)").matches, []);
  const onEnter = (t: Theme, el: HTMLElement) => {
    if (!fine) return;
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setHover({ id: t.id, rect: el.getBoundingClientRect() }), 380);
  };
  const onLeave = () => { clearTimeout(timer.current); timer.current = window.setTimeout(() => setHover(null), 120); };
  useEffect(() => { const s = () => setHover(null); addEventListener("scroll", s, { passive: true }); return () => removeEventListener("scroll", s); }, []);

  return (
    <div className="min-h-screen bg-ink-950 text-ink-100">
      <header className="sticky top-0 z-30 border-b border-ink-700 bg-ink-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <a href="#/" className="flex items-center gap-2.5 font-extrabold"><BrandMark fallback={<Logo />} />{studioBrand.name}</a>
          <span className="text-ink-500">/</span><span className="font-bold">Theme gallery</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-sm" onClick={() => copy(link({ v: kind }), "Gallery link copied")}>Copy gallery link</button>
            {signedIn && <a href="#/" className="btn btn-sm">Back to projects</a>}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-24 pt-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Pick a look for your site</h1>
            <p className="mt-2 text-ink-300">{kind === "business" ? `${BIZ_THEMES.length} business themes for companies, firms, agencies and practices.` : `${THEMES.length} themes for personal portfolios and shops.`} Hover a theme to preview it, or click it to open a bigger preview. When you've chosen, send the <b className="text-ink-100">theme ID</b> (like <code className="rounded bg-ink-800 px-1.5 py-0.5 text-brand-300">{kind === "business" ? "B-07" : "T-07"}</code>), or star a few and share your shortlist.</p>
          </div>
          <div className="flex rounded-xl border border-ink-600 p-1" role="group" aria-label="Preview as">
            {KINDS.map((k) => (
              <button key={k.id} type="button" aria-pressed={kind === k.id} onClick={() => switchKind(k.id)}
                className={`rounded-lg px-4 py-2 text-sm font-bold ${kind === k.id ? "bg-brand-500 text-white" : "text-ink-300 hover:text-ink-100"}`}>{k.label}</button>
            ))}
          </div>
        </div>

        {only === "shared" && (
          <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-brand-500/40 bg-brand-500/10 px-4 py-3 text-sm">
            <span>You're viewing a <b>shared shortlist</b> of {shared.length} theme{shared.length === 1 ? "" : "s"}.</span>
            <button type="button" className="btn btn-sm ml-auto" onClick={() => setOnly("")}>Show all themes</button>
          </div>
        )}

        <div className="sticky top-[57px] z-20 -mx-4 mt-6 flex flex-wrap items-center gap-2 border-b border-ink-800 bg-ink-950/95 px-4 py-3 backdrop-blur">
          <input className="input w-56 py-2 text-sm" placeholder={`Search name or ID, e.g. ${kind === "business" ? "B-07" : "T-07"}`} aria-label="Search themes" value={q} onChange={(e) => setQ(e.target.value)} />
          {["", ...tags].map((x) => (
            <button key={x || "all"} type="button" aria-pressed={tag === x} onClick={() => setTag(x)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${tag === x ? "border-brand-500 bg-brand-500/15 text-ink-100" : "border-ink-600 text-ink-400 hover:text-ink-100"}`}>{x || "All"}</button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <button type="button" aria-pressed={only === "mine"} onClick={() => setOnly(only === "mine" ? "" : "mine")}
              className={`btn btn-sm ${only === "mine" ? "border-amber-400 text-amber-300" : ""}`}>★ My shortlist ({mine.length})</button>
            {mine.length > 0 && <button type="button" className="btn btn-sm" onClick={shareMine}>Share shortlist</button>}
          </div>
        </div>

        <p className="mt-4 text-sm text-ink-400">{list.length} of {pool.length} themes</p>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((t) => {
            const starred = mine.includes(t.id);
            return (
              <article key={t.id} className="group relative overflow-hidden rounded-2xl border border-ink-700 bg-ink-900 transition hover:-translate-y-0.5 hover:border-ink-500"
                onMouseEnter={(e) => onEnter(t, e.currentTarget)} onMouseLeave={onLeave}>
                <button type="button" className="block w-full text-left" onClick={() => { setHover(null); setOpen(t.id); }} aria-label={`Preview ${themeCode(t)} ${t.name}`}>
                  <div className="relative h-[150px] overflow-hidden">
                    <div className="absolute left-0 top-0 w-[60.6%] origin-top-left scale-[1.65]"><ThemeSwatch t={t} /></div>
                    <span className="absolute left-3 top-3 rounded-lg bg-black/75 px-2 py-1 font-mono text-xs font-bold tracking-wider text-white">{themeCode(t)}</span>
                  </div>
                  <div className="flex flex-col gap-1.5 px-4 pb-4 pt-3">
                    <b className="truncate text-[15px]">{t.signature && <span className="mr-1 text-brand-400">★</span>}{t.name}</b>
                    <div className="flex flex-wrap gap-1">{t.tags.slice(0, 4).map((g) => <span key={g} className="rounded-full bg-ink-800 px-2 py-0.5 text-[11px] text-ink-300">{g}</span>)}</div>
                  </div>
                </button>
                <button type="button" onClick={() => toggle(t.id)} aria-pressed={starred} aria-label={starred ? `Remove ${t.name} from shortlist` : `Add ${t.name} to shortlist`}
                  className={`absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full text-lg shadow ${starred ? "bg-amber-400 text-ink-950" : "bg-black/60 text-white opacity-80 hover:opacity-100"}`}>{starred ? "★" : "☆"}</button>
              </article>
            );
          })}
        </div>
        {!list.length && <p className="mt-10 text-center text-ink-400">No themes match. Try another filter, or clear the search.</p>}
      </main>

      {hover && !openTheme && pool.some((t) => t.id === hover.id) && <HoverPreview kind={kind} sample={samples[kind]} theme={pool.find((t) => t.id === hover.id)!} rect={hover.rect} onEnter={() => clearTimeout(timer.current)} onLeave={onLeave} />}

      {openTheme && (
        <ThemeModal key={kind} theme={openTheme} kind={kind} setKind={setKind} sample={samples[kind]} starred={mine.includes(openTheme.id)}
          onStar={() => toggle(openTheme.id)} onClose={() => setOpen("")} onStep={step} pos={idx >= 0 ? `${idx + 1} / ${list.length}` : ""}
          onCopyId={() => copy(`${themeCode(openTheme)} · ${openTheme.name}`, `Copied ${themeCode(openTheme)} · ${openTheme.name}`)}
          onCopyLink={() => copy(link({ v: kind, t: openTheme.id }), "Link to this theme copied")} />
      )}
    </div>
  );
}

/** One live preview iframe per template, kept mounted so hovering from card to card is instant. */
function HoverPreview({ kind, sample, theme, rect, onEnter, onLeave }: { kind: Kind; sample: any; theme: Theme; rect: DOMRect; onEnter: () => void; onLeave: () => void }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const ready = useRef(false);
  const content = withTheme(sample, kind, theme);
  const send = useCallback(() => { if (ready.current && content) ref.current?.contentWindow?.postMessage({ type: "cms:content", content, assets: {} }, location.origin); }, [content]);
  useEffect(() => {
    const on = (e: MessageEvent) => { if (e.source === ref.current?.contentWindow && e.data?.type === "cms:ready") { ready.current = true; send(); } };
    addEventListener("message", on); return () => removeEventListener("message", on);
  }, [send]);
  useEffect(send, [theme.id, sample, send]);
  const W = 520, H = 340, scale = W / 1280;
  const right = rect.right + 16 + W < innerWidth;
  const left = right ? rect.right + 16 : Math.max(12, rect.left - 16 - W);
  const top = Math.min(Math.max(12, rect.top + rect.height / 2 - H / 2), innerHeight - H - 12);
  return (
    <div className="fixed z-40 overflow-hidden rounded-2xl border border-ink-500 bg-ink-900 shadow-2xl" style={{ left, top, width: W }} onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <div className="flex items-center gap-2 border-b border-ink-700 px-3 py-2 text-xs">
        <span className="rounded bg-ink-800 px-1.5 py-0.5 font-mono font-bold text-brand-300">{themeCode(theme)}</span>
        <b className="truncate">{theme.name}</b><span className="ml-auto text-ink-400">Click the card to open</span>
      </div>
      <div className="relative overflow-hidden bg-white" style={{ height: H - 36 }}>
        <iframe ref={ref} key={kind} name="cms-preview" title={`${theme.name} preview`} src={`templates/${kind}/index.html?v=${STUDIO_BUILD.id}`} tabIndex={-1}
          className="pointer-events-none absolute left-0 top-0 origin-top-left border-0" style={{ width: 1280, height: (H - 36) / scale, transform: `scale(${scale})` }} />
      </div>
    </div>
  );
}

function ThemeModal(p: { theme: Theme; kind: Kind; setKind: (k: Kind) => void; sample: any; starred: boolean; pos: string; onStar: () => void; onClose: () => void; onStep: (d: number) => void; onCopyId: () => void; onCopyLink: () => void }) {
  const { theme: t } = p;
  const [v, setV] = useState(0);
  useEffect(() => setV((x) => x + 1), [t.id, p.sample]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") p.onClose();
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "ArrowRight") p.onStep(1);
      if (e.key === "ArrowLeft") p.onStep(-1);
    };
    addEventListener("keydown", k); return () => removeEventListener("keydown", k);
  }, [p.onClose, p.onStep]);
  const c = t.colors;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-3 sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && p.onClose()}>
      <div role="dialog" aria-modal="true" aria-label={`${themeCode(t)} ${t.name}`} className="card flex h-[min(860px,calc(100vh-24px))] w-full max-w-6xl flex-col overflow-hidden shadow-2xl">
        <div className="flex flex-wrap items-center gap-3 border-b border-ink-700 px-4 py-3">
          <span className="rounded-lg bg-brand-500 px-2.5 py-1 font-mono text-sm font-bold text-white">{themeCode(t)}</span>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-extrabold">{t.signature && <span className="mr-1 text-brand-400">★</span>}{t.name}</h2>
            <p className="line-clamp-2 text-xs text-ink-400 sm:line-clamp-none">{t.tags.join(" · ")}{t.blurb ? ` · ${t.blurb}` : ""}</p>
          </div>
          <div className="flex items-center gap-1" aria-label="Colours">{[c.bg, c.surface, c.text, c.c1, c.c2, c.c3].map((x, i) => <span key={i} className="h-5 w-5 rounded-full border border-white/20" style={{ background: x }} title={x} />)}</div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-ink-600 p-0.5" role="group" aria-label="Preview as">
              {KINDS.filter((k) => (k.id === "business") === t.id.startsWith("biz-")).map((k) => <button key={k.id} type="button" aria-pressed={p.kind === k.id} onClick={() => p.setKind(k.id)} className={`rounded-md px-3 py-1.5 text-xs font-bold ${p.kind === k.id ? "bg-ink-700 text-ink-100" : "text-ink-400"}`}>{k.label}</button>)}
            </div>
            <button type="button" className="btn btn-sm" onClick={p.onCopyId}>Copy ID</button>
            <button type="button" className="btn btn-sm" onClick={p.onCopyLink}>Copy link</button>
            <button type="button" className={`btn btn-sm ${p.starred ? "border-amber-400 text-amber-300" : ""}`} aria-pressed={p.starred} onClick={p.onStar}>{p.starred ? "★ Shortlisted" : "☆ Shortlist"}</button>
            <button type="button" className="icon-btn" aria-label="Previous theme" onClick={() => p.onStep(-1)}>‹</button>
            {p.pos && <span className="text-xs tabular-nums text-ink-400">{p.pos}</span>}
            <button type="button" className="icon-btn" aria-label="Next theme" onClick={() => p.onStep(1)}>›</button>
            <button type="button" className="icon-btn" aria-label="Close" onClick={p.onClose}>✕</button>
          </div>
        </div>
        {p.sample ? (
          <Preview key={t.id + p.kind} tpl={TEMPLATES[p.kind]} base={`templates/${p.kind}/`} content={withTheme(p.sample, p.kind, t)} version={v} assets={{}} />
        ) : <div className="grid flex-1 place-items-center text-ink-400">Loading preview…</div>}
        <p className="border-t border-ink-700 px-4 py-2 text-xs text-ink-400">Sample content shown. Your own text, photos and products replace it. To choose this design, quote <b className="text-ink-200">{themeCode(t)} · {t.name}</b>.</p>
      </div>
    </div>
  );
}
