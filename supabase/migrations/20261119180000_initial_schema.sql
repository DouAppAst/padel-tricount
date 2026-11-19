-- Padel Tricount - initial schema.
--
-- Security model:
--   * RLS is enabled on every table and `anon` gets no privilege at all.
--   * A "member" is an authenticated user linked to an active participant.
--     Members can read everything; unlinked users can read nothing except
--     through the onboarding RPCs (get_my_status, linkable_participants, request_link).
--   * Games and settlements are written only through SECURITY DEFINER RPCs that
--     check membership and run in a single transaction.
--   * Participants and settings are written directly by admins (RLS policies).

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  display_name text not null
    check (char_length(display_name) between 1 and 40 and display_name = btrim(display_name)),
  auth_user_id uuid unique references auth.users (id) on delete set null,
  active boolean not null default true,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index participants_active_name_key
  on public.participants (lower(display_name)) where active;

create table public.settings (
  id smallint primary key default 1 check (id = 1),
  cse_ticket_price_cents integer not null default 550
    check (cse_ticket_price_cents between 0 and 100000),
  regular_price_cents integer not null default 1300
    check (regular_price_cents between 0 and 100000),
  default_location text not null default 'Toulouse Padel Club'
    check (char_length(btrim(default_location)) between 1 and 100),
  updated_at timestamptz not null default now()
);

insert into public.settings default values;

create table public.games (
  id uuid primary key default gen_random_uuid(),
  played_at date not null,
  location text not null check (char_length(btrim(location)) between 1 and 100),
  comment text check (comment is null or char_length(comment) <= 500),
  created_by uuid references public.participants (id) on delete set null,
  updated_by uuid references public.participants (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index games_played_at_idx on public.games (played_at desc);

create table public.game_entries (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  player_id uuid not null references public.participants (id),
  paid_by_participant_id uuid not null references public.participants (id),
  payment_type text not null check (payment_type in ('CSE_TICKET', 'REGULAR', 'FREE', 'CUSTOM')),
  amount_cents integer not null check (amount_cents between 0 and 100000),
  created_at timestamptz not null default now(),
  unique (game_id, player_id),
  check (payment_type <> 'FREE' or amount_cents = 0)
);

create index game_entries_player_idx on public.game_entries (player_id);
create index game_entries_paid_by_idx on public.game_entries (paid_by_participant_id);

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  from_participant_id uuid not null references public.participants (id),
  to_participant_id uuid not null references public.participants (id),
  amount_cents integer not null check (amount_cents between 1 and 1000000),
  kind text not null default 'REFUND' check (kind in ('REFUND', 'OPENING')),
  settled_at date not null default current_date,
  comment text check (comment is null or char_length(comment) <= 500),
  created_by uuid references public.participants (id) on delete set null,
  updated_by uuid references public.participants (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (from_participant_id <> to_participant_id)
);

create index settlements_from_idx on public.settlements (from_participant_id);
create index settlements_to_idx on public.settlements (to_participant_id);

create table public.link_requests (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete cascade,
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.participants (id) on delete set null
);

create unique index link_requests_one_pending_per_user
  on public.link_requests (auth_user_id) where status = 'PENDING';
create index link_requests_participant_idx on public.link_requests (participant_id);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create function private.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger participants_updated_at before update on public.participants
  for each row execute function private.set_updated_at();
create trigger settings_updated_at before update on public.settings
  for each row execute function private.set_updated_at();
create trigger games_updated_at before update on public.games
  for each row execute function private.set_updated_at();
create trigger settlements_updated_at before update on public.settlements
  for each row execute function private.set_updated_at();

-- Prevents app users from locking everyone out of the admin screen.
-- Changes made outside the app (SQL editor, auth user deletion) are not checked.
create function private.ensure_an_admin_remains() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null
    and old.is_admin and old.active and old.auth_user_id is not null
    and (tg_op = 'DELETE' or not (new.is_admin and new.active and new.auth_user_id is not null))
    and not exists (
      select 1 from public.participants p
      where p.id <> old.id and p.is_admin and p.active and p.auth_user_id is not null
    )
  then
    raise exception 'LAST_ADMIN' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger participants_keep_an_admin before update or delete on public.participants
  for each row execute function private.ensure_an_admin_remains();

-- ---------------------------------------------------------------------------
-- Authorization helpers (private schema: not exposed through the Data API)
-- ---------------------------------------------------------------------------

create function private.current_participant_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select p.id from public.participants p
  where p.auth_user_id = auth.uid() and p.active
$$;

create function private.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.participants p
    where p.auth_user_id = auth.uid() and p.active
  )
$$;

create function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.participants p
    where p.auth_user_id = auth.uid() and p.active and p.is_admin
  )
$$;

create function private.require_member() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  v_me uuid := private.current_participant_id();
begin
  if v_me is null then
    raise exception 'NOT_MEMBER' using errcode = '42501';
  end if;
  return v_me;
end;
$$;

create function private.require_admin() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  v_me uuid := private.require_member();
begin
  if not private.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;
  return v_me;
end;
$$;

-- ---------------------------------------------------------------------------
-- Onboarding RPCs (available to authenticated users that are not linked yet)
-- ---------------------------------------------------------------------------

create function public.get_my_status() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_participant jsonb;
  v_request jsonb;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'id', p.id, 'display_name', p.display_name, 'active', p.active, 'is_admin', p.is_admin
  ) into v_participant
  from public.participants p
  where p.auth_user_id = v_uid;

  select jsonb_build_object(
    'id', r.id, 'participant_id', r.participant_id, 'display_name', p.display_name,
    'status', r.status, 'created_at', r.created_at
  ) into v_request
  from public.link_requests r
  join public.participants p on p.id = r.participant_id
  where r.auth_user_id = v_uid
  order by r.created_at desc
  limit 1;

  return jsonb_build_object('participant', v_participant, 'last_request', v_request);
end;
$$;

create function public.linkable_participants()
returns table (id uuid, display_name text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;
  return query
    select p.id, p.display_name from public.participants p
    where p.active and p.auth_user_id is null
    order by lower(p.display_name);
end;
$$;

create function public.request_link(p_participant_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;
  if exists (select 1 from public.participants p where p.auth_user_id = v_uid) then
    raise exception 'ALREADY_LINKED' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.participants p
    where p.id = p_participant_id and p.active and p.auth_user_id is null
  ) then
    raise exception 'PARTICIPANT_UNAVAILABLE' using errcode = 'P0001';
  end if;

  delete from public.link_requests r where r.auth_user_id = v_uid and r.status = 'PENDING';
  insert into public.link_requests (auth_user_id, participant_id)
    values (v_uid, p_participant_id)
    returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin RPCs
-- ---------------------------------------------------------------------------

create function public.approve_link(p_request_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := private.require_admin();
  v_request public.link_requests;
begin
  select * into v_request from public.link_requests r
    where r.id = p_request_id and r.status = 'PENDING'
    for update;
  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;

  update public.participants p set auth_user_id = v_request.auth_user_id
    where p.id = v_request.participant_id and p.auth_user_id is null;
  if not found then
    raise exception 'PARTICIPANT_UNAVAILABLE' using errcode = 'P0001';
  end if;

  update public.link_requests r
    set status = case when r.id = p_request_id then 'APPROVED' else 'REJECTED' end,
        decided_at = now(),
        decided_by = v_me
    where r.status = 'PENDING'
      and (r.id = p_request_id or r.participant_id = v_request.participant_id);
end;
$$;

create function public.reject_link(p_request_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := private.require_admin();
begin
  update public.link_requests r
    set status = 'REJECTED', decided_at = now(), decided_by = v_me
    where r.id = p_request_id and r.status = 'PENDING';
  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Game RPCs
-- ---------------------------------------------------------------------------

-- Creates (p_game_id null) or fully replaces a game and its entries atomically.
-- p_entries: [{ player_id, paid_by_participant_id, payment_type, amount_cents }]
create function public.save_game(
  p_game_id uuid,
  p_played_at date,
  p_location text,
  p_comment text,
  p_entries jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := private.require_member();
  v_location text;
  v_id uuid;
begin
  if p_entries is null or jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) = 0 then
    raise exception 'NO_PLAYER' using errcode = '22023';
  end if;

  v_location := coalesce(
    nullif(btrim(p_location), ''),
    (select s.default_location from public.settings s where s.id = 1)
  );

  if p_game_id is null then
    insert into public.games (played_at, location, comment, created_by, updated_by)
      values (p_played_at, v_location, nullif(btrim(p_comment), ''), v_me, v_me)
      returning id into v_id;
  else
    update public.games g
      set played_at = p_played_at,
          location = v_location,
          comment = nullif(btrim(p_comment), ''),
          updated_by = v_me
      where g.id = p_game_id and g.deleted_at is null
      returning g.id into v_id;
    if v_id is null then
      raise exception 'GAME_NOT_FOUND' using errcode = 'P0002';
    end if;
    delete from public.game_entries e where e.game_id = v_id;
  end if;

  insert into public.game_entries (game_id, player_id, paid_by_participant_id, payment_type, amount_cents)
    select v_id, e.player_id, e.paid_by_participant_id, e.payment_type, e.amount_cents
    from jsonb_to_recordset(p_entries) as e (
      player_id uuid, paid_by_participant_id uuid, payment_type text, amount_cents integer
    );

  return v_id;
end;
$$;

create function public.set_game_deleted(p_game_id uuid, p_deleted boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := private.require_member();
begin
  update public.games g
    set deleted_at = case when p_deleted then now() else null end,
        updated_by = v_me
    where g.id = p_game_id and (g.deleted_at is null) = p_deleted;
  if not found then
    raise exception 'GAME_NOT_FOUND' using errcode = 'P0002';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Settlement RPCs (OPENING balances are admin-only)
-- ---------------------------------------------------------------------------

create function public.save_settlement(
  p_settlement_id uuid,
  p_from_participant_id uuid,
  p_to_participant_id uuid,
  p_amount_cents integer,
  p_settled_at date,
  p_comment text,
  p_kind text default 'REFUND'
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := private.require_member();
  v_kind text := coalesce(p_kind, 'REFUND');
  v_id uuid;
begin
  if v_kind = 'OPENING' then
    perform private.require_admin();
  end if;

  if p_settlement_id is null then
    insert into public.settlements (
      from_participant_id, to_participant_id, amount_cents, kind, settled_at, comment,
      created_by, updated_by
    ) values (
      p_from_participant_id, p_to_participant_id, p_amount_cents, v_kind,
      coalesce(p_settled_at, current_date), nullif(btrim(p_comment), ''), v_me, v_me
    ) returning id into v_id;
  else
    update public.settlements s
      set from_participant_id = p_from_participant_id,
          to_participant_id = p_to_participant_id,
          amount_cents = p_amount_cents,
          settled_at = coalesce(p_settled_at, current_date),
          comment = nullif(btrim(p_comment), ''),
          updated_by = v_me
      where s.id = p_settlement_id and s.deleted_at is null and s.kind = v_kind
      returning s.id into v_id;
    if v_id is null then
      raise exception 'SETTLEMENT_NOT_FOUND' using errcode = 'P0002';
    end if;
  end if;
  return v_id;
end;
$$;

create function public.set_settlement_deleted(p_settlement_id uuid, p_deleted boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := private.require_member();
  v_kind text;
begin
  select s.kind into v_kind from public.settlements s where s.id = p_settlement_id;
  if v_kind = 'OPENING' then
    perform private.require_admin();
  end if;

  update public.settlements s
    set deleted_at = case when p_deleted then now() else null end,
        updated_by = v_me
    where s.id = p_settlement_id and (s.deleted_at is null) = p_deleted;
  if not found then
    raise exception 'SETTLEMENT_NOT_FOUND' using errcode = 'P0002';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.participants enable row level security;
alter table public.settings enable row level security;
alter table public.games enable row level security;
alter table public.game_entries enable row level security;
alter table public.settlements enable row level security;
alter table public.link_requests enable row level security;

create policy "members read participants" on public.participants
  for select to authenticated using ((select private.is_member()));
create policy "admins insert participants" on public.participants
  for insert to authenticated with check ((select private.is_admin()));
create policy "admins update participants" on public.participants
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admins delete participants" on public.participants
  for delete to authenticated using ((select private.is_admin()));

create policy "members read settings" on public.settings
  for select to authenticated using ((select private.is_member()));
create policy "admins update settings" on public.settings
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "members read games" on public.games
  for select to authenticated using ((select private.is_member()));

create policy "members read game entries" on public.game_entries
  for select to authenticated using ((select private.is_member()));

create policy "members read settlements" on public.settlements
  for select to authenticated using ((select private.is_member()));

create policy "own or admin read link requests" on public.link_requests
  for select to authenticated
  using (auth_user_id = (select auth.uid()) or (select private.is_admin()));

-- ---------------------------------------------------------------------------
-- Privileges: start from nothing, then grant the minimum to `authenticated`.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

grant select on public.participants, public.settings, public.games, public.game_entries,
  public.settlements, public.link_requests to authenticated;
grant insert (display_name, active, is_admin) on public.participants to authenticated;
grant update (display_name, active, is_admin, auth_user_id) on public.participants to authenticated;
grant delete on public.participants to authenticated;
grant update (cse_ticket_price_cents, regular_price_cents, default_location)
  on public.settings to authenticated;

grant execute on function
  private.current_participant_id(),
  private.is_member(),
  private.is_admin()
to authenticated;

grant execute on function
  public.get_my_status(),
  public.linkable_participants(),
  public.request_link(uuid),
  public.approve_link(uuid),
  public.reject_link(uuid),
  public.save_game(uuid, date, text, text, jsonb),
  public.set_game_deleted(uuid, boolean),
  public.save_settlement(uuid, uuid, uuid, integer, date, text, text),
  public.set_settlement_deleted(uuid, boolean)
to authenticated;
