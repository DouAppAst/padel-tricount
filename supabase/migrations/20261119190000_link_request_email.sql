-- Shows admins which email asked to be linked to a participant,
-- so that nobody can silently claim someone else's name.

alter table public.link_requests add column requester_email text;

create or replace function public.request_link(p_participant_id uuid) returns uuid
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
  insert into public.link_requests (auth_user_id, participant_id, requester_email)
    values (v_uid, p_participant_id, auth.jwt() ->> 'email')
    returning id into v_id;
  return v_id;
end;
$$;
