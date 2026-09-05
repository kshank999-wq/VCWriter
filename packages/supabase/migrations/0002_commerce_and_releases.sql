-- VC Writer commerce, licensing and release delivery (spec §3, §12, §17).
--
-- Entitlement is server-authoritative. Nothing in this file is writable by a
-- signed-in user: orders, licenses, builds and activations are written only by
-- the service role from server-side Stripe webhook and download handlers, and
-- customers get read-only visibility into their own rows.

create type public.platform as enum ('windows', 'macos');
create type public.order_status as enum ('pending', 'paid', 'refunded', 'failed', 'disputed');
create type public.license_status as enum ('active', 'suspended', 'revoked', 'expired');
create type public.release_channel as enum ('stable', 'beta', 'internal');

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete restrict,
  status public.order_status not null default 'pending',
  -- Platform picked at checkout. Recorded for analytics/support; it does not
  -- restrict later downloads on its own (§3.2).
  selected_platform public.platform,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'usd',
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  stripe_customer_id text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_user_idx on public.orders (user_id, created_at desc);

create table public.licenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete restrict,
  -- One license per order. This unique constraint is what makes a retried
  -- Stripe webhook idempotent (§17: exactly one license per purchase).
  order_id uuid not null unique references public.orders (id) on delete restrict,
  serial text not null unique,
  status public.license_status not null default 'active',
  -- Data, not a hard-coded rule: §18 keeps "does one purchase grant both OS
  -- installers" configurable.
  entitled_platforms public.platform[] not null default array['windows', 'macos']::public.platform[],
  max_activations integer not null default 2 check (max_activations > 0),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index licenses_user_idx on public.licenses (user_id);

-- Windows and macOS artifacts are published independently: shipping a new
-- Windows build must never replace the Mac artifact (§17).
create table public.release_builds (
  id uuid primary key default gen_random_uuid(),
  platform public.platform not null,
  version text not null,
  channel public.release_channel not null default 'stable',
  minimum_os_version text not null default '',
  -- Storage object key, never a public URL. Downloads are authorised per
  -- request and served as short-lived signed URLs (§19).
  artifact_key text not null,
  artifact_size_bytes bigint not null default 0,
  sha256 text not null default '',
  release_notes text not null default '',
  active boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint release_builds_version_unique unique (platform, channel, version)
);

-- At most one active build per platform/channel, so "current build" is unambiguous.
create unique index release_builds_active_idx
  on public.release_builds (platform, channel)
  where active;

create table public.device_activations (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.licenses (id) on delete cascade,
  device_fingerprint text not null,
  device_name text not null default '',
  platform public.platform not null,
  app_version text not null default '',
  activated_at timestamptz not null default now(),
  last_seen_at timestamptz,
  -- Deactivation is bookkeeping, not a delete, so support can see history (§3.3).
  deactivated_at timestamptz,
  constraint device_activations_unique unique (license_id, device_fingerprint)
);

create index device_activations_license_idx on public.device_activations (license_id) where deactivated_at is null;

-- Stripe delivers webhooks at least once. Recording the event id before
-- processing makes replay a no-op (§19).
create table public.stripe_webhook_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text,
  payload jsonb
);

-- Resend delivery outcomes needed for support, without storing message bodies (§12.3).
create table public.email_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  template text not null,
  provider_message_id text,
  status text not null default 'queued',
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger orders_touch_updated_at before update on public.orders
  for each row execute function public.touch_updated_at();
create trigger licenses_touch_updated_at before update on public.licenses
  for each row execute function public.touch_updated_at();
create trigger release_builds_touch_updated_at before update on public.release_builds
  for each row execute function public.touch_updated_at();
create trigger email_events_touch_updated_at before update on public.email_events
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security: customers read their own commerce rows and write none.
-- ---------------------------------------------------------------------------

alter table public.orders enable row level security;
alter table public.licenses enable row level security;
alter table public.release_builds enable row level security;
alter table public.device_activations enable row level security;
alter table public.stripe_webhook_events enable row level security;
alter table public.email_events enable row level security;

create policy "customers read their own orders" on public.orders
  for select using (user_id = auth.uid());

create policy "customers read their own licenses" on public.licenses
  for select using (user_id = auth.uid());

create policy "customers read their own activations" on public.device_activations
  for select using (
    exists (select 1 from public.licenses l where l.id = license_id and l.user_id = auth.uid())
  );

-- Signed-in customers may see which builds exist (version, notes, minimum OS)
-- so the account page can render a download list. The artifact itself still
-- requires a server-issued signed URL.
create policy "signed-in users read active stable builds" on public.release_builds
  for select to authenticated using (active and channel = 'stable');

-- stripe_webhook_events and email_events get no policies at all: service role only.
