import { describe, expect, it } from 'vitest';
import { sceneVerdictSchema } from '@/lib/ai';

/**
 * The shape a structural read has to come back in (addendum 04 §8 stage 4).
 *
 * The model is asked for the five commandments alongside what it already
 * answered, and this schema is the thing that decides whether it did. A read
 * that came back without them would reach the writer as four wrong blanks, so
 * it is refused here instead and read as "an unreadable shape".
 */

const full = {
  opening: 'She is afraid of the climb.',
  change: 'She climbs it anyway.',
  turn: 'The moment she lets go of the rail.',
  valueShift: 'positive',
  purpose: 'It buys the ending its credibility.',
  concerns: [],
  inciting: 'The lamp goes out.',
  crisis: 'Climb blind, or leave the boats to it.',
  climax: 'She climbs.',
  resolution: null,
};

describe('what a read has to answer', () => {
  it('takes the five commandments alongside the rest', () => {
    const parsed = sceneVerdictSchema.parse(full);
    expect(parsed.inciting).toBe('The lamp goes out.');
    expect(parsed.crisis).toBe('Climb blind, or leave the boats to it.');
    expect(parsed.climax).toBe('She climbs.');
    // Null is an answer: this scene does not settle.
    expect(parsed.resolution).toBeNull();
  });

  it('lets a scene have none of them, because most scenes do not have all five', () => {
    const parsed = sceneVerdictSchema.parse({
      ...full,
      turn: null,
      inciting: null,
      crisis: null,
      climax: null,
      resolution: null,
    });
    expect(parsed.turn).toBeNull();
    expect(parsed.inciting).toBeNull();
  });

  it('refuses a read that simply left them out', () => {
    for (const missing of ['inciting', 'crisis', 'climax', 'resolution'] as const) {
      const partial = { ...full } as Record<string, unknown>;
      delete partial[missing];
      expect(sceneVerdictSchema.safeParse(partial).success).toBe(false);
    }
  });

  it('still refuses what it always refused', () => {
    expect(sceneVerdictSchema.safeParse({ ...full, valueShift: 'sideways' }).success).toBe(false);
    expect(sceneVerdictSchema.safeParse({ ...full, concerns: 'one thing' }).success).toBe(false);
  });

  it('has no field that could carry replacement prose', () => {
    // §8.2: the writer asked for a read, not a draft. Nothing here is a scene.
    expect(Object.keys(sceneVerdictSchema.shape).sort()).toEqual(
      [
        'change',
        'climax',
        'concerns',
        'crisis',
        'inciting',
        'opening',
        'purpose',
        'resolution',
        'turn',
        'valueShift',
      ].sort(),
    );
  });
});
