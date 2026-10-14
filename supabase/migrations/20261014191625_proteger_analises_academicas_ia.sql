begin;
set local search_path = '';
set local lock_timeout = '5s';
set local statement_timeout = '30s';
do $preflight$
begin
  if current_user <> 'postgres' or exists(select 1 from public.academic_material_analyses)
    or pg_catalog.to_regprocedure('public.request_material_analysis(uuid,boolean)') is not null
    or not exists(select 1 from pg_catalog.pg_class where oid='public.academic_material_analyses'::pg_catalog.regclass and relrowsecurity and relforcerowsecurity)
    or not exists(select 1 from pg_catalog.pg_proc where oid=pg_catalog.to_regprocedure('public.issue_material_authorization(uuid)') and proowner='material_transition_executor'::pg_catalog.regrole and prosecdef)
    or pg_catalog.has_schema_privilege('material_transition_executor','auth','USAGE') then
    raise exception 'Unexpected analysis foundation; do not overwrite existing analyses.';
  end if;
end;$preflight$;
-- Consent fields and result size constraints already exist. Schema version 1
-- represents academic-material-analysis-v1; no PDF or prompt is stored here.
alter table public.academic_material_analyses
  add column lease_expires_at pg_catalog.timestamptz,
  add column completion_token_hash pg_catalog.bytea,
  add constraint academic_material_analyses_lease_check check (
    (status='processing' and lease_expires_at>started_at and pg_catalog.octet_length(completion_token_hash)=32
      and lease_expires_at is not null and completion_token_hash is not null)
    or (status<>'processing' and lease_expires_at is null and completion_token_hash is null));
revoke all on public.academic_material_analyses from public,anon,authenticated,material_validator;
grant select(id,user_id,material_id,status,schema_version,result,created_at,completed_at) on public.academic_material_analyses to authenticated;
drop policy academic_material_analyses_insert_own on public.academic_material_analyses;
drop policy academic_material_analyses_update_own on public.academic_material_analyses;
drop policy academic_material_analyses_delete_own on public.academic_material_analyses;
grant select on public.academic_material_analyses to material_transition_executor;
grant insert(id,user_id,material_id,status,provider,model,schema_version,consent_version,consented_at,started_at,lease_expires_at,completion_token_hash)
  on public.academic_material_analyses to material_transition_executor;
grant update(status,result,error_code,completed_at,model,lease_expires_at,completion_token_hash)
  on public.academic_material_analyses to material_transition_executor;
create policy academic_material_analyses_executor on public.academic_material_analyses to material_transition_executor using(true) with check(true);
grant material_transition_executor to current_user with admin false,inherit false,set true granted by current_user;
grant create on schema public,app_materials_private to material_transition_executor;
set local role material_transition_executor;

create function public.request_material_analysis(p_material_id pg_catalog.uuid,p_consent pg_catalog.bool)
returns table(analysis_id pg_catalog.uuid,completion_token pg_catalog.text,expires_at pg_catalog.timestamptz,decision pg_catalog.text)
language plpgsql security definer set search_path='' set row_security=on
as $function$
declare v_claims pg_catalog.jsonb;v_sub pg_catalog.text;v_user pg_catalog.uuid;v_exp pg_catalog.text;
  v_now pg_catalog.timestamptz;v_expires pg_catalog.timestamptz;v_analysis pg_catalog.record;v_token pg_catalog.bytea;v_id pg_catalog.uuid;
begin
  if p_consent is distinct from true then raise exception using errcode='42501',message='Explicit consent required.'; end if;
  begin
    v_claims:=nullif(pg_catalog.current_setting('request.jwt.claims',true),'')::pg_catalog.jsonb;
    v_sub:=nullif(pg_catalog.current_setting('request.jwt.claim.sub',true),'');
    if pg_catalog.jsonb_typeof(v_claims) is distinct from 'object'
      or (v_sub is not null and v_claims ? 'sub' and v_sub is distinct from (v_claims->>'sub')) then
      raise exception using errcode='42501',message='Authentication required.';
    end if;
    v_sub:=coalesce(v_sub,v_claims->>'sub');v_exp:=v_claims->>'exp';
    if v_sub is null or v_sub !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or pg_catalog.jsonb_typeof(v_claims->'exp') is distinct from 'number' or v_exp is null or v_exp !~ '^[0-9]{1,11}$' then
      raise exception using errcode='42501',message='Authentication required.';
    end if;
    v_user:=v_sub::pg_catalog.uuid;
  exception when invalid_text_representation then raise exception using errcode='42501',message='Authentication required.';end;
  v_now:=pg_catalog.clock_timestamp();
  v_expires:=least(v_now+interval '180 seconds',pg_catalog.to_timestamp(v_exp::pg_catalog.float8));
  if v_expires<=v_now+interval '90 seconds' then raise exception using errcode='42501',message='Session renewal required.';end if;
  -- Same lock order as validation/deletion: material first, then analysis.
  perform 1 from public.academic_materials m where m.id=p_material_id and m.user_id=v_user
    and m.file_status='ready' and m.deleted_at is null for update;
  if not found then return;end if;
  select a.id into v_analysis from public.academic_material_analyses a
    where a.material_id=p_material_id and a.user_id=v_user and a.schema_version=1 and a.status='completed'
    order by a.created_at desc,a.id desc limit 1;
  if found then return query select v_analysis.id,null::pg_catalog.text,null::pg_catalog.timestamptz,'completed'::pg_catalog.text;return;end if;
  select a.id,a.lease_expires_at into v_analysis from public.academic_material_analyses a
    where a.material_id=p_material_id and a.user_id=v_user and a.status='processing' for update;
  if found then
    if v_analysis.lease_expires_at>v_now then
      return query select v_analysis.id,null::pg_catalog.text,v_analysis.lease_expires_at,'analysis_in_progress'::pg_catalog.text;return;
    end if;
    update public.academic_material_analyses a set status='failed',error_code='analysis_timeout',completed_at=v_now,
      lease_expires_at=null,completion_token_hash=null where a.id=v_analysis.id;
  end if;
  v_id:=pg_catalog.gen_random_uuid();v_token:=extensions.gen_random_bytes(32);
  insert into public.academic_material_analyses(id,user_id,material_id,status,provider,model,schema_version,consent_version,consented_at,started_at,lease_expires_at,completion_token_hash)
    values(v_id,v_user,p_material_id,'processing','google','gemini-3.8-flash',1,'gemini-pdf-analysis-consent-v1',v_now,v_now,v_expires,extensions.digest(v_token,'sha256'));
  return query select v_id,pg_catalog.encode(v_token,'hex'),v_expires,'issued'::pg_catalog.text;
end;$function$;
revoke all on function public.request_material_analysis(pg_catalog.uuid,pg_catalog.bool) from public,anon,authenticated,material_validator;
grant execute on function public.request_material_analysis(pg_catalog.uuid,pg_catalog.bool) to authenticated;

create function app_materials_private.complete_material_analysis(p_analysis_id pg_catalog.uuid,p_completion_token pg_catalog.text,p_result pg_catalog.jsonb,p_model pg_catalog.text)
returns pg_catalog.void language plpgsql security definer set search_path='' set row_security=on
as $function$
declare v_analysis public.academic_material_analyses%rowtype;v_now pg_catalog.timestamptz;
begin
  if p_completion_token is null or p_completion_token !~ '^[0-9a-f]{64}$'
    or p_model is null or p_model !~ '^gemini-[a-z0-9][a-z0-9.-]{1,79}$'
    or pg_catalog.jsonb_typeof(p_result) is distinct from 'object' or pg_catalog.octet_length(p_result::pg_catalog.text)>131072
    or not p_result ?& array['summary','topics','keywords','exercises','suggestedMissions','limitations']
    or (select count(*) from pg_catalog.jsonb_object_keys(p_result))<>6
    or pg_catalog.jsonb_typeof(p_result->'summary') is distinct from 'string'
    or pg_catalog.jsonb_typeof(p_result->'topics') is distinct from 'array'
    or pg_catalog.jsonb_typeof(p_result->'keywords') is distinct from 'array'
    or pg_catalog.jsonb_typeof(p_result->'exercises') is distinct from 'array'
    or pg_catalog.jsonb_typeof(p_result->'suggestedMissions') is distinct from 'array'
    or pg_catalog.jsonb_typeof(p_result->'limitations') is distinct from 'array' then
    raise exception using errcode='22023',message='Invalid analysis evidence.';
  end if;
  select a.* into v_analysis from public.academic_material_analyses a where a.id=p_analysis_id;
  if not found then raise exception using errcode='42501',message='Analysis unavailable.';end if;
  perform 1 from public.academic_materials m where m.id=v_analysis.material_id and m.user_id=v_analysis.user_id
    and m.file_status='ready' and m.deleted_at is null for update;
  if not found then raise exception using errcode='42501',message='Material unavailable.';end if;
  select a.* into v_analysis from public.academic_material_analyses a where a.id=p_analysis_id for update;
  v_now:=pg_catalog.clock_timestamp();
  if v_analysis.status<>'processing' or v_analysis.lease_expires_at<=v_now or v_analysis.completion_token_hash is distinct from extensions.digest(pg_catalog.decode(p_completion_token,'hex'),'sha256') then
    raise exception using errcode='42501',message='Analysis authorization unavailable.';
  end if;
  update public.academic_material_analyses a set status='completed',result=p_result,model=p_model,completed_at=v_now,
    lease_expires_at=null,completion_token_hash=null where a.id=p_analysis_id;
end;$function$;
revoke all on function app_materials_private.complete_material_analysis(pg_catalog.uuid,pg_catalog.text,pg_catalog.jsonb,pg_catalog.text) from public,anon,authenticated;
grant execute on function app_materials_private.complete_material_analysis(pg_catalog.uuid,pg_catalog.text,pg_catalog.jsonb,pg_catalog.text) to material_validator;

create function app_materials_private.fail_material_analysis(p_analysis_id pg_catalog.uuid,p_completion_token pg_catalog.text,p_category pg_catalog.text)
returns pg_catalog.void language plpgsql security definer set search_path='' set row_security=on
as $function$
declare v_analysis public.academic_material_analyses%rowtype;v_now pg_catalog.timestamptz;
begin
  if p_completion_token is null or p_completion_token !~ '^[0-9a-f]{64}$' or p_category is null
    or p_category not in ('provider_unavailable','provider_rate_limited','provider_auth_error','provider_refused','invalid_provider_response','analysis_timeout','material_unavailable','configuration_error','unknown') then
    raise exception using errcode='22023',message='Invalid failure category.';
  end if;
  select a.* into v_analysis from public.academic_material_analyses a where a.id=p_analysis_id;
  if not found then raise exception using errcode='42501',message='Analysis unavailable.';end if;
  perform 1 from public.academic_materials m where m.id=v_analysis.material_id and m.user_id=v_analysis.user_id for update;
  select a.* into v_analysis from public.academic_material_analyses a where a.id=p_analysis_id for update;
  v_now:=pg_catalog.clock_timestamp();
  if v_analysis.status<>'processing' or v_analysis.lease_expires_at<=v_now or v_analysis.completion_token_hash is distinct from extensions.digest(pg_catalog.decode(p_completion_token,'hex'),'sha256') then
    raise exception using errcode='42501',message='Analysis authorization unavailable.';
  end if;
  update public.academic_material_analyses a set status='failed',error_code=p_category,completed_at=v_now,
    lease_expires_at=null,completion_token_hash=null where a.id=p_analysis_id;
end;$function$;
revoke all on function app_materials_private.fail_material_analysis(pg_catalog.uuid,pg_catalog.text,pg_catalog.text) from public,anon,authenticated;
grant execute on function app_materials_private.fail_material_analysis(pg_catalog.uuid,pg_catalog.text,pg_catalog.text) to material_validator;
reset role;
revoke create on schema public,app_materials_private from material_transition_executor;
revoke material_transition_executor from current_user granted by current_user restrict;
do $postflight$
declare v_fn pg_catalog.regprocedure;v_role pg_catalog.text;v_column pg_catalog.record;
begin
  foreach v_fn in array array['public.request_material_analysis(uuid,boolean)'::pg_catalog.regprocedure,'app_materials_private.complete_material_analysis(uuid,text,jsonb,text)'::pg_catalog.regprocedure,'app_materials_private.fail_material_analysis(uuid,text,text)'::pg_catalog.regprocedure] loop
    if not exists(select 1 from pg_catalog.pg_proc p where p.oid=v_fn and p.proowner='material_transition_executor'::pg_catalog.regrole and p.prosecdef
      and p.proconfig @> array['row_security=on']::pg_catalog.text[] and exists(select 1 from pg_catalog.unnest(p.proconfig) s(value) where pg_catalog.replace(s.value,'"','')='search_path='))
      or pg_catalog.has_function_privilege('anon',v_fn,'EXECUTE') then raise exception 'Analysis function exposure mismatch.';end if;
  end loop;
  if not pg_catalog.has_function_privilege('authenticated','public.request_material_analysis(uuid,boolean)','EXECUTE')
    or pg_catalog.has_function_privilege('material_validator','public.request_material_analysis(uuid,boolean)','EXECUTE')
    or pg_catalog.has_function_privilege('authenticated','app_materials_private.complete_material_analysis(uuid,text,jsonb,text)','EXECUTE')
    or pg_catalog.has_function_privilege('authenticated','app_materials_private.fail_material_analysis(uuid,text,text)','EXECUTE') then raise exception 'Analysis caller grants mismatch.';end if;
  foreach v_role in array array['anon','authenticated','material_validator'] loop
    if pg_catalog.has_table_privilege(v_role,'public.academic_material_analyses','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then raise exception 'Generic analysis mutation exposed.';end if;
    for v_column in select attname from pg_catalog.pg_attribute where attrelid='public.academic_material_analyses'::pg_catalog.regclass and attnum>0 and not attisdropped loop
      if pg_catalog.has_column_privilege(v_role,'public.academic_material_analyses',v_column.attname,'INSERT,UPDATE,REFERENCES') then raise exception 'Analysis column mutation exposed.';end if;
    end loop;
  end loop;
  if pg_catalog.has_column_privilege('authenticated','public.academic_material_analyses','completion_token_hash','SELECT')
    or pg_catalog.has_column_privilege('authenticated','public.academic_material_analyses','lease_expires_at','SELECT')
    or pg_catalog.has_table_privilege('material_validator','public.academic_material_analyses','SELECT')
    or pg_catalog.has_schema_privilege('material_transition_executor','auth','USAGE')
    or exists(select 1 from pg_catalog.pg_roles where rolname='material_transition_executor' and (rolcanlogin or rolsuper or rolbypassrls or rolcreatedb or rolcreaterole or rolreplication or rolinherit))
    or exists(select 1 from pg_catalog.pg_auth_members where member in ('material_transition_executor'::pg_catalog.regrole,'material_validator'::pg_catalog.regrole))
    or exists(select 1 from pg_catalog.pg_namespace n where n.nspname !~ '^pg_(temp|toast_temp)' and (pg_catalog.has_schema_privilege('material_validator',n.oid,'CREATE') or pg_catalog.has_schema_privilege('material_transition_executor',n.oid,'CREATE'))) then
    raise exception 'Analysis least privilege mismatch.';
  end if;
end;$postflight$;
commit;
