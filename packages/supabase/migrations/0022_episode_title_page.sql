-- Spec §6.1, addendum 02 §17: an episode's own title page.
--
-- An episode is a script that goes out on its own, so it has its own front
-- page — its number, its name, its draft date — rather than borrowing the
-- series' whole. Null means it has never been filled in, and the series' page
-- stands in for it field by field.
--
-- One jsonb column rather than ten: it is ten short strings and a data URL,
-- always read and written whole with the marker, and nothing queries inside.
alter table public.story_markers
  add column if not exists title_page jsonb;
