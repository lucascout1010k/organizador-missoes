-- Etapa 2D.1: reconcile private Storage policies with the deletion lifecycle.
-- Supabase Storage remove() needs the object to remain selectable while deletion
-- is in progress, so deleting is visible to Storage without becoming readable
-- content in the application.
--
-- Application invariant for future signed URLs, downloads and previews:
-- re-read academic_materials and require file_status = 'ready' and
-- deleted_at is null before requesting access to the object.
begin;

drop policy if exists academic_materials_storage_select on storage.objects;

create policy academic_materials_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'academic-materials'
    and cardinality(storage.foldername(name)) = 3
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and storage.filename(name) = 'source.pdf'
    and exists (
      select 1
      from public.academic_materials as material
      where material.user_id = (select auth.uid())
        and material.subject_id::text = (storage.foldername(name))[2]
        and material.id::text = (storage.foldername(name))[3]
        and material.storage_path = name
        and material.file_status in ('ready', 'deleting')
        and material.deleted_at is null
    )
  );

drop policy if exists academic_materials_storage_delete on storage.objects;

create policy academic_materials_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'academic-materials'
    and cardinality(storage.foldername(name)) = 3
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and storage.filename(name) = 'source.pdf'
    and exists (
      select 1
      from public.academic_materials as material
      where material.user_id = (select auth.uid())
        and material.subject_id::text = (storage.foldername(name))[2]
        and material.id::text = (storage.foldername(name))[3]
        and material.storage_path = name
        and material.file_status = 'deleting'
        and material.deleted_at is null
    )
  );

commit;
