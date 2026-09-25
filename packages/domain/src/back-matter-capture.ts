import type { BookPart, PartKind } from './entities/book.js';
import type { ProjectFile } from './project-file.js';
import { newId } from './ids.js';
import { addPart, partsOf, updatePart } from './book-plan.js';
import { glossaryOf, appendixLabel, appendixOf } from './back-matter-pages.js';

/**
 * **Adding to the back matter from the writing** (addendum 20 §17b, from Ken:
 * *for the appendix and the glossary and the index in the book view as you're
 * reading it you can pick a word and when you use the right click menu you can
 * say add to appendix add to index add to glossary*).
 *
 * **One of the three was already built.** *Index this…* has been on the
 * manuscript's right-click since addendum 10 §6, and it is the better half of
 * the three: a mark anchored to the passage, with the page number read off
 * the pagination every time. So this is the other two, built to its shape.
 *
 * Three decisions carry it.
 *
 * **The act makes the page** rather than refusing for want of one. A writer
 * who picks a word and asks for it in the glossary is telling you the book
 * has a glossary; sending them to Layout to make one first is §4b's mistake —
 * an act must make the reading true rather than require it.
 *
 * **A word for the two that list words, the passage for the one that holds
 * prose.** An index entry and a glossary term are things a reader looks up,
 * so they take what was picked; an appendix is supplementary *material*, so
 * *add to the appendix* means the passage. Saying which is which is the
 * screen's job, and `captureOffer` says it before the act can be asked for.
 *
 * **A term already listed is said, never doubled.** A glossary with *Fresnel
 * lens* twice is worse than one with it once, and the writer who asked did
 * not know it was there — which is a thing to be told rather than silently
 * ignored.
 */

/** What a press would do, or why it would not — `trackRemoval`'s shape. */
export interface CaptureOffer {
  can: boolean;
  refusal: string | null;
  /** What pressing it would do, in words. */
  says: string;
  /** True where the page does not exist yet and the act would make it. */
  makesPage: boolean;
}

const no = (refusal: string): CaptureOffer => ({ can: false, refusal, says: '', makesPage: false });

const pageOf = (file: ProjectFile, kind: PartKind): BookPart | null =>
  partsOf(file).find((one) => one.kind === kind) ?? null;

/** A term as it compares: a writer retyping is not promising to match capitals. */
const same = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

// ------------------------------------------------------------------ glossary

export const glossaryCaptureOffer = (file: ProjectFile, term: string): CaptureOffer => {
  const said = term.trim();
  if (said.length === 0) return no('Pick a word first.');
  const page = pageOf(file, 'glossary');
  if (page && glossaryOf(page).terms.some((one) => same(one.term, said))) {
    return no(`“${said}” is already in the glossary.`);
  }
  return {
    can: true,
    refusal: null,
    // **The page it would make is said in the same breath**, not in a second
    // sentence under it: *start a glossary* and *the book has no glossary
    // yet* are one fact, and a screen saying both twice reads as two.
    says: page
      ? `Add “${said}” to the glossary. What it means stays yours to write.`
      : `Start a glossary at the back of the book, with “${said}” in it. What it means stays yours to write.`,
    makesPage: page === null,
  };
};

/**
 * Put a term in the glossary, making the page where the book has none.
 * **The definition is not written here** — §17a's rule, and the reason is the
 * same: a generated one would be a sentence the author did not write standing
 * in their book under their name.
 */
export const captureToGlossary = (file: ProjectFile, term: string, definition = ''): ProjectFile => {
  if (!glossaryCaptureOffer(file, term).can) return file;
  const standing = pageOf(file, 'glossary');
  const made = standing ? { file, partId: standing.id } : addPart(file, 'glossary', { title: 'Glossary' });
  const partId = made.partId;
  if (!partId) return file;
  const page = partsOf(made.file).find((one) => one.id === partId);
  if (!page) return file;
  const own = glossaryOf(page);
  return updatePart(made.file, partId, {
    about: {
      ...own,
      terms: [...own.terms, { id: newId() as string, term: term.trim(), definition: definition.trim() }],
    },
  });
};

// ------------------------------------------------------------------ appendix

/** The appendices a book has, in the order they are lettered. */
export const appendicesOf = (file: ProjectFile): Array<{ part: BookPart; label: string }> => {
  const mine = partsOf(file).filter((one) => one.kind === 'appendix');
  const labels = mine[0] ? appendixOf(mine[0]).labels : 'letters';
  return mine.map((part, at) => ({ part, label: appendixLabel(at, labels) }));
};

export const appendixCaptureOffer = (file: ProjectFile, passage: string, partId?: string): CaptureOffer => {
  const said = passage.trim();
  if (said.length === 0) return no('Pick a passage first.');
  const mine = appendicesOf(file);
  const chosen = partId ? mine.find((one) => (one.part.id as string) === partId) : mine[0];
  return {
    can: true,
    refusal: null,
    // **The passage rather than the word**, said plainly: an appendix holds
    // material, and a writer who expected one word would find a paragraph.
    says: chosen
      ? `Add this passage to the end of Appendix ${chosen.label}. The writing it came from is untouched.`
      : 'Start an appendix at the back of the book, with this passage in it. The writing it came from is untouched.',
    makesPage: mine.length === 0,
  };
};

/**
 * Append the passage to an appendix — the one named, or the book's only one,
 * or a new one where there is none. **The manuscript is never touched**: this
 * copies, exactly as the research shelf's filing does.
 */
export const captureToAppendix = (file: ProjectFile, passage: string, partId?: string): ProjectFile => {
  if (!appendixCaptureOffer(file, passage).can) return file;
  const mine = appendicesOf(file);
  const chosen = partId ? mine.find((one) => (one.part.id as string) === partId)?.part : mine[0]?.part;
  if (chosen) {
    const text = chosen.text.trim();
    return updatePart(file, chosen.id, { text: text.length > 0 ? `${text}\n\n${passage.trim()}` : passage.trim() });
  }
  return addPart(file, 'appendix', { title: '', text: passage.trim() }).file;
};
