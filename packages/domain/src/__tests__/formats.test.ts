import { describe, expect, it } from 'vitest';
import {
  contentsDivisions,
  createProjectFile,
  defaultElementType,
  defaultMarkerKind,
  defaultUnitKind,
  elementTypesFor,
  hasBookIndex,
  hasChapterPages,
  isInstructional,
  isProseFormat,
  nounsFor,
  type ProjectFormat,
} from '../index.js';

/**
 * Formats, and the two readings every surface takes them through (addendum 16).
 *
 * The point of this file is **regression, not novelty**. `format === 'novel' ||
 * format === 'short_story'` was written out in twelve places, one of which had
 * already drifted, and adding a third prose format meant finding and agreeing
 * with all twelve. These tests hold the two readings to the behaviour the
 * twelve had, so a fourth prose format is one entry in one table.
 */

const EVERY_FORMAT: ProjectFormat[] = [
  'screenplay',
  'series',
  'novel',
  'stage_play',
  'short_story',
  'short_form',
  'instructional',
  'other',
];

describe('what a format is', () => {
  it('calls prose prose, and a script a script', () => {
    expect(EVERY_FORMAT.filter(isProseFormat)).toEqual(['novel', 'short_story', 'instructional']);
  });

  it('separates instructional from every other prose format', () => {
    // The only question an instructional feature should ever ask.
    expect(EVERY_FORMAT.filter(isInstructional)).toEqual(['instructional']);
    expect(isProseFormat('instructional')).toBe(true);
  });

  it('gives an instructional book a novel’s machinery, unchanged', () => {
    // It is prose with chapters. What differs is what goes in them.
    expect(defaultUnitKind('instructional')).toBe(defaultUnitKind('novel'));
    expect(defaultElementType('instructional')).toBe(defaultElementType('novel'));
    expect(elementTypesFor('instructional')).toEqual(elementTypesFor('novel'));
    expect(defaultMarkerKind('instructional')).toBe(defaultMarkerKind('novel'));
    expect(hasChapterPages('instructional')).toBe(hasChapterPages('novel'));
    expect(hasBookIndex('instructional')).toBe(hasBookIndex('novel'));
  });

  it('kept a short story exactly as it was', () => {
    // The refactor's one real risk: a predicate narrowed while being tidied.
    expect(isProseFormat('short_story')).toBe(true);
    expect(defaultUnitKind('short_story')).toBe('chapter');
    expect(hasBookIndex('short_story')).toBe(true);
    expect(hasChapterPages('short_story')).toBe(true);
    expect(defaultElementType('short_story')).toBe('paragraph');
  });

  it('lays a short story out as prose, which it did not before', () => {
    // `render.ts` asked `format !== 'novel'`, so a short story was drawn with
    // screenplay geometry. One predicate is what fixed it.
    expect(isProseFormat('short_story')).toBe(true);
    expect(isProseFormat('screenplay')).toBe(false);
  });
});

describe('what a format calls its parts', () => {
  it('never says Scene, Beat or Script in a book', () => {
    // §14: a writer in Book Mode must not have to work around screenplay
    // words. Nothing names a unit itself; every label reads this table.
    for (const format of EVERY_FORMAT.filter(isProseFormat)) {
      const nouns = nounsFor(format);
      const said = [nouns.unit, nouns.sub, nouns.manuscript, nouns.work].join(' ');
      expect(said).not.toMatch(/\bScene\b|\bBeat\b|\bScript\b/);
    }
  });

  it('calls an instructional book’s parts what a textbook calls them', () => {
    const nouns = nounsFor('instructional');
    // A textbook is a numbered outline rather than a novel with teaching in
    // it, so its top division is a Section and what sits inside one is a
    // Subsection — 1, then 1.1, 1.2 (addendum 16 §15).
    expect(nouns.unit).toBe('Section');
    expect(nouns.sub).toBe('Subsection');
    expect(nouns.manuscript).toBe('Book');
  });

  it('still says Scene and Beat in a screenplay', () => {
    const nouns = nounsFor('screenplay');
    expect(nouns.unit).toBe('Scene');
    expect(nouns.sub).toBe('Beat');
    expect(nouns.manuscript).toBe('Script');
  });

  it('falls back to the script’s words for a format with none of its own', () => {
    // Rather than throwing or showing an empty label: an unnamed format is a
    // script, which is what every one of them was before prose existed.
    expect(nounsFor('other').unit).toBe('Scene');
    expect(nounsFor('stage_play').unit).toBe('Scene');
  });
});

describe('a new instructional project', () => {
  it('opens with a chapter, not a scene', () => {
    const file = createProjectFile({ title: 'Teaching Statistics', format: 'instructional' });
    expect(file.units).toHaveLength(1);
    expect(file.units[0]!.kind).toBe('chapter');
    expect(file.beats).toHaveLength(1);
  });

  it('lists its chapters on a contents page', () => {
    const file = createProjectFile({ title: 'Teaching Statistics', format: 'instructional' });
    // No markers placed yet, so nothing to list — but the format is one that
    // has a contents page at all, which a screenplay is not.
    expect(contentsDivisions(file)).toEqual([]);
    expect(hasChapterPages('instructional')).toBe(true);
  });
});
