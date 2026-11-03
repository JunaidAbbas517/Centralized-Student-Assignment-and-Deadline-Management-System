# Student Assignment and Deadline Management System

React + TypeScript + Vite frontend, Supabase (Auth + PostgreSQL + RLS) backend, deployed on GitHub Pages.

## Setup

1. Create a free project at supabase.com.
2. In the SQL editor, run [supabase/schema.sql](supabase/schema.sql) once.
3. Copy `app/.env.example` to `app/.env` and fill in the project URL and **anon** key
   (Project Settings → API). Never put the `service_role` key in the frontend.
4. For quick testing, turn off "Confirm email" under Authentication → Providers → Email
   (the default mail sender is heavily rate-limited).
5. Run:
   ```
   cd app
   npm install
   npm run dev
   npm test
   ```

## Creating an instructor

Everyone signs up as a student. Promote an instructor in the SQL editor:

```sql
update public.profiles set role = 'instructor' where email = 'teacher@example.com';
```

## Deploying

Push to `main` on GitHub, add repo secrets `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`,
and set Settings → Pages → Source to "GitHub Actions". The workflow in
`.github/workflows/deploy.yml` runs tests, builds, and publishes.

## Security notes

- Role, email, and `current_deadline` cannot be changed directly from the client (column privileges).
- Deadlines change only through `change_deadline()`, which updates the assignment, writes the history row,
  and creates one notification per enrolled student in one transaction.
- Enrolling goes through `enroll_by_code()`; students cannot list courses they are not in.
