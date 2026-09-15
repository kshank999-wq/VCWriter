-- Instructional / Book Mode (addendum 16, from Ken's spec).
--
-- **One column.** The spec's §11 lists eight entities and six of them already
-- exist here: a Chapter is a `structural_unit`, a Section is a `beat`, a
-- ContentItem is a manuscript element, a ResearchItem is a `research_item`, a
-- GraphicAsset is an `asset` that rides inside the project document, and a
-- Relationship is a `story_link`. The mode itself is a value of
-- `projects.format`, which is already free text as far as the database is
-- concerned.
--
-- What is genuinely missing is the one field a nonfiction author cannot work
-- without and a novelist never needs: **where a fact came from**.

-- A citation, in the author's own words: a book, a paper, a URL, a lecture, a
-- person. Deliberately free text — a writer pasting a DOI, a page reference
-- and a half-remembered author should not be stopped by a form, and formatting
-- a bibliography is a later problem and a different one.
--
-- Not to be confused with `origin` on the same table, which has meant *how it
-- got into the project* (typed, dictated, imported) since 0003. The two
-- questions are different and both are worth having.
alter table public.research_items add column if not exists source text not null default '';

comment on column public.research_items.source is
  'Where the material came from — a citation (addendum 16). Distinct from origin, which is how it entered the project.';

-- ------------------------------------------------- what is deliberately absent
--
-- **No graphics table.** A picture is an `asset`, and assets travel inside the
-- project document as data URIs rather than syncing as rows — a figure
-- pointing at a folder on somebody's desktop is a figure that is gone the
-- moment the file is sent anywhere (addendum 05 §3c). Caption and alt text
-- join the asset in the document for the same reason.
--
-- **No figure-placement table.** A figure is an element of the manuscript, so
-- it is already in the beat's element list and already syncs with it. A side
-- table would have to re-derive the reading order the manuscript knows, and
-- would disagree with it the first time somebody moved a paragraph.
--
-- **No figure numbers anywhere.** Figure 1, Figure 2 are counted in reading
-- order every time they are asked for, so moving a chapter renumbers
-- everything after it with nothing run — the same absence the book index's
-- page numbers rest on.

-- ------------------------------------------------------- the learning aids

-- End-of-section learning aids (§10): a summary, a *what you learned* list and
-- review questions, attached to a section and printed at the end of it.
--
-- **Two content columns, not one.** `text`/`questions` are the author's and are
-- the only things that print; `suggestion`/`suggested_questions` are what the
-- machine last offered and are never printed. §10 requires that regeneration
-- not overwrite author-edited content, and this is how that is kept: a
-- regeneration writes only to the suggestion columns, so it *cannot* reach an
-- edit. The alternative — one column and a `has_been_edited` flag — puts the
-- whole rule on a boolean that every code path has to set correctly, and the
-- first one that forgets costs somebody an afternoon.
--
-- `approved` is the other half of §10: an aid is not part of the book until
-- the author says so, and nothing in the generation path may set this.
create table if not exists public.learning_aids (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  -- The Section, which this program has always called a beat.
  beat_id uuid not null references public.beats (id) on delete cascade,
  kind text not null,
  -- The author's.
  text text not null default '',
  questions jsonb not null default '[]'::jsonb,
  -- The machine's. Never printed.
  suggestion text not null default '',
  suggested_questions jsonb not null default '[]'::jsonb,
  suggested_at timestamptz,
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint learning_aids_kind check (kind in ('summary', 'what_you_learned', 'quiz')),
  -- One of each kind per section. Two summaries on one section is not a thing
  -- anybody wants, and the interface relies on asking twice being idempotent.
  constraint learning_aids_once unique (beat_id, kind)
);

create index if not exists learning_aids_project_idx on public.learning_aids (project_id);
create index if not exists learning_aids_beat_idx on public.learning_aids (beat_id);

alter table public.learning_aids enable row level security;

-- Read by whoever reads the project, written by whoever writes it — the pair
-- 0024 split apart. One select policy and three mutating ones rather than a
-- `for all`, which would be evaluated on every row of every read.
create policy learning_aids_read on public.learning_aids
  for select using (public.may_read_project(project_id));
create policy learning_aids_insert on public.learning_aids
  for insert with check (public.may_write_project(project_id));
create policy learning_aids_update on public.learning_aids
  for update using (public.may_write_project(project_id))
  with check (public.may_write_project(project_id));
create policy learning_aids_delete on public.learning_aids
  for delete using (public.may_write_project(project_id));

create trigger learning_aids_touch_updated_at before update on public.learning_aids
  for each row execute function public.touch_updated_at();

comment on table public.learning_aids is
  'An end-of-section learning aid (addendum 16). The author''s words and the machine''s last offer are separate columns, so regeneration cannot overwrite an edit.';
