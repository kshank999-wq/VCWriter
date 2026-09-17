-- A lane becomes a track, everywhere, including here.
--
-- The word on the screen is Track now (Causality calls its rows lanes and
-- this is a nonlinear editor's timeline, not a copy of one). The project's
-- own rule would have allowed the storage to keep saying `lane` — the noun
-- table exists precisely so a visible word is data, and a unit's *kind* stays
-- `chapter` on a textbook while the noun reads Section. But that rule is for
-- a word that differs **per format**. This one differs for nobody: there is
-- no format in which a track is called a lane, so a column named `lane_id`
-- would be a permanent translation between what the screen says and what the
-- database holds, with nothing on the other side of it.
--
-- It is done now because `lanes` holds zero rows and no story_link points at
-- one. Nothing is migrated, nothing can be lost, and it will never be this
-- cheap again — a rename after the first customer means a data migration and
-- a released desktop build reading a column that has gone.
--
-- Postgres rewrites the policy bodies itself: a policy references the table by
-- oid, not by name, so only the *names* are renamed below, and only so that a
-- reader of \d tracks is not told about lanes.

alter table public.lanes rename to tracks;
alter table public.structural_units rename column lane_id to track_id;
alter type public.lane_kind rename to track_kind;

-- Renaming the primary key constraint renames its index with it, so the
-- index is not renamed separately: doing both fails on the second.
alter table public.tracks rename constraint lanes_pkey to tracks_pkey;
alter table public.tracks rename constraint lanes_name_check to tracks_name_check;
alter table public.tracks rename constraint lanes_project_id_fkey to tracks_project_id_fkey;
alter table public.structural_units
  rename constraint structural_units_lane_id_fkey to structural_units_track_id_fkey;

alter index public.lanes_project_idx rename to tracks_project_idx;
alter index public.structural_units_lane_idx rename to structural_units_track_idx;

alter trigger lanes_touch_updated_at on public.tracks rename to tracks_touch_updated_at;

alter policy lanes_member_read on public.tracks rename to tracks_member_read;
alter policy lanes_owner_insert on public.tracks rename to tracks_owner_insert;
alter policy lanes_owner_update on public.tracks rename to tracks_owner_update;
alter policy lanes_owner_delete on public.tracks rename to tracks_owner_delete;
