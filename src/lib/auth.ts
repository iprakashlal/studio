// Where the encrypted login lives on this device, plus a short-lived session.
// Keys include the page's base path so sites sharing one github.io origin stay separate.

import type { RepoCfg, Sealed } from "./crypto";
import { basePath } from "./util";

export type Session = { cfg: RepoCfg; token: string; username: string };

const IDLE_MS = 30 * 60 * 1000;
const key = (ns: string) => `${ns}:${basePath()}`;

export const device = {
  load(ns: string): Sealed | null {
    try {
      const s = JSON.parse(localStorage.getItem(key(ns)) || "null");
      return s && s.data && s.salt ? s : null;
    } catch {
      return null;
    }
  },
  save(ns: string, s: Sealed): boolean {
    try {
      localStorage.setItem(key(ns), JSON.stringify(s));
      return true;
    } catch {
      return false;
    }
  },
  clear(ns: string) {
    try {
      localStorage.removeItem(key(ns));
    } catch {
      /* ignore */
    }
  },
};

export const session = {
  load(ns: string): Session | null {
    try {
      const s = JSON.parse(sessionStorage.getItem(key(ns) + ":s") || "null");
      if (s && s.token && Date.now() - s.at < IDLE_MS) return s.session as Session;
      sessionStorage.removeItem(key(ns) + ":s");
    } catch {
      /* ignore */
    }
    return null;
  },
  save(ns: string, sess: Session) {
    try {
      sessionStorage.setItem(key(ns) + ":s", JSON.stringify({ session: sess, token: true, at: Date.now() }));
    } catch {
      /* ignore */
    }
  },
  touch(ns: string) {
    try {
      const raw = sessionStorage.getItem(key(ns) + ":s");
      if (!raw) return;
      const s = JSON.parse(raw);
      s.at = Date.now();
      sessionStorage.setItem(key(ns) + ":s", JSON.stringify(s));
    } catch {
      /* ignore */
    }
  },
  clear(ns: string) {
    try {
      sessionStorage.removeItem(key(ns) + ":s");
    } catch {
      /* ignore */
    }
  },
};

/** Signs out after 30 minutes without a click or key press. Returns a stop function. */
export function watchIdle(ns: string, onIdle: () => void): () => void {
  let t: number | undefined;
  const arm = () => {
    clearTimeout(t);
    session.touch(ns);
    t = window.setTimeout(onIdle, IDLE_MS);
  };
  const evs = ["pointerdown", "keydown"];
  evs.forEach((e) => addEventListener(e, arm, { passive: true }));
  arm();
  return () => {
    clearTimeout(t);
    evs.forEach((e) => removeEventListener(e, arm));
  };
}

export function detectRepo(fallbackRepo = ""): RepoCfg {
  const m = location.hostname.match(/^([^.]+)\.github\.io$/i);
  if (!m) return { owner: "", repo: fallbackRepo, branch: "main" };
  const seg = location.pathname.split("/").filter(Boolean)[0];
  return { owner: m[1], repo: seg && !/\.html?$/i.test(seg) ? seg : `${m[1]}.github.io`, branch: "main" };
}
