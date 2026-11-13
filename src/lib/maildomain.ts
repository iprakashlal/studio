// Sending sign-in codes from your own domain: adds the domain to Resend, puts Resend's DNS records into the
// domain's Cloudflare DNS and asks Resend to verify it. Needs a Resend key with Full access (to add a domain).
import type { Relay } from "./relay";
import { Resend, type ResendDomain } from "./resend";
import { CfError, type Cloudflare } from "./cloudflare";

export type MailDomainResult = { domain: ResendDomain; verified: boolean; added: number; problems: string[]; sendKey?: string };

export async function verifyMailDomain(relay: Relay, cf: Cloudflare, resendKey: string, name: string, step: (s: string) => void): Promise<MailDomainResult> {
  const rs = new Resend(relay, resendKey), dom = name.trim().toLowerCase();
  step("Checking the domain is on your Cloudflare");
  const zone = await cf.zoneNamed(dom);
  if (!zone) throw new Error(`${dom} isn't on your Cloudflare yet. Set it up in “3 · Your domain” first.`);
  if (zone.status !== "active") throw new Error(`${dom} is on your Cloudflare but waiting for its nameservers to be switched (see “3 · Your domain”). Once that's done, press this again.`);
  step("Adding the domain to Resend");
  let d = (await rs.domains()).find((x) => x.name === dom) || null;
  if (!d) d = await rs.addDomain(dom);
  d = await rs.domain(d.id);
  const problems: string[] = [], clash = new Map<string, string[]>(); let added = 0;
  step("Adding Resend's records to your Cloudflare DNS");
  for (const r of d.records || []) {
    try {
      const out = await cf.addRecords(zone, dom, [{ type: r.type, name: r.name, value: r.value, priority: r.priority }]);
      for (const o of out) { if (o.done === "added") added++; if (o.done === "conflict") problems.push(`${o.type} ${o.name} already has a different value`); }
    } catch (e) {
      const fq = r.name && r.name !== "@" ? `${r.name}.${dom}` : dom, why = e instanceof CfError ? e.message.replace(/^Cloudflare: /, "").replace(/\.$/, "") : String((e as any)?.message || e);
      if (/CNAME record with that host already exists/i.test(why)) clash.set(fq, [...(clash.get(fq) || []), r.type]);
      else problems.push(`${r.type} ${fq}: ${why}`);
    }
  }
  for (const [fq, types] of clash) problems.unshift(`${fq} already has a CNAME record (for another service), so Resend's ${types.join(" and ")} record${types.length > 1 ? "s" : ""} can't go there`);
  step("Asking Resend to check the records");
  await rs.verify(d.id).catch(() => null);
  for (let i = 0; i < 8; i++) {
    d = await rs.domain(d.id);
    if (d.status === "verified") break;
    step(`Waiting for Resend to see the records (${d.status})`);
    await new Promise((res) => setTimeout(res, 4000));
  }
  // The database Worker gets its own key that can only send, and only from this domain: the Full access key isn't
  // kept anywhere, so it can be deleted in Resend afterwards.
  let sendKey: string | undefined;
  if (d.status === "verified") { step("Making a send-only key for the database"); sendKey = (await rs.sendingKey(`Studio sign-in codes (${dom})`, d.id)).token; }
  return { domain: d, verified: d.status === "verified", added, problems, sendKey };
}
