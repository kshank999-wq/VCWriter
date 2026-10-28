import { describe, expect, it } from 'vitest';
import { addOnAnswer } from '../index.js';

/** The answer to *would you like to add on to this note?* (addendum 27 §30). */
describe('adding on to a note', () => {
  it('hears yes and no however they are said', () => {
    for (const yes of ['Yes.', 'yeah', 'Sure!', 'Add to it', 'keep going']) expect(addOnAnswer(yes)).toBe('yes');
    for (const no of ['No.', "That's it", 'done', 'No thanks']) expect(addOnAnswer(no)).toBe('no');
  });

  it('takes anything else as the writer already adding', () => {
    expect(addOnAnswer('And then the bridge gave way.')).toBeNull();
  });
});
