import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { MARK_URI } from "./logo";

// ---------- toasts ----------
type ToastCtx = (msg: string, tone?: "ok" | "bad") => void;
const ToastContext = createContext<ToastCtx>(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastHost({ children }: { children: ReactNode }) {
  const [t, setT] = useState<{ msg: string; tone: "ok" | "bad"; id: number } | null>(null);
  const timer = useRef<number>();
  const show = useCallback<ToastCtx>((msg, tone = "ok") => {
    setT({ msg, tone, id: Date.now() });
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setT(null), 3200);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-0 z-[300] flex justify-center px-4 pb-[max(20px,env(safe-area-inset-bottom))]">
        {t && (
          <div key={t.id} className={`pointer-events-auto max-w-lg rounded-xl px-4 py-2.5 text-sm font-semibold shadow-2xl ${t.tone === "bad" ? "bg-red-500 text-white" : "bg-ink-100 text-ink-950"}`}>{t.msg}</div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

// ---------- modal ----------
export function Modal({ title, onClose, children, wide, footer }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean; footer?: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[200] grid place-items-center bg-black/60 px-4 py-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`card flex max-h-[calc(100vh-48px)] w-full flex-col overflow-hidden shadow-2xl ${wide ? "max-w-2xl" : "max-w-md"}`}>
        <div className="flex items-center justify-between gap-3 border-b border-ink-700 px-5 py-4">
          <h2 className="text-base font-extrabold">{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="scroll-thin flex flex-col gap-4 overflow-auto px-5 py-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-ink-700 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

// ---------- confirm ----------
type ConfirmReq = { title: string; body: string; ok: string; danger?: boolean; resolve: (v: boolean) => void };
const ConfirmContext = createContext<(title: string, body: string, ok?: string, danger?: boolean) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(ConfirmContext);

export function ConfirmHost({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<ConfirmReq | null>(null);
  const ask = useCallback((title: string, body: string, ok = "Confirm", danger = false) => new Promise<boolean>((resolve) => setReq({ title, body, ok, danger, resolve })), []);
  const done = (v: boolean) => {
    req?.resolve(v);
    setReq(null);
  };
  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      {req && (
        <Modal title={req.title} onClose={() => done(false)} footer={<><button className="btn" onClick={() => done(false)}>Cancel</button><button autoFocus className={req.danger ? "btn btn-danger" : "btn btn-pri"} onClick={() => done(true)}>{req.ok}</button></>}>
          <p className="text-sm text-ink-300">{req.body}</p>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}

// ---------- small pieces ----------
export function Field({ label, htmlFor, hint, children, warn }: { label: string; htmlFor?: string; hint?: string; children: ReactNode; warn?: string }) {
  return (
    <div data-field className="flex min-w-0 flex-col gap-1.5 rounded-lg">
      <label className="label" htmlFor={htmlFor}>{label}</label>
      {children}
      {warn ? <span className="text-xs text-amber-300">{warn}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

export function Toggle({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className="relative flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-ink-600 bg-ink-950 px-3 py-2.5">
      <span className="text-sm font-semibold">{label}</span>
      <input id={id} type="checkbox" className="peer sr-only left-0 top-0" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span aria-hidden className="relative h-[22px] w-10 flex-none rounded-full bg-ink-600 transition peer-checked:bg-brand-500 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-400 after:absolute after:left-[3px] after:top-[3px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-[18px]" />
    </label>
  );
}

export function Spinner({ label }: { label?: string }) {
  // After two seconds, a seconds counter shows it's still working.
  const [s, setS] = useState(0);
  useEffect(() => { const t0 = Date.now(), i = setInterval(() => setS(Math.floor((Date.now() - t0) / 1000)), 500); return () => clearInterval(i); }, []);
  return (
    <div className="flex items-center gap-3 text-sm text-ink-300" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-500 border-t-brand-400" />
      {label}{s >= 2 && <span className="font-mono text-xs text-ink-500">{s}s</span>}
    </div>
  );
}

/** A page load in steps: a percentage counter, a progress bar, and what is happening now. */
export function StepLoader({ title, steps, at, detail }: { title: string; steps: string[]; at: number; detail?: string }) {
  // Each finished step counts fully; the current one creeps forward (up to 90% of its share) while it runs.
  const share = 100 / Math.max(1, steps.length), floor = Math.min(100, at * share);
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setPct((p) => { const cap = at >= steps.length ? 100 : floor + share * 0.9; const target = Math.max(p, floor); return Math.min(cap, target + (cap - target) * 0.08 + (target < floor ? 0 : 0.2)); }), 60);
    return () => clearInterval(i);
  }, [at, steps.length]);
  const n = Math.round(Math.max(pct, floor));
  return (
    <div className="flex w-[min(420px,calc(100vw-48px))] flex-col gap-3" role="status" aria-live="polite">
      <div className="flex items-end justify-between gap-3">
        <span className="flex items-center gap-2.5 text-[15px] font-extrabold text-ink-100"><Logo size={10} />{title}</span>
        <span className="font-mono text-2xl font-bold tabular-nums text-ink-100" aria-label={`${n} percent`}>{n}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-ink-700"><div className="h-full rounded-full bg-brand-400 transition-[width] duration-150" style={{ width: `${n}%` }} /></div>
      <ol className="flex flex-col gap-1 text-[13px]">
        {steps.map((s, i) => (
          <li key={i} className={i < at ? "text-ink-400" : i === at ? "text-ink-100" : "text-ink-600"}>
            <span className="inline-block w-5 font-mono">{i < at ? "✓" : i === at ? "›" : "·"}</span>{s}{i === at && detail ? <span className="text-ink-400"> · {detail}</span> : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function Logo({ size = 12 }: { size?: number }) {
  const h = Math.round(size * 2);
  return (
    <span className="inline-grid flex-none place-items-center rounded-md bg-white shadow-sm" style={{ width: h, height: h }} aria-hidden>
      <img src={MARK_URI} alt="" className="block" style={{ height: Math.round(h * 0.78), width: "auto" }} />
    </span>
  );
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 border-dashed px-6 py-14 text-center">
      <Logo size={16} />
      <h3 className="font-display text-xl font-extrabold">{title}</h3>
      <p className="max-w-md text-sm text-ink-300">{body}</p>
      {action}
    </div>
  );
}
