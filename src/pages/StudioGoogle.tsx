// Settings: Sign in with Google for this Studio (when it signs in by email on its Cloudflare database).
import { useEffect, useState } from "react";
import { loadHostConfig } from "../lib/studiohost";
import { GoogleSignInCard } from "../ui/GoogleSignIn";

export function StudioGoogleCard() {
  const [api, setApi] = useState("");
  useEffect(() => { let live = true; loadHostConfig().then((c) => { if (live && c?.kind === "cloudflare") setApi(c.api); }).catch(() => {}); return () => { live = false; }; }, []);
  return api ? <GoogleSignInCard api={api} /> : null;
}
