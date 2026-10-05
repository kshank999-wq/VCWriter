-- The desktop subscription (addendum 32).
--
-- VC Writer was a one-off purchase from 0002. It is two recurring plans now,
-- and this is the whole of the data change, because the audit found the rest
-- already standing: `license_status` has carried `expired` since 0002 and
-- nothing ever wrote it, and `licenses.expires_at` has been a column since
-- 0002 and nothing ever wrote it. A subscription is not a second entitlement —
-- it is the licence this schema already has, with its expiry finally written.
--
-- What was genuinely missing is the thread back to Stripe. One subscription
-- renews every month or every year, and if each renewal made an order and a
-- licence a writer would collect twelve serials a year; so a renewal **extends
-- the licence it already has**, and this is how the webhook finds it.

alter table public.licenses
  add column if not exists stripe_subscription_id text;

-- Unique so a replayed `customer.subscription.updated` cannot fan out across
-- rows, and partial so the many licences that have no subscription — every row
-- written before today, and any issued by hand — do not collide on null.
create unique index if not exists licenses_subscription_idx
  on public.licenses (stripe_subscription_id)
  where stripe_subscription_id is not null;

-- Read by the webhook on every renewal and by `licenseLive` on every gate.
create index if not exists licenses_expiry_idx
  on public.licenses (expires_at)
  where expires_at is not null;

comment on column public.licenses.stripe_subscription_id is
  'The Stripe subscription that renews this licence (addendum 32). Null for a licence that does not renew. Written only by the service role from the Stripe webhook.';
