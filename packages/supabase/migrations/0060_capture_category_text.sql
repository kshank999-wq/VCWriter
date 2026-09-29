-- The captured category becomes the project's own vocabulary (addendum 09 §10).
--
-- §4 fixed five kinds of thought — Character, Plot Point, Idea, Theme, Arc —
-- for a phone that did not know which project it was in. The app has opened on
-- a project list since stage 5, so the words a writer may say are now the
-- project's own: a screenplay's Scene and Beat, a novel's Chapter and Passage,
-- a textbook's Section and Subsection, all read off the format by
-- `captureVocabulary` rather than written down here.
--
-- An enum cannot carry that without a migration per word, and worse: a value it
-- does not hold is refused outright, which would turn a note sent by a newer
-- phone into an error at the door. The inbox's promise is that the last group
-- is never hidden, and a column that can refuse a note cannot keep it.
--
-- The five keep their exact spellings, so every note ever captured reads back
-- as what it was, and nothing already stored moves.
alter table public.capture_items
  alter column category type text using category::text;

-- The type stays: `requested_routing` and the review screens still speak the
-- older, narrower vocabulary, and dropping it would be a second change riding
-- on this one.
