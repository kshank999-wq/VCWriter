-- The archive can be emptied (addendum 27 §25).
--
-- Ken: *once they're transferred, those notes need to go into an archive. And
-- on the app itself, once the notes are transferred and verified, it'll give
-- you the option to delete those notes. And you can also delete it from the
-- actual desktop app.*
--
-- 0042 let a writer throw away only a note still waiting, keeping a filed one
-- as the trail behind the research note it became. That trail is now the
-- archive, and it is the writer's to clear: the research note is in the
-- project either way, and nothing in a project points back at the capture.
-- **Changing** a filed note stays refused — 0042's update policy is untouched
-- — so a filed note can be kept or deleted, and never rewritten.
drop policy if exists "a waiting capture can be thrown away" on public.capture_items;

create policy "a capture can be thrown away by whoever caught it" on public.capture_items
  for delete using (user_id = (select auth.uid()));
