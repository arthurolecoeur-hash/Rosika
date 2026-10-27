-- Rosika : base de données (à coller dans Supabase > SQL Editor > Run)

create table if not exists public.saves (
  user_id uuid primary key references auth.users on delete cascade,
  data jsonb not null,
  t bigint,
  discord_name text,
  updated_at timestamptz default now()
);
alter table public.saves enable row level security;
drop policy if exists saves_select on public.saves;
drop policy if exists saves_insert on public.saves;
drop policy if exists saves_update on public.saves;
create policy saves_select on public.saves for select to authenticated using (auth.uid() = user_id);
create policy saves_insert on public.saves for insert to authenticated with check (auth.uid() = user_id);
create policy saves_update on public.saves for update to authenticated using (auth.uid() = user_id);

create table if not exists public.docs (
  col text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  updated_at timestamptz default now(),
  primary key (col, id)
);
alter table public.docs enable row level security;
drop policy if exists docs_select on public.docs;
drop policy if exists docs_insert on public.docs;
drop policy if exists docs_update on public.docs;
drop policy if exists docs_delete on public.docs;
create policy docs_select on public.docs for select to authenticated using (true);
create policy docs_insert on public.docs for insert to authenticated with check (owner = auth.uid());
create policy docs_update on public.docs for update to authenticated using (true) with check (true);
create policy docs_delete on public.docs for delete to authenticated
  using (owner = auth.uid() or data->>'from' = auth.uid()::text or data->>'to' = auth.uid()::text);
alter table public.docs replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;

create table if not exists public.leases (
  path text primary key,
  holder text not null,
  until timestamptz not null
);
alter table public.leases enable row level security;

create or replace function public.doc_lease(p_path text, p_holder text, p_ttl_ms int)
returns boolean language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  if auth.uid() is null then return false; end if;
  insert into leases(path, holder, until)
  values (p_path, p_holder, now() + make_interval(secs => p_ttl_ms / 1000.0))
  on conflict (path) do update set holder = excluded.holder, until = excluded.until
    where leases.until < now() or leases.holder = excluded.holder
  returning true into ok;
  return coalesce(ok, false);
end $$;

create or replace function public.doc_patch(p_col text, p_id text, p_patch jsonb)
returns void language sql security invoker set search_path = public as $$
  update docs set data = data || p_patch, updated_at = now() where col = p_col and id = p_id;
$$;

revoke all on function public.doc_lease(text, text, int) from public, anon;
grant execute on function public.doc_lease(text, text, int) to authenticated;
revoke all on function public.doc_patch(text, text, jsonb) from public, anon;
grant execute on function public.doc_patch(text, text, jsonb) to authenticated;
