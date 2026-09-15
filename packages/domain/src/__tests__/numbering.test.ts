import { describe, expect, it } from 'vitest';
import { addBeat, addUnit, moveUnit } from '../mutations.js';
import { createProjectFile } from '../project-file.js';
import { nounsFor } from '../formats.js';
import {
  describeNumbering,
  numberOfSub,
  numberOfUnit,
  numberedTitle,
  numbersDivisions,
  outlineNumbers,
  setSectionNumbering,
  structureNumbers,
} from '../numbering.js';
import { addItem, createOutline, findOutline, outlinesOf } from '../outline.js';
import { unitsInStoryOrder } from '../selectors.js';
import type { OutlineItemId } from '../ids.js';
import type { ProjectFile } from '../project-file.js';

/**
 * Decimal section numbering (addendum 16 §15).
 *
 * The rule worth a test is the absence: **nothing is stored**, so the proof is
 * that moving a section renumbers everything under it with nothing run.
 */

/** A textbook of `sections` sections, `subs` subsections in each. */
const textbook = (sections = 3, subs = 2) => {
  let file: ProjectFile = createProjectFile({ title: 'Teaching Optics', format: 'instructional' });
  const starters = new Set(file.units.map((one) => one.id as string));
  const laneId = file.lanes[0]!.id;
  for (let at = 0; at < sections; at += 1) {
    const unit = addUnit(file, { laneId, title: `Section ${at + 1}` });
    file = unit.file;
    for (let under = 0; under < subs; under += 1) {
      file = addBeat(file, { unitId: unit.unit.id, title: `Part ${under + 1}` }).file;
    }
  }
  return {
    file: {
      ...file,
      units: file.units.filter((one) => !starters.has(one.id as string)),
      beats: file.beats.filter((one) => !starters.has(one.unitId as string)),
    },
  };
};

describe('what a textbook calls its parts', () => {
  it('is sections and subsections, not chapters and sections', () => {
    const nouns = nounsFor('instructional');
    expect(nouns.unit).toBe('Section');
    expect(nouns.sub).toBe('Subsection');
    expect(nouns.manuscript).toBe('Book');
  });

  it('leaves every other format exactly as it was', () => {
    expect(nounsFor('screenplay').unit).toBe('Scene');
    expect(nounsFor('screenplay').sub).toBe('Beat');
    expect(nounsFor('novel').unit).toBe('Chapter');
    expect(nounsFor('novel').sub).toBe('Passage');
  });
});

describe('the numbers', () => {
  it('numbers sections 1, 2, 3 and subsections 1.1, 1.2', () => {
    const { file } = textbook(3, 2);
    const units = unitsInStoryOrder(file);
    const numbers = structureNumbers(file);

    expect(numbers.units.get(units[0]!.id as string)).toBe('1');
    expect(numbers.units.get(units[2]!.id as string)).toBe('3');

    const first = file.beats.filter((one) => one.unitId === units[0]!.id);
    expect(numbers.subs.get(first[0]!.id as string)).toBe('1.1');
    expect(numbers.subs.get(first[1]!.id as string)).toBe('1.2');

    const third = file.beats.filter((one) => one.unitId === units[2]!.id);
    expect(numbers.subs.get(third[0]!.id as string)).toBe('3.1');
  });

  /** The whole point of counting rather than storing. */
  it('renumbers everything when a section moves, with nothing run', () => {
    const { file } = textbook(3, 2);
    const units = unitsInStoryOrder(file);
    const third = units[2]!;
    const firstSubOfThird = file.beats.find((one) => one.unitId === third.id)!;

    expect(numberOfUnit(file, third.id)).toBe('3');
    expect(numberOfSub(file, firstSubOfThird.id)).toBe('3.1');

    const moved = moveUnit(file, { unitId: third.id, toLaneId: third.laneId, index: 0 });
    // Nothing was renumbered; the reading simply says something else now.
    expect(numberOfUnit(moved, third.id)).toBe('1');
    expect(numberOfSub(moved, firstSubOfThird.id)).toBe('1.1');
    expect(numberOfUnit(moved, units[0]!.id)).toBe('2');
  });

  it('stores no number anywhere, which is what makes that true', () => {
    const { file } = textbook(2, 1);
    // `sequenceLabel` is the FDX importer's stored string and stays empty.
    for (const unit of file.units) expect(unit.sequenceLabel).toBe('');
    expect(JSON.stringify(file)).not.toContain('"1.1"');
  });

  it('numbers nothing on a novel or a screenplay', () => {
    for (const format of ['novel', 'screenplay', 'short_story'] as const) {
      let file: ProjectFile = createProjectFile({ title: 'A Work', format });
      file = addUnit(file, { laneId: file.lanes[0]!.id, title: 'One' }).file;
      expect(numbersDivisions(file)).toBe(false);
      expect(structureNumbers(file).units.size).toBe(0);
    }
  });

  it('can be turned off, for a book whose structure is not an outline', () => {
    const { file } = textbook(2, 2);
    const plain = setSectionNumbering(file, 'none');

    expect(numbersDivisions(plain)).toBe(false);
    expect(numberOfUnit(plain, unitsInStoryOrder(plain)[0]!.id)).toBe('');
    expect(describeNumbering(plain)).toContain('their titles stand on their own'.replace('their', 'Their'));
  });
});

describe('the outline, which is where a textbook is actually built', () => {
  /** A textbook outline: two sections, three parts under the first. */
  const outlined = () => {
    let file: ProjectFile = createProjectFile({ title: 'Teaching Optics', format: 'instructional' });
    file = createOutline(file).file;
    const outlineId = outlinesOf(file)[0]!.id;
    const put = (kind: string, title: string, parentId: OutlineItemId | null) => {
      const made = addItem(file, outlineId, { kind, title, parentId });
      file = made.file;
      return made.itemId!;
    };
    const one = put('scene', 'Light', null);
    const parts = ['Refraction', 'Reflection', 'Diffraction'].map((title) => put('beat', title, one));
    const two = put('scene', 'Lenses', null);
    const deeper = put('beat', 'Focal length', parts[1]!);
    return { file, outlineId, one, two, parts, deeper };
  };

  const read = (made: ReturnType<typeof outlined>) =>
    outlineNumbers(made.file, findOutline(made.file, made.outlineId)!);

  it('numbers the tree 1, 1.1, 1.2, 1.2.1, 2 — as deep as it goes', () => {
    const made = outlined();
    const numbers = read(made);
    expect(numbers.get(made.one as string)).toBe('1');
    expect(numbers.get(made.parts[0]! as string)).toBe('1.1');
    expect(numbers.get(made.parts[1]! as string)).toBe('1.2');
    expect(numbers.get(made.deeper as string)).toBe('1.2.1');
    expect(numbers.get(made.two as string)).toBe('2');
  });

  it('leaves a note out of the run without breaking it', () => {
    const made = outlined();
    const outlineId = made.outlineId;
    // A thought parked between 1.1 and 1.2. It is not section 1.2, and the
    // section that follows is still 1.2 rather than 1.3.
    const note = addItem(made.file, outlineId, {
      kind: 'note',
      title: 'Ask the editor',
      parentId: made.one,
      afterId: made.parts[0]!,
    });
    const numbers = outlineNumbers(note.file, findOutline(note.file, outlineId)!);
    expect(numbers.has(note.itemId! as string)).toBe(false);
    expect(numbers.get(made.parts[1]! as string)).toBe('1.2');
  });

  it('numbers nothing on a screenplay', () => {
    let file: ProjectFile = createProjectFile({ title: 'A Script', format: 'screenplay' });
    file = createOutline(file).file;
    const outlineId = outlinesOf(file)[0]!.id;
    const made = addItem(file, outlineId, { kind: 'scene', title: 'One', parentId: null });
    expect(outlineNumbers(made.file, findOutline(made.file, outlineId)!).size).toBe(0);
  });
});

describe('how a number is shown', () => {
  it('goes in front of the writer’s title and never replaces it', () => {
    expect(numberedTitle('1.2', 'Refraction', 'Untitled')).toBe('1.2 Refraction');
    // A section called "1.2" and nothing else is one nobody can find in a list.
    expect(numberedTitle('1.2', '', 'Untitled subsection')).toBe('1.2 Untitled subsection');
    expect(numberedTitle('', 'Refraction', 'Untitled')).toBe('Refraction');
  });

  it('says there is nowhere to type one', () => {
    const { file } = textbook(3, 2);
    const says = describeNumbering(file);
    expect(says).toContain('Sections are numbered 1, 2, 3');
    expect(says).toContain('subsections 1.1, 1.2, 1.3');
    expect(says).toContain('There is nowhere to type a number');
  });
});
