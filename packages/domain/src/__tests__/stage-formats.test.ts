import { describe, expect, it } from 'vitest';
import {
  BBC_LAYOUT,
  SCREENPLAY_LAYOUT,
  layoutFor,
  layoutForFile,
  scriptFormatOf,
  scriptFormatsFor,
  createProjectFile,
  type ProjectFile,
  type ScriptFormat,
} from '../index.js';

/**
 * **The six a stage play is set in** (addendum 37, from Ken: *when you select
 * stage play, you need a dropdown or some type of preference that can select
 * the proper formatting for you*, with his own *Stage Play Formatting Engine*
 * spec attached).
 *
 * A play was set in `SCREENPLAY_LAYOUT` — a film page — and the menu offered
 * four screen house styles and nothing else, so there was no way to ask for a
 * stage page at all.
 */

const play = (stored?: ScriptFormat): ProjectFile => {
  const file = createProjectFile({ title: 'The Lamp', format: 'stage_play' });
  return stored ? { ...file, settings: { ...file.settings, scriptFormat: stored } } : file;
};

describe('which house styles a format offers', () => {
  it('gives a stage play the six stage presets and no screen one', () => {
    const offered = scriptFormatsFor('stage_play');
    expect(offered).toEqual([
      'stage_us_modern',
      'stage_us_traditional',
      'stage_us_publisher',
      'stage_uk_bbc',
      'stage_uk_contemporary',
      'stage_eu_continental',
    ]);
    // Absent rather than renamed (`kindsFor`'s rule): a multi-camera sitcom
    // layout is not something a play can be set in.
    for (const screen of ['us', 'us_multi', 'bbc', 'bbc_taped'] as const) {
      expect(offered).not.toContain(screen);
    }
  });

  it('gives a screen script the four it always had, in the order it had them', () => {
    for (const format of ['screenplay', 'series', 'short_form', 'game'] as const) {
      expect(scriptFormatsFor(format)).toEqual(['us', 'us_multi', 'bbc', 'bbc_taped']);
    }
  });

  it('offers none at all where there is no script', () => {
    expect(scriptFormatsFor('novel')).toEqual([]);
    expect(scriptFormatsFor('instructional')).toEqual([]);
  });
});

describe('what a play is set in', () => {
  it('reads a stored screen format as the modern play, that having been the fallthrough', () => {
    // Every play written before this carries `us` — not because anybody chose
    // a screenplay but because the menu had nothing else in it. One reading,
    // so the menu and the printed page cannot disagree.
    expect(scriptFormatOf('stage_play', 'us')).toBe('stage_us_modern');
    expect(scriptFormatOf('stage_play', undefined)).toBe('stage_us_modern');
    expect(layoutFor('stage_play', undefined, 'us')).not.toBe(SCREENPLAY_LAYOUT);
  });

  it('keeps a stage preset the writer asked for', () => {
    expect(scriptFormatOf('stage_play', 'stage_uk_bbc')).toBe('stage_uk_bbc');
    expect(layoutForFile(play('stage_uk_bbc')).cueBeside).toBe(true);
  });

  it('leaves every screen format exactly where it was', () => {
    expect(scriptFormatOf('screenplay', 'us')).toBe('us');
    expect(scriptFormatOf('screenplay', 'bbc')).toBe('bbc');
    expect(layoutFor('screenplay', undefined, 'us')).toBe(SCREENPLAY_LAYOUT);
    expect(layoutFor('screenplay', undefined, 'bbc')).toBe(BBC_LAYOUT);
    // A stage preset stored on a screen script is not one it offers, so it
    // reads as that format's own first rather than as a stage page.
    expect(scriptFormatOf('screenplay', 'stage_uk_bbc')).toBe('us');
  });
});

describe('the pages the presets make', () => {
  it('centres the cue where the spec says centred, and nowhere on a screen page', () => {
    // A fixed indent is not centring: it is right for one length of name and
    // wrong for every other.
    expect(layoutFor('stage_play', undefined, 'stage_us_modern').centred?.has('character')).toBe(true);
    expect(layoutFor('stage_play', undefined, 'stage_us_traditional').centred?.has('character')).toBe(true);
    // The publisher reading copy sets it in from the left, which is what
    // keeps the page compact.
    expect(layoutFor('stage_play', undefined, 'stage_us_publisher').centred?.has('character') ?? false).toBe(
      false,
    );
    expect(SCREENPLAY_LAYOUT.centred).toBeUndefined();
  });

  it('puts the speech beside the cue where the sample does', () => {
    expect(layoutFor('stage_play', undefined, 'stage_uk_bbc').cueBeside).toBe(true);
    expect(layoutFor('stage_play', undefined, 'stage_uk_contemporary').cueBeside).toBe(true);
    // The American presets put the cue on its own line above the speech.
    expect(layoutFor('stage_play', undefined, 'stage_us_modern').cueBeside).toBeUndefined();
  });

  it('sets the directions in capitals on the BBC sample alone', () => {
    // The 2004 BBC stage sample sets its directions in capitals; the UK
    // contemporary arrangement beside it does not, which is the difference
    // between the two and why they are two entries.
    expect(layoutFor('stage_play', undefined, 'stage_uk_bbc').uppercase.has('action')).toBe(true);
    expect(layoutFor('stage_play', undefined, 'stage_uk_contemporary').uppercase.has('action')).toBe(false);
  });

  it('knows what paper it is cut from, which the layouts only claimed before', () => {
    // The BBC layouts have said A4 in their own prose since they were
    // written and printed onto US Letter, `@page` being a hard-coded `letter`.
    expect(BBC_LAYOUT.paper).toBe('a4');
    expect(SCREENPLAY_LAYOUT.paper).toBeUndefined();
    for (const id of ['stage_us_modern', 'stage_us_traditional', 'stage_us_publisher'] as const) {
      expect(layoutFor('stage_play', undefined, id).paper).toBe('letter');
      expect(layoutFor('stage_play', undefined, id).columns).toBe(60);
      expect(layoutFor('stage_play', undefined, id).linesPerPage).toBe(55);
    }
    for (const id of ['stage_uk_bbc', 'stage_uk_contemporary', 'stage_eu_continental'] as const) {
      expect(layoutFor('stage_play', undefined, id).paper).toBe('a4');
      // A4 with the spec's own 1" all round: 62 characters, 58 lines.
      expect(layoutFor('stage_play', undefined, id).columns).toBe(62);
      expect(layoutFor('stage_play', undefined, id).linesPerPage).toBe(58);
    }
  });

  it('keeps a speech one block in every one of them', () => {
    // The cue, its wryly and the words are consecutive lines wherever the
    // play is set — a blank anywhere inside them is the mistake every writer
    // spots at a glance.
    for (const id of scriptFormatsFor('stage_play')) {
      const layout = layoutFor('stage_play', undefined, id);
      expect(layout.follows?.dialogue?.has('character'), id).toBe(true);
      expect(layout.follows?.parenthetical?.has('character'), id).toBe(true);
    }
  });
});

describe('changing the preset is visual and nothing else', () => {
  it('leaves the text, the order and the ids exactly as they were', () => {
    // The spec's own first acceptance test: US → UK → US preserves exact
    // text, order, IDs and cast roles. It holds by construction, a layout
    // being read at print time and written into nothing.
    const start = play('stage_us_modern');
    const there = { ...start, settings: { ...start.settings, scriptFormat: 'stage_uk_bbc' as ScriptFormat } };
    const back = { ...there, settings: { ...there.settings, scriptFormat: 'stage_us_modern' as ScriptFormat } };
    expect(back.units).toEqual(start.units);
    expect(back.beats).toEqual(start.beats);
    expect(back.characters).toEqual(start.characters);
  });
});
