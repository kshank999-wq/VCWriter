import { createHmac } from 'node:crypto';
import { NextResponse } from 'next/server';
import { adminClient } from './supabase';

/**
 * Per-address rate limiting for the routes anyone can call.
 *
 * What it is for: noise and cost. A burst of telemetry from one address, a
 * script creating checkout sessions, an activation loop. What it is not for:
 * access control — entitlement is checked in every route regardless, and
 * nothing here grants or denies anything but a turn.
 *
 * That is why it fails open. If the database call errors, the request goes
 * through and a warning is logged. A limiter that could take purchases down
 * when it broke would be a worse risk than the one it guards against.
 *
 * Addresses are stored as a keyed hash, never raw, and rows live for two
 * windows at most. That is pseudonymisation, not anonymisation: with the salt
 * a row can be matched to an address again. It is enough for a table whose
 * contents are gone within the hour.
 */

export interface RateLimitRule {
  /** Names the route in the key so rules never share an allowance. */
  name: string;
  limit: number;
  windowSeconds: number;
}

export interface RateLimitVerdict {
  allowed: boolean;
  retryAfterSeconds: number;
}

export type Consume = (key: string, rule: RateLimitRule) => Promise<RateLimitVerdict>;

export const RULES = {
  /** Crash reports: generous, because a real crash loop is exactly the case worth hearing about — once. */
  telemetry: { name: 'telemetry', limit: 60, windowSeconds: 3600 },
  /** Checkout sessions cost nothing to create, and nobody buys ten times in ten minutes. */
  checkout: { name: 'checkout', limit: 10, windowSeconds: 600 },
  /** Activation is account-scoped already; this stops a loop hammering auth. */
  activate: { name: 'activate', limit: 30, windowSeconds: 3600 },
} as const satisfies Record<string, RateLimitRule>;

/** The first hop in X-Forwarded-For is the client; Vercel sets it. */
export const clientAddress = (request: Request): string => {
  const forwarded = request.headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  return first || request.headers.get('x-real-ip')?.trim() || 'unknown';
};

export const rateLimitKey = (rule: RateLimitRule, request: Request): string => {
  const salt = process.env['RATE_LIMIT_SALT'] ?? 'vcwriter-rate-limit';
  const digest = createHmac('sha256', salt).update(clientAddress(request)).digest('hex').slice(0, 32);
  return `${rule.name}:${digest}`;
};

const consumeInDatabase: Consume = async (key, rule) => {
  const { data, error } = await adminClient().rpc('consume_rate_limit', {
    p_key: key,
    p_limit: rule.limit,
    p_window_seconds: rule.windowSeconds,
  });

  const row = (Array.isArray(data) ? data[0] : data) as
    | { allowed: boolean; retry_after_seconds: number }
    | null
    | undefined;

  if (error || !row) {
    console.warn(`rate limit unavailable for ${rule.name}; allowing the request`, error?.message ?? '');
    return { allowed: true, retryAfterSeconds: 0 };
  }

  return { allowed: row.allowed === true, retryAfterSeconds: Number(row.retry_after_seconds) || 0 };
};

/**
 * Returns a 429 response to send, or null when the request may proceed.
 *
 *   const limited = await rateLimit(request, RULES.checkout);
 *   if (limited) return limited;
 */
export const rateLimit = async (
  request: Request,
  rule: RateLimitRule,
  consume: Consume = consumeInDatabase,
): Promise<Response | null> => {
  let verdict: RateLimitVerdict;
  try {
    verdict = await consume(rateLimitKey(rule, request), rule);
  } catch (cause) {
    console.warn(`rate limit threw for ${rule.name}; allowing the request`, cause);
    return null;
  }

  if (verdict.allowed) return null;

  const retryAfter = Math.max(1, Math.ceil(verdict.retryAfterSeconds));
  return NextResponse.json(
    { error: 'Too many requests from this address. Try again shortly.' },
    { status: 429, headers: { 'retry-after': String(retryAfter) } },
  );
};
