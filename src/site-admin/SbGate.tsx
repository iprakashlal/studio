// Sign-in for sites hosted outside GitHub: a 6-digit code by email (Supabase Auth). Only emails listed in
// site_admins for this site can edit; anyone else is told so and signed out again.
import { useEffect, useState } from "react";
import { isAdmin, sbClient, sendCode, signedInEmail, verifyCode, type SbCfg } from "../lib/supa";
import { Field, Logo, Spinner, useToast } from "../ui/kit";

export const sbSignOut = (sb: Pick<SbCfg, "url" | "key">) => sbClient(sb).auth.signOut().then(() => undefined, () => undefined);

export function SbGate({ sb, brand, onIn }: { sb: SbCfg; brand: string; onIn: () => void }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState("");

  const admit = async () => {
    if (await isAdmin(sb)) return onIn();
    const who = await signedInEmail(sb);
    await sbSignOut(sb);
    setErr(`${who || "This email"} can't edit this site. Ask the site's owner to add it as an editor.`);
  };
  useEffect(() => {
    signedInEmail(sb).then((e) => (e ? admit() : undefined)).catch(() => {}).finally(() => setBusy(false));
  }, []);

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setErr(""); setBusy(true);
    try { await sendCode(sb, email); setSent(true); } catch (x: any) { setErr(x?.message || "Couldn't send the code."); }
    setBusy(false);
  };
  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try { await verifyCode(sb, email, code); await admit(); } catch (x: any) { setErr(x?.message || "Couldn't sign in."); }
    setBusy(false);
  };

  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="card flex w-full max-w-sm flex-col gap-4 p-6">
        <div className="flex items-center gap-2.5 font-extrabold"><Logo />{brand}</div>
        {busy && !sent && !email ? <Spinner label="Checking your sign-in…" /> : !sent ? (
          <form className="flex flex-col gap-3" onSubmit={send}>
            <p className="text-sm text-ink-300">Sign in with your email. We'll send a 6-digit code.</p>
            <Field label="Email" htmlFor="sb-in-email"><input id="sb-in-email" className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <button className="btn btn-pri" disabled={busy || !email.includes("@")}>{busy ? "Sending…" : "Email me a code"}</button>
          </form>
        ) : (
          <form className="flex flex-col gap-3" onSubmit={verify}>
            <p className="text-sm text-ink-300">Enter the code sent to <b className="text-ink-100">{email}</b>. It can take a minute; check spam too.</p>
            <Field label="Code" htmlFor="sb-in-code"><input id="sb-in-code" className="input font-mono text-lg tracking-widest" inputMode="numeric" autoComplete="one-time-code" maxLength={10} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} /></Field>
            <button className="btn btn-pri" disabled={busy || code.length < 6}>{busy ? "Checking…" : "Sign in"}</button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => { setSent(false); setCode(""); }}>Use another email or send a new code</button>
          </form>
        )}
        {err && <p role="alert" className="rounded-lg border border-amber-400/40 bg-amber-400/5 px-3 py-2 text-[13px] text-amber-100">{err}</p>}
        <a href="./" className="text-sm text-ink-400 hover:text-ink-100">← Back to the website</a>
      </div>
    </div>
  );
}

export function SbAccount({ sb, onSignOut }: { sb: SbCfg; onSignOut: () => void }) {
  const toast = useToast();
  const [who, setWho] = useState("");
  useEffect(() => { signedInEmail(sb).then((e) => setWho(e || "")); }, []);
  return (
    <div className="card flex flex-col gap-3 p-5">
      <p className="text-sm text-ink-300">Signed in as <b className="text-ink-100">{who || "…"}</b> with an email code. You stay signed in on this device until you sign out, or after 30 minutes without activity.</p>
      <p className="hint">To add or remove editors, the site's owner edits the site_admins table in Supabase.</p>
      <button type="button" className="btn self-start" onClick={async () => { await sbSignOut(sb); toast("Signed out"); onSignOut(); }}>Sign out</button>
    </div>
  );
}
