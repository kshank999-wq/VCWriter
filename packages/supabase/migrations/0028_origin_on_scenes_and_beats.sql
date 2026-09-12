-- Who first made a scene or a beat (addendum 07 §6.3).
--
-- Origin is immutable and survives a merge into the master draft, which is
-- what makes §1's promise auditable rather than merely intended. Without a
-- column it would survive only inside a branch document and be lost the first
-- time a project's own rows were written — a silent way for a contribution to
-- stop having an author.
--
-- One jsonb column rather than two: it is a person and a timestamp, always
-- read and written whole with the record, and nothing queries inside it. It
-- deliberately holds **no colour and no initials** — those belong to the seat
-- and are read through it, so a writer who changes their colour has changed
-- every page they wrote rather than leaving stale copies of the old one.
alter table public.structural_units
  add column if not exists origin jsonb;

alter table public.beats
  add column if not exists origin jsonb;

comment on column public.beats.origin is
  'Addendum 07 6.3: { authorId, at }. Null outside a room. Names a person only; colour and initials are read through the seat.';
