import type { Category, Field, TemplateDef } from "./types";
import { AXES, BODY_FONTS, DISPLAY_FONTS, KIT_AXIS, LINE_BREAKS_AXIS, PORTFOLIO_AXES, THEMES, onColor, portfolioThemeValues } from "../themes/catalog";
import { adminCategory, seoCategory } from "./common";
import VELOCITY_DEFAULTS from "./velocity-defaults.json";
import { themeCards } from "../themes/fields";

const SECTION_NAMES: Record<string, string> = { about: "About", skills: "Skills cube", work: "Work deck", projects: "Projects", learning: "Learning", contact: "Contact" };
const SOLIDS: [string, string][] = [["sphere", "Sphere · element 1"], ["cube", "Cube · element 2"], ["pyramid", "Pyramid · element 3"], ["octahedron", "Octahedron · element 4"], ["torus", "Torus · element 5"], ["icosahedron", "Icosahedron · element 6"], ["cylinder", "Cylinder · element 8"]];
const FONTS_D = DISPLAY_FONTS;
const FONTS_B = BODY_FONTS;

const g2 = (...fields: Field[]): Field => ({ t: "grid", cols: 2, fields });
const g3 = (...fields: Field[]): Field => ({ t: "grid", cols: 3, fields });

const schema: Category[] = [
  {
    id: "look", label: "Theme & layout", group: "Design", desc: `Choose from ${THEMES.length} themes, then fine-tune the layout, elements and animation.`,
    cards: themeCards([KIT_AXIS, PORTFOLIO_AXES.about, PORTFOLIO_AXES.skills, PORTFOLIO_AXES.work], "Animation needs “Animations” switched on under Brand & theme. Visitors who ask their device for reduced motion always get a still page.",
      { ...AXES.layout, options: [...AXES.layout.options, ["velocity", "★ Velocity: signature layout"]] }),
  },
  {
    id: "velocity", label: "Velocity layout", group: "Design", showIf: (c) => c?.theme?.layout === "velocity" && (!c?.theme?.kit || c.theme.kit === "classic"),
    desc: "Shown while Hero layout is Velocity and Page layout is Classic. Everything only the Velocity layout shows. Your name, photo, About, Work, Projects, Skills, Learning and Contact come from their usual sections.",
    cards: [
      { title: "Header & intro", fields: [
        g2({ t: "text", path: "velocity.status", label: "Status next to the logo", hint: "Leave empty to hide" }, { t: "text", path: "velocity.menuLabel", label: "Menu button label" }),
        { t: "text", path: "velocity.scrollLabel", label: "Scroll hint under the hero" },
        g3({ t: "toggle", path: "velocity.preloader", label: "Loading counter" }, { t: "toggle", path: "velocity.cursor", label: "Custom cursor" }, { t: "toggle", path: "velocity.marquee", label: "Lime word band" }),
        { t: "note", text: "The word band uses the words from Brand & theme → Scrolling skills band." }] },
      { title: "Portrait & signature", fields: [
        { t: "note", text: "The portrait is your photo from Hero. Without a photo, a 3D wireframe shape is shown instead." },
        { t: "select", path: "velocity.portraitShape", label: "Portrait frame", options: [{ value: "arch", label: "Arch" }, { value: "circle", label: "Circle" }, { value: "square", label: "Rounded square" }, { value: "cutout", label: "No frame (for a cut-out PNG)" }] },
        g2({ t: "text", path: "velocity.signature", label: "Signature text", hint: "Empty uses your first name" }, { t: "select", path: "velocity.signatureFont", label: "Signature style", options: ["Great Vibes", "Caveat", "Permanent Marker"] }),
        { t: "image", path: "velocity.signatureImage", label: "Or upload your real signature", hint: "Transparent PNG or SVG works best. It replaces the signature text." }] },
      { title: "Next up (hero corner)", fields: [
        g2({ t: "text", path: "velocity.nextLabel", label: "Label" }, { t: "text", path: "velocity.nextDate", label: "Date" }),
        { t: "text", path: "velocity.nextTitle", label: "What's next", hint: "Leave empty to hide the block" }, { t: "text", path: "velocity.nextUrl", label: "Link (optional)", ph: "https://" }] },
      { title: "Message", fields: [
        { t: "text", path: "velocity.messageLabel", label: "Label" },
        { t: "textarea", path: "velocity.message", label: "Message", rows: 4, hint: "Wrap words in *stars* to highlight them. Leave empty to use the About story heading." }] },
      { title: "Moments strip", fields: [
        g2({ t: "toggle", path: "velocity.showStory", label: "Show the strip" }, { t: "text", path: "velocity.storyTitle", label: "Title", ml: true }),
        { t: "text", path: "velocity.storyLabel", label: "Small label" },
        { t: "list", path: "velocity.stories", label: "Photos", max: 12, title: (it) => `${it.caption || "Photo"} · ${it.year || ""}`, add: () => ({ image: null, caption: "New moment", year: "2026" }),
          item: [{ t: "image", path: "image", label: "Photo" }, g2({ t: "text", path: "caption", label: "Caption" }, { t: "text", path: "year", label: "Year or place" })] },
        { t: "strings", path: "velocity.quotes", label: "Quotes between the photos", addLabel: "Add quote", multiline: true }] },
      { title: "On / off cards", fields: [
        { t: "toggle", path: "velocity.showSplit", label: "Show the two cards (before Work)" },
        { t: "list", path: "velocity.split", fixed: true, add: () => ({}), title: (it) => `${it.kicker} ${it.title}`,
          item: [g2({ t: "text", path: "kicker", label: "Big word" }, { t: "text", path: "title", label: "Second line" }), { t: "text", path: "text", label: "Text" },
            { t: "select", path: "target", label: "Opens section", options: [{ value: "about", label: "About" }, { value: "work", label: "Work" }, { value: "projects", label: "Projects" }, { value: "skills", label: "Skills" }, { value: "learning", label: "Learning" }, { value: "contact", label: "Contact" }] },
            { t: "image", path: "image", label: "Background photo (optional)" }] }] },
      { title: "Partners", fields: [
        g2({ t: "toggle", path: "velocity.showPartners", label: "Show partners (before Contact)" }, { t: "text", path: "velocity.partnersKicker", label: "Heading, line 1" }),
        g2({ t: "text", path: "velocity.partnersTitle", label: "Heading, line 2" }, { t: "text", path: "velocity.partnersText", label: "Text", ml: true }),
        { t: "list", path: "velocity.partners", label: "Names & logos", max: 24, title: (it) => it.name, add: () => ({ name: "New partner", logo: null, url: "" }),
          item: [g2({ t: "text", path: "name", label: "Name" }, { t: "text", path: "url", label: "Link (optional)" }), { t: "image", path: "logo", label: "Logo (optional, light on transparent works best)" }] }] },
      { title: "Footer", fields: [g2({ t: "text", path: "velocity.footerTagline", label: "Big tagline", hint: "*Stars* highlight words. Enter breaks the line.", ml: true }, { t: "text", path: "velocity.backToTop", label: "Back-to-top label" })] },
    ],
  },
  {
    id: "theme", label: "Brand & theme", group: "Design", desc: "Colours, fonts, corner radius and background effects for the whole site.",
    cards: [
      { title: "Colours", fields: [g3(
        { t: "color", path: "theme.bg", label: "Background" }, { t: "color", path: "theme.surface", label: "Surface (cards)" }, { t: "color", path: "theme.deep", label: "Deep panels" },
        { t: "color", path: "theme.text", label: "Text" }, { t: "color", path: "theme.soft", label: "Secondary text" }, { t: "color", path: "theme.line", label: "Grid lines" },
        { t: "color", path: "theme.c1", label: "Primary shape" }, { t: "color", path: "theme.c2", label: "Secondary shape" }, { t: "color", path: "theme.c3", label: "Tertiary shape" },
        { t: "color", path: "theme.glow", label: "Glow & highlight" })] },
      { title: "Typography", fields: [g2({ t: "select", path: "theme.fontDisplay", label: "Headings font", options: FONTS_D }, { t: "select", path: "theme.fontBody", label: "Body font", options: FONTS_B }),
        { t: "select", path: "theme.lineBreaks", label: LINE_BREAKS_AXIS.label, options: LINE_BREAKS_AXIS.options.map(([value, label]) => ({ value, label })) },
        { t: "note", text: "Headings and titles break where you press Enter. With “As typed”, a heading you typed on one line stays on one line (it shrinks a little to fit, and only wraps on screens too narrow for it)." }] },
      { title: "Shape & effects", fields: [
        { t: "range", path: "theme.radius", label: "Corner radius", min: 0, max: 40, step: 1, unit: "px" },
        { t: "range", path: "theme.logoRadius", label: "Logo icon and browser tab icon: 0 = square, 50 = circle", min: 0, max: 50, step: 1, unit: "%" },
        g2({ t: "toggle", path: "theme.showGrid", label: "Blueprint grid" }, { t: "toggle", path: "theme.showGlow", label: "Corner glow" }, { t: "toggle", path: "theme.showNetwork", label: "Line network in hero" },
          { t: "toggle", path: "theme.show3D", label: "3D shapes in hero" }, { t: "toggle", path: "theme.showSolids", label: "Floating background shapes" }, { t: "toggle", path: "theme.showTicker", label: "Scrolling skills band" },
          { t: "toggle", path: "theme.motion", label: "Animations" })] },
      { title: "Logo icon", fields: [
        { t: "image", path: "brand.icon", label: "Logo icon", hint: "A square image works best (PNG, SVG or JPG). Its corners follow the logo shape under Shape & effects. It also becomes the browser tab icon." },
        { t: "toggle", path: "brand.iconInMenu", label: "Show the icon in the menu, before your name" },
        { t: "toggle", path: "brand.iconOnHero", label: "Show the icon on a disc on the right side of the hero" },
        { t: "when", path: "brand.iconOnHero", is: "true", fields: [
          { t: "image", path: "hero.discImage", label: "Different image for the disc (optional)", hint: "Leave empty to use the logo icon." },
          g2({ t: "select", path: "hero.discRim", label: "Disc rim colour", options: [{ value: "theme", label: "Theme colours (mixed)" }, { value: "c1", label: "Primary" }, { value: "c2", label: "Secondary" }, { value: "c3", label: "Tertiary" }, { value: "text", label: "Text colour" }, { value: "surface", label: "Surface" }, { value: "deep", label: "Deep" }] },
            { t: "select", path: "hero.discSize", label: "Disc size", options: [{ value: "s", label: "Small" }, { value: "m", label: "Medium" }, { value: "l", label: "Large" }] }),
          { t: "toggle", path: "hero.discMotion", label: "Float, tilt and spin the rim" },
        ] },
        { t: "note", text: "The menu icon shows in every layout. The disc floats over the hero's right side in the standard layouts (most themes); the Velocity and Motion layouts keep their own hero art." },
      ] },
    ],
  },
  {
    id: "layout", label: "Sections & order", group: "Design", desc: "Show, hide and reorder sections. The order here is the order on the page and in the menu.",
    cards: [
      { title: "Header", fields: [g2({ t: "text", path: "brand.logoText", label: "Logo text" }, { t: "text", path: "brand.contactLabel", label: "Header button label" })] },
      { title: "Sections & menu titles", fields: [{ t: "note", text: "Open a section to rename its menu title or hide it." }, { t: "list", path: "sections", fixed: true, add: () => ({}), title: (it) => `${SECTION_NAMES[it.id]} · menu: “${it.navLabel || ""}”` + (it.visible ? "" : "  (hidden)"), item: [g2({ t: "toggle", path: "visible", label: "Show on page" }, { t: "text", path: "navLabel", label: "Menu title" })] }] },
      { title: "Page layout labels", fields: [
        { t: "note", text: "Words the Motion page layouts show around your content: menu buttons, hints and small headings. They only appear in the layout that uses them." },
        g2({ t: "text", path: "labels.scrollHint", label: "Scroll hint (Type specimen)" }, { t: "text", path: "labels.project", label: "“Project” tag" },
          { t: "text", path: "labels.available", label: "Status badge (Profile dashboard)" }, { t: "text", path: "labels.dragHint", label: "Drag hint (Drag canvas)" },
          { t: "text", path: "labels.listView", label: "“List view” button" }, { t: "text", path: "labels.canvasView", label: "“Canvas view” button" },
          { t: "text", path: "labels.close", label: "“Close” button" }, { t: "text", path: "labels.scenes", label: "Scene count (Cinema)", hint: "{n} becomes the number of scenes." },
          { t: "text", path: "labels.stickerHint", label: "Sticker hint (Sticker board)" }, { t: "text", path: "labels.edition", label: "Masthead line (Broadsheet)" },
          { t: "text", path: "labels.inThisEdition", label: "“In this edition”" }, { t: "text", path: "labels.classifieds", label: "“Classifieds”" },
          { t: "text", path: "labels.letters", label: "“Letters to the editor”" }),
      ] },
    ],
  },
  {
    id: "linkedin", label: "Import from LinkedIn", group: "Content", desc: "Fill your portfolio from your LinkedIn profile: name, headline, about, experience, education, skills and links.",
    cards: [{ title: "LinkedIn profile", fields: [{ t: "linkedin" }] }],
  },
  {
    id: "hero", label: "Hero", group: "Content", desc: "The first screen: name, role, buttons, photo and the 3D shapes.",
    cards: [
      { title: "Text", fields: [{ t: "text", path: "hero.eyebrow", label: "Badge above name", ml: true }, g2({ t: "text", path: "hero.firstName", label: "First line of name" }, { t: "text", path: "hero.lastName", label: "Second line of name" }),
        { t: "textarea", path: "hero.role", label: "Intro line", hint: "Wrap words in *asterisks* to highlight them." }] },
      { title: "Buttons", fields: [g2({ t: "text", path: "hero.ctaPrimary", label: "Main button label" }, { t: "select", path: "hero.ctaPrimaryTarget", label: "Main button scrolls to", options: Object.entries(SECTION_NAMES).map(([value, label]) => ({ value, label })) },
        { t: "text", path: "hero.ctaSecondary", label: "Second button label" }, { t: "text", path: "hero.ctaSecondaryUrl", label: "Second button link" })] },
      { title: "Photo", fields: [{ t: "image", path: "hero.photo", label: "Profile photo, shown on the 3D cube" }, { t: "select", path: "hero.photoShape", label: "Photo shape on the cube", options: ["circle", "square", "hexagon", "diamond"] },
        { t: "note", text: "With plain geometric shapes, the photo goes on the first cube in the 3D shapes, framed in that cube's colour. With an element pack (Design → Element pack), or with no cube, it shows as a framed picture next to the illustrated elements." }] },
      { title: "Highlights under the buttons", fields: [{ t: "list", path: "hero.meta", add: () => ({ value: "New", label: "Label" }), max: 5, title: (it) => `${it.value} · ${it.label}`, item: [g2({ t: "text", path: "value", label: "Value" }, { t: "text", path: "label", label: "Label" })] }] },
      { title: "Hero elements", fields: [{ t: "note", text: "Each entry is an illustrated element from the theme's element pack (or a 3D solid with plain geometric shapes). The type picks which element." }, { t: "list", path: "hero.solids", add: () => ({ type: "sphere", color: "c1" }), max: 6, title: (it) => SOLIDS.find((s) => s[0] === it.type)?.[1] || it.type,
        item: [{ t: "select", path: "type", label: "Solid", options: SOLIDS.map(([value, label]) => ({ value, label })) }, { t: "colorKey", path: "color", label: "Colour" }] }] },
      { title: "Scrolling skills band", fields: [{ t: "strings", path: "ticker", label: "Words in the band", addLabel: "Add word" },
        { t: "toggle", path: "theme.beltCustom", label: "Use my own band colours" },
        { t: "when", path: "theme.beltCustom", is: "true", fields: [
          g2({ t: "color", path: "theme.beltBg", label: "Band colour" }, { t: "color", path: "theme.beltFg", label: "Text colour" }),
          { t: "toggle", path: "theme.beltDotOne", label: "Shapes between words in one colour" },
          { t: "when", path: "theme.beltDotOne", is: "true", fields: [{ t: "color", path: "theme.beltDot", label: "Shape colour" }] },
        ] },
        { t: "note", text: "Off: the band follows the theme. The band shows when Brand & theme → Scrolling skills band is on (Velocity calls it the marquee)." }] },
    ],
  },
  {
    id: "about", label: "About", group: "Content", desc: "The bento grid: story, number tiles, motto and quick facts.",
    cards: [
      { title: "Heading", fields: [g2({ t: "text", path: "about.eyebrow", label: "Small label", ml: true }, { t: "text", path: "about.title", label: "Title", ml: true }), { t: "textarea", path: "about.lede", label: "Intro" }] },
      { title: "Story tile", fields: [{ t: "text", path: "about.storyLabel", label: "Tile label" }, { t: "textarea", path: "about.storyHeading", label: "Headline", hint: "Use *asterisks* to highlight." }, { t: "textarea", path: "about.story", label: "Story", hint: "Leave a blank line between paragraphs.", rows: 7 }] },
      { title: "Number tiles", fields: [{ t: "list", path: "about.stats", add: () => ({ value: 1, suffix: "", label: "New stat", color: "c3", shape: "triangle" }), max: 6, title: (it) => `${it.value}${it.suffix} · ${it.label}`,
        item: [g3({ t: "number", path: "value", label: "Number" }, { t: "text", path: "suffix", label: "After number" }, { t: "text", path: "label", label: "Label" }), { t: "colorKey", path: "color", label: "Tile colour" }, { t: "shape", path: "shape", label: "Corner shape" }] }] },
      { title: "Motto tile", fields: [{ t: "textarea", path: "about.quote", label: "Quote", hint: "Use *asterisks* to highlight. Leave empty to hide the tile." }, { t: "text", path: "about.quoteLabel", label: "Caption" }] },
      { title: "Quick facts", fields: [{ t: "text", path: "about.factsLabel", label: "Tile label" }, { t: "list", path: "about.facts", add: () => ({ k: "Label", v: "Value" }), max: 8, title: (it) => `${it.k}: ${it.v}`, item: [g2({ t: "text", path: "k", label: "Label" }, { t: "text", path: "v", label: "Value" })] }] },
    ],
  },
  {
    id: "skills", label: "Skills cube", group: "Content", desc: "The rotating cube always has six faces. Edit each face and its matching list entry.",
    cards: [
      { title: "Heading", fields: [g2({ t: "text", path: "skills.eyebrow", label: "Small label", ml: true }, { t: "text", path: "skills.title", label: "Title", ml: true }), { t: "text", path: "skills.lede", label: "Intro", ml: true }] },
      { title: "Cube faces", fields: [{ t: "list", path: "skills.items", fixed: true, add: () => ({}), title: (it, i) => `Face ${i + 1} · ${it.title}`,
        item: [g2({ t: "text", path: "tag", label: "Face label" }, { t: "text", path: "title", label: "Skill" }), { t: "text", path: "body", label: "Text on the cube" }, { t: "text", path: "detail", label: "Text in the list" }, { t: "colorKey", path: "color", label: "Face colour" }, { t: "shape", path: "shape", label: "Icon shape" }] }] },
    ],
  },
  {
    id: "work", label: "Work deck", group: "Content", desc: "Each role is a card in the stacked deck. The top of the list appears first.",
    cards: [
      { title: "Heading", fields: [g2({ t: "text", path: "work.eyebrow", label: "Small label", ml: true }, { t: "text", path: "work.title", label: "Title", ml: true }), { t: "text", path: "work.lede", label: "Intro", ml: true }] },
      { title: "Roles", fields: [{ t: "list", path: "work.items", title: (it) => `${it.title} · ${it.org}`,
        add: () => ({ period: "Year – Year", title: "New role", org: "Company", orgNote: "City", current: false, color: "surface", image: null, bullets: ["What you did"], art: [{ type: "circle", color: "c1" }, { type: "square", color: "c2" }] }),
        item: [g2({ t: "text", path: "title", label: "Role" }, { t: "text", path: "period", label: "Dates" }, { t: "text", path: "org", label: "Company" }, { t: "text", path: "orgNote", label: "Note after company" }),
          { t: "toggle", path: "current", label: "Mark as current role" }, { t: "strings", path: "bullets", label: "Highlights", addLabel: "Add highlight", multiline: true }, { t: "colorKey", path: "color", label: "Card colour" },
          { t: "image", path: "image", label: "Card image (replaces the shapes)" },
          { t: "list", path: "art", label: "Card shapes", add: () => ({ type: "triangle", color: "c3" }), max: 3, title: (it) => `${it.type} · ${it.color}`, item: [{ t: "shape", path: "type", label: "Shape" }, { t: "colorKey", path: "color", label: "Colour" }] }] }] },
    ],
  },
  {
    id: "projects", label: "Projects", group: "Content", desc: "Project cards with images and links. The section appears once it has a project and is switched on under Sections & order.",
    cards: [
      { title: "Heading", fields: [g2({ t: "text", path: "projects.eyebrow", label: "Small label", ml: true }, { t: "text", path: "projects.title", label: "Title", ml: true }), { t: "text", path: "projects.lede", label: "Intro", ml: true }] },
      { title: "Projects", fields: [{ t: "list", path: "projects.items", title: (it) => it.title,
        add: () => ({ title: "New project", body: "What it is and what you did.", url: "", linkLabel: "View project", image: null, color: "c1", shape: "circle", tags: [] }),
        item: [{ t: "text", path: "title", label: "Title" }, { t: "textarea", path: "body", label: "Description" }, { t: "image", path: "image", label: "Cover image" }, { t: "image", path: "image2", label: "Hover image (Velocity layout)" },
          g2({ t: "text", path: "url", label: "Link" }, { t: "text", path: "linkLabel", label: "Link label" }), { t: "strings", path: "tags", label: "Tags", addLabel: "Add tag" },
          { t: "colorKey", path: "color", label: "Cover colour (without image)" }, { t: "shape", path: "shape", label: "Cover shape (without image)" }] }] },
    ],
  },
  {
    id: "learning", label: "Learning", group: "Content", desc: "Education, certifications and languages.",
    cards: [
      { title: "Heading", fields: [g2({ t: "text", path: "learning.eyebrow", label: "Small label", ml: true }, { t: "text", path: "learning.title", label: "Title", ml: true })] },
      { title: "Entries", fields: [{ t: "list", path: "learning.items", title: (it) => it.title, add: () => ({ period: "Year", title: "New entry", sub: "Institution", shape: "circle", color: "c1" }),
        item: [g2({ t: "text", path: "title", label: "Title" }, { t: "text", path: "period", label: "Dates or type" }), { t: "text", path: "sub", label: "Institution or detail" }, { t: "shape", path: "shape", label: "Icon shape" }, { t: "colorKey", path: "color", label: "Icon colour" }] }] },
      { title: "Languages", fields: [{ t: "text", path: "learning.languagesLabel", label: "Label" }, { t: "strings", path: "learning.languages", label: "Languages", addLabel: "Add language" }] },
    ],
  },
  {
    id: "contact", label: "Contact & footer", group: "Content", desc: "The closing panel, links and the footer.",
    cards: [
      { title: "Panel", fields: [{ t: "text", path: "contact.eyebrow", label: "Small label", ml: true }, { t: "text", path: "contact.title", label: "Title", hint: "Use *asterisks* to highlight. Press Enter to break the line.", ml: true }, { t: "textarea", path: "contact.body", label: "Message" },
        g2({ t: "text", path: "contact.email", label: "Email shown", check: "email" }, { t: "text", path: "contact.copyLabel", label: "Copy button label" })] },
      { title: "Links", fields: [{ t: "list", path: "contact.links", add: () => ({ label: "New link", url: "https://" }), max: 8, title: (it) => it.label, item: [g2({ t: "text", path: "label", label: "Label" }, { t: "text", path: "url", label: "URL" })] }] },
      { title: "Footer", fields: [g2({ t: "text", path: "contact.footerLeft", label: "Left" }, { t: "text", path: "contact.footerRight", label: "Right" })] },
    ],
  },
  seoCategory(false),
  adminCategory(),
];

/** Words the Motion layouts show (src/fx/layouts.js reads content.labels with these as fallbacks). */
export const PORTFOLIO_LABELS = {
  scrollHint: "Scroll to discover", project: "Project", available: "Available", dragHint: "Drag to explore", listView: "List view", canvasView: "Canvas view",
  close: "Close", scenes: "A portfolio in {n} scenes", stickerHint: "Grab a sticker and move it around.", edition: "Portfolio edition",
  inThisEdition: "In this edition", classifieds: "Classifieds", letters: "Letters to the editor",
};

export const portfolioTemplate: TemplateDef = {
  id: "portfolio",
  name: "Portfolio",
  kind: "Single page",
  description: "Geometric 3D portfolio: hero with 3D shapes, bento about, skills cube, stacked work deck, projects, learning and contact.",
  pages: [{ file: "index.html", label: "Home" }],
  schema,
  colorKeys: [{ key: "c1", label: "Primary" }, { key: "c2", label: "Secondary" }, { key: "c3", label: "Tertiary" }, { key: "text", label: "Text" }, { key: "surface", label: "Surface" }, { key: "deep", label: "Deep" }, { key: "glow", label: "Glow" }],
  themePath: "theme",
  themeValues: portfolioThemeValues,
  prepare: (c) => {
    if (!c || typeof c !== "object") return;
    const v = (c.velocity && typeof c.velocity === "object") ? c.velocity : (c.velocity = {});
    for (const [k, val] of Object.entries(VELOCITY_DEFAULTS)) if (v[k] === undefined) v[k] = JSON.parse(JSON.stringify(val));
    const t = c.theme && typeof c.theme === "object" ? c.theme : (c.theme = {});
    if (!t.introBg) t.introBg = t.deep || t.text || "#111111";
    if (!t.introFg) t.introFg = onColor(t.introBg);
    if (t.introTitle === undefined) t.introTitle = "";
    if (!t.introFont) t.introFont = "display";
    if (!t.introCase) t.introCase = "upper";
    if (t.logoRadius === undefined || t.logoRadius === null) t.logoRadius = 22;
    if (t.beltCustom === undefined) t.beltCustom = false;
    if (!t.beltBg) t.beltBg = (t.layout === "velocity" ? t.c1 : t.text) || "#111111";
    if (!t.beltFg) t.beltFg = onColor(t.beltBg);
    if (t.beltDotOne === undefined) t.beltDotOne = false;
    if (!t.beltDot) t.beltDot = t.c1 || "#3D63FF";
    const b = c.brand && typeof c.brand === "object" ? c.brand : (c.brand = {});
    if (b.icon === undefined) b.icon = null;
    if (b.iconInMenu === undefined) b.iconInMenu = true;
    if (b.iconOnHero === undefined) b.iconOnHero = true;
    const h = c.hero && typeof c.hero === "object" ? c.hero : (c.hero = {});
    if (h.discImage === undefined) h.discImage = null;
    if (!h.discRim) h.discRim = "theme";
    if (!h.discSize) h.discSize = "m";
    if (h.discMotion === undefined) h.discMotion = true;
    if (!t.scrollEase) t.scrollEase = "light";
    if (!t.lineBreaks) t.lineBreaks = "typed";
    c.labels = { ...PORTFOLIO_LABELS, ...(c.labels && typeof c.labels === "object" ? c.labels : {}) };
    c.cms = { adminPage: "admin", ...(c.cms && typeof c.cms === "object" ? c.cms : {}) };
    c.seo = { titlePattern: "{page} · {site}", keywords: "", author: "", image: null, siteUrl: "", themeColor: "", noindex: false, googleVerification: "", meta: [], ...(c.seo && typeof c.seo === "object" ? c.seo : {}) };
  },
  summary: (c) => [c?.hero?.firstName, c?.hero?.lastName].filter(Boolean).join(" ") || c?.brand?.logoText || "",
  checks: (c) => {
    const w: string[] = [];
    if (!c?.contact?.email) w.push("No contact email is set.");
    if (!c?.seo?.title) w.push("No browser tab title is set.");
    return w;
  },
};
