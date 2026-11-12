import { createContext, useContext, useLayoutEffect, useRef, useState } from "react";
import { ThemeGallery } from "../themes/ThemeGallery";
import { LinkedInImport } from "./LinkedInImport";
import { Motifs } from "../themes/catalog";
import type { Field as F, TemplateDef } from "../schema/types";
import { getP, setP, clone, vpaOk, paypalOk, httpsOk, hostIs, emailOk, phoneOk } from "../lib/util";
import { Field, Toggle, useConfirm, useToast } from "../ui/kit";

export type EditorCtx = {
  tpl: TemplateDef;
  root: any;
  bump: () => void;
  upload: (file: File) => Promise<{ path: string }>;
  img: (v: any) => string;
};
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

export function FieldView({ f, obj, base }: { f: F; obj: any; base: string }) {
  const { bump, root, tpl } = useCtx();
  const id = `f-${base}-${"path" in f ? f.path : ""}`.replace(/[^\w-]/g, "_");
  const val = "path" in f ? getP(obj, f.path) : undefined;
  const set = (v: any) => {
    if ("path" in f) setP(obj, f.path, v);
    bump();
  };

  switch (f.t) {
    case "when": {
      const v = String(getP(root, f.path) ?? "");
      if (f.is !== undefined ? v !== f.is : v === f.not) return null;
      return <>{f.fields.map((x, i) => <FieldView key={i} f={x} obj={obj} base={base} />)}</>;
    }
    case "grid":
      return (
        <div className={`grid gap-3.5 ${f.cols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          {f.fields.map((x, i) => <FieldView key={i} f={x} obj={obj} base={base} />)}
        </div>
      );
    case "note":
      return <p className={`rounded-lg border px-3 py-2.5 text-[13px] ${f.tone === "warn" ? "border-amber-400/40 bg-amber-400/5 text-amber-100" : "border-ink-700 bg-ink-850 text-ink-300"}`}>{f.text}</p>;
    case "text":
      if (f.ml) {
        return (
          <Field label={f.label} htmlFor={id} hint={f.hint || "Enter starts a new line."}>
            <GrowText id={id} value={val ?? ""} ph={f.ph} onChange={set} />
          </Field>
        );
      }
      return (
        <Field label={f.label} htmlFor={id} hint={f.show ? f.show(String(val ?? "")) : f.hint} warn={checkMsg(f.check, String(val ?? ""))}>
          <input id={id} className="input" value={val ?? ""} placeholder={f.ph} spellCheck={!f.check} onChange={(e) => set(e.target.value)} />
        </Field>
      );
    case "textarea":
      return (
        <Field label={f.label} htmlFor={id} hint={f.hint}>
          <textarea id={id} className="input min-h-[84px] resize-y leading-relaxed" rows={f.rows || 3} value={val ?? ""} onChange={(e) => set(e.target.value)} />
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
          <select id={id} className="input" value={val ?? ""} onChange={(e) => set(e.target.value)}>
            {f.options.map((o) => (typeof o === "string" ? <option key={o} value={o}>{o[0].toUpperCase() + o.slice(1)}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}
          </select>
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
      return <Toggle id={id} label={f.label} checked={!!val} onChange={set} />;
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
      return <ImageField id={id} label={f.label} hint={f.hint} value={val} onChange={set} />;
    case "images":
      return <ImagesField id={id} label={f.label} hint={f.hint} value={Array.isArray(val) ? val : []} onChange={set} />;
    case "strings":
      return <StringsField f={f} arr={Array.isArray(val) ? val : []} set={set} id={id} />;
    case "list":
      return <ListField f={f} obj={obj} base={base} />;
    case "themes":
      return (
        <ThemeGallery current={root.theme?.preset} themes={tpl.themes} tags={tpl.themeTags} onPick={(th) => { Object.assign(root.theme, tpl.themeValues(th)); bump(); }} />
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
      else if (file.size > 5 * 1024 * 1024) toast(`${file.name} is over 5 MB. Choose a smaller image.`, "bad");
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

function ImageField({ id, label, hint, value, onChange }: { id: string; label: string; hint?: string; value: any; onChange: (v: any) => void }) {
  const { img } = useCtx();
  const { busy, run } = useUpload();
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
          {value && <button type="button" className="btn btn-sm btn-danger" onClick={() => onChange(null)}>Remove</button>}
        </div>
      </div>
      <span className="hint">{hint || "JPG, PNG, WebP or SVG, up to 5 MB."}</span>
    </div>
  );
}

function ImagesField({ id, label, hint, value, onChange }: { id: string; label: string; hint?: string; value: any[]; onChange: (v: any[]) => void }) {
  const { img } = useCtx();
  const { busy, run } = useUpload();
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
      <span className="hint">{hint || "Up to 5 MB each."}</span>
    </div>
  );
}

function StringsField({ f, arr, set, id }: { f: Extract<F, { t: "strings" }>; arr: any[]; set: (v: any) => void; id: string }) {
  const upd = (i: number, v: any) => { const a = [...arr]; a[i] = v; set(a); };
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
