import type { Category, Field, TemplateDef } from "./types";
import { BODY_FONTS, DISPLAY_FONTS, KIT_AXIS, PORTFOLIO_AXES, portfolioThemeValues } from "../themes/catalog";
import { themeCards } from "../themes/fields";

const SECTION_NAMES: Record<string, string> = { about: "About", skills: "Skills cube", work: "Work deck", projects: "Projects", learning: "Learning", contact: "Contact" };
const SOLIDS: [string, string][] = [["sphere", "Sphere · element 1"], ["cube", "Cube · element 2"], ["pyramid", "Pyramid · element 3"], ["octahedron", "Octahedron · element 4"], ["torus", "Torus · element 5"], ["icosahedron", "Icosahedron · element 6"], ["cylinder", "Cylinder · element 8"]];
const FONTS_D = DISPLAY_FONTS;
const FONTS_B = BODY_FONTS;

const g2 = (...fields: Field[]): Field => ({ t: "grid", cols: 2, fields });
const g3 = (...fields: Field[]): Field => ({ t: "grid", cols: 3, fields });

const schema: Category[] = [
  {
    id: "look", label: "Theme & layout", group: "Design", desc: "Choose from 55 themes, then fine-tune the layout, elements and animation.",
    cards: themeCards([KIT_AXIS, PORTFOLIO_AXES.about, PORTFOLIO_AXES.skills, PORTFOLIO_AXES.work], "Animation needs “Animations” switched on under Brand & theme. Visitors who ask their device for reduced motion always get a still page."),
  },
  {
    id: "theme", label: "Brand & theme", group: "Design", desc: "Colours, fonts, corner radius and background effects for the whole site.",
    cards: [
      { title: "Colours", fields: [g3(
        { t: "color", path: "theme.bg", label: "Background" }, { t: "color", path: "theme.surface", label: "Surface (cards)" }, { t: "color", path: "theme.deep", label: "Deep panels" },
        { t: "color", path: "theme.text", label: "Text" }, { t: "color", path: "theme.soft", label: "Secondary text" }, { t: "color", path: "theme.line", label: "Grid lines" },
        { t: "color", path: "theme.c1", label: "Primary shape" }, { t: "color", path: "theme.c2", label: "Secondary shape" }, { t: "color", path: "theme.c3", label: "Tertiary shape" },
        { t: "color", path: "theme.glow", label: "Glow & highlight" })] },
      { title: "Typography", fields: [g2({ t: "select", path: "theme.fontDisplay", label: "Headings font", options: FONTS_D }, { t: "select", path: "theme.fontBody", label: "Body font", options: FONTS_B })] },
      { title: "Shape & effects", fields: [
        { t: "range", path: "theme.radius", label: "Corner radius", min: 0, max: 40, step: 1, unit: "px" },
        g2({ t: "toggle", path: "theme.showGrid", label: "Blueprint grid" }, { t: "toggle", path: "theme.showGlow", label: "Corner glow" }, { t: "toggle", path: "theme.showNetwork", label: "Line network in hero" },
          { t: "toggle", path: "theme.show3D", label: "3D shapes in hero" }, { t: "toggle", path: "theme.showSolids", label: "Floating background shapes" }, { t: "toggle", path: "theme.showTicker", label: "Scrolling skills band" },
          { t: "toggle", path: "theme.motion", label: "Animations" })] },
      { title: "Search & sharing", fields: [{ t: "text", path: "seo.title", label: "Browser tab title" }, { t: "textarea", path: "seo.description", label: "Search description", hint: "One or two sentences shown by search engines and link previews." }] },
    ],
  },
  {
    id: "layout", label: "Sections & order", group: "Design", desc: "Show, hide and reorder sections. The order here is the order on the page and in the menu.",
    cards: [
      { title: "Header", fields: [g2({ t: "text", path: "brand.logoText", label: "Logo text" }, { t: "text", path: "brand.contactLabel", label: "Header button label" })] },
      { title: "Sections", fields: [{ t: "list", path: "sections", fixed: true, add: () => ({}), title: (it) => SECTION_NAMES[it.id] + (it.visible ? "" : "  (hidden)"), item: [g2({ t: "toggle", path: "visible", label: "Show on page" }, { t: "text", path: "navLabel", label: "Menu label" })] }] },
    ],
  },
  {
    id: "hero", label: "Hero", group: "Content", desc: "The first screen: name, role, buttons, photo and the 3D shapes.",
    cards: [
      { title: "Text", fields: [{ t: "text", path: "hero.eyebrow", label: "Badge above name" }, g2({ t: "text", path: "hero.firstName", label: "First line of name" }, { t: "text", path: "hero.lastName", label: "Second line of name" }),
        { t: "textarea", path: "hero.role", label: "Intro line", hint: "Wrap words in *asterisks* to highlight them." }] },
      { title: "Buttons", fields: [g2({ t: "text", path: "hero.ctaPrimary", label: "Main button label" }, { t: "select", path: "hero.ctaPrimaryTarget", label: "Main button scrolls to", options: Object.entries(SECTION_NAMES).map(([value, label]) => ({ value, label })) },
        { t: "text", path: "hero.ctaSecondary", label: "Second button label" }, { t: "text", path: "hero.ctaSecondaryUrl", label: "Second button link" })] },
      { title: "Photo", fields: [{ t: "image", path: "hero.photo", label: "Profile photo, shown on the 3D cube" }, { t: "select", path: "hero.photoShape", label: "Photo shape on the cube", options: ["circle", "square", "hexagon", "diamond"] },
        { t: "note", text: "With plain geometric shapes, the photo goes on the first cube in the 3D shapes, framed in that cube's colour. With an element pack (Design → Element pack), or with no cube, it shows as a framed picture next to the illustrated elements." }] },
      { title: "Highlights under the buttons", fields: [{ t: "list", path: "hero.meta", add: () => ({ value: "New", label: "Label" }), max: 5, title: (it) => `${it.value} · ${it.label}`, item: [g2({ t: "text", path: "value", label: "Value" }, { t: "text", path: "label", label: "Label" })] }] },
      { title: "Hero elements", fields: [{ t: "note", text: "Each entry is an illustrated element from the theme's element pack (or a 3D solid with plain geometric shapes). The type picks which element." }, { t: "list", path: "hero.solids", add: () => ({ type: "sphere", color: "c1" }), max: 6, title: (it) => SOLIDS.find((s) => s[0] === it.type)?.[1] || it.type,
        item: [{ t: "select", path: "type", label: "Solid", options: SOLIDS.map(([value, label]) => ({ value, label })) }, { t: "colorKey", path: "color", label: "Colour" }] }] },
      { title: "Scrolling skills band", fields: [{ t: "strings", path: "ticker", label: "Words in the band", addLabel: "Add word" }] },
    ],
  },
  {
    id: "about", label: "About", group: "Content", desc: "The bento grid: story, number tiles, motto and quick facts.",
    cards: [
      { title: "Heading", fields: [g2({ t: "text", path: "about.eyebrow", label: "Small label" }, { t: "text", path: "about.title", label: "Title" }), { t: "textarea", path: "about.lede", label: "Intro" }] },
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
      { title: "Heading", fields: [g2({ t: "text", path: "skills.eyebrow", label: "Small label" }, { t: "text", path: "skills.title", label: "Title" }), { t: "text", path: "skills.lede", label: "Intro" }] },
      { title: "Cube faces", fields: [{ t: "list", path: "skills.items", fixed: true, add: () => ({}), title: (it, i) => `Face ${i + 1} · ${it.title}`,
        item: [g2({ t: "text", path: "tag", label: "Face label" }, { t: "text", path: "title", label: "Skill" }), { t: "text", path: "body", label: "Text on the cube" }, { t: "text", path: "detail", label: "Text in the list" }, { t: "colorKey", path: "color", label: "Face colour" }, { t: "shape", path: "shape", label: "Icon shape" }] }] },
    ],
  },
  {
    id: "work", label: "Work deck", group: "Content", desc: "Each role is a card in the stacked deck. The top of the list appears first.",
    cards: [
      { title: "Heading", fields: [g2({ t: "text", path: "work.eyebrow", label: "Small label" }, { t: "text", path: "work.title", label: "Title" }), { t: "text", path: "work.lede", label: "Intro" }] },
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
      { title: "Heading", fields: [g2({ t: "text", path: "projects.eyebrow", label: "Small label" }, { t: "text", path: "projects.title", label: "Title" }), { t: "text", path: "projects.lede", label: "Intro" }] },
      { title: "Projects", fields: [{ t: "list", path: "projects.items", title: (it) => it.title,
        add: () => ({ title: "New project", body: "What it is and what you did.", url: "", linkLabel: "View project", image: null, color: "c1", shape: "circle", tags: [] }),
        item: [{ t: "text", path: "title", label: "Title" }, { t: "textarea", path: "body", label: "Description" }, { t: "image", path: "image", label: "Cover image" },
          g2({ t: "text", path: "url", label: "Link" }, { t: "text", path: "linkLabel", label: "Link label" }), { t: "strings", path: "tags", label: "Tags", addLabel: "Add tag" },
          { t: "colorKey", path: "color", label: "Cover colour (without image)" }, { t: "shape", path: "shape", label: "Cover shape (without image)" }] }] },
    ],
  },
  {
    id: "learning", label: "Learning", group: "Content", desc: "Education, certifications and languages.",
    cards: [
      { title: "Heading", fields: [g2({ t: "text", path: "learning.eyebrow", label: "Small label" }, { t: "text", path: "learning.title", label: "Title" })] },
      { title: "Entries", fields: [{ t: "list", path: "learning.items", title: (it) => it.title, add: () => ({ period: "Year", title: "New entry", sub: "Institution", shape: "circle", color: "c1" }),
        item: [g2({ t: "text", path: "title", label: "Title" }, { t: "text", path: "period", label: "Dates or type" }), { t: "text", path: "sub", label: "Institution or detail" }, { t: "shape", path: "shape", label: "Icon shape" }, { t: "colorKey", path: "color", label: "Icon colour" }] }] },
      { title: "Languages", fields: [{ t: "text", path: "learning.languagesLabel", label: "Label" }, { t: "strings", path: "learning.languages", label: "Languages", addLabel: "Add language" }] },
    ],
  },
  {
    id: "contact", label: "Contact & footer", group: "Content", desc: "The closing panel, links and the footer.",
    cards: [
      { title: "Panel", fields: [{ t: "text", path: "contact.eyebrow", label: "Small label" }, { t: "text", path: "contact.title", label: "Title", hint: "Use *asterisks* to highlight." }, { t: "textarea", path: "contact.body", label: "Message" },
        g2({ t: "text", path: "contact.email", label: "Email shown", check: "email" }, { t: "text", path: "contact.copyLabel", label: "Copy button label" })] },
      { title: "Links", fields: [{ t: "list", path: "contact.links", add: () => ({ label: "New link", url: "https://" }), max: 8, title: (it) => it.label, item: [g2({ t: "text", path: "label", label: "Label" }, { t: "text", path: "url", label: "URL" })] }] },
      { title: "Footer", fields: [g2({ t: "text", path: "contact.footerLeft", label: "Left" }, { t: "text", path: "contact.footerRight", label: "Right" })] },
    ],
  },
];

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
  summary: (c) => [c?.hero?.firstName, c?.hero?.lastName].filter(Boolean).join(" ") || c?.brand?.logoText || "",
  checks: (c) => {
    const w: string[] = [];
    if (!c?.contact?.email) w.push("No contact email is set.");
    if (!c?.seo?.title) w.push("No browser tab title is set.");
    return w;
  },
};
