// The Cloudflare side of a one-click setup. useCfAccount: the Studio's helper, a pre-filled token link and the
// account (one token on this device for hosting pages, the database and Workers). useCloudflarePicker adds Resend
// for sign-in codes, and ensure() creates (or updates) the Studio's database on Cloudflare: D1, its tables and the Worker.
import { useEffect, useState } from "react";
import type { Relay } from "../lib/relay";
import { Netlify } from "../lib/netlify";
import { Cloudflare, CfError, type CfAccount } from "../lib/cloudflare";
import { CF_DB_TOKEN_PAGE, cfAccountVault, setupCfDb, type CfDbSetup, type CfMoreToken } from "../lib/cfdb";
import { useHelper } from "./HelperBox";
import { CF_OAUTH_SCOPES, cfOauthCfg, cfOauthFreshen, cfOauthKeepToken, cfOauthOpen, cfOauthRedirect } from "../lib/cfoauth";

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
    cfAccountVault.load(studioToken).then(async (v) => {
      if (!v) return;
      // A kept Cloudflare sign-in is renewed before it's used.
      if (await cfOauthFreshen(v)) await cfAccountVault.save(v, studioToken);
      setTok(v.token || ""); if (v.account) setAccount(v.account); setMore(v.more || []);
    });
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
      if (persist) { const v = await cfAccountVault.load(studioToken); await cfAccountVault.save({ ...(v || {}), token: tok.trim(), account: pick, ...(v?.token !== tok.trim() ? { oauth: undefined } : {}) }, studioToken); }
    } catch (e: any) { setErr(e?.message || "Couldn't reach Cloudflare."); }
    setBusy("");
  };
  // ---- Connect Cloudflare: Cloudflare's own sign-in window in place of a pasted token.
  const [oc, setOc] = useState(cfOauthCfg.get), [ocEdit, setOcEdit] = useState(cfOauthCfg.get), [ocNote, setOcNote] = useState(""), [ocBusy, setOcBusy] = useState("");
  const [ocFlow, setOcFlow] = useState<{ cancel: () => void } | null>(null);
  const oauthConnect = async () => {
    setErr(""); setOcNote("");
    let flow: ReturnType<typeof cfOauthOpen>;
    try { flow = cfOauthOpen(oc); } catch (e: any) { setErr(e?.message || "Couldn't open Cloudflare."); return; }
    setOcFlow(flow); setOcBusy("Waiting for you to press Allow on Cloudflare");
    try {
      const got = await flow.done; setOcFlow(null);
      setOcBusy("Reading your accounts");
      const relay = await helper.get(setOcBusy), viaSignIn = new Cloudflare(relay, got.access);
      let list: CfAccount[];
      try { list = await viaSignIn.accounts(); } catch (e: any) { throw new Error(e instanceof CfError && (e.status === 401 || e.status === 403) ? "Cloudflare signed you in but didn't allow reading your accounts. Check that the OAuth client has the Account Settings (read) permission, then press Connect Cloudflare again." : e?.message || "Couldn't reach Cloudflare."); }
      if (!list.length) throw new Error("Cloudflare connected, but no account was allowed. Press Connect Cloudflare again and tick an account.");
      // Nothing already set up is replaced: a token that still works stays, and only accounts it can't reach are added.
      const v = persist ? await cfAccountVault.load(studioToken) : null;
      let mainList: CfAccount[] | null = persist ? accounts : null;
      if (v?.token && !mainList) {
        try { mainList = await new Cloudflare(relay, v.token).accounts(); }
        // Only a token Cloudflare refuses counts as gone; on any other trouble the saved one is left alone.
        catch (e: any) { if (!(e instanceof CfError) || (e.status !== 401 && e.status !== 403)) throw new Error("Couldn't check the token already saved on this device, so nothing was changed. Try again in a moment."); mainList = null; }
      }
      const mainAlive = !!v?.token && !!mainList?.length;
      const fresh = mainAlive ? list.filter((a) => !mainList!.some((m) => m.id === a.id)) : list;
      if (mainAlive && !fresh.length) { if (!accounts) setAccounts(mainList); setOcNote(`Already connected to ${list.map((a) => a.name).join(", ")}. Your saved token still works, so nothing was changed.`); setOcBusy(""); return; }
      setOcBusy("Making the Studio's own token");
      const kept = await cfOauthKeepToken(viaSignIn, got, fresh, oc.client, async (t) => { try { return (await new Cloudflare(relay, t).accounts()).length > 0; } catch { return false; } });
      const names = fresh.map((a) => a.name).join(", ");
      const how = kept.lasting ? "The Studio made its own token for it, kept encrypted on this device." : "Cloudflare didn't let the Studio make a long-lasting token, so this device renews the connection by itself. Publishing from a site's own admin screen still needs a pasted token.";
      if (!mainAlive) {
        const pick = list.some((x) => x.id === account) ? account : list[0].id;
        setTok(kept.token); setAccounts(list); setAccount(pick);
        if (persist) { const cur = await cfAccountVault.load(studioToken); await cfAccountVault.save({ ...(cur || {}), token: kept.token, oauth: kept.oauth, account: pick }, studioToken); }
        const dbAcc = v?.setup?.account;
        setOcNote(`Connected to ${names}. ${how}${dbAcc && !list.some((a) => a.id === dbAcc) ? " This connection can't see the account your Studio's database is on; nothing there was changed. Press Connect Cloudflare again and tick that account too." : ""}`);
      } else {
        const next = [...more.filter((m) => !m.accounts.every((a) => fresh.some((f) => f.id === a.id))), { token: kept.token, accounts: fresh.map((a) => ({ id: a.id, name: a.name })), ...(kept.oauth ? { oauth: kept.oauth } : {}) }];
        await saveMore(next);
        if (kept.lasting) dispatchEvent(new CustomEvent("studio:cf-account-added", { detail: kept.token }));
        setOcNote(`Added ${names}. ${how} The account you were already connected to is unchanged.`);
      }
    } catch (e: any) { setOcFlow(null); setErr(e?.message || "Couldn't connect Cloudflare."); }
    setOcBusy("");
  };
  const saveOc = () => { cfOauthCfg.set(ocEdit); const c = cfOauthCfg.get(); setOc(c); setOcEdit(c); };
  const ocUi = (
    <div className="flex flex-col gap-2 rounded-lg border border-ink-700 p-3" aria-label="Connect Cloudflare">
      {oc.client ? <>
        <p><button type="button" className="btn btn-sm btn-pri" disabled={!!ocBusy || !helper.ready} onClick={oauthConnect}>{ocBusy ? "Connecting…" : "Connect Cloudflare"}</button> <span className="text-ink-400">A Cloudflare window opens: choose the account, press <b>Allow</b>, and you're back here. No token to create or paste. {persist ? "The Studio then makes its own token for the accounts you allowed, kept encrypted on this device only." : "Used now only, not kept."}</span></p>
        {ocBusy && <p role="status" className="text-ink-300">{ocBusy}… {ocFlow && <button type="button" className="text-brand-300 underline" onClick={() => ocFlow.cancel()}>Cancel</button>}</p>}
        {ocNote && <p role="status" className="text-emerald-300">{ocNote}</p>}
      </> : <p className="text-ink-300"><b className="text-ink-100">Connect Cloudflare in one click.</b> Set it up once below, then no token needs creating or pasting.</p>}
      <details className="text-ink-400" open={!oc.client}>
        <summary className="cursor-pointer select-none">{oc.client ? "One-click connect settings" : "Set up one-click connect (once)"}</summary>
        <ol className="mt-1.5 list-decimal space-y-1 pl-5">
          <li>In Cloudflare open <a className="text-brand-300 underline" href="https://dash.cloudflare.com/?to=/:account/oauth-clients" target="_blank" rel="noopener noreferrer">Manage Account → OAuth clients ↗</a> and press <b>Create client</b>.</li>
          <li>Token authentication method: <b>None</b> (a browser app, no secret). Grant types: <b>Authorization code</b> and <b>Refresh token</b>.</li>
          <li>Redirect URL: <code className="select-all break-all font-mono text-xs text-ink-200">{cfOauthRedirect()}</code>. Allowed CORS origin: <code className="select-all font-mono text-xs text-ink-200">{location.origin}</code></li>
          <li>Permissions: Workers Scripts, D1, Workers Routes, Zone and DNS (write), Account Settings (read), and API Tokens (write) so the Studio can make its own token.</li>
          <li>Copy the <b>Client ID</b> (it isn't a secret) and paste it here.</li>
        </ol>
        <div className="mt-2 flex flex-col gap-2">
          <label className="flex flex-col gap-1"><span className="label">OAuth client ID</span><input aria-label="Cloudflare OAuth client ID" className="input font-mono text-xs" autoComplete="off" value={ocEdit.client} onChange={(e) => setOcEdit({ ...ocEdit, client: e.target.value })} placeholder="Client ID from Cloudflare" /></label>
          <label className="flex flex-col gap-1"><span className="label">Permissions to ask for (Cloudflare's scope names, as shown on the client)</span><input aria-label="Cloudflare OAuth permissions" className="input font-mono text-xs" autoComplete="off" value={ocEdit.scopes} onChange={(e) => setOcEdit({ ...ocEdit, scopes: e.target.value })} placeholder={CF_OAUTH_SCOPES} /></label>
          <div className="flex items-center gap-2"><button type="button" className="btn btn-sm" disabled={ocEdit.client.trim() === oc.client && ocEdit.scopes.trim() === oc.scopes} onClick={saveOc}>Save</button><span>Saved on this device. Until the client is made public in Cloudflare, it works for members of the account it was created in.</span></div>
        </div>
      </details>
    </div>
  );
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
      {ocUi}
      <p>{oc.client && <span className="text-ink-400">Or paste a token: </span>}<a className={oc.client ? "btn btn-sm" : "btn btn-sm btn-pri"} href={CF_DB_TOKEN_PAGE} target="_blank" rel="noopener noreferrer">Create a Cloudflare token ↗</a> <span className="text-ink-400">The permissions are already ticked (Workers, D1, account settings, and your domains and their DNS, so the Studio can connect a domain). Press <b>Continue to summary → Create Token</b>, copy it and paste it here. {persist ? "It's kept encrypted on this device only." : "Used now only, not kept."}</span></p>
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
    if (persist) { const v = await cfAccountVault.load(studioToken); await cfAccountVault.save({ ...(v || {}), token: t.trim(), account: pick, ...(v?.token !== t.trim() ? { oauth: undefined } : {}) }, studioToken); }
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
