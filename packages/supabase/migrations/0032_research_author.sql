-- Whose idea it was (addendum 07 §11).
--
-- The brainstorming room colours every box by its author, and a box filed into
-- the project's own research has to keep that colour — so the fact travels
-- with the item rather than being remembered somewhere beside it.
--
-- **`author`, not `origin`.** `research_items.origin` has meant *how it got
-- into the project* — desktop, mobile capture, import — since 0001, and that
-- is a different question from *whose it is*. A scene and a beat carry the same
-- fact under the name `origin` (0028) because neither has a provenance column
-- to be confused with.
alter table public.research_items
  add column if not exists author jsonb;
