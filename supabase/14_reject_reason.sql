-- 14_reject_reason.sql
-- Lets the nailtech give an optional reason when she rejects a booking.
-- The client sees it when they look up their booking. Run ONCE in the SQL Editor.

alter table public.bookings add column if not exists status_note text;

-- Same as before, plus 'status_note' (only sent for rejected bookings)
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
    'balance_paid', b.balance_paid, 'balance_method', b.balance_method,
    'status_note', case when b.status = 'rejected' then b.status_note end);
end $$;
