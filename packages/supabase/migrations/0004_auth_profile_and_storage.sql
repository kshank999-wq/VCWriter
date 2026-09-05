-- Account bootstrap and storage layout.
--
-- A profile row must exist before a project can reference it, so it is created
-- from the auth trigger rather than from client code — otherwise a signup that
-- drops its follow-up request leaves an account that cannot create anything.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Storage buckets — all private (spec §19: installers are never permanently
-- public URLs; project assets and voice captures are user data).
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values
  ('releases', 'releases', false),
  ('project-assets', 'project-assets', false),
  ('captures', 'captures', false)
on conflict (id) do nothing;

-- Project assets live under `<project_id>/...`; access follows project ownership.
create policy "owners manage their project assets" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'project-assets'
    and public.owns_project(nullif(split_part(name, '/', 1), '')::uuid)
  )
  with check (
    bucket_id = 'project-assets'
    and public.owns_project(nullif(split_part(name, '/', 1), '')::uuid)
  );

-- Voice captures live under `<user_id>/...`.
create policy "users manage their own captures" on storage.objects
  for all to authenticated
  using (bucket_id = 'captures' and nullif(split_part(name, '/', 1), '')::uuid = auth.uid())
  with check (bucket_id = 'captures' and nullif(split_part(name, '/', 1), '')::uuid = auth.uid());

-- The `releases` bucket deliberately gets no policy: installers are readable
-- only through short-lived signed URLs minted server-side after an entitlement
-- check (see apps/web/src/app/api/downloads).
