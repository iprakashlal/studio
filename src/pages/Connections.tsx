// Connections an owner can switch on, kept on their own Cloudflare database (encrypted there, never sent back):
// their own AI API, WhatsApp (Meta's WhatsApp Business Cloud API) and Razorpay.
// Each form shows what is saved (a key only as "saved"), and a key box left empty keeps the saved key.
import { GoogleSignInCard } from "../ui/GoogleSignIn";
import { useEffect, useRef, useState } from "react";
import { cfCall, cfRole, cfSendCode, cfSession, cfSignedIn, cfVerifyCode, resendDomainBlocked, resendTestOnly, signedInApi } from "../lib/cfdb";
import { Field, Toggle, useToast } from "../ui/kit";
import { COURIERS, TRACKERS } from "../lib/tracking";

type Kind = "ai" | "wa" | "rz" | "cf" | "pe" | "st" | "pp" | "pos" | "sms" | "ship" | "mail" | `tk_${string}`;
/** What the Studio lets this site use a way of messaging for (content.cms.msg). */
export type MsgAllow = { login: boolean; checkout: boolean };
export const msgAllow = (cms: any, way: "wa" | "sms"): MsgAllow => { const m = cms?.msg || {}, ok = (v: unknown) => v == null || v === "" || v === way || v === "both"; return { login: ok(m.login), checkout: ok(m.checkout) }; };
const OFF_BY_STUDIO = " (switched off for this site by your Studio)";
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
  /** Notes on this device that a secret is now saved, without loading everything again. */
  const mark = (name: Kind, patch: Record<string, any>) => setSaved((s) => (s ? { ...s, [name]: { ...(s[name] || {}), ...patch } } : s));
  return { saved, err, save, load, mark };
}
const txt = (v: any) => String(v ?? "");
function Secret({ id, label, saved, value, onChange, hint }: { id: string; label: string; saved: boolean; value: string; onChange: (v: string) => void; hint?: string }) {
  return <Field label={label} htmlFor={id} hint={hint || (saved ? "A key is saved. Leave this empty to keep it, or type a new one to replace it." : "Typed here, it goes straight to your own database and is stored encrypted. It is never shown again.")}>
    <input id={id} className="input" type="password" autoComplete="off" placeholder={saved ? "•••••••• saved" : ""} value={value} onChange={(e) => onChange(e.target.value)} /></Field>;
}
function Shell({ title, on, children, lead, bare }: { bare?: boolean; title: string; on?: boolean; children: React.ReactNode; lead: React.ReactNode }) {
  return <section className="card flex flex-col gap-3 p-5" aria-label={title}>{(!bare || on != null) && <h3 className="flex items-center gap-2 text-[15px] font-extrabold">{!bare && title}{on != null && <span className={`chip ${on ? "border-emerald-400/50 text-emerald-200" : "border-ink-600 text-ink-400"}`}>{on ? "On" : "Off"}</span>}</h3>}<p className="text-sm text-ink-300">{lead}</p>{children}</section>;
}
/** One box with its button on the same line (same height), and the hint under both. */
function WithButton({ label, htmlFor, hint, children, button }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode; button: React.ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-1.5"><label className="label" htmlFor={htmlFor}>{label}</label><div className="flex items-stretch gap-2">{children}{button}</div>{hint && <span className="hint">{hint}</span>}</div>;
}
/** The row of a card's own buttons: Save on the left, Remove on the right, under a rule. */
const FOOT = "mt-1 flex items-center gap-2 border-t border-ink-700 pt-3";
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
  site: [["login", "Send this site's admin sign-in codes on WhatsApp too"], ["enquiryAlert", "Message me when an enquiry or booking arrives"], ["orderAlert", "Message me when an order is placed"], ["orderOtp", "Ask customers to verify their mobile number with a WhatsApp code before ordering (restaurant Order now page and shop checkout)"]],
};
type WaFound = { id: string; phones: { id: string; number: string; name: string }[]; templates: { name: string; status: string; category: string; language: string }[] };
const WA_LINKS: [string, string, string][] = [
  ["1. Get the access token", "https://business.facebook.com/settings/system-users", "Meta Business settings → System users → Add → Generate token, with whatsapp_business_messaging and whatsapp_business_management ticked and “Never” for expiry."],
  ["API Setup (your number)", "https://developers.facebook.com/apps/", "Meta for Developers → your app → WhatsApp → API Setup. No app yet? Create one there with the WhatsApp product."],
  ["Message templates", "https://business.facebook.com/wa/manage/message-templates/", "WhatsApp Manager, where templates and their approval show."],
];
/** WhatsApp through Meta's Cloud API. `kind`: the Studio's own sign-in, or a site (sign-in, alerts, a guest's code).
    Set up from the token alone: Connect asks Meta for the account, its numbers and its templates, and fills the form in. */
export function WhatsAppForm({ where, kind, allow }: { where: Where | null | undefined; kind: "studio" | "site"; /** What the Studio lets this site use WhatsApp codes for. */ allow?: MsgAllow }) {
  const barred = (k: string) => !!allow && ((k === "login" && !allow.login) || (k === "orderOtp" && !allow.checkout));
  const toast = useToast(), { saved, err, save, mark } = useSaved(where || null), keep = useRef(false);
  const blank = { on: false, phoneId: "", waba: "", token: "", cc: "91", lang: "en", to: "", phones: "", tplOtp: "", tplOrder: "", tplEnquiry: "", login: false, orderOtp: false, orderAlert: false, enquiryAlert: false };
  const [f, setF] = useState<Record<string, any>>(blank), [busy, setBusy] = useState(""), [found, setFound] = useState<WaFound[] | null>(null), [note, setNote] = useState(""), [testTo, setTestTo] = useState(""), [hand, setHand] = useState(false);
  useEffect(() => { if (keep.current) { keep.current = false; return; } const w = saved?.wa; setF(w ? { ...blank, ...w, token: "" } : blank); }, [saved]);
  // A saved connection is looked up with Meta once when the card opens, so the numbers and templates show by name
  // (as right after Connect) and not as bare IDs. Quietly: if Meta can't be asked just now, the saved IDs stay as they are.
  const looked = useRef("");
  useEffect(() => {
    const w: any = saved?.wa, key = where && w?.token && (w.waba || w.phoneId) ? where.api + "|" + where.scope + "|" + (w.waba || w.phoneId) : "";
    if (!key || looked.current === key) return; looked.current = key;
    cfCall<any>(where!.api, "/set/wa?scope=" + encodeURIComponent(where!.scope), { method: "POST", body: JSON.stringify({ do: "find", token: "", waba: String(w.waba || w.phoneId || "") }) })
      .then((r) => { if (Array.isArray(r?.wabas) && r.wabas.length && r.wabas.some((a: any) => a.id)) setFound((cur) => cur || r.wabas); }).catch(() => {});
  }, [saved, where?.api, where?.scope]);
  const lead = <>Optional. Messages go through your own WhatsApp Business account (Meta's WhatsApp Business Cloud API), and Meta charges you per message. Nothing is sent on WhatsApp unless this is switched on and the matching box below is ticked; email keeps working as before.</>;
  if (where === undefined) return <Shell title="WhatsApp" lead={lead}><Missing why="Checking your database…" /></Shell>;
  if (!where) return <Shell title="WhatsApp" lead={lead}><Missing why={kind === "studio" ? "WhatsApp is kept on the Studio's Cloudflare database. Host the Studio on Cloudflare (Settings → Hostings) and sign in there as its owner." : "WhatsApp needs this site hosted on your Cloudflare database, and you signed in to it on this device as its owner."} /></Shell>;
  if (err) return <Shell title="WhatsApp" lead={lead}><Missing why={err} /></Shell>;
  const w = saved?.wa, set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const call = (body: any) => cfCall<any>(where.api, "/set/wa?scope=" + encodeURIComponent(where.scope), { method: "POST", body: JSON.stringify(body) });
  const acct = found?.find((a) => a.id === f.waba) || found?.[0] || null;
  const tpls = (cat: string) => (acct?.templates || []).filter((t) => t.category.toUpperCase() === cat && t.status.toUpperCase() === "APPROVED");
  const waiting = (acct?.templates || []).filter((t) => /PENDING|IN_APPEAL/i.test(t.status)).map((t) => t.name);
  const needOtp = f.login || f.orderOtp, wantAlerts = kind === "site" && (f.orderAlert || f.enquiryAlert);
  // A phone number typed where the ID belongs is the usual slip: the ID is longer and isn't the number.
  const idLooksLikePhone = /^\+?\d{10,12}$/.test(String(f.phoneId).replace(/\s/g, "")) && String(f.phoneId).replace(/\D/g, "").length <= 12;
  const ok = !f.on || (!!String(f.phoneId).trim() && !idLooksLikePhone && (!!f.token.trim() || !!w?.token));
  const fill = (list: WaFound[], cur: Record<string, any>) => {
    // The account asked for; else the one that holds the number in use; else one of your own before Meta's "Test Number" account.
    const a = list.find((x) => x.id && x.id === cur.waba) || list.find((x) => x.phones.some((p) => p.id === cur.phoneId)) || list.find((x) => x.phones.some((p) => !/^test number$/i.test(p.name))) || list[0], n: Record<string, any> = { ...cur, waba: a.id, token: "" };
    const ap = (cat: string) => a.templates.filter((t) => t.category.toUpperCase() === cat && t.status.toUpperCase() === "APPROVED");
    if (!a.phones.some((p) => p.id === n.phoneId)) n.phoneId = a.phones[0]?.id || "";
    const pick = (now: string, cat: string, like: RegExp) => (ap(cat).some((t) => t.name === now) ? now : (ap(cat).find((t) => like.test(t.name)) || (cat === "AUTHENTICATION" ? ap(cat)[0] : undefined))?.name || "");
    n.tplOtp = pick(n.tplOtp, "AUTHENTICATION", /code|otp|login|sign/i); n.tplOrder = pick(n.tplOrder, "UTILITY", /order/i); n.tplEnquiry = pick(n.tplEnquiry, "UTILITY", /enquir|inquir|lead|booking/i);
    const used = a.templates.find((t) => t.name === n.tplOtp) || a.templates.find((t) => t.status.toUpperCase() === "APPROVED"); if (used?.language) n.lang = used.language;
    n.on = true; if (kind === "studio") n.login = true;
    return n;
  };
  const connect = async () => {
    setBusy("Connecting"); setNote("");
    try {
      const r = await call({ do: "find", token: f.token.trim(), waba: String(f.waba).trim() });
      if (r?.error) throw new Error(r.error);
      if (!r.wabas?.length) { setFound(null); setHand(true); setNote(r.why || "Couldn't find your WhatsApp account from that token."); }
      else { setFound(r.wabas); if (f.token.trim()) { keep.current = true; mark("wa", { token: true }); } setF((x) => fill(r.wabas, x)); const a = r.wabas[0]; setNote(a.id ? `Connected: ${a.phones.length} number${a.phones.length === 1 ? "" : "s"} and ${a.templates.length} template${a.templates.length === 1 ? "" : "s"} found. Check the boxes below and press Save.` : `Connected: your number ${a.phones[0]?.number || ""} was found, but Meta didn't show its WhatsApp account, so the templates can't be listed. Type the template names below, or paste the WhatsApp Business Account ID (on the app's WhatsApp → API Setup page) and press Connect again.`); }
    } catch (e: any) { setNote(e?.status === 404 ? "This needs the database updated once (Settings → Hostings → Update the database)." : e?.message || "Couldn't reach Meta."); }
    setBusy("");
  };
  const missing = [needOtp && !tpls("AUTHENTICATION").length ? "otp" : "", kind === "site" && f.orderAlert && !tpls("UTILITY").some((t) => t.name === f.tplOrder) ? "order" : "", kind === "site" && f.enquiryAlert && !tpls("UTILITY").some((t) => t.name === f.tplEnquiry) ? "enquiry" : ""].filter(Boolean);
  const makeTemplates = async () => {
    setBusy("Creating"); setNote("");
    try { const r = await call({ do: "templates", waba: f.waba, lang: f.lang, make: missing }); if (r?.error) throw new Error(r.error);
      const bad = (r.made || []).filter((m: any) => m.error), done = (r.made || []).filter((m: any) => !m.error).map((m: any) => m.name);
      setNote((done.length ? `Sent to Meta for approval: ${done.join(", ")}. Approval usually takes a few minutes; press Connect again to pick them up. ` : "") + bad.map((m: any) => `${m.name}: ${m.error}`).join(" "));
    } catch (e: any) { setNote(e?.message || "Couldn't create the templates."); }
    setBusy("");
  };
  const doSave = async () => { setBusy("Saving"); try { await save("wa", { ...f, token: f.token.trim() }); setF((x) => ({ ...x, token: "" })); toast(f.on ? "WhatsApp is saved and on." : "Saved. WhatsApp is off."); } catch (e: any) { toast(e?.message || "Couldn't save that.", "bad"); } setBusy(""); };
  const test = async () => { setBusy("Testing"); try { const r = await call({ do: "test", to: testTo, tpl: f.tplOtp, phoneId: f.phoneId, lang: f.lang }); if (r?.error) throw new Error(r.error); toast("Sent. A test code (123456) should arrive on WhatsApp in a moment."); } catch (e: any) { toast(e?.message || "The test wasn't sent.", "bad"); } setBusy(""); };
  const tplField = (id: string, label: string, k: string, cat: string, hint: string) => (
    <Field label={label} htmlFor={id} hint={hint}>{acct?.id ? <select id={id} className="input" value={f[k]} onChange={set(k)}><option value="">{tpls(cat).length ? "Choose a template" : "No approved template yet"}</option>{tpls(cat).map((t) => <option key={t.name + t.language} value={t.name}>{t.name} ({t.language})</option>)}{f[k] && !tpls(cat).some((t) => t.name === f[k]) && <option value={f[k]}>{f[k]} (not approved yet)</option>}</select> : <input id={id} className="input" value={f[k]} onChange={set(k)} />}</Field>);
  return (
    <Shell title="WhatsApp" on={!!(w?.on && w.token)} lead={lead}>
      <Toggle id="wa-on" checked={!!f.on} onChange={(v: boolean) => setF({ ...f, on: v })} label="Use WhatsApp" />
      {f.on && <>
        <div className="flex flex-col gap-2 rounded-lg border border-ink-600 p-3" aria-label="Connect WhatsApp">
          <b className="text-ink-100">Connect with your access token</b>
          <p className="text-[13px] text-ink-300">Paste the token and press Connect: the Studio asks Meta for your WhatsApp account, your number and your templates, and fills in the rest.</p>
          <div className="flex flex-wrap gap-2">{WA_LINKS.map(([l, u, t]) => <a key={u} className="btn btn-sm" href={u} target="_blank" rel="noopener noreferrer" title={t}>{l} ↗</a>)}</div>
          <p className="hint">{WA_LINKS[0][2]}</p>
          <WithButton label="Access token" htmlFor="wa-token" hint={w?.token ? "A token is saved. Paste a new one only to replace it." : "It goes straight to your database and is stored encrypted. It is never shown again."}
            button={<button type="button" className="btn btn-pri flex-none" disabled={!!busy || (!f.token.trim() && !w?.token)} onClick={connect}>{busy === "Connecting" ? "Connecting…" : found ? "Connect again" : "Connect"}</button>}>
            <input id="wa-token" className="input min-w-0 flex-1" type="password" autoComplete="off" placeholder={w?.token ? "•••••••• saved" : ""} value={f.token} onChange={(e) => setF({ ...f, token: e.target.value })} />
          </WithButton>
          {note && <p role="status" className="rounded-lg border border-ink-600 px-3 py-2 text-[13px] text-ink-200">{note}</p>}
          {!found && <button type="button" className="self-start text-[12.5px] text-ink-400 underline" onClick={() => setHand(!hand)}>{hand ? "Hide the boxes for filling in by hand" : "Fill in by hand instead"}</button>}
        </div>
        {(found || hand || w?.phoneId) && <div className="grid gap-3 sm:grid-cols-2">
          <Field label={acct ? "Send from" : "Phone number ID"} htmlFor="wa-id" hint={acct ? "The WhatsApp number messages go out from." : "On the API Setup page: a number of about 15 digits labelled “Phone number ID”. It is not the phone number itself."} warn={idLooksLikePhone ? "That looks like the phone number. The Phone number ID is a different, longer number shown under it on the API Setup page. Press Connect and it is filled in for you." : undefined}>
            {acct ? <select id="wa-id" className="input" value={f.phoneId} onChange={(e) => { const id = e.target.value, own = (found || []).find((x) => x.phones.some((p) => p.id === id)); if (own && found && own !== acct) setF((x) => fill(found, { ...x, phoneId: id, waba: own.id })); else setF((x) => ({ ...x, phoneId: id })); }}>{((found && found.length > 1 ? found : [acct]).flatMap((a) => a.phones)).map((p) => <option key={p.id} value={p.id}>{p.number}{p.name ? ` · ${p.name}` : ""}</option>)}{!acct.phones.length && <option value="">No number on this account yet</option>}</select> : <input id="wa-id" className="input" inputMode="numeric" value={f.phoneId} onChange={set("phoneId")} />}</Field>
          {<Field label="Account ID (optional)" htmlFor="wa-waba" hint="Both are on the app's WhatsApp → API Setup page. With the account ID, Connect finds your numbers and templates; with the phone number ID it finds that one number."><input id="wa-waba" className="input" inputMode="numeric" value={f.waba} onChange={set("waba")} /></Field>}
          <Field label="Country code" htmlFor="wa-cc" hint="Added to 10-digit numbers."><input id="wa-cc" className="input" inputMode="numeric" value={f.cc} onChange={set("cc")} /></Field>
          {(!acct || !acct.id) && <Field label="Template language" htmlFor="wa-lang" hint="The language code your templates were approved in, for example en or en_US."><input id="wa-lang" className="input" value={f.lang} onChange={set("lang")} /></Field>}
        </div>}
        <fieldset className="flex flex-col gap-2.5 rounded-lg border border-ink-600 px-3 pb-3 pt-2"><legend className="label px-1">Use it for</legend>
          {WA_FLAGS[kind].map(([k, l]) => <label key={k} className={`flex items-start gap-2.5 text-sm ${barred(k) ? "opacity-60" : ""}`}><input type="checkbox" className="mt-[3px] h-4 w-4 flex-none" disabled={barred(k)} checked={!!f[k] && !barred(k)} onChange={(e) => setF({ ...f, [k]: e.target.checked })} /><span>{l}{barred(k) ? OFF_BY_STUDIO : ""}</span></label>)}
        </fieldset>
        {acct?.id && missing.length > 0 && <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-400/5 px-3 py-2 text-[13px] text-amber-100" role="status"><span>{waiting.length ? `Waiting for Meta to approve: ${waiting.join(", ")}.` : `Your account has no approved template yet for ${missing.map((m) => (m === "otp" ? "codes" : m === "order" ? "order alerts" : "enquiry alerts")).join(", ")}.`}</span>{!waiting.length && <button type="button" className="btn btn-sm btn-pri" disabled={!!busy} onClick={makeTemplates}>{busy === "Creating" ? "Creating…" : "Create the templates for me"}</button>}</div>}
        {needOtp && tplField("wa-otp", "Template for codes (Authentication)", "tplOtp", "AUTHENTICATION", acct ? "An approved Authentication template with a copy-code button." : "WhatsApp Manager → Message templates → Create → Authentication → Copy code. Type its name here exactly.")}
        {f.login && <Field label="Who gets sign-in codes on WhatsApp" htmlFor="wa-phones" hint="One per line: the email they sign in with, an equals sign, their WhatsApp number. Anyone not listed gets the email only."><textarea id="wa-phones" className="input min-h-[70px] font-mono text-[13px]" placeholder={"owner@example.com = +91 98xxxxxxxx"} value={f.phones} onChange={set("phones")} /></Field>}
        {wantAlerts && <>
          <Field label="Send alerts to (up to 3 numbers)" htmlFor="wa-to"><input id="wa-to" className="input" placeholder="+91 98xxxxxxxx, +91 97xxxxxxxx" value={f.to} onChange={set("to")} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            {f.orderAlert && tplField("wa-ord", "Template for a new order (Utility)", "tplOrder", "UTILITY", "Body with four variables, for example: New order {{1}} from {{2}}. To pay {{3}}. {{4}}")}
            {f.enquiryAlert && tplField("wa-enq", "Template for a new enquiry (Utility)", "tplEnquiry", "UTILITY", "Body with three variables, for example: New enquiry from {{1}} ({{2}}): {{3}}")}
          </div>
        </>}
        {needOtp && f.tplOtp && String(f.phoneId).trim() && !idLooksLikePhone && <WithButton label="Try it: send a test code to" htmlFor="wa-test" hint="Uses what is saved: press Save first after a change." button={<button type="button" className="btn flex-none" disabled={!!busy || !testTo.trim()} onClick={test}>{busy === "Testing" ? "Sending…" : "Send test"}</button>}><input id="wa-test" className="input min-w-0 flex-1" inputMode="tel" placeholder="+91 98xxxxxxxx" value={testTo} onChange={(e) => setTestTo(e.target.value)} /></WithButton>}
        <p className="hint">WhatsApp only lets a business start a conversation with a template Meta has approved. If WhatsApp refuses a message, the enquiry or order is still saved and emailed, and says why under “WhatsApp”.</p>
      </>}
      <div className={FOOT}><button type="button" className="btn btn-pri" disabled={!ok || !!busy} onClick={doSave}>{busy === "Saving" ? "Saving…" : "Save"}</button>{w && <button type="button" className="btn btn-danger ml-auto" disabled={!!busy} onClick={async () => { setBusy("Removing"); try { await save("wa", null); setFound(null); setNote(""); toast("WhatsApp removed."); } catch (e: any) { toast(e?.message || "Couldn't remove it.", "bad"); } setBusy(""); }}>Remove</button>}</div>
    </Shell>
  );
}

/** Razorpay for a restaurant's Order now page: paid orders are confirmed by Razorpay's signature, with no checking.
    `plain`: inside the Payments section, under its own switch: just the keys (saving them turns the connection on). */
export type Gateway = "rz" | "cf" | "pe" | "st" | "pp";
type GwDef = { name: string; takes: string; text: { k: string; id: string; label: string; hint?: string; ph?: string; ok?: RegExp; opt?: boolean }[]; secret: string; secretOk?: RegExp; test?: boolean; url: string; where: string; note?: string };
/** The gateways a site's database can charge through, and the keys each one needs. */
export const GATEWAYS: Record<Gateway, GwDef> = {
  rz: { name: "Razorpay", takes: "UPI, cards and netbanking", text: [{ k: "keyId", id: "rz-id", label: "Key ID", hint: "Starts with rzp_test_ or rzp_live_.", ph: "rzp_live_…", ok: /^rzp_(test|live)_\w+$/ }], secret: "Key secret", url: "https://dashboard.razorpay.com/app/website-app-settings/api-keys", where: "Razorpay Dashboard → Account & Settings → API Keys", note: "Razorpay shows the secret once; paste it here straight away." },
  cf: { name: "Cashfree", takes: "UPI, cards and netbanking", text: [{ k: "appId", id: "cf-id", label: "App ID", hint: "Also called x-client-id." }], secret: "Secret key", test: true, url: "https://merchant.cashfree.com/merchants/pg/developers/api-keys", where: "Cashfree Dashboard → Developers → API Keys" },
  pe: { name: "PhonePe", takes: "UPI, cards and netbanking", text: [{ k: "clientId", id: "pe-id", label: "Client ID" }, { k: "version", id: "pe-version", label: "Client version", hint: "The number PhonePe shows next to the client ID. Usually 1.", ph: "1", ok: /^\d{1,4}$/, opt: true }], secret: "Client secret", test: true, url: "https://business.phonepe.com/", where: "PhonePe Business dashboard → Developer Settings" },
  st: { name: "Stripe", takes: "cards from any country", text: [], secret: "Secret key", secretOk: /^(sk|rk)_(test|live)_\w+$/, url: "https://dashboard.stripe.com/apikeys", where: "Stripe Dashboard → Developers → API keys", note: "It starts with sk_live_ (or sk_test_ to try it with no real money)." },
  pp: { name: "PayPal", takes: "PayPal balances and cards", text: [{ k: "clientId", id: "pp-id", label: "Client ID" }], secret: "Secret", test: true, url: "https://developer.paypal.com/dashboard/applications/live", where: "PayPal Developer Dashboard → Apps & Credentials → your app" },
};
/** A gateway's keys, inside its card under Payments. They go to the site's own database, encrypted, and never into the site. */
export function GatewayForm({ where, gw }: { where: Where | null | undefined; gw: Gateway }) {
  const G = GATEWAYS[gw], toast = useToast(), { saved, err, save } = useSaved(where || null);
  const blank = () => ({ ...Object.fromEntries(G.text.map((t) => [t.k, ""])), secret: "", test: false }) as Record<string, any>;
  const [f, setF] = useState<Record<string, any>>(blank), [busy, setBusy] = useState(false);
  const z: any = (saved as any)?.[gw];
  useEffect(() => { setF(z ? { ...blank(), ...Object.fromEntries(G.text.map((t) => [t.k, txt(z[t.k])])), test: !!z.test } : blank()); }, [saved]); // eslint-disable-line react-hooks/exhaustive-deps
  const Box = ({ children, on }: { children: React.ReactNode; on?: boolean }) => <div className="flex flex-col gap-3 rounded-lg border border-ink-600 p-3" aria-label={`${G.name} keys`}><b className="flex items-center gap-2 text-ink-100">Your {G.name} keys{on != null && <span className={`chip ${on ? "border-emerald-400/50 text-emerald-200" : "border-ink-600 text-ink-400"}`}>{on ? "Saved" : "Not saved yet"}</span>}</b>{children}</div>;
  if (where === undefined) return Box({ children: <Missing why="Checking your database…" /> });
  if (!where) return Box({ children: <Missing why={`${G.name} keys are kept on the site's own Cloudflare database. Host this site on Cloudflare (Host to External Services), and sign in to it on this device as its owner; the boxes for the keys then show here.`} /> });
  if (err) return Box({ children: <Missing why={err} /> });
  if (saved && !(gw in (saved as any))) return Box({ children: <Missing why={`This site's database is an older version that doesn't know ${G.name} yet. Update it once: Settings → Hostings → Sites and hosting accounts, next to this site (Data → Update this database). Then come back here.`} /> });
  const ok = G.text.every((t) => (t.opt && !String(f[t.k]).trim()) || (String(f[t.k]).trim() && (!t.ok || t.ok.test(String(f[t.k]).trim())))) && (f.secret.trim() ? !G.secretOk || G.secretOk.test(f.secret.trim()) : !!z?.secret);
  return Box({ on: !!z?.secret, children: <>
      <div className="grid gap-3 sm:grid-cols-2">
        {G.text.map((t) => <Field key={t.k} label={t.label} htmlFor={t.id} hint={t.hint}><input id={t.id} className="input font-mono" placeholder={t.ph} autoComplete="off" value={f[t.k]} onChange={(e) => setF({ ...f, [t.k]: e.target.value })} /></Field>)}
        <Secret id={`${gw}-secret`} label={G.secret} saved={!!z?.secret} value={f.secret} onChange={(v) => setF({ ...f, secret: v })} />
      </div>
      {G.test && <Toggle id={`${gw}-test`} checked={!!f.test} onChange={(v: boolean) => setF({ ...f, test: v })} label="These are test (sandbox) keys: no real money moves" />}
      <p className="text-[12.5px] text-ink-400">Get them from <a className="text-brand-300 underline" href={G.url} target="_blank" rel="noopener noreferrer">{G.where} ↗</a>. {G.note ? G.note + " " : ""}The keys go to your own database, stored encrypted, and are never put in the site.</p>
      <div className="flex gap-2"><button type="button" className="btn btn-sm btn-pri" disabled={!ok || busy} onClick={async () => { setBusy(true); try { await save(gw, { ...Object.fromEntries(G.text.map((t) => [t.k, String(f[t.k]).trim()])), secret: f.secret.trim(), ...(G.test ? { test: !!f.test } : {}), ...(gw === "rz" ? { on: true } : {}) }); setF((x) => ({ ...x, secret: "" })); toast(`${G.name} keys saved.`); } catch (e: any) { toast(e?.message || "Couldn't save that.", "bad"); } setBusy(false); }}>{busy ? "Saving…" : "Save the keys"}</button>
        {z && <button type="button" className="btn btn-sm btn-danger ml-auto" disabled={busy} onClick={async () => { setBusy(true); try { await save(gw, null); toast(`${G.name} keys removed.`); } catch (e: any) { toast(e?.message || "Couldn't remove them.", "bad"); } setBusy(false); }}>Remove</button>}</div>
    </> });
}
/** Petpooja: the restaurant's billing system takes each order placed on the site and reports its status back. */
export function PetpoojaForm({ where }: { where: Where | null | undefined }) {
  const toast = useToast(), { saved, err, save } = useSaved(where || null);
  const [f, setF] = useState({ on: false, appKey: "", restId: "", secret: "", token: "" }), [busy, setBusy] = useState(false);
  const z: any = (saved as any)?.pos;
  useEffect(() => { setF({ on: !!z?.on, appKey: txt(z?.appKey), restId: txt(z?.restId), secret: "", token: "" }); }, [saved]); // eslint-disable-line react-hooks/exhaustive-deps
  const lead = "Orders placed on the site go straight into your Petpooja, like orders from a delivery app. When Petpooja accepts an order, marks the food ready, dispatches, delivers or cancels it, the order here and the guest's tracking page follow by themselves.";
  if (where === undefined) return <Shell title="Petpooja" lead={lead}><Missing why="Checking your database…" /></Shell>;
  if (!where) return <Shell title="Petpooja" lead={lead}><Missing why="Petpooja's keys are kept on the site's own Cloudflare database. Host this site on Cloudflare (Host to External Services), and sign in to it on this device as its owner; the boxes for the keys then show here." /></Shell>;
  if (err) return <Shell title="Petpooja" lead={lead}><Missing why={err} /></Shell>;
  if (saved && !("pos" in (saved as any))) return <Shell title="Petpooja" lead={lead}><Missing why="This site's database is an older version that doesn't know Petpooja yet. Update it once: Settings → Hostings → Sites and hosting accounts, next to this site (Data → Update this database). Then come back here." /></Shell>;
  const ok = f.appKey.trim() && f.restId.trim() && (f.secret.trim() || z?.secret) && (f.token.trim() || z?.token);
  return (
    <Shell title="Petpooja" lead={lead} on={!!z?.on && !!z?.secret && !!z?.token}>
      <Toggle id="pos-on" checked={f.on} onChange={(v: boolean) => setF({ ...f, on: v })} label="Send the site's orders to Petpooja" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="App key" htmlFor="pos-key"><input id="pos-key" className="input font-mono" autoComplete="off" value={f.appKey} onChange={(e) => setF({ ...f, appKey: e.target.value })} /></Field>
        <Field label="Restaurant ID (restID)" htmlFor="pos-rest" hint="Petpooja's mapping code for this outlet."><input id="pos-rest" className="input font-mono" autoComplete="off" value={f.restId} onChange={(e) => setF({ ...f, restId: e.target.value })} /></Field>
        <Secret id="pos-secret" label="App secret" saved={!!z?.secret} value={f.secret} onChange={(v) => setF({ ...f, secret: v })} />
        <Secret id="pos-token" label="Access token" saved={!!z?.token} value={f.token} onChange={(v) => setF({ ...f, token: v })} />
      </div>
      <ul className="list-disc pl-5 text-[12.5px] text-ink-400">
        <li>Petpooja gives these four values to a restaurant when it switches on an online-ordering integration for the outlet. Ask your Petpooja account manager for “online ordering API credentials” for your own website.</li>
        <li>Give each dish its Petpooja item ID (Menu → a dish → Petpooja item ID; sizes have their own variation ID). An order with a dish that has no ID stays here and is marked “Not sent to Petpooja”.</li>
        <li>Extras chosen by the guest are sent as a note on the item, with their price added to it.</li>
        <li>The keys go to your own database, stored encrypted, and are never put in the site.</li>
      </ul>
      <div className="flex gap-2"><button type="button" className="btn btn-sm btn-pri" disabled={!ok || busy} onClick={async () => { setBusy(true); try { await save("pos", { on: f.on, appKey: f.appKey.trim(), restId: f.restId.trim(), secret: f.secret.trim(), token: f.token.trim() }); toast(f.on ? "Petpooja is saved and on." : "Petpooja is saved (switched off)."); } catch (e: any) { toast(e?.message || "Couldn't save that.", "bad"); } setBusy(false); }}>{busy ? "Saving…" : "Save"}</button>
        {z && <button type="button" className="btn btn-sm btn-danger ml-auto" disabled={busy} onClick={async () => { setBusy(true); try { await save("pos", null); toast("Petpooja removed."); } catch (e: any) { toast(e?.message || "Couldn't remove it.", "bad"); } setBusy(false); }}>Remove</button>}</div>
    </Shell>
  );
}
/** SMS (text messages) through the owner's own MSG91 or Twilio account: codes for signing in and for checkout. */
export function SmsForm({ where, kind, allow }: { where: Where | null | undefined; kind: "studio" | "site"; allow?: MsgAllow }) {
  const toast = useToast(), { saved, err, save } = useSaved(where || null);
  const blank = { on: false, provider: "msg91", key: "", tpl: "", varName: "var1", sender: "", sid: "", from: "", text: "{code} is your verification code for {site}.", cc: "91", phones: "", chan: "sms", email: "", login: false, orderOtp: false };
  const [f, setF] = useState<Record<string, any>>(blank), [busy, setBusy] = useState(""), [testTo, setTestTo] = useState("");
  useEffect(() => { const z = saved?.sms; setF(z ? { ...blank, ...z, provider: z.provider || "msg91", varName: z.varName || "var1", text: z.text || blank.text, cc: z.cc || "91", key: "" } : blank); }, [saved]); // eslint-disable-line react-hooks/exhaustive-deps
  const lead = <>Optional. Codes go out as text messages through your own account with one SMS company, which charges you per message. Nothing is sent by SMS unless this is switched on and a box under “Use it for” is ticked; email keeps working as before.</>;
  if (where === undefined) return <Shell title="SMS" lead={lead}><Missing why="Checking your database…" /></Shell>;
  if (!where) return <Shell title="SMS" lead={lead}><Missing why={kind === "studio" ? "SMS is kept on the Studio's Cloudflare database. Host the Studio on Cloudflare (Settings → Hostings) and sign in there as its owner." : "SMS needs this site hosted on your Cloudflare database, and you signed in to it on this device as its owner."} /></Shell>;
  if (err) return <Shell title="SMS" lead={lead}><Missing why={err} /></Shell>;
  const z = saved?.sms, set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value }), tw = f.provider === "twilio", mc = f.provider === "mcentral", sd = f.provider === "sent";
  const barred = (k: string) => (k === "login" && mc) || (!!allow && ((k === "login" && !allow.login) || (k === "orderOtp" && !allow.checkout)));
  const whyOff = (k: string) => (k === "login" && mc ? " (not with Message Central: it makes its own codes, so it can't carry the sign-in code that is also emailed)" : OFF_BY_STUDIO);
  const flags: [string, string][] = kind === "studio" ? [["login", "Send Studio sign-in codes by SMS too"]] : [["login", "Send this site's admin sign-in codes by SMS too"], ["orderOtp", "Ask customers to verify their mobile number with an SMS code before ordering (restaurant Order now page and shop checkout)"]];
  // a key saved for another SMS company doesn't count for this one
  const keyKept = !!z?.key && (z.provider || "msg91") === f.provider;
  const filled = (!!f.key.trim() || keyKept) && (tw ? !!String(f.sid).trim() && !!String(f.from).trim() : mc ? !!String(f.sid).trim() : !!String(f.tpl).trim()), ok = !f.on || filled;
  const doSave = async () => { setBusy("Saving"); try { const v: any = { ...f, key: f.key.trim() }; for (const k of ["login", "orderOtp"]) if (barred(k)) v[k] = false; if (sd && (!v.varName || v.varName === "var1")) v.varName = "code"; await save("sms", v); setF((x) => ({ ...x, key: "" })); toast(f.on ? "SMS is saved and on." : "Saved. SMS is off."); } catch (e: any) { toast(e?.status === 400 ? "This needs the database updated once (Settings → Hostings → Update this database)." : e?.message || "Couldn't save that.", "bad"); } setBusy(""); };
  const test = async () => { setBusy("Testing"); try { const r = await cfCall<any>(where.api, "/set/sms?scope=" + encodeURIComponent(where.scope), { method: "POST", body: JSON.stringify({ to: testTo }) }); if (r?.error) throw new Error(r.error); toast(r?.own === false ? "Sent. A test code should arrive by SMS in a moment (Message Central chooses the code)." : "Sent. A test code (123456) should arrive by SMS in a moment."); } catch (e: any) { toast(e?.status === 404 ? "This needs the database updated once (Settings → Hostings → Update this database)." : e?.message || "The test wasn't sent.", "bad"); } setBusy(""); };
  return (
    <Shell title="SMS" on={!!(z?.on && z.key)} lead={lead}>
      <Toggle id={"sms-on-" + kind} checked={!!f.on} onChange={(v: boolean) => setF({ ...f, on: v })} label="Use SMS" />
      {f.on && <>
        <Field label="SMS company" htmlFor="sms-prov" hint="In India an SMS normally needs a template registered on DLT: MSG91 walks you through that; Message Central sends its own ready-made code message without it."><select id="sms-prov" className="input" value={f.provider} onChange={set("provider")}><option value="msg91">MSG91 (India, your DLT template)</option><option value="mcentral">Message Central (no DLT of your own)</option><option value="sent">Sent (SMS, WhatsApp or RCS)</option><option value="twilio">Twilio (worldwide)</option></select></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          {tw ? <>
            <Field label="Account SID" htmlFor="sms-sid" hint="On Twilio's console home page; it starts with AC."><input id="sms-sid" className="input font-mono" value={f.sid} onChange={set("sid")} /></Field>
            <Secret id="sms-key" label="Auth token" saved={keyKept} value={f.key} onChange={(v) => setF({ ...f, key: v })} />
            <Field label="Send from" htmlFor="sms-from" hint="Your Twilio number with its country code (+1…), or a Messaging Service SID (MG…)."><input id="sms-from" className="input" value={f.from} onChange={set("from")} /></Field>
            <Field label="Country code" htmlFor="sms-cc" hint="Added to 10-digit numbers."><input id="sms-cc" className="input" inputMode="numeric" value={f.cc} onChange={set("cc")} /></Field>
            <div className="sm:col-span-2"><Field label="The message" htmlFor="sms-text" hint="{code} becomes the 6-digit code and {site} the name. Where SMS templates must be registered (India: DLT), use the registered wording exactly."><input id="sms-text" className="input" value={f.text} onChange={set("text")} /></Field></div>
          </> : mc ? <>
            <Field label="Customer ID" htmlFor="sms-sid" hint="Message Central console → your profile: it starts with C-."><input id="sms-sid" className="input font-mono" value={f.sid} onChange={set("sid")} /></Field>
            <Secret id="sms-key" label="Password" saved={keyKept} value={f.key} onChange={(v) => setF({ ...f, key: v })} hint={keyKept ? "A password is saved. Leave this empty to keep it, or type a new one to replace it." : "The password of your Message Central account: its API signs in with it. It goes straight to your database and is stored encrypted."} />
            <Field label="Account email (optional)" htmlFor="sms-email" hint="The email you sign in to Message Central with. Fill it in if the test says the sign-in wasn't accepted."><input id="sms-email" className="input" type="email" value={f.email} onChange={set("email")} /></Field>
            <Field label="Country code" htmlFor="sms-cc" hint="Added to 10-digit numbers."><input id="sms-cc" className="input" inputMode="numeric" value={f.cc} onChange={set("cc")} /></Field>
            <p className="hint sm:col-span-2">Message Central writes and sends the code message itself and checks the code the customer types, so there is no template to choose here.</p>
          </> : sd ? <>
            <Secret id="sms-key" label="API key" saved={keyKept} value={f.key} onChange={(v) => setF({ ...f, key: v })} hint={keyKept ? "A key is saved. Leave this empty to keep it, or type a new one to replace it." : "Sent dashboard → API keys. It goes straight to your database and is stored encrypted."} />
            <Field label="Template ID" htmlFor="sms-tpl" hint="Sent dashboard → Templates: the ID of your verification-code template (a long code with dashes)."><input id="sms-tpl" className="input font-mono" value={f.tpl} onChange={set("tpl")} /></Field>
            <Field label="Name of the code's variable" htmlFor="sms-var" hint="As named in the template, for example code or otp."><input id="sms-var" className="input" value={f.varName === "var1" ? "code" : f.varName} onChange={set("varName")} /></Field>
            <Field label="Send on" htmlFor="sms-chan" hint="“Sent chooses” lets Sent pick the channel and fall back to another if one fails."><select id="sms-chan" className="input" value={f.chan || "sms"} onChange={set("chan")}><option value="sms">SMS</option><option value="sent">Sent chooses (SMS, WhatsApp or RCS)</option><option value="whatsapp">WhatsApp</option><option value="rcs">RCS</option></select></Field>
            <Field label="Country code" htmlFor="sms-cc" hint="Added to 10-digit numbers."><input id="sms-cc" className="input" inputMode="numeric" value={f.cc} onChange={set("cc")} /></Field>
          </> : <>
            <Secret id="sms-key" label="Auth key" saved={keyKept} value={f.key} onChange={(v) => setF({ ...f, key: v })} hint={keyKept ? "A key is saved. Leave this empty to keep it, or type a new one to replace it." : "MSG91 → your name (top right) → Authkey. It goes straight to your database and is stored encrypted."} />
            <Field label="Template ID (flow)" htmlFor="sms-tpl" hint="MSG91 → SMS → Templates: the ID of your approved code template."><input id="sms-tpl" className="input font-mono" value={f.tpl} onChange={set("tpl")} /></Field>
            <Field label="Name of the code's variable" htmlFor="sms-var" hint="As written in the template between ## marks, for example var1 or OTP."><input id="sms-var" className="input" value={f.varName} onChange={set("varName")} /></Field>
            <Field label="Sender ID (optional)" htmlFor="sms-sender" hint="Your 6-letter DLT header. Leave empty to use the one saved with the template."><input id="sms-sender" className="input" value={f.sender} onChange={set("sender")} /></Field>
            <Field label="Country code" htmlFor="sms-cc" hint="Added to 10-digit numbers."><input id="sms-cc" className="input" inputMode="numeric" value={f.cc} onChange={set("cc")} /></Field>
          </>}
        </div>
        <fieldset className="flex flex-col gap-2.5 rounded-lg border border-ink-600 px-3 pb-3 pt-2"><legend className="label px-1">Use it for</legend>
          {flags.map(([k, l]) => <label key={k} className={`flex items-start gap-2.5 text-sm ${barred(k) ? "opacity-60" : ""}`}><input type="checkbox" className="mt-[3px] h-4 w-4 flex-none" disabled={barred(k)} checked={!!f[k] && !barred(k)} onChange={(e) => setF({ ...f, [k]: e.target.checked })} /><span>{l}{barred(k) ? whyOff(k) : ""}</span></label>)}
        </fieldset>
        {f.login && !barred("login") && <Field label="Who gets sign-in codes by SMS" htmlFor="sms-phones" hint="One per line: the email they sign in with, an equals sign, their mobile number. Anyone not listed gets the email only."><textarea id="sms-phones" className="input min-h-[70px] font-mono text-[13px]" placeholder={"owner@example.com = +91 98xxxxxxxx"} value={f.phones} onChange={set("phones")} /></Field>}
        {kind === "site" && <p className="hint">If WhatsApp is also set up to verify customers, the checkout lets each customer choose WhatsApp or SMS.</p>}
        {z?.on && z.key && <WithButton label="Try it: send a test code to" htmlFor="sms-test" hint="Uses what is saved: press Save first after a change." button={<button type="button" className="btn flex-none" disabled={!!busy || testTo.replace(/\D/g, "").length < 10} onClick={test}>{busy === "Testing" ? "Sending…" : "Send test"}</button>}><input id="sms-test" className="input min-w-0 flex-1" inputMode="tel" placeholder="+91 98xxxxxxxx" value={testTo} onChange={(e) => setTestTo(e.target.value)} /></WithButton>}
      </>}
      <div className={FOOT}><button type="button" className="btn btn-pri" disabled={!ok || !!busy} onClick={doSave}>{busy === "Saving" ? "Saving…" : "Save"}</button>{z && <button type="button" className="btn btn-danger ml-auto" disabled={!!busy} onClick={async () => { setBusy("Removing"); try { await save("sms", null); toast("SMS removed."); } catch (e: any) { toast(e?.message || "Couldn't remove that.", "bad"); } setBusy(""); }}>Remove</button>}</div>
    </Shell>
  );
}

/** A project's email (Resend): the Studio's own Resend (set in Settings → Hostings), or this project's own key and sender
 *  ("Custom"). The Studio's owner chooses which; the site's owner can fill in the key and sender once it is Custom. */
export function MailForm({ where, studio, bare }: { bare?: boolean; where: Where | null | undefined; /** True in the Studio's editor (the Studio's owner), false in the site's own admin page. */ studio: boolean }) {
  const toast = useToast(), { saved, err, save } = useSaved(where || null);
  const [f, setF] = useState({ on: false, from: "", key: "" }), [busy, setBusy] = useState("");
  useEffect(() => { const m = saved?.mail; setF({ on: !!m?.on, from: txt(m?.from), key: "" }); }, [saved]);
  const lead = <>Sign-in codes and the emails this project sends (enquiries, orders, stock, reviews) go out through Resend. By default that is the Studio's Resend (Settings → Hostings). Choose Custom to send this project's emails from its own Resend account and sender.</>;
  if (where === undefined) return <Shell bare={bare} title="Email (Resend)" lead={lead}><Missing why="Checking your database…" /></Shell>;
  if (!where) return <Shell bare={bare} title="Email (Resend)" lead={lead}><Missing why="Email settings are kept on the project's Cloudflare database. Publish the site to Cloudflare and sign in there to set them." /></Shell>;
  if (err) return <Shell bare={bare} title="Email (Resend)" lead={lead}><Missing why={err} /></Shell>;
  const m = saved?.mail, keyKept = !!m?.key, custom = studio ? f.on : !!m?.on;
  const fromOk = /<[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>$|^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(f.from.trim()), keyOk = !!f.key.trim() || keyKept;
  const ok = !custom ? true : fromOk && keyOk && (!f.key.trim() || /^re_\S{8,}$/.test(f.key.trim()));
  const doSave = async () => {
    setBusy("Saving");
    try { await save("mail", { on: studio ? f.on : !!m?.on, from: f.from.trim(), key: f.key.trim() }); toast(custom ? "This project's emails now go out through its own Resend." : "Saved. This project uses the Studio's Resend."); }
    catch (e: any) { toast(e?.message || "Couldn't save that.", "bad"); }
    setBusy("");
  };
  return (
    <Shell bare={bare} title="Email (Resend)" on={!!(m?.on && m.key && m.from)} lead={lead}>
      <fieldset className="flex flex-col gap-2 rounded-lg border border-ink-600 px-3 pb-3 pt-2" aria-label="Which Resend this project uses"><legend className="label px-1">Send with</legend>
        <label className={`flex items-start gap-2.5 text-sm ${studio ? "" : "opacity-70"}`}><input type="radio" name={"mail-way-" + (studio ? "s" : "x")} className="mt-[3px] h-4 w-4 flex-none" disabled={!studio} checked={!custom} onChange={() => setF({ ...f, on: false })} /><span>The Studio's Resend<span className="block text-ink-400">The key and sender set in the Studio's Settings → Hostings.</span></span></label>
        <label className={`flex items-start gap-2.5 text-sm ${studio ? "" : "opacity-70"}`}><input type="radio" name={"mail-way-" + (studio ? "s" : "x")} className="mt-[3px] h-4 w-4 flex-none" disabled={!studio} checked={custom} onChange={() => setF({ ...f, on: true })} /><span>Custom<span className="block text-ink-400">This project's own Resend key and sender.</span></span></label>
        {!studio && <p className="hint">Which Resend is used is chosen by the Studio's owner.</p>}
      </fieldset>
      {custom && <div className="grid gap-3 sm:grid-cols-2">
        <Secret id={"mail-key-" + (studio ? "s" : "x")} label="Resend API key" saved={keyKept} value={f.key} onChange={(v) => setF({ ...f, key: v })} hint={keyKept ? "A key is saved. Leave this empty to keep it, or type a new one to replace it." : "resend.com/api-keys → Create API key (Sending access is enough). It starts with re_."} />
        <Field label="Emails come from" htmlFor={"mail-from-" + (studio ? "s" : "x")} hint="An address on a domain verified in Resend → Domains, for example Acme <hello@acme.com>."><input id={"mail-from-" + (studio ? "s" : "x")} className="input" placeholder="Name <hello@your-domain.com>" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
        {!ok && <p className="hint sm:col-span-2 text-amber-200">Fill in a key (starting with re_) and a sender like Name &lt;hello@your-domain.com&gt;. Until both are saved, the Studio's Resend is used.</p>}
      </div>}
      <div className={FOOT}><button type="button" className="btn btn-pri" disabled={!ok || !!busy} onClick={doSave}>{busy ? "Saving…" : "Save"}</button></div>
    </Shell>
  );
}

/** In the Studio's Settings → Hostings, under a site: who its admin sign-in codes and other emails come from (the Studio's
 *  Resend, or this project's own key and sender). Only the Studio's owner reaches this. */
export function SiteMailSetting({ cf }: { cf: { api: string; site: string } }) {
  const signed = useSiteDbSigned(cf), where = signed ? { api: cf.api, scope: "site:" + cf.site } : null;
  return <details className="min-w-0"><summary className="cursor-pointer select-none text-ink-300">Studio's Resend or this project's own (Custom)</summary>
    <div className="mt-2">{!signed ? <SiteDbSignIn cf={cf} small what="show this project's email sender" /> : <MailForm where={where} studio />}</div></details>;
}
/** Kept for the places that ask for Razorpay by name. */
export function RazorpayForm({ where }: { where: Where | null | undefined; plain?: boolean }) { return <GatewayForm where={where} gw="rz" />; }

/** Whether this device is signed in to a site's database. Every panel on the page follows a sign-in made in any of them. */
export function useSiteDbSigned(cf?: { api: string; site: string } | null): boolean {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((n) => n + 1); addEventListener("sitedb:in", f); return () => removeEventListener("sitedb:in", f); }, []);
  return !!(cf && cfSession.load(cf.api));
}
/** Signing in to a site's database right where its keys or records are asked for: a 6-digit code by email (or on
 *  WhatsApp where the site sends codes there). Only the site's own people get in. `small` starts as one button. */
export function SiteDbSignIn({ cf, small, what = "see and change what is kept there" }: { cf: { api: string; site: string }; small?: boolean; what?: string }) {
  const [open, setOpen] = useState(!small), [email, setEmail] = useState(""), [code, setCode] = useState(""), [sent, setSent] = useState(false), [busy, setBusy] = useState(false), [err, setErr] = useState(""), [own, setOwn] = useState<string | null>(null);
  const send = async (e?: React.FormEvent, to = email.trim()) => {
    e?.preventDefault(); setErr(""); setOwn(null); setBusy(true);
    try { await cfSendCode(cf.api, to, cf.site); setEmail(to); setSent(true); }
    catch (x: any) { const o = resendTestOnly(x?.message || ""); const dom = resendDomainBlocked(x?.message || ""); if (o && o !== to.toLowerCase()) { setOwn(o); setErr(`This site's sign-in email is still in test mode, so codes can only go to ${o}.`); } else if (dom) setErr(`Resend won't send from ${dom}: the Resend key isn't verified for that domain. In Settings → Hostings → Sign-in emails (Resend), save a key and a sender on a domain verified in Resend, then use "Update the database" on this site.`); else setErr(x?.message || "Couldn't send the code. Check your connection."); }
    setBusy(false);
  };
  const verify = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      await cfVerifyCode(cf.api, email.trim(), code);
      const who = await cfSignedIn(cf.api);
      if (who && (await cfRole(cf.api, "site:" + cf.site))) dispatchEvent(new Event("sitedb:in"));
      else { cfSession.clear(cf.api); setSent(false); setCode(""); setErr(`${who || "That email"} isn't one of this site's people. Sign in with the owner's email, or add this one under the site's hosting window → People.`); }
    } catch (x: any) { setErr(x?.message || "Couldn't sign in."); }
    setBusy(false);
  };
  if (!open) return <div className="flex flex-wrap items-center gap-2 rounded-lg border border-ink-600 p-3 text-[13px] text-ink-300" aria-label="Sign in to this site's database"><span className="min-w-0 flex-1 basis-48">This device isn't signed in to the site's database yet.</span><button type="button" className="btn btn-sm" onClick={() => setOpen(true)}>Sign in</button></div>;
  return <section className="card flex flex-col gap-3 p-5" aria-label="Sign in to this site's database">
    <h3 className="text-[15px] font-extrabold">Sign in to this site's database</h3>
    <p className="text-sm text-ink-300">This device isn't signed in to the site's own database yet, so it can't {what}. Sign in once with the site owner's email (or an editor's): we send a 6-digit code.</p>
    {!sent ? <form className="flex flex-wrap items-end gap-2" onSubmit={send}>
      <div className="min-w-0 flex-1 basis-56"><Field label="Email" htmlFor={"sdb-email-" + cf.site}><input id={"sdb-email-" + cf.site} className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field></div>
      <button className="btn btn-pri" disabled={busy || !email.includes("@")}>{busy ? "Sending…" : "Send me a code"}</button>
    </form> : <form className="flex flex-col gap-2" onSubmit={verify}>
      <p className="text-sm text-ink-300">Enter the code sent to <b className="text-ink-100">{email}</b>. It can take a minute; check spam too.</p>
      <div className="flex flex-wrap items-end gap-2"><div className="min-w-0 flex-1 basis-40"><Field label="Code" htmlFor={"sdb-code-" + cf.site}><input id={"sdb-code-" + cf.site} className="input font-mono text-lg tracking-widest" inputMode="numeric" autoComplete="one-time-code" maxLength={10} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} /></Field></div>
        <button className="btn btn-pri" disabled={busy || code.length < 6}>{busy ? "Checking…" : "Sign in"}</button></div>
      <button type="button" className="btn btn-ghost btn-sm self-start" disabled={busy} onClick={() => { setSent(false); setCode(""); }}>Use another email or send a new code</button>
    </form>}
    {err && <p role="alert" className="rounded-lg border border-amber-400/40 bg-amber-400/5 px-3 py-2 text-[13px] text-amber-100">{err}</p>}
    {own && !sent && <button type="button" className="btn btn-sm self-start" disabled={busy} onClick={() => send(undefined, own)}>Send the code to {own}</button>}
  </section>;
}

/** What each tracking service calls the things it needs, and where the shop finds them. */
const TK_UI: Record<string, { f: Record<string, string>; where: string; codes?: boolean; opt?: string[] }> = {
  bluedart: { f: { key: "Client ID (API key)", secret: "Client secret", user: "Login ID", account: "Tracking licence key" }, where: "Blue Dart gives these with an API account: ask your Blue Dart account manager for “API gateway access for tracking”. The login ID and licence key are the ones of your customer account." },
  delhivery: { f: { key: "API token" }, where: "Delhivery One → Settings → API setup (or ask your Delhivery account manager for the live API token)." },
  dtdc: { f: { key: "Tracking API token" }, where: "DTDC gives a tracking token (X-Access-Token) with an API account: ask your DTDC branch or account manager." },
  xpressbees: { f: { user: "Account email", secret: "Password" }, where: "The email and password of your Xpressbees shipping account." },
  ecom: { f: { user: "API username", secret: "API password" }, where: "Ecom Express gives an API username and password with your account." },
  shiprocket: { f: { user: "API user's email", secret: "API user's password" }, where: "Shiprocket → Settings → API → Add new API user. Use that API user here, not your own sign-in. It follows every courier you book through Shiprocket." },
  nimbuspost: { f: { user: "Account email", secret: "Password" }, where: "NimbusPost → Settings → API. It follows every courier you book through NimbusPost." },
  ithink: { f: { key: "Access token", secret: "Secret key" }, where: "iThink Logistics → Settings → API keys. It follows every courier you book through iThink." },
  clickpost: { f: { user: "Username", key: "API key" }, where: "ClickPost → Settings → API keys. ClickPost numbers each courier: add yours under courier codes if a courier isn't found.", codes: true },
  aftership: { f: { key: "API key" }, where: "AfterShip → Tracking → Settings → API keys. It follows almost any courier, Blue Dart, Ekart and India Post among them.", codes: true },
  trackingmore: { f: { key: "API key" }, where: "TrackingMore → Developer → API key. It follows almost any courier.", codes: true },
  ship24: { f: { key: "API key" }, where: "Ship24 → Dashboard → API keys. It finds the courier from the tracking number by itself." },
  track17: { f: { key: "Security key" }, where: "17TRACK → API → Settings → Security key. It finds the courier from the tracking number by itself." },
  custom: { f: { url: "Address to ask ({awb} is the tracking number)", hdr: "Header to send (optional)", key: "Key (optional)" }, where: "Any address that answers with JSON, for a courier or tool not listed. Write the header as “Name: value”; {key} in it is replaced by the key. With a key and no header, the key is sent as “Authorization: Bearer …”.", opt: ["hdr", "key"] },
};
const TK_KIND: Record<string, string> = { courier: "Couriers (their own API)", agg: "Shipping aggregators", multi: "Multi-courier trackers", custom: "Anything else" };
/** Shops: connect the courier's or tracking service's API, so orders show where the parcel is and move on by themselves. */
export function CourierTrackingForm({ where }: { where: Where | null | undefined }) {
  const toast = useToast(), { saved, err, save } = useSaved(where || null);
  const ids = Object.keys(TRACKERS), on = (id: string) => !!(saved as any)?.["tk_" + id]?.on;
  const [id, setId] = useState("bluedart"), [f, setF] = useState<Record<string, any>>({}), [busy, setBusy] = useState(""), [awb, setAwb] = useState(""), [res, setRes] = useState<any>(null);
  const z: any = (saved as any)?.["tk_" + id], U = TK_UI[id], T = TRACKERS[id], sh: any = (saved as any)?.ship;
  useEffect(() => { setF({ user: txt(z?.user), account: txt(z?.account), url: txt(z?.url), hdr: txt(z?.hdr), codes: txt(z?.codes), key: "", secret: "" }); setRes(null); }, [saved, id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const first = ids.find(on); if (first) setId(first); }, [!!saved]); // eslint-disable-line react-hooks/exhaustive-deps
  const lead = <>Connect the courier you ship with, or a tracking service, and each order shows <b className="text-ink-100">where the parcel is</b>: to the customer on their order page and under My account, and to you under Purchased orders. An order moves to Out for delivery and to Completed by itself as the courier scans it. Without a connection, customers still get the courier's own tracking link.</>;
  if (where === undefined) return <Shell title="Courier tracking" lead={lead}><Missing why="Checking your database…" /></Shell>;
  if (!where) return <Shell title="Courier tracking" lead={lead}><Missing why="Tracking keys are kept on the site's own Cloudflare database. Host this site on Cloudflare (Host to External Services), and sign in to it on this device as its owner; the boxes for the keys then show here." /></Shell>;
  if (err) return <Shell title="Courier tracking" lead={lead}><Missing why={err} /></Shell>;
  if (saved && !("ship" in (saved as any))) return <Shell title="Courier tracking" lead={lead}><Missing why="This site's database is an older version that doesn't know courier tracking yet. Update it once: Settings → Hostings → Sites and hosting accounts, next to this site (Data → Update this database). Then come back here." /></Shell>;
  const isSecret = (k: string) => k === "key" || k === "secret", need = T.needs.filter((k) => !(U.opt || []).includes(k));
  const ok = need.every((k) => String(f[k] || "").trim() || (isSecret(k) && z?.[k])) && (id !== "custom" || /^https:\/\/\S+\{awb\}/.test(String(f.url || "").trim()) || /^https:\/\//.test(String(f.url || "").trim()));
  const fields = [...T.needs, ...Object.keys(U.f).filter((k) => !T.needs.includes(k))];
  const live = ids.filter(on);
  return <Shell title="Courier tracking" on={saved ? live.length > 0 : undefined} lead={lead}>
    {live.length > 0 && <p className="flex flex-wrap items-center gap-1.5 text-[13px] text-ink-300" aria-label="Connected tracking services">Connected: {live.map((k) => <button key={k} type="button" className={`chip ${k === id ? "border-brand-400/60 text-brand-200" : "border-emerald-400/50 text-emerald-200"}`} onClick={() => setId(k)}>{TRACKERS[k].name}</button>)}</p>}
    <Field label="Tracking service" htmlFor="tk-id" hint="You can connect more than one: a courier's own connection is used for that courier, a multi-courier tracker for the rest.">
      <select id="tk-id" className="input" value={id} onChange={(e) => setId(e.target.value)}>{Object.entries(TK_KIND).map(([kind, label]) => <optgroup key={kind} label={label}>{ids.filter((k) => TRACKERS[k].kind === kind).map((k) => <option key={k} value={k}>{TRACKERS[k].name}{on(k) ? " (connected)" : ""}</option>)}</optgroup>)}</select></Field>
    <div className="flex flex-col gap-3 rounded-lg border border-ink-600 p-3" aria-label={`${T.name} keys`}>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((k) => isSecret(k)
          ? <Secret key={k} id={`tk-${k}`} label={U.f[k] || k} saved={!!z?.[k]} value={f[k] || ""} onChange={(v) => setF({ ...f, [k]: v })} />
          : <div key={k} className={k === "url" || k === "hdr" ? "sm:col-span-2" : ""}><Field label={U.f[k] || k} htmlFor={`tk-${k}`}><input id={`tk-${k}`} className="input font-mono" autoComplete="off" placeholder={k === "url" ? "https://api.example.com/track?awb={awb}" : k === "hdr" ? "X-Api-Key: {key}" : ""} value={f[k] || ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></Field></div>)}
        {U.codes && <div className="sm:col-span-2"><Field label="Courier codes (optional)" htmlFor="tk-codes" hint={`Only if a courier isn't found: this service's own code for it, as courier=code, separated by commas. The couriers are named: ${Object.keys(COURIERS).filter((c) => c !== "other").slice(0, 8).join(", ")}…`}><input id="tk-codes" className="input font-mono" autoComplete="off" placeholder="bluedart=bluedart, dtdc=dtdc" value={f.codes || ""} onChange={(e) => setF({ ...f, codes: e.target.value })} /></Field></div>}
      </div>
      <p className="text-[12.5px] text-ink-400">{U.where} The keys go to your own database, stored encrypted, and are never put in the site.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-sm btn-pri" disabled={!ok || !!busy} onClick={async () => { setBusy("save"); try { await save(("tk_" + id) as Kind, { user: String(f.user || "").trim(), account: String(f.account || "").trim(), url: String(f.url || "").trim(), hdr: String(f.hdr || "").trim(), codes: String(f.codes || "").trim(), key: String(f.key || "").trim(), secret: String(f.secret || "").trim(), on: true }); toast(`${T.name} tracking saved.`); } catch (e: any) { toast(e?.message || "Couldn't save it.", "bad"); } setBusy(""); }}>{busy === "save" ? "Saving…" : z ? "Save" : "Connect"}</button>
        {z && <button type="button" className="btn btn-sm btn-danger ml-auto" disabled={!!busy} onClick={async () => { setBusy("rm"); try { await save(("tk_" + id) as Kind, null); toast(`${T.name} tracking removed.`); } catch (e: any) { toast(e?.message || "Couldn't remove it.", "bad"); } setBusy(""); }}>Remove</button>}
      </div>
      {z && <WithButton label="Try it with a real tracking number" htmlFor="tk-awb" hint="Use the number of a parcel you have already sent. Nothing is changed on any order."
        button={<button type="button" className="btn" disabled={!!busy || awb.trim().length < 4} onClick={async () => { setBusy("test"); setRes(null); try { setRes(await cfCall<any>(where.api, "/set/test?scope=" + encodeURIComponent(where.scope), { method: "POST", body: JSON.stringify({ name: "tk_" + id, awb: awb.trim() }) })); } catch (e: any) { setRes({ error: e?.message || "Couldn't reach your database." }); } setBusy(""); }}>{busy === "test" ? "Asking…" : "Test"}</button>}>
        <input id="tk-awb" className="input min-w-0 flex-1 font-mono" autoComplete="off" value={awb} onChange={(e) => setAwb(e.target.value)} /></WithButton>}
      {res && (res.error
        ? <p role="status" className="rounded-lg border border-amber-400/40 px-3 py-2 text-[13px] text-amber-100" data-tk-res="bad">{res.error}</p>
        : <div role="status" className="rounded-lg border border-emerald-400/40 px-3 py-2 text-[13px] text-emerald-100" data-tk-res="ok"><b>It works: {res.live.label}</b>{res.live.say && res.live.say !== res.live.label ? ` · ${res.live.say}` : ""}{res.live.eta ? ` · expected ${res.live.eta}` : ""} · {res.live.n} scan{res.live.n === 1 ? "" : "s"}{(res.live.ev || []).length > 0 && <ul className="mt-1 list-disc pl-5 text-emerald-100/80">{res.live.ev.map((e: any, i: number) => <li key={i}>{[e.text, e.place, e.at].filter(Boolean).join(" · ")}</li>)}</ul>}</div>)}
    </div>
    <Toggle id="ship-auto" checked={!sh?.manual} onChange={async (v: boolean) => { try { await save("ship", { manual: !v, quiet: !!sh?.quiet }); } catch (e: any) { toast(e?.message || "Couldn't save it.", "bad"); } }} label="Move orders on by themselves (Out for delivery when the courier picks up, Completed when delivered)" />
    <Toggle id="ship-mail" checked={!sh?.quiet} onChange={async (v: boolean) => { try { await save("ship", { manual: !!sh?.manual, quiet: !v }); } catch (e: any) { toast(e?.message || "Couldn't save it.", "bad"); } }} label="Email the customer the courier and tracking link when an order is marked as shipped" />
    <p className="hint">Customers can also look an order up at <span className="font-mono">checkout.html?track=1</span> on your shop with its order number and the mobile number or email they ordered with: add it to your menu or footer as a custom link named “Track order”.</p>
  </Shell>;
}

/** A site's "Payments & WhatsApp" section (site admin and the Studio's editor). */
export function SiteConnections({ cf, template, cms, site, only }: { cf?: { api: string; site: string } | null; template: string; /** "mail": just the Email (Resend) card (portfolio sites have no WhatsApp or SMS). */ only?: "mail"; /** The site's content.cms (what the Studio allows it). */ cms?: any; /** True in the site's own admin page. */ site?: boolean }) {
  const aw = msgAllow(cms, "wa"), as = msgAllow(cms, "sms");
  const signed = useSiteDbSigned(cf), where = cf && signed ? { api: cf.api, scope: "site:" + cf.site } : null;
  if (only === "mail") return <div className="flex max-w-3xl flex-col gap-4">{cf && !signed && <SiteDbSignIn cf={cf} what="show this project's email settings" />}<MailForm bare where={where} studio={!site} /></div>;
  return <div className="flex max-w-3xl flex-col gap-4">
    {cf && !signed && <SiteDbSignIn cf={cf} what={template === "restaurant" ? "show the boxes for Petpooja's and WhatsApp's keys" : "show the boxes for WhatsApp's keys"} />}
    {template === "restaurant" && <section className="card flex flex-col gap-2 p-5"><h3 className="text-[15px] font-extrabold">Restaurant backend</h3><p className="text-sm text-ink-300">Orders, payments and messages run on the site's own Cloudflare database: it saves each order under Purchased orders, works out what an order costs from your menu, confirms online payments with your payment gateway, passes orders to Petpooja, and sends WhatsApp messages. Keys you enter here stay on that database, encrypted. The payment gateways (Razorpay, Cashfree, PhonePe, Stripe, PayPal) and their keys are under Payments.</p></section>}
    <MailForm where={where} studio={!site} />{template === "restaurant" && <PetpoojaForm where={where} />}{template === "store" && <CourierTrackingForm where={where} />}<WhatsAppForm where={where} kind="site" allow={aw} />
    {/* In the site's own admin page SMS shows only when the Studio lets the site use it for something. */}
    {!(site && !as.login && !as.checkout) && <SmsForm where={where} kind="site" allow={as} />}
    {cf && signed && <GoogleSignInCard api={cf.api} what="this site's admin page (and anything else that signs in to the same database)" />}</div>;
}
/** The Studio's own database, looked up once. */
export function useStudioWhere() { const [w, setW] = useState<Where | null | undefined>(undefined); useEffect(() => { let on = true; studioWhere().then((x) => on && setW(x)); return () => { on = false; }; }, []); return w; }
