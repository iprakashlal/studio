import type { Card, Field } from "../schema/types";
import { AXES, type Axis } from "./catalog";

const sel = (a: Axis): Field => ({ t: "select", path: "theme." + a.key, label: a.label, options: a.options.map(([value, label]) => ({ value, label })) });

/** The "Theme & layout" cards both templates share, plus their own section layouts. */
export function themeCards(extra: Axis[], note: string): Card[] {
  const g = (...fields: Field[]): Field => ({ t: "grid", cols: 2, fields });
  return [
    { title: "Theme", fields: [{ t: "note", text: "Pick a theme to restyle the whole site: colours, fonts, layout, cards, buttons, animation and background. Your content stays as it is, and every setting below stays editable." }, { t: "themes" }] },
    { title: "Layout & elements", fields: [g(sel(AXES.layout), sel(AXES.nav), sel(AXES.width), sel(AXES.heading), sel(AXES.shead), ...extra.map(sel))] },
    { title: "Cards, buttons & motion", fields: [g(sel(AXES.cards), sel(AXES.buttons), sel(AXES.motionStyle), sel(AXES.pattern), sel(AXES.ornament)), { t: "note", text: note }] },
  ];
}
