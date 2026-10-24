-- 17_full_removals.sql
-- New removals for Soft Gel / Hard Gel Extensions only:
--   hard_full = Hard Gel full removal  +200  (same times as Foreign Hard Gel removal)
--   biab_full = BIAB full removal      +100  (same times as Soft Gel removal w/ new set)
-- Run ONCE in the Supabase SQL Editor. Safe to run more than once.

-- 1. bookings may store the new codes
do $$ declare c text; begin   -- drop whichever old check limits the removal codes
  for c in select conname from pg_constraint
           where conrelid = 'public.bookings'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%removal%'
  loop execute format('alter table public.bookings drop constraint %I', c); end loop;
end $$;
alter table public.bookings add constraint bookings_removal_check
  check (removal in ('none','soft','fill','f_soft','f_hard','hard_full','biab_full'));

-- 2. which service can pick which removal (must match removalOk() in src/lib/config.js)
create or replace function public.removal_ok(p_service text, p_removal text) returns boolean
language sql immutable as $$
  select case p_removal
    when 'none' then true when 'soft' then true when 'f_soft' then true when 'f_hard' then true
    when 'fill'      then p_service in ('biab','hardgel')
    when 'hard_full' then p_service in ('softgel','hardgele')
    when 'biab_full' then p_service in ('softgel','hardgele')
    else false end
$$;

-- 3. prices (must match calcPrice() in src/lib/config.js)
create or replace function public.calc_price(p_service text, p_length text, p_removal text, p_intensive boolean)
returns int language sql immutable as $$
  select
    case p_service
      when 'biab'    then 550
      when 'hardgel' then 590
      when 'softgel' then case p_length when 'short' then 580 when 'medium' then 620 when 'long' then 650 end
      when 'hardgele'then case p_length when 'short' then 650 when 'medium' then 700 when 'long' then 750 end
    end
    + case p_removal when 'none' then 0 when 'fill' then 80 when 'soft' then 100 when 'f_soft' then 200 when 'f_hard' then 300
                     when 'hard_full' then 200 when 'biab_full' then 100 end
    + case when p_intensive then 300 else 0 end
$$;

-- 4. times: sheet months copy the existing rules (hard_full = f_hard, biab_full = soft) for extensions
insert into public.slot_rules (service, tier, removal, slot_time)
select r.service, r.tier, case r.removal when 'f_hard' then 'hard_full' else 'biab_full' end, r.slot_time
from public.slot_rules r
where r.service in ('softgel','hardgele') and r.removal in ('f_hard','soft')
  and not exists (select 1 from public.slot_rules x
                  where x.service = r.service and x.tier = r.tier and x.slot_time = r.slot_time
                    and x.removal = case r.removal when 'f_hard' then 'hard_full' else 'biab_full' end);

create or replace function public.slot_allowed(p_date date, p_time time, p_service text, p_tier int, p_removal text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v_any boolean; v_rules text;
begin
  if not removal_ok(p_service, p_removal) then return false; end if;
  select allow_any into v_any from schedule_days where day = p_date;
  if coalesce(v_any, false) then return true; end if;
  select ruleset into v_rules from schedule_months where month = month_start(p_date);
  if coalesce(v_rules, 'sheet') = 'nov_test' then
    return (p_time <> '13:00' or p_removal = 'none')
       and (p_removal not in ('f_hard','hard_full')
            or p_time = (select max(s.slot_time) from schedule_slots s where s.slot_date = p_date and s.is_open));
  end if;
  return exists (select 1 from slot_rules r
                 where r.service = p_service and r.tier = p_tier
                   and r.removal = p_removal and r.slot_time = p_time);
end $$;

-- 5. booking forms accept the new removals (same as before otherwise)
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
     or not removal_ok(p_service, p_removal)
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
     or not removal_ok(p_service, p_removal)
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

