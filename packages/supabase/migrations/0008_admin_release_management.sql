-- Admin tooling for release builds (spec §3.2: "Admin tooling must allow
-- separate Windows and macOS build files, version numbers, release notes,
-- minimum OS requirements, and active/retired status").
--
-- Admin is a flag on the profile rather than a role in the JWT, so granting or
-- revoking it is one visible row change with no token to re-issue.

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

comment on column public.profiles.is_admin is
  'Grants access to release management. Set deliberately; never granted by signup.';

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Admins can see every build, including retired and non-stable ones. The
-- existing policy that lets any signed-in customer read the active stable
-- builds stays as it is.
create policy "admins read every release build" on public.release_builds
  for select to authenticated using (public.is_admin());

-- Writes stay service-role only even for admins: publishing goes through the
-- server route, which is where the storage object and the row are kept
-- consistent with each other.
