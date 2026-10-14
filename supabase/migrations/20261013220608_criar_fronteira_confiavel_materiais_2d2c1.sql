-- 2D.2C.1: LOCAL REVIEW ONLY. Do not apply before the application changes below.
-- prepareMaterialUpload must omit user_id, file_status and deleted_at from INSERT.
-- reportMaterialUploadFailure must call public.report_material_upload_failure.
-- Later report adapter: supabase.rpc('report_material_upload_failure',
-- { p_material_id: materialId }).maybeSingle(); remove its userId UPDATE/filter
-- argument. Null data => RESOURCE_UNAVAILABLE; SDK error => REPORT_FAILED.
-- Keep getClaims(), UUID/ownership checks, canonical path and UI contracts.
-- failureCategory stays a browser hint and is NOT passed/persisted by the RPC.
-- Do not apply before coordinating those TypeScript changes: the old explicit
-- protected-column INSERT and direct UPDATE will fail under the new grants.
-- No Next.js finalize, PDF download, PostgreSQL driver or runtime credentials here.
-- Authorization capabilities are for server-side application use, never UI DTOs.
-- A capability alone cannot invoke privileged functions: SQL role permission is
-- also required. The validator remains NONLOGIN until separate provisioning.
-- Storage/bucket/policies are untouched; in-flight upload reconciliation is deferred.
-- Stored observations attest to a trusted future server's checks, not SQL PDF parsing.
-- Hosted provisioner: postgres with CREATEROLE. PG16+ creates one automatic
-- ADMIN TRUE / SET FALSE / INHERIT FALSE membership per new role, grantor OID 10
-- (the PostgreSQL bootstrap role, whose name may differ on hosted deployments).
-- This administrative control-plane membership is explicitly accepted. A separate
-- executor SET grant by postgres exists only inside this transaction for option A:
-- create functions as postgres, then ALTER FUNCTION OWNER. No SET ROLE is used.
-- Temporary schema CREATE and the self-granted membership are revoked before
-- postflight/COMMIT; no runtime membership or credential is provisioned here.
-- Runtime roles remain NONLOGIN/NOSUPERUSER/NOBYPASSRLS, and never own tables.

begin;
set local search_path = '';
-- OFF does not bypass RLS: it raises if rows would be filtered, protecting the
-- complete READY audit. Every runtime function explicitly switches it back ON.
set local row_security = off;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Fail closed before any DDL/revocation. No retroactive validation or reclassification.
do $preflight$
declare
  v_materials oid := pg_catalog.to_regclass('public.academic_materials');
  v_owner oid;
  v_ready_count pg_catalog.int8;
  v_expected pg_catalog.record;
  v_expression pg_catalog.text;
  v_crypto_schema pg_catalog.text;
  v_role oid;
begin
  if pg_catalog.current_setting('server_version_num')::pg_catalog.int4 < 160000 then
    raise exception '2D.2C.1 requires PostgreSQL 16+ role membership semantics.';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_roles where rolname = current_user
      and rolname = 'postgres' and rolcreaterole
  ) then
    raise exception '2D.2C.1 requires the administrative postgres provisioner with CREATEROLE, never an application runtime role.';
  end if;
  if v_materials is null or pg_catalog.to_regprocedure('auth.uid()') is null
    or pg_catalog.to_regprocedure('auth.jwt()') is null then
    raise exception '2D.2C.1 academic_materials/Auth foundation is unavailable.';
  end if;
  select relowner into v_owner from pg_catalog.pg_class
  where oid = v_materials and relkind = 'r' and relrowsecurity and relforcerowsecurity;
  if v_owner is distinct from (select oid from pg_catalog.pg_roles where rolname = 'postgres') then
    raise exception '2D.2C.1 requires postgres-owned academic_materials with RLS and FORCE RLS.';
  end if;
  if exists (
    select 1 from pg_catalog.pg_roles
    where rolname in ('material_transition_executor', 'material_validator')
  ) or pg_catalog.to_regnamespace('app_materials_private') is not null then
    raise exception '2D.2C.1 role/schema collision; review existing objects, do not overwrite.';
  end if;
  if exists (
    select 1 from pg_catalog.pg_namespace as n
    cross join lateral pg_catalog.aclexplode(coalesce(n.nspacl, pg_catalog.acldefault('n', n.nspowner))) as acl
    where acl.grantee = 0 and acl.privilege_type = 'CREATE'
      and n.nspname !~ '^pg_(temp|toast_temp)_'
  ) then
    raise exception '2D.2C.1 inherited PUBLIC schema CREATE must be reviewed separately.';
  end if;
  if exists (
    select 1 from pg_catalog.pg_proc as p
    join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('report_material_upload_failure', 'issue_material_authorization')
  ) then
    raise exception '2D.2C.1 public function collision; no overload is replaced.';
  end if;
  if (select pg_catalog.count(*) from pg_catalog.pg_roles
      where rolname in ('anon', 'authenticated', 'service_role', 'authenticator')) <> 4 then
    raise exception '2D.2C.1 required Supabase roles are missing.';
  end if;
  for v_role in select oid from pg_catalog.pg_roles where rolname in ('anon', 'authenticated') loop
    if exists (
      select 1 from pg_catalog.pg_roles as r
      where pg_catalog.pg_has_role(v_role, r.oid, 'MEMBER')
        and (r.rolsuper or r.rolbypassrls or r.rolcreatedb or r.rolcreaterole or r.rolreplication
          or r.rolcanlogin or r.rolname in ('postgres','service_role','authenticator'))
    ) then
      raise exception '2D.2C.1 client role has a dangerous inherited/SET-role capability.';
    end if;
  end loop;
  if exists (
    select 1 from pg_catalog.pg_db_role_setting as s
    cross join lateral pg_catalog.unnest(s.setconfig) as setting(value)
    where setting.value like 'pgrst.db_schemas=%'
      and setting.value ~ '(^|[,=[:space:]])app_materials_private([,[:space:]]|$)'
  ) or coalesce(pg_catalog.current_setting('pgrst.db_schemas', true), '')
    ~ '(^|[,[:space:]])app_materials_private([,[:space:]]|$)' then
    raise exception '2D.2C.1 private schema must not be exposed by PostgREST.';
  end if;

  select n.nspname into v_crypto_schema
  from pg_catalog.pg_extension as e
  join pg_catalog.pg_namespace as n on n.oid = e.extnamespace
  where e.extname = 'pgcrypto';
  if v_crypto_schema is distinct from 'extensions'
    or pg_catalog.to_regprocedure('extensions.gen_random_bytes(integer)') is null
    or pg_catalog.to_regprocedure('extensions.digest(bytea,text)') is null
    or pg_catalog.to_regprocedure('pg_catalog.gen_random_uuid()') is null then
    raise exception '2D.2C.1 requires reviewed pgcrypto in extensions, gen_random_bytes(integer), digest(bytea,text), and core gen_random_uuid().';
  end if;
  -- Verify extension ownership of the exact routines, not search_path impostors.
  if (select pg_catalog.count(*)
      from pg_catalog.pg_depend as d
      join pg_catalog.pg_extension as e on e.oid = d.refobjid
      where d.classid = 'pg_catalog.pg_proc'::pg_catalog.regclass
        and d.refclassid = 'pg_catalog.pg_extension'::pg_catalog.regclass
        and d.deptype = 'e' and e.extname = 'pgcrypto'
        and d.objid in (
          'extensions.gen_random_bytes(integer)'::pg_catalog.regprocedure,
          'extensions.digest(bytea,text)'::pg_catalog.regprocedure
        )) <> 2
    or pg_catalog.octet_length(extensions.gen_random_bytes(32)) <> 32
    or pg_catalog.encode(extensions.digest(pg_catalog.decode('616263', 'hex'), 'sha256'), 'hex')
       <> 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' then
    raise exception '2D.2C.1 cryptographic preflight failed.';
  end if;

  -- Serialize the READY check with writers until the new boundary commits.
  lock table public.academic_materials in access exclusive mode;
  select pg_catalog.count(*) into v_ready_count
  from public.academic_materials where file_status = 'ready';
  if v_ready_count <> 0 then
    raise exception '2D.2C.1 aborted: % existing ready material(s) have no trusted attempt.', v_ready_count;
  end if;

  if (select pg_catalog.count(*) from pg_catalog.pg_attribute
      where attrelid = v_materials and attnum > 0 and not attisdropped) <> 13 then
    raise exception '2D.2C.1 unexpected academic_materials columns.';
  end if;
  for v_expected in select * from (values
    ('id', 'uuid', true), ('user_id', 'uuid', true), ('subject_id', 'uuid', true),
    ('class_session_id', 'uuid', false), ('title', 'text', true),
    ('original_filename', 'text', true), ('storage_path', 'text', true),
    ('mime_type', 'text', true), ('size_bytes', 'bigint', true),
    ('file_status', 'text', true), ('deleted_at', 'timestamp with time zone', false),
    ('created_at', 'timestamp with time zone', true), ('updated_at', 'timestamp with time zone', true)
  ) as expected(column_name, type_name, required) loop
    if not exists (
      select 1 from pg_catalog.pg_attribute as a
      where a.attrelid = v_materials and a.attname = v_expected.column_name
        and a.atttypid = v_expected.type_name::pg_catalog.regtype
        and a.attnotnull = v_expected.required and a.attgenerated = '' and a.attidentity = ''
    ) then
      raise exception '2D.2C.1 unexpected type/nullability/generated column: %.', v_expected.column_name;
    end if;
  end loop;
  for v_expected in select * from (values
    ('user_id', 'auth.uid()'), ('file_status', '''pending_upload''::text'),
    ('created_at', 'now()'), ('updated_at', 'now()')
  ) as expected(column_name, expression) loop
    select pg_catalog.pg_get_expr(d.adbin, d.adrelid) into v_expression
    from pg_catalog.pg_attrdef as d
    join pg_catalog.pg_attribute as a on a.attrelid = d.adrelid and a.attnum = d.adnum
    where d.adrelid = v_materials and a.attname = v_expected.column_name;
    if v_expression is distinct from v_expected.expression then
      raise exception '2D.2C.1 unexpected protected default: %.', v_expected.column_name;
    end if;
  end loop;
  if exists (
    select 1 from pg_catalog.pg_attrdef as d
    join pg_catalog.pg_attribute as a on a.attrelid = d.adrelid and a.attnum = d.adnum
    where d.adrelid = v_materials and a.attname = 'deleted_at'
  ) then
    raise exception '2D.2C.1 deleted_at must have its original implicit NULL default.';
  end if;

  for v_expected in select * from (values
    ('academic_materials_pkey', 'p'), ('academic_materials_user_id_fkey', 'f'),
    ('academic_materials_title_check', 'c'), ('academic_materials_original_filename_check', 'c'),
    ('academic_materials_mime_type_check', 'c'), ('academic_materials_size_bytes_check', 'c'),
    ('academic_materials_file_status_check', 'c'), ('academic_materials_owner_id_key', 'u'),
    ('academic_materials_storage_path_key', 'u'), ('academic_materials_storage_path_check', 'c'),
    ('academic_materials_deletion_check', 'c'), ('academic_materials_subject_owner_fkey', 'f'),
    ('academic_materials_class_subject_owner_fkey', 'f')
  ) as expected(constraint_name, constraint_type) loop
    if not exists (
      select 1 from pg_catalog.pg_constraint as c
      where c.conrelid = v_materials and c.conname = v_expected.constraint_name
        and c.contype::pg_catalog.text = v_expected.constraint_type and c.convalidated
        and not c.condeferrable and not c.condeferred
    ) then
      raise exception '2D.2C.1 missing/incompatible constraint: %.', v_expected.constraint_name;
    end if;
  end loop;
  for v_expected in select * from (values
    ('academic_materials_file_status_check', 'file_status=anyarray[''pending_upload''::text,''validating''::text,''ready''::text,''upload_failed''::text,''deleting''::text,''deleted''::text]'),
    ('academic_materials_storage_path_check', 'storage_path=user_id::text||''/''::text||subject_id::text||''/''::text||id::text||''/source.pdf''::text'),
    ('academic_materials_deletion_check', 'file_status=''deleted''::text=deleted_atisnotnull'),
    ('academic_materials_mime_type_check', 'mime_type=''application/pdf''::text'),
    ('academic_materials_size_bytes_check', 'size_bytes>=1andsize_bytes<=6291456'),
    ('academic_materials_title_check', 'char_lengthbtrimtitle>=1andchar_lengthbtrimtitle<=200'),
    ('academic_materials_original_filename_check', 'char_lengthbtrimoriginal_filename>=1andchar_lengthbtrimoriginal_filename<=255')
  ) as expected(constraint_name, expression) loop
    select pg_catalog.lower(pg_catalog.regexp_replace(
      pg_catalog.pg_get_expr(c.conbin, c.conrelid), '[()[:space:]]', '', 'g')) into v_expression
    from pg_catalog.pg_constraint as c
    where c.conrelid = v_materials and c.conname = v_expected.constraint_name;
    if v_expression is distinct from v_expected.expression then
      raise exception '2D.2C.1 unexpected CHECK definition: %.', v_expected.constraint_name;
    end if;
  end loop;
  for v_expected in select * from (values
    ('academic_materials_pkey', array['id']::pg_catalog.text[], null::pg_catalog.text, null::pg_catalog.text[], null::pg_catalog.text),
    ('academic_materials_owner_id_key', array['user_id','id']::pg_catalog.text[], null::pg_catalog.text, null::pg_catalog.text[], null::pg_catalog.text),
    ('academic_materials_storage_path_key', array['storage_path']::pg_catalog.text[], null::pg_catalog.text, null::pg_catalog.text[], null::pg_catalog.text),
    ('academic_materials_user_id_fkey', array['user_id']::pg_catalog.text[], 'auth.users', array['id']::pg_catalog.text[], 'c'),
    ('academic_materials_subject_owner_fkey', array['user_id','subject_id']::pg_catalog.text[], 'public.subjects', array['user_id','id']::pg_catalog.text[], 'a'),
    ('academic_materials_class_subject_owner_fkey', array['user_id','subject_id','class_session_id']::pg_catalog.text[], 'public.class_sessions', array['user_id','subject_id','id']::pg_catalog.text[], 'a')
  ) as expected(constraint_name, columns, target_table, target_columns, deletion_action) loop
    if not exists (
      select 1 from pg_catalog.pg_constraint as c
      where c.conrelid = v_materials and c.conname = v_expected.constraint_name
        and (select pg_catalog.array_agg(a.attname::pg_catalog.text order by k.position)
          from pg_catalog.unnest(c.conkey) with ordinality as k(number, position)
          join pg_catalog.pg_attribute as a on a.attrelid = c.conrelid and a.attnum = k.number)
          = v_expected.columns
        and (v_expected.target_table is null or (
          c.confrelid = v_expected.target_table::pg_catalog.regclass
          and c.confupdtype = 'a' and c.confdeltype::pg_catalog.text = v_expected.deletion_action
          and (select pg_catalog.array_agg(a.attname::pg_catalog.text order by k.position)
            from pg_catalog.unnest(c.confkey) with ordinality as k(number, position)
            join pg_catalog.pg_attribute as a on a.attrelid = c.confrelid and a.attnum = k.number)
            = v_expected.target_columns
        ))
    ) then
      raise exception '2D.2C.1 unexpected key/FK: %.', v_expected.constraint_name;
    end if;
  end loop;
  if (select pg_catalog.count(*) from pg_catalog.pg_trigger
      where tgrelid = v_materials and not tgisinternal) <> 1
    or not exists (
      select 1 from pg_catalog.pg_trigger
      where tgrelid = v_materials and tgname = 'academic_materials_set_updated_at'
        and tgfoid = pg_catalog.to_regprocedure('app_private.set_updated_at()')
        and tgenabled = 'O' and tgtype = 19
    ) then
    raise exception '2D.2C.1 unexpected material trigger; inspect before changing privileges.';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_proc as p
    where p.oid = pg_catalog.to_regprocedure('app_private.set_updated_at()')
      and not p.prosecdef
      and pg_catalog.lower(pg_catalog.regexp_replace(p.prosrc, '[[:space:]]', '', 'g'))
        = 'beginnew.created_at:=old.created_at;new.updated_at:=pg_catalog.statement_timestamp();returnnew;end;'
  ) then
    raise exception '2D.2C.1 unexpected updated-at trigger body; report must not promote confidence.';
  end if;

  -- Expect only the four original client policies; never silently retain a backdoor.
  if (select pg_catalog.count(*) from pg_catalog.pg_policy where polrelid = v_materials) <> 4 then
    raise exception '2D.2C.1 unexpected material policies.';
  end if;
  for v_expected in select * from (values
    ('academic_materials_select_own', 'r'), ('academic_materials_insert_own', 'a'),
    ('academic_materials_update_own', 'w'), ('academic_materials_delete_own', 'd')
  ) as expected(policy_name, command) loop
    if not exists (
      select 1 from pg_catalog.pg_policy
      where polrelid = v_materials and polname = v_expected.policy_name
        and polcmd::pg_catalog.text = v_expected.command and polpermissive
        and polroles = array['authenticated'::pg_catalog.regrole::oid]
    ) then
      raise exception '2D.2C.1 unexpected client policy: %.', v_expected.policy_name;
    end if;
  end loop;
  select pg_catalog.lower(pg_catalog.regexp_replace(
    pg_catalog.pg_get_expr(p.polqual, p.polrelid), '[()[:space:]]', '', 'g')) into v_expression
  from pg_catalog.pg_policy as p
  where p.polrelid = v_materials and p.polname = 'academic_materials_select_own';
  if v_expression is distinct from 'selectauth.uidasuid=user_id' then
    raise exception '2D.2C.1 SELECT policy is not the expected ownership boundary.';
  end if;
  if not pg_catalog.has_table_privilege('authenticated', v_materials, 'SELECT')
    or not pg_catalog.has_table_privilege('authenticated', v_materials, 'INSERT')
    or not pg_catalog.has_table_privilege('authenticated', v_materials, 'UPDATE')
    or not pg_catalog.has_table_privilege('authenticated', v_materials, 'DELETE') then
    raise exception '2D.2C.1 expected current authenticated CRUD grants are missing.';
  end if;
  if exists (
    select 1 from pg_catalog.pg_class as c
    cross join lateral pg_catalog.aclexplode(coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))) as acl
    where c.oid = v_materials and acl.grantee <> v_owner
      and (acl.grantee not in ('authenticated'::pg_catalog.regrole::oid, 'service_role'::pg_catalog.regrole::oid)
        or (acl.grantee = 'authenticated'::pg_catalog.regrole::oid
          and (acl.is_grantable or acl.privilege_type not in ('SELECT','INSERT','UPDATE','DELETE'))))
  ) or exists (
    select 1 from pg_catalog.pg_attribute as a
    cross join lateral pg_catalog.aclexplode(a.attacl) as acl
    where a.attrelid = v_materials and a.attnum > 0
      and acl.grantee <> v_owner
      and (acl.grantee not in ('authenticated'::pg_catalog.regrole::oid, 'service_role'::pg_catalog.regrole::oid)
        or (acl.grantee = 'authenticated'::pg_catalog.regrole::oid and acl.is_grantable))
  ) then
    raise exception '2D.2C.1 unexpected PUBLIC/anon/third-party/grant-option material privileges.';
  end if;
end;
$preflight$;

create role material_transition_executor
  nologin noinherit nosuperuser nobypassrls nocreatedb nocreaterole noreplication;
create role material_validator
  nologin noinherit nosuperuser nobypassrls nocreatedb nocreaterole noreplication;

-- Check the automatic grants before adding a distinguishable temporary grant.
-- OID 10 is PostgreSQL's bootstrap grantor; do not accept a same-named substitute.
do $creator_memberships$
declare
  v_provisioner pg_catalog.oid := current_user::pg_catalog.regrole;
  v_executor pg_catalog.oid := 'material_transition_executor'::pg_catalog.regrole;
  v_validator pg_catalog.oid := 'material_validator'::pg_catalog.regrole;
begin
  if (select pg_catalog.count(*) from pg_catalog.pg_auth_members
      where roleid in (v_executor, v_validator) or member in (v_executor, v_validator)) <> 2
    or exists (select 1 from pg_catalog.pg_auth_members
      where (roleid in (v_executor, v_validator) or member in (v_executor, v_validator))
        and not (roleid in (v_executor, v_validator) and member = v_provisioner
          and grantor = 10 and admin_option and not set_option and not inherit_option)) then
    raise exception '2D.2C.1 expected only automatic bootstrap-granted administrative memberships.';
  end if;
end;
$creator_memberships$;

-- ADMIN FALSE is sufficient on this separate grant: the automatic ADMIN grant
-- already authorizes its creation/revocation. GRANTED BY scopes cleanup precisely.
grant material_transition_executor to current_user
  with admin false, inherit false, set true granted by current_user;
create schema app_materials_private authorization postgres;
revoke all on schema app_materials_private from public, anon, authenticated, service_role;
grant usage on schema app_materials_private to material_transition_executor, material_validator;
grant usage on schema public, auth, extensions to material_transition_executor;
-- Temporary CREATE is required for the new function owner in both schemas.
grant create on schema public, app_materials_private to material_transition_executor;
grant execute on function auth.uid(), auth.jwt() to material_transition_executor;
grant execute on function extensions.gen_random_bytes(pg_catalog.int4), extensions.digest(pg_catalog.bytea, pg_catalog.text)
  to material_transition_executor;

create table app_materials_private.validation_attempts (
  id pg_catalog.uuid primary key default pg_catalog.gen_random_uuid(),
  material_id pg_catalog.uuid not null,
  user_id pg_catalog.uuid not null,
  generation pg_catalog.int8 not null check (generation > 0),
  capability_hash pg_catalog.bytea not null check (pg_catalog.octet_length(capability_hash) = 32),
  purpose pg_catalog.text not null check (purpose in ('validation', 'deletion')),
  issued_at pg_catalog.timestamptz not null,
  expires_at pg_catalog.timestamptz not null,
  started_at pg_catalog.timestamptz,
  completed_at pg_catalog.timestamptz,
  status pg_catalog.text not null check (
    status in ('issued','validating','deleting','validated','missing','deleted','expired','superseded')
  ),
  observed_size pg_catalog.int8,
  observed_sha256 pg_catalog.bytea,
  validation_version pg_catalog.text,
  error_category pg_catalog.text check (
    error_category in ('invalid_pdf_signature','size_mismatch','size_limit_exceeded',
      'mime_mismatch','object_missing','cleanup_retry')
  ),
  created_at pg_catalog.timestamptz not null,
  constraint validation_attempts_material_owner_fkey foreign key (user_id, material_id)
    references public.academic_materials(user_id, id) on delete no action,
  constraint validation_attempts_material_generation_key unique (material_id, generation),
  constraint validation_attempts_capability_hash_key unique (capability_hash),
  constraint validation_attempts_timeline_check check (
    created_at = issued_at and expires_at > issued_at
    and expires_at <= issued_at + interval '120 seconds'
    and (started_at is null or (started_at >= issued_at and started_at < expires_at))
    and (completed_at is null or completed_at >= coalesce(started_at, issued_at))
  ),
  constraint validation_attempts_evidence_check check (
    (status = 'validated' and observed_size is not null and observed_size between 1 and 6291456
      and observed_sha256 is not null and pg_catalog.octet_length(observed_sha256) = 32
      and validation_version is not null and validation_version = 'pdf-signature-v1')
    or (status <> 'validated' and observed_size is null and observed_sha256 is null
      and validation_version is null)
  ),
  constraint validation_attempts_lifecycle_check check (
    (status = 'issued' and started_at is null and completed_at is null and error_category is null)
    or (status = 'validating' and purpose = 'validation' and started_at is not null
      and completed_at is null and error_category is null)
    or (status = 'deleting' and started_at is not null and completed_at is null
      and error_category is not null
      and ((purpose = 'validation' and error_category in
        ('invalid_pdf_signature','size_mismatch','size_limit_exceeded','mime_mismatch'))
        or (purpose = 'deletion' and error_category = 'cleanup_retry')))
    or (status = 'validated' and purpose = 'validation' and started_at is not null
      and completed_at is not null and completed_at < expires_at and error_category is null)
    or (status = 'missing' and purpose = 'validation' and started_at is not null
      and completed_at is not null and completed_at < expires_at
      and error_category is not null and error_category = 'object_missing')
    or (status = 'deleted' and started_at is not null and completed_at is not null
      and completed_at < expires_at and error_category is not null
      and ((purpose = 'validation' and error_category in
        ('invalid_pdf_signature','size_mismatch','size_limit_exceeded','mime_mismatch'))
        or (purpose = 'deletion' and error_category = 'cleanup_retry')))
    or (status in ('expired','superseded') and completed_at is not null and completed_at >= expires_at)
  )
);
create unique index validation_attempts_one_active_material_idx
  on app_materials_private.validation_attempts(material_id)
  where status in ('issued','validating','deleting');
alter table app_materials_private.validation_attempts enable row level security;
alter table app_materials_private.validation_attempts force row level security;
revoke all on table app_materials_private.validation_attempts
  from public, anon, authenticated, service_role, material_validator;
grant select, insert on table app_materials_private.validation_attempts to material_transition_executor;
grant update (started_at, completed_at, status, observed_size, observed_sha256, validation_version, error_category)
  on table app_materials_private.validation_attempts to material_transition_executor;
create policy validation_attempts_executor_select on app_materials_private.validation_attempts
  for select to material_transition_executor using (true);
create policy validation_attempts_executor_insert on app_materials_private.validation_attempts
  for insert to material_transition_executor with check (true);
create policy validation_attempts_executor_update on app_materials_private.validation_attempts
  for update to material_transition_executor using (true) with check (true);

-- Remove table grants AND stale column grants. Defaults alone are not a boundary.
revoke all on table public.academic_materials from public, anon, authenticated;
revoke all (id, user_id, subject_id, class_session_id, title, original_filename,
  storage_path, mime_type, size_bytes, file_status, deleted_at, created_at, updated_at)
  on table public.academic_materials from public, anon, authenticated;
grant select on table public.academic_materials to authenticated;
grant insert (id, subject_id, class_session_id, title, original_filename, storage_path, mime_type, size_bytes)
  on table public.academic_materials to authenticated;
grant select (id, user_id, size_bytes, file_status, deleted_at)
  on table public.academic_materials to material_transition_executor;
grant update (file_status, deleted_at) on table public.academic_materials to material_transition_executor;
drop policy academic_materials_insert_own on public.academic_materials;
drop policy academic_materials_update_own on public.academic_materials;
drop policy academic_materials_delete_own on public.academic_materials;
create policy academic_materials_insert_own on public.academic_materials
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and file_status = 'pending_upload' and deleted_at is null
    and storage_path = user_id::pg_catalog.text || '/' || subject_id::pg_catalog.text || '/' || id::pg_catalog.text || '/source.pdf'
  );
-- FORCE RLS remains on. The NONLOGIN function owner needs explicit policies;
-- ownership/capability checks belong inside the fixed, separately granted functions.
create policy academic_materials_executor_select on public.academic_materials
  for select to material_transition_executor using (true);
create policy academic_materials_executor_update on public.academic_materials
  for update to material_transition_executor using (true) with check (true);

create function public.report_material_upload_failure(p_material_id pg_catalog.uuid)
returns table (material_id pg_catalog.uuid, file_status pg_catalog.text)
language plpgsql
security definer
set search_path = ''
set row_security = on
as $function$
declare
  v_user_id pg_catalog.uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;
  if p_material_id is null then
    raise exception using errcode = '22023', message = 'Invalid material identifier.';
  end if;
  -- No match returns ZERO rows. The application must not convert that into success.
  return query
    update public.academic_materials as material
    set file_status = 'upload_failed'
    where material.id = p_material_id and material.user_id = v_user_id
      and material.file_status = 'pending_upload' and material.deleted_at is null
    returning material.id, material.file_status;
end;
$function$;
revoke all on function public.report_material_upload_failure(pg_catalog.uuid)
  from public, anon, authenticated, service_role, material_validator;
grant execute on function public.report_material_upload_failure(pg_catalog.uuid) to authenticated;
alter function public.report_material_upload_failure(pg_catalog.uuid) owner to material_transition_executor;

create function public.issue_material_authorization(p_material_id pg_catalog.uuid)
returns table (
  attempt_id pg_catalog.uuid, generation pg_catalog.int8, capability pg_catalog.text, purpose pg_catalog.text,
  expires_at pg_catalog.timestamptz, result pg_catalog.text
)
language plpgsql
security definer
set search_path = ''
set row_security = on
as $function$
declare
  v_user_id pg_catalog.uuid := auth.uid();
  v_jwt_exp pg_catalog.text := auth.jwt() ->> 'exp';
  v_material pg_catalog.record;
  v_attempt app_materials_private.validation_attempts%rowtype;
  v_now pg_catalog.timestamptz;
  v_expires_at pg_catalog.timestamptz;
  v_generation pg_catalog.int8;
  v_purpose pg_catalog.text;
  v_raw_capability pg_catalog.bytea;
begin
  if v_user_id is null or v_jwt_exp is null or v_jwt_exp !~ '^[0-9]{1,11}$' then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;
  if p_material_id is null then
    raise exception using errcode = '22023', message = 'Invalid material identifier.';
  end if;
  -- Ownership is derived from the verified Data API Auth context, never an argument.
  -- Every mutating path uses the same lock order: material, then attempt.
  select material.id, material.user_id, material.file_status, material.deleted_at, material.size_bytes
  into v_material from public.academic_materials as material
  where material.id = p_material_id and material.user_id = v_user_id
  for update;
  if not found or v_material.deleted_at is not null or v_material.file_status = 'deleted' then
    raise exception using errcode = '42501', message = 'Material authorization unavailable.';
  end if;
  v_now := pg_catalog.clock_timestamp();
  v_expires_at := least(v_now + interval '120 seconds', pg_catalog.to_timestamp(v_jwt_exp::pg_catalog.float8));
  if v_expires_at <= v_now then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  if v_material.file_status = 'ready' then
    select attempt.* into v_attempt
    from app_materials_private.validation_attempts as attempt
    where attempt.material_id = p_material_id and attempt.user_id = v_user_id
    order by attempt.generation desc limit 1;
    if not found or v_attempt.status <> 'validated' or v_attempt.purpose <> 'validation'
      or v_attempt.observed_size is distinct from v_material.size_bytes then
      raise exception using errcode = 'P0001', message = 'Ready material has no trusted validation attempt.';
    end if;
    return query select v_attempt.id, v_attempt.generation, null::pg_catalog.text, v_attempt.purpose,
      null::pg_catalog.timestamptz, 'already_ready'::pg_catalog.text;
    return;
  end if;
  if v_material.file_status in ('pending_upload','upload_failed','validating') then
    v_purpose := 'validation';
  elsif v_material.file_status = 'deleting' then
    v_purpose := 'deletion';
  else
    raise exception using errcode = '42501', message = 'Material authorization unavailable.';
  end if;

  select attempt.* into v_attempt
  from app_materials_private.validation_attempts as attempt
  where attempt.material_id = p_material_id and attempt.user_id = v_user_id
    and attempt.status in ('issued','validating','deleting')
  for update;
  if found then
    v_now := pg_catalog.clock_timestamp();
    if v_attempt.expires_at > v_now then
      -- Reuse the active decision without revealing/rotating the raw token.
      return query select v_attempt.id, v_attempt.generation, null::pg_catalog.text, v_attempt.purpose,
        v_attempt.expires_at, 'in_progress'::pg_catalog.text;
      return;
    end if;
    update app_materials_private.validation_attempts as attempt
    set status = case when attempt.started_at is null then 'expired' else 'superseded' end,
      completed_at = v_now
    where attempt.id = v_attempt.id and attempt.generation = v_attempt.generation
      and attempt.status in ('issued','validating','deleting') and attempt.expires_at <= v_now;
    if not found then
      raise exception using errcode = 'P0001', message = 'Material authorization unavailable.';
    end if;
  end if;

  v_now := pg_catalog.clock_timestamp();
  v_expires_at := least(v_now + interval '120 seconds', pg_catalog.to_timestamp(v_jwt_exp::pg_catalog.float8));
  if v_expires_at <= v_now then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;
  select coalesce(pg_catalog.max(attempt.generation), 0) + 1 into v_generation
  from app_materials_private.validation_attempts as attempt where attempt.material_id = p_material_id;
  v_raw_capability := extensions.gen_random_bytes(32);
  insert into app_materials_private.validation_attempts (
    material_id, user_id, generation, capability_hash, purpose,
    issued_at, expires_at, status, created_at
  ) values (
    p_material_id, v_user_id, v_generation, extensions.digest(v_raw_capability, 'sha256'), v_purpose,
    v_now, v_expires_at, 'issued', v_now
  ) returning * into v_attempt;
  -- This is the ONLY raw-token return. The application must call this RPC only
  -- server-side, keep it request-local, redact logging and never include it in UI.
  return query select v_attempt.id, v_attempt.generation, pg_catalog.encode(v_raw_capability, 'hex'),
    v_attempt.purpose, v_attempt.expires_at, 'issued'::pg_catalog.text;
end;
$function$;
revoke all on function public.issue_material_authorization(pg_catalog.uuid)
  from public, anon, authenticated, service_role, material_validator;
grant execute on function public.issue_material_authorization(pg_catalog.uuid) to authenticated;
alter function public.issue_material_authorization(pg_catalog.uuid) owner to material_transition_executor;

-- Internal authorization/locking helper, NOT a transition or a validator entry point.
-- An unlocked capability check first avoids locking another owner's guessed ID.
-- The material is then locked BEFORE the attempt; every check is repeated after
-- locking. The capability and generation cannot be extended or changed in place.
create function app_materials_private.lock_material_attempt(
  p_material_id pg_catalog.uuid, p_attempt_id pg_catalog.uuid, p_generation pg_catalog.int8, p_capability pg_catalog.text
)
returns app_materials_private.validation_attempts
language plpgsql
security invoker
set search_path = ''
set row_security = on
as $function$
declare
  v_attempt app_materials_private.validation_attempts%rowtype;
  v_capability_hash pg_catalog.bytea;
begin
  if p_material_id is null or p_attempt_id is null or p_generation is null or p_generation <= 0
    or p_capability is null or pg_catalog.octet_length(p_capability) <> 64
    or p_capability !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '42501', message = 'Material attempt authorization unavailable.';
  end if;
  v_capability_hash := extensions.digest(pg_catalog.decode(p_capability, 'hex'), 'sha256');
  select attempt.* into v_attempt from app_materials_private.validation_attempts as attempt
  where attempt.id = p_attempt_id and attempt.material_id = p_material_id
    and attempt.generation = p_generation and attempt.capability_hash = v_capability_hash
    and attempt.status in ('issued','validating','deleting')
    and attempt.expires_at > pg_catalog.clock_timestamp();
  if not found then
    raise exception using errcode = '42501', message = 'Material attempt authorization unavailable.';
  end if;
  perform material.id from public.academic_materials as material
  where material.id = p_material_id and material.user_id = v_attempt.user_id
    and material.deleted_at is null
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'Material attempt authorization unavailable.';
  end if;
  select attempt.* into v_attempt from app_materials_private.validation_attempts as attempt
  where attempt.id = p_attempt_id for update;
  if not found or v_attempt.material_id is distinct from p_material_id
    or v_attempt.generation is distinct from p_generation
    or v_attempt.capability_hash is distinct from v_capability_hash
    or v_attempt.status not in ('issued','validating','deleting')
    or v_attempt.expires_at <= pg_catalog.clock_timestamp()
    or exists (
      select 1 from app_materials_private.validation_attempts as newer
      where newer.material_id = p_material_id and newer.generation > p_generation
    ) then
    raise exception using errcode = '42501', message = 'Material attempt authorization unavailable.';
  end if;
  return v_attempt;
end;
$function$;
revoke all on function app_materials_private.lock_material_attempt(pg_catalog.uuid, pg_catalog.uuid, pg_catalog.int8, pg_catalog.text)
  from public, anon, authenticated, service_role, material_validator;
alter function app_materials_private.lock_material_attempt(pg_catalog.uuid, pg_catalog.uuid, pg_catalog.int8, pg_catalog.text)
  owner to material_transition_executor;

create function app_materials_private.begin_material_validation(
  p_material_id pg_catalog.uuid, p_attempt_id pg_catalog.uuid, p_generation pg_catalog.int8, p_capability pg_catalog.text
)
returns pg_catalog.text
language plpgsql
security definer
set search_path = ''
set row_security = on
as $function$
declare
  v_attempt app_materials_private.validation_attempts%rowtype;
  v_now pg_catalog.timestamptz;
begin
  v_attempt := app_materials_private.lock_material_attempt(p_material_id, p_attempt_id, p_generation, p_capability);
  v_now := pg_catalog.clock_timestamp();
  if v_attempt.purpose <> 'validation' or v_attempt.status <> 'issued' or v_attempt.expires_at <= v_now then
    raise exception using errcode = '42501', message = 'Material validation attempt unavailable.';
  end if;
  update public.academic_materials as material set file_status = 'validating'
  where material.id = p_material_id and material.user_id = v_attempt.user_id
    and material.file_status in ('pending_upload','upload_failed','validating') and material.deleted_at is null;
  if not found then
    raise exception using errcode = 'P0001', message = 'Material validation state unavailable.';
  end if;
  update app_materials_private.validation_attempts as attempt set status = 'validating', started_at = v_now
  where attempt.id = p_attempt_id and attempt.material_id = p_material_id
    and attempt.generation = p_generation and attempt.capability_hash = v_attempt.capability_hash
    and attempt.purpose = 'validation' and attempt.status = 'issued' and attempt.expires_at > v_now;
  if not found then
    raise exception using errcode = 'P0001', message = 'Material validation attempt unavailable.';
  end if;
  return 'validating';
end;
$function$;
revoke all on function app_materials_private.begin_material_validation(pg_catalog.uuid, pg_catalog.uuid, pg_catalog.int8, pg_catalog.text)
  from public, anon, authenticated, service_role;
grant execute on function app_materials_private.begin_material_validation(pg_catalog.uuid, pg_catalog.uuid, pg_catalog.int8, pg_catalog.text)
  to material_validator;
alter function app_materials_private.begin_material_validation(pg_catalog.uuid, pg_catalog.uuid, pg_catalog.int8, pg_catalog.text)
  owner to material_transition_executor;

create function app_materials_private.complete_material_validation(
  p_material_id pg_catalog.uuid, p_attempt_id pg_catalog.uuid, p_generation pg_catalog.int8, p_capability pg_catalog.text,
  p_observed_size pg_catalog.int8, p_observed_sha256 pg_catalog.bytea, p_validation_version pg_catalog.text
)
returns pg_catalog.text
language plpgsql
security definer
set search_path = ''
set row_security = on
as $function$
declare
  v_attempt app_materials_private.validation_attempts%rowtype;
  v_now pg_catalog.timestamptz;
begin
  if p_observed_size is null or p_observed_size not between 1 and 6291456
    or p_observed_sha256 is null or pg_catalog.octet_length(p_observed_sha256) <> 32
    or p_validation_version is distinct from 'pdf-signature-v1' then
    raise exception using errcode = '22023', message = 'Invalid material validation evidence.';
  end if;
  v_attempt := app_materials_private.lock_material_attempt(p_material_id, p_attempt_id, p_generation, p_capability);
  v_now := pg_catalog.clock_timestamp();
  if v_attempt.purpose <> 'validation' or v_attempt.status <> 'validating'
    or v_attempt.started_at is null or v_attempt.expires_at <= v_now then
    raise exception using errcode = '42501', message = 'Material validation attempt unavailable.';
  end if;
  update public.academic_materials as material set file_status = 'ready'
  where material.id = p_material_id and material.user_id = v_attempt.user_id
    and material.file_status = 'validating' and material.deleted_at is null
    and material.size_bytes = p_observed_size;
  if not found then
    raise exception using errcode = 'P0001', message = 'Material validation state/evidence unavailable.';
  end if;
  update app_materials_private.validation_attempts as attempt
  set status = 'validated', observed_size = p_observed_size, observed_sha256 = p_observed_sha256,
    validation_version = p_validation_version, completed_at = v_now
  where attempt.id = p_attempt_id and attempt.material_id = p_material_id
    and attempt.generation = p_generation and attempt.capability_hash = v_attempt.capability_hash
    and attempt.purpose = 'validation' and attempt.status = 'validating' and attempt.expires_at > v_now;
  if not found then
    raise exception using errcode = 'P0001', message = 'Material validation attempt unavailable.';
  end if;
  -- Any exception rolls back BOTH changes; no ready row without its evidence.
  return 'ready';
end;
$function$;
revoke all on function app_materials_private.complete_material_validation(pg_catalog.uuid, pg_catalog.uuid, pg_catalog.int8, pg_catalog.text, pg_catalog.int8, pg_catalog.bytea, pg_catalog.text)
  from public, anon, authenticated, service_role;
grant execute on function app_materials_private.complete_material_validation(pg_catalog.uuid, pg_catalog.uuid, pg_catalog.int8, pg_catalog.text, pg_catalog.int8, pg_catalog.bytea, pg_catalog.text)
  to material_validator;
alter function app_materials_private.complete_material_validation(pg_catalog.uuid, pg_catalog.uuid, pg_catalog.int8, pg_catalog.text, pg_catalog.int8, pg_catalog.bytea, pg_catalog.text)
  owner to material_transition_executor;

create function app_materials_private.reject_material_validation(
  p_material_id pg_catalog.uuid, p_attempt_id pg_catalog.uuid, p_generation pg_catalog.int8, p_capability pg_catalog.text, p_error_category pg_catalog.text
)
returns pg_catalog.text
language plpgsql
security definer
set search_path = ''
set row_security = on
as $function$
declare
  v_attempt app_materials_private.validation_attempts%rowtype;
  v_now pg_catalog.timestamptz;
begin
  if p_error_category is null or p_error_category not in
    ('invalid_pdf_signature','size_mismatch','size_limit_exceeded','mime_mismatch') then
    raise exception using errcode = '22023', message = 'Invalid material rejection category.';
  end if;
  v_attempt := app_materials_private.lock_material_attempt(p_material_id, p_attempt_id, p_generation, p_capability);
  v_now := pg_catalog.clock_timestamp();
  if v_attempt.purpose <> 'validation' or v_attempt.status <> 'validating' or v_attempt.expires_at <= v_now then
    raise exception using errcode = '42501', message = 'Material validation attempt unavailable.';
  end if;
  update public.academic_materials as material set file_status = 'deleting'
  where material.id = p_material_id and material.user_id = v_attempt.user_id
    and material.file_status = 'validating' and material.deleted_at is null;
  if not found then
    raise exception using errcode = 'P0001', message = 'Material rejection state unavailable.';
  end if;
  update app_materials_private.validation_attempts as attempt set status = 'deleting', error_category = p_error_category
  where attempt.id = p_attempt_id and attempt.material_id = p_material_id
    and attempt.generation = p_generation and attempt.capability_hash = v_attempt.capability_hash
    and attempt.purpose = 'validation' and attempt.status = 'validating' and attempt.expires_at > v_now;
  if not found then
    raise exception using errcode = 'P0001', message = 'Material validation attempt unavailable.';
  end if;
  return 'deleting';
end;
$function$;
revoke all on function app_materials_private.reject_material_validation(pg_catalog.uuid, pg_catalog.uuid, pg_catalog.int8, pg_catalog.text, pg_catalog.text)
  from public, anon, authenticated, service_role;
grant execute on function app_materials_private.reject_material_validation(pg_catalog.uuid, pg_catalog.uuid, pg_catalog.int8, pg_catalog.text, pg_catalog.text)
  to material_validator;
alter function app_materials_private.reject_material_validation(pg_catalog.uuid, pg_catalog.uuid, pg_catalog.int8, pg_catalog.text, pg_catalog.text)
  owner to material_transition_executor;

create function app_materials_private.mark_material_missing(
  p_material_id pg_catalog.uuid, p_attempt_id pg_catalog.uuid, p_generation pg_catalog.int8, p_capability pg_catalog.text
)
returns pg_catalog.text
language plpgsql
security definer
set search_path = ''
set row_security = on
as $function$
declare
  v_attempt app_materials_private.validation_attempts%rowtype;
  v_now pg_catalog.timestamptz;
begin
  -- Future server-only caller must confirm absence; SQL cannot distinguish an
  -- HTTP permission-masked 404 or an in-flight upload. Never call for transient errors.
  v_attempt := app_materials_private.lock_material_attempt(p_material_id, p_attempt_id, p_generation, p_capability);
  v_now := pg_catalog.clock_timestamp();
  if v_attempt.purpose <> 'validation' or v_attempt.status <> 'validating' or v_attempt.expires_at <= v_now then
    raise exception using errcode = '42501', message = 'Material validation attempt unavailable.';
  end if;
  update public.academic_materials as material set file_status = 'upload_failed'
  where material.id = p_material_id and material.user_id = v_attempt.user_id
    and material.file_status = 'validating' and material.deleted_at is null;
  if not found then
    raise exception using errcode = 'P0001', message = 'Material missing-object state unavailable.';
  end if;
  update app_materials_private.validation_attempts as attempt
  set status = 'missing', completed_at = v_now, error_category = 'object_missing'
  where attempt.id = p_attempt_id and attempt.material_id = p_material_id
    and attempt.generation = p_generation and attempt.capability_hash = v_attempt.capability_hash
    and attempt.purpose = 'validation' and attempt.status = 'validating' and attempt.expires_at > v_now;
  if not found then
    raise exception using errcode = 'P0001', message = 'Material validation attempt unavailable.';
  end if;
  return 'upload_failed';
end;
$function$;
revoke all on function app_materials_private.mark_material_missing(pg_catalog.uuid, pg_catalog.uuid, pg_catalog.int8, pg_catalog.text)
  from public, anon, authenticated, service_role;
grant execute on function app_materials_private.mark_material_missing(pg_catalog.uuid, pg_catalog.uuid, pg_catalog.int8, pg_catalog.text)
  to material_validator;
alter function app_materials_private.mark_material_missing(pg_catalog.uuid, pg_catalog.uuid, pg_catalog.int8, pg_catalog.text)
  owner to material_transition_executor;

create function app_materials_private.resume_material_deletion(
  p_material_id pg_catalog.uuid, p_attempt_id pg_catalog.uuid, p_generation pg_catalog.int8, p_capability pg_catalog.text
)
returns pg_catalog.text
language plpgsql
security definer
set search_path = ''
set row_security = on
as $function$
declare
  v_attempt app_materials_private.validation_attempts%rowtype;
  v_now pg_catalog.timestamptz;
begin
  v_attempt := app_materials_private.lock_material_attempt(p_material_id, p_attempt_id, p_generation, p_capability);
  v_now := pg_catalog.clock_timestamp();
  if v_attempt.purpose <> 'deletion' or v_attempt.status <> 'issued' or v_attempt.expires_at <= v_now then
    raise exception using errcode = '42501', message = 'Material cleanup attempt unavailable.';
  end if;
  -- Only lock/verify metadata: no status rewrite, no resurrection and no Storage SQL.
  perform material.id from public.academic_materials as material
  where material.id = p_material_id and material.user_id = v_attempt.user_id
    and material.file_status = 'deleting' and material.deleted_at is null;
  if not found then
    raise exception using errcode = 'P0001', message = 'Material cleanup state unavailable.';
  end if;
  update app_materials_private.validation_attempts as attempt
  set status = 'deleting', started_at = v_now, error_category = 'cleanup_retry'
  where attempt.id = p_attempt_id and attempt.material_id = p_material_id
    and attempt.generation = p_generation and attempt.capability_hash = v_attempt.capability_hash
    and attempt.purpose = 'deletion' and attempt.status = 'issued' and attempt.expires_at > v_now;
  if not found then
    raise exception using errcode = 'P0001', message = 'Material cleanup attempt unavailable.';
  end if;
  return 'deleting';
end;
$function$;
revoke all on function app_materials_private.resume_material_deletion(pg_catalog.uuid, pg_catalog.uuid, pg_catalog.int8, pg_catalog.text)
  from public, anon, authenticated, service_role;
grant execute on function app_materials_private.resume_material_deletion(pg_catalog.uuid, pg_catalog.uuid, pg_catalog.int8, pg_catalog.text)
  to material_validator;
alter function app_materials_private.resume_material_deletion(pg_catalog.uuid, pg_catalog.uuid, pg_catalog.int8, pg_catalog.text)
  owner to material_transition_executor;

create function app_materials_private.complete_material_deletion(
  p_material_id pg_catalog.uuid, p_attempt_id pg_catalog.uuid, p_generation pg_catalog.int8, p_capability pg_catalog.text
)
returns pg_catalog.text
language plpgsql
security definer
set search_path = ''
set row_security = on
as $function$
declare
  v_attempt app_materials_private.validation_attempts%rowtype;
  v_now pg_catalog.timestamptz;
begin
  -- Future caller must confirm Storage removal before completing this tombstone.
  v_attempt := app_materials_private.lock_material_attempt(p_material_id, p_attempt_id, p_generation, p_capability);
  v_now := pg_catalog.clock_timestamp();
  if v_attempt.status <> 'deleting' or v_attempt.started_at is null or v_attempt.expires_at <= v_now
    or not ((v_attempt.purpose = 'validation' and v_attempt.error_category in
      ('invalid_pdf_signature','size_mismatch','size_limit_exceeded','mime_mismatch'))
      or (v_attempt.purpose = 'deletion' and v_attempt.error_category = 'cleanup_retry')) then
    raise exception using errcode = '42501', message = 'Material cleanup attempt unavailable.';
  end if;
  update public.academic_materials as material set file_status = 'deleted', deleted_at = v_now
  where material.id = p_material_id and material.user_id = v_attempt.user_id
    and material.file_status = 'deleting' and material.deleted_at is null;
  if not found then
    raise exception using errcode = 'P0001', message = 'Material cleanup state unavailable.';
  end if;
  update app_materials_private.validation_attempts as attempt set status = 'deleted', completed_at = v_now
  where attempt.id = p_attempt_id and attempt.material_id = p_material_id
    and attempt.generation = p_generation and attempt.capability_hash = v_attempt.capability_hash
    and attempt.purpose = v_attempt.purpose and attempt.status = 'deleting' and attempt.expires_at > v_now;
  if not found then
    raise exception using errcode = 'P0001', message = 'Material cleanup attempt unavailable.';
  end if;
  return 'deleted';
end;
$function$;
revoke all on function app_materials_private.complete_material_deletion(pg_catalog.uuid, pg_catalog.uuid, pg_catalog.int8, pg_catalog.text)
  from public, anon, authenticated, service_role;
grant execute on function app_materials_private.complete_material_deletion(pg_catalog.uuid, pg_catalog.uuid, pg_catalog.int8, pg_catalog.text)
  to material_validator;
alter function app_materials_private.complete_material_deletion(pg_catalog.uuid, pg_catalog.uuid, pg_catalog.int8, pg_catalog.text)
  owner to material_transition_executor;

-- Close the provisioning window before postflight. Leave the automatic ADMIN
-- membership untouched; RESTRICT aborts rather than cascading unexpected grants.
revoke create on schema public, app_materials_private from material_transition_executor;
revoke material_transition_executor from current_user granted by current_user restrict;

-- Catalog assertions are part of the future transaction, not a substitute for
-- authenticated integration tests. Unexpected default/inherited grants abort it.
do $postflight$
declare
  v_executor oid := 'material_transition_executor'::pg_catalog.regrole;
  v_validator oid := 'material_validator'::pg_catalog.regrole;
  v_materials oid := 'public.academic_materials'::pg_catalog.regclass;
  v_attempts oid := 'app_materials_private.validation_attempts'::pg_catalog.regclass;
  v_expected pg_catalog.record;
  v_function oid;
  v_column pg_catalog.record;
  v_provisioner pg_catalog.oid := current_user::pg_catalog.regrole;
begin
  if exists (
    select 1 from pg_catalog.pg_roles where oid in (v_executor, v_validator)
      and (rolcanlogin or rolinherit or rolsuper or rolbypassrls or rolcreatedb or rolcreaterole or rolreplication)
  ) then
    raise exception '2D.2C.1 runtime role attributes postflight failed.';
  end if;
  -- Roles were created NOLOGIN without PASSWORD; never read private pg_authid.
  -- Exactly one automatic membership per role; no self-granted SET grant, no
  -- reverse/cross/runtime membership and no unexpected grantor may survive.
  if (select pg_catalog.count(*) from pg_catalog.pg_auth_members
      where roleid in (v_executor, v_validator) or member in (v_executor, v_validator)) <> 2
    or exists (select 1 from pg_catalog.pg_auth_members
      where (roleid in (v_executor, v_validator) or member in (v_executor, v_validator))
        and not (roleid in (v_executor, v_validator) and member = v_provisioner
          and grantor = 10 and admin_option and not set_option and not inherit_option))
    or exists (select roleid from pg_catalog.pg_auth_members
      where roleid in (v_executor, v_validator) group by roleid having pg_catalog.count(*) <> 1)
    or pg_catalog.pg_has_role(v_provisioner, v_executor, 'SET')
    or pg_catalog.pg_has_role(v_provisioner, v_validator, 'SET')
    or pg_catalog.pg_has_role(v_provisioner, v_executor, 'USAGE')
    or pg_catalog.pg_has_role(v_provisioner, v_validator, 'USAGE') then
    raise exception '2D.2C.1 only automatic ADMIN TRUE / SET FALSE / INHERIT FALSE memberships may remain.';
  end if;
  if (select pg_catalog.count(*) from pg_catalog.pg_class
      where oid in (v_materials, v_attempts) and relrowsecurity and relforcerowsecurity
        and relowner <> v_executor and relowner <> v_validator) <> 2 then
    raise exception '2D.2C.1 table ownership/FORCE RLS postflight failed.';
  end if;
  if not pg_catalog.has_table_privilege('authenticated', v_materials, 'SELECT')
    or pg_catalog.has_table_privilege('authenticated', v_materials, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
    raise exception '2D.2C.1 authenticated table-level grants postflight failed.';
  end if;
  for v_column in select attnum, attname from pg_catalog.pg_attribute
      where attrelid = v_materials and attnum > 0 and not attisdropped loop
    if pg_catalog.has_column_privilege('authenticated', v_materials, v_column.attnum, 'INSERT')
       is distinct from (v_column.attname in
         ('id','subject_id','class_session_id','title','original_filename','storage_path','mime_type','size_bytes'))
      or pg_catalog.has_column_privilege('authenticated', v_materials, v_column.attnum, 'UPDATE,REFERENCES')
      or pg_catalog.has_column_privilege('material_validator', v_materials, v_column.attnum, 'SELECT,INSERT,UPDATE,REFERENCES')
      or pg_catalog.has_column_privilege('anon', v_materials, v_column.attnum, 'SELECT,INSERT,UPDATE,REFERENCES') then
      raise exception '2D.2C.1 client/validator column grants postflight failed: %.', v_column.attname;
    end if;
    if pg_catalog.has_column_privilege('material_transition_executor', v_materials, v_column.attnum, 'SELECT')
       is distinct from (v_column.attname in ('id','user_id','size_bytes','file_status','deleted_at'))
      or pg_catalog.has_column_privilege('material_transition_executor', v_materials, v_column.attnum, 'UPDATE')
       is distinct from (v_column.attname in ('file_status','deleted_at'))
      or pg_catalog.has_column_privilege('material_transition_executor', v_materials, v_column.attnum, 'INSERT,REFERENCES') then
      raise exception '2D.2C.1 executor material column grants postflight failed: %.', v_column.attname;
    end if;
  end loop;
  if pg_catalog.has_table_privilege('material_transition_executor', v_materials, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    or pg_catalog.has_table_privilege('material_validator', v_materials, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    or pg_catalog.has_table_privilege('anon', v_materials, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
    raise exception '2D.2C.1 unexpected table-level material privilege.';
  end if;
  if exists (
    select 1 from pg_catalog.pg_namespace as n
    where n.nspname !~ '^pg_(temp|toast_temp)_'
      and (pg_catalog.has_schema_privilege(v_validator, n.oid, 'CREATE')
        or pg_catalog.has_schema_privilege(v_executor, n.oid, 'CREATE'))
  ) or pg_catalog.has_database_privilege(v_validator, pg_catalog.current_database(), 'CREATE')
    or pg_catalog.has_database_privilege(v_executor, pg_catalog.current_database(), 'CREATE') then
    raise exception '2D.2C.1 runtime role retains persistent DDL capability.';
  end if;
  -- Critical relations are unconditional: even an extension dependency must not
  -- exempt business data, the private attempts ledger, Auth users or Storage.
  -- Effective privilege checks include direct, inherited and universal PUBLIC
  -- grants. PUBLIC access on these relations is a failure, not an exemption.
  for v_expected in select * from (values
    ('public.academic_courses'), ('public.academic_periods'), ('public.subjects'),
    ('public.class_sessions'), ('public.exams'), ('public.missions'),
    ('public.academic_materials'), ('public.academic_material_analyses'),
    ('app_materials_private.validation_attempts'), ('auth.users'),
    ('storage.objects'), ('storage.buckets')
  ) as critical(relation_name) loop
    if pg_catalog.to_regclass(v_expected.relation_name) is null then
      raise exception '2D.2C.1 critical relation missing: %.', v_expected.relation_name;
    end if;
    if pg_catalog.has_table_privilege(v_validator,
        pg_catalog.to_regclass(v_expected.relation_name), 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      or pg_catalog.has_any_column_privilege(v_validator,
        pg_catalog.to_regclass(v_expected.relation_name), 'SELECT,INSERT,UPDATE,REFERENCES') then
      raise exception '2D.2C.1 validator has direct/inherited/PUBLIC privileges on critical relation: %.', v_expected.relation_name;
    end if;
  end loop;
  -- Also cover future app relations without scanning provider-internal schemas.
  -- Only actual extension MEMBERS (deptype e), not normal dependencies on an
  -- extension type/function, are outside this generic application boundary.
  if exists (
    select 1 from pg_catalog.pg_class as c
    join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
    where c.relkind in ('r','p','v','m','f')
      and n.nspname in ('public','app_private','app_materials_private')
      and not exists (
        select 1 from pg_catalog.pg_depend as d
        join pg_catalog.pg_extension as e on e.oid = d.refobjid
        where d.classid = 'pg_catalog.pg_class'::pg_catalog.regclass
          and d.objid = c.oid and d.objsubid = 0
          and d.refclassid = 'pg_catalog.pg_extension'::pg_catalog.regclass
          and d.deptype = 'e'
      )
      and (pg_catalog.has_table_privilege(v_validator, c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        or pg_catalog.has_any_column_privilege(v_validator, c.oid, 'SELECT,INSERT,UPDATE,REFERENCES'))
  ) then
    raise exception '2D.2C.1 validator has direct/inherited/PUBLIC privileges on an application relation.';
  end if;
  if exists (
    select 1 from pg_catalog.pg_class as c
    cross join lateral pg_catalog.aclexplode(coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))) as acl
    where c.oid = v_attempts and acl.grantee not in (c.relowner, v_executor)
  ) then
    raise exception '2D.2C.1 unexpected private attempts table grant.';
  end if;
  if (select pg_catalog.count(*) from pg_catalog.pg_policy where polrelid = v_materials) <> 4
    or (select pg_catalog.count(*) from pg_catalog.pg_policy where polrelid = v_attempts) <> 3
    or exists (select 1 from pg_catalog.pg_policy
      where polrelid = v_materials and polcmd in ('w','d') and polroles <> array[v_executor]) then
    raise exception '2D.2C.1 policy postflight failed.';
  end if;
  if exists (
    select 1 from pg_catalog.pg_namespace as n
    cross join lateral pg_catalog.aclexplode(coalesce(n.nspacl, pg_catalog.acldefault('n', n.nspowner))) as acl
    where n.nspname = 'app_materials_private'
      and (acl.grantee not in (n.nspowner, v_executor, v_validator)
        or (acl.grantee in (v_executor, v_validator) and (acl.privilege_type <> 'USAGE' or acl.is_grantable)))
  ) then
    raise exception '2D.2C.1 private schema exposure/grants postflight failed.';
  end if;
  for v_expected in select * from (values
    ('public.report_material_upload_failure(uuid)', true, 'authenticated'),
    ('public.issue_material_authorization(uuid)', true, 'authenticated'),
    ('app_materials_private.lock_material_attempt(uuid,uuid,bigint,text)', false, null::pg_catalog.text),
    ('app_materials_private.begin_material_validation(uuid,uuid,bigint,text)', true, 'material_validator'),
    ('app_materials_private.complete_material_validation(uuid,uuid,bigint,text,bigint,bytea,text)', true, 'material_validator'),
    ('app_materials_private.reject_material_validation(uuid,uuid,bigint,text,text)', true, 'material_validator'),
    ('app_materials_private.mark_material_missing(uuid,uuid,bigint,text)', true, 'material_validator'),
    ('app_materials_private.resume_material_deletion(uuid,uuid,bigint,text)', true, 'material_validator'),
    ('app_materials_private.complete_material_deletion(uuid,uuid,bigint,text)', true, 'material_validator')
  ) as expected(signature, is_definer, caller_role) loop
    v_function := pg_catalog.to_regprocedure(v_expected.signature);
    if v_function is null or not exists (
      select 1 from pg_catalog.pg_proc as p where p.oid = v_function
        and p.proowner = v_executor and p.prosecdef = v_expected.is_definer and not p.proleakproof
        and p.prolang = (select oid from pg_catalog.pg_language where lanname = 'plpgsql')
        and exists (select 1 from pg_catalog.unnest(p.proconfig) as setting(value)
          where pg_catalog.replace(setting.value, '"', '') = 'search_path=')
        and p.proconfig @> array['row_security=on']::pg_catalog.text[]
        and p.prosrc !~* '\mEXECUTE[[:space:]]'
    ) then
      raise exception '2D.2C.1 function ownership/security postflight failed: %.', v_expected.signature;
    end if;
    if exists (
      select 1 from pg_catalog.pg_proc as p
      cross join lateral pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) as acl
      where p.oid = v_function and acl.grantee <> v_executor
        and (v_expected.caller_role is null
          or acl.grantee <> v_expected.caller_role::pg_catalog.regrole::oid
          or acl.privilege_type <> 'EXECUTE' or acl.is_grantable)
    ) or (v_expected.caller_role is not null and not
      pg_catalog.has_function_privilege(v_expected.caller_role, v_function, 'EXECUTE')) then
      raise exception '2D.2C.1 function EXECUTE allowlist postflight failed: %.', v_expected.signature;
    end if;
  end loop;
  if exists (
    select 1 from pg_catalog.pg_proc as p
    join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
    where p.prosecdef and n.nspname not in ('pg_catalog','information_schema')
      and p.prorettype not in (
        'pg_catalog.trigger'::pg_catalog.regtype, 'pg_catalog.event_trigger'::pg_catalog.regtype)
      and pg_catalog.has_schema_privilege(v_validator, n.oid, 'USAGE')
      and pg_catalog.has_function_privilege(v_validator, p.oid, 'EXECUTE')
      and not (n.nspname = 'app_materials_private' and p.proowner = v_executor)
  ) then
    raise exception '2D.2C.1 validator inherits an unrelated SECURITY DEFINER entry point.';
  end if;
  -- NOLOGIN is deliberate. PUBLIC TEMP/default EXECUTE privileges are not DENYable
  -- per-role; review them separately before any future LOGIN/credential provisioning.
end;
$postflight$;

notify pgrst, 'reload schema';
commit;
