// A project started from the owner's own file (New project → "Start from your file"): the same reading and the same checks as
// Design yourself (a details sheet answer by answer, any other document read in whatever order; it must fit the kind of website).
import { readDoc, textOf, type DocRead } from "./docread";
import type { DocFile } from "./doctext";
import { docFits } from "./docfit";
import { readSheet, sheetToDoc } from "./detailsheet";

export type ProjectDoc = { name: string; doc: DocFile; text: string };
export type DocCheck = { ok: true; rd: DocRead; sheet: boolean; found: string[]; unclear: string[] } | { ok: false; why: string };
const KIND_SAY: Record<string, string> = { portfolio: "a personal website", store: "an online shop", business: "a business website", restaurant: "a restaurant website", events: "an event website" };

/** Does the file fit this kind of website, and what does it give? */
export function checkDoc(kind: string, d: ProjectDoc): DocCheck {
  const sheet = readSheet(kind, d.doc.rows.map((r) => r.cells));
  if (sheet.labels >= 4) {
    if (sheet.missing.length) return { ok: false, why: `Your details sheet is missing ${sheet.missing.length === 1 ? "an answer that" : "answers that"} must be filled in (marked *): ${sheet.missing.join("; ")}. Fill ${sheet.missing.length === 1 ? "it" : "them"} in and choose the file again.` };
    const rd = sheetToDoc(kind, sheet.answers);
    return { ok: true, rd, sheet: true, found: foundOf(rd), unclear: sheet.unclear };
  }
  const rd = readDoc(d.doc.rows), fit = docFits(kind, d.text, rd);
  if (!fit.ok) return { ok: false, why: `This file doesn't look like it is for ${KIND_SAY[kind] || "this kind of website"}. Missing: ${fit.missing.join("; ")}. It needs at least one of these. Choose another file, or another template.` };
  if (!Object.keys(rd.fields).length && !rd.items.length) return { ok: false, why: "The Studio couldn't find details or a list of items in that file. It reads labelled details (Name, Address, Phone…), headings such as About and Hours, and lists with prices." };
  return { ok: true, rd, sheet: false, found: foundOf(rd), unclear: [] };
}
const NAMES: Record<string, string> = { name: "name", tagline: "tagline", about: "description", story: "story", email: "email", phone: "phone", address: "address", hours: "hours", social: "Instagram", domain: "website", usp: "highlights", places: "locations" };
function foundOf(rd: DocRead): string[] {
  const out = Object.keys(NAMES).filter((k) => rd.fields[k]).map((k) => NAMES[k]);
  if (rd.items.length) out.push(`${rd.items.length} ${rd.items.length === 1 ? "item" : "items"}`);
  return out;
}
export const docText = (d: DocFile) => textOf(d.rows);
