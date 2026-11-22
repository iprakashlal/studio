// The editor's menu as an expandable drawer: one row per main group, each with an icon. A group opens a list beside it
// (like a right-click menu: an icon and a name per row); a sub-group such as "Sections" opens its own list beside that.
// Narrow, the drawer is a rail of icons; wide, it also shows the names and where you are.

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

export type DrawerItem = { id: string; label: string; sub?: string };
export type DrawerGroup = { group: string; items: DrawerItem[] };

/* Small line icons, drawn here (24 × 24, stroke). Chosen by words in the name; anything unmatched gets a plain page. */
const P: Record<string, ReactNode> = {
  palette: <><path d="M12 3a9 9 0 1 0 0 18c1.2 0 2-.9 2-2 0-.6-.2-1-.5-1.4-.3-.4-.5-.8-.5-1.3 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4c0-4.1-4-7.5-9-7.5Z" /><circle cx="7.5" cy="11" r="1" /><circle cx="10.5" cy="7.5" r="1" /><circle cx="15" cy="7.8" r="1" /></>,
  page: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" /><path d="M14 3v5h5" /></>,
  pages: <><rect x="8" y="3" width="12" height="15" rx="2" /><path d="M16 18v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2" /></>,
  bag: <><path d="M5 8h14l-1 12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1Z" /><path d="M9 8V7a3 3 0 0 1 6 0v1" /></>,
  inbox: <><path d="M4 13 6.5 5h11L20 13v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z" /><path d="M4 13h4.5l1 2h5l1-2H20" /></>,
  spark: <path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.9L12 18.5l-1.8-5.8L4.5 10.8 10.2 9ZM18.5 16l.6 1.8 1.9.7-1.9.6-.6 1.9-.6-1.9-1.9-.6 1.9-.7Z" />,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" /></>,
  folder: <path d="M4 7a2 2 0 0 1 2-2h3.5l2 2H18a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />,
  code: <path d="m9 8-4 4 4 4M15 8l4 4-4 4M13.5 6l-3 12" />,
  layout: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 9.5h16M9.5 9.5V20" /></>,
  image: <><rect x="4" y="5" width="16" height="14" rx="2" /><circle cx="9" cy="10" r="1.5" /><path d="m5 17 4.5-4 3 2.5 3-3L20 16" /></>,
  list: <path d="M9 7h10M9 12h10M9 17h10M5 7h.01M5 12h.01M5 17h.01" />,
  rows: <><rect x="4" y="5" width="16" height="5" rx="1.5" /><rect x="4" y="14" width="16" height="5" rx="1.5" /></>,
  star: <path d="m12 4 2.4 5 5.4.7-4 3.8 1 5.5-4.8-2.7L7.2 19l1-5.5-4-3.8 5.4-.7Z" />,
  book: <><path d="M5 5.5A1.5 1.5 0 0 1 6.5 4H19v14H6.5A1.5 1.5 0 0 0 5 19.5Z" /><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3" /></>,
  tag: <><path d="M4 5.5V11l8.6 8.6a1.4 1.4 0 0 0 2 0l5-5a1.4 1.4 0 0 0 0-2L11 4H5.5A1.5 1.5 0 0 0 4 5.5Z" /><circle cx="8" cy="8" r="1.2" /></>,
  people: <><circle cx="9" cy="9" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 6.5a2.5 2.5 0 0 1 0 5M17 14.5a4.5 4.5 0 0 1 3.5 4.5" /></>,
  calendar: <><rect x="4" y="5.5" width="16" height="14.5" rx="2" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></>,
  chat: <path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-7l-4.5 4v-4H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />,
  cart: <><path d="M3.5 5h2.2l2 9.5h9.6L19.5 8H7" /><circle cx="9.5" cy="18.5" r="1.3" /><circle cx="16.5" cy="18.5" r="1.3" /></>,
  help: <><circle cx="12" cy="12" r="8.5" /><path d="M9.8 9.7a2.3 2.3 0 1 1 3.3 2.1c-.7.4-1.1.9-1.1 1.7M12 16.5h.01" /></>,
  horn: <path d="M4 10v4h3l7 4V6l-7 4Zm13-1.5a4 4 0 0 1 0 7" />,
  play: <><rect x="4" y="5.5" width="16" height="13" rx="2.5" /><path d="m10.5 9.5 4 2.5-4 2.5Z" /></>,
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1" />,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  pin: <><path d="M12 21s6.5-5.6 6.5-10.5a6.5 6.5 0 0 0-13 0C5.5 15.4 12 21 12 21Z" /><circle cx="12" cy="10.5" r="2.3" /></>,
  card: <><rect x="3.5" y="6" width="17" height="12" rx="2" /><path d="M3.5 10h17M7 14.5h3.5" /></>,
  truck: <><path d="M3.5 6.5h10v9.5h-10ZM13.5 10h3.5l3.5 3v3h-7Z" /><circle cx="7.5" cy="17.5" r="1.5" /><circle cx="16.5" cy="17.5" r="1.5" /></>,
  gift: <><rect x="4.5" y="10" width="15" height="10" rx="1.5" /><path d="M3.5 7h17v3h-17ZM12 7v13M12 7c-1-3-5-3.5-5-1s3 1 5 1Zm0 0c1-3 5-3.5 5-1s-3 1-5 1Z" /></>,
  mail: <><rect x="3.5" y="5.5" width="17" height="13" rx="2" /><path d="m4 7 8 6 8-6" /></>,
  phone: <><rect x="7" y="3" width="10" height="18" rx="2.5" /><path d="M11 17.5h2" /></>,
  shield: <path d="M12 3.5 5 6v5.5c0 4.3 3 7.5 7 9 4-1.5 7-4.7 7-9V6Z" />,
  search: <><circle cx="11" cy="11" r="6" /><path d="m15.5 15.5 4.5 4.5" /></>,
  globe: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.5 2.5 3.5 5.5 3.5 8.5s-1 6-3.5 8.5c-2.5-2.5-3.5-5.5-3.5-8.5S9.5 6 12 3.5Z" /></>,
  plug: <path d="M9 3.5V8M15 3.5V8M6.5 8h11v3.5a5.5 5.5 0 0 1-11 0ZM12 17v3.5" />,
  chart: <path d="M4.5 19.5h15M7.5 16v-4M12 16V7M16.5 16v-6.5" />,
  type: <path d="M5 6.5V5h14v1.5M12 5v14M9.5 19h5" />,
  fork: <path d="M7 3.5v6a2 2 0 0 0 4 0v-6M9 11.5V20.5M16.5 3.5c-1.5 1-2.5 3-2.5 5.5s1 3.5 2.5 3.5V20.5" />,
};
const WORDS: [RegExp, string][] = [
  [/^orders & guests$/i, "inbox"], [/^menu & dishes$/i, "fork"], [/^online ordering$/i, "bag"], [/^website pages$/i, "pages"], [/^hours & contact$/i, "clock"], [/^look & feel$/i, "palette"], [/^email & chat$/i, "mail"], [/^dish stock$|^inventory$/i, "list"], [/^table bookings/i, "calendar"], [/^guest quotes$|^guest reviews$/i, "star"],
  [/^design$|theme|brand|colou?r/i, "palette"], [/layout/i, "layout"], [/^pages$|custom page/i, "pages"], [/^selling$|product|shop|cart|checkout/i, "bag"], [/order(?!$)|ordering/i, "cart"], [/forms? ?&? ?records|enquir|inbox|purchased/i, "inbox"],
  [/^features$|highlight|ai\b|engine/i, "spark"], [/^settings$|admin/i, "gear"], [/^project$/i, "folder"], [/code/i, "code"], [/hero|gallery|photo|picture|logo/i, "image"], [/sections & order|^sections$/i, "rows"],
  [/sub-menus|navigation/i, "list"], [/menu|dish|food|restaurant/i, "fork"], [/signature|review|rating|featured/i, "star"], [/story|about|blog/i, "book"], [/offer|coupon|pricing|discount/i, "tag"], [/team|customer|people/i, "people"],
  [/event|booking|catering|hours|opening/i, "calendar"], [/faq|help/i, "help"], [/call to action|announce/i, "horn"], [/video/i, "play"], [/social|link/i, "link"], [/address|contact|location/i, "pin"], [/payment|gateway/i, "card"],
  [/delivery|shipping/i, "truck"], [/points|gift|loyal/i, "gift"], [/email/i, "mail"], [/whatsapp|sms|backend/i, "phone"], [/legal|privacy/i, "shield"], [/seo|search/i, "search"], [/domain|language|hosting/i, "globe"], [/connect|integration/i, "plug"],
  [/analytic|report|stat/i, "chart"], [/font|text|footer/i, "type"], [/form/i, "chat"], [/time|clock/i, "clock"],
];
export function NavIcon({ name, className = "h-[18px] w-[18px]" }: { name: string; className?: string }) {
  const k = (WORDS.find(([re]) => re.test(name)) || [, "page"])[1] as string;
  return <svg aria-hidden viewBox="0 0 24 24" className={`flex-none ${className}`} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{P[k]}</svg>;
}
const Chevron = () => <svg aria-hidden viewBox="0 0 24 24" className="h-[14px] w-[14px] flex-none text-ink-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>;

type Row = { kind: "item"; i: DrawerItem } | { kind: "sub"; name: string; items: DrawerItem[] };
const rowsOf = (items: DrawerItem[]): Row[] => { const out: Row[] = []; for (const i of items) { if (!i.sub) out.push({ kind: "item", i }); else if (!out.some((x) => x.kind === "sub" && x.name === i.sub)) out.push({ kind: "sub", name: i.sub, items: items.filter((x) => x.sub === i.sub) }); } return out; };

/** One opened list, placed beside what opened it and kept inside the window. */
function Flyout({ at, label, children }: { at: DOMRect; label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null), [pos, setPos] = useState({ left: at.right + 14, top: at.top - 6 });
  useLayoutEffect(() => { const el = ref.current; if (!el) return; const h = el.offsetHeight, w = el.offsetWidth; setPos({ left: Math.max(8, Math.min(at.right + 14, innerWidth - w - 8)), top: Math.max(8, Math.min(at.top - 6, innerHeight - h - 8)) }); }, [at]);
  return <div ref={ref} role="menu" aria-label={label} data-nav-flyout className="scroll-thin fixed z-[70] flex max-h-[calc(100vh-16px)] w-64 flex-col gap-0.5 overflow-y-auto rounded-xl border border-ink-600 bg-ink-900 p-1.5 shadow-2xl" style={pos}>{children}</div>;
}
const ROW = "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-[13.5px] font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60";

export function NavDrawer({ groups, cur, wide, onWide, onPick }: { groups: DrawerGroup[]; cur?: string; wide: boolean; onWide: (v: boolean) => void; onPick: (id: string) => void }) {
  const [open, setOpen] = useState<{ group: string; at: DOMRect } | null>(null), [sub, setSub] = useState<{ name: string; at: DOMRect } | null>(null);
  const shut = () => { setOpen(null); setSub(null); };
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { const t = e.target as HTMLElement; if (!t.closest?.("[data-nav-flyout], [data-nav-group]")) shut(); };
    const key = (e: KeyboardEvent) => { if (e.key !== "Escape") return; if (sub) setSub(null); else shut(); };
    addEventListener("mousedown", down); addEventListener("keydown", key); addEventListener("resize", shut); addEventListener("blur", shut); // (blur: a click in the live preview, which is its own frame)
    return () => { removeEventListener("mousedown", down); removeEventListener("keydown", key); removeEventListener("resize", shut); removeEventListener("blur", shut); };
  }, [open, sub]);
  const g = groups.find((x) => x.group === open?.group), here = (items: DrawerItem[]) => items.some((i) => i.id === cur), go = (id: string) => { shut(); onPick(id); };
  return (
    <div className="flex flex-col gap-1" aria-label="Settings drawer">
      <button type="button" className={`mb-1 flex items-center gap-3 rounded-lg px-2.5 py-2 text-[12px] font-semibold text-ink-400 hover:bg-ink-800 hover:text-ink-100 ${wide ? "" : "justify-center"}`} aria-label={wide ? "Make the menu narrow" : "Make the menu wide"} aria-pressed={wide} title={wide ? "Make the menu narrow" : "Make the menu wide"} onClick={() => { shut(); onWide(!wide); }}>
        <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px] flex-none" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="5" width="17" height="14" rx="2" /><path d="M9 5v14" />{wide ? <path d="m15.5 10-2 2 2 2" /> : <path d="m13.5 10 2 2-2 2" />}</svg>{wide && <span>Collapse</span>}
      </button>
      {groups.map((x) => { const on = open?.group === x.group, mine = here(x.items), at = x.items.find((i) => i.id === cur); return (
        <button key={x.group} type="button" data-nav-group aria-haspopup="menu" aria-expanded={on} title={wide ? undefined : x.group} aria-label={wide ? undefined : x.group}
          onClick={(e) => { setSub(null); setOpen(on ? null : { group: x.group, at: e.currentTarget.getBoundingClientRect() }); }}
          className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-left transition ${wide ? "" : "justify-center"} ${on ? "bg-ink-800 text-ink-100" : mine ? "bg-brand-500/15 text-ink-100" : "text-ink-300 hover:bg-ink-800 hover:text-ink-100"}`}>
          <NavIcon name={x.group} className="h-5 w-5" />
          {wide && <><span className="min-w-0 flex-1"><span className="block truncate text-[13.5px] font-bold">{x.group}</span>{at && <span className="block truncate text-[11.5px] font-medium text-ink-400">{at.label}</span>}</span><Chevron /></>}
        </button>
      ); })}
      {open && g && (
        <Flyout at={open.at} label={g.group}>
          <div className="px-2.5 pb-1 pt-1.5 text-[10.5px] font-bold uppercase tracking-widest text-ink-500">{g.group}</div>
          {rowsOf(g.items).map((r) => r.kind === "item"
            ? <button key={r.i.id} type="button" role="menuitem" aria-current={r.i.id === cur ? "page" : undefined} onMouseEnter={() => setSub(null)} onClick={() => go(r.i.id)} className={`${ROW} ${r.i.id === cur ? "bg-brand-500/15 text-ink-100" : "text-ink-200 hover:bg-ink-800 hover:text-ink-100"}`}><NavIcon name={r.i.label} /><span className="min-w-0 flex-1 truncate">{r.i.label}</span></button>
            : <button key={"sub:" + r.name} type="button" role="menuitem" aria-haspopup="menu" aria-expanded={sub?.name === r.name} onMouseEnter={(e) => setSub({ name: r.name, at: e.currentTarget.getBoundingClientRect() })} onClick={(e) => setSub({ name: r.name, at: e.currentTarget.getBoundingClientRect() })} className={`${ROW} ${sub?.name === r.name ? "bg-ink-800 text-ink-100" : here(r.items) ? "bg-brand-500/15 text-ink-100" : "text-ink-200 hover:bg-ink-800 hover:text-ink-100"}`}><NavIcon name={r.name} /><span className="min-w-0 flex-1 truncate">{r.name}</span><span className="text-[11px] text-ink-500">{r.items.length}</span><Chevron /></button>)}
        </Flyout>
      )}
      {open && g && sub && (
        <Flyout at={sub.at} label={g.group + " › " + sub.name}>
          {g.items.filter((i) => i.sub === sub.name).map((i) => <button key={i.id} type="button" role="menuitem" aria-current={i.id === cur ? "page" : undefined} onClick={() => go(i.id)} className={`${ROW} ${i.id === cur ? "bg-brand-500/15 text-ink-100" : "text-ink-200 hover:bg-ink-800 hover:text-ink-100"}`}><NavIcon name={i.label} /><span className="min-w-0 flex-1 truncate">{i.label}</span></button>)}
        </Flyout>
      )}
    </div>
  );
}
