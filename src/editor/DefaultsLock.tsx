// A part of the editor whose settings come from the Studio's Project defaults: a switch to use them (the fields then
// show the Studio's values and can't be changed here) or to make this site's own (the fields open, starting from them).
import { useId, type ReactNode } from "react";
import { PD_LABEL, applySection, setFollow, type PdId } from "../lib/projdefaults";
import { Toggle } from "../ui/kit";

export function DefaultsLock({ root, secs, onChange, children, site, quiet }: { root: any; secs: PdId[]; onChange: () => void; children: ReactNode | ((use: boolean) => ReactNode); site?: boolean; /** The switch is already shown higher up the page (another card of the same section). */ quiet?: boolean }) {
  const id = useId();
  const given: PdId[] = Array.isArray(root?.studioDefaults?.on) ? root.studioDefaults.on : [];
  const mine = secs.filter((s) => given.includes(s));
  if (!mine.length) return <>{typeof children === "function" ? children(false) : children}</>;
  const use = mine.every((s) => root?.defaultsOff?.[s] !== true);
  const names = mine.map((s) => PD_LABEL[s]).join(" and ");
  const body = typeof children === "function" ? children(use) : use ? <fieldset disabled className="flex min-w-0 flex-col gap-4 opacity-60" aria-label={`${names}: set by the Studio`}>{children}</fieldset> : children;
  const flip = (v: boolean) => { for (const s of mine) setFollow(root, s, v); if (v) for (const s of mine) applySection(root, s); onChange(); };
  if (quiet) return <div className="flex min-w-0 flex-col gap-4" data-defaults-quiet={mine.join(" ")}>{body}</div>;
  // The site's own admin page: only the Studio decides, so no switch here. What the Studio sets is shown locked with a
  // line saying so; a section the Studio let this site keep is simply its own.
  if (site) return use ? (
    <div className="flex flex-col gap-3" data-defaults-site={mine.join(" ")}>
      <p className="flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-900/60 px-3 py-2 text-[12.5px] text-ink-400"><span aria-hidden>🔒</span>{names}: set by your website's provider for every site of this type. Ask them if you need it changed.</p>
      {body}
    </div>
  ) : <>{body}</>;
  return (
    <div className="flex flex-col gap-4" data-defaults={mine.join(" ")}>
      <div className={`flex flex-col gap-1.5 rounded-xl border p-2 ${use ? "border-brand-400/40 bg-brand-500/10" : "border-ink-700"}`}>
        <Toggle id={id} checked={use} onChange={flip} label={`Use the Studio's default · ${names}`} />
        <span className="px-1 text-[12.5px] text-ink-400">{use ? "Set by Settings → Project defaults for every site of this type, and locked in the site's own admin page. Switch off to let this site have its own." : `This site uses its own, and its admin page can edit it. Switch on to go back to the Studio's default (it replaces what is here).`}</span>
      </div>
      {body}
    </div>
  );
}

/** A run of fields set by the Studio: shown, not editable. */
export function Locked({ children }: { children: ReactNode }) {
  return <fieldset disabled className="flex min-w-0 flex-col gap-4 rounded-lg opacity-60" title="Set by the Studio's default">{children}</fieldset>;
}
