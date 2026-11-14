// Settings → Migration on the original Studio: the projects in this Studio and in the moved one, side by side,
// to bring across the ones the moved Studio doesn't have (or chosen newer copies). The moved Studio's own
// projects are never removed, and a project there is only replaced when you tick it.
import { useState } from "react";
import { backendOf } from "../lib/backend";
import { bringProjects, compareProjects, type ProjectRow } from "../lib/migrate";
import type { HostedStudio } from "../lib/studiohost";
import type { Studio } from "../lib/studio";
import { fmtDate } from "../lib/util";
import { useToast } from "../ui/kit";

export function BringAcross({ here, prev }: { here: Studio; prev: HostedStudio }) {
  const toast = useToast();
  const be = backendOf({ kind: "cloudflare", api: prev.api!, studio: prev.studio });
  const [who, setWho] = useState<string | null | undefined>(undefined);
  const [email, setEmail] = useState(prev.owner || ""), [code, setCode] = useState(""), [sent, setSent] = useState(false);
  const [rows, setRows] = useState<ProjectRow[] | null>(null), [pick, setPick] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(""), [err, setErr] = useState("");
  const run = (label: string, f: () => Promise<void>) => async () => { setErr(""); setBusy(label); try { await f(); } catch (e: any) { setErr(e?.message || "Something went wrong."); } setBusy(""); };
  const compare = run("Comparing the projects", async () => {
    const w = await be.signedIn(); setWho(w); if (!w) return;
    const c = await compareProjects(here.repo, be.repo());
    setRows(c.rows); setPick(new Set(c.rows.filter((r) => r.here && !r.there).map((r) => r.id)));
  });
  const bring = run("Bringing them across", async () => {
    await bringProjects(here.repo, be.repo(), [...pick], setBusy);
    toast(`${pick.size} project${pick.size === 1 ? "" : "s"} brought across.`);
    const c = await compareProjects(here.repo, be.repo()); setRows(c.rows); setPick(new Set());
  });
  const when = (s?: string) => (s ? fmtDate(s) : "");
  return (
    <section className="card flex flex-col gap-3 p-5" aria-label="Projects in both Studios">
      <h3 className="text-[15px] font-extrabold">Projects in both Studios</h3>
      <p className="text-sm text-ink-300">See which projects are only here, only in the moved Studio (<a className="underline" href={prev.url} target="_blank" rel="noopener noreferrer">{prev.url.replace(/^https:\/\//, "")}</a>) or in both, and bring across what it's missing. Projects in the moved Studio are never removed, and one is only replaced when you tick it.</p>
      {!rows && who === null && (
        <div className="flex flex-col gap-2 rounded-lg border border-ink-700 p-3">
          <p className="text-[13px] text-ink-300">Sign in to the moved Studio with your email code first.</p>
          <div className="flex flex-wrap gap-2">
            <input className="input min-w-0 flex-1" type="email" aria-label="Moved Studio email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button type="button" className="btn btn-sm" disabled={!email.includes("@") || !!busy} onClick={run("Sending", async () => { await be.sendCode(email.trim()); setSent(true); })}>{sent ? "Send again" : "Send code"}</button>
          </div>
          {sent && <div className="flex flex-wrap gap-2"><input className="input w-40" inputMode="numeric" aria-label="Moved Studio code" placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} /><button type="button" className="btn btn-sm btn-pri" disabled={code.trim().length < 6 || !!busy} onClick={run("Checking", async () => { await be.verifyCode(email.trim(), code.trim()); setCode(""); setSent(false); await compare(); })}>Sign in</button></div>}
        </div>
      )}
      {!rows && who !== null && <button type="button" className="btn btn-sm self-start" disabled={!!busy} onClick={compare}>{busy ? busy + "…" : "Compare the projects"}</button>}
      {rows && <>
        <div className="flex flex-col gap-1.5" aria-label="Project list">
          {rows.map((r) => {
            const both = !!(r.here && r.there), can = !!r.here && !(both && r.same);
            const note = !r.there ? "Only here: tick to bring it across" : !r.here ? "Only in the moved Studio: stays as it is" : r.same ? "The same in both" : `Different. Here: changed ${when(r.here)}. Moved Studio: changed ${when(r.there)}. Tick only to replace the moved Studio's copy with this one.`;
            return (
              <label key={r.id} className={`flex items-start gap-3 rounded-lg border p-2.5 ${both && !r.same ? "border-amber-400/40" : "border-ink-700"}`}>
                <input type="checkbox" className="mt-1" disabled={!can || !!busy} checked={pick.has(r.id)} onChange={(e) => { const n = new Set(pick); e.target.checked ? n.add(r.id) : n.delete(r.id); setPick(n); }} />
                <span className="min-w-0"><b className="text-ink-100">{r.name}</b><span className="block text-[12.5px] text-ink-400">{note}</span></span>
              </label>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-pri btn-sm" disabled={!pick.size || !!busy} onClick={bring}>{busy || `Bring ${pick.size} across`}</button>
          <button type="button" className="btn btn-sm" disabled={!!busy} onClick={compare}>Compare again</button>
        </div>
      </>}
      {err && <p role="alert" className="text-sm text-red-300">{err}</p>}
    </section>
  );
}
