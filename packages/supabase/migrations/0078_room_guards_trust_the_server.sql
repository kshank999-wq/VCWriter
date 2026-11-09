-- The room's column guards let the site's own server through (addendum 07 §25.1).
--
-- 0033 (assignments) and 0044 (seats) each put a guard on UPDATE that limits
-- which columns a seat holder may change on their own row. Both said the
-- showrunner's changes "go through untouched — they come through the service
-- role". **They did not.** A trigger fires for the service role like anybody
-- else, and the guards' only way through was `curates_room()`, which asks
-- `auth.uid()`, and the service role has no user. So every change the server
-- made on somebody's behalf was refused as if a seat holder had tried it.
--
-- Found in the first live test: accepting an invitation is an update to the
-- seat (user, state, accepted_at) made by the server, and the join page
-- failed with "Your own seat is yours to be quiet on, and nothing else."
-- The same would have stopped the showrunner calling off an assignment.
--
-- The fix is the case the comments promised: a request made with the service
-- role is the server acting after its own checks, and is let through. Nothing
-- changes for a signed-in user, who still meets the same column rules.

create or replace function public.request_is_service_role()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  ) = 'service_role';
$$;

revoke execute on function public.request_is_service_role() from public, anon;

create or replace function public.seat_notify_guard()
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
     or new.user_id is distinct from old.user_id
     or new.email is distinct from old.email
     or new.role is distinct from old.role
     or new.title is distinct from old.title
     or new.display_name is distinct from old.display_name
     or new.initials is distinct from old.initials
     or new.colour is distinct from old.colour
     or new.state is distinct from old.state
     or new.invited_at is distinct from old.invited_at
     or new.accepted_at is distinct from old.accepted_at
     or new.deactivated_at is distinct from old.deactivated_at
     or new.created_at is distinct from old.created_at then
    raise exception 'Your own seat is yours to be quiet on, and nothing else.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

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

  if new.state not in ('accepted', 'in_progress', 'done') then
    raise exception 'Say how it is going; calling it off is the showrunner''s.'
      using errcode = 'check_violation';
  end if;

  -- And an ask that has been called off is not picked back up from this side:
  -- un-calling-off is the showrunner asking again.
  if old.state = 'cancelled' then
    raise exception 'This was called off. Only the showrunner asks for it again.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke execute on function public.seat_notify_guard() from public, anon, authenticated;
revoke execute on function public.assignment_guard() from public, anon, authenticated;
