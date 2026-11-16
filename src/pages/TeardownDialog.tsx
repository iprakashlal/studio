// "Delete & remove": says exactly what will be deleted, asks for the name to be typed, then shows what was removed
// and what is left to delete by hand. Used for a project's live site and for a client Studio.
import { useState } from "react";
import type { TearResult } from "../lib/teardown";
import { Modal } from "../ui/kit";

export function TeardownDialog({ title, name, plan, keeps, run, onDone, onClose }: {
  title: string; /** Typed to confirm. */ name: string; plan: string[]; /** What stays. */ keeps: string;
  run: (step: (s: string) => void) => Promise<TearResult>; onDone: (r: TearResult) => Promise<void> | void; onClose: () => void;
}) {
  const [typed, setTyped] = useState(""), [step, setStep] = useState(""), [res, setRes] = useState<TearResult | null>(null), [err, setErr] = useState("");
  const ok = typed.trim().toLowerCase() === name.trim().toLowerCase();
  const go = async () => {
    setErr(""); setStep("Starting");
    try { const r = await run(setStep); await onDone(r); setRes(r); }
    catch (e: any) { setErr(e?.message || "Something went wrong."); }
    setStep("");
  };
  return (
    <Modal title={title} onClose={step ? () => {} : onClose}
      footer={res ? <button type="button" className="btn btn-pri" onClick={onClose}>Done</button>
        : <><button type="button" className="btn" disabled={!!step} onClick={onClose}>Cancel</button><button type="button" className="btn btn-danger" disabled={!ok || !!step} onClick={go}>{step ? step + "…" : "Delete & remove"}</button></>}>
      {res ? (
        <div className="flex flex-col gap-3 text-sm" aria-label="Result">
          {res.done.length > 0 && <ul className="flex flex-col gap-1">{res.done.map((x) => <li key={x} className="text-emerald-300">✓ Removed: {x}</li>)}</ul>}
          {res.failed.length > 0 && <><b className="text-amber-200">Still there (delete these yourself, or fix and press Delete &amp; remove again):</b><ul className="flex flex-col gap-1">{res.failed.map((x) => <li key={x} className="text-amber-100">! {x}</li>)}</ul></>}
          {(res.notes || []).map((x) => <p key={x} className="text-ink-300">{x}</p>)}
          {!res.done.length && !res.failed.length && <p className="text-ink-300">There was nothing to remove.</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-3 text-sm">
          <p className="rounded-lg border border-red-400/40 bg-red-400/5 px-3 py-2 text-red-100"><b>This can't be undone.</b> These are deleted for good, from the services themselves:</p>
          <ul className="list-disc space-y-1 pl-5 text-ink-200" aria-label="What will be deleted">{plan.map((x) => <li key={x}>{x}</li>)}</ul>
          <p className="text-ink-400">{keeps}</p>
          <label className="flex flex-col gap-1.5"><span className="label">Type <b className="text-ink-100">{name}</b> to confirm</span>
            <input className="input" aria-label="Type the name to confirm" autoComplete="off" value={typed} disabled={!!step} onChange={(e) => setTyped(e.target.value)} /></label>
          {err && <p role="alert" className="text-red-300">{err}</p>}
        </div>
      )}
    </Modal>
  );
}
