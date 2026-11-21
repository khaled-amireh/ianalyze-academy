-- Allow the specifically approved registered Team owner account to consume
-- the existing single-use initial Admin approval. Admin remains a separate
-- registry role; this migration does not change any user_roles rows.
begin;

do $guard$
declare
  promotion_definition text;
  eligibility_definition text;
  promotion_is_definer boolean;
  eligibility_is_definer boolean;
  promotion_config text[];
  eligibility_config text[];
begin
  select pg_get_functiondef('app_private.promote_initial_academy_admin()'::regprocedure)
    into promotion_definition;
  select pg_get_functiondef('app_private.current_user_has_initial_admin_promotion()'::regprocedure)
    into eligibility_definition;
  select p.prosecdef, p.proconfig into promotion_is_definer, promotion_config
    from pg_proc p where p.oid = 'app_private.promote_initial_academy_admin()'::regprocedure;
  select p.prosecdef, p.proconfig into eligibility_is_definer, eligibility_config
    from pg_proc p where p.oid = 'app_private.current_user_has_initial_admin_promotion()'::regprocedure;

  if not promotion_is_definer or promotion_config is distinct from array['search_path=""']::text[]
    or not eligibility_is_definer or eligibility_config is distinct from array['search_path=""']::text[]
    or position('r.role = ''student''' in promotion_definition) = 0
    or position('current_session_has_aal2' in promotion_definition) = 0
    or position('approval.user_id is distinct from actor_id' in promotion_definition) = 0
    or position('exists (select 1 from app_private.application_admins)' in promotion_definition) = 0
    or position('p.registered_at is not null' in promotion_definition) = 0
    or position('u.email_confirmed_at is not null' in promotion_definition) = 0
    or position('factor_type = ''totp''' in promotion_definition) = 0
    or position('status = ''verified''' in promotion_definition) = 0
    or position('insert into app_private.application_admins' in promotion_definition) = 0
    or position('delete from app_private.initial_admin_promotion_approval' in promotion_definition) = 0
    or position('r.role = ''student''' in eligibility_definition) = 0
    or position('a.user_id = auth.uid()' in eligibility_definition) = 0
    or position('not exists (select 1 from app_private.application_admins)' in eligibility_definition) = 0
    or position('p.registered_at is not null' in eligibility_definition) = 0
    or position('u.email_confirmed_at is not null' in eligibility_definition) = 0
  then
    raise exception 'Initial Admin promotion baseline differs from the reviewed Student-only contract'
      using errcode = '55000';
  end if;
end;
$guard$;

-- CREATE OR REPLACE retains the reviewed owner and EXECUTE grants. Keep all
-- approval, registration, email, MFA, AAL2, audit-trigger, and atomic-consume
-- checks unchanged; only eligibility expands from Student to Student or Team.
create or replace function app_private.promote_initial_academy_admin() returns void
language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := (select auth.uid());
  approval app_private.initial_admin_promotion_approval;
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
      and u.email_confirmed_at is not null and r.role in ('student', 'team')
  ) then
    raise exception 'Registered verified Student or Team account required' using errcode = '42501';
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

create or replace function app_private.current_user_has_initial_admin_promotion() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
    and not exists (select 1 from app_private.application_admins)
    and exists (
      select 1 from app_private.initial_admin_promotion_approval a
      join public.profiles p on p.id = a.user_id
      join auth.users u on u.id = p.id
      join app_private.user_roles r on r.user_id = p.id
      where a.singleton and a.user_id = auth.uid()
        and p.registered_at is not null and u.email_confirmed_at is not null
        and r.role in ('student', 'team')
    );
$$;

commit;
