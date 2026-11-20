-- Separate append-only ledger for Admin-only discretionary awards.
begin;

create table app_private.manual_point_awards (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id) on delete restrict,
  student_id uuid not null references public.profiles(id) on delete restrict,
  amount numeric(15,0) not null check (amount > 0 and amount = trunc(amount) and amount <> 'NaN'::numeric),
  reason text not null check (length(trim(reason)) between 1 and 1000),
  idempotency_key uuid not null,
  scoring_week integer not null default app_private.scoring_week(now()),
  created_at timestamptz not null default now(),
  constraint manual_point_awards_actor_key unique (actor_id, idempotency_key)
);
create index manual_point_awards_student_created on app_private.manual_point_awards(student_id, created_at desc, id);
alter table app_private.manual_point_awards enable row level security;
revoke all on app_private.manual_point_awards from public, anon, authenticated;
create policy manual_point_awards_admin_read on app_private.manual_point_awards
  for select to authenticated using (app_private.is_admin());
grant select on app_private.manual_point_awards to authenticated;

create function app_private.reject_manual_award_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'Manual award history is append-only' using errcode = '55000'; end;
$$;
create trigger manual_point_awards_append_only before update or delete on app_private.manual_point_awards
  for each row execute function app_private.reject_manual_award_mutation();

create function app_private.admin_award_points(
  p_student uuid, p_amount numeric, p_reason text, p_idempotency_key uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare existing app_private.manual_point_awards; result uuid;
begin
  if not app_private.is_admin() then raise exception 'Application Admin required' using errcode = '42501'; end if;
  if p_student is null or p_idempotency_key is null or p_amount is null
    or p_amount <= 0 or p_amount <> trunc(p_amount) or p_amount > 999999999999999
    or p_amount = 'NaN'::numeric or p_reason is null or length(trim(p_reason)) not between 1 and 1000 then
    raise exception 'Invalid award request' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.profiles p join auth.users u on u.id = p.id
      join app_private.user_roles r on r.user_id = p.id
    where p.id = p_student and p.registered_at is not null and u.email_confirmed_at is not null
      and r.role = 'student' and (to_jsonb(u)->>'deleted_at') is null
  ) then raise exception 'Eligible registered student required' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));
  select * into existing from app_private.manual_point_awards
    where actor_id = auth.uid() and idempotency_key = p_idempotency_key;
  if found then
    if existing.student_id <> p_student or existing.amount <> p_amount or existing.reason <> trim(p_reason) then
      raise exception 'Idempotency key reused with different request' using errcode = '22023';
    end if;
    return existing.id;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_student::text, 1));
  insert into app_private.manual_point_awards(actor_id, student_id, amount, reason, idempotency_key)
    values (auth.uid(), p_student, p_amount, trim(p_reason), p_idempotency_key) returning id into result;
  return result;
end;
$$;
create function public.admin_award_points(
  p_student uuid, p_amount numeric, p_reason text, p_idempotency_key uuid
) returns uuid language sql security invoker set search_path = '' as $$
  select app_private.admin_award_points(p_student, p_amount, p_reason, p_idempotency_key);
$$;

create function app_private.admin_search_students(p_query text default '')
returns table(student_id uuid, full_name text, points numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app_private.is_admin() then raise exception 'Application Admin required' using errcode = '42501'; end if;
  return query
    select p.id, p.full_name,
      coalesce((select sum(a.points) from public.point_awards a where a.student_id = p.id), 0)
      + coalesce((select sum(m.amount) from app_private.manual_point_awards m where m.student_id = p.id), 0)
    from public.profiles p join auth.users u on u.id = p.id join app_private.user_roles r on r.user_id = p.id
    where p.registered_at is not null and u.email_confirmed_at is not null and r.role = 'student'
      and (to_jsonb(u)->>'deleted_at') is null
      and (nullif(trim(p_query), '') is null or p.full_name ilike '%' || trim(p_query) || '%')
    order by p.full_name, p.id limit 50;
end;
$$;
create function public.admin_search_students(p_query text default '')
returns table(student_id uuid, full_name text, points numeric)
language sql security invoker set search_path = '' as $$
  select * from app_private.admin_search_students(p_query);
$$;

create function app_private.admin_point_award_history(p_student uuid default null)
returns table(id uuid, actor_name text, student_id uuid, student_name text, amount numeric, reason text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app_private.is_admin() then raise exception 'Application Admin required' using errcode = '42501'; end if;
  return query select a.id, actor.full_name, a.student_id, p.full_name, a.amount, a.reason, a.created_at
    from app_private.manual_point_awards a join public.profiles p on p.id = a.student_id
    join public.profiles actor on actor.id = a.actor_id
    where p_student is null or a.student_id = p_student order by a.created_at desc, a.id desc limit 200;
end;
$$;
create function public.admin_point_award_history(p_student uuid default null)
returns table(id uuid, actor_name text, student_id uuid, student_name text, amount numeric, reason text, created_at timestamptz)
language sql security invoker set search_path = '' as $$
  select * from app_private.admin_point_award_history(p_student);
$$;
revoke all on function app_private.admin_award_points(uuid,numeric,text,uuid),
  public.admin_award_points(uuid,numeric,text,uuid), app_private.admin_search_students(text),
  public.admin_search_students(text), app_private.admin_point_award_history(uuid),
  public.admin_point_award_history(uuid) from public, anon;
grant execute on function public.admin_award_points(uuid,numeric,text,uuid),
  public.admin_search_students(text), public.admin_point_award_history(uuid) to authenticated;
grant execute on function app_private.admin_award_points(uuid,numeric,text,uuid),
  app_private.admin_search_students(text), app_private.admin_point_award_history(uuid) to authenticated;

-- Include manual awards in all-time and weekly ranking totals, retaining the original ranking keys.
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
  select student_id,sum(points) points,sum(activities)::bigint activities from (
   select student_id,points,1 activities from public.point_awards
    where p_view='all' or (scoring_week=wk and (p_view='archive' or p_now>=first_at))
   union all
   select student_id,amount,0 from app_private.manual_point_awards
    where p_view='all' or (scoring_week=wk and (p_view='archive' or p_now>=first_at))
  ) earned group by student_id
 ), originals as (
  select student_id,sum(delta) points from (
    select student_id,delta from app_private.scoring_award_events
      where scoring_week=wk and recorded_at<end_at
    union all
    select student_id,amount from app_private.manual_point_awards
      where scoring_week=wk and created_at<end_at
  ) cutoff_awards group by student_id
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

create or replace function app_private.academy_leaderboard(p_weekly boolean default false)
returns jsonb language sql stable security definer set search_path='' as $$
 with eligible as (
  select p.id,coalesce(p.leaderboard_name,'Learner '||substr(md5(p.id::text),1,10)) as alias
  from public.profiles p join auth.users u on u.id=p.id join app_private.user_roles r on r.user_id=p.id
  where app_private.leaderboard_enabled() and p.registered_at is not null and r.role='student'
    and u.email_confirmed_at is not null and (to_jsonb(u)->>'deleted_at') is null
 ), earned as (
  select a.student_id,a.points,1 activities from public.point_awards a
   where not p_weekly or a.period_start=app_private.club_week(now())
  union all
  select m.student_id,m.amount,0 from app_private.manual_point_awards m
   where not p_weekly or m.scoring_week=app_private.scoring_week(now())
 ), totals as (
  select student_id,sum(points) points,sum(activities)::bigint activities from earned group by student_id
 ), ranked as (
  select row_number() over(order by coalesce(t.points,0) desc,e.id) as rank,e.alias,
   coalesce(t.points,0) points,coalesce(t.activities,0) activities
  from eligible e left join totals t on t.student_id=e.id
 ) select coalesce(jsonb_agg(to_jsonb(ranked) order by rank),'[]') from ranked;
$$;

commit;
