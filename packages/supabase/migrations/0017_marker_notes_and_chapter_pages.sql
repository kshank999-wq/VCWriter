-- Addendum 02 §11: a marker is the point a writer puts in the story, and what
-- hangs off it depends on the format. A screenplay's acts carry a note. A
-- novel's and a short story's chapters can carry a page of their own — the
-- leaf a book prints between chapters, with the chapter's number, its name,
-- an epigraph and sometimes a device.
--
-- The page is one jsonb column rather than a table of its own: it is a
-- handful of switches and an optional small data URL, it is always read and
-- written whole with the marker, and nothing queries inside it.

alter table public.story_markers
  add column if not exists notes text not null default '',
  add column if not exists page jsonb not null default '{}'::jsonb;

-- A book's markers are chapters and parts, which the enum did not have.
alter type public.story_marker_kind add value if not exists 'chapter';
alter type public.story_marker_kind add value if not exists 'part';
