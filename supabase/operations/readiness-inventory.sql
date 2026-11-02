-- Read-only catalog/count inventory. Does not return users, credentials or file contents.
begin read only;
set local statement_timeout = '15s';
select jsonb_build_object(
  'transaction_read_only', current_setting('transaction_read_only'),
  'postgres_version', current_setting('server_version'),
  'schemas', (select coalesce(jsonb_agg(nspname order by nspname), '[]'::jsonb)
    from pg_namespace where nspname in ('public', 'app_private', 'auth', 'storage', 'supabase_migrations')),
  'migration_history_table', to_regclass('supabase_migrations.schema_migrations'),
  'auth_user_count', (select count(*) from auth.users),
  'storage_object_count', (select count(*) from storage.objects),
  'storage_objects_rls', (select relrowsecurity from pg_class where oid='storage.objects'::regclass),
  'application_tables', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from (
    select n.nspname as schema, c.relname as name, c.relrowsecurity as rls
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('public', 'app_private') and c.relkind in ('r', 'p', 'v', 'm')
    order by 1, 2
  ) t),
  'columns', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from (
    select table_schema, table_name, column_name, data_type, is_nullable
    from information_schema.columns where table_schema in ('public', 'app_private')
    order by table_schema, table_name, ordinal_position
  ) t),
  'policies', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from (
    select schemaname, tablename, policyname, roles, cmd, qual, with_check
    from pg_policies where schemaname in ('public', 'app_private', 'storage')
    order by schemaname, tablename, policyname
  ) t),
  'functions', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from (
    select n.nspname as schema, p.proname as name, p.prosecdef as security_definer,
      p.proconfig as settings, pg_get_function_result(p.oid) as returns,
      pg_get_userbyid(p.proowner) as owner,
      has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
      has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'app_private') order by 1, 2
  ) t),
  'event_triggers', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from (
    select evtname as name, evtevent as event, evtenabled as enabled, evtfoid::regproc::text as function
    from pg_event_trigger order by evtname
  ) t),
  'triggers', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from (
    select event_object_schema, event_object_table, trigger_name, action_statement
    from information_schema.triggers
    where event_object_schema in ('public', 'app_private', 'auth')
    order by event_object_schema, event_object_table, trigger_name
  ) t),
  'grants', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from (
    select grantee, table_schema, table_name, privilege_type
    from information_schema.table_privileges
    where table_schema in ('public', 'app_private')
      and grantee in ('anon', 'authenticated', 'service_role')
    order by table_schema, table_name, grantee, privilege_type
  ) t),
  'buckets', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from (
    select id, name, public, file_size_limit, allowed_mime_types from storage.buckets order by id
  ) t),
  'extensions', (select coalesce(jsonb_agg(extname order by extname), '[]'::jsonb) from pg_extension)
) as inventory;
rollback;
