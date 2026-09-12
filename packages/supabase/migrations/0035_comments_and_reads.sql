-- Comments, mentions and what is new (addendum 07 §14, stage 10).
--
-- **A comment is speech about the work, not the work.** That settles the two
-- decisions a reader of this file will wonder about.
--
-- It is why there is an update policy at all — a person correcting their own
-- typo is not rewriting anybody's script — and why there is **no delete
-- policy**: a thread with a hole in it is a conversation nobody can follow, and
-- §1's *no state means gone* covers the record of the room as much as its
-- pages. Withdrawing is a state, and the thread still reads.
--
-- **No activity table.** §9's audit trail is a *reading* of the records that
-- already carry these facts — a version's author and moment, a submission's
-- state and who decided it, a seat's dates — rather than a second copy of them
-- beside the first. A second copy is the one thing an audit trail must never
-- be, because it can disagree.

create type public.comment_target as enum ('room', 'scene', 'beat', 'element', 'research');
create type public.comment_state as enum ('open', 'resolved', 'withdrawn');

create table if not exists public.room_comments (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  -- The thread this answers, or null where it *is* the thread. One level deep:
  -- a conversation that branches into a tree is one nobody can follow.
  parent_id uuid references public.room_comments (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,

  target_kind public.comment_target not null default 'room',
  -- No foreign key, for the third time and the same reason (0033, 0034): the
  -- record lives in a document, and every branch carries its own copy under the
  -- same id — which is what makes one thread about one scene visible on four
  -- writers' lines at once.
  target_id uuid,
  target_label text not null default '',

  body text not null default '',
  -- Who was named, settled when it was said. Stored rather than parsed on the
  -- way out: renaming somebody two weeks later must not silently re-address
  -- what was already written.
  mentions uuid[] not null default '{}',
  state public.comment_state not null default 'open',
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- The room is not a record, and a record is not the room.
  constraint room_comments_whole_target
    check ((target_kind = 'room') = (target_id is null)),
  -- Something has to have been said.
  constraint room_comments_say_something
    check (state = 'withdrawn' or length(btrim(body)) > 0)
);

create index if not exists room_comments_room_idx on public.room_comments (room_id, created_at desc);
create index if not exists room_comments_thread_idx on public.room_comments (parent_id);
create index if not exists room_comments_target_idx on public.room_comments (target_kind, target_id);
create index if not exists room_comments_author_idx on public.room_comments (author_id);

create trigger room_comments_touch_updated_at before update on public.room_comments
  for each row execute function public.touch_updated_at();

alter table public.room_comments enable row level security;

-- Read: anybody in the room. A comment on a scene is the room talking.
create policy room_comments_read on public.room_comments
  for select using (public.in_room(room_id));

-- Say something: your own, and not as a viewer (§7).
--
-- The role is checked with a plain subquery rather than a ninth `SECURITY
-- DEFINER` helper, and that is deliberate: those exist because the caller
-- usually cannot read the table the question is about, and here they can —
-- `room_seats_member_read` already lets a member see the room's seats, so the
-- subquery answers under the caller's own rights and adds nothing to the
-- surface the linter has to warn about.
create policy room_comments_say on public.room_comments
  for insert with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.room_seats s
      where s.room_id = room_comments.room_id
        and s.user_id = (select auth.uid())
        and s.state = 'active'
        and s.role in ('owner', 'writer', 'editor')
    )
  );

-- Change it: the person who said it, or whoever runs the room.
--
-- The showrunner's reach here is narrow and intended — marking a thread
-- settled. What they may change *within* the row is not guarded by a trigger
-- the way an assignment's is (0033), because the worst case differs in kind: a
-- showrunner editing somebody's words would be visible to everybody who had
-- already read the thread, where an assignment quietly rewritten is not.
create policy room_comments_amend on public.room_comments
  for update using (
    author_id = (select auth.uid()) or public.curates_room(room_id)
  ) with check (
    author_id = (select auth.uid()) or public.curates_room(room_id)
  );

-- No delete policy (§1). A comment taken back is `withdrawn`, which says what
-- happened and leaves the thread readable.

-- When each person last looked, so *what is new* has something to mean.
--
-- One row per person per room, and nothing else: what is new is computed from
-- the comments themselves (§14) rather than kept as a notification per event,
-- because a notification row is a second copy of something already written
-- down and a second copy drifts.
create table if not exists public.room_reads (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

alter table public.room_reads enable row level security;

-- Yours alone, in every direction. When somebody last looked at a room is
-- nobody else's business, and a room that could see it would be a room where
-- being away from your desk is visible.
create policy room_reads_own on public.room_reads
  for select using (user_id = (select auth.uid()));

create policy room_reads_own_insert on public.room_reads
  for insert with check (user_id = (select auth.uid()) and public.in_room(room_id));

create policy room_reads_own_update on public.room_reads
  for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
