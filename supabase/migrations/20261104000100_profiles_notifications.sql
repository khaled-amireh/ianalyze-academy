-- Additive. Apply only after a fresh, verified restorable backup and hosted preflight.
-- Historical unknown universities and majors remain unchanged; Auth UUID stays the PK.
begin;
alter table public.profiles add column university text
  check (university is null or length(trim(university)) between 1 and 200);
grant update (university) on public.profiles to authenticated;

create unique index profiles_zuj_university_id_unique
on public.profiles (btrim(university_id))
where university = 'Al-Zaytoonah University of Jordan' and university_id is not null;

create function app_private.validate_university() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.university is distinct from old.university or new.university_id is distinct from old.university_id
    or (old.registered_at is null and new.registered_at is not null) then
    if new.university is not null then new.university := btrim(new.university); end if;
    if new.university_id is not null then new.university_id := nullif(btrim(new.university_id), ''); end if;
    if new.university is null and (old.university is not null or
      (old.registered_at is null and new.registered_at is not null)) then
      raise exception 'University required' using errcode = '23514';
    end if;
    if new.university = 'Al-Zaytoonah University of Jordan' and
      (new.university_id is null or new.university_id !~ '^[0-9]{1,20}$') then
      raise exception 'Valid Al-Zaytoonah University ID required' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
create trigger profile_university_validation before update on public.profiles
for each row execute function app_private.validate_university();

alter table public.activities add column published_at timestamptz;
create function app_private.stamp_activity_publication() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status='published' and (tg_op='INSERT' or old.status<>'published') then
    new.published_at := now();
  else
    new.published_at := case when tg_op='INSERT' then null else old.published_at end;
  end if;
  return new;
end;
$$;
create trigger activity_publication before insert or update on public.activities
for each row execute function app_private.stamp_activity_publication();

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title_ar text not null check (length(trim(title_ar)) between 1 and 200),
  title_en text not null check (length(trim(title_en)) between 1 and 200),
  body_ar text not null check (length(trim(body_ar)) between 1 and 5000),
  body_en text not null check (length(trim(body_en)) between 1 and 5000),
  status text not null default 'draft' check (status in ('draft','published')),
  created_at timestamptz not null default now()
);
alter table public.announcements enable row level security;
revoke all on public.announcements from public, anon, authenticated;
grant select, insert, update, delete on public.announcements to authenticated;
create policy announcement_read on public.announcements for select to authenticated
using (app_private.is_team() or (app_private.is_registered() and status='published'));
create policy announcement_manage on public.announcements for all to authenticated
using (app_private.is_team()) with check (app_private.is_team());

-- Receipts contain no announcement bodies or administrative data.
create table public.notification_receipts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_key text not null,
  read_at timestamptz not null default now(),
  primary key(user_id,event_key)
);
alter table public.notification_receipts enable row level security;
revoke all on public.notification_receipts from public, anon, authenticated;
grant select on public.notification_receipts to authenticated;
create policy receipt_read on public.notification_receipts for select to authenticated
using (user_id=(select auth.uid()) and app_private.is_verified());

-- Re-evaluate visibility on every read: unpublished content immediately disappears.
-- Definer queries explicitly constrain every source; no staff-only bodies/feedback.
create function app_private.notification_events()
returns table(event_key text,title_ar text,title_en text,body_ar text,body_en text,href text,created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select 'announcement:'||a.id, a.title_ar,a.title_en,a.body_ar,a.body_en,'/notifications',a.created_at
  from public.announcements a where a.status='published' and app_private.is_registered()
  union all
  select 'activity:'||a.id, 'نشاط أسبوعي جديد','New weekly activity',a.title_ar,a.title_en,'/student',coalesce(a.published_at,p.created_at)
  from public.activities a join public.academy_weeks w on w.id=a.week_id
    join public.profiles p on p.id=auth.uid()
  where a.status='published' and w.status='published' and app_private.is_registered()
  union all
  select 'deadline:'||a.id||':'||a.due_at::text,'موعد تسليم قريب','Upcoming deadline',a.title_ar,a.title_en,'/student',a.due_at
  from public.activities a join public.academy_weeks w on w.id=a.week_id
  where app_private.is_registered() and a.status='published' and w.status='published'
    and a.due_at > now() and a.due_at <= now()+interval '3 days'
    and not exists(select 1 from public.submissions s where s.activity_id=a.id and s.student_id=auth.uid()
      and s.status in ('submitted','under_review','reviewed'))
  union all
  select 'submission:'||s.id||':'||s.status,'تحديث حالة التسليم','Submission status updated',
    a.title_ar||' — '||case s.status when 'submitted' then 'تم التسليم' when 'under_review' then 'قيد المراجعة' when 'reviewed' then 'تمت المراجعة' else 'مطلوب إعادة التسليم' end,
    a.title_en||' — '||replace(s.status,'_',' '),'/student',coalesce(s.submitted_at,s.created_at)
  from public.submissions s join public.activities a on a.id=s.activity_id join public.academy_weeks w on w.id=a.week_id
  where s.student_id=auth.uid() and app_private.is_registered() and s.status<>'uploading'
    and a.status='published' and w.status='published'
  union all
  select 'grade:'||g.id||':'||g.revision,'نُشر تقييم التسليم','Submission assessment published',a.title_ar,a.title_en,'/student',g.created_at
  from public.grades g join public.submissions s on s.id=g.submission_id
    join public.activities a on a.id=s.activity_id join public.academy_weeks w on w.id=a.week_id
  where s.student_id=auth.uid() and app_private.is_registered() and g.status='published'
    and a.status='published' and w.status='published';
$$;
create function public.academy_notifications() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(e)||jsonb_build_object('read_at',r.read_at)
    order by e.created_at desc,e.event_key),'[]'::jsonb)
  from app_private.notification_events() e left join public.notification_receipts r
    on r.user_id=auth.uid() and r.event_key=e.event_key;
$$;
create function app_private.read_notification(p_event_key text) returns void
language sql security definer set search_path = '' as $$
  insert into public.notification_receipts(user_id,event_key)
    select auth.uid(),e.event_key from app_private.notification_events() e
    where p_event_key is null or e.event_key=p_event_key
  on conflict(user_id,event_key) do nothing;
$$;
create function public.read_notification(p_event_key text default null) returns void
language sql security invoker set search_path = '' as $$
  select app_private.read_notification(p_event_key);
$$;
revoke all on function app_private.validate_university(),app_private.stamp_activity_publication(),app_private.notification_events(),app_private.read_notification(text) from public,anon,authenticated;
grant execute on function app_private.notification_events(),app_private.read_notification(text) to authenticated;
revoke all on function public.academy_notifications(),public.read_notification(text) from public,anon;
grant execute on function public.academy_notifications(),public.read_notification(text) to authenticated;
commit;
