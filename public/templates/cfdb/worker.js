// Site Studio database for Cloudflare Workers (D1). Set up and updated from the Studio. Generated from worker/db-worker.ts.

// src/lib/cfdbSchema.ts
var CFDB_SCHEMA = `
create table if not exists members (scope text not null, email text not null, role text not null default 'owner', added_at text not null default (datetime('now')), primary key (scope, email));
create table if not exists files (scope text not null, path text not null, sha text not null, size integer not null default 0, parts integer not null default 1, type text not null default '', updated_at text not null, primary key (scope, path));
create table if not exists chunks (scope text not null, path text not null, n integer not null, data blob not null, primary key (scope, path, n));
create table if not exists codes (email text primary key, hash text not null, expires integer not null, tries integer not null default 0, sent integer not null default 0);
create table if not exists enquiries (id integer primary key autoincrement, site text not null, data text not null, page text not null default '', status text not null default 'new', created_at text not null);
create index if not exists enquiries_site on enquiries (site, created_at);
create table if not exists stock (site text not null, item text not null, qty integer not null default 0, low integer not null default 0, updated_at text not null, primary key (site, item));
create table if not exists stock_log (id integer primary key autoincrement, site text not null, item text not null, delta integer not null, qty integer not null, why text not null default '', ref text not null default '', at text not null);
create index if not exists stock_log_site on stock_log (site, id);
create table if not exists carts (site text not null, ckey text not null, tok text not null, email text not null, name text not null default '', phone text not null default '', lines text not null default '[]', items text not null default '[]', total real not null default 0, cur text not null default '', back text not null default '', status text not null default 'open', sent integer not null default 0, sent_at text, order_no text not null default '', created_at text not null, updated_at text not null, primary key (site, ckey));
create index if not exists carts_tok on carts (tok);
create index if not exists carts_open on carts (status, updated_at);
create table if not exists reviews (id integer primary key autoincrement, site text not null, item text not null, label text not null default '', name text not null, email text not null default '', rating integer not null, title text not null default '', body text not null, verified integer not null default 0, status text not null default 'pending', reply text not null default '', reply_at text, created_at text not null);
create index if not exists reviews_item on reviews (site, item, status);
create table if not exists pins (email text primary key, salt text not null, hash text not null, tries integer not null default 0, locked integer not null default 0, set_at text not null);
create table if not exists pin_dev (email text not null, dev text not null, at integer not null, primary key (email, dev));
create table if not exists workers (worker text primary key, scope text not null);
create table if not exists repos (repo text primary key, scope text not null);
create table if not exists approvals (token text primary key, scope text not null, project text not null, name text not null, template text not null, content text not null, note text not null default '', status text not null default 'open', decided_by text not null default '', decided_at text, created_by text not null default '', created_at text not null);
create index if not exists approvals_project on approvals (scope, project, created_at);
create table if not exists approval_notes (id integer primary key autoincrement, token text not null, who text not null, body text not null, page text not null default '', kind text not null default 'comment', created_at text not null);
create index if not exists approval_notes_token on approval_notes (token, id);
`;
var CFDB_VERSION = 67;
var CFDB_WORKER_NAME = "picaffectz-db";

// src/lib/lookdigest.ts
var hex2 = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
var NAMED = { white: "#ffffff", black: "#000000" };
function hsl(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return "#" + hex2(f(0) * 255) + hex2(f(8) * 255) + hex2(f(4) * 255);
}
function cssColor(v) {
  v = v.trim().toLowerCase();
  let m;
  if (NAMED[v]) return NAMED[v];
  if (m = /^#([0-9a-f]{3,8})$/.exec(v)) {
    const h = m[1];
    if (h.length === 3 || h.length === 4) return "#" + h.slice(0, 3).split("").map((c) => c + c).join("");
    if (h.length === 6 || h.length === 8) return "#" + h.slice(0, 6);
    return "";
  }
  if (m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(v)) {
    const a = m[4] == null ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return a < 0.6 ? "" : "#" + hex2(+m[1]) + hex2(+m[2]) + hex2(+m[3]);
  }
  if (m = /^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(v)) {
    const a = m[4] == null ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return a < 0.6 ? "" : hsl(+m[1], +m[2], +m[3]);
  }
  return "";
}
var GENERIC = /^(inherit|initial|unset|serif|sans-serif|monospace|system-ui|ui-sans-serif|ui-serif|ui-monospace|cursive|fantasy|-apple-system|blinkmacsystemfont|segoe ui|arial|helvetica|helvetica neue|roboto|var\(.*\)|emoji|math)$/i;
var ICON = /icon|awesome|glyph|symbol|material|swiper|slick|dashicons|elementor|eicons/i;
function family(v) {
  for (const part of v.split(",")) {
    const n = part.trim().replace(/^["']|["']$/g, "").replace(/!important/i, "").trim();
    if (n && !GENERIC.test(n) && !ICON.test(n) && n.length < 40) return n;
  }
  return "";
}
var count = (m, k, n = 1) => m.set(k, (m.get(k) || 0) + n);
var top = (m, n) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
function digestPage(html, css) {
  html = String(html || "").slice(0, 3e6);
  css = String(css || "").slice(0, 3e6);
  const inline = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");
  const attrs = [...html.matchAll(/\sstyle\s*=\s*"([^"]{0,600})"/gi)].map((m) => m[1]).join(";\n");
  const all = (css + "\n" + inline).replace(/\/\*[\s\S]*?\*\//g, ""), sheet = all + "\n" + attrs;
  const vars = /* @__PURE__ */ new Map();
  for (const m of all.matchAll(/(--[\w-]+)\s*:\s*([^;}{]+)[;}]/g)) {
    const c = cssColor(m[2]);
    if (c && !vars.has(m[1])) vars.set(m[1], c);
  }
  const resolve = (v) => {
    const m = /var\(\s*(--[\w-]+)/.exec(v);
    return m ? vars.get(m[1]) || "" : cssColor(v.replace(/!important/i, "").trim().split(/\s+(?![^(]*\))/)[0] || "");
  };
  const colors = /* @__PURE__ */ new Map();
  for (const m of sheet.matchAll(/#[0-9a-f]{3,8}\b|rgba?\([^)]{5,40}\)|hsla?\([^)]{5,40}\)/gi)) {
    const c = cssColor(m[0]);
    if (c) count(colors, c);
  }
  const fonts = /* @__PURE__ */ new Map(), radii = /* @__PURE__ */ new Map();
  let bg = "", text = "", headFont = "", bodyFont = "", centered = 0, upper = 0;
  for (const m of all.matchAll(/([^{}]{1,300})\{([^{}]{1,4000})\}/g)) {
    const sel = m[1].trim().toLowerCase(), body = m[2];
    const isRoot = /(^|[\s,])(body|html|:root)(\s*[,{]|$)/.test(sel + "{"), isHead = /(^|[\s,>])h[12]\b|\.hero|\.title|\.heading|\.display/.test(sel);
    const ff = /font-family\s*:\s*([^;}]+)/i.exec(body);
    if (ff) {
      const f = family(ff[1].includes("var(") ? "" : ff[1]);
      if (f) {
        count(fonts, f);
        if (isHead && !headFont) headFont = f;
        if (isRoot && !bodyFont) bodyFont = f;
      }
    }
    if (isRoot) {
      const b = /background(?:-color)?\s*:\s*([^;}]+)/i.exec(body), c = /(?:^|[;\s])color\s*:\s*([^;}]+)/i.exec(body);
      if (b && !bg) bg = resolve(b[1]);
      if (c && !text) text = resolve(c[1]);
    }
    for (const r of body.matchAll(/border-radius\s*:\s*([\d.]+)(px|rem|em)\b/gi)) {
      const px = Math.round(parseFloat(r[1]) * (r[2] === "px" ? 1 : 16));
      if (px >= 0 && px <= 60) count(radii, px);
    }
    if (isHead && /text-align\s*:\s*center/i.test(body)) centered++;
    if (isHead && /text-transform\s*:\s*uppercase/i.test(body)) upper++;
  }
  for (const m of html.matchAll(/fonts\.googleapis\.com\/css2?\?([^"'>\s]+)/gi)) for (const f of m[1].matchAll(/family=([^&:@"']+)/g)) {
    const n = decodeURIComponent(f[1].replace(/\+/g, " ")).trim();
    if (n && !ICON.test(n)) count(fonts, n, 5);
  }
  if (!headFont || !bodyFont) for (const m of all.matchAll(/--[\w-]*(font|ff|family)[\w-]*\s*:\s*([^;}]+)[;}]/gi)) {
    const f = family(m[2]);
    if (!f) continue;
    count(fonts, f, 2);
    if (/head|display|title/i.test(m[0]) && !headFont) headFont = f;
    else if (/body|base|text|sans|primary/i.test(m[0]) && !bodyFont) bodyFont = f;
  }
  if (!bg) bg = vars.get("--bg") || vars.get("--background") || vars.get("--color-bg") || vars.get("--color-background") || vars.get("--body-bg") || "";
  if (!text) text = vars.get("--text") || vars.get("--color-text") || vars.get("--foreground") || vars.get("--body-color") || "";
  const src = html + "\n" + all, libs = [];
  const has = (k, re) => {
    if (re.test(src)) libs.push(k);
  };
  has("smooth", /\blenis\b|locomotive-scroll|smooth-scrollbar|ScrollSmoother|data-scroll-container/i);
  has("reveal", /\bgsap\b|ScrollTrigger|\baos\b|data-aos|split-?type|splitting|\bwow\.js|scrollreveal|data-sal\b|framer-motion/i);
  has("cursor", /custom-cursor|cursor-(dot|follower|ring|inner|outer)|\.cursor[\s{.,]|mouse-follower|cursor\s*:\s*none/i);
  has("tilt", /vanilla-tilt|data-tilt|tilt\.js|atropos/i);
  has("loader", /preloader|page-loader|loading-screen|\bpace\.js|barba|swup/i);
  has("marquee", /marquee|ticker/i);
  has("parallax", /parallax|rellax|data-speed/i);
  has("slider", /swiper|slick|splide|flickity|owl-carousel|embla/i);
  has("3d", /three(\.module)?(\.min)?\.js|\bTHREE\.|spline|babylon/i);
  const bodyAt = html.search(/<body/i), first = html.slice(Math.max(0, bodyAt), Math.max(0, bodyAt) + 9e3);
  const heroImage = /<(img|video|picture|canvas|model-viewer)\b/i.test(first.replace(/<header[\s\S]*?<\/header>|<nav[\s\S]*?<\/nav>/gi, ""));
  return { colors: top(colors, 40), ...bg ? { bg } : {}, ...text ? { text } : {}, fonts: top(fonts, 12), ...headFont ? { headFont } : {}, ...bodyFont ? { bodyFont } : {}, radii: top(radii, 8).map(([r]) => r), libs, centered: centered > 0, heroImage, uppercase: upper > 0 };
}
function sheetLinks(html, base) {
  const out = [];
  for (const m of String(html).matchAll(/<link\b[^>]*>/gi)) {
    if (!/rel\s*=\s*["']?[^"'>]*stylesheet/i.test(m[0])) continue;
    const h = /href\s*=\s*["']([^"']+)["']/i.exec(m[0]);
    if (!h) continue;
    try {
      const u = new URL(h[1].replace(/&amp;/g, "&"), base);
      if (u.protocol === "https:" && !/fonts\.googleapis\.com/.test(u.host) && !out.includes(u.href)) out.push(u.href);
    } catch {
    }
  }
  return out;
}

// src/lib/social.ts
var SOCIAL_KINDS = {
  instagram: ["Instagram", /(^|\.)(instagram\.com|instagr\.am)$/],
  facebook: ["Facebook", /(^|\.)(facebook\.com|fb\.com|fb\.me)$/],
  x: ["X (Twitter)", /(^|\.)(x\.com|twitter\.com)$/],
  linkedin: ["LinkedIn", /(^|\.)linkedin\.com$/],
  youtube: ["YouTube", /(^|\.)(youtube\.com|youtu\.be)$/],
  whatsapp: ["WhatsApp", /(^|\.)(wa\.me|whatsapp\.com)$/],
  telegram: ["Telegram", /(^|\.)(t\.me|telegram\.me)$/],
  threads: ["Threads", /(^|\.)threads\.(net|com)$/],
  pinterest: ["Pinterest", /(^|\.)(pinterest\.[a-z.]+|pin\.it)$/],
  snapchat: ["Snapchat", /(^|\.)snapchat\.com$/],
  tiktok: ["TikTok", /(^|\.)tiktok\.com$/],
  github: ["GitHub", /(^|\.)github\.com$/],
  behance: ["Behance", /(^|\.)behance\.net$/],
  dribbble: ["Dribbble", /(^|\.)dribbble\.com$/],
  medium: ["Medium", /(^|\.)medium\.com$/],
  maps: ["Google Maps", /(^|\.)(maps\.app\.goo\.gl|goo\.gl|g\.page|maps\.google\.[a-z.]+)$/],
  indiamart: ["IndiaMART", /(^|\.)indiamart\.com$/],
  justdial: ["Justdial", /(^|\.)(justdial\.com|jsdl\.in)$/],
  email: ["Email", null],
  phone: ["Phone", null],
  website: ["Website", null],
  other: ["Other link", null]
};
function socialKind(url) {
  let u;
  try {
    u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(url) ? url : "https://" + url);
  } catch {
    return "";
  }
  if (u.protocol === "mailto:") return "email";
  if (u.protocol === "tel:") return "phone";
  if (u.protocol !== "https:" && u.protocol !== "http:") return "";
  const host = u.hostname.toLowerCase();
  if (host === "google.com" || host === "www.google.com") return /^\/maps/.test(u.pathname) ? "maps" : "website";
  for (const [k, [, re]] of Object.entries(SOCIAL_KINDS)) if (re && re.test(host)) return k;
  return /\.[a-z]{2,}$/.test(host) ? "website" : "";
}
var tidy = (u) => u.replace(/[)\].,;:!?'"›»]+$/, "").replace(/^http:\/\//i, "https://");
function socialFromText(text) {
  const t = String(text || "").replace(/­/g, ""), out = /* @__PURE__ */ new Map();
  const add = (kind, url) => {
    if (kind && !out.has(kind)) out.set(kind, { kind, url, label: "" });
  };
  for (const m of t.matchAll(/(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>()"']*)?/gi)) {
    const raw = tidy(m[0]), kind = socialKind(raw);
    if (!kind || kind === "website" || kind === "email" || kind === "phone") continue;
    let u;
    try {
      u = new URL(/^https?:/i.test(raw) ? raw : "https://" + raw);
    } catch {
      continue;
    }
    if (u.pathname.replace(/\/+$/, "") === "" && !u.search && kind !== "maps") continue;
    add(kind, u.href.replace(/^http:/, "https:"));
  }
  const HANDLE = [
    [/instagram|insta\b|\big\b/i, "instagram", (h) => `https://www.instagram.com/${h}`],
    [/facebook|\bfb\b/i, "facebook", (h) => `https://www.facebook.com/${h}`],
    [/twitter|\bx\b/i, "x", (h) => `https://x.com/${h}`],
    [/telegram/i, "telegram", (h) => `https://t.me/${h}`],
    [/youtube/i, "youtube", (h) => `https://www.youtube.com/@${h}`],
    [/threads/i, "threads", (h) => `https://www.threads.net/@${h}`],
    [/github/i, "github", (h) => `https://github.com/${h}`],
    [/snapchat/i, "snapchat", (h) => `https://www.snapchat.com/add/${h}`]
  ];
  for (const m of t.matchAll(/([A-Za-z]{1,10})\s*(?:[:\-–|]|\bat\b|\bon\b)?\s*@([A-Za-z0-9._]{2,40})(?![\w.]*@|\.[a-z]{2,}\b)/g)) for (const [re, kind, make] of HANDLE) if (re.test(m[1])) {
    add(kind, make(m[2].replace(/\.$/, "")));
    break;
  }
  const wa = /whats\s*app[^\d+\n]{0,20}(\+?\d[\d\s-]{8,16}\d)/i.exec(t);
  if (wa) {
    const d = wa[1].replace(/\D/g, "");
    if (d.length >= 10) add("whatsapp", `https://wa.me/${d.length === 10 ? "91" + d : d}`);
  }
  return [...out.values()];
}

// src/lib/tracking.ts
var COURIERS = {
  bluedart: ["Blue Dart", "https://www.bluedart.com/trackdartresultthirdparty?trackFor=0&trackNo={awb}"],
  delhivery: ["Delhivery", "https://www.delhivery.com/track-v2/package/{awb}"],
  dtdc: ["DTDC", "https://www.dtdc.in/trace.asp"],
  xpressbees: ["Xpressbees", "https://www.xpressbees.com/shipment/tracking?awbNo={awb}"],
  ecom: ["Ecom Express", "https://ecomexpress.in/tracking/?awb_field={awb}"],
  ekart: ["Ekart", "https://ekartlogistics.com/shipmenttrack/{awb}"],
  indiapost: ["India Post", "https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx"],
  shadowfax: ["Shadowfax", "https://tracker.shadowfax.in/#/track/{awb}"],
  amazon: ["Amazon Shipping", "https://track.amazon.in/tracking/{awb}"],
  professional: ["The Professional Couriers", "https://www.tpcindia.com/track-info.aspx?id={awb}"],
  trackon: ["Trackon", "https://trackon.in/"],
  maruti: ["Shree Maruti Courier", "https://www.shreemaruti.com/track-your-shipment/"],
  tirupati: ["Shree Tirupati Courier", "https://www.shreetirupaticourier.net/"],
  gati: ["Gati", "https://www.gati.com/track-by-docket/"],
  safexpress: ["Safexpress", "https://www.safexpress.com/"],
  tci: ["TCI Express", "https://www.tciexpress.in/"],
  vxpress: ["V-Xpress", "https://www.vxpress.in/track/"],
  smartr: ["Smartr Logistics", "https://smartr.in/tracking.html"],
  fedex: ["FedEx", "https://www.fedex.com/fedextrack/?trknbr={awb}"],
  dhl: ["DHL Express", "https://www.dhl.com/in-en/home/tracking.html?tracking-id={awb}"],
  aramex: ["Aramex", "https://www.aramex.com/in/en/track/results?ShipmentNumber={awb}"],
  ups: ["UPS", "https://www.ups.com/track?tracknum={awb}"],
  shiprocket: ["Shiprocket", "https://shiprocket.co/tracking/{awb}"],
  nimbuspost: ["NimbusPost", "https://ship.nimbuspost.com/shipping/tracking/{awb}"],
  ithink: ["iThink Logistics", "https://www.ithinklogistics.com/track-order/"],
  shipmozo: ["Shipmozo", "https://www.shipmozo.com/track-order/"],
  shipyaari: ["Shipyaari", "https://www.shipyaari.com/tracking"],
  other: ["Another courier", ""]
};
var courierName = (c) => (COURIERS[c] || COURIERS.other)[0];
var courierLink = (c, awb) => {
  const u = (COURIERS[c] || ["", ""])[1];
  return u ? u.replace("{awb}", encodeURIComponent(awb)) : "";
};
var TRACKERS = {
  bluedart: { name: "Blue Dart", kind: "courier", needs: ["key", "secret", "user", "account"] },
  delhivery: { name: "Delhivery", kind: "courier", needs: ["key"] },
  dtdc: { name: "DTDC", kind: "courier", needs: ["key"] },
  xpressbees: { name: "Xpressbees", kind: "courier", needs: ["user", "secret"] },
  ecom: { name: "Ecom Express", kind: "courier", needs: ["user", "secret"] },
  shiprocket: { name: "Shiprocket", kind: "agg", needs: ["user", "secret"] },
  nimbuspost: { name: "NimbusPost", kind: "agg", needs: ["user", "secret"] },
  ithink: { name: "iThink Logistics", kind: "agg", needs: ["key", "secret"] },
  clickpost: { name: "ClickPost", kind: "multi", needs: ["user", "key"] },
  aftership: { name: "AfterShip", kind: "multi", needs: ["key"] },
  trackingmore: { name: "TrackingMore", kind: "multi", needs: ["key"] },
  ship24: { name: "Ship24", kind: "multi", needs: ["key"] },
  track17: { name: "17TRACK", kind: "multi", needs: ["key"] },
  custom: { name: "Another tracking API", kind: "custom", needs: ["url"] }
};
var TRACKER_FIELDS = { secret: ["key", "secret"], text: ["user", "account", "url", "hdr", "codes"], flags: ["on"] };
var trackerReady = (id, z) => !!(z && z.on && TRACKERS[id] && TRACKERS[id].needs.every((k) => String(z[k] || "").trim()));
var TRACK_STATES = { booked: "Booked", picked: "Picked up", transit: "In transit", out: "Out for delivery", delivered: "Delivered", failed: "Delivery attempted", returned: "Returning to the shop", unknown: "Waiting for the first scan" };
var S = (v, n = 200) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
function trackState(text) {
  const t = String(text || "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").toLowerCase();
  if (/\brto\b|return(ed|ing)? to (origin|shipper|sender|seller)|returned|reverse|undelivered.*return/.test(t)) return "returned";
  if (/not delivered|undelivered|un delivered|delivery (failed|attempt|exception)|attempt(ed)?\b|failed|refused|rejected|consignee (not|un)|address (issue|incomplete|not found)|exception|on hold|held/.test(t)) return "failed";
  if (/out for delivery|\bofd\b|with delivery (agent|boy|executive)|dispatched for delivery/.test(t)) return "out";
  if (/\bdelivered\b|delivery (done|complete|successful)|shipment delivered|\bdlvd\b/.test(t)) return "delivered";
  if (/in transit|intransit|transit|arriv|depart|reached|received at|bagg|connected|forwarded|dispatched|shipped|hub|facility|sorting|linehaul|on the way|en route|customs|manifested to/.test(t)) return "transit";
  if (/pick(ed)? ?up|pickup (done|complete)|collected|shipment picked|inscan|in scan|soft data|accepted at/.test(t)) return "picked";
  if (/manifest|booked|created|label|info received|information received|pending|not yet|awaiting|ready (to|for) (ship|pickup)|order placed|data received/.test(t)) return "booked";
  return "";
}
function when(a, b) {
  let s = S(a, 60), t = S(b, 20);
  if (!s) return "";
  if (/^\d{10}$/.test(s)) return new Date(+s * 1e3).toISOString();
  if (/^\d{13}$/.test(s)) return (/* @__PURE__ */ new Date(+s)).toISOString();
  if (/^\d{8}$/.test(s)) s = `${s.slice(4)}-${s.slice(2, 4)}-${s.slice(0, 2)}`;
  let m = /^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{4})(.*)$/.exec(s);
  if (m) s = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}${m[4]}`;
  if (/^\d{4}$/.test(t)) t = t.slice(0, 2) + ":" + t.slice(2);
  if (t && !/[T ]\d{1,2}:\d{2}/.test(s)) s += " " + t;
  m = /^(\d{4}-\d{2}-\d{2})[T ](\d{1,2}:\d{2}(?::\d{2})?)(?:\.\d+)?\s*(am|pm)?$/i.exec(s);
  if (m) {
    let [h, mi, se] = m[2].split(":");
    if (m[3]) {
      let n = +h % 12;
      if (/pm/i.test(m[3])) n += 12;
      h = String(n);
    }
    const d2 = /* @__PURE__ */ new Date(`${m[1]}T${h.padStart(2, "0")}:${mi}:${se || "00"}+05:30`);
    if (!isNaN(+d2)) return d2.toISOString();
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  return isNaN(+d) ? S(a, 40) + (t ? " " + t : "") : d.toISOString();
}
function day(a) {
  let s = S(a, 60);
  if (!s) return "";
  let m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  if (m) return m[1];
  if (/^\d{8}$/.test(s)) return `${s.slice(4)}-${s.slice(2, 4)}-${s.slice(0, 2)}`;
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(s);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const d = /* @__PURE__ */ new Date(s.replace(/-/g, " ") + " UTC");
  return isNaN(+d) ? "" : d.toISOString().slice(0, 10);
}
var DATE_KEY = /date|time|stamp|_at$|^at$|when|occur/i;
var TEXT_KEY = /status|activity|remark|message|description|detail|action|scan$|^scan|event|instruction|desc/i;
var PLACE_KEY = /location|city|place|origin|hub|centre|center|branch|office/i;
function findScans(j) {
  let best = [], n = 0;
  const walk = (v, depth) => {
    if (!v || typeof v !== "object" || depth > 7 || ++n > 4e3) return;
    if (Array.isArray(v)) {
      const rows = v.map((x) => x && typeof x === "object" && !Array.isArray(x) && Object.keys(x).length === 1 && typeof Object.values(x)[0] === "object" ? Object.values(x)[0] : x).filter((x) => x && typeof x === "object" && !Array.isArray(x));
      if (rows.length && rows.every((r) => Object.keys(r).some((k) => DATE_KEY.test(k)) && Object.keys(r).some((k) => TEXT_KEY.test(k))) && rows.length > best.length) best = rows;
      v.forEach((x) => walk(x, depth + 1));
    } else Object.values(v).forEach((x) => walk(x, depth + 1));
  };
  walk(j, 0);
  const pick = (r, re, not) => {
    for (const k of Object.keys(r)) if (re.test(k) && !(not && not.test(k)) && r[k] != null && typeof r[k] !== "object" && String(r[k]).trim()) return r[k];
    return "";
  };
  return best.map((r) => {
    const dk = Object.keys(r).filter((k) => DATE_KEY.test(k) && r[k] != null && typeof r[k] !== "object"), d = dk.find((k) => /date|stamp|_at$|^at$|when|occur/i.test(k)) || dk[0], tm = dk.find((k) => k !== d && /time/i.test(k));
    return { at: when(d ? r[d] : "", tm ? r[tm] : ""), text: S(pick(r, TEXT_KEY, /code|id$|type$|date|time/i) || pick(r, TEXT_KEY, /date|time/i)), place: S(pick(r, PLACE_KEY), 80) };
  }).filter((e) => e.text);
}
function norm(p) {
  let ev = (p.ev || []).filter((e) => e && e.text).map((e) => ({ at: S(e.at, 40), text: S(e.text), place: S(e.place, 80) }));
  if (!ev.length && p.raw) ev = findScans(p.raw);
  const t = (e) => {
    const d = Date.parse(e.at);
    return isNaN(d) ? 0 : d;
  };
  if (ev.length > 1 && ev.every((e) => t(e))) ev.sort((a, b) => t(b) - t(a));
  else if (ev.length > 1 && t(ev[0]) && t(ev[ev.length - 1]) && t(ev[0]) < t(ev[ev.length - 1])) ev.reverse();
  const say = S(p.say, 120) || (ev[0] ? ev[0].text : ""), st = trackState(say) || (ev[0] ? trackState(ev[0].text) : "") || (ev.length ? "transit" : "unknown");
  const link = S(p.link, 400);
  return { st, say: say || TRACK_STATES[st], eta: st === "delivered" ? "" : day(p.eta), link: /^https:\/\//.test(link) ? link : "", ev: ev.slice(0, 40) };
}
var TrackError = class extends Error {
};
async function ask(url, init = {}, as = "json") {
  const c = new AbortController(), timer = setTimeout(() => c.abort(), 12e3);
  let r;
  try {
    r = await fetch(url, { ...init, signal: c.signal, redirect: "follow" });
  } catch (e) {
    throw new TrackError(e?.name === "AbortError" ? "The tracking service took too long to answer." : "The tracking service couldn't be reached.");
  } finally {
    clearTimeout(timer);
  }
  const text = (await r.text()).slice(0, 4e5);
  if (as === "text") {
    if (!r.ok) throw new TrackError(`The tracking service answered ${r.status}.`);
    return text;
  }
  let j = null;
  try {
    j = JSON.parse(text);
  } catch {
  }
  if (!r.ok) throw new TrackError(r.status === 401 || r.status === 403 ? "The tracking service refused the keys. Check them under Courier tracking." : r.status === 404 ? "The tracking service doesn't know that tracking number yet." : r.status === 429 ? "The tracking service is asking us to slow down. Try again in a few minutes." : `The tracking service answered ${r.status}${j && (j.message || j.error) ? ": " + S(typeof (j.message || j.error) === "string" ? j.message || j.error : JSON.stringify(j.message || j.error), 160) : ""}.`);
  if (j == null) throw new TrackError("The tracking service sent an answer that couldn't be read.");
  return j;
}
var post = (body, headers = {}) => ({ method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json", ...headers }, body: JSON.stringify(body) });
var E = encodeURIComponent;
var arr = (v) => Array.isArray(v) ? v : v && typeof v === "object" ? [v] : [];
var SLUGS = {
  aftership: { bluedart: "bluedart", delhivery: "delhivery", dtdc: "dtdc", xpressbees: "xpressbees", ecom: "ecom-express", ekart: "ekart", indiapost: "india-post", shadowfax: "shadowfax", gati: "gati-kwe", professional: "professional-couriers", trackon: "trackon", fedex: "fedex", dhl: "dhl", aramex: "aramex", ups: "ups", shiprocket: "shiprocket", safexpress: "safexpress", amazon: "amazon-logistics-in" },
  trackingmore: { bluedart: "bluedart", delhivery: "delhivery", dtdc: "dtdc", xpressbees: "xpressbees", ecom: "ecom-express", ekart: "ekart", indiapost: "india-post", shadowfax: "shadowfax", gati: "gati-kwe", professional: "professional-couriers", trackon: "trackon", fedex: "fedex", dhl: "dhl", aramex: "aramex", ups: "ups", shiprocket: "shiprocket", safexpress: "safexpress", maruti: "shree-maruti", tirupati: "shree-tirupati", smartr: "smartr-logistics" },
  clickpost: { bluedart: "5", delhivery: "4", dtdc: "9", xpressbees: "6", ecom: "3", ekart: "24", indiapost: "22", shadowfax: "11", fedex: "1", aramex: "2", gati: "16" }
};
function slug(id, z, courier) {
  for (const part of String(z.codes || "").split(/[,\n;]+/)) {
    const [k, v] = part.split("=").map((x) => x.trim());
    if (k && v && k.toLowerCase() === courier) return v;
  }
  return (SLUGS[id] || {})[courier] || "";
}
var ASK = {
  // Blue Dart (API gateway): a sign-in token from the client ID and secret, then the tracking query with the
  // account's login ID and tracking licence key.
  bluedart: async (z, awb) => {
    const base = "https://apigateway.bluedart.com/in/transportation";
    const tok = await ask(base + "/token/v1/login", { headers: { ClientID: z.key, clientSecret: z.secret, Accept: "application/json" } });
    const jwt = tok.JWTToken || tok.jwtToken || tok.token;
    if (!jwt) throw new TrackError("Blue Dart didn't accept the client ID and secret.");
    const j = await ask(`${base}/tracking/v1/shipment?handler=tnt&loginid=${E(z.user)}&numbers=${E(awb)}&format=json&lickey=${E(z.account)}&scan=1&action=custawbquery&verno=1&awb=awb`, { headers: { JWTToken: jwt, Accept: "application/json" } });
    const s = arr(j?.ShipmentData?.Shipment)[0] || arr(j?.ShipmentData)[0] || {};
    if (s.Status && /incorrect|invalid|not found|no (data|record)/i.test(String(s.Status)) && !s.Scans) throw new TrackError("Blue Dart doesn't know that waybill number yet.");
    return norm({ say: s.Status, eta: s.ExpectedDelivery || s.ExpectedDeliveryDate, raw: j, ev: arr(s.Scans).map((x) => x.ScanDetail || x).flatMap(arr).map((d) => ({ at: when(d.ScanDate, d.ScanTime), text: d.Scan, place: d.ScannedLocation })) });
  },
  delhivery: async (z, awb) => {
    const j = await ask(`https://track.delhivery.com/api/v1/packages/json/?waybill=${E(awb)}`, { headers: { Authorization: "Token " + z.key, Accept: "application/json" } });
    const s = arr(j?.ShipmentData)[0]?.Shipment;
    if (!s) throw new TrackError(S(j?.Error || j?.rmk, 160) || "Delhivery doesn't know that waybill number yet.");
    return norm({ say: s.Status?.Status, eta: s.ExpectedDeliveryDate || s.PromisedDeliveryDate, raw: j, ev: arr(s.Scans).map((x) => x.ScanDetail || x).map((d) => ({ at: when(d.ScanDateTime || d.StatusDateTime), text: d.Instructions && d.Instructions !== d.Scan ? `${d.Scan}: ${d.Instructions}` : d.Scan, place: d.ScannedLocation })) });
  },
  dtdc: async (z, awb) => {
    const j = await ask(z.url && /^https:\/\//.test(z.url) ? z.url : "https://blktracksvc.dtdc.com/dtdc-api/rest/JSONCnTrk/getTrackDetails", post({ trkType: "cnno", strcnno: awb, addtnlDtl: "Y" }, { "X-Access-Token": z.key }));
    if (j?.statusFlag === false || j?.status && /fail/i.test(String(j.status)) && !j.trackDetails) throw new TrackError(S(j?.errorDetails?.[0]?.value || j?.message, 160) || "DTDC doesn't know that consignment number yet.");
    const h = j?.trackHeader || {};
    return norm({ say: h.strStatus, eta: h.strExpectedDeliveryDate || h.strRevExpectedDeliveryDate, raw: j, ev: arr(j?.trackDetails).map((d) => ({ at: when(d.strActionDate, d.strActionTime), text: d.strAction + (d.sTrRemarks || d.strRemarks ? ": " + (d.sTrRemarks || d.strRemarks) : ""), place: d.strOrigin || d.strDestination })) });
  },
  // Xpressbees and NimbusPost run the same API: sign in with the account's email and password, then ask.
  xpressbees: (z, awb) => beesLike("https://shipment.xpressbees.com/api", "/shipments2/track/", z, awb, "Xpressbees"),
  nimbuspost: (z, awb) => beesLike("https://api.nimbuspost.com/v1", "/shipments/track/", z, awb, "NimbusPost"),
  ecom: async (z, awb) => {
    const x = await ask(`https://plapi.ecomexpress.in/track_me/api/mawbd/?awb=${E(awb)}&username=${E(z.user)}&password=${E(z.secret)}`, {}, "text");
    const field = (src, name) => {
      const m = new RegExp(`<field[^>]*name="${name}"[^>]*>([^<]*)</field>`, "i").exec(src);
      return m ? m[1].replace(/&amp;/g, "&").trim() : "";
    };
    const scans = [...x.matchAll(/<object[^>]*model="scan_stages"[^>]*>([\s\S]*?)<\/object>/gi)].map((m) => ({ at: when(field(m[1], "updated_on")), text: field(m[1], "status") || field(m[1], "reason_code"), place: field(m[1], "location_city") || field(m[1], "scan_location") || field(m[1], "location") }));
    const say = field(x, "status") || field(x, "tracking_status");
    if (!say && !scans.length) throw new TrackError(/auth|unauthori|invalid/i.test(x.slice(0, 400)) ? "Ecom Express refused the username and password." : "Ecom Express doesn't know that AWB number yet.");
    return norm({ say, eta: field(x, "expected_date"), ev: scans });
  },
  shiprocket: async (z, awb) => {
    const tok = (await ask("https://apiv2.shiprocket.in/v1/external/auth/login", post({ email: z.user, password: z.secret }))).token;
    if (!tok) throw new TrackError("Shiprocket didn't accept the API user's email and password.");
    const j = await ask(`https://apiv2.shiprocket.in/v1/external/courier/track/awb/${E(awb)}`, { headers: { Authorization: "Bearer " + tok, Accept: "application/json" } });
    const d = j?.tracking_data || {};
    if (d.track_status === 0 && !arr(d.shipment_track_activities).length && !arr(d.shipment_track).length) throw new TrackError(S(d.error, 160) || "Shiprocket has no scans for that AWB number yet.");
    return norm({ say: arr(d.shipment_track)[0]?.current_status, eta: d.etd || arr(d.shipment_track)[0]?.edd, link: d.track_url, raw: j, ev: arr(d.shipment_track_activities).map((a) => ({ at: when(a.date), text: a["sr-status-label"] && a["sr-status-label"] !== "NA" ? a["sr-status-label"] : a.activity, place: a.location })) });
  },
  ithink: async (z, awb) => {
    const j = await ask("https://api.ithinklogistics.com/api_v3/order/track.json", post({ data: { awb_number_list: awb, access_token: z.key, secret_key: z.secret } }));
    const d = j?.data?.[awb] || Object.values(j?.data || {})[0];
    if (!d || d.message && !d.scan_details && !d.current_status) throw new TrackError(S(d?.message || j?.html_message || j?.message, 160) || "iThink Logistics doesn't know that AWB number yet.");
    return norm({ say: d.current_status, eta: d.expected_delivery_date, raw: j, ev: arr(d.scan_details).map((s) => ({ at: when(s.status_date_time || s.scan_date_time), text: s.status_remark && s.status_remark !== s.status ? `${s.status}: ${s.status_remark}` : s.status, place: s.status_location || s.scan_location })) });
  },
  clickpost: async (z, awb, courier) => {
    const cp = slug("clickpost", z, courier) || S(z.account, 12);
    if (!cp) throw new TrackError(`ClickPost needs its carrier number for this courier. Add it under Courier tracking \u2192 ClickPost \u2192 courier codes (for example ${courier}=5).`);
    const j = await ask(`https://api.clickpost.in/api/v2/track-order/?username=${E(z.user)}&key=${E(z.key)}&waybill=${E(awb)}&cp_id=${E(cp)}`);
    const r = j?.result?.[awb] || Object.values(j?.result || {})[0];
    if (!r || r.valid === false) throw new TrackError(S(j?.meta?.message, 160) || "ClickPost doesn't know that AWB number yet.");
    const one = (s) => ({ at: when(s.timestamp || s.created_at), text: s.clickpost_status_description || s.remark || s.status, place: s.location });
    return norm({ say: r.latest_status?.clickpost_status_description || r.latest_status?.remark, eta: r.additional?.courier_partner_edd, raw: j, ev: arr(r.scans).map(one) });
  },
  aftership: async (z, awb, courier) => {
    const H = { "as-api-key": z.key, Accept: "application/json" }, base = "https://api.aftership.com/tracking/2025-07/trackings", sl = slug("aftership", z, courier);
    const find = async () => arr((await ask(`${base}?tracking_numbers=${E(awb)}`, { headers: H }))?.data?.trackings)[0];
    let t = await find();
    if (!t) {
      await ask(base, post({ tracking_number: awb, ...sl ? { slug: sl } : {} }, H)).catch((e) => {
        if (!/already/i.test(String(e?.message))) throw e;
      });
      t = await find();
    }
    if (!t) throw new TrackError("AfterShip has started following that parcel. Its scans show here in a few minutes.");
    return norm({ say: t.subtag_message || t.tag, eta: t.courier_estimated_delivery_date?.estimated_delivery_date || t.aftership_estimated_delivery_date?.estimated_delivery_date || t.expected_delivery, link: t.courier_tracking_link, raw: t, ev: arr(t.checkpoints).map((c) => ({ at: when(c.checkpoint_time), text: c.message || c.subtag_message, place: c.location || [c.city, c.state].filter(Boolean).join(", ") })) });
  },
  trackingmore: async (z, awb, courier) => {
    const H = { "Tracking-Api-Key": z.key, Accept: "application/json" }, base = "https://api.trackingmore.com/v4/trackings", sl = slug("trackingmore", z, courier);
    const find = async () => arr((await ask(`${base}/get?tracking_numbers=${E(awb)}`, { headers: H }))?.data)[0];
    let t = await find();
    if (!t) {
      if (!sl) throw new TrackError("TrackingMore needs its code for this courier. Add it under Courier tracking \u2192 TrackingMore \u2192 courier codes.");
      await ask(base + "/create", post({ tracking_number: awb, courier_code: sl }, H)).catch((e) => {
        if (!/exist/i.test(String(e?.message))) throw e;
      });
      t = await find();
    }
    if (!t) throw new TrackError("TrackingMore has started following that parcel. Its scans show here in a few minutes.");
    const info = [...arr(t.destination_info?.trackinfo), ...arr(t.origin_info?.trackinfo)];
    return norm({ say: t.latest_event || t.delivery_status, eta: t.scheduled_delivery_date, raw: t, ev: info.map((c) => ({ at: when(c.checkpoint_date), text: c.tracking_detail, place: c.location })) });
  },
  ship24: async (z, awb) => {
    const j = await ask("https://api.ship24.com/public/v1/trackers/track", post({ trackingNumber: awb }, { Authorization: "Bearer " + z.key }));
    const t = arr(j?.data?.trackings)[0];
    if (!t) throw new TrackError("Ship24 doesn't know that tracking number yet.");
    return norm({ say: arr(t.events)[0]?.status || t.shipment?.statusMilestone, eta: t.shipment?.delivery?.estimatedDeliveryDate, raw: t, ev: arr(t.events).map((e) => ({ at: when(e.occurrenceDatetime || e.datetime), text: e.status, place: e.location })) });
  },
  track17: async (z, awb) => {
    const H = { "17token": z.key }, base = "https://api.17track.net/track/v2.2";
    const get = async () => arr((await ask(base + "/gettrackinfo", post([{ number: awb }], H)))?.data?.accepted)[0];
    let t = await get();
    if (!t) {
      await ask(base + "/register", post([{ number: awb }], H));
      t = await get();
    }
    const info = t?.track_info;
    if (!info) throw new TrackError("17TRACK has started following that parcel. Its scans show here in a few minutes.");
    return norm({ say: info.latest_event?.description || info.latest_status?.status, eta: info.time_metrics?.estimated_delivery_date?.to, raw: info, ev: arr(info.tracking?.providers).flatMap((p) => arr(p.events)).map((e) => ({ at: when(e.time_iso || e.time_utc), text: e.description, place: e.location })) });
  },
  // The shop's own choice: any address that answers with JSON. {awb} and {courier} in the address are filled in; an
  // optional header ("Name: value") carries the key. The scans are found wherever they sit in the answer.
  custom: async (z, awb, courier) => {
    const url = String(z.url || "").replace(/\{awb\}/g, E(awb)).replace(/\{courier\}/g, E(courier));
    if (!/^https:\/\//.test(url)) throw new TrackError("The tracking address must start with https://.");
    const headers = { Accept: "application/json" }, h = /^([\w-]{1,60})\s*:\s*(.*)$/.exec(String(z.hdr || "").trim());
    if (h) headers[h[1]] = h[2].replace(/\{key\}/g, String(z.key || ""));
    else if (z.key) headers.Authorization = "Bearer " + z.key;
    const j = await ask(url, { headers });
    const deep = (re) => {
      let out = "";
      const walk = (v, d) => {
        if (out || !v || typeof v !== "object" || d > 4) return;
        for (const [k, x] of Object.entries(v)) {
          if (out) return;
          if (re.test(k) && x != null && typeof x !== "object" && String(x).trim()) out = String(x);
          else if (x && typeof x === "object" && !Array.isArray(x)) walk(x, d + 1);
        }
      };
      walk(j, 0);
      return out;
    };
    const live = norm({ say: deep(/^(current_?status|latest_?status|status|shipment_?status|state)$/i), eta: deep(/^(edd|eta|etd|expected_?delivery(_?date)?|estimated_?delivery(_?date)?)$/i), link: deep(/^(track(ing)?_?(url|link))$/i), raw: j });
    if (live.st === "unknown" && !live.ev.length) throw new TrackError("That address answered, but no status or scans could be found in its answer.");
    return live;
  }
};
async function beesLike(base, path, z, awb, name) {
  const lg = await ask(base + "/users/login", post({ email: z.user, password: z.secret })), tok = typeof lg?.data === "string" ? lg.data : lg?.data?.token || lg?.token;
  if (!tok) throw new TrackError(`${name} didn't accept the email and password.`);
  const j = await ask(base + path + E(awb), { headers: { Authorization: "Bearer " + tok, Accept: "application/json" } });
  const d = j?.data;
  if (!d || j.status === false) throw new TrackError(S(j?.message, 160) || `${name} doesn't know that AWB number yet.`);
  return norm({ say: d.status, eta: d.edd || d.expected_delivery_date, raw: j, ev: arr(d.history).map((h) => ({ at: when(h.event_time), text: h.message || h.status_code, place: h.location })) });
}
function pickTracker(saved, courier) {
  const ok = (id) => trackerReady(id, saved[id]);
  if (TRACKERS[courier] && ok(courier)) return courier;
  for (const kind of ["multi", "custom"]) for (const id of Object.keys(TRACKERS)) if (TRACKERS[id].kind === kind && ok(id)) return id;
  const aggs = Object.keys(TRACKERS).filter((id) => TRACKERS[id].kind === "agg" && ok(id));
  return aggs.length === 1 ? aggs[0] : "";
}
async function trackLive(id, z, awb, courier) {
  const f = ASK[id];
  if (!f) throw new TrackError("Unknown tracking service.");
  const n = String(awb || "").trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9 _-]{3,39}$/.test(n)) throw new TrackError("That doesn't look like a tracking number.");
  try {
    return await f(z, n, courier);
  } catch (e) {
    if (e instanceof TrackError) throw e;
    throw new TrackError("The tracking service's answer couldn't be read.");
  }
}

// worker/db-worker.ts
var V = CFDB_VERSION;
var CHUNK = 9e5;
var enc = new TextEncoder();
var dec = new TextDecoder();
function otherToken(env, account) {
  if (!/^[\w-]{1,64}$/.test(account)) return "";
  try {
    return String(JSON.parse(env["CFX_" + account.replace(/-/g, "_")] || "null")?.t || "");
  } catch {
    return "";
  }
}
function otherAccounts(env) {
  const out = [];
  for (const k of Object.keys(env)) if (k.startsWith("CFX_")) {
    try {
      const j = JSON.parse(env[k]);
      if (j?.t) out.push({ id: k.slice(4), name: String(j.n || "").slice(0, 80) });
    } catch {
    }
  }
  return out;
}
var SCHEMA = CFDB_SCHEMA;
var cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, x-sha", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Max-Age": "86400", "Access-Control-Expose-Headers": "x-sha, x-updated" };
var json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });
var err = (status, error) => json({ error }, status);
var b64u = (b) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
var unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
var hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
async function hmac(secret, data) {
  const k = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(data)));
}
var emailOk = (e) => /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(e);
var scopeOk = (s) => /^(studio|site):[a-z0-9][a-z0-9-]{0,59}$/.test(s);
var pathOk = (p) => !!p && p.length < 400 && !p.includes("..") && !p.startsWith("/") && /^[\w\-./ ()@+,]+$/.test(p);
var TYPES = { json: "application/json", html: "text/html; charset=utf-8", css: "text/css", js: "text/javascript", md: "text/markdown", txt: "text/plain", svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", avif: "image/avif", pdf: "application/pdf", ico: "image/x-icon", mp4: "video/mp4", webm: "video/webm" };
var typeOf = (p) => TYPES[(p.split(".").pop() || "").toLowerCase()] || "application/octet-stream";
var publicPath = (p) => p === "content.json" || p === "cms/site.json" || p.startsWith("assets/");
async function sessionFor(env, email) {
  const body = b64u(enc.encode(JSON.stringify({ e: email, x: Date.now() + 30 * 864e5 })));
  return body + "." + b64u(await hmac(env.SECRET, "s:" + body));
}
async function who(env, req) {
  const t = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const [body, sig] = t.split(".");
  if (!body || !sig) return null;
  if (b64u(await hmac(env.SECRET, "s:" + body)) !== sig) return null;
  try {
    const o = JSON.parse(new TextDecoder().decode(unb64u(body)));
    return o.x > Date.now() && emailOk(o.e) ? o.e : null;
  } catch {
    return null;
  }
}
var pinOn = async (env) => !!(await getSetting(env, "_db", "pin").catch(() => null))?.on;
var pinWeak = (pin) => /^(\d)\1+$/.test(pin) || "0123456789".includes(pin) || "9876543210".includes(pin) || ["1212", "2580", "0852", "121212", "123123", "112233"].includes(pin);
var pinHash = async (env, email, salt, pin) => b64u(await hmac(env.SECRET, "pin:" + email + ":" + salt + ":" + pin));
var devHash = async (env, dev) => b64u(await hmac(env.SECRET, "dev:" + dev));
async function pinDevice(env, email) {
  const dev = b64u(crypto.getRandomValues(new Uint8Array(24)));
  await env.DB.prepare("insert into pin_dev (email, dev, at) values (?, ?, ?)").bind(email, await devHash(env, dev), Date.now()).run();
  await env.DB.prepare("delete from pin_dev where email = ? and dev not in (select dev from pin_dev where email = ? order by at desc limit 8)").bind(email, email).run();
  return dev;
}
var isDbOwner = async (env, e) => !!await env.DB.prepare("select 1 from members where email = ? and role = 'owner' and scope like 'studio:%' limit 1").bind(e).first() || !await env.DB.prepare("select 1 from members where scope like 'studio:%' limit 1").first() && !!await env.DB.prepare("select 1 from members where email = ? and role = 'owner' limit 1").bind(e).first();
async function gsCfg(env) {
  return await getSetting(env, "_db", "google") || {};
}
async function gsOrigin(env, origin) {
  if (!/^https:\/\/[a-z0-9.-]{1,200}(:\d{1,5})?$/i.test(origin)) return;
  const g = await gsCfg(env), list = g.origins || [];
  if (list.includes(origin)) return;
  await putSetting(env, "_db", "google", { ...g, origins: [...list, origin].slice(-60) });
}
var gsKeys = null;
async function gsEmail(idToken, aud, nonce) {
  try {
    const [h, b, sg] = idToken.split(".");
    if (!h || !b || !sg) return "";
    const head = JSON.parse(dec.decode(unb64u(h))), c = JSON.parse(dec.decode(unb64u(b)));
    if (head.alg !== "RS256") return "";
    if (!gsKeys || Date.now() - gsKeys.at > 36e5 || !gsKeys.keys.some((k) => k.kid === head.kid)) {
      const r = await fetch("https://www.googleapis.com/oauth2/v3/certs");
      if (!r.ok) return "";
      gsKeys = { at: Date.now(), keys: (await r.json()).keys || [] };
    }
    const jwk = gsKeys.keys.find((k) => k.kid === head.kid);
    if (!jwk) return "";
    const key = await crypto.subtle.importKey("jwk", { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true }, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    if (!await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, unb64u(sg), enc.encode(h + "." + b))) return "";
    if (c.iss !== "https://accounts.google.com" && c.iss !== "accounts.google.com" || c.aud !== aud || !(+c.exp * 1e3 > Date.now()) || c.nonce !== nonce) return "";
    if (c.email_verified !== true && c.email_verified !== "true") return "";
    const email = String(c.email || "").trim().toLowerCase();
    return emailOk(email) ? email : "";
  } catch {
    return "";
  }
}
function gsPage(title, text, finish = false) {
  const esc = (x) => x.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
  const script = finish ? `<script>(function(){var q=new URLSearchParams(location.hash.slice(1)),h=document.getElementById("h"),p=document.getElementById("p");try{history.replaceState(null,"",location.pathname)}catch(e){}
function say(a,b){h.textContent=a;p.textContent=b}
if(q.get("error")||!q.get("id_token")){say("Not signed in",q.get("error")==="access_denied"?"You closed Google's sign-in. You can close this window.":"Google didn't finish the sign-in. Close this window and try again.");return}
fetch("/auth/google/finish",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id_token:q.get("id_token"),state:q.get("state")})}).then(function(r){return r.json().then(function(j){return{ok:r.ok,j:j}})}).then(function(x){if(x.ok){say("Signed in","You can close this window and go back.");setTimeout(function(){try{window.close()}catch(e){}},400)}else say("Not signed in",(x.j&&x.j.error)||"Something went wrong. Close this window and try again.")}).catch(function(){say("Not signed in","Couldn't reach the sign-in. Close this window and try again.")})})();</script>` : "";
  return new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><meta name="referrer" content="no-referrer"><title>Sign in</title><style>body{font:16px/1.6 system-ui,sans-serif;max-width:420px;margin:18vh auto;padding:0 20px;color:#1d2433;text-align:center}p{color:#5b6475}</style><h1 id="h">${esc(title)}</h1><p id="p">${esc(text)}</p>${script}`, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Frame-Options": "DENY" } });
}
var roleOf = async (env, scope, email) => email ? (await env.DB.prepare("select role from members where scope = ? and email = ?").bind(scope, email).first())?.role || null : null;
async function readFile(env, scope, path) {
  const f = await env.DB.prepare("select sha, size, parts, type, updated_at from files where scope = ? and path = ?").bind(scope, path).first();
  if (!f) return null;
  const rows = (await env.DB.prepare("select data from chunks where scope = ? and path = ? order by n").bind(scope, path).all()).results || [];
  const parts = rows.map((r) => new Uint8Array(r.data));
  const out = new Uint8Array(parts.reduce((a, b) => a + b.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return { ...f, bytes: out };
}
async function sha1(b) {
  return hex(await crypto.subtle.digest("SHA-1", b));
}
async function writeFile(env, scope, path, bytes, sha) {
  const s = sha || "c" + await sha1(bytes);
  const n = Math.max(1, Math.ceil(bytes.length / CHUNK));
  const st = [env.DB.prepare("delete from chunks where scope = ? and path = ?").bind(scope, path)];
  for (let i = 0; i < n; i++) st.push(env.DB.prepare("insert into chunks (scope, path, n, data) values (?, ?, ?, ?)").bind(scope, path, i, bytes.slice(i * CHUNK, (i + 1) * CHUNK)));
  st.push(env.DB.prepare("insert into files (scope, path, sha, size, parts, type, updated_at) values (?, ?, ?, ?, ?, ?, ?) on conflict (scope, path) do update set sha = excluded.sha, size = excluded.size, parts = excluded.parts, type = excluded.type, updated_at = excluded.updated_at").bind(scope, path, s, bytes.length, n, typeOf(path), (/* @__PURE__ */ new Date()).toISOString()));
  await env.DB.batch(st);
  return s;
}
async function sendMail(env, to, subject, html, replyTo) {
  if (!env.RESEND_API_KEY || !env.MAIL_FROM) throw new Error("Email isn't set up on this database (Resend).");
  const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ from: env.MAIL_FROM, to: Array.isArray(to) ? to : [to], subject, html, ...replyTo ? { reply_to: replyTo } : {} }) });
  if (!r.ok) throw new Error("Resend didn't accept the email (" + r.status + "): " + (await r.text()).slice(0, 200));
}
var EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;
var hesc = (x) => String(x).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
var oneLine = (x) => String(x).replace(/[\r\n]+/g, " ").trim();
var fill = (t, vars) => String(t).replace(/\{(\w+)\}/g, (m, k) => k in vars ? vars[k] : m);
var paras = (t, style = "margin:0 0 12px") => String(t).trim().split(/\n\s*\n/).filter((p) => p.trim()).map((p) => `<p style="${style}">${hesc(p.trim()).replace(/\n/g, "<br>")}</p>`).join("");
var WRAP = (inner) => `<div style="font:15px/1.55 system-ui,Segoe UI,Arial,sans-serif;color:#111;max-width:560px">${inner}</div>`;
async function siteContent(env, site) {
  const f = await readFile(env, "site:" + site, "content.json");
  if (!f) return null;
  try {
    return JSON.parse(new TextDecoder().decode(f.bytes));
  } catch {
    return null;
  }
}
var siteName = (c, site) => oneLine(String(c?.brand?.name || c?.brand?.logoText || site));
async function notifyEnquiry(env, site, data, page) {
  env = await siteMail(env, site);
  const c = await siteContent(env, site);
  if (!c) return "";
  const F = c?.contact?.form || {}, E2 = c?.emails && typeof c.emails === "object" ? c.emails : {};
  const wantOwner = F.notify === true || F.notifyAsk !== 1, wantReply = E2.reply?.on === true && EMAIL_RE.test(data.email || "");
  if (!wantOwner && !wantReply) return "";
  if (!env.RESEND_API_KEY || !env.MAIL_FROM) return wantOwner ? "Not emailed: email (Resend) isn't set up on this site's database." : "";
  const since = new Date(Date.now() - 36e5).toISOString();
  const n = await env.DB.prepare("select count(*) n from enquiries where site = ? and created_at > ?").bind(site, since).first();
  if ((n?.n || 0) > 40) return wantOwner ? "Not emailed: more than 40 enquiries in an hour, so emails are paused." : "";
  const name = siteName(c, site);
  const addrs = (x) => [...new Set(String(x || "").split(/[,;\s]+/).map((y) => y.trim().toLowerCase()).filter((y) => EMAIL_RE.test(y)))].slice(0, 3);
  let owners = addrs(F.notifyTo);
  if (!owners.length) owners = addrs(c?.contact?.email);
  if (!owners.length && wantOwner) owners = addrs(((await env.DB.prepare("select email from members where scope = ? order by role = 'owner' desc limit 3").bind("site:" + site).all()).results || []).map((r) => r.email).join(","));
  let said = wantOwner && !owners.length ? "Not emailed: no address to send to. Fill in \u201CSend to\u201D under Enquiry form." : "";
  const vars = { name: oneLine(data.name || ""), site: name, page: page || "", email: oneLine(data.email || "") };
  const label = (k) => k.replace(/[-_]+/g, " ").replace(/^./, (ch) => ch.toUpperCase());
  const rows = Object.entries(data).filter(([k]) => k !== "consent" && k !== "okey" && k !== "pay_state" && k !== "rz_order" && k !== "pay_gw" && k !== "cart" && k !== "_items" && !(k === "message" && data.order_no) && !k.startsWith("_")).map(([k, v]) => `<tr><td style="padding:6px 14px 6px 0;color:#667;vertical-align:top;white-space:nowrap">${hesc(label(k))}</td><td style="padding:6px 0;white-space:pre-wrap">${hesc(v)}</td></tr>`).join("");
  const table = `<table style="border-collapse:collapse;margin:0 0 14px">${rows}</table>`;
  const jobs = [];
  if (wantOwner && owners.length) {
    const OO = E2.orderOwner && typeof E2.orderOwner === "object" ? E2.orderOwner : {}, ov = { ...vars, name: vars.name || "your website", order: oneLine(String(data.order_no || "")), total: oneLine(String(data.total || "")) };
    const subject = data.order_no ? oneLine(fill(String(OO.subject || "New order {order}{totalbit} from {name}"), { ...ov, totalbit: data.total ? " (" + data.total + ")" : "" })).slice(0, 150) || "New order" : oneLine(fill(String(F.notifySubject || "New enquiry from {name}"), { ...vars, name: vars.name || "your website" })).slice(0, 150) || "New enquiry";
    const intro = data.order_no ? fill(String(OO.intro || "New order {order} on the {site} website."), ov) : fill(String(E2.enquiry?.intro || "New enquiry from the {site} website."), vars);
    const foot = (data.order_no ? fill(String(OO.footer || "It is also saved under Purchased orders in the site's admin page."), ov) : fill(String(E2.enquiry?.footer || "It is also saved under Enquiries in the site's admin page."), vars)) + (EMAIL_RE.test(data.email || "") ? " Reply to this email to answer the visitor." : "");
    jobs.push(sendMail(env, owners, subject, WRAP(paras(intro) + table + paras(foot, "margin:0 0 8px;color:#667;font-size:13px")), EMAIL_RE.test(data.email || "") ? data.email : void 0).then(() => {
      said = "Emailed to " + owners.join(", ") + ".";
    }, (e) => {
      said = "Not emailed: " + String(e?.message || e).slice(0, 300);
    }));
  }
  if (wantReply) {
    const mine = await env.DB.prepare("select count(*) n from enquiries where site = ? and created_at > ? and instr(lower(data), ?) > 0").bind(site, since, JSON.stringify(String(data.email).toLowerCase())).first();
    if ((mine?.n || 0) <= 3) {
      const v2 = { ...vars, name: vars.name || "there" };
      const subject = oneLine(fill(String(E2.reply.subject || "Thank you for contacting {site}"), v2)).slice(0, 150) || "Thank you";
      const body = fill(String(E2.reply.message || "Hi {name},\n\nThank you for your message. We have received it and will get back to you soon.\n\n{site}"), v2);
      const copy = E2.reply.copy === true ? `<p style="margin:14px 0 6px;color:#667;font-size:13px">${hesc(String(E2.reply.copyLabel || "What you sent us"))}</p>${table}` : "";
      jobs.push(sendMail(env, String(data.email).trim(), subject, WRAP(paras(body) + copy), owners[0] || (EMAIL_RE.test(c?.contact?.email || "") ? c.contact.email : void 0)));
    }
  }
  await Promise.allSettled(jobs);
  return said;
}
var ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "\u2019", lsquo: "\u2018", rdquo: "\u201D", ldquo: "\u201C", ndash: "\u2013", mdash: "\u2014", hellip: "\u2026" };
var unent = (t) => t.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => e[0] === "#" ? String.fromCodePoint(parseInt(e[1] === "x" || e[1] === "X" ? e.slice(2) : e.slice(1), e[1] === "x" || e[1] === "X" ? 16 : 10) || 32) : ENT[e.toLowerCase()] ?? m);
function outlineOf(html) {
  const h = html.replace(/<(script|style|noscript|svg|template|iframe)[\s\S]*?<\/\1>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ");
  const clean = (x) => unent(x.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  const out = [];
  const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(h);
  if (t) out.push("TITLE: " + clean(t[1]));
  const d = /<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i.exec(h) || /<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i.exec(h);
  if (d) out.push("DESCRIPTION: " + clean(d[1]));
  const re = /<(h[1-4]|li|p|dt|dd|blockquote|figcaption)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  const seen = /* @__PURE__ */ new Set();
  while (m = re.exec(h)) {
    const x = clean(m[2]);
    if (x.length < 3 || seen.has(x)) continue;
    seen.add(x);
    const tag = m[1].toLowerCase();
    out.push(tag[0] === "h" ? "\n" + tag.toUpperCase() + ": " + x : tag === "li" ? "- " + x : x);
  }
  return out.join("\n").slice(0, 9e3);
}
var words = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
function copiedBits(o, src, n = 6) {
  const grams = /* @__PURE__ */ new Set();
  const w = words(src);
  for (let i = 0; i + n <= w.length; i++) grams.add(w.slice(i, i + n).join(" "));
  const hit = [];
  const walk = (v, path) => {
    if (typeof v === "string") {
      const x = words(v);
      for (let i = 0; i + n <= x.length; i++) if (grams.has(x.slice(i, i + n).join(" "))) {
        hit.push(path);
        return;
      }
    } else if (Array.isArray(v)) v.forEach((y, i) => walk(y, path + "." + i));
    else if (v && typeof v === "object") for (const k of Object.keys(v)) walk(v[k], path ? path + "." + k : k);
  };
  walk(o, "");
  return hit;
}
var BRIEF_KEYS = "brand_tagline, hero_eyebrow, hero_title, hero_text, hero_cta, about_title, about_text, mission, vision, values (4 \xD7 {title, text}), services_title, services_intro, services (up to 6 \xD7 {title, text}), process (4 \xD7 {title, text}), faq (up to 6 \xD7 {q, a}), banner_title, banner_text, cta_title, cta_text, seo_title, seo_description, footer_text";
var GOOGLE_HOSTS = /^(?:[\w-]+\.)*(?:google\.[a-z.]{2,6}|goo\.gl|g\.co|g\.page)$/i;
async function placesCall(key, url, body, mask) {
  const r = await fetch(url, { method: body ? "POST" : "GET", headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": mask, ...body ? { "Content-Type": "application/json" } : {} }, body: body ? JSON.stringify(body) : void 0 });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const m = String(j?.error?.message || r.status), st = String(j?.error?.status || "");
    if (/API key not valid|API_KEY_INVALID/i.test(m)) throw new Error("Google says that API key isn't valid. Check you copied all of it.");
    if (st === "PERMISSION_DENIED" || /not been used|disabled|not authorized/i.test(m)) throw new Error('Turn on "Places API (New)" for this key in Google Cloud (APIs & Services \u2192 Library), then try again.');
    if (r.status === 429) throw new Error("Google's limit for this key was reached. Try again later.");
    throw new Error("Google answered: " + m);
  }
  return j;
}
async function googleReviews(q) {
  const key = String(q.key || "").trim(), raw = String(q.link || "").trim().slice(0, 600);
  if (!/^AIza[\w-]{30,}$/.test(key)) return { error: "Paste a Google Maps Platform API key (it starts with AIza)." };
  if (!raw) return { error: "Paste the business's Google Maps link, or its name and city." };
  let id = "", text = "", ll = null;
  try {
    if (/^https?:\/\//i.test(raw)) {
      let u = new URL(raw);
      if (!GOOGLE_HOSTS.test(u.hostname)) return { error: "That isn't a Google Maps link. Open the business on Google Maps, press Share, and copy the link." };
      if (!/google\./i.test(u.hostname)) {
        const r = await fetch(u.href, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0" } });
        u = new URL(r.url);
        if (!GOOGLE_HOSTS.test(u.hostname)) return { error: "That link didn't lead to Google Maps." };
      }
      const full = decodeURIComponent(u.href);
      id = (/(ChIJ[\w-]{10,})/.exec(full) || [])[1] || u.searchParams.get("query_place_id") || "";
      const name = (/\/maps\/place\/([^/@?]+)/.exec(u.pathname) || [])[1];
      text = (name ? decodeURIComponent(name) : u.searchParams.get("q") || u.searchParams.get("query") || "").replace(/\+/g, " ").trim();
      const m = /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(full) || /[?&](?:ll|center)=(-?\d+\.\d+),(-?\d+\.\d+)/.exec(full);
      if (m) ll = { latitude: +m[1], longitude: +m[2] };
      if (!id && !text) return { error: "Couldn't find the business in that link. Paste its name, area and city instead." };
    } else text = raw;
    if (!id) {
      const s = await placesCall(key, "https://places.googleapis.com/v1/places:searchText", { textQuery: text, maxResultCount: 1, ...ll ? { locationBias: { circle: { center: ll, radius: 500 } } } : {} }, "places.id");
      id = s?.places?.[0]?.id || "";
      if (!id) return { error: `Google found no place for "${text}". Try the name with its area and city.` };
    }
    const d = await placesCall(key, `https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`, null, "id,displayName,formattedAddress,rating,userRatingCount,reviews,googleMapsUri");
    const S2 = (v, n) => String(v ?? "").trim().slice(0, n);
    return {
      place: { id: d.id, name: S2(d.displayName?.text, 120), address: S2(d.formattedAddress, 200), rating: +d.rating || 0, count: +d.userRatingCount || 0, url: S2(d.googleMapsUri, 300) },
      reviews: (d.reviews || []).map((r) => ({ rating: +r.rating || 0, text: S2(r.text?.text || r.originalText?.text, 1500), author: S2(r.authorAttribution?.displayName, 80), authorUrl: S2(r.authorAttribution?.uri, 300), when: S2(r.relativePublishTimeDescription, 40), time: S2(r.publishTime, 40) })).filter((r) => r.text && r.author)
    };
  } catch (e) {
    return { error: e?.message || String(e) };
  }
}
var VISION = ["@cf/meta/llama-4-scout-17b-16e-instruct", "@cf/meta/llama-3.2-11b-vision-instruct"];
async function readImage(env, dataUri) {
  const ask2 = "Transcribe ALL the text in this product pamphlet image exactly as printed: product names, prices, specifications, features, model numbers, contact details. Keep tables as 'label: value' lines. Output only the text.";
  let last;
  for (const model of VISION) {
    try {
      if (model.includes("3.2")) await env.AI.run(model, { prompt: "agree" }).catch(() => null);
      const r = await env.AI.run(model, { messages: [{ role: "user", content: [{ type: "text", text: ask2 }, { type: "image_url", image_url: { url: dataUri } }] }], max_tokens: 2048 });
      const t = String(r?.response ?? "").trim();
      if (t) return t;
    } catch (e) {
      last = e;
    }
  }
  throw last || new Error("Couldn't read the image.");
}
function productsIn(v, depth = 0) {
  if (typeof v === "string") {
    const t = v.replace(/```(?:json)?/gi, "");
    for (const m of [/\{[\s\S]*/, /\[[\s\S]*/]) {
      const x = m.exec(t.trim());
      if (x) {
        const o = parseLoose(x[0].replace(/\s*```?\s*$/, ""));
        if (o) return productsIn(o, depth);
      }
    }
    return [];
  }
  if (Array.isArray(v)) return v.filter((x) => x && typeof x === "object");
  if (!v || typeof v !== "object" || depth > 3) return [];
  if (Array.isArray(v.products)) return productsIn(v.products);
  if (v.name || v.product_name || v.model || v.title) return [v];
  for (const k of Object.keys(v)) {
    const x = productsIn(v[k], depth + 1);
    if (x.length) return x;
  }
  return [];
}
function parseLoose(t) {
  try {
    return JSON.parse(t);
  } catch {
  }
  for (let end = t.length; end > 0; end = t.lastIndexOf("}", end - 1)) {
    const full = end === t.length, head = full ? t : t.slice(0, end + 1);
    let st = [], inStr = false;
    for (let i = 0; i < head.length; i++) {
      const c = head[i];
      if (inStr) {
        if (c === "\\") i++;
        else if (c === '"') inStr = false;
      } else if (c === '"') inStr = true;
      else if (c === "{" || c === "[") st.push(c === "{" ? "}" : "]");
      else if (c === "}" || c === "]") st.pop();
    }
    if (inStr && !full) continue;
    try {
      return JSON.parse(head.replace(/[,:]\s*$/, "") + (inStr ? '"' : "") + st.reverse().join(""));
    } catch {
    }
    if (end < t.length - 2e4) break;
  }
  return null;
}
var specList = (v) => Array.isArray(v) ? v : v && typeof v === "object" ? Object.entries(v).map(([label, value]) => ({ label, value: String(value) })) : [];
function fromText(all) {
  const lines = all.split(/\n/).map((l) => l.replace(/^[-•*#>\s]+|\s+$/g, "").replace(/\*\*/g, "")).filter((l) => l && !/^--- PAGE/.test(l));
  const model = /\b[A-Z]{1,6}[- ]?\d{2,5}[A-Z]?\b/;
  let name = "", at = -1;
  for (let i = 0; i < lines.length && !name; i++) {
    const l = lines[i];
    if (l.length > 60 || !model.test(l) || /:|\|/.test(l)) continue;
    at = i;
    const prev = lines[i - 1] || "";
    name = (/^[A-Z][A-Z0-9&.\- ]{1,24}$/.test(prev) && !model.test(prev) && !l.toUpperCase().includes(prev.toUpperCase()) ? prev + " " : "") + l;
  }
  if (!name) name = lines.find((l) => l.length >= 3 && l.length <= 50 && /^[A-Z0-9][A-Z0-9&.\- ]+$/.test(l)) || "";
  if (!name) return [];
  const specs = [];
  for (const l of lines) {
    const m = /^([A-Za-z][^:|]{1,60}?)\s*[:|]\s*([^|]{1,120}?)\s*\|?$/.exec(l);
    if (m && !/https?$/i.test(m[1]) && !/phone|email|call|www/i.test(m[1])) specs.push({ label: m[1].trim(), value: m[2].trim() });
  }
  const summary = lines.filter((l) => l.length > 70 && /[a-z]/.test(l) && !/:/.test(l)).sort((a, b) => b.length - a.length)[0] || "";
  const fi = lines.findIndex((l) => /^key\s*features|^features/i.test(l)), features = [];
  if (fi >= 0) for (const l of lines.slice(fi + 1)) {
    if (/:|\|/.test(l) || l.length > 90 || !/[a-z]/.test(l) || features.length >= 8) break;
    if (l.length > 3) features.push(l);
  }
  const next = lines[at + 1] || "", kind = /welder|machine|system|series|inverter|pump|motor|printer|unit/i;
  const cat = at >= 0 && next.length < 50 && !/:/.test(next) && /^[A-Z]/.test(next) && next.split(" ").length >= 2 ? next : lines.find((l) => l.length < 50 && kind.test(l) && l !== name) || "";
  const category = cat.replace(/\s*[-–]\s*premium$/i, "").toLowerCase().replace(/^./, (c) => c.toUpperCase()).replace(/\b(saw|mig|tig|mma|igbt|ac|dc)\b/gi, (w) => w.toUpperCase());
  return [{ name: name.replace(/\s+/g, " "), category, summary, features, specs, details: "", price: "", page: 1 }];
}
var PRODUCT_KEYS = `{"products":[{"name":"","category":"","summary":"one or two sentences","price":"exactly as printed, or empty","features":["short points"],"details":"a fuller description in paragraphs","specs":[{"label":"","value":""}],"page":1}]}`;
async function readPamphlet(env, q) {
  const pages = [];
  const text = String(q.text || "").slice(0, 6e4);
  if (text.trim()) pages.push(text);
  const imgs = (Array.isArray(q.images) ? q.images : []).slice(0, 8);
  try {
    for (const im of imgs) {
      const uri = String(im?.data || "");
      if (!/^data:image\/(jpeg|png|webp);base64,/.test(uri) || uri.length > 45e5) continue;
      pages.push(`--- PAGE ${+im.page || pages.length + 1} ---
` + await readImage(env, uri));
    }
  } catch (e) {
    return { error: /neuron|quota|limit|429/i.test(String(e?.message || e)) ? "Today's free AI allowance is used up. Try again tomorrow." : "Couldn't read the pamphlet's pictures: " + (e?.message || e) };
  }
  const all = pages.join("\n\n").slice(0, 24e3);
  if (words(all).length < 12) return { error: "Couldn't find any text in that pamphlet. Try a clearer photo or the original PDF." };
  const sys = `You turn a business's own product pamphlet into catalogue entries. Return ONLY JSON shaped like ${PRODUCT_KEYS}. One entry per distinct product or model. Rules: use only what the pamphlet says; never invent prices, numbers, ratings, certifications or features; copy prices, model numbers and specification values exactly as printed; leave a field empty ("" or []) when the pamphlet doesn't say; category is a short group name the pamphlet suggests (or ""); summary is one or two plain sentences; features are short points; specs are label/value pairs from tables or lists; page is the page number (from the --- PAGE n --- markers) where the product appears, or 1. Skip company contact details, terms and general marketing text.`;
  const model = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
  const user = (q.hint ? "Note from the owner: " + String(q.hint).slice(0, 500) + "\n\n" : "") + "PAMPHLET TEXT:\n" + all;
  const S2 = (v, n = 2e3) => typeof v === "string" || typeof v === "number" ? String(v).trim().slice(0, n) : "";
  const clean = (list) => list.map((p) => ({
    name: S2(p?.name ?? p?.product_name ?? p?.productName ?? p?.product ?? p?.model ?? p?.title, 120),
    category: S2(p?.category, 60),
    summary: S2(p?.summary ?? p?.description, 400),
    price: S2(p?.price, 60),
    features: (Array.isArray(p?.features) ? p.features : []).map((x) => S2(x, 160)).filter(Boolean).slice(0, 12),
    details: S2(p?.details, 3e3),
    specs: specList(p?.specs ?? p?.specifications).map((x) => ({ label: S2(x?.label, 80), value: S2(x?.value, 200) })).filter((x) => x.label || x.value).slice(0, 30),
    page: Math.max(1, Math.min(99, parseInt(p?.page, 10) || 1))
  })).filter((p) => p.name).slice(0, 60);
  let products = [], guessed = false;
  for (const json2 of [true, false]) {
    let r;
    try {
      r = await env.AI.run(model, { messages: [{ role: "system", content: sys }, { role: "user", content: user }], max_tokens: json2 ? 4e3 : 6e3, temperature: 0.1, ...json2 ? { response_format: { type: "json_object" } } : {} });
    } catch (e) {
      if (/neuron|quota|limit|429/i.test(String(e?.message || e))) return { error: "Today's free AI allowance is used up. Try again tomorrow." };
      if (!json2) break;
      continue;
    }
    products = clean(productsIn(r?.response ?? r));
    if (products.length) break;
  }
  if (!products.length) {
    products = clean(fromText(all));
    guessed = products.length > 0;
  }
  if (!products.length) return { error: 'No products were found in that pamphlet. Add a note naming the product (for example "one product: MZ 1250 welder") and try again.' };
  return { products, read: words(all).length, social: socialFromText(all), ...guessed ? { guessed: true } : {} };
}
async function translateTexts(env, q) {
  const to = oneLine(String(q.to || "")).slice(0, 40), from = oneLine(String(q.from || "English")).slice(0, 40);
  const texts = (Array.isArray(q.texts) ? q.texts : []).slice(0, 30).map((x) => String(x ?? "").slice(0, 1500));
  if (!/^[\p{L} ()-]{2,40}$/u.test(to) || !texts.length) return { error: "Choose a language and some text." };
  const sys = `You translate the text of a small business website from ${from} into ${to}, written in ${to}'s own script. Rules: translate naturally, the way a good ${to} website for Indian customers reads, not word for word; keep brand and product names, people's names, numbers, prices, units, emails, web addresses and emoji exactly as they are; keep every line break and every marker exactly where it is (**bold**, ==highlight==, __underline__, {accent:\u2026}, list dashes, #, | table bars, HTML tags, {placeholders} in curly brackets); short labels stay short; never add notes or explanations. You receive a JSON object {"texts": {"1": "\u2026", "2": "\u2026"}} and answer with only a JSON object {"t": {"1": "\u2026", "2": "\u2026"}} with the same numbers, each holding the translation of the text with that number.`;
  let failed = "";
  const ask2 = async (idx) => {
    const got = /* @__PURE__ */ new Map();
    try {
      const r = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", { messages: [{ role: "system", content: sys }, { role: "user", content: JSON.stringify({ texts: Object.fromEntries(idx.map((i) => [String(i + 1), texts[i]])) }) }], max_tokens: 6e3, temperature: 0.2, response_format: { type: "json_object" } });
      const raw = typeof r?.response === "string" ? r.response : JSON.stringify(r?.response ?? r);
      let j = null;
      try {
        j = JSON.parse(raw);
      } catch {
        try {
          const m = /\{[\s\S]*\}/.exec(raw);
          j = m ? JSON.parse(m[0]) : null;
        } catch {
          j = null;
        }
      }
      if (!j) for (const m of raw.matchAll(/"(\d+)"\s*:\s*"((?:[^"\\]|\\.)*)"/g)) {
        try {
          const v = JSON.parse('"' + m[2] + '"');
          if (typeof v === "string" && v.trim() && idx.includes(+m[1] - 1)) got.set(+m[1] - 1, v.slice(0, 4e3));
        } catch {
        }
      }
      const t = j?.t;
      if (Array.isArray(t)) {
        if (t.length === idx.length) t.forEach((x, k) => {
          if (typeof x === "string" && x.trim()) got.set(idx[k], x.slice(0, 4e3));
        });
      } else if (t && typeof t === "object") for (const i of idx) {
        const x = t[String(i + 1)];
        if (typeof x === "string" && x.trim()) got.set(i, x.slice(0, 4e3));
      }
    } catch (e) {
      failed = String(e?.message || e);
    }
    return got;
  };
  const all = texts.map((_, i) => i), half = Math.ceil(all.length / 2);
  const first = await Promise.all((all.length > 6 ? [all.slice(0, half), all.slice(half)] : [all]).map(ask2));
  const done = /* @__PURE__ */ new Map();
  for (const m of first) for (const [k, v] of m) done.set(k, v);
  const missing = all.filter((i) => !done.has(i));
  if (missing.length) for (const [k, v] of await ask2(missing)) done.set(k, v);
  if (!done.size && failed) return { error: /neuron|quota|limit|429|capacity/i.test(failed) ? "Today's free AI allowance on this Cloudflare account is used up. Press Translate again after it resets (midnight UTC), or type translations in." : "The translator didn't answer (" + failed.slice(0, 120) + ")." };
  return { t: all.map((i) => done.get(i) ?? null) };
}
var ensured = false;
async function ensure(env) {
  if (ensured) return;
  await env.DB.batch([
    env.DB.prepare("create table if not exists settings (scope text not null, name text not null, value text not null, updated_at text not null, primary key (scope, name))"),
    env.DB.prepare("create table if not exists customers (site text not null, ckey text not null, name text not null default '', phone text not null default '', email text not null default '', verified integer not null default 0, orders integer not null default 0, spent real not null default 0, points integer not null default 0, first_at text not null, last_at text not null, primary key (site, ckey))"),
    env.DB.prepare("create table if not exists points (id integer primary key autoincrement, site text not null, ckey text not null, delta integer not null, why text not null default '', order_no text not null default '', at text not null)"),
    env.DB.prepare("create index if not exists points_site_key on points (site, ckey, id)"),
    // what a signed-in customer keeps about themselves beyond their name and contacts (their saved addresses)
    env.DB.prepare("create table if not exists profiles (site text not null, ckey text not null, data text not null default '{}', primary key (site, ckey))"),
    env.DB.prepare("create table if not exists otps (k text primary key, hash text not null, expires integer not null, tries integer not null default 0, sent integer not null default 0)"),
    // inventory: how many of each item are left, and every change to that
    env.DB.prepare("create table if not exists stock (site text not null, item text not null, qty integer not null default 0, low integer not null default 0, updated_at text not null, primary key (site, item))"),
    env.DB.prepare("create table if not exists stock_log (id integer primary key autoincrement, site text not null, item text not null, delta integer not null, qty integer not null, why text not null default '', ref text not null default '', at text not null)"),
    env.DB.prepare("create index if not exists stock_log_site on stock_log (site, id)"),
    env.DB.prepare("create table if not exists carts (site text not null, ckey text not null, tok text not null, email text not null, name text not null default '', phone text not null default '', lines text not null default '[]', items text not null default '[]', total real not null default 0, cur text not null default '', back text not null default '', status text not null default 'open', sent integer not null default 0, sent_at text, order_no text not null default '', created_at text not null, updated_at text not null, primary key (site, ckey))"),
    env.DB.prepare("create index if not exists carts_tok on carts (tok)"),
    env.DB.prepare("create index if not exists carts_open on carts (status, updated_at)"),
    env.DB.prepare("create table if not exists reviews (id integer primary key autoincrement, site text not null, item text not null, label text not null default '', name text not null, email text not null default '', rating integer not null, title text not null default '', body text not null, verified integer not null default 0, status text not null default 'pending', reply text not null default '', reply_at text, created_at text not null)"),
    env.DB.prepare("create index if not exists reviews_item on reviews (site, item, status)"),
    env.DB.prepare("create table if not exists pins (email text primary key, salt text not null, hash text not null, tries integer not null default 0, locked integer not null default 0, set_at text not null)"),
    env.DB.prepare("create table if not exists pin_dev (email text not null, dev text not null, at integer not null, primary key (email, dev))"),
    env.DB.prepare("create table if not exists design_queries (id integer primary key autoincrement, studio text not null, name text not null default '', kind text not null default '', person text not null default '', phone text not null default '', email text not null default '', note text not null default '', answers text not null default '{}', copy text not null default '{}', logo text not null default '', pdf_name text not null default '', pdf text not null default '', status text not null default 'new', mail text not null default '', created_at text not null)"),
    env.DB.prepare("create index if not exists design_queries_studio on design_queries (studio, id)"),
    env.DB.prepare("create table if not exists dq_rate (k text primary key, n integer not null, exp integer not null)"),
    env.DB.prepare("create table if not exists payments (rz_order text primary key, site text not null, order_no text not null, amount integer not null, status text not null default 'created', created_at text not null)")
  ]);
  ensured = true;
}
var SETTINGS = {
  ai: { secret: ["key"], text: ["base", "model", "vision"], flags: ["on"] },
  wa: { secret: ["token"], text: ["phoneId", "waba", "cc", "lang", "to", "phones", "tplOtp", "tplOrder", "tplEnquiry"], flags: ["on", "login", "orderOtp", "orderAlert", "enquiryAlert"] },
  rz: { secret: ["secret"], text: ["keyId"], flags: ["on"] },
  cf: { secret: ["secret"], text: ["appId"], flags: ["test"] },
  pe: { secret: ["secret"], text: ["clientId", "version"], flags: ["test"] },
  st: { secret: ["secret"], text: [], flags: [] },
  pp: { secret: ["secret"], text: ["clientId"], flags: ["test"] },
  // Petpooja (the restaurant's billing system): orders placed on the site go to it, and it sends back each order's status.
  pos: { secret: ["secret", "token"], text: ["appKey", "restId", "url"], flags: ["on"] },
  // SMS (text messages) through the owner's own account with MSG91 or Twilio: codes for signing in and for checkout.
  sms: { secret: ["key"], text: ["provider", "tpl", "varName", "sender", "sid", "from", "text", "cc", "phones", "chan", "email"], flags: ["on", "login", "orderOtp"] }
};
for (const id of Object.keys(TRACKERS)) SETTINGS["tk_" + id] = TRACKER_FIELDS;
SETTINGS.ship = { secret: [], text: [], flags: ["manual", "quiet"] };
SETTINGS.mail = { secret: ["key"], text: ["from"], flags: ["on"] };
SETTINGS.prefs = { secret: [], text: ["json"], flags: [] };
async function aesKey(env) {
  return crypto.subtle.importKey("raw", await crypto.subtle.digest("SHA-256", enc.encode("settings:" + env.SECRET)), "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function adoptMail(env, scope) {
  const r = await env.DB.prepare("select value from settings where scope = ? and name = 'mail!pending'").bind(scope).first();
  if (!r) return;
  let v = null;
  try {
    v = JSON.parse(String(r.value));
  } catch {
  }
  await env.DB.prepare("delete from settings where scope = ? and name = 'mail!pending'").bind(scope).run();
  if (v && /^re_\S{8,}$/.test(String(v.key || "")) && /^[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+$|<[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+>$/.test(String(v.from || "").trim())) await putSetting(env, scope, "mail", { on: true, key: String(v.key), from: String(v.from).trim() });
}
async function getSetting(env, scope, name) {
  await ensure(env);
  if (name === "mail" && scope.startsWith("site:")) await adoptMail(env, scope).catch(() => {
  });
  const r = await env.DB.prepare("select value from settings where scope = ? and name = ?").bind(scope, name).first();
  if (!r) return null;
  try {
    const b = unb64u(r.value);
    return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: b.slice(0, 12) }, await aesKey(env), b.slice(12))));
  } catch {
    return null;
  }
}
async function putSetting(env, scope, name, value) {
  await ensure(env);
  if (value == null) {
    await env.DB.prepare("delete from settings where scope = ? and name = ?").bind(scope, name).run();
    return;
  }
  const iv = crypto.getRandomValues(new Uint8Array(12)), ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(env), enc.encode(JSON.stringify(value))));
  const all = new Uint8Array(12 + ct.length);
  all.set(iv);
  all.set(ct, 12);
  let s = "";
  for (let i = 0; i < all.length; i += 8e3) s += String.fromCharCode(...all.subarray(i, i + 8e3));
  await env.DB.prepare("insert into settings (scope, name, value, updated_at) values (?, ?, ?, ?) on conflict (scope, name) do update set value = excluded.value, updated_at = excluded.updated_at").bind(scope, name, btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""), (/* @__PURE__ */ new Date()).toISOString()).run();
}
var trackOf = (d) => {
  try {
    const t = JSON.parse(String(d?._track || ""));
    return t && (t.awb || t.url) ? t : null;
  } catch {
    return null;
  }
};
var trackShown = (t) => t ? { c: String(t.c || "other"), name: t.c === "other" || !COURIERS[t.c] ? String(t.name || "Courier") : courierName(t.c), awb: String(t.awb || ""), link: /^https:\/\//.test(String(t.url || "")) ? String(t.url) : courierLink(t.c, String(t.awb || "")) } : null;
async function shipSaved(env, site) {
  await ensure(env);
  const o = {};
  for (const r of (await env.DB.prepare("select name from settings where scope = ? and name like 'tk!_%' escape '!'").bind("site:" + site).all()).results || []) {
    const id = String(r.name).slice(3);
    if (TRACKERS[id]) {
      const z = await getSetting(env, "site:" + site, r.name).catch(() => null);
      if (z) o[id] = z;
    }
  }
  return o;
}
var SHIP_OPEN = ["new", "read", "accepted", "preparing", "ready"];
async function shipLive(env, site, rowId, d, status, force = false) {
  const t = trackOf(d);
  if (!t || !t.awb) return { live: null, why: "", status };
  let had = null;
  try {
    had = JSON.parse(String(d._trk || ""));
  } catch {
  }
  if (had && (had.st === "delivered" || !force && Date.now() - (+had.t || 0) < 20 * 6e4)) return { live: had, why: "", status };
  if (!force && !had && +d._trk_bad > Date.now() - 5 * 6e4) return { live: null, why: String(d._trk_why || ""), status };
  const saved = await shipSaved(env, site), id = pickTracker(saved, String(t.c || ""));
  if (!id) return { live: had, why: Object.keys(saved).length ? "No tracking connection covers this courier." : "", status };
  let live;
  try {
    live = await trackLive(id, saved[id], String(t.awb), String(t.c || ""));
  } catch (e) {
    const why = e instanceof TrackError ? e.message : "The tracking service couldn't be read.";
    if (!had) await env.DB.prepare("update enquiries set data = ? where id = ? and site = ?").bind(JSON.stringify({ ...d, _trk_bad: String(Date.now()), _trk_why: why }), rowId, site).run().catch(() => {
    });
    return { live: had, why, status };
  }
  const keep = { ...live, ev: live.ev.slice(0, 25), t: Date.now(), via: id }, nd = { ...d, _trk: JSON.stringify(keep) };
  delete nd._trk_bad;
  delete nd._trk_why;
  const opt = await getSetting(env, "site:" + site, "ship").catch(() => null);
  let next = status;
  if (!opt?.manual) {
    if (live.st === "delivered" && [...SHIP_OPEN, "out"].includes(status)) next = "done";
    else if (["picked", "transit", "out"].includes(live.st) && SHIP_OPEN.includes(status)) next = "out";
  }
  await env.DB.prepare("update enquiries set data = ?, status = ? where id = ? and site = ?").bind(JSON.stringify(nd), next, rowId, site).run();
  return { live: keep, why: "", status: next };
}
var ORDER_DEF = {
  placed: { subject: "Thanks for your order {order}", heading: "We've got your order", message: "Hi {name},\n\nThanks for your order {order} from {site}. We've received it and will get it ready soon.\n\nOrder total: {total}", footer: "Questions? Just reply to this email." },
  shipped: { subject: "Your order {order} has shipped", heading: "Your order is on its way", message: "Hi {name}, your order {order} from {site} has shipped with {courier}.{trackline}", footer: "Thank you for shopping with us." },
  ready: { subject: "Your order {order} is ready", heading: "Your order is ready", message: "Hi {name}, your order {order} from {site} is ready.", footer: "Thank you!" },
  out: { subject: "Your order {order} is out for delivery", heading: "On its way to you", message: "Hi {name}, your order {order} from {site} is out for delivery.", footer: "Thank you!" },
  done: { subject: "Your order {order} is complete", heading: "Order complete", message: "Hi {name}, your order {order} from {site} is complete. We hope you enjoy it!", footer: "Thank you for choosing us." },
  cancelled: { subject: "Your order {order} was cancelled", heading: "Order cancelled", message: "Hi {name}, your order {order} from {site} has been cancelled. If you didn't ask for this, just reply to this email.", footer: "" }
};
var itemsText = (d) => {
  try {
    const a = JSON.parse(String(d?._items || "[]"));
    return Array.isArray(a) ? a.slice(0, 40).map((x) => `\u2022 ${Math.max(1, +x.q || 1)} \xD7 ${oneLine(String(x.n || ""))}`).join("\n") : "";
  } catch {
    return "";
  }
};
async function orderMail(env, site, kind, d, c0) {
  env = await siteMail(env, site);
  const to = emailKey(d?.email);
  if (!to || !env.RESEND_API_KEY || !env.MAIL_FROM) return "";
  const c = c0 || await siteContent(env, site).catch(() => null), E2 = c?.emails && typeof c.emails === "object" ? c.emails : {};
  const T = kind === "placed" ? E2.order : kind === "shipped" ? E2.shipped : E2.status?.[kind];
  if (kind !== "shipped" && T?.on !== true) return "";
  const def = ORDER_DEF[kind];
  if (!def) return "";
  const t = kind === "shipped" ? trackShown(trackOf(d)) : null;
  if (kind === "shipped" && !t) return "";
  const name = siteName(c, site);
  const vars = { name: oneLine(String(d.name || "")) || "there", order: oneLine(String(d.order_no || "")), total: oneLine(String(d.total || "")), site: name, shop: name, when: oneLine([d.mode, d.when].filter(Boolean).join(", ")), items: itemsText(d), courier: t ? t.name : "", tracking: t?.awb || "", trackline: t?.awb ? "\nTracking number: " + t.awb : "" };
  const subject = oneLine(fill(String(T?.subject || def.subject), vars)).slice(0, 150) || "Your order";
  const body = fill(String(T?.message || def.message), vars), heading = oneLine(fill(String(T?.heading || def.heading), vars));
  const foot = fill(String(T?.footer ?? def.footer) || (T && "footer" in T ? "" : def.footer), vars);
  const showItems = kind !== "shipped" && T?.items !== false && vars.items;
  const btn = t?.link ? `<p style="margin:0 0 12px"><a href="${hesc(t.link)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px">${hesc(oneLine(String(T?.button || "Track your parcel")))}</a></p>` : "";
  const list = showItems ? `<p style="margin:0 0 6px;color:#667;font-size:13px">${hesc(String(T?.itemsLabel || "Your order"))}</p>${paras(vars.items, "margin:0 0 12px")}` : "";
  const reply = emailKey(c?.contact?.email) || void 0;
  await sendMail(env, to, subject, WRAP(`<h2 style="margin:0 0 12px;font-size:20px">${hesc(heading)}</h2>${paras(body)}${list}${btn}${foot ? paras(foot, "margin:0 0 8px;color:#667;font-size:13px") : ""}`), reply);
  return kind === "shipped" ? "Shipping email sent to " + to : "Order email (" + kind + ") sent to " + to;
}
async function shippedMail(env, site, d) {
  return orderMail(env, site, "shipped", d);
}
async function siteMail(env, site) {
  if (!/^[a-z0-9][a-z0-9-]{0,59}$/.test(site)) return env;
  const m = await getSetting(env, "site:" + site, "mail").catch(() => null);
  return m?.on && m.key && m.from ? { ...env, RESEND_API_KEY: String(m.key), MAIL_FROM: String(m.from) } : env;
}
function maskSetting(name, v) {
  const S2 = SETTINGS[name], o = {};
  if (!v) return null;
  for (const k of S2.text) o[k] = String(v[k] ?? "");
  for (const k of S2.flags) o[k] = !!v[k];
  for (const k of S2.secret) o[k] = !!v[k];
  return o;
}
async function anySetting(env, name) {
  await ensure(env);
  const r = await env.DB.prepare("select scope from settings where name = ? order by updated_at desc limit 1").bind(name).first();
  return r ? getSetting(env, r.scope, name) : null;
}
function customAI(c) {
  const base = String(c.base || "").trim().replace(/\/+$/, "").replace(/\/chat\/completions$/, "");
  return {
    run: async (_model, o) => {
      if (!o?.messages) return { response: "" };
      const vision = o.messages.some((m2) => Array.isArray(m2.content));
      const send = (fmt) => fetch(base + "/chat/completions", {
        method: "POST",
        headers: { Authorization: "Bearer " + c.key, "Content-Type": "application/json" },
        body: JSON.stringify({ model: vision && c.vision || c.model, messages: o.messages, ...o.max_tokens ? { max_tokens: Math.min(o.max_tokens, 8e3) } : {}, ...o.temperature != null ? { temperature: o.temperature } : {}, ...fmt && o.response_format ? { response_format: o.response_format } : {} })
      });
      let r = await send(true);
      if (r.status === 400 && o.response_format) r = await send(false);
      if (!r.ok) {
        const t = (await r.text()).replace(/\s+/g, " ").slice(0, 240);
        throw new Error(r.status === 401 || r.status === 403 ? `Your AI API refused the key (${r.status}). Check it under Settings \u2192 AI engine.` : r.status === 429 ? "Your AI API says its limit is reached (429)." : `Your AI API answered ${r.status}: ${t}`);
      }
      const j = await r.json().catch(() => null), m = j?.choices?.[0]?.message?.content;
      return { response: typeof m === "string" ? m : Array.isArray(m) ? m.map((x) => x?.text || "").join("") : "" };
    }
  };
}
var waNum = (v, cc = "91") => {
  let d = String(v ?? "").replace(/\D/g, "");
  if (d.length === 10) d = (String(cc || "91").replace(/\D/g, "") || "91") + d;
  return d.length >= 11 && d.length <= 15 ? d : "";
};
var waText = (s, n = 300) => String(s ?? "").replace(/[\r\n\t]+/g, " ").replace(/ {4,}/g, "   ").trim().slice(0, n) || "-";
async function waSend(c, to, tpl, params, otp) {
  const comps = [{ type: "body", parameters: params.map((t) => ({ type: "text", text: waText(t) })) }];
  if (otp) comps.push({ type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: otp }] });
  const r = await fetch(`https://graph.facebook.com/v23.0/${encodeURIComponent(String(c.phoneId).trim())}/messages`, {
    method: "POST",
    headers: { Authorization: "Bearer " + c.token, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "template", template: { name: String(tpl).trim(), language: { code: String(c.lang || "en").trim() || "en" }, components: comps } })
  });
  if (!r.ok) throw new Error(`WhatsApp didn't accept the message (${r.status}): ` + (await r.text()).replace(/\s+/g, " ").slice(0, 200));
}
var GRAPH = "https://graph.facebook.com/v23.0";
async function graph(token, path, init) {
  const r = await fetch(GRAPH + path, { method: init?.method || "GET", headers: { Authorization: "Bearer " + token, ...init?.body ? { "Content-Type": "application/json" } : {} }, ...init?.body ? { body: JSON.stringify(init.body) } : {} });
  const j = await r.json().catch(() => null);
  if (!r.ok) {
    const e = new Error(String(j?.error?.error_user_msg || j?.error?.message || `Meta answered ${r.status}.`).slice(0, 300));
    e.status = r.status;
    e.code = j?.error?.code;
    throw e;
  }
  return j;
}
async function waFind(token, hint = "") {
  const ids = /* @__PURE__ */ new Set();
  let why = "", refused = false, said = "", scopes = null;
  let raw = "", named = 0, firms = 0;
  const note = (e) => {
    const m = String(e?.message || "").trim();
    if (m) raw = m;
    if (m && !/^Meta answered 404|nonexisting field|Unsupported get request|does not exist/i.test(m)) said = m;
  };
  if (/^\d{6,20}$/.test(hint)) ids.add(hint);
  try {
    const d = await graph(token, "/debug_token?input_token=" + encodeURIComponent(token));
    for (const g of d?.data?.granular_scopes || []) if (/^(whatsapp_business_(management|messaging)|business_management)$/.test(g?.scope)) for (const t of g.target_ids || []) ids.add(String(t));
    if (Array.isArray(d?.data?.scopes)) scopes = d.data.scopes.map(String);
    if (d?.data?.is_valid === false) why = "Meta says this token isn't valid (it may have expired).";
  } catch (e) {
    if (e?.status === 401 || e?.code === 190) {
      refused = true;
      why = "Meta refused the token. Check that you copied all of it and that it hasn't expired.";
    }
  }
  named = ids.size - (/^\d{6,20}$/.test(hint) ? 1 : 0);
  const wabas = [], seen = /* @__PURE__ */ new Set();
  const account = async (id) => {
    if (seen.has(id)) return true;
    const ph = await graph(token, `/${id}/phone_numbers?fields=id,display_phone_number,verified_name&limit=20`).catch((e) => {
      note(e);
      throw e;
    }), tp = await graph(token, `/${id}/message_templates?fields=name,status,category,language&limit=200`).catch(() => ({ data: [] }));
    seen.add(id);
    wabas.push({ id, phones: (ph?.data || []).map((x) => ({ id: String(x.id), number: String(x.display_phone_number || ""), name: String(x.verified_name || "") })), templates: (tp?.data || []).map((x) => ({ name: String(x.name), status: String(x.status || ""), category: String(x.category || ""), language: String(x.language || "") })) });
    return true;
  };
  const lone = [];
  if (!ids.size && !refused) {
    const b = await graph(token, "/me/businesses?fields=id&limit=10").catch((e) => {
      note(e);
      return null;
    });
    for (const x of b?.data || []) if (x?.id) {
      ids.add(String(x.id));
      firms++;
    }
  }
  for (const id of refused ? [] : [...ids].slice(0, 8)) {
    if (await account(id).catch(() => false)) continue;
    let got = false;
    for (const edge of ["owned_whatsapp_business_accounts", "client_whatsapp_business_accounts"]) {
      const r = await graph(token, `/${id}/${edge}?fields=id&limit=5`).catch(() => null);
      for (const w of r?.data || []) if (await account(String(w.id)).catch(() => false)) got = true;
    }
    if (got) continue;
    const one = await graph(token, `/${id}?fields=id,display_phone_number,verified_name`).catch(() => null);
    if (one?.display_phone_number) lone.push({ id: String(one.id || id), number: String(one.display_phone_number), name: String(one.verified_name || "") });
  }
  if (!wabas.length && lone.length) wabas.push({ id: "", phones: lone, templates: [] });
  if (!wabas.length && !why && scopes) {
    const need = ["whatsapp_business_management", "whatsapp_business_messaging"].filter((x) => !scopes.includes(x));
    if (need.length) why = `This token was made without the permission${need.length > 1 ? "s" : ""} ${need.join(" and ")}. In Business settings \u2192 System users, press Generate new token, tick whatsapp_business_management and whatsapp_business_messaging in the list of permissions, and paste the new token here.`;
  }
  if (!wabas.length && !why && hint && /^\d{6,20}$/.test(hint)) why = `Meta would not open ${hint} with this token${said || raw ? `: \u201C${(said || raw).slice(0, 220)}\u201D` : ""}. That usually means the number pasted is not the WhatsApp Business Account ID, or the token was made without whatsapp_business_management. On the app's WhatsApp \u2192 API Setup page (Step 1. Try it out), copy the \u201CWhatsApp Business Account ID\u201D, or paste the \u201CPhone number ID\u201D shown beside it instead: either one works here.`;
  else if (!wabas.length && !why && hint) why = "The ID pasted should be digits only: the WhatsApp Business Account ID, or the Phone number ID, from the app's WhatsApp \u2192 API Setup page.";
  const tail = !wabas.length && !why ? ` (Looked at: ${named} asset${named === 1 ? "" : "s"} named by the token, ${firms} business${firms === 1 ? "" : "es"} it belongs to.${said ? ` Meta said: \u201C${said.slice(0, 200)}\u201D.` : ""})` : "";
  return { wabas, ...wabas.length ? {} : { why: why || "The token works, but Meta didn't show a WhatsApp account for it. Give the system user Full control of your WhatsApp account (Business settings \u2192 System users \u2192 Assign assets \u2192 WhatsApp accounts), generate a new token, and press Connect again. Or paste the WhatsApp Business Account ID, or the Phone number ID, below (both are on the app's WhatsApp \u2192 API Setup page)." + tail } };
}
var WA_TPL = {
  otp: (language) => ({ name: "signin_code", language, category: "authentication", components: [{ type: "body", add_security_recommendation: true }, { type: "footer", code_expiration_minutes: 10 }, { type: "buttons", buttons: [{ type: "otp", otp_type: "copy_code" }] }] }),
  order: (language) => ({ name: "order_alert", language, category: "utility", components: [{ type: "body", text: "New order {{1}} from {{2}}. To pay {{3}}. {{4}}", example: { body_text: [["ORD-1118-1234", "Asha Rao", "Rs 376", "Delivery, today 7:30 pm"]] } }] }),
  enquiry: (language) => ({ name: "enquiry_alert", language, category: "utility", components: [{ type: "body", text: "New enquiry from {{1}} ({{2}}): {{3}}", example: { body_text: [["Asha Rao", "9876543210", "Do you take group bookings on Sunday?"]] } }] })
};
var waReady = (c) => !!(c && c.on && c.token && String(c.phoneId || "").trim());
var smsReady = (z) => !!(z && z.on && z.key && (z.provider === "twilio" ? String(z.sid || "").trim() && String(z.from || "").trim() : z.provider === "mcentral" ? String(z.sid || "").trim() : String(z.tpl || "").trim()));
var smsOwnCode = (z) => z?.provider !== "mcentral";
var MC = "https://cpaas.messagecentral.com";
async function mcToken(z) {
  const q = new URLSearchParams({ customerId: String(z.sid).trim(), key: btoa(String(z.key)), scope: "NEW" });
  if (String(z.email || "").trim()) {
    q.set("email", String(z.email).trim());
    q.set("country", "IN");
  }
  const r = await fetch(`${MC}/auth/v1/authentication/token?${q}`, { headers: { accept: "*/*" } });
  let j = null;
  try {
    j = await r.json();
  } catch {
  }
  if (!r.ok || !j?.token) throw new Error(`Message Central didn't accept the sign-in (${r.status}). Check the Customer ID and password.`);
  return String(j.token);
}
var mcParts = (z, to) => {
  const cc = String(z.cc || "91").replace(/\D/g, "") || "91";
  return to.startsWith(cc) ? { countryCode: cc, mobileNumber: to.slice(cc.length) } : { countryCode: cc, mobileNumber: to };
};
async function mcCheck(z, to, ref, code) {
  const q = new URLSearchParams({ ...mcParts(z, to), verificationId: ref, customerId: String(z.sid).trim(), code });
  const r = await fetch(`${MC}/verification/v3/validateOtp?${q}`, { headers: { accept: "*/*", authToken: await mcToken(z) } });
  let j = null;
  try {
    j = await r.json();
  } catch {
  }
  return r.ok && j?.data?.verificationStatus === "VERIFICATION_COMPLETED";
}
async function smsSend(z, to, code, brand) {
  if (z.provider === "mcentral") {
    const q = new URLSearchParams({ ...mcParts(z, to), customerId: String(z.sid).trim(), flowType: "SMS", otpLength: "6" });
    const r2 = await fetch(`${MC}/verification/v3/send?${q}`, { method: "POST", headers: { accept: "*/*", authToken: await mcToken(z) } });
    let j2 = null;
    try {
      j2 = await r2.json();
    } catch {
    }
    const ref = String(j2?.data?.verificationId ?? "");
    if (!r2.ok || !ref) throw new Error(`Message Central didn't send the code (${r2.status})${j2?.message ? ": " + String(j2.message).slice(0, 200) : ""}`);
    return ref;
  }
  if (z.provider === "sent") {
    const v2 = String(z.varName || "code").trim() || "code", chan = ["sms", "whatsapp", "rcs", "sent"].includes(z.chan) ? z.chan : "sms";
    const r2 = await fetch("https://api.sent.dm/v3/messages", { method: "POST", headers: { "x-api-key": z.key, "Content-Type": "application/json" }, body: JSON.stringify({ to: ["+" + to], template: { id: String(z.tpl).trim(), parameters: { [v2]: code } }, channel: [chan] }) });
    let j2 = null;
    try {
      j2 = await r2.json();
    } catch {
    }
    if (!r2.ok || j2?.success === false) throw new Error(`Sent didn't accept the message (${r2.status})${j2?.error?.message ? ": " + String(j2.error.message).slice(0, 200) : ""}`);
    return;
  }
  if (z.provider === "twilio") {
    const body = (String(z.text || "").trim() || "{code} is your verification code for {site}.").replace(/\{code\}/g, code).replace(/\{site\}/g, brand).slice(0, 300), from = String(z.from).trim();
    const f = new URLSearchParams({ To: "+" + to, Body: body });
    f.set(/^MG[0-9a-f]{32}$/i.test(from) ? "MessagingServiceSid" : "From", from);
    const r2 = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(String(z.sid).trim())}/Messages.json`, { method: "POST", headers: { Authorization: "Basic " + btoa(String(z.sid).trim() + ":" + z.key), "Content-Type": "application/x-www-form-urlencoded" }, body: f.toString() });
    if (!r2.ok) {
      let m = "";
      try {
        m = String((await r2.json())?.message || "");
      } catch {
      }
      throw new Error(`Twilio didn't accept the message (${r2.status})${m ? ": " + m.slice(0, 200) : ""}`);
    }
    return;
  }
  const v = String(z.varName || "var1").trim() || "var1", rec = { mobiles: to, [v]: code, [v.toUpperCase()]: code, [v.toLowerCase()]: code }, tpl = String(z.tpl).trim();
  const r = await fetch("https://control.msg91.com/api/v5/flow/", { method: "POST", headers: { authkey: z.key, "Content-Type": "application/json", accept: "application/json" }, body: JSON.stringify({ template_id: tpl, flow_id: tpl, ...String(z.sender || "").trim() ? { sender: String(z.sender).trim() } : {}, short_url: "0", recipients: [rec] }) });
  let j = null;
  try {
    j = await r.json();
  } catch {
  }
  if (!r.ok || !j || j.type !== "success") throw new Error(`MSG91 didn't accept the message (${r.status})${j?.message ? ": " + String(j.message).slice(0, 200) : ""}`);
}
function msgPolicy(c) {
  const m = c?.cms?.msg || {}, of = (v) => ({ wa: v == null || v === "" || v === "wa" || v === "both", sms: v == null || v === "" || v === "sms" || v === "both" });
  return { login: of(m.login), checkout: of(m.checkout) };
}
async function codeWays(env, site, c) {
  const w = await getSetting(env, "site:" + site, "wa").catch(() => null), z = await getSetting(env, "site:" + site, "sms").catch(() => null);
  const sc = c === void 0 ? await siteContent(env, site).catch(() => null) : c, pol = msgPolicy(sc).checkout;
  const wa = pol.wa && waReady(w) && !!String(w.tplOtp || "").trim(), sms = pol.sms && smsReady(z);
  const asked = !!(isRest(sc) ? sc?.ordering?.verifyPhone : sc?.checkout?.verifyPhone);
  return { w, z, wa, sms, any: wa || sms, need: wa && !!w.orderOtp || sms && !!z.orderOtp || (wa || sms) && asked, cc: String(w?.cc || z?.cc || "91") };
}
var waPhoneOf = (lines, email) => {
  for (const l of String(lines || "").split(/\n/)) {
    const i = l.indexOf("=");
    if (i > 0 && l.slice(0, i).trim().toLowerCase() === email) return l.slice(i + 1).trim();
  }
  return "";
};
async function waAlert(env, site, data) {
  const c = await getSetting(env, "site:" + site, "wa");
  if (!waReady(c)) return "";
  const order = !!data.order_no, tpl = String((order ? c.orderAlert && c.tplOrder : c.enquiryAlert && c.tplEnquiry) || "").trim();
  if (!tpl) return "";
  const to = [...new Set(String(c.to || "").split(/[,;\n]+/).map((x) => waNum(x, c.cc)).filter(Boolean))].slice(0, 3);
  if (!to.length) return "Not sent on WhatsApp: no number to send to.";
  const since = new Date(Date.now() - 36e5).toISOString(), n = await env.DB.prepare("select count(*) n from enquiries where site = ? and created_at > ?").bind(site, since).first();
  if ((n?.n || 0) > 60) return "Not sent on WhatsApp: more than 60 in an hour, so messages are paused.";
  const params = order ? [data.order_no, data.name || "-", data.total || "-", [data.mode, data.when].filter(Boolean).join(", ") || "-"] : [data.name || "-", data.phone || data.email || "-", data.message || [data.type, data.date, data.time, data.guests && data.guests + " guests"].filter(Boolean).join(", ") || "-"];
  try {
    for (const t of to) await waSend(c, t, tpl, params);
    return "Sent on WhatsApp.";
  } catch (e) {
    return "Not sent on WhatsApp: " + String(e?.message || e).slice(0, 240);
  }
}
var rslug = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "item";
var rnum = (p) => {
  const n = parseFloat(String(p ?? "").replace(/[^\d.]/g, ""));
  return isFinite(n) ? n : NaN;
};
var loyOf = (c) => {
  const L = c?.loyalty || {};
  return { on: !!L.on, earn: Math.max(0, +L.earn || 0), worth: Math.max(0, +L.worth || 0), min: Math.max(0, Math.floor(+L.min || 0)), maxPct: Math.max(0, Math.min(100, L.maxPct == null || L.maxPct === "" ? 50 : +L.maxPct || 0)) };
};
function pointsFor(c, want, bal, amount) {
  const L = loyOf(c), ask2 = Math.min(Math.floor(+want || 0), Math.floor(bal || 0));
  if (!L.on || !(L.worth > 0) || ask2 <= 0 || ask2 < L.min || !(amount > 0)) return { points: 0, off: 0 };
  const points = Math.max(0, Math.min(ask2, Math.floor(amount * L.maxPct / 100 / L.worth)));
  return { points, off: Math.round(points * L.worth * 100) / 100 };
}
function restBill(c, q) {
  const o = c?.ordering || {};
  if (!o.on) return { error: "Online ordering is switched off." };
  const mode = String(q?.mode || ""), modes = o.modes || {};
  if (!["delivery", "pickup", "dinein"].includes(mode) || !modes[mode]) return { error: "That way of ordering isn't offered." };
  const dishes = /* @__PURE__ */ new Map();
  for (const k of c?.food?.categories || []) {
    if (!k || !String(k.name || "").trim()) continue;
    for (const d of k.items || []) if (d && String(d.name || "").trim() && !d.noOrder && !d.soldOut) dishes.set(rslug(k.name) + "/" + rslug(d.name), d);
  }
  let sub = 0;
  const units = [];
  const lines = Array.isArray(q?.items) ? q.items.slice(0, 60) : [];
  if (!lines.length) return { error: "The cart is empty." };
  for (const l of lines) {
    const d = dishes.get(String(l?.id || ""));
    if (!d) return { error: "A dish in the cart is no longer on the menu. Refresh the page." };
    const V2 = rchoices(d), qty = Math.max(1, Math.min(50, Math.floor(+l.qty || 0)));
    let unit = V2.length ? Number((V2.find((v) => v.label === String(l.variant)) || { price: NaN }).price) : rnum(d.price);
    if (isNaN(unit)) return { error: "A dish in the cart changed. Refresh the page." };
    const opts = /* @__PURE__ */ new Map();
    for (const g of d.addons || []) for (const s of g && g.options || []) {
      const t = String(s || ""), i = t.lastIndexOf("="), label = (i > 0 ? t.slice(0, i) : t).trim(), pr = i > 0 ? rnum(t.slice(i + 1)) : 0;
      if (label) opts.set(label, isNaN(pr) ? 0 : pr);
    }
    for (const a of Array.isArray(l.addons) ? l.addons.slice(0, 20) : []) {
      if (!opts.has(String(a))) return { error: "An extra in the cart changed. Refresh the page." };
      unit += opts.get(String(a));
    }
    sub += unit * qty;
    units.push(Math.round(unit * 100) / 100);
  }
  const cp = (o.coupons || []).find((x) => x && x.on !== false && +x.value > 0 && String(x.code || "").trim().toUpperCase() === String(q.coupon || "").trim().toUpperCase() && String(q.coupon || "").trim());
  let disc = 0;
  if (cp && sub >= (+cp.min || 0)) disc = Math.min(sub, cp.kind === "flat" ? +cp.value : Math.min(sub * +cp.value / 100, +cp.max > 0 ? +cp.max : Infinity));
  disc = Math.round(disc * 100) / 100;
  const pack = mode === "dinein" ? 0 : Math.max(0, +o.packing || 0);
  let fee = null, okArea = true;
  if (mode === "delivery") {
    const L = String(o.areas || "").split(/\n/).map((x) => x.trim()).filter(Boolean);
    if (L.length) {
      okArea = false;
      const pin = String(q.pin || "").replace(/\D/g, ""), area = String(q.area || "").trim().toLowerCase();
      for (const l of L) {
        const i = l.lastIndexOf("="), key = (i > 0 ? l.slice(0, i) : l).trim().toLowerCase(), f = i > 0 ? rnum(l.slice(i + 1)) : NaN;
        if (!key) continue;
        if (/^\d{4,}$/.test(key) ? key === pin : !!area && (area.includes(key) || key.includes(area))) {
          okArea = true;
          fee = isNaN(f) ? null : f;
          break;
        }
      }
    }
  }
  if (!okArea) return { error: "We don't deliver to that address." };
  const free = +o.freeAbove > 0 && sub - disc >= +o.freeAbove, del = mode !== "delivery" ? 0 : free ? 0 : Math.max(0, fee != null ? fee : +o.deliveryFee || 0);
  const pt = pointsFor(c, q.points, +q._bal || 0, sub - disc);
  const base = sub - disc - pt.off + pack, pct = Math.max(0, +o.taxPercent || 0), tax = o.taxIncluded || !pct ? 0 : Math.round(base * pct) / 100;
  const tip = o.tips !== false && mode !== "pickup" ? Math.max(0, Math.min(5e3, +q.tip || 0)) : 0;
  const raw = base + tax + del + tip, total = o.roundOff === false ? Math.round(raw * 100) / 100 : Math.round(raw);
  if (mode !== "dinein" && sub < Math.max(0, +o.minOrder || 0)) return { error: "The order is below the minimum." };
  const r2 = (n) => Math.round(n * 100) / 100;
  return { total, points: pt.points, pointsOff: pt.off, net: Math.round((sub - disc - pt.off) * 100) / 100, units, parts: { sub: r2(sub), disc: r2(disc + pt.off), pack: r2(pack), del: r2(del), tax: r2(tax), pct, tip: r2(tip), incl: !!o.taxIncluded } };
}
var POS_URL = "https://pponlineordercb.petpooja.com/save_order";
var posReady = (z) => !!(z && z.on && z.secret && z.token && z.appKey && z.restId);
function posItems(c, q) {
  const dishes = /* @__PURE__ */ new Map();
  for (const k of c?.food?.categories || []) {
    if (!k || !String(k.name || "").trim()) continue;
    for (const d of k.items || []) if (d && String(d.name || "").trim()) dishes.set(rslug(k.name) + "/" + rslug(d.name), d);
  }
  const items = [];
  let sub = 0;
  for (const l of Array.isArray(q?.items) ? q.items.slice(0, 60) : []) {
    const d = dishes.get(String(l?.id || ""));
    if (!d) return { error: "a dish that is no longer on the menu" };
    const V2 = rchoices(d), v = V2.length ? V2.find((x) => x.label === String(l.variant)) : null, qty = Math.max(1, Math.min(50, Math.floor(+l.qty || 0)));
    if (V2.length && !v) return { error: `a size or variety of \u201C${String(d.name).slice(0, 60)}\u201D that is no longer on the menu` };
    const id = String(d.posId || "").trim(), vid = v ? String(v.posId || "").trim() : "";
    if (!id) return { error: `\u201C${String(d.name).slice(0, 60)}\u201D has no Petpooja item ID` };
    let unit = v ? rnum(v.price) : rnum(d.price);
    if (isNaN(unit)) return { error: "a dish whose price changed" };
    const opts = /* @__PURE__ */ new Map();
    for (const g of d.addons || []) for (const o of g && g.options || []) {
      const t = String(o || ""), i = t.lastIndexOf("="), label = (i > 0 ? t.slice(0, i) : t).trim(), pr = i > 0 ? rnum(t.slice(i + 1)) : 0;
      if (label) opts.set(label, isNaN(pr) ? 0 : pr);
    }
    const extras = (Array.isArray(l.addons) ? l.addons.slice(0, 20) : []).map(String).filter((a) => opts.has(a));
    for (const a of extras) unit += opts.get(a);
    sub += unit * qty;
    items.push({ id, name: String(d.name).slice(0, 120), gst_liability: "restaurant", item_tax: [], item_discount: "", price: unit.toFixed(2), final_price: unit.toFixed(2), quantity: String(qty), description: extras.length ? "Extras: " + extras.join(", ") : "", variation_name: v ? String(v.label) : "", variation_id: vid, AddonItem: { details: [] } });
  }
  return items.length ? { items, sub } : { error: "an empty cart" };
}
function orderItems(c, cart) {
  const out = [], lines = Array.isArray(cart?.items) ? cart.items.slice(0, 40) : [], pic = (v) => typeof v?.path === "string" && !/^[a-z]+:|^\/\//i.test(v.path) ? v.path.slice(0, 200) : "";
  if (isRest(c)) {
    const dishes = /* @__PURE__ */ new Map();
    for (const k of c?.food?.categories || []) for (const d of k?.items || []) if (d && String(d.name || "").trim()) dishes.set(rslug(k.name) + "/" + rslug(d.name), d);
    for (const l of lines) {
      const d = dishes.get(String(l?.id || ""));
      if (d) out.push({ n: (oneLine(String(d.name)) + (l.variant ? " \xB7 " + oneLine(String(l.variant)) : "")).slice(0, 90), q: Math.max(1, Math.floor(+l.qty || 1)), i: pic(d.image) });
    }
  } else {
    const P = new Map((Array.isArray(c?.products) ? c.products : []).filter((x) => x && x.id).map((x) => [String(x.id), x]));
    for (const l of lines) {
      const p = P.get(String(l?.id || ""));
      if (p) out.push({ n: (oneLine(String(p.name)) + (l.opt ? " \xB7 " + oneLine(String(l.opt)) : "")).slice(0, 90), q: Math.max(1, Math.floor(+l.qty || 1)), i: pic(Array.isArray(p.images) ? p.images[0] : null) });
    }
  }
  return out;
}
var invOn = (c) => !!c?.inventory?.on;
var stockKey = (id, opt) => {
  const a = String(id || "").trim().slice(0, 130), b = oneLine(String(opt || "")).toLowerCase().slice(0, 60);
  return b ? a + "|" + b : a;
};
function stockItems(c) {
  const out = [];
  if (isRest(c)) {
    for (const k of c?.food?.categories || []) for (const d of k?.items || []) {
      if (!d || !String(d.name || "").trim()) continue;
      const id = rslug(k.name) + "/" + rslug(d.name), nm = oneLine(String(d.name)).slice(0, 90);
      out.push({ item: id, name: nm, group: oneLine(String(k.name || "")).slice(0, 60), opt: false });
      for (const v of Array.isArray(d.variants) ? d.variants : []) if (v && String(v.label || "").trim()) out.push({ item: stockKey(id, v.label), name: nm + " \xB7 " + oneLine(String(v.label)).slice(0, 40), group: "", opt: true });
    }
  } else {
    const cats = new Map((Array.isArray(c?.categories) ? c.categories : []).map((x) => [String(x?.id || ""), oneLine(String(x?.name || ""))]));
    for (const p of Array.isArray(c?.products) ? c.products : []) {
      if (!p || !p.id) continue;
      const nm = oneLine(String(p.name || "")).slice(0, 90);
      out.push({ item: String(p.id), name: nm, group: cats.get(String(p.category || "")) || "", opt: false });
      for (const o of [...p.kindsOn && Array.isArray(p.kinds) ? p.kinds : [], ...Array.isArray(p.options) ? p.options : []]) {
        const l = oneLine(String(typeof o === "string" ? o : o?.label || o?.name || ""));
        if (l) out.push({ item: stockKey(p.id, l), name: nm + " \xB7 " + l.slice(0, 40), group: "", opt: true });
      }
    }
  }
  return out.slice(0, 1500);
}
async function stockNeed(env, site, c, cart) {
  await ensure(env);
  const lines = (Array.isArray(cart?.items) ? cart.items.slice(0, 40) : []).map((l) => ({ base: stockKey(l?.id), own: [String(l?.opt || l?.variant || ""), ...String(l?.opt || "").split(" \xB7 ")].filter((x, i, a) => x.trim() && a.indexOf(x) === i).map((x) => stockKey(l?.id, x)), q: Math.max(1, Math.min(999, Math.floor(+l?.qty || 1))) })).filter((l) => l.base);
  const need = /* @__PURE__ */ new Map(), rows = /* @__PURE__ */ new Map();
  if (!lines.length) return { need, rows };
  const keys = [...new Set(lines.flatMap((l) => [l.base, ...l.own]))];
  for (const r of (await env.DB.prepare(`select item, qty, low from stock where site = ? and item in (${keys.map(() => "?").join(",")})`).bind(site, ...keys).all()).results || []) rows.set(String(r.item), { qty: +r.qty || 0, low: +r.low || 0 });
  const names = new Map(stockItems(c).map((x) => [x.item, x.name]));
  for (const l of lines) {
    const k = l.own.find((x) => rows.has(x)) || (rows.has(l.base) ? l.base : "");
    if (!k) continue;
    const had = need.get(k);
    need.set(k, { q: (had?.q || 0) + l.q, name: names.get(k) || names.get(l.base) || "that item" });
  }
  return { need, rows };
}
var stockSorry = (name, left) => left > 0 ? `Sorry, only ${left} left of ${name}. Change the quantity in your cart and try again.` : `Sorry, ${name} has just sold out. Remove it from your cart to go on.`;
async function stockCheck(env, site, c, cart) {
  const { need, rows } = await stockNeed(env, site, c, cart);
  for (const [k, n] of need) {
    const left = rows.get(k).qty;
    if (left < n.q) return stockSorry(n.name, Math.max(0, left));
  }
  return "";
}
async function stockTake(env, site, c, cart, ref, force = false) {
  const { need, rows } = await stockNeed(env, site, c, cart), now = (/* @__PURE__ */ new Date()).toISOString(), taken = [], low = [];
  let short = "";
  for (const [k, n] of need) {
    const r = await env.DB.prepare("update stock set qty = qty - ?, updated_at = ? where site = ? and item = ? and qty >= ?").bind(n.q, now, site, k, n.q).run();
    if (r?.meta?.changes) {
      taken.push([k, n.q]);
      continue;
    }
    const left = Math.max(0, +(await env.DB.prepare("select qty from stock where site = ? and item = ?").bind(site, k).first())?.qty || 0);
    short = short || stockSorry(n.name, left);
    if (!force) {
      await stockBack(env, site, taken, ref, "Order not placed");
      return { taken: [], short, low: [] };
    }
    if (left > 0) {
      await env.DB.prepare("update stock set qty = 0, updated_at = ? where site = ? and item = ?").bind(now, site, k).run();
      taken.push([k, left]);
    }
  }
  if (!taken.length) return { taken, short, low };
  const after = /* @__PURE__ */ new Map();
  for (const r of (await env.DB.prepare(`select item, qty from stock where site = ? and item in (${taken.map(() => "?").join(",")})`).bind(site, ...taken.map((t) => t[0])).all()).results || []) after.set(String(r.item), +r.qty || 0);
  await env.DB.batch(taken.map(([k, q]) => env.DB.prepare("insert into stock_log (site, item, delta, qty, why, ref, at) values (?, ?, ?, ?, 'Order', ?, ?)").bind(site, k, -q, after.get(k) ?? 0, ref.slice(0, 40), now)));
  for (const [k, q] of taken) {
    const a = after.get(k) ?? 0, lw = rows.get(k)?.low || 0;
    if (a <= lw && a + q > lw || a === 0 && q > 0) low.push({ name: need.get(k).name, qty: a });
  }
  return { taken, short, low };
}
async function stockBack(env, site, taken, ref, why) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  for (const [k, q] of taken) {
    if (!(q > 0)) continue;
    const r = await env.DB.prepare("update stock set qty = qty + ?, updated_at = ? where site = ? and item = ? returning qty").bind(q, now, site, k).first();
    if (r) await env.DB.prepare("insert into stock_log (site, item, delta, qty, why, ref, at) values (?, ?, ?, ?, ?, ?, ?)").bind(site, k, q, +r.qty || 0, why.slice(0, 60), ref.slice(0, 40), now).run();
  }
}
async function stockLowMail(env, site, c, low) {
  env = await siteMail(env, site);
  if (!low.length || c?.inventory?.alert === false || !env.RESEND_API_KEY || !env.MAIL_FROM) return;
  const addrs = (v) => String(v || "").split(/[,;\s]+/).map((x) => x.trim()).filter((x) => EMAIL_RE.test(x)).slice(0, 5);
  let to = addrs(c?.inventory?.alertTo);
  if (!to.length) to = addrs(c?.contact?.form?.notifyTo);
  if (!to.length) to = addrs(c?.contact?.email);
  if (!to.length) to = addrs(((await env.DB.prepare("select email from members where scope = ? order by role = 'owner' desc limit 3").bind("site:" + site).all()).results || []).map((r) => r.email).join(","));
  if (!to.length) return;
  const out = low.filter((x) => x.qty <= 0), few = low.filter((x) => x.qty > 0);
  await sendMail(env, to, `${out.length ? "Sold out: " + out.map((x) => x.name).join(", ") : "Running low: " + few.map((x) => x.name).join(", ")}`.slice(0, 150), WRAP(`<h2 style="margin:0 0 12px;font-size:20px">Stock at ${hesc(siteName(c, site))}</h2>${out.length ? paras("Sold out:\n" + out.map((x) => "\u2022 " + x.name).join("\n")) : ""}${few.length ? paras("Running low:\n" + few.map((x) => `\u2022 ${x.name}: ${x.qty} left`).join("\n")) : ""}${paras("Add stock under Inventory in your site's admin page.", "margin:0 0 8px;color:#667;font-size:13px")}`));
}
var recOn = (c) => !!c?.recovery?.on;
var recKey = (email) => email.trim().toLowerCase();
var recMoney = (c, n) => {
  const cur = siteCur(c);
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: cur, maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
  } catch {
    return cur + " " + n;
  }
};
var recTok = () => {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return [...a].map((x) => x.toString(16).padStart(2, "0")).join("");
};
async function recSend(env, site, c, row, origin) {
  env = await siteMail(env, site);
  const R = c?.recovery || {}, shop = siteName(c, site), items = (() => {
    try {
      return JSON.parse(row.items);
    } catch {
      return [];
    }
  })();
  const base = String(R.url || "").trim().replace(/[?#].*$/, ""), back = /^https:\/\//.test(base) ? base : String(row.back || "");
  if (!/^https:\/\//.test(back)) throw new Error("No shop address to link to.");
  const link = back + "?rc=" + row.tok, stop = origin + "/cart/" + site + "/" + row.tok + "/stop";
  const list = items.slice(0, 12).map((x) => `\u2022 ${x.n}${x.q > 1 ? " \xD7 " + x.q : ""}`).join("\n") + (items.length > 12 ? `
\u2022 and ${items.length - 12} more` : "");
  const vars = { name: oneLine(row.name).split(" ")[0] || "there", items: list, total: recMoney(c, +row.total || 0), shop, offer: oneLine(String(R.offer || "")) };
  const subject = oneLine(fill(String(R.subject || "You left something in your cart at {shop}"), vars)).slice(0, 150);
  const text = fill(String(R.body || "Hi {name},\n\nYou left these in your cart at {shop}:\n\n{items}\n\nTotal: {total}\n\n{offer}"), vars).replace(/\n{3,}/g, "\n\n");
  const html = WRAP(`${paras(text)}<p style="margin:18px 0"><a href="${hesc(link)}" style="background:#111;color:#fff;padding:11px 20px;border-radius:8px;text-decoration:none;display:inline-block">${hesc(String(R.button || "Back to my cart"))}</a></p><p style="margin:0;color:#889;font-size:12px">Don't want these reminders? <a href="${hesc(stop)}" style="color:#889">Stop them</a>.</p>`);
  await sendMail(env, row.email, subject, html, void 0);
}
var recLast = 0;
async function recSweep(env, origin, force = false) {
  const now = Date.now();
  if (!force && now - recLast < (env.REC_GAP ?? 24e4)) return 0;
  recLast = now;
  if (!env.RESEND_API_KEY || !env.MAIL_FROM) return 0;
  const rows = (await env.DB.prepare("select * from carts where status = 'open' and sent < 2 and email != '' and updated_at < ? and updated_at > ? order by updated_at limit 60").bind(new Date(now - 18e5).toISOString(), new Date(now - 7 * 864e5).toISOString()).all()).results || [];
  const cache = /* @__PURE__ */ new Map(), day2 = /* @__PURE__ */ new Map();
  let sent = 0;
  for (const r of rows) {
    if (sent >= 20) break;
    if (!cache.has(r.site)) cache.set(r.site, await siteContent(env, r.site).catch(() => null));
    const c = cache.get(r.site), R = c?.recovery;
    if (!recOn(c) || R.auto === false) continue;
    const after = Math.max(0.5, Math.min(72, +R.after || 1)) * 36e5, again = R.again === 0 || R.again === "0" ? 0 : Math.max(2, Math.min(240, +R.again || 24)) * 36e5;
    const last = Date.parse(r.sent ? r.sent_at : r.updated_at) || 0;
    if (now - last < (r.sent ? again : after) || r.sent && !again) continue;
    if (!day2.has(r.site)) day2.set(r.site, +((await env.DB.prepare("select count(*) n from carts where site = ? and sent_at > ?").bind(r.site, new Date(now - 864e5).toISOString()).first())?.n || 0));
    if ((day2.get(r.site) || 0) >= 50) continue;
    try {
      await recSend(env, r.site, c, r, origin);
    } catch {
      await env.DB.prepare("update carts set sent = 2, sent_at = ? where site = ? and ckey = ?").bind((/* @__PURE__ */ new Date()).toISOString(), r.site, r.ckey).run();
      continue;
    }
    await env.DB.prepare("update carts set sent = sent + 1, sent_at = ? where site = ? and ckey = ?").bind((/* @__PURE__ */ new Date()).toISOString(), r.site, r.ckey).run();
    day2.set(r.site, (day2.get(r.site) || 0) + 1);
    sent++;
  }
  if (Math.random() < 0.02) await env.DB.prepare("delete from carts where updated_at < ?").bind(new Date(now - 45 * 864e5).toISOString()).run().catch(() => {
  });
  return sent;
}
var revOn = (c) => !!c?.reviews?.on;
var revName = (n) => {
  const w = oneLine(n).split(" ").filter(Boolean);
  return w.length > 1 ? w[0] + " " + w[w.length - 1][0].toUpperCase() + "." : w[0] || "Customer";
};
var revShown = (r) => ({ id: r.id, name: revName(r.name), rating: r.rating, title: r.title, body: r.body, verified: !!r.verified, reply: r.reply || "", at: String(r.created_at).slice(0, 10) });
async function ownerTo(env, site, c, pref) {
  const addrs = (v) => String(v || "").split(/[,;\s]+/).map((x) => x.trim()).filter((x) => EMAIL_RE.test(x)).slice(0, 5);
  let to = addrs(pref);
  if (!to.length) to = addrs(c?.contact?.form?.notifyTo);
  if (!to.length) to = addrs(c?.contact?.email);
  if (!to.length) to = addrs(((await env.DB.prepare("select email from members where scope = ? order by role = 'owner' desc limit 3").bind("site:" + site).all()).results || []).map((r) => r.email).join(","));
  return to;
}
var cleanDob = (v) => /^(19|20)\d\d-\d\d-\d\d$/.test(String(v ?? "")) ? String(v) : "";
var cleanGender = (v) => ["female", "male", "other"].includes(String(v ?? "")) ? String(v) : "";
var cleanAddr = (a) => {
  const t = (v, n = 120) => oneLine(String(v ?? "")).replace(/\s+/g, " ").slice(0, n);
  return { label: t(a?.label, 30), line1: t(a?.line1), line2: t(a?.line2), city: t(a?.city, 60), pin: t(a?.pin, 12), state: t(a?.state, 60) };
};
var CUST_DAYS = 30;
var custPass = async (env, site, key, exp) => exp + "." + b64u(await hmac(env.SECRET, "cust:" + site + ":" + key + ":" + exp));
async function custOk(env, site, key, pass) {
  const [exp, sig] = String(pass || "").split(".");
  return !!key && +exp > Date.now() && sig === b64u(await hmac(env.SECRET, "cust:" + site + ":" + key + ":" + exp));
}
function acctOf(env, c, cw) {
  const a = c?.account;
  if (!a?.on) return null;
  const by = a.by === "email" || a.by === "either" ? a.by : "phone", via = [cw.wa ? "wa" : "", cw.sms ? "sms" : ""].filter(Boolean);
  const phone = by === "email" ? [] : via, email = by !== "phone" && !!(env.RESEND_API_KEY && env.MAIL_FROM);
  return phone.length || email ? { by, phone, email } : null;
}
async function custWho(env, site, A, cc, phone, email, pass) {
  if (!A || !pass) return { key: "", kind: "" };
  const pk = A.phone.length ? waNum(phone, cc) : "", ek = A.email ? emailKey(email) : "";
  if (pk && await custOk(env, site, pk, pass)) return { key: pk, kind: "phone" };
  if (ek && await custOk(env, site, ek, pass)) return { key: ek, kind: "email" };
  return { key: "", kind: "" };
}
async function pointsBal(env, site, phone, token, more) {
  if (more?.acct) {
    const sc = await siteContent(env, site).catch(() => null), cw = await codeWays(env, site, sc), who2 = await custWho(env, site, acctOf(env, sc, cw), cw.cc, phone, more.email, more.acct);
    if (who2.key) {
      const r2 = await env.DB.prepare("select points from customers where site = ? and ckey = ?").bind(site, who2.key).first();
      return { key: who2.key, bal: Math.max(0, +r2?.points || 0), ok: true };
    }
  }
  const cc = (await getSetting(env, "site:" + site, "wa").catch(() => null))?.cc || (await getSetting(env, "site:" + site, "sms").catch(() => null))?.cc, num = waNum(phone, cc), [exp, sig] = String(token || "").split(".");
  if (!num || !(+exp > Date.now()) || sig !== b64u(await hmac(env.SECRET, "otp:" + site + ":" + num + ":" + exp))) return { key: num, bal: 0, ok: false };
  const r = await env.DB.prepare("select points from customers where site = ? and ckey = ?").bind(site, num).first();
  return { key: num, bal: Math.max(0, +r?.points || 0), ok: true };
}
async function custOrder(env, site, c, data, cart, who2 = "") {
  const w = { cc: (await getSetting(env, "site:" + site, "wa").catch(() => null))?.cc || (await getSetting(env, "site:" + site, "sms").catch(() => null))?.cc };
  const key = who2 || waNum(data.phone, w?.cc) || String(data.email || "").trim().toLowerCase().slice(0, 120);
  if (!key) return "";
  if (await env.DB.prepare("select 1 from points where site = ? and order_no = ? limit 1").bind(site, data.order_no).first()) return "";
  const L = loyOf(c), verified = data._phone || who2 ? 1 : 0, now = (/* @__PURE__ */ new Date()).toISOString();
  let net = NaN, used = 0, off = 0;
  if (cart && typeof cart === "object") {
    if (isRest(c)) {
      const bal = verified ? Math.max(0, +(await env.DB.prepare("select points from customers where site = ? and ckey = ?").bind(site, key).first())?.points || 0) : 0;
      const b = restBill(c, { ...cart, _bal: bal });
      if (!("error" in b)) {
        net = b.net ?? b.total;
        used = b.points || 0;
        off = b.pointsOff || 0;
      }
    } else if (Array.isArray(c?.products)) {
      const bal = verified ? Math.max(0, +(await env.DB.prepare("select points from customers where site = ? and ckey = ?").bind(site, key).first())?.points || 0) : 0;
      const b = shopBill(c, { ...cart, _bal: bal });
      if (!("error" in b)) {
        net = b.net ?? b.total;
        used = b.points || 0;
        off = b.pointsOff || 0;
      }
    }
  }
  if (isNaN(net)) net = rnum(data.total);
  const spent = isNaN(net) ? 0 : net, earned = L.on && L.earn > 0 ? Math.floor(spent / 100 * L.earn) : 0;
  await env.DB.prepare("insert into customers (site, ckey, name, phone, email, verified, orders, spent, points, first_at, last_at) values (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?) on conflict (site, ckey) do update set name = case when excluded.name <> '' then excluded.name else name end, phone = case when excluded.phone <> '' then excluded.phone else phone end, email = case when excluded.email <> '' then excluded.email else email end, verified = max(verified, excluded.verified), orders = orders + 1, spent = spent + excluded.spent, points = max(0, points + excluded.points), last_at = excluded.last_at").bind(site, key, oneLine(String(data.name || "")).slice(0, 100), String(data.phone || "").slice(0, 24), String(data.email || "").trim().slice(0, 120), verified, spent, earned - used, now, now).run();
  const st = [];
  if (used) st.push(env.DB.prepare("insert into points (site, ckey, delta, why, order_no, at) values (?, ?, ?, ?, ?, ?)").bind(site, key, -used, "Spent on an order", data.order_no, now));
  st.push(env.DB.prepare("insert into points (site, ckey, delta, why, order_no, at) values (?, ?, ?, ?, ?, ?)").bind(site, key, earned, "Earned on an order", data.order_no, now));
  await env.DB.batch(st);
  const cur = siteCur(c);
  return L.on ? [used ? `Spent ${used} point${used === 1 ? "" : "s"} (${pgMoney(cur, Math.round(off * 100))} off)` : "", earned ? `Earned ${earned} point${earned === 1 ? "" : "s"}` : ""].filter(Boolean).join(". ") : "";
}
async function posSend(env, site, z, c, q, data, origin) {
  const it = posItems(c, q);
  if ("error" in it) return "Not sent to Petpooja: " + it.error + ".";
  const bill = restBill(c, q);
  if ("error" in bill) return "Not sent to Petpooja: " + bill.error;
  const o = c.ordering || {}, mode = String(q.mode), now = new Date(Date.now() + 330 * 6e4).toISOString().replace("T", " ").slice(0, 19);
  const cp = (o.coupons || []).find((x) => x && x.on !== false && +x.value > 0 && String(x.code || "").trim().toUpperCase() === String(q.coupon || "").trim().toUpperCase() && String(q.coupon || "").trim());
  let disc = 0;
  if (cp && it.sub >= (+cp.min || 0)) disc = Math.min(it.sub, cp.kind === "flat" ? +cp.value : Math.min(it.sub * +cp.value / 100, +cp.max > 0 ? +cp.max : Infinity));
  disc = Math.round(disc * 100) / 100;
  disc = Math.round((disc + (bill.pointsOff || 0)) * 100) / 100;
  const pack = mode === "dinein" ? 0 : Math.max(0, +o.packing || 0), pct = Math.max(0, +o.taxPercent || 0), tax = o.taxIncluded || !pct ? 0 : Math.round((it.sub - disc + pack) * pct) / 100;
  const tip = o.tips !== false && mode !== "pickup" ? Math.max(0, Math.min(5e3, +q.tip || 0)) : 0, del = Math.max(0, Math.round((bill.total - (it.sub - disc + pack + tax + tip)) * 100) / 100);
  const paid = data._paid === "yes", key = b64u(await hmac(env.SECRET, "pos:" + site)).slice(0, 32);
  const body = { app_key: z.appKey, app_secret: z.secret, access_token: z.token, orderinfo: { OrderInfo: {
    Restaurant: { details: { res_name: siteName(c, site), address: oneLine(String(c?.contact?.address || "")).slice(0, 300), contact_information: String(c?.contact?.phone || "").slice(0, 40), restID: z.restId } },
    Customer: { details: { email: String(data.email || ""), name: String(data.name || "Guest").slice(0, 100), address: String(data.address || "").slice(0, 400), phone: String(data.phone || "").replace(/[^\d+]/g, "").slice(0, 16), latitude: "", longitude: "" } },
    Order: { details: {
      orderID: data.order_no,
      preorder_date: now.slice(0, 10),
      preorder_time: now.slice(11),
      service_charge: "0",
      sc_tax_amount: "0",
      delivery_charges: String(del),
      dc_tax_amount: "0",
      dc_gst_details: [],
      packing_charges: String(pack),
      pc_tax_amount: "0",
      pc_gst_details: [],
      order_type: mode === "delivery" ? "H" : mode === "pickup" ? "P" : "D",
      ondc_bap: "",
      advanced_order: "N",
      urgent_order: false,
      urgent_time: 20,
      payment_type: paid ? "ONLINE" : "COD",
      table_no: String(data.table || ""),
      no_of_persons: "0",
      discount_total: String(disc),
      tax_total: String(tax),
      discount_type: "F",
      total: String(bill.total),
      description: oneLine(String(data.notes || "")).slice(0, 300) + (tip ? ` (tip ${tip})` : ""),
      created_on: now,
      enable_delivery: 1,
      min_prep_time: Math.max(0, Math.round(+o.prepMinutes || 20)),
      callback_url: origin + "/hook/pos/" + site + "?k=" + key,
      collect_cash: paid ? "0" : String(bill.total),
      otp: ""
    } },
    OrderItem: { details: it.items },
    Tax: { details: tax ? [{ id: String(o.posTaxId || ""), title: "GST", type: "P", price: String(pct), tax: String(tax), restaurant_liable_amt: String(tax) }] : [] },
    Discount: { details: disc ? [{ id: "", title: cp ? String(cp.code) : "Discount", type: "F", price: String(disc) }] : [] }
  }, udid: "", device_type: "Web" } };
  try {
    const u = /^https:\/\/[\w.-]+\.petpooja\.com\//.test(String(z.url || "")) ? String(z.url) : POS_URL;
    const r = await fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), j = await r.json().catch(() => null);
    if (r.ok && j && String(j.success) === "1") return "Sent to Petpooja" + (j.orderID ? " (its order " + String(j.orderID).slice(0, 40) + ")" : "") + ".";
    return "Not sent to Petpooja: " + oneLine(String(j && (j.message || j.error) || "it answered " + r.status)).slice(0, 200);
  } catch {
    return "Not sent to Petpooja: it couldn't be reached.";
  }
}
var POS_STATUS = { "-1": "cancelled", "1": "accepted", "2": "accepted", "3": "accepted", "4": "out", "5": "ready", "10": "done" };
function rchoices(d) {
  const ok = (v) => v && String(v.label || "").trim() && !isNaN(rnum(v.price));
  const S2 = (d.variants || []).filter(ok), K = d.kindsOn ? (Array.isArray(d.kinds) ? d.kinds : []).filter(ok) : [];
  if (!K.length) return (d.variants || []).filter((v) => v && v.label && !isNaN(rnum(v.price))).map((v) => ({ label: String(v.label), price: rnum(v.price), posId: String(v.posId || "").trim() }));
  const s0 = S2.length ? rnum(S2[0].price) : 0, t = (v) => String(v.label).trim();
  return S2.length ? K.flatMap((k) => S2.map((v) => ({ label: t(k) + " \xB7 " + t(v), price: rnum(k.price) + rnum(v.price) - s0, posId: String(k.posId || v.posId || "").trim() }))) : K.map((k) => ({ label: t(k), price: rnum(k.price), posId: String(k.posId || "").trim() }));
}
function kindPrice(p, opt) {
  const K = p?.kindsOn ? (Array.isArray(p.kinds) ? p.kinds : []).filter((k2) => k2 && String(k2.label || "").trim() && isFinite(Number(k2.price)) && Number(k2.price) >= 0) : [];
  if (!K.length) return Number(p?.price);
  const first = String(opt ?? "").split(" \xB7 ")[0].trim(), k = K.find((x) => String(x.label).trim() === first);
  return k ? Number(k.price) : NaN;
}
function shopBill(c, q) {
  const S2 = c?.settings || {}, P = new Map((Array.isArray(c?.products) ? c.products : []).filter((p) => p && p.id).map((p) => [String(p.id), p]));
  const lines = Array.isArray(q?.items) ? q.items.slice(0, 100) : [];
  if (!lines.length) return { error: "The cart is empty." };
  const max = Math.max(1, Number(S2.maxQty) || 10);
  let sub = 0;
  for (const l of lines) {
    const p = P.get(String(l?.id || "")), price = kindPrice(p, l?.opt);
    if (!p || p.stock === "out" || !isFinite(price) || price < 0) return { error: "Something in the cart is no longer sold. Refresh the page." };
    sub += price * Math.max(1, Math.min(max, Math.floor(+l.qty || 0)));
  }
  const H = c?.shipping || {}, num = (v) => v === "" || v == null || isNaN(Number(v)) ? null : Math.max(0, Number(v));
  const pin = String(q?.pin || "").replace(/\D/g, "");
  let fee = null, freeOver = null;
  if (H.on && pin.length >= 4) {
    const hit = (list) => String(list || "").split(/[\s,;]+/).filter(Boolean).some((t) => {
      const r = /^(\d{4,6})-(\d{4,6})$/.exec(t);
      if (r) return pin.length === r[1].length && +pin >= +r[1] && +pin <= +r[2];
      return /^\d{2,6}$/.test(t) && (t.length === pin.length ? t === pin : pin.startsWith(t));
    });
    const z = (Array.isArray(H.zones) ? H.zones : []).find((x) => x && x.on !== false && hit(x.pins));
    if (z) {
      fee = num(z.fee);
      freeOver = num(z.freeOver);
    } else if (H.rest === "no") return { error: "We don't deliver to that PIN code." };
    else fee = num(H.restFee);
  }
  const over = freeOver != null ? freeOver : Number(S2.freeShippingOver), free = over > 0 && sub >= over;
  const pt = pointsFor(c, q.points, +q._bal || 0, sub);
  const ship = free ? 0 : fee != null ? fee : Number(S2.shippingFee) || 0, pct = Number(S2.taxPercent) || 0, taxAdd = pct && !S2.taxIncluded ? Math.round((sub - pt.off) * pct) / 100 : 0;
  return { total: Math.round((sub - pt.off + ship + taxAdd) * 100) / 100, points: pt.points, pointsOff: pt.off, net: Math.round((sub - pt.off) * 100) / 100 };
}
var PG = { rz: { name: "Razorpay", key: "razorpay", inr: true }, cf: { name: "Cashfree", key: "cashfree", inr: true }, pe: { name: "PhonePe", key: "phonepe", inr: true }, st: { name: "Stripe", key: "stripe" }, pp: { name: "PayPal", key: "paypal" } };
var PG_CUR = ["INR", "USD", "EUR", "GBP", "AUD", "CAD", "SGD", "AED", "NZD", "CHF"];
var pgReady = (g, z) => !!z && !!(g === "rz" ? z.on && z.secret && z.keyId : g === "cf" ? z.secret && z.appId : g === "pe" ? z.secret && z.clientId : g === "st" ? z.secret : g === "pp" ? z.secret && z.clientId : false);
var isRest = (c) => !!(c?.ordering && c?.food);
var emailCheckOn = (env, c) => !!(env.RESEND_API_KEY && env.MAIL_FROM) && !!(isRest(c) ? c?.ordering?.verifyEmail : c?.checkout?.verifyEmail);
var emailKey = (v) => {
  const e = String(v || "").trim().toLowerCase().slice(0, 120);
  return EMAIL_RE.test(e) ? e : "";
};
var pgOn = (c, g) => !!(isRest(c) ? c.ordering?.pay?.[PG[g].key] : c?.payments?.[PG[g].key]?.enabled);
function siteCur(c) {
  if (isRest(c)) {
    const s = String(c.food.currency || "\u20B9").trim();
    return { "\u20B9": "INR", Rs: "INR", "Rs.": "INR", $: "USD", "\u20AC": "EUR", "\xA3": "GBP" }[s] || (/^[A-Z]{3}$/.test(s) ? s : "");
  }
  return String(c?.settings?.currency || "").toUpperCase();
}
var pgMoney = (cur, minor) => (cur === "INR" ? "\u20B9" : cur + " ") + (minor / 100).toFixed(2).replace(/\.00$/, "");
var PgError = class extends Error {
  constructor(m, keys = false) {
    super(m);
    this.keys = keys;
  }
};
var pgFail = (g, r) => new PgError(r.status === 401 || r.status === 403 ? `${PG[g].name} refused this site's keys. The owner needs to check them.` : `${PG[g].name} couldn't start the payment just now. Please try again, or choose another way to pay.`, r.status === 401 || r.status === 403);
var cfHost = (z) => z.test ? "https://sandbox.cashfree.com" : "https://api.cashfree.com";
var cfHead = (z) => ({ "x-client-id": z.appId, "x-client-secret": z.secret, "x-api-version": "2023-08-01", "Content-Type": "application/json", Accept: "application/json" });
var peHost = (z) => z.test ? "https://api-preprod.phonepe.com/apis/pg-sandbox" : "https://api.phonepe.com/apis/pg";
async function peToken(z) {
  const r = await fetch(z.test ? "https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token" : "https://api.phonepe.com/apis/identity-manager/v1/oauth/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: z.clientId, client_version: String(z.version || "1"), client_secret: z.secret, grant_type: "client_credentials" }).toString() });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.access_token) throw pgFail("pe", r.ok ? new Response(null, { status: 401 }) : r);
  return String(j.access_token);
}
var ppHost = (z) => z.test ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
async function ppToken(z) {
  const r = await fetch(ppHost(z) + "/v1/oauth2/token", { method: "POST", headers: { Authorization: "Basic " + btoa(z.clientId + ":" + z.secret), "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.access_token) throw pgFail("pp", r.ok ? new Response(null, { status: 401 }) : r);
  return String(j.access_token);
}
async function pgStart(g, z, o) {
  const ok = o.back + "&r=", email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.cust.email) ? o.cust.email : "";
  if (g === "rz") {
    const r = await fetch("https://api.razorpay.com/v1/orders", { method: "POST", headers: { Authorization: "Basic " + btoa(z.keyId + ":" + z.secret), "Content-Type": "application/json" }, body: JSON.stringify({ amount: o.amount, currency: o.cur, receipt: o.no, notes: { order_no: o.no } }) });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.id) throw pgFail(g, r);
    return { ref: String(j.id), out: { key: z.keyId, order_id: j.id } };
  }
  if (g === "cf") {
    const phone = o.cust.phone.replace(/\D/g, "").slice(-10);
    if (phone.length < 10) throw new PgError("Cashfree needs a 10-digit mobile number. Add it and try again.");
    const r = await fetch(cfHost(z) + "/pg/orders", { method: "POST", headers: cfHead(z), body: JSON.stringify({ order_id: o.id, order_amount: +(o.amount / 100).toFixed(2), order_currency: o.cur, customer_details: { customer_id: "c" + phone, customer_phone: phone, ...o.cust.name ? { customer_name: o.cust.name.slice(0, 100) } : {}, ...email ? { customer_email: email } : {} }, order_meta: { return_url: ok + "cf:" + o.id }, order_note: "Order " + o.no }) });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.payment_session_id) throw pgFail(g, r);
    return { ref: "cf:" + o.id, out: { session: String(j.payment_session_id), mode: z.test ? "sandbox" : "production" } };
  }
  if (g === "pe") {
    const t = await peToken(z);
    const r = await fetch(peHost(z) + "/checkout/v2/pay", { method: "POST", headers: { Authorization: "O-Bearer " + t, "Content-Type": "application/json" }, body: JSON.stringify({ merchantOrderId: o.id, amount: o.amount, paymentFlow: { type: "PG_CHECKOUT", message: "Order " + o.no, merchantUrls: { redirectUrl: ok + "pe:" + o.id } } }) });
    const j = await r.json().catch(() => null);
    if (!r.ok || !/^https:\/\//.test(String(j?.redirectUrl || ""))) throw pgFail(g, r);
    return { ref: "pe:" + o.id, out: { go: String(j.redirectUrl) } };
  }
  if (g === "st") {
    const f = new URLSearchParams({ mode: "payment", success_url: o.back, cancel_url: o.back + "&x=1", client_reference_id: o.no, "line_items[0][quantity]": "1", "line_items[0][price_data][currency]": o.cur.toLowerCase(), "line_items[0][price_data][unit_amount]": String(o.amount), "line_items[0][price_data][product_data][name]": `Order ${o.no}, ${o.name}`.slice(0, 200), ...email ? { customer_email: email } : {} });
    const r = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { Authorization: "Bearer " + z.secret, "Content-Type": "application/x-www-form-urlencoded" }, body: f.toString() });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.id || !/^https:\/\//.test(String(j.url || ""))) throw pgFail(g, r);
    return { ref: "st:" + j.id, out: { go: String(j.url) } };
  }
  if (g === "pp") {
    const t = await ppToken(z);
    const r = await fetch(ppHost(z) + "/v2/checkout/orders", { method: "POST", headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" }, body: JSON.stringify({ intent: "CAPTURE", purchase_units: [{ reference_id: o.no, description: ("Order " + o.no).slice(0, 120), amount: { currency_code: o.cur, value: (o.amount / 100).toFixed(2) } }], payment_source: { paypal: { experience_context: { brand_name: o.name.slice(0, 120), user_action: "PAY_NOW", shipping_preference: "NO_SHIPPING", return_url: o.back, cancel_url: o.back + "&x=1" } } } }) });
    const j = await r.json().catch(() => null), go = String((j?.links || []).find((l) => l && (l.rel === "payer-action" || l.rel === "approve"))?.href || "");
    if (!r.ok || !j?.id || !/^https:\/\//.test(go)) throw pgFail(g, r);
    return { ref: "pp:" + j.id, out: { go } };
  }
  throw new PgError("Unknown way to pay.");
}
async function pgCheck(g, z, id, amount, cur) {
  const near = (v) => Math.abs(Math.round(Number(v)) - amount) <= 1;
  if (g === "cf") {
    const r = await fetch(cfHost(z) + "/pg/orders/" + encodeURIComponent(id), { headers: cfHead(z) }), j = await r.json().catch(() => null);
    if (!r.ok || !j) throw new Error("cf " + r.status);
    return { paid: j.order_status === "PAID" && near(Number(j.order_amount) * 100) && String(j.order_currency || cur) === cur, id: String(j.cf_order_id || id) };
  }
  if (g === "pe") {
    const r = await fetch(peHost(z) + "/checkout/v2/order/" + encodeURIComponent(id) + "/status", { headers: { Authorization: "O-Bearer " + await peToken(z), "Content-Type": "application/json" } }), j = await r.json().catch(() => null);
    if (!r.ok || !j) throw new Error("pe " + r.status);
    return { paid: j.state === "COMPLETED" && near(j.amount), id: String(j.orderId || id) };
  }
  if (g === "st") {
    const r = await fetch("https://api.stripe.com/v1/checkout/sessions/" + encodeURIComponent(id), { headers: { Authorization: "Bearer " + z.secret } }), j = await r.json().catch(() => null);
    if (!r.ok || !j) throw new Error("st " + r.status);
    return { paid: j.payment_status === "paid" && near(j.amount_total) && String(j.currency || "").toUpperCase() === cur, id: String(j.payment_intent || id) };
  }
  if (g === "pp") {
    const t = await ppToken(z), h = { Authorization: "Bearer " + t, "Content-Type": "application/json" };
    let r = await fetch(ppHost(z) + "/v2/checkout/orders/" + encodeURIComponent(id) + "/capture", { method: "POST", headers: h, body: "{}" }), j = await r.json().catch(() => null);
    if (!r.ok) {
      r = await fetch(ppHost(z) + "/v2/checkout/orders/" + encodeURIComponent(id), { headers: h });
      j = await r.json().catch(() => null);
      if (!r.ok || !j) throw new Error("pp " + r.status);
    }
    const cap = j?.purchase_units?.[0]?.payments?.captures?.[0];
    return { paid: j.status === "COMPLETED" && !!cap && cap.status === "COMPLETED" && near(Number(cap.amount?.value) * 100) && String(cap.amount?.currency_code) === cur, id: String(cap?.id || id) };
  }
  return { paid: false, id };
}
function picturesOf(html, base) {
  const out = [], seen = /* @__PURE__ */ new Set();
  const add = (raw, alt = "") => {
    const v = raw.replace(/&amp;/g, "&").trim();
    if (!v || /^data:/i.test(v)) return;
    let u;
    try {
      u = new URL(v, base);
    } catch {
      return;
    }
    if (u.protocol !== "https:" || !publicUrl(u.href) || /\.(svg|ico)(\?|$)/i.test(u.pathname) || /(sprite|pixel|spacer|blank|1x1|tracking|favicon)/i.test(u.pathname)) return;
    const key = u.origin + u.pathname;
    if (seen.has(key) || out.length >= 60) return;
    seen.add(key);
    out.push({ url: u.href, alt: alt.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 120) });
  };
  const attr = (tag, name) => {
    const m = new RegExp("\\s" + name + `\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag);
    return m ? m[1] ?? m[2] ?? m[3] ?? "" : "";
  };
  const biggest = (srcset) => srcset.split(",").map((x) => x.trim().split(/\s+/)).filter((x) => x[0]).sort((a, b) => (parseFloat(b[1]) || 0) - (parseFloat(a[1]) || 0))[0]?.[0] || "";
  const og = /<meta[^>]+property=["']og:image["'][^>]*>/i.exec(html);
  if (og) add(attr(og[0], "content"), "Share image");
  for (const m of html.matchAll(/<(img|source)\b[^>]*>/gi)) {
    const t = m[0], alt = attr(t, "alt");
    const set = attr(t, "data-srcset") || attr(t, "srcset");
    add(set && biggest(set) || attr(t, "data-src") || attr(t, "data-lazy-src") || attr(t, "data-original") || attr(t, "src"), alt);
  }
  for (const m of html.matchAll(/style\s*=\s*["'][^"']*background(?:-image)?\s*:[^"']*url\(\s*(?:&quot;|["'])?([^"')&]+)/gi)) add(m[1]);
  return out;
}
function publicUrl(url) {
  if (!/^https:\/\/[^\s/]+\.[^\s]+$/i.test(url)) return null;
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  return /^(localhost|[\d.]+|\[.*\])$/.test(host) || /\.(local|internal|localhost)$/.test(host) ? null : u;
}
async function lookAt(url) {
  const u = publicUrl(url.trim());
  if (!u) return { error: "Enter the page's public address (https://\u2026)." };
  const get = async (x, accept) => {
    const r = await fetch(x, { headers: { "User-Agent": "Mozilla/5.0 (site-studio reference reader)", Accept: accept }, redirect: "follow" });
    if (!r.ok) throw new Error(String(r.status));
    return (await r.text()).slice(0, 15e5);
  };
  let html = "";
  try {
    html = await get(u.href, "text/html");
  } catch (e) {
    return { error: /^\d+$/.test(String(e?.message)) ? `That page answered ${e.message}.` : "Couldn't open that address." };
  }
  let css = "";
  for (const link of sheetLinks(html, u.href).slice(0, 5)) {
    if (!publicUrl(link) || css.length > 25e5) continue;
    try {
      css += "\n" + await get(link, "text/css");
    } catch {
    }
  }
  return { digest: digestPage(html, css) };
}
async function writeSite(env, q) {
  const brand = String(q.brand || "").trim().slice(0, 80), notes = String(q.notes || "").slice(0, 1500), kind = String(q.kind || "business");
  if (!brand) return { error: "Enter your brand name." };
  let src = String(q.text || "").slice(0, 2e4);
  if (!src.trim()) {
    const url = String(q.url || "").trim();
    if (!/^https:\/\/[^\s/]+\.[^\s]+$/i.test(url)) return { error: "Enter the site's address (https://\u2026)." };
    const host = new URL(url).hostname.toLowerCase();
    if (/^(localhost|[\d.]+|\[.*\])$/.test(host) || /\.(local|internal|localhost)$/.test(host)) return { error: "Use the site's public address." };
    let r;
    try {
      r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (site-studio reference reader)", Accept: "text/html" }, redirect: "follow" });
    } catch {
      return { error: "Couldn't open that address." };
    }
    if (!r.ok) return { error: `That site answered ${r.status}.` };
    const html = (await r.text()).slice(0, 3e6);
    src = outlineOf(html);
  }
  if (words(src).length < 40) return { error: "That page has almost no text to read (it may build its text with JavaScript). Paste the page's text into the box instead.", thin: true };
  const sys = `You write website copy for small businesses. You are given a REFERENCE website's outline only to understand what kind of business it is and which topics a site like it covers. Write completely NEW, original copy for a different business named "${brand}". Rules: never reuse the reference's sentences, phrases, slogans or distinctive wording; never mention the reference business, its name, people, clients, prices, numbers, years, awards or locations; do not invent facts (no years, statistics, client names, awards, certifications, prices or testimonials); keep claims general and honest; use the name ${brand} naturally; plain, warm, professional English; short sentences. Site type: ${kind}. Return ONLY a JSON object with these keys: ${BRIEF_KEYS}. Every value is a string or an array as described; use "" when a key doesn't fit.`;
  const user = `${notes ? "About " + brand + " (from the owner, use this): " + notes + "\n\n" : ""}REFERENCE OUTLINE (for topics only, do not copy):
${src.slice(0, 7e3)}`;
  const model = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
  const ask2 = async (messages) => {
    const r = await env.AI.run(model, { messages, max_tokens: 3e3, temperature: 0.8, response_format: { type: "json_object" } });
    const t = typeof r?.response === "string" ? r.response : JSON.stringify(r?.response ?? r);
    try {
      return JSON.parse(t);
    } catch {
      const m = /\{[\s\S]*\}/.exec(t);
      if (m) return JSON.parse(m[0]);
      throw new Error("The writer returned something unreadable. Try again.");
    }
  };
  let brief;
  try {
    brief = await ask2([{ role: "system", content: sys }, { role: "user", content: user }]);
  } catch (e) {
    return { error: /neuron|quota|limit|429/i.test(String(e?.message || e)) ? "Today's free AI allowance is used up. Try again tomorrow." : "Couldn't write the text: " + (e?.message || e) };
  }
  let flagged = copiedBits(brief, src);
  if (flagged.length) {
    try {
      const again = await ask2([
        { role: "system", content: sys },
        { role: "user", content: user },
        { role: "assistant", content: JSON.stringify(brief) },
        { role: "user", content: `These fields reuse wording from the reference: ${flagged.join(", ")}. Rewrite them in completely different words (keep the rest). Return the whole JSON again.` }
      ]);
      if (again && typeof again === "object") {
        brief = again;
        flagged = copiedBits(brief, src);
      }
    } catch {
    }
  }
  return { brief, flagged, words: words(src).length };
}
var DQ_KINDS = ["portfolio", "store", "business", "restaurant"];
var DQ_LABEL = { portfolio: "Personal website", store: "Online shop", business: "Business website", restaurant: "Restaurant or caf\xE9" };
var studioId = (x) => /^[a-z0-9][a-z0-9-]{0,59}$/.test(x) ? x : "";
async function studioIndex(env, id) {
  const f = await readFile(env, "studio:" + id, "studio.json");
  if (!f) return null;
  try {
    return JSON.parse(new TextDecoder().decode(f.bytes));
  } catch {
    return null;
  }
}
async function dqRate(env, key, max, secs) {
  await ensure(env);
  const now = Date.now();
  const r = await env.DB.prepare("select n, exp from dq_rate where k = ?").bind(key).first();
  if (!r || r.exp < now) {
    await env.DB.prepare("insert or replace into dq_rate (k, n, exp) values (?, 1, ?)").bind(key, now + secs * 1e3).run();
    return true;
  }
  if (r.n >= max) return false;
  await env.DB.prepare("update dq_rate set n = n + 1 where k = ?").bind(key).run();
  return true;
}
var clip = (x, n) => String(x ?? "").replace(/\u0000/g, "").trim().slice(0, n);
function dqStrings(o, keys, len) {
  const out = {};
  for (const [k, v] of Object.entries(o && typeof o === "object" ? o : {}).slice(0, keys)) if (/^[a-z]{1,20}$/.test(k) && typeof v === "string") out[k] = v.slice(0, len);
  return out;
}
function dqCopy(c) {
  const out = {};
  if (!c || typeof c !== "object") return out;
  for (const k of ["tagline", "hero_text", "about_text", "cta_text"]) if (typeof c[k] === "string" && c[k].trim()) out[k] = c[k].trim().slice(0, 900);
  if (Array.isArray(c.items)) out.items = c.items.slice(0, 12).filter((i) => i && typeof i.name === "string").map((i) => ({ name: clip(i.name, 120), text: clip(i.text, 260) }));
  if (Array.isArray(c.faq)) out.faq = c.faq.slice(0, 6).filter((i) => i && typeof i.q === "string" && typeof i.a === "string").map((i) => ({ q: clip(i.q, 160), a: clip(i.a, 420) }));
  return out;
}
var b64Of = (bytes) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(s);
};
function dqDesignPub(d) {
  const out = { on: d?.on !== false };
  if (!d || typeof d !== "object") return out;
  const HEX = /^#[0-9a-f]{6}$/i, KEY = /^[A-Za-z]{1,20}$/;
  if (typeof d.pick === "boolean") out.pick = d.pick;
  if (typeof d.domain === "string" && /^(?=.{4,100}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(d.domain.trim().toLowerCase())) out.domain = d.domain.trim().toLowerCase();
  if (d.themes && typeof d.themes === "object") {
    const th = {};
    for (const kind of ["business", "restaurant", "portfolio", "store"]) if (Array.isArray(d.themes[kind])) th[kind] = d.themes[kind].filter((v) => typeof v === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(v)).slice(0, 400);
    out.themes = th;
  }
  if (d.look && typeof d.look === "object") {
    const look = {};
    for (const kind of ["business", "restaurant", "portfolio", "store"]) {
      const src = d.look[kind];
      if (!src || typeof src !== "object") continue;
      const rules = {};
      for (const key of Object.keys(src).slice(0, 30)) {
        const r = src[key];
        if (!KEY.test(key) || !r || typeof r !== "object") continue;
        const o = {};
        if (typeof r.d === "string") o.d = clip(r.d, 30);
        if (Array.isArray(r.a)) o.a = r.a.filter((v) => typeof v === "string").slice(0, 60).map((v) => clip(v, 30));
        if (r.h === true) o.h = true;
        rules[key] = o;
      }
      look[kind] = rules;
    }
    out.look = look;
  }
  return JSON.stringify(out).length > 12e3 ? { on: out.on } : out;
}
async function dqBrand(env, id) {
  const idx = await studioIndex(env, id);
  const b = idx?.brand;
  if (!b || typeof b.name !== "string") return null;
  let logo = "";
  if (typeof b.logo === "string" && pathOk(b.logo)) {
    const f = await readFile(env, "studio:" + id, b.logo);
    if (f && f.bytes.length <= 15e4) logo = `data:${f.type || "image/png"};base64,${b64Of(f.bytes)}`;
  }
  return { name: clip(b.name, 80), logo, v: +b.v || 0, tint: /^#[0-9a-f]{6}$/i.test(b.tint || "") ? b.tint : "", mode: b.mode === "light" ? "light" : "dark", anim: clip(b.anim, 20), layout: clip(b.layout, 20), design: dqDesignPub(idx?.prefs?.design) };
}
async function dqSubmit(env, id, req, ctx) {
  await ensure(env);
  const raw = await req.text();
  if (raw.length > 2e6) return err(413, "That is too big. Use a smaller logo or PDF.");
  let q;
  try {
    q = JSON.parse(raw || "{}");
  } catch {
    return err(400, "Couldn't read the request.");
  }
  if (q.website) return json({ ok: true });
  if (!await env.DB.prepare("select 1 from members where scope = ? limit 1").bind("studio:" + id).first()) return err(404, "Not found.");
  const ip = req.headers.get("cf-connecting-ip") || "x";
  if (!await dqRate(env, "dq:" + id, 30, 3600) || !await dqRate(env, "dqip:" + ip, 6, 3600)) return err(429, "Too many requests just now. Please try again in a little while.");
  const kind = DQ_KINDS.includes(q.kind) ? q.kind : "", person = clip(q.person, 80), phone = clip(q.phone, 30), email = clip(q.email, 120), note = clip(q.note, 1e3), name = clip(q.name, 120);
  if (!kind || !name) return err(400, "Something is missing from the design. Please start again.");
  if (!person) return err(400, "Please tell us your name.");
  if (!phone && !EMAIL_RE.test(email)) return err(400, "Please give a phone number or an email address so we can reach you.");
  if (email && !EMAIL_RE.test(email)) return err(400, "That email address doesn't look right.");
  const answers = dqStrings(q.answers, 44, 1500), copy = dqCopy(q.copy);
  if (typeof q.answers?.doctext === "string" && q.answers.doctext.trim()) answers.doctext = q.answers.doctext.slice(0, 12e3);
  if (typeof q.answers?.docsec === "string" && q.answers.docsec.length <= 9e3) {
    try {
      if (JSON.parse(q.answers.docsec)) answers.docsec = q.answers.docsec;
    } catch {
    }
  }
  if (answers.doclink && !/^https?:\/\//i.test(answers.doclink)) delete answers.doclink;
  let logo = "";
  if (typeof q.logo === "string" && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(q.logo) && q.logo.length <= 16e4) logo = q.logo;
  let pdf = "", pdfName = "";
  if (q.pdf && typeof q.pdf.b64 === "string") {
    if (!/^JVBER/.test(q.pdf.b64) || q.pdf.b64.length > 17e5 || !/^[A-Za-z0-9+/=]+$/.test(q.pdf.b64)) return err(400, "The menu must be a PDF under 1.2 MB.");
    pdf = q.pdf.b64;
    pdfName = clip(q.pdf.name, 100) || "menu.pdf";
  }
  const made = await env.DB.prepare("insert into design_queries (studio, name, kind, person, phone, email, note, answers, copy, logo, pdf_name, pdf, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) returning id").bind(id, name, kind, person, phone, email, note, JSON.stringify(answers), JSON.stringify(copy), logo, pdfName, pdf, (/* @__PURE__ */ new Date()).toISOString()).first();
  const mail = (async () => {
    let said = "";
    try {
      const owners = ((await env.DB.prepare("select email from members where scope = ? and role in ('owner', 'partner') order by role = 'owner' desc limit 3").bind("studio:" + id).all()).results || []).map((r) => r.email);
      if (!owners.length) said = "Not emailed: no owner address.";
      else if (!env.RESEND_API_KEY || !env.MAIL_FROM) said = "Not emailed: email (Resend) isn't set up on this database.";
      else {
        const rows = [["Name", person], ["Phone", phone], ["Email", email], ["Type", DQ_LABEL[kind]], ["Website name", name], ["What they do", answers.about || ""], ["City", answers.city || ""], ["Pages", answers.pages || ""], ["Feel", answers.style || ""], ["Colour", answers.colour || ""], ["Items", (answers.items || "").replace(/\n/g, ", ")], ["Visitors can", answers.goal || ""], ["Hours", answers.hours || ""], ["Address", answers.address || ""], ["Their document", answers.doc || ""], ["Document link", answers.doclink || ""], ["Chosen look", [answers.theme, answers.accent, answers.mode].filter(Boolean).join(" \xB7 ")], ["Note", note]];
        const table = `<table style="border-collapse:collapse;margin:0 0 14px">${rows.filter(([, v]) => v).map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#666;vertical-align:top">${hesc(k)}</td><td style="padding:4px 0">${hesc(v).replace(/\n/g, "<br>")}</td></tr>`).join("")}</table>`;
        await sendMail(env, owners, `New website request: ${name} (${DQ_LABEL[kind]})`.slice(0, 150), WRAP(`<p style="margin:0 0 12px"><b>${hesc(person)}</b> designed a website on your Design yourself page and wants to take it forward.</p>${table}<p style="margin:0;color:#666">Open Projects \u2192 Design yourself Query in your Studio to see the preview.${pdf ? " A menu PDF is attached to the request there." : ""}</p>`), EMAIL_RE.test(email) ? email : void 0);
      }
    } catch (e) {
      said = "Not emailed: " + String(e?.message || e).slice(0, 200);
    }
    if (said && made?.id) await env.DB.prepare("update design_queries set mail = ? where id = ?").bind(said, made.id).run().catch(() => {
    });
  })();
  if (ctx?.waitUntil) ctx.waitUntil(mail);
  else await mail;
  return json({ ok: true });
}
async function dqRead(env, id, req) {
  const ip = req.headers.get("cf-connecting-ip") || "x";
  if (!await dqRate(env, "dqrd:" + id, 60, 3600) || !await dqRate(env, "dqrdip:" + ip, 10, 3600)) return json({ error: "busy" });
  if (!await studioIndex(env, id)) return err(404, "Not found.");
  let q;
  try {
    q = JSON.parse((await req.text()).slice(0, 2e3) || "{}");
  } catch {
    return json({ error: "Couldn't read the request." });
  }
  const u = publicUrl(String(q.url || "").trim());
  if (!u) return json({ error: "That isn't a public web address (it must start with https://)." });
  let html = "";
  try {
    const r = await fetch(u.href, { headers: { "User-Agent": "Mozilla/5.0 (site-studio reference reader)", Accept: "text/html" }, redirect: "follow", signal: AbortSignal.timeout(8e3) });
    if (!r.ok) return json({ error: `That page answered ${r.status}.` });
    if (!/html|text\/plain/i.test(r.headers.get("content-type") || "")) return json({ error: "That address isn't a web page." });
    html = new TextDecoder().decode((await r.arrayBuffer()).slice(0, 6e5));
  } catch {
    return json({ error: "Couldn't open that address." });
  }
  const dec2 = (t) => t.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&(?:#39|rsquo|lsquo);/g, "'").replace(/&#(\d{2,5});/g, (_, n) => String.fromCharCode(+n));
  const meta = (re) => dec2((re.exec(html)?.[1] || "").trim());
  const title = clip(meta(/<title[^>]*>([\s\S]*?)<\/title>/i), 160);
  const site = clip(meta(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']*)["']/i) || meta(/<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:site_name["']/i), 100);
  const description = clip(meta(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) || meta(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i) || meta(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i), 300);
  const extra = [];
  for (const m of html.matchAll(/href=["']tel:([^"']+)["']/gi)) extra.push("Call " + dec2(m[1]).trim());
  for (const m of html.matchAll(/href=["']mailto:([^"'?]+)/gi)) extra.push("Email " + dec2(m[1]).trim());
  const ig = /instagram\.com\/([\w.]{2,30})/i.exec(html);
  if (ig && !/^(p|reel|explore|accounts)$/i.test(ig[1])) extra.push("Instagram https://instagram.com/" + ig[1]);
  const body = html.replace(/<(script|style|noscript|svg|head|template)[\s\S]*?<\/\1>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ").replace(/<\/(p|div|li|h[1-6]|tr|section|article|footer|header|td|ul|ol)>|<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ");
  const lines = [];
  for (const raw of dec2(body).split("\n")) {
    const l = raw.replace(/\s+/g, " ").trim();
    if (l.length >= 2 && l !== lines[lines.length - 1]) lines.push(l);
    if (lines.length >= 400) break;
  }
  const text = [.../* @__PURE__ */ new Set([...extra, ...lines])].join("\n").slice(0, 12e3);
  if (!text && !title) return json({ error: "That page has no readable text (it may need JavaScript to show its content)." });
  return json({ title, site, description, text });
}
async function dqEngine(env, idx) {
  const mine = idx?.prefs?.design?.ai, g = idx?.ai?.engine;
  const choice = mine === "custom" || mine === "system" || mine === "cloudflare" ? mine : g === "custom" ? "custom" : g === "system" ? "system" : "cloudflare";
  let ai = null;
  if (choice === "custom") {
    const c = await anySetting(env, "ai");
    if (c?.on && c.key && c.model && publicUrl(String(c.base || "").trim())) ai = customAI(c);
  } else if (choice === "cloudflare" && env.AI) ai = env.AI;
  return { choice, ai };
}
var DQ_SEC = {
  services: [["title", 60], ["body", 220]],
  process: [["title", 60], ["body", 220]],
  highlights: [["title", 60], ["body", 220]],
  events: [["title", 60], ["body", 220]],
  values: [["title", 60], ["body", 220]],
  skills: [["title", 60], ["body", 220]],
  team: [["name", 50], ["role", 60], ["bio", 240]],
  testimonials: [["quote", 300], ["name", 50], ["role", 60], ["company", 60]],
  faq: [["q", 140], ["a", 400]],
  pricing: [["name", 40], ["price", 20], ["period", 30], ["blurb", 160]],
  stats: [["value", 20], ["label", 40]],
  work: [["title", 70], ["summary", 220], ["client", 60], ["result", 80]],
  offers: [["title", 60], ["body", 160], ["when", 40], ["price", 20]],
  experience: [["period", 30], ["title", 60], ["org", 60]],
  education: [["period", 30], ["title", 70], ["sub", 70]]
};
function dqSections(x) {
  const out = {};
  if (!x || typeof x !== "object") return out;
  for (const [k, fields] of Object.entries(DQ_SEC)) {
    if (!Array.isArray(x[k])) continue;
    const list = x[k].slice(0, 8).map((e) => {
      const o = {};
      for (const [f, n] of fields) o[f] = clip(e?.[f], n);
      if (k === "pricing") o.features = (Array.isArray(e?.features) ? e.features : []).slice(0, 7).map((v) => clip(v, 80)).filter(Boolean);
      if (k === "experience") o.bullets = (Array.isArray(e?.bullets) ? e.bullets : []).slice(0, 4).map((v) => clip(v, 160)).filter(Boolean);
      if (["services", "process", "highlights", "events", "values", "skills"].includes(k)) o.bullets = [];
      return o;
    }).filter((o) => fields.some(([f]) => k === "team" ? f === "name" && o[f] : o[fields[0][0]]));
    if (list.length) out[k] = list;
  }
  for (const k of ["clients", "languages"]) if (Array.isArray(x[k])) {
    const l = x[k].slice(0, 12).map((v) => clip(v, 40)).filter(Boolean);
    if (l.length) out[k] = l;
  }
  for (const k of ["mission", "vision"]) {
    const v = clip(x[k], 220);
    if (v) out[k] = v;
  }
  return out;
}
async function dqUnderstand(env, id, req) {
  const ip = req.headers.get("cf-connecting-ip") || "x";
  if (!await dqRate(env, "dqun:" + id, 80, 3600) || !await dqRate(env, "dqunip:" + ip, 12, 3600)) return json({ engine: "system", error: "busy" });
  const idx = await studioIndex(env, id);
  if (!idx) return err(404, "Not found.");
  const { choice, ai } = await dqEngine(env, idx);
  if (!ai) return json({ engine: "system" });
  let q;
  try {
    q = JSON.parse((await req.text()).slice(0, 2e4) || "{}");
  } catch {
    return err(400, "Couldn't read the request.");
  }
  const kind = DQ_KINDS.includes(q.kind) ? q.kind : "business", text = clip(q.text, 9e3);
  if (text.length < 30) return json({ engine: "system" });
  const sys = `You read the text of a ${DQ_LABEL[kind].toLowerCase()}'s document or web page and pick out facts for a website. Use ONLY facts written in the text. Never invent anything. Leave out what isn't there. Reply with JSON only: {"name": short name (max 45 chars), "about": what they do in one short line (max 100 chars), "city": city or area, "story": 1-2 plain sentences about them (max 300 chars), "usp": what makes them special (max 160 chars), "items": up to 8 short names of the ${kind === "store" ? "products" : kind === "restaurant" ? "dishes" : kind === "portfolio" ? "skills" : "services"} they offer, "phone": phone number, "email": email address, "hours": opening hours in one line, "address": street address, "social": Instagram address, "sections": {each of these only when the text has it: "services": [{"title","body"}], "team": [{"name","role","bio"}], "testimonials": [{"quote","name","role","company"}], "faq": [{"q","a"}], "pricing": [{"name","price","period","blurb","features":[]}], "process": [{"title","body"}], "stats": [{"value","label"}], "clients": [names], "work": [{"title","summary","client","result"}], "highlights": [{"title","body"}], "offers": [{"title","body","when","price"}], "events": [{"title","body"}], "experience": [{"period","title","org","bullets":[]}], "education": [{"period","title","sub"}], "languages": [names], "mission": text, "vision": text, "values": [{"title","body"}]}}. Copy the wording of the text; keep every entry short. Use plain words.`;
  try {
    const r = await ai.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", { messages: [{ role: "system", content: sys }, { role: "user", content: text }], max_tokens: 2200, temperature: 0.1, response_format: { type: "json_object" } });
    const t = typeof r?.response === "string" ? r.response : JSON.stringify(r?.response ?? r);
    let j;
    try {
      j = JSON.parse(t);
    } catch {
      const m = /\{[\s\S]*\}/.exec(t);
      j = m ? JSON.parse(m[0]) : null;
    }
    if (!j || typeof j !== "object") return json({ engine: "system", error: "unreadable" });
    const f = {};
    for (const [k, n] of [["name", 60], ["about", 110], ["city", 60], ["story", 400], ["usp", 200], ["phone", 30], ["email", 80], ["hours", 90], ["address", 140], ["social", 120]]) {
      const v = clip(j[k], n);
      if (v) f[k] = v;
    }
    const items = (Array.isArray(j.items) ? j.items : []).map((x) => clip(x, 60)).filter(Boolean).slice(0, 8);
    if (items.length) f.items = items;
    const sections = dqSections(j.sections);
    if (Object.keys(sections).length) f.sections = sections;
    return json({ engine: choice, fields: f });
  } catch (e) {
    return json({ engine: "system", error: String(e?.message || e).slice(0, 160) });
  }
}
async function dqWrite(env, id, req) {
  const ip = req.headers.get("cf-connecting-ip") || "x";
  if (!await dqRate(env, "dqai:" + id, 80, 3600) || !await dqRate(env, "dqaiip:" + ip, 12, 3600)) return json({ engine: "system", error: "busy" });
  const idx = await studioIndex(env, id);
  if (!idx) return err(404, "Not found.");
  const { choice, ai } = await dqEngine(env, idx);
  if (!ai) return json({ engine: "system" });
  let q;
  try {
    q = JSON.parse((await req.text()).slice(0, 2e4) || "{}");
  } catch {
    return err(400, "Couldn't read the request.");
  }
  const kind = DQ_KINDS.includes(q.kind) ? q.kind : "business", brand = clip(q.brand, 80);
  if (!brand) return err(400, "Missing name.");
  const items = (Array.isArray(q.items) ? q.items : []).slice(0, 8).map((x) => clip(x, 100)).filter(Boolean);
  const facts = [["About", clip(q.about, 200)], ["City", clip(q.city, 60)], ["Their story", clip(q.story, 900)], ["What makes them special", clip(q.usp, 400)], ["From their own document (use only facts found here)", clip(q.doc, 3e3)]].filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("\n");
  const noun = kind === "store" ? "products" : kind === "restaurant" ? "dishes" : kind === "portfolio" ? "skills" : "services";
  const sys = `You write short, friendly website text in plain words for a small ${DQ_LABEL[kind].toLowerCase()}. Use ONLY what the owner told you. Never invent facts: no years, numbers, prices, awards, client names, addresses or claims. Keep every line short and simple. Return JSON only: {"tagline": at most 8 words, "hero_text": at most 30 words, "about_text": two short paragraphs, at most 70 words in all, built only from their About, services and what makes them special (a story they wrote is shown as it is, separately), "cta_text": at most 14 words, "items": [{"name": the ${noun.slice(0, -1)} exactly as given, "text": one sentence of at most 18 words describing it, using their About line, story and what makes them special where they fit, without inventing facts}] in the same order, "faq": [{"q": question, "a": answer}] three general questions a customer might ask, answered without inventing facts}.`;
  const user = `Name: ${brand}
${facts}
${noun}: ${items.join("; ") || "(none given)"}`;
  try {
    const r = await ai.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", { messages: [{ role: "system", content: sys }, { role: "user", content: user }], max_tokens: 1200, temperature: 0.7, response_format: { type: "json_object" } });
    const t = typeof r?.response === "string" ? r.response : JSON.stringify(r?.response ?? r);
    let j;
    try {
      j = JSON.parse(t);
    } catch {
      const m = /\{[\s\S]*\}/.exec(t);
      j = m ? JSON.parse(m[0]) : null;
    }
    const copy = dqCopy(j);
    if (!Object.keys(copy).length) return json({ engine: "system", error: "unreadable" });
    return json({ engine: choice, copy });
  } catch (e) {
    return json({ engine: "system", error: String(e?.message || e).slice(0, 160) });
  }
}
var db_worker_default = {
  async fetch(req, env, ctx) {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const u = new URL(req.url), p = u.pathname.replace(/\/+$/, "") || "/";
    try {
      if (p === "/") return json({ ok: true, service: "site-studio-db", v: V, mail: !!(env.RESEND_API_KEY && env.MAIL_FROM), ...env.CF_TOKEN && env.CF_ACCOUNT ? { deploy: true, account: env.CF_ACCOUNT } : {}, ...env.GH_TOKEN ? { gh: true } : {}, ...env.AI ? { ai: true, pamphlet: 2 } : {}, reviews: true, dq: 1, look: 1, outline: 1, pictures: 1, connect: 2, translate: 4, approvals: 1, accounts: 2, cfx: 4, cfa: 1, google: 1, studioPages: 1, del: 1, enqMail: 3, ...otherAccounts(env).length ? { more: otherAccounts(env).length } : {} });
      if (p.startsWith("/ai/") && u.searchParams.get("engine") === "custom") {
        const c = await anySetting(env, "ai");
        if (!c?.on || !c.key || !c.model || !publicUrl(String(c.base || "").trim())) return json({ error: "Your own AI API isn't set up yet. Fill it in under Settings \u2192 AI engine." });
        env = { ...env, AI: customAI(c) };
      }
      if (p === "/auth/code" && req.method === "POST") {
        const { email: raw, site: forSite, studio: forStudio } = await req.json();
        const email2 = String(raw || "").trim().toLowerCase();
        if (!emailOk(email2)) return err(400, "Enter a valid email.");
        const known = await env.DB.prepare("select 1 from members where email = ? limit 1").bind(email2).first();
        if (!known) return err(403, `${email2} isn't a member here. Ask the owner to add you.`);
        const prev = await env.DB.prepare("select sent from codes where email = ?").bind(email2).first();
        if (prev && Date.now() - prev.sent < 45e3) return err(429, "A code was just sent. Wait a minute before asking for another.");
        const code = String(1e5 + crypto.getRandomValues(new Uint32Array(1))[0] % 9e5);
        await env.DB.prepare("insert into codes (email, hash, expires, tries, sent) values (?, ?, ?, 0, ?) on conflict (email) do update set hash = excluded.hash, expires = excluded.expires, tries = 0, sent = excluded.sent").bind(email2, b64u(await hmac(env.SECRET, "c:" + email2 + ":" + code)), Date.now() + 10 * 6e4, Date.now()).run();
        let subject = "Your sign-in code", intro = `Enter this code to sign in${env.NAME ? " to " + env.NAME : ""}:`, footer = "It works for 10 minutes. If you didn't ask for it, ignore this email.", heading = "Your sign-in code";
        let mailEnv = env;
        if (typeof forSite === "string" && /^[a-z0-9][a-z0-9-]{0,59}$/.test(forSite) && await env.DB.prepare("select 1 from members where email = ? and scope = ? limit 1").bind(email2, "site:" + forSite).first()) {
          mailEnv = await siteMail(env, forSite);
          const c = await siteContent(env, forSite).catch(() => null), T = c?.emails?.signin;
          if (c) intro = `Enter this code to sign in to ${siteName(c, forSite)}:`;
          if (T && typeof T === "object") {
            const vars = { site: siteName(c, forSite), email: email2 };
            if (T.subject) {
              subject = oneLine(fill(String(T.subject), vars)).slice(0, 150) || subject;
              heading = subject;
            }
            if (T.intro) intro = fill(String(T.intro), vars);
            if (T.footer) footer = fill(String(T.footer), vars);
          }
        } else if (typeof forStudio === "string" && /^[a-z0-9][a-z0-9-]{0,59}$/.test(forStudio) && await env.DB.prepare("select 1 from members where email = ? and scope = ? limit 1").bind(email2, "studio:" + forStudio).first()) {
          let E2 = null;
          try {
            const f = await readFile(env, "studio:" + forStudio, "public/emails.json");
            if (f) E2 = JSON.parse(new TextDecoder().decode(f.bytes));
          } catch {
          }
          const T = E2?.signin;
          if (T && typeof T === "object") {
            const nm = oneLine(String(E2.name || env.NAME || "the Studio")).slice(0, 80), vars = { studio: nm, site: nm, email: email2 };
            if (T.subject) {
              subject = oneLine(fill(String(T.subject), vars)).slice(0, 150) || subject;
              heading = subject;
            }
            if (T.intro) intro = fill(String(T.intro), vars);
            if (T.footer) footer = fill(String(T.footer), vars);
          }
        }
        let onWa = false, onSms = false;
        const waScope = typeof forSite === "string" && /^[a-z0-9][a-z0-9-]{0,59}$/.test(forSite) ? "site:" + forSite : typeof forStudio === "string" && /^[a-z0-9][a-z0-9-]{0,59}$/.test(forStudio) ? "studio:" + forStudio : "";
        if (waScope && await env.DB.prepare("select 1 from members where email = ? and scope = ? limit 1").bind(email2, waScope).first()) {
          const w = await getSetting(env, waScope, "wa").catch(() => null), num = waReady(w) && w.login && String(w.tplOtp || "").trim() ? waNum(waPhoneOf(w.phones, email2), w.cc) : "";
          const pol = waScope.startsWith("site:") ? msgPolicy(await siteContent(env, waScope.slice(5)).catch(() => null)).login : { wa: true, sms: true };
          if (num && pol.wa) try {
            await waSend(w, num, w.tplOtp, [code], code);
            onWa = true;
          } catch {
          }
          const z = await getSetting(env, waScope, "sms").catch(() => null), sn = pol.sms && smsReady(z) && smsOwnCode(z) && z.login ? waNum(waPhoneOf(z.phones, email2), z.cc) : "";
          if (sn) try {
            await smsSend(z, sn, code, env.NAME || "your account");
            onSms = true;
          } catch {
          }
        }
        try {
          await sendMail(mailEnv, email2, subject, WRAP(`<h2 style="margin:0 0 12px;font-size:20px">${hesc(heading)}</h2>${paras(intro)}<p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:0 0 14px">${code}</p>${paras(footer, "margin:0 0 8px;color:#667;font-size:13px")}`));
        } catch (e) {
          if (!onWa && !onSms) throw e;
        }
        return json({ ok: true, ...onWa ? { whatsapp: true } : {}, ...onSms ? { sms: true } : {} });
      }
      if (p === "/auth/verify" && req.method === "POST") {
        const b = await req.json();
        const email2 = String(b.email || "").trim().toLowerCase(), code = String(b.code || "").trim();
        const c = await env.DB.prepare("select hash, expires, tries from codes where email = ?").bind(email2).first();
        if (!c || c.expires < Date.now()) return err(403, "The code has expired. Ask for a new one.");
        if (c.tries >= 5) return err(429, "Too many tries. Ask for a new code.");
        if (b64u(await hmac(env.SECRET, "c:" + email2 + ":" + code)) !== c.hash) {
          await env.DB.prepare("update codes set tries = tries + 1 where email = ?").bind(email2).run();
          return err(403, "That code isn't right.");
        }
        await env.DB.prepare("delete from codes where email = ?").bind(email2).run();
        try {
          await gsOrigin(env, req.headers.get("origin") || "");
        } catch {
        }
        return json({ token: await sessionFor(env, email2), email: email2, ...await pinOn(env) ? { dev: await pinDevice(env, email2) } : {} });
      }
      if (p === "/auth/google" && req.method === "GET") {
        const g = await gsCfg(env);
        return json({ on: !!(g.on && g.clientId), clientId: g.clientId || "", redirect: u.origin + "/auth/google/cb" });
      }
      if (p === "/auth/google/set" && req.method === "POST") {
        const e = await who(env, req);
        if (!e) return err(401, "Sign in first.");
        const owner = await env.DB.prepare("select 1 from members where email = ? and role = 'owner' and scope like 'studio:%' limit 1").bind(e).first() || !await env.DB.prepare("select 1 from members where scope like 'studio:%' limit 1").first() && await env.DB.prepare("select 1 from members where email = ? and role = 'owner' limit 1").bind(e).first();
        if (!owner) return err(403, "Only the owners can change how people sign in.");
        const b = await req.json(), clientId = String(b.clientId || "").trim();
        if (clientId && !/^[\w.-]{10,200}\.apps\.googleusercontent\.com$/.test(clientId)) return err(400, "That doesn't look like a Google client ID (it ends in .apps.googleusercontent.com).");
        const g = await gsCfg(env);
        await putSetting(env, "_db", "google", { ...g, clientId, on: !!b.on && !!clientId });
        try {
          await gsOrigin(env, req.headers.get("origin") || "");
        } catch {
        }
        return json({ ok: true, on: !!b.on && !!clientId, clientId });
      }
      if (p === "/auth/google/start" && req.method === "GET") {
        const g = await gsCfg(env), origin = String(u.searchParams.get("origin") || ""), nonce = String(u.searchParams.get("nonce") || "");
        if (!g.on || !g.clientId) return gsPage("Sign in with Google isn't switched on here.", "Use your email and a code instead.");
        if (!/^[A-Za-z0-9_-]{32,128}$/.test(nonce)) return gsPage("That sign-in link is incomplete.", "Go back and press Sign in with Google again.");
        if (!(g.origins || []).includes(origin)) return gsPage("Sign in with a code once first.", "Sign in with Google works on an address after someone has signed in there with an email code.");
        const body = b64u(enc.encode(JSON.stringify({ o: origin, n: nonce, x: Date.now() + 10 * 6e4 }))), state = body + "." + b64u(await hmac(env.SECRET, "g:" + body));
        return Response.redirect("https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({ client_id: g.clientId, redirect_uri: u.origin + "/auth/google/cb", response_type: "id_token", scope: "openid email", nonce, state, prompt: "select_account" }), 302);
      }
      if (p === "/auth/google/cb" && req.method === "GET") return gsPage("Signing you in\u2026", "One moment.", true);
      if (p === "/auth/google/finish" && req.method === "POST") {
        const b = await req.json().catch(() => ({})), [body, sig] = String(b.state || "").split(".");
        if (!body || !sig || b64u(await hmac(env.SECRET, "g:" + body)) !== sig) return err(400, "That sign-in didn't start here. Go back and press Sign in with Google again.");
        let st = null;
        try {
          st = JSON.parse(dec.decode(unb64u(body)));
        } catch {
        }
        if (!st || st.x < Date.now()) return err(400, "That took too long. Go back and press Sign in with Google again.");
        const g = await gsCfg(env);
        if (!g.on || !g.clientId) return err(403, "Sign in with Google isn't switched on here.");
        const email2 = await gsEmail(String(b.id_token || ""), g.clientId, st.n);
        if (!email2) return err(403, "Google's answer couldn't be checked. Go back and try again.");
        if (!await env.DB.prepare("select 1 from members where email = ? limit 1").bind(email2).first()) return err(403, `${email2} isn't a member here. Ask the owner to add you, then sign in again.`);
        await putSetting(env, "_gs", b64u(await hmac(env.SECRET, "gn:" + st.n)), { token: await sessionFor(env, email2), email: email2, o: st.o, x: Date.now() + 2 * 6e4 });
        return json({ ok: true, email: email2 });
      }
      if (p === "/auth/google/poll" && req.method === "POST") {
        const b = await req.json().catch(() => ({})), nonce = String(b.nonce || "");
        if (!/^[A-Za-z0-9_-]{32,128}$/.test(nonce)) return err(400, "Not a sign-in.");
        const key = b64u(await hmac(env.SECRET, "gn:" + nonce)), r = await getSetting(env, "_gs", key);
        if (!r) return json({ wait: true });
        await putSetting(env, "_gs", key, null);
        if (r.x < Date.now() || r.o !== (req.headers.get("origin") || "")) return err(403, "That sign-in can't be used here. Press Sign in with Google again.");
        return json({ token: r.token, email: r.email });
      }
      if (p === "/auth/pin" && req.method === "GET") {
        const e = await who(env, req), on = await pinOn(env);
        return json({ on, ...e ? { has: !!await env.DB.prepare("select 1 from pins where email = ?").bind(e).first() } : {} });
      }
      if (p === "/auth/pin/set-on" && req.method === "POST") {
        const e = await who(env, req);
        if (!e) return err(401, "Sign in first.");
        if (!await isDbOwner(env, e)) return err(403, "Only the owners can change how people sign in.");
        const b = await req.json().catch(() => ({}));
        await putSetting(env, "_db", "pin", { on: !!b.on });
        return json({ ok: true, on: !!b.on });
      }
      if (p === "/auth/pin/save" && req.method === "POST") {
        const e = await who(env, req);
        if (!e) return err(401, "Sign in first.");
        if (!await pinOn(env)) return err(403, "PIN sign-in isn't switched on.");
        const b = await req.json().catch(() => ({})), pin = String(b.pin || "");
        if (!/^\d{4,6}$/.test(pin)) return err(400, "A PIN is 4 to 6 digits.");
        if (pinWeak(pin)) return err(400, "That PIN is too easy to guess (like 1234 or 1111). Choose another.");
        const salt = b64u(crypto.getRandomValues(new Uint8Array(12)));
        await env.DB.prepare("insert into pins (email, salt, hash, tries, locked, set_at) values (?, ?, ?, 0, 0, ?) on conflict (email) do update set salt = excluded.salt, hash = excluded.hash, tries = 0, locked = 0, set_at = excluded.set_at").bind(e, salt, await pinHash(env, e, salt, pin), (/* @__PURE__ */ new Date()).toISOString()).run();
        return json({ ok: true, dev: await pinDevice(env, e) });
      }
      if (p === "/auth/pin/device" && req.method === "POST") {
        const e = await who(env, req);
        if (!e) return err(401, "Sign in first.");
        if (!await pinOn(env) || !await env.DB.prepare("select 1 from pins where email = ?").bind(e).first()) return err(404, "No PIN.");
        return json({ ok: true, dev: await pinDevice(env, e) });
      }
      if (p === "/auth/pin/remove" && req.method === "POST") {
        const e = await who(env, req);
        if (!e) return err(401, "Sign in first.");
        await env.DB.batch([env.DB.prepare("delete from pins where email = ?").bind(e), env.DB.prepare("delete from pin_dev where email = ?").bind(e)]);
        return json({ ok: true });
      }
      if (p === "/auth/pin/login" && req.method === "POST") {
        const b = await req.json().catch(() => ({})), email2 = String(b.email || "").trim().toLowerCase(), pin = String(b.pin || ""), dev = String(b.dev || "");
        const no = () => err(403, "That PIN isn't right, or this device hasn't signed in with a code yet. Use an emailed code instead.");
        if (!await pinOn(env)) return err(403, "PIN sign-in isn't switched on.");
        if (!emailOk(email2) || !/^\d{4,6}$/.test(pin) || !/^[\w-]{20,60}$/.test(dev)) return no();
        const row = await env.DB.prepare("select salt, hash, locked from pins where email = ?").bind(email2).first();
        const dv = row && await env.DB.prepare("select 1 from pin_dev where email = ? and dev = ?").bind(email2, await devHash(env, dev)).first();
        if (!row || !dv) return no();
        if (row.locked > Date.now()) return err(429, `Too many wrong PINs. PIN sign-in is paused for ${Math.ceil((row.locked - Date.now()) / 6e4)} minutes; use an emailed code instead.`);
        if (await pinHash(env, email2, row.salt, pin) !== row.hash) {
          const r = await env.DB.prepare("update pins set tries = tries + 1 where email = ? returning tries").bind(email2).first(), left = 5 - (r?.tries || 5);
          if (left <= 0) {
            await env.DB.prepare("update pins set tries = 0, locked = ? where email = ?").bind(Date.now() + 15 * 6e4, email2).run();
            return err(429, "Too many wrong PINs. PIN sign-in is paused for 15 minutes; use an emailed code instead.");
          }
          return err(403, `That PIN isn't right. ${left} ${left === 1 ? "try" : "tries"} left.`);
        }
        if (!await env.DB.prepare("select 1 from members where email = ? limit 1").bind(email2).first()) return no();
        await env.DB.prepare("update pins set tries = 0, locked = 0 where email = ?").bind(email2).run();
        return json({ token: await sessionFor(env, email2), email: email2 });
      }
      if (p === "/me") {
        const e = await who(env, req);
        if (!e) return err(401, "Sign in first.");
        const rows = (await env.DB.prepare("select scope, role from members where email = ?").bind(e).all()).results || [];
        return json({ email: e, scopes: rows });
      }
      if (p.startsWith("/p/") && req.method === "GET") {
        const [, , site, ...rest] = p.split("/");
        const path2 = decodeURIComponent(rest.join("/"));
        if (!/^[a-z0-9][a-z0-9-]{0,59}$/.test(site) || !pathOk(path2) || !publicPath(path2)) return err(404, "Not found.");
        const f = await readFile(env, "site:" + site, path2);
        if (!f) return err(404, "Not found.");
        const head = { ...cors, "Content-Type": f.type || typeOf(path2), "Cache-Control": path2.startsWith("assets/") && !path2.startsWith("assets/data/") ? "public, max-age=31536000, immutable" : "no-store", "x-sha": f.sha, "x-updated": f.updated_at, "Accept-Ranges": "bytes" };
        const rg = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("Range") || ""), size = f.bytes.length;
        if (rg && (rg[1] || rg[2])) {
          const from = rg[1] ? +rg[1] : Math.max(0, size - +rg[2]), to = rg[1] && rg[2] ? Math.min(+rg[2], size - 1) : size - 1;
          if (from >= size || from > to) return new Response(null, { status: 416, headers: { ...cors, "Content-Range": `bytes */${size}` } });
          return new Response(f.bytes.slice(from, to + 1), { status: 206, headers: { ...head, "Content-Range": `bytes ${from}-${to}/${size}` } });
        }
        return new Response(f.bytes, { headers: head });
      }
      if (p.startsWith("/sp/") && req.method === "GET") {
        const id = p.split("/")[2] || "";
        if (!/^[a-z0-9][a-z0-9-]{0,59}$/.test(id)) return err(404, "Not found.");
        const f = await readFile(env, "studio:" + id, "public/pages.json");
        if (!f) return err(404, "Not found.");
        return new Response(f.bytes, { headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
      }
      if (p.startsWith("/rv/") && !u.searchParams.has("scope")) {
        const [, , token, sub, ...rest] = p.split("/");
        if (!/^[a-f0-9]{32}$/.test(token || "")) return err(404, "Not found.");
        const a = await env.DB.prepare("select token, scope, project, name, template, note, status, decided_by, decided_at, created_by, created_at" + (sub ? "" : ", content") + " from approvals where token = ?").bind(token).first();
        if (!a) return err(404, "Not found.");
        if (a.status === "closed") return err(410, "This review link has been closed. Ask for a new one.");
        if (sub === "f" && req.method === "GET") {
          const path2 = decodeURIComponent(rest.join("/"));
          if (!pathOk(path2) || !path2.startsWith("assets/")) return err(404, "Not found.");
          const f = await readFile(env, a.scope, `projects/${a.project}/${path2}`);
          if (!f) return err(404, "Not found.");
          return new Response(f.bytes, { headers: { ...cors, "Content-Type": f.type || "application/octet-stream", "Cache-Control": "private, max-age=600", "X-Content-Type-Options": "nosniff" } });
        }
        const notes = async () => (await env.DB.prepare("select id, who, body, page, kind, created_at from approval_notes where token = ? order by id limit 300").bind(token).all()).results || [];
        if (!sub && req.method === "GET") {
          let content = {};
          try {
            content = JSON.parse(a.content);
          } catch {
          }
          return json({ name: a.name, template: a.template, note: a.note, status: a.status, decided_by: a.decided_by, decided_at: a.decided_at, created_at: a.created_at, content, notes: await notes() });
        }
        if ((sub === "note" || sub === "decide") && req.method === "POST") {
          const b = await req.json().catch(() => ({}));
          const whoIs = oneLine(String(b.who || "")).slice(0, 80), body = String(b.body || "").trim().slice(0, 2e3), now = (/* @__PURE__ */ new Date()).toISOString();
          if (!whoIs) return err(400, "Enter your name.");
          const hour = new Date(Date.now() - 36e5).toISOString();
          const n = await env.DB.prepare("select count(*) n, sum(case when created_at > ? then 1 else 0 end) h from approval_notes where token = ?").bind(hour, token).first();
          if ((n?.n || 0) >= 300 || (n?.h || 0) >= 40) return err(429, "Too many notes on this link for now. Try again later.");
          let kind = "comment", status = a.status;
          if (sub === "decide") {
            if (b.decision !== "approved" && b.decision !== "changes") return err(400, "Choose approve or request changes.");
            if (b.decision === "changes" && !body) return err(400, "Say what should change.");
            kind = b.decision;
            status = b.decision;
            await env.DB.prepare("update approvals set status = ?, decided_by = ?, decided_at = ? where token = ?").bind(status, whoIs, now, token).run();
          } else if (!body) return err(400, "Write your comment.");
          await env.DB.prepare("insert into approval_notes (token, who, body, page, kind, created_at) values (?, ?, ?, ?, ?, ?)").bind(token, whoIs, body, oneLine(String(b.page || "")).slice(0, 120), kind, now).run();
          const mail = (async () => {
            if (!env.RESEND_API_KEY || !env.MAIL_FROM || !EMAIL_RE.test(a.created_by || "")) return;
            const what = kind === "approved" ? "approved" : kind === "changes" ? "asked for changes to" : "commented on";
            await sendMail(env, a.created_by, `${whoIs} ${what} ${oneLine(a.name)}`.slice(0, 150), WRAP(`<h2 style="margin:0 0 12px;font-size:20px">${hesc(whoIs)} ${what} ${hesc(a.name)}</h2>${body ? paras(body) : ""}${paras("Open the project in your Studio \u2192 Share for approval to read it and reply.", "margin:0 0 8px;color:#667;font-size:13px")}`));
          })().catch((e) => {
            if (env.DEBUG) console.log("approval mail:", e?.message);
          });
          if (ctx?.waitUntil) ctx.waitUntil(mail);
          else await mail;
          return json({ ok: true, status, notes: await notes() });
        }
        return err(404, "Not found.");
      }
      if (/^\/site\/[a-z0-9][a-z0-9-]{0,59}\/can$/.test(p) && req.method === "GET") {
        const site = p.split("/")[2], w = await getSetting(env, "site:" + site, "wa").catch(() => null), z = await getSetting(env, "site:" + site, "rz").catch(() => null);
        const pg = [];
        for (const g of ["cf", "pe", "st", "pp"]) if (pgReady(g, await getSetting(env, "site:" + site, g).catch(() => null))) pg.push(g);
        const sc = await siteContent(env, site).catch(() => null), cw = await codeWays(env, site, sc), canCode = cw.any;
        return json({ otp: cw.need, pts: canCode && loyOf(sc).on, via: [cw.wa ? "wa" : "", cw.sms ? "sms" : ""].filter(Boolean), em: emailCheckOn(env, sc), acct: acctOf(env, sc, cw), rz: z?.on && z.secret && z.keyId ? String(z.keyId) : "", pg });
      }
      if (/^\/points\/[a-z0-9][a-z0-9-]{0,59}$/.test(p) && req.method === "POST") {
        const site = p.split("/")[2], b = await req.json(), L = loyOf(await siteContent(env, site));
        if (!L.on) return err(404, "Not found.");
        const v = await pointsBal(env, site, b.phone, b.otp, { email: b.email, acct: b.acct });
        if (!v.ok) return err(403, "Verify your mobile number first.");
        return json({ points: v.bal, worth: L.worth, min: L.min, maxPct: L.maxPct, earn: L.earn });
      }
      if (/^\/acct\/(in|me|save)\/[a-z0-9][a-z0-9-]{0,59}$/.test(p) && req.method === "POST") {
        const site = p.split("/")[3], b = await req.json(), sc = await siteContent(env, site).catch(() => null), cw = await codeWays(env, site, sc), A = acctOf(env, sc, cw);
        if (!A) return err(404, "Not found.");
        if (p.startsWith("/acct/in/")) {
          let key2 = "", kind = "";
          if (A.phone.length && b.phone) {
            const num = waNum(b.phone, cw.cc), [exp2, sig] = String(b.otp || "").split(".");
            if (num && +exp2 > Date.now() && sig === b64u(await hmac(env.SECRET, "otp:" + site + ":" + num + ":" + exp2))) {
              key2 = num;
              kind = "phone";
            }
          } else if (A.email && b.email) {
            const em = emailKey(b.email), [exp2, sig] = String(b.eotp || "").split(".");
            if (em && +exp2 > Date.now() && sig === b64u(await hmac(env.SECRET, "eotp:" + site + ":" + em + ":" + exp2))) {
              key2 = em;
              kind = "email";
            }
          }
          if (!key2) return err(403, "That code has expired. Ask for a new one.");
          const exp = Date.now() + CUST_DAYS * 864e5;
          return json({ ok: true, key: key2, kind, pass: await custPass(env, site, key2, exp) });
        }
        const key = String(b.key || "");
        if (!await custOk(env, site, key, b.pass)) return err(401, "Please sign in again.");
        const byMail = key.includes("@");
        if (p.startsWith("/acct/save/")) {
          const name = oneLine(String(b.name || "")).replace(/\s+/g, " ").slice(0, 100), phone = byMail ? String(b.phone || "").replace(/[^\d+ ()-]/g, "").slice(0, 24) : "", email2 = byMail ? "" : emailKey(b.email);
          if (!byMail && String(b.email || "").trim() && !email2) return err(400, "Enter a valid email address.");
          if (byMail && phone && phone.replace(/\D/g, "").length < 8) return err(400, "Enter a mobile number with at least 8 digits.");
          const addrs = (Array.isArray(b.addresses) ? b.addresses : []).slice(0, 6).map(cleanAddr).filter((a) => a.line1 || a.city || a.pin), now = (/* @__PURE__ */ new Date()).toISOString();
          let kept = {};
          try {
            kept = JSON.parse(String((await env.DB.prepare("select data from profiles where site = ? and ckey = ?").bind(site, key).first())?.data || "{}")) || {};
          } catch {
          }
          const dob = "dob" in b ? /^(19|20)\d\d-\d\d-\d\d$/.test(String(b.dob)) && String(b.dob) <= now.slice(0, 10) ? String(b.dob) : "" : cleanDob(kept.dob), gender = "gender" in b ? cleanGender(b.gender) : cleanGender(kept.gender);
          await env.DB.batch([
            env.DB.prepare("insert into customers (site, ckey, name, phone, email, verified, orders, spent, points, first_at, last_at) values (?, ?, ?, ?, ?, 1, 0, 0, 0, ?, ?) on conflict (site, ckey) do update set name = excluded.name, phone = case when ? = 1 then excluded.phone else phone end, email = case when ? = 1 then email else excluded.email end, verified = 1").bind(site, key, name, byMail ? phone : "+" + key, byMail ? key : email2, now, now, byMail ? 1 : 0, byMail ? 1 : 0),
            env.DB.prepare("insert into profiles (site, ckey, data) values (?, ?, ?) on conflict (site, ckey) do update set data = excluded.data").bind(site, key, JSON.stringify({ addresses: addrs, dob, gender }))
          ]);
          return json({ ok: true, profile: { name, phone: byMail ? phone : "+" + key, email: byMail ? key : email2, addresses: addrs, dob, gender } });
        }
        const row = await env.DB.prepare("select name, phone, email, orders, spent, points, first_at from customers where site = ? and ckey = ?").bind(site, key).first();
        let addresses = [], pf = {};
        try {
          pf = JSON.parse(String((await env.DB.prepare("select data from profiles where site = ? and ckey = ?").bind(site, key).first())?.data || "{}")) || {};
          addresses = (pf.addresses || []).slice(0, 6).map(cleanAddr);
        } catch {
        }
        const nos = ((await env.DB.prepare("select order_no, max(at) t from points where site = ? and ckey = ? and order_no <> '' group by order_no order by t desc limit 25").bind(site, key).all()).results || []).map((r) => String(r.order_no));
        const orders = [];
        if (nos.length) {
          const rows = (await env.DB.prepare(`select data, status, created_at from enquiries where site = ? and (${nos.map(() => "instr(data, ?) > 0").join(" or ")}) order by created_at desc limit 40`).bind(site, ...nos.map((n) => `"order_no":${JSON.stringify(n)}`)).all()).results || [];
          for (const r of rows) {
            let d = null;
            try {
              d = JSON.parse(r.data);
            } catch {
              continue;
            }
            if (!nos.includes(String(d.order_no))) continue;
            let items = [];
            try {
              items = JSON.parse(String(d._items || "[]")).slice(0, 40);
            } catch {
            }
            orders.push({ no: String(d.order_no), at: r.created_at, total: String(d.total || ""), status: String(r.status || "new"), mode: String(d.mode || ""), paid: d._paid === "yes", pay: String(d.payment || d.pay || ""), address: String(d.address || ""), name: String(d.name || ""), points: String(d._points || ""), ...d._bill ? (() => {
              try {
                return { bill: JSON.parse(String(d._bill)) };
              } catch {
                return {};
              }
            })() : {}, ...trackOf(d) ? { track: trackShown(trackOf(d)) } : {}, items, text: String(d.items || d.order || d.message || "").slice(0, 2e3) });
          }
        }
        const L = loyOf(sc);
        return json({ ok: true, name: row?.name || "", phone: byMail ? row?.phone || "" : "+" + key, email: byMail ? key : row?.email || "", addresses, dob: cleanDob(pf.dob), gender: cleanGender(pf.gender), count: +row?.orders || 0, points: Math.max(0, +row?.points || 0), loyalty: L.on ? { worth: L.worth, min: L.min, maxPct: L.maxPct } : null, orders });
      }
      if (/^\/eotp\/(send|check)\/[a-z0-9][a-z0-9-]{0,59}$/.test(p) && req.method === "POST") {
        const site = p.split("/")[3], b = await req.json(), sc = await siteContent(env, site).catch(() => null);
        if (!emailCheckOn(env, sc) && !acctOf(env, sc, { wa: false, sms: false })?.email) return err(404, "Not found.");
        const em = emailKey(b.email);
        if (!em) return err(400, "Enter a valid email address.");
        const k = "e:" + site + ":" + em, now = Date.now();
        if (p.startsWith("/eotp/send/")) {
          const prev = await env.DB.prepare("select sent from otps where k = ?").bind(k).first();
          if (prev && now - prev.sent < 45e3) return err(429, "A code was just sent. Wait a minute before asking for another.");
          const n = await env.DB.prepare("select count(*) n from otps where k like ? and sent > ?").bind("e:" + site + ":%", now - 36e5).first();
          if ((n?.n || 0) >= 150) return err(429, "Too many codes were asked for. Please try again later.");
          const code = String(1e5 + crypto.getRandomValues(new Uint32Array(1))[0] % 9e5), name = oneLine(String(sc?.brand?.name || "")).slice(0, 60) || "your order";
          await env.DB.prepare("insert into otps (k, hash, expires, tries, sent) values (?, ?, ?, 0, ?) on conflict (k) do update set hash = excluded.hash, expires = excluded.expires, tries = 0, sent = excluded.sent").bind(k, b64u(await hmac(env.SECRET, k + ":" + code)), now + 10 * 6e4, now).run();
          try {
            await sendMail(await siteMail(env, site), em, `${code} is your code for ${name}`, `<p>Your code to confirm this email address for ${hesc(name)}:</p><p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p><p>It works for 10 minutes. If you didn't ask for it, ignore this email.</p>`);
          } catch {
            const exp2 = now + 45 * 6e4;
            return json({ ok: false, skip: exp2 + "." + b64u(await hmac(env.SECRET, "eskip:" + site + ":" + em + ":" + exp2)) });
          }
          return json({ ok: true });
        }
        const c = await env.DB.prepare("select hash, expires, tries from otps where k = ?").bind(k).first();
        if (!c || c.expires < now) return err(403, "The code has expired. Ask for a new one.");
        if (c.tries >= 5) return err(429, "Too many tries. Ask for a new code.");
        if (c.hash !== b64u(await hmac(env.SECRET, k + ":" + String(b.code || "").trim()))) {
          await env.DB.prepare("update otps set tries = tries + 1 where k = ?").bind(k).run();
          return err(403, "That code isn't right.");
        }
        await env.DB.prepare("update otps set expires = 0 where k = ?").bind(k).run();
        const exp = now + 45 * 6e4;
        return json({ ok: true, token: exp + "." + b64u(await hmac(env.SECRET, "eotp:" + site + ":" + em + ":" + exp)) });
      }
      if (/^\/otp\/(send|check)\/[a-z0-9][a-z0-9-]{0,59}$/.test(p) && req.method === "POST") {
        const site = p.split("/")[3], b = await req.json(), sc = await siteContent(env, site).catch(() => null), cw = await codeWays(env, site, sc), w = cw.w;
        if (!(cw.any && (cw.need || loyOf(sc).on || acctOf(env, sc, cw)?.phone.length))) return err(404, "Not found.");
        const via = b.via === "sms" && cw.sms ? "sms" : b.via === "wa" && cw.wa ? "wa" : cw.wa ? "wa" : "sms";
        const num = waNum(b.phone, cw.cc);
        if (!num) return err(400, "Enter your mobile number with its country code.");
        const k = "o:" + site + ":" + num, now = Date.now();
        if (p.startsWith("/otp/send/")) {
          const prev = await env.DB.prepare("select sent from otps where k = ?").bind(k).first();
          if (prev && now - prev.sent < 45e3) return err(429, "A code was just sent. Wait a minute before asking for another.");
          const n = await env.DB.prepare("select count(*) n from otps where k like ? and sent > ?").bind("o:" + site + ":%", now - 36e5).first();
          if ((n?.n || 0) >= 80) return err(429, "Too many codes were asked for. Please try again later, or call us.");
          const code = String(1e5 + crypto.getRandomValues(new Uint32Array(1))[0] % 9e5);
          await env.DB.prepare("insert into otps (k, hash, expires, tries, sent) values (?, ?, ?, 0, ?) on conflict (k) do update set hash = excluded.hash, expires = excluded.expires, tries = 0, sent = excluded.sent").bind(k, b64u(await hmac(env.SECRET, k + ":" + code)), now + 10 * 6e4, now).run();
          try {
            if (via === "sms") {
              const ref = await smsSend(cw.z, num, code, siteName(sc, site));
              if (ref) await env.DB.prepare("update otps set hash = ? where k = ?").bind("ref:" + ref, k).run();
            } else await waSend(w, num, w.tplOtp, [code], code);
          } catch {
            return err(502, `We couldn't send the code ${via === "sms" ? "by SMS" : "on WhatsApp"} just now. Check the number${cw.wa && cw.sms ? ", try the other way" : ""}, or call us to order.`);
          }
          return json({ ok: true, via });
        }
        const c = await env.DB.prepare("select hash, expires, tries from otps where k = ?").bind(k).first();
        if (!c || c.expires < now) return err(403, "The code has expired. Ask for a new one.");
        if (c.tries >= 5) return err(429, "Too many tries. Ask for a new code.");
        const typed = String(b.code || "").trim(), right = String(c.hash).startsWith("ref:") ? /^\d{4,8}$/.test(typed) && !!cw.z && await mcCheck(cw.z, num, String(c.hash).slice(4), typed).catch(() => false) : c.hash === b64u(await hmac(env.SECRET, k + ":" + typed));
        if (!right) {
          await env.DB.prepare("update otps set tries = tries + 1 where k = ?").bind(k).run();
          return err(403, "That code isn't right.");
        }
        await env.DB.prepare("update otps set expires = 0 where k = ?").bind(k).run();
        const exp = now + 45 * 6e4;
        return json({ ok: true, token: exp + "." + b64u(await hmac(env.SECRET, "otp:" + site + ":" + num + ":" + exp)) + (via === "sms" ? ".s" : "") });
      }
      if (/^\/hook\/pos\/[a-z0-9][a-z0-9-]{0,59}$/.test(p) && req.method === "POST") {
        const site = p.split("/")[3], key = b64u(await hmac(env.SECRET, "pos:" + site)).slice(0, 32);
        if (u.searchParams.get("k") !== key) return err(403, "Not allowed.");
        const z = await getSetting(env, "site:" + site, "pos").catch(() => null);
        if (!posReady(z)) return err(404, "Not set up.");
        const b = await req.json().catch(() => ({})), no = String(b.orderID || b.clientOrderID || ""), st = POS_STATUS[String(b.status)];
        if (String(b.restID || "") !== String(z.restId) || !/^[A-Z0-9][A-Z0-9-]{3,29}$/.test(no) || !st) return json({ success: false, message: "Unknown order or status." }, 400);
        const rows = (await env.DB.prepare("select id, data, status from enquiries where site = ? and data like ? order by id desc limit 5").bind(site, `%"order_no":"${no}"%`).all()).results || [];
        const row = rows.find((r) => {
          try {
            return JSON.parse(r.data).order_no === no;
          } catch {
            return false;
          }
        });
        if (!row) return json({ success: false, message: "Order not found." }, 404);
        const d = JSON.parse(row.data);
        d._pos = "Petpooja: " + { accepted: "accepted", ready: "food ready", out: "dispatched", done: "delivered", cancelled: "cancelled" }[st] + (b.cancel_reason ? " (" + oneLine(String(b.cancel_reason)).slice(0, 120) + ")" : "") + (b.rider_name ? `, rider ${oneLine(String(b.rider_name)).slice(0, 60)} ${String(b.rider_phone_number || "").replace(/[^\d+ ]/g, "").slice(0, 20)}` : "");
        if (+b.minimum_prep_time > 0) d._pos_prep = String(Math.round(+b.minimum_prep_time));
        await env.DB.prepare("update enquiries set status = ?, data = ? where id = ?").bind(st, JSON.stringify(d), row.id).run();
        return json({ success: true, message: "Order status updated." });
      }
      if (/^\/pay\/(rz|cf|pe|st|pp)\/[a-z0-9][a-z0-9-]{0,59}$/.test(p) && req.method === "POST") {
        const g = p.split("/")[2], site = p.split("/")[3], z = await getSetting(env, "site:" + site, g);
        if (!pgReady(g, z)) return err(404, "Online payment isn't set up for this site.");
        const q = await req.json(), no = String(q.order_no || "");
        if (!/^[A-Z0-9][A-Z0-9-]{3,29}$/.test(no)) return err(400, "Which order?");
        const c = await siteContent(env, site), rest = isRest(c);
        if (g !== "rz" && !pgOn(c, g)) return err(404, "That way to pay isn't switched on for this site.");
        q._bal = +q.points > 0 ? (await pointsBal(env, site, q.phone, q.otp, { email: q.email, acct: q.acct })).bal : 0;
        const bill = rest ? restBill(c, q) : Array.isArray(c?.products) ? shopBill(c, q) : { error: "This site doesn't take orders." };
        if ("error" in bill) return err(409, bill.error);
        if (invOn(c)) {
          const sorry = await stockCheck(env, site, c, { items: q.items });
          if (sorry) return err(409, sorry);
        }
        if (Math.abs(bill.total - (+q.total || 0)) > 0.5) return err(409, rest ? "The menu or its prices changed while you were ordering. Refresh the page and check your cart." : "Prices or delivery charges changed while you were ordering. Refresh the page and check your cart.");
        const n = await env.DB.prepare("select count(*) n from payments where site = ? and created_at > ?").bind(site, new Date(Date.now() - 36e5).toISOString()).first();
        if ((n?.n || 0) >= 200) return err(429, "Too many payments were started. Please try again in a while.");
        const amount = Math.round(bill.total * 100), cur = siteCur(c);
        if (PG[g].inr ? cur !== "INR" || amount < 100 : !PG_CUR.includes(cur) || amount < 100) return err(400, PG[g].inr ? `${PG[g].name} works for totals in rupees of \u20B91 or more.` : `${PG[g].name} can't take this site's currency here.`);
        let back = "";
        if (g !== "rz") {
          let b = null;
          try {
            b = new URL(String(q.back || ""));
          } catch {
          }
          if (!b || !/^https?:$/.test(b.protocol)) return err(400, "Where should the payment come back to?");
          back = b.origin + b.pathname + "?paid=" + g + "&o=" + encodeURIComponent(no);
        }
        const cust = { name: oneLine(String(q.name || "")).slice(0, 100), email: String(q.email || "").trim().slice(0, 200), phone: String(q.phone || "").slice(0, 30) };
        const id = no + "-" + Array.from(crypto.getRandomValues(new Uint8Array(5)), (x) => x.toString(16).padStart(2, "0")).join("");
        let made;
        try {
          made = await pgStart(g, z, { no, id, amount, cur, back, name: siteName(c, site), cust });
        } catch (e) {
          return err(e instanceof PgError && !e.keys && /needs a/.test(e.message) ? 400 : 502, e instanceof PgError ? e.message : `${PG[g].name} couldn't start the payment just now. Please try again, or choose another way to pay.`);
        }
        await env.DB.prepare("insert into payments (rz_order, site, order_no, amount, status, created_at) values (?, ?, ?, ?, 'created', ?)").bind(made.ref, site, no, amount, (/* @__PURE__ */ new Date()).toISOString()).run();
        return json({ ...made.out, ref: made.ref, amount, currency: cur, name: siteName(c, site) });
      }
      if (p.startsWith("/order/") && req.method === "GET") {
        const [, , site, no] = p.split("/"), k = u.searchParams.get("k") || "";
        if (!/^[a-z0-9][a-z0-9-]{0,59}$/.test(site || "") || !/^[A-Z0-9][A-Z0-9-]{3,29}$/.test(no || "") || !/^[a-f0-9]{16,64}$/.test(k)) return err(404, "Not found.");
        const rows = (await env.DB.prepare("select status, data from enquiries where site = ? and data like ? order by id desc limit 5").bind(site, `%"order_no":"${no}"%`).all()).results || [];
        const hit = rows.find((r) => {
          try {
            const d = JSON.parse(r.data);
            return d.order_no === no && d.okey === k;
          } catch {
            return false;
          }
        });
        if (!hit) return err(404, "Not found.");
        let paid = "", track = null;
        try {
          const hd = JSON.parse(hit.data);
          paid = String(hd._paid || "");
          track = trackShown(trackOf(hd));
        } catch {
        }
        return json({ status: hit.status, paid, ...track ? { track } : {} });
      }
      if (/^\/rev\/[a-z0-9][a-z0-9-]{0,59}$/.test(p) && req.method === "GET") {
        const site = p.split("/")[2], item = (u.searchParams.get("item") || "").slice(0, 200);
        await ensure(env);
        const hdr = { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" };
        if (!item) {
          const s = {};
          for (const r of (await env.DB.prepare("select item, avg(rating) a, count(*) n from reviews where site = ? and status = 'live' group by item limit 3000").bind(site).all()).results || []) s[String(r.item)] = [Math.round(+r.a * 10) / 10, +r.n];
          return new Response(JSON.stringify({ s }), { headers: hdr });
        }
        const rows = (await env.DB.prepare("select id, name, rating, title, body, verified, reply, created_at from reviews where site = ? and item = ? and status = 'live' order by id desc limit 60").bind(site, item).all()).results || [];
        const hist = [0, 0, 0, 0, 0];
        let sum = 0;
        for (const r of rows) {
          hist[Math.max(1, Math.min(5, r.rating)) - 1]++;
          sum += r.rating;
        }
        return new Response(JSON.stringify({ n: rows.length, a: rows.length ? Math.round(sum / rows.length * 10) / 10 : 0, hist, list: rows.slice(0, 30).map(revShown) }), { headers: hdr });
      }
      if (/^\/rev\/[a-z0-9][a-z0-9-]{0,59}$/.test(p) && req.method === "POST") {
        const site = p.split("/")[2], b = await req.json().catch(() => ({}));
        await ensure(env);
        const c = await siteContent(env, site).catch(() => null);
        if (!revOn(c)) return err(404, "Reviews aren't switched on for this site.");
        if (String(b.hp || "")) return json({ ok: true, status: "pending" });
        const it = stockItems(c).find((x) => !x.opt && x.item === String(b.item || ""));
        if (!it) return err(404, "We couldn't find that item.");
        const rating = Math.round(+b.rating), body = String(b.body || "").replace(/\r/g, "").trim().slice(0, 1500), name = oneLine(String(b.name || "")).slice(0, 60), title = oneLine(String(b.title || "")).slice(0, 100), email2 = String(b.email || "").trim().toLowerCase().slice(0, 120);
        if (!(rating >= 1 && rating <= 5)) return err(400, "Choose a star rating.");
        if (!name) return err(400, "Please give your name.");
        if (body.length < 3) return err(400, "Please write a few words about it.");
        if (email2 && !EMAIL_RE.test(email2)) return err(400, "That email address doesn't look right.");
        if (c.reviews.needEmail !== false && !email2) return err(400, "Please give your email address (it is never shown).");
        const hour = new Date(Date.now() - 36e5).toISOString();
        if (+((await env.DB.prepare("select count(*) n from reviews where site = ? and created_at > ?").bind(site, hour).first())?.n || 0) >= 40) return err(429, "Too many reviews just now. Please try again in a while.");
        if (email2 && await env.DB.prepare("select 1 x from reviews where site = ? and item = ? and email = ?").bind(site, it.item, email2).first()) return err(409, "You've already reviewed this.");
        let verified = 0;
        if (email2) {
          const nm = JSON.stringify(it.name.split(" \xB7 ")[0]).slice(1, -1);
          verified = await env.DB.prepare(`select 1 x from enquiries where site = ? and status != 'cancelled' and instr(data, '"order_no"') > 0 and instr(lower(data), ?) > 0 and instr(data, ?) > 0 limit 1`).bind(site, email2, nm).first() ? 1 : 0;
        }
        if (c.reviews.buyersOnly && !verified) return err(403, "Only people who have ordered this can review it. Use the email address you ordered with.");
        const live = c.reviews.auto === true || c.reviews.trustBuyers && verified;
        await env.DB.prepare("insert into reviews (site, item, label, name, email, rating, title, body, verified, status, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(site, it.item, it.name.slice(0, 120), name, email2, rating, title, body, verified, live ? "live" : "pending", (/* @__PURE__ */ new Date()).toISOString()).run();
        if (!live && c.reviews.alert !== false && (await siteMail(env, site)).RESEND_API_KEY && (await siteMail(env, site)).MAIL_FROM) {
          const to = await ownerTo(env, site, c, c.reviews.alertTo);
          if (to.length) {
            const mm = sendMail(await siteMail(env, site), to, `New review to approve: ${it.name}`.slice(0, 150), WRAP(`<h2 style="margin:0 0 12px;font-size:20px">New review for ${hesc(it.name)}</h2>${paras(`${"\u2605".repeat(rating)}${"\u2606".repeat(5 - rating)}  ${name}${verified ? " (verified buyer)" : ""}
${title ? title + "\n" : ""}
${body}`)}${paras("Approve or hide it under Reviews in your site's admin page.", "margin:0 0 8px;color:#667;font-size:13px")}`)).catch(() => {
            });
            if (ctx?.waitUntil) ctx.waitUntil(mm);
            else await mm;
          }
        }
        return json({ ok: true, status: live ? "live" : "pending" });
      }
      if (/^\/cart\/[a-z0-9][a-z0-9-]{0,59}$/.test(p) && req.method === "POST") {
        const site = p.split("/")[2], b = await req.json().catch(() => ({}));
        await ensure(env);
        const c = await siteContent(env, site).catch(() => null);
        if (!recOn(c)) return json({ ok: true, off: true });
        const email2 = String(b.email || "").trim().slice(0, 120);
        if (!EMAIL_RE.test(email2)) return json({ ok: true });
        const lines = Array.isArray(b.lines) ? b.lines.slice(0, 40) : [], key = recKey(email2);
        if (!lines.length) {
          await env.DB.prepare("delete from carts where site = ? and ckey = ? and status = 'open'").bind(site, key).run();
          return json({ ok: true });
        }
        const items = (Array.isArray(b.items) ? b.items : []).slice(0, 40).map((x) => ({ n: oneLine(String(x?.n || "")).slice(0, 100), q: Math.max(1, Math.min(999, Math.round(+x?.q || 1))) })).filter((x) => x.n);
        const total = Math.max(0, Math.min(1e7, +b.total || 0)), now = (/* @__PURE__ */ new Date()).toISOString();
        let back = "";
        try {
          const u2 = new URL(String(b.back || ""));
          const o = req.headers.get("origin");
          if (u2.protocol === "https:" && (!o || o === u2.origin)) back = (u2.origin + u2.pathname).slice(0, 300);
        } catch {
        }
        const old = await env.DB.prepare("select status, lines, tok from carts where site = ? and ckey = ?").bind(site, key).first();
        if (old?.status === "stop") return json({ ok: true });
        const ls = JSON.stringify(lines).slice(0, 12e3), same = old && old.lines === ls && old.status === "open";
        await env.DB.prepare("insert into carts (site, ckey, tok, email, name, phone, lines, items, total, cur, back, status, sent, order_no, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', 0, '', ?, ?) on conflict (site, ckey) do update set name = excluded.name, phone = excluded.phone, lines = excluded.lines, items = excluded.items, total = excluded.total, back = excluded.back, status = 'open', order_no = '', " + (same ? "" : "sent = 0, sent_at = null, ") + "updated_at = " + (same ? "carts.updated_at" : "excluded.updated_at")).bind(site, key, recTok(), email2.toLowerCase(), oneLine(String(b.name || "")).slice(0, 80), oneLine(String(b.phone || "")).slice(0, 30), ls, JSON.stringify(items).slice(0, 6e3), total, siteCur(c), back, now, now).run();
        const sw = recSweep(env, new URL(req.url).origin).catch(() => 0);
        if (ctx?.waitUntil) ctx.waitUntil(sw);
        else await sw;
        return json({ ok: true });
      }
      if (/^\/cart\/[a-z0-9][a-z0-9-]{0,59}\/[a-f0-9]{32}$/.test(p) && req.method === "GET") {
        const [, , site, tok] = p.split("/");
        await ensure(env);
        const r = await env.DB.prepare("select lines, status from carts where site = ? and tok = ?").bind(site, tok).first();
        if (!r || r.status === "recovered") return json({ lines: [] });
        return json({ lines: JSON.parse(r.lines) });
      }
      if (/^\/cart\/[a-z0-9][a-z0-9-]{0,59}\/[a-f0-9]{32}\/stop$/.test(p) && req.method === "GET") {
        const [, , site, tok] = p.split("/");
        await ensure(env);
        await env.DB.prepare("update carts set status = 'stop' where site = ? and tok = ? and status = 'open'").bind(site, tok).run();
        return new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font:16px system-ui;max-width:420px;margin:15vh auto;padding:0 20px"><h2>No more reminders</h2><p>We won't email you about this cart again.</p>`, { headers: { "Content-Type": "text/html; charset=utf-8" } });
      }
      if (/^\/stock\/[a-z0-9][a-z0-9-]{0,59}$/.test(p) && req.method === "GET") {
        const site = p.split("/")[2];
        await ensure(env);
        const s = {};
        for (const r of (await env.DB.prepare("select item, qty from stock where site = ? limit 3000").bind(site).all()).results || []) s[String(r.item)] = Math.max(0, Math.min(99, +r.qty || 0));
        {
          const sw = recSweep(env, new URL(req.url).origin).catch(() => 0);
          if (ctx?.waitUntil) ctx.waitUntil(sw);
        }
        return new Response(JSON.stringify({ s }), { headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
      }
      if (/^\/track\/[a-z0-9][a-z0-9-]{0,59}$/.test(p) && req.method === "POST") {
        const site = p.split("/")[2], b = await req.json().catch(() => ({})), no = String(b.no || "").trim().toUpperCase();
        if (!/^[A-Z0-9][A-Z0-9-]{3,29}$/.test(no)) return err(404, "We couldn't find that order. Check the order number.");
        const byKey = /^[a-f0-9]{16,64}$/.test(String(b.k || ""));
        if (!byKey) {
          const now = Date.now(), k = "trk:" + site + ":" + Math.floor(now / 36e5);
          const n = await env.DB.prepare("select tries from otps where k = ?").bind(k).first();
          if ((n?.tries || 0) >= 400) return err(429, "Too many lookups just now. Please try again later.");
          await env.DB.prepare("insert into otps (k, hash, expires, tries, sent) values (?, '', ?, 1, ?) on conflict (k) do update set tries = tries + 1").bind(k, now + 2 * 36e5, now).run();
        }
        const rows = (await env.DB.prepare("select id, status, data, created_at from enquiries where site = ? and data like ? order by id desc limit 5").bind(site, `%"order_no":"${no}"%`).all()).results || [];
        let cust = "";
        if (b.key && await custOk(env, site, String(b.key), b.pass)) cust = String(b.key);
        const same = (d, c) => {
          const e = emailKey(c);
          if (e) return e === emailKey(d.email);
          const a = String(c || "").replace(/\D/g, ""), z = String(d.phone || "").replace(/\D/g, "");
          return a.length >= 8 && z.length >= 8 && a.slice(-10) === z.slice(-10);
        };
        let hit = null, hd = null;
        for (const r of rows) {
          let d;
          try {
            d = JSON.parse(r.data);
          } catch {
            continue;
          }
          if (d.order_no !== no) continue;
          if (byKey && d.okey === b.k || cust && same(d, cust.includes("@") ? cust : "+" + cust) || b.contact && same(d, String(b.contact))) {
            hit = r;
            hd = d;
            break;
          }
        }
        if (!hit) return err(404, "We couldn't find that order. Check the order number and the mobile number or email you ordered with.");
        const got = await shipLive(env, site, hit.id, hd, hit.status).catch(() => ({ live: null, why: "", status: hit.status }));
        const L = got.live;
        return json({ no, at: hit.created_at, status: got.status, total: String(hd.total || ""), paid: hd._paid === "yes", track: trackShown(trackOf(hd)), live: L ? { st: L.st, label: TRACK_STATES[L.st] || L.say, say: L.say, eta: L.eta, link: L.link, ev: L.ev, at: L.t } : null });
      }
      if (p.startsWith("/sb/") && req.method === "GET") {
        const id = studioId(p.split("/")[2] || "");
        const b = id ? await dqBrand(env, id) : null;
        if (!b) return err(404, "Not found.");
        return new Response(JSON.stringify(b), { headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "public, max-age=60" } });
      }
      if (p.startsWith("/dq/understand/") && req.method === "POST") {
        const id = studioId(p.split("/")[3] || "");
        if (!id) return err(404, "Not found.");
        return dqUnderstand(env, id, req);
      }
      if (p.startsWith("/dq/read/") && req.method === "POST") {
        const id = studioId(p.split("/")[3] || "");
        if (!id) return err(404, "Not found.");
        return dqRead(env, id, req);
      }
      if (p.startsWith("/dq/write/") && req.method === "POST") {
        const id = studioId(p.split("/")[3] || "");
        if (!id) return err(404, "Not found.");
        return dqWrite(env, id, req);
      }
      if (/^\/dq\/[a-z0-9-]+$/.test(p) && !["/dq/list", "/dq/get", "/dq/status", "/dq/delete"].includes(p) && req.method === "POST") {
        const id = studioId(p.split("/")[2]);
        if (!id) return err(404, "Not found.");
        return dqSubmit(env, id, req, ctx);
      }
      if (p.startsWith("/enquire/") && req.method === "POST") {
        const site = p.split("/")[2];
        if (!/^[a-z0-9][a-z0-9-]{0,59}$/.test(site)) return err(404, "Not found.");
        const raw = await req.text();
        if (raw.length > 2e4) return err(413, "Too long.");
        const q = JSON.parse(raw || "{}");
        if (q.website || q.took != null && Number(q.took) < 1500 && !(q.data && q.data.order_no)) return json({ ok: true });
        const data = {};
        for (const [k, v] of Object.entries(q.data || {}).slice(0, 25)) if (/^[a-z0-9][\w-]{0,39}$/i.test(k) && v != null && String(v).trim()) data[k] = String(v).slice(0, 5e3);
        if (!Object.keys(data).length) return err(400, "The form was empty.");
        let who2 = "";
        if (data.order_no) {
          const sc0 = await siteContent(env, site).catch(() => null), cw = await codeWays(env, site, sc0), A = acctOf(env, sc0, cw);
          const me = await custWho(env, site, A, cw.cc, data.phone, data.email, data.acct_token);
          delete data.acct_token;
          who2 = me.key;
          if (me.kind === "phone") data._phone = "Verified (signed in)";
          if (me.kind === "email") data._email = "Verified (signed in)";
          if (cw.any && me.kind !== "phone") {
            const num = waNum(data.phone, cw.cc), [exp, sig, how] = String(data.otp_token || "").split(".");
            const proved = !!num && +exp > Date.now() && sig === b64u(await hmac(env.SECRET, "otp:" + site + ":" + num + ":" + exp));
            if (proved) data._phone = how === "s" ? "Verified by SMS" : "Verified on WhatsApp";
            else if (cw.need) return err(403, "Please verify your mobile number first.");
          }
          delete data.otp_token;
          {
            const em = emailKey(data.email), tk = String(data.email_token || "");
            delete data.email_token;
            const skip = tk.startsWith("s:"), [exp, sig] = (skip ? tk.slice(2) : tk).split("."), good = !!em && +exp > Date.now() && sig === b64u(await hmac(env.SECRET, (skip ? "eskip:" : "eotp:") + site + ":" + em + ":" + exp));
            if (em && me.kind !== "email" && emailCheckOn(env, sc0)) {
              if (!good) return err(403, "Please verify your email address first.");
              data._email = skip ? "Not verified: the code could not be sent" : "Verified by a code";
            }
            if (A && !who2 && !(A.email && good && skip)) return err(403, "Please sign in before placing the order.");
          }
          if (data.rz_order || data.rz_payment || data.rz_sig) {
            const z = await getSetting(env, "site:" + site, "rz").catch(() => null);
            const row = z?.secret ? await env.DB.prepare("select order_no, amount from payments where rz_order = ? and site = ?").bind(String(data.rz_order || ""), site).first() : null;
            const want = row ? hex((await hmac(z.secret, data.rz_order + "|" + data.rz_payment)).buffer) : "";
            if (!row || row.order_no !== data.order_no || !want || want !== String(data.rz_sig || "")) return err(400, "The payment couldn't be confirmed. If money left your account, contact us with your order number.");
            await env.DB.prepare("update payments set status = 'paid' where rz_order = ?").bind(data.rz_order).run();
            data._paid = "yes";
            data._paid_by = `Razorpay, \u20B9${(row.amount / 100).toFixed(2).replace(/\.00$/, "")}, ${String(data.rz_payment).slice(0, 40)}`;
            delete data.rz_sig;
          }
          if (data.pay_gw || data.pay_ref) {
            const g = String(data.pay_gw || ""), ref = String(data.pay_ref || ""), z = PG[g] && g !== "rz" && ref.startsWith(g + ":") ? await getSetting(env, "site:" + site, g).catch(() => null) : null;
            const row = pgReady(g, z) ? await env.DB.prepare("select order_no, amount, status from payments where rz_order = ? and site = ?").bind(ref, site).first() : null;
            if (!row || row.order_no !== data.order_no) return err(400, "The payment couldn't be confirmed. If money left your account, contact us with your order number.");
            if (row.status === "paid") return json({ ok: true, again: true });
            const cur = siteCur(await siteContent(env, site));
            let got;
            try {
              got = await pgCheck(g, z, ref.slice(3), row.amount, cur);
            } catch {
              return err(502, `We couldn't reach ${PG[g].name} to confirm the payment. Please try again in a moment.`);
            }
            if (!got.paid) return err(402, "The payment wasn't completed, so the order isn't placed yet. You can try again.");
            await env.DB.prepare("update payments set status = 'paid' where rz_order = ?").bind(ref).run();
            data._paid = "yes";
            data._paid_by = `${PG[g].name}, ${pgMoney(cur, row.amount)}, ${got.id.slice(0, 60)}`;
            data.pay_gw = PG[g].name;
            delete data.pay_ref;
          }
        }
        let lowNow = [], stockC = null;
        if (data.order_no && q.cart && typeof q.cart === "object") {
          stockC = await siteContent(env, site).catch(() => null);
          if (invOn(stockC)) {
            const paid = data._paid === "yes", tk = await stockTake(env, site, stockC, q.cart, String(data.order_no), paid);
            if (tk.short && !paid) return err(409, tk.short);
            if (tk.taken.length) data._stock = JSON.stringify(tk.taken);
            if (tk.short) data._stock_short = "Not enough stock when this paid order came in. " + tk.short.replace(/ (Change|Remove).*$/, "");
            lowNow = tk.low;
          }
        }
        if (data.order_no && q.cart && typeof q.cart === "object") q.cart._bal = data._phone && +q.cart.points > 0 ? Math.max(0, +(await env.DB.prepare("select points from customers where site = ? and ckey = ?").bind(site, waNum(data.phone, (await codeWays(env, site)).cc)).first())?.points || 0) : 0;
        if (data.order_no && q.cart && typeof q.cart === "object") {
          const pz = await getSetting(env, "site:" + site, "pos").catch(() => null);
          if (posReady(pz)) {
            const pc = await siteContent(env, site);
            if (isRest(pc)) data._pos = await posSend(env, site, pz, pc, q.cart, data, u.origin);
          }
        }
        if (data.order_no && q.cart) {
          try {
            const it = orderItems(await siteContent(env, site), q.cart);
            if (it.length) {
              const sc2 = await siteContent(env, site);
              if (isRest(sc2)) {
                const rb = restBill(sc2, q.cart);
                if (!("error" in rb) && rb.units && rb.units.length === it.length) {
                  it.forEach((x, i) => {
                    x.p = rb.units[i];
                  });
                  data._bill = JSON.stringify({ ...rb.parts, total: rb.total });
                }
              }
              data._items = JSON.stringify(it).slice(0, 6e3);
            }
          } catch {
          }
        }
        if (data.order_no) {
          const said = await custOrder(env, site, await siteContent(env, site), data, q.cart, who2).catch(() => "");
          if (said) data._points = said;
        }
        const made = await env.DB.prepare("insert into enquiries (site, data, page, created_at) values (?, ?, ?, ?) returning id").bind(site, JSON.stringify(data), String(q.page || "").slice(0, 200), (/* @__PURE__ */ new Date()).toISOString()).first();
        const rowId = made?.id;
        if (data.order_no && EMAIL_RE.test(String(data.email || ""))) await env.DB.prepare("update carts set status = 'recovered', order_no = ?, updated_at = ? where site = ? and ckey = ? and status != 'recovered'").bind(String(data.order_no).slice(0, 30), (/* @__PURE__ */ new Date()).toISOString(), site, recKey(String(data.email))).run().catch(() => {
        });
        if (lowNow.length) {
          const lm = stockLowMail(env, site, stockC, lowNow).catch(() => {
          });
          if (ctx?.waitUntil) ctx.waitUntil(lm);
          else await lm;
        }
        const mail = Promise.all([notifyEnquiry(env, site, data, String(q.page || "").slice(0, 200)).catch((e) => "Not emailed: " + String(e?.message || e).slice(0, 300)), waAlert(env, site, data).catch(() => ""), data.order_no ? orderMail(env, site, "placed", data).catch(() => "") : Promise.resolve("")]).then(([said, wa, om]) => (said || wa || om) && rowId ? env.DB.prepare("update enquiries set data = ? where id = ? and site = ?").bind(JSON.stringify({ ...data, ...said ? { _mail: said } : {}, ...wa ? { _wa: wa } : {}, ...om ? { _omail: om } : {} }), rowId, site).run() : null).catch(() => {
        });
        if (ctx?.waitUntil) ctx.waitUntil(mail);
        else await mail;
        return json({ ok: true });
      }
      if (p === "/reviews/google" && req.method === "POST") {
        const email2 = await who(env, req);
        if (!email2) return err(401, "Sign in first.");
        if (!await env.DB.prepare("select 1 from members where email = ? and role in ('owner', 'partner') limit 1").bind(email2).first()) return err(403, "Only owners can use this.");
        return json(await googleReviews(await req.json()));
      }
      if (p === "/ai/products" && req.method === "POST") {
        const email2 = await who(env, req);
        if (!email2) return err(401, "Sign in first.");
        if (!await env.DB.prepare("select 1 from members where email = ? and role in ('owner', 'partner') limit 1").bind(email2).first()) return err(403, "Only owners can use this.");
        if (!env.AI) return err(501, "Reading pamphlets needs the database updated once (from a device with the Cloudflare token).");
        return json(await readPamphlet(env, await req.json()));
      }
      if (p === "/ai/translate" && req.method === "POST") {
        const email2 = await who(env, req);
        if (!email2) return err(401, "Sign in first.");
        if (!await env.DB.prepare("select 1 from members where email = ? limit 1").bind(email2).first()) return err(403, "Only members can use this.");
        if (!env.AI) return json({ error: "Translating needs Workers AI on this database. Update the database once (Settings \u2192 Hostings)." });
        return json(await translateTexts(env, await req.json()));
      }
      if (p === "/ai/look" && req.method === "POST") {
        const email2 = await who(env, req);
        if (!email2) return err(401, "Sign in first.");
        if (!await env.DB.prepare("select 1 from members where email = ? limit 1").bind(email2).first()) return err(403, "Only members can use this.");
        return json(await lookAt(String((await req.json()).url || "")));
      }
      if (p === "/ai/outline" && req.method === "POST") {
        const email2 = await who(env, req);
        if (!email2) return err(401, "Sign in first.");
        if (!await env.DB.prepare("select 1 from members where email = ? and role in ('owner', 'partner') limit 1").bind(email2).first()) return err(403, "Only owners can use this.");
        const q = await req.json(), u2 = publicUrl(String(q?.url || "").trim());
        if (!u2) return json({ error: "Enter the site's public address (https://\u2026)." });
        let r2;
        try {
          r2 = await fetch(u2.href, { headers: { "User-Agent": "Mozilla/5.0 (site-studio reference reader)", Accept: "text/html" }, redirect: "follow" });
        } catch {
          return json({ error: "Couldn't open that address." });
        }
        if (!r2.ok) return json({ error: `That site answered ${r2.status}.` });
        return json({ text: outlineOf((await r2.text()).slice(0, 3e6)).slice(0, 2e4) });
      }
      if ((p === "/ai/pictures" || p === "/ai/picture") && req.method === "POST") {
        const email2 = await who(env, req);
        if (!email2) return err(401, "Sign in first.");
        if (!await env.DB.prepare("select 1 from members where email = ? and role in ('owner', 'partner') limit 1").bind(email2).first()) return err(403, "Only owners can use this.");
        const q = await req.json(), u2 = publicUrl(String(q?.url || "").trim());
        if (!u2) return json({ error: "Enter the site's public address (https://\u2026)." });
        let r2;
        try {
          r2 = await fetch(u2.href, { headers: { "User-Agent": "Mozilla/5.0 (site-studio reference reader)", Accept: p === "/ai/picture" ? "image/*" : "text/html" }, redirect: "follow" });
        } catch {
          return json({ error: "Couldn't open that address." });
        }
        if (!r2.ok) return json({ error: `That site answered ${r2.status}.` });
        if (p === "/ai/picture") {
          const type = (r2.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
          if (!/^image\/(jpeg|png|webp|gif|avif)$/.test(type)) return json({ error: "That address isn't a picture the site can use (JPG, PNG, WebP, GIF or AVIF)." });
          const buf = await r2.arrayBuffer();
          if (buf.byteLength > 6 * 1024 * 1024) return json({ error: "That picture is over 6 MB." });
          return new Response(buf, { headers: { ...cors, "Content-Type": type, "Cache-Control": "no-store" } });
        }
        return json({ pictures: picturesOf((await r2.text()).slice(0, 3e6), u2) });
      }
      if (p === "/ai/write" && req.method === "POST") {
        const email2 = await who(env, req);
        if (!email2) return err(401, "Sign in first.");
        if (!await env.DB.prepare("select 1 from members where email = ? and role in ('owner', 'partner') limit 1").bind(email2).first()) return err(403, "Only owners can use this.");
        if (!env.AI) return err(501, "Writing needs the database updated once (Settings \u2192 Hosting accounts, from a device with the Cloudflare token).");
        return json(await writeSite(env, await req.json()));
      }
      const email = await who(env, req);
      if (!email) return err(401, "Sign in first.");
      const scope = u.searchParams.get("scope") || "";
      if (!scopeOk(scope)) return err(400, "Unknown scope.");
      const role = await roleOf(env, scope, email);
      if (!role) return err(403, `${email} isn't a member of this ${scope.startsWith("site:") ? "site" : "Studio"}.`);
      if (p === "/set" || p === "/set/test" || p === "/set/wa" || p === "/set/sms") {
        if (role !== "owner") return err(403, "Only an owner can change connections.");
        if (p === "/set/sms" && req.method === "POST") {
          const b2 = await req.json(), z = await getSetting(env, scope, "sms"), to = waNum(b2.to, z?.cc);
          if (!smsReady(z)) return json({ error: "Switch SMS on, fill in the boxes and press Save first." });
          if (!to) return json({ error: "Enter the mobile number to send the test to." });
          try {
            const own = !await smsSend(z, to, "123456", env.NAME || "your site");
            return json({ ok: true, own });
          } catch (e) {
            return json({ error: String(e?.message || e).slice(0, 300) });
          }
        }
        if (p === "/set/wa" && req.method === "POST") {
          const b2 = await req.json(), old2 = await getSetting(env, scope, "wa") || {}, token = String(b2.token || "").trim() || String(old2.token || "");
          if (!token) return json({ error: "Paste the access token first." });
          if (b2.do === "find") {
            const f = await waFind(token, String(b2.waba || old2.waba || "").trim());
            if (f.wabas.length && String(b2.token || "").trim()) await putSetting(env, scope, "wa", { ...old2, token });
            return json(f);
          }
          if (b2.do === "templates") {
            const waba = String(b2.waba || old2.waba || "").trim();
            if (!/^\d{6,20}$/.test(waba)) return json({ error: "Which WhatsApp account? Press Connect first." });
            const lang = String(b2.lang || old2.lang || "en").trim() || "en", out = [];
            for (const k of (Array.isArray(b2.make) ? b2.make : []).filter((x) => WA_TPL[x]).slice(0, 3)) {
              const t = WA_TPL[k](lang);
              try {
                const r = await graph(token, `/${waba}/message_templates`, { method: "POST", body: t });
                out.push({ kind: k, name: t.name, status: String(r?.status || "PENDING") });
              } catch (e) {
                out.push({ kind: k, name: t.name, .../already exists|2388024/i.test(String(e?.message) + e?.code) ? { status: "EXISTS" } : { error: String(e?.message || e).slice(0, 240) } });
              }
            }
            return json({ made: out });
          }
          if (b2.do === "test") {
            const to = waNum(b2.to, old2.cc), tpl = String(b2.tpl || old2.tplOtp || "").trim(), phoneId = String(b2.phoneId || old2.phoneId || "").trim();
            if (!to) return json({ error: "Enter the WhatsApp number to send the test to." });
            if (!tpl || !phoneId) return json({ error: "Choose the number to send from and the template for codes first." });
            try {
              await waSend({ token, phoneId, lang: b2.lang || old2.lang }, to, tpl, ["123456"], "123456");
              return json({ ok: true });
            } catch (e) {
              return json({ error: String(e?.message || e).slice(0, 300) });
            }
          }
          return err(400, "Unknown step.");
        }
        if (p === "/set" && req.method === "GET") {
          const o = {};
          for (const n of Object.keys(SETTINGS)) o[n] = maskSetting(n, await getSetting(env, scope, n));
          return json(o);
        }
        const b = await req.json(), name = String(b.name || ""), S2 = SETTINGS[name];
        if (!S2) return err(400, "Unknown connection.");
        if (p === "/set/test" && name.startsWith("tk_")) {
          const id = name.slice(3), z = await getSetting(env, scope, name);
          if (!trackerReady(id, { ...z, on: true })) return json({ error: "Fill in the boxes and press Save first." });
          try {
            const live = await trackLive(id, z, String(b.awb || ""), String(b.courier || (TRACKERS[id].kind === "courier" ? id : "other")));
            return json({ ok: true, live: { st: live.st, label: TRACK_STATES[live.st] || live.say, say: live.say, eta: live.eta, ev: live.ev.slice(0, 5), n: live.ev.length } });
          } catch (e) {
            return json({ error: e instanceof TrackError ? e.message : "The tracking service's answer couldn't be read." });
          }
        }
        if (p === "/set/test") {
          if (name !== "ai") return err(400, "Nothing to test.");
          const c = await getSetting(env, scope, "ai");
          if (!c?.key || !c.model || !publicUrl(String(c.base || "").trim())) return json({ error: "Fill in the address, the model and the key first." });
          try {
            const r = await customAI(c).run("", { messages: [{ role: "user", content: "Reply with the single word: ready" }], max_tokens: 20, temperature: 0 });
            return json({ ok: true, said: String(r.response || "").trim().slice(0, 80) });
          } catch (e) {
            return json({ error: String(e?.message || e).slice(0, 300) });
          }
        }
        if (b.value == null) {
          await putSetting(env, scope, name, null);
          return json({ ok: true });
        }
        if (name === "mail" && !scope.startsWith("site:")) return err(400, "Site email is set per site.");
        const old = await getSetting(env, scope, name) || {}, v = {};
        for (const k of S2.text) v[k] = String(b.value[k] ?? old[k] ?? "").slice(0, 3e3).trim();
        for (const k of S2.flags) v[k] = b.value[k] == null ? !!old[k] : !!b.value[k];
        for (const k of S2.secret) v[k] = String(b.value[k] || "").trim().slice(0, 600) || old[k] || "";
        if (name === "mail") {
          const so = await env.DB.prepare("select 1 x from members where email = ? and scope like 'studio:%' and role = 'owner' limit 1").bind(email).first();
          const hasStudio = await env.DB.prepare("select 1 x from members where scope like 'studio:%' limit 1").first();
          if (!so && hasStudio && v.on !== !!old.on) return err(403, `Only the Studio's owner can switch this site's Resend. You are signed in as ${email}, who isn't an owner of this database's Studio. Sign in to the Studio with its owner's email.`);
          if (v.from && !EMAIL_RE.test(v.from.replace(/^.*<([^<>]+)>\s*$/, "$1"))) return err(400, "The sender should look like Name <codes@your-domain.com>.");
          if (v.key && !/^re_\S{8,}$/.test(v.key)) return err(400, "A Resend API key starts with re_.");
        }
        if (name === "ai" && v.base && !publicUrl(v.base)) return err(400, "The API address must be a public https:// address.");
        if (name.startsWith("tk_") && v.url && !publicUrl(v.url.replace(/\{(awb|courier)\}/g, "x"))) return err(400, "The tracking address must be a public https:// address.");
        await putSetting(env, scope, name, v);
        return json({ ok: true, value: maskSetting(name, v) });
      }
      if (p === "/f/list") {
        const pre = u.searchParams.get("prefix") || "";
        const rows = (await env.DB.prepare("select path from files where scope = ? and substr(path, 1, ?) = ? order by path").bind(scope, pre.length, pre).all()).results || [];
        return json(rows.map((r) => r.path));
      }
      const path = u.searchParams.get("path") || "";
      if (p === "/f/meta") {
        const f = await env.DB.prepare("select sha, size, updated_at from files where scope = ? and path = ?").bind(scope, path).first();
        return json(f || null);
      }
      if (p === "/f/get") {
        const f = await readFile(env, scope, path);
        if (!f) return err(404, "Not found.");
        return new Response(f.bytes, { headers: { ...cors, "Content-Type": f.type || typeOf(path), "x-sha": f.sha, "x-updated": f.updated_at } });
      }
      if (p === "/f/put" && req.method === "PUT") {
        if (!pathOk(path)) return err(400, "Bad file name.");
        const want = u.searchParams.get("sha");
        if (want) {
          const cur = await env.DB.prepare("select sha from files where scope = ? and path = ?").bind(scope, path).first();
          if (cur && cur.sha !== want) return err(409, "The file changed since it was loaded.");
        }
        const sha = await writeFile(env, scope, path, new Uint8Array(await req.arrayBuffer()), req.headers.get("x-sha") || void 0);
        return json({ sha });
      }
      if (p === "/f/delete" && req.method === "POST") {
        const { paths } = await req.json();
        const list = (Array.isArray(paths) ? paths : []).filter(pathOk).slice(0, 500);
        await env.DB.batch(list.flatMap((x) => [env.DB.prepare("delete from chunks where scope = ? and path = ?").bind(scope, x), env.DB.prepare("delete from files where scope = ? and path = ?").bind(scope, x)]));
        return json({ ok: true, n: list.length });
      }
      if (p.startsWith("/cfx")) {
        if (!scope.startsWith("studio:")) return err(400, "Only for the Studio's own scope.");
        if (role !== "owner" && role !== "partner") return err(403, "Only the Studio's owners can change its hosting accounts.");
        const keepSecret = async (name, text) => {
          if (!env.CF_TOKEN || !env.CF_ACCOUNT) return err(409, "Turn on Publish from any device first (Settings), so the database can keep tokens itself.");
          const base = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT}/workers/scripts/${CFDB_WORKER_NAME}/secrets`;
          const r = text == null ? await fetch(base + "/" + name, { method: "DELETE", headers: { Authorization: "Bearer " + env.CF_TOKEN } }) : await fetch(base, { method: "PUT", headers: { Authorization: "Bearer " + env.CF_TOKEN, "Content-Type": "application/json" }, body: JSON.stringify({ name, text, type: "secret_text" }) });
          if (!r.ok && !(text == null && r.status === 404)) return err(502, "Cloudflare didn't keep it: " + ((await r.json().catch(() => null))?.errors?.[0]?.message || r.status));
          return null;
        };
        if (p === "/cfx" && req.method === "GET") return json({
          main: env.CF_TOKEN && env.CF_ACCOUNT ? env.CF_ACCOUNT : null,
          accounts: otherAccounts(env),
          // Sites every device can publish: "<worker>" on the main account, "<account>/<worker>" on another.
          workers: ((await env.DB.prepare("select worker from workers where scope = ? limit 500").bind(scope).all()).results || []).map((r) => String(r.worker).split("@")[0])
        });
        if (p === "/cfx/put" && req.method === "POST") {
          const b = await req.json(), token = String(b.token || "").trim();
          if (!/^[\w-]{20,200}$/.test(token)) return err(400, "Paste the account's Cloudflare API token.");
          const r = await fetch("https://api.cloudflare.com/client/v4/accounts?per_page=50", { headers: { Authorization: "Bearer " + token } });
          const list = (await r.json().catch(() => null))?.result || [];
          if (!r.ok || !list.length) return err(400, "Cloudflare didn't accept that token, or it can't see any account. Create it while signed in to that account.");
          const kept = [];
          for (const a of list) {
            if (!/^[\w-]{1,64}$/.test(String(a.id)) || a.id === env.CF_ACCOUNT) continue;
            const bad = await keepSecret("CFX_" + String(a.id).replace(/-/g, "_"), JSON.stringify({ t: token, n: String(a.name || "").slice(0, 80) }));
            if (bad) return bad;
            kept.push({ id: a.id, name: String(a.name || "") });
          }
          if (!kept.length) return err(400, "That token is for the Studio's own Cloudflare account, which is already used.");
          return json({ ok: true, accounts: kept });
        }
        if (p === "/cfx/delete" && req.method === "POST") {
          const a = String((await req.json()).account || "");
          if (!/^[\w-]{1,64}$/.test(a)) return err(400, "Which account?");
          return await keepSecret("CFX_" + a.replace(/-/g, "_"), null) || json({ ok: true });
        }
        if (p === "/cfx/site" && req.method === "POST") {
          const b = await req.json(), a = String(b.account || ""), w = String(b.worker || "");
          if (!/^[\w-]{1,64}$/.test(a) || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(w)) return err(400, "Which site?");
          const main = a === env.CF_ACCOUNT;
          if (!main && !otherToken(env, a)) return err(409, "That Cloudflare account isn't kept here yet: add it first.");
          await env.DB.prepare("insert into workers (worker, scope) values (?, ?) on conflict (worker) do update set scope = excluded.scope").bind(main ? w : a + "/" + w + "@" + scope, scope).run();
          const site = String(b.site || "");
          if (/^[a-z0-9][a-z0-9-]{0,62}$/.test(site)) await env.DB.prepare("insert into workers (worker, scope) values (?, ?) on conflict (worker) do update set scope = excluded.scope").bind(main ? w : a + "/" + w + "@site:" + site, "site:" + site).run();
          return json({ ok: true });
        }
        if (p === "/cfx/db" && req.method === "POST") {
          const b = await req.json(), a = String(b.account || ""), site = String(b.site || ""), op = String(b.op || "");
          if (!/^[\w-]{1,64}$/.test(a) || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(site)) return err(400, "Which site?");
          const tok = otherToken(env, a) || (a === env.CF_ACCOUNT ? env.CF_TOKEN || "" : "");
          if (!tok) return err(409, "That Cloudflare account isn't kept here yet: add it in Settings \u2192 Sites and hosting accounts.");
          const cfa = async (path3, init = {}) => {
            const r = await fetch("https://api.cloudflare.com/client/v4/accounts/" + a + path3, { ...init, headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json" } });
            const j = await r.json().catch(() => null);
            if (!r.ok || !j?.success) {
              const e = new Error(j?.errors?.[0]?.message || "Cloudflare answered " + r.status);
              e.cf = true;
              throw e;
            }
            return j.result;
          };
          let dbId = String(b.db || "");
          const q = async (sql, params = []) => (await cfa(`/d1/database/${dbId}/query`, { method: "POST", body: JSON.stringify({ sql, params }) }))?.[0]?.results || [];
          const bytesOf = (v) => Array.isArray(v) ? new Uint8Array(v) : typeof v === "string" ? Uint8Array.from(atob(v), (c) => c.charCodeAt(0)) : v && Array.isArray(v.data) ? new Uint8Array(v.data) : new Uint8Array(0);
          const hex3 = (u2) => {
            let s = "";
            for (let i = 0; i < u2.length; i++) s += (u2[i] < 16 ? "0" : "") + u2[i].toString(16);
            return s;
          };
          const b64 = (u2) => {
            let s = "";
            for (let i = 0; i < u2.length; i += 32768) s += String.fromCharCode(...u2.subarray(i, i + 32768));
            return btoa(s);
          };
          const S2 = "site:" + site, path2 = String(b.path || "");
          try {
            if (!/^[\w-]{1,64}$/.test(dbId)) {
              const list = await cfa(`/d1/database?name=${encodeURIComponent(CFDB_WORKER_NAME)}`) || [];
              dbId = String(list.find((d) => d.name === CFDB_WORKER_NAME)?.uuid || "");
              if (!dbId) return err(404, "No Studio database on that Cloudflare account.");
            }
            if (op === "list") {
              const pre = String(b.prefix || "");
              return json({ db: dbId, paths: (await q("select path from files where scope = ? and substr(path, 1, ?) = ? order by path", [S2, pre.length, pre])).map((r) => r.path) });
            }
            if (op === "meta") return json({ db: dbId, meta: (await q("select sha, updated_at from files where scope = ? and path = ?", [S2, path2]))[0] || null });
            if (op === "get") {
              if (!pathOk(path2)) return err(400, "Bad file name.");
              const f = (await q("select sha, size, type, updated_at from files where scope = ? and path = ?", [S2, path2]))[0];
              if (!f) return json({ db: dbId, file: null });
              const parts = (await q("select data from chunks where scope = ? and path = ? order by n", [S2, path2])).map((r) => bytesOf(r.data));
              const all = new Uint8Array(parts.reduce((x, y) => x + y.length, 0));
              let o = 0;
              for (const x of parts) {
                all.set(x, o);
                o += x.length;
              }
              return json({ db: dbId, file: { b64: b64(all), sha: f.sha, type: f.type, updated_at: f.updated_at } });
            }
            if (op === "put") {
              if (!pathOk(path2)) return err(400, "Bad file name.");
              const bytes = bytesOf(String(b.b64 || ""));
              if (b.sha) {
                const cur = (await q("select sha from files where scope = ? and path = ?", [S2, path2]))[0];
                if (cur && cur.sha !== String(b.sha)) return err(409, "The file changed since it was loaded.");
              }
              const s = "c" + await sha1(bytes);
              let size = 7e5, n = Math.max(1, Math.ceil(bytes.length / size)), lit = false;
              const putChunk = async (i) => {
                const part = bytes.slice(i * size, (i + 1) * size);
                if (lit) await q(`insert into chunks (scope, path, n, data) values (?, ?, ?, X'${hex3(part)}') on conflict (scope, path, n) do update set data = excluded.data`, [S2, path2, i]);
                else await q("insert into chunks (scope, path, n, data) values (?, ?, ?, unhex(?)) on conflict (scope, path, n) do update set data = excluded.data", [S2, path2, i, hex3(part)]);
              };
              try {
                for (let i = 0; i < n; i++) await putChunk(i);
              } catch (e) {
                if (!/unhex|no such function/i.test(String(e?.message))) throw e;
                lit = true;
                size = 4e4;
                n = Math.max(1, Math.ceil(bytes.length / size));
                for (let i = 0; i < n; i++) await putChunk(i);
              }
              await q("insert into files (scope, path, sha, size, parts, type, updated_at) values (?, ?, ?, ?, ?, ?, ?) on conflict (scope, path) do update set sha = excluded.sha, size = excluded.size, parts = excluded.parts, type = excluded.type, updated_at = excluded.updated_at", [S2, path2, s, bytes.length, n, typeOf(path2), (/* @__PURE__ */ new Date()).toISOString()]);
              await q("delete from chunks where scope = ? and path = ? and n >= ?", [S2, path2, n]);
              return json({ db: dbId, sha: s });
            }
            if (op === "enq") {
              const sub = String(b.sub || "list");
              if (sub === "list") return json({ db: dbId, rows: (await q("select id, site, data, page, status, created_at from enquiries where site = ? order by created_at desc limit 500", [site])).map((r) => {
                let d = {};
                try {
                  d = JSON.parse(r.data);
                } catch {
                }
                return { ...r, data: d };
              }) });
              const id = Number(b.id);
              if (!Number.isInteger(id)) return err(400, "Which enquiry?");
              if (sub === "paid") {
                const rw = (await q("select data from enquiries where id = ? and site = ?", [id, site]))[0];
                if (!rw) return err(404, "Not found.");
                const d = JSON.parse(rw.data);
                if (!d.order_no) return err(400, "That isn't an order.");
                if (b.paid) d._paid = "yes";
                else delete d._paid;
                await q("update enquiries set data = ? where id = ? and site = ?", [JSON.stringify(d), id, site]);
                return json({ db: dbId, ok: true });
              }
              if (sub === "status") {
                const st = String(b.status || "");
                if (!["new", "read", "replied", "archived", "accepted", "preparing", "ready", "out", "done", "cancelled"].includes(st)) return err(400, "Unknown status.");
                await q("update enquiries set status = ? where id = ? and site = ?", [st, id, site]);
                return json({ db: dbId, ok: true });
              }
              if (sub === "delete") {
                await q("delete from enquiries where id = ? and site = ?", [id, site]);
                return json({ db: dbId, ok: true });
              }
              return err(400, "Unknown operation.");
            }
            if (op === "mem") {
              const sub = String(b.sub || "list");
              if (sub === "list") return json({ db: dbId, rows: await q("select email, role from members where scope = ? order by email", [S2]) });
              const e = String(b.email || "").trim().toLowerCase();
              if (!emailOk(e)) return err(400, "Enter a valid email.");
              if (sub === "add") {
                await q("insert into members (scope, email, role) values (?, ?, 'owner') on conflict (scope, email) do nothing", [S2, e]);
                return json({ db: dbId, ok: true });
              }
              if (sub === "remove") {
                await q("delete from members where scope = ? and email = ?", [S2, e]);
                return json({ db: dbId, ok: true });
              }
              return err(400, "Unknown operation.");
            }
            if (op === "mail") {
              if (!/^re_\S{8,}$/.test(String(b.key || ""))) return err(400, "That doesn't look like a Resend API key (it starts with re_).");
              const from = String(b.from || "").trim();
              if (!/^[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+$|<[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+>$/.test(from)) return err(400, "Enter a sender like Name <hello@your-domain.com>.");
              await q("create table if not exists settings (scope text not null, name text not null, value text not null, updated_at text not null, primary key (scope, name))");
              await q("insert into settings (scope, name, value, updated_at) values (?, 'mail!pending', ?, ?) on conflict (scope, name) do update set value = excluded.value, updated_at = excluded.updated_at", [S2, JSON.stringify({ key: String(b.key), from }), (/* @__PURE__ */ new Date()).toISOString()]);
              return json({ db: dbId, ok: true });
            }
            if (op === "delete") {
              const list = (Array.isArray(b.paths) ? b.paths : []).filter(pathOk).slice(0, 200);
              for (const x of list) {
                await q("delete from chunks where scope = ? and path = ?", [S2, x]);
                await q("delete from files where scope = ? and path = ?", [S2, x]);
              }
              return json({ db: dbId, n: list.length });
            }
            return err(400, "Unknown operation.");
          } catch (e) {
            return err(502, "Couldn't reach the site's database on its Cloudflare account: " + (e?.message || e));
          }
        }
        if (p === "/cfx/import" && req.method === "POST") {
          const b = await req.json(), a = String(b.account || ""), site = String(b.site || ""), step = String(b.step || "start");
          if (!/^[\w-]{1,64}$/.test(a) || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(site)) return err(400, "Which site?");
          const tok = otherToken(env, a);
          if (!tok) return err(409, "That Cloudflare account isn't kept here yet: add it first (Settings \u2192 Sites and hosting accounts).");
          const cfa = async (path2, init = {}) => {
            const r = await fetch("https://api.cloudflare.com/client/v4/accounts/" + a + path2, { ...init, headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json" } });
            const j = await r.json().catch(() => null);
            if (!r.ok || !j?.success) throw new Error(j?.errors?.[0]?.message || "Cloudflare answered " + r.status);
            return j.result;
          };
          const q = async (dbId, sql, params) => (await cfa(`/d1/database/${dbId}/query`, { method: "POST", body: JSON.stringify({ sql, params }) }))?.[0]?.results || [];
          const bytesOf = (v) => Array.isArray(v) ? new Uint8Array(v) : typeof v === "string" ? Uint8Array.from(atob(v), (c) => c.charCodeAt(0)) : v && Array.isArray(v.data) ? new Uint8Array(v.data) : new Uint8Array(0);
          const S2 = "site:" + site;
          try {
            if (step === "start") {
              const list = await cfa(`/d1/database?name=${encodeURIComponent(CFDB_WORKER_NAME)}`) || [];
              const dbId = String(list.find((d) => d.name === CFDB_WORKER_NAME)?.uuid || "");
              if (!dbId) return err(404, "No Studio database on that Cloudflare account.");
              const files = await q(dbId, "select path, sha, size, parts, type, updated_at from files where scope = ? order by path", [S2]);
              if (!files.some((f) => f.path === "content.json")) return err(404, `The site ${site} has no content in that database.`);
              const mem = await q(dbId, "select email, role from members where scope = ?", [S2]);
              for (const m of mem) if (emailOk(String(m.email || ""))) await env.DB.prepare("insert into members (scope, email, role) values (?, ?, ?) on conflict (scope, email) do nothing").bind(S2, String(m.email).toLowerCase(), ["owner", "member", "partner"].includes(m.role) ? m.role : "member").run();
              let enquiries = 0;
              if (!await env.DB.prepare("select 1 from enquiries where site = ? limit 1").bind(site).first()) {
                const rows = await q(dbId, "select data, page, status, created_at from enquiries where site = ? order by created_at limit 1000", [site]);
                for (const r of rows) await env.DB.prepare("insert into enquiries (site, data, page, status, created_at) values (?, ?, ?, ?, ?)").bind(site, String(r.data || "{}"), String(r.page || ""), String(r.status || "new"), String(r.created_at || (/* @__PURE__ */ new Date()).toISOString())).run();
                enquiries = rows.length;
              }
              return json({ db: dbId, files: files.map((f) => f.path), editors: mem.length, enquiries });
            }
            if (step === "file") {
              const dbId = String(b.db || ""), path2 = String(b.path || "");
              if (!/^[\w-]{1,64}$/.test(dbId) || !pathOk(path2)) return err(400, "Which file?");
              const f = (await q(dbId, "select sha, size, parts, type, updated_at from files where scope = ? and path = ?", [S2, path2]))[0];
              if (!f) return json({ ok: false, missing: path2 });
              const chunks = await q(dbId, "select n, data from chunks where scope = ? and path = ? order by n", [S2, path2]);
              await env.DB.batch([
                env.DB.prepare("delete from chunks where scope = ? and path = ?").bind(S2, path2),
                env.DB.prepare("insert into files (scope, path, sha, size, parts, type, updated_at) values (?, ?, ?, ?, ?, ?, ?) on conflict (scope, path) do update set sha = excluded.sha, size = excluded.size, parts = excluded.parts, type = excluded.type, updated_at = excluded.updated_at").bind(S2, path2, String(f.sha), Number(f.size) || 0, chunks.length || 1, String(f.type || ""), String(f.updated_at || (/* @__PURE__ */ new Date()).toISOString())),
                ...chunks.map((c) => env.DB.prepare("insert into chunks (scope, path, n, data) values (?, ?, ?, ?)").bind(S2, path2, Number(c.n) || 0, bytesOf(c.data)))
              ]);
              return json({ ok: true });
            }
          } catch (e) {
            return err(502, "Couldn't read the other account's database: " + (e?.message || e));
          }
          return err(400, "Unknown step.");
        }
        return err(404, "Not found.");
      }
      if (p === "/cfa/accounts" || p === "/cfa") {
        if (!scope.startsWith("studio:")) return err(400, "Only for the Studio's own scope.");
        if (role !== "owner") return err(403, "Only the Studio's owners can use its Cloudflare accounts.");
        const tokenFor = (a) => otherToken(env, a) || (a && a === env.CF_ACCOUNT ? env.CF_TOKEN || "" : "");
        if (p === "/cfa/accounts" && req.method === "GET") {
          const ids = [...env.CF_TOKEN && env.CF_ACCOUNT ? [env.CF_ACCOUNT] : [], ...otherAccounts(env).map((x) => x.id)];
          const out = [];
          for (const id of ids) {
            if (out.some((x) => x.id === id)) continue;
            let name = otherAccounts(env).find((x) => x.id === id)?.name || "";
            if (!name) {
              try {
                const r = await fetch("https://api.cloudflare.com/client/v4/accounts/" + id, { headers: { Authorization: "Bearer " + tokenFor(id) } });
                name = String((await r.json().catch(() => null))?.result?.name || "");
              } catch {
              }
            }
            out.push({ id, name: (name || "Cloudflare account " + id.slice(0, 6)).slice(0, 80) });
          }
          return json({ accounts: out, main: env.CF_TOKEN && env.CF_ACCOUNT ? env.CF_ACCOUNT : null });
        }
        if (p === "/cfa" && req.method === "POST") {
          const q = await req.json(), method = String(q.method || "GET").toUpperCase(), path2 = String(q.path || "");
          if (!/^\/[\w\-./?=&%:,]*$/.test(path2) || path2.includes("..") || !["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) return err(400, "Not a Cloudflare call the Studio makes.");
          const inAcc = /^\/accounts\/([\w-]{1,64})\/(workers|d1)\//.exec(path2), zone = /^\/zones(\/|\?|$)/.test(path2);
          if (!inAcc && !zone) return err(403, "The database only passes on calls about Workers, D1 and domains.");
          const A = inAcc ? inAcc[1] : /^[\w-]{1,64}$/.test(String(q.acct || "")) ? String(q.acct) : env.CF_ACCOUNT || "";
          const tok = tokenFor(A);
          if (!tok) return err(501, "No Cloudflare token for that account is kept on this database. Connect it once on a device (Settings \u2192 Hostings) and turn on Publish from any device.");
          const jwt = /^\/accounts\/[\w-]+\/workers\/assets\/upload/.test(path2) && /^[\w.~+/=-]{8,4096}$/.test(String(q.jwt || "")) ? String(q.jwt) : "";
          const body = q.body64 ? Uint8Array.from(atob(String(q.body64)), (c) => c.charCodeAt(0)) : q.body != null ? String(q.body) : void 0;
          const r = await fetch("https://api.cloudflare.com/client/v4" + path2, { method, headers: { Authorization: "Bearer " + (jwt || tok), ...q.contentType ? { "Content-Type": String(q.contentType) } : {} }, body: method === "GET" ? void 0 : body });
          return json({ status: r.status, body: await r.text() });
        }
        return err(404, "Not found.");
      }
      if (p === "/cf" && req.method === "POST") {
        if (role !== "owner" && role !== "partner") return err(403, "Only the owners of this site can publish it.");
        const q = await req.json(), method = String(q.method || "GET").toUpperCase(), path2 = String(q.path || "");
        const A = (/^\/accounts\/([\w-]+)\//.exec(path2) || [])[1] || env.CF_ACCOUNT || "";
        const tokenOf = otherToken(env, A) || (A === env.CF_ACCOUNT ? env.CF_TOKEN : "");
        if (!tokenOf) return err(501, "This database can't publish there: no Cloudflare token for that account is kept here.");
        const main = A === env.CF_ACCOUNT;
        const ACC = "/accounts/" + A + "/workers";
        let worker = "", useJwt = false, m;
        if (method === "GET" && path2 === ACC + "/subdomain") {
        } else if (method === "POST" && path2 === ACC + "/assets/upload?base64=true") useJwt = true;
        else if ((m = path2.match(/^\/accounts\/([\w-]+)\/workers\/scripts\/([a-z0-9][a-z0-9-]{0,62})(\/settings|\/assets-upload-session|\/subdomain|\?force=true)?$/)) && m[1] === A && (method === "GET" && m[3] === "/settings" || method === "POST" && (m[3] === "/assets-upload-session" || m[3] === "/subdomain") || method === "PUT" && !m[3] || method === "DELETE" && m[3] === "?force=true")) worker = m[2];
        else return err(403, "Not something publishing needs.");
        if (worker && !await env.DB.prepare("select 1 from workers where worker = ? and scope = ?").bind(main ? worker : A + "/" + worker + "@" + scope, scope).first()) return err(403, `The Worker ${worker} isn't registered to ${scope}. Publish once from a device with the Cloudflare token.`);
        const body = q.body64 ? Uint8Array.from(atob(String(q.body64)), (c) => c.charCodeAt(0)) : q.body != null ? String(q.body) : void 0;
        if (method === "PUT") {
          const text = typeof body === "string" ? body : new TextDecoder().decode(body);
          const mm = /name="metadata"[^\r\n]*\r\n(?:[^\r\n]+\r\n)*\r\n(\{[\s\S]*?\})\r\n--/.exec(text);
          let meta = null;
          try {
            meta = mm ? JSON.parse(mm[1]) : null;
          } catch {
            meta = null;
          }
          if (!meta || !Array.isArray(meta.bindings) || meta.bindings.some((x) => x?.type !== "assets") || meta.keep_bindings) return err(403, "A site's Worker can only be given its own files.");
        }
        if (useJwt && !/^[\w.~+/=-]{8,4096}$/.test(String(q.jwt || ""))) return err(400, "Missing upload token.");
        const r = await fetch("https://api.cloudflare.com/client/v4" + path2, { method, headers: { Authorization: "Bearer " + (useJwt ? q.jwt : tokenOf), ...q.contentType ? { "Content-Type": String(q.contentType) } : {} }, body: method === "GET" ? void 0 : body });
        return json({ status: r.status, body: await r.text() });
      }
      if (p === "/gh" && req.method === "POST") {
        if (!env.GH_TOKEN) return err(501, "This database can't reach GitHub: no GitHub token is kept here.");
        if (role !== "owner" && role !== "partner") return err(403, "Only this Studio's owners can publish its GitHub sites.");
        const q = await req.json(), repo = String(q.repo || "").toLowerCase(), path2 = String(q.path || ""), method = String(q.method || "GET").toUpperCase();
        if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || path2 && !/^\/[\w\-./%?=&,~]*$/.test(path2) || path2.includes("..") || !["GET", "PUT", "POST", "PATCH", "DELETE"].includes(method)) return err(400, "Not a GitHub call publishing needs.");
        if (!await env.DB.prepare("select 1 from repos where repo = ? and scope = ?").bind(repo, scope).first()) return err(403, `The repository ${repo} isn't registered to ${scope}. Turn on Publish from any device again from a Studio that has the GitHub token.`);
        const r = await fetch("https://api.github.com/repos/" + repo + path2, { method, headers: { Authorization: "Bearer " + env.GH_TOKEN, Accept: q.raw ? "application/vnd.github.raw+json" : "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "site-studio-db", ...q.body != null ? { "Content-Type": "application/json" } : {} }, body: method === "GET" ? void 0 : q.body != null ? String(q.body) : void 0 });
        const bytes = new Uint8Array(await r.arrayBuffer());
        let bin = "";
        for (let i = 0; i < bytes.length; i += 32768) bin += String.fromCharCode(...bytes.subarray(i, i + 32768));
        return json({ status: r.status, b64: btoa(bin), type: r.headers.get("content-type") || "" });
      }
      if (p === "/m") return json((await env.DB.prepare("select email, role, added_at from members where scope = ? order by email").bind(scope).all()).results || []);
      if (p === "/m/add" && req.method === "POST") {
        if (role !== "owner" && role !== "partner") return err(403, "Only owners can add people.");
        const b = await req.json();
        const e = String(b.email || "").trim().toLowerCase(), r = ["owner", "member", "partner"].includes(b.role) ? b.role : "member";
        if (!emailOk(e)) return err(400, "Enter a valid email.");
        await env.DB.prepare("insert into members (scope, email, role) values (?, ?, ?) on conflict (scope, email) do update set role = excluded.role").bind(scope, e, r).run();
        return json({ ok: true });
      }
      if (p === "/m/remove" && req.method === "POST") {
        if (role !== "owner" && role !== "partner") return err(403, "Only owners can remove people.");
        const b = await req.json();
        await env.DB.prepare("delete from members where scope = ? and email = ?").bind(scope, String(b.email || "").toLowerCase()).run();
        return json({ ok: true });
      }
      if (p.startsWith("/rv/")) {
        if (!scope.startsWith("studio:")) return err(400, "Sharing for approval belongs to a Studio.");
        const b = req.method === "POST" ? await req.json().catch(() => ({})) : {};
        const project = String(b.project || u.searchParams.get("project") || "");
        if (p === "/rv/new" && req.method === "POST") {
          if (role === "viewer") return err(403, "Viewers can't share for approval.");
          if (!/^[\w-]{1,80}$/.test(project)) return err(400, "Which project?");
          const content = JSON.stringify(b.content || {});
          if (content.length > 18e5) return err(413, "This project's content is too large to share this way.");
          const token = [...crypto.getRandomValues(new Uint8Array(16))].map((x) => x.toString(16).padStart(2, "0")).join("");
          await env.DB.prepare("insert into approvals (token, scope, project, name, template, content, note, created_by, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(token, scope, project, oneLine(String(b.name || "Project")).slice(0, 120), String(b.template || "").slice(0, 40), content, String(b.note || "").trim().slice(0, 2e3), email, (/* @__PURE__ */ new Date()).toISOString()).run();
          return json({ token });
        }
        if (p === "/rv/list") {
          const rows = (await env.DB.prepare("select token, name, note, status, decided_by, decided_at, created_by, created_at from approvals where scope = ? and project = ? order by created_at desc limit 20").bind(scope, project).all()).results || [];
          for (const r of rows) r.notes = (await env.DB.prepare("select id, who, body, page, kind, created_at from approval_notes where token = ? order by id limit 300").bind(r.token).all()).results || [];
          return json(rows);
        }
        if (p === "/rv/summary") {
          const rows = (await env.DB.prepare("select token, project, status, decided_by, decided_at, created_at from approvals where scope = ? and status != 'closed' order by created_at desc limit 400").bind(scope).all()).results || [];
          const summary = {}, byTok = {};
          for (const r of rows) if (!summary[r.project]) {
            summary[r.project] = byTok[r.token] = { token: r.token, status: r.status, decided_by: r.decided_by || "", decided_at: r.decided_at || null, created_at: r.created_at, comments: 0, waiting: false };
          }
          const toks = Object.keys(byTok);
          for (let i = 0; i < toks.length; i += 40) {
            const part = toks.slice(i, i + 40);
            const notes = (await env.DB.prepare(`select token, who, body, kind, created_at from approval_notes where token in (${part.map(() => "?").join(",")}) order by id`).bind(...part).all()).results || [];
            for (const n of notes) {
              const s = byTok[n.token];
              if (!s) continue;
              s.waiting = n.kind === "comment";
              if (n.kind !== "reply") {
                s.comments++;
                s.last = { who: n.who, body: String(n.body || "").slice(0, 240), kind: n.kind, created_at: n.created_at };
              }
            }
          }
          return json({ summary });
        }
        const tok = String(b.token || ""), own = await env.DB.prepare("select token from approvals where token = ? and scope = ?").bind(tok, scope).first();
        if (!own) return err(404, "That review link isn't in this Studio.");
        if (p === "/rv/reply" && req.method === "POST") {
          const body = String(b.body || "").trim().slice(0, 2e3);
          if (!body) return err(400, "Write your reply.");
          await env.DB.prepare("insert into approval_notes (token, who, body, page, kind, created_at) values (?, ?, ?, '', 'reply', ?)").bind(tok, oneLine(String(b.who || email)).slice(0, 80), body, (/* @__PURE__ */ new Date()).toISOString()).run();
          return json({ ok: true });
        }
        if (p === "/rv/close" && req.method === "POST") {
          await env.DB.prepare("update approvals set status = 'closed', content = '{}' where token = ?").bind(tok).run();
          return json({ ok: true });
        }
        if (p === "/rv/delete" && req.method === "POST") {
          await env.DB.batch([env.DB.prepare("delete from approval_notes where token = ?").bind(tok), env.DB.prepare("delete from approvals where token = ?").bind(tok)]);
          return json({ ok: true });
        }
        return err(404, "Not found.");
      }
      if (p === "/c/list") {
        const site = scope.replace(/^site:/, ""), find = String(u.searchParams.get("q") || "").trim().toLowerCase().slice(0, 60), like = "%" + find.replace(/[%_]/g, "") + "%";
        const page = Math.max(0, Math.floor(+(u.searchParams.get("page") || 0))), per = Math.max(1, Math.min(5e3, Math.floor(+(u.searchParams.get("per") || 20))));
        const where = find ? "site = ? and (lower(name) like ? or phone like ? or lower(email) like ? or ckey like ?)" : "site = ?", args = find ? [site, like, like, like, like] : [site];
        const tot = await env.DB.prepare(`select count(*) n, coalesce(sum(points), 0) pts, coalesce(sum(spent), 0) spent, coalesce(sum(orders), 0) orders from customers where ${where}`).bind(...args).first();
        const rows = (await env.DB.prepare(`select ckey, name, phone, email, verified, orders, spent, points, first_at, last_at from customers where ${where} order by last_at desc limit ? offset ?`).bind(...args, per, page * per).all()).results || [];
        return json({ rows, total: tot?.n || 0, points: tot?.pts || 0, spent: tot?.spent || 0, orders: tot?.orders || 0 });
      }
      if (p === "/c/points") {
        const site = scope.replace(/^site:/, ""), key = String(u.searchParams.get("key") || "");
        return json((await env.DB.prepare("select delta, why, order_no, at from points where site = ? and ckey = ? order by id desc limit 100").bind(site, key).all()).results || []);
      }
      if (p === "/c/rebuild" && req.method === "POST") {
        const b = await req.json().catch(() => ({})), site = scope.replace(/^site:/, ""), c = await siteContent(env, site).catch(() => null), L = loyOf(c);
        const cc = (await getSetting(env, "site:" + site, "wa").catch(() => null))?.cc || (await getSetting(env, "site:" + site, "sms").catch(() => null))?.cc;
        const rows = (await env.DB.prepare("select data, created_at from enquiries where site = ? order by created_at asc limit 5000").bind(site).all()).results || [];
        const done = new Set(((await env.DB.prepare("select distinct order_no from points where site = ? and order_no <> ''").bind(site).all()).results || []).map((r) => String(r.order_no)));
        let orders = 0;
        const who2 = /* @__PURE__ */ new Set(), st = [];
        for (const r of rows) {
          let d = null;
          try {
            d = JSON.parse(r.data);
          } catch {
          }
          const no = String(d?.order_no || "");
          if (!no || done.has(no)) continue;
          const key = waNum(d.phone, cc) || String(d.email || "").trim().toLowerCase().slice(0, 120);
          if (!key) continue;
          const n = rnum(d.total), spent = isNaN(n) ? 0 : n, earned = b.points && L.on && L.earn > 0 ? Math.floor(spent / 100 * L.earn) : 0, at = String(r.created_at || (/* @__PURE__ */ new Date()).toISOString());
          st.push(env.DB.prepare("insert into customers (site, ckey, name, phone, email, verified, orders, spent, points, first_at, last_at) values (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?) on conflict (site, ckey) do update set name = case when name = '' then excluded.name else name end, phone = case when phone = '' then excluded.phone else phone end, email = case when email = '' then excluded.email else email end, verified = max(verified, excluded.verified), orders = orders + 1, spent = spent + excluded.spent, points = points + excluded.points, first_at = min(first_at, excluded.first_at), last_at = max(last_at, excluded.last_at)").bind(site, key, oneLine(String(d.name || "")).slice(0, 100), String(d.phone || "").slice(0, 24), String(d.email || "").trim().slice(0, 120), d._phone ? 1 : 0, spent, earned, at, at));
          st.push(env.DB.prepare("insert into points (site, ckey, delta, why, order_no, at) values (?, ?, ?, ?, ?, ?)").bind(site, key, earned, earned ? "Earned on an earlier order" : "Earlier order counted in", no, at));
          done.add(no);
          who2.add(key);
          orders++;
        }
        for (let i = 0; i < st.length; i += 80) await env.DB.batch(st.slice(i, i + 80));
        return json({ ok: true, orders, customers: who2.size });
      }
      if ((p === "/c/adjust" || p === "/c/delete") && req.method === "POST") {
        const b = await req.json(), site = scope.replace(/^site:/, ""), key = String(b.key || "");
        const row = await env.DB.prepare("select points from customers where site = ? and ckey = ?").bind(site, key).first();
        if (!row) return err(404, "That customer isn't here any more.");
        if (p === "/c/delete") {
          await env.DB.batch([env.DB.prepare("delete from points where site = ? and ckey = ?").bind(site, key), env.DB.prepare("delete from customers where site = ? and ckey = ?").bind(site, key)]);
          return json({ ok: true });
        }
        const d = Math.round(+b.delta || 0);
        if (!d || Math.abs(d) > 1e6) return err(400, "How many points?");
        const next = Math.max(0, (+row.points || 0) + d), real = next - (+row.points || 0);
        await env.DB.batch([env.DB.prepare("update customers set points = ? where site = ? and ckey = ?").bind(next, site, key), env.DB.prepare("insert into points (site, ckey, delta, why, order_no, at) values (?, ?, ?, ?, '', ?)").bind(site, key, real, oneLine(String(b.why || "Changed by the owner")).slice(0, 120), (/* @__PURE__ */ new Date()).toISOString())]);
        return json({ ok: true, points: next });
      }
      if (p === "/dq/list" || p === "/dq/get" || p === "/dq/status" || p === "/dq/delete") {
        if (!scope.startsWith("studio:")) return err(400, "Unknown scope.");
        await ensure(env);
        const sid = scope.slice(7);
        if (p === "/dq/list") {
          const rows = (await env.DB.prepare("select id, name, kind, person, phone, email, note, answers, copy, status, mail, pdf_name, (logo != '') as has_logo, created_at from design_queries where studio = ? order by id desc limit 300").bind(sid).all()).results || [];
          return json(rows.map((r) => ({ ...r, answers: JSON.parse(r.answers || "{}"), copy: JSON.parse(r.copy || "{}"), has_logo: !!r.has_logo })));
        }
        const b = req.method === "POST" ? await req.json().catch(() => ({})) : {}, qid = Math.floor(+(b.id ?? u.searchParams.get("id")) || 0);
        if (!qid) return err(400, "Which request?");
        if (p === "/dq/get") {
          const r = await env.DB.prepare("select logo, pdf_name, pdf from design_queries where studio = ? and id = ?").bind(sid, qid).first();
          return r ? json(r) : err(404, "Not found.");
        }
        if (p === "/dq/status") {
          if (!["new", "read", "done"].includes(b.status)) return err(400, "Unknown status.");
          await env.DB.prepare("update design_queries set status = ? where studio = ? and id = ?").bind(b.status, sid, qid).run();
          return json({ ok: true });
        }
        await env.DB.prepare("delete from design_queries where studio = ? and id = ?").bind(sid, qid).run();
        return json({ ok: true });
      }
      if (p === "/e/list") {
        const site = scope.replace(/^site:/, "");
        const rows = (await env.DB.prepare("select id, site, data, page, status, created_at from enquiries where site = ? order by created_at desc limit 500").bind(site).all()).results || [];
        return json(rows.map((r) => ({ ...r, data: JSON.parse(r.data) })));
      }
      if (p === "/e/paid" && req.method === "POST") {
        const b = await req.json(), site = scope.replace(/^site:/, "");
        const row = await env.DB.prepare("select data from enquiries where id = ? and site = ?").bind(b.id, site).first();
        if (!row) return err(404, "Not found.");
        const d = JSON.parse(row.data);
        if (!d.order_no) return err(400, "That isn't an order.");
        if (b.paid) d._paid = "yes";
        else delete d._paid;
        await env.DB.prepare("update enquiries set data = ? where id = ? and site = ?").bind(JSON.stringify(d), b.id, site).run();
        return json({ ok: true });
      }
      if (p === "/rw/list") {
        const site = scope.replace(/^site:/, "");
        await ensure(env);
        const rows = (await env.DB.prepare("select id, item, label, name, email, rating, title, body, verified, status, reply, created_at from reviews where site = ? order by id desc limit 500").bind(site).all()).results || [];
        const c = await siteContent(env, site).catch(() => null);
        return json({ on: revOn(c), moderate: c?.reviews?.auto !== true, rows });
      }
      if (p === "/rw/set" && req.method === "POST") {
        const b = await req.json(), site = scope.replace(/^site:/, ""), id = +b.id;
        const r = await env.DB.prepare("select id from reviews where id = ? and site = ?").bind(id, site).first();
        if (!r) return err(404, "That review isn't here any more.");
        if (b.status != null) {
          if (!["live", "pending", "hidden"].includes(String(b.status))) return err(400, "Which state?");
          await env.DB.prepare("update reviews set status = ? where id = ? and site = ?").bind(String(b.status), id, site).run();
        }
        if (b.reply != null) {
          const t = String(b.reply).trim().slice(0, 800);
          await env.DB.prepare("update reviews set reply = ?, reply_at = ? where id = ? and site = ?").bind(t, t ? (/* @__PURE__ */ new Date()).toISOString() : null, id, site).run();
        }
        return json({ ok: true });
      }
      if (p === "/rw/del" && req.method === "POST") {
        const b = await req.json(), site = scope.replace(/^site:/, "");
        await env.DB.prepare("delete from reviews where id = ? and site = ?").bind(+b.id, site).run();
        return json({ ok: true });
      }
      if (p === "/rc/list") {
        const site = scope.replace(/^site:/, "");
        await ensure(env);
        const rows = (await env.DB.prepare("select ckey, email, name, phone, items, total, status, sent, sent_at, order_no, updated_at from carts where site = ? order by updated_at desc limit 300").bind(site).all()).results || [];
        const c = await siteContent(env, site).catch(() => null);
        return json({ on: recOn(c), mail: !!(env.RESEND_API_KEY && env.MAIL_FROM), rows: rows.map((r) => ({ ...r, items: JSON.parse(r.items) })) });
      }
      if (p === "/rc/send" && req.method === "POST") {
        const b = await req.json(), site = scope.replace(/^site:/, "");
        await ensure(env);
        const r = await env.DB.prepare("select * from carts where site = ? and ckey = ?").bind(site, String(b.key || "")).first();
        if (!r) return err(404, "That cart isn't here any more.");
        if (r.status === "recovered") return err(409, "That shopper has already ordered.");
        const c = await siteContent(env, site).catch(() => null);
        if (!c) return err(409, "Publish the site first.");
        try {
          await recSend(env, site, c, r, new URL(req.url).origin);
        } catch (e) {
          return err(502, String(e?.message || e));
        }
        await env.DB.prepare("update carts set sent = sent + 1, sent_at = ?, status = case when status = 'stop' then 'open' else status end where site = ? and ckey = ?").bind((/* @__PURE__ */ new Date()).toISOString(), site, r.ckey).run();
        return json({ ok: true });
      }
      if (p === "/rc/drop" && req.method === "POST") {
        const b = await req.json(), site = scope.replace(/^site:/, "");
        await env.DB.prepare("delete from carts where site = ? and ckey = ?").bind(site, String(b.key || "")).run();
        return json({ ok: true });
      }
      if (p === "/st/list") {
        const site = scope.replace(/^site:/, "");
        await ensure(env);
        const rows = (await env.DB.prepare("select item, qty, low, updated_at from stock where site = ? order by item limit 3000").bind(site).all()).results || [];
        const log = (await env.DB.prepare("select item, delta, qty, why, ref, at from stock_log where site = ? order by id desc limit 200").bind(site).all()).results || [];
        const c = await siteContent(env, site).catch(() => null);
        return json({ on: invOn(c), items: c ? stockItems(c) : [], rows, log });
      }
      if (p === "/st/set" && req.method === "POST") {
        const site = scope.replace(/^site:/, ""), b = await req.json(), now = (/* @__PURE__ */ new Date()).toISOString(), why = oneLine(String(b.why || "")).slice(0, 60);
        await ensure(env);
        const list = (Array.isArray(b.items) ? b.items : []).slice(0, 600);
        let n = 0;
        for (const it of list) {
          const item = String(it?.item || "").trim().slice(0, 200);
          if (!item) continue;
          if (it.off) {
            await env.DB.prepare("delete from stock where site = ? and item = ?").bind(site, item).run();
            await env.DB.prepare("insert into stock_log (site, item, delta, qty, why, ref, at) values (?, ?, 0, 0, 'No longer counted', '', ?)").bind(site, item, now).run();
            n++;
            continue;
          }
          const had = await env.DB.prepare("select qty, low from stock where site = ? and item = ?").bind(site, item).first();
          const int = (v) => Math.max(0, Math.min(1e6, Math.round(+v || 0)));
          const qty = it.add != null && isFinite(+it.add) ? int((+had?.qty || 0) + Math.round(+it.add)) : it.qty != null && isFinite(+it.qty) ? int(it.qty) : +had?.qty || 0, low = it.low != null && isFinite(+it.low) ? int(it.low) : +had?.low || 0;
          if (had && +had.qty === qty && +had.low === low) continue;
          await env.DB.prepare("insert into stock (site, item, qty, low, updated_at) values (?, ?, ?, ?, ?) on conflict (site, item) do update set qty = excluded.qty, low = excluded.low, updated_at = excluded.updated_at").bind(site, item, qty, low, now).run();
          if (!had || +had.qty !== qty) await env.DB.prepare("insert into stock_log (site, item, delta, qty, why, ref, at) values (?, ?, ?, ?, ?, ?, ?)").bind(site, item, qty - (+had?.qty || 0), qty, why || (had ? it.add != null ? +it.add >= 0 ? "Stock added" : "Stock taken off" : "Counted" : "Started counting"), String(email || "").slice(0, 40), now).run();
          n++;
        }
        return json({ ok: true, changed: n });
      }
      if ((p === "/e/track" || p === "/e/track/live") && req.method === "POST") {
        const b = await req.json(), site = scope.replace(/^site:/, "");
        const row = await env.DB.prepare("select data, status from enquiries where id = ? and site = ?").bind(b.id, site).first();
        if (!row) return err(404, "Not found.");
        const d = JSON.parse(row.data);
        if (!d.order_no) return err(400, "That isn't an order.");
        if (p === "/e/track/live") {
          const g = await shipLive(env, site, b.id, d, row.status, true);
          return json({ live: g.live ? { ...g.live, label: TRACK_STATES[g.live.st] || g.live.say } : null, why: g.why, status: g.status });
        }
        const c = COURIERS[String(b.courier)] ? String(b.courier) : "other", awb = String(b.awb || "").trim().slice(0, 40), url = String(b.url || "").trim().slice(0, 400);
        if (awb && !/^[A-Za-z0-9][A-Za-z0-9 _-]{3,39}$/.test(awb)) return err(400, "That doesn't look like a tracking number.");
        if (url && !publicUrl(url)) return err(400, "The tracking link must be a public https:// address.");
        delete d._trk;
        delete d._trk_bad;
        delete d._trk_why;
        if (!awb && !url) delete d._track;
        else d._track = JSON.stringify({ c, awb, url, name: oneLine(String(b.name || "")).slice(0, 60), at: (/* @__PURE__ */ new Date()).toISOString() });
        let status = row.status, said = "";
        if (b.ship && d._track && SHIP_OPEN.includes(status)) status = "out";
        if (b.ship && d._track && !d._ship_mail) {
          const opt = await getSetting(env, scope, "ship").catch(() => null);
          if (!opt?.quiet) {
            said = await shippedMail(env, site, d).catch((e) => "Not emailed: " + String(e?.message || e).slice(0, 200));
            if (said) d._ship_mail = said;
          }
        }
        await env.DB.prepare("update enquiries set data = ?, status = ? where id = ? and site = ?").bind(JSON.stringify(d), status, b.id, site).run();
        return json({ ok: true, status, data: d, mail: said });
      }
      if ((p === "/e/status" || p === "/e/delete") && req.method === "POST") {
        const b = await req.json();
        const site = scope.replace(/^site:/, "");
        if (p === "/e/status") {
          if (!["new", "read", "replied", "archived", "accepted", "preparing", "ready", "out", "done", "cancelled"].includes(b.status)) return err(400, "Unknown status.");
          const row = await env.DB.prepare("select data, status from enquiries where id = ? and site = ?").bind(b.id, site).first();
          let nd = null;
          if (row && b.status === "cancelled" !== (row.status === "cancelled")) {
            try {
              const d = JSON.parse(row.data), tk = JSON.parse(String(d._stock || "[]"));
              if (Array.isArray(tk) && tk.length) {
                if (b.status === "cancelled" && !d._stock_back) {
                  await stockBack(env, site, tk, String(d.order_no || ""), "Order cancelled");
                  d._stock_back = "yes";
                  nd = JSON.stringify(d);
                } else if (b.status !== "cancelled" && d._stock_back) {
                  const now = (/* @__PURE__ */ new Date()).toISOString();
                  for (const [k, q] of tk) {
                    const r = await env.DB.prepare("update stock set qty = max(0, qty - ?), updated_at = ? where site = ? and item = ? returning qty").bind(q, now, site, k).first();
                    if (r) await env.DB.prepare("insert into stock_log (site, item, delta, qty, why, ref, at) values (?, ?, ?, ?, 'Order brought back', ?, ?)").bind(site, k, -q, +r.qty || 0, String(d.order_no || "").slice(0, 40), now).run();
                  }
                  delete d._stock_back;
                  nd = JSON.stringify(d);
                }
              }
            } catch {
            }
          }
          if (nd) await env.DB.prepare("update enquiries set status = ?, data = ? where id = ? and site = ?").bind(b.status, nd, b.id, site).run();
          else await env.DB.prepare("update enquiries set status = ? where id = ? and site = ?").bind(b.status, b.id, site).run();
          if (row && row.status !== b.status && ["ready", "out", "done", "cancelled"].includes(b.status)) {
            try {
              const d = JSON.parse(nd || row.data), sent = String(d._smail || "").split(",");
              if (d.order_no && !sent.includes(b.status)) {
                const said = await orderMail(env, site, b.status, d);
                if (said) {
                  d._smail = [...sent.filter(Boolean), b.status].join(",");
                  d._omail = said;
                  await env.DB.prepare("update enquiries set data = ? where id = ? and site = ?").bind(JSON.stringify(d), b.id, site).run();
                }
              }
            } catch {
            }
          }
        } else await env.DB.prepare("delete from enquiries where id = ? and site = ?").bind(b.id, site).run();
        return json({ ok: true });
      }
      return err(404, "Not found.");
    } catch (e) {
      return err(500, e?.message || "Something went wrong.");
    }
  }
};
export {
  SCHEMA,
  copiedBits,
  db_worker_default as default,
  loyOf,
  outlineOf,
  pointsFor,
  posItems,
  restBill,
  shopBill
};
