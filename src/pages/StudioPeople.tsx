// Settings: who can sign in to this Studio. The people are the Studio's members on its Cloudflare database.
import { useEffect, useState } from "react";
import { loadHostConfig } from "../lib/studiohost";
import { PeopleCard } from "../ui/People";

export function StudioPeopleCard() {
  const [cfg, setCfg] = useState<{ api: string; studio: string } | null>(null);
  useEffect(() => { let live = true; loadHostConfig().then((c) => { if (live && c?.kind === "cloudflare") setCfg({ api: c.api, studio: c.studio }); }).catch(() => {}); return () => { live = false; }; }, []);
  return cfg ? <PeopleCard api={cfg.api} scopeName={"studio:" + cfg.studio} what="this Studio" label="Who can sign in to this Studio" intro={<>Only these email addresses can open this Studio, with an emailed 6-digit code (or Sign in with Google, if you turn it on below). <b>Owners</b> can change everything, including hosting and these people; <b>members</b> can work on sites.</>} /> : null;
}
