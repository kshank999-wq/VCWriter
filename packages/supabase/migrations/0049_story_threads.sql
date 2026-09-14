-- Narrative threads (addendum 15, from Ken's Research Links spec).
--
-- **One table, where the spec asks for three.** §16 lists StoryLink,
-- StoryLinkNode and StoryLinkEdge, and two of the three already exist here:
--
--   * a node — a moment of the script with a scene, a beat, an element, a quote
--     and a note — is `usage_links` (0039), whose owner kind this widens for
--     the third time;
--   * a dependency edge — two references and a verb — is `story_links`, whose
--     `depends_on` has been in the vocabulary since the master spec's §7.4, and
--     whose `from_type`/`to_type` are text, so `thread_node` needed no DDL at
--     all.
--
-- **And a sequence edge is stored nowhere**, which §13 asks for without meaning
-- to: it requires a node's horizontal position to be derived from script
-- position and never draggable. If position is derived then order is derived,
-- and a stored `sequence_order` would be a second answer waiting to disagree
-- the next time a scene moves. So does `sequence_order` on the node, which §16
-- also lists and this deliberately does not have.
--
-- What is left with nowhere to live is the thread itself: a name, a description
-- and what its connectors assert.

create table if not exists public.story_threads (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null default '',
  description text not null default '',
  -- What the connectors mean. `sequence` is drawn from script order and
  -- asserts nothing; `dependency` is drawn only where the writer drew an
  -- arrow, because the system does not infer causality (§5.2).
  relationship text not null default 'sequence',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint story_threads_relationship check (relationship in ('sequence', 'dependency'))
);

create index if not exists story_threads_project_idx on public.story_threads (project_id);

-- ------------------------------------------------- the occurrence, widened

-- 'thread' joins the list. Third time: characterization and arc points first,
-- then themes and motifs (0047), now the moments of a thread. No new table, no
-- second index, no second orphan rule — the record was already general.
alter table public.usage_links drop constraint if exists usage_links_owner_kind;
alter table public.usage_links add constraint usage_links_owner_kind
  check (owner_kind in ('characterization', 'arc_point', 'theme', 'motif', 'thread'));

-- ------------------------------------------------------------------- policies

alter table public.story_threads enable row level security;

-- Read by whoever reads the project, written by whoever writes it — the pair
-- 0024 split apart. One select policy and three mutating ones rather than a
-- read policy and a `for all`, because `for all` includes select and both
-- would then be evaluated on every row of every read.
create policy story_threads_read on public.story_threads
  for select using (public.may_read_project(project_id));
create policy story_threads_insert on public.story_threads
  for insert with check (public.may_write_project(project_id));
create policy story_threads_update on public.story_threads
  for update using (public.may_write_project(project_id))
  with check (public.may_write_project(project_id));
create policy story_threads_delete on public.story_threads
  for delete using (public.may_write_project(project_id));

create trigger story_threads_touch_updated_at before update on public.story_threads
  for each row execute function public.touch_updated_at();

comment on table public.story_threads is
  'A named narrative thread (addendum 15). Its moments are usage_links and its dependencies are story_links; its sequence is the script''s own and is stored nowhere.';
