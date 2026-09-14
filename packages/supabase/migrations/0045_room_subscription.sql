-- Recurring seat billing (addendum 07 §14, stage 15).
--
-- §14: *a Writers Room entitlement is separate from the desktop licence — the
-- base subscription includes the owner's seat and further collaborators are
-- billable seats.* The desktop licence is a purchase (0002); this is the only
-- recurring thing in the product.
--
-- **On the room rather than in a table of its own.** A room has exactly one
-- subscription and a subscription belongs to exactly one room, so a second
-- table would be a join that can only ever return one row — and a place for the
-- two to disagree about which room is paid for.
--
-- **Nothing here is writable by anybody signed in.** It is Stripe's answer
-- written down by the webhook, like `orders` and `licenses` (0002), and for the
-- same reason: entitlement is server-authoritative or it is not entitlement.
-- `rooms` is already written only by whoever may write the project, and the
-- routes that touch these columns go through the service role after Stripe has
-- said so.
--
-- **`billed_seats` is what Stripe was last told, not what the room needs.** The
-- room's need is `seatCount(...).billable`, computed from the seats every time.
-- Keeping the two apart is what lets the code notice they have drifted and put
-- the quantity back — and keeping only the first would be keeping a number that
-- can be wrong with nothing to compare it against.

alter table public.rooms
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_state text not null default 'none',
  add column if not exists billed_seats integer not null default 0 check (billed_seats >= 0),
  add column if not exists current_period_end timestamptz;

-- One room per subscription, said by the database rather than hoped for: a
-- second room pointing at the same Stripe subscription would have both of them
-- setting its quantity from different seat counts.
create unique index if not exists rooms_subscription_idx
  on public.rooms (stripe_subscription_id)
  where stripe_subscription_id is not null;

comment on column public.rooms.subscription_state is
  'Stripe''s subscription status as last reported by the webhook, plus ''none'' for a room that never needed one (addendum 07 §14, stage 15). A lapsed subscription stops the room taking another seat and nothing else — see billing.ts.';

comment on column public.rooms.billed_seats is
  'What Stripe was last told this room needs. What it actually needs is computed from the seats; the two being separate is what lets a drift be noticed and corrected.';
