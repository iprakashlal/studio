-- Shop backend for Site Studio shops.
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Safe to run again: it only creates what's missing and replaces the access rules.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------

-- Account numbers look like AC-100001, AC-100002, ...
create sequence if not exists public.account_no_seq start 100001;

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  account_no  text unique not null default ('AC-' || nextval('public.account_no_seq')),
  email       text not null,
  name        text not null default '',
  phone       text not null default '',
  address     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Emails allowed to see every order and customer in the shop's CMS.
create table if not exists public.shop_admins (
  email text primary key
);

create table if not exists public.orders (
  id             uuid primary key default gen_random_uuid(),
  order_no       text unique not null,
  access_key     text not null,
  user_id        uuid references auth.users (id) on delete set null,
  email          text not null,
  name           text not null,
  phone          text not null default '',
  address        jsonb not null default '{}'::jsonb,
  notes          text not null default '',
  items          jsonb not null,
  totals         jsonb not null,
  currency       text not null,
  method         text not null,
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid', 'cod', 'refunded')),
  status         text not null default 'pending' check (status in ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
  payment_ref    text,
  paid_at        timestamptz,
  notify_log     jsonb not null default '[]'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists orders_email_idx on public.orders (lower(email));
create index if not exists orders_user_idx on public.orders (user_id);
create index if not exists orders_ref_idx on public.orders (payment_ref);
create index if not exists orders_created_idx on public.orders (created_at desc);

create table if not exists public.wishlists (
  user_id    uuid not null references auth.users (id) on delete cascade,
  product_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

-- ---------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------

create or replace function public.is_shop_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.shop_admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- Every new sign-in account gets a profile with an account number.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
drop trigger if exists orders_touch on public.orders;
create trigger orders_touch before update on public.orders for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------
-- Access rules (row level security)
-- Customers see only their own rows. Shop admins see everything.
-- Orders are created and changed only by the shop's server function.
-- ---------------------------------------------------------------

alter table public.profiles    enable row level security;
alter table public.orders      enable row level security;
alter table public.wishlists   enable row level security;
alter table public.shop_admins enable row level security;

drop policy if exists "profiles: own or admin can read" on public.profiles;
create policy "profiles: own or admin can read" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_shop_admin());

drop policy if exists "profiles: own can update" on public.profiles;
create policy "profiles: own can update" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Customers may change only their name, phone and address.
revoke update on public.profiles from anon, authenticated;
grant update (name, phone, address) on public.profiles to authenticated;
revoke insert, delete on public.profiles from anon, authenticated;

drop policy if exists "orders: own (by account or verified email) or admin can read" on public.orders;
create policy "orders: own (by account or verified email) or admin can read" on public.orders
  for select to authenticated using (
    user_id = auth.uid()
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    or public.is_shop_admin()
  );
revoke insert, update, delete on public.orders from anon, authenticated;

drop policy if exists "wishlists: own read" on public.wishlists;
create policy "wishlists: own read" on public.wishlists for select to authenticated using (user_id = auth.uid());
drop policy if exists "wishlists: own add" on public.wishlists;
create policy "wishlists: own add" on public.wishlists for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "wishlists: own remove" on public.wishlists;
create policy "wishlists: own remove" on public.wishlists for delete to authenticated using (user_id = auth.uid());
revoke update on public.wishlists from anon, authenticated;

-- shop_admins has no policies: only the SQL editor and the server function can read or change it.
revoke all on public.shop_admins from anon, authenticated;

-- ---------------------------------------------------------------
-- Add yourself as the shop admin (replace the email, then run this line).
-- ---------------------------------------------------------------
-- insert into public.shop_admins (email) values ('you@example.com') on conflict do nothing;
