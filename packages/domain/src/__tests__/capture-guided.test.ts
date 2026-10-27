import { describe, expect, it } from 'vitest';
import {
  GUIDED_BODY,
  GUIDED_CONFIRM,
  GUIDED_DISCARD,
  GUIDED_READ_BACK,
  GUIDED_SAVE,
  GUIDED_TITLE,
  guidedPauseMs,
  hear,
  hearPause,
  kindQuestion,
  sectionQuestion,
  startGuided,
  type Sitting,
} from '../index.js';

/**
 * The hands-free walk that asks (addendum 27 §19, from Ken: *it will ask you,
 * what category? You tell it your category. You wait a few seconds. And when
 * it doesn't hear from you, it says, what is the title?…*).
 */

type Format = 'instructional' | 'screenplay';
const say = (phrases: readonly (string | 'PAUSE')[], format: Format = 'instructional', from?: Sitting): Sitting =>
  phrases.reduce(
    (at, one) => (one === 'PAUSE' ? hearPause(at, format) : hear(at, one, format)),
    from ?? startGuided(format),
  );

describe('a walk that asks', () => {
  it('opens by asking simply what type of note it is, without reading out the list', () => {
    const start = startGuided('instructional');
    expect(start.ask).toBe('kind');
    expect(start.speak).toBe(kindQuestion('instructional'));
    expect(start.speak).toBe('What type of note is this?');
  });

  it('moves on only at a pause: category, title, the note, then continue or save', () => {
    let at = say(['idea']);
    expect(at.speak).toBeNull();
    expect(at.open).toMatchObject({ key: 'idea' });

    at = say(['PAUSE'], 'instructional', at);
    expect(at.ask).toBe('title');
    expect(at.speak).toBe(`Idea. ${GUIDED_TITLE}`);

    at = say(['The Amber Alert'], 'instructional', at);
    expect(at.speak).toBeNull();
    at = say(['PAUSE'], 'instructional', at);
    expect(at.ask).toBe('body');
    expect(at.speak).toBe(GUIDED_BODY);

    at = say(['This is an Amber Alert.', 'Everyone stops on the bridge.'], 'instructional', at);
    expect(at.speak).toBeNull();
    at = say(['PAUSE'], 'instructional', at);
    expect(at.ask).toBe('confirm');
    expect(at.speak).toBe(GUIDED_CONFIRM);
  });

  it('save asks to read it back, then whether to save, and yes files it', () => {
    const walk = ['idea', 'PAUSE', 'The Amber Alert', 'PAUSE', 'This is an Amber Alert.', 'PAUSE'];

    let at = say([...walk, 'save']);
    expect(at.ask).toBe('readBack');
    expect(at.speak).toBe(GUIDED_READ_BACK);

    const read = say(['yes'], 'instructional', at);
    expect(read.ask).toBe('save');
    expect(read.speak).toBe(`Idea, The Amber Alert. This is an Amber Alert. ${GUIDED_SAVE}`);

    const unread = say(['no'], 'instructional', at);
    expect(unread.ask).toBe('save');
    expect(unread.speak).toBe(GUIDED_SAVE);

    at = say(['yes'], 'instructional', read);
    expect(at.filed).toEqual([{ key: 'idea', subjectName: 'The Amber Alert', text: 'This is an Amber Alert.', group: null }]);
    expect(at.open).toBeNull();
    expect(at.ask).toBe('kind');
    expect(at.speak).toBe('Saved. What type of note is this?');
  });

  it('no to saving asks delete or continue; delete drops it, continue goes back to it', () => {
    const walk = ['idea', 'PAUSE', 'Bridge', 'PAUSE', 'The bridge is out.', 'PAUSE', 'save', 'no', 'no'];
    const asked = say(walk);
    expect(asked.ask).toBe('discard');
    expect(asked.speak).toBe(GUIDED_DISCARD);

    const deleted = say(['delete'], 'instructional', asked);
    expect(deleted.open).toBeNull();
    expect(deleted.filed).toHaveLength(0);
    expect(deleted.ask).toBe('kind');

    const kept = say(['continue', 'Nobody can cross.', 'PAUSE'], 'instructional', asked);
    expect(kept.open?.text).toBe('The bridge is out. Nobody can cross.');
    expect(kept.ask).toBe('confirm');
  });

  it('after continue, a pause is time to think: it asks again only once more is said', () => {
    let at = say(['idea', 'PAUSE', 'Bridge', 'PAUSE', 'The bridge is out.', 'PAUSE', 'continue']);
    expect(at.ask).toBe('body');
    expect(at.speak).toBe('Go ahead.');
    at = say(['PAUSE', 'PAUSE'], 'instructional', at);
    expect(at.ask).toBe('body');
    expect(at.speak).toBeNull();
    at = say(['Nobody can cross.', 'PAUSE'], 'instructional', at);
    expect(at.ask).toBe('confirm');
    expect(at.open?.text).toBe('The bridge is out. Nobody can cross.');
  });

  it('takes words said at continue-or-save as more of the note', () => {
    const at = say(['idea', 'PAUSE', 'Bridge', 'PAUSE', 'The bridge is out.', 'PAUSE', 'And the river is rising.']);
    expect(at.ask).toBe('body');
    expect(at.open?.text).toBe('The bridge is out. And the river is rising.');
  });

  it('a title said in more than one breath is one title', () => {
    const at = say(['scene', 'PAUSE', 'The kitchen', 'at night', 'PAUSE'], 'screenplay');
    expect(at.open?.subjectName).toBe('The kitchen at night');
    expect(at.ask).toBe('body');
  });

  it('knows the book’s own parts, like a subsection', () => {
    const at = say(['subsection', 'PAUSE', 'The gym', 'PAUSE', "You're a loser", 'PAUSE', 'He walks out of the gym alone.', 'PAUSE', 'read it back']);
    expect(at.open).toMatchObject({ key: 'sub', subjectName: "You're a loser", group: 'The gym' });
    expect(at.speak).toContain("You're a loser. He walks out of the gym alone.");
    expect(at.speak).toContain(GUIDED_CONFIRM);
  });

  it('asks again when it does not hear a category, and takes "just a note"', () => {
    const missed = say(['banana']);
    expect(missed.ask).toBe('kind');
    expect(missed.speak).toMatch(/^I didn’t catch the type\./);
    const plain = say(['just a note', 'PAUSE']);
    expect(plain.ask).toBe('title');
    expect(plain.open).toMatchObject({ key: null });
  });

  it('skips the title on "skip"', () => {
    const at = say(['idea', 'PAUSE', 'skip']);
    expect(at.open).toMatchObject({ subjectName: null });
    expect(at.ask).toBe('body');
    expect(at.speak).toBe(`No title. ${GUIDED_BODY}`);
  });

  it('gives the title longer to be said than anything else', () => {
    expect(guidedPauseMs('title')).toBeGreaterThan(guidedPauseMs('body'));
    expect(guidedPauseMs('kind')).toBe(guidedPauseMs('body'));
  });

  it('says nothing at a pause before anything is said', () => {
    expect(hearPause(startGuided('instructional'), 'instructional').speak).toBeNull();
    const asked = say(['idea', 'PAUSE', 'PAUSE']);
    expect(asked.ask).toBe('title');
    expect(asked.speak).toBeNull();
  });

  it('a category and a title in one breath asks for the note at the pause', () => {
    const at = say(['idea the bridge', 'PAUSE']);
    expect(at.open?.subjectName).toBe('the bridge');
    expect(at.speak).toBe(GUIDED_BODY);
  });

  it('still takes the command words, and a command word said alone arms the next phrase', () => {
    const at = say(['idea', 'PAUSE', 'Bridge', 'PAUSE', 'one two three four', 'command', 'erase word']);
    expect(at.open?.text).toBe('one two three');
  });

  describe('sections and subsections, grouped', () => {
    const section = ['section', 'PAUSE', 'Getting started', 'PAUSE', 'Why the book exists.', 'PAUSE', 'save', 'no', 'yes'];

    it('a section’s title becomes the group, and the section itself is under it', () => {
      const at = say(section);
      expect(at.group).toBe('Getting started');
      expect(at.filed).toEqual([{ key: 'unit', subjectName: 'Getting started', text: 'Why the book exists.', group: 'Getting started' }]);
    });

    it('a subsection after it goes under that section without being asked', () => {
      const at = say([...section, 'subsection', 'PAUSE', 'Installing', 'PAUSE', 'Download it.', 'PAUSE', 'save', 'no', 'yes']);
      expect(at.filed[1]).toEqual({ key: 'sub', subjectName: 'Installing', text: 'Download it.', group: 'Getting started' });
    });

    it('a new section moves what follows under it', () => {
      const second = ['section', 'PAUSE', 'Going further', 'PAUSE', 'More.', 'PAUSE', 'save', 'no', 'yes'];
      const at = say([...section, ...second, 'subsection', 'PAUSE', 'Plugins', 'PAUSE', 'Extend it.', 'PAUSE', 'save', 'no', 'yes']);
      expect(at.filed.map((one) => one.group)).toEqual(['Getting started', 'Going further', 'Going further']);
    });

    it('a subsection with no section asks which section it is part of', () => {
      let at = say(['subsection', 'PAUSE']);
      expect(at.ask).toBe('section');
      expect(at.speak).toBe(`Subsection. ${sectionQuestion('instructional')}`);
      expect(sectionQuestion('instructional')).toBe('Which section is this part of?');
      at = say(['Getting started', 'PAUSE'], 'instructional', at);
      expect(at.group).toBe('Getting started');
      expect(at.ask).toBe('title');
      at = say(['Installing', 'PAUSE', 'Download it.', 'PAUSE', 'save', 'no', 'yes'], 'instructional', at);
      expect(at.filed[0]).toMatchObject({ key: 'sub', subjectName: 'Installing', group: 'Getting started' });
    });

    it('takes "none" for a subsection that belongs to no section', () => {
      const at = say(['subsection', 'PAUSE', 'none']);
      expect(at.group).toBeNull();
      expect(at.ask).toBe('title');
    });

    it('a section named again by ear is matched to the spelling already said', () => {
      const at = say([...section, 'idea', 'PAUSE', 'x', 'PAUSE', 'y', 'PAUSE', 'save', 'no', 'yes', 'section', 'PAUSE', 'getting started', 'PAUSE']);
      expect(at.group).toBe('Getting started');
    });
  });
});
