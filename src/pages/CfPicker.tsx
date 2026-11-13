// The Cloudflare side of a one-click setup: a pre-filled token link, the account, and Resend for sign-in codes.
// ensure() creates (or updates) the Studio's database on Cloudflare: D1, its tables and the Worker.
import { useEffect, useState } from "react";
import { RELAY_VERSION, relayVault, setupRelay, type Relay } from "../lib/relay";
import { Netlify } from "../lib/netlify";
import { Cloudflare, type CfAccount } from "../lib/cloudflare";
import { CF_DB_TOKEN_PAGE, setupCfDb, type CfDbSetup } from "../lib/cfdb";
import { vault } from "../lib/vault";

const cfdbVault = vault<{ token: string; account?: string; resendKey?: string; mailFrom?: string; setup?: CfDbSetup }>("cfdb");

export function useCloudflarePicker(studioToken: string, nf: Netlify | null, persist = true, defaultName = "Picaffectz Studio") {
  const [tok, setTok] = useState(""), [accounts, setAccounts] = useState<CfAccount[] | null>(null), [account, setAccount] = useState("");
  const [resendKey, setResendKey] = useState(""), [mailFrom, setMailFrom] = useState(`${defaultName} <onboarding@resend.dev>`);
  const [prev, setPrev] = useState<CfDbSetup | null>(null), [busy, setBusy] = useState(""), [err, setErr] = useState("");
  useEffect(() => {
    if (!persist) { setTok(""); setAccounts(null); setResendKey(""); setPrev(null); return; }
    cfdbVault.load(studioToken).then((v) => { if (!v) return; setTok(v.token || ""); if (v.account) setAccount(v.account); if (v.resendKey) setResendKey(v.resendKey); if (v.mailFrom) setMailFrom(v.mailFrom); if (v.setup) setPrev(v.setup); });
  }, [studioToken, persist]);
  const helper = async (): Promise<Relay> => {
    const r = await relayVault.load(studioToken);
    if (r && r.v === RELAY_VERSION) return r;
    if (!nf) throw new Error("Connect Netlify first: the Studio's helper on your Netlify talks to Cloudflare for you.");
    return setupRelay(nf, studioToken, r, (s) => setBusy(s));
  };
  const connect = async () => {
    setErr(""); setBusy("Connecting");
    try {
      const list = await new Cloudflare(await helper(), tok.trim()).accounts();
      if (!list.length) throw new Error("This token can't see any Cloudflare account. Create it again from the link above.");
      setAccounts(list); setAccount((a) => (list.some((x) => x.id === a) ? a : list[0].id));
    } catch (e: any) { setErr(e?.message || "Couldn't reach Cloudflare."); }
    setBusy("");
  };
  useEffect(() => { if (persist && tok && !accounts && !busy && nf) connect(); }, [tok && persist, !!nf]);
  const fromOk = /<[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>$|^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(mailFrom.trim());
  const ready = !!accounts && !!account && /^re_/.test(resendKey.trim()) && fromOk;

  /** Creates or updates the database; returns it with what's needed to add members. */
  const ensure = async (step: (s: string) => void) => {
    const relay = await helper(), acc = accounts!.find((a) => a.id === account)!;
    const setup = await setupCfDb(relay, tok.trim(), { account: acc, resendKey: resendKey.trim(), mailFrom: mailFrom.trim(), name: defaultName, existing: prev && prev.account === acc.id ? prev : null }, step);
    if (persist) { await cfdbVault.save({ token: tok.trim(), account: acc.id, resendKey: resendKey.trim(), mailFrom: mailFrom.trim(), setup }, studioToken); setPrev(setup); }
    return { setup, relay, token: tok.trim() };
  };

  const ui = (
    <div className="flex flex-col gap-2.5 text-[13px]">
      <p><a className="btn btn-sm btn-pri" href={CF_DB_TOKEN_PAGE} target="_blank" rel="noopener noreferrer">Create a Cloudflare token ↗</a> <span className="text-ink-400">The permissions are already ticked (Workers Scripts, D1, Account Settings). Press <b>Continue to summary → Create Token</b>, copy it and paste it here. {persist ? "It's kept encrypted on this device only." : "Used now only, not kept."}</span></p>
      <div className="flex gap-2">
        <input aria-label="Cloudflare API token" className="input min-w-0 flex-1 font-mono text-xs" type="password" autoComplete="off" value={tok} onChange={(e) => { setTok(e.target.value); setAccounts(null); }} placeholder="Cloudflare API token" />
        <button type="button" className="btn btn-sm" disabled={!tok.trim() || !!busy || !nf} onClick={connect}>{busy && !accounts ? busy + "…" : "Connect"}</button>
      </div>
      {accounts && accounts.length > 1 && <label className="flex flex-col gap-1"><span className="label">Cloudflare account</span><select className="input" aria-label="Cloudflare account" value={account} onChange={(e) => setAccount(e.target.value)}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}
      {accounts && <p className="text-emerald-300">Connected to {accounts.find((a) => a.id === account)?.name}.{prev && prev.account === account ? " The Studio's database is already here; it'll be updated." : " A free D1 database and Worker will be created."}</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1"><span className="label">Resend API key (sends sign-in codes)</span><input className="input font-mono text-xs" type="password" autoComplete="off" aria-label="Resend API key for codes" value={resendKey} onChange={(e) => setResendKey(e.target.value)} placeholder="re_…" /></label>
        <label className="flex flex-col gap-1"><span className="label">Codes come from</span><input className="input" aria-label="Sender for codes" value={mailFrom} onChange={(e) => setMailFrom(e.target.value)} /></label>
      </div>
      <p className="text-ink-400"><a className="text-brand-300 underline" href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer">Create a Resend key ↗</a> (free: 3,000 emails a month). <b>onboarding@resend.dev</b> only delivers to your own Resend email; for clients' sign-in, use an address on a domain you verified in Resend.</p>
      {err && <p role="alert" className="text-red-300">{err}</p>}
    </div>
  );
  return { ui, ready, ensure, busy };
}
