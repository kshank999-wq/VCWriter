import { describe, expect, it } from 'vitest';
import { reformatText, reformatUntyped } from '../reformat.js';

/**
 * Text arriving from somewhere else, read back into typed elements.
 */

const shape = (text: string, format: 'screenplay' | 'novel' = 'screenplay') =>
  reformatText(text, format).map((element) => [element.type, element.text]);

describe('reading a script out of plain text', () => {
  it('finds the sluglines, the cues, the speeches and the transitions', () => {
    const pasted = [
      'INT. LIGHTHOUSE - NIGHT',
      '',
      'Rain hammers the glass. Mike stands at the lamp,',
      'watching the water.',
      '',
      'MIKE',
      '(quietly)',
      'She was here. I know she was here.',
      '',
      'CELESTE',
      'Nobody is here, Mike.',
      '',
      'CUT TO:',
    ].join('\n');

    expect(shape(pasted)).toEqual([
      ['scene_heading', 'INT. LIGHTHOUSE - NIGHT'],
      // The two hard-wrapped lines are one paragraph again.
      ['action', 'Rain hammers the glass. Mike stands at the lamp, watching the water.'],
      ['character', 'MIKE'],
      ['parenthetical', '(quietly)'],
      ['dialogue', 'She was here. I know she was here.'],
      ['character', 'CELESTE'],
      ['dialogue', 'Nobody is here, Mike.'],
      ['transition', 'CUT TO:'],
    ]);
  });

  it('takes a cue whose speech was left in the block below it', () => {
    expect(shape('MIKE\n\nShe was here.\n\nEXT. CLIFF - DAY')).toEqual([
      ['character', 'MIKE'],
      ['dialogue', 'She was here.'],
      ['scene_heading', 'EXT. CLIFF - DAY'],
    ]);
  });

  it('does not mistake a shout, or a sentence in capitals, for a cue', () => {
    expect(shape('THE LAMP GOES OUT.')).toEqual([['action', 'THE LAMP GOES OUT.']]);
    // A cue with nothing to say is action too.
    expect(shape('MIKE')).toEqual([['action', 'MIKE']]);
  });

  it('reads the forcing characters a Fountain file carries', () => {
    expect(shape('.THE LAMP ROOM\n\n@McCLURE\nYou came back.\n\n> FADE OUT.')).toEqual([
      ['scene_heading', 'THE LAMP ROOM'],
      ['character', 'McCLURE'],
      ['dialogue', 'You came back.'],
      ['transition', 'FADE OUT.'],
    ]);
  });

  it('gives nothing for nothing, and one element for one line', () => {
    expect(reformatText('   \n\n  ', 'screenplay')).toEqual([]);
    expect(shape('He waits.')).toEqual([['action', 'He waits.']]);
  });

  it('reads prose as paragraphs, with its chapter headings', () => {
    expect(shape('Chapter One\n\nThe rain had not stopped\nfor three days.\n\n***\n\nShe left at dawn.', 'novel')).toEqual([
      ['heading', 'Chapter One'],
      ['paragraph', 'The rain had not stopped for three days.'],
      ['scene_break', '***'],
      ['paragraph', 'She left at dawn.'],
    ]);
  });
});

describe('reformatting what was never typed', () => {
  it('re-reads plain action and leaves styled lines alone', () => {
    const elements = [
      { type: 'scene_heading' as const, text: 'INT. LIGHTHOUSE - NIGHT' },
      { type: 'action' as const, text: 'MIKE\nShe was here.' },
      { type: 'dialogue' as const, text: 'Nobody is here.' },
    ];
    expect(reformatUntyped(elements, 'screenplay').map((element) => [element.type, element.text])).toEqual([
      // The heading and the dialogue were the writer's; they are untouched.
      ['scene_heading', 'INT. LIGHTHOUSE - NIGHT'],
      ['character', 'MIKE'],
      ['dialogue', 'She was here.'],
      ['dialogue', 'Nobody is here.'],
    ]);
  });

  it('can be run twice with nothing further happening', () => {
    const once = reformatUntyped([{ type: 'action', text: 'INT. BAR - DAY' }], 'screenplay');
    const twice = reformatUntyped(once, 'screenplay');
    expect(once).toEqual([{ type: 'scene_heading', text: 'INT. BAR - DAY', from: 0 }]);
    expect(twice.map((element) => [element.type, element.text])).toEqual([['scene_heading', 'INT. BAR - DAY']]);
  });

  it('says where each element came from, so identity survives the reformat', () => {
    const elements = [
      { type: 'action' as const, text: 'MIKE\nShe was here.' },
      { type: 'dialogue' as const, text: 'Nobody is here.' },
    ];
    // The cue reuses the element it was read out of; the speech under it is
    // new; the dialogue that was already typed keeps its own place.
    expect(reformatUntyped(elements, 'screenplay').map((element) => element.from)).toEqual([0, undefined, 1]);
  });
});
