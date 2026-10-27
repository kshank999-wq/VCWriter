import * as Crypto from 'expo-crypto';

/**
 * A note's own id, made on the phone when it is written down (addendum 27 §19).
 *
 * **This line is why Save never worked.** It read `crypto?.randomUUID?.()`,
 * trusting the `?.` to cover a phone without `crypto` — but `?.` guards a
 * missing *property*, not a missing *global*, and Hermes has no `crypto` at
 * all. So naming it threw (*Property 'crypto' doesn't exist*), every note
 * failed before it reached the phone's own queue, and the screen, until build
 * 7, said nothing. Expo's crypto module is native and always there; the
 * fallback is for a runner without it, read through `globalThis` so that
 * naming it can never throw.
 */
export const newClientCaptureId = (): string => {
  try {
    return Crypto.randomUUID();
  } catch {
    const web = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
    return web?.randomUUID?.() ?? `capture-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
};
