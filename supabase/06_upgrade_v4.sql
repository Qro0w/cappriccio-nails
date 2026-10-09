-- =====================================================================
-- Cappriccio Nails - 06_upgrade_v4.sql
-- Run ONCE in the Supabase SQL Editor. Keeps every existing booking.
--   * month + day visibility, per-month rule sets, per-day "allow any combo"
--   * November / December schedule re-filled from the sheets
--   * 72-hour downpayment window, policy acceptance saved on each booking
--   * private notes table, tier photos, receipts viewable by their owner
-- =====================================================================

create or replace function public.month_start(d date) returns date
language sql immutable as $$ select d - (extract(day from d)::int - 1) $$;

-- ---------- 1. month + day controls ----------
create table if not exists public.schedule_months (
  month       date primary key check (extract(day from month) = 1),
  visible     boolean not null default false,
  ruleset     text    not null default 'sheet' check (ruleset in ('sheet','nov_test')),
  window_days int     check (window_days is null or window_days >= 0)
);
create table if not exists public.schedule_days (
  day       date primary key,
  visible   boolean not null default true,
  allow_any boolean not null default false
);

-- ---------- 2. booking changes ----------
alter table public.bookings add column if not exists policy_version     text;
alter table public.bookings add column if not exists policy_accepted_at  timestamptz;

create table if not exists public.booking_notes (
  booking_id uuid primary key references public.bookings(id) on delete cascade,
  note       text not null default '',
  updated_at timestamptz not null default now()
);
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='bookings' and column_name='admin_note') then
    insert into public.booking_notes (booking_id, note)
      select id, admin_note from public.bookings where admin_note is not null and trim(admin_note) <> ''
      on conflict do nothing;
    alter table public.bookings drop column admin_note;
  end if;
end $$;

-- ---------- 3. tier reference photos ----------
create table if not exists public.tier_images (
  id         uuid primary key default gen_random_uuid(),
  tier       int  not null check (tier between 1 and 4),
  path       text not null unique,
  created_at timestamptz not null default now()
);

-- ---------- 4. settings ----------
update public.settings set value = '72' where key = 'hold_hours';
delete from public.settings where key = 'window_days';

-- ---------- 5. availability logic ----------
create or replace function public.slot_visible(p_date date) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  m       schedule_months;
  v_day   boolean;
  v_today date := (now() at time zone 'Asia/Manila')::date;
begin
  select * into m from schedule_months where month = month_start(p_date);
  if not found or not m.visible then return false; end if;
  select visible into v_day from schedule_days where day = p_date;
  if v_day is not null and not v_day then return false; end if;
  if m.window_days is not null and p_date > v_today + m.window_days then return false; end if;
  return true;
end $$;

drop function if exists public.slot_allowed(date, time, text, text, int, text);
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
       and (p_removal <> 'f_hard' or p_time = (select max(s.slot_time) from schedule_slots s where s.slot_date = p_date));
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
    and slot_visible(s.slot_date)
    and slot_ts(s.slot_date, s.slot_time) > now()
  order by s.slot_date, s.slot_time;
end $$;

drop function if exists public.create_booking(text,text,text,int,text,text,text,int,boolean,date,time);
drop function if exists public.create_booking(text,text,text,int,text,text,text,int,boolean,date,time,text);
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

  if not exists (select 1 from schedule_slots where slot_date = p_date and slot_time = p_time)
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
    'dp_amount', b.dp_amount, 'receipt_uploaded', b.receipt_path is not null, 'receipt_path', b.receipt_path,
    'expires_at', b.expires_at, 'created_at', b.created_at, 'location', v_loc);
end $$;

-- ---------- 6. security (RLS) ----------
alter table public.schedule_months enable row level security;
alter table public.schedule_days   enable row level security;
alter table public.booking_notes   enable row level security;
alter table public.tier_images     enable row level security;
drop policy if exists admin_all   on public.schedule_months;
drop policy if exists admin_all   on public.schedule_days;
drop policy if exists admin_all   on public.booking_notes;
drop policy if exists admin_all   on public.tier_images;
drop policy if exists public_read on public.tier_images;
create policy admin_all   on public.schedule_months for all to authenticated using (true) with check (true);
create policy admin_all   on public.schedule_days   for all to authenticated using (true) with check (true);
create policy admin_all   on public.booking_notes   for all to authenticated using (true) with check (true);
create policy admin_all   on public.tier_images     for all to authenticated using (true) with check (true);
create policy public_read on public.tier_images     for select to anon, authenticated using (true);

-- ---------- 7. storage ----------
create or replace function public.receipt_upload_allowed(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from bookings b
                 where b.code = split_part(p_name, '/', 1)
                   and b.status in ('awaiting_payment','payment_submitted'))
$$;

update storage.buckets set public = true where id = 'receipts';
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tier-photos', 'tier-photos', true, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "receipts_upload"       on storage.objects;
drop policy if exists "receipts_admin_delete" on storage.objects;
drop policy if exists "receipts_admin_list"   on storage.objects;
drop policy if exists "tier_photos_admin_all" on storage.objects;
create policy "receipts_upload" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'receipts' and public.receipt_upload_allowed(name));
create policy "receipts_admin_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'receipts');
create policy "receipts_admin_list" on storage.objects
  for select to authenticated using (bucket_id = 'receipts');
create policy "tier_photos_admin_all" on storage.objects
  for all to authenticated using (bucket_id = 'tier-photos') with check (bucket_id = 'tier-photos');

-- ---------- 8. month settings + schedule, re-filled from the sheets ----------
insert into public.schedule_months (month, visible, ruleset, window_days) values
  (date '2026-11-01', true,  'nov_test', 14),
  (date '2026-12-01', false, 'sheet',    null)
on conflict (month) do update set ruleset = excluded.ruleset, window_days = excluded.window_days;

-- remove old/test slots in Nov-Dec that have no active booking (slots WITH a booking are never touched)
delete from public.schedule_slots s
 where s.slot_date between date '2026-11-01' and date '2026-12-31'
   and not exists (select 1 from public.bookings b
                   where b.slot_date = s.slot_date and b.slot_time = s.slot_time
                     and b.status in ('awaiting_payment','payment_submitted','confirmed'));

-- NOVEMBER: 3 = 9:00 AM, 1:00 PM, 4:00 PM      2 = 12:00 PM, 4:00 PM
-- DECEMBER: 4 = 9:00 AM, 12:00 PM, 2:30 PM, 5:00 PM     3 = 11:00 AM, 2:30 PM, 5:00 PM
--           2 = 2:30 PM, 5:00 PM (Dec 20: the sheet gives no times; editable in the app)
insert into public.schedule_slots (slot_date, slot_time)
select p.d, t::time
from (
  select date '2026-11-01' + (o - 1)::int as d, n, 'nov'::text as mo
  from unnest(array[3,2,0,2,3,2,0, 3,2,3,0,2,3,2, 0,3,2,3,0,2,3, 2,0,3,2,3,0,3, 0,3]) with ordinality as x(n, o)
  union all
  select date '2026-12-01' + (o - 1)::int, n, 'dec'::text
  from unnest(array[3,0,4,3,4, 3,0,4,3,4,3,0, 4,3,4,0,4,3,4, 2,4,0,3,0,0,0, 0,0,0,0,0]) with ordinality as x(n, o)
) p
cross join lateral unnest(
  case
    when p.mo = 'nov' and p.n = 3 then array['09:00','13:00','16:00']
    when p.mo = 'nov' and p.n = 2 then array['12:00','16:00']
    when p.mo = 'dec' and p.n = 4 then array['09:00','12:00','14:30','17:00']
    when p.mo = 'dec' and p.n = 3 then array['11:00','14:30','17:00']
    when p.mo = 'dec' and p.n = 2 then array['14:30','17:00']
    else array[]::text[]
  end) as t
on conflict do nothing;

alter table public.schedule_slots drop column if exists rules_mode;
alter table public.schedule_slots drop column if exists rolling;
