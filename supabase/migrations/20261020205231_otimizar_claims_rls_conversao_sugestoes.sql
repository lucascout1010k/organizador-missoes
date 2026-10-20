-- Cache identity once per statement and retain UUID index comparisons.
begin;
set local search_path='';
set local lock_timeout='5s';
alter policy analysis_mission_links_read_own on public.academic_analysis_mission_links to authenticated,analysis_mission_executor
  using ((select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid)=user_id);
alter policy analysis_mission_links_insert_own on public.academic_analysis_mission_links to analysis_mission_executor
  with check ((select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid)=user_id);
alter policy analysis_mission_material_read on public.academic_materials to analysis_mission_executor using ((select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid)=user_id);
alter policy analysis_mission_material_lock on public.academic_materials to analysis_mission_executor using ((select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid)=user_id) with check ((select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid)=user_id);
alter policy analysis_mission_analysis_read on public.academic_material_analyses to analysis_mission_executor using ((select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid)=user_id);
alter policy analysis_mission_analysis_lock on public.academic_material_analyses to analysis_mission_executor using ((select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid)=user_id) with check ((select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid)=user_id);
alter policy analysis_mission_insert on public.missions to analysis_mission_executor
  with check ((select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid)=user_id and category='academic' and status='planned' and origin_type='ai' and origin_id is null);
alter policy analysis_mission_read on public.missions to analysis_mission_executor using ((select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid)=user_id);
commit;
