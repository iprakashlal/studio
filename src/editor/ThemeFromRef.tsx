// "Create a theme from a reference": upload a picture, a PDF or an HTML template, or give a link; the reference is
// measured (colours, fonts, corners, first-screen layout, interactions) and a theme for this template is built.
import { useRef, useState } from "react";
import type { TemplateDef } from "../schema/types";
import { AXES, FX_AXES, FX_KEYS } from "../themes/catalog";
import { ThemeSwatch } from "../themes/ThemeGallery";
import { lookFromDigest, lookFromHtml, lookFromImage, lookFromPdf, themeFromLook, type Look, type Made } from "../lib/themefrom";
import { cfLook, signedInApi as lookApi } from "../lib/cfdb";
import { pdfBase } from "../lib/pdftext";
import { Modal } from "../ui/kit";

const label = (axis: { options: [string, string][] }, v: string) => axis.options.find(([o]) => o === v)?.[1] || v;

export function ThemeFromRef({ tpl, onApply }: { tpl: TemplateDef; onApply: (m: Made) => void }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(""), [err, setErr] = useState("");
  const [url, setUrl] = useState(""), [made, setMade] = useState<Made | null>(null), [from, setFrom] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const build = async (what: string, get: () => Promise<Look>) => {
    setErr(""); setBusy(what); setMade(null);
    try { setMade(themeFromLook(await get(), tpl)); }
    catch (e: any) { setErr(/Unknown scope|Not found|404/i.test(e?.message || "") ? "Reading a link needs the database updated once (Settings → Hostings → Update the database). A picture, PDF or HTML file works without it." : e?.message || "Couldn't read that."); }
    setBusy("");
  };
  const onFile = (f: File | undefined) => {
    if (!f) return; setFrom(f.name);
    if (f.size > 40_000_000) return setErr("That file is over 40 MB. Use a smaller one, or a screenshot of it.");
    const pdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name), html = /html/.test(f.type) || /\.(html?|xhtml)$/i.test(f.name), css = f.type === "text/css" || /\.css$/i.test(f.name);
    if (pdf) return build("Reading the PDF's first page", () => lookFromPdf(f, pdfBase()));
    if (html || css) return build("Reading the template", async () => { const t = await f.text(); return css ? lookFromHtml("<style>" + t.replace(/<\/style/gi, "") + "</style>") : lookFromHtml(t); });
    if (f.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|avif|svg|bmp)$/i.test(f.name)) return build("Reading the picture", () => lookFromImage(f));
    setErr("Upload a picture (PNG, JPG, WebP), a PDF, or an HTML or CSS file. For a ZIP template, upload its main HTML or CSS file, or a screenshot.");
  };
  const readLink = () => {
    const u = url.trim().replace(/^(?!https?:\/\/)/i, "https://").replace(/^http:/i, "https:"); setFrom(u);
    build("Reading the page", async () => { const api = await lookApi(); if (!api) throw new Error("Reading a link is done by your Cloudflare database, and this device isn't signed in to one. Upload a screenshot or PDF of the page instead."); return lookFromDigest(await cfLook(api, u)); });
  };
  const close = () => { setOpen(false); setMade(null); setErr(""); setFrom(""); };
  const t = made?.theme, c = t?.colors;
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-ink-700 px-3 py-2.5 text-[13px]">
        <span className="min-w-0 flex-1 basis-56 text-ink-300"><b className="text-ink-100">Have a design in mind?</b> Upload a template, a picture or a PDF, or give a link, and a theme is made to match it.</span>
        <button type="button" className="btn btn-sm" onClick={() => setOpen(true)}>Create a theme from a reference</button>
      </div>
      {open && (
        <Modal title="Create a theme from a reference" onClose={close} wide
          footer={made ? <><button type="button" className="btn" onClick={() => { setMade(null); setFrom(""); }}>Try another reference</button><button type="button" className="btn btn-pri" onClick={() => { onApply(made); close(); }}>Use this theme</button></> : undefined}>
          <div className="flex flex-col gap-4 text-sm">
            {!made && <>
              <p className="text-ink-300">The reference is measured, not copied: its colours, fonts, corner size, the layout of its first screen and how it moves. A theme for this {tpl.name.toLowerCase()} site is built from that, and the interactions are chosen to suit it. Its text, pictures and logo are never taken.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-2 rounded-xl border border-ink-700 p-4">
                  <b>Upload a file</b>
                  <span className="text-[13px] text-ink-400">A screenshot or mock-up (PNG, JPG, WebP), a PDF (its first page), or an HTML or CSS template file.</span>
                  <input ref={file} type="file" className="hidden" aria-label="Reference file" accept="image/*,.pdf,.html,.htm,.css,application/pdf,text/html,text/css" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
                  <button type="button" className="btn btn-pri self-start" disabled={!!busy} onClick={() => file.current?.click()}>Choose a file</button>
                </div>
                <div className="flex flex-col gap-2 rounded-xl border border-ink-700 p-4">
                  <b>Or give a link</b>
                  <span className="text-[13px] text-ink-400">A public page. Its stylesheet is read for colours, fonts and the interaction libraries it uses.</span>
                  <input className="input" type="url" aria-label="Reference link" placeholder="https://example.com" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && url.trim() && !busy) readLink(); }} />
                  <button type="button" className="btn self-start" disabled={!!busy || !/\w\.\w/.test(url)} onClick={readLink}>Read the page</button>
                </div>
              </div>
              {busy && <p role="status" className="text-ink-300">{busy}…</p>}
              {err && <p role="alert" className="rounded-lg border border-red-400/40 bg-red-400/5 px-3 py-2 text-[13px] text-red-200">{err}</p>}
              <p className="text-[12.5px] text-ink-400">Use references you have the right to draw on. A theme carries a look (colours, type, layout), which is yours to adjust afterwards under Theme &amp; layout.</p>
            </>}
            {made && t && c && (
              <div className="flex flex-col gap-4" aria-label="Theme made from the reference">
                <p className="text-ink-300">From <b className="break-all text-ink-100">{from}</b></p>
                <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
                  <div className="overflow-hidden rounded-xl border border-ink-600"><ThemeSwatch t={t} /><span className="block bg-ink-950 px-2.5 py-2 text-[13px]"><b>{t.dark ? "Dark" : "Light"} theme</b><span className="block text-[12px] text-ink-400">built on {made.base.name}</span></span></div>
                  <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-[13px]">
                    <dt className="text-ink-400">Colours</dt>
                    <dd className="flex flex-wrap gap-1.5" aria-label="Colours">{(["bg", "surface", "text", "c1", "c2", "c3"] as const).map((k) => <span key={k} title={`${{ bg: "Background", surface: "Cards", text: "Text", c1: "Accent 1", c2: "Accent 2", c3: "Accent 3" }[k]} ${c[k]}`} className="h-7 w-7 rounded-md border border-ink-500" style={{ background: c[k] }} />)}</dd>
                    <dt className="text-ink-400">Fonts</dt><dd>{t.display} for headings, {t.body} for text</dd>
                    <dt className="text-ink-400">Corners</dt><dd>{t.radius}px</dd>
                    <dt className="text-ink-400">First screen</dt><dd>{label(AXES.layout, t.style.layout)}</dd>
                    <dt className="self-start text-ink-400">Interactions</dt>
                    <dd>{FX_KEYS.filter((k) => t.fx[k] !== "none").map((k) => `${FX_AXES[k].label}: ${label(FX_AXES[k], t.fx[k])}`).join(" · ") || "None beyond the theme's own animation"}</dd>
                  </dl>
                </div>
                <ul className="list-disc space-y-1 pl-5 text-[13px] text-ink-300">{made.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
                <p className="text-[12.5px] text-ink-400">Using it restyles the whole site and keeps your content. Everything stays editable under Theme &amp; layout, and “Reset {made.base.name} to its defaults” undoes it.</p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
