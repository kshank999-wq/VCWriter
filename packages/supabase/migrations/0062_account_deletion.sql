-- Deleting an account, and the two constraints that made it impossible
-- (addendum 27 §12).
--
-- The App Store requires that an application offering accounts lets somebody
-- delete theirs — not deactivate it, delete it — and there was no way to.
-- Not because nothing was built: because the database refused. `profiles.id`
-- cascades from `auth.users`, so removing the sign-in removes the profile,
-- and both `orders.user_id` and `licenses.user_id` referenced that profile
-- **on delete restrict**. Every customer who had ever bought anything was
-- therefore undeletable, which is precisely the set of people most likely to
-- ask.
--
-- The restriction was right about one of the two and wrong about the other,
-- and separating them is the whole of this migration.
--
-- **An order outlives the account, because it is a financial record.** Tax and
-- accounting law wants it and the privacy policy says so out loud. But an
-- order does not need a person attached to be that record: it carries the
-- amount, the currency, the Stripe session, payment intent and customer, and
-- when it was paid, which is a complete receipt, and Stripe holds the identity
-- half under its own retention. So the column becomes nullable and the
-- reference becomes `set null` — the row survives the person, carrying
-- everything an auditor asks for and nothing that says who they were.
--
-- **A licence goes with the account, because it is an entitlement.** Somebody
-- who deletes their account has given up the software; a serial with no owner
-- is a row nobody can retrieve and nobody may use. `device_activations`
-- already cascades from the licence, so the machines go with it and no orphan
-- is left behind. `licenses.order_id` is untouched and stays `restrict`: it
-- says an order may not be deleted while a licence points at it, which is a
-- rule about deleting *orders* and is one this change never triggers.
--
-- Everything else about deletion needed nothing at all. Projects, captures and
-- branches already cascade from the profile, a room cascades from its project,
-- and the room records that are somebody else's to keep — a version's author,
-- a seat's holder — already set null rather than cascading, which is addendum
-- 07 §1's rule (one writer's work is never destroyed by another's) turning out
-- to have answered this question years before it was asked.

alter table public.orders
  alter column user_id drop not null;

alter table public.orders
  drop constraint orders_user_id_fkey;

alter table public.orders
  add constraint orders_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete set null;

comment on column public.orders.user_id is
  'Who bought it, until they delete their account. Null means the buyer is gone and this row is the financial record alone (migration 0062).';

alter table public.licenses
  drop constraint licenses_user_id_fkey;

alter table public.licenses
  add constraint licenses_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;
