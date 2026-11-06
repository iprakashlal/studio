// The editor is driven by these plain descriptions. The same schemas power the
// Studio's project editor and the CMS that ships inside every exported site.

export type Opt = string | { value: string; label: string };
export type Check = "vpa" | "paypal" | "https" | "razorpay" | "stripe" | "email" | "phone";

export type Field =
  | { t: "text"; path: string; label: string; hint?: string; ph?: string; check?: Check }
  | { t: "textarea"; path: string; label: string; hint?: string; rows?: number }
  | { t: "number"; path: string; label: string; hint?: string; min?: number; step?: number }
  | { t: "select"; path: string; label: string; options: Opt[] }
  /** A select whose options come from a list elsewhere in the content (e.g. product → category). */
  | { t: "ref"; path: string; label: string; source: string; valueKey: string; labelKey: string; empty?: string }
  | { t: "toggle"; path: string; label: string }
  | { t: "range"; path: string; label: string; min: number; max: number; step: number; unit?: string }
  | { t: "color"; path: string; label: string }
  | { t: "colorKey"; path: string; label: string }
  | { t: "shape"; path: string; label: string }
  | { t: "image"; path: string; label: string; hint?: string }
  | { t: "images"; path: string; label: string; hint?: string }
  | { t: "strings"; path: string; label: string; addLabel?: string; number?: boolean; multiline?: boolean }
  | { t: "list"; path: string; label?: string; item: Field[]; add: () => any; title: (it: any, i: number) => string; max?: number; fixed?: boolean }
  | { t: "grid"; cols?: 2 | 3; fields: Field[] }
  | { t: "note"; text: string; tone?: "info" | "warn" }
  /** Shows `fields` only while the value at `path` (in the whole content) is / isn't the given value. */
  | { t: "when"; path: string; is?: string; not?: string; fields: Field[] }
  | { t: "presets"; target: string; presets: { name: string; values: Record<string, string> }[] };

export type Card = { title: string; fields: Field[] };
export type Category = { id: string; label: string; group: string; desc: string; cards: Card[] };

export type TemplatePage = { file: string; label: string };

export type TemplateDef = {
  id: string;
  name: string;
  kind: string;
  description: string;
  pages: TemplatePage[];
  schema: Category[];
  /** Theme colour keys the colorKey swatches offer. */
  colorKeys: { key: string; label: string }[];
  themePath: string;
  /** Short line for the dashboard card, e.g. the site title. */
  summary: (content: any) => string;
  /** Warnings shown before export, e.g. "No payment method is switched on". */
  checks?: (content: any) => string[];
};
