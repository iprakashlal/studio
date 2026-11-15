// Settings → Sites and hosting accounts: one place for every live site's hosting. The Cloudflare accounts are kept on
// the Studio's database (tokens as Worker secrets on your own Cloudflare, never read back), and each site's choice is
// saved with the project, so every device signed in to the Studio sees and uses the same setup.
import { useEffect, useMemo, useState } from "react";
import type { Session } from "../lib/auth";
import type { ProjectMeta, Studio, StudioIndex } from "../lib/studio";
import { CFDB_WORKER, CF_DB_TOKEN_PAGE, cfAccountVault, cfDeployInfo, cfSignedIn, cfxDelete, cfxList, cfxPut, cfxSite } from "../lib/cfdb";
import { loadHostConfig } from "../lib/studiohost";
import { pagesForHost, PAGES_LABEL } from "../lib/pages";
import { liveTargets, pushTarget } from "../lib/pushupdates";
import { siteAddress } from "../lib/hosting";
import { explain } from "../lib/repo";
import { Cloudflare } from "../lib/cloudflare";
import { getHelper } from "../lib/relay";
import { useConfirm, useToast } from "../ui/kit";

type Acc = { id: string; name: string };

export function SitesHostingCard({ session, studio, index, onIndex }: { session: Session; studio: Studio; index: StudioIndex; onIndex: (i: StudioIndex) => void }) {
  const toast = useToast(), confirm = useConfirm();
  const sites = useMemo(() => index.projects.filter((p) => p.host || p.publish), [index.projects]);
  const [db, setDb] = useState<{ api: string; studio: string } | null | undefined>(undefined);
  const [info, setInfo] = useState<{ cfx: boolean; main: string | null; accounts: Acc[]; signed: boolean; gh: boolean } | null>(null);
  const [mainName, setMainName] = useState("");
  const [busy, setBusy] = useState(""), [err, setErr] = useState("");
  const [addTok, setAddTok] = useState(""), [replaceFor, setReplaceFor] = useState<string | null>(null);
  const [pick, setPick] = useState<Record<string, string>>({});

  const load = async () => {
    const hc = await loadHostConfig().catch(() => null), v = await cfAccountVault.load(session.token).catch(() => null);
    const api = hc?.kind === "cloudflare" ? hc.api : v?.setup?.api || "";
    const sid = hc?.kind === "cloudflare" ? hc.studio : session.cfg.owner === "cloudflare" ? session.cfg.repo : "";
    if (!api || !sid) { setDb(null); return; }
    setDb({ api, studio: sid });
    const d = await cfDeployInfo(api), signed = !!(await cfSignedIn(api));
    const l = signed && d.cfx ? await cfxList(api, sid).catch(() => null) : null;
    setInfo({ cfx: !!d.cfx, main: l?.main ?? (d.deploy ? d.account || null : null), accounts: l?.accounts || [], signed, gh: !!d.gh });
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
    return !!h.account && accounts.some((a) => a.id === h.account);
  };

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
  /** Lets every device publish this site (registers it on the database for its account). */
  const shareSite = (p: ProjectMeta) => run("share:" + p.id, async () => {
    const h = p.host!; if (!db || h.kind !== "cloudflare" || !h.account) return;
    await cfxSite(db.api, db.studio, h.account, h.siteId, siteIn(h)); toast(`${p.name} can be published from any device signed in to the Studio.`); await load();
  });

  if (db === undefined) return null;
  return (
    <section className="card flex flex-col gap-3 p-5" aria-label="Sites and hosting accounts">
      <h3 className="text-[15px] font-extrabold">Sites and hosting accounts</h3>
      <p className="text-sm text-ink-300">Every live site and where it's hosted, in one place. Cloudflare accounts are kept on your Studio's database (tokens as secrets on your own Cloudflare, never shown again), and each site's choice is saved with the project, so any device signed in to the Studio uses the same setup.</p>
      {!db ? <p className="text-sm text-amber-200">This needs your Studio's database on Cloudflare. Set it up from Publish to Cloudflare on a project, or move the Studio there (Migration).</p>
        : !info ? <p className="text-sm text-ink-400">Loading…</p>
        : !info.signed ? <p className="text-sm text-amber-200">Sign in to your Studio's database on this device to manage its hosting accounts.</p>
        : !info.cfx ? <p className="text-sm text-amber-200">Your Studio's database is from an older build. Open any project → Publish to Cloudflare and press its setup once (or use an AI tool's <b>Update the database</b>) to update it, then come back.</p>
        : <>
          <div className="flex flex-col gap-2 rounded-lg border border-ink-700 p-3 text-[13px]" aria-label="Cloudflare accounts on the database">
            <b className="text-sm">Cloudflare accounts</b>
            {info.main ? <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-400" /><span className="flex-1">{nameOf(info.main)} <span className="text-ink-400">(main, the Studio's database)</span></span></span>
              : <span className="text-amber-200">The main account's token isn't kept on the database: turn on Publish from any device above so every device can publish, and so accounts can be added from any device.</span>}
            {info.accounts.map((a) => (
              <div key={a.id} className="flex flex-col gap-1.5">
                <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-400" /><span className="flex-1">{a.name}</span>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReplaceFor(replaceFor === a.id ? null : a.id)}>Replace token</button>
                  <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => forget(a)}>Remove</button></span>
                {replaceFor === a.id && <TokenInput label={`New token for ${a.name}`} busy={busy === "keep"} onSave={keep} />}
              </div>
            ))}
            <span className="text-ink-400">Add a site's other Cloudflare account (an old one, or a client's): sign in to it on dash.cloudflare.com, <a className="text-brand-300 underline" href={CF_DB_TOKEN_PAGE} target="_blank" rel="noopener noreferrer">create its token ↗</a> (permissions already ticked) and paste it.</span>
            <TokenInput label="Another Cloudflare account's token" busy={busy === "keep"} value={addTok} onChange={setAddTok} onSave={keep} button="Add account" />
          </div>
          <ul className="flex flex-col divide-y divide-ink-700 rounded-lg border border-ink-700" aria-label="Hosted sites">
            {sites.length === 0 && <li className="p-3 text-[13px] text-ink-400">No live sites yet.</li>}
            {sites.map((p) => {
              const h = p.host, cf = h?.kind === "cloudflare", chosen = pick[p.id] ?? h?.account ?? "", b = busy.startsWith("site:" + p.id);
              const otherDb = cf && h!.cf && db && h!.cf.api.replace(/\/+$/, "") !== db.api.replace(/\/+$/, "");
              return (
                <li key={p.id} className="flex flex-col gap-2 p-3 text-[13px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <a className="font-semibold text-ink-100 underline-offset-2 hover:underline" href={`#/p/${p.id}`}>{p.name}</a>
                    <span className="rounded-full border border-ink-600 px-2 py-0.5 text-[11px]">{h ? PAGES_LABEL[h.kind] : "GitHub Pages"}{h && p.publish ? " + GitHub Pages" : ""}</span>
                    {h && <a className="truncate text-brand-300 underline" href={siteAddress(h)} target="_blank" rel="noopener noreferrer">{siteAddress(h).replace(/^https:\/\//, "")}</a>}
                    <span className={`ml-auto text-[12px] ${everyDevice(p) ? "text-emerald-300" : "text-amber-200"}`}>{everyDevice(p) ? "Works on every device" : h?.kind === "netlify" ? "Netlify token on each device" : "Only devices with its token"}</span>
                  </div>
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
                      {chosen && chosen === h!.account && accounts.some((a) => a.id === chosen) && <button type="button" className="text-brand-300 underline" disabled={!!busy} onClick={() => shareSite(p)}>Allow every device</button>}
                    </div>
                  )}
                  {cf && <span className="text-ink-400">Data: {otherDb ? <>another database (<span className="font-mono">{h!.cf!.api.replace(/^https:\/\//, "")}</span>): each browser signs in to it separately. <a className="text-brand-300 underline" href={`#/p/${p.id}`}>Open the project</a> → Publish to Cloudflare → <b>Move into my Studio's database</b>.</> : h!.cf ? "your Studio's database" : "Supabase"}</span>}
                  {h?.kind === "netlify" && <span className="text-ink-400">Netlify publishing uses the Netlify token on each device (Hosting accounts above). Data: {h.cf ? "your Studio's database" : "Supabase"}.</span>}
                  {!h && p.publish && <span className="text-ink-400">GitHub repository {p.publish.owner}/{p.publish.repo}{info.gh ? ", published through the GitHub token kept on the database." : "; publishing uses the GitHub token on each device (or keep it on the database with Publish from any device)."}</span>}
                </li>
              );
            })}
          </ul>
        </>}
      {err && <p role="alert" className="text-[13px] text-red-300">{err}</p>}
    </section>
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
