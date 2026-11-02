-- Run only on the disposable LOCAL Supabase stack; no production fixtures.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(15);
select is((select count(*)::integer from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname in ('public','app_private') and c.relkind='r' and c.relrowsecurity), 10, 'RLS on all ten application tables');
select ok(not has_table_privilege('anon','public.profiles','SELECT'), 'Anonymous cannot read profiles');
select ok(not has_table_privilege('authenticated','app_private.user_roles','UPDATE'), 'Clients cannot grant roles');
select ok(not has_table_privilege('authenticated','app_private.audit_events','INSERT'), 'Clients cannot forge audit events');
select ok(not has_table_privilege('authenticated','public.grades','UPDATE'), 'Grades have no direct client update');
select ok(not has_column_privilege('authenticated','public.profiles','email','UPDATE'), 'Profile email is server-managed');
select ok(has_column_privilege('authenticated','public.profiles','whatsapp','UPDATE'), 'Permitted contact update grant exists');
-- Hosted Supabase already has this managed RLS-enabling event helper. Allow only
-- its reviewed definition and registration; arbitrary public definers still fail.
select ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosecdef and not (
    p.proname='rls_auto_enable' and p.pronargs=0 and p.prorettype='event_trigger'::regtype
    and pg_get_userbyid(p.proowner)='postgres'
    and p.proconfig=array['search_path=pg_catalog']::text[]
    and encode(extensions.digest(pg_get_functiondef(p.oid),'sha256'),'hex')=
      'b21d88816c445d14cef5032c3cd4abaebc1db2001fcb3435022ab6b496182ca4'
    and (select count(*) from pg_event_trigger e where e.evtfoid=p.oid)=1
    and exists(select 1 from pg_event_trigger e where e.evtfoid=p.oid
      and e.evtname='ensure_rls' and e.evtevent='ddl_command_end' and e.evtenabled='O'
      and e.evttags=array['CREATE TABLE','CREATE TABLE AS','SELECT INTO']::text[])
  )), 'No unexpected public definers; exact managed RLS helper is allowed');
select ok(not app_private.uploads_enabled(), 'Production upload gate remains closed');
select is((select count(*) from storage.buckets where id in ('student-submissions','team-materials') and not public), 2::bigint, 'Both buckets are private');
select is((select file_size_limit from storage.buckets where id='student-submissions'), 262144::bigint, '256 KiB student limit');
select is((select count(*) from pg_policies where schemaname='storage' and tablename='objects' and cmd in ('ALL','UPDATE','DELETE')), 0::bigint, 'No client overwrite or delete policy');
select is((select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prokind='f'
    and p.prorettype not in ('trigger'::regtype,'event_trigger'::regtype) and not p.prosecdef),
  11::bigint, 'All eleven application RPCs are invokers');
select ok(not has_function_privilege('authenticated','public.reserve_notebook(uuid,uuid,uuid,text,integer)','EXECUTE')
  and not has_function_privilege('authenticated','public.finalize_notebook(uuid,text)','EXECUTE')
  and not has_function_privilege('authenticated','public.claim_submission_request(uuid)','EXECUTE')
  and has_function_privilege('service_role','public.reserve_notebook(uuid,uuid,uuid,text,integer)','EXECUTE')
  and has_function_privilege('service_role','public.finalize_notebook(uuid,text)','EXECUTE'),
  'Trusted submission operations remain service-only');
select ok((select p.prosecdef and p.proconfig=array['search_path=""']::text[]
  and not has_function_privilege('anon',p.oid,'EXECUTE')
  and not has_function_privilege('authenticated',p.oid,'EXECUTE')
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='app_private' and p.proname='sync_review_status'),
  'Grading-status trigger is hardened and unavailable to clients');
select * from finish();
rollback;
