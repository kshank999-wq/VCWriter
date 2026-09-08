-- Addendum 02 §14: two more things a project can be. `series` is written the
-- way a screenplay is and divided into episodes; `short_form` is the same
-- basic format at commercial length, and the module that makes something of
-- it comes later.
alter type public.project_format add value if not exists 'series';
alter type public.project_format add value if not exists 'short_form';

-- An episode is a marker, not a container: the same point in the story order
-- that a book calls a chapter and a feature calls an act (§11).
alter type public.story_marker_kind add value if not exists 'episode';

-- Addendum 02 §15: what the writing cost.
--
-- One row per sitting — the day, the hour it started, the hour it ended, and
-- the word count at each end. The delta is left to be worked out rather than
-- stored, because the count at each end is the fact and the difference is a
-- reading of it; a day spent cutting is honestly negative.
--
-- Sittings live with the project rather than the account so the record
-- follows the work, and a writer who never signs in still has their history
-- in their own file.
create table if not exists public.writing_sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  words_at_start integer not null default 0,
  words_at_end integer not null default 0,
  -- Which machine, when there is more than one. Free text; never required.
  device text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Every report reads a project's sittings in time order, and nothing reads
-- them any other way.
create index if not exists writing_sessions_project_idx
  on public.writing_sessions (project_id, started_at);

create trigger writing_sessions_touch_updated_at
  before update on public.writing_sessions
  for each row execute function public.touch_updated_at();

alter table public.writing_sessions enable row level security;

create policy writing_sessions_owner_access on public.writing_sessions
  for all
  using (public.owns_project(project_id))
  with check (public.owns_project(project_id));
