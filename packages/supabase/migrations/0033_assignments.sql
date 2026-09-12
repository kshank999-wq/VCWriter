-- Assignments (addendum 07 §8, stage 8).
--
-- Ken: "if a specific person is assigned to a task, there needs to be a menu
-- for that to assign tasks."
--
-- **An assignment is not a lock**, and nothing in this file behaves like one:
-- no policy anywhere consults an assignment before letting somebody write, and
-- none ever should. It records who is *expected* to write something, which is
-- a different thing, and §1 is why — two writers taking a run at the same scene
-- is a room working properly, and both runs survive.

create type public.assignment_target as enum ('scene', 'beat', 'act', 'research');

create type public.assignment_state as enum (
  'assigned',
  'accepted',
  'in_progress',
  'done',
  'cancelled'
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  -- A person, never a role. `cascade` only because an account that no longer
  -- exists cannot be owed anything; a seat *taken out of the room* keeps its
  -- assignments, which is a different act entirely (§16).
  assignee_id uuid not null references auth.users (id) on delete cascade,
  -- Who asked. `set null` rather than cascade: the ask outlives the asker.
  assigned_by uuid references auth.users (id) on delete set null,

  -- What it is about, where it is about something that exists.
  --
  -- **No foreign key here, deliberately.** The record it names lives in the
  -- project *document*, and every branch carries its own copy of the master's
  -- scenes under the same ids — which is exactly what lets one assignment mean
  -- the same thing on four writers' lines at once. A foreign key would tie it
  -- to the master's row and quietly stop being true the moment anybody worked
  -- on a branch.
  target_kind public.assignment_target,
  target_id uuid,
  -- What the record was called when it was assigned, so the row still reads
  -- after a rename, and for a reader who cannot open the scene.
  target_label text not null default '',

  -- What is being asked for. With no target this is the whole assignment: a
  -- task, which is the thing Ken actually asked for.
  note text not null default '',
  -- A date rather than a timestamp: a room works in days.
  due_on date,
  state public.assignment_state not null default 'assigned',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- An assignment that points at nothing and says nothing is not an ask.
  constraint assignments_say_something check (target_kind is not null or length(btrim(note)) > 0),
  -- A kind without an id, or an id without a kind, is half a target.
  constraint assignments_whole_target check ((target_kind is null) = (target_id is null))
);

create index if not exists assignments_room_idx on public.assignments (room_id, created_at desc);
create index if not exists assignments_assignee_idx on public.assignments (assignee_id);
create index if not exists assignments_target_idx on public.assignments (target_kind, target_id);
create index if not exists assignments_by_idx on public.assignments (assigned_by);

create trigger assignments_touch_updated_at before update on public.assignments
  for each row execute function public.touch_updated_at();

-- What the assignee may change about their own row.
--
-- Row-level security is row-level: a policy that lets somebody update their own
-- assignment lets them update *every column* of it, including who it belongs to
-- and what was asked. Stage 6 answered that for submissions by not sharing the
-- update at all, but here the writer genuinely has something to say — how their
-- own work is going — so the column question gets a column answer.
--
-- Called off is not among them, on purpose: calling an assignment off is the
-- showrunner unasking for it, and it is not the writer's to do.
create or replace function public.assignment_guard()
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
    raise exception 'Say how it is going; calling it off is the showrunner’s.'
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

-- Revoked from `authenticated` as well, which the eight policy helpers cannot
-- be: a policy expression is evaluated as the calling role and would stop
-- working, but a **trigger** function's EXECUTE is checked when the trigger is
-- created and never again when it fires. So nobody can reach this over the
-- REST interface and it still guards every update. (Supabase's default
-- privileges grant `authenticated` execute on new functions, so this has to be
-- said explicitly rather than relying on the revoke from `public`.)
revoke execute on function public.assignment_guard() from public, anon, authenticated;

create trigger assignments_guard before update on public.assignments
  for each row execute function public.assignment_guard();

alter table public.assignments enable row level security;

-- Read: anybody in the room.
--
-- Wider than a submission's read on purpose. Who owes what is not a secret from
-- the room — §8 puts it on the dashboard as a column — and a writer who cannot
-- see that a scene is already asked of somebody is a writer about to duplicate
-- it by accident. It is not a lock; it is the information that makes a lock
-- unnecessary.
create policy assignments_read on public.assignments
  for select using (public.in_room(room_id));

-- Making one is the showrunner's, and the assignee must be in the room.
create policy assignments_make on public.assignments
  for insert with check (
    public.curates_room(room_id)
    -- Qualified, and it matters: unqualified `room_id` inside the subquery
    -- would bind to `room_seats.room_id` and compare the column with itself.
    and exists (
      select 1 from public.room_seats s
      where s.room_id = assignments.room_id
        and s.user_id = assignments.assignee_id
        and s.state <> 'deactivated'
    )
  );

-- Changing one: the showrunner, or the person it is being asked of.
--
-- `using` alone decides an update; `with check` governs the row produced, and
-- repeating the clause is what stops somebody handing their assignment to
-- another person. What they may change *within* the row is the trigger's
-- question, above.
create policy assignments_move on public.assignments
  for update using (
    public.curates_room(room_id) or assignee_id = (select auth.uid())
  ) with check (
    public.curates_room(room_id) or assignee_id = (select auth.uid())
  );

-- No delete policy (§1). An assignment that should not have been made is
-- called off, which says what happened; deleting it says it never did.
