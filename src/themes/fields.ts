import type { Card, Field } from "../schema/types";
import { AXES, FX_AXES, MOTIF_AXIS, THEMES, type Axis } from "./catalog";

const sel = (a: Axis): Field => ({ t: "select", path: "theme." + a.key, label: a.label, options: a.options.map(([value, label]) => ({ value, label })) });

/** The "Theme & layout" cards both templates share, plus their own section layouts. */
export function themeCards(extra: Axis[], note: string, layout: Axis = AXES.layout): Card[] {
  const g = (...fields: Field[]): Field => ({ t: "grid", cols: 2, fields });
  return [
    { title: "Theme", fields: [{ t: "note", text: `${THEMES.length} themes. Pick one to restyle the whole site: colours, fonts, layout, cards, buttons, animation and background. Your content stays as it is, and every setting below stays editable. Signature themes (marked ★) also change the page layout and add their own content section.` }, { t: "themes" }] },
    { title: "Element pack", fields: [
      { t: "note", text: "Every circle, square, triangle and 3D shape on the site is drawn as an illustrated element from this pack: sun and planets, leaves, coffee and croissants, film reels, tools… Each theme picks a pack that suits it. In shape pickers, each shape chooses a different element from the pack." },
      sel(MOTIF_AXIS),
    ] },
    { title: "Layout & elements", fields: [g(sel(layout), sel(AXES.nav), sel(AXES.width), sel(AXES.heading), sel(AXES.shead), ...extra.map(sel))] },
    { title: "Cards, buttons & motion", fields: [g(sel(AXES.cards), sel(AXES.buttons), sel(AXES.motionStyle), sel(AXES.pattern), sel(AXES.ornament)), { t: "note", text: note }] },
    { title: "Interactions", fields: [
      { t: "note", text: "Award-style effects: a custom cursor, an intro that also animates links between pages, heading reveals, hover physics, smooth scrolling and a screen texture. Themes tagged Motion set these for you. Cursor and hover effects only run with a mouse; visitors who ask for reduced motion get a still page." },
      g(sel(FX_AXES.cursor), sel(FX_AXES.loader), sel(FX_AXES.textfx), sel(FX_AXES.hoverfx), sel(FX_AXES.scrollfx), sel(FX_AXES.overlay)),
    ] },
  ];
}
