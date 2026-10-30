-- The word processor in the cloud (addendum 42 §17).
--
-- Ken: *opening in one computer or another, the file comes out blank… let's fix
-- that first so I can start working in the program on different computers.*
--
-- A Document project's document, and the extracts taken from it with their
-- palettes and buttons, were never synced: a project brought down from the
-- cloud on a second computer arrived with an empty page. Four tables, each
-- holding its record whole as `data` beside the columns sync and row-level
-- security need. A document is one editor tree and a run of settings; a field
-- added to it later travels without another migration, which is the mistake
-- this table exists to stop repeating.
--
-- Read and written as the rest of a project is (0068's shape): one read policy
-- and three write policies through `may_read_project` / `may_write_project`.

create table if not exists public.wp_documents (
  id uuid primary key,
  project_id uuid not null references public.projects (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.wp_extract_palettes (like public.wp_documents including all);
alter table public.wp_extract_palettes
  add constraint wp_extract_palettes_project_fk foreign key (project_id) references public.projects (id) on delete cascade;
create table if not exists public.wp_extract_categories (like public.wp_documents including all);
alter table public.wp_extract_categories
  add constraint wp_extract_categories_project_fk foreign key (project_id) references public.projects (id) on delete cascade;
create table if not exists public.wp_extracts (like public.wp_documents including all);
alter table public.wp_extracts
  add constraint wp_extracts_project_fk foreign key (project_id) references public.projects (id) on delete cascade;

create index if not exists wp_documents_project_idx on public.wp_documents (project_id);
create index if not exists wp_extract_palettes_project_idx on public.wp_extract_palettes (project_id);
create index if not exists wp_extract_categories_project_idx on public.wp_extract_categories (project_id);
create index if not exists wp_extracts_project_idx on public.wp_extracts (project_id);

do $$
declare t text;
begin
  foreach t in array array['wp_documents', 'wp_extract_palettes', 'wp_extract_categories', 'wp_extracts'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()', t || '_touch_updated_at', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select using (public.may_read_project(project_id))', t || '_read', t);
    execute format('create policy %I on public.%I for insert with check (public.may_write_project(project_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update using (public.may_write_project(project_id)) with check (public.may_write_project(project_id))', t || '_update', t);
    execute format('create policy %I on public.%I for delete using (public.may_write_project(project_id))', t || '_delete', t);
  end loop;
end $$;

comment on table public.wp_documents is 'A Document project''s document (addendum 42 §17), the record whole as data.';
comment on table public.wp_extract_palettes is 'Extract & Organize palettes (addendum 42 §17), the record whole as data.';
comment on table public.wp_extract_categories is 'Extract & Organize buttons (addendum 42 §17), the record whole as data.';
comment on table public.wp_extracts is 'Extracts taken from a document (addendum 42 §17), the record whole as data.';
