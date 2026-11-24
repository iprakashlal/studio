import { useEffect, useMemo, useState } from "react";
import { pushPref, savePrefNow } from "../lib/prefs";
import { cleanDesignSettings, readDesignSettings, writeDesignSettings, type DesignSettings } from "../lib/designs";
import { GROUPS, KINDS, LOOK_AXES, type Kind, type LookRule } from "../lib/designlook";
import { allThemesOf } from "../lib/designer";
import { AI_ENGINES } from "../lib/ai";
import { useAiEngine } from "./AiEngine";
import { AiApiForm, useStudioWhere } from "./Connections";
import { Toggle, useToast } from "../ui/kit";
import { CfDomainCard } from "./HostDialog";
import { useCfAccount } from "./CfPicker";
import { Netlify } from "../lib/netlify";
import { netlifyToken } from "../lib/hosting";
import type { HostCfg } from "../lib/supa";
import type { Session } from "../lib/auth";
import type { Studio, StudioIndex } from "../lib/studio";

/** Settings → General: the "Design yourself" page (a link on the Themes page): on or off. */
export function DesignPageCard() { return <DesignOnCard />; }

function DesignOnCard() {
  const [s, setS] = useState<DesignSettings>(readDesignSettings);
  const on = s.on !== false;
  const save = (n: DesignSettings) => { setS(n); writeDesignSettings(n); pushPref({ design: n }); };
  return (
    <section className="card flex flex-col gap-3 p-5" aria-label="Design yourself">
      <h3 className="text-[15px] font-extrabold">Design yourself</h3>
      <p className="text-sm text-ink-300">A page on the Themes gallery where a visitor answers a few simple questions and sees a preview of their own website. Nothing is published. When they press Connect, the request is saved in your Studio's Cloudflare database and emailed to the Studio's owners. Open them with the “Design yourself queries” button next to New project on the Projects page (you read them with your own sign-in; visitors only send). Everything stays in your own Studio: the page, the AI text and the requests.</p>
      <Toggle id="design-on" label="Show “Design yourself” on the Themes page" checked={on} onChange={(v) => save({ ...s, on: v })} />
      <div className="flex flex-wrap gap-2"><a className="btn btn-sm" href="#/design">Open the page</a><a className="btn btn-ghost btn-sm" href="#/design-queries">See the requests</a></div>
    </section>
  );
}

const KIND_NAME: Record<Kind, string> = { business: "Business", restaurant: "Restaurant", portfolio: "Portfolio", store: "Shop" };
const same = (x: unknown, y: unknown) => JSON.stringify(x) === JSON.stringify(y);

function Block({ title, note, children, open = true }: { title: string; note?: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group card overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
        <h3 className="text-[15px] font-extrabold">{title}</h3><span aria-hidden className="ml-auto text-ink-500 transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="flex flex-col gap-4 border-t border-ink-700 px-5 pb-5 pt-4">{note && <p className="text-[13px] leading-relaxed text-ink-400">{note}</p>}{children}</div>
    </details>
  );
}

/** Settings → Design yourself: the AI that reads and writes for visitors, the themes offered, and the layout, style, interaction and intro-screen choices (what each starts with, what shows, what can be picked). Saved with the Save button. */
/** Its own web address: the same one-click domain box as the Studio's own address; that address opens straight on Design yourself. */
function DesignDomain({ session, studio, index, onIndex, onDomain }: { session: Session; studio: Studio; index: StudioIndex; onIndex: (i: StudioIndex) => void; onDomain: (d: string | undefined) => Promise<void> }) {
  const [nf, setNf] = useState<Netlify | null | undefined>(undefined);
  useEffect(() => { netlifyToken.load(session.token).then((t) => setNf(t ? new Netlify(t.token) : null)).catch(() => setNf(null)); }, [session.token]);
  const cfAcc = useCfAccount(session.token, nf, true, true);
  const hosted = index.hosted, dd = hosted?.designDomain;
  if (!hosted || hosted.pages !== "cloudflare" || !hosted.siteId) return <p className="text-[13px] text-ink-400">An own address needs a Studio that runs on Cloudflare (Settings → Hosting accounts).</p>;
  return (
    <div aria-label="Design yourself address">
      <CfDomainCard plain="Its own address" acc={cfAcc}
        host={{ kind: "cloudflare", siteId: hosted.siteId, siteName: hosted.siteName, url: hosted.url, account: hosted.account, domain: dd?.domain, subdomain: dd?.subdomain, domainSetup: dd?.domainSetup } as HostCfg}
        onHost={async (h) => {
          onIndex(await studio.updateIndex((i) => { if (i.hosted) i.hosted = { ...i.hosted, designDomain: h.domain || h.domainSetup ? { domain: h.domain, subdomain: h.subdomain, domainSetup: h.domainSetup } : undefined }; }, h.domain ? `Design yourself address: ${h.domain}` : "Design yourself address removed"));
          await onDomain(h.domain);
        }} />
    </div>
  );
}

export function DesignLookTab({ session, studio, index, onIndex }: { session: Session; studio: Studio; index: StudioIndex; onIndex: (i: StudioIndex) => void }) {
  const toast = useToast(), general = useAiEngine(), where = useStudioWhere();
  const [saved, setSaved] = useState<DesignSettings>(readDesignSettings);
  const [d, setD] = useState<DesignSettings>(saved);
  const [kind, setKind] = useState<Kind>("business");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const dirty = useMemo(() => !same(cleanDesignSettings({ ...d, on: saved.on }), cleanDesignSettings(saved)), [d, saved]);
  const upd = (p: Partial<DesignSettings>) => { setD((o) => ({ ...o, ...p })); setErr(""); };

  /** A connected (or removed) address is saved at once: it isn't part of the Save bar below. */
  const setDomain = async (domain: string | undefined) => {
    const cur = readDesignSettings(), next: DesignSettings = { ...cur }; if (domain) next.domain = domain; else delete next.domain;
    writeDesignSettings(next); setSaved((o) => ({ ...o, domain })); setD((o) => ({ ...o, domain }));
    try { await savePrefNow({ design: next }); } catch (e: any) { toast(e?.message || "Couldn't save the address.", "bad"); }
  };
  const rules = d.look?.[kind] || {};
  const setRule = (key: string, patch: Partial<LookRule>) => {
    const r: LookRule = { ...rules[key], ...patch };
    if (!r.d) delete r.d; if (!r.a || !r.a.length) delete r.a; if (!r.h) delete r.h;
    const next = { ...rules }; if (Object.keys(r).length) next[key] = r; else delete next[key];
    const look = { ...(d.look || {}) }; if (Object.keys(next).length) look[kind] = next; else delete look[kind];
    upd({ look });
  };
  const themes = allThemesOf(kind), picked = d.themes?.[kind]?.length ? d.themes[kind]!.filter((id) => themes.some((t) => t.id === id)) : [];
  const all = !picked.length, offered = all ? themes.map((t) => t.id) : picked;
  const setOffered = (ids: string[]) => { const th = { ...(d.themes || {}) }; if (ids.length && ids.length < themes.length) th[kind] = ids; else delete th[kind]; upd({ themes: th }); };
  const [find, setFind] = useState("");
  const shownThemes = themes.filter((t) => !find.trim() || (t.name + " " + t.id + " " + t.tags.join(" ")).toLowerCase().includes(find.trim().toLowerCase()));

  const save = async () => {
    const clean = cleanDesignSettings({ ...d, on: readDesignSettings().on });
    setBusy(true); setErr("");
    try {
      writeDesignSettings(clean);
      await savePrefNow({ design: clean });
      setSaved(clean); setD(clean); toast("Saved. The Design yourself page now uses these settings.");
    } catch (e: any) { setErr((e?.message || "Couldn't save.") + " Your changes are still here: try Save again."); }
    setBusy(false);
  };
  const ai = d.ai || "";
  const generalName = AI_ENGINES.find((e) => e.id === general)?.name || "";

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-300">What the Design yourself page offers a visitor, and what each type starts with. Press <b className="text-ink-100">Save changes</b> to store it in your Studio's database; signed-out visitors get it with the next page load.</p>

      <Block title="Its own web address" note="Give Design yourself its own address, like design.yourname.com. Visitors who open it land straight on the Design yourself page. Connect it in one click, the same way as the Studio's own address in Settings → Hosting accounts.">
        <DesignDomain session={session} studio={studio} index={index} onIndex={onIndex} onDomain={setDomain} />
        {d.domain && <p className="text-[13px] text-ink-300">Open <a className="underline" href={`https://${d.domain}/`} target="_blank" rel="noopener noreferrer">{d.domain}</a></p>}
      </Block>
      <Block title="AI engine" note="Which AI reads a visitor's PDF or website link and writes their text. The choices are the same as Settings → General → AI engine. With the Picaffectz system nothing is sent to an AI service: the visitor's own device reads and writes by rules.">
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="AI engine for Design yourself">
          {[{ id: "", name: "Same as Settings → General", line: `Currently ${generalName}. Changing it there changes it here.` }, ...AI_ENGINES].map((e) => (
            <button key={e.id || "same"} type="button" role="radio" aria-checked={ai === e.id} onClick={() => upd({ ai: (e.id || undefined) as DesignSettings["ai"] })} className={`flex flex-col gap-1 rounded-xl border p-4 text-left ${ai === e.id ? "border-brand-500 bg-brand-500/10" : "border-ink-700 hover:border-ink-500"}`}>
              <b className="flex items-center gap-2 text-[13px] text-ink-100">{e.name}{ai === e.id && <span className="chip border-brand-400/60 text-brand-200">Chosen</span>}</b>
              <span className="text-[12.5px] leading-snug text-ink-300">{e.line}</span>
            </button>
          ))}
        </div>
        {(ai === "custom" || (!ai && general === "custom")) && <AiApiForm where={where} />}
      </Block>

      <div className="flex flex-wrap gap-1 rounded-xl border border-ink-700 bg-ink-800/40 p-1" role="tablist" aria-label="Type of website">
        {KINDS.map((k) => <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)} className={`h-10 flex-1 rounded-lg px-3 text-[13px] font-semibold ${kind === k ? "bg-ink-700 text-ink-100 shadow" : "text-ink-400 hover:text-ink-100"}`}>{KIND_NAME[k]}</button>)}
      </div>

      <Block title={`Themes · ${KIND_NAME[kind]}`} note="Your Studio's themes. Show all of them to visitors, or only the ones you tick.">
        <div className="flex flex-wrap items-center gap-2">
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-ink-600 p-1" role="radiogroup" aria-label="Themes shown">
            <button type="button" role="radio" aria-checked={all} onClick={() => setOffered(themes.map((t) => t.id))} className={`h-8 rounded-lg px-4 text-[13px] font-semibold ${all ? "bg-ink-700 text-ink-100" : "text-ink-400 hover:text-ink-100"}`}>All themes ({themes.length})</button>
            <button type="button" role="radio" aria-checked={!all} onClick={() => setOffered(all ? themes.slice(0, 12).map((t) => t.id) : offered)} className={`h-8 rounded-lg px-4 text-[13px] font-semibold ${!all ? "bg-ink-700 text-ink-100" : "text-ink-400 hover:text-ink-100"}`}>Only some</button>
          </div>
          {!all && <span className="text-[13px] text-ink-400">{offered.length} chosen</span>}
        </div>
        {!all && <>
          <div className="flex flex-wrap items-center gap-2"><input className="input h-10 max-w-xs" type="search" placeholder="Search themes" aria-label="Search themes" value={find} onChange={(e) => setFind(e.target.value)} />
            <button type="button" className="btn btn-sm" onClick={() => setOffered([...new Set([...offered, ...shownThemes.map((t) => t.id)])])}>Tick these</button>
            <button type="button" className="btn btn-sm" onClick={() => setOffered(offered.filter((id) => !shownThemes.some((t) => t.id === id)).length ? offered.filter((id) => !shownThemes.some((t) => t.id === id)) : [themes[0].id])}>Untick these</button></div>
          <div className="grid max-h-96 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
            {shownThemes.map((t) => (
              <label key={t.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-ink-700 px-3 py-2 text-[13px] hover:border-ink-500">
                <input type="checkbox" checked={offered.includes(t.id)} onChange={(e) => setOffered(e.target.checked ? [...offered, t.id] : offered.filter((x) => x !== t.id))} />
                <span className="flex flex-none overflow-hidden rounded-full border border-white/20" aria-hidden>{[t.colors.bg, t.colors.c1, t.colors.c2].map((c, i) => <span key={i} className="h-4 w-3.5" style={{ background: c }} />)}</span>
                <span className="min-w-0 flex-1 truncate">{t.name}</span>
              </label>
            ))}
            {!shownThemes.length && <p className="text-[13px] text-ink-400">No theme matches that.</p>}
          </div>
        </>}
      </Block>

      <Block title={`Layout, style and interactions · ${KIND_NAME[kind]}`} note="For each choice: the option every visitor's preview starts with (the theme's own if left alone), whether visitors see it, and which options they can pick. Each choice shows the answer it shapes." open={false}>
        {GROUPS.map((g) => {
          const rows = LOOK_AXES[kind].filter((x) => x[2] === g); if (!rows.length) return null;
          return (
            <details key={g} className="group rounded-xl border border-ink-700" open={g === "Layout"}>
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-[13px] font-bold [&::-webkit-details-marker]:hidden">{g}<span className="font-normal text-ink-500">{rows.length} choices</span><span aria-hidden className="ml-auto text-ink-500 transition-transform group-open:rotate-180">▾</span></summary>
              <div className="flex flex-col divide-y divide-ink-700 border-t border-ink-700">
                {rows.map(([ax, forAnswer]) => {
                  const r = rules[ax.key] || {}, allowed = r.a && r.a.length ? r.a : ax.options.map(([v]) => v);
                  return (
                    <div key={ax.key} className="grid gap-x-4 gap-y-2.5 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                      <div className="min-w-0"><b className="block text-[13px]">{ax.label}</b><span className="text-[12px] text-ink-500">Shapes: {forAnswer}</span></div>
                      <div className="flex flex-col gap-2">
                        <select aria-label={`${ax.label}: starts with`} className="input h-10 py-0 text-[13px]" value={r.d || ""} onChange={(e) => setRule(ax.key, { d: e.target.value })}>
                          <option value="">Starts with: theme's own</option>
                          {ax.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2"><Toggle id={`lk-${kind}-${ax.key}`} label="Show to visitors" checked={!r.h} onChange={(v) => setRule(ax.key, { h: !v })} />
                          <details className="text-[12px] text-ink-400"><summary className="cursor-pointer select-none">Options visitors can pick ({allowed.length} of {ax.options.length})</summary>
                            <div className="mt-2 grid gap-1.5">
                              {ax.options.map(([v, l]) => <label key={v} className="flex items-center gap-2"><input type="checkbox" checked={allowed.includes(v)} onChange={(e) => { const n = e.target.checked ? [...allowed, v] : allowed.filter((x) => x !== v); setRule(ax.key, { a: n.length && n.length < ax.options.length ? n : [] }); }} />{l}</label>)}
                            </div></details></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </details>
          );
        })}
      </Block>

      <Block title="Colours" open={false}>
        <Toggle id="design-pick" label="Let visitors change each colour" checked={d.pick !== false} onChange={(v) => upd({ pick: v })} />
      </Block>

      <div className="card sticky bottom-3 z-10 flex flex-wrap items-center gap-3 border-ink-600 bg-ink-900/95 p-3 shadow-xl backdrop-blur" role="region" aria-label="Save">
        <p className={`min-w-0 flex-1 text-[13px] ${err ? "text-red-300" : "text-ink-400"}`} role="status">{err || (dirty ? "You have changes that aren't saved yet." : "All changes are saved.")}</p>
        <button type="button" className="btn btn-ghost btn-sm" disabled={!dirty || busy} onClick={() => { setD(saved); setErr(""); }}>Discard</button>
        <button type="button" className="btn btn-pri" disabled={!dirty || busy} onClick={save}>{busy ? "Saving…" : "Save changes"}</button>
      </div>
    </div>
  );
}
