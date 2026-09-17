-- The Chapter row (addendum 19 §2): one column.
--
-- A chapter in the manuscript has always been a `chapter` story marker — a
-- page between units that carries no text of its own — so a Chapter row in
-- the Outliner is not a new table. Promoting one promotes the sections under
-- it and then places the marker on the first of them, and from then on the
-- row and the marker are one thing: rename either and both change, which is
-- the promotion contract of addendum 06 §1 kept for a third kind.
--
-- So this is the third binding beside `bound_unit_id` and `bound_beat_id`,
-- null on a plan, and it lets go the same way the other two do: when the
-- marker goes, the row goes back to being a plan rather than claiming to be
-- a chapter that is not there.
alter table public.outline_items
  add column if not exists bound_marker_id uuid references public.story_markers (id) on delete set null;

create index if not exists outline_items_marker_idx on public.outline_items (bound_marker_id);

comment on column public.outline_items.bound_marker_id is
  'The chapter marker this row is, once promoted (addendum 19). Null on a plan; the third binding beside the unit and the beat.';
