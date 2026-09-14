import { describe, expect, it } from 'vitest';
import {
  CAP_MOST,
  aiUsageSchema,
  assistRefusalText,
  canAskHere,
  capIsSane,
  capStanding,
  costOf,
  describeSpend,
  money,
  monthStart,
  spentSince,
  type AiUsage,
  type TokenRate,
} from '../index.js';

/**
 * The room's AI spending cap (addendum 07 §14, stage 13).
 *
 * Stage 12 named three things a cap needed before it could be honest —
 * metering, a decision about what happens at the limit, and somewhere to show
 * the total — and these hold all three, plus the admission that makes the whole
 * thing truthful: **a cap stops the next reading, never the one in flight**,
 * because what a reading costs is known only once it has answered.
 */

const RATE: TokenRate = { inputCentsPerMillion: 500, outputCentsPerMillion: 2500 };

const usage = (over: Partial<AiUsage> = {}): AiUsage =>
  aiUsageSchema.parse({
    id: crypto.randomUUID(),
    roomId: 'room',
    userId: 'writer',
    reading: 'compare',
    inputTokens: 0,
    outputTokens: 0,
    costCents: 0,
    at: '2026-09-14T10:00:00.000Z',
    ...over,
  });

describe('what a reading cost', () => {
  it('prices input and output separately, because they are priced separately', () => {
    expect(costOf({ inputTokens: 1_000_000, outputTokens: 0 }, RATE)).toBe(500);
    expect(costOf({ inputTokens: 0, outputTokens: 1_000_000 }, RATE)).toBe(2500);
  });

  it('never reads nothing for a reading that happened', () => {
    // A meter showing zero after a hundred small questions is wrong in the
    // direction nobody notices.
    expect(costOf({ inputTokens: 10, outputTokens: 1 }, RATE)).toBe(1);
  });

  it('reads nothing only when nothing was asked', () => {
    expect(costOf({ inputTokens: 0, outputTokens: 0 }, RATE)).toBe(0);
  });

  it('rounds up rather than down, so the room is never told it spent less', () => {
    expect(costOf({ inputTokens: 3001, outputTokens: 0 }, RATE)).toBe(2);
  });
});

describe('the month', () => {
  it('starts at the first of the month in UTC', () => {
    expect(monthStart('2026-09-14T10:00:00.000Z')).toBe('2026-09-01T00:00:00.000Z');
  });

  it('does not move with whoever is looking', () => {
    // Two people in one room must not see different totals, which is the whole
    // reason this is UTC rather than the reader's zone.
    expect(monthStart('2026-09-01T00:30:00.000Z')).toBe(monthStart('2026-09-30T23:30:00.000Z'));
  });

  it('counts what was spent inside it and nothing before', () => {
    const usages = [
      usage({ costCents: 40, at: '2026-08-31T23:59:59.000Z' }),
      usage({ costCents: 60, at: '2026-09-02T09:00:00.000Z' }),
      usage({ costCents: 25, at: '2026-09-14T09:00:00.000Z' }),
    ];

    expect(spentSince(usages, monthStart('2026-09-14T10:00:00.000Z'))).toBe(85);
  });
});

describe('where the room stands', () => {
  it('says nothing is left to say when there is no cap', () => {
    const standing = capStanding({ spentCents: 900, capCents: null });
    expect(standing.reached).toBe(false);
    expect(standing.leftCents).toBeNull();
    expect(standing.through).toBeNull();
  });

  it('counts what is left', () => {
    expect(capStanding({ spentCents: 1200, capCents: 5000 }).leftCents).toBe(3800);
  });

  it('is reached *at* the cap rather than past it', () => {
    // A cap of ten dollars that allows the eleventh because the comparison was
    // strict is a cap nobody can explain.
    expect(capStanding({ spentCents: 5000, capCents: 5000 }).reached).toBe(true);
    expect(capStanding({ spentCents: 4999, capCents: 5000 }).reached).toBe(false);
  });

  it('never says there is less than nothing left', () => {
    expect(capStanding({ spentCents: 6000, capCents: 5000 }).leftCents).toBe(0);
  });

  it('holds a cap of nothing, which means no readings until next month', () => {
    const standing = capStanding({ spentCents: 0, capCents: 0 });
    expect(standing.reached).toBe(true);
    expect(standing.through).toBe(1);
  });
});

describe('what the dashboard says', () => {
  it('names the overshoot rather than hiding it behind the cap', () => {
    // $52 of $50 read back as "$50 of $50" would make the one honest thing
    // about a cap look like a bug.
    const line = describeSpend(capStanding({ spentCents: 5200, capCents: 5000 }));
    expect(line).toContain('$52');
    expect(line).toContain('took it over');
  });

  it('says so plainly when a room has no cap', () => {
    expect(describeSpend(capStanding({ spentCents: 0, capCents: null }))).toBe(
      'Nothing spent on readings this month.',
    );
    expect(describeSpend(capStanding({ spentCents: 130, capCents: null }))).toContain('No cap set');
  });

  it('writes whole money without trailing zeros and parts with them', () => {
    expect(money(5000)).toBe('$50');
    expect(money(5250)).toBe('$52.50');
  });
});

describe('what a cap may be', () => {
  it('allows none, nothing, and anything up to the ceiling', () => {
    expect(capIsSane(null)).toBe(true);
    expect(capIsSane(0)).toBe(true);
    expect(capIsSane(CAP_MOST)).toBe(true);
  });

  it('refuses a negative cap, fractions of a cent, and the absurd', () => {
    expect(capIsSane(-1)).toBe(false);
    expect(capIsSane(10.5)).toBe(false);
    expect(capIsSane(CAP_MOST + 1)).toBe(false);
  });
});

describe('the gate in front of a reading', () => {
  const gate = (over: Parameters<typeof canAskHere>[0]) => canAskHere(over);

  it('lets an editor through under the cap', () => {
    expect(
      gate({ role: 'editor', roomEnabled: true, configured: true, spentCents: 100, capCents: 5000 }),
    ).toBe(true);
  });

  it('refuses once the cap is reached, and says the number', () => {
    const refusal = gate({
      role: 'editor',
      roomEnabled: true,
      configured: true,
      spentCents: 5000,
      capCents: 5000,
    });
    expect(refusal).not.toBe(true);
    if (refusal === true) throw new Error('unreachable');

    expect(refusal.reason).toBe('capped');
    // *You have reached your limit* with no number is a refusal nobody can act
    // on: the showrunner can raise it or wait, and needs to know which.
    expect(assistRefusalText(refusal)).toContain('$50');
  });

  it('leaves a room with no cap alone whatever it has spent', () => {
    expect(
      gate({ role: 'owner', roomEnabled: true, configured: true, spentCents: 999_999, capCents: null }),
    ).toBe(true);
  });

  it('checks the cheaper gates first', () => {
    // The room's switch is a field already loaded; the spend is a query. A
    // room with AI off should never be counted.
    const refusal = gate({
      role: 'editor',
      roomEnabled: false,
      configured: true,
      spentCents: 9000,
      capCents: 5000,
    });
    expect(refusal).not.toBe(true);
    if (refusal === true) throw new Error('unreachable');
    expect(refusal.reason).toBe('room_off');
  });

  it('still refuses a writer, who may not read everybody else to begin with', () => {
    const refusal = gate({ role: 'writer', roomEnabled: true, configured: true });
    expect(refusal).not.toBe(true);
    if (refusal === true) throw new Error('unreachable');
    expect(refusal.reason).toBe('cannot_assist');
  });

  it('treats an uncounted spend as nothing rather than as a refusal', () => {
    // A caller that has not counted is asking a different question — *may this
    // person ask at all* — and must not be told the room is broke.
    expect(gate({ role: 'owner', roomEnabled: true, configured: true, capCents: 5000 })).toBe(true);
  });
});
