-- Dynamic file activities extend the current Academy activities/submissions/grading model.
-- Existing notebook activities retain their original bucket and 256 KiB upload contract.
begin;

alter table public.activities
  add column opens_at timestamptz,
  add column submission_mode text not null default 'notebook'
    check (submission_mode in ('notebook', 'files')),
  add column max_submission_files smallint not null default 1
    check (max_submission_files between 1 and 3),
  add column max_submission_file_bytes integer not null default 262144
    check (max_submission_file_bytes between 1 and 10485760),
  add column phase_1_ends_at timestamptz,
  add column phase_2_ends_at timestamptz,
  add column phase_1_bonus_points numeric(8,2) not null default 0
    check (phase_1_bonus_points >= 0 and phase_1_bonus_points <> 'NaN'::numeric),
  add column phase_2_bonus_points numeric(8,2) not null default 0
    check (phase_2_bonus_points >= 0 and phase_2_bonus_points <> 'NaN'::numeric),
  add column phase_3_bonus_points numeric(8,2) not null default 0
    check (phase_3_bonus_points >= 0 and phase_3_bonus_points <> 'NaN'::numeric),
  add column archived_at timestamptz;

alter table public.submissions
  add column submission_mode text not null default 'notebook'
    check (submission_mode in ('notebook', 'files')),
  add column submission_phase text check (submission_phase is null or submission_phase in ('early','middle','late')),
  add column received_at timestamptz not null default now(),
  add column activity_snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(activity_snapshot) = 'object'),
  add column submission_request_hash text
    check (submission_request_hash is null or submission_request_hash ~ '^[0-9a-f]{32}$');

-- Capture the configured bonus on each grade revision. Existing grades remain at
-- zero and later activity edits cannot rewrite a published score.
alter table public.grades
  add column time_bonus_points numeric(8,2) not null default 0
    check (time_bonus_points >= 0 and time_bonus_points <> 'NaN'::numeric);

-- General file uploads have an independent fail-closed gate. The existing
-- submission-service gate remains available for Week 1 notebook submissions.
create function app_private.activity_file_submissions_enabled() returns boolean
language sql immutable set search_path = '' as $$ select false; $$;
revoke all on function app_private.activity_file_submissions_enabled() from public, anon, authenticated;
grant execute on function app_private.activity_file_submissions_enabled() to anon, authenticated, service_role;
create or replace function public.academy_capabilities() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('submissions', app_private.submission_service_enabled(),
    'leaderboard', app_private.leaderboard_enabled(),
    'activity_file_submissions', app_private.activity_file_submissions_enabled());
$$;

create or replace function app_private.save_grade(
  p_submission_id uuid, p_scores jsonb, p_feedback text,
  p_publish boolean, p_expected_revision integer
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  s public.submissions; latest integer; grade_id uuid; entry record; cap numeric;
  bonus numeric(8,2) := 0;
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
  if p_publish then
    bonus := case s.submission_phase
      when 'early' then coalesce((s.activity_snapshot->>'phase_1_bonus_points')::numeric, 0)
      when 'middle' then coalesce((s.activity_snapshot->>'phase_2_bonus_points')::numeric, 0)
      when 'late' then coalesce((s.activity_snapshot->>'phase_3_bonus_points')::numeric, 0)
      else 0
    end;
  end if;
  insert into public.grades(submission_id, rubric_id, reviewer_id, revision, feedback, status, published_at, time_bonus_points)
  values (s.id, s.rubric_id, auth.uid(), latest + 1, coalesce(p_feedback, ''),
    case when p_publish then 'published' else 'draft' end, case when p_publish then now() end, bonus)
  returning id into grade_id;
  insert into public.grade_criterion_scores(grade_id, rubric_id, criterion_id, points)
  select grade_id, s.rubric_id, key::uuid, (value::text)::numeric from jsonb_each(p_scores);
  insert into app_private.audit_events(actor_id, action, target_id)
  values (auth.uid(), case when p_publish then 'grade:published' else 'grade:draft' end, grade_id);
  return grade_id;
end;
$$;

-- Keep the existing notebook flow intact while enforcing the new common activity
-- availability window and preventing file activities from using the notebook RPC.
create or replace function app_private.reserve_notebook(
  p_student_id uuid, p_activity_id uuid, p_request_id uuid, p_sha256 text, p_bytes integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare existing public.submissions; rubric uuid; attempts integer; previous_status text;
activity_record record;
begin
  if not app_private.submission_service_enabled() then raise exception 'Submissions closed' using errcode='42501'; end if;
  if p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$' or p_bytes is null or p_bytes not between 1 and 262144 or p_request_id is null then
    raise exception 'Invalid notebook metadata' using errcode='22023'; end if;
  perform 1 from public.profiles p join auth.users u on u.id=p.id
    join app_private.user_roles r on r.user_id=p.id
    where p.id=p_student_id and p.registered_at is not null
      and u.email_confirmed_at is not null and r.role='student' for update of p;
  if not found then raise exception 'Registered Student required' using errcode='42501'; end if;
  select * into existing from public.submissions where id=p_request_id;
  if found then
    if existing.student_id<>p_student_id or existing.activity_id<>p_activity_id
      or existing.notebook_sha256 is distinct from p_sha256 or existing.notebook_bytes is distinct from p_bytes then
      raise exception 'Request identifier conflict' using errcode='22023'; end if;
    return jsonb_build_object('id',existing.id,'path',existing.object_path,'status',existing.status);
  end if;
  select a.*, r.id as rubric_id into activity_record
  from public.rubrics r join public.activities a on a.id=r.activity_id
    join public.academy_weeks w on w.id=a.week_id
    where a.id=p_activity_id and a.status='published' and a.submission_mode='notebook'
      and a.archived_at is null and (a.opens_at is null or now()>=a.opens_at)
      and (a.due_at is null or now()<=a.due_at)
      and w.status='published' and w.kind='teaching' and r.status='published'
    order by r.version desc limit 1;
  rubric := activity_record.rubric_id;
  if rubric is null then raise exception 'Published notebook activity/rubric within availability window required' using errcode='22023'; end if;
  select count(*) into attempts from public.submissions where student_id=p_student_id and activity_id=p_activity_id;
  if attempts>=2 then raise exception 'Attempt quota reached' using errcode='22023'; end if;
  if attempts>0 then
    select status into previous_status from public.submissions where student_id=p_student_id and activity_id=p_activity_id order by attempt desc limit 1;
    if previous_status<>'resubmission_required' then raise exception 'Team resubmission request required' using errcode='22023'; end if;
  end if;
  insert into public.submissions(id,student_id,activity_id,rubric_id,attempt,notebook_sha256,notebook_bytes,
      submission_mode,submission_phase,received_at,activity_snapshot)
    values(p_request_id,p_student_id,p_activity_id,rubric,attempts+1,p_sha256,p_bytes,'notebook',null,
      now(), jsonb_build_object('week_id',activity_record.week_id,'title_ar',activity_record.title_ar,
        'title_en',activity_record.title_en,'instructions_ar',activity_record.instructions_ar,
        'instructions_en',activity_record.instructions_en,'max_score',activity_record.max_score,
        'opens_at',activity_record.opens_at,'due_at',activity_record.due_at,
        'phase_1_ends_at',activity_record.phase_1_ends_at,'phase_2_ends_at',activity_record.phase_2_ends_at,
        'phase_1_bonus_points',activity_record.phase_1_bonus_points,
        'phase_2_bonus_points',activity_record.phase_2_bonus_points,
        'phase_3_bonus_points',activity_record.phase_3_bonus_points,
        'submission_mode',activity_record.submission_mode,'rubric_id',rubric))
    returning * into existing;
  return jsonb_build_object('id',existing.id,'path',existing.object_path,'status',existing.status);
end;
$$;

create or replace function app_private.finalize_notebook(p_submission_id uuid, p_sha256 text) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.submissions;
begin
  if not app_private.submission_service_enabled() then raise exception 'Submissions closed' using errcode = '42501'; end if;
  select * into s from public.submissions where id = p_submission_id for update;
  if not found or s.submission_mode <> 'notebook' or s.notebook_sha256 is distinct from p_sha256 then
    raise exception 'Reservation mismatch' using errcode = '22023';
  end if;
  if s.status = 'submitted' then return; end if;
  if s.status <> 'uploading' then raise exception 'Reservation is not pending' using errcode = '22023'; end if;
  if not exists (
    select 1 from public.activities a join public.academy_weeks w on w.id = a.week_id
    where a.id = s.activity_id and a.status = 'published' and a.archived_at is null
      and a.submission_mode = 'notebook' and (a.opens_at is null or now() >= a.opens_at)
      and (a.due_at is null or now() <= a.due_at)
      and w.status = 'published' and w.kind = 'teaching'
  ) then raise exception 'Notebook activity is unavailable or its deadline passed' using errcode = '22023'; end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'student-submissions' and o.name = s.object_path
    and (o.metadata->>'size')::bigint = s.notebook_bytes
    and o.metadata->>'mimetype' in ('application/x-ipynb+json','application/json')) then
    raise exception 'Validated object is missing or metadata mismatches' using errcode = '22023';
  end if;
  update public.submissions set status = 'submitted', submitted_at = now() where id = s.id;
  insert into app_private.audit_events(actor_id, action, target_id)
    values (s.student_id, 'submission:submitted', s.id);
end;
$$;

create table public.activity_submission_files (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id),
  position smallint not null check (position between 0 and 2),
  original_name text not null check (length(original_name) between 1 and 180),
  content_type text not null,
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  storage_path text not null unique,
  expected_sha256 text not null check (expected_sha256 ~ '^[0-9a-f]{64}$'),
  sha256 text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (submission_id, position),
  unique (submission_id, original_name)
);
create index activity_submission_files_submission_idx
  on public.activity_submission_files(submission_id, created_at, id);
alter table public.activity_submission_files enable row level security;
revoke all on public.activity_submission_files from public, anon, authenticated;
grant select on public.activity_submission_files to authenticated;
-- The trusted Edge finalizer reads this manifest through the service-role API;
-- it does not need direct write privileges on the table.
grant select on public.activity_submission_files to service_role;
-- The Edge handler also needs a narrow ownership/state lookup before it can
-- finalize or cancel a file submission. Keep its Data API grant column-scoped.
grant select (id, student_id, submission_mode, status) on public.submissions to service_role;
create policy activity_submission_file_read on public.activity_submission_files
  for select to authenticated using (exists (
    select 1 from public.submissions s
    where s.id = submission_id and s.submission_mode = 'files'
      and (app_private.is_team() or s.student_id = (select auth.uid()))
      and (s.status <> 'uploading' or s.student_id = (select auth.uid()))
  ));

-- Classify at server-verified completion, not a client clock or an early reservation.
create function app_private.capture_verified_submission_phase() returns trigger
language plpgsql set search_path = '' as $$
declare phase_one timestamptz; phase_two timestamptz;
begin
  if old.status = 'uploading' and new.status = 'submitted' then
    new.submitted_at := coalesce(new.submitted_at, now());
    phase_one := nullif(new.activity_snapshot->>'phase_1_ends_at', '')::timestamptz;
    phase_two := nullif(new.activity_snapshot->>'phase_2_ends_at', '')::timestamptz;
    new.submission_phase := case
      when phase_one is null or phase_two is null then null
      when new.submitted_at < phase_one then 'early'
      when new.submitted_at < phase_two then 'middle'
      else 'late'
    end;
  end if;
  return new;
end;
$$;
create trigger submission_phase_capture
  before update of status, submitted_at on public.submissions
  for each row execute function app_private.capture_verified_submission_phase();
revoke all on function app_private.capture_verified_submission_phase() from public, anon, authenticated;

create function app_private.validate_activity_configuration() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.submission_mode = 'files' then
    if new.max_submission_files not between 1 and 3
      or new.max_submission_file_bytes not between 1 and 10485760 then
      raise exception 'File submission limits are outside the approved range' using errcode = '22023';
    end if;
    if new.opens_at is null then
      raise exception 'File activities require an explicit opening time' using errcode = '22023';
    end if;
  end if;
  if new.opens_at is not null and new.due_at is not null and new.opens_at >= new.due_at then
    raise exception 'Activity opening time must precede its deadline' using errcode = '22023';
  end if;
  if (new.phase_1_ends_at is null) <> (new.phase_2_ends_at is null)
    or (new.phase_1_ends_at is not null and
      (new.opens_at is null or new.due_at is null or new.opens_at >= new.phase_1_ends_at
        or new.phase_1_ends_at >= new.phase_2_ends_at or new.phase_2_ends_at >= new.due_at)) then
    raise exception 'Three submission phases require ordered opening, boundaries and deadline' using errcode = '22023';
  end if;
  if new.phase_1_bonus_points < new.phase_2_bonus_points
    or new.phase_2_bonus_points < new.phase_3_bonus_points
    or (new.phase_1_ends_at is null and
      (new.phase_1_bonus_points <> 0 or new.phase_2_bonus_points <> 0 or new.phase_3_bonus_points <> 0)) then
    raise exception 'Phase bonuses require configured phases and must decrease or stay equal' using errcode = '22023';
  end if;
  if new.status = 'published' and new.submission_mode = 'files' then
    if nullif(trim(new.title_ar), '') is null or nullif(trim(new.title_en), '') is null
      or nullif(trim(new.instructions_ar), '') is null or nullif(trim(new.instructions_en), '') is null
      or not exists (select 1 from public.rubrics r where r.activity_id = new.id and r.status = 'published') then
      raise exception 'Published activity requires bilingual instructions and a published rubric' using errcode = '22023';
    end if;
  end if;
  if tg_op = 'UPDATE' and exists (select 1 from public.submissions s where s.activity_id = old.id)
    and (new.week_id, new.title_ar, new.title_en, new.instructions_ar, new.instructions_en,
      new.max_score, new.due_at, new.opens_at, new.submission_mode, new.max_submission_files,
      new.max_submission_file_bytes, new.phase_1_ends_at, new.phase_2_ends_at,
      new.phase_1_bonus_points, new.phase_2_bonus_points, new.phase_3_bonus_points)
      is distinct from
      (old.week_id, old.title_ar, old.title_en, old.instructions_ar, old.instructions_en,
      old.max_score, old.due_at, old.opens_at, old.submission_mode, old.max_submission_files,
      old.max_submission_file_bytes, old.phase_1_ends_at, old.phase_2_ends_at,
      old.phase_1_bonus_points, old.phase_2_bonus_points, old.phase_3_bonus_points) then
    raise exception 'Activity scoring/content locks prevent changes after the first submission; archive it and create a new activity'
      using errcode = '55000';
  end if;
  if tg_op = 'UPDATE' and old.status = 'published' and new.status = 'draft'
    and exists (select 1 from public.submissions s where s.activity_id = old.id) then
    raise exception 'Published activity with academic records cannot be unpublished; archive it instead'
      using errcode = '55000';
  end if;
  return new;
end;
$$;
create trigger activity_configuration_guard
  before insert or update on public.activities
  for each row execute function app_private.validate_activity_configuration();
revoke all on function app_private.validate_activity_configuration() from public, anon, authenticated;

drop policy activity_read on public.activities;
create policy activity_read on public.activities for select to authenticated
using (app_private.is_team() or (app_private.is_registered() and status = 'published'
  and archived_at is null and exists (
    select 1 from public.academy_weeks w
    where w.id = week_id and w.kind = 'teaching' and w.status = 'published'
  )));

-- Activity deletion is available only through a narrow Team RPC for an unused draft.
revoke delete on public.activities from authenticated;
create function app_private.archive_activity(p_activity_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not app_private.is_team() then raise exception 'Team access required' using errcode = '42501'; end if;
  update public.activities set archived_at = coalesce(archived_at, now())
    where id = p_activity_id and archived_at is null;
  if not found then raise exception 'Active activity not found' using errcode = '22023'; end if;
  insert into app_private.audit_events(actor_id, action, target_id)
    values (auth.uid(), 'activity:archived', p_activity_id);
end;
$$;
create function public.archive_activity(p_activity_id uuid) returns void
language sql security invoker set search_path = '' as $$
  select app_private.archive_activity(p_activity_id);
$$;
create function app_private.delete_activity_draft(p_activity_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare activity_record public.activities;
begin
  if not app_private.is_team() then raise exception 'Team access required' using errcode = '42501'; end if;
  -- Serialize deletion with publish and submission reservation, both of which
  -- lock the activity row. Check eligibility only after acquiring this lock.
  select * into activity_record from public.activities where id = p_activity_id for update;
  if not found then
    raise exception 'Only an unused active draft may be deleted' using errcode = '55000';
  end if;
  if activity_record.status <> 'draft' or activity_record.archived_at is not null
    or exists (select 1 from public.submissions where activity_id = p_activity_id)
    or exists (select 1 from public.grades g join public.submissions s on s.id = g.submission_id
      where s.activity_id = p_activity_id)
    or exists (select 1 from public.rubrics where activity_id = p_activity_id and status = 'published') then
    raise exception 'Only an unused active draft may be deleted' using errcode = '55000';
  end if;
  delete from public.rubric_criteria c using public.rubrics r
    where c.rubric_id = r.id and r.activity_id = p_activity_id and r.status = 'draft';
  delete from public.rubrics where activity_id = p_activity_id and status = 'draft';
  delete from public.activities where id = p_activity_id;
  insert into app_private.audit_events(actor_id, action, target_id)
    values (auth.uid(), 'activity:draft_deleted', p_activity_id);
end;
$$;
create function public.delete_activity_draft(p_activity_id uuid) returns void
language sql security invoker set search_path = '' as $$
  select app_private.delete_activity_draft(p_activity_id);
$$;
revoke all on function app_private.archive_activity(uuid), public.archive_activity(uuid),
  app_private.delete_activity_draft(uuid), public.delete_activity_draft(uuid) from public, anon, authenticated;
grant execute on function app_private.archive_activity(uuid), app_private.delete_activity_draft(uuid),
  public.archive_activity(uuid), public.delete_activity_draft(uuid) to authenticated;

-- A separate private bucket keeps general files from changing the existing notebook bucket limits.
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'activity-submissions') then
    insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
    values ('activity-submissions', 'activity-submissions', false, 10485760,
      array['application/pdf','text/csv','text/plain','application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/x-ipynb+json','application/json','image/png','image/jpeg']);
  elsif exists (select 1 from storage.buckets where id = 'activity-submissions'
      and (public or file_size_limit is distinct from 10485760)) then
    raise exception 'Existing activity-submissions bucket configuration requires review';
  end if;
end $$;

create function app_private.activity_submission_object_allowed(p_path text, p_upload boolean)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.activity_submission_files f
    join public.submissions s on s.id = f.submission_id
    where f.storage_path = p_path and s.submission_mode = 'files'
      and ((p_upload and s.status = 'uploading' and f.sha256 is null
          and s.student_id = (select auth.uid()) and app_private.is_verified()
          and app_private.is_registered() and app_private.current_role() = 'student'
          and app_private.submission_service_enabled()
          and app_private.activity_file_submissions_enabled())
        or (not p_upload and ((s.status <> 'uploading'
          and (s.student_id = (select auth.uid()) or app_private.is_team()))
          or s.student_id = (select auth.uid()))))
  );
$$;
revoke all on function app_private.activity_submission_object_allowed(text, boolean) from public, anon, authenticated;
grant execute on function app_private.activity_submission_object_allowed(text, boolean) to authenticated;
create policy academy_activity_file_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'activity-submissions'
    and app_private.activity_submission_object_allowed(name, true));
create policy academy_activity_file_read on storage.objects for select to authenticated
  using (bucket_id = 'activity-submissions'
    and app_private.activity_submission_object_allowed(name, false));

create function app_private.reserve_activity_submission(
  p_activity_id uuid, p_request_id uuid, p_files jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  a public.activities;
  existing public.submissions;
  rubric uuid;
  attempts integer;
  file jsonb;
  filename text;
  extension text;
  mime text;
  size_bytes integer;
  total_bytes bigint := 0;
  file_id uuid;
  file_path text;
  file_position smallint;
  file_digest text;
  request_hash text;
  snapshot jsonb;
begin
  if not app_private.submission_service_enabled() then raise exception 'Submissions closed' using errcode = '42501'; end if;
  if not app_private.activity_file_submissions_enabled() then raise exception 'Activity file submissions closed' using errcode = '42501'; end if;
  if actor is null or not app_private.is_verified() or not app_private.is_registered()
    or app_private.current_role() <> 'student' then
    raise exception 'Verified registered Student required' using errcode = '42501';
  end if;
  if p_request_id is null or p_files is null or jsonb_typeof(p_files) <> 'array'
    or jsonb_array_length(p_files) not between 1 and 3 then
    raise exception 'One to three files are required' using errcode = '22023';
  end if;
  perform 1 from public.profiles where id = actor for update;
  select * into a from public.activities where id = p_activity_id for update;
  if not found or a.submission_mode <> 'files' or a.status <> 'published' or a.archived_at is not null
    or a.opens_at is null or now() < a.opens_at or (a.due_at is not null and now() > a.due_at)
    or not exists (select 1 from public.academy_weeks w where w.id = a.week_id
      and w.kind = 'teaching' and w.status = 'published') then
    raise exception 'Published activity is unavailable' using errcode = '22023';
  end if;
  if jsonb_array_length(p_files) > a.max_submission_files then
    raise exception 'File count exceeds activity limit' using errcode = '22023';
  end if;
  select r.id into rubric from public.rubrics r
    where r.activity_id = a.id and r.status = 'published' order by r.version desc limit 1;
  if rubric is null then raise exception 'Published rubric required' using errcode = '22023'; end if;
  request_hash := md5(p_files::text);
  select * into existing from public.submissions where id = p_request_id;
  if found then
    if existing.student_id <> actor or existing.activity_id <> a.id
      or existing.submission_mode <> 'files' or existing.submission_request_hash is distinct from request_hash then
      raise exception 'Request identifier conflict' using errcode = '22023';
    end if;
    return jsonb_build_object('id', existing.id, 'status', existing.status,
      'files', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'path', f.storage_path,
        'name', f.original_name, 'size', f.size_bytes) order by f.position)
        from public.activity_submission_files f where f.submission_id = existing.id), '[]'::jsonb));
  end if;
  select count(*) into attempts from public.submissions where student_id = actor and activity_id = a.id;
  if attempts >= 2 then raise exception 'Attempt quota reached' using errcode = '54000'; end if;
  if attempts > 0 and not exists (select 1 from public.submissions s where s.student_id = actor
      and s.activity_id = a.id and s.attempt = attempts and s.status = 'resubmission_required') then
    raise exception 'Team resubmission request required' using errcode = '42501';
  end if;
  for file in select value from jsonb_array_elements(p_files) loop
    if jsonb_typeof(file) <> 'object' or jsonb_typeof(file->'name') <> 'string'
      or jsonb_typeof(file->'type') <> 'string' or jsonb_typeof(file->'size') <> 'number'
      or jsonb_typeof(file->'sha256') <> 'string' or (file->>'sha256') !~ '^[0-9a-f]{64}$'
      or (file->>'size') !~ '^[1-9][0-9]{0,7}$' then
      raise exception 'Invalid file metadata' using errcode = '22023';
    end if;
    filename := file->>'name'; mime := file->>'type'; size_bytes := (file->>'size')::integer;
    if length(filename) not between 1 and 180 or filename ~ '[[:cntrl:]]'
      or strpos(filename, '/') > 0 or strpos(filename, chr(92)) > 0
      or filename ~ U&'[\202A-\202E\2066-\2069]' then
      raise exception 'Unsafe file name' using errcode = '22023';
    end if;
    extension := lower(substring(filename from '\.([^.]+)$'));
    if extension is null or not (
      (extension = 'pdf' and mime = 'application/pdf') or
      (extension = 'csv' and mime in ('text/csv','application/vnd.ms-excel')) or
      (extension = 'txt' and mime = 'text/plain') or
      (extension = 'xls' and mime = 'application/vnd.ms-excel') or
      (extension = 'xlsx' and mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') or
      (extension = 'ipynb' and mime in ('application/x-ipynb+json','application/json')) or
      (extension = 'png' and mime = 'image/png') or
      (extension in ('jpg','jpeg') and mime = 'image/jpeg')) then
      raise exception 'File type is not allowed' using errcode = '22023';
    end if;
    if size_bytes > a.max_submission_file_bytes then raise exception 'File exceeds activity size limit' using errcode = '22023'; end if;
    total_bytes := total_bytes + size_bytes;
  end loop;
  if total_bytes > 31457280 then raise exception 'Combined upload exceeds 30 MiB' using errcode = '22023'; end if;
  snapshot := jsonb_build_object('week_id', a.week_id, 'title_ar', a.title_ar, 'title_en', a.title_en,
    'instructions_ar', a.instructions_ar, 'instructions_en', a.instructions_en,
    'max_score', a.max_score, 'opens_at', a.opens_at, 'due_at', a.due_at,
      'phase_1_ends_at', a.phase_1_ends_at, 'phase_2_ends_at', a.phase_2_ends_at,
      'phase_1_bonus_points', a.phase_1_bonus_points, 'phase_2_bonus_points', a.phase_2_bonus_points,
      'phase_3_bonus_points', a.phase_3_bonus_points,
      'submission_mode', a.submission_mode, 'rubric_id', rubric);
  insert into public.submissions(id, student_id, activity_id, rubric_id, attempt, submission_mode,
      submission_phase, received_at, activity_snapshot, submission_request_hash)
    values (p_request_id, actor, a.id, rubric, attempts + 1, 'files',
      null, now(), snapshot, request_hash)
    returning * into existing;
  for file, file_position in select value, (ordinality - 1)::smallint from jsonb_array_elements(p_files) with ordinality loop
    filename := file->>'name'; mime := file->>'type'; size_bytes := (file->>'size')::integer;
    file_digest := file->>'sha256';
    file_id := gen_random_uuid();
    file_path := actor::text || '/' || a.id::text || '/' || p_request_id::text || '/' || file_id::text || '.' ||
      lower(substring(filename from '\.([^.]+)$'));
    insert into public.activity_submission_files(submission_id, position, original_name, content_type,
      size_bytes, storage_path, expected_sha256)
      values (p_request_id, file_position, filename, mime, size_bytes, file_path, file_digest);
  end loop;
  insert into app_private.audit_events(actor_id, action, target_id)
    values (actor, 'activity_submission:reserved', p_request_id);
  return jsonb_build_object('id', existing.id, 'status', existing.status,
    'files', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'path', f.storage_path,
      'name', f.original_name, 'size', f.size_bytes) order by f.position)
      from public.activity_submission_files f where f.submission_id = existing.id), '[]'::jsonb));
end;
$$;
create function public.reserve_activity_submission(p_activity_id uuid, p_request_id uuid, p_files jsonb)
returns jsonb language sql security invoker set search_path = '' as $$
  select app_private.reserve_activity_submission(p_activity_id, p_request_id, p_files);
$$;

create function app_private.finalize_activity_submission(p_submission_id uuid, p_files jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.submissions; item jsonb; f public.activity_submission_files; digest text;
begin
  if auth.role() <> 'service_role' then raise exception 'Trusted file verifier required' using errcode = '42501'; end if;
  if not app_private.submission_service_enabled() then raise exception 'Submissions closed' using errcode = '42501'; end if;
  if not app_private.activity_file_submissions_enabled() then raise exception 'Activity file submissions closed' using errcode = '42501'; end if;
  select * into s from public.submissions where id = p_submission_id for update;
  if not found or s.submission_mode <> 'files' then raise exception 'File submission not found' using errcode = '22023'; end if;
  if s.status = 'submitted' then return; end if;
  if s.status <> 'uploading' or jsonb_typeof(p_files) <> 'array'
    or jsonb_array_length(p_files) <> (select count(*) from public.activity_submission_files where submission_id = s.id) then
    raise exception 'Pending file manifest mismatch' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.activities a join public.academy_weeks w on w.id = a.week_id
    where a.id = s.activity_id and a.status = 'published' and a.archived_at is null
      and a.submission_mode = 'files' and a.opens_at is not null and now() >= a.opens_at
      and (a.due_at is null or now() <= a.due_at)
      and w.status = 'published' and w.kind = 'teaching'
  ) then raise exception 'File activity is unavailable or its deadline passed' using errcode = '22023'; end if;
  for item in select value from jsonb_array_elements(p_files) loop
    if jsonb_typeof(item->'id') <> 'string' or jsonb_typeof(item->'sha256') <> 'string'
      or (item->>'sha256') !~ '^[0-9a-f]{64}$' then raise exception 'Invalid verified file digest' using errcode = '22023'; end if;
    digest := item->>'sha256';
    select * into f from public.activity_submission_files where id = (item->>'id')::uuid and submission_id = s.id for update;
    if not found or f.expected_sha256 <> digest or not exists (select 1 from storage.objects o where o.bucket_id = 'activity-submissions'
      and o.name = f.storage_path and o.owner_id::text = s.student_id::text
      and (o.metadata->>'size')::bigint = f.size_bytes
      and o.metadata->>'mimetype' = f.content_type) then
      raise exception 'Uploaded file missing or metadata mismatch' using errcode = '22023';
    end if;
    update public.activity_submission_files set sha256 = digest where id = f.id;
  end loop;
  if exists (select 1 from public.activity_submission_files where submission_id = s.id and sha256 is null) then
    raise exception 'Unverified file remains' using errcode = '22023';
  end if;
  update public.submissions set status = 'submitted', submitted_at = now() where id = s.id;
  insert into app_private.audit_events(actor_id, action, target_id)
    values (s.student_id, 'activity_submission:submitted', s.id);
end;
$$;
create function public.finalize_activity_submission(p_submission_id uuid, p_files jsonb) returns void
language sql security invoker set search_path = '' as $$
  select app_private.finalize_activity_submission(p_submission_id, p_files);
$$;
create function app_private.cancel_activity_submission(p_submission_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.submissions;
begin
  if auth.role() <> 'service_role' then raise exception 'Trusted cleanup required' using errcode = '42501'; end if;
  select * into s from public.submissions where id = p_submission_id for update;
  if not found then return; end if;
  if s.submission_mode <> 'files' or s.status <> 'uploading'
    or exists (select 1 from storage.objects o join public.activity_submission_files f
      on f.storage_path = o.name where o.bucket_id = 'activity-submissions' and f.submission_id = s.id) then
    raise exception 'Only an empty pending submission can be cancelled' using errcode = '55000';
  end if;
  delete from public.activity_submission_files where submission_id = s.id;
  delete from public.submissions where id = s.id;
  insert into app_private.audit_events(actor_id, action, target_id)
    values (s.student_id, 'activity_submission:cancelled', s.id);
end;
$$;
create function public.cancel_activity_submission(p_submission_id uuid) returns void
language sql security invoker set search_path = '' as $$
  select app_private.cancel_activity_submission(p_submission_id);
$$;
revoke all on function app_private.reserve_activity_submission(uuid,uuid,jsonb),
  public.reserve_activity_submission(uuid,uuid,jsonb),
  app_private.finalize_activity_submission(uuid,jsonb), public.finalize_activity_submission(uuid,jsonb)
  from public, anon, authenticated;
revoke all on function app_private.cancel_activity_submission(uuid), public.cancel_activity_submission(uuid)
  from public, anon, authenticated;
grant execute on function app_private.reserve_activity_submission(uuid,uuid,jsonb),
  public.reserve_activity_submission(uuid,uuid,jsonb) to authenticated;
grant execute on function app_private.finalize_activity_submission(uuid,jsonb),
  public.finalize_activity_submission(uuid,jsonb) to service_role;
grant execute on function app_private.cancel_activity_submission(uuid),
  public.cancel_activity_submission(uuid) to service_role;
-- SECURITY INVOKER public wrappers execute their private callees as service_role.
-- Keep these privileged helpers unavailable to PUBLIC, anon, and authenticated.
grant execute on function app_private.finalize_activity_submission(uuid,jsonb),
  app_private.cancel_activity_submission(uuid) to service_role;

-- Preserve the established ranking source, adding only the new file-activity grade totals.
alter function app_private.leaderboard_base_rows(boolean, timestamptz)
  rename to leaderboard_base_rows_legacy;

create function app_private.scored_activity_grades(p_now timestamptz)
returns table(student_id uuid, submission_id uuid, activity_id uuid, submission_mode text, score numeric,
  rubric_score numeric, published_at timestamptz)
language sql stable security definer set search_path = '' as $$
  with latest as (
    select distinct on (g.submission_id) g.id, s.id as submission_id, s.student_id, s.activity_id, s.submission_mode,
      g.published_at, g.time_bonus_points, s.activity_snapshot
    from public.grades g
      join public.submissions s on s.id = g.submission_id
      join public.activities a on a.id = s.activity_id
      join public.academy_weeks w on w.id = a.week_id
    where g.status = 'published' and a.status = 'published'
      and w.status = 'published' and w.kind = 'teaching'
    order by g.submission_id, g.revision desc
  ), sums as (
    select l.id, l.submission_id, l.student_id, l.activity_id, l.submission_mode, l.published_at,
      l.time_bonus_points, l.activity_snapshot, a.max_score, sum(c.points)::numeric as rubric_score
    from latest l
      join public.activities a on a.id = l.activity_id
      join public.grade_criterion_scores c on c.grade_id = l.id
    group by l.id, l.submission_id, l.student_id, l.activity_id, l.submission_mode, l.published_at,
      l.time_bonus_points, l.activity_snapshot, a.max_score
  ), final_scores as (
    select s.*, least(coalesce(nullif(s.activity_snapshot->>'max_score', '')::numeric, s.max_score),
      s.rubric_score + s.time_bonus_points)::numeric as final_score
    from sums s
  ), best as (
    select distinct on (student_id, activity_id) * from final_scores
    order by student_id, activity_id, final_score desc, published_at asc, id
  )
  select b.student_id, b.submission_id, b.activity_id, b.submission_mode, b.final_score,
    least(coalesce(nullif(b.activity_snapshot->>'max_score', '')::numeric, b.max_score), b.rubric_score), b.published_at
  from best b
$$;

create function app_private.leaderboard_base_rows(p_weekly boolean, p_now timestamptz)
returns table(student_id uuid, points numeric, activities bigint, tie_activities bigint,
  completed_at timestamptz, fallback_alias text)
language plpgsql stable security definer set search_path = '' as $$
declare scoring_period integer;
begin
  if to_regclass('public.point_awards') is null then
    return query
      with totals as (
        select s.student_id, sum(s.score)::numeric as points, count(*)::bigint as activities,
          max(s.published_at) as completed_at
        from app_private.scored_activity_grades(p_now) s
        where not coalesce(p_weekly, false)
          or date_trunc('week', s.published_at) = date_trunc('week', p_now)
        group by s.student_id
      )
      select p.id, t.points, t.activities, t.activities, t.completed_at,
        coalesce(to_jsonb(p)->>'leaderboard_name', 'Learner ' || substr(md5(p.id::text), 1, 10))
      from totals t
        join public.profiles p on p.id = t.student_id
        join app_private.user_roles r on r.user_id = p.id
        join auth.users u on u.id = p.id
      where app_private.leaderboard_enabled() and p.registered_at is not null
        and r.role = 'student' and u.email_confirmed_at is not null
        and (to_jsonb(u)->>'deleted_at') is null
        and (nullif(to_jsonb(u)->>'banned_until', '')::timestamptz is null
          or (to_jsonb(u)->>'banned_until')::timestamptz <= p_now);
    return;
  end if;
  if to_regprocedure('app_private.scoring_week(timestamp with time zone)') is null then
    raise exception 'Reviewed scoring calendar required' using errcode = '55000';
  end if;
  scoring_period := coalesce(app_private.scoring_week(p_now), 1);
  return query
    with existing as (
      select * from app_private.leaderboard_base_rows_legacy(p_weekly, p_now)
    ), scored as (
      select * from app_private.scored_activity_grades(p_now)
    ), file_totals as (
      -- Production grade triggers already write each rubric score to point_awards.
      -- Add only the capped time bonus here, or the grade is counted twice. Keep
      -- that bonus in the same scoring week as its canonical rubric award even
      -- when review happens after the activity's scoring week has closed.
      select s.student_id, sum(s.score - s.rubric_score)::numeric as points, 0::bigint as activities,
        max(s.published_at) as completed_at
      from scored s
      where s.submission_mode = 'files'
        and (not coalesce(p_weekly, false) or
          (exists (select 1 from public.point_awards pa
              where pa.student_id = s.student_id and pa.submission_id = s.submission_id
                and pa.scoring_week = scoring_period)
            and p_now >= app_private.scoring_start(scoring_period)))
      group by s.student_id
    ), notebook_bonuses as (
      select s.student_id, sum(s.score - s.rubric_score)::numeric as points,
        max(s.published_at) as completed_at
      from scored s where s.submission_mode = 'notebook'
        and (not coalesce(p_weekly, false) or
          (exists (select 1 from public.point_awards pa
              where pa.student_id = s.student_id and pa.submission_id = s.submission_id
                and pa.scoring_week = scoring_period)
            and p_now >= app_private.scoring_start(scoring_period)))
      group by s.student_id
    ), merged as (
      select coalesce(e.student_id, f.student_id, n.student_id) as student_id,
        coalesce(e.points, 0) + coalesce(f.points, 0) + coalesce(n.points, 0) as points,
        coalesce(e.activities, 0) + coalesce(f.activities, 0) as activities,
        coalesce(e.tie_activities, 0) as tie_activities,
        greatest(e.completed_at, f.completed_at, n.completed_at) as completed_at,
        coalesce(e.fallback_alias, 'Learner ' || substr(md5(coalesce(e.student_id, f.student_id, n.student_id)::text), 1, 10)) as fallback_alias
      from existing e full join file_totals f using (student_id)
        full join notebook_bonuses n using (student_id)
    )
    select * from merged;
end;
$$;
revoke all on function app_private.leaderboard_base_rows(boolean,timestamptz),
  app_private.leaderboard_base_rows_legacy(boolean,timestamptz),
  app_private.scored_activity_grades(timestamptz) from public, anon, authenticated;

-- Keep the public leaderboard response private except for a row-specific boolean.
create or replace function app_private.academy_leaderboard(p_weekly boolean default false) returns jsonb
language sql stable security definer set search_path = '' as $$
  with checkpoint as materialized (
    select app_private.leaderboard_reference_time() as at
  ), graded_totals as (
    select t.* from checkpoint c cross join lateral app_private.leaderboard_base_rows(p_weekly, c.at) t
  ), award_totals as (
    select student_id, sum(points)::numeric as points from app_private.manual_point_awards
    cross join checkpoint c
    where app_private.manual_award_in_leaderboard_period(p_weekly, created_at, c.at)
    group by student_id
  ), totals as (
    select coalesce(g.student_id, a.student_id) as student_id,
      coalesce(g.points, 0) + coalesce(a.points, 0) as points,
      coalesce(g.activities, 0)::bigint as activities,
      coalesce(g.tie_activities, 0)::bigint as tie_activities,
      g.completed_at, g.fallback_alias, g.student_id is not null as base_eligible
    from graded_totals g full join award_totals a using (student_id)
  ), eligible as (
    select t.*, coalesce(t.fallback_alias, to_jsonb(p)->>'leaderboard_name',
      'Learner ' || substr(md5(t.student_id::text), 1, 10)) as display_alias
    from totals t join public.profiles p on p.id = t.student_id
      join app_private.user_roles r on r.user_id = t.student_id join auth.users u on u.id = t.student_id
    where p.registered_at is not null and r.role = 'student' and u.email_confirmed_at is not null
      and ((to_regclass('public.point_awards') is not null and t.base_eligible)
        or (to_regclass('public.point_awards') is null
          and (to_jsonb(u)->>'deleted_at') is null
          and (nullif(to_jsonb(u)->>'banned_until', '')::timestamptz is null
            or (to_jsonb(u)->>'banned_until')::timestamptz <= now())))
  ), ranked as (
    select rank() over(order by e.points desc, e.tie_activities desc, e.completed_at asc nulls last) as rank,
      row_number() over(order by e.points desc, e.tie_activities desc, e.completed_at asc nulls last, e.student_id) as stable_order,
      case when p.public_full_name_consent and p.public_full_name_consent_at is not null
        then p.full_name else e.display_alias end as alias,
      e.points, e.activities, coalesce(e.student_id = auth.uid(), false) as is_you
    from eligible e join public.profiles p on p.id = e.student_id
  ) select case when app_private.leaderboard_enabled()
    then coalesce(jsonb_agg(jsonb_build_object('rank', rank, 'alias', alias, 'points', points,
      'activities', activities, 'is_you', is_you) order by stable_order), '[]'::jsonb)
    else '[]'::jsonb end
    from ranked;
$$;
create or replace function public.academy_leaderboard(p_weekly boolean default false) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select app_private.academy_leaderboard(p_weekly);
$$;

create function app_private.academy_leaderboard_period() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  at_time timestamptz := app_private.leaderboard_reference_time();
  period_number integer;
  period_start timestamptz;
  period_end timestamptz;
begin
  if to_regclass('public.point_awards') is not null then
    if to_regprocedure('app_private.scoring_week(timestamp with time zone)') is null
      or to_regprocedure('app_private.scoring_start(integer)') is null then
      raise exception 'Reviewed scoring period functions are required' using errcode = '55000';
    end if;
    period_number := coalesce(app_private.scoring_week(at_time), 1);
    period_start := app_private.scoring_start(period_number);
    period_end := app_private.scoring_start(period_number + 1);
  else
    period_start := date_trunc('week', at_time);
    period_end := period_start + interval '7 days';
  end if;
  if period_start is null or period_end is null or period_start >= period_end then
    raise exception 'Invalid scoring period boundaries' using errcode = '55000';
  end if;
  return jsonb_build_object('start', period_start, 'end', period_end,
    'timezone', 'Asia/Amman', 'period', period_number);
end;
$$;
create function public.academy_leaderboard_period() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select app_private.academy_leaderboard_period();
$$;
revoke all on function app_private.academy_leaderboard(boolean), public.academy_leaderboard(boolean),
  app_private.academy_leaderboard_period(), public.academy_leaderboard_period() from public, anon, authenticated;
grant execute on function app_private.academy_leaderboard(boolean), public.academy_leaderboard(boolean),
  app_private.academy_leaderboard_period(), public.academy_leaderboard_period() to anon, authenticated, service_role;

commit;
