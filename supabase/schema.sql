-- Student Assignment and Deadline Management System
-- Full database schema. Applied to the Supabase project as migration "initial_schema".
-- To recreate from scratch, run this once in the Supabase SQL editor.

-- ---------- Tables ----------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  role text not null default 'student' check (role in ('student', 'instructor', 'admin')),
  -- Instructors who sign up start 'pending' until an admin approves them.
  status text not null default 'active' check (status in ('active', 'pending', 'rejected')),
  created_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  course_code text not null check (length(trim(course_code)) > 0),
  enrollment_code text not null unique
    default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  unique (student_id, course_id)
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  description text not null default '',
  current_deadline timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.deadline_changes (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  previous_deadline timestamptz not null,
  new_deadline timestamptz not null,
  changed_by uuid not null references public.profiles(id),
  reason text,
  changed_at timestamptz not null default now(),
  check (previous_deadline <> new_deadline)
);

create table public.assignment_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed')),
  updated_at timestamptz not null default now(),
  unique (student_id, assignment_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  assignment_id uuid references public.assignments(id) on delete cascade,
  deadline_change_id uuid references public.deadline_changes(id) on delete cascade,
  type text not null check (type in ('deadline_changed', 'reminder', 'new_assignment')),
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index on public.courses (instructor_id);
create index on public.enrollments (course_id);
create index on public.assignments (course_id);
create index on public.deadline_changes (assignment_id);
create index on public.deadline_changes (changed_by);
create index on public.assignment_progress (assignment_id);
create index on public.notifications (recipient_id, created_at desc);
create index on public.notifications (assignment_id);
create index on public.notifications (deadline_change_id);
-- At most one reminder per student per assignment.
create unique index notifications_one_reminder on public.notifications (recipient_id, assignment_id) where type = 'reminder';

create index on public.profiles (role, status);

-- ---------- Profile creation on sign-up ----------
-- Sign-up may REQUEST the instructor role; it is created as 'pending' and does nothing
-- until an admin approves it. 'admin' can never be requested. The first admin is set once:
--   update public.profiles set role = 'admin', status = 'active' where email = 'admin@example.com';

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_instructor boolean := coalesce(new.raw_user_meta_data ->> 'requested_role', '') = 'instructor';
begin
  insert into public.profiles (id, full_name, email, role, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, ''),
    case when v_instructor then 'instructor' else 'student' end,
    case when v_instructor then 'pending' else 'active' end
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Helper functions (used by RLS) ----------

-- Only an APPROVED instructor counts; a pending or rejected one can manage nothing.
create or replace function public.is_instructor_of(p_course uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.courses c join public.profiles p on p.id = c.instructor_id
    where c.id = p_course and c.instructor_id = (select auth.uid())
      and p.role = 'instructor' and p.status = 'active'
  );
$$;

create or replace function public.is_enrolled_in(p_course uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.enrollments where course_id = p_course and student_id = (select auth.uid()));
$$;

create or replace function public.is_instructor()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'instructor' and status = 'active');
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin' and status = 'active');
$$;

-- ---------- Row-level security ----------

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.enrollments enable row level security;
alter table public.assignments enable row level security;
alter table public.deadline_changes enable row level security;
alter table public.assignment_progress enable row level security;
alter table public.notifications enable row level security;

-- The anonymous (logged-out) role gets nothing at all.
revoke all on all tables in schema public from anon;

-- profiles: yourself, the students in your courses (instructors), and your instructors (students)
create policy profiles_select on public.profiles for select to authenticated using (
  id = (select auth.uid())
  or public.is_admin()
  or exists (select 1 from public.enrollments e join public.courses c on c.id = e.course_id
             where e.student_id = profiles.id and c.instructor_id = (select auth.uid()))
  or exists (select 1 from public.courses c join public.enrollments e on e.course_id = c.id
             where c.instructor_id = profiles.id and e.student_id = (select auth.uid()))
);
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- Users may only edit their name; role and email can never be changed from the client.
revoke insert, update, delete on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;

-- courses: instructors manage their own; students see the ones they are enrolled in
create policy courses_select on public.courses for select to authenticated using (
  instructor_id = (select auth.uid()) or public.is_enrolled_in(id)
);
create policy courses_insert on public.courses for insert to authenticated with check (
  instructor_id = (select auth.uid()) and public.is_instructor()
);
create policy courses_update on public.courses for update to authenticated
  using (instructor_id = (select auth.uid())) with check (instructor_id = (select auth.uid()));
create policy courses_delete on public.courses for delete to authenticated using (instructor_id = (select auth.uid()));
revoke update on public.courses from authenticated;
grant update (name, course_code, archived) on public.courses to authenticated;

-- enrollments: students see their own, instructors see their course's. Joining only via enroll_by_code().
create policy enrollments_select on public.enrollments for select to authenticated using (
  student_id = (select auth.uid()) or public.is_instructor_of(course_id)
);
create policy enrollments_delete on public.enrollments for delete to authenticated using (student_id = (select auth.uid()));
revoke insert, update on public.enrollments from authenticated;

-- assignments: members read, the course instructor writes.
-- current_deadline can NOT be updated directly; only change_deadline() may do it.
create policy assignments_select on public.assignments for select to authenticated using (
  public.is_instructor_of(course_id) or public.is_enrolled_in(course_id)
);
create policy assignments_insert on public.assignments for insert to authenticated with check (public.is_instructor_of(course_id));
create policy assignments_update on public.assignments for update to authenticated
  using (public.is_instructor_of(course_id)) with check (public.is_instructor_of(course_id));
create policy assignments_delete on public.assignments for delete to authenticated using (public.is_instructor_of(course_id));
revoke update on public.assignments from authenticated;
grant update (title, description) on public.assignments to authenticated;

-- deadline_changes: read-only and append-only; written only by change_deadline()
create policy deadline_changes_select on public.deadline_changes for select to authenticated using (
  exists (select 1 from public.assignments a where a.id = assignment_id
          and (public.is_instructor_of(a.course_id) or public.is_enrolled_in(a.course_id)))
);
revoke insert, update, delete on public.deadline_changes from authenticated;

-- assignment_progress: strictly your own rows, only for assignments in courses you are enrolled in
create policy progress_select on public.assignment_progress for select to authenticated using (student_id = (select auth.uid()));
-- Students may only mark work as pending or in progress. 'completed' means submitted and is
-- set only by submit_assignment(); once set, the student cannot change it back.
-- (Migration "progress_only_by_submission".)
create policy progress_insert on public.assignment_progress for insert to authenticated with check (
  student_id = (select auth.uid())
  and status in ('pending', 'in_progress')
  and exists (select 1 from public.assignments a where a.id = assignment_id and public.is_enrolled_in(a.course_id))
);
create policy progress_update on public.assignment_progress for update to authenticated
  using (student_id = (select auth.uid()) and status <> 'completed')
  with check (
    student_id = (select auth.uid())
    and status in ('pending', 'in_progress')
    and exists (select 1 from public.assignments a where a.id = assignment_id and public.is_enrolled_in(a.course_id))
  );
revoke delete on public.assignment_progress from authenticated;

-- notifications: the recipient reads and marks as read. Created only by database functions.
create policy notifications_select on public.notifications for select to authenticated using (recipient_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (recipient_id = (select auth.uid())) with check (recipient_id = (select auth.uid()));
revoke insert, update, delete on public.notifications from authenticated;
grant update (is_read) on public.notifications to authenticated;

-- ---------- RPC: enroll by code ----------

create or replace function public.enroll_by_code(p_code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_course uuid;
begin
  if not exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'student') then
    raise exception 'Only students can enroll in courses';
  end if;

  select id into v_course from public.courses
  where enrollment_code = upper(trim(p_code)) and not archived;
  if v_course is null then
    raise exception 'That enrollment code was not found. Check it with your instructor.';
  end if;

  insert into public.enrollments (student_id, course_id) values ((select auth.uid()), v_course)
  on conflict (student_id, course_id) do nothing;
  return v_course;
end $$;

-- ---------- RPC: change deadline (one transaction) ----------
-- Updates the assignment, appends the history row, and notifies every enrolled student.
-- p_expected_previous guards against double-submits and concurrent edits.

create or replace function public.change_deadline(
  p_assignment uuid,
  p_new_deadline timestamptz,
  p_expected_previous timestamptz,
  p_reason text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_course uuid;
  v_title text;
  v_current timestamptz;
  v_change uuid;
begin
  select a.course_id, a.title, a.current_deadline
    into v_course, v_title, v_current
  from public.assignments a where a.id = p_assignment
  for update;

  if v_course is null then
    raise exception 'Assignment not found';
  end if;
  if not public.is_instructor_of(v_course) then
    raise exception 'Only the course instructor can change a deadline';
  end if;
  if v_current <> p_expected_previous then
    raise exception 'The deadline was changed by someone else. Reload and try again.';
  end if;
  if p_new_deadline = v_current then
    raise exception 'The new deadline is the same as the current one';
  end if;
  if p_new_deadline <= now() then
    raise exception 'The new deadline must be in the future';
  end if;

  update public.assignments set current_deadline = p_new_deadline where id = p_assignment;

  insert into public.deadline_changes (assignment_id, previous_deadline, new_deadline, changed_by, reason)
  values (p_assignment, v_current, p_new_deadline, (select auth.uid()), nullif(trim(p_reason), ''))
  returning id into v_change;

  insert into public.notifications (recipient_id, assignment_id, deadline_change_id, type, message)
  select e.student_id, p_assignment, v_change, 'deadline_changed', 'Deadline changed: ' || v_title
  from public.enrollments e where e.course_id = v_course;

  -- A reminder sent for the old date no longer applies.
  delete from public.notifications
  where assignment_id = p_assignment and type = 'reminder';

  return v_change;
end $$;

-- ---------- Notifications for newly published assignments ----------

create or replace function public.notify_new_assignment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (recipient_id, assignment_id, type, message)
  select e.student_id, new.id, 'new_assignment', 'New assignment published: ' || new.title
  from public.enrollments e where e.course_id = new.course_id;
  return new;
end $$;

create trigger on_assignment_published
  after insert on public.assignments
  for each row execute function public.notify_new_assignment();

-- ---------- RPC: in-app reminders (FR-12) ----------
-- Called by the app when a student opens it. Creates one reminder per assignment that is
-- due within the next 48 hours and not marked completed. Safe to call repeatedly.

create or replace function public.generate_my_reminders()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  insert into public.notifications (recipient_id, assignment_id, type, message)
  select (select auth.uid()), a.id, 'reminder', 'Reminder: ' || a.title || ' is due within 2 days'
  from public.assignments a
  join public.enrollments e on e.course_id = a.course_id and e.student_id = (select auth.uid())
  join public.courses c on c.id = a.course_id and not c.archived
  left join public.assignment_progress p on p.assignment_id = a.id and p.student_id = (select auth.uid())
  where a.current_deadline > now()
    and a.current_deadline <= now() + interval '48 hours'
    and coalesce(p.status, 'pending') <> 'completed'
  on conflict (recipient_id, assignment_id) where type = 'reminder' do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- ---------- Admin: verify instructors ----------

create or replace function public.set_instructor_status(p_user uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can verify instructors';
  end if;
  if p_status not in ('active', 'pending', 'rejected') then
    raise exception 'Unknown status %', p_status;
  end if;
  update public.profiles set status = p_status where id = p_user and role = 'instructor';
  if not found then
    raise exception 'That user is not an instructor';
  end if;
end $$;

-- ---------- Admin: dashboard figures ----------
-- One call returns every count the admin dashboard shows, plus a per-course summary.

create or replace function public.admin_stats()
returns json language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can see platform statistics';
  end if;
  return json_build_object(
    'students', (select count(*) from public.profiles where role = 'student'),
    'instructors', (select count(*) from public.profiles where role = 'instructor' and status = 'active'),
    'pending', (select count(*) from public.profiles where role = 'instructor' and status = 'pending'),
    'rejected', (select count(*) from public.profiles where role = 'instructor' and status = 'rejected'),
    'courses', (select count(*) from public.courses where not archived),
    'archived_courses', (select count(*) from public.courses where archived),
    'assignments', (select count(*) from public.assignments),
    'upcoming', (select count(*) from public.assignments where current_deadline > now()),
    'enrollments', (select count(*) from public.enrollments),
    'deadline_changes', (select count(*) from public.deadline_changes),
    'new_users_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'completed', (select count(*) from public.assignment_progress where status = 'completed'),
    'course_list', coalesce((
      select json_agg(row_to_json(t) order by t.students desc, t.name)
      from (
        select c.id, c.name, c.course_code, c.archived, p.full_name as instructor,
          (select count(*) from public.enrollments e where e.course_id = c.id) as students,
          (select count(*) from public.assignments a where a.course_id = c.id) as assignments
        from public.courses c join public.profiles p on p.id = c.instructor_id
      ) t
    ), '[]'::json)
  );
end $$;

-- ---------- Function permissions ----------
-- Only signed-in users may call the RPCs; trigger functions are not callable directly.

revoke execute on all functions in schema public from public, anon;
-- Supabase grants EXECUTE to authenticated on new functions by default.
revoke execute on function public.handle_new_user() from authenticated;
revoke execute on function public.notify_new_assignment() from authenticated;
grant execute on function public.enroll_by_code(text) to authenticated;
grant execute on function public.change_deadline(uuid, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.generate_my_reminders() to authenticated;
grant execute on function public.is_instructor_of(uuid) to authenticated;
grant execute on function public.is_enrolled_in(uuid) to authenticated;
grant execute on function public.is_instructor() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.set_instructor_status(uuid, text) to authenticated;
grant execute on function public.admin_stats() to authenticated;

-- ========== Submissions and grading (migration "submissions_and_grading") ==========

-- ---------- Submission rules on each assignment ----------

alter table public.assignments
  add column total_marks integer not null default 100 check (total_marks between 1 and 1000),
  add column submission_type text not null default 'file'
    check (submission_type in ('file', 'link', 'file_and_link')),
  -- Lower-case file extensions a student may upload. Empty means any type.
  add column allowed_extensions text[] not null default '{}',
  add column max_file_mb integer not null default 20 check (max_file_mb between 1 and 50),
  add column max_files integer not null default 5 check (max_files between 1 and 20),
  add column summary_required boolean not null default false,
  add column allow_late boolean not null default true;

grant update (total_marks, submission_type, allowed_extensions, max_file_mb, max_files, summary_required, allow_late)
  on public.assignments to authenticated;

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('deadline_changed', 'reminder', 'new_assignment', 'submission_received', 'graded'));

-- ---------- Tables ----------

-- Reference material the instructor attaches (brief, starter code, images).
create table public.assignment_files (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  path text not null unique,
  name text not null,
  size bigint not null,
  uploaded_at timestamptz not null default now()
);

-- One row per attempt; earlier attempts are kept as versions. Written only by submit_assignment().
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  attempt integer not null check (attempt > 0),
  summary text not null default '',
  link text,
  is_late boolean not null,
  submitted_at timestamptz not null default now(),
  unique (assignment_id, student_id, attempt)
);

create table public.submission_files (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  path text not null unique,
  name text not null,
  size bigint not null
);

-- One grade per student per assignment. Students only see it once it is returned.
create table public.grades (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  submission_id uuid references public.submissions(id) on delete set null,
  marks numeric(7, 2) not null check (marks >= 0),
  feedback text not null default '',
  graded_by uuid not null references public.profiles(id),
  graded_at timestamptz not null default now(),
  returned_at timestamptz,
  unique (assignment_id, student_id)
);

create index on public.assignment_files (assignment_id);
create index on public.submissions (student_id);
create index on public.submission_files (submission_id);
create index on public.grades (student_id);
create index on public.grades (submission_id);
create index on public.grades (graded_by);

-- ---------- Row-level security ----------

alter table public.assignment_files enable row level security;
alter table public.submissions enable row level security;
alter table public.submission_files enable row level security;
alter table public.grades enable row level security;
revoke all on public.assignment_files, public.submissions, public.submission_files, public.grades from anon;

create policy assignment_files_select on public.assignment_files for select to authenticated using (
  exists (select 1 from public.assignments a where a.id = assignment_id
          and (public.is_instructor_of(a.course_id) or public.is_enrolled_in(a.course_id) or public.is_admin()))
);
create policy assignment_files_insert on public.assignment_files for insert to authenticated with check (
  path like assignment_id::text || '/%'
  and exists (select 1 from public.assignments a where a.id = assignment_id and public.is_instructor_of(a.course_id))
);
create policy assignment_files_delete on public.assignment_files for delete to authenticated using (
  exists (select 1 from public.assignments a where a.id = assignment_id and public.is_instructor_of(a.course_id))
);
revoke update on public.assignment_files from authenticated;

create policy submissions_select on public.submissions for select to authenticated using (
  student_id = (select auth.uid())
  or public.is_admin()
  or exists (select 1 from public.assignments a where a.id = assignment_id and public.is_instructor_of(a.course_id))
);
revoke insert, update, delete on public.submissions from authenticated;

-- Visible exactly when the parent submission is visible (its own RLS applies in the subquery).
create policy submission_files_select on public.submission_files for select to authenticated using (
  exists (select 1 from public.submissions s where s.id = submission_id)
);
revoke insert, update, delete on public.submission_files from authenticated;

create policy grades_select on public.grades for select to authenticated using (
  (student_id = (select auth.uid()) and returned_at is not null)
  or public.is_admin()
  or exists (select 1 from public.assignments a where a.id = assignment_id and public.is_instructor_of(a.course_id))
);
revoke insert, update, delete on public.grades from authenticated;

-- ---------- File storage ----------
-- assignment-files/<assignment id>/<file>
-- submissions/<assignment id>/<student id>/<upload id>/<file>

insert into storage.buckets (id, name, public, file_size_limit)
values ('assignment-files', 'assignment-files', false, 52428800),
       ('submissions', 'submissions', false, 52428800)
on conflict (id) do nothing;

create policy "assignment files: course members read" on storage.objects for select to authenticated using (
  bucket_id = 'assignment-files'
  and exists (select 1 from public.assignments a where a.id::text = (storage.foldername(objects.name))[1]
              and (public.is_instructor_of(a.course_id) or public.is_enrolled_in(a.course_id) or public.is_admin()))
);
create policy "assignment files: instructor uploads" on storage.objects for insert to authenticated with check (
  bucket_id = 'assignment-files'
  and exists (select 1 from public.assignments a where a.id::text = (storage.foldername(objects.name))[1]
              and public.is_instructor_of(a.course_id))
);
create policy "assignment files: instructor removes" on storage.objects for delete to authenticated using (
  bucket_id = 'assignment-files'
  and exists (select 1 from public.assignments a where a.id::text = (storage.foldername(objects.name))[1]
              and public.is_instructor_of(a.course_id))
);

create policy "submissions: owner, instructor and admin read" on storage.objects for select to authenticated using (
  bucket_id = 'submissions'
  and (
    (storage.foldername(objects.name))[2] = (select auth.uid())::text
    or public.is_admin()
    or exists (select 1 from public.assignments a where a.id::text = (storage.foldername(objects.name))[1]
               and public.is_instructor_of(a.course_id))
  )
);
-- Students can never update or delete an upload, so earlier versions cannot be altered.
create policy "submissions: enrolled student uploads own" on storage.objects for insert to authenticated with check (
  bucket_id = 'submissions'
  and (storage.foldername(objects.name))[2] = (select auth.uid())::text
  and exists (select 1 from public.assignments a where a.id::text = (storage.foldername(objects.name))[1]
              and public.is_enrolled_in(a.course_id))
);

-- Migration "storage_cleanup_policies". Supabase forbids deleting storage rows with SQL, so files
-- must be removed through the Storage API before their assignment is deleted.
create policy "submissions: instructor removes" on storage.objects for delete to authenticated using (
  bucket_id = 'submissions'
  and exists (select 1 from public.assignments a where a.id::text = (storage.foldername(objects.name))[1]
              and public.is_instructor_of(a.course_id))
);
create policy "files: admin removes" on storage.objects for delete to authenticated using (
  bucket_id in ('assignment-files', 'submissions') and public.is_admin()
);
create policy "files: admin lists" on storage.objects for select to authenticated using (
  bucket_id in ('assignment-files', 'submissions') and public.is_admin()
);

-- ---------- RPC: submit an assignment ----------
-- Checks every rule on the server: enrolment, late policy, resubmission window,
-- required summary or link, file count, size (read from storage) and type.
-- p_files: [{"path": "...", "name": "..."}] for files already uploaded to the submissions bucket.

create or replace function public.submit_assignment(
  p_assignment uuid,
  p_summary text,
  p_link text,
  p_files jsonb default '[]'
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := (select auth.uid());
  v_a public.assignments%rowtype;
  v_late boolean;
  v_attempt integer;
  v_sub uuid;
  v_file jsonb;
  v_path text;
  v_name text;
  v_ext text;
  v_size bigint;
  v_files jsonb := coalesce(p_files, '[]'::jsonb);
  v_count integer;
  v_link text := nullif(trim(coalesce(p_link, '')), '');
  v_summary text := trim(coalesce(p_summary, ''));
begin
  select * into v_a from public.assignments where id = p_assignment;
  if v_a.id is null then
    raise exception 'Assignment not found';
  end if;
  if not public.is_enrolled_in(v_a.course_id) then
    raise exception 'You are not enrolled in this course';
  end if;
  if exists (select 1 from public.courses where id = v_a.course_id and archived) then
    raise exception 'This course is archived';
  end if;
  if exists (select 1 from public.grades where assignment_id = v_a.id and student_id = v_me and returned_at is not null) then
    raise exception 'This assignment has already been graded';
  end if;

  v_late := now() > v_a.current_deadline;
  if v_late then
    if not v_a.allow_late then
      raise exception 'The deadline has passed and this assignment does not accept late work';
    end if;
    if exists (select 1 from public.submissions where assignment_id = v_a.id and student_id = v_me) then
      raise exception 'The deadline has passed, so you can no longer resubmit';
    end if;
  end if;

  if jsonb_typeof(v_files) <> 'array' then
    raise exception 'Invalid file list';
  end if;
  v_count := jsonb_array_length(v_files);

  if v_a.summary_required and v_summary = '' then
    raise exception 'A summary is required for this assignment';
  end if;
  if v_a.submission_type in ('link', 'file_and_link') and v_link is null then
    raise exception 'A link is required for this assignment';
  end if;
  if v_link is not null and v_link !~* '^https?://[^\s]+$' then
    raise exception 'The link must start with http:// or https://';
  end if;
  if v_a.submission_type = 'link' and v_count > 0 then
    raise exception 'This assignment takes a link, not files';
  end if;
  if v_a.submission_type in ('file', 'file_and_link') and v_count = 0 then
    raise exception 'Attach at least one file';
  end if;
  if v_count > v_a.max_files then
    raise exception 'You can attach at most % files', v_a.max_files;
  end if;

  select coalesce(max(attempt), 0) + 1 into v_attempt
  from public.submissions where assignment_id = v_a.id and student_id = v_me;

  insert into public.submissions (assignment_id, student_id, attempt, summary, link, is_late)
  values (v_a.id, v_me, v_attempt, v_summary, v_link, v_late)
  returning id into v_sub;

  for v_file in select value from jsonb_array_elements(v_files) loop
    v_path := v_file ->> 'path';
    v_name := coalesce(nullif(trim(v_file ->> 'name'), ''), regexp_replace(coalesce(v_path, ''), '^.*/', ''));
    if v_path is null or v_path not like v_a.id::text || '/' || v_me::text || '/%' then
      raise exception 'Invalid file reference';
    end if;
    select (o.metadata ->> 'size')::bigint into v_size
    from storage.objects o where o.bucket_id = 'submissions' and o.name = v_path;
    if v_size is null then
      raise exception '% was not uploaded. Try again.', v_name;
    end if;
    if v_size > v_a.max_file_mb::bigint * 1048576 then
      raise exception '% is larger than % MB', v_name, v_a.max_file_mb;
    end if;
    v_ext := lower(substring(v_path from '\.([A-Za-z0-9]+)$'));
    if cardinality(v_a.allowed_extensions) > 0 and (v_ext is null or not v_ext = any (v_a.allowed_extensions)) then
      raise exception '% is not an accepted file type', v_name;
    end if;
    insert into public.submission_files (submission_id, path, name, size) values (v_sub, v_path, v_name, v_size);
  end loop;

  insert into public.assignment_progress (student_id, assignment_id, status, updated_at)
  values (v_me, v_a.id, 'completed', now())
  on conflict (student_id, assignment_id) do update set status = 'completed', updated_at = now();

  insert into public.notifications (recipient_id, assignment_id, type, message)
  values (
    v_me, v_a.id, 'submission_received',
    case when v_late then 'Submitted late: ' else 'Submitted: ' end || v_a.title
      || case when v_attempt > 1 then ' (attempt ' || v_attempt || ')' else '' end
  );

  return v_sub;
end $$;

-- ---------- RPC: grade a student's work ----------
-- Saves marks and feedback for the latest attempt. p_return = true releases it to the student
-- and notifies them; saving without returning keeps it private to the instructor.

create or replace function public.grade_submission(
  p_assignment uuid,
  p_student uuid,
  p_marks numeric,
  p_feedback text,
  p_return boolean
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_a public.assignments%rowtype;
  v_sub uuid;
  v_prev timestamptz;
begin
  select * into v_a from public.assignments where id = p_assignment;
  if v_a.id is null then
    raise exception 'Assignment not found';
  end if;
  if not public.is_instructor_of(v_a.course_id) then
    raise exception 'Only the course instructor can grade this assignment';
  end if;
  if not exists (select 1 from public.enrollments where course_id = v_a.course_id and student_id = p_student) then
    raise exception 'That student is not enrolled in this course';
  end if;
  if p_marks is null or p_marks < 0 or p_marks > v_a.total_marks then
    raise exception 'Marks must be between 0 and %', v_a.total_marks;
  end if;

  select id into v_sub from public.submissions
  where assignment_id = v_a.id and student_id = p_student order by attempt desc limit 1;
  select returned_at into v_prev from public.grades where assignment_id = v_a.id and student_id = p_student;

  insert into public.grades as g (assignment_id, student_id, submission_id, marks, feedback, graded_by, returned_at)
  values (v_a.id, p_student, v_sub, p_marks, trim(coalesce(p_feedback, '')), (select auth.uid()),
          case when p_return then now() end)
  on conflict (assignment_id, student_id) do update set
    submission_id = excluded.submission_id,
    marks = excluded.marks,
    feedback = excluded.feedback,
    graded_by = excluded.graded_by,
    graded_at = now(),
    returned_at = case when p_return then now() else g.returned_at end;

  if p_return then
    insert into public.notifications (recipient_id, assignment_id, type, message)
    values (
      p_student, v_a.id, 'graded',
      case when v_prev is null then 'Graded: ' else 'Grade updated: ' end || v_a.title
        || ' (' || trim(to_char(p_marks, 'FM999990.##'), '.') || '/' || v_a.total_marks || ')'
    );
  end if;
end $$;

revoke execute on function public.submit_assignment(uuid, text, text, jsonb) from public, anon;
revoke execute on function public.grade_submission(uuid, uuid, numeric, text, boolean) from public, anon;
grant execute on function public.submit_assignment(uuid, text, text, jsonb) to authenticated;
grant execute on function public.grade_submission(uuid, uuid, numeric, text, boolean) to authenticated;
