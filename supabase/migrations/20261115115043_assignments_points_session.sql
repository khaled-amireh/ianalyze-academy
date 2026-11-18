-- Extends the existing activity/submission/review system. Local validation only;
-- production application requires the owner's explicit approval.
begin;
alter table public.activities alter column week_id drop not null;
alter table public.activities
 add column assignment_mode boolean not null default false,
 add column publish_at timestamptz,
 add column submission_type text not null default 'file' check(submission_type in ('file','link','either')),
 add column reference_links text not null default '' check(length(reference_links)<=5000),
 add column phases jsonb not null default '[]',
 add column accepting boolean not null default true,
 add column archived boolean not null default false,
 add column sort_order integer not null default 0,
 add column version integer not null default 1;
alter table public.submissions alter column rubric_id drop not null;
alter table public.grades alter column rubric_id drop not null;
alter table public.submissions
 add column assignment_submission boolean not null default false,
 add column link_url text,
 add column attachment_path text unique,
 add column file_name text,
 add column file_mime text,
 add column file_bytes bigint,
 add column phase_snapshot jsonb,
 add column max_eligible_points numeric(8,2);
create unique index assignment_one_submission on public.submissions(student_id,activity_id) where assignment_submission;
alter table public.grades add column awarded_points numeric(8,2) check(awarded_points>=0 and awarded_points<>'NaN'::numeric);
alter table public.profiles add column leaderboard_name text check(length(trim(leaderboard_name)) between 1 and 80);
grant update(leaderboard_name) on public.profiles to authenticated;

create function app_private.club_week(p_time timestamptz) returns date
language sql immutable set search_path='' as $$ select date_trunc('week',p_time at time zone 'Asia/Amman')::date; $$;
create function app_private.safe_http_links(p_text text) returns boolean
language sql immutable set search_path='' as $$
 select not exists(select 1 from regexp_split_to_table(coalesce(p_text,''),E'\n') v where trim(v)<>'' and trim(v)!~'^https?://[^[:space:]@]+$');
$$;

create function app_private.assignment_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare item jsonb; prior_end timestamptz; first_start timestamptz; last_end timestamptz; cap numeric;
begin
 if tg_op='DELETE' then
   if old.assignment_mode and (old.status<>'draft' or exists(select 1 from public.submissions where activity_id=old.id)) then
     raise exception 'Only unused drafts may be deleted; archive instead' using errcode='22023'; end if;
   return old;
 end if;
 if tg_op='UPDATE' and new.assignment_mode is distinct from old.assignment_mode then raise exception 'Activity kind is immutable' using errcode='22023'; end if;
 if not new.assignment_mode then return new; end if;
 if new.week_id is not null or not app_private.safe_http_links(new.reference_links) or length(new.instructions_en)>10000 or length(new.instructions_ar)>10000 then raise exception 'Invalid assignment' using errcode='22023'; end if;
 if jsonb_typeof(new.phases) is distinct from 'array' or jsonb_array_length(new.phases) not between 1 and 20 then raise exception 'One to twenty phases required' using errcode='22023'; end if;
 for item in select value from jsonb_array_elements(new.phases) order by (value->>'start')::timestamptz loop
   if coalesce(length(trim(item->>'name')),0) not between 1 and 100 or jsonb_typeof(item->'points') is distinct from 'number'
     or (item->>'points')::numeric<0 or (item->>'points')::numeric>999999 or (item->>'points')::numeric<>round((item->>'points')::numeric,2)
     or not isfinite((item->>'start')::timestamptz) or not isfinite((item->>'end')::timestamptz)
     or (item->>'start')::timestamptz is null or (item->>'end')::timestamptz is null
     or (item->>'start')::timestamptz >= (item->>'end')::timestamptz
     or (prior_end is not null and (item->>'start')::timestamptz<prior_end) then raise exception 'Invalid or overlapping phases' using errcode='22023'; end if;
   first_start=coalesce(first_start,(item->>'start')::timestamptz); prior_end=(item->>'end')::timestamptz; last_end=prior_end;
   cap=greatest(coalesce(cap,0),(item->>'points')::numeric);
 end loop;
 if new.publish_at is null or new.due_at is null or not isfinite(new.publish_at) or not isfinite(new.due_at)
   or new.publish_at>=new.due_at or first_start<new.publish_at or last_end>new.due_at then raise exception 'Phases must fit the publication/deadline window' using errcode='22023'; end if;
 new.max_score=greatest(0.01,cap);
 if tg_op='UPDATE' then
   if exists(select 1 from public.submissions where activity_id=old.id) and
     (new.phases is distinct from old.phases or new.submission_type<>old.submission_type or new.publish_at is distinct from old.publish_at or new.due_at is distinct from old.due_at) then
     raise exception 'Submissions lock phases, dates and submission type' using errcode='22023'; end if;
   new.version=old.version+1;
 end if;
 return new;
end; $$;
create trigger assignment_validated before insert or update or delete on public.activities for each row execute function app_private.assignment_guard();
drop policy activity_read on public.activities;
create policy activity_read on public.activities for select to authenticated using(app_private.is_team() or
 (app_private.is_registered() and status='published' and not archived and
 ((assignment_mode and publish_at<=now()) or (not assignment_mode and exists(select 1 from public.academy_weeks w where w.id=week_id and w.status='published')))));

create function app_private.save_assignment(p_data jsonb,p_version integer,p_id uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid; existing public.activities;
begin
 if not app_private.is_team() then raise exception 'Team required' using errcode='42501'; end if;
 if p_id is not null then
  select * into existing from public.activities where id=p_id and assignment_mode for update;
  if not found or existing.version is distinct from p_version then raise exception 'Assignment changed; reload' using errcode='40001'; end if;
  update public.activities set title_en=trim(p_data->>'title_en'),title_ar=trim(p_data->>'title_ar'),instructions_en=coalesce(p_data->>'instructions_en',''),instructions_ar=coalesce(p_data->>'instructions_ar',''),
   publish_at=(p_data->>'publish_at')::timestamptz,due_at=(p_data->>'due_at')::timestamptz,phases=p_data->'phases',submission_type=p_data->>'submission_type',reference_links=coalesce(p_data->>'reference_links',''),
   status=p_data->>'status',accepting=(p_data->>'accepting')::boolean,archived=(p_data->>'archived')::boolean,sort_order=(p_data->>'sort_order')::integer where id=p_id returning id into result;
 else
  insert into public.activities(assignment_mode,title_en,title_ar,instructions_en,instructions_ar,max_score,publish_at,due_at,phases,submission_type,reference_links,status,accepting,archived,sort_order)
  values(true,trim(p_data->>'title_en'),trim(p_data->>'title_ar'),coalesce(p_data->>'instructions_en',''),coalesce(p_data->>'instructions_ar',''),1,(p_data->>'publish_at')::timestamptz,(p_data->>'due_at')::timestamptz,p_data->'phases',p_data->>'submission_type',coalesce(p_data->>'reference_links',''),p_data->>'status',(p_data->>'accepting')::boolean,(p_data->>'archived')::boolean,(p_data->>'sort_order')::integer) returning id into result;
 end if;
 return result;
end; $$;

create function app_private.assignment_window(p_activity uuid) returns public.activities
language plpgsql security definer set search_path='' as $$
declare a public.activities; instant timestamptz;
begin
 if not app_private.is_registered() or app_private.current_role()<>'student' then raise exception 'Registered Student required' using errcode='42501'; end if;
 select * into a from public.activities where id=p_activity and assignment_mode for update;
 instant=clock_timestamp();
 if not found or a.status<>'published' or a.archived or not a.accepting or instant<a.publish_at or instant>=a.due_at then raise exception 'Submissions are closed' using errcode='22023'; end if;
 if not exists(select 1 from jsonb_array_elements(a.phases) x where instant>=(x->>'start')::timestamptz and instant<(x->>'end')::timestamptz) then raise exception 'No active submission phase' using errcode='22023'; end if;
 return a;
end; $$;

create function app_private.submit_assignment(p_activity uuid,p_request uuid,p_link text default null,p_file jsonb default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare a public.activities; s public.submissions; ext text; mime text; bytes bigint; phase jsonb; instant timestamptz;
begin
 if not app_private.is_registered() or app_private.current_role()<>'student' then raise exception 'Registered Student required' using errcode='42501'; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 select * into s from public.submissions where student_id=auth.uid() and activity_id=p_activity and assignment_submission;
 if found then
  if s.status<>'uploading' then return s.id; end if;
  if p_file is not null and s.file_name=p_file->>'name' and s.file_mime=p_file->>'mime' and s.file_bytes=(p_file->>'bytes')::bigint then return s.id; end if;
  raise exception 'Finish the existing upload using the same file' using errcode='22023';
 end if;
 a=app_private.assignment_window(p_activity);
 if p_request is null then raise exception 'Request identifier required' using errcode='22023'; end if;
 if p_file is null then
  if a.submission_type='file' or coalesce(length(trim(p_link)),0) not between 1 and 2000 or trim(p_link)~'[[:space:]]' or not app_private.safe_http_links(p_link) then raise exception 'Valid submission link required' using errcode='22023'; end if;
  instant=clock_timestamp();
  select x into phase from jsonb_array_elements(a.phases) x where instant>=(x->>'start')::timestamptz and instant<(x->>'end')::timestamptz;
  if phase is null or instant>=a.due_at then raise exception 'Submissions closed' using errcode='22023'; end if;
  insert into public.submissions(id,student_id,activity_id,assignment_submission,status,link_url,phase_snapshot,max_eligible_points,submitted_at)
   values(p_request,auth.uid(),a.id,true,'submitted',trim(p_link),phase,(phase->>'points')::numeric,instant) returning id into p_request;
 else
  if a.submission_type='link' then raise exception 'Link submission required' using errcode='22023'; end if;
  ext=lower(substring(p_file->>'name' from '\.([^.]+)$')); mime=p_file->>'mime'; bytes=(p_file->>'bytes')::bigint;
  if coalesce(length(p_file->>'name'),0) not between 1 and 200 or bytes is null or bytes not between 1 and 20971520 or
   not coalesce((ext='pdf' and mime='application/pdf') or (ext='csv' and mime='text/csv') or
    (ext='xlsx' and mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') or
    (ext in ('pbix','zip') and mime in ('application/zip','application/x-zip-compressed','application/octet-stream')),false) then raise exception 'Unsupported file or size (20 MiB maximum)' using errcode='22023'; end if;
  insert into public.submissions(id,student_id,activity_id,assignment_submission,attachment_path,file_name,file_mime,file_bytes)
   values(p_request,auth.uid(),a.id,true,auth.uid()::text||'/'||a.id::text||'/'||p_request::text||'/assignment.'||ext,p_file->>'name',mime,bytes);
 end if;
 return p_request;
end; $$;
create function app_private.finalize_assignment(p_submission uuid) returns void language plpgsql security definer set search_path='' as $$
declare s public.submissions; a public.activities; instant timestamptz; phase jsonb;
begin
 if not app_private.is_registered() then raise exception 'Registration required' using errcode='42501'; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 select * into s from public.submissions where id=p_submission and student_id=auth.uid() and assignment_submission for update;
 if not found then raise exception 'Own submission required' using errcode='42501'; end if;
 if s.status<>'uploading' then return; end if;
 a=app_private.assignment_window(s.activity_id);
 if not exists(select 1 from storage.objects o where o.bucket_id='student-submissions' and o.name=s.attachment_path and
   (o.metadata->>'size')::bigint=s.file_bytes and o.metadata->>'mimetype'=s.file_mime) then raise exception 'Uploaded file metadata mismatch' using errcode='22023'; end if;
 instant=clock_timestamp();
 select x into phase from jsonb_array_elements(a.phases) x where instant>=(x->>'start')::timestamptz and instant<(x->>'end')::timestamptz;
 if phase is null or instant>=a.due_at then raise exception 'Submissions closed' using errcode='22023'; end if;
 update public.submissions set status='submitted',phase_snapshot=phase,max_eligible_points=(phase->>'points')::numeric,submitted_at=instant where id=s.id;
end; $$;

-- Same private bucket, additive format support. Existing notebook service limits
-- and all legacy policies stay in force. No public URLs or overwrite policies.
update storage.buckets set file_size_limit=20971520,allowed_mime_types=array['application/x-ipynb+json','application/json','application/pdf','text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/zip','application/x-zip-compressed','application/octet-stream'] where id='student-submissions' and not public;
create policy assignment_upload on storage.objects for insert to authenticated with check(bucket_id='student-submissions' and app_private.is_registered() and exists(
 select 1 from public.submissions s join public.activities a on a.id=s.activity_id where s.attachment_path=name and s.student_id=auth.uid() and s.assignment_submission and s.status='uploading' and a.status='published' and not a.archived and a.accepting and clock_timestamp()>=a.publish_at and clock_timestamp()<a.due_at));
create policy assignment_download on storage.objects for select to authenticated using(bucket_id='student-submissions' and exists(
 select 1 from public.submissions s where s.attachment_path=name and s.assignment_submission and s.status<>'uploading' and (app_private.is_team() or (s.student_id=auth.uid() and app_private.is_registered()))));

create table public.point_awards(
 student_id uuid not null references public.profiles(id) on delete cascade,
 source_key text not null,
 points numeric(10,2) not null check(points>=0 and points<>'NaN'::numeric),
 period_start date not null,
 submission_id uuid references public.submissions(id),
 dataset_attempt_id uuid references public.week1_datasets(id),
 reviewed_by uuid not null references public.profiles(id),
 reviewed_at timestamptz not null default now(),
 primary key(student_id,source_key)
);
create index point_awards_week on public.point_awards(period_start,student_id);
alter table public.point_awards enable row level security;
revoke all on public.point_awards from public,anon,authenticated;
grant select on public.point_awards to authenticated;
create policy awards_read on public.point_awards for select to authenticated using(app_private.is_team() or (student_id=auth.uid() and app_private.is_registered()));
create function app_private.sync_activity_award(p_student uuid,p_activity uuid) returns void language plpgsql security definer set search_path='' as $$
declare chosen record; period date;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_student::text||p_activity::text,0));
 select q.* into chosen from (
  select distinct on(s.id) s.id,g.id as grade_id,g.reviewer_id,g.published_at,
   coalesce(g.awarded_points,(select sum(c.points) from public.grade_criterion_scores c where c.grade_id=g.id),0) as points
  from public.submissions s join public.grades g on g.submission_id=s.id and g.status='published'
  where s.student_id=p_student and s.activity_id=p_activity order by s.id,g.revision desc
 ) q order by q.points desc,q.published_at,q.grade_id limit 1;
 if not found then return; end if;
 select app_private.club_week(coalesce(a.publish_at,'2026-11-19 10:00:00+03'::timestamptz+(coalesce(w.week_number,1)-1)*interval '1 week')) into period from public.activities a left join public.academy_weeks w on w.id=a.week_id where a.id=p_activity;
 insert into public.point_awards(student_id,source_key,points,period_start,submission_id,reviewed_by,reviewed_at)
 values(p_student,'assignment:'||p_activity::text,chosen.points,period,chosen.id,chosen.reviewer_id,chosen.published_at)
 on conflict(student_id,source_key) do update set points=excluded.points,submission_id=excluded.submission_id,reviewed_by=excluded.reviewed_by,reviewed_at=excluded.reviewed_at;
end; $$;
create function app_private.sync_review_award() returns trigger language plpgsql security definer set search_path='' as $$
declare s public.submissions;
begin
 if tg_table_name='grades' then select * into s from public.submissions where id=new.submission_id;
 else select sub.* into s from public.submissions sub join public.grades g on g.submission_id=sub.id where g.id=new.grade_id; end if;
 perform app_private.sync_activity_award(s.student_id,s.activity_id); return new;
end; $$;
create trigger grade_points after insert on public.grades for each row execute function app_private.sync_review_award();
create trigger criterion_points after insert on public.grade_criterion_scores for each row execute function app_private.sync_review_award();
do $$ declare s record; begin for s in select distinct student_id,activity_id from public.submissions loop perform app_private.sync_activity_award(s.student_id,s.activity_id); end loop; end; $$;

create function app_private.review_assignment(p_submission uuid,p_points numeric,p_feedback text,p_revision integer) returns uuid
language plpgsql security definer set search_path='' as $$
declare s public.submissions; latest integer; result uuid;
begin
 if not app_private.is_team() then raise exception 'Team required' using errcode='42501'; end if;
 select * into s from public.submissions where id=p_submission and assignment_submission for update;
 if not found or s.status not in ('submitted','reviewed') then raise exception 'Finalized assignment required' using errcode='22023'; end if;
 select coalesce(max(revision),0) into latest from public.grades where submission_id=s.id;
 if latest is distinct from p_revision then raise exception 'Review changed; reload' using errcode='40001'; end if;
 if p_points is null or p_points='NaN'::numeric or p_points<0 or p_points>s.max_eligible_points or p_points<>round(p_points,2) then raise exception 'Points outside original phase maximum' using errcode='22023'; end if;
 insert into public.grades(submission_id,reviewer_id,revision,feedback,status,published_at,awarded_points)
 values(s.id,auth.uid(),latest+1,coalesce(p_feedback,''),'published',clock_timestamp(),p_points) returning id into result;
 return result;
end; $$;
create function app_private.approve_dataset_participation(p_attempt uuid) returns void language plpgsql security definer set search_path='' as $$
declare s public.week1_datasets;
begin
 if not app_private.is_team() then raise exception 'Team required' using errcode='42501'; end if;
 select * into s from public.week1_datasets where id=p_attempt and status='submitted';
 if not found then raise exception 'Submitted dataset required' using errcode='22023'; end if;
 insert into public.point_awards(student_id,source_key,points,period_start,dataset_attempt_id,reviewed_by)
 values(s.student_id,'dataset:week1',5,app_private.club_week('2026-11-19 10:00:00+03'),s.id,auth.uid()) on conflict(student_id,source_key) do nothing;
end; $$;

-- Existing private JSON remains private. A separate, whitelisted projection
-- never contains organizer notes or unpublished topics. Nothing is auto-published.
alter table public.week1_session drop constraint week1_session_id_check;
alter table public.week1_session add check(id between 1 and 999);
create table public.session_public_content(
 week_number integer primary key references public.week1_session(id),
 published boolean not null default false,
 topics jsonb not null default '[]'
);
alter table public.session_public_content enable row level security;
revoke all on public.session_public_content from public,anon,authenticated;
grant select on public.session_public_content to authenticated;
create policy session_public_read on public.session_public_content for select to authenticated using(app_private.is_team() or (published and app_private.is_registered()));
create function app_private.save_session_content(p_week integer,p_topics jsonb,p_published boolean,p_version integer) returns void
language plpgsql security definer set search_path='' as $$
declare item jsonb; old_topics jsonb; projection jsonb;
begin
 if not app_private.is_team() then raise exception 'Team required' using errcode='42501'; end if;
 if p_week is null or p_week not between 1 and 999 or p_published is null or jsonb_typeof(p_topics) is distinct from 'array' or jsonb_array_length(p_topics)>100 or octet_length(p_topics::text)>500000 then raise exception 'Invalid session' using errcode='22023'; end if;
 for item in select value from jsonb_array_elements(p_topics) loop
  if jsonb_typeof(item) is distinct from 'object' or coalesce(length(trim(item->>'id')),0) not between 1 and 100 or
   coalesce(length(trim(item->>'title_en')),0) not between 1 and 200 or coalesce(length(trim(item->>'title_ar')),0) not between 1 and 200 or
   coalesce(item->>'status','') not in ('planned','completed') or coalesce(length(item->>'description'),10001)>10000 or coalesce(length(item->>'notes'),10001)>10000 or coalesce(length(item->>'links'),5001)>5000 or
   (item ? 'visible' and jsonb_typeof(item->'visible')<>'boolean') or not app_private.safe_http_links(item->>'links') then raise exception 'Invalid topic' using errcode='22023'; end if;
 end loop;
 if (select count(distinct value->>'id') from jsonb_array_elements(p_topics))<>jsonb_array_length(p_topics) then raise exception 'Duplicate topic IDs' using errcode='22023'; end if;
 if p_version=0 then insert into public.week1_session(id,topics,updated_by) values(p_week,p_topics,auth.uid()) on conflict do nothing;
  if not found then raise exception 'Session changed; reload' using errcode='40001'; end if;
 else update public.week1_session set topics=p_topics,version=version+1,updated_by=auth.uid(),updated_at=now() where id=p_week and version=p_version;
  if not found then raise exception 'Session changed; reload' using errcode='40001'; end if;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',t->>'id','title_en',t->>'title_en','title_ar',t->>'title_ar','description',t->>'description','links',t->>'links','status',t->>'status') order by ord),'[]') into projection from jsonb_array_elements(p_topics) with ordinality x(t,ord) where coalesce((t->>'visible')::boolean,false);
 insert into public.session_public_content(week_number,published,topics) values(p_week,p_published,projection) on conflict(week_number) do update set published=excluded.published,topics=excluded.topics;
end; $$;
-- Preserve compatibility for existing private-editor callers; saving does not publish.
create or replace function app_private.week1_save_session(p_topics jsonb,p_version integer) returns void language plpgsql security definer set search_path='' as $$
begin perform app_private.save_session_content(1,p_topics,coalesce((select published from public.session_public_content where week_number=1),false),p_version); end; $$;

-- One authoritative ranking source, independent of assignment visibility. Hiding
-- or archiving never removes earned points. Names are explicitly opt-in.
create or replace function app_private.leaderboard_enabled() returns boolean language sql immutable set search_path='' as $$ select true; $$;
drop function public.academy_leaderboard();
drop function app_private.academy_leaderboard();
create function app_private.academy_leaderboard(p_weekly boolean default false) returns jsonb language sql stable security definer set search_path='' as $$
 with totals as(
  select p.id,coalesce(p.leaderboard_name,'Learner '||substr(md5(p.id::text),1,10)) as alias,sum(a.points) as points,count(*) as activities
  from public.point_awards a join public.profiles p on p.id=a.student_id join app_private.user_roles r on r.user_id=p.id join auth.users u on u.id=p.id
  where app_private.leaderboard_enabled() and p.registered_at is not null and r.role='student' and u.email_confirmed_at is not null and (not p_weekly or a.period_start=app_private.club_week(now()))
  group by p.id having sum(a.points)>0
 ),ranked as(select row_number() over(order by points desc,id) as rank,alias,points,activities from totals)
 select coalesce(jsonb_agg(to_jsonb(ranked) order by rank),'[]') from ranked;
$$;
create function public.academy_leaderboard(p_weekly boolean default false) returns jsonb language sql stable security invoker set search_path='' as $$ select app_private.academy_leaderboard(p_weekly); $$;

create function public.save_assignment(p_data jsonb,p_version integer,p_id uuid default null) returns uuid language sql security invoker set search_path='' as $$ select app_private.save_assignment(p_data,p_version,p_id); $$;
create function app_private.move_assignment(p_id uuid,p_direction integer,p_version integer) returns void language plpgsql security definer set search_path='' as $$
declare ids uuid[]; position integer; other uuid; i integer;
begin
 if not app_private.is_team() then raise exception 'Team required' using errcode='42501'; end if;
 if p_direction is null or p_direction not in (-1,1) then raise exception 'Invalid direction' using errcode='22023'; end if;
 perform id from public.activities where assignment_mode order by id for update;
 if not exists(select 1 from public.activities where id=p_id and assignment_mode and version=p_version) then raise exception 'Assignment changed; reload' using errcode='40001'; end if;
 select array_agg(id order by sort_order,id) into ids from public.activities where assignment_mode and not archived;
 position=array_position(ids,p_id);
 if position is null or position+p_direction not between 1 and cardinality(ids) then return; end if;
 other=ids[position+p_direction]; ids[position+p_direction]=p_id; ids[position]=other;
 for i in 1..cardinality(ids) loop update public.activities set sort_order=i where id=ids[i]; end loop;
end; $$;
create function public.move_assignment(p_id uuid,p_direction integer,p_version integer) returns void language sql security invoker set search_path='' as $$ select app_private.move_assignment(p_id,p_direction,p_version); $$;
revoke all on function public.move_assignment(uuid,integer,integer),app_private.move_assignment(uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.move_assignment(uuid,integer,integer),app_private.move_assignment(uuid,integer,integer) to authenticated;
create function public.submit_assignment(p_activity uuid,p_request uuid,p_link text default null,p_file jsonb default null) returns uuid language sql security invoker set search_path='' as $$ select app_private.submit_assignment(p_activity,p_request,p_link,p_file); $$;
create function public.finalize_assignment(p_submission uuid) returns void language sql security invoker set search_path='' as $$ select app_private.finalize_assignment(p_submission); $$;
create function public.review_assignment(p_submission uuid,p_points numeric,p_feedback text,p_revision integer) returns uuid language sql security invoker set search_path='' as $$ select app_private.review_assignment(p_submission,p_points,p_feedback,p_revision); $$;
create function public.approve_dataset_participation(p_attempt uuid) returns void language sql security invoker set search_path='' as $$ select app_private.approve_dataset_participation(p_attempt); $$;
create function public.save_session_content(p_week integer,p_topics jsonb,p_published boolean,p_version integer) returns void language sql security invoker set search_path='' as $$ select app_private.save_session_content(p_week,p_topics,p_published,p_version); $$;
revoke all on function app_private.club_week(timestamptz),app_private.safe_http_links(text),app_private.assignment_guard(),app_private.assignment_window(uuid),app_private.sync_activity_award(uuid,uuid),app_private.sync_review_award() from public,anon,authenticated;
revoke all on function public.save_assignment(jsonb,integer,uuid),app_private.save_assignment(jsonb,integer,uuid),public.submit_assignment(uuid,uuid,text,jsonb),app_private.submit_assignment(uuid,uuid,text,jsonb),public.finalize_assignment(uuid),app_private.finalize_assignment(uuid),public.review_assignment(uuid,numeric,text,integer),app_private.review_assignment(uuid,numeric,text,integer),public.approve_dataset_participation(uuid),app_private.approve_dataset_participation(uuid),public.save_session_content(integer,jsonb,boolean,integer),app_private.save_session_content(integer,jsonb,boolean,integer),public.academy_leaderboard(boolean),app_private.academy_leaderboard(boolean) from public,anon,authenticated;
grant execute on function public.save_assignment(jsonb,integer,uuid),app_private.save_assignment(jsonb,integer,uuid),public.submit_assignment(uuid,uuid,text,jsonb),app_private.submit_assignment(uuid,uuid,text,jsonb),public.finalize_assignment(uuid),app_private.finalize_assignment(uuid),public.review_assignment(uuid,numeric,text,integer),app_private.review_assignment(uuid,numeric,text,integer),public.approve_dataset_participation(uuid),app_private.approve_dataset_participation(uuid),public.save_session_content(integer,jsonb,boolean,integer),app_private.save_session_content(integer,jsonb,boolean,integer) to authenticated;
grant execute on function public.academy_leaderboard(boolean),app_private.academy_leaderboard(boolean) to anon,authenticated,service_role;
commit;
