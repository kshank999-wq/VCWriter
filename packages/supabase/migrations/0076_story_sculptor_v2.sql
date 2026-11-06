-- Story Sculptor 2.0 (addendum 03 v2).
--
-- The column board becomes a nested, typed mind map. The same three tables
-- carry it; nothing is dropped, so a version-1 board can still be read and
-- put back.
--
-- boards: the schema version, the reusable definitions, the view state
-- (what is open and folded, the card being shown as a mini map), the cards
-- placed by hand, the saved views, and the version-1 board kept whole for
-- rollback. All read and written whole with the board, like `columns`.
--
-- sculptor_nodes: a card's type lives in `kind` as before; `subtype` names a
-- custom type, `entity_id` is the definition it places. `column_id` is only a
-- version-1 card's, so it may now be null.
--
-- sculptor_links: the relation's type and whether it has a direction.

alter table public.boards
  add column if not exists schema_version integer not null default 1,
  add column if not exists entities jsonb not null default '[]'::jsonb,
  add column if not exists view_state jsonb not null default '{}'::jsonb,
  add column if not exists layout jsonb not null default '{}'::jsonb,
  add column if not exists views jsonb not null default '[]'::jsonb,
  add column if not exists legacy jsonb;

alter table public.sculptor_nodes
  alter column column_id drop not null,
  add column if not exists subtype text not null default '',
  add column if not exists entity_id uuid;

create index if not exists sculptor_nodes_entity_idx on public.sculptor_nodes (entity_id) where entity_id is not null;

alter table public.sculptor_links
  add column if not exists link_type text not null default 'related',
  add column if not exists directed boolean not null default true;
