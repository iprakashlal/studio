// Settings → Hosting accounts: the Studio's helper (on Cloudflare or Netlify), the Cloudflare account used for
// hosting pages, the database and Workers, and the shop's Cloudflare token, as kept on this device.
import { useEffect, useState } from "react";
import type { Session } from "../lib/auth";
import { cfVault } from "../lib/cloudflare";
import { cfAccountVault } from "../lib/cfdb";
import { netlifyToken } from "../lib/hosting";
import { Netlify } from "../lib/netlify";
import { HelperStatus } from "./HelperBox";
import { useCfAccount, type CfAccountHook } from "./CfPicker";
import { CFDB_WORKER, cfDeployInfo, registerWorkers, setupCfDb, type CfDbSetup } from "../lib/cfdb";
import type { Cloudflare } from "../lib/cloudflare";
import type { StudioIndex } from "../lib/studio";
import { brand } from "../lib/brand";
import { useToast } from "../ui/kit";

export function SetupAccounts({ session, index }: { session: Session; index?: StudioIndex }) {
  const [nf, setNf] = useState<Netlify | null | undefined>(undefined);
  const [shop, setShop] = useState<boolean | undefined>(undefined);
  useEffect(() => { netlifyToken.load(session.token).then((t) => setNf(t ? new Netlify(t.token) : null)); cfVault.load(session.token).then((v) => setShop(!!v?.token)); }, [session.token]);
  if (nf === undefined || shop === undefined) return null;
  return (
    <div className="flex flex-col gap-3 text-sm">
      <h3 className="mt-2 text-sm font-bold">Studio helper</h3>
      <HelperStatus studioToken={session.token} nf={nf} />
      <h3 className="mt-2 text-sm font-bold">Cloudflare (hosting, database and Workers)</h3>
      <CloudflareAccount session={session} nf={nf} index={index} />
      {shop && <div className="flex flex-wrap items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-emerald-400" /><span>Shop backend's Cloudflare token saved on this device</span>
        <button type="button" className="btn btn-sm ml-auto" onClick={() => { cfVault.clear(); setShop(false); }}>Disconnect</button>
      </div>}
    </div>
  );
}

function CloudflareAccount({ session, nf, index }: { session: Session; nf: Netlify | null; index?: StudioIndex }) {
  const acc = useCfAccount(session.token, nf, true);
  return (
    <div className="flex flex-col gap-2">
      {acc.account ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400" /><span>Cloudflare: <b>{acc.account.name}</b></span>
          <button type="button" className="btn btn-sm ml-auto" onClick={() => { cfAccountVault.clear(); location.reload(); }} title="Forget the token on this device (the database's setup is forgotten too; running a setup again finds it).">Disconnect</button>
          <p className="w-full pl-4 text-[12.5px] text-ink-400">The permission: your API token, kept encrypted on this device only. It goes with each request through the helper and lets the Studio publish sites, run the database and connect domains.</p>
        </div>
      ) : acc.ui}
      {index && <AnyDevice session={session} acc={acc} index={index} />}
    </div>
  );
}

/** Publish from any device: the database Worker keeps the Cloudflare token (as a secret on your account), so any
 *  device signed in to it as a site's owner can publish and push updates to that site, with no token there. */
function AnyDevice({ session, acc, index }: { session: Session; acc: CfAccountHook; index: StudioIndex }) {
  const toast = useToast();
  const [api, setApi] = useState<string | null>(null), [on, setOn] = useState<boolean | null>(null), [busy, setBusy] = useState(""), [err, setErr] = useState("");
  const cfProjects = index.projects.filter((p) => p.host?.kind === "cloudflare" && p.host.cf);
  const studioApp = index.hosted?.pages === "cloudflare" && index.hosted.backend === "cloudflare" && index.hosted.siteId ? index.hosted : null;
  useEffect(() => {
    (async () => {
      const v = await cfAccountVault.load(session.token);
      const a = v?.setup?.api || cfProjects[0]?.host?.cf?.api || studioApp?.api || null;
      setApi(a); setOn(a ? (await cfDeployInfo(a)).deploy : false);
    })();
  }, [session.token, acc.account?.id]);
  const register = async (cf: Cloudflare, setup: CfDbSetup) => registerWorkers(cf, setup, [
    ...cfProjects.map((p) => ({ worker: p.host!.siteId, scope: "site:" + p.host!.cf!.site })),
    ...(studioApp ? [{ worker: studioApp.siteId, scope: "studio:" + studioApp.studio }] : []),
    // Client Studios on this Cloudflare (Studio Partners): their apps, for updating them from any device.
    ...(index.partners || []).filter((p) => p.pages === "cloudflare" && p.backend === "cloudflare" && p.siteId).map((p) => ({ worker: p.siteId!, scope: "studio:" + p.studio })),
  ]);
  const turn = (enable: boolean) => async () => {
    setErr(""); setBusy(enable ? "Turning on" : "Turning off");
    try {
      const v = await cfAccountVault.load(session.token);
      const { cf, relay, account, token } = await acc.client((x) => setBusy(x));
      if (enable) {
        // Finds the Studio's database on this account (or creates it), keeping its sign-ins and email settings.
        const setup = await setupCfDb(relay, token, { account, resendKey: "", mailFrom: v?.mailFrom || "", name: brand().name, existing: v?.setup && v.setup.account === account.id ? v.setup : null, deployToken: token, requireMail: false }, (x) => setBusy(x));
        await cfAccountVault.save({ ...(v || {}), token, account: account.id, setup }, session.token);
        setBusy("Letting your sites be published from any device"); await register(cf, setup);
        setApi(setup.api);
        toast("On. Any device signed in to your Cloudflare database as a site's owner can now publish and push updates to it.");
      } else {
        await cf.deleteSecret(account.id, CFDB_WORKER, "CF_TOKEN");
        toast("Off. Only devices with the Cloudflare token can publish now.");
      }
      setOn((await cfDeployInfo((await cfAccountVault.load(session.token))?.setup?.api || api!)).deploy);
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
      {err && <p role="alert" className="text-[12.5px] text-red-300">{err}</p>}
    </div>
  );
}
