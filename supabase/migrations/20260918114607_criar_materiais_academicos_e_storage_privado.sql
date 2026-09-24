-- Etapa 2D.1: private academic materials, future AI analysis attempts and Storage policies.
-- Execute once, in full, in the SQL Editor of the intended Supabase project only after review.
-- This migration does not upload objects, call an AI provider or alter public.missions.
begin;

-- A material may reference an optional class only when user, subject and class all match.
do $block$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint as constraint_record
    where constraint_record.conrelid = 'public.class_sessions'::regclass
      and constraint_record.contype in ('p', 'u')
      and (
        select pg_catalog.array_agg(attribute_record.attname::text order by key_record.ordinality)
        from pg_catalog.unnest(constraint_record.conkey) with ordinality as key_record(attnum, ordinality)
        join pg_catalog.pg_attribute as attribute_record
          on attribute_record.attrelid = constraint_record.conrelid
         and attribute_record.attnum = key_record.attnum
      ) = array['user_id', 'subject_id', 'id']::text[]
  ) then
    alter table public.class_sessions
      add constraint class_sessions_owner_subject_id_key unique (user_id, subject_id, id);
  end if;
end;
$block$;

create table public.academic_materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject_id uuid not null,
  class_session_id uuid,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  original_filename text not null
    check (char_length(btrim(original_filename)) between 1 and 255),
  storage_path text not null,
  mime_type text not null check (mime_type = 'application/pdf'),
  size_bytes bigint not null check (size_bytes between 1 and 6291456),
  file_status text not null default 'pending_upload'
    check (file_status in ('pending_upload', 'ready', 'upload_failed', 'deleting', 'deleted')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academic_materials_owner_id_key unique (user_id, id),
  constraint academic_materials_storage_path_key unique (storage_path),
  constraint academic_materials_storage_path_check check (
    storage_path = user_id::text || '/' || subject_id::text || '/' || id::text || '/source.pdf'
  ),
  constraint academic_materials_deletion_check check (
    (file_status = 'deleted') = (deleted_at is not null)
  ),
  constraint academic_materials_subject_owner_fkey foreign key (user_id, subject_id)
    references public.subjects(user_id, id) on delete no action,
  constraint academic_materials_class_subject_owner_fkey
    foreign key (user_id, subject_id, class_session_id)
    references public.class_sessions(user_id, subject_id, id) on delete no action
);

alter table public.academic_materials enable row level security;
alter table public.academic_materials force row level security;
revoke all on table public.academic_materials from public, anon, authenticated;

create table public.academic_material_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  material_id uuid not null,
  status text not null,
  provider text not null check (char_length(btrim(provider)) between 1 and 100),
  model text not null check (char_length(btrim(model)) between 1 and 200),
  schema_version smallint not null check (schema_version > 0),
  result jsonb,
  error_code text check (
    error_code is null or char_length(btrim(error_code)) between 1 and 100
  ),
  consent_version text not null check (char_length(btrim(consent_version)) between 1 and 100),
  consented_at timestamptz not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academic_material_analyses_owner_id_key unique (user_id, id),
  constraint academic_material_analyses_material_owner_fkey foreign key (user_id, material_id)
    references public.academic_materials(user_id, id) on delete no action,
  constraint academic_material_analyses_status_value_check
    check (status in ('processing', 'completed', 'failed')),
  constraint academic_material_analyses_result_shape_check check (
    result is null or (
      jsonb_typeof(result) = 'object'
      and octet_length(result::text) <= 131072
    )
  ),
  constraint academic_material_analyses_status_check check (
    (
      status = 'processing'
      and result is null
      and error_code is null
      and completed_at is null
    ) or (
      status = 'completed'
      and result is not null
      and error_code is null
      and completed_at is not null
    ) or (
      status = 'failed'
      and result is null
      and completed_at is not null
    )
  ),
  constraint academic_material_analyses_timeline_check check (
    consented_at <= started_at
    and (completed_at is null or completed_at >= started_at)
  )
);

alter table public.academic_material_analyses enable row level security;
alter table public.academic_material_analyses force row level security;
revoke all on table public.academic_material_analyses from public, anon, authenticated;

-- FK/query indexes begin with user_id to support ownership filters and RLS.
create index academic_materials_user_subject_created_idx
  on public.academic_materials(user_id, subject_id, created_at desc);

create index academic_materials_user_class_session_idx
  on public.academic_materials(user_id, class_session_id)
  where class_session_id is not null;

create index academic_material_analyses_user_material_created_idx
  on public.academic_material_analyses(user_id, material_id, created_at desc);

create unique index academic_material_analyses_one_processing_idx
  on public.academic_material_analyses(user_id, material_id)
  where status = 'processing';

create policy academic_materials_select_own on public.academic_materials
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy academic_materials_insert_own on public.academic_materials
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy academic_materials_update_own on public.academic_materials
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy academic_materials_delete_own on public.academic_materials
  for delete to authenticated
  using (
    (select auth.uid()) = user_id
    and file_status = 'deleted'
    and deleted_at is not null
  );

create trigger academic_materials_set_updated_at
  before update on public.academic_materials
  for each row execute function app_private.set_updated_at();

create policy academic_material_analyses_select_own on public.academic_material_analyses
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy academic_material_analyses_insert_own on public.academic_material_analyses
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy academic_material_analyses_update_own on public.academic_material_analyses
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy academic_material_analyses_delete_own on public.academic_material_analyses
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create trigger academic_material_analyses_set_updated_at
  before update on public.academic_material_analyses
  for each row execute function app_private.set_updated_at();

grant usage on schema public to authenticated;
grant select, insert, update, delete on table
  public.academic_materials,
  public.academic_material_analyses
to authenticated;

-- Create the private bucket, or fail if a bucket with this id has incompatible settings.
do $block$
declare
  existing_bucket storage.buckets%rowtype;
begin
  select *
  into existing_bucket
  from storage.buckets
  where id = 'academic-materials';

  if found then
    if existing_bucket.name is distinct from 'academic-materials'
      or existing_bucket.public is distinct from false
      or existing_bucket.file_size_limit is distinct from 6291456
      or existing_bucket.allowed_mime_types is distinct from array['application/pdf']::text[]
    then
      raise exception using
        errcode = 'P0001',
        message = 'Bucket academic-materials already exists with incompatible configuration.';
    end if;
  else
    insert into storage.buckets (
      id,
      name,
      public,
      file_size_limit,
      allowed_mime_types
    ) values (
      'academic-materials',
      'academic-materials',
      false,
      6291456,
      array['application/pdf']::text[]
    );
  end if;
end;
$block$;

-- Canonical object path: <user-id>/<subject-id>/<material-id>/source.pdf.
-- Metadata ownership and exact stored path are the primary authorization boundary.
create policy academic_materials_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'academic-materials'
    and cardinality(storage.foldername(name)) = 3
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and storage.filename(name) = 'source.pdf'
    and lower(storage.extension(name)) = 'pdf'
    and exists (
      select 1
      from public.academic_materials as material
      where material.user_id = (select auth.uid())
        and material.subject_id::text = (storage.foldername(name))[2]
        and material.id::text = (storage.foldername(name))[3]
        and material.storage_path = name
        and material.file_status = 'pending_upload'
        and material.deleted_at is null
    )
  );

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
        and material.file_status = 'ready'
        and material.deleted_at is null
    )
  );

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
        and material.file_status in ('deleting', 'pending_upload', 'upload_failed')
        and material.deleted_at is null
    )
  );

notify pgrst, 'reload schema';
commit;
