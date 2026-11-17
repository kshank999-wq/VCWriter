-- The writer's own note categories, kept with their account (addendum 27 §35).
--
-- From Ken, 16 November: *do the phone categories by voice and sync*. The
-- list of categories the phone's note screen offers for a project — the
-- writer's own (`own`, names in the order made) and the format's that they
-- took off it (`hidden`, keys) — was kept on the one phone. It is now kept
-- here, one row per writer and project, so a second phone, a reinstall or a
-- tablet has the same list. Notes themselves already carry their category
-- (`my:` and the name), so nothing about the notes changes.

create table if not exists public.note_category_choices (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  own text[] not null default '{}',
  hidden text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, project_id),
  constraint note_category_choices_size check (cardinality(own) <= 200 and cardinality(hidden) <= 50)
);

create index if not exists note_category_choices_project_idx on public.note_category_choices (project_id);

alter table public.note_category_choices enable row level security;

create policy note_category_choices_read on public.note_category_choices
  for select using (user_id = (select auth.uid()));
create policy note_category_choices_write on public.note_category_choices
  for insert with check (user_id = (select auth.uid()));
create policy note_category_choices_change on public.note_category_choices
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy note_category_choices_remove on public.note_category_choices
  for delete using (user_id = (select auth.uid()));
