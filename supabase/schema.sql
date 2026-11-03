-- Student Assignment and Deadline Management System
-- Run this once in the Supabase SQL editor.

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
  name text not null,
  course_code text not null,
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
  title text not null,
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

create index on public.enrollments (course_id);
create index on public.assignments (course_id);
create index on public.deadline_changes (assignment_id);
create index on public.notifications (recipient_id, created_at desc);

-- ---------- Profile creation on sign-up ----------
-- Role is ALWAYS 'student' here. Promote instructors manually:
--   update public.profiles set role = 'instructor' where email = 'someone@uni.edu';

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
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
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from courses where id = p_course and instructor_id = auth.uid());
$$;

create or replace function public.is_enrolled_in(p_course uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from enrollments where course_id = p_course and student_id = auth.uid());
$$;

-- ---------- Row-level security ----------

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.enrollments enable row level security;
alter table public.assignments enable row level security;
alter table public.deadline_changes enable row level security;
alter table public.assignment_progress enable row level security;
alter table public.notifications enable row level security;

-- profiles: see yourself, plus students enrolled in your courses (instructors) / your instructors (students)
create policy profiles_select on public.profiles for select using (
  id = auth.uid()
  or exists (select 1 from enrollments e join courses c on c.id = e.course_id
             where e.student_id = profiles.id and c.instructor_id = auth.uid())
  or exists (select 1 from courses c join enrollments e on e.course_id = c.id
             where c.instructor_id = profiles.id and e.student_id = auth.uid())
);
create policy profiles_update on public.profiles for update using (id = auth.uid());
-- Users may only edit their name; role/email can never be changed from the client.
revoke update on public.profiles from authenticated, anon;
grant update (full_name) on public.profiles to authenticated;

-- courses
create policy courses_select on public.courses for select using (
  instructor_id = auth.uid() or public.is_enrolled_in(id)
);
create policy courses_insert on public.courses for insert with check (
  instructor_id = auth.uid()
  and exists (select 1 from profiles where id = auth.uid() and role = 'instructor')
);
create policy courses_update on public.courses for update using (instructor_id = auth.uid());
create policy courses_delete on public.courses for delete using (instructor_id = auth.uid());

-- enrollments: students see their own, instructors see their course's. Inserts only via enroll_by_code().
create policy enrollments_select on public.enrollments for select using (
  student_id = auth.uid() or public.is_instructor_of(course_id)
);
create policy enrollments_delete on public.enrollments for delete using (student_id = auth.uid());

-- assignments: members read, instructor writes.
-- current_deadline can NOT be updated directly; only change_deadline() may do it.
create policy assignments_select on public.assignments for select using (
  public.is_instructor_of(course_id) or public.is_enrolled_in(course_id)
);
create policy assignments_insert on public.assignments for insert with check (public.is_instructor_of(course_id));
create policy assignments_update on public.assignments for update using (public.is_instructor_of(course_id));
create policy assignments_delete on public.assignments for delete using (public.is_instructor_of(course_id));
revoke update on public.assignments from authenticated, anon;
grant update (title, description) on public.assignments to authenticated;

-- deadline_changes: read-only for members; written only by change_deadline()
create policy deadline_changes_select on public.deadline_changes for select using (
  exists (select 1 from assignments a where a.id = assignment_id
          and (public.is_instructor_of(a.course_id) or public.is_enrolled_in(a.course_id)))
);

-- assignment_progress: strictly your own rows, and only for assignments in courses you're enrolled in
create policy progress_select on public.assignment_progress for select using (student_id = auth.uid());
create policy progress_insert on public.assignment_progress for insert with check (
  student_id = auth.uid()
  and exists (select 1 from assignments a where a.id = assignment_id and public.is_enrolled_in(a.course_id))
);
create policy progress_update on public.assignment_progress for update using (student_id = auth.uid());

-- notifications: recipient reads and marks as read. Inserts only via change_deadline().
create policy notifications_select on public.notifications for select using (recipient_id = auth.uid());
create policy notifications_update on public.notifications for update using (recipient_id = auth.uid());
revoke update on public.notifications from authenticated, anon;
grant update (is_read) on public.notifications to authenticated;

-- ---------- RPC: enroll by code ----------

create or replace function public.enroll_by_code(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_course uuid;
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'student') then
    raise exception 'Only students can enroll in courses';
  end if;

  select id into v_course from courses
  where enrollment_code = upper(trim(p_code)) and not archived;
  if v_course is null then
    raise exception 'Invalid enrollment code';
  end if;

  insert into enrollments (student_id, course_id) values (auth.uid(), v_course)
  on conflict (student_id, course_id) do nothing;
  return v_course;
end $$;

-- ---------- RPC: change deadline (steps 4-6 of the workflow, one transaction) ----------
-- p_expected_previous guards against double-submits and concurrent edits.

create or replace function public.change_deadline(
  p_assignment uuid,
  p_new_deadline timestamptz,
  p_expected_previous timestamptz,
  p_reason text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_course uuid;
  v_title text;
  v_current timestamptz;
  v_change uuid;
begin
  select a.course_id, a.title, a.current_deadline
    into v_course, v_title, v_current
  from assignments a where a.id = p_assignment
  for update;

  if v_course is null then
    raise exception 'Assignment not found';
  end if;
  if not public.is_instructor_of(v_course) then
    raise exception 'Only the course instructor can change a deadline';
  end if;
  if v_current <> p_expected_previous then
    raise exception 'The deadline was changed by someone else; reload and try again';
  end if;
  if p_new_deadline = v_current then
    raise exception 'The new deadline is the same as the current one';
  end if;
  if p_new_deadline <= now() then
    raise exception 'The new deadline must be in the future';
  end if;

  update assignments set current_deadline = p_new_deadline where id = p_assignment;

  insert into deadline_changes (assignment_id, previous_deadline, new_deadline, changed_by, reason)
  values (p_assignment, v_current, p_new_deadline, auth.uid(), nullif(trim(p_reason), ''))
  returning id into v_change;

  insert into notifications (recipient_id, assignment_id, deadline_change_id, type, message)
  select e.student_id, p_assignment, v_change, 'deadline_changed',
         'Deadline for "' || v_title || '" changed to ' ||
         to_char(p_new_deadline at time zone 'UTC', 'YYYY-MM-DD HH24:MI') || ' UTC'
  from enrollments e where e.course_id = v_course;

  return v_change;
end $$;

grant execute on function public.enroll_by_code(text) to authenticated;
grant execute on function public.change_deadline(uuid, timestamptz, timestamptz, text) to authenticated;
revoke execute on function public.enroll_by_code(text) from anon;
revoke execute on function public.change_deadline(uuid, timestamptz, timestamptz, text) from anon;
