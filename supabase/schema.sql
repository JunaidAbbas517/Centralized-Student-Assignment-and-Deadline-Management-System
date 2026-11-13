-- Student Assignment and Deadline Management System
-- Full database schema. Applied to the Supabase project as migration "initial_schema".
-- To recreate from scratch, run this once in the Supabase SQL editor.

-- ---------- Tables ----------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  role text not null default 'student' check (role in ('student', 'instructor')),
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

-- ---------- Profile creation on sign-up ----------
-- Role is ALWAYS 'student' here. Instructors are promoted by the maintainer:
--   update public.profiles set role = 'instructor' where email = 'teacher@university.edu';

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), coalesce(new.email, ''));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Helper functions (used by RLS) ----------

create or replace function public.is_instructor_of(p_course uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.courses where id = p_course and instructor_id = (select auth.uid()));
$$;

create or replace function public.is_enrolled_in(p_course uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.enrollments where course_id = p_course and student_id = (select auth.uid()));
$$;

create or replace function public.is_instructor()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'instructor');
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
create policy progress_insert on public.assignment_progress for insert to authenticated with check (
  student_id = (select auth.uid())
  and exists (select 1 from public.assignments a where a.id = assignment_id and public.is_enrolled_in(a.course_id))
);
create policy progress_update on public.assignment_progress for update to authenticated
  using (student_id = (select auth.uid()))
  with check (
    student_id = (select auth.uid())
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

-- ---------- Function permissions ----------
-- Only signed-in users may call the RPCs; trigger functions are not callable directly.

revoke execute on all functions in schema public from public, anon;
grant execute on function public.enroll_by_code(text) to authenticated;
grant execute on function public.change_deadline(uuid, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.generate_my_reminders() to authenticated;
grant execute on function public.is_instructor_of(uuid) to authenticated;
grant execute on function public.is_enrolled_in(uuid) to authenticated;
grant execute on function public.is_instructor() to authenticated;
