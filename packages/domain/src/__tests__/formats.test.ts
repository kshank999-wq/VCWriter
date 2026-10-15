import { describe, expect, it } from 'vitest';
import {
  contentsDivisions,
  createProjectFile,
  defaultElementType,
  defaultMarkerKind,
  defaultUnitKind,
  elementTypesFor,
  formatName,
  formatSpokenName,
  hasBookIndex,
  hasChapterPages,
  builtElsewhere,
  isInstructional,
  spokenFormatChoices,
  spokenFormatNames,
  isInteractive,
  isProseFormat,
  startsHere,
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
  // Added with addendum 30, and the omission was the kind this file exists to
  // stop: a list called *every format* that was one short.
  'game',
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

/**
 * Where a format is built (addendum 30).
 *
 * The half worth testing is the half that is easy to get wrong by doing too
 * much: a game is no longer **started** here, and everything else about the
 * format is untouched. If `isInteractive` ever answered this question instead,
 * every project already written in that format would lose its graph.
 */
describe('a format built in another program', () => {
  it('names the program and reads its address off one host', () => {
    const studio = builtElsewhere('game');
    expect(studio?.name).toBe('VC Game Studio');
    expect(studio?.host).toBe('vc-gamestudio.com');
    expect(studio?.url).toBe('https://vc-gamestudio.com');
  });

  it('is the only one, and every other format starts here', () => {
    expect(EVERY_FORMAT.filter((format) => !startsHere(format))).toEqual(['game']);
  });

  it('takes nothing away from a project already in that format', () => {
    // The module, the schema and the manuscript are all where they were: what
    // is withdrawn is a way in, never a feature.
    expect(isInteractive('game')).toBe(true);
    const file = createProjectFile({ title: 'Ashfall', format: 'game' });
    expect(file.project.format).toBe('game');
    expect(nounsFor('game').unit).toBe('Scene');
    expect(file.units).toHaveLength(1);
  });
});

/**
 * **What the format is called** (addendum 35 §1).
 *
 * `EVERY_FORMAT`'s own lesson pointed at a name rather than at a predicate:
 * each screen that printed one wrote the list out, and the two on the desktop
 * had drifted — *Instructional book* on the grid a writer chooses from,
 * *Instructional or textbook* on the screen that brings one in.
 */
describe('what a format is called', () => {
  it('names every one of them, the ninth included', () => {
    // The four private lists all stopped at eight, so a project carrying
    // `other` — none can be made, and nothing stops one arriving — would have
    // found no name at all.
    for (const format of EVERY_FORMAT) {
      expect(formatName(format)).not.toBe('');
      expect(formatName(format)).not.toBe(format);
    }
    expect(formatName('other')).toBe('Other');
  });

  it('keeps the name a writer chose the project by', () => {
    expect(formatName('instructional')).toBe('Instructional book');
    expect(formatName('short_story')).toBe('Short stories and collections');
    expect(formatName('series')).toBe('Series or episodic');
  });

  it('never prints the column value, which is what a hover used to show', () => {
    // The title bar carried `short story` and `instructional` in a tooltip:
    // the schema's spelling, said to whoever rested a pointer on the title.
    for (const format of EVERY_FORMAT) {
      expect(formatName(format)).not.toMatch(/_/);
      expect(formatName(format)[0]).toBe(formatName(format)[0]!.toUpperCase());
    }
  });

  /**
   * **The phone's name is a different question** (§1a). Nobody says *Series or
   * episodic* on a walk, and Ken's own word for a textbook out loud is
   * *educational book* — so there are two vocabularies, and the rule is that a
   * surface reads one of them rather than keeping a third.
   */
  it('is deliberately not the spoken name, and the phone reads that one', () => {
    expect(formatSpokenName('series')).toBe('Series');
    expect(formatSpokenName('instructional')).toBe('Educational book');
    expect(formatName('series')).not.toBe(formatSpokenName('series'));
  });

  it('offers from a pocket only what may be started here', () => {
    const offered = spokenFormatChoices().map((one) => one.format);
    expect(offered).not.toContain('game');
    expect(offered.every(startsHere)).toBe(true);
    // The sentence that lists the choices is the same reading, so the list and
    // the words said aloud cannot disagree.
    expect(spokenFormatNames()).toEqual(spokenFormatChoices().map((one) => one.name));
    // A project already in that format still has a word, the row otherwise
    // drawing the raw column value (addendum 30).
    expect(formatSpokenName('game')).toBe('Game');
  });
});
