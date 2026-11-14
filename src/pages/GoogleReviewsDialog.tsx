// "Add reviews from Google": finds the business on Google Maps and puts its reviews (at or above the star rating
// you choose) into the site's testimonials, with the reviewer's name and the overall Google rating. Business and
// shop sites. Uses a Google Maps Platform key kept encrypted on this device.
import { useEffect, useState } from "react";
import type { Session } from "../lib/auth";
import type { ProjectMeta } from "../lib/studio";
import { cfGoogleReviews, googleKeyVault, type GooglePlace, type GoogleReview } from "../lib/cfdb";
import { clone } from "../lib/util";
import { Modal } from "../ui/kit";
import { useAiDb } from "./AiGate";

const STARS = [{ v: 5, label: "5 stars only" }, { v: 4, label: "4 stars and up" }, { v: 3, label: "3 stars and up" }, { v: 1, label: "Any rating" }];
const stars = (n: number) => "★".repeat(Math.round(n)) + "☆".repeat(5 - Math.round(n));

/** Where a template keeps its testimonials and its Google summary. */
function spot(template: string) {
  return template === "store" ? { list: (c: any) => (c.home ||= {}, c.home.testimonials ||= []), meta: (c: any) => c.home, item: (r: GoogleReview) => ({ quote: r.text, name: r.author, role: "Google review", rating: r.rating, source: "google" }) }
    : { list: (c: any) => (c.testimonials ||= { items: [] }, c.testimonials.items ||= []), meta: (c: any) => c.testimonials, item: (r: GoogleReview) => ({ quote: r.text, name: r.author, role: "Google review", company: "", rating: r.rating, source: "google" }) };
}

export function GoogleReviewsDialog({ session, project, draft, onApply, onClose }: { session: Session; project: ProjectMeta; draft: any; onApply: (c: any, n: number) => void; onClose: () => void }) {
  const db = useAiDb(session, project, "reviews");
  const where = spot(project.template);
  const saved = where.meta(clone(draft) || {})?.google || {};
  const [link, setLink] = useState<string>(saved.link || "");
  const [key, setKey] = useState(""), [keySaved, setKeySaved] = useState(false), [remember, setRemember] = useState(true);
  const [min, setMin] = useState<number>(saved.min || 4);
  const [mode, setMode] = useState<"add" | "replace">("add");
  const [busy, setBusy] = useState(""), [err, setErr] = useState("");
  const [res, setRes] = useState<{ place: GooglePlace; reviews: GoogleReview[] } | null>(null);
  const [pick, setPick] = useState<Set<number>>(new Set());
  useEffect(() => { googleKeyVault.load(session.token).then((v) => { if (v?.key) { setKey(v.key); setKeySaved(true); } }); }, []);

  const shown = (r: GoogleReview) => r.rating >= min;
  const find = async () => {
    setErr(""); setBusy("Finding the business on Google");
    try {
      const out = await cfGoogleReviews(db.api!, link.trim(), key.trim());
      if (remember && !keySaved) { await googleKeyVault.save({ key: key.trim() }, session.token); setKeySaved(true); }
      setRes(out); setPick(new Set(out.reviews.map((r, i) => (r.rating >= min ? i : -1)).filter((i) => i >= 0)));
    } catch (e: any) { setErr(e?.message || "Couldn't get the reviews."); }
    setBusy("");
  };
  const apply = () => {
    const c = clone(draft), list = where.list(c), meta = where.meta(c);
    const chosen = res!.reviews.filter((r, i) => pick.has(i) && shown(r));
    if (mode === "replace") list.length = 0;
    // Same reviewer and words already there: skip, so adding again doesn't make doubles.
    let n = 0;
    for (const r of chosen) if (!list.some((x: any) => x?.name === r.author && x?.quote === r.text)) { list.push(where.item(r)); n++; }
    meta.google = { link: link.trim(), url: res!.place.url, name: res!.place.name, rating: res!.place.rating, count: res!.place.count, min, at: new Date().toISOString().slice(0, 10) };
    if (project.template !== "store") { const s = (c.sections || []).find((x: any) => x.id === "testimonials"); if (s) s.show = true; }
    onApply(c, n); onClose();
  };
  const footer = res
    ? <><button className="btn" onClick={() => setRes(null)}>Back</button><button className="btn btn-pri" disabled={!pick.size && mode === "add"} onClick={apply}>{mode === "replace" ? "Replace the testimonials" : `Add ${[...pick].filter((i) => shown(res.reviews[i])).length} to testimonials`}</button></>
    : <><button className="btn" onClick={onClose}>Cancel</button>{db.ready && <button className="btn btn-pri" disabled={!link.trim() || !key.trim() || !!busy} onClick={find}>{busy ? busy + "…" : "Get the reviews"}</button>}</>;

  return (
    <Modal title="Add reviews from Google" onClose={onClose} wide footer={footer}>
      <div className="flex flex-col gap-3 text-sm">
        {!res && <p className="text-ink-300">Shows your Google reviews as testimonials, with each reviewer's name and your overall Google rating. Google gives up to 5 reviews per business (the ones it shows first), so add them again now and then to pick up newer ones.</p>}
        {db.ui}
        {db.ready && !res && <>
          <label className="flex flex-col gap-1.5"><span className="label">Google Maps link, or the business name, area and city</span>
            <input id="gr-link" className="input" placeholder="https://maps.app.goo.gl/…" value={link} onChange={(e) => setLink(e.target.value)} />
            <span className="text-[12.5px] text-ink-400">On Google Maps, open the business, press <b>Share</b> and copy the link.</span></label>
          <label className="flex flex-col gap-1.5"><span className="label">Show reviews with</span>
            <select id="gr-min" className="input" value={min} onChange={(e) => setMin(+e.target.value)}>{STARS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}</select></label>
          <label className="flex flex-col gap-1.5"><span className="label">Google Maps Platform API key</span>
            {keySaved
              ? <span className="flex items-center gap-2 text-ink-300">Saved on this device, encrypted. <button type="button" className="underline" onClick={() => { googleKeyVault.clear(); setKey(""); setKeySaved(false); }}>Use another key</button></span>
              : <input id="gr-key" className="input" type="password" autoComplete="off" placeholder="AIza…" value={key} onChange={(e) => setKey(e.target.value)} />}
            {!keySaved && <span className="text-[12.5px] text-ink-400">In Google Cloud: create a project, turn on <b>Places API (New)</b>, then <b>APIs &amp; Services → Credentials → Create credentials → API key</b>. Restrict the key to Places API (New). Google bills Places requests beyond its free monthly allowance, and this uses two requests each time. The key stays on this device and is only passed to your own database for each request.</span>}
          </label>
          {!keySaved && <label className="flex items-center gap-2"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Keep the key on this device (encrypted)</label>}
        </>}
        {res && <>
          <div className="rounded-lg border border-ink-700 p-3">
            <b className="text-ink-100">{res.place.name}</b> <span className="text-amber-300">{stars(res.place.rating)}</span> <span className="text-ink-300">{res.place.rating.toFixed(1)} · {res.place.count} reviews on Google</span>
            <span className="block text-[12.5px] text-ink-400">{res.place.address}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2"><span className="text-ink-300">Show</span><select aria-label="Minimum rating" className="input py-1" value={min} onChange={(e) => setMin(+e.target.value)}>{STARS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}</select></label>
            <label className="flex items-center gap-2"><input type="radio" name="gr-mode" checked={mode === "add"} onChange={() => setMode("add")} /> Add to the testimonials</label>
            <label className="flex items-center gap-2"><input type="radio" name="gr-mode" checked={mode === "replace"} onChange={() => setMode("replace")} /> Replace them</label>
          </div>
          {!res.reviews.length && <p className="text-ink-300">Google has no written reviews to show for this business yet.</p>}
          <div className="flex flex-col gap-2" aria-label="Google reviews">
            {res.reviews.map((r, i) => {
              const ok = shown(r);
              return (
                <label key={i} className={`flex gap-3 rounded-lg border border-ink-700 p-3 ${ok ? "" : "opacity-45"}`}>
                  <input type="checkbox" className="mt-1" disabled={!ok} checked={ok && pick.has(i)} onChange={(e) => { const n = new Set(pick); e.target.checked ? n.add(i) : n.delete(i); setPick(n); }} />
                  <span className="min-w-0"><b className="text-ink-100">{r.author}</b> <span className="text-amber-300">{stars(r.rating)}</span> <span className="text-[12px] text-ink-400">{r.when}{ok ? "" : " · below your minimum"}</span>
                    <span className="mt-1 block text-[13px] text-ink-300">{r.text.length > 320 ? r.text.slice(0, 320) + "…" : r.text}</span></span>
                </label>
              );
            })}
          </div>
          <p className="text-[12.5px] text-ink-400">The site shows each review with the reviewer's name, its stars, "Google review", and a link to your Google rating, as Google's terms ask.</p>
        </>}
        {err && <p role="alert" className="text-red-300">{err}</p>}
      </div>
    </Modal>
  );
}
