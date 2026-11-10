// Stable theme IDs (T-01, T-02, …) that clients can quote when choosing a design.
// They never change once given out: add new themes at the END with the next free number,
// and never renumber or reuse an ID, even if a theme is removed.
import { THEMES, type Theme } from "./catalog";

export const THEME_CODES: Record<string, string> = {
  "velocity": "T-01",
  "blueprint": "T-02",
  "midnight-neon": "T-03",
  "forest-night": "T-04",
  "plum-velvet": "T-05",
  "mono-steel": "T-06",
  "terminal": "T-07",
  "deep-ocean": "T-08",
  "aurora": "T-09",
  "obsidian-gold": "T-10",
  "crimson-noir": "T-11",
  "cyberpunk": "T-12",
  "graphite": "T-13",
  "nebula": "T-14",
  "espresso": "T-15",
  "synthwave": "T-16",
  "slate-mint": "T-17",
  "eclipse": "T-18",
  "emerald-lux": "T-19",
  "royal-navy": "T-20",
  "lime-punch": "T-21",
  "arcade": "T-22",
  "desert-night": "T-23",
  "glacier": "T-24",
  "sunset": "T-25",
  "jungle": "T-26",
  "chalkboard": "T-27",
  "industrial": "T-28",
  "drafting-paper": "T-29",
  "ivory-classic": "T-30",
  "terracotta": "T-31",
  "swiss": "T-32",
  "paper-ink": "T-33",
  "pastel-pop": "T-34",
  "neo-brutal": "T-35",
  "nordic-frost": "T-36",
  "sage-studio": "T-37",
  "citrus": "T-38",
  "marble": "T-39",
  "sky-blue": "T-40",
  "rose-quartz": "T-41",
  "sand-dune": "T-42",
  "lavender": "T-43",
  "broadsheet": "T-44",
  "mint-fresh": "T-45",
  "retro-poster": "T-46",
  "coral-reef": "T-47",
  "studio-grey": "T-48",
  "bauhaus": "T-49",
  "matcha": "T-50",
  "peach-cream": "T-51",
  "ocean-breeze": "T-52",
  "minimal-white": "T-53",
  "porcelain": "T-54",
  "candy": "T-55",
  "kraft": "T-56",
  "solare": "T-57",
  "solare-day": "T-58",
  "tech-lead": "T-59",
  "tech-lead-dark": "T-60",
  "kinetic-noir": "T-61",
  "editorial-motion": "T-62",
  "decode": "T-63",
  "liquid-chrome": "T-64",
  "gallery": "T-65",
  "brutal-motion": "T-66",
  "orbit-lab": "T-67",
  "velvet-cinema": "T-68",
  "studio-pop": "T-69",
};

/** The ID shown for a theme, e.g. "T-07". Themes without an ID yet fall back to their slug. */
export const themeCode = (t: Pick<Theme, "id">) => THEME_CODES[t.id] ?? t.id.toUpperCase();

/** Find a theme by ID ("T-07", "t7", "7") or by slug. */
export function findTheme(q: string): Theme | undefined {
  const s = q.trim().toLowerCase();
  const n = s.match(/^(?:t-?)?0*(\d+)$/);
  if (n) return THEMES.find((t) => THEME_CODES[t.id] === "T-" + n[1].padStart(2, "0"));
  return THEMES.find((t) => t.id === s);
}
