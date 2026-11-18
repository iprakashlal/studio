// "Write text from a site": reads a reference site (or pasted text), and Workers AI on the Studio's Cloudflare
// database writes NEW, original text for this brand about the same kind of business. The result is reviewed per
// section and put in the editor (not saved), so the owner can change it before saving and publishing.
import { useState } from "react";
import type { Session } from "../lib/auth";
import type { ProjectMeta } from "../lib/studio";
import { cfOutline, cfPicture, cfPictures, cfWrite, type Brief, type SitePicture } from "../lib/cfdb";
import { pictureSlots, placePicture } from "../lib/pictureSlots";
import { EnginePick } from "./AiEngine";
import { aiEngine, allowanceGone, type AiEngine } from "../lib/ai";
import { enoughText, systemWrite } from "../lib/syswrite";
import { applyBrief, dropFlagged, groupsOf, type Contact } from "../lib/writeMap";
import { readPamphlet } from "../lib/pamphlet";
import { Field, Modal, useToast } from "../ui/kit";
import { useAiDb } from "./AiGate";

export function WriteFromSiteDialog({ session, project, draft, upload, onApply, onClose }: { session: Session; project: ProjectMeta; draft: any; upload?: (f: File) => Promise<{ path: string }>; onApply: (c: any) => void; onClose: () => void }) {
  const kind = project.template === "store" ? "store" : project.template === "business" ? "business" : project.template === "restaurant" ? "restaurant" : "portfolio";
  const db = useAiDb(session, project), api = db.api;
  const toast = useToast();
  const [url, setUrl] = useState(""), [text, setText] = useState("");
  // Where the text comes from: a site, a PDF (a brochure or profile), or pasted text.
  const [src, setSrc] = useState<"link" | "pdf" | "text" | "none">("link");
  // Which engine writes: the Studio's choice to begin with. The Picaffectz system writes on this device.
  const [eng, setEngRaw] = useState<AiEngine>(aiEngine());
  const sys = eng === "system", canUse = sys || db.ready;
  const setEng = (e: AiEngine) => { setEngRaw(e); setErr(""); if (e === "cloudflare" && src === "none") setSrc("link"); };
  const [again, setAgain] = useState(0), [made, setMade] = useState("");
  const showText = src === "text";
  const setShowText = (v: boolean) => setSrc(v ? "text" : "link");
  const [pdf, setPdf] = useState<{ name: string; text: string } | null>(null);
  const contactOf = (c: any) => (kind === "store" ? c?.contact : c?.contact) || {};
  const [email, setEmail] = useState<string>(String(contactOf(draft).email || ""));
  const [phone, setPhone] = useState<string>(String(contactOf(draft).phone || ""));
  // Addresses found in an uploaded PDF, offered (never filled in on their own: the PDF may be another business's).
  const [found, setFound] = useState<{ emails: string[]; phones: string[] }>({ emails: [], phones: [] });
  const readPdf = async (f: File | undefined) => {
    if (!f) return; setErr(""); setBusy("Reading the PDF");
    try {
      const doc = await readPamphlet([f], new URL("runtime/", location.href).href);
      const t = doc.pages.map((p) => p.text).join("\n\n").trim(); doc.close();
      if (t.split(/\s+/).length < 40) throw new Error("That PDF has almost no text to read (its pages are pictures). Copy its text and paste it instead.");
      setPdf({ name: f.name, text: t.slice(0, 60000) });
      const emails = [...new Set((t.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g) || []).map((x) => x.toLowerCase()))].slice(0, 4);
      const phones = [...new Set((t.match(/(\+?\d[\d\s-]{8,}\d)/g) || []).map((x) => x.replace(/\s+/g, " ").trim()).filter((x) => x.replace(/\D/g, "").length >= 10))].slice(0, 3);
      setFound({ emails, phones });
    } catch (e: any) { setPdf(null); setErr(e?.message || "Couldn't read that PDF."); }
    setBusy("");
  };
  const [brandName, setBrandName] = useState(String((kind === "portfolio" ? draft?.brand?.logoText : draft?.brand?.name) || ""));
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(""), [err, setErr] = useState("");
  const [res, setRes] = useState<{ brief: Brief; flagged: string[] } | null>(null);
  const [pick, setPick] = useState<Set<string>>(new Set());
  const run = (label: string, f: () => Promise<void>) => async () => { setErr(""); setBusy(label); try { await f(); } catch (e: any) { setErr(e?.message || "Something went wrong."); if (e?.thin) setShowText(true); } setBusy(""); };
  const writeSys = async (n: number) => {
    let ref = src === "pdf" ? pdf!.text : src === "text" ? text.trim() : "";
    if (src === "link") {
      if (!db.ready || !api) throw new Error("Reading a link is done by your Cloudflare database (no AI, so it costs nothing from the allowance), and this device isn't signed in to one. Choose A PDF, Pasted text or No reference: those work on this device alone.");
      ref = await cfOutline(api, /^https?:\/\//.test(url.trim()) ? url.trim() : "https://" + url.trim());
      if (!enoughText(ref)) { const e: any = new Error("That page has almost no text to read (it may build its text with JavaScript). Paste the page's text into the box instead."); e.thin = true; throw e; }
    }
    const r = systemWrite({ brand: brandName.trim(), notes: notes.trim(), kind, text: ref, again: n });
    setMade(r.label); setRes({ brief: r.brief, flagged: [] }); setPick(new Set(groupsOf(kind, r.brief, contact()).map((g) => g.id)));
  };
  const write = run("Reading and writing", async () => {
    if (sys) return writeSys(again);
    const body = src === "pdf" ? { text: pdf!.text } : showText && text.trim() ? { text: text.trim() } : { url: url.trim() };
    const r = await cfWrite(api!, { ...body, brand: brandName.trim(), notes: notes.trim(), kind: kind === "restaurant" ? "business" : kind });
    const b = dropFlagged(r.brief, r.flagged || []);
    setRes({ brief: b, flagged: r.flagged || [] }); setPick(new Set(groupsOf(kind, b, contact()).map((g) => g.id)));
  });
  const contact = (): Contact => ({ email: email.trim(), phone: phone.trim(), brand: brandName.trim() });
  // Pictures from the reference site: only for a site the owner has the rights to (their own old site, a client's).
  const slots = pictureSlots(kind);
  const [pics, setPics] = useState<SitePicture[] | null>(null), [use, setUse] = useState<Record<string, string>>({}), [mine, setMine] = useState(false), [picErr, setPicErr] = useState("");
  const link = () => (/^https?:\/\//.test(url.trim()) ? url.trim() : "https://" + url.trim());
  const findPics = run("Looking for pictures", async () => {
    setPicErr("");
    try {
      const list = await cfPictures(api!, link()); setPics(list);
      // A first guess the owner can change: the first picture as the hero, the next as the about picture, the rest in the gallery (where there is one).
      const g: Record<string, string> = {}, many = slots.find((x) => x.many), one = slots.filter((x) => !x.many && x.id !== "logo");
      list.forEach((p, i) => { const sl = one[i] || many; if (sl && i < 14) g[p.url] = sl.id; });
      setUse(g);
    } catch (e: any) { setPicErr(e?.message || "Couldn't read the site's pictures."); }
  });
  const chosen = (pics || []).filter((p) => use[p.url]);
  const apply = async () => {
    const next = applyBrief(kind, draft, res!.brief, brandName.trim(), pick, contact());
    if (chosen.length && mine && upload) {
      setBusy("Copying pictures"); let n = 0, missed = 0;
      for (const p of chosen.slice(0, 20)) {
        try { const f = await cfPicture(api!, p.url); if (f.size > 6 * 1024 * 1024) throw new Error("big"); placePicture(kind, next, use[p.url], await upload(f), p.alt); n++; setBusy(`Copying pictures (${n} of ${chosen.length})`); } catch { missed++; }
      }
      setBusy("");
      // Said after the editor's own "new text" note, so it isn't covered by it.
      if (missed) setTimeout(() => toast(`${n} picture${n === 1 ? "" : "s"} copied. ${missed} picture${missed > 1 ? "s" : ""} couldn't be copied (the site refused, or the file was too large).`, "bad"), 600);
    }
    onApply(next); onClose();
  };

  const emailOk = !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canWrite = !!brandName.trim() && emailOk && (src === "none" ? sys : src === "pdf" ? !!pdf : showText ? sys ? enoughText(text) : text.trim().split(/\s+/).length >= 40 : /^https?:\/\/\S+\.\S+/.test(url.trim()) || /^[\w-]+(\.[\w-]+)+/.test(url.trim()));
  const groups = res ? groupsOf(kind, res.brief, contact()) : [];
  const footer = res
    ? <><button className="btn" onClick={() => setRes(null)}>Back</button>{sys && <button className="btn" disabled={!!busy} onClick={run("Writing", async () => { const n = again + 1; setAgain(n); await writeSys(n); })}>Another version</button>}<button className="btn btn-pri" disabled={!pick.size || !!busy || (chosen.length > 0 && !mine)} onClick={apply}>{busy && /Copying/.test(busy) ? busy + "…" : chosen.length && mine ? `Put in the editor with ${chosen.length} picture${chosen.length > 1 ? "s" : ""}` : "Put in the editor"}</button></>
    : <><button className="btn" onClick={onClose}>Cancel</button>{canUse && <button className="btn btn-pri" disabled={!canWrite || !!busy} onClick={write}>{busy ? busy + "…" : "Write new text"}</button>}</>;

  return (
    <Modal title="Write text from a site or PDF" onClose={onClose} wide footer={footer}>
      <div className="flex flex-col gap-3 text-sm">
        {!res && <p className="text-ink-300">Give a site in the same line of business, or a PDF such as your brochure or company profile. The Studio reads what it covers and writes <b>new text of its own</b> for your brand, section by section: nothing is copied, and anything too close to the original is left out. Testimonials, numbers, team, clients, prices and products aren't written, so fill those in yourself.</p>}
        {!res && <EnginePick label="Write with" value={eng} onChange={setEng} note={sys ? "On this device: the Studio composes the text from its own phrase bank for your kind of business and your notes. The reference only tells it what kind of business this is. No facts are invented." : undefined} />}
        {!sys && db.ui}
        {canUse && !res && <>
          <Field label="Your brand name" htmlFor="wf-brand" hint="Used in the new text and set as the site's name.">
            <input id="wf-brand" className="input" value={brandName} onChange={(e) => setBrandName(e.target.value)} />
          </Field>
          <div role="radiogroup" aria-label="Read from" className="flex flex-wrap gap-2">
            {([["link", "A website"], ["pdf", "A PDF"], ["text", "Pasted text"], ...(sys ? [["none", "No reference"]] : [])] as [typeof src, string][]).map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={src === v} className={`btn btn-sm ${src === v ? "btn-pri" : ""}`} onClick={() => setSrc(v)}>{l}</button>)}
          </div>
          {src === "link" && <Field label="Reference site" htmlFor="wf-url" hint="A page that shows what the business offers, for example its home or about page.">
            <input id="wf-url" className="input" placeholder="https://example.com" value={url} onChange={(e) => setUrl(e.target.value)} /></Field>}
          {src === "pdf" && <Field label="PDF" htmlFor="wf-pdf" hint={pdf ? `Read ${pdf.text.split(/\s+/).length} words from ${pdf.name}.` : "A brochure, company profile or menu, up to 12 pages."}>
            <input id="wf-pdf" className="input" type="file" accept=".pdf,application/pdf" onChange={(e) => readPdf(e.target.files?.[0])} /></Field>}
          {src === "text" && <Field label="The page's text" htmlFor="wf-text" hint={sys ? "Paste text that shows what the business does (at least 20 words). It is only read to tell the kind of business." : "Some sites can't be read from here. Copy the page's text and paste it (at least 40 words)."}>
            <textarea id="wf-text" className="input min-h-[140px]" value={text} onChange={(e) => setText(e.target.value)} /></Field>}
          {src === "none" && <p className="rounded-lg border border-ink-700 px-3 py-2 text-[13px] text-ink-300">The text is written from the site's type and what you write under About your business below. Mention what you do there (“a family restaurant in Nashik”, “a dental clinic”), and it picks the right wording.</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Contact email on the site" htmlFor="wf-email" hint={emailOk ? "Goes in the contact section and footer. Use your own address." : "That doesn't look like an email address."}>
              <input id="wf-email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            {kind !== "portfolio" && <Field label="Phone (optional)" htmlFor="wf-phone"><input id="wf-phone" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>}
          </div>
          {src === "pdf" && (found.emails.length > 0 || found.phones.length > 0) && <p className="text-[12.5px] text-ink-400">Found in the PDF (if it's yours):{" "}
            {found.emails.map((x) => <button key={x} type="button" className="mr-1.5 underline text-brand-300" onClick={() => setEmail(x)}>{x}</button>)}
            {kind !== "portfolio" && found.phones.map((x) => <button key={x} type="button" className="mr-1.5 underline text-brand-300" onClick={() => setPhone(x)}>{x}</button>)}</p>}
          <Field label="About your business (optional)" htmlFor="wf-notes" hint="What's different about you: city, speciality, tone. Only what's true.">
            <textarea id="wf-notes" className="input min-h-[70px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </>}
        {res && <>
          {sys && made && <p role="status" className="rounded-lg border border-ink-600 px-3 py-2 text-[12.5px] text-ink-300">Written on this device by the Picaffectz system, as a <b className="text-ink-100">{made.toLowerCase()}</b>. Not quite right? Press Another version, or go Back and say more under About your business.</p>}
          <p className="text-ink-300">Tick the sections to put in the editor. Nothing is saved until you press Save, and History keeps the earlier version.{res.flagged.length ? ` ${res.flagged.length} line${res.flagged.length > 1 ? "s were" : " was"} too close to the reference and left out.` : ""}</p>
          {groups.map((g) => (
            <label key={g.id} className="flex gap-3 rounded-lg border border-ink-700 p-3">
              <input type="checkbox" className="mt-1" checked={pick.has(g.id)} onChange={(e) => { const n = new Set(pick); e.target.checked ? n.add(g.id) : n.delete(g.id); setPick(n); }} />
              <span className="min-w-0"><b className="text-ink-100">{g.label}</b>{g.preview.map((t, i) => <span key={i} className="mt-1 block text-[12.5px] text-ink-300">{t}</span>)}</span>
            </label>
          ))}
        </>}
        {res && src === "link" && upload && db.ready && api && (
          <section className="flex flex-col gap-2 rounded-lg border border-ink-600 p-3" aria-label="Pictures from the site">
            <b className="text-ink-100">Pictures from the site</b>
            <p className="text-[13px] text-ink-300">Moving your own site, or a client's? The Studio can copy its pictures into this project and put them in place. Only take pictures you own or have written permission to use: pictures on someone else's site are theirs.</p>
            {!pics && <button type="button" className="btn btn-sm self-start" disabled={!!busy} onClick={findPics}>{busy && /pictures/.test(busy) ? busy + "…" : "Find the pictures on that page"}</button>}
            {picErr && <p role="alert" className="text-red-300">{picErr}</p>}
            {pics && !pics.length && <p className="text-[13px] text-ink-300">No pictures found on that page (it may draw them with JavaScript).</p>}
            {pics && pics.length > 0 && <>
              <ul className="grid max-h-[320px] grid-cols-2 gap-2 overflow-auto sm:grid-cols-4" aria-label="Pictures found">
                {pics.map((p) => (
                  <li key={p.url} className={`flex flex-col gap-1.5 rounded-lg border p-1.5 ${use[p.url] ? "border-brand-500/60" : "border-ink-700"}`}>
                    <img src={p.url} alt={p.alt} loading="lazy" referrerPolicy="no-referrer" className="h-24 w-full rounded-md bg-ink-950 object-cover" />
                    <select aria-label={`Use ${p.alt || "this picture"} as`} className="input px-2 py-1 text-[12.5px]" value={use[p.url] || ""} onChange={(e) => setUse((u) => { const n = { ...u }, v = e.target.value; if (!v) delete n[p.url]; else { const sl = slots.find((x) => x.id === v); if (sl && !sl.many) for (const k of Object.keys(n)) if (n[k] === v) delete n[k]; n[p.url] = v; } return n; })}>
                      <option value="">Don't take</option>{slots.map((sl) => <option key={sl.id} value={sl.id}>{sl.label}</option>)}
                    </select>
                  </li>
                ))}
              </ul>
              <label className="flex items-start gap-2.5 text-[13px] text-ink-200"><input type="checkbox" className="mt-0.5" checked={mine} onChange={(e) => setMine(e.target.checked)} /><span>These pictures are mine, or I have the owner's permission to use them on this site.</span></label>
              <p className="text-[12.5px] text-ink-400">{chosen.length} of {pics.length} chosen. They are copied into this project when you press Put in the editor; nothing is saved until you press Save.</p>
            </>}
          </section>
        )}
        {err && <p role="alert" className="text-red-300">{err}</p>}
        {err && !sys && allowanceGone(err) && !res && <button type="button" className="btn btn-sm btn-pri self-start" onClick={() => setEng("system")}>Use the Picaffectz system instead (no allowance)</button>}
      </div>
    </Modal>
  );
}
