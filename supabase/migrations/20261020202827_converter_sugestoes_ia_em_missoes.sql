-- 2D.4: one explicit conversion, one atomic mission+link, no provider call.
begin;
set local search_path = '';
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create role analysis_mission_executor nologin noinherit nosuperuser nobypassrls nocreatedb nocreaterole noreplication;
grant analysis_mission_executor to current_user with admin false, inherit false, set true granted by current_user;
create schema app_missions_private;
revoke all on schema app_missions_private from public, anon, authenticated;
grant usage on schema app_missions_private to authenticated, analysis_mission_executor;
grant usage on schema public, auth to analysis_mission_executor;
grant execute on function auth.uid() to analysis_mission_executor;

alter table public.missions add constraint missions_owner_id_key unique(user_id,id);
alter table public.academic_material_analyses add constraint analyses_owner_material_id_key unique(user_id,id,material_id);
create table public.academic_analysis_mission_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  analysis_id uuid not null,
  material_id uuid not null,
  mission_id uuid,
  suggestion_index integer not null check(suggestion_index between 0 and 7),
  created_at timestamptz not null default now(),
  unique(analysis_id,suggestion_index),
  unique(mission_id),
  foreign key(user_id,analysis_id,material_id) references public.academic_material_analyses(user_id,id,material_id),
  -- Keep a tombstone after mission deletion: retry cannot recreate the suggestion.
  foreign key(user_id,mission_id) references public.missions(user_id,id) on delete set null (mission_id)
);
create index analysis_mission_links_owner_analysis_idx on public.academic_analysis_mission_links(user_id,analysis_id,material_id);
create index analysis_mission_links_owner_mission_idx on public.academic_analysis_mission_links(user_id,mission_id);
alter table public.academic_analysis_mission_links enable row level security;
alter table public.academic_analysis_mission_links force row level security;
revoke all on public.academic_analysis_mission_links from public,anon,authenticated;
grant select on public.academic_analysis_mission_links to authenticated,analysis_mission_executor;
grant insert on public.academic_analysis_mission_links to analysis_mission_executor;
create policy analysis_mission_links_read_own on public.academic_analysis_mission_links for select to authenticated,analysis_mission_executor
  using ((select auth.uid())=user_id);
create policy analysis_mission_links_insert_own on public.academic_analysis_mission_links for insert to analysis_mission_executor
  with check ((select auth.uid())=user_id);

grant select(id,user_id,material_id,status,result,schema_version) on public.academic_material_analyses to analysis_mission_executor;
grant select(id,user_id,file_status,deleted_at) on public.academic_materials to analysis_mission_executor;
-- Row locks require UPDATE privilege; only id is granted, no function updates it.
grant update(id) on public.academic_materials, public.academic_material_analyses to analysis_mission_executor;
create policy analysis_mission_material_read on public.academic_materials for select to analysis_mission_executor using ((select auth.uid())=user_id);
create policy analysis_mission_material_lock on public.academic_materials for update to analysis_mission_executor using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy analysis_mission_analysis_read on public.academic_material_analyses for select to analysis_mission_executor using ((select auth.uid())=user_id);
create policy analysis_mission_analysis_lock on public.academic_material_analyses for update to analysis_mission_executor using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
grant insert(user_id,title,description,category,status,priority,estimated_minutes,origin_type,origin_id) on public.missions to analysis_mission_executor;
grant select(id,user_id) on public.missions to analysis_mission_executor;
create policy analysis_mission_insert on public.missions for insert to analysis_mission_executor
  with check ((select auth.uid())=user_id and category='academic' and status='planned' and origin_type='ai' and origin_id is null);
create policy analysis_mission_read on public.missions for select to analysis_mission_executor using ((select auth.uid())=user_id);

create function app_missions_private.create_suggestion_mission(p_analysis_id uuid,p_suggestion_index integer,p_fields jsonb default null)
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
  v_user := auth.uid();
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
grant create on schema app_missions_private to analysis_mission_executor;
alter function app_missions_private.create_suggestion_mission(uuid,integer,jsonb) owner to analysis_mission_executor;
revoke create on schema app_missions_private from analysis_mission_executor;
revoke analysis_mission_executor from current_user granted by current_user restrict;
revoke all on function app_missions_private.create_suggestion_mission(uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function app_missions_private.create_suggestion_mission(uuid,integer,jsonb) to authenticated;
create function public.create_analysis_suggestion_mission(p_analysis_id uuid,p_suggestion_index integer,p_fields jsonb default null)
returns table(mission_id uuid,result text) language sql security invoker set search_path=''
as $fn$ select * from app_missions_private.create_suggestion_mission(p_analysis_id,p_suggestion_index,p_fields); $fn$;
revoke all on function public.create_analysis_suggestion_mission(uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.create_analysis_suggestion_mission(uuid,integer,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
