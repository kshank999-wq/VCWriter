-- The Reference Library and its citations (addendum 43).
--
-- Two tables, a source and a citation of it, because they are different in
-- kind: a source is a fact about the world, entered once; a citation is one
-- place the manuscript leans on it, with its own pinpoint and note. One source
-- cited three times is one row here and three there, and the bibliography has
-- one entry for it however many there are.
--
-- **No column holds a printed marker, and the absence is the feature.** A
-- citation's place in the text is a `[^key]` token in a manuscript element,
-- which lives in a beat's JSON document; the 1, 2, 3 (or a, b, c, or *, †) is
-- worked out from the order of the tokens every time it is drawn, so inserting
-- one between two others renumbers everything after it with nothing to run.
-- The spec's design note: internal source IDs and printed markers are distinct.
--
-- A source's facts are a `metadata` document rather than seventeen columns
-- (spec §7: `metadata{}`): which of them a source has depends on what kind of
-- source it is, and a new style needing one more field is a change to the
-- renderer, not to this table.

create table if not exists public.reference_sources (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  type text not null default 'book',
  -- The writer's handle for it (R12, Smith2024). Never printed.
  short_code text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}',
  -- Archived: out of the pickers, still printed for every citation of it.
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reference_sources_known_type
    check (type in ('book', 'chapter', 'journal', 'website', 'report', 'interview', 'video', 'other'))
);

create index if not exists reference_sources_project_idx on public.reference_sources (project_id);

create table if not exists public.citations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  -- A source is removed only when nothing cites it; a merge points every
  -- citation at the source kept before the others go.
  reference_id uuid not null references public.reference_sources (id) on delete cascade,
  -- What the manuscript's token names: six hex characters, unique in the
  -- project. Short because the token is typed into the line itself.
  key text not null,
  locator_kind text not null default 'page',
  locator text not null default '',
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint citations_key_shape check (key ~ '^[0-9a-f]{6}$'),
  constraint citations_known_locator
    check (locator_kind in ('page', 'pages', 'section', 'chapter', 'paragraph', 'timestamp', 'other')),
  constraint citations_key_unique unique (project_id, key)
);

create index if not exists citations_project_idx on public.citations (project_id);
create index if not exists citations_reference_idx on public.citations (reference_id);

create trigger reference_sources_touch_updated_at before update on public.reference_sources
  for each row execute function public.touch_updated_at();
create trigger citations_touch_updated_at before update on public.citations
  for each row execute function public.touch_updated_at();

-- One read policy and three write policies, rather than `for all`, as 0046
-- does: two permissive select policies on one table is the performance
-- advisor's complaint.
alter table public.reference_sources enable row level security;
create policy reference_sources_read on public.reference_sources for select using (public.may_read_project(project_id));
create policy reference_sources_insert on public.reference_sources for insert with check (public.may_write_project(project_id));
create policy reference_sources_update on public.reference_sources for update
  using (public.may_write_project(project_id)) with check (public.may_write_project(project_id));
create policy reference_sources_delete on public.reference_sources for delete using (public.may_write_project(project_id));

alter table public.citations enable row level security;
create policy citations_read on public.citations for select using (public.may_read_project(project_id));
create policy citations_insert on public.citations for insert with check (public.may_write_project(project_id));
create policy citations_update on public.citations for update
  using (public.may_write_project(project_id)) with check (public.may_write_project(project_id));
create policy citations_delete on public.citations for delete using (public.may_write_project(project_id));

comment on table public.reference_sources is
  'The Reference Library (addendum 43): a project''s sources, their facts in metadata. Cited by citations.';
comment on table public.citations is
  'One place a source is cited (addendum 43): named by a [^key] token in the manuscript; its printed marker is derived, never stored.';
