-- 18_blocklist.sql
-- Blocked clients: anyone whose phone number OR Instagram handle is on this list can't book
-- from the website. The nailtech can still add bookings for them herself.
-- Run ONCE in the Supabase SQL Editor (safe to re-run).

create table if not exists public.blocked_clients (
  id         uuid primary key default gen_random_uuid(),
  phone      text,            -- stored normalised: 9171234567 (no 0 / +63)
  instagram  text,            -- stored normalised: lower case, no @
  name       text,
  reason     text,
  created_at timestamptz not null default now(),
  check (coalesce(phone, '') <> '' or coalesce(instagram, '') <> '')
);
alter table public.blocked_clients enable row level security;
drop policy if exists admin_all on public.blocked_clients;
create policy admin_all on public.blocked_clients for all to authenticated using (true) with check (true);

-- same rules as normPhone() in src/lib/clients.js
create or replace function public.norm_phone(p text) returns text language sql immutable as $$
  select case
    when d ~ '^63\d{10}$' then substr(d, 3)
    when d ~ '^0\d{10}$'  then substr(d, 2)
    else d end
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as d) x
$$;
create or replace function public.norm_ig(p text) returns text language sql immutable as $$
  select lower(regexp_replace(coalesce(p, ''), '[@\s]', '', 'g'))
$$;

create or replace function public.is_blocked(p_phone text, p_ig text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from blocked_clients b
                 where (b.phone is not null and b.phone <> '' and b.phone = norm_phone(p_phone))
                    or (b.instagram is not null and b.instagram <> '' and b.instagram = norm_ig(p_ig)))
$$;
revoke all on function public.is_blocked(text, text) from public, anon, authenticated;

-- every new booking made from the website is checked (the nailtech's own bookings are not)
create or replace function public.reject_blocked() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_role text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::json->>'role', '');
begin
  if v_role <> 'authenticated' and is_blocked(new.phone, new.instagram) then
    raise exception 'BLOCKED';
  end if;
  return new;
end $$;
drop trigger if exists bookings_reject_blocked on public.bookings;
create trigger bookings_reject_blocked before insert on public.bookings
  for each row execute function public.reject_blocked();
