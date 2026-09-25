import { describe, expect, it } from 'vitest';
import {
  addPart,
  appendicesOf,
  appendixCaptureOffer,
  captureToAppendix,
  captureToGlossary,
  createProjectFile,
  glossaryCaptureOffer,
  glossaryEntries,
  partsOf,
  type ProjectFile,
} from '../index.js';

/**
 * **Collecting into the back matter while reading** (addendum 20 §17b).
 *
 * What these pin is the three decisions: the act makes the page rather than
 * refusing for want of one, the manuscript is never touched, and a term
 * already listed is said rather than doubled.
 */

const book = (): ProjectFile =>
  createProjectFile({ title: 'The Lamp and the Lighthouse', format: 'novel', author: 'M. Shank' });

const glossary = (file: ProjectFile) => partsOf(file).find((one) => one.kind === 'glossary')!;

describe('adding a term to the glossary from the writing', () => {
  it('makes the page where the book has none, and says so first', () => {
    // §4b's rule: an act makes the reading true rather than requiring it. A
    // writer who picks a word and asks for it in the glossary is telling you
    // the book has one.
    const file = book();
    const offer = glossaryCaptureOffer(file, 'Fresnel lens');
    expect(offer.can).toBe(true);
    expect(offer.makesPage).toBe(true);

    const after = captureToGlossary(file, 'Fresnel lens');
    expect(glossaryEntries(glossary(after)).map((one) => one.term)).toEqual(['Fresnel lens']);
  });

  it('leaves the definition empty, because the definition is the work', () => {
    // §17a's rule: a generated definition is a sentence the author did not
    // write standing in their book under their name.
    const after = captureToGlossary(book(), 'Fresnel lens');
    expect(glossaryEntries(glossary(after))[0]!.definition).toBe('');
  });

  it('keeps a definition where the writer wrote one at the point of picking', () => {
    const after = captureToGlossary(book(), 'Fresnel lens', '  A stepped lens.  ');
    expect(glossaryEntries(glossary(after))[0]!.definition).toBe('A stepped lens.');
  });

  it('says a term already listed rather than doubling it', () => {
    // Ignoring the press silently would leave the writer none the wiser; a
    // second *Fresnel lens* is worse than the first.
    const once = captureToGlossary(book(), 'Fresnel lens');
    const offer = glossaryCaptureOffer(once, '  fresnel LENS ');
    expect(offer.can).toBe(false);
    expect(offer.refusal).toContain('already in the glossary');
    // And the act refuses the same thing again, so a caller cannot get past
    // the reading by not reading it — `trackRemoval`'s shape.
    expect(glossaryEntries(glossary(captureToGlossary(once, 'fresnel lens'))).length).toBe(1);
  });

  it('refuses nothing picked, in a sentence a writer can act on', () => {
    expect(glossaryCaptureOffer(book(), '   ').refusal).toBe('Pick a word first.');
  });

  it('adds to the page the book already has rather than making a second', () => {
    const one = captureToGlossary(book(), 'Fresnel lens');
    const two = captureToGlossary(one, 'occulting light');
    expect(partsOf(two).filter((part) => part.kind === 'glossary').length).toBe(1);
    expect(glossaryEntries(glossary(two)).length).toBe(2);
  });
});

describe('adding a passage to the appendix from the writing', () => {
  const passage = 'The lens was ground in Paris in 1823 and shipped in nine crates.';

  it('makes the appendix where there is none', () => {
    const file = book();
    expect(appendixCaptureOffer(file, passage).makesPage).toBe(true);
    const after = captureToAppendix(file, passage);
    expect(appendicesOf(after).length).toBe(1);
    expect(appendicesOf(after)[0]!.part.text).toBe(passage);
  });

  it('copies and never cuts — the writing it came from is untouched', () => {
    // The promise the note under the menu item makes.
    const file = book();
    const before = JSON.stringify(file.beats);
    const after = captureToAppendix(file, passage);
    expect(JSON.stringify(after.beats)).toBe(before);
  });

  it('appends to the appendix the book has, keeping what is already there', () => {
    const one = captureToAppendix(book(), 'First.');
    const two = captureToAppendix(one, 'Second.');
    expect(appendicesOf(two).length).toBe(1);
    expect(appendicesOf(two)[0]!.part.text).toBe('First.\n\nSecond.');
  });

  it('lands in the appendix named, where the book has several', () => {
    const one = captureToAppendix(book(), 'First.');
    const made = addPart(one, 'appendix', { title: 'Sources' });
    const two = captureToAppendix(made.file, 'Second.', made.partId!);
    const all = appendicesOf(two);
    expect(all.length).toBe(2);
    expect(all[0]!.part.text).toBe('First.');
    expect(all[1]!.part.text).toBe('Second.');
    // The letters are a reading of where each falls, so the second is B.
    expect(all.map((one) => one.label)).toEqual(['A', 'B']);
    expect(appendixCaptureOffer(two, 'Third.', made.partId!).says).toContain('Appendix B');
  });

  it('refuses nothing picked', () => {
    expect(appendixCaptureOffer(book(), '  ').can).toBe(false);
  });
});
