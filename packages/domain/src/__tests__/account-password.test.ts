import { describe, expect, it } from 'vitest';
import {
  PASSWORD_STANDING_WORDS,
  describePasswordStanding,
  passwordStanding,
} from '../index.js';

/**
 * What the account says about a password (addendum 09 §14c).
 *
 * The trigger that writes the stamp is proved in the database, and the screen
 * is proved by driving it. What is proved here is the thing that would be
 * wrong in a way nobody notices: **the wording must not claim more than the
 * record holds.**
 */

describe('what the account knows', () => {
  it('reads a stamp as set and nothing as unrecorded', () => {
    expect(passwordStanding('2026-10-01T04:19:47.604Z')).toBe('set');
    expect(passwordStanding(null)).toBe('unrecorded');
    expect(passwordStanding(undefined)).toBe('unrecorded');
    expect(passwordStanding('')).toBe('unrecorded');
  });

  /**
   * The one rule in the module. The stamp began the day it shipped, so an
   * account that set a password before it has one and is not recorded — and a
   * page that told a writer they had no password while their password worked
   * is the failure that makes them distrust everything else on it.
   */
  it('never says there is no password, only that there is no record', () => {
    const said = describePasswordStanding('unrecorded');
    expect(said).toContain('it still works');
    // Not a verdict about the account: no sentence here denies a password.
    expect(said).not.toMatch(/you have no password|there is no password/i);
  });

  it('says where a password works, which is the point of having one', () => {
    const said = describePasswordStanding('set');
    expect(said).toContain('any device');
    expect(said).toContain('Writers Room');
  });

  /** One copy of each label, so no screen writes its own. */
  it('names both states', () => {
    expect(PASSWORD_STANDING_WORDS.set).toBe('Password set');
    expect(PASSWORD_STANDING_WORDS.unrecorded).toBe('No password set');
  });
});
