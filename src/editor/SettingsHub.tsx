// "All settings": the editor's menu opened out into a large panel. The main groups are tiles; a tile opens a pop-up with
// what is inside it in the same tiles (a sub-group such as "Sections" opens the same way); a setting's tile goes to it.

import { useEffect, useMemo, useRef, useState } from "react";

export type HubItem = { id: string; label: string; sub?: string; desc?: string };
export type HubGroup = { group: string; items: HubItem[] };

const initials = (s: string) => { const w = s.replace(/&/g, " ").split(/\s+/).filter(Boolean); return ((w[0]?.[0] || "") + (w.length > 1 ? w[1][0] : w[0]?.[1] || "")).toUpperCase(); };
const GRID = "grid grid-cols-[repeat(auto-fill,minmax(128px,1fr))] gap-3";

function Tile({ label, note, here, more, onClick, focus }: { label: string; note?: string; here?: boolean; more?: boolean; onClick: () => void; focus?: boolean }) {
  return (
    <button type="button" autoFocus={focus} onClick={onClick} aria-current={here && !more ? "page" : undefined} aria-haspopup={more ? "dialog" : undefined}
      className={`group flex min-h-[112px] flex-col items-start gap-2 rounded-xl border p-3 text-left transition hover:-translate-y-0.5 hover:border-brand-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 ${here ? "border-brand-500 bg-brand-500/10" : "border-ink-600 bg-ink-950"}`}>
      <span aria-hidden className={`grid h-9 w-9 flex-none place-items-center rounded-lg text-[12.5px] font-extrabold ${here ? "bg-brand-500 text-white" : "bg-ink-800 text-ink-200 group-hover:bg-brand-500/20"}`}>{initials(label)}</span>
      <span className="text-[13.5px] font-bold leading-snug text-ink-100">{label}</span>
      {note && <span className="mt-auto text-[11.5px] text-ink-400">{note}{more ? " ›" : ""}</span>}
    </button>
  );
}

export function SettingsHub({ groups, cur, onPick, onClose }: { groups: HubGroup[]; cur: string; onPick: (id: string) => void; onClose: () => void }) {
  const [path, setPath] = useState<string[]>([]), [q, setQ] = useState(""), box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key !== "Escape") return; e.stopPropagation(); if (q) setQ(""); else if (path.length) setPath(path.slice(0, -1)); else onClose(); };
    addEventListener("keydown", key, true); return () => removeEventListener("keydown", key, true);
  }, [path, q, onClose]);
  const n = (k: number, one = "setting") => `${k} ${one}${k === 1 ? "" : "s"}`;
  const group = groups.find((g) => g.group === path[0]);
  const found = useMemo(() => { const s = q.trim().toLowerCase(); return s ? groups.flatMap((g) => g.items.filter((i) => (i.label + " " + (i.sub || "") + " " + g.group).toLowerCase().includes(s)).map((i) => ({ ...i, where: [g.group, i.sub].filter(Boolean).join(" › ") }))) : null; }, [q, groups]);
  // what a group's pop-up holds: its own settings, and one tile for each sub-group
  const inside = (g: HubGroup, sub?: string) => {
    if (sub) return g.items.filter((i) => i.sub === sub).map((i) => ({ kind: "item" as const, i }));
    const out: ({ kind: "item"; i: HubItem } | { kind: "sub"; name: string; items: HubItem[] })[] = [];
    for (const i of g.items) { if (!i.sub) out.push({ kind: "item", i }); else if (!out.some((x) => x.kind === "sub" && x.name === i.sub)) out.push({ kind: "sub", name: i.sub, items: g.items.filter((x) => x.sub === i.sub) }); }
    return out;
  };
  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center bg-ink-950/80 p-3 pt-[8vh] backdrop-blur-sm sm:p-8 sm:pt-[10vh]" role="dialog" aria-modal="true" aria-label="All settings" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={box} className="card flex max-h-full w-full max-w-4xl flex-col overflow-hidden shadow-2xl">
        <div className="flex flex-none flex-wrap items-center gap-3 border-b border-ink-700 p-4">
          <h2 className="mr-auto text-lg font-extrabold">All settings</h2>
          <input type="search" className="input w-full py-2 text-[14px] sm:w-64" aria-label="Find a setting" placeholder="Find a setting" value={q} onChange={(e) => setQ(e.target.value)} />
          <button type="button" className="btn btn-sm" onClick={onClose}>Close</button>
        </div>
        <div className="scroll-thin flex-1 overflow-y-auto p-4">
          {found ? (found.length ? <div className={GRID} aria-label="Found">{found.map((i) => <Tile key={i.id} label={i.label} note={i.where} here={i.id === cur} onClick={() => onPick(i.id)} />)}</div> : <p className="text-sm text-ink-400">Nothing matches “{q}”.</p>)
            : <div className={GRID} aria-label="Groups">{groups.map((g, k) => <Tile key={g.group} focus={k === 0} label={g.group} note={n(g.items.length)} more here={g.items.some((i) => i.id === cur)} onClick={() => setPath([g.group])} />)}</div>}
        </div>
      </div>
      {group && !found && (
        <div className="fixed inset-0 z-[91] flex items-center justify-center bg-ink-950/60 p-3 sm:p-10" onMouseDown={(e) => { if (e.target === e.currentTarget) setPath([]); }}>
          <div className="card flex max-h-full w-full max-w-3xl flex-col overflow-hidden shadow-2xl" role="dialog" aria-modal="true" aria-label={path.join(" › ")}>
            <div className="flex flex-none items-center gap-2 border-b border-ink-700 p-4">
              <button type="button" className="btn btn-sm px-2.5" aria-label="Back" onClick={() => setPath(path.slice(0, -1))}>‹</button>
              <h3 className="mr-auto flex min-w-0 flex-wrap items-center gap-1.5 text-[15px] font-extrabold">
                <button type="button" className="text-ink-400 hover:text-ink-100" onClick={() => setPath([])}>All settings</button><span aria-hidden className="text-ink-500">›</span>
                {path[1] ? <><button type="button" className="text-ink-400 hover:text-ink-100" onClick={() => setPath([path[0]])}>{path[0]}</button><span aria-hidden className="text-ink-500">›</span><span>{path[1]}</span></> : <span>{path[0]}</span>}
              </h3>
              <button type="button" className="btn btn-sm" onClick={onClose}>Close</button>
            </div>
            <div className={`scroll-thin overflow-y-auto p-4 ${GRID}`} key={path.join("/")}>
              {inside(group, path[1]).map((x, k) => x.kind === "item"
                ? <Tile key={x.i.id} focus={k === 0} label={x.i.label} here={x.i.id === cur} onClick={() => onPick(x.i.id)} />
                : <Tile key={"sub:" + x.name} focus={k === 0} label={x.name} note={n(x.items.length, path[0] === "Pages" && x.name === "Sections" ? "section" : "setting")} more here={x.items.some((i) => i.id === cur)} onClick={() => setPath([path[0], x.name])} />)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
