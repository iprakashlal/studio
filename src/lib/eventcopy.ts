// Words for an event website that depend on the kind of event: who is on stage, what the registration is called,
// and the sample page a theme of that kind is previewed with.
import { EVT_TYPE_INFO } from "../themes/events";

/** The sample content, reworded for a kind of event (a Wedding theme is previewed as a wedding, not a conference). */
export function eventSample(sample: any, type: string): any {
  const info = EVT_TYPE_INFO[type]; if (!sample || !info) return sample;
  const c = JSON.parse(JSON.stringify(sample)), stage = info.stage;
  c.event = { ...(c.event || {}), type };
  c.hero = { ...(c.hero || {}), eyebrow: `${type} · ${String(c.event.date || "").slice(0, 4) || new Date().getFullYear()}` };
  c.team = { ...(c.team || {}), eyebrow: stage, title: stage };
  if (c.site?.pageLabels) c.site.pageLabels.lineup = stage;
  if (Array.isArray(c.sections)) c.sections = c.sections.map((s: any) => (s?.id === "team" ? { ...s, label: stage } : s));
  if (c.menu && Array.isArray(c.menu.items)) c.menu.items = c.menu.items.map((m: any) => (m?.to === "team" ? { ...m, label: stage } : m));
  return c;
}
