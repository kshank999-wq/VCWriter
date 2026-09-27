-- The character record the Overview asks for (addendum 25 §3, stage 1).
--
-- Three fields, and the first is a correction. `tags` (0040) was given to the
-- writer's own shorthand for *who somebody is* — antagonist, comic relief, the
-- one who knows — and the handoff's Overview wants that as a **role**, chosen
-- from chips, beside tags that are the book's own topics: money, grief, the
-- Christmas thread. One field was answering two questions. `role` takes the
-- first and `tags` keeps the second; nothing is migrated, because a tag that
-- reads as a role is still a true thing to have said about the person.
--
-- It is text rather than an enum for 0040's reason and the module's: the
-- vocabulary is the writer's. The chips are offered in the interface.
alter table public.characters
  add column if not exists role text not null default '';

comment on column public.characters.role is
  'What this person is to the story (addendum 25 §3). Free text; the interface offers the usual six. Not the category, which is how much of the story they are in, and not a tag, which is a topic.';

-- The optional half of the record (spec §3: a flexible general-information
-- area *without making biography the center of the tool*). One object rather
-- than three columns, because it is one collapsed group on the screen and
-- every field in it is optional together.
alter table public.characters
  add column if not exists background jsonb not null default '{}'::jsonb;

comment on column public.characters.background is
  'Age, look and history (addendum 25 §3). Optional, and shown behind a fold.';

-- The writer's own fields. A **list** rather than an object: a map loses the
-- order they were made in and cannot be renamed without losing its value,
-- since the name is the key. Each carries an id, so renaming is an edit.
alter table public.characters
  add column if not exists custom_fields jsonb not null default '[]'::jsonb;

comment on column public.characters.custom_fields is
  'The writer''s own fields, in order: [{id, name, value}] (addendum 25 §3). A list rather than a map so a field can be renamed without losing what is in it.';
