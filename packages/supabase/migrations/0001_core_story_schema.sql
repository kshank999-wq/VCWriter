-- VC Writer core story schema.
--
-- Mirrors packages/domain (spec §13 "Suggested Core Data Model"). The domain
-- package remains the source of truth for shape and invariants; this schema
-- enforces the same rules at the database level so a bad client cannot break
-- them.
--
-- Security model (spec §14): least privilege. Every story table is protected by
-- row level security keyed to the owning project, so a signed-in user can only
-- ever reach their own work. Nothing here is readable with the anon key alone.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Application-level account record; auth.users holds the credentials.';

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------

create type public.project_format as enum ('screenplay', 'novel', 'stage_play', 'short_story', 'other');
create type public.project_status as enum ('development', 'drafting', 'revising', 'complete', 'archived');

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  format public.project_format not null,
  title text not null check (length(title) > 0),
  author text not null default '',
  logline text not null default '',
  elevator_pitch text not null default '',
  synopsis text not null default '',
  genre text not null default '',
  notes text not null default '',
  status public.project_status not null default 'development',
  poster_asset_path text,
  settings jsonb not null default '{}'::jsonb,
  -- Format version of the project payload; migrations run client-side on load.
  format_version integer not null default 1,
  last_opened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_owner_idx on public.projects (owner_id, updated_at desc);

-- Ownership check used by every child policy. security definer so the policy can
-- read projects without recursing through that table's own RLS.
create or replace function public.owns_project(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.projects p
    where p.id = target and p.owner_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Story structure: lanes -> scene/chapter containers -> beats (spec §5)
-- ---------------------------------------------------------------------------

create type public.lane_kind as enum (
  'main_plot', 'subplot', 'character_arc', 'theme', 'mystery', 'relationship', 'custom'
);

create table public.lanes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null check (length(name) > 0),
  kind public.lane_kind not null default 'custom',
  color text not null default '#6b7280',
  description text not null default '',
  -- Fractional index; see packages/domain/src/ordering.ts.
  order_key text not null,
  collapsed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lanes_project_idx on public.lanes (project_id, order_key);

create type public.structural_unit_kind as enum ('scene', 'chapter', 'section');
create type public.structural_unit_status as enum ('outline', 'drafting', 'draft_complete', 'revised', 'final');

create table public.structural_units (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  lane_id uuid not null references public.lanes (id) on delete cascade,
  kind public.structural_unit_kind not null,
  title text not null default '',
  sequence_label text not null default '',
  summary text not null default '',
  notes text not null default '',
  status public.structural_unit_status not null default 'outline',
  order_key text not null,
  collapsed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index structural_units_lane_idx on public.structural_units (lane_id, order_key);

create type public.beat_status as enum ('planned', 'drafting', 'written', 'revised', 'cut');

create table public.beats (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  -- NOT NULL by design. Spec §19: a beat always lives inside a scene/chapter
  -- container and is never a free-floating lane card.
  unit_id uuid not null references public.structural_units (id) on delete cascade,
  -- Internal authoring label. Spec §5.3/§6: never rendered as manuscript text.
  title text not null default '',
  summary text not null default '',
  status public.beat_status not null default 'planned',
  order_key text not null,
  -- Platform-neutral manuscript element list (packages/domain manuscript.ts).
  manuscript jsonb not null default '{"elements": []}'::jsonb,
  word_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index beats_unit_idx on public.beats (unit_id, order_key);

-- ---------------------------------------------------------------------------
-- Research and story intelligence (spec §7)
-- ---------------------------------------------------------------------------

create type public.research_usage as enum ('unused', 'used');

create table public.research_categories (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null check (length(name) > 0),
  -- Set for seeded categories (characters, ideas, plot_points, ...); null for
  -- anything the writer created. Categories are fully user-editable (§7.1).
  system_key text,
  description text not null default '',
  order_key text not null,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index research_categories_project_idx on public.research_categories (project_id, order_key);

create table public.research_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  category_id uuid not null references public.research_categories (id) on delete cascade,
  title text not null check (length(title) > 0),
  body text not null default '',
  tags text[] not null default '{}',
  -- Reversible state, never a delete (§7.2).
  usage public.research_usage not null default 'unused',
  used_at timestamptz,
  used_in_beat_ids uuid[] not null default '{}',
  -- False when usage was inferred automatically and the writer has not
  -- confirmed it; confirmation governs status-changing actions (§7.2).
  used_confirmed boolean not null default false,
  archived boolean not null default false,
  order_key text not null,
  origin text not null default 'desktop',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index research_items_category_idx on public.research_items (category_id, order_key);
create index research_items_unused_idx on public.research_items (project_id) where usage = 'unused' and archived = false;

create table public.characters (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null check (length(name) > 0),
  aliases text[] not null default '{}',
  description text not null default '',
  arc_notes text not null default '',
  research_item_id uuid references public.research_items (id) on delete set null,
  -- Persistent, provider-abstracted TTS voice assignment (§10, §18).
  voice jsonb,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index characters_project_idx on public.characters (project_id, name);

-- Typed relationships between story entities (§7.4). Endpoints are stored as
-- (type, id) pairs so any entity can link to any other without one join table
-- per pairing; the domain package validates the pair on write.
create table public.story_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  from_type text not null,
  from_id uuid not null,
  to_type text not null,
  to_id uuid not null,
  link_type text not null default 'relates_to',
  label text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint story_links_unique unique (project_id, from_type, from_id, to_type, to_id, link_type)
);

create index story_links_from_idx on public.story_links (project_id, from_type, from_id);
create index story_links_to_idx on public.story_links (project_id, to_type, to_id);

create type public.setup_payoff_status as enum ('open', 'established', 'resolved', 'abandoned');

create table public.setups_payoffs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null check (length(title) > 0),
  description text not null default '',
  status public.setup_payoff_status not null default 'open',
  -- A payoff may have many setup points and all are tracked (§7.3).
  setups jsonb not null default '[]'::jsonb,
  payoff jsonb,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index setups_payoffs_open_idx on public.setups_payoffs (project_id) where archived = false and status <> 'resolved';

-- ---------------------------------------------------------------------------
-- Recovery points (spec §6, §14, §15)
-- ---------------------------------------------------------------------------

create type public.snapshot_reason as enum ('autosave', 'manual', 'pre_migration', 'pre_import', 'pre_sync_merge');

create table public.snapshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  reason public.snapshot_reason not null,
  label text not null default '',
  format_version integer not null,
  size_bytes bigint not null default 0,
  content_hash text not null default '',
  storage_path text not null default '',
  created_at timestamptz not null default now()
);

create index snapshots_project_idx on public.snapshots (project_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  target text;
begin
  foreach target in array array[
    'profiles', 'projects', 'lanes', 'structural_units', 'beats',
    'research_categories', 'research_items', 'characters', 'story_links', 'setups_payoffs'
  ]
  loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.touch_updated_at()',
      target || '_touch_updated_at', target
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.lanes enable row level security;
alter table public.structural_units enable row level security;
alter table public.beats enable row level security;
alter table public.research_categories enable row level security;
alter table public.research_items enable row level security;
alter table public.characters enable row level security;
alter table public.story_links enable row level security;
alter table public.setups_payoffs enable row level security;
alter table public.snapshots enable row level security;

create policy "profiles are self-service" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy "projects belong to their owner" on public.projects
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Every child row is reachable only through a project the caller owns.
do $$
declare
  target text;
begin
  foreach target in array array[
    'lanes', 'structural_units', 'beats', 'research_categories', 'research_items',
    'characters', 'story_links', 'setups_payoffs', 'snapshots'
  ]
  loop
    execute format(
      'create policy %I on public.%I for all using (public.owns_project(project_id)) with check (public.owns_project(project_id))',
      target || '_owner_access', target
    );
  end loop;
end;
$$;
