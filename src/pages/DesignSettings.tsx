import { useState } from "react";
import { pushPref } from "../lib/prefs";
import { readDesignSettings, writeDesignSettings, type DesignSettings } from "../lib/designs";
import { Toggle, useToast } from "../ui/kit";

/** Settings → General: the "Design yourself" page (a link on the Themes page): on or off, and where requests go. */
export function DesignPageCard() {
  const toast = useToast();
  const [s, setS] = useState<DesignSettings>(readDesignSettings);
  const on = s.on !== false;
  const save = (n: DesignSettings) => { setS(n); writeDesignSettings(n); pushPref({ design: n }); };
  const link = () => { const q = new URLSearchParams(); const wa = (s.whatsapp || "").replace(/\D/g, ""); if (wa) q.set("wa", wa); if (s.email) q.set("em", s.email); const t = q.toString(); return location.origin + location.pathname + "#/design" + (t ? "?" + t : ""); };
  const copy = async () => { try { await navigator.clipboard.writeText(link()); toast("Link copied"); } catch { prompt("Copy this link:", link()); } };
  return (
    <section className="card flex flex-col gap-3 p-5" aria-label="Design yourself">
      <h3 className="text-[15px] font-extrabold">Design yourself</h3>
      <p className="text-sm text-ink-300">A page on the Themes gallery where a visitor answers a few simple questions and sees a preview of their own website. Nothing is published: they are asked to connect with you to finish. Previews they make while signed in appear in Projects → Design previews.</p>
      <Toggle id="design-on" label="Show “Design yourself” on the Themes page" checked={on} onChange={(v) => save({ ...s, on: v })} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5"><span className="label">WhatsApp number for requests</span><input className="input" inputMode="tel" placeholder="e.g. 919876543210" value={s.whatsapp || ""} onChange={(e) => setS({ ...s, whatsapp: e.target.value })} onBlur={() => save(s)} /></label>
        <label className="flex flex-col gap-1.5"><span className="label">Email for requests</span><input className="input" type="email" placeholder="hello@yourstudio.com" value={s.email || ""} onChange={(e) => setS({ ...s, email: e.target.value })} onBlur={() => save(s)} /></label>
      </div>
      <p className="text-xs text-ink-400">Visitors send their answers to these. To make them work for people who aren't signed in, share this link, which carries them:</p>
      <div className="flex flex-wrap gap-2"><button type="button" className="btn btn-sm" onClick={copy}>Copy the page link</button><a className="btn btn-ghost btn-sm" href="#/design">Open the page</a></div>
    </section>
  );
}
