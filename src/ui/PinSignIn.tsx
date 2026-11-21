// PIN sign-in: email + a 4 to 6 digit PIN instead of an emailed code, on a device that has already signed in with a code.
// The owners switch it on in Settings; each person then sets their own PIN right after signing in.
import { useEffect, useState } from "react";
import { cfPinDev, cfPinEnroll, cfPinInfo, cfPinLogin, cfPinRemove, cfPinSave, cfPinSetOn, cfSession } from "../lib/cfdb";
import { Field, Toggle, useToast } from "./kit";

const SKIP = (api: string) => "site-pin-skip:" + api;
const skipped = (api: string) => { try { return sessionStorage.getItem(SKIP(api)) === "1"; } catch { return false; } };
const digits = (v: string) => v.replace(/\D/g, "").slice(0, 6);

/** After someone signs in: true when they should be asked to set a PIN now (PIN sign-in is on, they have none, and they haven't said "Not now" in this visit). Also gives a device that signed in another way the PIN. */
export async function pinNeedsSetup(api: string): Promise<boolean> {
  const i = await cfPinInfo(api);
  if (!i.on) return false;
  if (i.has) { await cfPinEnroll(api); return false; }
  return i.has === false && !skipped(api);
}

/** The sign-in screen's PIN step: the email last used on this device, and the PIN. */
export function PinLogin({ api, onIn, onCode, disabled }: { api: string; onIn: () => void | Promise<void>; onCode: () => void; disabled?: boolean }) {
  const [email, setEmail] = useState(cfPinDev.last(api) || ""), [pin, setPin] = useState(""), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const go = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try { await cfPinLogin(api, email, pin); await onIn(); } catch (x: any) { setErr(x?.message || "Couldn't sign in."); setPin(""); }
    setBusy(false);
  };
  return (
    <form className="flex flex-col gap-3" onSubmit={go} aria-label="Sign in with a PIN">
      <p className="text-sm text-ink-300">Enter your PIN to sign in on this device.</p>
      <Field label="Email" htmlFor="pin-email"><input id="pin-email" className="input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
      <Field label="PIN" htmlFor="pin-pin"><input id="pin-pin" className="input font-mono text-lg tracking-[0.4em]" type="password" inputMode="numeric" autoComplete="current-password" maxLength={6} autoFocus value={pin} onChange={(e) => setPin(digits(e.target.value))} /></Field>
      <button className="btn btn-pri" disabled={busy || disabled || !email.includes("@") || pin.length < 4}>{busy ? "Checking…" : "Sign in"}</button>
      {err && <p role="alert" className="rounded-lg border border-amber-400/40 bg-amber-400/5 px-3 py-2 text-[13px] text-amber-100">{err}</p>}
      <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={onCode}>Use an emailed code instead</button>
    </form>
  );
}

/** Choose a PIN: asked once after signing in while PIN sign-in is on; "Not now" asks again next visit. */
export function PinSetup({ api, onDone, skippable = true }: { api: string; onDone: () => void; skippable?: boolean }) {
  const [a, setA] = useState(""), [b, setB] = useState(""), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setErr("");
    if (a !== b) return setErr("The two PINs don't match.");
    setBusy(true); try { await cfPinSave(api, a); onDone(); } catch (x: any) { setErr(x?.message || "Couldn't save the PIN."); }
    setBusy(false);
  };
  return (
    <form className="flex flex-col gap-3" onSubmit={save} aria-label="Set a PIN">
      <p className="text-sm text-ink-300"><b className="text-ink-100">Set a PIN</b> to sign in faster next time: your email and PIN, no code. 4 to 6 digits. It only works on devices where you've signed in with a code.</p>
      <Field label="New PIN" htmlFor="pin-a"><input id="pin-a" className="input font-mono text-lg tracking-[0.4em]" type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} autoFocus value={a} onChange={(e) => setA(digits(e.target.value))} /></Field>
      <Field label="Type it again" htmlFor="pin-b"><input id="pin-b" className="input font-mono text-lg tracking-[0.4em]" type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={b} onChange={(e) => setB(digits(e.target.value))} /></Field>
      <button className="btn btn-pri" disabled={busy || a.length < 4 || b.length < 4}>{busy ? "Saving…" : "Save PIN"}</button>
      {err && <p role="alert" className="rounded-lg border border-amber-400/40 bg-amber-400/5 px-3 py-2 text-[13px] text-amber-100">{err}</p>}
      {skippable && <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => { try { sessionStorage.setItem(SKIP(api), "1"); } catch { /* asks again */ } onDone(); }}>Not now</button>}
    </form>
  );
}

/** Settings: switch PIN sign-in on for everyone who signs in to this database (owners), and set, change or remove your own PIN. */
export function PinCard({ api, what = "this Studio and the admin pages of the sites on its database" }: { api: string; what?: string }) {
  const toast = useToast();
  const [info, setInfo] = useState<{ on: boolean; has?: boolean } | null>(null), [busy, setBusy] = useState(false), [setup, setSetup] = useState(false);
  const signed = !!cfSession.load(api);
  const load = () => cfPinInfo(api).then(setInfo);
  useEffect(() => { void load(); }, [api]);
  if (!info) return null;
  const flip = async (on: boolean) => { setBusy(true); try { await cfPinSetOn(api, on); await load(); toast(on ? "PIN sign-in is on. Each person is asked to set a PIN when they next sign in." : "PIN sign-in is off."); } catch (e: any) { toast(e?.message || "Couldn't change that.", "bad"); } setBusy(false); };
  return (
    <section className="card flex flex-col gap-3 p-5" aria-label="PIN sign-in">
      <h3 className="flex items-center gap-2 text-[15px] font-extrabold">Sign in with a PIN<span className={`chip ${info.on ? "border-emerald-400/50 text-emerald-200" : "border-ink-600 text-ink-400"}`}>{info.on ? "On" : "Off"}</span></h3>
      <p className="text-sm text-ink-300">Lets each person sign in to {what} with their email and a 4 to 6 digit PIN instead of waiting for a code. They set the PIN themselves right after signing in. It only works on a device that has already signed in with an emailed code, five wrong PINs pause it for 15 minutes, and the emailed code always still works.</p>
      <Toggle id="pin-on" label="Offer PIN sign-in" checked={info.on} onChange={(v) => { if (!busy && signed) void flip(v); }} />
      {!signed && <p className="text-[13px] text-amber-200">Sign in to this database on this device first to change this.</p>}
      {info.on && signed && (setup ? <PinSetup api={api} skippable={false} onDone={() => { setSetup(false); void load(); toast("PIN saved."); }} />
        : <div className="flex flex-wrap items-center gap-2 border-t border-ink-700 pt-3"><span className="text-sm text-ink-300">{info.has ? "You have a PIN." : "You haven't set a PIN yet."}</span>
            <button type="button" className="btn btn-sm" onClick={() => setSetup(true)}>{info.has ? "Change my PIN" : "Set my PIN"}</button>
            {info.has && <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={async () => { setBusy(true); try { await cfPinRemove(api); await load(); toast("Your PIN was removed."); } catch (e: any) { toast(e?.message || "Couldn't remove it.", "bad"); } setBusy(false); }}>Remove my PIN</button>}</div>)}
    </section>
  );
}
