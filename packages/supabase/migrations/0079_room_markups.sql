-- Markups: a version marked up and sent back to its writer (addendum 07 §27).
--
-- **Beside a version, never inside it.** A version cannot be changed once it
-- exists (0026), so the marks are a row of their own naming the version, each
-- mark anchored to a manuscript element id and a span of its text.
--
-- Who may see one: the person who made it, the writer it was sent to, and
-- whoever runs the room. A markup is a conversation between those people about
-- a draft, and the private-branch rule (§7) says another writer's draft is not
-- every writer's business.

create table if not exists public.room_markups (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  version_id uuid not null references public.versions (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  -- The version's writer. Null where the version has no author in the room.
  recipient_id uuid references auth.users (id) on delete set null,
  marks jsonb not null default '[]'::jsonb,
  note text not null default '',
  state text not null default 'sent' check (state in ('sent', 'seen')),
  sent_at timestamptz not null default now(),
  seen_at timestamptz,
  created_at timestamptz not null default now(),
  constraint room_markups_marks_are_a_list check (jsonb_typeof(marks) = 'array'),
  -- Something has to have been marked or said.
  constraint room_markups_say_something check (jsonb_array_length(marks) > 0 or length(btrim(note)) > 0)
);

create index if not exists room_markups_room_idx on public.room_markups (room_id, sent_at desc);
create index if not exists room_markups_version_idx on public.room_markups (version_id);
create index if not exists room_markups_recipient_idx on public.room_markups (recipient_id);
create index if not exists room_markups_author_idx on public.room_markups (author_id);

alter table public.room_markups enable row level security;

create policy room_markups_read on public.room_markups
  for select using (
    author_id = (select auth.uid())
    or recipient_id = (select auth.uid())
    or public.curates_room(room_id)
  );

-- Mark something up: as yourself, in a room you write, edit or run (§7). A
-- viewer reads and does not mark.
create policy room_markups_send on public.room_markups
  for insert with check (
    author_id = (select auth.uid())
    and (
      public.curates_room(room_id)
      or exists (
        select 1 from public.room_seats s
        where s.room_id = room_markups.room_id
          and s.user_id = (select auth.uid())
          and s.state = 'active'
          and s.role in ('owner', 'writer', 'editor')
      )
    )
  );

-- The writer it was sent to says they have opened it. Nothing else changes:
-- the guard below holds every other column still.
create policy room_markups_seen on public.room_markups
  for update using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

create or replace function public.room_markups_seen_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.request_is_service_role() then
    return new;
  end if;
  if new.room_id is distinct from old.room_id
     or new.version_id is distinct from old.version_id
     or new.author_id is distinct from old.author_id
     or new.recipient_id is distinct from old.recipient_id
     or new.marks is distinct from old.marks
     or new.note is distinct from old.note
     or new.sent_at is distinct from old.sent_at
     or new.created_at is distinct from old.created_at then
    raise exception 'A markup that has been sent is kept as it was sent.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists room_markups_seen_only on public.room_markups;
create trigger room_markups_seen_only before update on public.room_markups
  for each row execute function public.room_markups_seen_only();

revoke execute on function public.room_markups_seen_only() from public, anon, authenticated;

-- No delete policy (§1): what was sent stays sent.
