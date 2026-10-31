-- Whether a section's or a subsection's heading is printed in a book's
-- manuscript, so two can be read as one by switching a heading off. On by
-- default, so nothing already written changes.
alter table public.structural_units
  add column if not exists heading_shown boolean not null default true;
alter table public.beats
  add column if not exists heading_shown boolean not null default true;
