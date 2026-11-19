insert into storage.buckets (id, name, public)
values ('photographs', 'photographs', true)
on conflict (id) do nothing;

create policy "users upload only to own photograph folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'photographs'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "users update only own photograph files"
on storage.objects for update to authenticated
using (
  bucket_id = 'photographs'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'photographs'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "users delete only own photograph files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'photographs'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
