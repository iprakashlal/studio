// The editor is driven by these plain descriptions. The same schemas power the
// Studio's project editor and the CMS that ships inside every exported site.

/** A choice in a dropdown. `studio`: offered in the Studio's editor only; with `siteIf`, a site's own admin page offers it too
 *  once the Studio has allowed it for that site (Settings → Admin page → Features in this site's admin page; content.cms.allow). */
export type Opt = string | { value: string; label: string; studio?: boolean; siteIf?: string };
export type Check = "vpa" | "paypal" | "https" | "razorpay" | "stripe" | "email" | "phone";

export type Field =
  /** ml: a heading-style line that may hold several lines; Enter starts a new one and the site breaks the line there. */
  | { t: "text"; path: string; label: string; hint?: string; ph?: string; check?: Check; ml?: boolean; /** Live line under the box, e.g. the resulting address. */ show?: (value: string) => string }
  /** pdf: a "Fill from a PDF" button that reads the PDF's text into the box (and the item's empty title).
   *  rich: buttons for the reading-page marks (headings, lists, tables, text styles; see src/fx/pages.js). */
  | { t: "textarea"; path: string; label: string; hint?: string; rows?: number; pdf?: boolean; rich?: boolean; /** A code box: fixed-width letters, no spell check, Tab indents. */ code?: boolean; ph?: string }
  | { t: "number"; path: string; label: string; hint?: string; min?: number; step?: number }
  /** A calendar day, kept as YYYY-MM-DD ("" when empty). */
  | { t: "date"; path: string; label: string; hint?: string }
  | { t: "select"; path: string; label: string; options: Opt[] }
  /** A select whose options come from a list elsewhere in the content (e.g. product → category). */
  | { t: "ref"; path: string; label: string; source: string; valueKey: string; labelKey: string; empty?: string }
  | { t: "toggle"; path: string; label: string; /** Shown as on until the owner switches it off. */ def?: boolean }
  | { t: "range"; path: string; label: string; min: number; max: number; step: number; unit?: string }
  | { t: "color"; path: string; label: string }
  | { t: "colorKey"; path: string; label: string }
  | { t: "shape"; path: string; label: string }
  | { t: "image"; path: string; label: string; hint?: string }
  /** An uploaded video file (MP4 or WebM), kept with the site's pictures. */
  | { t: "videoFile"; path: string; label: string; hint?: string }
  /** A font file uploaded with the site (woff2, woff, ttf, otf); stored as { path, variable }. */
  | { t: "fontFile"; path: string; label: string; hint?: string }
  | { t: "images"; path: string; label: string; hint?: string }
  | { t: "strings"; path: string; label: string; addLabel?: string; number?: boolean; multiline?: boolean }
  | { t: "list"; path: string; label?: string; item: Field[]; add: () => any; title: (it: any, i: number) => string; max?: number; fixed?: boolean }
  | { t: "grid"; cols?: 2 | 3; fields: Field[] }
  /** `studio`: shown in the Studio only, not in the site's own admin page. */
  | { t: "note"; text: string; tone?: "info" | "warn"; studio?: boolean }
  /** A connection kept on the site's own database (keys encrypted there): Razorpay keys ("rz") or WhatsApp ("wa"). */
  | { t: "connection"; kind: "rz" | "wa" | "cf" | "pe" | "st" | "pp" }
  /** "Edit template": the whole email written in the notepad (src/editor/MailTemplate.tsx), kept at emails.<kind>.tpl. subject: where this email's subject is kept. */
  | { t: "mailtpl"; kind: string; subject?: string }
  /** Shows `fields` only while the value at `path` (in the whole content, or in the list item with `local`) is / isn't the given value. */
  | { t: "when"; path: string; is?: string; not?: string; /** Shown when the value is one of these / none of these. */ isAny?: string[]; notAny?: string[]; fields: Field[]; /** Read `path` from the list item being edited instead of the whole content. */ local?: boolean }
  | { t: "presets"; target: string; presets: { name: string; values: Record<string, string> }[] }
  /** The theme gallery: picking one writes the template's themeValues into content.theme. */
  | { t: "themes" }
  /** Studio only: which themes the site's own admin page offers (content.cms.themes). */
  | { t: "adminThemes" }
  /** Studio only: which sections this site's own admin page shows (content.cms.hide lists the hidden ones). */
  | { t: "adminSections" }
  /** Code Update: the site's own copy of the template's HTML, CSS and JavaScript (content.code). */
  | { t: "codeTemplate" }
  | { t: "code"; path: string; label: string; hint?: string }
  | { t: "placePick"; path: string; label: string; hint?: string }
  /** Legal & privacy: writes the privacy policy and terms pages from the business's details. */
  | { t: "legalPages" }
  /** Many photos at once, each assigned to a dish or a product. */
  | { t: "bulkPhotos"; kind: "dish" | "product" }
  | { t: "adminLook" }
  /** Legal & privacy: checks the page in the preview for accessibility problems. */
  | { t: "a11yCheck" }
  /** Import name, experience, education and skills from a LinkedIn profile PDF or data export. */
  | { t: "linkedin" }
  /** Studio only: "Fill in from a pamphlet" (business products), opened by the project view. */
  | { t: "pamphlet"; /** Its own wording (the restaurant's menu reader). */ text?: string; button?: string }
  /** Studio only: "Add reviews from Google" (business and shop testimonials). */
  | { t: "googleReviews" }
  /** Buttons that show a page in the live preview: { file, label } (e.g. the checkout with a sample cart). */
  | { t: "previewPages"; pages: { file: string; label: string }[]; text?: string }
  /** Languages: the table of the site's texts and their translations (content.i18n.t). */
  | { t: "translations" }
  | { t: "siteWords" };

export type Card = { title: string; fields: Field[]; /** Shown in the Studio only, not in the site's admin page. */ studio?: boolean; /** Shown only when this returns true for the content (e.g. the page layout draws it). */ showIf?: (content: any) => boolean };
export type Category = { id: string; label: string; group: string; /** A folding sub-heading inside the group (e.g. "Sections"). */ sub?: string; desc: string; cards: Card[]; /** Show the category only when this returns true for the current content. */ showIf?: (content: any) => boolean;
  /** Studio only. A site's own admin page shows it once the Studio has allowed this id for that site (content.cms.allow). */ siteIf?: string;
  /** A different name and menu heading in the site's own admin page. */ site?: { label?: string; group?: string } };

export type TemplatePage = { file: string; label: string };

export type TemplateDef = {
  /** The file that shows a static page: "page.html" (opened as page.html?p=<name>) or "index.html" for one-page templates. */
  pageFile?: string;
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
  /** content.theme values for a catalogue theme (see src/themes/catalog.ts). */
  themeValues: (theme: import("../themes/catalog").Theme) => Record<string, unknown>;
  /** The template's own theme list and filter tags (default: the shared personal/shop themes). */
  themes?: import("../themes/catalog").Theme[];
  themeTags?: string[];
  /** Fills in content keys added by newer template versions, so older projects open safely. */
  prepare?: (content: any) => void;
  /** Lists that are only samples in the starting content: an older project that lacks them opens with them empty. */
  sampleOnly?: string[];
};
