grant execute on function public.receipt_upload_allowed(text) to anon, authenticated;

drop policy if exists "receipts_upload"      on storage.objects;
drop policy if exists "receipts_client_read" on storage.objects;

create policy "receipts_upload" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'receipts' and public.receipt_upload_allowed(name));

create policy "receipts_client_read" on storage.objects
  for select to anon
  using (bucket_id = 'receipts' and public.receipt_upload_allowed(name));

update storage.buckets
   set allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','image/heif'],
       file_size_limit = 10485760
 where id = 'receipts';