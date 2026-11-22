// D1 tables for the Site Studio database on Cloudflare (used by its Worker and by the Studio's setup).
export const CFDB_SCHEMA = `
create table if not exists members (scope text not null, email text not null, role text not null default 'owner', added_at text not null default (datetime('now')), primary key (scope, email));
create table if not exists files (scope text not null, path text not null, sha text not null, size integer not null default 0, parts integer not null default 1, type text not null default '', updated_at text not null, primary key (scope, path));
create table if not exists chunks (scope text not null, path text not null, n integer not null, data blob not null, primary key (scope, path, n));
create table if not exists codes (email text primary key, hash text not null, expires integer not null, tries integer not null default 0, sent integer not null default 0);
create table if not exists enquiries (id integer primary key autoincrement, site text not null, data text not null, page text not null default '', status text not null default 'new', created_at text not null);
create index if not exists enquiries_site on enquiries (site, created_at);
create table if not exists stock (site text not null, item text not null, qty integer not null default 0, low integer not null default 0, updated_at text not null, primary key (site, item));
create table if not exists stock_log (id integer primary key autoincrement, site text not null, item text not null, delta integer not null, qty integer not null, why text not null default '', ref text not null default '', at text not null);
create index if not exists stock_log_site on stock_log (site, id);
create table if not exists carts (site text not null, ckey text not null, tok text not null, email text not null, name text not null default '', phone text not null default '', lines text not null default '[]', items text not null default '[]', total real not null default 0, cur text not null default '', back text not null default '', status text not null default 'open', sent integer not null default 0, sent_at text, order_no text not null default '', created_at text not null, updated_at text not null, primary key (site, ckey));
create index if not exists carts_tok on carts (tok);
create index if not exists carts_open on carts (status, updated_at);
create table if not exists reviews (id integer primary key autoincrement, site text not null, item text not null, label text not null default '', name text not null, email text not null default '', rating integer not null, title text not null default '', body text not null, verified integer not null default 0, status text not null default 'pending', reply text not null default '', reply_at text, created_at text not null);
create index if not exists reviews_item on reviews (site, item, status);
create table if not exists pins (email text primary key, salt text not null, hash text not null, tries integer not null default 0, locked integer not null default 0, set_at text not null);
create table if not exists pin_dev (email text not null, dev text not null, at integer not null, primary key (email, dev));
create table if not exists workers (worker text primary key, scope text not null);
create table if not exists repos (repo text primary key, scope text not null);
create table if not exists approvals (token text primary key, scope text not null, project text not null, name text not null, template text not null, content text not null, note text not null default '', status text not null default 'open', decided_by text not null default '', decided_at text, created_by text not null default '', created_at text not null);
create index if not exists approvals_project on approvals (scope, project, created_at);
create table if not exists approval_notes (id integer primary key autoincrement, token text not null, who text not null, body text not null, page text not null default '', kind text not null default 'comment', created_at text not null);
create index if not exists approval_notes_token on approval_notes (token, id);
`;
export const CFDB_VERSION = 49;
/** The database Worker's name on Cloudflare. */
export const CFDB_WORKER_NAME = "picaffectz-db";
