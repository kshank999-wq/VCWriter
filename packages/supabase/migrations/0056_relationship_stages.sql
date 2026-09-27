-- How a relationship changes, as steps (addendum 25 §6, stage 6).
--
-- There was one free-text `evolution` — a paragraph about how a relationship
-- develops — and the handoff asks for the thing that paragraph is trying to
-- say: a sequence of states, each anchored to a scene, drawn as a strip.
--
-- **The paragraph stays.** It is what a writer typed, and replacing it to make
-- room for a better shape would lose their words for a reason nobody asked
-- for; it is the **older spelling** of this column, and where there are steps
-- they are what the screen shows, where there are none the paragraph stands.
-- One answer at a time (addendum 20 §14's `template`/`layout`).
--
-- **A step is anchored to the scene and never to a chapter number**, so
-- moving a scene moves the step and there is nowhere to type *Ch 7* — the
-- chapter is read from where that scene falls, which is the seventh time this
-- project has made a fact about the work a reading rather than a column. A
-- step with no scene is one the writer has planned and not placed, which is
-- the arc's own split.
--
-- JSON inside the row, being parts of a relationship rather than records of
-- their own: a location's prepared descriptions' precedent (addendum 14).
alter table public.character_relationships
  add column if not exists stages jsonb not null default '[]'::jsonb;

comment on column public.character_relationships.stages is
  'How it changes: [{id, unitId, state}] (addendum 25 §6). Anchored to scenes, so the chapter each falls in is read rather than stored, and a step with no scene is planned rather than placed. `evolution` is the older spelling and is kept.';
