begin;
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id),
  activity_id uuid not null references public.activities(id),
  rubric_id uuid not null,
  attempt integer not null default 1 check (attempt > 0),
  object_path text generated always as (student_id::text || '/' || activity_id::text || '/' || id::text || '/submission.ipynb') stored,
  status text not null default 'uploading' check (status in ('uploading', 'submitted', 'under_review', 'reviewed', 'resubmission_required')),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (student_id, activity_id, attempt),
  unique (object_path),
  unique (id, rubric_id),
  foreign key (rubric_id, activity_id) references public.rubrics(id, activity_id)
);
create index submissions_activity_idx on public.submissions(activity_id, status);
create index submissions_student_idx on public.submissions(student_id, created_at);
create table public.grades (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id),
  rubric_id uuid not null references public.rubrics(id),
  reviewer_id uuid not null references public.profiles(id),
  revision integer not null check (revision > 0),
  feedback text not null default '' check (length(feedback) <= 10000),
  status text not null check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique (submission_id, revision),
  unique (id, rubric_id),
  foreign key (submission_id, rubric_id) references public.submissions(id, rubric_id),
  check ((status = 'published') = (published_at is not null))
);
create index grades_submission_idx on public.grades(submission_id, status);
create table public.grade_criterion_scores (
  grade_id uuid not null,
  rubric_id uuid not null,
  criterion_id uuid not null,
  points numeric(8,2) not null check (points >= 0 and points <> 'NaN'::numeric),
  primary key (grade_id, criterion_id),
  foreign key (grade_id, rubric_id) references public.grades(id, rubric_id),
  foreign key (rubric_id, criterion_id) references public.rubric_criteria(rubric_id, id)
);

-- All grade writes go through this narrow, atomic, role-checked operation.
create function app_private.save_grade(
  p_submission_id uuid, p_scores jsonb, p_feedback text,
  p_publish boolean, p_expected_revision integer
) returns uuid language plpgsql security definer set search_path = '' as $$
declare s public.submissions; latest integer; grade_id uuid; entry record; cap numeric;
begin
  if not app_private.is_team() then raise exception 'Team access required' using errcode = '42501'; end if;
  select * into s from public.submissions where id = p_submission_id for update;
  if not found or s.status not in ('submitted', 'under_review', 'reviewed', 'resubmission_required') then
    raise exception 'Confirmed submission required' using errcode = '22023';
  end if;
  select coalesce(max(revision), 0) into latest from public.grades where submission_id = s.id;
  if latest is distinct from p_expected_revision then raise exception 'Grade revision conflict' using errcode = '40001'; end if;
  if p_scores is null or jsonb_typeof(p_scores) <> 'object' or p_publish is null then
    raise exception 'Scores must be an object and publication must be explicit' using errcode = '22023';
  end if;
  if not exists (select 1 from public.rubrics where id = s.rubric_id and status = 'published') then
    raise exception 'Published rubric required' using errcode = '22023';
  end if;
  for entry in select * from jsonb_each(p_scores) loop
    select max_points into cap from public.rubric_criteria where id::text = entry.key and rubric_id = s.rubric_id;
    if not found or jsonb_typeof(entry.value) <> 'number' then raise exception 'Unknown criterion or invalid score' using errcode = '22023'; end if;
    if (entry.value::text)::numeric < 0 or (entry.value::text)::numeric > cap or
      (entry.value::text)::numeric <> round((entry.value::text)::numeric, 2) then
      raise exception 'Score outside rubric bounds or precision' using errcode = '22023';
    end if;
  end loop;
  if p_publish and (select count(*) from jsonb_object_keys(p_scores)) <>
    (select count(*) from public.rubric_criteria where rubric_id = s.rubric_id) then
    raise exception 'All criteria required for publication' using errcode = '22023';
  end if;
  insert into public.grades(submission_id, rubric_id, reviewer_id, revision, feedback, status, published_at)
  values (s.id, s.rubric_id, auth.uid(), latest + 1, coalesce(p_feedback, ''),
    case when p_publish then 'published' else 'draft' end, case when p_publish then now() end)
  returning id into grade_id;
  insert into public.grade_criterion_scores(grade_id, rubric_id, criterion_id, points)
  select grade_id, s.rubric_id, key::uuid, (value::text)::numeric from jsonb_each(p_scores);
  insert into app_private.audit_events(actor_id, action, target_id)
  values (auth.uid(), case when p_publish then 'grade:published' else 'grade:draft' end, grade_id);
  return grade_id;
end;
$$;
create function public.save_grade(
  p_submission_id uuid, p_scores jsonb, p_feedback text,
  p_publish boolean, p_expected_revision integer
) returns uuid language sql security invoker set search_path = '' as $$
  select app_private.save_grade(p_submission_id, p_scores, p_feedback, p_publish, p_expected_revision);
$$;

alter table public.submissions enable row level security;
alter table public.grades enable row level security;
alter table public.grade_criterion_scores enable row level security;
revoke all on public.submissions, public.grades, public.grade_criterion_scores from public, anon, authenticated;
grant select on public.submissions, public.grades, public.grade_criterion_scores to authenticated;
grant insert (student_id, activity_id, rubric_id, attempt) on public.submissions to authenticated;
-- No direct client update/delete of submission identity, state or timestamps.
create policy submission_read on public.submissions for select to authenticated
using (app_private.is_team() or (student_id = (select auth.uid()) and app_private.is_registered()));
create policy submission_reserve on public.submissions for insert to authenticated
with check (app_private.uploads_enabled() and app_private.is_registered() and student_id = (select auth.uid()) and exists (
  select 1 from public.rubrics r where r.id = submissions.rubric_id and r.activity_id = submissions.activity_id and r.status = 'published'
));
create policy grade_read on public.grades for select to authenticated
using (app_private.is_team() or (status = 'published' and exists (
  select 1 from public.submissions s where s.id = submission_id and s.student_id = (select auth.uid()) and app_private.is_registered()
)));
create policy score_read on public.grade_criterion_scores for select to authenticated
using (exists (select 1 from public.grades g where g.id = grade_id));

-- Fail rather than silently modifying any bucket that predates this migration.
do $$ begin
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'storage' and c.relname = 'objects' and c.relrowsecurity) then
    raise exception 'Storage objects RLS is not enabled; owner review required';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects') then
    raise exception 'Existing Storage policies require owner review before applying';
  end if;
  if exists (select 1 from storage.buckets where id in ('student-submissions', 'team-materials')) then
    raise exception 'Academy buckets already exist; owner must review before applying';
  end if;
end; $$;
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types) values
  ('student-submissions', 'student-submissions', false, 262144, array['application/x-ipynb+json', 'application/json']),
  ('team-materials', 'team-materials', false, 1048576, array['text/markdown', 'application/pdf']);

-- Supabase owns storage tables. Only policies and bucket configuration are added.
create policy academy_submission_download on storage.objects for select to authenticated
using (bucket_id = 'student-submissions' and exists (
  select 1 from public.submissions s where s.object_path = name and
    (app_private.is_team() or (s.student_id = (select auth.uid()) and app_private.is_registered()))
));
create policy academy_submission_upload on storage.objects for insert to authenticated
with check (bucket_id = 'student-submissions' and app_private.uploads_enabled() and app_private.is_registered()
  and owner_id = (select auth.uid())::text and exists (
    select 1 from public.submissions s join public.activities a on a.id = s.activity_id
    join public.rubrics r on r.id = s.rubric_id
    where s.object_path = name and s.student_id = (select auth.uid()) and s.status = 'uploading'
      and a.status = 'published' and r.status = 'published'
  ));
create policy academy_team_material_read on storage.objects for select to authenticated
using (bucket_id = 'team-materials' and app_private.is_team());
-- No object UPDATE/DELETE policies; no Team-material INSERT policy.
-- Cleanup is an explicit owner operation through the Storage API, never SQL deletion.

revoke all on function app_private.save_grade(uuid,jsonb,text,boolean,integer) from public, anon;
grant execute on function app_private.save_grade(uuid,jsonb,text,boolean,integer) to authenticated;
revoke all on function public.save_grade(uuid,jsonb,text,boolean,integer) from public, anon;
grant execute on function public.save_grade(uuid,jsonb,text,boolean,integer) to authenticated;
commit;
