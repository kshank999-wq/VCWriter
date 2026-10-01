-- 0065 — when a password was set (addendum 09 §14c)
--
-- From Ken: *once you get your email login, that you set a password, and that
-- it says password set in your account settings… especially for doing teams in
-- writer's room.*
--
-- §14 said *nothing on an account says whether a password was ever set* and
-- made the heading `Password` for everybody. **The fact is stronger than that
-- and the conclusion was wrong for a different reason.** Supabase writes a
-- bcrypt hash into `auth.users.encrypted_password` for **every** account,
-- including one that has only ever used a link: measured on this project, 295
-- of 295 accounts carry a 60-character `$2a$` hash while exactly one has ever
-- signed in. So the column that looks like the answer is not one, and a page
-- that read it would have told every writer alive that their password was set.
--
-- Nothing said so because **the program never wrote its own act down**. That
-- is what earns a column here (addendum 08's `retired`, addendum 24's
-- `deletedAt`): a writer setting a password is an act, not something derivable
-- from the work.
--
-- **The record is made where the password is.** A trigger on the row that
-- holds it, rather than a stamp each screen remembers to write: no client can
-- claim a password it has not got, no screen that sets one can forget to say
-- so, and the reset page and anything built later are covered the day they
-- are written — `on_auth_user_created`'s own shape, and migration 0033's
-- answer to a question RLS cannot ask.

alter table public.profiles
  add column if not exists password_set_at timestamptz;

comment on column public.profiles.password_set_at is
  'When this person last set a password through VC Writer. Null means no record of one — which is not the same as proof there is none, and the wording on the account page says so.';

create or replace function public.note_password_set()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set password_set_at = now(),
         updated_at = now()
   where id = new.id;
  return new;
end;
$$;

-- `UPDATE OF encrypted_password` with the WHEN clause so it fires on a real
-- change and never on a sign-in, a confirmation or any other write to the row.
-- Signing up is an INSERT, so the hash Supabase writes there is not a change
-- and does not stamp — which is the whole point.
-- Nobody may call it. A trigger function is reached by the trigger and by
-- nothing else, and a `security definer` one left with the default grant is
-- callable at `/rest/v1/rpc/note_password_set` by anybody at all — which is
-- what 0005 said of `handle_new_user`, the only other trigger function this
-- project has written, and what the linter said of this one within the hour.
-- The helper functions there stay executable because an RLS policy calls them
-- as the invoking role; this one has no caller but the trigger.
revoke execute on function public.note_password_set() from public, anon, authenticated;

drop trigger if exists on_auth_password_set on auth.users;
create trigger on_auth_password_set
  after update of encrypted_password on auth.users
  for each row
  when (old.encrypted_password is distinct from new.encrypted_password)
  execute function public.note_password_set();
