// Legal basics shared by every template: the business's identity (content.legal), privacy policy and terms pages
// written from it, and the checks shown before a site is published. The wording is a starting point, not legal advice.

export type Identity = { name: string; address: string; phone: string; email: string; gstin: string; cin: string };

const s = (v: unknown) => String(v ?? "").trim();
const oneLine = (v: unknown) => s(v).replace(/\s*\n\s*/g, ", ");

/** The business's details: what was typed under Legal & privacy, else the brand name and contact details of the site. */
export function identity(c: any): Identity {
  const L = c?.legal || {}, K = c?.contact || {};
  return { name: s(L.name) || s(c?.brand?.name) || s(c?.brand?.logoText), address: s(L.address) || s(K.address), phone: s(L.phone) || s(K.phone), email: s(L.email) || s(K.email), gstin: s(L.gstin), cin: s(L.cin) };
}

/** What the site collects, by template. */
export function collects(tplId: string, c: any): { form: boolean; checkout: boolean; accounts: boolean; maps: boolean; consent: boolean } {
  const form = (tplId === "business" || tplId === "restaurant") && c?.contact?.form?.enabled !== false;
  const checkout = tplId === "store" || (tplId === "restaurant" && !!c?.ordering?.on);
  return { form, checkout, accounts: tplId === "store", maps: tplId === "restaurant" && c?.contact?.mapEmbed !== false, consent: !!c?.consent?.on };
}

export const LEGAL_PAGES = { privacy: { id: "pg-privacy", title: "Privacy policy", slug: "privacy" }, terms: { id: "pg-terms", title: "Terms of use", slug: "terms" } } as const;
export type LegalKind = keyof typeof LEGAL_PAGES;

const today = () => new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

export function privacyText(tplId: string, c: any): string {
  const I = identity(c), F = collects(tplId, c), who = I.name || "this website's owner";
  const what: string[] = [];
  if (F.form) what.push("- **Enquiries and bookings:** the name, phone number, email address and message you send through a form on this site.");
  if (F.checkout) what.push("- **Orders:** your name, phone number, email address, delivery address, what you ordered and how you chose to pay. Card and UPI details are entered with the payment provider and are not stored by us.");
  if (F.accounts) what.push("- **Accounts:** your email address and the details you save in your account, such as addresses and past orders.");
  what.push("- **Technical data:** basic information your browser sends to any website, such as its type and the pages requested. " + (F.consent ? "Optional cookies and similar tools are used only after you allow them in the consent banner." : "This site does not use tracking cookies of its own."));
  const share = ["- the companies that host this website and its database", ...(F.checkout ? ["- the payment provider you choose at checkout, to take the payment", "- delivery partners, to bring your order to you"] : []), ...(F.maps ? ["- Google Maps, when you open the map on this site"] : []), "- authorities, when the law requires it"];
  return [
    `This policy explains what personal data ${who} collects through this website, why, and the choices you have.`,
    "## Who we are",
    [who, oneLine(I.address), I.phone ? "Phone: " + I.phone : "", I.email ? "Email: " + I.email : "", I.gstin ? "GSTIN: " + I.gstin : "", I.cin ? "CIN: " + I.cin : ""].filter(Boolean).join("\n"),
    "## What we collect", what.join("\n"),
    "## Why we use it",
    ["- to answer your enquiry or booking request", ...(F.checkout ? ["- to prepare, deliver and bill your order, and to tell you about its progress"] : []), "- to keep the website secure and stop misuse", "- to meet our legal and tax duties"].join("\n"),
    "We use your details only for these purposes. We do not sell personal data.",
    "## Who we share it with", "Only with those who help us run this service:\n" + share.join("\n"),
    "## How long we keep it",
    `Enquiries are kept for as long as needed to answer them${F.checkout ? ", and order records for as long as tax and consumer law require" : ""}. After that they are deleted.`,
    "## Your rights",
    "You can ask us for a copy of your personal data, ask us to correct or delete it, withdraw a consent you gave, and name another person to act for you. In India these rights come from the Digital Personal Data Protection Act, 2023. To use them, or to raise a grievance, write to us using the details above. If you are not satisfied with our answer, you may approach the Data Protection Board of India.",
    "## Children", "This website is not meant for children, and we do not knowingly collect their data without a parent's or guardian's consent.",
    "## Changes", `We may update this policy. The date below shows when it was last changed.\n\nLast updated: ${today()}`,
  ].join("\n\n");
}

export function termsText(tplId: string, c: any): string {
  const I = identity(c), F = collects(tplId, c), who = I.name || "the owner of this website";
  const parts = [
    `These terms apply when you use this website, which is run by ${who}${I.address ? ", " + oneLine(I.address) : ""}. By using the site you agree to them.`,
    "## Using this website", "Please use the site lawfully and do not try to disrupt it, copy it in bulk or get into parts that are not public. We may change or withdraw content at any time.",
    "## Information on the site", "We take care to keep descriptions, prices, opening hours and availability correct, but mistakes can happen. If something is wrong we will correct it and tell you before going ahead with anything that depends on it.",
  ];
  if (F.checkout) parts.push(
    "## Orders and prices", `Prices are shown in the currency on the page${I.gstin ? " and taxes are charged as shown at checkout" : ""}. The total you are asked to pay, including delivery and any other charge, is shown before you confirm. An order is accepted when we confirm it; we may decline or cancel an order we cannot fulfil, with a full refund of anything paid.`,
    "## Payment", "Payments are taken by the payment provider you choose at checkout, under that provider's own terms. We do not store card or UPI details.",
    "## Cancellation, returns and refunds", tplId === "restaurant" ? "Food is prepared to order. Please contact us straight away if you need to change or cancel an order, or if something is wrong with it; we will put it right or refund you where that is due." : "Our returns, refund and shipping rules are set out on the policies pages of this site and form part of these terms.");
  if (F.form) parts.push("## Enquiries and bookings", "A request sent through a form is not confirmed until we reply to confirm it.");
  parts.push(
    "## Intellectual property", `The text, pictures, logos and design on this site belong to ${who} or are used with permission. Please ask before reusing them.`,
    "## Liability", "We are responsible for what the law says we cannot exclude. Beyond that, we are not liable for indirect loss or for problems caused by events outside our reasonable control.",
    "## Privacy", "How we handle personal data is explained in our Privacy policy.",
    "## Law and disputes", "These terms are governed by the laws of India. Please contact us first so we can try to resolve any complaint; otherwise the courts where we are based will have jurisdiction.",
    "## Contact", [who, oneLine(I.address), I.phone ? "Phone: " + I.phone : "", I.email ? "Email: " + I.email : ""].filter(Boolean).join("\n"),
    `Last updated: ${today()}`);
  return parts.join("\n\n");
}

const isKind = (p: any, kind: LegalKind) => !!p && (p.id === LEGAL_PAGES[kind].id || p.legal === kind || (kind === "privacy" ? /privacy/i : /\bterms\b|conditions/i).test(s(p.title) + " " + s(p.slug)));
/** The site's page of that kind: one made here, or the owner's own page with a matching title. */
export function legalPage(c: any, kind: LegalKind): any | null {
  const list: any[] = Array.isArray(c?.staticPages) ? c.staticPages : [];
  if (kind === "privacy" && s(c?.consent?.policyUrl)) return { external: true, title: "Privacy policy" };
  if (kind === "privacy" && c?.consent?.policyPage) { const p = list.find((x) => x && x.id === c.consent.policyPage); if (p) return p; }
  return list.find((p) => isKind(p, kind) && p.show !== false) || (Array.isArray(c?.policies) ? c.policies.find((p: any) => isKind(p, kind)) : null) || null;
}
/** Writes (or rewrites) the page from the business's details and links it at the bottom of the site. */
export function makeLegalPage(tplId: string, c: any, kind: LegalKind, blank: (title: string) => any): any {
  const meta = LEGAL_PAGES[kind], body = kind === "privacy" ? privacyText(tplId, c) : termsText(tplId, c);
  c.staticPages = Array.isArray(c.staticPages) ? c.staticPages : [];
  let p = c.staticPages.find((x: any) => x && x.id === meta.id);
  if (!p) { p = { ...blank(meta.title), id: meta.id, slug: meta.slug, legal: kind, inFooter: true }; c.staticPages.push(p); }
  p.body = body; p.show = true; p.updated = new Date().toISOString().slice(0, 10);
  if (kind === "privacy") { c.consent = c.consent || {}; if (!s(c.consent.policyUrl)) c.consent.policyPage = meta.id; }
  return p;
}

// ---- colour contrast
const rgb = (hex: unknown): [number, number, number] | null => { const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s(hex)); if (!m) return null; const h = m[1].length === 3 ? m[1].replace(/./g, "$&$&") : m[1]; return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]; };
const lum = (c: [number, number, number]) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
/** WCAG contrast ratio of two hex colours (1 to 21), or null when either is not a hex colour. */
export function contrast(a: unknown, b: unknown): number | null { const x = rgb(a), y = rgb(b); if (!x || !y) return null; const l1 = lum(x), l2 = lum(y); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); }

/** Colour problems that can be told from the settings alone (the preview's own check looks at the drawn page). */
export function a11yChecks(c: any): string[] {
  const out: string[] = [], T = c?.theme || {}, r = (n: number) => n.toFixed(1) + ":1";
  const tb = contrast(T.text, T.bg); if (tb !== null && tb < 4.5) out.push(`Accessibility: the theme's text colour is hard to read on its background (contrast ${r(tb)}; aim for at least 4.5:1).`);
  const sb = contrast(T.soft, T.bg); if (sb !== null && sb < 3) out.push(`Accessibility: the theme's soft text colour is too faint on its background (contrast ${r(sb)}; aim for at least 4.5:1).`);
  for (const [key, k] of Object.entries((c?.sectionBg || {}) as Record<string, any>)) {
    if (!k || !k.on) continue;
    const pic = k.kind === "image" || k.kind === "video" || k.kind === "slides";
    if (k.text === "custom" && !pic && k.kind !== "none") { const x = contrast(k.textColor, k.color); if (x !== null && x < 4.5) out.push(`Accessibility: in the “${key}” section, the text colour you chose is hard to read on its background colour (contrast ${r(x)}; aim for at least 4.5:1).`); }
    if (pic && (Number(k.dim) || 0) < 30) out.push(`Accessibility: the “${key}” section has text over a ${k.kind === "video" ? "video" : "picture"} with a weak backdrop. Raise “Strength of the backdrop” to 30% or more so the text stays readable.`);
  }
  return out;
}

/** What to put right before publishing: legal pages and identity. */
export function legalChecks(tplId: string, c: any): string[] {
  const out: string[] = [], F = collects(tplId, c), I = identity(c), where = "Settings → Legal & privacy";
  if ((F.form || F.checkout || F.accounts) && !legalPage(c, "privacy")) out.push(`Required: this site collects personal details (${[F.form ? "a form" : "", F.checkout ? "a checkout" : ""].filter(Boolean).join(" and ") || "accounts"}) but has no privacy policy. Create one under ${where} → Legal pages.`);
  if (F.checkout && !legalPage(c, "terms")) out.push(`Required: this site takes orders but has no terms page. Create one under ${where} → Legal pages.`);
  if ((F.form || F.checkout) && !(s(c?.legal?.name) && s(c?.legal?.address))) out.push(`Fill in the business's legal name and registered address under ${where} → Business identity${I.name ? "" : " (the site has no name yet)"}.`);
  if ((F.form || F.checkout) && c?.privacy?.formConsent === false) out.push(`Consent on forms is switched off (${where} → Consent on forms): visitors are not asked to agree before sending their details.`);
  return [...out, ...a11yChecks(c)];
}
