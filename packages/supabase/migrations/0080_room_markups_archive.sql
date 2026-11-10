-- Markups go to the archive, never away (addendum 07 §27.2).
--
-- From Ken: *when something is marked up, it doesn't get erased. You still
-- keep those in archive. Once they get fixed, you can send them to archive.*
--
-- `archived_at` is set or cleared by the writer it was sent to or by whoever
-- sent it; the guard still holds the marks, the note and who it was between
-- exactly as they were sent. There is still no delete.

alter table public.room_markups add column if not exists archived_at timestamptz;

drop policy if exists room_markups_seen on public.room_markups;
create policy room_markups_seen on public.room_markups
  for update using (recipient_id = (select auth.uid()) or author_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()) or author_id = (select auth.uid()));
