import { useEffect, useMemo, useState } from "react";
import { useCfAccount, useCloudflarePicker, type CfAccountHook } from "./CfPicker";
import { cloudflarePages, netlifyPages, PAGES_LABEL, type Pages, type PagesKind } from "../lib/pages";
import { CF_DOMAIN_HINT, CfError } from "../lib/cloudflare";
import { cfAddMembers, cfRole, cfSendCode, cfSignedIn, cfVerifyCode } from "../lib/cfdb";
import { SupabaseAuto } from "./SupabaseAuto";
import type { Session } from "../lib/auth";
import type { ProjectMeta, Studio, StudioIndex } from "../lib/studio";
import type { TEMPLATES } from "../schema";
import { explain } from "../lib/repo";
import { slugify } from "../lib/util";
import { Netlify, checkDns, cleanDomain, dnsRecords, domainOk, type DnsRecord } from "../lib/netlify";
import { cleanUrl, isAdmin, sbUrlOk, sendCode, setupSql, signedInEmail, siteIdOk, verifyCode, type CfSiteCfg, type HostCfg, type SbCfg } from "../lib/supa";
import { netlifyToken, publishHosted, siteAddress } from "../lib/hosting";
import { Field, Modal, Spinner, Toggle, useConfirm, useToast } from "../ui/kit";

const TOKEN_PAGE = "https://app.netlify.com/user/applications#personal-access-tokens";
const SB_NEW = "https://supabase.com/dashboard/new";
const stepsFor = (k: PagesKind) => ["Upload new photos to the database", "Save the content in the database", `Deploy the pages to ${PAGES_LABEL[k]}`, "Live"];

function copy(text: string, toast: (m: string) => void) {
  navigator.clipboard?.writeText(text).then(() => toast("Copied"), () => toast("Select the text and copy it"));
}

/** Netlify login on this device: used by the Hosting dialog and Settings. */
export function NetlifyAccount({ session, onToken }: { session: Session; onToken?: (t: string | null) => void }) {
  const toast = useToast();
  const [who, setWho] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    netlifyToken.load(session.token).then((t) => { setWho(t ? t.who || "Netlify account" : null); setLoaded(true); onToken?.(t?.token || null); });
  }, [session.token]);
  const connect = async () => {
    setBusy(true);
    try {
      const me = await new Netlify(val.trim()).me();
      const name = me.full_name || me.slug || "Netlify account";
      await netlifyToken.save(val.trim(), session.token, name);
      setWho(name); setVal(""); onToken?.(val.trim());
      toast("Netlify connected on this device");
    } catch (e: any) { toast(e?.message || "Couldn't connect Netlify", "bad"); }
    setBusy(false);
  };
  if (!loaded) return <Spinner label="Checking Netlify…" />;
  if (who) return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="h-2 w-2 rounded-full bg-emerald-400" /><span>Netlify: <b>{who}</b></span>
      <button type="button" className="btn btn-sm ml-auto" onClick={() => { netlifyToken.clear(); setWho(null); onToken?.(null); }}>Disconnect</button>
    </div>
  );
  return (
    <div className="flex flex-col gap-2">
      <Field label="Netlify personal access token" htmlFor="nf-token" hint="Kept on this device only, encrypted with your Studio login. It isn't saved in your data repository or on any site.">
        <div className="flex gap-2">
          <input id="nf-token" className="input min-w-0 flex-1 font-mono" type="password" autoComplete="off" value={val} onChange={(e) => setVal(e.target.value)} placeholder="nfp_…" />
          <button type="button" className="btn btn-pri btn-sm" disabled={busy || val.trim().length < 20} onClick={connect}>{busy ? "Checking…" : "Connect"}</button>
        </div>
      </Field>
      <p className="text-[13px] text-ink-400">Create one at <a className="text-brand-300 underline" href={TOKEN_PAGE} target="_blank" rel="noopener noreferrer">Netlify → User settings → Applications ↗</a> (a free account works).</p>
    </div>
  );
}

type Props = { studio: Studio; project: ProjectMeta; tpl: (typeof TEMPLATES)[string]; draft: any; dirty: boolean; save: (quiet?: boolean) => Promise<boolean>; onIndex: (i: StudioIndex) => void; getBlob: (p: string) => Promise<Blob | null>; session: Session; onClose: () => void };

export function HostDialog({ studio, project, tpl, draft, dirty, save, onIndex, getBlob, session, onClose }: Props) {
  const toast = useToast();
  const confirm = useConfirm();
  const host = project.host;
  const [token, setToken] = useState<string | null>(null);
  const nf = useMemo(() => (token ? new Netlify(token) : null), [token]);
  const [sb, setSb] = useState<SbCfg>(host?.sb || { url: "", key: "", site: slugify(project.name) || "my-site" });
  const [siteName, setSiteName] = useState(host?.siteName || slugify(project.name) || "");
  const EMAIL_KEY = "site-studio:host-email";
  const [email, setEmailState] = useState(() => { try { return localStorage.getItem(EMAIL_KEY) || ""; } catch { return ""; } });
  const setEmail = (v: string) => { setEmailState(v); try { localStorage.setItem(EMAIL_KEY, v); } catch { /* private mode */ } };
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [signed, setSigned] = useState<string | null>(null);
  const [access, setAccess] = useState<"" | "ok" | "no" | "error">("");
  const [accessErr, setAccessErr] = useState("");
  const [showSql, setShowSql] = useState(false);
  const [manual, setManual] = useState(false);
  const [busy, setBusy] = useState("");
  const [withContent, setWithContent] = useState(true);
  const [note, setNote] = useState("");
  const [step, setStep] = useState<{ i: number; detail?: string } | null>(null);
  const [done, setDone] = useState<{ url: string; admin: string; warnings: string[] } | null>(null);
  const sbReady = sbUrlOk(sb.url) && sb.key.trim().length > 30 && siteIdOk(sb.site);
  // The Studio's database on Cloudflare instead of Supabase.
  const [dbKind, setDbKind] = useState<"cloudflare" | "supabase">(host ? (host.cf ? "cloudflare" : "supabase") : "cloudflare");
  const [cfSite, setCfSite] = useState<CfSiteCfg | null>(host?.cf || null);
  // Where the pages are served: Cloudflare (free, no traffic limit) or Netlify. One Cloudflare account on the
  // page serves both the pages and the database.
  const [pagesKind, setPagesKind] = useState<PagesKind>(host?.kind || "cloudflare");
  const moving = !!host && host.kind !== pagesKind;
  const cfAcc = useCfAccount(session.token, nf, true);
  const cfp = useCloudflarePicker(session.token, nf, true, undefined, cfAcc);
  const pagesOk = pagesKind === "netlify" ? !!nf : cfAcc.ready;
  const getPages = async (): Promise<Pages> => {
    if (pagesKind === "netlify") { if (!nf) throw new Error("Connect Netlify first."); return netlifyPages(nf); }
    const { cf, account } = await cfAcc.client((x) => setStep({ i: -1, detail: x }));
    return cloudflarePages(cf, host?.kind === "cloudflare" && host.account ? host.account : account.id, account.name);
  };
  const [cfAddr, setCfAddr] = useState("");
  useEffect(() => { if (pagesKind === "cloudflare" && cfAcc.ready) getPages().then(async (p) => { await p.init(); setCfAddr(p.addressOf(siteName || "name")); }).catch(() => {}); }, [pagesKind, cfAcc.ready, siteName]);
  const [cfSigned, setCfSigned] = useState<string | null>(null), [cfAccess, setCfAccess] = useState<"" | "ok" | "no">("");
  const cfCheck = async (c = cfSite) => { if (!c) return; const e = await cfSignedIn(c.api); setCfSigned(e); setCfAccess(e ? ((await cfRole(c.api, "site:" + c.site)) ? "ok" : "no") : ""); };
  useEffect(() => { cfCheck(); }, [cfSite?.api, cfSite?.site]);
  const dbOk = dbKind === "cloudflare" ? !!cfSite && cfAccess === "ok" : sbReady && access === "ok";
  const demo = studio.repo.demo;

  useEffect(() => {
    if (!sbReady) { setSigned(null); return; }
    signedInEmail(sb).then(setSigned).catch(() => setSigned(null));
  }, [sb.url, sb.key]);
  useEffect(() => {
    if (!signed) { setAccess(""); return; }
    if (!email) setEmail(signed);
    setAccessErr("");
    isAdmin(cfg()).then((ok) => setAccess(ok ? "ok" : "no")).catch((e) => { setAccess("error"); setAccessErr(e?.message || "Couldn't check your access."); });
  }, [signed, sb.site]);

  const run = async (k: string, fn: () => Promise<void>) => { setBusy(k); try { await fn(); } catch (e: any) { toast(e?.message || explain(e), "bad"); } setBusy(""); };
  const cfg = (): SbCfg => ({ url: cleanUrl(sb.url), key: sb.key.trim(), site: sb.site.trim() });

  const send = () => run("send", async () => { await sendCode(cfg(), email); setCodeSent(true); toast("Code sent. Check the inbox (and spam)."); });
  const verify = () => run("verify", async () => { await verifyCode(cfg(), email, code); setSigned(await signedInEmail(cfg())); setCode(""); setCodeSent(false); await check(); });
  const check = async () => { const ok = await isAdmin(cfg()); setAccess(ok ? "ok" : "no"); if (!ok) toast("Signed in, but this email isn't listed for this site yet. Run the setup SQL with this email.", "bad"); };

  const setupCf = () => run("cfsetup", async () => {
    if (!siteIdOk(sb.site)) throw new Error("Pick a Site ID first: lowercase letters, numbers and dashes.");
    if (!email.includes("@")) throw new Error("Type your email first: it becomes the site's editor.");
    const { setup, relay, token: t } = await cfp.ensure((x) => setStep({ i: -1, detail: x }));
    await cfAddMembers(relay, t, setup, "site:" + sb.site.trim(), [{ email: email.trim().toLowerCase(), role: "owner" }]);
    const c = { api: setup.api, site: sb.site.trim() }; setCfSite(c); setStep(null); await cfCheck(c);
    toast("The site's database is ready on Cloudflare");
  });
  const cfSend = () => run("send", async () => { await cfSendCode(cfSite!.api, email.trim()); setCodeSent(true); toast("Code sent. Check the inbox (and spam)."); });
  const cfVerify = () => run("verify", async () => { await cfVerifyCode(cfSite!.api, email.trim(), code); setCode(""); setCodeSent(false); await cfCheck(); });

  const publish = () => run("publish", async () => {
    const pages = await getPages();
    if (dirty && !(await save(true))) return;
    if ((!host || moving) && !/^[a-z0-9][a-z0-9-]{1,61}$/.test(siteName)) throw new Error(`The ${pages.label} site name can use lowercase letters, numbers and dashes.`);
    const next = project.version + 1;
    let h: HostCfg;
    const db = dbKind === "cloudflare" ? { cf: cfSite!, sb: undefined } : { sb: cfg(), cf: undefined };
    if (host && !moving) h = { ...host, ...db };
    else {
      setStep({ i: -1, detail: `Creating the ${pages.label} site…` });
      let s = await pages.find(siteName);
      if (s && !(await confirm(`Use your ${pages.label} site “${s.siteName}”?`, `It already exists in your ${pages.label} account. Publishing replaces what it shows with this project.`, "Use it"))) { setStep(null); return; }
      if (!s) s = await pages.create(siteName);
      h = { kind: pagesKind, siteId: s.siteId, siteName: s.siteName, url: s.url, ...(pages.account ? { account: pages.account } : {}), ...db };
    }
    try {
      const r = await publishHosted({ pages, host: h, tpl, draft, name: project.name, version: next, withContent: !host || withContent, getBlob, note: note.trim(), step: (i, detail) => setStep({ i, detail }) });
      const { index } = await studio.recordExport(project.id, { kind: pagesKind, note: note.trim(), target: h.siteName }, draft, "published", undefined, r.siteSha, h);
      onIndex(index);
      setDone({ url: siteAddress(h), admin: r.admin, warnings: r.warnings });
    } catch (e) {
      // Remember a newly created site even if the first deploy failed, so trying again uses it.
      if (!host || moving) { try { onIndex(await studio.updateMeta(project.id, { host: h }, `Link ${pages.label} site`)); } catch { /* keep the first error */ } }
      throw e;
    } finally { setStep(null); }
  });

  if (demo) return (
    <Modal title="Host outside GitHub" onClose={onClose} footer={<button className="btn" onClick={onClose}>Close</button>}>
      <p className="rounded-lg border border-amber-400/40 bg-amber-400/5 px-3 py-2.5 text-[13px] text-amber-100">Hosting needs a real Studio login. Exit the demo and connect your repository to use it.</p>
    </Modal>
  );

  if (done) return (
    <Modal title={`Live on ${PAGES_LABEL[pagesKind]}`} wide onClose={onClose} footer={<button className="btn btn-pri" onClick={onClose}>Done</button>}>
      <ol className="list-decimal space-y-2 pl-5 text-sm text-ink-200">
        <li>The site is live at <a className="font-semibold text-brand-300 underline" href={done.url} target="_blank" rel="noopener">{done.url}</a>.</li>
        <li>Its own CMS is at <a className="font-semibold text-brand-300 underline" href={done.url + done.admin} target="_blank" rel="noopener">{done.url}{done.admin}</a>. The owner signs in there with an email code; only the site's editors can sign in.</li>
        <li>Edits made in that CMS go live at once and come back into this project, as with GitHub sites.</li>
      </ol>
      {done.warnings.length > 0 && <p className="rounded-lg border border-amber-400/40 bg-amber-400/5 px-3 py-2 text-[13px] text-amber-100">{done.warnings.length} image(s) weren't found: {done.warnings.slice(0, 3).join("; ")}</p>}
      <p className="hint">Want your own address? Open Host outside GitHub again and connect a domain.</p>
    </Modal>
  );

  const sql = setupSql(sb.site || "my-site", email || "you@example.com");
  return (
    <Modal title={host ? `Hosted on ${PAGES_LABEL[host.kind]}` : "Host outside GitHub"} wide onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Close</button><button className="btn btn-pri" disabled={!!busy || !pagesOk || !dbOk} onClick={publish}>{busy === "publish" ? "Publishing…" : host && !moving ? `Publish v${project.version + 1}` : `Move the site and publish v${project.version + 1}`}</button></>}>
      {!host && <p className="text-sm text-ink-300">Moves this site off GitHub: <b>Cloudflare</b> or <b>Netlify</b> serves the pages, and <b>Cloudflare</b> or <b>Supabase</b> holds the content, photos and who can edit. The site keeps its own CMS (with email sign-in), and stays in step with this project.{project.publish ? " The GitHub copy isn't deleted; it simply stops being updated." : ""}</p>}
      {host && <p className="text-sm text-ink-300">Live at <a className="font-semibold text-brand-300 underline" href={siteAddress(host)} target="_blank" rel="noopener">{siteAddress(host)}</a> · {PAGES_LABEL[host.kind]} site <b>{host.siteName}</b> · content in {host.cf ? "Cloudflare" : "Supabase"}.</p>}

      <section className="flex flex-col gap-3 rounded-xl border border-ink-700 bg-ink-950 p-4" aria-label="Hosting">
        <b className="text-sm">1 · Hosting (serves the pages)</b>
        <div className="flex flex-wrap rounded-lg border border-ink-600 self-start" role="radiogroup" aria-label="Pages host">
          {([["cloudflare", "Cloudflare (free, unlimited traffic)"], ["netlify", "Netlify"]] as const).map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={pagesKind === k} onClick={() => setPagesKind(k)} className={`btn btn-sm border-0 ${pagesKind === k ? "bg-ink-700" : "bg-transparent"}`}>{l}</button>)}
        </div>
        {moving && <p className="rounded-lg border border-sky-400/30 bg-sky-400/5 px-3 py-2 text-[13px] text-sky-100">Publishing moves the pages from {PAGES_LABEL[host!.kind]} to {PAGES_LABEL[pagesKind]}. The content and its editors stay where they are. Your {PAGES_LABEL[host!.kind]} site isn't deleted{host!.domain ? `, and ${host!.domain} needs connecting again afterwards` : ""}.</p>}
        {pagesKind === "netlify" ? <>
          <NetlifyAccount session={session} onToken={setToken} />
          <p className="text-[13px] text-ink-400">Netlify's free plan has 300 credits a month for the whole account: each publish from the Studio uses 15 and each GB of visitor traffic 20. When they run out, Netlify pauses the sites until the month resets. Edits made in the site's own CMS use none: they go to the database.</p>
        </> : <>
          {cfAcc.ui}
          <p className="text-[13px] text-ink-400">Cloudflare serves the pages from its network for free, with no traffic limit (a Worker with the site's files on your account). Edits made in the site's own CMS go to the database and don't need a publish.</p>
        </>}
        {(!host || moving) && pagesOk && (
          <Field label="Site name" htmlFor="nf-name" hint={`Address before you add a domain: ${pagesKind === "netlify" ? `https://${siteName || "name"}.netlify.app` : cfAddr || "…"}`}>
            <input id="nf-name" className="input" value={siteName} onChange={(e) => setSiteName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} />
          </Field>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-ink-700 bg-ink-950 p-4" aria-label="Supabase">
        <b className="text-sm">2 · Database (content, photos and logins)</b>
        <div className="flex flex-wrap rounded-lg border border-ink-600 self-start" role="radiogroup" aria-label="Site database">
          {([["cloudflare", "Cloudflare (free, never pauses)"], ["supabase", "Supabase"]] as const).map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={dbKind === k} disabled={!!host} onClick={() => setDbKind(k)} className={`btn btn-sm border-0 ${dbKind === k ? "bg-ink-700" : "bg-transparent"}`}>{l}</button>)}
        </div>
        <p className="text-[13px] text-ink-400">{dbKind === "cloudflare" ? "The Studio's database on your Cloudflare (one Worker and a D1 database for all your sites). Sign-in codes are emailed through Resend." : "One free Supabase project can hold several sites. A free project pauses after a week with no activity; restore it from the Supabase dashboard."}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Site ID" htmlFor="sb-site" hint="Names this site's rows and photo folder." warn={sb.site && !siteIdOk(sb.site) ? "Lowercase letters, numbers and dashes" : undefined}><input id="sb-site" className="input" disabled={!!host} value={sb.site} onChange={(e) => setSb({ ...sb, site: e.target.value.toLowerCase() })} /></Field>
          <Field label="Your email" htmlFor="sb-email" hint="Becomes the site's first editor. Used for the sign-in code."><input id="sb-email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        </div>
        {dbKind === "cloudflare" ? (
          <div className="flex flex-col gap-3" aria-label="Cloudflare database">
            {!cfSite ? <>
              <section aria-label="Cloudflare">{pagesKind !== "cloudflare" && cfAcc.ui}{pagesKind === "cloudflare" && !cfAcc.ready && <p className="mb-2 text-[13px] text-amber-200">Connect Cloudflare in section 1 first: the same account holds the database.</p>}{cfp.ui}</section>
              <button type="button" className="btn btn-pri btn-sm self-start" disabled={!!busy || !cfp.ready || !siteIdOk(sb.site) || !email.includes("@")} onClick={setupCf}>{busy === "cfsetup" ? (step?.detail || "Setting up") + "…" : "Set up on Cloudflare"}</button>
            </> : <p className="flex flex-wrap items-center gap-2 text-[13px] text-ink-300"><span className="h-2 w-2 rounded-full bg-emerald-400" />Site <b className="text-ink-100">{cfSite.site}</b> in the database at <code className="font-mono text-xs">{cfSite.api}</code>.</p>}
            {cfSite && (cfSigned ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className={`h-2 w-2 rounded-full ${cfAccess === "ok" ? "bg-emerald-400" : "bg-amber-400"}`} />
                <span>Signed in as <b>{cfSigned}</b>{cfAccess === "ok" ? " · can edit this site" : " · not an editor of this site"}</span>
                <button type="button" className="btn btn-sm ml-auto" disabled={!!busy} onClick={() => run("check", () => cfCheck())}>Check access</button>
              </div>
            ) : (
              <div className="flex flex-wrap items-end gap-2">
                <button type="button" className="btn btn-sm" disabled={!!busy || !email.includes("@")} onClick={cfSend}>{busy === "send" ? "Sending…" : codeSent ? "Send a new code" : "Email me a sign-in code"}</button>
                {codeSent && <><input aria-label="Code from the email" className="input w-32 font-mono" inputMode="numeric" maxLength={10} placeholder="123456" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
                  <button type="button" className="btn btn-pri btn-sm" disabled={!!busy || code.length < 6} onClick={cfVerify}>{busy === "verify" ? "Checking…" : "Sign in"}</button></>}
              </div>
            ))}
          </div>
        ) : <>
        {!demo && <SupabaseAuto nf={nf} studioToken={session.token} site={sb.site} email={email} defaultOpen={!sbReady} onFill={(url, key) => { setSb((x) => ({ ...x, url, key })); setManual(false); }} />}
        {sbReady && !manual && <p className="flex flex-wrap items-center gap-2 text-[13px] text-ink-300"><span className="h-2 w-2 rounded-full bg-emerald-400" />Project <code className="font-mono text-xs">{cleanUrl(sb.url)}</code> and its public key are filled in.<button type="button" className="text-brand-300 underline" onClick={() => setManual(true)}>Change by hand</button></p>}
        {!manual ? (!sbReady && <button type="button" className="self-start text-[13px] text-brand-300 underline" onClick={() => setManual(true)}>Or enter the details by hand</button>) : (
        <div className="flex flex-col gap-3 rounded-lg border border-ink-700 p-3" aria-label="Enter by hand">
          <div className="flex items-center gap-2"><b className="text-[13px] text-ink-100">By hand</b><button type="button" className="ml-auto text-[13px] text-brand-300 underline" onClick={() => setManual(false)}>Hide</button></div>
          <p className="text-[13px] text-ink-400"><a className="text-brand-300 underline" href={SB_NEW} target="_blank" rel="noopener noreferrer">Create a free project ↗</a>, then copy the values from <b>Project Settings → API</b>.</p>
        <div className="grid gap-3">
          <Field label="Project URL" htmlFor="sb-url" warn={sb.url && !sbUrlOk(sb.url) ? "Like https://abcd.supabase.co" : undefined}><input id="sb-url" className="input" inputMode="url" placeholder="https://abcd.supabase.co" value={sb.url} onChange={(e) => setSb({ ...sb, url: e.target.value })} /></Field>
        </div>
        <Field label="anon public key" htmlFor="sb-key" hint="The public key (never the service_role key). It's safe in a website: the setup SQL's rules decide what it can do."><input id="sb-key" className="input font-mono text-xs" autoComplete="off" value={sb.key} onChange={(e) => setSb({ ...sb, key: e.target.value })} /></Field>
        <div className="flex flex-col gap-2 rounded-lg border border-ink-700 p-3 text-[13px] text-ink-300">
          <b className="text-ink-100">Once per Supabase project </b>
          <ol className="list-decimal space-y-1 pl-4">
            <li>Run the setup SQL in <b>SQL Editor</b> (run it again for each new site or editor email).</li>
            <li>In <b>Authentication → Emails → Magic Link</b>, put <code className="font-mono">{"{{ .Token }}"}</code> in the message, so sign-in emails carry a 6-digit code.</li>
          </ol>
          <div className="flex gap-2"><button type="button" className="btn btn-sm" onClick={() => setShowSql(!showSql)}>{showSql ? "Hide setup SQL" : "Show setup SQL"}</button><button type="button" className="btn btn-sm" disabled={!email.includes("@") || !siteIdOk(sb.site)} onClick={() => copy(sql, toast)}>Copy setup SQL</button></div>
          {showSql && <textarea readOnly aria-label="Setup SQL" className="input h-48 font-mono text-[11px]" value={sql} />}
        </div>
        </div>)}
        {sbReady && (signed ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className={`h-2 w-2 rounded-full ${access === "ok" ? "bg-emerald-400" : access === "no" ? "bg-amber-400" : "bg-ink-400"}`} />
            <span>Signed in to Supabase as <b>{signed}</b>{access === "ok" ? " · can edit this site" : access === "no" ? " · not an editor of this site yet" : ""}</span>
            <button type="button" className="btn btn-sm ml-auto" disabled={!!busy} onClick={() => run("check", check)}>{busy === "check" ? "Checking…" : "Check access"}</button>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <button type="button" className="btn btn-sm" disabled={!!busy || !email.includes("@")} onClick={send}>{busy === "send" ? "Sending…" : codeSent ? "Send a new code" : "Email me a sign-in code"}</button>
            {codeSent && <><input aria-label="Code from the email" className="input w-32 font-mono" inputMode="numeric" maxLength={10} placeholder="123456" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
              <button type="button" className="btn btn-pri btn-sm" disabled={!!busy || code.length < 6} onClick={verify}>{busy === "verify" ? "Checking…" : "Sign in"}</button></>}
          </div>
        ))}
        </>}
      </section>

      {host && <Toggle id="hd-content" label="Replace the site's content with this version" checked={withContent} onChange={setWithContent} />}
      {host && <p className="hint">{withContent ? "Overwrites the live content in the database, including edits made in the site's own CMS. Photos it already has aren't uploaded again." : "Updates pages, design code and the CMS only. Content edited in the site's own CMS is kept."}</p>}
      <Field label="Version note (optional)" htmlFor="hd-note"><input id="hd-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      {step && (
        <ol className="flex flex-col gap-1 rounded-lg border border-brand-500/40 bg-ink-950 p-3 text-[13px]" aria-live="polite">
          {step.i < 0 && <li>{step.detail}</li>}
          {stepsFor(pagesKind).map((s, i) => <li key={s} className={i < step.i ? "text-emerald-300" : i === step.i ? "text-ink-100" : "text-ink-500"}>{i < step.i ? "✓" : i === step.i ? "…" : "·"} {s}{i === step.i && step.detail ? ` (${step.detail})` : ""}</li>)}
        </ol>
      )}
      {!pagesOk || !dbOk ? (
        <div className="rounded-lg border border-amber-400/40 bg-amber-400/5 px-3 py-2.5 text-[13px] text-amber-100" role="status">
          <b>Publish is waiting for:</b>
          <ul className="mt-1 space-y-0.5">
            {pagesKind === "netlify" ? <li>{nf ? "✓" : "✗"} Netlify connected on this device{nf ? "" : " (section 1: paste your Netlify token)"}</li>
              : <li>{cfAcc.ready ? "✓" : "✗"} Cloudflare connected on this device{cfAcc.ready ? "" : cfAcc.helper.ready ? " (section 1: paste your Cloudflare token)" : " (section 1: deploy the Studio's helper, then paste your Cloudflare token)"}</li>}
            {dbKind === "cloudflare" ? <>
            <li>{cfSite ? "✓" : "✗"} The site's database on Cloudflare{cfSite ? "" : " (section 2: token, Resend key, then Set up on Cloudflare)"}</li>
            <li>{cfAccess === "ok" ? "✓" : "✗"} {cfSigned ? (cfAccess === "ok" ? `Signed in as ${cfSigned}` : `Signed in as ${cfSigned}, but that email isn't an editor of this site`) : "Signed in to the database on this device (section 2: email me a sign-in code)"}</li>
            </> : <>
            <li>{sbReady ? "✓" : "✗"} Supabase details{sbReady ? "" : " (section 2: Project URL with nothing after .supabase.co, the anon key, and the Site ID)"}</li>
            <li>{access === "ok" ? "✓" : "✗"} {signed ? (access === "no" ? `Signed in as ${signed}, but that email isn't an editor of this site: run the setup SQL with it` : access === "error" ? `Couldn't check your access: ${accessErr}` : `Signed in as ${signed}, checking access…`) : "Signed in to Supabase on this device (section 2: email me a sign-in code). Each browser signs in once."}</li>
            </>}
          </ul>
        </div>
      ) : null}

      {host && !moving && host.kind === "netlify" && nf && <DomainCard host={host} nf={nf} onHost={async (h) => onIndex(await studio.updateMeta(project.id, { host: h }, "Update the site's domain"))} />}
      {host && !moving && host.kind === "cloudflare" && cfAcc.ready && <CfDomainCard host={host} acc={cfAcc} onHost={async (h) => onIndex(await studio.updateMeta(project.id, { host: h }, "Update the site's domain"))} />}
    </Modal>
  );
}

function DomainCard({ host, nf, onHost }: { host: HostCfg; nf: Netlify; onHost: (h: HostCfg) => Promise<void> }) {
  const toast = useToast();
  const [d, setD] = useState(host.domain || "");
  const [busy, setBusy] = useState("");
  const [dns, setDns] = useState<{ apex: boolean; www: boolean; seen: { apex: string[]; www: string[] } } | null>(null);
  const netlifyHost = `${host.siteName}.netlify.app`;
  const recs: DnsRecord[] = host.domain ? dnsRecords(host.domain, netlifyHost) : [];
  const run = async (k: string, fn: () => Promise<void>) => { setBusy(k); try { await fn(); } catch (e: any) { toast(e?.message || "Something went wrong", "bad"); } setBusy(""); };
  const connect = () => run("connect", async () => {
    const dom = cleanDomain(d);
    await nf.setDomain(host.siteId, dom);
    await onHost({ ...host, domain: dom });
    setDns(null);
    toast("Domain added on Netlify. Now add the DNS records below where you bought the domain.");
  });
  const check = () => run("check", async () => {
    const r = await checkDns(host.domain!, netlifyHost);
    setDns(r);
    if (r.apex && r.www) { await nf.provisionSsl(host.siteId); toast("DNS is right. Netlify is turning on HTTPS; it can take up to an hour."); }
  });
  const remove = () => run("remove", async () => { await nf.removeDomain(host.siteId); await onHost({ ...host, domain: undefined }); setD(""); setDns(null); toast("Domain removed. The site is back on its netlify.app address."); });
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-ink-700 bg-ink-950 p-4" aria-label="Domain">
      <b className="text-sm">3 · Your domain (optional)</b>
      {!host.domain ? (
        <>
          <p className="text-[13px] text-ink-400">Buy a domain from any registrar (GoDaddy, Namecheap, Cloudflare, Google…), then connect it here. The site stays on {netlifyHost} until the DNS is set.</p>
          <div className="flex gap-2">
            <input aria-label="Domain" className="input min-w-0 flex-1" placeholder="yourname.com" value={d} onChange={(e) => setD(e.target.value)} />
            <button type="button" className="btn btn-pri btn-sm" disabled={!!busy || !domainOk(d)} onClick={connect}>{busy === "connect" ? "Connecting…" : "Connect domain"}</button>
          </div>
        </>
      ) : (
        <>
          <p className="text-[13px] text-ink-300">At your domain registrar, open the DNS settings for <b>{host.domain}</b> and add these records (remove other A or CNAME records for @ and www):</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="text-ink-400"><tr><th className="py-1 pr-3">Type</th><th className="py-1 pr-3">Name / host</th><th className="py-1 pr-3">Value</th><th /></tr></thead>
              <tbody>{recs.map((r) => (
                <tr key={r.host} className="border-t border-ink-700 align-top">
                  <td className="py-2 pr-3 font-mono">{r.type}</td><td className="py-2 pr-3 font-mono">{r.host}</td>
                  <td className="py-2 pr-3"><span className="font-mono">{r.value}</span>{r.alt && <span className="block text-xs text-ink-400">{r.alt}</span>}</td>
                  <td className="py-2"><button type="button" className="btn btn-sm" onClick={() => copy(r.value, toast)}>Copy</button></td>
                </tr>))}
              </tbody>
            </table>
          </div>
          {dns && (
            <ul className="text-[13px]">
              <li className={dns.apex ? "text-emerald-300" : "text-amber-200"}>{dns.apex ? "✓" : "✗"} {host.domain} {dns.apex ? "points to Netlify" : `doesn't point to Netlify yet${dns.seen.apex.length ? ` (now: ${dns.seen.apex.join(", ")})` : ""}`}</li>
              <li className={dns.www ? "text-emerald-300" : "text-amber-200"}>{dns.www ? "✓" : "✗"} www.{host.domain} {dns.www ? "points to Netlify" : `doesn't point to Netlify yet${dns.seen.www.length ? ` (now: ${dns.seen.www.join(", ")})` : ""}`}</li>
              {!(dns.apex && dns.www) && <li className="mt-1 text-ink-400">DNS changes can take from a few minutes to a few hours to show. Check again later.</li>}
              {dns.apex && dns.www && <li className="mt-1 text-ink-300">All set. Publish once more so links and share previews use https://www.{host.domain}/.</li>}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-pri btn-sm" disabled={!!busy} onClick={check}>{busy === "check" ? "Checking…" : "Check DNS"}</button>
            <a className="btn btn-sm" href={`https://www.${host.domain}/`} target="_blank" rel="noopener">Open https://www.{host.domain} ↗</a>
            <button type="button" className="btn btn-sm ml-auto" disabled={!!busy} onClick={remove}>{busy === "remove" ? "Removing…" : "Remove domain"}</button>
          </div>
        </>
      )}
    </section>
  );
}

/** Your own domain on a Cloudflare-hosted site: the domain's DNS is on the same Cloudflare account, so the Studio
 *  attaches it to the site's Worker (Cloudflare adds the DNS records and HTTPS by itself). */
function CfDomainCard({ host, acc, onHost }: { host: HostCfg; acc: CfAccountHook; onHost: (h: HostCfg) => Promise<void> }) {
  const toast = useToast();
  const [d, setD] = useState(host.domain || ""), [busy, setBusy] = useState(""), [err, setErr] = useState("");
  const account = host.account || acc.account?.id || "";
  const run = async (k: string, fn: () => Promise<void>) => { setBusy(k); setErr(""); try { await fn(); } catch (e: any) { setErr(e instanceof CfError && (e.status === 403 || e.status === 401) ? CF_DOMAIN_HINT : e?.message || "Something went wrong"); } setBusy(""); };
  const connect = () => run("connect", async () => {
    const dom = cleanDomain(d), { cf } = await acc.client();
    const zone = await cf.zoneFor(dom);
    if (!zone) throw new Error(`Couldn't find ${dom} on your Cloudflare account. If it isn't there yet, add it (free): Cloudflare dashboard → Add a domain, then change its nameservers where you bought it, and press Connect again once Cloudflare shows it as active. If it is there, ${CF_DOMAIN_HINT.charAt(0).toLowerCase() + CF_DOMAIN_HINT.slice(1)}`);
    for (const hn of [dom, "www." + dom]) await cf.addWorkerDomain(account, host.siteId, hn, zone.id);
    await onHost({ ...host, domain: dom });
    toast(`Connected. Cloudflare is turning on HTTPS for ${dom}; it takes a few minutes. Publish once more so links use https://www.${dom}/.`);
  });
  const remove = () => run("remove", async () => {
    const { cf } = await acc.client(), dom = host.domain!;
    for (const x of await cf.workerDomains(account, host.siteId)) if (x.hostname === dom || x.hostname === "www." + dom) await cf.removeWorkerDomain(account, x.id);
    await onHost({ ...host, domain: undefined }); setD("");
    toast("Domain removed. The site is back on its workers.dev address.");
  });
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-ink-700 bg-ink-950 p-4" aria-label="Domain">
      <b className="text-sm">3 · Your domain (optional)</b>
      {!host.domain ? <>
        <p className="text-[13px] text-ink-400">Your domain's DNS needs to be on Cloudflare (free; <a className="text-brand-300 underline" href="https://dash.cloudflare.com/?to=/:account/add-site" target="_blank" rel="noopener noreferrer">add a domain ↗</a> and switch its nameservers where you bought it). Then the Studio connects it, with www, and Cloudflare adds the records and HTTPS itself.</p>
        <div className="flex gap-2">
          <input aria-label="Domain" className="input min-w-0 flex-1" placeholder="yourname.com" value={d} onChange={(e) => setD(e.target.value)} />
          <button type="button" className="btn btn-pri btn-sm" disabled={!!busy || !domainOk(d)} onClick={connect}>{busy === "connect" ? "Connecting…" : "Connect domain"}</button>
        </div>
      </> : <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <span className="h-2 w-2 rounded-full bg-emerald-400" /><span>Live on <b>{host.domain}</b> and <b>www.{host.domain}</b></span>
        <a className="btn btn-sm" href={`https://www.${host.domain}/`} target="_blank" rel="noopener">Open ↗</a>
        <button type="button" className="btn btn-sm ml-auto" disabled={!!busy} onClick={remove}>{busy === "remove" ? "Removing…" : "Remove domain"}</button>
      </div>}
      {err && <p role="alert" className="text-[13px] text-red-300">{err}</p>}
    </section>
  );
}
