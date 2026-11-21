import { describe, expect, it } from 'vitest';
import { splitInlineAt } from '../index.js';

/** Return in the middle of a paragraph cuts it in two (from Ken, 21 November). */
describe('cutting a line at the caret', () => {
  it('splits plain words, the space at the cut going with it', () => {
    expect(splitInlineAt('about.  The writer balked at the idea.', 8)).toEqual({ before: 'about.', after: 'The writer balked at the idea.' });
  });

  it('keeps emphasis on both halves when the cut falls inside it', () => {
    expect(splitInlineAt('A **very bold claim** here', 9)).toEqual({ before: 'A **very**', after: '**bold claim** here' });
    expect(splitInlineAt('*one two*', 4)).toEqual({ before: '*one*', after: '*two*' });
  });

  it('never cuts a citation token, and leaves no empty marks', () => {
    expect(splitInlineAt('As shown [^ab12cd] later.', 13)).toEqual({ before: 'As shown [^ab12cd]', after: 'later.' });
    expect(splitInlineAt('**bold** rest', 2)).toEqual({ before: '', after: '**bold** rest' });
  });

  it('at the very end leaves an empty second half', () => {
    expect(splitInlineAt('Done.', 5)).toEqual({ before: 'Done.', after: '' });
  });
});
