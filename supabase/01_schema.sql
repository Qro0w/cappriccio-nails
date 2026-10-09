-- =====================================================================
-- Cappriccio Nails - 01_schema.sql   (run FIRST in Supabase SQL Editor)
-- =====================================================================
create extension if not exists pgcrypto;

-- ---------- TABLES ----------
create table public.settings (
  key   text primary key,
  value text not null
);

-- One row = one OPEN slot. No row = closed / off.
create table public.schedule_slots (
  slot_date  date not null,
  slot_time  time not null,
  rules_mode text not null default 'matrix' check (rules_mode in ('matrix','simple')),
  rolling    boolean not null default false,   -- true = only released ~2 weeks at a time (November). false = always visible (December)
  primary key (slot_date, slot_time)
);

-- The service/tier/removal/time checkbox matrix from the Scheduling doc
create table public.slot_rules (
  service   text not null,
  tier      int  not null,
  removal   text not null,
  slot_time time not null,
  primary key (service, tier, removal, slot_time)
);

create table public.bookings (
  id                  uuid primary key default gen_random_uuid(),
  code                text unique not null,
  status              text not null default 'awaiting_payment'
    check (status in ('awaiting_payment','payment_submitted','confirmed','completed','cancelled','rejected','expired','no_show')),
  slot_date           date not null,
  slot_time           time not null,
  full_name           text not null,
  instagram           text not null,
  phone               text not null,
  age                 int  not null,
  service             text not null check (service in ('biab','hardgel','softgel','hardgele')),
  length              text check (length in ('short','medium','long')),
  removal             text not null check (removal in ('none','soft','fill','f_soft','f_hard')),
  tier                int  not null check (tier between 1 and 4),
  intensive           boolean not null default false,
  estimated_price     int  not null,
  final_price         int,
  dp_amount           int,
  receipt_path        text,
  receipt_uploaded_at timestamptz,
  admin_note          text,
  rescheduled_count   int not null default 0,
  expires_at          timestamptz not null,
  created_at          timestamptz not null default now()
);

-- FIRST COME FIRST SERVED: only ONE active booking per slot, enforced by the database.
create unique index one_active_booking_per_slot
  on public.bookings (slot_date, slot_time)
  where status in ('awaiting_payment','payment_submitted','confirmed');

create index bookings_date_idx on public.bookings (slot_date, slot_time);

-- ---------- HELPERS ----------
create or replace function public.norm_phone(p text) returns text
language sql immutable as $$ select right(regexp_replace(coalesce(p,''), '\D', '', 'g'), 10) $$;

create or replace function public.slot_ts(d date, t time) returns timestamptz
language sql stable as $$ select (d + t) at time zone 'Asia/Manila' $$;

create or replace function public.gen_code() returns text
language plpgsql as $$
declare chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; out text := 'CPN-'; i int;
begin
  for i in 1..5 loop
    out := out || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  end loop;
  return out;
end $$;

-- Frees any slot whose 12h downpayment window ran out
create or replace function public.expire_stale() returns void
language sql security definer set search_path = public as $$
  update bookings set status = 'expired'
  where status = 'awaiting_payment' and expires_at < now();
$$;

-- Prices (from the Rates table in the Booking doc)
create or replace function public.calc_price(p_service text, p_length text, p_removal text, p_intensive boolean)
returns int language sql immutable as $$
  select
    case p_service
      when 'biab'    then 550
      when 'hardgel' then 590
      when 'softgel' then case p_length when 'short' then 580 when 'medium' then 620 when 'long' then 650 end
      when 'hardgele'then case p_length when 'short' then 650 when 'medium' then 700 when 'long' then 750 end
    end
    + case p_removal when 'none' then 0 when 'fill' then 80 when 'soft' then 100 when 'f_soft' then 200 when 'f_hard' then 300 end
    + case when p_intensive then 300 else 0 end
$$;

-- Intensive manicure conditions (from the Booking doc)
create or replace function public.intensive_allowed(p_service text, p_tier int, p_removal text)
returns boolean language sql immutable as $$
  select case
    when p_service in ('biab','hardgel')      then (p_tier = 1) or (p_tier = 2 and p_removal = 'none')
    when p_service in ('softgel','hardgele')  then (p_tier = 1 and p_removal = 'none')
    else false end
$$;

-- Is this open slot allowed for this service combo?
--  matrix mode (December): uses the checkbox matrix
--  simple mode (November): tiers don't matter; only "1pm = no removals",
--                          "structured fill only BIAB/Hard Gel", "foreign hard gel = last slot of the day"
create or replace function public.slot_allowed(p_date date, p_time time, p_mode text,
  p_service text, p_tier int, p_removal text)
returns boolean language sql stable set search_path = public as $$
  select case when p_mode = 'matrix' then
    exists (select 1 from slot_rules r
            where r.service = p_service and r.tier = p_tier
              and r.removal = p_removal and r.slot_time = p_time)
  else
    (p_removal <> 'fill'   or p_service in ('biab','hardgel'))
    and (p_time <> '13:00' or p_removal = 'none')
    and (p_removal <> 'f_hard'
         or p_time = (select max(s.slot_time) from schedule_slots s where s.slot_date = p_date))
  end
$$;

-- ---------- PUBLIC (client) FUNCTIONS ----------
create or replace function public.get_public_settings() returns json
language sql stable security definer set search_path = public as $$
  select json_object_agg(key, value) from settings
  where key in ('gcash_number','gcash_name','min_dp','hold_hours','window_days')
$$;

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
    'dp_amount', b.dp_amount, 'receipt_uploaded', b.receipt_path is not null,
    'expires_at', b.expires_at, 'created_at', b.created_at, 'location', v_loc);
end $$;

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
     set receipt_path = p_path, dp_amount = p_amount,
         receipt_uploaded_at = now(), status = 'payment_submitted'
   where id = b.id;
end $$;

-- Client self-cancel: only allowed MORE than 72h before the appointment
create or replace function public.client_cancel(p_code text, p_phone text)
returns void language plpgsql security definer set search_path = public as $$
declare b bookings;
begin
  perform expire_stale();
  select * into b from bookings
   where code = upper(trim(p_code)) and norm_phone(phone) = norm_phone(p_phone) for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if b.status not in ('awaiting_payment','payment_submitted','confirmed') then raise exception 'NOT_OPEN'; end if;
  if slot_ts(b.slot_date, b.slot_time) < now() + interval '72 hours' then raise exception 'TOO_LATE'; end if;
  update bookings set status = 'cancelled' where id = b.id;
end $$;

-- ---------- SECURITY (RLS) ----------
-- Clients (anon) can NOT touch tables directly; they only use the functions above.
-- The nailtech (a logged-in user) can read/write everything.
alter table public.settings       enable row level security;
alter table public.schedule_slots enable row level security;
alter table public.slot_rules     enable row level security;
alter table public.bookings       enable row level security;

create policy admin_all on public.settings       for all to authenticated using (true) with check (true);
create policy admin_all on public.schedule_slots for all to authenticated using (true) with check (true);
create policy admin_all on public.slot_rules     for all to authenticated using (true) with check (true);
create policy admin_all on public.bookings       for all to authenticated using (true) with check (true);
