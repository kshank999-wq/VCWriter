-- A note from VC Writer Notes keeps the category it was caught under and the
-- moment it was caught, so it reads at the desk as it read on the phone.
alter table public.research_items
  add column if not exists capture_category text,
  add column if not exists captured_at timestamptz;
