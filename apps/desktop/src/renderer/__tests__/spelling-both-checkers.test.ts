// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { checkWord, ignoreWord } from '../spelling';

/**
 * The right-click menu offers a replacement for any word the red line marks
 * (from Ken: *the spell checker catches misspellings but does not give you the
 * standard right click menu to change out the word*): the operating system's
 * checker draws the line in the desktop app, so the menu asks it too.
 */
const fake = (marks: Record<string, string[]>) => {
  (window as unknown as { vcwriter: unknown }).vcwriter = {
    spelling: {
      check: (word: string) => (word in marks ? { misspelled: true, suggestions: marks[word]! } : { misspelled: false, suggestions: [] }),
      addWord: async () => true,
    },
  };
};

afterEach(() => {
  delete (window as unknown as { vcwriter?: unknown }).vcwriter;
});

describe('spelling in the menu', () => {
  it('still offers the bundled suggestions in a browser', () => {
    const checked = checkWord('recieve');
    expect(checked.misspelled).toBe(true);
    expect(checked.suggestions).toContain('receive');
  });

  it('offers a replacement for a word only the system checker marks, its suggestions first', () => {
    fake({ colour: ['color', 'colon'] });
    const checked = checkWord('colour');
    expect(checked.misspelled).toBe(true);
    expect(checked.suggestions[0]).toBe('color');
  });

  it('merges both lists without repeats', () => {
    fake({ recieve: ['receive', 'relive'] });
    const checked = checkWord('recieve');
    expect(checked.suggestions.filter((one) => one === 'receive')).toHaveLength(1);
    expect(checked.suggestions).toContain('relive');
  });

  it('stops marking a word once it is ignored, for both checkers', () => {
    fake({ grimdark: ['grim dark'] });
    expect(checkWord('grimdark').misspelled).toBe(true);
    ignoreWord('grimdark');
    expect(checkWord('grimdark').misspelled).toBe(false);
  });
});
