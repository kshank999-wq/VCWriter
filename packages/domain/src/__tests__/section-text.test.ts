import { describe, expect, it } from 'vitest';
import {
  addBeat,
  createProjectFile,
  isSectionText,
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
