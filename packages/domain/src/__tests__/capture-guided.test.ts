import { describe, expect, it } from 'vitest';
import {
  GUIDED_BODY,
  GUIDED_CONFIRM,
  GUIDED_TITLE,
  hear,
  hearPause,
  kindQuestion,
  startGuided,
  type Sitting,
} from '../index.js';

/**
 * The hands-free walk that asks (addendum 27 §18, from Ken: *it can say, first,
 * is it a section, is it an idea, a theme… then if you pause it'll say what
 * is the title… then what would you like to put in this note, and you dictate
 * it… and when you're done, it asks you, are you done or would you like to
 * continue?*).
 */

const say = (phrases: readonly (string | 'PAUSE')[], format: 'instructional' | 'screenplay' = 'instructional'): Sitting =>
  phrases.reduce(
    (at, one) => (one === 'PAUSE' ? hearPause(at) : hear(at, one, format)),
    startGuided(format),
  );

describe('a walk that asks', () => {
  it('opens by asking for the kind, in the project’s own words', () => {
    const start = startGuided('instructional');
    expect(start.ask).toBe('kind');
    expect(start.speak).toBe(kindQuestion('instructional'));
    expect(start.speak).toMatch(/^What kind of note is it\?/);
  });

  it('goes kind, title, body, then asks whether you are done, and saves on "save"', () => {
    let at = hear(startGuided('instructional'), 'idea', 'instructional');
    expect(at.ask).toBe('title');
    expect(at.speak).toBe(`Idea. ${GUIDED_TITLE}`);

    at = hear(at, 'The Amber Alert', 'instructional');
    expect(at.ask).toBe('body');
    expect(at.speak).toBe(GUIDED_BODY);

    at = hear(at, 'This is an Amber Alert.', 'instructional');
    at = hear(at, 'Everyone stops on the bridge.', 'instructional');
    expect(at.speak).toBeNull();

    at = hearPause(at);
    expect(at.ask).toBe('confirm');
    expect(at.speak).toBe(GUIDED_CONFIRM);

    at = hear(at, 'Save.', 'instructional');
    expect(at.filed).toEqual([
      { key: 'idea', subjectName: 'The Amber Alert', text: 'This is an Amber Alert. Everyone stops on the bridge.', group: null },
    ]);
    expect(at.open).toBeNull();
    expect(at.ask).toBe('kind');
    expect(at.speak).toMatch(/^Saved\. What kind of note is it\?/);
  });

  it('carries on after "continue", and asks again at the next pause', () => {
    const at = say(['idea', 'Bridge', 'The bridge is out.', 'PAUSE', 'continue', 'Nobody can cross.', 'PAUSE']);
    expect(at.ask).toBe('confirm');
    expect(at.open?.text).toBe('The bridge is out. Nobody can cross.');
  });

  it('takes words said at the question as more of the note', () => {
    const at = say(['idea', 'Bridge', 'The bridge is out.', 'PAUSE', 'And the river is rising.']);
    expect(at.ask).toBe('body');
    expect(at.open?.text).toBe('The bridge is out. And the river is rising.');
  });

  it('knows the book’s own parts, like a subsection, and reads back on request', () => {
    const at = say(['subsection', "You're a loser", 'He walks out of the gym alone.', 'PAUSE', 'read it back']);
    expect(at.open).toMatchObject({ key: 'sub', subjectName: "You're a loser" });
    expect(at.speak).toContain("You're a loser. He walks out of the gym alone.");
    expect(at.speak).toContain(GUIDED_CONFIRM);
  });

  it('asks again when it does not hear a kind, and takes "just a note"', () => {
    const missed = say(['banana']);
    expect(missed.ask).toBe('kind');
    expect(missed.speak).toMatch(/^I didn’t catch a kind\./);
    expect(say(['just a note']).ask).toBe('body');
  });

  it('skips the title on "skip", and throws a note away on "throw it away"', () => {
    expect(say(['idea', 'skip']).open).toMatchObject({ subjectName: null });
    const thrown = say(['idea', 'Bridge', 'The bridge is out.', 'PAUSE', 'throw it away']);
    expect(thrown.open).toBeNull();
    expect(thrown.filed).toHaveLength(0);
  });

  it('says nothing at a pause while waiting for the kind or the title', () => {
    expect(hearPause(startGuided('instructional')).speak).toBeNull();
    expect(say(['idea', 'PAUSE']).ask).toBe('title');
  });

  it('still takes the command words, and a command word said alone arms the next phrase', () => {
    const at = say(['idea', 'Bridge', 'one two three four', 'command', 'erase word']);
    expect(at.open?.text).toBe('one two three');
  });
});
