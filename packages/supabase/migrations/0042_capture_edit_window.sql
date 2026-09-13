-- A note the desktop has placed is history (addendum 09 §7, stage 3).
--
-- The phone can now review and correct what it caught, which raises a question
-- 0003's blanket policy never had to answer: may a writer reach back from their
-- phone and rewrite a note the desktop has already turned into a research item?
--
-- No. The research note exists, it may have been edited, it may be linked to a
-- character — changing the capture it came from would alter nothing about the
-- project and everything about the record of where that work came from. A note
-- **waiting** is the writer's to fix or throw away; a note **placed** is the
-- trail behind something real.
--
-- Said here rather than only in the phone's interface, because a rule enforced
-- in a screen is a rule the next client will not know about — and the whole
-- point of stage 2's upload contract is that there may be another client.
--
-- Reading is untouched: a writer can always see everything they captured,
-- including what has been filed, which is what §9's "preserving a local
-- reviewable copy" wants from the server's side.

drop policy if exists "captures belong to the capturing user" on public.capture_items;

create policy "captures are read by whoever caught them" on public.capture_items
  for select using (user_id = (select auth.uid()));

create policy "captures are inserted by whoever caught them" on public.capture_items
  for insert with check (user_id = (select auth.uid()));

-- USING sees the row as it stands, so approving a waiting note still passes;
-- WITH CHECK only keeps it the writer's own, or the desktop could never move a
-- capture out of `pending` at all.
create policy "a waiting capture can still be changed" on public.capture_items
  for update
  using (user_id = (select auth.uid()) and status in ('pending', 'needs_review'))
  with check (user_id = (select auth.uid()));

create policy "a waiting capture can be thrown away" on public.capture_items
  for delete using (user_id = (select auth.uid()) and status in ('pending', 'needs_review'));
