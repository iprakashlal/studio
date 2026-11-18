// Connections an owner can switch on, kept on their own Cloudflare database (encrypted there, never sent back):
// their own AI API, WhatsApp (Meta's WhatsApp Business Cloud API) and Razorpay.
// Each form shows what is saved (a key only as "saved"), and a key box left empty keeps the saved key.
import { useEffect, useState } from "react";
import { cfCall, cfSession, signedInApi } from "../lib/cfdb";
import { Field, Toggle, useToast } from "../ui/kit";

type Kind = "ai" | "wa" | "rz";
type Saved = Record<Kind, Record<string, any> | null>;
export type Where = { api: string; scope: string };

/** The Studio's own database and the Studio scope this person owns there (null when not signed in, or not an owner). */
export async function studioWhere(): Promise<Where | null> {
  const api = await signedInApi().catch(() => null); if (!api) return null;
  try { const me = await cfCall<{ scopes: { scope: string; role: string }[] }>(api, "/me"); const s = me.scopes.find((x) => x.scope.startsWith("studio:") && x.role === "owner"); return s ? { api, scope: s.scope } : null; } catch { return null; }
}
function useSaved(w: Where | null) {
  const [saved, setSaved] = useState<Saved | null>(null), [err, setErr] = useState("");
  const load = async () => {
    if (!w) return; setErr("");
    try { setSaved(await cfCall<Saved>(w.api, "/set?scope=" + encodeURIComponent(w.scope))); }
    catch (e: any) { setErr(e?.status === 404 ? "This needs the database updated once (Settings → Hostings → Update the database)." : e?.status === 403 ? "Only an owner can see or change connections." : e?.status === 401 ? "Sign in to this database on this device first." : e?.message || "Couldn't load the connections."); }
  };
  useEffect(() => { setSaved(null); load(); }, [w?.api, w?.scope]);
  const save = async (name: Kind, value: Record<string, any> | null) => { const r = await cfCall<any>(w!.api, "/set?scope=" + encodeURIComponent(w!.scope), { method: "POST", body: JSON.stringify({ name, value }) }); setSaved((s) => ({ ...(s as Saved), [name]: value ? r.value : null })); };
  return { saved, err, save, load };
}
const txt = (v: any) => String(v ?? "");
function Secret({ id, label, saved, value, onChange, hint }: { id: string; label: string; saved: boolean; value: string; onChange: (v: string) => void; hint?: string }) {
  return <Field label={label} htmlFor={id} hint={hint || (saved ? "A key is saved. Leave this empty to keep it, or type a new one to replace it." : "Typed here, it goes straight to your own database and is stored encrypted. It is never shown again.")}>
    <input id={id} className="input" type="password" autoComplete="off" placeholder={saved ? "•••••••• saved" : ""} value={value} onChange={(e) => onChange(e.target.value)} /></Field>;
}
function Shell({ title, on, children, lead }: { title: string; on?: boolean; children: React.ReactNode; lead: React.ReactNode }) {
  return <section className="card flex flex-col gap-3 p-5" aria-label={title}><h3 className="flex items-center gap-2 text-[15px] font-extrabold">{title}{on != null && <span className={`chip ${on ? "border-emerald-400/50 text-emerald-200" : "border-ink-600 text-ink-400"}`}>{on ? "On" : "Off"}</span>}</h3><p className="text-sm text-ink-300">{lead}</p>{children}</section>;
}
const Missing = ({ why }: { why: string }) => <p className="rounded-lg border border-ink-600 px-3 py-2 text-[13px] text-ink-300">{why}</p>;

/** Settings → AI engine: the owner's own OpenAI-compatible API. */
export function AiApiForm({ where }: { where: Where | null | undefined }) {
  const toast = useToast(), { saved, err, save } = useSaved(where || null);
  const [f, setF] = useState({ base: "", model: "", vision: "", key: "" }), [busy, setBusy] = useState("");
  useEffect(() => { const a = saved?.ai; if (a) setF({ base: txt(a.base), model: txt(a.model), vision: txt(a.vision), key: "" }); }, [saved]);
  if (where === undefined) return <Missing why="Checking your database…" />;
  if (!where) return <Missing why="Your own AI API is kept on the Studio's Cloudflare database. Host the Studio on Cloudflare (Settings → Hostings) and sign in there as its owner to set it up." />;
  if (err) return <Missing why={err} />;
  const a = saved?.ai, ok = /^https:\/\/\S+\.\S+/.test(f.base.trim()) && !!f.model.trim() && (!!f.key.trim() || !!a?.key);
  const go = (label: string, fn: () => Promise<void>) => async () => { setBusy(label); try { await fn(); } catch (e: any) { toast(e?.message || "That didn't work.", "bad"); } setBusy(""); };
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-ink-600 p-3" aria-label="Your own AI API">
      <b className="text-ink-100">Your own AI API {a?.on && a.key ? <span className="chip border-emerald-400/50 text-emerald-200">Set up</span> : <span className="chip border-ink-600 text-ink-400">Not set up</span>}</b>
      <p className="text-[13px] text-ink-300">Works with any API that speaks the OpenAI chat format: OpenAI, OpenRouter, Groq, Together, Google Gemini's OpenAI address, or a model you host. Translating, reading pamphlets and menus, and writing text then use it in place of Cloudflare AI.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="API address" htmlFor="ai-base" hint="The part before /chat/completions, for example https://api.openai.com/v1 or https://openrouter.ai/api/v1"><input id="ai-base" className="input" placeholder="https://api.openai.com/v1" value={f.base} onChange={(e) => setF({ ...f, base: e.target.value })} /></Field>
        <Field label="Model" htmlFor="ai-model" hint="As the provider names it, for example gpt-4o-mini."><input id="ai-model" className="input" placeholder="gpt-4o-mini" value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} /></Field>
        <Field label="Model for reading pictures (optional)" htmlFor="ai-vision" hint="Used for photos of pamphlets and menus. Empty uses the model above, which must then accept pictures."><input id="ai-vision" className="input" value={f.vision} onChange={(e) => setF({ ...f, vision: e.target.value })} /></Field>
        <Secret id="ai-key" label="API key" saved={!!a?.key} value={f.key} onChange={(v) => setF({ ...f, key: v })} />
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-sm btn-pri" disabled={!ok || !!busy} onClick={go("Saving", async () => { await save("ai", { on: true, base: f.base.trim(), model: f.model.trim(), vision: f.vision.trim(), key: f.key.trim() }); setF((x) => ({ ...x, key: "" })); toast("Your AI API is saved."); })}>{busy === "Saving" ? "Saving…" : "Save"}</button>
        <button type="button" className="btn btn-sm" disabled={!a?.key || !!busy} onClick={go("Testing", async () => { const r = await cfCall<any>(where.api, "/set/test?scope=" + encodeURIComponent(where.scope), { method: "POST", body: JSON.stringify({ name: "ai" }) }); if (r?.error) throw new Error(r.error); toast(`It answered: “${r.said || "(nothing)"}”. The connection works.`); })}>{busy === "Testing" ? "Testing…" : "Test the connection"}</button>
        {a && <button type="button" className="btn btn-sm btn-danger ml-auto" disabled={!!busy} onClick={go("Removing", async () => { await save("ai", null); setF({ base: "", model: "", vision: "", key: "" }); toast("Removed."); })}>Remove</button>}
      </div>
      <p className="text-[12.5px] text-ink-400">Your text and pictures are sent to that provider when you use a helper, under that provider's terms and prices. The key is stored encrypted on your database and is never shown again or put in a site.</p>
    </div>
  );
}

const WA_FLAGS: Record<string, [string, string][]> = {
  studio: [["login", "Send Studio sign-in codes on WhatsApp too"]],
  site: [["login", "Send this site's admin sign-in codes on WhatsApp too"], ["enquiryAlert", "Message me when an enquiry or booking arrives"], ["orderAlert", "Message me when an order is placed"], ["orderOtp", "Ask guests to verify their mobile number with a WhatsApp code before ordering (restaurant Order now page)"]],
};
/** WhatsApp through Meta's Cloud API. `kind`: the Studio's own sign-in, or a site (sign-in, alerts, a guest's code). */
export function WhatsAppForm({ where, kind }: { where: Where | null | undefined; kind: "studio" | "site" }) {
  const toast = useToast(), { saved, err, save } = useSaved(where || null);
  const blank = { on: false, phoneId: "", token: "", cc: "91", lang: "en", to: "", phones: "", tplOtp: "", tplOrder: "", tplEnquiry: "", login: false, orderOtp: false, orderAlert: false, enquiryAlert: false };
  const [f, setF] = useState<Record<string, any>>(blank), [busy, setBusy] = useState(false);
  useEffect(() => { const w = saved?.wa; setF(w ? { ...blank, ...w, token: "" } : blank); }, [saved]);
  const lead = <>Optional. Messages go through your own WhatsApp Business account (Meta's WhatsApp Business Cloud API), and Meta charges you per message. Nothing is sent on WhatsApp unless this is switched on and the matching box below is ticked; email keeps working as before.</>;
  if (where === undefined) return <Shell title="WhatsApp" lead={lead}><Missing why="Checking your database…" /></Shell>;
  if (!where) return <Shell title="WhatsApp" lead={lead}><Missing why={kind === "studio" ? "WhatsApp is kept on the Studio's Cloudflare database. Host the Studio on Cloudflare (Settings → Hostings) and sign in there as its owner." : "WhatsApp needs this site hosted on your Cloudflare database, and you signed in to it on this device as its owner."} /></Shell>;
  if (err) return <Shell title="WhatsApp" lead={lead}><Missing why={err} /></Shell>;
  const w = saved?.wa, set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const needOtp = f.login || f.orderOtp, ok = !f.on || (!!f.phoneId.trim() && (!!f.token.trim() || !!w?.token));
  const doSave = async () => { setBusy(true); try { await save("wa", { ...f, token: f.token.trim() }); setF((x) => ({ ...x, token: "" })); toast(f.on ? "WhatsApp is saved and on." : "Saved. WhatsApp is off."); } catch (e: any) { toast(e?.message || "Couldn't save that.", "bad"); } setBusy(false); };
  return (
    <Shell title="WhatsApp" on={!!(w?.on && w.token)} lead={lead}>
      <Toggle id="wa-on" checked={!!f.on} onChange={(v: boolean) => setF({ ...f, on: v })} label="Use WhatsApp" />
      {f.on && <>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Phone number ID" htmlFor="wa-id" hint="Meta for Developers → your app → WhatsApp → API Setup. A long number, not the phone number itself."><input id="wa-id" className="input" inputMode="numeric" value={f.phoneId} onChange={set("phoneId")} /></Field>
          <Secret id="wa-token" label="Access token" saved={!!w?.token} value={f.token} onChange={(v) => setF({ ...f, token: v })} hint={w?.token ? undefined : "A permanent token of a System User with the whatsapp_business_messaging permission. Typed here, it goes straight to your database and is stored encrypted."} />
          <Field label="Country code for 10-digit numbers" htmlFor="wa-cc"><input id="wa-cc" className="input" inputMode="numeric" value={f.cc} onChange={set("cc")} /></Field>
          <Field label="Template language" htmlFor="wa-lang" hint="The language code your templates were approved in, for example en or en_US."><input id="wa-lang" className="input" value={f.lang} onChange={set("lang")} /></Field>
        </div>
        <fieldset className="flex flex-col gap-2 rounded-lg border border-ink-700 p-3"><legend className="label px-1">Use it for</legend>
          {WA_FLAGS[kind].map(([k, l]) => <label key={k} className="flex items-start gap-2.5 text-sm"><input type="checkbox" className="mt-0.5" checked={!!f[k]} onChange={(e) => setF({ ...f, [k]: e.target.checked })} /><span>{l}</span></label>)}
        </fieldset>
        {needOtp && <Field label="Template for codes (an Authentication template)" htmlFor="wa-otp" hint="WhatsApp Manager → Message templates → Create → Authentication → Copy code. Type its name here exactly."><input id="wa-otp" className="input" placeholder="login_code" value={f.tplOtp} onChange={set("tplOtp")} /></Field>}
        {f.login && <Field label="Who gets sign-in codes on WhatsApp" htmlFor="wa-phones" hint="One per line: the email they sign in with, an equals sign, their WhatsApp number. Anyone not listed gets the email only."><textarea id="wa-phones" className="input min-h-[70px] font-mono text-[13px]" placeholder={"owner@example.com = +91 98xxxxxxxx"} value={f.phones} onChange={set("phones")} /></Field>}
        {kind === "site" && (f.orderAlert || f.enquiryAlert) && <>
          <Field label="Send alerts to (up to 3 numbers)" htmlFor="wa-to"><input id="wa-to" className="input" placeholder="+91 98xxxxxxxx, +91 97xxxxxxxx" value={f.to} onChange={set("to")} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            {f.orderAlert && <Field label="Template for a new order (Utility)" htmlFor="wa-ord" hint="Body with four variables, for example: New order {{1}} from {{2}}. To pay {{3}}. {{4}}"><input id="wa-ord" className="input" placeholder="order_alert" value={f.tplOrder} onChange={set("tplOrder")} /></Field>}
            {f.enquiryAlert && <Field label="Template for a new enquiry (Utility)" htmlFor="wa-enq" hint="Body with three variables, for example: New enquiry from {{1}} ({{2}}): {{3}}"><input id="wa-enq" className="input" placeholder="enquiry_alert" value={f.tplEnquiry} onChange={set("tplEnquiry")} /></Field>}
          </div>
        </>}
        <p className="text-[12.5px] text-ink-400">WhatsApp only lets a business start a conversation with a template Meta has approved, so each use above needs its template created in WhatsApp Manager first. If WhatsApp refuses a message, the enquiry or order is still saved and emailed, and says why under “WhatsApp”.</p>
      </>}
      <div className="flex gap-2"><button type="button" className="btn btn-sm btn-pri" disabled={!ok || busy} onClick={doSave}>{busy ? "Saving…" : "Save"}</button>{w && <button type="button" className="btn btn-sm btn-danger ml-auto" disabled={busy} onClick={async () => { setBusy(true); try { await save("wa", null); toast("WhatsApp removed."); } catch (e: any) { toast(e?.message || "Couldn't remove it.", "bad"); } setBusy(false); }}>Remove</button>}</div>
    </Shell>
  );
}

/** Razorpay for a restaurant's Order now page: paid orders are confirmed by Razorpay's signature, with no checking. */
export function RazorpayForm({ where }: { where: Where | null | undefined }) {
  const toast = useToast(), { saved, err, save } = useSaved(where || null);
  const [f, setF] = useState({ on: false, keyId: "", secret: "" }), [busy, setBusy] = useState(false);
  useEffect(() => { const z = saved?.rz; setF(z ? { on: !!z.on, keyId: txt(z.keyId), secret: "" } : { on: false, keyId: "", secret: "" }); }, [saved]);
  const lead = <>Take UPI, cards and netbanking on the Order now page. Razorpay tells your database when the money has arrived, so the order is placed and marked Paid by itself. Razorpay charges its usual fee per payment.</>;
  if (where === undefined) return <Shell title="Razorpay" lead={lead}><Missing why="Checking your database…" /></Shell>;
  if (!where) return <Shell title="Razorpay" lead={lead}><Missing why="Razorpay needs this site hosted on your Cloudflare database, and you signed in to it on this device as its owner." /></Shell>;
  if (err) return <Shell title="Razorpay" lead={lead}><Missing why={err} /></Shell>;
  const z = saved?.rz, ok = !f.on || (/^rzp_(test|live)_\w+$/.test(f.keyId.trim()) && (!!f.secret.trim() || !!z?.secret));
  return (
    <Shell title="Razorpay" on={!!(z?.on && z.secret)} lead={lead}>
      <Toggle id="rz-on" checked={f.on} onChange={(v: boolean) => setF({ ...f, on: v })} label="Take online payments with Razorpay" />
      {f.on && <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Key ID" htmlFor="rz-id" hint="Razorpay Dashboard → Account & Settings → API Keys. Starts with rzp_test_ or rzp_live_."><input id="rz-id" className="input font-mono" placeholder="rzp_live_…" value={f.keyId} onChange={(e) => setF({ ...f, keyId: e.target.value })} /></Field>
        <Secret id="rz-secret" label="Key secret" saved={!!z?.secret} value={f.secret} onChange={(v) => setF({ ...f, secret: v })} />
      </div>}
      {f.on && <p className="text-[12.5px] text-ink-400">Then switch on “Pay online with Razorpay” under Online ordering → Payment and publish. Try it with a rzp_test_ key first: Razorpay's test mode takes no real money. The amount of each payment is worked out by your database from your menu, not by the guest's phone.</p>}
      <div className="flex gap-2"><button type="button" className="btn btn-sm btn-pri" disabled={!ok || busy} onClick={async () => { setBusy(true); try { await save("rz", { on: f.on, keyId: f.keyId.trim(), secret: f.secret.trim() }); setF((x) => ({ ...x, secret: "" })); toast(f.on ? "Razorpay is saved and on." : "Saved. Razorpay is off."); } catch (e: any) { toast(e?.message || "Couldn't save that.", "bad"); } setBusy(false); }}>{busy ? "Saving…" : "Save"}</button>
        {z && <button type="button" className="btn btn-sm btn-danger ml-auto" disabled={busy} onClick={async () => { setBusy(true); try { await save("rz", null); toast("Razorpay removed."); } catch (e: any) { toast(e?.message || "Couldn't remove it.", "bad"); } setBusy(false); }}>Remove</button>}</div>
    </Shell>
  );
}

/** A site's "Payments & WhatsApp" section (site admin and the Studio's editor). */
export function SiteConnections({ cf, template }: { cf?: { api: string; site: string } | null; template: string }) {
  const where = cf && cfSession.load(cf.api) ? { api: cf.api, scope: "site:" + cf.site } : null;
  return <div className="flex max-w-3xl flex-col gap-4">{template === "restaurant" && <RazorpayForm where={where} />}<WhatsAppForm where={where} kind="site" /></div>;
}
/** The Studio's own database, looked up once. */
export function useStudioWhere() { const [w, setW] = useState<Where | null | undefined>(undefined); useEffect(() => { let on = true; studioWhere().then((x) => on && setW(x)); return () => { on = false; }; }, []); return w; }
