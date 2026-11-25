import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { StepLoader } from "./kit";

/** A full-screen progress bar over a public page until it has finished loading, then it fades away. `done` = steps finished. */
export function LoadVeil({ title, steps, done }: { title: string; steps: string[]; done: number }) {
  const finished = done >= steps.length;
  const [gone, setGone] = useState(false);
  useEffect(() => { if (!finished) return; const t = setTimeout(() => setGone(true), 450); return () => clearTimeout(t); }, [finished]);
  if (gone) return null;
  return <div aria-hidden={finished} className={`fixed inset-0 z-[90] grid place-items-center bg-ink-950 transition-opacity duration-500 ${finished ? "pointer-events-none opacity-0" : "opacity-100"}`}><StepLoader title={title} steps={steps} at={done} /></div>;
}

const trap = (e: Event) => e.preventDefault();
/** Is the browser's developer tools window open? A paused `debugger` takes long only while it is; the logged element's getter runs only while the console is open. */
function devtoolsOpen(): boolean {
  let hit = false;
  try {
    const t = performance.now(); new Function("debugger")(); if (performance.now() - t > 80) hit = true;
    const el = new Image(); Object.defineProperty(el, "id", { get() { hit = true; return ""; } }); console.log(el);
  } catch { /* not detectable here */ }
  return hit;
}

/**
 * On the public Themes and Design yourself pages: the right-click menu and the shortcuts that open the developer tools are blocked,
 * and while the tools are open the page is hidden behind a "Restricted" notice. This discourages casual copying; it can't stop a
 * determined person (nothing running in a browser can), so nothing secret must ever be on these pages.
 */
export function DevtoolsGuard() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (e.key === "F12" || ((e.ctrlKey || e.metaKey) && e.shiftKey && ["i", "j", "c", "k"].includes(k)) || ((e.ctrlKey || e.metaKey) && ["u", "s"].includes(k)) || (e.metaKey && e.altKey && ["i", "j", "c", "u"].includes(k))) { e.preventDefault(); e.stopPropagation(); }
    };
    addEventListener("contextmenu", trap, true); addEventListener("keydown", key, true);
    const check = () => setOpen(devtoolsOpen());
    check(); const t = setInterval(check, 1000);
    return () => { removeEventListener("contextmenu", trap, true); removeEventListener("keydown", key, true); clearInterval(t); };
  }, []);
  // The page itself goes blank while the tools are open.
  useEffect(() => {
    const root = document.getElementById("root"); if (!root) return;
    root.style.visibility = open ? "hidden" : "";
    return () => { root.style.visibility = ""; };
  }, [open]);
  if (!open) return null;
  return createPortal(
    <div role="alert" className="fixed inset-0 z-[2147483000] grid place-items-center bg-ink-950/90 backdrop-blur-2xl">
      <div className="flex flex-col items-center gap-3 px-6 text-center text-ink-100">
        <span className="grid h-16 w-16 place-items-center rounded-full border-2 border-red-400/70 text-4xl font-black text-red-300" aria-hidden>!</span>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Restricted</h1>
        <p className="max-w-xs text-sm text-ink-300">Close the developer tools to see this page.</p>
      </div>
    </div>, document.body);
}
