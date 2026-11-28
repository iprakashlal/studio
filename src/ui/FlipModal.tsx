// A card that turns over into a window: the project card the button sits on flips in 3D while it grows to the middle of
// the screen, and its back is the window. Closing turns it back and shrinks it into the card again. Without a card to
// start from, or for anyone who asks their device for less motion, the window simply appears.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Box = { left: number; top: number; width: number; height: number };
const MS = 620;
/** The window's place: in the middle, as tall as what it holds (want), never taller than the screen. */
const target = (want = 440): Box => {
  const w = Math.min(720, innerWidth - 24), h = Math.min(innerHeight - 48, Math.max(240, want));
  return { left: (innerWidth - w) / 2, top: Math.max(24, (innerHeight - h) / 2), width: w, height: h };
};

export function FlipModal({ from, title, head, onClose, children, footer }: {
  /** The card that opens it: it is hidden while the window is open, and its look is the window's front. */
  from: HTMLElement | null; title: string; /** The window's top part, under the close button. */ head: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode;
}) {
  const still = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const start = useRef<Box | null>(from ? (() => { const r = from.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; })() : null);
  const [box, setBox] = useState<Box>(start.current && !still ? start.current : target());
  const [open, setOpen] = useState(!start.current || still), [leaving, setLeaving] = useState(false);
  const front = useRef<HTMLDivElement>(null), closeBtn = useRef<HTMLButtonElement>(null);
  const headEl = useRef<HTMLDivElement>(null), bodyEl = useRef<HTMLDivElement>(null), footEl = useRef<HTMLDivElement>(null);
  /** How tall the window wants to be for what it holds now. */
  const want = () => (headEl.current?.offsetHeight || 0) + (bodyEl.current?.scrollHeight || 0) + 34 + (footEl.current?.offsetHeight || 0);

  // The front face is a copy of the card, so the turn starts from exactly what was on screen.
  useLayoutEffect(() => {
    if (!from || !front.current) return;
    const c = from.cloneNode(true) as HTMLElement; c.removeAttribute("id"); c.style.cssText += ";margin:0;width:100%;height:100%;visibility:visible;pointer-events:none";
    c.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
    front.current.replaceChildren(c);
    const was = from.style.visibility; from.style.visibility = "hidden";
    return () => { from.style.visibility = was; };
  }, [from]);
  useEffect(() => {
    if (open) { closeBtn.current?.focus(); return; }
    const r = requestAnimationFrame(() => requestAnimationFrame(() => { setBox(target(want())); setOpen(true); }));
    return () => cancelAnimationFrame(r);
  }, []);
  // It grows and shrinks with what it holds (a tab changes, a list loads), and with the screen.
  useEffect(() => {
    if (!open || leaving) return;
    const f = () => setBox(target(want())); f();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(f) : null; if (bodyEl.current) ro?.observe(bodyEl.current);
    addEventListener("resize", f); return () => { ro?.disconnect(); removeEventListener("resize", f); };
  }, [open, leaving]);
  useEffect(() => { if (open && !leaving) { const t = setTimeout(() => closeBtn.current?.focus(), still ? 0 : MS); return () => clearTimeout(t); } }, [open]);

  const close = () => {
    if (leaving) return;
    if (still || !start.current || !from) return onClose();
    const r = from.getBoundingClientRect();
    setLeaving(true); setOpen(false); setBox({ left: r.left, top: r.top, width: r.width, height: r.height });
    setTimeout(onClose, MS);
  };
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && close(); addEventListener("keydown", k); return () => removeEventListener("keydown", k); });

  const turn = still ? "none" : `transform ${MS}ms cubic-bezier(.2,.8,.2,1), left ${MS}ms cubic-bezier(.2,.8,.2,1), top ${MS}ms cubic-bezier(.2,.8,.2,1), width ${MS}ms cubic-bezier(.2,.8,.2,1), height ${MS}ms cubic-bezier(.2,.8,.2,1)`;
  return createPortal(
    <div className="fixed inset-0 z-[200]" onMouseDown={(e) => e.target === e.currentTarget && close()} style={{ background: open ? "rgb(0 0 0 / .6)" : "rgb(0 0 0 / 0)", backdropFilter: open ? "blur(4px)" : "none", transition: still ? "none" : `background ${MS}ms, backdrop-filter ${MS}ms` }}>
      <div style={{ position: "fixed", ...px(box), perspective: 1800, transition: turn, pointerEvents: "none" }}>
        <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", transform: open ? "rotateY(180deg)" : "rotateY(0deg)", transition: turn }}>
          {/* front: the card as it was */}
          <div ref={front} aria-hidden style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", overflow: "hidden", borderRadius: 24 }} />
          {/* back: the window */}
          <div role="dialog" aria-modal="true" aria-label={title} className="card flex flex-col overflow-hidden rounded-2xl shadow-2xl"
            style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)", pointerEvents: open ? "auto" : "none" }}>
            <div ref={headEl} className="relative shrink-0 border-b border-ink-700 bg-gradient-to-br from-brand-500/15 via-transparent to-transparent px-5 pb-4 pt-4">
              <button ref={closeBtn} type="button" className="icon-btn absolute right-3 top-3" onClick={close} aria-label="Close">✕</button>
              {head}
            </div>
            <div className="scroll-thin min-h-0 flex-1 overflow-auto px-5 py-4"><div ref={bodyEl} className="flex flex-col gap-4">{children}</div></div>
            {footer && <div ref={footEl} className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-ink-700 px-5 py-3">{footer}</div>}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
const px = (b: Box) => ({ left: b.left + "px", top: b.top + "px", width: b.width + "px", height: b.height + "px" });
