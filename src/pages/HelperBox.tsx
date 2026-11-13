// The Studio's helper: the small go-between for Cloudflare's, Resend's, Stripe's and Supabase's APIs (they don't
// accept calls from web pages). It runs on the user's Cloudflare (a Worker deployed with one button, then its
// address pasted here) or, when Netlify is connected, as a function on their Netlify (set up by itself).
import { useEffect, useState } from "react";
import type { Netlify } from "../lib/netlify";
import { CF_HELPER_DEPLOY, HelperClaimed, connectCfHelper, getHelper, helperOk, relayVault, type Relay } from "../lib/relay";
import { cfAccountVault } from "../lib/cfdb";

export function useHelper(studioToken: string, nf: Netlify | null | undefined, what = "Cloudflare") {
  const [relay, setRelay] = useState<Relay | null | undefined>(undefined);
  const [addr, setAddr] = useState(""), [cfTok, setCfTok] = useState(""), [needTok, setNeedTok] = useState(false);
  const [busy, setBusy] = useState(false), [err, setErr] = useState("");
  useEffect(() => { relayVault.load(studioToken).then(setRelay); }, [studioToken]);
  const ok = helperOk(relay);
  const connect = async () => {
    setErr(""); setBusy(true);
    try {
      const saved = cfTok.trim() || (await cfAccountVault.load(studioToken))?.token || "";
      try { setRelay(await connectCfHelper(addr, studioToken)); }
      catch (e) { if (!(e instanceof HelperClaimed)) throw e; if (!saved) { setNeedTok(true); throw e; } setRelay(await connectCfHelper(addr, studioToken, saved)); }
      setNeedTok(false);
    } catch (e: any) { setErr(e?.message || "Couldn't connect the helper."); }
    setBusy(false);
  };
  /** The helper, set up on Netlify by itself when that's how this device works. */
  const get = async (step?: (s: string) => void) => { const r = await getHelper(studioToken, nf, step, what); setRelay(r); return r; };

  const ui = relay === undefined ? null : ok ? null : nf && relay?.kind !== "cloudflare" ? null : (
    <div className="flex flex-col gap-2 rounded-lg border border-ink-700 p-3 text-[13px]" aria-label="Studio helper">
      <b className="text-ink-100">The Studio's helper (once)</b>
      <p className="text-ink-400">{what} doesn't accept requests straight from a web page, so the Studio passes them through a small helper Worker on your Cloudflare (free). It keeps none of your keys.</p>
      <ol className="list-decimal space-y-2 pl-5 text-ink-300">
        <li><a className="btn btn-sm btn-pri" href={CF_HELPER_DEPLOY} target="_blank" rel="noopener noreferrer">Deploy the helper to Cloudflare ↗</a> <span className="text-ink-400">Sign in, keep the suggested names and press <b>Create and deploy</b>. Cloudflare puts a copy in a new repository on your GitHub.</span></li>
        <li>When it's done, copy the Worker's address (<code className="font-mono text-xs">https://picaffectz-helper.<i>you</i>.workers.dev</code>) and paste it here:
          <div className="mt-1.5 flex gap-2">
            <input aria-label="Helper address" className="input min-w-0 flex-1 font-mono text-xs" inputMode="url" placeholder="https://picaffectz-helper.you.workers.dev" value={addr} onChange={(e) => setAddr(e.target.value)} />
            <button type="button" className="btn btn-sm" disabled={busy || !addr.trim()} onClick={connect}>{busy ? "Connecting…" : "Connect"}</button>
          </div>
        </li>
      </ol>
      {needTok && <input aria-label="Cloudflare API token for the helper" className="input font-mono text-xs" type="password" autoComplete="off" placeholder="Cloudflare API token" value={cfTok} onChange={(e) => setCfTok(e.target.value)} />}
      {err && <p role="alert" className="text-red-300">{err}</p>}
      {!nf && <p className="text-ink-500">Prefer Netlify? Connect it in Settings → Hosting accounts and the Studio puts the helper there by itself.</p>}
    </div>
  );
  return { relay: ok ? relay! : null, ready: ok || (!!nf && relay?.kind !== "cloudflare"), ui, get };
}

/** Settings → Hosting accounts: where the helper is, with a way to set it up on Cloudflare or forget it. */
export function HelperStatus({ studioToken, nf }: { studioToken: string; nf: Netlify | null }) {
  const h = useHelper(studioToken, nf);
  const [shown, setShown] = useState<Relay | null | undefined>(undefined);
  useEffect(() => { relayVault.load(studioToken).then(setShown); }, [studioToken, h.relay]);
  if (shown === undefined) return null;
  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${helperOk(shown) ? "bg-emerald-400" : "bg-ink-500"}`} />
        <span>Studio helper: {shown ? <><b>{shown.kind === "cloudflare" ? "Cloudflare" : "Netlify"}</b> · <a className="text-brand-300 underline" href={shown.url} target="_blank" rel="noopener noreferrer">{shown.url.replace(/^https:\/\//, "")}</a></> : <span className="text-ink-400">not set up</span>}</span>
        {shown && <button type="button" className="btn btn-sm ml-auto" onClick={() => { relayVault.clear(); setShown(null); location.reload(); }} title="Forget it on this device. Delete the Worker (or Netlify site) to remove it completely.">Forget</button>}
      </div>
      {!shown && h.ui}
    </div>
  );
}
