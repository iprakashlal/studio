// #/review/<token>: what a client sees from a "Share for approval" link. The draft site in a live preview, the
// designer's note, a thread of comments, and Approve / Request changes. No sign-in: the link is the key.
import { useEffect, useMemo, useRef, useState } from "react";
import type { StudioHostCfg } from "../lib/studiohost";
import { TEMPLATES } from "../schema";
import { Preview } from "../editor/Preview";
import { loadMergeBase } from "../lib/exporter";
import { merge } from "../lib/util";
import { rvAssets, rvDecide, rvNote, rvOpen, STATUS_WORDS, type ReviewView, type RvNote } from "../lib/approvals";
import { BrandMark, useBrand } from "../lib/brand";
import { Logo } from "../ui/kit";

const NAME_KEY = "studio-review-name";
const when = (iso: string) => { try { return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }); } catch { return ""; } };
export function NoteList({ notes, mine }: { notes: RvNote[]; mine?: string }) {
  if (!notes.length) return <p className="text-[13px] text-ink-400">No comments yet.</p>;
  return (
    <ul className="flex flex-col gap-2" aria-label="Comments">
      {notes.map((n) => (
        <li key={n.id} className={`rounded-lg border px-3 py-2 text-[13.5px] ${n.kind === "approved" ? "border-emerald-400/40 bg-emerald-400/5" : n.kind === "changes" ? "border-amber-400/40 bg-amber-400/5" : n.kind === "reply" ? "border-brand-400/40 bg-brand-500/10" : "border-ink-700 bg-ink-900"}`}>
          <div className="flex flex-wrap items-baseline gap-x-2 text-[12px] text-ink-400"><b className="text-ink-100">{n.who}{mine && n.who === mine ? " (you)" : ""}</b>{n.kind === "reply" && <span>the designer</span>}{n.kind === "approved" && <span className="font-semibold text-emerald-300">approved this</span>}{n.kind === "changes" && <span className="font-semibold text-amber-200">asked for changes</span>}<span>{when(n.created_at)}</span>{n.page && <span>· on {n.page}</span>}</div>
          {n.body && <p className="mt-1 whitespace-pre-wrap break-words text-ink-200">{n.body}</p>}
        </li>
      ))}
    </ul>
  );
}

export function ReviewPage({ token, host }: { token: string; host: StudioHostCfg | null }) {
  const b = useBrand();
  const api = host?.kind === "cloudflare" ? host.api : "";
  const [rv, setRv] = useState<ReviewView | null>(null), [err, setErr] = useState(""), [content, setContent] = useState<any>(null);
  const [who, setWho] = useState(() => { try { return localStorage.getItem(NAME_KEY) || ""; } catch { return ""; } });
  const [body, setBody] = useState(""), [busy, setBusy] = useState(""), [said, setSaid] = useState(""), [panel, setPanel] = useState(true);
  const page = useRef("");
  useEffect(() => {
    document.title = "Review · " + b.name;
    if (!api) { setErr("This Studio can't show review links."); return; }
    rvOpen(api, token).then(async (r) => { const base = await loadMergeBase(r.template).catch(() => ({})); setContent(merge(base, r.content || {})); setRv(r); document.title = `${r.name} · Review`; })
      .catch((e) => setErr(e?.status === 410 ? e.message : e?.status === 404 ? "This review link isn't valid. Check that you copied all of it." : e?.message || "Couldn't open the review."));
  }, [api, token]);
  const tpl = rv ? TEMPLATES[rv.template] : null;
  const assets = useMemo(() => (rv && api ? rvAssets(api, token, rv.content) : {}), [rv?.created_at, api, token]);
  const keepName = (v: string) => { setWho(v); try { localStorage.setItem(NAME_KEY, v); } catch { /* private mode */ } };
  const curPage = () => { try { const f = document.querySelector<HTMLIFrameElement>('iframe[name="cms-preview"]'); const p = f?.contentWindow?.location.pathname.split("/").pop() || ""; return p && p !== "index.html" ? p.replace(/\.html$/, "") : "Home"; } catch { return page.current; } };
  const send = async (kind: "comment" | "approved" | "changes") => {
    setSaid("");
    if (!who.trim()) return setSaid("Enter your name first, so the designer knows who this is from.");
    if (kind !== "approved" && !body.trim()) return setSaid(kind === "changes" ? "Say what should change." : "Write your comment.");
    setBusy(kind);
    try {
      const r = kind === "comment" ? await rvNote(api, token, { who: who.trim(), body: body.trim(), page: curPage() }) : await rvDecide(api, token, { who: who.trim(), decision: kind, body: body.trim() });
      setRv((x) => (x ? { ...x, status: r.status, notes: r.notes, ...(kind !== "comment" ? { decided_by: who.trim(), decided_at: new Date().toISOString() } : {}) } : x)); setBody("");
      setSaid(kind === "approved" ? "Thank you. Your approval has been recorded and the designer has been told." : kind === "changes" ? "Sent. The designer has your changes." : "Comment added.");
    } catch (e: any) { setSaid(e?.message || "That didn't work. Try again."); }
    setBusy("");
  };
  if (err) return <div className="grid min-h-screen place-items-center bg-ink-950 p-6"><div className="card max-w-md p-6 text-center"><h1 className="text-lg font-extrabold">Review link</h1><p role="alert" className="mt-2 text-sm text-ink-300">{err}</p></div></div>;
  if (!rv || !tpl || !content) return <div className="grid min-h-screen place-items-center bg-ink-950 text-sm text-ink-300">Opening the review…</div>;
  const done = rv.status === "approved" || rv.status === "changes";
  return (
    <div className="flex h-screen min-h-0 flex-col bg-ink-950">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-ink-700 bg-ink-900 px-3 py-2.5 sm:px-4">
        <span className="flex items-center gap-2 font-extrabold"><BrandMark fallback={<Logo />} />{b.name}</span>
        <span className="min-w-0 flex-1 truncate text-sm text-ink-300">For your review: <b className="text-ink-100">{rv.name}</b></span>
        <span className={`chip ${rv.status === "approved" ? "border-emerald-400/50 text-emerald-200" : rv.status === "changes" ? "border-amber-400/50 text-amber-200" : ""}`} aria-label="Review status">{rv.status === "approved" ? `Approved by ${rv.decided_by}` : rv.status === "changes" ? `Changes requested by ${rv.decided_by}` : "Waiting for your review"}</span>
        <button type="button" className="btn btn-sm lg:hidden" aria-expanded={panel} onClick={() => setPanel(!panel)}>{panel ? "Hide comments" : "Comments"}</button>
      </header>
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className={`min-h-0 min-w-0 flex-col ${panel ? "hidden lg:flex" : "flex"}`}><Preview tpl={tpl} base={`templates/${tpl.id}/`} content={content} version={1} assets={assets} editable={false} /></div>
        <aside className={`min-h-0 flex-col gap-3 overflow-auto border-l border-ink-700 bg-ink-900 p-4 ${panel ? "flex" : "hidden lg:flex"}`} aria-label="Review">
          <p className="text-[13px] text-ink-300">This is a preview of the site before it goes live. Look through its pages (use the page list above the preview, and try Phone), leave comments, then approve it or ask for changes.</p>
          {rv.note && <div className="rounded-lg border border-brand-400/40 bg-brand-500/10 px-3 py-2 text-[13.5px]"><b className="text-[12px] text-ink-300">A note from the designer</b><p className="mt-1 whitespace-pre-wrap text-ink-100">{rv.note}</p></div>}
          <NoteList notes={rv.notes} mine={who.trim()} />
          <div className="mt-auto flex flex-col gap-2 border-t border-ink-700 pt-3">
            <label className="flex flex-col gap-1"><span className="label">Your name</span><input className="input py-1.5" aria-label="Your name" value={who} maxLength={80} onChange={(e) => keepName(e.target.value)} /></label>
            <label className="flex flex-col gap-1"><span className="label">Comment</span><textarea className="input py-1.5" rows={3} aria-label="Comment" maxLength={2000} placeholder="What do you think? Mention the page or section." value={body} onChange={(e) => setBody(e.target.value)} /></label>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn" disabled={!!busy} onClick={() => send("comment")}>{busy === "comment" ? "Sending…" : "Add comment"}</button>
              <button type="button" className="btn" disabled={!!busy} onClick={() => send("changes")}>{busy === "changes" ? "Sending…" : "Request changes"}</button>
              <button type="button" className="btn btn-pri ml-auto" disabled={!!busy} onClick={() => send("approved")}>{busy === "approved" ? "Sending…" : rv.status === "approved" ? "Approve again" : "Approve"}</button>
            </div>
            {said && <p role="status" className="text-[13px] text-ink-200">{said}</p>}
            {done && !said && <p className="text-[12.5px] text-ink-400">{STATUS_WORDS[rv.status]} on {when(rv.decided_at || "")}. You can still add comments or change your decision.</p>}
            <p className="text-[12px] text-ink-500">Anyone with this link can see the preview and these comments. Share it only with people who should review.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
