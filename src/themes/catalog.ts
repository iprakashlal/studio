// The theme catalogue: complete looks shared by the portfolio and shop templates.
// A theme sets colours, fonts and corners, plus a set of style "axes" (layout, cards, buttons,
// motion, background, ornaments, headings…). Choosing one writes those values into content.theme;
// every value stays editable afterwards under Design → Theme & layout.

import "../fx/motifs.js";
import "../fx/layouts.js";

/** The page layouts (src/fx/layouts.js) the portfolio template can use instead of the classic page. */
export const Layouts: { list: [string, string][]; has: (id: string) => boolean } = (globalThis as any).SiteLayouts;

/** The shared element packs (src/fx/motifs.js), also used by the templates. */
export const Motifs: {
  packs: Record<string, { name: string; items: [string, string][] }>;
  order: string[];
  themes: Record<string, string>;
  svg: (pack: string, key: string | number) => string;
  has: (pack: string) => boolean;
  names: (pack: string) => string[];
  resolve: (theme: any, fallback?: string) => string;
} = (globalThis as any).SiteMotifs;

export type Axis = { key: string; label: string; hint?: string; options: [string, string][] };

/** Style axes both templates understand. The first option of each is the classic look. */
export const AXES: Record<string, Axis> = {
  layout: { key: "layout", label: "Hero layout", options: [["split", "Split: text left, art right"], ["reverse", "Reverse: art left, text right"], ["center", "Centred"], ["stacked", "Stacked: text, then a wide art band"], ["minimal", "Minimal: big type only"], ["panel", "Panel: art in a coloured panel"], ["editorial", "Editorial: ruled, big type"], ["framed", "Framed: hero in a card"], ["offset", "Offset: asymmetric"], ["poster", "Poster: huge title, set low"], ["marquee", "Marquee: name runs across the screen"], ["bento", "Bento: hero as a grid of tiles"], ["orbit", "Orbit: art in a circle, turning text ring"], ["index", "Index: big list of the site's sections"], ["frame", "Frame: architectural frame, corner notes"], ["stackname", "Stacked name: filled + outlined"]] },
  heroArt: { key: "heroArt", label: "Hero art shape", options: [["default", "Theme default"], ["circle", "Circle"], ["arch", "Arch"], ["blob", "Soft blob (moves)"], ["tilt", "Tilted card"], ["frame", "Framed print"], ["none", "No art (text only)"]] },
  nav: { key: "nav", label: "Menu style", options: [["pill", "Floating pill"], ["bar", "Full-width bar"], ["float", "Transparent, no frame"], ["center", "Centred"], ["line", "Hairline, underlined links"], ["dock", "Floating dock at the bottom"], ["side", "Side rail (wide screens)"]] },
  cards: { key: "cards", label: "Card style", options: [["soft", "Soft"], ["outline", "Outline"], ["elevated", "Elevated shadow"], ["brutal", "Bold border + hard shadow"], ["glass", "Frosted glass"], ["flat", "Flat"], ["gradient", "Gradient edge"], ["inset", "Inset, pressed"], ["lined", "Top rule, no box"]] },
  buttons: { key: "buttons", label: "Button style", options: [["brutal", "Offset shadow"], ["rounded", "Rounded"], ["pill", "Pill"], ["sharp", "Square"], ["outline", "Outline"], ["glow", "Glow"], ["underline", "Underlined text + arrow"], ["gradient", "Gradient pill"], ["soft", "Soft tint"]] },
  motionStyle: { key: "motionStyle", label: "Animation", options: [["rise", "Rise in"], ["fade", "Fade in"], ["zoom", "Zoom in"], ["slide", "Slide in from the side"], ["blur", "Blur to sharp"], ["flip", "Flip up"], ["mask", "Mask wipe"], ["skew", "Skew up"], ["drift", "Slow drift from the side"], ["none", "No animation"]] },
  pattern: { key: "pattern", label: "Background pattern", options: [["grid", "Blueprint grid"], ["dots", "Dots"], ["lines", "Horizontal lines"], ["diagonal", "Diagonal stripes"], ["waves", "Waves"], ["cross", "Crosses"], ["mesh", "Colour mesh glow"], ["rings", "Rings"], ["topo", "Contour lines"], ["checker", "Checker"], ["noise", "Fine noise"], ["none", "Plain"]] },
  ornament: { key: "ornament", label: "Decorative shapes", options: [["solid", "Solid shapes"], ["outline", "Outlined shapes"], ["soft", "Soft blurred blobs"], ["none", "None"]] },
  heading: { key: "heading", label: "Heading style", options: [["normal", "Normal"], ["upper", "UPPERCASE"], ["italic", "Italic accent"], ["tight", "Tight & heavy"], ["outline", "Outlined name"], ["gradient", "Gradient text"], ["wide", "Wide caps, light"]] },
  shead: { key: "shead", label: "Section label", options: [["dot", "● Dot"], ["plain", "Plain"], ["number", "01 Numbered"], ["line", "— Line"], ["bracket", "[ Brackets ]"], ["slash", "// Slash"], ["pill", "Tinted pill"], ["roman", "I. Roman numerals"]] },
  width: { key: "width", label: "Page width", options: [["normal", "Normal"], ["wide", "Wide"], ["narrow", "Narrow, editorial"], ["full", "Full, edge to edge"]] },
};
/** Interaction effects (assets/fx.js). The first option of each is "off". */
export const FX_AXES: Record<string, Axis> = {
  cursor: { key: "cursor", label: "Cursor", options: [["none", "Normal cursor"], ["dot", "Dot + trailing ring"], ["blend", "Inverting blob"], ["spotlight", "Spotlight glow"], ["trail", "Light trail"], ["ring", "Large ring + dot"]] },
  loader: { key: "loader", label: "Intro & page transition", options: [["none", "None"], ["curtain", "Curtain lift"], ["counter", "0–100 counter"], ["split", "Split reveal"], ["wipe", "Diagonal wipe"], ["iris", "Iris close"]] },
  textfx: { key: "textfx", label: "Heading reveal", options: [["none", "None"], ["lines", "Line-by-line mask"], ["letters", "Letter cascade"], ["scramble", "Decode / scramble"], ["words", "Words blur in"]] },
  hoverfx: { key: "hoverfx", label: "Hover", options: [["none", "Theme default"], ["lift", "Lift + glow edge"], ["magnetic", "Magnetic buttons"], ["tilt", "3D tilt + glare"], ["shine", "Light sweep"]] },
  scrollfx: { key: "scrollfx", label: "Scrolling", options: [["none", "Normal (the browser's own)"], ["progress", "Normal + progress bar"], ["smooth", "Smooth (eased)"], ["skew", "Smooth + velocity skew"]] },
  overlay: { key: "overlay", label: "Screen texture", options: [["none", "None"], ["grain", "Film grain"], ["scanlines", "Scanlines"], ["vignette", "Vignette"], ["paper", "Paper texture"], ["halftone", "Halftone corner"]] },
};
/** How strongly "Smooth" scrolling eases. Trackpads and touch screens always scroll natively. */
export const SCROLL_EASE_AXIS: Axis = { key: "scrollEase", label: "Smooth scrolling strength", options: [["light", "Light (snappy)"], ["medium", "Medium"], ["heavy", "Heavy (floaty)"]] };
/** Whether headings keep the lines exactly as typed, or wrap to fit. */
export const LINE_BREAKS_AXIS: Axis = { key: "lineBreaks", label: "Heading line breaks", options: [["typed", "As typed: one line stays one line"], ["auto", "Wrap to fit (typed breaks still apply)"]] };

/** Readable text colour (dark or white) on a background colour. */
export function onColor(hex: string): string {
  const h = String(hex || "").replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, "$&$&") : h.slice(0, 6), 16);
  if (isNaN(n)) return "#FFFFFF";
  const v = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2] > 0.42 ? "#111111" : "#FFFFFF";
}

export const FX_KEYS = ["cursor", "loader", "textfx", "hoverfx", "scrollfx", "overlay"] as const;
export type Fx = Record<(typeof FX_KEYS)[number], string>;

/** Illustrated elements that replace plain circles, squares and 3D solids. */
export const MOTIF_AXIS: Axis = {
  key: "motif", label: "Element pack",
  options: [...Motifs.order.map((k) => [k, Motifs.packs[k].name] as [string, string]), ["geometric", "Plain geometric shapes"]],
};

/** Whole-page layout for the portfolio (each Motion theme brings its own). */
export const KIT_AXIS: Axis = {
  key: "kit", label: "Page layout",
  options: [["classic", "Classic page"], ...Layouts.list],
};

/** Portfolio-only section layouts. */
export const PORTFOLIO_AXES: Record<string, Axis> = {
  about: { key: "about", label: "About layout", options: [["bento", "Bento grid"], ["stack", "Simple stack"], ["columns", "Wide story in columns"]] },
  skills: { key: "skills", label: "Skills layout", options: [["cube", "3D cube + list"], ["grid", "Card grid"], ["rows", "Numbered rows"]] },
  work: { key: "work", label: "Work layout", options: [["stack", "Stacking card deck"], ["timeline", "Timeline"], ["grid", "Two-column grid"]] },
};
/** Shop-only layouts. */
export const STORE_AXES: Record<string, Axis> = {
  grid: { key: "grid", label: "Products per row", options: [["auto", "Automatic"], ["2", "2 large"], ["3", "3"], ["4", "4 compact"]] },
  product: { key: "product", label: "Product card", options: [["classic", "Classic"], ["framed", "Framed card"], ["overlay", "Name over image"], ["minimal", "Minimal"], ["polaroid", "Polaroid"], ["tall", "Tall, fashion"], ["float", "Floating, soft shadow"]] },
};

/** Fonts available to every template, with exact Google Fonts specs (a wrong weight breaks the whole link). */
export const FONT_SPECS: Record<string, string> = {
  "Unbounded": "Unbounded:wght@400;600;800", "Bricolage Grotesque": "Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800", "Syne": "Syne:wght@400;600;800",
  "Sora": "Sora:wght@400;600;800", "Fraunces": "Fraunces:opsz,wght@9..144,400;9..144,600;9..144,800", "Archivo Black": "Archivo+Black", "DM Serif Display": "DM+Serif+Display",
  "Playfair Display": "Playfair+Display:ital,wght@0,400;0,600;0,800;1,400", "Space Grotesk": "Space+Grotesk:wght@400;600;700", "Outfit": "Outfit:wght@400;500;600;800",
  "Oswald": "Oswald:wght@400;600;700", "Bebas Neue": "Bebas+Neue", "Cormorant Garamond": "Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400", "Libre Baskerville": "Libre+Baskerville:ital,wght@0,400;0,700;1,400",
  "Abril Fatface": "Abril+Fatface", "Righteous": "Righteous", "Lexend": "Lexend:wght@400;500;600;800", "Rubik": "Rubik:wght@400;500;700;800", "Instrument Serif": "Instrument+Serif:ital@0;1",
  "Young Serif": "Young+Serif", "Anton": "Anton", "Chakra Petch": "Chakra+Petch:wght@400;600;700", "Orbitron": "Orbitron:wght@400;600;800", "Silkscreen": "Silkscreen:wght@400;700",
  "Caveat": "Caveat:wght@400;700", "Josefin Sans": "Josefin+Sans:wght@400;600;700", "Poppins": "Poppins:wght@400;500;600;800", "Alfa Slab One": "Alfa+Slab+One",
  "Manrope": "Manrope:wght@400;500;600;700;800", "Instrument Sans": "Instrument+Sans:wght@400;500;600;700", "IBM Plex Sans": "IBM+Plex+Sans:wght@400;500;600;700", "DM Sans": "DM+Sans:wght@400;500;700",
  "Work Sans": "Work+Sans:wght@400;500;600;700", "Inter": "Inter:wght@400;500;600;700;800", "Nunito Sans": "Nunito+Sans:wght@400;600;700", "Karla": "Karla:wght@400;500;700",
  "Lora": "Lora:ital,wght@0,400;0,500;0,600;0,700;1,400", "Source Serif 4": "Source+Serif+4:wght@400;600;700", "Figtree": "Figtree:wght@400;500;600;700", "Plus Jakarta Sans": "Plus+Jakarta+Sans:wght@400;500;600;700",
  "Space Mono": "Space+Mono:wght@400;700", "JetBrains Mono": "JetBrains+Mono:wght@400;500;700", "Quicksand": "Quicksand:wght@400;500;600;700", "Mulish": "Mulish:wght@400;600;700",
};
export const DISPLAY_FONTS = ["Unbounded", "Bricolage Grotesque", "Syne", "Sora", "Fraunces", "Archivo Black", "DM Serif Display", "Playfair Display", "Space Grotesk", "Outfit", "Oswald", "Bebas Neue",
  "Cormorant Garamond", "Libre Baskerville", "Abril Fatface", "Righteous", "Lexend", "Rubik", "Instrument Serif", "Young Serif", "Anton", "Chakra Petch", "Orbitron", "Silkscreen", "Caveat",
  "Josefin Sans", "Poppins", "Alfa Slab One", "Inter", "Figtree", "Plus Jakarta Sans"];
export const BODY_FONTS = ["Manrope", "Instrument Sans", "IBM Plex Sans", "DM Sans", "Work Sans", "Inter", "Nunito Sans", "Karla", "Lora", "Source Serif 4", "Figtree", "Plus Jakarta Sans",
  "Space Mono", "JetBrains Mono", "Quicksand", "Mulish", "Outfit", "Rubik", "Lexend", "Poppins", "Josefin Sans"];

export type Theme = {
  id: string;
  name: string;
  tags: string[];
  dark: boolean;
  /** bg, surface, deep, text, soft, line, c1 (primary), c2 (secondary), c3 (tertiary) */
  colors: { bg: string; surface: string; deep: string; text: string; soft: string; line: string; c1: string; c2: string; c3: string };
  display: string;
  body: string;
  radius: number;
  style: { layout: string; heroArt?: string; nav: string; cards: string; buttons: string; motionStyle: string; pattern: string; ornament: string; heading: string; shead: string; width: string };
  portfolio: { about: string; skills: string; work: string; glow: boolean; network: boolean; three: boolean; ticker: boolean };
  store: { grid: string; product: string };
  /** Interaction effects: cursor, loader, textfx, hoverfx, scrollfx, overlay. */
  fx: Fx;
  /** Element pack (see MOTIF_AXIS). */
  motif: string;
  /** Portfolio page layout (see KIT_AXIS). */
  kit: string;
  /** A signature theme brings its own page layout (portfolio) with extra content controls. */
  signature?: boolean;
  blurb?: string;
};

type Row = [string, string, string, string, string, string, number, string, string, string, string?, string?];
// id | name | tags | colors (bg surface deep text soft line c1 c2 c3) | display | body | radius |
// style "layout nav cards buttons motion pattern ornament heading shead width" |
// portfolio "about skills work fx" (fx letters: g glow, n network, 3 three-d, t ticker) | store "grid product" |
// optional interactions "cursor loader textfx hoverfx scrollfx overlay" (see FX_AXES; omitted = all off)
const ROWS: Row[] = [
  // ---------------- dark
  ["blueprint", "Blueprint", "Dark Tech Bold", "#0A1830 #0F2142 #06101F #E9EEF6 #93A6C4 #2A4A7A #3D63FF #FF6A3D #FFC83A", "Unbounded", "Manrope", 24, "split pill soft brutal rise grid solid normal dot normal", "bento cube stack gn3t", "auto classic"],
  ["midnight-neon", "Midnight Neon", "Dark Tech Bold", "#07070D #11111C #000005 #F2F3FF #9A9CC0 #2A2A44 #00E5FF #FF2E88 #B6FF3B", "Orbitron", "Inter", 10, "center bar glass glow zoom lines outline upper slash wide", "bento grid timeline gn3t", "4 overlay"],
  ["forest-night", "Forest Night", "Dark Nature Calm", "#0E1A16 #142621 #08110E #E8F0EA #9FB5A8 #2C4A3E #2FBF8F #F2A541 #E9E4D0", "Fraunces", "Manrope", 18, "reverse pill soft rounded fade dots soft normal line normal", "bento cube stack g3t", "3 classic"],
  ["plum-velvet", "Plum Velvet", "Dark Elegant Bold", "#1A1024 #251733 #10091A #F2EAF7 #B39CC4 #45305A #8A5CFF #FF5C8A #FFD166", "Syne", "DM Sans", 28, "split float glass pill blur waves soft tight number normal", "bento cube stack gn3t", "3 framed"],
  ["mono-steel", "Mono Steel", "Dark Minimal", "#111315 #1A1D21 #08090A #EDEFF2 #9AA1AB #33383F #EDEFF2 #7C8591 #C9CED6", "Space Grotesk", "IBM Plex Sans", 6, "minimal bar outline sharp fade grid outline upper bracket narrow", "stack grid timeline t", "4 minimal"],
  ["terminal", "Terminal", "Dark Tech Retro", "#0B0F0C #111813 #050806 #C8F7D0 #6E9A77 #1F3325 #3DFF7A #FFB000 #5CC8FF", "Space Mono", "JetBrains Mono", 0, "minimal bar outline outline fade lines none normal slash narrow", "stack grid timeline nt", "3 minimal"],
  ["deep-ocean", "Deep Ocean", "Dark Calm Nature", "#061A24 #0B2633 #03111A #E4F4F8 #8FB3C0 #1E4656 #2EC4F1 #FF8C61 #F7E06A", "Sora", "Figtree", 22, "center pill elevated rounded rise waves soft normal dot normal", "bento cube stack gn3t", "3 framed"],
  ["aurora", "Aurora", "Dark Playful Bold", "#0D0B1E #16132E #07061A #EEF0FF #A3A6D6 #2E2A55 #7CF0C5 #9B7BFF #FF8FD8", "Outfit", "Plus Jakarta Sans", 26, "split float glass glow blur dots soft tight dot wide", "bento cube stack gn3t", "4 overlay"],
  ["obsidian-gold", "Obsidian Gold", "Dark Elegant Luxury", "#0F0E0C #1A1815 #080706 #F5EFE3 #B3A88F #3A342A #D4AF37 #E9A07A #8C6D2E", "Cormorant Garamond", "Lora", 4, "center bar outline outline fade none none upper line narrow", "stack grid timeline gt", "3 minimal"],
  ["crimson-noir", "Crimson Noir", "Dark Bold", "#120809 #1E0F11 #090405 #F8ECEC #C29A9D #40242A #E63946 #F1FAEE #A8DADC", "Bebas Neue", "Inter", 2, "stacked bar brutal sharp slide diagonal solid upper number wide", "bento cube stack n3t", "4 overlay"],
  ["cyberpunk", "Cyberpunk", "Dark Tech Bold Retro", "#0A0014 #160026 #05000A #F4F1FF #B9A6D9 #3A1A5C #FCEE09 #FF003C #00F0FF", "Chakra Petch", "Rubik", 0, "split bar brutal brutal flip grid outline upper slash wide", "bento cube timeline gn3t", "4 framed"],
  ["graphite", "Graphite", "Dark Minimal Calm", "#16181D #1F2229 #0D0F12 #E7E9EE #9399A6 #323743 #8AB4F8 #F28B82 #FDD663", "Inter", "Inter", 12, "split pill flat rounded fade none none tight line normal", "bento grid stack 3t", "4 classic"],
  ["nebula", "Nebula", "Dark Playful", "#120F2A #1C1840 #0A0820 #ECEBFF #A9A6D8 #34306A #FF6EC7 #6EE7FF #FFE66E", "Unbounded", "DM Sans", 30, "center float glass glow zoom dots soft normal dot normal", "bento cube stack gn3t", "3 overlay"],
  ["espresso", "Espresso", "Dark Warm Calm", "#1C1410 #2A1F19 #120C09 #F3E9DF #BFAA98 #4A3A30 #D9A066 #8FB996 #F2D0A4", "Young Serif", "Karla", 14, "reverse pill soft pill fade none soft normal line normal", "bento cube timeline gt", "3 classic"],
  ["synthwave", "Synthwave", "Dark Retro Playful", "#1A0B2E #2A1145 #0F0620 #FDF2FF #C8A6E0 #4B2A70 #FF71CE #01CDFE #FFFB96", "Righteous", "Outfit", 20, "split pill glass glow rise lines solid upper slash normal", "bento cube stack gn3t", "3 overlay"],
  ["slate-mint", "Slate Mint", "Dark Tech Calm", "#0F1720 #16212C #0A1016 #E6F0F2 #93A8B4 #2A3A48 #5EEAD4 #F59E0B #E2E8F0", "Lexend", "Inter", 16, "split bar elevated rounded rise grid outline normal number normal", "bento cube stack n3t", "4 classic"],
  ["eclipse", "Eclipse", "Dark Minimal Bold", "#0A0A0A #141414 #000000 #FAFAFA #9E9E9E #2A2A2A #FF5F1F #FAFAFA #FFB38A", "Anton", "Inter", 0, "minimal float flat sharp slide none none upper slash wide", "stack grid timeline t", "4 minimal"],
  ["emerald-lux", "Emerald Luxe", "Dark Elegant Luxury Nature", "#0B1F1A #112B24 #06140F #F1F7F2 #A3BDB0 #244A3E #C9A227 #3FB68B #EDE6D6", "Playfair Display", "Lora", 8, "center bar outline outline fade none soft italic line narrow", "bento cube timeline g3t", "3 framed"],
  ["royal-navy", "Royal Navy", "Dark Elegant", "#0E1630 #16204A #080D20 #F1F3FA #9FA9C9 #2B3766 #E0B44C #7FA7FF #F1F3FA", "DM Serif Display", "IBM Plex Sans", 12, "split bar elevated rounded fade none soft normal line normal", "bento cube stack g3t", "3 classic"],
  ["lime-punch", "Lime Punch", "Dark Bold Playful", "#141414 #1E1E1E #0A0A0A #F4F4F0 #A3A39A #333330 #C6FF3D #FF5DA2 #64D2FF", "Syne", "Inter", 18, "stacked float brutal brutal flip grid solid upper slash wide", "bento cube stack n3t", "4 framed"],
  ["arcade", "Arcade", "Dark Retro Playful Tech", "#0E0B26 #1A1640 #07051A #F2F2FF #A8A6D6 #2E2A66 #FF4D6D #3DDCFF #FFD93D", "Silkscreen", "Space Mono", 0, "center bar brutal sharp flip grid solid upper bracket normal", "bento grid timeline n3t", "4 framed"],
  ["desert-night", "Desert Night", "Dark Warm", "#1E1612 #2A1F19 #120D0A #F6E9DA #C4A98E #4A382C #E07A3F #5BA4A4 #F2C14E", "Bricolage Grotesque", "Manrope", 20, "reverse pill soft rounded slide dots solid normal number normal", "bento cube stack gn3t", "3 classic"],
  ["glacier", "Glacier", "Dark Calm", "#0F1B26 #162636 #0A121A #EAF4FB #9BB4C7 #2A4256 #A5D8FF #FFB4A2 #C3F0CA", "Sora", "Inter", 24, "center float glass glow blur none soft tight dot normal", "bento cube stack gn3t", "3 overlay"],
  ["sunset", "Sunset", "Dark Warm Playful", "#2A1033 #3A1847 #1A0822 #FFF1E8 #D9AFC4 #56305E #FF7A59 #FFC15E #C86BFA", "Outfit", "DM Sans", 28, "split pill glass glow zoom waves soft normal dot normal", "bento cube stack gn3t", "3 overlay"],
  ["jungle", "Jungle", "Dark Nature Bold", "#0F2016 #16301F #08140C #EAF5E6 #A0BBA2 #2A4A33 #8BD450 #FF9F1C #F5E663", "Rubik", "Nunito Sans", 16, "stacked pill soft pill rise diagonal solid upper number normal", "bento cube stack gn3t", "3 classic"],
  ["chalkboard", "Chalkboard", "Dark Playful Retro", "#1F2A24 #26332C #141C18 #EEF2EA #A5B3A7 #3A4A40 #F5F3D8 #F2A65A #9AD1D4", "Caveat", "Karla", 10, "center pill outline outline fade dots outline normal slash normal", "stack grid timeline gt", "3 minimal"],
  ["industrial", "Industrial", "Dark Bold Tech", "#1B1D1F #24272A #111213 #E9E6E0 #A19D95 #3A3D41 #F2A900 #E9E6E0 #5C7A89", "Oswald", "IBM Plex Sans", 2, "stacked bar outline sharp slide cross outline upper bracket wide", "bento grid timeline n3t", "4 framed"],
  // ---------------- light
  ["drafting-paper", "Drafting Paper", "Light Tech Bold", "#E6E9EF #F3F5F8 #121826 #121826 #5B6475 #B6C0D0 #2348FF #D9481C #FFC83A", "Unbounded", "Manrope", 24, "split pill soft brutal rise grid solid normal dot normal", "bento cube stack n3t", "auto classic"],
  ["ivory-classic", "Ivory Classic", "Light Elegant Calm", "#FAF7F2 #FFFFFF #1B1A17 #1B1A17 #6B665D #E7E1D6 #1F4D3A #B4441B #E9B949", "Fraunces", "Manrope", 14, "split pill soft rounded rise none none normal line normal", "bento cube stack 3t", "auto classic"],
  ["terracotta", "Terracotta Sun", "Light Warm", "#F4EDE6 #FFF9F3 #2B1D17 #2B1D17 #7A6458 #DCCBBE #C8553D #2D6A6A #F2B134", "Fraunces", "Work Sans", 20, "reverse pill soft rounded fade dots solid normal line normal", "bento cube stack 3t", "3 classic"],
  ["swiss", "Swiss Grid", "Light Minimal Bold", "#F5F5F2 #FFFFFF #111111 #111111 #5A5A5A #D8D8D2 #E30613 #111111 #F5C400", "Archivo Black", "Inter", 0, "minimal bar flat sharp slide grid solid upper number wide", "bento grid timeline t", "4 minimal"],
  ["paper-ink", "Paper & Ink", "Light Minimal Elegant", "#FBF8F1 #FFFFFF #1D1B16 #1D1B16 #6B6558 #E5DFD0 #1D1B16 #B23A2E #2F5D8A", "Instrument Serif", "Source Serif 4", 2, "center float outline outline fade none none italic line narrow", "stack grid timeline -", "3 minimal"],
  ["pastel-pop", "Pastel Pop", "Light Playful", "#FFF6F9 #FFFFFF #2E2140 #2E2140 #7A6A8E #F0DCE7 #E0569A #1B7FB5 #FFC23D", "Lexend", "Quicksand", 32, "center pill elevated pill zoom dots soft normal dot normal", "bento cube stack 3t", "3 framed"],
  ["neo-brutal", "Neo Brutal", "Light Bold Playful", "#FFF4D6 #FFFFFF #111111 #111111 #4A4A4A #111111 #E03B3B #4D7CFF #FFD23F", "Archivo Black", "DM Sans", 8, "split bar brutal brutal flip none solid upper bracket normal", "bento cube stack 3t", "3 framed"],
  ["nordic-frost", "Nordic Frost", "Light Calm Minimal", "#EEF3F6 #FFFFFF #1C2A36 #1C2A36 #5F7180 #D3DEE6 #3B6E8F #C2573C #81B29A", "Figtree", "Figtree", 14, "split pill soft rounded fade none soft normal line normal", "bento cube stack 3", "3 classic"],
  ["sage-studio", "Sage Studio", "Light Nature Calm", "#EEF1EA #F8FAF5 #1F2A22 #1F2A22 #5E6B60 #D5DDD0 #4F7A5A #A9602F #E7C873", "Young Serif", "Karla", 18, "reverse float soft rounded rise dots soft normal dot normal", "bento cube stack 3t", "3 classic"],
  ["citrus", "Citrus", "Light Playful Warm", "#FFFBEA #FFFFFF #1E2A12 #1E2A12 #5C6650 #EEE6C2 #E06A00 #2E7D32 #FFC107", "Outfit", "Outfit", 24, "center pill elevated pill zoom waves solid tight dot normal", "bento cube stack 3t", "3 framed"],
  ["marble", "Marble", "Light Elegant Minimal Luxury", "#F6F4F1 #FFFFFF #22201D #22201D #6F6A63 #E2DED8 #8C7B6B #2C2A27 #C9B79C", "Cormorant Garamond", "Mulish", 2, "center float flat outline fade none none upper line narrow", "stack grid timeline -", "3 minimal"],
  ["sky-blue", "Sky Blue", "Light Tech Calm", "#F2F7FF #FFFFFF #0F1E3D #0F1E3D #55627A #D6E2F5 #2563EB #D95A06 #22C55E", "Plus Jakarta Sans", "Plus Jakarta Sans", 16, "split bar elevated rounded rise grid outline tight number normal", "bento cube stack n3t", "4 classic"],
  ["rose-quartz", "Rose Quartz", "Light Elegant Warm", "#FBF1F1 #FFFFFF #3A2329 #3A2329 #82646B #EED7DA #C0587A #5A7D9A #E8B4A0", "Playfair Display", "DM Sans", 22, "reverse pill soft pill blur dots soft italic dot normal", "bento cube stack 3t", "3 framed"],
  ["sand-dune", "Sand Dune", "Light Warm Nature", "#F3EADB #FBF6EE #2E2418 #2E2418 #6E5D48 #E1D3BC #B5651D #3E6259 #E9C46A", "Bricolage Grotesque", "Work Sans", 12, "stacked pill soft rounded slide waves solid normal number wide", "bento cube stack 3t", "3 classic"],
  ["lavender", "Lavender Mist", "Light Calm Playful", "#F4F1FB #FFFFFF #2A2140 #2A2140 #6E6587 #E1DAF0 #7C5CC4 #C2457B #7FC8C2", "Sora", "Nunito Sans", 26, "center float glass pill blur dots soft normal dot normal", "bento cube stack g3t", "3 overlay"],
  ["broadsheet", "Broadsheet", "Light Minimal Elegant Retro", "#F7F5EF #FFFFFF #151515 #151515 #5E5E5E #D9D6CC #151515 #A61B1B #C9A227", "Abril Fatface", "Lora", 0, "minimal bar outline sharp fade lines none normal line narrow", "stack grid timeline t", "3 minimal"],
  ["mint-fresh", "Mint Fresh", "Light Calm Playful", "#ECFBF4 #FFFFFF #0E2A22 #0E2A22 #4E6E64 #CDEDE0 #0E9F6E #6366F1 #F59E0B", "Lexend", "Figtree", 20, "split pill elevated rounded rise dots solid normal dot normal", "bento cube stack n3t", "3 classic"],
  ["retro-poster", "Retro Poster", "Light Retro Bold Warm", "#F2E6CE #FAF1DE #2B2118 #2B2118 #6E5E4A #D9C7A3 #D1495B #00798C #EDAE49", "Alfa Slab One", "Karla", 6, "stacked bar brutal sharp slide diagonal solid upper number normal", "bento cube stack 3t", "3 framed"],
  ["coral-reef", "Coral Reef", "Light Playful Warm", "#FFF4F0 #FFFFFF #2D1A17 #2D1A17 #7E625C #F2DAD2 #F0503F #1B998B #FFC857", "Poppins", "Poppins", 18, "split pill soft pill zoom waves solid normal dot normal", "bento cube stack 3t", "3 classic"],
  ["studio-grey", "Studio Grey", "Light Minimal Tech", "#ECECEC #F7F7F7 #1A1A1A #1A1A1A #5F5F5F #D2D2D2 #1A1A1A #E04400 #9E9E9E", "Space Grotesk", "Inter", 10, "minimal float outline outline fade grid outline tight slash wide", "bento grid stack t", "4 minimal"],
  ["bauhaus", "Bauhaus", "Light Bold Retro", "#F4EFE6 #FFFFFF #1A1A1A #1A1A1A #555049 #DCD3C3 #1F4E9E #D7263D #F4B400", "Josefin Sans", "Work Sans", 0, "split bar flat sharp rise grid solid upper number normal", "bento cube stack 3t", "3 framed"],
  ["matcha", "Matcha", "Light Nature Calm", "#F1F4E8 #FAFCF4 #25301E #25301E #65705A #DCE3C9 #5A7D2E #C0603A #E3C26B", "Fraunces", "Figtree", 24, "center pill soft rounded fade dots soft normal dot narrow", "bento cube stack 3t", "3 classic"],
  ["peach-cream", "Peach Cream", "Light Playful Warm", "#FFF3E8 #FFFFFF #3B241A #3B241A #82665A #F2DCCB #D9502A #6C63FF #FFC46B", "Bricolage Grotesque", "Plus Jakarta Sans", 28, "split float elevated pill zoom dots soft tight dot normal", "bento cube stack 3t", "3 framed"],
  ["ocean-breeze", "Ocean Breeze", "Light Calm Nature", "#EEF8FB #FFFFFF #0B2A36 #0B2A36 #4E6E7A #CFE6EE #0E7490 #D9503E #FACC15", "Outfit", "Karla", 18, "reverse bar soft rounded rise waves soft normal number normal", "bento cube stack n3t", "3 classic"],
  ["minimal-white", "Minimal White", "Light Minimal", "#FCFCFA #F4F4F1 #111111 #111111 #666660 #E4E4DE #111111 #666660 #C8C8C0", "Inter", "Inter", 8, "minimal float flat outline fade none none tight line narrow", "stack grid timeline -", "4 minimal"],
  ["porcelain", "Porcelain Blue", "Light Elegant Calm", "#F3F6FB #FFFFFF #14213D #14213D #5A6680 #D9E1EE #1D4ED8 #B91C1C #0EA5E9", "Libre Baskerville", "Source Serif 4", 6, "center bar outline outline fade lines none italic line narrow", "stack grid timeline t", "3 minimal"],
  ["candy", "Candy", "Light Playful Bold", "#FFF0F6 #FFFFFF #3A1030 #3A1030 #86607A #F6D3E4 #D81B60 #0097A7 #FFB300", "Righteous", "Quicksand", 30, "center pill elevated pill zoom dots solid normal dot normal", "bento cube stack 3t", "4 framed"],
  ["kraft", "Kraft Paper", "Light Warm Retro Nature", "#E9DCC7 #F4EBDD #2A2016 #2A2016 #6E5D48 #D2C0A2 #8A4B2A #3D5A40 #D9A441", "Alfa Slab One", "Karla", 4, "reverse bar outline sharp fade cross outline normal bracket normal", "bento cube timeline 3t", "3 framed"],
  // ---------------- motion: award-style interaction themes (cursor, intro, reveals, hover, scroll, texture)
  ["solare", "Solare", "Dark Elegant Warm Luxury Motion", "#0E0A06 #18110A #050302 #F4E9D8 #B8A68C #3A2C1E #FF9A2E #FFD27A #E2553B", "Instrument Serif", "Manrope", 4, "center float flat outline fade none soft italic number wide", "stack grid timeline g", "3 overlay", "blend split lines lift smooth grain"],
  ["solare-day", "Solare Day", "Light Elegant Warm Motion", "#F4ECDF #FBF6EE #1A120B #1A120B #6E5E4B #E0D3BF #D9601A #9A6F0B #7A3B1E", "Instrument Serif", "Manrope", 2, "minimal float flat outline fade none soft italic number wide", "stack grid timeline -", "3 minimal", "dot curtain lines lift smooth grain"],
  ["tech-lead", "Tech Lead", "Light Minimal Tech Motion", "#FAFAFA #FFFFFF #0A0A0A #0A0A0A #5F6368 #E6E6E6 #2563EB #16A34A #F59E0B", "Inter", "Inter", 14, "split float soft rounded rise none none tight plain normal", "bento grid timeline t", "4 classic", "spotlight none none lift progress none"],
  ["tech-lead-dark", "Tech Lead Dark", "Dark Minimal Tech Motion", "#09090B #131316 #000000 #FAFAFA #A1A1AA #27272A #60A5FA #34D399 #FBBF24", "Inter", "Inter", 14, "split float soft rounded rise none none tight plain normal", "bento grid timeline t", "4 classic", "spotlight none scramble lift progress none"],
  ["kinetic-noir", "Kinetic Noir", "Dark Bold Motion", "#0B0B0B #151515 #000000 #F5F5F0 #9A9A92 #2A2A2A #E8FF3A #FF4D2E #F5F5F0", "Anton", "Inter", 0, "minimal bar flat sharp slide none none upper number wide", "stack grid timeline t", "4 overlay", "blend counter letters magnetic skew grain"],
  ["editorial-motion", "Editorial Motion", "Light Elegant Minimal Motion", "#F3F0EA #FFFFFF #141414 #141414 #5E5A52 #D9D3C7 #141414 #B3261E #7D6E57", "Playfair Display", "Source Serif 4", 0, "center bar outline outline fade lines none italic line narrow", "stack grid timeline -", "3 minimal", "dot curtain lines lift smooth none"],
  ["decode", "Decode", "Dark Tech Retro Motion", "#050805 #0C120D #000000 #D6FFD9 #6FA176 #1C2E1F #39FF6A #FFB000 #4FD1FF", "Space Mono", "JetBrains Mono", 0, "minimal bar outline outline fade lines none normal slash narrow", "stack grid timeline nt", "3 minimal", "trail counter scramble tilt progress scanlines"],
  ["liquid-chrome", "Liquid Chrome", "Dark Tech Bold Motion", "#0A0C12 #121621 #05060A #EEF1F8 #9AA3B8 #262C3D #A3B8FF #FF7AD9 #7CFFE0", "Syne", "Inter", 22, "center float glass glow blur dots soft tight dot wide", "bento cube stack gn3t", "3 overlay", "spotlight split letters tilt smooth vignette"],
  ["gallery", "Gallery", "Light Minimal Luxury Motion", "#FFFFFF #F5F5F3 #111111 #111111 #707070 #E7E7E4 #111111 #9A8F80 #C9C2B6", "Cormorant Garamond", "Mulish", 0, "minimal float flat outline fade none none upper line wide", "stack grid timeline -", "3 minimal", "dot split lines lift smooth grain"],
  ["brutal-motion", "Brutal Motion", "Light Bold Playful Motion", "#F7F052 #FFFFFF #111111 #111111 #3A3A3A #111111 #E0204F #2D5BFF #111111", "Archivo Black", "DM Sans", 6, "split bar brutal brutal flip none solid upper bracket normal", "bento cube stack 3t", "3 framed", "blend counter letters magnetic skew none"],
  ["orbit-lab", "Orbit Lab", "Dark Tech Playful Motion", "#070B1A #0E1430 #03050E #EAF0FF #8E9BC4 #1F2A55 #6C8CFF #FF6B9A #3DF5C8", "Unbounded", "Manrope", 26, "split pill glass glow zoom grid solid normal dot normal", "bento cube stack gn3t", "4 overlay", "dot curtain letters magnetic progress none"],
  ["velvet-cinema", "Velvet Cinema", "Dark Luxury Elegant Motion", "#120607 #1D0B0D #070203 #F6E7D8 #BFA190 #3B1B1E #D7A24B #C21E36 #F6E7D8", "DM Serif Display", "Lora", 4, "center bar outline outline fade none soft upper line narrow", "stack grid timeline g", "3 minimal", "blend curtain lines lift smooth vignette"],
  ["studio-pop", "Studio Pop", "Light Playful Motion", "#FFF7EE #FFFFFF #23123A #23123A #6F5F86 #F0E2D2 #7B4DFF #E2552B #0E9E83", "Bricolage Grotesque", "Plus Jakarta Sans", 28, "center pill elevated pill zoom dots solid tight dot normal", "bento cube stack 3t", "3 framed", "trail split letters magnetic none none"],
  // ---------------- modern & classy (T-70…T-119): built on layout kit 2 (panel/editorial/framed/offset/poster heroes,
  // line/dock/side menus, gradient/inset/lined cards, new buttons, reveals, backgrounds, cursors, loaders and hovers)
  ["noir-atelier", "Noir Atelier", "Dark Elegant Luxury Classy", "#0D0D0F #17171B #050506 #F1EDE6 #A39D93 #2C2B30 #C8A97E #E8E2D6 #7D6A55", "Cormorant Garamond", "Manrope", 2, "editorial line lined underline mask none outline wide roman full none", "columns rows timeline -", "3 tall", "ring iris words shine smooth grain", "geometric"],
  ["onyx-glass", "Onyx Glass", "Dark Modern Tech", "#0A0B10 #12141C #04050A #EEF0F7 #9097AA #252836 #8B9CFF #5EEAD4 #F0ABFC", "Sora", "Inter", 20, "bento dock glass gradient blur mesh soft gradient pill wide default", "bento grid grid gn3", "3 float", "ring wipe scramble tilt smooth none", "celestial"],
  ["midnight-serif", "Midnight Serif", "Dark Elegant Classy", "#10131C #181C28 #0A0C12 #EDE9E1 #A3A6B4 #2B3040 #D9B26F #8FA8D8 #EDE9E1", "DM Serif Display", "Source Serif 4", 4, "frame line inset underline fade rings outline italic roman normal arch", "columns cube timeline g", "3 framed", "dot curtain lines lift smooth vignette", "geometric"],
  ["carbon-lab", "Carbon Lab", "Dark Modern Tech Minimal", "#0B0C0D #151718 #000000 #E8EAEC #8C9196 #2A2D30 #FF6B35 #E8EAEC #4CC9F0", "Space Grotesk", "IBM Plex Sans", 8, "index side outline soft skew checker none tight number wide tilt", "stack rows grid nt", "4 minimal", "dot counter letters magnetic progress none", "geometric"],
  ["velvet-night", "Velvet Night", "Dark Luxury Classy", "#160B14 #22121F #0B050A #F5E9EF #BFA2B3 #3D2436 #E7B4C8 #C9A86A #8E5C7E", "Playfair Display", "Lora", 10, "orbit float gradient gradient blur mesh outline italic pill narrow default", "columns cube stack g", "3 float", "spotlight split words shine smooth grain", "geometric"],
  ["moss-brass", "Moss & Brass", "Dark Nature Classy", "#0F1712 #17221B #08100B #ECEFE6 #9FAF9F #2A3A2F #C9A55C #7FB08A #E8DDC3", "Fraunces", "Karla", 12, "stackname bar lined underline drift topo outline italic line normal arch", "stack rows timeline gt", "3 polaroid", "none curtain lines lift smooth paper", "geometric"],
  ["aurora-glass", "Aurora Glass", "Dark Modern Playful", "#090B1A #12152B #04050F #EEF0FF #A0A6D0 #262B52 #7C9CFF #57F2C1 #FF8FD8", "Plus Jakarta Sans", "Plus Jakarta Sans", 24, "orbit dock glass gradient zoom mesh soft gradient dot wide blob", "bento grid grid gn3t", "4 overlay", "spotlight iris none tilt smooth none", "celestial"],
  ["ink-ember", "Ink & Ember", "Dark Warm Classy", "#120F0D #1C1814 #090706 #F3ECE4 #B3A698 #362E27 #E2643B #F3ECE4 #C9A27A", "Instrument Serif", "Instrument Sans", 0, "marquee line lined underline mask noise outline italic roman full none", "columns rows grid t", "3 tall", "blend wipe lines shine smooth grain", "geometric"],
  ["cobalt-studio", "Cobalt Studio", "Dark Modern Bold", "#071233 #0C1B47 #040A1F #EEF2FF #9DAAD6 #22356E #3D7BFF #FFC857 #79E2FF", "Unbounded", "Manrope", 16, "bento pill gradient gradient skew rings solid upper pill normal tilt", "bento cube grid gn3t", "3 framed", "ring counter letters magnetic skew none", "tech"],
  ["graphite-pro", "Graphite Pro", "Dark Minimal Modern", "#111214 #191A1D #0A0A0B #F2F2F3 #96989E #2A2B2F #E6E6E6 #FF4F3A #8E8E93", "Inter", "Inter", 10, "index line inset soft fade none none wide plain wide none", "columns rows grid t", "4 minimal", "dot none words lift progress none", "geometric"],
  ["bordeaux", "Bordeaux", "Dark Classy Luxury Warm", "#1A0A0E #261218 #0E0507 #F6E8E8 #C29FA3 #47232B #D4A373 #E8C1C5 #9D2B3C", "Cormorant Garamond", "Mulish", 6, "framed center outline outline drift none outline wide roman narrow arch", "stack cube timeline g", "3 framed", "ring iris lines shine smooth vignette", "geometric"],
  ["teal-dusk", "Teal Dusk", "Dark Calm Modern", "#0B1D21 #11292F #061215 #E6F2F1 #93B3B1 #22444A #3CCFB4 #F4A261 #E9C46A", "Outfit", "DM Sans", 22, "panel pill soft soft rise topo soft normal pill normal blob", "columns grid stack g3t", "3 float", "none curtain words lift smooth none", "ocean"],
  ["neon-mono", "Neon Mono", "Dark Tech Bold Modern", "#060606 #101010 #000000 #EDEDED #8A8A8A #222222 #D7FF3A #EDEDED #00E0FF", "Space Grotesk", "JetBrains Mono", 4, "marquee side outline sharp skew checker none upper slash full tilt", "stack rows grid nt", "4 minimal", "blend counter scramble magnetic skew scanlines", "cyber"],
  ["rose-noir", "Rose Noir", "Dark Elegant Playful", "#140C10 #1F1319 #0A0508 #F8ECF1 #C4A6B4 #3E2632 #FF7AA2 #FFC2D4 #B48CFF", "Syne", "Plus Jakarta Sans", 26, "split float gradient gradient blur mesh soft gradient dot normal blob", "bento cube stack gn3", "3 overlay", "spotlight split none tilt smooth grain", "celestial"],
  ["slate-editorial", "Slate Editorial", "Dark Classy Minimal", "#15181D #1D2128 #0D0F12 #E9EBEE #9CA2AD #2F343D #E8E1D3 #C66B3D #8EA8C3", "Libre Baskerville", "Source Serif 4", 2, "frame line lined underline fade lines outline normal roman narrow none", "columns rows timeline -", "3 minimal", "dot curtain lines lift smooth paper", "geometric"],
  ["solar-flare", "Solar Flare", "Dark Warm Bold Modern", "#140A04 #20110A #090401 #FFF0E3 #CFA98C #43261A #FF7A1A #FFD166 #FF3D6E", "Bricolage Grotesque", "Manrope", 18, "offset dock soft gradient zoom mesh soft tight number wide circle", "bento cube grid gn3t", "4 overlay", "trail iris letters magnetic smooth grain", "celestial"],
  ["black-tie", "Black Tie", "Dark Luxury Classy Minimal", "#0A0A0A #141414 #000000 #F4F1EA #A8A39A #262626 #F4F1EA #B89B5E #6B6B6B", "Playfair Display", "Mulish", 0, "center line lined underline mask none outline wide roman narrow arch", "columns rows timeline -", "3 tall", "ring iris lines shine smooth none", "geometric"],
  ["arctic-night", "Arctic Night", "Dark Tech Calm", "#0A1420 #10202F #050B12 #E8F3FF #93AECB #203A55 #66C7FF #A5F3C4 #FFD580", "Sora", "IBM Plex Sans", 14, "bento pill inset rounded rise rings outline normal pill normal circle", "bento grid timeline n3t", "4 float", "dot curtain words lift progress none", "ocean"],
  ["plum-gold", "Plum & Gold", "Dark Luxury Elegant", "#1A1024 #241632 #0F0918 #F3ECF8 #B6A5C7 #3E2C52 #D9B45A #B794F6 #F3ECF8", "DM Serif Display", "Lora", 14, "panel float gradient pill blur waves soft italic dot normal arch", "columns cube stack g3t", "3 polaroid", "spotlight wipe words shine smooth vignette", "luxury"],
  ["signal", "Signal", "Dark Tech Retro", "#050A07 #0A140E #000000 #D9FBE4 #7EA88D #183022 #2BFF88 #E9FF70 #5AD1FF", "Chakra Petch", "JetBrains Mono", 2, "index bar outline sharp skew noise none upper bracket wide frame", "stack rows grid nt", "4 minimal", "ring counter scramble tilt progress scanlines", "cyber"],
  ["roastery", "Roastery", "Dark Warm Calm Classy", "#1B130F #261B16 #110B08 #F4E8DC #BCA591 #45352B #D6965A #9CB380 #F2D3A8", "Young Serif", "Karla", 16, "framed bar soft soft drift topo outline normal line normal circle", "columns cube timeline gt", "3 polaroid", "none curtain words lift smooth paper", "geometric"],
  ["storm", "Storm", "Dark Modern Minimal Bold", "#0E1116 #161A21 #07090C #F0F3F7 #8F98A6 #262C36 #A3B1C6 #FF5D73 #F0F3F7", "Anton", "Inter", 0, "stackname float flat sharp mask none none upper number full none", "stack grid grid t", "4 overlay", "blend wipe letters magnetic skew grain", "cinema"],
  ["lagoon", "Lagoon", "Dark Nature Playful", "#071A1C #0C2629 #031012 #E3F7F5 #8DB9B5 #1B4446 #2FE0C8 #FF8A5B #F9E07F", "Lexend", "Nunito Sans", 28, "center dock soft pill zoom waves solid normal pill normal blob", "bento cube stack gn3t", "3 float", "trail iris words magnetic smooth none", "ocean"],
  ["indigo-hour", "Indigo Hour", "Dark Calm Elegant", "#0E0E24 #16163A #080816 #ECECFF #A4A4D2 #2C2C5E #9D8CFF #F7C8A0 #6FD6FF", "Fraunces", "Figtree", 18, "split line gradient underline blur rings soft italic roman normal arch", "columns grid stack g3", "3 tall", "ring curtain lines shine smooth vignette", "celestial"],
  ["copper", "Copper", "Dark Minimal Warm Modern", "#121110 #1B1A18 #0A0909 #EFEAE4 #9E978E #2D2A27 #C97B4A #EFEAE4 #7A8C8A", "Plus Jakarta Sans", "Manrope", 12, "offset side lined soft fade noise none tight pill wide frame", "columns rows grid t", "3 minimal", "dot split words lift progress grain", "build"],
  ["atelier-white", "Atelier White", "Light Classy Minimal Luxury", "#FBFAF7 #FFFFFF #1C1B19 #1C1B19 #6E6A63 #E8E4DC #1C1B19 #A08155 #C9BBA4", "Cormorant Garamond", "Mulish", 0, "marquee line lined underline mask none outline wide roman full arch", "columns rows timeline -", "3 tall", "ring iris lines shine smooth paper", "geometric"],
  ["linen", "Linen", "Light Calm Classy", "#F5F0E8 #FBF8F2 #2B2620 #2B2620 #6F665B #E3DACC #8A6A45 #5E7B6E #D9B48A", "Fraunces", "Work Sans", 14, "framed pill inset soft drift topo outline italic line normal frame", "columns cube timeline t", "3 polaroid", "dot curtain words lift smooth paper", "geometric"],
  ["swiss-modern", "Swiss Modern", "Light Minimal Bold Modern", "#FFFFFF #F4F4F4 #0A0A0A #0A0A0A #555555 #DDDDDD #0047FF #0A0A0A #FF3B30", "Inter", "Inter", 0, "stackname line flat sharp mask none none tight number full tilt", "stack rows grid t", "4 minimal", "none wipe letters magnetic progress none", "geometric"],
  ["blush-studio", "Blush Studio", "Light Playful Elegant", "#FFF5F3 #FFFFFF #3A2027 #3A2027 #8A6A71 #F3DCD8 #E0607E #6C7BD9 #F4B183", "Bricolage Grotesque", "Plus Jakarta Sans", 28, "bento dock gradient gradient zoom mesh soft gradient pill normal blob", "bento cube grid 3t", "3 float", "ring iris none tilt smooth none", "playful"],
  ["exhibit", "Exhibit", "Light Minimal Luxury Classy", "#F7F7F5 #FFFFFF #121212 #121212 #6B6B6B #E2E2DE #121212 #8C7B6B #BDB5A9", "Instrument Serif", "Instrument Sans", 0, "frame side lined underline fade none outline italic roman wide frame", "columns rows grid -", "4 tall", "dot wipe lines shine smooth grain", "geometric"],
  ["sage-stone", "Sage & Stone", "Light Nature Calm Modern", "#EFF2EC #F9FBF7 #1F2A23 #1F2A23 #5E6B62 #D6DED3 #4C7A5E #C27A4E #E3C77A", "Outfit", "Figtree", 22, "offset pill soft soft rise topo soft normal pill normal arch", "columns grid stack 3t", "3 float", "none curtain words lift smooth none", "nature"],
  ["cobalt-paper", "Cobalt Paper", "Light Bold Modern Retro", "#F2F0E9 #FBFAF5 #0B1F66 #0B1F66 #4A5680 #D7D3C5 #1638D6 #F05A28 #F6C343", "Archivo Black", "DM Sans", 4, "editorial bar outline sharp skew checker solid upper number wide default", "bento cube grid n3t", "3 framed", "blend counter letters magnetic skew halftone", "retro"],
  ["mist", "Mist", "Light Calm Modern", "#EEF2F7 #FFFFFF #1B2433 #1B2433 #5F6B7D #D7DFEA #5B7CFA #36C3B0 #F7A8B8", "Sora", "Inter", 24, "orbit dock glass gradient blur mesh soft gradient pill normal frame", "bento grid grid g3t", "4 float", "spotlight iris none tilt smooth none", "celestial"],
  ["champagne", "Champagne", "Light Luxury Classy Warm", "#F8F3EA #FFFDF8 #2A221A #2A221A #77695A #EADFCD #B08D57 #6B4E3D #D9C3A0", "Playfair Display", "Lora", 6, "center center outline outline drift none outline italic roman narrow frame", "columns cube timeline g", "3 framed", "ring curtain lines shine smooth paper", "geometric"],
  ["clay", "Clay", "Light Warm Modern", "#F3E7DD #FBF3EC #2B1D17 #2B1D17 #7A6357 #E2CDBE #C25B3F #2F6F73 #E8B04B", "Syne", "Manrope", 20, "panel line soft pill rise rings solid tight pill normal circle", "bento cube grid 3t", "3 polaroid", "trail wipe words magnetic progress none", "cafe"],
  ["monochrome", "Monochrome", "Light Minimal Classy", "#FAFAFA #FFFFFF #111111 #111111 #6A6A6A #E5E5E5 #111111 #6A6A6A #BDBDBD", "Libre Baskerville", "IBM Plex Sans", 2, "index line lined underline fade lines outline normal roman narrow arch", "columns rows timeline -", "3 minimal", "dot none lines lift progress none", "geometric"],
  ["citrus-grove", "Citrus Grove", "Light Playful Bold Modern", "#FFFBEE #FFFFFF #1F2A10 #1F2A10 #5C6650 #EFE8C8 #F06D06 #2F9E44 #FCC419", "Unbounded", "Plus Jakarta Sans", 26, "marquee dock gradient gradient zoom dots solid upper pill normal blob", "bento cube grid 3t", "4 float", "ring counter letters magnetic skew none", "playful"],
  ["harbour", "Harbour", "Light Calm Nature Classy", "#EEF5F7 #FFFFFF #0E2A36 #0E2A36 #4E6B76 #D2E3E9 #136F8A #C9573B #E9C46A", "DM Serif Display", "Karla", 10, "split bar inset underline drift waves outline italic line normal frame", "columns cube timeline t", "3 tall", "none curtain words shine smooth none", "geometric"],
  ["lilac", "Lilac", "Light Playful Calm", "#F6F2FF #FFFFFF #2A2142 #2A2142 #6F6688 #E3DBF5 #7B5CF0 #F07AA8 #5CC8C2", "Plus Jakarta Sans", "Quicksand", 26, "center pill gradient gradient blur mesh soft gradient dot normal circle", "bento grid stack g3t", "3 overlay", "spotlight split none tilt smooth none", "celestial"],
  ["kraft-studio", "Kraft Studio", "Light Warm Retro Classy", "#E9DFCF #F3ECE0 #2A2218 #2A2218 #6D5F4C #D4C5AC #9C4A2B #3F5B45 #D7A443", "Young Serif", "Karla", 4, "stackname bar lined underline skew noise outline normal roman wide frame", "stack rows timeline t", "3 polaroid", "dot wipe lines lift smooth paper", "geometric"],
  ["product", "Product", "Light Modern Tech Minimal", "#FFFFFF #F6F7F9 #0B0D12 #0B0D12 #5B6270 #E6E8EC #3B5BFF #12B886 #F59F00", "Plus Jakarta Sans", "Inter", 16, "bento dock soft soft rise grid none tight pill wide frame", "bento grid grid nt", "4 float", "dot none words lift progress none", "tech"],
  ["peony", "Peony", "Light Elegant Warm Classy", "#FCF1F0 #FFFFFF #3A1F24 #3A1F24 #85646A #F1D8D6 #B4475C #6E8B74 #E7B07C", "Cormorant Garamond", "DM Sans", 18, "orbit float inset outline mask waves outline italic roman normal arch", "columns cube stack t", "3 tall", "ring iris lines shine smooth paper", "geometric"],
  ["primary", "Primary", "Light Bold Retro Modern", "#F5F1E8 #FFFFFF #161616 #161616 #555555 #DCD4C4 #E63322 #1D4ED8 #F6B800", "Josefin Sans", "Work Sans", 0, "poster bar lined sharp skew checker solid upper number wide tilt", "stack rows grid 3t", "3 framed", "blend counter letters magnetic progress halftone", "retro"],
  ["dune", "Dune", "Light Warm Minimal Calm", "#F1E9DD #FAF5ED #2C241B #2C241B #6E6253 #E0D4C2 #A0673C #4F6D5E #D9B77E", "Outfit", "Mulish", 12, "frame pill inset soft drift topo none wide pill normal circle", "columns rows stack 3t", "3 minimal", "none curtain words lift smooth paper", "nature"],
  ["daybreak", "Daybreak", "Light Playful Modern", "#F3F7FF #FFFFFF #13213D #13213D #56627C #DDE6F7 #4F7CFF #FF7A59 #FFC94D", "Bricolage Grotesque", "Figtree", 24, "poster dock gradient gradient zoom mesh solid tight dot normal blob", "bento cube grid g3t", "3 float", "trail iris letters magnetic smooth none", "celestial"],
  ["folio", "Folio", "Light Classy Elegant Minimal", "#F6F1E7 #FFFDF8 #1A1712 #1A1712 #6B645A #E2DACB #1A1712 #9E2B25 #B89A62", "Playfair Display", "Source Serif 4", 0, "editorial line lined underline mask lines outline italic roman narrow circle", "columns rows timeline -", "3 tall", "dot wipe lines shine smooth paper", "geometric"],
  ["fresh-mint", "Fresh Mint", "Light Calm Modern", "#EEFAF5 #FFFFFF #0F2B23 #0F2B23 #4D6C62 #CFEDE2 #0FA37F #5B6CFF #FFB547", "Lexend", "Figtree", 20, "panel pill soft soft rise rings soft normal pill normal frame", "bento grid grid 3t", "4 float", "dot curtain words lift progress none", "nature"],
  ["consultant", "Consultant", "Light Minimal Modern Classy", "#F4F5F7 #FFFFFF #172033 #172033 #5A6476 #DDE1E8 #1E3A8A #B45309 #94A3B8", "DM Serif Display", "Inter", 8, "index line inset underline fade none outline normal number wide circle", "columns rows timeline t", "3 minimal", "ring none words lift progress none", "geometric"],
  ["coral-club", "Coral Club", "Light Warm Playful", "#FFF4EF #FFFFFF #2E1A14 #2E1A14 #7E6158 #F3DBD1 #F25C3B #1F8A8A #FFB703", "Sora", "Poppins", 24, "marquee dock soft gradient zoom waves solid tight pill normal circle", "bento cube grid g3t", "3 polaroid", "trail iris letters magnetic skew none", "playful"],
  ["pearl", "Pearl", "Light Luxury Elegant Classy", "#F7F6F3 #FFFFFF #23211E #23211E #6E6A64 #E5E2DC #23211E #A88B5A #D8CDBB", "Cormorant Garamond", "Manrope", 24, "framed float gradient pill blur mesh outline wide pill wide none", "columns cube stack g", "3 float", "spotlight split none shine smooth grain", "geometric"],
];

function axis(s: string, n: number): string[] {
  const p = s.trim().split(/\s+/);
  if (p.length < n) throw new Error("Bad theme row: " + s);
  return p;
}

const BASE_THEMES: Theme[] = ROWS.map((r) => {
  const [id, name, tags, cols, display, body, radius, style, pf, st, fxs, motif] = r;
  const c = axis(cols, 9);
  const s = axis(style, 10);
  const [about, skills, work, fx] = axis(pf, 4);
  const [grid, product] = axis(st, 2);
  const f = axis(fxs || "none none none none none none", 6);
  const lum = (h: string) => {
    const n = parseInt(h.slice(1), 16);
    const v = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  };
  return {
    id, name, tags: tags.split(" "), dark: lum(c[0]) < 0.2,
    colors: { bg: c[0], surface: c[1], deep: c[2], text: c[3], soft: c[4], line: c[5], c1: c[6], c2: c[7], c3: c[8] },
    display, body, radius: +radius,
    style: { layout: s[0], heroArt: s[10] || "default", nav: s[1], cards: s[2], buttons: s[3], motionStyle: s[4], pattern: s[5], ornament: s[6], heading: s[7], shead: s[8], width: s[9] },
    portfolio: { about, skills, work, glow: fx.includes("g"), network: fx.includes("n"), three: fx.includes("3"), ticker: fx.includes("t") },
    store: { grid, product },
    motif: motif || Motifs.themes[id] || "tech",
    kit: Layouts.has(id) ? id : "classic",
    fx: { cursor: f[0], loader: f[1], textfx: f[2], hoverfx: f[3], scrollfx: f[4], overlay: f[5] },
  };
});

/** True when a theme turns on any interaction effect. */
export const hasFx = (t: Theme) => FX_KEYS.some((k) => t.fx[k] !== "none");

export const THEME_TAGS = ["Signature", "Modern", "Classy", "Dark", "Light", "Bold", "Minimal", "Elegant", "Playful", "Tech", "Calm", "Warm", "Nature", "Retro", "Luxury", "Motion"];

/** Signature themes: a whole new portfolio layout, not just a restyle. */
const VELOCITY: Theme = {
  id: "velocity", name: "Velocity", tags: ["Signature", "Dark", "Bold"], dark: true, signature: true,
  blurb: "Full-screen name, portrait and signature, a moments strip, on/off cards, career rows, partners and a giant footer. Its own preloader, menu, cursor and scroll effects.",
  colors: { bg: "#1D2117", surface: "#272C1F", deep: "#13160F", text: "#F2F2EA", soft: "#ABAF9D", line: "#3A402F", c1: "#D4F53C", c2: "#EDEDE3", c3: "#8FA33A" },
  display: "Anton", body: "Inter", radius: 18,
  style: { layout: "velocity", nav: "bar", cards: "soft", buttons: "pill", motionStyle: "rise", pattern: "none", ornament: "none", heading: "upper", shead: "number", width: "wide" },
  portfolio: { about: "bento", skills: "grid", work: "timeline", glow: false, network: false, three: true, ticker: true },
  store: { grid: "3", product: "overlay" },
  motif: "geometric", kit: "classic",
  fx: { cursor: "none", loader: "none", textfx: "none", hoverfx: "none", scrollfx: "none", overlay: "none" },
};

export const THEMES: Theme[] = [VELOCITY, ...BASE_THEMES];

const styleValues = (t: Theme) => ({ preset: t.id, ...t.style, ...t.fx, motif: t.motif, introBg: t.colors.deep, introFg: onColor(t.colors.deep) });

/** Portfolio content.theme values for a theme. Keeps keys the theme doesn't set. */
export function portfolioThemeValues(t: Theme): Record<string, unknown> {
  const c = t.colors;
  return {
    bg: c.bg, surface: c.surface, deep: c.deep, text: c.text, soft: c.soft, line: c.line, c1: c.c1, c2: c.c2, c3: c.c3, glow: t.dark ? c.c3 : c.c1,
    fontDisplay: t.display, fontBody: t.body, radius: t.radius,
    showGrid: t.style.pattern !== "none", showGlow: t.portfolio.glow, showNetwork: t.portfolio.network, show3D: t.portfolio.three,
    showSolids: t.style.ornament !== "none", showTicker: t.portfolio.ticker, motion: t.style.motionStyle !== "none",
    ...styleValues(t), kit: t.kit, about: t.portfolio.about, skills: t.portfolio.skills, work: t.portfolio.work,
  };
}

/** Shop content.theme values for a theme. */
export function storeThemeValues(t: Theme): Record<string, unknown> {
  const c = t.colors;
  return {
    bg: c.bg, surface: c.surface, text: c.text, soft: c.soft, line: c.line, accent: c.c1, accent2: c.c3, sale: c.c2, deep: c.deep,
    fontDisplay: t.display, fontBody: t.body, radius: Math.min(t.radius, 28),
    ...styleValues(t), layout: t.style.layout === "velocity" ? "stacked" : t.style.layout, grid: t.store.grid, product: t.store.product,
  };
}

export const themeById = (id: string) => THEMES.find((t) => t.id === id);
