import { describe, expect, it } from 'vitest';
import { applyCorrection, readSpoken, sayBack } from '../capture-voice.js';

/**
 * Reading what the writer said (addendum 09, stage 4 — his §5 and §6).
 *
 * The browser hears; this decides what was meant. Every claim below is about
 * text, which is why it can be tested at all — the same reasoning that put the
 * writing rules and the colour in the domain rather than in a component.
 */

describe('a spoken category', () => {
  it('takes the one that was named and leaves the rest as the note', () => {
    const heard = readSpoken('Plot point, the audit lands the same week as the funeral.');
    expect(heard).toMatchObject({
      kind: 'category',
      category: 'plot_point',
      subjectName: null,
      text: 'the audit lands the same week as the funeral.',
    });
  });

  it('reads all five', () => {
    const said = ['Character x', 'Plot point x', 'Idea x', 'Theme x', 'Arc x'];
    expect(said.map((one) => (readSpoken(one) as { category: string }).category)).toEqual([
      'character',
      'plot_point',
      'idea',
      'theme',
      'arc',
    ]);
  });

  it('does not hear a command in the middle of a sentence', () => {
    // A writer saying what their idea is, is dictating rather than filing.
    const heard = readSpoken('The idea is that she never lets anyone else drive.');
    expect(heard.kind).toBe('none');
    expect(heard.text).toContain('never lets anyone');
  });

  it('matches a whole word, so arc is not architecture', () => {
    expect(readSpoken('Architecture of the building matters here.').kind).toBe('none');
    expect(readSpoken('Ideas about the ending').kind).toBe('none');
  });

  it('survives the punctuation a recogniser leaves behind', () => {
    expect(readSpoken('Theme. Everybody is paying somebody off.')).toMatchObject({
      category: 'theme',
      text: 'Everybody is paying somebody off.',
    });
  });
});

describe('a name, and only when there was a pause', () => {
  it('takes the name the writer paused after', () => {
    expect(readSpoken('Character Marisol, she never trusts him.')).toMatchObject({
      category: 'character',
      subjectName: 'Marisol',
      text: 'she never trusts him.',
    });
  });

  it('takes a name of several words', () => {
    expect(readSpoken('Character the ferryman, only speaks when he is owed.')).toMatchObject({
      subjectName: 'the ferryman',
    });
  });

  it('takes none at all when nobody paused', () => {
    // There is no way to tell a name from the start of a sentence without the
    // silence, so nothing is taken and the writer can see the whole thing.
    expect(readSpoken('Character she never lets anyone else drive.')).toMatchObject({
      subjectName: null,
      text: 'she never lets anyone else drive.',
    });
  });

  it('refuses a clause long enough to be a sentence', () => {
    expect(readSpoken('Arc she has to be offered the way out first, then she refuses.')).toMatchObject({
      subjectName: null,
    });
  });

  it('never takes a name for the three that are not about a person', () => {
    // "Idea, the audit lands the same week, as the funeral" has a pause in it
    // and nobody in it.
    for (const said of [
      'Idea the audit lands, as the funeral does.',
      'Theme the debt, and who pays it.',
      'Plot point the wreck, found at dawn.',
    ]) {
      expect(readSpoken(said).kind).toBe('category');
      expect((readSpoken(said) as { subjectName: string | null }).subjectName).toBeNull();
    }
  });

  it('takes a name for an arc note, which is about somebody too', () => {
    expect(readSpoken('Arc Marisol, she has to be offered the way out.')).toMatchObject({
      category: 'arc',
      subjectName: 'Marisol',
    });
  });
});

describe('correction', () => {
  it('is heard at the front of what was said', () => {
    expect(readSpoken('Correction, she never lets anyone else drive.')).toEqual({
      kind: 'correction',
      text: 'she never lets anyone else drive.',
    });
  });

  it('replaces the note and hands back what was there', () => {
    const after = applyCorrection('She never drives.', 'She never lets anyone else drive.');
    expect(after.text).toBe('She never lets anyone else drive.');
    // Putting it back is one press, because a correction that meant *add* would
    // otherwise have cost a sentence, silently, to somebody not looking.
    expect(after.previous).toBe('She never drives.');
  });

  it('outranks a category, so correcting a Character note does not refile it', () => {
    expect(readSpoken('Correction character actors are not the point.').kind).toBe('correction');
  });
});

describe('what the app says back', () => {
  it('leads with the two things a writer cannot see', () => {
    expect(
      sayBack({ category: 'character', subjectName: 'MARA', text: 'She never drives.' }),
    ).toBe('Character, MARA. She never drives.');
  });

  it('leaves the name out when there is none', () => {
    expect(sayBack({ category: 'theme', subjectName: null, text: 'Everybody owes.' })).toBe(
      'Theme. Everybody owes.',
    );
  });

  it('reads the note exactly as it stands, tidying nothing', () => {
    // A read-back that improved the words would be confirming something other
    // than what is about to be saved.
    const messy = 'she  never   drives , ever';
    expect(sayBack({ category: 'idea', subjectName: null, text: messy })).toContain(messy);
  });

  it('says something even with no words yet', () => {
    expect(sayBack({ category: null, subjectName: null, text: '' })).toBe('Note.');
  });
});
