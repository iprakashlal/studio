// What a client Studio shows. A Studio Partner sets this from the client's card (Settings → Studio Partners); it is
// kept in the client Studio's studio.json as clientFeatures.hide. A client Studio (one set up by a partner: its
// studio.config.json names the partner) never shows Migration or Studio Partners.
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
  { key: "brand", label: "Studio name and logo", hint: "Settings" },
  { key: "badge", label: "“Powered by” badge", hint: "Settings" },
  { key: "pages", label: "The Studio's additional pages", hint: "Settings" },
  { key: "menus", label: "Admin menus", hint: "Settings" },
  { key: "hosting", label: "Hosting accounts and sites' hosting", hint: "Settings" },
  { key: "update", label: "Update tab", hint: "Settings" },
];
export type ClientFeatures = { hide: string[] };
export const cleanFeatures = (x: any): ClientFeatures => ({ hide: [...new Set((Array.isArray(x?.hide) ? x.hide : []).filter((k: any) => CLIENT_FEATURES.some((f) => f.key === k)))] as string[] });

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
