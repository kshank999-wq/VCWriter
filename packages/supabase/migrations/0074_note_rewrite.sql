-- The rewrite of a research note, made beside the original in the research
-- room's rewrite screen (addendum 28 §7). The note's own words are kept as
-- they were caught; this is what goes on the track when it is placed.
alter table public.research_items
  add column if not exists rewrite text not null default '';
