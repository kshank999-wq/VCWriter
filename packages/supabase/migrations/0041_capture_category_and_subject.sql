-- The companion app's two fields (addendum 09 §3.1).
--
-- `category` is the kind of thought the writer spoke on the phone — one of the
-- five in their spec §4. It is deliberately **not** a destination: where a note
-- goes is `requested_routing`, chosen at the desk, and keeping the two apart is
-- what lets the phone stay a voice notebook with no folder tree in it (§2).
--
-- `subject_name` is the name the writer said. It gets a column of its own
-- rather than living in `inference` because **it is testimony and `inference`
-- is for guesses**: a name a person spoke should not sit beside a confidence
-- score as though it were one more proposal.
--
-- Both are nullable. Every capture taken before the companion app existed has
-- neither, and a note where nobody named a category is a perfectly ordinary
-- note rather than a broken row.
--
-- No `sync_status` here on purpose. `capture_items.status` is the *approval*
-- axis (pending / needs_review / approved / rejected); what the phone needs —
-- local, queued, syncing, synced, failed — is a fact about that device's own
-- queue and already lives there, in IndexedDB. A second enum beside `status`
-- would be read as the same question within a month.

create type public.capture_category as enum ('character', 'plot_point', 'idea', 'theme', 'arc');

alter table public.capture_items
  add column if not exists category public.capture_category,
  add column if not exists subject_name text;

comment on column public.capture_items.category is
  'The kind of thought the writer spoke (addendum 09 §4). Not a destination — see requested_routing.';

comment on column public.capture_items.subject_name is
  'The name the writer said: a character, or an optional short label. Testimony, not inference.';

-- The desktop Mobile App inbox reads one project''s notes, newest first, and
-- groups them by category. The existing queue index is keyed on the *user*,
-- which answers a different question.
create index if not exists capture_items_project_inbox_idx
  on public.capture_items (project_id, captured_at desc);
