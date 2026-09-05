import { isActivationSlotAvailable } from './entities/commerce.js';
import type { DeviceActivation, License } from './entities/commerce.js';
import type { Platform } from './entities/common.js';

/**
 * License activation and device management (spec §3.3).
 *
 * The requirement that shapes this file: "Define activation/deactivation and
 * lost-device replacement flows so support does not require manual database
 * edits." Everything a customer might need — seeing their devices, freeing a
 * seat from a laptop they no longer have, re-activating after a reinstall —
 * has to be reachable by the customer themselves.
 *
 * A deactivated activation is kept, not deleted. Support can then answer "what
 * happened on this license" from the record instead of guessing.
 */

export type ActivationOutcome =
  | { result: 'activated'; reason: 'new_device' }
  | { result: 'activated'; reason: 'already_active' }
  | { result: 'activated'; reason: 'reactivated' }
  | { result: 'refused'; reason: 'license_inactive' }
  | { result: 'refused'; reason: 'no_slots'; inUse: number; limit: number };

export interface ActivationRequest {
  license: License;
  activations: readonly DeviceActivation[];
  deviceFingerprint: string;
  platform: Platform;
}

/**
 * Decide what activating this device on this license should do.
 *
 * Three of the four "yes" answers matter for behaviour: a device that is
 * already active is a no-op (reinstalling must not burn a second seat), a
 * device that was previously deactivated reclaims its own record rather than
 * creating a duplicate, and a genuinely new device takes a free slot.
 */
export const decideActivation = (request: ActivationRequest): ActivationOutcome => {
  if (request.license.status !== 'active') {
    return { result: 'refused', reason: 'license_inactive' };
  }

  const own = request.activations.filter((activation) => activation.licenseId === request.license.id);
  const existing = own.find((activation) => activation.deviceFingerprint === request.deviceFingerprint);

  if (existing && existing.deactivatedAt === null) {
    return { result: 'activated', reason: 'already_active' };
  }

  const active = own.filter((activation) => activation.deactivatedAt === null);
  if (existing) {
    // Reclaiming a seat this device already held: allowed as long as the
    // license has room now, which it does unless someone else took the seat.
    return isActivationSlotAvailable(request.license, active)
      ? { result: 'activated', reason: 'reactivated' }
      : { result: 'refused', reason: 'no_slots', inUse: active.length, limit: request.license.maxActivations };
  }

  return isActivationSlotAvailable(request.license, active)
    ? { result: 'activated', reason: 'new_device' }
    : { result: 'refused', reason: 'no_slots', inUse: active.length, limit: request.license.maxActivations };
};

export interface ActivationSummary {
  active: DeviceActivation[];
  past: DeviceActivation[];
  inUse: number;
  limit: number;
  slotsFree: number;
}

/** What the account page shows: what is using a seat, and what used to. */
export const summariseActivations = (
  license: License,
  activations: readonly DeviceActivation[],
): ActivationSummary => {
  const own = activations.filter((activation) => activation.licenseId === license.id);
  const active = own.filter((activation) => activation.deactivatedAt === null);
  const past = own.filter((activation) => activation.deactivatedAt !== null);

  return {
    active,
    past,
    inUse: active.length,
    limit: license.maxActivations,
    slotsFree: Math.max(0, license.maxActivations - active.length),
  };
};

/**
 * A readable name for a device the customer has to recognise in a list, since
 * freeing the right seat depends on telling one laptop from another.
 */
export const describeDevice = (activation: DeviceActivation): string => {
  const name = activation.deviceName.trim();
  const platform = activation.platform === 'windows' ? 'Windows' : 'Mac';
  if (name.length > 0) return `${name} (${platform})`;
  // Fingerprints are opaque; a short tail is enough to distinguish two
  // otherwise-identical entries without pretending to be meaningful.
  return `Unnamed ${platform} · …${activation.deviceFingerprint.slice(-6)}`;
};

/** Human-readable reason for a refusal, suitable for showing to a customer. */
export const explainRefusal = (outcome: ActivationOutcome): string | null => {
  if (outcome.result !== 'refused') return null;
  if (outcome.reason === 'license_inactive') {
    return 'This license is no longer active. If that is unexpected, check your purchases.';
  }
  return `This license is on ${outcome.inUse} of ${outcome.limit} devices. Free a seat from My Account and try again.`;
};
