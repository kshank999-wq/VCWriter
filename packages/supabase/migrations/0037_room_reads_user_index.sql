-- A covering index the advisor asked for after 0035.
--
-- `room_reads` is keyed `(room_id, user_id)`, which covers a lookup by room and
-- a lookup by both — but not the foreign key to `auth.users`, which is checked
-- by `user_id` alone. It matters at exactly one moment, and it is the moment
-- where it would hurt most: deleting an account cascades through every row that
-- references it, and without this that means a full scan of this table for each
-- one.
create index if not exists room_reads_user_idx on public.room_reads (user_id);
