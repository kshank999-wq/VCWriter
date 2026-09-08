-- Addendum 02 §16: the headings a project files its cast under.
--
-- Every format has main characters and minor ones; a series has recurring
-- ones in between, which is the distinction a series actually makes and the
-- one that decides who carries over into the next episode. The headings are
-- rows rather than an enum because a writer who wants "The precinct" should
-- have it.
create table if not exists public.character_categories (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  order_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists character_categories_project_idx
  on public.character_categories (project_id, order_key);

create trigger character_categories_touch_updated_at
  before update on public.character_categories
  for each row execute function public.touch_updated_at();

alter table public.character_categories enable row level security;

create policy character_categories_owner_access on public.character_categories
  for all
  using (public.owns_project(project_id))
  with check (public.owns_project(project_id));

-- A character is filed under at most one heading. `set null` rather than
-- `cascade`: removing a heading must never take a character with it.
alter table public.characters
  add column if not exists category_id uuid
    references public.character_categories (id) on delete set null;

create index if not exists characters_category_idx
  on public.characters (category_id);

-- Addendum 02 §17: an episode's cast, carried on its marker. Used by episode
-- markers and ignored by the rest — an episode has a cast, an act does not.
-- One array column: it is read and written whole with the marker, and the
-- characters it names are rows of their own already.
alter table public.story_markers
  add column if not exists cast_ids uuid[] not null default '{}'::uuid[];
