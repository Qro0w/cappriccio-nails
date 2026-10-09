-- =====================================================================
-- Cappriccio Nails - 03_storage.sql   (run THIRD) - receipt screenshots
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- Clients (not logged in) may upload a receipt, but never read/list/delete any.
create policy "receipts_upload" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'receipts');
-- Only the nailtech can view receipts.
create policy "receipts_admin_read" on storage.objects
  for select to authenticated using (bucket_id = 'receipts');
