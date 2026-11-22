// Picaffectz Explorer: answers questions about this Studio by reading the Studio itself, end to end, on this
// device. No AI and no outside service: it reads every setting of every site type (straight from the definitions the
// editor is built from), the Studio's own screens, and the projects (their details, and their content when allowed),
// then ranks what matches the words asked. Its answers are places to go and the Studio's own explanations.
import { TEMPLATES } from "../schema";
import type { ProjectMeta, StudioIndex } from "./studio";
import { pushPref } from "./prefs";

export type ExplorerPrefs = { on: boolean; min: boolean; corner: "right" | "left"; content: boolean; keys: boolean };
const KEY = "studio-explorer", DEF: ExplorerPrefs = { on: true, min: true, corner: "right", content: true, keys: true };
export const EXPLORER_EVENT = "studio:explorer";
export const explorerPrefs = {
  get(): ExplorerPrefs { try { const j = JSON.parse(localStorage.getItem(KEY) || "null"); return { ...DEF, ...(j && typeof j === "object" ? { on: j.on !== false, min: j.min !== false, corner: j.corner === "left" ? "left" : "right", content: j.content !== false, keys: j.keys !== false } : {}) }; } catch { return { ...DEF }; } },
  set(p: Partial<ExplorerPrefs>) { const n = { ...explorerPrefs.get(), ...p }; try { localStorage.setItem(KEY, JSON.stringify(n)); } catch { /* private window: this visit only */ } dispatchEvent(new CustomEvent(EXPLORER_EVENT, { detail: n })); pushPref({ explorer: n }); return n; },
};

export type Entry = {
  kind: "setting" | "section" | "screen" | "project" | "content";
  /** What it is called. */ title: string;
  /** Where it is, outermost first. */ trail: string[];
  /** The Studio's own words about it (hints, notes, choices). */ text: string;
  /** Site type it belongs to (settings, sections). */ tpl?: string;
  /** For the editor's jump: the setting's path, or the section's id. */ path?: string; cat?: string;
  /** A Studio screen's address (after #/). */ route?: string;
  /** A project (its id), for project and content entries. */ project?: string;
  /** Extra words to be found by, never shown. */ also?: string;
};
export type Answer = { say: string; detail?: string; items: (Entry & { score: number })[]; kind: "count" | "list" | "where" | "found" | "none" | "help" };

// ------------------------------------------------------------------ words
const STOP = new Set("a an the is are was be to of in on at for and or do does did i my me we our you your it its this that these those can could would should will how what where which when why who with from by as have has get got make made want need please there here any some into about than then so if not no".split(" "));
// Words people use for the same thing. Each group is searched together.
const SAME: string[][] = [
  ["logo", "icon", "brand", "mark"], ["colour", "color", "colours", "colors", "palette", "theme"], ["font", "fonts", "typeface", "typography", "text style"],
  ["phone", "mobile", "number", "call", "contact"], ["whatsapp", "wa", "chat"], ["email", "mail", "e-mail"], ["address", "location", "map", "directions"],
  ["pay", "payment", "payments", "upi", "gateway", "checkout"], ["price", "prices", "pricing", "cost", "rate"], ["order", "orders", "ordering", "cart", "basket"],
  ["menu", "dish", "dishes", "food", "item", "items"], ["product", "products", "catalogue", "catalog", "shop", "store"], ["picture", "pictures", "photo", "photos", "image", "images", "gallery"],
  ["video", "videos", "youtube", "vimeo", "clip"], ["background", "backdrop", "bg"], ["animation", "animated", "animate", "motion", "moving", "effect", "effects"],
  ["publish", "published", "live", "deploy", "host", "hosting", "hosted"], ["domain", "url", "website address", "link"], ["seo", "search engine", "meta", "metadata", "keywords"],
  ["social", "instagram", "facebook", "linkedin", "twitter", "youtube"], ["hours", "timing", "timings", "open", "opening", "closed", "holiday"], ["booking", "reservation", "reserve", "table"],
  ["delivery", "shipping", "pickup", "courier"], ["tax", "gst", "vat"], ["discount", "coupon", "offer", "offers", "promo", "sale"], ["points", "loyalty", "rewards"],
  ["login", "signin", "sign-in", "account", "accounts", "otp", "code", "verify", "verification"], ["sms", "text message", "msg91", "twilio"], ["privacy", "terms", "legal", "policy", "policies", "cookie", "cookies", "consent"],
  ["language", "languages", "translate", "translation", "hindi"], ["footer", "bottom"], ["header", "navigation", "nav", "menu bar", "top bar"], ["hero", "banner", "headline", "top section"],
  ["review", "reviews", "testimonial", "testimonials", "rating"], ["team", "staff", "people", "members"], ["faq", "questions"], ["intro", "preloader", "loader", "loading", "transition", "skeleton"],
  ["export", "zip", "download", "backup"], ["import", "upload", "restore"], ["update", "updates", "upgrade", "version"], ["token", "connect", "connection"], ["admin", "editor", "cms"],
  ["delete", "remove", "hide", "disable", "off"], ["add", "create", "new", "enable", "on", "show"], ["change", "edit", "set", "update", "modify", "customise", "customize"],
];
const GROUP = new Map<string, string[]>(); for (const g of SAME) for (const w of g) GROUP.set(w, [...(GROUP.get(w) || []), ...g.filter((x) => x !== w)]);
const stem = (w: string) => (w.length > 4 ? w.replace(/(ies)$/, "y").replace(/(ing|ed|s)$/, "").replace(/e$/, "") : w);
/** Words people ask with that the Studio's own labels don't use. Matched on a card's or screen's name. */
const HINTS: [RegExp, string][] = [
  [/^Typography/, "font fonts typeface lettering change the font heading body"],
  [/^Sections( & order)?$/, "hide show reorder rearrange move turn off a section order of sections"],
  [/^Colours$/, "colour color palette dark mode light mode dark theme light theme brand colours"],
  [/^Search & link previews$/, "seo google description meta title share preview"],
  [/^Razorpay$/, "razorpay keys key id secret online payment"],
];
export const words = (s: string): string[] => String(s || "").toLowerCase().replace(/[’']/g, "").split(/[^a-z0-9₹%+-]+/).filter((w) => w.length > 1 && !STOP.has(w)).map(stem);
const ACT = new Set(["change", "edit", "set", "modify", "customise", "customize", "find", "go", "turn", "switch", "put", "use", "do"].map(stem));

// ------------------------------------------------------------------ what it reads
const TPL_NAME: Record<string, string> = { restaurant: "Restaurant", store: "Shop", business: "Business", portfolio: "Portfolio" };
const tplName = (id: string) => TPL_NAME[id] || TEMPLATES[id]?.name || id;
/** Every section, card and setting of every site type, read from the same definitions the editor shows. */
export function readSettings(): Entry[] {
  const out: Entry[] = [];
  for (const [tpl, t] of Object.entries(TEMPLATES)) {
    for (const c of t.schema) {
      const group = (c as any).group || (c as any).sub || "";
      out.push({ kind: "section", tpl, title: c.label, trail: [tplName(tpl), ...(group ? [group] : [])], text: String((c as any).desc || ""), cat: c.id });
      for (const card of c.cards) {
        const notes: string[] = [], fields: { label: string; path?: string; hint: string; opts: string }[] = [];
        const walk = (list: any[], top: string | undefined) => { for (const f of list || []) {
          if (!f) continue;
          if (f.t === "note") { if (f.text && !f.studio) notes.push(String(f.text)); else if (f.text) notes.push(String(f.text)); continue; }
          if (f.t === "grid" || f.t === "when") { walk(f.fields, top); continue; }
          if (f.label) fields.push({ label: String(f.label), path: top || f.path, hint: String(f.hint || ""), opts: Array.isArray(f.options) ? f.options.map((o: any) => o.label).filter(Boolean).join(", ") : "" });
          if (f.t === "list") walk(f.item, top || f.path);
        } };
        walk(card.fields as any[], undefined);
        const cardText = notes.join(" ");
        out.push({ kind: "section", tpl, title: card.title, trail: [tplName(tpl), c.label], text: cardText, cat: c.id, path: fields.find((f) => f.path)?.path, also: fields.map((f) => f.label).join(" ") });
        for (const f of fields) out.push({ kind: "setting", tpl, title: f.label, trail: [tplName(tpl), c.label, card.title], text: [f.hint, f.opts ? "Choices: " + f.opts + "." : ""].filter(Boolean).join(" "), cat: c.id, path: f.path, also: cardText.slice(0, 400) });
      }
    }
  }
  return out;
}
/** The Studio's own screens and tools, with what each is for. */
export function readScreens(o: { hosted?: boolean } = {}): Entry[] {
  const S = (title: string, route: string, trail: string[], text: string, also = ""): Entry => ({ kind: "screen", title, route, trail, text, also });
  return [
    S("Projects", "", ["Studio"], "Every site you have made: open one to edit it, make a new one, copy, archive or delete. This is the Studio's first screen.", "home dashboard sites list all my websites new project create site start"),
    S("New project", "", ["Studio", "Projects"], "Press New project on the Projects screen, pick a site type (restaurant, shop, business or portfolio) and a theme.", "create add make start website"),
    S("Settings", "settings", ["Studio"], "The Studio's own settings: General, Customize, Hostings, Updates and Migration.", "preferences options configuration"),
    S("Studio name & logo", "settings/customize", ["Studio", "Settings", "Customize"], "The Studio's name, its logo, its colours (dark or light, from the logo or a scheme) the logo's animation and the Studio layout (classic, glass, soft or sharp).", "brand rename studio colour theme look dark light mode tint animate logo layout glass soft sharp modern trendy"),
    S("“Powered by” badge", "settings/customize", ["Studio", "Settings", "Customize"], "The small badge on sites that says who made them: its words, look and link.", "footer credit made by remove badge"),
    S("The Studio's own pages", "settings/customize", ["Studio", "Settings", "Customize"], "Pages of the Studio itself, such as its privacy policy and terms.", "legal privacy terms about"),
    S("Sign-in email", "settings/customize", ["Studio", "Settings", "Customize"], "The email that carries the sign-in code: its name and wording.", "otp code login email template"),
    S("Sign in with Google", "settings/customize", ["Studio", "Settings", "Customize"], "Adds a Sign in with Google button beside the email code, for emails that are already allowed.", "google login oauth client id"),
    S("Admin menus", "settings/customize", ["Studio", "Settings", "Customize"], "Which sections a site's admin page shows, and in what order, for each site type.", "hide sections site admin menu order rearrange"),
    S("Picaffectz Explorer", "settings/customize", ["Studio", "Settings", "Customize"], "This helper: switch it off, start it minimised, choose its corner, and what it reads.", "explorer search help assistant disable minimise floating"),
    S("Connect Cloudflare", "settings/hostings", ["Studio", "Settings", "Hostings"], "Connect your Cloudflare account once, with one click or a pasted token. Every device signed in to the Studio can then use it.", "cloudflare token account oauth link hosting connect connection"),
    S("Hosting accounts", "settings/hostings", ["Studio", "Settings", "Hostings"], "GitHub, Netlify, the Studio helper and Cloudflare: connect them once.", "github netlify helper account"),
    S("Publish from any device", "settings/hostings", ["Studio", "Settings", "Hostings"], "Keeps the Cloudflare token on the Studio's database, so any device signed in can publish without a token of its own.", "token database every device connected once"),
    S("Sites and hosting accounts", "settings/hostings", ["Studio", "Settings", "Hostings"], "Where each site is hosted, which Cloudflare account it is on, and its database.", "per site hosting account database move"),
    S("Updates", "settings/update", ["Studio", "Settings", "Updates"], "Push studio updates to live sites, so published sites get the newest pages and features." + (o.hosted ? " Also updates this Studio itself to the latest version." : ""), "update live sites push upgrade latest version studio update database older build"),
    S("Migration", "settings/migration", ["Studio", "Settings", "Migration"], "Move the Studio and its data to another service, or to another account.", "move transfer cloudflare supabase netlify github"),
    S("Partners", "partners", ["Studio"], "Give a client or partner a Studio of their own, on your accounts or theirs.", "client studio agency reseller b2b"),
    S("Publish to Cloudflare", "", ["Project", "top bar"], "In a project, press Publish to Cloudflare (or Host to External Services): choose the hosting, the database and your domain, then Publish.", "go live deploy host domain database publish site hosted"),
    S("Export / Import ZIP", "", ["Project", "Settings"], "In a project: download the whole site as a ZIP, or load a ZIP made by Export back into the project.", "backup download zip restore import export"),
    S("History", "", ["Project", "Settings"], "In a project: earlier saved versions, to look at or bring back.", "undo previous version restore revert backup"),
    S("Preview", "", ["Project"], "The live preview beside the editor shows every change at once, for computer, tablet and phone widths.", "see site mobile view desktop responsive"),
    S("Connections", "", ["Project", "Selling"], "A site's own keys: WhatsApp, SMS, payments and (restaurants) Petpooja. They are typed in by you and kept on the site's own Cloudflare.", "whatsapp sms razorpay cashfree petpooja keys api token integrate"),
    S("Customer data", "", ["Site admin"], "On a site's admin page: customers, their orders and points.", "customers orders crm list export points"),
    S("Enquiries and orders", "", ["Site admin"], "On a site's admin page: messages, bookings and orders that came in.", "inbox leads messages bookings orders received"),
  ];
}
const STATUS: Record<string, string> = { draft: "a draft", exported: "exported", published: "published" };
export function readProjects(index: StudioIndex | null): Entry[] {
  return (index?.projects || []).map((p: ProjectMeta) => {
    const host = (p as any).host, url = String((p as any).publish?.url || host?.url || host?.domain || "");
    return { kind: "project" as const, title: p.name, project: p.id, tpl: p.template, route: "p/" + p.id, trail: ["Projects"], text: `${tplName(p.template)} site, ${STATUS[p.status] || p.status}${url ? ", at " + url.replace(/^https?:\/\//, "") : ""}${p.client ? ", for " + p.client : ""}${p.notes ? ". " + p.notes : ""}`, also: [p.category, p.client, p.template, p.status, url].join(" ") };
  });
}
/** The words written in a project (titles, descriptions, names, prices): where each is, so it can be found again. */
export function readContent(project: ProjectMeta, content: any, max = 1500): Entry[] {
  const out: Entry[] = [], labels = new Map<string, string>();
  const t = TEMPLATES[project.template];
  if (t) for (const c of t.schema) for (const card of c.cards) { const walk = (list: any[], base: string) => { for (const f of list || []) { if (!f) continue; if (f.t === "grid" || f.t === "when") walk(f.fields, base); else { if (f.path && f.label) labels.set((base ? base + ".*." : "") + f.path, `${c.label} → ${f.label}`); if (f.t === "list") walk(f.item, (base ? base + ".*." : "") + f.path); } } }; walk(card.fields as any[], ""); }
  const skip = /^(https?:|data:|assets\/|#[0-9a-f]{3,8}$|[\d.,:\s+-]+$)/i;
  const go = (v: any, path: string, top: string) => {
    if (out.length >= max || v == null) return;
    if (typeof v === "string") { const s = v.trim(); if (s.length < 3 || s.length > 600 || skip.test(s)) return; const where = labels.get(path.replace(/\.\d+(?=\.|$)/g, ".*")) || labels.get(top) || path.replace(/\.\d+/g, "").replace(/\./g, " → "); out.push({ kind: "content", title: s.length > 90 ? s.slice(0, 88) + "…" : s, project: project.id, tpl: project.template, route: "p/" + project.id, path: top, trail: [project.name, where], text: s }); return; }
    if (Array.isArray(v)) { v.forEach((x, i) => go(x, path + "." + i, top)); return; }
    if (typeof v === "object") for (const k of Object.keys(v)) { if (/^(theme|cms|sectionBg|sectionAlign|seo|_)/.test(k) && !path) continue; go(v[k], path ? path + "." + k : k, top || (labels.has(k) ? k : path ? top : k)); }
  };
  for (const k of Object.keys(content || {})) { if (/^(theme|cms|sectionBg|sectionAlign|_)/.test(k)) continue; const v = content[k]; if (v && typeof v === "object") for (const k2 of Object.keys(v)) go(v[k2], k + "." + k2, labels.has(k + "." + k2) ? k + "." + k2 : k); else go(v, k, k); }
  return out;
}

// ------------------------------------------------------------------ finding
type Doc = { e: Entry; t: string[]; r: string[]; x: string[]; h: string[] };
export type ExplorerIndex = { docs: Doc[]; df: Map<string, number>; n: number };
export function buildIndex(entries: Entry[]): ExplorerIndex {
  const docs = entries.map((e) => ({ e, t: words(e.title), r: words(e.trail.join(" ")), x: words(e.text + " " + (e.also || "")), h: e.kind === "section" ? words(HINTS.filter(([re]) => re.test(e.title)).map(([, t]) => t).join(" ")) : [] })), df = new Map<string, number>();
  for (const d of docs) for (const w of new Set([...d.t, ...d.r, ...d.x])) df.set(w, (df.get(w) || 0) + 1);
  return { docs, df, n: docs.length };
}
export function search(ix: ExplorerIndex, q: string, o: { tpl?: string; /** With no project open: the site type to lean toward (the newest project's). */ prefer?: string; kinds?: Entry["kind"][]; limit?: number } = {}): (Entry & { score: number })[] {
  const raw = words(q), qs = raw.filter((w) => !ACT.has(w)), use = qs.length ? qs : raw; if (!use.length) return [];
  const phrase = String(q).toLowerCase().replace(/[^a-z0-9 ]+/g, " ").trim();
  const res: (Entry & { score: number })[] = [];
  for (const d of ix.docs) {
    if (o.kinds && !o.kinds.includes(d.e.kind)) continue;
    let s = 0, hit = 0;
    for (const w of use) {
      const idf = Math.log(1 + ix.n / (1 + (ix.df.get(w) || 0)));
      let best = (d.t.includes(w) ? 5 : 0) + (d.r.includes(w) ? 2 : 0) + (d.x.includes(w) ? 1 : 0);
      if (d.h.includes(w)) best = Math.max(best, 6);
      if (!best) for (const alt of (GROUP.get(w) || []).map(stem)) { const a = (d.t.includes(alt) ? 2 : 0) + (d.r.includes(alt) ? 1 : 0) + (d.x.includes(alt) ? 0.4 : 0); if (a > best) best = a; }
      if (!best && w.length > 3) { if (d.t.some((x) => x.startsWith(w) || w.startsWith(x) && x.length > 3)) best = 2; else if (d.x.some((x) => x.startsWith(w))) best = 0.5; }
      if (best) { hit++; s += best * idf; }
    }
    if (!hit) continue;
    s *= 0.35 + 0.65 * (hit / use.length);                       // matching all the words beats matching one
    if (phrase.length > 3 && d.e.title.toLowerCase().includes(phrase)) s *= 1.8;
    if (d.t.length && d.t.every((w) => use.includes(w))) s *= d.e.kind === "section" ? 1.5 : 1.25; // the whole name was asked for
    if (d.e.kind === "section" && use.length > 1 && use.every((w) => d.t.includes(w))) s *= 1.35;   // a card named by all the words asked
    // The same card sits in every section: it only leads when a background or a section was asked about.
    if (/^Background & text|^Alignment/.test(d.e.kind === "section" ? d.e.title : d.e.trail[d.e.trail.length - 1] || "") && !use.some((w) => ["background", "section", "align", "alignment", "anim", "animat", "pattern", "animated"].includes(w))) s *= 0.5;
    if (o.tpl && d.e.tpl === o.tpl) s *= 1.6; else if (o.tpl && d.e.tpl && d.e.kind !== "project") s *= 0.75;
    else if (!o.tpl && o.prefer && d.e.tpl === o.prefer) s *= 1.15;
    if (d.e.kind === "screen") s *= 1.1;
    if (d.e.kind === "content") s *= 0.8;
    res.push({ ...d.e, score: s });
  }
  res.sort((a, b) => b.score - a.score);
  // The same setting in several site types: keep the best of each name and place.
  const seen = new Set<string>(), out: typeof res = [];
  for (const r of res) { const k = r.kind + "|" + r.title + "|" + r.trail.slice(1).join(">") + "|" + (o.tpl ? "" : r.tpl || "") + "|" + (r.project || ""); if (seen.has(k)) continue; seen.add(k); out.push(r); if (out.length >= (o.limit || 8)) break; }
  return out;
}
export const whereLine = (e: Entry) => e.trail.concat(e.kind === "content" ? [] : [e.title]).join(" › ");

/** Answers a question from what was read. `here`: the site type of the project that is open, if one is. */
export function answer(ix: ExplorerIndex, index: StudioIndex | null, q: string, here?: { tpl?: string; project?: string }): Answer {
  const text = q.trim(), low = text.toLowerCase(), ps = index?.projects || [];
  if (!text) return { kind: "help", say: "Ask where a setting is, what something does, or about your projects.", items: [] };
  const typeIn = Object.keys(TPL_NAME).find((k) => new RegExp("\\b(" + k + "|" + TPL_NAME[k].toLowerCase() + ")s?\\b").test(low));
  const statusIn = /\b(published|live)\b/.test(low) ? "published" : /\bdrafts?\b/.test(low) ? "draft" : /\bexported\b/.test(low) ? "exported" : "";
  const aboutProjects = /\b(projects?|sites?|websites?)\b/.test(low) || !!typeIn && /\b(how many|which|list|show)\b/.test(low);
  // Counting and listing the projects.
  if (aboutProjects && /\b(how many|number of|count|which|list|show me|show all|what are)\b/.test(low) && !/\b(setting|option|change|where do|how do)\b/.test(low)) {
    const match = ps.filter((p) => (!typeIn || p.template === typeIn) && (!statusIn || p.status === statusIn));
    const what = `${statusIn ? STATUS[statusIn].replace(/^a /, "") + " " : ""}${typeIn ? TPL_NAME[typeIn].toLowerCase() + " " : ""}`;
    const items = readProjects({ ...(index as StudioIndex), projects: match }).map((e) => ({ ...e, score: 1 })).slice(0, 12);
    if (/\b(how many|number of|count)\b/.test(low)) {
      const by = Object.keys(TPL_NAME).map((k) => [TPL_NAME[k], ps.filter((p) => p.template === k).length] as const).filter(([, n]) => n);
      return { kind: "count", say: `You have ${match.length} ${what}project${match.length === 1 ? "" : "s"}.`, detail: !typeIn && !statusIn && by.length > 1 ? by.map(([n, c]) => `${c} ${n.toLowerCase()}`).join(", ") + `. ${ps.filter((p) => p.status === "published").length} published.` : undefined, items };
    }
    return { kind: "list", say: match.length ? `${match.length} ${what}project${match.length === 1 ? "" : "s"}:` : `No ${what}projects yet.`, items };
  }
  // Words someone wrote on a site: "find “…”" or anything in quotes.
  const quoted = /["“”']([^"“”']{3,})["“”']/.exec(text);
  if (quoted || /^(find|search|look for|which (site|project) (says|has|mentions))\b/.test(low)) {
    const items = search(ix, quoted ? quoted[1] : text.replace(/^(find|search|look for)\s+/i, ""), { kinds: ["content", "project"], limit: 8 });
    if (items.length) return { kind: "found", say: `Found in ${new Set(items.map((i) => i.project)).size} project${new Set(items.map((i) => i.project)).size === 1 ? "" : "s"}:`, items };
  }
  const newest = [...ps].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
  const items = search(ix, text, { tpl: here?.tpl, prefer: newest?.template, limit: 7 });
  const top = items[0];
  if (!top || top.score < 1.2) return { kind: "none", say: "I couldn't find that in this Studio.", detail: "I read the Studio's own settings, screens and your projects on this device. I don't use AI, so try the plain name of the thing (for example “logo”, “delivery charge”, “opening hours”).", items: items.slice(0, 3) };
  const what = /^(what|whats|what's)\b.*\b(is|are|does|do|mean)\b/.test(low) || /\bmeans?\b/.test(low);
  if (top.kind === "content") return { kind: "found", say: `That is written in ${top.trail[0]}:`, items };
  if (top.kind === "project") return { kind: "found", say: `${top.title} is ${top.text.charAt(0).toLowerCase() + top.text.slice(1)}.`, items };
  const place = top.kind === "screen" ? (top.route != null && top.route !== "" || top.title === "Projects" ? top.trail.concat(top.title).join(" › ") : top.trail.concat(top.title).join(" › ")) : whereLine(top);
  const say = what && top.text ? `${top.title}: ${top.text}` : `${top.kind === "screen" ? "That is" : "You'll find it at"} ${place}.`;
  const other = !here?.tpl && top.tpl && (top.kind === "setting" || top.kind === "section") ? `Shown for a ${tplName(top.tpl).toLowerCase()} site. Open a project and I'll take you straight to it.` : "";
  return { kind: "where", say, detail: [what ? `It is at ${place}.` : top.text, other].filter(Boolean).join(" ") || undefined, items };
}
