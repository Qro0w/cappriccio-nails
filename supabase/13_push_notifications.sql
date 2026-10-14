-- 13_push_notifications.sql
-- Phone notifications for the nailtech (new booking, receipt uploaded, client cancelled).
-- Run ONCE in the Supabase SQL Editor, after the "notify" Edge Function is deployed.

-- 1) Lets the database call the Edge Function
create extension if not exists pg_net with schema extensions;

-- 2) Devices that turned notifications on (only the logged-in nailtech can see/edit these)
create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  p256dh     text not null,
  auth       text not null,
  device     text,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists admin_all on public.push_subscriptions;
create policy admin_all on public.push_subscriptions for all to authenticated using (true) with check (true);

-- 3) A private random password the database uses to call the function (never shown to clients)
insert into public.settings (key, value) values ('notify_secret', gen_random_uuid()::text)
on conflict (key) do nothing;

-- 4) Sends one notification (title / body / link) to every device that turned them on
create or replace function public.send_push(p_title text, p_body text, p_url text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare v_secret text;
begin
  select value into v_secret from settings where key = 'notify_secret';
  if v_secret is null or not exists (select 1 from push_subscriptions) then return; end if;
  perform net.http_post(
    url     := 'https://avpjkkubnlwhkbmtutwz.supabase.co/functions/v1/notify',
    body    := jsonb_build_object('title', p_title, 'body', p_body, 'url', p_url),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-notify-secret', v_secret,
      -- public "anon" key (the same one the website uses); lets the call through Supabase's gateway
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2cGpra3Vibmx3aGtibXR1dHd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0OTE5OTcsImV4cCI6MjEwNzA2Nzk5N30.VD40wqzD9vDv8ieUeD39B9kE8CTu-aze_60IYniuJd8'
    ),
    timeout_milliseconds := 8000
  );
exception when others then
  null; -- a notification problem must never stop a booking from saving
end $$;
revoke all on function public.send_push(text, text, text) from public, anon, authenticated;

-- 5) Decide when to notify. Only things CLIENTS do (not changes the nailtech makes herself).
create or replace function public.notify_booking_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_role text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::json->>'role', '');
  v_when text := to_char(new.slot_date, 'Dy, Mon FMDD') || ' · ' || ltrim(to_char(new.slot_time, 'HH12:MI AM'), '0');
  v_url  text := '/admin/booking/' || new.id;
begin
  if v_role = 'authenticated' then return new; end if;
  if tg_op = 'INSERT' then
    perform send_push('New booking ✿', new.full_name || ' · ' || v_when || ' · waiting for downpayment', v_url);
  elsif new.status is distinct from old.status then
    if new.status = 'payment_submitted' then
      perform send_push('Receipt to check 🧾', new.full_name || ' sent ₱' || coalesce(new.dp_amount::text, '?') || ' for ' || v_when, v_url);
    elsif new.status = 'cancelled' then
      perform send_push('Booking cancelled', new.full_name || ' cancelled ' || v_when, v_url);
    end if;
  end if;
  return new;
end $$;

drop trigger if exists bookings_notify on public.bookings;
create trigger bookings_notify after insert or update on public.bookings
  for each row execute function public.notify_booking_change();
