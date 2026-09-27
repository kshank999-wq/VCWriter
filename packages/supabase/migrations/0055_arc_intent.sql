-- What the writer says they are aiming at (addendum 25 §5, stage 5).
--
-- Addendum 08 §5 made an arc's shape a **reading** — a refusal makes it
-- refused whatever else is there — and the handoff asks for a
-- Grows / Falls / Refuses to change toggle. Both are right about different
-- moments: an arc with no points has no shape to read, and the toggle is what
-- makes the refusal furniture worth putting on the screen before there is
-- anything to refuse; a finished arc's shape is a fact about its points, and a
-- control that let somebody label a refusal *Grows* would be a control that
-- lies.
--
-- So this is an **intention and never the answer**. `arcShape` goes on reading
-- the points, nothing consults this to decide the shape, and where the two
-- disagree the screen says so rather than picking. That is addendum 13's
-- `movementOf` pointed at an arc.
--
-- Nullable because *not said* is a third state, different from either answer:
-- most arcs are written without anybody declaring where they are going.
alter table public.character_arcs
  add column if not exists intent text;

comment on column public.character_arcs.intent is
  'positive | negative | refused — what the writer is aiming at (addendum 25 §5). An intention, never the answer: the shape is still read from the points, and the screen says so where the two disagree. Null is "not said".';
