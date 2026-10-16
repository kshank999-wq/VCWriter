import { describe, expect, it } from 'vitest';
import {
  STAGE_UK_BBC_LAYOUT,
  STAGE_US_MODERN_LAYOUT,
  applyCustomTemplate,
  applyFormatOverrides,
  createProjectFile,
  elementGeometry,
  hasFormatOverrides,
  layoutForFile,
  libraryOf,
  printedPageCount,
  restoreFormatDefaults,
  savedIntoLibrary,
  setElementOverride,
  setScriptFormat,
  templateFits,
  templateFromFile,
  updateBeat,
  type ProjectFile,
} from '../index.js';

/**
 * **Custom templates** (addendum 39, the spec's §1 and §7): the override
 * inspector, Restore defaults, and Save as custom template.
 */

const play = (): ProjectFile => setScriptFormat(createProjectFile({ title: 'The Lamp', format: 'stage_play' }), 'stage_us_modern');

describe('a change to one element', () => {
  it('changes that field of that element and nothing else', () => {
    const file = setElementOverride(play(), 'character', { indent: 20, width: 30, centred: false });
    const layout = layoutForFile(file);
    expect(layout.indent['character']).toBe(20);
    expect(layout.width['character']).toBe(30);
    expect(layout.centred?.has('character')).toBe(false);
    // Everything else is the preset's.
    expect(layout.indent['dialogue']).toBe(STAGE_US_MODERN_LAYOUT.indent['dialogue']);
    expect(layout.centred?.has('scene_heading')).toBe(true);
    expect(layout.paper).toBe('letter');
  });

  it('never touches the bundled preset', () => {
    setElementOverride(play(), 'action', { indent: 2, uppercase: true });
    expect(STAGE_US_MODERN_LAYOUT.indent['action']).toBe(15);
    expect(STAGE_US_MODERN_LAYOUT.uppercase.has('action')).toBe(false);
  });

  it('keeps an element inside the column however far it is pushed', () => {
    const layout = applyFormatOverrides(STAGE_US_MODERN_LAYOUT, { templateName: '', elements: { action: { indent: 50, width: 40 } } });
    expect((layout.indent['action'] ?? 0) + (layout.width['action'] ?? 0)).toBeLessThanOrEqual(layout.columns);
  });

  it('stores a value equal to the preset’s as nothing', () => {
    const moved = setElementOverride(play(), 'action', { indent: 20 });
    expect(hasFormatOverrides(moved)).toBe(true);
    const back = setElementOverride(moved, 'action', { indent: 15 });
    expect(hasFormatOverrides(back)).toBe(false);
    expect(elementGeometry(back).find((row) => row.type === 'action')?.changed).toEqual([]);
  });

  it('says which rows were changed, and what the preset had', () => {
    const row = elementGeometry(setElementOverride(play(), 'dialogue', { width: 40 })).find((one) => one.type === 'dialogue');
    expect(row).toMatchObject({ width: 40, preset: { width: 60 }, changed: ['width'] });
  });

  it('changes the page count, the print reading the same layout', () => {
    const long = Array.from({ length: 60 }, (_, at) => ({
      id: crypto.randomUUID() as never,
      type: 'dialogue' as never,
      text: `Line ${at} of a speech that runs on for a while and wraps.`,
      characterId: null,
      attributes: {},
    }));
    const start = play();
    const file = updateBeat(start, start.beats[0]!.id, { manuscript: { elements: long } });
    const narrow = setElementOverride(file, 'dialogue', { width: 20 });
    expect(printedPageCount(narrow)).toBeGreaterThan(printedPageCount(file));
  });

  it('leaves a script with no changes on the shared layout object', () => {
    expect(layoutForFile(play())).toBe(STAGE_US_MODERN_LAYOUT);
  });
});

describe('restore defaults', () => {
  it('is the preset exactly as bundled', () => {
    const changed = setElementOverride(setElementOverride(play(), 'action', { indent: 2 }), 'lyric', { uppercase: false });
    const restored = restoreFormatDefaults(changed);
    expect(hasFormatOverrides(restored)).toBe(false);
    expect(layoutForFile(restored)).toBe(STAGE_US_MODERN_LAYOUT);
  });
});

describe('a saved template', () => {
  it('is the preset’s name and the writer’s changes, and carries them to another play', () => {
    const source = setElementOverride(setScriptFormat(play(), 'stage_uk_bbc'), 'dialogue', { indent: 18 });
    const template = templateFromFile(source, 'Lyric Theatre house', 't1', '2026-10-16T00:00:00Z');
    expect(template).toMatchObject({ base: 'stage_uk_bbc', name: 'Lyric Theatre house', elements: { dialogue: { indent: 18 } } });

    const other = applyCustomTemplate(play(), template);
    expect(other.settings.scriptFormat).toBe('stage_uk_bbc');
    expect(other.settings.formatOverrides.templateName).toBe('Lyric Theatre house');
    expect(layoutForFile(other).indent['dialogue']).toBe(18);
    expect(layoutForFile(other).cueBeside).toBe(STAGE_UK_BBC_LAYOUT.cueBeside);
  });

  it('is offered only where its preset is', () => {
    const template = templateFromFile(play(), 'Mine', 't1', '');
    expect(templateFits(play(), template)).toBe(true);
    const film = createProjectFile({ title: 'Film', format: 'screenplay' });
    expect(templateFits(film, template)).toBe(false);
    expect(() => applyCustomTemplate(film, template)).toThrow();
  });

  it('saved under a name already in the library replaces it, keeping its place', () => {
    const one = templateFromFile(play(), 'House', 'a', '');
    const two = templateFromFile(play(), 'Other', 'b', '');
    const again = templateFromFile(setElementOverride(play(), 'action', { indent: 3 }), 'house', 'c', '');
    const library = savedIntoLibrary(savedIntoLibrary(savedIntoLibrary([], one), two), again);
    expect(library.map((t) => [t.id, t.name])).toEqual([
      ['a', 'house'],
      ['b', 'Other'],
    ]);
    expect(library[0]?.elements['action']).toEqual({ indent: 3 });
  });

  it('reads a library from storage and drops what it cannot read', () => {
    expect(libraryOf([{ id: 'a', name: 'Ok', base: 'stage_us_modern' }, { nonsense: true }, 'x']).map((t) => t.name)).toEqual(['Ok']);
    expect(libraryOf(null)).toEqual([]);
  });
});
