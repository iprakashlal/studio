// "Fill in from a pamphlet": reads a product pamphlet (PDF or photos) and fills the business site's catalogue.
// The text is read in the browser; pages that are pictures, and the step that turns text into products, run on
// Workers AI on the Studio's Cloudflare database. Only what the pamphlet says is filled in; nothing is saved
// until the owner presses Save.
import { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "../lib/auth";
import type { ProjectMeta } from "../lib/studio";
import { cfProducts, type PamphletProduct } from "../lib/cfdb";
import { guessPics, pamphletInput, readPamphlet, type Pamphlet } from "../lib/pamphlet";
import { cutOut, shot, SHOT_STYLES, type ShotStyle } from "../lib/productShots";
import { clone } from "../lib/util";
import { Modal } from "../ui/kit";
import { useAiDb } from "./AiGate";

const pdfBase = () => new URL("runtime/", location.href).href;
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function PamphletDialog({ session, project, draft, upload, onApply, onClose }: { session: Session; project: ProjectMeta; draft: any; upload: (f: File) => Promise<{ path: string }>; onApply: (c: any, n: number) => void; onClose: () => void }) {
  const db = useAiDb(session, project, "pamphlet");
  const [files, setFiles] = useState<File[]>([]);
  const [hint, setHint] = useState("");
  // Product photos: cut out and restyled (three looks), used as they are, the whole page, or none.
  const [photos, setPhotos] = useState<"styled" | "asis" | "page" | "none">("styled");
  const [styles, setStyles] = useState<Set<ShotStyle>>(new Set(SHOT_STYLES.map((x) => x.id)));
  const [picOf, setPicOf] = useState<number[]>([]);
  const [preview, setPreview] = useState<{ i: number; urls: string[] } | null>(null);
  const accent: string = draft?.theme?.c1 || "#5B7CFF";
  const [busy, setBusy] = useState(""), [err, setErr] = useState("");
  const [found, setFound] = useState<PamphletProduct[] | null>(null), [guessed, setGuessed] = useState(false);
  const [pick, setPick] = useState<Set<number>>(new Set());
  const doc = useRef<Pamphlet | null>(null);
  const [drag, setDrag] = useState(false);
  const existing: any[] = draft?.products?.items || [];
  // Thumbnails of the pictures found (revoked when they change or the dialog closes).
  const picUrls = useMemo(() => (found && doc.current ? doc.current.pics.map((x) => URL.createObjectURL(x.blob)) : []), [found]);
  useEffect(() => () => picUrls.forEach((u) => URL.revokeObjectURL(u)), [picUrls]);
  const showPreview = async (i: number) => {
    if (preview?.i === i) { setPreview(null); return; }
    const pic = doc.current?.pics[picOf[i]]; if (!pic) return;
    setBusy("Making the photos");
    try { const cut = await cutOut(pic.blob); const urls: string[] = []; for (const st of SHOT_STYLES) if (styles.has(st.id)) urls.push(URL.createObjectURL(await shot(cut, st.id, accent, 600))); setPreview({ i, urls }); }
    catch (e: any) { setErr(e?.message || "Couldn't make the photos."); }
    setBusy("");
  };

  const choose = (list: FileList | File[] | null) => {
    const f = [...(list || [])]; if (!f.length) return;
    setFiles(f); setFound(null); setErr("");
  };
  const read = async () => {
    setErr(""); setBusy("Reading the pamphlet");
    try {
      doc.current?.close(); doc.current = await readPamphlet(files, pdfBase(), { find: true, step: setBusy });
      const pics = doc.current.pages.filter((p) => p.image).length;
      setBusy(pics ? `Reading ${pics} page picture${pics > 1 ? "s" : ""} and finding the products` : "Finding the products");
      const inp = pamphletInput(doc.current);
      const list = await cfProducts(db.api!, { ...inp, hint: [inp.hint, hint.trim()].filter(Boolean).join("\n") });
      setFound(list); setGuessed(!!list.guessed); setPick(new Set(list.map((_, i) => i))); setPicOf(guessPics(list, doc.current.pics));
      if (!doc.current.pics.length && photos === "styled") setPhotos(doc.current.kind === "pdf" ? "page" : "none");
    } catch (e: any) { setErr(e?.message || "Couldn't read the pamphlet."); }
    setBusy("");
  };
  const apply = async () => {
    setErr(""); setBusy("Adding to your catalogue");
    try {
      const c = clone(draft); c.products ||= {}; const items: any[] = (c.products.items ||= []);
      const pages = new Map<number, { path: string } | null>();
      const photosFor = async (i: number, p: PamphletProduct): Promise<{ path: string }[]> => {
        const d = doc.current; if (!d || photos === "none") return [];
        const base = p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "product";
        if (photos === "page") {
          if (!pages.has(p.page)) { setBusy(`Adding the picture of page ${p.page}`); const b = await d.photo(p.page); pages.set(p.page, b ? await upload(new File([b], `pamphlet-page-${p.page}.jpg`, { type: "image/jpeg" })) : null); }
          const x = pages.get(p.page); return x ? [x] : [];
        }
        const pic = d.pics[picOf[i]]; if (!pic) return [];
        if (photos === "asis") return [await upload(new File([pic.blob], `${base}.jpg`, { type: "image/jpeg" }))];
        setBusy(`Making the photos of ${p.name}`);
        const cut = await cutOut(pic.blob), out: { path: string }[] = [];
        for (const st of SHOT_STYLES) if (styles.has(st.id)) out.push(await upload(new File([await shot(cut, st.id, accent)], `${base}-${st.id}.jpg`, { type: "image/jpeg" })));
        return out;
      };
      let n = 0;
      for (const [i, p] of (found || []).entries()) {
        if (!pick.has(i)) continue;
        const imgs = await photosFor(i, p), img = imgs[0];
        const old = items.find((x) => same(String(x?.name || ""), p.name));
        if (old) {
          // Same product already listed: fill in only what it doesn't have yet.
          for (const k of ["category", "summary", "price", "details"] as const) if (!String(old[k] || "").trim() && p[k]) old[k] = p[k];
          if (!(old.features || []).length && p.features.length) old.features = p.features;
          if (!(old.specs || []).length && p.specs.length) old.specs = p.specs;
          if (img && !(old.images || []).length) old.images = imgs;
        } else items.push({ name: p.name, category: p.category, badge: "", summary: p.summary, price: p.price, images: imgs, features: p.features, details: p.details, specs: p.specs });
        n++;
      }
      // Make sure the section is on, so the products show.
      const sec = (c.sections || []).find((s: any) => s.id === "products"); if (sec) sec.show = true;
      onApply(c, n); onClose();
    } catch (e: any) { setErr(e?.message || "Couldn't add the products."); }
    setBusy("");
  };

  const footer = found
    ? <><button className="btn" onClick={() => setFound(null)}>Back</button><button className="btn btn-pri" disabled={!pick.size || !!busy} onClick={apply}>{busy ? busy + "…" : `Add ${pick.size} to the catalogue`}</button></>
    : <><button className="btn" onClick={onClose}>Cancel</button>{db.ready && <button className="btn btn-pri" disabled={!files.length || !!busy} onClick={read}>{busy ? busy + "…" : "Read the pamphlet"}</button>}</>;

  return (
    <Modal title="Fill in products from a pamphlet" onClose={onClose} wide footer={footer}>
      <div className="flex flex-col gap-3 text-sm">
        {!found && <p className="text-ink-300">Upload your product pamphlet or brochure (a PDF, or photos of its pages). The Studio reads it and fills in each product: name, category, price, short description, features, full description and specifications. Only what the pamphlet says is used. You review everything before it goes in, and nothing is saved until you press Save.</p>}
        {db.ui}
        {db.ready && !found && <>
          <label className={`flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed px-4 py-7 text-center ${drag ? "border-brand-400 bg-brand-500/10" : "border-ink-600"}`}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); choose(e.dataTransfer.files); }}>
            <input type="file" className="sr-only" aria-label="Pamphlet file" accept=".pdf,application/pdf,.xlsx,.csv,text/csv,image/jpeg,image/png,image/webp" multiple onChange={(e) => choose(e.target.files)} />
            <b className="text-ink-100">{files.length ? files.map((f) => f.name).join(", ") : "Choose the pamphlet"}</b>
            <span className="text-[12.5px] text-ink-400">A PDF (up to 12 pages), an Excel (.xlsx) or CSV sheet with one product per row, or up to 8 photos of the pages. Or drop the files here.</span>
          </label>
          <label className="flex flex-col gap-1.5"><span className="label">Anything to know (optional)</span>
            <textarea className="input min-h-[60px]" placeholder="For example: prices are per piece and include GST. Group the products by series." value={hint} onChange={(e) => setHint(e.target.value)} /></label>
          <PhotoChoice photos={photos} setPhotos={setPhotos} styles={styles} setStyles={setStyles} />
          <p className="text-[12.5px] text-ink-400">Pages that are pictures (scans, photos) are read by Cloudflare's AI too. Clear, straight photos read best.</p>
        </>}
        {found && <>
          <p className="text-ink-300">Found {found.length} product{found.length === 1 ? "" : "s"}. Untick any you don't want. Products already in your catalogue with the same name only get what they're missing.</p>
          {guessed && <p role="status" className="rounded-lg border border-amber-400/30 bg-amber-400/5 px-3 py-2 text-[12.5px] text-amber-100">The AI didn't return the products this time, so they were read straight from the pamphlet's text. Check the name, type and details before adding.</p>}
          <PhotoChoice photos={photos} setPhotos={setPhotos} styles={styles} setStyles={setStyles} hasPics={!!doc.current?.pics.length} />
          <div className="flex flex-col gap-2" aria-label="Products found">
            {found.map((p, i) => {
              const dup = existing.some((x) => same(String(x?.name || ""), p.name));
              const cycle = (d: number) => { const n = (doc.current?.pics.length || 0) + 1, cur = (picOf[i] ?? -1) + 1; const nx = [...picOf]; nx[i] = ((cur + d + n) % n) - 1; setPicOf(nx); setPreview(null); };
              return (
                <div key={i} className="flex gap-3 rounded-lg border border-ink-700 p-3">
                  <input type="checkbox" className="mt-1" aria-label={`Add ${p.name}`} checked={pick.has(i)} onChange={(e) => { const n = new Set(pick); e.target.checked ? n.add(i) : n.delete(i); setPick(n); }} />
                  {(photos === "styled" || photos === "asis") && !!picUrls.length && (
                    <div className="flex flex-none flex-col items-center gap-1" aria-label={`Photo for ${p.name}`}>
                      <div className="grid h-[72px] w-[72px] place-items-center overflow-hidden rounded-md border border-ink-700 bg-white">{picOf[i] >= 0 ? <img src={picUrls[picOf[i]]} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-[11px] text-ink-500">No photo</span>}</div>
                      <div className="flex gap-1"><button type="button" className="btn btn-sm px-2 py-0.5" aria-label="Previous photo" onClick={() => cycle(-1)}>‹</button><button type="button" className="btn btn-sm px-2 py-0.5" aria-label="Next photo" onClick={() => cycle(1)}>›</button></div>
                    </div>
                  )}
                  <span className="min-w-0 flex-1">
                    <b className="text-ink-100">{p.name}</b>{p.price && <span className="ml-2 text-ink-200">{p.price}</span>}{dup && <span className="ml-2 rounded bg-amber-400/15 px-1.5 py-0.5 text-[11.5px] text-amber-200">already listed</span>}
                    <span className="block text-[12.5px] text-ink-400">{[p.category, `${doc.current?.kind === "sheet" ? "row" : "page"} ${p.page}`, p.features.length && `${p.features.length} features`, p.specs.length && `${p.specs.length} specs`].filter(Boolean).join(" · ")}</span>
                    {p.summary && <span className="mt-1 block text-[12.5px] text-ink-300">{p.summary}</span>}
                    {photos === "styled" && picOf[i] >= 0 && <button type="button" className="mt-1.5 text-[12.5px] text-brand-300 underline" onClick={() => showPreview(i)}>{preview?.i === i ? "Hide the photos" : "See the photos"}</button>}
                    {preview?.i === i && <span className="mt-2 flex flex-wrap gap-2" aria-label={`Photos of ${p.name}`}>{preview.urls.map((u, k) => <img key={k} src={u} alt="" className="h-28 w-28 rounded-md border border-ink-700 object-cover" />)}</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </>}
        {err && <p role="alert" className="text-red-300">{err}</p>}
      </div>
    </Modal>
  );
}

/** How products get their photos. */
function PhotoChoice({ photos, setPhotos, styles, setStyles, hasPics = true }: { photos: string; setPhotos: (v: any) => void; styles: Set<ShotStyle>; setStyles: (s: Set<ShotStyle>) => void; hasPics?: boolean }) {
  const opts: [string, string][] = [["styled", "Cut out each product and make studio photos"], ["asis", "Use the product pictures as they are"], ["page", "Use the whole page"], ["none", "No photos"]];
  return (
    <fieldset className="flex flex-col gap-2 rounded-lg border border-ink-700 p-3">
      <legend className="label px-1">Product photos</legend>
      {opts.map(([v, l]) => <label key={v} className={`flex items-center gap-2 ${!hasPics && (v === "styled" || v === "asis") ? "opacity-50" : ""}`}><input type="radio" name="pm-photos" disabled={!hasPics && (v === "styled" || v === "asis")} checked={photos === v} onChange={() => setPhotos(v)} /> {l}</label>)}
      {photos === "styled" && <div className="ml-6 flex flex-wrap gap-3" aria-label="Photo looks">
        {SHOT_STYLES.map((st) => <label key={st.id} className="flex items-center gap-1.5"><input type="checkbox" checked={styles.has(st.id)} onChange={(e) => { const n = new Set(styles); e.target.checked ? n.add(st.id) : n.delete(st.id); if (n.size) setStyles(n); }} /> {st.label}</label>)}
      </div>}
      <p className="text-[12.5px] text-ink-400">{photos === "styled" ? "Each product's photo is found in the pamphlet or sheet (also inside a designed page, like a brochure image), cut out from its background, and placed in the looks you tick: one photo for each, shown on the product page. The product itself isn't redrawn. If a product can't be separated from its background, its picture is placed whole, framed." : !hasPics ? "No separate product pictures were found in this file." : "The pictures are taken from the pamphlet or sheet."}</p>
    </fieldset>
  );
}
