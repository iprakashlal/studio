// A part of the editor whose settings come from the Studio's Project defaults: a switch to use them (the fields then
// show the Studio's values and can't be changed here) or to make this site's own (the fields open, starting from them).
import { useId, type ReactNode } from "react";
import { PD_LABEL, applySection, setFollow, type PdId } from "../lib/projdefaults";
import { Toggle } from "../ui/kit";

export function DefaultsLock({ root, secs, onChange, children, site, quiet }: { root: any; secs: PdId[]; onChange: () => void; children: ReactNode; site?: boolean; /** The switch is already shown higher up the page (another card of the same section). */ quiet?: boolean }) {
  const id = useId();
  const given: PdId[] = Array.isArray(root?.studioDefaults?.on) ? root.studioDefaults.on : [];
  const mine = secs.filter((s) => given.includes(s));
  if (!mine.length) return <>{children}</>;
  const use = mine.every((s) => root?.defaultsOff?.[s] !== true);
  const names = mine.map((s) => PD_LABEL[s]).join(" and ");
  const flip = (v: boolean) => { for (const s of mine) setFollow(root, s, v); if (v) for (const s of mine) applySection(root, s); onChange(); };
  if (quiet) return use ? <fieldset disabled className="flex min-w-0 flex-col gap-4 opacity-60" data-defaults-quiet={mine.join(" ")} aria-label={`${names}: set by the Studio (switch at the top of this page)`}>{children}</fieldset> : <>{children}</>;
  return (
    <div className="flex flex-col gap-4" data-defaults={mine.join(" ")}>
      <div className={`flex flex-col gap-1.5 rounded-xl border p-2 ${use ? "border-brand-400/40 bg-brand-500/10" : "border-ink-700"}`}>
        <Toggle id={id} checked={use} onChange={flip} label={`Use the Studio's default · ${names}`} />
        <span className="px-1 text-[12.5px] text-ink-400">{use ? `Set by ${site ? "your Studio" : "Settings → Project defaults"} for every site of this type. Switch off to edit ${site ? "your" : "this site's"} own.` : `This site uses its own. Switch on to go back to the Studio's default (it replaces what is here).`}</span>
      </div>
      {use ? <fieldset disabled className="flex min-w-0 flex-col gap-4 opacity-60" aria-label={`${names}: set by the Studio`}>{children}</fieldset> : children}
    </div>
  );
}
