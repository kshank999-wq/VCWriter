-- Spec §8.2: the AI structural pass's reading of a scene.
--
-- Kept beside the writer's own `grid` rather than in the editor panel's
-- memory. A read costs real money to make, so paying for it again to see it
-- again would be a poor bargain, and a reading the writer argued with belongs
-- in the document next to the answer they settled on.
--
-- Null means nobody has asked, which is not the same as a read that found
-- nothing — that comes back as a row with valueShift 'none'.
alter table public.structural_units
  add column if not exists ai_read jsonb;
