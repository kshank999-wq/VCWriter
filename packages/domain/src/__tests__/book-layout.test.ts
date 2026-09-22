import { describe, expect, it } from 'vitest';
import {
  TRIM_PRESETS,
  addBeat,
  bookBlocks,
  bookNames,
  bookSettingsOf,
  createProjectFile,
  defaultTrimFor,
  derivedLeading,
  LEAST_INSIDE,
  LEAST_OUTSIDE,
  derivedMargins,
  describeGeometry,
  describeSpine,
  describeTrim,
  estimatedPages,
  geometryOf,
  gutterFor,
  measureWarning,
  setBookSettings,
  setTitlePage,
  trimOf,
  trimPresetOf,
  unitsInStoryOrder,
  updateBeat,
} from '../index.js';

/**
 * The trim size and everything worked out from it (addendum 20 §3).
 *
 * The claim is that entering a trim sets up the page: the margins, the text
 * block, the lines, the measure. So what is tested is that they follow from
 * the trim and the page count, that nothing but an override is stored, and
 * that the sentence says which is which.
 */

const novel = () => createProjectFile({ title: 'The Lamp', format: 'novel' });

describe('what the book is called', () => {
  it('is the writer\u2019s title where they gave one, and the project\u2019s name \u2014 the file\u2019s \u2014 only as the fallback', () => {
    // An imported project is named for the file it came from, and that is
    // what every page carried until the book could be named (\u00a79).
    const file = createProjectFile({ title: 'the-lamp-final-v3', format: 'novel', author: 'M. Shank' });
    expect(bookNames(file)).toEqual({ title: 'the-lamp-final-v3', author: 'M. Shank', imprint: '' });
    const named = setBookSettings(setTitlePage(file, { title: 'The Drowned Bell', author: 'Mara Shank' }), { imprint: 'Lantern Press' });
    expect(bookNames(named)).toEqual({ title: 'The Drowned Bell', author: 'Mara Shank', imprint: 'Lantern Press' });
    // The project keeps its own name: only the book was renamed.
    expect(named.project.title).toBe('the-lamp-final-v3');
    // Spaces are not a title, so the fallback still stands.
    expect(bookNames(setTitlePage(named, { title: '   ' })).title).toBe('the-lamp-final-v3');
  });

  it('is what the running heads carry, in place of the file\u2019s name', () => {
    let file = createProjectFile({ title: 'the-lamp-final-v3', format: 'novel', author: 'M. Shank' });
    const beat = addBeat(file, { unitId: unitsInStoryOrder(file)[0]!.id, title: 'b' });
    file = updateBeat(beat.file, beat.beat.id, {
      manuscript: { elements: [{ id: 'p1' as never, type: 'paragraph', text: 'The lamp.', characterId: null, attributes: {} }] },
    });
    // Before it is named, every page carries the file's name: the bug.
    const before = bookBlocks(file).find((block) => block.kind === 'paragraph')!;
    expect(before.chapterTitle).toBe('the-lamp-final-v3');
    // Named in Book settings, the running head carries the book.
    file = setTitlePage(file, { title: 'The Drowned Bell' });
    const after = bookBlocks(file).find((block) => block.kind === 'paragraph')!;
    expect(after.chapterTitle).toBe('The Drowned Bell');
  });
});

describe('the trim', () => {
  it('is the format’s until somebody chooses one', () => {
    const file = novel();
    expect(trimOf(bookSettingsOf(file), 'novel')).toEqual(defaultTrimFor('novel'));
    expect(defaultTrimFor('instructional')).toEqual({ width: 7, height: 10 });
    expect(defaultTrimFor('novel')).toEqual({ width: 5.5, height: 8.5 });
  });

  it('names a preset it matches, and a custom size in inches', () => {
    expect(trimPresetOf({ width: 6, height: 9 })?.id).toBe('6x9');
    expect(trimPresetOf({ width: 6.5, height: 9 })).toBeNull();
    expect(describeTrim({ width: 6, height: 9 })).toBe('6 × 9 in');
    expect(describeTrim({ width: 6.5, height: 9.25 })).toBe('6½ × 9¼ in');
    expect(TRIM_PRESETS.length).toBeGreaterThan(5);
  });

  it('stores the trim and nothing worked out from it', () => {
    const file = setBookSettings(novel(), { trim: { width: 6, height: 9 } });
    const stored = file.settings.book as Record<string, unknown>;
    expect(stored.trim).toEqual({ width: 6, height: 9 });
    expect(stored.margins).toEqual({ inside: null, outside: null, top: null, bottom: null });
    expect(JSON.stringify(stored)).not.toContain('linesPerPage');
  });
});

describe('the margins', () => {
  it('follow from the trim by proportion, to the sixteenth, and never below the floor', () => {
    const margins = derivedMargins({ width: 6, height: 9 }, 250);
    // The head and the foot are the proportion: nothing binds or is thumbed there.
    expect(margins.top).toBe(0.75);
    expect(margins.bottom).toBe(0.875);
    // The sides are the floor where the proportion falls under it (§3a): a
    // tenth of six inches is 5/8, which is too little for a thumb.
    expect(margins.outside).toBe(LEAST_OUTSIDE);
    expect(margins.inside).toBe(LEAST_OUTSIDE + gutterFor(250));

    // A wide trim keeps the proportion, the floor never being reached.
    const big = derivedMargins({ width: 8.5, height: 11 }, 250);
    expect(big.outside).toBeGreaterThan(LEAST_OUTSIDE);
  });

  it('keeps every trim above the floor at every thickness (§3a, from Ken)', () => {
    for (const trim of [
      { width: 5, height: 8 },
      { width: 5.25, height: 8 },
      { width: 5.5, height: 8.5 },
      { width: 6, height: 9 },
      { width: 5.06, height: 7.81 },
      { width: 7, height: 10 },
    ]) {
      for (const pages of [1, 80, 150, 300, 500, 700, 1200]) {
        const margins = derivedMargins(trim, pages);
        expect(margins.outside).toBeGreaterThanOrEqual(LEAST_OUTSIDE);
        expect(margins.inside).toBeGreaterThanOrEqual(LEAST_INSIDE);
        // The bound edge always clears the open one by the gutter at least.
        expect(margins.inside).toBeGreaterThan(margins.outside);
      }
    }
  });

  it('widen the gutter as the book thickens, with nothing run', () => {
    expect(gutterFor(100)).toBeLessThan(gutterFor(400));
    expect(gutterFor(400)).toBeLessThan(gutterFor(800));
    const thin = derivedMargins({ width: 6, height: 9 }, 100);
    const thick = derivedMargins({ width: 6, height: 9 }, 600);
    expect(thick.inside).toBeGreaterThan(thin.inside);
    expect(thick.outside).toBe(thin.outside);
  });

  it('say what the spine takes and when it next widens, and that a typed inside margin takes the working-out away', () => {
    const settings = bookSettingsOf(novel());
    const thin = describeSpine(geometryOf(settings, 'novel', 120));
    expect(thin).toContain('an extra ⅛ in for the spine, worked out from 120 pages');
    expect(thin).toContain('Past 150 pages it widens to ¼ in by itself.');
    expect(describeSpine(geometryOf(settings, 'novel', 900))).toContain('It is at its widest.');
    const typed = setBookSettings(novel(), { margins: { inside: 1, outside: null, top: null, bottom: null } });
    expect(describeSpine(geometryOf(bookSettingsOf(typed), 'novel', 120))).toContain('The inside margin is typed, so nothing is being added for the spine');
  });

  it('never go under three-eighths, which is what a printer trims to', () => {
    const tiny = derivedMargins({ width: 3, height: 4 }, 50);
    expect(Math.min(tiny.inside, tiny.outside, tiny.top, tiny.bottom)).toBeGreaterThanOrEqual(0.375);
  });

  it('honour an override, and say which edge was typed', () => {
    const file = setBookSettings(novel(), {
      trim: { width: 6, height: 9 },
      margins: { inside: null, outside: 1, top: null, bottom: null },
    });
    const geometry = geometryOf(bookSettingsOf(file), 'novel', 250);
    expect(geometry.margins.outside).toBe(1);
    expect(geometry.overridden).toEqual({ inside: false, outside: true, top: false, bottom: false });
    // The inside is still worked out, and from the derived outside rather
    // than the typed one — so it is the floor plus this thickness's gutter.
    expect(geometry.margins.inside).toBe(LEAST_OUTSIDE + gutterFor(250));
    expect(describeGeometry(geometry, 'old_style')).toContain('outside 1 in (typed)');
    expect(describeGeometry(geometry, 'old_style')).toContain('Margins partly typed');
  });
});

describe('the page', () => {
  it('holds as many lines as the text block over the leading', () => {
    const geometry = geometryOf(bookSettingsOf(novel()), 'novel', 200);
    // 5.5 × 8.5: top 0.6875 + bottom 0.8125 leaves 7 in; 11 on 15 pt is 33 lines.
    expect(geometry.leading).toBe(derivedLeading(11));
    expect(derivedLeading(11)).toBe(15);
    expect(geometry.text.height).toBeCloseTo(7, 5);
    expect(geometry.linesPerPage).toBe(33);
  });

  it('says the measure in characters, and warns when a line is too long or too short', () => {
    const settings = bookSettingsOf(novel());
    const usual = geometryOf(settings, 'novel', 200);
    expect(usual.measure).toBeGreaterThan(50);
    expect(usual.measure).toBeLessThan(75);
    expect(measureWarning(usual)).toBeNull();

    const wide = geometryOf({ ...settings, trim: { width: 8.5, height: 11 }, size: 9 }, 'novel', 200);
    expect(measureWarning(wide)).toMatch(/long line/);

    const narrow = geometryOf({ ...settings, trim: { width: 4, height: 6 }, size: 14 }, 'novel', 200);
    expect(measureWarning(narrow)).toMatch(/short line/);
  });

  it('puts it all in one sentence', () => {
    const geometry = geometryOf(bookSettingsOf(novel()), 'novel', 200);
    const said = describeGeometry(geometry, 'old_style');
    expect(said).toContain('5½ × 8½ in');
    expect(said).toContain('worked out from the trim and 200 pages');
    expect(said).toContain('33 lines of old-style serif at 11 on 15 pt');
  });

  it('guesses a page count before anything is laid, and says so in the name', () => {
    expect(estimatedPages(60_000, 20)).toBe(230);
    expect(estimatedPages(0, 0)).toBe(1);
  });
});
