-- The numbered club calendar starts on Thursday 19 November. Its opening
-- period is one day; later weeks run Friday 00:00 to Friday 00:00, Asia/Amman.
-- Existing Monday period_start values and approved amounts are NOT rewritten.
create function app_private.scoring_now() returns timestamptz language sql volatile
set search_path='' as $$ select clock_timestamp(); $$;
create function app_private.scoring_week(p_time timestamptz) returns integer
language sql immutable set search_path='' as $$
 select case when p_time < '2026-11-19 00:00 Asia/Amman'::timestamptz then null
 when p_time < '2026-11-20 00:00 Asia/Amman'::timestamptz then 1
 else 2+floor(((p_time at time zone 'Asia/Amman')::date-date '2026-11-20')::numeric/7)::integer end;
$$;
create function app_private.scoring_start(p_week integer) returns timestamptz
language sql immutable set search_path='' as $$
 select (case when p_week=1 then date '2026-11-19'
 else date '2026-11-20'+(p_week-2)*7 end)::timestamp at time zone 'Asia/Amman';
$$;
create function app_private.scoring_source_week(p_submission uuid,p_dataset uuid,p_source text) returns integer
language sql stable security definer set search_path='' as $$
 select app_private.scoring_week(case when p_source='dataset:week1' and p_dataset is not null
 then '2026-11-19 10:00 Asia/Amman'::timestamptz else (
 select coalesce(a.publish_at,'2026-11-19 10:00 Asia/Amman'::timestamptz+(coalesce(w.week_number,1)-1)*interval '1 week')
 from public.submissions s join public.activities a on a.id=s.activity_id
 left join public.academy_weeks w on w.id=a.week_id where s.id=p_submission) end);
$$;
alter table public.point_awards add column scoring_week integer check(scoring_week>=1);
update public.point_awards set scoring_week=app_private.scoring_source_week(submission_id,dataset_attempt_id,source_key);
comment on column public.point_awards.period_start is 'Preserved legacy Monday label; numbered Friday scoring uses scoring_week, derived from source publication/session time.';
create index point_awards_scoring_week on public.point_awards(scoring_week,student_id);

-- Private, append-only audit projections of the single authoritative award
-- ledger. No names, contact details, files or feedback are copied here.
create table app_private.scoring_award_events(
 id bigint generated always as identity primary key,
 student_id uuid not null, source_key text not null, scoring_week integer,
 delta numeric(10,2) not null, points_after numeric(10,2) not null,
 recorded_at timestamptz not null, kind text not null check(kind in('approved','corrected','removed','legacy')),
 legacy_period_start date not null
);
create index scoring_events_period on app_private.scoring_award_events(scoring_week,student_id,recorded_at,id);
create table app_private.scoring_membership_events(
 id bigint generated always as identity primary key, student_id uuid not null,
 eligible boolean not null, banned_until timestamptz, effective_at timestamptz not null
);
create index scoring_membership_cutoff on app_private.scoring_membership_events(student_id,effective_at desc,id desc);
alter table app_private.scoring_award_events enable row level security;
alter table app_private.scoring_membership_events enable row level security;
revoke all on app_private.scoring_award_events,app_private.scoring_membership_events from public,anon,authenticated;
insert into app_private.scoring_award_events(student_id,source_key,scoring_week,delta,points_after,recorded_at,kind,legacy_period_start)
 select student_id,source_key,scoring_week,points,points,reviewed_at,'legacy',period_start from public.point_awards;
insert into app_private.scoring_membership_events(student_id,eligible,banned_until,effective_at)
 select p.id,p.registered_at is not null and r.role='student' and u.email_confirmed_at is not null
 and (to_jsonb(u)->>'deleted_at') is null,
 nullif(to_jsonb(u)->>'banned_until','')::timestamptz,
 greatest(coalesce(p.registered_at,p.created_at),coalesce(u.email_confirmed_at,p.created_at),r.changed_at)
 from public.profiles p join app_private.user_roles r on r.user_id=p.id join auth.users u on u.id=p.id;

create function app_private.scoring_award_guard() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then new.scoring_week=app_private.scoring_source_week(new.submission_id,new.dataset_attempt_id,new.source_key);
 else new.scoring_week=old.scoring_week; end if;
 return new;
end; $$;
create trigger scoring_period before insert or update on public.point_awards for each row execute function app_private.scoring_award_guard();
create function app_private.scoring_award_changed() returns trigger
language plpgsql security definer set search_path='' as $$
declare who uuid; source text; wk integer; before_points numeric=0; after_points numeric=0; legacy date;
begin
 if tg_op='UPDATE' and new is not distinct from old then return new; end if;
 if tg_op<>'INSERT' then before_points=old.points; end if;
 if tg_op='DELETE' then who=old.student_id;source=old.source_key;wk=old.scoring_week;legacy=old.period_start;
 else who=new.student_id;source=new.source_key;wk=new.scoring_week;legacy=new.period_start;after_points=new.points; end if;
 insert into app_private.scoring_award_events(student_id,source_key,scoring_week,delta,points_after,recorded_at,kind,legacy_period_start)
 values(who,source,wk,after_points-before_points,after_points,app_private.scoring_now(),
 case tg_op when 'INSERT' then 'approved' when 'DELETE' then 'removed' else 'corrected' end,legacy);
 return coalesce(new,old);
end; $$;
create trigger scoring_audit after insert or update or delete on public.point_awards for each row execute function app_private.scoring_award_changed();
create function app_private.scoring_membership_changed() returns trigger
language plpgsql security definer set search_path='' as $$
declare who uuid; allowed boolean=false; banned timestamptz; prior app_private.scoring_membership_events;
begin
 who=coalesce(to_jsonb(new)->>'id',to_jsonb(new)->>'user_id',to_jsonb(old)->>'id',to_jsonb(old)->>'user_id')::uuid;
 select p.registered_at is not null and r.role='student' and u.email_confirmed_at is not null
  and (to_jsonb(u)->>'deleted_at') is null,nullif(to_jsonb(u)->>'banned_until','')::timestamptz
 into allowed,banned from public.profiles p join app_private.user_roles r on r.user_id=p.id join auth.users u on u.id=p.id where p.id=who;
 allowed=coalesce(allowed,false);
 select * into prior from app_private.scoring_membership_events where student_id=who order by effective_at desc,id desc limit 1;
 if not found or prior.eligible is distinct from allowed or prior.banned_until is distinct from banned then
  insert into app_private.scoring_membership_events(student_id,eligible,banned_until,effective_at)
  values(who,allowed,banned,app_private.scoring_now());
 end if;
 return coalesce(new,old);
end; $$;
create trigger scoring_profile_membership after insert or update or delete on public.profiles for each row execute function app_private.scoring_membership_changed();
create trigger scoring_role_membership after insert or update or delete on app_private.user_roles for each row execute function app_private.scoring_membership_changed();
create trigger scoring_auth_membership after insert or update or delete on auth.users for each row execute function app_private.scoring_membership_changed();

-- Read-only deterministic archives need no visitor/cron at rollover. Original
-- points use immutable audit events strictly before the period end. Later
-- changes are explicit revisions, never silently substituted into the original.
create function app_private.rankings_at(p_view text,p_week integer,p_now timestamptz) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare wk integer; first_at timestamptz; end_at timestamptz; max_week integer; rows jsonb; periods jsonb; adjustments jsonb='[]'; revision bigint=1;
begin
 if p_view is null or p_view not in('all','current','archive') then raise exception 'Invalid ranking view' using errcode='22023'; end if;
 max_week=coalesce(app_private.scoring_week(p_now),1);
 wk=case when p_view='archive' then p_week else max_week end;
 if wk is null or wk<1 or wk>max_week then raise exception 'Invalid scoring week' using errcode='22023'; end if;
 first_at=app_private.scoring_start(wk);end_at=app_private.scoring_start(wk+1);
 if p_view='archive' and end_at>p_now then raise exception 'Week has not closed' using errcode='22023'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('week',n,'start',app_private.scoring_start(n),'end',app_private.scoring_start(n+1)) order by n desc),'[]')
 into periods from generate_series(1,max_week) n where app_private.scoring_start(n+1)<=p_now;
 with membership as (
  select distinct on(student_id) student_id,eligible,banned_until from app_private.scoring_membership_events
  where effective_at<end_at order by student_id,effective_at desc,id desc
 ), eligible as (
  select p.id,coalesce(p.leaderboard_name,'Learner '||substr(md5(p.id::text),1,10)) as alias
  from public.profiles p join auth.users u on u.id=p.id join app_private.user_roles r on r.user_id=p.id
  left join membership m on m.student_id=p.id
  where app_private.leaderboard_enabled() and p.registered_at is not null and u.email_confirmed_at is not null and r.role='student'
  and (to_jsonb(u)->>'deleted_at') is null and (nullif(to_jsonb(u)->>'banned_until','')::timestamptz is null or (to_jsonb(u)->>'banned_until')::timestamptz<=p_now)
  and (p_view<>'archive' or (m.eligible and (m.banned_until is null or m.banned_until<end_at)))
 ), totals as (
  select student_id,sum(points) points,count(*) activities from public.point_awards
  where p_view='all' or (scoring_week=wk and (p_view='archive' or p_now>=first_at)) group by student_id
 ), originals as (
  select student_id,sum(delta) points from app_private.scoring_award_events
  where scoring_week=wk and recorded_at<end_at group by student_id
 ), ranked as (
  select row_number() over(order by coalesce(t.points,0) desc,e.id) as rank,e.alias,
   coalesce(t.points,0) points,coalesce(t.activities,0) activities,
   coalesce(o.points,0) original_points,row_number() over(order by coalesce(o.points,0) desc,e.id) original_rank,
   coalesce(t.points,0)-coalesce(o.points,0) adjustment_points
  from eligible e left join totals t on t.student_id=e.id left join originals o on o.student_id=e.id
 ) select coalesce(jsonb_agg(to_jsonb(ranked) order by rank),'[]') into rows from ranked;
 if p_view='archive' then
  select 1+count(*) into revision from app_private.scoring_award_events where scoring_week=wk and recorded_at>=end_at;
  with membership as (
   select distinct on(student_id) student_id,eligible,banned_until from app_private.scoring_membership_events
   where effective_at<end_at order by student_id,effective_at desc,id desc
  ) select coalesce(jsonb_agg(jsonb_build_object('alias',coalesce(p.leaderboard_name,'Learner '||substr(md5(p.id::text),1,10)),
    'delta',e.delta,'at',e.recorded_at,'kind',e.kind) order by e.recorded_at,e.id),'[]') into adjustments
   from app_private.scoring_award_events e join membership m on m.student_id=e.student_id
   join public.profiles p on p.id=e.student_id join app_private.user_roles r on r.user_id=p.id join auth.users u on u.id=p.id
   where e.scoring_week=wk and e.recorded_at>=end_at and m.eligible and (m.banned_until is null or m.banned_until<end_at)
   and r.role='student' and p.registered_at is not null and u.email_confirmed_at is not null and (to_jsonb(u)->>'deleted_at') is null
   and (nullif(to_jsonb(u)->>'banned_until','')::timestamptz is null or (to_jsonb(u)->>'banned_until')::timestamptz<=p_now);
 end if;
 return jsonb_build_object('view',p_view,'server_time',p_now,'rows',rows,'periods',periods,
  'period',jsonb_build_object('week',wk,'start',first_at,'end',end_at,'state',case when p_now<first_at then 'upcoming' when p_now>=end_at then 'closed' else 'current' end),
  'revision',revision,'adjustments',adjustments);
end; $$;
create function app_private.academy_rankings(p_view text,p_week integer) returns jsonb
language sql volatile security definer set search_path='' as $$ select app_private.rankings_at(p_view,p_week,app_private.scoring_now()); $$;
create function public.academy_rankings(p_view text default 'all',p_week integer default null) returns jsonb
language sql volatile security invoker set search_path='' as $$ select app_private.academy_rankings(p_view,p_week); $$;
create or replace function app_private.academy_leaderboard(p_weekly boolean default false) returns jsonb
language sql volatile security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('rank',r->'rank','alias',r->'alias','points',r->'points','activities',r->'activities') order by (r->>'rank')::bigint),'[]')
 from jsonb_array_elements(app_private.academy_rankings(case when p_weekly then 'current' else 'all' end,null)->'rows') r;
$$;
-- The legacy gate is constant false. Pinning its path changes no feature gate.
alter function app_private.uploads_enabled() set search_path='';
revoke all on function app_private.scoring_now(),app_private.scoring_week(timestamptz),app_private.scoring_start(integer),app_private.scoring_source_week(uuid,uuid,text),app_private.scoring_award_guard(),app_private.scoring_award_changed(),app_private.scoring_membership_changed(),app_private.rankings_at(text,integer,timestamptz) from public,anon,authenticated;
revoke all on function app_private.academy_rankings(text,integer),public.academy_rankings(text,integer) from public,anon,authenticated;
grant execute on function app_private.academy_rankings(text,integer),public.academy_rankings(text,integer) to anon,authenticated,service_role;
