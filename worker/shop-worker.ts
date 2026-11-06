// Cloudflare Worker backend for Site Studio shops: orders and customers are JSON files in a
// PRIVATE GitHub repository, so there is no database to run. Pricing, payments and emails are the
// same code as the Supabase function (imported below and bundled into one file by
// scripts/build-worker.mjs → public/templates/store/cloudflare/worker.js).
//
// Data repository layout:
//   orders/<ORDER_NO>.json        one file per order
//   customers/<id>.json           one file per signed-up customer (id = hash of the email)
//   refs/<razorpay order id>.json lookup for Razorpay webhooks
//   meta/counter.json             next account number
//   auth/<challenge>.json         failed sign-in attempts (max 5 per code)

import { makeHandler, HttpError, siteContent, sendEmail, wrap, str, emailOk, hmacHex, safeEqual, randHex, publicOrder, type Db, type Deps, type Order, type Route } from "../public/templates/store/supabase/functions/shop/index.ts";

type Env = Record<string, string | undefined>;
type Customer = { id: string; account_no: string; email: string; name: string; phone: string; address: Record<string, string>; created_at: string; wishlist: string[] };

// ---------------------------------------------------------------- base64 (UTF-8 safe)
const te = new TextEncoder(), td = new TextDecoder();
function b64(s: string): string {
  const b = te.encode(s);
  let bin = "";
  for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(bin);
}
const unb64 = (s: string) => td.decode(Uint8Array.from(atob(s.replace(/\s/g, "")), (c) => c.charCodeAt(0)));
const b64url = (s: string) => b64(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64url = (s: string) => unb64(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
async function sha256Hex(s: string): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", te.encode(s)))].map((x) => x.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------- GitHub files
const repoChecked = new Map<string, boolean>();

class GitHub {
  constructor(private repo: string, private token: string, private f: typeof fetch) {}
  private h() {
    return { Authorization: `Bearer ${this.token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "site-studio-shop", "Content-Type": "application/json" };
  }
  /** Refuse to store orders in a public repository: GitHub Pages or anyone could read them. */
  async ensurePrivate() {
    if (repoChecked.get(this.repo)) return;
    const r = await this.f(`https://api.github.com/repos/${this.repo}`, { headers: this.h() });
    if (r.status === 401) throw new HttpError(500, "GITHUB_TOKEN is invalid or expired.");
    if (r.status === 404) throw new HttpError(500, "DATA_REPO wasn't found, or GITHUB_TOKEN can't see it.");
    if (!r.ok) throw new HttpError(502, "GitHub didn't respond. Try again.");
    const j: any = await r.json();
    if (!j.private) throw new HttpError(500, "DATA_REPO must be a private repository. Orders contain customer details.");
    repoChecked.set(this.repo, true);
  }
  async get<T>(path: string): Promise<{ data: T; sha: string } | null> {
    const r = await this.f(`https://api.github.com/repos/${this.repo}/contents/${path}`, { headers: this.h() });
    if (r.status === 404) return null;
    if (!r.ok) throw new HttpError(502, `GitHub read failed (${r.status}).`);
    const j: any = await r.json();
    return { data: JSON.parse(unb64(j.content)), sha: j.sha };
  }
  /** Returns the new sha, or null when the file changed underneath us (sha mismatch / already exists). */
  async put(path: string, data: unknown, message: string, sha?: string): Promise<string | null> {
    const r = await this.f(`https://api.github.com/repos/${this.repo}/contents/${path}`, {
      method: "PUT", headers: this.h(),
      body: JSON.stringify({ message, content: b64(JSON.stringify(data, null, 2) + "\n"), ...(sha ? { sha } : {}) }),
    });
    if (r.status === 409 || r.status === 422) return null;
    if (!r.ok) throw new HttpError(502, `GitHub write failed (${r.status}).`);
    const j: any = await r.json();
    return j.content.sha;
  }
  /** Every JSON file in a folder in ONE request (GraphQL), to stay well inside Worker limits. */
  async list<T>(folder: string): Promise<T[]> {
    const [owner, name] = this.repo.split("/");
    const r = await this.f("https://api.github.com/graphql", {
      method: "POST", headers: this.h(),
      body: JSON.stringify({ query: "query($o:String!,$n:String!,$e:String!){repository(owner:$o,name:$n){object(expression:$e){... on Tree{entries{name object{... on Blob{text}}}}}}}", variables: { o: owner, n: name, e: `HEAD:${folder}` } }),
    });
    if (!r.ok) throw new HttpError(502, `GitHub list failed (${r.status}).`);
    const j: any = await r.json();
    if (j.errors?.length && !j.data?.repository) throw new HttpError(502, "GitHub list failed.");
    const entries = j.data?.repository?.object?.entries || [];
    const out: T[] = [];
    for (const e of entries) {
      if (!e.name.endsWith(".json") || typeof e.object?.text !== "string") continue;
      try { out.push(JSON.parse(e.object.text)); } catch { /* skip a broken file */ }
    }
    return out;
  }
  /** Read-modify-write with retries, for files several requests may change at once. */
  async update<T>(path: string, change: (cur: T | null) => T, message: string, known?: { data: T; sha: string } | null): Promise<{ data: T; sha: string }> {
    let cur = known === undefined ? await this.get<T>(path) : known;
    for (let i = 0; i < 5; i++) {
      const next = change(cur ? cur.data : null);
      const sha = await this.put(path, next, message, cur?.sha);
      if (sha) return { data: next, sha };
      await new Promise((res) => setTimeout(res, 150 * (i + 1)));
      cur = await this.get<T>(path);
    }
    throw new HttpError(503, "The shop is busy. Please try again.");
  }
}

const safeName = (s: string) => String(s).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 80);

// ---------------------------------------------------------------- sessions and sign-in codes
const DAY = 86_400_000;
function secret(env: Env): string {
  const s = env.AUTH_SECRET || "";
  if (s.length < 32) throw new HttpError(500, "AUTH_SECRET must be set to a random value of at least 32 characters.");
  return s;
}
async function signSession(env: Env, email: string, id: string, now: number): Promise<string> {
  const p = b64url(JSON.stringify({ e: email, i: id, x: now + 30 * DAY }));
  return `s1.${p}.${await hmacHex(secret(env), "sess|" + p)}`;
}
async function readSession(env: Env, token: string | null, now: number): Promise<{ email: string; id: string } | null> {
  if (!token || !token.startsWith("s1.")) return null;
  const [, p, mac] = token.split(".");
  if (!p || !mac || !safeEqual(await hmacHex(secret(env), "sess|" + p), mac)) return null;
  try {
    const j = JSON.parse(unb64url(p));
    return j.x > now && emailOk(j.e) ? { email: j.e, id: j.i } : null;
  } catch { return null; }
}
const lastSend = new Map<string, number>();

// ---------------------------------------------------------------- the database, as files
function githubDb(gh: GitHub, env: Env, now: () => Date) {
  const cache = new Map<string, { data: Order; sha: string }>();
  const custId = async (email: string) => (await sha256Hex("cust|" + email.toLowerCase())).slice(0, 32);
  const orderPath = (no: string) => `orders/${safeName(no)}.json`;
  const loadOrder = async (no: string) => {
    if (!safeName(no)) return null;
    const f = cache.get(no) || (await gh.get<Order>(orderPath(no)));
    if (f) cache.set(no, f);
    return f;
  };
  const admins = () => (env.ADMIN_EMAILS || env.OWNER_EMAIL || "").split(",").map((s) => s.trim().toLowerCase()).filter(emailOk);

  const db: Db = {
    async insertOrder(o) {
      await gh.ensurePrivate();
      const data = { ...o, id: o.order_no, created_at: now().toISOString() };
      const sha = await gh.put(orderPath(o.order_no), data, `Order ${o.order_no} placed`);
      if (!sha) throw new HttpError(503, "Couldn't save the order. Please try again.");
      cache.set(o.order_no, { data, sha });
    },
    async getOrder(by) {
      if (by.order_no) return (await loadOrder(by.order_no))?.data || null;
      if (by.payment_ref) {
        const ref = await gh.get<{ order_no: string }>(`refs/${safeName(by.payment_ref)}.json`);
        return ref ? (await loadOrder(ref.data.order_no))?.data || null : null;
      }
      return null;
    },
    async updateOrder(no, patch) {
      const known = await loadOrder(no);
      if (!known) throw new HttpError(404, "Order not found.");
      const what = patch.payment_status === "paid" ? "paid" : patch.status ? `→ ${patch.status}` : patch.payment_ref ? "payment reference" : "updated";
      const next = await gh.update<Order>(orderPath(no), (cur) => ({ ...(cur || known.data), ...patch }), `Order ${no} ${what}`, known);
      cache.set(no, next);
      if (patch.payment_ref && /^order_[A-Za-z0-9]+$/.test(patch.payment_ref)) await gh.put(`refs/${safeName(patch.payment_ref)}.json`, { order_no: no }, `Razorpay ref for ${no}`).catch(() => null);
      return next.data;
    },
    async isAdmin(email) { return admins().includes(email.toLowerCase()); },
    async getUser(token) { return readSession(env, token, now().getTime()); },
  };

  const customers = {
    id: custId,
    get: async (email: string) => gh.get<Customer>(`customers/${await custId(email)}.json`),
    async ensure(email: string): Promise<Customer> {
      const have = await customers.get(email);
      if (have) return have.data;
      await gh.ensurePrivate();
      const counter = await gh.update<{ next: number }>("meta/counter.json", (c) => ({ next: (c?.next || 100001) + 1 }), "Next account number");
      const c: Customer = { id: await custId(email), account_no: `AC-${counter.data.next - 1}`, email, name: "", phone: "", address: {}, created_at: now().toISOString(), wishlist: [] };
      const sha = await gh.put(`customers/${c.id}.json`, c, `Customer ${c.account_no} signed up`);
      if (!sha) return (await customers.get(email))!.data; // signed up twice at once: keep the first
      return c;
    },
    async change(email: string, fn: (c: Customer) => Customer, msg: string): Promise<Customer> {
      const path = `customers/${await custId(email)}.json`;
      const known = await gh.get<Customer>(path);
      if (!known) throw new HttpError(404, "Account not found. Sign in again.");
      return (await gh.update<Customer>(path, (cur) => fn(cur || known.data), msg, known)).data;
    },
  };
  return { db, customers, admins };
}

const profileOut = (c: Customer | null) => (c ? { id: c.id, account_no: c.account_no, email: c.email, name: c.name, phone: c.phone, address: c.address, created_at: c.created_at } : null);

// ---------------------------------------------------------------- routes only the Worker has
function routes(d: Deps, gh: GitHub, env: Env, store: ReturnType<typeof githubDb>): Record<string, Route> {
  const now = () => d.now().getTime();
  const need = async (token: string | null) => {
    const u = await readSession(env, token, now());
    if (!u) throw new HttpError(401, "Please sign in again.");
    return u;
  };
  const accountsOn = async () => !!(await siteContent(d))?.backend?.accounts;
  const needAccounts = async () => { if (!(await accountsOn())) throw new HttpError(403, "Customer accounts aren't switched on for this shop."); };
  const needAdmin = async (token: string | null) => {
    const u = await need(token);
    if (!(await store.db.isAdmin(u.email))) throw new HttpError(403, "Only shop admins can do this.");
    return u;
  };

  return {
    // 1. email → 6-digit code. Nothing is stored: the code is checked against a signed challenge.
    "auth-send": async (b) => {
      const email = str(b.email, 200).toLowerCase();
      if (!emailOk(email)) throw new HttpError(400, "Enter a valid email address.");
      const admin = await store.db.isAdmin(email);
      if (!admin && !(await accountsOn())) throw new HttpError(403, "This email can't sign in here.");
      const last = lastSend.get(email) || 0;
      if (now() - last < 45_000) throw new HttpError(429, "Please wait a minute before asking for another code.");
      lastSend.set(email, now());
      const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
      const p = b64url(JSON.stringify({ e: email, x: now() + 10 * 60_000, n: randHex(12) }));
      const challenge = `c1.${p}.${await hmacHex(secret(env), `otp|${p}|${code}`)}`;
      const c = await siteContent(d).catch(() => ({}));
      const shop = c?.brand?.name || "Shop";
      const ok = await sendEmail(d, [email], `${code} is your ${shop} sign-in code`, wrap(shop, "Your sign-in code", `<p style="font-size:15px">Enter this code to sign in. It works for 10 minutes.</p><p style="font-size:34px;font-weight:700;letter-spacing:8px;font-family:monospace;margin:18px 0">${code}</p><p style="font-size:13px;color:#777">If you didn't ask for this, you can ignore this email.</p>`));
      if (!ok) { lastSend.delete(email); throw new HttpError(502, "We couldn't send a code. Check the email and try again."); }
      return { challenge };
    },
    // 2. challenge + code → 30-day session. Five wrong codes lock that challenge.
    "auth-verify": async (b) => {
      const [tag, p, mac] = String(b.challenge || "").split(".");
      let ch: { e: string; x: number; n: string };
      try { ch = JSON.parse(unb64url(p)); } catch { throw new HttpError(400, "Ask for a new code."); }
      if (tag !== "c1" || !mac || !ch?.n || !emailOk(ch.e)) throw new HttpError(400, "Ask for a new code.");
      if (ch.x < now()) throw new HttpError(400, "That code has expired. Ask for a new one.");
      const failPath = `auth/${safeName(ch.n)}.json`;
      const fails = await gh.get<{ fails: number }>(failPath);
      if ((fails?.data.fails || 0) >= 5) throw new HttpError(429, "Too many wrong codes. Ask for a new one.");
      const code = String(b.code || "").replace(/\D/g, "");
      if (code.length !== 6 || !safeEqual(await hmacHex(secret(env), `otp|${p}|${code}`), mac)) {
        await gh.update<{ fails: number }>(failPath, (c) => ({ fails: (c?.fails || 0) + 1 }), "Failed sign-in attempt", fails).catch(() => null);
        throw new HttpError(400, "That code is wrong or has expired. Try again or ask for a new one.");
      }
      const admin = await store.db.isAdmin(ch.e);
      // The shop CMS signs in with { admin: true }: owners don't become customers just by opening Orders.
      const cust = !(b.admin && admin) && (await accountsOn()) ? await store.customers.ensure(ch.e) : (await store.customers.get(ch.e))?.data || null;
      const id = cust?.id || (await store.customers.id(ch.e));
      return { token: await signSession(env, ch.e, id, now()), user: { id, email: ch.e }, admin, profile: profileOut(cust), wishlist: cust?.wishlist || [] };
    },
    me: async (_b, token) => {
      const u = await need(token);
      const admin = await store.db.isAdmin(u.email);
      const cust = (await accountsOn()) ? (await store.customers.get(u.email))?.data || null : null;
      return { user: u, admin, profile: profileOut(cust), wishlist: cust?.wishlist || [] };
    },
    "profile-update": async (b, token) => {
      await needAccounts();
      const u = await need(token);
      const a = b.address || {};
      const c = await store.customers.change(u.email, (c) => ({ ...c, name: str(b.name, 120), phone: str(b.phone, 30), address: { address: str(a.address, 200), city: str(a.city, 80), pin: str(a.pin, 20), state: str(a.state, 80) } }), "Customer details updated");
      return { profile: profileOut(c) };
    },
    wishlist: async (b, token) => {
      await needAccounts();
      const u = await need(token);
      const pid = str(b.product_id, 80);
      if (!pid) throw new HttpError(400, "Missing product.");
      const c = await store.customers.change(u.email, (c) => {
        const set = new Set(c.wishlist || []);
        if (b.action === "remove") set.delete(pid); else set.add(pid);
        return { ...c, wishlist: [...set].slice(0, 200) };
      }, "Wishlist updated");
      return { wishlist: c.wishlist };
    },
    "my-orders": async (_b, token) => {
      await needAccounts();
      const u = await need(token);
      const all = await gh.list<Order>("orders");
      return { orders: all.filter((o) => o.email.toLowerCase() === u.email).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).map(publicOrder) };
    },
    "admin-data": async (_b, token) => {
      await needAdmin(token);
      const [orders, custs] = await Promise.all([gh.list<Order>("orders"), gh.list<Customer>("customers")]);
      orders.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      custs.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      return { orders, customers: custs.map(profileOut) };
    },
  };
}

// ---------------------------------------------------------------- entry point
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const e = (k: string) => String(env[k] ?? "");
    const f: typeof fetch = (...a) => fetch(...a);
    const now = () => new Date();
    const repo = e("DATA_REPO").trim().replace(/^https:\/\/github\.com\//, "").replace(/\/+$/, "");
    const gh = new GitHub(repo, e("GITHUB_TOKEN"), f);
    const store = githubDb(gh, env, now);
    const d: Deps = { db: store.db, env: e, fetch: f, now };
    if (req.method === "POST" && (!/^[\w.-]+\/[\w.-]+$/.test(repo) || !e("GITHUB_TOKEN"))) {
      return new Response(JSON.stringify({ error: "The shop server isn't set up: add DATA_REPO and GITHUB_TOKEN in the Worker's settings." }), { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }
    return makeHandler(d, routes(d, gh, env, store))(req);
  },
};

export const _test = { b64, unb64, readSession, signSession };
