// Settings → Hostings → Hosting accounts: the Studio's helper (on Cloudflare or Netlify), the Cloudflare account used for
// hosting pages, the database and Workers, and the shop's Cloudflare token, as kept on this device.
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type { Session } from "../lib/auth";
import { cfVault, Cloudflare as CloudflareApi } from "../lib/cloudflare";
import { cfAccountVault, cfShortTokens } from "../lib/cfdb";
import { cfOauthMint } from "../lib/cfoauth";
import { netlifyToken } from "../lib/hosting";
import { Netlify } from "../lib/netlify";
import { HelperStatus } from "./HelperBox";
import { useCfAccount, type CfAccountHook } from "./CfPicker";
import { CFDB_WORKER, cfDeployInfo, registerRepos, registerWorkers, setupCfDb, type CfDbSetup } from "../lib/cfdb";
import type { Cloudflare } from "../lib/cloudflare";
import type { StudioIndex } from "../lib/studio";
import { brand } from "../lib/brand";
import { useToast } from "../ui/kit";
import { ghPublish } from "../lib/ghpublish";
import { isHosted } from "../lib/backend";

/** One hosting account in Settings → Hostings: a heading that folds its box away. What is open is remembered on this device. */
export function HostFold({ id, title, open: byDefault, children }: { id: string; title: string; open?: boolean; children: ReactNode }) {
  const KEY = "studio-hostacc-open";
  const [open, setOpen] = useState(() => { try { const v = localStorage.getItem(KEY); if (v === "all") return true; const j = JSON.parse(v || "{}"); return id in j ? !!j[id] : !!byDefault; } catch { return !!byDefault; } });
  return (
    <details className="group rounded-lg border border-ink-700" data-fold={id} open={open} onToggle={(e) => {
      if (e.target !== e.currentTarget) return;
      const o = e.currentTarget.open; if (o === open) return; setOpen(o);
      try { const v = localStorage.getItem(KEY), j = v && v !== "all" ? JSON.parse(v) : {}; j[id] = o; localStorage.setItem(KEY, JSON.stringify(j)); } catch { /* private mode */ }
    }}>
      <summary className="flex cursor-pointer select-none items-center gap-2 px-3 py-2.5"><h3 className="text-sm font-bold">{title}</h3><span className="ml-auto text-[12.5px] text-brand-300 underline group-open:hidden">Show</span><span className="ml-auto hidden text-[12.5px] text-brand-300 underline group-open:inline">Hide</span></summary>
      <div className="flex flex-col gap-3 px-3 pb-3 text-sm">{children}</div>
    </details>
  );
}

export function SetupAccounts({ session, index }: { session: Session; index?: StudioIndex }) {
  const [nf, setNf] = useState<Netlify | null | undefined>(undefined);
  const [shop, setShop] = useState<boolean | undefined>(undefined);
  useEffect(() => { netlifyToken.load(session.token).then((t) => setNf(t ? new Netlify(t.token) : null)); cfVault.load(session.token).then((v) => setShop(!!v?.token)); }, [session.token]);
  if (nf === undefined || shop === undefined) return null;
  return (
    <div className="flex flex-col gap-3 text-sm">
      <HostFold id="helper" title="Studio helper"><HelperStatus studioToken={session.token} nf={nf} /></HostFold>
      <HostFold id="cloudflare" title="Cloudflare (hosting, database and Workers)" open>
        <CloudflareAccount session={session} nf={nf} index={index} />
        {shop && <div className="flex flex-wrap items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400" /><span>Shop backend's Cloudflare token saved on this device</span>
          <button type="button" className="btn btn-sm ml-auto" onClick={() => { cfVault.clear(); setShop(false); }}>Disconnect</button>
        </div>}
      </HostFold>
    </div>
  );
}

function CloudflareAccount({ session, nf, index }: { session: Session; nf: Netlify | null; index?: StudioIndex }) {
  const acc = useCfAccount(session.token, nf, true, true);
  return (
    <div className="flex flex-col gap-2">
      {acc.account && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400" /><span>Cloudflare: <b>{acc.account.name}</b></span>
          <button type="button" className="btn btn-sm ml-auto" onClick={() => { if (!acc.tabOnly) cfAccountVault.clear(); location.reload(); }} title={acc.tabOnly ? "Ends the sign-in in this tab." : "Forget the token on this device (the database's setup is forgotten too; running a setup again finds it)."}>Disconnect</button>
          <p className="w-full pl-4 text-[12.5px] text-ink-400">{acc.tabOnly ? "Signed in on Cloudflare for this tab only: nothing is kept on this device. It lets the Studio publish sites, run the database and connect domains until you close or reload this tab." : "The permission: your API token or Cloudflare sign-in, kept encrypted on this device only. It goes with each request through the helper and lets the Studio publish sites, run the database and connect domains."}</p>
        </div>
      )}
      {/* The same connection section as in Publish to Cloudflare: folded once connected, with the other accounts under it. */}
      {acc.ui}
      {index && <AnyDevice session={session} acc={acc} index={index} />}
    </div>
  );
}

/** Publish from any device: the database Worker keeps the Cloudflare token (as a secret on your account), so any
 *  device signed in to it as a site's owner can publish and push updates to that site, with no token there. */
function AnyDevice({ session, acc, index }: { session: Session; acc: CfAccountHook; index: StudioIndex }) {
  const toast = useToast();
  const [api, setApi] = useState<string | null>(null), [on, setOn] = useState<boolean | null>(null), [gh, setGh] = useState(false), [busy, setBusy] = useState(""), [err, setErr] = useState("");
  const [others, setOthers] = useState(0), [kept, setKept] = useState(0);
  // GitHub Pages sites: the Studio that signs in by email (this one, or where this Studio was moved) uses the kept token.
  const ghToken = ghPublish.token(session.token);
  const emailStudio = isHosted(session) ? session.cfg.repo : index.hosted?.backend === "cloudflare" ? index.hosted.studio : "";
  const ghProjects = index.projects.filter((p) => p.publish);
  const cfProjects = index.projects.filter((p) => p.host?.kind === "cloudflare" && p.host.cf);
  const studioApp = index.hosted?.pages === "cloudflare" && index.hosted.backend === "cloudflare" && index.hosted.siteId ? index.hosted : null;
  useEffect(() => {
    (async () => {
      const v = await cfAccountVault.load(session.token);
      const a = v?.setup?.api || cfProjects[0]?.host?.cf?.api || studioApp?.api || null;
      setApi(a); const i = a ? await cfDeployInfo(a) : null; setOn(i ? i.deploy : false); setGh(!!i?.gh); setKept(i?.more || 0);
      setOthers(new Set((v?.more || []).flatMap((m) => m.accounts.map((x) => x.id)).filter((id) => id !== v?.setup?.account)).size);
    })();
  }, [session.token, acc.account?.id]);
  const register = async (cf: Cloudflare, setup: CfDbSetup) => registerWorkers(cf, setup, [
    ...cfProjects.map((p) => ({ worker: p.host!.siteId, scope: "site:" + p.host!.cf!.site })),
    ...(studioApp ? [{ worker: studioApp.siteId, scope: "studio:" + studioApp.studio }] : []),
    // Client Studios on this Cloudflare (Studio Partners): their apps, for updating them from any device.
    ...(index.partners || []).filter((p) => p.pages === "cloudflare" && p.backend === "cloudflare" && p.siteId).map((p) => ({ worker: p.siteId!, scope: "studio:" + p.studio })),
  ]);
  /** Other Cloudflare accounts (their own tokens on this device): kept on the database as CFX_<account> secrets, and
   *  their sites registered to this Studio, so any device signed in to the Studio can publish them. */
  const keepOthers = async (cf: Cloudflare, setup: CfDbSetup) => {
    const v = await cfAccountVault.load(session.token), more = v?.more || [];
    for (const m of more) for (const a of m.accounts) {
      if (a.id === setup.account || cfShortTokens.has(m.token)) continue;
      await cf.putSecret(setup.account, CFDB_WORKER, "CFX_" + a.id.replace(/-/g, "_"), JSON.stringify({ t: m.token, n: a.name }));
    }
    const ids = new Set(more.flatMap((m) => m.accounts.map((a) => a.id)));
    const sites = index.projects.filter((p) => p.host?.kind === "cloudflare" && p.host.account && ids.has(p.host.account) && p.host.account !== setup.account);
    await registerWorkers(cf, setup, sites.flatMap((p) => [
      ...(emailStudio ? [{ worker: `${p.host!.account}/${p.host!.siteId}@studio:${emailStudio}`, scope: "studio:" + emailStudio }] : []),
      // A site whose content is in this database: its owners can publish it too.
      ...(p.host!.cf && p.host!.cf.api === setup.api ? [{ worker: `${p.host!.account}/${p.host!.siteId}@site:${p.host!.cf.site}`, scope: "site:" + p.host!.cf.site }] : []),
    ]));
  };
  /** Keeps the GitHub token on the database and registers the GitHub sites for the Studio that signs in by email. */
  const addGitHub = async () => {
    setErr(""); setBusy("Keeping the GitHub token");
    try {
      const v = await cfAccountVault.load(session.token); if (!v?.setup) throw new Error("Press Turn on first.");
      const { cf } = await acc.client((x) => setBusy(x));
      await cf.putSecret(v.setup.account, CFDB_WORKER, "GH_TOKEN", ghToken);
      await registerRepos(cf, v.setup, ghProjects.map((p) => ({ repo: `${p.publish!.owner}/${p.publish!.repo}`, scope: "studio:" + emailStudio })));
      setGh((await cfDeployInfo(v.setup.api)).gh || false); toast("GitHub sites included.");
    } catch (e: any) { setErr(e?.message || "Couldn't include the GitHub sites."); }
    setBusy("");
  };
  const turn = (enable: boolean) => async () => {
    setErr(""); setBusy(enable ? "Turning on" : "Turning off");
    try {
      const v = await cfAccountVault.load(session.token);
      const { cf, relay, account, token } = await acc.client((x) => setBusy(x));
      if (enable) {
        // Finds the Studio's database on this account (or creates it), keeping its sign-ins and email settings.
        // A Cloudflare sign-in's token runs out within hours, so the database is given a long-lasting one made for it.
        let dep = token;
        if (cfShortTokens.has(token)) {
          setBusy("Making the Studio's own token");
          const m = await cfOauthMint(cf, [account], async (t) => { try { return (await new CloudflareApi(relay, t).accounts()).length > 0; } catch { return false; } });
          if (!m?.[account.id]) throw new Error("Cloudflare didn't let the Studio make a long-lasting token from your sign-in, and the database needs one to publish from other devices. Open Cloudflare connection → Paste a token instead, paste a token once, then press Turn on.");
          dep = m[account.id];
        }
        const setup = await setupCfDb(relay, token, { account, resendKey: "", mailFrom: v?.mailFrom || "", name: brand().name, existing: v?.setup && v.setup.account === account.id ? v.setup : null, deployToken: dep, requireMail: false }, (x) => setBusy(x));
        await cfAccountVault.save({ ...(v || {}), token, account: account.id, setup }, session.token);
        setBusy("Letting your sites be published from any device"); await register(cf, setup);
        if ((v?.more || []).length) { setBusy("Keeping your other Cloudflare accounts for all devices"); await keepOthers(cf, setup); }
        if (ghToken && emailStudio && ghProjects.length) {
          setBusy("Keeping the GitHub token for your GitHub sites");
          await cf.putSecret(setup.account, CFDB_WORKER, "GH_TOKEN", ghToken);
          await registerRepos(cf, setup, ghProjects.map((p) => ({ repo: `${p.publish!.owner}/${p.publish!.repo}`, scope: "studio:" + emailStudio })));
        }
        setApi(setup.api);
        toast("On. Any device signed in to your Cloudflare database as a site's owner can now publish and push updates to it.");
      } else {
        await cf.deleteSecret(account.id, CFDB_WORKER, "CF_TOKEN");
        for (const m of v?.more || []) for (const a of m.accounts) await cf.deleteSecret(account.id, CFDB_WORKER, "CFX_" + a.id.replace(/-/g, "_")).catch(() => null);
        await cf.deleteSecret(account.id, CFDB_WORKER, "GH_TOKEN").catch(() => null);
        toast("Off. Only devices with the Cloudflare token can publish now.");
      }
      const i = await cfDeployInfo((await cfAccountVault.load(session.token))?.setup?.api || api!); setOn(i.deploy); setGh(!!i.gh); setKept(i.more || 0);
    } catch (e: any) { setErr(e?.message || "Something went wrong."); }
    setBusy("");
  };
  if (on === null && api) return null;
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-ink-700 p-3" aria-label="Publish from any device">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${on ? "bg-emerald-400" : "bg-ink-500"}`} />
        <b className="text-ink-100">Publish from any device</b><span className="text-ink-400">{on ? "on" : "off"}</span>
        {acc.account && <button type="button" className={`btn btn-sm ml-auto ${on ? "" : "btn-pri"}`} disabled={!!busy} onClick={turn(!on)}>{busy ? busy + "…" : on ? "Turn off" : "Turn on"}</button>}
      </div>
      <p className="text-[12.5px] text-ink-400">{on
        ? "Your database Worker keeps the Cloudflare token as a secret on your account. Any device where you've signed in with your email code can publish and push updates to your Cloudflare sites (only the sites that email can edit), with no token on that device. Domains and new sites still need the token."
        : acc.account
          ? "Turn on to let any device where you've signed in with your email code publish and push updates to your Cloudflare sites. The token is stored once as a secret on your own database Worker, never in the Studio's data or on GitHub."
          : "Off. To turn it on, connect Cloudflare on this device (just above), then press Turn on: the Studio finds or sets up its database by itself."}</p>
      {on && acc.account && <button type="button" className="self-start text-[12.5px] text-brand-300 underline" disabled={!!busy} onClick={async () => { setBusy("Registering"); try { const v = await cfAccountVault.load(session.token); if (v?.setup) { await register((await acc.client()).cf, v.setup); toast("Sites registered."); } } catch (e: any) { setErr(e?.message || "Couldn't register."); } setBusy(""); }}>Include sites published since</button>}
      {on && acc.account && others > 0 && <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-400" aria-label="Other accounts on all devices">
        <span>Other Cloudflare accounts ({others}): {kept >= others ? "kept here too, so any signed-in device can publish their sites." : "only on this device so far."}</span>
        <button type="button" className={`btn btn-sm ${kept >= others ? "" : "btn-pri"}`} disabled={!!busy} onClick={turn(true)}>{kept >= others ? "Update" : "Keep them for all devices"}</button>
      </div>}
      {on && acc.account && emailStudio && ghProjects.length > 0 && ghToken && <button type="button" className="btn btn-sm self-start" disabled={!!busy} onClick={addGitHub}>{gh ? "Update GitHub sites (token and list)" : "Include GitHub sites"}</button>}
      {emailStudio && ghProjects.length > 0 && <p className="text-[12.5px] text-ink-400">GitHub Pages sites ({ghProjects.length}): {gh ? "on, so the Studio that signs in by email checks, publishes and pushes updates to them with the kept GitHub token." : ghToken ? "turned on with the same button (the GitHub token on this device is kept as a secret too)." : "add a GitHub token in GitHub (publishing) above, then press Turn on (or Turn off and on again) to include them."}</p>}
      {err && <p role="alert" className="text-[12.5px] text-red-300">{err}</p>}
    </div>
  );
}
