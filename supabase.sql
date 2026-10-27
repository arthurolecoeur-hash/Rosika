-- Rosika : base de données sécurisée (v2). À coller dans Supabase > SQL Editor > Run.
-- Peut être relancé sans risque : ne supprime aucune donnée.

-- ========== Sauvegardes des joueurs ==========
create table if not exists public.saves (
  user_id uuid primary key references auth.users on delete cascade,
  data jsonb not null,
  t bigint,
  discord_name text,
  updated_at timestamptz default now()
);
alter table public.saves enable row level security;
alter table public.saves drop constraint if exists saves_size;
alter table public.saves add constraint saves_size check (octet_length(data::text) < 3000000);
alter table public.saves drop constraint if exists saves_name;
alter table public.saves add constraint saves_name check (discord_name is null or char_length(discord_name) <= 64);
drop policy if exists saves_select on public.saves;
drop policy if exists saves_insert on public.saves;
drop policy if exists saves_update on public.saves;
create policy saves_select on public.saves for select to authenticated using (auth.uid() = user_id);
create policy saves_insert on public.saves for insert to authenticated with check (auth.uid() = user_id);
create policy saves_update on public.saves for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ========== Données partagées (marché, échanges, amis, classement, profils) ==========
create table if not exists public.docs (
  col text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  updated_at timestamptz default now(),
  primary key (col, id)
);
alter table public.docs add column if not exists created_at timestamptz not null default now();
create index if not exists docs_owner_created on public.docs (owner, created_at desc);
alter table public.docs drop constraint if exists docs_col;
alter table public.docs add constraint docs_col check (col in ('listings','offers','friends','players','arena','profiles'));
alter table public.docs drop constraint if exists docs_id;
alter table public.docs add constraint docs_id check (char_length(id) between 1 and 120);
alter table public.docs drop constraint if exists docs_size;
alter table public.docs add constraint docs_size check (jsonb_typeof(data) = 'object' and octet_length(data::text) < 16000);

alter table public.docs enable row level security;
drop policy if exists docs_select on public.docs;
drop policy if exists docs_insert on public.docs;
drop policy if exists docs_update on public.docs;
drop policy if exists docs_delete on public.docs;
create policy docs_select on public.docs for select to authenticated using (true);
create policy docs_insert on public.docs for insert to authenticated with check (
  owner = auth.uid() and (
    (col in ('players','arena','profiles') and id = auth.uid()::text)
    or (col = 'listings' and data->>'seller' = auth.uid()::text and data->>'status' = 'open')
    or (col = 'offers' and data->>'from' = auth.uid()::text and data->>'status' = 'open')
    or (col = 'friends' and data->>'from' = auth.uid()::text and data->>'status' = 'pending' and position(auth.uid()::text in id) > 0)
  ));
create policy docs_update on public.docs for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy docs_delete on public.docs for delete to authenticated using (
  owner = auth.uid() or (col = 'friends' and (data->>'from' = auth.uid()::text or data->>'to' = auth.uid()::text)));

-- Règles qui ne peuvent jamais être contournées
create or replace function public.docs_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from docs where owner = new.owner and created_at > now() - interval '1 minute') >= 40 then
      raise exception 'Trop d''actions, attends une minute';
    end if;
    new.created_at := now();
    new.updated_at := now();
    return new;
  end if;
  if new.col <> old.col or new.id <> old.id or new.owner <> old.owner then
    raise exception 'Champ protégé';
  end if;
  if old.col = 'listings' then
    if (new.data->>'seller') is distinct from (old.data->>'seller')
       or (new.data->>'card') is distinct from (old.data->>'card')
       or (new.data->>'kind') is distinct from (old.data->>'kind') then
      raise exception 'Annonce protégée';
    end if;
    if old.data->>'status' <> 'open' and new.data->>'status' = 'open' then
      raise exception 'Annonce déjà terminée';
    end if;
  elsif old.col = 'offers' then
    if (new.data->>'from') is distinct from (old.data->>'from')
       or (new.data->>'give') is distinct from (old.data->>'give')
       or (new.data->'want') is distinct from (old.data->'want')
       or (new.data->>'to') is distinct from (old.data->>'to') then
      raise exception 'Offre protégée';
    end if;
    if old.data->>'status' <> 'open' and new.data->>'status' = 'open' then
      raise exception 'Offre déjà terminée';
    end if;
  elsif old.col = 'friends' then
    if (new.data->>'from') is distinct from (old.data->>'from') or (new.data->>'to') is distinct from (old.data->>'to') then
      raise exception 'Demande protégée';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists docs_guard_ins on public.docs;
drop trigger if exists docs_guard_upd on public.docs;
create trigger docs_guard_ins before insert on public.docs for each row execute function public.docs_guard();
create trigger docs_guard_upd before update on public.docs for each row execute function public.docs_guard();

alter table public.docs replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;

-- Modification validée côté serveur (achat, enchère, échange, ami) : atomique, impossible de tricher sur les données des autres
create or replace function public.doc_update(p_col text, p_id text, p_patch jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  me text := auth.uid()::text;
  r docs%rowtype;
  d jsonb;
  k text[];
  nowms bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  if me is null then raise exception 'Connexion requise'; end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then raise exception 'Requête invalide'; end if;
  select * into r from docs where col = p_col and id = p_id for update;
  if not found then raise exception 'Introuvable'; end if;
  d := r.data;
  select coalesce(array_agg(x), '{}') into k from jsonb_object_keys(p_patch) x;
  if cardinality(k) = 0 then raise exception 'Requête vide'; end if;

  if r.owner::text = me then
    update docs set data = d || p_patch where col = p_col and id = p_id;
    return;
  end if;

  if p_col = 'listings' then
    if k <@ array['status','buyer','st'] and p_patch->>'status' = 'sold' and p_patch->>'buyer' = me
       and d->>'status' = 'open' and d->>'kind' = 'fixed' then
      null;
    elsif k <@ array['bid','bidder','ends','nb'] and p_patch->>'bidder' = me
       and d->>'status' = 'open' and d->>'kind' = 'auction'
       and coalesce((d->>'ends')::numeric, 0) > nowms
       and coalesce((p_patch->>'bid')::numeric, 0) >= greatest(coalesce((d->>'bid')::numeric, 0) + 1, ceil(coalesce((d->>'bid')::numeric, 0) * 1.05))
       and coalesce((p_patch->>'ends')::numeric, 0) >= coalesce((d->>'ends')::numeric, 0)
       and coalesce((p_patch->>'ends')::numeric, 0) <= greatest(coalesce((d->>'ends')::numeric, 0), nowms + 180000) then
      null;
    elsif k <@ array['status','buyer'] and p_patch->>'status' = 'sold' and p_patch->>'buyer' = me
       and d->>'status' = 'open' and d->>'kind' = 'auction' and d->>'bidder' = me
       and coalesce((d->>'ends')::numeric, 0) < nowms then
      null;
    else
      raise exception 'Action refusée';
    end if;
  elsif p_col = 'offers' then
    if k <@ array['status','taker','got','dt'] and p_patch->>'status' = 'done' and p_patch->>'taker' = me
       and d->>'status' = 'open' and d->>'from' <> me
       and (d->>'to' is null or d->>'to' = me)
       and coalesce((d->>'exp')::numeric, nowms + 1) > nowms
       and (coalesce(jsonb_array_length(case when jsonb_typeof(d->'want') = 'array' then d->'want' else '[]'::jsonb end), 0) = 0
            or (d->'want') ? (p_patch->>'got')) then
      null;
    elsif k <@ array['status'] and p_patch->>'status' = 'refused' and d->>'status' = 'open' and d->>'to' = me then
      null;
    else
      raise exception 'Action refusée';
    end if;
  elsif p_col = 'friends' then
    if k <@ array['status','at'] and p_patch->>'status' = 'ok' and d->>'status' = 'pending' and d->>'to' = me then
      null;
    else
      raise exception 'Action refusée';
    end if;
  else
    raise exception 'Action refusée';
  end if;

  update docs set data = d || p_patch where col = p_col and id = p_id;
end $$;

-- Verrou court anti double-achat
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
  delete from leases where until < now() - interval '1 hour';
  insert into leases(path, holder, until)
  values (p_path, p_holder, now() + make_interval(secs => least(greatest(p_ttl_ms, 1000), 30000) / 1000.0))
  on conflict (path) do update set holder = excluded.holder, until = excluded.until
    where leases.until < now() or leases.holder = excluded.holder
  returning true into ok;
  return coalesce(ok, false);
end $$;

drop function if exists public.doc_patch(text, text, jsonb);
revoke all on function public.doc_update(text, text, jsonb) from public, anon;
grant execute on function public.doc_update(text, text, jsonb) to authenticated;
revoke all on function public.doc_lease(text, text, int) from public, anon;
grant execute on function public.doc_lease(text, text, int) to authenticated;

-- Nettoyage automatique des vieilles annonces / offres terminées (garde la base légère)
create or replace function public.docs_cleanup() returns void
language sql security definer set search_path = public as $$
  delete from docs
  where col in ('listings','offers')
    and data->>'status' in ('done','cancel','refused')
    and updated_at < now() - interval '30 days';
$$;
revoke all on function public.docs_cleanup() from public, anon, authenticated;
do $$ begin
  create extension if not exists pg_cron;
  perform cron.unschedule('rosika-cleanup') where exists (select 1 from cron.job where jobname = 'rosika-cleanup');
  perform cron.schedule('rosika-cleanup', '17 4 * * *', 'select public.docs_cleanup()');
exception when others then null; end $$;
