-- Etapa 2D.2A: add the validation state and allow only the Storage upload
-- operation to read pending object metadata required by INSERT ... RETURNING.
-- The application must continue to require file_status = 'ready' and
-- deleted_at is null before offering file opening or download.
begin;

do $block$
begin
  if to_regprocedure('storage.allow_only_operation(text)') is null then
    raise exception using
      errcode = 'P0001',
      message = 'Required function storage.allow_only_operation(text) is unavailable.';
  end if;
end;
$block$;

alter table public.academic_materials
  drop constraint academic_materials_file_status_check;

alter table public.academic_materials
  add constraint academic_materials_file_status_check check (
    file_status in (
      'pending_upload',
      'validating',
      'ready',
      'upload_failed',
      'deleting',
      'deleted'
    )
  );

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
        and material.deleted_at is null
        and (
          (
            material.file_status = 'pending_upload'
            and storage.allow_only_operation('storage.object.upload')
          )
          or material.file_status in ('validating', 'ready', 'deleting')
        )
    )
  );

commit;
