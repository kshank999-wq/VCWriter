-- The Character Creator (addendum 08, stage 1).
--
-- Six tables, and **nothing here is new shape**: it is the shape the document
-- already has, in the encoding the database already uses. Flat rather than
-- nested for the reason every other collection in this schema is flat — the
-- per-record sync merge compares *records*, and a character carrying its traits
-- carrying their characterization would be one record as far as the merge is
-- concerned, so two writers touching two different traits would collide.
--
-- **No `used` column anywhere**, which is the load-bearing absence (addendum
-- 08 §2). Whether a characterization item has appeared in the manuscript is
-- derived from its usage links every time it is asked, so deleting a beat turns
-- an item red by itself and moving a scene changes nothing. `retired` is stored
-- because *I have decided against this* is an intention no reading of the
-- manuscript could ever discover.

-- ------------------------------------------------------------------ traits

create table if not exists public.character_traits (
  id uuid primary key default gen_random_uuid(),
  -- Carried for the row-level policy, which asks one question of every child
  -- table in this schema. The document gets it from nesting; the row needs it.
  project_id uuid not null references public.projects (id) on delete cascade,
  character_id uuid not null references public.characters (id) on delete cascade,
  name text not null,
  -- The writer's own grouping — *under pressure*, *at home*. Text, because the
  -- vocabulary is theirs.
  kind text not null default '',
  prominence smallint not null default 3,
  -- 'positive' | 'negative' | 'neutral' | 'unsaid', and unsaid is the default.
  -- Text rather than an enum because §4 is explicit that the reading of a trait
  -- stays optional, and an enum would invite a NOT NULL default of 'neutral'
  -- that quietly has an opinion about somebody's character.
  tone text not null default 'unsaid',
  notes text not null default '',
  order_key text not null,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint character_traits_prominence check (prominence between 1 and 5)
);

create index if not exists character_traits_project_idx on public.character_traits (project_id);
create index if not exists character_traits_character_idx on public.character_traits (character_id, order_key);

-- --------------------------------------------------------- characterization

create table if not exists public.characterization_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  character_id uuid not null references public.characters (id) on delete cascade,
  -- `set null` rather than cascade, and it matters: deleting a trait must cost
  -- the filing and never the writer's idea. An unfiled item has somewhere to be
  -- (§7's right-click workflow makes one in a second without asking for a
  -- trait), so this is the same state that path already produces.
  trait_id uuid references public.character_traits (id) on delete set null,
  text text not null,
  notes text not null default '',
  retired boolean not null default false,
  order_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists characterization_items_project_idx on public.characterization_items (project_id);
create index if not exists characterization_items_character_idx
  on public.characterization_items (character_id, order_key);
create index if not exists characterization_items_trait_idx on public.characterization_items (trait_id);

-- ---------------------------------------------------------------- the arc

create table if not exists public.character_arcs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  character_id uuid not null references public.characters (id) on delete cascade,
  beginning text not null default '',
  need text not null default '',
  ending text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One arc per character. Not a limitation: an arc *is* the character's
  -- journey through this story, and a second one would be a second character.
  constraint character_arcs_one_each unique (character_id)
);

create index if not exists character_arcs_project_idx on public.character_arcs (project_id);

create table if not exists public.arc_points (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  arc_id uuid not null references public.character_arcs (id) on delete cascade,
  -- Carried as well as the arc, because nearly every reading of a point starts
  -- from the character rather than from their arc.
  character_id uuid not null references public.characters (id) on delete cascade,
  -- movement | setback | discovery | decision | test | turning_point |
  -- opportunity | refusal | doubling_down. Text for the same reason `tone` is,
  -- and because §9's list is the one most likely to grow.
  kind text not null default 'movement',
  text text not null,
  notes text not null default '',
  retired boolean not null default false,
  order_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists arc_points_project_idx on public.arc_points (project_id);
create index if not exists arc_points_arc_idx on public.arc_points (arc_id, order_key);
create index if not exists arc_points_character_idx on public.arc_points (character_id);

-- ------------------------------------------------------------ usage links

create table if not exists public.usage_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  -- 'characterization' | 'arc_point'. Not a foreign key to either, because it
  -- is one column that points at two tables — and the alternative, two nullable
  -- columns with a check that exactly one is set, is the same thing written at
  -- greater length. A row whose owner is gone is swept below.
  owner_kind text not null,
  owner_id uuid not null,
  -- Where it appears. The scene is carried for navigation; the beat is the
  -- anchor. `cascade` on the beat, because a usage link to a beat that no
  -- longer exists is not a link — and the item it belonged to simply goes red
  -- again, which is §17 without anything running.
  unit_id uuid references public.structural_units (id) on delete set null,
  beat_id uuid not null references public.beats (id) on delete cascade,
  -- The paragraph, where the writer pointed at one. No foreign key: a
  -- manuscript element lives inside a beat's jsonb, not in a table of its own.
  element_id uuid,
  -- The words as they were. **For reading, never for finding** (addendum 08
  -- §3.2): when the writer rewrites the line, the quote and the manuscript
  -- diverge and the link still holds — that is a rewritten line, not a broken
  -- one, and going red there would punish somebody for writing.
  quote text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint usage_links_owner_kind check (owner_kind in ('characterization', 'arc_point')),
  -- The same piece of writing, linked to the same item, once.
  constraint usage_links_once unique (owner_kind, owner_id, beat_id, element_id)
);

create index if not exists usage_links_project_idx on public.usage_links (project_id);
create index if not exists usage_links_owner_idx on public.usage_links (owner_kind, owner_id);
create index if not exists usage_links_beat_idx on public.usage_links (beat_id);
create index if not exists usage_links_unit_idx on public.usage_links (unit_id);

-- --------------------------------------------------------- relationships

create table if not exists public.character_relationships (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  -- **Directional, and that is the requirement rather than a detail** (§11):
  -- *A trusts B while B is manipulating A* is two rows, not one with a muddle
  -- in it. Which is also how the map draws two labels on one line.
  from_character_id uuid not null references public.characters (id) on delete cascade,
  to_character_id uuid not null references public.characters (id) on delete cascade,
  kind text not null default 'custom',
  label text not null default '',
  description text not null default '',
  state text not null default '',
  evolution text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Nobody is in a relationship with themselves.
  constraint character_relationships_two_people check (from_character_id <> to_character_id),
  -- One reading of one pair. The reverse is a different row.
  constraint character_relationships_once unique (from_character_id, to_character_id, kind, label)
);

create index if not exists character_relationships_project_idx on public.character_relationships (project_id);
create index if not exists character_relationships_from_idx
  on public.character_relationships (from_character_id);
create index if not exists character_relationships_to_idx on public.character_relationships (to_character_id);

-- ------------------------------------------------------------------ access

alter table public.character_traits enable row level security;
alter table public.characterization_items enable row level security;
alter table public.character_arcs enable row level security;
alter table public.arc_points enable row level security;
alter table public.usage_links enable row level security;
alter table public.character_relationships enable row level security;

-- The same one question every other child table asks (0001, and 0023 before
-- these). Six more tables become room-aware the day `owns_project` widens,
-- rather than needing policies of their own written a second time.

create policy character_traits_owner_access on public.character_traits
  for all using (public.owns_project(project_id)) with check (public.owns_project(project_id));

create policy characterization_items_owner_access on public.characterization_items
  for all using (public.owns_project(project_id)) with check (public.owns_project(project_id));

create policy character_arcs_owner_access on public.character_arcs
  for all using (public.owns_project(project_id)) with check (public.owns_project(project_id));

create policy arc_points_owner_access on public.arc_points
  for all using (public.owns_project(project_id)) with check (public.owns_project(project_id));

create policy usage_links_owner_access on public.usage_links
  for all using (public.owns_project(project_id)) with check (public.owns_project(project_id));

create policy character_relationships_owner_access on public.character_relationships
  for all using (public.owns_project(project_id)) with check (public.owns_project(project_id));

comment on table public.usage_links is
  'Where a characterization item or arc point appears in the manuscript (addendum 08 §3.2). Anchored by beat and element id; the quote is for reading and never for finding. There is deliberately no `used` column anywhere in this module — it is derived from these rows.';
