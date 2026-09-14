-- The back-of-book index (addendum 10).
--
-- Two tables, because a mark in the manuscript and a cross-reference between
-- headings are different in kind: one is anchored to a passage and one is a
-- sentence about the index itself. One table with a nullable anchor and a flag
-- is the half-a-target muddle 0035 refused for comments, for the same reason.
--
-- **There is no page number column in either of them, and the absence is the
-- feature.** A page is where something lands once the book is laid out, so the
-- index is computed from the pagination every time — which is what makes *the
-- page numbers update themselves when the writing shifts* need nothing to run,
-- and there is no *rebuild the index* anywhere because there is nothing to
-- rebuild. This is the same absence `usage_links` has (0039): a column that
-- could hold a stale answer is a column that eventually does.
--
-- No foreign key on `beat_id` or `element_id`, for the third time in this
-- codebase and the same reason (0033, 0034, 0035): a manuscript element lives
-- inside a beat's JSON document, not in a row of its own, and every branch
-- carries its own copy under the same id. A mark whose element is no longer in
-- the manuscript reads back as an **orphan** and is shown to the writer rather
-- than quietly dropped.

create table if not exists public.index_marks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  -- The heading. The writer's words, never the passage's: a paragraph about
  -- the lens is filed under "lenses, Fresnel".
  term text not null default '',
  -- The sub-heading. Two levels, never three — three is where an index stops
  -- being readable.
  sub_term text not null default '',
  beat_id uuid not null,
  element_id uuid not null,
  -- What the passage said when it was marked. For reading, never for finding.
  quote text not null default '',
  -- A principal discussion, set bold in the printed index.
  principal boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint index_marks_has_a_heading check (length(btrim(term)) > 0)
);

create index if not exists index_marks_project_idx on public.index_marks (project_id);
-- The one query the reading makes: every mark of a project, gathered by
-- heading. Lower-cased, because two spellings of one heading are one heading.
create index if not exists index_marks_term_idx on public.index_marks (project_id, lower(term));
create index if not exists index_marks_element_idx on public.index_marks (element_id);

create table if not exists public.index_refs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  term text not null default '',
  sub_term text not null default '',
  -- 'see' redirects a heading that has no pages of its own; 'see_also' sits
  -- after a heading's page numbers. They print differently, so they are not
  -- one kind with a flag.
  kind text not null default 'see',
  target text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint index_refs_kind_known check (kind in ('see', 'see_also')),
  -- Both ends or neither: a cross-reference to nowhere wastes the reader's
  -- time, and one under no heading cannot be shown at all.
  constraint index_refs_both_ends
    check (length(btrim(term)) > 0 and length(btrim(target)) > 0)
);

create index if not exists index_refs_project_idx on public.index_refs (project_id);

create trigger index_marks_touch_updated_at before update on public.index_marks
  for each row execute function public.touch_updated_at();
create trigger index_refs_touch_updated_at before update on public.index_refs
  for each row execute function public.touch_updated_at();

alter table public.index_marks enable row level security;
alter table public.index_refs enable row level security;

-- The index is part of the book, so it is read and written by exactly whoever
-- reads and writes the book — the pair 0024 split apart, because a room member
-- may read the book and only somebody who may write it may change its index.
--
-- **One select policy and three mutating ones, rather than a read policy and a
-- `for all`.** `for all` includes select, so the pair would be two permissive
-- policies evaluated on every row of every read — which the performance
-- advisor flags, correctly.
create policy index_marks_read on public.index_marks
  for select using (public.may_read_project(project_id));
create policy index_marks_insert on public.index_marks
  for insert with check (public.may_write_project(project_id));
create policy index_marks_update on public.index_marks
  for update using (public.may_write_project(project_id))
  with check (public.may_write_project(project_id));
create policy index_marks_delete on public.index_marks
  for delete using (public.may_write_project(project_id));

create policy index_refs_read on public.index_refs
  for select using (public.may_read_project(project_id));
create policy index_refs_insert on public.index_refs
  for insert with check (public.may_write_project(project_id));
create policy index_refs_update on public.index_refs
  for update using (public.may_write_project(project_id))
  with check (public.may_write_project(project_id));
create policy index_refs_delete on public.index_refs
  for delete using (public.may_write_project(project_id));

comment on table public.index_marks is
  'A passage the writer filed under an index heading (addendum 10). No page number: the index is computed from the pagination every time.';
comment on table public.index_refs is
  'A see / see also between index headings (addendum 10). Attached to no passage, which is why it is not a mark.';
