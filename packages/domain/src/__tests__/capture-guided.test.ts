import { describe, expect, it } from 'vitest';
import {
  GUIDED_AUDIO,
  GUIDED_BODY,
  GUIDED_CONFIRM,
  GUIDED_TITLE,
  GUIDED_VISUAL,
  captureVocabulary,
  guidedQuestion,
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

const say = (
  phrases: readonly (string | 'PAUSE')[],
  format: 'instructional' | 'screenplay' | 'short_form' | 'novel' = 'instructional',
): Sitting =>
  phrases.reduce(
    (at, one) => (one === 'PAUSE' ? hearPause(at) : hear(at, one, format)),
    startGuided(format),
  );

describe('a walk that asks', () => {
  it('opens by asking for the kind, in the project’s own words', () => {
    const start = startGuided('instructional');
    expect(start.ask).toBe('kind');
    expect(start.speak).toBe(kindQuestion('instructional'));
    expect(start.speak).toBe('What kind of note is it?');
  });

  it('goes kind, title, body, then asks whether you are done, and saves on "save"', () => {
    let at = hear(startGuided('instructional'), 'subsection', 'instructional');
    expect(at.ask).toBe('title');
    expect(at.speak).toBe(`Subsection. ${GUIDED_TITLE}`);

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
      { key: 'sub', subjectName: 'The Amber Alert', text: 'This is an Amber Alert. Everyone stops on the bridge.', group: null },
    ]);
    expect(at.open).toBeNull();
    expect(at.ask).toBe('kind');
    expect(at.speak).toMatch(/^Saved\. What kind of note is it\?/);
  });

  it('carries on after "continue", and asks again at the next pause', () => {
    const at = say(['section', 'Bridge', 'The bridge is out.', 'PAUSE', 'continue', 'Nobody can cross.', 'PAUSE']);
    expect(at.ask).toBe('confirm');
    expect(at.open?.text).toBe('The bridge is out. Nobody can cross.');
  });

  it('takes words said at the question as more of the note', () => {
    const at = say(['section', 'Bridge', 'The bridge is out.', 'PAUSE', 'And the river is rising.']);
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
    expect(say(['section', 'skip']).open).toMatchObject({ subjectName: null });
    const thrown = say(['section', 'Bridge', 'The bridge is out.', 'PAUSE', 'throw it away']);
    expect(thrown.open).toBeNull();
    expect(thrown.filed).toHaveLength(0);
  });

  it('says nothing at a pause while waiting for the kind or the title', () => {
    expect(hearPause(startGuided('instructional')).speak).toBeNull();
    expect(say(['section', 'PAUSE']).ask).toBe('title');
  });

  it('still takes the command words, and a command word said alone arms the next phrase', () => {
    const at = say(['section', 'Bridge', 'one two three four', 'command', 'erase word']);
    expect(at.open?.text).toBe('one two three');
  });
});

/**
 * Ken's second round on the walk (addendum 27 §20): *it just needs to say what
 * kind of note is it*, *when I say it's a scene, it then re-asks me*, and short
 * form is *just segments or ideas*, a segment asking the audio and then the
 * visual.
 */
describe('the kind, heard the way people answer', () => {
  it('asks the kind without reading the list out', () => {
    expect(kindQuestion('screenplay')).toBe('What kind of note is it?');
    expect(hear(startGuided('novel'), 'banana', 'novel').speak).toBe('I didn’t catch a kind. What kind of note is it?');
  });

  it.each(["It's a scene.", 'it’s a scene', 'A scene', 'Okay, a new scene', 'Scene please', 'Seen', 'scene note', "Let's do a scene"])(
    'opens a scene on “%s”',
    (answer) => {
      const at = say([answer], 'novel');
      expect(at.open?.key).toBe('scene');
      expect(at.ask).toBe('title');
    },
  );

  it('waits, saying nothing, when only the lead words have arrived', () => {
    const at = say(["It's a"], 'novel');
    expect(at.speak).toBeNull();
    expect(at.ask).toBe('kind');
    expect(hear(at, 'scene', 'novel').open?.key).toBe('scene');
  });

  it('keeps a title said in the same breath, in the writer’s spelling', () => {
    const at = say(["It's a scene, The Amber Alert."], 'novel');
    expect(at.open).toMatchObject({ key: 'scene', subjectName: 'The Amber Alert' });
    expect(at.ask).toBe('body');
  });

  it('says so when the project has no such kind', () => {
    expect(say(['a scene'], 'instructional').speak).toBe('There are no scenes in this project. What kind of note is it?');
  });

  it('asks no title of an idea: it is a general note', () => {
    const at = say(['idea'], 'novel');
    expect(at.ask).toBe('body');
    expect(at.speak).toBe(`Idea. ${GUIDED_BODY}`);
  });
});

describe('short form', () => {
  it('offers segments and ideas, and nothing else', () => {
    expect(captureVocabulary('short_form').map((one) => one.name)).toEqual(['Segment', 'Idea']);
  });

  it('asks a segment its title, then the audio, then the visual, and files both halves', () => {
    let at = say(['segment'], 'short_form');
    expect(at.speak).toBe(`Segment. ${GUIDED_TITLE}`);
    at = hear(at, 'Know your enemy', 'short_form');
    expect(at.speak).toBe(GUIDED_AUDIO);
    expect(guidedQuestion(at, 'short_form')).toBe(GUIDED_AUDIO);
    at = hear(at, 'Narrator: every hero needs a villain.', 'short_form');
    at = hearPause(at);
    expect(at.ask).toBe('visual');
    expect(at.speak).toBe(GUIDED_VISUAL);
    at = hear(at, 'Close on a cracked mirror.', 'short_form');
    at = hearPause(at);
    expect(at.ask).toBe('confirm');
    at = hear(at, 'save', 'short_form');
    expect(at.filed).toEqual([
      {
        key: 'unit',
        subjectName: 'Know your enemy',
        text: 'Audio: Narrator: every hero needs a villain.\nVisual: Close on a cracked mirror.',
        group: null,
      },
    ]);
  });

  it('hears “scene” as a segment, and lets the audio be skipped', () => {
    let at = say(["it's a scene", 'skip', 'skip'], 'short_form');
    expect(at.open).toMatchObject({ key: 'unit', av: true });
    expect(at.ask).toBe('visual');
    at = hear(at, 'Logo on black.', 'short_form');
    at = hear(hearPause(at), 'done', 'short_form');
    expect(at.filed[0]?.text).toBe('Visual: Logo on black.');
  });

  it('carries on with the visual after “continue”, and reads both halves back', () => {
    const at = say(['segment', 'skip', 'A door slams.', 'PAUSE', 'A hallway.', 'PAUSE', 'continue', 'Lights flicker.', 'PAUSE', 'read it back'], 'short_form');
    expect(at.open?.visual).toBe('A hallway. Lights flicker.');
    expect(at.speak).toContain('Segment. Audio: A door slams. Visual: A hallway. Lights flicker.');
  });

  it('takes an idea as a plain note', () => {
    const at = say(['idea', 'A spot told backwards.', 'PAUSE', 'save'], 'short_form');
    expect(at.filed).toEqual([{ key: 'idea', subjectName: null, text: 'A spot told backwards.', group: null }]);
  });
});
