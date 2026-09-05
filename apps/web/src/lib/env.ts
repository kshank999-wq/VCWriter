/**
 * Environment access.
 *
 * Every value is read lazily and fails loudly at the point of use rather than
 * at import time: a missing Stripe key must break checkout, not the marketing
 * pages or a CI build that has no secrets configured.
 */

const required = (name: string): string => {
  const value = process.env[name];
  if (!value || value.length === 0) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
};

const optional = (name: string, fallback: string): string => process.env[name] ?? fallback;

export const env = {
  get supabaseUrl(): string {
    return required('NEXT_PUBLIC_SUPABASE_URL');
  },
  get supabaseAnonKey(): string {
    return required('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  },
  /** Server only. Bypasses row level security — never import into a client component. */
  get supabaseServiceRoleKey(): string {
    return required('SUPABASE_SERVICE_ROLE_KEY');
  },
  get stripeSecretKey(): string {
    return required('STRIPE_SECRET_KEY');
  },
  get stripeWebhookSecret(): string {
    return required('STRIPE_WEBHOOK_SECRET');
  },
  get stripePriceId(): string {
    return required('STRIPE_PRICE_ID_DESKTOP');
  },
  get resendApiKey(): string {
    return required('RESEND_API_KEY');
  },
  get resendFrom(): string {
    return optional('RESEND_FROM_ADDRESS', 'VC Writer <noreply@vc-writer.com>');
  },
  get releaseBucket(): string {
    return optional('RELEASE_BUCKET', 'releases');
  },
  get releaseDownloadTtlSeconds(): number {
    return Number.parseInt(optional('RELEASE_DOWNLOAD_TTL_SECONDS', '900'), 10);
  },
  get siteUrl(): string {
    return optional('NEXT_PUBLIC_SITE_URL', 'https://vc-writer.com');
  },
} as const;

export const SITE_NAME = 'VC Writer';
