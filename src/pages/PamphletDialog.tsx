// "Fill in from a pamphlet": reads a product pamphlet (PDF or photos) and fills the business site's catalogue.
// The text is read in the browser; pages that are pictures, and the step that turns text into products, run on
// Workers AI on the Studio's Cloudflare database. Only what the pamphlet says is filled in; nothing is saved
// until the owner presses Save.
import { useRef, useState } from "react";
import type { Session } from "../lib/auth";
import type { ProjectMeta } from "../lib/studio";
import { cfProducts, type PamphletProduct } from "../lib/cfdb";
import { pamphletInput, readPamphlet, type Pamphlet } from "../lib/pamphlet";
import { clone } from "../lib/util";
import { Modal, Toggle } from "../ui/kit";
import { useAiDb } from "./AiGate";

const pdfBase = () => new URL("runtime/", location.href).href;
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function PamphletDialog({ session, project, draft, upload, onApply, onClose }: { session: Session; project: ProjectMeta; draft: any; upload: (f: File) => Promise<{ path: string }>; onApply: (c: any, n: number) => void; onClose: () => void }) {
  const db = useAiDb(session, project);
  const [files, setFiles] = useState<File[]>([]);
  const [hint, setHint] = useState("");
  const [photos, setPhotos] = useState(false);
  const [busy, setBusy] = useState(""), [err, setErr] = useState("");
  const [found, setFound] = useState<PamphletProduct[] | null>(null);
  const [pick, setPick] = useState<Set<number>>(new Set());
  const doc = useRef<Pamphlet | null>(null);
  const [drag, setDrag] = useState(false);
  const existing: any[] = draft?.products?.items || [];

  const choose = (list: FileList | File[] | null) => {
    const f = [...(list || [])]; if (!f.length) return;
    setFiles(f); setFound(null); setErr("");
    setPhotos(!f.some((x) => /\.pdf$/i.test(x.name) || x.type === "application/pdf"));
  };
  const read = async () => {
    setErr(""); setBusy("Reading the pamphlet");
    try {
      doc.current?.close(); doc.current = await readPamphlet(files, pdfBase());
      const pics = doc.current.pages.filter((p) => p.image).length;
      setBusy(pics ? `Reading ${pics} page picture${pics > 1 ? "s" : ""} and finding the products` : "Finding the products");
      const list = await cfProducts(db.api!, { ...pamphletInput(doc.current), hint: hint.trim() });
      setFound(list); setPick(new Set(list.map((_, i) => i)));
    } catch (e: any) { setErr(e?.message || "Couldn't read the pamphlet."); }
    setBusy("");
  };
  const apply = async () => {
    setErr(""); setBusy("Adding to your catalogue");
    try {
      const c = clone(draft); c.products ||= {}; const items: any[] = (c.products.items ||= []);
      const shots = new Map<number, { path: string } | null>();
      const photoFor = async (page: number) => {
        if (!photos || !doc.current) return null;
        if (!shots.has(page)) {
          setBusy(`Adding the photo from page ${page}`);
          const b = await doc.current.photo(page);
          shots.set(page, b ? await upload(new File([b], `pamphlet-page-${page}.jpg`, { type: "image/jpeg" })) : null);
        }
        return shots.get(page) || null;
      };
      let n = 0;
      for (const [i, p] of (found || []).entries()) {
        if (!pick.has(i)) continue;
        const img = await photoFor(p.page);
        const old = items.find((x) => same(String(x?.name || ""), p.name));
        if (old) {
          // Same product already listed: fill in only what it doesn't have yet.
          for (const k of ["category", "summary", "price", "details"] as const) if (!String(old[k] || "").trim() && p[k]) old[k] = p[k];
          if (!(old.features || []).length && p.features.length) old.features = p.features;
          if (!(old.specs || []).length && p.specs.length) old.specs = p.specs;
          if (img && !(old.images || []).length) old.images = [img];
        } else items.push({ name: p.name, category: p.category, badge: "", summary: p.summary, price: p.price, images: img ? [img] : [], features: p.features, details: p.details, specs: p.specs });
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
            <input type="file" className="sr-only" aria-label="Pamphlet file" accept=".pdf,application/pdf,image/jpeg,image/png,image/webp" multiple onChange={(e) => choose(e.target.files)} />
            <b className="text-ink-100">{files.length ? files.map((f) => f.name).join(", ") : "Choose the pamphlet"}</b>
            <span className="text-[12.5px] text-ink-400">PDF (up to 12 pages), or up to 8 photos of its pages. Or drop the files here.</span>
          </label>
          <label className="flex flex-col gap-1.5"><span className="label">Anything to know (optional)</span>
            <textarea className="input min-h-[60px]" placeholder="For example: prices are per piece and include GST. Group the products by series." value={hint} onChange={(e) => setHint(e.target.value)} /></label>
          <Toggle id="pm-photos" checked={photos} onChange={setPhotos} label="Use the pamphlet page as each product's photo" />
          <p className="text-[12.5px] text-ink-400">Pages that are pictures (scans, photos) are read by Cloudflare's AI too. Clear, straight photos read best.</p>
        </>}
        {found && <>
          <p className="text-ink-300">Found {found.length} product{found.length === 1 ? "" : "s"}. Untick any you don't want. Products already in your catalogue with the same name only get what they're missing.</p>
          <div className="flex flex-col gap-2" aria-label="Products found">
            {found.map((p, i) => {
              const dup = existing.some((x) => same(String(x?.name || ""), p.name));
              return (
                <label key={i} className="flex gap-3 rounded-lg border border-ink-700 p-3">
                  <input type="checkbox" className="mt-1" checked={pick.has(i)} onChange={(e) => { const n = new Set(pick); e.target.checked ? n.add(i) : n.delete(i); setPick(n); }} />
                  <span className="min-w-0 flex-1">
                    <b className="text-ink-100">{p.name}</b>{p.price && <span className="ml-2 text-ink-200">{p.price}</span>}{dup && <span className="ml-2 rounded bg-amber-400/15 px-1.5 py-0.5 text-[11.5px] text-amber-200">already listed</span>}
                    <span className="block text-[12.5px] text-ink-400">{[p.category, `page ${p.page}`, p.features.length && `${p.features.length} features`, p.specs.length && `${p.specs.length} specs`].filter(Boolean).join(" · ")}</span>
                    {p.summary && <span className="mt-1 block text-[12.5px] text-ink-300">{p.summary}</span>}
                  </span>
                </label>
              );
            })}
          </div>
        </>}
        {err && <p role="alert" className="text-red-300">{err}</p>}
      </div>
    </Modal>
  );
}
