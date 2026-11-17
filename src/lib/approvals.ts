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

/** What the client last said about a project, for its card: the newest link that is still open. */
export type RvSummary = { token: string; status: RvStatus; decided_by: string; decided_at: string | null; created_at: string; comments: number; last?: { who: string; body: string; kind: RvNote["kind"]; created_at: string }; /** The client wrote last: a reply is due. */ waiting: boolean };
export const summarise = (list: Review[]): RvSummary | undefined => {
  const r = list.find((x) => x.status !== "closed"); if (!r) return undefined;
  const theirs = r.notes.filter((n) => n.kind !== "reply"), last = theirs[theirs.length - 1], end = r.notes[r.notes.length - 1];
  return { token: r.token, status: r.status, decided_by: r.decided_by, decided_at: r.decided_at, created_at: r.created_at, comments: theirs.length, ...(last ? { last: { who: last.who, body: last.body.slice(0, 240), kind: last.kind, created_at: last.created_at } } : {}), waiting: !!end && end.kind === "comment" };
};
/** Every project's summary in one call; with an older database, one call for each project (a few at a time). */
export async function rvSummary(api: string, studio: string, projects: string[]): Promise<Record<string, RvSummary>> {
  try { const r = await cfCall<{ summary: Record<string, RvSummary> }>(api, `/rv/summary?${sc(studio)}`); if (r && r.summary) return r.summary; } catch { /* an older database: ask project by project */ }
  const out: Record<string, RvSummary> = {}, todo = projects.slice(0, 40);
  await Promise.all([0, 1, 2, 3].map(async () => { for (let id = todo.shift(); id; id = todo.shift()) { try { const s = summarise(await rvList(api, studio, id)); if (s) out[id] = s; } catch { /* no review links for it */ } } }));
  return out;
}
