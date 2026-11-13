// Business sites → "Enquiry inbox": the enquiry form saves each enquiry as a JSON file in a private GitHub
// repository, through a small Worker on the user's Cloudflare or a function on their Netlify. No email is sent. Enquiries show under Enquiries.
import { useEffect, useRef, useState } from "react";
import type { Session } from "../lib/auth";
import type { ProjectMeta, Studio, StudioIndex } from "../lib/studio";
import { ensureRepo, ghPublish } from "../lib/ghpublish";
import { netlifyToken, siteAddress } from "../lib/hosting";
import { Netlify } from "../lib/netlify";
import { setupInbox } from "../lib/inbox";
import { Field, Modal, Spinner, useToast } from "../ui/kit";
import { NetlifyAccount } from "./HostDialog";
import { useCfAccount } from "./CfPicker";

type Props = { session: Session; studio: Studio; project: ProjectMeta; onConnect: (url: string) => Promise<void>; onIndex: (i: StudioIndex) => void; onClose: () => void };
type Step = "todo" | "busy" | "done" | "error";

const slug = (s: string) => String(s || "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
const ghPages = (t: { owner: string; repo: string }) => `https://${t.owner}.github.io/${t.repo.toLowerCase() === `${t.owner}.github.io`.toLowerCase() ? "" : t.repo + "/"}`;
const origin = (u: string) => { try { return new URL(u.trim()).origin; } catch { return ""; } };
const tokenLink = (owner: string, repo: string) => `https://github.com/settings/personal-access-tokens/new?${new URLSearchParams({ name: `${repo} inbox`.slice(0, 40), description: `Lets the website's enquiry form save enquiries in ${owner}/${repo}. Repository access: only ${repo}.`, target_name: owner, expires_in: "366", contents: "write" })}`;

/** Addresses the live site answers at: its GitHub Pages address and/or Netlify address and domain. */
export function siteOrigins(p: ProjectMeta): string[] {
  const out = new Set<string>();
  if (p.publish) out.add(origin(ghPages(p.publish)));
  if (p.host) { out.add(origin(siteAddress(p.host))); out.add(origin(p.host.url)); if (p.host.domain) out.add(`https://${p.host.domain.replace(/^www\./, "")}`); }
  out.delete("");
  return [...out];
}

export function EnquiryInboxDialog({ session, studio, project, onConnect, onIndex, onClose }: Props) {
  const toast = useToast();
  const prev = project.inbox;
  const owner = ghPublish.login() || session.cfg.owner;
  const [nf, setNf] = useState<Netlify | null | undefined>(undefined);
  useEffect(() => { netlifyToken.load(session.token).then((t) => setNf(t ? new Netlify(t.token) : null)); }, [session.token]);
  const [where, setWhere] = useState<"cloudflare" | "netlify">(prev ? prev.kind || "netlify" : "cloudflare");
  const cfAcc = useCfAccount(session.token, nf, true);
  const hostOk = where === "netlify" ? !!nf : cfAcc.ready;

  const [repoName, setRepoName] = useState(prev?.repo?.split("/")[1] || `${slug(project.publish?.repo || project.name) || "site"}-enquiries`);
  const repo = `${owner}/${repoName}`;
  const [repoState, setRepoState] = useState<Step>(prev ? "done" : "todo"), [repoMsg, setRepoMsg] = useState("");
  const makeRepo = async () => {
    setRepoState("busy"); setRepoMsg("");
    try { const created = await ensureRepo(ghPublish.token(session.token), owner, repoName, "Enquiries from the website's form (private, one JSON file per enquiry).", true); setRepoState("done"); setRepoMsg(created ? `Created ${repo} (private).` : `${repo} is ready (private).`); }
    catch (e: any) { setRepoState("error"); setRepoMsg(e?.message || "Couldn't create the repository."); }
  };

  const [tok, setTok] = useState("");
  const [origins, setOrigins] = useState((prev?.origins?.filter((o) => o !== location.origin) || siteOrigins(project)).join(", "));
  const list = origins.split(/[,\s]+/).map(origin).filter(Boolean);
  const made = useRef<{ siteId: string; url: string } | null>(null); // a site made by an attempt that then failed
  const [busy, setBusy] = useState(""), [err, setErr] = useState(""), [done, setDone] = useState<string | null>(null);
  const ready = hostOk && repoState === "done" && tok.trim().length > 20 && list.length > 0;
  const missing = [!hostOk && (where === "netlify" ? "Netlify" : "Cloudflare"), repoState !== "done" && "the private repository", tok.trim().length <= 20 && "the inbox token", !list.length && "the website's address"].filter(Boolean) as string[];

  const deploy = async () => {
    setErr(""); setBusy("Starting");
    try {
      const siteRepos = project.publish ? [`${project.publish.owner}/${project.publish.repo}`] : [];
      let target: Parameters<typeof setupInbox>[0];
      if (where === "netlify") { if (!nf) throw new Error("Connect Netlify first."); target = { kind: "netlify", nf }; }
      else { const c = await cfAcc.client(setBusy); target = { kind: "cloudflare", cf: c.cf, account: prev?.kind === "cloudflare" && prev.account ? prev.account : c.account.id, accountName: c.account.name }; }
      const cfg = await setupInbox(target, { token: tok.trim(), repo, siteRepos, origins: [...new Set([...list, location.origin])], name: project.publish?.repo || project.name }, prev && (prev.kind || "netlify") === where ? prev : made.current, setBusy, (s) => (made.current = s));
      setBusy("Connecting the form");
      await onConnect(cfg.url);
      onIndex(await studio.updateMeta(project.id, { inbox: cfg }, "Set up the enquiry inbox"));
      setDone(cfg.url); toast("Enquiry inbox ready");
    } catch (e: any) { setErr(e?.message || "Something went wrong."); }
    setBusy("");
  };

  const footer = done ? <button className="btn btn-pri" onClick={onClose}>Done</button>
    : <><button className="btn" onClick={onClose} disabled={!!busy}>Close</button>
      <button className="btn btn-pri" disabled={!ready || !!busy} title={missing.length ? "Still needed: " + missing.join(", ") : ""} onClick={deploy}>{busy ? busy + "…" : prev ? "Update the inbox" : "Set up the inbox"}</button></>;

  return (
    <Modal title="Enquiry inbox: save enquiries as JSON files" wide onClose={() => !busy && onClose()} footer={footer}>
      <p className="text-sm text-ink-300">The enquiry form saves each enquiry as a JSON file in a <b className="text-ink-100">private GitHub repository</b>. No email is sent to anyone. Enquiries show under <b className="text-ink-100">Enquiries</b> here and in the site's admin page, where you can mark, reply, export or delete them.</p>
      <p className="text-[13px] text-ink-400">A web page can't write to GitHub without a key, and the key mustn't be in the site, so a tiny Worker on your Cloudflare (free) or a function on your Netlify receives the form and saves it. Its token can only write the one repository.</p>
      {prev && !done && <p className="rounded-lg border border-emerald-400/30 bg-emerald-400/5 px-3 py-2.5 text-[13px] text-emerald-100">Connected to {prev.repo}. To change anything, paste a token again and press Update the inbox.</p>}

      <section aria-label="Where the inbox runs" className="flex flex-col gap-2 rounded-xl border border-ink-700 p-4">
        <h3 className="text-[15px] font-extrabold">1 · Where the inbox runs</h3>
        <div className="flex flex-wrap rounded-lg border border-ink-600 self-start" role="radiogroup" aria-label="Inbox host">
          {([["cloudflare", "Cloudflare (free)"], ["netlify", "Netlify"]] as const).map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={where === k} onClick={() => setWhere(k)} className={`btn btn-sm border-0 ${where === k ? "bg-ink-700" : "bg-transparent"}`}>{l}</button>)}
        </div>
        {where === "cloudflare" ? (cfAcc.account ? <p className="text-sm text-emerald-300">Cloudflare connected: {cfAcc.account.name}.</p> : cfAcc.ui)
          : nf === undefined ? <Spinner label="Checking Netlify…" /> : nf ? <p className="text-sm text-emerald-300">Connected.</p> : <NetlifyAccount session={session} onToken={(t) => setNf(t ? new Netlify(t) : null)} />}
      </section>

      <section aria-label="Private repository" className="flex flex-col gap-3 rounded-xl border border-ink-700 p-4">
        <h3 className="text-[15px] font-extrabold">2 · Private repository for enquiries</h3>
        <div className="flex flex-wrap items-end gap-2">
          <Field label={`Repository (${owner}/…)`} htmlFor="ib-repo"><input id="ib-repo" className="input w-64 font-mono" value={repoName} disabled={repoState === "done"} onChange={(e) => setRepoName(slug(e.target.value))} /></Field>
          {repoState !== "done" && <button type="button" className="btn btn-sm" disabled={repoState === "busy" || !repoName || !ghPublish.login()} onClick={makeRepo}>{repoState === "busy" ? "Creating…" : "Create it (private)"}</button>}
        </div>
        {!ghPublish.login() && <p className="text-[13px] text-amber-200">Connect the GitHub publishing token first (Settings → Hosting accounts), or create the private repository on GitHub yourself.</p>}
        {repoMsg && <p role="status" className={`text-[13px] ${repoState === "error" ? "text-red-300" : "text-emerald-300"}`}>{repoMsg}</p>}
        <p className="text-[13px] text-ink-300">The inbox needs its own token that can only reach this repository. <a className="text-brand-300 underline" href={tokenLink(owner, repoName)} target="_blank" rel="noopener noreferrer">Open GitHub's token page, already filled in ↗</a>. There, under <b>Repository access</b>, choose <b>Only select repositories → {repoName}</b>, then Generate and copy.</p>
        <input aria-label="The inbox's GitHub token" className="input font-mono" type="password" autoComplete="off" placeholder={prev ? "Paste a token to update the inbox" : "github_pat_…"} value={tok} onChange={(e) => setTok(e.target.value)} />
        <p className="text-[12.5px] text-ink-400">It's put in the inbox on your {where === "cloudflare" ? "Cloudflare (as a secret)" : "Netlify"} only: not in the site, its content or any repository, and not kept by the Studio.</p>
      </section>

      <section aria-label="Website address" className="flex flex-col gap-2 rounded-xl border border-ink-700 p-4">
        <h3 className="text-[15px] font-extrabold">3 · Website address</h3>
        <Field label="The inbox accepts enquiries only from" htmlFor="ib-orig" hint="Comma-separated. Add your own domain here if you connect one later, then update the inbox."><input id="ib-orig" className="input" value={origins} onChange={(e) => setOrigins(e.target.value)} placeholder="https://yourname.github.io" /></Field>
        {!list.length && <p className="text-[13px] text-amber-200">Publish the site first, or type its address.</p>}
      </section>

      {!ready && !busy && !done && <p className="text-[13px] text-ink-400">Still needed: {missing.join(", ")}.</p>}
      {err && <p role="alert" className="text-sm text-red-300">{err}</p>}
      {done && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-400/5 p-3 text-sm text-emerald-100">
          <p className="font-semibold">✓ The inbox is ready and can save to {repo}.</p>
          <p className="text-ink-300">The form is now set to <b className="text-ink-100">Save to a JSON file</b>. <b className="text-ink-100">Publish</b> the site to put it live; enquiries then appear under Enquiries.</p>
        </div>
      )}
    </Modal>
  );
}
