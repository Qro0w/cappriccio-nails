-- =====================================================================
--  v6 update. Run AFTER 06_upgrade_v4.sql and 07_presets.sql. Safe to run more than once.
--   1. time slots can be "closed" (kept on the day but not bookable) or removed completely
--   2. downpayment window fixed at 12 hours from reserving
--   3. the 2-week window is removed (the nailtech hides days herself)
--   4. bookings get updated_at so the newest activity can be shown first
-- =====================================================================

-- 1. open / closed slots
alter table public.schedule_slots add column if not exists is_open boolean not null default true;

create or replace function public.slot_allowed(p_date date, p_time time, p_service text, p_tier int, p_removal text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v_any boolean; v_rules text;
begin
  select allow_any into v_any from schedule_days where day = p_date;
  if coalesce(v_any, false) then return true; end if;
  select ruleset into v_rules from schedule_months where month = month_start(p_date);
  if coalesce(v_rules, 'sheet') = 'nov_test' then
    return (p_removal <> 'fill' or p_service in ('biab','hardgel'))
       and (p_time <> '13:00' or p_removal = 'none')
       and (p_removal <> 'f_hard' or p_time = (select max(s.slot_time) from schedule_slots s where s.slot_date = p_date and s.is_open));
  end if;
  return exists (select 1 from slot_rules r
                 where r.service = p_service and r.tier = p_tier
                   and r.removal = p_removal and r.slot_time = p_time);
end $$;

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
  order by s.slot_date, s.slot_time;
end $$;

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
     or not slot_allowed(p_date, p_time, p_service, p_tier, p_removal)
  then raise exception 'SLOT_UNAVAILABLE'; end if;

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

-- 2. 12-hour downpayment (applies to NEW bookings; existing timers are left as they are)
insert into public.settings (key, value) values ('hold_hours', '12')
on conflict (key) do update set value = excluded.value;

-- 3. no more 2-week window
update public.schedule_months set window_days = null;

-- 4. last activity time on each booking
alter table public.bookings add column if not exists updated_at timestamptz;
update public.bookings set updated_at = coalesce(receipt_uploaded_at, created_at) where updated_at is null;
alter table public.bookings alter column updated_at set default now();
alter table public.bookings alter column updated_at set not null;
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists bookings_touch on public.bookings;
create trigger bookings_touch before update on public.bookings
  for each row execute function public.touch_updated_at();
