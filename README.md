# ASPIRO — From Learning to Career

Database-driven career platform: React + TypeScript + Vite + Tailwind + Supabase (Auth, Postgres, RLS, Storage).
**No course, lesson, quiz, skill or career path is hardcoded.** The admin CMS creates everything; an empty database shows empty states.

## Setup
1. Create a Supabase project. In **Auth → Providers → Email**, keep **Confirm email ON** (required for secure admin bootstrap).
2. Run `supabase/migrations/0001_init.sql` in the SQL editor (or `supabase db push`).
3. `cp .env.example .env` and fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (anon key only, never the service-role key).
4. In Auth → URL Configuration add your site URL and `<site>/reset` as redirect URLs.
5. `npm install && npm run dev`

## Becoming the administrator
Sign up at `/signup` with **devisreeadmin@gmail.com** and confirm the email. A database trigger grants admin rights
to confirmed addresses listed in `bootstrap_admins`. There is no admin signup, role picker or client-side flag:
admin status lives only in the `admins` table, is read via `is_admin()`, and every content table is protected by RLS.
More admins: an existing admin runs `select add_admin('person@example.com');` (the person must have a confirmed account).

## Admin workflow (the CMS)
1. **Careers & Skills**: create career goals (shown in student onboarding), skills, and a learning path linking a goal to courses; set the path to *published*.
2. **Courses → New course** → add **phases** → **days** → open a day and **add activities** (lesson, coding exercise, quiz, assignment, challenge, project, reading, video, assessment). Each day has exactly the activities you choose; reorder, duplicate, mark optional, set minutes, assign skills.
3. **Preview** shows the student view (drafts visible, no progress recorded). **Publish** publishes the day and its activities; publish the **course** (and its learning path) so students see it.

## Architecture notes
- Hierarchy: career_goals → learning_paths → courses → phases → days → activities. Activity-specific config is `activities.content` (jsonb), rendered by type in `src/features/learning/renderers.tsx`; new types = a row in `activity_types` + an entry in `src/lib/activityTypes.ts`.
- Answer keys and hidden test cases live in admin-only `activity_secrets`. Quizzes are graded server-side (`submit_quiz`); students cannot write progress directly, only through RPCs (`start_activity`, `complete_activity`, `submit_quiz`, `submit_work`).
- Skill scores (`student_skill_scores` view) are weighted averages of graded evidence only. Skill-gap recommendations link only to existing published activities mapped to the weak skill.
- `activities.version` bumps on content change; progress/attempts store the version they were made against.
- Admin changes to content, skills, careers and profiles are written to `audit_logs` by triggers; notification sends are logged too.

## Implemented in this build (Milestones 1–3, 5 partly, 7 partly, 8 largely)
Auth (signup/login/logout/reset), 5-step onboarding with resume upload, roadmap/enrollment from published content, daily mission home, journey view, learning player (lesson, reading, video, quiz, assessment, assignment, project, challenge, coding), skills page, notification center + admin sender, full admin course/day/activity builder, careers/skills/paths CRUD, student management (search, suspend), analytics from real data, audit log, RLS + storage policies.

## NOT implemented yet (isolated, not faked; no UI links to them)
- **Code execution / automatic test running**: coding submissions are stored as evidence only; no judge. Add an Edge Function calling a sandbox (e.g. Judge0) that runs public + hidden tests.
- **Recovery mode** (missed-day redistribution), adaptive roadmap re-ordering.
- **Career readiness dashboard** beyond the skills page, **certificates**, **opportunities / matching / applications**, companies, announcements, events, hackathons.
- Drag-and-drop ordering (up/down buttons are used), autosave, assignment grading UI for admins, automated tests.
- Roadmap personalization currently picks the published course for the student's first goal, preferring a matching level.

## Security notes
Review RLS before launch. Never expose the service-role key. If email confirmation is disabled, anyone could register the bootstrap admin email first. Create the admin account before opening signups.
