// Sign in with Google, beside the email code: for emails that are already allowed in. The page loads nothing from
// Google; a small window goes to Google and back to the database's Worker, which checks Google's signed answer.
import { useEffect, useState } from "react";
import { cfGoogleInfo, cfGoogleSet, cfGoogleSignIn, cfSignedIn } from "../lib/cfdb";
import { Field, Toggle, useToast } from "./kit";

/** The button on a sign-in screen. Shows only when the database has Google sign-in switched on. */
export function GoogleButton({ api, onIn, disabled }: { api: string; onIn: (email: string) => void | Promise<void>; disabled?: boolean }) {
  const [on, setOn] = useState(false), [busy, setBusy] = useState(false), [err, setErr] = useState(""), [flow, setFlow] = useState<{ cancel: () => void } | null>(null);
  useEffect(() => { let live = true; cfGoogleInfo(api).then((i) => { if (live) setOn(i.on); }); return () => { live = false; }; }, [api]);
  if (!on) return null;
  const go = async () => {
    setErr("");
    let f: ReturnType<typeof cfGoogleSignIn>;
    try { f = cfGoogleSignIn(api); } catch (e: any) { setErr(e?.message || "Couldn't open Google."); return; }
    setFlow(f); setBusy(true);
    try { await onIn(await f.done); } catch (e: any) { setErr(e?.message || "Couldn't sign in with Google."); }
    setFlow(null); setBusy(false);
  };
  return (
    <div className="flex flex-col gap-2" aria-label="Sign in with Google">
      <div className="flex items-center gap-3 text-[12.5px] text-ink-400"><span className="h-px flex-1 bg-ink-700" />or<span className="h-px flex-1 bg-ink-700" /></div>
      <button type="button" className="btn" disabled={busy || disabled} onClick={go}>{busy ? "Waiting for Google…" : "Sign in with Google"}</button>
      {busy && flow && <button type="button" className="btn btn-ghost btn-sm" onClick={() => flow.cancel()}>Cancel</button>}
      <p className="text-center text-[12.5px] text-ink-400">Works for a Google account whose email is already allowed here.</p>
      {err && <p role="alert" className="rounded-lg border border-amber-400/40 bg-amber-400/5 px-3 py-2 text-[13px] text-amber-100">{err}</p>}
    </div>
  );
}

/** Settings: switch Google sign-in on for everyone who signs in to this database (the Studio and its sites' admin pages). */
export function GoogleSignInCard({ api, what = "this Studio and the admin pages of the sites on its database" }: { api: string; what?: string }) {
  const toast = useToast();
  const [info, setInfo] = useState<{ on: boolean; clientId: string; redirect: string } | null>(null), [id, setId] = useState(""), [on, setOn] = useState(false), [busy, setBusy] = useState(false), [err, setErr] = useState(""), [signed, setSigned] = useState<boolean | null>(null);
  useEffect(() => { let live = true; cfGoogleInfo(api).then((i) => { if (!live) return; setInfo(i); setId(i.clientId); setOn(i.on); }); cfSignedIn(api).then((e) => { if (live) setSigned(!!e); }).catch(() => { if (live) setSigned(false); }); return () => { live = false; }; }, [api]);
  if (!info) return null;
  const same = id.trim() === info.clientId && on === info.on;
  const save = async () => {
    setErr(""); setBusy(true);
    try { const r = await cfGoogleSet(api, id.trim(), on); setInfo({ ...info, on: r.on, clientId: r.clientId }); setOn(r.on); toast(r.on ? "Saved. Sign in with Google now shows on the sign-in screen." : "Saved. Sign in with Google is off."); }
    catch (e: any) { setErr(e?.message || "Couldn't save that."); }
    setBusy(false);
  };
  return (
    <section className="card flex flex-col gap-3 p-5" aria-label="Google sign-in">
      <h3 className="flex items-center gap-2 text-[15px] font-extrabold">Sign in with Google<span className={`chip ${info.on ? "border-emerald-400/50 text-emerald-200" : "border-ink-600 text-ink-400"}`}>{info.on ? "On" : "Off"}</span></h3>
      <p className="text-sm text-ink-300">Adds a “Sign in with Google” button beside the email code, for {what}. It only lets in a Google account whose email is already allowed (the same people who can get a code); nobody new can sign up with it.</p>
      <details className="text-[13px] text-ink-400" open={!info.clientId}>
        <summary className="cursor-pointer select-none">Set it up with Google (once, free)</summary>
        <ol className="mt-1.5 list-decimal space-y-1 pl-5">
          <li>Open <a className="text-brand-300 underline" href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer">Google Cloud → Credentials ↗</a> (create a project if it asks), then <b>Create credentials → OAuth client ID</b>. If it asks for a consent screen first, choose <b>External</b> and fill in the app name and your email.</li>
          <li>Application type: <b>Web application</b>.</li>
          <li>Under <b>Authorised redirect URIs</b> add exactly: <code className="select-all break-all font-mono text-xs text-ink-200">{info.redirect}</code></li>
          <li>Create it, copy the <b>Client ID</b> (it ends in <span className="font-mono text-xs">.apps.googleusercontent.com</span>; it isn't a secret) and paste it below. The client secret isn't needed.</li>
        </ol>
      </details>
      <Field label="Google client ID" htmlFor="gs-client"><input id="gs-client" className="input font-mono text-xs" autoComplete="off" value={id} onChange={(e) => setId(e.target.value)} placeholder="1234567890-abc….apps.googleusercontent.com" /></Field>
      <Toggle id="gs-on" label="Show “Sign in with Google” on the sign-in screen" checked={on} onChange={setOn} />
      <p className="hint">The button works on an address after someone has signed in there once with an email code. That stops a look-alike page from using it.</p>
      {signed === false && <p className="text-[13px] text-amber-200">Sign in to this database on this device first (with an email code) to change this.</p>}
      {err && <p role="alert" className="text-[13px] text-red-300">{err}</p>}
      <div className="flex items-center gap-2 border-t border-ink-700 pt-3"><button type="button" className="btn btn-pri btn-sm" disabled={busy || same || signed === false || (on && !id.trim())} onClick={save}>{busy ? "Saving…" : "Save"}</button>{on && !id.trim() && <span className="hint">Paste the client ID first.</span>}</div>
    </section>
  );
}
