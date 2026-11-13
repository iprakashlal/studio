// Settings → Hosting accounts: the Studio's helper on Netlify and the Cloudflare token, as kept on this device.
import { useEffect, useState } from "react";
import type { Session } from "../lib/auth";
import { relayVault, type Relay } from "../lib/relay";
import { cfVault } from "../lib/cloudflare";

export function SetupAccounts({ session }: { session: Session }) {
  const [relay, setRelay] = useState<Relay | null | undefined>(undefined);
  const [cf, setCf] = useState<boolean | undefined>(undefined);
  useEffect(() => { relayVault.load(session.token).then(setRelay); cfVault.load(session.token).then((v) => setCf(!!v?.token)); }, [session.token]);
  if (relay === undefined || cf === undefined) return null;
  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${relay ? "bg-emerald-400" : "bg-ink-500"}`} />
        <span>Studio helper (for Cloudflare and Resend): {relay ? <a className="text-brand-300 underline" href={relay.url} target="_blank" rel="noopener noreferrer">{relay.url.replace(/^https:\/\//, "")}</a> : <span className="text-ink-400">not set up. A shop's <b>Shop backend</b> sets it up when needed.</span>}</span>
        {relay && <button type="button" className="btn btn-sm ml-auto" onClick={() => { relayVault.clear(); setRelay(null); }} title="Forget it on this device. Delete the site in Netlify to remove it completely.">Forget</button>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${cf ? "bg-emerald-400" : "bg-ink-500"}`} />
        <span>Cloudflare: {cf ? "token saved on this device" : <span className="text-ink-400">not connected</span>}</span>
        {cf && <button type="button" className="btn btn-sm ml-auto" onClick={() => { cfVault.clear(); setCf(false); }}>Disconnect</button>}
      </div>
    </div>
  );
}
