-- Health Caddy cloud sync: one private row per signed-in account.
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.

create table if not exists public.user_data (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Row Level Security: each account can only ever see and change its own row.
alter table public.user_data enable row level security;

drop policy if exists "read own data" on public.user_data;
create policy "read own data" on public.user_data
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "insert own data" on public.user_data;
create policy "insert own data" on public.user_data
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "update own data" on public.user_data;
create policy "update own data" on public.user_data
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "delete own data" on public.user_data;
create policy "delete own data" on public.user_data
  for delete to authenticated using ((select auth.uid()) = user_id);
