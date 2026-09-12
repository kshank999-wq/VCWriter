-- The Curation Tray, and the master merge (addendum 07 §12, stage 9).
--
-- **A merge makes a new version and never rewrites what it drew from** (§1).
-- Nothing in this file updates a submission's document, a branch head or a
-- version: committing a merge *inserts* a master version beside the one before
-- it and points the room at the new one. A scene the room changed its mind
-- about is recovered by opening the version it came from, which is exactly
-- where it still is.

create type public.tray_kind as enum ('scene', 'beat');
create type public.tray_how as enum ('add', 'replace');

create table if not exists public.curation_items (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  -- The contribution it came from, so the merge record can name it. Null where
  -- the submission has gone; the tray item is not lost with it (§1).
  submission_id uuid references public.submissions (id) on delete set null,
  -- `restrict`: what is in the tray cannot be got rid of from underneath it.
  version_id uuid not null references public.versions (id) on delete restrict,
  author_id uuid not null references auth.users (id) on delete cascade,
  kind public.tray_kind not null,
  -- The record's id *inside that version's document*. No foreign key, and for
  -- the same reason assignments have none (0033): the record lives in a
  -- document, not in a row, and every branch carries its own copy under the
  -- same id.
  record_id uuid not null,
  label text not null default '',
  how public.tray_how not null default 'add',
  -- Which scene a beat joins, where the master does not already have it.
  into_unit_id uuid,
  note text not null default '',
  order_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One piece of one version, once. Taking it twice is a mistake rather than
  -- an intention, and the tray should say so rather than merging it twice.
  constraint curation_items_once unique (room_id, version_id, record_id)
);

create index if not exists curation_items_room_idx on public.curation_items (room_id, order_key);
create index if not exists curation_items_submission_idx on public.curation_items (submission_id);
create index if not exists curation_items_version_idx on public.curation_items (version_id);
create index if not exists curation_items_author_idx on public.curation_items (author_id);

create trigger curation_items_touch_updated_at before update on public.curation_items
  for each row execute function public.touch_updated_at();

alter table public.curation_items enable row level security;

-- The tray is the showrunner's workbench, not the room's noticeboard.
--
-- Narrower than assignments (0033), which everybody reads, and the difference
-- is real: who owes what is information a room needs, and *what the showrunner
-- is considering taking* is a decision in progress. A writer watching their
-- scene sit in a tray for three days learns nothing they can act on.
create policy curation_items_read on public.curation_items
  for select using (public.curates_room(room_id));

create policy curation_items_write on public.curation_items
  for insert with check (public.curates_room(room_id));

create policy curation_items_move on public.curation_items
  for update using (public.curates_room(room_id))
  with check (public.curates_room(room_id));

-- The one place in the Room where a delete policy is right (§1).
--
-- Taking something *out of the tray* destroys nothing: the submission is
-- untouched, the version it came from is immutable, and the piece is exactly
-- where it was. The tray is a scratch surface — refusing to clear it would
-- make the showrunner commit things to be rid of them.
create policy curation_items_clear on public.curation_items
  for delete using (public.curates_room(room_id));

-- The merge record §12 asks for: every source the master version drew from.
--
-- On the version rather than in a table of its own, deliberately. A version
-- cannot be changed once it exists (0026's trigger refuses even the service
-- role), so a record written here is permanently true and can never drift from
-- the version it describes — which a separate table could.
alter table public.versions
  add column if not exists merge jsonb;

comment on column public.versions.merge is
  'For a master version made by a merge: every source contribution it drew from (addendum 07 §12). Null on every other version.';

-- And a hole 0026 left, which this stage is the first to be able to close.
--
-- `versions_own_insert` let anybody in the room insert a version of any kind,
-- and `versions_master_read` makes a master-kind version readable by the whole
-- room — so a writer could have published their own draft to everybody by
-- labelling it `master`. Nothing did, because nothing made master versions
-- until now; making them is the showrunner's, and the policy should say so.
drop policy if exists versions_own_insert on public.versions;

create policy versions_own_insert on public.versions
  for insert with check (
    author_id = (select auth.uid())
    and public.in_room(room_id)
    and (branch_id is null or public.owns_branch(branch_id))
    and (kind <> 'master' or public.curates_room(room_id))
  );
