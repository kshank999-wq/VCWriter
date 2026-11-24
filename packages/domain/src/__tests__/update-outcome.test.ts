import { describe, expect, it } from 'vitest';
import { mayInstallUnasked, UPDATE_IDLE_MS, updateFailureReason, updateOutcome } from '../release.js';

describe('the start after an update (addendum 48)', () => {
  it('went in when this copy is the version installed, or newer', () => {
    expect(updateOutcome('1.0.61', '1.0.61')).toBe('installed');
    expect(updateOutcome('1.0.61', '1.0.62')).toBe('installed');
  });
  it('did not go in when this copy is still older', () => {
    expect(updateOutcome('1.0.61', '1.0.60')).toBe('failed');
  });
  it('says nothing when no update was tried', () => {
    expect(updateOutcome(null, '1.0.60')).toBe('none');
  });
  it('reads why from the last FAILED line of the log', () => {
    const log = '10:00 Waiting\nFAILED: the disk image would not open\n10:01 more\nFAILED: the new copy could not be written\n';
    expect(updateFailureReason(log)).toBe('the new copy could not be written');
    expect(updateFailureReason('10:00 Installed; opening VC Writer\n')).toBeNull();
  });
});

describe('an update found by itself', () => {
  const quiet = { automatic: true, saved: true, busy: false, idleMs: UPDATE_IDLE_MS };
  it('installs unasked only when on, saved, silent and the writer is away', () => {
    expect(mayInstallUnasked(quiet)).toBe(true);
    expect(mayInstallUnasked({ ...quiet, automatic: false })).toBe(false);
    expect(mayInstallUnasked({ ...quiet, saved: false })).toBe(false);
    expect(mayInstallUnasked({ ...quiet, busy: true })).toBe(false);
    expect(mayInstallUnasked({ ...quiet, idleMs: 30_000 })).toBe(false);
  });
});
