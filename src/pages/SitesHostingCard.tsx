// Settings → Hostings → Sites and hosting accounts: one place for every live site's hosting. The Cloudflare accounts are kept on
// the Studio's database (tokens as Worker secrets on your own Cloudflare, never read back), and each site's choice is
// saved with the project, so every device signed in to the Studio sees and uses the same setup.
import { CFDB_VERSION } from "../lib/cfdbSchema";
import { useEffect, useMemo, useState } from "react";
import type { Session } from "../lib/auth";
import type { ProjectMeta, Studio, StudioIndex } from "../lib/studio";
import { CFDB_WORKER, CF_DB_TOKEN_PAGE, setupCfDb, cfAccountVault, cfDeployInfo, cfSignedIn, cfxDelete, cfxList, cfxPut, cfxSite, siteMembers } from "../lib/cfdb";
import { loadHostConfig } from "../lib/studiohost";
import { pagesForHost, PAGES_LABEL } from "../lib/pages";
import { liveTargets, pushTarget } from "../lib/pushupdates";
import { siteAddress } from "../lib/hosting";
import { explain } from "../lib/repo";
import { Cloudflare } from "../lib/cloudflare";
import { getHelper } from "../lib/relay";
import { useConfirm, useToast, Skel, SkelRows } from "../ui/kit";
import { projectPlan, teardownProject } from "../lib/teardown";
import { TeardownDialog } from "./TeardownDialog";
import { useCfAccount } from "./CfPicker";
import { SiteMailSetting } from "./Connections";
import { CfDomainCard } from "./HostDialog";
import type { HostCfg } from "../lib/supa";
import { Netlify } from "../lib/netlify";
import { RESEND_KEYS_PAGE } from "../lib/resend";
import { netlifyToken } from "../lib/hosting";

type Acc = { id: string; name: string };

export function SitesHostingCard({ session, studio, index, onIndex }: { session: Session; studio: Studio; index: StudioIndex; onIndex: (i: StudioIndex) => void }) {
  const toast = useToast(), confirm = useConfirm();
  const sites = useMemo(() => index.projects.filter((p) => p.host || p.publish), [index.projects]);
  const [db, setDb] = useState<{ api: string; studio: string } | null | undefined>(undefined);
  // Each site is one line until it is opened. Which ones are open ("all", or their ids) is remembered on this device.
  const [openSites, setOpenSites] = useState<string>(() => { try { return localStorage.getItem("studio-sites-open") || ""; } catch { return ""; } });
  const isOpen = (id: string) => openSites === "all" || openSites.split(",").includes(id);
  const keepOpen = (v: string) => { setOpenSites(v); try { localStorage.setItem("studio-sites-open", v); } catch { /* private window */ } };
  const toggleSite = (id: string, all: string[]) => { const cur = openSites === "all" ? all : openSites.split(",").filter(Boolean); keepOpen((cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]).join(",")); };
  const [info, setInfo] = useState<{ /** The database runs this build's version. */ cur: boolean; cfx: boolean; imp: boolean; pages: boolean; del: boolean; mail: boolean; /** The database has a Resend key and sender (sign-in codes can be sent). */ resend: boolean; main: string | null; accounts: Acc[]; signed: boolean; gh: boolean; workers: string[] | null } | null>(null);
  const [mainName, setMainName] = useState("");
  /** Databases that sites keep on their own Cloudflare accounts (not the Studio's database): each is updated by itself. */
  const [siteDbs, setSiteDbs] = useState<{ api: string; account: string; cur: boolean; sites: string[] }[]>([]);
  const loadSiteDbs = async (studioApi: string, justUpdated = "") => {
    const by = new Map<string, { account: string; sites: string[] }>();
    for (const p of index.projects) { const a = p.host?.cf?.api?.replace(/\/+$/, ""); if (!a || a === studioApi.replace(/\/+$/, "")) continue; const e = by.get(a) || { account: p.host?.account || "", sites: [] }; e.sites.push(p.name); if (!e.account && p.host?.account) e.account = p.host.account; by.set(a, e); }
    setSiteDbs(await Promise.all([...by].map(async ([api, e]) => ({ api, account: e.account, sites: e.sites, cur: api === justUpdated || ((await cfDeployInfo(api)).v || 0) >= CFDB_VERSION }))));
  };
  const [busy, setBusy] = useState(""), [err, setErr] = useState("");
  const [mailKey, setMailKey] = useState(""), [mailFrom, setMailFrom] = useState("");
  useEffect(() => { cfAccountVault.load(session.token).then((v) => { if (v?.mailFrom) setMailFrom((x) => x || v.mailFrom!); }).catch(() => {}); }, [session.token]);
  const [tear, setTear] = useState<ProjectMeta | null>(null);
  const [addTok, setAddTok] = useState(""), [replaceFor, setReplaceFor] = useState<string | null>(null);
  const [pick, setPick] = useState<Record<string, string>>({});
  /** Each list of sites (On Cloudflare, On Netlify, On GitHub Pages): what is searched for, and the page shown. */
  const [find, setFind] = useState<Record<string, string>>({}), [pageOf, setPageOf] = useState<Record<string, number>>({});
  const PER = 5;

  const load = async () => {
    const hc = await loadHostConfig().catch(() => null), v = await cfAccountVault.load(session.token).catch(() => null);
    const api = hc?.kind === "cloudflare" ? hc.api : v?.setup?.api || "";
    const sid = hc?.kind === "cloudflare" ? hc.studio : session.cfg.owner === "cloudflare" ? session.cfg.repo : "";
    loadSiteDbs(api).catch(() => {});
    if (!api || !sid) { setDb(null); return; }
    setDb({ api, studio: sid });
    const d = await cfDeployInfo(api), signed = !!(await cfSignedIn(api));
    const l = signed && d.cfx ? await cfxList(api, sid).catch(() => null) : null;
    setInfo({ cur: (d.v || 0) >= CFDB_VERSION, cfx: !!d.cfx, imp: !!d.bridge, pages: !!d.studioPages, del: !!d.del, mail: !!d.enqMail, resend: !!d.mail, main: l?.main ?? (d.deploy ? d.account || null : null), accounts: l?.accounts || [], signed, gh: !!d.gh, workers: l?.workers || null });
    if (v?.account && v.account === (l?.main ?? d.account)) {
      // The main account's name, from this device's token (only shown here).
      try { const acc = await new Cloudflare(await getHelper(session.token, null), v.token).accounts(); setMainName(acc.find((a) => a.id === v.account)?.name || ""); } catch { /* name stays generic */ }
    }
  };
  useEffect(() => { load(); }, [session.token]);

  const run = async (k: string, f: () => Promise<void>) => { setErr(""); setBusy(k); try { await f(); } catch (e: any) { setErr(e?.message || explain(e)); } setBusy(""); };
  const accounts: Acc[] = [...(info?.main ? [{ id: info.main, name: mainName || "The Studio's own Cloudflare account" }] : []), ...(info?.accounts || [])];
  const nameOf = (id?: string) => accounts.find((a) => a.id === id)?.name || (id ? "Another Cloudflare account" : "—");
  const everyDevice = (p: ProjectMeta) => {
    const h = p.host; if (!h) return !!p.publish && !!info?.gh;
    if (h.kind !== "cloudflare") return false;
    if (!h.account || !accounts.some((a) => a.id === h.account)) return false;
    // The database's own list of sites it may publish (older databases don't send it: the kept account decides).
    // (A main-account site with its content here is listed under the site itself, so the kept account decides.)
    if (!info?.workers || (h.account === info.main && h.cf && db && h.cf.api.replace(/\/+$/, "") === db.api.replace(/\/+$/, ""))) return true;
    return info.workers.includes(h.account === info.main ? h.siteId : h.account + "/" + h.siteId);
  };

  /** Lets every device publish each site on a kept account (idempotent; done when an account is added or the list loads). */
  const registerAll = async () => {
    if (!db) return;
    const l = await cfxList(db.api, db.studio).catch(() => null); if (!l) return;
    const kept = new Set([...(l.main ? [l.main] : []), ...l.accounts.map((a) => a.id)]);
    for (const p of sites) { const h = p.host; if (h?.kind === "cloudflare" && h.account && kept.has(h.account)) await cfxSite(db.api, db.studio, h.account, h.siteId, h.cf && h.cf.api.replace(/\/+$/, "") === db.api.replace(/\/+$/, "") ? h.cf.site : undefined).catch(() => null); }
  };
  // Every site on a kept account is allowed for every device by itself; the status below comes back from the database.
  useEffect(() => {
    if (!info?.imp || !info.signed || !db) return;
    let on = true;
    registerAll().then(async () => { const l = await cfxList(db.api, db.studio).catch(() => null); if (on && l?.workers) setInfo((i) => (i ? { ...i, workers: l.workers! } : i)); });
    return () => { on = false; };
  }, [info?.imp, info?.signed, sites.length, info?.accounts.length]);
  // An account connected under Hosting accounts on this page is kept on the database too, so it shows here by itself.
  useEffect(() => {
    const on = (e: Event) => { const t = String((e as CustomEvent).detail || ""); if (t && db && info?.signed && info.main) keep(t); };
    addEventListener("studio:cf-account-added", on); return () => removeEventListener("studio:cf-account-added", on);
  }, [db?.api, info?.signed, info?.main]);
  /** Keeps an account's token on the database: through the database itself, else with this device's main token. */
  const keep = (token: string) => run("keep", async () => {
    if (!db) return;
    try { const r = await cfxPut(db.api, db.studio, token.trim()); toast(`Kept on your Studio's database: ${r.accounts.map((a) => a.name).join(", ")}.`); }
    catch (e: any) {
      if (e?.status !== 409) throw e;
      const v = await cfAccountVault.load(session.token);
      if (!v?.token || !v.setup || v.setup.api !== db.api) throw new Error("Turn on Publish from any device (above), or connect the Studio's Cloudflare token on this device, then try again.");
      const relay = await getHelper(session.token, null), list = await new Cloudflare(relay, token.trim()).accounts(), main = new Cloudflare(relay, v.token);
      const others = list.filter((a) => a.id !== v.setup!.account); if (!others.length) throw new Error("That token is for the Studio's own Cloudflare account, which is already used.");
      for (const a of others) await main.putSecret(v.setup.account, CFDB_WORKER, "CFX_" + a.id.replace(/-/g, "_"), JSON.stringify({ t: token.trim(), n: a.name }));
      toast(`Kept on your Studio's database: ${others.map((a) => a.name).join(", ")}.`);
    }
    await registerAll();
    setAddTok(""); setReplaceFor(null); await load();
  });
  const forget = (a: Acc) => run("forget:" + a.id, async () => {
    const used = sites.filter((p) => p.host?.kind === "cloudflare" && p.host.account === a.id);
    if (!(await confirm(`Remove ${a.name}?`, used.length ? `${used.map((p) => p.name).join(", ")} ${used.length === 1 ? "is" : "are"} on it: only devices with its token could publish ${used.length === 1 ? "it" : "them"} afterwards.` : "Its token is deleted from your Studio's database.", "Remove"))) return;
    await cfxDelete(db!.api, db!.studio, a.id); toast(`${a.name} removed.`); await load();
  });

  /** Saves a site's Cloudflare account and publishes it there (its pages move to that account). */
  const siteIn = (h: NonNullable<ProjectMeta["host"]>) => (h.cf && db && h.cf.api.replace(/\/+$/, "") === db.api.replace(/\/+$/, "") ? h.cf.site : undefined);
  const moveSite = (p: ProjectMeta, account: string) => run("site:" + p.id, async () => {
    const h = p.host!; if (h.kind !== "cloudflare" || !db) return;
    const changing = account !== h.account;
    if (changing && !(await confirm(`Publish ${p.name} on ${nameOf(account)}?`, `Its pages are put on that account now.${h.domain ? ` Its domain ${h.domain} stays on the old account: connect it again from Publish to Cloudflare once the domain is on ${nameOf(account)}.` : ""} The content and editors stay in the database.`, "Publish there"))) return;
    await cfxSite(db.api, db.studio, account, h.siteId, siteIn(h)).catch(() => null);
    let next = { ...h, account };
    if (changing) {
      const pages = await pagesForHost(next, session.token);
      if (!pages) throw new Error(`No way to publish on ${nameOf(account)} from here: add its token above.`);
      await pages.init?.();
      const s = (await pages.find(h.siteName)) || (await pages.create(h.siteName));
      next = { ...next, siteId: s.siteId, url: s.url, ...(h.domain ? { domain: undefined, domainSetup: undefined } : {}) };
      await cfxSite(db.api, db.studio, account, s.siteId, siteIn(h)).catch(() => null);
    }
    const idx = await studio.updateMeta(p.id, { host: next }, `Hosting: ${p.name} on ${nameOf(account)}`); onIndex(idx);
    const proj = idx.projects.find((x) => x.id === p.id)!, t = liveTargets([proj], session.token).find((x) => x.kind === "hosted")!;
    await pushTarget(t, { studio, pages: (hh) => pagesForHost(hh, session.token), token: session.token, step: (d) => setBusy("site:" + p.id + ":" + d) });
    setPick((m) => { const n = { ...m }; delete n[p.id]; return n; });
    toast(`${p.name} is live on ${nameOf(account)}.`);
  });
  /** Updates the Studio's database to this build (keeps its sign-ins, data and kept tokens): connect the Studio's own
   *  Cloudflare account right here (a token already saved on this device connects by itself), then one click. */
  const [nf, setNf] = useState<Netlify | null | undefined>(undefined);
  useEffect(() => { netlifyToken.load(session.token).then((t) => setNf(t ? new Netlify(t.token) : null)).catch(() => setNf(null)); }, [session.token]);
  const cfAcc = useCfAccount(session.token, nf, true, true);
  const dbHost = db ? db.api.replace(/^https:\/\//, "").replace(/\/+$/, "") : "";
  const updateSiteDb = (d: { api: string; account: string }) => run("sitedb:" + d.api, async () => {
    const say = (x: string) => setBusy("sitedb:" + d.api + "|" + x), host = d.api.replace(/^https:\/\//, "");
    const { relay, cf, account, token } = await cfAcc.clientFor(d.account || undefined, say);
    // Only the account that runs that database (its workers.dev name is in the database's address).
    const sub = await cf.subdomainOf(account.id);
    if (!sub || `picaffectz-db.${sub}.workers.dev` !== host) throw new Error(`The Cloudflare token on this device is for ${account.name}, but that database (${host}) is on another Cloudflare account. Add that account's token under Cloudflare accounts below, then press Update again.`);
    const v = await cfAccountVault.load(session.token), old = (v?.setups || []).find((x) => x.api.replace(/\/+$/, "") === d.api) || null;
    const setup = await setupCfDb(relay, token, { account, resendKey: "", mailFrom: v?.mailFrom || "", name: "Picaffectz Studio", existing: old, requireMail: false }, say);
    await cfAccountVault.save({ ...(v || { token: "" }), setups: [...(v?.setups || []).filter((x) => x.account !== account.id), setup] }, session.token);
    // Shown as up to date at once (it was just uploaded); the check that follows only confirms it.
    setSiteDbs((l) => l.map((x) => (x.api === d.api ? { ...x, cur: true } : x)));
    toast("That site's database is up to date."); await loadSiteDbs(db?.api || "", d.api);
  });
  const updateDb = () => run("update", async () => {
    if (!db) return;
    const say = (x: string) => setBusy("update:" + x);
    const { relay, cf, account, token } = await cfAcc.client(say);
    // Only the account that runs this Studio's database (its workers.dev name is in the database's address).
    const sub = await cf.subdomainOf(account.id);
    if (!sub || `picaffectz-db.${sub}.workers.dev` !== dbHost) throw new Error(`This token is for ${account.name}, but your Studio's database (${dbHost}) is on another Cloudflare account. Connect that account's token here.`);
    const v = await cfAccountVault.load(session.token);
    const deploy = (await cfDeployInfo(db.api)).deploy;
    const setup = await setupCfDb(relay, token, { account, resendKey: "", mailFrom: v?.mailFrom || "", name: "Picaffectz Studio", existing: v?.setup && v.setup.api === db.api ? v.setup : null, requireMail: false, ...(deploy ? { deployToken: token } : {}) }, say);
    await cfAccountVault.save({ ...(v || {}), token, account: account.id, setup }, session.token);
    toast("Your Studio's database is up to date."); await load();
  });
  /** Changes the Resend key and/or sender the Studio's database sends sign-in codes with. A blank key keeps the one it has. */
  const saveMail = () => run("mail", async () => {
    if (!db) return;
    const from = mailFrom.trim(), key = mailKey.trim();
    if (!/<[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>$|^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(from)) throw new Error("The sender should look like Name <codes@your-domain.com>, or just codes@your-domain.com.");
    if (key && !/^re_\S{8,}$/.test(key)) throw new Error("A Resend API key starts with re_. Copy it again from resend.com/api-keys.");
    const say = (x: string) => setBusy("mail:" + x);
    const { relay, cf, account, token } = await cfAcc.client(say);
    const sub = await cf.subdomainOf(account.id);
    if (!sub || `picaffectz-db.${sub}.workers.dev` !== dbHost) throw new Error(`This token is for ${account.name}, but your Studio's database (${dbHost}) is on another Cloudflare account. Connect that account's token here.`);
    const v = await cfAccountVault.load(session.token);
    const deploy = (await cfDeployInfo(db.api)).deploy;
    const setup = await setupCfDb(relay, token, { account, resendKey: key, mailFrom: from, name: "Picaffectz Studio", existing: v?.setup && v.setup.api === db.api ? v.setup : null, requireMail: true, ...(deploy ? { deployToken: token } : {}) }, say);
    await cfAccountVault.save({ ...(v || {}), token, account: account.id, setup, mailFrom: from, ...(key ? { resendKey: key } : {}) }, session.token);
    setMailKey(""); toast("Sign-in emails will now be sent from " + from + "."); await load();
  });
  if (db === undefined) return null;
  return (
    <section className="card flex flex-col gap-3 p-5" aria-label="Sites and hosting accounts">
      <h3 className="text-[15px] font-extrabold">Sites and hosting accounts</h3>
      <p className="text-sm text-ink-300">Every live site and where it's hosted, in one place. Cloudflare accounts are kept on your Studio's database (tokens as secrets on your own Cloudflare, never shown again), and each site's choice is saved with the project, so any device signed in to the Studio uses the same setup.</p>
      {/* With the Studio's own database on Cloudflare each site's row below carries its database's state; without it, they are listed here. */}
      {!db && siteDbs.length > 0 && <div className="flex flex-col gap-2 rounded-lg border border-ink-700 p-3 text-[13px]" aria-label="Site databases">
            <div className="flex flex-wrap items-baseline gap-x-2"><b className="text-sm">Site databases</b><span className="text-ink-400">Sites hosted on their own Cloudflare account keep their own database there. Each is updated by itself, apart from your Studio's.</span></div>
            {siteDbs.map((d) => <div key={d.api} className="flex flex-wrap items-center gap-2 border-t border-ink-700 pt-2">
              <span className="min-w-0 flex-1"><span className="break-all font-mono text-[12px]">{d.api.replace(/^https:\/\//, "")}</span><span className="block text-ink-400">{d.sites.join(", ")}</span></span>
              {d.cur ? <span className="chip border-emerald-400/50 text-emerald-200">Up to date</span>
                : <><span className="chip border-amber-400/50 text-amber-200">Older build</span><button type="button" className="btn btn-pri btn-sm" disabled={!!busy} onClick={() => updateSiteDb(d)}>{busy.startsWith("sitedb:" + d.api) ? (busy.split("|")[1] || "Updating") + "…" : "Update this database"}</button></>}
            </div>)}
          </div>}
      {!db ? <p className="text-sm text-amber-200">This needs your Studio's database on Cloudflare. Set it up from Publish to Cloudflare on a project, or move the Studio there (Migration).</p>
        : !info ? <SkelRows n={3} label="Loading your sites and hosting accounts" />
        : !info.signed ? <p className="text-sm text-amber-200">Sign in to your Studio's database on this device to manage its hosting accounts.</p>
        : !info.cur || !info.cfx || !info.imp || !info.pages || !info.del || !info.mail ? <div className="flex flex-col gap-2 text-sm"><p className="text-amber-200">Your Studio's database is from an older build. Update it once (your data, sign-ins and kept tokens stay).</p>
          <p className="text-ink-400">Connect the Cloudflare account that runs it (<span className="font-mono">{dbHost}</span>), then press Update. A token already saved on this device connects by itself.</p>
          {cfAcc.ui}
          <button type="button" className="btn btn-pri btn-sm self-start" disabled={!!busy || !cfAcc.ready} onClick={updateDb}>{busy.startsWith("update") ? (busy.split(":").slice(1).join(":") || "Updating") + "…" : "Update the database"}</button></div>
        : <>
          {index.hosted?.pages === "cloudflare" && index.hosted.siteId && <div aria-label="The Studio's own address"><CfDomainCard plain="The Studio's own address" acc={cfAcc}
            host={{ kind: "cloudflare", siteId: index.hosted.siteId, siteName: index.hosted.siteName, url: index.hosted.url, account: index.hosted.account, domain: index.hosted.domain, subdomain: index.hosted.subdomain, domainSetup: index.hosted.domainSetup } as HostCfg}
            onHost={async (h) => { onIndex(await studio.updateIndex((i) => { if (i.hosted) { i.hosted = { ...i.hosted, domain: h.domain, subdomain: h.subdomain, domainSetup: h.domainSetup }; } }, h.domain ? `Studio address: ${h.domain}` : "Studio address removed")); }} /></div>}
          <details className="group rounded-lg border border-ink-700 p-3 text-[13px]" aria-label="Sign-in emails (Resend)" open={!info.resend}>
            <summary className="flex cursor-pointer select-none flex-wrap items-baseline gap-x-2"><b className="text-sm">Sign-in emails (Resend)</b>{info.resend ? <span className="chip border-emerald-400/50 text-emerald-200">Connected{mailFrom.trim() ? " · " + mailFrom.trim() : ""}</span> : <span className="chip border-amber-400/50 text-amber-200">Not set up</span>}<span className="text-ink-400">How this Studio emails its 6-digit sign-in codes. Each site's own email settings are separate.</span></summary>
            <div className="mt-2 flex flex-col gap-2">
            <label className="flex flex-col gap-1"><span className="text-ink-300">Resend API key</span>
              <input className="input font-mono text-xs" type="password" autoComplete="off" aria-label="Resend API key for the Studio's codes" placeholder="Leave empty to keep the current key (re_…)" value={mailKey} onChange={(e) => setMailKey(e.target.value)} /></label>
            <label className="flex flex-col gap-1"><span className="text-ink-300">Codes come from</span>
              <input className="input text-xs" aria-label="Sender for the Studio's codes" placeholder="Picaffectz Studio <codes@your-domain.com>" value={mailFrom} onChange={(e) => setMailFrom(e.target.value)} /></label>
            <p className="text-ink-400">The sender's domain must be verified in <a className="underline" href="https://resend.com/domains" target="_blank" rel="noopener noreferrer">Resend → Domains</a>. Until then, <span className="font-mono">onboarding@resend.dev</span> works but only delivers to your own Resend email. <a className="underline" href={RESEND_KEYS_PAGE} target="_blank" rel="noopener noreferrer">Create a key ↗</a></p>
            <button type="button" className="btn btn-pri btn-sm self-start" disabled={!!busy || !mailFrom.trim()} onClick={saveMail}>{busy.startsWith("mail") ? (busy.split(":").slice(1).join(":") || "Saving") + "…" : "Save sign-in email settings"}</button>
            </div>
          </details>
          <div className="flex flex-col gap-2 rounded-lg border border-ink-700 p-3 text-[13px]" aria-label="Cloudflare accounts on the database">
            <div className="flex flex-wrap items-baseline gap-x-2"><b className="text-sm">Cloudflare accounts</b><span className="text-ink-400">Every account your sites are hosted on. This is the only place they are listed; a site shows just its own.</span></div>
            {!info.main && <span className="text-amber-200">The main account's token isn't kept on the database: turn on Publish from any device above so every device can publish, and so accounts can be added from any device.</span>}
            <ul className="flex flex-col divide-y divide-ink-700/70">
              {accounts.map((a) => {
                const main = a.id === info.main, used = sites.filter((p) => p.host?.kind === "cloudflare" && p.host.account === a.id);
                return (
                  <li key={a.id} className="flex flex-col gap-1.5 py-2 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                      <b className="font-semibold text-ink-100">{a.name}</b>
                      {main && <span className="rounded-full border border-ink-600 px-2 py-0.5 text-[11px] text-ink-300">Main · the Studio's database</span>}
                      <span className="text-ink-400">{used.length ? `Hosts ${used.map((p) => p.name).join(", ")}` : main ? "No site is hosted on it yet" : "No site uses it"}</span>
                      {!main && <span className="ml-auto flex gap-1">
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReplaceFor(replaceFor === a.id ? null : a.id)}>Replace token</button>
                        <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => forget(a)}>Remove</button></span>}
                    </div>
                    {replaceFor === a.id && <TokenInput label={`New token for ${a.name}`} busy={busy === "keep"} onSave={keep} />}
                  </li>
                );
              })}
            </ul>
            <details className="rounded-lg border border-ink-700/70 px-3 py-2" open={!!addTok}>
              <summary className="cursor-pointer font-semibold text-brand-300">+ Add a Cloudflare account</summary>
              <div className="mt-2 flex flex-col gap-2">
                <span className="text-ink-400">For a site on another Cloudflare account (an old one, or a client's): sign in to it on dash.cloudflare.com, <a className="text-brand-300 underline" href={CF_DB_TOKEN_PAGE} target="_blank" rel="noopener noreferrer">create its token ↗</a> (permissions already ticked) and paste it. An account you connect under Hosting accounts above is added here by itself.</span>
                <TokenInput label="Another Cloudflare account's token" busy={busy === "keep"} value={addTok} onChange={setAddTok} onSave={keep} button="Add account" />
              </div>
            </details>
          </div>
          {sites.length === 0 && <p className="rounded-lg border border-ink-700 p-3 text-[13px] text-ink-400">No live sites yet.</p>}
          {([["cloudflare", "On Cloudflare"], ["netlify", "On Netlify"], ["github", "On GitHub Pages"]] as const).map(([kind, heading]) => {
            const all = sites.filter((p) => (p.host ? p.host.kind === kind || (kind === "netlify" && p.host.kind !== "cloudflare") : kind === "github"));
            if (!all.length) return null;
            const q = (find[kind] || "").trim().toLowerCase();
            const hit = q ? all.filter((p) => [p.name, p.host?.url, p.host?.siteName, p.host?.cf?.api, p.publish ? `${p.publish.owner}/${p.publish.repo}` : "", nameOf(p.host?.account), p.client, p.category].some((x) => String(x || "").toLowerCase().includes(q))) : all;
            const pages = Math.max(1, Math.ceil(hit.length / PER)), page = Math.min(pageOf[kind] || 0, pages - 1), group = hit.slice(page * PER, page * PER + PER);
            return (
              <div key={kind} className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-[12px] font-bold uppercase tracking-wide text-ink-400">{heading} · {q ? `${hit.length} of ${all.length}` : all.length}</h4>
                  {hit.length > 0 && <button type="button" className="text-[12px] font-semibold text-ink-400 underline-offset-2 hover:text-ink-100 hover:underline" onClick={() => keepOpen(hit.every((x) => isOpen(x.id)) ? "" : "all")}>{hit.every((x) => isOpen(x.id)) ? "Close all" : "Open all"}</button>}
                  {all.length > PER && <input type="search" className="input ml-auto h-8 w-full max-w-[240px] py-1 text-[13px]" placeholder={`Search ${heading.replace(/^On /, "")} sites`} aria-label={`Search sites: ${heading}`} value={find[kind] || ""} onChange={(e) => { setFind({ ...find, [kind]: e.target.value }); setPageOf({ ...pageOf, [kind]: 0 }); }} />}
                </div>
                {!hit.length && <p className="rounded-lg border border-ink-700 p-3 text-[13px] text-ink-400">No site matches “{find[kind]}”.</p>}
                <ul className={`flex-col divide-y divide-ink-700 rounded-lg border border-ink-700 ${hit.length ? "flex" : "hidden"}`} aria-label={`Hosted sites: ${heading}`}>
                  {group.map((p) => {
                    const h = p.host, cf = h?.kind === "cloudflare", chosen = pick[p.id] ?? h?.account ?? "", b = busy.startsWith("site:" + p.id), every = everyDevice(p);
                    const otherDb = cf && h!.cf && db && h!.cf.api.replace(/\/+$/, "") !== db.api.replace(/\/+$/, "");
                    const keptAcc = cf && accounts.some((a) => a.id === h!.account);
                    // The site's own database (not the Studio's): whether it runs this build, with its own update button.
                    const sdb = otherDb ? siteDbs.find((d) => d.api === h!.cf!.api.replace(/\/+$/, "")) : undefined;
                    return (
                      <li key={p.id} data-shut={isOpen(p.id) ? undefined : ""} className="grid gap-x-4 gap-y-2 p-3 text-[13px] sm:grid-cols-[minmax(0,1fr)_auto] [&[data-shut]>button]:hidden [&[data-shut]>div>:not(:first-child)]:hidden" data-site={p.id}>
                        <div className="flex min-w-0 flex-col gap-1.5">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <button type="button" className="-ml-1 grid h-6 w-6 flex-none place-items-center rounded-md text-ink-400 hover:bg-ink-800 hover:text-ink-100" aria-expanded={isOpen(p.id)} aria-label={`${isOpen(p.id) ? "Hide" : "Show"} the details of ${p.name}`} onClick={() => toggleSite(p.id, hit.map((x) => x.id))}><span aria-hidden className={`inline-block text-[10px] transition-transform ${isOpen(p.id) ? "" : "-rotate-90"}`}>▼</span></button>
                            <a className="font-semibold text-ink-100 underline-offset-2 hover:underline" href={`#/p/${p.id}`}>{p.name}</a>
                            {!isOpen(p.id) && sdb && !sdb.cur && <span className="chip border-amber-400/50 px-2 py-0.5 text-[11px] text-amber-200">Database: older build</span>}
                            {!isOpen(p.id) && !every && <span className="chip border-amber-400/50 px-2 py-0.5 text-[11px] text-amber-200">Publishing needs attention</span>}
                            {h && p.publish && <span className="rounded-full border border-ink-600 px-2 py-0.5 text-[11px]">+ GitHub copy</span>}
                            {h ? <a className="truncate text-brand-300 underline" href={siteAddress(h)} target="_blank" rel="noopener noreferrer">{siteAddress(h).replace(/^https:\/\//, "")}</a> : p.publish && <span className="truncate font-mono text-[12px] text-ink-400">{p.publish.owner}/{p.publish.repo}</span>}
                          </div>
                          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-ink-300">
                            <dt className="text-ink-400">Publishing</dt>
                            <dd className={every ? "text-emerald-300" : "text-amber-200"}>{every ? "Works on every device signed in to the Studio"
                              : cf ? (keptAcc ? "Being allowed for every device…" : "Only devices with its Cloudflare token: add its account above")
                              : h ? "Uses the Netlify token on each device (Hosting accounts above)"
                              : "Uses the GitHub token on each device (or keep it on the database with Publish from any device)"}</dd>
                            <dt className="text-ink-400">Admin page</dt>
                            <dd>{h?.cf ? "Works on every device: its editors sign in with an email code" : h ? "Its editors sign in with an email code (Supabase)" : "Each device signs in once with a GitHub token for the site's repository"}</dd>
                            {h?.cf && <><dt className="text-ink-400">Login emails</dt><dd><LoginEmails key={String(keptAcc)} cf={h.cf} account={h.kind === "cloudflare" ? h.account : undefined} name={p.name} /></dd></>}
                            {h?.cf && <><dt className="text-ink-400">Sign-in email sender</dt><dd><SiteMailSetting cf={h.cf} /></dd></>}
                            {!h?.cf && <><dt className="text-ink-400">Login emails</dt><dd className="text-ink-400">{h ? "Kept in Supabase: manage them in the site's admin page" : "None: this site has no email sign-in. Publish it to Cloudflare from its project to add login emails."}</dd></>}
                            {cf && <><dt className="text-ink-400">Data</dt><dd>{otherDb
                              ? (keptAcc
                                ? <>Its own database on {nameOf(h!.account)} (<span className="break-all font-mono text-[12px]">{h!.cf!.api.replace(/^https:\/\//, "")}</span>), reached from every device through your Studio</>
                                : <span className="text-amber-200">Its own database on another Cloudflare account. Add that account above, so every device reaches it (its data stays where it is).</span>)
                              : h!.cf ? "Your Studio's database" : "Supabase"}
                              {sdb && <span className="mt-1.5 flex flex-wrap items-center gap-2" data-sitedb={sdb.cur ? "current" : "old"}>
                                {sdb.cur ? <span className="chip border-emerald-400/50 text-emerald-200">Database up to date</span>
                                  : <><span className="chip border-amber-400/50 text-amber-200">Database: older build</span><button type="button" className="btn btn-pri btn-sm" disabled={!!busy} onClick={() => updateSiteDb(sdb)}>{busy.startsWith("sitedb:" + sdb.api) ? (busy.split("|")[1] || "Updating") + "…" : "Update this database"}</button></>}
                              </span>}</dd></>}
                            {h?.kind === "netlify" && <><dt className="text-ink-400">Data</dt><dd>{h.cf ? "Your Studio's database" : "Supabase"}</dd></>}
                          </dl>
                          {cf && (
                            <div className="flex flex-wrap items-center gap-2">
                              <label className="flex items-center gap-2"><span className="text-ink-400">Cloudflare account</span>
                                <select className="input py-1" aria-label={`Cloudflare account for ${p.name}`} value={chosen} disabled={!!busy} onChange={(e) => setPick((m) => ({ ...m, [p.id]: e.target.value }))}>
                                  {!accounts.some((a) => a.id === chosen) && <option value={chosen}>{chosen ? "Its account (not kept here yet: add its token above)" : "Not recorded"}</option>}
                                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                              </label>
                              {chosen && chosen !== h!.account && <button type="button" className="btn btn-pri btn-sm" disabled={!!busy} onClick={() => moveSite(p, chosen)}>{b ? (busy.split(":").slice(2).join(":") || "Publishing") + "…" : "Save and publish there"}</button>}
                              {chosen && chosen === h!.account && accounts.some((a) => a.id === chosen) && <button type="button" className="btn btn-sm" disabled={!!busy} onClick={() => moveSite(p, chosen)}>{b ? (busy.split(":").slice(2).join(":") || "Publishing") + "…" : "Publish now"}</button>}
                            </div>
                          )}
                        </div>
                        <button type="button" className="btn btn-danger btn-sm self-start justify-self-start sm:justify-self-end" disabled={!!busy} title="Deletes this site's live copy from every service it uses. The project stays in the Studio." onClick={() => setTear(p)}>Delete &amp; remove</button>
                      </li>
                    );
                  })}
                </ul>
                {pages > 1 && <nav className="flex items-center justify-between gap-3 text-[13px]" aria-label={`Pages of sites: ${heading}`}>
                  <button type="button" className="btn btn-sm" disabled={page === 0} onClick={() => setPageOf({ ...pageOf, [kind]: page - 1 })}>← Previous</button>
                  <span className="text-ink-400">Page {page + 1} of {pages} · sites {page * PER + 1}–{Math.min(hit.length, (page + 1) * PER)} of {hit.length}</span>
                  <button type="button" className="btn btn-sm" disabled={page >= pages - 1} onClick={() => setPageOf({ ...pageOf, [kind]: page + 1 })}>Next →</button>
                </nav>}
              </div>
            );
          })}
        </>}
      {(!db || (info && !(info.signed && info.cfx && info.imp && info.pages && info.del && info.mail))) && sites.length > 0 && (
        <ul className="flex flex-col divide-y divide-ink-700 rounded-lg border border-ink-700" aria-label="Hosted sites">
          {sites.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2 p-3 text-[13px]">
              <a className="font-semibold text-ink-100 underline-offset-2 hover:underline" href={`#/p/${p.id}`}>{p.name}</a>
              <span className="rounded-full border border-ink-600 px-2 py-0.5 text-[11px]">{p.host ? PAGES_LABEL[p.host.kind] : "GitHub Pages"}{p.host && p.publish ? " + GitHub Pages" : ""}</span>
              {p.host ? <a className="truncate text-brand-300 underline" href={siteAddress(p.host)} target="_blank" rel="noopener noreferrer">{siteAddress(p.host).replace(/^https:\/\//, "")}</a> : p.publish && <span className="text-ink-400">{p.publish.owner}/{p.publish.repo}</span>}
              <button type="button" className="btn btn-danger btn-sm ml-auto" disabled={!!busy} title="Deletes this site's live copy from every service it uses. The project stays in the Studio." onClick={() => setTear(p)}>Delete &amp; remove</button>
            </li>
          ))}
        </ul>
      )}
      {tear && <TeardownDialog title={`Delete & remove ${tear.name}`} name={tear.name} plan={projectPlan(tear)}
        keeps="The project itself stays in the Studio as a draft, with its content and photos, so you can publish it again later. Other sites and the databases they share are not touched."
        run={(step) => teardownProject(tear, { studioToken: session.token, db, step })}
        onDone={async (r) => {
          // Forget what was removed; anything that couldn't be removed stays on the project so it can be tried again.
          const left = (label: string) => r.failed.some((f) => f.startsWith(label));
          onIndex(await studio.updateIndex((i) => {
            const m = i.projects.find((x) => x.id === tear.id); if (!m) return;
            if (m.host && !left("The site") && !left("Content") && !left("Enquiries")) delete m.host;
            if (m.worker && !left("The shop")) delete m.worker;
            if (m.inbox && !left("The enquiry inbox")) delete m.inbox;
            if (m.publish && !left("The GitHub repository")) delete m.publish;
            if (!m.host && !m.publish) { m.status = "draft"; delete m.siteSha; delete m.syncedAt; }
          }, `Delete & remove ${tear.name}'s live site`));
        }} onClose={() => setTear(null)} />}
      {err && <p role="alert" className="text-[13px] text-red-300">{err}</p>}
    </section>
  );
}

/** One site's sign-in emails: the people who open its admin page with an emailed code. A dropdown of the list, and
 *  a button that shows or hides the form to add (or remove) one. */
export function LoginEmails({ cf, account, name, startOpen }: { cf: { api: string; site: string }; account?: string; name: string; /** Show the add and remove boxes straight away. */ startOpen?: boolean }) {
  const toast = useToast(), confirm = useConfirm();
  const [list, setList] = useState<{ email: string; role: string }[] | null>(null), [err, setErr] = useState("");
  const [sel, setSel] = useState(""), [open, setOpen] = useState(!!startOpen), [add, setAdd] = useState(""), [busy, setBusy] = useState(false);
  const load = async () => {
    setErr("");
    try { const l = await (await siteMembers(cf, account)).list(); setList(l); setSel((x) => (l.some((m) => m.email === x) ? x : l[0]?.email || "")); }
    catch (e: any) { setErr(e?.status === 401 ? "Sign in to this site's database on this device to see them." : /Unknown operation|Which site/i.test(e?.message || "") ? "Update the database once (above) to manage these here." : e?.message || "Couldn't load them."); }
  };
  useEffect(() => { load(); }, [cf.api, cf.site, account]);
  const run = async (f: () => Promise<void>) => { setBusy(true); try { await f(); await load(); } catch (e: any) { toast(e?.message || "That didn't work.", "bad"); } setBusy(false); };
  const doAdd = () => run(async () => {
    const mails = [...new Set(add.split(/[,;\s]+/).map((x) => x.trim().toLowerCase()).filter(Boolean))];
    const bad = mails.find((m) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m)); if (bad) throw new Error(`${bad} isn't an email address.`);
    if (!mails.length) return;
    const m = await siteMembers(cf, account); for (const e of mails.slice(0, 10)) await m.add(e);
    setAdd(""); setSel(mails[0]); toast(`${mails.length === 1 ? mails[0] + " can" : mails.length + " people can"} now sign in to ${name}'s admin page.`);
  });
  const doRemove = async () => {
    if (!sel || !(await confirm(`Remove ${sel}?`, `They can no longer sign in to ${name}'s admin page.${list && list.length === 1 ? " This is the only login email: nobody could sign in until you add another." : ""}`, "Remove", true))) return;
    run(async () => { await (await siteMembers(cf, account)).remove(sel); toast(`${sel} removed.`); });
  };
  if (err) return <span className="text-amber-200">{err} <button type="button" className="text-brand-300 underline" onClick={load}>Try again</button></span>;
  if (!list) return <Skel className="inline-block h-4 w-40 align-middle" />;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {list.length ? <select className="input max-w-full py-1" aria-label={`Login emails for ${name}`} value={sel} onChange={(e) => setSel(e.target.value)}>{list.map((m) => <option key={m.email} value={m.email}>{m.email}</option>)}</select>
          : <span className="text-amber-200">None yet: nobody can sign in to its admin page.</span>}
        <span className="text-ink-400">{list.length} email{list.length === 1 ? "" : "s"}</span>
        <button type="button" className="btn btn-ghost btn-sm" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "Hide" : "Add or remove"}</button>
      </div>
      {open && (
        <div className="flex flex-col gap-2 rounded-lg border border-ink-700/70 p-2.5">
          <div className="flex flex-wrap gap-2">
            <input className="input min-w-0 flex-1 py-1" type="email" aria-label={`Add a login email for ${name}`} placeholder="name@example.com (several: separate with commas)" value={add} onChange={(e) => setAdd(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && add.trim() && !busy) doAdd(); }} />
            <button type="button" className="btn btn-sm btn-pri" disabled={busy || !add.trim()} onClick={doAdd}>{busy ? "Saving…" : "Add"}</button>
            {sel && <button type="button" className="btn btn-sm" disabled={busy} onClick={doRemove}>Remove {sel}</button>}
          </div>
          <span className="text-ink-400">Each of these signs in to the site's admin page with a 6-digit code sent to that address. Nothing to publish: it works straight away.</span>
        </div>
      )}
    </div>
  );
}

function TokenInput({ label, busy, onSave, value, onChange, button = "Save" }: { label: string; busy: boolean; onSave: (t: string) => void; value?: string; onChange?: (v: string) => void; button?: string }) {
  const [own, setOwn] = useState(""), v = value ?? own, set = onChange ?? setOwn;
  return (
    <div className="flex gap-2">
      <input aria-label={label} className="input min-w-0 flex-1 font-mono text-xs" type="password" autoComplete="off" placeholder={label} value={v} onChange={(e) => set(e.target.value)} />
      <button type="button" className="btn btn-sm" disabled={busy || v.trim().length < 20} onClick={() => onSave(v)}>{busy ? "Checking…" : button}</button>
    </div>
  );
}
