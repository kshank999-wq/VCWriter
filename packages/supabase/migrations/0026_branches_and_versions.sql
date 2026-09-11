-- Branches and versions: where a writer's work actually goes.
--
-- Addendum 07 stage 3, and it settles something stages 1 and 2 left open.
-- `may_write_project` was owner-only "until branches exist", and the assumption
-- was that branches would widen it. **They do not, and that is the better
-- answer.** A writer never writes to the project's rows at all: they write to
-- their own branch, which is a different table. §1 - one writer's work is never
-- destroyed by another's - becomes a fact about the schema rather than a rule
-- the policies have to be careful about, because there is no statement a writer
-- can issue that reaches the master.
--
-- Three tables, and the split between the second and third is the whole design.
--
--   branches      who has a working line, and what it was taken from
--   branch_heads  the desk: one mutable row, what autosave writes to
--   versions      the record: immutable, and enforced as immutable
--
-- Autosave is not history. A version is made when somebody decides one has been
-- reached - a snapshot they named, a submission, a master merge - and from that
-- moment it cannot be changed or removed by anyone, which is what §1 means by
-- "nothing in the Room's vocabulary means gone".

create type public.version_kind as enum ('snapshot', 'submission', 'master');

-- A writer's working line, taken from an approved version (§9).
create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  -- Whose line it is. A branch without an owner is nobody's draft.
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null default '',
  -- The version this was taken from. Null for the first branch in a room,
  -- which is taken from the project as it stands.
  base_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One working line per person per room, for now. A writer juggling three
-- drafts of the same episode is a real thing and not one stage 3 needs.
create unique index if not exists branches_one_per_person
  on public.branches (room_id, owner_id);

create index if not exists branches_room_idx on public.branches (room_id);

-- The desk. One row per branch, rewritten on every autosave, and **never**
-- read by anybody but the person whose desk it is (§7): a room where everyone
-- can read everyone's unfinished draft is a room where nobody drafts.
create table if not exists public.branch_heads (
  branch_id uuid primary key references public.branches (id) on delete cascade,
  -- The whole project, as the document already knows how to be. The same
  -- encoding the desktop writes to a file and `parseProjectFile` reads back,
  -- so a branch is a project and not a second shape for one.
  document jsonb not null,
  content_hash text not null default '',
  format_version integer not null default 1,
  saved_at timestamptz not null default now()
);

-- The record. Immutable, and the trigger below is what makes that true rather
-- than merely intended.
create table if not exists public.versions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  branch_id uuid references public.branches (id) on delete set null,
  author_id uuid references public.profiles (id) on delete set null,
  -- What this version came from, so the history is a chain and not a list.
  parent_version_id uuid references public.versions (id) on delete set null,
  kind public.version_kind not null default 'snapshot',
  -- What the writer called it: 'First Draft', 'Room Pass', 'Network Notes'.
  label text not null default '',
  summary text not null default '',
  document jsonb not null,
  content_hash text not null default '',
  format_version integer not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists versions_room_idx on public.versions (room_id, created_at desc);
create index if not exists versions_branch_idx on public.versions (branch_id, created_at desc);
create index if not exists versions_parent_idx on public.versions (parent_version_id);
create index if not exists versions_author_idx on public.versions (author_id);

-- A branch's base points at a version; declared after both tables exist.
alter table public.branches
  add constraint branches_base_version_fkey
  foreign key (base_version_id) references public.versions (id) on delete set null;

create index if not exists branches_base_idx on public.branches (base_version_id);

-- Which version the room's approved draft currently is (§9).
alter table public.rooms
  add column if not exists master_version_id uuid references public.versions (id) on delete set null;

create trigger branches_touch_updated_at before update on public.branches
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------- immutable, in fact

-- §1 says a merge never rewrites the contribution it drew from, and that
-- rejected and superseded material stays recoverable. A policy can stop the
-- room changing a version; only this stops *anything* changing one, including
-- a future migration written in a hurry and the service role the server uses.
create or replace function public.versions_are_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'A version cannot be % once it exists (addendum 07 §1). Make a new one.',
    case tg_op when 'UPDATE' then 'changed' else 'deleted' end;
end;
$$;

create trigger versions_no_update before update on public.versions
  for each row execute function public.versions_are_immutable();
create trigger versions_no_delete before delete on public.versions
  for each row execute function public.versions_are_immutable();

-- ------------------------------------------------------------- who sees what

-- Is this branch mine? Security definer for the same reason the others are:
-- the policy has to read `branches` without recursing through its own RLS.
create or replace function public.owns_branch(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.branches b
    where b.id = target and b.owner_id = (select auth.uid())
  );
$$;

-- Is this a room I am in? Answered through the project, so membership is
-- decided in exactly one place (§3.2).
create or replace function public.in_room(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.rooms r
    where r.id = target and public.may_read_project(r.project_id)
  );
$$;

revoke execute on function public.owns_branch(uuid) from public, anon;
revoke execute on function public.in_room(uuid) from public, anon;
grant execute on function public.owns_branch(uuid) to authenticated;
grant execute on function public.in_room(uuid) to authenticated;

alter table public.branches enable row level security;
alter table public.branch_heads enable row level security;
alter table public.versions enable row level security;

-- **That somebody has a branch is public to the room; what is on it is not.**
-- The dashboard needs to say who is working (§10); §7 says it must not say
-- what they have written.
create policy branches_room_read on public.branches
  for select using (public.in_room(room_id));

create policy branches_own_insert on public.branches
  for insert with check (owner_id = (select auth.uid()) and public.in_room(room_id));
create policy branches_own_update on public.branches
  for update using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- The desk is the writer's alone. No showrunner clause, deliberately: a
-- showrunner who can read an unsubmitted draft is a showrunner nobody drafts
-- in front of, and submitting is how work becomes theirs to read (§10).
create policy branch_heads_own_read on public.branch_heads
  for select using (public.owns_branch(branch_id));
create policy branch_heads_own_insert on public.branch_heads
  for insert with check (public.owns_branch(branch_id));
create policy branch_heads_own_update on public.branch_heads
  for update using (public.owns_branch(branch_id))
  with check (public.owns_branch(branch_id));

-- A version is the author's, and the room's once it is the master. Everything
-- between - a submission the showrunner may read - arrives with the review
-- queue, and adding it here before there is a workflow would be granting a
-- read nothing yet asks for.
create policy versions_own_read on public.versions
  for select using (author_id = (select auth.uid()));

create policy versions_master_read on public.versions
  for select using (kind = 'master' and public.in_room(room_id));

create policy versions_own_insert on public.versions
  for insert with check (
    author_id = (select auth.uid())
    and public.in_room(room_id)
    and (branch_id is null or public.owns_branch(branch_id))
  );

-- No update and no delete policy at all, on purpose. The trigger above refuses
-- both anyway; leaving the policies off means the refusal is stated twice, in
-- the two places somebody would look.
