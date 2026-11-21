import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  addBeat,
  createProjectFile,
  isSectionText,
  keepLinked,
  unitsInStoryOrder,
  parseProjectFile,
  sectionTextOf,
  serializeProjectFile,
  structureNumbers,
  subsectionHeading,
  updateBeat,
  writeSectionText,
} from '../index.js';

/**
 * A section's own text (from Ken, 21 November: *section 1.1, I should be able
 * to write that without another subheading*).
 */
describe('a section’s own text', () => {
  it('is how a new book starts: no subsection, no heading, no number', () => {
    const file = createProjectFile({ title: 'Guide', format: 'instructional' });
    const unit = file.units[0]!;
    const text = sectionTextOf(file, unit.id)!;
    expect(text).toBeTruthy();
    expect(subsectionHeading(file, text).shown).toBe(false);
    expect(structureNumbers(file).subs.has(text.id as string)).toBe(false);
  });

  it('turns an old "Opening beat" into the section’s text when the book is opened', () => {
    let file = createProjectFile({ title: 'Guide', format: 'instructional' });
    const first = file.beats[0]!;
    file = updateBeat(file, first.id, { title: 'Opening beat', headingShown: true });
    const reopened = parseProjectFile(JSON.parse(serializeProjectFile(file)));
    const beat = reopened.beats.find((one) => one.id === first.id)!;
    expect(beat.headingShown).toBe(false);
    expect(isSectionText(reopened, beat)).toBe(true);
    // A novel's is left as it was.
    const novel = createProjectFile({ title: 'Novel', format: 'novel' });
    expect(parseProjectFile(JSON.parse(serializeProjectFile(novel))).beats[0]!.title).toBe('Opening beat');
  });

  it('numbers the headed subsections after it 1, 2, 3, and can be added to a section that has only subsections', () => {
    let file = createProjectFile({ title: 'Guide', format: 'instructional' });
    const unit = file.units[0]!;
    file = updateBeat(file, file.beats[0]!.id, { title: 'We are talking about creative writing', headingShown: true });
    file = addBeat(file, { unitId: unit.id, title: 'You want to be rich' }).file;
    expect(sectionTextOf(file, unit.id)).toBeNull();
    const made = writeSectionText(file, unit.id);
    file = made.file;
    expect(sectionTextOf(file, unit.id)?.id).toBe(made.beatId);
    const numbers = structureNumbers(file);
    const subs = file.beats.filter((one) => one.unitId === unit.id && one.id !== made.beatId).map((one) => numbers.subs.get(one.id as string));
    expect(subs.sort()).toEqual(['1.1', '1.2']);
    // Asking again gives the same place.
    expect(writeSectionText(file, unit.id).beatId).toBe(made.beatId);
  });
});

describe('the outline and a section’s text', () => {
  const sample = () =>
    parseProjectFile(JSON.parse(readFileSync(new URL('../../../../apps/desktop/src/renderer/samples/instructional.vcw', import.meta.url), 'utf8')));

  it('keeps a section in its own chapter when the track gives the outline something new', () => {
    const file = sample();
    const unit = unitsInStoryOrder(file)[0]!;
    const linked = keepLinked(file, writeSectionText(file, unit.id).file);
    const numbers = structureNumbers(linked);
    // Chapter 1's section stays in chapter 1, chapter 2's in chapter 2 (they were 3.3 and 3.4).
    expect(numbers.units.get(unit.id as string)?.startsWith('1.')).toBe(true);
    expect(numbers.units.get(unitsInStoryOrder(linked)[1]!.id as string)?.startsWith('2.')).toBe(true);
  });

  it('gives the section text no row of its own, and its subsections count from 1', () => {
    const file = sample();
    const unit = unitsInStoryOrder(file)[0]!;
    const made = writeSectionText(file, unit.id);
    const linked = keepLinked(file, made.file);
    expect(linked.outlines![0]!.items.some((row) => row.boundBeatId === made.beatId)).toBe(false);
    const sub = linked.beats.find((one) => one.unitId === unit.id && one.id !== made.beatId)!;
    expect(structureNumbers(linked).subs.get(sub.id as string)?.endsWith('.1')).toBe(true);
  });
});
