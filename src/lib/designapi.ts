// "Design yourself" talks only to the Studio's own database on Cloudflare (worker/db-worker.ts): the request is
// saved there and emailed to the owners, the text is written there (or on this device), and the Studio's look for
// signed-out visitors comes from it. Without that database the page still works, but a request can't be sent from it.
import { cfCall } from "./cfdb";
import { loadHostConfig } from "./studiohost";
import type { Copy } from "./designs";

export type DesignHost = { api: string; studio: string };
export async function designHost(): Promise<DesignHost | null> {
  const hc = await loadHostConfig().catch(() => null);
  return hc && hc.kind === "cloudflare" ? { api: hc.api, studio: hc.studio } : null;
}

export type SubmitBody = { /** The saved progress this request comes from (it then moves out of Design previews). */ draft?: string; /** The pass earned by confirming the email with its code (or given instead when the database can't send mail). */ otp?: string; skip?: string; kind: string; name: string; person: string; phone: string; email: string; note: string; answers: Record<string, string>; copy?: Copy | null; logo?: string; pdf?: { name: string; b64: string } };
export const submitQuery = (h: DesignHost, b: SubmitBody) => cfCall(h.api, "/dq/" + encodeURIComponent(h.studio), { method: "POST", auth: false, body: JSON.stringify(b) });

export type Query = { id: number; name: string; kind: string; person: string; phone: string; email: string; note: string; answers: Record<string, string>; copy: Copy; status: "new" | "read" | "done"; mail: string; pdf_name: string; has_logo: boolean; created_at: string };
const sc = (h: DesignHost) => "scope=" + encodeURIComponent("studio:" + h.studio);
export const listQueries = (h: DesignHost) => cfCall<Query[]>(h.api, `/dq/list?${sc(h)}`);
export const queryFiles = (h: DesignHost, id: number) => cfCall<{ logo: string; pdf_name: string; pdf: string }>(h.api, `/dq/get?${sc(h)}&id=${id}`);
export const setQueryStatus = (h: DesignHost, id: number, status: string) => cfCall(h.api, `/dq/status?${sc(h)}`, { method: "POST", body: JSON.stringify({ id, status }) });
export const deleteQuery = (h: DesignHost, id: number) => cfCall(h.api, `/dq/delete?${sc(h)}`, { method: "POST", body: JSON.stringify({ id }) });

/** The Studio's name, logo and colours, as kept in its database (for people who aren't signed in). */
export type PublicBrand = { name: string; logo: string; v: number; tint: string; mode: "light" | "dark"; anim: string; layout: string; design: import("./designs").DesignSettings & { on: boolean } };
export async function publicBrand(h: DesignHost): Promise<PublicBrand | null> {
  try { return await cfCall<PublicBrand>(h.api, "/sb/" + encodeURIComponent(h.studio), { auth: false }); } catch { return null; }
}

/** A public web page, read by the Studio's database: its name, description and plain text. */
export type PageRead = { title?: string; site?: string; description?: string; text?: string; error?: string };
export async function readPage(h: DesignHost, url: string): Promise<PageRead> {
  try { return await cfCall<PageRead>(h.api, "/dq/read/" + encodeURIComponent(h.studio), { method: "POST", auth: false, body: JSON.stringify({ url }) }); } catch (e: any) { return { error: e?.message || "Couldn't read that page." }; }
}

/** What the Studio's AI picks out of a document or page's text (name, what they do, items, contact details), or nothing when the Picaffectz system is the engine: then the rules in this device read it. */
export type Understood = { engine?: string; fields?: Record<string, any> };
export async function understandText(h: DesignHost, kind: string, text: string): Promise<Understood> {
  try { return await cfCall<Understood>(h.api, "/dq/understand/" + encodeURIComponent(h.studio), { method: "POST", auth: false, body: JSON.stringify({ kind, text: text.slice(0, 9000) }) }); } catch { return {}; }
}

/** Confirm the visitor's email: a code is sent to it, and the right code earns a pass that the request must carry. */
export const otpSend = (h: DesignHost, email: string) => cfCall<{ ok: boolean; skip?: string }>(h.api, "/dq/otp/send/" + encodeURIComponent(h.studio), { auth: false, method: "POST", body: JSON.stringify({ email }) });
export const otpCheck = (h: DesignHost, email: string, code: string) => cfCall<{ ok: boolean; token: string }>(h.api, "/dq/otp/check/" + encodeURIComponent(h.studio), { auth: false, method: "POST", body: JSON.stringify({ email, code }) });

/** The pass a visitor earns by confirming their email (kept for this tab). */
export type Pass = { email: string; otp?: string; skip?: string };
const PASS = "site-studio:design-pass";
export const passLive = (p: Pass | null): p is Pass => { const t = p?.otp || p?.skip || ""; return !!p && +t.split(".")[0] > Date.now() + 60_000; };
export const readPass = (): Pass | null => { try { const p = JSON.parse(sessionStorage.getItem(PASS) || "null"); return p && typeof p.email === "string" && passLive(p) ? { email: p.email, ...(p.otp ? { otp: String(p.otp) } : {}), ...(p.skip ? { skip: String(p.skip) } : {}) } : null; } catch { return null; } };
export const writePass = (p: Pass | null) => { try { if (p) sessionStorage.setItem(PASS, JSON.stringify(p)); else sessionStorage.removeItem(PASS); } catch { /* private mode */ } };

/** Progress kept in the Studio's database while someone designs (after their email is confirmed): it shows in Projects → Design previews. */
export type DraftBody = { id: string; name: string; kind: string; themeId: string; themeName: string; summary: string; answers: Record<string, string>; copy?: Copy | null; logo?: string };
export const saveDraft = (h: DesignHost, pass: Pass, b: DraftBody) => cfCall(h.api, "/dq/draft/" + encodeURIComponent(h.studio), { method: "POST", auth: false, body: JSON.stringify({ ...(pass.otp ? { otp: pass.otp } : { skip: pass.skip }), email: pass.email, ...b }) });
export type Draft = { id: string; email: string; name: string; kind: string; themeId: string; themeName: string; summary: string; answers: Record<string, string>; copy: Copy; logo?: string; createdAt: string; updatedAt: string };
export const listDrafts = (h: DesignHost) => cfCall<Draft[]>(h.api, `/dq/drafts?${sc(h)}`);
export const deleteDraft = (h: DesignHost, id: string) => cfCall(h.api, `/dq/draft-delete?${sc(h)}`, { method: "POST", body: JSON.stringify({ id }) });
