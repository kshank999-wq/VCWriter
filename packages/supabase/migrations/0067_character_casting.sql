-- A play's cast page (addendum 38 §4).
--
-- Addendum 37 named the cast page and left it unbuilt: what it asks beyond
-- the cast the cues already make — a playing age, a vocal range, who a role
-- is doubled with, and whether it is listed at all — is the character record
-- widened, and this is that widening. One object rather than five columns,
-- 0053's reason: it is one group on one screen and every field in it is
-- optional together.
--
-- Named `casting` rather than `cast`, which is a reserved word.
alter table public.characters
  add column if not exists casting jsonb not null default '{}'::jsonb;

comment on column public.characters.casting is
  'The role on a play''s cast page (addendum 38 §4): {include, description, playingAge, vocalRange, doubles}. Empty until filled in; read only where a format prints a cast page.';
