import { describe, expect, it } from 'vitest';
import { checksumMatches, compareVersions, decideUpdate, isNewerVersion, type PublishedBuild } from '../release.js';
import {
  decideActivation,
  describeDevice,
  explainRefusal,
  summariseActivations,
} from '../activation.js';
import { deviceActivationSchema, licenseSchema, type DeviceActivation, type License } from '../entities/commerce.js';
import { newId, type DeviceActivationId, type LicenseId, type OrderId, type UserId } from '../ids.js';

const now = new Date().toISOString();

const build = (overrides: Partial<PublishedBuild> = {}): PublishedBuild => ({
  platform: 'windows',
  version: '1.0.0',
  minimumOsVersion: '',
  releaseNotes: '',
  publishedAt: now,
  sha256: 'a'.repeat(64),
  ...overrides,
});

describe('version comparison', () => {
  it('compares numerically, not as strings', () => {
    // The bug this guards: string comparison says "1.10.0" < "1.9.0", so an
    // updater built on it silently stops offering updates after 1.9.
    expect(isNewerVersion('1.10.0', '1.9.0')).toBe(true);
    expect(compareVersions('1.10.0', '1.9.0')).toBe(1);
    expect(compareVersions('2.0.0', '10.0.0')).toBe(-1);
  });

  it('treats missing parts as zero', () => {
    expect(compareVersions('1.2', '1.2.0')).toBe(0);
    expect(compareVersions('1.2.1', '1.2')).toBe(1);
  });

  it('sorts a pre-release before the version it leads to', () => {
    expect(compareVersions('1.2.0-beta.1', '1.2.0')).toBe(-1);
    expect(compareVersions('1.2.0', '1.2.0-beta.1')).toBe(1);
    expect(compareVersions('1.2.0-beta.1', '1.2.0-beta.2')).toBe(-1);
  });

  it('says an identical version is not newer', () => {
    expect(isNewerVersion('1.0.0', '1.0.0')).toBe(false);
    expect(isNewerVersion('0.9.0', '1.0.0')).toBe(false);
  });
});

describe('deciding whether to update', () => {
  it('offers a newer build for this platform', () => {
    const decision = decideUpdate({
      currentVersion: '1.0.0',
      platform: 'windows',
      builds: [build({ version: '1.1.0', releaseNotes: 'Faster startup' })],
    });

    expect(decision).toMatchObject({ action: 'update', version: '1.1.0', releaseNotes: 'Faster startup' });
  });

  it('ignores builds for the other platform', () => {
    const decision = decideUpdate({
      currentVersion: '1.0.0',
      platform: 'macos',
      builds: [build({ platform: 'windows', version: '2.0.0' })],
    });

    expect(decision).toEqual({ action: 'no_build' });
  });

  it('picks the newest when several are published', () => {
    const decision = decideUpdate({
      currentVersion: '1.0.0',
      platform: 'windows',
      builds: [build({ version: '1.1.0' }), build({ version: '1.10.0' }), build({ version: '1.2.0' })],
    });

    expect(decision).toMatchObject({ action: 'update', version: '1.10.0' });
  });

  it('says so plainly when the machine is already current', () => {
    expect(
      decideUpdate({ currentVersion: '1.1.0', platform: 'windows', builds: [build({ version: '1.1.0' })] }),
    ).toEqual({ action: 'up_to_date' });
  });

  it('refuses to offer a build this machine cannot install', () => {
    // Downloading 150MB to be told the OS is too old is worse than being told
    // up front.
    const decision = decideUpdate({
      currentVersion: '1.0.0',
      platform: 'macos',
      osVersion: '11.0',
      builds: [build({ platform: 'macos', version: '2.0.0', minimumOsVersion: '13.0' })],
    });

    expect(decision).toEqual({ action: 'unsupported_os', version: '2.0.0', requires: '13.0' });
  });

  it('offers the build when the machine meets the minimum', () => {
    const decision = decideUpdate({
      currentVersion: '1.0.0',
      platform: 'macos',
      osVersion: '14.2',
      builds: [build({ platform: 'macos', version: '2.0.0', minimumOsVersion: '13.0' })],
    });

    expect(decision).toMatchObject({ action: 'update' });
  });
});

describe('verifying a downloaded installer', () => {
  it('accepts a matching checksum whatever its case or prefix', () => {
    expect(checksumMatches('ABC123', 'abc123')).toBe(true);
    expect(checksumMatches('sha256:abc123', 'abc123')).toBe(true);
  });

  it('refuses a mismatch', () => {
    expect(checksumMatches('abc123', 'abc124')).toBe(false);
  });

  it('refuses when there is nothing to verify against', () => {
    // A build published without a checksum cannot be verified, and pretending
    // otherwise would make the check decorative.
    expect(checksumMatches('', 'abc123')).toBe(false);
    expect(checksumMatches('abc123', '')).toBe(false);
  });
});

// ---------------------------------------------------------------------------

const license = (overrides: Partial<License> = {}): License =>
  licenseSchema.parse({
    id: newId<LicenseId>(),
    userId: newId<UserId>(),
    orderId: newId<OrderId>(),
    serial: 'VCW-ABCDE-FGHJK-LMNPQ-RSTUV',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });

const activation = (licenseId: string, overrides: Partial<DeviceActivation> = {}): DeviceActivation =>
  deviceActivationSchema.parse({
    id: newId<DeviceActivationId>(),
    licenseId,
    deviceFingerprint: 'device-a',
    deviceName: '',
    platform: 'windows',
    activatedAt: now,
    ...overrides,
  });

describe('activating a device', () => {
  it('takes a free slot for a new device', () => {
    const key = license({ maxActivations: 2 });
    expect(
      decideActivation({ license: key, activations: [], deviceFingerprint: 'device-a', platform: 'windows' }),
    ).toEqual({ result: 'activated', reason: 'new_device' });
  });

  it('does not burn a second seat when the same device activates again', () => {
    // Reinstalling, or simply launching after a restart, must not cost a seat.
    const key = license({ maxActivations: 1 });
    const outcome = decideActivation({
      license: key,
      activations: [activation(key.id, { deviceFingerprint: 'device-a' })],
      deviceFingerprint: 'device-a',
      platform: 'windows',
    });

    expect(outcome).toEqual({ result: 'activated', reason: 'already_active' });
  });

  it('lets a device reclaim the seat it previously gave up', () => {
    const key = license({ maxActivations: 1 });
    const outcome = decideActivation({
      license: key,
      activations: [activation(key.id, { deviceFingerprint: 'device-a', deactivatedAt: now })],
      deviceFingerprint: 'device-a',
      platform: 'windows',
    });

    expect(outcome).toEqual({ result: 'activated', reason: 'reactivated' });
  });

  it('refuses a new device when every seat is taken, and says how to fix it', () => {
    const key = license({ maxActivations: 2 });
    const outcome = decideActivation({
      license: key,
      activations: [
        activation(key.id, { deviceFingerprint: 'device-a' }),
        activation(key.id, { deviceFingerprint: 'device-b' }),
      ],
      deviceFingerprint: 'device-c',
      platform: 'macos',
    });

    expect(outcome).toEqual({ result: 'refused', reason: 'no_slots', inUse: 2, limit: 2 });
    expect(explainRefusal(outcome)).toContain('Free a seat from My Account');
  });

  it('refuses a revoked license', () => {
    const outcome = decideActivation({
      license: license({ status: 'revoked' }),
      activations: [],
      deviceFingerprint: 'device-a',
      platform: 'windows',
    });

    expect(outcome).toEqual({ result: 'refused', reason: 'license_inactive' });
    expect(explainRefusal(outcome)).toContain('no longer active');
  });

  it('ignores activations belonging to another license', () => {
    const key = license({ maxActivations: 1 });
    const somebodyElse = newId<LicenseId>();
    const outcome = decideActivation({
      license: key,
      activations: [activation(somebodyElse, { deviceFingerprint: 'device-x' })],
      deviceFingerprint: 'device-a',
      platform: 'windows',
    });

    expect(outcome).toEqual({ result: 'activated', reason: 'new_device' });
  });
});

describe('what the customer sees about their devices', () => {
  it('separates seats in use from ones given up, and counts what is free', () => {
    const key = license({ maxActivations: 3 });
    const summary = summariseActivations(key, [
      activation(key.id, { deviceFingerprint: 'device-a' }),
      activation(key.id, { deviceFingerprint: 'device-b', deactivatedAt: now }),
    ]);

    expect(summary.inUse).toBe(1);
    expect(summary.slotsFree).toBe(2);
    expect(summary.past).toHaveLength(1);
  });

  it('names a device well enough to pick the right one to free', () => {
    const key = license();
    expect(describeDevice(activation(key.id, { deviceName: "Kevin's laptop" }))).toBe("Kevin's laptop (Windows)");
    expect(
      describeDevice(activation(key.id, { deviceFingerprint: 'abcdef123456', platform: 'macos' })),
    ).toBe('Unnamed Mac · …123456');
  });
});
