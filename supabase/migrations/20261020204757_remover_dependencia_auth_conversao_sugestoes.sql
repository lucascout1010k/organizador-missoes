-- Corrective migration: managed auth schema grants are not delegated to postgres.
-- Read PostgREST-verified claims directly; no auth/validator/material executor grants.
begin;
set local search_path='';
set local lock_timeout='5s';
set local statement_timeout='30s';
alter policy analysis_mission_links_read_own on public.academic_analysis_mission_links to authenticated,analysis_mission_executor
  using ((nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')=user_id::text);
alter policy analysis_mission_links_insert_own on public.academic_analysis_mission_links to analysis_mission_executor
  with check ((nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')=user_id::text);
alter policy analysis_mission_material_read on public.academic_materials to analysis_mission_executor using ((nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')=user_id::text);
alter policy analysis_mission_material_lock on public.academic_materials to analysis_mission_executor using ((nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')=user_id::text) with check ((nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')=user_id::text);
alter policy analysis_mission_analysis_read on public.academic_material_analyses to analysis_mission_executor using ((nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')=user_id::text);
alter policy analysis_mission_analysis_lock on public.academic_material_analyses to analysis_mission_executor using ((nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')=user_id::text) with check ((nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')=user_id::text);
alter policy analysis_mission_insert on public.missions to analysis_mission_executor
  with check ((nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')=user_id::text and category='academic' and status='planned' and origin_type='ai' and origin_id is null);
alter policy analysis_mission_read on public.missions to analysis_mission_executor using ((nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')=user_id::text);
grant analysis_mission_executor to current_user with admin false, inherit false, set true granted by current_user;
grant create on schema app_missions_private to analysis_mission_executor;
set local role analysis_mission_executor;
create or replace function app_missions_private.create_suggestion_mission(p_analysis_id uuid,p_suggestion_index integer,p_fields jsonb default null)
returns table(mission_id uuid,result text)
language plpgsql security definer set search_path='' set row_security=on
as $fn$
declare
  v_user uuid;
  v_claims jsonb;
  v_material uuid;
  v_analysis record;
  v_source jsonb;
  v_fields jsonb;
  v_title text;
  v_description text;
  v_minutes numeric;
  v_mission uuid;
begin
  v_claims := nullif(current_setting('request.jwt.claims',true),'')::jsonb;
  if coalesce(v_claims->>'sub','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or (nullif(current_setting('request.jwt.claim.sub',true),'') is not null
      and current_setting('request.jwt.claim.sub',true) is distinct from (v_claims->>'sub')) then
    raise exception using errcode='42501',message='Authentication required.';
  end if;
  v_user := (v_claims->>'sub')::uuid;
  if v_user is null or jsonb_typeof(v_claims) is distinct from 'object'
    or v_claims->>'role' is distinct from 'authenticated'
    or v_claims->>'sub' is distinct from v_user::text
    or jsonb_typeof(v_claims->'exp') is distinct from 'number'
    or coalesce(v_claims->>'exp','') !~ '^[0-9]{1,11}$'
    or to_timestamp((v_claims->>'exp')::double precision)<=clock_timestamp() then
    raise exception using errcode='42501',message='Authentication required.';
  end if;
  if p_suggestion_index is null or p_suggestion_index not between 0 and 7 then
    raise exception using errcode='22023',message='Invalid suggestion.';
  end if;
  select a.material_id into v_material from public.academic_material_analyses a where a.id=p_analysis_id and a.user_id=v_user;
  if not found then raise exception using errcode='42501',message='Analysis unavailable.'; end if;
  -- Same lock order as PDF deletion/completion. No network work inside locks.
  perform m.id from public.academic_materials m where m.id=v_material and m.user_id=v_user
    and m.file_status='ready' and m.deleted_at is null for update;
  if not found then raise exception using errcode='42501',message='Material unavailable.'; end if;
  select a.status,a.result,a.schema_version into v_analysis from public.academic_material_analyses a
    where a.id=p_analysis_id and a.user_id=v_user and a.material_id=v_material for update;
  if not found or v_analysis.status<>'completed' or v_analysis.schema_version<>1 then
    raise exception using errcode='42501',message='Analysis unavailable.';
  end if;
  if jsonb_typeof(v_analysis.result->'suggestedMissions') is distinct from 'array'
    or jsonb_array_length(v_analysis.result->'suggestedMissions')>8 then
    raise exception using errcode='22023',message='Invalid suggestions.';
  end if;
  v_source := v_analysis.result->'suggestedMissions'->p_suggestion_index;
  if jsonb_typeof(v_source) is distinct from 'object'
    or jsonb_typeof(v_source->'title') is distinct from 'string'
    or char_length(v_source->>'title') not between 1 and 160
    or jsonb_typeof(v_source->'description') is distinct from 'string'
    or char_length(v_source->>'description') not between 1 and 600
    or coalesce(v_source->>'priority','') not in ('low','medium','high')
    or jsonb_typeof(v_source->'estimatedMinutes') is distinct from 'number'
    or coalesce(v_source->>'estimatedMinutes','') !~ '^[0-9]+$'
    or (v_source->>'estimatedMinutes')::numeric not between 5 and 240 then
    raise exception using errcode='22023',message='Invalid suggestion.';
  end if;
  select l.mission_id into v_mission from public.academic_analysis_mission_links l
    where l.analysis_id=p_analysis_id and l.suggestion_index=p_suggestion_index and l.user_id=v_user;
  if found then return query select v_mission,'already_created'::text; return; end if;
  v_fields := coalesce(p_fields,v_source);
  if jsonb_typeof(v_fields) is distinct from 'object' or octet_length(v_fields::text)>170000
    or not (v_fields ?& array['title','description','priority','estimatedMinutes'])
    or v_fields-array['title','description','priority','estimatedMinutes'] <> '{}'::jsonb
    or jsonb_typeof(v_fields->'title') is distinct from 'string'
    or jsonb_typeof(v_fields->'description') is distinct from 'string'
    or jsonb_typeof(v_fields->'priority') is distinct from 'string'
    or jsonb_typeof(v_fields->'estimatedMinutes') is distinct from 'number' then
    raise exception using errcode='22023',message='Invalid fields.';
  end if;
  v_title := regexp_replace(normalize(v_fields->>'title',NFC),'^\s+|\s+$','','g');
  v_description := regexp_replace(normalize(v_fields->>'description',NFC),'^\s+|\s+$','','g');
  v_minutes := (v_fields->>'estimatedMinutes')::numeric;
  if char_length(v_title) not between 1 and 200 or char_length(v_description)>20000
    or v_fields->>'priority' not in ('low','medium','high') or v_minutes<>trunc(v_minutes)
    or v_minutes not between 1 and 2147483647 then
    raise exception using errcode='22023',message='Invalid fields.';
  end if;
  insert into public.missions(user_id,title,description,category,status,priority,estimated_minutes,origin_type,origin_id)
    values(v_user,v_title,nullif(v_description,''),'academic','planned',v_fields->>'priority',v_minutes::integer,'ai',null)
    returning id into v_mission;
  insert into public.academic_analysis_mission_links(user_id,analysis_id,material_id,mission_id,suggestion_index)
    values(v_user,p_analysis_id,v_material,v_mission,p_suggestion_index);
  return query select v_mission,'created'::text;
end;
$fn$;

reset role;
revoke create on schema app_missions_private from analysis_mission_executor;
revoke analysis_mission_executor from current_user granted by current_user restrict;
do $check$ begin
 if has_schema_privilege('analysis_mission_executor','auth','USAGE')
 or has_table_privilege('authenticated','public.academic_analysis_mission_links','INSERT,UPDATE,DELETE')
 or has_function_privilege('anon','public.create_analysis_suggestion_mission(uuid,integer,jsonb)','EXECUTE')
 or exists(select 1 from pg_roles where rolname='analysis_mission_executor' and (rolcanlogin or rolinherit or rolsuper or rolbypassrls or rolcreatedb or rolcreaterole or rolreplication))
 or exists(select 1 from pg_auth_members where member='analysis_mission_executor'::regrole) then
 raise exception 'Suggestion least privilege postflight failed.'; end if;
end; $check$;
notify pgrst,'reload schema';
commit;
