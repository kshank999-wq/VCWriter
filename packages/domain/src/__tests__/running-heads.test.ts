import { describe, expect, it } from 'vitest';
import {
  FOLIO_PLACE_WORDS,
  HEAD_CONTENTS,
  bookSettingsOf,
  bookSettingsSchema,
  createProjectFile,
  headSideClass,
  headTextFor,
  runningHeadStyleOf,
  runningStyleVars,
  setBookSettings,
  showsFolio,
  type BookSettings,
} from '../index.js';

/**
 * The running heads and the folios (addendum 20 §7a, from Ken: *the running
 * headers and footers need to be adjustable*).
 *
 * What is tested is the three things that were not adjustable: what a head
 * says (one list for both sides, and the writer's own words), how it is set
 * (a `LineStyle` each, defaulting to exactly what the stylesheet printed),
 * and whether there is a page number at all.
 */

const settingsOf = (patch: Partial<BookSettings>): BookSettings =>
  bookSettingsOf(setBookSettings(createProjectFile({ title: 'The Lamp', format: 'novel' }), patch));

const NAMES = { title: 'The Drowned Bell', author: 'Mara Shank' };

describe('what a running head says', () => {
  it('offers one list to both sides, where there were two that differed', () => {
    // The verso could not carry the chapter and the recto could not carry the
    // author, and neither side could say why.
    expect([...HEAD_CONTENTS]).toEqual(['author', 'title', 'chapter', 'custom', 'none']);
    const settings = settingsOf({ runningHeads: { verso: 'chapter', recto: 'author', versoText: '', rectoText: '', place: 'centre' } });
    expect(headTextFor('verso', settings, NAMES, 'The House')).toBe('The House');
    expect(headTextFor('recto', settings, NAMES, 'The House')).toBe('Mara Shank');
  });

  it('carries the writer’s own words, which nothing else could say', () => {
    const settings = settingsOf({
      runningHeads: { verso: 'custom', recto: 'custom', versoText: '  A Lantern Press Book  ', rectoText: 'Part One', place: 'centre' },
    });
    // Trimmed, and never cased here — the case is the style's.
    expect(headTextFor('verso', settings, NAMES, 'The House')).toBe('A Lantern Press Book');
    expect(headTextFor('recto', settings, NAMES, 'The House')).toBe('Part One');
  });

  it('says nothing where the side carries nothing, or where custom words were never typed', () => {
    const none = settingsOf({ runningHeads: { verso: 'none', recto: 'none', versoText: 'x', rectoText: 'x', place: 'centre' } });
    expect(headTextFor('verso', none, NAMES, 'The House')).toBe('');
    const empty = settingsOf({ runningHeads: { verso: 'custom', recto: 'custom', versoText: '', rectoText: '   ', place: 'centre' } });
    expect(headTextFor('verso', empty, NAMES, 'The House')).toBe('');
    expect(headTextFor('recto', empty, NAMES, 'The House')).toBe('');
  });

  it('defaults to what the book always did', () => {
    const settings = bookSettingsSchema.parse({});
    expect(settings.runningHeads.verso).toBe('author');
    expect(settings.runningHeads.recto).toBe('chapter');
    expect(settings.runningHeads.place).toBe('centre');
  });
});

describe('where a running head sits', () => {
  it('hangs on the outer or the inner edge, which side being read from the page', () => {
    // The outside of a verso is its left edge; of a recto, its right.
    expect(headSideClass('outside', 'verso')).toBe('left');
    expect(headSideClass('outside', 'recto')).toBe('right');
    expect(headSideClass('inside', 'verso')).toBe('right');
    expect(headSideClass('inside', 'recto')).toBe('left');
    expect(headSideClass('centre', 'verso')).toBe('centre');
    expect(headSideClass('centre', 'recto')).toBe('centre');
  });
});

describe('how the furniture is set', () => {
  it('starts as exactly what the stylesheet printed, so an older book is unchanged', () => {
    const style = runningHeadStyleOf(bookSettingsSchema.parse({}));
    // Capitals tracked open on the verso, italic on the recto: the difference
    // was hard-coded and is now a default somebody can see and change.
    expect(style.verso.case).toBe('capitals');
    expect(style.verso.tracking).toBe(12);
    expect(style.verso.italic).toBe(false);
    expect(style.recto.italic).toBe(true);
    expect(style.recto.case).toBe('as_typed');
    expect(style.face).toBe('book');
  });

  it('gives each of the three its own properties, and the book’s face where it says book', () => {
    const vars = runningStyleVars(runningHeadStyleOf(bookSettingsSchema.parse({})), 'sans');
    expect(vars['--bk-run-face']).toContain('Helvetica');
    expect(vars['--bk-run-verso-case']).toBe('uppercase');
    expect(vars['--bk-run-verso-tracking']).toBe('0.12em');
    expect(vars['--bk-run-recto-style']).toBe('italic');
    expect(vars['--bk-run-folio-size']).toBe('9pt');
    // A face chosen for the furniture alone overrides the book's.
    const own = runningStyleVars(runningHeadStyleOf(settingsOf({ runningHeadStyle: { face: 'modern' } })), 'sans');
    expect(own['--bk-run-face']).toContain('Didot');
  });

  it('keeps what the writer set, and reads the rest as the default', () => {
    const settings = settingsOf({ runningHeadStyle: { verso: { size: 7, case: 'small_caps', bold: true, italic: false, tracking: 4 } } });
    const style = runningHeadStyleOf(settings);
    expect(style.verso).toEqual({ size: 7, case: 'small_caps', bold: true, italic: false, tracking: 4 });
    // Untouched, so still the default.
    expect(style.recto.italic).toBe(true);
    const vars = runningStyleVars(style, 'old_style');
    expect(vars['--bk-run-verso-variant']).toBe('small-caps');
    expect(vars['--bk-run-verso-case']).toBe('none');
    expect(vars['--bk-run-verso-weight']).toBe('700');
  });
});

describe('the page numbers', () => {
  it('can be turned off altogether, which there was no way to say', () => {
    expect(showsFolio('foot_outside')).toBe(true);
    expect(showsFolio('foot_centre')).toBe(true);
    expect(showsFolio('head_outside')).toBe(true);
    expect(showsFolio('none')).toBe(false);
    expect(FOLIO_PLACE_WORDS.none).toBe('No page numbers');
  });
});
