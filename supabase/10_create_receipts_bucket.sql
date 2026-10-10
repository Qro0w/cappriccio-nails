-- =====================================================================
--  Fix: "Bucket not found" when clients upload a receipt.
--  Creates the receipts storage bucket (public read, random file names)
--  and its access rules. Safe to run more than once.
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', true, 10485760,
        array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

grant execute on function public.receipt_upload_allowed(text) to anon, authenticated;

drop policy if exists "receipts_upload"       on storage.objects;
drop policy if exists "receipts_client_read"  on storage.objects;
drop policy if exists "receipts_admin_read"   on storage.objects;
drop policy if exists "receipts_admin_list"   on storage.objects;
drop policy if exists "receipts_admin_delete" on storage.objects;

-- clients: upload only into the folder of their own open booking
create policy "receipts_upload" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'receipts' and public.receipt_upload_allowed(name));
create policy "receipts_client_read" on storage.objects
  for select to anon
  using (bucket_id = 'receipts' and public.receipt_upload_allowed(name));
-- nailtech: see and delete all receipts
create policy "receipts_admin_list" on storage.objects
  for select to authenticated using (bucket_id = 'receipts');
create policy "receipts_admin_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'receipts');
