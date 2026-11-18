import type { CSSProperties } from "react";
import type { Theme } from "./catalog";

const LAYOUT: Record<string, string> = { split: "Split hero", center: "Centred hero", editorial: "Big headline", panel: "Dark panel", full: "Photo hero", poster: "Poster hero", framed: "Framed photo", side: "Half-and-half", collage: "Photo collage" };
const MENU: Record<string, string> = { classic: "classic menu", cards: "photo-card menu", list: "list menu", board: "chalkboard menu", paper: "printed-card menu", tiles: "boxed menu", magazine: "magazine menu", tabs: "tabbed menu" };
/** One line about a restaurant theme, e.g. "Photo hero · chalkboard menu". */
export const restLine = (t: Theme) => { const r = (t as any).rest || {}; return (LAYOUT[t.style.layout] || t.style.layout) + " · " + (MENU[r.menuStyle] || "menu"); };

const SERIF = /serif|Garamond|Playfair|Fraunces|Prata|Bodoni|Baskerville|Cinzel|Marcellus|Italiana|Spectral|Lora|Yeseva|Abril|Philosopher/i;

/** A restaurant theme in miniature: its menu bar, hero layout, picture frame and food-menu style, in its colours. */
export function RestSwatch({ t }: { t: Theme }) {
  const c = t.colors, s = t.style, R = (t as any).rest || {}, r = Math.min(t.radius, 14) / 2;
  const lay = s.layout, darkHero = lay === "poster" || lay === "panel", photo = lay === "full" || lay === "framed";
  const serif = s.heading === "serif" || SERIF.test(t.display);
  const grad = "linear-gradient(135deg," + c.c1 + "," + c.c2 + ")";
  const btn: CSSProperties = {
    background: s.buttons === "outline" || s.buttons === "underline" ? "transparent" : c.c1,
    border: s.buttons === "underline" ? "none" : "1px solid " + c.c1, borderBottom: "2px solid " + c.c1,
    borderRadius: s.buttons === "pill" ? 99 : s.buttons === "sharp" || s.buttons === "underline" ? 0 : 3,
  };
  const round = s.heroArt === "circle" || s.heroArt === "blob";
  const frame: CSSProperties = {
    background: grad, width: round ? 30 : "100%", height: round ? 30 : "92%",
    borderRadius: s.heroArt === "arch" ? "99px 99px 3px 3px" : s.heroArt === "circle" ? "50%" : s.heroArt === "blob" ? "58% 42% 47% 53%/48% 55% 45% 52%" : r,
    transform: s.heroArt === "tilt" ? "rotate(4deg)" : undefined,
    boxShadow: s.heroArt === "offset" ? "3px 3px 0 " + c.c3 : s.heroArt === "tilt" ? "0 0 0 2px " + c.surface : undefined,
    outline: s.heroArt === "frame" ? "1px solid " + c.line : undefined, outlineOffset: 2,
  };
  const centered = lay === "center" || lay === "poster" || lay === "editorial";
  const onCard = lay === "framed";
  const fg = onCard ? c.text : darkHero || photo ? "#fff" : c.text;
  const words = (
    <div className={"flex min-w-0 flex-1 flex-col justify-center gap-[3px] " + (centered ? "items-center text-center" : "")} style={onCard ? { background: c.surface, padding: 3, borderRadius: r, flex: "0 0 58%", alignSelf: "flex-end" } : undefined}>
      <span className="block max-w-full truncate text-[11.5px] leading-[1.05]" style={{ color: fg, fontFamily: serif ? "Georgia,serif" : undefined, fontWeight: s.heading === "light" || s.heading === "serif" ? 500 : 800, textTransform: s.heading === "upper" ? "uppercase" : undefined }}>{t.name}</span>
      <span className="block h-[2px] w-9 rounded" style={{ background: fg, opacity: 0.45 }} />
      <span className="block h-[7px] w-9" style={btn} />
    </div>
  );
  // The food menu in miniature: rows with a dotted line, cards, boxes, a board or a centred card.
  const m = R.menuStyle as string, onBoard = m === "board";
  const row = (w: number, k: number) => (
    <span key={k} className="flex items-center gap-[2px]">
      <i className="block h-[2px] rounded" style={{ width: w, background: onBoard ? "#ffffffcc" : c.text, opacity: 0.75 }} />
      <i className="block h-0 flex-1" style={{ borderBottom: "1px dotted " + (onBoard ? "#ffffff88" : c.soft) }} />
      <i className="block h-[2px] w-[5px] rounded" style={{ background: onBoard ? c.c3 : c.c1 }} />
    </span>
  );
  const two = m === "classic" || m === "tabs" || m === "board";
  const menu = m === "cards" || m === "tiles" ? (
    <div className="grid flex-1 grid-cols-3 gap-[2px]">
      {[0, 1, 2].map((i) => <i key={i} className="block" style={{ background: m === "cards" ? (i === 1 ? c.c2 : c.c1) : "transparent", opacity: m === "cards" ? 0.75 : 1, border: "1px solid " + c.line, borderRadius: m === "cards" ? r / 2 : 0 }} />)}
    </div>
  ) : (
    <div className={"flex-1 content-center " + (m === "paper" ? "mx-auto w-1/2 px-1" : "")}
      style={{ display: "grid", gridTemplateColumns: two ? "1fr 1fr" : "1fr", columnGap: 6, rowGap: 3, alignContent: "center", background: onBoard ? c.deep : m === "paper" ? c.surface : "transparent", border: m === "paper" ? "1px solid " + c.line : undefined, borderRadius: onBoard ? r : 0, padding: onBoard ? "2px 4px" : undefined }}>
      {(two ? [9, 7, 8, 10] : [12, 9]).map(row)}
    </div>
  );
  const navDark = s.nav === "dark", mid = s.nav === "stack" || s.nav === "split" || s.nav === "center";
  const edge = R.divider && R.divider !== "none" ? "1.5px " + (R.divider === "zigzag" || R.divider === "torn" ? "dashed" : R.divider === "scallop" || R.divider === "wave" ? "dotted" : "solid") + " " + c.c1 : undefined;
  return (
    <div className="relative flex h-[84px] flex-col overflow-hidden" style={{ background: c.bg }}>
      <div className={"flex h-[11px] flex-none items-center px-1.5 " + (mid ? "justify-center gap-2" : "justify-between")} style={{ background: navDark ? c.deep : "transparent", borderBottom: s.nav === "line" || s.nav === "stack" ? "1px solid " + c.line : undefined }}>
        <span className="flex items-center gap-[3px]"><i className="block h-[5px] w-[5px] rounded-full" style={{ background: c.c1 }} /><i className="block h-[2.5px] w-5 rounded" style={{ background: navDark ? "#ffffffcc" : c.text }} /></span>
        {!mid && <span className="flex items-center gap-[3px]">{[0, 1, 2].map((i) => <i key={i} className="block h-[2px] w-2 rounded" style={{ background: navDark ? "#ffffff88" : c.soft, opacity: 0.7 }} />)}<i className="ml-[2px] block h-[5px] w-4" style={{ ...btn, borderWidth: 1 }} /></span>}
      </div>
      {lay === "side" ? (
        <div className="mt-[3px] flex h-[40px] flex-none"><div className="flex min-w-0 flex-1 items-center px-1.5">{words}</div><i className="block w-1/2 flex-none" style={{ background: grad }} /></div>
      ) : (
        <div className={"relative mx-1 mt-[3px] flex h-[40px] flex-none gap-1.5 overflow-hidden p-1 " + (centered ? "flex-col items-center justify-center" : "")} style={{ background: darkHero ? c.deep : photo ? grad : "transparent", borderRadius: lay === "panel" || lay === "framed" ? r : 0 }}>
          {words}
          {!centered && !photo && (lay === "collage" ? (
            <span className="grid w-[38%] flex-none grid-cols-2 grid-rows-2 gap-[2px]"><i className="row-span-2 block" style={{ background: c.c1, borderRadius: r / 2 }} /><i className="block" style={{ background: c.c2, borderRadius: r / 2 }} /><i className="block" style={{ background: c.c3, borderRadius: r / 2 }} /></span>
          ) : (
            <span className="flex w-[36%] flex-none items-center justify-center"><i className="block" style={frame} /></span>
          ))}
        </div>
      )}
      <div className="mx-1.5 mb-1 mt-[3px] flex min-h-0 flex-1" style={{ borderTop: edge, paddingTop: 2 }}>{menu}</div>
    </div>
  );
}
