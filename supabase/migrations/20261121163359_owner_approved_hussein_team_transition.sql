-- One owner-authorized Student-to-Team transition. Every write remains under
-- RLS, and the existing role audit trigger records auth.uid() as its actor.
begin;

-- Preserve existing role-audit behavior and add the explicit grant reason to
-- new application audit records. Existing events remain unchanged/NULL here.
do $guard$
declare
  audit_definition text;
  audit_is_definer boolean;
  audit_config text[];
begin
  select pg_get_functiondef('app_private.audit_role()'::regprocedure)
    into audit_definition;
  select p.prosecdef, p.proconfig into audit_is_definer, audit_config
    from pg_proc p where p.oid = 'app_private.audit_role()'::regprocedure;
  if not audit_is_definer
    or audit_config is distinct from array['search_path=""']::text[]
    or position('auth.uid()' in audit_definition) = 0
    or position('new.user_id' in audit_definition) = 0
    or position('role:' in audit_definition) = 0
  then
    raise exception 'Role audit baseline differs from reviewed actor/target contract'
      using errcode = '55000';
  end if;
end;
$guard$;

alter table app_private.audit_events add column reason text;

create or replace function app_private.audit_role() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.changed_at := now();
  insert into app_private.audit_events(actor_id, action, target_id, reason)
  values (auth.uid(), 'role:' || new.role, new.user_id, new.grant_reason);
  return new;
end;
$$;

create table app_private.initial_hussein_team_transition_approval (
  singleton boolean primary key default true check (singleton),
  target_user_id uuid not null references auth.users(id) on delete restrict
    check (target_user_id = '4cadbb96-c6bf-484b-b239-7aceb3820fb3'::uuid),
  approved_by uuid not null references auth.users(id) on delete restrict
    check (approved_by = '79b1672a-b609-4ec4-814a-15ed209796af'::uuid),
  reason text not null check (
    reason = 'Owner-approved assignment to the iAnalyze Academy team.'
  ),
  consumed_at timestamptz
);
alter table app_private.initial_hussein_team_transition_approval enable row level security;
revoke all on app_private.initial_hussein_team_transition_approval
  from public, anon, authenticated;
grant select, update(consumed_at)
  on app_private.initial_hussein_team_transition_approval to authenticated;
grant select, insert
  on app_private.initial_hussein_team_transition_approval to service_role;

create policy owner_hussein_transition_approval_read
  on app_private.initial_hussein_team_transition_approval
  for select to authenticated
  using (
    singleton
    and target_user_id = '4cadbb96-c6bf-484b-b239-7aceb3820fb3'::uuid
    and approved_by = (select auth.uid())
  );
create policy owner_hussein_transition_approval_consume
  on app_private.initial_hussein_team_transition_approval
  for update to authenticated
  using (
    singleton
    and target_user_id = '4cadbb96-c6bf-484b-b239-7aceb3820fb3'::uuid
    and approved_by = (select auth.uid())
    and consumed_at is null
  )
  with check (
    singleton
    and target_user_id = '4cadbb96-c6bf-484b-b239-7aceb3820fb3'::uuid
    and approved_by = (select auth.uid())
    and consumed_at is not null
  );

grant select(user_id, role), update(role, grant_reason)
  on app_private.user_roles to authenticated;
create policy owner_hussein_transition_role_read
  on app_private.user_roles
  for select to authenticated
  using (
    user_id = '4cadbb96-c6bf-484b-b239-7aceb3820fb3'::uuid
    and role in ('student', 'team')
    and (select auth.uid()) = '79b1672a-b609-4ec4-814a-15ed209796af'::uuid
    and (select auth.jwt() ->> 'role') = 'authenticated'
    and app_private.is_verified()
    and app_private.is_registered()
  );
create policy owner_hussein_transition_role_update
  on app_private.user_roles
  for update to authenticated
  using (
    user_id = '4cadbb96-c6bf-484b-b239-7aceb3820fb3'::uuid
    and role = 'student'
    and (select auth.uid()) = '79b1672a-b609-4ec4-814a-15ed209796af'::uuid
    and (select auth.jwt() ->> 'role') = 'authenticated'
    and app_private.is_verified()
    and app_private.is_registered()
    and app_private.current_role() = 'team'
    and exists (
      select 1 from app_private.initial_hussein_team_transition_approval a
      where a.singleton and a.target_user_id = user_id
        and a.approved_by = (select auth.uid()) and a.consumed_at is null
    )
  )
  with check (
    user_id = '4cadbb96-c6bf-484b-b239-7aceb3820fb3'::uuid
    and role = 'team'
    and grant_reason = 'Owner-approved assignment to the iAnalyze Academy team.'
    and (select auth.uid()) = '79b1672a-b609-4ec4-814a-15ed209796af'::uuid
    and (select auth.jwt() ->> 'role') = 'authenticated'
  );

create function app_private.consume_owner_hussein_team_transition()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if old.user_id = '4cadbb96-c6bf-484b-b239-7aceb3820fb3'::uuid
    and old.role = 'student' and new.role = 'team'
  then
    if (select auth.uid()) is null
      or (select auth.uid()) <> '79b1672a-b609-4ec4-814a-15ed209796af'::uuid
      or (select auth.jwt() ->> 'role') is distinct from 'authenticated'
    then
      raise exception 'Verified owner session required for the approved Team transition'
        using errcode = '42501';
    end if;
    update app_private.initial_hussein_team_transition_approval
      set consumed_at = clock_timestamp()
      where singleton
        and target_user_id = old.user_id
        and approved_by = (select auth.uid())
        and consumed_at is null;
    if not found then
      raise exception 'Owner-approved Team transition is missing or already consumed'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger consume_owner_hussein_team_transition
  after update of role on app_private.user_roles
  for each row execute function app_private.consume_owner_hussein_team_transition();
revoke all on function app_private.consume_owner_hussein_team_transition()
  from public, anon, authenticated;
grant execute on function app_private.consume_owner_hussein_team_transition()
  to authenticated;

create function app_private.complete_owner_approved_hussein_team_transition()
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if (select auth.uid()) is null
    or (select auth.uid()) <> '79b1672a-b609-4ec4-814a-15ed209796af'::uuid
    or (select auth.jwt() ->> 'role') is distinct from 'authenticated'
    or not app_private.is_verified()
    or not app_private.is_registered()
    or app_private.current_role() <> 'team'
  then
    raise exception 'Verified owner Team session required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from app_private.initial_hussein_team_transition_approval a
    where a.singleton
      and a.target_user_id = '4cadbb96-c6bf-484b-b239-7aceb3820fb3'::uuid
      and a.approved_by = (select auth.uid())
      and a.reason = 'Owner-approved assignment to the iAnalyze Academy team.'
      and a.consumed_at is null
  ) then
    raise exception 'Owner-approved Team transition is unavailable' using errcode = '42501';
  end if;

  update app_private.user_roles
    set role = 'team',
        grant_reason = 'Owner-approved assignment to the iAnalyze Academy team.'
    where user_id = '4cadbb96-c6bf-484b-b239-7aceb3820fb3'::uuid
      and role = 'student';
  if not found then
    raise exception 'Expected exactly one Student-to-Team transition' using errcode = '55000';
  end if;
  if exists (
    select 1 from app_private.initial_hussein_team_transition_approval a
    where a.singleton and a.consumed_at is null
  ) then
    raise exception 'Team transition approval was not consumed atomically' using errcode = '55000';
  end if;
end;
$$;

create function public.current_user_can_complete_hussein_team_transition()
returns boolean language sql stable security invoker set search_path = '' as $$
  select (select auth.uid()) = '79b1672a-b609-4ec4-814a-15ed209796af'::uuid
    and (select auth.jwt() ->> 'role') = 'authenticated'
    and app_private.is_verified()
    and app_private.is_registered()
    and app_private.current_role() = 'team'
    and exists (
      select 1 from app_private.initial_hussein_team_transition_approval a
      where a.singleton
        and a.target_user_id = '4cadbb96-c6bf-484b-b239-7aceb3820fb3'::uuid
        and a.approved_by = (select auth.uid())
        and a.consumed_at is null
    );
$$;
create function public.complete_owner_approved_hussein_team_transition()
returns void language sql security invoker set search_path = '' as $$
  select app_private.complete_owner_approved_hussein_team_transition();
$$;

revoke all on function app_private.complete_owner_approved_hussein_team_transition(),
  public.current_user_can_complete_hussein_team_transition(),
  public.complete_owner_approved_hussein_team_transition()
  from public, anon, authenticated;
grant execute on function app_private.complete_owner_approved_hussein_team_transition(),
  public.current_user_can_complete_hussein_team_transition(),
  public.complete_owner_approved_hussein_team_transition()
  to authenticated;

commit;
