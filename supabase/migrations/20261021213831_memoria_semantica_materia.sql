begin;
set local search_path = '';
set local lock_timeout = '5s';
set local statement_timeout = '30s';
create extension if not exists vector with schema extensions;
create role semantic_memory_executor nologin noinherit nosuperuser nobypassrls nocreatedb nocreaterole noreplication;
grant semantic_memory_executor to current_user with admin false, inherit false, set true granted by current_user;
create schema app_semantic_private;
revoke all on schema app_semantic_private from public,anon,authenticated;
grant usage on schema public,extensions,app_semantic_private to semantic_memory_executor;
grant usage on schema app_semantic_private to material_validator;

-- No text, PDF copy, question, answer or provider response is stored.
create table public.academic_material_semantic_indexes (
 material_id uuid primary key, user_id uuid not null, subject_id uuid not null,
 status text not null check(status in ('indexing','ready','failed')),
 embedding_model text not null check(embedding_model='gemini-embedding-2'),
 embedding_dimensions integer not null check(embedding_dimensions=768),
 index_version text not null check(index_version='subject-semantic-memory-v1'),
 consent_version text not null check(consent_version='semantic-memory-consent-v1'),
 generation bigint not null default 1 check(generation>0), token_hash bytea, lease_expires_at timestamptz,
 page_count integer check(page_count between 1 and 120), error_code text,
 started_at timestamptz not null default now(), completed_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(user_id,subject_id,material_id,index_version),
 foreign key(user_id,material_id) references public.academic_materials(user_id,id) on delete cascade,
 foreign key(user_id,subject_id) references public.subjects(user_id,id),
 check ((status='indexing')=(token_hash is not null and lease_expires_at is not null)),
 check (token_hash is null or octet_length(token_hash)=32),
 check(status<>'ready' or (page_count is not null and completed_at is not null))
);
create table public.academic_material_semantic_chunks (
 id uuid primary key default gen_random_uuid(), user_id uuid not null, subject_id uuid not null,
 material_id uuid not null, index_version text not null,
 chunk_index integer not null check(chunk_index between 0 and 39),
 page_start integer not null check(page_start between 1 and 120),
 page_end integer not null check(page_end>=page_start and page_end<=120 and page_end-page_start<4),
 embedding extensions.vector(768) not null check(extensions.vector_norm(embedding)>0),
 created_at timestamptz not null default now(),
 unique(material_id,index_version,chunk_index),
 foreign key(user_id,subject_id,material_id,index_version)
 references public.academic_material_semantic_indexes(user_id,subject_id,material_id,index_version) on delete cascade
);
-- A bounded request gate only: no conversation history or query text.
create table app_semantic_private.question_gates (
 user_id uuid not null references auth.users(id) on delete cascade,
 subject_id uuid not null, token_hash bytea not null, expires_at timestamptz not null,
 next_allowed_at timestamptz not null, primary key(user_id,subject_id),
 foreign key(user_id,subject_id) references public.subjects(user_id,id) on delete cascade
);
create index semantic_indexes_owner_subject on public.academic_material_semantic_indexes(user_id,subject_id);
create index semantic_chunks_owner_subject on public.academic_material_semantic_chunks(user_id,subject_id);
alter table public.academic_material_semantic_indexes enable row level security;
alter table public.academic_material_semantic_indexes force row level security;
alter table public.academic_material_semantic_chunks enable row level security;
alter table public.academic_material_semantic_chunks force row level security;
alter table app_semantic_private.question_gates enable row level security;
alter table app_semantic_private.question_gates force row level security;
revoke all on public.academic_material_semantic_indexes,public.academic_material_semantic_chunks,app_semantic_private.question_gates from public,anon,authenticated,material_validator;
grant select,insert,update,delete on public.academic_material_semantic_indexes,public.academic_material_semantic_chunks,app_semantic_private.question_gates to semantic_memory_executor;
create policy semantic_indexes_executor on public.academic_material_semantic_indexes to semantic_memory_executor using(true) with check(true);
create policy semantic_chunks_executor on public.academic_material_semantic_chunks to semantic_memory_executor using(true) with check(true);
create policy semantic_questions_executor on app_semantic_private.question_gates to semantic_memory_executor using(true) with check(true);
grant select(id,user_id,subject_id,file_status,deleted_at,title),update(id) on public.academic_materials to semantic_memory_executor;
grant select(id,user_id) on public.subjects to semantic_memory_executor;
create policy semantic_material_read on public.academic_materials for select to semantic_memory_executor using(true);
create policy semantic_material_lock on public.academic_materials for update to semantic_memory_executor using(true) with check(true);
create policy semantic_subject_read on public.subjects for select to semantic_memory_executor using(true);

grant create on schema public,app_semantic_private to semantic_memory_executor;
set local role semantic_memory_executor;
create function app_semantic_private.current_user_id() returns uuid
language plpgsql security invoker set search_path='' as $f$
declare c jsonb; u uuid;
begin
 c:=nullif(current_setting('request.jwt.claims',true),'')::jsonb;
 if c->>'role' is distinct from 'authenticated' or c->>'sub' is null
 or jsonb_typeof(c->'exp') is distinct from 'number'
 or (c->>'exp')::numeric<=extract(epoch from clock_timestamp()) then raise exception 'Authentication required' using errcode='42501'; end if;
 u:=(c->>'sub')::uuid;
 if nullif(current_setting('request.jwt.claim.sub',true),'') is not null
 and current_setting('request.jwt.claim.sub',true)<>u::text then raise exception 'Claims mismatch' using errcode='42501'; end if;
 return u;
exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'Authentication required' using errcode='42501';
end $f$;

create function public.request_material_semantic_index(p_material_id uuid,p_consent boolean)
returns table(decision text,generation bigint,completion_token text)
language plpgsql security definer set search_path='' set row_security=on as $f$
declare u uuid:=app_semantic_private.current_user_id(); m record; i record; t bytea;
begin
 if p_consent is distinct from true then raise exception 'Consent required' using errcode='42501'; end if;
 select id,subject_id into m from public.academic_materials where id=p_material_id and user_id=u and file_status='ready' and deleted_at is null for update;
 if not found then return; end if;
 select * into i from public.academic_material_semantic_indexes where material_id=p_material_id for update;
 if found and i.status='ready' then return query select 'ready'::text,i.generation,null::text; return; end if;
 if found and i.status='indexing' and i.lease_expires_at>clock_timestamp() then return query select 'indexing'::text,i.generation,null::text; return; end if;
 t:=extensions.gen_random_bytes(32);
 insert into public.academic_material_semantic_indexes(material_id,user_id,subject_id,status,embedding_model,embedding_dimensions,index_version,consent_version,token_hash,lease_expires_at)
 values(p_material_id,u,m.subject_id,'indexing','gemini-embedding-2',768,'subject-semantic-memory-v1','semantic-memory-consent-v1',extensions.digest(t,'sha256'),clock_timestamp()+interval '10 minutes')
 on conflict(material_id) do update set status='indexing',generation=academic_material_semantic_indexes.generation+1,token_hash=excluded.token_hash,lease_expires_at=excluded.lease_expires_at,started_at=clock_timestamp(),updated_at=clock_timestamp(),error_code=null
 returning academic_material_semantic_indexes.generation into i;
 return query select 'issued'::text,i.generation,encode(t,'hex');
end $f$;

create function app_semantic_private.settle_index(p_material uuid,p_generation bigint,p_token text,p_pages integer,p_chunks jsonb)
returns void language plpgsql security definer set search_path='' set row_security=on as $f$
declare i record; m record; c jsonb; n integer:=0; expected integer:=1; v extensions.vector(768);
begin
 select id into m from public.academic_materials where id=p_material and file_status='ready' and deleted_at is null for update;
 if not found then raise exception 'Material unavailable' using errcode='42501'; end if;
 select * into i from public.academic_material_semantic_indexes where material_id=p_material for update;
 if not found or i.status<>'indexing' or i.generation<>p_generation or i.lease_expires_at<=clock_timestamp()
 or p_token is null or p_token !~ '^[0-9a-f]{64}$' or i.token_hash is distinct from extensions.digest(decode(p_token,'hex'),'sha256') then raise exception 'Index authorization unavailable' using errcode='42501'; end if;
 if p_pages is null or p_pages not between 1 and 120 or jsonb_typeof(p_chunks) is distinct from 'array'
 or jsonb_array_length(p_chunks) not between 1 and 40 or octet_length(p_chunks::text)>2000000 then raise exception 'Invalid index evidence'; end if;
 -- Validate the entire exact window plan before making any old chunk unavailable.
 for c in select value from jsonb_array_elements(p_chunks) loop
 if (c->>'chunkIndex')::integer<>n or (c->>'pageStart')::integer<>expected
 or (c->>'pageEnd')::integer<>least(expected+3,p_pages) or jsonb_typeof(c->'embedding') is distinct from 'array'
 or jsonb_array_length(c->'embedding')<>768 then raise exception 'Invalid page plan'; end if;
 v:=(c->'embedding')::text::extensions.vector(768);
 if extensions.vector_norm(v)<=0 then raise exception 'Invalid embedding'; end if;
 n:=n+1;
 if (c->>'pageEnd')::integer=p_pages then expected:=p_pages+1; else expected:=expected+3; end if;
 end loop;
 if expected<>p_pages+1 then raise exception 'Incomplete index'; end if;
 delete from public.academic_material_semantic_chunks where material_id=p_material;
 insert into public.academic_material_semantic_chunks(user_id,subject_id,material_id,index_version,chunk_index,page_start,page_end,embedding)
 select i.user_id,i.subject_id,p_material,i.index_version,(value->>'chunkIndex')::integer,(value->>'pageStart')::integer,(value->>'pageEnd')::integer,(value->'embedding')::text::extensions.vector(768) from jsonb_array_elements(p_chunks);
 update public.academic_material_semantic_indexes set status='ready',page_count=p_pages,completed_at=clock_timestamp(),updated_at=clock_timestamp(),token_hash=null,lease_expires_at=null,error_code=null where material_id=p_material;
end $f$;

create function app_semantic_private.fail_index(p_material uuid,p_generation bigint,p_token text)
returns void language plpgsql security definer set search_path='' set row_security=on as $f$
begin
 perform id from public.academic_materials where id=p_material for update;
 update public.academic_material_semantic_indexes set status=case when completed_at is null then 'failed' else 'ready' end,
 token_hash=null,lease_expires_at=null,error_code='index_failed',updated_at=clock_timestamp()
 where material_id=p_material and status='indexing' and generation=p_generation
 and p_token ~ '^[0-9a-f]{64}$' and token_hash=extensions.digest(decode(p_token,'hex'),'sha256');
end $f$;

create function public.subject_semantic_status(p_subject_id uuid)
returns table(material_id uuid,status text,page_count integer)
language plpgsql security definer set search_path='' set row_security=on as $f$
declare u uuid:=app_semantic_private.current_user_id();
begin
 return query select m.id,case when i.status='indexing' and i.lease_expires_at<=clock_timestamp() then 'failed' else coalesce(i.status,'not_indexed') end,i.page_count
 from public.academic_materials m left join public.academic_material_semantic_indexes i on i.material_id=m.id and i.user_id=u
 where m.user_id=u and m.subject_id=p_subject_id and m.file_status='ready' and m.deleted_at is null;
end $f$;

create function public.match_subject_semantic_chunks(p_subject_id uuid,p_query_embedding extensions.vector(768),p_match_count integer default 6)
returns table(material_id uuid,title text,chunk_index integer,page_start integer,page_end integer,similarity double precision)
language plpgsql security definer set search_path='' set row_security=on as $f$
declare u uuid:=app_semantic_private.current_user_id();
begin
 if p_match_count is null or p_match_count not between 1 and 6 or p_query_embedding is null or extensions.vector_dims(p_query_embedding)<>768 or extensions.vector_norm(p_query_embedding)<=0 then raise exception 'Invalid search'; end if;
 return query select c.material_id,m.title,c.chunk_index,c.page_start,c.page_end,1-(c.embedding operator(extensions.<=>) p_query_embedding)
 from public.academic_material_semantic_chunks c join public.academic_material_semantic_indexes i on i.material_id=c.material_id
 join public.academic_materials m on m.id=c.material_id
 where c.user_id=u and i.user_id=u and m.user_id=u and c.subject_id=p_subject_id and m.subject_id=p_subject_id
 and i.status='ready' and i.index_version='subject-semantic-memory-v1' and c.index_version=i.index_version
 and i.embedding_model='gemini-embedding-2' and i.embedding_dimensions=768
 and m.file_status='ready' and m.deleted_at is null
 order by c.embedding operator(extensions.<=>) p_query_embedding,c.material_id,c.chunk_index limit p_match_count;
end $f$;

create function public.request_semantic_question(p_subject_id uuid)
returns text language plpgsql security definer set search_path='' set row_security=on as $f$
declare u uuid:=app_semantic_private.current_user_id(); t bytea:=extensions.gen_random_bytes(32); changed integer;
begin
 if not exists(select 1 from public.subjects where id=p_subject_id and user_id=u) then return null; end if;
 insert into app_semantic_private.question_gates(user_id,subject_id,token_hash,expires_at,next_allowed_at)
 values(u,p_subject_id,extensions.digest(t,'sha256'),clock_timestamp()+interval '120 seconds',clock_timestamp()+interval '5 seconds')
 on conflict(user_id,subject_id) do update set token_hash=excluded.token_hash,expires_at=excluded.expires_at,next_allowed_at=excluded.next_allowed_at
 where question_gates.expires_at<=clock_timestamp() and question_gates.next_allowed_at<=clock_timestamp();
 get diagnostics changed=row_count;
 if changed=0 then return null; end if;
 return encode(t,'hex');
end $f$;
create function app_semantic_private.finish_question(p_subject uuid,p_token text) returns void
language sql security definer set search_path='' set row_security=on as $f$
 update app_semantic_private.question_gates set expires_at=clock_timestamp() where subject_id=p_subject and token_hash=extensions.digest(decode(p_token,'hex'),'sha256');
$f$;

create function app_semantic_private.delete_derived_index() returns trigger
language plpgsql security definer set search_path='' set row_security=on as $f$
begin
 if new.file_status='deleted' then delete from public.academic_material_semantic_indexes where material_id=new.id; end if;
 return new;
end $f$;
reset role;
create trigger semantic_material_deleted after update of file_status on public.academic_materials for each row when(new.file_status='deleted') execute function app_semantic_private.delete_derived_index();
revoke create on schema public,app_semantic_private from semantic_memory_executor;
revoke all on all functions in schema app_semantic_private from public,anon,authenticated;
grant execute on function app_semantic_private.settle_index(uuid,bigint,text,integer,jsonb),app_semantic_private.fail_index(uuid,bigint,text),app_semantic_private.finish_question(uuid,text) to material_validator;
revoke all on function public.request_material_semantic_index(uuid,boolean),public.subject_semantic_status(uuid),public.match_subject_semantic_chunks(uuid,extensions.vector,integer),public.request_semantic_question(uuid) from public,anon,authenticated;
grant execute on function public.request_material_semantic_index(uuid,boolean),public.subject_semantic_status(uuid),public.match_subject_semantic_chunks(uuid,extensions.vector,integer),public.request_semantic_question(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
