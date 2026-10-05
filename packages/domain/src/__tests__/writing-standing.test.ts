import { describe, expect, it } from 'vitest';
import {
  deskStandingFrom,
  noteStanding,
  STANDING_GOOD_FOR_DAYS,
  WRITING_GRACE_DAYS,
  writingStanding,
  type DeskStanding,
} from '../index.js';
import type { License } from '../entities/commerce.js';

/**
 * Read-only on the desktop (addendum 32 §8, from Ken).
 *
 * Half of what is pinned here is that read-only **happens**, and the other
 * half — the longer half, deliberately — is every case where it must not: a
 * machine that has never asked, one that cannot ask, an account with no
 * licence, the week before it bites. A gate like this is only as good as the
 * list of people it does not catch.
 */

const NOW = new Date('2026-06-01T00:00:00.000Z');
const day = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

const claim = (over: Partial<Pick<License, 'status' | 'expiresAt'>> = {}) => ({
  status: 'active' as const,
  expiresAt: '2026-07-01T00:00:00.000Z',
  ...over,
});

const standing = (over: Partial<DeskStanding> = {}): DeskStanding => ({
  status: 'expired',
  expiresAt: '2026-05-01T00:00:00.000Z',
  checkedAt: NOW.toISOString(),
  seenLapsedAt: NOW.toISOString(),
  ...over,
});

describe('what the account claims', () => {
  it('has nothing to say about an account with no licence', () => {
    // Which is the state every copy that was never activated is in, and
    // read-only is a lapse rather than an absence.
    expect(deskStandingFrom([], NOW)).toBeNull();
  });

  it('is as live as the liveliest licence', () => {
    // Somebody who bought once and subscribes later holds two rows and is
    // plainly entitled; reading the first would refuse a paying customer.
    const answer = deskStandingFrom(
      [claim({ status: 'expired', expiresAt: '2026-01-01T00:00:00.000Z' }), claim()],
      NOW,
    );
    expect(answer).toEqual({ status: 'active', expiresAt: '2026-07-01T00:00:00.000Z' });
  });

  it('answers with the one that ended last where none is live', () => {
    const answer = deskStandingFrom(
      [
        claim({ status: 'expired', expiresAt: '2026-01-01T00:00:00.000Z' }),
        claim({ status: 'expired', expiresAt: '2026-05-20T00:00:00.000Z' }),
      ],
      NOW,
    );
    expect(answer?.expiresAt).toBe('2026-05-20T00:00:00.000Z');
  });
});

describe('writing down what the server said', () => {
  it('stamps the day the lapse was first seen', () => {
    const noted = noteStanding(null, claim({ status: 'expired' }), NOW);
    expect(noted.seenLapsedAt).toBe(NOW.toISOString());
  });

  it('carries that day forward rather than writing it again', () => {
    // Otherwise every check would start the week over and read-only would never
    // arrive at all.
    const first = noteStanding(null, claim({ status: 'expired' }), NOW);
    const later = noteStanding(first, claim({ status: 'expired' }), day(3));
    expect(later.seenLapsedAt).toBe(NOW.toISOString());
    expect(later.checkedAt).toBe(day(3).toISOString());
  });

  it('lets it go when the licence is live again', () => {
    // A writer who renews and lapses again next year gets the week again,
    // because that is a new lapse.
    const lapsed = noteStanding(null, claim({ status: 'expired' }), NOW);
    expect(noteStanding(lapsed, claim(), day(1)).seenLapsedAt).toBeNull();
  });
});

describe('whether this copy may be written in', () => {
  it('is writable, and says nothing, where nothing has been heard', () => {
    expect(writingStanding(null, NOW)).toEqual({ writable: true, notice: null, warning: false });
  });

  it('is writable, and says nothing, while the subscription is paid', () => {
    // Nothing: a bar counting down a bill nobody has cancelled is the program
    // nagging while somebody is working.
    const live = standing({
      status: 'active',
      expiresAt: '2026-07-01T00:00:00.000Z',
      seenLapsedAt: null,
    });
    expect(writingStanding(live, NOW)).toEqual({ writable: true, notice: null, warning: false });
  });

  it('warns for a week before it bites, and names the day', () => {
    const answer = writingStanding(standing(), day(1));
    expect(answer.writable).toBe(true);
    expect(answer.warning).toBe(true);
    expect(answer.notice).toContain('2026-06-08');
    expect(answer.notice).toContain('stays writable until');
  });

  it('refuses once the week is up, and explains', () => {
    const answer = writingStanding(standing(), day(WRITING_GRACE_DAYS + 1));
    expect(answer.writable).toBe(false);
    expect(answer.warning).toBe(false);
    expect(answer.notice).toContain('read-only');
    // And the promise under it is the one the subscription makes: the work is
    // still theirs to open, print and export.
    expect(answer.notice).toContain('printing and exporting');
  });

  it('says the day it ended', () => {
    expect(writingStanding(standing(), day(3)).notice).toContain('ended on 2026-05-01');
  });

  it('gives back the writing where the answer is too old to act on', () => {
    // Being unable to ask is not a lapse. A writer whose network is blocked, or
    // who renewed on their phone and cannot get the news to this machine, must
    // not be locked out of their own book.
    const answer = writingStanding(standing(), day(STANDING_GOOD_FOR_DAYS + 1));
    expect(answer.writable).toBe(true);
    expect(answer.warning).toBe(true);
    // And it does not mention read-only, which this copy is no longer entitled
    // to claim.
    expect(answer.notice).not.toContain('read-only');
    expect(answer.notice).toContain('Renew');
  });

  it('refuses a licence whose status says so even with no date', () => {
    const revoked = standing({ status: 'revoked', expiresAt: null });
    const answer = writingStanding(revoked, day(WRITING_GRACE_DAYS + 1));
    expect(answer.writable).toBe(false);
    // Not *your subscription ended*, which would send somebody to a renewal
    // page that cannot help them.
    expect(answer.notice).toContain('no longer active');
  });

  it('treats a lost cancellation as the lapse the date already shows', () => {
    // The status still says active because the webhook never arrived; the paid
    // period has plainly run out, and the date is the better answer.
    const stale = standing({ status: 'active', expiresAt: '2026-05-01T00:00:00.000Z' });
    const answer = writingStanding(stale, day(WRITING_GRACE_DAYS + 1));
    expect(answer.writable).toBe(false);
    expect(answer.notice).toContain('ended on 2026-05-01');
  });

  it('never lapses a licence with no expiry', () => {
    // Every row written before the subscription was.
    const perpetual = standing({ status: 'active', expiresAt: null, seenLapsedAt: null });
    expect(writingStanding(perpetual, day(4000))).toEqual({
      writable: true,
      notice: null,
      warning: false,
    });
  });
});
