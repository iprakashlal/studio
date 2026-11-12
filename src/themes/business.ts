// Themes for the Business / professional portfolio template: serious, modern and classy looks for companies,
// firms, agencies and practices. They have their own IDs (B-01 …) and their own style options, which match
// public/templates/business/assets/biz.css.
import { type Axis, type Theme, FX_KEYS, onColor } from "./catalog";

export const BIZ_AXES: Record<string, Axis> = {
  layout: { key: "layout", label: "Hero layout", options: [["split", "Text left, picture right"], ["center", "Centred, picture below"], ["editorial", "Editorial: big headline, wide picture"], ["panel", "Dark panel"], ["full", "Full-width photo behind the text"]] },
  heroArt: { key: "heroArt", label: "Hero picture frame", options: [["default", "Plain"], ["frame", "Thin frame"], ["offset", "Offset shadow"], ["arch", "Arch"]] },
  nav: { key: "nav", label: "Menu", options: [["bar", "Clean bar"], ["float", "Floating panel"], ["line", "Underlined bar"], ["dark", "Dark bar"], ["center", "Links in the centre"]] },
  cards: { key: "cards", label: "Cards", options: [["outline", "Outlined"], ["flat", "Flat"], ["elevated", "Soft shadow"], ["glass", "Glass"], ["lined", "Editorial rule"], ["accent", "Accent top edge"]] },
  buttons: { key: "buttons", label: "Buttons", options: [["rounded", "Rounded"], ["pill", "Pill"], ["sharp", "Square"], ["outline", "Outline"], ["underline", "Underlined text"]] },
  heading: { key: "heading", label: "Headings", options: [["normal", "Bold"], ["upper", "CAPITALS"], ["serif", "Light serif, italic highlights"], ["light", "Light"]] },
  shead: { key: "shead", label: "Section titles", options: [["label", "Small label"], ["line", "Label with a rule"], ["number", "Numbered"], ["center", "Centred"], ["bar", "Accent bar"]] },
  pattern: { key: "pattern", label: "Background", options: [["none", "Plain"], ["grid", "Fine grid"], ["dots", "Dots"], ["lines", "Column lines"], ["mesh", "Soft colour glow in the hero"]] },
  bands: { key: "bands", label: "Section bands", options: [["soft", "Alternate soft bands"], ["deep", "Alternate dark bands"], ["lines", "Divider lines"], ["none", "None"]] },
  motionStyle: { key: "motionStyle", label: "Reveal animation", options: [["rise", "Rise in"], ["fade", "Fade in"], ["none", "None"]] },
  width: { key: "width", label: "Page width", options: [["normal", "Standard"], ["wide", "Wide"]] },
};

export const BIZ_TAGS = ["Corporate", "Finance", "Legal", "Consulting", "Tech", "Health", "Creative", "Industry", "Property", "Hospitality", "Light", "Dark", "Classy", "Modern", "Bold", "Minimal", "Warm", "Calm", "Nature", "Luxury"];

// id | name | tags | colours (bg surface deep text soft line c1 c2 c3) | display | body | radius |
// style "layout nav cards buttons heading shead pattern bands heroArt motion width" | blurb
type Row = [string, string, string, string, string, string, number, string, string];
const ROWS: Row[] = [
  ["meridian", "Meridian", "Corporate Consulting Light Modern", "#F7F8FA #FFFFFF #0E1B2C #0E1B2C #5A6678 #DDE2EA #1D4ED8 #0E7490 #F59E0B", "Plus Jakarta Sans", "Inter", 12, "split bar outline rounded normal label none soft default rise normal", "Clean corporate blue for consultancies and service firms."],
  ["sterling", "Sterling", "Finance Classy Light", "#FAFAF7 #FFFFFF #13233A #13233A #5E6675 #E3E2DA #13233A #8C6D2F #B8913A", "DM Serif Display", "Inter", 4, "split line lined sharp serif line none lines frame fade normal", "Navy and brass for banks, wealth and advisory."],
  ["counsel", "Counsel", "Legal Classy Warm", "#F6F3EE #FFFFFF #2A1E17 #231A14 #6A5E55 #E2DAD0 #6B2D2A #2F4A3A #B08D57", "Cormorant Garamond", "Lora", 2, "editorial line lined underline serif number none lines default fade normal", "A law-firm look: serif headlines, ruled sections, oxblood accent."],
  ["atlas", "Atlas", "Consulting Corporate Modern Light", "#FFFFFF #F4F6F9 #0B2545 #0B2545 #55657A #E1E6EE #13315C #8DA9C4 #EEB902", "Manrope", "Manrope", 8, "split float elevated rounded normal line dots soft offset rise normal", "Steady navy with a gold spark for strategy firms."],
  ["quarry", "Quarry", "Creative Industry Minimal Light", "#F2F1EE #FFFFFF #1A1A1A #1A1A1A #6B6B6B #D9D7D2 #1A1A1A #8A8173 #C4502E", "Space Grotesk", "Inter", 0, "editorial line lined underline upper number lines lines frame fade wide", "Architecture-studio minimalism with a terracotta accent."],
  ["harbor", "Harbor", "Industry Corporate Bold Light", "#F5F7FA #FFFFFF #0A2342 #0A2342 #4F5D75 #D6DEE8 #F26B21 #0A2342 #2CA58D", "Sora", "Work Sans", 10, "panel bar outline rounded upper label grid soft default rise normal", "Logistics and operations: navy panel, signal orange."],
  ["clinic", "Clinic", "Health Calm Light Modern", "#F4FAF9 #FFFFFF #0F3B3A #10302F #4F6B69 #D3E6E3 #0E8C7F #3B82F6 #F4A261", "Figtree", "Figtree", 16, "split float flat pill normal center none soft arch rise normal", "Calm teal for clinics, labs and health services."],
  ["summit", "Summit", "Corporate Tech Dark Modern", "#0B1120 #111A2E #050913 #E7ECF5 #9AA6BD #22304A #3B82F6 #22D3EE #F59E0B", "Inter", "Inter", 12, "center float glass rounded normal center mesh lines default rise normal", "Night-blue corporate with glass cards and a soft glow."],
  ["graphite-co", "Graphite & Co", "Creative Minimal Dark Classy", "#121212 #1B1B1B #0A0A0A #F2F2F2 #A3A3A3 #2C2C2C #F2F2F2 #A3A3A3 #E5B65C", "Space Grotesk", "IBM Plex Sans", 6, "editorial line lined underline light line none lines frame fade wide", "Monochrome studio look with one warm highlight."],
  ["verdant", "Verdant", "Nature Consulting Calm Light", "#F5F7F2 #FFFFFF #1F3A2B #1C2B22 #5C6B60 #DCE3D6 #2F6B46 #A3B18A #D99A4E", "Fraunces", "Work Sans", 14, "split bar elevated pill serif label dots soft offset rise normal", "Forest greens for sustainability and impact firms."],
  ["ledger", "Ledger", "Finance Classy Light Calm", "#FBFBF8 #FFFFFF #1E2A38 #1E2A38 #5D6875 #E4E5E0 #2E5E4E #1E2A38 #C59B3B", "Libre Baskerville", "IBM Plex Sans", 4, "split line outline sharp serif bar none lines frame fade normal", "Accountants and auditors: precise, quiet, trustworthy."],
  ["vector", "Vector", "Tech Modern Light Bold", "#FFFFFF #F6F7FB #0F172A #0F172A #64748B #E2E8F0 #6366F1 #06B6D4 #F43F5E", "Plus Jakarta Sans", "Inter", 14, "center float elevated pill normal center mesh soft default rise normal", "SaaS and product companies: indigo glow, centred hero."],
  ["onyx-gold", "Onyx Gold", "Luxury Finance Dark Classy", "#0E0D0B #17150F #070605 #F3EDE2 #ABA394 #2B271F #C9A45C #8C7A5B #E6D3A3", "Cormorant Garamond", "Manrope", 2, "editorial line lined underline serif line none lines frame fade normal", "Private banking and luxury: black, champagne gold."],
  ["riverstone", "Riverstone", "Property Warm Classy Light", "#FAF7F2 #FFFFFF #2D2A26 #26231F #6E665C #E8E1D6 #9C5B37 #2D4B4F #C9A227", "Playfair Display", "DM Sans", 10, "full float elevated rounded serif label none soft arch rise normal", "Real estate and developers: full-width photo hero."],
  ["kinetic", "Kinetic", "Creative Bold Modern Light", "#FFFFFF #F3F4F6 #111111 #111111 #555555 #E5E7EB #2F3BFF #111111 #FFD23F", "Bricolage Grotesque", "DM Sans", 0, "editorial bar outline sharp upper number grid deep default rise wide", "Agency energy: electric blue, black bands, big type."],
  ["tidewater", "Tidewater", "Corporate Calm Light Modern", "#F3F7FA #FFFFFF #0B3954 #0B3954 #50697D #D6E3EC #087E8B #0B3954 #FF5A5F", "Sora", "Inter", 10, "split bar flat rounded normal line none soft offset rise normal", "Maritime teal for shipping, trade and travel."],
  ["ironworks", "Ironworks", "Industry Bold Dark", "#16181B #1F2226 #0D0E10 #EDEEF0 #A0A6AE #30343A #F5A524 #64748B #E5484D", "Oswald", "IBM Plex Sans", 2, "panel dark outline sharp upper bar grid lines default rise normal", "Manufacturing and engineering: steel, amber, condensed type."],
  ["prism", "Prism", "Creative Modern Light Bold", "#FBFAFF #FFFFFF #1E1B4B #1E1B4B #605D7A #E5E2F5 #7C3AED #EC4899 #F59E0B", "Outfit", "Figtree", 18, "center float elevated pill normal center mesh soft default rise normal", "Design and marketing agencies: violet and pink glow."],
  ["cedar", "Cedar", "Consulting Warm Classy Light", "#F7F3EC #FFFDF9 #3B2F26 #2E251E #6F6257 #E6DCCD #8B5E34 #2F4F4F #C98B4E", "Young Serif", "Karla", 8, "split line lined rounded serif line none lines frame fade normal", "Warm wood tones for advisors and family practices."],
  ["polar", "Polar", "Minimal Corporate Light", "#FFFFFF #FAFAFA #111827 #111827 #6B7280 #E5E7EB #111827 #6B7280 #2563EB", "Inter", "Inter", 6, "center line flat outline light center none lines default fade normal", "Pure white minimalism with a single blue link colour."],
  ["crimson-quill", "Crimson Quill", "Legal Bold Classy Light", "#FAF8F5 #FFFFFF #2B0F12 #1F1A17 #66605A #E6E0D8 #8B1E2D #2B0F12 #C8A15A", "Playfair Display", "Source Serif 4", 2, "editorial dark lined sharp serif number none soft frame fade normal", "Litigation and chambers: deep crimson, dark menu."],
  ["nimbus", "Nimbus", "Tech Modern Light Calm", "#F6F9FF #FFFFFF #0B1F44 #0B1F44 #556483 #DCE5F5 #2563EB #7C3AED #10B981", "Lexend", "Inter", 12, "split float glass pill normal label dots soft default rise normal", "Cloud and IT services: airy blue with glass cards."],
  ["saffron", "Saffron", "Warm Hospitality Light Classy", "#FFF9F0 #FFFFFF #3A1F12 #2E1A10 #74604F #F0E1CC #D97706 #7C2D12 #0F766E", "DM Serif Display", "Mulish", 10, "split bar elevated rounded serif label dots soft offset rise normal", "Saffron and terracotta for heritage brands and hospitality."],
  ["midnight-firm", "Midnight Firm", "Corporate Legal Dark Classy", "#0C1424 #121D33 #070C16 #E8ECF4 #98A3B8 #233050 #C8A45D #5B7DB1 #E8D5A8", "Libre Baskerville", "Inter", 4, "editorial line lined underline serif line none lines frame fade normal", "Midnight navy and gold: a senior partnership feel."],
  ["pulse", "Pulse", "Health Modern Light Bold", "#FFFFFF #F5F8FF #0A2540 #0A2540 #5B6B82 #E1E8F5 #0EA5E9 #14B8A6 #F97316", "Poppins", "Nunito Sans", 16, "center float elevated pill normal center none soft arch rise normal", "Healthtech and diagnostics: bright, friendly, clear."],
  ["granite", "Granite", "Industry Corporate Light Bold", "#EEF0F2 #FFFFFF #1F2933 #1F2933 #5B6672 #D4D9DE #2563EB #1F2933 #F59E0B", "IBM Plex Sans", "IBM Plex Sans", 4, "split dark outline sharp upper bar grid soft default rise normal", "Engineering and infrastructure: technical grid, plain sans."],
  ["orchard", "Orchard", "Nature Warm Light", "#F8FAF0 #FFFFFF #233318 #243018 #5E6A4E #E1E7CF #4D7C0F #A16207 #65A30D", "Fraunces", "Nunito Sans", 14, "full bar elevated pill serif label none soft offset rise normal", "Agriculture, food and farms: fresh greens, photo hero."],
  ["slate-pro", "Slate Pro", "Corporate Minimal Light Calm", "#F8FAFC #FFFFFF #1E293B #1E293B #64748B #E2E8F0 #334155 #0EA5E9 #F59E0B", "Manrope", "Manrope", 10, "split line outline rounded normal line none lines frame rise normal", "Neutral slate for any professional service."],
  ["ember", "Ember", "Creative Bold Dark", "#120E0C #1C1613 #090706 #F6EFEA #B3A69C #33291F #FF5B2E #FFB547 #2EC4B6", "Syne", "DM Sans", 6, "editorial line lined underline upper number none deep default rise wide", "Bold dark agency with ember orange."],
  ["aurum", "Aurum", "Finance Luxury Classy Light", "#F9F7F2 #FFFFFF #1B2A2F #1B2A2F #5F6B6E #E4E0D5 #1B4D3E #B8963E #1B2A2F", "Cormorant Garamond", "Inter", 2, "center line lined sharp serif center none lines frame fade normal", "Wealth management: bottle green, brass, centred."],
  ["metro", "Metro", "Creative Bold Light", "#F4F4F0 #FFFFFF #141414 #141414 #5C5C5C #DDDDD5 #E63946 #141414 #F1C40F", "Archivo Black", "Work Sans", 0, "panel bar outline sharp upper number none deep default rise normal", "Urban poster style: black panels, signal red."],
  ["lagoon", "Lagoon", "Hospitality Calm Light Classy", "#F2FAF9 #FFFFFF #0B3D3A #0B3D3A #4C6E6B #CDE6E2 #0F766E #F59E0B #E76F51", "Playfair Display", "Figtree", 16, "full float elevated pill serif center none soft arch rise normal", "Resorts, travel and hospitality: lagoon teal and sun."],
  ["quantum", "Quantum", "Tech Dark Modern Bold", "#070B14 #0E1524 #03060C #E2E8F0 #8C9AB3 #1C2840 #22D3EE #A78BFA #34D399", "Space Grotesk", "Inter", 10, "center float glass rounded normal center grid lines default rise wide", "Deep-tech and AI companies: cyan on midnight."],
  ["parchment", "Parchment", "Classy Warm Light Legal", "#F5EFE3 #FBF7EE #2B2420 #2B2420 #6E6155 #E3D7C3 #7A3B2E #3D5A4A #B98B4E", "Instrument Serif", "Instrument Sans", 4, "editorial line lined underline serif number none lines frame fade normal", "Publishing, research and heritage institutions."],
  ["civic", "Civic", "Corporate Calm Light", "#FFFFFF #F5F7FA #13294B #13294B #5A6779 #DDE3EC #0057B8 #13294B #FFC72C", "Source Serif 4", "IBM Plex Sans", 6, "split dark outline rounded normal bar none soft default fade normal", "Public sector, NGOs and education: official and clear."],
  ["bloom", "Bloom", "Health Warm Light Calm", "#FFF8F5 #FFFFFF #3D2B2B #33231F #7A6560 #F2E2DA #C2665A #6B8F71 #E9B872", "Fraunces", "Figtree", 20, "split float flat pill serif center none soft arch rise normal", "Wellness, therapy and care: blush and sage."],
  ["titan", "Titan", "Industry Bold Light", "#FFFFFF #F5F5F4 #1C1917 #1C1917 #57534E #E7E5E4 #EAB308 #1C1917 #DC2626", "Oswald", "Inter", 0, "panel dark outline sharp upper bar none deep default rise normal", "Construction and contractors: safety yellow on black."],
  ["azure-capital", "Azure Capital", "Finance Modern Light Corporate", "#F5F8FC #FFFFFF #0A1F3C #0A1F3C #56677F #DCE4EF #0052CC #00A3BF #36B37E", "Sora", "Inter", 8, "split float elevated rounded normal label dots soft default rise normal", "Fintech and investment: confident blue with growth green."],
  ["noir-studio", "Noir Studio", "Creative Minimal Dark", "#0A0A0A #141414 #000000 #FAFAFA #A1A1A1 #262626 #FAFAFA #A1A1A1 #FF4D00", "Bricolage Grotesque", "Inter", 0, "editorial line lined underline light number none lines default fade wide", "Black-and-white studio with one hot accent."],
  ["sage-partners", "Sage & Partners", "Legal Calm Classy Light", "#F4F6F2 #FFFFFF #233229 #1E2A23 #5F6B62 #DCE2D7 #3F5E4A #1E2A23 #B79A5B", "DM Serif Display", "Karla", 6, "split line lined rounded serif line none lines frame fade normal", "Advisory and family law: sage green, calm serif."],
  ["voltage", "Voltage", "Industry Tech Dark Bold", "#0F1115 #171A21 #08090C #F1F3F7 #9AA1AE #272C36 #FACC15 #22C55E #3B82F6", "Sora", "Inter", 8, "panel float glass rounded upper label grid lines default rise normal", "Energy, EV and utilities: charged yellow on graphite."],
  ["linen-co", "Linen & Co", "Warm Classy Light Hospitality", "#FAF6F1 #FFFFFF #3A3029 #2F2722 #766A60 #E9E0D5 #A47551 #5F7161 #D4A373", "Cormorant Garamond", "Mulish", 8, "center line flat underline serif center none soft arch fade normal", "Boutique studios, interiors and events."],
  ["cobalt", "Cobalt", "Corporate Bold Light Modern", "#FFFFFF #F3F6FF #0A1A5C #0A1A5C #4D5B85 #DCE2F7 #1E3FE0 #0A1A5C #FF8A00", "Plus Jakarta Sans", "Plus Jakarta Sans", 10, "split bar elevated rounded upper label none deep default rise normal", "Big-company confidence: cobalt with orange highlights."],
  ["terra", "Terra", "Property Creative Warm Light", "#F3EEE7 #FBF8F3 #2F2A25 #2F2A25 #6F655B #E0D6C8 #B5562B #3F4E4A #D9A15B", "Space Grotesk", "Work Sans", 2, "editorial line lined sharp upper number lines lines frame fade wide", "Architects and builders: earth tones, column grid."],
  ["vital", "Vital", "Health Modern Light Calm", "#F7FCFB #FFFFFF #063B3A #063B3A #4A6966 #D4EAE7 #10B981 #0EA5E9 #F59E0B", "Lexend", "Nunito Sans", 14, "split float flat pill normal center dots soft arch rise normal", "Pharmacies, clinics and fitness: fresh mint."],
  ["regent", "Regent", "Hospitality Luxury Classy Light", "#F8F5EF #FFFFFF #1F1A17 #1F1A17 #6B625A #E5DED3 #1F1A17 #8B6F47 #C2A36B", "Playfair Display", "Manrope", 0, "full line lined underline serif center none lines frame fade normal", "Hotels and fine dining: photo-led, quietly luxurious."],
  ["circuit", "Circuit", "Tech Corporate Light", "#F5F7FB #FFFFFF #101828 #101828 #5B6476 #E0E5EE #0F62FE #24A148 #F1C21B", "IBM Plex Sans", "IBM Plex Sans", 0, "split dark outline sharp normal bar grid soft default rise normal", "IT services and systems integrators: enterprise blue."],
  ["opal", "Opal", "Finance Tech Dark Modern", "#0D0F1A #151829 #070810 #ECEDF7 #9799B3 #262A44 #8B5CF6 #22D3EE #F472B6", "Outfit", "Inter", 14, "center float glass pill normal center mesh lines default rise normal", "Fintech and Web3: violet and cyan on deep blue."],
  ["heritage", "Heritage", "Warm Classy Light Corporate", "#F7F1E8 #FFFCF7 #3B2A1A #2E2015 #6F5E4E #E8DAC5 #7B4B2A #2F5D50 #C9973F", "Libre Baskerville", "Lora", 4, "split bar lined rounded serif line dots soft frame fade normal", "Family businesses and long-established brands."],
  ["apex", "Apex", "Corporate Classy Minimal Light", "#FFFFFF #F7F7F5 #111418 #111418 #5F656D #E4E4E0 #111418 #6B7280 #B08D57", "Instrument Serif", "Inter", 2, "editorial line lined underline serif line none lines frame fade wide", "Executive search and boards: black, white, brass."],
];

const lumHex = (h: string) => {
  const n = parseInt(h.slice(1), 16);
  const v = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
};
const NO_FX = Object.fromEntries(FX_KEYS.map((k) => [k, "none"])) as Theme["fx"];

export type BizTheme = Theme & { biz: { bands: string } };
export const BIZ_THEMES: BizTheme[] = ROWS.map(([slug, name, tags, cols, display, body, radius, style, blurb]) => {
  const c = cols.split(" "), s = style.split(" ");
  if (c.length !== 9 || s.length !== 11) throw new Error("Bad business theme row: " + slug);
  const [layout, nav, cards, buttons, heading, shead, pattern, bands, heroArt, motionStyle, width] = s;
  return {
    id: "biz-" + slug, name, tags: tags.split(" "), dark: lumHex(c[0]) < 0.2, blurb,
    colors: { bg: c[0], surface: c[1], deep: c[2], text: c[3], soft: c[4], line: c[5], c1: c[6], c2: c[7], c3: c[8] },
    display, body, radius,
    style: { layout, heroArt, nav, cards, buttons, motionStyle, pattern, ornament: "none", heading, shead, width },
    portfolio: { about: "bento", skills: "cube", work: "deck", glow: false, network: false, three: false, ticker: false },
    store: { grid: "auto", product: "classic" },
    fx: NO_FX, motif: "geometric", kit: "classic", biz: { bands },
  };
});

/** Stable IDs for business themes: B-01 … in the order above. Add new themes at the end only. */
export const BIZ_CODES: Record<string, string> = Object.fromEntries(BIZ_THEMES.map((t, i) => [t.id, "B-" + String(i + 1).padStart(2, "0")]));
export const isBizTheme = (id: string) => id.startsWith("biz-");

/** Business content.theme values for a theme. */
export function businessThemeValues(t: Theme): Record<string, unknown> {
  const c = t.colors, s = t.style, bt = t as Partial<BizTheme>;
  return {
    bg: c.bg, surface: c.surface, deep: c.deep, text: c.text, soft: c.soft, line: c.line, c1: c.c1, c2: c.c2, c3: c.c3,
    fontDisplay: t.display, fontBody: t.body, radius: t.radius, preset: t.id,
    layout: BIZ_AXES.layout.options.some(([v]) => v === s.layout) ? s.layout : "split",
    heroArt: s.heroArt || "default", nav: BIZ_AXES.nav.options.some(([v]) => v === s.nav) ? s.nav : "bar",
    cards: BIZ_AXES.cards.options.some(([v]) => v === s.cards) ? s.cards : "outline",
    buttons: BIZ_AXES.buttons.options.some(([v]) => v === s.buttons) ? s.buttons : "rounded",
    heading: BIZ_AXES.heading.options.some(([v]) => v === s.heading) ? s.heading : "normal",
    shead: BIZ_AXES.shead.options.some(([v]) => v === s.shead) ? s.shead : "label",
    pattern: BIZ_AXES.pattern.options.some(([v]) => v === s.pattern) ? s.pattern : "none",
    bands: bt.biz?.bands || "soft", motionStyle: s.motionStyle === "none" ? "none" : s.motionStyle === "fade" ? "fade" : "rise", width: s.width === "wide" ? "wide" : "normal",
    ...t.fx, introBg: c.deep, introFg: onColor(c.deep),
  };
}
