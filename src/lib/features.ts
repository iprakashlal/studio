// What a client Studio shows. A Studio Partner sets this from the client's card (Settings → Studio Partners); it is
// kept in the client Studio's studio.json as clientFeatures.hide. A client Studio (one set up by a partner: its
// studio.config.json names the partner) never shows Migration, Update or Studio Partners: its partner updates and moves it from their own Studio.
import { cleanThemeList } from "../themes/limit";
export { cleanThemeList };
import { useEffect, useState } from "react";
import { loadHostConfig } from "./studiohost";

export const CLIENT_FEATURES: { key: string; label: string; hint?: string }[] = [
  { key: "new", label: "Create new sites" },
  { key: "tpl-portfolio", label: "Portfolio template" },
  { key: "tpl-store", label: "Online shop template" },
  { key: "tpl-business", label: "Business website template" },
  { key: "duplicate", label: "Duplicate sites" },
  { key: "delete", label: "Delete sites" },
  { key: "themes", label: "Themes gallery" },
  { key: "festival", label: "Festival overlay on their sites" },
  { key: "brand", label: "Studio name and logo", hint: "Settings" },
  { key: "badge", label: "“Powered by” badge", hint: "Settings" },
  { key: "pages", label: "The Studio's additional pages", hint: "Settings" },
  { key: "menus", label: "Admin menus", hint: "Settings" },
  { key: "hosting", label: "Hosting accounts and sites' hosting", hint: "Settings" },
];
export type ClientFeatures = { hide: string[]; /** How many themes of each template they can choose from (0 or missing: all). Older setups; themeList replaces it. */ themes?: number; /** The themes they can choose from, for each type of site (a type left out, or empty: all). */ themeList?: Record<string, string[]>; /** The most sites of each template they can have (missing: no limit). */ max?: Record<string, number> };
const num = (x: any) => (Number.isFinite(+x) && +x >= 0 && x !== "" && x != null ? Math.min(999, Math.floor(+x)) : undefined);
export const cleanFeatures = (x: any): ClientFeatures => {
  const max: Record<string, number> = {};
  for (const k of ["portfolio", "store", "business"]) { const n = num(x?.max?.[k]); if (n !== undefined) max[k] = n; }
  const themes = num(x?.themes), themeList = cleanThemeList(x?.themeList);
  return { hide: [...new Set((Array.isArray(x?.hide) ? x.hide : []).filter((k: any) => CLIENT_FEATURES.some((f) => f.key === k)))] as string[], ...(themes ? { themes } : {}), ...(Object.keys(themeList).length ? { themeList } : {}), ...(Object.keys(max).length ? { max } : {}) };
};
/** A client Studio's limits (none in a Studio of your own). */
export const limitsOf = (client: boolean | undefined, index: { clientFeatures?: ClientFeatures } | null | undefined): { themes: number; themeList: Record<string, string[]>; max: Record<string, number> } => {
  const f = client ? cleanFeatures(index?.clientFeatures) : { hide: [] as string[] } as ClientFeatures;
  return { themes: f.themes || 0, themeList: f.themeList || {}, max: f.max || {} };
};

/** Is this Studio a client's (set up by a Studio Partner)? undefined while it is being checked. */
export function useClientStudio(): boolean | undefined {
  const [v, setV] = useState<boolean | undefined>(undefined);
  useEffect(() => { loadHostConfig().then((c) => setV(!!c?.partner)).catch(() => setV(false)); }, []);
  return v;
}
/** A checker for hidden features: only a client Studio hides anything. */
export const hides = (client: boolean | undefined, index: { clientFeatures?: ClientFeatures } | null | undefined) => {
  const set = new Set(client ? cleanFeatures(index?.clientFeatures).hide : []);
  return (key: string) => set.has(key);
};

// Editor sections a client Studio doesn't show (its partner switched the feature off), e.g. "festival".
let hiddenSections = new Set<string>();
export const setStudioHidden = (ids: string[]) => { hiddenSections = new Set(ids); };
export const studioHidden = () => hiddenSections;
