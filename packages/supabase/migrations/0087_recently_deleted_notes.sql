-- Recently deleted notes (addendum 27 §34).
--
-- From Ken, 11 November: deleted notes go to a "Recently deleted" folder for
-- 30 days, restorable from the phone and the desktop, before they are removed
-- for good.
--
-- **Kept by the database, not by each app.** A trigger copies a note into
-- `deleted_capture_items` the moment it is deleted, whoever deletes it: the
-- phone, the desk, the web, an installer already in the field. Nothing that
-- reads notes changes; a deleted note is simply not in `capture_items` any
-- more. Restoring puts the row back exactly as it was.
--
-- **A whole account going is not a deletion of notes.** Notes removed because
-- their account was deleted arrive here as a cascade (trigger depth above
-- one) and are not kept: deleting an account means everything goes.
--
-- After 30 days a note is removed for good. There is no scheduler on this
-- project, so the purge runs whenever the bin is listed or a note is deleted.

create table if not exists public.deleted_capture_items (
  id uuid primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  row jsonb not null,
  deleted_at timestamptz not null default now()
);

create index if not exists deleted_capture_items_user_idx on public.deleted_capture_items (user_id, deleted_at desc);

alter table public.deleted_capture_items enable row level security;

-- Each writer sees and empties only their own bin. Nothing is written here
-- except by the trigger, and nothing is changed.
create policy deleted_capture_items_read on public.deleted_capture_items
  for select using (user_id = (select auth.uid()));
create policy deleted_capture_items_empty on public.deleted_capture_items
  for delete using (user_id = (select auth.uid()));

create or replace function public.keep_deleted_capture()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- A cascade from the account itself being deleted: let it go.
  if pg_trigger_depth() > 1 then
    return old;
  end if;
  insert into public.deleted_capture_items (id, user_id, row, deleted_at)
  values (old.id, old.user_id, to_jsonb(old), now())
  on conflict (id) do update set row = excluded.row, deleted_at = excluded.deleted_at;
  delete from public.deleted_capture_items where deleted_at < now() - interval '30 days';
  return old;
end;
$$;

drop trigger if exists keep_deleted_capture on public.capture_items;
create trigger keep_deleted_capture before delete on public.capture_items
  for each row execute function public.keep_deleted_capture();

revoke execute on function public.keep_deleted_capture() from public, anon, authenticated;

-- Put notes back, the caller's own only. A project deleted meanwhile leaves the
-- note unfiled rather than refused; a note whose phone id has been sent again
-- since is skipped, because the newer one is already there.
create or replace function public.restore_deleted_captures(ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  kept record;
  note public.capture_items;
  restored integer := 0;
begin
  for kept in
    select * from public.deleted_capture_items
    where id = any(ids) and user_id = (select auth.uid())
  loop
    note := jsonb_populate_record(null::public.capture_items, kept.row);
    if note.project_id is not null and not exists (select 1 from public.projects p where p.id = note.project_id) then
      note.project_id := null;
    end if;
    begin
      insert into public.capture_items select note.*;
      delete from public.deleted_capture_items where id = kept.id;
      restored := restored + 1;
    exception when unique_violation then
      null;
    end;
  end loop;
  return restored;
end;
$$;

revoke execute on function public.restore_deleted_captures(uuid[]) from public, anon;
grant execute on function public.restore_deleted_captures(uuid[]) to authenticated;

-- Remove what has been in the bin for more than 30 days.
create or replace function public.purge_deleted_captures()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.deleted_capture_items where deleted_at < now() - interval '30 days';
$$;

-- The server's to run, never a signed-in user's directly.
revoke execute on function public.purge_deleted_captures() from public, anon, authenticated;
