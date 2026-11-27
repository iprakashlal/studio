import { themeCode } from "../themes/codes";
import { ReservedThemes } from "./ReservedThemes";
import { useEffect, useMemo, useState } from "react";
import { pushPref, savePrefNow } from "../lib/prefs";
import { cleanDesignSettings, readDesignSettings, writeDesignSettings, type DesignSettings } from "../lib/designs";
import { DIY_BUBBLES, DIY_FONTS, DIY_WORDS, NOTICE_TEXT, GROUPS, KINDS, LOOK_AXES, REF_EXT, REF_NAME, REF_NOTE, cleanRefs, type DiyWord, type Gallery, type Kind, type LookRule, type RefExt } from "../lib/designlook";
import { sheetDocx, sheetTxt, sheetXlsx } from "../lib/detailsheet";
import { designHost } from "../lib/designapi";
import { cfCall, cfDeployInfo } from "../lib/cfdb";
import { CFDB_VERSION } from "../lib/cfdbSchema";
import { shrinkImage } from "../lib/brand";
import { ANIM_BGS, ANIM_SPEEDS, BG_PATTERNS } from "../schema/animbg";
import type { DiyBg } from "../lib/diylook";
import { QUESTION_GROUPS, QUESTION_LIST, allThemesOf } from "../lib/designer";
import { AI_ENGINES } from "../lib/ai";
import { useAiEngine } from "./AiEngine";
import { AiApiForm, UnsplashForm, useStudioWhere } from "./Connections";
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
      <div className="flex flex-wrap gap-2"><a className="btn btn-sm" href="#/design">Open the page</a><a className="btn btn-ghost btn-sm" href="#/design-queries">See the submissions</a></div>
    </section>
  );
}

/** A background picture made small enough to keep in the Studio's settings: at most ~1400 px across, a JPEG under ~90 KB. */
async function fitBackdrop(file: File): Promise<string> {
  if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) throw new Error("Please choose a PNG, JPG or WebP picture.");
  const bmp = await createImageBitmap(file); let max = 1400, q = 0.75, u = "";
  for (let i = 0; i < 8; i++) {
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height)), c = document.createElement("canvas"); c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
    const g = c.getContext("2d")!; g.fillStyle = "#000"; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height);
    u = c.toDataURL("image/jpeg", q); if (u.length <= 90_000) break; if (q > 0.4) q -= 0.08; else max = Math.round(max * 0.8);
  }
  bmp.close?.(); if (u.length > 100_000) throw new Error("That picture is too detailed. Please use a simpler or smaller one.");
  return u;
}
const KIND_NAME: Record<Kind, string> = { business: "Business", restaurant: "Restaurant", portfolio: "Portfolio", store: "Shop", events: "Event" };
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
function DesignDomain({ session, studio, index, onIndex, onDomain, field = "designDomain", noun = "Design yourself" }: { session: Session; studio: Studio; index: StudioIndex; onIndex: (i: StudioIndex) => void; onDomain: (d: string | undefined) => Promise<void>; field?: "designDomain" | "themesDomain"; noun?: string }) {
  const [nf, setNf] = useState<Netlify | null | undefined>(undefined);
  useEffect(() => { netlifyToken.load(session.token).then((t) => setNf(t ? new Netlify(t.token) : null)).catch(() => setNf(null)); }, [session.token]);
  const cfAcc = useCfAccount(session.token, nf, true, true);
  const hosted = index.hosted, dd = hosted?.[field];
  if (!hosted || hosted.pages !== "cloudflare" || !hosted.siteId) return <p className="text-[13px] text-ink-400">An own address needs a Studio that runs on Cloudflare (Settings → Hosting accounts).</p>;
  return (
    <div aria-label={`${noun} address`}>
      <CfDomainCard plain="Its own address" acc={cfAcc}
        host={{ kind: "cloudflare", siteId: hosted.siteId, siteName: hosted.siteName, url: hosted.url, account: hosted.account, domain: dd?.domain, subdomain: dd?.subdomain, domainSetup: dd?.domainSetup } as HostCfg}
        onHost={async (h) => {
          onIndex(await studio.updateIndex((i) => { if (i.hosted) i.hosted = { ...i.hosted, [field]: h.domain || h.domainSetup ? { domain: h.domain, subdomain: h.subdomain, domainSetup: h.domainSetup } : undefined }; }, h.domain ? `${noun} address: ${h.domain}` : `${noun} address removed`));
          await onDomain(h.domain);
        }} />
    </div>
  );
}

/** Settings → Themes: the public theme gallery's own address, the Studio's link to it, what it shows and what it says. Saved at once (small, and visitors see it on their next load). */
export function ThemesSettingsTab({ session, studio, index, onIndex }: { session: Session; studio: Studio; index: StudioIndex; onIndex: (i: StudioIndex) => void }) {
  const toast = useToast();
  const [d, setD] = useState<DesignSettings>(readDesignSettings);
  const g = d.gallery || {};
  const [busy, setBusy] = useState(false);
  const [txt, setTxt] = useState({ link: g.link || "", title: g.title || "", intro: g.intro || "" });
  const persist = async (gallery: Gallery | undefined, quiet = false) => {
    const cur = readDesignSettings(), next: DesignSettings = { ...cur }; if (gallery && Object.keys(gallery).length) next.gallery = gallery; else delete next.gallery;
    const clean = cleanDesignSettings(next); writeDesignSettings(clean); setD(clean);
    try { await savePrefNow({ design: clean }); if (!quiet) toast("Saved"); } catch (e: any) { toast(e?.message || "Couldn't save. Try again.", "bad"); }
  };
  const set = (p: Partial<Gallery>) => { const n: any = { ...(readDesignSettings().gallery || {}), ...p }; for (const k of Object.keys(n)) if (n[k] === undefined || n[k] === "") delete n[k]; return persist(n); };
  const setDomain = (domain: string | undefined) => set({ domain });
  const types = g.types || KINDS;
  const toggleType = (k: Kind, on: boolean) => { const l = KINDS.filter((x) => (x === k ? on : types.includes(x))); if (!l.length) return toast("Keep at least one type.", "bad"); set({ types: l.length === KINDS.length ? undefined : l }); };
  const dirtyText = txt.link.trim() !== (g.link || "") || txt.title.trim() !== (g.title || "") || txt.intro.trim() !== (g.intro || "");
  const base = g.domain ? `https://${g.domain}/` : location.origin + location.pathname + "#/themes";
  return (
    <div className="set-cols flex flex-col gap-4">
      <p className="text-sm text-ink-300">The public theme gallery: the page visitors open to browse your themes and quote a theme ID. Each choice here is saved at once.</p>
      <Block title="Its own web address" note="Give the gallery its own address, like themes.yourname.com. Visitors who open it land straight on the gallery. Connect it in one click, the same way as the Studio's own address in Settings → Hosting accounts.">
        <DesignDomain session={session} studio={studio} index={index} onIndex={onIndex} onDomain={setDomain} field="themesDomain" noun="Theme gallery" />
        <p className="text-[13px] text-ink-300">Open <a className="underline" href={base} target="_blank" rel="noopener noreferrer">{g.domain || "the gallery"}</a></p>
      </Block>
      <Block title="What it says" note="The Studio's link to the gallery, and the heading and line at the top of the page. Leave a box empty to keep the standard text.">
        <div className="grid gap-3">
          <label className="flex flex-col gap-1.5"><span className="label">Link in the Studio menu</span><input className="input h-10 max-w-xs" maxLength={24} placeholder="Themes" value={txt.link} onChange={(e) => setTxt({ ...txt, link: e.target.value })} /></label>
          <label className="flex flex-col gap-1.5"><span className="label">Heading</span><input className="input" maxLength={80} placeholder="Pick a look for your site" value={txt.title} onChange={(e) => setTxt({ ...txt, title: e.target.value })} /></label>
          <label className="flex flex-col gap-1.5"><span className="label">Line under the heading</span><textarea className="input" rows={3} maxLength={400} placeholder="Leave empty to show the theme count and what the themes are for." value={txt.intro} onChange={(e) => setTxt({ ...txt, intro: e.target.value })} /></label>
        </div>
        <div className="flex gap-2"><button type="button" className="btn btn-pri btn-sm" disabled={!dirtyText || busy} onClick={async () => { setBusy(true); await set({ link: txt.link, title: txt.title, intro: txt.intro }); setBusy(false); }}>{busy ? "Saving…" : "Save text"}</button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={!dirtyText} onClick={() => setTxt({ link: g.link || "", title: g.title || "", intro: g.intro || "" })}>Discard</button></div>
      </Block>
      <Block title="What it shows">
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="Theme count">
          <span className="label">Theme count</span>
          {([["found", "Themes found: “12 of 48 themes” (follows the search and filters)"], ["total", "Total only: “48 themes”"], ["off", "Don't show a count"]] as const).map(([v, l]) => (
            <label key={v} className="flex items-center gap-2 text-[13px]"><input type="radio" name="gal-count" checked={(g.count || "found") === v} onChange={() => set({ count: v === "found" ? undefined : v })} />{l}</label>
          ))}
        </div>
        <div className="flex flex-col gap-2"><span className="label">Types of site shown</span>
          {KINDS.map((k) => <label key={k} className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={types.includes(k)} onChange={(e) => toggleType(k, e.target.checked)} />{KIND_NAME[k]}</label>)}
        </div>
        <Toggle id="gal-tags" label="Show the tag filters (Dark, Warm, Bold…)" checked={g.tags !== false} onChange={(v) => set({ tags: v ? undefined : false })} />
      </Block>
      <Block title="Reserved themes" note="Keep themes for your own projects: a reserved theme is hidden from the public gallery and from Design yourself. Projects that use it keep it, and you can still pick it in the Studio. Type theme IDs, or switch themes off in the list; the two stay in step.">
        <ReservedThemes studio={studio} index={index} saved={g.reserved || []} onSave={(ids) => set({ reserved: ids.length ? ids : undefined })} />
      </Block>
      <p className="text-[13px] text-ink-400">Theme IDs (like T-07, B-12 or R-005) show on every theme card. They also appear on each Design yourself submission, so you know which look a visitor chose. <a className="underline" href="#/themes">Open the gallery</a></p>
    </div>
  );
}

/** The Design yourself settings. They are shown in two places that save the same record: Settings → Design yourself (everything but AI),
 *  and Settings → AI (`part="ai"`: only the AI choices, under `lead`, the Studio's own engine card). */
export function DesignLookTab({ session, studio, index, onIndex, part, lead }: { session: Session; studio: Studio; index: StudioIndex; onIndex: (i: StudioIndex) => void; part?: "ai"; lead?: React.ReactNode }) {
  const onlyAi = part === "ai";
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
  const setQ = (group: string, id: string, patch: { h?: boolean; t?: string; p?: string }) => {
    const all = { ...(d.questions || {}) }, g = { ...(all[group] || {}) }, r = { ...g[id], ...patch };
    if (!r.h) delete r.h; if (!r.t?.trim()) delete r.t; if (!r.p?.trim()) delete r.p;
    if (Object.keys(r).length) g[id] = r; else delete g[id];
    if (Object.keys(g).length) all[group] = g; else delete all[group];
    upd({ questions: Object.keys(all).length ? all : undefined });
  };
  /** The owner's order of a group's questions: one question moves a place up or down (the type of website stays first). */
  const orderOf = (group: string) => { const base = QUESTION_LIST.filter((q) => q.group === group).map((q) => q.id), own = (d.qorder?.[group] || []).filter((id) => base.includes(id)); return [...own, ...base.filter((id) => !own.includes(id))]; };
  const moveQ = (group: string, id: string, by: number) => {
    const list = orderOf(group), i = list.indexOf(id), j = i + by; if (i < 0 || j < 0 || j >= list.length || list[j] === "kind" || id === "kind") return;
    [list[i], list[j]] = [list[j], list[i]];
    const base = QUESTION_LIST.filter((q) => q.group === group).map((q) => q.id), all = { ...(d.qorder || {}) };
    if (list.join() === base.join()) delete all[group]; else all[group] = list;
    upd({ qorder: Object.keys(all).length ? all : undefined });
  };
  const setUi = (p: Partial<NonNullable<DesignSettings["ui"]>>) => { const n: any = { ...(d.ui || {}), ...p }; for (const k of Object.keys(n)) if (n[k] === undefined || n[k] === "") delete n[k]; upd({ ui: Object.keys(n).length ? n : undefined }); };
  const setBg = (p: Partial<DiyBg>) => { const n: any = { ...(d.bg || {}), ...p }; for (const k of Object.keys(n)) if (n[k] === undefined || n[k] === "" || n[k] === false || n[k] === 0 || (Array.isArray(n[k]) && !n[k].length)) delete n[k]; upd({ bg: Object.keys(n).length ? n : undefined }); };
  const setWord = (k: DiyWord, v: string) => { const n: any = { ...(d.words || {}) }; if (v.trim() && v !== DIY_WORDS[k][1]) n[k] = v; else delete n[k]; upd({ words: Object.keys(n).length ? n : undefined }); };
  const themes = allThemesOf(kind), picked = d.themes?.[kind]?.length ? d.themes[kind]!.filter((id) => themes.some((t) => t.id === id)) : [];
  const all = !picked.length, offered = all ? themes.map((t) => t.id) : picked;
  const setOffered = (ids: string[]) => { const th = { ...(d.themes || {}) }; if (ids.length && ids.length < themes.length) th[kind] = ids; else delete th[kind]; upd({ themes: th }); };
  const [find, setFind] = useState("");
  const shownThemes = themes.filter((t) => !find.trim() || (t.name + " " + t.id + " " + t.tags.join(" ")).toLowerCase().includes(find.trim().toLowerCase()));

  // ---- Reference documents (details sheets): a file is saved as soon as it is chosen; the help line goes with Save changes.
  const [refBusy, setRefBusy] = useState("");
  const refs = d.refs?.[kind] || {};
  const setRefNote = (v: string) => { const all: any = { ...(d.refs || {}) }; all[kind] = { ...(all[kind] || {}), note: v }; upd({ refs: all }); };   // cleaned when saved (cleaning now would eat a space being typed)
  const refPut = async (ext: RefExt, f: File | null) => {
    if (f && !new RegExp(`\\.${ext}$`, "i").test(f.name)) { toast(`Please choose a ${REF_NAME[ext]} file.`, "bad"); return; }
    if (f && f.size > 5 * 1024 * 1024) { toast("That file is over 5 MB. A details sheet is usually a few KB: please choose a smaller one.", "bad"); return; }
    setRefBusy(ext);
    try {
      let b64: string | null = null;
      if (f) { const bytes = new Uint8Array(await f.arrayBuffer()); let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); b64 = btoa(s); }
      const idx = await studio.saveRefDoc(kind, ext, f ? f.name.slice(0, 100) : "", b64); onIndex(idx);
      const got = cleanRefs(idx.prefs?.design?.refs);
      // The files' names come from what was just saved; a help line typed and not saved yet stays as typed.
      const merge = (o: DesignSettings) => { const n: any = { ...(got || {}) }; const mine = o.refs?.[kind]?.note; if (mine !== undefined) n[kind] = { ...(n[kind] || {}), note: mine }; return cleanRefs(n); };
      writeDesignSettings(cleanDesignSettings({ ...readDesignSettings(), refs: got }));
      setSaved((o) => ({ ...o, refs: got })); setD((o) => ({ ...o, refs: merge(o) }));
      toast(f ? `${REF_NAME[ext]} sheet saved.` : `Removed. Visitors get the Studio's own ${REF_NAME[ext]} sheet.`);
      setTimeout(() => void checkLive(), 300);
    } catch (e: any) { toast(e?.message || "Couldn't save that file.", "bad"); }
    setRefBusy("");
  };
  /** What a visitor of the Design yourself page gets right now for this type, asked from the database as a visitor would
   *  (bypassing the minute-long cache). Each problem is said with its reason. */
  const [live, setLive] = useState<{ kind: Kind; ok: string[]; bad: string[] } | null>(null), [checking, setChecking] = useState(false);
  const checkLive = async (k: Kind = kind) => {
    setChecking(true); const ok: string[] = [], bad: string[] = [];
    try {
      const h = await designHost();
      if (!h) bad.push("This Studio doesn't run on a Cloudflare database, so signed-out visitors get the standard help line and sheets. Your own show only on this device's Design yourself page.");
      else {
        const info = await cfDeployInfo(h.api).catch(() => null);
        if (info?.v !== undefined && info.v < CFDB_VERSION) bad.push(`Your Studio's database is on an older build (${info.v}; this Studio needs ${CFDB_VERSION}). Visitors don't get your help line or sheets until you update it: Settings → Hostings → Update this database.`);
        const pub = await cfCall<any>(h.api, `/sb/${encodeURIComponent(h.studio)}?t=${Date.now()}`, { auth: false }).catch(() => null);
        const want = saved.refs?.[k] || {}, got = pub?.design?.refs?.[k] || {};
        if (!pub) bad.push("The database didn't answer the visitors' request. Check your connection and try again.");
        else {
          if (want.note) { if (got.note === want.note) ok.push("help line"); else bad.push(got.note ? "Visitors still get the help line saved before. Press Save changes, then check again." : "Visitors get the standard help line, not yours." + (info?.v !== undefined && info.v < CFDB_VERSION ? "" : " Press Save changes, then check again.")); }
          for (const e of REF_EXT) if (want[e]) {
            const r = await fetch(`${h.api.replace(/\/$/, "")}/sd/${encodeURIComponent(h.studio)}/${k}.${e}?t=${Date.now()}`, { cache: "no-store" }).catch(() => null);
            if (r?.ok) ok.push(REF_NAME[e]); else bad.push(`${REF_NAME[e]}: visitors get the standard sheet${r?.status === 404 ? (info?.v !== undefined && info.v < CFDB_VERSION ? " (the older database can't give out your file)" : " (your file isn't in the database: upload it again)") : " (the database didn't answer)"}.`);
          }
        }
      }
    } catch (e: any) { bad.push(e?.message || "Couldn't check."); }
    setLive({ kind: k, ok, bad }); setChecking(false);
  };
  useEffect(() => { setLive(null); }, [kind]);
  const refGet = async (ext: RefExt) => {
    const own = refs[ext] ? await studio.refDocBlob(kind, ext) : null;
    if (refs[ext] && !own) { toast("Your file couldn't be read from the Studio's data. Upload it again.", "bad"); return; }
    const blob = own || (ext === "txt" ? new Blob([sheetTxt(kind)], { type: "text/plain" }) : ext === "xlsx" ? await sheetXlsx(kind) : await sheetDocx(kind));
    const u = URL.createObjectURL(blob), l = document.createElement("a"); l.href = u; l.download = own ? refs[ext]! : `${KIND_NAME[kind]}-website-details.${ext}`; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
  };

  const save = async () => {
    const clean = cleanDesignSettings({ ...d, on: readDesignSettings().on });
    setBusy(true); setErr("");
    try {
      writeDesignSettings(clean);
      await savePrefNow({ design: clean });
      setSaved(clean); setD(clean); toast("Saved. The Design yourself page now uses these settings.");
      if (clean.refs?.[kind] || saved.refs?.[kind]) setTimeout(() => void checkLive(), 300);
    } catch (e: any) { setErr((e?.message || "Couldn't save.") + " Your changes are still here: try Save again."); }
    setBusy(false);
  };
  const ai = d.ai || "";
  const generalName = AI_ENGINES.find((e) => e.id === general)?.name || "";

  return (
    <div className="set-cols flex flex-col gap-4">
      {onlyAi ? <p className="text-sm text-ink-300">Everything about AI in one place: the engine the Studio uses, the one Design yourself uses, and who draws pictures. The engine is saved as soon as you choose it; for the rest press <b className="text-ink-100">Save changes</b>.</p>
      : <p className="text-sm text-ink-300">What the Design yourself page offers a visitor, and what each type starts with. Press <b className="text-ink-100">Save changes</b> to store it in your Studio's database; signed-out visitors get it with the next page load.</p>}
      {lead}

      {!onlyAi && <>
      <Block title="Its own web address" note="Give Design yourself its own address, like design.yourname.com. Visitors who open it land straight on the Design yourself page. Connect it in one click, the same way as the Studio's own address in Settings → Hosting accounts.">
        <DesignDomain session={session} studio={studio} index={index} onIndex={onIndex} onDomain={setDomain} />
        {d.domain && <p className="text-[13px] text-ink-300">Open <a className="underline" href={`https://${d.domain}/`} target="_blank" rel="noopener noreferrer">{d.domain}</a></p>}
      </Block>
      </>}
      {onlyAi && <>
      <Block title="AI for Design yourself" note="Which AI reads a visitor's PDF or website link and writes their text on the Design yourself page. It follows the Studio's AI engine unless you choose another here. With the Picaffectz system nothing is sent to an AI service: the visitor's own device reads and writes by rules.">
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Design yourself uses
          <select className="input" aria-label="AI engine for Design yourself" value={ai} onChange={(e) => upd({ ai: (e.target.value || undefined) as DesignSettings["ai"] })}>
            <option value="">The Studio's AI engine (now {generalName})</option>
            {AI_ENGINES.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </label>
        {ai && <p className="text-[12.5px] leading-snug text-ink-300">{AI_ENGINES.find((e) => e.id === ai)?.line}</p>}
        {ai === "custom" && general !== "custom" && <AiApiForm where={where} />}
      </Block>
      </>}

      {!onlyAi && <>
      <div className="flex flex-wrap gap-1 rounded-xl border border-ink-700 bg-ink-800/40 p-1" role="tablist" aria-label="Type of website">
        {KINDS.map((k) => <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)} className={`h-10 flex-1 rounded-lg px-3 text-[13px] font-semibold ${kind === k ? "bg-ink-700 text-ink-100 shadow" : "text-ink-400 hover:text-ink-100"}`}>{KIND_NAME[k]}</button>)}
      </div>

      <Block title={`Reference documents · ${KIND_NAME[kind]}`} note={`The details sheets a visitor can download on the Design yourself page after choosing ${KIND_NAME[kind] === "Event" ? "an event" : KIND_NAME[kind] === "Shop" ? "a shop" : "a " + KIND_NAME[kind].toLowerCase()} website, fill in and upload, so the questions are answered in one go. Until you upload your own, the Studio's own sheet is offered (download it to start from). A file is saved as soon as you choose it.`}>
        <div className="flex flex-col divide-y divide-ink-700 rounded-xl border border-ink-700">
          {REF_EXT.map((ext) => (
            <div key={ext} className="flex flex-wrap items-center gap-2 p-3">
              <span className="min-w-[11rem] flex-1"><b className="block text-[13px]">{REF_NAME[ext]}</b>
                <span className="text-[12px] text-ink-400">{refs[ext] ? <>Your file: <span className="text-ink-200">{refs[ext]}</span></> : "The Studio's own sheet"}</span></span>
              <button type="button" className="btn btn-sm" disabled={!!refBusy} onClick={() => void refGet(ext)}>Download</button>
              <label className={`btn btn-sm btn-pri ${refBusy ? "pointer-events-none opacity-60" : ""}`}>{refBusy === ext ? "Saving…" : refs[ext] ? "Replace" : "Upload"}
                <input type="file" className="sr-only" accept={`.${ext}`} aria-label={`Upload the ${REF_NAME[ext]} sheet for ${KIND_NAME[kind]}`} disabled={!!refBusy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void refPut(ext, f); }} /></label>
              {refs[ext] && <button type="button" className="btn btn-sm btn-ghost" disabled={!!refBusy} onClick={() => void refPut(ext, null)}>Remove</button>}
            </div>
          ))}
        </div>
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Help line shown with the documents
          <textarea className="input min-h-[64px] text-[13px] font-normal" maxLength={300} aria-label={`Help line for the ${KIND_NAME[kind]} documents`} placeholder={REF_NOTE} value={refs.note || ""} onChange={(e) => setRefNote(e.target.value)} />
          <span className="text-[11.5px] font-normal text-ink-500">Shown above the download links in the upload box. Empty: the standard line (shown greyed in the box). Saved with Save changes.</span></label>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-sm" disabled={checking} onClick={() => void checkLive()}>{checking ? "Checking…" : "Check what visitors get"}</button>
          {live && live.kind === kind && !live.bad.length && <span className="text-[12.5px] text-emerald-300">{live.ok.length ? `Visitors get your ${live.ok.join(", ")}.` : "Nothing of your own set for this type: visitors get the standard line and sheets."}</span>}
        </div>
        {live && live.kind === kind && live.bad.length > 0 && <div role="alert" className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-100">
          {live.ok.length > 0 && <p className="mb-1">Visitors get your {live.ok.join(", ")}.</p>}
          <ul className="list-disc pl-4">{live.bad.map((x) => <li key={x}>{x}</li>)}</ul></div>}
      </Block>

      <Block open={false} title={`Questions · ${KIND_NAME[kind]}`} note="The questions a visitor is asked: untick one to hide it, change its wording, or move it up or down with the arrows to change the order (the first question, the type of website, stays first). A question is also skipped when the visitor's PDF or link has already answered it. Press Save changes to store it in your Studio's database. If you hide the contact email question, the email address the visitor has already given at the start is used on their website.">
        {QUESTION_GROUPS.filter((g) => g.id === "basics" || g.id === kind).map((g) => (
          <div key={g.id} className="flex flex-col gap-2">
            <b className="text-[13px]">{g.name}</b>
            <div className="flex flex-col divide-y divide-ink-700 rounded-xl border border-ink-700">
              {orderOf(g.id).map((id) => QUESTION_LIST.find((q) => q.group === g.id && q.id === id)!).filter(Boolean).map((q, qi, ql) => {
                const r = d.questions?.[g.id]?.[q.id] || {}, hidden = !!r.h, def = q.ask({ kind }), defHelp = q.help?.({ kind }) || "";
                return (
                  <div key={g.id + q.id} className={`grid gap-x-3 gap-y-2 p-3 sm:grid-cols-[auto_minmax(0,13rem)_minmax(0,1fr)] ${hidden ? "opacity-60" : ""}`}>
                    <span className="flex gap-1 sm:flex-col">
                      <button type="button" className="icon-btn h-7 w-7 text-xs" aria-label={`Move “${q.label}” up`} disabled={q.id === "kind" || qi === 0 || ql[qi - 1]?.id === "kind"} onClick={() => moveQ(g.id, q.id, -1)}>↑</button>
                      <button type="button" className="icon-btn h-7 w-7 text-xs" aria-label={`Move “${q.label}” down`} disabled={q.id === "kind" || qi === ql.length - 1} onClick={() => moveQ(g.id, q.id, 1)}>↓</button>
                    </span>
                    <label className="flex items-start gap-2 text-[13px]">
                      <input type="checkbox" className="mt-0.5" checked={!hidden && !q.soon} disabled={q.soon} onChange={(e) => setQ(g.id, q.id, { h: !e.target.checked })} aria-label={`Ask: ${q.label}`} />
                      <span><b className="block">{q.label}</b><span className="text-[11px] text-ink-500">{q.soon ? "Needs picture upload: coming next" : q.type === "file" ? "File upload" : q.type === "choice" ? "Tap one" : q.type === "many" ? "Tap several" : q.type === "long" ? "One per line" : "One line"}{q.when && !q.soon ? " · only when it applies" : ""}</span></span>
                    </label>
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <input className="input h-9 py-0 text-[13px]" aria-label={`Wording: ${q.label}`} disabled={q.soon} placeholder={def} value={r.t || ""} onChange={(e) => setQ(g.id, q.id, { t: e.target.value })} />
                      {(defHelp || r.p) && <input className="input h-8 py-0 text-[12px]" aria-label={`Help line: ${q.label}`} disabled={q.soon} placeholder={defHelp} value={r.p || ""} onChange={(e) => setQ(g.id, q.id, { p: e.target.value })} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </Block>

      <Block title="Page look" note="How the Design yourself page looks to a visitor. Anything left unset follows your Studio's own look. Your Studio itself is not changed.">
        {(() => {
          const u = d.ui || {}, c = d.chat || {}, sel = "input w-full text-[13px]", lab = "flex min-w-0 flex-col gap-1.5 text-[12.5px] font-semibold";
          const setC = (p: Partial<NonNullable<typeof d.chat>>) => { const n: any = { ...c, ...p }; for (const k of Object.keys(n)) if (n[k] === undefined || n[k] === "" || n[k] === 0) delete n[k]; upd({ chat: Object.keys(n).length ? n : undefined }); };
          /** One colour: its name, the swatch, and a way back to the standard one. All the same size, so they line up. */
          const col = (label: string, value: string | undefined, def: string, set: (v: string | undefined) => void) => (
            <label key={label} className={lab}><span className="truncate">{label}</span>
              <span className="input flex h-[46px] items-center gap-2 py-0">
                <input type="color" aria-label={label} className="h-6 w-8 flex-none cursor-pointer rounded border-0 bg-transparent p-0" value={value || def} onChange={(e) => set(e.target.value)} />
                <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] font-normal text-ink-400">{value || "standard"}</span>
                {value && <button type="button" className="flex-none text-[11.5px] font-normal text-ink-400 underline hover:text-ink-100" onClick={(e) => { e.preventDefault(); set(undefined); }}>reset</button>}
              </span></label>
          );
          const pick = async (f: File | undefined) => { if (!f) return; try { setUi({ logo: await shrinkImage(f, 128) }); } catch (e: any) { alert(e?.message || "Couldn't use that picture."); } };
          return <>
            <div className="grid gap-x-3 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className={lab}>Light or dark<select className={sel} value={u.mode || ""} onChange={(e) => setUi({ mode: (e.target.value || undefined) as any })}><option value="">The Studio's own</option><option value="dark">Dark</option><option value="light">Light</option></select></label>
              <label className={lab}>Corners<select className={sel} value={u.radius || ""} onChange={(e) => setUi({ radius: (e.target.value || undefined) as any })}><option value="">Soft (standard)</option><option value="sharp">Square</option><option value="round">Very round</option></select></label>
              <label className={lab}>Chat width<select className={sel} value={u.width || ""} onChange={(e) => setUi({ width: (e.target.value || undefined) as any })}><option value="">Standard</option><option value="narrow">Narrow column</option><option value="wide">Full width</option></select></label>
              <label className={lab}>Message shape<select className={sel} value={u.bubble || ""} onChange={(e) => setUi({ bubble: e.target.value || undefined })}>{DIY_BUBBLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
              <label className={lab}>Text font<select className={sel} value={u.font || ""} onChange={(e) => setUi({ font: e.target.value || undefined })}><option value="">The Studio's own (Manrope)</option>{DIY_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}</select></label>
              <label className={lab}>Heading font<select className={sel} value={u.head || ""} onChange={(e) => setUi({ head: e.target.value || undefined })}><option value="">Same as the text</option>{DIY_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}</select></label>
            </div>
            <div className="grid gap-x-3 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              {col("Accent (progress, links)", u.accent, "#5b7cff", (v) => setUi({ accent: v }))}
              {col("Buttons", u.btn, u.accent || "#5b7cff", (v) => setUi({ btn: v }))}
              {col("Top bar", u.header, "#101622", (v) => setUi({ header: v }))}
              {col("Page background", c.page, "#150b10", (v) => setC({ page: v }))}
              {col("Assistant's messages", c.bot, "#1f1218", (v) => setC({ bot: v }))}
              {col("Visitor's messages", c.you, "#ff3fa4", (v) => setC({ you: v }))}
              {col("Answer boxes", u.field, "#161d2b", (v) => setUi({ field: v }))}
              {col("Choices (pills)", u.chip, "#161d2b", (v) => setUi({ chip: v }))}
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-[12.5px] font-semibold">Layout and effects</span>
              <div className="grid gap-x-3 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                {([["frame", "Chat in a framed panel"], ["steps", "Strip of stages above the chat"], ["aura", "Soft glows of colour behind the page"], ["glowBub", "Glowing border on messages"], ["glowField", "Glowing border on the answer box"], ["glowBtn", "Glowing border on main buttons"]] as const).map(([k, l]) => (
                  <label key={k} className="input flex h-[46px] cursor-pointer items-center gap-2.5 py-0 text-[13px] font-normal"><input type="checkbox" className="flex-none" checked={!!u[k]} onChange={(e) => setUi({ [k]: e.target.checked || undefined })} /><span className="truncate">{l}</span></label>
                ))}
              </div>
              {(u.glowBub || u.glowField || u.glowBtn || u.aura) && <div className="grid gap-x-3 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                {col("Glow: second colour", u.glow2, u.accent || "#80a0ff", (v) => setUi({ glow2: v }))}
                <label className={lab}>Glow speed<select className={sel} value={u.glowSpeed || ""} onChange={(e) => setUi({ glowSpeed: (e.target.value || undefined) as any })}><option value="">Calm</option><option value="slow">Slow</option><option value="fast">Fast</option></select></label>
                <span className="self-end pb-3 text-[11.5px] text-ink-500">The glow's first colour is the accent. It stays still for visitors who ask for less motion.</span>
              </div>}
              {u.steps && <span className="text-[11.5px] text-ink-500">The stages' names are under Wording (Steps strip).</span>}
            </div>
            <div className="grid gap-x-3 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className={lab}><span>Logo</span>
                <span className="flex h-[46px] items-center gap-2">{u.logo && <img src={u.logo} alt="" className="h-9 w-9 flex-none rounded-md border border-ink-600 object-contain" />}
                  <label className="btn btn-sm cursor-pointer">{u.logo ? "Replace" : "Choose"}<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} /></label>
                  {u.logo && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setUi({ logo: undefined })}>Remove</button>}</span></div>
              <label className={lab}>Name<input className="input text-[13px] font-normal" maxLength={40} placeholder="Picaffectz" value={u.name || ""} onChange={(e) => setUi({ name: e.target.value })} /></label>
              <label className={lab}>Line beside the name<input className="input text-[13px] font-normal" maxLength={60} placeholder="DIY your web" value={u.tag || ""} onChange={(e) => setUi({ tag: e.target.value })} /></label>
            </div>
            {c.image && !d.bg?.on && <p className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-400">An older background picture is still in use. <button type="button" className="underline hover:text-ink-100" onClick={() => setC({ image: undefined, dim: undefined })}>Remove it</button> (pictures are now set under Background and text).</p>}
            {d.bg?.on && <p className="text-[12.5px] text-ink-400">Background and text is on, so it sets the page's background and whether the page is light or dark. The colours here still apply to the bar, buttons and messages.</p>}
          </>;
        })()}
      </Block>

      <Block open={false} title="Wording" note="The page's own words: its welcome, the finished-preview message and its buttons. Leave a box empty to keep the standard text shown in grey. Write {brand} where the name should appear. The questions themselves are worded under Questions above.">
        <div className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(DIY_WORDS) as DiyWord[]).map((k) => { const long = DIY_WORDS[k][1].length > 60, v = d.words?.[k] || "";
            return <label key={k} className={`flex flex-col gap-1 text-[13px] font-semibold ${long ? "sm:col-span-2" : ""}`}>{DIY_WORDS[k][0]}
              {long ? <textarea className="input min-h-[4.5rem] text-[13px] font-normal" maxLength={400} placeholder={DIY_WORDS[k][1]} value={v} onChange={(e) => setWord(k, e.target.value)} /> : <input className="input text-[13px] font-normal" maxLength={120} placeholder={DIY_WORDS[k][1]} value={v} onChange={(e) => setWord(k, e.target.value)} />}</label>; })}
        </div>
      </Block>

      <Block title="Background and text" note="A background of any kind for the page (colour, picture or GIF, slideshow, video, animated, pattern), like a website section's. The text turns light or dark by itself to suit it.">
        {(() => {
          const b = d.bg || {}, sel = "input w-full text-[13px]", lab = "flex flex-col gap-1 text-[13px] font-semibold";
          const addPic = async (f: File | undefined, slide?: boolean) => { if (!f) return; try { const u = await fitBackdrop(f); if (slide) setBg({ slides: [...(b.slides || []), u].slice(0, 4) }); else setBg({ image: u }); } catch (e: any) { alert(e?.message || "Couldn't use that picture."); } };
          const media = b.kind === "image" || b.kind === "slides" || b.kind === "video";
          return <>
            <label className="flex items-start gap-2 text-[13px]"><input type="checkbox" className="mt-1" checked={!!b.on} onChange={(e) => setBg({ on: e.target.checked })} /><span><b className="block">Give this page its own background and text</b></span></label>
            {b.on && <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={lab}>Background<select className={sel} value={b.kind || ""} onChange={(e) => setBg({ kind: e.target.value as any })}><option value="">A colour</option><option value="image">A picture or GIF</option><option value="slides">A slideshow of pictures</option><option value="video">A video</option><option value="anim">An animated background</option><option value="pattern">A pattern</option></select></label>
                <label className={lab}>Colour{b.kind ? " (shows behind it, and while it loads)" : ""}
                  <span className="flex items-center gap-2"><input type="color" aria-label="Background colour" className="h-[46px] w-14 cursor-pointer rounded-lg border border-ink-600 bg-transparent p-1" value={b.color || "#101622"} onChange={(e) => setBg({ color: e.target.value })} /><span className="font-mono text-xs font-normal text-ink-400">{b.color || "the page's own"}</span>{b.color && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setBg({ color: undefined })}>Reset</button>}</span></label>
              </div>
              {b.kind === "image" && <div className="flex flex-col gap-2"><span className="text-[13px] font-semibold">Picture or GIF</span>
                <div className="flex flex-wrap items-center gap-2">{b.image && <img src={b.image} alt="" className="h-14 w-24 rounded-md border border-ink-600 object-cover" />}<label className="btn btn-sm cursor-pointer">{b.image ? "Replace" : "Choose a picture"}<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { addPic(e.target.files?.[0]); e.target.value = ""; }} /></label>{b.image && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setBg({ image: undefined })}>Remove</button>}</div>
                <input className="input h-9 py-0 text-[13px]" aria-label="Or a picture's address" placeholder="Or a picture's or GIF's address: https://…" value={b.image && b.image.startsWith("https://") ? b.image : ""} onChange={(e) => setBg({ image: e.target.value.trim() || undefined })} />
                <span className="text-[11.5px] text-ink-500">An uploaded picture is shrunk to stay small. For a GIF, or a large sharp picture, give its https address instead.</span></div>}
              {b.kind === "slides" && <div className="flex flex-col gap-2"><span className="text-[13px] font-semibold">Pictures of the slideshow (2 to 4)</span>
                <div className="flex flex-wrap items-center gap-2">{(b.slides || []).map((u, i) => <span key={i} className="relative"><img src={u} alt="" className="h-14 w-24 rounded-md border border-ink-600 object-cover" /><button type="button" className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-ink-700 text-[11px]" aria-label={`Remove picture ${i + 1}`} onClick={() => setBg({ slides: (b.slides || []).filter((_, j) => j !== i) })}>×</button></span>)}
                  {(b.slides || []).length < 4 && <label className="btn btn-sm cursor-pointer">Add a picture<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { addPic(e.target.files?.[0], true); e.target.value = ""; }} /></label>}</div>
                <div className="grid gap-3 sm:grid-cols-2"><label className={lab}>Seconds per picture ({b.slideSecs || 5})<input type="range" min={2} max={12} step={1} value={b.slideSecs || 5} onChange={(e) => setBg({ slideSecs: +e.target.value })} /></label>
                  <label className={lab}>Change of picture<select className={sel} value={b.slideFx || ""} onChange={(e) => setBg({ slideFx: (e.target.value || undefined) as any })}><option value="">Fade</option><option value="zoom">Fade with a slow zoom</option><option value="slide">Slide</option></select></label></div></div>}
              {b.kind === "video" && <div className="flex flex-col gap-2"><label className={lab}>Video link<input className="input text-[13px] font-normal" placeholder="https://youtu.be/…  or  https://vimeo.com/…  or  https://…/film.mp4" value={b.videoUrl || ""} onChange={(e) => setBg({ videoUrl: e.target.value })} /></label>
                <div className="grid gap-2 sm:grid-cols-2"><label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={!!b.videoOnce} onChange={(e) => setBg({ videoOnce: e.target.checked })} />Play once (do not loop)</label><label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={!!b.videoControls} onChange={(e) => setBg({ videoControls: e.target.checked })} />Show pause and sound buttons</label></div>
                <span className="text-[11.5px] text-ink-500">A YouTube or Vimeo link, or the address of a video file. It starts by itself, without sound, and loops unless you turn that off. A video can't be uploaded here: the page's settings are kept small so every visitor gets them at once.</span></div>}
              {b.kind === "anim" && <div className="grid gap-3 sm:grid-cols-3"><label className={lab}>Animated background<select className={sel} value={b.anim || ""} onChange={(e) => setBg({ anim: e.target.value })}><option value="">Choose one</option>{ANIM_BGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                <label className={lab}>Speed<select className={sel} value={b.animSpeed || ""} onChange={(e) => setBg({ animSpeed: (e.target.value || undefined) as any })}>{ANIM_SPEEDS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
                <label className={lab}>Strength ({b.animStrength || 60}%)<input type="range" min={20} max={100} step={5} value={b.animStrength || 60} onChange={(e) => setBg({ animStrength: +e.target.value })} /></label></div>}
              {b.kind === "pattern" && <label className={lab + " max-w-sm"}>Pattern<select className={sel} value={b.pattern || ""} onChange={(e) => setBg({ pattern: e.target.value })}><option value="">Choose one</option>{BG_PATTERNS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>}
              {media && <div className="grid gap-3 sm:grid-cols-3">
                <label className={lab}>Blur the picture or video ({b.blur || 0}px)<input type="range" min={0} max={30} step={1} value={b.blur || 0} onChange={(e) => setBg({ blur: +e.target.value })} /></label>
                <label className={lab}>Backdrop over it<select className={sel} value={b.shade || ""} onChange={(e) => setBg({ shade: (e.target.value || undefined) as any })}><option value="">Automatic (as much as the text needs)</option><option value="dark">Dark backdrop</option><option value="light">Light backdrop</option></select></label>
                <label className={lab}>Strength of the backdrop ({b.dim || 0}%)<input type="range" min={0} max={90} step={5} value={b.dim || 0} onChange={(e) => setBg({ dim: +e.target.value })} /></label></div>}
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <label className={lab}>Text colour<select className={sel} value={b.text || ""} onChange={(e) => setBg({ text: (e.target.value || undefined) as any })}><option value="">Automatic (light or dark, to suit the background)</option><option value="light">Light text (for a dark background)</option><option value="dark">Dark text (for a light background)</option><option value="custom">A colour of my own</option></select></label>
                {b.text === "custom" && <label className={lab}>Colour of the text<input type="color" aria-label="Colour of the text" className="h-[46px] w-14 cursor-pointer rounded-lg border border-ink-600 bg-transparent p-1" value={b.textColor || "#ffffff"} onChange={(e) => setBg({ textColor: e.target.value })} /></label>}
                <label className={lab}>Font<select className={sel} value={b.font || ""} onChange={(e) => setBg({ font: e.target.value || undefined })}><option value="">The page's fonts</option>{DIY_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}</select></label>
                <label className={lab}>Use the font for<select className={sel} value={b.fontFor || ""} onChange={(e) => setBg({ fontFor: (e.target.value || undefined) as any })}><option value="">All the text here</option><option value="head">The headings only</option></select></label>
                <label className={lab}>Text style<select className={sel} value={b.fontStyle || ""} onChange={(e) => setBg({ fontStyle: (e.target.value || undefined) as any })}><option value="">The page's own</option><option value="bold">Bold</option><option value="light">Light</option><option value="italic">Italic</option><option value="bolditalic">Bold italic</option><option value="upper">CAPITALS</option><option value="spaced">Spaced out</option></select></label>
              </div>
              <span className="text-[11.5px] text-ink-500">On automatic, the page turns light or dark to suit the background, whatever Page look says.</span>
            </>}
          </>;
        })()}
      </Block>

      <Block title="Help tour" note="A short tour of the Design yourself page: shown by itself on a visitor's first visit, every time their finished preview opens, and from the Help button at the top.">
        <Toggle id="ds-help" label="Show the help tour to visitors" checked={d.help !== false} onChange={(v) => upd({ help: v ? undefined : false })} />
      </Block>

      <Block title="On phones" note="On a phone, Design yourself can show a notice asking the visitor to open it on a larger screen (a computer or tablet), or the page itself, laid out for the phone.">
        <Toggle id="ds-phone" label="Show “not available on phones” screen" checked={d.phoneNotice !== false} onChange={(v) => upd({ phoneNotice: v ? undefined : false })} />
      </Block>

      <Block title="Notice bar" note='A bar across the top of the final website preview. Turn it off, or write your own words.'>
        <label className="flex items-start gap-2 text-[13px]">
          <input type="checkbox" className="mt-1" checked={d.notice?.on !== false} onChange={(e) => upd({ notice: e.target.checked ? (d.notice?.text ? { text: d.notice.text } : undefined) : { ...(d.notice || {}), on: false } })} />
          <span><b className="block">Show the notice bar</b></span>
        </label>
        {d.notice?.on !== false && <div className="flex flex-col gap-1"><label htmlFor="ds-notice" className="text-[13px] font-semibold">Message</label><textarea id="ds-notice" className="input min-h-[5rem]" maxLength={400} value={d.notice?.text ?? NOTICE_TEXT} onChange={(e) => upd({ notice: { ...(d.notice || {}), text: e.target.value } })} />
          {d.notice?.text && d.notice.text !== NOTICE_TEXT && <button type="button" className="btn btn-ghost btn-sm mt-1" onClick={() => upd({ notice: undefined })}>Use the standard message</button>}</div>}
      </Block>
      </>}

      {onlyAi && <>
      <Block title="Pictures drawn by AI" note="Pictures for a site can be drawn from a few words by the Studio's AI engine, or found as real photos on Unsplash. Logos are made in-house from the business name, with no AI.">
        <label className="flex items-start gap-2 text-[13px]">
          <input type="checkbox" className="mt-1" checked={d.adminAi !== false} onChange={(e) => upd({ adminAi: e.target.checked ? undefined : false })} />
          <span><b className="block">"Draw with AI" in the site editor</b><span className="text-[11.5px] text-ink-500">Adds a button next to Upload on picture fields (not on logos). Turn it off to hide it.</span></span>
        </label>
        <label className="flex items-start gap-2 text-[13px]">
          <input type="checkbox" className="mt-1" checked={!!d.images?.on} onChange={(e) => upd({ images: e.target.checked ? { ...(d.images || {}), on: true } : d.images?.style ? { style: d.images.style } : undefined })} />
          <span><b className="block">Let visitors describe a banner in "Design yourself"</b><span className="text-[11.5px] text-ink-500">The banner questions are then made from their words (banners can't be uploaded). Turn it off and the banner questions are not asked. Logos are always made by the logo maker, from the business name.</span></span>
        </label>
        {(d.adminAi !== false || d.images?.on) && <>
          <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Who draws the pictures">
            <span className="text-[13px] font-semibold">Who draws the pictures</span>
            {([["engine", "The Studio's AI engine", "Drawn by the engine chosen above: Cloudflare AI (fast, within its free allowance) or your own AI API. The Picaffectz system can't draw pictures."], ["unsplash", "Photos from Unsplash", "Real photos found on Unsplash for the words typed, instead of a drawn picture. Needs your own free Unsplash access key."]] as const).map(([v, l, h]) => {
              const on = (d.images?.source === "unsplash" ? "unsplash" : "engine") === v;
              return (
                <label key={v} className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-[13px] ${on ? "border-brand-400 bg-brand-500/10" : "border-ink-600"}`}>
                  <input type="radio" name="img-source" className="mt-1" checked={on} onChange={() => upd({ images: { ...(d.images || {}), source: v } })} />
                  <span><b className="block">{l}</b><span className="text-[11.5px] text-ink-500">{h}</span></span>
                </label>
              );
            })}
            {d.images?.source === "unsplash" && <UnsplashForm where={where} />}
            {d.images?.source !== "unsplash" && (d.ai || general) === "system" && <span className="text-[11.5px] text-amber-300" role="note">This Studio's AI engine is the Picaffectz system, which can't draw pictures. Choose Cloudflare AI or your own AI API above, or use photos from Unsplash.</span>}
            {d.images?.source !== "unsplash" && (d.ai || general) === "custom" && <span className="text-[11.5px] text-ink-500" role="note">Your own AI draws the pictures through its picture endpoint (ChatGPT and Gemini work; add a picture model under AI engine for others). If it fails you see the reason.</span>}
          </div>
          <label className="flex flex-col gap-1 text-[13px] font-semibold">Picture style
            <select className="input w-auto" value={d.images?.style || "photo"} onChange={(e) => upd({ images: { ...(d.images || {}), style: e.target.value as any } })}>
              <option value="photo">Photo-like</option><option value="illustration">Illustration</option><option value="3d">Soft 3D</option><option value="flat">Flat and minimal</option>
            </select>
          </label>
          {d.images?.source !== "unsplash" && <p className="m-0 rounded-lg border border-yellow-400 bg-yellow-200 px-3 py-2 text-[12px] leading-snug text-yellow-950">AI pictures differ each time, what is typed is sent to the AI service, and you may not own the result exclusively. Check them before using one on a live site.</p>}
        </>}
      </Block>
      </>}

      {!onlyAi && <>
      <Block title={`Themes · ${KIND_NAME[kind]}`} note="Your Studio's themes. Show all of them to visitors, or only the ones you tick.">
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold">Themes in the visitor's finished preview</span>
          <div className="grid gap-1 rounded-xl border border-ink-600 p-1 sm:grid-cols-2" role="radiogroup" aria-label="Themes in the carousel">
            {([["answers", "Match the visitor's answers", kind === "business" ? "Every theme of the business type they pick." : "Themes of the genre they pick."], ["custom", "Only the themes I tick", "The same themes for everyone (up to 30), best match first."]] as const).map(([v, l, h]) => {
              const on = (d.carousel?.[kind] || "answers") === v;
              return <button key={v} type="button" role="radio" aria-checked={on} onClick={() => { const c = { ...(d.carousel || {}) }; if (v === "custom") c[kind] = "custom"; else delete c[kind]; upd({ carousel: Object.keys(c).length ? c : undefined }); }} className={`rounded-lg px-3 py-2 text-left ${on ? "bg-ink-700 text-ink-100" : "text-ink-400 hover:text-ink-100"}`}><b className="block text-[13px]">{l}</b><span className="text-[12px] opacity-80">{h}</span></button>;
            })}
          </div>
          {(d.carousel?.[kind] === "custom") && all && <span className="text-[12px] text-amber-300">Choose "Only some" below and tick the themes to show; with "All themes" the first 30 by match are used.</span>}
        </div>
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
                <span className="flex flex-none items-center gap-1.5 text-[11px] text-ink-400"><span className="rounded border border-ink-600 px-1.5 py-px">{t.dark ? "Dark" : "Light"}</span><span className="font-mono">{themeCode(t)}</span></span>
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
      </>}

      <div className="card sticky bottom-3 z-10 flex flex-wrap items-center gap-3 border-ink-600 bg-ink-900/95 p-3 shadow-xl backdrop-blur" role="region" aria-label="Save">
        <p className={`min-w-0 flex-1 text-[13px] ${err ? "text-red-300" : "text-ink-400"}`} role="status">{err || (dirty ? "You have changes that aren't saved yet." : "All changes are saved.")}</p>
        <button type="button" className="btn btn-ghost btn-sm" disabled={!dirty || busy} onClick={() => { setD(saved); setErr(""); }}>Discard</button>
        <button type="button" className="btn btn-pri" disabled={!dirty || busy} onClick={save}>{busy ? "Saving…" : "Save changes"}</button>
      </div>
    </div>
  );
}
