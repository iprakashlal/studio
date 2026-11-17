// Project → Share for approval: make a review link from the project's current content, see what the client said,
// reply, and close the link. Needs a Studio on Cloudflare (the snapshot and notes live in its database).
import { useEffect, useState } from "react";
import type { ProjectMeta } from "../lib/studio";
import { loadHostConfig } from "../lib/studiohost";
import { reviewLink, rvClose, rvDelete, rvList, rvNew, rvReply, STATUS_WORDS, type Review } from "../lib/approvals";
import { Modal, useToast, SkelLines } from "../ui/kit";
import { NoteList } from "./ReviewPage";

const day = (iso: string) => { try { return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }); } catch { return ""; } };
export function ApprovalDialog({ project, draft, dirty, me, onClose }: { project: ProjectMeta; draft: any; dirty: boolean; me: string; onClose: () => void }) {
  const toast = useToast();
  const [db, setDb] = useState<{ api: string; studio: string } | null | undefined>(undefined);
  const [list, setList] = useState<Review[] | null>(null), [err, setErr] = useState(""), [note, setNote] = useState(""), [busy, setBusy] = useState("");
  const [reply, setReply] = useState<Record<string, string>>({}), [open, setOpen] = useState<string>("");
  const load = async (d = db) => {
    if (!d) return;
    try { const l = await rvList(d.api, d.studio, project.id); setList(l); setOpen((o) => o || l.find((x) => x.status !== "closed")?.token || ""); setErr(""); }
    catch (e: any) { setErr(/no such table|Unknown scope|Not found/i.test(e?.message || "") || e?.status === 404 ? "Update the database once to use this: Settings → Hostings → Update the database." : e?.message || "Couldn't load the review links."); }
  };
  useEffect(() => { loadHostConfig().then((h) => { const d = h?.kind === "cloudflare" ? { api: h.api, studio: h.studio } : null; setDb(d); if (d) load(d); }).catch(() => setDb(null)); }, []);
  const run = async (k: string, f: () => Promise<unknown>, okMsg?: string) => { setBusy(k); try { await f(); if (okMsg) toast(okMsg); await load(); } catch (e: any) { toast(e?.message || "That didn't work.", "bad"); } setBusy(""); };
  const share = () => run("new", async () => { const r = await rvNew(db!.api, db!.studio, { project: project.id, name: project.name, template: project.template, content: draft, note }); setNote(""); setOpen(r.token); await navigator.clipboard?.writeText(reviewLink(r.token)).catch(() => {}); }, "Review link made and copied. Send it to your client.");
  const copy = (t: string) => navigator.clipboard?.writeText(reviewLink(t)).then(() => toast("Link copied."), () => toast("Couldn't copy. Select the link and copy it.", "bad"));
  const live = (list || []).filter((r) => r.status !== "closed"), latest = live[0];
  return (
    <Modal title="Share for approval" onClose={onClose} wide>
      <div className="flex flex-col gap-4 text-sm">
        {db === undefined ? <SkelLines n={4} /> : !db ? (
          <p className="rounded-lg border border-amber-400/40 bg-amber-400/5 px-3 py-2.5 text-amber-100">Sharing for approval needs the Studio on Cloudflare, where the review link and the client's comments are kept. Move it under Settings → Migration.</p>
        ) : <>
          <p className="text-ink-300">Send your client a private link to this project as it is now. They see the whole site in a live preview, on any device, without signing in, and can comment, ask for changes or approve. Nothing is published by sharing.</p>
          {latest && <p className={`rounded-lg border px-3 py-2 text-[13.5px] ${latest.status === "approved" ? "border-emerald-400/40 bg-emerald-400/5 text-emerald-100" : latest.status === "changes" ? "border-amber-400/40 bg-amber-400/5 text-amber-100" : "border-ink-700 bg-ink-850 text-ink-200"}`} aria-label="Approval status">
            <b>{latest.status === "approved" ? `Approved by ${latest.decided_by} on ${day(latest.decided_at || "")}.` : latest.status === "changes" ? `${latest.decided_by} asked for changes on ${day(latest.decided_at || "")}.` : "Waiting for the client."}</b>{latest.status === "approved" ? " That approval is for the version shared on " + day(latest.created_at) + ": share again if you have changed the site since." : ""}</p>}
          <div className="flex flex-col gap-2 rounded-xl border border-ink-700 p-3.5">
            <b>{live.length ? "Share a new version" : "Make a review link"}</b>
            <textarea className="input py-1.5" rows={2} aria-label="Note for the client" maxLength={2000} placeholder="A note for the client (optional): what changed, what to look at" value={note} onChange={(e) => setNote(e.target.value)} />
            {dirty && <p className="text-[13px] text-amber-200">You have unsaved changes: they are included in what you share.</p>}
            <button type="button" className="btn btn-pri self-start" disabled={!!busy || !draft} onClick={share}>{busy === "new" ? "Making the link…" : "Make the link and copy it"}</button>
          </div>
          {err && <p role="alert" className="rounded-lg border border-red-400/40 bg-red-400/5 px-3 py-2 text-[13px] text-red-200">{err}</p>}
          {list && list.length > 0 && <ul className="flex flex-col gap-2" aria-label="Review links">
            {list.map((r) => {
              const isOpen = open === r.token, last = r.notes[r.notes.length - 1];
              return (
                <li key={r.token} className="overflow-hidden rounded-xl border border-ink-700">
                  <button type="button" aria-expanded={isOpen} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-2.5 text-left" onClick={() => setOpen(isOpen ? "" : r.token)}>
                    <b>Shared {day(r.created_at)}</b>
                    <span className={`chip ${r.status === "approved" ? "border-emerald-400/50 text-emerald-200" : r.status === "changes" ? "border-amber-400/50 text-amber-200" : r.status === "closed" ? "text-ink-400" : ""}`}>{STATUS_WORDS[r.status]}</span>
                    <span className="ml-auto text-[12.5px] text-ink-400">{r.notes.length} comment{r.notes.length === 1 ? "" : "s"}{last && last.kind !== "reply" ? " · last from " + last.who : ""}</span>
                  </button>
                  {isOpen && <div className="flex flex-col gap-3 border-t border-ink-700 p-3.5">
                    {r.status !== "closed" && <div className="flex flex-wrap items-center gap-2"><input readOnly className="input min-w-0 flex-1 py-1.5 font-mono text-[12.5px]" aria-label="Review link" value={reviewLink(r.token)} onFocus={(e) => e.target.select()} /><button type="button" className="btn btn-sm" onClick={() => copy(r.token)}>Copy</button><a className="btn btn-sm" href={reviewLink(r.token)} target="_blank" rel="noopener noreferrer">Open ↗</a></div>}
                    {r.note && <p className="text-[13px] text-ink-300"><b>Your note:</b> {r.note}</p>}
                    <NoteList notes={r.notes} />
                    {r.status !== "closed" && <div className="flex flex-wrap gap-2"><input className="input min-w-0 flex-1 py-1.5" aria-label="Reply to the client" placeholder="Reply to the client…" value={reply[r.token] || ""} onChange={(e) => setReply((m) => ({ ...m, [r.token]: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter" && (reply[r.token] || "").trim() && !busy) run("reply", async () => { await rvReply(db.api, db.studio, r.token, reply[r.token].trim(), me); setReply((m) => ({ ...m, [r.token]: "" })); }); }} />
                      <button type="button" className="btn btn-sm" disabled={!!busy || !(reply[r.token] || "").trim()} onClick={() => run("reply", async () => { await rvReply(db.api, db.studio, r.token, reply[r.token].trim(), me); setReply((m) => ({ ...m, [r.token]: "" })); })}>Reply</button></div>}
                    <div className="flex flex-wrap gap-2 text-[13px]">
                      {r.status !== "closed" ? <button type="button" className="btn btn-sm btn-ghost" disabled={!!busy} title="The link stops working; the comments stay here." onClick={() => run("close", () => rvClose(db.api, db.studio, r.token), "Link closed. It no longer opens.")}>Close this link</button>
                        : <button type="button" className="btn btn-sm btn-ghost" disabled={!!busy} onClick={() => run("del", () => rvDelete(db.api, db.studio, r.token), "Removed.")}>Remove from this list</button>}
                      <button type="button" className="btn btn-sm btn-ghost ml-auto" disabled={!!busy} onClick={() => load()}>Check for new comments</button>
                    </div>
                  </div>}
                </li>
              );
            })}
          </ul>}
          <p className="text-[12.5px] text-ink-400">Anyone with a link can open that preview, so send it only to the people who should review. Each link shows the site as it was when you made it; replies you write appear on the client's page, and you get an email when they comment or decide (when the Studio's email is set up).</p>
        </>}
      </div>
    </Modal>
  );
}
