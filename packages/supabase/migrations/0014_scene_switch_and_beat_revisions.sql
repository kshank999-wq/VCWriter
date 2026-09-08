-- Addendum 02 §7: the scene and beat dialogs.
--
-- A scene can be switched off: it stays in the structure and leaves the
-- manuscript. A beat keeps revisions of its text and may carry a colour.
alter table public.structural_units
  add column if not exists in_script boolean not null default true;

alter table public.beats
  add column if not exists revision_name text not null default 'Draft 1',
  add column if not exists revisions jsonb not null default '[]'::jsonb,
  add column if not exists color text;
