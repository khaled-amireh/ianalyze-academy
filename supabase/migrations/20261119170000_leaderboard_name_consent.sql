-- Path B: explicit full-name consent for the current Academy profile/grade schema.
begin;

alter table public.profiles
  add column public_full_name_consent boolean not null default false,
  add column public_full_name_consent_at timestamptz,
  add column public_full_name_consent_version text;

create table app_private.leaderboard_name_consent_events (
  id bigint generated always as identity primary key,
  subject_id uuid references auth.users(id) on delete set null,
  actor_id uuid,
  event text not null check (event in ('consented', 'withdrawn', 'trusted_name_corrected')),
  consent_version text,
  created_at timestamptz not null default now()
);
alter table app_private.leaderboard_name_consent_events enable row level security;
revoke all on app_private.leaderboard_name_consent_events from public, anon, authenticated;

create function app_private.reject_consent_event_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Consent history is append-only' using errcode = '42501';
end;
$$;
create trigger leaderboard_consent_events_append_only
before update or delete on app_private.leaderboard_name_consent_events
for each row execute function app_private.reject_consent_event_mutation();

create function app_private.guard_registered_profile_name() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.full_name is distinct from old.full_name and old.registered_at is not null then
    if auth.role() = 'authenticated' and not app_private.is_admin() then
      raise exception 'Registered names require an Admin-authorized correction' using errcode = '42501';
    end if;
    if old.public_full_name_consent then
      insert into app_private.leaderboard_name_consent_events(subject_id, actor_id, event)
      values (old.id, auth.uid(), 'withdrawn');
    end if;
    new.public_full_name_consent := false;
    new.public_full_name_consent_at := null;
    new.public_full_name_consent_version := null;
    insert into app_private.leaderboard_name_consent_events(subject_id, actor_id, event)
    values (old.id, auth.uid(), 'trusted_name_corrected');
  end if;
  return new;
end;
$$;
create trigger profiles_registered_name_guard
before update of full_name on public.profiles
for each row execute function app_private.guard_registered_profile_name();

create function app_private.set_public_full_name_consent(p_consented boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare profile_id uuid := (select auth.uid());
begin
  if p_consented is null then raise exception 'Consent choice required' using errcode = '22023'; end if;
  if profile_id is null or not app_private.is_verified() or not app_private.is_registered()
    or app_private.current_role() is distinct from 'student' then
    raise exception 'Registered verified Student required' using errcode = '42501';
  end if;
  if p_consented and not app_private.leaderboard_enabled() then
    raise exception 'Leaderboard consent is unavailable while the feature is closed' using errcode = '42501';
  end if;
  perform 1 from public.profiles p where p.id = profile_id for update;
  if not found then raise exception 'Profile not found' using errcode = '42501'; end if;
  if p_consented and not exists (
    select 1 from public.profiles p where p.id = profile_id and nullif(trim(p.full_name), '') is not null
  ) then
    raise exception 'A saved profile name is required' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.profiles p where p.id = profile_id
      and p.public_full_name_consent = p_consented
  ) then return; end if;
  update public.profiles set
    public_full_name_consent = p_consented,
    public_full_name_consent_at = case when p_consented then now() else null end,
    public_full_name_consent_version = case when p_consented then 'leaderboard-name-v1' else null end
  where id = profile_id;
  insert into app_private.leaderboard_name_consent_events(subject_id, actor_id, event, consent_version)
  values (profile_id, profile_id, case when p_consented then 'consented' else 'withdrawn' end,
    case when p_consented then 'leaderboard-name-v1' else null end);
end;
$$;
create function public.set_public_full_name_consent(p_consented boolean) returns void
language sql security invoker set search_path = '' as $$
  select app_private.set_public_full_name_consent(p_consented);
$$;
revoke all on function app_private.set_public_full_name_consent(boolean),
  public.set_public_full_name_consent(boolean) from public, anon, authenticated;
grant execute on function app_private.set_public_full_name_consent(boolean) to authenticated;
grant execute on function public.set_public_full_name_consent(boolean) to authenticated;
revoke update (public_full_name_consent, public_full_name_consent_at, public_full_name_consent_version)
  on public.profiles from public, anon, authenticated;

create or replace function app_private.academy_leaderboard() returns jsonb
language sql stable security definer set search_path = '' as $$
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
      case when p.public_full_name_consent and p.public_full_name_consent_at is not null
        then p.full_name else 'Learner '||substr(md5(t.student_id::text),1,10) end as alias,
      points,activities
    from totals t join public.profiles p on p.id=t.student_id
  ) select coalesce(jsonb_agg(to_jsonb(ranked) order by rank),'[]'::jsonb) from ranked;
$$;
commit;
