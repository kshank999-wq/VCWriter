-- Closing a task is the showrunner's (addendum 07 §29, spec v1.1 §5 step 18).
--
-- Until now a writer could call their own assignment done. Under the task
-- workflow, *Completed* means the showrunner formally closed it, so a writer
-- says only that they have taken it or are writing it; finishing is sending it
-- for review. A task the showrunner closed or called off is not picked back up
-- from the writer's side: reopening is the showrunner's act.

create or replace function public.assignment_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.request_is_service_role() or public.curates_room(new.room_id) then
    return new;
  end if;

  if new.room_id is distinct from old.room_id
     or new.assignee_id is distinct from old.assignee_id
     or new.assigned_by is distinct from old.assigned_by
     or new.target_kind is distinct from old.target_kind
     or new.target_id is distinct from old.target_id
     or new.target_label is distinct from old.target_label
     or new.note is distinct from old.note
     or new.due_on is distinct from old.due_on
     or new.created_at is distinct from old.created_at then
    raise exception 'Only the showrunner changes what was asked for.'
      using errcode = 'check_violation';
  end if;

  if old.state in ('cancelled', 'done') then
    raise exception 'This task is closed. Only the showrunner reopens it.'
      using errcode = 'check_violation';
  end if;

  if new.state not in ('accepted', 'in_progress') then
    raise exception 'Say you have started it; closing a task is the showrunner''s.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke execute on function public.assignment_guard() from public, anon, authenticated;
