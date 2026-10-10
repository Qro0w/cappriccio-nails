-- =====================================================================
--  v11 safeguards. Run AFTER 06–10. Safe to run more than once.
--   1. same-day cutoff: a day stops taking client bookings when it starts
--      (setting 'cutoff_hours_before' moves it earlier, e.g. 3 = 9 PM the night before)
--   2. max 2 unpaid / unchecked bookings per phone number (setting 'max_pending_per_phone')
--   3. "Ask for a new receipt": nailtech sends the booking back to unpaid with a reason
--   4. booking history (every status / receipt / price / time change, with who did it)
-- =====================================================================

-- ---------- settings ----------
insert into public.settings (key, value) values
  ('cutoff_hours_before',   '0'),
  ('max_pending_per_phone', '2'),
  ('resubmit_hours',        '6'),
  ('check_reminder_hours',  '12')
on conflict (key) do nothing;

-- ---------- 1. same-day cutoff ----------
create or replace function public.booking_open_for(p_date date) returns boolean
language sql stable security definer set search_path = public as $$
  select now() < slot_ts(p_date, time '00:00')
               - make_interval(hours => coalesce((select value::int from settings where key = 'cutoff_hours_before'), 0))
$$;

create or replace function public.get_slots(p_service text, p_tier int, p_removal text)
returns table (slot_date date, slot_time time, state text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare v_today date := (now() at time zone 'Asia/Manila')::date;
begin
  perform expire_stale();
  return query
  select s.slot_date, s.slot_time,
    case
      when exists (select 1 from bookings b
                   where b.slot_date = s.slot_date and b.slot_time = s.slot_time
                     and b.status in ('awaiting_payment','payment_submitted','confirmed')) then 'taken'
      when not slot_allowed(s.slot_date, s.slot_time, p_service, p_tier, p_removal) then 'unavailable'
      else 'available'
    end
  from schedule_slots s
  where s.slot_date >= v_today
    and s.is_open
    and slot_visible(s.slot_date)
    and slot_ts(s.slot_date, s.slot_time) > now()
    and booking_open_for(s.slot_date)
  order by s.slot_date, s.slot_time;
end $$;

-- ---------- 2. max pending per phone (inside create_booking) ----------
create or replace function public.create_booking(
  p_name text, p_ig text, p_phone text, p_age int,
  p_service text, p_length text, p_removal text, p_tier int, p_intensive boolean,
  p_date date, p_time time, p_policy_version text
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_code  text;
  v_hold  int := (select value::int from settings where key = 'hold_hours');
  v_start timestamptz := slot_ts(p_date, p_time);
begin
  perform expire_stale();

  if coalesce(trim(p_name),'') = '' or coalesce(trim(p_ig),'') = ''
     or length(norm_phone(p_phone)) < 10 or p_age is null or p_age < 1
     or p_service not in ('biab','hardgel','softgel','hardgele')
     or p_tier not between 1 and 4
     or p_removal not in ('none','soft','fill','f_soft','f_hard')
     or (p_service in ('softgel','hardgele') and coalesce(p_length,'') not in ('short','medium','long'))
     or coalesce(trim(p_policy_version),'') = ''
  then raise exception 'INVALID_INPUT'; end if;

  if not exists (select 1 from schedule_slots where slot_date = p_date and slot_time = p_time and is_open)
     or not slot_visible(p_date)
     or v_start <= now()
     or not booking_open_for(p_date)
     or not slot_allowed(p_date, p_time, p_service, p_tier, p_removal)
  then raise exception 'SLOT_UNAVAILABLE'; end if;

  -- max unpaid / unchecked bookings per phone number
  if (select count(*) from bookings
       where norm_phone(phone) = norm_phone(p_phone)
         and status in ('awaiting_payment','payment_submitted'))
     >= coalesce((select value::int from settings where key = 'max_pending_per_phone'), 2)
  then raise exception 'TOO_MANY_PENDING'; end if;

  if p_intensive and not intensive_allowed(p_service, p_tier, p_removal)
  then raise exception 'INVALID_INPUT'; end if;

  loop
    v_code := gen_code();
    exit when not exists (select 1 from bookings where bookings.code = v_code);
  end loop;

  begin
    insert into bookings (code, slot_date, slot_time, full_name, instagram, phone, age,
                          service, length, removal, tier, intensive, estimated_price, expires_at,
                          policy_version, policy_accepted_at)
    values (v_code, p_date, p_time, trim(p_name), trim(p_ig), trim(p_phone), p_age,
            p_service,
            case when p_service in ('softgel','hardgele') then p_length end,
            p_removal, p_tier, coalesce(p_intensive, false),
            calc_price(p_service, p_length, p_removal, coalesce(p_intensive, false)),
            least(now() + make_interval(hours => v_hold), v_start),
            trim(p_policy_version), now());
  exception when unique_violation then
    raise exception 'SLOT_TAKEN';
  end;
  return v_code;
end $$;

-- ---------- 3. ask for a new receipt ----------
alter table public.bookings add column if not exists receipt_note text;

create or replace function public.request_new_receipt(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare b bookings; v_hours int := coalesce((select value::int from settings where key = 'resubmit_hours'), 6);
begin
  if coalesce(nullif(current_setting('request.jwt.claims', true), '')::json->>'role', '') <> 'authenticated' then
    raise exception 'NOT_ALLOWED';
  end if;
  select * into b from bookings where id = p_id for update;
  if not found or b.status <> 'payment_submitted' then raise exception 'NOT_OPEN'; end if;
  update bookings
     set status = 'awaiting_payment',
         receipt_note = nullif(trim(p_reason), ''),
         expires_at = least(now() + make_interval(hours => v_hours), slot_ts(b.slot_date, b.slot_time))
   where id = p_id;
end $$;
revoke all on function public.request_new_receipt(uuid, text) from anon;
grant execute on function public.request_new_receipt(uuid, text) to authenticated;

-- a new upload clears her note
create or replace function public.submit_receipt(p_code text, p_phone text, p_path text, p_amount int)
returns void language plpgsql security definer set search_path = public as $$
declare b bookings; v_min int := (select value::int from settings where key = 'min_dp');
begin
  perform expire_stale();
  select * into b from bookings
   where code = upper(trim(p_code)) and norm_phone(phone) = norm_phone(p_phone) for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if b.status not in ('awaiting_payment','payment_submitted') then raise exception 'NOT_OPEN'; end if;
  if p_amount is null or p_amount < v_min then raise exception 'AMOUNT_TOO_LOW'; end if;
  if p_path not like b.code || '/%' then raise exception 'INVALID_INPUT'; end if;
  update bookings
     set receipt_path = p_path, dp_amount = p_amount, receipt_note = null,
         receipt_uploaded_at = now(), status = 'payment_submitted'
   where id = b.id;
end $$;

create or replace function public.lookup_booking(p_code text, p_phone text) returns json
language plpgsql security definer set search_path = public as $$
declare b bookings; v_loc text;
begin
  perform expire_stale();
  select * into b from bookings
   where code = upper(trim(p_code)) and norm_phone(phone) = norm_phone(p_phone);
  if not found then return null; end if;
  if b.status in ('confirmed','completed') then
    select value into v_loc from settings where key = 'location_text';
  end if;
  return json_build_object(
    'code', b.code, 'status', b.status, 'slot_date', b.slot_date, 'slot_time', b.slot_time,
    'full_name', b.full_name, 'instagram', b.instagram, 'phone', b.phone, 'age', b.age,
    'service', b.service, 'length', b.length, 'removal', b.removal, 'tier', b.tier,
    'intensive', b.intensive, 'estimated_price', b.estimated_price, 'final_price', b.final_price,
    'dp_amount', b.dp_amount, 'receipt_uploaded', b.receipt_path is not null, 'receipt_path', b.receipt_path, 'receipt_note', b.receipt_note,
    'expires_at', b.expires_at, 'created_at', b.created_at, 'location', v_loc);
end $$;

-- ---------- 4. booking history ----------
create table if not exists public.booking_events (
  id         bigserial primary key,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  at         timestamptz not null default now(),
  actor      text not null,          -- client | nailtech | system
  kind       text not null,
  detail     text
);
create index if not exists booking_events_booking on public.booking_events (booking_id, at);
alter table public.booking_events enable row level security;
drop policy if exists admin_all on public.booking_events;
create policy admin_all on public.booking_events for all to authenticated using (true) with check (true);

create or replace function public.log_booking_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_role  text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::json->>'role', '');
  v_actor text := case when v_role = 'authenticated' then 'nailtech' else 'client' end;
begin
  if tg_op = 'INSERT' then
    insert into booking_events (booking_id, actor, kind, detail)
    values (new.id, v_actor, 'created',
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
  if new.slot_date is distinct from old.slot_date or new.slot_time is distinct from old.slot_time then
    insert into booking_events (booking_id, actor, kind, detail)
    values (new.id, v_actor, 'moved',
            to_char(old.slot_date, 'Mon DD') || ' ' || to_char(old.slot_time, 'HH12:MI AM') || ' → ' ||
            to_char(new.slot_date, 'Mon DD') || ' ' || to_char(new.slot_time, 'HH12:MI AM'));
  end if;
  return new;
end $$;

drop trigger if exists bookings_log on public.bookings;
create trigger bookings_log after insert or update on public.bookings
  for each row execute function public.log_booking_event();
