import type { Card, Field } from "../schema/types";
import { AXES, FX_AXES, MOTIF_AXIS, SCROLL_EASE_AXIS, THEMES, type Axis } from "./catalog";

const sel = (a: Axis): Field => ({ t: "select", path: "theme." + a.key, label: a.label, options: a.options.map(([value, label]) => ({ value, label })) });

/** The "Theme & layout" cards both templates share, plus their own section layouts. */
/** How the top menu behaves while scrolling. "" keeps each theme's own behaviour. */
export const NAV_MODE_FIELD: Field = { t: "select", path: "theme.navMode", label: "Menu when scrolling", options: [
  { value: "", label: "Theme default" }, { value: "fixed", label: "Always visible (fixed at the top)" },
  { value: "hide", label: "Hide on scroll down, show on scroll up" }, { value: "scroll", label: "Scrolls away with the page" }] };
export const NAV_MODE_NOTE = "Theme default: most themes keep the menu fixed at the top; Velocity hides it while you scroll down. Your choice stays when you switch themes.";

export function themeCards(extra: Axis[], note: string, layout: Axis = AXES.layout): Card[] {
  const g = (...fields: Field[]): Field => ({ t: "grid", cols: 2, fields });
  return [
    { title: "Theme", fields: [{ t: "note", studio: true, text: `${THEMES.length} themes. Pick one to restyle the whole site: colours, fonts, layout, cards, buttons, animation and background. Your content stays as it is, and every setting below stays editable. Signature themes (marked ★) also change the page layout and add their own content section.` }, { t: "themes" }] },
    { title: "Element pack", fields: [
      { t: "note", text: "Every circle, square, triangle and 3D shape on the site is drawn as an illustrated element from this pack: sun and planets, leaves, coffee and croissants, film reels, tools… Each theme picks a pack that suits it. In shape pickers, each shape chooses a different element from the pack." },
      sel(MOTIF_AXIS),
    ] },
    { title: "Layout & elements", fields: [g(sel(layout), sel(AXES.heroArt), sel(AXES.nav), NAV_MODE_FIELD, sel(AXES.width), sel(AXES.heading), sel(AXES.shead), ...extra.map(sel)), { t: "note", text: NAV_MODE_NOTE }] },
    { title: "Cards, buttons & motion", fields: [g(sel(AXES.cards), sel(AXES.buttons), sel(AXES.motionStyle), sel(AXES.pattern), sel(AXES.ornament)), { t: "note", text: note }] },
    { title: "Interactions", fields: [
      { t: "note", text: "Award-style effects: a custom cursor, an intro that also animates links between pages, heading reveals, hover physics, smooth scrolling and a screen texture. Themes tagged Motion set these for you. Cursor and hover effects only run with a mouse; visitors who ask for reduced motion get a still page." },
      g(sel(FX_AXES.cursor), sel(FX_AXES.loader), sel(FX_AXES.textfx), sel(FX_AXES.hoverfx), sel(FX_AXES.scrollfx), sel(FX_AXES.overlay)),
      { t: "when", path: "theme.scrollfx", is: "smooth", fields: [sel(SCROLL_EASE_AXIS)] },
      { t: "when", path: "theme.scrollfx", is: "skew", fields: [sel(SCROLL_EASE_AXIS)] },
      { t: "note", text: "Scrolling feels heavy? Pick Light, or set Scrolling to Normal. Smooth scrolling only changes mouse wheels: trackpads and phones always scroll the normal way." },
    ] },
    { title: "Intro screen", fields: [
      { t: "note", text: "The full-screen panel that shows your name while the site opens (Intro & page transition above, or a signature theme's own preloader). It also slides across when visitors move between pages. Picking a theme resets these colours to match it." },
      { t: "text", path: "theme.introTitle", label: "Text on the intro screen", hint: "Leave empty to show your site name." },
      g({ t: "color", path: "theme.introBg", label: "Intro background" }, { t: "color", path: "theme.introFg", label: "Intro text colour" }),
      g({ t: "select", path: "theme.introFont", label: "Intro font", options: [{ value: "display", label: "Same as the headline (headings font)" }, { value: "body", label: "Body text font" }] },
        { t: "select", path: "theme.introCase", label: "Intro letters", options: [{ value: "upper", label: "CAPITALS" }, { value: "asis", label: "As typed" }] }),
    ] },
  ];
}
