begin;
set local role semantic_memory_executor;
revoke all on all functions in schema app_semantic_private from public,anon,authenticated;
grant execute on function app_semantic_private.settle_index(uuid,bigint,text,integer,jsonb),app_semantic_private.fail_index(uuid,bigint,text),app_semantic_private.finish_question(uuid,text) to material_validator;
revoke all on function public.request_material_semantic_index(uuid,boolean),public.subject_semantic_status(uuid),public.match_subject_semantic_chunks(uuid,extensions.vector,integer),public.request_semantic_question(uuid) from public,anon,authenticated;
grant execute on function public.request_material_semantic_index(uuid,boolean),public.subject_semantic_status(uuid),public.match_subject_semantic_chunks(uuid,extensions.vector,integer),public.request_semantic_question(uuid) to authenticated;
reset role;
notify pgrst,'reload schema';
commit;
