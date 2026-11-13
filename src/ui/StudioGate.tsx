// Sign-in for a Studio hosted outside GitHub: a 6-digit code by email. Only emails listed as members of this
// Studio (studio_members) get in; anyone else is told so and signed out again.
import { useEffect, useState } from "react";
import { type StudioHostCfg } from "../lib/studiohost";
import { backendOf } from "../lib/backend";
import { Field, Logo, Spinner } from "./kit";
import { BrandMark } from "../lib/brand";

export function StudioGate({ cfg, brand, onIn }: { cfg: StudioHostCfg; brand: string; onIn: (email: string, role: string) => void }) {
  const [email, setEmail] = useState(""), [code, setCode] = useState(""), [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(true), [err, setErr] = useState("");
  const be = backendOf(cfg);
  const admit = async () => {
    const who = await be.signedIn();
    const role = who ? await be.role() : null;
    if (who && role) return onIn(who, role);
    await be.signOut().catch(() => {});
    setErr(`${who || "This email"} isn't a member of this Studio. Ask its owner to add you.`);
  };
  useEffect(() => { be.signedIn().then((e) => (e ? admit() : undefined)).catch(() => {}).finally(() => setBusy(false)); }, []);
  const send = async (e?: React.FormEvent) => { e?.preventDefault(); setErr(""); setBusy(true); try { await be.sendCode(email); setSent(true); } catch (x: any) { setErr(x?.message || "Couldn't send the code."); } setBusy(false); };
  const verify = async (e: React.FormEvent) => { e.preventDefault(); setErr(""); setBusy(true); try { await be.verifyCode(email, code); await admit(); } catch (x: any) { setErr(x?.message || "Couldn't sign in."); } setBusy(false); };
  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="card flex w-full max-w-sm flex-col gap-4 p-6">
        <div className="flex items-center gap-2.5 font-extrabold"><BrandMark fallback={<Logo />} />{brand}</div>
        {cfg.partner && <p className="text-[12.5px] text-ink-400">Set up by <b className="text-ink-200">{cfg.partner.name}</b></p>}
        {busy && !sent && !email ? <Spinner label="Checking your sign-in…" /> : !sent ? (
          <form className="flex flex-col gap-3" onSubmit={send}>
            <p className="text-sm text-ink-300">Sign in with your email. We'll send a 6-digit code.</p>
            <Field label="Email" htmlFor="st-in-email"><input id="st-in-email" className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <button className="btn btn-pri" disabled={busy || !email.includes("@")}>{busy ? "Sending…" : "Email me a code"}</button>
          </form>
        ) : (
          <form className="flex flex-col gap-3" onSubmit={verify}>
            <p className="text-sm text-ink-300">Enter the code sent to <b className="text-ink-100">{email}</b>. It can take a minute; check spam too.</p>
            <Field label="Code" htmlFor="st-in-code"><input id="st-in-code" className="input font-mono text-lg tracking-widest" inputMode="numeric" autoComplete="one-time-code" maxLength={10} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} /></Field>
            <button className="btn btn-pri" disabled={busy || code.length < 6}>{busy ? "Checking…" : "Sign in"}</button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => { setSent(false); setCode(""); }}>Use another email or send a new code</button>
          </form>
        )}
        {err && <p role="alert" className="rounded-lg border border-amber-400/40 bg-amber-400/5 px-3 py-2 text-[13px] text-amber-100">{err}</p>}
      </div>
    </div>
  );
}
