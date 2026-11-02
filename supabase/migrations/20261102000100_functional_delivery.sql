-- Local implementation only. Hosted application and capability activation need owner approval.
begin;
alter table public.submissions add column notebook_sha256 text
  check (notebook_sha256 ~ '^[0-9a-f]{64}$');
alter table public.submissions add column notebook_bytes integer
  check (notebook_bytes between 1 and 262144);

-- This separate gate controls the trusted service. NEVER open the legacy browser-upload gate.
create function app_private.submission_service_enabled() returns boolean
language sql immutable set search_path = '' as $$ select false; $$;
create function app_private.leaderboard_enabled() returns boolean
language sql immutable set search_path = '' as $$ select false; $$;
create function public.academy_capabilities() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('submissions', app_private.submission_service_enabled(),
    'leaderboard', app_private.leaderboard_enabled());
$$;

create index audit_submission_requests_idx on app_private.audit_events(actor_id,created_at)
  where action='submission:request';
create function app_private.claim_submission_request(p_student_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not app_private.submission_service_enabled() then raise exception 'Submissions closed' using errcode='42501'; end if;
  perform 1 from public.profiles p join auth.users u on u.id=p.id join app_private.user_roles r on r.user_id=p.id
    where p.id=p_student_id and p.registered_at is not null and u.email_confirmed_at is not null and r.role='student' for update of p;
  if not found then raise exception 'Registered Student required' using errcode='42501'; end if;
  if (select count(*) from app_private.audit_events where actor_id=p_student_id and action='submission:request' and created_at>now()-interval '1 minute')>=10
    or (select count(*) from app_private.audit_events where actor_id=p_student_id and action='submission:request' and created_at>now()-interval '1 day')>=60 then
    raise exception 'Request quota reached' using errcode='54000'; end if;
  insert into app_private.audit_events(actor_id,action,target_id) values(p_student_id,'submission:request',p_student_id);
end;
$$;
create function public.claim_submission_request(p_student_id uuid) returns void
language sql security invoker set search_path='' as $$ select app_private.claim_submission_request(p_student_id); $$;

create function app_private.reserve_notebook(
  p_student_id uuid, p_activity_id uuid, p_request_id uuid, p_sha256 text, p_bytes integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare existing public.submissions; rubric uuid; attempts integer; previous_status text;
begin
  if not app_private.submission_service_enabled() then raise exception 'Submissions closed' using errcode='42501'; end if;
  if p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$' or p_bytes is null or p_bytes not between 1 and 262144 or p_request_id is null then
    raise exception 'Invalid notebook metadata' using errcode='22023'; end if;
  -- Per-student lock serializes quota checks and concurrent retries.
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
  select r.id into rubric from public.rubrics r join public.activities a on a.id=r.activity_id
    join public.academy_weeks w on w.id=a.week_id
    where a.id=p_activity_id and a.status='published' and w.status='published'
      and w.kind='teaching' and r.status='published' and (a.due_at is null or now()<=a.due_at)
    order by r.version desc limit 1;
  if rubric is null then raise exception 'Published activity/rubric within deadline required' using errcode='22023'; end if;
  select count(*) into attempts from public.submissions where student_id=p_student_id and activity_id=p_activity_id;
  if attempts>=2 then raise exception 'Attempt quota reached' using errcode='22023'; end if;
  if attempts>0 then
    select status into previous_status from public.submissions where student_id=p_student_id and activity_id=p_activity_id order by attempt desc limit 1;
    if previous_status<>'resubmission_required' then raise exception 'Team resubmission request required' using errcode='22023'; end if;
  end if;
  insert into public.submissions(id,student_id,activity_id,rubric_id,attempt,notebook_sha256,notebook_bytes)
    values(p_request_id,p_student_id,p_activity_id,rubric,attempts+1,p_sha256,p_bytes) returning * into existing;
  return jsonb_build_object('id',existing.id,'path',existing.object_path,'status',existing.status);
end;
$$;
create function public.reserve_notebook(p_student_id uuid,p_activity_id uuid,p_request_id uuid,p_sha256 text,p_bytes integer)
returns jsonb language sql security invoker set search_path='' as $$
  select app_private.reserve_notebook(p_student_id,p_activity_id,p_request_id,p_sha256,p_bytes);
$$;
create function app_private.finalize_notebook(p_submission_id uuid,p_sha256 text) returns void
language plpgsql security definer set search_path='' as $$
declare s public.submissions;
begin
  if not app_private.submission_service_enabled() then raise exception 'Submissions closed' using errcode='42501'; end if;
  select * into s from public.submissions where id=p_submission_id for update;
  if not found or s.notebook_sha256 is distinct from p_sha256 then raise exception 'Reservation mismatch' using errcode='22023'; end if;
  if s.status='submitted' then return; end if;
  if s.status<>'uploading' then raise exception 'Reservation is not pending' using errcode='22023'; end if;
  if not exists(select 1 from storage.objects o where o.bucket_id='student-submissions' and o.name=s.object_path
    and (o.metadata->>'size')::bigint=s.notebook_bytes
    and o.metadata->>'mimetype' in ('application/x-ipynb+json','application/json')) then
    raise exception 'Validated object is missing or metadata mismatches' using errcode='22023'; end if;
  update public.submissions set status='submitted',submitted_at=now() where id=s.id;
  insert into app_private.audit_events(actor_id,action,target_id) values(s.student_id,'submission:submitted',s.id);
end;
$$;
create function public.finalize_notebook(p_submission_id uuid,p_sha256 text) returns void
language sql security invoker set search_path='' as $$ select app_private.finalize_notebook(p_submission_id,p_sha256); $$;

create function app_private.request_resubmission(p_submission_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not app_private.is_team() then raise exception 'Team required' using errcode='42501'; end if;
  update public.submissions set status='resubmission_required' where id=p_submission_id
    and status in ('submitted','under_review','reviewed') and attempt<2;
  if not found then raise exception 'Eligible submission not found' using errcode='22023'; end if;
  insert into app_private.audit_events(actor_id,action,target_id) values(auth.uid(),'submission:resubmission_requested',p_submission_id);
end;
$$;
create function public.request_resubmission(p_submission_id uuid) returns void
language sql security invoker set search_path='' as $$ select app_private.request_resubmission(p_submission_id); $$;

create function app_private.save_draft_rubric(p_rubric_id uuid,p_criteria jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare criterion jsonb; position integer:=0; rubric_status text;
begin
  if not app_private.is_team() then raise exception 'Team required' using errcode='42501'; end if;
  select status into rubric_status from public.rubrics where id=p_rubric_id for update;
  if not found or rubric_status<>'draft' then raise exception 'Editable draft required' using errcode='22023'; end if;
  if p_criteria is null or jsonb_typeof(p_criteria)<>'array' or jsonb_array_length(p_criteria) not between 1 and 30 then
    raise exception 'One to thirty criteria required' using errcode='22023'; end if;
  delete from public.rubric_criteria where rubric_id=p_rubric_id;
  for criterion in select value from jsonb_array_elements(p_criteria) loop
    if jsonb_typeof(criterion->'label_ar') is distinct from 'string' or jsonb_typeof(criterion->'label_en') is distinct from 'string'
      or jsonb_typeof(criterion->'max_points') is distinct from 'number' then raise exception 'Invalid criterion' using errcode='22023'; end if;
    if (criterion->>'max_points')::numeric<=0 or (criterion->>'max_points')::numeric>999999
      or (criterion->>'max_points')::numeric<>round((criterion->>'max_points')::numeric,2) then
      raise exception 'Invalid criterion score precision or range' using errcode='22023'; end if;
    insert into public.rubric_criteria(rubric_id,label_ar,label_en,max_points,sort_order)
      values(p_rubric_id,criterion->>'label_ar',criterion->>'label_en',(criterion->>'max_points')::numeric,position);
    position:=position+1;
  end loop;
end;
$$;
create function public.save_draft_rubric(p_rubric_id uuid,p_criteria jsonb) returns void
language sql security invoker set search_path='' as $$ select app_private.save_draft_rubric(p_rubric_id,p_criteria); $$;
create function app_private.create_draft_rubric(p_activity_id uuid,p_criteria jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare rubric uuid; next_version integer;
begin
  if not app_private.is_team() then raise exception 'Team required' using errcode='42501'; end if;
  perform 1 from public.activities where id=p_activity_id for update;
  if not found then raise exception 'Activity not found' using errcode='22023'; end if;
  select coalesce(max(version),0)+1 into next_version from public.rubrics where activity_id=p_activity_id;
  insert into public.rubrics(activity_id,version) values(p_activity_id,next_version) returning id into rubric;
  perform app_private.save_draft_rubric(rubric,p_criteria);
  return rubric;
end;
$$;
create function public.create_draft_rubric(p_activity_id uuid,p_criteria jsonb) returns uuid
language sql security invoker set search_path='' as $$ select app_private.create_draft_rubric(p_activity_id,p_criteria); $$;

-- Pseudonyms only: no real names, Auth UUIDs, email addresses or contact fields leave this projection.
create function app_private.academy_leaderboard() returns jsonb
language sql stable security definer set search_path='' as $$
  with latest as (
    select distinct on(g.submission_id) s.student_id,s.activity_id,g.id,g.published_at
    from public.grades g join public.submissions s on s.id=g.submission_id
    join public.activities a on a.id=s.activity_id join public.academy_weeks w on w.id=a.week_id
    join public.profiles p on p.id=s.student_id join app_private.user_roles r on r.user_id=p.id
    join auth.users u on u.id=p.id
    where app_private.leaderboard_enabled() and g.status='published' and a.status='published'
      and w.status='published' and w.kind='teaching' and p.registered_at is not null
      and r.role='student' and u.email_confirmed_at is not null
    order by g.submission_id,g.revision desc
  ), scored as (
    select l.student_id,l.activity_id,l.id,l.published_at,sum(c.points) as score
    from latest l join public.grade_criterion_scores c on c.grade_id=l.id group by l.student_id,l.activity_id,l.id,l.published_at
  ), best as (
    select distinct on(student_id,activity_id) * from scored order by student_id,activity_id,score desc,published_at asc,id
  ), totals as (
    select student_id,sum(score) as points,count(*) as activities,max(published_at) as completed_at from best group by student_id
  ), ranked as (
    select row_number() over(order by points desc,activities desc,completed_at asc,student_id) as rank,
      'Learner '||substr(md5(student_id::text),1,10) as alias,points,activities from totals
  ) select coalesce(jsonb_agg(to_jsonb(ranked) order by rank),'[]'::jsonb) from ranked;
$$;
create function public.academy_leaderboard() returns jsonb
language sql stable security invoker set search_path='' as $$ select app_private.academy_leaderboard(); $$;

revoke all on function app_private.submission_service_enabled(),app_private.leaderboard_enabled(),app_private.academy_leaderboard(),
  app_private.reserve_notebook(uuid,uuid,uuid,text,integer),app_private.finalize_notebook(uuid,text),app_private.request_resubmission(uuid)
  from public,anon,authenticated;
grant usage on schema app_private to anon,service_role;
grant execute on function app_private.submission_service_enabled(),app_private.leaderboard_enabled(),app_private.academy_leaderboard() to anon,authenticated,service_role;
grant execute on function app_private.reserve_notebook(uuid,uuid,uuid,text,integer),app_private.finalize_notebook(uuid,text) to service_role;
grant execute on function app_private.request_resubmission(uuid) to authenticated;
revoke all on function public.reserve_notebook(uuid,uuid,uuid,text,integer),public.finalize_notebook(uuid,text),
  public.request_resubmission(uuid),public.academy_capabilities(),public.academy_leaderboard() from public,anon,authenticated;
grant execute on function public.reserve_notebook(uuid,uuid,uuid,text,integer),public.finalize_notebook(uuid,text) to service_role;
grant execute on function public.request_resubmission(uuid) to authenticated;
grant execute on function public.academy_capabilities(),public.academy_leaderboard() to anon,authenticated,service_role;
revoke all on function app_private.claim_submission_request(uuid),public.claim_submission_request(uuid) from public,anon,authenticated;
grant execute on function app_private.claim_submission_request(uuid),public.claim_submission_request(uuid) to service_role;
revoke all on function app_private.save_draft_rubric(uuid,jsonb),app_private.create_draft_rubric(uuid,jsonb),
  public.save_draft_rubric(uuid,jsonb),public.create_draft_rubric(uuid,jsonb) from public,anon,authenticated;
grant execute on function app_private.save_draft_rubric(uuid,jsonb),app_private.create_draft_rubric(uuid,jsonb),
  public.save_draft_rubric(uuid,jsonb),public.create_draft_rubric(uuid,jsonb) to authenticated;
commit;
