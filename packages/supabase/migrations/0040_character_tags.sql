-- What the writer calls somebody (addendum 08 §5, stage 2).
--
-- The Character Creator's Overview tab is name, aliases, role in the story,
-- description and **tags**, and the first four already had somewhere to live.
--
-- Not the heading a character is filed under — that says how much of the story
-- they are in, and it is already a column — and not a trait, which says what
-- they are like and is a record of its own. This is the writer's own shorthand
-- for who somebody is: *antagonist*, *comic relief*, *the one who knows*. A
-- research item has carried exactly this since 0001, so it is the same idea
-- about a person, in the same encoding, and free text for the same reason: the
-- vocabulary is theirs.

alter table public.characters
  add column if not exists tags text[] not null default '{}';

comment on column public.characters.tags is
  'The writer''s own shorthand for who this character is (addendum 08 §5). Not the category, which is how much of the story they are in, and not a trait, which is what they are like.';
