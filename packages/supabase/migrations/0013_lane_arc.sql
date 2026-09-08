-- Addendum 02 §4: a plot lane carries its arc — how the thread develops —
-- next to its summary (`description`). Edited in the lane pop-up on the
-- master timeline and on the Plots research tab.
alter table public.lanes add column if not exists arc text not null default '';
