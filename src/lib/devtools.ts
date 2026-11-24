// Notices when the browser's developer tools are opened on a page (used by "Design yourself", so a visitor can't poke
// at the preview's data). A browser can't be stopped from opening them: this is a best-effort check using two signs,
// the window being squeezed by a docked panel and the console reading an object it was handed. It can miss a
// detached panel in some browsers, and it never runs for a signed-in Studio owner.

/** Calls `onOpen` once each time the tools are seen opening. Returns a function that stops watching. */
export function watchDevtools(onOpen: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const touch = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  const dpr0 = window.devicePixelRatio;
  let open = false, gaps = 0;
  const probe = new Image(); let read = false;
  Object.defineProperty(probe, "id", { get() { read = true; return ""; } });
  const check = () => {
    read = false;
    try { console.debug(probe); console.clear?.(); } catch { /* no console */ }
    // A docked panel makes the window much larger than the page area (ignored on phones and when zoomed).
    const squeezed = !touch && window.devicePixelRatio === dpr0 && (window.outerWidth - window.innerWidth > 200 || window.outerHeight - window.innerHeight > 300);
    gaps = squeezed ? gaps + 1 : 0;
    const now = read || gaps >= 2;
    if (now && !open) { open = true; onOpen(); } else if (!now) open = false;
  };
  const t = setInterval(check, 1000);
  const r = () => check();
  addEventListener("resize", r);
  return () => { clearInterval(t); removeEventListener("resize", r); };
}
