// Small shared helpers. No framework code here.

export type Json = any;

export const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));

export function getP(o: Json, path: string): Json {
  return path.split(".").reduce((a, k) => (a == null ? a : a[k]), o);
}

export function setP(o: Json, path: string, v: Json): void {
  const ks = path.split(".");
  let a = o;
  for (let i = 0; i < ks.length - 1; i++) {
    if (a[ks[i]] == null || typeof a[ks[i]] !== "object") a[ks[i]] = {};
    a = a[ks[i]];
  }
  a[ks[ks.length - 1]] = v;
}

/** Deep-merge saved content over defaults. Arrays are replaced whole; missing keys keep defaults. */
export function merge(def: Json, val: Json): Json {
  if (Array.isArray(def)) return Array.isArray(val) ? val : def;
  if (def && typeof def === "object") {
    const out: Json = {};
    const v = val && typeof val === "object" && !Array.isArray(val) ? val : {};
    for (const k of Object.keys(def)) out[k] = merge(def[k], v[k]);
    for (const k of Object.keys(v)) if (!(k in out)) out[k] = v[k];
    return out;
  }
  return val === undefined ? def : val;
}

export function money(v: number | string, cur = "INR"): string {
  const n = Number(v) || 0;
  try {
    return new Intl.NumberFormat(cur === "INR" ? "en-IN" : "en-US", { style: "currency", currency: cur, maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
  } catch {
    return `${cur} ${n}`;
  }
}

export const slugify = (s: string) =>
  String(s || "").toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 48) || "item";

export const uid = (prefix = "") => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function timeAgo(iso?: string): string {
  if (!iso) return "never";
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

// ---------- base64 / bytes ----------
const enc = new TextEncoder();
export const textToBytes = (t: string) => enc.encode(t);
export function bytesToB64(u8: Uint8Array): string {
  let s = "";
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + 0x8000)));
  return btoa(s);
}
export const textToB64 = (t: string) => bytesToB64(textToBytes(t));
export const b64ToText = (b: string) => new TextDecoder().decode(Uint8Array.from(atob(String(b).replace(/\s/g, "")), (c) => c.charCodeAt(0)));
export async function blobToBytes(b: Blob): Promise<Uint8Array> {
  return new Uint8Array(await b.arrayBuffer());
}

// ---------- validation ----------
export const vpaOk = (v: string) => /^[A-Za-z0-9.\-_]{2,256}@[A-Za-z][A-Za-z0-9.\-]{1,63}$/.test(String(v || "").trim());
export const paypalOk = (v: string) => /^[A-Za-z0-9]{1,40}$/.test(String(v || "").trim());
export const httpsOk = (u: string) => /^https:\/\/[^\s]+$/i.test(String(u || "").trim());
export function hostIs(u: string, re: RegExp): boolean {
  try {
    return re.test(new URL(u).hostname);
  } catch {
    return false;
  }
}
export const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());
export const phoneOk = (v: string) => /^\+?[0-9 ]{8,16}$/.test(String(v || "").trim());

/** Every image reference in a content tree: objects shaped { path: "assets/uploads/..." }. */
export function collectAssetPaths(o: Json, out = new Set<string>()): Set<string> {
  if (Array.isArray(o)) o.forEach((x) => collectAssetPaths(x, out));
  else if (o && typeof o === "object") {
    if (typeof o.path === "string" && o.path.startsWith("assets/uploads/")) out.add(o.path);
    for (const k of Object.keys(o)) collectAssetPaths(o[k], out);
  }
  return out;
}

export function safeFileName(name: string): string {
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot).toLowerCase().replace(/[^.a-z0-9]/g, "") : "";
  return slugify(dot > 0 ? name.slice(0, dot) : name).slice(0, 40) + ext;
}

/** Base path of the current page, used to keep logins separate for sites sharing one github.io origin. */
export function basePath(): string {
  return location.pathname.replace(/[^/]*$/, "");
}
