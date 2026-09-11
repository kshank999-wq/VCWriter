-- One correction to 0026, raised by the linter.
--
-- `versions_are_immutable` was declared without `set search_path`. Every other
-- function in this schema pins it (0005 did that deliberately), and a trigger
-- function is the one place it matters most: it runs on every write to
-- `versions`, under whatever search path the caller happens to have, which is
-- a way for somebody who can create a schema to be running their code inside
-- the guard that is supposed to stop them.
--
-- The body is unchanged. Only the declaration is.
create or replace function public.versions_are_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'A version cannot be % once it exists (addendum 07 §1). Make a new one.',
    case tg_op when 'UPDATE' then 'changed' else 'deleted' end;
end;
$$;
