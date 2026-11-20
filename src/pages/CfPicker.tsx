// The Cloudflare side of a one-click setup. useCfAccount: the Studio's helper, a pre-filled token link and the
// account (one token on this device for hosting pages, the database and Workers). useCloudflarePicker adds Resend
// for sign-in codes, and ensure() creates (or updates) the Studio's database on Cloudflare: D1, its tables and the Worker.
import { useEffect, useState } from "react";
import type { Relay } from "../lib/relay";
import { Netlify } from "../lib/netlify";
import { Cloudflare, CfError, cfDbToken, isCfDbToken, type CfAccount } from "../lib/cloudflare";
import { CF_DB_TOKEN_PAGE, CFDB_WORKER, cfAccountVault, cfDeployInfo, cfMemTokens, cfShortTokens, setupCfDb, studioDbWay, type CfDbSetup, type CfMoreToken } from "../lib/cfdb";
import { useHelper } from "./HelperBox";
import { CF_OAUTH_SCOPES, CF_OAUTH_SETUP_TOKEN_PAGE, cfMem, cfOauthCfg, cfOauthMint, cfOauthOpen, cfOauthRedirect, cfOauthSetup } from "../lib/cfoauth";
import { brand } from "../lib/brand";

export type CfAccountHook = ReturnType<typeof useCfAccount>;

/** `manage`: also shows the list of other Cloudflare accounts with Add and Remove (Studio Settings only; elsewhere only the connected account's name shows). */
/** `site`: this dialog is about one site. The account box then shows and changes that site's own account (kept with
 *  the project), not the account this device uses by default. */
export function useCfAccount(studioToken: string, nf: Netlify | null | undefined, persist = true, manage = false, site?: { id: string; set: (id: string) => void }) {
  const helper = useHelper(studioToken, nf, "Cloudflare");
  const [tok, setTok] = useState(""), [accounts, setAccounts] = useState<CfAccount[] | null>(null), [account, setAccount] = useState("");
  const [busy, setBusy] = useState(""), [err, setErr] = useState("");
  /** Set when this device has no token of its own and works through the Studio's database (see studioDbWay). */
  const [dbWay, setDbWay] = useState<{ api: string; scope: string; token: string } | null>(null);
  const viaDb = !!dbWay && isCfDbToken(tok);
  const NO_HELPER = { kind: "cloudflare", siteId: "", url: "", key: "", v: 0 } as Relay;
  // Other Cloudflare accounts (their own tokens), for sites hosted there.
  const [more, setMore] = useState<CfMoreToken[]>([]), [addOpen, setAddOpen] = useState(false), [addTok, setAddTok] = useState(""), [addBusy, setAddBusy] = useState(""), [addErr, setAddErr] = useState("");
  useEffect(() => {
    if (!persist) { setTok(""); setAccounts(null); setMore([]); return; }
    let offMem = () => {}, live = true;
    cfAccountVault.load(studioToken).then(async (v) => {
      // A Cloudflare sign-in made in this tab (never kept on the device) serves every box on the page.
      const mem = () => { if (cfMem.cur && !v?.token) { setTok(cfMem.cur.token); setAccounts(cfMem.cur.accounts); setAccount((a) => (cfMem.cur!.accounts.some((x) => x.id === a) ? a : v?.account && cfMem.cur!.accounts.some((x) => x.id === v.account) ? v.account : cfMem.cur!.accounts[0].id)); } };
      addEventListener("studio:cf-mem", mem); offMem = () => removeEventListener("studio:cf-mem", mem);
      if (v) { setTok(v.token || ""); if (v.account) setAccount(v.account); setMore(v.more || []); }
      mem();
      // No token of its own on this device: the Studio's database does the Cloudflare work, when this device is signed in to it.
      if (!v?.token && !cfMem.cur) {
        const way = await studioDbWay().catch(() => null);
        const list = way ? await new Cloudflare(null, way.token).accounts().catch(() => [] as CfAccount[]) : [];
        if (way && list.length && live) { setDbWay(way); setTok(way.token); setAccounts(list); setAccount((a) => (list.some((x) => x.id === a) ? a : v?.account && list.some((x) => x.id === v.account) ? v.account : list[0].id)); }
      }
    });
    // A kept Cloudflare sign-in is renewed while the tab stays open (loading it renews it when it is about to run out).
    const renew = setInterval(() => cfAccountVault.load(studioToken).then((v) => {
      if (!v) return;
      if (v.oauth && v.token) setTok((t) => (cfShortTokens.has(t) && t !== v.token ? v.token : t));
      if ((v.more || []).some((m) => m.oauth)) setMore((m) => (m.some((x) => x.oauth) ? v.more! : m));
    }).catch(() => {}), 60000);
    // Accounts added or removed in Settings in another tab show up here without reopening.
    const on = (e: StorageEvent) => { if (e.key === "site-studio:cfdb") cfAccountVault.load(studioToken).then((v) => setMore(v?.more || [])); };
    addEventListener("storage", on); return () => { live = false; removeEventListener("storage", on); offMem(); clearInterval(renew); };
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
  /** The connection box: open until connected (when one-click connect is set up), then folded; null = by itself. */
  const [boxOpen, setBoxOpen] = useState<boolean | null>(null);
  /** Keeps a long-lasting token for the allowed accounts on the Studio's database (a secret on the owner's own
   *  Cloudflare), for the accounts it doesn't hold one for yet. Nothing is written to this device but which accounts
   *  are kept. Returns what to tell the person. */
  const keepOnDb = async (relay: Relay, viaSignIn: Cloudflare, access: string, list: CfAccount[], deviceToken: string, tab: string): Promise<string> => {
    const v = await cfAccountVault.load(studioToken), setup = v?.setup;
    if (!setup) return `${tab} Your Studio has no database on Cloudflare yet; once it has one, press Connect Cloudflare again and its token is kept there for your other devices.`;
    const info = await cfDeployInfo(setup.api), known = new Set(v!.inDb || []);
    const need = list.filter((a) => (a.id === setup.account ? !(info.deploy && info.account === a.id) : !known.has(a.id)));
    if (!need.length) return `Its token is already kept on your Studio's database, so no new one was made. ${tab}`;
    // Writing to the database's Worker needs its own account: through this sign-in, else the token already on this device.
    const writer = list.some((a) => a.id === setup.account) ? viaSignIn : deviceToken ? new Cloudflare(relay, deviceToken) : null;
    const can = need.filter((a) => a.id === setup.account || !!writer);
    if (!can.length) return `${tab} To keep its token on your Studio's database, press Connect Cloudflare again and also tick the account the database is on.`;
    setOcBusy("Making the Studio's own token");
    const minted = await cfOauthMint(viaSignIn, can, async (t) => { try { return (await new Cloudflare(relay, t).accounts()).length > 0; } catch { return false; } });
    if (!minted) return `${tab} Cloudflare didn't let the Studio make a long-lasting token, so none was kept on the database. To publish from other devices, paste a token once below.`;
    const got = can.filter((a) => minted[a.id]);
    const main = got.find((a) => a.id === setup.account), others = got.filter((a) => a.id !== setup.account);
    if (main) {
      setOcBusy("Keeping it on your Studio's database");
      const next = await setupCfDb(relay, access, { account: main, resendKey: "", mailFrom: v!.mailFrom || "", name: brand().name, existing: setup, deployToken: minted[main.id], requireMail: false }, setOcBusy);
      const cur = await cfAccountVault.load(studioToken); await cfAccountVault.save({ ...(cur || { token: "" }), setup: next }, studioToken);
    }
    for (const a of others) await writer!.putSecret(setup.account, CFDB_WORKER, "CFX_" + a.id.replace(/-/g, "_"), JSON.stringify({ t: minted[a.id], n: a.name }));
    if (others.length) { const cur = await cfAccountVault.load(studioToken); await cfAccountVault.save({ ...(cur || { token: "" }), inDb: [...new Set([...(cur?.inDb || []), ...others.map((a) => a.id)])] }, studioToken); }
    return `The Studio made its own token for ${got.map((a) => a.name).join(", ")} and keeps it on your Studio's database (a secret on your own Cloudflare), so your other devices can publish too. ${tab}`;
  };
  const oauthConnect = async () => {
    setErr(""); setOcNote("");
    let flow: ReturnType<typeof cfOauthOpen>;
    try { flow = cfOauthOpen(oc); } catch (e: any) { setErr(e?.message || "Couldn't open Cloudflare."); return; }
    setOcFlow(flow); setOcBusy("Waiting for you to press Allow in the Cloudflare window (if you closed it, press Cancel)");
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
      if (mainAlive && !fresh.length) {
        if (!accounts) setAccounts(mainList);
        // Nothing to change on this device; the database is still given its own token when it has none.
        const where = persist ? await keepOnDb(relay, viaSignIn, got.access, list, v!.token, "This device was already connected, so nothing was changed here.") : "";
        setOcNote(`Already connected to ${list.map((a) => a.name).join(", ")}. ${where || "Your saved connection still works, so nothing was changed."}`); setOcBusy(""); return;
      }
      // The device stays connected: the sign-in is kept encrypted here with what renews it (as a pasted token is kept).
      // Without a way to renew it (Cloudflare gave none), it is used in this tab only and never written down.
      const stay = persist && !!got.refresh, oauth = stay ? { refresh: got.refresh, exp: got.exp, client: oc.client } : undefined;
      cfShortTokens.add(got.access); if (!stay) cfMemTokens.add(got.access);
      const names = fresh.map((a) => a.name).join(", ");
      if (!mainAlive) {
        const pick = list.some((x) => x.id === account) ? account : list[0].id;
        // Kept first, shown after. (A saved token Cloudflare now refuses is of no use: it goes, so the device doesn't keep trying it.)
        if (persist) { const cur = await cfAccountVault.load(studioToken); if (stay || cur?.token) await cfAccountVault.save({ ...(cur || {}), token: stay ? got.access : "", oauth, ...(stay ? { account: pick } : {}) }, studioToken); }
        setTok(got.access); setAccounts(list); setAccount(pick);
        if (persist) { cfMem.cur = { token: got.access, accounts: list }; dispatchEvent(new Event("studio:cf-mem")); }
      } else {
        const next = [...more.filter((m) => !m.accounts.every((a) => fresh.some((f) => f.id === a.id))), { token: got.access, accounts: fresh.map((a) => ({ id: a.id, name: a.name })), ...(oauth ? { oauth } : {}) }];
        if (stay) await saveMore(next); else setMore(next);
      }
      const where = persist ? await keepOnDb(relay, viaSignIn, got.access, list, mainAlive ? v!.token : "", stay ? "This device stays connected: the sign-in is kept encrypted here and renews itself." : "Cloudflare gave no way to renew this sign-in, so it works in this tab only and isn't kept.") : "Used now only, not kept.";
      setOcNote(`${mainAlive ? "Added" : "Connected to"} ${names}. ${where}${mainAlive ? " The account you were already connected to is unchanged." : ""}`);
    } catch (e: any) { setOcFlow(null); setErr(e?.message || "Couldn't connect Cloudflare."); }
    setOcBusy("");
  };
  const saveOc = () => { cfOauthCfg.set(ocEdit); const c = cfOauthCfg.get(); setOc(c); setOcEdit(c); };
  // Set it up for me: the Studio creates its own OAuth client with a token used now and not kept.
  const [suTok, setSuTok] = useState(""), [suBusy, setSuBusy] = useState(""), [suErr, setSuErr] = useState(""), [suNote, setSuNote] = useState(""), [suTxt, setSuTxt] = useState("");
  const [suAcc, setSuAcc] = useState(""), [suAsk, setSuAsk] = useState(false);
  const allKnown: { id: string; name: string }[] = [...(accounts || []), ...more.flatMap((m) => m.accounts)];
  const autoSetup = async () => {
    setSuErr(""); setSuNote(""); setSuTxt(""); setSuBusy("Checking the token");
    try {
      const relay = await helper.get(setSuBusy), cf = new Cloudflare(relay, suTok.trim());
      let list: CfAccount[];
      try { list = await cf.accounts(); } catch (e: any) { throw new Error(e instanceof CfError && (e.status === 401 || e.status === 403) ? "Cloudflare didn't accept that token. Copy it again from the page where you created it (it is shown only once)." : e?.message || "Couldn't reach Cloudflare."); }
      // A token with only the OAuth Client permission can't list accounts: then the account is the one the Studio
      // already uses on this device (its database's, else the connected one), or the ID typed below.
      if (!list.length) {
        const v = await cfAccountVault.load(studioToken), typed = suAcc.trim().toLowerCase();
        const id = /^[0-9a-f]{32}$/.test(typed) ? typed : v?.setup?.account || account || v?.account || "";
        if (!id) { setSuAsk(true); throw new Error("This token can't list your accounts, so the Studio doesn't know which one to use. Paste the Account ID below (Cloudflare shows it on the account's home page, and in the address bar after dash.cloudflare.com/), then press Set it up again."); }
        list = [{ id, name: allKnown.find((a) => a.id === id)?.name || "your Cloudflare account" }];
      }
      // The account the Studio already uses, when the token can see it; else the token's first.
      const where = list.find((a) => a.id === account) || list[0];
      setSuBusy(`Setting up on ${where.name}`);
      const r = await cfOauthSetup(cf, where);
      cfOauthCfg.set(r.cfg); const c = cfOauthCfg.get(); setOc(c); setOcEdit(c); setSuTok(""); setSuTxt(r.txt);
      setSuNote(`${r.made ? "Created" : "Found"} the Studio's OAuth client on ${where.name}, with exactly the permissions the Studio asks for. Press Connect Cloudflare.${r.left.length ? ` Cloudflare's list has no permission for ${r.left.join(", ")}, so ${r.left.some((x) => /API Tokens/.test(x)) ? "the Studio may not be able to make its own token for your other devices" : "some set-up steps may still need a pasted token"}.` : ""} The set-up token wasn't kept; you can delete it in Cloudflare now.${r.visibility !== "public" ? " The client is private: it works for members of that account. To let any Cloudflare login connect, open it in Cloudflare and choose Change Visibility." : ""}`);
    } catch (e: any) { setSuErr(e?.message || "Couldn't set it up."); }
    setSuBusy("");
  };
  const ocUi = (
    <div className="flex flex-col gap-2" aria-label="Connect Cloudflare">
      {oc.client ? <>
        <p><button type="button" className="btn btn-sm btn-pri" disabled={!!ocBusy || !helper.ready} onClick={oauthConnect}>{ocBusy ? "Connecting…" : "Connect Cloudflare"}</button> <span className="text-ink-400">A Cloudflare window opens: choose the account, press <b>Allow</b>, and you're back here. No token to create or paste. {persist ? "This device then stays connected (the sign-in is kept encrypted here and renews itself), and the token the Studio makes for your other devices is kept on your Studio's database." : "Used now only, not kept."}</span></p>
        {ocBusy && <p role="status" className="text-ink-300">{ocBusy}… {ocFlow && <button type="button" className="text-brand-300 underline" onClick={() => ocFlow.cancel()}>Cancel</button>}</p>}
      </> : <p className="text-ink-300"><b className="text-ink-100">Connect Cloudflare in one click.</b> Set it up once below, then no token needs creating or pasting.</p>}
      <details className="text-ink-400" open={!oc.client}>
        <summary className="cursor-pointer select-none">{oc.client ? "One-click connect settings" : "Set up one-click connect (once)"}</summary>
        <div className="mt-1.5 flex flex-col gap-2 rounded-lg border border-ink-700 p-2.5" aria-label="Set it up for me">
          <b className="text-ink-100">Let the Studio set it up</b>
          <span><a className="btn btn-sm" href={CF_OAUTH_SETUP_TOKEN_PAGE} target="_blank" rel="noopener noreferrer">Create a set-up token ↗</a> It needs <b>Account → OAuth Client → Edit</b> (tick it if the page doesn't already); <b>Account Settings → Read</b> as well lets the Studio find the account by itself. Press <b>Continue to summary → Create Token</b>, copy it and paste it here. The Studio uses it once to create its sign-in client and doesn't keep it.</span>
          <div className="flex gap-2">
            <input aria-label="Cloudflare set-up token" className="input min-w-0 flex-1 font-mono text-xs" type="password" autoComplete="off" value={suTok} onChange={(e) => setSuTok(e.target.value)} placeholder="Set-up token" />
            <button type="button" className="btn btn-sm btn-pri" disabled={!suTok.trim() || !!suBusy || !helper.ready} onClick={autoSetup}>{suBusy ? suBusy + "…" : "Set it up"}</button>
          </div>
          {suAsk && <label className="flex flex-col gap-1"><span className="label">Cloudflare account ID (32 letters and numbers; not a secret)</span><input aria-label="Cloudflare account ID" className="input font-mono text-xs" autoComplete="off" value={suAcc} onChange={(e) => setSuAcc(e.target.value)} placeholder="e.g. 0123456789abcdef0123456789abcdef" /></label>}
          {suErr && <p role="alert" className="text-red-300">{suErr}</p>}
        </div>
        <details className="mt-2" open={!oc.client} aria-label="Set up by hand">
        <summary className="cursor-pointer select-none font-semibold text-ink-300">{oc.client ? "The client the Studio uses (and setting it up by hand)" : "Or do it by hand"}</summary>
        <ol className="mt-1.5 list-decimal space-y-1 pl-5">
          <li>In Cloudflare open <a className="text-brand-300 underline" href="https://dash.cloudflare.com/?to=/:account/oauth-clients" target="_blank" rel="noopener noreferrer">Manage Account → OAuth clients ↗</a> and press <b>Create client</b>.</li>
          <li>Token authentication method: <b>None</b> (a browser app, no secret). Grant types: <b>Authorization code</b> and <b>Refresh token</b>.</li>
          <li>Redirect URL: <code className="select-all break-all font-mono text-xs text-ink-200">{cfOauthRedirect()}</code>. Allowed CORS origin: <code className="select-all font-mono text-xs text-ink-200">{location.origin}</code></li>
          <li>Permissions: tick the ones for Workers (write), D1 (write), Workers Routes (write), DNS (write), Zone (read), Account Settings (read) and User Details (read). If the list offers API Tokens (write), tick it too, so the Studio can make its own token for your other devices.</li>
          <li>Cloudflare shows each permission's short name on the client (like <code className="font-mono text-xs">d1.write</code>). The box below must hold exactly the names you ticked, with a space between them; Cloudflare refuses the sign-in if it asks for one the client doesn't have.</li>
          <li>Copy the <b>Client ID</b> (it isn't a secret) and paste it here.</li>
        </ol>
        <div className="mt-2 flex flex-col gap-2">
          <label className="flex flex-col gap-1"><span className="label">OAuth client ID</span><input aria-label="Cloudflare OAuth client ID" className="input font-mono text-xs" autoComplete="off" value={ocEdit.client} onChange={(e) => setOcEdit({ ...ocEdit, client: e.target.value })} placeholder="Client ID from Cloudflare" /></label>
          <label className="flex flex-col gap-1"><span className="label">Permissions to ask for (Cloudflare's scope names, as shown on the client)</span><input aria-label="Cloudflare OAuth permissions" className="input font-mono text-xs" autoComplete="off" value={ocEdit.scopes} onChange={(e) => setOcEdit({ ...ocEdit, scopes: e.target.value })} placeholder={CF_OAUTH_SCOPES} /></label>
          <div className="flex items-center gap-2"><button type="button" className="btn btn-sm" disabled={ocEdit.client.trim() === oc.client && ocEdit.scopes.trim() === oc.scopes} onClick={saveOc}>Save</button><span>Saved on this device. Until the client is made public in Cloudflare, it works for members of the account it was created in.</span></div>
        </div>
        </details>
      </details>
      {suNote && <p role="status" aria-label="Set-up result" className="text-emerald-300">{suNote}</p>}
      {suTxt && <p className="text-ink-300">For making it public later, Cloudflare checks your domain with this DNS TXT record: <code className="select-all break-all font-mono text-xs text-ink-200">{suTxt}</code></p>}
    </div>
  );
  useEffect(() => { if (persist && tok && !isCfDbToken(tok) && !accounts && !busy && helper.ready) connect(); }, [tok && persist, helper.ready]);
  const pickAccount = async (id: string) => { setAccount(id); if (persist) { const v = await cfAccountVault.load(studioToken); if (v) await cfAccountVault.save({ ...v, account: id }, studioToken); } };
  const acc = accounts?.find((a) => a.id === account) || null;
  /** Every Cloudflare account this device can manage: the main token's, then the other tokens'. */
  const allAccounts: { id: string; name: string; main: boolean }[] = [...(accounts || []).map((a) => ({ id: a.id, name: a.name, main: true }))];
  for (const m of more) for (const a of m.accounts) if (!allAccounts.some((x) => x.id === a.id)) allAccounts.push({ ...a, main: false });
  /** A client for a given account, with the token that can manage it. */
  const clientFor = async (id: string | undefined, step?: (s: string) => void): Promise<{ cf: Cloudflare; relay: Relay; account: CfAccount; token: string }> => {
    const other = id ? more.find((m) => m.accounts.some((a) => a.id === id)) : null;
    if (viaDb && id && (accounts || []).some((a) => a.id === id)) { const a = accounts!.find((x) => x.id === id)!, t = cfDbToken(dbWay!.api, dbWay!.scope, id); return { cf: new Cloudflare(null, t), relay: NO_HELPER, account: a, token: t }; }
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
    if (viaDb) { const t = cfDbToken(dbWay!.api, dbWay!.scope, acc.id); return { cf: new Cloudflare(null, t), relay: NO_HELPER, account: acc, token: t }; }
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
      {!viaDb && helper.ui}
      <details className="group rounded-lg border border-ink-700" aria-label="Cloudflare connection" open={boxOpen ?? (!acc || (!oc.client && !viaDb))} onToggle={(e) => { if (e.target !== e.currentTarget) return; const o = e.currentTarget.open; if (o !== (boxOpen ?? (!acc || (!oc.client && !viaDb)))) setBoxOpen(o); }}>
        <summary className="flex cursor-pointer select-none items-center gap-2 px-3 py-2"><span className={`h-2 w-2 rounded-full ${acc ? "bg-emerald-400" : "bg-ink-500"}`} /><b className="text-ink-100">Cloudflare connection</b><span className="text-ink-400">{acc ? (viaDb ? "connected through your Studio's database" : cfMemTokens.has(tok.trim()) ? "connected · this tab only" : "connected") : "not connected"}</span><span className="ml-auto text-[12.5px] text-brand-300 underline group-open:hidden">Change</span><span className="ml-auto hidden text-[12.5px] text-brand-300 underline group-open:inline">Hide</span></summary>
        <div className="flex flex-col gap-2.5 px-3 pb-3">
          {viaDb && <p className="text-ink-300">This device has no Cloudflare token of its own and needs none: you are signed in to your Studio's database, which keeps the token (as a secret on your own Cloudflare) and makes the Studio's Cloudflare calls for you. Connect here only to add another Cloudflare account.</p>}
          {ocUi}
          <details aria-label="Paste a token" open={!oc.client}>
            <summary className="cursor-pointer select-none text-ink-400">{oc.client ? "Paste a token instead" : "Paste a Cloudflare token"}</summary>
            <p className="mt-1.5 text-ink-400"><a className="text-brand-300 underline" href={CF_DB_TOKEN_PAGE} target="_blank" rel="noopener noreferrer">Create a Cloudflare token ↗</a> (permissions already ticked), then paste it here. {persist ? "Kept encrypted on this device only." : "Used now only, not kept."}</p>
            <div className="mt-1.5">
            <div className="flex gap-2">
        <input aria-label="Cloudflare API token" className="input min-w-0 flex-1 font-mono text-xs" type="password" autoComplete="off" value={isCfDbToken(tok) ? "" : tok} onChange={(e) => { setTok(e.target.value); setAccounts(null); }} placeholder="Cloudflare API token" />
        <button type="button" className="btn btn-sm" disabled={!tok.trim() || isCfDbToken(tok) || !!busy || !helper.ready} onClick={connect}>{busy && !accounts ? busy + "…" : "Connect"}</button>
            </div>
            </div>
          </details>
        </div>
      </details>
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
        {acc && !manage && <p className="text-emerald-300">Connected to {acc.name}.</p>}
      </>}
      {ocNote && <p role="status" aria-label="Connect Cloudflare result" className="text-emerald-300">{ocNote}</p>}
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
  return { ui, othersUi: others, ready: !!acc && (helper.ready || viaDb), /** Working through the Studio's database: no token or helper on this device. */ viaDb, account: acc, token: tok.trim(), client, clientFor, allAccounts, busy, helper, replaceToken, /** What Connect Cloudflare last said. */ note: ocNote, /** Connected by a Cloudflare sign-in used in this tab only (nothing on the device). */ tabOnly: cfMemTokens.has(tok.trim()) };
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
