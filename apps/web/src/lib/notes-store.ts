import { createSign } from 'node:crypto';
import {
  appleState,
  notesSubscriptionSchema,
  planKindOf,
  playState,
  type NotesSubscription,
} from '@vcwriter/domain';

/**
 * Asking Apple and Google what somebody bought (addendum 27 §14.2).
 *
 * **The client sends an identifier and never a state.** What the phone posts is
 * the shop's own receipt identifier — Apple's original transaction id, Google's
 * purchase token — and this asks the shop. There is no field anywhere in the
 * request for a period end, an auto-renew flag or the word *active*, which is
 * the shape being the permission a fourth time (addendum 07 §12, addendum 16
 * §10, addendum 26 §14a): a client that decided it was entitled has nowhere to
 * say so.
 *
 * **Not configured is said, never assumed.** A deployment without the store
 * credentials cannot verify anything, and the honest answer is to refuse and say
 * why rather than to trust the phone because the server has no way to check —
 * which is the one failure mode that would turn a paid app into a free one.
 *
 * **No credential is in this repository.** Both shops' keys are environment
 * variables, read lazily and named here and nowhere else, exactly as
 * `eas.json`'s `submit` block is deliberately empty: the arrangement where *no
 * credential belongs in any repository* is enforced by the file rather than
 * remembered.
 */

export type StoreVerdict =
  | { ok: true; subscription: NotesSubscription }
  | { ok: false; reason: string; status: number };

const b64url = (value: string | Buffer): string =>
  Buffer.from(value as never)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

/** The middle segment of a JWS, decoded. */
const jwsPayload = (token: string): Record<string, unknown> | null => {
  const middle = token.split('.')[1];
  if (!middle) return null;
  try {
    return JSON.parse(Buffer.from(middle, 'base64').toString('utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const missing = (what: string): StoreVerdict => ({
  ok: false,
  status: 503,
  reason: `This deployment cannot check subscriptions with ${what} yet. Nothing is wrong with your purchase — write to support@vc-writer.com and it will be sorted out.`,
});

// ------------------------------------------------------------------ Apple

const APPLE_HOSTS = {
  production: 'https://api.storekit.itunes.apple.com',
  sandbox: 'https://api.storekit-sandbox.itunes.apple.com',
} as const;

const appleKeys = (): { issuerId: string; keyId: string; privateKey: string; bundleId: string } | null => {
  const issuerId = process.env['APPLE_IAP_ISSUER_ID'];
  const keyId = process.env['APPLE_IAP_KEY_ID'];
  // The .p8 file's contents. Pasted into a dashboard, newlines usually arrive
  // escaped, so both spellings are accepted rather than one of them failing at
  // signing time with an unhelpful error.
  const privateKey = process.env['APPLE_IAP_PRIVATE_KEY']?.replace(/\\n/g, '\n');
  if (!issuerId || !keyId || !privateKey) return null;
  return {
    issuerId,
    keyId,
    privateKey,
    bundleId: process.env['APPLE_IAP_BUNDLE_ID'] ?? 'com.vcwriter.notes',
  };
};

/**
 * A twenty-minute ES256 token for the App Store Server API.
 *
 * `ieee-p1363` is the whole of why this is signable with `node:crypto` alone:
 * OpenSSL's default ECDSA output is DER and a JWS signature is the raw r‖s pair.
 */
const appleToken = (keys: NonNullable<ReturnType<typeof appleKeys>>): string => {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'ES256', kid: keys.keyId, typ: 'JWT' }));
  const body = b64url(
    JSON.stringify({
      iss: keys.issuerId,
      iat: now,
      exp: now + 20 * 60,
      aud: 'appstoreconnect-v1',
      bid: keys.bundleId,
    }),
  );
  const signature = createSign('SHA256')
    .update(`${head}.${body}`)
    .sign({ key: keys.privateKey, dsaEncoding: 'ieee-p1363' });
  return `${head}.${body}.${b64url(signature)}`;
};

/**
 * What Apple says about one original transaction id.
 *
 * **Production is asked first and sandbox only on a 404**, which is Apple's own
 * advice and the only way one deployment serves both: a TestFlight build's
 * receipt does not exist in production, and a real customer's does not exist in
 * sandbox. Which one answered is recorded, because a test purchase is not a sale.
 */
export const askApple = async (originalTransactionId: string): Promise<StoreVerdict> => {
  const keys = appleKeys();
  if (!keys) return missing('the App Store');

  const token = appleToken(keys);

  for (const environment of ['production', 'sandbox'] as const) {
    const response = await fetch(
      `${APPLE_HOSTS[environment]}/inApps/v1/subscriptions/${encodeURIComponent(originalTransactionId)}`,
      { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' },
    ).catch(() => null);

    if (!response) {
      return { ok: false, status: 502, reason: 'The App Store could not be reached just now. Try again in a moment.' };
    }
    if (response.status === 404) continue;
    if (!response.ok) {
      return {
        ok: false,
        status: 502,
        reason: `The App Store refused the check (${response.status}). Try again in a moment.`,
      };
    }

    const payload = (await response.json().catch(() => null)) as
      | { data?: { lastTransactions?: { status?: number; signedTransactionInfo?: string; signedRenewalInfo?: string }[] }[] }
      | null;
    const last = payload?.data?.flatMap((group) => group.lastTransactions ?? []) ?? [];
    // The newest transaction in the group this id belongs to. A subscription
    // that has been upgraded has several, and the last one is what is in force.
    const current = last.at(-1);
    if (!current) {
      return { ok: false, status: 404, reason: 'The App Store has no subscription under that purchase.' };
    }

    const info = current.signedTransactionInfo ? jwsPayload(current.signedTransactionInfo) : null;
    const renewal = current.signedRenewalInfo ? jwsPayload(current.signedRenewalInfo) : null;
    const productId = typeof info?.['productId'] === 'string' ? (info['productId'] as string) : '';
    if (planKindOf(productId) === null) {
      // A receipt for something else is not a Notes subscription, whoever it
      // belongs to.
      return { ok: false, status: 400, reason: 'That purchase is not a Notes subscription.' };
    }

    const expires = typeof info?.['expiresDate'] === 'number' ? (info['expiresDate'] as number) : null;
    return {
      ok: true,
      subscription: notesSubscriptionSchema.parse({
        store: 'app_store',
        productId,
        storeTransactionId:
          typeof info?.['originalTransactionId'] === 'string'
            ? (info['originalTransactionId'] as string)
            : originalTransactionId,
        state: appleState(current.status ?? 0),
        periodEnd: expires === null ? null : new Date(expires).toISOString(),
        autoRenews: renewal?.['autoRenewStatus'] === 1,
        environment,
        lastVerifiedAt: new Date().toISOString(),
      }),
    };
  }

  return { ok: false, status: 404, reason: 'The App Store has no record of that purchase.' };
};

// ----------------------------------------------------------------- Google

const playAccount = (): { email: string; privateKey: string; packageName: string } | null => {
  const raw = process.env['GOOGLE_PLAY_SERVICE_ACCOUNT'];
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { client_email?: string; private_key?: string };
    if (!parsed.client_email || !parsed.private_key) return null;
    return {
      email: parsed.client_email,
      privateKey: parsed.private_key.replace(/\\n/g, '\n'),
      packageName: process.env['GOOGLE_PLAY_PACKAGE'] ?? 'com.vcwriter.notes',
    };
  } catch {
    return null;
  }
};

/** A service-account assertion traded for an access token, the ordinary way. */
const playToken = async (account: NonNullable<ReturnType<typeof playAccount>>): Promise<string | null> => {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = b64url(
    JSON.stringify({
      iss: account.email,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  );
  const signature = createSign('RSA-SHA256').update(`${head}.${body}`).sign(account.privateKey);
  const assertion = `${head}.${body}.${b64url(signature)}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
    cache: 'no-store',
  }).catch(() => null);
  if (!response?.ok) return null;
  const payload = (await response.json().catch(() => null)) as { access_token?: string } | null;
  return payload?.access_token ?? null;
};

/** What Google Play says about one purchase token. */
export const askPlay = async (purchaseToken: string): Promise<StoreVerdict> => {
  const account = playAccount();
  if (!account) return missing('Google Play');

  const token = await playToken(account);
  if (!token) {
    return { ok: false, status: 502, reason: 'Google Play could not be reached just now. Try again in a moment.' };
  }

  const response = await fetch(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(
      account.packageName,
    )}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`,
    { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' },
  ).catch(() => null);

  if (!response) {
    return { ok: false, status: 502, reason: 'Google Play could not be reached just now. Try again in a moment.' };
  }
  if (response.status === 404 || response.status === 410) {
    return { ok: false, status: 404, reason: 'Google Play has no record of that purchase.' };
  }
  if (!response.ok) {
    return { ok: false, status: 502, reason: `Google Play refused the check (${response.status}).` };
  }

  const payload = (await response.json().catch(() => null)) as
    | {
        subscriptionState?: string;
        lineItems?: { productId?: string; expiryTime?: string; autoRenewingPlan?: { autoRenewEnabled?: boolean } }[];
        testPurchase?: unknown;
      }
    | null;

  const line = payload?.lineItems?.at(-1);
  const productId = line?.productId ?? '';
  if (planKindOf(productId) === null) {
    return { ok: false, status: 400, reason: 'That purchase is not a Notes subscription.' };
  }

  return {
    ok: true,
    subscription: notesSubscriptionSchema.parse({
      store: 'play_store',
      productId,
      storeTransactionId: purchaseToken,
      state: playState(payload?.subscriptionState ?? ''),
      periodEnd: line?.expiryTime ?? null,
      autoRenews: line?.autoRenewingPlan?.autoRenewEnabled === true,
      // Play says so on the purchase itself rather than by answering on another
      // host, which is the same fact recorded the same way.
      environment: payload?.testPurchase === undefined ? 'production' : 'sandbox',
      lastVerifiedAt: new Date().toISOString(),
    }),
  };
};

/** One door for both shops, so a caller never holds a branch on which one it is. */
export const askStore = async (input: {
  store: 'app_store' | 'play_store';
  receiptId: string;
}): Promise<StoreVerdict> =>
  input.store === 'app_store' ? askApple(input.receiptId) : askPlay(input.receiptId);
