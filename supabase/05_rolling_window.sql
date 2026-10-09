-- =====================================================================
-- 05_rolling_window.sql  -  run ONCE in the Supabase SQL Editor (if you already ran 01 and 02 earlier)
-- The "two weeks at a time" rule now applies to NOVEMBER only. December is visible in full.
-- =====================================================================
alter table public.schedule_slots add column if not exists rolling boolean not null default false;

update public.schedule_slots set rolling = true
 where slot_date >= date '2026-11-01' and slot_date < date '2026-12-01';

create or replace function public.get_slots(p_service text, p_tier int, p_removal text)
returns table (slot_date date, slot_time time, state text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_today date := (now() at time zone 'Asia/Manila')::date;
  v_win   int  := (select value::int from settings where key = 'window_days');
begin
  perform expire_stale();
  return query
  select s.slot_date, s.slot_time,
    case
      when exists (select 1 from bookings b
                   where b.slot_date = s.slot_date and b.slot_time = s.slot_time
                     and b.status in ('awaiting_payment','payment_submitted','confirmed')) then 'taken'
      when not slot_allowed(s.slot_date, s.slot_time, s.rules_mode, p_service, p_tier, p_removal) then 'unavailable'
      else 'available'
    end
  from schedule_slots s
  where s.slot_date >= v_today
    and (not s.rolling or s.slot_date <= v_today + v_win)
    and slot_ts(s.slot_date, s.slot_time) > now()
  order by s.slot_date, s.slot_time;
end $$;

create or replace function public.create_booking(
  p_name text, p_ig text, p_phone text, p_age int,
  p_service text, p_length text, p_removal text, p_tier int, p_intensive boolean,
  p_date date, p_time time
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_slot  schedule_slots;
  v_code  text;
  v_today date := (now() at time zone 'Asia/Manila')::date;
  v_win   int  := (select value::int from settings where key = 'window_days');
  v_hold  int  := (select value::int from settings where key = 'hold_hours');
  v_start timestamptz := slot_ts(p_date, p_time);
begin
  perform expire_stale();

  if coalesce(trim(p_name),'') = '' or coalesce(trim(p_ig),'') = ''
     or length(norm_phone(p_phone)) < 10 or p_age is null or p_age < 1
     or p_service not in ('biab','hardgel','softgel','hardgele')
     or p_tier not between 1 and 4
     or p_removal not in ('none','soft','fill','f_soft','f_hard')
     or (p_service in ('softgel','hardgele') and coalesce(p_length,'') not in ('short','medium','long'))
  then raise exception 'INVALID_INPUT'; end if;

  select * into v_slot from schedule_slots where slot_date = p_date and slot_time = p_time;
  if not found or (v_slot.rolling and p_date > v_today + v_win) or v_start <= now()
     or not slot_allowed(p_date, p_time, v_slot.rules_mode, p_service, p_tier, p_removal)
  then raise exception 'SLOT_UNAVAILABLE'; end if;

  if p_intensive and not intensive_allowed(p_service, p_tier, p_removal)
  then raise exception 'INVALID_INPUT'; end if;

  loop
    v_code := gen_code();
    exit when not exists (select 1 from bookings where bookings.code = v_code);
  end loop;

  begin
    insert into bookings (code, slot_date, slot_time, full_name, instagram, phone, age,
                          service, length, removal, tier, intensive, estimated_price, expires_at)
    values (v_code, p_date, p_time, trim(p_name), trim(p_ig), trim(p_phone), p_age,
            p_service,
            case when p_service in ('softgel','hardgele') then p_length end,
            p_removal, p_tier, coalesce(p_intensive, false),
            calc_price(p_service, p_length, p_removal, coalesce(p_intensive, false)),
            least(now() + make_interval(hours => v_hold), v_start));
  exception when unique_violation then
    raise exception 'SLOT_TAKEN';
  end;

  return v_code;
end $$;
