// The Cloudflare side of a one-click setup. useCfAccount: the Studio's helper, a pre-filled token link and the
// account (one token on this device for hosting pages, the database and Workers). useCloudflarePicker adds Resend
// for sign-in codes, and ensure() creates (or updates) the Studio's database on Cloudflare: D1, its tables and the Worker.
import { useEffect, useState } from "react";
import type { Relay } from "../lib/relay";
import { Netlify } from "../lib/netlify";
import { Cloudflare, type CfAccount } from "../lib/cloudflare";
import { CF_DB_TOKEN_PAGE, cfAccountVault, setupCfDb, type CfDbSetup } from "../lib/cfdb";
import { useHelper } from "./HelperBox";

export type CfAccountHook = ReturnType<typeof useCfAccount>;

export function useCfAccount(studioToken: string, nf: Netlify | null | undefined, persist = true) {
  const helper = useHelper(studioToken, nf, "Cloudflare");
  const [tok, setTok] = useState(""), [accounts, setAccounts] = useState<CfAccount[] | null>(null), [account, setAccount] = useState("");
  const [busy, setBusy] = useState(""), [err, setErr] = useState("");
  useEffect(() => {
    if (!persist) { setTok(""); setAccounts(null); return; }
    cfAccountVault.load(studioToken).then((v) => { if (!v) return; setTok(v.token || ""); if (v.account) setAccount(v.account); });
  }, [studioToken, persist]);
  const connect = async () => {
    setErr(""); setBusy("Connecting");
    try {
      const list = await new Cloudflare(await helper.get(setBusy), tok.trim()).accounts();
      if (!list.length) throw new Error("This token can't see any Cloudflare account. Create it again from the link above.");
      const pick = list.some((x) => x.id === account) ? account : list[0].id;
      setAccounts(list); setAccount(pick);
      if (persist) { const v = await cfAccountVault.load(studioToken); await cfAccountVault.save({ ...(v || {}), token: tok.trim(), account: pick }, studioToken); }
    } catch (e: any) { setErr(e?.message || "Couldn't reach Cloudflare."); }
    setBusy("");
  };
  useEffect(() => { if (persist && tok && !accounts && !busy && helper.ready) connect(); }, [tok && persist, helper.ready]);
  const pickAccount = async (id: string) => { setAccount(id); if (persist) { const v = await cfAccountVault.load(studioToken); if (v) await cfAccountVault.save({ ...v, account: id }, studioToken); } };
  const acc = accounts?.find((a) => a.id === account) || null;
  /** A Cloudflare API client through the helper, for the chosen account. */
  const client = async (step?: (s: string) => void): Promise<{ cf: Cloudflare; relay: Relay; account: CfAccount; token: string }> => {
    if (!acc) throw new Error("Connect your Cloudflare account first.");
    const relay = await helper.get(step);
    return { cf: new Cloudflare(relay, tok.trim()), relay, account: acc, token: tok.trim() };
  };

  const ui = (
    <div className="flex flex-col gap-2.5 text-[13px]">
      {helper.ui}
      <p><a className="btn btn-sm btn-pri" href={CF_DB_TOKEN_PAGE} target="_blank" rel="noopener noreferrer">Create a Cloudflare token ↗</a> <span className="text-ink-400">The permissions are already ticked (Workers, D1, account settings, and your domains and their DNS, so the Studio can connect a domain). Press <b>Continue to summary → Create Token</b>, copy it and paste it here. {persist ? "It's kept encrypted on this device only." : "Used now only, not kept."}</span></p>
      <div className="flex gap-2">
        <input aria-label="Cloudflare API token" className="input min-w-0 flex-1 font-mono text-xs" type="password" autoComplete="off" value={tok} onChange={(e) => { setTok(e.target.value); setAccounts(null); }} placeholder="Cloudflare API token" />
        <button type="button" className="btn btn-sm" disabled={!tok.trim() || !!busy || !helper.ready} onClick={connect}>{busy && !accounts ? busy + "…" : "Connect"}</button>
      </div>
      {accounts && accounts.length > 1 && <label className="flex flex-col gap-1"><span className="label">Cloudflare account</span><select className="input" aria-label="Cloudflare account" value={account} onChange={(e) => pickAccount(e.target.value)}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}
      {acc && <p className="text-emerald-300">Connected to {acc.name}.</p>}
      {err && <p role="alert" className="text-red-300">{err}</p>}
    </div>
  );
  /** Swaps in a new token (e.g. one with more permissions), keeping the same account when it can see it. */
  const replaceToken = async (t: string) => {
    const list = await new Cloudflare(await helper.get(), t.trim()).accounts();
    if (!list.length) throw new Error("This token can't see any Cloudflare account.");
    const pick = list.some((x) => x.id === account) ? account : list[0].id;
    setTok(t.trim()); setAccounts(list); setAccount(pick);
    if (persist) { const v = await cfAccountVault.load(studioToken); await cfAccountVault.save({ ...(v || {}), token: t.trim(), account: pick }, studioToken); }
    return new Cloudflare(await helper.get(), t.trim());
  };
  return { ui, ready: !!acc && helper.ready, account: acc, token: tok.trim(), client, busy, helper, replaceToken };
}

/** The Studio's database on Cloudflare. Pass `shared` to use a Cloudflare account picked elsewhere on the page
 *  (its token box is then not shown again here). */
export function useCloudflarePicker(studioToken: string, nf: Netlify | null | undefined, persist = true, defaultName = "Picaffectz Studio", shared?: CfAccountHook) {
  const own = useCfAccount(studioToken, nf, persist);
  const acc = shared || own;
  const [resendKey, setResendKey] = useState(""), [mailFrom, setMailFrom] = useState(`${defaultName} <onboarding@resend.dev>`);
  const [prev, setPrev] = useState<CfDbSetup | null>(null);
  useEffect(() => {
    if (!persist) { setResendKey(""); setPrev(null); return; }
    cfAccountVault.load(studioToken).then((v) => { if (!v) return; if (v.resendKey) setResendKey(v.resendKey); if (v.mailFrom) setMailFrom(v.mailFrom); if (v.setup) setPrev(v.setup); });
  }, [studioToken, persist]);
  const fromOk = /<[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>$|^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(mailFrom.trim());
  const ready = acc.ready && /^re_/.test(resendKey.trim()) && fromOk;

  /** Creates or updates the database; returns it with what's needed to add members. */
  const ensure = async (step: (s: string) => void) => {
    const { relay, account, token } = await acc.client(step);
    const setup = await setupCfDb(relay, token, { account, resendKey: resendKey.trim(), mailFrom: mailFrom.trim(), name: defaultName, existing: prev && prev.account === account.id ? prev : null }, step);
    if (persist) { const v = await cfAccountVault.load(studioToken); await cfAccountVault.save({ ...(v || {}), token, account: account.id, resendKey: resendKey.trim(), mailFrom: mailFrom.trim(), setup }, studioToken); setPrev(setup); }
    return { setup, relay, token };
  };

  const ui = (
    <div className="flex flex-col gap-2.5 text-[13px]">
      {!shared && own.ui}
      {acc.account && <p className="text-ink-300">{prev && prev.account === acc.account.id ? "The Studio's database is already on this account; it'll be updated." : "A free D1 database and Worker will be created on this account."}</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1"><span className="label">Resend API key (sends sign-in codes)</span><input className="input font-mono text-xs" type="password" autoComplete="off" aria-label="Resend API key for codes" value={resendKey} onChange={(e) => setResendKey(e.target.value)} placeholder="re_…" /></label>
        <label className="flex flex-col gap-1"><span className="label">Codes come from</span><input className="input" aria-label="Sender for codes" value={mailFrom} onChange={(e) => setMailFrom(e.target.value)} /></label>
      </div>
      <p className="text-ink-400"><a className="text-brand-300 underline" href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer">Create a Resend key ↗</a> (free: 3,000 emails a month). <b>onboarding@resend.dev</b> only delivers to your own Resend email; for clients' sign-in, use an address on a domain you verified in Resend.</p>
    </div>
  );
  return { ui, ready, ensure, busy: acc.busy };
}
