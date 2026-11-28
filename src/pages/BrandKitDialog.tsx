// Brand kit: a visiting card, a QR standee, a pamphlet and festival posts drawn from the project's theme, logo and
// details. Everything is editable here first; each piece downloads as PNG (print-ready) or SVG, or all in one ZIP.
import { useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import type { ProjectMeta } from "../lib/studio";
import { siteAddress } from "../lib/hosting";
import { FESTIVALS } from "../lib/festivals";
import { embedFonts, makeKit, pieceToPng, upcomingFestivals, type KitInfo, type Piece } from "../lib/brandkit";
import { Modal, useToast } from "../ui/kit";

const one = (s: unknown) => String(s ?? "").replace(/[*_=~]+/g, "").replace(/\s*\n\s*/g, " ").trim();
/** What the kit starts from, read from the project's content (each template keeps these in its own places). */
function infoFrom(project: ProjectMeta, c: any, logo: string, fontCss: string): KitInfo {
  const B = c?.brand || {}, K = c?.contact || {}, T = c?.theme || {}, tpl = project.template;
  const name = one(B.name || B.logoText || [c?.hero?.firstName, c?.hero?.lastName].filter(Boolean).join(" ") || project.name);
  const site = project.host ? siteAddress(project.host) : project.publish ? `https://${project.publish.owner}.github.io/${project.publish.repo}/` : "";
  const list: any[] = tpl === "restaurant" ? (c?.food?.categories || []).map((k: any) => ({ ...k, title: k?.name })) : tpl === "business" || tpl === "events" ? c?.services?.items || [] : tpl === "store" ? c?.categories || [] : c?.work?.items || c?.projects?.items || [];
  const points = list.slice(0, 4).map((x) => ({ title: one(x?.title || x?.name), text: one(x?.body || x?.text || x?.desc || x?.description || x?.summary || "") })).filter((p) => p.title);
  return {
    name, tagline: one(B.tagline || c?.hero?.eyebrow || ""), person: tpl === "portfolio" ? name : "", role: tpl === "portfolio" ? one(c?.hero?.eyebrow || "") : "",
    phone: one(K.phone || K.whatsapp || ""), email: one(K.email || ""), address: String(K.address || "").trim(), site,
    qr: site || "https://", qrLabel: tpl === "store" ? "Scan to shop" : tpl === "portfolio" ? "Scan to see my work" : "Scan to visit us",
    points, headline: one(c?.hero?.title || c?.home?.hero?.title || B.tagline || c?.hero?.role || name), offer: tpl === "store" && B.showAnnouncement !== false ? one(B.announcement || "") : "",
    logo, fontCss,
    colors: { bg: T.bg || "#ffffff", surface: T.surface || "#f4f5f7", text: T.text || "#14171c", soft: T.soft || "#5b6472", line: T.line || "#d9dde3", c1: T.c1 || T.accent || "#3b5bdb", c2: T.c2 || T.sale || T.accent2 || "#ff6a3d", c3: T.c3 || T.accent2 || "#ffc83a", deep: T.deep || "#10141c" },
    display: T.fontDisplay || "Inter", body: T.fontBody || "Inter", radius: +T.radius || 12,
  };
}
async function dataUrl(url: string): Promise<string> {
  if (!url) return ""; if (url.startsWith("data:")) return url;
  try { const b = await (await fetch(url)).blob(); return await new Promise<string>((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => ok(""); r.readAsDataURL(b); }); } catch { return ""; }
}
const save = (blob: Blob, name: string) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "brand";

export function BrandKitDialog({ project, draft, img, onClose }: { project: ProjectMeta; draft: any; img: (v: any) => string; onClose: () => void }) {
  const toast = useToast();
  const [info, setInfo] = useState<KitInfo | null>(null), [fest, setFest] = useState<string[]>(() => upcomingFestivals(3).map((f) => f.id));
  const [busy, setBusy] = useState(""), [tab, setTab] = useState("Visiting card");
  useEffect(() => {
    let on = true;
    (async () => {
      const B = draft?.brand || {}, pic = B.logo || B.icon, src = pic?.path ? img(pic) : /^(https?:|data:)/.test(pic?.url || "") ? pic.url : "";
      const [logo, fontCss] = await Promise.all([dataUrl(src), embedFonts([draft?.theme?.fontDisplay, draft?.theme?.fontBody])]);
      if (on) setInfo(infoFrom(project, draft, logo, fontCss));
    })();
    return () => { on = false; };
  }, []);
  const pieces = useMemo(() => (info ? makeKit(info, fest.map((id) => FESTIVALS.find((f) => f.id === id)!).filter(Boolean)) : []), [info, fest]);
  const groups = [...new Set(pieces.map((p) => p.group))], file = (p: Piece, ext: string) => `${slug(info?.name || "brand")}-${p.id}.${ext}`;
  const set = (k: keyof KitInfo) => (e: { target: { value: string } }) => setInfo((x) => (x ? { ...x, [k]: e.target.value } : x));
  const png = async (p: Piece) => { setBusy(p.id); try { save(await pieceToPng(p), file(p, "png")); } catch (e: any) { toast(e?.message || "Couldn't save it.", "bad"); } setBusy(""); };
  const all = async () => {
    setBusy("zip");
    try {
      const zip = new JSZip();
      for (const p of pieces) { zip.file(`png/${file(p, "png")}`, await pieceToPng(p)); zip.file(`svg/${file(p, "svg")}`, p.svg); }
      zip.file("READ-ME.txt", `Brand kit for ${info?.name}\n\npng/  ready to print or post\nsvg/  the same pieces as vector files, for a printer or designer\n\nVisiting card: 3.5 x 2 in (1050 x 600 px at 300 dpi). Ask the printer to add bleed if they need it.\nQR standee and pamphlet: A5 (148 x 210 mm).\nFestival posts: 1080 x 1080 px, for Instagram, WhatsApp status and Facebook.\n`);
      save(await zip.generateAsync({ type: "blob" }), `${slug(info?.name || "brand")}-brand-kit.zip`);
    } catch (e: any) { toast(e?.message || "Couldn't make the ZIP.", "bad"); }
    setBusy("");
  };
  const field = (k: keyof KitInfo, label: string, ph = "") => <label className="flex flex-col gap-1"><span className="label">{label}</span><input className="input py-1.5" aria-label={label} value={String(info?.[k] ?? "")} placeholder={ph} onChange={set(k)} /></label>;
  return (
    <Modal title="Brand kit" onClose={onClose} desk footer={<button type="button" className="btn btn-pri" disabled={!info || !!busy} onClick={all}>{busy === "zip" ? "Making the ZIP…" : `Download everything (ZIP, ${pieces.length} pieces)`}</button>}>
      {!info ? <p className="text-sm text-ink-300">Drawing the kit from your theme and logo…</p> : (
        <div className="grid gap-6 text-sm lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="flex flex-col gap-3 lg:sticky lg:top-0 lg:max-h-[calc(100vh-220px)] lg:self-start lg:overflow-auto lg:pr-1 scroll-thin" aria-label="Brand kit details">
            <p className="text-[13px] text-ink-300">Made from this project's colours, fonts and logo. Change any detail and every piece redraws. Nothing here changes the site.</p>
            {field("name", "Business name")}{field("tagline", "Tagline")}
            <div className="grid grid-cols-2 gap-2">{field("person", "Person on the card", "optional")}{field("role", "Their role", "optional")}</div>
            <div className="grid grid-cols-2 gap-2">{field("phone", "Phone")}{field("email", "Email")}</div>
            <label className="flex flex-col gap-1"><span className="label">Address</span><textarea className="input py-1.5" rows={2} aria-label="Address" value={info.address} onChange={set("address")} /></label>
            {field("site", "Website")}
            <div className="grid grid-cols-2 gap-2">{field("qr", "QR code opens", "a link, or upi://pay?pa=…")}{field("qrLabel", "Words beside the QR")}</div>
            {field("headline", "Pamphlet headline")}{field("offer", "Pamphlet offer line", "optional")}
            <div className="flex flex-col gap-1.5"><span className="label">Festival posts</span>
              <div className="flex max-h-40 flex-col gap-1 overflow-auto rounded-lg border border-ink-700 p-2" aria-label="Festivals">
                {[...upcomingFestivals(FESTIVALS.length)].map((f) => <label key={f.id} className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={fest.includes(f.id)} onChange={(e) => setFest((l) => (e.target.checked ? [...l, f.id] : l.filter((x) => x !== f.id)))} />{f.name}</label>)}
              </div>
              <span className="text-[12.5px] text-ink-400">Listed with the next festival first.</span>
            </div>
            {!info.logo && <p className="rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-[13px] text-ink-300">No logo uploaded yet, so the pieces use your initials. Add one under Brand &amp; theme and open this again.</p>}
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Pieces">{groups.map((g) => <button key={g} type="button" role="tab" aria-selected={tab === g} className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold ${tab === g ? "border-brand-400 bg-brand-500/15 text-ink-100" : "border-ink-600 text-ink-300"}`} onClick={() => setTab(g)}>{g}</button>)}</div>
            <div className={`grid gap-5 ${tab === "Festival posts" ? "sm:grid-cols-2 2xl:grid-cols-3" : tab === "Visiting card" ? "sm:grid-cols-2" : "sm:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]"}`}>
              {pieces.filter((p) => p.group === tab).map((p) => (
                <figure key={p.id} className="flex flex-col gap-2" aria-label={p.name}>
                  <div className="overflow-hidden rounded-xl border border-ink-600 bg-ink-950 [&>svg]:block [&>svg]:h-auto [&>svg]:w-full" style={tab === "Visiting card" || tab === "Festival posts" ? undefined : { maxWidth: 440 }} dangerouslySetInnerHTML={{ __html: p.svg }} />
                  <figcaption className="flex flex-wrap items-center gap-2 text-[13px]"><b className="mr-auto">{p.name} <span className="font-normal text-ink-400">· {p.size}</span></b>
                    <button type="button" className="btn btn-sm" disabled={!!busy} onClick={() => png(p)}>{busy === p.id ? "Saving…" : "PNG"}</button>
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => save(new Blob([p.svg], { type: "image/svg+xml" }), file(p, "svg"))}>SVG</button></figcaption>
                </figure>
              ))}
              {tab === "Festival posts" && !fest.length && <p className="text-[13px] text-ink-400">Tick a festival on the left to draw its post.</p>}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
