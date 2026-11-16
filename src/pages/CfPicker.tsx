// The Cloudflare side of a one-click setup. useCfAccount: the Studio's helper, a pre-filled token link and the
// account (one token on this device for hosting pages, the database and Workers). useCloudflarePicker adds Resend
// for sign-in codes, and ensure() creates (or updates) the Studio's database on Cloudflare: D1, its tables and the Worker.
import { useEffect, useState } from "react";
import type { Relay } from "../lib/relay";
import { Netlify } from "../lib/netlify";
import { Cloudflare, type CfAccount } from "../lib/cloudflare";
import { CF_DB_TOKEN_PAGE, cfAccountVault, setupCfDb, type CfDbSetup, type CfMoreToken } from "../lib/cfdb";
import { useHelper } from "./HelperBox";

export type CfAccountHook = ReturnType<typeof useCfAccount>;

/** `manage`: also shows the list of other Cloudflare accounts with Add and Remove (Studio Settings only; elsewhere only the connected account's name shows). */
/** `site`: this dialog is about one site. The account box then shows and changes that site's own account (kept with
 *  the project), not the account this device uses by default. */
export function useCfAccount(studioToken: string, nf: Netlify | null | undefined, persist = true, manage = false, site?: { id: string; set: (id: string) => void }) {
  const helper = useHelper(studioToken, nf, "Cloudflare");
  const [tok, setTok] = useState(""), [accounts, setAccounts] = useState<CfAccount[] | null>(null), [account, setAccount] = useState("");
  const [busy, setBusy] = useState(""), [err, setErr] = useState("");
  // Other Cloudflare accounts (their own tokens), for sites hosted there.
  const [more, setMore] = useState<CfMoreToken[]>([]), [addOpen, setAddOpen] = useState(false), [addTok, setAddTok] = useState(""), [addBusy, setAddBusy] = useState(""), [addErr, setAddErr] = useState("");
  useEffect(() => {
    if (!persist) { setTok(""); setAccounts(null); setMore([]); return; }
    cfAccountVault.load(studioToken).then((v) => { if (!v) return; setTok(v.token || ""); if (v.account) setAccount(v.account); setMore(v.more || []); });
    // Accounts added or removed in Settings in another tab show up here without reopening.
    const on = (e: StorageEvent) => { if (e.key === "site-studio:cfdb") cfAccountVault.load(studioToken).then((v) => setMore(v?.more || [])); };
    addEventListener("storage", on); return () => removeEventListener("storage", on);
  }, [studioToken, persist]);
  const saveMore = async (list: CfMoreToken[]) => { setMore(list); const v = await cfAccountVault.load(studioToken); await cfAccountVault.save({ ...(v || { token: "" }), more: list }, studioToken); };
  /** Adds another account's token (kept encrypted on this device, like the main one). */
  const addOther = async () => {
    setAddErr(""); setAddBusy("Connecting");
    try {
      const t = addTok.trim(), list = await new Cloudflare(await helper.get(setAddBusy), t).accounts();
      if (!list.length) throw new Error("This token can't see any Cloudflare account. Create it while signed in to that account.");
      const next = [...more.filter((m) => m.token !== t), { token: t, accounts: list.map((a) => ({ id: a.id, name: a.name })) }];
      await saveMore(next); setAddTok(""); setAddOpen(false);
      // Settings → Sites and hosting accounts keeps it on the Studio's database too, so every device sees it.
      dispatchEvent(new CustomEvent("studio:cf-account-added", { detail: t }));
    } catch (e: any) { setAddErr(e?.message || "Couldn't reach Cloudflare."); }
    setAddBusy("");
  };
  const removeOther = (i: number) => saveMore(more.filter((_, k) => k !== i));
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
  /** Every Cloudflare account this device can manage: the main token's, then the other tokens'. */
  const allAccounts: { id: string; name: string; main: boolean }[] = [...(accounts || []).map((a) => ({ id: a.id, name: a.name, main: true }))];
  for (const m of more) for (const a of m.accounts) if (!allAccounts.some((x) => x.id === a.id)) allAccounts.push({ ...a, main: false });
  /** A client for a given account, with the token that can manage it. */
  const clientFor = async (id: string | undefined, step?: (s: string) => void): Promise<{ cf: Cloudflare; relay: Relay; account: CfAccount; token: string }> => {
    const other = id ? more.find((m) => m.accounts.some((a) => a.id === id)) : null;
    if (!other || (accounts || []).some((a) => a.id === id)) {
      if (!id || id === acc?.id) return client(step);
      const a = (accounts || []).find((x) => x.id === id); if (!a) throw new Error("No Cloudflare token on this device can manage that account. Add it in Settings → Hostings → Sites and hosting accounts.");
      const relay = await helper.get(step); return { cf: new Cloudflare(relay, tok.trim()), relay, account: a, token: tok.trim() };
    }
    const relay = await helper.get(step), a = other.accounts.find((x) => x.id === id)!;
    return { cf: new Cloudflare(relay, other.token), relay, account: { id: a.id, name: a.name } as CfAccount, token: other.token };
  };
  /** A Cloudflare API client through the helper, for the chosen account. */
  const client = async (step?: (s: string) => void): Promise<{ cf: Cloudflare; relay: Relay; account: CfAccount; token: string }> => {
    if (!acc) throw new Error("Connect your Cloudflare account first.");
    const relay = await helper.get(step);
    return { cf: new Cloudflare(relay, tok.trim()), relay, account: acc, token: tok.trim() };
  };

  /** The other accounts this device has tokens for, with Add and Remove (shown in Studio Settings only). */
  const others = persist && acc ? (
        <div className="flex flex-col gap-1.5 rounded-lg border border-ink-700 p-2.5" aria-label="Other Cloudflare accounts">
          <span className="font-semibold text-ink-200">Other Cloudflare accounts</span>
          <span className="text-ink-400">For sites hosted on another Cloudflare account (an old one, or a client's). Each site picks its account in Publish to Cloudflare.</span>
          {more.map((m, i) => <span key={i} className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-400" /><span className="min-w-0 flex-1 truncate">{m.accounts.map((a) => a.name).join(", ")}</span><button type="button" className="btn btn-ghost btn-sm" onClick={() => removeOther(i)}>Remove</button></span>)}
          {!addOpen ? <button type="button" className="self-start text-brand-300 underline" onClick={() => setAddOpen(true)}>+ Add another Cloudflare account</button> : <>
            <span className="text-ink-400">Sign in to that account on dash.cloudflare.com in this browser, then <a className="text-brand-300 underline" href={CF_DB_TOKEN_PAGE} target="_blank" rel="noopener noreferrer">create its token ↗</a> (same permissions, already ticked) and paste it here.</span>
            <div className="flex gap-2">
              <input aria-label="Other Cloudflare account token" className="input min-w-0 flex-1 font-mono text-xs" type="password" autoComplete="off" value={addTok} onChange={(e) => setAddTok(e.target.value)} placeholder="That account's API token" />
              <button type="button" className="btn btn-sm" disabled={!addTok.trim() || !!addBusy || !helper.ready} onClick={addOther}>{addBusy ? addBusy + "…" : "Add"}</button>
            </div>
          </>}
          {addErr && <p role="alert" className="text-red-300">{addErr}</p>}
        </div>
      ) : null;
  const ui = (
    <div className="flex flex-col gap-2.5 text-[13px]">
      {helper.ui}
      <p><a className="btn btn-sm btn-pri" href={CF_DB_TOKEN_PAGE} target="_blank" rel="noopener noreferrer">Create a Cloudflare token ↗</a> <span className="text-ink-400">The permissions are already ticked (Workers, D1, account settings, and your domains and their DNS, so the Studio can connect a domain). Press <b>Continue to summary → Create Token</b>, copy it and paste it here. {persist ? "It's kept encrypted on this device only." : "Used now only, not kept."}</span></p>
      <div className="flex gap-2">
        <input aria-label="Cloudflare API token" className="input min-w-0 flex-1 font-mono text-xs" type="password" autoComplete="off" value={tok} onChange={(e) => { setTok(e.target.value); setAccounts(null); }} placeholder="Cloudflare API token" />
        <button type="button" className="btn btn-sm" disabled={!tok.trim() || !!busy || !helper.ready} onClick={connect}>{busy && !accounts ? busy + "…" : "Connect"}</button>
      </div>
      {site && acc ? (() => {
        // One site: its own account, from every account this device has a token for.
        const cur = site.id || acc.id, known = allAccounts.some((a) => a.id === cur);
        return <>
          {(allAccounts.length > 1 || !known) && <label className="flex flex-col gap-1"><span className="label">Cloudflare account for this site</span>
            <select className="input" aria-label="Cloudflare account for this site" value={cur} onChange={(e) => site.set(e.target.value)}>
              {!known && <option value={cur}>The site's account (no token for it on this device yet)</option>}
              {allAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select></label>}
          <p className={known ? "text-emerald-300" : "text-amber-200"}>{known ? `Connected to ${allAccounts.find((a) => a.id === cur)!.name}.` : "This site is on a Cloudflare account this device has no token for. Add it in Settings → Hostings → Sites and hosting accounts."} <span className="text-ink-400">This site's own account, saved with this project only.</span></p>
        </>;
      })() : <>
        {accounts && accounts.length > 1 && <label className="flex flex-col gap-1"><span className="label">Cloudflare account</span><select className="input" aria-label="Cloudflare account" value={account} onChange={(e) => pickAccount(e.target.value)}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}
        {acc && <p className="text-emerald-300">Connected to {acc.name}.</p>}
      </>}
      {err && <p role="alert" className="text-red-300">{err}</p>}
      {manage && others}
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
  return { ui, othersUi: others, ready: !!acc && helper.ready, account: acc, token: tok.trim(), client, clientFor, allAccounts, busy, helper, replaceToken };
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
  /** `forAccount`: a site's own account. When it isn't the account this device uses for the Studio's database, the
   *  database is made there (that site's own database) and kept beside the Studio's, which stays as it is. */
  const ensure = async (step: (s: string) => void, over?: { mailFrom?: string; resendKey?: string }, forAccount?: string) => {
    const v0 = persist ? await cfAccountVault.load(studioToken) : null;
    const mainAcc = v0?.setup?.account || acc.account?.id || "";
    if (forAccount && forAccount !== mainAcc) {
      const { relay, account, token } = await acc.clientFor(forAccount, step);
      const from = (over?.mailFrom || mailFrom).trim(), key = (over?.resendKey || resendKey).trim();
      if (over?.mailFrom) setMailFrom(from);
      if (over?.resendKey) setResendKey(key);
      const setup = await setupCfDb(relay, token, { account, resendKey: key, mailFrom: from, name: defaultName, existing: (v0?.setups || []).find((s) => s.account === account.id) || null }, step);
      if (persist) { const v = await cfAccountVault.load(studioToken); await cfAccountVault.save({ ...(v || { token: "" }), resendKey: key, mailFrom: from, setups: [...(v?.setups || []).filter((s) => s.account !== account.id), setup] }, studioToken); }
      return { setup, relay, token };
    }
    const { relay, account, token } = await acc.client(step);
    const from = (over?.mailFrom || mailFrom).trim(), key = (over?.resendKey || resendKey).trim();
    if (over?.mailFrom) setMailFrom(from);
    if (over?.resendKey) setResendKey(key);
    const setup = await setupCfDb(relay, token, { account, resendKey: key, mailFrom: from, name: defaultName, existing: prev && prev.account === account.id ? prev : null }, step);
    if (persist) { const v = await cfAccountVault.load(studioToken); await cfAccountVault.save({ ...(v || {}), token, account: account.id, resendKey: key, mailFrom: from, setup }, studioToken); setPrev(setup); }
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
  return { ui, ready, ensure, busy: acc.busy, mail: { key: resendKey.trim(), from: mailFrom.trim() } };
}
