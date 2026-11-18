-- Apply the existing public leaderboard gate to adjustment metadata too.
create or replace function app_private.rankings_at(p_view text,p_week integer,p_now timestamptz) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare wk integer; first_at timestamptz; end_at timestamptz; max_week integer; rows jsonb; periods jsonb; adjustments jsonb='[]'; revision bigint=1; privacy_updates bigint=0;
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
 ), original_ranks as (
  select m.student_id,row_number() over(order by coalesce(o.points,0) desc,m.student_id) as rank
  from membership m left join originals o on o.student_id=m.student_id
  where m.eligible and (m.banned_until is null or m.banned_until<end_at)
 ), ranked as (
  select row_number() over(order by coalesce(t.points,0) desc,e.id) as rank,e.alias,
   coalesce(t.points,0) points,coalesce(t.activities,0) activities,
   coalesce(o.points,0) original_points,coalesce(h.rank,0) original_rank,
   coalesce(t.points,0)-coalesce(o.points,0) adjustment_points
  from eligible e left join totals t on t.student_id=e.id left join originals o on o.student_id=e.id left join original_ranks h on h.student_id=e.id
 ) select coalesce(jsonb_agg(to_jsonb(ranked) order by rank),'[]') into rows from ranked;
 if p_view='archive' then
  with cutoff as (
   select distinct on(student_id) student_id,eligible,banned_until from app_private.scoring_membership_events
   where effective_at<end_at order by student_id,effective_at desc,id desc
  ) select count(*) into privacy_updates from app_private.scoring_membership_events e join cutoff m on m.student_id=e.student_id
   where e.effective_at>=end_at and m.eligible and (m.banned_until is null or m.banned_until<end_at);
  select 1+count(*) into revision from app_private.scoring_award_events where scoring_week=wk and recorded_at>=end_at;
  revision=revision+privacy_updates;
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
 if not app_private.leaderboard_enabled() then rows='[]'; adjustments='[]'; privacy_updates=0; revision=1; end if;
 return jsonb_build_object('view',p_view,'server_time',p_now,'rows',rows,'periods',periods,
  'period',jsonb_build_object('week',wk,'start',first_at,'end',end_at,'state',case when p_now<first_at then 'upcoming' when p_now>=end_at then 'closed' else 'current' end),
  'revision',revision,'privacy_updates',privacy_updates,'adjustments',adjustments);
end; $$;
