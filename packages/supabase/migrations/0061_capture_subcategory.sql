-- The writer's own word under the spoken category (addendum 09 §12).
--
-- Ken: *you can create subcategories for that project if you need to.*
--
-- One nullable text column, and the nullability is the design rather than
-- convenience: **a spoken subcategory is a word on the note and never a folder
-- in the project**. §1's line is that the phone captures and the desktop
-- places, so saying it creates nothing anywhere — no research category, no
-- project write, nothing a walk can grow behind somebody's back. What it buys
-- is that the inbox arrives divided, and that filing a whole group is one press
-- at the desk, which is where the folder is finally made.
--
-- Free text rather than a key or a foreign key to `research_categories`, for
-- two reasons. The obvious one is `category`'s (migration 0060): a value this
-- build has never heard of is still a note, and a column that can refuse one
-- cannot keep the inbox's promise that the last group is never hidden. The
-- other is that a reference would have to point at a folder that does not exist
-- yet — the phone has no project document in front of it, and inventing the row
-- so the reference could be made is the taxonomy-from-a-pocket this refuses.
alter table public.capture_items
  add column if not exists subcategory text;

-- Read by the desktop inbox to divide one category's notes, so the index is the
-- pair rather than the column alone; every query that reaches it has already
-- narrowed to a project.
create index if not exists capture_items_project_subcategory_idx
  on public.capture_items (project_id, subcategory)
  where subcategory is not null;
