-- Security hardening for the helper functions, from the Supabase database
-- linter (`function_search_path_mutable`, `*_security_definer_function_executable`).

-- Pin the search path so the trigger cannot be redirected by a caller-set path.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- `handle_new_user` is only ever invoked by the auth trigger. Nobody should be
-- able to call it through PostgREST.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- `owns_project` must stay executable by `authenticated` because every story
-- table's RLS policy calls it as the invoking role. It only answers "does the
-- caller own this project id", so that exposure is intended; anonymous callers
-- have no business asking.
revoke execute on function public.owns_project(uuid) from public, anon;
grant execute on function public.owns_project(uuid) to authenticated;

-- `public.email_events` and `public.stripe_webhook_events` intentionally have
-- RLS enabled with no policies: they are written and read only by the service
-- role from server-side handlers, so no client role can reach them at all.
