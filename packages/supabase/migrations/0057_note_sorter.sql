-- The Note Sorter (addendum 26).
--
-- **Two tables and four columns**, which is the whole of the data work, and
-- the reason is §1's audit: a sorting category is a `research_category` (it
-- has carried a parent, a colour and an order since the research tree was
-- built) and a card is a `research_item`. What is new is the session those
-- categories belong to, and the immutable source a card was pulled out of.

create table if not exists public.note_sessions (
  id uuid primary key,
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null default 'Note sorting',
  -- The writing mode Send to Outliner starts from. Read, never obeyed.
  send_mode text not null default '',
  archived boolean not null default false,
  order_key text not null default 'm',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A source document. `text` is written once and never updated: that is what
-- makes "Show original source" a read rather than a reconstruction, and it is
-- why nothing anywhere records that a passage has been sorted — the sorted
-- stretches are counted back from the cards' ranges every time.
create table if not exists public.note_sources (
  id uuid primary key,
  project_id uuid not null references public.projects (id) on delete cascade,
  session_id uuid not null references public.note_sessions (id) on delete cascade,
  name text not null default 'Source',
  kind text not null default 'typed',
  text text not null default '',
  file_name text not null default '',
  imported_at timestamptz,
  order_key text not null default 'm',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists note_sessions_project_idx on public.note_sessions (project_id);
create index if not exists note_sources_session_idx on public.note_sources (session_id);
-- Every foreign key gets a covering index: the performance advisor asks for
-- this one by name, and a project's sources are read by project constantly.
create index if not exists note_sources_project_idx on public.note_sources (project_id);

-- Which sitting a category belongs to. Null is an ordinary research folder,
-- which is every category that exists today.
alter table public.research_categories
  add column if not exists session_id uuid references public.note_sessions (id) on delete cascade;

-- Where a card was extracted from. Null on every research item nobody pulled
-- out of a source, which is all of them until somebody opens the sorter.
alter table public.research_items
  add column if not exists source_id uuid references public.note_sources (id) on delete set null,
  add column if not exists source_from integer,
  add column if not exists source_to integer,
  add column if not exists also_in jsonb not null default '[]'::jsonb;

create index if not exists research_categories_session_idx
  on public.research_categories (session_id);
create index if not exists research_items_source_idx
  on public.research_items (source_id);

-- Row level security: a sitting and its sources belong to whoever may read or
-- write the project, which is what `may_read_project` and `may_write_project`
-- have decided for every other table since migration 0024.
--
-- **One policy per action rather than one `for all`**, which is the house
-- shape every other table here uses. A `for all` policy also covers SELECT, so
-- beside the read policy it gives the table two permissive SELECT policies and
-- Postgres runs both on every row — which the performance advisor names, and
-- which is why no other table in this schema is written that way.
alter table public.note_sessions enable row level security;
alter table public.note_sources enable row level security;

drop policy if exists note_sessions_read on public.note_sessions;
create policy note_sessions_read on public.note_sessions
  for select to authenticated
  using (public.may_read_project (project_id));

drop policy if exists note_sessions_insert on public.note_sessions;
create policy note_sessions_insert on public.note_sessions
  for insert to authenticated with check (public.may_write_project (project_id));

drop policy if exists note_sessions_update on public.note_sessions;
create policy note_sessions_update on public.note_sessions
  for update to authenticated
  using (public.may_write_project (project_id))
  with check (public.may_write_project (project_id));

drop policy if exists note_sessions_delete on public.note_sessions;
create policy note_sessions_delete on public.note_sessions
  for delete to authenticated using (public.may_write_project (project_id));

drop policy if exists note_sources_read on public.note_sources;
create policy note_sources_read on public.note_sources
  for select to authenticated
  using (public.may_read_project (project_id));

drop policy if exists note_sources_insert on public.note_sources;
create policy note_sources_insert on public.note_sources
  for insert to authenticated with check (public.may_write_project (project_id));

drop policy if exists note_sources_update on public.note_sources;
create policy note_sources_update on public.note_sources
  for update to authenticated
  using (public.may_write_project (project_id))
  with check (public.may_write_project (project_id));

drop policy if exists note_sources_delete on public.note_sources;
create policy note_sources_delete on public.note_sources
  for delete to authenticated using (public.may_write_project (project_id));
