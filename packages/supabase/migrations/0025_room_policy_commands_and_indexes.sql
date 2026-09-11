-- Two corrections to 0024, both raised by Supabase's own linter after it was
-- applied. Neither changes who can see or do anything.
--
-- 1. **A write policy was also a read policy.** 0024 gave every table a pair:
--    `<t>_member_read` for SELECT, and `<t>_owner_write` `for all`. But `for
--    all` includes SELECT, so two permissive policies were being evaluated on
--    every read of every row — the linter counted 101 of them. The fix is to
--    say what the write policy is *for*: INSERT, UPDATE and DELETE, and not
--    SELECT.
--
--    This is safe precisely because of how the two functions relate:
--    `may_write_project` is true only for the project's owner, and
--    `may_read_project` is true for the owner *and* for anyone with a live
--    seat. The writer is a subset of the reader, so the read policy already
--    covers every SELECT the write policy was covering. Nothing narrows.
--
-- 2. **Four foreign keys had no covering index.** `bound_unit_id` and
--    `bound_beat_id` on `sculptor_nodes` and `outline_items` — the columns
--    that say which scene or beat a node or a row *is* (addendum 03 §6,
--    addendum 06 §1). They are `on delete set null`, so deleting one scene
--    made Postgres scan both tables to find what pointed at it. 0011 made
--    exactly this correction for the tables that existed then; 0023 should
--    have carried it.

-- ------------------------------------------------------- the missing indexes

create index if not exists sculptor_nodes_bound_unit_idx
  on public.sculptor_nodes (bound_unit_id) where bound_unit_id is not null;
create index if not exists sculptor_nodes_bound_beat_idx
  on public.sculptor_nodes (bound_beat_id) where bound_beat_id is not null;
create index if not exists outline_items_bound_unit_idx
  on public.outline_items (bound_unit_id) where bound_unit_id is not null;
create index if not exists outline_items_bound_beat_idx
  on public.outline_items (bound_beat_id) where bound_beat_id is not null;

-- ------------------------------------------- one policy per command, per table

-- The project row itself.
drop policy if exists projects_owner_write on public.projects;

create policy projects_owner_insert on public.projects
  for insert with check (owner_id = (select auth.uid()));
create policy projects_owner_update on public.projects
  for update using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy projects_owner_delete on public.projects
  for delete using (owner_id = (select auth.uid()));

-- And every child table, in the one place they are all written.
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
    execute format('drop policy if exists %I on public.%I', target || '_owner_write', target);
    execute format(
      'create policy %I on public.%I for insert with check (public.may_write_project(project_id))',
      target || '_owner_insert', target
    );
    execute format(
      'create policy %I on public.%I for update using (public.may_write_project(project_id)) with check (public.may_write_project(project_id))',
      target || '_owner_update', target
    );
    execute format(
      'create policy %I on public.%I for delete using (public.may_write_project(project_id))',
      target || '_owner_delete', target
    );
  end loop;
end;
$$;

-- The room's own two tables, the same way.
drop policy if exists rooms_owner_write on public.rooms;

create policy rooms_owner_insert on public.rooms
  for insert with check (public.may_write_project(project_id));
create policy rooms_owner_update on public.rooms
  for update using (public.may_write_project(project_id))
  with check (public.may_write_project(project_id));
create policy rooms_owner_delete on public.rooms
  for delete using (public.may_write_project(project_id));

drop policy if exists room_seats_owner_write on public.room_seats;

create policy room_seats_owner_insert on public.room_seats
  for insert with check (
    exists (select 1 from public.rooms r
            where r.id = room_seats.room_id and public.may_write_project(r.project_id))
  );
create policy room_seats_owner_update on public.room_seats
  for update using (
    exists (select 1 from public.rooms r
            where r.id = room_seats.room_id and public.may_write_project(r.project_id))
  )
  with check (
    exists (select 1 from public.rooms r
            where r.id = room_seats.room_id and public.may_write_project(r.project_id))
  );
create policy room_seats_owner_delete on public.room_seats
  for delete using (
    exists (select 1 from public.rooms r
            where r.id = room_seats.room_id and public.may_write_project(r.project_id))
  );
