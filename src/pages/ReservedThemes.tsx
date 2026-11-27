// Settings → Themes → Reserved themes: themes kept for the Studio's own projects and hidden from visitors (the public gallery
// and Design yourself). Two ways to set them, kept in step: theme IDs typed in a box (comma separated), or a switch on each
// theme in a list per type of site, which also says how many of the Studio's projects use each theme.
import { useEffect, useMemo, useState } from "react";
import { THEMES, type Theme } from "../themes/catalog";
import { BIZ_THEMES } from "../themes/business";
import { REST_THEMES } from "../themes/restaurant";
import { EVT_THEMES } from "../themes/events";
import { themeCode } from "../themes/codes";
import type { Studio, StudioIndex } from "../lib/studio";

type Group = { id: string; label: string; list: Theme[]; templates: string[] };
const GROUPS: Group[] = [
  { id: "shared", label: "Portfolio & Shop", list: THEMES, templates: ["portfolio", "store"] },
  { id: "business", label: "Business", list: BIZ_THEMES as Theme[], templates: ["business"] },
  { id: "restaurant", label: "Restaurant & café", list: REST_THEMES as Theme[], templates: ["restaurant"] },
  { id: "events", label: "Event", list: EVT_THEMES as Theme[], templates: ["events"] },
];
const ALL: Theme[] = GROUPS.flatMap((g) => g.list);
const BY_CODE = new Map(ALL.map((t) => [themeCode(t).toUpperCase().replace(/\s+/g, ""), t.id]));
const BY_ID = new Map(ALL.map((t) => [t.id, t]));
const codesOf = (ids: Iterable<string>) => [...ids].map((id) => (BY_ID.get(id) ? themeCode(BY_ID.get(id)!) : id)).join(", ");
/** Typed IDs → theme ids; what wasn't recognised is returned too. A theme's own id (velocity) works as well as its code (T-07). */
function parseCodes(text: string): { ids: string[]; unknown: string[] } {
  const ids: string[] = [], unknown: string[] = [];
  for (const raw of text.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean)) {
    const id = BY_CODE.get(raw.toUpperCase()) || (BY_ID.has(raw) ? raw : BY_ID.has(raw.toLowerCase()) ? raw.toLowerCase() : "");
    if (id) ids.push(id); else unknown.push(raw);
  }
  return { ids: [...new Set(ids)], unknown };
}
const PAGE = 120;
const dots = (t: Theme) => { const c: any = (t as any).colors || {}; return [c.bg, c.c1, c.c2 || c.surface, c.text].filter(Boolean).slice(0, 4) as string[]; };

export function ReservedThemes({ studio, index, saved, onSave }: { studio: Studio; index: StudioIndex; saved: string[]; onSave: (ids: string[]) => Promise<void> }) {
  const [draft, setDraft] = useState<Set<string>>(() => new Set(saved));
  const [text, setText] = useState(() => codesOf(saved)), [typing, setTyping] = useState(false);
  const [g, setG] = useState(GROUPS[0].id), [q, setQ] = useState(""), [show, setShow] = useState<"all" | "shown" | "reserved" | "used">("all"), [n, setN] = useState(PAGE);
  const [busy, setBusy] = useState(false), [open, setOpen] = useState("");
  useEffect(() => { setDraft(new Set(saved)); if (!typing) setText(codesOf(saved)); }, [saved.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!typing) setText(codesOf(draft)); }, [draft, typing]);
  useEffect(() => setN(PAGE), [g, q, show]);

  // Which projects use which theme: each project's content says its theme (read once, a few at a time).
  const [usage, setUsage] = useState<Map<string, { id: string; name: string }[]> | null>(null), [read, setRead] = useState(0);
  useEffect(() => {
    let stop = false; const map = new Map<string, { id: string; name: string }[]>(), list = index.projects.slice(0, 400); let i = 0;
    const next = async (): Promise<void> => { while (!stop && i < list.length) { const p = list[i++]; try { const c = await studio.loadContent(p.id); const th = c?.theme?.preset; if (typeof th === "string" && th) map.set(th, [...(map.get(th) || []), { id: p.id, name: p.name }]); } catch { /* unreadable: left out */ } if (!stop) setRead((x) => x + 1); } };
    void Promise.all(Array.from({ length: 6 }, next)).then(() => { if (!stop) setUsage(map); });
    return () => { stop = true; };
  }, [index.projects.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const grp = GROUPS.find((x) => x.id === g)!;
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return grp.list.filter((t) => (!s || t.name.toLowerCase().includes(s) || themeCode(t).toLowerCase().includes(s) || t.id.includes(s))
      && (show === "all" || (show === "reserved" ? draft.has(t.id) : show === "shown" ? !draft.has(t.id) : !!usage?.get(t.id)?.length)));
  }, [grp, q, show, draft, usage]);
  const countIn = (gr: Group) => gr.list.reduce((a, t) => a + (draft.has(t.id) ? 1 : 0), 0);
  const dirty = [...draft].sort().join(",") !== [...saved].sort().join(",");
  // What was typed and isn't a theme ID stays named until the box is changed again.
  const [unknown, setUnknown] = useState<string[]>([]);
  const flip = (id: string, reserve: boolean) => setDraft((d) => { const x = new Set(d); if (reserve) x.add(id); else x.delete(id); return x; });
  const bulk = (reserve: boolean) => setDraft((d) => { const x = new Set(d); for (const t of list) reserve ? x.add(t.id) : x.delete(t.id); return x; });
  const save = async () => { setBusy(true); try { await onSave([...draft]); } finally { setBusy(false); } };

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Typed: theme IDs, comma separated. */}
      <label className="flex flex-col gap-1.5"><span className="label">Reserved theme IDs (comma separated)</span>
        <textarea className="input min-h-[72px] font-mono text-[13px]" placeholder="e.g. T-07, B-012, R-099" value={text} spellCheck={false}
          onFocus={() => setTyping(true)} onChange={(e) => { const r = parseCodes(e.target.value); setText(e.target.value); setUnknown(r.unknown); setDraft(new Set(r.ids)); }} onBlur={() => { setTyping(false); }} />
        <span className="text-[12px] font-normal text-ink-400">{draft.size ? `${draft.size} reserved` : "None reserved: visitors see every theme."}{unknown.length ? <span className="text-amber-300"> · Not a theme ID, left out: {unknown.slice(0, 8).join(", ")}{unknown.length > 8 ? "…" : ""}</span> : null}</span>
      </label>

      {/* 2. Listed: per type of site, a switch on each theme. */}
      <div className="flex flex-col gap-3 rounded-2xl border border-ink-700 bg-ink-950/40 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="Type of site" className="flex flex-wrap gap-1 rounded-xl bg-ink-900 p-1">
            {GROUPS.map((x) => <button key={x.id} type="button" role="tab" aria-selected={g === x.id} onClick={() => setG(x.id)}
              className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold transition ${g === x.id ? "bg-brand-500 text-white shadow" : "text-ink-300 hover:bg-ink-800"}`}>
              {x.label} <span className={`ml-1 text-[11px] font-medium ${g === x.id ? "text-white/80" : "text-ink-500"}`}>{x.list.length}{countIn(x) ? ` · ${countIn(x)} reserved` : ""}</span></button>)}
          </div>
          <input className="input h-9 min-w-[12rem] flex-1 py-1 text-[13px]" type="search" placeholder="Search by name or ID" aria-label="Search themes" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input h-9 w-auto py-1 text-[13px]" aria-label="Show" value={show} onChange={(e) => setShow(e.target.value as typeof show)}>
            <option value="all">All</option><option value="shown">Shown to visitors</option><option value="reserved">Reserved</option><option value="used">Used by a project</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-400">
          <span>{list.length} theme{list.length === 1 ? "" : "s"}{usage ? "" : ` · counting projects (${read}/${Math.min(index.projects.length, 400)})…`}</span>
          <span className="flex-1" />
          <button type="button" className="btn btn-ghost btn-sm" disabled={!list.length} onClick={() => bulk(true)}>Reserve these {list.length}</button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={!list.length} onClick={() => bulk(false)}>Show these {list.length}</button>
        </div>
        <ul className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(250px,1fr))]">
          {list.slice(0, n).map((t) => {
            const res = draft.has(t.id), used = usage?.get(t.id) || [], code = themeCode(t);
            return (
              <li key={t.id} className={`relative flex items-center gap-3 rounded-xl border px-3 py-2 transition ${res ? "border-amber-400/40 bg-amber-500/5" : "border-ink-700 bg-ink-900/60"}`}>
                <span aria-hidden className="flex h-9 w-9 flex-none flex-wrap overflow-hidden rounded-lg border border-ink-700">{dots(t).map((c, i) => <i key={i} className="h-1/2 w-1/2" style={{ background: c }} />)}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[13px] font-semibold" title={t.name}>{t.name}</span>
                  <span className="flex items-center gap-1.5 text-[11.5px] text-ink-400"><code className="whitespace-nowrap font-mono text-ink-300">{code}</code>
                    {used.length > 0 && <button type="button" className="whitespace-nowrap rounded-full bg-brand-500/15 px-1.5 py-px font-semibold text-brand-300 hover:bg-brand-500/25" aria-expanded={open === t.id} onClick={() => setOpen(open === t.id ? "" : t.id)}>{used.length} project{used.length > 1 ? "s" : ""}</button>}
                    {res && <span className="whitespace-nowrap font-semibold text-amber-300">Reserved</span>}</span>
                </span>
                <button type="button" role="switch" aria-checked={!res} aria-label={`${code} ${t.name}: ${res ? "reserved" : "shown to visitors"}`} title={res ? "Reserved: hidden from visitors" : "Shown to visitors"} onClick={() => flip(t.id, !res)}
                  className={`relative h-6 w-11 flex-none rounded-full transition ${res ? "bg-ink-700" : "bg-emerald-500"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${res ? "left-0.5" : "left-[22px]"}`} /></button>
                {open === t.id && (
                  <div role="dialog" aria-label={`Projects using ${code}`} className="absolute left-2 right-2 top-full z-20 mt-1 flex flex-col gap-1 rounded-xl border border-ink-600 bg-ink-900 p-3 shadow-2xl">
                    <span className="text-[12px] font-semibold text-ink-200">{used.length} project{used.length > 1 ? "s use" : " uses"} {code}{res ? " (they keep it: reserving only hides it from visitors)" : ""}</span>
                    <ul className="flex max-h-40 flex-col gap-0.5 overflow-auto">{used.map((p) => <li key={p.id}><a className="text-[12.5px] text-brand-300 hover:underline" href={`#/p/${p.id}`}>{p.name}</a></li>)}</ul>
                    <button type="button" className="btn btn-ghost btn-sm self-end" onClick={() => setOpen("")}>Close</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {list.length > n && <button type="button" className="btn btn-sm self-center" onClick={() => setN(n + PAGE * 2)}>Show more ({list.length - n} left)</button>}
        {!list.length && <p className="py-4 text-center text-[13px] text-ink-400">No themes match.</p>}
      </div>

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-ink-700 bg-ink-900/95 px-3 py-2 shadow-xl backdrop-blur" hidden={!dirty}>
        <span className="text-[13px] text-ink-200">Unsaved: {draft.size} reserved</span><span className="flex-1" />
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => { setDraft(new Set(saved)); setText(codesOf(saved)); }}>Discard</button>
        <button type="button" className="btn btn-pri btn-sm" disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save"}</button>
      </div>
    </div>
  );
}
