-- Error reporting (spec §14: "structured logging/error reporting without
-- logging manuscript content unnecessarily").
--
-- There is deliberately no column for manuscript text, project titles, file
-- paths or note content. A report says what broke and in which build — enough
-- to find a bug, and not enough to read anyone's work. The desktop strips
-- paths out of stack traces before sending, and this schema gives them nowhere
-- to land if it ever missed one.

create table public.error_reports (
  id uuid primary key default gen_random_uuid(),
  -- Null for a crash before sign-in; a report is not worth demanding an
  -- account for.
  user_id uuid references public.profiles (id) on delete set null,
  app_version text not null default '',
  platform text not null default '',
  os_version text not null default '',
  -- The error's class and message, with paths already redacted.
  error_name text not null default '',
  error_message text not null default '',
  stack text not null default '',
  -- Where in the application it happened: 'main', 'renderer', 'web'.
  surface text not null default 'unknown',
  created_at timestamptz not null default now()
);

create index error_reports_recent_idx on public.error_reports (created_at desc);

alter table public.error_reports enable row level security;

-- Written by the server-side route only, and read by admins for triage.
create policy "admins read error reports" on public.error_reports
  for select to authenticated using (public.is_admin());
