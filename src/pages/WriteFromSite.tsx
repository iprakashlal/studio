// "Write text from a site": reads a reference site (or pasted text), and Workers AI on the Studio's Cloudflare
// database writes NEW, original text for this brand about the same kind of business. The result is reviewed per
// section and put in the editor (not saved), so the owner can change it before saving and publishing.
import { useEffect, useState } from "react";
import type { Session } from "../lib/auth";
import type { ProjectMeta } from "../lib/studio";
import { cfAccountVault, cfDeployInfo, cfSendCode, cfSignedIn, cfVerifyCode, cfWrite, setupCfDb, type Brief } from "../lib/cfdb";
import { loadHostConfig } from "../lib/studiohost";
import { netlifyToken } from "../lib/hosting";
import { Netlify } from "../lib/netlify";
import { useCfAccount } from "./CfPicker";
import { applyBrief, dropFlagged, groupsOf } from "../lib/writeMap";
import { brand as studioBrand } from "../lib/brand";
import { Field, Modal } from "../ui/kit";

/** The database this Studio can use for writing: the site's own, the one set up on this device, or the hosted Studio's. */
async function findApi(project: ProjectMeta, token: string): Promise<string | null> {
  if (project.host?.cf?.api) return project.host.cf.api;
  const v = await cfAccountVault.load(token).catch(() => null);
  if (v?.setup?.api) return v.setup.api;
  const h = await loadHostConfig().catch(() => null);
  return h?.kind === "cloudflare" ? h.api : null;
}

export function WriteFromSiteDialog({ session, project, draft, onApply, onClose }: { session: Session; project: ProjectMeta; draft: any; onApply: (c: any) => void; onClose: () => void }) {
  const kind = project.template === "store" ? "store" : project.template === "business" ? "business" : "portfolio";
  const [api, setApi] = useState<string | null | undefined>(undefined);
  const [ai, setAi] = useState<boolean | null>(null);
  const [who, setWho] = useState<string | null>(null);
  const [url, setUrl] = useState(""), [text, setText] = useState(""), [showText, setShowText] = useState(false);
  const [brandName, setBrandName] = useState(String((kind === "portfolio" ? draft?.brand?.logoText : draft?.brand?.name) || ""));
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(""), [err, setErr] = useState("");
  const [res, setRes] = useState<{ brief: Brief; flagged: string[] } | null>(null);
  const [pick, setPick] = useState<Set<string>>(new Set());
  const [email, setEmail] = useState(""), [code, setCode] = useState(""), [sent, setSent] = useState(false);
  const [nf, setNf] = useState<Netlify | null | undefined>(undefined);
  useEffect(() => { netlifyToken.load(session.token).then((t) => setNf(t ? new Netlify(t.token) : null)); }, [session.token]);
  const acc = useCfAccount(session.token, nf, true);

  const check = async (a: string | null) => {
    setApi(a); if (!a) return;
    setAi(!!(await cfDeployInfo(a)).ai);
    setWho(await cfSignedIn(a));
  };
  useEffect(() => { findApi(project, session.token).then(check); }, []);

  const run = (label: string, f: () => Promise<void>) => async () => { setErr(""); setBusy(label); try { await f(); } catch (e: any) { setErr(e?.message || "Something went wrong."); if (e?.thin) setShowText(true); } setBusy(""); };
  const sendCode = run("Sending", async () => { await cfSendCode(api!, email.trim()); setSent(true); });
  const verify = run("Checking", async () => { await cfVerifyCode(api!, email.trim(), code.trim()); setCode(""); setSent(false); setWho(await cfSignedIn(api!)); });
  const update = run("Updating the database", async () => {
    const v = await cfAccountVault.load(session.token);
    const { relay, account, token } = await acc.client((x) => setBusy(x));
    const setup = await setupCfDb(relay, token, { account, resendKey: "", mailFrom: v?.mailFrom || "", name: studioBrand().name, existing: v?.setup && v.setup.account === account.id ? v.setup : null, requireMail: false }, (x) => setBusy(x));
    await cfAccountVault.save({ ...(v || {}), token, account: account.id, setup }, session.token);
    await check(setup.api);
  });
  const write = run("Reading and writing", async () => {
    const r = await cfWrite(api!, { ...(showText && text.trim() ? { text: text.trim() } : { url: url.trim() }), brand: brandName.trim(), notes: notes.trim(), kind });
    const b = dropFlagged(r.brief, r.flagged || []);
    setRes({ brief: b, flagged: r.flagged || [] }); setPick(new Set(groupsOf(kind, b).map((g) => g.id)));
  });
  const apply = () => { onApply(applyBrief(kind, draft, res!.brief, brandName.trim(), pick)); onClose(); };

  const canWrite = !!brandName.trim() && (showText ? text.trim().split(/\s+/).length >= 40 : /^https?:\/\/\S+\.\S+/.test(url.trim()) || /^[\w-]+(\.[\w-]+)+/.test(url.trim()));
  const groups = res ? groupsOf(kind, res.brief) : [];
  const footer = res
    ? <><button className="btn" onClick={() => setRes(null)}>Back</button><button className="btn btn-pri" disabled={!pick.size} onClick={apply}>Put in the editor</button></>
    : <><button className="btn" onClick={onClose}>Cancel</button>{api && ai && who && <button className="btn btn-pri" disabled={!canWrite || !!busy} onClick={write}>{busy ? busy + "…" : "Write new text"}</button>}</>;

  return (
    <Modal title="Write text from a site" onClose={onClose} wide footer={footer}>
      <div className="flex flex-col gap-3 text-sm">
        {!res && <p className="text-ink-300">Give a site in the same line of business. The Studio reads what it covers and writes <b>new text of its own</b> for your brand, section by section: nothing is copied, and anything too close to the original is left out. Testimonials, numbers, team, clients, prices and products aren't written, so fill those in yourself.</p>}
        {api === undefined && <p className="text-ink-400">Checking your Cloudflare database…</p>}
        {api === null && <p className="rounded-lg border border-amber-400/30 bg-amber-400/5 px-3 py-2.5 text-amber-100">This needs the Studio's database on Cloudflare (free). Set it up in <b>Settings → Accounts → Cloudflare</b>, then come back.</p>}
        {api && ai === false && (
          <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 px-3 py-2.5 text-amber-100">
            <p>Your database was set up before writing was added. Update it once to turn on Cloudflare's free AI (Workers AI). Sign-ins and data are kept.</p>
            {acc.ready ? <button type="button" className="btn btn-sm btn-pri mt-2" disabled={!!busy} onClick={update}>{busy ? busy + "…" : "Update the database"}</button> : <div className="mt-2">{acc.ui}</div>}
          </div>
        )}
        {api && ai && !who && (
          <div className="flex flex-col gap-2 rounded-lg border border-ink-700 p-3">
            <p className="text-ink-300">Sign in to your Cloudflare database with your email code (owners and partners can write).</p>
            <div className="flex flex-wrap gap-2">
              <input className="input min-w-0 flex-1" type="email" placeholder="you@example.com" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <button type="button" className="btn btn-sm" disabled={!email.includes("@") || !!busy} onClick={sendCode}>{sent ? "Send again" : "Send code"}</button>
            </div>
            {sent && <div className="flex flex-wrap gap-2"><input className="input w-40" inputMode="numeric" placeholder="Code" aria-label="Code" value={code} onChange={(e) => setCode(e.target.value)} /><button type="button" className="btn btn-sm btn-pri" disabled={code.trim().length < 4 || !!busy} onClick={verify}>Sign in</button></div>}
          </div>
        )}
        {api && ai && who && !res && <>
          <Field label="Your brand name" htmlFor="wf-brand" hint="Used in the new text and set as the site's name.">
            <input id="wf-brand" className="input" value={brandName} onChange={(e) => setBrandName(e.target.value)} />
          </Field>
          {!showText
            ? <Field label="Reference site" htmlFor="wf-url" hint="A page that shows what the business offers, for example its home or about page.">
                <input id="wf-url" className="input" placeholder="https://example.com" value={url} onChange={(e) => setUrl(e.target.value)} />
              </Field>
            : <Field label="The page's text" htmlFor="wf-text" hint="Some sites can't be read from here. Copy the page's text and paste it (at least 40 words).">
                <textarea id="wf-text" className="input min-h-[140px]" value={text} onChange={(e) => setText(e.target.value)} />
              </Field>}
          <button type="button" className="self-start text-[12.5px] text-brand-300 underline" onClick={() => setShowText(!showText)}>{showText ? "Use a link instead" : "Or paste the page's text"}</button>
          <Field label="About your business (optional)" htmlFor="wf-notes" hint="What's different about you: city, speciality, tone. Only what's true.">
            <textarea id="wf-notes" className="input min-h-[70px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </>}
        {res && <>
          <p className="text-ink-300">Tick the sections to put in the editor. Nothing is saved until you press Save, and History keeps the earlier version.{res.flagged.length ? ` ${res.flagged.length} line${res.flagged.length > 1 ? "s were" : " was"} too close to the reference and left out.` : ""}</p>
          {groups.map((g) => (
            <label key={g.id} className="flex gap-3 rounded-lg border border-ink-700 p-3">
              <input type="checkbox" className="mt-1" checked={pick.has(g.id)} onChange={(e) => { const n = new Set(pick); e.target.checked ? n.add(g.id) : n.delete(g.id); setPick(n); }} />
              <span className="min-w-0"><b className="text-ink-100">{g.label}</b>{g.preview.map((t, i) => <span key={i} className="mt-1 block text-[12.5px] text-ink-300">{t}</span>)}</span>
            </label>
          ))}
        </>}
        {err && <p role="alert" className="text-red-300">{err}</p>}
      </div>
    </Modal>
  );
}
