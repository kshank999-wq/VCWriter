import type { BookPart } from './entities/book.js';
import type { ProjectFile } from './project-file.js';
import { newId } from './ids.js';
import { unitsInStoryOrder, beatsInScript } from './selectors.js';
import { parseInline } from './entities/inline.js';
import { onlyLiving } from './graveyard.js';
import { glossaryOf, bibliographyOf, type Source } from './back-matter-pages.js';

/**
 * **Pull from the text** (addendum 20 §17a, from Ken: *any functions in the
 * back matter that can be pulled from the text? Let's have a function and a
 * button that says pull from text*).
 *
 * The answer is that **two of the seven can, one already does, and four
 * cannot** — and saying which is most of the feature, because a button that
 * appears on a page with nothing to read is one a writer presses once and
 * never trusts again.
 *
 * Three rules hold it honest.
 *
 * **It reads the writer's own marks and never guesses.** A glossary term is
 * a word the writer marked for the index or set bold in their own prose — a
 * book's two conventions for *this is a term* — so nothing here decides what
 * a term is. A source is a research note the writer typed a `source` on.
 *
 * **It never writes a definition.** A term arrives with its definition
 * empty, because the definition is the work and the term is the tedium; a
 * generated one would be a sentence the author did not write standing in
 * their book under their name.
 *
 * **It adds and never overwrites.** Pressing it twice adds nothing the
 * second time, so an edited definition cannot be lost to a second press —
 * which is what makes it safe enough to put on the page with no ask.
 */

/** What a press would do, said before it can be asked for. */
export interface PullOffer {
  /** False where the page has nothing a book could give it. */
  can: boolean;
  /** Why not, where it cannot — a sentence, never a greyed button. */
  refusal: string | null;
  /** What pressing it would do, in words. */
  says: string;
  /** What it would add. */
  found: string[];
  /** How many of them the page already has. */
  already: number;
}

const nothing = (refusal: string): PullOffer => ({ can: false, refusal, says: '', found: [], already: 0 });

/** A term as it compares: case and outer space are not part of the word. */
const same = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Terms the book itself says are terms: **marked for the index**, or **set
 * bold** in the writing, which is how a work of non-fiction names a term on
 * its first use. Both are the writer's own marks on their own text.
 *
 * A bold run is taken only where it is short — a bolded sentence is emphasis
 * rather than a term, and a glossary of sentences is worse than no glossary.
 */
const BOLD_WORDS_MOST = 4;

export const termsInText = (file: ProjectFile): string[] => {
  const found: string[] = [];
  const add = (word: string) => {
    const said = word.trim().replace(/[.,;:—–-]+$/u, '').trim();
    if (said.length < 2) return;
    if (found.some((one) => same(one, said))) return;
    found.push(said);
  };
  // An index mark is not a graveyard kind, so the whole collection is the
  // list — there is no buried one to leave out.
  for (const mark of file.indexMarks ?? []) add(mark.term);
  for (const unit of unitsInStoryOrder(file)) {
    for (const beat of beatsInScript(file, unit.id)) {
      for (const element of beat.manuscript.elements) {
        for (const span of parseInline(element.text)) {
          if (!span.bold) continue;
          if (span.text.trim().split(/\s+/).length > BOLD_WORDS_MOST) continue;
          add(span.text);
        }
      }
    }
  }
  return found;
};

/** Research notes the writer gave a source, which is a bibliography's own list. */
export const sourcesNoted = (file: ProjectFile): string[] => {
  const found: string[] = [];
  for (const item of onlyLiving(file.researchItems ?? [])) {
    const said = (item.source ?? '').trim();
    if (said.length === 0 || found.some((one) => same(one, said))) continue;
    found.push(said);
  }
  return found;
};

/** *1 term* rather than *1 terms*, which is a figure nobody reads twice. */
const count = (many: number, one: string): string => `${many} ${one}${many === 1 ? '' : 's'}`;

const list = (found: string[]): string =>
  found.length <= 3 ? found.join(', ') : `${found.slice(0, 3).join(', ')} and ${found.length - 3} more`;

/**
 * What this page could take from the book. **Absent rather than greyed**
 * where it can take nothing: the caller draws no button at all and says the
 * refusal instead, a control that can only refuse being one that lies.
 */
export const pullOffer = (file: ProjectFile, part: BookPart): PullOffer => {
  switch (part.kind) {
    case 'glossary': {
      const have = glossaryOf(part).terms;
      const found = termsInText(file);
      const missing = found.filter((one) => !have.some((two) => same(two.term, one)));
      const already = found.length - missing.length;
      if (found.length === 0) {
        return nothing('Nothing in the book is marked as a term yet. Mark one for the index, or set it bold where it is first used.');
      }
      if (missing.length === 0) {
        return { can: false, refusal: `Every term the book marks is already here — ${count(found.length, 'term')}.`, says: '', found: [], already };
      }
      return {
        can: true,
        refusal: null,
        says: `Add ${count(missing.length, 'term')} the book marks — ${list(missing)}. The definitions stay yours to write.`,
        found: missing,
        already,
      };
    }
    case 'bibliography': {
      const have = bibliographyOf(part).sources;
      const found = sourcesNoted(file);
      const missing = found.filter((one) => !have.some((two) => same(two.raw, one)));
      const already = found.length - missing.length;
      if (found.length === 0) {
        return nothing('No research note carries a source yet. A note’s source is what this page is made of.');
      }
      if (missing.length === 0) {
        return { can: false, refusal: `Every source your notes carry is already here — ${count(found.length, 'source')}.`, says: '', found: [], already };
      }
      return {
        can: true,
        refusal: null,
        says: `Add ${count(missing.length, 'source')} from your research notes — ${list(missing)}. Each arrives as written.`,
        found: missing,
        already,
      };
    }
    case 'index':
      // It already does, continuously, and has since addendum 10: the marks
      // are in the manuscript and the page numbers are read off the
      // pagination every time. A button here would be a second, worse copy.
      return nothing('This page is already read from the text. Its terms are the ones marked in the manuscript and its page numbers follow the layout.');
    case 'acknowledgements':
      return nothing('Nobody but you knows who to thank.');
    case 'about_the_author':
      return nothing('Your name comes from the book. The rest is yours to write.');
    case 'appendix':
      return nothing('An appendix is written rather than gathered. Import a file, or write it here.');
    default:
      return nothing('There is nothing in the book this page could be made from.');
  }
};

/**
 * Take what the offer named. **Adds only, and only what is missing**, so a
 * second press changes nothing and an edited definition cannot be lost.
 */
export const pullFromText = (file: ProjectFile, part: BookPart): { about: Record<string, unknown> } | null => {
  const offer = pullOffer(file, part);
  if (!offer.can) return null;
  if (part.kind === 'glossary') {
    const own = glossaryOf(part);
    return {
      about: {
        ...own,
        terms: [...own.terms, ...offer.found.map((term) => ({ id: newId() as string, term, definition: '' }))],
      },
    };
  }
  if (part.kind === 'bibliography') {
    const own = bibliographyOf(part);
    const made: Source[] = offer.found.map((raw) => ({
      id: newId() as string,
      author: '',
      title: '',
      city: '',
      publisher: '',
      year: '',
      raw,
    }));
    return { about: { ...own, sources: [...own.sources, ...made] } };
  }
  return null;
};
