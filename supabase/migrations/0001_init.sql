-- NuSpring race report schema

create type public.app_role as enum ('pending', 'sales', 'ads', 'admin');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text,
  role public.app_role not null default 'pending',
  created_at timestamptz not null default now()
);

-- Ad accounts that ad spend is keyed against (NuSpring Meta, Lee Ping Ads, ...)
create table public.ad_accounts (
  id bigint generated always as identity primary key,
  name text not null unique,
  active boolean not null default true,
  sort_order int not null default 0
);

-- Sales channels. kind 'chat' = enquiries handled by sales team, 'marketplace' = Shopee / website
create table public.channels (
  id bigint generated always as identity primary key,
  name text not null unique,
  kind text not null check (kind in ('chat', 'marketplace')),
  owned boolean not null default true,
  ad_account_id bigint references public.ad_accounts (id) on delete set null,
  active boolean not null default true,
  sort_order int not null default 0
);

-- One row per salesperson, day and channel
create table public.sales_entries (
  id bigint generated always as identity primary key,
  entry_date date not null,
  channel_id bigint not null references public.channels (id),
  user_id uuid not null references public.profiles (id) default auth.uid(),
  new_sales numeric(12,2) not null default 0 check (new_sales >= 0),
  repeat_sales numeric(12,2) not null default 0 check (repeat_sales >= 0),
  new_orders int not null default 0 check (new_orders >= 0),
  repeat_orders int not null default 0 check (repeat_orders >= 0),
  new_enquiries int not null default 0 check (new_enquiries >= 0),
  existing_enquiries int not null default 0 check (existing_enquiries >= 0),
  updated_at timestamptz not null default now(),
  unique (entry_date, channel_id, user_id)
);

-- One row per day and ad account, keyed by the ads specialist
create table public.ad_entries (
  id bigint generated always as identity primary key,
  entry_date date not null,
  ad_account_id bigint not null references public.ad_accounts (id),
  spend numeric(12,2) not null default 0 check (spend >= 0),
  platform_leads int check (platform_leads >= 0), -- Ads Manager "new messaging conversations started"
  user_id uuid references public.profiles (id) default auth.uid(),
  updated_at timestamptz not null default now(),
  unique (entry_date, ad_account_id)
);

create table public.monthly_targets (
  month date primary key check (extract(day from month) = 1),
  sales_target numeric(12,2) not null default 0,
  ad_spend_target numeric(12,2) not null default 0
);

create index on public.sales_entries (entry_date);
create index on public.ad_entries (entry_date);

-- Role helpers
create or replace function public.current_role_name() returns public.app_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_approved() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select role <> 'pending' from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
$$;

-- New sign-ups get a pending profile; the very first user becomes admin
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    case when exists (select 1 from public.profiles) then 'pending'::public.app_role else 'admin'::public.app_role end
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

create trigger sales_touch before update on public.sales_entries for each row execute function public.touch_updated_at();
create trigger ads_touch before update on public.ad_entries for each row execute function public.touch_updated_at();

-- Stop non-admins changing their own role
create or replace function public.guard_profile_role() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Only an admin can change roles';
  end if;
  return new;
end $$;
create trigger profiles_guard_role before update on public.profiles for each row execute function public.guard_profile_role();

-- RLS
alter table public.profiles enable row level security;
alter table public.ad_accounts enable row level security;
alter table public.channels enable row level security;
alter table public.sales_entries enable row level security;
alter table public.ad_entries enable row level security;
alter table public.monthly_targets enable row level security;

create policy "read own or approved" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_approved()));
create policy "update self or admin" on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

create policy "approved read" on public.ad_accounts for select to authenticated using ((select public.is_approved()));
create policy "admin write" on public.ad_accounts for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "approved read" on public.channels for select to authenticated using ((select public.is_approved()));
create policy "admin write" on public.channels for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "approved read" on public.monthly_targets for select to authenticated using ((select public.is_approved()));
create policy "admin write" on public.monthly_targets for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "approved read" on public.sales_entries for select to authenticated using ((select public.is_approved()));
create policy "sales insert own" on public.sales_entries for insert to authenticated
  with check ((select public.is_admin()) or (user_id = (select auth.uid()) and (select public.current_role_name()) = 'sales'));
create policy "sales update own" on public.sales_entries for update to authenticated
  using ((select public.is_admin()) or (user_id = (select auth.uid()) and (select public.current_role_name()) = 'sales'))
  with check ((select public.is_admin()) or (user_id = (select auth.uid()) and (select public.current_role_name()) = 'sales'));
create policy "sales delete own" on public.sales_entries for delete to authenticated
  using ((select public.is_admin()) or (user_id = (select auth.uid()) and (select public.current_role_name()) = 'sales'));

create policy "approved read" on public.ad_entries for select to authenticated using ((select public.is_approved()));
create policy "ads write" on public.ad_entries for all to authenticated
  using ((select public.current_role_name()) in ('ads', 'admin'))
  with check ((select public.current_role_name()) in ('ads', 'admin'));

-- Seed
insert into public.ad_accounts (name, sort_order) values ('NuSpring Meta Ads', 1), ('Lee Ping Ads', 2);
insert into public.channels (name, kind, owned, ad_account_id, sort_order) values
  ('Facebook', 'chat', true, (select id from public.ad_accounts where name = 'NuSpring Meta Ads'), 1),
  ('WhatsApp (click-to-WA ads)', 'chat', true, (select id from public.ad_accounts where name = 'NuSpring Meta Ads'), 2),
  ('Lee Ping (KOL)', 'chat', false, (select id from public.ad_accounts where name = 'Lee Ping Ads'), 3),
  ('Other partners', 'chat', false, null, 4),
  ('Shopee', 'marketplace', true, null, 5),
  ('Website', 'marketplace', true, null, 6);
insert into public.monthly_targets (month, sales_target, ad_spend_target) values ('2026-11-01', 300000, 45000);
