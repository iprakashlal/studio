import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { basePath, fmtDate, money } from "../lib/util";
import { Field, Spinner, useToast } from "../ui/kit";

// Orders and Customers for shops with a backend: Supabase (access rules show everything only to
// emails in shop_admins) or the Cloudflare Worker (only to OWNER_EMAIL / ADMIN_EMAILS). The owner
// signs in with an email code either way.

type Order = {
  order_no: string; email: string; name: string; phone: string; address: Record<string, string>; notes: string; user_id: string | null;
  items: { id: string; name: string; opt: string; qty: number; price: number }[]; totals: { sub: number; ship: number; taxAdd: number; total: number };
  currency: string; method: string; payment_status: string; status: string; payment_ref: string | null; paid_at: string | null;
  notify_log: { at: string; what: string; ok: boolean }[]; created_at: string;
};
type Profile = { id: string; account_no: string; email: string; name: string; phone: string; address: Record<string, string>; created_at: string };

const STATUS = ["pending", "processing", "shipped", "delivered", "cancelled"] as const;
const STATUS_LABEL: Record<string, string> = { pending: "Awaiting payment", processing: "Processing", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled" };
const PAY_LABEL: Record<string, string> = { unpaid: "Unpaid", paid: "Paid", cod: "Cash on delivery", refunded: "Refunded" };
const pill = (kind: string) =>
  ({ paid: "border-emerald-400/50 text-emerald-200", cod: "border-sky-400/50 text-sky-200", unpaid: "border-amber-400/50 text-amber-200", refunded: "border-ink-500 text-ink-300",
    pending: "border-amber-400/50 text-amber-200", processing: "border-sky-400/50 text-sky-200", shipped: "border-brand-400/60 text-brand-300", delivered: "border-emerald-400/50 text-emerald-200", cancelled: "border-red-400/50 text-red-300" } as Record<string, string>)[kind] || "border-ink-500 text-ink-300";
const digits = (s: string) => String(s || "").replace(/\D/g, "");

// ---------------------------------------------------------------- owner sign-in, per backend
type OwnerUser = { email: string };
type Owner = {
  ready: boolean; cf: boolean; loading: boolean; user: OwnerUser | null; admin: boolean | null;
  sendCode(email: string): Promise<void>; verify(email: string, code: string): Promise<void>; signOut(): Promise<void>;
  load(): Promise<{ orders: Order[]; profiles: Profile[] }>; call(body: any): Promise<any>;
};

const clients = new Map<string, SupabaseClient>();
function client(url: string, key: string) {
  const k = url + "|" + key;
  if (!clients.has(k)) clients.set(k, createClient(url.replace(/\/+$/, ""), key, { auth: { persistSession: true, storageKey: `shop-admin:${basePath()}`, detectSessionInUrl: false } }));
  return clients.get(k)!;
}
async function post(url: string, body: any, headers: Record<string, string>) {
  let r: Response;
  try { r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) }); }
  catch { throw new Error("Couldn't reach the shop backend. Check the URL and your connection."); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || "The shop backend didn't respond. Check it's deployed."), { status: r.status });
  return j;
}

function useSupabaseOwner(content: any, on: boolean): Owner {
  const url = content?.backend?.supabaseUrl || "", key = content?.backend?.anonKey || "";
  const ready = on && /^https:\/\//.test(url) && !!key;
  const sb = useMemo(() => (ready ? client(url, key) : null), [ready, url, key]);
  const [user, setUser] = useState<User | null>(null);
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!sb) { setLoading(false); return; }
    let live = true;
    const check = async (u: User | null) => {
      if (!live) return;
      setUser(u);
      if (!u) { setAdmin(null); setLoading(false); return; }
      const { data } = await sb.rpc("is_shop_admin");
      if (live) { setAdmin(!!data); setLoading(false); }
    };
    sb.auth.getSession().then(({ data }) => check(data.session?.user || null));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => check(s?.user || null));
    return () => { live = false; sub.subscription.unsubscribe(); };
  }, [sb]);
  return {
    ready, cf: false, loading, admin, user: user ? { email: user.email || "" } : null,
    async sendCode(email) { const { error } = await sb!.auth.signInWithOtp({ email, options: { shouldCreateUser: true } }); if (error) throw new Error("Couldn't send a code. Wait a minute and try again."); },
    async verify(email, code) { const { error } = await sb!.auth.verifyOtp({ email, token: code, type: "email" }); if (error) throw new Error("That code is wrong or has expired."); },
    async signOut() { await sb!.auth.signOut(); },
    async load() {
      const [o, p] = await Promise.all([
        sb!.from("orders").select("*").order("created_at", { ascending: false }).limit(1000),
        sb!.from("profiles").select("*").order("created_at", { ascending: false }).limit(2000),
      ]);
      if (o.error || p.error) throw new Error(`${(o.error || p.error)!.message}. Check that schema.sql has been run.`);
      return { orders: o.data as Order[], profiles: p.data as Profile[] };
    },
    async call(body) {
      const { data } = await sb!.auth.getSession();
      return post(`${url.replace(/\/+$/, "")}/functions/v1/shop/admin`, body, { apikey: key, Authorization: `Bearer ${data.session?.access_token || ""}` });
    },
  };
}

/** Cloudflare Worker: the Worker signs a session token after the email code; kept on this device. */
function useWorkerOwner(content: any, on: boolean): Owner {
  const base = String(content?.backend?.workerUrl || "").replace(/\/+$/, "");
  const ready = on && /^https:\/\/\S+$/.test(base);
  const KEY = `shop-admin-cf:${basePath()}`;
  const [token, setTokenState] = useState<string | null>(() => { try { return localStorage.getItem(KEY); } catch { return null; } });
  const [user, setUser] = useState<OwnerUser | null>(null);
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [challenge, setChallenge] = useState("");
  const setToken = (t: string | null) => { setTokenState(t); try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch { /* private mode */ } };
  const auth = (t: string | null): Record<string, string> => (t ? { Authorization: `Bearer ${t}` } : {});
  useEffect(() => {
    if (!ready || !token) { setUser(null); setAdmin(null); setLoading(false); return; }
    let live = true;
    setLoading(true);
    post(`${base}/me`, {}, auth(token))
      .then((r) => { if (live) { setUser({ email: r.user.email }); setAdmin(!!r.admin); } })
      .catch((e) => { if (live) { if (e.status === 401) setToken(null); setUser(null); setAdmin(null); } })
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [ready, base, token]);
  return {
    ready, cf: true, loading, user, admin,
    async sendCode(email) { setChallenge((await post(`${base}/auth-send`, { email }, {})).challenge); },
    async verify(_email, code) { const r = await post(`${base}/auth-verify`, { challenge, code, admin: true }, {}); setUser({ email: r.user.email }); setAdmin(!!r.admin); setToken(r.token); },
    async signOut() { setToken(null); },
    async load() { const r = await post(`${base}/admin-data`, {}, auth(token)); return { orders: r.orders, profiles: r.customers }; },
    async call(body) { return post(`${base}/admin`, body, auth(token)); },
  };
}

function useOwner(content: any): Owner {
  const on = !!content?.backend?.enabled;
  const cf = content?.backend?.provider === "cloudflare";
  const s = useSupabaseOwner(content, on && !cf);
  const w = useWorkerOwner(content, on && cf);
  return cf ? w : s;
}

function OwnerGate({ content, children }: { content: any; children: (o: Owner) => ReactNode }) {
  const o = useOwner(content);
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!o.ready) return <section className="card p-5 text-sm text-ink-300">Switch on the shop backend under <b className="text-ink-100">Accounts & backend</b>, choose Supabase or Cloudflare, add its {o.cf ? "Worker URL" : "Project URL and public key"}, then save. Orders and customers appear here once it's connected.</section>;
  if (o.loading) return <Spinner label="Connecting to the shop backend…" />;
  if (!o.user) {
    return (
      <section className="card flex max-w-lg flex-col gap-4 p-5">
        <h3 className="text-[15px] font-extrabold">Sign in to the shop backend</h3>
        <p className="text-sm text-ink-300">{step === "email" ? (o.cf ? "Use the owner email set as OWNER_EMAIL (or in ADMIN_EMAILS) on your Cloudflare Worker. We'll send a 6-digit code." : "Use the owner email you added to shop_admins in Supabase. We'll send a 6-digit code.") : <>Enter the code sent to <b className="text-ink-100">{email}</b>.</>}</p>
        <form className="flex flex-col gap-3" onSubmit={async (e) => {
          e.preventDefault(); setErr(""); setBusy(true);
          try {
            if (step === "email") { await o.sendCode(email.trim().toLowerCase()); setStep("code"); }
            else { await o.verify(email.trim().toLowerCase(), code.trim()); toast("Signed in to the shop backend"); }
          } catch (x: any) { setErr(x.message); }
          setBusy(false);
        }}>
          {step === "email"
            ? <Field label="Owner email" htmlFor="ow-email"><input id="ow-email" className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            : <Field label="6-digit code" htmlFor="ow-code"><input id="ow-code" className="input font-mono tracking-[.3em]" inputMode="numeric" maxLength={6} required autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} /></Field>}
          <p role="alert" className="text-sm text-red-300">{err}</p>
          <div className="flex gap-2">
            <button className="btn btn-pri" disabled={busy}>{busy ? "Working…" : step === "email" ? "Send code" : "Sign in"}</button>
            {step === "code" && <button type="button" className="btn btn-ghost" onClick={() => { setStep("email"); setCode(""); }}>Use a different email</button>}
          </div>
        </form>
      </section>
    );
  }
  if (!o.admin) {
    return (
      <section className="card flex max-w-xl flex-col gap-3 p-5">
        <h3 className="text-[15px] font-extrabold">{o.user.email} isn't a shop admin</h3>
        {o.cf
          ? <p className="text-sm text-ink-300">In Cloudflare, open your Worker → Settings → Variables and Secrets, and add this email to <b className="text-ink-100">ADMIN_EMAILS</b> (comma-separated), or set it as OWNER_EMAIL. Then sign out and sign in again.</p>
          : <><p className="text-sm text-ink-300">In Supabase, open the SQL Editor and run this line, then reload:</p>
            <code className="block overflow-x-auto rounded-lg bg-ink-950 p-3 font-mono text-xs">insert into public.shop_admins (email) values ('{o.user.email}') on conflict do nothing;</code></>}
        <button className="btn self-start" onClick={() => o.signOut()}>Sign out</button>
      </section>
    );
  }
  return <>{children(o)}</>;
}

function useData(o: Owner) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [err, setErr] = useState("");
  const latest = useRef(o);
  latest.current = o;
  const load = useCallback(async () => {
    setErr("");
    try { const r = await latest.current.load(); setOrders(r.orders); setProfiles(r.profiles); }
    catch (e: any) { setErr(e.message); }
  }, [o.user?.email, o.cf]);
  useEffect(() => { load(); }, [load]);
  return { orders, profiles, err, load, setOrders };
}

function waText(o: Order, shop: string) {
  const m: Record<string, string> = {
    pending: `we've received your order ${o.order_no} and are waiting for your payment of ${money(o.totals.total, o.currency)}.`,
    processing: `your order ${o.order_no} is confirmed and being packed.`,
    shipped: `good news: your order ${o.order_no} has shipped.`,
    delivered: `your order ${o.order_no} has been delivered. Thank you for shopping with us!`,
    cancelled: `your order ${o.order_no} has been cancelled. Reply here if you have questions.`,
  };
  return `Hi ${o.name}, ${m[o.status] || `about your order ${o.order_no}.`}\n— ${shop}`;
}

function OrderRow({ o, shop, call, onChange, profile }: { o: Order; shop: string; call: (b: any) => Promise<any>; onChange: (o: Order) => void; profile?: Profile }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ref, setRef] = useState(o.payment_ref || "");
  const reported = o.payment_status === "unpaid" && (o.method === "upi" || o.method === "paypal") && !!o.payment_ref;
  const act = async (body: any, ok: string) => {
    setBusy(true);
    try { const r = await call({ ...body, order_no: o.order_no }); onChange(r.order); toast(ok); } catch (e: any) { toast(e.message, "bad"); }
    setBusy(false);
  };
  const phone = digits(o.phone);
  const addr = [o.address?.address, [o.address?.city, o.address?.pin].filter(Boolean).join(" "), o.address?.state].filter(Boolean).join(", ");
  return (
    <div className="overflow-hidden rounded-xl border border-ink-600 bg-ink-950">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-3 text-left sm:grid-cols-[150px_minmax(0,1fr)_auto_auto_auto]">
        <span className="font-mono text-[13px] font-semibold">{o.order_no}</span>
        <span className="min-w-0 truncate text-sm">{o.name} <span className="text-ink-400">· {o.email}</span></span>
        <span className="font-bold tabular-nums sm:text-right">{money(o.totals.total, o.currency)}</span>
        <span className={`chip ${reported ? "border-amber-300 bg-amber-400/10 text-amber-100" : pill(o.payment_status)}`}>{reported ? "Check payment" : PAY_LABEL[o.payment_status] || o.payment_status}</span>
        <span className={`chip ${pill(o.status)}`}>{STATUS_LABEL[o.status] || o.status}</span>
      </button>
      {open && (
        <div className="grid gap-4 border-t border-ink-700 p-4 lg:grid-cols-2">
          <div className="flex flex-col gap-2 text-sm">
            <div className="text-xs text-ink-400">{fmtDate(o.created_at)} · {o.method.toUpperCase()}{o.payment_ref ? ` · ref ${o.payment_ref}` : ""}{o.paid_at ? ` · paid ${fmtDate(o.paid_at)}` : ""}</div>
            <ul className="flex flex-col gap-1">{o.items.map((i, k) => <li key={k} className="flex justify-between gap-3"><span>{i.name}{i.opt ? <span className="text-ink-400"> ({i.opt})</span> : null} × {i.qty}</span><span className="tabular-nums">{money(i.price * i.qty, o.currency)}</span></li>)}</ul>
            <div className="mt-1 flex justify-between border-t border-ink-700 pt-2 text-ink-300"><span>Shipping</span><span className="tabular-nums">{o.totals.ship ? money(o.totals.ship, o.currency) : "Free"}</span></div>
            <div className="flex justify-between font-bold"><span>Total</span><span className="tabular-nums">{money(o.totals.total, o.currency)}</span></div>
          </div>
          <div className="flex flex-col gap-2 text-sm">
            <div><b>{o.name}</b>{profile ? <span className="ml-2 chip">{profile.account_no}</span> : <span className="ml-2 text-xs text-ink-400">guest</span>}</div>
            <div className="text-ink-300">{o.email}{o.phone ? ` · ${o.phone}` : ""}</div>
            {addr && <div className="text-ink-300">{addr}</div>}
            {o.notes && <div className="rounded-lg bg-ink-850 p-2 text-ink-200">“{o.notes}”</div>}
            <div className="text-xs text-ink-500">{o.notify_log?.length ? `Emails: ${o.notify_log.map((l) => `${l.what}${l.ok ? "" : " (failed)"}`).join(", ")}` : "No emails sent yet"}</div>
          </div>
          <div className="flex flex-col gap-3 border-t border-ink-700 pt-3 lg:col-span-2 lg:flex-row lg:flex-wrap lg:items-end">
            <Field label="Status" htmlFor={`st-${o.order_no}`}>
              <select id={`st-${o.order_no}`} className="input py-2" disabled={busy} value={o.status} onChange={(e) => act({ action: "set-status", status: e.target.value }, "Status updated")}>
                {STATUS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </Field>
            {reported && <p className="w-full rounded-lg border border-amber-400/40 bg-amber-400/5 px-3 py-2 text-[13px] text-amber-100 lg:basis-full">The customer says they paid and sent reference <b className="font-mono">{o.payment_ref}</b>. Find it in your {o.method === "upi" ? "UPI" : "PayPal"} app; if the amount is {money(o.totals.total, o.currency)}, tap Mark paid.</p>}
            {o.payment_status === "unpaid" && (
              <div className="flex items-end gap-2">
                <Field label="Payment reference (optional)" htmlFor={`ref-${o.order_no}`}><input id={`ref-${o.order_no}`} className="input py-2" placeholder="UPI ref no." value={ref} onChange={(e) => setRef(e.target.value)} /></Field>
                <button type="button" className="btn btn-pri" disabled={busy} onClick={() => act({ action: "mark-paid", ref }, "Marked paid. Emails sent.")}>Mark paid</button>
              </div>
            )}
            <div className="flex flex-wrap gap-2 lg:ml-auto">
              {phone && <a className="btn" href={`https://wa.me/${phone}?text=${encodeURIComponent(waText(o, shop))}`} target="_blank" rel="noopener">WhatsApp customer</a>}
              <a className="btn" href={`mailto:${o.email}?subject=${encodeURIComponent(`Your order ${o.order_no}`)}`}>Email customer</a>
            </div>
          </div>
          <p className="hint lg:col-span-2">Shipped, Delivered and Cancelled email the customer automatically. Mark paid emails both of you.</p>
        </div>
      )}
    </div>
  );
}

export function OrdersPanel({ content }: { content: any }) {
  return (
    <OwnerGate content={content}>
      {(o) => <Orders o={o} shop={content?.brand?.name || "Shop"} />}
    </OwnerGate>
  );
}

function Orders({ o: owner, shop }: { o: Owner; shop: string }) {
  const { orders, profiles, err, load, setOrders } = useData(owner);
  const call = owner.call, email = owner.user?.email || "";
  const [q, setQ] = useState("");
  const [st, setSt] = useState("");
  const [pay, setPay] = useState("");
  const byUser = useMemo(() => new Map((profiles || []).map((p) => [p.id, p])), [profiles]);
  const byEmail = useMemo(() => new Map((profiles || []).map((p) => [p.email.toLowerCase(), p])), [profiles]);
  if (err) return <section className="card p-5 text-sm text-red-300">Couldn't load orders: {err}</section>;
  if (!orders) return <Spinner label="Loading orders…" />;
  const prof = (o: Order) => (o.user_id && byUser.get(o.user_id)) || byEmail.get(o.email.toLowerCase());
  const s = q.trim().toLowerCase();
  const list = orders.filter((o) => (!st || o.status === st) && (!pay || o.payment_status === pay)
    && (!s || `${o.order_no} ${o.name} ${o.email} ${o.phone} ${prof(o)?.account_no || ""}`.toLowerCase().includes(s)));
  const month = new Date().toISOString().slice(0, 7);
  const stats = [
    { n: orders.filter((o) => o.created_at.slice(0, 10) === new Date().toISOString().slice(0, 10)).length, l: "Orders today" },
    { n: orders.filter((o) => o.payment_status === "unpaid" && o.status !== "cancelled").length, l: "Awaiting payment" },
    { n: orders.filter((o) => o.status === "processing").length, l: "To pack and ship" },
    { n: money(orders.filter((o) => o.payment_status === "paid" && (o.paid_at || o.created_at).slice(0, 7) === month).reduce((t, o) => t + o.totals.total, 0), orders[0]?.currency || "INR"), l: "Paid this month" },
  ];
  return (
    <>
      <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-ink-700 md:grid-cols-4">
        {stats.map((x) => <div key={x.l} className="border-b border-r border-ink-700 bg-ink-900 px-4 py-3 md:border-b-0"><div className="font-display text-2xl font-extrabold tabular-nums">{x.n}</div><div className="text-xs text-ink-400">{x.l}</div></div>)}
      </div>
      <div className="flex flex-wrap gap-2">
        <input className="input max-w-xs py-2" type="search" aria-label="Search orders" placeholder="Order no, name, email or account no" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input w-auto py-2" aria-label="Status" value={st} onChange={(e) => setSt(e.target.value)}><option value="">Any status</option>{STATUS.map((x) => <option key={x} value={x}>{STATUS_LABEL[x]}</option>)}</select>
        <select className="input w-auto py-2" aria-label="Payment" value={pay} onChange={(e) => setPay(e.target.value)}><option value="">Any payment</option>{Object.entries(PAY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <button type="button" className="btn" onClick={load}>Refresh</button>
      </div>
      <p className="text-xs text-ink-400">{list.length} of {orders.length} orders · signed in as {email}</p>
      <div className="flex flex-col gap-2">
        {list.length ? list.map((o) => <OrderRow key={o.order_no} o={o} shop={shop} call={call} profile={prof(o)} onChange={(n) => setOrders((all) => (all || []).map((x) => (x.order_no === n.order_no ? n : x)))} />)
          : <p className="card p-5 text-sm text-ink-300">{orders.length ? "No orders match." : "No orders yet. They appear here as soon as customers check out."}</p>}
      </div>
      <button type="button" className="btn btn-ghost btn-sm self-start" onClick={() => owner.signOut()}>Sign out of the shop backend</button>
    </>
  );
}

export function CustomersPanel({ content }: { content: any }) {
  return <OwnerGate content={content}>{(o) => <Customers o={o} shop={content?.brand?.name || "Shop"} />}</OwnerGate>;
}

function Customers({ o: owner, shop }: { o: Owner; shop: string }) {
  const { orders, profiles, err, load, setOrders } = useData(owner);
  const call = owner.call;
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  if (err) return <section className="card p-5 text-sm text-red-300">Couldn't load customers: {err}</section>;
  if (!orders || !profiles) return <Spinner label="Loading customers…" />;
  const ordersOf = (p: Profile) => orders.filter((o) => o.user_id === p.id || o.email.toLowerCase() === p.email.toLowerCase());
  const s = q.trim().toLowerCase();
  const list = profiles.filter((p) => !s || `${p.account_no} ${p.email} ${p.name} ${p.phone}`.toLowerCase().includes(s));
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <input className="input max-w-sm py-2" type="search" aria-label="Search customers" placeholder="Account no, email, name or phone" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" className="btn" onClick={load}>Refresh</button>
      </div>
      <p className="text-xs text-ink-400">{list.length} of {profiles.length} signed-up customers. Guest orders show under Orders.</p>
      <div className="overflow-x-auto rounded-xl border border-ink-700">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-ink-900 text-xs uppercase tracking-wider text-ink-400"><tr><th className="px-3 py-2.5">Account</th><th className="px-3 py-2.5">Customer</th><th className="px-3 py-2.5">Joined</th><th className="px-3 py-2.5 text-right">Orders</th><th className="px-3 py-2.5 text-right">Paid total</th></tr></thead>
          <tbody>
            {list.map((p) => {
              const os = ordersOf(p), spent = os.filter((o) => o.payment_status === "paid" || (o.payment_status === "cod" && o.status === "delivered")).reduce((t, o) => t + o.totals.total, 0);
              return [
                <tr key={p.id} className="cursor-pointer border-t border-ink-700 hover:bg-ink-900" onClick={() => setOpen(open === p.id ? null : p.id)}>
                  <td className="px-3 py-2.5 font-mono text-[13px]"><button type="button" aria-expanded={open === p.id} className="font-semibold">{p.account_no}</button></td>
                  <td className="px-3 py-2.5"><div className="font-semibold">{p.name || "No name yet"}</div><div className="text-xs text-ink-400">{p.email}{p.phone ? ` · ${p.phone}` : ""}</div></td>
                  <td className="px-3 py-2.5 text-ink-300">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{os.length}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{money(spent, os[0]?.currency || "INR")}</td>
                </tr>,
                open === p.id && (
                  <tr key={p.id + "-o"} className="border-t border-ink-700 bg-ink-900/60"><td colSpan={5} className="px-3 py-3">
                    <div className="flex flex-col gap-2">
                      {p.address?.address && <div className="text-xs text-ink-400">Address: {[p.address.address, p.address.city, p.address.pin, p.address.state].filter(Boolean).join(", ")}</div>}
                      {os.length ? os.map((o) => <OrderRow key={o.order_no} o={o} shop={shop} call={call} profile={p} onChange={(n) => setOrders((all) => (all || []).map((x) => (x.order_no === n.order_no ? n : x)))} />) : <p className="text-sm text-ink-300">No orders yet.</p>}
                    </div>
                  </td></tr>
                ),
              ];
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
