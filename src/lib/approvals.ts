// Client approval: a project's draft shared by link for a client to look at, comment on and approve before it is
// published. The snapshot and the notes live in the Studio's Cloudflare database (worker/db-worker.ts, /rv/*).
import { cfCall } from "./cfdb";

export type RvNote = { id: number; who: string; body: string; page: string; kind: "comment" | "reply" | "approved" | "changes"; created_at: string };
export type RvStatus = "open" | "approved" | "changes" | "closed";
export type Review = { token: string; name: string; note: string; status: RvStatus; decided_by: string; decided_at: string | null; created_by: string; created_at: string; notes: RvNote[] };
export type ReviewView = { name: string; template: string; note: string; status: RvStatus; decided_by: string; decided_at: string | null; created_at: string; content: any; notes: RvNote[] };

const sc = (studio: string) => "scope=" + encodeURIComponent("studio:" + studio);
export const reviewLink = (token: string) => location.origin + location.pathname.replace(/[^/]*$/, "") + "#/review/" + token;
// ---- the Studio's side (signed in)
export const rvList = (api: string, studio: string, project: string) => cfCall<Review[]>(api, `/rv/list?${sc(studio)}&project=${encodeURIComponent(project)}`);
export const rvNew = (api: string, studio: string, o: { project: string; name: string; template: string; content: any; note: string }) => cfCall<{ token: string }>(api, `/rv/new?${sc(studio)}`, { method: "POST", body: JSON.stringify(o) });
export const rvReply = (api: string, studio: string, token: string, body: string, who: string) => cfCall(api, `/rv/reply?${sc(studio)}`, { method: "POST", body: JSON.stringify({ token, body, who }) });
export const rvClose = (api: string, studio: string, token: string) => cfCall(api, `/rv/close?${sc(studio)}`, { method: "POST", body: JSON.stringify({ token }) });
export const rvDelete = (api: string, studio: string, token: string) => cfCall(api, `/rv/delete?${sc(studio)}`, { method: "POST", body: JSON.stringify({ token }) });
// ---- the client's side (no sign-in: the link is the key)
const pub = async <T,>(api: string, path: string, body?: unknown): Promise<T> => {
  const r = await fetch(api.replace(/\/+$/, "") + path, body === undefined ? { cache: "no-store" } : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j?.error || "That didn't work. Try again."), { status: r.status });
  return j as T;
};
export const rvOpen = (api: string, token: string) => pub<ReviewView>(api, "/rv/" + token);
export const rvNote = (api: string, token: string, o: { who: string; body: string; page: string }) => pub<{ status: RvStatus; notes: RvNote[] }>(api, `/rv/${token}/note`, o);
export const rvDecide = (api: string, token: string, o: { who: string; decision: "approved" | "changes"; body: string }) => pub<{ status: RvStatus; notes: RvNote[] }>(api, `/rv/${token}/decide`, o);
/** Where a shared draft's pictures come from: every { path: "assets/…" } in the content, served through the link. */
export function rvAssets(api: string, token: string, content: any): Record<string, string> {
  const out: Record<string, string> = {}, base = api.replace(/\/+$/, "") + `/rv/${token}/f/`;
  const walk = (o: any) => { if (!o || typeof o !== "object") return; if (typeof o.path === "string" && o.path.startsWith("assets/")) out[o.path] = base + o.path.split("/").map(encodeURIComponent).join("/"); for (const v of Array.isArray(o) ? o : Object.values(o)) walk(v); };
  walk(content); return out;
}
export const STATUS_WORDS: Record<RvStatus, string> = { open: "Waiting for the client", approved: "Approved", changes: "Changes requested", closed: "Link closed" };
