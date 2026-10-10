-- =====================================================================
--  v12 nailtech tools. Run AFTER 11_safeguards.sql. Safe to run more than once.
--   - balance payments (amount, cash/GCash, when)
--   - nailtech can add bookings herself (any date/time, no client rules)
--   - editable GCash QR, map link and policy text (public settings)
--   - history also records balance payments and edits
-- =====================================================================

alter table public.bookings add column if not exists balance_paid    int;
alter table public.bookings add column if not exists balance_method  text;
alter table public.bookings add column if not exists balance_paid_at timestamptz;

insert into public.settings (key, value) values
  ('map_url', ''), ('gcash_qr_path', ''), ('policies_json', ''), ('policy_version', '')
on conflict (key) do nothing;

-- everything the client pages are allowed to read
create or replace function public.get_public_settings() returns json
language sql stable security definer set search_path = public as $$
  select json_object_agg(key, value) from settings
  where key in ('gcash_number','gcash_name','min_dp','hold_hours','gcash_qr_path','policies_json','policy_version')
$$;

create or replace function public.lookup_booking(p_code text, p_phone text) returns json
language plpgsql security definer set search_path = public as $$
declare b bookings; v_loc text; v_map text;
begin
  perform expire_stale();
  select * into b from bookings
   where code = upper(trim(p_code)) and norm_phone(phone) = norm_phone(p_phone);
  if not found then return null; end if;
  if b.status in ('confirmed','completed') then
    select value into v_loc from settings where key = 'location_text';
    select nullif(trim(value), '') into v_map from settings where key = 'map_url';
  end if;
  return json_build_object(
    'code', b.code, 'status', b.status, 'slot_date', b.slot_date, 'slot_time', b.slot_time,
    'full_name', b.full_name, 'instagram', b.instagram, 'phone', b.phone, 'age', b.age,
    'service', b.service, 'length', b.length, 'removal', b.removal, 'tier', b.tier,
    'intensive', b.intensive, 'estimated_price', b.estimated_price, 'final_price', b.final_price,
    'dp_amount', b.dp_amount, 'receipt_uploaded', b.receipt_path is not null, 'receipt_path', b.receipt_path, 'receipt_note', b.receipt_note,
    'expires_at', b.expires_at, 'created_at', b.created_at, 'location', v_loc, 'map_url', v_map,
    'balance_paid', b.balance_paid, 'balance_method', b.balance_method);
end $$;

-- nailtech adds a booking herself (DMs, walk-ins). Skips the client rules (cutoff, limits, service rules).
create or replace function public.admin_create_booking(
  p_name text, p_ig text, p_phone text, p_age int,
  p_service text, p_length text, p_removal text, p_tier int, p_intensive boolean,
  p_date date, p_time time, p_status text, p_dp int
) returns text
language plpgsql security definer set search_path = public as $$
declare v_code text; v_hold int := coalesce((select value::int from settings where key = 'hold_hours'), 12);
begin
  if coalesce(nullif(current_setting('request.jwt.claims', true), '')::json->>'role', '') <> 'authenticated' then
    raise exception 'NOT_ALLOWED';
  end if;
  if coalesce(trim(p_name),'') = ''
     or p_service not in ('biab','hardgel','softgel','hardgele')
     or p_tier not between 1 and 4
     or p_removal not in ('none','soft','fill','f_soft','f_hard')
     or (p_service in ('softgel','hardgele') and coalesce(p_length,'') not in ('short','medium','long'))
     or p_status not in ('awaiting_payment','confirmed')
  then raise exception 'INVALID_INPUT'; end if;

  insert into schedule_slots (slot_date, slot_time, is_open) values (p_date, p_time, true)
  on conflict (slot_date, slot_time) do nothing;

  loop
    v_code := gen_code();
    exit when not exists (select 1 from bookings where code = v_code);
  end loop;
  begin
    insert into bookings (code, status, slot_date, slot_time, full_name, instagram, phone, age,
                          service, length, removal, tier, intensive, estimated_price, dp_amount, expires_at)
    values (v_code, p_status, p_date, p_time, trim(p_name),
            coalesce(nullif(trim(p_ig), ''), '-'), coalesce(nullif(trim(p_phone), ''), '-'), coalesce(p_age, 0),
            p_service, case when p_service in ('softgel','hardgele') then p_length end,
            p_removal, p_tier, coalesce(p_intensive, false),
            calc_price(p_service, p_length, p_removal, coalesce(p_intensive, false)),
            p_dp,
            case when p_status = 'confirmed' then slot_ts(p_date, p_time)
                 else least(now() + make_interval(hours => v_hold), slot_ts(p_date, p_time)) end);
  exception when unique_violation then
    raise exception 'SLOT_TAKEN';
  end;
  return v_code;
end $$;
revoke all on function public.admin_create_booking(text,text,text,int,text,text,text,int,boolean,date,time,text,int) from anon;
grant execute on function public.admin_create_booking(text,text,text,int,text,text,text,int,boolean,date,time,text,int) to authenticated;

create or replace function public.log_booking_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_role  text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::json->>'role', '');
  v_actor text := case when v_role = 'authenticated' then 'nailtech' else 'client' end;
begin
  if tg_op = 'INSERT' then
    insert into booking_events (booking_id, actor, kind, detail)
    values (new.id, v_actor, case when v_actor = 'nailtech' then 'created_by_you' else 'created' end,
            to_char(new.slot_date, 'Mon DD') || ', ' || to_char(new.slot_time, 'HH12:MI AM'));
    return new;
  end if;
  if new.status is distinct from old.status then
    insert into booking_events (booking_id, actor, kind, detail)
    values (new.id,
            case when new.status = 'expired' then 'system' else v_actor end,
            'status', old.status || ' → ' || new.status ||
            case when new.status = 'awaiting_payment' and new.receipt_note is not null
                 then ' (new receipt asked: ' || new.receipt_note || ')' else '' end);
  end if;
  if new.receipt_path is distinct from old.receipt_path and new.receipt_path is not null then
    insert into booking_events (booking_id, actor, kind, detail)
    values (new.id, v_actor, 'receipt', 'Receipt uploaded, amount ₱' || coalesce(new.dp_amount::text, '?'));
  elsif new.dp_amount is distinct from old.dp_amount then
    insert into booking_events (booking_id, actor, kind, detail)
    values (new.id, v_actor, 'downpayment', 'Downpayment ₱' || coalesce(old.dp_amount::text, '–') || ' → ₱' || coalesce(new.dp_amount::text, '–'));
  end if;
  if new.final_price is distinct from old.final_price then
    insert into booking_events (booking_id, actor, kind, detail)
    values (new.id, v_actor, 'price', 'Final price ' || coalesce('₱' || old.final_price::text, 'estimate') || ' → ' || coalesce('₱' || new.final_price::text, 'estimate'));
  end if;
  if new.balance_paid is distinct from old.balance_paid then
    insert into booking_events (booking_id, actor, kind, detail)
    values (new.id, v_actor, 'balance',
            case when new.balance_paid is null then 'Balance payment removed'
                 else 'Balance paid ₱' || new.balance_paid || coalesce(' (' || new.balance_method || ')', '') end);
  end if;
  if (new.service, new.length, new.removal, new.tier, new.intensive) is distinct from
     (old.service, old.length, old.removal, old.tier, old.intensive) then
    insert into booking_events (booking_id, actor, kind, detail)
    values (new.id, v_actor, 'edited', 'Service details changed (estimate ₱' || old.estimated_price || ' → ₱' || new.estimated_price || ')');
  end if;
  if (new.full_name, new.instagram, new.phone, new.age) is distinct from (old.full_name, old.instagram, old.phone, old.age) then
    insert into booking_events (booking_id, actor, kind, detail)
    values (new.id, v_actor, 'edited', 'Client details changed');
  end if;
  if new.slot_date is distinct from old.slot_date or new.slot_time is distinct from old.slot_time then
    insert into booking_events (booking_id, actor, kind, detail)
    values (new.id, v_actor, 'moved',
            to_char(old.slot_date, 'Mon DD') || ' ' || to_char(old.slot_time, 'HH12:MI AM') || ' → ' ||
            to_char(new.slot_date, 'Mon DD') || ' ' || to_char(new.slot_time, 'HH12:MI AM'));
  end if;
  return new;
end $$;
