// Warranty records (shop and business sites), in the Studio and in the site's own admin page: set up once with a
// records password, then add, edit, import and export records. Saving writes straight to the live site.
import { useEffect, useMemo, useState } from "react";
import type { Repo } from "../lib/repo";
import { explain } from "../lib/repo";
import { adminFile, missingExtra, newId, newSalt, normNumber, parseCsv, saveRecords, toCsv, unlock, type WAdmin, type WRecord, type WStatus, type WVerify } from "../lib/warranty";
import { Field, Spinner, useConfirm, useToast } from "../ui/kit";

const today = () => new Date().toISOString().slice(0, 10);
const blank = (status: string): WRecord => ({ id: newId(), number: "", product: "", purchased: today(), months: 12, status, history: [], updated: new Date().toISOString() });

export function WarrantyPanel({ repo, cfg, why }: { repo: Repo | null; cfg: any; why?: string }) {
  const toast = useToast(), confirm = useConfirm();
  const statuses: WStatus[] = Array.isArray(cfg?.statuses) && cfg.statuses.length ? cfg.statuses : [{ id: "registered", label: "Registered", tone: "info" }];
  const verify: WVerify = cfg?.verify === "phone4" || cfg?.verify === "email" ? cfg.verify : "none";
  const [file, setFile] = useState<Awaited<ReturnType<typeof adminFile>> | undefined>(undefined);
  const [loadErr, setLoadErr] = useState("");
  const [a, setA] = useState<WAdmin | null>(null);
  const [saved, setSaved] = useState("");
  const [pw, setPw] = useState(""), [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(""), [err, setErr] = useState("");
  const [q, setQ] = useState(""), [edit, setEdit] = useState<WRecord | null>(null), [isNew, setIsNew] = useState(false);
  useEffect(() => { if (!repo) return; setFile(undefined); adminFile(repo).then(setFile).catch((e) => setLoadErr(explain(e))); }, [repo]);
  const dirty = !!a && JSON.stringify(a.records) !== saved;

  const run = async (k: string, fn: () => Promise<void>) => { setErr(""); setBusy(k); try { await fn(); } catch (e: any) { setErr(e?.message || explain(e)); } setBusy(""); };
  const write = async (next: WAdmin) => {
    await saveRecords(repo!, next, verify, statuses, (s) => setBusy(s));
    setA(next); setSaved(JSON.stringify(next.records)); setFile(await adminFile(repo!));
  };
  const setup = () => run("setup", async () => {
    if (pw.length < 8) throw new Error("Use at least 8 characters for the records password.");
    if (pw !== pw2) throw new Error("The two passwords don't match.");
    await write({ salt: newSalt(), records: [], password: pw }); setPw(""); setPw2("");
    toast("Warranty records are set up. Add your first record.");
  });
  const doUnlock = () => run("unlock", async () => { const b = await unlock(file!, pw); setA({ ...b, password: pw }); setSaved(JSON.stringify(b.records)); setPw(""); });
  const save = () => run("save", async () => { await write(a!); toast("Saved. The site shows the new statuses within a minute."); });
  const reset = async () => {
    if (!(await confirm("Start the records again?", "Without the password the records can't be read. This replaces them with an empty list on the live site.", "Start again", true))) return;
    setFile(null); setA(null);
  };

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase(); const list = a?.records || [];
    return (t ? list.filter((r) => [r.number, r.product, r.customer, r.phone, r.email].some((v) => String(v || "").toLowerCase().includes(t))) : list).slice().sort((x, y) => y.updated.localeCompare(x.updated));
  }, [a, q]);

  const commit = (r: WRecord) => {
    if (!normNumber(r.number)) { setErr("Enter the record's number."); return; }
    const others = a!.records.filter((x) => x.id !== r.id);
    if (others.some((x) => normNumber(x.number) === normNumber(r.number))) { setErr(`Another record already has the number ${r.number}.`); return; }
    const prev = a!.records.find((x) => x.id === r.id);
    const history = !prev || prev.status !== r.status || (prev.note || "") !== (r.note || "") ? [...r.history, { at: new Date().toISOString(), status: r.status, ...(r.note ? { note: r.note } : {}) }] : r.history;
    setA({ ...a!, records: [...others, { ...r, history, updated: new Date().toISOString() }] }); setEdit(null); setErr("");
  };
  const importCsv = async (f: File) => run("import", async () => {
    const rows = parseCsv(await f.text());
    if (!rows.length) throw new Error("That file has no rows. The first line should be the column names: number, product, customer, phone, email, purchased, months, status, note.");
    const byNum = new Map(a!.records.map((r) => [normNumber(r.number), r]));
    let added = 0, changed = 0;
    for (const x of rows) {
      if (!normNumber(x.number || "")) continue;
      const st = statuses.find((s) => s.id === x.status || s.label.toLowerCase() === String(x.status || "").toLowerCase())?.id || statuses[0].id;
      const cur = byNum.get(normNumber(x.number));
      const rec: WRecord = { ...(cur || blank(st)), number: x.number, product: x.product || cur?.product || "", customer: x.customer || cur?.customer, phone: x.phone || cur?.phone, email: x.email || cur?.email,
        purchased: x.purchased || cur?.purchased, months: x.months ? +x.months || 0 : cur?.months, status: st, note: x.note ?? cur?.note, updated: new Date().toISOString() };
      if (!cur || cur.status !== st) rec.history = [...(cur?.history || []), { at: new Date().toISOString(), status: st, ...(rec.note ? { note: rec.note } : {}) }];
      byNum.set(normNumber(x.number), rec); cur ? changed++ : added++;
    }
    setA({ ...a!, records: [...byNum.values()] });
    toast(`${added} added, ${changed} updated. Press Save to put them on the site.`);
  });
  const exportCsv = () => { const b = new Blob([toCsv(a!.records)], { type: "text/csv" }); const u = URL.createObjectURL(b); const l = document.createElement("a"); l.href = u; l.download = "warranty-records.csv"; l.click(); setTimeout(() => URL.revokeObjectURL(u), 1000); };
  const changePw = () => run("pw", async () => {
    if (pw.length < 8) throw new Error("Use at least 8 characters."); if (pw !== pw2) throw new Error("The two passwords don't match.");
    await write({ ...a!, password: pw }); setPw(""); setPw2(""); toast("Records password changed.");
  });

  if (!repo) return <section className="card p-5 text-sm text-ink-300">{why || "Publish the site first: records are saved straight to the live site."}</section>;
  if (loadErr) return <section className="card p-5 text-sm text-red-300" role="alert">Couldn't read the records: {loadErr}</section>;
  if (file === undefined) return <section className="card p-5"><Spinner label="Loading the records…" /></section>;
  const off = !cfg?.enabled && <p className="rounded-lg border border-amber-400/40 bg-amber-400/5 px-3 py-2 text-[13px] text-amber-100">The check isn't shown on the site yet. Turn it on in <b>Warranty &amp; status</b> (this menu), then save or publish.</p>;

  if (!file) return (
    <section className="card flex flex-col gap-3 p-5" aria-label="Set up warranty records">
      <h3 className="text-[15px] font-extrabold">Set up warranty records</h3>
      <p className="text-sm text-ink-300">Choose a records password. It opens the full list here on any device; customers never need it. Each record is stored on the site encrypted under its own number{verify !== "none" ? (verify === "phone4" ? " and the last 4 digits of the customer's phone" : " and the customer's email") : ""}, so the list can't be read by anyone else.</p>
      <p className="text-[13px] text-amber-200">Keep the password safe: without it the list can't be opened (you'd start again; the site keeps working until you save).</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Records password" htmlFor="w-pw"><input id="w-pw" className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
        <Field label="Type it again" htmlFor="w-pw2"><input id="w-pw2" className="input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></Field>
      </div>
      {err && <p role="alert" className="text-sm text-red-300">{err}</p>}
      <button type="button" className="btn btn-pri self-start" disabled={!!busy || !pw} onClick={setup}>{busy ? busy + "…" : "Set up warranty records"}</button>
      {off}
    </section>
  );

  if (!a) return (
    <section className="card flex flex-col gap-3 p-5" aria-label="Unlock warranty records">
      <h3 className="text-[15px] font-extrabold">Warranty records</h3>
      <p className="text-sm text-ink-300">Enter the records password to open the list.</p>
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); doUnlock(); }}>
        <input aria-label="Records password" className="input min-w-0 flex-1" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        <button className="btn btn-pri" disabled={!!busy || !pw}>{busy ? "Opening…" : "Open"}</button>
      </form>
      {err && <p role="alert" className="text-sm text-red-300">{err}</p>}
      <button type="button" className="self-start text-[13px] text-ink-400 underline" onClick={reset}>Forgot the password? Start again</button>
      {off}
    </section>
  );

  const miss = missingExtra(a.records, verify);
  return (
    <div className="flex flex-col gap-4">
      {off}
      <section className="card flex flex-col gap-3 p-5" aria-label="Warranty records">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[15px] font-extrabold">Warranty records <span className="font-normal text-ink-400">({a.records.length})</span></h3>
          <div className="ml-auto flex flex-wrap gap-2">
            <button type="button" className="btn btn-sm" onClick={() => { setEdit(blank(statuses[0].id)); setIsNew(true); }}>Add record</button>
            <label className="btn btn-sm relative cursor-pointer">Import CSV<input type="file" accept=".csv,text/csv" className="sr-only" aria-label="Import CSV" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) importCsv(f); }} /></label>
            <button type="button" className="btn btn-sm" disabled={!a.records.length} onClick={exportCsv}>Export CSV</button>
            <button type="button" className="btn btn-pri btn-sm" disabled={!!busy || !dirty} onClick={save}>{busy ? busy + "…" : dirty ? "Save to the site" : "Saved"}</button>
          </div>
        </div>
        {miss.length > 0 && <p className="text-[13px] text-amber-200">{miss.length} record{miss.length === 1 ? " has" : "s have"} no {verify === "phone4" ? "phone number" : "email"}: customers find {miss.length === 1 ? "it" : "them"} by number alone.</p>}
        {err && <p role="alert" className="text-sm text-red-300">{err}</p>}
        {edit && <Editor rec={edit} isNew={isNew} statuses={statuses} verify={verify} onCancel={() => { setEdit(null); setErr(""); }} onDone={commit} onDelete={() => { setA({ ...a, records: a.records.filter((x) => x.id !== edit.id) }); setEdit(null); }} />}
        <input aria-label="Search records" className="input" placeholder="Search by number, product, customer, phone or email" value={q} onChange={(e) => setQ(e.target.value)} />
        {!shown.length ? <p className="text-sm text-ink-400">{a.records.length ? "No record matches." : "No records yet. Add one, or import a CSV with the columns number, product, customer, phone, email, purchased, months, status, note."}</p> : (
          <ul className="flex flex-col divide-y divide-ink-700 rounded-xl border border-ink-700" aria-label="Records">
            {shown.slice(0, 200).map((r) => { const st = statuses.find((s) => s.id === r.status); return (
              <li key={r.id}><button type="button" className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-left text-sm hover:bg-ink-800/50" onClick={() => { setEdit(r); setIsNew(false); }}>
                <b className="font-mono">{r.number}</b><span className="text-ink-300">{r.product}</span>{r.customer && <span className="text-ink-400">· {r.customer}</span>}
                <span className="chip ml-auto">{st?.label || r.status}</span><span className="text-[12px] text-ink-500">{new Date(r.updated).toLocaleDateString()}</span>
              </button></li>); })}
          </ul>)}
        {shown.length > 200 && <p className="hint">Showing 200 of {shown.length}. Search to find others.</p>}
      </section>
      <section className="card flex flex-col gap-3 p-5" aria-label="Records password">
        <h3 className="text-[15px] font-extrabold">Records password</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="New password" htmlFor="w-np"><input id="w-np" className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
          <Field label="Type it again" htmlFor="w-np2"><input id="w-np2" className="input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></Field>
        </div>
        <button type="button" className="btn btn-sm self-start" disabled={!!busy || !pw} onClick={changePw}>Change password</button>
      </section>
    </div>
  );
}

function Editor({ rec, isNew, statuses, verify, onCancel, onDone, onDelete }: { rec: WRecord; isNew: boolean; statuses: WStatus[]; verify: WVerify; onCancel: () => void; onDone: (r: WRecord) => void; onDelete: () => void }) {
  const [r, setR] = useState(rec);
  const set = (o: Partial<WRecord>) => setR((x) => ({ ...x, ...o }));
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-brand-500/40 bg-ink-950 p-4" aria-label={isNew ? "New record" : `Record ${rec.number}`}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Number (serial, invoice or ticket)" htmlFor="w-num"><input id="w-num" className="input font-mono" value={r.number} onChange={(e) => set({ number: e.target.value })} /></Field>
        <Field label="Product" htmlFor="w-prod"><input id="w-prod" className="input" value={r.product} onChange={(e) => set({ product: e.target.value })} /></Field>
        <Field label="Customer name" htmlFor="w-cust"><input id="w-cust" className="input" value={r.customer || ""} onChange={(e) => set({ customer: e.target.value })} /></Field>
        <Field label={verify === "phone4" ? "Phone (needed for the check)" : "Phone"} htmlFor="w-phone"><input id="w-phone" className="input" inputMode="tel" value={r.phone || ""} onChange={(e) => set({ phone: e.target.value })} /></Field>
        <Field label={verify === "email" ? "Email (needed for the check)" : "Email"} htmlFor="w-email"><input id="w-email" className="input" type="email" value={r.email || ""} onChange={(e) => set({ email: e.target.value })} /></Field>
        <Field label="Purchased on" htmlFor="w-date"><input id="w-date" className="input" type="date" value={r.purchased || ""} onChange={(e) => set({ purchased: e.target.value })} /></Field>
        <Field label="Warranty (months)" htmlFor="w-months"><input id="w-months" className="input" type="number" min={0} value={r.months ?? ""} onChange={(e) => set({ months: e.target.value === "" ? undefined : Math.max(0, +e.target.value) })} /></Field>
        <Field label="Status" htmlFor="w-status"><select id="w-status" className="input" value={r.status} onChange={(e) => set({ status: e.target.value })}>{statuses.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></Field>
      </div>
      <Field label="Note for the customer (optional)" htmlFor="w-note"><input id="w-note" className="input" value={r.note || ""} onChange={(e) => set({ note: e.target.value })} placeholder="e.g. Screen replaced; ready after 4 pm" /></Field>
      {!isNew && r.history.length > 0 && <p className="text-[12.5px] text-ink-400">History: {r.history.map((h) => `${new Date(h.at).toLocaleDateString()} ${statuses.find((s) => s.id === h.status)?.label || h.status}`).join(" → ")}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-pri btn-sm" onClick={() => onDone(r)}>{isNew ? "Add" : "Done"}</button>
        <button type="button" className="btn btn-sm" onClick={onCancel}>Cancel</button>
        {!isNew && <button type="button" className="btn btn-sm ml-auto text-red-300" onClick={onDelete}>Delete record</button>}
      </div>
      <p className="hint">Changes go to the site when you press <b>Save to the site</b>.</p>
    </div>
  );
}
