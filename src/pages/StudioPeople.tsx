// Settings: who can sign in to this Studio. The people are the Studio's members on its Cloudflare database.
import { useEffect, useState } from "react";
import { loadHostConfig } from "../lib/studiohost";
import { PinCard } from "../ui/PinSignIn";

export function StudioPeopleCard() {
  const [cfg, setCfg] = useState<{ api: string; studio: string } | null>(null);
  useEffect(() => { let live = true; loadHostConfig().then((c) => { if (live && c?.kind === "cloudflare") setCfg({ api: c.api, studio: c.studio }); }).catch(() => {}); return () => { live = false; }; }, []);
  return cfg ? <><section className="card flex flex-col gap-2 p-5" aria-label="Who can sign in to this Studio"><h3 className="text-[15px] font-extrabold">Who can sign in to this Studio</h3><p className="text-sm text-ink-300">The people, their roles and what each role can do are in <a className="text-brand-300 underline" href="#/settings/roles">Settings → Role Management</a>.</p></section><PinCard api={cfg.api} /></> : null;
}
