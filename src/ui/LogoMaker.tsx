import { useEffect, useMemo, useState } from "react";

/** The in-house logo maker: a business name becomes a set of clean marks (a monogram in a shape, or the name as a wordmark) in the
 *  brand colour. Everything is drawn here on a canvas: no AI, no outside service, no waiting. Tapping one hands it over as a PNG file
 *  with a see-through background, like an uploaded logo. */

const FONTS: [id: string, label: string, stack: string, weight: number][] = [
  ["sans", "Modern", "'Manrope','Inter',system-ui,-apple-system,'Segoe UI',Arial,sans-serif", 800],
  ["serif", "Classic", "Georgia,'Times New Roman',serif", 700],
  ["round", "Friendly", "'Nunito','Quicksand','Trebuchet MS',system-ui,sans-serif", 800],
  ["mono", "Technical", "'JetBrains Mono','Courier New',monospace", 700],
];
const SKIP = new Set(["the", "and", "of", "for", "a", "an", "&", "by", "in", "at"]);
/** One or two letters for a name: the first letters of its first two words that matter ("The Green Leaf Cafe" gives GL). */
export function initialsOf(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s&]/gu, " ").split(/\s+/).filter((w) => w && !SKIP.has(w.toLowerCase()));
  if (!words.length) return "";
  const one = (w: string) => [...w][0].toUpperCase();
  return words.length === 1 ? one(words[0]) : one(words[0]) + one(words[1]);
}
const lum = (hex: string) => { const n = parseInt(hex.slice(1), 16), v = [n >> 16 & 255, n >> 8 & 255, n & 255].map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
const mix = (hex: string, to: number, by: number) => { const n = parseInt(hex.slice(1), 16), c = [n >> 16 & 255, n >> 8 & 255, n & 255].map((x) => Math.round(x + (to - x) * by)); return "#" + c.map((x) => x.toString(16).padStart(2, "0")).join(""); };

type Draw = { ctx: CanvasRenderingContext2D; S: number; ini: string; name: string; col: string; on: string; font: string; weight: number };
const text = (d: Draw, t: string, x: number, y: number, size: number, fill: string, maxW?: number, align: CanvasTextAlign = "center") => {
  const c = d.ctx; c.fillStyle = fill; c.textAlign = align; c.textBaseline = "alphabetic";
  let s = size; c.font = `${d.weight} ${s}px ${d.font}`;
  if (maxW) { const w = c.measureText(t).width; if (w > maxW) { s = Math.max(10, s * maxW / w); c.font = `${d.weight} ${s}px ${d.font}`; } }
  // centred on the letters' own height, so capitals sit in the middle of a shape
  const m = c.measureText(t), up = m.actualBoundingBoxAscent || s * 0.72, down = m.actualBoundingBoxDescent || 0;
  c.fillText(t, x, y + (up - down) / 2);
};
const rr = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
const poly = (c: CanvasRenderingContext2D, cx: number, cy: number, r: number, n: number, rot = -Math.PI / 2) => { c.beginPath(); for (let i = 0; i < n; i++) { const a = rot + (i * 2 * Math.PI) / n; c[i ? "lineTo" : "moveTo"](cx + r * Math.cos(a), cy + r * Math.sin(a)); } c.closePath(); };

/** The marks. Each fills a square canvas of side S, leaving the background see-through. */
const MARKS: [id: string, label: string, draw: (d: Draw) => void][] = [
  ["circle", "Circle", (d) => { const { ctx: c, S } = d; c.fillStyle = d.col; c.beginPath(); c.arc(S / 2, S / 2, S * 0.46, 0, 7); c.fill(); text(d, d.ini, S / 2, S / 2, S * 0.42, d.on, S * 0.62); }],
  ["square", "Rounded square", (d) => { const { ctx: c, S } = d; c.fillStyle = d.col; rr(c, S * 0.06, S * 0.06, S * 0.88, S * 0.88, S * 0.2); c.fill(); text(d, d.ini, S / 2, S / 2, S * 0.44, d.on, S * 0.64); }],
  ["ring", "Ring", (d) => { const { ctx: c, S } = d; c.strokeStyle = d.col; c.lineWidth = S * 0.055; c.beginPath(); c.arc(S / 2, S / 2, S * 0.43, 0, 7); c.stroke(); text(d, d.ini, S / 2, S / 2, S * 0.4, d.col, S * 0.56); }],
  ["hex", "Hexagon", (d) => { const { ctx: c, S } = d; c.fillStyle = d.col; poly(c, S / 2, S / 2, S * 0.48, 6); c.fill(); text(d, d.ini, S / 2, S / 2, S * 0.38, d.on, S * 0.56); }],
  ["diamond", "Diamond", (d) => { const { ctx: c, S } = d; c.save(); c.translate(S / 2, S / 2); c.rotate(Math.PI / 4); c.fillStyle = d.col; rr(c, -S * 0.32, -S * 0.32, S * 0.64, S * 0.64, S * 0.1); c.fill(); c.restore(); text(d, d.ini, S / 2, S / 2, S * 0.34, d.on, S * 0.46); }],
  ["split", "Two tone", (d) => { const { ctx: c, S } = d, x = S * 0.06, w = S * 0.88; c.save(); rr(c, x, x, w, w, S * 0.2); c.clip(); c.fillStyle = d.col; c.fillRect(0, 0, S, S); c.fillStyle = mix(d.col, lum(d.col) > 0.4 ? 0 : 255, 0.22); c.beginPath(); c.moveTo(S, 0); c.lineTo(S, S); c.lineTo(0, S); c.closePath(); c.fill(); c.restore(); text(d, d.ini, S / 2, S / 2, S * 0.44, d.on, S * 0.64); }],
  ["badge", "Badge and name", (d) => { const { ctx: c, S } = d; c.fillStyle = d.col; c.beginPath(); c.arc(S / 2, S * 0.36, S * 0.3, 0, 7); c.fill(); text(d, d.ini, S / 2, S * 0.36, S * 0.28, d.on, S * 0.4); text(d, d.name, S / 2, S * 0.83, S * 0.15, d.col, S * 0.92); }],
  ["word", "Name only", (d) => { const { ctx: c, S } = d; text(d, d.name, S / 2, S * 0.46, S * 0.24, d.col, S * 0.94); const w = Math.min(S * 0.94, c.measureText(d.name).width); c.fillStyle = mix(d.col, lum(d.col) > 0.4 ? 0 : 255, 0.3); rr(c, S / 2 - w / 2, S * 0.64, w * 0.38, S * 0.035, S * 0.017); c.fill(); }],
];

const paint = (S: number, mark: (typeof MARKS)[number], o: Omit<Draw, "ctx" | "S">) => { const cv = document.createElement("canvas"); cv.width = cv.height = S; const ctx = cv.getContext("2d")!; mark[2]({ ctx, S, ...o }); return cv; };

export function LogoMaker({ name, color = "#3b82f6", disabled, onUse }: { name: string; color?: string; disabled?: boolean; onUse: (f: File) => void | Promise<void> }) {
  const [nm, setNm] = useState(name.trim().slice(0, 40)), [ini, setIni] = useState(() => initialsOf(name)), [touched, setTouched] = useState(false);
  const start = /^#[0-9a-f]{6}$/i.test(color) ? color : "#3b82f6";
  const [col, setCol] = useState(start), [font, setFont] = useState("sans"), [ready, setReady] = useState(0);
  useEffect(() => { if (!touched) setIni(initialsOf(nm)); }, [nm, touched]);
  // drawn again once the page's fonts have arrived, so the marks use them
  useEffect(() => { let on = true; (document as any).fonts?.ready?.then(() => on && setReady((n) => n + 1)); return () => { on = false; }; }, []);
  const F = FONTS.find((f) => f[0] === font) || FONTS[0];
  const opts = { ini: (ini || "?").slice(0, 3), name: nm.trim() || "Your name", col, on: lum(col) > 0.5 ? "#14161a" : "#ffffff", font: F[2], weight: F[3] };
  const shots = useMemo(() => MARKS.map((m) => ({ m, u: paint(240, m, opts).toDataURL("image/png") })), [opts.ini, opts.name, col, font, ready]); // eslint-disable-line react-hooks/exhaustive-deps
  const use = (m: (typeof MARKS)[number]) => paint(1024, m, opts).toBlob((b) => { if (b) onUse(new File([b], `logo-${m[0]}.png`, { type: "image/png" })); }, "image/png");
  // The brand colour first, then a few that suit most businesses; "Other" opens the full picker.
  const swatches = [...new Set([start, "#2563eb", "#0f9d6b", "#dc2626", "#f59e0b", "#7c3aed", "#db2777", "#111827"].map((c) => c.toLowerCase()))].slice(0, 8);
  const lab = "flex min-w-0 flex-col gap-1.5 text-[12px] font-semibold text-ink-300";
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-ink-700 bg-ink-900/60 p-4" role="group" aria-label="Logo maker">
      <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_5.5rem_minmax(0,10rem)]">
        <label className={lab}>Name on the logo<input className="input h-[46px]" maxLength={40} disabled={disabled} value={nm} onChange={(e) => setNm(e.target.value)} placeholder="Your business name" /></label>
        <label className={lab}>Letters<input className="input h-[46px] text-center font-bold uppercase tracking-wide" maxLength={3} disabled={disabled} value={ini} onChange={(e) => { setTouched(true); setIni(e.target.value.toUpperCase()); }} /></label>
        <label className={lab}>Lettering<select className="input h-[46px]" disabled={disabled} value={font} onChange={(e) => setFont(e.target.value)}>{FONTS.map((f) => <option key={f[0]} value={f[0]}>{f[1]}</option>)}</select></label>
      </div>
      <div className={lab} role="group" aria-label="Logo colour"><span>Colour</span>
        <div className="flex flex-wrap items-center gap-2">
          {swatches.map((c) => <button key={c} type="button" disabled={disabled} aria-label={`Use the colour ${c}`} aria-pressed={col.toLowerCase() === c} onClick={() => setCol(c)}
            className={`h-8 w-8 flex-none rounded-full border-2 transition hover:scale-110 disabled:opacity-50 ${col.toLowerCase() === c ? "border-ink-100 ring-2 ring-brand-400" : "border-white/70 shadow-sm"}`} style={{ background: c }} />)}
          <label className={`relative inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold transition hover:border-brand-400 ${swatches.includes(col.toLowerCase()) ? "border-ink-600 text-ink-300" : "border-brand-400 text-ink-100"}`}>
            <span aria-hidden className="h-4 w-4 rounded-full border border-white/70" style={{ background: swatches.includes(col.toLowerCase()) ? "conic-gradient(#f43f5e,#f59e0b,#84cc16,#06b6d4,#6366f1,#d946ef,#f43f5e)" : col }} />Other
            <input type="color" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" disabled={disabled} value={col} onChange={(e) => setCol(e.target.value)} aria-label="Another logo colour" />
          </label>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-8" role="group" aria-label="Logos made from your name">
        {shots.map(({ m, u }) => <button key={m[0]} type="button" disabled={disabled || !nm.trim()} aria-label={`Use the ${m[1].toLowerCase()} logo`} onClick={() => use(m)}
          className="group flex flex-col overflow-hidden rounded-2xl border border-ink-700 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400 disabled:opacity-50 disabled:hover:translate-y-0">
          <span className="grid aspect-square place-items-center p-3" style={{ background: "radial-gradient(circle at 50% 40%,#ffffff,#f1f3f7)" }}><img src={u} alt="" className="h-full max-h-28 w-auto object-contain transition group-hover:scale-105" /></span>
          <span className="truncate border-t border-black/10 bg-white px-2 py-1.5 text-center text-[11px] font-semibold text-[#1c2230] transition group-hover:bg-brand-500 group-hover:text-white">{m[1]}</span>
        </button>)}
      </div>
      <p className="m-0 text-[11.5px] text-ink-400">Made here from your name: tap one to use it. Nothing is sent anywhere, and a designer can refine your final logo later.</p>
    </div>
  );
}
