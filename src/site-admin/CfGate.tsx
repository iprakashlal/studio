// Sign-in for sites hosted on the Studio's Cloudflare database: a 6-digit code by email. Only the site's editors
// (members of "site:<id>") get in; anyone else is told so and signed out again.
import { useEffect, useState } from "react";
import { cfRole, resendTestOnly, cfSendCode, cfSession, cfSignedIn, cfVerifyCode } from "../lib/cfdb";
import type { CfSiteCfg } from "../lib/supa";
import { Field, Logo, Spinner, useToast } from "../ui/kit";

export function CfGate({ cf, brand, onIn }: { cf: CfSiteCfg; brand: string; onIn: () => void }) {
  const [email, setEmail] = useState(""), [code, setCode] = useState(""), [sent, setSent] = useState(false), [busy, setBusy] = useState(true), [err, setErr] = useState("");
  const admit = async () => {
    const who = await cfSignedIn(cf.api);
    if (who && (await cfRole(cf.api, "site:" + cf.site))) return onIn();
    cfSession.clear(cf.api);
    setErr(`${who || "This email"} can't edit this site. Ask the site's owner to add it as an editor.`);
  };
  useEffect(() => { cfSignedIn(cf.api).then((e) => (e ? admit() : undefined)).catch(() => {}).finally(() => setBusy(false)); }, []);
  const [own, setOwn] = useState<string | null>(null);
  const send = async (e?: React.FormEvent, to = email.trim()) => {
    e?.preventDefault(); setErr(""); setOwn(null); setBusy(true);
    try { await cfSendCode(cf.api, to); setEmail(to); setSent(true); }
    catch (x: any) {
      const o = resendTestOnly(x?.message || "");
      if (o && o !== to.toLowerCase()) { setOwn(o); setErr(`This site's sign-in email is still in test mode, so codes can only go to ${o}. Sign in with that address, or ask the site's owner to send codes from the site's domain (Studio → hosting window → Email settings).`); }
      else setErr(x?.message || "Couldn't send the code.");
    }
    setBusy(false);
  };
  const verify = async (e: React.FormEvent) => { e.preventDefault(); setErr(""); setBusy(true); try { await cfVerifyCode(cf.api, email.trim(), code); await admit(); } catch (x: any) { setErr(x?.message || "Couldn't sign in."); } setBusy(false); };
  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="card flex w-full max-w-sm flex-col gap-4 p-6">
        <div className="flex items-center gap-2.5 font-extrabold"><Logo />{brand}</div>
        {busy && !sent && !email ? <Spinner label="Checking your sign-in…" /> : !sent ? (
          <form className="flex flex-col gap-3" onSubmit={send}>
            <p className="text-sm text-ink-300">Sign in with your email. We'll send a 6-digit code.</p>
            <Field label="Email" htmlFor="cf-in-email"><input id="cf-in-email" className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <button className="btn btn-pri" disabled={busy || !email.includes("@")}>{busy ? "Sending…" : "Email me a code"}</button>
          </form>
        ) : (
          <form className="flex flex-col gap-3" onSubmit={verify}>
            <p className="text-sm text-ink-300">Enter the code sent to <b className="text-ink-100">{email}</b>. It can take a minute; check spam too.</p>
            <Field label="Code" htmlFor="cf-in-code"><input id="cf-in-code" className="input font-mono text-lg tracking-widest" inputMode="numeric" autoComplete="one-time-code" maxLength={10} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} /></Field>
            <button className="btn btn-pri" disabled={busy || code.length < 6}>{busy ? "Checking…" : "Sign in"}</button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => { setSent(false); setCode(""); }}>Use another email or send a new code</button>
          </form>
        )}
        {err && <p role="alert" className="rounded-lg border border-amber-400/40 bg-amber-400/5 px-3 py-2 text-[13px] text-amber-100">{err}</p>}
        {own && !sent && <button type="button" className="btn btn-sm self-start" disabled={busy} onClick={() => send(undefined, own)}>Send the code to {own}</button>}
        <a href="./" className="text-sm text-ink-400 hover:text-ink-100">← Back to the website</a>
      </div>
    </div>
  );
}

export function CfAccount({ cf, onSignOut }: { cf: CfSiteCfg; onSignOut: () => void }) {
  const toast = useToast();
  const [who, setWho] = useState("");
  useEffect(() => { cfSignedIn(cf.api).then((e) => setWho(e || "")); }, []);
  return (
    <div className="card flex flex-col gap-3 p-5">
      <p className="text-sm text-ink-300">Signed in as <b className="text-ink-100">{who || "…"}</b> with an email code. You stay signed in on this device until you sign out, or after 30 minutes without activity.</p>
      <p className="hint">The site's owner adds or removes editors from Site Studio.</p>
      <button type="button" className="btn self-start" onClick={() => { cfSession.clear(cf.api); toast("Signed out"); onSignOut(); }}>Sign out</button>
    </div>
  );
}
