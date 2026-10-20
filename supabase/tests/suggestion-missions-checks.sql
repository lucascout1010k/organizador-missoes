-- Run only with controlled 2D.4 fixtures. All changes roll back, including the
-- temporary failure trigger. Never use a real academic analysis as a fixture.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $checks$
begin
  assert (select relrowsecurity and relforcerowsecurity from pg_class where oid='public.academic_analysis_mission_links'::regclass), 'RLS/FORCE required';
  assert not has_table_privilege('authenticated','public.academic_analysis_mission_links','INSERT,UPDATE,DELETE'), 'Client write grants';
  assert not has_function_privilege('anon','public.create_analysis_suggestion_mission(uuid,integer,jsonb)','EXECUTE'), 'Anon execute';
  assert not has_schema_privilege('analysis_mission_executor','auth','USAGE'), 'Managed auth dependency';
  assert not exists(select 1 from pg_auth_members where member='analysis_mission_executor'::regrole), 'Executor membership';
  assert not exists(select 1 from pg_roles where rolname='analysis_mission_executor' and (rolcanlogin or rolsuper or rolbypassrls or rolinherit or rolcreatedb or rolcreaterole or rolreplication)), 'Executor privilege';
  assert (select proowner='analysis_mission_executor'::regrole and prosecdef and proconfig @> array['row_security=on'] from pg_proc where oid='app_missions_private.create_suggestion_mission(uuid,integer,jsonb)'::regprocedure), 'Private owner/RLS';
  assert (select not prosecdef from pg_proc where oid='public.create_analysis_suggestion_mission(uuid,integer,jsonb)'::regprocedure), 'Public invoker';
end;
$checks$;

-- Force a failure after mission INSERT, at link INSERT, to prove rollback.
create function pg_temp.reject_2d4_fixture_link() returns trigger language plpgsql set search_path='' as $trigger$
begin
  if new.analysis_id='2d400000-0000-4000-8000-000000000014'::uuid and new.suggestion_index=6 then
    raise exception '2D4_CONTROLLED_LINK_FAILURE';
  end if;
  return new;
end;
$trigger$;
create trigger test_2d4_controlled_link_failure before insert on public.academic_analysis_mission_links
  for each row execute function pg_temp.reject_2d4_fixture_link();
select set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub','2d400000-0000-4000-8000-000000000001','exp',extract(epoch from now()+interval '1 hour')::bigint)::text,true);
set local role authenticated;
do $atomicity$
declare before_count integer; caught boolean := false;
begin
  select count(*) into before_count from public.missions;
  begin
    perform * from public.create_analysis_suggestion_mission('2d400000-0000-4000-8000-000000000014',6);
  exception when raise_exception then
    if sqlerrm='2D4_CONTROLLED_LINK_FAILURE' then caught:=true; else raise; end if;
  end;
  assert caught, 'Controlled link failure must be reached';
  assert (select count(*)=before_count from public.missions), 'No orphan mission after failed link';
  assert not exists(select 1 from public.academic_analysis_mission_links where analysis_id='2d400000-0000-4000-8000-000000000014' and suggestion_index=6), 'No failed link';
end;
$atomicity$;
reset role;

do $uniqueness$
declare original public.academic_analysis_mission_links%rowtype; caught boolean := false;
begin
 select * into strict original from public.academic_analysis_mission_links where analysis_id='2d400000-0000-4000-8000-000000000014' and suggestion_index=0;
 begin
   insert into public.academic_analysis_mission_links(user_id,analysis_id,material_id,suggestion_index)
   values(original.user_id,original.analysis_id,original.material_id,original.suggestion_index);
 exception when unique_violation then caught:=true;
 end;
 assert caught, 'Database deduplication constraint';
 caught:=false;
 begin
   insert into public.academic_analysis_mission_links(user_id,analysis_id,material_id,suggestion_index)
   values(original.user_id,original.analysis_id,'2d400000-0000-4000-8000-000000000017',7);
 exception when foreign_key_violation then caught:=true;
 end;
 assert caught, 'Composite FK prevents swapped material';
end;
$uniqueness$;

set local role authenticated;
do $claims$
declare bad jsonb; caught boolean;
begin
 for bad in select value from jsonb_array_elements('[{}, {"sub":"bad","role":"authenticated","exp":9999999999},{"sub":"2d400000-0000-4000-8000-000000000001","role":"anon","exp":9999999999},{"sub":"2d400000-0000-4000-8000-000000000001","role":"authenticated","exp":1},{"sub":"2d400000-0000-4000-8000-000000000001","role":"authenticated","exp":"9999999999"}]'::jsonb) loop
  perform set_config('request.jwt.claims',bad::text,true);
  caught:=false;
  begin perform * from public.create_analysis_suggestion_mission('2d400000-0000-4000-8000-000000000014',7);
  exception when insufficient_privilege then caught:=true; end;
  assert caught, 'Invalid claims rejected';
 end loop;
 perform set_config('request.jwt.claims','{"sub":"2d400000-0000-4000-8000-000000000001","role":"authenticated","exp":9999999999}',true);
 perform set_config('request.jwt.claim.sub','2d400000-0000-4000-8000-000000000002',true);
 caught:=false;
 begin perform * from public.create_analysis_suggestion_mission('2d400000-0000-4000-8000-000000000014',7);
 exception when insufficient_privilege then caught:=true; end;
 assert caught, 'Conflicting claims rejected';
end;
$claims$;
reset role;
select '19 SQL assertions passed; all test changes rolled back' as result;
rollback;
