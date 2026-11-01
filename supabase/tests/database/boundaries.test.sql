-- Run only on the disposable LOCAL Supabase stack; no production fixtures.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(12);
select is((select count(*)::integer from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname in ('public','app_private') and c.relkind='r' and c.relrowsecurity), 10, 'RLS on all ten application tables');
select ok(not has_table_privilege('anon','public.profiles','SELECT'), 'Anonymous cannot read profiles');
select ok(not has_table_privilege('authenticated','app_private.user_roles','UPDATE'), 'Clients cannot grant roles');
select ok(not has_table_privilege('authenticated','app_private.audit_events','INSERT'), 'Clients cannot forge audit events');
select ok(not has_table_privilege('authenticated','public.grades','UPDATE'), 'Grades have no direct client update');
select ok(not has_column_privilege('authenticated','public.profiles','email','UPDATE'), 'Profile email is server-managed');
select ok(has_column_privilege('authenticated','public.profiles','whatsapp','UPDATE'), 'Permitted contact update grant exists');
select ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosecdef), 'No exposed security-definer functions');
select ok(not app_private.uploads_enabled(), 'Production upload gate remains closed');
select is((select count(*) from storage.buckets where id in ('student-submissions','team-materials') and not public), 2::bigint, 'Both buckets are private');
select is((select file_size_limit from storage.buckets where id='student-submissions'), 262144::bigint, '256 KiB student limit');
select is((select count(*) from pg_policies where schemaname='storage' and tablename='objects' and cmd in ('ALL','UPDATE','DELETE')), 0::bigint, 'No client overwrite or delete policy');
select * from finish();
rollback;
