// What the AI tools (Write text from a site, Read a product pamphlet) need first: the Studio's Cloudflare database,
// with Workers AI turned on, and this device signed in to it as an owner or partner.
import { useEffect, useState } from "react";
import type { Session } from "../lib/auth";
import type { ProjectMeta } from "../lib/studio";
import { cfAccountVault, cfDeployInfo, cfSendCode, cfSignedIn, cfVerifyCode, setupCfDb } from "../lib/cfdb";
import { loadHostConfig } from "../lib/studiohost";
import { netlifyToken } from "../lib/hosting";
import { Netlify } from "../lib/netlify";
import { useCfAccount } from "./CfPicker";
import { brand as studioBrand } from "../lib/brand";

/** The database this Studio can use: the site's own, the one set up on this device, or the hosted Studio's. */
async function findApi(project: ProjectMeta, token: string): Promise<string | null> {
  if (project.host?.cf?.api) return project.host.cf.api;
  const v = await cfAccountVault.load(token).catch(() => null);
  if (v?.setup?.api) return v.setup.api;
  const h = await loadHostConfig().catch(() => null);
  return h?.kind === "cloudflare" ? h.api : null;
}

/** `ready` once the database has AI and this device is signed in; `ui` shows what's missing (or null). */
export function useAiDb(session: Session, project: ProjectMeta) {
  const [api, setApi] = useState<string | null | undefined>(undefined);
  const [ai, setAi] = useState<boolean | null>(null);
  const [who, setWho] = useState<string | null>(null);
  const [email, setEmail] = useState(""), [code, setCode] = useState(""), [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(""), [err, setErr] = useState("");
  const [nf, setNf] = useState<Netlify | null | undefined>(undefined);
  useEffect(() => { netlifyToken.load(session.token).then((t) => setNf(t ? new Netlify(t.token) : null)); }, [session.token]);
  const acc = useCfAccount(session.token, nf, true);
  const check = async (a: string | null) => { setApi(a); if (!a) return; setAi(!!(await cfDeployInfo(a)).ai); setWho(await cfSignedIn(a)); };
  useEffect(() => { findApi(project, session.token).then(check); }, []);
  const run = (label: string, f: () => Promise<void>) => async () => { setErr(""); setBusy(label); try { await f(); } catch (e: any) { setErr(e?.message || "Something went wrong."); } setBusy(""); };
  const sendCode = run("Sending", async () => { await cfSendCode(api!, email.trim()); setSent(true); });
  const verify = run("Checking", async () => { await cfVerifyCode(api!, email.trim(), code.trim()); setCode(""); setSent(false); setWho(await cfSignedIn(api!)); });
  const update = run("Updating the database", async () => {
    const v = await cfAccountVault.load(session.token);
    const { relay, account, token } = await acc.client((x) => setBusy(x));
    const setup = await setupCfDb(relay, token, { account, resendKey: "", mailFrom: v?.mailFrom || "", name: studioBrand().name, existing: v?.setup && v.setup.account === account.id ? v.setup : null, requireMail: false }, (x) => setBusy(x));
    await cfAccountVault.save({ ...(v || {}), token, account: account.id, setup }, session.token);
    await check(setup.api);
  });
  const ready = !!(api && ai && who);
  const ui = ready ? null : (
    <div className="flex flex-col gap-3 text-sm">
      {api === undefined && <p className="text-ink-400">Checking your Cloudflare database…</p>}
      {api === null && <p className="rounded-lg border border-amber-400/30 bg-amber-400/5 px-3 py-2.5 text-amber-100">This needs the Studio's database on Cloudflare (free). Set it up in <b>Settings → Accounts → Cloudflare</b>, then come back.</p>}
      {api && ai === false && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 px-3 py-2.5 text-amber-100">
          <p>Your database was set up before the AI tools were added. Update it once to turn on Cloudflare's free AI (Workers AI). Sign-ins and data are kept.</p>
          {acc.ready ? <button type="button" className="btn btn-sm btn-pri mt-2" disabled={!!busy} onClick={update}>{busy ? busy + "…" : "Update the database"}</button> : <div className="mt-2">{acc.ui}</div>}
        </div>
      )}
      {api && ai && !who && (
        <div className="flex flex-col gap-2 rounded-lg border border-ink-700 p-3">
          <p className="text-ink-300">Sign in to your Cloudflare database with your email code (owners and partners can use this).</p>
          <div className="flex flex-wrap gap-2">
            <input className="input min-w-0 flex-1" type="email" placeholder="you@example.com" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button type="button" className="btn btn-sm" disabled={!email.includes("@") || !!busy} onClick={sendCode}>{sent ? "Send again" : "Send code"}</button>
          </div>
          {sent && <div className="flex flex-wrap gap-2"><input className="input w-40" inputMode="numeric" placeholder="Code" aria-label="Code" value={code} onChange={(e) => setCode(e.target.value)} /><button type="button" className="btn btn-sm btn-pri" disabled={code.trim().length < 4 || !!busy} onClick={verify}>Sign in</button></div>}
        </div>
      )}
      {err && <p role="alert" className="text-red-300">{err}</p>}
    </div>
  );
  return { api: api || null, ready, ui };
}
