// Foldable cards: wrap a page in <FoldCards> and every `section.card` with a heading (h2/h3) gets a heading that
// opens and closes it (click, Enter or Space), with a chevron. Each card's state is remembered in this browser.
// Cards are open until folded. New cards (shown later) are picked up too.
import { useEffect, useRef, type ReactNode } from "react";

const KEY = "studio-fold:";
const store = {
  get: (k: string) => { try { return localStorage.getItem(KEY + k); } catch { return null; } },
  set: (k: string, closed: boolean) => { try { closed ? localStorage.setItem(KEY + k, "1") : localStorage.removeItem(KEY + k); } catch { /* private mode */ } },
};

function setUp(sec: HTMLElement, scope: string) {
  if (sec.dataset.foldReady) return;
  const head = [...sec.children].find((c) => /^H[23]$/.test(c.tagName)) as HTMLElement | undefined;
  if (!head) return;
  sec.dataset.foldReady = "1";
  const key = scope + ":" + (sec.getAttribute("aria-label") || head.textContent || "").trim().slice(0, 60);
  head.dataset.foldHead = "1";
  head.setAttribute("role", "button"); head.tabIndex = 0;
  const apply = (closed: boolean) => { sec.dataset.fold = closed ? "closed" : "open"; head.setAttribute("aria-expanded", String(!closed)); };
  apply(store.get(key) === "1");
  const toggle = () => { const closed = sec.dataset.fold !== "closed"; apply(closed); store.set(key, closed); };
  head.addEventListener("click", (e) => { if ((e.target as HTMLElement).closest("a,button,input,select,textarea,label") && e.target !== head) return; toggle(); });
  head.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
  (sec as any).__fold = (closed: boolean) => { apply(closed); store.set(key, closed); };
}

export function FoldCards({ scope, children, className = "" }: { scope: string; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    // Top-level cards only (not cards inside cards).
    const scan = () => el.querySelectorAll<HTMLElement>("section.card").forEach((s) => { if (!s.parentElement?.closest("section.card")) setUp(s, scope); });
    scan();
    const mo = new MutationObserver(scan); mo.observe(el, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [scope]);
  return <div ref={ref} className={`fold-cards flex flex-col gap-4 ${className}`}>{children}</div>;
}

/** Folds or opens every card in the nearest FoldCards on the page. */
export function FoldAll() {
  const all = (closed: boolean) => document.querySelectorAll<HTMLElement>(".fold-cards section.card[data-fold-ready]").forEach((s) => (s as any).__fold?.(closed));
  return (
    <div className="flex gap-2 self-end text-[12.5px]">
      <button type="button" className="text-ink-400 underline hover:text-ink-100" onClick={() => all(true)}>Collapse all</button>
      <button type="button" className="text-ink-400 underline hover:text-ink-100" onClick={() => all(false)}>Expand all</button>
    </div>
  );
}
