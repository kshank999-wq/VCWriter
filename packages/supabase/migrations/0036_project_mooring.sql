-- Where a copy of a project stands against a room's master (addendum 07 §14,
-- stage 11).
--
-- §14 asks the desktop to say whether a local project is **current, ahead,
-- behind or diverged** from the cloud master, in those words. Answering it
-- needs one fact that is not otherwise written down: which master version this
-- document descends from, and what it hashed to at that moment. Without an
-- ancestor, a file that differs from the master could equally be ahead of it or
-- behind it, and the room would have to guess.
--
-- **On the project rather than in a per-device setting**, because it is a fact
-- about the *content*: two copies of the same file descend from the same master
-- version, so it rides with the document like everything else in it.
--
-- One jsonb rather than four columns. It is a single small object that is
-- always read and written whole, it is never queried by its parts, and four
-- nullable columns that are only ever meaningful together would be four chances
-- to have three of them set.
alter table public.projects
  add column if not exists mooring jsonb;

comment on column public.projects.mooring is
  'Which Writers Room master version this copy descends from, and its hash at that moment (addendum 07 §14). Null for a project that has never been in a room.';
