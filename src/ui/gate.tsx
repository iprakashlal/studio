import { useEffect, useRef, useState, type ReactNode } from "react";
import { pwScore, pwStrongEnough, seal, unseal, type Sealed } from "../lib/crypto";
import { detectRepo, device, session as sess, type Session } from "../lib/auth";
import { GitHubRepo, explain } from "../lib/repo";
import { Field, Logo, useConfirm, useToast } from "./kit";
import { LINK_MINUTES, joinBlob, makeDeviceLink, openDeviceLink } from "../lib/devicelink";
import qrcode from "qrcode-generator";
import { BrandMark } from "../lib/brand";

function Meter({ value }: { value: string }) {
  const s = pwScore(value);
  const w = value ? [10, 30, 55, 80, 100][s] : 0;
  const c = ["bg-red-400", "bg-red-400", "bg-amber-400", "bg-emerald-400", "bg-emerald-400"][s];
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-700"><div className={`h-full ${c} transition-all`} style={{ width: `${w}%` }} /></div>
      <span className="w-20 text-right text-xs text-ink-400">{value ? ["Too weak", "Weak", "Fair", "Strong", "Very strong"][s] : ""}</span>
    </div>
  );
}

function Shell({ title, brand, children, footer }: { title: string; brand: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-[radial-gradient(900px_520px_at_85%_-10%,rgba(91,124,255,.18),transparent_60%)] px-4 py-10">
      <div className="card w-full max-w-[460px] p-7 shadow-2xl sm:p-8">
        <div className="mb-5 flex items-center gap-2.5 font-extrabold"><BrandMark fallback={<Logo />} />{brand}</div>
        <h1 className="font-display text-2xl font-extrabold">{title}</h1>
        <div className="mt-4 flex flex-col gap-4">{children}</div>
        {footer && <div className="mt-5 border-t border-ink-700 pt-4">{footer}</div>}
      </div>
    </div>
  );
}

/**
 * Sign-in for the Studio and for exported sites. The GitHub token is encrypted with the
 * password and kept on this device only; nothing about the login goes into a repository.
 */
export function Gate({ ns, brand, repoNoun, defaultRepo = "", tokenHint, onAuthed, onDemo, footer }: {
  ns: string;
  brand: string;
  repoNoun: string;
  defaultRepo?: string;
  tokenHint: string;
  onAuthed: (s: Session) => void;
  onDemo?: () => void;
  footer?: ReactNode;
}) {
  const [sealed, setSealed] = useState<Sealed | null>(() => device.load(ns));
  const [blob, setBlob] = useState(joinBlob);
  if (blob) return <Join ns={ns} brand={brand} blob={blob} hasLogin={!!sealed} onAuthed={onAuthed} onCancel={() => { history.replaceState(null, "", location.pathname + location.search); setBlob(""); }} footer={footer} />;
  return sealed
    ? <Login ns={ns} brand={brand} sealed={sealed} onAuthed={onAuthed} onReset={() => { device.clear(ns); setSealed(null); }} footer={footer} />
    : <Setup ns={ns} brand={brand} repoNoun={repoNoun} defaultRepo={defaultRepo} tokenHint={tokenHint} onAuthed={onAuthed} onDemo={onDemo} footer={footer} />;
}

function Setup({ ns, brand, repoNoun, defaultRepo, tokenHint, onAuthed, onDemo, footer }: { ns: string; brand: string; repoNoun: string; defaultRepo: string; tokenHint: string; onAuthed: (s: Session) => void; onDemo?: () => void; footer?: ReactNode }) {
  const d = detectRepo(defaultRepo);
  const [f, setF] = useState({ owner: d.owner, repo: defaultRepo || d.repo, branch: "main", token: "", user: "", pw: "", pw2: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (f.user.trim().length < 3) return setErr("Username needs at least 3 characters.");
    if (!pwStrongEnough(f.pw)) return setErr("Choose a stronger password: at least 12 characters, mixing words, numbers or symbols.");
    if (f.pw !== f.pw2) return setErr("The passwords don't match.");
    const cfg = { owner: f.owner.trim(), repo: f.repo.trim(), branch: f.branch.trim() || "main" };
    setBusy(true);
    try {
      await new GitHubRepo(cfg, f.token.trim()).check();
      const s = await seal(cfg, f.user.trim(), f.pw, f.token.trim());
      if (!device.save(ns, s)) throw new Error("This browser blocked local storage. Allow site data for this page and try again.");
      const session: Session = { cfg, token: f.token.trim(), username: f.user.trim() };
      sess.save(ns, session);
      onAuthed(session);
    } catch (x) {
      setErr(explain(x));
      setBusy(false);
    }
  };
  return (
    <Shell brand={brand} title="Set up this device" footer={footer}>
      <p className="text-sm text-ink-300">Connect the {repoNoun} on GitHub and choose a login. Your token is encrypted with your password and kept only in this browser.</p>
      <form onSubmit={submit} className="flex flex-col gap-3.5" autoComplete="off">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="GitHub username" htmlFor="g-owner"><input id="g-owner" className="input" required value={f.owner} onChange={set("owner")} /></Field>
          <Field label="Repository" htmlFor="g-repo"><input id="g-repo" className="input" required value={f.repo} onChange={set("repo")} /></Field>
        </div>
        <Field label="Branch" htmlFor="g-branch"><input id="g-branch" className="input" required value={f.branch} onChange={set("branch")} /></Field>
        <Field label="GitHub access token" htmlFor="g-token" hint={tokenHint}><input id="g-token" className="input font-mono text-[13px]" type="password" required autoComplete="off" spellCheck={false} value={f.token} onChange={set("token")} /></Field>
        <Field label="Your username" htmlFor="g-user"><input id="g-user" className="input" required minLength={3} autoComplete="username" value={f.user} onChange={set("user")} /></Field>
        <Field label="Password" htmlFor="g-pw"><input id="g-pw" className="input" type="password" required autoComplete="new-password" value={f.pw} onChange={set("pw")} /><Meter value={f.pw} /></Field>
        <Field label="Confirm password" htmlFor="g-pw2"><input id="g-pw2" className="input" type="password" required autoComplete="new-password" value={f.pw2} onChange={set("pw2")} /></Field>
        <p role="alert" className="min-h-[1.25em] text-sm text-red-300">{err}</p>
        <button className="btn btn-pri" disabled={busy}>{busy ? "Connecting…" : "Connect this device"}</button>
      </form>
      {onDemo && <button type="button" className="btn btn-ghost" onClick={onDemo}>Try a demo first (nothing is saved)</button>}
    </Shell>
  );
}

/** Opened from "Sign in on another device": enter the code shown there, then choose this device's password. */
function Join({ ns, brand, blob, hasLogin, onAuthed, onCancel, footer }: { ns: string; brand: string; blob: string; hasLogin: boolean; onAuthed: (s: Session) => void; onCancel: () => void; footer?: ReactNode }) {
  const [code, setCode] = useState("");
  const [got, setGot] = useState<Session | null>(null);
  const [f, setF] = useState({ user: "", pw: "", pw2: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const fails = useRef(0);
  const check = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    const r = await openDeviceLink(blob, code);
    setBusy(false);
    if (typeof r === "string") { fails.current++; setErr(r); return; }
    setGot(r); setF({ ...f, user: r.username });
  };
  const finish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!got) return;
    setErr("");
    if (f.user.trim().length < 3) return setErr("Username needs at least 3 characters.");
    if (!pwStrongEnough(f.pw)) return setErr("Choose a stronger password: at least 12 characters, mixing words, numbers or symbols.");
    if (f.pw !== f.pw2) return setErr("The passwords don't match.");
    setBusy(true);
    try {
      await new GitHubRepo(got.cfg, got.token).check();
      if (!device.save(ns, await seal(got.cfg, f.user.trim(), f.pw, got.token))) throw new Error("This browser blocked local storage. Allow site data for this page and try again.");
      const s: Session = { ...got, username: f.user.trim() };
      sess.save(ns, s);
      history.replaceState(null, "", location.pathname + location.search + "#/");
      onAuthed(s);
    } catch (x) { setErr(explain(x)); setBusy(false); }
  };
  if (!got) return (
    <Shell brand={brand} title="Sign in with your other device" footer={footer}>
      <p className="text-sm text-ink-300">Type the code shown on the device that made this link (Settings → Sign in on another device).</p>
      {hasLogin && <p className="rounded-lg border border-amber-400/40 bg-amber-400/5 px-3 py-2.5 text-[13px] text-amber-100">This browser already has a login. Continuing replaces it.</p>}
      <form onSubmit={check} className="flex flex-col gap-3.5" autoComplete="off">
        <Field label="Code" htmlFor="j-code"><input id="j-code" className="input text-center font-mono text-lg uppercase tracking-[.25em]" autoFocus required placeholder="XXXX-XXXX-XXXX" autoCapitalize="characters" spellCheck={false} value={code} onChange={(e) => setCode(e.target.value)} /></Field>
        <p role="alert" className="min-h-[1.25em] text-sm text-red-300">{err}</p>
        <button className="btn btn-pri" disabled={busy || fails.current >= 8}>{busy ? "Checking…" : "Continue"}</button>
      </form>
      <button type="button" className="btn btn-ghost btn-sm self-start" onClick={onCancel}>Set up with a GitHub token instead</button>
    </Shell>
  );
  return (
    <Shell brand={brand} title="Choose this device's login" footer={footer}>
      <p className="text-sm text-ink-300">Connected to <b className="text-ink-100">{got.cfg.owner}/{got.cfg.repo}</b>. Pick the username and password you'll type on this device. The GitHub token is encrypted with it and kept only in this browser.</p>
      <form onSubmit={finish} className="flex flex-col gap-3.5" autoComplete="off">
        <Field label="Your username" htmlFor="j-user"><input id="j-user" className="input" required minLength={3} autoComplete="username" value={f.user} onChange={(e) => setF({ ...f, user: e.target.value })} /></Field>
        <Field label="Password" htmlFor="j-pw"><input id="j-pw" className="input" type="password" required autoComplete="new-password" value={f.pw} onChange={(e) => setF({ ...f, pw: e.target.value })} /><Meter value={f.pw} /></Field>
        <Field label="Confirm password" htmlFor="j-pw2"><input id="j-pw2" className="input" type="password" required autoComplete="new-password" value={f.pw2} onChange={(e) => setF({ ...f, pw2: e.target.value })} /></Field>
        <p role="alert" className="min-h-[1.25em] text-sm text-red-300">{err}</p>
        <button className="btn btn-pri" disabled={busy}>{busy ? "Connecting…" : "Finish signing in"}</button>
      </form>
    </Shell>
  );
}

/** Makes a link + code that signs another phone or computer in to this same login. */
function DeviceLinkCard({ session }: { session: Session }) {
  const toast = useToast();
  const [l, setL] = useState<{ code: string; url: string; expires: number } | null>(null);
  const [left, setLeft] = useState(0);
  const qr = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!l) return;
    const t = setInterval(() => { const s = Math.max(0, Math.round((l.expires - Date.now()) / 1000)); setLeft(s); if (!s) setL(null); }, 1000);
    return () => clearInterval(t);
  }, [l]);
  useEffect(() => {
    if (!l || !qr.current) return;
    try { const q = qrcode(0, "M"); q.addData(l.url); q.make(); qr.current.innerHTML = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); } catch { /* the link and code still work */ }
  }, [l]);
  const copy = (t: string, what: string) => { try { navigator.clipboard.writeText(t).then(() => toast(`${what} copied`)); } catch { toast(t); } };
  return (
    <section className="card flex flex-col gap-3 p-5">
      <h3 className="text-[15px] font-extrabold">Sign in on another device</h3>
      <p className="text-sm text-ink-300">Opens this same login on your phone or another computer, without copying the GitHub token. Scan the QR code or open the link there, then type the code. The link works for {LINK_MINUTES} minutes, and only together with the code.</p>
      {!l ? <button type="button" className="btn btn-pri self-start" onClick={async () => setL(await makeDeviceLink(session))}>Make a sign-in link</button> : (
        <div className="flex flex-wrap items-start gap-5">
          <div ref={qr} className="h-[200px] w-[200px] flex-none rounded-xl bg-white p-2.5 [&>svg]:h-full [&>svg]:w-full" role="img" aria-label="QR code for the sign-in link" />
          <div className="flex min-w-[220px] flex-1 flex-col gap-3">
            <div><div className="label">Code</div><div className="mt-1 font-mono text-2xl font-bold tracking-[.18em] text-ink-100">{l.code}</div></div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-sm" onClick={() => copy(l.url, "Link")}>Copy link</button>
              <button type="button" className="btn btn-sm" onClick={() => setL(null)}>Cancel</button>
            </div>
            <p className="hint">Expires in {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}. Send the link and the code separately, or just type the code on the other device. Anyone with both could sign in, so don't post them together.</p>
          </div>
        </div>
      )}
    </section>
  );
}

function Login({ ns, brand, sealed, onAuthed, onReset, footer }: { ns: string; brand: string; sealed: Sealed; onAuthed: (s: Session) => void; onReset: () => void; footer?: ReactNode }) {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const [wait, setWait] = useState(0);
  const fails = useRef(0);
  const confirm = useConfirm();
  useEffect(() => {
    if (!wait) return;
    const t = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (wait) return;
    setErr("");
    const ok = await unseal(sealed, p);
    if (ok && ok.username === u.trim()) {
      const s: Session = { cfg: { owner: sealed.owner, repo: sealed.repo, branch: sealed.branch }, token: ok.token, username: ok.username };
      sess.save(ns, s);
      onAuthed(s);
    } else {
      fails.current++;
      const w = Math.min(30, 2 ** fails.current);
      setWait(w);
      setErr("That username and password don't match.");
    }
  };
  return (
    <Shell brand={brand} title="Sign in" footer={footer}>
      <p className="text-sm text-ink-300">Connected to <b className="text-ink-100">{sealed.owner}/{sealed.repo}</b>.</p>
      <form onSubmit={submit} className="flex flex-col gap-3.5">
        <Field label="Username" htmlFor="l-user"><input id="l-user" className="input" autoFocus required autoComplete="username" value={u} onChange={(e) => setU(e.target.value)} /></Field>
        <Field label="Password" htmlFor="l-pw"><input id="l-pw" className="input" type="password" required autoComplete="current-password" value={p} onChange={(e) => setP(e.target.value)} /></Field>
        <p role="alert" className="min-h-[1.25em] text-sm text-red-300">{err}{wait ? ` Try again in ${wait} s.` : ""}</p>
        <button className="btn btn-pri" disabled={!!wait}>Sign in</button>
      </form>
      <button type="button" className="btn btn-ghost btn-sm self-start" onClick={async () => { if (await confirm("Reset this device?", "This removes the encrypted login from this browser. You'll set it up again with a GitHub token. Nothing in the repository changes.", "Reset", true)) onReset(); }}>Forgot password? Reset this device</button>
    </Shell>
  );
}

/** Change username, password or token for the login stored on this device. */
export function AccountPanel({ ns, session, onUpdated, onSignOut, onForget }: { ns: string; session: Session; onUpdated: (s: Session) => void; onSignOut: () => void; onForget: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [f, setF] = useState({ user: session.username, pw: "", pw2: "", token: "", cur: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (f.user.trim().length < 3) return setErr("Username needs at least 3 characters.");
    if (f.pw && !pwStrongEnough(f.pw)) return setErr("Choose a stronger password: at least 12 characters, mixing words, numbers or symbols.");
    if (f.pw !== f.pw2) return setErr("The new passwords don't match.");
    const s0 = device.load(ns);
    if (!s0) return setErr("No login is stored on this device.");
    setBusy(true);
    const ok = await unseal(s0, f.cur);
    if (!ok) { setBusy(false); return setErr("Current password is incorrect."); }
    try {
      const token = f.token.trim() || ok.token;
      if (f.token.trim()) await new GitHubRepo(session.cfg, token).check();
      device.save(ns, await seal(session.cfg, f.user.trim(), f.pw || f.cur, token));
      const next = { ...session, token, username: f.user.trim() };
      sess.save(ns, next);
      onUpdated(next);
      setF({ user: next.username, pw: "", pw2: "", token: "", cur: "" });
      toast("Login updated on this device");
    } catch (x) {
      setErr(explain(x));
    }
    setBusy(false);
  };
  return (
    <>
      <section className="card flex flex-col gap-4 p-5">
        <h3 className="text-[15px] font-extrabold">Login on this device</h3>
        <form onSubmit={submit} className="flex flex-col gap-3.5" autoComplete="off">
          <Field label="Username" htmlFor="a-user"><input id="a-user" className="input" value={f.user} onChange={set("user")} autoComplete="username" /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="New password" htmlFor="a-pw" hint="Leave empty to keep the current one."><input id="a-pw" className="input" type="password" value={f.pw} onChange={set("pw")} autoComplete="new-password" />{f.pw && <Meter value={f.pw} />}</Field>
            <Field label="Confirm new password" htmlFor="a-pw2"><input id="a-pw2" className="input" type="password" value={f.pw2} onChange={set("pw2")} autoComplete="new-password" /></Field>
          </div>
          <Field label="New GitHub token" htmlFor="a-token" hint="Only when your token expires or you rotate it."><input id="a-token" className="input font-mono text-[13px]" type="password" value={f.token} onChange={set("token")} spellCheck={false} /></Field>
          <Field label="Current password" htmlFor="a-cur"><input id="a-cur" className="input" type="password" required value={f.cur} onChange={set("cur")} autoComplete="current-password" /></Field>
          <p role="alert" className="min-h-[1.25em] text-sm text-red-300">{err}</p>
          <button className="btn btn-pri self-start" disabled={busy}>{busy ? "Updating…" : "Update login"}</button>
        </form>
      </section>
      <DeviceLinkCard session={session} />
      <section className="card flex flex-col gap-3 p-5">
        <h3 className="text-[15px] font-extrabold">Session</h3>
        <p className="text-sm text-ink-300">Connected to <b className="text-ink-100">{session.cfg.owner}/{session.cfg.repo}</b> on <b className="text-ink-100">{session.cfg.branch}</b>. You're signed out after 30 minutes without activity.</p>
        <div className="flex flex-wrap gap-2">
          <a className="btn" href={`https://github.com/${encodeURIComponent(session.cfg.owner)}/${encodeURIComponent(session.cfg.repo)}/commits`} target="_blank" rel="noopener">Change history on GitHub ↗</a>
          <button type="button" className="btn" onClick={onSignOut}>Sign out</button>
          <button type="button" className="btn btn-danger" onClick={async () => { if (await confirm("Remove login from this device?", "You'll need a GitHub token to set this device up again.", "Remove", true)) onForget(); }}>Remove login from this device</button>
        </div>
      </section>
    </>
  );
}
