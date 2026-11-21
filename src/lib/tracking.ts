// Courier tracking for shop orders: asks a courier, a shipping aggregator or a multi-courier tracker where a parcel
// is, with the shop's own account there, and brings every answer to one shape. No library; one request (two where the
// service wants a sign-in first). The keys stay on the site's database (settings tk_<id>), never in the site.
//
// Each service's request is written from its published API; the answer is read by the service's own field names
// first and, failing that, by looking for the list of dated scans wherever it sits, so a renamed field does not
// break tracking.

/** The couriers an order can be marked as shipped with: [name, public tracking page ({awb} = the tracking number)]. */
export const COURIERS: Record<string, [string, string]> = {
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
  other: ["Another courier", ""],
};
export const courierName = (c: string) => (COURIERS[c] || COURIERS.other)[0];
export const courierLink = (c: string, awb: string) => { const u = (COURIERS[c] || ["", ""])[1]; return u ? u.replace("{awb}", encodeURIComponent(awb)) : ""; };

/** The services that can be asked where a parcel is. kind: a courier's own API (covers that courier), an aggregator
 *  (covers what was booked through it), a multi-courier tracker (covers any courier), or the shop's own address. */
export type TrackerKind = "courier" | "agg" | "multi" | "custom";
export const TRACKERS: Record<string, { name: string; kind: TrackerKind; needs: string[] }> = {
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
  custom: { name: "Another tracking API", kind: "custom", needs: ["url"] },
};
/** The boxes every tracking connection keeps (which of them a service uses is in `needs`). */
export const TRACKER_FIELDS = { secret: ["key", "secret"], text: ["user", "account", "url", "hdr", "codes"], flags: ["on"] };
export const trackerReady = (id: string, z: any) => !!(z && z.on && TRACKERS[id] && TRACKERS[id].needs.every((k) => String(z[k] || "").trim()));

export type Live = { st: string; say: string; eta: string; link: string; ev: { at: string; text: string; place: string }[] };
export const TRACK_STATES: Record<string, string> = { booked: "Booked", picked: "Picked up", transit: "In transit", out: "Out for delivery", delivered: "Delivered", failed: "Delivery attempted", returned: "Returning to the shop", unknown: "Waiting for the first scan" };

const S = (v: any, n = 200) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
/** What a status line means, whichever courier wrote it. */
export function trackState(text: string): string {
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
/** A date as the couriers write them, as ISO where it can be read (else as written). */
function when(a: any, b?: any): string {
  let s = S(a, 60), t = S(b, 20); if (!s) return "";
  if (/^\d{10}$/.test(s)) return new Date(+s * 1000).toISOString(); if (/^\d{13}$/.test(s)) return new Date(+s).toISOString();
  if (/^\d{8}$/.test(s)) s = `${s.slice(4)}-${s.slice(2, 4)}-${s.slice(0, 2)}`;                                   // ddmmyyyy (DTDC)
  let m = /^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{4})(.*)$/.exec(s); if (m) s = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}${m[4]}`; // dd-mm-yyyy
  if (/^\d{4}$/.test(t)) t = t.slice(0, 2) + ":" + t.slice(2);                                                 // hhmm
  if (t && !/[T ]\d{1,2}:\d{2}/.test(s)) s += " " + t;
  // Couriers in India write local time with no zone: read it as India time.
  m = /^(\d{4}-\d{2}-\d{2})[T ](\d{1,2}:\d{2}(?::\d{2})?)(?:\.\d+)?\s*(am|pm)?$/i.exec(s);
  if (m) { let [h, mi, se] = m[2].split(":"); if (m[3]) { let n = +h % 12; if (/pm/i.test(m[3])) n += 12; h = String(n); } const d = new Date(`${m[1]}T${h.padStart(2, "0")}:${mi}:${se || "00"}+05:30`); if (!isNaN(+d)) return d.toISOString(); }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s); return isNaN(+d) ? S(a, 40) + (t ? " " + t : "") : d.toISOString();
}
/** The day a parcel is expected, as yyyy-mm-dd (no time: the couriers mean a day, whatever zone the stamp is in). */
function day(a: any): string {
  let s = S(a, 60); if (!s) return "";
  let m = /^(\d{4}-\d{2}-\d{2})/.exec(s); if (m) return m[1];
  if (/^\d{8}$/.test(s)) return `${s.slice(4)}-${s.slice(2, 4)}-${s.slice(0, 2)}`;
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(s); if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const d = new Date(s.replace(/-/g, " ") + " UTC"); return isNaN(+d) ? "" : d.toISOString().slice(0, 10);
}
const DATE_KEY = /date|time|stamp|_at$|^at$|when|occur/i, TEXT_KEY = /status|activity|remark|message|description|detail|action|scan$|^scan|event|instruction|desc/i, PLACE_KEY = /location|city|place|origin|hub|centre|center|branch|office/i;
/** The list of dated scans in an answer, wherever it sits (used when a service's own field names are not found). */
function findScans(j: any): Live["ev"] {
  let best: any[] = [], n = 0;
  const walk = (v: any, depth: number) => {
    if (!v || typeof v !== "object" || depth > 7 || ++n > 4000) return;
    if (Array.isArray(v)) {
      const rows = v.map((x) => (x && typeof x === "object" && !Array.isArray(x) && Object.keys(x).length === 1 && typeof Object.values(x)[0] === "object" ? Object.values(x)[0] : x)).filter((x) => x && typeof x === "object" && !Array.isArray(x)) as any[];
      if (rows.length && rows.every((r) => Object.keys(r).some((k) => DATE_KEY.test(k)) && Object.keys(r).some((k) => TEXT_KEY.test(k))) && rows.length > best.length) best = rows;
      v.forEach((x) => walk(x, depth + 1));
    } else Object.values(v).forEach((x) => walk(x, depth + 1));
  };
  walk(j, 0);
  const pick = (r: any, re: RegExp, not?: RegExp) => { for (const k of Object.keys(r)) if (re.test(k) && !(not && not.test(k)) && r[k] != null && typeof r[k] !== "object" && String(r[k]).trim()) return r[k]; return ""; };
  return best.map((r) => { const dk = Object.keys(r).filter((k) => DATE_KEY.test(k) && r[k] != null && typeof r[k] !== "object"), d = dk.find((k) => /date|stamp|_at$|^at$|when|occur/i.test(k)) || dk[0], tm = dk.find((k) => k !== d && /time/i.test(k)); return { at: when(d ? r[d] : "", tm ? r[tm] : ""), text: S(pick(r, TEXT_KEY, /code|id$|type$|date|time/i) || pick(r, TEXT_KEY, /date|time/i)), place: S(pick(r, PLACE_KEY), 80) }; }).filter((e) => e.text);
}
/** One shape for every service: the newest scan first, what it means, when it should arrive. */
function norm(p: { say?: any; eta?: any; link?: any; ev?: Live["ev"]; raw?: any }): Live {
  let ev = (p.ev || []).filter((e) => e && e.text).map((e) => ({ at: S(e.at, 40), text: S(e.text), place: S(e.place, 80) }));
  if (!ev.length && p.raw) ev = findScans(p.raw);
  const t = (e: { at: string }) => { const d = Date.parse(e.at); return isNaN(d) ? 0 : d; };
  if (ev.length > 1 && ev.every((e) => t(e))) ev.sort((a, b) => t(b) - t(a)); else if (ev.length > 1 && t(ev[0]) && t(ev[ev.length - 1]) && t(ev[0]) < t(ev[ev.length - 1])) ev.reverse();
  const say = S(p.say, 120) || (ev[0] ? ev[0].text : ""), st = trackState(say) || (ev[0] ? trackState(ev[0].text) : "") || (ev.length ? "transit" : "unknown");
  const link = S(p.link, 400);
  return { st, say: say || TRACK_STATES[st], eta: st === "delivered" ? "" : day(p.eta), link: /^https:\/\//.test(link) ? link : "", ev: ev.slice(0, 40) };
}

export class TrackError extends Error {}
async function ask(url: string, init: RequestInit = {}, as: "json" | "text" = "json"): Promise<any> {
  const c = new AbortController(), timer = setTimeout(() => c.abort(), 12000);
  let r: Response; try { r = await fetch(url, { ...init, signal: c.signal, redirect: "follow" }); } catch (e: any) { throw new TrackError(e?.name === "AbortError" ? "The tracking service took too long to answer." : "The tracking service couldn't be reached."); } finally { clearTimeout(timer); }
  const text = (await r.text()).slice(0, 400000);
  if (as === "text") { if (!r.ok) throw new TrackError(`The tracking service answered ${r.status}.`); return text; }
  let j: any = null; try { j = JSON.parse(text); } catch { /* not JSON */ }
  if (!r.ok) throw new TrackError(r.status === 401 || r.status === 403 ? "The tracking service refused the keys. Check them under Courier tracking." : r.status === 404 ? "The tracking service doesn't know that tracking number yet." : r.status === 429 ? "The tracking service is asking us to slow down. Try again in a few minutes." : `The tracking service answered ${r.status}${j && (j.message || j.error) ? ": " + S(typeof (j.message || j.error) === "string" ? j.message || j.error : JSON.stringify(j.message || j.error), 160) : ""}.`);
  if (j == null) throw new TrackError("The tracking service sent an answer that couldn't be read.");
  return j;
}
const post = (body: any, headers: Record<string, string> = {}): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json", ...headers }, body: JSON.stringify(body) });
const E = encodeURIComponent, arr = (v: any): any[] => (Array.isArray(v) ? v : v && typeof v === "object" ? [v] : []);
/** The codes multi-courier trackers use for a courier (a shop can type its own under "codes": bluedart=…, dtdc=…). */
const SLUGS: Record<string, Record<string, string>> = {
  aftership: { bluedart: "bluedart", delhivery: "delhivery", dtdc: "dtdc", xpressbees: "xpressbees", ecom: "ecom-express", ekart: "ekart", indiapost: "india-post", shadowfax: "shadowfax", gati: "gati-kwe", professional: "professional-couriers", trackon: "trackon", fedex: "fedex", dhl: "dhl", aramex: "aramex", ups: "ups", shiprocket: "shiprocket", safexpress: "safexpress", amazon: "amazon-logistics-in" },
  trackingmore: { bluedart: "bluedart", delhivery: "delhivery", dtdc: "dtdc", xpressbees: "xpressbees", ecom: "ecom-express", ekart: "ekart", indiapost: "india-post", shadowfax: "shadowfax", gati: "gati-kwe", professional: "professional-couriers", trackon: "trackon", fedex: "fedex", dhl: "dhl", aramex: "aramex", ups: "ups", shiprocket: "shiprocket", safexpress: "safexpress", maruti: "shree-maruti", tirupati: "shree-tirupati", smartr: "smartr-logistics" },
  clickpost: { bluedart: "5", delhivery: "4", dtdc: "9", xpressbees: "6", ecom: "3", ekart: "24", indiapost: "22", shadowfax: "11", fedex: "1", aramex: "2", gati: "16" },
};
function slug(id: string, z: any, courier: string): string {
  for (const part of String(z.codes || "").split(/[,\n;]+/)) { const [k, v] = part.split("=").map((x) => x.trim()); if (k && v && k.toLowerCase() === courier) return v; }
  return (SLUGS[id] || {})[courier] || "";
}

const ASK: Record<string, (z: any, awb: string, courier: string) => Promise<Live>> = {
  // Blue Dart (API gateway): a sign-in token from the client ID and secret, then the tracking query with the
  // account's login ID and tracking licence key.
  bluedart: async (z, awb) => {
    const base = "https://apigateway.bluedart.com/in/transportation";
    const tok = await ask(base + "/token/v1/login", { headers: { ClientID: z.key, clientSecret: z.secret, Accept: "application/json" } });
    const jwt = tok.JWTToken || tok.jwtToken || tok.token; if (!jwt) throw new TrackError("Blue Dart didn't accept the client ID and secret.");
    const j = await ask(`${base}/tracking/v1/shipment?handler=tnt&loginid=${E(z.user)}&numbers=${E(awb)}&format=json&lickey=${E(z.account)}&scan=1&action=custawbquery&verno=1&awb=awb`, { headers: { JWTToken: jwt, Accept: "application/json" } });
    const s = arr(j?.ShipmentData?.Shipment)[0] || arr(j?.ShipmentData)[0] || {};
    if (s.Status && /incorrect|invalid|not found|no (data|record)/i.test(String(s.Status)) && !s.Scans) throw new TrackError("Blue Dart doesn't know that waybill number yet.");
    return norm({ say: s.Status, eta: s.ExpectedDelivery || s.ExpectedDeliveryDate, raw: j, ev: arr(s.Scans).map((x: any) => x.ScanDetail || x).flatMap(arr).map((d: any) => ({ at: when(d.ScanDate, d.ScanTime), text: d.Scan, place: d.ScannedLocation })) });
  },
  delhivery: async (z, awb) => {
    const j = await ask(`https://track.delhivery.com/api/v1/packages/json/?waybill=${E(awb)}`, { headers: { Authorization: "Token " + z.key, Accept: "application/json" } });
    const s = arr(j?.ShipmentData)[0]?.Shipment; if (!s) throw new TrackError(S(j?.Error || j?.rmk, 160) || "Delhivery doesn't know that waybill number yet.");
    return norm({ say: s.Status?.Status, eta: s.ExpectedDeliveryDate || s.PromisedDeliveryDate, raw: j, ev: arr(s.Scans).map((x: any) => x.ScanDetail || x).map((d: any) => ({ at: when(d.ScanDateTime || d.StatusDateTime), text: d.Instructions && d.Instructions !== d.Scan ? `${d.Scan}: ${d.Instructions}` : d.Scan, place: d.ScannedLocation })) });
  },
  dtdc: async (z, awb) => {
    const j = await ask(z.url && /^https:\/\//.test(z.url) ? z.url : "https://blktracksvc.dtdc.com/dtdc-api/rest/JSONCnTrk/getTrackDetails", post({ trkType: "cnno", strcnno: awb, addtnlDtl: "Y" }, { "X-Access-Token": z.key }));
    if (j?.statusFlag === false || (j?.status && /fail/i.test(String(j.status)) && !j.trackDetails)) throw new TrackError(S(j?.errorDetails?.[0]?.value || j?.message, 160) || "DTDC doesn't know that consignment number yet.");
    const h = j?.trackHeader || {};
    return norm({ say: h.strStatus, eta: h.strExpectedDeliveryDate || h.strRevExpectedDeliveryDate, raw: j, ev: arr(j?.trackDetails).map((d: any) => ({ at: when(d.strActionDate, d.strActionTime), text: d.strAction + (d.sTrRemarks || d.strRemarks ? ": " + (d.sTrRemarks || d.strRemarks) : ""), place: d.strOrigin || d.strDestination })) });
  },
  // Xpressbees and NimbusPost run the same API: sign in with the account's email and password, then ask.
  xpressbees: (z, awb) => beesLike("https://shipment.xpressbees.com/api", "/shipments2/track/", z, awb, "Xpressbees"),
  nimbuspost: (z, awb) => beesLike("https://api.nimbuspost.com/v1", "/shipments/track/", z, awb, "NimbusPost"),
  ecom: async (z, awb) => {
    const x = await ask(`https://plapi.ecomexpress.in/track_me/api/mawbd/?awb=${E(awb)}&username=${E(z.user)}&password=${E(z.secret)}`, {}, "text");
    const field = (src: string, name: string) => { const m = new RegExp(`<field[^>]*name="${name}"[^>]*>([^<]*)</field>`, "i").exec(src); return m ? m[1].replace(/&amp;/g, "&").trim() : ""; };
    const scans = [...x.matchAll(/<object[^>]*model="scan_stages"[^>]*>([\s\S]*?)<\/object>/gi)].map((m) => ({ at: when(field(m[1], "updated_on")), text: field(m[1], "status") || field(m[1], "reason_code"), place: field(m[1], "location_city") || field(m[1], "scan_location") || field(m[1], "location") }));
    const say = field(x, "status") || field(x, "tracking_status"); if (!say && !scans.length) throw new TrackError(/auth|unauthori|invalid/i.test(x.slice(0, 400)) ? "Ecom Express refused the username and password." : "Ecom Express doesn't know that AWB number yet.");
    return norm({ say, eta: field(x, "expected_date"), ev: scans });
  },
  shiprocket: async (z, awb) => {
    const tok = (await ask("https://apiv2.shiprocket.in/v1/external/auth/login", post({ email: z.user, password: z.secret }))).token; if (!tok) throw new TrackError("Shiprocket didn't accept the API user's email and password.");
    const j = await ask(`https://apiv2.shiprocket.in/v1/external/courier/track/awb/${E(awb)}`, { headers: { Authorization: "Bearer " + tok, Accept: "application/json" } });
    const d = j?.tracking_data || {}; if (d.track_status === 0 && !arr(d.shipment_track_activities).length && !arr(d.shipment_track).length) throw new TrackError(S(d.error, 160) || "Shiprocket has no scans for that AWB number yet.");
    return norm({ say: arr(d.shipment_track)[0]?.current_status, eta: d.etd || arr(d.shipment_track)[0]?.edd, link: d.track_url, raw: j, ev: arr(d.shipment_track_activities).map((a: any) => ({ at: when(a.date), text: a["sr-status-label"] && a["sr-status-label"] !== "NA" ? a["sr-status-label"] : a.activity, place: a.location })) });
  },
  ithink: async (z, awb) => {
    const j = await ask("https://api.ithinklogistics.com/api_v3/order/track.json", post({ data: { awb_number_list: awb, access_token: z.key, secret_key: z.secret } }));
    const d = j?.data?.[awb] || Object.values(j?.data || {})[0] as any; if (!d || d.message && !d.scan_details && !d.current_status) throw new TrackError(S(d?.message || j?.html_message || j?.message, 160) || "iThink Logistics doesn't know that AWB number yet.");
    return norm({ say: d.current_status, eta: d.expected_delivery_date, raw: j, ev: arr(d.scan_details).map((s: any) => ({ at: when(s.status_date_time || s.scan_date_time), text: s.status_remark && s.status_remark !== s.status ? `${s.status}: ${s.status_remark}` : s.status, place: s.status_location || s.scan_location })) });
  },
  clickpost: async (z, awb, courier) => {
    const cp = slug("clickpost", z, courier) || S(z.account, 12); if (!cp) throw new TrackError(`ClickPost needs its carrier number for this courier. Add it under Courier tracking → ClickPost → courier codes (for example ${courier}=5).`);
    const j = await ask(`https://api.clickpost.in/api/v2/track-order/?username=${E(z.user)}&key=${E(z.key)}&waybill=${E(awb)}&cp_id=${E(cp)}`);
    const r = j?.result?.[awb] || Object.values(j?.result || {})[0] as any; if (!r || r.valid === false) throw new TrackError(S(j?.meta?.message, 160) || "ClickPost doesn't know that AWB number yet.");
    const one = (s: any) => ({ at: when(s.timestamp || s.created_at), text: s.clickpost_status_description || s.remark || s.status, place: s.location });
    return norm({ say: r.latest_status?.clickpost_status_description || r.latest_status?.remark, eta: r.additional?.courier_partner_edd, raw: j, ev: arr(r.scans).map(one) });
  },
  aftership: async (z, awb, courier) => {
    const H = { "as-api-key": z.key, Accept: "application/json" }, base = "https://api.aftership.com/tracking/2025-07/trackings", sl = slug("aftership", z, courier);
    const find = async () => arr((await ask(`${base}?tracking_numbers=${E(awb)}`, { headers: H }))?.data?.trackings)[0];
    let t = await find();
    if (!t) { await ask(base, post({ tracking_number: awb, ...(sl ? { slug: sl } : {}) }, H)).catch((e) => { if (!/already/i.test(String(e?.message))) throw e; }); t = await find(); }
    if (!t) throw new TrackError("AfterShip has started following that parcel. Its scans show here in a few minutes.");
    return norm({ say: t.subtag_message || t.tag, eta: t.courier_estimated_delivery_date?.estimated_delivery_date || t.aftership_estimated_delivery_date?.estimated_delivery_date || t.expected_delivery, link: t.courier_tracking_link, raw: t, ev: arr(t.checkpoints).map((c: any) => ({ at: when(c.checkpoint_time), text: c.message || c.subtag_message, place: c.location || [c.city, c.state].filter(Boolean).join(", ") })) });
  },
  trackingmore: async (z, awb, courier) => {
    const H = { "Tracking-Api-Key": z.key, Accept: "application/json" }, base = "https://api.trackingmore.com/v4/trackings", sl = slug("trackingmore", z, courier);
    const find = async () => arr((await ask(`${base}/get?tracking_numbers=${E(awb)}`, { headers: H }))?.data)[0];
    let t = await find();
    if (!t) { if (!sl) throw new TrackError("TrackingMore needs its code for this courier. Add it under Courier tracking → TrackingMore → courier codes."); await ask(base + "/create", post({ tracking_number: awb, courier_code: sl }, H)).catch((e) => { if (!/exist/i.test(String(e?.message))) throw e; }); t = await find(); }
    if (!t) throw new TrackError("TrackingMore has started following that parcel. Its scans show here in a few minutes.");
    const info = [...arr(t.destination_info?.trackinfo), ...arr(t.origin_info?.trackinfo)];
    return norm({ say: t.latest_event || t.delivery_status, eta: t.scheduled_delivery_date, raw: t, ev: info.map((c: any) => ({ at: when(c.checkpoint_date), text: c.tracking_detail, place: c.location })) });
  },
  ship24: async (z, awb) => {
    const j = await ask("https://api.ship24.com/public/v1/trackers/track", post({ trackingNumber: awb }, { Authorization: "Bearer " + z.key }));
    const t = arr(j?.data?.trackings)[0]; if (!t) throw new TrackError("Ship24 doesn't know that tracking number yet.");
    return norm({ say: arr(t.events)[0]?.status || t.shipment?.statusMilestone, eta: t.shipment?.delivery?.estimatedDeliveryDate, raw: t, ev: arr(t.events).map((e: any) => ({ at: when(e.occurrenceDatetime || e.datetime), text: e.status, place: e.location })) });
  },
  track17: async (z, awb) => {
    const H = { "17token": z.key }, base = "https://api.17track.net/track/v2.2";
    const get = async () => arr((await ask(base + "/gettrackinfo", post([{ number: awb }], H)))?.data?.accepted)[0];
    let t = await get();
    if (!t) { await ask(base + "/register", post([{ number: awb }], H)); t = await get(); }
    const info = t?.track_info; if (!info) throw new TrackError("17TRACK has started following that parcel. Its scans show here in a few minutes.");
    return norm({ say: info.latest_event?.description || info.latest_status?.status, eta: info.time_metrics?.estimated_delivery_date?.to, raw: info, ev: arr(info.tracking?.providers).flatMap((p: any) => arr(p.events)).map((e: any) => ({ at: when(e.time_iso || e.time_utc), text: e.description, place: e.location })) });
  },
  // The shop's own choice: any address that answers with JSON. {awb} and {courier} in the address are filled in; an
  // optional header ("Name: value") carries the key. The scans are found wherever they sit in the answer.
  custom: async (z, awb, courier) => {
    const url = String(z.url || "").replace(/\{awb\}/g, E(awb)).replace(/\{courier\}/g, E(courier)); if (!/^https:\/\//.test(url)) throw new TrackError("The tracking address must start with https://.");
    const headers: Record<string, string> = { Accept: "application/json" }, h = /^([\w-]{1,60})\s*:\s*(.*)$/.exec(String(z.hdr || "").trim());
    if (h) headers[h[1]] = h[2].replace(/\{key\}/g, String(z.key || "")); else if (z.key) headers.Authorization = "Bearer " + z.key;
    const j = await ask(url, { headers });
    const deep = (re: RegExp) => { let out = ""; const walk = (v: any, d: number) => { if (out || !v || typeof v !== "object" || d > 4) return; for (const [k, x] of Object.entries(v)) { if (out) return; if (re.test(k) && x != null && typeof x !== "object" && String(x).trim()) out = String(x); else if (x && typeof x === "object" && !Array.isArray(x)) walk(x, d + 1); } }; walk(j, 0); return out; };
    const live = norm({ say: deep(/^(current_?status|latest_?status|status|shipment_?status|state)$/i), eta: deep(/^(edd|eta|etd|expected_?delivery(_?date)?|estimated_?delivery(_?date)?)$/i), link: deep(/^(track(ing)?_?(url|link))$/i), raw: j });
    if (live.st === "unknown" && !live.ev.length) throw new TrackError("That address answered, but no status or scans could be found in its answer.");
    return live;
  },
};
async function beesLike(base: string, path: string, z: any, awb: string, name: string): Promise<Live> {
  const lg = await ask(base + "/users/login", post({ email: z.user, password: z.secret })), tok = typeof lg?.data === "string" ? lg.data : lg?.data?.token || lg?.token;
  if (!tok) throw new TrackError(`${name} didn't accept the email and password.`);
  const j = await ask(base + path + E(awb), { headers: { Authorization: "Bearer " + tok, Accept: "application/json" } });
  const d = j?.data; if (!d || j.status === false) throw new TrackError(S(j?.message, 160) || `${name} doesn't know that AWB number yet.`);
  return norm({ say: d.status, eta: d.edd || d.expected_delivery_date, raw: j, ev: arr(d.history).map((h: any) => ({ at: when(h.event_time), text: h.message || h.status_code, place: h.location })) });
}

/** Which saved connection can follow this order's parcel: the courier's own, else the aggregator it was booked
 *  with, else a multi-courier tracker, else the shop's own address. */
export function pickTracker(saved: Record<string, any>, courier: string): string {
  const ok = (id: string) => trackerReady(id, saved[id]);
  if (TRACKERS[courier] && ok(courier)) return courier;
  for (const kind of ["multi", "custom"] as TrackerKind[]) for (const id of Object.keys(TRACKERS)) if (TRACKERS[id].kind === kind && ok(id)) return id;
  // An aggregator's own courier name isn't on the order (it was shipped "with Delhivery" through Shiprocket): try the one aggregator saved.
  const aggs = Object.keys(TRACKERS).filter((id) => TRACKERS[id].kind === "agg" && ok(id)); return aggs.length === 1 ? aggs[0] : "";
}
export async function trackLive(id: string, z: any, awb: string, courier: string): Promise<Live> {
  const f = ASK[id]; if (!f) throw new TrackError("Unknown tracking service.");
  const n = String(awb || "").trim(); if (!/^[A-Za-z0-9][A-Za-z0-9 _-]{3,39}$/.test(n)) throw new TrackError("That doesn't look like a tracking number.");
  try { return await f(z, n, courier); } catch (e: any) { if (e instanceof TrackError) throw e; throw new TrackError("The tracking service's answer couldn't be read."); }
}
