-- VC Writer Notes capture intake and sync (spec §9, §11).
--
-- Raw capture is never discarded on approval: it is the recovery record if the
-- AI classification turns out to be wrong, and the writer confirms before
-- anything becomes canonical project data.

create type public.capture_source as enum ('mobile_voice', 'mobile_text', 'desktop_dictation', 'import');
create type public.capture_status as enum ('pending', 'needs_review', 'approved', 'rejected');

create table public.capture_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Captures may arrive before the writer picks a project; they are routed on review.
  project_id uuid references public.projects (id) on delete set null,
  source public.capture_source not null,
  captured_at timestamptz not null default now(),
  raw_text text not null default '',
  audio_path text,
  transcript_confidence real check (transcript_confidence between 0 and 1),
  -- Proposed classification from the NLU pass: category, entity name, target,
  -- confidence and model. A proposal only (§9).
  inference jsonb,
  status public.capture_status not null default 'pending',
  reviewed_at timestamptz,
  -- What the approved capture became, as a (type, id) reference.
  result_type text,
  result_id uuid,
  -- Offline-tolerant queue bookkeeping: the client stamps this when the row is
  -- confirmed server-side, so a failed sync retries rather than losing an idea (§11).
  client_capture_id text,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint capture_items_client_unique unique (user_id, client_capture_id)
);

create index capture_items_queue_idx on public.capture_items (user_id, status, captured_at desc);

create trigger capture_items_touch_updated_at before update on public.capture_items
  for each row execute function public.touch_updated_at();

alter table public.capture_items enable row level security;

create policy "captures belong to the capturing user" on public.capture_items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
