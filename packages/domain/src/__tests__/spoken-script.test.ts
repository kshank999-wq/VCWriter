import { describe, expect, it } from 'vitest';
import { carriesStructure, readDictatedScript } from '../spoken-script.js';

/**
 * Dictating the manuscript (spec §9).
 *
 * The rule under all of these is that **a command is a sentence of its own**.
 * A writer naming a style pauses after it, and a recogniser writes that pause
 * as punctuation — so anything that is not bounded that way is prose, and
 * stays prose. What these hold is both halves: that naming a style works, and
 * that using the same word in a sentence does not.
 */

const said = (transcript: string) => readDictatedScript(transcript, 'screenplay');

describe('naming a style', () => {
  it('starts a scene', () => {
    expect(said('Scene heading. Interior. Kitchen. Night.')).toEqual([
      { type: 'scene_heading', text: 'Interior. Kitchen. Night.', starts: true },
    ]);
  });

  it('reads a whole exchange out of one breath', () => {
    const parts = said(
      'Scene heading. Interior kitchen, night. Action. She opens the fridge. ' +
        'Character. Mara. Dialogue. There is nothing in here.',
    );

    expect(parts).toEqual([
      { type: 'scene_heading', text: 'Interior kitchen, night.', starts: true },
      { type: 'action', text: 'She opens the fridge.', starts: true },
      { type: 'character', text: 'Mara', starts: true },
      { type: 'dialogue', text: 'There is nothing in here.', starts: true },
    ]);
  });

  it('takes the style with nothing spoken into it yet', () => {
    // Somebody dictating a line at a time names the style, pauses, and speaks
    // the line as the next utterance.
    expect(said('Character.')).toEqual([{ type: 'character', text: '', starts: true }]);
  });

  it('accepts the words a writer actually uses for a slugline', () => {
    for (const spoken of ['Scene heading', 'Slug line', 'Slugline', 'New scene']) {
      expect(said(`${spoken}. Interior. Car.`)[0]?.type).toBe('scene_heading');
    }
  });

  it('hears a wryly as a parenthetical', () => {
    expect(said('Wryly. under her breath')).toEqual([
      { type: 'parenthetical', text: 'under her breath', starts: true },
    ]);
  });
});

describe('what is not a command', () => {
  it('leaves a style word used in a sentence alone', () => {
    // The line this module exists to not cross.
    expect(said('The action was over by the time she got there.')).toEqual([
      { type: null, text: 'The action was over by the time she got there.', starts: false },
    ]);
  });

  it('does not take a word that merely opens a sentence', () => {
    // "Action" here runs straight on into the sentence, so there was no pause
    // and no command — only a sentence that happens to start with the word.
    expect(said('Character actors never get the good lines.')).toEqual([
      { type: null, text: 'Character actors never get the good lines.', starts: false },
    ]);
  });

  it('does not match inside a longer word', () => {
    expect(said('Shotgun on the table.')).toEqual([
      { type: null, text: 'Shotgun on the table.', starts: false },
    ]);
  });

  it('keeps ordinary dictation as one run in the current style', () => {
    expect(said('She crosses to the window and looks out.')).toEqual([
      { type: null, text: 'She crosses to the window and looks out.', starts: false },
    ]);
  });
});

describe('a cue is a name', () => {
  it('drops the full stop a recogniser puts after it', () => {
    // The cast is noted from cues: "MARA." with the stop left on would put a
    // second, punctuated person in the character list beside the real one.
    expect(said('Character. Mara.')).toEqual([{ type: 'character', text: 'Mara', starts: true }]);
  });

  it('leaves punctuation alone everywhere else', () => {
    expect(said('Action. She stops, turns, and says nothing.')).toEqual([
      { type: 'action', text: 'She stops, turns, and says nothing.', starts: true },
    ]);
  });
});

describe('new line', () => {
  it('starts another element in the style already being written', () => {
    // The break carries the style forward: another action line, not a
    // styleless one.
    expect(said('Action. She waits. New line. The door opens.')).toEqual([
      { type: 'action', text: 'She waits.', starts: true },
      { type: 'action', text: 'The door opens.', starts: true },
    ]);
  });

  it('reads a newline character the same way, which is the desktop case', () => {
    // The system's dictation types into the field, so "new line" arrives as a
    // character rather than as the Return key the editor would have handled.
    expect(said('She waits.\nThe door opens.')).toEqual([
      { type: null, text: 'She waits.', starts: false },
      { type: null, text: 'The door opens.', starts: true },
    ]);
  });
});

describe('prose', () => {
  const prose = (transcript: string) => readDictatedScript(transcript, 'novel');

  it('hears the styles a novel has', () => {
    expect(prose('Chapter heading. The Wreck.')).toEqual([
      { type: 'heading', text: 'The Wreck.', starts: true },
    ]);
  });

  it('does not offer screenplay styles to a novelist', () => {
    // "Character" is a word in a novel and nothing else.
    expect(prose('Character. Mara.')).toEqual([
      { type: null, text: 'Character. Mara.', starts: false },
    ]);
  });

  it('takes a scene break without reading it as a scene', () => {
    expect(prose('Scene break.')).toEqual([{ type: 'scene_break', text: '', starts: true }]);
  });
});

describe('whether dictation needs re-typing at all', () => {
  it('says no for a phrase with nothing structural in it', () => {
    // An ordinary edit to the element being written should stay one element.
    expect(carriesStructure('and looks out of the window', 'screenplay')).toBe(false);
  });

  it('says yes when a style was named', () => {
    expect(carriesStructure('Character. Mara.', 'screenplay')).toBe(true);
  });

  it('says yes for a line break, which is what the keyboard rules never see', () => {
    // The reason this module exists: Return is handled on keydown, and
    // dictated text never presses a key.
    expect(carriesStructure('She waits.\nThe door opens.', 'screenplay')).toBe(true);
  });
});
