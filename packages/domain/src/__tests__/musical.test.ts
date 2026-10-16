import { describe, expect, it } from 'vitest';
import {
  SCREENPLAY_LAYOUT,
  STAGE_US_MUSICAL_LAYOUT,
  cycleFor,
  elementTypesFor,
  layoutFor,
  manuscriptElementSchema,
  onTab,
  paginateElements,
  scriptFormatsFor,
  styleShortcuts,
  typeOnEnter,
  type ManuscriptElement,
  type ManuscriptElementType,
} from '../index.js';

/**
 * **The musical** (addendum 38 §1–§3): the preset addendum 37 named and did
 * not build, because a preset promising lyrics over a manuscript with no lyric
 * element would be a control that lies.
 */

let next = 0;
const el = (type: ManuscriptElementType, text: string): ManuscriptElement =>
  manuscriptElementSchema.parse({ id: `00000000-0000-4000-8000-${String((next += 1)).padStart(12, '0')}`, type, text });

describe('what a musical can hold', () => {
  it('offers a stage play the four and a screenplay none of them', () => {
    const stage = elementTypesFor('stage_play');
    for (const type of ['song_title', 'lyric', 'music_cue', 'dance'] as const) {
      expect(stage).toContain(type);
      expect(elementTypesFor('screenplay')).not.toContain(type);
      expect(elementTypesFor('novel')).not.toContain(type);
    }
  });

  it('accepts them in the stored manuscript', () => {
    expect(() => el('lyric', 'I could have danced all night')).not.toThrow();
  });

  it('puts them at the end of the ring, so Tab from action to a cue is what it was', () => {
    const ring = cycleFor('stage_play');
    expect(ring.slice(0, cycleFor('screenplay').length)).toEqual([...cycleFor('screenplay')]);
    expect(ring).toContain('lyric');
    expect(cycleFor('screenplay')).not.toContain('lyric');
  });
});

describe('the keys in a song', () => {
  it('goes on to the next line of the verse on Return', () => {
    expect(typeOnEnter('stage_play', 'lyric')).toBe('lyric');
    // A number's title is followed by who sings it.
    expect(typeOnEnter('stage_play', 'song_title')).toBe('character');
    expect(typeOnEnter('stage_play', 'dance')).toBe('action');
  });

  it('turns a sung line into a spoken one on Tab', () => {
    expect(onTab('stage_play', 'lyric')).toEqual({ type: 'dialogue', newLine: false });
  });

  it('gives a lyric the free number on a play and nowhere else', () => {
    expect(styleShortcuts('stage_play')['8']).toBe('lyric');
    expect(styleShortcuts('screenplay')['8']).toBeUndefined();
  });
});

describe('the musical preset', () => {
  it('is offered to a stage play, last, and to nothing else', () => {
    expect(scriptFormatsFor('stage_play').at(-1)).toBe('stage_us_musical');
    expect(scriptFormatsFor('screenplay')).not.toContain('stage_us_musical');
    expect(layoutFor('stage_play', undefined, 'stage_us_musical')).toBe(STAGE_US_MUSICAL_LAYOUT);
    // Stored on a screenplay it is not one that format offers.
    expect(layoutFor('screenplay', undefined, 'stage_us_musical')).toBe(SCREENPLAY_LAYOUT);
  });

  it('sets the lyrics in capitals in a narrower column inside the speech', () => {
    const layout = STAGE_US_MUSICAL_LAYOUT;
    expect(layout.uppercase.has('lyric')).toBe(true);
    expect(layout.uppercase.has('dialogue')).toBe(false);
    expect(layout.indent['lyric']).toBeGreaterThan(layout.indent['dialogue'] ?? 0);
    expect(layout.width['lyric']).toBeLessThan(layout.width['dialogue'] ?? 0);
    expect(layout.centred?.has('song_title')).toBe(true);
  });

  it('prints a number as one block under its cue, keeping the verse’s line breaks', () => {
    const [page] = paginateElements(
      [
        el('song_title', '#3 — Out of the Rain'),
        el('character', 'Sarah'),
        el('lyric', 'Out of the rain\nand into the light'),
        el('dialogue', 'You hear it too?'),
        el('dance', 'They waltz to the door.'),
      ],
      STAGE_US_MUSICAL_LAYOUT,
    );
    const lines = (page?.lines ?? []).map((line) => [line.type, line.text, line.indent] as const);
    expect(lines).toEqual([
      ['song_title', '#3 — OUT OF THE RAIN', 0],
      ['blank', '', 0],
      ['character', 'SARAH', 0],
      ['lyric', 'OUT OF THE RAIN', 10],
      ['lyric', 'AND INTO THE LIGHT', 10],
      ['dialogue', 'You hear it too?', 0],
      ['blank', '', 0],
      ['dance', 'They waltz to the door.', 15],
    ]);
  });

  it('carries a long song over the page under the singer’s name', () => {
    const verse = Array.from({ length: 80 }, (_, line) => `line ${line + 1} of the song`).join('\n');
    const pages = paginateElements([el('character', 'Sarah'), el('lyric', verse)], STAGE_US_MUSICAL_LAYOUT, () => null);
    expect(pages.length).toBeGreaterThan(1);
    expect(pages[0]?.lines.at(-1)?.type).toBe('more');
    expect(pages[1]?.lines[0]).toMatchObject({ type: 'continued', text: "SARAH (CONT'D)" });
  });
});

describe('a song in a play set in another house style', () => {
  it('has a place on every stage layout, derived from the layout’s own columns', () => {
    for (const id of scriptFormatsFor('stage_play')) {
      const layout = layoutFor('stage_play', undefined, id);
      for (const type of ['song_title', 'lyric', 'music_cue', 'dance']) {
        expect(layout.indent[type], `${id} ${type}`).toBeTypeOf('number');
        expect(layout.width[type], `${id} ${type}`).toBeGreaterThan(0);
      }
      // A lyric is never wider than the speech it belongs to.
      expect(layout.width['lyric'] ?? 0, id).toBeLessThanOrEqual(layout.width['dialogue'] ?? 0);
      expect(layout.follows?.lyric?.has('character'), id).toBe(true);
    }
  });

  it('writes a lyric beside the cue where the speech is beside it', () => {
    const layout = layoutFor('stage_play', undefined, 'stage_uk_bbc');
    const [page] = paginateElements([el('character', 'Sarah'), el('lyric', 'Out of the rain')], layout);
    expect(page?.lines[0]?.text.startsWith('SARAH')).toBe(true);
    expect(page?.lines[0]?.text.endsWith('OUT OF THE RAIN')).toBe(true);
  });
});
