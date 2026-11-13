// Settings → Hosting accounts: the Studio's helper (on Cloudflare or Netlify), the Cloudflare account used for
// hosting pages, the database and Workers, and the shop's Cloudflare token, as kept on this device.
import { useEffect, useState } from "react";
import type { Session } from "../lib/auth";
import { cfVault } from "../lib/cloudflare";
import { cfAccountVault } from "../lib/cfdb";
import { netlifyToken } from "../lib/hosting";
import { Netlify } from "../lib/netlify";
import { HelperStatus } from "./HelperBox";
import { useCfAccount } from "./CfPicker";

export function SetupAccounts({ session }: { session: Session }) {
  const [nf, setNf] = useState<Netlify | null | undefined>(undefined);
  const [shop, setShop] = useState<boolean | undefined>(undefined);
  useEffect(() => { netlifyToken.load(session.token).then((t) => setNf(t ? new Netlify(t.token) : null)); cfVault.load(session.token).then((v) => setShop(!!v?.token)); }, [session.token]);
  if (nf === undefined || shop === undefined) return null;
  return (
    <div className="flex flex-col gap-3 text-sm">
      <h3 className="mt-2 text-sm font-bold">Studio helper</h3>
      <HelperStatus studioToken={session.token} nf={nf} />
      <h3 className="mt-2 text-sm font-bold">Cloudflare (hosting, database and Workers)</h3>
      <CloudflareAccount session={session} nf={nf} />
      {shop && <div className="flex flex-wrap items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-emerald-400" /><span>Shop backend's Cloudflare token saved on this device</span>
        <button type="button" className="btn btn-sm ml-auto" onClick={() => { cfVault.clear(); setShop(false); }}>Disconnect</button>
      </div>}
    </div>
  );
}

function CloudflareAccount({ session, nf }: { session: Session; nf: Netlify | null }) {
  const acc = useCfAccount(session.token, nf, true);
  if (acc.account) return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="h-2 w-2 rounded-full bg-emerald-400" /><span>Cloudflare: <b>{acc.account.name}</b></span>
      <button type="button" className="btn btn-sm ml-auto" onClick={() => { cfAccountVault.clear(); location.reload(); }} title="Forget the token on this device (the database's setup is forgotten too; running a setup again finds it).">Disconnect</button>
    </div>
  );
  return acc.ui;
}
