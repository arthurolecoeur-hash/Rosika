-- Rosika : base de données sécurisée (v3 : pseudos uniques + panel admin). À coller dans Supabase > SQL Editor > Run.
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


-- ========== Comptes : pseudos uniques, admins, bannis ==========
create table if not exists public.admins (
  user_id uuid primary key references auth.users on delete cascade,
  created_at timestamptz default now()
);
alter table public.admins enable row level security;

create table if not exists public.bans (
  user_id uuid primary key references auth.users on delete cascade,
  reason text,
  at timestamptz default now()
);
alter table public.bans enable row level security;

create table if not exists public.names (
  user_id uuid primary key references auth.users on delete cascade,
  name text not null,
  base text not null,
  locked boolean not null default false,
  created_at timestamptz default now()
);
alter table public.names add column if not exists locked boolean not null default false;
create unique index if not exists names_lower on public.names (lower(name));
alter table public.names enable row level security;
drop policy if exists names_select on public.names;
create policy names_select on public.names for select to authenticated using (true);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;
create or replace function public.is_banned() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from bans where user_id = auth.uid());
$$;

-- Le pseudo = nom Discord. Si déjà pris (majuscules ignorées) : Nom-2, Nom-3…
create or replace function public.claim_name(p_base text) returns text
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  b text;
  cur names%rowtype;
  cand text;
  n int := 1;
begin
  if uid is null then raise exception 'Connexion requise'; end if;
  b := left(regexp_replace(coalesce(btrim(p_base), ''), '[[:cntrl:]<>"`]', '', 'g'), 24);
  b := btrim(b);
  if b = '' then b := 'Joueur'; end if;
  select * into cur from names where user_id = uid;
  if found and (cur.locked or cur.base = b) then return cur.name; end if;
  loop
    cand := case when n = 1 then b else b || '-' || n end;
    if not exists (select 1 from names where lower(name) = lower(cand) and user_id <> uid) then
      begin
        insert into names(user_id, name, base) values (uid, cand, b)
        on conflict (user_id) do update set name = excluded.name, base = excluded.base;
        update docs set data = jsonb_set(data, '{name}', to_jsonb(cand)) where col = 'profiles' and id = uid::text;
        update docs set data = jsonb_set(data, '{n}', to_jsonb(cand)) where col = 'arena' and id = uid::text;
        return cand;
      exception when unique_violation then null;
      end;
    end if;
    n := n + 1;
    if n > 9999 then raise exception 'Pseudo indisponible'; end if;
  end loop;
end $$;

create or replace function public.my_status() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'name', (select name from names where user_id = auth.uid()),
    'admin', exists (select 1 from admins where user_id = auth.uid()),
    'banned', exists (select 1 from bans where user_id = auth.uid()),
    'reason', (select reason from bans where user_id = auth.uid()));
$$;

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
  public.is_admin() or (not public.is_banned() and (
    owner = auth.uid() or (col = 'friends' and (data->>'from' = auth.uid()::text or data->>'to' = auth.uid()::text)))));

-- Règles qui ne peuvent jamais être contournées
create or replace function public.docs_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare nm text;
begin
  if auth.uid() is not null and public.is_banned() and not public.is_admin() then
    raise exception 'Compte suspendu';
  end if;
  if new.col in ('profiles','arena') then
    select name into nm from names where user_id = new.owner;
    if nm is not null then
      new.data := jsonb_set(new.data, case when new.col = 'profiles' then '{name}'::text[] else '{n}'::text[] end, to_jsonb(nm));
    end if;
  end if;
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
  if public.is_banned() and not public.is_admin() then raise exception 'Compte suspendu'; end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then raise exception 'Requête invalide'; end if;
  select * into r from docs where col = p_col and id = p_id for update;
  if not found then raise exception 'Introuvable'; end if;
  d := r.data;
  select coalesce(array_agg(x), '{}') into k from jsonb_object_keys(p_patch) x;
  if cardinality(k) = 0 then raise exception 'Requête vide'; end if;

  if r.owner::text = me or public.is_admin() then
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

-- ========== Cadeaux envoyés par l'admin ==========
create table if not exists public.grants (
  id bigserial primary key,
  user_id uuid references auth.users on delete cascade,
  rewards jsonb not null check (jsonb_typeof(rewards) = 'array'),
  msg text,
  expires_at timestamptz,
  created_at timestamptz default now()
);
alter table public.grants enable row level security;
create table if not exists public.grant_claims (
  grant_id bigint references public.grants on delete cascade,
  user_id uuid references auth.users on delete cascade,
  at timestamptz default now(),
  primary key (grant_id, user_id)
);
alter table public.grant_claims enable row level security;

create or replace function public.claim_grants() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); res jsonb;
begin
  if uid is null or public.is_banned() then return '[]'::jsonb; end if;
  with ins as (
    insert into grant_claims(grant_id, user_id)
    select g.id, uid from grants g
    where (g.user_id = uid or g.user_id is null) and (g.expires_at is null or g.expires_at > now())
    on conflict do nothing
    returning grant_id)
  select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'rewards', g.rewards, 'msg', g.msg) order by g.id), '[]'::jsonb)
    into res from grants g join ins on ins.grant_id = g.id;
  return res;
end $$;

-- ========== Codes cadeaux gérés depuis le panel ==========
create table if not exists public.codes (
  code text primary key check (code = upper(code) and char_length(code) between 2 and 32),
  rewards jsonb not null check (jsonb_typeof(rewards) = 'array'),
  msg text,
  max_uses int,
  uses int not null default 0,
  expires_at timestamptz,
  created_at timestamptz default now()
);
alter table public.codes enable row level security;
create table if not exists public.code_uses (
  code text references public.codes on delete cascade on update cascade,
  user_id uuid references auth.users on delete cascade,
  at timestamptz default now(),
  primary key (code, user_id)
);
alter table public.code_uses enable row level security;
create table if not exists public.code_tries (
  user_id uuid not null,
  at timestamptz not null default now()
);
create index if not exists code_tries_user on public.code_tries (user_id, at desc);
alter table public.code_tries enable row level security;

create or replace function public.redeem_code(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); c text; r codes%rowtype; ok boolean;
begin
  if uid is null then return jsonb_build_object('status', 'login'); end if;
  if public.is_banned() then return jsonb_build_object('status', 'banned'); end if;
  if (select count(*) from code_tries where user_id = uid and at > now() - interval '10 minutes') >= 15 then
    return jsonb_build_object('status', 'slow');
  end if;
  insert into code_tries(user_id) values (uid);
  delete from code_tries where at < now() - interval '1 day';
  c := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
  select * into r from codes where code = c for update;
  if not found then return jsonb_build_object('status', 'unknown'); end if;
  if r.expires_at is not null and r.expires_at < now() then return jsonb_build_object('status', 'expired'); end if;
  if r.max_uses is not null and r.uses >= r.max_uses then return jsonb_build_object('status', 'exhausted'); end if;
  insert into code_uses(code, user_id) values (c, uid) on conflict do nothing returning true into ok;
  if ok is null then return jsonb_build_object('status', 'used'); end if;
  update codes set uses = uses + 1 where code = c;
  return jsonb_build_object('status', 'ok', 'code', c, 'rewards', r.rewards, 'msg', r.msg);
end $$;

-- ========== Annonce affichée à tous ==========
create table if not exists public.config (
  key text primary key,
  value jsonb,
  updated_at timestamptz default now()
);
alter table public.config enable row level security;
drop policy if exists config_read on public.config;
create policy config_read on public.config for select to anon, authenticated using (true);

-- ========== Fonctions du panel admin ==========
create or replace function public.admin_check() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Réservé à l''admin'; end if;
end $$;

create or replace function public.admin_overview() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_check();
  return jsonb_build_object(
    'players', (select count(*) from names),
    'active24', (select count(*) from saves where updated_at > now() - interval '1 day'),
    'active7', (select count(*) from saves where updated_at > now() - interval '7 days'),
    'listings', (select count(*) from docs where col = 'listings' and data->>'status' = 'open'),
    'offers', (select count(*) from docs where col = 'offers' and data->>'status' = 'open'),
    'bans', (select count(*) from bans),
    'codes', (select count(*) from codes),
    'grants', (select count(*) from grants where expires_at is null or expires_at > now()),
    'dbsize', pg_database_size(current_database()));
end $$;

create or replace function public.admin_players(p_q text default null, p_limit int default 100) returns jsonb
language plpgsql security definer set search_path = public as $$
declare res jsonb;
begin
  perform public.admin_check();
  select coalesce(jsonb_agg(x order by x->>'last' desc nulls last), '[]'::jsonb) into res from (
    select jsonb_build_object(
      'id', n.user_id, 'name', n.name, 'base', n.base, 'created', n.created_at, 'last', s.updated_at,
      'coins', coalesce((s.data->>'coins')::numeric, 0),
      'cards', (select count(*) from jsonb_object_keys(case when jsonb_typeof(s.data->'own') = 'object' then s.data->'own' else '{}'::jsonb end)),
      'opens', coalesce((s.data->'st'->>'open')::numeric, 0),
      'banned', b.user_id is not null, 'reason', b.reason,
      'admin', exists (select 1 from admins a where a.user_id = n.user_id)) x
    from names n
    left join saves s on s.user_id = n.user_id
    left join bans b on b.user_id = n.user_id
    where p_q is null or p_q = '' or n.name ilike '%' || p_q || '%' or n.base ilike '%' || p_q || '%'
    order by s.updated_at desc nulls last
    limit least(greatest(coalesce(p_limit, 100), 1), 500)) t;
  return res;
end $$;

create or replace function public.admin_grant(p_user uuid, p_rewards jsonb, p_msg text, p_days int default 7) returns bigint
language plpgsql security definer set search_path = public as $$
declare gid bigint;
begin
  perform public.admin_check();
  if jsonb_typeof(p_rewards) <> 'array' or jsonb_array_length(p_rewards) = 0 then raise exception 'Récompense vide'; end if;
  insert into grants(user_id, rewards, msg, expires_at)
  values (p_user, p_rewards, nullif(left(p_msg, 200), ''), case when p_days is null or p_days <= 0 then null else now() + make_interval(days => p_days) end)
  returning id into gid;
  return gid;
end $$;

create or replace function public.admin_ban(p_user uuid, p_ban boolean, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_check();
  if exists (select 1 from admins where user_id = p_user) then raise exception 'Impossible de bannir un admin'; end if;
  if p_ban then
    insert into bans(user_id, reason) values (p_user, nullif(left(p_reason, 200), ''))
    on conflict (user_id) do update set reason = excluded.reason, at = now();
    update docs set data = data || '{"status":"done","paid":true,"removed":true}'::jsonb
      where owner = p_user and col = 'listings' and data->>'status' = 'open';
    update docs set data = data || '{"status":"cancel"}'::jsonb
      where owner = p_user and col = 'offers' and data->>'status' = 'open';
  else
    delete from bans where user_id = p_user;
  end if;
end $$;

create or replace function public.admin_rename(p_user uuid, p_name text) returns text
language plpgsql security definer set search_path = public as $$
declare nm text;
begin
  perform public.admin_check();
  nm := btrim(left(regexp_replace(coalesce(p_name, ''), '[[:cntrl:]<>"`]', '', 'g'), 24));
  if nm = '' then raise exception 'Pseudo vide'; end if;
  if exists (select 1 from names where lower(name) = lower(nm) and user_id <> p_user) then raise exception 'Pseudo déjà pris'; end if;
  update names set name = nm, locked = true where user_id = p_user;
  if not found then raise exception 'Joueur introuvable'; end if;
  update docs set data = jsonb_set(data, '{name}', to_jsonb(nm)) where col = 'profiles' and id = p_user::text;
  update docs set data = jsonb_set(data, '{n}', to_jsonb(nm)) where col = 'arena' and id = p_user::text;
  return nm;
end $$;

create or replace function public.admin_codes() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_check();
  return coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at desc) from codes c), '[]'::jsonb);
end $$;

create or replace function public.admin_code_save(p_code text, p_rewards jsonb, p_msg text, p_max int, p_expires timestamptz) returns void
language plpgsql security definer set search_path = public as $$
declare c text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
begin
  perform public.admin_check();
  if jsonb_typeof(p_rewards) <> 'array' or jsonb_array_length(p_rewards) = 0 then raise exception 'Récompense vide'; end if;
  insert into codes(code, rewards, msg, max_uses, expires_at) values (c, p_rewards, nullif(left(p_msg, 200), ''), p_max, p_expires)
  on conflict (code) do update set rewards = excluded.rewards, msg = excluded.msg, max_uses = excluded.max_uses, expires_at = excluded.expires_at;
end $$;

create or replace function public.admin_code_delete(p_code text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_check();
  delete from codes where code = upper(p_code);
end $$;

create or replace function public.admin_set_config(p_key text, p_value jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_check();
  if p_value is null or p_value = 'null'::jsonb then
    delete from config where key = p_key;
  else
    insert into config(key, value, updated_at) values (p_key, p_value, now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
  end if;
end $$;

create or replace function public.admin_listing_remove(p_id text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_check();
  update docs set data = data || '{"status":"done","paid":true,"removed":true}'::jsonb
    where col = 'listings' and id = p_id and data->>'status' = 'open';
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.claim_name(text)', 'public.my_status()', 'public.claim_grants()', 'public.redeem_code(text)',
    'public.admin_overview()', 'public.admin_players(text, int)', 'public.admin_grant(uuid, jsonb, text, int)',
    'public.admin_ban(uuid, boolean, text)', 'public.admin_rename(uuid, text)', 'public.admin_codes()',
    'public.admin_code_save(text, jsonb, text, int, timestamptz)', 'public.admin_code_delete(text)',
    'public.admin_set_config(text, jsonb)', 'public.admin_listing_remove(text)', 'public.admin_check()',
    'public.is_admin()', 'public.is_banned()']
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- ========== Admin : le compte dont le pseudo est « Rosix » ==========
-- (connecte-toi d'abord une fois sur le site avec Discord, puis relance ce script)
insert into public.admins(user_id)
select user_id from public.names where lower(name) = 'rosix' order by created_at limit 1
on conflict do nothing;
select n.name as admin from public.admins a join public.names n on n.user_id = a.user_id;
