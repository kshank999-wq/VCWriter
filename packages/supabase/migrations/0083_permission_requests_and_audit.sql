-- Permission requests and the room's audit trail (addendum 07 §32; workflow
-- spec v1.1 §7, §13).
--
-- **Permission requests.** Material in the master is the showrunner's to
-- change. A writer who wants to revise something already integrated asks; the
-- showrunner grants or denies. A grant never opens the master: it makes a new
-- task for the writer, whose result is reviewed and integrated like any other.
--
-- **The audit trail.** Every task transition — assign, start, submit, return,
-- approve, integrate, close, reopen, permission asked, granted, denied — is a
-- row. Rows are written by the server after it has checked the person may act,
-- and nobody can change or remove one.

create table if not exists public.room_permission_requests (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  requester_id uuid not null references auth.users (id) on delete cascade,
  -- What it is about: the beat where there is one, and its name as it was.
  beat_id text,
  target_label text not null default '',
  -- The task it came from, where it came from one.
  assignment_id uuid references public.assignments (id) on delete set null,
  reason text not null,
  proposed text not null default '',
  state text not null default 'pending' check (state in ('pending', 'granted', 'denied', 'withdrawn')),
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  decision_note text not null default '',
  -- The new task a grant made.
  granted_assignment_id uuid references public.assignments (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint room_permission_requests_say_why check (length(btrim(reason)) > 0)
);

create index if not exists room_permission_requests_room_idx on public.room_permission_requests (room_id, created_at desc);
create index if not exists room_permission_requests_requester_idx on public.room_permission_requests (requester_id);
create index if not exists room_permission_requests_assignment_idx on public.room_permission_requests (assignment_id);
create index if not exists room_permission_requests_granted_idx on public.room_permission_requests (granted_assignment_id);
create index if not exists room_permission_requests_decider_idx on public.room_permission_requests (decided_by);

alter table public.room_permission_requests enable row level security;

-- Seen by who asked and by whoever runs the room.
create policy room_permission_requests_read on public.room_permission_requests
  for select using (requester_id = (select auth.uid()) or public.curates_room(room_id));

-- Asked as yourself, by a writer or editor in the room.
create policy room_permission_requests_ask on public.room_permission_requests
  for insert with check (
    requester_id = (select auth.uid())
    and state = 'pending'
    and exists (
      select 1 from public.room_seats s
      where s.room_id = room_permission_requests.room_id
        and s.user_id = (select auth.uid())
        and s.state = 'active'
        and s.role in ('writer', 'editor', 'owner')
    )
  );

-- Decided by whoever runs the room; withdrawn by who asked. The guard below
-- says which of those each may do.
create policy room_permission_requests_decide on public.room_permission_requests
  for update using (requester_id = (select auth.uid()) or public.curates_room(room_id))
  with check (requester_id = (select auth.uid()) or public.curates_room(room_id));

create or replace function public.room_permission_requests_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.room_id is distinct from old.room_id
     or new.requester_id is distinct from old.requester_id
     or new.beat_id is distinct from old.beat_id
     or new.target_label is distinct from old.target_label
     or new.assignment_id is distinct from old.assignment_id
     or new.reason is distinct from old.reason
     or new.proposed is distinct from old.proposed
     or new.created_at is distinct from old.created_at then
    raise exception 'A request is kept as it was asked.' using errcode = 'check_violation';
  end if;
  if public.request_is_service_role() then
    return new;
  end if;
  if old.state <> 'pending' then
    raise exception 'This request has already been answered.' using errcode = 'check_violation';
  end if;
  if public.curates_room(new.room_id) and new.state in ('granted', 'denied') then
    return new;
  end if;
  if new.requester_id = (select auth.uid()) and new.state = 'withdrawn'
     and new.decided_by is null and new.granted_assignment_id is null then
    return new;
  end if;
  raise exception 'Granting or denying a request is the showrunner''s.' using errcode = 'check_violation';
end;
$$;

drop trigger if exists room_permission_requests_guard on public.room_permission_requests;
create trigger room_permission_requests_guard before update on public.room_permission_requests
  for each row execute function public.room_permission_requests_guard();
revoke execute on function public.room_permission_requests_guard() from public, anon, authenticated;

-- No delete policy: what was asked stays asked.

create table if not exists public.room_audit_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  entity_type text not null check (entity_type in ('assignment', 'submission', 'master', 'permission_request', 'markup')),
  entity_id uuid,
  action text not null,
  from_state text,
  to_state text,
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists room_audit_events_room_idx on public.room_audit_events (room_id, created_at desc);
create index if not exists room_audit_events_entity_idx on public.room_audit_events (entity_id);
create index if not exists room_audit_events_actor_idx on public.room_audit_events (actor_id);

alter table public.room_audit_events enable row level security;

-- The showrunner reads the room's trail; a writer reads what they did and what
-- was done to their own tasks and submissions.
create policy room_audit_events_read on public.room_audit_events
  for select using (
    public.curates_room(room_id)
    or actor_id = (select auth.uid())
    or exists (
      select 1 from public.assignments a
      where a.id = room_audit_events.entity_id and a.assignee_id = (select auth.uid())
    )
    or exists (
      select 1 from public.submissions s
      where s.id = room_audit_events.entity_id and s.author_id = (select auth.uid())
    )
  );

-- No insert, update or delete policy: only the server writes it, after it has
-- checked the person may act, and nobody changes it afterwards.
