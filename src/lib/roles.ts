// Role Management: the roles people can have in a Studio or on a site's admin page, and what each role may do.
// No imports: the Studio and the Worker both use this file, so the screen and the database agree on every rule.
//
// Kept in the database: who has which role in `members` (as before), each role's privileges in `role_mgmt`, and who
// owns which project in `project_owners`. An Administrator (`owner` in the database, as it has always been called
// there) can do everything and is the only one who can change roles; a Studio Partner keeps its own full access.

export type RoleId = "owner" | "member" | "developer" | "tester" | "demo" | "partner";
/** The roles someone can be given, in the order they are listed. `member` is the Manager (the name older databases use). */
export const ROLES: { id: RoleId; label: string; hint: string }[] = [
  { id: "owner", label: "Administrator", hint: "Everything, including Role Management. Sees everyone's projects." },
  { id: "member", label: "Manager", hint: "Runs their own projects and publishes them." },
  { id: "developer", label: "Developer", hint: "Builds and publishes their own projects, including to GitHub." },
  { id: "tester", label: "Tester (QA)", hint: "Works on their own projects to try things; doesn't publish." },
  { id: "demo", label: "Demo", hint: "A saved sandbox of their own that can never be published." },
];
export const roleLabel = (r: string) => (r === "partner" ? "Studio Partner" : ROLES.find((x) => x.id === r)?.label || r);
export const isAdminRole = (r: string | null | undefined) => r === "owner" || r === "partner";
export const ROLE_IDS = ROLES.map((r) => r.id) as string[];

/** What a role can be allowed to do. where: "studio", "site" (a site's admin page) or both. */
export const PRIVS: { key: string; label: string; group: string; where: "studio" | "site" | "both"; hint?: string }[] = [
  { key: "publishCf", label: "Publish to Cloudflare or another host", group: "Publishing", where: "both", hint: "Every way of publishing except GitHub." },
  { key: "publishGh", label: "Publish to GitHub", group: "Publishing", where: "both" },
  { key: "export", label: "Export or import a ZIP", group: "Publishing", where: "studio" },
  { key: "new", label: "Create projects", group: "Projects", where: "studio" },
  { key: "duplicate", label: "Duplicate projects", group: "Projects", where: "studio" },
  { key: "delete", label: "Delete projects", group: "Projects", where: "studio" },
  { key: "themes", label: "Themes gallery", group: "Features", where: "studio" },
  { key: "design", label: "Design yourself and its submissions", group: "Features", where: "studio" },
  { key: "approve", label: "Share for approval", group: "Features", where: "studio" },
  { key: "festival", label: "Festival overlay", group: "Features", where: "studio" },
  { key: "shared", label: "Change shared Studio settings", group: "Settings", where: "studio", hint: "Customize, Design yourself settings, Themes and Menus. Hostings, sign-in, updates and Role Management stay with Administrators." },
  { key: "edit", label: "Edit and save the site's content", group: "This site", where: "site" },
  { key: "orders", label: "Orders, enquiries and customers", group: "This site", where: "site" },
  { key: "settings", label: "Backup and advanced setup panels", group: "This site", where: "site" },
];
export type Privs = Record<string, boolean>;
const ALL = (): Privs => Object.fromEntries(PRIVS.map((p) => [p.key, true]));
const only = (...on: string[]): Privs => Object.fromEntries(PRIVS.map((p) => [p.key, on.includes(p.key)]));
/** What each role may do until an Administrator changes it. */
export const DEFAULT_PRIVS: Record<string, Privs> = {
  owner: ALL(), partner: ALL(),
  member: only("publishCf", "publishGh", "export", "new", "duplicate", "delete", "themes", "design", "approve", "festival", "edit", "orders", "settings"),
  developer: only("publishCf", "publishGh", "export", "new", "duplicate", "delete", "themes", "design", "festival", "edit", "settings"),
  tester: only("export", "new", "duplicate", "themes", "design", "festival", "edit", "orders"),
  demo: only("new", "themes", "edit"),
};
/** Privileges a role can never be given. The Demo role never publishes, whatever is ticked. */
export const NEVER: Record<string, string[]> = { demo: ["publishCf", "publishGh", "export", "shared", "approve"] };
/** A role's privileges: the saved choices over the defaults. Administrators always have everything. */
export function privsOf(role: string | null | undefined, saved?: any): Privs {
  if (isAdminRole(role)) return ALL();
  const base = DEFAULT_PRIVS[String(role)] || only(), out: Privs = { ...base };
  if (saved && typeof saved === "object") for (const p of PRIVS) if (typeof saved[p.key] === "boolean") out[p.key] = saved[p.key];
  for (const k of NEVER[String(role)] || []) out[k] = false;
  return out;
}
/** Only the known switches, as true or false (what is kept in the database). */
export function cleanPrivs(role: string, x: any): Privs { const o: Privs = {}; for (const p of PRIVS) if (typeof x?.[p.key] === "boolean") o[p.key] = (NEVER[role] || []).includes(p.key) ? false : x[p.key]; return o; }
/** The folder name of one person's own space in a Studio (their own project list and choices). */
export const userKey = (email: string) => String(email || "").trim().toLowerCase().replace(/@/g, "_at_").replace(/[^a-z0-9._-]/g, "_").slice(0, 120);
export const userRoot = (email: string) => `users/${userKey(email)}/`;

/** What someone who is not an Administrator may do with a file of a Studio. "strip": the shared project list, without its projects. */
export function fileRule(path: string, myKey: string, shared: boolean): { read: boolean | "strip"; write: boolean; project?: string } {
  const p = String(path || "");
  if (p === "studio.json") return { read: "strip", write: false };
  if (p.startsWith("users/")) { const mine = p.startsWith("users/" + myKey + "/"); return { read: mine, write: mine }; }
  const m = /^projects\/([^/]+)\//.exec(p);
  if (m) return { read: false, write: false, project: m[1] };   // decided by who owns the project
  return { read: true, write: shared };
}
