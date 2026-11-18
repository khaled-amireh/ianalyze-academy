-- Preserve the existing public alias contract and approved award ledger. Start
-- from eligible profiles so a missing award (including in this week) means zero.
-- Neither private profile fields nor the internal deterministic tie key is returned.
create or replace function app_private.academy_leaderboard(p_weekly boolean default false)
returns jsonb language sql stable security definer set search_path='' as $$
 with awards as (
  select student_id, sum(points) as points, count(*) as activities
  from public.point_awards
  where not p_weekly or period_start=app_private.club_week(now())
  group by student_id
 ), eligible as (
  select p.id,
   coalesce(p.leaderboard_name,'Learner '||substr(md5(p.id::text),1,10)) as alias,
   coalesce(a.points,0) as points, coalesce(a.activities,0) as activities
  from public.profiles p
  join app_private.user_roles r on r.user_id=p.id and r.role='student'
  join auth.users u on u.id=p.id and u.email_confirmed_at is not null
  left join awards a on a.student_id=p.id
  where app_private.leaderboard_enabled() and p.registered_at is not null
 ), ranked as (
  select row_number() over(order by points desc,id) as rank,alias,points,activities
  from eligible
 )
 select coalesce(jsonb_agg(to_jsonb(ranked) order by rank),'[]') from ranked;
$$;
revoke all on function app_private.academy_leaderboard(boolean) from public;
grant execute on function app_private.academy_leaderboard(boolean) to anon,authenticated,service_role;
