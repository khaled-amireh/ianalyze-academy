-- Additive local Week 1 rounds; production application needs explicit approval.
begin;
alter table public.week1_bingo_boards add column id uuid not null default gen_random_uuid(), add column retired_at timestamptz;
alter table public.week1_bingo_claims add column round_id uuid;
update public.week1_bingo_claims c set round_id=b.id from public.week1_bingo_boards b where b.student_id=c.student_id;
alter table public.week1_bingo_claims alter column round_id set not null;
alter table public.week1_bingo_claims drop constraint week1_bingo_claims_student_id_fkey;
alter table public.week1_bingo_boards drop constraint week1_bingo_boards_pkey;
alter table public.week1_bingo_boards add primary key(id), add unique(id,student_id);
create unique index week1_bingo_current_round on public.week1_bingo_boards(student_id) where retired_at is null;
alter table public.week1_bingo_claims add foreign key(round_id,student_id) references public.week1_bingo_boards(id,student_id) on delete cascade;
drop index public.week1_bingo_active_claim;
create unique index week1_bingo_active_claim on public.week1_bingo_claims(round_id) where status in ('pending','verified');
create unique index week1_bingo_pending_student on public.week1_bingo_claims(student_id) where status='pending';
create index week1_bingo_round_history on public.week1_bingo_boards(student_id,created_at desc,id);
create or replace function app_private.week1_start_bingo() returns void
language plpgsql security definer set search_path='' as $$
begin
  if not app_private.is_registered() then raise exception 'Registration required' using errcode='42501'; end if;
  perform 1 from public.profiles where id=auth.uid() for update;
  insert into public.week1_bingo_boards(student_id,board_order)
  select auth.uid(),jsonb_agg(i order by random()) from generate_series(0,15) i
  on conflict(student_id) where retired_at is null do nothing;
end; $$;

drop function public.week1_mark_bingo(integer,boolean,integer); drop function app_private.week1_mark_bingo(integer,boolean,integer);
drop function public.week1_claim_bingo(); drop function app_private.week1_claim_bingo();
create function app_private.week1_mark_bingo(p_challenge integer,p_completed boolean,p_version integer,p_round_id uuid default null) returns void
language plpgsql security definer set search_path='' as $$
declare b public.week1_bingo_boards; marks jsonb;
begin
  if not app_private.is_registered() then raise exception 'Registration required' using errcode='42501'; end if;
  select * into b from public.week1_bingo_boards where student_id=auth.uid() and retired_at is null for update;
  if not found or b.version<>p_version or (p_round_id is not null and b.id<>p_round_id) then raise exception 'Board changed; reload' using errcode='40001'; end if;
  if p_challenge is null or p_challenge not between 0 and 15 or p_completed is null then raise exception 'Invalid challenge' using errcode='22023'; end if;
  if exists(select 1 from public.week1_bingo_claims where round_id=b.id and status in ('pending','verified')) then
    raise exception 'Claim is locked' using errcode='42501'; end if;
  select coalesce(jsonb_agg(v order by v),'[]') into marks from (
    select value::integer as v from jsonb_array_elements_text(b.completed) where value::integer<>p_challenge
    union select p_challenge where p_completed
  ) s;
  update public.week1_bingo_boards set completed=marks,version=version+1,updated_at=now() where id=b.id;
end; $$;

create function app_private.week1_claim_bingo(p_round_id uuid default null) returns void
language plpgsql security definer set search_path='' as $$
declare b public.week1_bingo_boards; line jsonb; ids jsonb; candidate jsonb;
begin
  if not app_private.is_registered() then raise exception 'Registration required' using errcode='42501'; end if;
  select * into b from public.week1_bingo_boards where student_id=auth.uid() and retired_at is null for update;
  if not found then raise exception 'Start board first' using errcode='22023'; end if;
  if p_round_id is not null and b.id<>p_round_id then raise exception 'Round changed; reload' using errcode='40001'; end if;
  if exists(select 1 from public.week1_bingo_claims where round_id=b.id and status in ('pending','verified')) then
    raise exception 'Active or verified claim exists' using errcode='23505'; end if;
  for candidate in select value from jsonb_array_elements('[[0,1,2,3],[4,5,6,7],[8,9,10,11],[12,13,14,15],[0,4,8,12],[1,5,9,13],[2,6,10,14],[3,7,11,15],[0,5,10,15],[3,6,9,12]]'::jsonb) loop
    select jsonb_agg(b.board_order->(value::integer) order by ord) into ids
      from jsonb_array_elements_text(candidate) with ordinality s(value,ord);
    if b.completed @> ids then line=candidate; exit; end if;
  end loop;
  if line is null then raise exception 'No winning line' using errcode='22023'; end if;
  insert into public.week1_bingo_claims(round_id,student_id,board_snapshot,completed_snapshot,winning_line,challenges)
  values(b.id,auth.uid(),b.board_order,b.completed,line,ids);
end; $$;

create or replace function app_private.week1_review_bingo(p_id uuid,p_status text,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare rid uuid;
begin
  if not app_private.is_team() then raise exception 'Team required' using errcode='42501'; end if;
  if p_status is null or p_status not in ('verified','rejected') or
    (p_status='rejected' and (p_reason is null or length(trim(p_reason)) not between 1 and 500)) then
    raise exception 'Invalid review' using errcode='22023'; end if;
  select round_id into rid from public.week1_bingo_claims where id=p_id;
  -- Same lock order as claim/mark prevents races and deadlocks.
  perform 1 from public.week1_bingo_boards where id=rid for update;
  update public.week1_bingo_claims set status=p_status,reviewed_by=auth.uid(),reviewed_at=now(),
    rejection_reason=case when p_status='rejected' then trim(p_reason) end
  where id=p_id and status='pending';
  if not found then raise exception 'Claim already reviewed or missing' using errcode='40001'; end if;
end; $$;

create function app_private.week1_play_again(p_round_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare b public.week1_bingo_boards; latest_status text; new_order jsonb;
begin
 if not app_private.is_registered() then raise exception 'Registration required' using errcode='42501'; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 select * into b from public.week1_bingo_boards where student_id=auth.uid() and retired_at is null for update;
 if not found or p_round_id is null or b.id<>p_round_id then raise exception 'Round changed; reload' using errcode='40001'; end if;
 select status into latest_status from public.week1_bingo_claims where round_id=b.id order by created_at desc,id desc limit 1;
 if latest_status is null or latest_status not in ('verified','rejected') then raise exception 'Finish organizer verification first' using errcode='42501'; end if;
 -- Do not reuse the same order, even in the vanishingly unlikely shuffle collision.
 loop
  select jsonb_agg(i order by random()) into new_order from generate_series(0,15) i;
  exit when new_order<>b.board_order;
 end loop;
 update public.week1_bingo_boards set retired_at=now() where id=b.id;
 insert into public.week1_bingo_boards(student_id,board_order) values(auth.uid(),new_order);
end; $$;
create function public.week1_play_again(p_round_id uuid) returns void language sql security invoker set search_path='' as $$ select app_private.week1_play_again(p_round_id); $$;
create function public.week1_mark_bingo(p_challenge integer,p_completed boolean,p_version integer,p_round_id uuid default null) returns void language sql security invoker set search_path='' as $$ select app_private.week1_mark_bingo(p_challenge,p_completed,p_version,p_round_id); $$;
create function public.week1_claim_bingo(p_round_id uuid default null) returns void language sql security invoker set search_path='' as $$ select app_private.week1_claim_bingo(p_round_id); $$;
revoke all on function public.week1_play_again(uuid),public.week1_mark_bingo(integer,boolean,integer,uuid),public.week1_claim_bingo(uuid),app_private.week1_play_again(uuid),app_private.week1_mark_bingo(integer,boolean,integer,uuid),app_private.week1_claim_bingo(uuid) from public,anon;
grant execute on function public.week1_play_again(uuid),public.week1_mark_bingo(integer,boolean,integer,uuid),public.week1_claim_bingo(uuid),app_private.week1_play_again(uuid),app_private.week1_mark_bingo(integer,boolean,integer,uuid),app_private.week1_claim_bingo(uuid) to authenticated;
commit;
