-- A submission says which assignment it answers (addendum 07 §28).
--
-- From Ken: *when the assignment is returned, there needs to be something that
-- correlates that return.* Null is a writer's own work, started on their own,
-- and stays a first-class thing: *the writers also need to be able to work on
-- different things and show work that they've initiated.*
--
-- Set only on the way in, by the route that checks the assignment is the
-- writer's own; an assignment called off leaves the submission standing.

alter table public.submissions
  add column if not exists assignment_id uuid references public.assignments (id) on delete set null;

create index if not exists submissions_assignment_idx on public.submissions (assignment_id);
