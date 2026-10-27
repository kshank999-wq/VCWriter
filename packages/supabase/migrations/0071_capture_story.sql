-- The story of a collection a note was said for (addendum 27 §23).
--
-- Ken: *when you're on the note screen, there'll be a dropdown that allows you
-- to pick the short story that it's going to go into.*
--
-- The story's marker id, nullable: null on every format but a collection, and
-- where the writer chose none. **No foreign key**, for 0061's reason one step
-- on: a note queued on a phone offline may name a story the desk has since
-- removed, and a reference that refused it would lose the note at the door. A
-- note naming a story that is gone is still a note, and the desk reads it as
-- one with no story.
alter table public.capture_items
  add column if not exists story_marker_id uuid;
