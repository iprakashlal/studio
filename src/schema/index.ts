import type { TemplateDef } from "./types";
import { portfolioTemplate } from "./portfolio";
import { storeTemplate } from "./store";

export const TEMPLATES: Record<string, TemplateDef> = {
  portfolio: portfolioTemplate,
  store: storeTemplate,
};
export const TEMPLATE_LIST = Object.values(TEMPLATES);
export type { TemplateDef } from "./types";
