// Email templates written in the Studio's own light markup, turned into the email's HTML.
// No imports: the Studio (the editor's live preview) and the Worker (the real email) both use this file, so what the
// editor shows is what is sent. Everything typed is escaped first; only the marks below become HTML.
//
//   # Heading        ## Smaller heading      - list item      > quote      ---  (a line)
//   **bold**  *italic*  __underline__  ~~strike~~  ==highlight==  `code`
//   [words](https://link)      [[Button words]](https://link)
//   {small:words}  {muted:words}  {big:words}
//   {name} and the other words in curly brackets are filled in; a block (like {items}) goes on a line of its own.

export type MailKind = {
  label: string;
  /** Words in curly brackets this email knows, and what each stands for. */
  vars: [string, string][];
  /** Blocks: each goes on a line of its own and is drawn by the site (a table, the code, a button). */
  blocks: [string, string][];
  /** The standard email, written in the markup (what "Start from the standard email" puts in the box). */
  std: string;
  subject: string;
  /** Made-up values for the preview and the test email. */
  sample: Record<string, string>;
};
const ORDER_VARS: [string, string][] = [["name", "the customer's name"], ["order", "the order number"], ["total", "the order's total"], ["site", "your site's name"], ["when", "delivery or pickup time"]];
const ORDER_SAMPLE = { name: "Asha Verma", order: "#1042", total: "₹1,480", site: "Your site", when: "Delivery, today 7:30 pm", items: "• 2 × Sample item one\n• 1 × Sample item two", courier: "Delhivery", tracking: "DL123456789IN", tracklink: "https://example.com/track/DL123456789IN" };
const DETAILS_SAMPLE = "Name: Asha Verma\nEmail: asha@example.com\nPhone: 98765 43210\nMessage: Hello, I'd like to know more.";
const status = (label: string, head: string, was: string, foot: string): MailKind => ({ label, vars: ORDER_VARS, blocks: [["items", "the list of items"]], subject: `Your order {order} ${was}`, std: `# ${head}\n\nHi {name}, your order {order} from {site} ${was}.${foot ? `\n\n{muted:${foot}}` : ""}`, sample: ORDER_SAMPLE });
export const MAIL_KINDS: Record<string, MailKind> = {
  signin: { label: "Sign-in code email", vars: [["site", "your site's name"], ["email", "the address signing in"]], blocks: [["code", "the 6-digit code, large"]], subject: "Your sign-in code",
    std: "# Your sign-in code\n\nEnter this code to sign in to {site}:\n\n{code}\n\n{muted:It works for 10 minutes. If you didn't ask for it, ignore this email.}", sample: { site: "Your site", email: "you@example.com", code: "482 913" } },
  order: { label: "Order confirmation to the customer", vars: ORDER_VARS, blocks: [["items", "the list of items"]], subject: "Thanks for your order {order}",
    std: "# We've got your order\n\nHi {name},\n\nThanks for your order {order} from {site}. We've received it and will get it ready soon.\n\nOrder total: **{total}**\n\n{muted:Your order}\n\n{items}\n\n{muted:Questions? Just reply to this email.}", sample: ORDER_SAMPLE },
  orderOwner: { label: "New-order email to you", vars: [["name", "the customer's name"], ["order", "the order number"], ["total", "the order's total"], ["site", "your site's name"], ["email", "the customer's email"]], blocks: [["details", "everything the customer filled in"]], subject: "New order {order} ({total}) from {name}",
    std: "New order **{order}** on the {site} website.\n\n{details}\n\n{muted:It is also saved under Purchased orders in the site's admin page.}", sample: { ...ORDER_SAMPLE, email: "asha@example.com", details: "Name: Asha Verma\nPhone: 98765 43210\nOrder: #1042\nTotal: ₹1,480\nItems: 2 × Sample item one, 1 × Sample item two" } },
  shipped: { label: "Shipped email", vars: [...ORDER_VARS, ["courier", "the courier's name"], ["tracking", "the tracking number"], ["tracklink", "the tracking page's address"]], blocks: [["items", "the list of items"]], subject: "Your order {order} has shipped",
    std: "# Your order is on its way\n\nHi {name}, your order {order} from {site} has shipped with {courier}.\n\nTracking number: `{tracking}`\n\n[[Track your parcel]]({tracklink})\n\n{muted:Thank you for shopping with us.}", sample: ORDER_SAMPLE },
  "status.ready": status("Order ready email", "Your order is ready", "is ready", "Thank you!"),
  "status.out": status("Out for delivery email", "On its way to you", "is out for delivery", "Thank you!"),
  "status.done": status("Order complete email", "Order complete", "is complete", "Thank you for choosing us."),
  "status.cancelled": status("Order cancelled email", "Order cancelled", "was cancelled", "If you didn't ask for this, just reply to this email."),
  enquiry: { label: "Enquiry email to you", vars: [["name", "the visitor's name"], ["email", "the visitor's email"], ["site", "your site's name"], ["page", "the page the form was on"]], blocks: [["details", "everything the visitor filled in"]], subject: "New enquiry from {name}",
    std: "New enquiry from the {site} website.\n\n{details}\n\n{muted:It is also saved under Enquiries in the site's admin page.}", sample: { name: "Asha Verma", email: "asha@example.com", site: "Your site", page: "Contact", details: DETAILS_SAMPLE } },
  reply: { label: "Thank-you email to the visitor", vars: [["name", "the visitor's name"], ["site", "your site's name"]], blocks: [["details", "a copy of what they sent"]], subject: "Thank you for contacting {site}",
    std: "Hi {name},\n\nThank you for your message. We have received it and will get back to you soon.\n\n{site}", sample: { name: "Asha Verma", email: "asha@example.com", site: "Your site", page: "Contact", details: DETAILS_SAMPLE } },
};
/** The longest template kept or sent. */
export const MAIL_TPL_MAX = 12000;

const esc = (x: string) => String(x).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]!));
const URL = "((?:https?:\\/\\/|mailto:)[^\\s)<>\"]+)";
/** One line's marks → HTML (the text is already escaped and filled in). */
function inline(h: string): string {
  return h
    .replace(/`([^`\n]+)`/g, '<code style="font:13px ui-monospace,Menlo,Consolas,monospace;background:#f1f2f5;border-radius:4px;padding:1px 5px">$1</code>')
    .replace(new RegExp("\\[\\[([^\\]\\n]+)\\]\\]\\(" + URL + "\\)", "g"), '<a href="$2" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600">$1</a>')
    .replace(new RegExp("\\[([^\\]\\n]+)\\]\\(" + URL + "\\)", "g"), '<a href="$2" style="color:#2456d6">$1</a>')
    .replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>").replace(/__([^_\n]+)__/g, "<u>$1</u>").replace(/~~([^~\n]+)~~/g, "<s>$1</s>").replace(/==([^=\n]+)==/g, '<mark style="background:#fff3a3;padding:0 2px">$1</mark>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<i>$2</i>")
    .replace(/\{(small|muted|big):([^{}]*)\}/g, (_m, k, t) => `<span style="${k === "big" ? "font-size:19px;font-weight:600" : k === "small" ? "font-size:13px" : "font-size:13px;color:#667"}">${t}</span>`);
}
/** A plain "Label: value" list or a bullet list as the email draws it (for the preview and the test email). */
export function sampleBlock(text: string): string {
  const rows = text.split("\n").map((l) => { const i = l.indexOf(": "); return i > 0 ? `<tr><td style="padding:6px 14px 6px 0;color:#667;vertical-align:top;white-space:nowrap">${esc(l.slice(0, i))}</td><td style="padding:6px 0">${esc(l.slice(i + 2))}</td></tr>` : ""; }).join("");
  return rows ? `<table style="border-collapse:collapse;margin:0 0 14px">${rows}</table>` : `<p style="margin:0 0 12px">${esc(text).replace(/\n/g, "<br>")}</p>`;
}
export const codeBlock = (code: string) => `<p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:0 0 14px">${esc(code)}</p>`;
/** The made-up blocks of a kind of email, drawn. */
export function sampleBlocks(kind: string): Record<string, string> {
  const K = MAIL_KINDS[kind], o: Record<string, string> = {}; if (!K) return o;
  for (const [b] of K.blocks) o[b] = b === "code" ? codeBlock(K.sample.code || "000 000") : sampleBlock(K.sample[b] || "");
  return o;
}
/** Template → the email's inner HTML. `vars` are plain words (escaped here); `blocks` are ready HTML, placed where a line holds only {block}. */
export function mailMarkup(src: string, vars: Record<string, string>, blocks: Record<string, string> = {}): string {
  const fillLine = (s: string) => esc(s).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? esc(vars[k]).replace(/\n/g, "<br>") : m));
  const out: string[] = []; let para: string[] = [], list: string[] = [];
  const flush = () => {
    if (para.length) { out.push(`<p style="margin:0 0 12px">${para.join("<br>")}</p>`); para = []; }
    if (list.length) { out.push(`<ul style="margin:0 0 12px;padding-left:20px;list-style:disc">${list.map((x) => `<li style="margin:0 0 4px">${x}</li>`).join("")}</ul>`); list = []; }
  };
  for (const raw of String(src || "").slice(0, MAIL_TPL_MAX).replace(/\r/g, "").split("\n")) {
    const l = raw.trim(); let m: RegExpExecArray | null;
    if (!l) { flush(); continue; }
    if ((m = /^\{(\w+)\}$/.exec(l)) && m[1] in blocks) { flush(); out.push(blocks[m[1]]); continue; }
    if (/^-{3,}$/.test(l)) { flush(); out.push('<hr style="border:0;border-top:1px solid #dde0e6;margin:16px 0">'); continue; }
    if ((m = /^(#{1,3})\s+(.+)$/.exec(l))) { flush(); const n = m[1].length; out.push(`<h${n + 1} style="margin:0 0 12px;font-size:${n === 1 ? 20 : n === 2 ? 17 : 15}px">${inline(fillLine(m[2]))}</h${n + 1}>`); continue; }
    if ((m = /^>\s?(.*)$/.exec(l))) { flush(); out.push(`<blockquote style="margin:0 0 12px;padding:2px 0 2px 12px;border-left:3px solid #c9ced8;color:#445">${inline(fillLine(m[1]))}</blockquote>`); continue; }
    if ((m = /^[-•]\s+(.+)$/.exec(l))) { if (para.length) flush(); list.push(inline(fillLine(m[1]))); continue; }
    if (list.length) flush();
    para.push(inline(fillLine(l)));
  }
  flush();
  return out.join("");
}
/** The template of a kind inside a site's emails, or "" (kind may be "status.ready"). */
export function tplOf(emails: any, kind: string): string {
  let o = emails; for (const k of kind.split(".")) o = o && typeof o === "object" ? o[k] : undefined;
  return o && typeof o === "object" && typeof o.tpl === "string" && o.tpl.trim() ? o.tpl.slice(0, MAIL_TPL_MAX) : "";
}
