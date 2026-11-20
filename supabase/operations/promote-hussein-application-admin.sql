-- One-time, owner-authorized application role grant. Run only after migration
-- 20261119170100_application_admins.sql has been reviewed and applied.
begin;
do $$
declare target uuid; matches integer;
begin
  select count(*), min(u.id::text)::uuid
    into matches, target
    from auth.users u
    join public.profiles p on p.id=u.id
    join app_private.user_roles r on r.user_id=u.id
   where lower(u.email)=lower('husseinzahran05@gmail.com')
     and u.email_confirmed_at is not null
     and p.registered_at is not null
     and r.role='student'
     and (to_jsonb(u)->>'deleted_at') is null;
  if matches <> 1 or target is null then
    raise exception 'Expected exactly one verified, registered existing student account';
  end if;
  if exists(select 1 from app_private.application_admins where user_id=target) then
    raise exception 'Verified account is already an application Admin';
  end if;
  insert into app_private.application_admins(user_id,granted_by,grant_reason)
    values(target,auth.uid(),'Explicit owner authorization; verified existing application account');
end;
$$;
commit;
