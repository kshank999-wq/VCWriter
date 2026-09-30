-- Notes as a paid companion app (addendum 27 §14).
--
-- The desktop licence is a purchase (0002) and a Writers Room seat is a Stripe
-- subscription (0045). This is the third entitlement and the first one Anthropic
-- — or rather Apple and Google — take the money for: Notes is sold by in-app
-- purchase at $49.99 a year or $4.99 a month, and what it entitles is the app
-- and the syncing that makes it worth having.
--
-- **A row of its own rather than a licence.** `licenses` carries a serial,
-- entitled platforms and an activation count, none of which mean anything for a
-- phone; a store subscription carries a period end, an auto-renew flag and a
-- store's own transaction id, none of which a licence has. The fields differ, so
-- they are two records (addendum 12 §2) — and a licence is `not null unique` on
-- an `orders` row, which a store purchase does not have and must not be given a
-- fake one of.
--
-- **One row per person.** Somebody has at most one Notes subscription at a time.
-- Buying again — on the other store, after a lapse, on a different plan —
-- replaces what is here rather than filing a second row, because two rows would
-- be two answers to *is this account paid up*.
--
-- **`store` and `state` are text, not enums** (0060's reason, which cost a
-- documented route a 400): an enum refuses at the door a value a newer client
-- sends, and the states these two shops report are theirs to change.
--
-- **There is no write policy at all**, exactly as `room_ai_usage` has none
-- (addendum 07 stage 13): an entitlement a client may write is not an
-- entitlement. It is written by the service role after Apple or Google has said
-- so, which is what `orders` and `licenses` have done since 0002.
--
-- **It cascades from the account** — 0062's distinction: an order outlives the
-- account because it is a financial record, an entitlement goes with it.

create table if not exists public.notes_subscriptions (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  -- 'app_store' or 'play_store'. Recorded because a refund, a cancellation and
  -- a restore all have to be asked of the shop that sold it.
  store text not null,
  -- Which plan: the yearly or the monthly product. The price lives in the store
  -- for `pricing.ts`'s reason — it is what the customer is actually charged, and
  -- a second copy here would eventually disagree with the till.
  product_id text not null,
  -- Apple's originalTransactionId, Google's purchaseToken. **Unique**, so one
  -- purchase cannot entitle two accounts — the one fraud a receipt-based
  -- entitlement is open to, said by the database rather than hoped for.
  store_transaction_id text not null,
  -- The shop's own word for where it stands, plus 'none'. `notesPlan` in the
  -- domain decides what each one means for a writer.
  state text not null default 'none',
  -- When what has been paid for runs out. Null before a purchase is verified.
  current_period_end timestamptz,
  auto_renews boolean not null default true,
  -- 'production' or 'sandbox'. A sandbox receipt is a real answer from the shop
  -- and a test purchase is not a sale, so support needs to be able to tell.
  environment text not null default 'production',
  -- When the shop was last asked. A subscription nobody has checked since
  -- before its period ended is not the same as one known to be lapsed.
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists notes_subscriptions_transaction_idx
  on public.notes_subscriptions (store, store_transaction_id);

create trigger notes_subscriptions_touch_updated_at
  before update on public.notes_subscriptions
  for each row execute function public.touch_updated_at();

alter table public.notes_subscriptions enable row level security;

-- Read your own, and nothing else. Everybody who pays for this may see what
-- they are paying for and when it next renews; a cap or a period end you can
-- reach without seeing it coming is the failure that rule exists to stop.
create policy "writers read their own notes subscription" on public.notes_subscriptions
  for select using (user_id = (select auth.uid()));

comment on table public.notes_subscriptions is
  'The Notes companion app subscription, bought by in-app purchase from the App Store or Google Play (addendum 27 §14). One row per person, written only by the service role after the store has been asked. What it entitles is sending notes and syncing them; reading what is already here is never refused.';

comment on column public.notes_subscriptions.store_transaction_id is
  'Apple originalTransactionId / Google purchaseToken. Unique per store: one purchase entitles one account.';
