-- Only adds an ownership-bound request to enter deleting. Existing migrations
-- and the six capability-fenced validator transitions remain unchanged.
begin;
set local search_path = '';
set local lock_timeout = '5s';
set local statement_timeout = '30s';
do $preflight$
begin
  if current_user <> 'postgres' or pg_catalog.to_regprocedure('public.request_material_deletion(uuid)') is not null then
    raise exception 'Unexpected deletion foundation.';
  end if;
  if not exists (select 1 from pg_catalog.pg_proc p where p.oid = pg_catalog.to_regprocedure('public.issue_material_authorization(uuid)')
    and p.proowner = 'material_transition_executor'::pg_catalog.regrole and p.prosecdef
    and p.proconfig @> array['row_security=on']::pg_catalog.text[]
    and exists(select 1 from pg_catalog.unnest(p.proconfig) s(value) where pg_catalog.replace(s.value,'"','') = 'search_path='))
    or pg_catalog.has_schema_privilege('material_transition_executor','auth','USAGE') then
    raise exception 'Unexpected executor foundation.';
  end if;
end;
$preflight$;
grant material_transition_executor to current_user with admin false, inherit false, set true granted by current_user;
grant create on schema public to material_transition_executor;
set local role material_transition_executor;
create function public.request_material_deletion(p_material_id pg_catalog.uuid)
returns table(material_id pg_catalog.uuid, result pg_catalog.text)
language plpgsql security definer set search_path = '' set row_security = on
as $function$
declare
  v_claims pg_catalog.jsonb;
  v_sub pg_catalog.text;
  v_user pg_catalog.uuid;
  v_exp pg_catalog.text;
  v_material pg_catalog.record;
begin
  begin
    v_claims := nullif(pg_catalog.current_setting('request.jwt.claims',true),'')::pg_catalog.jsonb;
    v_sub := nullif(pg_catalog.current_setting('request.jwt.claim.sub',true),'');
    if pg_catalog.jsonb_typeof(v_claims) is distinct from 'object'
      or (v_sub is not null and v_claims ? 'sub' and v_sub is distinct from (v_claims->>'sub')) then
      raise exception using errcode='42501', message='Authentication required.';
    end if;
    v_sub := coalesce(v_sub,v_claims->>'sub');
    v_exp := v_claims->>'exp';
    if v_sub is null or v_sub !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or pg_catalog.jsonb_typeof(v_claims->'exp') is distinct from 'number'
      or v_exp is null or v_exp !~ '^[0-9]{1,11}$' then
      raise exception using errcode='42501', message='Authentication required.';
    end if;
    v_user := v_sub::pg_catalog.uuid;
    if pg_catalog.to_timestamp(v_exp::pg_catalog.float8) <= pg_catalog.clock_timestamp() then
      raise exception using errcode='42501', message='Authentication required.';
    end if;
  exception when invalid_text_representation then
    raise exception using errcode='42501', message='Authentication required.';
  end;
  -- Lock order matches every existing transition: material before attempts.
  select m.id,m.file_status,m.deleted_at into v_material from public.academic_materials m
    where m.id=p_material_id and m.user_id=v_user for update;
  if not found then return; end if;
  if v_material.file_status='deleted' and v_material.deleted_at is not null then
    return query select p_material_id,'deleted'::pg_catalog.text; return;
  end if;
  if v_material.deleted_at is not null then return; end if;
  if v_material.file_status='deleting' then
    return query select p_material_id,'deleting'::pg_catalog.text; return;
  end if;
  if v_material.file_status not in ('pending_upload','validating','ready','upload_failed') then return; end if;
  -- Never race a live validation/upload operation or override its capability.
  -- Expired attempts are reconciled by the unchanged authorization issuer.
  if exists(select 1 from app_materials_private.validation_attempts a where a.material_id=p_material_id
    and a.status in ('issued','validating','deleting') and a.expires_at>pg_catalog.clock_timestamp()) then
    return query select p_material_id,'in_progress'::pg_catalog.text; return;
  end if;
  update public.academic_materials m set file_status='deleting'
    where m.id=p_material_id and m.user_id=v_user and m.deleted_at is null;
  return query select p_material_id,'deleting'::pg_catalog.text;
end;
$function$;
revoke all on function public.request_material_deletion(pg_catalog.uuid) from public,anon,authenticated,material_validator;
grant execute on function public.request_material_deletion(pg_catalog.uuid) to authenticated;
reset role;
revoke create on schema public from material_transition_executor;
revoke material_transition_executor from current_user granted by current_user restrict;
do $postflight$
declare v_executor pg_catalog.oid := 'material_transition_executor'::pg_catalog.regrole;
begin
  if not exists(select 1 from pg_catalog.pg_proc p where p.oid='public.request_material_deletion(uuid)'::pg_catalog.regprocedure
    and p.proowner=v_executor and p.prosecdef and p.proconfig @> array['row_security=on']::pg_catalog.text[])
    or not pg_catalog.has_function_privilege('authenticated','public.request_material_deletion(uuid)','EXECUTE')
    or pg_catalog.has_function_privilege('anon','public.request_material_deletion(uuid)','EXECUTE')
    or pg_catalog.has_function_privilege('material_validator','public.request_material_deletion(uuid)','EXECUTE')
    or pg_catalog.has_schema_privilege('material_transition_executor','auth','USAGE')
    or exists(select 1 from pg_catalog.pg_roles where oid=v_executor and (rolcanlogin or rolsuper or rolbypassrls or rolcreatedb or rolcreaterole or rolreplication or rolinherit))
    or exists(select 1 from pg_catalog.pg_namespace n where pg_catalog.has_schema_privilege('material_transition_executor',n.oid,'CREATE')
      and n.nspname !~ '^pg_(temp|toast_temp)')
    or exists(select 1 from pg_catalog.pg_auth_members where member in (v_executor,'material_validator'::pg_catalog.regrole))
    or pg_catalog.has_table_privilege('authenticated','public.academic_materials','UPDATE,DELETE') then
    raise exception 'Deletion least privilege postflight failed.';
  end if;
end;
$postflight$;
commit;
