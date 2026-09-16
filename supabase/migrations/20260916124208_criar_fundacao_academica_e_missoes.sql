-- Etapa 1C: academic foundation and universal missions.
-- Execute once, in full, in the SQL Editor of the intended Supabase project.
-- No user records, credentials, elevated application keys or auth mutations.
-- Transactional: an error rolls back this migration; do not remove safety checks to retry.
begin;

create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

-- One reusable invoker trigger. It reads no other table and cannot bypass RLS.
create function app_private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  new.created_at := old.created_at;
  new.updated_at := pg_catalog.statement_timestamp();
  return new;
end;
$function$;

revoke all on function app_private.set_updated_at() from public, anon, authenticated;

create table public.academic_courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academic_courses_owner_id_key unique (user_id, id)
);

alter table public.academic_courses enable row level security;
alter table public.academic_courses force row level security;
revoke all on table public.academic_courses from public, anon, authenticated;

create table public.academic_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  period_number smallint check (period_number > 0),
  year smallint check (year between 1 and 9999),
  term text check (char_length(btrim(term)) between 1 and 100),
  status text not null default 'planned' check (status in ('planned', 'active', 'completed', 'archived')),
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academic_periods_dates_check check (end_date >= start_date),
  constraint academic_periods_owner_id_key unique (user_id, id),
  constraint academic_periods_course_owner_fkey foreign key (user_id, course_id)
    references public.academic_courses(user_id, id) on delete no action
);

alter table public.academic_periods enable row level security;
alter table public.academic_periods force row level security;
revoke all on table public.academic_periods from public, anon, authenticated;

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  period_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  code text check (char_length(btrim(code)) between 1 and 50),
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subjects_owner_id_key unique (user_id, id),
  constraint subjects_period_owner_fkey foreign key (user_id, period_id)
    references public.academic_periods(user_id, id) on delete no action
);

alter table public.subjects enable row level security;
alter table public.subjects force row level security;
revoke all on table public.subjects from public, anon, authenticated;

create table public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  class_date timestamptz not null,
  notes text check (char_length(notes) <= 20000),
  status text not null default 'planned' check (status in ('planned', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint class_sessions_owner_id_key unique (user_id, id),
  constraint class_sessions_subject_owner_fkey foreign key (user_id, subject_id)
    references public.subjects(user_id, id) on delete no action
);

alter table public.class_sessions enable row level security;
alter table public.class_sessions force row level security;
revoke all on table public.class_sessions from public, anon, authenticated;

create table public.exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  exam_date timestamptz not null,
  topics text[] not null default array[]::text[],
  notes text check (char_length(notes) <= 20000),
  status text not null default 'planned' check (status in ('planned', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exams_topics_check check (
    cardinality(topics) = 0 or (
      array_ndims(topics) = 1
      and array_lower(topics, 1) = 1
      and cardinality(topics) <= 100
      and array_position(topics, null) is null
      and char_length(array_to_string(topics, '')) <= 20000
    )
  ),
  constraint exams_owner_id_key unique (user_id, id),
  constraint exams_subject_owner_fkey foreign key (user_id, subject_id)
    references public.subjects(user_id, id) on delete no action
);

alter table public.exams enable row level security;
alter table public.exams force row level security;
revoke all on table public.exams from public, anon, authenticated;

create table public.missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text check (char_length(description) <= 20000),
  category text not null check (category in ('academic', 'gym', 'project', 'personal')),
  status text not null default 'planned'
    check (status in ('planned', 'in_progress', 'completed', 'postponed', 'missed')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  scheduled_for timestamptz,
  due_at timestamptz,
  estimated_minutes integer check (estimated_minutes > 0),
  origin_type text check (origin_type in ('manual', 'subject', 'class_session', 'exam', 'pdf', 'ai', 'gym', 'project')),
  origin_id uuid,
  -- Derived columns cannot be supplied by clients and allow real owner-scoped FKs.
  origin_subject_id uuid generated always as (
    case when origin_type = 'subject' then origin_id end
  ) stored,
  origin_class_session_id uuid generated always as (
    case when origin_type = 'class_session' then origin_id end
  ) stored,
  origin_exam_id uuid generated always as (
    case when origin_type = 'exam' then origin_id end
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint missions_completion_check check ((status = 'completed') = (completed_at is not null)),
  -- Reserved future origin labels have no target IDs until their own schema exists.
  constraint missions_origin_check check (
    (origin_type is null and origin_id is null) or
    (origin_type is not null and (
      (origin_type in ('manual', 'pdf', 'ai', 'gym', 'project') and origin_id is null) or
      (origin_type in ('subject', 'class_session', 'exam') and origin_id is not null)
    ))
  ),
  constraint missions_academic_category_check check (
    origin_type is null or origin_type not in ('subject', 'class_session', 'exam') or category = 'academic'
  ),
  constraint missions_subject_owner_fkey foreign key (user_id, origin_subject_id)
    references public.subjects(user_id, id) on delete no action,
  constraint missions_class_session_owner_fkey foreign key (user_id, origin_class_session_id)
    references public.class_sessions(user_id, id) on delete no action,
  constraint missions_exam_owner_fkey foreign key (user_id, origin_exam_id)
    references public.exams(user_id, id) on delete no action
);

alter table public.missions enable row level security;
alter table public.missions force row level security;
revoke all on table public.missions from public, anon, authenticated;

-- Parent deletes do not cascade through academic history. Delete children explicitly.
-- Deleting an Auth account cascades through all its private rows in the same statement.
-- Composite keys (user_id, id) index ownership on parent tables.
create index academic_courses_user_status_idx on public.academic_courses(user_id, status);
create index academic_periods_user_course_idx on public.academic_periods(user_id, course_id, period_number);
create index academic_periods_user_status_idx on public.academic_periods(user_id, status);
create index subjects_user_period_idx on public.subjects(user_id, period_id);
create index subjects_user_status_idx on public.subjects(user_id, status);
create index class_sessions_user_subject_date_idx on public.class_sessions(user_id, subject_id, class_date);
create index class_sessions_user_status_idx on public.class_sessions(user_id, status);
create index exams_user_subject_idx on public.exams(user_id, subject_id);
create index exams_user_date_idx on public.exams(user_id, exam_date);
create index exams_user_status_idx on public.exams(user_id, status);
create index missions_user_status_idx on public.missions(user_id, status);
create index missions_user_scheduled_idx on public.missions(user_id, scheduled_for);
create index missions_user_due_idx on public.missions(user_id, due_at);
create index missions_user_subject_idx on public.missions(user_id, origin_subject_id)
  where origin_subject_id is not null;
create index missions_user_class_session_idx on public.missions(user_id, origin_class_session_id)
  where origin_class_session_id is not null;
create index missions_user_exam_idx on public.missions(user_id, origin_exam_id)
  where origin_exam_id is not null;

create policy academic_courses_select_own on public.academic_courses
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy academic_courses_insert_own on public.academic_courses
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy academic_courses_update_own on public.academic_courses
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy academic_courses_delete_own on public.academic_courses
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create trigger academic_courses_set_updated_at
  before update on public.academic_courses
  for each row execute function app_private.set_updated_at();

create policy academic_periods_select_own on public.academic_periods
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy academic_periods_insert_own on public.academic_periods
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy academic_periods_update_own on public.academic_periods
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy academic_periods_delete_own on public.academic_periods
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create trigger academic_periods_set_updated_at
  before update on public.academic_periods
  for each row execute function app_private.set_updated_at();

create policy subjects_select_own on public.subjects
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy subjects_insert_own on public.subjects
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy subjects_update_own on public.subjects
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy subjects_delete_own on public.subjects
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create trigger subjects_set_updated_at
  before update on public.subjects
  for each row execute function app_private.set_updated_at();

create policy class_sessions_select_own on public.class_sessions
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy class_sessions_insert_own on public.class_sessions
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy class_sessions_update_own on public.class_sessions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy class_sessions_delete_own on public.class_sessions
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create trigger class_sessions_set_updated_at
  before update on public.class_sessions
  for each row execute function app_private.set_updated_at();

create policy exams_select_own on public.exams
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy exams_insert_own on public.exams
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy exams_update_own on public.exams
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy exams_delete_own on public.exams
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create trigger exams_set_updated_at
  before update on public.exams
  for each row execute function app_private.set_updated_at();

create policy missions_select_own on public.missions
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy missions_insert_own on public.missions
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy missions_update_own on public.missions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy missions_delete_own on public.missions
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create trigger missions_set_updated_at
  before update on public.missions
  for each row execute function app_private.set_updated_at();

-- Deliberate Data API exposure: CRUD only, always subject to RLS.
grant usage on schema public to authenticated;
grant select, insert, update, delete on table
  public.academic_courses,
  public.academic_periods,
  public.subjects,
  public.class_sessions,
  public.exams,
  public.missions
to authenticated;

-- SQL Editor runs do not automatically register Supabase CLI migration history.
-- Do not run db push later without reconciling the applied migration history.
notify pgrst, 'reload schema';

commit;
