-- Themes and motifs (addendum 12).
--
-- **Two tables, not one with a kind**, which the spec asks for twice and is
-- right about. The interface requirement is that they can never be accidentally
-- merged — separate lists, separate lanes, separate choices on the right-click
-- — and the fields bear it out: a theme has an intended arc and a motif has a
-- type, and neither means anything on the other. One table would carry both
-- half-empty and the first tidy-up would collapse them.
--
-- **There is no occurrence table here, and that is the point.** The spec's §12
-- asks for a polymorphic occurrence service so future research types can reuse
-- the tagging and indexing infrastructure. One already exists: `usage_links`
-- (0039) carries an owner kind, an owner id, a scene, a beat, an element and a
-- quote, which is every field §5 lists. This migration widens its owner kind
-- and gives it the one field it lacked.

create table if not exists public.research_themes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null default '',
  -- What the theme is: the idea, the question, the value at issue.
  description text not null default '',
  -- Where it is meant to go. A theme's own field: a motif recurs, a theme
  -- develops, and there is nowhere on a motif for this to mean anything.
  arc_notes text not null default '',
  notes text not null default '',
  state text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint research_themes_state check (state in ('active', 'resolved', 'set_aside'))
);

create index if not exists research_themes_project_idx on public.research_themes (project_id);

create table if not exists public.research_motifs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null default '',
  description text not null default '',
  -- What kind of thing recurs. A motif's own field, and the reason a motif is
  -- not a theme. `custom` because a motif is whatever the writer keeps putting
  -- in, and a closed list would be the module deciding what counts.
  motif_type text not null default 'visual',
  notes text not null default '',
  state text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint research_motifs_state check (state in ('active', 'resolved', 'set_aside')),
  constraint research_motifs_type check (
    motif_type in ('visual', 'object', 'phrase', 'sound', 'colour', 'gesture', 'location', 'symbolic', 'custom')
  )
);

create index if not exists research_motifs_project_idx on public.research_motifs (project_id);

-- A motif that belongs to a theme. It relates them and never merges them: the
-- bell is a motif of *what a town owes its dead*, and saying so must not put
-- the bell's nine recurrences into the theme's occurrence list, because the
-- theme is not therefore nine times explored.
create table if not exists public.theme_motif_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  theme_id uuid not null references public.research_themes (id) on delete cascade,
  motif_id uuid not null references public.research_motifs (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint theme_motif_links_once unique (theme_id, motif_id)
);

create index if not exists theme_motif_links_project_idx on public.theme_motif_links (project_id);
create index if not exists theme_motif_links_theme_idx on public.theme_motif_links (theme_id);
create index if not exists theme_motif_links_motif_idx on public.theme_motif_links (motif_id);

-- ------------------------------------------------- the occurrence, widened

-- What this moment contributes, in the writer's words. Empty on everything the
-- Character Creator makes — *where it landed* is the whole of what a pin says
-- there — and used by a theme's occurrence, where *this is where it turns* is a
-- note about the moment rather than about the theme.
alter table public.usage_links add column if not exists note text not null default '';

-- 'theme' and 'motif' join the list. No new table, no second index, no second
-- reverse lookup: the record was already general and only its vocabulary was
-- narrow.
alter table public.usage_links drop constraint if exists usage_links_owner_kind;
alter table public.usage_links add constraint usage_links_owner_kind
  check (owner_kind in ('characterization', 'arc_point', 'theme', 'motif'));

-- ------------------------------------------------------------------- policies

alter table public.research_themes enable row level security;
alter table public.research_motifs enable row level security;
alter table public.theme_motif_links enable row level security;

-- Read by whoever reads the project, written by whoever writes it — the pair
-- 0024 split apart. One select policy and three mutating ones rather than a
-- read policy and a `for all`, because `for all` includes select and the two
-- would then be evaluated on every row of every read.
create policy research_themes_read on public.research_themes
  for select using (public.may_read_project(project_id));
create policy research_themes_insert on public.research_themes
  for insert with check (public.may_write_project(project_id));
create policy research_themes_update on public.research_themes
  for update using (public.may_write_project(project_id))
  with check (public.may_write_project(project_id));
create policy research_themes_delete on public.research_themes
  for delete using (public.may_write_project(project_id));

create policy research_motifs_read on public.research_motifs
  for select using (public.may_read_project(project_id));
create policy research_motifs_insert on public.research_motifs
  for insert with check (public.may_write_project(project_id));
create policy research_motifs_update on public.research_motifs
  for update using (public.may_write_project(project_id))
  with check (public.may_write_project(project_id));
create policy research_motifs_delete on public.research_motifs
  for delete using (public.may_write_project(project_id));

create policy theme_motif_links_read on public.theme_motif_links
  for select using (public.may_read_project(project_id));
create policy theme_motif_links_insert on public.theme_motif_links
  for insert with check (public.may_write_project(project_id));
create policy theme_motif_links_update on public.theme_motif_links
  for update using (public.may_write_project(project_id))
  with check (public.may_write_project(project_id));
create policy theme_motif_links_delete on public.theme_motif_links
  for delete using (public.may_write_project(project_id));

create trigger research_themes_touch_updated_at before update on public.research_themes
  for each row execute function public.touch_updated_at();
create trigger research_motifs_touch_updated_at before update on public.research_motifs
  for each row execute function public.touch_updated_at();
create trigger theme_motif_links_touch_updated_at before update on public.theme_motif_links
  for each row execute function public.touch_updated_at();

comment on table public.research_themes is
  'An idea carried through the story (addendum 12). Separate from a motif by design: a theme develops, a motif recurs.';
comment on table public.research_motifs is
  'A recurring concrete element (addendum 12). Separate from a theme by design.';
comment on table public.theme_motif_links is
  'A motif that belongs to a theme. Relates them; never merges their occurrence lists.';
