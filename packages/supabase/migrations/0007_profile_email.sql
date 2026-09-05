-- Give profiles the buyer's email, so fulfillment can find a returning customer
-- in one indexed query.
--
-- Without this the only way to map an email to an account is the auth admin
-- API's paginated user list, which silently misses anyone past the first page.
-- A returning customer would then fail fulfillment *after paying* — the worst
-- possible failure in this system.

alter table public.profiles
  add column if not exists email text;

create unique index if not exists profiles_email_key
  on public.profiles (lower(email))
  where email is not null;

-- Backfill from the auth table.
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is null;

-- Keep it populated for every account created from here on.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', ''),
    new.email
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

comment on column public.profiles.email is
  'Mirror of auth.users.email, kept by the signup trigger so fulfillment can resolve a buyer by email.';
