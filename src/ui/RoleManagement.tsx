// Role Management: who can sign in and with which role, and what each role may do. For a Studio (Settings) and for a
// site's admin page. Only an Administrator can change anything here; everything is kept in the Cloudflare database.
import { useEffect, useState } from "react";
import { cfCall } from "../lib/cfdb";
import { NEVER, PRIVS, ROLES, roleLabel, type Privs } from "../lib/roles";
import { Field, Skel, useConfirm, useToast } from "./kit";

type Member = { email: string; role: string };
type Data = { me: { email: string; role: string; privs: Privs }; ready: boolean; roles?: Record<string, Privs>; members?: Member[]; owners?: { project: string; email: string }[] };

export function RoleManagement({ api, scopeName, where }: { api: string; scopeName: string; where: "studio" | "site" }) {
  const toast = useToast(), confirm = useConfirm();
  const [d, setD] = useState<Data | null>(null), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const [add, setAdd] = useState(""), [addRole, setAddRole] = useState("member");
  const q = "scope=" + encodeURIComponent(scopeName), what = where === "studio" ? "this Studio" : "this site's admin page";
  const load = async () => {
    setErr("");
    try { setD(await cfCall<Data>(api, "/roles?" + q)); }
    catch (e: any) { setErr(e?.status === 401 ? "Sign in to this database on this device first." : /not found|404/i.test(String(e?.message)) ? "Role Management needs the database updated once: Settings → Hostings → Update the database." : e?.message || "Couldn't load the roles."); }
  };
  useEffect(() => { load(); }, [api, scopeName]);
  const run = async (f: () => Promise<void>) => { setBusy(true); try { await f(); await load(); } catch (e: any) { toast(e?.message || "That didn't work.", "bad"); } setBusy(false); };
  if (err) return <section className="card p-5 text-sm text-amber-200" aria-label="Role Management">{err} <button type="button" className="text-brand-300 underline" onClick={load}>Try again</button></section>;
  if (!d) return <Skel className="h-40 w-full" />;
  if (!d.ready) return <section className="card p-5 text-sm text-amber-200" aria-label="Role Management">Role Management needs the database updated once: Settings → Hostings → Update the database.</section>;
  const admin = d.me.role === "owner";
  if (!d.members || !d.roles) return (
    <section className="card flex flex-col gap-2 p-5" aria-label="Your role">
      <h3 className="text-[15px] font-extrabold">Your role: {roleLabel(d.me.role)}</h3>
      <p className="text-sm text-ink-300">An Administrator sets what each role can do. Yours can:</p>
      <ul className="list-disc pl-5 text-sm text-ink-100">{PRIVS.filter((p) => (p.where === where || p.where === "both") && d.me.privs[p.key]).map((p) => <li key={p.key}>{p.label}</li>)}</ul>
    </section>
  );
  const members = d.members, roles = d.roles, admins = members.filter((m) => m.role === "owner").length;
  const setRole = (m: Member, role: string) => run(async () => { await cfCall(api, "/m/add?" + q, { method: "POST", body: JSON.stringify({ email: m.email, role }) }); toast(`${m.email} is now ${roleLabel(role)}.`); });
  const remove = async (m: Member) => {
    if (m.role === "owner" && admins <= 1) { toast("This is the only Administrator. Make someone else an Administrator first.", "bad"); return; }
    if (!(await confirm(`Remove ${m.email}?`, `They can no longer sign in to ${what}.${where === "studio" ? " Their projects stay in the Studio; an Administrator can still open them." : ""}`, "Remove", true))) return;
    run(async () => { await cfCall(api, "/m/remove?" + q, { method: "POST", body: JSON.stringify({ email: m.email }) }); toast(`${m.email} removed.`); });
  };
  const doAdd = () => run(async () => {
    const mails = [...new Set(add.split(/[,;\s]+/).map((x) => x.trim().toLowerCase()).filter(Boolean))];
    const bad = mails.find((m) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m)); if (bad) throw new Error(`${bad} isn't an email address.`);
    for (const email of mails.slice(0, 10)) await cfCall(api, "/m/add?" + q, { method: "POST", body: JSON.stringify({ email, role: addRole }) });
    setAdd(""); if (mails.length) toast(`${mails.length === 1 ? mails[0] : mails.length + " people"} added as ${roleLabel(addRole)}.`);
  });
  const toggle = (role: string, key: string, on: boolean) => run(async () => { await cfCall(api, "/roles?" + q, { method: "POST", body: JSON.stringify({ role, privs: { ...roles[role], [key]: on } }) }); });
  const cols = ROLES.filter((r) => r.id !== "owner"), rows = PRIVS.filter((p) => p.where === where || p.where === "both");
  const groups = [...new Set(rows.map((p) => p.group))];
  const count = (email: string) => (d.owners || []).filter((o) => o.email === email).length;

  return (
    <div className="flex flex-col gap-4">
      {!admin && <p className="rounded-lg border border-ink-700 bg-ink-850 px-3 py-2.5 text-[13px] text-ink-300">Only an Administrator can change roles. You can see them here.</p>}
      <section className="card flex flex-col gap-3 p-5" aria-label="People and their roles">
        <h3 className="text-[15px] font-extrabold">People and their roles</h3>
        <p className="text-sm text-ink-300">Only these email addresses can sign in to {what}.{where === "studio" ? " Everyone has their own projects and their own choices; an Administrator sees everyone's." : ""}</p>
        <ul className="divide-y divide-ink-700/70 rounded-lg border border-ink-700/70 text-sm">
          {members.map((m) => (
            <li key={m.email} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <span className="min-w-0 flex-1 truncate">{m.email}{m.email === d.me.email && <span className="ml-2 text-xs text-ink-400">you</span>}{where === "studio" && count(m.email) > 0 && <span className="ml-2 text-xs text-ink-400">{count(m.email)} {count(m.email) === 1 ? "project" : "projects"}</span>}</span>
              {m.role === "partner" || !admin ? <span className="chip border-ink-600 text-ink-300">{roleLabel(m.role)}</span>
                : <select className="input w-auto py-1" aria-label={`Role of ${m.email}`} disabled={busy} value={ROLES.some((r) => r.id === m.role) ? m.role : "member"} onChange={(e) => setRole(m, e.target.value)}>{ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select>}
              {admin && m.role !== "partner" && <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => remove(m)} aria-label={`Remove ${m.email}`}>Remove</button>}
            </li>
          ))}
        </ul>
        {admin && <>
          <Field label="Add people" htmlFor="rm-add"><input id="rm-add" className="input" type="email" placeholder="name@example.com (several: separate with commas)" value={add} onChange={(e) => setAdd(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && add.trim() && !busy) doAdd(); }} /></Field>
          <div className="flex flex-wrap items-center gap-2">
            <select className="input w-auto py-1" aria-label="Role for the people added" value={addRole} onChange={(e) => setAddRole(e.target.value)}>{ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select>
            <button type="button" className="btn btn-pri btn-sm" disabled={busy || !add.trim()} onClick={doAdd}>{busy ? "Saving…" : "Add"}</button>
            <span className="hint">{ROLES.find((r) => r.id === addRole)?.hint}</span>
          </div>
        </>}
      </section>
      <section className="card flex flex-col gap-3 p-5" aria-label="What each role can do">
        <h3 className="text-[15px] font-extrabold">What each role can do</h3>
        <p className="text-sm text-ink-300">Tick what a role is allowed. A change applies at once to everyone with that role (they see it the next time they open {what}). Administrators can always do everything.</p>
        <div className="overflow-x-auto rounded-lg border border-ink-700/70">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="bg-ink-850 text-left text-[12.5px] text-ink-300"><th className="px-3 py-2 font-semibold">Privilege</th><th className="px-2 py-2 text-center font-semibold">Administrator</th>{cols.map((r) => <th key={r.id} className="px-2 py-2 text-center font-semibold" title={r.hint}>{r.label}</th>)}</tr></thead>
            <tbody>
              {groups.map((g) => [
                <tr key={"g" + g}><td colSpan={cols.length + 2} className="border-t border-ink-700/70 bg-ink-900 px-3 py-1.5 text-[11.5px] font-bold uppercase tracking-wider text-ink-400">{g}</td></tr>,
                ...rows.filter((p) => p.group === g).map((p) => (
                  <tr key={p.key} className="border-t border-ink-700/40">
                    <td className="px-3 py-2"><span className="text-ink-100">{p.label}</span>{p.hint && <span className="block text-[12px] text-ink-400">{p.hint}</span>}</td>
                    <td className="px-2 py-2 text-center"><input type="checkbox" checked disabled aria-label={`Administrator: ${p.label}`} /></td>
                    {cols.map((r) => { const never = (NEVER[r.id] || []).includes(p.key); return <td key={r.id} className="px-2 py-2 text-center"><input type="checkbox" aria-label={`${r.label}: ${p.label}`} title={never ? `The ${r.label} role can never do this.` : undefined} disabled={!admin || busy || never} checked={!never && !!roles[r.id]?.[p.key]} onChange={(e) => toggle(r.id, p.key, e.target.checked)} /></td>; })}
                  </tr>
                )),
              ])}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
