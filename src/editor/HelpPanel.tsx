import { tourPref, useTourPref } from "../ui/Tour";

/** Settings → Help: the quick tour that opens when someone signs in to the admin, and how to bring it back. */
export function HelpPanel() {
  const on = useTourPref();
  return (
    <section className="card flex flex-col gap-3 p-4 sm:p-5" aria-label="Quick tour">
      <h3 className="text-[15px] font-extrabold">Quick tour</h3>
      <p className="text-sm text-ink-300">A few short pop-ups that show where things are: the menu, where you edit, the live preview, and how to save and publish. It opens when you sign in. Press <b className="text-ink-100">Skip tour</b> or <b className="text-ink-100">Done</b> and it stays off.</p>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-brand-500" checked={on} onChange={(e) => tourPref.set(e.target.checked)} /><span>Show the quick tour when I sign in</span></label>
      <div><button type="button" className="btn btn-sm" onClick={() => tourPref.replay()}>Play the tour now</button></div>
      <p className="hint">This choice is kept on this device. Hover over a button for what it does.</p>
    </section>
  );
}
