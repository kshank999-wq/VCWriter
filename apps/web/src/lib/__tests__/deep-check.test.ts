import { describe, expect, it } from 'vitest';
import { costOf, guardFindings, type RawDeepFinding } from '../deep-check';

const lines = [
  { id: 'a', text: 'She sat at the window watching the evening invade the avenue.' },
  { id: 'b', text: 'One was to Harry; the other was to her father. He would read it in the morning and be angry.' },
];
const finding = (over: Partial<RawDeepFinding>): RawDeepFinding => ({
  line: 'L2',
  quote: 'He would read it',
  check: 'pronoun',
  severity: 'concern',
  confidence: 'high',
  message: '“He” could be Harry or her father.',
  why: 'Both men are named in the sentence before.',
  ...over,
});

describe('the deep check rewrite guard', () => {
  it('keeps a finding whose words are on its line, placed where they are', () => {
    const { findings, dropped } = guardFindings([finding({})], lines);
    expect(dropped).toEqual([]);
    expect(findings[0]).toMatchObject({ elementId: 'b', start: 47, end: 63, check: 'pronoun' });
  });

  it('drops a finding on a line that does not exist, or quoting words not on it', () => {
    const { findings, dropped } = guardFindings([finding({ line: 'L9' }), finding({ line: 'L1' }), finding({ quote: 'He will read it' })], lines);
    expect(findings).toEqual([]);
    expect(dropped.map((one) => one.reason)).toEqual(['no-line', 'not-in-line', 'not-in-line']);
  });

  it('drops any finding that offers new wording', () => {
    const { findings, dropped } = guardFindings(
      [
        finding({ why: 'Consider writing “Her father would read it in the morning”.' }),
        finding({ message: 'This could read more clearly.' }),
        finding({ why: 'Name the man, as in “Harry would be furious when he saw it”.' }),
        finding({ why: 'The words “one was to Harry” come just before.' }),
      ],
      lines,
    );
    expect(dropped.map((one) => one.reason)).toEqual(['rewrite', 'rewrite', 'rewrite']);
    expect(findings).toHaveLength(1);
  });

  it('prices thinking and answer as output', () => {
    expect(costOf({ inputTokens: 1_000_000, outputTokens: 100_000, cacheReadTokens: 0, cacheWriteTokens: 0 })).toBeCloseTo(6);
  });
});
