-- Traits that pull against each other, and a moment noticed rather than
-- planned (addendum 25 §3, stage 3).
--
-- The spec asks for contradictory traits to be **allowed**, and allowing them
-- is not the same as being able to say so: a writer who has written "Miserly"
-- and "Secretly sentimental" knows the pair is the character, and the screen
-- should know it too.
--
-- **Said once and read both ways.** The pair is written on the trait it was
-- said from, and `conflictsFor` reads a trait's own list plus everybody whose
-- list names it — so there is one record of the fact rather than two free to
-- disagree the moment one is edited. That is why this is not a join table.
alter table public.character_traits
  add column if not exists conflicts_with text[] not null default '{}';

comment on column public.character_traits.conflicts_with is
  'Traits of the same character that this one pulls against (addendum 25 §3). Said once, on the trait it was said from, and read in both directions.';

-- Where the moment came from. **Not called `origin`**, which the handoff's
-- data model does: `origin` on a record has meant *who made it, in a room*
-- since addendum 07, and addendum 16 §2 had to separate `source` from it for
-- the same reason.
--
-- And it is a fact about provenance, **never a status**: a planned moment and
-- a found one are the same kind of thing, and both are used or on deck by the
-- same rule — no valid usage link means on deck, whoever thought of it.
alter table public.characterization_items
  add column if not exists found boolean not null default false;

comment on column public.characterization_items.found is
  'True where the moment came out of the manuscript through the right-click capture (addendum 25 §3). A badge, not a status: used and on deck are decided by the usage links either way.';
