import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ThemeDrawer, ThemeGallery, ThemeSwatch } from "../themes/ThemeGallery";
import { ThemeFromRef } from "./ThemeFromRef";
import { BulkPhotos } from "./BulkPhotos";
import { AdminLookField } from "./AdminLook";
import { SiteWords, Translations } from "./Translations";
import type { Made } from "../lib/themefrom";
import { LinkedInImport } from "./LinkedInImport";
import { pdfToText } from "../lib/pdftext";
import { Motifs, THEMES, type Theme } from "../themes/catalog";
import { limitThemes } from "../themes/limit";
import { themeCode } from "../themes/codes";
import type { Field as F, TemplateDef } from "../schema/types";
import { staticPageDefault } from "../schema/common";
import { LEGAL_PAGES, a11yChecks, collects, identity, legalPage, makeLegalPage, type LegalKind } from "../lib/legal";
import { getP, setP, clone, vpaOk, paypalOk, httpsOk, hostIs, emailOk, phoneOk } from "../lib/util";
import { AiDraw, aiDrawInEditor } from "../ui/AiDraw";
import { Field, ProgressBar, Toggle, useConfirm, useToast } from "../ui/kit";
import { GatewayForm, SiteDbSignIn, WhatsAppForm, useSiteDbSigned } from "../pages/Connections";
import { MAIL_KINDS } from "../lib/mailtpl";
import { MailTemplateEditor } from "./MailTemplate";
import { RichEditor } from "./RichEditor";

export type EditorCtx = {
  tpl: TemplateDef;
  root: any;
  bump: () => void;
  upload: (file: File) => Promise<{ path: string }>;
  img: (v: any) => string;
  /** True in the site's own admin page. */
  site?: boolean;
  /** The site's own Cloudflare database, when it is hosted on one (for keys kept there). */
  cf?: { api: string; site: string } | null;
  /** Settings → Project defaults: connections are the Studio's own for a website type, kept here. */
  pd?: import("../pages/Connections").Where | null;
};
/** Asks the project view to open "Fill in from a pamphlet". */
export const PAMPHLET_EVENT = "studio:pamphlet";
/** Asks the project view to open "Add reviews from Google". */
export const GOOGLE_EVENT = "studio:google-reviews";
/** Asks the live preview to show a page: detail { file }. */
export const PREVIEW_PAGE_EVENT = "studio:preview-page";
export const Ctx = createContext<EditorCtx>(null as any);
const useCtx = () => useContext(Ctx);

export const SHAPES: [string, string][] = [["circle", "Circle"], ["square", "Square"], ["triangle", "Triangle"], ["diamond", "Diamond"], ["ring", "Ring"], ["hexagon", "Hexagon"], ["half", "Half circle"], ["pill", "Pill"]];
const openItems = new Set<string>();
/** Opens a list item (by its key, "hero.work.items#2") so its fields render; used by click-to-edit. */
export const openListItem = (key: string) => openItems.add(key);

function checkMsg(kind: string | undefined, v: string): string | undefined {
  if (!kind || !v) return;
  if (kind === "vpa" && !vpaOk(v)) return "This doesn't look like a UPI ID (name@bank).";
  if (kind === "paypal" && !paypalOk(v)) return "Use only the PayPal.me username: letters and numbers.";
  if (kind === "https" && !httpsOk(v)) return "Use a full https:// link.";
  if (kind === "razorpay" && (!httpsOk(v) || !hostIs(v, /(^|\.)razorpay\.com$|(^|\.)rzp\.io$/i))) return "This isn't a razorpay.com or rzp.io link. Check it before saving.";
  if (kind === "stripe" && (!httpsOk(v) || !hostIs(v, /(^|\.)stripe\.com$/i))) return "This isn't a stripe.com link. Check it before saving.";
  if (kind === "email" && !emailOk(v)) return "This doesn't look like an email address.";
  if (kind === "phone" && !phoneOk(v)) return "Use digits with the country code, e.g. +91 98765 43210.";
}

/** Text boxes whose words don't show on the page as text (addresses, codes, keys): no colour button there. */
const NO_INK = /(url|href|link|email|phone|mobile|whats|slug|domain|vpa|upi|gstin|pan|code|css|html|js|id|key|token|secret|password|handle|username|map|embed|src|file|path|color|colour|lang|currency|pin|zip|date|time)$/i;
export const canInk = (path: string) => !NO_INK.test(path.split(".").pop() || "");
const INK_HEX = /^#[0-9a-f]{6}$/i;
/** A colour for one piece of text. It is kept beside the text (title → titleInk) so it follows the item when a list is moved or copied. */
function TextInk({ obj, k, label }: { obj: any; k: string; label: string }) {
  const { bump } = useCtx();
  const ck = k + "Ink", cur = String(getP(obj, ck) ?? ""), on = INK_HEX.test(cur);
  return (
    <span className="mt-1 flex shrink-0 items-center gap-1" data-ink-ctl>
      <label className="icon-btn relative cursor-pointer" title={on ? "Text colour (click to change)" : "Choose a colour for this text"}>
        <span aria-hidden className="text-[13px] font-bold leading-none" style={{ borderBottom: `3px solid ${on ? cur : "currentColor"}`, paddingBottom: 1 }}>A</span>
        <input type="color" aria-label={`Text colour: ${label}`} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" value={on ? cur : "#ffffff"} onChange={(e) => { setP(obj, ck, e.target.value); bump(); }} />
      </label>
      {on && <button type="button" className="icon-btn" title="Back to the theme's colour" aria-label={`Use the theme's colour for ${label}`} onClick={() => { setP(obj, ck, ""); bump(); }}>↺</button>}
    </span>
  );
}
/** The same for one line of a list of lines; kept as lines Inks = { "<line>": "#hex" } so reordering never mixes them up. */
function LineInk({ obj, k, line, label }: { obj: any; k: string; line: string; label: string }) {
  const { bump } = useCtx();
  const ck = k + "Inks", map: Record<string, string> = getP(obj, ck) && typeof getP(obj, ck) === "object" ? getP(obj, ck) : {};
  const cur = String(map[line] ?? ""), on = INK_HEX.test(cur);
  const put = (v: string) => { const m = { ...map }; if (v) m[line] = v; else delete m[line]; setP(obj, ck, m); bump(); };
  return (
    <span className="mt-1 flex shrink-0 items-center gap-1" data-ink-ctl>
      <label className="icon-btn relative cursor-pointer" title={on ? "Text colour (click to change)" : "Choose a colour for this line"}>
        <span aria-hidden className="text-[13px] font-bold leading-none" style={{ borderBottom: `3px solid ${on ? cur : "currentColor"}`, paddingBottom: 1 }}>A</span>
        <input type="color" aria-label={`Text colour: ${label}`} disabled={!line.trim()} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" value={on ? cur : "#ffffff"} onChange={(e) => put(e.target.value)} />
      </label>
      {on && <button type="button" className="icon-btn" title="Back to the theme's colour" aria-label={`Use the theme's colour for ${label}`} onClick={() => put("")}>↺</button>}
    </span>
  );
}

export function FieldView({ f, obj, base }: { f: F; obj: any; base: string }) {
  const ctx = useCtx(); const { bump, root, tpl } = ctx;
  const id = `f-${base}-${"path" in f ? f.path : ""}`.replace(/[^\w-]/g, "_");
  const val = "path" in f ? getP(obj, f.path) : undefined;
  const set = (v: any) => {
    if ("path" in f) setP(obj, f.path, v);
    bump();
  };

  switch (f.t) {
    case "when": {
      const v = String(getP(f.local ? obj : root, f.path) ?? "");
      if (f.isAny ? !f.isAny.includes(v) : f.notAny ? f.notAny.includes(v) : f.is !== undefined ? v !== f.is : v === f.not) return null;
      return <>{f.fields.map((x, i) => <FieldView key={i} f={x} obj={obj} base={base} />)}</>;
    }
    case "grid":
      return (
        <div className={`grid gap-3.5 ${f.cols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          {f.fields.map((x, i) => <FieldView key={i} f={x} obj={obj} base={base} />)}
        </div>
      );
    case "translations":
      return <Translations root={root} bump={bump} />;
    case "siteWords":
      return <SiteWords root={root} bump={bump} />;
    case "mailtpl":
      return <MailTplField kind={f.kind} subject={f.subject} />;
    case "note":
      if (f.studio && ctx.site) return null;
      return <p className={`rounded-lg border px-3 py-2.5 text-[13px] ${f.tone === "warn" ? "border-amber-400/40 bg-amber-400/5 text-amber-100" : "border-ink-700 bg-ink-850 text-ink-300"}`}>{f.text}</p>;
    case "text":
      if (f.ml) {
        return (
          <Field label={f.label} htmlFor={id} hint={f.hint || "Enter starts a new line."}>
            <div className="flex items-start gap-1.5">
              <div className="min-w-0 flex-1"><GrowText id={id} value={val ?? ""} ph={f.ph} onChange={set} /></div>
              {canInk(f.path) && <TextInk obj={obj} k={f.path} label={f.label} />}
            </div>
          </Field>
        );
      }
      return (
        <Field label={f.label} htmlFor={id} hint={f.show ? f.show(String(val ?? "")) : f.hint} warn={checkMsg(f.check, String(val ?? ""))}>
          <div className="flex items-start gap-1.5">
            <input id={id} className="input min-w-0 flex-1" value={val ?? ""} placeholder={f.ph} spellCheck={!f.check} onChange={(e) => set(e.target.value)} />
            {!f.check && canInk(f.path) && <TextInk obj={obj} k={f.path} label={f.label} />}
          </div>
        </Field>
      );
    case "date":
      return (
        <Field label={f.label} htmlFor={id} hint={f.hint}>
          <input id={id} className="input" type="date" value={/^\d{4}-\d{2}-\d{2}$/.test(String(val ?? "")) ? val : ""} onChange={(e) => set(e.target.value)} />
        </Field>
      );
    case "textarea":
      return (
        <Field label={f.label} htmlFor={id} hint={f.hint}>
          {f.pdf && <PdfFill id={id} has={!!String(val ?? "").trim()} onText={(r, mode) => {
            set(mode === "add" && String(val ?? "").trim() ? String(val).replace(/\s+$/, "") + "\n\n" + r.text : r.text);
            const t = getP(obj, "title");
            if (r.title && (!String(t ?? "").trim() || /^(new page|untitled page)$/i.test(String(t)))) { setP(obj, "title", r.title); bump(); }
          }} />}
          {f.rich ? <RichEditor id={id} value={String(val ?? "")} onChange={set} label={f.label} minRows={f.rows || 14} /> : <div className="flex items-start gap-1.5">
          <textarea id={id} className={`input min-w-0 flex-1 min-h-[84px] resize-y leading-relaxed${f.code ? " font-mono text-[13px]" : ""}${f.code ? " whitespace-pre" : ""}`} rows={f.rows || 3} value={val ?? ""} placeholder={f.ph} spellCheck={f.code ? false : undefined} autoCapitalize={f.code ? "off" : undefined} autoCorrect={f.code ? "off" : undefined} wrap={f.code ? "off" : undefined}
            onKeyDown={f.code ? (e) => { if (e.key !== "Tab" || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return; e.preventDefault(); const el = e.currentTarget, a = el.selectionStart, b = el.selectionEnd; set(el.value.slice(0, a) + "  " + el.value.slice(b)); requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = a + 2; }); } : undefined}
            onChange={(e) => set(e.target.value)} />
            {!f.code && !f.pdf && canInk(f.path) && <TextInk obj={obj} k={f.path} label={f.label} />}
          </div>}
        </Field>
      );
    case "number":
      return (
        <Field label={f.label} htmlFor={id} hint={f.hint}>
          <input id={id} type="number" className="input tabular-nums" min={f.min} step={f.step ?? "any"} value={val ?? 0} onChange={(e) => set(e.target.value === "" ? 0 : Number(e.target.value))} />
        </Field>
      );
    case "select":
      return (
        <Field label={f.label} htmlFor={id}>
          {(() => {
            // Choices kept for the Studio's editor stay out of a site's own admin page, unless the Studio allowed them for this site.
            const allow: string[] = Array.isArray(ctx.root?.cms?.allow) ? ctx.root.cms.allow : [];
            const opts = f.options.filter((o) => typeof o === "string" || !ctx.site || !o.studio || (!!o.siteIf && allow.includes(o.siteIf)));
            const cur = val ?? "", shown = opts.some((o) => (typeof o === "string" ? o : o.value) === cur) ? cur : opts.length ? (typeof opts[0] === "string" ? opts[0] : opts[0].value) : cur;
            return <select id={id} className="input" value={shown} onChange={(e) => set(e.target.value)}>
              {opts.map((o) => (typeof o === "string" ? <option key={o} value={o}>{o[0].toUpperCase() + o.slice(1)}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}
            </select>;
          })()}
        </Field>
      );
    case "ref": {
      const list: any[] = getP(root, f.source) || [];
      return (
        <Field label={f.label} htmlFor={id}>
          <select id={id} className="input" value={val ?? ""} onChange={(e) => set(e.target.value)}>
            <option value="">{f.empty || "None"}</option>
            {list.map((o) => <option key={o[f.valueKey]} value={o[f.valueKey]}>{o[f.labelKey]}</option>)}
          </select>
        </Field>
      );
    }
    case "toggle":
      return <Toggle id={id} label={f.label} checked={val === undefined || val === null ? !!f.def : !!val} onChange={set} />;
    case "range":
      return (
        <Field label={f.label} htmlFor={id}>
          <div className="flex items-center gap-3">
            <input id={id} type="range" className="flex-1 accent-brand-500" min={f.min} max={f.max} step={f.step} value={val ?? 0} onChange={(e) => set(Number(e.target.value))} />
            <output className="w-12 text-right font-mono text-xs">{val}{f.unit}</output>
          </div>
        </Field>
      );
    case "color":
      return (
        <Field label={f.label} htmlFor={id}>
          <div className="flex gap-2">
            <input type="color" aria-label={`${f.label} picker`} className="h-[42px] w-11 flex-none cursor-pointer rounded-lg border border-ink-600 bg-ink-950 p-0" value={/^#[0-9a-f]{6}$/i.test(val) ? val : "#000000"} onChange={(e) => set(e.target.value)} />
            <ColorText id={id} value={val} onValid={set} />
          </div>
        </Field>
      );
    case "colorKey": {
      const theme = getP(root, tpl.themePath) || {};
      return (
        <div className="flex flex-col gap-1.5">
          <span className="label">{f.label}</span>
          <div role="radiogroup" aria-label={f.label} className="flex flex-wrap gap-2">
            {tpl.colorKeys.map((c) => (
              <button key={c.key} type="button" role="radio" aria-checked={val === c.key} title={c.label} aria-label={c.label}
                onClick={() => set(c.key)} style={{ background: theme[c.key] }}
                className={`h-8 w-8 rounded-lg border-2 ${val === c.key ? "border-white ring-2 ring-brand-500" : "border-ink-600"}`} />
            ))}
          </div>
        </div>
      );
    }
    case "shape": {
      const pack = Motifs.resolve(getP(root, tpl.themePath) || {}, "tech");
      const names = Motifs.names(pack);
      return (
        <div className="flex flex-col gap-1.5">
          <span className="label">{f.label}</span>
          <div role="radiogroup" aria-label={f.label} className="flex flex-wrap gap-2">
            {SHAPES.map(([k, l], i) => {
              const name = names[i] || l;
              return (
                <button key={k} type="button" role="radio" aria-checked={val === k} title={name} aria-label={name} onClick={() => set(k)}
                  className={`grid place-items-center rounded-lg border ${names.length ? "h-12 w-12" : "h-10 w-10"} ${val === k ? "border-brand-500 bg-brand-500/15 text-brand-300" : "border-ink-600 bg-ink-950 text-ink-400"}`}>
                  {names.length
                    ? <span className="block h-8 w-8" style={{ ["--mo2" as any]: "#FFC83A" }} dangerouslySetInnerHTML={{ __html: Motifs.svg(pack, k) }} />
                    : <span className={`shp ${k}`} style={{ width: 18, height: 18, background: "currentColor" }} />}
                </button>
              );
            })}
          </div>
        </div>
      );
    }
    case "image":
      return <ImageField id={id} label={f.label} hint={f.hint} value={val} onChange={set} ai={canDraw(f.path)} />;
    case "videoFile":
      return <VideoFileField id={id} label={f.label} hint={f.hint} value={val} onChange={set} />;
    case "connection":
      return <ConnectionField kind={f.kind} />;
    case "fontFile":
      return <FontFileField id={id} label={f.label} hint={f.hint} value={val} onChange={set} />;
    case "images":
      return <ImagesField id={id} label={f.label} hint={f.hint} value={Array.isArray(val) ? val : []} onChange={set} ai={canDraw(f.path)} />;
    case "strings":
      return <StringsField f={f} arr={Array.isArray(val) ? val : []} set={set} id={id} obj={obj} />;
    case "list":
      return <ListField f={f} obj={obj} base={base} />;
    case "themes":
      return <ThemesField />;
    case "adminThemes":
      return <AdminThemesField />;
    case "adminSections":
      return <AdminSectionsField />;
    case "codeTemplate":
      return <CodeTemplateField />;
    case "bulkPhotos":
      return <BulkPhotos kind={f.kind} />;
    case "adminLook":
      return <AdminLookField />;
    case "legalPages":
      return <LegalPagesField />;
    case "a11yCheck":
      return <A11yCheckField />;
    case "previewPages":
      return (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand-500/40 bg-brand-500/5 p-3">
          <p className="min-w-0 flex-[1_1_100%] text-[13px] text-ink-300">{f.text || "See it in the live preview:"}</p>
          {f.pages.map((pg) => <button key={pg.file} type="button" className="btn btn-sm" onClick={() => dispatchEvent(new CustomEvent(PREVIEW_PAGE_EVENT, { detail: { file: pg.file } }))}>{pg.label}</button>)}
        </div>
      );
    case "googleReviews":
      return (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-brand-500/40 bg-brand-500/5 p-3">
          <p className="min-w-0 flex-1 text-[13px] text-ink-300">Show your Google reviews here, with the stars you choose, the reviewer's name and your Google rating.</p>
          <button type="button" className="btn btn-sm btn-pri" onClick={() => dispatchEvent(new CustomEvent(GOOGLE_EVENT))}>Add reviews from Google</button>
        </div>
      );
    case "pamphlet":
      return (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-brand-500/40 bg-brand-500/5 p-3">
          <p className="min-w-0 flex-1 text-[13px] text-ink-300">{f.text || "Have a product pamphlet or brochure? Upload it and the products are filled in for you."}</p>
          <button type="button" className="btn btn-sm btn-pri" onClick={() => dispatchEvent(new CustomEvent(PAMPHLET_EVENT))}>{f.button || "Fill in from a pamphlet"}</button>
        </div>
      );
    case "linkedin":
      return <LinkedInImport root={root} bump={bump} />;
    case "presets":
      return (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {f.presets.map((p) => (
            <button key={p.name} type="button" className="flex flex-col gap-2 rounded-xl border border-ink-600 bg-ink-950 p-2.5 text-left text-[13px] font-bold hover:border-brand-500"
              onClick={() => {
                Object.assign(getP(root, f.target), p.values);
                bump();
              }}>
              <span className="flex h-7 overflow-hidden rounded-md">{Object.values(p.values).slice(0, 6).map((c, i) => <i key={i} className="flex-1" style={{ background: c }} />)}</span>
              {p.name}
            </button>
          ))}
        </div>
      );
  }
}

function ColorText({ id, value, onValid }: { id: string; value: string; onValid: (v: string) => void }) {
  const [txt, setTxt] = useState(value);
  const last = useRef(value);
  if (value !== last.current) {
    last.current = value;
    if (txt !== value) setTxt(value);
  }
  return <input id={id} className="input font-mono text-[13px]" maxLength={7} spellCheck={false} value={txt ?? ""} onChange={(e) => { setTxt(e.target.value); if (/^#[0-9a-f]{6}$/i.test(e.target.value)) { last.current = e.target.value; onValid(e.target.value); } }} />;
}

function useUpload() {
  const { upload } = useCtx();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = async (files: File[]): Promise<{ path: string }[]> => {
    const ok: File[] = [];
    for (const file of files) {
      if (!/^image\/(png|jpe?g|webp|gif|svg\+xml)$/.test(file.type)) toast(`${file.name}: use JPG, PNG, WebP, GIF or SVG.`, "bad");
      else if (file.size > 20 * 1024 * 1024) toast(`${file.name} is over 20 MB. Choose a smaller image.`, "bad");
      else ok.push(file);
    }
    if (!ok.length) return [];
    setBusy(true);
    try {
      const out: { path: string }[] = [];
      for (const f of ok) out.push(await upload(f));
      toast(out.length > 1 ? `${out.length} images uploaded. Save to keep them.` : "Image uploaded. Save to keep it.");
      return out;
    } catch (e: any) {
      toast("Upload failed: " + (e?.message || "try again"), "bad");
      return [];
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

/** Pictures may be drawn by AI (when allowed in Settings), except logos and icons. */
const canDraw = (path: string) => aiDrawInEditor() && !/logo|icon|favicon|avatar/i.test(path || "");

function ImageField({ id, label, hint, value, onChange, ai }: { id: string; label: string; hint?: string; value: any; onChange: (v: any) => void; ai?: boolean }) {
  const { img } = useCtx();
  const { busy, run } = useUpload();
  const [draw, setDraw] = useState(false);
  return (
    <div data-field className="flex flex-col gap-1.5 rounded-lg">
      <span className="label">{label}</span>
      <div className="flex flex-wrap items-center gap-3.5">
        <div className="grid h-20 w-20 flex-none place-items-center overflow-hidden rounded-xl border border-dashed border-ink-600 bg-ink-950 text-[11px] text-ink-500">
          {value ? <img src={img(value)} alt="" className="h-full w-full object-cover" /> : "No image"}
        </div>
        <div className="flex flex-wrap gap-2">
          <label htmlFor={id} className="btn btn-sm cursor-pointer">{busy ? "Uploading…" : value ? "Replace" : "Upload"}</label>
          <input id={id} type="file" accept="image/*" hidden disabled={busy} onChange={async (e) => { const [r] = await run([...(e.target.files || [])].slice(0, 1)); e.target.value = ""; if (r) onChange(r); }} />
          {ai && <button type="button" className="btn btn-sm" aria-expanded={draw} disabled={busy} onClick={() => setDraw((x) => !x)}>Draw with AI</button>}
          {value && <button type="button" className="btn btn-sm btn-danger" onClick={() => onChange(null)}>Remove</button>}
        </div>
      </div>
      {ai && draw && <AiDraw count={2} disabled={busy} label={`Describe the picture for "${label}"`} onUse={async (f) => { const [r] = await run([f]); if (r) { onChange(r); setDraw(false); } }} />}
      <span className="hint">{hint || "JPG, PNG, WebP or SVG, up to 20 MB."}</span>
    </div>
  );
}

/** An uploaded video: MP4 or WebM up to 20 MB, stored with the site's pictures (so it is saved, backed up and published with them). */
/** Whether a font file is a variable font (it carries an "fvar" table), read from the file's table list. */
export async function isVariableFont(file: Blob): Promise<boolean> {
  try {
    const b = new Uint8Array(await file.slice(0, 4096).arrayBuffer()), sig = String.fromCharCode(b[0], b[1], b[2], b[3]);
    const tag = (i: number) => String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]), u16 = (i: number) => (b[i] << 8) | b[i + 1];
    if (sig === "wOFF") { const n = u16(12); for (let i = 0; i < n; i++) if (tag(44 + i * 20) === "fvar") return true; return false; }
    if (sig === "wOF2") {
      // Table list: a flag byte (known tag number, or 63 = the tag follows), then lengths as base-128 numbers.
      const n = u16(12); let p = 48;
      const num = () => { for (let i = 0; i < 5; i++) if (!(b[p++] & 0x80)) break; };
      for (let i = 0; i < n && p < b.length - 8; i++) {
        const fl = b[p++], k = fl & 63, ver = fl >> 6; let t = "";
        if (k === 63) { t = tag(p); p += 4; }
        if (k === 47 || t === "fvar") return true;
        num(); if (k === 10 || k === 11 ? ver === 0 : ver !== 0) num();
      }
      return false;
    }
    const n = u16(4); for (let i = 0; i < n; i++) if (tag(12 + i * 16) === "fvar") return true;
  } catch { /* unreadable: treated as one weight */ }
  return false;
}
function FontFileField({ id, label, hint, value, onChange }: { id: string; label: string; hint?: string; value: any; onChange: (v: any) => void }) {
  const { img, upload } = useCtx();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const pick = async (file?: File) => {
    if (!file) return;
    if (!/\.(woff2|woff|ttf|otf)$/i.test(file.name)) { toast(`${file.name}: use a font file (WOFF2, WOFF, TTF or OTF).`, "bad"); return; }
    if (file.size > 20 * 1024 * 1024) { toast(`${file.name} is ${(file.size / 1048576).toFixed(1)} MB. Font uploads go up to 20 MB: a WOFF2 version is usually far smaller.`, "bad"); return; }
    setBusy(true);
    try { const variable = await isVariableFont(file); onChange({ ...(await upload(file)), ...(variable ? { variable: true } : {}) }); toast("Font uploaded. Save to keep it."); }
    catch (e: any) { toast("Upload failed: " + (e?.message || "try again"), "bad"); }
    finally { setBusy(false); }
  };
  const src = value?.path ? img(value) : "", name = String(value?.path || "").split("/").pop()?.replace(/^\d+-/, "") || "";
  // The sample line is drawn in the uploaded font itself.
  const fam = "ed-font-" + id.replace(/[^a-z0-9]/gi, "");
  const [shown, setShown] = useState(false);
  useEffect(() => {
    setShown(false); if (!src || typeof FontFace === "undefined") return;
    let on = true; const ff = new FontFace(fam, `url("${src}")`, value?.variable ? { weight: "100 900" } : {});
    ff.load().then((f) => { if (!on) return; (document.fonts as any).add(f); setShown(true); }).catch(() => {});
    return () => { on = false; try { (document.fonts as any).delete(ff); } catch { /* not added */ } };
  }, [src, fam, value?.variable]);
  return (
    <div data-field className="flex flex-col gap-1.5 rounded-lg">
      <span className="label">{label}</span>
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid h-14 min-w-[150px] flex-none place-items-center overflow-hidden rounded-xl border border-dashed border-ink-600 bg-ink-950 px-3 text-ink-200" aria-label={value ? `Sample of ${name}` : undefined}>
          {value ? <span style={{ fontFamily: shown ? `"${fam}"` : undefined, fontSize: 22, lineHeight: 1 }}>{shown ? "Aa Bb Cc 123" : src ? "Loading…" : "…"}</span> : <span className="text-[11px] text-ink-500">No file</span>}
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          {value && <span className="break-words text-[13px] text-ink-300">{name}{value.variable ? " · variable font (every weight)" : " · one weight (bold is drawn by the browser)"}</span>}
          <div className="flex flex-wrap gap-2">
            <label htmlFor={id} className="btn btn-sm cursor-pointer">{busy ? "Uploading…" : value ? "Replace" : "Upload a font"}</label>
            <input id={id} type="file" accept=".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf" hidden disabled={busy} onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; await pick(f); }} />
            {value && <button type="button" className="btn btn-sm btn-danger" onClick={() => onChange(null)}>Remove</button>}
          </div>
        </div>
      </div>
      <span className="hint">{hint || "WOFF2, WOFF, TTF or OTF, up to 20 MB. WOFF2 loads fastest."}</span>
    </div>
  );
}
/** "Edit template" under an email's wording boxes: opens the notepad; says when a template is in use. */
function MailTplField({ kind, subject }: { kind: string; subject?: string }) {
  const { root, bump, cf } = useCtx(), [open, setOpen] = useState(false);
  const path = `emails.${kind}.tpl`, value = String(getP(root, path) ?? "");
  if (!MAIL_KINDS[kind]) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <button type="button" className="btn btn-sm" onClick={() => setOpen(true)}>Edit template</button>
      <span className="text-[12.5px] text-ink-400">{value.trim() ? "A template is in use: it replaces the boxes above (the subject stays)." : "Write the whole email yourself, with a preview and a test email."}</span>
      {open && <MailTemplateEditor kind={kind} value={value} subject={String((subject && getP(root, subject)) || "")} siteName={String(getP(root, "brand.name") || getP(root, "brand.logoText") || "")} cf={cf} onClose={() => setOpen(false)} onSave={(t) => { setP(root, path, t); bump(); }} />}
    </div>
  );
}
/** A connection's own form (its keys go to the site's database, never into the site's content). */
function ConnectionField({ kind }: { kind: "rz" | "wa" | "cf" | "pe" | "st" | "pp" }) {
  const { cf, pd } = useCtx();
  const signed = useSiteDbSigned(cf), where = pd !== undefined ? pd : cf && signed ? { api: cf.api, scope: "site:" + cf.site } : null;
  if (pd === null) return null; // Settings → Project defaults without the Studio's database: the page says so once
  if (pd === undefined && cf && !signed) return <SiteDbSignIn cf={cf} small what="show the boxes for these keys" />;
  return kind === "wa" ? <WhatsAppForm where={where} kind="site" /> : <GatewayForm where={where} gw={kind} />;
}
function VideoFileField({ id, label, hint, value, onChange }: { id: string; label: string; hint?: string; value: any; onChange: (v: any) => void }) {
  const { img, upload } = useCtx();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const pick = async (file?: File) => {
    if (!file) return;
    if (!/^video\/(mp4|webm)$/.test(file.type) && !/\.(mp4|webm)$/i.test(file.name)) { toast(`${file.name}: use an MP4 or WebM video.`, "bad"); return; }
    if (file.size > 20 * 1024 * 1024) { toast(`${file.name} is ${(file.size / 1048576).toFixed(0)} MB. Uploads go up to 20 MB: shorten or compress it, or put it on YouTube or Vimeo and paste the link.`, "bad"); return; }
    setBusy(true);
    try { onChange(await upload(file)); toast("Video uploaded. Save to keep it."); }
    catch (e: any) { toast("Upload failed: " + (e?.message || "try again"), "bad"); }
    finally { setBusy(false); }
  };
  const src = value ? img(value) : "", name = String(value?.path || "").split("/").pop()?.replace(/^\d+-/, "") || "";
  return (
    <div data-field className="flex flex-col gap-1.5 rounded-lg">
      <span className="label">{label}</span>
      <div className="flex flex-wrap items-center gap-3.5">
        <div className="grid h-20 w-36 flex-none place-items-center overflow-hidden rounded-xl border border-dashed border-ink-600 bg-ink-950 text-[11px] text-ink-500">
          {value ? (src ? <video src={src} muted playsInline preload="metadata" className="h-full w-full object-cover" aria-label={`Uploaded video ${name}`} /> : "Loading…") : "No video"}
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          {value && <span className="truncate text-[13px] text-ink-300">{name}</span>}
          <div className="flex flex-wrap gap-2">
            <label htmlFor={id} className="btn btn-sm cursor-pointer">{busy ? "Uploading…" : value ? "Replace" : "Upload a video"}</label>
            <input id={id} type="file" accept="video/mp4,video/webm,.mp4,.webm" hidden disabled={busy} onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; await pick(f); }} />
            {value && <button type="button" className="btn btn-sm btn-danger" onClick={() => onChange(null)}>Remove</button>}
          </div>
        </div>
      </div>
      {busy && <ProgressBar value={null} label="Uploading the video" detail="Uploading… a large video can take a minute." />}
      <span className="hint">{hint || "MP4 or WebM, up to 20 MB."}</span>
    </div>
  );
}

function ImagesField({ id, label, hint, value, onChange, ai }: { id: string; label: string; hint?: string; value: any[]; onChange: (v: any[]) => void; ai?: boolean }) {
  const { img } = useCtx();
  const { busy, run } = useUpload();
  const [draw, setDraw] = useState(false);
  const move = (i: number, d: number) => { const a = [...value]; [a[i], a[i + d]] = [a[i + d], a[i]]; onChange(a); };
  return (
    <div data-field className="flex flex-col gap-1.5 rounded-lg">
      <span className="label">{label}</span>
      <div className="flex flex-wrap gap-2.5">
        {value.map((v, i) => (
          <div key={(v?.path || "") + i} className="group relative h-20 w-20 overflow-hidden rounded-xl border border-ink-600">
            <img src={img(v)} alt="" className="h-full w-full object-cover" />
            {i === 0 && <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 text-[10px] font-bold">Main</span>}
            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/70 p-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
              <button type="button" aria-label="Move earlier" disabled={i === 0} onClick={() => move(i, -1)} className="px-1 text-xs disabled:opacity-30">←</button>
              <button type="button" aria-label="Remove" onClick={() => onChange(value.filter((_, j) => j !== i))} className="px-1 text-xs text-red-300">✕</button>
              <button type="button" aria-label="Move later" disabled={i === value.length - 1} onClick={() => move(i, 1)} className="px-1 text-xs disabled:opacity-30">→</button>
            </div>
          </div>
        ))}
        <label htmlFor={id} className="grid h-20 w-20 cursor-pointer place-items-center rounded-xl border border-dashed border-ink-500 text-center text-[11px] font-semibold text-ink-300 hover:border-brand-400">{busy ? "Uploading…" : "+ Add photos"}</label>
        <input id={id} type="file" accept="image/*" multiple hidden disabled={busy} onChange={async (e) => { const r = await run([...(e.target.files || [])].slice(0, 10)); e.target.value = ""; if (r.length) onChange([...value, ...r]); }} />
      </div>
      {ai && <button type="button" className="btn btn-sm self-start" aria-expanded={draw} disabled={busy} onClick={() => setDraw((x) => !x)}>Draw with AI</button>}
      {ai && draw && <AiDraw count={2} disabled={busy} label={`Describe a picture to add to "${label}"`} onUse={async (f) => { const r = await run([f]); if (r.length) onChange([...value, ...r]); }} />}
      <span className="hint">{hint || "Up to 20 MB each."}</span>
    </div>
  );
}

function StringsField({ f, arr, set, id, obj }: { f: Extract<F, { t: "strings" }>; arr: any[]; set: (v: any) => void; id: string; obj?: any }) {
  const upd = (i: number, v: any) => {
    const a = [...arr], old = a[i]; a[i] = v;
    // a line's colour follows its words while they are being edited
    if (obj && typeof old === "string" && typeof v === "string" && old !== v) {
      const m = getP(obj, f.path + "Inks");
      if (m && typeof m === "object" && m[old]) { const n = { ...m }; if (v.trim()) n[v] = n[old]; delete n[old]; setP(obj, f.path + "Inks", n); }
    }
    set(a);
  };
  const move = (i: number) => { const a = [...arr]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; set(a); };
  return (
    <div className="flex flex-col gap-1.5">
      <span className="label">{f.label}</span>
      <div className="flex flex-col gap-2">
        {arr.map((s, i) => (
          <div key={i} className="flex items-start gap-2">
            {f.multiline
              ? <textarea id={`${id}-${i}`} aria-label={`${f.label} ${i + 1}`} rows={2} className="input min-h-[56px] resize-y" value={s} onChange={(e) => upd(i, e.target.value)} />
              : <input id={`${id}-${i}`} aria-label={`${f.label} ${i + 1}`} className="input" type={f.number ? "number" : "text"} value={s} onChange={(e) => upd(i, f.number ? Number(e.target.value) || 0 : e.target.value)} />}
            {obj && !f.number && canInk(f.path) && <LineInk obj={obj} k={f.path} line={String(s ?? "")} label={`${f.label} ${i + 1}`} />}
            <button type="button" className="icon-btn mt-1.5" aria-label="Move up" disabled={i === 0} onClick={() => move(i)}>↑</button>
            <button type="button" className="icon-btn mt-1.5 hover:text-red-300" aria-label="Remove" onClick={() => set(arr.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
      </div>
      <button type="button" className="btn btn-sm self-start" onClick={() => set([...arr, f.number ? 0 : ""])}>+ {f.addLabel || "Add"}</button>
    </div>
  );
}

function ListField({ f, obj, base }: { f: Extract<F, { t: "list" }>; obj: any; base: string }) {
  const { bump } = useCtx();
  const confirm = useConfirm();
  const [, force] = useState(0);
  const arr: any[] = getP(obj, f.path) || [];
  const key = (i: number) => `${base}.${f.path}#${i}`;
  const toggle = (i: number) => { const k = key(i); openItems.has(k) ? openItems.delete(k) : openItems.add(k); force((n) => n + 1); };
  const swap = (a: number, b: number) => {
    [arr[a], arr[b]] = [arr[b], arr[a]];
    const A = openItems.has(key(a)), B = openItems.has(key(b));
    openItems.delete(key(a)); openItems.delete(key(b));
    if (A) openItems.add(key(b));
    if (B) openItems.add(key(a));
    bump();
  };
  return (
    <div className="flex flex-col gap-2">
      {f.label && <span className="label">{f.label}</span>}
      {!arr.length && <p className="hint">Nothing here yet.</p>}
      {arr.map((it, i) => {
        const open = openItems.has(key(i));
        return (
          <div key={i} className="overflow-hidden rounded-xl border border-ink-600 bg-ink-950">
            <div className="flex items-center gap-2 px-3 py-2">
              <button type="button" aria-expanded={open} onClick={() => toggle(i)} className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left text-sm font-bold">
                <span className={`text-ink-400 transition ${open ? "rotate-90" : ""}`}>›</span>
                <span className="truncate">{f.title(it, i) || "Untitled"}</span>
              </button>
              <button type="button" className="icon-btn" aria-label="Move up" disabled={i === 0} onClick={() => swap(i, i - 1)}>↑</button>
              <button type="button" className="icon-btn" aria-label="Move down" disabled={i === arr.length - 1} onClick={() => swap(i, i + 1)}>↓</button>
              {!f.fixed && <button type="button" className="icon-btn hover:text-red-300" aria-label="Delete" onClick={async () => { if (await confirm("Delete this item?", `“${f.title(it, i) || "Untitled"}” will be removed when you save.`, "Delete", true)) { arr.splice(i, 1); openItems.clear(); bump(); } }}>✕</button>}
            </div>
            {open && (
              <div className="flex flex-col gap-3.5 border-t border-ink-700 px-3.5 py-3.5">
                {f.item.map((sf, j) => <FieldView key={j} f={sf} obj={it} base={`${base}.${f.path}.${i}`} />)}
              </div>
            )}
          </div>
        );
      })}
      {!f.fixed && !(f.max && arr.length >= f.max) && (
        <button type="button" className="btn btn-sm self-start" onClick={() => { const next = [...arr, clone(f.add())]; setP(obj, f.path, next); openItems.add(key(next.length - 1)); bump(); }}>+ Add</button>
      )}
    </div>
  );
}

/** A heading box that grows with its text: one row for one line, more as lines are added or wrap. */
function GrowText({ id, value, ph, onChange }: { id: string; value: string; ph?: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + 2 + "px";
  }, [value]);
  return <textarea ref={ref} id={id} rows={1} className="input resize-none overflow-hidden leading-snug" value={value} placeholder={ph} onChange={(e) => onChange(e.target.value)} />;
}

/** Which themes the site's own admin page offers: content.cms.themes = { mode, list }. Default: only the current one. */
export function adminThemeChoice(root: any, all: Theme[]): { mode: "current" | "some" | "all"; themes: Theme[] } {
  const cfg = root?.cms?.themes || {}, cur = root?.theme?.preset;
  const mode = cfg.mode === "all" || cfg.mode === "some" ? cfg.mode : "current";
  if (mode === "all") return { mode, themes: all };
  const ids = new Set<string>([...(mode === "some" && Array.isArray(cfg.list) ? cfg.list : []), ...(cur ? [cur] : [])]);
  return { mode, themes: all.filter((t) => ids.has(t.id)) };
}

function ThemesField() {
  const { tpl, root, bump, site } = useCtx();
  const all = limitThemes(tpl.themes || THEMES, root?.theme?.preset, tpl.id);
  const locked = !!root?.code?.on;
  const pick = (th: Theme) => {
    if (locked) return;
    // With a shortlist, the theme being left stays on it: the current theme only counts while it's current.
    const cfg = root.cms?.themes, prev = root.theme?.preset;
    if (cfg?.mode === "some" && prev && prev !== th.id) { const list: string[] = Array.isArray(cfg.list) ? cfg.list : []; if (!list.includes(prev)) cfg.list = [...list, prev]; }
    applyTheme(root, tpl, th); bump();
  };
  /** A theme made from a reference: its nearest Studio theme becomes the current one, with the measured look over it. */
  const useMade = (m: Made) => { const base = all.find((t) => t.id === m.base.id) || m.base; applyTheme(root, tpl, base); Object.assign(root.theme, m.values, { preset: base.id }); bump(); };
  const fromRef = <ThemeFromRef tpl={tpl} onApply={useMade} />;
  const cur = all.find((t) => t.id === root.theme?.preset);
  const tweaked = !!cur && themeTweaked(root, tpl, cur);
  const reset = tweaked && cur ? <p className="flex flex-wrap items-center gap-2 text-[13px] text-ink-400">Your changes to {cur.name} are kept when you switch themes and come back.<button type="button" className="text-brand-300 underline" onClick={() => { Object.assign(root.theme, tpl.themeValues(cur)); if (root.themeMemory) delete root.themeMemory[cur.id]; bump(); }}>Reset {cur.name} to its defaults</button></p> : null;
  if (locked) return <p className="rounded-lg border border-amber-400/40 bg-amber-400/5 px-3 py-2.5 text-[13px] text-amber-100" role="note">The theme is locked: this site is running its own code (Code Update). {cur ? <>It stays on <b>{themeCode(cur)} · {cur.name}</b>. </> : null}{site ? "Code Update has to be switched off before the theme can be changed." : "Switch off “Use this code on the site” under Code Update to change the theme."}</p>;
  if (!site) return <>{reset}{fromRef}<ThemeDrawer label={`Show ${all.length} themes`} summary={<>Current: <b className="text-ink-100">{cur ? `${themeCode(cur)} · ${cur.name}` : "the template's own look"}</b> · {all.length} themes to choose from</>}><ThemeGallery dense current={root.theme?.preset} themes={tpl.themes} tags={tpl.themeTags} onPick={pick} /></ThemeDrawer></>;
  const { mode, themes } = adminThemeChoice(root, all);
  const drawer = (list: Theme[], tags: string[]) => {
    const gallery = <ThemeGallery dense current={root.theme?.preset} themes={list} tags={tags} onPick={pick} />;
    return list.length > 5 ? <ThemeDrawer label={`Show ${list.length} themes`} summary={<>Current: <b className="text-ink-100">{cur ? `${themeCode(cur)} · ${cur.name}` : "the site's own design"}</b> · {list.length} themes to choose from</>}>{gallery}</ThemeDrawer> : gallery;
  };
  if (mode === "all") return <>{reset}<p className="text-[13px] text-ink-300">Picking a theme restyles the whole site; your content stays as it is.</p>{fromRef}{drawer(all, tpl.themeTags || [])}</>;
  if (themes.length <= 1) {
    const t = themes[0];
    return (
      <div className="flex flex-col gap-3">
        <p className="text-[13px] text-ink-300">{t ? <>This site uses the theme <b className="text-ink-100">{themeCode(t)} · {t.name}</b>, set by the site's designer. You can still change colours, fonts and the settings below.</> : "This site uses its own design, set by the site's designer. You can still change colours, fonts and the settings below."}</p>
        {t && <div className="w-48 overflow-hidden rounded-xl border border-ink-600" aria-label="Current theme"><ThemeSwatch t={t} /><span className="block bg-ink-950 px-2.5 py-2 text-[13px]"><span className="block font-mono text-[11px] text-ink-400">{themeCode(t)}</span><b>{t.name}</b></span></div>}
      </div>
    );
  }
  return <>{reset}<p className="text-[13px] text-ink-300">{themes.length} themes chosen for this site. Picking one restyles the whole site; your content stays as it is.</p>{drawer(themes, [])}</>;
}

function AdminThemesField() {
  const { tpl, root, bump } = useCtx();
  const toast = useToast();
  const all = limitThemes(tpl.themes || THEMES, root?.theme?.preset, tpl.id);
  root.cms = root.cms || {};
  const cfg = root.cms.themes || {};
  const mode: "current" | "some" | "all" = cfg.mode === "all" || cfg.mode === "some" ? cfg.mode : "current";
  const list: string[] = Array.isArray(cfg.list) ? cfg.list : [];
  const cur = all.find((t) => t.id === root.theme?.preset);
  const set = (o: any) => { root.cms.themes = { mode, list, ...o }; bump(); };
  const opts: [typeof mode, string, string][] = [
    ["current", "Only the current theme", cur ? `${themeCode(cur)} · ${cur.name}. The admin can still change colours, fonts and layout settings.` : "The template's own look. The admin can still change colours, fonts and layout settings."],
    ["some", "Themes I choose", "Pick a shortlist below. The current theme is always included."],
    ["all", `All ${all.length} themes`, "The admin can switch to any theme."],
  ];
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-ink-300">Which themes the site's own admin page shows under Theme. This setting is only in the Studio; it takes effect when you publish.</p>
      <div role="radiogroup" aria-label="Themes in the admin page" className="flex flex-col gap-2">
        {opts.map(([v, label, hint]) => (
          <label key={v} className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 ${mode === v ? "border-brand-500 bg-brand-500/10" : "border-ink-600 hover:border-ink-400"}`}>
            <input type="radio" name="admin-themes" className="mt-1 accent-brand-400" checked={mode === v} onChange={() => set({ mode: v, ...(v === "some" && cur && !list.includes(cur.id) ? { list: [...list, cur.id] } : {}) })} />
            <span><b className="block text-sm">{label}</b><span className="block text-[12.5px] text-ink-400">{hint}</span></span>
          </label>
        ))}
      </div>
      {mode === "some" && (
        <div className="flex flex-col gap-2">
          <p className="text-[13px] text-ink-300"><b className="text-ink-100">{new Set([...list, ...(cur ? [cur.id] : [])]).size}</b> shown in the admin page{list.length ? "" : " (tick themes below)"}.{list.length > 0 && <> <button type="button" className="text-brand-300 underline" onClick={() => set({ list: [] })}>Clear</button></>}</p>
          <ThemeDrawer label="Choose themes" summary={<>{(() => { const ids = [...new Set([...(cur ? [cur.id] : []), ...list])]; const names = ids.map((id) => all.find((t) => t.id === id)).filter(Boolean).map((t) => themeCode(t!)); return names.length ? <>Shown: <b className="text-ink-100">{names.slice(0, 8).join(", ")}{names.length > 8 ? ` +${names.length - 8}` : ""}</b></> : "None chosen yet"; })()}</>}>
          <ThemeGallery dense chosen={[...list, ...(cur && !list.includes(cur.id) ? [cur.id] : [])]} themes={all} tags={tpl.themeTags} onPick={(t) => { if (t.id === cur?.id) return toast("The current theme is always shown. Pick another theme under Theme & layout first to remove it."); set({ list: list.includes(t.id) ? list.filter((x) => x !== t.id) : [...list, t.id] }); }} />
          </ThemeDrawer>
        </div>
      )}
    </div>
  );
}

/** Switches theme, remembering the one being left: its settings as you changed them come back when you return to it. */
export function applyTheme(root: any, tpl: TemplateDef, th: Theme) {
  root.theme = root.theme || {};
  const prevId = root.theme.preset, all = tpl.themes || THEMES, prev = all.find((t) => t.id === prevId);
  root.themeMemory = root.themeMemory && typeof root.themeMemory === "object" ? root.themeMemory : {};
  if (prev && prev.id !== th.id) {
    // Only the settings a theme controls, and only when they differ from that theme's own defaults.
    const def = tpl.themeValues(prev), snap: Record<string, unknown> = {};
    for (const k of Object.keys(def)) if (root.theme[k] !== undefined) snap[k] = clone(root.theme[k]);
    if (themeTweaked(root, tpl, prev)) root.themeMemory[prev.id] = snap; else delete root.themeMemory[prev.id];
  }
  Object.assign(root.theme, tpl.themeValues(th), root.themeMemory[th.id] || {});
  root.theme.preset = th.id;
  delete root.themeMemory[th.id]; // the current theme's settings live in content.theme
  if (!Object.keys(root.themeMemory).length) delete root.themeMemory;
}
/** True when the content's settings differ from this theme's defaults. */
export function themeTweaked(root: any, tpl: TemplateDef, th: Theme): boolean {
  const def = tpl.themeValues(th);
  return Object.entries(def).some(([k, v]) => JSON.stringify(root.theme?.[k] ?? null) !== JSON.stringify(v ?? null));
}

/** "Fill from a PDF": reads the PDF's text into a long text box (replace, or add at the end when there's text). */
function PdfFill({ id, has, onText }: { id: string; has: boolean; onText: (r: { title: string; text: string }, mode: "replace" | "add") => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const mode = useRef<"replace" | "add">("replace");
  const pick = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const r = await pdfToText(file);
      onText(r, mode.current);
      toast(`Text from ${file.name} added. Check the headings and lists, then save.`);
    } catch (e: any) { toast(e?.message || "Couldn't read that PDF.", "bad"); }
    setBusy(false);
  };
  const open = (m: "replace" | "add") => { mode.current = m; document.getElementById(id + "-pdf")?.click(); };
  return (
    <div className="mb-1.5 flex flex-wrap items-center gap-2">
      <input id={id + "-pdf"} type="file" accept="application/pdf,.pdf" className="sr-only" aria-label="PDF to read" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; pick(f); }} />
      <button type="button" className="btn btn-sm" disabled={busy} onClick={() => open("replace")}>{busy ? "Reading the PDF…" : has ? "Replace with a PDF" : "Fill from a PDF"}</button>
      {has && !busy && <button type="button" className="btn btn-sm" onClick={() => open("add")}>Add a PDF at the end</button>}
      <span className="hint">Copies the PDF's text here, with its headings and lists. Scanned PDFs have no text to copy.</span>
    </div>
  );
}

/** Buttons over a reading-page text box: they add the marks src/fx/pages.js understands around the selected words
 *  (bold, highlight, colour…), at the start of the selected lines (headings, lists, quote…), or insert a table. */

/** Legal & privacy → Legal pages: writes the privacy policy and the terms from the business's details, as custom pages. */
function LegalPagesField() {
  const { tpl, root, bump } = useCtx();
  const [ask, setAsk] = useState<"" | LegalKind>("");
  const F = collects(tpl.id, root), I = identity(root);
  const row = (kind: LegalKind, need: boolean, why: string) => {
    const p = legalPage(root, kind), ours = !!p && p.id === LEGAL_PAGES[kind].id, name = LEGAL_PAGES[kind].title;
    const make = () => { makeLegalPage(tpl.id, root, kind, staticPageDefault); setAsk(""); bump(); };
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-ink-700 p-3" aria-label={name}>
        <div className="flex flex-wrap items-center justify-between gap-2"><b className="text-[14px]">{name}</b>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${p ? "bg-emerald-400/15 text-emerald-200" : need ? "bg-red-400/15 text-red-200" : "bg-ink-700 text-ink-300"}`}>{p ? (p.external ? "Linked" : ours ? "Written here" : "Your own page") : need ? "Missing: required" : "Not made"}</span></div>
        <p className="text-[13px] text-ink-300">{p ? (p.external ? "The consent banner links to a privacy policy at another address." : ours ? `On the site as “${p.title}”, linked at the bottom of every page. Edit its text under Custom pages; “Write it again” replaces the text with a fresh one from your details.` : `Your page “${p.title}” is used.`) : why}</p>
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          {ask === kind ? <><span className="text-ink-200">Replace the page's text with a fresh one from your details? Changes you made to it are lost.</span><button type="button" className="btn btn-sm" onClick={make}>Yes, write it again</button><button type="button" className="btn btn-sm" onClick={() => setAsk("")}>Keep it</button></>
            : !p ? <button type="button" className="btn btn-sm btn-pri" onClick={make}>Write the {name.toLowerCase()} from my details</button>
            : ours ? <button type="button" className="btn btn-sm" onClick={() => setAsk(kind)}>Write it again</button> : null}
        </div>
      </div>
    );
  };
  return (
    <div className="flex flex-col gap-3" aria-label="Legal pages">
      <p className="rounded-lg border border-amber-400/40 bg-amber-400/5 px-3 py-2.5 text-[13px] text-amber-100">These pages are written from what you entered: {I.name || "no name yet"}{I.address ? ", " + I.address.split("\n")[0] : ""}{I.email ? ", " + I.email : ""}. They are a sound starting point, not legal advice: read them, change what does not fit your business, and have them checked if you can.</p>
      {row("privacy", F.form || F.checkout || F.accounts, F.form || F.checkout || F.accounts ? "This site collects personal details, so it needs a privacy policy before it is published." : "Not required for this site yet: it has no form or checkout.")}
      {row("terms", F.checkout, F.checkout ? "This site takes orders, so it needs terms before it is published." : "Recommended. Required once the site takes orders.")}
    </div>
  );
}
type A11yIssue = { kind: string; text: string; where: string };
/** Legal & privacy → Accessibility check: asks the preview to look at the page it shows. */
function A11yCheckField() {
  const { root } = useCtx();
  const [busy, setBusy] = useState(false), [res, setRes] = useState<{ page: string; issues: A11yIssue[]; seen: number } | null>(null), [err, setErr] = useState("");
  const run = () => {
    setBusy(true); setErr("");
    const fr = document.querySelector<HTMLIFrameElement>('iframe[name="cms-preview"]'), w = fr?.contentWindow;
    if (!w) { setErr("Open the preview first: the check looks at the page shown there."); setBusy(false); return; }
    const done = () => { window.clearTimeout(tm); removeEventListener("message", on); setBusy(false); };
    const on = (e: MessageEvent) => { if (e.source !== w || e.origin !== location.origin || e.data?.type !== "cms:a11y") return; done(); setRes({ page: String(e.data.page || ""), issues: Array.isArray(e.data.issues) ? e.data.issues : [], seen: Number(e.data.seen) || 0 }); };
    const tm = window.setTimeout(() => { done(); setErr("The preview did not answer. If this site runs an older build, update the site first."); }, 5000);
    addEventListener("message", on); w.postMessage({ type: "cms:a11y" }, location.origin);
  };
  const fromSettings = a11yChecks(root);
  return (
    <div className="flex flex-col gap-3" aria-label="Accessibility check">
      <p className="text-[13px] text-ink-300">Checks the page shown in the preview the way a visitor gets it: text that is hard to read on its background, pictures without a description, buttons and links without a name, form boxes without a label, and the order of headings. Open each page in the preview and check it before you publish.</p>
      {fromSettings.length > 0 && <ul className="list-disc rounded-lg border border-amber-400/40 bg-amber-400/5 py-2.5 pl-8 pr-3 text-[13px] text-amber-100">{fromSettings.map((x) => <li key={x}>{x.replace(/^Accessibility: /, "")}</li>)}</ul>}
      <div className="flex flex-wrap items-center gap-2"><button type="button" className="btn btn-sm btn-pri" disabled={busy} onClick={run}>{busy ? "Checking…" : "Check the page in the preview"}</button>{err && <span className="text-[13px] text-red-300" role="alert">{err}</span>}</div>
      {res && (res.issues.length === 0
        ? <p className="rounded-lg border border-emerald-400/30 bg-emerald-400/5 px-3 py-2.5 text-[13px] text-emerald-100" role="status">No problems found on this page ({res.seen} pieces of text and controls looked at). A check like this cannot find everything: also try the page with the keyboard only (Tab, Enter).</p>
        : <div className="rounded-lg border border-amber-400/40 bg-amber-400/5 px-3 py-2.5 text-[13px] text-amber-100" role="status"><b>{res.issues.length} thing{res.issues.length === 1 ? "" : "s"} to look at on this page:</b>
          <ul className="mt-1 list-disc pl-5">{res.issues.map((x, i) => <li key={i}>{x.text}{x.where ? <span className="text-amber-100/70"> ({x.where})</span> : null}</li>)}</ul></div>)}
    </div>
  );
}

/** The files that make up each template's own code. The portfolio keeps both in index.html (marked main-css, main-js). */
const CODE_FILES: Record<string, { css: string; js: string }> = { business: { css: "assets/biz.css", js: "assets/biz.js" }, restaurant: { css: "assets/rest.css", js: "assets/rest.js" }, events: { css: "assets/evt.css", js: "assets/evt.js" }, store: { css: "assets/store.css", js: "assets/store.js" } };
export async function templateCode(tplId: string, base: string): Promise<{ css: string; js: string }> {
  const get = async (f: string) => { const r = await fetch(base + f, { cache: "no-store" }); if (!r.ok) throw new Error(`Could not read ${f} (${r.status}).`); return r.text(); };
  const files = CODE_FILES[tplId];
  if (files) { const [css, js] = await Promise.all([get(files.css), get(files.js)]); return { css, js }; }
  const page = await get("index.html"), c = /<style id="main-css">([\s\S]*?)<\/style>/.exec(page), j = /<script id="main-js">([\s\S]*?)<\/script>/.exec(page);
  if (!c || !j) throw new Error("This site runs an older build of the template. Update the site first (Settings → Updates in the Studio), then copy its code.");
  return { css: c[1].replace(/^\n/, ""), js: j[1].replace(/^\n/, "") };
}
/** A page's markup set out one tag per line, so it can be read and edited. */
export function prettyHtml(html: string): string {
  const t = document.createElement("template"); t.innerHTML = html; const out: string[] = [], esc = document.createElement("div");
  const text = (s: string) => { esc.textContent = s; return esc.innerHTML; };
  const walk = (n: Node, d: number) => {
    const pad = "  ".repeat(Math.min(d, 14));
    if (n.nodeType === 3) { const s = (n.nodeValue || "").replace(/\s+/g, " ").trim(); if (s) out.push(pad + text(s)); return; }
    if (n.nodeType !== 1) return;
    const el = n as Element, tag = el.localName, kids = Array.from(el.childNodes).filter((c) => c.nodeType === 1 || (c.nodeType === 3 && (c.nodeValue || "").trim()));
    if (!kids.length || /^(script|style|pre|textarea|svg|math)$/.test(tag)) { out.push(pad + el.outerHTML.replace(/\s*\n\s*/g, " ")); return; }
    const open = (el.cloneNode(false) as Element).outerHTML.replace(new RegExp(`</${tag}>$`), "");
    if (kids.length === 1 && kids[0].nodeType === 3) { out.push(pad + open + text((kids[0].nodeValue || "").replace(/\s+/g, " ").trim()) + `</${tag}>`); return; }
    out.push(pad + open); kids.forEach((c) => walk(c, d + 1)); out.push(`${pad}</${tag}>`);
  };
  t.content.childNodes.forEach((c) => walk(c, 0));
  return out.join("\n");
}
/** Asks the preview for the markup of the page it shows, as the template drew it (before any of your HTML is laid over it). */
function previewHtml(): Promise<{ key: string; html: string }> {
  return new Promise((ok, no) => {
    const fr = document.querySelector<HTMLIFrameElement>('iframe[name="cms-preview"]'), w = fr?.contentWindow;
    if (!w) { no(new Error("Open the preview first: the page's HTML is copied from it.")); return; }
    const done = () => { window.clearTimeout(tm); removeEventListener("message", on); };
    const on = (e: MessageEvent) => { if (e.source !== w || e.origin !== location.origin || e.data?.type !== "cms:snap") return; done(); if (e.data.ok && e.data.html) ok({ key: String(e.data.key), html: String(e.data.html) }); else no(new Error("The preview has not drawn this page yet. Wait a moment and try again.")); };
    const tm = window.setTimeout(() => { done(); no(new Error("The preview did not answer. If this site runs an older build, update the site first; otherwise open the preview and try again.")); }, 4000);
    addEventListener("message", on); w.postMessage({ type: "cms:snap" }, location.origin);
  });
}
/** One code box. It keeps its own text while you type and hands it on after a short pause, so a long file stays quick to edit. */
function CodeBox({ label, hint, value, onSave }: { label: string; hint: string; value: string; onSave: (v: string) => void }) {
  const [txt, setTxt] = useState(value); const t = useRef<number>(0), last = useRef(value), id = "f-code-" + label.replace(/\W/g, "").toLowerCase();
  useEffect(() => { if (value !== last.current) { last.current = value; setTxt(value); } }, [value]);
  const push = (v: string) => { window.clearTimeout(t.current); if (v !== last.current) { last.current = v; onSave(v); } };
  const edit = (v: string) => { setTxt(v); window.clearTimeout(t.current); t.current = window.setTimeout(() => push(v), 500); };
  useEffect(() => () => window.clearTimeout(t.current), []);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="flex flex-wrap items-baseline justify-between gap-2 text-[13px] font-semibold text-ink-200">{label}<span className="font-normal text-ink-400">{txt.split("\n").length.toLocaleString()} lines</span></label>
      <textarea id={id} className="input min-h-[220px] resize-y whitespace-pre font-mono text-[12.5px] leading-relaxed" rows={16} wrap="off" spellCheck={false} autoCapitalize="off" autoCorrect="off" value={txt} onBlur={() => push(txt)}
        onKeyDown={(e) => { if (e.key !== "Tab" || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return; e.preventDefault(); const el = e.currentTarget, a = el.selectionStart, b = el.selectionEnd; edit(el.value.slice(0, a) + "  " + el.value.slice(b)); requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = a + 2; }); }}
        onChange={(e) => edit(e.target.value)} />
      <p className="text-[12.5px] text-ink-400">{hint}</p>
    </div>
  );
}
function CodeTemplateField() {
  const { tpl, root, bump, site } = useCtx();
  const [busy, setBusy] = useState(false), [err, setErr] = useState(""), [ask, setAsk] = useState<"" | "delete" | "again" | "page">(""), [sel, setSel] = useState("");
  const k = root.code && typeof root.code === "object" ? root.code : null;
  const pages: Record<string, { html: string; base: string }> = k && k.pages && typeof k.pages === "object" ? k.pages : {};
  const keys = Object.keys(pages), cur = pages[sel] ? sel : keys[0] || "";
  const has = !!k && !!(String(k.js || "").trim() || String(k.css || "").trim() || keys.length), on = has && !!k.on;
  const name = (key: string) => { const f = key.split("?")[0] + ".html", p = tpl.pages.find((x) => x.file === f); return (p ? p.label : f) + (key.includes("?") ? " (" + key.split("?").slice(1).join(", ") + ")" : ""); };
  /** Copies the HTML of the page the preview shows. */
  const snap = async (code: any) => { const s = await previewHtml(), html = prettyHtml(s.html); code.pages = { ...(code.pages || {}), [s.key]: { html, base: html } }; setSel(s.key); };
  const copy = async (thenOn: boolean) => {
    setBusy(true); setErr(""); setAsk("");
    try { const c = await templateCode(tpl.id, site ? "" : `templates/${tpl.id}/`); const code: any = { on: false, css: c.css, js: c.js, pages: {} };
      try { await snap(code); } catch (e: any) { setErr((e?.message || "The page's HTML could not be copied.") + " The CSS and JavaScript were copied."); }
      code.on = thenOn; root.code = code; bump(); }
    catch (e: any) { setErr(e?.message || "Could not read the template's code."); }
    setBusy(false);
  };
  const page = async () => { setBusy(true); setErr(""); setAsk(""); try { const code = { ...(root.code || {}) }; await snap(code); root.code = code; bump(); } catch (e: any) { setErr(e?.message || "The page's HTML could not be copied."); } setBusy(false); };
  const turn = (v: boolean) => { if (busy) return; if (v && !has) { void copy(true); return; } root.code = { ...(k || {}), on: v }; setAsk(""); bump(); };
  const save = (key: "css" | "js") => (v: string) => { root.code = { ...(root.code || {}), [key]: v }; bump(); };
  const saveHtml = (v: string) => { if (!cur) return; root.code = { ...(root.code || {}), pages: { ...pages, [cur]: { ...pages[cur], html: v } } }; bump(); };
  const edited = !!cur && pages[cur].html !== pages[cur].base;
  return (
    <div className="flex flex-col gap-4" aria-label="Code Update">
      <p className="rounded-lg border border-amber-400/40 bg-amber-400/5 px-3 py-2.5 text-[13px] text-amber-100">This is a copy of the site's code: each page's finished HTML, the whole stylesheet and the whole script. Switched on, the site runs this copy in place of the template's own code, and the theme is locked. What you change in a page's HTML stays as you wrote it; the parts you leave alone keep following your content. The copy no longer follows Studio updates to the template, and a mistake in it can break the site: switch it off to go back to the template at once.</p>
      <Toggle id="f-code-on" label="Use this code on the site" checked={on} onChange={turn} />
      {busy && <p className="text-[13px] text-ink-300" role="status">Copying the code…</p>}
      {err && <p className="text-[13px] text-red-300" role="alert">{err}</p>}
      {!has && !busy && <div className="flex flex-wrap items-center gap-2 text-[13px]"><button type="button" className="btn btn-sm" onClick={() => void copy(false)}>Copy the template's code here</button><span className="text-ink-400">Nothing is copied yet. Switching it on copies the code first.</span></div>}
      {has && on && <p className="text-[13px] text-ink-300">The site is running this code. The theme cannot be changed while it is on. Switch it off to change the theme or to delete this code; the code stays saved.</p>}
      {has && !on && <div className="flex flex-col gap-2 text-[13px]">
        <p className="text-ink-300">Switched off: the site runs the template's own code. Your copy below is kept.</p>
        <div className="flex flex-wrap items-center gap-2">
          {ask === "delete" ? <><span className="text-ink-200">Delete your copy of the code? This cannot be undone.</span><button type="button" className="btn btn-sm border-red-400/50 text-red-200" onClick={() => { delete root.code; setAsk(""); bump(); }}>Yes, delete it</button><button type="button" className="btn btn-sm" onClick={() => setAsk("")}>Keep it</button></>
            : ask === "again" ? <><span className="text-ink-200">Replace your copy with the template's current code? Your changes are lost.</span><button type="button" className="btn btn-sm" onClick={() => void copy(false)}>Yes, replace it</button><button type="button" className="btn btn-sm" onClick={() => setAsk("")}>Keep mine</button></>
            : <><button type="button" className="btn btn-sm border-red-400/50 text-red-200" onClick={() => setAsk("delete")}>Delete this code</button><button type="button" className="btn btn-sm" onClick={() => setAsk("again")}>Copy the template's code again</button></>}
        </div>
      </div>}
      {has && <>
        <div className="flex flex-col gap-2 rounded-lg border border-ink-700 p-3">
          <div className="flex flex-wrap items-end gap-2 text-[13px]">
            {keys.length > 0 && <label className="flex flex-col gap-1"><span className="font-semibold text-ink-200">Page</span><select className="input py-1.5" aria-label="Page whose HTML is shown" value={cur} onChange={(e) => { setSel(e.target.value); setAsk(""); }}>{keys.map((x) => <option key={x} value={x}>{name(x)}{pages[x].html !== pages[x].base ? " (changed)" : ""}</option>)}</select></label>}
            {ask === "page" ? <><span className="text-ink-200">Copy the page in the preview again? If it is a page you changed, those changes are lost.</span><button type="button" className="btn btn-sm" onClick={() => void page()}>Yes, copy it</button><button type="button" className="btn btn-sm" onClick={() => setAsk("")}>Cancel</button></>
              : <button type="button" className="btn btn-sm" disabled={busy} onClick={() => (keys.some((x) => pages[x].html !== pages[x].base) ? setAsk("page") : void page())}>Copy the HTML of the page in the preview</button>}
            {edited && ask !== "page" && <button type="button" className="btn btn-sm" onClick={() => { root.code = { ...(root.code || {}), pages: { ...pages, [cur]: { html: pages[cur].base, base: pages[cur].base } } }; bump(); }}>Undo my changes to this page</button>}
          </div>
          <p className="text-[12.5px] text-ink-400">Each page has its own HTML. To edit another page, open it in the preview, then press “Copy the HTML of the page in the preview”.</p>
          {cur ? <CodeBox key={cur} label="HTML" value={pages[cur].html} onSave={saveHtml} hint="The finished HTML of this page: menu bar, every section, footer. Change, add, move or remove anything. Your changes show in the preview after a short pause, and stay as you wrote them even if the content changes later; the parts you did not touch keep following your content." />
            : <p className="text-[13px] text-ink-300">No page's HTML is copied yet.</p>}
        </div>
        <CodeBox label="CSS" value={String(k.css || "")} onSave={save("css")} hint="The template's whole stylesheet. A change shows in the preview after a short pause. Left empty, the template's own styles are used." />
        <CodeBox label="JavaScript" value={String(k.js || "")} onSave={save("js")} hint="The template's whole script: it draws the pages from your content and makes them work. The preview reloads after a change. If it cannot start, the template's own code is shown and the preview says why." />
      </>}
    </div>
  );
}

/** Studio only: tick the sections this site's own admin page shows. Unticked ones are listed in content.cms.hide and
 *  left out of that admin page's menu (the Studio always shows everything). */
export const ADMIN_EXTRAS: [string, string, string][] = [["enquiries", "Enquiries", "Forms & records"], ["warranty-records", "Warranty records", "Forms & records"], ["orders", "Orders", "Shop"], ["customers", "Customers", "Shop"], ["customer-data", "Customer Data", "Forms & records"]];
function AdminSectionsField() {
  const { tpl, root, bump } = useCtx();
  root.cms = root.cms || {};
  const hide: string[] = Array.isArray(root.cms.hide) ? root.cms.hide : [];
  const allow: string[] = Array.isArray(root.cms.allow) ? root.cms.allow : [];
  const rows: [string, string, string][] = [...tpl.schema.filter((c) => (!c.showIf || c.showIf(root)) && !c.siteIf).map((c) => [c.id, c.site?.label || c.label, c.site?.group || c.group] as [string, string, string]),
    ...ADMIN_EXTRAS.filter(([id]) => (id === "customer-data" ? tpl.id === "store" || tpl.id === "restaurant" : id === "orders" || id === "customers" ? tpl.id === "store" : id === "enquiries" ? tpl.id === "business" || tpl.id === "restaurant" || tpl.id === "events" : id === "warranty-records" ? tpl.id !== "portfolio" && tpl.id !== "restaurant" && tpl.id !== "events" : tpl.id !== "portfolio"))];
  const groups = [...new Set(rows.map((r) => r[2]))];
  const set = (next: string[]) => { root.cms.hide = next; bump(); };
  const toggle = (id: string) => set(hide.includes(id) ? hide.filter((x) => x !== id) : [...hide, id]);
  return (
    <div className="flex flex-col gap-3" aria-label="Features in this site's admin page">
      <p className="text-[13px] text-ink-300">Untick what this site's owner shouldn't see in their admin page. It applies to this site only, the next time you publish. The Studio keeps showing everything, and anything already set up keeps working on the site.</p>
      {groups.map((g) => (
        <fieldset key={g} className="rounded-lg border border-ink-700 p-3">
          <legend className="px-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-400">{g}</legend>
          <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
            {rows.filter((r) => r[2] === g).map(([id, label]) => <label key={id} className="flex items-center gap-2 text-[13px]"><input type="checkbox" className="accent-brand-500" checked={!hide.includes(id)} onChange={() => toggle(id)} />{label}</label>)}
          </div>
        </fieldset>
      ))}
      <fieldset className="rounded-lg border border-ink-700 p-3" aria-label="Codes this site may send">
        <legend className="px-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-400">Codes by WhatsApp and SMS</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-[13px]"><span className="font-semibold text-ink-100">Sign-in codes for this site's admin page</span>
            <select className="input py-1.5 text-[13px]" aria-label="Sign-in codes for this site's admin page" value={root.cms.msg?.login ?? "both"} onChange={(e) => { root.cms.msg = { ...(root.cms.msg || {}), login: e.target.value }; bump(); }}>
              <option value="email">Email only</option><option value="wa">Email, and WhatsApp</option><option value="sms">Email, and SMS</option><option value="both">Email, WhatsApp and SMS</option></select></label>
          <label className="flex flex-col gap-1 text-[13px]"><span className="font-semibold text-ink-100">Codes for customers at checkout</span>
            <select className="input py-1.5 text-[13px]" aria-label="Codes for customers at checkout" value={root.cms.msg?.checkout ?? "both"} onChange={(e) => { root.cms.msg = { ...(root.cms.msg || {}), checkout: e.target.value }; bump(); }}>
              <option value="none">None (no mobile verification)</option><option value="wa">WhatsApp only</option><option value="sms">SMS only</option><option value="both">WhatsApp or SMS (the customer chooses when both are set up)</option></select></label>
        </div>
        <p className="mt-2 text-[12.5px] text-ink-400">What this site's owner may switch on under WhatsApp and SMS in their admin page. A way that isn't allowed is greyed out there (the SMS card is hidden when SMS isn't allowed for anything), and the site's database refuses to send those codes. Sign-in always works by email. Email verification at checkout is a separate switch under the checkout settings. Applies the next time you publish.</p>
      </fieldset>
      <fieldset className="rounded-lg border border-ink-700 p-3" aria-label="Extras for this site's admin page">
        <legend className="px-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-400">Extras (off unless ticked)</legend>
        <label className="flex items-start gap-2 text-[13px]"><input type="checkbox" className="mt-0.5 accent-brand-500" checked={allow.includes("customEngine")} onChange={() => { root.cms.allow = allow.includes("customEngine") ? allow.filter((x) => x !== "customEngine") : [...allow, "customEngine"]; bump(); }} />
          <span>Custom engine for translations<span className="block text-ink-400">Lets this site's owner choose “Custom engine” under Languages → Translate with. Without it their admin page offers Cloudflare AI and the Picaffectz system only.</span></span></label>
        <label className="mt-2 flex items-start gap-2 text-[13px]"><input type="checkbox" className="mt-0.5 accent-brand-500" checked={allow.includes("code")} onChange={() => { root.cms.allow = allow.includes("code") ? allow.filter((x) => x !== "code") : [...allow, "code"]; bump(); }} />
          <span>Code Update<span className="block text-ink-400">Shows the “Code Update” section in this site's admin page, so its owner can edit and run their own copy of the site's code. Without it only the Studio can change that code; what is already saved keeps working either way.</span></span></label>
      </fieldset>
      <div className="flex flex-wrap items-center gap-2 text-[13px]"><button type="button" className="btn btn-sm" disabled={!hide.length} onClick={() => set([])}>Show everything</button><span className="text-ink-400">{hide.length ? `${hide.length} hidden` : "Everything is shown"}</span></div>
    </div>
  );
}
