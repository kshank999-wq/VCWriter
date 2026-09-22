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
  MARGIN_STANDARD,
  derivedMargins,
  insideFor,
  trimClassOf,
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
  /** The trims the standard names, by the row each falls in. */
  it('read the page size rather than a proportion of it (§3b, from Ken)', () => {
    expect(trimClassOf({ width: 4.25, height: 6.87 })).toBe('pocket');
    expect(trimClassOf({ width: 5, height: 8 })).toBe('pocket');
    expect(trimClassOf({ width: 5.06, height: 7.81 })).toBe('pocket'); // B format
    expect(trimClassOf({ width: 5.25, height: 8 })).toBe('digest');
    expect(trimClassOf({ width: 5.5, height: 8.5 })).toBe('digest');
    expect(trimClassOf({ width: 5.83, height: 8.27 })).toBe('digest'); // A5
    expect(trimClassOf({ width: 6, height: 9 })).toBe('trade');
    expect(trimClassOf({ width: 6.14, height: 9.21 })).toBe('trade'); // Royal
    expect(trimClassOf({ width: 7, height: 10 })).toBe('large');
    expect(trimClassOf({ width: 8.5, height: 11 })).toBe('large');
  });

  it('match the published table on each of its three rows', () => {
    // Pocket / mass market: inside 5/8–3/4, outside 1/2, top 1/2, bottom 5/8.
    const pocket = derivedMargins({ width: 5, height: 8 }, 120);
    expect(pocket).toEqual({ inside: 0.625, outside: 0.5, top: 0.5, bottom: 0.625 });
    expect(derivedMargins({ width: 5, height: 8 }, 900).inside).toBe(0.75);

    // Digest / small novel: inside 3/4–7/8, the rest the middle of their ranges.
    const digest = derivedMargins({ width: 5.5, height: 8.5 }, 120);
    expect(digest).toEqual({ inside: 0.75, outside: 0.5625, top: 0.5, bottom: 0.625 });
    expect(derivedMargins({ width: 5.5, height: 8.5 }, 900).inside).toBe(0.875);

    // US trade: inside 3/4 up, outside 5/8, and the standard's own page
    // schedule — 3/4 to 150, its 0.825 (13/16 to the sixteenth) to 300, 7/8 on.
    const trade = (pages: number) => derivedMargins({ width: 6, height: 9 }, pages);
    expect(trade(120)).toEqual({ inside: 0.75, outside: 0.625, top: 0.6875, bottom: 0.8125 });
    expect(trade(250).inside).toBe(0.8125);
    expect(trade(400).inside).toBe(0.875);
  });

  it('keep the standard’s three rules on every trim at every thickness', () => {
    for (const preset of TRIM_PRESETS) {
      for (const pages of [1, 80, 150, 300, 500, 700, 1200]) {
        const margins = derivedMargins(preset, pages);
        // The thumb factor: a fore-edge under half an inch puts a thumb on the words.
        expect(margins.outside).toBeGreaterThanOrEqual(0.5);
        // The gutter: the bound edge always clears the open one.
        expect(margins.inside).toBeGreaterThan(margins.outside);
        // Optical centring: the foot is wider than the head, or the block sinks.
        expect(margins.bottom).toBeGreaterThan(margins.top);
      }
    }
  });

  it('break the head and the foot at 5½ × 8½ rather than by trim row', () => {
    // Up to that size the standard takes the bottom of its own range, to
    // maximise reading space — so pocket and digest share a head and a foot
    // while their sides differ.
    for (const trim of [{ width: 5, height: 8 }, { width: 5.5, height: 8.5 }, { width: 5.83, height: 8.27 }]) {
      const margins = derivedMargins(trim, 250);
      expect(margins.top).toBe(0.5);
      expect(margins.bottom).toBe(0.625);
    }
    // 6 × 9 and larger take the middle, so the block is not swallowed by white.
    const trade = derivedMargins({ width: 6, height: 9 }, 250);
    expect(trade.top).toBe(0.6875);
    expect(trade.bottom).toBe(0.8125);
    expect(derivedMargins({ width: 5, height: 8 }, 250).outside).not.toBe(derivedMargins({ width: 5.5, height: 8.5 }, 250).outside);

    // And every trim stays inside the standard's whole-book ranges.
    for (const preset of TRIM_PRESETS) {
      const margins = derivedMargins(preset, 250);
      if (trimClassOf(preset) === 'large') continue; // extrapolated past the table
      expect(margins.top).toBeGreaterThanOrEqual(0.5);
      expect(margins.top).toBeLessThanOrEqual(0.75);
      expect(margins.bottom).toBeGreaterThanOrEqual(0.625);
      expect(margins.bottom).toBeLessThanOrEqual(0.875);
    }
  });

  it('keep a running head and a folio a quarter inch clear of the paper’s edge', () => {
    // The printer's trim takes anything nearer, so this is the one rule about
    // the head that is about what sits *inside* the margin rather than its
    // depth. `headFromTop` is the near side of the line, not a baseline: the
    // head is set solid and positioned by its box, so it is the clear space.
    const settings = bookSettingsOf(novel());
    for (const preset of TRIM_PRESETS) {
      for (const pages of [1, 250, 1200]) {
        const geometry = geometryOf({ ...settings, trim: preset }, 'novel', pages);
        expect(geometry.headFromTop).toBeGreaterThanOrEqual(0.25);
        expect(geometry.footFromBottom).toBeGreaterThanOrEqual(0.25);
        // And it sits inside the margin rather than over the text block.
        expect(geometry.headFromTop).toBeLessThan(geometry.margins.top);
        expect(geometry.footFromBottom).toBeLessThan(geometry.margins.bottom);
      }
    }
    // A typed margin too shallow to hold one still clears the edge.
    const shallow = setBookSettings(novel(), { margins: { inside: null, outside: null, top: 0.3, bottom: 0.3 } });
    const geometry = geometryOf(bookSettingsOf(shallow), 'novel', 250);
    expect(geometry.headFromTop).toBe(0.25);
    expect(geometry.footFromBottom).toBe(0.25);
  });

  it('widen the gutter as the book thickens, and never past the band', () => {
    const trim = { width: 6, height: 9 };
    expect(insideFor(trim, 100)).toBeLessThan(insideFor(trim, 400));
    expect(insideFor(trim, 400)).toBeLessThan(insideFor(trim, 800));
    expect(insideFor(trim, 800)).toBe(MARGIN_STANDARD.trade.insideMost);
    // A pocket book's band is the narrowest, so it tops out soonest — a fifth
    // of a 4¼ in page on each side is what the old flat floor cost it.
    const pocketTrim = { width: 5, height: 8 };
    expect(insideFor(pocketTrim, 800)).toBe(MARGIN_STANDARD.pocket.insideMost);
    expect(insideFor(pocketTrim, 800)).toBeLessThan(insideFor(trim, 800));
    // The fore-edge is a fact about the trim alone and never moves with the count.
    expect(derivedMargins(trim, 100).outside).toBe(derivedMargins(trim, 900).outside);
  });

  it('say which standard is in force, what the spine takes, and when it next widens', () => {
    const settings = bookSettingsOf(novel()); // 5½ × 8½, a digest
    const thin = describeSpine(geometryOf(settings, 'novel', 120));
    expect(thin).toContain('The standard for a digest paperback puts the inside margin between ¾ and ⅞ in.');
    expect(thin).toContain('At 120 pages it is ¾ in, which is 3/16 in more than the fore-edge for the spine');
    expect(thin).toContain('Past 150 pages it widens to 13/16 in by itself.');
    expect(describeSpine(geometryOf(settings, 'novel', 900))).toContain('It is as wide as the standard takes it.');
    const typed = setBookSettings(novel(), { margins: { inside: 1, outside: null, top: null, bottom: null } });
    expect(describeSpine(geometryOf(bookSettingsOf(typed), 'novel', 120))).toContain('The inside margin is typed, so nothing is being added for the spine');
  });

  it('give a page larger than the standard describes a fore-edge to match', () => {
    // The table's widest row is a workbook; a custom trim past that would take
    // a workbook's margins and look starved, so the sides grow with the paper
    // — and the gutter grows with them rather than being eaten by them.
    const huge = derivedMargins({ width: 11, height: 17 }, 250);
    expect(huge.outside).toBeGreaterThan(MARGIN_STANDARD.large.outside);
    expect(huge.inside - huge.outside).toBe(
      insideFor({ width: 11, height: 17 }, 250) - MARGIN_STANDARD.large.outside,
    );
    // And it bites on nothing in the list.
    for (const preset of TRIM_PRESETS) {
      expect(derivedMargins(preset, 250).outside).toBe(MARGIN_STANDARD[trimClassOf(preset)].outside);
    }
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
    // The inside is still worked out, and from the standard rather than from
    // the typed outside — a typed edge is one edge and not a new rule.
    expect(geometry.margins.inside).toBe(insideFor({ width: 6, height: 9 }, 250));
    expect(describeGeometry(geometry, 'old_style')).toContain('outside 1 in (typed)');
    expect(describeGeometry(geometry, 'old_style')).toContain('Margins partly typed');
  });
});

describe('the page', () => {
  it('holds as many lines as the text block over the leading', () => {
    const geometry = geometryOf(bookSettingsOf(novel()), 'novel', 200);
    // 5.5 × 8.5 is a digest: top ½ + bottom ⅝ leaves 7⅜ in, and 11 on 15 pt
    // is 35 lines. At this size and under, the standard takes the bottom of
    // its head and foot ranges to maximise the reading space — two lines more
    // than the proportion that stood here before.
    expect(geometry.leading).toBe(derivedLeading(11));
    expect(derivedLeading(11)).toBe(15);
    expect(geometry.text.height).toBeCloseTo(7.375, 5);
    expect(geometry.linesPerPage).toBe(35);
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
    expect(said).toContain('35 lines of old-style serif at 11 on 15 pt');
  });

  it('guesses a page count before anything is laid, and says so in the name', () => {
    expect(estimatedPages(60_000, 20)).toBe(230);
    expect(estimatedPages(0, 0)).toBe(1);
  });
});
