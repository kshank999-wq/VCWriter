-- The archive of the phone's notes (addendum 27 §25, §29).
--
-- Ken: *when you transfer the notes off the phone and it goes into the
-- archive, put it in a single folder… by date and by title of that project…
-- and then you can delete it by the folder… In the notes app… it should clear
-- all transferred notes. And since they'll be in the archive, there's a
-- backup.*
--
-- Two columns and one loosened rule.
--
-- `filed_into` is the title of the project a note was filed into at the desk.
-- Together with `reviewed_at`'s date it names the archive folder a transfer
-- lands in. Text rather than a reference: the desk's project may be a file on
-- one computer that the server has never seen, and the folder is named for
-- the writer to read, not joined against.
--
-- `cleared_from_phone_at` is when the phone was told to stop showing a filed
-- note. **Clearing is not deleting**: the note stays on the account, in the
-- desk's archive, which is the backup Ken names. The phone lists only notes
-- without it.
--
-- And the delete rule: 0042 let a writer throw away only a note still waiting.
-- The archive is the writer's to empty, so their own note of any status may
-- be deleted — the research note it became is in the project either way, and
-- nothing in a project points back at the capture. *Changing* a filed note
-- stays refused: 0042's update rule is untouched (the server writes
-- `cleared_from_phone_at` itself, for the caller's own rows).
alter table public.capture_items
  add column if not exists filed_into text,
  add column if not exists cleared_from_phone_at timestamptz;

alter policy "a waiting capture can be thrown away" on public.capture_items
  using (user_id = (select auth.uid()));
alter policy "a waiting capture can be thrown away" on public.capture_items
  rename to "a capture can be thrown away by whoever caught it";
