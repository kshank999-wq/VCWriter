-- Addendum 02 §7: research is a tree.
--
-- A category becomes a folder that can sit inside another one and carry a
-- colour, so a character folder can hold a folder of their journey. The
-- parent is nulled rather than cascading if a folder goes: the domain moves
-- what was in it up to where it was, and nothing filed in research is ever
-- lost to a deleted folder.
alter table public.research_categories
  add column if not exists parent_id uuid references public.research_categories (id) on delete set null,
  add column if not exists color text;

create index if not exists research_categories_parent_id_idx
  on public.research_categories (parent_id);
