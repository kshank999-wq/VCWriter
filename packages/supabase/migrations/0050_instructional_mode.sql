-- Instructional / Book Mode (addendum 16, from Ken's spec).
--
-- **One column.** The spec's §11 lists eight entities and six of them already
-- exist here: a Chapter is a `structural_unit`, a Section is a `beat`, a
-- ContentItem is a manuscript element, a ResearchItem is a `research_item`, a
-- GraphicAsset is an `asset` that rides inside the project document, and a
-- Relationship is a `story_link`. The mode itself is a value of
-- `projects.format`, which is already free text as far as the database is
-- concerned.
--
-- What is genuinely missing is the one field a nonfiction author cannot work
-- without and a novelist never needs: **where a fact came from**.

-- A citation, in the author's own words: a book, a paper, a URL, a lecture, a
-- person. Deliberately free text — a writer pasting a DOI, a page reference
-- and a half-remembered author should not be stopped by a form, and formatting
-- a bibliography is a later problem and a different one.
--
-- Not to be confused with `origin` on the same table, which has meant *how it
-- got into the project* (typed, dictated, imported) since 0003. The two
-- questions are different and both are worth having.
alter table public.research_items add column if not exists source text not null default '';

comment on column public.research_items.source is
  'Where the material came from — a citation (addendum 16). Distinct from origin, which is how it entered the project.';

-- ------------------------------------------------- what is deliberately absent
--
-- **No graphics table.** A picture is an `asset`, and assets travel inside the
-- project document as data URIs rather than syncing as rows — a figure
-- pointing at a folder on somebody's desktop is a figure that is gone the
-- moment the file is sent anywhere (addendum 05 §3c). Caption and alt text
-- join the asset in the document for the same reason.
--
-- **No figure-placement table.** A figure is an element of the manuscript, so
-- it is already in the beat's element list and already syncs with it. A side
-- table would have to re-derive the reading order the manuscript knows, and
-- would disagree with it the first time somebody moved a paragraph.
--
-- **No figure numbers anywhere.** Figure 1, Figure 2 are counted in reading
-- order every time they are asked for, so moving a chapter renumbers
-- everything after it with nothing run — the same absence the book index's
-- page numbers rest on.
