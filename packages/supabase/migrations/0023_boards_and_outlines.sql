-- The Story Sculptor's boards and the Outliner's outlines, in the cloud.
--
-- Addendum 07 §4: these were the two plans the cloud had never seen. Every
-- other collection in a project has synced since 0001; boards (addendum 03)
-- and outlines (addendum 06) were built after it and lived only in the file on
-- the writer's disk. A Writers Room carrying a script and no plan is not a
-- room, so this is stage 0 of that module — and it is also the second thing
-- blocking addendum 03 §14.4 stage 10, which cannot attribute a board the
-- cloud does not have.
--
-- Nothing here is new shape. It is the shape the document already has, in the
-- encoding the database already uses.

-- --------------------------------------------------------------- the board

create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null default '',
  -- The board's columns, with the fields each one asks of its nodes
  -- (addendum 03 §5). One jsonb column rather than two tables: a column is
  -- the board's *shape* rather than its content, it is always read and written
  -- whole with the board, nothing queries inside it, and — unlike a node — it
  -- carries no timestamps, so there is nothing for a per-record merge to
  -- compare anyway.
  columns jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists boards_project_idx on public.boards (project_id, updated_at desc);

create table if not exists public.sculptor_nodes (
  id uuid primary key default gen_random_uuid(),
  -- Carried for the row-level policy, which asks one question of every child
  -- table in the schema. The document gets it from nesting; the database needs
  -- it in the row.
  project_id uuid not null references public.projects (id) on delete cascade,
  board_id uuid not null references public.boards (id) on delete cascade,
  column_id uuid not null,
  -- The node in the column before this one that this hangs off. Null in the
  -- structure column, whose nodes are a chain rather than children.
  parent_id uuid references public.sculptor_nodes (id) on delete cascade,
  order_key text not null,
  title text not null default '',
  note text not null default '',
  kind text not null default '',
  colour text not null default '',
  -- The answers to the column's fields, keyed by field id. Empty on a node
  -- whose column asks nothing, which is most of them.
  fields jsonb not null default '{}'::jsonb,
  -- 'beginning', 'end', or null for an ordinary node. Text rather than an enum
  -- for the same reason `kind` is: the board's vocabulary is the writer's.
  node_end text,
  collapsed boolean not null default false,
  -- The scene or beat this *is*, once bound (addendum 03 §6). Null is an idea,
  -- which is what every node starts as. Set null rather than cascade: deleting
  -- a scene must cost the binding and not the node.
  bound_unit_id uuid references public.structural_units (id) on delete set null,
  bound_beat_id uuid references public.beats (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sculptor_nodes_board_idx on public.sculptor_nodes (board_id, column_id, order_key);
create index if not exists sculptor_nodes_project_idx on public.sculptor_nodes (project_id);
create index if not exists sculptor_nodes_parent_idx on public.sculptor_nodes (parent_id);

-- The writer's own connections (addendum 03 §7), as against the parent
-- relation, which is drawn automatically and is what actually holds the board
-- together. A link is an observation — *this setup pays off here* — so losing
-- one costs the observation and moves nothing.
create table if not exists public.sculptor_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  board_id uuid not null references public.boards (id) on delete cascade,
  from_id uuid not null references public.sculptor_nodes (id) on delete cascade,
  to_id uuid not null references public.sculptor_nodes (id) on delete cascade,
  label text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sculptor_links_board_idx on public.sculptor_links (board_id);
create index if not exists sculptor_links_project_idx on public.sculptor_links (project_id);
create index if not exists sculptor_links_from_idx on public.sculptor_links (from_id);
create index if not exists sculptor_links_to_idx on public.sculptor_links (to_id);

-- ------------------------------------------------------------- the outline

create table if not exists public.outlines (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists outlines_project_idx on public.outlines (project_id, updated_at desc);

create table if not exists public.outline_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  outline_id uuid not null references public.outlines (id) on delete cascade,
  -- This carries the whole shape (addendum 06 §4). There is deliberately no
  -- depth column: a depth stored beside a parent is a second answer to a
  -- question that already has one, and the two come apart on the first drag.
  parent_id uuid references public.outline_items (id) on delete cascade,
  order_key text not null,
  -- Scene, Beat, Note, Idea, Character, Setting, Prop, or the writer's own.
  -- Text, not an enum: §4 says the type list is open, and an enum would refuse
  -- the eighth one.
  kind text not null default 'note',
  title text not null default '',
  body text not null default '',
  status text not null default '',
  collapsed boolean not null default false,
  -- Promotion is binding (addendum 06 §1), so this is the same pair of columns
  -- a node carries, and it is null on a plan.
  bound_unit_id uuid references public.structural_units (id) on delete set null,
  bound_beat_id uuid references public.beats (id) on delete set null,
  -- The research this row references, as the project's existing
  -- `StoryEntityRef` rather than a table of its own (addendum 06 §5): the
  -- relationship system already exists and a second one would be a second set
  -- of rules to keep in step.
  source jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists outline_items_outline_idx on public.outline_items (outline_id, order_key);
create index if not exists outline_items_project_idx on public.outline_items (project_id);
create index if not exists outline_items_parent_idx on public.outline_items (parent_id);

-- ------------------------------------------------------- keeping the clock

create trigger boards_touch_updated_at before update on public.boards
  for each row execute function public.touch_updated_at();
create trigger sculptor_nodes_touch_updated_at before update on public.sculptor_nodes
  for each row execute function public.touch_updated_at();
create trigger sculptor_links_touch_updated_at before update on public.sculptor_links
  for each row execute function public.touch_updated_at();
create trigger outlines_touch_updated_at before update on public.outlines
  for each row execute function public.touch_updated_at();
create trigger outline_items_touch_updated_at before update on public.outline_items
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------- who may read

alter table public.boards enable row level security;
alter table public.sculptor_nodes enable row level security;
alter table public.sculptor_links enable row level security;
alter table public.outlines enable row level security;
alter table public.outline_items enable row level security;

-- The same one question every other child table asks (0001). Addendum 07 §3.2
-- widens `owns_project` when the Room arrives, and these five come with it
-- rather than needing policies of their own written a second time.

create policy boards_owner_access on public.boards
  for all
  using (public.owns_project(project_id))
  with check (public.owns_project(project_id));

create policy sculptor_nodes_owner_access on public.sculptor_nodes
  for all
  using (public.owns_project(project_id))
  with check (public.owns_project(project_id));

create policy sculptor_links_owner_access on public.sculptor_links
  for all
  using (public.owns_project(project_id))
  with check (public.owns_project(project_id));

create policy outlines_owner_access on public.outlines
  for all
  using (public.owns_project(project_id))
  with check (public.owns_project(project_id));

create policy outline_items_owner_access on public.outline_items
  for all
  using (public.owns_project(project_id))
  with check (public.owns_project(project_id));
