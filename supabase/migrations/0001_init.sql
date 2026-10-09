-- ASPIRO core schema. Run once in the Supabase SQL editor (or `supabase db push`).
-- All learning content is created by admins through the CMS: this file seeds NO content.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- helpers
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ---------------------------------------------------------------- admin identity
-- Admin status lives ONLY in this table. No role column on profiles, nothing user-editable.
create table public.bootstrap_admins (email text primary key);
insert into public.bootstrap_admins values ('devisreeadmin@gmail.com');
alter table public.bootstrap_admins enable row level security; -- no policies => invisible to API

create table public.admins (
  user_id uuid primary key references auth.users on delete cascade,
  created_by uuid references auth.users,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
$$;

create policy admins_select on public.admins for select using (user_id = auth.uid() or public.is_admin());
-- no insert/update/delete policies: admins are added only via add_admin() below or by the bootstrap trigger.

create or replace function public.add_admin(p_email text) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;
  select id into uid from auth.users where lower(email) = lower(p_email) and email_confirmed_at is not null;
  if uid is null then raise exception 'No confirmed user with that email'; end if;
  insert into public.admins(user_id, created_by) values (uid, auth.uid()) on conflict do nothing;
end $$;

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  full_name text not null default '',
  institution text, degree text, branch text, graduation_year int, location text,
  experience_level text check (experience_level in ('beginner','intermediate','advanced')),
  languages text[] not null default '{}',
  tech_skills text[] not null default '{}',
  resume_path text, github_url text, linkedin_url text,
  objectives text[] not null default '{}',            -- internship / job / placement / exam / skills
  preferred_location text,
  work_mode text check (work_mode in ('remote','hybrid','onsite','any')),
  willing_to_relocate boolean,
  company_type text,
  target_days int, daily_minutes int,
  notifications_enabled boolean not null default true,
  onboarding_completed boolean not null default false,
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();

create or replace function public.profiles_guard() returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and not public.is_admin()
     and (new.status is distinct from old.status or new.email is distinct from old.email) then
    raise exception 'Not allowed to change status or email';
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles for each row execute function public.profiles_guard();

create policy profiles_select on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy profiles_update_own on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_update_admin on public.profiles for update using (public.is_admin()) with check (public.is_admin());

-- Create profile on signup; grant admin ONLY to a confirmed bootstrap email.
-- IMPORTANT: keep "Confirm email" enabled in Supabase Auth so nobody can claim that address unverified.
create or replace function public.handle_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  if new.email_confirmed_at is not null
     and exists (select 1 from public.bootstrap_admins b where lower(b.email) = lower(new.email)) then
    insert into public.admins(user_id) values (new.id) on conflict do nothing;
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_auth_user();
create trigger on_auth_user_confirmed after update of email_confirmed_at on auth.users
  for each row when (new.email_confirmed_at is not null) execute function public.handle_auth_user();

-- ---------------------------------------------------------------- career taxonomy
create table public.skills (
  id uuid primary key default gen_random_uuid(),
  name text not null unique, category text, description text,
  created_at timestamptz not null default now()
);
create table public.career_goals (
  id uuid primary key default gen_random_uuid(),
  name text not null unique, description text, category text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.student_career_goals (
  student_id uuid not null references public.profiles on delete cascade,
  career_goal_id uuid not null references public.career_goals on delete cascade,
  position int not null default 0,
  primary key (student_id, career_goal_id)
);
create or replace function public.limit_goals() returns trigger language plpgsql as $$
begin
  if (select count(*) from public.student_career_goals where student_id = new.student_id) >= 3 then
    raise exception 'You can select up to three career interests';
  end if;
  return new;
end $$;
create trigger limit_goals before insert on public.student_career_goals for each row execute function public.limit_goals();

-- ---------------------------------------------------------------- learning content
create table public.learning_paths (
  id uuid primary key default gen_random_uuid(),
  career_goal_id uuid references public.career_goals on delete set null,
  title text not null, description text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  learning_path_id uuid references public.learning_paths on delete set null,
  title text not null, description text,
  level text check (level in ('beginner','intermediate','advanced')),
  cover_path text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_by uuid references auth.users,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.course_skills (
  course_id uuid references public.courses on delete cascade,
  skill_id uuid references public.skills on delete cascade,
  primary key (course_id, skill_id)
);
create table public.phases (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses on delete cascade,
  title text not null, description text,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);
create table public.days (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses on delete cascade,
  phase_id uuid not null references public.phases on delete cascade,
  day_number int not null,
  title text not null, description text,
  estimated_minutes int not null default 0,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (course_id, day_number)
);
-- New activity types can be added by inserting a row here (no schema change).
create table public.activity_types (key text primary key, label text not null);
insert into public.activity_types values
  ('lesson','Lesson'),('coding_exercise','Coding Exercise'),('quiz','Quiz'),('assignment','Assignment'),
  ('challenge','Challenge'),('project','Project'),('reading','Reading'),('video','Video'),('assessment','Assessment');

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.days on delete cascade,
  type text not null references public.activity_types,
  title text not null, description text,
  order_index int not null default 0,
  is_required boolean not null default true,
  estimated_minutes int not null default 10,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  content jsonb not null default '{}'::jsonb,   -- student-visible configuration (type specific)
  version int not null default 1,               -- bumps when content changes; progress remembers the version
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.activity_skills (
  activity_id uuid references public.activities on delete cascade,
  skill_id uuid references public.skills on delete cascade,
  weight numeric not null default 1,
  primary key (activity_id, skill_id)
);
-- Answer keys & hidden test cases: admin-only, never readable by students.
create table public.activity_secrets (
  activity_id uuid primary key references public.activities on delete cascade,
  content jsonb not null default '{}'::jsonb
);
create index on public.phases (course_id, order_index);
create index on public.days (course_id, day_number);
create index on public.activities (day_id, order_index);
create index on public.learning_paths (career_goal_id);

create or replace function public.activities_bump() returns trigger language plpgsql as $$
begin
  if new.content is distinct from old.content or new.title is distinct from old.title then
    new.version = old.version + 1;
  end if;
  new.updated_at = now();
  return new;
end $$;
create trigger activities_bump before update on public.activities for each row execute function public.activities_bump();
create trigger courses_updated before update on public.courses for each row execute function public.set_updated_at();
create trigger days_updated before update on public.days for each row execute function public.set_updated_at();
create trigger paths_updated before update on public.learning_paths for each row execute function public.set_updated_at();

-- visibility helpers (security definer so policies don't recurse)
create or replace function public.course_visible(c uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.courses where id = c and status = 'published') $$;
create or replace function public.day_visible(d uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.days x join public.courses c on c.id = x.course_id
                 where x.id = d and x.status = 'published' and c.status = 'published') $$;
create or replace function public.activity_visible(a uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.activities t join public.days x on x.id = t.day_id join public.courses c on c.id = x.course_id
                 where t.id = a and t.status = 'published' and x.status = 'published' and c.status = 'published') $$;

-- ---------------------------------------------------------------- student learning state
create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles on delete cascade,
  course_id uuid not null references public.courses on delete cascade,
  career_goal_id uuid references public.career_goals on delete set null,
  start_date date not null default current_date,
  target_days int, daily_minutes int,
  status text not null default 'active' check (status in ('active','paused','completed')),
  created_at timestamptz not null default now(),
  unique (student_id, course_id)
);
create table public.activity_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles on delete cascade,
  activity_id uuid not null references public.activities on delete cascade,
  status text not null default 'in_progress' check (status in ('in_progress','completed')),
  started_at timestamptz default now(), completed_at timestamptz,
  time_spent_seconds int not null default 0,
  attempts int not null default 0,
  score numeric, result jsonb, evidence jsonb,
  activity_version int,
  updated_at timestamptz not null default now(),
  unique (student_id, activity_id)
);
create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles on delete cascade,
  activity_id uuid not null references public.activities on delete cascade,
  score numeric not null, passed boolean not null, answers jsonb not null,
  activity_version int, created_at timestamptz not null default now()
);
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles on delete cascade,
  activity_id uuid not null references public.activities on delete cascade,
  text_body text, url text, file_path text, code text, language text,
  status text not null default 'submitted' check (status in ('submitted','reviewed')),
  score numeric, feedback text,
  activity_version int, created_at timestamptz not null default now()
);
create index on public.activity_progress (student_id);
create index on public.submissions (activity_id);
create index on public.quiz_attempts (student_id, activity_id);

-- Evidence-based skill score: weighted average of graded evidence only (never "course completed = mastered").
create view public.student_skill_scores with (security_invoker = true) as
select ap.student_id, ask.skill_id,
       round(sum(ap.score * ask.weight) / nullif(sum(ask.weight), 0), 1) as score,
       count(*)::int as evidence_count
from public.activity_progress ap
join public.activity_skills ask on ask.activity_id = ap.activity_id
where ap.score is not null
group by ap.student_id, ask.skill_id;

-- ---------------------------------------------------------------- notifications & audit
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null, message text not null,
  category text not null default 'learning' check (category in ('career','learning','opportunities')),
  priority text not null default 'normal' check (priority in ('low','normal','high')),
  action_url text, created_by uuid references auth.users,
  created_at timestamptz not null default now()
);
create table public.notification_recipients (
  notification_id uuid references public.notifications on delete cascade,
  user_id uuid references public.profiles on delete cascade,
  read_at timestamptz,
  primary key (notification_id, user_id)
);
create index on public.notification_recipients (user_id, read_at);
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid, action text not null, entity text not null, entity_id text, metadata jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.audit_row() returns trigger language plpgsql security definer set search_path = public as $$
declare r jsonb := to_jsonb(coalesce(new, old));
begin
  if auth.uid() is not null then
    insert into public.audit_logs(actor_id, action, entity, entity_id, metadata)
    values (auth.uid(), lower(tg_op), tg_table_name, r->>'id',
            jsonb_build_object('title', coalesce(r->>'title', r->>'name'), 'status', r->>'status'));
  end if;
  return coalesce(new, old);
end $$;
do $$ declare t text; begin
  foreach t in array array['courses','days','activities','skills','career_goals','learning_paths','profiles'] loop
    execute format('create trigger audit_%1$s after insert or update or delete on public.%1$s for each row execute function public.audit_row()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- RLS
do $$ declare t text; begin
  foreach t in array array['skills','career_goals','student_career_goals','learning_paths','courses','course_skills','phases','days',
    'activity_types','activities','activity_skills','activity_secrets','enrollments','activity_progress','quiz_attempts','submissions',
    'notifications','notification_recipients','audit_logs'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
  -- admin full access on every content/management table
  foreach t in array array['skills','career_goals','learning_paths','courses','course_skills','phases','days','activity_types',
    'activities','activity_skills','activity_secrets','notifications'] loop
    execute format('create policy %1$s_admin_all on public.%1$s for all using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

create policy skills_read on public.skills for select to authenticated using (true);
create policy types_read on public.activity_types for select to authenticated using (true);
create policy goals_read on public.career_goals for select to authenticated using (is_active);
create policy paths_read on public.learning_paths for select to authenticated using (status = 'published');
create policy courses_read on public.courses for select to authenticated using (status = 'published');
create policy course_skills_read on public.course_skills for select to authenticated using (public.course_visible(course_id));
create policy phases_read on public.phases for select to authenticated using (public.course_visible(course_id));
create policy days_read on public.days for select to authenticated using (public.day_visible(id));
create policy activities_read on public.activities for select to authenticated using (public.activity_visible(id));
create policy activity_skills_read on public.activity_skills for select to authenticated using (public.activity_visible(activity_id));

create policy scg_own on public.student_career_goals for all to authenticated
  using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy scg_admin_read on public.student_career_goals for select using (public.is_admin());

create policy enroll_own on public.enrollments for select using (student_id = auth.uid() or public.is_admin());
create policy progress_own on public.activity_progress for select using (student_id = auth.uid() or public.is_admin());
create policy attempts_own on public.quiz_attempts for select using (student_id = auth.uid() or public.is_admin());
create policy subs_own on public.submissions for select using (student_id = auth.uid() or public.is_admin());
create policy subs_admin_update on public.submissions for update using (public.is_admin()) with check (public.is_admin());
-- (students have NO insert/update policies on progress/attempts/submissions: they go through the RPCs below)

create policy notif_read on public.notifications for select to authenticated
  using (exists (select 1 from public.notification_recipients r where r.notification_id = id and r.user_id = auth.uid()));
create policy recip_read on public.notification_recipients for select using (user_id = auth.uid() or public.is_admin());
create policy recip_update on public.notification_recipients for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy audit_admin_read on public.audit_logs for select using (public.is_admin());

-- ---------------------------------------------------------------- student RPCs (server-side rules)
create or replace function public.start_activity(p_activity uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.activity_visible(p_activity) then raise exception 'Activity not available'; end if;
  insert into public.activity_progress(student_id, activity_id, status, activity_version)
  select auth.uid(), p_activity, 'in_progress', version from public.activities where id = p_activity
  on conflict (student_id, activity_id) do nothing;
end $$;

create or replace function public.complete_activity(p_activity uuid, p_seconds int default 0) returns void
language plpgsql security definer set search_path = public as $$
declare a public.activities%rowtype;
begin
  select * into a from public.activities where id = p_activity and type in ('lesson','reading','video');
  if not found or auth.uid() is null or not public.activity_visible(p_activity) then raise exception 'Activity not available'; end if;
  insert into public.activity_progress(student_id, activity_id, status, completed_at, time_spent_seconds, attempts, activity_version)
  values (auth.uid(), p_activity, 'completed', now(), greatest(p_seconds,0), 1, a.version)
  on conflict (student_id, activity_id) do update
    set status = 'completed', completed_at = coalesce(public.activity_progress.completed_at, now()),
        time_spent_seconds = public.activity_progress.time_spent_seconds + greatest(p_seconds,0), updated_at = now();
end $$;

create or replace function public.submit_quiz(p_activity uuid, p_answers jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); a public.activities%rowtype; sec jsonb; q jsonb;
  n int := 0; good int := 0; maxatt int; used int; sc numeric; pass numeric; ok boolean;
  expected jsonb; given jsonb; detail jsonb := '{}'::jsonb; did_pass boolean;
begin
  select * into a from public.activities where id = p_activity and type in ('quiz','assessment');
  if uid is null or not found or not public.activity_visible(p_activity) then raise exception 'Quiz not available'; end if;
  select content into sec from public.activity_secrets where activity_id = p_activity;
  maxatt := nullif(a.content->>'max_attempts','')::int;
  select count(*) into used from public.quiz_attempts where student_id = uid and activity_id = p_activity;
  if maxatt is not null and used >= maxatt then raise exception 'No attempts remaining'; end if;
  for q in select * from jsonb_array_elements(coalesce(a.content->'questions','[]'::jsonb)) loop
    n := n + 1;
    expected := coalesce(sec->'answers'->(q->>'id'), '[]'::jsonb);
    given := coalesce(p_answers->(q->>'id'), '[]'::jsonb);
    ok := (select coalesce(jsonb_agg(x order by x), '[]'::jsonb) from jsonb_array_elements(given) x)
        = (select coalesce(jsonb_agg(x order by x), '[]'::jsonb) from jsonb_array_elements(expected) x);
    if ok then good := good + 1; end if;
    detail := detail || jsonb_build_object(q->>'id', jsonb_build_object(
      'correct', ok, 'expected', expected, 'explanation', coalesce(sec->'explanations'->>(q->>'id'), '')));
  end loop;
  if n = 0 then raise exception 'This quiz has no questions yet'; end if;
  sc := round(good * 100.0 / n, 1);
  pass := coalesce(nullif(a.content->>'passing_score','')::numeric, 60);
  did_pass := sc >= pass;
  insert into public.quiz_attempts(student_id, activity_id, score, passed, answers, activity_version)
  values (uid, p_activity, sc, did_pass, p_answers, a.version);
  insert into public.activity_progress(student_id, activity_id, status, completed_at, attempts, score, result, activity_version)
  values (uid, p_activity, case when did_pass then 'completed' else 'in_progress' end,
          case when did_pass then now() end, 1, sc, jsonb_build_object('passed', did_pass), a.version)
  on conflict (student_id, activity_id) do update set
    attempts = public.activity_progress.attempts + 1,
    score = greatest(coalesce(public.activity_progress.score, 0), sc),
    status = case when did_pass or public.activity_progress.status = 'completed' then 'completed' else 'in_progress' end,
    completed_at = case when did_pass then coalesce(public.activity_progress.completed_at, now()) else public.activity_progress.completed_at end,
    result = jsonb_build_object('passed', did_pass or coalesce((public.activity_progress.result->>'passed')::boolean, false)),
    updated_at = now();
  return jsonb_build_object('score', sc, 'passed', did_pass, 'passing_score', pass,
                            'attempts_used', used + 1, 'max_attempts', maxatt, 'detail', detail);
end $$;

create or replace function public.submit_work(p_activity uuid, p_text text default null, p_url text default null,
  p_code text default null, p_language text default null, p_file_path text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare a public.activities%rowtype; sid uuid;
begin
  select * into a from public.activities where id = p_activity and type in ('assignment','project','challenge','coding_exercise');
  if auth.uid() is null or not found or not public.activity_visible(p_activity) then raise exception 'Activity not available'; end if;
  if coalesce(p_text,'') = '' and coalesce(p_url,'') = '' and coalesce(p_code,'') = '' and coalesce(p_file_path,'') = '' then
    raise exception 'Nothing to submit';
  end if;
  insert into public.submissions(student_id, activity_id, text_body, url, code, language, file_path, activity_version)
  values (auth.uid(), p_activity, p_text, p_url, p_code, p_language, p_file_path, a.version) returning id into sid;
  insert into public.activity_progress(student_id, activity_id, status, completed_at, attempts, result, activity_version)
  values (auth.uid(), p_activity, 'completed', now(), 1, jsonb_build_object('state','submitted'), a.version)
  on conflict (student_id, activity_id) do update set
    attempts = public.activity_progress.attempts + 1, status = 'completed',
    completed_at = coalesce(public.activity_progress.completed_at, now()), updated_at = now();
  return sid;
end $$;

-- Picks a published course for the goal (prefers one matching the student's level) and enrolls the student.
create or replace function public.enroll_in_goal(p_goal uuid, p_target_days int default null, p_daily_minutes int default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare cid uuid; eid uuid; lvl text;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select experience_level into lvl from public.profiles where id = auth.uid();
  select c.id into cid from public.courses c join public.learning_paths lp on lp.id = c.learning_path_id
   where lp.career_goal_id = p_goal and lp.status = 'published' and c.status = 'published'
   order by (c.level = lvl) desc nulls last, c.created_at limit 1;
  if cid is null then raise exception 'No published course for this goal yet'; end if;
  insert into public.enrollments(student_id, course_id, career_goal_id, target_days, daily_minutes)
  values (auth.uid(), cid, p_goal, p_target_days, p_daily_minutes)
  on conflict (student_id, course_id) do update set status = 'active' returning id into eid;
  return eid;
end $$;

-- ---------------------------------------------------------------- admin RPCs
create or replace function public.admin_send_notification(p_title text, p_message text, p_category text, p_priority text,
  p_action_url text, p_audience text, p_user_ids uuid[] default '{}') returns int
language plpgsql security definer set search_path = public as $$
declare nid uuid; cnt int;
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;
  insert into public.notifications(title, message, category, priority, action_url, created_by)
  values (p_title, p_message, p_category, p_priority, nullif(p_action_url,''), auth.uid()) returning id into nid;
  if p_audience = 'all' then
    insert into public.notification_recipients(notification_id, user_id)
    select nid, id from public.profiles where status = 'active' and id not in (select user_id from public.admins);
  else
    insert into public.notification_recipients(notification_id, user_id)
    select nid, id from public.profiles where id = any(p_user_ids);
  end if;
  get diagnostics cnt = row_count;
  insert into public.audit_logs(actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), 'send', 'notifications', nid::text, jsonb_build_object('title', p_title, 'recipients', cnt));
  return cnt;
end $$;

create or replace function public.admin_stats() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;
  return jsonb_build_object(
    'students', (select count(*) from public.profiles where id not in (select user_id from public.admins)),
    'active_7d', (select count(distinct student_id) from public.activity_progress where updated_at > now() - interval '7 days'),
    'courses_published', (select count(*) from public.courses where status = 'published'),
    'enrollments', (select count(*) from public.enrollments),
    'activities_completed', (select count(*) from public.activity_progress where status = 'completed'),
    'avg_quiz_score', (select round(avg(score),1) from public.quiz_attempts),
    'popular_paths', coalesce((select jsonb_agg(x) from (
        select cg.name, count(*)::int as students from public.enrollments e
        join public.career_goals cg on cg.id = e.career_goal_id group by cg.name order by 2 desc limit 5) x), '[]'::jsonb),
    'hardest_skills', coalesce((select jsonb_agg(x) from (
        select s.name, round(avg(v.score),1) as avg_score from public.student_skill_scores v
        join public.skills s on s.id = v.skill_id group by s.name order by 2 asc limit 5) x), '[]'::jsonb));
end $$;

-- ---------------------------------------------------------------- storage
insert into storage.buckets (id, name, public) values
  ('resumes','resumes',false), ('submissions','submissions',false), ('course-images','course-images',true)
on conflict (id) do nothing;

create policy resumes_owner on storage.objects for all to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy resumes_admin_read on storage.objects for select to authenticated
  using (bucket_id in ('resumes','submissions') and public.is_admin());
create policy submissions_owner on storage.objects for all to authenticated
  using (bucket_id = 'submissions' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'submissions' and (storage.foldername(name))[1] = auth.uid()::text);
create policy course_images_read on storage.objects for select using (bucket_id = 'course-images');
create policy course_images_admin on storage.objects for all to authenticated
  using (bucket_id = 'course-images' and public.is_admin()) with check (bucket_id = 'course-images' and public.is_admin());
