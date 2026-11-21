// Settings: who can sign in to this Studio (emailed code, or Google once it's on). The people are the Studio's
// members on its Cloudflare database; owners add and remove them here.
import { useEffect, useState } from "react";
import { cfCall } from "../lib/cfdb";
import { loadHostConfig } from "../lib/studiohost";
import { Field, Skel, useConfirm, useToast } from "../ui/kit";

type P = { email: string; role: string };
const ROLE: Record<string, string> = { owner: "Owner", member: "Member", partner: "Partner (your Studio partner)" };

export function StudioPeopleCard() {
  const toast = useToast(), confirm = useConfirm();
  const [cfg, setCfg] = useState<{ api: string; studio: string } | null>(null), [list, setList] = useState<P[] | null>(null), [err, setErr] = useState("");
  const [add, setAdd] = useState(""), [role, setRole] = useState("member"), [busy, setBusy] = useState(false);
  useEffect(() => { let live = true; loadHostConfig().then((c) => { if (live && c?.kind === "cloudflare") setCfg({ api: c.api, studio: c.studio }); }).catch(() => {}); return () => { live = false; }; }, []);
  const scope = cfg ? "scope=" + encodeURIComponent("studio:" + cfg.studio) : "";
  const load = async () => {
    if (!cfg) return; setErr("");
    try { setList(await cfCall<P[]>(cfg.api, "/m?" + scope)); }
    catch (e: any) { setErr(e?.status === 401 ? "Sign in to this Studio on this device to see them." : e?.message || "Couldn't load them."); }
  };
  useEffect(() => { load(); }, [cfg?.api, cfg?.studio]);
  if (!cfg) return null;
  const run = async (f: () => Promise<void>) => { setBusy(true); try { await f(); await load(); } catch (e: any) { toast(e?.message || "That didn't work.", "bad"); } setBusy(false); };
  const doAdd = () => run(async () => {
    const mails = [...new Set(add.split(/[,;\s]+/).map((x) => x.trim().toLowerCase()).filter(Boolean))];
    const bad = mails.find((m) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m)); if (bad) throw new Error(`${bad} isn't an email address.`);
    if (!mails.length) return;
    for (const email of mails.slice(0, 10)) await cfCall(cfg.api, "/m/add?" + scope, { method: "POST", body: JSON.stringify({ email, role }) });
    setAdd(""); toast(`${mails.length === 1 ? mails[0] + " can" : mails.length + " people can"} now sign in to this Studio.`);
  });
  const doRemove = async (p: P) => {
    const owners = (list || []).filter((x) => x.role === "owner").length;
    if (!(await confirm(`Remove ${p.email}?`, `They can no longer sign in to this Studio.${p.role === "owner" && owners <= 1 ? " This is the only owner: you'd lose the ability to change settings until another owner is added." : ""}`, "Remove", true))) return;
    run(async () => { await cfCall(cfg.api, "/m/remove?" + scope, { method: "POST", body: JSON.stringify({ email: p.email }) }); toast(`${p.email} removed.`); });
  };
  return (
    <section className="card flex flex-col gap-3 p-5" aria-label="People who can sign in to this Studio">
      <h3 className="text-[15px] font-extrabold">Who can sign in to this Studio</h3>
      <p className="text-sm text-ink-300">Only these email addresses can open this Studio, with an emailed 6-digit code (or Sign in with Google, if you turn it on below). <b>Owners</b> can change everything, including hosting and these people; <b>members</b> can work on sites.</p>
      {err ? <p className="text-[13px] text-amber-200">{err} <button type="button" className="text-brand-300 underline" onClick={load}>Try again</button></p>
        : !list ? <Skel className="h-16 w-full" />
        : <ul className="divide-y divide-ink-700/70 rounded-lg border border-ink-700/70 text-sm">
            {list.map((p) => (
              <li key={p.email} className="flex items-center gap-2 px-3 py-2"><span className="min-w-0 flex-1 truncate">{p.email}</span><span className="chip border-ink-600 text-ink-300">{ROLE[p.role] || p.role}</span>
                {p.role !== "partner" && <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => doRemove(p)} aria-label={`Remove ${p.email}`}>Remove</button>}</li>
            ))}
            {!list.length && <li className="px-3 py-2 text-amber-200">Nobody yet.</li>}
          </ul>}
      <Field label="Add people" htmlFor="sp-add"><input id="sp-add" className="input" type="email" placeholder="name@example.com (several: separate with commas)" value={add} onChange={(e) => setAdd(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && add.trim() && !busy) doAdd(); }} /></Field>
      <div className="flex flex-wrap items-center gap-2">
        <select className="input w-auto py-1" aria-label="Role" value={role} onChange={(e) => setRole(e.target.value)}><option value="member">Member: can work on sites</option><option value="owner">Owner: full control</option></select>
        <button type="button" className="btn btn-pri btn-sm" disabled={busy || !add.trim()} onClick={doAdd}>{busy ? "Saving…" : "Add"}</button>
        <span className="hint">Works straight away; nothing to publish.</span>
      </div>
    </section>
  );
}
