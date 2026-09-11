-- Writers Room: rooms, seats, and the one question split in two.
--
-- Addendum 07 stage 1. Two tables and one change of mind about an existing
-- function, and the function is the whole point of the migration.
--
-- Since 0001, every child table in the project schema has carried the same
-- policy: `public.owns_project(project_id)`. One function decided who may
-- touch a project's rows, everywhere. Addendum 07 §3.2 says that is the seam
-- the Room enters through — widen the question rather than write a second set
-- of per-table policies that would have to be kept in step with the first.
--
-- It splits because the roles differ in exactly that way: a Viewer reads
-- approved material, an Editor comments without writing, a Writer writes to a
-- branch of their own. So `may_read_project` and `may_write_project`, and
-- every table asks the right one.

-- ------------------------------------------------------------------ rooms

create type public.room_role as enum ('owner', 'writer', 'editor', 'viewer');
create type public.seat_state as enum ('invited', 'active', 'deactivated');

-- A room is attached to a project somebody already owns (§1). It is not a
-- second copy of the project and holds nothing about the story.
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null default '',
  -- What the subscription covers before another seat is billed (§14). Data
  -- rather than a hard-coded rule, exactly as `licenses.max_activations` is.
  included_seats integer not null default 1 check (included_seats > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One room per project: a second room over the same story would be a second
  -- answer to who may read it.
  constraint rooms_project_unique unique (project_id)
);

-- One collaborator's place in a room: billable, revocable, and never deleted.
--
-- `user_id` is null until an invitation is taken up, because an invitation is
-- to an address and the person behind it may not have an account yet. That is
-- also what keeps invited seats distinguishable from active ones for billing
-- (§14) without a second flag.
create table if not exists public.room_seats (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  email text not null,
  -- Permission. This is the column the policies read.
  role public.room_role not null default 'writer',
  -- Credit — 'Staff Writer', 'Co-Producer'. Nothing reads it but a person
  -- (§6): conflating the two is how a writer ends up with producer rights
  -- because somebody wanted the word on a page.
  title text not null default '',
  display_name text not null default '',
  -- The letters in the top corner of every page of this writer's draft
  -- (§6.1). Empty means read them off the name.
  initials text not null default '',
  colour text not null default '',
  state public.seat_state not null default 'invited',
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  deactivated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One standing seat per address per room. A deactivated seat keeps its row —
-- removing a seat removes access and never authorship (§16) — and a person can
-- be deactivated, invited back and deactivated again, so the index binds only
-- the seats that are still standing.
create unique index if not exists room_seats_one_standing
  on public.room_seats (room_id, lower(email))
  where state <> 'deactivated';

-- The invitation itself, kept **out of the row a member can read**.
--
-- Row-level security is row-level: a policy that lets the room see who else is
-- in it would let them see a pending invitation's token as well, and a Viewer
-- who took up a pending Writer invitation would have promoted themselves. The
-- token therefore lives in its own table with RLS on and **no policy at all**,
-- which is the one arrangement nobody but the server can read — an invitation
-- is redeemed by following a link, and the server is what reads it.
--
-- It expires, so a forwarded email does not stay a way into the room for ever.
create table if not exists public.room_invitations (
  seat_id uuid primary key references public.room_seats (id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.room_invitations enable row level security;

create index if not exists room_seats_room_idx on public.room_seats (room_id, state);
create index if not exists room_seats_user_idx on public.room_seats (user_id) where user_id is not null;
create index if not exists rooms_project_idx on public.rooms (project_id);

create trigger rooms_touch_updated_at before update on public.rooms
  for each row execute function public.touch_updated_at();
create trigger room_seats_touch_updated_at before update on public.room_seats
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------- the question, split in two

-- Anyone with a live seat in the room may read the project. Security definer
-- for the same reason `owns_project` is: the policy has to read `projects` and
-- `room_seats` without recursing through their own row-level security.
create or replace function public.may_read_project(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.projects p
    where p.id = target and p.owner_id = (select auth.uid())
  ) or exists (
    select 1
    from public.room_seats s
    join public.rooms r on r.id = s.room_id
    where r.project_id = target
      and s.user_id = (select auth.uid())
      and s.state = 'active'
  );
$$;

-- Writing is the owner's, and for now only the owner's.
--
-- This is deliberate and it is not the finished answer. A Writer writes to a
-- **branch** (§9), and branches arrive in stage 2; until they exist, letting a
-- Writer write to the project's own rows would let one writer's edit land on
-- top of another's, which is precisely what §1 forbids. So the function is
-- written with the room already in view and grants nothing yet — widening it
-- is a one-place change when there is somewhere safe for that writing to go.
create or replace function public.may_write_project(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.projects p
    where p.id = target and p.owner_id = (select auth.uid())
  );
$$;

revoke execute on function public.may_read_project(uuid) from public, anon;
revoke execute on function public.may_write_project(uuid) from public, anon;
grant execute on function public.may_read_project(uuid) to authenticated;
grant execute on function public.may_write_project(uuid) to authenticated;

comment on function public.may_write_project(uuid) is
  'Addendum 07 §3.2. Owner-only until branches exist (stage 2): a writer writes to a branch, never to the master.';

-- ---------------------------------------------------- every table asks again

-- **Two policies per table, not one**, and this is the part worth being careful
-- about. A single `for all using (read) with check (write)` would be wrong:
-- `with check` governs the rows a statement *produces*, so an UPDATE or a
-- DELETE is decided by `using` alone — and a Viewer would have been able to
-- delete the script they were invited to read. Reading and writing are
-- therefore separate policies with separate commands, and Postgres allows a
-- row when any policy that applies to the command allows it.

-- The project row itself.
drop policy if exists "projects belong to their owner" on public.projects;

create policy projects_member_read on public.projects
  for select
  using (public.may_read_project(id));

create policy projects_owner_write on public.projects
  for all
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- And every child table, in one place, the way 0001 wrote them.
do $$
declare
  target text;
begin
  foreach target in array array[
    'lanes', 'structural_units', 'beats', 'research_categories', 'research_items',
    'characters', 'story_links', 'setups_payoffs', 'snapshots', 'story_markers',
    'writing_sessions', 'character_categories',
    'boards', 'sculptor_nodes', 'sculptor_links', 'outlines', 'outline_items'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', target || '_owner_access', target);
    execute format(
      'create policy %I on public.%I for select using (public.may_read_project(project_id))',
      target || '_member_read', target
    );
    execute format(
      'create policy %I on public.%I for all using (public.may_write_project(project_id)) with check (public.may_write_project(project_id))',
      target || '_owner_write', target
    );
  end loop;
end;
$$;

-- ------------------------------------------------------------ who sees a room

alter table public.rooms enable row level security;
alter table public.room_seats enable row level security;

-- A room is visible to everyone in it and changeable only by the project's
-- owner. The showrunner's other powers — inviting, retitling, recolouring —
-- run through the server with the service role, because an invitation writes
-- a row for somebody who is not the caller.
create policy rooms_member_read on public.rooms
  for select
  using (public.may_read_project(project_id));

create policy rooms_owner_write on public.rooms
  for all
  using (public.may_write_project(project_id))
  with check (public.may_write_project(project_id));

-- A member sees who else is in the room: names, titles and colours are what
-- the dashboard is made of (§10). The token is not on this row at all — see
-- `room_invitations` above for why.
create policy room_seats_member_read on public.room_seats
  for select
  using (
    exists (
      select 1 from public.rooms r
      where r.id = room_seats.room_id and public.may_read_project(r.project_id)
    )
  );

create policy room_seats_owner_write on public.room_seats
  for all
  using (
    exists (
      select 1 from public.rooms r
      where r.id = room_seats.room_id and public.may_write_project(r.project_id)
    )
  )
  with check (
    exists (
      select 1 from public.rooms r
      where r.id = room_seats.room_id and public.may_write_project(r.project_id)
    )
  );
