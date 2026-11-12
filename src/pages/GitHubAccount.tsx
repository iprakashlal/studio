import { useEffect, useState } from "react";
import type { Session } from "../lib/auth";
import { GH_CLASSIC_TOKEN_PAGE, GH_TOKEN_PAGE, ghPublish, ghWhoAmI } from "../lib/ghpublish";
import { Field, Spinner, useToast } from "../ui/kit";

/** The GitHub token used to create site repositories and publish them, kept on this device. */
export function GitHubPublishAccount({ session, onLogin }: { session: Session; onLogin?: (login: string | null) => void }) {
  const toast = useToast();
  const [who, setWho] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(false);
  useEffect(() => {
    ghPublish.load(session.token).then((t) => { setWho(t ? t.login : null); setLoaded(true); onLogin?.(t ? t.login : null); });
  }, [session.token]);
  const connect = async () => {
    setBusy(true);
    try {
      const me = await ghWhoAmI(val.trim());
      await ghPublish.save(val.trim(), session.token, me.login);
      setWho(me.login); setVal(""); onLogin?.(me.login);
      toast(`Publishing as @${me.login} on this device`);
    } catch (e: any) { toast(e?.message || "Couldn't check that token", "bad"); }
    setBusy(false);
  };
  if (!loaded) return <Spinner label="Checking GitHub…" />;
  if (who) return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="h-2 w-2 rounded-full bg-emerald-400" /><span>Publishing as <b>@{who}</b></span>
      <button type="button" className="btn btn-sm ml-auto" onClick={() => { ghPublish.clear(); setWho(null); onLogin?.(null); }}>Disconnect</button>
    </div>
  );
  return (
    <div className="flex flex-col gap-2">
      <Field label="GitHub token for publishing" htmlFor="gh-pub-token" hint="Kept on this device only, encrypted with your Studio login. Used to create each site's repository, publish it and turn on GitHub Pages.">
        <div className="flex gap-2">
          <input id="gh-pub-token" className="input min-w-0 flex-1 font-mono" type="password" autoComplete="off" value={val} onChange={(e) => setVal(e.target.value)} placeholder="github_pat_… or ghp_…" />
          <button type="button" className="btn btn-pri btn-sm" disabled={busy || val.trim().length < 20} onClick={connect}>{busy ? "Checking…" : "Connect"}</button>
        </div>
      </Field>
      <p className="text-[13px] text-ink-400">
        <a className="text-brand-300 underline" href={GH_TOKEN_PAGE} target="_blank" rel="noopener noreferrer">Create a token on GitHub ↗</a>{" · "}
        <button type="button" className="text-brand-300 underline" onClick={() => setHelp(!help)}>{help ? "Hide steps" : "Which settings?"}</button>
      </p>
      {help && (
        <ol className="list-decimal space-y-1 rounded-lg border border-ink-700 p-3 pl-7 text-[13px] text-ink-300">
          <li>Token name: <i>Picaffectz Studio publishing</i>. Pick an expiry (for example 1 year).</li>
          <li>Repository access: <b>All repositories</b> (so the Studio can create new ones).</li>
          <li>Repository permissions: <b>Administration</b>, <b>Contents</b> and <b>Pages</b>: Read and write.</li>
          <li>Generate, copy the token (starts with <code>github_pat_</code>) and paste it here.</li>
          <li>Prefer a classic token? <a className="text-brand-300 underline" href={GH_CLASSIC_TOKEN_PAGE} target="_blank" rel="noopener noreferrer">This link ↗</a> pre-selects the one scope needed (repo).</li>
        </ol>
      )}
    </div>
  );
}
