-- Email notification (addendum 07 §14, stage 14).
--
-- One column, and the reason there is only one is the design: **the room
-- notifies; email interrupts, so email carries only what was addressed to
-- you** — a mention, an assignment given to you, a decision on your own
-- submission. `notify.ts` says why those three and nothing else.
--
-- **On the seat rather than on the person**, because the question is *do I want
-- mail from this room*: a writer on two shows wants the one that is shooting
-- and not the one in development, and one switch for both would make them
-- choose wrong.
--
-- **A boolean rather than a set of kinds.** Email carries exactly one thing, so
-- a table of preferences would be a preference screen for a single item.
--
-- **No notification table**, and this is the third migration in this module to
-- say so (0035 said it about what-is-new, and the activity trail has never had
-- one). A row per event is a second copy of something already written down.
-- What is recorded is that mail was *sent*, in `email_events`, which has done
-- that since spec §12.3 — and that is a record of an act by this system, not a
-- second copy of the room's.

alter table public.room_seats
  add column if not exists notify_by_email boolean not null default true;

comment on column public.room_seats.notify_by_email is
  'Whether the room emails this seat when somebody addresses them directly (addendum 07 §14, stage 14). Their own to set; nobody else''s.';

-- Their own, and nobody else's — not even the showrunner's.
--
-- 0024's update policy on this table is the showrunner's, for role, title,
-- colour and initials (§6). This is a different kind of field: a showrunner who
-- could turn somebody's mail back on would be a showrunner who can make a
-- person's phone ring, and §6's *the showrunner decides what you are called*
-- does not extend to that.
create policy room_seats_own_notifications on public.room_seats
  for update using (user_id = (select auth.uid()) and state = 'active')
  with check (user_id = (select auth.uid()) and state = 'active');

-- The policy says *your own row*; this says *and only that field*.
--
-- The same shape as 0033's assignment guard and for the same reason: RLS
-- answers **which rows**, and the question here is **which column**, which it
-- cannot answer. Without it the policy above would be a route to any role a
-- seat holder fancied.
--
-- The showrunner's own changes go through untouched — they come through the
-- service role, which RLS and this both sit behind, and a showrunner acting as
-- themselves is covered by the first branch.
create or replace function public.seat_notify_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.curates_room(new.room_id) then
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

drop trigger if exists room_seats_notify_guard on public.room_seats;
create trigger room_seats_notify_guard before update on public.room_seats
  for each row execute function public.seat_notify_guard();

-- A trigger function is called by the trigger and by nobody else. The same
-- revoke 0033 makes for the assignment guard, and the advisor asks for it by
-- name.
revoke execute on function public.seat_notify_guard() from public, anon, authenticated;
