-- A task can point at a passage of the script (addendum 07 §37).
--
-- From Ken, 11 November: the showrunner opens the script in the Writers Room,
-- highlights a section, and assigns it. The task then carries the beat it is
-- in (target_kind 'beat') and the passage itself: where it starts and ends,
-- by element id and character offset, and the words as they read when it
-- was assigned, so the task still says what was meant after the beat is
-- rewritten. The server reads the words out of the master rather than taking
-- them from the client.
--
-- The guard holds it still for the writer, like every other part of what was
-- asked.

alter table public.assignments add column if not exists passage jsonb;
alter table public.assignments drop constraint if exists assignments_passage_shape;
alter table public.assignments add constraint assignments_passage_shape check (
  passage is null
  or (
    target_kind = 'beat'
    and jsonb_typeof(passage) = 'object'
    and jsonb_typeof(passage -> 'quote') = 'string'
    and length(passage ->> 'quote') between 1 and 4000
  )
);

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
     or new.group_id is distinct from old.group_id
     or new.priority is distinct from old.priority
     or new.passage is distinct from old.passage
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
