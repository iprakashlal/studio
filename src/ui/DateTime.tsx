import { useEffect, useRef, useState } from "react";

/** A date and a time picked inside an ordinary field, drawn with the Studio's own controls (the browser's pickers can't be styled). */

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const parse = (v: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v); return m ? { y: +m[1], m: +m[2] - 1, d: +m[3] } : null; };
export const dateLong = (v: string) => { const p = parse(v); return p ? new Date(p.y, p.m, p.d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" }) : ""; };

const Cal = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>;
const Clock = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>;
const Chev = ({ left }: { left?: boolean }) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={left ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} /></svg>;

/** The field itself: it looks and sizes like any other field, shows the answer (or a hint), and opens its picker underneath. */
function Shell({ label, shown, hint, icon, bare, small, autoFocus, children }: { label: string; shown: string; hint: string; icon: JSX.Element; bare?: boolean; small?: boolean; autoFocus?: boolean; children: (close: () => void) => JSX.Element }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null), btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const out = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); btn.current?.focus(); } };
    document.addEventListener("mousedown", out); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", out); document.removeEventListener("keydown", esc); };
  }, [open]);
  const close = () => { setOpen(false); btn.current?.focus(); };
  return (
    <div ref={box} className="flex min-w-0 flex-1 flex-col gap-2">
      <button ref={btn} type="button" autoFocus={autoFocus} aria-label={label} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between gap-3 text-left ${bare ? "bg-transparent py-2.5 text-[15px] outline-none" : `input ${small ? "h-10 py-0 text-[14px]" : ""} ${open ? "border-brand-500 ring-2 ring-brand-500/25" : ""}`}`}>
        <span className={`min-w-0 truncate ${shown ? "text-ink-100" : "text-ink-500"}`}>{shown || hint}</span>
        <span className={open ? "text-brand-400" : "text-ink-400"}>{icon}</span>
      </button>
      {open && <div role="dialog" aria-label={label} className="w-full max-w-[21rem] rounded-2xl border border-ink-700 bg-ink-900 p-3 shadow-xl">{children(close)}</div>}
    </div>
  );
}
const navBtn = "grid h-8 w-8 place-items-center rounded-full text-ink-300 transition hover:bg-ink-800 hover:text-ink-100";
const pickSel = "cursor-pointer rounded-lg bg-transparent px-1.5 py-1 text-sm font-semibold text-ink-100 outline-none transition hover:bg-ink-800 focus-visible:ring-2 focus-visible:ring-brand-500/40";
const foot = "rounded-full px-3 py-1.5 text-xs font-semibold transition";

/** A date chosen from a month calendar. Holds "2027-02-14"; shows "Sun, 14 February 2027". */
export function DateField({ value, onChange, label, bare, small, autoFocus }: { value: string; onChange: (v: string) => void; label: string; bare?: boolean; small?: boolean; autoFocus?: boolean }) {
  const sel = parse(value), now = new Date(), today = iso(now.getFullYear(), now.getMonth(), now.getDate());
  const [view, setView] = useState(() => ({ y: sel?.y ?? now.getFullYear(), m: sel?.m ?? now.getMonth() }));
  useEffect(() => { if (sel) setView({ y: sel.y, m: sel.m }); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  const go = (n: number) => setView((v) => { const d = new Date(v.y, v.m + n, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  const first = (new Date(view.y, view.m, 1).getDay() + 6) % 7, count = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  const years = Array.from({ length: 12 }, (_, i) => now.getFullYear() - 1 + i); if (!years.includes(view.y)) years.push(view.y), years.sort();
  return (
    <Shell label={label} shown={dateLong(value)} hint="Choose a date" icon={<Cal />} bare={bare} small={small} autoFocus={autoFocus}>{(close) => (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1">
          <button type="button" className={navBtn} aria-label="Previous month" onClick={() => go(-1)}><Chev left /></button>
          <div className="flex flex-1 items-center justify-center gap-1">
            <select aria-label="Month" className={pickSel} value={view.m} onChange={(e) => setView((v) => ({ ...v, m: +e.target.value }))}>{MONTHS.map((x, i) => <option key={x} value={i}>{x}</option>)}</select>
            <select aria-label="Year" className={pickSel} value={view.y} onChange={(e) => setView((v) => ({ ...v, y: +e.target.value }))}>{years.map((y) => <option key={y}>{y}</option>)}</select>
          </div>
          <button type="button" className={navBtn} aria-label="Next month" onClick={() => go(1)}><Chev /></button>
        </div>
        <div className="grid grid-cols-7 text-center text-[11px] font-bold uppercase tracking-wider text-ink-500" aria-hidden>{DAYS.map((d) => <span key={d} className="py-1">{d}</span>)}</div>
        <div className="grid grid-cols-7 gap-y-0.5" role="grid" aria-label={`${MONTHS[view.m]} ${view.y}`}>
          {cells.map((d, i) => { if (!d) return <span key={i} />; const v = iso(view.y, view.m, d), on = v === value, td = v === today;
            return <button key={i} type="button" aria-label={dateLong(v)} aria-pressed={on} onClick={() => { onChange(v); close(); }}
              className={`mx-auto grid h-9 w-9 place-items-center rounded-full text-sm tabular-nums transition ${on ? "bg-brand-500 font-semibold text-white shadow" : td ? "font-semibold text-brand-400 ring-1 ring-inset ring-brand-400/60 hover:bg-brand-500/15" : "text-ink-200 hover:bg-ink-800"}`}>{d}</button>; })}
        </div>
        <div className="flex items-center justify-between border-t border-ink-700 pt-2">
          <button type="button" className={`${foot} text-ink-400 hover:bg-ink-800 hover:text-ink-100`} disabled={!value} onClick={() => { onChange(""); close(); }}>Clear</button>
          <button type="button" className={`${foot} text-brand-400 hover:bg-brand-500/15`} onClick={() => { onChange(today); close(); }}>Today</button>
        </div>
      </div>
    )}</Shell>
  );
}

/** A time chosen from an hour, the minutes and am / pm, so it can only be a real time. Holds and shows "9:30 am". */
export function TimeField({ value, onChange, label, bare, small, autoFocus }: { value: string; onChange: (v: string) => void; label: string; bare?: boolean; small?: boolean; autoFocus?: boolean }) {
  const m = /^(\d{1,2}):(\d{2})\s*(am|pm)$/i.exec(value.trim()), h = m ? m[1] : "", mi = m ? m[2] : "00", ap = m ? m[3].toLowerCase() : "am";
  const put = (H: string, M: string, A: string) => onChange(`${H || "12"}:${M} ${A}`);
  const cell = (on: boolean) => `grid h-9 place-items-center rounded-full text-sm tabular-nums transition ${on ? "bg-brand-500 font-semibold text-white shadow" : "text-ink-200 hover:bg-ink-800"}`;
  const head = "text-[11px] font-bold uppercase tracking-wider text-ink-500";
  return (
    <Shell label={label} shown={m ? `${h}:${mi} ${ap}` : ""} hint="Choose a time" icon={<Clock />} bare={bare} small={small} autoFocus={autoFocus}>{(close) => (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between"><span className={head}>Hour</span>
          <span className="inline-flex rounded-full bg-ink-800 p-0.5" role="radiogroup" aria-label="am or pm">{["am", "pm"].map((x) => <button key={x} type="button" role="radio" aria-checked={ap === x} className={`rounded-full px-3 py-1 text-xs font-semibold transition ${ap === x ? "bg-brand-500 text-white shadow" : "text-ink-300 hover:text-ink-100"}`} onClick={() => put(h, mi, x)}>{x}</button>)}</span>
        </div>
        <div className="grid grid-cols-6 gap-1" role="group" aria-label="Hour">{Array.from({ length: 12 }, (_, i) => String(i + 1)).map((x) => <button key={x} type="button" aria-pressed={h === x} className={cell(h === x)} onClick={() => put(x, mi, ap)}>{x}</button>)}</div>
        <span className={head}>Minutes</span>
        <div className="grid grid-cols-6 gap-1" role="group" aria-label="Minutes">{Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0")).map((x) => <button key={x} type="button" aria-pressed={!!m && mi === x} className={cell(!!m && mi === x)} onClick={() => put(h, x, ap)}>{x}</button>)}</div>
        <div className="flex items-center justify-between border-t border-ink-700 pt-2">
          <button type="button" className={`${foot} text-ink-400 hover:bg-ink-800 hover:text-ink-100`} disabled={!value} onClick={() => { onChange(""); close(); }}>Clear</button>
          <button type="button" className={`${foot} bg-brand-500 text-white hover:bg-brand-600`} onClick={close}>Done</button>
        </div>
      </div>
    )}</Shell>
  );
}
