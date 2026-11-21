import { describe, expect, it } from 'vitest';
import { AUTOCORRECT_SLIPS, autocorrectAt, autocorrectWord } from '../index.js';

/** AutoCorrect (from Ken, 21 November): common slips put right as a word is finished. */
describe('AutoCorrect', () => {
  it('puts common slips right, keeping the writer’s capitals', () => {
    expect(autocorrectWord('teh')).toBe('the');
    expect(autocorrectWord('Teh')).toBe('The');
    expect(autocorrectWord('TEH')).toBe('THE');
    expect(autocorrectWord('dont')).toBe("don't");
    expect(autocorrectWord('i')).toBe('I');
    expect(autocorrectWord('recieved')).toBe('received');
    expect(autocorrectWord('house')).toBeNull();
  });

  it('acts when the word is finished, and not before', () => {
    expect(autocorrectAt('I dont', 6)).toBeNull();
    expect(autocorrectAt('I dont ', 7)).toMatchObject({ text: "I don't ", caret: 8 });
    expect(autocorrectAt('teh,', 4)).toMatchObject({ text: 'the,' });
    expect(autocorrectAt('so i went', 5)).toMatchObject({ text: 'so I went' });
  });

  it('leaves i.e., words inside other words, and real words alone', () => {
    expect(autocorrectAt('see i.', 6)).toBeNull();
    expect(autocorrectAt("o'teh ", 6)).toBeNull();
    for (const real of ['wether', 'therefor', 'underate', 'wont', 'cant', 'its', 'well', 'hell', 'were', 'shell']) {
      expect(AUTOCORRECT_SLIPS.has(real)).toBe(false);
    }
  });
});
