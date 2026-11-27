// Settings → Project defaults: per website type, the wording and setup the Studio gives every project — email templates,
// Resend, WhatsApp & SMS, privacy policy, terms, cookie banner wording and payments. Content goes into each site's
// content at its next publish or Push updates; connections stay encrypted on the Studio's database and are used by every
// site on it that follows them. Each site's own admin page can switch a section off and keep its own.
import { useEffect, useMemo, useRef, useState } from "react";
import { TEMPLATES } from "../schema";
import { Ctx, FieldView, type EditorCtx } from "../editor/fields";
import { LEGAL_PH, PD_CONN, PD_KINDS, PD_SECTIONS, cleanPdefs, legalTemplate, ownsOf, pdBase, pdCards, secOn, splitFields, pdSections, pdSeed, type PdId, type ProjectDefaults } from "../lib/projdefaults";
import { clone } from "../lib/util";
import type { Studio, StudioIndex } from "../lib/studio";
import { MailForm, SmsForm, WhatsAppForm, useStudioWhere, type Where } from "./Connections";
import { Toggle, useToast } from "../ui/kit";
import { RichEditor } from "../editor/RichEditor";

const TYPE_NAME: Record<string, string> = { portfolio: "Portfolio", business: "Business", store: "Shop", restaurant: "Restaurant & café", events: "Events" };
const KEY = "site-studio:pd-tab";
const read = (k: string, d: string) => { try { return localStorage.getItem(k) || d; } catch { return d; } };

export function ProjectDefaultsTab({ studio, index, onIndex, demo }: { studio: Studio; index: StudioIndex; onIndex: (i: StudioIndex) => void; demo?: boolean }) {
  const toast = useToast();
  const saved = useMemo(() => cleanPdefs(index.pdefs || {}), [index.pdefs]);
  const [pd, setPd] = useState<ProjectDefaults>(() => clone(saved));
  const [kind, setKind0] = useState(() => { const k = read(KEY, "business"); return (PD_KINDS as readonly string[]).includes(k) ? k : "business"; });
  const secs = pdSections(kind);
  const [sec, setSec] = useState<PdId>(secs[0]);
  const [, setN] = useState(0), bump = () => setN((n) => n + 1);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setPd(clone(saved)); }, [saved]);
  useEffect(() => { if (!secs.includes(sec)) setSec(secs[0]); }, [kind]);
  const setKind = (k: string) => { setKind0(k); try { localStorage.setItem(KEY, k); } catch { /* private mode */ } };
  // Standard values shown for a section never saved don't count as a change until they are edited.
  const seeded = useRef<Record<string, string>>({});
  const unseeded = (d: ProjectDefaults) => { const c = cleanPdefs(d); for (const k of Object.keys(c)) for (const x of Object.keys(c[k])) { const e = (c[k] as any)[x]; if (e.v != null && seeded.current[k + "/" + x] === JSON.stringify(e.v)) delete e.v; if (!Object.keys(e).length) delete (c[k] as any)[x]; } for (const k of Object.keys(c)) if (!Object.keys(c[k]).length) delete c[k]; return c; };
  const dirty = JSON.stringify(unseeded(pd)) !== JSON.stringify(saved);
  const studioW = useStudioWhere();
  const where: Where | null | undefined = studioW ? { ...studioW, pd: kind } : studioW;

  const K = (pd[kind] ||= {}), S = (K[sec] ||= {});
  const turn = async (on: boolean) => {
    S.on = on;
    setPd({ ...pd });
  };
  // A section that is on (they all are until switched off) shows the template's standard values until the Studio saves its own.
  const [seeding, setSeeding] = useState(false);
  useEffect(() => {
    if (!secOn(S) || S.v != null || (PD_CONN[sec] && sec !== "pay")) return;
    let live = true; setSeeding(true);
    (async () => { try { const v = pdSeed(kind, sec, sec === "privacy" || sec === "terms" ? {} : await pdBase(kind)); if (live && S.v == null) { S.v = v; seeded.current[kind + "/" + sec] = JSON.stringify(cleanPdefs({ [kind]: { [sec]: { v } } })[kind]?.[sec]?.v ?? null); bump(); } } catch { /* shown empty */ } finally { if (live) setSeeding(false); } })();
    return () => { live = false; };
  }, [kind, sec, S.on, pd]);
  const save = async () => {
    setBusy(true);
    try {
      const clean = cleanPdefs(pd);
      onIndex(await studio.updateIndex((i) => { if (Object.keys(clean).length) i.pdefs = clean; else delete i.pdefs; }, "Project defaults"));
      toast("Project defaults saved. Sites get them at their next publish, or now with Settings → Updates → Push updates.");
    } catch (e: any) { toast("Not saved: " + (e?.message || e), "bad"); }
    finally { setBusy(false); }
  };
  const onCount = (k: string) => pdSections(k).filter((s) => secOn(pd[k]?.[s])).length;
  const meta = PD_SECTIONS.find((s) => s.id === sec)!;

  return (
    <div className="flex flex-col gap-4 pb-6">
      <p className="max-w-4xl text-sm text-ink-300">What every project of a website type starts with and keeps, set once here: email wording and accounts, the privacy policy and terms, shop policies, the cookie banner's wording, form consent and spam protection, the footer credit, GST invoices and tax, checkout rules and the ways to pay. A section switched on here goes into each site at its next publish or <b className="text-ink-100">Push updates</b>; the site's own admin page shows it locked, with a switch to use its own instead.</p>
      {/* The website types on the left and Save on the right, in one row that stays under the header while scrolling. */}
      <div className="sticky top-14 z-20 -mx-1 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-ink-950/90 px-1 py-1.5 backdrop-blur">
      <div className="flex flex-wrap gap-1 rounded-xl border border-ink-700 bg-ink-900 p-1" role="tablist" aria-label="Website type">
        {PD_KINDS.map((k) => <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)}
          className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${kind === k ? "bg-brand-500/20 text-ink-100" : "text-ink-400 hover:bg-ink-800 hover:text-ink-100"}`}>
          {TYPE_NAME[k] || TEMPLATES[k]?.name || k}{onCount(k) > 0 && <span className="rounded-full bg-brand-500/30 px-1.5 text-[11px] font-bold text-brand-200">{onCount(k)}</span>}</button>)}
      </div>
        <span className="flex-1" />
        <span className="text-[12.5px] text-ink-400" aria-live="polite">{demo ? "Not saved in the demo." : dirty ? "Unsaved changes" : "All changes saved"}</span>
        <button type="button" className="btn btn-pri" disabled={!dirty || busy || demo} onClick={save}>{busy ? "Saving…" : "Save project defaults"}</button>
      </div>
      <div className="grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
        <nav className="card flex flex-row gap-1 overflow-x-auto p-2 lg:sticky lg:top-32 lg:flex-col" aria-label="Sections">
          {secs.map((id) => { const on = secOn(pd[kind]?.[id]), m = PD_SECTIONS.find((s) => s.id === id)!; return (
            <button key={id} type="button" aria-current={sec === id ? "true" : undefined} onClick={() => setSec(id)}
              className={`flex flex-none items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] font-semibold transition ${sec === id ? "bg-ink-800 text-ink-100" : "text-ink-300 hover:bg-ink-800/60"}`}>
              <span aria-hidden className={`h-2 w-2 flex-none rounded-full ${on ? "bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400/60" : "bg-ink-600"}`} />
              <span className="flex-1 whitespace-nowrap">{m.label}</span><span className="sr-only">{on ? "(on)" : "(off)"}</span>
            </button>); })}
        </nav>
        <section className="card flex min-w-0 flex-col gap-4 p-5" aria-label={`${meta.label} for ${TYPE_NAME[kind]}`}>
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1"><h3 className="text-[16px] font-extrabold">{meta.label} <span className="font-semibold text-ink-400">· {TYPE_NAME[kind]}</span></h3><p className="mt-0.5 text-sm text-ink-400">{meta.desc}</p></div>
          </div>
          <Toggle id={`pd-${kind}-${sec}`} checked={secOn(S)} onChange={turn} label={`Give this to every ${TYPE_NAME[kind]} project`} />
          {secOn(S) && <p className="-mt-2 text-[12.5px] text-ink-400">{sec === "mail" || sec === "msg"
            ? `Every ${TYPE_NAME[kind]} site on the Studio's database that follows this section uses the account below instead of its own. A site's admin can switch it off and use its own.`
            : `At the next publish or Push updates this replaces that part of every ${TYPE_NAME[kind]} site, except where the site's admin switched it off.`}{sec === "pay" ? ` Gateway keys saved below are used by the ${TYPE_NAME[kind]} sites on the Studio's database that follow this section, so their payments go to those accounts: check them before you save.` : ""}</p>}
          {!secOn(S) ? <p className="rounded-lg border border-dashed border-ink-600 px-3 py-3 text-sm text-ink-400">Switched off: each site keeps its own {meta.label.toLowerCase()}.</p>
            : S.v == null && !(PD_CONN[sec] && sec !== "pay") ? <p className="text-sm text-ink-400">{seeding ? "Loading the standard wording…" : "The standard wording could not be loaded. Reload the page to try again."}</p> : <Body kind={kind} sec={sec} S={S} where={where} bump={bump} demo={demo} />}
        </section>
      </div>
    </div>
  );
}

function Body({ kind, sec, S, where, bump, demo }: { kind: string; sec: PdId; S: { v?: any }; where: Where | null | undefined; bump: () => void; demo?: boolean }) {
  const tpl = TEMPLATES[kind];
  const noDb = <p className="rounded-lg border border-ink-600 px-3 py-2 text-[13px] text-ink-300">These accounts are kept encrypted on the Studio's Cloudflare database. Sign in to a Studio hosted on Cloudflare (Settings → Hostings) to set them here.</p>;
  if ((sec === "mail" || sec === "msg") && where === null) return noDb;
  if (sec === "mail") return <MailForm where={where} studio bare />;
  if (sec === "msg") return <div className="flex flex-col gap-4"><WhatsAppForm where={where} kind="site" /><SmsForm where={where} kind="site" /></div>;
  if (sec === "privacy" || sec === "terms") {
    const v = (S.v ||= { text: "" });
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="label">Page text</span>
          <span className="flex-1" />
          <button type="button" className="btn btn-sm" onClick={() => { v.text = legalTemplate(kind, sec); bump(); }}>Start again from the standard text</button>
        </div>
        <RichEditor label={sec === "privacy" ? "Privacy policy text" : "Terms of use text"} value={v.text} onChange={(t) => { v.text = t; bump(); }} minRows={18} />
        <p className="hint">Format it with the tool bar, as in Word: headings, lists, tables, links and text styles. Each site's own details go in the place of {LEGAL_PH.map((p, i) => <span key={p}>{i ? " " : ""}<code className="rounded bg-ink-800 px-1">{p}</code></span>)} (from the site's Legal & privacy → Business identity, else its name and contact details); a line such as “GSTIN: {"{gstin}"}” is left out when the site has none. The wording is a starting point, not legal advice.</p>
      </div>
    );
  }
  const cards = pdCards(kind, sec), owns = ownsOf(kind, [sec], sec === "pay" ? "payments" : undefined);
  const root = (S.v ||= {});
  const ctx: EditorCtx = { tpl, root, bump, upload: async () => { throw new Error("Uploads aren't used here."); }, img: () => "", pd: sec === "pay" ? where ?? null : null };
  if (!cards.length) return <p className="text-sm text-ink-400">Nothing to set for this website type.</p>;
  return (
    <Ctx.Provider value={ctx}>
      {sec === "pay" && where === null && <p className="rounded-lg border border-ink-600 px-3 py-2 text-[13px] text-ink-300">Gateway keys are kept on the Studio's Cloudflare database: sign in to a Studio hosted on Cloudflare to set them here. The rest below is saved with the project defaults.{demo ? "" : ""}</p>}
      <div className={`grid gap-3 ${sec === "pay" || sec === "gst" || sec === "checkout" || sec === "formprivacy" ? "xl:grid-cols-2" : ""}`}>
        {cards.map((c) => { const fields = splitFields(c.fields, owns).filter((x) => x.own || (x.f as any).t === "note").map((x) => x.f); if (!fields.some((f: any) => f.t !== "note")) return null; return <div key={c.title} className="flex min-w-0 flex-col gap-3 rounded-xl border border-ink-700 bg-ink-950/40 p-4"><h4 className="text-[14px] font-extrabold">{c.title}</h4>{fields.map((f, i) => <FieldView key={i} f={f} obj={root} base={"pd-" + sec} />)}</div>; })}
      </div>
    </Ctx.Provider>
  );
}
