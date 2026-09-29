import { describe, expect, it } from 'vitest';
import {
  captureVocabulary,
  captureKeyName,
  emptySitting,
  everything,
  hear,
  projectNamed,
  readTurn,
  speakBack,
  WAKE,
  type Sitting,
} from '../index.js';

/**
 * Hands-free capture (addendum 09 §10, from Ken).
 *
 * What these are about is the one thing the feature rests on: **a command
 * vocabulary that never overlaps the writing vocabulary.** A writer walking
 * with the phone in their pocket cannot see what was taken as an instruction,
 * so the rule has to be checkable rather than plausible — every word they
 * might reasonably say inside a note has to survive being said inside a note.
 */

/** Say a run of utterances at a sitting, the way a walk actually goes. */
const walk = (said: readonly string[], format: 'screenplay' | 'novel' | 'instructional' = 'screenplay'): Sitting =>
  said.reduce((sitting, one) => hear(sitting, one, format), emptySitting());

describe('what a writer may say', () => {
  it('treats every command word as ordinary writing inside a note', () => {
    // The whole design, and the thing Ken asked for by name: *something that
    // will turn it off without making that word unavailable when you're using
    // the notes*. Each of these is a command word said in the middle of a
    // note, and every one of them has to end up in the note.
    const sitting = walk([
      'character, Tom',
      'he is done with all of this',
      'the idea of a project frightens him',
      'a correction he will never make',
      'the setting is his mother’s kitchen',
    ]);

    expect(sitting.open?.key).toBe('character');
    expect(sitting.open?.subjectName).toBe('Tom');
    expect(sitting.open?.text).toBe(
      'he is done with all of this the idea of a project frightens him ' +
        'a correction he will never make the setting is his mother’s kitchen',
    );
    // Nothing was filed, because nothing said *dictate done*.
    expect(sitting.filed).toHaveLength(0);
  });

  it('saves on dictate done and opens the next one on dictate new setting', () => {
    // Ken's own sequence, said as he said it.
    const sitting = walk([
      'character, Tom',
      'he never looks anybody in the eye',
      `${WAKE} done`,
      `${WAKE} new setting`,
      'the kitchen is too small for the table in it',
      `${WAKE} done`,
    ]);

    expect(sitting.open).toBeNull();
    expect(sitting.filed).toHaveLength(2);
    expect(sitting.filed[0]).toEqual({
      key: 'character',
      subjectName: 'Tom',
      text: 'he never looks anybody in the eye',
    });
    expect(sitting.filed[1]).toEqual({
      key: 'setting',
      subjectName: null,
      text: 'the kitchen is too small for the table in it',
    });
  });

  it('starts a note from a bare category only when nothing is open', () => {
    // *Or you can just say idea, and it can go into your ideas folder.*
    const idle = hear(emptySitting(), 'idea', 'screenplay');
    expect(idle.open?.key).toBe('idea');

    // …and the same word mid-note is the writer's, not the program's.
    const open = walk(['character, Tom', 'idea']);
    expect(open.open?.key).toBe('character');
    expect(open.open?.text).toBe('idea');
  });

  it('does not write an unrecognised command into the note', () => {
    // The worst of the three things that could happen: a writer believes they
    // gave a command, and it lands in the middle of their sentence where they
    // will not see it until they are back at the desk.
    const sitting = walk(['character, Tom', 'he is tired', `${WAKE} nwe setitng`]);
    expect(sitting.open?.text).toBe('he is tired');
    expect(sitting.said).toContain('Didn’t catch that command');
  });

  it('files what was open when the next note starts, rather than losing it', () => {
    const sitting = walk(['idea', 'a bell rings in the third act', `${WAKE} theme`, 'nobody is forgiven']);
    expect(sitting.filed).toHaveLength(1);
    expect(sitting.filed[0]?.text).toBe('a bell rings in the third act');
    expect(sitting.open?.key).toBe('theme');
  });

  it('keeps the note that was open when the walk ends', () => {
    // A notebook that kept only what you remembered to close is one you stop
    // trusting after the first walk.
    const sitting = walk(['idea', 'the lighthouse was never lit']);
    expect(sitting.filed).toHaveLength(0);
    expect(everything(sitting)).toHaveLength(1);
    expect(everything(sitting)[0]?.text).toBe('the lighthouse was never lit');
  });

  it('throws one away only when told to, out loud', () => {
    const sitting = walk(['idea', 'this is nonsense', `${WAKE} scratch that`]);
    expect(sitting.open).toBeNull();
    expect(everything(sitting)).toHaveLength(0);
    expect(sitting.said).toBe('Thrown away.');
  });

  it('replaces the words on a correction and hands back what was there', () => {
    const sitting = walk(['idea', 'she drives a lorry', `${WAKE} correction she drives a bus`]);
    expect(sitting.open?.text).toBe('she drives a bus');
    expect(sitting.undone).toBe('she drives a lorry');
  });

  it('asks for a project by name, loosely, because speech is loose', () => {
    const sitting = hear(emptySitting(), `${WAKE} project Jinn`, 'screenplay');
    expect(sitting.wants).toBe('Jinn');

    const projects = [
      { id: 'a', name: 'The Lamp and the Lighthouse' },
      { id: 'b', name: 'Jinn' },
      { id: 'c', name: 'Jinn: the second book' },
    ];
    expect(projectNamed('jinn', projects)?.id).toBe('b');
    expect(projectNamed('the lamp', projects)?.id).toBe('a');
    expect(projectNamed('lighthouse', projects)?.id).toBe('a');
    expect(projectNamed('nothing like it', projects)).toBeNull();
  });

  it('takes a name only after a pause, which is what a pause is for', () => {
    // Stage 4's rule, kept: without the comma there is no way to tell a name
    // from the opening of a sentence, so nothing is taken.
    const withPause = readTurn('character, Marisol, she never trusts him', {
      open: false,
      format: 'screenplay',
    });
    expect(withPause).toMatchObject({ kind: 'start', key: 'character', subjectName: 'Marisol' });

    const without = readTurn('character Marisol never trusts him', { open: false, format: 'screenplay' });
    expect(without).toMatchObject({ kind: 'start', key: 'character', subjectName: null });
    expect(without).toMatchObject({ text: 'Marisol never trusts him' });
  });

  it('matches a command word whole, so architecture is not an arc', () => {
    const sitting = hear(emptySitting(), 'architecture of the second half', 'screenplay');
    expect(sitting.open?.key).toBeNull();
    expect(sitting.open?.text).toBe('architecture of the second half');
  });
});

describe('the words a format lends the phone', () => {
  it('offers the noun table’s own structural pair, never a spelling of its own', () => {
    const screenplay = captureVocabulary('screenplay').map((one) => one.name);
    expect(screenplay).toContain('Scene');
    expect(screenplay).toContain('Beat');

    const novel = captureVocabulary('novel').map((one) => one.name);
    expect(novel).toContain('Chapter');
    expect(novel).toContain('Passage');
    expect(novel).not.toContain('Scene');
  });

  it('is absent rather than renamed where a format has none of it', () => {
    // A textbook has no cast, no locations and no plot (addendum 16 §6a).
    const book = captureVocabulary('instructional');
    const keys = book.map((one) => one.key);
    for (const absent of ['character', 'setting', 'plot_point', 'arc']) {
      expect(keys).not.toContain(absent);
    }
    expect(book.map((one) => one.name)).toEqual(
      expect.arrayContaining(['Section', 'Subsection', 'Idea', 'Theme', 'Research']),
    );
  });

  it('hears the same word as the format’s own unit', () => {
    // A textbook's two are Section and Subsection, and there are no synonyms
    // for them: writing this test is what found that offering Ken's *chapter*
    // and *section* as well put `section` on both rungs at once.
    expect(readTurn('section, the one about refraction', { open: false, format: 'instructional' }))
      .toMatchObject({ kind: 'start', key: 'unit' });
    expect(readTurn('subsection, worked examples', { open: false, format: 'instructional' }))
      .toMatchObject({ kind: 'start', key: 'sub' });
    // A word that fits neither rung is kept as writing rather than guessed at.
    expect(readTurn('chapter nine is the one about refraction', { open: false, format: 'instructional' }))
      .toMatchObject({ kind: 'words' });
    // And on a screenplay the same two words are the script's own.
    expect(readTurn('scene, the kitchen', { open: false, format: 'screenplay' }))
      .toMatchObject({ kind: 'start', key: 'unit' });
    expect(readTurn('beat, he puts the cup down', { open: false, format: 'screenplay' }))
      .toMatchObject({ kind: 'start', key: 'sub' });
  });

  it('names a key it has never heard of rather than dropping it', () => {
    expect(captureKeyName('character', 'novel')).toBe('Character');
    expect(captureKeyName('unit', 'novel')).toBe('Chapter');
    expect(captureKeyName('unit', 'screenplay')).toBe('Scene');
    expect(captureKeyName('something_newer', null)).toBe('something_newer');
  });
});

describe('what it says back', () => {
  it('answers a command and never the writing', () => {
    // Reading dictation back as it arrives would talk over somebody mid
    // sentence, which is the one thing a hands-free notebook must not do.
    const before = emptySitting();
    const opened = hear(before, 'character, Tom', 'screenplay');
    expect(speakBack(before, opened)).toBe('Character, Tom.');

    const writing = hear(opened, 'he never looks anybody in the eye', 'screenplay');
    expect(speakBack(opened, writing)).toBeNull();

    const saved = hear(writing, `${WAKE} done`, 'screenplay');
    expect(speakBack(writing, saved)).toBe('Saved. Character.');
  });

  it('beeps on the turn that opens a note and on no other', () => {
    const opened = hear(emptySitting(), 'idea', 'screenplay');
    expect(opened.opened).toBe(true);
    const writing = hear(opened, 'more words', 'screenplay');
    expect(writing.opened).toBe(false);
  });
});
