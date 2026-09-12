-- Submitting, and the queue it lands in (addendum 07 §10, stage 6).
--
-- A submission **references the version it was taken from and copies nothing**.
-- That is what lets the writer carry straight on while the showrunner reads:
-- a version cannot be changed once it exists (the trigger in 0026 refuses even
-- the service role), so what was submitted is what is read, for good.
--
-- This is also where reading widens for the first time. Until now a version was
-- readable by its author or, as the master, by the room; now a version that has
-- been submitted is also readable by whoever curates the room it was submitted
-- to. §7 still holds: an *unsubmitted* draft is nobody else's, and submitting
-- is the act that changes that.

create type public.submission_kind as enum ('script', 'research');

create type public.submission_state as enum (
  'draft',
  'submitted',
  'in_review',
  'approved',
  'revision_requested',
  'rejected',
  'incorporated'
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  -- The line it came off, so a queue can say whose it is. Null where the
  -- branch has gone; the submission is not lost with it (§1).
  branch_id uuid references public.branches (id) on delete set null,
  -- `restrict`, said out loud: what was submitted cannot be got rid of from
  -- underneath the submission. Versions are immutable anyway; this is the
  -- same promise written where a reader of the schema will see it.
  version_id uuid not null references public.versions (id) on delete restrict,
  author_id uuid not null references auth.users (id) on delete cascade,
  kind public.submission_kind not null default 'script',
  state public.submission_state not null default 'submitted',
  note text not null default '',
  reply text not null default '',
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists submissions_room_idx on public.submissions (room_id, created_at);
create index if not exists submissions_author_idx on public.submissions (author_id);
create index if not exists submissions_version_idx on public.submissions (version_id);
create index if not exists submissions_branch_idx on public.submissions (branch_id);
create index if not exists submissions_decided_idx on public.submissions (decided_by);

create trigger submissions_touch_updated_at before update on public.submissions
  for each row execute function public.touch_updated_at();

-- Who runs this room: the project's owner, or a seat the room has made one.
create or replace function public.curates_room(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.rooms r
    where r.id = target
      and (
        public.may_write_project(r.project_id)
        or exists (
          select 1 from public.room_seats s
          where s.room_id = r.id
            and s.user_id = (select auth.uid())
            and s.state = 'active'
            and s.role = 'owner'
        )
      )
  );
$$;

revoke execute on function public.curates_room(uuid) from public, anon;

-- Whether this version has been submitted to a room the caller curates.
-- Security definer so the question is about the *version*, asked once, rather
-- than about which submissions the caller can already see.
create or replace function public.version_submitted_to_me(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.submissions s
    where s.version_id = target and public.curates_room(s.room_id)
  );
$$;

revoke execute on function public.version_submitted_to_me(uuid) from public, anon;

alter table public.submissions enable row level security;

-- Read: the writer who sent it, and whoever runs the room it went to.
create policy submissions_read on public.submissions
  for select using (
    author_id = (select auth.uid())
    or public.curates_room(room_id)
  );

-- Write: your own, off your own branch, and **only a version you wrote**.
-- The last clause is the one that matters: without it a writer could submit
-- somebody else's recorded version as though it were theirs.
create policy submissions_send on public.submissions
  for insert with check (
    author_id = (select auth.uid())
    and public.in_room(room_id)
    and (branch_id is null or public.owns_branch(branch_id))
    and exists (
      select 1 from public.versions v
      where v.id = version_id and v.author_id = (select auth.uid())
    )
  );

-- Deciding is the showrunner's, and **only** theirs.
--
-- Deliberately not shared with the author, however tempting: row-level
-- security is row-level, so a policy letting a writer edit their own note
-- would let them set their own state to approved. A writer who wants to say
-- something else sends another submission, which is the truthful record
-- anyway.
create policy submissions_decide on public.submissions
  for update using (public.curates_room(room_id)) with check (public.curates_room(room_id));

-- No delete policy, on purpose: no state in this vocabulary means gone (§1).

-- And the widening. One policy, three true answers, cheapest first.
drop policy if exists versions_read on public.versions;

create policy versions_read on public.versions
  for select using (
    author_id = (select auth.uid())
    or (kind = 'master' and public.in_room(room_id))
    or public.version_submitted_to_me(id)
  );
