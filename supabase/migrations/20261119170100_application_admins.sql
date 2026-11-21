-- Path B: a private Admin registry layered onto the current role model.
-- No Admin identity is inserted here; initial promotion is a separate owner action.
begin;

create table app_private.application_admins (
  user_id uuid primary key references auth.users(id) on delete restrict,
  granted_by uuid references auth.users(id) on delete set null,
  reason text not null check (length(trim(reason)) between 1 and 500),
  granted_at timestamptz not null default now()
);
create table app_private.application_admin_events (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  subject_id uuid references auth.users(id) on delete set null,
  event text not null check (event in ('granted', 'revoked')),
  reason text not null check (length(trim(reason)) between 1 and 500),
  created_at timestamptz not null default now()
);
-- A single owner-approved target can be staged by the trusted server operator.
-- The target must complete an AAL2 session to consume this approval.
create table app_private.initial_admin_promotion_approval (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null references auth.users(id) on delete restrict,
  approved_by uuid not null references auth.users(id) on delete restrict,
  reason text not null check (length(trim(reason)) between 1 and 500),
  approved_at timestamptz not null default now()
);
alter table app_private.application_admins enable row level security;
alter table app_private.application_admin_events enable row level security;
alter table app_private.initial_admin_promotion_approval enable row level security;
revoke all on app_private.application_admins, app_private.application_admin_events
  from public, anon, authenticated;
revoke all on app_private.initial_admin_promotion_approval from public, anon, authenticated;
grant select, insert, delete on app_private.initial_admin_promotion_approval to service_role;

create function app_private.audit_admin_registry() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into app_private.application_admin_events(actor_id, subject_id, event, reason)
    values (new.granted_by, new.user_id, 'granted', new.reason);
    return new;
  end if;
  insert into app_private.application_admin_events(actor_id, subject_id, event, reason)
  values (auth.uid(), old.user_id, 'revoked', old.reason);
  return old;
end;
$$;
create trigger application_admin_registry_audit
after insert or delete on app_private.application_admins
for each row execute function app_private.audit_admin_registry();

create function app_private.reject_admin_registry_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Revoke and regrant Admin access to preserve the audit trail' using errcode = '42501';
end;
$$;
create trigger application_admin_registry_no_update
before update on app_private.application_admins
for each row execute function app_private.reject_admin_registry_update();

create function app_private.reject_admin_event_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Admin audit history is append-only' using errcode = '42501';
end;
$$;
create trigger application_admin_events_append_only
before update or delete on app_private.application_admin_events
for each row execute function app_private.reject_admin_event_mutation();

create function app_private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null
    and app_private.is_verified()
    and app_private.is_registered()
    and exists (select 1 from app_private.application_admins a where a.user_id = (select auth.uid()));
$$;

create function app_private.current_session_has_aal2() returns boolean
language sql stable security invoker set search_path = '' as $$
  select coalesce((select auth.jwt() ->> 'aal') = 'aal2', false);
$$;

create function app_private.require_admin_aal2() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app_private.is_admin() then raise exception 'Application Admin required' using errcode = '42501'; end if;
  if not app_private.current_session_has_aal2() then
    raise exception 'AAL2 session required' using errcode = '42501';
  end if;
end;
$$;

create function app_private.promote_initial_academy_admin() returns void
language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := (select auth.uid()); approval app_private.initial_admin_promotion_approval;
begin
  if actor_id is null or not app_private.current_session_has_aal2() then
    raise exception 'Authenticated AAL2 session required' using errcode = '42501';
  end if;
  select * into approval from app_private.initial_admin_promotion_approval
    where singleton for update;
  if not found or approval.user_id is distinct from actor_id then
    raise exception 'No owner-approved Admin promotion is available for this account' using errcode = '42501';
  end if;
  if exists (select 1 from app_private.application_admins) then
    raise exception 'Initial Admin promotion is no longer available' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.profiles p join auth.users u on u.id = p.id
      join app_private.user_roles r on r.user_id = p.id
    where p.id = actor_id and p.registered_at is not null
      and u.email_confirmed_at is not null and r.role = 'student'
  ) then
    raise exception 'Registered verified Student account required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from auth.mfa_factors f
    where f.user_id = actor_id and f.factor_type = 'totp' and f.status = 'verified'
  ) then
    raise exception 'Verified TOTP factor required' using errcode = '42501';
  end if;
  insert into app_private.application_admins(user_id, granted_by, reason)
    values (actor_id, approval.approved_by, approval.reason);
  delete from app_private.initial_admin_promotion_approval where singleton;
end;
$$;
create function public.promote_initial_academy_admin() returns void
language sql security invoker set search_path = '' as $$
  select app_private.promote_initial_academy_admin();
$$;
create function app_private.current_user_has_initial_admin_promotion() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
    and not exists (select 1 from app_private.application_admins)
    and exists (
      select 1 from app_private.initial_admin_promotion_approval a
      join public.profiles p on p.id = a.user_id
      join auth.users u on u.id = p.id
      join app_private.user_roles r on r.user_id = p.id
      where a.singleton and a.user_id = auth.uid()
        and p.registered_at is not null and u.email_confirmed_at is not null and r.role = 'student'
    );
$$;
create function public.current_user_has_initial_admin_promotion() returns boolean
language sql stable security invoker set search_path = '' as $$
  select app_private.current_user_has_initial_admin_promotion();
$$;

create or replace function app_private.is_team() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(app_private.current_role() = 'team' or app_private.is_admin(), false);
$$;

create or replace function public.current_academy_role() returns text
language sql stable security invoker set search_path = '' as $$
  select case when app_private.is_admin() then 'team' else app_private.current_role() end;
$$;
create function public.current_academy_is_admin() returns boolean
language sql stable security invoker set search_path = '' as $$
  select app_private.is_admin();
$$;

create function app_private.correct_registered_student_name(p_student_id uuid, p_full_name text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform app_private.require_admin_aal2();
  if p_student_id is null or p_full_name is null or length(trim(p_full_name)) not between 1 and 150 then
    raise exception 'Valid student name required' using errcode = '22023';
  end if;
  update public.profiles p set full_name = trim(p_full_name)
  from auth.users u, app_private.user_roles r
  where p.id = p_student_id and p.registered_at is not null
    and u.id = p.id and u.email_confirmed_at is not null
    and r.user_id = p.id and r.role = 'student';
  if not found then raise exception 'Registered verified Student not found' using errcode = '22023'; end if;
end;
$$;
create function public.correct_registered_student_name(p_student_id uuid, p_full_name text) returns void
language sql security invoker set search_path = '' as $$
  select app_private.correct_registered_student_name(p_student_id, p_full_name);
$$;

revoke all on function app_private.is_admin(), app_private.correct_registered_student_name(uuid,text),
  app_private.current_session_has_aal2(), app_private.require_admin_aal2(),
  app_private.promote_initial_academy_admin(), public.promote_initial_academy_admin(),
  app_private.current_user_has_initial_admin_promotion(),
  public.current_user_has_initial_admin_promotion(), public.current_academy_is_admin(),
  public.correct_registered_student_name(uuid,text)
  from public, anon, authenticated;
grant execute on function app_private.is_admin(), app_private.correct_registered_student_name(uuid,text)
  to authenticated;
grant execute on function app_private.current_session_has_aal2(), app_private.require_admin_aal2(),
  app_private.promote_initial_academy_admin(), public.promote_initial_academy_admin(),
  app_private.current_user_has_initial_admin_promotion(),
  public.current_user_has_initial_admin_promotion() to authenticated;
grant execute on function public.current_academy_is_admin(), public.correct_registered_student_name(uuid,text)
  to authenticated;
grant execute on function public.current_academy_role() to authenticated;
commit;
