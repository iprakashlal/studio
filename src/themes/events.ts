// Themes for the Events template: every kind of event has 20 looks of its own (E-0001 …).
// A look is a palette and a pair of fonts (taken from the business themes, which share this template's style
// options), a hero layout, a menu, section styles, and the event's own parts: how the schedule, the line-up, the
// tickets, the countdown, the date and the registration page are drawn, and what kind of registration it is.
// No two themes share the same mix. The styles match public/templates/events/assets/evt.css.
import { type Axis, type Theme } from "./catalog";
import { BIZ_AXES, BIZ_BASE_THEMES as BIZ_THEMES, businessThemeValues } from "./business";
import { LOOK_TAGS, lookTheme } from "./looks";

export const EVT_AXES: Record<string, Axis> = {
  ...BIZ_AXES,
  sched: { key: "sched", label: "Schedule style", options: [["timeline", "Timeline with dots"], ["rows", "Ruled rows"], ["cards", "Cards"], ["big", "Big times"], ["pills", "Rounded strips"], ["dark", "Dark board"], ["side", "Accent edge, time on the right"]] },
  lineup: { key: "lineup", label: "Line-up style", options: [["grid", "Portrait grid"], ["circles", "Round photos"], ["list", "Rows with small photos"], ["tall", "Tall cards, name over the photo"], ["framed", "Framed cards"], ["mono", "Black and white, colour on hover"], ["tilt", "Tilted prints"]] },
  tix: { key: "tix", label: "Tickets style", options: [["cards", "Cards"], ["stubs", "Ticket stubs"], ["rows", "Rows"], ["centre", "Centred, big price"], ["dark", "Dark highlight"], ["band", "Colour band on top"], ["glow", "Raised highlight"]] },
  count: { key: "count", label: "Countdown style", options: [["boxes", "Boxes"], ["inline", "In a line"], ["digits", "Big digits"], ["rings", "Rings"], ["dark", "Dark boxes"], ["accent", "Accent boxes"], ["strip", "Tinted strip"]] },
  dateBadge: { key: "dateBadge", label: "Date in the hero", options: [["leaf", "Calendar leaf"], ["line", "Plain line"], ["chip", "Pills"], ["stamp", "Round stamp"], ["ribbon", "Dark ribbon"], ["block", "Wide block"]] },
  flow: { key: "flow", label: "Order of sections", options: [["own", "As arranged under Sections & order"], ["programme", "Schedule first"], ["people", "Line-up first"], ["tickets", "Tickets early"], ["story", "Story first: about, numbers, highlights"], ["proof", "Numbers and quotes first"], ["spotlight", "Highlights first"], ["venue", "Venue early"]] },
  high: { key: "high", label: "Highlights layout", options: [["cards", "Cards"], ["list", "Ruled list"], ["numbered", "Big numbers"], ["bento", "Bento grid"], ["icons", "Round icons, no boxes"], ["tiles", "Colour-topped tiles"], ["side", "Heading at the side"]] },
  stat: { key: "stat", label: "Numbers style", options: [["rule", "Ruled row"], ["big", "Huge digits"], ["cards", "Cards"], ["dark", "Dark strip"], ["accent", "Accent strip"], ["pills", "Pills"], ["top", "Accent line on top"]] },
  about: { key: "about", label: "About layout", options: [["split", "Story left, values right"], ["flip", "Values left, story right"], ["card", "In a card"], ["rule", "Under a rule"], ["stack", "Stacked, values in a row"], ["centre", "Centred"], ["tint", "Tinted band"]] },
  faq: { key: "faq", label: "FAQ layout", options: [["side", "Heading at the side"], ["stack", "Centred column"], ["cards", "Cards"], ["two", "Two columns"], ["numbered", "Numbered"], ["tint", "Tinted rows"]] },
  cta: { key: "cta", label: "Call-to-action style", options: [["dark", "Dark box"], ["accent", "Accent box"], ["centre", "Centred"], ["outline", "Outlined"], ["gradient", "Gradient"], ["wide", "Edge to edge"], ["soft", "Soft tint"]] },
  quote: { key: "quote", label: "Quotes style", options: [["cards", "Cards"], ["big", "One large quote per row"], ["rule", "Accent rule"], ["bubble", "Speech bubbles"], ["dark", "Dark cards"], ["tint", "Tinted cards"]] },
  reg: { key: "reg", label: "Registration page layout", options: [["split", "Form left, summary right"], ["flip", "Summary left, form right"], ["stack", "Summary on top"], ["panel", "Dark summary"], ["accent", "Accent summary"], ["stub", "Summary as a ticket stub"], ["plain", "No boxes"]] },
};
/** The kinds of registration (see REG in assets/evt.js): what the form asks and how it is priced. */
export const REG_KINDS: [string, string][] = [["tickets", "Tickets (choose how many)"], ["delegate", "Delegate registration (passes, company, job title)"], ["rsvp", "RSVP (attending, guests, meal)"], ["team", "Team registration (team name and members)"], ["stall", "Stall booking (business name, what you sell)"], ["entry", "Participant entry (category, age, T-shirt size, emergency contact)"], ["seat", "Seat reservation"], ["enrol", "Enrolment (choose a batch)"], ["donate", "Donation (choose an amount)"], ["volunteer", "Volunteer sign-up"], ["media", "Press accreditation"]];
export const regKindName = (k: string) => (REG_KINDS.find(([v]) => v === k)?.[1] || k).replace(/ \(.*/, "");

export const EVT_GROUPS = ["Business", "Learning", "Competition", "Stage", "Arts", "Social", "Sport", "Community", "Market", "Food"] as const;
type Group = (typeof EVT_GROUPS)[number];
/** name | group | the registrations that suit it (a type's 20 themes take them in turn) | who is on stage | words a person might use for it */
type TypeRow = [string, Group, string, string, string];
const T: TypeRow[] = [
  ["Conference", "Business", "delegate tickets media", "Speakers", "conference|conclave|convention"],
  ["Summit", "Business", "delegate tickets", "Speakers", "summit"],
  ["Seminar", "Business", "seat delegate enrol", "Speakers", "seminar"],
  ["Symposium", "Business", "delegate seat", "Speakers", "symposium|colloquium"],
  ["Trade Show", "Business", "stall tickets delegate", "Exhibitors", "trade ?show|trade fair|b2b fair"],
  ["Expo", "Business", "stall tickets", "Exhibitors", "expo\\b|exposition"],
  ["Exhibition", "Business", "tickets stall", "Exhibitors", "exhibition"],
  ["Product Launch", "Business", "seat media rsvp", "Presenters", "product launch|launch event|unveil"],
  ["Networking Event", "Business", "tickets rsvp", "Hosts", "networking"],
  ["Mixer", "Business", "rsvp tickets", "Hosts", "mixer|meet and greet|social hour"],
  ["Corporate Retreat", "Business", "rsvp delegate", "Facilitators", "corporate retreat|company retreat|leadership retreat"],
  ["Offsite", "Business", "rsvp delegate", "Facilitators", "off-?site"],
  ["Town Hall", "Business", "seat rsvp", "Speakers", "town ?hall"],
  ["All-Hands Meeting", "Business", "rsvp seat", "Speakers", "all[- ]hands"],
  ["Annual General Meeting", "Business", "rsvp seat", "Board", "annual general meeting|\\bagm\\b"],
  ["Award Ceremony", "Business", "tickets rsvp seat", "Hosts", "award|felicitation"],
  ["Gala Dinner", "Business", "tickets rsvp", "Hosts", "gala dinner|gala night|banquet"],
  ["Press Conference", "Business", "media rsvp", "Speakers", "press conference|press meet"],
  ["Media Briefing", "Business", "media rsvp", "Speakers", "media briefing|press briefing"],
  ["Workshop", "Learning", "enrol tickets", "Instructors", "workshop|masterclass"],
  ["Bootcamp", "Learning", "enrol tickets", "Mentors", "boot ?camp"],
  ["Training Session", "Learning", "enrol seat", "Trainers", "training"],
  ["Webinar", "Learning", "seat enrol", "Speakers", "webinar|online session|live session"],
  ["Panel Discussion", "Learning", "seat tickets", "Panellists", "panel"],
  ["Fireside Chat", "Learning", "seat tickets", "Guests", "fireside"],
  ["Lecture", "Learning", "seat tickets", "Speakers", "lecture|talk\\b|oration"],
  ["Keynote", "Learning", "seat tickets", "Speakers", "keynote"],
  ["Hackathon", "Competition", "team entry", "Judges & mentors", "hackathon|codefest|code sprint"],
  ["Ideathon", "Competition", "team entry", "Judges & mentors", "ideathon|startup weekend|pitch"],
  ["Case Competition", "Competition", "team entry", "Judges", "case competition|b-?plan|business plan competition|quiz"],
  ["Job Fair", "Learning", "seat stall", "Employers", "job fair|recruitment drive|walk-?in"],
  ["Career Expo", "Learning", "seat stall", "Employers", "career (expo|fair)|education fair|admission fair"],
  ["Concert", "Stage", "tickets", "Artists", "concert"],
  ["Live Music Gig", "Stage", "tickets", "Artists", "gig\\b|live music|band night"],
  ["Festival", "Stage", "tickets stall", "Line-up", "festival|fest\\b|mela"],
  ["Music Festival", "Stage", "tickets", "Line-up", "music fest"],
  ["Arts Festival", "Arts", "tickets stall", "Artists", "arts? fest"],
  ["Film Festival", "Arts", "tickets delegate", "Filmmakers", "film fest"],
  ["Literature Festival", "Arts", "tickets seat", "Authors", "lit(erature|erary)? ?fest|book fair"],
  ["Theater", "Stage", "tickets", "Cast", "theat(er|re)|play\\b|drama"],
  ["Musical", "Stage", "tickets", "Cast", "musical"],
  ["Dance Performance", "Stage", "tickets", "Performers", "dance|recital|bharatanatyam|kathak|ballet"],
  ["Opera", "Stage", "tickets", "Cast", "opera"],
  ["Comedy Show", "Stage", "tickets", "Comedians", "comedy|stand-?up"],
  ["Open Mic Night", "Stage", "tickets entry", "Performers", "open mic"],
  ["Art Exhibition", "Arts", "tickets rsvp", "Artists", "art (exhibition|show)|painting exhibition"],
  ["Gallery Opening", "Arts", "rsvp tickets", "Artists", "gallery|vernissage"],
  ["Film Screening", "Arts", "tickets seat", "Cast & crew", "screening|movie night"],
  ["Premiere", "Arts", "rsvp tickets media", "Cast & crew", "premiere"],
  ["Book Launch", "Arts", "rsvp seat", "Authors", "book launch|book release"],
  ["Author Reading", "Arts", "seat tickets", "Authors", "author reading|book reading|poetry"],
  ["Fashion Show", "Arts", "tickets rsvp media", "Designers", "fashion|runway"],
  ["Wedding", "Social", "rsvp", "The couple", "wedding|shaadi|marriage|nikah"],
  ["Reception", "Social", "rsvp", "Hosts", "reception"],
  ["Engagement", "Social", "rsvp", "The couple", "engagement|ring ceremony|sagai|roka"],
  ["Birthday Party", "Social", "rsvp", "Hosts", "birthday"],
  ["Anniversary Party", "Social", "rsvp", "Hosts", "anniversary"],
  ["Baby Shower", "Social", "rsvp", "Hosts", "baby shower|godh bharai"],
  ["Bridal Shower", "Social", "rsvp", "Hosts", "bridal shower|bachelorette|mehendi|sangeet|haldi"],
  ["Reunion", "Social", "rsvp tickets", "Organisers", "reunion|alumni meet"],
  ["Holiday Party", "Social", "rsvp tickets", "Hosts", "holiday party|christmas party|new year|diwali party"],
  ["Seasonal Party", "Social", "rsvp tickets", "Hosts", "seasonal|summer party|halloween|holi party|garba|navratri"],
  ["Graduation Party", "Social", "rsvp", "Hosts", "graduation|farewell|convocation"],
  ["Tournament", "Sport", "team entry", "Teams", "tournament|cup\\b"],
  ["Championship", "Sport", "entry team tickets", "Athletes", "championship"],
  ["League Match", "Sport", "tickets team", "Teams", "league|match\\b|fixture"],
  ["Marathon", "Sport", "entry", "Pacers & guests", "marathon|10k|half marathon"],
  ["Fun Run", "Sport", "entry", "Pacers & guests", "fun run|colou?r run|walkathon|5k"],
  ["Cycling Race", "Sport", "entry", "Riders", "cycl|cyclothon|ride\\b"],
  ["Fitness Class", "Sport", "enrol seat", "Trainers", "fitness class|zumba|yoga class|pilates|bootcamp class"],
  ["Wellness Retreat", "Sport", "enrol tickets", "Guides", "wellness retreat|yoga retreat|meditation retreat"],
  ["Esports Tournament", "Competition", "team entry tickets", "Casters & teams", "e-?sports|gaming tournament|bgmi|valorant"],
  ["LAN Party", "Competition", "tickets team", "Hosts", "lan party"],
  ["Watch Party", "Social", "rsvp tickets", "Hosts", "watch party|screening party"],
  ["Fundraiser", "Community", "donate tickets", "Hosts", "fundrais|crowdfund"],
  ["Charity Auction", "Community", "tickets donate", "Hosts", "auction"],
  ["Benefit Gala", "Community", "tickets donate", "Hosts", "benefit|charity gala|charity dinner"],
  ["Community Meetup", "Community", "rsvp seat", "Hosts", "meet-?up|community meet"],
  ["Club Gathering", "Community", "rsvp", "Committee", "club|society meet|chapter meet"],
  ["Volunteer Drive", "Community", "volunteer", "Organisers", "volunteer|clean-?up|plantation drive"],
  ["Blood Donation Camp", "Community", "volunteer", "Organisers", "blood donation|health camp|medical camp"],
  ["Farmers Market", "Market", "stall volunteer", "Growers & makers", "farmers?'? market|organic market"],
  ["Pop-Up Market", "Market", "stall tickets", "Makers", "pop-?up (market|shop|store)|makers market|bazaar"],
  ["Flea Market", "Market", "stall", "Sellers", "flea|thrift|garage sale|swap meet"],
  ["Parade", "Community", "entry volunteer", "Groups", "parade|procession|rally|yatra"],
  ["Cultural Festival", "Community", "tickets stall volunteer", "Performers", "cultural (fest|festival|night|program)"],
  ["Religious Festival", "Community", "rsvp volunteer donate", "Hosts", "religious|puja|pooja|utsav|jayanti|urs|satsang|kirtan"],
  ["Public Hearing", "Community", "seat rsvp", "Panel", "public hearing|consultation"],
  ["Civic Town Hall", "Community", "seat rsvp", "Panel", "civic|ward meeting|residents'? meeting"],
  ["Food Festival", "Food", "tickets stall", "Chefs & kitchens", "food fest"],
  ["Street Food Fair", "Food", "stall tickets", "Vendors", "street food|food fair|food truck"],
  ["Tasting Event", "Food", "tickets seat", "Hosts", "tasting|wine|whisky|coffee cupping"],
  ["Pop-Up Dining", "Food", "tickets seat", "Chefs", "pop-?up (dinner|dining|kitchen)"],
  ["Supper Club", "Food", "tickets seat", "Chefs", "supper club|chef'?s table"],
  ["Cooking Class", "Food", "enrol", "Chefs", "cooking class|baking class|culinary class"],
  ["Culinary Demo", "Food", "seat tickets", "Chefs", "culinary demo|cook-?off|live cooking"],
  ["IT Seminar", "Learning", "seat delegate", "Speakers", "it seminar|tech (talk|seminar|meetup)|developer (day|meet)"],
];
export const EVT_TYPES = T.map((r) => r[0]);
export const EVT_TYPE_INFO: Record<string, { group: Group; kinds: string[]; stage: string; words: string }> = Object.fromEntries(T.map(([name, group, kinds, stage, words]) => [name, { group, kinds: kinds.split(" "), stage, words }]));
/** The type of event a person's own words describe ("our college's annual tech fest" → Festival), or "" when none fits. The longest match wins. */
export function eventTypeOf(text: string): string {
  const s = String(text || "").toLowerCase(); let best = "", len = 0;
  for (const [name, , , , words] of T) { const m = new RegExp("(?:^|[^a-z])(?:" + words + ")", "i").exec(s) || (s.includes(name.toLowerCase()) ? [name] : null); if (m && m[0].length > len) { best = name; len = m[0].length; } }
  return best;
}

/** What each group of events looks for in a palette, how many of its 20 are dark, and its motion and ornament. */
const G: Record<Group, { tags: string[]; dark: number; fx: string[]; motif: string[] }> = {
  Business: { tags: ["Corporate", "Consulting", "Tech", "Modern", "Finance", "Classy"], dark: 5, fx: ["clean", "calm", "clean", "elegant", "clean", "print"], motif: ["geometric", "tech", "build", "studio"] },
  Learning: { tags: ["Education", "Modern", "Tech", "Calm", "Coaching", "School"], dark: 4, fx: ["clean", "calm", "playful", "clean", "print"], motif: ["studio", "geometric", "playful", "tech"] },
  Competition: { tags: ["Tech", "Bold", "Software", "IT", "Modern", "Creative"], dark: 11, fx: ["neon", "clean", "glowy", "calm", "stage"], motif: ["cyber", "tech", "celestial", "geometric"] },
  Stage: { tags: ["Bold", "Creative", "Luxury", "Agency", "Events", "Studio"], dark: 12, fx: ["stage", "glowy", "clean", "neon", "elegant"], motif: ["cinema", "celestial", "retro", "luxury", "studio"] },
  Arts: { tags: ["Creative", "Minimal", "Classy", "Design", "Photography", "Luxury"], dark: 7, fx: ["elegant", "print", "clean", "stage", "calm"], motif: ["studio", "retro", "luxury", "geometric"] },
  Social: { tags: ["Wedding", "Warm", "Classy", "Luxury", "Hospitality", "Calm"], dark: 4, fx: ["elegant", "clean", "playful", "calm", "glowy"], motif: ["luxury", "celestial", "nature", "playful"] },
  Sport: { tags: ["Sports", "Fitness", "Gym", "Bold", "Trainer", "Bodybuild"], dark: 9, fx: ["clean", "stage", "neon", "calm", "playful"], motif: ["build", "geometric", "ocean", "cyber"] },
  Community: { tags: ["Nature", "Calm", "Warm", "Health", "Education", "Wellness"], dark: 3, fx: ["clean", "calm", "playful", "print"], motif: ["nature", "playful", "ocean", "geometric"] },
  Market: { tags: ["Warm", "Nature", "Handicrafts", "Retail", "Agriculture", "Bold"], dark: 3, fx: ["playful", "clean", "print", "calm"], motif: ["nature", "retro", "playful", "cafe"] },
  Food: { tags: ["Hospitality", "Warm", "Restaurant", "Café", "Bakery", "Catering"], dark: 6, fx: ["calm", "elegant", "clean", "print", "playful"], motif: ["cafe", "nature", "retro", "luxury"] },
};
// cursor loader textfx hoverfx scrollfx overlay herofx
const FX: Record<string, string> = {
  clean: "none none none lift none none none", calm: "none fade lines lift progress none float", stage: "glow curtain letters shine reveal grain halo", neon: "cross counter scramble tilt skew scanlines orbit",
  elegant: "none fade words shine smooth vignette breathe", playful: "dot fade wave offset reveal none sparkle", print: "none wipe lines zoom dots paper sway", glowy: "spotlight portal words spot ring aurora morph",
};
const LOOKS = ["Aurora", "Marquee", "Spotlight", "Velvet", "Neon", "Paper", "Atlas", "Ember", "Tide", "Prism", "Monarch", "Canvas", "Pulse", "Meadow", "Onyx", "Sunrise", "Lagoon", "Copper", "Orchid", "Zenith"];
const WIDTHS = ["normal", "wide", "normal", "xwide", "normal", "wide", "full", "normal", "narrow", "wide"], HEADS = ["normal", "upper", "normal", "serif", "normal", "light", "normal", "upper"];
// The frosted-glass backdrop makes every surface see-through, which fights the dark and accent panels these themes use, so it is left for the owner to choose.
const PATTERNS = ["none", "grid", "dots", "lines", "mesh"];
const STYLE_TAGS = ["Bold", "Classy", "Modern", "Minimal", "Warm", "Calm", "Luxury", "Nature"];
export const EVT_VARIANTS = 20;

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; };
const opt = (k: string) => EVT_AXES[k].options.map(([v]) => v);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export type EvtTheme = Theme & { biz: { bands: string }; evt: { type: string; group: Group; sched: string; lineup: string; tix: string; count: string; dateBadge: string; reg: string; regKind: string; flow: string; high: string; stat: string; about: string; faq: string; cta: string; quote: string } };

function build(): EvtTheme[] {
  // One entry per palette (the business themes repeat a few).
  const seenCols = new Set<string>(), pool = BIZ_THEMES.filter((b) => { const k = Object.values(b.colors).join(); if (seenCols.has(k)) return false; seenCols.add(k); return true; });
  const A = Object.fromEntries(["layout", "heroArt", "nav", "cards", "buttons", "shead", "pattern", "bands", "sched", "lineup", "tix", "count", "dateBadge", "reg", "flow", "high", "stat", "about", "faq", "cta", "quote"].map((k) => [k, opt(k)])) as Record<string, string[]>;
  const out: EvtTheme[] = [], sigs = new Set<string>(), builds = new Set<string>(), heroes = new Set<string>();
  T.forEach(([type, group, kindsS], ti) => {
    const g = G[group], kinds = kindsS.split(" ");
    // The 20 palettes that suit this kind of event best, a set share of them dark.
    const ranked = pool.map((b) => ({ b, s: g.tags.reduce((n, tag, i) => n + (b.tags.includes(tag) ? g.tags.length - i : 0), 0) + hash(type + "/" + b.id) * 2.5 })).sort((x, y) => y.s - x.s).map((x) => x.b);
    const pick: typeof pool = []; let dark = 0;
    for (const b of ranked) { if (pick.length >= EVT_VARIANTS) break; if (b.dark ? dark >= g.dark : pick.length - dark >= EVT_VARIANTS - g.dark) continue; pick.push(b); if (b.dark) dark++; }
    for (const b of ranked) { if (pick.length >= EVT_VARIANTS) break; if (!pick.includes(b)) pick.push(b); }
    // Light and dark are spread through the 20 instead of sitting in two blocks.
    pick.sort((x, y) => hash(type + "#" + x.id) - hash(type + "#" + y.id));
    for (let v = 0; v < EVT_VARIANTS; v++) {
      const b = pick[v], at = (k: string, mul: number, add: number) => A[k][(v * mul + ti * add) % A[k].length];
      const s = {
        layout: at("layout", 7, 3), nav: at("nav", 4, 1), cards: at("cards", 1, 1), buttons: at("buttons", 2, 1), heading: HEADS[(v + ti) % HEADS.length], shead: at("shead", 2, 3), pattern: PATTERNS[(v * 3 + ti) % PATTERNS.length],
        bands: at("bands", 3, 5), motionStyle: v % 7 === 6 ? "fade" : "rise", width: WIDTHS[(v + ti) % WIDTHS.length],
        sched: at("sched", 3, 1), lineup: at("lineup", 2, 3), tix: at("tix", 4, 2), count: at("count", 5, 1), dateBadge: at("dateBadge", 1, 5), reg: at("reg", 6, 4),
        flow: at("flow", 3, 5), high: at("high", 5, 2), stat: at("stat", 2, 5), about: at("about", 4, 3), faq: at("faq", 5, 1), cta: at("cta", 3, 4), quote: at("quote", 1, 3),
      };
      // No two themes are built the same way: the structure (everything but the colours and fonts) is unique in the whole catalogue,
      // so a page never repeats another's layout in different colours. A clash moves the hero art, then the menu.
      let ha = (v * 5 + ti * 2 + 1) % A.heroArt.length, sig = "", build = "", hero = "";
      for (let n = 0; n < A.heroArt.length * A.nav.length; n++) {
        build = [A.heroArt[ha], ...Object.values(s)].join(" "); sig = b.id + " " + build; hero = [s.layout, A.heroArt[ha], s.nav].join(" ");
        if (!sigs.has(sig) && !builds.has(build) && !heroes.has(hero)) break;
        // The first screen (layout, picture shape and menu together) is not shared with any other theme either.
        ha = (ha + 1) % A.heroArt.length; if (n % A.heroArt.length === A.heroArt.length - 1) s.nav = A.nav[(A.nav.indexOf(s.nav) + 1) % A.nav.length];
      }
      sigs.add(sig); builds.add(build); heroes.add(hero);
      const x = FX[g.fx[v % g.fx.length]].split(" "), regKind = kinds[v % kinds.length], look = LOOKS[(v + ti * 7) % LOOKS.length];
      out.push({
        id: `evt-${slug(type)}-${String(v + 1).padStart(2, "0")}`, name: `${type} · ${look}`,
        tags: [...new Set([type, group, b.dark ? "Dark" : "Light", ...b.tags.filter((t) => STYLE_TAGS.includes(t))])], dark: b.dark,
        blurb: `${type}: ${regKindName(regKind).toLowerCase()}, ${(EVT_AXES.layout.options.find(([k]) => k === s.layout)?.[1] || s.layout).toLowerCase()}.`,
        colors: b.colors, display: b.display, body: b.body, radius: b.radius,
        style: { layout: s.layout, heroArt: A.heroArt[ha], nav: s.nav, cards: s.cards, buttons: s.buttons, motionStyle: s.motionStyle, pattern: s.pattern, ornament: "none", heading: s.heading, shead: s.shead, width: s.width },
        portfolio: { about: "bento", skills: "cube", work: "deck", glow: false, network: false, three: false, ticker: false }, store: { grid: "auto", product: "classic" },
        fx: { cursor: x[0], loader: x[1], textfx: x[2], hoverfx: x[3], scrollfx: x[4], overlay: x[5] }, ...(x[6] !== "none" ? { herofx: x[6] } : {}),
        motif: g.motif[(v + ti) % g.motif.length], kit: "classic", biz: { bands: s.bands },
        evt: { type, group, sched: s.sched, lineup: s.lineup, tix: s.tix, count: s.count, dateBadge: s.dateBadge, reg: s.reg, regKind, flow: s.flow, high: s.high, stat: s.stat, about: s.about, faq: s.faq, cta: s.cta, quote: s.quote },
      } as EvtTheme);
    }
  });
  return out;
}
/** A Neumorphism and a Spatial UI theme for every kind of event, built on that kind's first theme. They come after all the
 *  others, so the existing codes (E-xxxx) never move. */
const lookThemes = (all: EvtTheme[]): EvtTheme[] => T.flatMap(([type]) => {
  const base = all.find((t) => t.evt.type === type)!;
  return (["neu", "spatial"] as const).map((l) => lookTheme(base, l, `evt-${slug(type)}-${l}`, `${type} · ${l === "neu" ? "Neumorphism" : "Spatial UI"}`, [type, base.evt.group], l === "spatial" ? true : base.dark));
});
const BUILT = build();
export const EVT_THEMES: EvtTheme[] = [...BUILT, ...lookThemes(BUILT)];
/** Stable IDs: E-0001 … in the order above (type by type). New types go at the end of the list only. */
export const EVT_CODES: Record<string, string> = Object.fromEntries(EVT_THEMES.map((t, i) => [t.id, "E-" + String(i + 1).padStart(4, "0")]));
export const isEvtTheme = (id: string) => id.startsWith("evt-");
/** The filters on the Themes page: the groups and styles as buttons, the kinds of event in a menu. */
export const EVT_TAGS = [...EVT_GROUPS, "Light", "Dark", ...LOOK_TAGS, ...STYLE_TAGS, ...EVT_TYPES];
export const evtThemesOf = (type: string) => EVT_THEMES.filter((t) => t.evt.type === type);

/** Events content.theme values for a theme. */
export function eventThemeValues(t: Theme): Record<string, unknown> {
  const e = (t as Partial<EvtTheme>).evt, ok = (k: string, v: string | undefined, d: string) => (EVT_AXES[k].options.some(([o]) => o === v) ? (v as string) : d);
  return { ...businessThemeValues(t), sched: ok("sched", e?.sched, "timeline"), lineup: ok("lineup", e?.lineup, "grid"), tix: ok("tix", e?.tix, "cards"), count: ok("count", e?.count, "boxes"), dateBadge: ok("dateBadge", e?.dateBadge, "leaf"), reg: ok("reg", e?.reg, "split"), flow: ok("flow", e?.flow, "own"), high: ok("high", e?.high, "cards"), stat: ok("stat", e?.stat, "rule"), about: ok("about", e?.about, "split"), faq: ok("faq", e?.faq, "side"), cta: ok("cta", e?.cta, "dark"), quote: ok("quote", e?.quote, "cards"), regKind: REG_KINDS.some(([k]) => k === e?.regKind) ? e!.regKind : "tickets" };
}
