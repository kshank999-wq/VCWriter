import { describe, expect, it } from 'vitest';
import { emptySitting, everything, hear, readTurn, speakBack, splitTurns, type Sitting } from '../index.js';

/**
 * Erasing, and moving between a note's title and its body, out loud
 * (addendum 27 §16, from Ken on his first hands-free walk: *there needs to be
 * a way to reset. Maybe we can say command erase all… there's no way to switch
 * from the title or the character to the actual body… every time you say erase
 * word, it'll erase the next word*).
 */

const walk = (said: readonly string[]): Sitting =>
  said.reduce((sitting, one) => hear(sitting, one, 'screenplay'), emptySitting());

describe('the command word', () => {
  it('is "command" as well as "dictate"', () => {
    expect(readTurn('command done', { open: true, format: 'screenplay' })).toEqual({ kind: 'finish' });
    expect(readTurn('dictate done', { open: true, format: 'screenplay' })).toEqual({ kind: 'finish' });
    expect(walk(['command character', 'Tom']).open).toMatchObject({ key: 'character', subjectName: 'Tom' });
  });
});

describe('a title, then the body', () => {
  it('takes the name first and the note after "command next"', () => {
    const sitting = walk(['command character', 'Tom Reyes', 'command next', 'He never looks anybody in the eye.']);
    expect(sitting.open).toMatchObject({ key: 'character', subjectName: 'Tom Reyes', text: 'He never looks anybody in the eye.' });
  });

  it('goes back to the title on "command title"', () => {
    const sitting = walk(['command character', 'Tom', 'command next', 'He runs.', 'command title', 'Reyes']);
    expect(sitting.open).toMatchObject({ subjectName: 'Tom Reyes', text: 'He runs.' });
  });

  it('takes a whole sentence said on the title as the note itself', () => {
    const sitting = walk(['command new setting', 'the kitchen is too small for the table in it']);
    expect(sitting.open).toMatchObject({ key: 'setting', subjectName: null, text: 'the kitchen is too small for the table in it' });
  });

  it('files a note without saying which part was being spoken into', () => {
    const sitting = walk(['command character', 'Tom', 'command next', 'He runs.', 'command done']);
    expect(sitting.filed[0]).toEqual({ key: 'character', subjectName: 'Tom', text: 'He runs.', group: null });
    expect(everything(walk(['command character', 'Tom']))[0]).not.toHaveProperty('on');
  });
});

describe('erasing', () => {
  it('"command erase all" empties the note and starts it on its title again', () => {
    const sitting = walk(['command character', 'Tim', 'command next', 'He never looks up.', 'command erase all']);
    expect(sitting.open).toMatchObject({ key: 'character', subjectName: null, text: '', on: 'title' });
    expect(sitting.undone).toBe('He never looks up.');
    // And the right name goes in.
    expect(walk(['command character', 'Tim', 'command erase all', 'Tom']).open).toMatchObject({ subjectName: 'Tom' });
  });

  it('"command erase word" takes back one word each time', () => {
    let sitting = walk(['command idea', 'the bridge is out tonight']);
    sitting = hear(sitting, 'command erase word', 'screenplay');
    expect(sitting.open?.text).toBe('the bridge is out');
    expect(sitting.said).toBe('Erased “tonight”.');
    sitting = hear(sitting, 'command erase word', 'screenplay');
    expect(sitting.open?.text).toBe('the bridge is');
  });

  it('takes a count, and erases from the title while that is where you are', () => {
    expect(hear(walk(['command idea', 'one two three four five']), 'command erase three words', 'screenplay').open?.text).toBe('one two');
    expect(hear(walk(['command character', 'Tom Reyes']), 'command erase word', 'screenplay').open?.subjectName).toBe('Tom');
  });

  it('says so when there is nothing to erase, and every erase is heard', () => {
    expect(walk(['command erase all']).said).toBe('Nothing open to erase.');
    const before = walk(['command idea', 'one two']);
    const after = hear(before, 'command erase word', 'screenplay');
    expect(speakBack(before, after)).toBe('Erased “two”.');
  });

  it('never writes the command into the note', () => {
    const sitting = walk(['command idea', 'the bridge', 'command erase all', 'the river']);
    expect(sitting.open?.text).toBe('the river');
  });
});

describe('several commands in one breath', () => {
  it('carries out each of them', () => {
    const sitting = walk(['command idea', 'one two three four', 'command erase word command erase word']);
    expect(sitting.open?.text).toBe('one two');
  });

  it('files the note and starts the next when both are said together', () => {
    const sitting = walk(['command idea', 'the bridge is out', 'command done command character', 'Tom']);
    expect(sitting.filed).toHaveLength(1);
    expect(sitting.open).toMatchObject({ key: 'character', subjectName: 'Tom' });
  });

  it('leaves the word alone in a sentence where no command follows it', () => {
    expect(splitTurns('I command you to stop', 'screenplay', true)).toEqual(['I command you to stop']);
    expect(walk(['command dialogue', 'I command you to stop the car.']).open?.text).toBe('I command you to stop the car.');
  });
});
