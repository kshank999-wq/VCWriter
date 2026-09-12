-- Whether the room uses AI at all (addendum 07 §14, stage 12).
--
-- §14: *room-level usage and cost controls are the owner's to set.* This is the
-- control that can be honoured completely, so it is the one that ships: one
-- switch, the owner's, default on.
--
-- **A spending cap is deliberately not here.** It needs metering per room, a
-- decision about what happens when the number is reached, and somewhere to show
-- the running total — and a limit that silently does not hold is worse than no
-- limit at all. What exists meanwhile is the per-account rate limit every AI
-- call in the product already goes through, which is a spending limit wearing
-- a different name.
--
-- No new policy: `rooms` is already read by every member and written by whoever
-- may write the project, which is exactly who should be turning this off.
alter table public.rooms
  add column if not exists ai_enabled boolean not null default true;

comment on column public.rooms.ai_enabled is
  'Whether this room may ask the AI for readings (addendum 07 §14). The owner''s switch; asking is the only thing that costs money.';
