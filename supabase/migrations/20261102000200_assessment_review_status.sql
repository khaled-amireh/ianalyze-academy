-- Keep existing migrations immutable. Status changes are derived from authorized grading.
begin;

create function app_private.sync_review_status() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Do not cancel an explicit resubmission request, including when grading an older attempt.
  update public.submissions s set status = case
    when exists (select 1 from public.grades g where g.submission_id = s.id and g.status = 'published')
      then 'reviewed'
    else 'under_review'
  end
  where s.id = new.submission_id and s.status in ('submitted', 'under_review', 'reviewed');
  return new;
end;
$$;
revoke all on function app_private.sync_review_status() from public, anon, authenticated;

create trigger submission_review_status after insert on public.grades
for each row execute function app_private.sync_review_status();

-- Reconcile existing reviews without touching uploads or pending resubmission requests.
update public.submissions s set status = case
  when exists (select 1 from public.grades g where g.submission_id = s.id and g.status = 'published')
    then 'reviewed'
  else 'under_review'
end
where s.status in ('submitted', 'under_review', 'reviewed')
  and exists (select 1 from public.grades g where g.submission_id = s.id);

commit;
