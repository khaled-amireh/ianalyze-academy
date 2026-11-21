-- TEST ONLY: local migrations retain the historical six-migration no-argument
-- contract. Normalize only these disposable functions to the production boolean
-- signature before testing the pending migrations. Never deploy this fixture.
do $$
declare definition text;
begin
  definition := pg_get_functiondef('app_private.academy_leaderboard()'::regprocedure);
  execute 'drop function public.academy_leaderboard()';
  execute 'drop function app_private.academy_leaderboard()';
  execute replace(definition, 'FUNCTION app_private.academy_leaderboard()',
    'FUNCTION app_private.academy_leaderboard(p_weekly boolean DEFAULT false)');
end;
$$;
create function public.academy_leaderboard(p_weekly boolean default false) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select app_private.academy_leaderboard(p_weekly);
$$;
revoke all on function app_private.academy_leaderboard(boolean), public.academy_leaderboard(boolean)
  from public, anon, authenticated;
grant execute on function app_private.academy_leaderboard(boolean), public.academy_leaderboard(boolean)
  to anon, authenticated, service_role;
