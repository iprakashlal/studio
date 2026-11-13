import { useEffect, useMemo, useState } from "react";
import { SupabaseAuto } from "./SupabaseAuto";
import type { Session } from "../lib/auth";
import type { ProjectMeta, Studio, StudioIndex } from "../lib/studio";
import type { TEMPLATES } from "../schema";
import { explain } from "../lib/repo";
import { slugify } from "../lib/util";
import { Netlify, checkDns, cleanDomain, dnsRecords, domainOk, type DnsRecord } from "../lib/netlify";
import { cleanUrl, isAdmin, sbUrlOk, sendCode, setupSql, signedInEmail, siteIdOk, verifyCode, type HostCfg, type SbCfg } from "../lib/supa";
import { netlifyToken, publishToNetlify, siteAddress } from "../lib/hosting";
import { Field, Modal, Spinner, Toggle, useConfirm, useToast } from "../ui/kit";

const TOKEN_PAGE = "https://app.netlify.com/user/applications#personal-access-tokens";
const SB_NEW = "https://supabase.com/dashboard/new";
const STEPS = ["Upload new photos to Supabase", "Save the content in Supabase", "Deploy the pages to Netlify", "Live"];

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
  const [busy, setBusy] = useState("");
  const [withContent, setWithContent] = useState(true);
  const [note, setNote] = useState("");
  const [step, setStep] = useState<{ i: number; detail?: string } | null>(null);
  const [done, setDone] = useState<{ url: string; admin: string; warnings: string[] } | null>(null);
  const sbReady = sbUrlOk(sb.url) && sb.key.trim().length > 30 && siteIdOk(sb.site);
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

  const publish = () => run("publish", async () => {
    if (!nf) throw new Error("Connect Netlify first.");
    if (dirty && !(await save(true))) return;
    if (!host && !/^[a-z0-9][a-z0-9-]{1,61}$/.test(siteName)) throw new Error("The Netlify site name can use lowercase letters, numbers and dashes.");
    const next = project.version + 1;
    let h: HostCfg;
    if (host) h = { ...host, sb: cfg() };
    else {
      setStep({ i: -1, detail: "Creating the Netlify site…" });
      let s = await nf.getSite(`${siteName}.netlify.app`).catch(() => null);
      if (s && !(await confirm(`Use your Netlify site “${s.name}”?`, "It already exists in your Netlify account. Publishing replaces what it shows with this project.", "Use it"))) { setStep(null); return; }
      if (!s) s = await nf.createSite(siteName);
      h = { kind: "netlify", siteId: s.id, siteName: s.name, url: s.ssl_url || `https://${s.name}.netlify.app`, sb: cfg() };
    }
    try {
      const r = await publishToNetlify({ nf, host: h, tpl, draft, name: project.name, version: next, withContent: !host || withContent, getBlob, note: note.trim(), step: (i, detail) => setStep({ i, detail }) });
      const { index } = await studio.recordExport(project.id, { kind: "netlify", note: note.trim(), target: h.siteName }, draft, "published", undefined, r.siteSha, h);
      onIndex(index);
      setDone({ url: siteAddress(h), admin: r.admin, warnings: r.warnings });
    } catch (e) {
      // Remember a newly created site even if the first deploy failed, so trying again uses it.
      if (!host) { try { onIndex(await studio.updateMeta(project.id, { host: h }, "Link Netlify site")); } catch { /* keep the first error */ } }
      throw e;
    } finally { setStep(null); }
  });

  if (demo) return (
    <Modal title="Host outside GitHub" onClose={onClose} footer={<button className="btn" onClick={onClose}>Close</button>}>
      <p className="rounded-lg border border-amber-400/40 bg-amber-400/5 px-3 py-2.5 text-[13px] text-amber-100">Hosting needs a real Studio login. Exit the demo and connect your repository to use it.</p>
    </Modal>
  );

  if (done) return (
    <Modal title="Live on Netlify" wide onClose={onClose} footer={<button className="btn btn-pri" onClick={onClose}>Done</button>}>
      <ol className="list-decimal space-y-2 pl-5 text-sm text-ink-200">
        <li>The site is live at <a className="font-semibold text-brand-300 underline" href={done.url} target="_blank" rel="noopener">{done.url}</a>.</li>
        <li>Its own CMS is at <a className="font-semibold text-brand-300 underline" href={done.url + done.admin} target="_blank" rel="noopener">{done.url}{done.admin}</a>. The owner signs in there with an email code; only emails listed in <code className="font-mono text-xs">site_admins</code> can edit.</li>
        <li>Edits made in that CMS go live at once and come back into this project, as with GitHub sites.</li>
      </ol>
      {done.warnings.length > 0 && <p className="rounded-lg border border-amber-400/40 bg-amber-400/5 px-3 py-2 text-[13px] text-amber-100">{done.warnings.length} image(s) weren't found: {done.warnings.slice(0, 3).join("; ")}</p>}
      <p className="hint">Want your own address? Open Host outside GitHub again and connect a domain.</p>
    </Modal>
  );

  const sql = setupSql(sb.site || "my-site", email || "you@example.com");
  return (
    <Modal title={host ? "Hosted on Netlify" : "Host outside GitHub"} wide onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Close</button><button className="btn btn-pri" disabled={!!busy || !nf || !sbReady || access !== "ok"} onClick={publish}>{busy === "publish" ? "Publishing…" : host ? `Publish v${project.version + 1}` : `Move the site and publish v${project.version + 1}`}</button></>}>
      {!host && <p className="text-sm text-ink-300">Moves this site off GitHub: <b>Netlify</b> serves the pages, and <b>Supabase</b> holds the content, photos and who can edit. The site keeps its own CMS (with email sign-in), and stays in step with this project.{project.publish ? " The GitHub copy isn't deleted; it simply stops being updated." : ""}</p>}
      {host && <p className="text-sm text-ink-300">Live at <a className="font-semibold text-brand-300 underline" href={siteAddress(host)} target="_blank" rel="noopener">{siteAddress(host)}</a> · Netlify site <b>{host.siteName}</b> · content in Supabase.</p>}

      <section className="flex flex-col gap-3 rounded-xl border border-ink-700 bg-ink-950 p-4" aria-label="Netlify">
        <b className="text-sm">1 · Netlify (hosting)</b>
        <NetlifyAccount session={session} onToken={setToken} />
        <p className="text-[13px] text-ink-400">Netlify's free plan has 300 credits a month for the whole account: each publish from the Studio uses 15 and each GB of visitor traffic 20. When they run out, Netlify pauses the sites until the month resets. Edits made in the site's own CMS use none: they go to Supabase.</p>
        {!host && nf && (
          <Field label="Site name" htmlFor="nf-name" hint={`Address before you add a domain: https://${siteName || "name"}.netlify.app`}>
            <input id="nf-name" className="input" value={siteName} onChange={(e) => setSiteName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} />
          </Field>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-ink-700 bg-ink-950 p-4" aria-label="Supabase">
        <b className="text-sm">2 · Supabase (content, photos and logins)</b>
        <p className="text-[13px] text-ink-400">Use a free project: <a className="text-brand-300 underline" href={SB_NEW} target="_blank" rel="noopener noreferrer">create one ↗</a>, then copy the values from <b>Project Settings → API</b>. One Supabase project can hold several sites. A free project pauses after a week with no activity; restore it from the Supabase dashboard.</p>
        {!demo && <SupabaseAuto nf={nf} studioToken={session.token} site={sb.site} email={email} onFill={(url, key) => setSb((x) => ({ ...x, url, key }))} />}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Project URL" htmlFor="sb-url" warn={sb.url && !sbUrlOk(sb.url) ? "Like https://abcd.supabase.co" : undefined}><input id="sb-url" className="input" inputMode="url" placeholder="https://abcd.supabase.co" value={sb.url} onChange={(e) => setSb({ ...sb, url: e.target.value })} /></Field>
          <Field label="Site ID" htmlFor="sb-site" hint="Names this site's rows and photo folder." warn={sb.site && !siteIdOk(sb.site) ? "Lowercase letters, numbers and dashes" : undefined}><input id="sb-site" className="input" disabled={!!host} value={sb.site} onChange={(e) => setSb({ ...sb, site: e.target.value.toLowerCase() })} /></Field>
        </div>
        <Field label="anon public key" htmlFor="sb-key" hint="The public key (never the service_role key). It's safe in a website: the setup SQL's rules decide what it can do."><input id="sb-key" className="input font-mono text-xs" autoComplete="off" value={sb.key} onChange={(e) => setSb({ ...sb, key: e.target.value })} /></Field>
        <Field label="Your email" htmlFor="sb-email" hint="Becomes the site's first editor. Used for the sign-in code."><input id="sb-email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <div className="flex flex-col gap-2 rounded-lg border border-ink-700 p-3 text-[13px] text-ink-300">
          <b className="text-ink-100">Once per Supabase project (done for you by “Set it all up for me”)</b>
          <ol className="list-decimal space-y-1 pl-4">
            <li>Run the setup SQL in <b>SQL Editor</b> (run it again for each new site or editor email).</li>
            <li>In <b>Authentication → Emails → Magic Link</b>, put <code className="font-mono">{"{{ .Token }}"}</code> in the message, so sign-in emails carry a 6-digit code.</li>
          </ol>
          <div className="flex gap-2"><button type="button" className="btn btn-sm" onClick={() => setShowSql(!showSql)}>{showSql ? "Hide setup SQL" : "Show setup SQL"}</button><button type="button" className="btn btn-sm" disabled={!email.includes("@") || !siteIdOk(sb.site)} onClick={() => copy(sql, toast)}>Copy setup SQL</button></div>
          {showSql && <textarea readOnly aria-label="Setup SQL" className="input h-48 font-mono text-[11px]" value={sql} />}
        </div>
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
      </section>

      {host && <Toggle id="hd-content" label="Replace the site's content with this version" checked={withContent} onChange={setWithContent} />}
      {host && <p className="hint">{withContent ? "Overwrites the live content in Supabase, including edits made in the site's own CMS. Photos it already has aren't uploaded again." : "Updates pages, design code and the CMS only. Content edited in the site's own CMS is kept."}</p>}
      <Field label="Version note (optional)" htmlFor="hd-note"><input id="hd-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      {step && (
        <ol className="flex flex-col gap-1 rounded-lg border border-brand-500/40 bg-ink-950 p-3 text-[13px]" aria-live="polite">
          {step.i < 0 && <li>{step.detail}</li>}
          {STEPS.map((s, i) => <li key={s} className={i < step.i ? "text-emerald-300" : i === step.i ? "text-ink-100" : "text-ink-500"}>{i < step.i ? "✓" : i === step.i ? "…" : "·"} {s}{i === step.i && step.detail ? ` (${step.detail})` : ""}</li>)}
        </ol>
      )}
      {!nf || !sbReady || access !== "ok" ? (
        <div className="rounded-lg border border-amber-400/40 bg-amber-400/5 px-3 py-2.5 text-[13px] text-amber-100" role="status">
          <b>Publish is waiting for:</b>
          <ul className="mt-1 space-y-0.5">
            <li>{nf ? "✓" : "✗"} Netlify connected on this device{nf ? "" : " (section 1: paste your Netlify token)"}</li>
            <li>{sbReady ? "✓" : "✗"} Supabase details{sbReady ? "" : " (section 2: Project URL with nothing after .supabase.co, the anon key, and the Site ID)"}</li>
            <li>{access === "ok" ? "✓" : "✗"} {signed ? (access === "no" ? `Signed in as ${signed}, but that email isn't an editor of this site: run the setup SQL with it` : access === "error" ? `Couldn't check your access: ${accessErr}` : `Signed in as ${signed}, checking access…`) : "Signed in to Supabase on this device (section 2: email me a sign-in code). Each browser signs in once."}</li>
          </ul>
        </div>
      ) : null}

      {host && nf && <DomainCard host={host} nf={nf} onHost={async (h) => onIndex(await studio.updateMeta(project.id, { host: h }, "Update the site's domain"))} />}
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
