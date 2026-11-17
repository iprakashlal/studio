// A private payment marker and note on a project card or a client Studio's tile: paid, part paid or due, with a
// note. It can be hidden (remembered on this device) so it isn't on screen when the Studio is shown to someone.
// It stays in this Studio: it is never part of a site, and isn't sent along when a site is shared with a client.
import { useEffect, useState } from "react";
import type { PayInfo } from "../lib/studio";

const KEY = "site-studio:pay-hidden";
const hiddenSet = (): Set<string> => { try { return new Set(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch { return new Set(); } };
const listeners = new Set<() => void>();
function setHidden(id: string, hide: boolean) { const s = hiddenSet(); hide ? s.add(id) : s.delete(id); try { localStorage.setItem(KEY, JSON.stringify([...s].slice(-500))); } catch { /* private mode */ } listeners.forEach((f) => f()); }

export const PAY_STATES: { id: NonNullable<PayInfo["state"]> | ""; label: string; cls: string; dot: string }[] = [
  { id: "", label: "Not set", cls: "border-ink-600 text-ink-400", dot: "bg-ink-500" },
  { id: "due", label: "Payment due", cls: "border-rose-400/50 text-rose-200", dot: "bg-rose-400" },
  { id: "part", label: "Part paid", cls: "border-amber-400/50 text-amber-200", dot: "bg-amber-400" },
  { id: "paid", label: "Paid", cls: "border-emerald-400/50 text-emerald-200", dot: "bg-emerald-400" },
];
const Eye = ({ off }: { off: boolean }) => <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{off && <path d="M4 4l16 16" />}</svg>;

export function PayNote({ id, pay, onSave, canEdit = true }: { /** What this belongs to, for remembering show / hide. */ id: string; pay?: PayInfo; onSave: (p: PayInfo) => Promise<unknown>; canEdit?: boolean }) {
  const [hidden, setHid] = useState(() => hiddenSet().has(id));
  useEffect(() => { const f = () => setHid(hiddenSet().has(id)); listeners.add(f); return () => { listeners.delete(f); }; }, [id]);
  const [edit, setEdit] = useState(false), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const [state, setState] = useState<string>(pay?.state || ""), [note, setNote] = useState(pay?.note || "");
  const cur = PAY_STATES.find((x) => x.id === (pay?.state || "")) || PAY_STATES[0];
  const open = () => { setState(pay?.state || ""); setNote(pay?.note || ""); setErr(""); setEdit(true); };
  const save = async () => { setBusy(true); setErr(""); try { await onSave({ ...(state ? { state: state as PayInfo["state"] } : {}), ...(note.trim() ? { note: note.trim().slice(0, 600) } : {}) }); setEdit(false); } catch (e: any) { setErr(e?.message || "Couldn't save. Try again."); } setBusy(false); };
  return (
    <div className="relative z-10 rounded-xl border border-ink-700 bg-ink-850/60 text-[13px]" aria-label="Payment and note">
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-ink-400">Payment</span>
        {hidden ? <span className="text-ink-500" aria-label="Hidden">• • •</span>
          : <span className={`chip gap-1.5 ${cur.cls}`} data-pay={cur.id || "none"}><i aria-hidden className={`h-1.5 w-1.5 rounded-full ${cur.dot}`} />{cur.label}</span>}
        <span className="ml-auto flex items-center gap-1">
          {!hidden && canEdit && !edit && <button type="button" className="rounded-md px-2 py-1 font-semibold text-brand-300 hover:bg-ink-800" onClick={open}>{pay?.state || pay?.note ? "Edit" : "Add"}</button>}
          <button type="button" className="grid h-7 w-7 place-items-center rounded-md text-ink-400 hover:bg-ink-800 hover:text-ink-100" aria-pressed={hidden} aria-label={hidden ? "Show payment and note" : "Hide payment and note"} title={hidden ? "Show payment and note" : "Hide payment and note (on this device)"} onClick={() => { setEdit(false); setHidden(id, !hidden); }}><Eye off={hidden} /></button>
        </span>
      </div>
      {!hidden && !edit && pay?.note && <p className="line-clamp-2 whitespace-pre-line border-t border-ink-700 px-3 py-2 text-ink-300" title={pay.note} data-pay-note>{pay.note}</p>}
      {!hidden && edit && <div className="flex flex-col gap-2 border-t border-ink-700 p-3">
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Payment status">
          {PAY_STATES.map((x) => <button key={x.id || "none"} type="button" role="radio" aria-checked={state === x.id} onClick={() => setState(x.id)} className={`chip gap-1.5 ${state === x.id ? "border-ink-100 bg-ink-100 text-ink-950" : x.cls}`}><i aria-hidden className={`h-1.5 w-1.5 rounded-full ${x.dot}`} />{x.label}</button>)}
        </div>
        <textarea className="input py-1.5 text-[13px]" rows={2} maxLength={600} aria-label="Payment note" placeholder="Note: amount, invoice number, date, what is still to come…" value={note} onChange={(e) => setNote(e.target.value)} />
        {err && <p role="alert" className="text-red-200">{err}</p>}
        <div className="flex items-center gap-2"><button type="button" className="btn btn-pri btn-sm" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</button><button type="button" className="btn btn-sm" disabled={busy} onClick={() => setEdit(false)}>Cancel</button><span className="ml-auto text-[12px] text-ink-500">Only seen in this Studio</span></div>
      </div>}
    </div>
  );
}
