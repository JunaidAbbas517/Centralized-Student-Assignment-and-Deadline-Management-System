-- Sample data matching demo mode (app/src/lib/demoSeed.ts), for testing the live app.
-- Run once in the SQL editor after schema.sql. It stops if the sample courses already exist.
-- Every account below has the password Test@123. Dates are relative to today (UTC+8).

create or replace function pg_temp.seed_day(p_off int, p_h int default 23, p_m int default 59)
returns timestamptz language sql as $$
  select (((now() at time zone 'Asia/Shanghai')::date + p_off)::timestamp + make_time(p_h, p_m, 0)) at time zone 'Asia/Shanghai'
$$;

-- Creates a confirmed email/password account (or reuses an existing one) and sets its profile.
create or replace function pg_temp.seed_user(p_email text, p_name text, p_role text, p_status text)
returns uuid language plpgsql as $$
declare
  v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = p_email;
  if v_id is null then
    v_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', p_email,
      extensions.crypt('Test@123', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', p_name), now(), now(),
      '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_id, v_id::text,
            jsonb_build_object('sub', v_id::text, 'email', p_email, 'email_verified', true), 'email', now(), now(), now());
  end if;
  update public.profiles set full_name = p_name, role = p_role, status = p_status where id = v_id;
  return v_id;
end $$;

do $$
declare
  v_inst uuid;
  v_stu uuid;
  v_stu2 uuid;
  v_c1 uuid;
  v_c2 uuid;
  v_c3 uuid;
  v_change uuid;
  r record;
  v_at timestamptz;
  v_sub uuid;
begin
  if exists (select 1 from public.courses where course_code in ('CS510', 'CS520', 'CS530')) then
    raise notice 'Sample courses already exist; nothing to do.';
    return;
  end if;

  perform pg_temp.seed_user('admin@gmail.com', 'Site Admin', 'admin', 'active');
  v_inst := pg_temp.seed_user('teacher@gmail.com', 'Dr. Wang Lin', 'instructor', 'active');
  v_stu := pg_temp.seed_user('student@gmail.com', 'Alex Chen', 'student', 'active');
  v_stu2 := pg_temp.seed_user('chen@demo.edu', 'Chen Mei', 'student', 'active');
  perform pg_temp.seed_user('sara@demo.edu', 'Prof. Sara Malik', 'instructor', 'pending');
  perform pg_temp.seed_user('lihua@demo.edu', 'Li Hua', 'instructor', 'pending');

  insert into public.courses (instructor_id, name, course_code, enrollment_code, created_at)
  values (v_inst, 'Machine Learning', 'CS510', 'ML510ABC', pg_temp.seed_day(-60)) returning id into v_c1;
  insert into public.courses (instructor_id, name, course_code, enrollment_code, created_at)
  values (v_inst, 'Intelligent Software Engineering', 'CS520', 'ISE520XY', pg_temp.seed_day(-59)) returning id into v_c2;
  insert into public.courses (instructor_id, name, course_code, enrollment_code, created_at)
  values (v_inst, 'Medical Image Analysis', 'CS530', 'MIA530QR', pg_temp.seed_day(-58)) returning id into v_c3;

  create temp table seed_a on commit drop as
  select gen_random_uuid() as id, x.*
  from (values
    ('m1', 1, 'Lab 1: Linear regression', -35, 23, 59, ''),
    ('m2', 1, 'Lab 2: Logistic regression', -25, 23, 59, ''),
    ('m3', 1, 'Quiz 3: Neural networks', -14, 23, 59, ''),
    ('m4', 1, 'Lab 3: Convolutional networks', -1, 23, 59, 'Train a small CNN on CIFAR-10 and report accuracy and loss curves.'),
    ('m5', 1, 'Quiz 4: Optimization', 3, 10, 0, 'Gradient descent variants, momentum, and Adam.'),
    ('m6', 1, 'Project proposal', 17, 23, 59, 'One-page proposal with dataset and evaluation plan.'),
    ('m7', 1, 'Lab 4: RNNs', 24, 23, 59, ''),
    ('s1', 2, 'Project charter', -33, 23, 59, ''),
    ('s2', 2, 'Use case diagrams', -26, 23, 59, ''),
    ('s3', 2, 'Sprint 1 demo', -18, 23, 59, ''),
    ('s4', 2, 'Reading summary', -9, 23, 59, ''),
    ('s5', 2, 'Requirements specification', 2, 23, 59, 'Write an SRS for your project, including use cases and functional requirements.'),
    ('s6', 2, 'Sprint 2 demo slides', 15, 14, 0, ''),
    ('i1', 3, 'Reading summary: U-Net', -30, 23, 59, ''),
    ('i2', 3, 'Dataset exploration', -12, 23, 59, ''),
    ('i3', 3, 'Segmentation Report', 13, 23, 59, 'Train a segmentation model on the course dataset and submit a written report of the method and results.'),
    ('i4', 3, 'Paper review', 21, 23, 59, '')
  ) as x(key, course, title, off, h, m, descr);

  -- Assignments go in before enrollments so the new-assignment trigger sends no notifications.
  insert into public.assignments (id, course_id, title, description, current_deadline, created_at, allowed_extensions)
  select a.id, case a.course when 1 then v_c1 when 2 then v_c2 else v_c3 end, a.title, a.descr,
         pg_temp.seed_day(a.off, a.h, a.m), pg_temp.seed_day(-40, 9, 5), '{pdf,zip}'
  from seed_a a;

  insert into public.enrollments (student_id, course_id)
  values (v_stu, v_c1), (v_stu, v_c2), (v_stu, v_c3), (v_stu2, v_c1);

  -- Segmentation Report was moved from +9 to +13 days.
  insert into public.deadline_changes (assignment_id, previous_deadline, new_deadline, changed_by, reason, changed_at)
  select id, pg_temp.seed_day(9), pg_temp.seed_day(13), v_inst, 'Extended because access to the dataset was delayed.', now() - interval '3 hours'
  from seed_a where key = 'i3'
  returning id into v_change;

  -- Handed-in work: [student, assignment, days before the deadline, returned marks or null, summary, link, feedback]
  for r in
    select * from (values
      (v_stu, 'm1', 1, 92, '', null, 'Good work.'),
      (v_stu, 'm2', 2, 78, '', null, 'Good work.'),
      (v_stu, 'm3', 1, 86, 'Answers to all five questions, with derivations for Q3.', null, 'Clear derivations. Revisit the vanishing-gradient question.'),
      (v_stu, 's1', 0, 88, '', null, 'Good work.'),
      (v_stu, 's2', -1, 70, '', null, 'Late, but well structured.'),
      (v_stu, 's3', 1, null, '', null, null),
      (v_stu, 's4', 2, null, 'Summary of chapters 3 and 4.', 'https://docs.example.com/reading-summary', null),
      (v_stu, 'i1', 3, 95, '', null, 'Excellent summary.'),
      (v_stu2, 'm3', 2, 74, 'All questions attempted.', null, 'Check your answer to Q4.'),
      (v_stu2, 'm4', 2, null, 'CNN trained for 20 epochs; curves in the PDF.', null, null)
    ) as h(student, key, days_before, marks, summary, link, feedback)
  loop
    select a.current_deadline - make_interval(days => r.days_before) - interval '3 hours' into v_at
    from public.assignments a join seed_a s on s.id = a.id where s.key = r.key;

    insert into public.submissions (assignment_id, student_id, attempt, summary, link, is_late, submitted_at)
    select id, r.student, 1, r.summary, r.link, r.days_before < 0, v_at from seed_a where key = r.key
    returning id into v_sub;

    insert into public.assignment_progress (student_id, assignment_id, status)
    select r.student, id, 'completed' from seed_a where key = r.key;

    if r.marks is not null then
      insert into public.grades (assignment_id, student_id, submission_id, marks, feedback, graded_by, graded_at, returned_at)
      select id, r.student, v_sub, r.marks, r.feedback, v_inst, v_at + interval '3 days', v_at + interval '3 days'
      from seed_a where key = r.key;
    end if;
  end loop;

  insert into public.assignment_progress (student_id, assignment_id, status)
  select v_stu, id, 'in_progress' from seed_a where key in ('s5', 'm6');

  insert into public.notifications (recipient_id, assignment_id, deadline_change_id, type, message, is_read, created_at)
  select v_stu, id, v_change, 'deadline_changed', 'Deadline changed: Segmentation Report', false, now() - interval '3 hours' from seed_a where key = 'i3'
  union all
  select v_stu, id, null, 'reminder', 'Reminder: Requirements specification is due within 2 days', false, now() - interval '1 hour' from seed_a where key = 's5'
  union all
  select v_stu, id, null, 'new_assignment', 'New assignment published: Quiz 4: Optimization', true, now() - interval '1 day' from seed_a where key = 'm5'
  union all
  select v_stu, id, null, 'graded', 'Graded: Quiz 3: Neural networks (86/100)', true, now() - interval '10 days' from seed_a where key = 'm3';
end $$;
