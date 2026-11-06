import { useState } from "react";
import { useConfirm, useToast } from "../ui/kit";

/** Copy the content as JSON, restore a copy, or reset to the template's starting content. */
export function BackupPanel({ draft, onReplace, loadDefaults }: { draft: any; onReplace: (c: any) => void; loadDefaults: () => Promise<any> }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [txt, setTxt] = useState("");
  const [err, setErr] = useState("");
  return (
    <>
      <section className="card flex flex-col gap-3 p-5">
        <h3 className="text-[15px] font-extrabold">Back up</h3>
        <p className="text-sm text-ink-300">Copies everything in the editor, including unsaved changes. Every save is also a commit on GitHub, so the repository history is a backup too.</p>
        <button type="button" className="btn self-start" onClick={() => {
          const t = JSON.stringify(draft, null, 2);
          navigator.clipboard.writeText(t).then(() => toast("Content copied"), () => { setTxt(t); toast("Copy it from the box below"); });
        }}>Copy content as JSON</button>
      </section>
      <section className="card flex flex-col gap-3 p-5">
        <h3 className="text-[15px] font-extrabold">Restore</h3>
        <label className="label" htmlFor="restore">Paste a backup</label>
        <textarea id="restore" className="input min-h-[140px] font-mono text-xs" spellCheck={false} value={txt} onChange={(e) => setTxt(e.target.value)} />
        <p role="alert" className="text-sm text-red-300">{err}</p>
        <button type="button" className="btn self-start" onClick={() => {
          try {
            const v = JSON.parse(txt);
            if (!v || typeof v !== "object" || !v.theme) throw new Error();
            onReplace(v);
            setErr("");
            toast("Backup loaded into the editor. Save to keep it.");
          } catch {
            setErr("That isn't a valid backup. Paste the full text from “Copy content as JSON”.");
          }
        }}>Load backup into editor</button>
      </section>
      <section className="card flex flex-col gap-3 p-5">
        <h3 className="text-[15px] font-extrabold">Reset</h3>
        <p className="text-sm text-ink-300">Replaces everything in the editor with the template's starting content. Nothing changes on the site until you save.</p>
        <button type="button" className="btn btn-danger self-start" onClick={async () => {
          if (!(await confirm("Reset all content?", "The editor goes back to the template's starting content. You can still discard before saving.", "Reset", true))) return;
          try { onReplace(await loadDefaults()); toast("Reset in the editor. Save to keep it."); } catch (e: any) { toast(e?.message || "Couldn't load the starting content.", "bad"); }
        }}>Reset to starting content</button>
      </section>
    </>
  );
}
