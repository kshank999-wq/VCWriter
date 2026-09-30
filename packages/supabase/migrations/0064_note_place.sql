-- Where in the book a note belongs (addendum 28 §2).
--
-- From Ken: *you have a table of contents that you fill out that also
-- populates the research section… you can just drop it in and it'll show up in
-- the research section under those defined chapters.*
--
-- **Two columns and no table.** A chapter is a `chapter` story marker and a
-- section is a structural unit, both of which already exist, so what a note
-- needs is a reference to one of them — which is `story_links`' own shape
-- (`from_type` text, `from_id` uuid) said of a single field rather than a
-- second join table to keep in step.
--
-- `place_type` is **text** rather than an enum, for 0060's reason: the values
-- are `storyEntityTypeSchema`'s, that list has been widened six times, and an
-- enum would refuse at the door a row a newer build wrote.
--
-- No foreign key. A note pointing at a chapter that has been deleted reads as
-- unfiled by itself (`placeStillThere`), which is the behaviour we want and is
-- how the graveyard's promise is kept everywhere else — a cascade here would
-- instead silently rewrite the writer's filing.
alter table public.research_items
  add column if not exists place_type text,
  add column if not exists place_id uuid;

-- Read by `contentsShelf` every time the research room draws its table of
-- contents, which on a long book is a row per chapter over every note.
create index if not exists research_items_place_idx
  on public.research_items (project_id, place_type, place_id)
  where place_id is not null;
