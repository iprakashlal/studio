// The theme catalogue: 54 complete looks shared by the portfolio and shop templates.
// A theme sets colours, fonts and corners, plus a set of style "axes" (layout, cards, buttons,
// motion, background, ornaments, headings…). Choosing one writes those values into content.theme;
// every value stays editable afterwards under Design → Theme & layout.

export type Axis = { key: string; label: string; hint?: string; options: [string, string][] };

/** Style axes both templates understand. The first option of each is the classic look. */
export const AXES: Record<string, Axis> = {
  layout: { key: "layout", label: "Hero layout", options: [["split", "Split: text left, art right"], ["reverse", "Reverse: art left, text right"], ["center", "Centred"], ["stacked", "Stacked: text, then a wide art band"], ["minimal", "Minimal: big type only"]] },
  nav: { key: "nav", label: "Menu style", options: [["pill", "Floating pill"], ["bar", "Full-width bar"], ["float", "Transparent, no frame"], ["center", "Centred"]] },
  cards: { key: "cards", label: "Card style", options: [["soft", "Soft"], ["outline", "Outline"], ["elevated", "Elevated shadow"], ["brutal", "Bold border + hard shadow"], ["glass", "Frosted glass"], ["flat", "Flat"]] },
  buttons: { key: "buttons", label: "Button style", options: [["brutal", "Offset shadow"], ["rounded", "Rounded"], ["pill", "Pill"], ["sharp", "Square"], ["outline", "Outline"], ["glow", "Glow"]] },
  motionStyle: { key: "motionStyle", label: "Animation", options: [["rise", "Rise in"], ["fade", "Fade in"], ["zoom", "Zoom in"], ["slide", "Slide in from the side"], ["blur", "Blur to sharp"], ["flip", "Flip up"], ["none", "No animation"]] },
  pattern: { key: "pattern", label: "Background pattern", options: [["grid", "Blueprint grid"], ["dots", "Dots"], ["lines", "Horizontal lines"], ["diagonal", "Diagonal stripes"], ["waves", "Waves"], ["cross", "Crosses"], ["none", "Plain"]] },
  ornament: { key: "ornament", label: "Decorative shapes", options: [["solid", "Solid shapes"], ["outline", "Outlined shapes"], ["soft", "Soft blurred blobs"], ["none", "None"]] },
  heading: { key: "heading", label: "Heading style", options: [["normal", "Normal"], ["upper", "UPPERCASE"], ["italic", "Italic accent"], ["tight", "Tight & heavy"]] },
  shead: { key: "shead", label: "Section label", options: [["dot", "● Dot"], ["plain", "Plain"], ["number", "01 Numbered"], ["line", "— Line"], ["bracket", "[ Brackets ]"], ["slash", "// Slash"]] },
  width: { key: "width", label: "Page width", options: [["normal", "Normal"], ["wide", "Wide"], ["narrow", "Narrow, editorial"]] },
};
/** Portfolio-only section layouts. */
export const PORTFOLIO_AXES: Record<string, Axis> = {
  about: { key: "about", label: "About layout", options: [["bento", "Bento grid"], ["stack", "Simple stack"]] },
  skills: { key: "skills", label: "Skills layout", options: [["cube", "3D cube + list"], ["grid", "Card grid"]] },
  work: { key: "work", label: "Work layout", options: [["stack", "Stacking card deck"], ["timeline", "Timeline"]] },
};
/** Shop-only layouts. */
export const STORE_AXES: Record<string, Axis> = {
  grid: { key: "grid", label: "Products per row", options: [["auto", "Automatic"], ["2", "2 large"], ["3", "3"], ["4", "4 compact"]] },
  product: { key: "product", label: "Product card", options: [["classic", "Classic"], ["framed", "Framed card"], ["overlay", "Name over image"], ["minimal", "Minimal"]] },
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
  style: { layout: string; nav: string; cards: string; buttons: string; motionStyle: string; pattern: string; ornament: string; heading: string; shead: string; width: string };
  portfolio: { about: string; skills: string; work: string; glow: boolean; network: boolean; three: boolean; ticker: boolean };
  store: { grid: string; product: string };
};

type Row = [string, string, string, string, string, string, number, string, string, string];
// id | name | tags | colors (bg surface deep text soft line c1 c2 c3) | display | body | radius |
// style "layout nav cards buttons motion pattern ornament heading shead width" |
// portfolio "about skills work fx" (fx letters: g glow, n network, 3 three-d, t ticker) | store "grid product"
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
];

function axis(s: string, n: number): string[] {
  const p = s.trim().split(/\s+/);
  if (p.length < n) throw new Error("Bad theme row: " + s);
  return p;
}

export const THEMES: Theme[] = ROWS.map((r) => {
  const [id, name, tags, cols, display, body, radius, style, pf, st] = r;
  const c = axis(cols, 9);
  const s = axis(style, 10);
  const [about, skills, work, fx] = axis(pf, 4);
  const [grid, product] = axis(st, 2);
  const lum = (h: string) => {
    const n = parseInt(h.slice(1), 16);
    const v = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  };
  return {
    id, name, tags: tags.split(" "), dark: lum(c[0]) < 0.2,
    colors: { bg: c[0], surface: c[1], deep: c[2], text: c[3], soft: c[4], line: c[5], c1: c[6], c2: c[7], c3: c[8] },
    display, body, radius: +radius,
    style: { layout: s[0], nav: s[1], cards: s[2], buttons: s[3], motionStyle: s[4], pattern: s[5], ornament: s[6], heading: s[7], shead: s[8], width: s[9] },
    portfolio: { about, skills, work, glow: fx.includes("g"), network: fx.includes("n"), three: fx.includes("3"), ticker: fx.includes("t") },
    store: { grid, product },
  };
});

export const THEME_TAGS = ["Dark", "Light", "Bold", "Minimal", "Elegant", "Playful", "Tech", "Calm", "Warm", "Nature", "Retro", "Luxury"];

const styleValues = (t: Theme) => ({ preset: t.id, ...t.style });

/** Portfolio content.theme values for a theme. Keeps keys the theme doesn't set. */
export function portfolioThemeValues(t: Theme): Record<string, unknown> {
  const c = t.colors;
  return {
    bg: c.bg, surface: c.surface, deep: c.deep, text: c.text, soft: c.soft, line: c.line, c1: c.c1, c2: c.c2, c3: c.c3, glow: t.dark ? c.c3 : c.c1,
    fontDisplay: t.display, fontBody: t.body, radius: t.radius,
    showGrid: t.style.pattern !== "none", showGlow: t.portfolio.glow, showNetwork: t.portfolio.network, show3D: t.portfolio.three,
    showSolids: t.style.ornament !== "none", showTicker: t.portfolio.ticker, motion: t.style.motionStyle !== "none",
    ...styleValues(t), about: t.portfolio.about, skills: t.portfolio.skills, work: t.portfolio.work,
  };
}

/** Shop content.theme values for a theme. */
export function storeThemeValues(t: Theme): Record<string, unknown> {
  const c = t.colors;
  return {
    bg: c.bg, surface: c.surface, text: c.text, soft: c.soft, line: c.line, accent: c.c1, accent2: c.c3, sale: c.c2, deep: c.deep,
    fontDisplay: t.display, fontBody: t.body, radius: Math.min(t.radius, 28),
    ...styleValues(t), grid: t.store.grid, product: t.store.product,
  };
}

export const themeById = (id: string) => THEMES.find((t) => t.id === id);
