-- Who is on a card (addendum 03 §5).
--
-- The Sculptor's cards can name the people in them, and the document already
-- carries the list. Without a column for it the journey to the database drops
-- it in silence — the same hole 0028 closed for a scene's origin, and worth
-- closing in the same breath as the feature rather than after it.
--
-- jsonb rather than uuid[], to match `fields` on the same table: both are a
-- small list read and written whole with the card, and neither is ever queried
-- by its contents.
alter table public.sculptor_nodes
  add column if not exists character_ids jsonb not null default '[]'::jsonb;
