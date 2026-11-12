import type { TemplateDef } from "./types";
import { portfolioTemplate } from "./portfolio";
import { storeTemplate } from "./store";
import { businessTemplate } from "./business";

export const TEMPLATES: Record<string, TemplateDef> = {
  portfolio: portfolioTemplate,
  store: storeTemplate,
  business: businessTemplate,
};
export const TEMPLATE_LIST = Object.values(TEMPLATES);
export type { TemplateDef } from "./types";
