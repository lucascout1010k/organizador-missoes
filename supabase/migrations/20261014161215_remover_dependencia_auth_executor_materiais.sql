-- Corrective migration: the applied 2D.2C.1 file remains immutable.
-- No auth schema privileges or runtime memberships are added.
begin;
set local search_path = '';
set local lock_timeout = '5s';
set local statement_timeout = '30s';
do $preflight$
declare v_expected pg_catalog.record;
begin
  if current_user <> 'postgres' then raise exception 'Expected administrative postgres provisioner.'; end if;
  for v_expected in select * from (values
    ('public.report_material_upload_failure(uuid)', '74558122956daf8930260677b5f84a13'),
    ('public.issue_material_authorization(uuid)', '7df84713d8a354ca4cab70d3702a71ef')
  ) as expected(signature, body_md5) loop
    if not exists (select 1 from pg_catalog.pg_proc as p
      where p.oid = pg_catalog.to_regprocedure(v_expected.signature)
        and p.proowner = 'material_transition_executor'::pg_catalog.regrole
        and p.prosecdef and not p.proleakproof
        and p.prolang = (select oid from pg_catalog.pg_language where lanname = 'plpgsql')
        and pg_catalog.md5(p.prosrc) = v_expected.body_md5
        and p.proconfig @> array['row_security=on']::pg_catalog.text[]
        and exists (select 1 from pg_catalog.unnest(p.proconfig) as setting(value)
          where pg_catalog.replace(setting.value, '"', '') = 'search_path=')
    ) then raise exception 'Corrective migration foundation mismatch: %.', v_expected.signature; end if;
  end loop;
  if pg_catalog.has_schema_privilege('material_transition_executor','auth','USAGE') then
    raise exception 'Executor auth schema access diverges from expected least privilege.';
  end if;
end;
$preflight$;
-- Non-superuser postgres may SET only during this transaction to replace functions
-- as their existing owner; the automatic ADMIN-only membership is not modified.
grant material_transition_executor to current_user
  with admin false, inherit false, set true granted by current_user;
grant create on schema public to material_transition_executor;
set local role material_transition_executor;
create or replace function public.report_material_upload_failure(p_material_id pg_catalog.uuid)
returns table (material_id pg_catalog.uuid, file_status pg_catalog.text)
language plpgsql
security definer
set search_path = ''
set row_security = on
as $function$
declare
  v_user_id pg_catalog.uuid;
  v_sub pg_catalog.text;
  v_claims pg_catalog.jsonb;
begin
  -- Only the verified PostgREST request context supplies identity, never RPC input.
  begin
    v_claims := nullif(pg_catalog.current_setting('request.jwt.claims', true), '')::pg_catalog.jsonb;
    if v_claims is not null and pg_catalog.jsonb_typeof(v_claims) <> 'object' then
      raise exception using errcode = '42501', message = 'Authentication required.';
    end if;
    v_sub := nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '');
    if v_sub is not null and v_claims ? 'sub' and v_sub is distinct from (v_claims ->> 'sub') then
      raise exception using errcode = '42501', message = 'Authentication required.';
    end if;
    v_sub := coalesce(v_sub, v_claims ->> 'sub');
    if v_sub is null or v_sub !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception using errcode = '42501', message = 'Authentication required.';
    end if;
    v_user_id := v_sub::pg_catalog.uuid;
  exception when invalid_text_representation then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end;
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

create or replace function public.issue_material_authorization(p_material_id pg_catalog.uuid)
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
  v_user_id pg_catalog.uuid;
  v_sub pg_catalog.text;
  v_claims pg_catalog.jsonb;
  v_jwt_exp pg_catalog.text;
  v_material pg_catalog.record;
  v_attempt app_materials_private.validation_attempts%rowtype;
  v_now pg_catalog.timestamptz;
  v_expires_at pg_catalog.timestamptz;
  v_generation pg_catalog.int8;
  v_purpose pg_catalog.text;
  v_raw_capability pg_catalog.bytea;
begin
  -- Only the verified PostgREST request context supplies identity, never RPC input.
  begin
    v_claims := nullif(pg_catalog.current_setting('request.jwt.claims', true), '')::pg_catalog.jsonb;
    if v_claims is not null and pg_catalog.jsonb_typeof(v_claims) <> 'object' then
      raise exception using errcode = '42501', message = 'Authentication required.';
    end if;
    v_sub := nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '');
    if v_sub is not null and v_claims ? 'sub' and v_sub is distinct from (v_claims ->> 'sub') then
      raise exception using errcode = '42501', message = 'Authentication required.';
    end if;
    v_sub := coalesce(v_sub, v_claims ->> 'sub');
    if v_sub is null or v_sub !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception using errcode = '42501', message = 'Authentication required.';
    end if;
    v_user_id := v_sub::pg_catalog.uuid;
  exception when invalid_text_representation then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end;
  v_jwt_exp := v_claims ->> 'exp';
  if pg_catalog.jsonb_typeof(v_claims -> 'exp') is distinct from 'number'
    or v_user_id is null or v_jwt_exp is null or v_jwt_exp !~ '^[0-9]{1,11}$' then
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
reset role;
revoke create on schema public from material_transition_executor;
revoke material_transition_executor from current_user granted by current_user restrict;
-- Remove explicit residual function grants if any; PUBLIC EXECUTE on provider
-- functions is not a direct role grant and remains ineffective without auth USAGE.
do $residual_auth_grants$
begin
  if exists (select 1 from pg_catalog.pg_proc p
    cross join lateral pg_catalog.aclexplode(p.proacl) acl
    where p.oid in ('auth.uid()'::pg_catalog.regprocedure,'auth.jwt()'::pg_catalog.regprocedure)
      and acl.grantee = 'material_transition_executor'::pg_catalog.regrole) then
    revoke all on function auth.uid(), auth.jwt() from material_transition_executor;
  end if;
  if exists (select 1 from pg_catalog.pg_proc p
    cross join lateral pg_catalog.aclexplode(p.proacl) acl
    where p.oid in ('auth.uid()'::pg_catalog.regprocedure,'auth.jwt()'::pg_catalog.regprocedure)
      and acl.grantee = 'material_transition_executor'::pg_catalog.regrole) then
    raise exception 'Residual executor auth function grant could not be removed.';
  end if;
end;
$residual_auth_grants$;
do $postflight$
declare v_expected pg_catalog.record; v_executor pg_catalog.oid := 'material_transition_executor'::pg_catalog.regrole;
begin
  if pg_catalog.has_schema_privilege(v_executor,'auth','USAGE')
    or pg_catalog.has_schema_privilege(v_executor,'public','CREATE')
    or pg_catalog.pg_has_role(current_user,v_executor,'SET')
    or pg_catalog.pg_has_role(current_user,v_executor,'USAGE') then
    raise exception 'Executor retains unexpected auth/DDL/temporary provisioning access.';
  end if;
  if not exists (select 1 from pg_catalog.pg_roles where oid=v_executor
    and not rolcanlogin and not rolsuper and not rolbypassrls and not rolcreatedb
    and not rolcreaterole and not rolreplication and not rolinherit) then
    raise exception 'Executor attributes diverged.';
  end if;
  for v_expected in select * from (values
    ('public.report_material_upload_failure(uuid)'), ('public.issue_material_authorization(uuid)')
  ) as expected(signature) loop
    if not exists (select 1 from pg_catalog.pg_proc p
      where p.oid=pg_catalog.to_regprocedure(v_expected.signature) and p.proowner=v_executor
        and p.prosecdef and p.prosrc !~* 'auth[.]'
        and p.proconfig @> array['row_security=on']::pg_catalog.text[]
        and exists (select 1 from pg_catalog.unnest(p.proconfig) as setting(value)
          where pg_catalog.replace(setting.value, '"', '') = 'search_path=')
    ) or not pg_catalog.has_function_privilege('authenticated',v_expected.signature,'EXECUTE')
      or exists (select 1 from pg_catalog.pg_proc p
        cross join lateral pg_catalog.aclexplode(p.proacl) acl
        where p.oid=pg_catalog.to_regprocedure(v_expected.signature)
          and (acl.grantee not in (v_executor,'authenticated'::pg_catalog.regrole)
            or acl.privilege_type <> 'EXECUTE' or acl.is_grantable)) then
      raise exception 'Corrected RPC ownership/security/ACL mismatch: %.',v_expected.signature;
    end if;
  end loop;
  if exists (select 1 from pg_catalog.pg_proc where proowner=v_executor and prosrc ~* 'auth[.](uid|jwt)[[:space:]]*[(]') then
    raise exception 'Executor function still depends on auth runtime helpers.';
  end if;
end;
$postflight$;
notify pgrst, 'reload schema';
commit;
