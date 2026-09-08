-- Addendum 02 §4: a beat can be switched out of the script the way a scene
-- can. It keeps its text and leaves the manuscript, the page count and the
-- exports until it is switched back on.
alter table public.beats
  add column if not exists in_script boolean not null default true;
