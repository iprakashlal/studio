-- Site Studio: enquiries from your website's contact form. Run it in Supabase → SQL Editor. Running it again is safe.
create table if not exists public.site_admins (
  site text not null,
  email text not null,
  primary key (site, email)
);
alter table public.site_admins enable row level security;
create or replace function public.is_site_admin(s text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.site_admins a where a.site = s and lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;
drop policy if exists "owners see their sites" on public.site_admins;
create policy "owners see their sites" on public.site_admins for select to authenticated using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- Enquiries from the business template's contact form: anyone can send one, only the site's editors read them.
create table if not exists public.site_enquiries (
  id bigint generated always as identity primary key,
  site text not null,
  data jsonb not null default '{}'::jsonb,
  page text not null default '',
  status text not null default 'new',
  created_at timestamptz not null default now()
);
alter table public.site_enquiries enable row level security;
create index if not exists site_enquiries_site on public.site_enquiries (site, created_at desc);
drop policy if exists "anyone sends an enquiry" on public.site_enquiries;
create policy "anyone sends an enquiry" on public.site_enquiries for insert to anon, authenticated with check (status = 'new' and length(data::text) < 20000);
drop policy if exists "owners read enquiries" on public.site_enquiries;
create policy "owners read enquiries" on public.site_enquiries for select to authenticated using (public.is_site_admin(site));
drop policy if exists "owners update enquiries" on public.site_enquiries;
create policy "owners update enquiries" on public.site_enquiries for update to authenticated using (public.is_site_admin(site)) with check (public.is_site_admin(site));
drop policy if exists "owners delete enquiries" on public.site_enquiries;
create policy "owners delete enquiries" on public.site_enquiries for delete to authenticated using (public.is_site_admin(site));

-- Who can read enquiries. Add more rows for more people.
insert into public.site_admins (site, email) values ('your-site-id', 'you@example.com') on conflict do nothing;
