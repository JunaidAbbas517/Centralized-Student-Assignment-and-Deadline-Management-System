# Student Assignment and Deadline Management System

React + TypeScript + Vite frontend, Supabase (Auth + PostgreSQL + RLS) backend, deployed on GitHub Pages.

## Setup

1. Create a free project at supabase.com.
2. In the SQL editor, run [supabase/schema.sql](supabase/schema.sql) once.
3. Copy `app/.env.example` to `app/.env` and fill in the project URL and **anon** key
   (Project Settings → API). Never put the `service_role` key in the frontend.
4. Under Authentication → URL Configuration, set the **Site URL** to the deployed app
   (e.g. `https://<user>.github.io/<repo>/`) and add both of these to **Redirect URLs**:
   `http://localhost:5173/**` and `https://<user>.github.io/<repo>/**`.
   Confirmation and password-reset emails link back here.
5. For quick testing, turn off "Confirm email" under Authentication → Providers → Email
   (the default mail sender is heavily rate-limited).
6. Run:
   ```
   cd app
   npm install
   npm run dev
   npm test
   ```

## Authentication

- Email and password sign-up and log-in via Supabase Auth (PKCE flow, so email links use
  `?code=` and do not clash with the `#/` routes).
- "Forgot password?" emails a reset link; opening it shows a set-new-password screen.
- The Account page (click your name in the sidebar) edits your display name and password.
- Open email links in the same browser you requested them from (PKCE requirement).
- Notifications: deadline changes and new assignments notify enrolled students automatically;
  reminders for open work due within 48 hours are created when a student opens the app.

## Roles: student, instructor, admin

- **Students** sign up and can use the app straight away.
- **Instructors** sign up with "I am: Instructor". The account is *pending* until an admin
  approves it; until then they see a "Waiting for admin approval" screen and cannot create courses.
- **Admins** see the platform dashboard (students, instructors, courses, assignments, activity)
  and approve, reject or revoke instructor accounts. Admin can never be chosen at sign-up.

Create the first admin once: sign up normally, then run in the SQL editor:

```sql
update public.profiles set role = 'admin', status = 'active' where email = 'admin@example.com';
```

The login page has a "Log in as" selector; logging in on the wrong one is refused with a hint.

## Deploying

Push to `main` on GitHub, add repo secrets `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`,
and set Settings → Pages → Source to "GitHub Actions". The workflow in
`.github/workflows/deploy.yml` runs tests, builds, and publishes.

## Security notes

- Role, email, and `current_deadline` cannot be changed directly from the client (column privileges).
- Deadlines change only through `change_deadline()`, which updates the assignment, writes the history row,
  and creates one notification per enrolled student in one transaction.
- Enrolling goes through `enroll_by_code()`; students cannot list courses they are not in.
