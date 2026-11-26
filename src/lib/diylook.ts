// The Design yourself page's own look, wording, question order and background: what may be saved, in one place.
// The Studio cleans a setting with this before saving it, and the Studio's database cleans it again before handing it to a
// signed-out visitor's page. Both use this one file, so a setting the Studio can save is one a visitor receives.
// (No imports: the database Worker bundles this file too.)

/** The page's own wording: key → [what it is, the standard text]. {brand} is the page's name. */
export const DIY_WORDS = {
  welcome: ["Welcome message", "Welcome 👋 I'm the {brand} design assistant. Answer a few quick questions and your website takes shape as we go. It's only a preview."],
  typeOwn: ["Line above the first answer box", "or type your own"],
  writing: ["While the text is being written", "Writing a short line about each of your topics…"],
  readyTitle: ["Heading when the preview is ready", "Your preview is ready"],
  readyText: ["Text under that heading", "It isn't published. Connect with us to finish it together: your own photos, your address on the web, payment and any extra features."],
  viewBtn: ["Button: open the preview", "View my preview"],
  connectBtn: ["Button: get in touch", "Connect with Picaffectz"],
  anotherBtn: ["Button: start a new design", "Design another"],
  footnote: ["Small line under the buttons", "Preview only. Nothing is published or charged."],
  previewBtn: ["Header button: preview", "Preview"],
  restartBtn: ["Header button: start again", "Start again"],
  skipBtn: ["Button: skip a question", "Skip"],
} as const;
export type DiyWord = keyof typeof DIY_WORDS;
/** Fonts the page can use (all served by Google Fonts, like the Studio's own). */
export const DIY_FONTS = ["Manrope", "Inter", "DM Sans", "Plus Jakarta Sans", "Figtree", "Outfit", "Sora", "Space Grotesk", "Work Sans", "Nunito Sans", "Poppins", "IBM Plex Sans", "Bricolage Grotesque", "Syne", "Unbounded", "Fraunces", "Playfair Display", "DM Serif Display", "Lora", "Source Serif 4"];

/** The shapes the chat's messages can take. */
export const DIY_BUBBLES: [string, string][] = [["", "Soft (standard)"], ["round", "Rounded pill"], ["square", "Square"], ["tail", "Speech bubble with a tail"], ["outline", "Outlined"], ["glass", "Frosted glass"], ["minimal", "Minimal (assistant as plain text)"], ["bar", "Card with an accent bar"]];
export type DiyUi = { /** The top bar's colour and the buttons' colour (each its own; left out, they follow the page and the accent). */ header?: string; btn?: string; /** The colour of the boxes a visitor types in. */ field?: string; /** The colour of the choices a visitor taps (the pills). */ chip?: string; /** The shape of the chat's messages (see DIY_BUBBLES). */ bubble?: string; mode?: "light" | "dark"; accent?: string; font?: string; head?: string; radius?: "sharp" | "round"; width?: "narrow" | "wide"; logo?: string; name?: string; tag?: string };
/** The page's own background and text: the same choices a website's section has (drawn by the same script, fx.js). Pictures are
 *  small data: URLs or https addresses; a video is a link (YouTube, Vimeo or a video file's address). */
export type DiyBg = {
  on?: boolean; kind?: "" | "image" | "slides" | "video" | "anim" | "pattern"; color?: string; image?: string; slides?: string[]; slideSecs?: number; slideFx?: "zoom" | "slide";
  videoUrl?: string; videoOnce?: boolean; videoControls?: boolean; anim?: string; animSpeed?: "slow" | "lively"; animStrength?: number; pattern?: string;
  blur?: number; shade?: "dark" | "light"; dim?: number; text?: "light" | "dark" | "custom"; textColor?: string; font?: string; fontFor?: "head"; fontStyle?: "bold" | "light" | "italic" | "bolditalic" | "upper" | "spaced";
};
export type DiyLook = { ui?: DiyUi; words?: Partial<Record<DiyWord, string>>; qorder?: Record<string, string[]>; bg?: DiyBg };

const HEX = /^#[0-9a-f]{6}$/i, PIC = /^(data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+|https:\/\/[^\s<>"']{3,400})$/;
const tx = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/[<>]/g, "").trim().slice(0, n) : "");
/** A whole number from lo to hi; anything below lo (a slider left at nothing) is no setting at all. */
const num = (v: unknown, lo: number, hi: number) => (Number.isFinite(+(v as any)) && v !== "" && v != null && +(v as any) >= lo ? Math.min(hi, Math.round(+(v as any))) : undefined);

/** Only what is known and well-formed is kept; anything else is dropped. */
export function cleanDiyLook(x: any): DiyLook {
  const o: DiyLook = {}; if (!x || typeof x !== "object") return o;
  if (x.ui && typeof x.ui === "object") {
    const s = x.ui, u: DiyUi = {};
    if (s.mode === "light" || s.mode === "dark") u.mode = s.mode;
    if (typeof s.accent === "string" && HEX.test(s.accent)) u.accent = s.accent.toLowerCase();
    if (typeof s.header === "string" && HEX.test(s.header)) u.header = s.header.toLowerCase(); if (typeof s.btn === "string" && HEX.test(s.btn)) u.btn = s.btn.toLowerCase(); if (typeof s.field === "string" && HEX.test(s.field)) u.field = s.field.toLowerCase(); if (typeof s.chip === "string" && HEX.test(s.chip)) u.chip = s.chip.toLowerCase();
    if (DIY_BUBBLES.some(([k]) => k && k === s.bubble)) u.bubble = s.bubble;
    if (DIY_FONTS.includes(s.font)) u.font = s.font; if (DIY_FONTS.includes(s.head)) u.head = s.head;
    if (s.radius === "sharp" || s.radius === "round") u.radius = s.radius;
    if (s.width === "narrow" || s.width === "wide") u.width = s.width;
    if (typeof s.logo === "string" && s.logo.length <= 140_000 && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(s.logo)) u.logo = s.logo;
    if (tx(s.name, 40)) u.name = tx(s.name, 40); if (tx(s.tag, 60)) u.tag = tx(s.tag, 60);
    if (Object.keys(u).length) o.ui = u;
  }
  if (x.words && typeof x.words === "object") {
    const w: Partial<Record<DiyWord, string>> = {};
    for (const k of Object.keys(DIY_WORDS) as DiyWord[]) { const v = tx(x.words[k], 400); if (v && v !== DIY_WORDS[k][1]) w[k] = v; }
    if (Object.keys(w).length) o.words = w;
  }
  if (x.qorder && typeof x.qorder === "object") {
    const q: Record<string, string[]> = {};
    for (const g of ["basics", "portfolio", "store", "business", "restaurant", "events"]) { const l = Array.isArray(x.qorder[g]) ? ([...new Set((x.qorder[g] as unknown[]).filter((id) => typeof id === "string" && /^[a-z]{1,20}$/.test(id)))].slice(0, 80) as string[]) : []; if (l.length) q[g] = l; }
    if (Object.keys(q).length) o.qorder = q;
  }
  if (x.bg && typeof x.bg === "object") {
    const s = x.bg, b: DiyBg = {}, pic = (v: unknown) => (typeof v === "string" && v.length <= 140_000 && PIC.test(v) ? v : "");
    if (s.on === true) b.on = true;
    if (["image", "slides", "video", "anim", "pattern"].includes(s.kind)) b.kind = s.kind;
    if (typeof s.color === "string" && HEX.test(s.color)) b.color = s.color.toLowerCase();
    if (pic(s.image)) b.image = pic(s.image);
    if (Array.isArray(s.slides)) { const l = (s.slides as unknown[]).map(pic).filter(Boolean).slice(0, 4); if (l.length) b.slides = l; }
    if (num(s.slideSecs, 2, 12)) b.slideSecs = num(s.slideSecs, 2, 12); if (s.slideFx === "zoom" || s.slideFx === "slide") b.slideFx = s.slideFx;
    if (typeof s.videoUrl === "string" && /^https:\/\/[^\s<>"']{6,300}$/.test(s.videoUrl.trim())) b.videoUrl = s.videoUrl.trim();
    if (s.videoOnce === true) b.videoOnce = true; if (s.videoControls === true) b.videoControls = true;
    if (typeof s.anim === "string" && /^[a-z0-9-]{1,24}$/.test(s.anim)) b.anim = s.anim; if (s.animSpeed === "slow" || s.animSpeed === "lively") b.animSpeed = s.animSpeed;
    if (num(s.animStrength, 20, 100)) b.animStrength = num(s.animStrength, 20, 100);
    if (typeof s.pattern === "string" && /^[a-z0-9-]{1,24}$/.test(s.pattern)) b.pattern = s.pattern;
    if (num(s.blur, 1, 30)) b.blur = num(s.blur, 1, 30); if (s.shade === "dark" || s.shade === "light") b.shade = s.shade; if (num(s.dim, 5, 90)) b.dim = num(s.dim, 5, 90);
    if (s.text === "light" || s.text === "dark" || s.text === "custom") b.text = s.text; if (typeof s.textColor === "string" && HEX.test(s.textColor)) b.textColor = s.textColor.toLowerCase();
    if (DIY_FONTS.includes(s.font)) b.font = s.font; if (s.fontFor === "head") b.fontFor = "head";
    if (["bold", "light", "italic", "bolditalic", "upper", "spaced"].includes(s.fontStyle)) b.fontStyle = s.fontStyle;
    if (Object.keys(b).length) o.bg = b;
  }
  return o;
}
