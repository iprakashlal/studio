// Connections an owner can switch on, kept on their own Cloudflare database (encrypted there, never sent back):
// their own AI API, WhatsApp (Meta's WhatsApp Business Cloud API) and Razorpay.
// Each form shows what is saved (a key only as "saved"), and a key box left empty keeps the saved key.
import { useEffect, useRef, useState } from "react";
import { cfCall, cfSession, signedInApi } from "../lib/cfdb";
import { Field, Toggle, useToast } from "../ui/kit";

type Kind = "ai" | "wa" | "rz" | "cf" | "pe" | "st" | "pp" | "pos";
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
type WaFound = { id: string; phones: { id: string; number: string; name: string }[]; templates: { name: string; status: string; category: string; language: string }[] };
const WA_LINKS: [string, string, string][] = [
  ["1. Get the access token", "https://business.facebook.com/settings/system-users", "Meta Business settings → System users → Add → Generate token, with whatsapp_business_messaging and whatsapp_business_management ticked and “Never” for expiry."],
  ["API Setup (your number)", "https://developers.facebook.com/apps/", "Meta for Developers → your app → WhatsApp → API Setup. No app yet? Create one there with the WhatsApp product."],
  ["Message templates", "https://business.facebook.com/wa/manage/message-templates/", "WhatsApp Manager, where templates and their approval show."],
];
/** WhatsApp through Meta's Cloud API. `kind`: the Studio's own sign-in, or a site (sign-in, alerts, a guest's code).
    Set up from the token alone: Connect asks Meta for the account, its numbers and its templates, and fills the form in. */
export function WhatsAppForm({ where, kind }: { where: Where | null | undefined; kind: "studio" | "site" }) {
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
          <p className="text-[12.5px] text-ink-400">{WA_LINKS[0][2]}</p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[240px] flex-1"><Secret id="wa-token" label="Access token" saved={!!w?.token} value={f.token} onChange={(v) => setF({ ...f, token: v })} hint={w?.token ? "A token is saved. Paste a new one only to replace it." : "It goes straight to your database and is stored encrypted. It is never shown again."} /></div>
            <button type="button" className="btn btn-pri" disabled={!!busy || (!f.token.trim() && !w?.token)} onClick={connect}>{busy === "Connecting" ? "Connecting…" : found ? "Connect again" : "Connect"}</button>
          </div>
          {note && <p role="status" className="rounded-lg border border-ink-600 px-3 py-2 text-[13px] text-ink-200">{note}</p>}
          {!found && <button type="button" className="self-start text-[12.5px] text-ink-400 underline" onClick={() => setHand(!hand)}>{hand ? "Hide the boxes for filling in by hand" : "Fill in by hand instead"}</button>}
        </div>
        {(found || hand || w?.phoneId) && <div className="grid gap-3 sm:grid-cols-2">
          <Field label={acct ? "Send from" : "Phone number ID"} htmlFor="wa-id" hint={acct ? "The WhatsApp number messages go out from." : "On the API Setup page: a number of about 15 digits labelled “Phone number ID”. It is not the phone number itself."} warn={idLooksLikePhone ? "That looks like the phone number. The Phone number ID is a different, longer number shown under it on the API Setup page. Press Connect and it is filled in for you." : undefined}>
            {acct ? <select id="wa-id" className="input" value={f.phoneId} onChange={(e) => { const id = e.target.value, own = (found || []).find((x) => x.phones.some((p) => p.id === id)); if (own && found && own !== acct) setF((x) => fill(found, { ...x, phoneId: id, waba: own.id })); else setF((x) => ({ ...x, phoneId: id })); }}>{((found && found.length > 1 ? found : [acct]).flatMap((a) => a.phones)).map((p) => <option key={p.id} value={p.id}>{p.number}{p.name ? ` · ${p.name}` : ""}</option>)}{!acct.phones.length && <option value="">No number on this account yet</option>}</select> : <input id="wa-id" className="input" inputMode="numeric" value={f.phoneId} onChange={set("phoneId")} />}</Field>
          {<Field label="WhatsApp Business Account ID, or Phone number ID (optional)" htmlFor="wa-waba" hint="Both are on the app's WhatsApp → API Setup page. With the account ID, Connect finds your numbers and templates; with the phone number ID it finds that one number."><input id="wa-waba" className="input" inputMode="numeric" value={f.waba} onChange={set("waba")} /></Field>}
          <Field label="Country code for 10-digit numbers" htmlFor="wa-cc"><input id="wa-cc" className="input" inputMode="numeric" value={f.cc} onChange={set("cc")} /></Field>
          {(!acct || !acct.id) && <Field label="Template language" htmlFor="wa-lang" hint="The language code your templates were approved in, for example en or en_US."><input id="wa-lang" className="input" value={f.lang} onChange={set("lang")} /></Field>}
        </div>}
        <fieldset className="flex flex-col gap-2 rounded-lg border border-ink-700 p-3"><legend className="label px-1">Use it for</legend>
          {WA_FLAGS[kind].map(([k, l]) => <label key={k} className="flex items-start gap-2.5 text-sm"><input type="checkbox" className="mt-0.5" checked={!!f[k]} onChange={(e) => setF({ ...f, [k]: e.target.checked })} /><span>{l}</span></label>)}
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
        {needOtp && f.tplOtp && String(f.phoneId).trim() && !idLooksLikePhone && <div className="flex flex-wrap items-end gap-2"><div className="min-w-[200px] flex-1"><Field label="Try it: send a test code to" htmlFor="wa-test"><input id="wa-test" className="input" inputMode="tel" placeholder="+91 98xxxxxxxx" value={testTo} onChange={(e) => setTestTo(e.target.value)} /></Field></div><button type="button" className="btn" disabled={!!busy || !testTo.trim()} onClick={test}>{busy === "Testing" ? "Sending…" : "Send a test code"}</button></div>}
        <p className="text-[12.5px] text-ink-400">WhatsApp only lets a business start a conversation with a template Meta has approved. If WhatsApp refuses a message, the enquiry or order is still saved and emailed, and says why under “WhatsApp”.</p>
      </>}
      <div className="flex gap-2"><button type="button" className="btn btn-sm btn-pri" disabled={!ok || !!busy} onClick={doSave}>{busy === "Saving" ? "Saving…" : "Save"}</button>{w && <button type="button" className="btn btn-sm btn-danger ml-auto" disabled={!!busy} onClick={async () => { setBusy("Removing"); try { await save("wa", null); setFound(null); setNote(""); toast("WhatsApp removed."); } catch (e: any) { toast(e?.message || "Couldn't remove it.", "bad"); } setBusy(""); }}>Remove</button>}</div>
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
/** Kept for the places that ask for Razorpay by name. */
export function RazorpayForm({ where }: { where: Where | null | undefined; plain?: boolean }) { return <GatewayForm where={where} gw="rz" />; }

/** A site's "Payments & WhatsApp" section (site admin and the Studio's editor). */
export function SiteConnections({ cf, template }: { cf?: { api: string; site: string } | null; template: string }) {
  const where = cf && cfSession.load(cf.api) ? { api: cf.api, scope: "site:" + cf.site } : null;
  return <div className="flex max-w-3xl flex-col gap-4">
    {template === "restaurant" && <section className="card flex flex-col gap-2 p-5"><h3 className="text-[15px] font-extrabold">Restaurant backend</h3><p className="text-sm text-ink-300">Orders, payments and messages run on the site's own Cloudflare database: it saves each order under Purchased orders, works out what an order costs from your menu, confirms online payments with your payment gateway, passes orders to Petpooja, and sends WhatsApp messages. Keys you enter here stay on that database, encrypted. The payment gateways (Razorpay, Cashfree, PhonePe, Stripe, PayPal) and their keys are under Payments.</p></section>}
    {template === "restaurant" && <PetpoojaForm where={where} />}<WhatsAppForm where={where} kind="site" /></div>;
}
/** The Studio's own database, looked up once. */
export function useStudioWhere() { const [w, setW] = useState<Where | null | undefined>(undefined); useEffect(() => { let on = true; studioWhere().then((x) => on && setW(x)); return () => { on = false; }; }, []); return w; }
