-- What the linter caught in 0026, after the fact (addendum 07 §19).
--
-- Two findings, and both are the same kind of thing 0025 corrected: a policy
-- that says one true thing twice, and a foreign key with nothing to look it up
-- by. Neither changes who may read what.

-- 1. `versions` had two permissive SELECT policies, so both were evaluated on
--    every read of every row. They are one question with two true answers —
--    *it is mine*, or *it is the room's master* — and `or` is how a policy says
--    that. Written this way round deliberately: the cheap comparison first, so
--    the `in_room` lookup is only reached for a version that is not the
--    caller's own.
drop policy if exists versions_own_read on public.versions;
drop policy if exists versions_master_read on public.versions;

create policy versions_read on public.versions
  for select using (
    author_id = (select auth.uid())
    or (kind = 'master' and public.in_room(room_id))
  );

-- 2. `branches.owner_id` had no covering index. It is the column `owns_branch`
--    reads on every save a writer makes, and the one a room asks by to find
--    whose branch is whose — the same correction 0025 made for the four keys
--    that pointed at a scene or a beat.
create index if not exists branches_owner_idx on public.branches (owner_id);
