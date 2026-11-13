// Stripe through the Studio's helper: the shop's webhook endpoint, created with the secret key the owner gives
// the Worker. Stripe returns the endpoint's signing secret only when it's created, so an existing endpoint for
// the same address is replaced.
import { relayCall, type Relay } from "./relay";

export const STRIPE_EVENTS = ["checkout.session.completed"];
const form = (o: Record<string, string | string[]>) => Object.entries(o).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => `${encodeURIComponent(k)}[]=${encodeURIComponent(x)}`) : [`${encodeURIComponent(k)}=${encodeURIComponent(v)}`])).join("&");

export async function stripeWebhook(relay: Relay, secretKey: string, url: string): Promise<{ secret: string; replaced: boolean }> {
  const call = async (method: string, path: string, body?: string) => {
    const r = await relayCall(relay, { target: "stripe", method, path, auth: secretKey, ...(body ? { body, contentType: "application/x-www-form-urlencoded" } : {}) });
    let j: any = null; try { j = JSON.parse(r.body); } catch { /* not JSON */ }
    if (r.status === 401) throw new Error("Stripe refused the secret key. Copy it again from Stripe → Developers → API keys.");
    if (r.status >= 400) throw new Error("Stripe: " + (j?.error?.message || r.status));
    return j;
  };
  const list = await call("GET", "/v1/webhook_endpoints?limit=100");
  const old = (list?.data || []).filter((w: any) => w.url === url);
  for (const w of old) await call("DELETE", `/v1/webhook_endpoints/${w.id}`);
  const made = await call("POST", "/v1/webhook_endpoints", form({ url, enabled_events: STRIPE_EVENTS, description: "Shop orders (Site Studio)" }));
  if (!made?.secret) throw new Error("Stripe created the webhook but didn't return its signing secret.");
  return { secret: made.secret, replaced: old.length > 0 };
}
