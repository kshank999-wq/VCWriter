-- A note to self about a card (addendum 26 §16b).
--
-- The handoff's card detail lists a Comment beside the working text, and the
-- record had nowhere for it: `body` is the working text — the words that
-- travel into the outline — and `source` is where the fact came from. A writer
-- with only those two would be typing *Pair with the Hans Gruber example?*
-- into the words the book is going to print.
--
-- Empty on every existing row, so nothing already written moves.
alter table public.research_items
  add column if not exists comment text not null default '';
