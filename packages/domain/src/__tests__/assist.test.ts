import { describe, expect, it } from 'vitest';
import {
  ASSISTED_LABEL,
  READING_CAVEAT,
  assistRefusalText,
  assistedBy,
  canAskHere,
  canAssist,
  comparisonSchema,
  duplicatesSchema,
  originNow,
  wasAssisted,
} from '../index.js';

/**
 * The room's AI (addendum 07 §14, stage 12).
 *
 * Two claims are worth holding a test each, because they are the ones a later
 * change could quietly break:
 *
 * **It cannot rewrite anybody's work**, because there is nowhere in what it
 * returns to put a rewrite. That is a fact about the schema, so a schema that
 * grew a `suggestion` field would break this test — which is the point.
 *
 * **What it helps make is attributed to the person, never the machine.**
 */

const AT = '2026-09-12T00:00:00.000Z';

describe('who may ask for a reading', () => {
  it('is whoever may read all the contributions, not a role list', () => {
    // Tied to the right rather than to a name: the useful readings are *about*
    // several writers' work at once, so somebody who may not read the
    // contributions must not be able to get them summarised instead.
    expect(canAssist('owner')).toBe(true);
    expect(canAssist('editor')).toBe(true);
    expect(canAssist('writer')).toBe(false);
    expect(canAssist('viewer')).toBe(false);
    expect(canAssist(null)).toBe(false);
  });

  it('answers in the order the refusals actually matter', () => {
    const base = { role: 'owner' as const, roomEnabled: true, configured: true };
    expect(canAskHere(base)).toBe(true);

    // Not configured comes first: it is true of the whole deployment and has
    // nothing to do with this person or this room.
    expect(canAskHere({ ...base, configured: false, roomEnabled: false, role: 'viewer' })).toEqual({
      reason: 'unavailable',
    });
    // Then the room's own switch, which is the owner's (§14).
    expect(canAskHere({ ...base, roomEnabled: false, role: 'viewer' })).toEqual({ reason: 'room_off' });
    expect(canAskHere({ ...base, role: 'writer' })).toEqual({ reason: 'cannot_assist' });
  });

  it('says the room’s switch belongs to the showrunner', () => {
    expect(assistRefusalText({ reason: 'room_off' })).toContain('showrunner decides');
  });
});

describe('there is nowhere to put a rewrite', () => {
  it('has no field in a comparison that can carry replacement prose', () => {
    const parsed = comparisonSchema.parse({
      bothTrying: 'Getting Mara out of the warehouse.',
      points: [
        {
          about: 'the ending',
          inFirst: 'She says nothing.',
          inSecond: 'She explains.',
          favours: 'first',
          // A model that tried to hand back a draft has nowhere to put it, and
          // the schema drops it rather than passing it on.
          suggestion: 'INT. WAREHOUSE — NIGHT\nMara says nothing.',
        },
      ],
      onlyInFirst: [],
      onlyInSecond: ['The siren.'],
    });

    expect(Object.keys(parsed.points[0]!)).toEqual(['about', 'inFirst', 'inSecond', 'favours']);
    expect(JSON.stringify(parsed)).not.toContain('INT. WAREHOUSE');
  });

  it('has no field in a duplicate reading that can carry one either', () => {
    const parsed = duplicatesSchema.parse({
      groups: [
        {
          itemIds: ['a', 'b'],
          theSameIdea: 'The case was never the point.',
          butDifferent: 'One puts it in the cold open.',
          merged: 'Here is the combined version…',
        },
      ],
    });
    expect(Object.keys(parsed.groups[0]!)).toEqual(['itemIds', 'theSameIdea', 'butDifferent']);
  });

  it('groups by id rather than by quoting, so nothing is attributed wrongly', () => {
    expect(() => duplicatesSchema.parse({ groups: [{ itemIds: ['a'], theSameIdea: 'One thing' }] })).toThrow();
  });

  it('may favour one and never acts on it', () => {
    const parsed = comparisonSchema.parse({
      points: [{ about: 'the ending', inFirst: 'a', inSecond: 'b' }],
    });
    // `neither` is the default and a real answer, not a fallback for a model
    // that could not decide.
    expect(parsed.points[0]!.favours).toBe('neither');
  });

  it('says what a reading is worth, next to the answer', () => {
    expect(READING_CAVEAT).toContain('not a decision');
    expect(READING_CAVEAT).toContain('changes anybody’s draft');
  });
});

describe('what it helps make is the person’s', () => {
  it('attributes to whoever asked and labels how it was made', () => {
    const origin = assistedBy('jo', AT);
    expect(origin.authorId).toBe('jo');
    expect(origin.assisted).toBe(true);
    expect(wasAssisted(origin)).toBe(true);
    expect(ASSISTED_LABEL).toBe('AI-assisted');
  });

  it('never names a machine as the author', () => {
    const origin = assistedBy('jo', AT);
    expect(JSON.stringify(origin).toLowerCase()).not.toContain('ai');
    expect(JSON.stringify(origin).toLowerCase()).not.toContain('claude');
  });

  it('leaves ordinary writing unassisted, which is nearly all of it', () => {
    expect(originNow('jo', AT).assisted).toBe(false);
    expect(wasAssisted(originNow('jo', AT))).toBe(false);
    expect(wasAssisted(null)).toBe(false);
  });
});
