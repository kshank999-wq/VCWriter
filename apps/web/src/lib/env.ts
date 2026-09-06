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

const DEFAULT_SITE_URL = 'https://vc-writer.com';

/**
 * The site's own origin, as an absolute URL with no trailing slash.
 *
 * Deliberately forgiving, unlike everything else here. This value is read at
 * module scope by the root layout (`metadataBase`), so a malformed one throws
 * during `next build` while collecting page data and takes the whole
 * deployment down — for a field whose only job is to resolve relative Open
 * Graph URLs. A typo in a dashboard must not be able to do that.
 *
 * Anything that is not an absolute http(s) URL is refused rather than repaired:
 * prefixing a scheme would turn the paste-the-name-instead-of-the-value mistake
 * (`NEXT_PUBLIC_SITE_URL=NEXT_PUBLIC_SITE_URL`) into a URL that parses, and a
 * site that quietly links to the wrong host is worse than one that warns and
 * uses production.
 */
const siteUrl = (): string => {
  const raw = process.env['NEXT_PUBLIC_SITE_URL']?.trim();
  if (!raw || raw.length === 0) return DEFAULT_SITE_URL;

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    console.warn(
      `NEXT_PUBLIC_SITE_URL is not a URL (${JSON.stringify(raw)}). ` +
        `Include the scheme, e.g. https://vc-writer.com. Falling back to ${DEFAULT_SITE_URL}.`,
    );
    return DEFAULT_SITE_URL;
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    console.warn(
      `NEXT_PUBLIC_SITE_URL must be http or https, not ${parsed.protocol} ` +
        `(${JSON.stringify(raw)}). Falling back to ${DEFAULT_SITE_URL}.`,
    );
    return DEFAULT_SITE_URL;
  }

  // Callers append paths as `${env.siteUrl}/account`, so a trailing slash would
  // produce a doubled one in Stripe redirects and in every emailed link.
  return parsed.href.replace(/\/+$/, '');
};

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
    return siteUrl();
  },
} as const;

export const SITE_NAME = 'VC Writer';
