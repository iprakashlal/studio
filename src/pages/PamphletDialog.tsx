// "Fill in from a pamphlet": reads a product pamphlet (PDF or photos) and fills the business site's catalogue.
// The text is read in the browser; pages that are pictures, and the step that turns text into products, run on
// Workers AI on the Studio's Cloudflare database. Only what the pamphlet says is filled in; nothing is saved
// until the owner presses Save.
import { mergeSocial, socialFromText, type SocialItem } from "../lib/social";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "../lib/auth";
import type { ProjectMeta } from "../lib/studio";
import { cfProducts, type PamphletProduct } from "../lib/cfdb";
import { guessPics, pamphletInput, pamphletLayout, readPamphlet, type Pamphlet } from "../lib/pamphlet";
import { menuFromLayout } from "../lib/menulayout";
import { cutOut, shot, SHOT_STYLES, type ShotStyle } from "../lib/productShots";
import { clone } from "../lib/util";
import { Modal } from "../ui/kit";
import { useAiDb } from "./AiGate";
import { EnginePick } from "./AiEngine";
import { aiEngine, allowanceGone, type AiEngine } from "../lib/ai";
import { systemProducts } from "../lib/sysread";

const pdfBase = () => new URL("runtime/", location.href).href;
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function PamphletDialog({ session, project, draft, upload, onApply, onClose }: { session: Session; project: ProjectMeta; draft: any; upload: (f: File) => Promise<{ path: string }>; onApply: (c: any, n: number) => void; onClose: () => void }) {
  const db = useAiDb(session, project, "pamphlet");
  // Which engine reads the file: the Studio's choice to begin with; the Picaffectz system needs no database.
  const [eng, setEng] = useState<AiEngine>(aiEngine());
  const sys = eng === "system", canRead = sys || db.ready;
  const [bySystem, setBySystem] = useState<{ pictures: number; sure: number } | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [hint, setHint] = useState("");
  // Product photos: cut out and restyled (three looks), used as they are, the whole page, or none.
  const [photos, setPhotos] = useState<"styled" | "asis" | "page" | "none">("styled");
  const [styles, setStyles] = useState<Set<ShotStyle>>(new Set(SHOT_STYLES.map((x) => x.id)));
  const [picOf, setPicOf] = useState<number[]>([]);
  const [preview, setPreview] = useState<{ i: number; urls: string[] } | null>(null);
  const accent: string = draft?.theme?.c1 || draft?.theme?.accent || "#5B7CFF";
  const shop = project.template === "store"; // the shop keeps its products as a list with numbers for prices
  const menu = project.template === "restaurant"; // a restaurant's menu: each product is a dish, its category the menu section
  const [busy, setBusy] = useState(""), [err, setErr] = useState("");
  const [found, setFound] = useState<PamphletProduct[] | null>(null), [guessed, setGuessed] = useState(false);
  // A designed PDF menu read from where things are on its pages (lib/menulayout): what applies to the whole menu, or null when it was read another way.
  const [laid, setLaid] = useState<{ notes: string[]; photos: number } | null>(null);
  // Uploading a menu again: dishes already on the menu take the file's price and choices ("update"), or only get what they lack ("fill").
  const [again, setAgain] = useState<"update" | "fill">("fill");
  const [pick, setPick] = useState<Set<number>>(new Set());
  const doc = useRef<Pamphlet | null>(null);
  const [drag, setDrag] = useState(false);
  const social = useRef<SocialItem[]>([]); // links the database read from the pamphlet's page pictures
  const existing: any[] = menu ? (draft?.food?.categories || []).flatMap((k: any) => k?.items || []) : draft?.products?.items || [];
  const W = menu ? { one: "dish", many: "dishes", doc: "menu", where: "menu" } : { one: "product", many: "products", doc: "pamphlet", where: "catalogue" };
  // ---- a menu uploaded again: what would change for each dish already on the menu, and what the file no longer has
  const mPrice = (x: string) => { const t = String(x || "").trim(), m = t.replace(/,/g, "").match(/^\D{0,4}(\d+(?:\.\d+)?)\s*(?:\/-|only)?$/i); return m ? m[1] : t; };
  const mSizes = (p: PamphletProduct) => (/\//.test(p.price || "") && (p.specs || []).length >= 2 && p.specs.every((x) => /\d/.test(x.value)) ? p.specs.map((x) => ({ label: x.label, price: mPrice(x.value) })) : []);
  const sayPrice = (d: any) => ((d?.variants || []).length ? (d.variants as any[]).map((v) => `${v.label} ${v.price}`).join(", ") : String(d?.price || "").trim() || "no price");
  /** What the file would change on a dish that is already on the menu: "" when nothing. */
  const changeOf = (p: PamphletProduct): string => {
    if (!menu) return ""; const old = existing.find((x) => same(String(x?.name || ""), p.name)); if (!old) return "";
    const sz = mSizes(p), now = sz.length ? sz.map((v) => `${v.label} ${v.price}`).join(", ") : mPrice(p.price) || "no price", was = sayPrice(old);
    return now !== was && now !== "no price" ? `${was} → ${now}` : "";
  };
  const reup = useMemo(() => {
    if (!menu || !found) return { known: 0, changed: 0, gone: [] as string[] };
    const names = new Set(found.map((p) => p.name.trim().toLowerCase())), known = found.filter((p) => existing.some((x) => same(String(x?.name || ""), p.name)));
    return { known: known.length, changed: known.filter((p) => changeOf(p)).length, gone: existing.map((x) => String(x?.name || "").trim()).filter((n) => n && !names.has(n.toLowerCase())) };
  }, [found, draft]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (menu) setPhotos("none"); }, [menu]);
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
      setLaid(null);
      // A PDF menu with real text is read from its layout first: each photo with the name, description and price (or priced choices)
      // that stand with it. It needs no AI. When that finds too little (a scan, a plain list), the chosen reader takes over below.
      if (menu && doc.current.kind === "pdf") {
        setBusy("Reading the menu from its layout");
        let lay: ReturnType<typeof menuFromLayout> | null = null; try { lay = menuFromLayout(pamphletLayout(doc.current)); } catch { /* read the usual way */ }
        if (lay && lay.products.length >= 3) {
          social.current = []; setBySystem(null); setGuessed(false);
          setFound(lay.products); setPick(new Set(lay.products.map((_, i) => i))); setPicOf(lay.products.map((p) => p.pic));
          setAgain("update");
          const withPic = lay.products.filter((p) => p.pic >= 0).length; setPhotos(withPic ? "asis" : "none"); setLaid({ notes: lay.notes, photos: withPic });
          setBusy(""); return;
        }
      }
      const pics = doc.current.pages.filter((p) => p.image).length;
      setBusy(pics ? `Reading ${pics} page picture${pics > 1 ? "s" : ""} and finding the products` : "Finding the products");
      const inp = pamphletInput(doc.current);
      const list: Awaited<ReturnType<typeof cfProducts>> = sys ? await systemProducts(doc.current, { menu, step: setBusy }) : await cfProducts(db.api!, { ...inp, engine: eng, hint: [inp.hint, menu ? "This is a restaurant's menu. List every dish and drink as one entry: name = the dish, category = the menu section it is printed under (Starters, Mains, Desserts…), price = its price as printed, summary = its description if one is printed. Do not invent descriptions." : "", hint.trim()].filter(Boolean).join("\n") });
      social.current = list.social || [];
      setBySystem(sys ? { pictures: (list as any).pictures || 0, sure: (list as any).sure || 0 } : null);
      setAgain("fill");
      setFound(list); setGuessed(!!list.guessed); setPick(new Set(list.map((_, i) => i))); setPicOf(guessPics(list, doc.current.pics));
      if (!doc.current.pics.length && photos === "styled") setPhotos(doc.current.kind === "pdf" ? "page" : "none");
    } catch (e: any) { setErr(e?.message || "Couldn't read the pamphlet."); }
    setBusy("");
  };
  const apply = async () => {
    setErr(""); setBusy("Adding to your catalogue");
    try {
      const c = clone(draft);
      if (menu) {
        // Each dish goes under its menu section (made when it's new). A dish already on the menu only gets what it lacks.
        c.food ||= {}; const cats: any[] = Array.isArray(c.food.categories) ? c.food.categories : (c.food.categories = []);
        const price = (x: string) => { const t = String(x || "").trim(), m = t.replace(/,/g, "").match(/^\D{0,4}(\d+(?:\.\d+)?)\s*(?:\/-|only)?$/i); return m ? m[1] : t; };
        let n = 0;
        // The dish's own photo, as it is in the menu (only for a menu read from its layout, where each photo is known to be its dish's).
        const photoOf = async (i: number, p: PamphletProduct): Promise<{ path: string } | null> => {
          const pic = laid && photos === "asis" ? doc.current?.pics[picOf[i]] : null; if (!pic) return null;
          setBusy(`Adding the photo of ${p.name}`);
          try { return await upload(new File([pic.blob], `${p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "dish"}.jpg`, { type: "image/jpeg" })); } catch { return null; }
        };
        const sizesOf = (p: PamphletProduct) => (/\//.test(p.price || "") && (p.specs || []).length >= 2 && p.specs.every((x) => /\d/.test(x.value)) ? p.specs.map((x) => ({ label: x.label, price: price(x.value) })) : []);
        for (const [i, p] of (found || []).entries()) {
          if (!pick.has(i) || !p.name.trim()) continue;
          const old = cats.flatMap((k) => k.items || []).find((d: any) => same(String(d?.name || ""), p.name));
          if (old) {
            const sz = sizesOf(p);
            // "update": the file's price and choices replace the dish's (its section, photo, description, marks and "sold out" stay,
            // and so does its stock count, which is kept under the dish's section and name). "fill": only what is missing.
            if (again === "update" ? !!changeOf(p) : !String(old.price || "").trim() && !(old.variants || []).length) { if (sz.length) { old.variants = sz; old.price = ""; } else if (p.price) { old.price = price(p.price); old.variants = []; } }
            if (!String(old.desc || "").trim() && p.summary) old.desc = p.summary;
            if (!old.image) { const im = await photoOf(i, p); if (im) old.image = im; }
            n++; continue;
          }
          const name = (p.category || "").trim() || "Menu";
          let k = cats.find((x) => same(String(x?.name || ""), name)); if (!k) { k = { name, note: "", image: null, items: [] }; cats.push(k); }
          // "89 / 109 / 119" with a name for each (Oil, Butter, Cheese) becomes the dish's sizes.
          const sizes = sizesOf(p);
          (k.items ||= []).push({ name: p.name.trim(), desc: p.summary || "", price: sizes.length ? "" : price(p.price), diet: "", spice: "0", tag: "", allergens: "", image: await photoOf(i, p), variants: sizes, addons: [], soldOut: false }); n++;
        }
        const sec = (c.sections || []).find((s: any) => s.id === "food"); if (sec) sec.show = true;
        mergeSocial(c, [...socialFromText((doc.current?.pages || []).map((x) => x.text).join("\n")), ...social.current]);
        onApply(c, n); onClose(); setBusy(""); return;
      }
      if (!shop) c.products ||= {};
      const items: any[] = shop ? (Array.isArray(c.products) ? c.products : (c.products = [])) : (c.products.items ||= []);
      // Shop: a product's category is one of the shop's categories (made when it's new), its price a number.
      const slugOf = (x: string) => x.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
      const catId = (name: string) => {
        const n = name.trim(); if (!n) return "";
        const cats: any[] = Array.isArray(c.categories) ? c.categories : (c.categories = []);
        const hit = cats.find((x) => same(String(x?.name || ""), n) || x?.id === slugOf(n)); if (hit) return hit.id;
        const id = slugOf(n) || "cat-" + (cats.length + 1); cats.push({ id, name: n, description: "", image: null }); return id;
      };
      const money = (x: string) => { const m = String(x || "").replace(/,/g, "").match(/\d+(\.\d+)?/); return m ? Math.round(+m[0]) : 0; };
      const shopText = (p: PamphletProduct) => [p.details, p.specs.length ? p.specs.map((x: any) => (typeof x === "string" ? x : [x.label ?? x.name, x.value].filter(Boolean).join(": "))).join("\n") : ""].filter((x) => String(x || "").trim()).join("\n\n");
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
        if (shop) {
          if (old) {
            if (!String(old.short || "").trim() && p.summary) old.short = p.summary;
            if (!String(old.description || "").trim()) old.description = shopText(p);
            if (!Number(old.price) && money(p.price)) old.price = money(p.price);
            if (!old.category && p.category) old.category = catId(p.category);
            if (!(old.features || []).length && p.features.length) old.features = p.features;
            if (img && !(old.images || []).length) old.images = imgs;
          } else {
            let slug = slugOf(p.name) || "product", k = 2; while (items.some((x) => x?.slug === slug)) slug = `${slugOf(p.name) || "product"}-${k++}`;
            items.push({ id: "p" + Date.now().toString(36) + n, slug, name: p.name, category: catId(p.category), price: money(p.price), compareAt: 0, images: imgs, short: p.summary, description: shopText(p), features: p.features, optionName: "", options: [], stock: "in", featured: false, badge: "" });
          }
          n++; continue;
        }
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
      // Social links printed in the pamphlet go to the footer's row (a network that already has a link keeps it).
      mergeSocial(c, [...socialFromText((doc.current?.pages || []).map((x) => x.text).join("\n")), ...social.current]);
      onApply(c, n); onClose();
    } catch (e: any) { setErr(e?.message || "Couldn't add the products."); }
    setBusy("");
  };

  const footer = found
    ? <><button className="btn" onClick={() => setFound(null)}>Back</button><button className="btn btn-pri" disabled={!pick.size || !!busy} onClick={apply}>{busy ? busy + "…" : `Add ${pick.size} to the ${W.where}`}</button></>
    : <><button className="btn" onClick={onClose}>Cancel</button>{canRead && <button className="btn btn-pri" disabled={!files.length || !!busy} onClick={read}>{busy ? busy + "…" : menu ? "Read the menu" : "Read the pamphlet"}</button>}</>;

  return (
    <Modal title={menu ? "Fill in the menu from a photo or PDF" : "Fill in products from a pamphlet"} onClose={onClose} wide footer={footer}>
      <div className="flex flex-col gap-3 text-sm">
        {!found && menu && <p className="text-ink-300">Upload your menu (a PDF, a sheet, or photos of the printed menu or menu board). The Studio reads it and fills in each section and dish with its price and description. Only what the menu says is used. You review everything before it goes in, and nothing is saved until you press Save. Diet marks, spice and photos are yours to add afterwards.</p>}
        {!found && !menu && <p className="text-ink-300">Upload your product pamphlet or brochure (a PDF, or photos of its pages). The Studio reads it and fills in each product: name, category, price, short description, features, full description and specifications. Only what the pamphlet says is used. You review everything before it goes in, and nothing is saved until you press Save.</p>}
        {!found && <EnginePick label="Read with" value={eng} onChange={(e) => { setEng(e); setErr(""); }} note={sys ? (menu ? "On this device, by rules: every line with a price becomes a dish, under the heading printed above it. Photos are read here too (clear English print reads best)." : "On this device, by rules. Sheets, price lists and one-product pages read best; photos are read here too (clear English print).") : undefined} />}
        {!sys && db.ui}
        {canRead && !found && <>
          <label className={`flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed px-4 py-7 text-center ${drag ? "border-brand-400 bg-brand-500/10" : "border-ink-600"}`}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); choose(e.dataTransfer.files); }}>
            <input type="file" className="sr-only" aria-label="Pamphlet file" accept=".pdf,application/pdf,.xlsx,.csv,text/csv,image/jpeg,image/png,image/webp" multiple onChange={(e) => choose(e.target.files)} />
            <b className="text-ink-100">{files.length ? files.map((f) => f.name).join(", ") : menu ? "Choose the menu" : "Choose the pamphlet"}</b>
            <span className="text-[12.5px] text-ink-400">A PDF (up to 12 pages), an Excel (.xlsx) or CSV sheet with one product per row, or up to 8 photos of the pages. Or drop the files here.</span>
          </label>
          <label className="flex flex-col gap-1.5"><span className="label">Anything to know (optional)</span>
            <textarea className="input min-h-[60px]" placeholder={menu ? "For example: skip the drinks page. Prices are in rupees." : "For example: prices are per piece and include GST. Group the products by series."} value={hint} onChange={(e) => setHint(e.target.value)} /></label>
          {!menu && <PhotoChoice photos={photos} setPhotos={setPhotos} styles={styles} setStyles={setStyles} />}
          <p className="text-[12.5px] text-ink-400">Pages that are pictures (scans, photos) are read by Cloudflare's AI too. Clear, straight photos read best.</p>
        </>}
        {found && <>
          <p className="text-ink-300">Found {found.length} {found.length === 1 ? W.one : W.many}. Untick any you don't want. {menu ? "Dishes already on your menu" : "Products already in your catalogue"} with the same name only get what they're missing.</p>
          {bySystem && <p role="status" className="rounded-lg border border-ink-600 px-3 py-2 text-[12.5px] text-ink-300">Read on this device by the Picaffectz system{bySystem.pictures ? `, including ${bySystem.pictures} page picture${bySystem.pictures > 1 ? "s" : ""}${bySystem.sure < 70 ? " (the print was hard to read: check names and prices closely)" : ""}` : ""}. It copies what is printed and doesn't fill in what isn't there.</p>}
          {laid && <div role="status" className="flex flex-col gap-1.5 rounded-lg border border-ink-600 px-3 py-2 text-[12.5px] text-ink-300">
            <span>Read from the menu's own layout, on this device, with no AI: each photo with the name, description and price printed with it{laid.photos ? `. ${laid.photos} of ${found.length} have a photo; use ‹ › to change one` : ""}.</span>
            {!!laid.photos && <label className="flex items-center gap-2 text-ink-100"><input type="checkbox" checked={photos === "asis"} onChange={(e) => setPhotos(e.target.checked ? "asis" : "none")} /> Add each dish's photo from the menu</label>}
            {!!laid.notes.length && <span>Also printed on the menu (not added, set these yourself): {laid.notes.join(" · ")}</span>}
          </div>}
          {menu && reup.known > 0 && <fieldset className="flex flex-col gap-1.5 rounded-lg border border-ink-600 px-3 py-2 text-[12.5px] text-ink-300">
            <legend className="label px-1">Dishes already on your menu</legend>
            <span>{reup.known} of these {reup.known === 1 ? "is" : "are"} already on your menu{reup.changed ? `, and ${reup.changed} ${reup.changed === 1 ? "has" : "have"} a different price or choices in this file` : ", with the same prices"}.</span>
            <label className="flex items-center gap-2 text-ink-100"><input type="radio" name="pm-again" checked={again === "update"} onChange={() => setAgain("update")} /> Update their price and choices from this file</label>
            <label className="flex items-center gap-2 text-ink-100"><input type="radio" name="pm-again" checked={again === "fill"} onChange={() => setAgain("fill")} /> Keep them as they are (only fill in what is missing)</label>
            <span>Nothing is removed, and stock counts are kept. A dish keeps its section, photo, description and “sold out” mark.{again === "update" && reup.changed ? " A choice that is renamed starts with no stock count." : ""}</span>
            {reup.gone.length > 0 && <span>Not in this file, and left on your menu: {reup.gone.slice(0, 8).join(", ")}{reup.gone.length > 8 ? ` and ${reup.gone.length - 8} more` : ""}. Remove or mark them sold out yourself if they are no longer served.</span>}
          </fieldset>}
          {guessed && <p role="status" className="rounded-lg border border-amber-400/30 bg-amber-400/5 px-3 py-2 text-[12.5px] text-amber-100">The AI didn't return the products this time, so they were read straight from the pamphlet's text. Check the name, type and details before adding.</p>}
          {!menu && <PhotoChoice photos={photos} setPhotos={setPhotos} styles={styles} setStyles={setStyles} hasPics={!!doc.current?.pics.length} />}
          <div className="flex flex-col gap-2" aria-label={menu ? "Dishes found" : "Products found"}>
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
                    <b className="text-ink-100">{p.name}</b>{p.price && <span className="ml-2 text-ink-200">{p.price}</span>}{dup && (() => { const ch = changeOf(p); return <span className="ml-2 rounded bg-amber-400/15 px-1.5 py-0.5 text-[11.5px] text-amber-200">{ch ? (again === "update" ? `will change: ${ch}` : `already listed (file says ${ch.split(" → ")[1]})`) : "already listed, same price"}</span>; })()}
                    <span className="block text-[12.5px] text-ink-400">{[p.category, `${doc.current?.kind === "sheet" ? "row" : "page"} ${p.page}`, p.features.length && `${p.features.length} features`, p.specs.length && (menu ? `${p.specs.length} choices` : `${p.specs.length} specs`)].filter(Boolean).join(" · ")}</span>
                    {menu && p.specs.length > 0 && <span className="mt-1 flex flex-wrap gap-1.5" aria-label={`Choices of ${p.name}`}>{p.specs.map((x, k) => <span key={k} className="chip">{x.label} · {x.value}</span>)}</span>}
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
        {err && !sys && allowanceGone(err) && !found && <button type="button" className="btn btn-sm btn-pri self-start" disabled={!files.length || !!busy} onClick={() => { setEng("system"); setErr(""); }}>Use the Picaffectz system instead (no allowance)</button>}
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
