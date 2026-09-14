-- Locations (addendum 14).
--
-- A location is a **project asset like a character**, not a property of a
-- scene: one row, used by any number of scenes, edited in one place.
--
-- **There is no scene_locations table, and the absence is the point.** Which
-- scenes use a place is worked out by matching the place in each scene's
-- heading — so a heading edited by hand moves the scene between locations with
-- nothing running, and there is no membership list to drift out of step with
-- what the script actually says. This is the same absence `usage_links` has for
-- *used* and the book index has for page numbers.
--
-- The prepared descriptions ride inside the row as jsonb rather than in a table
-- of their own. They are *parts of* a location — named paragraphs kept for
-- possible use — and a second table would make deleting a place a two-step
-- deletion for no gain. Nothing else references one.

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  -- As the heading prints it: MILLER HOUSE.
  name text not null default '',
  -- Defaults for a heading, never facts about the place: a scene at the same
  -- house at night is a scene, not a second house, so the scene keeps its own
  -- heading and these only fill it in.
  setting text not null default 'INT.',
  time_of_day text not null default 'DAY',
  short_name text not null default '',
  notes text not null default '',
  -- Several per location (§3.3): a place is described differently the second
  -- time it is seen, and one field would make the writer overwrite the first
  -- description to write the second.
  descriptions jsonb not null default '[]'::jsonb,
  -- Put away rather than deleted, because a location a scene still names is not
  -- something to remove behind the writer's back (§8).
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists locations_project_idx on public.locations (project_id);
create index if not exists locations_name_idx on public.locations (project_id, name);

alter table public.locations enable row level security;

-- Read by whoever reads the project, written by whoever writes it. One select
-- policy and three mutating ones, not a read policy and a `for all`.
create policy locations_read on public.locations
  for select using (public.may_read_project(project_id));
create policy locations_insert on public.locations
  for insert with check (public.may_write_project(project_id));
create policy locations_update on public.locations
  for update using (public.may_write_project(project_id))
  with check (public.may_write_project(project_id));
create policy locations_delete on public.locations
  for delete using (public.may_write_project(project_id));

create trigger locations_touch_updated_at before update on public.locations
  for each row execute function public.touch_updated_at();

comment on table public.locations is
  'A reusable place with prepared descriptions (addendum 14). Which scenes use it is read from their headings, never stored.';
