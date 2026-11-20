-- Application-level Admin grants are separate from platform/database ownership.
begin;

create table app_private.application_admins (
  user_id uuid primary key references auth.users(id) on delete restrict,
  granted_by uuid references auth.users(id) on delete set null,
  grant_reason text not null check (length(trim(grant_reason)) between 1 and 500),
  granted_at timestamptz not null default now()
);
alter table app_private.application_admins enable row level security;
revoke all on app_private.application_admins from public, anon, authenticated;
create table app_private.application_admin_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('grant', 'revoke')),
  reason text not null check (length(trim(reason)) between 1 and 500),
  recorded_at timestamptz not null default now()
);
alter table app_private.application_admin_events enable row level security;
revoke all on app_private.application_admin_events from public, anon, authenticated;
create function app_private.audit_application_admin()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op='INSERT' then
    insert into app_private.application_admin_events(user_id, actor_id, action, reason)
      values (new.user_id, auth.uid(), 'grant', new.grant_reason);
    return new;
  end if;
  insert into app_private.application_admin_events(user_id, actor_id, action, reason)
    values (old.user_id, auth.uid(), 'revoke', old.grant_reason);
  return old;
end;
$$;
create trigger application_admin_audit after insert or delete on app_private.application_admins
  for each row execute function app_private.audit_application_admin();

create function app_private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from app_private.application_admins a
      join auth.users u on u.id = a.user_id
      join public.profiles p on p.id = a.user_id
    where a.user_id = (select auth.uid())
      and u.email_confirmed_at is not null
      and p.registered_at is not null
  );
$$;
create or replace function app_private.is_team()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(app_private.current_role() = 'team' or app_private.is_admin(), false);
$$;
create or replace function public.current_academy_role()
returns text language sql stable security invoker set search_path = '' as $$
  select case when app_private.is_admin() then 'team' else app_private.current_role() end;
$$;
create function public.current_academy_is_admin()
returns boolean language sql stable security invoker set search_path = '' as $$
  select app_private.is_admin();
$$;
revoke all on function app_private.is_admin(), app_private.audit_application_admin(), public.current_academy_is_admin() from public, anon, authenticated;
grant execute on function app_private.is_admin(), public.current_academy_is_admin() to authenticated;

commit;
