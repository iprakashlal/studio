// The signed-in person's role in this Studio (Role Management), read once from the Studio's database.
// A Studio that isn't on the Cloudflare database, or whose database is older than Role Management, has no roles:
// everything works as it always did.
import { useEffect, useState } from "react";
import { cfCall } from "./cfdb";
import { loadHostConfig } from "./studiohost";
import { privsOf, type Privs } from "./roles";

export type MyRole = { /** Roles are in force (the database knows Role Management). */ managed: boolean; admin: boolean; role: string; email: string; privs: Privs; api: string; scope: string };
const FREE: MyRole = { managed: false, admin: true, role: "owner", email: "", privs: privsOf("owner"), api: "", scope: "" };
let cur: MyRole = FREE;
const subs = new Set<() => void>();
export const myRole = () => cur;
export async function loadMyRole(demo = false): Promise<MyRole> {
  let next = FREE;
  if (!demo) try {
    const cfg = await loadHostConfig();
    if (cfg?.kind === "cloudflare") {
      const scope = "studio:" + cfg.studio, r = await cfCall<any>(cfg.api, "/roles?scope=" + encodeURIComponent(scope));
      if (r?.me?.role) next = { managed: !!r.ready, admin: r.me.role === "owner" || r.me.role === "partner", role: r.me.role, email: r.me.email, privs: r.ready ? r.me.privs : privsOf("owner"), api: cfg.api, scope };
      if (!next.managed) next = { ...next, admin: true };
    }
  } catch { /* an older database: no roles */ }
  cur = next; subs.forEach((f) => f());
  return cur;
}
export function useMyRole(): MyRole {
  const [, bump] = useState(0);
  useEffect(() => { const f = () => bump((n) => n + 1); subs.add(f); return () => { subs.delete(f); }; }, []);
  return cur;
}
/** Features hidden for this person: the ones their role isn't allowed (the same names a client Studio hides). */
export function roleHides(r: MyRole, viewingOther = false): (key: string) => boolean {
  if (!r.managed) return () => false;
  const off = new Set<string>();
  if (!r.admin) {
    for (const k of ["new", "duplicate", "delete", "themes", "design", "festival", "analytics"]) if (!r.privs[k]) off.add(k);
    if (!r.privs.shared) for (const k of ["brand", "badge", "pages", "menus"]) off.add(k);
    off.add("hosting");
  }
  // An Administrator looking at someone else's projects opens, edits and deletes them; new ones are made in one's own list.
  if (viewingOther) { off.add("new"); off.add("duplicate"); }
  return (k) => off.has(k);
}
