-- Several clubs, each with its own prices. The CSE ticket is only accepted by some
-- clubs (null price = not accepted). Replaces the single prices/location of settings;
-- the current values become the first (default) club.

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100 and name = btrim(name)),
  regular_price_cents integer not null check (regular_price_cents between 0 and 100000),
  cse_ticket_price_cents integer check (cse_ticket_price_cents between 0 and 100000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index venues_name_key on public.venues (lower(name));

create trigger venues_updated_at before update on public.venues
  for each row execute function private.set_updated_at();

insert into public.venues (name, regular_price_cents, cse_ticket_price_cents)
  select s.default_location, s.regular_price_cents, s.cse_ticket_price_cents
  from public.settings s where s.id = 1;

alter table public.settings
  add column default_venue_id uuid references public.venues (id) on delete set null;
update public.settings set default_venue_id = (select v.id from public.venues v limit 1)
  where id = 1;

-- save_game must stop reading settings.default_location before it is dropped.
create or replace function public.save_game(
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
    (select v.name from public.settings s join public.venues v on v.id = s.default_venue_id
      where s.id = 1),
    'Padel'
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

alter table public.settings
  drop column cse_ticket_price_cents,
  drop column regular_price_cents,
  drop column default_location;

alter table public.venues enable row level security;

create policy "members read venues" on public.venues
  for select to authenticated using ((select private.is_member()));
create policy "admins insert venues" on public.venues
  for insert to authenticated with check ((select private.is_admin()));
create policy "admins update venues" on public.venues
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

revoke all on public.venues from anon, authenticated;
grant select on public.venues to authenticated;
grant insert (name, regular_price_cents, cse_ticket_price_cents, active)
  on public.venues to authenticated;
grant update (name, regular_price_cents, cse_ticket_price_cents, active)
  on public.venues to authenticated;
grant update (default_venue_id) on public.settings to authenticated;
