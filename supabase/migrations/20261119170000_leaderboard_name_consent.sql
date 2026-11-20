-- Public full names require explicit, withdrawable student consent.
begin;

alter table public.profiles rename column leaderboard_name to leaderboard_alias;
alter table public.profiles add column public_full_name_consent boolean not null default false;
alter table public.profiles add column public_full_name_consent_at timestamptz;
alter table public.profiles add column leaderboard_name text generated always as (
  case when public_full_name_consent then full_name else leaderboard_alias end
) stored;

revoke update (leaderboard_alias) on public.profiles from authenticated;
revoke update (public_full_name_consent, public_full_name_consent_at, leaderboard_name)
  on public.profiles from authenticated;

create table app_private.leaderboard_name_consent_events (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.profiles(id) on delete restrict,
  consented boolean not null,
  recorded_at timestamptz not null default now()
);
alter table app_private.leaderboard_name_consent_events enable row level security;
revoke all on app_private.leaderboard_name_consent_events from public, anon, authenticated;

create function app_private.set_public_full_name_consent(p_consented boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare student uuid := auth.uid();
begin
  if student is null or not app_private.is_verified() or not app_private.is_registered() then
    raise exception 'Verified registered student required' using errcode = '42501';
  end if;
  if p_consented is null then raise exception 'Consent choice required' using errcode = '22023'; end if;
  if p_consented and not exists (
    select 1 from public.profiles p where p.id = student and nullif(trim(p.full_name), '') is not null
  ) then raise exception 'Saved registration name required' using errcode = '22023'; end if;
  update public.profiles
    set public_full_name_consent = p_consented,
        public_full_name_consent_at = case when p_consented then clock_timestamp() else null end
    where id = student;
  insert into app_private.leaderboard_name_consent_events(student_id, consented)
    values (student, p_consented);
end;
$$;
create function public.set_public_full_name_consent(p_consented boolean)
returns void language sql security invoker set search_path = '' as $$
  select app_private.set_public_full_name_consent(p_consented);
$$;
revoke all on function app_private.set_public_full_name_consent(boolean),
  public.set_public_full_name_consent(boolean) from public, anon;
grant execute on function public.set_public_full_name_consent(boolean) to authenticated;
grant execute on function app_private.set_public_full_name_consent(boolean) to authenticated;

-- Preserve the registered identity and revoke publication when a trusted correction changes it.
create function app_private.protect_registered_name()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.registered_at is not null and new.full_name is distinct from old.full_name then
    if current_user in ('anon', 'authenticated') then
      raise exception 'Contact the team for a registered-name correction' using errcode = '42501';
    end if;
    new.public_full_name_consent := false;
    new.public_full_name_consent_at := null;
    insert into app_private.leaderboard_name_consent_events(student_id, consented)
      values (old.id, false);
  end if;
  return new;
end;
$$;
revoke all on function app_private.protect_registered_name() from public, anon, authenticated;
create trigger protect_registered_name before update of full_name on public.profiles
  for each row execute function app_private.protect_registered_name();

commit;
