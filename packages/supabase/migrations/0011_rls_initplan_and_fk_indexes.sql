-- Two performance corrections the Supabase database linter raised. Neither
-- changes who can see what: every policy below authorises exactly the rows it
-- authorised before.
--
-- 1. `auth.uid()` written bare in a policy is evaluated once per row, because
--    the planner cannot prove it is constant for the statement. Wrapping it as
--    `(select auth.uid())` turns it into an InitPlan the planner runs once and
--    reuses. On a project with thousands of beats that is thousands of calls
--    saved per query. See lint 0003_auth_rls_initplan.
--
-- 2. A foreign key with no covering index makes the referenced side pay a
--    sequential scan on every delete or update of a parent row. Deleting one
--    project cascades into beats, structural_units and capture_items, so these
--    are exactly the paths that would feel it.
--
-- Applied to a database with no customer rows in it, so both are instant.

-- ---------------------------------------------------------------------------
-- 1. Policies re-created with the InitPlan form
-- ---------------------------------------------------------------------------
-- `drop` then `create` rather than `alter`: `alter policy` cannot change a
-- policy's expression and leave everything else alone in one statement, and a
-- re-create keeps the definition readable next to the original migration.
-- Each keeps its original name, command and role (PUBLIC — the policies are
-- scoped by `auth.uid()`, not by grant).

drop policy "profiles are self-service" on public.profiles;
create policy "profiles are self-service" on public.profiles
  for all
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy "projects belong to their owner" on public.projects;
create policy "projects belong to their owner" on public.projects
  for all
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy "customers read their own orders" on public.orders;
create policy "customers read their own orders" on public.orders
  for select
  using (user_id = (select auth.uid()));

drop policy "customers read their own licenses" on public.licenses;
create policy "customers read their own licenses" on public.licenses
  for select
  using (user_id = (select auth.uid()));

drop policy "customers read their own activations" on public.device_activations;
create policy "customers read their own activations" on public.device_activations
  for select
  using (
    exists (
      select 1 from public.licenses l
      where l.id = device_activations.license_id
        and l.user_id = (select auth.uid())
    )
  );

drop policy "captures belong to the capturing user" on public.capture_items;
create policy "captures belong to the capturing user" on public.capture_items
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 2. Covering indexes for foreign keys that had none
-- ---------------------------------------------------------------------------
create index if not exists beats_project_idx on public.beats (project_id);
create index if not exists structural_units_project_idx on public.structural_units (project_id);
create index if not exists capture_items_project_idx on public.capture_items (project_id);
create index if not exists characters_research_item_idx on public.characters (research_item_id);
create index if not exists email_events_user_idx on public.email_events (user_id);
create index if not exists error_reports_user_idx on public.error_reports (user_id);
