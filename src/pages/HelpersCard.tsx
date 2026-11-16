// Settings → Studio helpers: shows the helper this device uses and removes every helper in one press: the
// "studio-helper" Workers on each Cloudflare account this device has a token for, and the helper site on Netlify.
import { useEffect, useState } from "react";
import type { Session } from "../lib/auth";
import { Cloudflare } from "../lib/cloudflare";
import { cfAccountVault } from "../lib/cfdb";
import { netlifyToken } from "../lib/hosting";
import { Netlify } from "../lib/netlify";
import { CF_HELPER_NAME, relayVault, type Relay } from "../lib/relay";
import { useConfirm, useToast } from "../ui/kit";

/** Finds and deletes the helpers. The one this device talks through goes last (it carries the requests). */
export async function removeHelpers(studioToken: string, step: (s: string) => void): Promise<{ removed: string[]; failed: string[] }> {
  const relay = await relayVault.load(studioToken), v = await cfAccountVault.load(studioToken), nfTok = await netlifyToken.load(studioToken);
  const removed: string[] = [], failed: string[] = [];
  const mine = relay?.kind === "cloudflare" ? relay.url.replace(/^https:\/\/|\/$/g, "") : "";
  if (relay) {
    const found: { cf: Cloudflare; id: string; name: string; self: boolean }[] = [];
    for (const token of [v?.token, ...(v?.more || []).map((m) => m.token)].filter(Boolean) as string[]) {
      const cf = new Cloudflare(relay, token);
      step("Looking for helpers on Cloudflare");
      for (const a of await cf.accounts().catch(() => [])) {
        if (found.some((f) => f.id === a.id) || !(await cf.script(a.id, CF_HELPER_NAME).catch(() => null))) continue;
        const sub = mine ? await cf.subdomainOf(a.id).catch(() => null) : null;
        found.push({ cf, id: a.id, name: a.name, self: !!sub && mine === `${CF_HELPER_NAME}.${sub}.workers.dev` });
      }
    }
    for (const f of found.sort((a, b) => +a.self - +b.self)) {
      step(`Removing the helper from ${f.name}`);
      // Deleting the helper this request travels through can cut the answer short: that still means it is gone.
      try { await f.cf.deleteScript(f.id, CF_HELPER_NAME); removed.push(`Cloudflare · ${f.name}`); }
      catch (e: any) { if (f.self) removed.push(`Cloudflare · ${f.name}`); else failed.push(`Cloudflare · ${f.name}: ${e?.message || "couldn't be removed"}`); }
    }
    if (mine && !found.some((f) => f.self)) failed.push(`${mine}: no saved Cloudflare token can manage it. Delete the Worker “${CF_HELPER_NAME}” in Cloudflare → Workers & Pages.`);
  }
  if (relay && relay.kind !== "cloudflare" && relay.siteId) {
    step("Removing the helper site from Netlify");
    if (!nfTok) failed.push("Netlify helper: connect Netlify to remove it.");
    else try { await new Netlify(nfTok.token).deleteSite(relay.siteId); removed.push("Netlify helper site"); } catch (e: any) { if (e?.status === 404) removed.push("Netlify helper site"); else failed.push(`Netlify helper: ${e?.message || "couldn't be removed"}`); }
  }
  if (!failed.length || removed.length) { relayVault.clear(); dispatchEvent(new Event("studio-helper-changed")); }
  return { removed, failed };
}

export function HelpersCard({ session }: { session: Session }) {
  const toast = useToast(), confirm = useConfirm();
  const [relay, setRelay] = useState<Relay | null | undefined>(undefined);
  const [busy, setBusy] = useState(""), [out, setOut] = useState<{ removed: string[]; failed: string[] } | null>(null);
  const load = () => relayVault.load(session.token).then(setRelay);
  useEffect(() => { load(); addEventListener("studio-helper-changed", load); return () => removeEventListener("studio-helper-changed", load); }, [session.token]);
  const remove = async () => {
    if (!(await confirm("Remove the Studio's helpers?", "This deletes the helper Worker (studio-helper) from every Cloudflare account this device has a token for, and the helper site on Netlify. Your sites, databases and tokens are not touched. The Studio asks to set a helper up again the next time a step needs one.", "Remove helpers", true))) return;
    setOut(null); setBusy("Starting");
    try { const r = await removeHelpers(session.token, setBusy); setOut(r); toast(r.removed.length ? `Removed ${r.removed.length} helper${r.removed.length === 1 ? "" : "s"}` : "No helpers were removed", r.failed.length ? "bad" : undefined); }
    catch (e: any) { toast(e?.message || "Couldn't remove the helpers.", "bad"); }
    setBusy(""); load();
  };
  return (
    <section className="card flex flex-col gap-3 p-5" aria-label="Studio helpers">
      <h3 className="text-[15px] font-extrabold">Studio helpers</h3>
      <p className="text-sm text-ink-300">A helper is a small go-between on your own Cloudflare or Netlify that passes the Studio's setup requests to Cloudflare, Resend, Stripe and Supabase. It keeps none of your keys.</p>
      <p className="text-[13px] text-ink-400">{relay === undefined ? "Checking…" : relay ? <>This device uses the helper at <b className="font-mono text-ink-200">{relay.url.replace(/^https:\/\/|\/$/g, "")}</b> ({relay.kind === "cloudflare" ? "Cloudflare" : "Netlify"}).</> : "No helper is connected on this device."}</p>
      {out && (out.removed.length > 0 || out.failed.length > 0) && (
        <ul className="flex flex-col gap-1 text-[13px]" aria-label="Result">
          {out.removed.map((x) => <li key={x} className="text-emerald-300">✓ Removed: {x}</li>)}
          {out.failed.map((x) => <li key={x} className="text-amber-200">! {x}</li>)}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-danger btn-sm" disabled={!!busy || !relay} onClick={remove}>{busy ? busy + "…" : "Delete and remove all helpers"}</button>
        {!relay && relay !== undefined && <span className="hint">Nothing to remove from here.</span>}
      </div>
      <p className="hint">If Cloudflare made a copy of the helper's code in a repository on your GitHub (named {CF_HELPER_NAME}), delete that repository on GitHub yourself: the Studio can't delete repositories.</p>
    </section>
  );
}
