// Shop backend setup from the Studio: the Cloudflare Worker (shop server) with its private GitHub data
// repository and Resend email, without copying code or settings into dashboards by hand.
import { useEffect, useState } from "react";
import type { Session } from "../lib/auth";
import type { ProjectMeta, Studio, StudioIndex, WorkerCfg } from "../lib/studio";
import { ensureRepo, ghPublish } from "../lib/ghpublish";
import { netlifyToken, siteAddress } from "../lib/hosting";
import { Netlify } from "../lib/netlify";
import { RELAY_VERSION, relayVault, setupRelay, type Relay } from "../lib/relay";
import { CF_DNS_HINT, CF_TOKEN_PAGE, Cloudflare, cfVault, workerCheck, type CfAccount } from "../lib/cloudflare";
import { stripeWebhook } from "../lib/stripe";
import { RESEND_KEYS_PAGE, Resend, type ResendDomain } from "../lib/resend";
import { STUDIO_BUILD } from "../build-info";
import { Field, Modal, Spinner, useToast } from "../ui/kit";
import { NetlifyAccount } from "./HostDialog";

type Props = { session: Session; studio: Studio; project: ProjectMeta; draft: any; onConnect: (workerUrl: string) => Promise<void>; onIndex: (i: StudioIndex) => void; onClose: () => void };
type Step = "todo" | "busy" | "done" | "error";
type Check = { setting: string; ok: boolean; detail: string };

const slug = (s: string) => String(s || "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
const ghPages = (t: { owner: string; repo: string }) => `https://${t.owner}.github.io/${t.repo.toLowerCase() === `${t.owner}.github.io`.toLowerCase() ? "" : t.repo + "/"}`;
const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
const RZP_WEBHOOKS = "https://dashboard.razorpay.com/app/webhooks";
const stripeHooks = (key: string) => `https://dashboard.stripe.com/${/^(sk|rk)_test_/.test(key) ? "test/" : ""}webhooks`;
const tokenLink = (owner: string, repo: string) => `https://github.com/settings/personal-access-tokens/new?${new URLSearchParams({ name: `${repo} worker`.slice(0, 40), description: `Lets the shop's Cloudflare Worker save orders in ${owner}/${repo}. Repository access: only ${repo}.`, target_name: owner, expires_in: "366", contents: "write" })}`;

function Section({ n, title, state, children }: { n: number; title: string; state: Step; children: React.ReactNode }) {
  const mark = state === "done" ? "✓" : state === "error" ? "!" : String(n);
  return (
    <section aria-label={title} className="flex flex-col gap-3 rounded-xl border border-ink-700 p-4">
      <h3 className="flex items-center gap-2.5 text-[15px] font-extrabold">
        <span className={`grid h-6 w-6 flex-none place-items-center rounded-full text-xs ${state === "done" ? "bg-emerald-500 text-white" : state === "error" ? "bg-red-500 text-white" : "bg-ink-700 text-ink-200"}`}>{mark}</span>{title}
      </h3>
      {children}
    </section>
  );
}
const Copy = ({ v }: { v: string }) => { const toast = useToast(); return <button type="button" className="btn btn-sm px-2 py-1 text-xs" onClick={() => { navigator.clipboard?.writeText(v); toast("Copied"); }}>Copy</button>; };

export function ShopBackendDialog({ session, studio, project, draft, onConnect, onIndex, onClose }: Props) {
  const toast = useToast();
  const prev = project.worker;
  const owner = ghPublish.login() || session.cfg.owner;
  const site = project.host ? siteAddress(project.host) : project.publish ? ghPages(project.publish) : "";

  // 1. helper
  const [nf, setNf] = useState<Netlify | null | undefined>(undefined);
  const [relay, setRelay] = useState<Relay | null>(null);
  const [relayBusy, setRelayBusy] = useState(""), [relayErr, setRelayErr] = useState("");
  useEffect(() => {
    (async () => {
      const t = await netlifyToken.load(session.token), n = t ? new Netlify(t.token) : null;
      setNf(n);
      const r = await relayVault.load(session.token);
      if (r && r.v === RELAY_VERSION) { setRelay(r); return; }
      // An older helper: update it in place (same site and key) so it can do what this Studio asks of it.
      if (r && n) { try { setRelay(await setupRelay(n, session.token, r, (x) => setRelayBusy("Updating the helper: " + x.toLowerCase()))); } catch { setRelay(null); } setRelayBusy(""); }
    })();
  }, [session.token]);
  const makeRelay = async () => {
    if (!nf) return;
    setRelayErr("");
    try { setRelay(await setupRelay(nf, session.token, await relayVault.load(session.token), setRelayBusy)); toast("The helper is ready"); }
    catch (e: any) { setRelayErr(e?.message || "Couldn't set up the helper."); }
    setRelayBusy("");
  };

  // 2. data repository + its token
  const [repoName, setRepoName] = useState(prev?.dataRepo?.split("/")[1] || `${slug(project.publish?.repo || project.name) || "shop"}-data`);
  const dataRepo = `${owner}/${repoName}`;
  const [repoState, setRepoState] = useState<Step>(prev ? "done" : "todo"), [repoMsg, setRepoMsg] = useState("");
  const [ghTok, setGhTok] = useState(""), [ghState, setGhState] = useState<Step>(prev ? "done" : "todo"), [ghMsg, setGhMsg] = useState(prev ? "Already on the Worker. Paste a new token only to replace it." : "");
  const makeRepo = async () => {
    setRepoState("busy"); setRepoMsg("");
    try { const created = await ensureRepo(ghPublish.token(session.token), owner, repoName, "Orders, customers and wishlists for the shop (private, written by its Cloudflare Worker).", true); setRepoState("done"); setRepoMsg(created ? `Created ${dataRepo} (private).` : `${dataRepo} is ready (private).`); }
    catch (e: any) { setRepoState("error"); setRepoMsg(e?.message || "Couldn't create the repository."); }
  };
  const checkGh = async () => {
    setGhState("busy"); setGhMsg("");
    try {
      const r = await fetch(`https://api.github.com/repos/${dataRepo}`, { headers: { Authorization: "Bearer " + ghTok.trim(), Accept: "application/vnd.github+json" }, cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) throw new Error("GitHub rejected this token. Copy it again.");
      if (r.status === 404) throw new Error(`The token can't see ${dataRepo}. On the token page, under Repository access, choose Only select repositories → ${repoName}.`);
      if (!r.ok) throw new Error(`GitHub answered ${r.status}.`);
      if (!j.private) throw new Error(`${dataRepo} is public. Make it private first: orders hold customer details.`);
      if (j.permissions && !j.permissions.push) throw new Error("The token can read but not write. Set Contents to Read and write.");
      setGhState("done"); setGhMsg(`The token can save orders in ${dataRepo}.`);
    } catch (e: any) { setGhState("error"); setGhMsg(e?.message || "Couldn't check the token."); }
  };

  // 3. email
  const [rsKey, setRsKey] = useState(""), [rsMode, setRsMode] = useState<"" | "full" | "sending">("");
  const [rsErr, setRsErr] = useState(""), [rsBusy, setRsBusy] = useState(false);
  const [domains, setDomains] = useState<ResendDomain[]>([]);
  const [domain, setDomain] = useState<ResendDomain | null>(null);
  const [domainName, setDomainName] = useState(project.host?.domain || "");
  const [testSender, setTestSender] = useState(false);
  const [fromName, setFromName] = useState(String(draft?.brand?.name || project.name || "Shop").replace(/[<>"]/g, ""));
  const [fromLocal, setFromLocal] = useState("orders");
  const [manualFrom, setManualFrom] = useState(prev?.mailFrom || "");
  const rs = relay && rsKey.trim() ? new Resend(relay, rsKey.trim()) : null;
  const connectResend = async () => {
    if (!rs) return;
    setRsBusy(true); setRsErr("");
    try {
      const list = await rs.domains(); setDomains(list); setRsMode("full");
      const match = list.find((d) => d.name === domainName.trim().toLowerCase()) || (list.length === 1 && !domainName ? list[0] : null);
      if (match) { setDomain(await rs.domain(match.id)); setDomainName(match.name); }
    } catch (e: any) { if (e?.restricted) setRsMode("sending"); else setRsErr(e?.message || "Couldn't reach Resend."); }
    setRsBusy(false);
  };
  const addDomain = async () => {
    if (!rs) return;
    setRsBusy(true); setRsErr("");
    try {
      const name = domainName.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
      const have = domains.find((d) => d.name === name);
      setDomain(have ? await rs.domain(have.id) : await rs.addDomain(name));
    } catch (e: any) { setRsErr(e?.message || "Couldn't add the domain."); }
    setRsBusy(false);
  };
  const checkDomain = async () => {
    if (!rs || !domain) return;
    setRsBusy(true); setRsErr("");
    try { await rs.verify(domain.id).catch(() => null); await new Promise((r) => setTimeout(r, 2500)); setDomain(await rs.domain(domain.id)); }
    catch (e: any) { setRsErr(e?.message || "Couldn't check the domain."); }
    setRsBusy(false);
  };
  const [dnsBusy, setDnsBusy] = useState(false), [dnsMsg, setDnsMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const dnsViaCloudflare = async () => {
    if (!relay || !domain || !cfTok.trim()) return;
    setDnsBusy(true); setDnsMsg(null);
    try {
      const cf = new Cloudflare(relay, cfTok.trim());
      const zone = await cf.zoneFor(domain.name).catch(() => null);
      if (!zone) throw new Error(`${domain.name} isn't on this Cloudflare account, or the token can't see its DNS. ${CF_DNS_HINT}`);
      const done = await cf.addRecords(zone, domain.name, domain.records || []).catch((e: any) => { throw new Error(/permission|auth|refused/i.test(e?.message || "") ? `The token can't change DNS. ${CF_DNS_HINT}` : e?.message); });
      const added = done.filter((d) => d.done === "added").length, clash = done.filter((d) => d.done === "conflict");
      setDnsMsg({ ok: !clash.length, t: `${added ? `Added ${added} record${added === 1 ? "" : "s"} in Cloudflare` : "The records were already in Cloudflare"}${clash.length ? `. ${clash.map((c) => `${c.type} ${c.name}`).join(", ")} already has a different value: change it in Cloudflare → DNS` : ""}. Checking with Resend…` });
      await checkDomain();
    } catch (e: any) { setDnsMsg({ ok: false, t: e?.message || "Couldn't add the records." }); }
    setDnsBusy(false);
  };
  const mailFrom = testSender ? `${fromName} <onboarding@resend.dev>` : rsMode === "full" && domain ? `${fromName} <${fromLocal}@${domain.name}>` : manualFrom;
  const fromOk = /^[^<>@]*<[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>$/.test(mailFrom) || emailOk(mailFrom);
  const emailState: Step = !rsKey ? (prev ? "done" : "todo") : rsMode && fromOk ? "done" : rsErr ? "error" : "todo";

  // 4. Cloudflare
  const [cfTok, setCfTok] = useState(""), [cfSaved, setCfSaved] = useState(false);
  const [accounts, setAccounts] = useState<CfAccount[]>([]), [account, setAccount] = useState(prev?.account || "");
  const [cfErr, setCfErr] = useState(""), [cfBusy, setCfBusy] = useState(false);
  const [wName, setWName] = useState(prev?.name || `${slug(project.publish?.repo || project.name) || "shop"}-shop`.slice(0, 50));
  useEffect(() => { cfVault.load(session.token).then((v) => { if (v?.token) { setCfTok(v.token); setCfSaved(true); if (v.account) setAccount((a) => a || v.account!); } }); }, [session.token]);
  const connectCf = async () => {
    if (!relay || !cfTok.trim()) return;
    setCfBusy(true); setCfErr("");
    try {
      const list = await new Cloudflare(relay, cfTok.trim()).accounts();
      if (!list.length) throw new Error("This token can't see any Cloudflare account. Use the “Edit Cloudflare Workers” template, with your account selected.");
      setAccounts(list); setAccount((a) => (list.some((x) => x.id === a) ? a : list[0].id));
      await cfVault.save({ token: cfTok.trim(), account: list[0].id }, session.token); setCfSaved(true);
    } catch (e: any) { setCfErr(e?.message || "Couldn't reach Cloudflare."); }
    setCfBusy(false);
  };
  useEffect(() => { if (relay && cfSaved && cfTok && !accounts.length && !cfErr) connectCf(); }, [relay, cfSaved]);
  const cfState: Step = accounts.length && account && /^[a-z0-9][a-z0-9-]{0,62}$/.test(wName) ? "done" : cfErr ? "error" : "todo";

  // 5. settings + deploy
  const [siteUrl, setSiteUrl] = useState(site);
  const [ownerEmail, setOwnerEmail] = useState(() => { try { return localStorage.getItem("site-studio:host-email") || ""; } catch { return ""; } });
  const [admins, setAdmins] = useState("");
  const [rz, setRz] = useState({ id: "", secret: "", hook: "" }), [st, setSt] = useState({ key: "", hook: "" });
  const [stripeOut, setStripeOut] = useState<{ ok: boolean; t: string } | null>(null);
  const [log, setLog] = useState<{ t: string; ok?: boolean }[]>([]);
  const [deploying, setDeploying] = useState(false);
  const [result, setResult] = useState<{ url: string; checks: Check[]; status: string } | null>(null);
  const [mail, setMail] = useState("");

  const ready = !!relay && repoState === "done" && ghState === "done" && (prev ? true : !!ghTok) && fromOk && cfState === "done" && /^https:\/\//.test(siteUrl) && emailOk(ownerEmail);
  const missing = [!relay && "the helper", repoState !== "done" && "the orders repository", (ghState !== "done" || (!prev && !ghTok)) && "the Worker's GitHub token", !fromOk && "email", cfState !== "done" && "Cloudflare", !/^https:\/\//.test(siteUrl) && "the shop's address", !emailOk(ownerEmail) && "your email"].filter(Boolean) as string[];

  const deploy = async () => {
    if (!relay) return;
    setDeploying(true); setResult(null); setLog([]); setStripeOut(null);
    const say = (t: string) => setLog((l) => [...l.map((x) => (x.ok === undefined ? { ...x, ok: true } : x)), { t }]);
    try {
      const cf = new Cloudflare(relay, cfTok.trim());
      say("Getting the shop server code");
      const r = await fetch(`templates/store/cloudflare/worker.js?v=${STUDIO_BUILD.id}`, { cache: "no-store" });
      if (!r.ok) throw new Error("Couldn't load the Worker code from the Studio.");
      const code = await r.text();
      const secrets: Record<string, string> = {};
      if (ghTok.trim()) secrets.GITHUB_TOKEN = ghTok.trim();
      if (!prev) secrets.AUTH_SECRET = crypto.randomUUID() + crypto.randomUUID();
      if (rsKey.trim()) {
        if (rsMode === "full" && domain && !testSender) { say("Creating a send-only email key for the Worker"); secrets.RESEND_API_KEY = (await new Resend(relay, rsKey.trim()).sendingKey(`${wName} worker`, domain.id)).token; }
        else secrets.RESEND_API_KEY = rsKey.trim();
      }
      // Razorpay: the webhook secret is any string both sides share, so the Studio makes one.
      let rzHook = rz.hook.trim();
      if (rz.id.trim() && !rzHook) { rzHook = crypto.randomUUID().replace(/-/g, ""); setRz((x) => ({ ...x, hook: rzHook })); }
      if (rz.id) secrets.RAZORPAY_KEY_ID = rz.id.trim(); if (rz.secret) secrets.RAZORPAY_KEY_SECRET = rz.secret.trim(); if (rzHook) secrets.RAZORPAY_WEBHOOK_SECRET = rzHook;
      say("Getting the workers.dev address");
      const sub = await cf.subdomain(account, owner);
      const url = `https://${wName}.${sub}.workers.dev`;
      if (st.key.trim()) {
        secrets.STRIPE_SECRET_KEY = st.key.trim();
        say("Adding the order webhook in Stripe");
        try {
          const w = await stripeWebhook(relay, st.key.trim(), url + "/stripe-webhook");
          secrets.STRIPE_WEBHOOK_SECRET = w.secret;
          setStripeOut({ ok: true, t: `Added in Stripe${w.replaced ? " (replaced the earlier one)" : ""}: ${url}/stripe-webhook, event checkout.session.completed. Its signing secret is on the Worker.` });
        } catch (e: any) {
          if (st.hook.trim()) secrets.STRIPE_WEBHOOK_SECRET = st.hook.trim();
          setStripeOut({ ok: false, t: `Couldn't add the webhook in Stripe (${e?.message || "error"}). Add it by hand below.` });
        }
      }
      const vars = { DATA_REPO: dataRepo, SITE_URL: siteUrl.trim().replace(/\/?$/, "/"), MAIL_FROM: mailFrom, OWNER_EMAIL: ownerEmail.trim().toLowerCase(), ADMIN_EMAILS: admins.trim() };
      say(`Uploading the Worker “${wName}” with its settings`);
      await cf.upload(account, wName, code, { vars, secrets, keep: true });
      say("Turning on its workers.dev address");
      await cf.enableWorkersDev(account, wName);
      say("Running the Worker's own check");
      let chk: any = null;
      for (let i = 0; i < 6; i++) { try { chk = await workerCheck(relay, url); if (chk?.checks?.length) break; } catch { /* still starting */ } await new Promise((res) => setTimeout(res, 2500)); }
      say("Connecting the shop to the Worker");
      await onConnect(url);
      const w: WorkerCfg = { account, name: wName, url, dataRepo, mailFrom, build: STUDIO_BUILD.id, deployedAt: new Date().toISOString() };
      onIndex(await studio.updateMeta(project.id, { worker: w }, "Set up the shop's Cloudflare Worker"));
      await cfVault.save({ token: cfTok.trim(), account }, session.token);
      setLog((l) => l.map((x) => ({ ...x, ok: true })));
      setResult({ url, checks: chk?.checks || [], status: chk?.status || "The Worker is deployed. Its check didn't answer yet; open its address in a minute." });
    } catch (e: any) {
      setLog((l) => [...l.map((x, i) => (i === l.length - 1 ? { ...x, ok: false } : x.ok === undefined ? { ...x, ok: true } : x)), { t: e?.message || "Something went wrong.", ok: false }]);
    }
    setDeploying(false);
  };
  const testMail = async () => {
    if (!relay || !result) return;
    setMail("Sending…");
    try { const j = await workerCheck(relay, result.url, true); setMail(j.sent ? `Sent to ${j.to}. Check the inbox (and spam).` : j.what_to_do || j.problem || "Resend didn't accept it."); }
    catch (e: any) { setMail(e?.message || "Couldn't send."); }
  };

  const footer = result ? <button className="btn btn-pri" onClick={onClose}>Done</button>
    : <><button className="btn" onClick={onClose} disabled={deploying}>Close</button>
      <button className="btn btn-pri" disabled={!ready || deploying} title={missing.length ? "Still needed: " + missing.join(", ") : ""} onClick={deploy}>{deploying ? "Deploying…" : prev ? "Update the Worker" : "Deploy the Worker"}</button></>;

  return (
    <Modal title="Shop backend: Cloudflare Worker + email" wide onClose={() => !deploying && onClose()} footer={footer}>
      <p className="text-sm text-ink-300">Sets up the free shop server (orders, customer accounts, order emails, Razorpay/Stripe checkout) on your Cloudflare account, saves orders in a private GitHub repository and sends email through Resend. Nothing to paste into dashboards except the keys below.</p>
      {prev && !result && <p className="rounded-lg border border-emerald-400/30 bg-emerald-400/5 px-3 py-2.5 text-[13px] text-emerald-100">Connected: <a className="underline" href={prev.url} target="_blank" rel="noopener noreferrer">{prev.url}</a>. Change anything below and press <b>Update the Worker</b>; settings you leave empty stay as they are.</p>}

      <Section n={1} title="Studio helper on your Netlify" state={relay ? "done" : relayErr ? "error" : "todo"}>
        <p className="text-[13px] text-ink-400">Cloudflare and Resend don't accept requests straight from a web page, so the Studio adds a tiny helper site to your Netlify account once. It keeps no keys or data and only answers the Studio.</p>
        {nf === undefined ? <Spinner label="Checking Netlify…" /> : relay
          ? <p className="flex flex-wrap items-center gap-2 text-sm"><span className="h-2 w-2 rounded-full bg-emerald-400" />Ready: <a className="text-brand-300 underline" href={relay.url} target="_blank" rel="noopener noreferrer">{relay.url.replace(/^https:\/\//, "")}</a><button type="button" className="btn btn-sm ml-auto" disabled={!nf || !!relayBusy} onClick={makeRelay}>Set up again</button></p>
          : nf ? <div className="flex flex-wrap items-center gap-3"><button type="button" className="btn btn-pri btn-sm" disabled={!!relayBusy} onClick={makeRelay}>{relayBusy ? relayBusy + "…" : "Set up the helper"}</button>{relayErr && <span role="alert" className="text-sm text-red-300">{relayErr}</span>}</div>
          : <NetlifyAccount session={session} onToken={(t) => setNf(t ? new Netlify(t) : null)} />}
      </Section>

      <Section n={2} title="Private repository for orders" state={repoState === "done" && ghState === "done" ? "done" : repoState === "error" || ghState === "error" ? "error" : "todo"}>
        <div className="flex flex-wrap items-end gap-2">
          <Field label={`Repository (${owner}/…)`} htmlFor="sb-repo"><input id="sb-repo" className="input w-64 font-mono" value={repoName} disabled={repoState === "done"} onChange={(e) => setRepoName(slug(e.target.value))} /></Field>
          {repoState !== "done" && <button type="button" className="btn btn-sm" disabled={repoState === "busy" || !repoName || !ghPublish.login()} onClick={makeRepo}>{repoState === "busy" ? "Creating…" : "Create it (private)"}</button>}
        </div>
        {!ghPublish.login() && <p className="text-[13px] text-amber-200">Connect the GitHub publishing token first (Settings → Hosting accounts), or create the private repository on GitHub yourself.</p>}
        {repoMsg && <p role="status" className={`text-[13px] ${repoState === "error" ? "text-red-300" : "text-emerald-300"}`}>{repoMsg}</p>}
        <p className="text-[13px] text-ink-300">The Worker needs its own token that can only reach this repository. <a className="text-brand-300 underline" href={tokenLink(owner, repoName)} target="_blank" rel="noopener noreferrer">Open GitHub's token page, already filled in ↗</a>. There, under <b>Repository access</b>, choose <b>Only select repositories → {repoName}</b>, then Generate and copy.</p>
        <div className="flex gap-2"><input aria-label="The Worker's GitHub token" className="input min-w-0 flex-1 font-mono" type="password" autoComplete="off" placeholder="github_pat_…" value={ghTok} onChange={(e) => { setGhTok(e.target.value); if (!prev) setGhState("todo"); }} />
          <button type="button" className="btn btn-sm" disabled={!ghTok.trim() || ghState === "busy" || repoState !== "done"} onClick={checkGh}>{ghState === "busy" ? "Checking…" : "Check"}</button></div>
        {ghMsg && <p role="status" className={`text-[13px] ${ghState === "error" ? "text-red-300" : ghState === "done" ? "text-emerald-300" : "text-ink-400"}`}>{ghMsg}</p>}
      </Section>

      <Section n={3} title="Email (Resend)" state={emailState}>
        <p className="text-[13px] text-ink-300">Order emails and sign-in codes are sent through Resend (free for 3,000 emails a month). <a className="text-brand-300 underline" href={RESEND_KEYS_PAGE} target="_blank" rel="noopener noreferrer">Create an API key ↗</a> with <b>Full access</b> so the Studio can add your domain; the Worker gets a separate send-only key.</p>
        <div className="flex gap-2"><input aria-label="Resend API key" className="input min-w-0 flex-1 font-mono" type="password" autoComplete="off" placeholder={prev ? "Leave empty to keep the Worker's current key" : "re_…"} value={rsKey} onChange={(e) => { setRsKey(e.target.value); setRsMode(""); setDomain(null); }} />
          <button type="button" className="btn btn-sm" disabled={!relay || !rsKey.trim() || rsBusy} onClick={connectResend}>{rsBusy && !rsMode ? "Checking…" : "Connect"}</button></div>
        {rsErr && <p role="alert" className="text-[13px] text-red-300">{rsErr}</p>}
        {rsMode === "sending" && (
          <Field label="Send-only key: type the sender (a verified Resend domain)" htmlFor="sb-from"><input id="sb-from" className="input" value={manualFrom} onChange={(e) => setManualFrom(e.target.value)} placeholder={`${fromName} <orders@yourdomain.com>`} /></Field>
        )}
        {rsMode === "full" && (
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={testSender} onChange={(e) => setTestSender(e.target.checked)} /> Test first with Resend's sender (onboarding@resend.dev, delivers only to your Resend email)</label>
            {!testSender && <>
              <div className="flex flex-wrap items-end gap-2">
                <Field label="Your domain" htmlFor="sb-dom"><input id="sb-dom" className="input w-56" placeholder="yourdomain.com" value={domainName} onChange={(e) => setDomainName(e.target.value)} list="sb-doms" /></Field>
                <datalist id="sb-doms">{domains.map((d) => <option key={d.id} value={d.name} />)}</datalist>
                <button type="button" className="btn btn-sm" disabled={rsBusy || !/\.[a-z]{2,}$/i.test(domainName.trim())} onClick={addDomain}>{domains.some((d) => d.name === domainName.trim().toLowerCase()) ? "Use this domain" : "Add domain to Resend"}</button>
              </div>
              {domain && (
                <div className="flex flex-col gap-2">
                  <p className="text-sm">Status: <b className={domain.status === "verified" ? "text-emerald-300" : "text-amber-200"}>{domain.status === "verified" ? "Verified" : domain.status.replace(/_/g, " ")}</b>{domain.status !== "verified" && " · these DNS records prove the domain is yours."}</p>
                  {domain.status !== "verified" && (
                    <div className="flex flex-col gap-1.5 rounded-lg border border-brand-400/30 bg-brand-400/5 p-3 text-[13px] text-ink-200">
                      <p><b>Quickest:</b> <a className="text-brand-300 underline" href={`https://resend.com/domains/${domain.id}`} target="_blank" rel="noopener noreferrer">open this domain in Resend ↗</a> and press <b>Auto configure</b>. If your domain is at GoDaddy or Cloudflare, you sign in there once and the records are added for you.</p>
                      {cfTok.trim() && relay && <p className="flex flex-wrap items-center gap-2">Domain's DNS on Cloudflare? <button type="button" className="btn btn-sm" disabled={dnsBusy || rsBusy} onClick={dnsViaCloudflare}>{dnsBusy ? "Adding…" : "Add them with my Cloudflare token"}</button></p>}
                      <p className="text-ink-400">Anywhere else: add the records below in your domain provider's DNS page, then press Check verification.</p>
                      {dnsMsg && <p role="status" className={dnsMsg.ok ? "text-emerald-300" : "text-amber-200"}>{dnsMsg.t}</p>}
                    </div>
                  )}
                  {domain.status !== "verified" && (domain.records || []).length > 0 && (
                    <div className="overflow-x-auto rounded-lg border border-ink-700"><table className="w-full text-left text-[12.5px]"><thead className="text-ink-400"><tr><th className="p-2">Type</th><th className="p-2">Name / host</th><th className="p-2">Value</th><th className="p-2">Priority</th><th className="p-2"></th></tr></thead>
                      <tbody>{domain.records!.map((r, i) => <tr key={i} className="border-t border-ink-700 align-top"><td className="p-2 font-mono">{r.type}</td><td className="p-2 font-mono">{r.name}<Copy v={r.name} /></td><td className="max-w-[320px] break-all p-2 font-mono">{r.value}</td><td className="p-2">{r.priority ?? ""}</td><td className="p-2"><Copy v={r.value} /></td></tr>)}</tbody></table></div>
                  )}
                  {domain.status !== "verified" && <button type="button" className="btn btn-sm self-start" disabled={rsBusy} onClick={checkDomain}>{rsBusy ? "Checking…" : "Check verification"}</button>}
                </div>
              )}
            </>}
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Sender name" htmlFor="sb-fn"><input id="sb-fn" className="input" value={fromName} onChange={(e) => setFromName(e.target.value.replace(/[<>"]/g, ""))} /></Field>
              {!testSender && <Field label={`Sender address${domain ? ` (@${domain.name})` : ""}`} htmlFor="sb-fl"><input id="sb-fl" className="input" value={fromLocal} onChange={(e) => setFromLocal(e.target.value.replace(/[^\w.+-]/g, ""))} /></Field>}
            </div>
            {fromOk && <p className="text-[13px] text-ink-400">Emails come from <b className="text-ink-200">{mailFrom}</b>{!testSender && domain && domain.status !== "verified" ? ". They'll deliver once the domain is verified; you can deploy now and check later." : "."}</p>}
          </div>
        )}
      </Section>

      <Section n={4} title="Cloudflare" state={cfState}>
        <p className="text-[13px] text-ink-300"><a className="text-brand-300 underline" href={CF_TOKEN_PAGE} target="_blank" rel="noopener noreferrer">Create an API token ↗</a>: the permissions are already ticked, so just press <b>Continue to summary → Create Token</b> (free plan is enough). It's kept on this device only, so the Studio can update the Worker when you push updates.</p>
        <div className="flex gap-2"><input aria-label="Cloudflare API token" className="input min-w-0 flex-1 font-mono" type="password" autoComplete="off" value={cfTok} onChange={(e) => { setCfTok(e.target.value); setAccounts([]); setCfSaved(false); }} placeholder="Cloudflare API token" />
          <button type="button" className="btn btn-sm" disabled={!relay || !cfTok.trim() || cfBusy} onClick={connectCf}>{cfBusy ? "Checking…" : "Connect"}</button></div>
        {cfErr && <p role="alert" className="text-[13px] text-red-300">{cfErr}</p>}
        {accounts.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Account" htmlFor="sb-acc"><select id="sb-acc" className="input" value={account} onChange={(e) => setAccount(e.target.value)}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
            <Field label="Worker name" htmlFor="sb-wn" hint="Lowercase letters, numbers and hyphens."><input id="sb-wn" className="input font-mono" value={wName} disabled={!!prev} onChange={(e) => setWName(slug(e.target.value))} /></Field>
          </div>
        )}
      </Section>

      <Section n={5} title="Shop settings" state={result ? "done" : "todo"}>
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Shop address (SITE_URL)" htmlFor="sb-site" hint={site ? "Where the shop is published." : "Publish the shop first, or type its address."}><input id="sb-site" className="input" value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} placeholder="https://yourname.github.io/shop/" /></Field>
          <Field label="Your email (gets new orders, signs in to Orders)" htmlFor="sb-own"><input id="sb-own" className="input" type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} /></Field>
          <Field label="Other admin emails (optional, comma-separated)" htmlFor="sb-adm"><input id="sb-adm" className="input" value={admins} onChange={(e) => setAdmins(e.target.value)} /></Field>
        </div>
        <details className="rounded-lg border border-ink-700 px-3 py-2 text-sm"><summary className="cursor-pointer font-semibold">Card payments (optional): Razorpay / Stripe keys</summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <Field label="Razorpay Key ID" htmlFor="sb-rzi"><input id="sb-rzi" className="input font-mono" value={rz.id} onChange={(e) => setRz({ ...rz, id: e.target.value })} placeholder="rzp_test_…" /></Field>
            <Field label="Razorpay Key Secret" htmlFor="sb-rzs"><input id="sb-rzs" className="input font-mono" type="password" value={rz.secret} onChange={(e) => setRz({ ...rz, secret: e.target.value })} /></Field>
            <Field label="Razorpay webhook secret" htmlFor="sb-rzh" hint="Leave empty: the Studio makes one."><input id="sb-rzh" className="input font-mono" value={rz.hook} onChange={(e) => setRz({ ...rz, hook: e.target.value })} /></Field>
            <Field label="Stripe secret key" htmlFor="sb-sk" hint="The Studio adds the webhook in Stripe for you."><input id="sb-sk" className="input font-mono" type="password" value={st.key} onChange={(e) => setSt({ ...st, key: e.target.value })} placeholder="sk_test_…" /></Field>
            {stripeOut && !stripeOut.ok && <Field label="Stripe webhook signing secret" htmlFor="sb-sh" hint="Only if you added the webhook by hand."><input id="sb-sh" className="input font-mono" type="password" value={st.hook} onChange={(e) => setSt({ ...st, hook: e.target.value })} placeholder="whsec_…" /></Field>}
          </div>
          <p className="mt-2 text-[13px] text-ink-400">Stripe's webhook is added for you. Razorpay doesn't let other apps add webhooks, so after deploying you get a link to the right page and everything to paste.</p>
        </details>
        {!ready && !deploying && !result && <p className="text-[13px] text-ink-400">Still needed: {missing.join(", ")}.</p>}
        {log.length > 0 && <ul aria-label="Progress" className="flex flex-col gap-1 text-sm">{log.map((l, i) => <li key={i} className={l.ok === false ? "text-red-300" : l.ok ? "text-ink-300" : "text-ink-100"}>{l.ok === false ? "✕" : l.ok ? "✓" : "…"} {l.t}</li>)}</ul>}
        {result && (
          <div className="flex flex-col gap-3">
            <p className="text-sm">Worker: <a className="font-mono text-brand-300 underline" href={result.url} target="_blank" rel="noopener noreferrer">{result.url}</a> <Copy v={result.url} /></p>
            <p className={`text-sm font-semibold ${result.checks.length && result.checks.every((c) => c.ok) ? "text-emerald-300" : "text-amber-200"}`}>{result.status}</p>
            {result.checks.length > 0 && <ul aria-label="Worker checks" className="grid gap-1 text-[13px]">{result.checks.map((c, i) => <li key={i} className={c.ok ? "text-ink-300" : "text-amber-200"}>{c.ok ? "✓" : "!"} <b>{c.setting}</b>: {c.detail}</li>)}</ul>}
            <p className="text-sm text-ink-300">The shop is now set to use this Worker (Accounts &amp; backend). <b>Publish</b> the shop to put it live.</p>
            <div className="flex flex-wrap items-center gap-2"><button type="button" className="btn btn-sm" onClick={testMail}>Send a test email</button>{mail && <span role="status" className="text-[13px] text-ink-300">{mail}</span>}</div>
            {rz.id && <div aria-label="Razorpay webhook" className="flex flex-col gap-1.5 rounded-lg border border-ink-700 p-3 text-[13px] text-ink-300">
              <p className="font-semibold text-ink-100">Razorpay: one last step (about a minute)</p>
              <p><a className="btn btn-sm btn-pri" href={RZP_WEBHOOKS} target="_blank" rel="noopener noreferrer">Open Razorpay's webhooks page ↗</a> → <b>Add New Webhook</b>, and paste:</p>
              <p>Webhook URL: <code className="break-all font-mono">{result.url}/razorpay-webhook</code> <Copy v={result.url + "/razorpay-webhook"} /></p>
              <p>Secret: <code className="break-all font-mono">{rz.hook}</code> <Copy v={rz.hook} /></p>
              <p>Active events: tick <i>payment.captured</i> and <i>order.paid</i>, then Create webhook.</p>
            </div>}
            {st.key && <div aria-label="Stripe webhook" className="rounded-lg border border-ink-700 p-3 text-[13px] text-ink-300">
              {stripeOut?.ok ? <p className="text-emerald-300">✓ Stripe: {stripeOut.t}</p> : <>
                <p className="text-amber-200">{stripeOut?.t || "Stripe's webhook wasn't added."}</p>
                <p className="mt-1"><a className="text-brand-300 underline" href={stripeHooks(st.key)} target="_blank" rel="noopener noreferrer">Open Stripe's webhooks page ↗</a> → Add endpoint: <code className="font-mono">{result.url}/stripe-webhook</code> <Copy v={result.url + "/stripe-webhook"} /> · event <i>checkout.session.completed</i>. Then paste its signing secret in Card payments and press Update the Worker.</p>
              </>}
            </div>}
          </div>
        )}
      </Section>
    </Modal>
  );
}
