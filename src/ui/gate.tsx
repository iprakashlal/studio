import { useEffect, useRef, useState, type ReactNode } from "react";
import { pwScore, pwStrongEnough, seal, unseal, type Sealed } from "../lib/crypto";
import { detectRepo, device, session as sess, type Session } from "../lib/auth";
import { GitHubRepo, explain } from "../lib/repo";
import { Field, Logo, useConfirm, useToast } from "./kit";

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
        <div className="mb-5 flex items-center gap-2.5 font-extrabold"><Logo />{brand}</div>
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
