-- Path B: append-only, idempotent Admin awards added to current grade totals.
begin;

create table app_private.manual_point_awards (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete restrict,
  admin_id uuid not null references auth.users(id) on delete restrict,
  points integer not null check (points > 0),
  reason text not null check (length(trim(reason)) between 1 and 500),
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  unique (admin_id, idempotency_key)
);
create index manual_point_awards_student_created_idx
  on app_private.manual_point_awards(student_id, created_at desc, id);
alter table app_private.manual_point_awards enable row level security;
revoke all on app_private.manual_point_awards from public, anon, authenticated;

create function app_private.reject_manual_award_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Manual award history is append-only' using errcode = '42501';
end;
$$;
create trigger manual_point_awards_append_only
before update or delete on app_private.manual_point_awards
for each row execute function app_private.reject_manual_award_mutation();

create function app_private.admin_award_points(
  p_student_id uuid, p_points integer, p_reason text, p_idempotency_key uuid
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := (select auth.uid()); award_id uuid; prior app_private.manual_point_awards;
begin
  if not app_private.is_admin() then raise exception 'Application Admin required' using errcode = '42501'; end if;
  if p_student_id is null or p_points is null or p_points <= 0 or p_idempotency_key is null
    or p_reason is null or length(trim(p_reason)) not between 1 and 500 then
    raise exception 'Positive whole points, a reason and an idempotency key are required' using errcode = '22023';
  end if;
  perform 1 from public.profiles p join auth.users u on u.id = p.id
    join app_private.user_roles r on r.user_id = p.id
  where p.id = p_student_id and p.registered_at is not null
    and u.email_confirmed_at is not null and r.role = 'student'
  for update of p;
  if not found then raise exception 'Registered verified Student not found' using errcode = '22023'; end if;
  insert into app_private.manual_point_awards(student_id, admin_id, points, reason, idempotency_key)
  values (p_student_id, actor_id, p_points, trim(p_reason), p_idempotency_key)
  on conflict (admin_id, idempotency_key) do nothing returning id into award_id;
  if award_id is not null then return award_id; end if;
  select * into prior from app_private.manual_point_awards
  where admin_id = actor_id and idempotency_key = p_idempotency_key;
  if prior.student_id is distinct from p_student_id or prior.points is distinct from p_points
    or prior.reason is distinct from trim(p_reason) then
    raise exception 'Idempotency key already used for a different award' using errcode = '22023';
  end if;
  return prior.id;
end;
$$;
create function public.admin_award_points(
  p_student_id uuid, p_points integer, p_reason text, p_idempotency_key uuid
) returns uuid
language sql security invoker set search_path = '' as $$
  select app_private.admin_award_points(p_student_id, p_points, p_reason, p_idempotency_key);
$$;

create function app_private.admin_award_history(p_student_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app_private.is_admin() then raise exception 'Application Admin required' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id, 'student_id', a.student_id, 'admin_id', a.admin_id,
      'points', a.points, 'reason', a.reason, 'created_at', a.created_at
    ) order by a.created_at desc, a.id)
    from app_private.manual_point_awards a
    where p_student_id is null or a.student_id = p_student_id
  ), '[]'::jsonb);
end;
$$;
create function public.admin_award_history(p_student_id uuid default null) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select app_private.admin_award_history(p_student_id);
$$;

create function app_private.admin_award_students() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app_private.is_admin() then raise exception 'Application Admin required' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', p.id, 'full_name', p.full_name, 'email', p.email)
      order by p.full_name, p.id)
    from public.profiles p join app_private.user_roles r on r.user_id = p.id
      join auth.users u on u.id = p.id
    where p.registered_at is not null and u.email_confirmed_at is not null and r.role = 'student'
  ), '[]'::jsonb);
end;
$$;
create function public.admin_award_students() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select app_private.admin_award_students();
$$;

create function app_private.manual_award_in_leaderboard_period(p_weekly boolean, p_created_at timestamptz, p_now timestamptz)
returns boolean language plpgsql stable set search_path = '' as $$
declare scoring_period integer;
begin
  if not coalesce(p_weekly, false) then return true; end if;
  if to_regclass('public.point_awards') is not null then
    scoring_period := coalesce(app_private.scoring_week(p_now), 1);
    return app_private.scoring_week(p_created_at) = scoring_period
      and p_now >= app_private.scoring_start(scoring_period);
  end if;
  return date_trunc('week', p_created_at) = date_trunc('week', p_now);
end;
$$;
revoke all on function app_private.manual_award_in_leaderboard_period(boolean,timestamptz,timestamptz)
  from public, anon, authenticated;

create or replace function app_private.academy_leaderboard(p_weekly boolean default false) returns jsonb
language sql stable security definer set search_path = '' as $$
  with checkpoint as materialized (
    select app_private.leaderboard_reference_time() as at
  ), graded_totals as (
    select t.* from checkpoint c cross join lateral app_private.leaderboard_base_rows(p_weekly,c.at) t
  ), award_totals as (
    select student_id,sum(points)::numeric as points from app_private.manual_point_awards
    cross join checkpoint c
    where app_private.manual_award_in_leaderboard_period(p_weekly, created_at, c.at)
    group by student_id
  ), totals as (
    select coalesce(g.student_id,a.student_id) as student_id,
      coalesce(g.points,0)+coalesce(a.points,0) as points,
      coalesce(g.activities,0)::bigint as activities,coalesce(g.tie_activities,0)::bigint as tie_activities,
      g.completed_at,g.fallback_alias,g.student_id is not null as base_eligible
    from graded_totals g full join award_totals a using(student_id)
  ), eligible as (
    select t.*,coalesce(t.fallback_alias,to_jsonb(p)->>'leaderboard_name',
      'Learner '||substr(md5(t.student_id::text),1,10)) as display_alias
    from totals t join public.profiles p on p.id=t.student_id
      join app_private.user_roles r on r.user_id=t.student_id join auth.users u on u.id=t.student_id
    where p.registered_at is not null and r.role='student' and u.email_confirmed_at is not null
      and ((to_regclass('public.point_awards') is not null and t.base_eligible)
        or (to_regclass('public.point_awards') is null
          and (to_jsonb(u)->>'deleted_at') is null
          and (nullif(to_jsonb(u)->>'banned_until','')::timestamptz is null
            or (to_jsonb(u)->>'banned_until')::timestamptz <= now())))
  ), ranked as (
    select row_number() over(order by e.points desc,e.tie_activities desc,e.completed_at asc nulls last,e.student_id) as rank,
      case when p.public_full_name_consent and p.public_full_name_consent_at is not null
        then p.full_name else e.display_alias end as alias,
      e.points,e.activities
    from eligible e join public.profiles p on p.id=e.student_id
  ) select case when app_private.leaderboard_enabled()
    then coalesce(jsonb_agg(to_jsonb(ranked) order by rank),'[]'::jsonb) else '[]'::jsonb end
    from ranked;
$$;

revoke all on function app_private.admin_award_points(uuid,integer,text,uuid),
  app_private.admin_award_history(uuid), public.admin_award_points(uuid,integer,text,uuid),
  app_private.admin_award_students(), public.admin_award_history(uuid),
  public.admin_award_students() from public, anon, authenticated;
grant execute on function app_private.admin_award_points(uuid,integer,text,uuid),
  app_private.admin_award_history(uuid), app_private.admin_award_students() to authenticated;
grant execute on function public.admin_award_points(uuid,integer,text,uuid),
  public.admin_award_history(uuid), public.admin_award_students() to authenticated;
commit;
