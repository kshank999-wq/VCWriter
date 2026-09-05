import type { SupabaseClient } from '@supabase/supabase-js';
import {
  decideActivation,
  deviceActivationSchema,
  explainRefusal,
  licenseSchema,
  type ActivationOutcome,
  type DeviceActivation,
  type License,
  type Platform,
} from '@vcwriter/domain';
import { adminClient } from './supabase';

/**
 * Activating and freeing device seats (spec §3.3).
 *
 * The decision itself lives in the domain and is tested there; this module is
 * the part that reads and writes rows. It takes its client as an argument so
 * the sequencing can be tested against a fake, for the same reason fulfillment
 * does: a license that will not activate is a customer who paid and cannot
 * work.
 */

export interface ActivateInput {
  userId: string;
  serial: string;
  deviceFingerprint: string;
  deviceName: string;
  platform: Platform;
  appVersion: string;
}

export interface ActivateResult {
  outcome: ActivationOutcome;
  message: string | null;
  license: { serial: string; maxActivations: number } | null;
}

const licenseRowToDomain = (row: Record<string, unknown>): License =>
  licenseSchema.parse({
    id: row['id'],
    userId: row['user_id'],
    orderId: row['order_id'],
    serial: row['serial'],
    status: row['status'],
    entitledPlatforms: row['entitled_platforms'],
    maxActivations: row['max_activations'],
    expiresAt: row['expires_at'],
    createdAt: row['created_at'],
    updatedAt: row['updated_at'],
  });

const activationRowToDomain = (row: Record<string, unknown>): DeviceActivation =>
  deviceActivationSchema.parse({
    id: row['id'],
    licenseId: row['license_id'],
    deviceFingerprint: row['device_fingerprint'],
    deviceName: row['device_name'],
    platform: row['platform'],
    appVersion: row['app_version'],
    activatedAt: row['activated_at'],
    lastSeenAt: row['last_seen_at'],
    deactivatedAt: row['deactivated_at'],
  });

export const activateDevice = async (
  input: ActivateInput,
  client: SupabaseClient = adminClient(),
): Promise<ActivateResult> => {
  // Scoped to the caller's own licenses: a serial is not a bearer token, so
  // knowing one is not enough to activate against someone else's account.
  const { data: licenseRow } = await client
    .from('licenses')
    .select('*')
    .eq('user_id', input.userId)
    .eq('serial', input.serial.trim().toUpperCase())
    .maybeSingle();

  if (!licenseRow) {
    return {
      outcome: { result: 'refused', reason: 'license_inactive' },
      message: 'That license is not on this account.',
      license: null,
    };
  }

  const license = licenseRowToDomain(licenseRow as Record<string, unknown>);

  const { data: activationRows } = await client
    .from('device_activations')
    .select('*')
    .eq('license_id', license.id);

  const activations = ((activationRows ?? []) as Record<string, unknown>[]).map(activationRowToDomain);
  const outcome = decideActivation({
    license,
    activations,
    deviceFingerprint: input.deviceFingerprint,
    platform: input.platform,
  });

  if (outcome.result === 'refused') {
    return { outcome, message: explainRefusal(outcome), license: null };
  }

  const nowIso = new Date().toISOString();
  // Unique on (license_id, device_fingerprint), so a device that already has a
  // record reclaims it rather than creating a second one.
  const { error } = await client.from('device_activations').upsert(
    {
      license_id: license.id,
      device_fingerprint: input.deviceFingerprint,
      device_name: input.deviceName,
      platform: input.platform,
      app_version: input.appVersion,
      activated_at: nowIso,
      last_seen_at: nowIso,
      deactivated_at: null,
    },
    { onConflict: 'license_id,device_fingerprint' },
  );

  if (error) {
    return {
      outcome: { result: 'refused', reason: 'license_inactive' },
      message: 'The activation could not be recorded. Try again in a moment.',
      license: null,
    };
  }

  return {
    outcome,
    message: null,
    license: { serial: license.serial, maxActivations: license.maxActivations },
  };
};

/**
 * Free a seat. This is the lost-device replacement flow §3.3 asks for: the
 * customer does it themselves, and the record is kept rather than deleted so
 * support can still see what happened.
 */
export const deactivateDevice = async (
  input: { userId: string; activationId: string },
  client: SupabaseClient = adminClient(),
): Promise<{ ok: boolean; error: string | null }> => {
  const { data: row } = await client
    .from('device_activations')
    .select('id, license_id')
    .eq('id', input.activationId)
    .maybeSingle();

  if (!row) return { ok: false, error: 'No such device.' };

  const { data: owned } = await client
    .from('licenses')
    .select('id')
    .eq('id', row.license_id)
    .eq('user_id', input.userId)
    .maybeSingle();

  if (!owned) return { ok: false, error: 'That device is not on a license you own.' };

  const { error } = await client
    .from('device_activations')
    .update({ deactivated_at: new Date().toISOString() })
    .eq('id', input.activationId);

  return error ? { ok: false, error: error.message } : { ok: true, error: null };
};

/** Devices on every license this account owns, for the account page. */
export const listDevices = async (
  userId: string,
  client: SupabaseClient = adminClient(),
): Promise<Array<{ activation: DeviceActivation; serial: string; maxActivations: number }>> => {
  const { data: licenseRows } = await client.from('licenses').select('*').eq('user_id', userId);
  const licenses = ((licenseRows ?? []) as Record<string, unknown>[]).map(licenseRowToDomain);
  if (licenses.length === 0) return [];

  const { data: activationRows } = await client
    .from('device_activations')
    .select('*')
    .in(
      'license_id',
      licenses.map((license) => license.id),
    );

  return ((activationRows ?? []) as Record<string, unknown>[])
    .map(activationRowToDomain)
    .map((activation) => {
      const license = licenses.find((candidate) => candidate.id === activation.licenseId);
      return license
        ? { activation, serial: license.serial, maxActivations: license.maxActivations }
        : null;
    })
    .filter((entry): entry is { activation: DeviceActivation; serial: string; maxActivations: number } =>
      entry !== null,
    );
};
