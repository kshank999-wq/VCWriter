-- The project formats the database had not been told about.
--
-- From Ken, creating a project in the Notes app: *Invalid input value for
-- enum project_format: "instructional"*. The domain's `projectFormatSchema`
-- gained three formats — `instructional` (addendum 16), `game` (addendum 18)
-- and `document` (addendum 42) — and `public.project_format` never did, so
-- making one of them from the phone failed, and so would syncing one from
-- the desk. `project-formats.test.ts` in apps/web now reads the migrations and
-- fails when the domain names a format no migration adds.
alter type public.project_format add value if not exists 'instructional';
alter type public.project_format add value if not exists 'game';
alter type public.project_format add value if not exists 'document';
