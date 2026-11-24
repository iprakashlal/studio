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

export type SubmitBody = { kind: string; name: string; person: string; phone: string; email: string; note: string; answers: Record<string, string>; copy?: Copy | null; logo?: string; pdf?: { name: string; b64: string } };
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
