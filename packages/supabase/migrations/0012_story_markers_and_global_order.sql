-- Addendum 02 (the writing workspace), §8 and §9.
--
-- 1. Scene order is global: `structural_units.order_key` now positions a scene
--    among every scene in the project, not among its lane's. The column does
--    not change; what changes is which index answers the question the app
--    asks, which is "every scene of this project, in story order".
--
-- 2. Act markers: a labelled point in the story order, anchored to the scene
--    that starts it. One marker per scene; a scene going away takes its
--    marker with it (the app re-anchors before deleting, so the cascade only
--    ever fires for a scene that had no successor).

create index if not exists structural_units_story_idx
  on public.structural_units (project_id, order_key);

create type public.story_marker_kind as enum ('act', 'sequence', 'note');

create table public.story_markers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  unit_id uuid not null references public.structural_units (id) on delete cascade,
  kind public.story_marker_kind not null default 'act',
  title text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unit_id)
);

create index story_markers_project_idx on public.story_markers (project_id);

create trigger story_markers_touch_updated_at
  before update on public.story_markers
  for each row execute function public.touch_updated_at();

alter table public.story_markers enable row level security;

-- Same shape as every other child table: reachable only through a project the
-- caller owns. `owns_project` is a function, so the planner evaluates it once
-- per statement (see 0011 for why that matters).
create policy story_markers_owner_access on public.story_markers
  for all
  using (public.owns_project(project_id))
  with check (public.owns_project(project_id));
