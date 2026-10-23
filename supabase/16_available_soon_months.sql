-- 16_available_soon_months.sql
-- Adds whole hidden MONTHS to "Available soon": if a future month is hidden but already has
-- times, clients see one "Available soon" across that month (no dates or times are shared).
-- Hidden weeks keep working as before. Run ONCE in the Supabase SQL Editor.

create or replace function public.get_slots(p_service text, p_tier int, p_removal text)
returns table (slot_date date, slot_time time, state text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare v_today date := (now() at time zone 'Asia/Manila')::date;
begin
  perform expire_stale();
  return query
  -- bookable days: every time, as before
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
  union all
  -- hidden days that still have upcoming times: ONE row per day, no time ("Available soon")
  select distinct s.slot_date, null::time, 'soon'
  from schedule_slots s
  join schedule_months m on m.month = month_start(s.slot_date) and m.visible   -- hidden months stay hidden
  where s.slot_date >= v_today
    and s.is_open
    and not slot_visible(s.slot_date)
    and slot_ts(s.slot_date, s.slot_time) > now()
  union all
  -- future months she hid that already have times: ONE row per month, no dates/times
  select distinct month_start(s.slot_date), null::time, 'soon_month'
  from schedule_slots s
  join schedule_months m on m.month = month_start(s.slot_date) and not m.visible
  where s.slot_date >= v_today
    and s.is_open
    and slot_ts(s.slot_date, s.slot_time) > now()
  order by 1, 2;
end $$;
