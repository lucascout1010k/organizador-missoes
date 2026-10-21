-- Explicit remote role test. Run the entire script as the migration administrator.
-- Synthetic metadata only, no PDF bytes/provider calls. All rows roll back.
-- Settlement logic runs as its owning executor; validator grants are checked separately.
begin;
insert into auth.users(id) values ('2e200000-0000-4000-8000-000000000001'),('2e200000-0000-4000-8000-000000000002');
insert into public.academic_courses(id,user_id,name) values('2e200000-0000-4000-8000-000000000011','2e200000-0000-4000-8000-000000000001','2E2 Fixture A'),('2e200000-0000-4000-8000-000000000012','2e200000-0000-4000-8000-000000000002','2E2 Fixture B');insert into public.academic_periods(id,user_id,course_id,name) values('2e200000-0000-4000-8000-000000000021','2e200000-0000-4000-8000-000000000001','2e200000-0000-4000-8000-000000000011','2E2 Fixture'),('2e200000-0000-4000-8000-000000000022','2e200000-0000-4000-8000-000000000002','2e200000-0000-4000-8000-000000000012','2E2 Fixture');insert into public.subjects(id,user_id,period_id,name) values('2e200000-0000-4000-8000-000000000031','2e200000-0000-4000-8000-000000000001','2e200000-0000-4000-8000-000000000021','2E2 Fixture A'),('2e200000-0000-4000-8000-000000000032','2e200000-0000-4000-8000-000000000002','2e200000-0000-4000-8000-000000000022','2E2 Fixture B');
insert into public.academic_materials(id,user_id,subject_id,title,file_status,original_filename,storage_path,mime_type,size_bytes) values ('2e200000-0000-4000-8000-000000000051','2e200000-0000-4000-8000-000000000001','2e200000-0000-4000-8000-000000000031','Fixture A','ready','fixture.pdf','2e200000-0000-4000-8000-000000000001/2e200000-0000-4000-8000-000000000031/2e200000-0000-4000-8000-000000000051/source.pdf','application/pdf',1024),
('2e200000-0000-4000-8000-000000000052','2e200000-0000-4000-8000-000000000002','2e200000-0000-4000-8000-000000000032','Fixture B','ready','fixture.pdf','2e200000-0000-4000-8000-000000000002/2e200000-0000-4000-8000-000000000032/2e200000-0000-4000-8000-000000000052/source.pdf','application/pdf',1024);
select set_config('request.jwt.claims','{"sub":"2e200000-0000-4000-8000-000000000001","role":"authenticated","exp":1999999999}',true);
set local role authenticated;
do $test$ declare r record; begin
begin perform * from public.request_material_semantic_index('2e200000-0000-4000-8000-000000000051',false);raise exception 'consent accepted';exception when insufficient_privilege then null;end;
if exists(select 1 from public.request_material_semantic_index('2e200000-0000-4000-8000-000000000052',true)) then raise exception 'cross owner indexed';end if;
select * into r from public.request_material_semantic_index('2e200000-0000-4000-8000-000000000051',true);
if r.decision<>'issued' then raise exception 'lease not issued';end if;
perform set_config('test.semantic_token',r.completion_token,true);
select * into r from public.request_material_semantic_index('2e200000-0000-4000-8000-000000000051',true);
if r.decision<>'indexing' or r.completion_token is not null then raise exception 'concurrent lease';end if;
begin perform * from public.academic_material_semantic_chunks;raise exception 'vectors exposed';exception when insufficient_privilege then null;end;
begin insert into public.academic_material_semantic_indexes(material_id) values('2e200000-0000-4000-8000-000000000051');raise exception 'browser writes index';exception when insufficient_privilege then null;end;
begin perform app_semantic_private.settle_index(null,null,null,null,null);raise exception 'browser settles';exception when insufficient_privilege then null;end;
end $test$;
reset role;
set local role semantic_memory_executor;
do $test$ declare chunks jsonb; begin
chunks:=jsonb_build_array(jsonb_build_object('chunkIndex',0,'pageStart',1,'pageEnd',4,'embedding',to_jsonb(array_prepend(1::real,array_fill(0::real,array[767])))),jsonb_build_object('chunkIndex',1,'pageStart',4,'pageEnd',7,'embedding',to_jsonb(array_prepend(1::real,array_fill(0::real,array[767])))));
begin perform app_semantic_private.settle_index('2e200000-0000-4000-8000-000000000051',1,repeat('b',64),7,chunks);raise exception 'forged completion';exception when insufficient_privilege then null;end;
perform app_semantic_private.settle_index('2e200000-0000-4000-8000-000000000051',1,current_setting('test.semantic_token'),7,chunks);
if has_table_privilege('material_validator','public.academic_material_semantic_chunks','select') then raise exception 'validator reads vectors';end if;
end $test$;
reset role;
set local role authenticated;
do $test$ declare r record; t text; n integer; begin
select * into r from public.request_material_semantic_index('2e200000-0000-4000-8000-000000000051',true);
if r.decision<>'ready' or r.completion_token is not null then raise exception 'ready not reused';end if;
select count(*) into n from public.match_subject_semantic_chunks('2e200000-0000-4000-8000-000000000031',array_prepend(1::real,array_fill(0::real,array[767]))::extensions.vector,6);
if n<>2 then raise exception 'own vector retrieval failed';end if;
if exists(select 1 from public.match_subject_semantic_chunks('2e200000-0000-4000-8000-000000000032',array_prepend(1::real,array_fill(0::real,array[767]))::extensions.vector,6)) then raise exception 'cross subject match';end if;
t:=public.request_semantic_question('2e200000-0000-4000-8000-000000000031');if t is null then raise exception 'question gate missing';end if;
if public.request_semantic_question('2e200000-0000-4000-8000-000000000031') is not null then raise exception 'question concurrent accepted';end if;
end $test$;
reset role;
select set_config('request.jwt.claims','{"sub":"2e200000-0000-4000-8000-000000000002","role":"authenticated","exp":1999999999}',true);
set local role authenticated;
do $test$ begin
if exists(select 1 from public.subject_semantic_status('2e200000-0000-4000-8000-000000000031')) then raise exception 'B reads A metadata';end if;
if exists(select 1 from public.request_material_semantic_index('2e200000-0000-4000-8000-000000000051',true)) then raise exception 'B indexes A material';end if;
if exists(select 1 from public.match_subject_semantic_chunks('2e200000-0000-4000-8000-000000000031',array_prepend(1::real,array_fill(0::real,array[767]))::extensions.vector,6)) then raise exception 'B reads A chunks';end if;
end $test$;
reset role;
set local role anon;
do $test$ begin
begin perform * from public.subject_semantic_status('2e200000-0000-4000-8000-000000000031');raise exception 'anon metadata';exception when insufficient_privilege then null;end;
begin perform * from public.match_subject_semantic_chunks('2e200000-0000-4000-8000-000000000031',null,6);raise exception 'anon match';exception when insufficient_privilege then null;end;
end $test$;
reset role;
update public.academic_materials set file_status='deleted',deleted_at=now() where id='2e200000-0000-4000-8000-000000000051';
do $test$ begin
if exists(select 1 from public.academic_material_semantic_chunks where material_id='2e200000-0000-4000-8000-000000000051') then raise exception 'deleted chunks remained';end if;
if exists(select 1 from public.academic_material_semantic_indexes where material_id='2e200000-0000-4000-8000-000000000051') then raise exception 'deleted index remained';end if;
end $test$;

set local role authenticated;
do $test$ declare r record;begin select * into r from public.request_material_semantic_index('2e200000-0000-4000-8000-000000000052',true);perform set_config('test.old_token',r.completion_token,true);end $test$;
reset role;
update public.academic_material_semantic_indexes set lease_expires_at=clock_timestamp()-interval '1 second' where material_id='2e200000-0000-4000-8000-000000000052';
set local role authenticated;
do $test$ declare r record;begin select * into r from public.request_material_semantic_index('2e200000-0000-4000-8000-000000000052',true);if r.decision<>'issued' or r.generation<>2 then raise exception 'expired lease retry failed';end if;perform set_config('test.new_token',r.completion_token,true);end $test$;
reset role;
set local role semantic_memory_executor;
do $test$ declare chunks jsonb;begin
chunks:=jsonb_build_array(jsonb_build_object('chunkIndex',0,'pageStart',1,'pageEnd',4,'embedding',to_jsonb(array_prepend(1::real,array_fill(0::real,array[767])))));
begin perform app_semantic_private.settle_index('2e200000-0000-4000-8000-000000000052',1,current_setting('test.old_token'),7,chunks);raise exception 'stale generation accepted';exception when insufficient_privilege then null;end;
begin perform app_semantic_private.settle_index('2e200000-0000-4000-8000-000000000052',2,current_setting('test.new_token'),7,chunks);raise exception 'partial plan accepted';exception when raise_exception then if sqlerrm<>'Incomplete index' then raise;end if;end;
if exists(select 1 from public.academic_material_semantic_chunks where material_id='2e200000-0000-4000-8000-000000000052') then raise exception 'partial chunks remained';end if;
perform app_semantic_private.fail_index('2e200000-0000-4000-8000-000000000052',2,current_setting('test.new_token'));
if not exists(select 1 from public.academic_material_semantic_indexes where material_id='2e200000-0000-4000-8000-000000000052' and status='failed') then raise exception 'failed not settled';end if;
end $test$;
reset role;
rollback;
select 'semantic remote role A/B/anon, lease retry, stale generation, atomic settlement, matching, deletion passed; fixtures rolled back' as result;
