-- The room's AI spending cap (addendum 07 §14, stage 13).
--
-- 0038 shipped the owner's switch and said, in its own comment, why the cap was
-- not there with it: *it needs metering per room, a decision about what happens
-- when the number is reached, and somewhere to show the running total — and a
-- limit that silently does not hold is worse than no limit at all.* This is the
-- metering and the number. `spending.ts` is the decision, and the room's page
-- is where the total shows.
--
-- **This table records rather than reads, and that is a departure worth being
-- explicit about.** The rest of the module computes — what is new, the activity
-- trail, whether a characterization is used — because the facts were already
-- written down somewhere else and a second copy drifts. Tokens are not written
-- down anywhere: they exist for the length of one HTTP response and then they
-- are gone. A row per reading is the only honest way to know what a month cost,
-- and it records an *event* rather than a second copy of a state, so there is
-- nothing for it to disagree with.
--
-- Cost is stored in cents alongside the tokens rather than recomputed from
-- them: the rate that applied is the rate that applied, and a price change six
-- months from now must not silently rewrite what last quarter cost.

create table if not exists public.room_ai_usage (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  -- Whose reading it was. Null where the account has since gone: the room's
  -- spend is a fact about the room, and losing a person must not lose the money.
  user_id uuid references auth.users (id) on delete set null,
  -- Which reading. Text rather than an enum so a new one needs no migration;
  -- nothing branches on this, it is read by a person looking at a month.
  reading text not null default '',
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  cost_cents integer not null default 0 check (cost_cents >= 0),
  created_at timestamptz not null default now()
);

-- The one query this table exists for: what has this room spent since the first
-- of the month. Descending, because a dashboard also lists the recent ones.
create index if not exists room_ai_usage_room_idx
  on public.room_ai_usage (room_id, created_at desc);

-- Covers the foreign key, and answers the question a showrunner reading a large
-- month actually asks: what has one person in this room spent. The cap is the
-- room's; the breakdown is who.
create index if not exists room_ai_usage_user_idx
  on public.room_ai_usage (user_id, created_at desc);

alter table public.room_ai_usage enable row level security;

-- Read: anybody in the room.
--
-- Not narrowed to whoever may *ask* for a reading. A writer who cannot ask is
-- still in a room whose budget is being spent, and a cap somebody can hit
-- without being able to see it coming is the failure this whole stage is
-- fixing. It says what was spent and by whom; it holds none of the writing.
create policy room_ai_usage_read on public.room_ai_usage
  for select using (public.in_room(room_id));

-- No insert, update or delete policy, deliberately.
--
-- A meter a client may write is not a meter. Rows come from the route that
-- actually made the call, through the service role, with the token counts the
-- model reported — so a room cannot spend without the number moving, and
-- nobody can tidy the number afterwards.

-- What the room will spend in a calendar month, in cents. Null is no cap, and
-- is the default: a room that has not asked for a limit does not have one, and
-- inventing a number would be the product deciding what somebody's work is
-- worth. Zero is a real setting and means *no readings until next month* —
-- which is a different statement from `ai_enabled = false`, that being *this
-- room does not use AI*.
alter table public.rooms
  add column if not exists ai_cap_cents integer
  check (ai_cap_cents is null or (ai_cap_cents >= 0 and ai_cap_cents <= 100000));

comment on column public.rooms.ai_cap_cents is
  'What this room will spend on AI readings in a calendar month, in cents (addendum 07 §14, stage 13). Null is no cap. Checked before a reading and priced after one, so it can be passed by one reading.';

comment on table public.room_ai_usage is
  'One row per AI reading: what it cost the room (addendum 07 §14, stage 13). Written only by the server, read by everybody in the room.';
