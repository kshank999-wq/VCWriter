import { describe, expect, it } from 'vitest';
import {
  captureVocabulary,
  captureKeyName,
  emptySitting,
  everything,
  formatNamed,
  hear,
  projectFailed,
  projectMade,
  projectNamed,
  readTurn,
  speakBack,
  spokenFormatNames,
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

/**
 * Making a project out loud (addendum 09 §11, from Ken: *maybe when you create
 * the project, you can say that it's a novel, a screenplay, an educational
 * book*).
 *
 * These are all about one thing: **nothing is made until a word whose only job
 * is to make it.** A note in the wrong group is a minute's work to move; a
 * project of the wrong shape is a document whose chapters are scenes, found out
 * about a fortnight later. So the rule under every assertion here is that
 * `hear` reports a confirmation and never performs one.
 */
describe('a format said out loud', () => {
  it('takes the whole utterance, give or take an article', () => {
    expect(formatNamed('a novel')).toBe('novel');
    expect(formatNamed('novel')).toBe('novel');
    // Either apostrophe: a recogniser writes whichever its host prefers, and a
    // format refused over a punctuation mark is undiagnosable from a pocket.
    expect(formatNamed('It’s a screenplay.')).toBe('screenplay');
    expect(formatNamed("it's a screenplay")).toBe('screenplay');
    expect(formatNamed('an educational book')).toBe('instructional');
    expect(formatNamed('textbook')).toBe('instructional');
    // A description is not a choice of format, which is what stops the first
    // sentence of a synopsis being read as one.
    expect(formatNamed('the novel is about her brother')).toBe(null);
    expect(formatNamed('a book')).toBe(null);
  });

  it('reads screenplay as a screenplay rather than as a play', () => {
    expect(formatNamed('screenplay')).toBe('screenplay');
    expect(formatNamed('stage play')).toBe('stage_play');
    expect(formatNamed('play')).toBe('stage_play');
  });

  it('offers every format a writer could be asked to choose between', () => {
    // A list that is shorter than what the program can make is a question with
    // missing answers, said to somebody who cannot see the screen.
    expect(spokenFormatNames()).toContain('Educational book');
    expect(spokenFormatNames()).toContain('Novel');
    expect(spokenFormatNames().length).toBe(8);
  });
});

describe('making a project by voice', () => {
  const walk = (said: string[], format: 'screenplay' | 'novel' = 'screenplay'): Sitting =>
    said.reduce((sitting, one) => hear(sitting, one, format), emptySitting());

  it('gathers the name, then the kind, and makes nothing until yes', () => {
    const named = walk([`${WAKE} new project Blackout`]);
    expect(named.making).toMatchObject({ name: 'Blackout', format: null });
    expect(named.makes).toBeNull();
    expect(named.said).toContain('What kind?');

    const kinded = hear(named, 'a novel', 'screenplay');
    expect(kinded.making).toMatchObject({ name: 'Blackout', format: 'novel' });
    // Still nothing made: the sentence says what the next word is.
    expect(kinded.makes).toBeNull();
    expect(kinded.said).toContain(`${WAKE} yes`);

    const confirmed = hear(kinded, `${WAKE} yes`, 'screenplay');
    expect(confirmed.makes).toEqual({ name: 'Blackout', format: 'novel' });
  });

  it('takes the kind in the same breath', () => {
    const one = walk([`${WAKE} new project The Lamp, a novel`]);
    expect(one.making).toMatchObject({ name: 'The Lamp', format: 'novel' });
    expect(one.makes).toBeNull();
  });

  it('takes the kind first and the name after it', () => {
    // A writer who answers the second question first has still answered it.
    const kind = walk([`${WAKE} new project`, 'an educational book']);
    expect(kind.making).toMatchObject({ name: '', format: 'instructional' });
    // What landed, then what is missing. The bare question was what this said
    // before it was driven, and it is the sentence the turn before it already
    // said — so answering was silent, which from a pocket reads as unheard.
    expect(kind.said).toBe('Educational book. What is it called?');

    const named = hear(kind, 'Refraction', 'screenplay');
    expect(named.making).toMatchObject({ name: 'Refraction', format: 'instructional' });
    expect(named.said).toContain(`${WAKE} yes`);
  });

  it('refuses a kind it does not know rather than guessing the nearest', () => {
    const asked = walk([`${WAKE} new project Blackout`, 'a graphic novella']);
    expect(asked.making).toMatchObject({ name: 'Blackout', format: null });
    expect(asked.said).toContain('Not a kind I know');
    expect(asked.said).toContain('Educational book');
  });

  it('will not make one with a name and no kind, or a kind and no name', () => {
    const noKind = hear(walk([`${WAKE} new project Blackout`]), `${WAKE} yes`, 'screenplay');
    expect(noKind.makes).toBeNull();
    expect(noKind.said).toContain('What kind first?');
    // And the plan survives the refusal, so the answer carries on from here.
    expect(noKind.making).toMatchObject({ name: 'Blackout' });

    const noName = hear(walk([`${WAKE} new project`, 'a novel']), `${WAKE} yes`, 'screenplay');
    expect(noName.makes).toBeNull();
    expect(noName.said).toBe('What is it called first?');
  });

  it('does not open a note out of the answer to its own question', () => {
    // *a novel* would otherwise be the first line of a note nobody meant to
    // open, and *idea* would open one, which is why this state is not the
    // ordinary between-notes one.
    const asked = walk([`${WAKE} new project Blackout`]);
    const answered = hear(asked, 'a novel', 'screenplay');
    expect(answered.open).toBeNull();
    expect(answered.filed).toEqual([]);

    const bare = hear(asked, 'idea', 'screenplay');
    expect(bare.open).toBeNull();
  });

  it('asks the question again rather than reading a command as a yes', () => {
    // *dictate done* over a waiting plan might mean *make it*; only `yes` is
    // allowed to mean that.
    const asked = walk([`${WAKE} new project Blackout`, 'a novel']);
    const done = hear(asked, `${WAKE} done`, 'screenplay');
    expect(done.makes).toBeNull();
    expect(done.making).toMatchObject({ name: 'Blackout', format: 'novel' });
    expect(done.said).toContain(`${WAKE} yes`);
    // And it is **refused out loud**: re-asking alone is the sentence already
    // on the screen, so `speakBack` suppressed it as a repeat and the command
    // made no sound at all — which a writer reads as having worked.
    expect(done.said).toContain('Nothing made yet');
    expect(speakBack(asked, done)).toBe(done.said);
  });

  it('never answers a turn that changed something with silence', () => {
    // The two the tests missed and driving it found. A reply has to differ from
    // the question it answers or there is no reply: on a phone in a pocket the
    // read-back is the only thing there is.
    const steps = [
      `${WAKE} new project`,
      'a screenplay',
      'Jinn',
      `${WAKE} done`,
      `${WAKE} yes`,
    ];
    let sitting = emptySitting();
    for (const said of steps) {
      const before = sitting;
      sitting = hear(before, said, 'screenplay');
      expect(speakBack(before, sitting)).not.toBeNull();
    }
  });

  it('lets a plan go when the writer says so, and keeps the note before it', () => {
    const mid = walk(['character, Tom', 'he never looks anybody in the eye']);
    const asked = hear(mid, `${WAKE} new project Blackout`, 'screenplay');
    // Making a project is not a reason to lose the thought that led to it.
    expect(asked.filed).toHaveLength(1);
    expect(asked.open).toBeNull();

    const gone = hear(asked, `${WAKE} scratch that`, 'screenplay');
    expect(gone.making).toBeNull();
    expect(gone.filed).toHaveLength(1);
  });

  it('says every word of it out loud', () => {
    // The sentence is a question, and a question nobody hears is a phone
    // waiting on an answer to something it never asked.
    const before = emptySitting();
    const asked = hear(before, `${WAKE} new project Blackout`, 'screenplay');
    expect(speakBack(before, asked)).toContain('What kind?');

    const kinded = hear(asked, 'a novel', 'screenplay');
    expect(speakBack(asked, kinded)).toContain(`${WAKE} yes`);

    const confirmed = hear(kinded, `${WAKE} yes`, 'screenplay');
    expect(speakBack(kinded, confirmed)).toBe('Making Blackout…');
  });

  it('lets the plan go once the host has made it, and keeps it when it could not', () => {
    const confirmed = walk([`${WAKE} new project Blackout`, 'a novel', `${WAKE} yes`]);
    const plan = { name: 'Blackout', format: 'novel' as const };

    const made = projectMade(confirmed, plan);
    expect(made.making).toBeNull();
    expect(made.makes).toBeNull();
    expect(made.said).toBe('Blackout is ready.');

    // A failure keeps it, so saying yes again is a retry rather than starting
    // over — which is what somebody walking with a phone will do.
    const failed = projectFailed(confirmed, plan, 'No signal. Say yes again when you have one.');
    expect(failed.making).toMatchObject({ name: 'Blackout', format: 'novel' });
    expect(failed.makes).toBeNull();
    expect(failed.said).toContain('Say yes again');
  });

  it('will not clear a plan the writer has already replaced', () => {
    // The network answers whenever it answers; by then this may be a different
    // plan, and clearing blind would take one nobody had finished with.
    const confirmed = walk([`${WAKE} new project Blackout`, 'a novel', `${WAKE} yes`]);
    const moved = hear(confirmed, `${WAKE} new project The Lamp`, 'screenplay');
    const late = projectMade(moved, { name: 'Blackout', format: 'novel' });
    expect(late.making).toMatchObject({ name: 'The Lamp' });
    expect(late.makes).toBeNull();
  });

  it('moves to a project by name without making anything', () => {
    // *dictate project Jinn* and *dictate new project Jinn* are two acts, and
    // the filler stripper must not turn the second into the first.
    const moved = walk([`${WAKE} project Jinn`]);
    expect(moved.wants).toBe('Jinn');
    expect(moved.making).toBeNull();

    const making = walk([`${WAKE} new project Jinn`]);
    expect(making.wants).toBeNull();
    expect(making.making).toMatchObject({ name: 'Jinn' });
  });
});
