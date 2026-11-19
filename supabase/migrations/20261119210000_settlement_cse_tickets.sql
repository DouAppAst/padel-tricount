-- Refunds can be partly paid with CSE tickets. Only the total amount counts for
-- balances; the number of tickets is kept for the history.

alter table public.settlements
  add column cse_tickets smallint not null default 0 check (cse_tickets between 0 and 100),
  add constraint settlements_tickets_only_for_refunds check (kind = 'REFUND' or cse_tickets = 0);

-- New parameter: replace the function (an extra defaulted parameter would create an
-- ambiguous overload for PostgREST).
drop function public.save_settlement(uuid, uuid, uuid, integer, date, text, text);

create function public.save_settlement(
  p_settlement_id uuid,
  p_from_participant_id uuid,
  p_to_participant_id uuid,
  p_amount_cents integer,
  p_settled_at date,
  p_comment text,
  p_kind text default 'REFUND',
  p_cse_tickets integer default 0
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
      cse_tickets, created_by, updated_by
    ) values (
      p_from_participant_id, p_to_participant_id, p_amount_cents, v_kind,
      coalesce(p_settled_at, current_date), nullif(btrim(p_comment), ''),
      coalesce(p_cse_tickets, 0), v_me, v_me
    ) returning id into v_id;
  else
    update public.settlements s
      set from_participant_id = p_from_participant_id,
          to_participant_id = p_to_participant_id,
          amount_cents = p_amount_cents,
          settled_at = coalesce(p_settled_at, current_date),
          comment = nullif(btrim(p_comment), ''),
          cse_tickets = coalesce(p_cse_tickets, 0),
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

revoke all on function public.save_settlement(uuid, uuid, uuid, integer, date, text, text, integer)
  from public, anon;
grant execute on function public.save_settlement(uuid, uuid, uuid, integer, date, text, text, integer)
  to authenticated;
