// D1 tables for the Site Studio database on Cloudflare. This is the one place they are defined: the Studio runs the whole list when it
// sets a database up, and the Worker runs it again when it starts (every statement is "if not exists", so repeating is harmless).
export const CFDB_TABLES: string[] = [
  // sign-in, files and what a site collects
  "create table if not exists members (scope text not null, email text not null, role text not null default 'owner', added_at text not null default (datetime('now')), primary key (scope, email))",
  "create index if not exists members_email on members (email, scope)",
  "create table if not exists files (scope text not null, path text not null, sha text not null, size integer not null default 0, parts integer not null default 1, type text not null default '', updated_at text not null, primary key (scope, path))",
  "create table if not exists chunks (scope text not null, path text not null, n integer not null, data blob not null, primary key (scope, path, n))",
  "create table if not exists codes (email text primary key, hash text not null, expires integer not null, tries integer not null default 0, sent integer not null default 0)",
  "create table if not exists enquiries (id integer primary key autoincrement, site text not null, data text not null, page text not null default '', status text not null default 'new', created_at text not null)",
  "create index if not exists enquiries_site on enquiries (site, created_at)",
  "create table if not exists stock (site text not null, item text not null, qty integer not null default 0, low integer not null default 0, updated_at text not null, primary key (site, item))",
  "create table if not exists stock_log (id integer primary key autoincrement, site text not null, item text not null, delta integer not null, qty integer not null, why text not null default '', ref text not null default '', at text not null)",
  "create index if not exists stock_log_site on stock_log (site, id)",
  "create table if not exists carts (site text not null, ckey text not null, tok text not null, email text not null, name text not null default '', phone text not null default '', lines text not null default '[]', items text not null default '[]', total real not null default 0, cur text not null default '', back text not null default '', status text not null default 'open', sent integer not null default 0, sent_at text, order_no text not null default '', created_at text not null, updated_at text not null, primary key (site, ckey))",
  "create index if not exists carts_tok on carts (tok)",
  "create index if not exists carts_open on carts (status, updated_at)",
  "create table if not exists reviews (id integer primary key autoincrement, site text not null, item text not null, label text not null default '', name text not null, email text not null default '', rating integer not null, title text not null default '', body text not null, verified integer not null default 0, status text not null default 'pending', reply text not null default '', reply_at text, created_at text not null)",
  "create index if not exists reviews_item on reviews (site, item, status)",
  "create table if not exists pins (email text primary key, salt text not null, hash text not null, tries integer not null default 0, locked integer not null default 0, set_at text not null)",
  "create table if not exists pin_dev (email text not null, dev text not null, at integer not null, primary key (email, dev))",
  "create table if not exists workers (worker text primary key, scope text not null)",
  "create table if not exists repos (repo text primary key, scope text not null)",
  "create table if not exists approvals (token text primary key, scope text not null, project text not null, name text not null, template text not null, content text not null, note text not null default '', status text not null default 'open', decided_by text not null default '', decided_at text, created_by text not null default '', created_at text not null)",
  "create index if not exists approvals_project on approvals (scope, project, created_at)",
  "create table if not exists approval_notes (id integer primary key autoincrement, token text not null, who text not null, body text not null, page text not null default '', kind text not null default 'comment', created_at text not null)",
  "create index if not exists approval_notes_token on approval_notes (token, id)",
  "create table if not exists settings (scope text not null, name text not null, value text not null, updated_at text not null, primary key (scope, name))",
  "create table if not exists customers (site text not null, ckey text not null, name text not null default '', phone text not null default '', email text not null default '', verified integer not null default 0, orders integer not null default 0, spent real not null default 0, points integer not null default 0, first_at text not null, last_at text not null, primary key (site, ckey))",
  "create table if not exists points (id integer primary key autoincrement, site text not null, ckey text not null, delta integer not null, why text not null default '', order_no text not null default '', at text not null)",
  "create index if not exists points_site_key on points (site, ckey, id)",
  // what a signed-in customer keeps about themselves beyond their name and contacts (their saved addresses)
  "create table if not exists profiles (site text not null, ckey text not null, data text not null default '{}', primary key (site, ckey))",
  "create table if not exists otps (k text primary key, hash text not null, expires integer not null, tries integer not null default 0, sent integer not null default 0)",
  "create table if not exists design_queries (id integer primary key autoincrement, studio text not null, name text not null default '', kind text not null default '', person text not null default '', phone text not null default '', email text not null default '', note text not null default '', answers text not null default '{}', copy text not null default '{}', logo text not null default '', pdf_name text not null default '', pdf text not null default '', status text not null default 'new', mail text not null default '', created_at text not null)",
  "create index if not exists design_queries_studio on design_queries (studio, id)",
  "create table if not exists design_drafts (studio text not null, id text not null, email text not null, name text not null default '', kind text not null default '', theme_id text not null default '', theme_name text not null default '', summary text not null default '', answers text not null default '{}', copy text not null default '{}', logo text not null default '', created_at text not null, updated_at text not null, primary key (studio, id))",
  "create index if not exists design_drafts_studio on design_drafts (studio, updated_at)",
  "create table if not exists design_pics (studio text not null, ref integer not null, slot text not null, idx integer not null, data text not null, primary key (studio, ref, slot, idx))",
  "create table if not exists dq_rate (k text primary key, n integer not null, exp integer not null)",
  "create table if not exists payments (rz_order text primary key, site text not null, order_no text not null, amount integer not null, status text not null default 'created', created_at text not null)",
  "create index if not exists payments_site on payments (site, created_at)",
];
export const CFDB_SCHEMA = CFDB_TABLES.join(";\n") + ";";
/** Changes to a table that already exists. Each is made once: the Worker first asks `probe`; only if that fails does it run `steps`
 *  (together, all or nothing). Until one is in place the Worker keeps working the way it did before it.
 *  - enquiries.ref: an order's or registration's number, read out of the saved JSON by the database itself (a generated column, so no
 *    row is rewritten and nothing that saves an enquiry changes), with an index, so one is found directly instead of by searching the text. */
export const CFDB_UPGRADES: { name: string; probe: string; steps: string[] }[] = [
  { name: "enquiries.ref", probe: "select ref from enquiries limit 1", steps: [
    "alter table enquiries add column ref text generated always as (case when json_valid(data) then coalesce(nullif(json_extract(data, '$.order_no'), ''), nullif(json_extract(data, '$.reg_no'), ''), '') else '' end) virtual",
    "create index if not exists enquiries_ref on enquiries (site, ref)",
  ] },
];
export const CFDB_VERSION = 92;
/** The database Worker's name on Cloudflare. */
export const CFDB_WORKER_NAME = "picaffectz-db";
