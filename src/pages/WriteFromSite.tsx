// "Write text from a site": reads a reference site (or pasted text), and Workers AI on the Studio's Cloudflare
// database writes NEW, original text for this brand about the same kind of business. The result is reviewed per
// section and put in the editor (not saved), so the owner can change it before saving and publishing.
import { useState } from "react";
import type { Session } from "../lib/auth";
import type { ProjectMeta } from "../lib/studio";
import { cfWrite, type Brief } from "../lib/cfdb";
import { applyBrief, dropFlagged, groupsOf, type Contact } from "../lib/writeMap";
import { readPamphlet } from "../lib/pamphlet";
import { Field, Modal } from "../ui/kit";
import { useAiDb } from "./AiGate";

export function WriteFromSiteDialog({ session, project, draft, onApply, onClose }: { session: Session; project: ProjectMeta; draft: any; onApply: (c: any) => void; onClose: () => void }) {
  const kind = project.template === "store" ? "store" : project.template === "business" ? "business" : project.template === "restaurant" ? "restaurant" : "portfolio";
  const db = useAiDb(session, project), api = db.api;
  const [url, setUrl] = useState(""), [text, setText] = useState("");
  // Where the text comes from: a site, a PDF (a brochure or profile), or pasted text.
  const [src, setSrc] = useState<"link" | "pdf" | "text">("link");
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
  const write = run("Reading and writing", async () => {
    const body = src === "pdf" ? { text: pdf!.text } : showText && text.trim() ? { text: text.trim() } : { url: url.trim() };
    const r = await cfWrite(api!, { ...body, brand: brandName.trim(), notes: notes.trim(), kind: kind === "restaurant" ? "business" : kind });
    const b = dropFlagged(r.brief, r.flagged || []);
    setRes({ brief: b, flagged: r.flagged || [] }); setPick(new Set(groupsOf(kind, b, contact()).map((g) => g.id)));
  });
  const contact = (): Contact => ({ email: email.trim(), phone: phone.trim(), brand: brandName.trim() });
  const apply = () => { onApply(applyBrief(kind, draft, res!.brief, brandName.trim(), pick, contact())); onClose(); };

  const emailOk = !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canWrite = !!brandName.trim() && emailOk && (src === "pdf" ? !!pdf : showText ? text.trim().split(/\s+/).length >= 40 : /^https?:\/\/\S+\.\S+/.test(url.trim()) || /^[\w-]+(\.[\w-]+)+/.test(url.trim()));
  const groups = res ? groupsOf(kind, res.brief, contact()) : [];
  const footer = res
    ? <><button className="btn" onClick={() => setRes(null)}>Back</button><button className="btn btn-pri" disabled={!pick.size} onClick={apply}>Put in the editor</button></>
    : <><button className="btn" onClick={onClose}>Cancel</button>{db.ready && <button className="btn btn-pri" disabled={!canWrite || !!busy} onClick={write}>{busy ? busy + "…" : "Write new text"}</button>}</>;

  return (
    <Modal title="Write text from a site or PDF" onClose={onClose} wide footer={footer}>
      <div className="flex flex-col gap-3 text-sm">
        {!res && <p className="text-ink-300">Give a site in the same line of business, or a PDF such as your brochure or company profile. The Studio reads what it covers and writes <b>new text of its own</b> for your brand, section by section: nothing is copied, and anything too close to the original is left out. Testimonials, numbers, team, clients, prices and products aren't written, so fill those in yourself.</p>}
        {db.ui}
        {db.ready && !res && <>
          <Field label="Your brand name" htmlFor="wf-brand" hint="Used in the new text and set as the site's name.">
            <input id="wf-brand" className="input" value={brandName} onChange={(e) => setBrandName(e.target.value)} />
          </Field>
          <div role="radiogroup" aria-label="Read from" className="flex flex-wrap gap-2">
            {([["link", "A website"], ["pdf", "A PDF"], ["text", "Pasted text"]] as const).map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={src === v} className={`btn btn-sm ${src === v ? "btn-pri" : ""}`} onClick={() => setSrc(v)}>{l}</button>)}
          </div>
          {src === "link" && <Field label="Reference site" htmlFor="wf-url" hint="A page that shows what the business offers, for example its home or about page.">
            <input id="wf-url" className="input" placeholder="https://example.com" value={url} onChange={(e) => setUrl(e.target.value)} /></Field>}
          {src === "pdf" && <Field label="PDF" htmlFor="wf-pdf" hint={pdf ? `Read ${pdf.text.split(/\s+/).length} words from ${pdf.name}.` : "A brochure, company profile or menu, up to 12 pages."}>
            <input id="wf-pdf" className="input" type="file" accept=".pdf,application/pdf" onChange={(e) => readPdf(e.target.files?.[0])} /></Field>}
          {src === "text" && <Field label="The page's text" htmlFor="wf-text" hint="Some sites can't be read from here. Copy the page's text and paste it (at least 40 words).">
            <textarea id="wf-text" className="input min-h-[140px]" value={text} onChange={(e) => setText(e.target.value)} /></Field>}
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
          <p className="text-ink-300">Tick the sections to put in the editor. Nothing is saved until you press Save, and History keeps the earlier version.{res.flagged.length ? ` ${res.flagged.length} line${res.flagged.length > 1 ? "s were" : " was"} too close to the reference and left out.` : ""}</p>
          {groups.map((g) => (
            <label key={g.id} className="flex gap-3 rounded-lg border border-ink-700 p-3">
              <input type="checkbox" className="mt-1" checked={pick.has(g.id)} onChange={(e) => { const n = new Set(pick); e.target.checked ? n.add(g.id) : n.delete(g.id); setPick(n); }} />
              <span className="min-w-0"><b className="text-ink-100">{g.label}</b>{g.preview.map((t, i) => <span key={i} className="mt-1 block text-[12.5px] text-ink-300">{t}</span>)}</span>
            </label>
          ))}
        </>}
        {err && <p role="alert" className="text-red-300">{err}</p>}
      </div>
    </Modal>
  );
}
