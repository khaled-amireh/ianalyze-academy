-- Local Phase 03 foundation. Hosted application requires a separate owner approval.
begin;

create schema app_private;
revoke all on schema app_private from public;
alter default privileges in schema app_private revoke execute on functions from public;
revoke create on schema public from public, anon, authenticated;
grant usage on schema app_private to authenticated;

create table app_private.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'student' check (role in ('student', 'team')),
  grant_reason text not null default 'signup' check (length(trim(grant_reason)) between 1 and 500),
  changed_at timestamptz not null default now()
);
create table app_private.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  target_id uuid not null,
  created_at timestamptz not null default now()
);
alter table app_private.user_roles enable row level security;
alter table app_private.audit_events enable row level security;
revoke all on all tables in schema app_private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text check (full_name is null or length(trim(full_name)) between 1 and 150),
  whatsapp text check (whatsapp is null or whatsapp ~ '^\+[1-9][0-9]{6,14}$'),
  major text check (major is null or length(trim(major)) between 1 and 150),
  academic_year smallint check (academic_year between 1 and 8),
  python_experience text check (python_experience in ('none', 'basic', 'experienced')),
  university_id text check (university_id is null or length(university_id) between 1 and 50),
  locale text not null default 'ar' check (locale in ('ar', 'en')),
  consent_version text,
  consent_at timestamptz,
  registered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (registered_at is null or (
    full_name is not null and whatsapp is not null and major is not null and
    academic_year is not null and python_experience is not null and
    consent_version is not null and consent_at is not null
  ))
);

create function app_private.is_verified() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.users u where u.id = (select auth.uid())
    and u.email_confirmed_at is not null);
$$;
create function app_private.current_role() returns text
language sql stable security definer set search_path = '' as $$
  select r.role from app_private.user_roles r
  where r.user_id = (select auth.uid()) and app_private.is_verified();
$$;
create function app_private.is_team() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(app_private.current_role() = 'team', false);
$$;
create function app_private.is_registered() returns boolean
language sql stable security definer set search_path = '' as $$
  select app_private.current_role() is not null and exists (select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.registered_at is not null);
$$;
-- A reviewed future migration is required to open uploads. No client-settable flag.
create function app_private.uploads_enabled() returns boolean
language sql immutable as $$ select false; $$;

create function app_private.bootstrap_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, email) values (new.id, new.email);
  insert into app_private.user_roles(user_id) values (new.id);
  return new;
end;
$$;
create trigger academy_bootstrap after insert on auth.users
for each row execute function app_private.bootstrap_user();
create function app_private.sync_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;
create trigger academy_sync_email after update of email on auth.users
for each row execute function app_private.sync_email();
create function app_private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger profiles_updated before update on public.profiles
for each row execute function app_private.touch_updated_at();
create function app_private.audit_role() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.changed_at := now();
  insert into app_private.audit_events(actor_id, action, target_id)
  values (auth.uid(), 'role:' || new.role, new.user_id);
  return new;
end;
$$;
create trigger roles_audit before insert or update on app_private.user_roles
for each row execute function app_private.audit_role();

create function public.current_academy_role() returns text
language sql stable security invoker set search_path = '' as $$
  select app_private.current_role();
$$;
create function app_private.complete_registration(p_consent_version text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if app_private.current_role() is null then raise exception 'Verified academy account required' using errcode = '42501'; end if;
  if p_consent_version is distinct from 'registration-v1' then raise exception 'Unsupported consent version' using errcode = '22023'; end if;
  update public.profiles set consent_version = p_consent_version,
    consent_at = coalesce(consent_at, now()), registered_at = coalesce(registered_at, now())
  where id = (select auth.uid());
  if not found then raise exception 'Profile not found'; end if;
end;
$$;
create function public.complete_registration(p_consent_version text) returns void
language sql security invoker set search_path = '' as $$
  select app_private.complete_registration(p_consent_version);
$$;

create table public.academy_weeks (
  id uuid primary key default gen_random_uuid(),
  week_number smallint not null unique check (week_number between 1 and 8),
  kind text not null check ((week_number <= 6 and kind = 'teaching') or (week_number > 6 and kind = 'reserve')),
  title_ar text not null check (length(trim(title_ar)) between 1 and 200),
  title_en text not null check (length(trim(title_en)) between 1 and 200),
  description_ar text not null default '',
  description_en text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published'))
);
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.academy_weeks(id),
  title_ar text not null check (length(trim(title_ar)) between 1 and 200),
  title_en text not null check (length(trim(title_en)) between 1 and 200),
  instructions_ar text not null default '',
  instructions_en text not null default '',
  max_score numeric(8,2) not null check (max_score > 0 and max_score <> 'NaN'::numeric),
  due_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'published'))
);
create index activities_week_idx on public.activities(week_id, status);
create table public.rubrics (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id),
  version integer not null check (version > 0),
  status text not null default 'draft' check (status in ('draft', 'published')),
  unique (activity_id, version),
  unique (id, activity_id)
);
create table public.rubric_criteria (
  id uuid primary key default gen_random_uuid(),
  rubric_id uuid not null references public.rubrics(id),
  label_ar text not null check (length(trim(label_ar)) between 1 and 300),
  label_en text not null check (length(trim(label_en)) between 1 and 300),
  max_points numeric(8,2) not null check (max_points > 0 and max_points <> 'NaN'::numeric),
  sort_order integer not null check (sort_order >= 0),
  unique (rubric_id, sort_order),
  unique (rubric_id, id)
);
create function app_private.lock_rubric() returns trigger
language plpgsql security definer set search_path = '' as $$
declare cap numeric; total numeric;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then raise exception 'Create rubric as draft first'; end if;
    return new;
  end if;
  if old.status = 'published' then raise exception 'Published rubric is immutable'; end if;
  if tg_op = 'DELETE' then return old; end if;
  if new.status = 'published' then
    select max_score into cap from public.activities where id = new.activity_id for update;
    select sum(max_points) into total from public.rubric_criteria where rubric_id = new.id;
    if total is distinct from cap then raise exception 'Rubric total must match activity maximum'; end if;
  end if;
  return new;
end;
$$;
create trigger rubric_locked before insert or update or delete on public.rubrics
for each row execute function app_private.lock_rubric();
create function app_private.lock_criterion() returns trigger
language plpgsql security definer set search_path = '' as $$
declare target uuid;
begin
  if tg_op <> 'INSERT' then
    perform 1 from public.rubrics where id = old.rubric_id for update;
    if exists (select 1 from public.rubrics where id = old.rubric_id and status = 'published') then raise exception 'Published criterion is immutable'; end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  target := new.rubric_id;
  perform 1 from public.rubrics where id = target for update;
  if exists (select 1 from public.rubrics where id = target and status = 'published') then raise exception 'Published criterion is immutable'; end if;
  return new;
end;
$$;
create trigger criterion_locked before insert or update or delete on public.rubric_criteria
for each row execute function app_private.lock_criterion();
create function app_private.lock_activity_score() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.max_score is distinct from old.max_score and exists (
    select 1 from public.rubrics where activity_id = old.id and status = 'published'
  ) then raise exception 'Published rubric locks activity maximum'; end if;
  return new;
end;
$$;
create trigger activity_score_locked before update on public.activities
for each row execute function app_private.lock_activity_score();

alter table public.profiles enable row level security;
alter table public.academy_weeks enable row level security;
alter table public.activities enable row level security;
alter table public.rubrics enable row level security;
alter table public.rubric_criteria enable row level security;
revoke all on public.profiles, public.academy_weeks, public.activities, public.rubrics, public.rubric_criteria from public, anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, whatsapp, major, academic_year, python_experience, university_id, locale) on public.profiles to authenticated;
create policy profile_read on public.profiles for select to authenticated
using ((id = (select auth.uid()) and app_private.is_verified()) or (app_private.is_team() and registered_at is not null));
create policy profile_update on public.profiles for update to authenticated
using (id = (select auth.uid()) and app_private.is_verified())
with check (id = (select auth.uid()) and app_private.is_verified());

grant select, insert, update, delete on public.academy_weeks, public.activities, public.rubrics, public.rubric_criteria to authenticated;
create policy week_read on public.academy_weeks for select to authenticated
using (app_private.is_team() or (app_private.is_registered() and status = 'published'));
create policy week_manage on public.academy_weeks for all to authenticated
using (app_private.is_team()) with check (app_private.is_team());
create policy activity_read on public.activities for select to authenticated
using (app_private.is_team() or (app_private.is_registered() and status = 'published' and exists (
  select 1 from public.academy_weeks w where w.id = week_id and w.status = 'published'
)));
create policy activity_manage on public.activities for all to authenticated
using (app_private.is_team()) with check (app_private.is_team());
create policy rubric_read on public.rubrics for select to authenticated
using (app_private.is_team() or (status = 'published' and exists (select 1 from public.activities a where a.id = activity_id)));
create policy rubric_manage on public.rubrics for all to authenticated
using (app_private.is_team()) with check (app_private.is_team());
create policy criterion_read on public.rubric_criteria for select to authenticated
using (app_private.is_team() or exists (select 1 from public.rubrics r where r.id = rubric_id));
create policy criterion_manage on public.rubric_criteria for all to authenticated
using (app_private.is_team()) with check (app_private.is_team());

revoke all on all functions in schema app_private from public, anon, authenticated;
grant execute on function app_private.is_verified(), app_private.current_role(), app_private.is_team(), app_private.is_registered(), app_private.uploads_enabled(), app_private.complete_registration(text) to authenticated;
revoke all on function public.current_academy_role(), public.complete_registration(text) from public, anon;
grant execute on function public.current_academy_role(), public.complete_registration(text) to authenticated;
commit;
