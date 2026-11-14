// Warranty & service-status records for shop and business sites.
//
// Two files next to the site's photos (works on GitHub Pages, Cloudflare and Supabase alike):
//  - assets/data/warranty.json: what the site reads. Each record is encrypted with a key made from its own number
//    (and the last 4 phone digits or email, when the site asks for them) and filed under a hash of the same, so
//    the file can't be listed or read without knowing a number. Same scheme as src/fx/warranty.js.
//  - assets/data/warranty-admin.json: the full list for the admin page, encrypted with the records password.
import type { Repo } from "./repo";
import { textToB64 } from "./util";

export const W_PUBLIC = "assets/data/warranty.json";
export const W_ADMIN = "assets/data/warranty-admin.json";
const ITER = 20000, ADMIN_ITER = 310000;
const enc = new TextEncoder(), dec = new TextDecoder();

export type WHistory = { at: string; status: string; note?: string };
export type WRecord = { id: string; number: string; product: string; customer?: string; phone?: string; email?: string; purchased?: string; months?: number; status: string; note?: string; history: WHistory[]; updated: string };
export type WVerify = "none" | "phone4" | "email";
export type WStatus = { id: string; label: string; tone?: string };
type AdminBlob = { records: WRecord[]; salt: string };

const b64 = (b: Uint8Array) => { let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const rand = (n: number) => crypto.getRandomValues(new Uint8Array(n));
export const normNumber = (s: string) => String(s || "").toUpperCase().replace(/[\s\-_/.]+/g, "");
export const extraOf = (kind: WVerify, r: Pick<WRecord, "phone" | "email">) => kind === "phone4" ? String(r.phone || "").replace(/\D/g, "").slice(-4) : kind === "email" ? String(r.email || "").trim().toLowerCase() : "";

async function derive(salt: string, num: string, extra: string) {
  const k = await crypto.subtle.importKey("raw", enc.encode(normNumber(num) + "|" + extra), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: enc.encode("sw|" + salt), iterations: ITER, hash: "SHA-256" }, k, 512);
  return { id: hex(bits.slice(0, 32)), key: bits.slice(32) };
}
async function seal(keyBytes: ArrayBuffer, data: unknown) {
  const iv = rand(12), k = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k, enc.encode(JSON.stringify(data))));
  const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12); return b64(out);
}
async function unseal<T>(keyBytes: ArrayBuffer, blob: string): Promise<T> {
  const raw = unb64(blob), k = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["decrypt"]);
  return JSON.parse(dec.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: raw.slice(0, 12) }, k, raw.slice(12))));
}
async function passKey(password: string, salt: Uint8Array, iter: number) {
  const k = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  return crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: iter, hash: "SHA-256" }, k, 256);
}

/** What a customer sees: no phone or email, and the customer's name only if the site shows it. */
const publicPart = (r: WRecord, statuses: WStatus[]) => {
  const st = statuses.find((s) => s.id === r.status);
  return { product: r.product, customer: r.customer || undefined, purchased: r.purchased || undefined, months: r.months || undefined, status: r.status, statusLabel: st?.label, tone: st?.tone, note: r.note || undefined,
    history: r.history.map((h) => ({ at: h.at, status: h.status, label: statuses.find((s) => s.id === h.status)?.label, note: h.note || undefined })), updated: r.updated };
};
/** Records whose number (and phone/email, when asked for) can't be looked up. */
export const missingExtra = (records: WRecord[], verify: WVerify) => verify === "none" ? [] : records.filter((r) => !extraOf(verify, r));

/** The file the site reads, from every record. */
export async function buildPublic(records: WRecord[], salt: string, verify: WVerify, statuses: WStatus[], onStep?: (done: number, total: number) => void) {
  const e: Record<string, string> = {};
  let n = 0;
  for (const r of records) {
    if (!normNumber(r.number)) continue;
    const d = await derive(salt, r.number, extraOf(verify, r));
    e[d.id] = await seal(d.key, publicPart(r, statuses));
    onStep?.(++n, records.length);
  }
  return { v: 1, salt, verify, e };
}

export type WAdmin = { salt: string; records: WRecord[]; password: string };
/** Reads the admin file: null when the records aren't set up yet. */
export async function adminFile(repo: Repo) { const f = await repo.getText(W_ADMIN); return f ? JSON.parse(f.text) as { v: 1; salt: string; iter: number; data: string } : null; }
export async function unlock(file: { salt: string; iter: number; data: string }, password: string): Promise<AdminBlob> {
  try { return await unseal<AdminBlob>(await passKey(password, unb64(file.salt), file.iter), file.data); }
  catch { throw new Error("That isn't the records password."); }
}
/** Writes both files: the encrypted list for the admin page and the lookup file for the site. */
export async function saveRecords(repo: Repo, a: WAdmin, verify: WVerify, statuses: WStatus[], onStep?: (s: string) => void) {
  const ps = rand(16);
  const admin = { v: 1, salt: b64(ps), iter: ADMIN_ITER, data: await seal(await passKey(a.password, ps, ADMIN_ITER), { records: a.records, salt: a.salt }) };
  const pub = await buildPublic(a.records, a.salt, verify, statuses, (d, t) => onStep?.(`Encrypting records (${d} of ${t})`));
  onStep?.("Saving to the site");
  await repo.pushFiles([{ path: W_ADMIN, base64: textToB64(JSON.stringify(admin)) }, { path: W_PUBLIC, base64: textToB64(JSON.stringify(pub)) }], "Update warranty records");
}
export const newSalt = () => b64(rand(16));
export const newId = () => Math.random().toString(36).slice(2, 10);

// ---------------------------------------------------------------- CSV
const CSV_COLS = ["number", "product", "customer", "phone", "email", "purchased", "months", "status", "note"] as const;
export function toCsv(records: WRecord[]) {
  const q = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [CSV_COLS.join(","), ...records.map((r) => CSV_COLS.map((c) => q((r as any)[c])).join(","))].join("\n");
}
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []; let row: string[] = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; continue; }
    if (c === '"') q = true; else if (c === ",") { row.push(cur); cur = ""; } else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; } else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((x) => x.trim()));
  if (!head) return [];
  const keys = head.map((h) => h.trim().toLowerCase().replace(/[^a-z]/g, ""));
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] || "").trim()])));
}
