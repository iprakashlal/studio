// Sign-in for a Studio hosted outside GitHub: a 6-digit code by email. Only emails listed as members of this
// Studio (studio_members) get in; anyone else is told so and signed out again.
import { useEffect, useState } from "react";
import { type StudioHostCfg } from "../lib/studiohost";
import { backendOf } from "../lib/backend";
import { Field, Logo, Spinner } from "./kit";
import { BrandMark } from "../lib/brand";
import { GoogleButton } from "./GoogleSignIn";
import { PinLogin, PinSetup, pinNeedsSetup } from "./PinSignIn";
import { cfPinDev, cfPinInfo } from "../lib/cfdb";

export function StudioGate({ cfg, brand, onIn, links }: { cfg: StudioHostCfg; brand: string; onIn: (email: string, role: string) => void; links?: React.ReactNode }) {
  const [email, setEmail] = useState(""), [code, setCode] = useState(""), [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(true), [err, setErr] = useState(""), [pinMode, setPinMode] = useState(false), [after, setAfter] = useState<null | (() => void)>(null);
  const be = backendOf(cfg), api = cfg.kind === "cloudflare" ? cfg.api : "";
  // PIN sign-in: offered first on a device that has signed in with a code here before.
  useEffect(() => { if (api && cfPinDev.last(api)) cfPinInfo(api).then((i) => { if (i.on) setPinMode(true); }); }, []);
  const admit = async () => {
    const who = await be.signedIn();
    const role = who ? await be.role() : null;
    if (who && role) { if (api && (await pinNeedsSetup(api).catch(() => false))) { setAfter(() => () => onIn(who, role)); return; } return onIn(who, role); }
    await be.signOut().catch(() => {});
    setErr(`${who || "This email"} isn't a member of this Studio. Ask its owner to add you.`);
  };
  useEffect(() => { be.signedIn().then((e) => (e ? admit() : undefined)).catch(() => {}).finally(() => setBusy(false)); }, []);
  const send = async (e?: React.FormEvent) => { e?.preventDefault(); setErr(""); setBusy(true); try { await be.sendCode(email); setSent(true); } catch (x: any) { setErr(x?.message || "Couldn't send the code."); } setBusy(false); };
  const verify = async (e: React.FormEvent) => { e.preventDefault(); setErr(""); setBusy(true); try { await be.verifyCode(email, code); await admit(); } catch (x: any) { setErr(x?.message || "Couldn't sign in."); } setBusy(false); };
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="card flex w-full max-w-sm flex-col gap-4 p-6">
        <div className="flex items-center gap-2.5 font-extrabold"><BrandMark fallback={<Logo />} />{brand}</div>
        {cfg.partner && <p className="text-[12.5px] text-ink-400">Set up by <b className="text-ink-200">{cfg.partner.name}</b></p>}
        {after ? <PinSetup api={api} onDone={after} /> : pinMode && !sent ? <PinLogin api={api} onIn={admit} onCode={() => setPinMode(false)} /> : busy && !sent && !email ? <Spinner label="Checking your sign-in…" /> : !sent ? (
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
        {cfg.kind === "cloudflare" && !after && !pinMode && !(busy && !sent && !email) && <GoogleButton api={cfg.api} disabled={busy} onIn={admit} />}
        {err && <p role="alert" className="rounded-lg border border-amber-400/40 bg-amber-400/5 px-3 py-2 text-[13px] text-amber-100">{err}</p>}
        {sharedSource(cfg) && <p className="text-center text-[12.5px] text-ink-400">This Studio keeps its projects in your Cloudflare database. <a className="underline" href="?data=github">Open the older GitHub data instead</a> (for example to bring projects across).</p>}
      </div>
      {links && <div className="mt-4 w-full max-w-sm">{links}</div>}
    </div>
  );
}
/** True on the Studio's own source (GitHub Pages) when it shares the moved Studio's database. */
export const sharedSource = (cfg: StudioHostCfg) => !!cfg.source && location.origin + location.pathname.replace(/[^/]*$/, "") === cfg.source.replace(/\/?$/, "/");
